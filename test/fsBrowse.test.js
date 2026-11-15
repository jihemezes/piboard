/* Tests hors ligne du choix d'un dossier (server/fsBrowse.js) : ce que
   le module accepte comme nom, ce qu'il liste, et ce qu'il refuse.
   Offline tests of folder picking: what names it accepts, what it
   lists, and what it refuses. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const B = require("../server/fsBrowse.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("== Choix d'un dossier ==");

test("nom de dossier : les noms courants passent", () => {
  for (const n of ["Enregistrements", "TV 2026", "series-tv", "Été_2026"]) {
    assert.strictEqual(B.isValidFolderName(n), true, n);
  }
});

test("nom de dossier : separateurs, remontees et caracteres Windows refuses", () => {
  for (const n of ["", "   ", ".", "..", "a/b", "a\\b", "C:", "a*b", 'a"b', "a?b", "a|b", "fin."]) {
    assert.strictEqual(B.isValidFolderName(n), false, JSON.stringify(n));
  }
  // Les espaces de bout sont retires, pas refuses : « TV  » vaut « TV ».
  // Surrounding spaces are trimmed, not refused.
  assert.strictEqual(B.isValidFolderName("  TV  "), true);
  assert.strictEqual(B.isValidFolderName("x".repeat(101)), false, "nom trop long");
});

test("parent : remonte, et s'arrete a la racine", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  assert.strictEqual(B.parentOf(path.join(dir, "a", "b")), path.join(dir, "a"));
  assert.strictEqual(B.parentOf(path.parse(dir).root), null, "la racine n'a pas de parent");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("fil d'Ariane : chaque segment porte son chemin complet", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  const deep = path.join(dir, "a", "b");
  fs.mkdirSync(deep, { recursive: true });
  const crumbs = B.breadcrumb(deep);
  assert.strictEqual(crumbs[crumbs.length - 1].path, deep);
  assert.strictEqual(crumbs[crumbs.length - 1].name, "b");
  assert.strictEqual(crumbs[0].path, path.parse(deep).root);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("liste : uniquement les dossiers, tries, sans les caches", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  fs.mkdirSync(path.join(dir, "Videos"));
  fs.mkdirSync(path.join(dir, "archives"));
  fs.mkdirSync(path.join(dir, ".cache"));
  fs.writeFileSync(path.join(dir, "film.ts"), "x");
  const out = B.listDir(dir);
  assert.deepStrictEqual(out.dirs.map((d) => d.name), ["archives", "Videos"]);
  assert.strictEqual(out.writable, true);
  assert.strictEqual(out.parent, path.dirname(dir));
  assert.ok(out.dirs.every((d) => d.path.startsWith(dir)), "chaque entree porte son chemin complet");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("liste : un dossier absent leve une erreur, pas une liste vide", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  assert.throws(() => B.listDir(path.join(dir, "absent")), /ENOENT/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("creation : cree le dossier et renvoie son chemin", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  const made = B.mkdir(dir, "Enregistrements TV");
  assert.strictEqual(made, path.join(dir, "Enregistrements TV"));
  assert.ok(fs.statSync(made).isDirectory());
  assert.strictEqual(B.mkdir(dir, "Enregistrements TV"), made, "un dossier existant ne fait pas echouer");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("creation : un nom qui remonte ou contient un separateur est refuse", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-"));
  for (const n of ["..", "../evade", "a/b", "a\\b"]) {
    assert.throws(() => B.mkdir(dir, n), (e) => e.code === "bad-name", n);
  }
  assert.deepStrictEqual(fs.readdirSync(dir), [], "rien n'a ete cree");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("emplacements de depart : une liste de dossiers qui existent", () => {
  const roots = B.listRoots();
  assert.ok(Array.isArray(roots) && roots.length > 0);
  for (const r of roots) {
    assert.ok(r.name && r.path, JSON.stringify(r));
    assert.ok(fs.statSync(r.path).isDirectory(), r.path);
  }
  assert.strictEqual(new Set(roots.map((r) => r.path)).size, roots.length, "pas de doublon");
});

test("listDir(images) : nomme les images, marque les phototheques, ignore le reste", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-img-"));
  fs.writeFileSync(path.join(dir, "b.JPG"), "x");
  fs.writeFileSync(path.join(dir, "a.png"), "x");
  fs.writeFileSync(path.join(dir, "c.heic"), "x");
  fs.writeFileSync(path.join(dir, "note.txt"), "x");
  fs.writeFileSync(path.join(dir, ".hidden.jpg"), "x");
  fs.mkdirSync(path.join(dir, "Photos Library.photoslibrary"));
  fs.mkdirSync(path.join(dir, "Autre"));
  const plain = B.listDir(dir);
  assert.strictEqual(plain.images, undefined, "sans option, pas d'images");
  const r = B.listDir(dir, { images: true });
  assert.deepStrictEqual(r.images.map((i) => i.name), ["a.png", "b.JPG", "c.heic"]);
  assert.strictEqual(r.imageCount, 3);
  assert.strictEqual(r.images.find((i) => i.name === "c.heic").native, false);
  assert.strictEqual(r.images.find((i) => i.name === "a.png").native, true);
  assert.strictEqual(r.dirs.find((d) => d.name === "Photos Library.photoslibrary").library, true);
  assert.strictEqual(r.dirs.find((d) => d.name === "Autre").library, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("listShortcuts : dossiers existants + phototheques donnees", () => {
  const sc = B.listShortcuts([{ name: "Vacances", path: "/x/Vacances.photoslibrary" }]);
  assert.ok(sc.some((s) => s.kind === "library" && s.name === "Vacances"));
  for (const s of sc.filter((x) => x.kind !== "library")) assert.ok(fs.statSync(s.path).isDirectory(), s.path);
});

test("previewable : image ordinaire seulement, chemin absolu", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-prev-"));
  const img = path.join(dir, "a.jpg");
  fs.writeFileSync(img, "x");
  fs.writeFileSync(path.join(dir, "secret.txt"), "x");
  fs.mkdirSync(path.join(dir, "d.jpg"));
  assert.strictEqual(B.previewable(img), img);
  assert.strictEqual(B.previewable(path.join(dir, "secret.txt")), null, "pas une image");
  assert.strictEqual(B.previewable(path.join(dir, "d.jpg")), null, "un dossier");
  assert.strictEqual(B.previewable("a.jpg"), null, "relatif");
  assert.strictEqual(B.previewable(path.join(dir, "absent.jpg")), null);
  assert.strictEqual(B.previewable(""), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
