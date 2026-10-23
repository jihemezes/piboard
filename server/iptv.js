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

/* ---------- Erreurs Xtream classees / classified Xtream errors ----------
   Deux etats a l'ecran visuellement identiques doivent produire deux
   messages distincts (voir les lecons de PiBoard) : "identifiants
   refuses" et "serveur injoignable" n'appellent pas la meme reaction.
   Le texte vit ICI, une seule fois, en FR et EN : le serveur le renvoie
   tel quel au formulaire de reglages (bouton « Tester ») comme a la
   tuile.
   Two visually identical states must yield two distinct messages:
   "credentials refused" and "server unreachable" call for different
   reactions. The text lives HERE, once, in FR and EN. */
const XTREAM_MESSAGES = {
  "not-configured": {
    fr: "Renseignez l'adresse du serveur et l'identifiant dans les réglages de la tuile.",
    en: "Fill in the server address and username in the tile settings."
  },
  "no-password": {
    fr: "Aucun mot de passe n'est enregistré pour cette tuile. Saisissez-le dans les réglages.",
    en: "No password is stored for this tile. Enter it in the settings."
  },
  "bad-server": {
    fr: "Adresse de serveur invalide. Exemple : http://monserveur.exemple:8080",
    en: "Invalid server address. Example: http://myserver.example:8080"
  },
  "unreachable": {
    fr: "Serveur injoignable : vérifiez l'adresse, le port et la connexion réseau.",
    en: "Server unreachable: check the address, the port and the network connection."
  },
  "timeout": {
    fr: "Le serveur ne répond pas (délai dépassé).",
    en: "The server is not answering (timed out)."
  },
  "bad-credentials": {
    fr: "Identifiant ou mot de passe refusé par le serveur.",
    en: "Username or password refused by the server."
  },
  "expired": {
    fr: "L'abonnement est expiré.",
    en: "The subscription has expired."
  },
  "disabled": {
    fr: "Le compte est désactivé ou banni par le fournisseur.",
    en: "The account is disabled or banned by the provider."
  },
  "not-xtream": {
    fr: "Ce serveur ne répond pas comme un service Xtream (réponse inattendue). Vérifiez l'adresse, ou utilisez le mode playlist M3U.",
    en: "This server does not answer like an Xtream service (unexpected reply). Check the address, or use the M3U playlist mode."
  },
  "upstream": {
    fr: "Le serveur a répondu par une erreur.",
    en: "The server answered with an error."
  }
};

class XtreamError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
    this.detail = detail || "";
  }
  /* Forme envoyee au navigateur / shape sent to the browser */
  toJSON() {
    return { error: this.message, code: this.code, message: XTREAM_MESSAGES[this.code] || XTREAM_MESSAGES.upstream };
  }
}

/* Remplace les identifiants par des etoiles dans un texte destine aux
   journaux ou a un ecran de diagnostic : ffmpeg, VLC et les messages
   d'erreur recopient volontiers l'URL complete.
   Masks credentials in text meant for logs or a diagnostic screen:
   ffmpeg, VLC and error messages happily echo the full URL. */
