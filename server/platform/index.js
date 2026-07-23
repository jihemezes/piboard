/* ============================================================
   PiBoard - server/platform/index.js
   Couche d'abstraction plateforme : point d'entree unique pour tout ce
   qui differe entre Raspberry Pi OS (Linux), Windows et macOS.

   RAISON D'ETRE : avant cette couche, les specificites systeme etaient
   disseminees dans server/index.js, server/networkScan.js et
   server/usbMedia.js. Chaque nouveau widget touchant au systeme aurait
   multiplie les branchements. Desormais, TOUT branchement par
   plateforme vit ici et nulle part ailleurs : les modules metier
   appellent une interface unique et ignorent sur quel systeme ils
   tournent.

   REGLE : ne jamais ecrire de test `process.platform` hors de ce
   dossier. Si un besoin nouveau apparait, on ajoute une fonction a
   l'interface ci-dessous et une implementation dans chacun des trois
   fichiers.

   Platform abstraction layer: the single entry point for everything
   that differs between Raspberry Pi OS (Linux), Windows and macOS.

   PURPOSE: before this layer, system specifics were scattered across
   server/index.js, server/networkScan.js and server/usbMedia.js. Every
   new system-touching widget would have multiplied the branches. From
   now on, EVERY per-platform branch lives here and nowhere else:
   business modules call a single interface and ignore which system they
   run on.

   RULE: never write a `process.platform` test outside this folder. If a
   new need arises, add a function to the interface below and an
   implementation in each of the three files.

   ---- Interface implementee par linux.js / win32.js / darwin.js ----
   ---- Interface implemented by linux.js / win32.js / darwin.js ----
     id                        identifiant de plateforme / platform id
     pingArgs(ip, timeoutSec)  arguments de `ping` / `ping` arguments
     pingSucceeded(err, out)   l'hote a-t-il repondu ? / did the host reply?
     parseArp(raw, allowedIps) parseur pur de la table ARP / pure ARP parser
     readArpEntries(allowed)   table ARP -> [{ip, mac}] / ARP table -> [{ip, mac}]
     reverseLookup(ip, msec)   nom d'hote via le systeme / hostname via the system
     listRemovableVolumes()    cles USB montees / mounted USB keys
     cpuTemperature()          degres Celsius ou null / degrees Celsius or null
     filesystemRoot()          racine pour l'usage disque / root for disk usage
     exitKiosk()               reinitialiser l'affichage / reset the display
     exitToDesktop()           quitter vers le bureau / quit to the desktop
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const IMPLEMENTATIONS = {
  linux: () => require("./linux"),
  win32: () => require("./win32"),
  darwin: () => require("./darwin")
};

/* Plateforme non reconnue (BSD, etc.) : on retombe sur l'implementation
   Linux, qui est la plus generique des trois. Ses fonctions echouent
   proprement (renvoi de [] ou de null) si /proc ou /media n'existent
   pas, donc l'application demarre malgre tout, avec les widgets
   systeme simplement muets.
   Unrecognized platform (BSD, etc.): fall back to the Linux
   implementation, the most generic of the three. Its functions fail
   gracefully (returning [] or null) if /proc or /media do not exist, so
   the application still starts, with the system widgets simply
   silent. */
const impl = (IMPLEMENTATIONS[process.platform] || IMPLEMENTATIONS.linux)();

/* ---------- Usage disque / disk usage ----------
   Anciennement `df -Pk /` lance via execFile. fs.statfs() (natif depuis
   Node 18.15) fournit exactement les memes informations sur les trois
   plateformes, SANS lancer de processus externe : cela supprime d'un
   coup un appel systeme, sa latence, et le probleme de la sortie de
   `df` traduite sous Windows (ou la commande n'existe d'ailleurs pas).

   Les formules reproduisent volontairement celles de `df -P` afin que
   les chiffres affiches sur le Pi restent identiques a ceux des
   versions precedentes :
     total = blocks * bsize
     utilise = (blocks - bfree) * bsize
     pourcentage = utilise / total

   Formerly `df -Pk /` run through execFile. fs.statfs() (native since
   Node 18.15) provides exactly the same information on all three
   platforms, WITHOUT spawning an external process: this removes a
   system call, its latency, and the problem of `df`'s translated output
   on Windows (where the command does not even exist).
   The formulas deliberately reproduce those of `df -P` so the figures
   shown on the Pi stay identical to previous versions. */
function diskUsage() {
  return new Promise((resolve) => {
    fs.statfs(impl.filesystemRoot(), (err, st) => {
      if (err || !st || !st.blocks || !st.bsize) return resolve(null);
      const totalBytes = st.blocks * st.bsize;
      const usedBytes = (st.blocks - st.bfree) * st.bsize;
      if (!totalBytes) return resolve(null);
      resolve({
        totalGB: totalBytes / 1073741824,
        usedGB: usedBytes / 1073741824,
        pct: (usedBytes / totalBytes) * 100
      });
    });
  });
}

