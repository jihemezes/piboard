/* Icone « PiBoard » du bureau Linux (1.180.0) : creation des entrees de
   menu et de bureau dans un dossier personnel factice, conditions
   (Linux avec bureau seulement), contenu, et scripts d'installation. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { execFileSync } = require("child_process");
const L = require("../server/desktopLauncher");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-home-"));
const appDir = "/home/pi/piboard";

let r = L.ensureLauncher({ platformId: "darwin", home, appDir });
assert.strictEqual(r.done, false, "macOS : rien");
r = L.ensureLauncher({ platformId: "linux", desktopApp: true, home, appDir });
assert.strictEqual(r.done, false, "application de bureau : rien");
r = L.ensureLauncher({ platformId: "linux", home, appDir });
assert.strictEqual(r.reason, "no-desktop", "Linux sans bureau (image Lite) : rien");

fs.mkdirSync(path.join(home, ".config", "labwc"), { recursive: true });
fs.writeFileSync(path.join(home, ".config", "user-dirs.dirs"), 'XDG_DESKTOP_DIR="$HOME/Bureau"\n');
fs.mkdirSync(path.join(home, "Bureau"));
r = L.ensureLauncher({ platformId: "linux", home, appDir });
assert.ok(r.done && r.written.length === 2, "menu + bureau ecrits");
const menu = fs.readFileSync(path.join(home, ".local/share/applications/piboard.desktop"), "utf8");
assert.ok(/^Name=PiBoard$/m.test(menu) && menu.includes('Exec=bash "/home/pi/piboard/install/piboard-launch.sh"') && menu.includes("Icon=/home/pi/piboard/build/icon.png"));
assert.ok(fs.existsSync(path.join(home, "Bureau", "piboard.desktop")), "dossier Bureau francais respecte");
assert.ok(fs.statSync(path.join(home, "Bureau", "piboard.desktop")).mode & 0o100, "icone du bureau executable");
r = L.ensureLauncher({ platformId: "linux", home, appDir });
assert.strictEqual(r.written.length, 0, "contenu identique : rien n'est reecrit");
r = L.ensureLauncher({ platformId: "linux", home, appDir: "/opt/piboard" });
assert.strictEqual(r.written.length, 2, "dossier deplace : mis a jour");
process.env.PIBOARD_NO_LAUNCHER = "1";
assert.strictEqual(L.ensureLauncher({ platformId: "linux", home, appDir }).done, false, "desactivable");
delete process.env.PIBOARD_NO_LAUNCHER;

// Scripts : syntaxe bash valide et etapes attendues.
const root = path.join(__dirname, "..", "install");
for (const f of ["piboard-launch.sh", "enable-launcher.sh", "install.sh"]) execFileSync("bash", ["-n", path.join(root, f)]);
const launch = fs.readFileSync(path.join(root, "piboard-launch.sh"), "utf8");
assert.ok(/pkill -x chromium/.test(launch) && /systemctl restart --no-ask-password piboard\.service/.test(launch) && /pkexec systemctl restart piboard\.service/.test(launch) && /--kiosk/.test(launch),
  "relance : fermeture du kiosque, redemarrage du serveur (sans mot de passe, sinon pkexec), plein ecran");
const rule = fs.readFileSync(path.join(root, "enable-launcher.sh"), "utf8");
assert.ok(/action\.lookup\("unit"\) == "piboard\.service"/.test(rule) && /verb.*restart/.test(rule), "regle polkit limitee a piboard.service");
assert.ok(/enable-launcher\.sh/.test(fs.readFileSync(path.join(root, "install.sh"), "utf8")), "install.sh pose la regle");
console.log("desktopLauncher : tous les tests OK");
