/* ============================================================
   PiBoard - server/netConfig.js
   Configuration reseau de la machine qui execute PiBoard.

   REPARTITION DU TRAVAIL. Le socle vient de `os.networkInterfaces()`,
   identique partout : nom, adresse, masque, MAC. Tout le reste --
   passerelle, DHCP, baux, DNS, suffixe de domaine -- exige des commandes
   systeme, donc vit dans server/platform/ conformement a la regle du
   projet (aucun `process.platform` hors de ce dossier).

   ENRICHISSEMENT FACULTATIF. Si la commande systeme echoue (droits,
   binaire absent, sortie inattendue), on renvoie quand meme le socle :
   voir son adresse IP sans la passerelle vaut mieux qu'une fenetre en
   erreur. Chaque champ inconnu vaut `null`, JAMAIS une valeur inventee
   -- une passerelle fausse enverrait quelqu'un chercher une panne qui
   n'existe pas.

   Network configuration of the machine running PiBoard.

   DIVISION OF LABOUR. The base comes from `os.networkInterfaces()`,
   identical everywhere: name, address, netmask, MAC. Everything else --
   gateway, DHCP, leases, DNS, domain suffix -- needs system commands and
   therefore lives in server/platform/, per the project's rule (no
   `process.platform` test outside that folder).

   OPTIONAL ENRICHMENT. If the system command fails (permissions, missing
   binary, unexpected output), we still return the base: seeing your IP
   address without the gateway beats an error window. Every unknown field
   is `null`, NEVER an invented value -- a wrong gateway would send
   someone hunting a fault that does not exist.
   ============================================================ */
"use strict";

const os = require("os");
const platform = require("./platform");

/* ---------- Filtrage des cartes virtuelles / virtual adapter filtering ----------

   L'exigence est de ne montrer que les VRAIES cartes (WiFi et Ethernet).
   Le probleme est qu'une carte VirtualBox, VMware, Docker ou Hyper-V
   porte une adresse IP tout a fait valide : `os.networkInterfaces()` ne
   permet pas de les distinguer a lui seul.

   On combine donc trois criteres, du plus fiable au moins fiable :

   1. `internal` -- la boucle locale, ecartee sans discussion.
   2. Le PREFIXE OUI de l'adresse MAC. C'est le critere le plus solide :
      ces prefixes sont attribues aux editeurs d'hyperviseurs et ne
      peuvent pas apparaitre sur une vraie carte.
   3. Le NOM de la carte, en dernier recours et volontairement etroit.
      Un nom trop gourmand ecarterait une vraie carte : "vEthernet" est
      bien du Hyper-V, mais "veth" tout court risquerait de mordre sur
      des noms legitimes.

   The requirement is to show only REAL adapters (WiFi and Ethernet). The
   difficulty is that a VirtualBox, VMware, Docker or Hyper-V adapter
   carries a perfectly valid IP address: `os.networkInterfaces()` alone
   cannot tell them apart.

   So we combine three criteria, from most to least reliable:

   1. `internal` -- the loopback, discarded without discussion.
   2. The MAC address OUI PREFIX. This is the strongest criterion: these
      prefixes are assigned to hypervisor vendors and cannot show up on a
      real card.
   3. The adapter NAME, as a last resort and deliberately narrow. A
      greedy pattern would discard a real adapter: "vEthernet" is
      certainly Hyper-V, but a bare "veth" could bite legitimate names. */

const VIRTUAL_MAC_PREFIXES = [
  "00:05:69", "00:0c:29", "00:1c:14", "00:50:56", // VMware
  "08:00:27", "0a:00:27",                          // VirtualBox
  "00:15:5d",                                      // Hyper-V
  "00:16:3e",                                      // Xen
  "02:42:ac", "02:42:c0"                           // Docker
];

const VIRTUAL_NAME_PATTERNS = [
  /^docker\d*/i, /^br-[0-9a-f]{12}/i, /^veth[0-9a-f]/i,
  /^virbr\d*/i, /^vmnet\d*/i, /^vboxnet\d*/i,
  /vethernet/i, /virtualbox/i, /vmware/i, /hyper-?v/i,
  /^tun\d*$/i, /^tap\d*$/i, /^wg\d*$/i, /^zt[a-z0-9]{10}/i,
  /loopback/i, /^utun\d*$/i, /pseudo-?interface/i
];

function isVirtualName(name) {
  return VIRTUAL_NAME_PATTERNS.some((re) => re.test(String(name || "")));
}

function isVirtualMac(mac) {
  const m = String(mac || "").toLowerCase();
  if (!m || m === "00:00:00:00:00:00") return true;
  return VIRTUAL_MAC_PREFIXES.some((p) => m.startsWith(p));
}

