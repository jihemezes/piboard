/* Tuile Carte de trafic : verrou du zoom / de la position, vue d'origine,
   retour automatique (1.173.0). Leaflet est absent du bac a sable : la
   carte est remplacee par un faux objet qui enregistre les appels, et seule
   la logique du widget est exercee (boutons compris, par de vrais
   evenements pointerup). */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id=\"tile\"></div></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
let Traffic = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "traffic") Traffic = cls; } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "traffic", "widget.js"), "utf8"));
assert.ok(Traffic);

const HANDLERS = ["dragging", "touchZoom", "doubleClickZoom", "scrollWheelZoom", "boxZoom", "keyboard"];
function fakeMap() {
  const m = { view: { lat: 43.6, lng: 1.44, z: 13 }, setViewCalls: [], listeners: {} };
  HANDLERS.forEach((h) => { m[h] = { on: true, enable() { this.on = true; }, disable() { this.on = false; } }; });
  m.getCenter = () => ({ lat: m.view.lat, lng: m.view.lng });
  m.getZoom = () => m.view.z;
  m.setView = (c, z) => { m.view = { lat: c[0], lng: c[1], z }; m.setViewCalls.push([c, z]); };
  m.on = (ev, fn) => { m.listeners[ev] = fn; };
  m.remove = () => {};
  m.container = window.document.createElement("div");
  m.getContainer = () => m.container;
  return m;
}
function make(settings) {
  const el = window.document.getElementById("tile");
  el.innerHTML = '<div class="pw-traffic"></div>';
  const saved = [];
  const w = new Traffic({
    el, settings: Object.assign({ apiKey: "k", city: "Toulouse", zoom: 13 }, settings || {}),
    i18n: { t: (k) => k }, api: {}, updateSettings: (p) => saved.push(p)
  });
  w.coords = { lat: 43.6, lon: 1.44 };
  w.map = fakeMap();
  w.makeViewControlDom();
  el.querySelector(".pw-traffic").appendChild(w.viewBox);
  return { w, saved, el };
}
const press = (b) => b.dispatchEvent(new window.Event("pointerup", { bubbles: true, cancelable: true }));
const allOn = (m, on) => HANDLERS.every((h) => m[h].on === on);

