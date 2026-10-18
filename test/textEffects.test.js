/* Effets de la tuile Texte (1.158.0).
   Ce qu'on verifie : les fonctions pures (miroir/rotation, degrade
   periodique, relief, decoupe en messages), la coherence manifeste /
   widget / CSS, et que rien ne change par defaut. Le rendu reel est
   verifie dans dom-smoke.js et dans un navigateur.
   Text tile effects (1.158.0): the pure helpers, manifest / widget / CSS
   consistency, and that nothing changes by default. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const dir = path.join(__dirname, "../public/widgets/text");
const js = fs.readFileSync(path.join(dir, "widget.js"), "utf8");
const css = fs.readFileSync(path.join(dir, "widget.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const imgManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/widgets/image/manifest.json"), "utf8"));
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }

let Text = null;
const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "text") Text = k; } } }, console, document: undefined, ResizeObserver: undefined };
vm.createContext(sb);
vm.runInContext(js, sb);
const setting = (k) => manifest.settings.find((f) => f.key === k);

console.log("== Texte : effets, valeurs par defaut ==");
test("rien ne change par defaut : tous les effets sont desactives", () => {
  assert.strictEqual(setting("anim").default, "none");
  assert.strictEqual(setting("neon").default, "none");
  assert.strictEqual(setting("outline").default, "none");
  assert.strictEqual(setting("extrude").default, 0);
  assert.strictEqual(setting("rotate").default, "0");
  assert.strictEqual(setting("opacity").default, 100);
  assert.strictEqual(setting("flipH").default, false);
  assert.strictEqual(setting("flipV").default, false);
  assert.strictEqual(setting("animPause").default, false);
});
test("les reglages repris de la tuile Image ont les memes noms et les memes valeurs", () => {
  for (const k of ["flipH", "flipV", "rotate", "opacity", "animSeconds", "animDir", "animPersp", "animPause"]) {
    const a = setting(k), b = imgManifest.settings.find((f) => f.key === k);
    assert.ok(a && b, k);
    assert.strictEqual(a.type, b.type, k + " : type");
    assert.strictEqual(a.default, b.default, k + " : defaut");
    if (b.options) assert.deepStrictEqual(a.options.map((o) => o.value), b.options.map((o) => o.value), k + " : choix");
  }
  const imgAnims = imgManifest.settings.find((f) => f.key === "anim").options.map((o) => o.value).filter((v) => v !== "none");
  const txtAnims = setting("anim").options.map((o) => o.value);
  for (const v of imgAnims) assert.ok(txtAnims.includes(v), "animation reprise : " + v);
});
test("les six animations propres au texte sont proposees", () => {
  const v = setting("anim").options.map((o) => o.value);
  for (const k of ["typewriter", "arrive", "wave", "gradient", "marquee", "cycle"]) assert.ok(v.includes(k), k);
});
test("chaque animation est reconnue par le widget et a sa regle CSS", () => {
  for (const v of setting("anim").options.map((o) => o.value).filter((x) => x !== "none")) {
    assert.ok(Text.ANIMS.has(v), "widget : " + v);
    /* L'alternance de messages se style par ses propres classes. */
    const sel = v === "cycle" ? ".pw-text-msg" : ".pw-text-anim-" + v + " ";
    assert.ok(css.includes(sel), "css : " + v);
  }
});
test("chaque libelle existe en francais et en anglais", () => {
  for (const f of manifest.settings) {
    assert.ok(f.label && f.label.fr && f.label.en, f.key);
    for (const o of f.options || []) assert.ok(o.label && o.label.fr && o.label.en, f.key + "/" + o.value);
  }
});