/* Regroupe les adresses d'`os.networkInterfaces()` par carte. Node
   renvoie une entree PAR ADRESSE : une carte ayant une IPv4 et deux IPv6
   apparait trois fois. Une fenetre listant trois fois la meme carte
   serait illisible.
   Groups the addresses from `os.networkInterfaces()` by adapter. Node
   returns one entry PER ADDRESS: an adapter with one IPv4 and two IPv6
   shows up three times. A window listing the same adapter three times
   would be unreadable. */
function collectInterfaces(raw) {
  const all = raw || os.networkInterfaces();
  const out = [];

  for (const [name, addrs] of Object.entries(all || {})) {
    if (!Array.isArray(addrs) || !addrs.length) continue;
    if (addrs.every((a) => a.internal)) continue;
    if (isVirtualName(name)) continue;

    const mac = (addrs.find((a) => a.mac && a.mac !== "00:00:00:00:00:00") || {}).mac || null;
    if (isVirtualMac(mac)) continue;

    const v4 = addrs.find((a) => (a.family === "IPv4" || a.family === 4) && !a.internal);
    // Une carte sans adresse IPv4 n'est pas reellement connectee au
    // reseau local : c'est le critere demande ("oublie les cartes
    // virtuelles si elles ne sont pas reellement connectees"), et il
    // ecarte aussi les cartes physiques avec le cable debranche.
    // An adapter with no IPv4 address is not really connected to the
    // local network: that is the requested criterion ("ignore virtual
    // adapters unless actually connected"), and it also drops physical
    // cards with the cable unplugged.
    if (!v4) continue;

    const v6 = addrs
      .filter((a) => (a.family === "IPv6" || a.family === 6) && !a.internal && !/^fe80:/i.test(a.address))
      .map((a) => a.address);

    out.push({
      name,
      mac,
      ipv4: v4.address,
      netmask: v4.netmask || null,
      cidr: v4.cidr || null,
      ipv6: v6,
      gateway: null,
      dhcp: null,
      dhcpServer: null,
      leaseExpires: null,
      dns: [],
      domain: null,
      type: null
    });
  }

  // Tri stable et previsible : sans lui l'ordre depend de l'OS et la
  // fenetre changerait d'ordre d'un rafraichissement a l'autre.
  // Stable, predictable ordering: without it the order depends on the OS
  // and the window would reshuffle between refreshes.
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* Fusionne l'enrichissement plateforme dans le socle. La correspondance
   se fait par NOM de carte, seule cle commune entre `os` et la sortie
   des commandes systeme.
   Merges the platform enrichment into the base. Matching is done by
   adapter NAME, the only key common to `os` and the system commands'
   output. */
function mergeDetails(base, details) {
  if (!details || !Array.isArray(details.adapters)) return base;
  for (const iface of base) {
    const d = details.adapters.find((x) =>
      x.name && (x.name === iface.name ||
        // Windows nomme differemment selon l'outil : on retombe sur la
        // MAC, identifiant reellement unique.
        // Windows names adapters differently depending on the tool: we
        // fall back to the MAC, a genuinely unique identifier.
        (x.mac && iface.mac && x.mac.toLowerCase() === iface.mac.toLowerCase())));
    if (!d) continue;
    if (d.gateway) iface.gateway = d.gateway;
    if (d.dhcp != null) iface.dhcp = d.dhcp;
    if (d.dhcpServer) iface.dhcpServer = d.dhcpServer;
    if (d.leaseExpires) iface.leaseExpires = d.leaseExpires;
    if (Array.isArray(d.dns) && d.dns.length) iface.dns = d.dns;
    if (d.domain) iface.domain = d.domain;
    if (d.type) iface.type = d.type;
  }
  return base;
}

/* Devine WiFi ou filaire quand la plateforme ne l'a pas dit. Indicatif
   seulement : sert a choisir une icone, jamais a filtrer.
   Guesses WiFi or wired when the platform did not say. Indicative only:
   used to pick an icon, never to filter. */
function guessType(name) {
  return /wl|wifi|wi-fi|wlan|airport|sans.?fil/i.test(String(name || "")) ? "wifi" : "wired";
}

async function getNetworkConfig() {
  const base = collectInterfaces();

  let details = null;
  try {
    if (typeof platform.networkDetails === "function") {
      details = await platform.networkDetails();
    }
  } catch (e) {
    // Enrichissement facultatif : on journalise et on continue avec le
    // socle plutot que de faire echouer la fenetre entiere.
    // Optional enrichment: we log and carry on with the base rather than
    // failing the whole window.
    console.warn("[piboard] details reseau indisponibles:", e.message || e);
  }

  mergeDetails(base, details);
  for (const i of base) if (!i.type) i.type = guessType(i.name);

  return {
    hostname: os.hostname(),
    domain: (details && details.domain) || base.find((i) => i.domain)?.domain || null,
    adapters: base,
    partial: !details,
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  getNetworkConfig,
  _collectInterfaces: collectInterfaces,
  _mergeDetails: mergeDetails,
  _isVirtualName: isVirtualName,
  _isVirtualMac: isVirtualMac,
  _guessType: guessType
};
