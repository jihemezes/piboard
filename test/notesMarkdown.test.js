/* Bloc-notes : Markdown complet (1.164.0).
   Rendu des listes (puces, numerotees, imbriquees) avec cases a cocher,
   titres, code, citations, separateurs, tableaux ; compteur et archive
   qui ignorent les blocs de code ; ancien rendu leger conserve.
   Notes tile, full Markdown (1.164.0). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const dir = path.join(__dirname, "../public/widgets/notes");
const js = fs.readFileSync(path.join(dir, "widget.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const i18n = fs.readFileSync(path.join(__dirname, "../public/i18n.js"), "utf8");
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }

let N = null;
const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "notes") N = k; } } }, console, document: undefined, ResizeObserver: undefined };
vm.createContext(sb);
vm.runInContext(js, sb);
const R = (t) => N._renderLines(t, null);
const count = (h, re) => (h.match(re) || []).length;

console.log("== Bloc-notes : Markdown complet ==");
test("cases a cocher : toutes les puces et les numeros, imbriques ou non", () => {
  const h = R("[ ] a\n- [ ] b\n* [x] c\n+ [ ] d\n1. [ ] e\n2) [x] f\n  - [ ] g\n\t* [x] h");
  assert.strictEqual(count(h, /class="pwn-check"/g), 8, "huit cases");
  assert.strictEqual(count(h, /pwn-done/g), 3, "trois cochees");
  assert.ok(/data-line="6"/.test(h) && /data-line="7"/.test(h), "les numeros de ligne sont ceux du texte");
  assert.ok(/--pwn-ind:1\.3em/.test(h), "la sous-tache est decalee");
});
test("une liste copiee depuis un autre outil (« - [ ] » + sous-listes) est reconnue", () => {
  const h = R("# Courses\n- [ ] Lait\n- [x] Pain\n  - [ ] complet\n  - [ ] seigle\n- [ ] Cafe");
  assert.strictEqual(count(h, /class="pwn-check"/g), 5);
  assert.ok(/pwn-h pwn-h1/.test(h));
});
test("puces * + - et niveaux d'imbrication", () => {
  const h = R("- a\n  * b\n    + c\n- d");
  assert.strictEqual(count(h, /pwn-bullet/g), 4);
  assert.strictEqual(count(h, /pwn-sub1/g), 2, "b et c sont imbriquees");
  assert.ok(/--pwn-ind:2\.6em/.test(h), "c est au niveau 2");
});
test("liste numerotee : les numeros tapes sont gardes", () => {
  const h = R("1. un\n2. deux\n10) dix");
  assert.strictEqual(count(h, /class="pwn-num"/g), 3);
  assert.ok(/pwn-num">10\)</.test(h));
});
test("titres de 1 a 6 niveaux, # sans espace n'est pas un titre", () => {
  const h = R("# a\n## b\n###### f\n#tag");
  assert.ok(/pwn-h1/.test(h) && /pwn-h2/.test(h) && /pwn-h6/.test(h));
  assert.strictEqual(count(h, /pwn-h /g), 3);
  assert.ok(/<div class="pwn-line">#tag<\/div>/.test(h));
});
test("code en ligne et bloc de code : contenu brut, jamais interprete, jamais une case", () => {
  const h = R("a `*x* <b>` b\n```js\n[ ] pas une case\n**pas gras**\n```\napres");
  assert.ok(/<code>\*x\* &lt;b&gt;<\/code>/.test(h));
  assert.strictEqual(count(h, /class="pwn-check"/g), 0);
  assert.ok(/<pre class="pwn-line pwn-code"><code>\[ \] pas une case\n\*\*pas gras\*\*<\/code><\/pre>/.test(h));
  assert.ok(/>apres</.test(h));
});
test("bloc de code jamais ferme : va jusqu'a la fin sans planter", () => {
  const h = R("```\nligne1\nligne2");
  assert.ok(/pwn-code/.test(h) && /ligne2/.test(h));
});
test("citations (y compris imbriquees), separateurs", () => {
  const h = R("> cite\n>> plus\n---\n***\n- - -");
  assert.strictEqual(count(h, /pwn-quote/g), 2);
  assert.ok(/--pwn-q:2/.test(h));
  assert.strictEqual(count(h, /pwn-hr/g), 3);
});
test("tableau : en-tete, alignements, cellules inline, tuyau echappe", () => {
  const h = R("| Nom | Qte | Prix |\n|:--|:-:|--:|\n| **Pain** | 2 | 1\\|2 |\n| Lait | 1 | 3 |\napres");
  assert.strictEqual(count(h, /<th[ >]/g), 3);
  assert.strictEqual(count(h, /<tr><td/g), 2);
  assert.ok(/<th class="pwn-al-c">Qte<\/th>/.test(h) && /<th class="pwn-al-r">Prix<\/th>/.test(h));
  assert.ok(/<strong>Pain<\/strong>/.test(h) && />1\|2</.test(h));
  assert.ok(/>apres</.test(h), "le texte apres le tableau reste un paragraphe");
});
test("un simple | dans une phrase n'est pas un tableau", () => {
  assert.strictEqual(count(R("a | b\nsuite"), /<table/g), 0);
});
test("mise en forme : __gras__, _italique_, snake_case intact, liens et images restent du texte", () => {
  const h = R("__g__ _i_ snake_case_name [lien](https://x.test) ![img](https://x.test/a.png)");
  assert.ok(/<strong>g<\/strong>/.test(h) && /<em>i<\/em>/.test(h));
  assert.ok(/snake_case_name/.test(h));
  assert.ok(!/<a |<img/.test(h), "ni lien ni image");
  assert.ok(/\[lien\]\(https:\/\/x\.test\)/.test(h));
});
test("le HTML saisi est echappe (aucune injection)", () => {
  const h = R("<img src=x onerror=alert(1)>\n- <b>x</b>\n| <i> |\n|--|\n| <s> |");
  assert.ok(!/<img|<b>|<i>|<s>/.test(h.replace(/<\/?(?:div|span|table|thead|tbody|tr|th|td|strong|em)\b[^>]*>/g, "")));
});
test("progression et archive : les cases dans un bloc de code ne comptent pas, celles des listes oui", () => {
  const t = "- [x] a\n  1. [ ] b\n```\n[x] code\n```\n* [x] c";
  const e = N._doneEntries(t).map((x) => x.idx);
  assert.strictEqual(JSON.stringify(e), "[0,5]");
});
test("ancien rendu leger conserve (reglage decoche) : seules les formes d'avant", () => {
  const h = N._renderLinesLight("- [ ] a\n* [ ] b\n## t\n`c`", null);
  assert.strictEqual(count(h, /class="pwn-check"/g), 1);
  assert.ok(!/<code>/.test(h));
});
test("reglage « Markdown complet » : manifeste, i18n FR/EN, memo, CSS", () => {
  const st = manifest.settings.find((s) => s.key === "fullMarkdown");
  assert.ok(st && st.type === "checkbox" && st.default === true && st.label.fr && st.label.en && st.hint.fr && st.hint.en);
  for (const k of ["toolMdHelp", "md.title", "md.headings", "md.lists", "md.nested", "md.spaces", "md.tasks", "md.inline", "md.code", "md.quote", "md.rule", "md.table", "md.note"]) {
    assert.strictEqual(i18n.split('"notes.' + k + '"').length - 1, 2, "notes." + k + " en FR et en EN");
  }
  const css = fs.readFileSync(path.join(dir, "widget.css"), "utf8");
  for (const c of [".pwn-table", ".pwn-code", ".pwn-quote", ".pwn-ol", ".pwn-mdhelp"]) assert.ok(css.includes(c), c);
});

console.log("\n>>> " + n + " TESTS PASSENT");
