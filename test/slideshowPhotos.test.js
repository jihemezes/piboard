/* Diaporama : source « Photothèque Photos (Mac) » (1.166.0). Le widget
   est instancie seul ; fetch est simule. On verifie la requete envoyee au
   serveur (filtres, plafond) et la traduction des erreurs en messages.
   Slideshow: "Photos library (Mac)" source. The widget is instantiated on
   its own; fetch is faked. Checks the request sent to the server
   (filters, cap) and the translation of errors into messages. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id=\"tile\"></div></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
let Slideshow = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "slideshow") Slideshow = cls; } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "slideshow", "widget.js"), "utf8"));
assert.ok(Slideshow);

let lastUrl = "";
let lastInit = null;
let answer = { ok: true, status: 200, body: { items: [{ name: "A/x.jpg", url: "/api/photos/file?id=A%2Fx.jpg&max=2560" }], albumFound: true } };
global.fetch = window.fetch = (url, init) => {
  lastUrl = String(url);
  lastInit = init || null;
  return Promise.resolve({ ok: answer.ok, status: answer.status, json: () => Promise.resolve(answer.body) });
};

function make(settings) {
  return new Slideshow({
    el: window.document.getElementById("tile"),
    settings: Object.assign({ source: "photos" }, settings),
    instanceId: "t-photos",
    i18n: { t: (k) => k },
    api: {}
  });
}

(async () => {
  console.log("== Diaporama Photos : la requete porte les filtres ==");
  {
    const r = await make({ photosSource: "album", photosAlbum: "Vacances", photosOrder: "oldest", photosOrient: "landscape", photosMinWidth: 2000, photosNoShots: true, photosLimit: 50, photosLibrary: "/Users/jm/Pictures/Photos Library.photoslibrary" }).loadImages();
    const q = new URLSearchParams(lastUrl.split("?")[1]);
    assert.strictEqual(lastUrl.split("?")[0], "/api/photos/list");
    assert.strictEqual(q.get("urls"), "1");
    assert.strictEqual(q.get("source"), "album");
    assert.strictEqual(q.get("album"), "Vacances");
    assert.strictEqual(q.get("order"), "oldest");
    assert.strictEqual(q.get("orient"), "landscape");
    assert.strictEqual(q.get("minWidth"), "2000");
    assert.strictEqual(q.get("noScreenshots"), "1");
    assert.strictEqual(q.get("limit"), "50");
    assert.strictEqual(q.get("library"), "/Users/jm/Pictures/Photos Library.photoslibrary");
    assert.strictEqual(r.src, "photos");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r.urls)), ["/api/photos/file?id=A%2Fx.jpg&max=2560"]);
    console.log("  OK");
  }

  console.log("== Diaporama Photos : « Ma selection » (POST) ==");
  {
    const sel = JSON.stringify({ albums: [{ id: "10", title: "Vacances" }], include: ["C/CCCC3333.png"], exclude: ["A/AAAA1111.jpg"] });
    const r = await make({ photosSource: "selection", photosSelection: sel, photosOrder: "oldest" }).loadImages();
    assert.strictEqual(lastUrl, "/api/photos/list", "pas de selection dans l'adresse");
    assert.strictEqual(lastInit.method, "POST");
    const body = JSON.parse(lastInit.body);
    assert.strictEqual(body.source, "selection");
    assert.strictEqual(body.selection, sel);
    assert.strictEqual(body.urls, "1");
    assert.strictEqual(body.order, "oldest");
    assert.strictEqual(r.urls.length, 1);
    const saved = answer;
    answer = { ok: true, status: 200, body: { items: [], albumFound: true } };
    const empty = await make({ photosSource: "selection", photosSelection: "" }).loadImages();
    assert.strictEqual(empty.error, "slideshow.photosNoSelection", "selection vide : message qui dit quoi faire");
    answer = saved;
    await make({ photosSource: "favorites" }).loadImages();
    assert.ok(!lastInit || !lastInit.method, "les autres sources restent en GET");
    console.log("  OK");
  }

  console.log("== Diaporama Photos : valeurs par defaut ==");
  {
    await make({}).loadImages();
    const q = new URLSearchParams(lastUrl.split("?")[1]);
    assert.strictEqual(q.get("source"), "all");
    assert.strictEqual(q.get("order"), "recent");
    assert.strictEqual(q.get("orient"), "any");
    assert.strictEqual(q.get("minWidth"), "0");
    assert.strictEqual(q.get("limit"), "300", "plafond par defaut");
    assert.ok(!q.has("library"), "pas de phototheque imposee : la premiere trouvee");
    await make({ photosNoShots: false, photosLimit: 99999 }).loadImages();
    const q2 = new URLSearchParams(lastUrl.split("?")[1]);
    assert.strictEqual(q2.get("noScreenshots"), "0", "case decochee : captures gardees");
    assert.strictEqual(q2.get("limit"), "2000", "plafond borne a 2000");
    console.log("  OK");
  }

  console.log("== Diaporama Photos : erreurs expliquees ==");
  {
    answer = { ok: false, status: 403, body: { error: "permission" } };
    assert.strictEqual((await make({}).loadImages()).error, "slideshow.photosPermission");
    answer = { ok: false, status: 404, body: { error: "no library" } };
    assert.strictEqual((await make({}).loadImages()).error, "slideshow.photosNone");
    answer = { ok: true, status: 200, body: { items: [], albumFound: false } };
    assert.strictEqual((await make({ photosSource: "album", photosAlbum: "X" }).loadImages()).error, "slideshow.photosNoAlbum");
    answer = { ok: false, status: 400, body: { error: "invalid library" } };
    assert.strictEqual((await make({}).loadImages()).error, "invalid library");
    console.log("  OK");
  }

  console.log("== Diaporama Photos : message de liste vide et revérification ==");
  {
    const w = make({});
    w.renderMessage("photos", null);
    assert.ok(window.document.getElementById("tile").textContent.includes("slideshow.emptyPhotos"));
    w.armRefresh("photos");
    assert.ok(w.refreshTimer, "la source est revérifiée périodiquement");
    clearInterval(w.refreshTimer);
    console.log("  OK");
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
