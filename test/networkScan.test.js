/* Test unitaire de server/networkScan.js : uniquement les fonctions
   PURES (arithmetique IP, decoupage de CIDR, parsing de la table ARP).
   Volontairement AUCUN test ne declenche un vrai ping ou une vraie
   lecture de /proc/net/arp -- ce module doit rester deterministe et
   utilisable sur n'importe quelle machine de developpement/CI, jamais
   dependant du reseau reel qui l'execute. */
"use strict";
const assert = require("assert");
const {
  isValidIp,
  ipToInt,
  intToIp,
  parseCidr,
  hostRangeFromCidr,
  parseArpTable,
  parseArpEntries,
  parseArpDarwin,
  parseDscacheutilOutput,
  vendorForMac
} = require("../server/networkScan");

console.log("== isValidIp ==");
assert.strictEqual(isValidIp("192.168.1.232"), true);
assert.strictEqual(isValidIp("0.0.0.0"), true);
assert.strictEqual(isValidIp("255.255.255.255"), true);
assert.strictEqual(isValidIp("256.1.1.1"), false, "octet > 255 rejete");
assert.strictEqual(isValidIp("192.168.1"), false, "3 octets rejetes");
assert.strictEqual(isValidIp("not-an-ip"), false);
assert.strictEqual(isValidIp(""), false);
console.log("  OK");

console.log("== ipToInt / intToIp : aller-retour ==");
for (const ip of ["0.0.0.0", "192.168.1.232", "255.255.255.255", "10.0.0.1"]) {
  assert.strictEqual(intToIp(ipToInt(ip)), ip, ip);
}
console.log("  OK");

console.log("== parseCidr : reseau/masque corrects ==");
{
  const r = parseCidr("192.168.1.0/24");
  assert.strictEqual(r.prefix, 24);
  assert.strictEqual(intToIp(r.network), "192.168.1.0");
}
{
  let threw = false;
  try { parseCidr("192.168.1.0/40"); } catch (e) { threw = true; }
  assert(threw, "prefixe invalide (>32) rejete");
}
{
  let threw = false;
  try { parseCidr("pas-un-cidr"); } catch (e) { threw = true; }
  assert(threw, "CIDR mal forme rejete");
}
console.log("  OK");

console.log("== hostRangeFromCidr : /30 -> 2 adresses hote (reseau et diffusion exclus) ==");
{
  const ips = hostRangeFromCidr("192.168.1.0/30");
  assert.deepStrictEqual(ips, ["192.168.1.1", "192.168.1.2"]);
  console.log("  OK:", JSON.stringify(ips));
}

console.log("== hostRangeFromCidr : /24 -> 254 adresses, bornes exactes ==");
{
  const ips = hostRangeFromCidr("10.0.5.0/24");
  assert.strictEqual(ips.length, 254);
  assert.strictEqual(ips[0], "10.0.5.1");
  assert.strictEqual(ips[ips.length - 1], "10.0.5.254");
  console.log("  OK: 254 adresses, de", ips[0], "a", ips[ips.length - 1]);
}

console.log("== hostRangeFromCidr : /31 -> les 2 adresses gardees (point-a-point) ==");
{
  const ips = hostRangeFromCidr("10.0.0.4/31");
  assert.deepStrictEqual(ips, ["10.0.0.4", "10.0.0.5"]);
  console.log("  OK:", JSON.stringify(ips));
}

console.log("== hostRangeFromCidr : sous-reseau trop grand refuse (> /22) ==");
{
  let threw = false;
  try { hostRangeFromCidr("10.0.0.0/8"); } catch (e) { threw = true; }
  assert(threw, "un /8 doit etre refuse (max /22)");
  console.log("  OK refuse");
}

console.log("== parseArpTable : entrees resolues (0x2) uniquement, filtrage par IP autorisee ==");
{
  const raw = [
    "IP address       HW type     Flags       HW address            Mask     Device",
    "192.168.1.5      0x1         0x2         aa:bb:cc:dd:ee:01     *        eth0",
    "192.168.1.6      0x1         0x0         00:00:00:00:00:00     *        eth0", // incomplete : flags 0x0
    "192.168.1.7      0x1         0x2         aa:bb:cc:dd:ee:03     *        eth0",
    "192.168.2.9      0x1         0x2         aa:bb:cc:dd:ee:04     *        eth0"  // hors du set autorise
  ].join("\n");
  const allowed = new Set(["192.168.1.5", "192.168.1.6", "192.168.1.7"]);
  const found = parseArpTable(raw, allowed);
  assert.deepStrictEqual(found.sort(), ["192.168.1.5", "192.168.1.7"]);
  console.log("  OK:", JSON.stringify(found));
}

console.log("== parseArpTable : entree vide/malformee sans planter ==");
{
  assert.deepStrictEqual(parseArpTable("", new Set()), []);
  assert.deepStrictEqual(parseArpTable("juste une ligne d'en-tete", new Set()), []);
  console.log("  OK");
}

