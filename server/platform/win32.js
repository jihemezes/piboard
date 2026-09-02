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

/* ---------- Charge du GPU / GPU usage ----------

   Deux sources, dans cet ordre :

   1. `nvidia-smi` en sortie CSV -- disponible avec tout pilote NVIDIA
      recent, et la seule qui fournisse aussi la temperature et la
      memoire de la carte.
   2. Le compteur de performance Windows "GPU Engine" via PowerShell --
      universel (Intel, AMD, NVIDIA) depuis Windows 10, mais il ne donne
      QUE l'occupation. Windows publie un compteur par moteur et par
      processus : la charge de la carte est la SOMME des moteurs 3D de
      tous les processus, pas la valeur d'un compteur unique -- c'est le
      piege de cette source, et la raison pour laquelle le calcul vit
      dans une fonction pure testee.

   Le nom du compteur est passe en ANGLAIS a `Get-Counter` via
   `-Counter "\GPU Engine(*)\..."`, ce qui echouerait sur un Windows
   localise. On utilise donc l'identifiant NUMERIQUE du jeu de
   compteurs, invariable d'une langue a l'autre -- meme principe que le
   reste de ce fichier.

   Two sources, in this order:

   1. `nvidia-smi` with CSV output -- available with any recent NVIDIA
      driver, and the only one also providing the card's temperature and
      memory.
   2. Windows's "GPU Engine" performance counter through PowerShell --
      universal (Intel, AMD, NVIDIA) since Windows 10, but it gives ONLY
      occupancy. Windows publishes one counter per engine and per
      process: the card's load is the SUM of every process's 3D engines,
      not a single counter's value -- that is this source's trap, and
      why the computation lives in a tested pure function.

   The counter name would have to be passed in ENGLISH to `Get-Counter`,
   which would fail on a localised Windows. We therefore use the
   counter set's NUMERIC identifier, invariant across languages -- the
   same principle as the rest of this file. */

function parseNvidiaSmi(raw) {
  const line = String(raw || "").split(/\r?\n/).find((l) => l.trim());
  if (!line) return null;
  const cols = line.split(",").map((c) => c.trim());
  const pct = Number(cols[0]);
  if (!Number.isFinite(pct)) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const memUsed = num(cols[2]);
  const memTotal = num(cols[3]);
  return {
    percent: Math.max(0, Math.min(100, Math.round(pct))),
    tempC: num(cols[1]),
    memPercent: memTotal ? Math.round((memUsed / memTotal) * 1000) / 10 : null,
    name: cols[4] || null
  };
}

/* Entree : le JSON produit par
   Get-Counter ... | Select -Expand CounterSamples | Select Path,CookedValue
   Chaque echantillon porte un chemin du type
   "\\pc\gpu engine(pid_1234_luid_...engtype_3D)\utilization percentage".
   On additionne les moteurs 3D et Compute (ceux qui portent la charge
   utile), en ignorant Copy et VideoDecode qui gonfleraient le total
   pendant une simple lecture video.
   Input: the JSON produced by the Get-Counter pipeline above. Each
   sample carries a path like the one above. We sum the 3D and Compute
   engines (the ones carrying real work), ignoring Copy and VideoDecode
   which would inflate the total during plain video playback. */
function parseGpuCounters(raw) {
  let data;
  try { data = JSON.parse(String(raw || "")); } catch (e) { return null; }
  const samples = Array.isArray(data) ? data : [data];
  let total = 0;
  let seen = 0;
  for (const s of samples) {
    if (!s || typeof s.Path !== "string") continue;
    const path = s.Path.toLowerCase();
    if (!/engtype_(3d|compute)/.test(path)) continue;
    const v = Number(s.CookedValue);
    if (!Number.isFinite(v)) continue;
    seen++;
    total += v;
  }
  if (!seen) return null;
  // Plusieurs processus peuvent depasser 100 % cumules sur des moteurs
  // distincts : on plafonne plutot que d'afficher 137 %.
  // Several processes can exceed a cumulative 100% across distinct
  // engines: cap rather than display 137%.
  return { percent: Math.max(0, Math.min(100, Math.round(total))), tempC: null, memPercent: null, name: null };
}

