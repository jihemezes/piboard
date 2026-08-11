/* ============================================================
   PiBoard - server/cameraStream.js
   Lecture A LA DEMANDE d'un flux RTSP (camera IP / portier connecte,
   ex. Philips WelcomeEye Connect 3 -- confirme compatible ONVIF/RTSP
   par sa propre notice) : soit en direct (video), soit une simple
   image fixe (snapshot).

   Reutilise le meme principe que server/iptvAudio.js (deja en
   production pour l'IPTV) plutot que d'en inventer un nouveau :
   ffmpeg est lance PAR REQUETE HTTP, sa sortie est directement reliee
   (pipe) a la reponse, et le processus est tue des que le client se
   deconnecte (res "close"/"error"). Resultat : aucun flux ne tourne
   en arriere-plan quand personne ne regarde -- c'est la definition
   meme de "a la demande", sans minuterie ni etat a gerer cote
   serveur. La detection/le chemin de ffmpeg (server/iptvAudio.js:
   findFfmpeg) est reutilisee telle quelle : meme binaire, pas de
   raison de la re-detecter.

   Volontairement SANS AUDIO (-an) : cette tuile n'est qu'un ecran de
   controle passif, pas un intercom. Evite du meme coup toute la
   complexite de reencodage audio (G.711 tres courant sur les cameras
   IP/portiers, non lisible tel quel dans un navigateur -- voir
   server/iptvAudio.js pour le probleme equivalent cote IPTV) pour un
   flux qui n'en a de toute facon pas l'usage ici.

   Video : "copy" (simple remuxage, cout CPU quasi nul) par defaut --
   la grande majorite des cameras RTSP encodent deja en H.264, lu
   nativement par tout navigateur. Reencodage (H.265/HEVC ou autre
   codec non supporte) disponible en option par camera (voir
   manifest.json), pour les rares cas ou "copy" echoue.

   ON-DEMAND playback of an RTSP feed (IP camera / smart doorbell,
   e.g. Philips WelcomeEye Connect 3 -- confirmed ONVIF/RTSP-
   compatible by its own manual): either live (video), or a plain
   still image (snapshot).

   Reuses the same principle as server/iptvAudio.js (already in
   production for IPTV) rather than inventing a new one: ffmpeg is
   spawned PER HTTP REQUEST, its output is piped directly to the
   response, and the process is killed as soon as the client
   disconnects (res "close"/"error"). Result: no stream ever runs in
   the background when nobody's watching -- that's the very
   definition of "on demand", with no timer or server-side state to
   manage. ffmpeg detection/path (server/iptvAudio.js: findFfmpeg) is
   reused as-is: same binary, no reason to re-detect it.

   Deliberately WITHOUT AUDIO (-an): this tile is a passive monitoring
   screen, not an intercom. This also sidesteps all audio re-encoding
   complexity (G.711 is very common on IP cameras/doorbells, not
   natively playable in a browser -- see server/iptvAudio.js for the
   equivalent IPTV problem) for a stream that has no use for it here
   anyway.

   Video: "copy" (plain remux, near-zero CPU cost) by default -- the
   vast majority of RTSP cameras already encode H.264, natively played
   by any browser. Re-encoding (H.265/HEVC or another unsupported
   codec) available as a per-camera option (see manifest.json), for
   the rare cases where "copy" fails.
   ============================================================ */
"use strict";

const { spawn } = require("child_process");

/* Construit les arguments ffmpeg pour la lecture en direct -- fonction
   PURE (aucun I/O), testee isolement. Voir streamLive() plus bas pour
   le commentaire complet sur les choix (-an, TCP, timeout, "copy" vs
   reencodage).
   Builds the ffmpeg arguments for live playback -- PURE function (no
   I/O), tested in isolation. See streamLive() below for the full
   comment on the choices made (-an, TCP, timeout, "copy" vs
   re-encode). */
function buildLiveArgs(url, opts) {
  const transcode = !!(opts && opts.transcode);
  return [
    "-hide_banner", "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-timeout", "10000000",
    "-fflags", "+genpts",
    "-i", url,
    "-an",
    ...(transcode
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p"]
      : ["-c:v", "copy"]),
    "-movflags", "frag_keyframe+empty_moov+faststart",
    "-f", "mp4",
    "pipe:1"
  ];
}

/* Construit les arguments ffmpeg pour la capture d'une image. Pure,
   testee isolement -- voir grabFrame() plus bas.
   Builds the ffmpeg arguments for a single-frame capture. Pure, tested
   in isolation -- see grabFrame() below. */
