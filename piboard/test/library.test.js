/* Bibliotheque d'images : separation des deux origines, identifiants,
   masquage, ajouts et suppressions. Ce qui est verrouille ici, ce sont
   les proprietes dont depend la promesse faite a l'utilisateur : ses
   ajouts survivent aux mises a jour, un element livre ne peut pas etre
   efface, et aucun identifiant ne permet de sortir des deux dossiers.
   Image library: separation of the two origins, ids, hiding, additions
   and deletions. What is locked in here are the properties the promise
   made to the user rests on: their additions survive updates, a shipped
   item cannot be erased, and no id lets one escape the two folders. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Dossier de donnees isole : le module lit store.DATA_DIR au chargement.
// Isolated data folder: the module reads store.DATA_DIR at load time.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-library-"));
process.env.PIBOARD_DATA = path.join(TMP, "data");
const library = require("../server/library");

console.log("== Identifiants : analyse et refus ==");
{
  const ok = library.parseId("builtin:backgrounds:fond.jpg");
  assert.deepStrictEqual(ok, { origin: "builtin", section: "backgrounds", file: "fond.jpg" });
  assert.deepStrictEqual(library.parseId("user:photos:vacances.png"),
    { origin: "user", section: "photos", file: "vacances.png" });

  // Tout ce qui pourrait servir a sortir des deux dossiers, ou a lire un
  // fichier qui n'est pas une image. Everything that could serve to
  // escape the two folders, or to read a file that is not an image.
  for (const bad of [
    "builtin:backgrounds:../../package.json",
    "builtin:backgrounds:..\\..\\package.json",
    "builtin:backgrounds:.hidden.jpg",
    "builtin:backgrounds:script.js",
    "builtin:unknown:fond.jpg",
    "elsewhere:backgrounds:fond.jpg",
    "builtin:backgrounds",
    ""
  ]) {
    assert.strictEqual(library.parseId(bad), null, "refuse : " + bad);
    assert.strictEqual(library.fileOf(bad), null, "aucun fichier servi pour : " + bad);
  }
  console.log("  OK");
}

console.log("== Les ajouts de l'utilisateur vivent dans data/, jamais dans public/ ==");
{
  const id = library.addUserFile("backgrounds", "mon fond.jpg", Buffer.from("x"), { category: "maison" });
  assert.strictEqual(id, "user:backgrounds:mon fond.jpg");

  const file = library.fileOf(id);
  assert.ok(file, "le fichier est retrouve");
  assert.ok(file.startsWith(library.USER_ROOT), "ecrit sous data/library/, ce qui le fait survivre aux mises a jour");
  assert.ok(!file.startsWith(library.BUILTIN_ROOT), "jamais sous public/, que la mise a jour remplace");

  // Meme nom depose deux fois : rendu unique plutot que refuse.
  // Same name dropped twice: made unique rather than refused.
  const id2 = library.addUserFile("backgrounds", "mon fond.jpg", Buffer.from("y"), null);
  assert.strictEqual(id2, "user:backgrounds:mon fond-2.jpg");

  assert.throws(() => library.addUserFile("backgrounds", "virus.exe", Buffer.from("x"), null),
    /unsupported/, "extension refusee");
  assert.throws(() => library.addUserFile("inconnue", "x.jpg", Buffer.from("x"), null),
    /unknown section/);
  console.log("  OK");
}

console.log("== Masquage d'un element livre, suppression d'un ajout personnel ==");
{
  const shipped = "builtin:backgrounds:exemple.jpg";
  assert.throws(() => library.removeUserFile(shipped), /not a user item/,
    "un element livre ne s'efface pas : il reviendrait a la mise a jour suivante");

  library.setHidden(shipped, true);
  assert.ok(library.hiddenSet().has(shipped), "il est masque a la place");
  library.setHidden(shipped, false);
  assert.ok(!library.hiddenSet().has(shipped), "et se restaure");

  const id = library.addUserFile("photos", "photo.png", Buffer.from("x"), null);
  assert.ok(library.fileOf(id));
  library.removeUserFile(id);
  assert.strictEqual(library.fileOf(id), null, "un ajout personnel, lui, disparait pour de bon");
  console.log("  OK");
}

console.log("== Liste : metadonnees, masques ecartes, sections ==");
{
  const id = library.addUserFile("logos", "logo.png", Buffer.from("x"),
    { name: "Mon logo", category: "maison", tone: "light", author: "Moi", license: "CC0" });
  const items = library.list("logos");
  const mine = items.find((i) => i.id === id);
  assert.ok(mine, "present dans la liste");
  assert.strictEqual(mine.name, "Mon logo");
  assert.strictEqual(mine.tone, "light");
  assert.strictEqual(mine.author, "Moi");
  assert.strictEqual(mine.origin, "user");

  library.setHidden(id, true);
  assert.ok(!library.list("logos").some((i) => i.id === id), "un element masque n'est plus propose");
  assert.ok(library.list("logos", { includeHidden: true }).some((i) => i.id === id),
    "mais reste visible quand on le demande, sinon on ne pourrait pas le restaurer");

  assert.deepStrictEqual(library.SECTIONS, ["backgrounds", "logos", "photos"]);
  console.log("  OK");
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log("Tous les tests de bibliotheque sont passes.");