const GPU_TIMEOUT_MS = 8000;
const NVIDIA_QUERY = "utilization.gpu,temperature.gpu,memory.used,memory.total,name";
/* 4142 = identifiant du jeu de compteurs "GPU Engine", identique quelle
   que soit la langue de Windows ; 4144 = "Utilization Percentage".
   4142 = the "GPU Engine" counter set id, identical whatever Windows's
   language; 4144 = "Utilization Percentage". */
const GPU_PS = "$ErrorActionPreference='Stop';" +
  "$n=(New-Object System.Diagnostics.PerformanceCounterCategory((Get-Counter -ListSet * | Where-Object {$_.CounterSetName -match 'GPU Engine|GPU-Engine|Moteur GPU'} | Select-Object -First 1).CounterSetName)).CategoryName;" +
  "(Get-Counter -Counter (\"\\\" + $n + \"(*)\\*\") -ErrorAction Stop).CounterSamples | " +
  "Select-Object Path,CookedValue | ConvertTo-Json -Compress";

function gpuUsage() {
  return new Promise((resolve) => {
    execFile("nvidia-smi", ["--query-gpu=" + NVIDIA_QUERY, "--format=csv,noheader,nounits"],
      { timeout: GPU_TIMEOUT_MS, windowsHide: true, encoding: "utf8" }, (err, stdout) => {
        const nv = err && !stdout ? null : parseNvidiaSmi(stdout);
        if (nv) return resolve(Object.assign(nv, { source: "nvidia-smi" }));
        execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", GPU_PS],
          { timeout: GPU_TIMEOUT_MS, windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
          (err2, out2) => {
            if (err2 && !out2) return resolve(null);
            const parsed = parseGpuCounters(out2);
            resolve(parsed ? Object.assign(parsed, { source: "perf-counter" }) : null);
          });
      });
  });
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

/* ---------- Mise a jour automatique / self-update ----------
   Sous Windows, c'est electron-updater qui gere les mises a jour
   (electron/updater.js) ; le mecanisme d'archive de server/selfUpdate.js
   n'a pas de sens ici (pas de tar, dossier d'installation en lecture
   seule dans l'asar, relance geree par l'installeur).
   On Windows, electron-updater handles updates (electron/updater.js);
   the archive mechanism of server/selfUpdate.js makes no sense here (no
   tar, install folder read-only inside the asar, relaunch handled by the
   installer). */
function updateSupport() {
  return { supported: false, reason: "electron-updater" };
}

function restartServer() {
  return { ok: false, reason: "not-supported" };
}

/* Sous Windows, ffmpeg n'est PAS fourni par le systeme et n'est que
   tres rarement dans le PATH -- c'est la plateforme ou la detection
   compte le plus. Les emplacements couverts correspondent aux methodes
   d'installation courantes : winget/choco (qui placent bien dans le
   PATH), une archive decompressee a la main dans C:\\ffmpeg (le cas le
   plus repandu), et les dossiers Program Files.
   On Windows, ffmpeg is NOT shipped with the system and is only very
   rarely in PATH -- this is the platform where detection matters most.
   The covered locations match the common installation methods:
   winget/choco (which do put it in PATH), an archive manually unpacked
   into C:\\ffmpeg (the most widespread case), and the Program Files
   folders. */
/* Chromium/Chrome, pour le rendu d'une page web en image cote serveur
   (voir server/webviewShot.js). Sous Windows, PiBoard tourne en
   application Electron : Chrome/Edge sont les navigateurs realistement
   presents. Edge est inclus car installe par defaut sur tout Windows
   recent -- il partage le meme moteur et les memes options de ligne de
   commande que Chrome.
   Chromium/Chrome, for server-side rendering of a web page to an image
   (see server/webviewShot.js). On Windows, PiBoard runs as an Electron
   app: Chrome/Edge are the realistically present browsers. Edge is
   included because it ships by default on every recent Windows -- it
   shares the same engine and the same command-line options as
   Chrome. */
function chromiumCandidates() {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  return [
    pf + "\\Google\\Chrome\\Application\\chrome.exe",
    pf86 + "\\Google\\Chrome\\Application\\chrome.exe",
    pf + "\\Microsoft\\Edge\\Application\\msedge.exe",
    pf86 + "\\Microsoft\\Edge\\Application\\msedge.exe",
    "chrome.exe",
    "msedge.exe"
  ].filter(Boolean);
}

function chromiumInstallHint() {
  return {
    fr: "Installez Google Chrome (ou utilisez Microsoft Edge, deja present sur Windows).",
    en: "Install Google Chrome (or use Microsoft Edge, already present on Windows)."
  };
}

function ffmpegCandidates() {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  const appData = process.env.APPDATA || "";
  return [
    // Installe via l'etape optionnelle de l'installeur PiBoard (voir
    // build/installer.nsh) : verifie en PREMIER, c'est le cas le plus
    // probable si l'utilisateur a accepte cette etape.
    // Installed via PiBoard's own optional installer step (see
    // build/installer.nsh): checked FIRST, the most likely case if the
    // user accepted that step.
    appData ? appData + "\\PiBoard\\ffmpeg\\ffmpeg.exe" : null,
    "ffmpeg.exe",
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    pf + "\\ffmpeg\\bin\\ffmpeg.exe",
    pf86 + "\\ffmpeg\\bin\\ffmpeg.exe",
    local ? local + "\\Microsoft\\WinGet\\Links\\ffmpeg.exe" : null,
    "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe"
  ].filter(Boolean);
}

function ffmpegInstallHint() {
  return { fr: "winget install Gyan.FFmpeg", en: "winget install Gyan.FFmpeg" };
}

/* vlc.exe : PAS de cvlc.exe distinct sous Windows (cvlc est un script
   shell Unix qui ajoute simplement --intf dummy a vlc -- inexistant
   ici). Le code appelant doit donc TOUJOURS passer --intf dummy
   explicitement, plutot que de compter sur un binaire "console"
   separe. Emplacement d'installation par defaut :
   %ProgramFiles%\VideoLAN\VLC\vlc.exe. Necessaire pour le relais des
   chaines en direct qu'un fournisseur IPTV rejette avec un 405 face a
   ffmpeg -- confirme par examen du lecteur de reference officiel.
   vlc.exe: NO separate cvlc.exe on Windows (cvlc is a Unix shell
   script that simply adds --intf dummy to vlc -- doesn't exist here).
   The calling code must therefore ALWAYS pass --intf dummy explicitly,
   rather than relying on a separate "console" binary. Default install
   location: %ProgramFiles%\VideoLAN\VLC\vlc.exe. Needed to relay live
   channels an IPTV provider rejects with a 405 when faced with ffmpeg
   -- confirmed by examining the official reference player. */
function vlcCandidates() {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  return [
    // Chemins absolus D'ABORD : verification par simple existence de
    // fichier, rapide et fiable (voir tryCandidate() dans
    // server/iptvVlc.js) -- couvre deja le cas le plus courant
    // (installation standard). Le nom nu vient en dernier, seulement en
    // repli : sa verification necessite de L'EXECUTER, ce qui pourrait
    // bloquer plusieurs secondes si vlc.exe tente d'ouvrir son
    // interface graphique plutot que d'afficher du texte et de se
    // terminer (rien ne le garantit, contrairement a ffmpeg).
    // Absolute paths FIRST: checked via simple file existence, fast and
    // reliable (see tryCandidate() in server/iptvVlc.js) -- already
    // covers the most common case (a standard install). The bare name
    // comes last, only as a fallback: checking it requires EXECUTING
    // it, which could hang for several seconds if vlc.exe tries to open
    // its graphical interface rather than printing text and exiting
    // (nothing guarantees this, unlike ffmpeg).
    pf + "\\VideoLAN\\VLC\\vlc.exe",
    pf86 + "\\VideoLAN\\VLC\\vlc.exe",
    "vlc.exe"
  ];
}

function vlcInstallHint() {
  return { fr: "winget install VideoLAN.VLC", en: "winget install VideoLAN.VLC" };
}


/* ---------- Configuration reseau / network configuration ----------

   On passe par `ipconfig /all` plutot que par PowerShell : la commande
   est presente sur toutes les versions de Windows, ne demande aucun
   droit particulier, et demarre instantanement la ou un lancement de
   PowerShell coute plusieurs centaines de millisecondes.

   Contrepartie : la sortie est LOCALISEE. Les etiquettes sont traduites
   dans la langue de Windows, ce qui interdit de chercher "Default
   Gateway" en dur. Le parseur ci-dessous se repere donc sur des motifs
   INDEPENDANTS DE LA LANGUE -- position, forme des valeurs, mots-cles
   communs aux localisations les plus repandues -- et laisse `null` en
   cas de doute plutot que de deviner.

   We use `ipconfig /all` rather than PowerShell: the command exists on
   every Windows version, needs no special rights, and starts instantly
   where launching PowerShell costs several hundred milliseconds.

   The trade-off: the output is LOCALISED. Labels are translated into
   Windows' language, which rules out matching a hard-coded "Default
   Gateway". The parser below therefore keys on LANGUAGE-INDEPENDENT
   patterns -- position, value shapes, keywords shared by the most common
   locales -- and leaves `null` when in doubt rather than guessing. */

const IPCONFIG_TIMEOUT_MS = 5000;

const IPV4_RE = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;

/* Mots-cles par champ, dans les localisations les plus repandues.
   Volontairement peu nombreux : mieux vaut un champ `null` qu'un champ
   faux issu d'une correspondance hasardeuse.
   Keywords per field, across the most common locales. Deliberately few:
   a `null` field beats a wrong one from a loose match. */
const KEYS = {
  gateway: /passerelle|gateway|gateway|standardgateway|puerta de enlace|gateway predefinito/i,
  dhcpOn: /dhcp\s*(activ|enabled|aktiviert|habilitado|abilitato)/i,
  dhcpServer: /serveur dhcp|dhcp server|dhcp-server|servidor dhcp|server dhcp/i,
  leaseObtained: /bail obtenu|lease obtained|lease erhalten|concesion obtenida/i,
  leaseExpires: /expiration du bail|lease expires|lease l(a|ä)uft ab|la concesion expira|scadenza/i,
  dns: /serveurs dns|dns servers|dns-server|servidores dns|server dns/i,
  suffix: /suffixe dns|dns suffix|dns-suffix|sufijo dns|suffisso dns/i,
  physical: /adresse physique|physical address|physikalische adresse|direccion fisica|indirizzo fisico/i,
  yes: /\b(oui|yes|ja|si|s(i|í))\b/i
};

/* Parseur PUR de la sortie de `ipconfig /all`. Separe de l'execution
   pour etre testable sur n'importe quelle machine, y compris Linux --
   c'est la convention deja retenue pour parseArp().
   PURE parser for `ipconfig /all` output. Separated from execution so it
   can be tested on any machine, Linux included -- the convention already
   used for parseArp(). */
function parseIpconfig(raw) {
  const text = String(raw || "");
  if (!text.trim()) return { adapters: [], domain: null };

  const lines = text.split(/\r?\n/);
  const adapters = [];
  let cur = null;
  let globalDomain = null;
  let collectingDns = false;

  for (const line of lines) {
    // Une ligne d'en-tete de carte n'est pas indentee et se termine par
    // " :" -- c'est structurel, donc valable dans toutes les langues.
    // An adapter header line is not indented and ends with " :" -- that
    // is structural, hence valid in every language.
    if (/^\S/.test(line) && /:\s*$/.test(line)) {
      const label = line.replace(/:\s*$/, "").trim();
      // La premiere section d'ipconfig est la configuration globale, pas
      // une carte : elle porte le suffixe DNS principal.
      // ipconfig's first section is the global configuration, not an
      // adapter: it carries the primary DNS suffix.
      if (/^(configuration ip|windows ip|ip-konfiguration|configuraci)/i.test(label)) {
        cur = null;
      } else {
        cur = { name: label.replace(/^(carte|adapter|adaptateur|ethernet adapter|wireless lan adapter)\s*/i, "").trim(),
                rawLabel: label, mac: null, gateway: null, dhcp: null,
                dhcpServer: null, leaseExpires: null, dns: [], domain: null, type: null };
        if (/wi-?fi|sans fil|wireless|wlan/i.test(label)) cur.type = "wifi";
        else if (/ethernet|local/i.test(label)) cur.type = "wired";
        adapters.push(cur);
      }
      collectingDns = false;
      continue;
    }

    if (!/\S/.test(line)) { collectingDns = false; continue; }

    // Ligne de continuation des serveurs DNS : indentee, sans etiquette,
    // uniquement une adresse. C'est ainsi qu'ipconfig liste le second
    // serveur, et l'ignorer perdrait la moitie de l'information.
    // DNS servers continuation line: indented, no label, just an address.
    // This is how ipconfig lists the second server, and ignoring it would
    // lose half the information.
    if (collectingDns && !line.includes(":") && IPV4_RE.test(line)) {
      if (cur) cur.dns.push(line.match(IPV4_RE)[1]);
      continue;
    }

    const sep = line.indexOf(":");
    if (sep === -1) { collectingDns = false; continue; }
    const label = line.slice(0, sep);
    const value = line.slice(sep + 1).trim();
    collectingDns = false;

    if (KEYS.suffix.test(label)) {
      const v = value.replace(/^\.+$/, "").trim();
      if (v) { if (cur) cur.domain = v; else globalDomain = v; }
      continue;
    }
    if (!cur) continue;

    if (KEYS.physical.test(label)) {
      const m = value.match(/([0-9A-F]{2}(?:[-:][0-9A-F]{2}){5})/i);
      if (m) cur.mac = m[1].replace(/-/g, ":").toLowerCase();
    } else if (KEYS.gateway.test(label)) {
      const m = value.match(IPV4_RE);
      if (m) cur.gateway = m[1];
    } else if (KEYS.dhcpServer.test(label)) {
      const m = value.match(IPV4_RE);
      if (m) cur.dhcpServer = m[1];
    } else if (KEYS.dhcpOn.test(label)) {
      cur.dhcp = KEYS.yes.test(value);
    } else if (KEYS.leaseExpires.test(label)) {
      cur.leaseExpires = value || null;
    } else if (KEYS.dns.test(label)) {
      const m = value.match(IPV4_RE);
      if (m) cur.dns.push(m[1]);
      collectingDns = true;
    }
  }

  // Une carte sans la moindre donnee exploitable n'apporte rien a la
  // fusion et encombrerait la correspondance par nom.
  // An adapter with no usable data adds nothing to the merge and would
  // clutter the name matching.
  const useful = adapters.filter((a) => a.mac || a.gateway || a.dns.length || a.dhcp != null);
  return { adapters: useful, domain: globalDomain };
}

function networkDetails() {
  return new Promise((resolve) => {
    execFile("ipconfig", ["/all"], { timeout: IPCONFIG_TIMEOUT_MS, windowsHide: true, encoding: "utf8" },
      (err, stdout) => {
        if (err && !stdout) return resolve(null);
        try { resolve(parseIpconfig(stdout)); }
        catch (e) { resolve(null); }
      });
  });
}

module.exports = {
  id,
  networkDetails,
  parseIpconfig,
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
  exitToDesktop,
  updateSupport,
  restartServer,
  gpuUsage,
  parseNvidiaSmi,
  parseGpuCounters,
  ffmpegCandidates,
  ffmpegInstallHint,
  chromiumCandidates,
  chromiumInstallHint,
  vlcCandidates,
  vlcInstallHint
};
