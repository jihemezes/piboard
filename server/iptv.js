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

/* ============================================================
   Xtream Codes -- systeme distinct d'un simple fichier M3U statique.
   La plupart des plateformes IPTV par abonnement (identifiant + mot de
   passe) reposent dessus : trois sources (chaines en direct, films,
   series), chacune organisee en categories, avec un point d'API JSON
   (player_api.php) plutot qu'une simple liste a plat. C'est ce systeme
   que gerent nativement SmartIPTV, TiviMate, IPTV Smarters.

   Xtream Codes -- a system distinct from a plain static M3U file. Most
   subscription-based IPTV platforms (username + password) run on it:
   three sources (live channels, movies, series), each organized into
   categories, with a JSON API endpoint (player_api.php) rather than a
   flat list. This is the system SmartIPTV, TiviMate and IPTV Smarters
   natively handle.
   ============================================================ */

/* Detecte si une URL de playlist est en realite une URL Xtream (le cas
   le plus courant : un lien "get.php?username=...&password=...&type=
   m3u_plus" genere par le panneau du fournisseur) et en extrait le
   serveur racine et les identifiants. Le champ de reglage "adresse de
   la playlist" reste unique cote widget -- inutile de demander a
   nouveau ce que l'URL contient deja.

   Detects whether a playlist URL is actually an Xtream one (the most
   common case: a "get.php?username=...&password=...&type=m3u_plus"
   link generated by the provider's panel) and extracts the root server
   and credentials from it. The "playlist address" setting stays a
   single field on the widget's side -- no point asking again for what
   the URL already contains. */
function parseXtreamCredentials(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return null;
  }
  const username = parsed.searchParams.get("username");
  const password = parsed.searchParams.get("password");
  if (!username || !password) return null;
  return { server: parsed.origin, username, password };
}

async function xtreamApi(server, username, password, action, extraParams) {
  const params = new URLSearchParams(Object.assign({ username, password }, action ? { action } : {}, extraParams || {}));
  const url = server + "/player_api.php?" + params.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", "Accept": "application/json" }
    });
    if (!res.ok) throw new Error("upstream status " + res.status);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      // Un panneau Xtream renvoie parfois du HTML (identifiants
      // rejetes, panneau en maintenance) la ou du JSON est attendu :
      // signale distinctement plutot que de faire echouer sur une
      // erreur de syntaxe peu parlante. An Xtream panel sometimes
      // returns HTML (rejected credentials, panel under maintenance)
      // where JSON is expected: flagged distinctly rather than failing
      // on an unhelpful syntax error.
      throw new Error("invalid response from panel (bad credentials?)");
    }
  } finally {
    clearTimeout(timer);
  }
}

/* Verifie les identifiants et recupere les 3 listes de categories en
   parallele -- c'est ce qui alimente le premier niveau de navigation
   (Direct / Films / Series), chacun avec ses propres categories.
   Checks credentials and fetches the 3 category lists in parallel --
   this feeds the first navigation level (Live / Movies / Series), each
   with its own categories. */
async function fetchXtreamCategories(server, username, password) {
  const [account, live, vod, series] = await Promise.all([
    xtreamApi(server, username, password, "", {}),
    xtreamApi(server, username, password, "get_live_categories", {}),
    xtreamApi(server, username, password, "get_vod_categories", {}),
    xtreamApi(server, username, password, "get_series_categories", {})
  ]);
  if (!account || account.user_info == null) throw new Error("invalid credentials");
  const mapCats = (arr) => (Array.isArray(arr) ? arr : []).map((c) => ({
    id: String(c.category_id), name: c.category_name || String(c.category_id)
  }));
  return {
    accountStatus: account.user_info.status || null,
    expiresAt: account.user_info.exp_date || null,
    live: mapCats(live),
    vod: mapCats(vod),
    series: mapCats(series)
  };
}

const XTREAM_ACTIONS = { live: "get_live_streams", vod: "get_vod_streams", series: "get_series" };

/* Flux d'une categorie donnee, pour l'une des 3 sources. Construit
   directement l'URL de lecture -- le widget n'a rien a assembler lui-
   meme. Streams for a given category, for one of the 3 sources. Builds
   the playback URL directly -- the widget has nothing to assemble
   itself. */
async function fetchXtreamStreams(server, username, password, kind, categoryId) {
  const action = XTREAM_ACTIONS[kind];
  if (!action) throw new Error("invalid kind");
  const data = await xtreamApi(server, username, password, action, categoryId ? { category_id: categoryId } : {});
  const list = Array.isArray(data) ? data : [];

  if (kind === "series") {
    // Une serie n'a pas de flux directement lisible : il faut d'abord
    // choisir un episode (voir fetchXtreamSeriesEpisodes). A series has
    // no directly playable stream: an episode must be picked first (see
    // fetchXtreamSeriesEpisodes).
    return list.slice(0, MAX_CHANNELS).map((s) => ({
      id: String(s.series_id), name: s.name || "", logo: s.cover || "", isSeries: true
    }));
  }

  return list.slice(0, MAX_CHANNELS).map((s) => {
    const id = String(kind === "live" ? s.stream_id : s.stream_id);
    const ext = kind === "vod" ? (s.container_extension || "mp4") : "m3u8";
    const path = kind === "live" ? "live" : "movie";
    return {
      id,
      name: s.name || "",
      logo: s.stream_icon || "",
      // Extension issue du panneau lui-meme (container_extension) pour
      // les films : un format que le navigateur ne sait pas lire
      // (Matroska/.mkv, tres courant en VOD) reste indique tel quel --
      // voir la mise en garde cote widget plutot que de pretendre que
      // tout sera lisible. Extension coming from the panel itself
      // (container_extension) for movies: a format the browser can't
      // read (Matroska/.mkv, very common for VOD) is still reported
      // as-is -- see the widget-side caveat rather than pretending
      // everything will play.
      containerExt: kind === "vod" ? ext : null,
      url: `${server}/${path}/${username}/${password}/${id}.${ext}`
    };
  });
}

/* Episodes d'une serie, regroupes par saison -- necessite un second
   appel dedie (get_series_info), l'API Xtream ne les livrant pas avec
   la liste des series elle-meme. Episodes of a series, grouped by
   season -- needs a second, dedicated call (get_series_info), the
   Xtream API not shipping them with the series list itself. */
async function fetchXtreamSeriesEpisodes(server, username, password, seriesId) {
  const data = await xtreamApi(server, username, password, "get_series_info", { series_id: seriesId });
  const episodesBySeason = (data && data.episodes) || {};
  const seasons = Object.keys(episodesBySeason)
    .sort((a, b) => Number(a) - Number(b))
    .map((seasonNum) => ({
      season: Number(seasonNum),
      episodes: (episodesBySeason[seasonNum] || []).map((e) => ({
        id: String(e.id),
        name: e.title || ("Episode " + e.episode_num),
        ext: (e.container_extension || "mp4"),
        url: `${server}/series/${username}/${password}/${e.id}.${e.container_extension || "mp4"}`
      }))
    }));
  return { seasons, plot: (data && data.info && data.info.plot) || null };
}

module.exports.parseXtreamCredentials = parseXtreamCredentials;
module.exports.fetchXtreamCategories = fetchXtreamCategories;
module.exports.fetchXtreamStreams = fetchXtreamStreams;
module.exports.fetchXtreamSeriesEpisodes = fetchXtreamSeriesEpisodes;
