/* Tests hors ligne de la tuile Citation : integrite de la collection
   et moteur de tirage (public/widgets/quote/engine.js).
   Offline tests of the Quote tile: collection integrity and engine. */
"use strict";

const assert = require("assert");
const path = require("path");
const E = require("../public/widgets/quote/engine.js");
const DATA = require(path.join(__dirname, "..", "public", "widgets", "quote", "quotes.json"));
const items = DATA.items;

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("== Citation : collection et tirage ==");

const byCat = (c) => items.filter((i) => i.cat === c);

test("collection : environ 400 citations, des perles de JCVD, des Chuck Norris Facts", () => {
  assert.ok(byCat("quote").length >= 400, "citations " + byCat("quote").length);
  assert.ok(byCat("jcvd").length >= 30, "jcvd " + byCat("jcvd").length);
  assert.ok(byCat("chuck").length >= 60, "chuck " + byCat("chuck").length);
});

test("collection : identifiants uniques, texte FR et EN, signature FR et EN", () => {
  assert.strictEqual(new Set(items.map((i) => i.id)).size, items.length);
  for (const i of items) {
    assert.ok(i.fr && i.fr.trim() && i.en && i.en.trim(), i.id);
    assert.ok(i.author && i.author.fr && i.author.en, i.id);
    assert.ok(!/[<>]/.test(i.fr + i.en), "pas de balisage : " + i.id);
  }
});

test("collection : aucun doublon de texte", () => {
  const fr = items.map((i) => i.fr.toLowerCase());
  assert.strictEqual(new Set(fr).size, fr.length);
});

test("collection : chaque citation a un theme connu, chaque theme est fourni", () => {
  for (const i of byCat("quote")) assert.ok(E.THEMES.includes(i.theme), i.id + " " + i.theme);
  for (const t of E.THEMES) assert.ok(byCat("quote").filter((i) => i.theme === t).length >= 15, t);
});

test("collection : les pensees de JCVD non sourcees sont signees « attribué à »", () => {
  const sourced = byCat("jcvd").filter((i) => i.author.fr === "Jean-Claude Van Damme");
  const attributed = byCat("jcvd").filter((i) => i.author.fr === "attribué à Jean-Claude Van Damme");
  assert.ok(sourced.length >= 3 && sourced.length < 10, "sourcees " + sourced.length);
  assert.strictEqual(sourced.length + attributed.length, byCat("jcvd").length);
  for (const i of attributed) assert.strictEqual(i.author.en, "attributed to Jean-Claude Van Damme");
});

test("collection : les traductions anglaises de JCVD sont bien en anglais", () => {
  for (const i of byCat("jcvd")) assert.ok(!/[éèàçù]|\bc'est\b/i.test(i.en), i.en);
});

test("collection : hommage a Chuck Norris sans blague sur la mort ni les armes", () => {
  for (const i of byCat("chuck")) {
    assert.ok(/Chuck Norris/.test(i.fr) && /Chuck Norris/.test(i.en), i.id);
    assert.ok(!/\b(mort|meurt|tue|tuer|pistolet|arme|sang)\b/i.test(i.fr), i.fr);
    assert.strictEqual(i.author.fr, "Chuck Norris Fact");
  }
});

test("collection : fausses attributions connues ecartees", () => {
  const txt = byCat("quote").map((i) => i.fr + " / " + i.author.fr);
  const bad = [
    /préparation rencontre l'opportunité.*Sénèque/,
    /Au cœur de la difficulté.*Einstein/,
    /plus grande gloire.*Confucius/,
    /danser sous la pluie/,
    /Soyez le changement/,
    /bonne ou de mauvaise situation/
  ];
  for (const re of bad) assert.ok(!txt.some((t) => re.test(t)), String(re));
});

const base = { sourceQuotes: true, sourceJcvd: false, sourceChuck: false, funFrequency: "sometimes" };

test("citations perso : texte et auteur, commentaires et doublons ignores", () => {
  const c = E.parseCustom("Vivre — Moi\n# note\n\nSans auteur\nVivre — Moi\nA -- B\nC – D");
  assert.deepStrictEqual(c.map((x) => x.fr), ["Vivre", "Sans auteur", "A", "C"]);
  assert.strictEqual(c[0].author.fr, "Moi");
  assert.strictEqual(c[1].author, null);
  assert.strictEqual(c[0].id, E.parseCustom("Vivre — Autre")[0].id, "identifiant stable par texte");
});

test("pools : sources et themes respectes", () => {
  const p = E.buildPools(items, Object.assign({}, base, { theme_humor: false, theme_science: false }));
  assert.ok(p.quote.length > 0 && !p.quote.some((i) => ["humor", "science"].includes(i.theme)));
  assert.strictEqual(p.jcvd.length, 0);
  const all = E.buildPools(items, Object.assign({}, base, { sourceJcvd: true, sourceChuck: true }));
  assert.strictEqual(all.jcvd.length, byCat("jcvd").length);
  assert.strictEqual(all.chuck.length, byCat("chuck").length);
});

test("pools : citations perso gardees meme sans la source Citations ni theme", () => {
  const p = E.buildPools(items, Object.assign({}, base, { sourceQuotes: false, customQuotes: "Ma phrase" }));
  assert.deepStrictEqual(p.quote.map((i) => i.fr), ["Ma phrase"]);
});

test("frequence : part des blagues respectee", () => {
  const pools = E.buildPools(items, Object.assign({}, base, { sourceJcvd: true, sourceChuck: true }));
  const rare = E.poolWeights(pools, "rare");
  assert.ok(Math.abs(rare.jcvd + rare.chuck - 0.1) < 1e-9);
  assert.ok(Math.abs(rare.quote - 0.9) < 1e-9);
  const often = E.poolWeights(pools, "often");
  assert.ok(Math.abs(often.quote - 0.5) < 1e-9);
  const eq = E.poolWeights(pools, "equal");
  assert.ok(Math.abs(eq.quote - 1 / 3) < 1e-9);
  const onlyFun = E.poolWeights(E.buildPools(items, Object.assign({}, base, { sourceQuotes: false, sourceChuck: true })), "rare");
  assert.deepStrictEqual(onlyFun, { chuck: 1 }, "sans citations, les blagues prennent toute la place");
});

test("tirage : dosage observe sur 4000 tirages (regulierement = 1 sur 4)", () => {
  const s = Object.assign({}, base, { sourceJcvd: true, sourceChuck: true });
  let st = null, fun = 0;
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 4000; i++) {
    const r = E.next(items, s, st, { seed: "dose", random });
    st = r.state;
    if (r.item.cat !== "quote") fun++;
  }
  assert.ok(fun / 4000 > 0.22 && fun / 4000 < 0.28, String(fun / 4000));
});

