/* ============================================================
   PiBoard - test/whatsnew.test.js
   Verifie WHATSNEW.md, la source de la section « Nouveautes » de
   l'aide.

   CE QUI EST VERIFIE ICI, ET POURQUOI. Ce fichier est ecrit a la main a
   chaque livraison : c'est exactement le genre de fichier qui derive
   sans bruit. Une version oubliee, un bloc anglais manquant, un ordre
   casse -- rien de tout cela ne fait planter l'application, on s'en
   apercoit six mois plus tard en ouvrant l'aide. D'ou ces garde-fous.

   CE QUI N'EST PAS VERIFIE. Que chaque version du CHANGELOG figure ici :
   c'est justement le contraire qu'on veut, les versions qui ne
   corrigent que des bugs n'ont rien a y faire. En revanche la version
   COURANTE doit y etre si elle a apporte une fonctionnalite -- ce
   qu'aucun test ne peut deviner, donc c'est laisse au jugement.

   Checks WHATSNEW.md, the source of the help's "What's new" section:
   bilingual blocks, descending order, no duplicates, dates parseable,
   and the fold threshold actually splitting the file in two.
   ============================================================ */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RAW = fs.readFileSync(path.join(__dirname, "..", "WHATSNEW.md"), "utf8");
const FOLD = "1.87.0";

function cmp(a, b) {
  const pa = String(a).split("."), pb = String(b).split(".");
  for (let i = 0; i < 3; i++) {
    const d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
    if (d) return d;
  }
  return 0;
}

/* Meme lecture que celle de public/app.js (parseVersions) : si les deux
   divergent, ce test ne prouve plus rien -- d'ou la forme volontairement
   identique de l'expression.
   Same reading as public/app.js (parseVersions): deliberately the same
   expression, otherwise this test proves nothing about what is shown. */
