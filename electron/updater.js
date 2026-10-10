/* ============================================================
   PiBoard - electron/updater.js
   Mise a jour automatique via GitHub Releases.

   FONCTIONNEMENT : electron-builder publie, a chaque version, les
   fichiers d'installation ET un fichier "latest.yml" dans la release
   GitHub correspondante. electron-updater lit ce latest.yml, compare le
   numero de version au sien (comparaison semver) et, s'il est plus
   recent, telecharge la mise a jour en arriere-plan. Le depot doit etre
   PUBLIC : un depot prive imposerait d'embarquer un jeton d'acces dans
   l'application distribuee.

   Ce mecanisme remplace entierement, dans l'application de bureau, le
   systeme d'archives ZIP deposees dans ~/updates/. Ce dernier reste le
   canal de mise a jour du Raspberry Pi en mode kiosque (serveur systemd
   + Chromium), ou Electron n'intervient pas.

   PAR PLATEFORME :
     - Windows : installeur NSIS, telecharge puis lance a la fermeture.
     - Linux : AppImage remplacee en place (aucun droit particulier) ;
       .deb reinstalle via `pkexec dpkg -i` (invite de mot de passe
       administrateur). Chaque architecture lit son propre fichier de
       version (latest-linux.yml pour x64, latest-linux-arm64.yml).
     - macOS : depuis la 1.139.3 (certificat Developer ID + notarisation,
       voir electron-builder.yml et docs/LINUX-MACOS.md), identique a
       Windows et Linux -- telechargement puis installation via
       Squirrel.Mac. Avant cette version, c'etait une mise a jour
       MANUELLE par ouverture de la page de la release : voir
       CHANGELOG.md pour l'historique de ce detour, retire ici.

   HOW IT WORKS: for each version, electron-builder publishes the
   installer files AND a "latest.yml" file in the matching GitHub
   release. electron-updater reads that latest.yml, compares its version
   number with its own (semver comparison) and, if newer, downloads the
   update in the background. The repository must be PUBLIC: a private
   one would require embedding an access token in the distributed
   application.
   The "Updates to install" setting of the general settings applies here
   too, through `allowPrerelease` (see applyChannel below): the same
   choice governs the Raspberry Pi and the desktop application.

   In the desktop application this mechanism entirely replaces the
   ZIP-archive system dropped into ~/updates/. That system remains the
   update channel of the Raspberry Pi in kiosk mode (systemd server +
   Chromium), where Electron plays no part.

   PER PLATFORM:
     - Windows: NSIS installer, downloaded then run on close.
     - Linux: AppImage replaced in place (no special rights); .deb
       reinstalled via `pkexec dpkg -i` (administrator password prompt).
       Each architecture reads its own version file (latest-linux.yml
       for x64, latest-linux-arm64.yml).
     - macOS: since 1.139.3 (Developer ID certificate + notarization,
       see electron-builder.yml and docs/LINUX-MACOS.md), identical to
       Windows and Linux -- downloaded then installed through
       Squirrel.Mac. Before that version this was a MANUAL update by
       opening the release's page: see CHANGELOG.md for the history of
       that detour, now removed.
   ============================================================ */
"use strict";

const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

