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
const { execFile, exec, spawn } = require("child_process");
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

/* ---------- Mise a jour automatique / self-update ----------
   Sur Linux, le serveur peut se mettre a jour lui-meme depuis les
   releases GitHub (voir server/selfUpdate.js) : `tar` est present sur
   toute distribution Debian/Ubuntu/Pi OS, et le dossier de
   l'application appartient a l'utilisateur du service. C'est la
   contrepartie d'electron-updater sous Windows.
   On Linux the server can update itself from GitHub releases (see
   server/selfUpdate.js): `tar` ships with every Debian/Ubuntu/Pi OS
   distribution, and the application folder belongs to the service user.
   This is the counterpart of electron-updater on Windows. */
function updateSupport() {
  return { supported: true, method: "github-archive" };
}

/* Redemarrage apres mise a jour. Deux situations :
     - service systemd (INVOCATION_ID est pose par systemd >= 232 pour
       chaque unite) : on quitte avec un code NON NUL. Le fichier
       install/piboard.service declare Restart=on-failure : un code 0
       ne relancerait PAS le service, un code non nul si. Les
       installations plus recentes ont Restart=always, ou les deux
       marchent. Le processus n'a pas le droit d'appeler
       `systemctl restart` lui-meme (utilisateur sans privileges,
       NoNewPrivileges=true) : cette sortie volontaire est le seul
       levier disponible, et il suffit.
     - lance a la main (node server/index.js, npm start, pm2 sans
       relance...) : personne ne nous relancera. On demarre un remplacant
       detache qui attend une seconde (le temps que ce processus libere
       le port), puis on quitte.
   Restart after an update. Two situations:
     - systemd service (INVOCATION_ID is set by systemd >= 232 for every
       unit): exit with a NON-ZERO code. install/piboard.service declares
       Restart=on-failure: a 0 code would NOT relaunch the service, a
       non-zero one does. Newer installs have Restart=always, where both
       work. The process is not allowed to call `systemctl restart`
       itself (unprivileged user, NoNewPrivileges=true): this deliberate
       exit is the only lever available, and it is enough.
     - started by hand (node server/index.js, npm start, pm2 without
       relaunch...): nobody will bring us back. We spawn a detached
       replacement that waits one second (for this process to free the
       port), then exit. */
