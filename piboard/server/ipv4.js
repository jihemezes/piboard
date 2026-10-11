/* ============================================================
   PiBoard - server/ipv4.js
   Aides IPv4 pures (validation, conversions entier <-> texte),
   extraites de server/networkScan.js pour etre partagees avec les
   modules server/platform/* sans creer de dependance circulaire :
   networkScan a besoin de la plateforme, et les parseurs ARP de chaque
   plateforme ont besoin de valider les adresses qu'ils extraient.
   Aucune de ces fonctions ne touche au systeme : elles restent
   entierement testables et identiques sur toutes les plateformes.

   Pure IPv4 helpers (validation, integer <-> text conversions),
   extracted from server/networkScan.js to be shared with the
   server/platform/* modules without creating a circular dependency:
   networkScan needs the platform layer, and each platform's ARP parser
   needs to validate the addresses it extracts. None of these functions
   touch the system: they stay entirely testable and identical on every
   platform.
   ============================================================ */
"use strict";

function isValidIp(ip) {
  if (typeof ip !== "string") return false;
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function ipToInt(ip) {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/* Normalise une adresse MAC vers la forme "aa:bb:cc:dd:ee:ff" quel que
   soit le separateur d'origine (":" sous Linux/macOS, "-" sous Windows)
   et quelle que soit la casse. Les octets sans zero de tete produits
   par le `arp -an` de macOS ("0:11:...") sont completes.
   Normalizes a MAC address to the "aa:bb:cc:dd:ee:ff" form whatever the
   original separator (":" on Linux/macOS, "-" on Windows) and whatever
   the case. Octets without a leading zero, as produced by macOS's
   `arp -an` ("0:11:..."), are padded. */
function normalizeMac(mac) {
  if (typeof mac !== "string") return null;
  const parts = mac.trim().split(/[:-]/);
  if (parts.length !== 6) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(part)) return null;
    octets.push(part.toLowerCase().padStart(2, "0"));
  }
  return octets.join(":");
}

/* Adresse MAC de diffusion ou de multidiffusion : ces entrees existent
   dans la table ARP de Windows (255.255.255.255, plage 224.x) mais ne
   correspondent a aucun appareil reel du reseau.
   Broadcast or multicast MAC address: such entries exist in Windows's
   ARP table (255.255.255.255, the 224.x range) but match no real device
   on the network. */
function isBroadcastOrMulticastMac(mac) {
  const norm = normalizeMac(mac);
  if (!norm) return false;
  if (norm === "ff:ff:ff:ff:ff:ff") return true;
  // Bit de poids faible du premier octet a 1 = adresse de groupe
  // Least-significant bit of the first octet set to 1 = group address
  return (parseInt(norm.slice(0, 2), 16) & 1) === 1;
}

module.exports = {
  isValidIp,
  ipToInt,
  intToIp,
  normalizeMac,
  isBroadcastOrMulticastMac
};
