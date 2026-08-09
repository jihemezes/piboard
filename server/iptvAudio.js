/* ============================================================
   PiBoard - server/iptvAudio.js
   Reencodage AUDIO SEUL d'un flux IPTV, pour les cas ou le son est
   inaudible dans un navigateur.

   Le probleme : la plupart des plateformes IPTV encodent l'audio en
   AC3 ou DTS (compatibilite avec les box TV et televiseurs). AUCUN
   navigateur ne sait decoder ces formats -- c'est une restriction de
   licence, pas un oubli : on ne peut pas "ajouter un codec" a un
   navigateur, le jeu de codecs est fige a sa compilation. La video
   (H.264) se lit pourtant parfaitement.

   La solution : ffmpeg convertit UNIQUEMENT la piste audio en AAC (que
   tout navigateur lit) et RECOPIE la video telle quelle, sans la
   reencoder. C'est ce qui rend l'operation abordable : mesure sur un
   flux 720p H.264+AC3, le traitement d'environ 10 s de flux prend
   moins d'une demi-seconde -- de l'ordre de quelques pour cent d'un
   coeur en temps reel. Un reencodage video, lui, serait hors de portee
   d'un Raspberry Pi.

   Contrepartie assumee : le flux transite alors par le PiBoard, au lieu
   d'aller directement du fournisseur au navigateur. D'ou une option
   DESACTIVEE PAR DEFAUT, a n'activer que sur les flux effectivement
   muets.

   AUDIO-ONLY re-encoding of an IPTV stream, for cases where sound is
   inaudible in a browser.

   The problem: most IPTV platforms encode audio in AC3 or DTS
   (compatibility with set-top boxes and TVs). NO browser can decode
   those formats -- a licensing restriction, not an oversight: you
   can't "add a codec" to a browser, its codec set is fixed at build
   time. The video (H.264) plays perfectly well, though.

   The solution: ffmpeg converts ONLY the audio track to AAC (which
   every browser reads) and COPIES the video as-is, without re-encoding
   it. That's what makes the operation affordable: measured on a 720p
   H.264+AC3 stream, processing roughly 10 s of it takes under half a
   second -- on the order of a few percent of one core in real time. A
   video re-encode, by contrast, would be out of a Raspberry Pi's
   reach.

   Deliberate trade-off: the stream then transits through the PiBoard,
   instead of going straight from the provider to the browser. Hence an
   option DISABLED BY DEFAULT, to be turned on only for streams that
   are actually silent.
   ============================================================ */
"use strict";

const { spawn, execFile } = require("child_process");
const platform = require("./platform");

let ffmpegChecked = false;
let ffmpegPath = null;

/* Recherche de ffmpeg, une seule fois puis mise en cache. Les
   emplacements a tester sont fournis par la couche plateforme (voir
   server/platform/) : le PATH suffit presque toujours sur Linux et
   macOS, mais PAS sous Windows, ou ffmpeg n'est pas fourni par le
   systeme et se retrouve rarement dans le PATH -- d'ou une liste
   d'emplacements courants propres a chaque systeme, plutot qu'un simple
   `spawn("ffmpeg")` qui ne marchait en pratique que sur le Pi.

   La fonctionnalite est facultative : l'absence de ffmpeg ne doit pas
   empecher le reste de PiBoard de fonctionner, et doit etre signalee
   clairement -- avec la commande d'installation adaptee AU SYSTEME EN
   COURS -- plutot que de produire un echec obscur.

   Looks for ffmpeg, once, then caches the result. The locations to try
   come from the platform layer (see server/platform/): PATH almost
   always suffices on Linux and macOS, but NOT on Windows, where ffmpeg
   doesn't ship with the system and rarely ends up in PATH -- hence a
   per-system list of common locations, rather than a bare
   `spawn("ffmpeg")` that in practice only worked on the Pi.

   The feature is optional: a missing ffmpeg must not prevent the rest
   of PiBoard from working, and should be reported clearly -- with the
   install command matching THE SYSTEM IN USE -- rather than producing
   an obscure failure. */
