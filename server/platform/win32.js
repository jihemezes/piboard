/* ============================================================
   PiBoard - server/platform/win32.js
   Implementation Windows de l'interface decrite dans
   server/platform/index.js.

   PRINCIPE DIRECTEUR : ne jamais dependre de la LANGUE de Windows.
   Les sorties de `ping` et `arp` sont entierement traduites (francais,
   allemand...), donc tous les parseurs de ce fichier ne s'appuient que
   sur des elements universels : chiffres, adresses IP, adresses MAC en
   hexadecimal, et le marqueur "TTL=" qui est identique dans toutes les
   localisations de Windows. Aucun mot traduit n'est jamais recherche.
   Pour la meme raison, l'encodage de la console (cp850/cp1252, mal
   decode en UTF-8 par Node) est sans consequence : les caracteres
   accentues n'apparaissent que dans les parties de texte ignorees.

   GUIDING PRINCIPLE: never depend on Windows's LANGUAGE. The output of
   `ping` and `arp` is fully translated (French, German...), so every
   parser in this file relies only on universal elements: digits, IP
   addresses, hexadecimal MAC addresses, and the "TTL=" marker which is
   identical across all Windows localizations. No translated word is
   ever searched for. For the same reason, console encoding
   (cp850/cp1252, mis-decoded as UTF-8 by Node) is harmless: accented
   characters only ever appear in the text portions we ignore.
   ============================================================ */
"use strict";

const path = require("path");
const { execFile, execFileSync } = require("child_process");
const { isValidIp, normalizeMac, isBroadcastOrMulticastMac } = require("../ipv4");

const id = "win32";

/* ---------- Ping (ICMP) ----------
   -n 1 : un seul paquet / a single packet
   -w n : delai d'attente en MILLISECONDES (et non en secondes comme
          sous Linux) / timeout in MILLISECONDS (not seconds as on
          Linux) */
function pingArgs(ip, timeoutSec) {
  return ["-n", "1", "-w", String(Math.max(1, Math.round(timeoutSec * 1000))), ip];
}

/* PIEGE CLASSIQUE DE WINDOWS : `ping` renvoie un code de sortie NUL
   (donc \"succes\") meme quand la reponse recue est en realite un
   \"Hote de destination inaccessible\" emis par le routeur, et non une
   reponse de l'hote vise. Se fier au code de sortie ferait apparaitre
   comme actives toutes les adresses libres du sous-reseau.
   On verifie donc la presence du marqueur \"TTL=\", qui n'est present
   que dans une VRAIE reponse d'echo, et qui n'est traduit dans aucune
   localisation de Windows.

   CLASSIC WINDOWS PITFALL: `ping` returns a ZERO exit code (i.e.
   \"success\") even when the reply actually received is a \"Destination
   host unreachable\" sent by the router rather than a reply from the
   target host. Trusting the exit code would make every free address on
   the subnet look alive. We therefore check for the \"TTL=\" marker,
   which only appears in a REAL echo reply and is translated in no
   Windows localization. */
function pingSucceeded(err, stdout) {
  if (err && err.killed) return false; // delai depasse / timed out
  return /TTL\s*=\s*\d+/i.test(String(stdout || ""));
}

/* ---------- Table ARP / ARP table ----------
   Format de `arp -a` sous Windows (ici en francais, mais seules les
   colonnes numeriques sont exploitees) :

     Interface : 192.168.1.10 --- 0x5
       Adresse Internet      Adresse physique      Type
       192.168.1.1           a4-2b-b0-11-22-33     dynamique
       192.168.1.255         ff-ff-ff-ff-ff-ff     statique
       224.0.0.22            01-00-5e-00-00-16     statique

   Les octets MAC sont separes par des tirets (et non par des deux-points
   comme sous Linux/macOS) et toujours sur deux chiffres. Les lignes
   d'en-tete et de section sont ignorees d'office : elles ne
   correspondent pas au motif \"IP + MAC\". Les entrees de diffusion et
   de multidiffusion (ff-ff-... et plage 224.x) sont ecartees car elles
   ne designent aucun appareil reel.

   Format of `arp -a` on Windows (shown in French, but only the numeric
   columns are used) -- see above. MAC octets are dash-separated (not
   colon-separated as on Linux/macOS) and always two digits. Header and
   section lines are ignored for free: they do not match the \"IP + MAC\"
   pattern. Broadcast and multicast entries (ff-ff-... and the 224.x
   range) are discarded as they designate no real device. */
