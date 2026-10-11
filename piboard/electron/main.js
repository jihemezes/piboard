/* ============================================================
   PiBoard - electron/main.js
   Processus principal de l'application de bureau (Windows, Linux,
   macOS -- un seul code, trois empaquetages, voir electron-builder.yml).

   ARCHITECTURE : Electron n'est ici qu'une COQUILLE. Le tableau de bord
   reste exactement la meme application Express + navigateur que sur le
   Raspberry Pi : ce fichier demarre le serveur dans son propre
   processus, puis ouvre une fenetre pointant sur http://127.0.0.1. Rien
   dans public/ ni dans server/ ne sait qu'Electron existe -- a une
   exception pres, volontaire : le controleur enregistre plus bas, qui
   permet aux routes /api/system/* de fermer la fenetre ou de modifier
   le lancement automatique sans jamais connaitre Electron elles-memes.

   ARCHITECTURE: Electron is only a SHELL here. The dashboard remains
   exactly the same Express + browser application as on the Raspberry
   Pi: this file starts the server inside its own process, then opens a
   window pointing at http://127.0.0.1. Nothing in public/ or server/
   knows Electron exists -- with one deliberate exception: the
   controller registered below, which lets the /api/system/* routes
   close the window or change the auto-launch setting without ever
   knowing about Electron themselves.
   ============================================================ */
"use strict";

const path = require("path");
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");

/* ---------- Instance unique / single instance ----------
   Un second lancement (double-clic sur le raccourci alors que
   l'application tourne deja) ne doit pas demarrer un deuxieme serveur
   sur le meme port : on redonne simplement le focus a la fenetre
   existante.
   A second launch (double-clicking the shortcut while the application
   is already running) must not start a second server on the same port:
   we simply refocus the existing window. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

/* ---------- Emplacement des donnees / data location ----------
   DOIT etre defini AVANT le require du serveur : server/store.js lit
   PIBOARD_DATA au chargement du module. app.getPath("userData") pointe
   sur %APPDATA%\\PiBoard sous Windows -- inscriptible, propre a
   l'utilisateur, conserve lors des mises a jour ET a la desinstallation
   (choix explicite, voir deleteAppDataOnUninstall dans
   electron-builder.yml : effacer la disposition des tuiles, les cles
   API et les photos televersees sans le demander serait brutal).
   Ecrire a cote de l'executable serait impossible : Program Files
   n'est pas inscriptible.

   MUST be set BEFORE requiring the server: server/store.js reads
   PIBOARD_DATA at module load. app.getPath("userData") points to
   %APPDATA%\\PiBoard on Windows -- writable, per-user, preserved across
   updates AND uninstalls (a deliberate choice, see
   deleteAppDataOnUninstall in electron-builder.yml: wiping the tile
   layout, API keys and uploaded photos unasked would be brutal).
   Writing next to the executable would be impossible: Program Files is
   not writable. */
process.env.PIBOARD_DATA = process.env.PIBOARD_DATA || path.join(app.getPath("userData"), "data");

/* Boucle locale uniquement : la fenetre est le seul client du serveur,
   et cela evite l'invite du pare-feu Windows au premier lancement.
   Loopback only: the window is the server's only client, and this
   avoids the Windows firewall prompt on first launch. */
process.env.PIBOARD_HOST = "127.0.0.1";

/* ---------- Journal fichier / file log ----------
   L'application packagee n'a AUCUNE console visible sous Windows par
   defaut (sous-systeme graphique, sans terminal attache) : les
   console.log/warn/error du serveur (demarre dans ce meme processus
   principal, voir le require juste en dessous) partaient donc dans le
   vide, invisibles pour diagnostiquer un probleme -- par exemple les
   echecs de la tuile Cours Cryptos vers CoinGecko. Redirige (en plus
   de la console normale, utile en developpement via `npm run
   electron` lance depuis un terminal) toute la sortie vers un fichier
   texte simple, accessible sans outil de developpement : menu Aide ->
   "Ouvrir le journal", ou directement dans %APPDATA%\PiBoard\logs.
   Tronque a chaque lancement plutot que de grossir indefiniment -- ce
   n'est pas un historique, juste de quoi diagnostiquer la session en
   cours.
   The packaged app has NO visible console on Windows by default (GUI
   subsystem, no attached terminal): the server's console.log/warn/
   error (started in this same main process, see the require right
   below) used to go nowhere, invisible for diagnosing a problem --
   for instance the Crypto prices tile's failures reaching CoinGecko.
   Redirects (in addition to the normal console, useful in development
   via `npm run electron` launched from a terminal) all output to a
   plain text file, reachable without any developer tooling: Help menu
   -> "Open log", or directly in %APPDATA%\PiBoard\logs. Truncated on
   each launch rather than growing forever -- this isn't a history,
   just enough to diagnose the current session. */
