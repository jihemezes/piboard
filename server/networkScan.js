/* ============================================================
   PiBoard - server/networkScan.js
   Balayage du reseau local (widget "Analyse reseau") : trouve les hotes
   actifs du sous-reseau du Pi et tente de resoudre un nom lisible pour
   chacun. Deux techniques combinees, comme le fait `nmap -sn` :
     1. Ping (ICMP) de chaque adresse du sous-reseau -- concurrence
        limitee pour rester raisonnable sur un Raspberry Pi.
     2. Lecture de la table ARP du systeme juste apres :
        un hote dont le pare-feu bloque l'ICMP repond quand meme a la
        resolution ARP (necessaire au routage L2), donc cette etape
        rattrape des hotes que le ping seul manquerait.
   Aucune donnee ne quitte le reseau local ; toute commande systeme est
   invoquee via execFile() avec un tableau d'arguments (jamais de shell),
   et chaque adresse IP est validee avant tout appel.
   Scans the local network (the "Network scan" widget): finds active
   hosts on the Pi's subnet and tries to resolve a readable name for
   each. Two techniques combined, like `nmap -sn` does:
     1. Ping (ICMP) every address in the subnet -- limited concurrency
        to stay reasonable on a Raspberry Pi.
     2. Read the system's ARP table right after: a host
        whose firewall blocks ICMP still answers ARP resolution (needed
        for L2 routing), so this step catches hosts a ping-only sweep
        would miss.
   No data ever leaves the local network; every system command is
   invoked via execFile() with an argument array (never a shell), and
   every IP address is validated before any call.
   ============================================================ */
"use strict";

const os = require("os");
const dns = require("dns");
const dgram = require("dgram");
const { execFile } = require("child_process");
const ouiData = require("oui-data");
const platform = require("./platform");
const { isValidIp, ipToInt, intToIp } = require("./ipv4");

/* Deduit le fabricant d'une adresse MAC via les 3 premiers octets
   (OUI, base IEEE embarquee par le paquet oui-data). N'est utilise
   qu'en repli, quand aucun nom d'hote n'a pu etre resolu (voir
   performScan) -- ca ne remplace jamais un vrai nom d'hote, ca donne
   juste une piste ("Hote inconnu (Samsung Electronics)" plutot que
   "Hote inconnu" tout court) pour les appareils qui ne repondent a
   aucune technique de resolution de nom (la plupart des telephones
   Android, Windows sans Bonjour, objets connectes...).
   Deduces a MAC address's manufacturer from its first 3 octets (OUI,
   IEEE database bundled via the oui-data package). Only used as a
   fallback, when no hostname could be resolved at all (see
   performScan) -- it never replaces a real hostname, it just gives a
   hint ("Unknown host (Samsung Electronics)" rather than a bare
   "Unknown host") for devices that don't answer any name-resolution
   technique (most Android phones, Windows without Bonjour, IoT
   gadgets...). */
function vendorForMac(mac) {
  if (!mac || typeof mac !== "string") return null;
  const prefix = mac.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
  if (prefix.length !== 6) return null;
  const entry = ouiData[prefix];
  if (!entry) return null;
  // La 1re ligne de l'entree est le nom du fabricant, le reste est une
  // adresse postale qui ne nous interesse pas ici.
  // The entry's 1st line is the manufacturer name, the rest is a
  // postal address we don't care about here.
  return String(entry).split("\n")[0].trim() || null;
}

const PING_TIMEOUT_SEC = 1;
const PING_CONCURRENCY = 32;
const REVERSE_DNS_TIMEOUT_MS = 1500;
/* Garde-fou : au-dela d'un /22 (1024 adresses), une analyse deviendrait
   trop longue pour un usage tableau de bord. Safety net: beyond a /22
   (1024 addresses), a scan would take too long for a dashboard. */
const MAX_HOSTS = 1024;

/* ---------- Arithmetique IPv4 / IPv4 arithmetic ----------
   isValidIp / ipToInt / intToIp vivent desormais dans server/ipv4.js,
   partages avec les parseurs ARP de server/platform/*. Ils restent
   reexportes par ce module pour ne pas casser les appelants existants
   ni les tests unitaires.
   isValidIp / ipToInt / intToIp now live in server/ipv4.js, shared with
   the ARP parsers in server/platform/*. They stay re-exported by this
   module so existing callers and unit tests do not break. */

/* "192.168.1.0/24" -> { network, prefix, maskInt } */
function parseCidr(cidr) {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(String(cidr || "").trim());
  if (!m || !isValidIp(m[1])) throw new Error("invalid CIDR");
  const prefix = Number(m[2]);
  if (prefix < 1 || prefix > 32) throw new Error("invalid CIDR prefix");
  const maskInt = prefix === 32 ? 0xFFFFFFFF : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const network = ipToInt(m[1]) & maskInt;
  return { network: network >>> 0, prefix, maskInt };
}

