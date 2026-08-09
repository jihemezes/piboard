/* ============================================================
   PiBoard - server/iptvVlc.js
   Relais VLC pour les chaines IPTV en direct qu'un fournisseur rejette
   face a ffmpeg seul (405 Method Not Allowed, confirme par l'outil de
   diagnostic).

   Origine du constat : examen statique du lecteur IPTV officiel de
   reference (application Electron, comme PiBoard). Son code source
   revele qu'il n'utilise PAS le pipeline video du navigateur pour le
   direct -- il embarque le vrai moteur natif de VLC (libVLC, via
   WebChimera.js) et lui delegue entierement la reception du flux.
   Aucun en-tete HTTP particulier ni astuce visible dans son code : le
   succes vient vraisemblablement de differences d'implementation HTTP
   bas niveau entre libVLC et ffmpeg (negociation, reconnexion), pas
   d'un simple reglage qu'on pourrait copier dans ffmpeg.

   Integrer directement WebChimera.js (module natif precompile pour une
   version precise d'Electron) aurait ete un chantier bien plus lourd
   que d'utiliser VLC comme un PROCESSUS SEPARE -- exactement le meme
   principe deja utilise pour ffmpeg dans ce projet. VLC relaie le flux
   BRUT (aucun reencodage, juste sa reception -- c'est le pipeline HTTP
   de VLC qui est necessaire, pas ses capacites de transcodage) vers sa
   sortie standard, qui est ensuite CHAINEE vers ffmpeg (voir
   server/iptvAudio.js) pour le reencodage audio/video final -- reutilise
   telle quelle la logique de muxage MP4 fragmente deja eprouvee.

   VLC relay for live IPTV channels a provider rejects when faced with
   ffmpeg alone (405 Method Not Allowed, confirmed by the diagnostic
   tool).

   Origin of the finding: static examination of the official reference
   IPTV player (an Electron app, like PiBoard). Its source code reveals
   it does NOT use the browser's video pipeline for live -- it embeds
   VLC's actual native engine (libVLC, via WebChimera.js) and hands it
   the stream entirely. No particular HTTP header or trick visible in
   its code: the success is most likely due to low-level HTTP
   implementation differences between libVLC and ffmpeg (negotiation,
   reconnection), not a simple setting that could be copied into ffmpeg.

   Integrating WebChimera.js directly (a native module prebuilt for a
   precise Electron version) would have been a much heavier undertaking
   than using VLC as a SEPARATE PROCESS -- the exact same principle
   already used for ffmpeg in this project. VLC relays the RAW stream
   (no re-encoding at all -- it's VLC's HTTP pipeline that's needed, not
   its transcoding abilities) to its standard output, which is then
   CHAINED into ffmpeg (see server/iptvAudio.js) for the final
   audio/video re-encoding -- reuses the already-proven fragmented MP4
   muxing logic as-is.
   ============================================================ */
"use strict";

const { spawn, execFile } = require("child_process");
const platform = require("./platform");

let vlcChecked = false;
let vlcPath = null;

const fs = require("fs");

/* Pour un CHEMIN ABSOLU (emplacements d'installation connus, la
   majorite des candidats -- voir server/platform/*.js), simple
   verification d'EXISTENCE DU FICHIER : aucun risque d'execution
   bloquante. Important specifiquement pour VLC : contrairement a
   ffmpeg (dont "-version" affiche du texte et se termine de facon
   fiable, verifie), rien ne garantit que vlc.exe se comporte pareil
   avec "--version" sous Windows -- une eventuelle tentative
   d'ouverture d'interface graphique ferait echouer la verification a
   tort (delai d'expiration), meme quand VLC est bel et bien installe.
   Seuls les noms nus (ex. "cvlc", "vlc.exe", qui dependent du PATH)
   sont encore verifies en les executant, seule methode possible dans
   ce cas -- mais ils arrivent apres les chemins absolus dans les
   listes de candidats, qui couvrent deja le cas le plus courant
   (installation standard).
   For an ABSOLUTE PATH (known install locations, the majority of
   candidates -- see server/platform/*.js), a simple FILE EXISTENCE
   check: no risk of a blocking execution. Important specifically for
   VLC: unlike ffmpeg (whose "-version" reliably prints text and exits,
   verified), nothing guarantees vlc.exe behaves the same with
   "--version" on Windows -- a possible attempt to open a graphical
   interface would make the check wrongly fail (timeout), even when VLC
   is genuinely installed. Only bare names (e.g. "cvlc", "vlc.exe",
   which depend on PATH) are still checked by executing them, the only
   method possible in that case -- but they come after absolute paths in
   the candidate lists, which already cover the most common case (a
   standard install). */
function tryCandidate(cmd) {
  if (/[\\/]/.test(cmd)) {
    return Promise.resolve(fs.existsSync(cmd));
  }
  return new Promise((resolve) => {
    execFile(cmd, ["--version"], { timeout: 5000 }, (err) => resolve(!err));
  });
}

