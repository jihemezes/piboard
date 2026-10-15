/* Test de l'option « Suivre le calendrier de MotoGP » de la tuile Circuits.

   Ce que ce test garde, et pourquoi chaque point est la :

   1. LE FLUX NE SERT QUE POUR LES GRANDS PRIX. Il contient aussi des
      tests, des presentations d'ecuries et des rendez-vous presse : les
      prendre pour des courses ferait afficher « Sepang test » en
      janvier a la place du prochain Grand Prix.
   2. LE RATTACHEMENT AU CIRCUIT NE SE FAIT PAS PAR LES COORDONNEES
      D'ABORD. Le flux place Le Mans a 6 km du circuit Bugatti et
      Mandalika a 25 km du sien : un rattachement « le plus proche »
      echoue exactement sur ces deux-la. L'identifiant du circuit dans le
      flux, ecrit dans la base, est la reference.
   3. LA BASE PORTE LES 22 CIRCUITS DU CALENDRIER 2026, chacun avec son
      identifiant de flux et sa longueur, et tous sauf Le Mans-Bugatti
      avec un trace. Si un circuit est retire ou perd son trace, ce test
      le dit avant l'ecran.
   4. LA FICHE MOTOGP RESTE A PART de celle de la F1.

   This test guards the "Follow the MotoGP calendar" option: the feed's
   non-race events are ignored, circuits are matched by the feed's own
   circuit id (coordinates are wrong for two of them), the base carries
   all 22 circuits of the 2026 calendar, and the MotoGP spec block stays
   apart from Formula 1's. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const sandbox = {
  window: { PiBoard: { registerWidget() { } } },
  navigator: { language: "fr-FR" },
  document: { createElement: () => ({ setAttribute() { }, style: {} }) },
  CSS: { escape: (x) => String(x) },
  setInterval: () => 0, clearInterval() { }, setTimeout: () => 0, clearTimeout() { },
  fetch: () => Promise.reject(new Error("aucun reseau dans ce test")),
  Intl, console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "public/widgets/circuit/widget.js"), "utf8"), sandbox);
const H = sandbox.window.PiBoardCircuitHelpers;

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/circuit-catalog.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/widgets/circuit/manifest.json"), "utf8"));

console.log("== le mode se lit dans le reglage `circuit` ==");
assert.strictEqual(H.followMode(""), "f1");
assert.strictEqual(H.followMode(undefined), "f1");
assert.strictEqual(H.followMode("follow:motogp"), "motogp");
assert.strictEqual(H.followMode("monza"), "pinned");
assert.strictEqual(H.FOLLOW_MOTOGP, "follow:motogp");
console.log("  OK");

console.log("== le calendrier MotoGP : seuls les Grands Prix, seules les seances MotoGP ==");
const sess = (code, name, start, acr) => ({ type: "SESSION", shortname: code, name, date_start: start, category: { acronym: acr || "MGP" } });
const FEED = [
  { kind: "TEST", name: "SEPANG TEST", sequence: 0, country: "MY", circuit: { id: "c-sepang", name: "Sepang", lat: "2.76", lng: "101.73" }, broadcasts: [sess("FP1", "x", "2026-02-03T10:00:00+0800")] },
  {
    kind: "GP", name: "PT GRAND PRIX OF THAILAND", additional_name: "THAILAND", sequence: 1, country: "TH", date_end: "2026-03-01T18:00:00+0700",
    circuit: { id: "c-buriram", name: "Chang International Circuit", country: "Thailand", city: "Buriram", lat: "14.9578", lng: "103.0848" },
    broadcasts: [
      { type: "MEDIA", shortname: "PRESS", name: "Pre-Event Press Conference", date_start: "2026-02-26T18:00:00+0700", category: { acronym: "MGP" } },
      sess("FP1", "Free Practice Nr. 1", "2026-02-27T10:45:00+0700"),
      sess("FP1", "Free Practice Nr. 1", "2026-02-27T09:00:00+0700", "MT3"),
      sess("PR", "Practice", "2026-02-27T15:00:00+0700"),
      sess("Q2", "Qualifying Nr. 2", "2026-02-28T10:50:00+0700"),
      sess("SPR", "Sprint", "2026-02-28T15:00:00+0700"),
      sess("WUP", "Warm Up", "2026-03-01T09:40:00+0700"),
      sess("RAC", "Grand Prix", "2026-03-01T15:00:00+0700")
    ]
  },
  {
    /* Le Mans tel que le flux le donne : a 6 km de son circuit. */
    kind: "GP", name: "MICHELIN GRAND PRIX OF FRANCE", additional_name: "FRANCE ", sequence: 5, country: "FR", date_end: "2026-05-10T18:00:00+0200",
    circuit: { id: "c-lemans", name: "Le Mans", country: "France", city: "Le Mans", lat: "48.00611", lng: "0.199556" },
    broadcasts: [sess("RAC", "Grand Prix", "2026-05-10T14:00:00+0200")]
  },
  {
    /* Une course reprise : RAC2 est une course, la derniere compte. */
    kind: "GP", name: "GRAND PRIX OF QATAR", additional_name: "QATAR", sequence: 20, country: "QA", date_end: "2026-11-08T18:00:00+0300",
    circuit: { id: "c-lusail", name: "Lusail", country: "Qatar", city: "Lusail", lat: "25.4862", lng: "51.4528" },
    broadcasts: [sess("RAC", "Grand Prix", "2026-11-08T17:00:00+0300"), sess("RAC2", "Grand Prix", "2026-11-08T19:00:00+0300")]
  }
];
const cal = H.parseMotoGpCalendar(FEED);
assert.strictEqual(cal.length, 3, "le test de Sepang n'est pas un Grand Prix");
assert.strictEqual(cal[0].round, 1);
const th = cal[0];
assert.deepStrictEqual(th.sessions.map((x) => x.kind), ["fp1", "practice", "q2", "sprint", "warmup", "race"],
  "ni la presse, ni les classes Moto2/Moto3");
