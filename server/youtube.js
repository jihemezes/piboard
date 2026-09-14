/* ============================================================
   PiBoard - server/youtube.js
   Cote serveur de la tuile YouTube : reconnaitre ce que l'utilisateur
   a colle (video, playlist, chaine), lire le flux RSS public d'une
   chaine ou d'une playlist, et -- si l'utilisateur a fourni sa propre
   cle API Google -- chercher des videos.

   LE LECTEUR LUI-MEME N'EST PAS ICI : la tuile integre le lecteur
   officiel de YouTube en \"mode confidentialite avancee\"
   (youtube-nocookie.com/embed/...), celui que Google fournit aux
   developpeurs pour integrer des videos dans une page. Il ne depose
   aucun cookie de suivi et n'affiche donc pas de publicite
   personnalisee -- en pratique, aujourd'hui, le plus souvent aucune
   publicite du tout. Ce n'est PAS un bloqueur : rien n'est intercepte,
   rien n'est contourne, et Google reste libre d'y diffuser des
   annonces demain. La tuile joue donc les videos telles que YouTube
   les sert a ce lecteur, ni plus ni moins.

   POURQUOI LE RSS ET PAS L'API POUR \"LA DERNIERE VIDEO D'UNE CHAINE\" :
   YouTube publie un flux Atom public par chaine et par playlist
   (youtube.com/feeds/videos.xml), sans cle, sans quota, avec les
   quinze dernieres videos. C'est exactement ce qu'il faut a un ecran
   mural, et ca marche pour tout le monde des l'installation. L'API
   Data n'est utilisee que pour ce que le flux ne sait pas faire : la
   recherche, et la resolution d'un @pseudo en identifiant de chaine
   quand la lecture de la page ne suffit pas.

   Server side of the YouTube tile: recognizing what the user pasted
   (video, playlist, channel), reading a channel's or a playlist's
   public RSS feed, and -- if the user supplied their own Google API
   key -- searching for videos.

   THE PLAYER ITSELF IS NOT HERE: the tile embeds YouTube's official
   player in \"privacy-enhanced mode\" (youtube-nocookie.com/embed/...),
   the one Google provides to developers for embedding videos in a
   page. It sets no tracking cookie and therefore shows no personalized
   advertising -- in practice, today, most often no advertising at all.
   It is NOT a blocker: nothing is intercepted, nothing is bypassed, and
   Google remains free to serve ads there tomorrow. The tile thus plays
   videos exactly as YouTube serves them to that player, no more, no
   less.

   WHY RSS RATHER THAN THE API FOR \"A CHANNEL'S LATEST VIDEO\": YouTube
   publishes a public Atom feed per channel and per playlist
   (youtube.com/feeds/videos.xml), with no key, no quota, and the
   fifteen latest videos. That is exactly what a wall display needs,
   and it works for everyone right after installing. The Data API is
   only used for what the feed cannot do: searching, and resolving an
   @handle into a channel id when reading the page is not enough.
   ============================================================ */

"use strict";

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "PiBoard YouTube tile";