const fs = require("fs");
const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_FILE = path.join(LOG_DIR, "piboard.log");
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
} catch (e) { /* dossier inaccessible : la console normale reste disponible en repli / unreachable folder: the normal console remains available as a fallback */ }

function installFileLogging() {
  let stream;
  try {
    stream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  } catch (e) {
    return; // le journal fichier est une aide en plus, pas une dependance / the file log is a bonus, not a dependency
  }
  ["log", "warn", "error"].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      try {
        const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
        stream.write(`[${new Date().toISOString()}] [${level}] ${line}\n`);
      } catch (e) { /* une ligne illisible ne doit jamais faire planter l'appli / an unloggable line must never crash the app */ }
    };
  });
}
installFileLogging();

/* Filet de securite de dernier recours. Sans auditeur, Electron affiche
   une boite modale bloquante "A JavaScript error occurred in the main
   process" -- et sur le PiBoard mural, personne n'est la pour cliquer
   sur OK : le tableau reste fige derriere le dialogue. Une exception
   emise hors pile d'appel (callback de minuterie, evenement de socket)
   n'est rattrapable NULLE PART ailleurs, d'ou ce garde-fou global.

   Ce filet ne dispense PAS de traiter l'erreur a la source : il est
   volontairement place APRES installFileLogging() pour que la trace
   complete atterrisse dans piboard.log et reste diagnosticable.

   Last-resort safety net. With no listener, Electron shows a blocking
   "A JavaScript error occurred in the main process" dialog -- and on the
   wall-mounted PiBoard nobody is there to click OK: the board stays
   frozen behind it. An exception thrown outside any call stack (timer
   callback, socket event) cannot be caught ANYWHERE else, hence this
   global guard.

   This net is NOT a substitute for handling errors at their source: it
   sits deliberately AFTER installFileLogging() so the full stack lands
   in piboard.log and stays diagnosable. */
process.on("uncaughtException", (err) => {
  console.error("[piboard] uncaughtException:", (err && err.stack) || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[piboard] unhandledRejection:", (reason && reason.stack) || reason);
});

const server = require("../server/index.js");
const platform = require("../server/platform");
const { initAutoUpdate, checkForUpdatesManually } = require("./updater");

const DEFAULT_PORT = Number(process.env.PIBOARD_PORT || 8090);
const WINDOW_STATE_KEY = "window-state";

let mainWindow = null;
let serverPort = null;

/* ---------- Position et taille de la fenetre / window state ----------
   Conservees dans le meme dossier de donnees que le reste, via le
   magasin JSON deja utilise par le serveur : pas de dependance
   supplementaire, et l'etat suit les donnees de l'utilisateur.
   Kept in the same data folder as everything else, through the JSON
   store the server already uses: no extra dependency, and the state
   follows the user's data. */
const store = require("../server/store");

function loadWindowState() {
  const saved = store.read(WINDOW_STATE_KEY, null);
  const state = { width: 1600, height: 1000, x: undefined, y: undefined, maximized: false };
  if (!saved || typeof saved !== "object") return state;
  if (Number.isFinite(saved.width) && saved.width >= 800) state.width = saved.width;
  if (Number.isFinite(saved.height) && saved.height >= 600) state.height = saved.height;
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    state.x = saved.x;
    state.y = saved.y;
  }
  state.maximized = !!saved.maximized;
  return state;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const maximized = mainWindow.isMaximized();
    // En mode agrandi, getBounds() renvoie la taille plein ecran : on
    // conserve alors les dernieres dimensions "normales" pour que la
    // restauration ne colle pas la fenetre aux bords de l'ecran.
    // When maximized, getBounds() returns the full-screen size: we then
    // keep the last "normal" dimensions so restoring does not stick the
    // window to the screen edges.
    const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    store.write(WINDOW_STATE_KEY, {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized
    });
  } catch (e) {
    // Un echec d'ecriture ne doit jamais empecher la fermeture.
    // A write failure must never prevent closing.
  }
}

