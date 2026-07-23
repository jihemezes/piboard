/* ============================================================
   PiBoard - server/platform/darwin.js
   Implementation macOS de l'interface decrite dans
   server/platform/index.js. Utilisee uniquement en developpement et
   pour les tests locaux : PiBoard n'est pas distribue pour macOS.
   Comme pour Linux, le code a ete deplace ici sans modification
   fonctionnelle.

   macOS implementation of the interface described in
   server/platform/index.js. Only used for development and local
   testing: PiBoard is not distributed for macOS. As with Linux, the
   code was moved here without functional change.
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { isValidIp, normalizeMac } = require("../ipv4");

const id = "darwin";

function pingArgs(ip, timeoutSec) {
  // -W attend des MILLISECONDES sous macOS (BSD), contrairement a Linux
  // -W expects MILLISECONDS on macOS (BSD), unlike Linux
  return ["-c", "1", "-W", String(Math.max(1, Math.round(timeoutSec * 1000))), ip];
}

function pingSucceeded(err /*, stdout */) {
  return !err;
}

/* Format `arp -an` de macOS (BSD), tres different du Linux :
     ? (192.168.1.1) at 0:11:22:33:44:55 on en0 ifscope [ethernet]
     ? (192.168.1.50) at (incomplete) on en0 ifscope [ethernet]
   Les octets MAC peuvent ne pas avoir de zero de tete (ex. "0:11:..."),
   et une entree non resolue affiche litteralement "(incomplete)" a la
   place de l'adresse -- ces deux points different du format Linux et
   necessitent un parseur separe.
   macOS's (BSD) `arp -an` format, quite different from Linux's -- see
   above. MAC octets may lack a leading zero (e.g. "0:11:..."), and an
   unresolved entry literally shows "(incomplete)" instead of an
   address -- both points differ from the Linux format and need a
   separate parser. */
function parseArp(raw, allowedIps) {
  const found = [];
  const macRe = /^([0-9a-fA-F]{1,2}:){5}[0-9a-fA-F]{1,2}$/;
  const lineRe = /\(([\d.]+)\)\s+at\s+(\S+)/;
  for (const line of String(raw || "").split("\n")) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const ip = m[1];
    const mac = m[2];
    if (!macRe.test(mac)) continue; // "(incomplete)" ou autre entree non resolue / unresolved entry
    if (!isValidIp(ip)) continue;
    if (allowedIps && !allowedIps.has(ip)) continue;
    found.push({ ip, mac: normalizeMac(mac) || mac });
  }
  return found;
}

function readArpEntries(allowedIps, timeoutMs) {
  return new Promise((resolve) => {
    execFile("arp", ["-an"], { timeout: timeoutMs || 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      resolve(parseArp(stdout, allowedIps));
    });
  });
}

/* Sur macOS, `dscacheutil` interroge la meme couche systeme que
   `getent` sous Linux (y compris mDNSResponder/Bonjour).
   On macOS, `dscacheutil` queries the same system layer as `getent`
   does on Linux (including mDNSResponder/Bonjour). */
function parseDscacheutilOutput(stdout) {
  const m = /^name:\s*(.+)$/m.exec(String(stdout || ""));
  if (!m) return null;
  return m[1].trim().replace(/\.$/, "") || null;
}

function reverseLookup(ip, timeoutMs) {
  return new Promise((resolve) => {
    if (!isValidIp(ip)) return resolve(null);
    execFile(
      "dscacheutil",
      ["-q", "host", "-a", "ip_address", ip],
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        resolve(parseDscacheutilOutput(stdout));
      }
    );
  });
}

/* macOS monte les supports amovibles sous /Volumes/<nom>, sans niveau
   intermediaire par utilisateur contrairement a Linux.
   macOS mounts removable media under /Volumes/<name>, with no
   per-user intermediate level unlike Linux. */
const MOUNT_ROOTS = ["/Volumes"];

function listRemovableVolumes(roots) {
  const volumes = [];
  for (const root of roots || MOUNT_ROOTS) {
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      volumes.push({ label: entry.name, path: path.join(root, entry.name) });
    }
  }
  return volumes;
}

function cpuTemperature() {
  return null; // pas de source simple et fiable / no simple, reliable source
}

function filesystemRoot() {
  return "/";
}

function exitKiosk() {
  return { ok: false, reason: "not-supported" };
}

function exitToDesktop() {
  return { ok: false, reason: "not-supported" };
}

module.exports = {
  id,
  pingArgs,
  pingSucceeded,
  parseArp,
  readArpEntries,
  parseDscacheutilOutput,
  reverseLookup,
  listRemovableVolumes,
  cpuTemperature,
  filesystemRoot,
  exitKiosk,
  exitToDesktop,
  MOUNT_ROOTS
};
