/* Test unitaire de server/tileConfigs.js : uniquement les fonctions
   PURES (validation, upsert/remove en memoire). Aucun test ne touche
   au disque -- saveConfig/deleteConfig/listConfigs passent par
   server/store.js (deja simple et non teste ici a part). */
"use strict";
const assert = require("assert");
const {
  isValidWidgetId,
  normalizeTitle,
  upsertConfig,
  removeConfig,
  MAX_ENTRIES_PER_WIDGET,
  MAX_TITLE_LENGTH
} = require("../server/tileConfigs");

console.log("== isValidWidgetId ==");
assert.strictEqual(isValidWidgetId("webview"), true);
assert.strictEqual(isValidWidgetId("network-scan_2"), true);
assert.strictEqual(isValidWidgetId(""), false);
assert.strictEqual(isValidWidgetId("../../etc/passwd"), false, "traversee de chemin rejetee");
assert.strictEqual(isValidWidgetId("webview/x"), false);
assert.strictEqual(isValidWidgetId(null), false);
assert.strictEqual(isValidWidgetId("a".repeat(41)), false, "trop long");
console.log("  OK");

console.log("== normalizeTitle : espaces et longueur ==");
assert.strictEqual(normalizeTitle("  Trafic Toulouse  "), "Trafic Toulouse");
assert.strictEqual(normalizeTitle(""), "");
assert.strictEqual(normalizeTitle(null), "");
assert.strictEqual(normalizeTitle("x".repeat(100)).length, MAX_TITLE_LENGTH);
console.log("  OK");

console.log("== upsertConfig : remplace une entree existante du meme titre ==");
{
  const list = [
    { title: "Trafic Toulouse", settings: { url: "http://old" }, savedAt: "2026-01-01T00:00:00.000Z" }
  ];
  const next = upsertConfig(list, { title: "Trafic Toulouse", settings: { url: "http://new" }, savedAt: "2026-02-01T00:00:00.000Z" });
  assert.strictEqual(next.length, 1);
  assert.strictEqual(next[0].settings.url, "http://new");
}
console.log("  OK");

console.log("== upsertConfig : ajoute en tete sans toucher les autres titres ==");
{
  const list = [{ title: "A", settings: {}, savedAt: "t1" }];
  const next = upsertConfig(list, { title: "B", settings: {}, savedAt: "t2" });
  assert.deepStrictEqual(next.map((e) => e.title), ["B", "A"]);
}
console.log("  OK");

console.log("== upsertConfig : garde-fou MAX_ENTRIES_PER_WIDGET (ecarte les plus anciennes) ==");
{
  let list = [];
  for (let i = 0; i < MAX_ENTRIES_PER_WIDGET + 5; i++) {
    list = upsertConfig(list, { title: "cfg-" + i, settings: {}, savedAt: "t" + i });
  }
  assert.strictEqual(list.length, MAX_ENTRIES_PER_WIDGET);
  // Les plus recentes (derniers ajouts) doivent etre gardees, en tete
  assert.strictEqual(list[0].title, "cfg-" + (MAX_ENTRIES_PER_WIDGET + 4));
}
console.log("  OK");

console.log("== removeConfig : retire uniquement l'entree visee ==");
{
  const list = [
    { title: "A", settings: {}, savedAt: "t1" },
    { title: "B", settings: {}, savedAt: "t2" }
  ];
  const next = removeConfig(list, "A");
  assert.deepStrictEqual(next.map((e) => e.title), ["B"]);
}
{
  assert.deepStrictEqual(removeConfig([], "A"), []);
  assert.deepStrictEqual(removeConfig(null, "A"), []);
}
console.log("  OK");

console.log("\n>>> TOUS LES TESTS TILECONFIGS PASSENT");