function restartServer() {
  const underSystemd = !!process.env.INVOCATION_ID;
  if (!underSystemd) {
    try {
      const script = process.argv[1] || "server/index.js";
      const child = spawn("/bin/sh", ["-c", "sleep 1; exec \"$0\" \"$1\"", process.execPath, script], {
        cwd: process.cwd(),
        env: process.env,
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  }
  setTimeout(() => process.exit(underSystemd ? 3 : 0), 200);
  return { ok: true, method: underSystemd ? "systemd" : "respawn" };
}

/* Emplacements ou chercher ffmpeg, par ordre de priorite. Sur un Pi OS
   ou un PC Linux, ffmpeg s'installe via le gestionnaire de paquets et
   se retrouve dans le PATH : le simple nom suffit presque toujours. Les
   chemins absolus couvrent le cas d'un PATH restreint (service systemd
   demarre avec un environnement minimal, notamment).
   Where to look for ffmpeg, in priority order. On Pi OS or a Linux PC,
   ffmpeg installs via the package manager and lands in PATH: the bare
   name almost always suffices. The absolute paths cover a restricted
   PATH (a systemd service started with a minimal environment, notably). */
function ffmpegCandidates() {
  return ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"];
}

function ffmpegInstallHint() {
  return { fr: "sudo apt install ffmpeg", en: "sudo apt install ffmpeg" };
}

/* Chromium, pour le rendu d'une page web en image cote serveur (voir
   server/webviewShot.js). Sur un Raspberry Pi en kiosque, il est deja
   installe et tourne -- c'est le navigateur meme qui affiche PiBoard :
   aucune dependance supplementaire a installer dans le cas d'usage
   principal. "chromium" est le nom du paquet sous Pi OS/Debian recent,
   "chromium-browser" celui des versions plus anciennes ; les deux sont
   testes, ainsi que Chrome au cas ou.
   Chromium, for server-side rendering of a web page to an image (see
   server/webviewShot.js). On a Raspberry Pi kiosk it's already
   installed and running -- it's the very browser displaying PiBoard:
   no extra dependency to install in the main use case. "chromium" is
   the package name on recent Pi OS/Debian, "chromium-browser" on older
   ones; both are tried, plus Chrome just in case. */
function chromiumCandidates() {
  return [
    "chromium",
    "/usr/bin/chromium",
    "chromium-browser",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "google-chrome",
    "/usr/bin/google-chrome"
  ];
}

function chromiumInstallHint() {
  return { fr: "sudo apt install chromium", en: "sudo apt install chromium" };
}

/* cvlc (VLC sans interface graphique) : necessaire pour le relais des
   chaines en direct qu'un fournisseur IPTV rejette avec un 405 face a
   ffmpeg -- confirme par examen du lecteur de reference officiel, qui
   utilise libVLC nativement pour le direct plutot que le pipeline
   video du navigateur. VLC/cvlc s'installe egalement via le
   gestionnaire de paquets sur Pi OS/Linux, meme logique de recherche
   que ffmpeg. cvlc (VLC without a graphical interface): needed to
   relay live channels an IPTV provider rejects with a 405 when faced
   with ffmpeg -- confirmed by examining the official reference player,
   which uses libVLC natively for live rather than the browser's video
   pipeline. VLC/cvlc also installs via the package manager on Pi
   OS/Linux, same lookup logic as ffmpeg. */
function vlcCandidates() {
  return ["cvlc", "/usr/bin/cvlc", "/usr/local/bin/cvlc", "/snap/bin/vlc.cvlc"];
}

function vlcInstallHint() {
  return { fr: "sudo apt install vlc-bin vlc-plugin-base", en: "sudo apt install vlc-bin vlc-plugin-base" };
}


/* ---------- Configuration reseau / network configuration ----------

   Sous Linux, aucune commande ne donne tout : on assemble trois sources
   independantes, chacune facultative.

   1. `ip route` -> passerelle par defaut, par carte. Sortie stable et
      NON localisee, contrairement a `ipconfig` sous Windows.
   2. `resolvectl status` -> DNS et domaine de recherche quand
      systemd-resolved est en place (cas de Pi OS Trixie). Repli sur
      /etc/resolv.conf sinon -- fichier universel, mais qui sur une
      machine avec systemd-resolved ne contient que 127.0.0.53, d'ou
      l'ordre.
   3. Baux DHCP -> presence d'un fichier de bail, serveur et expiration.
      Les emplacements varient selon le client (dhcpcd sur Pi OS,
      dhclient ailleurs) : on essaie les deux.

   Chaque etage echoue independamment : perdre les DNS ne doit pas faire
   perdre la passerelle.

   On Linux no single command gives everything: we assemble three
   independent sources, each optional.

   1. `ip route` -> default gateway, per adapter. Stable and NOT
      localised output, unlike Windows' `ipconfig`.
   2. `resolvectl status` -> DNS and search domain when systemd-resolved
      is in place (the case on Pi OS Trixie). Falls back to
      /etc/resolv.conf otherwise -- a universal file, but one that on a
      systemd-resolved machine holds only 127.0.0.53, hence the order.
   3. DHCP leases -> lease file presence, server and expiry. Locations
      vary by client (dhcpcd on Pi OS, dhclient elsewhere): we try both.

   Each layer fails independently: losing DNS must not lose the gateway. */

const NET_TIMEOUT_MS = 4000;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: NET_TIMEOUT_MS, encoding: "utf8" },
      (err, stdout) => resolve(err && !stdout ? null : String(stdout || "")));
  });
}

/* `ip route` : on ne retient QUE les routes par defaut. Une table de
   routage complete contient aussi les routes de sous-reseau, qui n'ont
   pas de passerelle a afficher.
   `ip route`: we keep ONLY default routes. A full routing table also
   holds subnet routes, which have no gateway to show. */
function parseIpRoute(raw) {
  const out = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const m = line.match(/^default\s+via\s+(\S+)\s+dev\s+(\S+)/);
    if (m) out[m[2]] = m[1];
  }
  return out;
}

/* `resolvectl status` : sortie par section "Link n (nom)". Les serveurs
   peuvent tenir sur plusieurs lignes, la premiere seule serait
   incomplete.
   `resolvectl status`: output in "Link n (name)" sections. Servers can
   span several lines; the first one alone would be incomplete. */
function parseResolvectl(raw) {
  const out = {};
  let cur = null;
  let collecting = false;
  for (const line of String(raw || "").split(/\r?\n/)) {
    const link = line.match(/^Link\s+\d+\s+\(([^)]+)\)/);
    if (link) { cur = link[1]; out[cur] = { dns: [], domain: null }; collecting = false; continue; }
    if (!cur) continue;
    const dns = line.match(/^\s*(?:Current\s+)?DNS Servers?:\s*(.*)$/i);
    if (dns) {
      out[cur].dns.push(...dns[1].split(/\s+/).filter(Boolean));
      collecting = true;
      continue;
    }
    const dom = line.match(/^\s*DNS Domain:\s*(.*)$/i);
    if (dom) { out[cur].domain = dom[1].trim() || null; collecting = false; continue; }
    if (collecting && /^\s{2,}\S/.test(line) && !line.includes(":")) {
      out[cur].dns.push(...line.trim().split(/\s+/).filter(Boolean));
      continue;
    }
    collecting = false;
  }
  return out;
}