/* Liste des adresses hote d'un CIDR (reseau et diffusion exclus, sauf
   pour /31 et /32 ou tout est garde). Rejette les sous-reseaux trop
   grands (voir MAX_HOSTS). List of a CIDR's host addresses (network and
   broadcast excluded, except for /31 and /32 where everything is kept).
   Rejects subnets that are too large (see MAX_HOSTS). */
function hostRangeFromCidr(cidr) {
  const { network, prefix, maskInt } = parseCidr(cidr);
  const hostBits = 32 - prefix;
  const size = Math.pow(2, hostBits);
  if (size > MAX_HOSTS) throw new Error("subnet too large (max /22, 1024 addresses)");
  if (hostBits <= 1) {
    const list = [];
    for (let i = 0; i < size; i++) list.push(intToIp((network + i) >>> 0));
    return list;
  }
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const list = [];
  for (let n = network + 1; n < broadcast; n++) list.push(intToIp(n >>> 0));
  return list;
}

/* ---------- Detection du sous-reseau local / local subnet detection ---------- */

/* Interfaces IPv4 non internes actuellement actives sur le Pi.
   Currently active, non-internal IPv4 interfaces on the Pi. */
function detectSubnets() {
  const ifaces = os.networkInterfaces();
  const subnets = [];
  for (const name of Object.keys(ifaces)) {
    for (const addr of ifaces[name] || []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      subnets.push({
        iface: name,
        address: addr.address,
        netmask: addr.netmask,
        cidr: addr.cidr || null
      });
    }
  }
  return subnets;
}

function defaultCidr() {
  const subnets = detectSubnets();
  if (!subnets.length) return null;
  const s = subnets[0];
  return s.cidr; // fourni directement par Node (>=18) / provided directly by Node (>=18)
}

/* Adresse locale que le systeme utiliserait pour joindre l'exterieur.
   On "connecte" une socket UDP a une adresse publique quelconque :
   UDP etant sans connexion, AUCUN paquet n'est emis -- le noyau se
   contente de consulter sa table de routage et d'attribuer a la socket
   l'adresse locale de l'interface qui porte la route par defaut. C'est
   instantane, sans effet de bord reseau, et portable.

   POURQUOI : detectSubnets() renvoie les interfaces dans l'ordre du
   systeme, et prendre la premiere suffisait sur le Pi. Sur un PC
   Windows de developpement, les adaptateurs virtuels (WSL, Hyper-V,
   VirtualBox, VPN...) apparaissent souvent AVANT la vraie carte
   reseau : l'analyse partirait alors balayer un sous-reseau virtuel
   vide au lieu du reseau domestique. Ce reperage evite ce piege, et
   beneficie aussi au Pi lorsque docker0 ou une interface VPN est
   presente.

   Local address the system would use to reach the outside world. We
   "connect" a UDP socket to an arbitrary public address: UDP being
   connectionless, NO packet is ever sent -- the kernel merely consults
   its routing table and assigns the socket the local address of the
   interface carrying the default route. It is instant, has no network
   side effect, and is portable.

   WHY: detectSubnets() returns interfaces in system order, and taking
   the first one was enough on the Pi. On a Windows development PC,
   virtual adapters (WSL, Hyper-V, VirtualBox, VPN...) often appear
   BEFORE the real network card: the scan would then sweep an empty
   virtual subnet instead of the home network. This detection avoids
   that pitfall, and also helps the Pi when docker0 or a VPN interface
   is present. */
function preferredLocalAddress() {
  return new Promise((resolve) => {
    let socket;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      try { if (socket) socket.close(); } catch (e) { /* deja fermee / already closed */ }
      resolve(value);
    };
    try {
      socket = dgram.createSocket("udp4");
      socket.on("error", () => finish(null));
      // 192.0.2.1 : plage TEST-NET-1 (RFC 5737), reservee a la
      // documentation et jamais routee vers un hote reel.
      // 192.0.2.1: TEST-NET-1 range (RFC 5737), reserved for
      // documentation and never routed to a real host.
      socket.connect(53, "192.0.2.1", () => {
        try {
          finish(socket.address().address || null);
        } catch (e) {
          finish(null);
        }
      });
    } catch (e) {
      finish(null);
    }
  });
}

/* Sous-reseau a analyser par defaut : celui de l'interface qui porte la
   route par defaut, avec repli sur la premiere interface trouvee.
   Default subnet to scan: the one on the interface carrying the default
   route, falling back to the first interface found. */
