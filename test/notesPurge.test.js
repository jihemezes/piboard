/* Disparition des elements coches du Bloc-notes (1.159.0).
   Fonctions pures : dates de cochage, echeances, retrait, archive ;
   plus la coherence manifeste / i18n / CSS.
   Notes tile, auto-removal of checked items (1.159.0): pure helpers and
   manifest / i18n / CSS consistency. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const dir = path.join(__dirname, "../public/widgets/notes");
const js = fs.readFileSync(path.join(dir, "widget.js"), "utf8");
const css = fs.readFileSync(path.join(dir, "widget.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const i18n = fs.readFileSync(path.join(__dirname, "../public/i18n.js"), "utf8");
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }

let N = null;
const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "notes") N = k; } } }, console, document: undefined, ResizeObserver: undefined };
vm.createContext(sb);
vm.runInContext(js, sb);
const H = 3600 * 1000, D = 24 * H;
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0, 0, 0).getTime();

console.log("== Bloc-notes : reglage de disparition ==");
test("normPurge : valeurs par defaut et bornes", () => {
  assert.deepStrictEqual({ ...N._normPurge() }, { mode: "off", n: 1 });
  assert.deepStrictEqual({ ...N._normPurge({ mode: "bidon", n: 5 }) }, { mode: "off", n: 5 });
  assert.strictEqual(N._normPurge({ mode: "hours", n: 9999 }).n, 168);
  assert.strictEqual(N._normPurge({ mode: "days", n: 9999 }).n, 365);
  assert.strictEqual(N._normPurge({ mode: "days", n: -3 }).n, 1);
  assert.strictEqual(N._normPurge({ mode: "days", n: "abc" }).n, 1);
});

test("dueAt : aussitot (court delai de rattrapage)", () => {
  const t = at(2026, 10, 18, 17, 0);
  assert.strictEqual(N._dueAt({ mode: "now" }, t), t + N._NOW_GRACE_MS);
  assert.ok(N._NOW_GRACE_MS >= 1000 && N._NOW_GRACE_MS <= 3000);
});
test("dueAt : minuit = minuit SUIVANT, y compris juste avant et juste apres", () => {
  const t = at(2026, 10, 18, 17, 0);
  assert.strictEqual(N._dueAt({ mode: "midnight" }, t), at(2026, 10, 19, 0, 0));
  assert.strictEqual(N._dueAt({ mode: "midnight" }, at(2026, 10, 18, 23, 59)), at(2026, 10, 19, 0, 0));
  assert.strictEqual(N._dueAt({ mode: "midnight" }, at(2026, 10, 19, 0, 0)), at(2026, 10, 20, 0, 0));
});
test("dueAt : heures, jours, jamais", () => {
  const t = at(2026, 10, 18, 17, 0);
  assert.strictEqual(N._dueAt({ mode: "hours", n: 4 }, t), t + 4 * H);
  assert.strictEqual(N._dueAt({ mode: "days", n: 2 }, t), t + 2 * D);
  assert.strictEqual(N._dueAt({ mode: "off" }, t), Infinity);
});

console.log("== Bloc-notes : dates de cochage ==");
test("doneEntries : seules les lignes cochees, avec ou sans tiret", () => {
  const e = N._doneEntries("# Titre\n[x] Lait\n[ ] Pain\n- [X] Beurre\ntexte\n~~barre~~");
  assert.deepStrictEqual(Array.from(e, (x) => x.body), ["Lait", "Beurre"]);
  assert.deepStrictEqual(Array.from(e, (x) => x.idx), [1, 3]);
});
test("doneEntries : les doublons ont des cles distinctes, rang parmi les COCHES", () => {
  const e = N._doneEntries("[x] Lait\n[ ] Lait\n[x] Lait");
  assert.deepStrictEqual(Array.from(e, (x) => x.key), ["Lait#0", "Lait#1"]);
});
test("reconcileStamps : une ligne cochee sans date recoit maintenant", () => {
  const r = N._reconcileStamps("[x] Lait", {}, 1000);
  assert.strictEqual(r.stamps["Lait#0"], 1000);
  assert.strictEqual(r.changed, true);
});
test("reconcileStamps : une date existante est conservee (aucun changement)", () => {
  const r = N._reconcileStamps("[x] Lait", { "Lait#0": 500 }, 1000);
  assert.strictEqual(r.stamps["Lait#0"], 500);
  assert.strictEqual(r.changed, false);
});
test("reconcileStamps : decocher retire la date, recocher la renouvelle", () => {
  let r = N._reconcileStamps("[ ] Lait", { "Lait#0": 500 }, 1000);
  assert.deepStrictEqual({ ...r.stamps }, {});
  assert.strictEqual(r.changed, true);
  r = N._reconcileStamps("[x] Lait", r.stamps, 2000);
  assert.strictEqual(r.stamps["Lait#0"], 2000);
});
test("reconcileStamps : deplacer une ligne ne change pas sa date", () => {
  const r = N._reconcileStamps("a\n\n[x] Lait", { "Lait#0": 500 }, 9999);
  assert.strictEqual(r.stamps["Lait#0"], 500);
});

console.log("== Bloc-notes : retrait des elements echus ==");
test("dueEntries : rien si le reglage est a 'off' ou si la date manque", () => {
  assert.strictEqual(N._dueEntries("[x] a", { "a#0": 0 }, { mode: "off" }, 1e12).length, 0);
  assert.strictEqual(N._dueEntries("[x] a", {}, { mode: "now" }, 1e12).length, 0);
});
test("splitDue : retire seulement les elements echus, le reste est intact", () => {
  const t0 = at(2026, 10, 18, 9, 0);
  const text = "# Courses\n[x] Lait\n[ ] Pain\n[x] Beurre\nnote libre";
  const stamps = { "Lait#0": t0, "Beurre#0": at(2026, 10, 18, 20, 0) };
  const r = N._splitDue(text, stamps, { mode: "hours", n: 4 }, at(2026, 10, 18, 14, 0));
  assert.strictEqual(r.text, "# Courses\n[ ] Pain\n[x] Beurre\nnote libre");
  assert.deepStrictEqual(Array.from(r.removed, (x) => x.text), ["Lait"]);
  assert.strictEqual(r.removed[0].doneAt, t0);
  assert.deepStrictEqual({ ...r.stamps }, { "Beurre#0": stamps["Beurre#0"] });
});
test("splitDue : rien d'echu -> meme texte, meme table", () => {
  const stamps = { "a#0": 1000 };
  const r = N._splitDue("[x] a", stamps, { mode: "days", n: 1 }, 2000);
  assert.strictEqual(r.text, "[x] a");
  assert.strictEqual(r.stamps, stamps);
  assert.strictEqual(r.removed.length, 0);
});
test("splitDue : doublons -- retirer le premier garde la date du second", () => {
  const stamps = { "Lait#0": 100, "Lait#1": 5000 };
  const r = N._splitDue("[x] Lait\n[x] Lait", stamps, { mode: "hours", n: 1 }, 100 + H);
  assert.strictEqual(r.text, "[x] Lait");
  assert.strictEqual(r.stamps["Lait#0"], 5000, "la date du survivant le suit");
});
test("splitDue : la ligne 'minuit' disparait le lendemain, pas le jour meme", () => {
  const stamps = { "a#0": at(2026, 10, 18, 17, 0) };
  const evening = N._splitDue("[x] a", stamps, { mode: "midnight" }, at(2026, 10, 18, 23, 59));
  assert.strictEqual(evening.removed.length, 0);
  const next = N._splitDue("[x] a", stamps, { mode: "midnight" }, at(2026, 10, 19, 0, 0));
  assert.strictEqual(next.removed.length, 1);
  assert.strictEqual(next.text, "");
});
test("seules les cases a cocher partent : texte barre a la main et titres restent", () => {
  const stamps = { "a#0": 0 };
  const r = N._splitDue("~~barre~~\n# [x] pas une case\n[x] a", stamps, { mode: "now" }, 1e12);
  assert.strictEqual(r.text, "~~barre~~\n# [x] pas une case");
});

console.log("== Bloc-notes : archive, progression, estompage ==");
test("expireArchive : 30 jours, ni plus ni moins", () => {
  const now = at(2026, 10, 18, 12, 0);
  const a = [{ text: "vieux", goneAt: now - 31 * D }, { text: "recent", goneAt: now - 29 * D }, { text: "sans date" }];
  assert.deepStrictEqual(Array.from(N._expireArchive(a, now), (x) => x.text), ["recent", "sans date"]);
});
test("taskProgress : faites / total", () => {
  assert.deepStrictEqual({ ...N._taskProgress("[x] a\n[ ] b\n- [x] c\ntexte") }, { done: 2, total: 3 });
  assert.deepStrictEqual({ ...N._taskProgress("rien") }, { done: 0, total: 0 });
});
test("oldLines : cochees depuis plus d'une heure seulement", () => {
  const now = 10 * H;
  const s = N._oldLines("[x] a\n[x] b\n[ ] c", { "a#0": now - 2 * H, "b#0": now - 10 * 60 * 1000 }, now);
  assert.deepStrictEqual(Array.from(s), [0]);
});
test("nextWake : la plus proche echeance, ou Infinity", () => {
  const now = at(2026, 10, 18, 10, 0);
  const notes = [
    { text: "[x] a", doneAt: { "a#0": now }, purge: { mode: "hours", n: 3 } },
    { text: "[x] b", doneAt: { "b#0": now }, purge: { mode: "hours", n: 1 } },
    { text: "[x] c", doneAt: { "c#0": now }, purge: { mode: "off" } }
  ];
  assert.strictEqual(N._nextWake(notes, now, false), now + H);
  assert.strictEqual(N._nextWake([notes[2]], now, false), Infinity);
  assert.strictEqual(N._nextWake([notes[2]], now, true), now + H, "l'estompage reveille aussi");
});

console.log("== Bloc-notes : coherence manifeste / i18n / CSS ==");
test("nouveaux reglages de tuile, avec leurs valeurs par defaut", () => {
  const f = (k) => manifest.settings.find((s) => s.key === k);
  assert.strictEqual(f("showProgress").type, "checkbox");
  assert.strictEqual(f("showProgress").default, true);
  assert.strictEqual(f("dimOldDone").default, false);
  assert.ok(f("showProgress").label.fr && f("showProgress").label.en);
  assert.ok(f("dimOldDone").label.fr && f("dimOldDone").label.en);
});
test("chaque cle i18n utilisee par le widget existe en FR ET en EN", () => {
  const keys = new Set();
  for (const m of js.matchAll(/["'`](notes\.[A-Za-z.]+?)["'`]/g)) keys.add(m[1]);
  for (const m of js.matchAll(/t\(\s*["'](notes\.[A-Za-z.]+?)["']/g)) keys.add(m[1]);
  ["off", "now", "midnight", "hours", "days"].forEach((m) => keys.add("notes.purge." + m).add("notes.purge.sum." + m));
  ["notes.purge.unitH", "notes.purge.unitD"].forEach((k) => keys.add(k));
  assert.ok(keys.size > 20);
  for (const k of keys) {
    if (k.endsWith(".") || k === "notes.color." || k === "notes.purge." || k === "notes.purge.sum.") continue;
    const n = i18n.split('"' + k + '"').length - 1;
    assert.ok(n >= 2, k + " : present " + n + " fois (FR + EN attendus)");
  }
});
test("le CSS definit toutes les classes ajoutees", () => {
  for (const c of ["pwn-purge", "pwn-chip", "pwn-sub", "pwn-arch-btn", "pwn-archive", "pwn-arch-item", "pwn-leaving", "pwn-old", "pwn-bar-on"]) {
    assert.ok(css.includes("." + c), c);
  }
  assert.ok(/prefers-reduced-motion[\s\S]*pwn-leaving/.test(css), "fondu desactive avec 'reduire les animations'");
});
test("le widget n'accede pas a document au chargement", () => {
  assert.ok(typeof N === "function");
});

console.log("\n" + n + " tests OK");
