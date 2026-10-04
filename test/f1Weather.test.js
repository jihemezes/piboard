/* Test de la METEO DU CIRCUIT de la tuile Formule 1 (1.138.4).

   Deux pieges, et ce sont les deux seuls qui comptent.

   1. LE FUSEAU. Open-Meteo rend ses heures sous la forme
      « 2026-10-04T14:00 », SANS indication de fuseau. `Date.parse` lit
      une telle chaine comme une heure LOCALE : a Toulouse en ete, la
      meteo de 14 h UTC devient celle de 12 h UTC, et toute la carte
      glisse de deux heures -- sans la moindre erreur, avec des chiffres
      parfaitement credibles. C'est exactement le genre de defaut qu'on
      ne voit jamais a la relecture.
   2. L'APPARIEMENT. Une course a 14 h 50 se court sous le temps de
      15 h, pas sous celui de 14 h. Et au-dela de l'horizon de prevision,
      il faut rendre « on ne sait pas » plutot que la derniere heure
      connue. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = {
  window: { PiBoard: { registerWidget() { } } },
  navigator: { language: "fr-FR" },
  setInterval: () => 0, clearInterval() { }, setTimeout: () => 0, clearTimeout() { },
  fetch: () => Promise.reject(new Error("aucun reseau dans ce test")),
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + "/../public/widgets/f1/widget.js", "utf8"), sandbox);
const H = sandbox.window.PiBoardF1Helpers;
assert.ok(H && H.parseWeather, "les fonctions pures de la meteo doivent etre exposees");

/* Reponse calquee sur Open-Meteo : heures SANS fuseau, tableaux
   paralleles, et des trous -- l'API rend `null` quand une valeur manque
   pour une heure donnee. */
const OM = {
  hourly: {
    time: ["2026-10-04T12:00", "2026-10-04T13:00", "2026-10-04T14:00", "2026-10-04T15:00"],
    temperature_2m: [21.4, 22.8, 24.1, null],
    precipitation_probability: [0, 12, 64, 70],
    weather_code: [0, 2, 95, 61],
    wind_speed_10m: [8, 11, 24, 19]
  }
};

console.log("== parseWeather : les heures sont lues en UTC, PAS en heure locale ==");
const table = H.parseWeather(OM);
assert.ok(table && table.size === 4, "quatre heures lues");
const midi = Date.UTC(2026, 9, 4, 12, 0, 0);
assert.ok(table.has(midi),
  "« 2026-10-04T12:00 » doit valoir 12 h UTC ; sans le Z ajoute, le navigateur y lit une heure locale et toute la meteo glisse");
assert.strictEqual(table.get(midi).temp, 21.4);
console.log("  OK");

console.log("== parseWeather : une heure deja horodatee n'est pas doublement decalee ==");
/* Si Open-Meteo changeait d'avis et renvoyait le fuseau, ajouter un Z
   derriere « +02:00 » donnerait une date invalide et la carte
   disparaitrait. */
const zoned = H.parseWeather({ hourly: { time: ["2026-10-04T14:00+02:00"], temperature_2m: [20],
  precipitation_probability: [5], weather_code: [0], wind_speed_10m: [3] } });
assert.ok(zoned && zoned.has(Date.UTC(2026, 9, 4, 12, 0, 0)),
  "une heure portant deja son fuseau doit etre respectee telle quelle");
console.log("  OK");

console.log("== parseWeather : les valeurs manquantes restent manquantes ==");
assert.strictEqual(table.get(Date.UTC(2026, 9, 4, 15)).temp, null,
  "un null d'Open-Meteo ne doit pas devenir 0 degre");
assert.strictEqual(table.get(Date.UTC(2026, 9, 4, 15)).rain, 70, "les autres valeurs de l'heure restent lues");
console.log("  OK");

console.log("== parseWeather : une reponse inexploitable ne jette pas ==");
for (const bad of [null, {}, { hourly: {} }, { hourly: { time: [] } }, { hourly: { time: "pas un tableau" } }]) {
  assert.strictEqual(H.parseWeather(bad), null, "la carte dit « indisponible », elle ne casse pas la tuile");
}
console.log("  OK");

console.log("== weatherAt : l'heure PLEINE LA PLUS PROCHE, pas l'heure inferieure ==");
/* 14 h 50 : la seance se court sous le temps de 15 h. Arrondir vers le
   bas donnerait l'orage de 14 h au lieu de la pluie de 15 h. */
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 4, 14, 50)).at, Date.UTC(2026, 9, 4, 15),
  "14 h 50 doit prendre la prevision de 15 h");
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 4, 14, 10)).at, Date.UTC(2026, 9, 4, 14),
  "14 h 10 doit prendre celle de 14 h");
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 4, 13, 30)).at, Date.UTC(2026, 9, 4, 14),
  "la demie bascule sur l'heure suivante");
console.log("  OK");

console.log("== weatherAt : au-dela de l'horizon, on ne sait pas et on le dit ==");
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 11, 14)), null,
  "une seance dans une semaine n'a pas de prevision : rendre la derniere heure connue serait un mensonge");
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 4, 9)), null,
  "trois heures avant la premiere heure connue : rien non plus");
assert.strictEqual(H.weatherAt(table, Date.UTC(2026, 9, 4, 16)).at, Date.UTC(2026, 9, 4, 15),
  "une heure juste apres la derniere connue reste acceptable (moins de 90 min)");
console.log("  OK");

console.log("== weatherAt : entrees aberrantes ==");
assert.strictEqual(H.weatherAt(null, Date.now()), null);
assert.strictEqual(H.weatherAt(table, NaN), null);
assert.strictEqual(H.weatherAt(table, undefined), null);
console.log("  OK");

console.log("== describeWeather : les codes WMO qui comptent en course ==");
assert.strictEqual(H.describeWeather(0).fr, "Ciel dégagé");
assert.strictEqual(H.describeWeather(95).fr, "Orage");
assert.strictEqual(H.describeWeather(61).fr, "Pluie");
assert.strictEqual(H.describeWeather(82).fr, "Pluie", "les averses violentes restent de la pluie");
assert.strictEqual(H.describeWeather(999), null,
  "un code inconnu ne doit pas etre presente comme « couvert » : on prefere le tiret");
for (const w of H.WMO) assert.ok(w.fr && w.en && w.icon, "chaque condition a ses deux libelles et son icone");
console.log("  OK");

console.log("== weatherUrl : la requete demande les bons champs, en UTC ==");
const url = H.weatherUrl(2.76083, 101.738);
assert.ok(url.startsWith("https://api.open-meteo.com/v1/forecast?"), "Open-Meteo, sans cle");
assert.ok(!/key|token|apikey/i.test(url), "aucune cle d'API ne doit apparaitre");
assert.ok(/timezone=UTC/.test(url),
  "UTC de bout en bout : l'API des courses donne l'UTC, et convertir en route invite un decalage au changement d'heure");
for (const f of ["temperature_2m", "precipitation_probability", "weather_code", "wind_speed_10m"]) {
  assert.ok(url.includes(f), "champ manquant : " + f);
}
assert.ok(/hourly=/.test(url) && !/[?&]daily=/.test(url),
  "la prevision est HORAIRE : une moyenne journaliere ne dit pas s'il pleut a l'heure des qualifications");
assert.ok(/forecast_days=7/.test(url), "sept jours couvrent le week-end a venir");
console.log("  OK");

console.log("\nTous les tests de la meteo du circuit passent.");
