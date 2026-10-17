/* Test de la tuile MOTOGP (1.151.0).

   Les reponses du flux sont calquees sur le vrai service (relevees le
   17 octobre 2026 sur api.motogp.pulselive.com). Ce qui est verifie :

   1. L'HEURE DU FLUX EST BIEN LUE : « 2026-10-25T14:00:00+1100 » est un
      decalage sans deux-points, a corriger avant analyse.
   2. LA CATEGORIE REINE SEULEMENT dans le programme : Moto2 et Moto3 ne
      s'y glissent pas.
   3. LES ESSAIS PRIVES NE SONT PAS UN GRAND PRIX : le dernier resultat
      est celui du dernier GP couru, pas celui du test de Barcelone.
   4. UNE CHUTE N'EST PAS UNE DERNIERE PLACE.
   5. LE CLASSEMENT DES EQUIPES EST UNE SOMME, et la tuile le dit.
   6. UN BLOC MASQUE N'EST PAS DEMANDE, et des resultats termines ne
      sont pas relus tant qu'aucun nouveau Grand Prix n'a ete couru.
   7. Tous les blocs se rangent dans la grille interne. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const PUB = path.join(__dirname, "..", "public");
let passed = 0;
function ok(label, cond) { assert.ok(cond, label); passed++; console.log("  OK   " + label); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NOW = Date.parse("2026-10-20T10:00:00Z");
const iso = (ms, off) => {
  /* « 2026-10-25T14:00:00+1100 », la forme exacte du flux. */
  const d = new Date(ms + off * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00+${p(off)}00`;
};
const MGP = { id: "cat-mgp", acronym: "MGP", name: "MotoGP" };
const MT2 = { id: "cat-mt2", acronym: "MT2", name: "Moto2" };
const bc = (short, at, cat) => ({ type: "SESSION", shortname: short, date_start: iso(at, 11), category: cat });
const RACE_AT = Date.parse("2026-10-25T03:00:00Z");
const CALENDAR = [
  { kind: "TEST", name: "BARCELONA TEST", circuit: { name: "Catalunya", lat: "41.5", lng: "2.2" }, broadcasts: [] },
  {
    kind: "GP", sequence: 18, additional_name: "AUSTRALIA", name: "RED BULL GRAND PRIX OF AUSTRALIA", country: "AU",
    circuit: { name: "Phillip Island", country: "Australia", lat: "-38.4898703", lng: "145.2038278" },
    categories: [MGP, MT2],
    event_categories: [{ category_id: "cat-mgp", num_laps: 27, sprint_num_laps: 13 }, { category_id: "cat-mt2", num_laps: 23 }],
    broadcasts: [
      bc("FP1", RACE_AT - 2 * 86400000 - 3 * 3600000, MGP), bc("PR", RACE_AT - 2 * 86400000 + 1800000, MGP),
      bc("Q1", RACE_AT - 86400000 - 3 * 3600000, MGP), bc("Q2", RACE_AT - 86400000 - 2.5 * 3600000, MGP),
      bc("SPR", RACE_AT - 86400000 + 3600000, MGP), bc("RAC", RACE_AT, MGP),
      bc("RAC", RACE_AT - 3600000, MT2),
      { type: "MEDIA", shortname: "SHOW", date_start: iso(RACE_AT - 3 * 86400000, 11), category: MGP }
    ],
    date_end: "2026-10-25T23:00:00+11:00"
  }
];
const SEASONS = [{ id: "s-2025", year: 2025, current: false }, { id: "s-2026", year: 2026, current: true }];
const CATEGORIES = [{ id: "c-mgp", name: "MotoGP™" }, { id: "c-mt2", name: "Moto2™" }];
const rider = (name, num, isoC, team, maker) => ({ full_name: name, number: num, country: { iso: isoC } });
const STANDINGS = { classification: [
  { position: 1, rider: rider("Jorge Martin", 89, "ES"), team: { name: "Aprilia Racing" }, constructor: { name: "Aprilia" }, points: 355, race_wins: 1, podiums: 9 },
  { position: 2, rider: rider("Marco Bezzecchi", 72, "IT"), team: { name: "Aprilia Racing" }, constructor: { name: "Aprilia" }, points: 300, race_wins: 4, podiums: 8 },
  { position: 3, rider: rider("Francesco Bagnaia", 63, "IT"), team: { name: "Ducati Lenovo Team" }, constructor: { name: "Ducati" }, points: 420, race_wins: 3, podiums: 7 }
] };
const RESULT_EVENTS = [
  { id: "ev-test", test: true, status: "FINISHED", name: "BARCELONA TEST", date_end: "2026-11-18" },
  { id: "ev-jpn", test: false, status: "FINISHED", name: "GRAND PRIX OF JAPAN", date_end: "2026-10-04" },
  { id: "ev-ina", test: false, status: "FINISHED", name: "GRAND PRIX OF INDONESIA", date_end: "2026-10-11", country: { iso: "ID" } }
];
const SESSIONS = [
  { id: "se-q2", type: "Q", number: 2, date: "2026-10-10T11:20:00+00:00", status: "FINISHED" },
  { id: "se-spr", type: "SPR", date: "2026-10-10T15:00:00+00:00", status: "FINISHED" },
  { id: "se-rac", type: "RAC", date: "2026-10-11T15:00:00+00:00", status: "FINISHED" }
];
const cls = (pos, name, num, gap, pts, status) => ({ position: pos, rider: rider(name, num, "IT"), team: { name: "T" },
  constructor: { name: "Ducati" }, gap: { first: gap, lap: "0" }, time: pos === 1 ? "40:46.582" : "", points: pts, status, total_laps: 27 });
const RACE_CLS = { classification: [
  cls(1, "Marco Bezzecchi", 72, "0.000", 25, "INSTND"), cls(2, "Jorge Martin", 89, "4.260", 20, "INSTND"),
  cls(null, "Fabio Quartararo", 20, null, 0, "OUTSTND")
] };
const SPRINT_CLS = { classification: [cls(1, "Pedro Acosta", 37, "0.000", 12, "INSTND")] };

const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
const { document } = window;
const CALLS = [];
window.fetch = (url) => {
  const u = decodeURIComponent(String(url).replace(/^\/api\/proxy\?url=/, ""));
  CALLS.push(u);
  const json = (d) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(d) });
  if (/events\?seasonYear=/.test(u)) return json(CALENDAR);
  if (/results\/seasons$/.test(u)) return json(SEASONS);
  if (/results\/categories/.test(u)) return json(CATEGORIES);
  if (/results\/standings/.test(u)) return json(STANDINGS);
  if (/results\/events\?/.test(u)) return json(RESULT_EVENTS);
  if (/results\/sessions\?/.test(u)) return json(SESSIONS);
  if (/session\/se-rac\/classification/.test(u)) return json(RACE_CLS);
  if (/session\/se-spr\/classification/.test(u)) return json(SPRINT_CLS);
  if (/open-meteo/.test(u)) return json({ hourly: { time: [new Date(RACE_AT).toISOString().slice(0, 16)], temperature_2m: [17], precipitation_probability: [60], weather_code: [61] } });
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
};
let Klass = null;
window.PiBoard = { registerWidget(id, k) { if (id === "motogp") Klass = k; } };
window.eval(fs.readFileSync(path.join(PUB, "innergrid.js"), "utf8"));
window.eval(fs.readFileSync(path.join(PUB, "widgets/motogp/widget.js"), "utf8"));
const H = window.PiBoardMotoGpHelpers;
const manifest = JSON.parse(fs.readFileSync(path.join(PUB, "widgets/motogp/manifest.json"), "utf8"));
const defaults = Object.fromEntries(manifest.settings.map((s) => [s.key, s.default]));

(async () => {
  console.log("== Calendrier ==");
  const races = H.parseCalendar(CALENDAR);
  ok("les essais prives ne sont pas un Grand Prix", races.length === 1);
  ok("l'heure du flux (decalage sans deux-points) est bien lue", races[0].at === RACE_AT);
  ok("le programme ne garde que la categorie reine",
    races[0].sessions.length === 6 && races[0].sessions.every((s) => s.kind));
  ok("et les rendez-vous medias en sont ecartes", !races[0].sessions.some((s) => s.kind === "" ));
  ok("le nombre de tours est celui de la classe MotoGP", races[0].laps === 27 && races[0].sprintLaps === 13);
  ok("le compte a rebours vise la prochaine seance, pas le dimanche",
    H.nextSession(races[0], RACE_AT - 86400000 - 4 * 3600000).kind === "q1");
  ok("le week-end de course commence douze heures avant la premiere seance",
    H.isRaceWeekend(races, races[0].sessions[0].at - 11 * 3600000) && !H.isRaceWeekend(races, races[0].sessions[0].at - 13 * 3600000));
  ok("le nom du Grand Prix suit la langue de la tuile", /Australi/.test(H.raceName(races[0], "fr")));

  console.log("== Resultats et classements ==");
  ok("le dernier Grand Prix couru, pas le test qui le suit", H.lastEvent(RESULT_EVENTS).id === "ev-ina");
  ok("la course ou le sprint, au choix", H.pickSession(SESSIONS, "race").id === "se-rac" && H.pickSession(SESSIONS, "sprint").id === "se-spr");
  const rows = H.parseClassification(RACE_CLS);
  ok("une chute n'est pas une derniere place", rows[2].finished === false && rows[2].position === null);
  ok("l'ecart au vainqueur est lu", rows[1].gap === "+4.260");
  const riders = H.parseRiders(STANDINGS);
  const teams = H.teamStandings(riders);
  ok("le classement des equipes additionne les points de ses pilotes",
    teams[0].team === "Aprilia Racing" && teams[0].points === 655 && teams[1].points === 420);
  ok("« ™ » ne passe pas a l'ecran", H.pickCategory(CATEGORIES).id === "c-mgp");
  ok("le drapeau se deduit du code pays", H.flagOf("IT") === "🇮🇹" && H.flagOf("") === "");

  console.log("== La tuile, sur la grille interne ==");
  const realNow = Date.now;
  Date.now = () => NOW;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const i18n = { t: (k) => ({ "f1.unit.d": "j", "f1.unit.h": "h", "f1.unit.m": "m", "f1.unit.s": "s", "clock.date.format": "fr-FR", "motogp.gp": "GP · {place}", "motogp.laps": "{n} tours", "motogp.sprintLaps": "sprint {n}" }[k] || k), lang: "fr" };
  const saved = [];
  const ctx = { el: host, settings: Object.assign({}, defaults), i18n, api: { proxyUrl: (u) => "/api/proxy?url=" + encodeURIComponent(u) },
    updateSettings(p) { saved.push(p); } };
  const w = new Klass(ctx);
  w.init();
  await sleep(150);
  ok("sept blocs dans la grille interne", host.querySelectorAll(".pig-block").length === 7 && !!host.querySelector(".pw-motogp.pwmgp-grid"));
  ok("la prochaine manche porte son compte a rebours", !!host.querySelector('.pig-block[data-block="next"] .pwmgp-cd[data-cd]')
    && /\dj \d\dh/.test(host.querySelector(".pwmgp-cd").textContent));
  ok("et son nombre de tours", /27 tours · sprint 13/.test(host.querySelector('.pig-block[data-block="next"]').textContent));
  ok("le classement pilotes est affiche", /Jorge Martin/.test(host.querySelector('.pig-block[data-block="riders"]').textContent));
  ok("le classement equipes dit qu'il est calcule", /motogp\.teams\.computed/.test(host.querySelector('.pig-block[data-block="teams"]').textContent));
  const res = host.querySelector('.pig-block[data-block="results"]');
  ok("un pilote tombe est affiche « non classe », estompe", !!res.querySelector(".pwmgp-dnf") && /motogp\.dnf/.test(res.textContent));
  ok("le vainqueur porte son temps de course", /40:46\.582/.test(res.textContent));
  ok("la meteo est donnee a l'heure de la course", /60%/.test(host.querySelector('.pig-block[data-block="weather"]').textContent));
  ok("hors PiBoard, le plan dit qu'il manque la tuile Plan du circuit, sans casser la tuile",
    /f1\.circuit\.unavailable/.test(host.querySelector('.pig-block[data-block="circuit"]').textContent));

  console.log("== Requetes : rien d'inutile ==");
  const resultCalls = () => CALLS.filter((u) => /classification/.test(u)).length;
  const before = resultCalls();
  await w.refresh();
  ok("des resultats termines ne sont pas relus sans nouveau Grand Prix", resultCalls() === before);
  ok("la saison et la categorie ne sont demandees qu'une fois",
    CALLS.filter((u) => /results\/seasons$/.test(u)).length === 1 && CALLS.filter((u) => /categories/.test(u)).length === 1);
  CALLS.length = 0;
  w.onSettingsChanged(Object.assign({}, ctx.settings, { showRiders: false, showTeams: false }));
  await sleep(100);
  ok("deux blocs decoches : ils quittent la grille", host.querySelectorAll(".pig-block").length === 5);
  ok("et le classement n'est plus demande", !CALLS.some((u) => /standings/.test(u)));
  w.onSettingsChanged(Object.assign({}, ctx.settings, { showRiders: true, showTeams: true, resultsSession: "sprint" }));
  await sleep(150);
  ok("le sprint remplace la course quand on le choisit",
    /Pedro Acosta/.test(host.querySelector('.pig-block[data-block="results"]').textContent)
    && /motogp\.card\.sprint/.test(host.querySelector('.pig-block[data-block="results"]').textContent));

  console.log("== Une seule carte : la tuile devient cette carte ==");
  const solo = {};
  for (const b of H.BLOCKS) solo[b.key] = b.id === "riders";
  w.onSettingsChanged(Object.assign({}, ctx.settings, solo));
  await sleep(100);
  ok("pas de grille, pas de titre interne", !host.querySelector(".pig-root") && !!host.querySelector(".pw-motogp.pwmgp-solo") && !host.querySelector(".pwmgp-card-title"));

  console.log("== Feuille de style et manifeste ==");
  const css = fs.readFileSync(path.join(PUB, "widgets/motogp/widget.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("toutes les classes sont prefixees pwmgp- sous .pw-motogp",
    (css.match(/\.[a-z][\w-]*/g) || []).every((c) => c.startsWith(".pwmgp-") || c === ".pw-motogp" || c === ".pw-circuit"));
  ok("chaque bloc a sa case a cocher dans le manifeste", H.BLOCKS.every((b) => manifest.settings.some((s) => s.key === b.key && s.type === "checkbox")));
  ok("le classement constructeurs n'est pas propose (il serait faux)", !manifest.settings.some((s) => /constructor|maker/i.test(s.key)));

  w.destroy();
  Date.now = realNow;
  ok("detruite, la tuile ne laisse pas de grille", !host.querySelector(".pig-root"));
  console.log(`\n>>> motogp : ${passed} verifications OK`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
