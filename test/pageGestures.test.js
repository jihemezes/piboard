/* Gestes souris / trackpad pour changer de page (1.149.0). */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
const srv = fs.readFileSync(path.join(root, "server/index.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const i18n = fs.readFileSync(path.join(root, "public/i18n.js"), "utf8");
let n = 0;
function test(name, fn) { fn(); n++; console.log("  OK   " + name); }
console.log("== Gestes de page souris / trackpad ==");
test("actives par defaut, sens naturel, cote serveur", () => {
  assert.ok(/pageGestures: true/.test(srv) && /pageGestureDir: "natural"/.test(srv));
});
test("les deux reglages sont relus et enregistres", () => {
  for (const id of ["setPageGestures", "setPageGestureDir"]) {
    assert.ok(html.includes('id="' + id + '"'), id);
    assert.ok((app.match(new RegExp('\\$\\("' + id + '"\\)', "g")) || []).length >= 2, id);
  }
});
test("le defilement lateral n'entraine plus l'historique du navigateur", () => {
  assert.ok(/overscroll-behavior-x:\s*none/.test(css));
  assert.ok(/addEventListener\("wheel"[\s\S]*passive: false/.test(app));
});
test("libelles FR et EN", () => {
  for (const k of ["settings.pageGestures", "settings.pageGestureDir", "settings.pageGestureDir.inverted"]) {
    assert.strictEqual((i18n.match(new RegExp('"' + k.replace(/\./g, "\\.") + '"', "g")) || []).length, 2, k);
  }
});
console.log("\nTOUS LES TESTS PASSENT (" + n + ")");
