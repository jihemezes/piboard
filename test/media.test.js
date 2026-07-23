/* Test unitaire de server/media.js : validation d'identifiant de tuile,
   listing, protection contre la traversee de chemin, suppression. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const TMP_DATA = path.join(__dirname, "..", "tmp-test-media");
fs.rmSync(TMP_DATA, { recursive: true, force: true });
process.env.PIBOARD_DATA = TMP_DATA;

const media = require("../server/media");

try {
  console.log("== Validation d'identifiant de tuile ==");
  assert(media.isValidTileId("t-mrejhn93lycbd"), "identifiant normal accepte");
  assert(!media.isValidTileId("../../etc"), "traversee de chemin rejetee");
  assert(!media.isValidTileId("t-with/slash"), "slash rejete");
  assert(!media.isValidTileId(""), "chaine vide rejetee");
  assert(!media.isValidTileId(null), "null rejete");
  console.log("  OK validations d'identifiant");

  console.log("== Dossier vide au depart ==");
  assert.deepStrictEqual(media.listMedia("t-empty"), [], "dossier jamais cree = liste vide, pas d'erreur");
  console.log("  OK liste vide sans erreur pour un dossier inexistant");

  console.log("== Creation et listing (tri par date de modification) ==");
  const dir = media.ensureDir("t-photos");
  fs.writeFileSync(path.join(dir, "b.jpg"), "img1");
  // s'assurer d'un ecart de mtime mesurable
  const past = new Date(Date.now() - 5000);
  fs.utimesSync(path.join(dir, "b.jpg"), past, past);
  fs.writeFileSync(path.join(dir, "a.jpg"), "img2");
  fs.writeFileSync(path.join(dir, "ignore.txt"), "pas une image");
  const items = media.listMedia("t-photos");
  assert.strictEqual(items.length, 2, "seules les images comptent");
  assert.strictEqual(items[0].name, "b.jpg", "le plus ancien (mtime) vient en premier");
  console.log("  OK:", JSON.stringify(items));

  console.log("== safeFilename : extension preservee si autorisee, sinon .jpg ==");
  assert(media.safeFilename("photo.png").endsWith(".png"));
  assert(media.safeFilename("virus.exe").endsWith(".jpg"), "extension non-image forcee en .jpg");
  console.log("  OK noms de fichiers surs generes");

  console.log("== resolveFile : traversee de chemin bloquee ==");
  let blocked = false;
  try { media.resolveFile("t-photos", "../../../etc/passwd"); } catch (e) { blocked = true; }
  assert(blocked, "traversee doit etre rejetee");
  let blockedSlash = false;
  try { media.resolveFile("t-photos", "sub/dir.jpg"); } catch (e) { blockedSlash = true; }
  assert(blockedSlash, "slash dans le nom doit etre rejete");
  console.log("  OK traversees bloquees");

  console.log("== Suppression ==");
  media.deleteMedia("t-photos", "a.jpg");
  assert.strictEqual(media.listMedia("t-photos").length, 1, "un fichier de moins apres suppression");
  console.log("  OK suppression effective");

  console.log("== deleteAllMedia nettoie tout le dossier de la tuile ==");
  media.deleteAllMedia("t-photos");
  assert.deepStrictEqual(media.listMedia("t-photos"), [], "plus aucun fichier apres nettoyage complet");
  console.log("  OK nettoyage complet");

  console.log("\n>>> TOUS LES TESTS MEDIA PASSENT");
} finally {
  fs.rmSync(TMP_DATA, { recursive: true, force: true });
}