async function preferredCidr() {
  const subnets = detectSubnets();
  if (!subnets.length) return null;
  const address = await preferredLocalAddress();
  if (address) {
    const match = subnets.find((s) => s.address === address && s.cidr);
    if (match) return match.cidr;
  }
  return defaultCidr();
}

/* ---------- Ping (ICMP) ----------
   Les arguments de `ping` ET l'interpretation de son resultat sont
   delegues a la couche plateforme : Linux compte en secondes (-W),
   Windows en millisecondes (-w), et surtout Windows renvoie un code de
   sortie nul meme pour un "hote inaccessible" (voir la note detaillee
   dans server/platform/win32.js).
   Both `ping`'s arguments AND the interpretation of its result are
   delegated to the platform layer: Linux counts in seconds (-W),
   Windows in milliseconds (-w), and above all Windows returns a zero
   exit code even for a "host unreachable" (see the detailed note in
   server/platform/win32.js). */

function pingHost(ip) {
  return new Promise((resolve) => {
    if (!isValidIp(ip)) return resolve(false);
    execFile(
      "ping",
      platform.pingArgs(ip, PING_TIMEOUT_SEC),
      { timeout: (PING_TIMEOUT_SEC + 1) * 1000, windowsHide: true },
      (err, stdout) => resolve(platform.pingSucceeded(err, stdout))
    );
  });
}

/* ---------- Table ARP du systeme / system ARP table ----------
   La lecture et l'analyse de la table ARP sont entierement deleguees a
   la couche plateforme : /proc/net/arp sous Linux, `arp -a` sous
   Windows, `arp -an` sous macOS -- trois formats differents, trois
   parseurs, un seul appel ici.

   Les fonctions parseArp* restent exportees par ce module, en simples
   passe-plats vers l'implementation correspondante, afin que les tests
   unitaires existants continuent de fonctionner a l'identique et
   puissent verifier les trois parseurs quelle que soit la machine qui
   execute la suite.

   Reading and parsing the ARP table is entirely delegated to the
   platform layer: /proc/net/arp on Linux, `arp -a` on Windows,
   `arp -an` on macOS -- three different formats, three parsers, a
   single call here.
   The parseArp* functions stay exported by this module, as thin
   pass-throughs to the matching implementation, so existing unit tests
   keep working identically and can check all three parsers whatever
   machine runs the suite. */

function readArpEntries(allowedIps) {
  return platform.readArpEntries(allowedIps, REVERSE_DNS_TIMEOUT_MS);
}

function parseArpEntries(raw, allowedIps) {
  return platform.implementations.linux().parseArp(raw, allowedIps);
}

function parseArpTable(raw, allowedIps) {
  return parseArpEntries(raw, allowedIps).map((e) => e.ip);
}

function parseArpDarwin(raw, allowedIps) {
  return platform.implementations.darwin().parseArp(raw, allowedIps);
}

function parseArpWin32(raw, allowedIps) {
  return platform.implementations.win32().parseArp(raw, allowedIps);
}


/* ---------- Resolution de nom inverse / reverse name lookup ----------
   Deux techniques enchainees :
     1. La resolution du SYSTEME, deleguee a la couche plateforme
        (`getent hosts` sous Linux, `dscacheutil` sous macOS, `ping -a`
        sous Windows). C'est la seule facon d'obtenir les noms ".local"
        des autres machines du reseau, le routeur domestique ne servant
        aucun enregistrement PTR pour ses baux DHCP.
     2. dns.reverse() de Node en repli -- une requete PTR classique vers
        les serveurs DNS configures. Utile uniquement sur les reseaux
        disposant d'une vraie zone inverse (reseau d'entreprise, DNS
        interne...), presque jamais sur une box grand public.
        IMPORTANT : dns.reverse() ignore completement mDNS sur toutes
        les plateformes -- elle ne peut jamais se substituer a l'etape 1
        pour les noms ".local".

   Two chained techniques:
     1. The SYSTEM resolver, delegated to the platform layer (`getent
        hosts` on Linux, `dscacheutil` on macOS, `ping -a` on Windows).
        This is the only way to get other LAN machines' ".local" names,
        since the home router serves no PTR record for its DHCP leases.
     2. Node's dns.reverse() as a fallback -- a classic PTR lookup
        against the configured DNS servers. Only useful on networks with
        a real reverse zone (corporate LAN, internal DNS...), almost
        never on a consumer router. IMPORTANT: dns.reverse() completely
        ignores mDNS on every platform -- it can never substitute for
        step 1 when it comes to ".local" names. */

function reverseLookupSystem(ip) {
  return platform.reverseLookup(ip, REVERSE_DNS_TIMEOUT_MS);
}