function tryCandidate(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ["-version"], { timeout: 5000 }, (err) => resolve(!err));
  });
}

async function findFfmpeg() {
  if (ffmpegChecked) return ffmpegPath;
  for (const candidate of platform.ffmpegCandidates()) {
    if (await tryCandidate(candidate)) {
      ffmpegPath = candidate;
      break;
    }
  }
  ffmpegChecked = true;
  if (!ffmpegPath) {
    console.warn("[piboard] ffmpeg introuvable : le reencodage audio des flux IPTV sera indisponible. Installation :",
      platform.ffmpegInstallHint().fr);
  }
  return ffmpegPath;
}

/* Compatibilite : renvoie un booleen, comme avant.
   Compatibility: returns a boolean, as before. */
async function checkFfmpeg() {
  return !!(await findFfmpeg());
}

/* Conseil d'installation adapte au systeme, pour l'afficher cote
   interface plutot que de laisser l'utilisateur chercher.
   System-appropriate install hint, so it can be shown in the interface
   rather than leaving the user to search. */
function installHint() {
  return platform.ffmpegInstallHint();
}

/* Diffuse le flux distant vers la reponse HTTP en MP4 fragmente (le
   seul format qu'un navigateur accepte de lire "au fil de l'eau" depuis
   un flux HTTP continu, sans index prealable -- impossible pour du
   direct). Deux modes :

   - "audio" (par defaut) : SEULE la piste audio est reencodee en AAC,
     la video est RECOPIEE sans reencodage -- l'operation reste tres
     legere (quelques % d'un coeur, mesure). Corrige un son inaudible
     (AC3/DTS, tres courant en IPTV).

   - "full" : vidéo ET audio sont reencodees. Beaucoup plus lourd
     (reencodage video reel, pas une simple recopie), mais contourne
     ENTIEREMENT hls.js/MediaSource cote navigateur -- utile quand le
     probleme n'est pas seulement l'audio, mais un flux qu'AUCUN
     diagnostic cote navigateur n'arrive a expliquer precisement
     (rapporte : "NotSupportedError: The element has no supported
     sources" persistant malgre plusieurs verifications de codec
     n'ayant rien trouve d'anormal a signaler). ffmpeg decode ce qui se
     presente et reencode vers un format standard garanti, quelle que
     soit la cause exacte cote source.

   Streams the remote feed to the HTTP response as fragmented MP4 (the
   only format a browser will read progressively from a continuous HTTP
   stream, without an upfront index -- impossible for live). Two modes:

   - "audio" (default): ONLY the audio track is re-encoded to AAC, video
     is COPIED without re-encoding -- stays very light (a few % of one
     core, measured). Fixes inaudible sound (AC3/DTS, very common in
     IPTV).

   - "full": BOTH video and audio are re-encoded. Much heavier (a real
     video re-encode, not a plain copy), but ENTIRELY bypasses
     hls.js/MediaSource on the browser side -- useful when the problem
     isn't just audio, but a stream that NO browser-side diagnostic
     manages to precisely explain (reported: persistent "NotSupportedError:
     The element has no supported sources" despite several codec checks
     finding nothing wrong to flag). ffmpeg decodes whatever's presented
     and re-encodes to a guaranteed standard format, regardless of the
     exact cause on the source side. */