/* ---------- Reconnaissance de ce qui a ete colle / recognizing what was pasted ----------
   Toutes les formes courantes d'adresse YouTube, plus les identifiants
   nus. Un identifiant de video fait 11 caracteres [A-Za-z0-9_-] ; une
   playlist commence par PL, UU, LL, OL, RD... ; une chaine par UC (24
   caracteres). Un @pseudo est accepte tel quel et resolu plus loin.
   Every common shape of YouTube address, plus bare identifiers. A video
   id is 11 characters [A-Za-z0-9_-]; a playlist starts with PL, UU, LL,
   OL, RD...; a channel with UC (24 characters). An @handle is accepted
   as is and resolved further down. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^(PL|UU|LL|OL|RD|FL)[A-Za-z0-9_-]{10,}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

function parseSource(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return null;

  if (VIDEO_ID.test(raw)) return { kind: "video", id: raw };
  if (PLAYLIST_ID.test(raw)) return { kind: "playlist", id: raw };
  if (CHANNEL_ID.test(raw)) return { kind: "channel", id: raw };
  if (/^@[\w.-]{3,}$/.test(raw)) return { kind: "handle", id: raw };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host !== "youtube.com" && host !== "youtube-nocookie.com" && host !== "youtu.be") return null;

  const list = url.searchParams.get("list");
  const v = url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);

  // Une playlist explicite l'emporte sur la video qui l'accompagne :
  // coller \"watch?v=X&list=PL...\" veut presque toujours dire \"cette
  // playlist\", la video n'etant que celle affichee au moment du copier.
  // An explicit playlist wins over its accompanying video: pasting
  // \"watch?v=X&list=PL...\" almost always means \"this playlist\", the
  // video merely being the one shown at copy time.
  if (list && PLAYLIST_ID.test(list)) return { kind: "playlist", id: list };
  if (host === "youtu.be" && parts[0] && VIDEO_ID.test(parts[0])) return { kind: "video", id: parts[0] };
  if (v && VIDEO_ID.test(v)) return { kind: "video", id: v };
  if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") && parts[1] && VIDEO_ID.test(parts[1])) {
    return { kind: "video", id: parts[1] };
  }
  if (parts[0] === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) return { kind: "channel", id: parts[1] };
  if (parts[0] && parts[0].startsWith("@")) return { kind: "handle", id: parts[0] };
  if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { kind: "handle", id: "@" + parts[1] };
  return null;
}

/* ---------- Requetes reseau / network requests ---------- */
async function fetchText(url, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: Object.assign({ "User-Agent": USER_AGENT, "Accept-Language": "fr,en;q=0.8" }, headers || {})
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Resolution d'un @pseudo / resolving an @handle ----------
   Le flux RSS exige l'identifiant UC..., que la page d'une chaine
   contient dans ses metadonnees (\"channelId\":\"UC...\", ou la balise
   <link rel=\"canonical\">). Lire cette page publique est fragile par
   nature -- YouTube peut en changer la forme -- d'ou deux motifs
   distincts, et l'API en secours si une cle est fournie.
   The RSS feed requires the UC... identifier, which a channel's page
   holds in its metadata (\"channelId\":\"UC...\", or the
   <link rel=\"canonical\"> tag). Reading that public page is fragile by
   nature -- YouTube may change its shape -- hence two distinct
   patterns, and the API as a fallback when a key is provided. */
async function resolveHandle(handle, apiKey) {
  const clean = handle.startsWith("@") ? handle : "@" + handle;
  try {
    const html = await fetchText("https://www.youtube.com/" + encodeURIComponent(clean));
    const m = /"channelId":"(UC[A-Za-z0-9_-]{22})"/.exec(html)
      || /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(html);
    if (m) return m[1];
  } catch (e) {
    // On tente l'API ci-dessous. Falling through to the API below.
  }
  if (apiKey) {
    const data = await apiGet("channels", { part: "id", forHandle: clean }, apiKey);
    const item = data.items && data.items[0];
    if (item && item.id) return item.id;
  }
  throw new Error("channel_not_found");
}

/* ---------- Flux RSS / RSS feed ----------
   Analyse minimale du flux Atom de YouTube, sans dependance : chaque
   <entry> porte yt:videoId, title, published, et media:thumbnail. Une
   expression par champ suffit, le format etant stable depuis plus de
   dix ans.
   Minimal parsing of YouTube's Atom feed, with no dependency: each
   <entry> carries yt:videoId, title, published, and media:thumbnail.
   One expression per field is enough, the format having been stable
   for over ten years. */
function parseFeed(xml) {
  const out = [];
  const title = /<title>([^<]*)<\/title>/.exec(xml);
  const entries = String(xml).split("<entry>").slice(1);
  for (const entry of entries) {
    const id = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry);
    if (!id || !VIDEO_ID.test(id[1])) continue;
    const t = /<title>([^<]*)<\/title>/.exec(entry);
    const published = /<published>([^<]+)<\/published>/.exec(entry);
    const author = /<name>([^<]*)<\/name>/.exec(entry);
    out.push({
      id: id[1],
      title: decodeXml(t ? t[1] : ""),
      published: published ? published[1] : null,
      author: decodeXml(author ? author[1] : ""),
      // La vignette de YouTube suit un schema fixe : inutile de la
      // lire dans le flux. YouTube's thumbnail follows a fixed scheme:
      // no need to read it from the feed.
      thumbnail: "https://i.ytimg.com/vi/" + id[1] + "/mqdefault.jpg"
    });
  }
  return { title: decodeXml(title ? title[1] : ""), videos: out };
}

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

async function channelFeed(channelId) {
  const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId));
  return parseFeed(xml);
}

