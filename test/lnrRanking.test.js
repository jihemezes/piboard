/* Lecteur du classement de la Ligue Nationale de Rugby
   (TOP 14 / PRO D2), adopte parce qu'ESPN ne publie plus ces
   competitions depuis 2022-23.

   La fixture test/fixtures/lnr-top14-classement.html est un EXTRAIT
   VERBATIM de la page reelle (en-tete de colonnes + trois lignes),
   pas une imitation ecrite a la main : c'est ce qui donne sa valeur au
   test. Les chiffres attendus ci-dessous sont ceux affiches par la LNR
   pour la J1 2026-2027.

   Reader for the Ligue Nationale de Rugby standings (TOP 14 / PRO D2),
   adopted because ESPN no longer publishes these competitions. The
   fixture is a VERBATIM extract of the real page (column header plus
   three rows), not a hand-written imitation: that is what gives the
   test its value. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

global.DOMParser = new JSDOM("").window.DOMParser;
const { parseLnrRanking, lnrSeasonNote, LNR_SITES } = require("../public/widgets/standings/widget.js");

const HTML = fs.readFileSync(path.join(__dirname, "fixtures", "lnr-top14-classement.html"), "utf8");

console.log("== Le classement est lu dans la page servie par la LNR ==");
const r = parseLnrRanking(HTML, "essential");
assert.ok(r, "un classement a ete trouve");
assert.deepStrictEqual(r.cols, ["W", "D", "L", "PTS"], "colonnes essentielles");
assert.strictEqual(r.rows.length, 3, "les trois lignes de la fixture");
assert.strictEqual(r.rows[0].team, "Union Bordeaux-B\u00e8gles", "nom du club, accents compris");
assert.strictEqual(r.rows[0].rank, 1, "rang deduit de l'ordre du tableau");
assert.deepStrictEqual(r.rows[0].values, ["1", "0", "0", "5"], "G / N / P / Pts de la J1");
assert.strictEqual(r.rows[1].team, "Castres Olympique");
console.log("  OK");

/* Le tableau est enferme dans un <template>, dont le contenu est INERTE :
   il n'appartient pas au document et querySelector sur le document ne le
   voit pas. Sans la recherche dans les fragments .content, la page
   semblait ne contenir aucun classement alors qu'il y etait. */
console.log("== Le contenu inerte des <template> est bien explore ==");
assert.ok(/<template>/.test(HTML), "la fixture reproduit bien le <template> du site");
assert.strictEqual(new DOMParser().parseFromString(HTML, "text/html")
  .querySelectorAll(".table-line--ranking-scrollable").length, 0,
  "le document seul ne voit rien -- c'est le piege que le lecteur contourne");
console.log("  OK");

/* Les colonnes sont reperees par l'EN-TETE de la page, pas par une
   position codee en dur : le jour ou la LNR intercale une colonne, les
   chiffres doivent suivre au lieu de se decaler d'une case -- un
   classement faux sans que rien ne le laisse paraitre. */
console.log("== Une colonne intercalee ne decale pas les chiffres ==");
const NEW_HEAD = '<div class="table-line__cell-wrapper table-line__cell-wrapper--small"><div class="ranking__head"> Nouveau </div></div>';
const NEW_CELL = '<div class="table-line__cell-wrapper table-line__cell-wrapper--small"><div class=""> 99 </div></div>';
const shifted2 = HTML
  // en-tete : la nouvelle colonne passe devant "Pts"
  .replace(/(<div class="table-line__cell-wrapper table-line__cell-wrapper--small">\s*<div class="ranking__head">)/, NEW_HEAD + "$1")
  // lignes : une cellule de plus devant la premiere cellule chiffree
  .split('<div class="table-line__cell-wrapper table-line__cell-wrapper--small">\n          <div class="table-line__cell--small">')
  .join(NEW_CELL + '<div class="table-line__cell-wrapper table-line__cell-wrapper--small">\n          <div class="table-line__cell--small">');
const r2 = parseLnrRanking(shifted2, "essential");
assert.ok(r2, "le classement reste lisible");
assert.deepStrictEqual(r2.rows[0].values, ["1", "0", "0", "5"],
  "les memes chiffres, malgre la colonne inseree");
console.log("  OK");

console.log("== Mode complet : les colonnes de contexte reviennent ==");
const full = parseLnrRanking(HTML, "full");
assert.deepStrictEqual(full.cols, ["GP", "W", "D", "L", "DIFF", "PTS"], "M et Diff en plus");
assert.strictEqual(full.rows[0].values[4], "+59", "la difference de points est reprise telle quelle");
console.log("  OK");

console.log("== Saison et journee, tirees du titre de la page ==");
assert.strictEqual(r.note, "2026-2027 \u2014 J1", "la journee accompagne la saison");
const doc = new DOMParser().parseFromString(
  "<html><head><title>Classement PRO D2 2026-2027 | Top 14</title></head><body></body></html>", "text/html");
assert.strictEqual(lnrSeasonNote(doc), "2026-2027", "sans journee au titre, la saison seule");
console.log("  OK");

console.log("== Une page sans classement est signalee, pas devinee ==");
assert.strictEqual(parseLnrRanking("<html><body><p>rien</p></body></html>", "essential"), null,
  "aucun classement fabrique a partir de rien");
console.log("  OK");

console.log("== Les deux competitions de la LNR sont adressables ==");
assert.ok(/^https:\/\/top14\.lnr\.fr\//.test(LNR_SITES.top14.url), "TOP 14");
assert.ok(/^https:\/\/prod2\.lnr\.fr\//.test(LNR_SITES.prod2.url), "PRO D2");
console.log("  OK");

console.log("\n>>> TOUS LES TESTS LNR PASSENT");