function redactSecrets(text) {
  return String(text == null ? "" : text)
    .replace(/([?&](?:username|password|user|pass)=)[^&\s"'<>]*/gi, "$1***")
    .replace(/(\/(?:live|movie|series|timeshift)\/)([^\/\s"'<>]+)\/([^\/\s"'<>]+)(\/)/gi, "$1***/***$4");
}

/* Adresse de serveur saisie a la main -> origine propre, ou null.
   Tolere l'absence de schema, une barre finale, un chemin de panneau
   (/c/, /player_api.php...) et meme un lien get.php colle en entier.
   Hand-typed server address -> clean origin, or null. Tolerates a
   missing scheme, a trailing slash, a panel path and even a whole
   pasted get.php link. */
function normalizeXtreamServer(input) {
  let s = String(input == null ? "" : input).trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.origin;
}

/* Identifiants d'une requete de la tuile. Deux formes :
   - ANCIENNE : `url` = lien de playlist avec username= et password=
     (comportement historique, inchange) ;
   - CHAMPS : `tile` + `server` + `user`, le mot de passe venant du
     COFFRE chiffre (jamais de l'URL ni des reglages).
   `getSecret(tileId, key)` est injecte : la fonction reste pure, donc
   testable hors ligne.
   Credentials of a tile request. Two forms: the LEGACY `url` playlist
   link, and the FIELDS form where the password comes from the encrypted
   vault. `getSecret` is injected so the function stays pure. */
function resolveXtreamCreds(query, getSecret) {
  const q = query || {};
  if (q.url) {
    const c = parseXtreamCredentials(String(q.url));
    if (!c) return { error: new XtreamError("not-configured") };
    return { creds: c };
  }
  const server = normalizeXtreamServer(q.server);
  const username = String(q.user || "").trim();
  if (!q.server || !username) return { error: new XtreamError("not-configured") };
  if (!server) return { error: new XtreamError("bad-server") };
  const password = q.password != null && q.password !== ""
    ? String(q.password)
    : (getSecret ? getSecret(String(q.tile || ""), "xtreamPassword") : null);
  if (!password) return { error: new XtreamError("no-password") };
  return { creds: { server, username, password } };
}

/* Marqueur a la place du mot de passe dans une URL destinee a etre
   CONSERVEE (programmation d'enregistrement) : le fichier de donnees ne
   doit pas contenir ce que le coffre protege.
   Placeholder standing in for the password inside a URL meant to be
   STORED (scheduled recordings): the data file must not hold what the
   vault protects. */
const PASSWORD_PLACEHOLDER = "{xtream-password}";

function maskPassword(url, password) {
  if (!password) return url;
  return String(url).split("/" + password + "/").join("/" + PASSWORD_PLACEHOLDER + "/");
}

function unmaskPassword(url, password) {
  return String(url).split(PASSWORD_PLACEHOLDER).join(password);
}

async function xtreamApi(server, username, password, action, extraParams) {
  const params = new URLSearchParams(Object.assign({ username, password }, action ? { action } : {}, extraParams || {}));
  const url = server + "/player_api.php?" + params.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", "Accept": "application/json" }
    });
  } catch (e) {
    clearTimeout(timer);
    // L'URL (donc le mot de passe) ne doit jamais figurer dans le detail.
    // The URL (hence the password) must never appear in the detail.
    if (e && e.name === "AbortError") throw new XtreamError("timeout");
    throw new XtreamError("unreachable", redactSecrets(e && e.cause && e.cause.code ? e.cause.code : (e && e.message)));
  }
  try {
    if (res.status === 401 || res.status === 403) throw new XtreamError("bad-credentials", "HTTP " + res.status);
    if (res.status === 404) throw new XtreamError("not-xtream", "HTTP 404");
    if (!res.ok) throw new XtreamError("upstream", "HTTP " + res.status);
    let text;
    try { text = await res.text(); } catch (e) {
      throw new XtreamError(e && e.name === "AbortError" ? "timeout" : "unreachable");
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      // Un panneau renvoie parfois du HTML (maintenance, mauvaise
      // adresse) ou un corps vide (identifiants rejetes) la ou du JSON
      // est attendu. A panel sometimes returns HTML or an empty body
      // where JSON is expected.
      throw new XtreamError("not-xtream", "not JSON");
    }
  } finally {
    clearTimeout(timer);
  }
}

/* Etat du compte, deja interprete. Account state, already interpreted. */
function describeAccount(account) {
  const ui = account && account.user_info;
  if (!ui) throw new XtreamError("bad-credentials");
  // auth: 0 = identifiants refuses (reponse standard d'un panneau Xtream
  // qui, lui, repond 200). auth: 0 = credentials refused (a standard
  // Xtream panel still answers 200).
  if (ui.auth === 0 || ui.auth === "0") throw new XtreamError("bad-credentials");
  const status = String(ui.status || "");
  if (/^expired$/i.test(status)) throw new XtreamError("expired");
  if (/^(disabled|banned)$/i.test(status)) throw new XtreamError("disabled");
  const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  return {
    accountStatus: status || null,
    expiresAt: ui.exp_date || null,
    maxConnections: num(ui.max_connections),
    activeConnections: num(ui.active_cons),
    isTrial: ui.is_trial === "1" || ui.is_trial === 1
  };
}

/* Verifie le compte seul (bouton « Tester la connexion »).
   Checks the account alone ("Test connection" button). */
async function fetchXtreamAccount(server, username, password) {
  return describeAccount(await xtreamApi(server, username, password, "", {}));
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
  const info = describeAccount(account);
  const mapCats = (arr) => (Array.isArray(arr) ? arr : []).map((c) => ({
    id: String(c.category_id), name: c.category_name || String(c.category_id)
  }));
  return Object.assign({}, info, {
    live: mapCats(live),
    vod: mapCats(vod),
    series: mapCats(series)
  });
}

const XTREAM_ACTIONS = { live: "get_live_streams", vod: "get_vod_streams", series: "get_series" };

/* Flux d'une categorie donnee, pour l'une des 3 sources. Construit
   directement l'URL de lecture -- le widget n'a rien a assembler lui-
   meme. Avec `mask`, chaque flux porte aussi `ref` : la meme URL sans
   le mot de passe, la seule forme qu'on peut conserver sur disque.
   Streams for a given category, for one of the 3 sources. Builds the
   playback URL directly. With `mask`, each stream also carries `ref`:
   the same URL without the password, the only form that may be stored
   on disk. */
async function fetchXtreamStreams(server, username, password, kind, categoryId, mask) {
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
    const id = String(s.stream_id);
    // .ts pour le direct, pas .m3u8 : trouve par examen du code source
    // du lecteur de reference officiel (WalPlayer), qui construit
    // l'URL du flux en direct avec l'extension .ts (flux MPEG-TS brut,
    // pas un manifeste HLS). Confirme comme la vraie cause du 405
    // persistant : le fournisseur (via son proxy "PremiumProxy")
    // rejette les requetes .m3u8 sur cet endpoint, quel que soit le
    // client -- navigateur, ffmpeg, VLC, tous rejetes identiquement en
    // .m3u8, avant meme d'avoir teste .ts.
    // .ts for live, not .m3u8: found by examining the official
    // reference player's (WalPlayer) source code, which builds the
    // live stream URL with a .ts extension (raw MPEG-TS stream, not an
    // HLS manifest). Confirmed as the real cause of the persistent
    // 405: the provider (via its "PremiumProxy" proxy) rejects .m3u8
    // requests on this endpoint, regardless of client -- browser,
    // ffmpeg, VLC, all rejected identically with .m3u8, before .ts was
    // ever tried.
    const ext = kind === "vod" ? (s.container_extension || "mp4") : "ts";
    const path = kind === "live" ? "live" : "movie";
    const url = `${server}/${path}/${username}/${password}/${id}.${ext}`;
    const item = {
      id,
      name: s.name || "",
      logo: s.stream_icon || "",
      // Extension issee du panneau lui-meme (container_extension) pour
      // les films : un format que le navigateur ne sait pas lire
      // (Matroska/.mkv, tres courant en VOD) reste indique tel quel --
      // voir la mise en garde cote widget plutot que de pretendre que
      // tout sera lisible. Extension coming from the panel itself
      // (container_extension) for movies: a format the browser can't
      // read (Matroska/.mkv, very common for VOD) is still reported
      // as-is -- see the widget-side caveat rather than pretending
      // everything will play.
      containerExt: kind === "vod" ? ext : null,
      url
    };
    if (mask) item.ref = maskPassword(url, password);
    return item;
  });
}

