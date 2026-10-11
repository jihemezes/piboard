/* Test unitaire du menu "Rafraichir maintenant" du widget Trafic
   (public/widgets/traffic/widget.js).

   Pourquoi un fichier separe plutot qu'un ajout a dom-smoke.js : y
   ajouter une tuile Trafic decalerait le nombre de tuiles montees et les
   positions attendues par les tests existants, et surtout la tuile
   exige Leaflet, absent du bac a sable. Ici le widget est instancie
   seul, la construction de la carte et les acces reseau sont neutralises
   sur l'instance, et seule la mecanique du menu est exercee -- par de
   vrais evenements pointerup sur les vrais boutons.

   Unit test for the Traffic widget's "Refresh now" menu. Separate file
   rather than an addition to dom-smoke.js: a Traffic tile there would
   shift the mounted tile count and the positions existing tests expect,
   and above all the tile needs Leaflet, absent from the sandbox. Here
   the widget is instantiated on its own, map building and network access
   are neutralised on the instance, and only the menu's mechanics are
   exercised -- with real pointerup events on the real buttons. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const WIDGET = path.join(__dirname, "..", "public", "widgets", "traffic", "widget.js");

const dom = new JSDOM("<!doctype html><html><body><div id=\"tile\"></div></body></html>", {
  pretendToBeVisual: true
});
const { window } = dom;
global.window = window;
global.document = window.document;

let TrafficWidget = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "traffic") TrafficWidget = cls; } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(WIDGET, "utf8"));
assert.ok(TrafficWidget, "le widget trafic s'est bien enregistre");

async function makeWidget() {
  const el = window.document.getElementById("tile");
  el.innerHTML = "";
  const w = new TrafficWidget({
    el,
    settings: { apiKey: "cle-de-test", city: "Toulouse" },
    i18n: { t: (k) => k },
    api: {}
  });
  const calls = { refresh: 0 };
  // Neutralise tout ce qui sort de la tuile : carte Leaflet, geocodage,
  // quota, et le rafraichissement lui-meme, dont on veut seulement
  // savoir s'il est demande. Neutralises everything leaving the tile:
  // Leaflet map, geocoding, quota, and the refresh itself, of which we
  // only want to know whether it is requested.
  w.geocode = async () => ({ lat: 43.6, lon: 1.44, name: "Toulouse" });
  w.buildMap = () => { w.map = {}; };
  w.refreshQuotaDisplay = async () => {};
  w.updateCartouche = () => {};
  w.tick = () => {};
  w.refreshData = async () => { calls.refresh++; };
  await w.init();
  clearInterval(w.scheduleTimer);
  clearInterval(w.uiTimer);
  return { w, calls, el };
}

function tap(node) {
  node.dispatchEvent(new window.Event("pointerup", { bubbles: true, cancelable: true }));
}

(async () => {
  try {
    console.log("== Le menu propose \"maintenant\" en premier ==");
    const { w, calls, el } = await makeWidget();
    const items = el.querySelectorAll(".pwt-boost-menu li");
    assert.ok(items.length >= 6, "le menu compte les durees plus l'entree immediate");
    assert.strictEqual(items[0].dataset.min, "0",
      "l'entree immediate vient en tete, avant la plus courte des durees");
    console.log("  OK entree immediate en tete du menu");

    console.log("== Elle rafraichit tout de suite, sans changer la cadence ==");
    tap(el.querySelector(".pwt-boost-trigger"));
    assert.strictEqual(el.querySelector(".pwt-boost-menu").hidden, false, "le menu s'ouvre");
    tap(items[0].querySelector("button"));
    assert.strictEqual(calls.refresh, 1, "un rafraichissement a bien ete demande");
    assert.strictEqual(w.boostUntil, 0,
      "aucune periode de cadence acceleree n'a ete engagee");
    assert.strictEqual(el.querySelector(".pwt-boost-menu").hidden, true, "le menu se referme");
    console.log("  OK rafraichissement immediat, sans boost");

    console.log("== Elle passe outre la pause : c'est une demande explicite ==");
    const b = await makeWidget();
    b.w.paused = true;
    tap(b.el.querySelectorAll(".pwt-boost-menu li")[0].querySelector("button"));
    assert.strictEqual(b.calls.refresh, 1, "meme en pause, la demande est honoree");
    assert.strictEqual(b.w.paused, true, "et la pause n'est pas levee pour autant");
    console.log("  OK pause respectee mais demande honoree");

    console.log("== Les durees, elles, engagent bien une cadence acceleree ==");
    const c = await makeWidget();
    const cItems = c.el.querySelectorAll(".pwt-boost-menu li");
    assert.strictEqual(cItems[1].dataset.min, "5", "la premiere duree reste 5 min");
    tap(cItems[1].querySelector("button"));
    assert.ok(c.w.boostUntil > Date.now(), "une periode acceleree court desormais");
    console.log("  OK 5 min engage toujours un boost");

    console.log("\n>>> TOUS LES TESTS TRAFIC PASSENT");
  } catch (e) {
    console.error("\n>>> ECHEC :", e.message);
    process.exit(1);
  }
})();