/* ---------- Fenetre principale / main window ---------- */
function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 600,
    title: "PiBoard",
    backgroundColor: "#0B0E14", // evite le flash blanc au demarrage / avoids the white flash on startup
    // Windows lit le .ico ; Linux a besoin du PNG pour l'icone de la
    // fenetre et de la barre des taches (macOS n'utilise pas ce champ :
    // l'icone vient du paquet .app). L'identifiant vient de la couche
    // plateforme, seule autorisee a consulter process.platform.
    // Windows reads the .ico; Linux needs the PNG for the window and
    // taskbar icon (macOS ignores this field: the icon comes from the
    // .app bundle). The id comes from the platform layer, the only one
    // allowed to consult process.platform.
    icon: path.join(__dirname, "..", "build", platform.id === "win32" ? "icon.ico" : "icon.png"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // La fenetre ne charge que http://127.0.0.1 servi par notre propre
      // serveur, mais on garde malgre tout l'isolation par defaut : le
      // tableau de bord n'a aucun besoin d'acceder a Node.
      // The window only loads http://127.0.0.1 served by our own server,
      // yet the default isolation is kept anyway: the dashboard has no
      // need to access Node.
      nodeIntegration: false,
      contextIsolation: true,
      // Balise <webview> : necessaire a la tuile "Page web" sous
      // Windows (voir public/widgets/webview/widget.js). C'est le seul
      // moyen d'afficher un site tiers en IGNORANT son en-tete
      // X-Frame-Options / sa CSP frame-ancestors -- ce qu'une <iframe>
      // ordinaire ne peut pas faire, et qui laissait la tuile
      // desesperement blanche pour la plupart des sites. Contrairement
      // aux contournements cote serveur, le site reste ici pleinement
      // interactif et charge ses ressources normalement.
      // Desactivee par defaut depuis Electron 5 : il faut l'activer
      // explicitement. Le risque associe (une page tierce hostile
      // exploitant l'API webview) reste ici tres limite : le contenu
      // affiche est une URL saisie par l'utilisateur lui-meme dans les
      // reglages de SA tuile, et l'isolation du contexte reste active.
      // <webview> tag: needed by the "Web page" tile on Windows (see
      // public/widgets/webview/widget.js). It's the only way to display
      // a third-party site while IGNORING its X-Frame-Options header /
      // frame-ancestors CSP -- which a plain <iframe> cannot do, and
      // which left the tile hopelessly blank for most sites. Unlike the
      // server-side workarounds, the site here stays fully interactive
      // and loads its resources normally.
      // Disabled by default since Electron 5: it must be enabled
      // explicitly. The associated risk (a hostile third-party page
      // abusing the webview API) stays very limited here: the displayed
      // content is a URL the user typed themselves into THEIR OWN
      // tile's settings, and context isolation remains on.
      webviewTag: true,
      spellcheck: false
    }
  });

  if (state.maximized) mainWindow.maximize();

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

  // Affichage differe : la fenetre n'apparait qu'une fois le tableau de
  // bord rendu, jamais sur une page blanche.
  // Deferred display: the window only appears once the dashboard is
  // rendered, never on a blank page.
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("close", saveWindowState);
  mainWindow.on("closed", () => { mainWindow = null; });

  /* Tout lien externe (sources de donnees, documentation) s'ouvre dans
     le navigateur par defaut plutot que de remplacer le tableau de bord
     dans la fenetre, d'ou l'utilisateur ne pourrait plus revenir.
     Any external link (data sources, documentation) opens in the default
     browser rather than replacing the dashboard inside the window, from
     which the user could not navigate back. */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}

/* ---------- Menu / raccourcis clavier ----------
   La barre de menu est masquee (autoHideMenuBar) mais reste accessible
   par la touche Alt : c'est le seul moyen de decouvrir les raccourcis
   sans clavier physique documente. Alt+F4 (fermeture) est fourni par
   Windows lui-meme et n'a pas besoin d'etre declare ici.
   The menu bar is hidden (autoHideMenuBar) but stays reachable with the
   Alt key: that is the only way to discover the shortcuts without
   documented physical keys. Alt+F4 (close) is provided by Windows
   itself and needs no declaration here. */