async function playlistFeed(playlistId) {
  const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?playlist_id=" + encodeURIComponent(playlistId));
  return parseFeed(xml);
}

/* ---------- API Data v3 (facultative) / Data API v3 (optional) ----------
   Uniquement avec la cle de l'utilisateur, lue dans le coffre chiffre
   par la route (jamais transmise au navigateur). Quota gratuit :
   10 000 unites par jour, une recherche en coute 100 -- soit une
   centaine de recherches quotidiennes, largement assez pour un usage
   domestique.
   Only with the user's key, read from the encrypted vault by the route
   (never sent to the browser). Free quota: 10,000 units a day, a search
   costs 100 -- about a hundred searches a day, plenty for home use. */
async function apiGet(endpoint, params, apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey);
  const text = await fetchText(url.toString(), { Accept: "application/json" });
  return JSON.parse(text);
}

async function search(query, apiKey, max) {
  const data = await apiGet("search", {
    part: "snippet",
    type: "video",
    q: String(query || "").slice(0, 200),
    maxResults: Math.min(25, Math.max(1, Number(max) || 12)),
    safeSearch: "moderate",
    videoEmbeddable: "true"
  }, apiKey);
  return (data.items || []).map((it) => ({
    id: it.id && it.id.videoId,
    title: it.snippet && it.snippet.title,
    author: it.snippet && it.snippet.channelTitle,
    published: it.snippet && it.snippet.publishedAt,
    thumbnail: it.id && it.id.videoId ? "https://i.ytimg.com/vi/" + it.id.videoId + "/mqdefault.jpg" : null
  })).filter((v) => v.id && VIDEO_ID.test(v.id));
}

/* ---------- Point d'entree unique / single entry point ----------
   Transforme une source (ce que l'utilisateur a colle) en une liste de
   videos pretes a jouer. Une video seule donne une liste d'un element,
   une playlist ou une chaine la liste de son flux. Le lecteur cote
   client ne connait ainsi qu'une seule forme : une file de videos.
   Turns a source (what the user pasted) into a list of videos ready to
   play. A single video yields a one-item list, a playlist or a channel
   its feed's list. The client-side player thus knows only one shape: a
   queue of videos. */
async function resolve(text, apiKey, limit) {
  const src = parseSource(text);
  if (!src) throw new Error("unrecognized");
  const cap = Math.min(15, Math.max(1, Number(limit) || 15));
  if (src.kind === "video") {
    return { kind: "video", title: "", videos: [{ id: src.id, title: "", thumbnail: "https://i.ytimg.com/vi/" + src.id + "/mqdefault.jpg" }] };
  }
  if (src.kind === "playlist") {
    const feed = await playlistFeed(src.id);
    return { kind: "playlist", id: src.id, title: feed.title, videos: feed.videos.slice(0, cap) };
  }
  const channelId = src.kind === "handle" ? await resolveHandle(src.id, apiKey) : src.id;
  const feed = await channelFeed(channelId);
  return { kind: "channel", id: channelId, title: feed.title, videos: feed.videos.slice(0, cap) };
}

/* Une file collee a la main : une adresse ou un identifiant par ligne,
   les lignes vides et les commentaires (#) ignores, les doublons
   supprimes. Meme convention que la tuile Veille reseau, pour que
   l'utilisateur n'ait qu'une habitude a prendre.
   A hand-pasted queue: one address or id per line, empty lines and
   comments (#) ignored, duplicates removed. Same convention as the
   Network watch tile, so the user has only one habit to pick up. */
function parseQueue(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text == null ? "" : text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const src = parseSource(line);
    if (!src || src.kind !== "video" || seen.has(src.id)) continue;
    seen.add(src.id);
    out.push({ id: src.id, title: "", thumbnail: "https://i.ytimg.com/vi/" + src.id + "/mqdefault.jpg" });
    if (out.length >= 50) break;
  }
  return out;
}

module.exports = { parseSource, parseFeed, parseQueue, resolve, search, resolveHandle };