/* ---------- Detection de volumes a la mode POSIX / POSIX-style volume detection ----------
   Utilisee UNIQUEMENT par les tests unitaires de server/usbMedia.js,
   qui simulent l'arborescence /media/<utilisateur>/<volume> dans un
   dossier temporaire. Elle est exposee ici plutot que dans linux.js
   pour que usbMedia.js n'ait jamais a importer une implementation de
   plateforme precise.
   Used ONLY by server/usbMedia.js's unit tests, which simulate the
   /media/<user>/<volume> tree inside a temporary folder. It is exposed
   here rather than in linux.js so usbMedia.js never has to import a
   specific platform implementation. */
function scanMountRootsPosix(roots) {
  return require("./linux").listRemovableVolumes(roots);
}

/* ---------- Controleur de kiosque / kiosk controller ----------
   Sous Windows, l'affichage n'est pas un Chromium supervise par
   lwrespawn mais une fenetre Electron : ni "reinitialiser" ni "quitter"
   ne peuvent etre realises en tuant un processus. Le processus
   principal Electron enregistre donc ici ses propres fonctions au
   demarrage, et les routes /api/system/exit-* les utilisent sans savoir
   ce qu'il y a derriere.

   Quand rien n'est enregistre (serveur lance seul par `npm start`, ou
   fonctionnement normal sur le Pi), on retombe sur l'implementation de
   la plateforme : sur le Pi ce sont bien les commandes pkill
   historiques qui s'executent, inchangees.

   On Windows the display is not a Chromium supervised by lwrespawn but
   an Electron window: neither "reset" nor "quit" can be achieved by
   killing a process. The Electron main process therefore registers its
   own functions here at startup, and the /api/system/exit-* routes use
   them without knowing what lies behind.
   When nothing is registered (server started on its own via
   `npm start`, or normal operation on the Pi), we fall back to the
   platform implementation: on the Pi the historical pkill commands do
   run, unchanged. */
let kioskController = null;

function registerKioskController(controller) {
  kioskController = controller && typeof controller === "object" ? controller : null;
}

/* L'interface web doit savoir si elle s'affiche dans l'application de
   bureau ou dans un simple navigateur : certains reglages (lancement au
   demarrage de la session) n'ont de sens que dans le premier cas et
   sont masques dans le second.
   The web interface needs to know whether it is displayed inside the
   desktop application or in a plain browser: some settings (launch at
   session startup) only make sense in the former case and are hidden in
   the latter. */
function isDesktopApp() {
  return kioskController !== null;
}

/* ---------- Lancement au demarrage de la session / launch at login ----------
   Delegue au processus principal Electron, seul a pouvoir manipuler
   l'entree de demarrage du systeme (app.setLoginItemSettings sous
   Windows). Hors application de bureau, la fonctionnalite est
   simplement declaree indisponible : sur le Pi, le demarrage automatique
   est gere par systemd et par l'autostart de labwc, pas par un reglage
   de l'interface.
   Delegated to the Electron main process, the only one able to
   manipulate the system's startup entry (app.setLoginItemSettings on
   Windows). Outside the desktop application the feature is simply
   declared unavailable: on the Pi, automatic startup is handled by
   systemd and labwc's autostart, not by a UI setting. */
function getAutoStart() {
  if (kioskController && typeof kioskController.getAutoStart === "function") {
    try {
      return { supported: true, enabled: !!kioskController.getAutoStart() };
    } catch (e) {
      return { supported: false, enabled: false, reason: String(e.message || e) };
    }
  }
  return { supported: false, enabled: false };
}

function setAutoStart(enabled) {
  if (kioskController && typeof kioskController.setAutoStart === "function") {
    try {
      kioskController.setAutoStart(!!enabled);
      return { supported: true, enabled: !!kioskController.getAutoStart() };
    } catch (e) {
      return { supported: false, enabled: false, reason: String(e.message || e) };
    }
  }
  return { supported: false, enabled: false };
}

function exitKiosk() {
  if (kioskController && typeof kioskController.reset === "function") {
    try {
      kioskController.reset();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  }
  return impl.exitKiosk();
}

function exitToDesktop() {
  if (kioskController && typeof kioskController.quit === "function") {
    try {
      kioskController.quit();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  }
  return impl.exitToDesktop();
}

module.exports = {
  id: impl.id,
  pingArgs: impl.pingArgs,
  pingSucceeded: impl.pingSucceeded,
  parseArp: impl.parseArp,
  readArpEntries: impl.readArpEntries,
  reverseLookup: impl.reverseLookup,
  listRemovableVolumes: impl.listRemovableVolumes,
  cpuTemperature: impl.cpuTemperature,
  filesystemRoot: impl.filesystemRoot,
  diskUsage,
  scanMountRootsPosix,
  registerKioskController,
  isDesktopApp,
  getAutoStart,
  setAutoStart,
  exitKiosk,
  exitToDesktop,
  // Exposees pour les tests unitaires, qui doivent pouvoir verifier les
  // trois parseurs quelle que soit la machine qui execute la suite.
  // Exposed for unit tests, which must be able to check all three
  // parsers whatever machine runs the suite.
  implementations: IMPLEMENTATIONS
};
