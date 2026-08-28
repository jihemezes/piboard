/* Test unitaire de server/netHosts.js : uniquement les fonctions PURES
   (normalisation MAC, calcul de cle, table d'alias, application au
   resultat d'un scan). Aucun test ne touche au disque -- loadAliases /
   saveAliases passent par server/store.js. */
"use strict";
const assert = require("assert");
const {
  normalizeMac,
  normalizeName,
  hostKey,
  sanitizeAliases,
  setAlias,
  removeAlias,
  trimAliases,
  applyAliases,
  MAX_NAME_LENGTH,
  MAX_ENTRIES
} = require("../server/netHosts");

console.log("== normalizeMac : casse, separateurs, zeros de tete ==");
assert.strictEqual(normalizeMac("AA:BB:CC:DD:EE:FF"), "aa:bb:cc:dd:ee:ff");
assert.strictEqual(normalizeMac("aa-bb-cc-dd-ee-ff"), "aa:bb:cc:dd:ee:ff", "separateur Windows");
assert.strictEqual(normalizeMac("a:1b:c:dd:ee:f"), "0a:1b:0c:dd:ee:0f", "macOS omet les zeros de tete");
assert.strictEqual(normalizeMac("  aa:bb:cc:dd:ee:ff  "), "aa:bb:cc:dd:ee:ff");
assert.strictEqual(normalizeMac("00:00:00:00:00:00"), null, "MAC nulle = entree ARP incomplete");
assert.strictEqual(normalizeMac("aa:bb:cc:dd:ee"), null, "trop court");
assert.strictEqual(normalizeMac("zz:bb:cc:dd:ee:ff"), null, "non hexadecimal");
assert.strictEqual(normalizeMac(null), null);
assert.strictEqual(normalizeMac(""), null);
console.log("  OK");

console.log("== normalizeName : espaces et longueur ==");
assert.strictEqual(normalizeName("  Imprimante   bureau "), "Imprimante bureau");
assert.strictEqual(normalizeName(""), "");
assert.strictEqual(normalizeName(null), "");
assert.strictEqual(normalizeName("   "), "");
assert.strictEqual(normalizeName("x".repeat(200)).length, MAX_NAME_LENGTH);
console.log("  OK");

console.log("== hostKey : MAC prioritaire, repli sur l'IP ==");
assert.strictEqual(hostKey({ ip: "192.168.1.5", mac: "AA-BB-CC-DD-EE-FF" }), "mac:aa:bb:cc:dd:ee:ff");
assert.strictEqual(hostKey({ ip: "192.168.1.5", mac: null }), "ip:192.168.1.5");
assert.strictEqual(hostKey({ ip: "192.168.1.5", mac: "00:00:00:00:00:00" }), "ip:192.168.1.5");
assert.strictEqual(hostKey({ ip: "pas-une-ip", mac: null }), null);
assert.strictEqual(hostKey(null), null);
console.log("  OK");

console.log("== hostKey : la cle survit a un changement d'IP (bail DHCP) ==");
{
  const before = hostKey({ ip: "192.168.1.42", mac: "aa:bb:cc:dd:ee:ff" });
  const after = hostKey({ ip: "192.168.1.77", mac: "AA:BB:CC:DD:EE:FF" });
  assert.strictEqual(before, after, "meme appareil, meme cle malgre une IP differente");
}
console.log("  OK");

console.log("== setAlias / removeAlias ==");
{
  const a1 = setAlias({}, "mac:aa:bb:cc:dd:ee:ff", "  Imprimante  ", "2026-01-01T00:00:00.000Z");
  assert.strictEqual(a1["mac:aa:bb:cc:dd:ee:ff"].name, "Imprimante");
  assert.strictEqual(a1["mac:aa:bb:cc:dd:ee:ff"].updatedAt, "2026-01-01T00:00:00.000Z");

  const a2 = setAlias(a1, "mac:aa:bb:cc:dd:ee:ff", "Imprimante bureau", "2026-02-01T00:00:00.000Z");
  assert.strictEqual(Object.keys(a2).length, 1, "remplacement, pas doublon");
  assert.strictEqual(a2["mac:aa:bb:cc:dd:ee:ff"].name, "Imprimante bureau");

  const a3 = setAlias(a2, "mac:aa:bb:cc:dd:ee:ff", "   ");
  assert.strictEqual(a3["mac:aa:bb:cc:dd:ee:ff"], undefined, "nom vide = suppression");

  assert.strictEqual(Object.keys(a1).length, 1, "les tables d'entree ne sont jamais mutees");
  assert.strictEqual(removeAlias(a2, "mac:aa:bb:cc:dd:ee:ff")["mac:aa:bb:cc:dd:ee:ff"], undefined);
}
console.log("  OK");

console.log("== sanitizeAliases : rejette les cles et valeurs douteuses ==");
{
  const clean = sanitizeAliases({
    "mac:aa:bb:cc:dd:ee:ff": { name: "Salon", updatedAt: "2026-01-01T00:00:00.000Z" },
    "ip:192.168.1.9": { name: "Chaudiere" },
    "mac:pas-une-mac": { name: "X" },
    "../../etc/passwd": { name: "X" },
    "ip:192.168.1.10": { name: "   " },
    "ip:192.168.1.11": null
  });
  assert.deepStrictEqual(Object.keys(clean).sort(), ["ip:192.168.1.9", "mac:aa:bb:cc:dd:ee:ff"]);
  assert.strictEqual(clean["ip:192.168.1.9"].updatedAt, null);
}
console.log("  OK");

console.log("== trimAliases : garde les entrees les plus recentes ==");
{
  const many = {};
  for (let i = 0; i < MAX_ENTRIES + 10; i++) {
    many["ip:10.0.0." + i] = { name: "h" + i, updatedAt: "2026-01-01T00:00:" + String(i % 60).padStart(2, "0") + ".000Z" };
  }
  const trimmed = trimAliases(many);
  assert.strictEqual(Object.keys(trimmed).length, MAX_ENTRIES);
}
console.log("  OK");

console.log("== applyAliases : enrichit sans ecraser le nom detecte ==");
{
  const hosts = [
    { ip: "192.168.1.5", hostname: "DESKTOP-4K7J1QA", mac: "AA:BB:CC:DD:EE:FF", isSelf: false, vendor: null },
    { ip: "192.168.1.9", hostname: null, mac: null, isSelf: false, vendor: "Espressif" },
    { ip: "192.168.1.1", hostname: "livebox", mac: "11:22:33:44:55:66", isSelf: false, vendor: null }
  ];
  const aliases = {
    "mac:aa:bb:cc:dd:ee:ff": { name: "PC salon", updatedAt: null },
    "ip:192.168.1.9": { name: "Chaudiere", updatedAt: null }
  };
  const out = applyAliases(hosts, aliases);
  assert.strictEqual(out[0].alias, "PC salon");
  assert.strictEqual(out[0].hostname, "DESKTOP-4K7J1QA", "le nom detecte reste disponible");
  assert.strictEqual(out[0].key, "mac:aa:bb:cc:dd:ee:ff");
  assert.strictEqual(out[1].alias, "Chaudiere", "repli sur l'IP quand la MAC est inconnue");
  assert.strictEqual(out[2].alias, null, "aucun alias enregistre");
  assert.strictEqual(hosts[0].alias, undefined, "la liste d'entree n'est pas mutee");
  assert.deepStrictEqual(applyAliases(null, aliases), []);
  assert.strictEqual(applyAliases(hosts, null)[0].alias, null);
}
console.log("  OK");

console.log("Tous les tests netHosts sont passes.");