function parseResolvConf(raw) {
  const dns = [];
  let domain = null;
  for (const line of String(raw || "").split(/\r?\n/)) {
    const n = line.match(/^\s*nameserver\s+(\S+)/);
    if (n) dns.push(n[1]);
    const d = line.match(/^\s*(?:search|domain)\s+(\S+)/);
    if (d && !domain) domain = d[1];
  }
  // 127.0.0.53 est le resolveur local de systemd, pas un vrai serveur :
  // l'afficher n'apprendrait rien a personne.
  // 127.0.0.53 is systemd's local stub, not a real server: showing it
  // would tell nobody anything.
  return { dns: dns.filter((x) => x !== "127.0.0.53"), domain };
}

/* Bail dhcpcd. Le format est `lease {}` facon dhclient chez dhclient, et
   un fichier binaire chez dhcpcd : on ne lit donc que ce qui est
   textuel, et on renvoie null sans se plaindre sinon.
   dhcpcd lease. The format is dhclient-style `lease {}` for dhclient and
   a binary file for dhcpcd: so we only read what is textual, and return
   null without complaining otherwise. */
function parseDhclientLease(raw, iface) {
  const text = String(raw || "");
  const blocks = text.split(/\blease\s*\{/).slice(1);
  let best = null;
  for (const b of blocks) {
    if (iface && !new RegExp("interface\\s+\"" + iface + "\"").test(b)) continue;
    const server = (b.match(/option dhcp-server-identifier\s+(\S+);/) || [])[1] || null;
    const expire = (b.match(/expire\s+\d+\s+([^;]+);/) || [])[1] || null;
    best = { dhcpServer: server, leaseExpires: expire ? expire.trim() : null };
  }
  return best;
}

async function networkDetails() {
  const [routeRaw, resolveRaw] = await Promise.all([
    run("ip", ["route"]),
    run("resolvectl", ["status"])
  ]);

  const gateways = parseIpRoute(routeRaw);
  const perLink = resolveRaw ? parseResolvectl(resolveRaw) : {};

  let fallbackDns = { dns: [], domain: null };
  if (!Object.keys(perLink).length) {
    try { fallbackDns = parseResolvConf(fs.readFileSync("/etc/resolv.conf", "utf8")); }
    catch (e) { /* fichier absent / file missing */ }
  }

  const names = new Set([...Object.keys(gateways), ...Object.keys(perLink)]);
  const adapters = [];
  for (const name of names) {
    const link = perLink[name] || {};
    let lease = null;
    for (const f of ["/var/lib/dhcp/dhclient." + name + ".leases",
                     "/var/lib/dhcp/dhclient.leases",
                     "/var/lib/dhcpcd/" + name + ".lease"]) {
      try { lease = parseDhclientLease(fs.readFileSync(f, "utf8"), name); if (lease) break; }
      catch (e) { /* bail absent ou binaire / lease missing or binary */ }
    }
    adapters.push({
      name,
      gateway: gateways[name] || null,
      // Presence d'un bail = adresse obtenue en DHCP. En l'absence de
      // bail lisible on laisse null : affirmer "adresse fixe" sur la
      // seule absence d'un fichier serait une deduction trop hative.
      // A lease present = address obtained via DHCP. With no readable
      // lease we leave null: asserting "static address" purely from a
      // missing file would be too hasty a deduction.
      dhcp: lease ? true : null,
      dhcpServer: lease ? lease.dhcpServer : null,
      leaseExpires: lease ? lease.leaseExpires : null,
      dns: (link.dns && link.dns.length ? link.dns : fallbackDns.dns) || [],
      domain: link.domain || fallbackDns.domain || null
    });
  }

  return { adapters, domain: fallbackDns.domain || null };
}

module.exports = {
  id,
  networkDetails,
  parseIpRoute,
  parseResolvectl,
  parseResolvConf,
  parseDhclientLease,
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
  updateSupport,
  restartServer,
  MOUNT_ROOTS,
  ffmpegCandidates,
  ffmpegInstallHint,
  chromiumCandidates,
  chromiumInstallHint,
  vlcCandidates,
  vlcInstallHint
};
