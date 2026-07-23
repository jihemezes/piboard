/* ============================================================
   PiBoard - electron/main.js
   Processus principal de l'application de bureau Windows.

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
   l'utilisateur, conserve lors des mises a jour et supprime a la
   desinstallation. Ecrire a cote de l'executable serait impossible :
   Program Files n'est pas inscriptible.

   MUST be set BEFORE requiring the server: server/store.js reads
   PIBOARD_DATA at module load. app.getPath("userData") points to
   %APPDATA%\\PiBoard on Windows -- writable, per-user, preserved across
   updates and removed on uninstall. Writing next to the executable
   would be impossible: Program Files is not writable. */
process.env.PIBOARD_DATA = process.env.PIBOARD_DATA || path.join(app.getPath("userData"), "data");

/* Boucle locale uniquement : la fenetre est le seul client du serveur,
   et cela evite l'invite du pare-feu Windows au premier lancement.
   Loopback only: the window is the server's only client, and this
   avoids the Windows firewall prompt on first launch. */
process.env.PIBOARD_HOST = "127.0.0.1";

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
    icon: path.join(__dirname, "..", "build", "icon.ico"),
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
          label: "Rechercher une mise a jour / Check for updates",
          click: () => checkForUpdatesManually(mainWindow)
        },
        { type: "separator" },
        { label: "Quitter / Quit", accelerator: "Alt+F4", role: "quit" }
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
    getAutoStart: () => app.getLoginItemSettings().openAtLogin,
    setAutoStart: (enabled) => {
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

/* Sous Windows, fermer la derniere fenetre quitte l'application : il n'y
   a pas de convention d'application sans fenetre comme sur macOS.
   On Windows, closing the last window quits the application: there is no
   window-less application convention as on macOS. */
app.on("window-all-closed", () => {
  app.quit();
});
