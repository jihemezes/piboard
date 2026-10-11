/* Tests du rattrapage des fuseaux horaires (public/tzfix.js).

   CE QUE CES TESTS NE PEUVENT PAS FAIRE. On ne peut pas remplacer la
   base tzdata compilee dans le Node qui les execute : un test qui
   attendrait « Africa/Casablanca vaut UTC+1 pour la base embarquee »
   passerait aujourd'hui et echouerait le jour ou Node embarquerait une
   tzdata a jour -- c'est-a-dire qu'il signalerait comme une panne
   exactement le denouement qu'on attend. Les assertions ci-dessous sont
   donc ecrites pour etre VRAIES DANS LES DEUX MONDES : base en retard
   et base a jour.

   LE CONTRAT REELLEMENT VERIFIE : quelle que soit ce que croit la base
   embarquee, l'heure rendue pour un fuseau corrige est celle de l'heure
   legale. Et son corollaire, le cas qui casserait tout s'il etait
   manque : quand la base est DEJA juste, la correction doit valoir
   zero, faute de quoi PiBoard decalerait l'horloge le jour de la mise a
   jour d'Electron. Ce cas-la est teste en injectant un override sur un
   fuseau dont la base est forcement a jour.

   WHAT THESE TESTS CANNOT DO. The tzdata compiled into the running Node
   cannot be swapped, so an assertion expecting "the embedded database
   says UTC+1 for Africa/Casablanca" would pass today and fail the day
   Node ships an up-to-date tzdata -- flagging as a failure the very
   outcome we are waiting for. The assertions below are therefore
   written to hold IN BOTH WORLDS. The contract actually checked: the
   time rendered for a corrected zone is the legal time, whatever the
   embedded database believes; and its corollary, the case that would
   break everything if missed -- when the database is ALREADY right, the
   correction must be zero. */
"use strict";

