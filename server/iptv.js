/* ============================================================
   PiBoard - server/iptv.js
   Recuperation et analyse d'une playlist M3U/M3U8 -- le format de
   liste de chaines standard, celui que lisent VLC, Kodi et la plupart
   des lecteurs IPTV.

   Pourquoi cote serveur plutot que dans le navigateur : la plupart des
   hebergeurs de playlist n'envoient pas d'en-tetes CORS, une requete
   directe depuis la page serait donc bloquee par le navigateur. Le
   serveur PiBoard, lui, n'est pas soumis a cette restriction. Il ne
   fait que RECUPERER ET ANALYSER la liste : les flux video eux-memes
   sont lus directement par le navigateur, sans transiter par le Pi
   (relayer de la video le mettrait a genoux).

   Fetches and parses an M3U/M3U8 playlist -- the standard channel-list
   format, the one VLC, Kodi and most IPTV players read.

   Why server-side rather than in the browser: most playlist hosts don't
   send CORS headers, so a direct request from the page would be blocked
   by the browser. The PiBoard server isn't subject to that restriction.
   It only FETCHES AND PARSES the list: the video streams themselves are
   read directly by the browser, without passing through the Pi (relaying
   video would bring it to its knees).
   ============================================================ */
"use strict";

const FETCH_TIMEOUT_MS = 15000;
// Une playlist IPTV peut etre enorme (plusieurs dizaines de milliers de
// chaines) : plafond de taille pour ne pas saturer la memoire d'un Pi.
// An IPTV playlist can be huge (tens of thousands of channels): a size
// cap so a Pi's memory doesn't get saturated.
const MAX_PLAYLIST_CHARS = 12 * 1024 * 1024; // ~12 Mo
// Plafond du nombre de chaines renvoyees au navigateur : au-dela, la
// liste devient de toute facon inexploitable a l'ecran, et le JSON
// pese lourd a transferer puis a afficher.
// Cap on how many channels get sent to the browser: beyond that the
// list is unusable on screen anyway, and the JSON gets heavy to
// transfer and then render.
const MAX_CHANNELS = 5000;

/* Analyse le format M3U etendu :
     #EXTM3U
     #EXTINF:-1 tvg-logo="http://..." group-title="Info",France 24
     https://.../stream.m3u8
   La ligne #EXTINF porte les metadonnees (attributs cle="valeur" puis,
   apres la virgule, le nom affichable) ; la ligne suivante non vide et
   non commentee porte l'URL du flux.

   Parses the extended M3U format: the #EXTINF line carries the metadata
   (key="value" attributes then, after the comma, the display name); the
   next non-empty, non-comment line carries the stream URL. */
function parseM3u(text) {
  const lines = String(text || "").split(/\r?\n/);
  const channels = [];
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith("#EXTINF")) {
      const afterColon = line.slice(line.indexOf(":") + 1);
      const commaIdx = afterColon.indexOf(",");
      const attrsPart = commaIdx === -1 ? afterColon : afterColon.slice(0, commaIdx);
      const name = commaIdx === -1 ? "" : afterColon.slice(commaIdx + 1).trim();

      const attrs = {};
      const attrRe = /([\w-]+)="([^"]*)"/g;
      let m;
      while ((m = attrRe.exec(attrsPart)) !== null) attrs[m[1].toLowerCase()] = m[2];

      pending = {
        name: name || attrs["tvg-name"] || "",
        logo: attrs["tvg-logo"] || "",
        group: attrs["group-title"] || "",
        tvgId: attrs["tvg-id"] || ""
      };
      continue;
    }

    // Toute autre ligne commencant par # est une directive ignoree
    // (#EXTGRP, #EXTVLCOPT, commentaires...). Any other line starting
    // with # is an ignored directive (#EXTGRP, #EXTVLCOPT, comments...).
    if (line.startsWith("#")) continue;

    // Ligne d'URL : cloture l'entree en cours. Une playlist simple (sans
    // #EXTINF) reste lisible -- l'URL sert alors de nom.
    // URL line: closes the current entry. A plain playlist (no #EXTINF)
    // stays readable -- the URL then doubles as the name.
    if (!/^https?:\/\//i.test(line)) { pending = null; continue; }
    const entry = pending || { name: "", logo: "", group: "", tvgId: "" };
    entry.url = line;
    if (!entry.name) entry.name = line.split("/").pop() || line;
    channels.push(entry);
    pending = null;
    if (channels.length >= MAX_CHANNELS) break;
  }

  return channels;
}

async function fetchPlaylist(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error("invalid url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("unsupported protocol");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", "Accept": "*/*" }
    });
    if (!res.ok) throw new Error("upstream status " + res.status);
    let text = await res.text();
    if (text.length > MAX_PLAYLIST_CHARS) text = text.slice(0, MAX_PLAYLIST_CHARS);
    const channels = parseM3u(text);
    // Groupes distincts, dans leur ordre d'apparition : sert a peupler
    // le filtre par categorie cote widget sans re-parcourir la liste.
    // Distinct groups, in order of appearance: used to populate the
    // widget's category filter without walking the list again.
    const groups = [];
    for (const c of channels) {
      if (c.group && !groups.includes(c.group)) groups.push(c.group);
    }
    return { channels, groups, truncated: channels.length >= MAX_CHANNELS };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseM3u, fetchPlaylist };