function streamTranscoded(url, res, onError, mode) {
  const fullTranscode = mode === "full";
  const args = [
    "-hide_banner", "-loglevel", "error",
    // Reconnexion automatique : un flux IPTV coupe reguliererement, sans
    // que ce soit une vraie panne. Automatic reconnection: an IPTV feed
    // drops regularly, without that being a genuine failure.
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
    // -fflags +genpts (option d'ENTREE, avant -i) regenere des
    // horodatages de presentation propres des la lecture du flux
    // source. -avoid_negative_ts (option de SORTIE, placee apres -i
    // ci-dessous) normalise ensuite ceux-ci a zero au moment du
    // remuxage -- necessaire specifiquement pour un flux EN DIRECT,
    // contrairement a un fichier VOD fini qui demarre proprement a
    // zero. Un flux IPTV en continu injecte souvent des horodatages
    // enormes ou negatifs (bascule d'horloge du fournisseur, flux deja
    // en cours depuis des heures) -- documente dans plusieurs rapports
    // de bogue independants comme cause de lecture en echec cote
    // navigateur, alors meme que le fichier produit reste
    // structurellement valide (ce qui correspond exactement au cas
    // observe : requete reussie, mais lecture refusee). Signale par :
    // le meme pipeline fonctionne parfaitement pour les films/series
    // (VOD, horodatages propres), seul le direct est en cause.
    // -fflags +genpts (an INPUT option, before -i) regenerates clean
    // presentation timestamps as the source stream is read.
    // -avoid_negative_ts (an OUTPUT option, placed after -i below) then
    // normalizes those to zero at remux time -- needed specifically for
    // a LIVE stream, unlike a finite VOD file that starts cleanly at
    // zero. A continuous IPTV feed often injects huge or negative
    // timestamps (the provider's own clock, a stream already running
    // for hours) -- documented in several independent bug reports as a
    // cause of browser-side playback failure, even while the produced
    // file stays structurally valid (matching exactly what was
    // observed: request succeeds, but playback refused). Reported: the
    // same pipeline works perfectly for movies/series (VOD, clean
    // timestamps), only live is affected.
    "-fflags", "+genpts",
    // Identification honnete en User-Agent, alignee sur celle deja
    // utilisee avec succes pour la liste des chaines (voir
    // server/iptv.js) : ffmpeg envoie par defaut "Lavf/X.Y.Z" (sa
    // propre version de bibliotheque), que ce fournisseur IPTV precis
    // rejette avec un 405 -- confirme par l'outil de diagnostic
    // (server/iptvAudio.js:diagnose). VLC etant le client de reference
    // de l'ecosysteme IPTV, c'est generalement le mieux accepte.
    // Honest identification via User-Agent, matching the one already
    // used successfully for the channel list (see server/iptv.js):
    // ffmpeg sends "Lavf/X.Y.Z" (its own library version) by default,
    // which this specific IPTV provider rejects with a 405 -- confirmed
    // by the diagnostic tool (server/iptvAudio.js:diagnose). VLC being
    // the IPTV ecosystem's reference client, it's generally the best
    // accepted.
    "-user_agent", "VLC/3.0.20 LibVLC/3.0.20",
    "-i", url,
    "-avoid_negative_ts", "make_zero",
    ...(fullTranscode
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"]
      : ["-c:v", "copy"]), // video INTACTE en mode audio seul : c'est ce qui le rend leger / video UNTOUCHED in audio-only mode: what keeps it light
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    // default_base_moof (pense pour une consommation via MediaSource/
    // appendBuffer, comme le fait hls.js) retire au profit de faststart :
    // ce flux est lu ici en <video src> progressif direct, pas via MSE --
    // un exemple fonctionnel documente pour exactement ce cas d'usage
    // (lecture progressive d'un MP4 fragmente en direct, sans fin)
    // utilise cette combinaison precise.
    // default_base_moof (meant for consumption via MediaSource/
    // appendBuffer, as hls.js does) removed in favor of faststart: this
    // stream is read here via direct progressive <video src>, not MSE --
    // a documented working example for exactly this use case (progressive
    // playback of a live, endless fragmented MP4) uses this exact
    // combination.
    "-movflags", "frag_keyframe+empty_moov+faststart",
    "-f", "mp4",
    "pipe:1"
  ];

  const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderrTail = "";
  ff.stderr.on("data", (d) => {
    stderrTail = (stderrTail + d.toString()).slice(-500);
  });
  ff.stdout.pipe(res);

  ff.on("error", (e) => {
    console.warn("[piboard] iptv-audio ffmpeg", e.message || e);
    if (onError) onError(e);
  });
  ff.on("close", (code) => {
    // Code 0 ou arret provoque par la fermeture du client : normal.
    // Sinon, on journalise la fin de la sortie d'erreur de ffmpeg, seule
    // trace exploitable pour diagnostiquer. Exit code 0, or a shutdown
    // caused by the client disconnecting: normal. Otherwise, log the
    // tail of ffmpeg's error output, the only usable trace for
    // diagnosis.
    if (code !== 0 && code !== null && !res.writableEnded) {
      console.warn("[piboard] iptv-audio ffmpeg code", code, stderrTail.trim());
    }
    if (!res.writableEnded) res.end();
  });

  // Arret immediat de ffmpeg des que le client se deconnecte : sans ca,
  // un processus continuerait a transcoder dans le vide, un flux en
  // direct n'ayant pas de fin -- fuite garantie sur un Pi.
  // Stops ffmpeg immediately once the client disconnects: without this,
  // a process would keep transcoding into the void, a live stream having
  // no end -- a guaranteed leak on a Pi.
  const kill = () => { try { ff.kill("SIGKILL"); } catch (e) { /* noop */ } };
  res.on("close", kill);
  res.on("error", kill);

  return ff;
}

