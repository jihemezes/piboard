/* Relief 3D des tuiles (1.148.0) : le CSS ne lit que des attributs, et
   chaque piece du dispositif doit exister.  */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const srv = fs.readFileSync(path.join(root, "server/index.js"), "utf8");
const i18n = fs.readFileSync(path.join(root, "public/i18n.js"), "utf8");
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }

console.log("== Relief 3D des tuiles ==");
test("trois niveaux CSS et ombres empilees", () => {
  for (const l of ["light", "medium", "strong"]) assert.ok(css.includes(`[data-depth="${l}"]`), l);
  const rule = css.match(/\.grid-stack-item-content\[data-depth\]:not\(\.tile-transparent\) \{[^}]*\}/)[0];
  assert.ok((rule.match(/var\(--ds\d\)/g) || []).length >= 3);
});
test("les tuiles transparentes n'ont pas de relief, le soulevement coupe en edition", () => {
  assert.ok(css.includes(":not(.tile-transparent)"));
  assert.ok(/body\[data-tile-lift="both"\]:not\(\.editing\)/.test(css));
});
test("verre depoli : flou et couleur personnalisee transmise", () => {
  assert.ok(/data-glass="on"[^}]*backdrop-filter/.test(css));
  assert.ok(app.includes("--glass-base"));
});
test("par defaut a plat cote serveur, et reglages relus a l'ouverture/enregistres", () => {
  assert.ok(/tileDepth: "off"/.test(srv));
  for (const k of ["tileDepth", "tileLight", "tileLift", "tileGlass"]) {
    assert.ok(srv.includes(k) && app.includes("settings." + k), k);
  }
});
test("chaque libelle existe en FR et en EN", () => {
  for (const k of ["settings.section.depth", "settings.depth", "tile.depth", "tile.glass", "depth.lift.both", "depth.light.tl"]) {
    assert.strictEqual((i18n.match(new RegExp('"' + k.replace(/\./g, "\\.") + '"', "g")) || []).length, 2, k);
  }
});
console.log("\nTOUS LES TESTS PASSENT (" + n + ")");
