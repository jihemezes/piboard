/* Test unitaire de server/localFolder.js : listing, filtrage par
   extension, protection contre la traversee de chemin. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { listLocalFolder, resolveLocalFile } = require("../server/localFolder");

const TMP = path.join(__dirname, "..", "tmp-test-localfolder");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, "b-plage.jpg"), "fake");
fs.writeFileSync(path.join(TMP, "a-montagne.PNG"), "fake");
fs.writeFileSync(path.join(TMP, "notes.txt"), "pas une image");
fs.mkdirSync(path.join(TMP, "sous-dossier"));
fs.writeFileSync(path.join(TMP, "..", "secret.jpg"), "hors du dossier");

try {
  console.log("== Listing : filtre par extension, tri alphabetique ==");
  const items = listLocalFolder(TMP);
  assert.strictEqual(items.length, 2, "seules les 2 images doivent apparaitre");
  assert.deepStrictEqual(items.map((i) => i.name), ["a-montagne.PNG", "b-plage.jpg"], "tri alphabetique");
  console.log("  OK:", JSON.stringify(items));

  console.log("== resolveLocalFile : fichier valide ==");
  const full = resolveLocalFile(TMP, "b-plage.jpg");
  assert(full.endsWith("b-plage.jpg"));
  console.log("  OK chemin resolu:", full);

  console.log("== resolveLocalFile : traversee de chemin bloquee ==");
  let blocked = false;
  try { resolveLocalFile(TMP, "../secret.jpg"); } catch (e) { blocked = true; }
  assert(blocked, "../secret.jpg doit etre rejete");
  console.log("  OK traversee bloquee");

  let blockedSlash = false;
  try { resolveLocalFile(TMP, "sous-dossier/x.jpg"); } catch (e) { blockedSlash = true; }
  assert(blockedSlash, "un slash dans le nom doit etre rejete");
  console.log("  OK slash dans le nom bloque");

  console.log("== Chemin relatif refuse ==");
  let relBlocked = false;
  try { listLocalFolder("relative/path"); } catch (e) { relBlocked = true; }
  assert(relBlocked, "un chemin relatif doit etre refuse");
  console.log("  OK chemin relatif refuse");

  console.log("== Dossier inexistant : erreur propre ==");
  let missingThrew = false;
  try { listLocalFolder("/chemin/qui/nexiste/pas/vraiment"); } catch (e) { missingThrew = true; }
  assert(missingThrew, "un dossier inexistant doit lever une erreur");
  console.log("  OK erreur propre pour dossier inexistant");

  console.log("\n>>> TOUS LES TESTS LOCALFOLDER PASSENT");
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.rmSync(path.join(TMP, "..", "secret.jpg"), { force: true });
}