/* Diagnostic : lance exactement le meme pipeline que streamTranscoded,
   mais pour une duree BORNEE (pas de flux sans fin vers le navigateur),
   et rapporte precisement ce qui s'est passe -- octets produits, code
   de sortie de ffmpeg, et surtout sa sortie d'erreur complete. Pense
   pour etre consulte directement depuis un navigateur (simple URL),
   sans avoir besoin d'acceder a la console/au journal du serveur --
   un obstacle reel pour une application installee sous Windows.
   Diagnostic: runs the exact same pipeline as streamTranscoded, but for
   a BOUNDED duration (no endless stream sent to the browser), and
   reports precisely what happened -- bytes produced, ffmpeg's exit
   code, and above all its full error output. Meant to be viewed
   directly from a browser (a plain URL), without needing access to the
   server's console/log -- a real obstacle for an installed Windows
   application. */
function diagnose(url, mode) {
  return new Promise((resolve) => {
    const fullTranscode = mode === "full";
    const args = [
      "-hide_banner", "-loglevel", "info",
      "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
      "-fflags", "+genpts",
      "-user_agent", "VLC/3.0.20 LibVLC/3.0.20",
      "-i", url,
      "-avoid_negative_ts", "make_zero",
      "-t", "8", // diagnostic borne a 8s de flux source, jamais envoye au navigateur / diagnostic bounded to 8s of source stream, never sent to the browser
      ...(fullTranscode
        ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"]
        : ["-c:v", "copy"]),
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "frag_keyframe+empty_moov+faststart",
      "-f", "mp4",
      "pipe:1"
    ];

    const startedAt = Date.now();
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let bytesOut = 0;
    let firstByteMs = null;
    let stderr = "";

    ff.stdout.on("data", (d) => {
      bytesOut += d.length;
      if (firstByteMs === null) firstByteMs = Date.now() - startedAt;
    });
    ff.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => { try { ff.kill("SIGKILL"); } catch (e) { /* noop */ } }, 15000);

    ff.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        bytesProduced: bytesOut,
        firstByteAfterMs: firstByteMs,
        totalDurationMs: Date.now() - startedAt,
        ffmpegStderr: stderr.slice(-4000) // les dernieres lignes suffisent generalement / the last lines are usually enough
      });
    });
    ff.on("error", (e) => {
      clearTimeout(timer);
      resolve({ spawnError: e.message || String(e) });
    });
  });
}

module.exports = { checkFfmpeg, findFfmpeg, installHint, streamTranscoded, diagnose };
