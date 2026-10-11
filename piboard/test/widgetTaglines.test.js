/* Chaque tuile du catalogue doit porter une accroche COURTE (1.139.1).

   LE DEFAUT. La carte du catalogue affiche `tagline` et, a defaut,
   retombe sur la `description` complete (voir public/app.js). La tuile
   « Plan du circuit » est arrivee sans accroche : sa carte a donc
   affiche un paragraphe de deux cent soixante-dix caracteres, qui a
   pousse sa carte en hauteur et DECALE toute la rangee du catalogue.
   Rien n'etait casse, rien ne levait d'erreur -- la grille etait
   simplement laide, et seule une capture d'ecran le montrait.

   Un repli silencieux sur un texte quatre fois trop long est le genre
   de defaut qu'aucun test fonctionnel ne voit : la carte s'affiche, le
   texte est juste, et la mise en page est fausse. D'ou ce test, qui
   porte sur une CONTRAINTE DE FORME et l'assume.

   THE DEFECT: a catalogue card shows `tagline` and otherwise falls back
   to the full `description`. The Circuit map tile shipped without one,
   so its card displayed a 270-character paragraph, grew taller than its
   neighbours and SHIFTED the whole catalogue row. Nothing was broken
   and nothing threw -- the grid was merely ugly, and only a screenshot
   showed it. A silent fallback to a text four times too long is exactly
   what no functional test sees. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "public", "widgets");
const dirs = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, "manifest.json")));
assert.ok(dirs.length > 20, "le catalogue doit avoir ete trouve, " + dirs.length + " tuiles");

/* La plus longue accroche du catalogue au moment d'ecrire ce test fait
   une soixantaine de caracteres. Le plafond est fixe a 90 : assez large
   pour ne pas brider une formulation en francais, assez serre pour
   qu'un paragraphe entier ne passe jamais. */
const MAX = 90;

console.log("== chaque tuile porte une accroche, dans les deux langues ==");
const missing = [];
for (const d of dirs) {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, d, "manifest.json"), "utf8"));
  if (!m.tagline || !m.tagline.fr || !m.tagline.en) missing.push(d);
}
assert.deepStrictEqual(missing, [],
  "sans accroche, la carte du catalogue affiche la description complete et decale la rangee : " + missing.join(", "));
console.log("  OK (" + dirs.length + " tuiles)");

console.log("== une accroche tient sur une ligne ou deux ==");
const tooLong = [];
for (const d of dirs) {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, d, "manifest.json"), "utf8"));
  for (const lang of ["fr", "en"]) {
    const t = String(m.tagline[lang]);
    if (t.length > MAX) tooLong.push(d + "." + lang + " (" + t.length + " caracteres)");
  }
}
assert.deepStrictEqual(tooLong, [],
  "ces accroches depassent " + MAX + " caracteres et deformeront la grille : " + tooLong.join(", "));
console.log("  OK");

console.log("== une accroche n'est pas la description recopiee ==");
/* Recopier la description longue dans `tagline` contournerait le test
   precedent par la lettre tout en reproduisant le defaut. */
const copied = [];
for (const d of dirs) {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, d, "manifest.json"), "utf8"));
  if (!m.description) continue;
  for (const lang of ["fr", "en"]) {
    const desc = m.description[lang] || m.description;
    if (typeof desc === "string" && desc.trim() && desc.trim() === String(m.tagline[lang]).trim()) {
      copied.push(d + "." + lang);
    }
  }
}
assert.deepStrictEqual(copied, [], "accroche identique a la description : " + copied.join(", "));
console.log("  OK");

console.log("\nToutes les tuiles du catalogue ont une accroche courte.");
