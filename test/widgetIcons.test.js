/* Les icones du CATALOGUE doivent rester visibles, de jour comme de
   nuit (1.138.3).

   LE DEFAUT. L'icone de la tuile Formule 1 s'affichait en NOIR, donc
   invisible en mode nuit. La cause : elle etait peinte en
   `currentColor`, dans l'espoir de suivre la couleur du theme. Mais
   PiBoard affiche ces fichiers avec une balise `<img src="...">` (voir
   public/app.js) -- et un SVG charge en `<img>` est un DOCUMENT a part :
   il n'herite de RIEN de la page, ni couleur, ni variable CSS.
   `currentColor` y retombe donc sur le noir, quel que soit le theme.

   Deux sorties possibles : servir ces icones en ligne dans le HTML pour
   qu'elles heritent, ou leur donner une couleur propre. Le projet a
   choisi la seconde depuis toujours -- chaque tuile a sa teinte
   d'identite, qui la rend reconnaissable d'un coup d'oeil dans un
   catalogue de cent entrees -- et trois icones seulement y avaient
   echappe. Ce test interdit la rechute.

   THE DEFECT: the Formula 1 icon rendered BLACK, hence invisible in
   night mode, because it was painted with `currentColor`. PiBoard shows
   these files through an `<img>` tag, and an SVG loaded in `<img>` is a
   separate DOCUMENT that inherits NOTHING from the page -- so
   `currentColor` falls back to black whatever the theme. Each tile has
   its own identity colour; three icons had escaped that rule. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "public", "widgets");
const dirs = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, "icon.svg")));
assert.ok(dirs.length > 20, "le catalogue doit avoir ete trouve, " + dirs.length + " icones");

/* Luminance perceptuelle (BT.709) : le vert eclaire bien plus que le
   bleu a valeur egale, et une moyenne arithmetique declarerait « clair »
   un bleu nuit que personne ne distingue du noir.
   Perceptual luminance: an arithmetic mean would call a navy blue
   "light" when nobody can tell it from black. */
function luminance(hex) {
  const h = hex.length === 4
    ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    : hex.slice(1);
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

console.log("== aucune icone du catalogue ne s'en remet a `currentColor` ==");
const inherited = [];
const dark = [];
for (const d of dirs) {
  const svg = fs.readFileSync(path.join(DIR, d, "icon.svg"), "utf8");
  if (/currentColor/.test(svg)) { inherited.push(d); continue; }
  /* On regarde les couleurs REELLEMENT peintes : `fill="none"` ne peint
     rien et ne doit pas compter. */
  const colors = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g)].map((m) => m[1]);
  if (!colors.length) continue;
  const best = Math.max(...colors.map(luminance));
  if (best < 0.12) dark.push(d + " (luminance " + best.toFixed(3) + ")");
}
assert.deepStrictEqual(inherited, [],
  "`currentColor` dans une icone servie en <img> donne du NOIR, invisible en mode nuit : " + inherited.join(", "));
console.log("  OK (" + dirs.length + " icones)");

console.log("== aucune icone n'est si sombre qu'elle disparaisse de nuit ==");
assert.deepStrictEqual(dark, [],
  "ces icones n'ont aucun trait assez clair pour se voir sur un fond sombre : " + dark.join(", "));
console.log("  OK");

console.log("== les trois icones corrigees en 1.138.3 portent bien une couleur ==");
for (const d of ["f1", "image", "text"]) {
  const svg = fs.readFileSync(path.join(DIR, d, "icon.svg"), "utf8");
  const m = svg.match(/stroke="(#[0-9a-fA-F]{6})"/);
  assert.ok(m, d + " : une couleur explicite, et non une couleur heritee");
  assert.ok(luminance(m[1]) > 0.12, d + " : la couleur doit se voir sur fond sombre");
  console.log("  " + d + " -> " + m[1]);
}

console.log("\nToutes les icones du catalogue sont visibles dans les deux modes.");
