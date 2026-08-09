/* ============================================================
   PiBoard - server/iptvHlsProxy.js
   Relais HLS (manifeste + segments) pour contourner le blocage CORS du
   navigateur sur les flux en direct.

   Le probleme, precisement diagnostique via la console du navigateur
   (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, puis 405 sur les segments) :
   hls.js recupere le manifeste ET chaque segment via des requetes
   JavaScript (XHR/fetch), qui sont soumises au CORS -- contrairement a
   une simple balise <video src="..."> (lecture native, un film ou une
   serie), qui n'y est PAS soumise pour la lecture elle-meme. Les
   panneaux Xtream, concus pour VLC/les box TV, n'envoient jamais d'en-
   tetes CORS : d'ou des chaines en direct qui ne demarrent jamais,
   quelle que soit la plateforme -- pas un probleme propre a Windows,
   simplement le premier a l'avoir signale avec assez de details pour
   le diagnostiquer.

   Principe (standard pour ce type de blocage, voir la doc de hls.js et
   les nombreux relais HLS existants) : le manifeste ET chaque segment
   transitent par le PiBoard, en repliant systematiquement chaque URL
   du manifeste pour qu'elle repasse par ce meme relais. Cote CPU, le
   cout est proche de zero -- aucun decodage, aucun reencodage, un
   simple relais d'octets, avec l'ajout d'un en-tete CORS permissif.
   Cote reseau, le trafic total n'augmente pas fondamentalement (le
   Pi telecharge une fois ce que le navigateur aurait telecharge de
   toute facon), seul un saut supplementaire s'ajoute.

   HLS relay (manifest + segments) to work around the browser's CORS
   block on live streams.

   The problem, precisely diagnosed via the browser console
   (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, then 405 on segments): hls.js
   fetches the manifest AND every segment via JavaScript requests
   (XHR/fetch), which are subject to CORS -- unlike a plain
   <video src="..."> tag (native playback, a movie or series), which is
   NOT subject to it for playback itself. Xtream panels, built for
   VLC/set-top boxes, never send CORS headers: hence live channels that
   never start, on any platform -- not a Windows-specific problem, just
   the first report detailed enough to diagnose it.

   Approach (standard for this kind of block, see hls.js's own docs and
   the many existing HLS relays): both the manifest AND every segment
   transit through the PiBoard, by systematically rewriting every URL
   in the manifest so it routes back through this same relay. CPU cost
   is close to zero -- no decoding, no re-encoding, a plain byte relay,
   with a permissive CORS header added. Network-wise, total traffic
   doesn't fundamentally increase (the Pi downloads once what the
   browser would have downloaded anyway), only one extra hop is added.
   ============================================================ */
"use strict";

const FETCH_TIMEOUT_MS = 15000;
// VLC/3.0.20, deja utilise avec succes pour la liste des chaines (voir
// server/iptv.js), PAS l'identifiant "PiBoard-ReaderMode" du mode
// lecture des articles RSS herite par erreur d'un copier-coller --
// sans rapport avec l'IPTV. Confirme necessaire par l'outil de
// diagnostic (server/iptvAudio.js:diagnose) : l'identifiant par
// defaut de ffmpeg se voyait rejete par ce fournisseur precis avec un
// 405, la meme famille d'erreur que celle observee ici avant ce
// correctif. VLC etant le client de reference de l'ecosysteme IPTV,
// c'est generalement le mieux accepte.
// VLC/3.0.20, already used successfully for the channel list (see
// server/iptv.js), NOT the "PiBoard-ReaderMode" identifier from the
// RSS article reader mode mistakenly inherited via copy-paste --
// unrelated to IPTV. Confirmed necessary by the diagnostic tool
// (server/iptvAudio.js:diagnose): ffmpeg's default identifier got
// rejected by this specific provider with a 405, the same error
// family observed here before this fix. VLC being the IPTV
// ecosystem's reference client, it's generally the best accepted.
const USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";

function isPlaylist(url, contentType) {
  if (contentType && /mpegurl/i.test(contentType)) return true;
  return /\.m3u8?(\?|$)/i.test(url);
}

/* Reecrit chaque URI d'un manifeste M3U8 pour qu'elle repasse par le
   relais -- couvre les lignes de segment ORDINAIRES, les sous-
   manifestes (playlists maitresses multi-debit), ET l'attribut URI="."
   des lignes #EXT-X-KEY (cle de dechiffrement AES-128), elle aussi
   soumise au CORS et sinon oubliee.
   Rewrites every URI in an M3U8 manifest so it routes back through the
   relay -- covers ORDINARY segment lines, sub-manifests (multi-bitrate
   master playlists), AND the URI="..." attribute of #EXT-X-KEY lines
   (AES-128 decryption key), itself also subject to CORS and otherwise
   overlooked. */
function rewriteM3u8(text, baseUrl, proxyBase) {
  const wrap = (raw) => proxyBase + "?url=" + encodeURIComponent(new URL(raw, baseUrl).href);

  return text.split(/\r?\n/).map((line) => {
    if (line.startsWith("#EXT-X-KEY")) {
      return line.replace(/URI="([^"]+)"/, (m, uri) => `URI="${wrap(uri)}"`);
    }
    if (line.startsWith("#") || !line.trim()) return line;
    return wrap(line.trim());
  }).join("\n");
}

/* Point d'entree unique : recupere l'URL cible cote serveur (aucune
   restriction CORS a ce niveau, c'est une regle du NAVIGATEUR), puis
   soit reecrit (manifeste), soit relaie tel quel (segment binaire) --
   dans les deux cas avec un en-tete CORS permissif, condition meme de
   l'existence de ce module.
   Single entry point: fetches the target URL server-side (no CORS
   restriction at that level, it's a BROWSER rule), then either rewrites
   (manifest) or relays as-is (binary segment) -- in both cases with a
   permissive CORS header, the very reason this module exists. */
async function handleProxyRequest(targetUrl, res) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "unsupported protocol" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT }
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      res.status(502).json({ error: "upstream status " + upstream.status });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    if (isPlaylist(parsed.href, contentType)) {
      const text = await upstream.text();
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(rewriteM3u8(text, parsed.href, "/api/iptv/hls-proxy"));
      return;
    }

    // Segment (ou cle de dechiffrement) : relais BINAIRE tel quel, sans
    // decodage texte -- un .text() ici corromprait tout contenu non-UTF8
    // (c'est justement le cas general pour un segment video).
    // Segment (or decryption key): BINARY relay as-is, no text decoding
    // -- a .text() here would corrupt any non-UTF8 content (which is
    // exactly the general case for a video segment).
    res.setHeader("Content-Type", contentType || "application/octet-stream");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e) {
    clearTimeout(timer);
    console.warn("[piboard] iptv hls-proxy echec pour", targetUrl, "->", e.message || e);
    if (!res.headersSent) res.status(502).json({ error: String(e.message || e) });
  }
}

module.exports = { handleProxyRequest, rewriteM3u8, isPlaylist };