function parseDscacheutilOutput(stdout) {
  return platform.implementations.darwin().parseDscacheutilOutput(stdout);
}

function parsePingHostname(stdout, ip) {
  return platform.implementations.win32().parsePingHostname(stdout, ip);
}


function reverseLookupDns(ip) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, REVERSE_DNS_TIMEOUT_MS);
    dns.reverse(ip, (err, hostnames) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err || !hostnames || !hostnames.length) return resolve(null);
      resolve(hostnames[0].replace(/\.$/, ""));
    });
  });
}

async function reverseLookup(ip) {
  const viaSystem = await reverseLookupSystem(ip);
  if (viaSystem) return viaSystem;
  return reverseLookupDns(ip);
}

/* ---------- Execution en parallele limitee / bounded-concurrency runner ---------- */

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

/* ---------- Scan complet / full scan ---------- */

async function performScan(cidrOverride) {
  const cidr = (cidrOverride && String(cidrOverride).trim()) || (await preferredCidr());
  if (!cidr) throw new Error("no local IPv4 network interface found");
  const ips = hostRangeFromCidr(cidr);
  const ipSet = new Set(ips);

  const selfAddrs = new Set(detectSubnets().map((s) => s.address));

  const aliveFromPing = [];
  await mapWithConcurrency(ips, PING_CONCURRENCY, async (ip) => {
    if (await pingHost(ip)) aliveFromPing.push(ip);
  });

  // La table ARP est lue APRES le ping : le sweep vient de forcer une
  // resolution ARP pour chaque adresse tentee, y compris celles dont le
  // pare-feu bloque l'ICMP -- c'est ce qui les rattrape ici.
  // The ARP table is read AFTER the ping sweep: it just forced ARP
  // resolution for every address attempted, including ones whose
  // firewall blocks ICMP -- this is what catches them here.
  const arpEntries = await readArpEntries(ipSet);
  const aliveFromArp = arpEntries.map((e) => e.ip);
  const macByIp = new Map(arpEntries.map((e) => [e.ip, e.mac]));

  const aliveSet = new Set([...aliveFromPing, ...aliveFromArp]);
  const alive = Array.from(aliveSet).sort((a, b) => ipToInt(a) - ipToInt(b));

  const hosts = await mapWithConcurrency(alive, PING_CONCURRENCY, async (ip) => {
    const isSelf = selfAddrs.has(ip);
    const hostname = isSelf ? os.hostname() : await reverseLookup(ip);
    // Fabricant deduit de la MAC, uniquement pour completer un nom
    // absent -- jamais affiche a cote d'un vrai nom d'hote.
    // Vendor deduced from the MAC, only to complement a missing name
    // -- never shown alongside a real hostname.
    const vendor = !hostname && !isSelf ? vendorForMac(macByIp.get(ip)) : null;
    return { ip, hostname, isSelf, vendor };
  });

  return { cidr, hosts, scannedAt: new Date().toISOString(), addressCount: ips.length };
}

/* ---------- Etat partage / cache + verrou anti-scans concurrents ----------
   Meme principe que le verrou "refreshing" de la tuile Trafic : deux
   requetes qui arrivent pendant qu'un scan tourne deja se partagent la
   MEME promesse plutot que de lancer un second sweep en parallele (qui
   doublerait inutilement le trafic ICMP sur le reseau).
   Same principle as the Traffic tile's "refreshing" lock: two requests
   arriving while a scan is already running share the SAME promise
   rather than starting a second sweep in parallel (which would
   needlessly double the ICMP traffic on the network). */
const state = { scanning: false, lastResult: null, lastError: null, inFlight: null };

function scanNetwork(cidrOverride) {
  if (state.inFlight) return state.inFlight;
  state.scanning = true;
  const p = performScan(cidrOverride)
    .then((result) => {
      state.lastResult = result;
      state.lastError = null;
      return result;
    })
    .catch((e) => {
      state.lastError = String(e.message || e);
      throw e;
    })
    .finally(() => {
      state.scanning = false;
      state.inFlight = null;
    });
  state.inFlight = p;
  return p;
}

function getState() {
  return { scanning: state.scanning, result: state.lastResult, error: state.lastError };
}

module.exports = {
  scanNetwork,
  getState,
  detectSubnets,
  defaultCidr,
  preferredCidr,
  parseCidr,
  hostRangeFromCidr,
  parseArpTable,
  parseArpEntries,
  parseArpDarwin,
  parseArpWin32,
  parseDscacheutilOutput,
  parsePingHostname,
  vendorForMac,
  isValidIp,
  ipToInt,
  intToIp
};