function buildMenu() {
  const template = [
    {
      label: "PiBoard",
      submenu: [
        { label: "Recharger / Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
        { label: "Plein ecran / Full screen", accelerator: "F11", role: "togglefullscreen" },
        { type: "separator" },
        { label: "Zoom +", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
        { label: "Zoom -", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "Zoom 100 %", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
        { type: "separator" },
        { label: "Outils de developpement / Developer tools", accelerator: "F12", role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Ouvrir le journal / Open log",
          click: () => shell.openPath(LOG_FILE).then((err) => {
            // shell.openPath resout toujours (jamais de rejet), avec une
            // chaine d'erreur non vide en cas d'echec -- vide sinon.
            // shell.openPath always resolves (never rejects), with a
            // non-empty error string on failure -- empty otherwise.
            if (err) dialog.showErrorBox("PiBoard", "Impossible d'ouvrir le journal / Could not open the log:\n" + err);
          })
        },
        { type: "separator" },
        {
          label: "Rechercher une mise a jour / Check for updates",
          click: () => checkForUpdatesManually(mainWindow)
        },
        { type: "separator" },
        // Alt+F4 est le raccourci de fermeture de Windows et de la plupart
        // des bureaux Linux ; sur macOS c'est Cmd+Q, et Alt+F4 n'y existe
        // pas.
        // Alt+F4 is the close shortcut on Windows and most Linux
        // desktops; on macOS it is Cmd+Q, and Alt+F4 does not exist there.
        { label: "Quitter / Quit", accelerator: platform.id === "darwin" ? "Cmd+Q" : "Alt+F4", role: "quit" }
      ]
    },
    /* Menu Edition, INDISPENSABLE sous macOS : Cmd+C / Cmd+V / Cmd+X /
       Cmd+A n'y sont pas des raccourcis natifs des champs de saisie
       (comme Ctrl+C/V le sont sous Windows et Linux), mais des
       accelerateurs du menu de l'application. Sans ce menu, coller une
       cle API dans un champ des reglages ne faisait strictement rien
       sur Mac (signale sur le premier paquet macOS). Declare sur les
       trois systemes : sous Windows et Linux le menu est masque
       (autoHideMenuBar) et les raccourcis natifs marchent deja, il ne
       change donc rien -- mais un seul gabarit vaut mieux que deux.
       Edit menu, ESSENTIAL on macOS: Cmd+C / Cmd+V / Cmd+X / Cmd+A are
       not native shortcuts of input fields there (the way Ctrl+C/V are
       on Windows and Linux) but accelerators of the application menu.
       Without this menu, pasting an API key into a settings field did
       strictly nothing on a Mac (reported on the first macOS package).
       Declared on all three systems: on Windows and Linux the menu is
       hidden (autoHideMenuBar) and the native shortcuts already work,
       so it changes nothing -- but one template beats two. */
    {
      label: "Edition / Edit",
      submenu: [
        { label: "Annuler / Undo", role: "undo" },
        { label: "Retablir / Redo", role: "redo" },
        { type: "separator" },
        { label: "Couper / Cut", role: "cut" },
        { label: "Copier / Copy", role: "copy" },
        { label: "Coller / Paste", role: "paste" },
        { label: "Tout selectionner / Select all", role: "selectAll" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- Controleur remis a la couche plateforme / controller handed to the platform layer ----------
   C'est le seul point de contact entre Electron et le reste du code.
   Les routes /api/system/exit-* et /api/system/autostart appellent ces
   fonctions sans savoir ce qu'il y a derriere -- exactement comme, sur
   le Pi, elles declenchent les commandes pkill sans le savoir non plus.
   This is the only contact point between Electron and the rest of the
   code. The /api/system/exit-* and /api/system/autostart routes call
   these functions without knowing what lies behind -- exactly as, on the
   Pi, they trigger the pkill commands without knowing either. */
function registerController() {
  platform.registerKioskController({
    // "Reinitialiser le tableau de bord" / "Reset the dashboard"
    reset: () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
    },
    // "Revenir au bureau" / "Return to the desktop" : ici, quitter.
    // Sur le Pi cela revelait le bureau du Pi ; sous Windows le bureau
    // est deja la, donc l'action equivalente est de fermer.
    quit: () => {
      app.quit();
    },
    /* "Rechercher des mises a jour" depuis les reglages generaux de
       l'interface web. Le meme point d'entree que l'element de menu
       ci-dessus : sous Windows, c'est electron-updater qui gere les
       mises a jour, et le serveur n'a aucun moyen de les declencher
       lui-meme. Passer par le controleur de kiosque plutot que par un
       pont IPC dedie evite d'ouvrir un canal supplementaire entre la page
       et le processus principal, alors qu'il en existe deja un pour
       exactement ce genre d'action.
       "Check for updates" from the web interface's general settings. The
       same entry point as the menu item above: on Windows,
       electron-updater handles updates and the server has no way of
       triggering them itself. Going through the kiosk controller rather
       than a dedicated IPC bridge avoids opening one more channel
       between the page and the main process, when one already exists for
       exactly this kind of action. */
    checkUpdates: () => {
      checkForUpdatesManually(mainWindow);
      return { ok: true };
    },
    /* Affichage immersif : plein ecran veritable. Sous Windows,
       setFullScreen(true) masque d'un coup la barre de titre ET la barre
       des taches -- c'est la seule facon d'obtenir les deux, une fenetre
       simplement sans cadre (frame: false) laissant la barre des taches
       par-dessus. Le retour est toujours possible sans souris : F11 dans
       le menu, Alt+F4 pour quitter, et la barre de fenetre interne du
       tableau de bord (survol du haut de l'ecran ou touche F9).
       Immersive display: true full screen. On Windows, setFullScreen
       (true) hides the title bar AND the taskbar in one go -- the only
       way to get both, a merely frameless window (frame: false) leaving
       the taskbar on top. Going back is always possible without a mouse:
       F11 in the menu, Alt+F4 to quit, and the dashboard's in-app window
       bar (hovering the top of the screen or the F9 key). */
    setImmersive: (enabled) => {
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      const on = !!enabled;
      /* Deux pieges macOS, sans effet sous Windows (signales sur le
         premier paquet Mac : "l'affichage immersif ne fonctionne pas") :
           1. setFullScreen() y est ASYNCHRONE -- une animation de
              transition vers un nouvel espace de travail. Juste apres
              l'appel, isFullScreen() repond encore false : renvoyer cet
              etat "reel" disait a l'interface que le mode etait refuse,
              et elle ne posait jamais la classe "immersive" (donc pas de
              barre de fenetre interne, pas de retour possible sans F11).
              On renvoie donc l'etat DEMANDE, qui sera vrai dans la
              seconde ; sous Windows la transition est immediate et les
              deux etats coincident.
           2. La demande arrive souvent AVANT l'affichage de la fenetre
              (show: false jusqu'a ready-to-show, et le tableau de bord
              se rend d'abord) : macOS ignore le plein ecran d'une
              fenetre pas encore visible. On la differe alors au
              premier "show".
         Two macOS traps, harmless on Windows (reported on the first Mac
         package: "immersive display does not work"):
           1. setFullScreen() is ASYNCHRONOUS there -- a transition
              animation to a new Space. Right after the call,
              isFullScreen() still answers false: returning that "real"
              state told the interface the mode was refused, and it
              never set the "immersive" class (hence no in-app window
              bar, no way back without F11). So we return the REQUESTED
              state, true within the second; on Windows the transition
              is immediate and both states coincide.
           2. The request often arrives BEFORE the window is shown
              (show: false until ready-to-show, and the dashboard
              renders first): macOS ignores full screen on a window not
              yet visible. It is then deferred to the first "show". */
      const apply = () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(on);
      };
      if (mainWindow.isVisible()) apply();
      else mainWindow.once("show", apply);
      return on;
    },
    minimize: () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    },
    getAutoStart: () => {
      if (linuxAutostart) return linuxAutostart.get();
      return app.getLoginItemSettings().openAtLogin;
    },
    setAutoStart: (enabled) => {
      if (linuxAutostart) return linuxAutostart.set(!!enabled);
      app.setLoginItemSettings({
        openAtLogin: !!enabled,
        // Demarrage discret : la fenetre s'ouvre normalement, mais sans
        // voler le focus a ce que l'utilisateur fait au demarrage de sa
        // session. Quiet startup: the window opens normally, but without
        // stealing focus from whatever the user is doing at login.
        openAsHidden: false,
        args: []
      });
    }
  });
}

/* ---------- Lancement au demarrage sous Linux / launch at login on Linux ----------
   app.setLoginItemSettings n'est implementee que sous Windows et
   macOS : sous Linux, Electron expose bien la fonction mais elle ne
   fait RIEN (verifie sur le paquet Linux : la case restait decochee
   sans erreur). La convention Freedesktop, comprise par
   tous les bureaux vises (Pi OS/labwc, GNOME de Zorin et Ubuntu, KDE,
   XFCE...), est un fichier .desktop dans ~/.config/autostart/. La
   commande lancee est celle qui a demarre CETTE instance : le chemin de
   l'AppImage si c'en est une (variable APPIMAGE posee par le lanceur
   AppImage -- process.execPath pointerait dans son point de montage
   temporaire, invalide au prochain demarrage), sinon l'executable
   installe par le .deb.
   app.setLoginItemSettings is only implemented on Windows and macOS:
   on Linux, Electron does expose the function but it does NOTHING
   (verified on the Linux package: the checkbox stayed unchecked, no
   error). The Freedesktop convention, understood
   by every targeted desktop (Pi OS/labwc, Zorin's and Ubuntu's GNOME,
   KDE, XFCE...), is a .desktop file in ~/.config/autostart/. The
   launched command is the one that started THIS instance: the AppImage
   path if it is one (APPIMAGE variable set by the AppImage launcher --
   process.execPath would point inside its temporary mount point,
   invalid on the next boot), otherwise the executable installed by the
   .deb. */
const linuxAutostart = platform.id !== "linux" ? null : (() => {
  const dir = path.join(app.getPath("home"), ".config", "autostart");
  const file = path.join(dir, "piboard.desktop");
  const exec = process.env.APPIMAGE || process.execPath;
  return {
    get: () => fs.existsSync(file),
    set: (enabled) => {
      if (!enabled) {
        try { fs.unlinkSync(file); } catch (e) { /* deja absent / already absent */ }
        return;
      }
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, [
        "[Desktop Entry]",
        "Type=Application",
        "Name=PiBoard",
        "Comment=Tile-based kiosk dashboard / Tableau de bord kiosque a tuiles",
        // Guillemets : un chemin d'AppImage peut contenir des espaces.
        // Quotes: an AppImage path may contain spaces.
        `Exec="${exec.replace(/"/g, '\\"')}"`,
        "Icon=piboard",
        "Terminal=false",
        "X-GNOME-Autostart-enabled=true",
        ""
      ].join("\n"));
    }
  };
})();

/* ---------- Demarrage / startup ---------- */
app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  try {
    /* Le port par defaut peut etre occupe (une autre instance lancee en
       ligne de commande, un service tiers...). Plutot que d'echouer, on
       demande alors au systeme un port libre : la fenetre pointera
       dessus, personne d'autre n'ayant besoin de connaitre l'adresse.
       The default port may be busy (another instance started from the
       command line, a third-party service...). Rather than failing, we
       then ask the system for a free port: the window will point at it,
       nobody else needing to know the address. */
    let started;
    try {
      started = await server.start({ port: DEFAULT_PORT, host: "127.0.0.1" });
    } catch (e) {
      if (e && e.code === "EADDRINUSE") {
        started = await server.start({ port: 0, host: "127.0.0.1" });
      } else {
        throw e;
      }
    }
    serverPort = started.port;

    registerController();
    buildMenu();
    createWindow();
    initAutoUpdate(() => mainWindow);
  } catch (e) {
    dialog.showErrorBox(
      "PiBoard",
      "Le serveur interne n'a pas pu demarrer / The internal server failed to start:\n\n" +
        String((e && e.message) || e)
    );
    app.quit();
  }
});

/* Fermer la derniere fenetre quitte l'application, sur les trois
   systemes -- y compris macOS, ou la convention d'une application qui
   survit sans fenetre n'aurait aucun sens ici : sans fenetre, le serveur
   embarque tournerait pour personne (il n'ecoute que sur 127.0.0.1).
   Closing the last window quits the application, on all three systems
   -- macOS included, where the convention of an application surviving
   without a window would make no sense here: with no window, the
   embedded server would run for nobody (it only listens on 127.0.0.1). */
app.on("window-all-closed", () => {
  app.quit();
});
