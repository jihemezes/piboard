/* PiBoard - icone « PiBoard » du bureau Linux (1.180.0)
   ---------------------------------------------------
   Sur un Raspberry Pi (ou un PC Linux) avec bureau, le serveur cree au
   demarrage une entree « PiBoard » dans le menu des applications et une
   icone sur le bureau. Elles lancent install/piboard-launch.sh : relance
   complete (serveur + affichage plein ecran) sans redemarrer la machine,
   par exemple apres « Revenir au bureau ».

   Le serveur tourne sous le compte de l'utilisateur : il ecrit dans SON
   dossier personnel, sans droits administrateur. Les fichiers ne sont
   reecrits que si leur contenu change (dossier de PiBoard deplace...).
   Rien n'est fait dans l'application de bureau Windows/macOS, ni sous
   Linux sans bureau (image « Lite »), ni si PIBOARD_NO_LAUNCHER=1.

   Desktop "PiBoard" icon on Linux: the server (running as the user)
   writes a menu entry and a desktop icon launching a full relaunch
   (server + kiosk display) without rebooting. Only rewritten when the
   content changes; skipped outside Linux, without a desktop, or with
   PIBOARD_NO_LAUNCHER=1. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function desktopEntry(appDir, lang) {
  const script = path.join(appDir, "install", "piboard-launch.sh");
  const icon = path.join(appDir, "build", "icon.png");
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=PiBoard",
    "Comment=Relancer PiBoard (serveur et tableau plein écran)",
    "Comment[en]=Relaunch PiBoard (server and full-screen dashboard)",
    "Comment[fr]=Relancer PiBoard (serveur et tableau plein écran)",
    `Exec=bash "${script}"`,
    `Icon=${icon}`,
    "Terminal=false",
    "Categories=Utility;",
    "StartupNotify=false",
    ""
  ].join("\n");
}

/* Dossier « Bureau » de l'utilisateur : celui declare dans
   ~/.config/user-dirs.dirs (Bureau en francais), sinon ~/Desktop. */
function desktopDir(home) {
  try {
    const txt = fs.readFileSync(path.join(home, ".config", "user-dirs.dirs"), "utf8");
    const m = /^XDG_DESKTOP_DIR="?([^"\n]+)"?/m.exec(txt);
    if (m) return m[1].replace(/^\$HOME/, home);
  } catch (e) { /* pas de fichier : valeur par defaut */ }
  return path.join(home, "Desktop");
}

/* Un bureau graphique est-il installe ? (labwc, wayfire, LXDE, ou un
   dossier Bureau existant.) */
function hasDesktop(home) {
  const probes = [path.join(home, ".config", "labwc"), path.join(home, ".config", "wayfire.ini"),
    path.join(home, ".config", "lxsession"), path.join(home, ".config", "pcmanfm"), desktopDir(home)];
  return probes.some((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
}

function writeIfChanged(file, content, mode) {
  let old = null;
  try { old = fs.readFileSync(file, "utf8"); } catch (e) { old = null; }
  if (old === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  try { fs.chmodSync(file, mode || 0o755); } catch (e) { /* noop */ }
  return true;
}

function ensureLauncher(opts) {
  const o = opts || {};
  const platformId = o.platformId;
  if (platformId !== "linux" || o.desktopApp || process.env.PIBOARD_NO_LAUNCHER === "1") return { done: false, reason: "not-applicable" };
  const home = o.home || os.homedir();
  const appDir = o.appDir || path.resolve(__dirname, "..");
  if (!hasDesktop(home)) return { done: false, reason: "no-desktop" };
  const entry = desktopEntry(appDir);
  const written = [];
  const menu = path.join(home, ".local", "share", "applications", "piboard.desktop");
  if (writeIfChanged(menu, entry, 0o644)) written.push(menu);
  const desk = path.join(desktopDir(home), "piboard.desktop");
  if (fs.existsSync(path.dirname(desk)) && writeIfChanged(desk, entry, 0o755)) written.push(desk);
  // Le script doit etre lisible ; « bash script » ne demande pas le bit d'execution.
  try { fs.chmodSync(path.join(appDir, "install", "piboard-launch.sh"), 0o755); } catch (e) { /* noop */ }
  return { done: true, written, menu, desktop: desk };
}

module.exports = { ensureLauncher, desktopEntry, desktopDir, hasDesktop };