function parse(raw) {
  return raw.replace(/\r\n/g, "\n").split(/\n(?=## )/).map((part) => {
    const m = part.match(/^##\s+(\S+)(?:\s*[-—]\s*(\d{4}-\d{2}-\d{2}))?\s*\n([\s\S]*)$/);
    return m ? { version: m[1], date: m[2] || null, body: m[3] } : null;
  }).filter(Boolean);
}

(function main() {
  const versions = parse(RAW);

  console.log("== WHATSNEW.md : le fichier est lisible et non vide ==");
  assert.ok(versions.length > 20, "au moins une vingtaine de versions attendues, lues : " + versions.length);
  console.log("  OK (" + versions.length + " versions)");

  console.log("== Chaque version porte un numero bien forme ==");
  for (const v of versions) {
    assert.ok(/^\d+\.\d+\.\d+$/.test(v.version), "numero de version inattendu : " + v.version);
  }
  console.log("  OK");

  console.log("== Aucune version en double ==");
  const seen = new Set();
  for (const v of versions) {
    assert.ok(!seen.has(v.version), "version en double : " + v.version);
    seen.add(v.version);
  }
  console.log("  OK");

  console.log("== Les versions sont du plus recent au plus ancien ==");
  for (let i = 1; i < versions.length; i++) {
    assert.ok(cmp(versions[i - 1].version, versions[i].version) > 0,
      "ordre casse : " + versions[i - 1].version + " avant " + versions[i].version);
  }
  console.log("  OK");

  /* Le bloc anglais n'est pas decoratif : c'est tout ce que voit une
     personne qui a mis l'interface en anglais. Une entree sans « --- »
     lui montrerait du francais.
     The English block is all an English-language user sees. */
  console.log("== Chaque version a bien ses deux blocs, francais et anglais ==");
  for (const v of versions) {
    const halves = v.body.split(/\n-{3,}\n/);
    assert.strictEqual(halves.length, 2, "version " + v.version + " : separation bilingue manquante ou multiple");
    assert.ok(halves[0].trim().length > 0, "version " + v.version + " : bloc francais vide");
    assert.ok(halves[1].trim().length > 0, "version " + v.version + " : bloc anglais vide");
    assert.ok(/^\*\*.+\*\*/.test(halves[0].trim()), "version " + v.version + " : le bloc FR doit commencer par un titre en gras");
    assert.ok(/^\*\*.+\*\*/.test(halves[1].trim()), "version " + v.version + " : le bloc EN doit commencer par un titre en gras");
  }
  console.log("  OK");

  console.log("== Les dates presentes sont de vraies dates ==");
  let dated = 0;
  for (const v of versions) {
    if (!v.date) continue;
    dated++;
    const d = new Date(v.date + "T12:00:00");
    assert.ok(!isNaN(d), "date illisible pour " + v.version + " : " + v.date);
    assert.ok(d.getFullYear() >= 2024 && d <= new Date(Date.now() + 86400000),
      "date hors plage plausible pour " + v.version + " : " + v.date);
  }
  console.log("  OK (" + dated + " version(s) datee(s) ; les dates sont posees par tools/whatsnew-dates.js)");

  /* Les dates, quand elles existent, doivent elles aussi decroitre : une
     etiquette posee sur le mauvais commit se verrait ici.
     Dates must decrease too: a tag on the wrong commit shows up here. */
  console.log("== Les dates suivent l'ordre des versions ==");
  const withDate = versions.filter((v) => v.date);
  for (let i = 1; i < withDate.length; i++) {
    assert.ok(withDate[i - 1].date >= withDate[i].date,
      "dates incoherentes : " + withDate[i - 1].version + " (" + withDate[i - 1].date + ") avant "
      + withDate[i].version + " (" + withDate[i].date + ")");
  }
  console.log("  OK");

  console.log("== Le seuil de repli coupe effectivement le fichier en deux ==");
  const recent = versions.filter((v) => cmp(v.version, FOLD) >= 0);
  const older = versions.filter((v) => cmp(v.version, FOLD) < 0);
  assert.ok(recent.length >= 5, "trop peu de versions recentes au-dessus de " + FOLD + " : " + recent.length);
  assert.ok(older.length >= 5, "trop peu de versions anciennes sous " + FOLD + " : " + older.length);
  assert.ok(versions.some((v) => v.version === FOLD), "la version seuil " + FOLD + " doit figurer dans le fichier");
  console.log("  OK (" + recent.length + " visibles d'emblee, " + older.length + " repliees)");

  /* La raison d'etre du fichier : on n'y parle pas de bugs. Le mot
     « correctif » y est donc suspect -- pas interdit dans une phrase
     qui explique une fonctionnalite, mais interdit en TITRE d'entree,
     la ou il annoncerait une version qui n'a rien apporte.
     The point of the file: no fix-only entries. "Correctif" / "fix" is
     banned from entry TITLES. */
  console.log("== Aucune entree ne s'annonce comme un simple correctif ==");
  for (const v of versions) {
    const titles = (v.body.match(/^\*\*(.+?)\*\*/gm) || []).join(" ").toLowerCase();
    for (const word of ["correctif", "corrige", "bug fix", "bugfix", "fixed:"]) {
      assert.ok(titles.indexOf(word) < 0,
        "version " + v.version + " : le titre annonce un correctif (\"" + word + "\"), ce fichier ne parle que de fonctionnalites");
    }
  }
  console.log("  OK");

  console.log("== Le fichier courant est bien celui que sert la route /api/whatsnew ==");
  const server = fs.readFileSync(path.join(__dirname, "..", "server", "index.js"), "utf8");
  assert.ok(server.indexOf('app.get("/api/whatsnew"') >= 0, "route /api/whatsnew absente du serveur");
  assert.ok(server.indexOf('"WHATSNEW.md"') >= 0, "la route ne sert pas WHATSNEW.md");
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  assert.ok(app.indexOf('fetch("/api/whatsnew")') >= 0, "l'aide ne lit pas /api/whatsnew");
  assert.ok(app.indexOf('const WHATSNEW_FOLD = "' + FOLD + '"') >= 0,
    "le seuil de repli de app.js ne correspond plus a celui de ce test (" + FOLD + ")");
  console.log("  OK");

  console.log("\n>>> TOUS LES TESTS WHATSNEW PASSENT");
})();
