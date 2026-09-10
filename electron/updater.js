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
     - macOS : electron-updater EXIGE une application signee par Apple
       (Developer ID). PiBoard n'etant pas signe (voir
       electron-builder.yml), la verification echoue la-bas avec une
       erreur de signature : la mise a jour reste manuelle (retelecharger
       le DMG) tant qu'aucun certificat n'est en place. L'erreur n'est
       montree qu'a une verification manuelle, jamais au demarrage.

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
     - macOS: electron-updater REQUIRES an Apple-signed application
       (Developer ID). PiBoard being unsigned (see electron-builder.yml),
       the check fails there with a signature error: updating stays
       manual (re-download the DMG) until a certificate is in place. The
       error is only shown on a manual check, never at startup.
   ============================================================ */
"use strict";

const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const platform = require("../server/platform");

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
    if (result.response === 0) autoUpdater.downloadUpdate();
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
    if (result.response === 0) autoUpdater.quitAndInstall();
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
    // Sous macOS, l'echec attendu (application non signee, voir
    // l'en-tete) est explique plutot que laisse brut.
    // On macOS the expected failure (unsigned application, see the
    // header) is explained rather than left raw.
    const macHint = platform.id === "darwin"
      ? "\n\nSous macOS, la mise a jour automatique exige une application signee par Apple ; " +
        "PiBoard ne l'est pas encore. Telechargez la nouvelle version depuis github.com/jihemezes/piboard/releases.\n" +
        "On macOS, automatic updating requires an Apple-signed application; PiBoard is not signed yet. " +
        "Download the new version from github.com/jihemezes/piboard/releases."
      : "";
    const options = {
      type: "warning",
      title: "PiBoard",
      message: "Verification impossible / Check failed",
      detail: String((err && err.message) || err) + macHint
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