function parseArp(raw, allowedIps) {
  const found = [];
  const lineRe = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+((?:[0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2})\b/;
  for (const line of String(raw || "").split("\n")) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const ip = m[1];
    const mac = normalizeMac(m[2]);
    if (!mac) continue;
    if (!isValidIp(ip)) continue;
    if (isBroadcastOrMulticastMac(mac)) continue;
    if (allowedIps && !allowedIps.has(ip)) continue;
    found.push({ ip, mac });
  }
  return found;
}

function readArpEntries(allowedIps, timeoutMs) {
  return new Promise((resolve) => {
    execFile("arp", ["-a"], { timeout: timeoutMs || 3000, windowsHide: true }, (err, stdout) => {
      if (!stdout) return resolve([]);
      resolve(parseArp(stdout, allowedIps));
    });
  });
}

/* ---------- Resolution de nom inverse / reverse name lookup ----------
   Windows n'offre pas d'equivalent propre a `getent hosts` : `nslookup`
   n'interroge que le DNS (jamais mDNS ni NetBIOS) et sa sortie est
   traduite. On utilise donc `ping -a`, qui declenche la resolution
   inverse du systeme (DNS + NetBIOS) et affiche le nom trouve sur sa
   premiere ligne, sous la forme universelle \"<nom> [<ip>]\" -- les
   crochets et l'adresse sont identiques dans toutes les langues, seul
   le texte qui les entoure est traduit.
   Si aucun nom n'est resolu, Windows affiche directement l'adresse sans
   crochets : le motif ne correspond pas et on renvoie null, ce qui
   laisse le repli dns.reverse() de networkScan.js prendre le relais.

   RESERVE CONNUE : sur le Pi, `getent` consulte Avahi et retourne les
   noms \".local\" (telephones, imprimantes...). Windows gere mDNS en
   interne mais ne l'expose pas a `ping -a`. Il faut donc s'attendre a
   ce que davantage d'appareils apparaissent sans nom sous Windows,
   avec seulement leur IP et leur fabricant deduit de la MAC.

   Windows offers no clean equivalent of `getent hosts`: `nslookup` only
   queries DNS (never mDNS or NetBIOS) and its output is translated. We
   therefore use `ping -a`, which triggers the system's reverse
   resolution (DNS + NetBIOS) and prints the name found on its first
   line, in the universal form \"<name> [<ip>]\" -- brackets and address
   are identical in every language, only the surrounding text is
   translated.
   If no name resolves, Windows prints the address directly without
   brackets: the pattern does not match and we return null, letting
   networkScan.js's dns.reverse() fallback take over.

   KNOWN LIMITATION: on the Pi, `getent` consults Avahi and returns
   \".local\" names (phones, printers...). Windows handles mDNS
   internally but does not expose it to `ping -a`. Expect more devices
   to appear unnamed on Windows, with only their IP and the vendor
   deduced from their MAC. */
function parsePingHostname(stdout, ip) {
  if (!isValidIp(ip)) return null;
  const escaped = ip.replace(/\./g, "\\.");
  const re = new RegExp("([^\\s\\[\\]]+)\\s*\\[" + escaped + "\\]");
  const m = re.exec(String(stdout || ""));
  if (!m) return null;
  const name = m[1].trim().replace(/\.$/, "");
  // Un nom identique a l'adresse n'apporte rien / a name equal to the
  // address carries no information
  if (!name || name === ip) return null;
  return name;
}

