/* ============================================================
   PiBoard - server/platform/linux.js
   Implementation Linux / Raspberry Pi OS de l'interface decrite dans
   server/platform/index.js. C'est le comportement historique de
   PiBoard, deplace ici tel quel : aucune modification fonctionnelle
   n'a ete apportee lors de l'extraction, afin que le Pi se comporte
   exactement comme avant.

   Linux / Raspberry Pi OS implementation of the interface described in
   server/platform/index.js. This is PiBoard's historical behaviour,
   moved here as-is: no functional change was made during extraction,
   so the Pi behaves exactly as before.
   ============================================================ */
"use strict";

const fs = require("fs");
const { execFile, exec } = require("child_process");
const { isValidIp, normalizeMac } = require("../ipv4");

const id = "linux";

/* ---------- Ping (ICMP) ----------
   -c 1 : un seul paquet / a single packet
   -W n : delai d'attente en SECONDES / timeout in SECONDS */
function pingArgs(ip, timeoutSec) {
  return ["-c", "1", "-W", String(timeoutSec), ip];
}

/* Sous Linux, le code de sortie de `ping` suffit : il n'est nul que si
   une reponse ICMP echo a bien ete recue.
   On Linux, `ping`'s exit code is enough: it is only zero when an ICMP
   echo reply was actually received. */
function pingSucceeded(err /*, stdout */) {
  return !err;
}

/* ---------- Table ARP du noyau / kernel ARP table ----------
   Format de /proc/net/arp :
     IP address  HW type  Flags  HW address         Mask  Device
     192.168.1.1 0x1      0x2    a4:2b:b0:11:22:33  *     eth0
   Fonction pure separee de la lecture disque, pour rester testable sans
   dependre du vrai /proc/net/arp de la machine qui execute les tests.
   Format of /proc/net/arp (see above). Pure function kept separate from
   the disk read, so it stays testable without depending on the real
   /proc/net/arp of the machine running the tests. */
function parseArp(raw, allowedIps) {
  const found = [];
  const lines = String(raw || "").trim().split("\n").slice(1); // 1re ligne = en-tetes / 1st line = headers
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    // Colonnes : IP address / HW type / Flags / HW address / Mask / Device
    if (cols.length < 6) continue;
    const ip = cols[0];
    const flags = cols[2];
    const mac = cols[3];
    if (flags !== "0x2") continue; // 0x2 = ATF_COM, entree resolue / resolved entry
    if (!isValidIp(ip)) continue;
    if (allowedIps && !allowedIps.has(ip)) continue;
    found.push({ ip, mac: normalizeMac(mac) || mac });
  }
  return found;
}

function readArpEntries(allowedIps) {
  try {
    const raw = fs.readFileSync("/proc/net/arp", "utf8");
    return Promise.resolve(parseArp(raw, allowedIps));
  } catch (e) {
    return Promise.resolve([]); // /proc absent : on se contente du ping / no /proc: ping alone is used
  }
}

/* ---------- Resolution de nom inverse / reverse name lookup ----------
   `getent hosts` passe par la couche de resolution du systeme, qui
   respecte /etc/nsswitch.conf et consulte donc le module mDNS
   (Avahi) : c'est la seule facon d'obtenir les noms ".local" des autres
   machines du reseau (telephones, imprimantes...), qu'aucune requete
   PTR classique ne fournirait.
   `getent hosts` goes through the system resolver, which respects
   /etc/nsswitch.conf and therefore consults the mDNS module (Avahi):
   this is the only way to get other LAN machines' ".local" names
   (phones, printers...), which no plain PTR query would provide. */
function reverseLookup(ip, timeoutMs) {
  return new Promise((resolve) => {
    if (!isValidIp(ip)) return resolve(null);
    execFile("getent", ["hosts", ip], { timeout: timeoutMs }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      // Format attendu : "192.168.1.42   nom-machine.local"
      // Expected format: "192.168.1.42   device-name.local"
      const parts = String(stdout).trim().split(/\s+/);
      if (parts.length < 2 || !parts[1]) return resolve(null);
      resolve(parts[1].replace(/\.$/, ""));
    });
  });
}