assert.ok(th.sessions.every((x) => x.series === "motogp"));
assert.strictEqual(th.at, Date.parse("2026-03-01T15:00:00+07:00"), "l'heure de la course est celle du dimanche");
assert.strictEqual(cal[2].at, Date.parse("2026-11-08T19:00:00+03:00"), "RAC2 : la derniere course compte");
assert.strictEqual(H.parseMotoGpCalendar("pas un tableau"), null);
assert.strictEqual(H.motogpKind("RAC2"), "race");
assert.strictEqual(H.motogpKind("???"), "");
console.log("  OK");

console.log("== l'enchainement des Grands Prix, comme en Formule 1 ==");
const before = Date.parse("2026-03-01T12:00:00+07:00");
assert.strictEqual(H.currentRace(cal, before).circuitName, "Chang International Circuit");
assert.strictEqual(H.currentRace(cal, Date.parse("2026-03-01T19:00:00+07:00")).circuitName, "Le Mans", "trois heures apres le depart, on passe au suivant");
const nxt = H.nextSession(th, Date.parse("2026-02-28T12:00:00+07:00"));
assert.strictEqual(nxt.kind, "sprint");
assert.strictEqual(H.currentRace(cal, Date.parse("2027-01-01T00:00:00Z")).circuitName, "Lusail", "saison finie : le dernier circuit reste");
console.log("  OK");

console.log("== le rattachement au circuit de la base ==");
const lemans = cal.find((r) => r.circuitName === "Le Mans");
assert.ok(Math.abs(lemans.lat - 47.95372) > 0.04, "le flux place bien Le Mans loin du circuit Bugatti (c'est le piege)");
const fake = { circuits: {
  bugatti: { specs: { lat: 47.95372, lon: 0.21078, series: ["motogp"], motogp: { feedId: "c-lemans" } } },
  lemans: { specs: { lat: 47.94986, lon: 0.20753, series: ["wec"] } },
  near: { specs: { lat: 14.96, lon: 103.09, series: ["motogp"] } }
} };
assert.strictEqual(H.matchMotoGpCircuit(fake, lemans), "bugatti", "par l'identifiant du flux, malgre les coordonnees");
assert.strictEqual(H.matchMotoGpCircuit(fake, th), "near", "a defaut, le plus proche a moins de 4 km");
assert.strictEqual(H.matchMotoGpCircuit({ circuits: {} }, th), "", "rien ne correspond : pas d'invention");
assert.strictEqual(H.matchMotoGpCircuit(null, th), "");
console.log("  OK");