function reverseLookup(ip, timeoutMs) {
  return new Promise((resolve) => {
    if (!isValidIp(ip)) return resolve(null);
    execFile(
      "ping",
      ["-a", "-n", "1", "-w", String(Math.max(1, timeoutMs || 1500)), ip],
      { timeout: (timeoutMs || 1500) + 500, windowsHide: true },
      (err, stdout) => resolve(parsePingHostname(stdout, ip))
    );
  });
}

/* ---------- Supports amovibles / removable media ----------
   Windows ne monte pas les cles USB dans une arborescence : chacune
   recoit une lettre de lecteur. La seule facon fiable de distinguer un
   support amovible d'un disque interne est d'interroger WMI
   (Win32_LogicalDisk, DriveType=2 = disque amovible). On demande une
   sortie JSON plutot qu'un tableau formate : les noms de proprietes
   (DeviceID, VolumeName) ne sont jamais traduits, contrairement aux
   en-tetes de colonnes d'un affichage tabulaire.

   Windows does not mount USB keys into a tree: each gets a drive
   letter. The only reliable way to tell removable media from an
   internal disk is to query WMI (Win32_LogicalDisk, DriveType=2 =
   removable disk). We ask for JSON output rather than a formatted
   table: property names (DeviceID, VolumeName) are never translated,
   unlike the column headers of a tabular display. */
const PS_COMMAND =
  "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' | " +
  "Select-Object DeviceID,VolumeName | ConvertTo-Json -Compress";

const PS_ARGS = ["-NoProfile", "-NonInteractive", "-Command", PS_COMMAND];

/* ConvertTo-Json produit un OBJET seul lorsqu'il n'y a qu'un volume, et
   un TABLEAU au-dela : les deux formes doivent etre acceptees. Aucun
   volume du tout produit une chaine vide.
   ConvertTo-Json produces a single OBJECT when there is only one
   volume, and an ARRAY beyond that: both shapes must be accepted. No
   volume at all produces an empty string. */
function parseVolumesJson(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [];
  }
  const list = Array.isArray(data) ? data : [data];
  const volumes = [];
  for (const entry of list) {
    if (!entry || typeof entry.DeviceID !== "string") continue;
    const letter = entry.DeviceID.trim(); // ex. "E:"
    if (!/^[A-Za-z]:$/.test(letter)) continue;
    const name = typeof entry.VolumeName === "string" ? entry.VolumeName.trim() : "";
    volumes.push({
      label: name || letter,
      // Racine du lecteur, avec separateur final : "E:\\" et non "E:",
      // qui designerait le repertoire courant de ce lecteur.
      // Drive root, with trailing separator: "E:\\" and not "E:", which
      // would mean that drive's current directory.
      path: letter + path.sep
    });
  }
  return volumes;
}

/* listRemovableVolumes() doit rester SYNCHRONE : elle est appelee par
   server/usbMedia.js, lui-meme utilise par des routes synchrones, et
   surtout par resolveUsbFile() a CHAQUE photo servie pendant un
   diaporama. Or le lancement de PowerShell coute plusieurs centaines de
   millisecondes : l'appeler a chaque image bloquerait la boucle
   d'evenements du serveur en continu.
   Compromis retenu : un seul appel synchrone au tout premier usage
   (amorcage), puis des rafraichissements EN ARRIERE-PLAN. Les appels
   suivants renvoient instantanement la derniere liste connue et ne
   bloquent jamais. Une cle branchee ou retiree est donc prise en compte
   avec au plus VOLUME_CACHE_TTL_MS de retard, ce qui est sans
   consequence pour un diaporama.

   listRemovableVolumes() must stay SYNCHRONOUS: it is called by
   server/usbMedia.js, itself used by synchronous routes, and above all
   by resolveUsbFile() for EVERY photo served during a slideshow. Yet
   starting PowerShell costs several hundred milliseconds: calling it
   per image would continuously block the server's event loop.
   Chosen trade-off: a single synchronous call on first use (priming),
   then BACKGROUND refreshes. Subsequent calls return the last known
   list instantly and never block. A key plugged in or removed is
   therefore picked up with at most VOLUME_CACHE_TTL_MS of delay, which
   is harmless for a slideshow. */
