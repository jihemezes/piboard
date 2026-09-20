/* Lecteur du calendrier et des resultats de la Ligue Nationale de Rugby
   (TOP 14 / PRO D2), adopte pour les MATCHS apres l'avoir ete pour le
   classement : ESPN ignore son propre parametre de dates sur le rugby
   et sa liste d'equipes est en retard d'une saison (le RC Vannes n'y
   figure pas).

   La fixture test/fixtures/lnr-top14-calendrier.html est un EXTRAIT
   VERBATIM de la page reelle (deux en-tetes de jour, deux matchs joues
   et un match a venir), pas une imitation ecrite a la main : c'est ce
   qui donne sa valeur au test. Les chiffres attendus sont ceux affiches
   par la LNR pour la J3 2026-2027.

   Reader for the LNR fixture list. The fixture is a VERBATIM extract of
   the real page, not a hand-written imitation. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

global.DOMParser = new JSDOM("").window.DOMParser;
const { parseLnrMatches, lnrDayDate, lnrScores, lnrApplyTime, LNR_SITES } =
  require("../public/widgets/sportscore/widget.js");

const HTML = fs.readFileSync(path.join(__dirname, "fixtures", "lnr-top14-calendrier.html"), "utf8");
const NOW = new Date(2026, 8, 20, 8, 0);   // dimanche 20 septembre 2026, au matin

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("== Calendrier et resultats lus dans la page servie par la LNR ==");

const events = parseLnrMatches(HTML, NOW);

test("les trois matchs de la fixture sont lus", () => {
  assert.ok(Array.isArray(events), "un tableau est renvoye");
  assert.strictEqual(events.length, 3);
});

test("le score du match de la veille est bien la", () => {
  // C'est LE cas signale : Vannes - Toulouse du samedi soir restait sans
  // score sur la tuile, ESPN ne le publiant pas.
  const m = events.find((e) => e.competitions[0].competitors[0].team.displayName === "RC Vannes");
  assert.ok(m, "le match du RC Vannes est trouve (ESPN ignore ce club)");
  assert.strictEqual(m.status.type.state, "post");
  assert.strictEqual(m.competitions[0].competitors[0].score, "23");
  assert.strictEqual(m.competitions[0].competitors[1].score, "29");
});

test("celui qui recoit est marque « home », celui qui se deplace « away »", () => {
  const m = events.find((e) => e.competitions[0].competitors[0].team.displayName === "RC Vannes");
  const [a, b] = m.competitions[0].competitors;
  assert.strictEqual(a.homeAway, "home");
  assert.strictEqual(b.homeAway, "away");
  assert.strictEqual(b.team.displayName, "Stade Toulousain");
});

test("la date du jour porte sur les matchs qui la suivent", () => {
  const vannes = events.find((e) => e.competitions[0].competitors[0].team.displayName === "RC Vannes");
  const bordeaux = events.find((e) => /Bordeaux/.test(e.competitions[0].competitors[0].team.displayName));
  assert.strictEqual(new Date(vannes.date).getDate(), 19, "samedi 19 septembre");
  assert.strictEqual(new Date(bordeaux.date).getDate(), 20, "dimanche 20 septembre");
  assert.strictEqual(new Date(vannes.date).getFullYear(), 2026, "annee deduite, la page ne l'ecrit pas");
});

test("un match a venir garde son horaire et n'a pas de score", () => {
  const b = events.find((e) => /Bordeaux/.test(e.competitions[0].competitors[0].team.displayName));
  assert.strictEqual(b.status.type.state, "pre");
  assert.strictEqual(b.competitions[0].competitors[0].score, "");
  const d = new Date(b.date);
  assert.strictEqual(d.getHours(), 21);
  assert.strictEqual(d.getMinutes(), 5, "21h05");
});

test("le rang du club est repris, sans le « e » de l'exposant", () => {
  const m = events.find((e) => e.competitions[0].competitors[0].team.displayName === "RC Vannes");
  assert.strictEqual(m.competitions[0].competitors[0].team.rank, 14);
  assert.strictEqual(m.competitions[0].competitors[1].team.rank, 2);
});

test("le bonus defensif affiche a cote du score n'est pas pris pour un score", () => {
  // La ligne Castres - Toulon porte une pastille « Bd » juste apres le score.
  const m = events.find((e) => /Castres/.test(e.competitions[0].competitors[0].team.displayName));
  assert.strictEqual(m.competitions[0].competitors[0].score, "29");
  assert.strictEqual(m.competitions[0].competitors[1].score, "27");
});

test("annee : une date de decembre lue en janvier appartient a l'annee precedente", () => {
  const d = lnrDayDate("samedi 27 decembre", new Date(2027, 0, 5));
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 11);
  assert.strictEqual(d.getDate(), 27);
});

test("annee : une date de janvier lue en decembre appartient a l'annee suivante", () => {
  const d = lnrDayDate("samedi 3 janvier", new Date(2026, 11, 28));
  assert.strictEqual(d.getFullYear(), 2027);
});

test("les accents et les libelles inattendus ne font pas echouer la lecture", () => {
  assert.ok(lnrDayDate("dimanche 4 février", new Date(2027, 1, 1)));
  assert.strictEqual(lnrDayDate("pas une date", NOW), null);
  assert.strictEqual(lnrScores("reporté"), null);
  assert.strictEqual(lnrApplyTime(new Date(2026, 8, 20), "").getHours(), 0, "sans heure, minuit");
});

test("une page qui ne contient pas de calendrier renvoie null, pas une liste vide", () => {
  assert.strictEqual(parseLnrMatches("<html><body><p>maintenance</p></body></html>", NOW), null);
});

test("les deux competitions de la LNR sont adressables", () => {
  assert.ok(/top14\.lnr\.fr/.test(LNR_SITES["lnr.top14"].url));
  assert.ok(/prod2\.lnr\.fr/.test(LNR_SITES["lnr.prod2"].url));
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
