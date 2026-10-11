/* Test unitaire de server/trafficQuota.js : incrementation, lecture,
   remise a zero au changement de jour. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const TMP_DATA = path.join(__dirname, "..", "tmp-test-trafficquota");
fs.rmSync(TMP_DATA, { recursive: true, force: true });
process.env.PIBOARD_DATA = TMP_DATA;

const quota = require("../server/trafficQuota");

try {
  console.log("== Compteur vide au depart ==");
  const initial = quota.getToday("t-map123");
  assert.strictEqual(initial.count, 0, "compteur a 0 au depart");
  console.log("  OK:", JSON.stringify(initial));

  console.log("== Incrementation ==");
  quota.increment("t-map123", 14);
  const after1 = quota.getToday("t-map123");
  assert.strictEqual(after1.count, 14, "14 apres un premier lot de tuiles");
  quota.increment("t-map123", 14);
  quota.increment("t-map123", 1); // incidents
  const after2 = quota.getToday("t-map123");
  assert.strictEqual(after2.count, 29, "29 apres accumulation (14+14+1)");
  console.log("  OK compteur accumule correctement:", JSON.stringify(after2));

  console.log("== Isolation par tuile ==");
  quota.increment("t-other456", 5);
  assert.strictEqual(quota.getToday("t-other456").count, 5, "compteur independant pour une autre tuile");
  assert.strictEqual(quota.getToday("t-map123").count, 29, "le compteur de la premiere tuile n'est pas affecte");
  console.log("  OK isolation par tuile");

  console.log("== Remise a zero au changement de jour ==");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  quota.increment("t-yesterday", 999, yesterday);
  const stillYesterday = quota.getToday("t-yesterday", yesterday);
  assert.strictEqual(stillYesterday.count, 999, "compteur d'hier bien enregistre");
  const todayNow = quota.getToday("t-yesterday"); // sans argument = "maintenant" reel
  assert.strictEqual(todayNow.count, 0, "remise a zero automatique un nouveau jour");
  console.log("  OK remise a zero au changement de jour (hier=999, aujourd'hui=" + todayNow.count + ")");

  console.log("== Identifiant de tuile invalide rejete ==");
  let threw = false;
  try { quota.increment("../../etc/passwd", 1); } catch (e) { threw = true; }
  assert(threw, "identifiant invalide doit lever une erreur");
  console.log("  OK identifiant invalide rejete");

  console.log("\n>>> TOUS LES TESTS TRAFFICQUOTA PASSENT");
} finally {
  fs.rmSync(TMP_DATA, { recursive: true, force: true });
}