const VOLUME_CACHE_TTL_MS = 5000;
const PS_TIMEOUT_MS = 5000;
const volumeCache = { at: 0, volumes: [], refreshing: false };

function refreshVolumesAsync() {
  if (volumeCache.refreshing) return;
  volumeCache.refreshing = true;
  execFile("powershell", PS_ARGS, { timeout: PS_TIMEOUT_MS, windowsHide: true }, (err, stdout) => {
    volumeCache.refreshing = false;
    volumeCache.at = Date.now();
    // En cas d'erreur, on conserve la derniere liste connue plutot que
    // de faire disparaitre une cle branchee sur un echec ponctuel.
    // On error, keep the last known list rather than making a plugged-in
    // key vanish because of a one-off failure.
    if (!err) volumeCache.volumes = parseVolumesJson(stdout);
  });
}

function listRemovableVolumes() {
  if (!volumeCache.at) {
    // Amorcage : un unique appel synchrone, au tout premier usage.
    // Priming: a single synchronous call, on very first use.
    volumeCache.at = Date.now();
    try {
      const out = execFileSync("powershell", PS_ARGS, {
        timeout: PS_TIMEOUT_MS,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      });
      volumeCache.volumes = parseVolumesJson(out);
    } catch (e) {
      volumeCache.volumes = [];
    }
    return volumeCache.volumes;
  }

  if (Date.now() - volumeCache.at > VOLUME_CACHE_TTL_MS) refreshVolumesAsync();
  return volumeCache.volumes;
}

/* ---------- Temperature CPU / CPU temperature ----------
   Aucune source fiable sous Windows : la classe WMI
   MSAcpi_ThermalZoneTemperature exige des privileges administrateur et
   n'est renseignee que par une minorite de cartes meres. On renvoie
   null, ce que le widget \"Systeme\" sait deja gerer (la ligne
   temperature est simplement masquee).
   No reliable source on Windows: the MSAcpi_ThermalZoneTemperature WMI
   class requires administrator privileges and is populated by only a
   minority of motherboards. We return null, which the \"System\" widget
   already handles (the temperature row is simply hidden). */
function cpuTemperature() {
  return null;
}

/* ---------- Racine du systeme de fichiers / filesystem root ----------
   Le lecteur sur lequel l'application est installee, et non un \"C:\\\"
   code en dur : PiBoard peut parfaitement tourner depuis un autre
   lecteur. The drive the application is installed on, rather than a
   hard-coded \"C:\\\": PiBoard may perfectly well run from another
   drive. */
function filesystemRoot() {
  return path.parse(process.cwd()).root || "C:" + path.sep;
}

/* ---------- Sortie du kiosque / leaving kiosk mode ----------
   Sous Windows il n'y a ni lwrespawn ni Chromium a tuer : l'affichage
   est une fenetre Electron. Le processus principal Electron enregistre
   ses propres fonctions via platform.registerKioskController() (voir
   server/platform/index.js) ; ce module ne fait que declarer que la
   fonctionnalite n'est pas disponible tant que rien n'a ete enregistre,
   ce qui est le cas lorsque le serveur est lance seul par `npm start`
   sans Electron autour.

   On Windows there is neither lwrespawn nor Chromium to kill: the
   display is an Electron window. The Electron main process registers
   its own functions through platform.registerKioskController() (see
   server/platform/index.js); this module merely declares the feature
   unavailable while nothing has been registered, which is the case when
   the server is started on its own via `npm start` with no Electron
   around it. */
function exitKiosk() {
  return { ok: false, reason: "no-kiosk-controller" };
}

function exitToDesktop() {
  return { ok: false, reason: "no-kiosk-controller" };
}

module.exports = {
  id,
  pingArgs,
  pingSucceeded,
  parseArp,
  readArpEntries,
  parsePingHostname,
  parseVolumesJson,
  reverseLookup,
  listRemovableVolumes,
  cpuTemperature,
  filesystemRoot,
  exitKiosk,
  exitToDesktop
};
