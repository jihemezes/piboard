/* Tests hors ligne du moteur de la tuile Scores
   (public/widgets/sportscore/engine.js) : fenetre de dates, ordre des
   clubs (celui qui recoit en haut) et mise en ordre des matchs.
   Le cas de reference est reel : Stade Toulousain, en deplacement au RC
   Vannes le vendredi soir, dont le score n'apparaissait toujours pas le
   lendemain.
   Offline tests of the sport score engine: date window, host-on-top
   ordering and match ranking. */
"use strict";

const assert = require("assert");
const E = require("../public/widgets/sportscore/engine.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

const ev = (o) => ({
  date: o.date,
  status: { type: { state: o.state } },
  competitions: [{ competitors: o.competitors || [
    { homeAway: "home", score: o.homeScore, team: { displayName: o.home } },
    { homeAway: "away", score: o.awayScore, team: { displayName: o.away } }
  ] }]
});

console.log("== Tuile Scores ==");

test("fenetre : un match joue hier soir reste demande aujourd'hui", () => {
  const now = new Date(2026, 8, 20, 10, 0);          // samedi 20/09 au matin
  const win = E.dateWindow(now, 2, 7);
  assert.strictEqual(win, "20260918-20260927");
  // Le match du vendredi 19/09 au soir est dans la fenetre.
  assert.ok(win.split("-")[0] <= "20260919" && "20260919" <= win.split("-")[1]);
});

test("fenetre : changement de mois et d'annee", () => {
  assert.strictEqual(E.dateWindow(new Date(2027, 0, 1, 12, 0), 2, 7), "20261230-20270108");
});

test("ordre : celui qui recoit en haut, celui qui se deplace en bas", () => {
  // Cas reel : Toulouse se deplace, Vannes recoit.
  const e = ev({ date: "2026-09-19T18:55:00Z", state: "post", home: "RC Vannes", away: "Stade Toulousain", homeScore: "13", awayScore: "31" });
  const { home, away, known } = E.orderCompetitors(e.competitions[0]);
  assert.strictEqual(home.team.displayName, "RC Vannes");
  assert.strictEqual(away.team.displayName, "Stade Toulousain");
  assert.strictEqual(known, true);
});

test("ordre : l'ordre d'ESPN prime sur la place dans la liste", () => {
  // ESPN peut lister le visiteur en premier : c'est « homeAway » qui decide.
  const comp = { competitors: [
    { homeAway: "away", team: { displayName: "Stade Toulousain" } },
    { homeAway: "home", team: { displayName: "RC Vannes" } }
  ] };
  assert.strictEqual(E.orderCompetitors(comp).home.team.displayName, "RC Vannes");
});

test("ordre : sans indication, on n'invente pas", () => {
  const comp = { competitors: [{ team: { displayName: "A" } }, { team: { displayName: "B" } }] };
  const o = E.orderCompetitors(comp);
  assert.strictEqual(o.home.team.displayName, "A");
  assert.strictEqual(o.known, false);
});

test("ordre : une competition vide ne fait pas planter la tuile", () => {
  const o = E.orderCompetitors({});
  assert.strictEqual(o.home, null);
  assert.strictEqual(o.away, null);
});

test("mise en ordre : en direct, puis termine recemment, puis a venir", () => {
  const now = new Date("2026-09-20T09:00:00Z");
  const list = [
    ev({ date: "2026-09-21T18:00:00Z", state: "pre", home: "Futur", away: "X" }),
    ev({ date: "2026-08-01T18:00:00Z", state: "post", home: "Vieux", away: "X" }),
    ev({ date: "2026-09-19T18:55:00Z", state: "post", home: "Hier", away: "X" }),
    ev({ date: "2026-09-20T08:00:00Z", state: "in", home: "Direct", away: "X" })
  ];
  const names = E.rank(list, now).map((e) => e.competitions[0].competitors[0].team.displayName);
  assert.deepStrictEqual(names, ["Direct", "Hier", "Futur", "Vieux"]);
});

test("mise en ordre : le match d'hier soir passe devant celui d'avant-hier", () => {
  const now = new Date("2026-09-20T09:00:00Z");
  const list = [
    ev({ date: "2026-09-18T18:55:00Z", state: "post", home: "Avant-hier", away: "X" }),
    ev({ date: "2026-09-19T18:55:00Z", state: "post", home: "Hier", away: "X" })
  ];
  assert.strictEqual(E.rank(list, now)[0].competitions[0].competitors[0].team.displayName, "Hier");
});

test("filtre : le nom, l'abreviation ou la ville suffisent", () => {
  const e = ev({ date: "2026-09-19T18:55:00Z", state: "post", competitors: [
    { homeAway: "home", team: { displayName: "RC Vannes", abbreviation: "VAN", location: "Vannes" } },
    { homeAway: "away", team: { displayName: "Stade Toulousain", abbreviation: "ST", location: "Toulouse" } }
  ] });
  assert.strictEqual(E.matchesFilter(e, "toulouse"), true, "la ville, alors que le club s'appelle Toulousain");
  assert.strictEqual(E.matchesFilter(e, "VAN"), true);
  assert.strictEqual(E.matchesFilter(e, ""), true);
  assert.strictEqual(E.matchesFilter(e, "Bayonne"), false);
});

test("choix : filtre, ordre et nombre maximum ensemble", () => {
  const now = new Date("2026-09-20T09:00:00Z");
  const list = [
    ev({ date: "2026-09-26T18:00:00Z", state: "pre", home: "Toulouse", away: "Y" }),
    ev({ date: "2026-09-19T18:55:00Z", state: "post", home: "RC Vannes", away: "Stade Toulousain", homeScore: "13", awayScore: "31" }),
    ev({ date: "2026-09-19T14:35:00Z", state: "post", home: "Lyon", away: "Pau" })
  ];
  const out = E.pick(list, { now, filter: "toulous", max: 5 });
  assert.strictEqual(out.length, 2, "Lyon-Pau est ecarte par le filtre");
  assert.strictEqual(out[0].competitions[0].competitors[0].team.displayName, "RC Vannes",
    "le match termine hier soir passe avant le prochain");
  assert.strictEqual(E.pick(list, { now, max: 1 }).length, 1);
});

test("choix : une entree incomplete est ignoree, pas propagee", () => {
  const now = new Date("2026-09-20T09:00:00Z");
  const out = E.pick([null, { date: "x" }, ev({ date: "2026-09-19T18:55:00Z", state: "post", home: "A", away: "B" })], { now });
  assert.strictEqual(out.length, 1);
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