console.log("== parseArpEntries : IP + MAC, meme filtrage que parseArpTable ==");
{
  const raw = [
    "IP address       HW type     Flags       HW address            Mask     Device",
    "192.168.1.5      0x1         0x2         aa:bb:cc:dd:ee:01     *        eth0",
    "192.168.1.7      0x1         0x2         aa:bb:cc:dd:ee:03     *        eth0"
  ].join("\n");
  const allowed = new Set(["192.168.1.5", "192.168.1.7"]);
  const found = parseArpEntries(raw, allowed);
  assert.deepStrictEqual(found, [
    { ip: "192.168.1.5", mac: "aa:bb:cc:dd:ee:01" },
    { ip: "192.168.1.7", mac: "aa:bb:cc:dd:ee:03" }
  ]);
  console.log("  OK:", JSON.stringify(found));
}

console.log("== vendorForMac : fabricant deduit de l'OUI (3 premiers octets) ==");
{
  assert.strictEqual(vendorForMac("3c:07:54:11:22:33"), "Apple, Inc.");
  assert.strictEqual(vendorForMac("3C-07-54-AA-BB-CC"), "Apple, Inc.", "insensible a la casse/au separateur");
  assert.strictEqual(vendorForMac("ff:ff:ff:ff:ff:ff"), null, "OUI inconnu -> null");
  assert.strictEqual(vendorForMac(null), null);
  assert.strictEqual(vendorForMac(""), null);
  console.log("  OK");
}

console.log("== parseDscacheutilOutput : format macOS (dscacheutil -q host) ==");
{
  const stdout = "name: MacBook-de-Jean-Michel.local\nip_address: 192.168.1.50\n";
  assert.strictEqual(parseDscacheutilOutput(stdout), "MacBook-de-Jean-Michel.local");
}
{
  // Plusieurs alias : on prend le premier / multiple aliases: keep the first
  const stdout = "name: imac.local\nname: imac.lan\nip_address: 192.168.1.51\n";
  assert.strictEqual(parseDscacheutilOutput(stdout), "imac.local");
}
{
  assert.strictEqual(parseDscacheutilOutput(""), null, "sortie vide -> null");
  assert.strictEqual(parseDscacheutilOutput("ip_address: 192.168.1.52\n"), null, "pas de ligne name: -> null");
}
console.log("  OK");

/* Depuis la v1.6.0, tous les parseurs ARP normalisent la MAC vers la
   forme canonique "aa:bb:cc:dd:ee:ff" (voir server/ipv4.js). Ce test
   attend donc "00:11:..." la ou `arp -an` affiche "0:11:...".
   Ce n'est pas une simple coquetterie de format : sans le zero de tete,
   vendorForMac() extrayait "011223" au lieu de "001122" comme OUI et
   renvoyait donc un fabricant faux (ou aucun) pour tout appareil dont
   le premier octet MAC est inferieur a 0x10 -- bug corrige par la
   normalisation, verifie juste apres.
   Since v1.6.0, every ARP parser normalizes the MAC to the canonical
   "aa:bb:cc:dd:ee:ff" form (see server/ipv4.js). This test therefore
   expects "00:11:..." where `arp -an` prints "0:11:...".
   This is not mere formatting tidiness: without the leading zero,
   vendorForMac() extracted "011223" instead of "001122" as the OUI and
   thus returned a wrong manufacturer (or none) for any device whose
   first MAC octet is below 0x10 -- a bug fixed by normalization and
   checked right after. */
console.log("== parseArpDarwin : format macOS/BSD (arp -an), octets MAC sans zero de tete, entrees incompletes ignorees ==");
{
  const raw = [
    "? (192.168.1.1) at 0:11:22:33:44:55 on en0 ifscope [ethernet]",
    "? (192.168.1.50) at (incomplete) on en0 ifscope [ethernet]",
    "? (192.168.1.51) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]",
    "? (192.168.2.9) at aa:bb:cc:dd:ee:00 on en0 ifscope [ethernet]" // hors du set autorise
  ].join("\n");
  const allowed = new Set(["192.168.1.1", "192.168.1.50", "192.168.1.51"]);
  const found = parseArpDarwin(raw, allowed);
  assert.deepStrictEqual(found, [
    { ip: "192.168.1.1", mac: "00:11:22:33:44:55" },
    { ip: "192.168.1.51", mac: "aa:bb:cc:dd:ee:ff" }
  ]);
  console.log("  OK:", JSON.stringify(found));
}
{
  assert.deepStrictEqual(parseArpDarwin("", new Set()), []);
  assert.deepStrictEqual(parseArpDarwin("ligne sans rapport", new Set()), []);
  console.log("  OK entree vide/malformee sans planter");
}

console.log("\n>>> TOUS LES TESTS NETWORKSCAN PASSENT");