/* Meme logique de recherche que findFfmpeg() dans server/iptvAudio.js :
   emplacements fournis par la couche plateforme, mis en cache apres la
   premiere recherche reussie ou echouee.
   Same lookup logic as findFfmpeg() in server/iptvAudio.js: locations
   provided by the platform layer, cached after the first successful or
   failed search. */
async function findVlc() {
  if (vlcChecked) return vlcPath;
  for (const candidate of platform.vlcCandidates()) {
    if (await tryCandidate(candidate)) {
      vlcPath = candidate;
      break;
    }
  }
  vlcChecked = true;
  if (!vlcPath) {
    console.warn("[piboard] VLC introuvable : le relais des chaines en direct recalcitrantes restera indisponible. Installation :",
      platform.vlcInstallHint().fr);
  }
  return vlcPath;
}

async function checkVlc() {
  return !!(await findVlc());
}

function installHint() {
  return platform.vlcInstallHint();
}

/* Lance VLC en relais pur (aucun reencodage) de l'URL fournie vers sa
   sortie standard, prete a etre chainee vers ffmpeg. --intf dummy est
   TOUJOURS passe explicitement ici, plutot que de compter sur le
   comportement implicite d'un eventuel binaire "cvlc" (qui n'existe
   que sous Linux -- voir server/platform/win32.js et darwin.js) :
   fonctionne ainsi identiquement quel que soit le systeme. La syntaxe
   "dst=-" (sortie standard) est portable entre Windows/macOS/Linux,
   contrairement a "/dev/stdout" qui n'existe pas sous Windows --
   verifie directement.
   Launches VLC in pure relay mode (no re-encoding at all) of the given
   URL to its standard output, ready to be chained into ffmpeg.
   --intf dummy is ALWAYS passed explicitly here, rather than relying on
   an eventual "cvlc" binary's implicit behavior (which only exists on
   Linux -- see server/platform/win32.js and darwin.js): works
   identically regardless of the system this way. The "dst=-" syntax
   (standard output) is portable across Windows/macOS/Linux, unlike
   "/dev/stdout" which doesn't exist on Windows -- verified directly. */
/* VLC transcode LUI-MEME (video H.264 + audio AAC, sortie MPEG-TS) au
   lieu d'un simple relais brut vers ffmpeg : signale par l'utilisateur,
   le relais brut laissait ffmpeg bloque sans jamais recevoir de
   donnees (0 octet, aucune erreur -- symptome distinct du 405
   original, jamais totalement explique). Plutot que de chercher
   pourquoi le tube VLC->ffmpeg restait silencieux, VLC fait
   desormais TOUT le travail difficile lui-meme (recuperation ET
   conversion), elimine ffmpeg comme intermediaire potentiellement en
   cause. vcodec=copy (repli video sans reencodage, comme pour ffmpeg)
   NE FONCTIONNE PAS dans le module de transcodage de VLC ("cannot
   find video encoder fourcc:copy", verifie directement) : la video
   est donc TOUJOURS reencodee ici, plus couteux qu'une simple recopie
   mais fiable, confirme par test direct.
   VLC transcodes IT SELF (H.264 video + AAC audio, MPEG-TS output)
   instead of a plain raw relay into ffmpeg: reported by the user, the
   raw relay left ffmpeg hanging without ever receiving data (0 bytes,
   no error -- a symptom distinct from the original 405, never fully
   explained). Rather than chasing why the VLC->ffmpeg pipe stayed
   silent, VLC now does ALL the hard work itself (fetching AND
   converting), removing ffmpeg as a potentially-at-fault middleman.
   vcodec=copy (a video passthrough without re-encoding, like ffmpeg's)
   does NOT work in VLC's transcode module ("cannot find video encoder
   fourcc:copy", verified directly): video is therefore ALWAYS
   re-encoded here, costlier than a plain copy but reliable, confirmed
   by direct testing. */
function spawnTranscode(url) {
  const args = [
    "--intf", "dummy",
    // -vv : sans cette verbosite, VLC reste quasi muet sur son niveau
    // de log par defaut, meme en cas d'echec de connexion -- confirme
    // par un rapport de diagnostic a la sortie d'erreur totalement
    // vide malgre un echec reel (15s sans le moindre octet produit).
    // -vv: without this verbosity, VLC stays nearly silent at its
    // default log level, even on a connection failure -- confirmed by
    // a diagnostic report with completely empty error output despite a
    // genuine failure (15s with not a single byte produced).
    "-vv",
    url,
    "--sout", "#transcode{vcodec=h264,venc=x264{preset=veryfast},acodec=mp4a,ab=128,channels=2}:std{access=file,mux=ts,dst=-}"
  ];
  return spawn(vlcPath || "cvlc", args, {
    stdio: ["ignore", "pipe", "pipe"],
    // Meme correctif que pour ffmpeg (voir server/iptvAudio.js) :
    // sans ceci, Windows affiche une fenetre de console visible pour
    // ce processus, signale par l'utilisateur.
    // Same fix as for ffmpeg (see server/iptvAudio.js): without this,
    // Windows shows a visible console window for this process,
    // reported by the user.
    windowsHide: true
  });
}

module.exports = { checkVlc, findVlc, installHint, spawnTranscode, tryCandidate };