/* ---------- Supports amovibles / removable media ----------
   Racines standards ou Pi OS (et la plupart des distributions Linux de
   bureau) montent les supports amovibles, sous la forme
   /media/<utilisateur>/<volume>. Standard roots where Pi OS (and most
   desktop Linux distributions) mount removable media, in the form
   /media/<user>/<volume>. */
const MOUNT_ROOTS = ["/media", "/run/media"];

function listRemovableVolumes(roots) {
  const path = require("path");
  const volumes = [];
  for (const root of roots || MOUNT_ROOTS) {
    let userDirs;
    try {
      userDirs = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
      continue; // racine absente sur ce systeme / root not present on this system
    }
    for (const userDir of userDirs) {
      if (!userDir.isDirectory() || userDir.name.startsWith(".")) continue;
      const userPath = path.join(root, userDir.name);
      let volDirs;
      try {
        volDirs = fs.readdirSync(userPath, { withFileTypes: true });
      } catch (e) {
        continue;
      }
      for (const volDir of volDirs) {
        if (!volDir.isDirectory() || volDir.name.startsWith(".")) continue;
        volumes.push({ label: volDir.name, path: path.join(userPath, volDir.name) });
      }
    }
  }
  return volumes;
}

/* ---------- Temperature CPU / CPU temperature ---------- */
function cpuTemperature() {
  try {
    const raw = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8");
    return Math.round((Number(raw.trim()) / 1000) * 10) / 10;
  } catch (e) {
    return null;
  }
}

/* ---------- Racine du systeme de fichiers / filesystem root ---------- */
function filesystemRoot() {
  return "/";
}

/* ---------- Sortie du kiosque / leaving kiosk mode ----------
   Le fichier autostart de labwc ne lance PAS Chromium directement : il
   l'enveloppe dans le superviseur "lwrespawn", qui le relance
   automatiquement des qu'il se termine. D'ou deux comportements
   distincts :
     - exitKiosk (\"Reinitialiser le tableau de bord\") : tue Chromium
       SEUL, en laissant lwrespawn le relancer -- un reset complet.
     - exitToDesktop (\"Revenir au bureau\") : tue D'ABORD lwrespawn (le
       superviseur), PUIS Chromium -- sans superviseur, plus rien ne le
       relance et le bureau reste visible.
   L'ordre est CRITIQUE : l'inverse laisse lwrespawn relancer Chromium
   dans l'instant qui suit.

   labwc's autostart file does NOT launch Chromium directly: it wraps it
   in the \"lwrespawn\" supervisor, which relaunches it automatically as
   soon as it exits. Hence two distinct behaviours:
     - exitKiosk (\"Reset the dashboard\"): kills Chromium ALONE, letting
       lwrespawn relaunch it -- a complete reset.
     - exitToDesktop (\"Return to the desktop\"): kills lwrespawn (the
       supervisor) FIRST, THEN Chromium -- with no supervisor, nothing
       relaunches it and the desktop stays visible.
   The order is CRITICAL: the reverse lets lwrespawn relaunch Chromium
   within the instant that follows. */

/* -x : ne cible que les processus dont le nom exact (comm) est
   "chromium" -- jamais lwrespawn lui-meme. Erreur ignoree
   volontairement : si aucun processus ne correspond (deja ferme, nom
   different sur ce systeme), ce n'est pas bloquant.
   -x: only targets processes whose exact name (comm) is "chromium" --
   never lwrespawn itself. Error deliberately ignored: if no process
   matches (already closed, different name on this system), it is not
   blocking. */
function exitKiosk() {
  exec("pkill -x chromium", () => {});
  return { ok: true };
}

function exitToDesktop() {
  exec("pkill -x lwrespawn; pkill -x chromium", () => {});
  return { ok: true };
}

module.exports = {
  id,
  pingArgs,
  pingSucceeded,
  parseArp,
  readArpEntries,
  reverseLookup,
  listRemovableVolumes,
  cpuTemperature,
  filesystemRoot,
  exitKiosk,
  exitToDesktop,
  MOUNT_ROOTS
};