function buildFrameArgs(url) {
  return [
    "-hide_banner", "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-timeout", "10000000",
    "-i", url,
    "-frames:v", "1",
    "-q:v", "3",
    "-f", "image2",
    "pipe:1"
  ];
}

/* Diffuse le flux RTSP vers la reponse HTTP en MP4 fragmente -- meme
   format, meme raison (lecture progressive sans fin via <video src>,
   sans MediaSource) que server/iptvAudio.js:streamTranscoded.

   TCP plutot qu'UDP (par defaut en RTSP) : nettement plus fiable sur
   un reseau local avec NAT/pare-feu/WiFi, evite les artefacts de
   paquets perdus. Standard pour ce cas d'usage.

   Delai de connexion borne (microsecondes) : sans lui, une camera
   injoignable (eteinte, mauvaise adresse) laisse ffmpeg bloque
   indefiniment plutot que d'echouer proprement.

   Streams the RTSP feed to the HTTP response as fragmented MP4 -- same
   format, same reason (endless progressive playback via <video src>,
   no MediaSource) as server/iptvAudio.js:streamTranscoded.

   TCP rather than UDP (RTSP's default): notably more reliable on a
   local network with NAT/firewall/WiFi, avoids lost-packet artifacts.
   Standard practice for this use case.

   Bounded connection timeout (microseconds): without it, an
   unreachable camera (powered off, wrong address) leaves ffmpeg stuck
   indefinitely instead of failing cleanly. */
function streamLive(url, res, opts, ffmpegPath) {
  const args = buildLiveArgs(url, opts);
  const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderrTail = "";
  ff.stderr.on("data", (d) => { stderrTail = (stderrTail + d.toString()).slice(-500); });
  ff.stdout.pipe(res);

  ff.on("error", (e) => {
    console.warn("[piboard] camera live ffmpeg", e.message || e);
  });
  ff.on("close", (code) => {
    if (code !== 0 && code !== null && !res.writableEnded) {
      console.warn("[piboard] camera live ffmpeg code", code, stderrTail.trim());
    }
    if (!res.writableEnded) res.end();
  });

  // Meme filet de securite que l'IPTV : le flux RTSP n'a pas de fin,
  // ffmpeg doit s'arreter des que le client (l'element <video>) se
  // deconnecte, sinon fuite de processus garantie sur le Pi.
  // Same safety net as IPTV: the RTSP feed has no end, ffmpeg must
  // stop as soon as the client (the <video> element) disconnects,
  // otherwise a guaranteed process leak on the Pi.
  const kill = () => { try { ff.kill("SIGKILL"); } catch (e) { /* noop */ } };
  res.on("close", kill);
  res.on("error", kill);

  return ff;
}

/* Capture UNE image du flux RTSP (JPEG), pour le mode "photo" de la
   tuile quand la camera n'expose pas sa propre URL d'instantane HTTP
   (voir manifest.json : ce mode-la passe directement par
   /api/image-proxy, plus leger, sans repasser par ffmpeg). Duree
   bornee : jamais de flux sans fin ici, donc pas besoin du meme filet
   de securite "res close" que streamLive -- juste un garde-fou en cas
   de camera qui ne repond jamais.
   Captures ONE frame from the RTSP feed (JPEG), for the tile's "photo"
   mode when the camera doesn't expose its own HTTP snapshot URL (see
   manifest.json: that mode goes straight through /api/image-proxy
   instead, lighter, without going through ffmpeg). Bounded duration:
   never an endless stream here, so no need for the same "res close"
   safety net as streamLive -- just a guard in case the camera never
   responds. */
function grabFrame(url, ffmpegPath) {
  return new Promise((resolve) => {
    const args = buildFrameArgs(url);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const chunks = [];
    let stderrTail = "";
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", (d) => { stderrTail = (stderrTail + d.toString()).slice(-500); });

    const timer = setTimeout(() => { try { ff.kill("SIGKILL"); } catch (e) { /* noop */ } }, 15000);

    ff.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length) {
        resolve({ ok: true, buffer: Buffer.concat(chunks) });
      } else {
        resolve({ ok: false, error: stderrTail.trim() || ("ffmpeg exit code " + code) });
      }
    });
    ff.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message || String(e) });
    });
  });
}

module.exports = { buildLiveArgs, buildFrameArgs, streamLive, grabFrame };