/* Episodes d'une serie, regroupes par saison -- necessite un second
   appel dedie (get_series_info), l'API Xtream ne les livrant pas avec
   la liste des series elle-meme. Episodes of a series, grouped by
   season -- needs a second, dedicated call (get_series_info), the
   Xtream API not shipping them with the series list itself. */
async function fetchXtreamSeriesEpisodes(server, username, password, seriesId, mask) {
  const data = await xtreamApi(server, username, password, "get_series_info", { series_id: seriesId });
  const episodesBySeason = (data && data.episodes) || {};
  const seasons = Object.keys(episodesBySeason)
    .sort((a, b) => Number(a) - Number(b))
    .map((seasonNum) => ({
      season: Number(seasonNum),
      episodes: (episodesBySeason[seasonNum] || []).map((e) => {
        const ext = e.container_extension || "mp4";
        const url = `${server}/series/${username}/${password}/${e.id}.${ext}`;
        const ep = {
          id: String(e.id),
          name: e.title || ("Episode " + e.episode_num),
          ext,
          url
        };
        if (mask) ep.ref = maskPassword(url, password);
        return ep;
      })
    }));
  return { seasons, plot: (data && data.info && data.info.plot) || null };
}

module.exports.parseXtreamCredentials = parseXtreamCredentials;
module.exports.fetchXtreamCategories = fetchXtreamCategories;
module.exports.fetchXtreamStreams = fetchXtreamStreams;
module.exports.fetchXtreamSeriesEpisodes = fetchXtreamSeriesEpisodes;
module.exports.fetchXtreamAccount = fetchXtreamAccount;
module.exports.resolveXtreamCreds = resolveXtreamCreds;
module.exports.normalizeXtreamServer = normalizeXtreamServer;
module.exports.redactSecrets = redactSecrets;
module.exports.maskPassword = maskPassword;
module.exports.unmaskPassword = unmaskPassword;
module.exports.XtreamError = XtreamError;
module.exports.XTREAM_MESSAGES = XTREAM_MESSAGES;
module.exports.PASSWORD_PLACEHOLDER = PASSWORD_PLACEHOLDER;

/* Phrase de resultat du bouton « Tester la connexion ».
   Result sentence of the "Test connection" button. */
function describeTest(a, lang) {
  const en = lang === "en";
  const parts = [en ? "Connection successful." : "Connexion réussie."];
  if (a.accountStatus) parts.push((en ? "Account: " : "Compte : ") + a.accountStatus + ".");
  if (a.expiresAt && /^\d+$/.test(String(a.expiresAt))) {
    const d = new Date(Number(a.expiresAt) * 1000);
    if (!isNaN(d)) parts.push((en ? "Expires " : "Expire le ") + d.toLocaleDateString(en ? "en-GB" : "fr-FR") + ".");
  } else if (a.expiresAt == null || a.expiresAt === "") {
    parts.push(en ? "No expiry date." : "Sans date d'expiration.");
  }
  if (a.maxConnections != null) {
    const active = a.activeConnections == null ? 0 : a.activeConnections;
    parts.push((en ? "Connections: " : "Connexions : ") + active + "/" + a.maxConnections + ".");
    if (active >= a.maxConnections) {
      parts.push(en ? "Limit reached: another device may be using the subscription." : "Limite atteinte : un autre appareil utilise peut-être l'abonnement.");
    }
  }
  if (a.isTrial) parts.push(en ? "Trial account." : "Compte d'essai.");
  return parts.join(" ");
}
module.exports.describeTest = describeTest;
