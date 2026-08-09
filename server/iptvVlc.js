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

function tryCandidate(cmd) {
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
function spawnRelay(url) {
  const args = [
    "--intf", "dummy",
    "-q",
    url,
    "--sout", "#std{access=file,mux=ts,dst=-}"
  ];
  return spawn(vlcPath || "cvlc", args, { stdio: ["ignore", "pipe", "pipe"] });
}

module.exports = { checkVlc, findVlc, installHint, spawnRelay };