/* ---------- MACOS : pourquoi ce n'etait PAS automatique avant la 1.139.3 ----------
   Historique conserve pour qui retomberait sur ce fichier en cherchant
   pourquoi macOS se comportait differemment : jusqu'a cette version,
   PiBoard n'etait pas signe par un certificat Developer ID Apple.
   L'installation d'une mise a jour par electron-updater est confiee a
   Squirrel.Mac, qui REFUSE de remplacer une application non signee.

   Le piege, constate sur la 1.100.x : ce refus n'arrivait pas au
   moment ou on l'attendrait. La verification reussissait (elle ne fait
   que lire un fichier .yml), le telechargement aussi, et paraissait
   meme tres rapide -- d'ou un "pret a etre installe" en quelques
   secondes. C'etait SEULEMENT a l'installation que Squirrel.Mac
   verifiait la signature, echouait, et ne faisait rien : l'application
   ne se fermait pas, ne se relancait pas, aucune fenetre d'erreur
   n'apparaissait. De l'exterieur, "on clique sur redemarrer et il ne
   se passe rien". PiBoard contournait donc le probleme : la nouvelle
   version etait SIGNALEE, mais le bouton ouvrait la page de la release
   dans le navigateur plutot que de declencher un telechargement voue a
   echouer silencieusement a l'installation.

   Depuis la 1.139.3 (certificat Developer ID + notarisation, voir
   electron-builder.yml), ce detour a disparu : macOS suit exactement
   le meme chemin que Windows et Linux ci-dessous.

   MACOS: why this was NOT automatic before 1.139.3. History kept for
   whoever lands on this file wondering why macOS used to behave
   differently: until that version, PiBoard was not signed with an
   Apple Developer ID certificate. Installing an update through
   electron-updater is handed to Squirrel.Mac, which REFUSES to replace
   an unsigned application.

   The trap, observed on 1.100.x: that refusal did not happen where one
   would expect. The check succeeded (it only reads a .yml file), the
   download succeeded too and even looked very fast -- hence a "ready
   to install" message within seconds. Only at INSTALL time did
   Squirrel.Mac verify the signature, fail, and do nothing: the
   application neither quit nor restarted, and no error window
   appeared. From the outside, "you click restart and nothing
   happens". PiBoard therefore worked around it: the new version was
   ANNOUNCED, but the button opened the release's page in the browser
   rather than starting a download doomed to fail silently at install
   time.

   Since 1.139.3 (Developer ID certificate + notarization, see
   electron-builder.yml) that detour is gone: macOS now follows the
   exact same path as Windows and Linux below. */
const RELEASES_URL = "https://github.com/jihemezes/piboard/releases";

function releaseUrl(version) {
  return version ? RELEASES_URL + "/tag/v" + version : RELEASES_URL;
}

/* Le telechargement est explicite plutot qu'automatique : consommer la
   bande passante de l'utilisateur sans le prevenir serait discourtois
   sur une connexion limitee, et un tableau de bord mural n'a aucune
   urgence a se mettre a jour.
   Downloading is explicit rather than automatic: consuming the user's
   bandwidth unannounced would be discourteous on a metered connection,
   and a wall dashboard has no urgency to update itself. */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/* Niveau des mises a jour, choisi dans les reglages generaux
   ("Mises a jour a installer") et partage avec le serveur : le meme
   reglage vaut pour le Raspberry Pi et pour l'application de bureau.
   `allowPrerelease` dit a electron-updater d'accepter aussi les
   releases marquees "Pre-release" sur GitHub.

   Le reglage est relu AVANT CHAQUE verification plutot que fixe au
   demarrage : le changer dans les reglages doit prendre effet sans
   redemarrer l'application. Une lecture qui echoue (fichier absent au
   tout premier lancement) retombe sur "stable" -- jamais sur les
   pre-versions par defaut.

   Update level, chosen in the general settings ("Updates to install")
   and shared with the server: the same setting applies to the Raspberry
   Pi and to the desktop application. `allowPrerelease` tells
   electron-updater to also accept releases marked "Pre-release" on
   GitHub.

   The setting is re-read BEFORE EVERY check rather than fixed at
   startup: changing it in the settings must take effect without
   restarting the application. A failed read (file absent on the very
   first launch) falls back to "stable" -- never to pre-releases by
   default. */
function applyChannel() {
  let channel = "stable";
  try {
    channel = (require("../server/store").read("settings", {}) || {}).updateChannel || "stable";
  } catch (e) {
    // Reglages illisibles : on s'en tient au canal stable.
    // Unreadable settings: we stick to the stable channel.
  }
  autoUpdater.allowPrerelease = channel === "preview";
  return autoUpdater.allowPrerelease;
}

let wired = false;
let manualCheck = false;
let getWindow = () => null;

