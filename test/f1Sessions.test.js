/* Test des CARTES DE SEANCE de la tuile Formule 1 (1.161.0) : essais
   libres, qualifications, sprint, grille de depart.

   Tout part de VRAIES reponses de jolpica et d'OpenF1 (dossier
   fixtures/f1sessions), relevees sur la saison 2026 : un test qui
   n'ecrirait que des reponses de son cru validerait le format qu'on
   imagine, pas celui de l'API.

   Les pieges :
   1. les temps de qualification d'OpenF1 sont des TABLEAUX [Q1, Q2, Q3]
      avec des trous, ceux de jolpica des chaines vides : un pilote sorti
      en Q1 ne doit pas se retrouver avec un Q3 ;
   2. l'ecart a la pole se recalcule sur le MEILLEUR temps de chacun ;
   3. une seance non commencee n'est PAS demandee ;
   4. une seance terminee est gardee en memoire, pas relue a chaque tour ;
   5. l'echec des pneus ne coute jamais la carte ;
   6. le week-end sprint n'a ni essais 2 ni essais 3. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FX = path.join(__dirname, "fixtures", "f1sessions");
const fx = (n) => JSON.parse(fs.readFileSync(path.join(FX, n), "utf8"));

let Widget = null;
const sandbox = {
  window: { PiBoard: { registerWidget(id, cls) { if (id === "f1") Widget = cls; } } },
  navigator: { language: "fr-FR" },
  setInterval: () => 0, clearInterval() { }, setTimeout, clearTimeout,
  fetch: () => Promise.reject(new Error("aucun reseau dans ce test")),
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "f1", "widget.js"), "utf8"), sandbox);
const H = sandbox.window.PiBoardF1Helpers;
assert.ok(H && H.parseJolpicaSession && Widget, "les fonctions pures et la classe doivent etre exposees");
H.TUNING.gapMs = 0;

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + (e && e.stack || e)); }
}

const races = H.parseRaces(fx("jolpica-calendar-2026-r1-r2.json"));
const R1 = races[0], R2 = races[1];
const at = (iso) => Date.parse(iso);

(async () => {
  console.log("== Lecture des temps ==");
  await test("1:18.518 <-> 78.518, et les temps courts", () => {
    assert.strictEqual(H.parseLapTime("1:18.518"), 78.518);
    assert.strictEqual(H.parseLapTime("59.200"), 59.2);
    assert.strictEqual(H.parseLapTime(""), null);
    assert.strictEqual(H.parseLapTime(null), null);
    assert.strictEqual(H.fmtLapTime(78.518), "1:18.518");
    assert.strictEqual(H.fmtLapTime(59.2), "59.200");
    assert.strictEqual(H.fmtLapTime(61.005), "1:01.005");
    assert.strictEqual(H.fmtGapTime(0.469), "+0.469");
    assert.strictEqual(H.fmtGapTime(0), "");
  });

  console.log("== Qualifications jolpica (reponse reelle) ==");
  const q = H.parseJolpicaSession(fx("jolpica-qualifying-2026-r1.json"), "quali");
  await test("tous les pilotes, dans l'ordre, avec Q1/Q2/Q3", () => {
    assert.ok(q && q.rows.length >= 18, "au moins 18 pilotes : " + (q && q.rows.length));
    assert.strictEqual(q.rows[0].code, "RUS");
    assert.strictEqual(JSON.stringify(q.rows[0].q), JSON.stringify(["1:19.507", "1:18.934", "1:18.518"]));
    assert.strictEqual(q.hasQ, true);
  });
  await test("la pole n'a pas d'ecart, les autres sont mesures a SON meilleur temps", () => {
    assert.strictEqual(q.rows[0].gap, "");
    assert.strictEqual(q.rows[1].code, "ANT");
    assert.strictEqual(q.rows[1].gap, "+0.293");
  });
  await test("un pilote sorti en Q1 n'a ni Q2 ni Q3, et son ecart vient de son Q1", () => {
    const last = q.rows[q.rows.length - 1];
    assert.strictEqual(last.q[1], "");
    assert.strictEqual(last.q[2], "");
    assert.ok(last.best != null && last.best > q.rows[0].best);
    assert.ok(/^\+\d+\.\d{3}$/.test(last.gap), last.gap);
  });
  await test("la couleur d'ecurie suit l'identifiant jolpica", () => {
    assert.strictEqual(q.rows[0].color, H.TEAM_COLOR.mercedes);
  });
  await test("une reponse vide ou absente rend null, pas une erreur", () => {
    assert.strictEqual(H.parseJolpicaSession({ MRData: { RaceTable: { Races: [] } } }, "quali"), null);
    assert.strictEqual(H.parseJolpicaSession(null, "sprint"), null);
  });

  console.log("== Sprint jolpica (reponse reelle) ==");
  const sp = H.parseJolpicaSession(fx("jolpica-sprint-2026-r2.json"), "sprint");
  await test("le vainqueur porte le temps de course, les autres un ecart", () => {
    assert.strictEqual(sp.rows[0].code, "RUS");
    assert.strictEqual(sp.rows[0].time, "33:38.998");
    assert.strictEqual(sp.rows[0].gap, "");
    assert.ok(/^\+/.test(sp.rows[1].gap), sp.rows[1].gap);
    assert.strictEqual(sp.hasQ, false);
  });

  console.log("== OpenF1 : essais et qualifications (reponses reelles) ==");
  const drivers = fx("openf1-drivers.json");
  const fp = H.parseOpenF1Session(fx("openf1-session_result-fp1.json"), drivers, "fp1");
  await test("essais : meilleur temps, ecart au premier, tours, nom et couleur", () => {
    const a = fp.rows[0];
    assert.strictEqual(a.pos, 1);
    assert.strictEqual(a.best, 80.267);
    assert.strictEqual(H.fmtLapTime(a.best), "1:20.267");
    assert.strictEqual(a.laps, 33);
    assert.ok(a.name && a.code && /^#[0-9A-Fa-f]{6}$/.test(a.color), JSON.stringify(a));
    assert.strictEqual(fp.rows[1].gap, "+0.469");
    assert.strictEqual(fp.hasQ, false);
  });
  const oq = H.parseOpenF1Session(fx("openf1-session_result-quali.json"), drivers, "quali");
  await test("qualifications : les tableaux [Q1,Q2,Q3] avec des trous sont lus", () => {
    assert.strictEqual(oq.rows[0].q[2], "1:18.518");
    assert.strictEqual(oq.hasQ, true);
    const out = oq.rows.find((r) => !r.q[2]);
    assert.ok(out, "au moins un pilote sans Q3");
    assert.ok(out.best != null && out.gap);
  });
  await test("OpenF1 et jolpica racontent la meme pole", () => {
    assert.strictEqual(oq.rows[0].best, q.rows[0].best);
    assert.strictEqual(oq.rows[1].gap, q.rows[1].gap);
  });
  await test("sans la liste des pilotes, les lignes restent affichables", () => {
    const bare = H.parseOpenF1Session(fx("openf1-session_result-fp1.json"), [], "fp1");
    assert.strictEqual(bare.rows[0].code, "16");
    assert.ok(bare.rows[0].color);
  });
  await test("un resultat vide rend null", () => {
    assert.strictEqual(H.parseOpenF1Session([], drivers, "fp1"), null);
  });

  console.log("== Pneus du meilleur tour ==");
  await test("la gomme est celle du relais qui contient le meilleur tour", () => {
    const laps = fx("openf1-laps-fp1-trimmed.json");
    const stints = fx("openf1-stints-fp1-trimmed.json");
    const m = H.tyresByDriver(laps, stints);
    assert.ok(m.size >= 1);
    for (const [num, letter] of m) assert.ok(/^[SMHIW]$/.test(letter), num + " " + letter);
    // Recalcul independant pour un pilote.
    const d = 16;
    const mine = laps.filter((l) => l.driver_number === d && l.lap_duration > 0);
    const best = mine.reduce((a, b) => (b.lap_duration < a.lap_duration ? b : a));
    const st = stints.find((s) => s.driver_number === d && s.lap_start <= best.lap_number && best.lap_number <= s.lap_end);
    assert.strictEqual(m.get(d), H.tyreLetter(st.compound));
  });
  await test("un tour sans duree ne donne pas de pastille ; entree inconnue ignoree", () => {
    const m = H.tyresByDriver([{ driver_number: 1, lap_number: 1, lap_duration: null }], [{ driver_number: 1, lap_start: 1, lap_end: 5, compound: "SOFT" }]);
    assert.strictEqual(m.size, 0);
    assert.strictEqual(H.tyreLetter("UNKNOWN"), "");
    assert.strictEqual(H.tyresByDriver(null, null).size, 0);
  });

  console.log("== Le week-end affiche, la seance en cours ==");
  await test("pendant le week-end : ce week-end ; avant lui : le dernier GP", () => {
    assert.strictEqual(H.weekendRace(races, at("2026-03-07T06:00:00Z")).round, 1);
    assert.strictEqual(H.weekendRace(races, at("2026-03-12T16:00:00Z")).round, 2, "moins de 12 h avant la premiere seance");
    assert.strictEqual(H.weekendRace(races, at("2026-03-12T10:00:00Z")).round, 1, "plus de 12 h avant : le dernier couru");
    assert.strictEqual(H.weekendRace(races, at("2026-03-08T06:30:00Z")).round, 1, "encore dans les 3 h apres le depart");
  });
  await test("avant la toute premiere course, on prend la premiere", () => {
    assert.strictEqual(H.weekendRace(races, at("2026-01-01T00:00:00Z")).round, 1);
  });
  await test("une seance est EN COURS de son debut a sa fin prevue (+ marge)", () => {
    assert.strictEqual(H.liveSession(R1, at("2026-03-07T05:30:00Z")), "quali");
    assert.strictEqual(H.liveSession(R1, at("2026-03-07T04:59:00Z")), null);
    assert.strictEqual(H.liveSession(R1, at("2026-03-07T07:00:00Z")), null);
    assert.strictEqual(H.liveSession(R1, at("2026-03-06T01:45:00Z")), "fp1");
    assert.strictEqual(H.liveSession(R2, at("2026-03-13T07:40:00Z")), "sprintQuali");
  });
  await test("la course elle-meme n'est pas une seance a releve rapide", () => {
    assert.strictEqual(H.liveSession(R1, at("2026-03-08T04:30:00Z")), null);
  });

  console.log("== Favoris ==");
  await test("pilotes : par code, par nom, par numero ; sans casse", () => {
    const t = H.parseFavs("ver, Norris ; 16 ,,");
    assert.strictEqual(JSON.stringify(t), JSON.stringify(["ver", "norris", "16"]));
    assert.ok(H.isFavDriver(t, { code: "VER", name: "Max Verstappen" }));
    assert.ok(H.isFavDriver(t, { code: "NOR", name: "Lando Norris" }));
    assert.ok(H.isFavDriver(t, { code: "LEC", name: "Charles Leclerc", number: 16 }));
    assert.ok(!H.isFavDriver(t, { code: "HAM", name: "Lewis Hamilton", number: 44 }));
  });
  await test("un fragment trop court ne s'accroche pas au hasard", () => {
    assert.ok(!H.isFavDriver(["ar"], { code: "LEC", name: "Charles Leclerc" }));
  });
  await test("ecuries : par fragment du nom ou de l'identifiant", () => {
    const t = H.parseFavs("Ferrari, red bull");
    assert.ok(H.isFavTeam(t, { team: "Ferrari", teamId: "ferrari" }));
    assert.ok(H.isFavTeam(t, { team: "Red Bull Racing", teamId: "red_bull" }));
    assert.ok(!H.isFavTeam(t, { team: "McLaren", teamId: "mclaren" }));
    assert.ok(!H.isFavTeam([], { team: "Ferrari" }));
  });

  console.log("== La grille de depart vient des qualifications ==");
  await test("meme ordre, ecart a la pole, sans toucher aux qualifications", () => {
    const g = H.gridFromQuali(q);
    assert.strictEqual(g.kind, "grid");
    assert.strictEqual(g.rows[1].gap, "+0.293");
    g.rows[0].code = "XXX";
    assert.strictEqual(q.rows[0].code, "RUS", "la grille est une copie");
  });

  /* ---- Bout en bout : la vraie classe, un faux reseau ---- */
  console.log("== Chargement des seances (vraie classe, faux reseau) ==");
  const CAL = fx("jolpica-calendar-2026-r1-r2.json");
  function make(settings, nowMs, hooks) {
    const calls = [];
    const net = Object.assign({ jolpicaQuali: true, openf1Status: 200, tyresFail: false }, hooks || {});
    sandbox.fetch = async (url) => {
      const u = decodeURIComponent(String(url).replace(/^.*\?url=/, ""));
      calls.push(u);
      const json = (o, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => o });
      if (u.includes("jolpi.ca")) {
        if (/\/2026\/1\/qualifying\.json/.test(u)) return json(net.jolpicaQuali ? fx("jolpica-qualifying-2026-r1.json") : { MRData: { RaceTable: { Races: [] } } });
        if (/\/2026\/2\/sprint\.json/.test(u)) return json(fx("jolpica-sprint-2026-r2.json"));
        return json({ MRData: { RaceTable: { Races: [] } } });
      }
      if (u.includes("openf1.org")) {
        if (net.openf1Status !== 200) return json({ detail: "x" }, net.openf1Status);
        if (/sessions\?year=2026/.test(u)) return json(fx("openf1-sessions-2026-trimmed.json"));
        if (/session_result\?session_key=(11227|11235)\b/.test(u)) return json(fx("openf1-session_result-fp1.json"));
        if (/session_result\?session_key=(11230|11236|11241)\b/.test(u)) return json(fx("openf1-session_result-quali.json"));
        if (/drivers\?/.test(u)) return json(drivers);
        if (/laps\?/.test(u)) return net.tyresFail ? json({ detail: "x" }, 500) : json(fx("openf1-laps-fp1-trimmed.json"));
        if (/stints\?/.test(u)) return json(fx("openf1-stints-fp1-trimmed.json"));
        return json([]);
      }
      return json({}, 404);
    };
    /* L'horloge du widget est celle du bac a sable, pas celle de ce
       fichier : c'est elle qu'on avance. The widget's clock is the
       sandbox's, not this file's. */
    const SDate = vm.runInContext("Date", sandbox);
    const realNow = SDate.now;
    SDate.now = () => nowMs.v;
    const ctx = {
      settings: Object.assign({ showDrivers: false, showConstructors: false, showResults: false, showNext: false,
        showSchedule: false, showWeather: false, showCircuit: false }, settings),
      api: { proxyUrl: (u) => "/api/proxy?url=" + encodeURIComponent(u) },
      i18n: { t: (k) => k },
      el: null
    };
    const w = new Widget(ctx);
    w.render = () => { };
    w.arm = () => { };
    w.data = { races, at: 0 };
    return { w, calls, restore() { SDate.now = realNow; }, net };
  }

  await test("qualifications : jolpica d'abord, puis la carte se remplit", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({ showQuali: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      const st = t.w.sess.quali;
      assert.ok(st && st.data && st.data.source === "jolpica", JSON.stringify(st && st.error));
      assert.ok(!t.calls.some((c) => c.includes("openf1.org")), "OpenF1 n'est pas sollicitee sans pneus");
      const html = t.w.cardSession("quali", now.v);
      assert.ok(/RUS/.test(html) && /1:18\.518/.test(html) && /\+0\.293/.test(html));
      assert.ok(!/pwf1-live/.test(html), "pas de badge : la seance est finie");
    } finally { t.restore(); }
  });

  await test("jolpica vide : OpenF1 prend le relais pour les qualifications", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({ showQuali: true, showTyres: false }, now, { jolpicaQuali: false });
    try {
      await t.w.refreshSessions();
      assert.strictEqual(t.w.sess.quali.data.source, "openf1");
      assert.ok(/1:18\.518/.test(t.w.cardSession("quali", now.v)));
    } finally { t.restore(); }
  });

  await test("essais libres : OpenF1, avec les pastilles de pneus", async () => {
    const now = { v: at("2026-03-06T04:00:00Z") };
    const t = make({ showFp1: true }, now);
    try {
      await t.w.refreshSessions();
      const d = t.w.sess.fp1.data;
      assert.strictEqual(d.source, "openf1");
      assert.ok(d.rows.some((r) => r.tyre), "au moins un pneu");
      const html = t.w.cardSession("fp1", now.v);
      assert.ok(/pwf1-tyre pwf1-tyre-[SMHIW]/.test(html));
      assert.ok(/f1\.sess\.credit\.openf1/.test(html));
    } finally { t.restore(); }
  });

  await test("l'echec des pneus ne coute pas la carte", async () => {
    const now = { v: at("2026-03-06T04:00:00Z") };
    const t = make({ showFp1: true }, now, { tyresFail: true });
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.fp1.data && !t.w.sess.fp1.error);
      assert.ok(!/pwf1-tyre /.test(t.w.cardSession("fp1", now.v)));
      assert.ok(/1:20\.267/.test(t.w.cardSession("fp1", now.v)));
    } finally { t.restore(); }
  });

  await test("pneus decoches : ni laps ni stints demandes", async () => {
    const now = { v: at("2026-03-06T04:00:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(!t.calls.some((c) => /laps\?|stints\?/.test(c)));
    } finally { t.restore(); }
  });

  await test("une seance pas encore commencee n'est PAS demandee : on affiche son horaire", async () => {
    const now = { v: at("2026-03-06T00:30:00Z") };
    const t = make({ showFp1: true, showQuali: true }, now);
    try {
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, 0, "aucun appel : " + t.calls.join(" | "));
      assert.ok(/f1\.sess\.later/.test(t.w.cardSession("fp1", now.v)));
    } finally { t.restore(); }
  });

  await test("week-end sprint : pas d'essais 2 ni 3, et la carte le dit", async () => {
    const now = { v: at("2026-03-14T09:00:00Z") };
    const t = make({ showFp2: true, showFp3: true, showSprint: true, showSprintQuali: true }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(/f1\.sess\.none/.test(t.w.cardSession("fp2", now.v)));
      assert.ok(/f1\.sess\.none/.test(t.w.cardSession("fp3", now.v)));
      assert.ok(/RUS/.test(t.w.cardSession("sprint", now.v)));
      assert.ok(/Q1/.test(t.w.cardSession("sprintQuali", now.v)));
    } finally { t.restore(); }
  });

  await test("EN DIRECT : badge pendant la seance, releve rapide, pas de relecture inutile", async () => {
    const now = { v: at("2026-03-06T02:00:00Z") };
    const t = make({ showFp1: true, showTyres: false, liveRefreshSeconds: 45 }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(/pwf1-live/.test(t.w.cardSession("fp1", now.v)));
      assert.strictEqual(t.w.nextDelay(now.v), 45000);
      const n = t.calls.length;
      now.v += 10000;
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, n, "10 s plus tard : le cache sert");
      now.v += 40000;
      await t.w.refreshSessions();
      assert.ok(t.calls.length > n, "45 s plus tard : relecture");
    } finally { t.restore(); }
  });

  await test("le plancher du releve rapide est de 30 s", () => {
    const now = { v: at("2026-03-06T02:00:00Z") };
    const t = make({ showFp1: true, liveRefreshSeconds: 5 }, now);
    try { assert.strictEqual(t.w.liveSeconds(), 30); } finally { t.restore(); }
  });

  await test("une seance terminee est gardee : pas de relecture avant 25 minutes", async () => {
    const now = { v: at("2026-03-06T08:00:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      const n = t.calls.length;
      now.v += 10 * 60000;
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, n);
      now.v += 20 * 60000;
      await t.w.refreshSessions();
      assert.ok(t.calls.length > n);
    } finally { t.restore(); }
  });

  await test("juste apres la fin, une derniere relecture est programmee", async () => {
    const now = { v: at("2026-03-06T02:30:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      now.v = at("2026-03-06T02:35:00Z");
      assert.strictEqual(liveOf(t.w, now.v), "fp1");
      now.v = at("2026-03-06T02:50:00Z");
      assert.strictEqual(liveOf(t.w, now.v), null);
      assert.ok(t.w.nextDelay(now.v) <= 60000, "relecture finale sous la minute");
    } finally { t.restore(); }
    function liveOf(w, n) { return H.liveSession(H.weekendRace(w.data.races, n), n); }
  });

  await test("OpenF1 en acces limite (401) : message dedie, jamais une carte vide muette", async () => {
    const now = { v: at("2026-03-06T02:00:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now, { openf1Status: 401 });
    try {
      await t.w.refreshSessions();
      assert.strictEqual(t.w.sess.fp1.error, "locked");
      assert.ok(/f1\.sess\.locked/.test(t.w.cardSession("fp1", now.v)));
    } finally { t.restore(); }
  });

  await test("une erreur n'efface pas les resultats deja affiches", async () => {
    const now = { v: at("2026-03-06T02:00:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.fp1.data);
      t.net.openf1Status = 500;
      now.v += 60000;
      await t.w.refreshSessions();
      assert.ok(t.w.sess.fp1.data, "les donnees precedentes sont conservees");
      assert.ok(t.w.sess.fp1.error);
      const html = t.w.cardSession("fp1", now.v);
      assert.ok(/1:20\.267/.test(html) && /f1\.stale/.test(html));
    } finally { t.restore(); }
  });

  await test("un changement de week-end vide la memoire des seances", async () => {
    const now = { v: at("2026-03-06T08:00:00Z") };
    const t = make({ showFp1: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.fp1);
      now.v = at("2026-03-13T08:00:00Z");
      await t.w.refreshSessions();
      assert.ok(!t.w.sess.fp1 || t.w.sess.fp1.data.rows.length, "pas de donnees de l'ancien week-end");
      assert.strictEqual(t.w.sessRound, "2026:2");
    } finally { t.restore(); }
  });

  await test("les favoris sont mis en evidence dans une carte de seance", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({ showQuali: true, showTyres: false, favDrivers: "ANT", favTeams: "ferrari" }, now);
    try {
      await t.w.refreshSessions();
      const html = t.w.cardSession("quali", now.v);
      const favRows = html.match(/<tr class="pwf1-fav">/g) || [];
      assert.ok(favRows.length >= 2, "pilote et ecurie : " + favRows.length);
      assert.ok(/pwf1-star/.test(html));
    } finally { t.restore(); }
  });

  await test("la carte Grille de depart lit les qualifications, avec l'ecart a la pole", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({ showGrid: true, showTyres: false }, now);
    try {
      await t.w.refreshSessions();
      assert.ok(t.w.sess.quali, "la grille charge les qualifications");
      const html = t.w.cardSession("grid", now.v);
      assert.ok(/f1\.th\.gapPole/.test(html) && /\+0\.293/.test(html) && /f1\.sess\.gridNote/.test(html));
    } finally { t.restore(); }
  });

  await test("le nombre de lignes suit le reglage", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({ showQuali: true, showTyres: false, sessionRows: 5 }, now);
    try {
      await t.w.refreshSessions();
      const rows = (t.w.cardSession("quali", now.v).match(/<tbody>([\s\S]*)<\/tbody>/) || [])[1] || "";
      assert.strictEqual((rows.match(/<tr/g) || []).length, 5);
    } finally { t.restore(); }
  });

  await test("sans aucune carte de seance, OpenF1 et la liste des seances ne sont jamais appelees", async () => {
    const now = { v: at("2026-03-07T08:00:00Z") };
    const t = make({}, now);
    try {
      assert.strictEqual(t.w.needSessions(), false);
      await t.w.refreshSessions();
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  console.log("== Les cartes sont facultatives (aucune surprise pour une tuile existante) ==");
  await test("les sept blocs sont optIn, ont leur reglage et un titre", () => {
    const ids = ["fp1", "fp2", "fp3", "sprintQuali", "quali", "sprint", "grid"];
    for (const id of ids) {
      const b = H.BLOCKS.find((x) => x.id === id);
      assert.ok(b && b.optIn === true, id);
    }
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "f1", "manifest.json"), "utf8"));
    for (const id of ids) {
      const b = H.BLOCKS.find((x) => x.id === id);
      const st = man.settings.find((x) => x.key === b.key);
      assert.ok(st && st.default === false, b.key + " decoche par defaut");
    }
  });
  await test("la disposition « Seances » ne couvre que des blocs connus et ne se chevauche pas", () => {
    const p = H.PRESETS.find((x) => x.id === "sessions");
    assert.ok(p);
    const ids = Object.keys(p.items);
    for (const id of ids) assert.ok(H.BLOCKS.find((b) => b.id === id), "bloc inconnu : " + id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = p.items[ids[i]], b = p.items[ids[j]];
      const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!hit, ids[i] + " chevauche " + ids[j]);
    }
  });

  if (failures) { console.log("\n>>> " + failures + " ECHEC(S)"); process.exit(1); }
  console.log("\n>>> TOUS LES TESTS PASSENT");
})();
