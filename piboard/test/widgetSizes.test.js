/* Tailles declarees par les tuiles : toute tuile doit pouvoir couvrir la
   page entiere. Le tableau fait 12 colonnes (COLS dans public/app.js) et
   jusqu'a 16 lignes (le maximum du reglage gridRows). Une tuile dont le
   manifeste plafonnait en dessous ne pouvait pas etre agrandie a la
   taille de l'ecran, sans qu'aucune raison technique ne le justifie.
   Ce test verrouille la regle pour les tuiles a venir.

   Sizes declared by the tiles: every tile must be able to cover a whole
   page. The board is 12 columns wide (COLS in public/app.js) and up to
   16 rows tall (the gridRows setting's maximum). A tile whose manifest
   capped below that could not be enlarged to the screen's size, with no
   technical reason to justify it. This test locks the rule in for
   future tiles. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const COLS = 12;
const MAX_ROWS = 16;
const dir = path.join(__dirname, "..", "public", "widgets");

console.log("== Chaque tuile peut couvrir la page entiere ==");
{
  const ids = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "manifest.json")));
  assert.ok(ids.length > 20, "les manifestes doivent etre trouves");
  for (const id of ids) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, id, "manifest.json"), "utf8"));
    const s = m.size || {};
    assert.strictEqual(s.maxW, COLS, id + " : maxW doit valoir " + COLS + " (largeur du tableau)");
    assert.strictEqual(s.maxH, MAX_ROWS, id + " : maxH doit valoir " + MAX_ROWS + " (hauteur maximale du tableau)");
  }
  console.log("  OK   " + ids.length + " tuiles vont jusqu'a " + COLS + "x" + MAX_ROWS);
}

console.log("== Coherence des bornes ==");
{
  for (const id of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "manifest.json")))) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, id, "manifest.json"), "utf8")).size || {};
    // La taille par defaut doit tenir dans les bornes, sinon Gridstack
    // corrige en silence et la tuile n'a pas la taille annoncee.
    // The default size must fit within the bounds, otherwise Gridstack
    // silently corrects and the tile is not the announced size.
    assert.ok(s.minW <= s.w && s.w <= s.maxW, id + " : largeur par defaut hors bornes");
    assert.ok(s.minH <= s.h && s.h <= s.maxH, id + " : hauteur par defaut hors bornes");
  }
  console.log("  OK");
}

console.log("Tous les tests de tailles de tuiles sont passes.");