const assert = require("assert");
const TZ = require("../public/tzfix.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

/* Instants figes autour de la bascule marocaine du 20/09/2026 02h00
   locales = 01h00 UTC. Frozen instants around the Moroccan switch. */
const BEFORE = new Date(Date.UTC(2026, 8, 19, 12, 0, 0));
const AFTER = new Date(Date.UTC(2026, 8, 23, 6, 30, 0));
const CASA = "Africa/Casablanca";

/* Heure murale rendue, exprimee en minutes depuis minuit UTC du meme
   jour -- sert a verifier que nowInZone respecte le decalage annonce
   sans dependre du fuseau de la machine qui execute les tests.
   The wall-clock time rendered, as an offset in minutes from the
   reference instant -- independent of the test machine's own zone. */
function renderedOffsetMinutes(zone, at) {
  const d = TZ.nowInZone(zone, at);
  const wallUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds());
  return Math.round((wallUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

console.log("== Table d'overrides / override table ==");

test("le Maroc est decrit a UTC+0 apres la bascule", () => {
  assert.strictEqual(TZ.expectedOffsetMinutes(CASA, AFTER), 0);
});

test("avant la bascule, aucune regle ne s'applique", () => {
  assert.strictEqual(TZ.expectedOffsetMinutes(CASA, BEFORE), null);
  assert.strictEqual(TZ.correctionMinutes(CASA, BEFORE), 0);
});

test("la bascule prend effet a la seconde pres", () => {
  const rule = TZ.OVERRIDES.find((r) => r.zone === CASA);
  assert.strictEqual(TZ.expectedOffsetMinutes(CASA, new Date(rule.from - 1000)), null);
  assert.strictEqual(TZ.expectedOffsetMinutes(CASA, new Date(rule.from)), 0);
});

test("un fuseau absent de la table n'est jamais corrige", () => {
  for (const z of ["Europe/Paris", "America/New_York", "Asia/Tokyo", "UTC"]) {
    assert.strictEqual(TZ.correctionMinutes(z, AFTER), 0, z);
  }
});

console.log("== Heure rendue / rendered time ==");

test("apres la bascule, le Maroc est rendu a l'heure legale (UTC+0)", () => {
  assert.strictEqual(renderedOffsetMinutes(CASA, AFTER), 0);
});

test("les autres fuseaux sont rendus tels que la base les donne", () => {
  for (const z of ["Europe/Paris", "Asia/Tokyo"]) {
    assert.strictEqual(renderedOffsetMinutes(z, AFTER), TZ.intlOffsetMinutes(z, AFTER), z);
  }
});

test("un fuseau vide ou invalide rend l'heure du systeme, sans lever", () => {
  for (const z of ["", null, undefined, "Pas/UnFuseau"]) {
    const d = TZ.nowInZone(z, AFTER);
    assert.ok(d instanceof Date && !isNaN(d.getTime()));
    assert.strictEqual(d.getTime(), AFTER.getTime());
  }
});

console.log("== Base deja a jour / already up-to-date database ==");

/* LE CAS QUI COMPTE. On injecte un override annoncant, pour un fuseau
   quelconque, exactement ce que la base embarquee croit deja. La
   correction doit valoir zero : c'est la situation du jour ou Electron
   rattrapera son retard sur le Maroc, et corriger alors decalerait
   l'horloge d'une heure dans l'autre sens.
   THE CASE THAT MATTERS: an override announcing exactly what the
   embedded database already believes must correct nothing. */
test("un override qui confirme la base ne corrige rien", () => {
  const zone = "Europe/Lisbon";
  const already = TZ.intlOffsetMinutes(zone, AFTER);
  TZ.OVERRIDES.push({ zone, from: Date.UTC(2020, 0, 1), offset: already, label: { fr: "t", en: "t" }, source: "test" });
  try {
    assert.strictEqual(TZ.correctionMinutes(zone, AFTER), 0);
    assert.strictEqual(TZ.isStale(zone, AFTER), false);
    assert.strictEqual(renderedOffsetMinutes(zone, AFTER), already);
    assert.ok(!TZ.correctedZones(AFTER).includes(zone));
  } finally { TZ.OVERRIDES.pop(); }
});

test("un override qui contredit la base corrige de l'ecart exact", () => {
  const zone = "Europe/Lisbon";
  const already = TZ.intlOffsetMinutes(zone, AFTER);
  TZ.OVERRIDES.push({ zone, from: Date.UTC(2020, 0, 1), offset: already + 45, label: { fr: "t", en: "t" }, source: "test" });
  try {
    assert.strictEqual(TZ.correctionMinutes(zone, AFTER), 45);
    assert.strictEqual(TZ.isStale(zone, AFTER), true);
    assert.strictEqual(renderedOffsetMinutes(zone, AFTER), already + 45);
    assert.ok(TZ.correctedZones(AFTER).includes(zone));
  } finally { TZ.OVERRIDES.pop(); }
});

test("la regle la plus recente entree en vigueur l'emporte", () => {
  const zone = "Europe/Lisbon";
  TZ.OVERRIDES.push({ zone, from: Date.UTC(2020, 0, 1), offset: 120, label: { fr: "t", en: "t" }, source: "test" });
  TZ.OVERRIDES.push({ zone, from: Date.UTC(2026, 0, 1), offset: 180, label: { fr: "t", en: "t" }, source: "test" });
  TZ.OVERRIDES.push({ zone, from: Date.UTC(2030, 0, 1), offset: 240, label: { fr: "t", en: "t" }, source: "test" });
  try {
    assert.strictEqual(TZ.expectedOffsetMinutes(zone, AFTER), 180);
  } finally { TZ.OVERRIDES.pop(); TZ.OVERRIDES.pop(); TZ.OVERRIDES.pop(); }
});

console.log("== Affichage du diagnostic / diagnostic display ==");

test("le decalage s'ecrit lisiblement", () => {
  assert.strictEqual(TZ.formatOffset(0), "UTC");
  assert.strictEqual(TZ.formatOffset(60), "UTC+1");
  assert.strictEqual(TZ.formatOffset(-300), "UTC-5");
  assert.strictEqual(TZ.formatOffset(330), "UTC+5:30");
  assert.strictEqual(TZ.formatOffset(-570), "UTC-9:30");
  assert.strictEqual(TZ.formatOffset(null), "?");
});

test("le rapport decrit chaque fuseau surveille, en cours ou non", () => {
  const rep = TZ.report(AFTER);
  const casa = rep.zones.find((z) => z.zone === CASA);
  assert.ok(casa, "le Maroc figure au rapport");
  assert.strictEqual(casa.expected, 0);
  assert.strictEqual(casa.expectedText, "UTC");
  assert.strictEqual(casa.corrected, casa.embedded !== 0);
  assert.ok(casa.source && /2\.26\.530/.test(casa.source), "la reference du decret est citee");
  assert.ok(casa.label.fr && casa.label.en, "libelle bilingue");
  assert.strictEqual(rep.correctedCount, rep.zones.filter((z) => z.corrected).length);
  assert.strictEqual(rep.upToDate, rep.correctedCount === 0);
});

test("avant la bascule, le rapport ne cite pas encore le Maroc", () => {
  assert.ok(!TZ.report(BEFORE).zones.some((z) => z.zone === CASA));
});

test("toute entree de la table est exploitable telle quelle", () => {
  for (const rule of TZ.OVERRIDES) {
    assert.ok(typeof rule.zone === "string" && rule.zone.length, "zone");
    assert.ok(Number.isFinite(rule.from), rule.zone + " : instant d'effet");
    assert.ok(Number.isInteger(rule.offset) && Math.abs(rule.offset) <= 16 * 60, rule.zone + " : decalage plausible");
    assert.ok(rule.label && rule.label.fr && rule.label.en, rule.zone + " : libelle bilingue");
    assert.ok(rule.source && rule.source.length, rule.zone + " : reference citee");
    // Le fuseau doit exister dans la base embarquee, sinon la
    // comparaison n'a aucun sens et la correction ne s'appliquerait
    // jamais. The zone must exist in the embedded database.
    assert.notStrictEqual(TZ.intlOffsetMinutes(rule.zone, AFTER), null, rule.zone + " : fuseau connu d'Intl");
  }
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