test("tirage : aucune repetition avant d'avoir tout vu, puis nouveau tour", () => {
  const s = Object.assign({}, base, { sourceQuotes: false, sourceChuck: true });
  const n = byCat("chuck").length;
  let st = null;
  const seen = [];
  for (let i = 0; i < n; i++) { const r = E.next(items, s, st, { seed: "x" }); st = r.state; seen.push(r.item.id); }
  assert.strictEqual(new Set(seen).size, n, "tout le paquet, sans doublon");
  const r = E.next(items, s, st, { seed: "x" });
  assert.strictEqual(r.state.decks.chuck.round, 1, "nouveau tour");
  assert.notStrictEqual(r.item.id, seen[n - 1], "pas deux fois de suite a la jonction");
});

test("tirage : l'etat survit a une serialisation (redemarrage)", () => {
  let st = null;
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const r = E.next(items, base, st, { seed: "s" });
    st = JSON.parse(JSON.stringify(r.state));
    ids.push(r.item.id);
  }
  assert.strictEqual(new Set(ids).size, 10);
});

test("tirage : deux tuiles n'ont pas le meme ordre", () => {
  const a = E.next(items, base, null, { seed: "t1", random: () => 0 }).item.id;
  const b = E.next(items, base, null, { seed: "t2", random: () => 0 }).item.id;
  assert.notStrictEqual(a, b);
});

test("tirage : paquet rebattu quand la selection change", () => {
  let st = E.next(items, base, null, { seed: "c" }).state;
  const r = E.next(items, Object.assign({}, base, { theme_humor: false }), st, { seed: "c" });
  assert.strictEqual(r.state.decks.quote.pos, 1, "position remise a zero");
  assert.notStrictEqual(r.item.theme, "humor");
});

test("citation du jour : la meme toute la journee, une autre le lendemain", () => {
  const a = E.forDay(items, base, null, "2026-09-16", { seed: "d" });
  const b = E.forDay(items, base, a.state, "2026-09-16", { seed: "d" });
  assert.strictEqual(a.item.id, b.item.id);
  const c = E.forDay(items, base, b.state, "2026-09-17", { seed: "d" });
  assert.notStrictEqual(c.item.id, a.item.id);
  const d = E.forDay(items, Object.assign({}, base, { sourceQuotes: false, sourceChuck: true }), c.state, "2026-09-17", { seed: "d" });
  assert.strictEqual(d.item.cat, "chuck", "si la citation du jour sort de la selection, on en tire une autre");
});

test("favoris : ajout, retrait, pool dedie, vide si aucun", () => {
  let f = E.toggleFavorite(undefined, "q-1");
  assert.deepStrictEqual(f, ["q-1"]);
  f = E.toggleFavorite(f, "q-1");
  assert.deepStrictEqual(f, []);
  const id = byCat("jcvd")[0].id;
  const p = E.buildPools(items, { favoritesOnly: true, favorites: [id], sourceJcvd: false });
  assert.deepStrictEqual(p.favorites.map((i) => i.id), [id], "un favori reste visible meme si sa source est decochee");
  assert.strictEqual(E.next(items, { favoritesOnly: true, favorites: [] }, null).item, null);
});

test("aucune source : tirage vide plutot qu'une erreur", () => {
  const r = E.next(items, { sourceQuotes: false }, null);
  assert.strictEqual(r.item, null);
});

test("signature : langue choisie, ancien format texte accepte", () => {
  assert.strictEqual(E.authorText({ author: { fr: "proverbe chinois", en: "Chinese proverb" } }, "en"), "Chinese proverb");
  assert.strictEqual(E.authorText({ author: "Voltaire" }, "fr"), "Voltaire");
  assert.strictEqual(E.authorText({ author: null }, "fr"), "");
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
