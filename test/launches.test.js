/* Lancements spatiaux (1.177.0) : normalisation des donnees de Launch
   Library 2, rythme de lecture, cache et repli sur erreur (429), alertes
   revendiquees une seule fois. Fetch factice : aucun reseau. */
"use strict";
const assert = require("assert");
const L = require("../server/launches");

const raw = (o) => Object.assign({
  id: "a1", name: "Ariane 64 | Galileo L15", net: "2026-11-24T11:14:52Z", window_start: "2026-11-24T11:14:52Z", window_end: "2026-11-24T11:14:52Z",
  net_precision: { abbrev: "SEC" }, status: { id: 1, abbrev: "Go", name: "Go for Launch" },
  launch_service_provider: { name: "Arianespace", abbrev: "ASA", country: [{ alpha_2_code: "FR" }] },
  rocket: { configuration: { name: "Ariane 64", full_name: "Ariane 64 Block 2" } },
  mission: { name: "Galileo L15", description: "Deux satellites Galileo.", type: "Navigation", orbit: { abbrev: "MEO", name: "Medium Earth Orbit" }, agencies: [{ name: "ESA" }] },
  pad: { name: "ELA-4", location: { name: "Guiana Space Centre, French Guiana" }, country: { alpha_2_code: "GF" } },
  image: { thumbnail_url: "https://img.test/t.jpg" }, probability: 80, weather_concerns: "Vent",
  webcast_live: false,
  vid_urls: [
    { priority: 20, url: "https://x.com/i/broadcasts/abc", source: "x.com", publisher: "X", live: false },
    { priority: 10, url: "https://www.youtube.com/watch?v=k2adMyxSoJE", source: "youtube.com", publisher: "Arianespace", title: "Live", live: true, language: { code: "fr" }, start_time: "2026-11-24T10:50:00Z" },
    { priority: 5, url: "javascript:alert(1)", source: "evil" }
  ],
  info_urls: [{ url: "https://arianespace.test/galileo" }],
  updates: [{ created_on: "2026-11-20T10:00:00Z", comment: "Date confirmée" }]
}, o || {});

(async () => {
  console.log("== Normalisation ==");
  const n = L.normalize(raw());
  assert.strictEqual(n.rocket, "Ariane 64 Block 2");
  assert.deepStrictEqual(n.provider, { name: "Arianespace", abbrev: "ASA", country: "FR" });
  assert.strictEqual(n.mission.orbit, "MEO");
  assert.deepStrictEqual(n.mission.customers, ["ESA"]);
  assert.strictEqual(n.pad.location, "Guiana Space Centre, French Guiana");
  assert.strictEqual(n.videos.length, 2, "lien non http ecarte");
  assert.strictEqual(n.videos[0].publisher, "Arianespace", "trie par priorite");
  assert.ok(n.videos[0].youtube && n.videos[0].live && n.videos[0].lang === "fr");
  assert.strictEqual(n.infoUrl, "https://arianespace.test/galileo");
  assert.strictEqual(n.updates[0].text, "Date confirmée");
  assert.strictEqual(L.normalize(null), null);
  console.log("  OK");

  console.log("== Rythme de lecture ==");
  const now = Date.parse("2026-11-24T09:00:00Z");
  assert.strictEqual(L.upcomingDelay([{ net: "2026-11-24T11:00:00Z" }], now), 10 * 60000, "tir dans 2 h : toutes les 10 min");
  assert.strictEqual(L.upcomingDelay([{ net: "2026-11-25T11:00:00Z" }], now), 30 * 60000, "sinon toutes les 30 min");
  console.log("  OK");

  console.log("== Cache, erreurs ==");
  L._reset();
  let calls = [];
  let mode = "ok";
  const fakeFetch = async (url) => {
    calls.push(url);
    if (mode === "429") return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ results: [raw({ id: url.includes("previous") ? "p1" : "u1", net: "2026-11-30T10:00:00Z" })] }) };
  };
  let d = await (async () => { await L.refresh({ fetch: fakeFetch, now }); return L.getLaunches({ fetch: fakeFetch, now }); })();
  assert.strictEqual(calls.length, 2, "une lecture a venir + une lecture passee");
  assert.ok(calls.every((u) => /mode=detailed/.test(u)), "mode detaille (liens video)");
  assert.strictEqual(d.upcoming[0].id, "u1"); assert.strictEqual(d.previous[0].id, "p1");
  await L.getLaunches({ fetch: fakeFetch, now: now + 5 * 60000 });
  assert.strictEqual(calls.length, 2, "dans le delai : cache, aucun appel");
  mode = "429";
  d = await L.getLaunches({ fetch: fakeFetch, now: now + 31 * 60000 });
  assert.strictEqual(d.error, "rate-limited", "429 signale");
  assert.ok(d.stale && d.upcoming.length === 1, "les dernieres donnees restent servies");
  const before = calls.length;
  await L.getLaunches({ fetch: fakeFetch, now: now + 35 * 60000 });
  assert.strictEqual(calls.length, before, "apres un 429, la lecture suivante est repoussee");
  console.log("  OK");

  console.log("== Alertes revendiquees ==");
  assert.deepStrictEqual(L.claim(["launch:a:1"]), ["launch:a:1"]);
  assert.deepStrictEqual(L.claim(["launch:a:1", "launch:b:1"]), ["launch:b:1"], "un ecran seulement");
  console.log("  OK");

  console.log("launches : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