console.log("== le nom du Grand Prix, dans la langue ==");
assert.strictEqual(H.motogpRaceName({ place: "THAILAND", iso: "TH" }, "fr"), "Thaïlande");
assert.strictEqual(H.motogpRaceName({ place: "THAILAND", iso: "TH" }, "en"), "Thailand");
assert.strictEqual(H.motogpRaceName({ place: "FRANCE ", iso: "FR" }, "fr"), "France");
assert.strictEqual(H.motogpRaceName({ place: "USA", iso: "US" }, "fr"), "États-Unis");
assert.strictEqual(H.motogpRaceName({ place: "GREAT BRITAIN", iso: "GB" }, "fr"), "Royaume-Uni");
assert.strictEqual(H.motogpRaceName({ place: "CATALONIA", iso: "ES" }, "fr"), "Catalonia", "pas le nom du pays : on garde celui du flux");
assert.strictEqual(H.motogpRaceName({ place: "SAN MARINO", iso: "SM" }, "en"), "San Marino");
assert.strictEqual(H.motogpRaceName({ place: "", iso: "ES" }, "en"), "");
console.log("  OK");

console.log("== la base porte les 22 circuits du calendrier 2026 ==");
const CAL26 = ["buriram", "goiania", "americas", "jerez", "bugatti", "catalunya", "mugello", "balaton", "brno", "assen", "sachsenring",
  "silverstone", "aragon", "misano", "red_bull_ring", "motegi", "mandalika", "phillip_island", "sepang", "losail", "algarve", "ricardo_tormo"];
const bare = [];
for (const id of CAL26) {
  const c = catalog.circuits[id];
  assert.ok(c, "circuit absent de la base : " + id);
  assert.ok(c.specs.series.includes("motogp"), id + " doit etre marque MotoGP");
  const m = c.specs.motogp;
  assert.ok(m && m.feedId, id + " : identifiant du flux manquant");
  assert.ok(m.lengthM > 3000 && m.lengthM < 7000, id + " : longueur MotoGP");
  assert.ok(Number.isFinite(m.left) && Number.isFinite(m.right), id + " : virages gauche/droite");
  assert.ok(m.straightM > 300, id + " : plus longue ligne droite");
  assert.ok(Number.isFinite(c.specs.lat) && Number.isFinite(c.specs.lon), id + " : coordonnees dans la fiche");
  if (c.ways.length) {
    assert.ok(!c.incomplete, id + " : un trace ne peut pas etre « incomplete »");
  } else {
    assert.strictEqual(c.incomplete, true, id + " : sans trace, il doit le declarer");
    bare.push(id);
  }
}
assert.deepStrictEqual(bare, ["bugatti"], "seul Le Mans-Bugatti reste sans trace (OSM l'entremele avec le circuit des 24 Heures)");
const ids = CAL26.map((id) => catalog.circuits[id].specs.motogp.feedId);
assert.strictEqual(new Set(ids).size, ids.length, "un identifiant de flux par circuit, jamais deux");
console.log("  OK (" + CAL26.length + " circuits, " + (CAL26.length - bare.length) + " traces)");

console.log("== le rattachement tient sur la VRAIE base ==");
for (const id of CAL26) {
  const m = catalog.circuits[id].specs.motogp;
  const race = { feedId: m.feedId, lat: 0, lon: 0 };
  assert.strictEqual(H.matchMotoGpCircuit(catalog, race), id, id + " retrouve par son identifiant de flux");
}
console.log("  OK");