(async () => {
  console.log("== Verrou ==");
  let { w, saved, el } = make();
  w.applyLock();
  assert.ok(allOn(w.map, true), "deverrouillee : tous les gestes actifs");
  press(w.viewBox.querySelector(".pwt-vlock"));
  assert.ok(allOn(w.map, false), "le cadenas coupe tous les gestes (glisser, molette, double-clic, pincement, clavier...)");
  assert.ok(el.querySelector(".pw-traffic").classList.contains("pwt-locked"), "classe pwt-locked posee (boutons +/- grises)");
  assert.strictEqual(saved.length, 1, "un seul enregistrement");
  assert.strictEqual(saved[0].mapLocked, true, "le verrou est enregistre avec la tuile");
  const hv = JSON.parse(saved[0].homeView);
  assert.deepStrictEqual([hv.lat, hv.lon, hv.z, hv.city, hv.zoom], [43.6, 1.44, 13, "Toulouse", 13], "verrouiller memorise la vue affichee");
  assert.ok(w.viewBox.querySelector(".pwt-vlock").classList.contains("on"), "le cadenas est visiblement enfonce");
  press(w.viewBox.querySelector(".pwt-vlock"));
  assert.ok(allOn(w.map, true), "second appui : deverrouille");
  assert.strictEqual(saved[1].mapLocked, false);
  assert.ok(!("homeView" in saved[1]), "deverrouiller ne touche pas a la vue memorisee");
  console.log("  OK");

  console.log("== Balayage tactile entre pages (1.173.1) ==");
  {
    const t = make();
    t.w.applyLock();
    assert.strictEqual(t.w.map.container.style.touchAction, "", "deverrouillee : touch-action laisse a Leaflet");
    t.w.setLocked(true);
    assert.strictEqual(t.w.map.container.style.touchAction, "none",
      "verrouillee : touch-action reste none, les evenements tactiles atteignent le tableau (changement de page au doigt)");
    t.w.setLocked(false);
    assert.strictEqual(t.w.map.container.style.touchAction, "", "deverrouillee de nouveau : rendu a Leaflet");
    const css = fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "traffic", "widget.css"), "utf8");
    assert.ok(/pwt-locked \.leaflet-container\s*\{\s*touch-action:\s*none\s*!important/.test(css), "regle CSS de secours presente");
  }
  console.log("  OK");

  console.log("== Mise a jour des donnees non touchee ==");
  {
    const t = make({ mapLocked: true });
    t.w.applyLock();
    let refreshed = 0;
    t.w.refreshData = async () => { refreshed++; };
    await t.w.refreshData();
    assert.strictEqual(refreshed, 1, "carte verrouillee : le rafraichissement des donnees fonctionne");
    assert.ok(!("refreshData" in t.w.map), "le verrou ne touche qu'aux gestes de la carte");
  }
  console.log("  OK");

  console.log("== Vue d'origine ==");
  {
    const t = make();
    t.w.map.view = { lat: 43.7, lng: 1.5, z: 15 };
    press(t.w.viewBox.querySelector(".pwt-vpin"));
    assert.strictEqual(JSON.parse(t.saved[0].homeView).z, 15, "le repere memorise la vue actuelle sans verrouiller");
    assert.ok(!("mapLocked" in t.saved[0]), "sans verrouiller");
    t.w.map.view = { lat: 44, lng: 2, z: 9 };
    assert.ok(t.w.differsFromHome());
    press(t.w.viewBox.querySelector(".pwt-vhome"));
    assert.deepStrictEqual(t.w.map.view, { lat: 43.7, lng: 1.5, z: 15 }, "le viseur ramene a la vue memorisee");
    assert.ok(!t.w.differsFromHome());
    // vue memorisee invalide si la ville ou le zoom des reglages changent
    t.w.ctx.settings.city = "Bordeaux";
    assert.strictEqual(t.w.homeTarget().memorized, false, "ville changee : retour au cadrage des reglages");
    t.w.ctx.settings.city = "Toulouse"; t.w.ctx.settings.zoom = 11;
    assert.strictEqual(t.w.homeTarget().memorized, false, "zoom des reglages change : vue memorisee abandonnee");
    // sans vue memorisee : ville + zoom des reglages
    const u = make({ zoom: 12 });
    assert.deepStrictEqual([u.w.homeTarget().z, u.w.homeTarget().memorized], [12, false]);
    // le viseur marche aussi verrouille
    const v = make({ mapLocked: true });
    v.w.applyLock(); v.w.map.view = { lat: 1, lng: 1, z: 5 };
    press(v.w.viewBox.querySelector(".pwt-vhome"));
    assert.strictEqual(v.w.map.view.z, 13, "retour a la vue d'origine possible carte verrouillee");
  }
  console.log("  OK");

  console.log("== Retour automatique ==");
  {
    const realSet = global.setTimeout;
    const timers = [];
    global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    global.clearTimeout = () => {};
    const t = make({ autoReturnMinutes: 5 });
    t.w.map.view = { lat: 45, lng: 3, z: 10 };
    t.w.armAutoReturn();
    const tm = timers[timers.length - 1];
    assert.ok(tm && tm.ms === 5 * 60000, "minuterie armee a N minutes");
    tm.fn();
    assert.strictEqual(t.w.map.view.z, 13, "la carte deplacee revient a la vue d'origine");
    timers.length = 0;
    const u = make({ autoReturnMinutes: 5, mapLocked: true });
    u.w.armAutoReturn();
    assert.strictEqual(timers.length, 0, "verrouillee : aucune minuterie");
    const z = make({ autoReturnMinutes: 0 });
    z.w.armAutoReturn();
    assert.strictEqual(timers.length, 0, "0 minute : jamais");
    global.setTimeout = realSet;
  }
  console.log("  OK");

  console.log("== Reglages enregistres ==");
  {
    const t = make({ mapLocked: true, zoom: 13 });
    t.w.applyLock();
    t.w.onSettingsChanged = Traffic.prototype.onSettingsChanged;
    // un autre reglage change : la vue verrouillee ne bouge pas
    let zoomed = 0; t.w.map.setZoom = () => { zoomed++; };
    t.w.tick = () => {};
    t.w.onSettingsChanged(Object.assign({}, t.w.ctx.settings, { showJams: false }));
    assert.strictEqual(zoomed, 0, "un autre reglage ne reapplique pas le zoom");
    t.w.onSettingsChanged(Object.assign({}, t.w.ctx.settings, { zoom: 15 }));
    assert.strictEqual(zoomed, 1, "le zoom des reglages est reapplique quand on le change");
    t.w.onSettingsChanged(Object.assign({}, t.w.ctx.settings, { mapLocked: false }));
    assert.ok(allOn(t.w.map, true), "decocher le verrou dans les reglages libere la carte");
  }
  console.log("  OK");

  console.log("trafficViewLock : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
