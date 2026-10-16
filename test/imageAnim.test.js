/* Animations de la tuile Logo / Image (1.150.0). */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const dir = path.join(__dirname, "../public/widgets/image");
const css = fs.readFileSync(path.join(dir, "widget.css"), "utf8");
const js = fs.readFileSync(path.join(dir, "widget.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }
console.log("== Logo / Image : animations ==");
const anim = manifest.settings.find((f) => f.key === "anim");
test("animation : aucune par defaut, sept choix", () => {
  assert.strictEqual(anim.default, "none");
  assert.deepStrictEqual(anim.options.map((o) => o.value), ["none", "spinY", "spinX", "breathe", "float", "shine", "glow"]);
});
test("chaque choix a sa regle CSS, casse comprise (les classes distinguent majuscules et minuscules)", () => {
  for (const v of anim.options.map((o) => o.value).filter((x) => x !== "none")) {
    assert.ok(css.includes(".pw-image-anim-" + v + " "), v);
  }
});
test("chaque choix est reconnu par le widget", () => {
  for (const v of anim.options.map((o) => o.value)) assert.ok(js.includes('"' + v + '"'), v);
});
test("reglages : duree, sens, perspective, pause", () => {
  for (const k of ["animSeconds", "animDir", "animPersp", "animPause"]) assert.ok(manifest.settings.some((f) => f.key === k), k);
});
test("l'image n'est pas touchee : le bloc porte l'animation, pas l'image", () => {
  assert.ok(!/\.pw-image img\s*\{[^}]*animation/.test(css));
  assert.ok(css.includes(".pw-image-wrap"));
});
test("respecte « reduire les animations »", () => {
  assert.ok(/prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none/.test(css));
});
console.log("\nTOUS LES TESTS PASSENT (" + n + ")");
