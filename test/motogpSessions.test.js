/* Test des CARTES DE SEANCE de la tuile MotoGP (1.161.0) : essais
   libres, Practice, Q1, Q2, sprint, grille de depart.

   Les reponses viennent du VRAI flux motogp.com (releve du week-end
   d'Indonesie 2026, dossier fixtures/motogpsessions).

   Les pieges :
   1. les heures de la LISTE des seances sont des heures locales
      etiquetees UTC : la tuile ne doit se fier qu'au calendrier ;
   2. le Q1 n'a que douze pilotes, dont les deux premiers passent au Q2 ;
   3. la GRILLE = les douze du Q2, puis les pilotes du Q1 non qualifies
      pour le Q2 -- les deux premiers du Q1 ne figurent qu'une fois ;
   4. un pilote sans tour chronometre n'a pas de temps ;
   5. une seance non commencee n'est PAS demandee ;
   6. l'identifiant du calendrier est `toad_api_uuid` cote resultats. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FX = path.join(__dirname, "fixtures", "motogpsessions");
const fx = (n) => JSON.parse(fs.readFileSync(path.join(FX, n), "utf8"));

let Widget = null;
const sandbox = {
  window: { PiBoard: { registerWidget(id, cls) { if (id === "motogp") Widget = cls; } } },
  navigator: { language: "fr-FR" },
  setInterval: () => 0, clearInterval() { }, setTimeout, clearTimeout,
  fetch: () => Promise.reject(new Error("aucun reseau dans ce test")),
  console, Intl
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "motogp", "widget.js"), "utf8"), sandbox);
const H = sandbox.window.PiBoardMotoGpHelpers;
assert.ok(H && H.parseSessionRows && Widget, "les fonctions pures et la classe doivent etre exposees");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + (e && e.stack || e)); }
}
const at = (iso) => Date.parse(iso);

const races = H.parseCalendar(fx("events-calendar-2026-ina-aus.json"));
const INA = races.find((r) => r.place === "INDONESIA");
const AUS = races.find((r) => r.place === "AUSTRALIA");
const SESSIONS = fx("results-sessions-ina.json");
const EVENTS = fx("results-events-2026.json");
const CL = { fp1: fx("classification-fp1.json"), pr: fx("classification-pr.json"), q1: fx("classification-q1.json"), q2: fx("classification-q2.json"), spr: fx("classification-spr.json") };
const SID = {};
for (const s of SESSIONS) {
  const key = s.type === "FP" ? "fp" + s.number : s.type === "Q" ? "q" + s.number : s.type.toLowerCase();
  SID[s.id] = key === "fp2" ? "fp1" : key;
}

(async () => {
  console.log("== Calendrier : l'identifiant et les heures ==");
  await test("la manche garde l'identifiant du calendrier, qui se retrouve cote resultats", () => {
    assert.ok(INA && INA.id);
    const ev = H.matchEvent(EVENTS, INA);
    assert.ok(ev, "epreuve retrouvee");
    assert.strictEqual(ev.short_name, "INA");
  });
  await test("sans identifiant, le pays et les dates suffisent", () => {
    const bare = Object.assign({}, INA, { id: "" });
    assert.strictEqual(H.matchEvent(EVENTS, bare).short_name, "INA");
  });
  await test("un test prive n'est jamais pris pour un Grand Prix", () => {
    const fake = [{ id: "t", test: true, toad_api_uuid: INA.id, country: { iso: "ID" }, date_start: "2026-10-09", date_end: "2026-10-11" }];
    assert.strictEqual(H.matchEvent(fake, INA), null);
  });
  await test("les heures de seance viennent du calendrier (fuseaux corrects)", () => {
    assert.strictEqual(H.sessionAt(INA, "fp1"), at("2026-10-09T02:45:00Z"));
    assert.strictEqual(H.sessionAt(INA, "q2"), at("2026-10-10T03:20:00Z"));
    assert.ok(SESSIONS[0].date.startsWith("2026-10-09T10:45"), "la liste du flux dit 10:45 : heure locale etiquetee UTC");
  });

  console.log("== Choix de la seance dans la liste du flux ==");
  await test("type + numero : FP1, FP2, Q1, Q2, Practice, sprint", () => {
    const ids = {};
    for (const k of ["fp1", "fp2", "practice", "q1", "q2", "sprint"]) {
      const s = H.pickWeekendSession(SESSIONS, k);
      assert.ok(s, k);
      ids[k] = s.id;
    }
    assert.strictEqual(new Set(Object.values(ids)).size, 6, "six seances distinctes");
  });
  await test("une seance « NOT-STARTED » n'est pas prise", () => {
    const l = SESSIONS.map((s) => Object.assign({}, s, { status: s.type === "Q" && s.number === 2 ? "NOT-STARTED" : s.status }));
    assert.strictEqual(H.pickWeekendSession(l, "q2"), null);
    assert.ok(H.pickWeekendSession(l, "q1"));
  });

  console.log("== Essais, Q1, Q2 (reponses reelles) ==");
  const fp1 = H.parseSessionRows(CL.fp1, "fp1");
  await test("essais : meilleur tour, ecart, tours, nom, numero, drapeau", () => {
    const a = fp1.rows[0];
    assert.strictEqual(a.pos, 1);
    assert.strictEqual(a.name, "Marco Bezzecchi");
    assert.strictEqual(a.number, "72");
    assert.strictEqual(a.iso, "IT");
    assert.strictEqual(H.fmtLapTime(a.best), "1:30.132");
    assert.strictEqual(a.gap, "");
    assert.strictEqual(fp1.rows[1].gap, "+0.237");
    assert.ok(a.laps > 0);
    assert.strictEqual(fp1.rows.length, 22);
  });
  const q1 = H.parseSessionRows(CL.q1, "q1");
  const q2 = H.parseSessionRows(CL.q2, "q2");
  await test("Q1 : douze pilotes, les deux premiers sont marques « passent en Q2 »", () => {
    assert.strictEqual(q1.rows.length, 12);
    assert.deepStrictEqual(q1.rows.map((r) => !!r.advance).slice(0, 4), [true, true, false, false]);
    assert.ok(!q2.rows.some((r) => r.advance), "pas de marque en Q2");
  });
  await test("l'ecart est mesure a la pole de la seance", () => {
    assert.strictEqual(q2.rows[0].gap, "");
    assert.strictEqual(q2.rows[1].gap, "+0.109");
  });
  await test("un pilote sans tour chronometre n'a pas de temps ni d'ecart", () => {
    const j = JSON.parse(JSON.stringify(CL.fp1));
    j.classification[5].best_lap = null;
    j.classification[5].position = null;
    const d = H.parseSessionRows(j, "fp1");
    const bare = d.rows[d.rows.length - 1];
    assert.strictEqual(bare.best, null);
    assert.strictEqual(bare.gap, "");
    assert.strictEqual(bare.finished, false);
  });
  await test("une reponse vide rend null", () => {
    assert.strictEqual(H.parseSessionRows({ classification: [] }, "fp1"), null);
    assert.strictEqual(H.parseSessionRows(null, "q1"), null);
  });

  console.log("== Sprint (reponse reelle) ==");
  const sp = H.parseSessionRows(CL.spr, "sprint");
  await test("le vainqueur porte le temps, les non classes sont a part", () => {
    assert.strictEqual(sp.rows[0].name, "Marc Marquez");
    assert.strictEqual(sp.rows[0].pos, 1);
    assert.ok(sp.rows[0].time);
    assert.ok(/^\+/.test(sp.rows[1].gap));
    const out = sp.rows.filter((r) => !r.finished);
    assert.ok(out.length >= 2 && out.every((r) => r.pos == null));
  });

  console.log("== La grille de depart ==");
  const grid = H.buildGrid(q1, q2);
  await test("les douze du Q2, puis les pilotes du Q1 non qualifies : 22 au depart", () => {
    assert.strictEqual(grid.rows.length, 22);
    assert.strictEqual(grid.rows[0].name, q2.rows[0].name);
    assert.strictEqual(grid.rows[11].name, q2.rows[11].name);
    assert.strictEqual(grid.rows[12].name, q1.rows[2].name, "le 3e du Q1 ouvre la 7e ligne... la 13e");
  });
  await test("les deux premiers du Q1 ne figurent qu'une fois (dans le Q2)", () => {
    const names = grid.rows.map((r) => r.name);
    assert.strictEqual(new Set(names).size, names.length);
  });
  await test("positions recalculees 1..22 et ecart a la pole", () => {
    assert.deepStrictEqual(grid.rows.map((r) => r.pos), Array.from({ length: 22 }, (_, i) => i + 1));
    assert.strictEqual(grid.rows[0].gap, "");
    assert.strictEqual(grid.rows[1].gap, "+0.109");
    assert.ok(/^\+\d+\.\d{3}$/.test(grid.rows[21].gap));
  });
  await test("la grille ne modifie pas les classements d'origine", () => {
    assert.strictEqual(q2.rows[0].pos, 1);
    assert.strictEqual(q1.rows[2].pos, 3);
  });
  await test("sans le Q1 ou sans le Q2, pas de grille", () => {
    assert.strictEqual(H.buildGrid(null, q2), null);
    assert.strictEqual(H.buildGrid(q1, null), null);
  });

  console.log("== Week-end affiche, seance en cours, favoris ==");
  await test("week-end en cours, sinon le dernier couru", () => {
    assert.strictEqual(H.weekendRace(races, at("2026-10-10T05:00:00Z")).round, 17);
    assert.strictEqual(H.weekendRace(races, at("2026-10-15T05:00:00Z")).round, 17);
    assert.strictEqual(H.weekendRace(races, at("2026-10-22T20:00:00Z")).round, 18, "moins de 12 h avant le premier essai");
  });
  await test("seance en cours : du debut a la fin prevue", () => {
    assert.strictEqual(H.liveSession(INA, at("2026-10-10T03:25:00Z")), "q2");
    assert.strictEqual(H.liveSession(INA, at("2026-10-10T03:10:00Z")), "q1");
    assert.strictEqual(H.liveSession(INA, at("2026-10-10T05:00:00Z")), null);
  });
  await test("favoris : numero, nom, equipe, constructeur", () => {
    const t = H.parseFavs("marquez, 72");
    assert.ok(H.isFavRider(t, { name: "Marc Marquez", number: "93" }));
    assert.ok(H.isFavRider(t, { name: "Marco Bezzecchi", number: "72" }));
    assert.ok(!H.isFavRider(t, { name: "Jack Miller", number: "43" }));
    assert.ok(H.isFavTeam(H.parseFavs("ducati, gresini"), { team: "BK8 Gresini Racing MotoGP", maker: "Aprilia" }));
    assert.ok(H.isFavTeam(H.parseFavs("ducati"), { team: "Pramac", maker: "Ducati" }));
    assert.ok(!H.isFavTeam(H.parseFavs("ducati"), { team: "Pramac", maker: "Aprilia" }));
    assert.ok(!H.isFavTeam([], { team: "x" }));
  });

  /* ---- Bout en bout : la vraie classe, un faux flux ---- */
  console.log("== Chargement des seances (vraie classe, faux flux) ==");
  function make(settings, nowMs, hooks) {
    const calls = [];
    const net = Object.assign({ fail: false }, hooks || {});
    sandbox.fetch = async (url) => {
      const u = decodeURIComponent(String(url).replace(/^.*\?url=/, ""));
      calls.push(u);
      const json = (o, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => o });
      if (net.fail) return json({}, 500);
      if (/\/results\/seasons$/.test(u)) return json([{ id: "s-2026", year: 2026, current: true }]);
      if (/\/results\/categories/.test(u)) return json([{ id: "c-mgp", name: "MotoGP™" }]);
      if (/\/results\/events\?/.test(u)) return json(EVENTS);
      if (/\/results\/sessions\?/.test(u)) return json(SESSIONS);
      const m = /\/results\/session\/([^/]+)\/classification/.exec(u);
      if (m) return json(CL[SID[m[1]]] || { classification: [] });
      return json([], 404);
    };
    const SDate = vm.runInContext("Date", sandbox);
    const realNow = SDate.now;
    SDate.now = () => nowMs.v;
    const ctx = {
      settings: Object.assign({ showNext: false, showSchedule: false, showRiders: false, showTeams: false,
        showResults: false, showWeather: false, showCircuit: false }, settings),
      api: { proxyUrl: (u) => "/api/proxy?url=" + encodeURIComponent(u) },
      i18n: { t: (k) => k, lang: "fr" },
      el: null
    };
    const w = new Widget(ctx);
    w.render = () => { };
    w.arm = () => { };
    w.data = { races, at: 0 };
    return { w, calls, net, restore() { SDate.now = realNow; } };
  }

  await test("qualifications Q2 : evenement retrouve, seance choisie, carte remplie", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showQ2: true }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.q2 && t.w.sess.q2.data, JSON.stringify(t.w.sess.q2));
      const html = t.w.cardSession("q2", now.v);
      assert.ok(/\+0\.109/.test(html) && /f1\.th\.best/.test(html) && /motogp\.sess\.credit/.test(html));
      assert.ok(!/pwmgp-live/.test(html));
    } finally { t.restore(); }
  });

  await test("la carte Grille charge Q1 ET Q2 et en tire 22 lignes", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showGrid: true, sessionRows: 30 }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.q1 && t.w.sess.q1.data && t.w.sess.q2 && t.w.sess.q2.data);
      const html = t.w.cardSession("grid", now.v);
      assert.strictEqual((html.match(/<tbody>([\s\S]*)<\/tbody>/)[1].match(/<tr/g) || []).length, 22);
      assert.ok(/motogp\.sess\.gridNote/.test(html) && /f1\.th\.gapPole/.test(html));
    } finally { t.restore(); }
  });

  await test("Q1 : la fleche « passe en Q2 » est sur les deux premiers", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showQ1: true }, now);
    try {
      await t.w.refreshSessions();
      const html = t.w.cardSession("q1", now.v);
      assert.strictEqual((html.match(/pwmgp-adv/g) || []).length, 2);
      assert.ok(/motogp\.sess\.q1note/.test(html));
    } finally { t.restore(); }
  });

  await test("sprint : temps du vainqueur, non classes estompes", async () => {
    const now = { v: at("2026-10-10T09:00:00Z") };
    const t = make({ showSprint: true, sessionRows: 30 }, now);
    try {
      await t.w.refreshSessions();
      const html = t.w.cardSession("sprint", now.v);
      assert.ok(/Marquez/.test(html) && /pwmgp-dnf/.test(html) && /motogp\.dnf/.test(html));
    } finally { t.restore(); }
  });

  await test("une seance pas encore commencee n'est PAS demandee : on affiche son horaire", async () => {
    const now = { v: at("2026-10-09T01:00:00Z") };
    const t = make({ showFp1: true, showQ1: true, showGrid: true }, now);
    try {
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, 0, t.calls.join(" | "));
      assert.ok(/f1\.sess\.later/.test(t.w.cardSession("fp1", now.v)));
      assert.ok(/f1\.sess\.later/.test(t.w.cardSession("grid", now.v)));
    } finally { t.restore(); }
  });

  await test("EN DIRECT : badge, releve rapide, cache entre deux releves", async () => {
    const now = { v: at("2026-10-09T03:00:00Z") };
    const t = make({ showFp1: true, liveRefreshSeconds: 45 }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(/pwmgp-live/.test(t.w.cardSession("fp1", now.v)));
      assert.strictEqual(t.w.nextDelay(now.v), 45000);
      const n = t.calls.length;
      now.v += 10000;
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, n);
      now.v += 40000;
      await t.w.refreshSessions();
      assert.ok(t.calls.length > n);
    } finally { t.restore(); }
  });

  await test("une seance terminee est gardee 25 minutes ; la derniere relecture suit la fin", async () => {
    const now = { v: at("2026-10-09T03:40:00Z") };
    const t = make({ showFp1: true }, now);
    try {
      await t.w.refreshSessions();
      now.v = at("2026-10-09T08:00:00Z");
      await t.w.refreshSessions();
      assert.strictEqual(t.w.sess.fp1.final, true);
      const n = t.calls.length;
      now.v += 10 * 60000;
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, n);
    } finally { t.restore(); }
  });

  await test("un flux en panne : message dedie, et les resultats deja affiches sont conserves", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showQ2: true }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.q2.data);
      t.net.fail = true;
      now.v += 30 * 60000;
      await t.w.refreshSessions();
      assert.ok(t.w.sess.q2.data && t.w.sess.q2.error);
      assert.ok(/motogp\.stale/.test(t.w.cardSession("q2", now.v)));
    } finally { t.restore(); }
  });

  await test("flux en panne des le debut : « resultats indisponibles », pas une carte muette", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showQ2: true }, now, { fail: true });
    try {
      await t.w.refreshSessions();
      assert.ok(/f1\.sess\.error/.test(t.w.cardSession("q2", now.v)));
    } finally { t.restore(); }
  });

  await test("favoris mis en evidence dans une carte de seance", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({ showQ2: true, favRiders: "Fernandez", favTeams: "gresini" }, now);
    try {
      await t.w.refreshSessions();
      const html = t.w.cardSession("q2", now.v);
      assert.ok((html.match(/pwmgp-fav/g) || []).length >= 1);
      assert.ok(/pwmgp-star/.test(html));
    } finally { t.restore(); }
  });

  await test("sans carte de seance, le flux des seances n'est jamais interroge", async () => {
    const now = { v: at("2026-10-10T05:00:00Z") };
    const t = make({}, now);
    try {
      assert.strictEqual(t.w.needSessions(), false);
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  console.log("== Les cartes sont facultatives ==");
  await test("sept blocs optIn, decoches par defaut, avec leur titre et leur reglage", () => {
    const ids = ["fp1", "practice", "fp2", "q1", "q2", "sprint", "grid"];
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "motogp", "manifest.json"), "utf8"));
    for (const id of ids) {
      const b = H.BLOCKS.find((x) => x.id === id);
      assert.ok(b && b.optIn === true, id);
      const st = man.settings.find((x) => x.key === b.key);
      assert.ok(st && st.default === false, b.key);
    }
  });
  await test("la disposition « Seances » ne chevauche rien et ne cite que des blocs connus", () => {
    const p = H.PRESETS.find((x) => x.id === "sessions");
    assert.ok(p);
    const ids = Object.keys(p.items);
    for (const id of ids) assert.ok(H.BLOCKS.find((b) => b.id === id), id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = p.items[ids[i]], b = p.items[ids[j]];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), ids[i] + " / " + ids[j]);
    }
  });

  if (failures) { console.log("\n>>> " + failures + " ECHEC(S)"); process.exit(1); }
  console.log("\n>>> TOUS LES TESTS PASSENT");
})();