function parentWindow() {
  const win = getWindow();
  return win && !win.isDestroyed() ? win : null;
}

function wireEvents() {
  if (wired) return;
  wired = true;

  autoUpdater.on("update-available", async (info) => {
    const win = parentWindow();
    const options = {
      type: "info",
      buttons: ["Telecharger / Download", "Plus tard / Later"],
      defaultId: 0,
      cancelId: 1,
      title: "PiBoard",
      message: `PiBoard ${info.version} est disponible / is available`,
      detail:
        `Version installee / installed version : ${app.getVersion()}\n` +
        "La mise a jour sera installee a la fermeture de l'application.\n" +
        "The update will be installed when the application closes."
    };
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    if (result.response !== 0) return;
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on("update-not-available", () => {
    // Silencieux lors de la verification automatique au demarrage : une
    // fenetre "vous etes a jour" a chaque lancement serait une nuisance.
    // On ne repond que si l'utilisateur a demande explicitement.
    // Silent during the automatic startup check: a "you are up to date"
    // dialog on every launch would be a nuisance. We only answer when
    // the user asked explicitly.
    if (!manualCheck) return;
    manualCheck = false;
    const win = parentWindow();
    const options = {
      type: "info",
      title: "PiBoard",
      message: "PiBoard est a jour / PiBoard is up to date",
      detail: `Version ${app.getVersion()}`
    };
    if (win) dialog.showMessageBox(win, options);
    else dialog.showMessageBox(options);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const win = parentWindow();
    const options = {
      type: "info",
      buttons: ["Redemarrer maintenant / Restart now", "A la prochaine fermeture / On next close"],
      defaultId: 0,
      cancelId: 1,
      title: "PiBoard",
      message: `PiBoard ${info.version} est pret a etre installe / is ready to install`,
      detail: "L'application va se fermer puis se relancer.\nThe application will close and restart."
    };
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    if (result.response !== 0) return;
    /* quitAndInstall() ne rend la main que si l'installation echoue
       AVANT la fermeture ; sous Windows et Linux elle ferme
       l'application et on ne revient jamais ici. Tout retour est donc
       un echec silencieux : on le journalise et on le dit, plutot que
       de laisser une fenetre qui ne fait rien.
       quitAndInstall() only returns if installing fails BEFORE the
       shutdown; on Windows and Linux it closes the application and we
       never come back here. Any return is therefore a silent failure:
       we log it and say so, rather than leaving a window that does
       nothing. */
    try {
      autoUpdater.quitAndInstall();
    } catch (e) {
      console.warn("[piboard] installation de la mise a jour / update install:", (e && e.message) || e);
    }
    setTimeout(() => {
      const w = parentWindow();
      const failed = {
        type: "warning",
        title: "PiBoard",
        message: "Installation impossible / Install failed",
        detail:
          "La mise a jour n'a pas pu s'installer toute seule. Telecharge la nouvelle version " +
          "depuis " + RELEASES_URL + " et installe-la par-dessus l'ancienne ; " +
          "tes tuiles et tes reglages sont conserves.\n\n" +
          "The update could not install itself. Download the new version from " +
          RELEASES_URL + " and install it over the old one; your tiles and settings are kept."
      };
      if (w) dialog.showMessageBox(w, failed);
      else dialog.showMessageBox(failed);
    }, 5000);
  });

  autoUpdater.on("error", (err) => {
    /* Une panne reseau, un depot momentanement injoignable ou une
       absence de release ne doivent JAMAIS empecher le tableau de bord
       de fonctionner : l'erreur n'est signalee que si l'utilisateur a
       explicitement demande la verification.
       A network failure, a temporarily unreachable repository or a
       missing release must NEVER prevent the dashboard from working: the
       error is only reported if the user explicitly asked to check. */
    console.warn("[piboard] mise a jour / update:", (err && err.message) || err);
    if (!manualCheck) return;
    manualCheck = false;
    const win = parentWindow();
    /* Cas tres particulier, mais desormais frequent depuis que trois
       plateformes se partagent une meme release : la release existe
       (elle a ete creee par la publication Windows, rapide) mais le
       fichier de version du systeme courant n'y est pas encore, ou pas
       du tout -- construction GitHub Actions encore en cours, ou
       echouee. electron-updater renvoie alors une erreur 404 illisible,
       accompagnee de tout l'en-tete HTTP et d'une pile d'appels, qui ne
       dit rien a l'utilisateur et l'inquiete pour rien.
       Very specific case, but frequent now that three platforms share
       one release: the release exists (created by the Windows
       publication, which is quick) but the current system's version
       file is not there yet, or not at all -- GitHub Actions build
       still running, or failed. electron-updater then returns an
       unreadable 404 error, along with the whole HTTP header and a call
       stack, which tells the user nothing and worries them for
       nothing. */
    const raw = String((err && err.message) || err);
    const missingFile = /cannot find .*\.yml/i.test(raw) || /404/.test(raw);
    if (missingFile) {
      const notYet = {
        type: "info",
        title: "PiBoard",
        message: "Mise a jour pas encore disponible / Update not available yet",
        detail:
          "Une version plus recente existe, mais le paquet pour ce systeme n'a pas encore ete " +
          "publie : sa construction prend quelques minutes de plus que celle de la version " +
          "Windows. Reessaie dans un quart d'heure. Si le message persiste, les fichiers sont " +
          "peut-etre absents de la release : " + RELEASES_URL + "\n\n" +
          "A newer version exists, but the package for this system has not been published yet: " +
          "building it takes a few minutes longer than the Windows one. Try again in fifteen " +
          "minutes. If the message persists, the files may be missing from the release: " +
          RELEASES_URL
      };
      if (win) dialog.showMessageBox(win, notYet);
      else dialog.showMessageBox(notYet);
      return;
    }

    const options = {
      type: "warning",
      title: "PiBoard",
      message: "Verification impossible / Check failed",
      detail: raw
    };
    if (win) dialog.showMessageBox(win, options);
    else dialog.showMessageBox(options);
  });
}

/* Verification differee de quelques secondes apres l'ouverture : le
   tableau de bord doit s'afficher immediatement, la mise a jour est
   secondaire.
   Check deferred a few seconds after opening: the dashboard must appear
   immediately, updating is secondary. */
const STARTUP_DELAY_MS = 8000;

function initAutoUpdate(windowGetter) {
  if (typeof windowGetter === "function") getWindow = windowGetter;

  /* En developpement (`npm run electron`), l'application n'est pas
     empaquetee : electron-updater n'a pas de fichier de version a
     comparer et signalerait une erreur a chaque lancement.
     In development (`npm run electron`), the application is not
     packaged: electron-updater has no version file to compare against
     and would report an error on every launch. */
  if (!app.isPackaged) {
    console.log("[piboard] application non empaquetee : verification des mises a jour desactivee");
    console.log("[piboard] unpackaged application: update check disabled");
    return;
  }

  wireEvents();
  setTimeout(() => {
    manualCheck = false;
    applyChannel();
    autoUpdater.checkForUpdates().catch(() => { /* signale par l'evenement error / reported by the error event */ });
  }, STARTUP_DELAY_MS);
}

function checkForUpdatesManually(win) {
  if (win) getWindow = () => win;

  if (!app.isPackaged) {
    const options = {
      type: "info",
      title: "PiBoard",
      message: "Verification indisponible en developpement / Check unavailable in development",
      detail: "Les mises a jour ne fonctionnent que sur une version installee.\n" +
        "Updates only work on an installed version."
    };
    if (win) dialog.showMessageBox(win, options);
    else dialog.showMessageBox(options);
    return;
  }

  wireEvents();
  manualCheck = true;
  applyChannel();
  autoUpdater.checkForUpdates().catch(() => { /* signale par l'evenement error / reported by the error event */ });
}

module.exports = { initAutoUpdate, checkForUpdatesManually, applyChannel };