console.log("== la fiche MotoGP ne contamine pas celle de la F1 ==");
const { apply } = require(path.join(ROOT, "scripts/circuit-motogp.js"));
const seedF1 = [{ id: "rbr", lat: 47.2196, lon: 14.7651, specs: { lengthM: 4318, openedYear: 1969, series: ["f1", "motogp"] } }];
apply(seedF1, [{ feedId: "rbr", name: "Red Bull Ring", lat: 47.2196, lon: 14.7651, lengthM: 4348, left: 3, right: 8, straightM: 700, built: 1970 }]);
assert.strictEqual(seedF1[0].specs.lengthM, 4318, "le chiffre F1 existant n'est jamais ecrase");
assert.strictEqual(seedF1[0].specs.openedYear, 1969);
assert.strictEqual(seedF1[0].specs.motogp.lengthM, 4348, "le chiffre MotoGP va dans son propre bloc");
for (const id of Object.keys(catalog.circuits)) {
  const sp = catalog.circuits[id].specs;
  if (!sp.series.includes("motogp")) assert.ok(!sp.motogp, id + " n'est pas MotoGP : pas de bloc motogp");
}
console.log("  OK");

console.log("== le manifeste ==");
const f = manifest.settings.find((x) => x.key === "circuit");
assert.strictEqual(f.default, "", "le defaut reste la Formule 1 : rien ne change pour l'existant");
assert.ok(f.extraOptions && f.extraOptions.length === 1);
assert.strictEqual(f.extraOptions[0].value, H.FOLLOW_MOTOGP);
assert.strictEqual(f.extraOptions[0].label.fr, "Suivre le calendrier de MotoGP");
assert.strictEqual(f.extraOptions[0].label.en, "Follow the MotoGP calendar");
assert.strictEqual(f.emptyLabel.fr, "Suivre le calendrier de Formule 1");
console.log("  OK");

console.log("== l'identification du sport : « motor;speedway » est un circuit ==");
const { isOtherSport } = require(path.join(ROOT, "scripts/circuit-catalog.js"));
assert.strictEqual(isOtherSport("motor;speedway"), false, "Goiania est tagge ainsi");
assert.strictEqual(isOtherSport("motor"), false);
assert.strictEqual(isOtherSport("speedway"), true, "un ovale seul reste ecarte");
assert.strictEqual(isOtherSport("karting"), true);
assert.strictEqual(isOtherSport("motocross"), true);
assert.strictEqual(isOtherSport(undefined), false);
console.log("  OK");

console.log("== le script de la fiche MotoGP ==");
const { circuitsOf, matchSeed } = require(path.join(ROOT, "scripts/circuit-motogp.js"));
const trk = (len, active, mod, l, r) => ({ lenght: String(len), is_active: active, modification_date: mod, left_corners: String(l), right_corners: String(r), longest_straight: "700" });
const got = circuitsOf([
  { kind: "GP", circuit: { id: "rbr", name: "Red Bull Ring", lat: "47.2", lng: "14.76", constructed: 1969, tracks: [trk(4348, true, "2022-01-01T00:00:00+00:00", 3, 8), trk(4318, true, "1899-12-29T00:00:00+00:00", 3, 8)] } },
  { kind: "GP", circuit: { id: "goi", name: "Goiania", lat: "-16.7", lng: "-49.19", tracks: [trk(3835, false, "", 5, 9)] } },
  { kind: "TEST", circuit: { id: "x", name: "Test", lat: "1", lng: "1", tracks: [] } }
]);
assert.strictEqual(got.length, 2, "les tests sont ecartes");
assert.strictEqual(got[0].lengthM, 4348, "le trace actif le plus recent");
assert.strictEqual(got[1].lengthM, 3835, "aucun actif dans le flux : on prend le seul qui existe");
const seeds = [{ id: "bugatti", lat: 47.95372, lon: 0.21078, specs: { series: ["motogp"] } }, { id: "lemans", lat: 47.94986, lon: 0.20753, specs: { series: ["wec"] } }];
assert.strictEqual(matchSeed(seeds, { name: "Le Mans", lat: 48.00611, lon: 0.199556 }).id, "bugatti", "nomme dans OVERRIDES : le flux se trompe de 6 km");
assert.strictEqual(matchSeed(seeds, { name: "Ailleurs", lat: 10, lon: 10 }), null, "rien de proche : on n'invente pas");
console.log("  OK");

console.log("\nTOUS LES TESTS PASSENT (circuit MotoGP)");