console.log("== Texte : fonctions pures ==");
test("orientation : aucune transformation par defaut", () => {
  assert.strictEqual(Text._orientTransform({}), "");
});
test("orientation : le miroir est place AVANT la rotation (applique apres, comme sur l'image)", () => {
  const t = Text._orientTransform({ flipH: true, rotate: "180" });
  assert.ok(t.indexOf("scale(") < t.indexOf("rotate("), t);
  assert.strictEqual(Text._orientTransform({ flipH: true }), "scale(-1, 1)");
  assert.strictEqual(Text._orientTransform({ flipV: true }), "scale(1, -1)");
});
test("orientation : 90 et 270 degres recentrent la boite (dimensions echangees)", () => {
  assert.ok(Text._orientTransform({ rotate: "90" }).startsWith("translate(-50%, -50%)"));
  assert.ok(Text._orientTransform({ rotate: "270" }).startsWith("translate(-50%, -50%)"));
  assert.ok(!/translate/.test(Text._orientTransform({ rotate: "180" })));
});
test("orientation : une rotation inconnue est ignoree", () => {
  assert.strictEqual(Text._orientTransform({ rotate: "45" }), "");
  assert.strictEqual(Text._orientTransform({ rotate: "<script>" }), "");
});
test("messages : une ligne non vide = un message", () => {
  assert.deepStrictEqual(Array.from(Text._splitMessages("Un\n\n  Deux  \r\nTrois\n")), ["Un", "Deux", "Trois"]);
  assert.deepStrictEqual(Array.from(Text._splitMessages("")), []);
  assert.deepStrictEqual(Array.from(Text._splitMessages(null)), []);
});
test("bandeau : les retours a la ligne deviennent des puces, sur une seule ligne", () => {
  const t = Text._marqueeText("A\nB");
  assert.ok(!/\n/.test(t) && t.includes("A") && t.includes("B") && t.includes("•"), t);
});
test("relief : une couche par pixel, decalee dans la bonne direction", () => {
  const l = Text._extrudeLayers(4, "br");
  assert.strictEqual(l.length, 4);
  assert.ok(l[0].startsWith("1px 1px") && l[3].startsWith("4px 4px"));
  assert.ok(Text._extrudeLayers(3, "bl")[2].startsWith("-3px 3px"));
  assert.ok(Text._extrudeLayers(3, "b")[2].startsWith("0px 3px"));
  assert.ok(Text._extrudeLayers(3, "tr")[2].startsWith("3px -3px"));
  assert.strictEqual(Text._extrudeLayers(0, "br").length, 0);
});
test("relief : borne (le navigateur n'a pas a empiler des centaines d'ombres)", () => {
  assert.ok(Text._extrudeLayers(5000, "br").length <= 40);
  assert.strictEqual(Text._extrudeLayers(2, "inconnue").length, 2, "direction inconnue : bas droite");
});
test("neon : halo en em, donc proportionnel a la taille", () => {
  const l = Text._neonLayers();
  assert.ok(l.length >= 3 && l.every((x) => /em /.test(x) && /var\(--pwt-c\)/.test(x)));
});
test("degrade : la suite de couleurs est repetee, pour une boucle sans couture", () => {
  const g = Text._gradientCss("custom", "#111111", "#eeeeee");
  const stops = g.match(/#[0-9a-f]{6} [\d.]+%/g);
  assert.strictEqual(stops.length, 6, "(A, B, A) deux fois : " + g);
  assert.ok(/^linear-gradient\(90deg, #111111 0\.00%/.test(g));
  assert.ok(/#111111 100\.00%\)$/.test(g), "la fin retombe sur la premiere couleur");
  const half = stops.slice(0, 3).map((s) => s.split(" ")[0]);
  assert.deepStrictEqual(stops.slice(3).map((s) => s.split(" ")[0]), half, "seconde moitie identique a la premiere");
  assert.ok(/50\.00%/.test(g));
});
test("degrade : l'accent du theme passe par la variable, pas par une valeur figee", () => {
  assert.ok(/var\(--accent\)/.test(Text._gradientCss("accent")));
  assert.ok(Text._gradientCss("rainbow").split("#").length >= 8);
});

console.log("== Texte : garde-fous du source ==");
test("respecte « reduire les animations » (CSS et JS)", () => {
  assert.ok(/prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none/.test(css));
  assert.ok(/prefers-reduced-motion: reduce/.test(js) && /if \(reduced\) kind = "none"/.test(js));
});
test("chaque effet vit sur son propre element : l'animation d'ensemble n'est pas sur la boite d'orientation", () => {
  assert.ok(!/\.pw-text-orient[^{]*\{[^}]*animation:\s*pwtx-(spin|breathe|float|glow|grad|shine)/.test(css));
  assert.ok(/\.pw-text-flicker\s*\{\s*animation:/.test(css));
});
test("les ombres des textes peints par leur fond passent par `filter`", () => {
  assert.ok(/CLIP_ANIMS = new Set\(\["gradient", "shine"\]\)/.test(js));
  assert.ok(/drop-shadow/.test(js) && /useFilter/.test(js));
});
test("un texte creux ne recoit ni degrade ni brillance", () => {
  assert.ok(/hollow" && CLIP_ANIMS\.has\(kind\)\) kind = "none"/.test(js));
});
test("les chronometres sont arretes a la destruction et a chaque rendu", () => {
  assert.ok(/destroy\(\) \{\s*this\.clearTimers\(\)/.test(js));
  assert.ok(/this\.clearTimers\(\);\s*\n\s*const rotate/.test(js));
});
test("la taille automatique est conservee (regle de trois, pas de recherche dichotomique)", () => {
  assert.ok(/function sizeFor/.test(js) && /measureNatural/.test(js));
  assert.ok(/white-space:\s*pre;/.test(css) && !/white-space:\s*pre-wrap/.test(css));
});

console.log("\nTOUS LES TESTS PASSENT (" + n + ")");
