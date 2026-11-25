/* Tuile Astronomie : section « Prochains lancements » (1.177.0). jsdom,
   fetch factice. Liste, filtre, favoris, bouton Regarder / EN DIRECT,
   rediffusion, fenetre de detail, compte a rebours, alerte. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
let Astro = null;
const opened = [], phone = [];
window.PiBoard = {
  registerWidget: (id, k) => { if (id === "astronomy") Astro = k; },
  openLink: (u, t) => opened.push(u),
  notifyPhone: (d) => { phone.push(d); return Promise.resolve(true); }
};
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "astronomy", "widget.js"), "utf8"));
assert.ok(Astro);

const H = 3600000, now = Date.now();
const iso = (ms) => new Date(now + ms).toISOString();
const launch = (o) => Object.assign({ id: "x", name: "Falcon 9 | Starlink", net: iso(5 * H), precision: "MIN", status: { abbrev: "Go", name: "Go for Launch" },
  provider: { name: "SpaceX", abbrev: "SpX" }, rocket: "Falcon 9 Block 5", mission: { name: "Starlink 10-1", description: "Satellites.", orbitName: "Low Earth Orbit", customers: [] },
  pad: { name: "SLC-40", location: "Cape Canaveral SFS, FL, USA" }, image: null, probability: null, videos: [], updates: [], infoUrl: null }, o);
let data = {
  upcoming: [
    launch({ id: "a6", name: "Ariane 64 | Galileo", net: iso(20 * 60000), rocket: "Ariane 64", provider: { name: "Arianespace", abbrev: "ASA" },
      videos: [{ url: "https://www.youtube.com/watch?v=live1", publisher: "Arianespace", youtube: true, live: true, lang: "fr" }, { url: "https://www.youtube.com/watch?v=cnes", publisher: "CNES", youtube: true, live: false }],
      updates: [{ at: iso(-H), text: "Météo favorable" }], infoUrl: "https://arianespace.test/" }),
    launch({ id: "f9", videos: [{ url: "https://x.com/b", publisher: "X", youtube: false, live: false }] }),
    launch({ id: "el", name: "Electron | Mission", rocket: "Electron", provider: { name: "Rocket Lab", abbrev: "RL" }, net: iso(30 * H) })
  ],
  previous: [
    launch({ id: "old", name: "Vulcan | Mission", rocket: "Vulcan VC6L", provider: { name: "United Launch Alliance", abbrev: "ULA" }, net: iso(-30 * H), status: { abbrev: "Failure", name: "Launch Failure" },
      videos: [{ url: "https://www.youtube.com/watch?v=replay", publisher: "ULA", youtube: true, live: false }] }),
    launch({ id: "ancient", net: iso(-10 * 24 * H), status: { abbrev: "Success" } })
  ],
  stale: false, error: null
};
const posts = [];
window.fetch = global.fetch = async (url, opts) => {
  const u = String(url);
  const ok = (o) => ({ ok: true, status: 200, json: async () => o });
  if (u.includes("geocoding-api")) return ok({ results: [{ latitude: 43.6, longitude: 1.44, elevation: 150, name: "Toulouse" }] });
  if (u === "/api/launches") return ok(data);
  if (u === "/api/launches/claim") { posts.push(JSON.parse(opts.body)); return ok({ granted: JSON.parse(opts.body).ids }); }
  return ok({});
};
const alerts = [];
function make(settings) {
  const el = window.document.createElement("div");
  window.document.body.appendChild(el);
  const w = new Astro({ el, settings: Object.assign({ city: "Toulouse", showMoonPhase: false, showIss: false, showPlanets: false, showEclipse: false, launchFavorites: "Ariane, Vega" }, settings || {}),
    i18n: { lang: "fr", t: (k) => (k === "clock.date.format" ? "fr-FR" : k) }, api: { startAlert: (o) => alerts.push(o) } });
  return { w, el };
}
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

(async () => {
  console.log("== Liste ==");
  let { w, el } = make();
  await w.init();
  const items = [...el.querySelectorAll(".pwa-l-item:not(.past)")];
  assert.strictEqual(items.length, 3, "3 lancements par defaut");
  assert.ok(items[0].classList.contains("fav") && /★/.test(items[0].textContent), "Ariane : favori");
  assert.ok(/T− 00:\d\d:\d\d/.test(items[0].querySelector(".pwa-l-cd").textContent), "derniere heure : compte a rebours a la seconde");
  assert.ok(/T− \d+ h \d\d min/.test(items[1].querySelector(".pwa-l-cd").textContent), "sinon heures / minutes");
  const live = items[0].querySelector(".pwa-l-watch");
  assert.ok(live && live.classList.contains("live") && /astronomy\.launch\.live/.test(live.textContent), "diffusion en cours : EN DIRECT");
  assert.ok(!items[2].querySelector(".pwa-l-watch"), "pas de lien : pas de bouton");
  const past = el.querySelectorAll(".pwa-l-item.past");
  assert.strictEqual(past.length, 1, "lancement recent (3 jours) seulement");
  assert.ok(/astronomy\.launch\.st\.ko/.test(past[0].textContent) && /astronomy\.launch\.replay/.test(past[0].textContent), "echec + rediffusion");
  console.log("  OK");

  console.log("== Regarder ==");
  click(live);
  assert.strictEqual(opened.pop(), "https://www.youtube.com/watch?v=live1", "la diffusion en direct est ouverte");
  assert.ok(!document.querySelector(".pwa-l-back"), "le bouton n'ouvre pas la fenetre de detail");
  click(past[0].querySelector(".pwa-l-watch"));
  assert.strictEqual(opened.pop(), "https://www.youtube.com/watch?v=replay");
  console.log("  OK");

  console.log("== Fenetre de detail ==");
  click(items[0]);
  const win = document.querySelector(".pwa-l-win");
  assert.ok(win && /Ariane 64 \| Galileo/.test(win.textContent) && /Météo favorable/.test(win.textContent), "detail : mission, nouvelles");
  assert.strictEqual(win.querySelectorAll(".pwa-l-vid:not(.pwa-l-info)").length, 2, "toutes les diffusions");
  click(win.querySelectorAll(".pwa-l-vid")[1]);
  assert.strictEqual(opened.pop(), "https://www.youtube.com/watch?v=cnes");
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!document.querySelector(".pwa-l-back"), "Echap ferme");
  w.destroy();
  console.log("  OK");

  console.log("== Filtre ==");
  ({ w, el } = make({ launchOperators: "arianespace, rocket lab", launchPastDays: 0 }));
  await w.init();
  const names = [...el.querySelectorAll(".pwa-l-name b")].map((b) => b.textContent);
  assert.deepStrictEqual(names, ["Ariane 64", "Electron"], "seulement les operateurs choisis");
  assert.ok(!el.querySelector(".pwa-l-item.past"), "0 jour : pas de lancements recents");
  w.destroy();
  console.log("  OK");

  console.log("== Alerte ==");
  ({ w, el } = make({ launchAlertMinutes: 30, launchAlertPhone: true }));
  await w.init();
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(alerts.length, 1, "Ariane dans 20 min, alerte a 30 min : flash + son");
  assert.ok(el.querySelector(".pwa-l-banner"), "bandeau « lancement imminent »");
  assert.deepStrictEqual(posts[0].ids, ["launch:a6:" + data.upcoming[0].net], "revendique cote serveur");
  assert.ok(phone.length === 1 && phone[0].url === "https://www.youtube.com/watch?v=live1", "telephone : lien de la diffusion");
  w.checkLaunchAlerts();
  assert.strictEqual(alerts.length, 1, "une seule fois");
  w.destroy();
  ({ w, el } = make({ launchAlertMinutes: 30, launchFavorites: "" }));
  await w.init();
  assert.strictEqual(alerts.length, 1, "sans favoris : pas d'alerte");
  w.destroy();
  console.log("  OK");

  console.log("== Source indisponible ==");
  data = { error: "x" };
  ({ w, el } = make());
  await w.init();
  assert.ok(/astronomy\.launch\.error/.test(el.textContent), "message d'erreur");
  w.destroy();
  console.log("  OK");

  console.log("astronomyLaunches : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
