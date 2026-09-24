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
     - macOS : mise a jour MANUELLE, par ouverture de la page de la
       release dans le navigateur. Voir le bloc MACOS ci-dessous.

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
     - macOS: MANUAL update, by opening the release's page in the
       browser. See the MACOS block below.
   ============================================================ */
"use strict";

const { app, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const platform = require("../server/platform");

/* ---------- MACOS : pourquoi la mise a jour n'est pas automatique ----------
   Sous macOS, l'installation d'une mise a jour par electron-updater est
   confiee a Squirrel.Mac, qui REFUSE une application non signee par
   Apple (certificat Developer ID). PiBoard ne l'est pas.

   Le piege, constate sur la 1.100.x : ce refus n'arrive pas au moment
   ou on le croirait. La verification reussit (elle ne fait que lire un
   fichier .yml), le telechargement reussit aussi et parait meme tres
   rapide -- d'ou le message "pret a etre installe" en quelques
   secondes. C'est SEULEMENT a l'installation que Squirrel.Mac verifie
   la signature, echoue, et ne fait rien : l'application ne se ferme
   pas, ne se relance pas, aucune fenetre d'erreur n'apparait. De
   l'exterieur, "on clique sur redemarrer et il ne se passe rien".

   Plutot que de laisser l'utilisateur dans cette impasse, la nouvelle
   version est SIGNALEE sous macOS, mais le bouton ouvre la page de la
   release dans le navigateur : le DMG se telecharge et s'installe a la
   main, par-dessus l'ancienne application, en conservant les donnees.
   Aucun telechargement n'est declenche dans l'application, aucun
   redemarrage n'est propose.

   Le jour ou un certificat Developer ID sera en place (voir
   electron-builder.yml et docs/LINUX-MACOS.md), il suffira de
   supprimer ce detournement : le chemin normal fonctionnera.

   MACOS: why updating is not automatic. There, installing an update is
   handed to Squirrel.Mac, which REFUSES an application not signed by
   Apple (Developer ID certificate). PiBoard is not signed.

   The trap, observed on 1.100.x: that refusal does not happen where one
   would expect. The check succeeds (it only reads a .yml file), the
   download succeeds too and even looks very fast -- hence the "ready to
   install" message within seconds. Only at INSTALL time does
   Squirrel.Mac verify the signature, fail, and do nothing: the
   application neither quits nor restarts, and no error window appears.
   From the outside, "you click restart and nothing happens".

   Rather than leaving the user in that dead end, the new version is
   ANNOUNCED on macOS, but the button opens the release's page in the
   browser: the DMG is downloaded and installed by hand, over the old
   application, keeping the data. No download is started inside the
   application, no restart is offered.

   Once a Developer ID certificate is in place (see electron-builder.yml
   and docs/LINUX-MACOS.md), removing this detour is enough: the normal
   path will work. */
const MANUAL_UPDATE_ON_MAC = platform.id === "darwin";
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
    const options = MANUAL_UPDATE_ON_MAC
      ? {
          type: "info",
          buttons: ["Ouvrir la page / Open the page", "Plus tard / Later"],
          defaultId: 0,
          cancelId: 1,
          title: "PiBoard",
          message: `PiBoard ${info.version} est disponible / is available`,
          detail:
            `Version installee / installed version : ${app.getVersion()}\n\n` +
            "Sous macOS, l'installation se fait a la main : la page de la version va s'ouvrir " +
            "dans le navigateur. Telecharge le fichier .dmg correspondant a ton Mac " +
            "(arm64 pour Apple Silicon, x64 pour Intel), ouvre-le et glisse PiBoard dans " +
            "Applications par-dessus l'ancienne version. Tes tuiles et tes reglages sont conserves.\n\n" +
            /* Le rappel qui manquait (1.121.0). La copie qu'on vient de
               telecharger porte a son tour l'attribut de quarantaine :
               elle rouvrira donc sur « PiBoard est endommage », alors
               meme que la version precedente fonctionnait. Sans cette
               ligne, chaque mise a jour ramene le probleme du premier
               lancement, et rien a l'ecran ne fait le lien.
               The reminder that was missing (1.121.0): the freshly
               downloaded copy carries the quarantine attribute in its
               turn, so it reopens on "PiBoard is damaged" even though
               the previous version worked. */
            "Ensuite, relance cette commande une fois dans le Terminal, sans quoi macOS refusera " +
            "d'ouvrir la nouvelle copie en la disant « endommagee » (elle ne l'est pas : PiBoard " +
            "n'est pas notarise par Apple, faute de compte developpeur payant) :\n" +
            "    xattr -dr com.apple.quarantine /Applications/PiBoard.app\n\n" +
            "On macOS the installation is manual: the version's page will open in the browser. " +
            "Download the .dmg matching your Mac (arm64 for Apple Silicon, x64 for Intel), open it " +
            "and drag PiBoard into Applications over the old version. Your tiles and settings are kept.\n" +
            "Then run this command once in Terminal, or macOS will refuse to open the new copy, " +
            "calling it \"damaged\" (it is not: PiBoard is not notarized by Apple, for want of a " +
            "paid developer account):\n" +
            "    xattr -dr com.apple.quarantine /Applications/PiBoard.app"
        }
      : {
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
    if (MANUAL_UPDATE_ON_MAC) shell.openExternal(releaseUrl(info.version));
    else autoUpdater.downloadUpdate();
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
      /* Sur Mac, on profite du seul moment calme -- celui ou il n'y a
         rien a installer -- pour dire que la mise a jour y est manuelle.
         L'apprendre le jour ou une version sort, au milieu d'une
         manipulation, est la plus mauvaise facon de le decouvrir.
         On a Mac we use the one calm moment -- nothing to install -- to
         say that updating is manual there. Learning it on the day a
         release lands is the worst way to find out. */
      detail: `Version ${app.getVersion()}` + (MANUAL_UPDATE_ON_MAC
        ? "\n\nSous macOS, PiBoard ne se met pas a jour tout seul : il previent quand une version " +
          "existe et ouvre sa page, l'installation restant manuelle. C'est la contrepartie d'une " +
          "application non notarisee par Apple, ce qui suppose un compte developpeur payant.\n\n" +
          "On macOS, PiBoard does not update itself: it announces a new version and opens its page, " +
          "the installation staying manual. That is the price of an application not notarized by " +
          "Apple, which requires a paid developer account."
        : "")
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
    // Sous macOS, l'echec attendu (application non signee, voir
    // l'en-tete) est explique plutot que laisse brut.
    // On macOS the expected failure (unsigned application, see the
    // header) is explained rather than left raw.
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

    const macHint = MANUAL_UPDATE_ON_MAC
      ? "\n\nSous macOS, la mise a jour automatique exige une application signee par Apple ; " +
        "PiBoard ne l'est pas encore. Telechargez la nouvelle version depuis " + RELEASES_URL + ".\n" +
        "On macOS, automatic updating requires an Apple-signed application; PiBoard is not signed yet. " +
        "Download the new version from " + RELEASES_URL + "."
      : "";
    const options = {
      type: "warning",
      title: "PiBoard",
      message: "Verification impossible / Check failed",
      detail: raw + macHint
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
