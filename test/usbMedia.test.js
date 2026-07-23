/* Test unitaire de server/usbMedia.js : detection de volumes (via une
   racine "/media" simulee, injectee dans les fonctions pour ne jamais
   toucher le vrai /media du systeme qui execute les tests), listing
   recursif avec profondeur/limite, agregation multi-cles, et protection
   contre la traversee de chemin. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { listVolumes, listUsbImages, resolveUsbFile } = require("../server/usbMedia");

const TMP = path.join(__dirname, "..", "tmp-test-usbmedia");
const FAKE_MEDIA_ROOT = path.join(TMP, "media"); // simule /media
const ROOTS = [FAKE_MEDIA_ROOT]; // n'est JAMAIS le vrai /media du systeme

fs.rmSync(TMP, { recursive: true, force: true });

// Simule ce que Pi OS Desktop produit : /media/<utilisateur>/<cle>/...
const userDir = path.join(FAKE_MEDIA_ROOT, "jeanmichel");
const key1 = path.join(userDir, "CLE_VACANCES");
const key2 = path.join(userDir, "CLE_VIDE");
fs.mkdirSync(path.join(key1, "ete"), { recursive: true });
fs.mkdirSync(key2, { recursive: true });
fs.writeFileSync(path.join(key1, "plage.jpg"), "fake");
fs.writeFileSync(path.join(key1, "notes.txt"), "pas une image");
fs.writeFileSync(path.join(key1, "ete", "montagne.PNG"), "fake");
fs.mkdirSync(path.join(userDir, ".Trash-1000"), { recursive: true }); // dossier cache : doit etre ignore
fs.writeFileSync(path.join(userDir, ".Trash-1000", "cachee.jpg"), "fake");

try {
  console.log("== listVolumes : detecte les 2 cles montees ==");
  const volumes = listVolumes(ROOTS);
  assert.strictEqual(volumes.length, 2, "2 volumes attendus");
  assert(volumes.some((v) => v.label === "CLE_VACANCES"));
  assert(volumes.some((v) => v.label === "CLE_VIDE"));
  console.log("  OK:", JSON.stringify(volumes.map((v) => v.label)));

  console.log("== listUsbImages : agrege les images de toutes les cles, sous-dossiers inclus ==");
  const { items } = listUsbImages(ROOTS);
  assert.strictEqual(items.length, 2, "2 images attendues au total (plage.jpg + ete/montagne.PNG)");
  const names = items.map((i) => i.relPath).sort();
  assert.deepStrictEqual(names, [path.join("ete", "montagne.PNG"), "plage.jpg"]);
  console.log("  OK:", JSON.stringify(names));

  console.log("== Dossiers/fichiers caches ignores (.Trash-1000) ==");
  assert(!items.some((i) => i.relPath.includes("Trash")), "aucun fichier de .Trash-1000 ne doit apparaitre");
  console.log("  OK dossier cache ignore");

  console.log("== resolveUsbFile : fichier valide, y compris en sous-dossier ==");
  const full = resolveUsbFile(key1, path.join("ete", "montagne.PNG"), ROOTS);
  assert(full.endsWith(path.join("ete", "montagne.PNG")));
  console.log("  OK chemin resolu:", full);

  console.log("== resolveUsbFile : traversee de chemin bloquee ==");
  let blocked = false;
  try { resolveUsbFile(key1, "../../secret.jpg", ROOTS); } catch (e) { blocked = true; }
  assert(blocked, "../../secret.jpg doit etre rejete");
  console.log("  OK traversee bloquee");

  console.log("== resolveUsbFile : volume non monte refuse ==");
  let unmounted = false;
  try { resolveUsbFile("/media/jeanmichel/CLE_INCONNUE", "x.jpg", ROOTS); } catch (e) { unmounted = true; }
  assert(unmounted, "un volume qui n'apparait pas dans listVolumes() doit etre refuse");
  console.log("  OK volume non monte refuse");

  console.log("== Racine /media absente : pas d'erreur, liste vide ==");
  const empty = listVolumes([path.join(TMP, "nexiste-pas")]);
  assert.strictEqual(empty.length, 0);
  console.log("  OK liste vide sans erreur");

  console.log("\n>>> TOUS LES TESTS USBMEDIA PASSENT");
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
