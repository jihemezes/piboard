/* Tuile Flux RSS : liste de flux (jusqu'a 12), reprise des anciens
   reglages, flux decoches, mots a garder / masquer, quota par flux,
   doublons, groupes et avertissement de flux en panne (1.171.0).
   Widget instancie seul, fetch simule.
   RSS tile: feed list (up to 12), carry-over of old settings, unticked
   feeds, words to keep / hide, per-feed quota, duplicates, groups and
   failing-feed warning. Widget instantiated alone, fetch faked. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.DOMParser = window.DOMParser;
let Rss = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "rss") Rss = cls; } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "rss", "widget.js"), "utf8"));
assert.ok(Rss);

const rssItem = (title, link, day, hour) => `<item><title>${title}</title><link>${link}</link><pubDate>Mon, ${day} Nov 2026 ${hour || "10"}:00:00 GMT</pubDate><description>${title} corps</description></item>`;
const rss = (title, items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>${items.join("")}</channel></rss>`;
const FEEDS = {};
const DOWN = new Set();
global.fetch = window.fetch = (url) => {
  const u = decodeURIComponent(String(url));
  if (u.startsWith("/api/press")) return Promise.resolve({ ok: false });
  const key = Object.keys(FEEDS).find((k) => u.includes(k + "?") || u.endsWith(k) || u.includes(k + "&"));
  if (!key || DOWN.has(key)) return Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve("") });
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(FEEDS[key]), json: () => Promise.resolve({}) });
};

let n = 0;
function make(settings) {
  const el = window.document.createElement("div");
  window.document.body.appendChild(el);
  return new Rss({
    el, settings: Object.assign({ maxItems: 20 }, settings), instanceId: "t-rss" + (++n),
    i18n: { t: (k) => k, lang: "fr" },
    api: { proxyUrl: (u) => "/proxy?u=" + encodeURIComponent(u) }
  });
}
const titles = (w) => Array.from(w.ctx.el.querySelectorAll(".pwr-title")).map((t) => {
  const c = t.cloneNode(true);
  c.querySelectorAll(".pwr-tag, .pwr-badge").forEach((x) => x.remove());
  return c.textContent.trim();
});
const feeds = (list) => JSON.stringify(list);

(async () => {
  console.log("== Douze flux ==");
  {
    const list = [];
    for (let i = 0; i < 14; i++) {
      const url = `http://f${i}.test/rss`;
      FEEDS[url] = rss("Flux " + i, [rssItem("Titre " + i, "https://x.test/a" + i, String(1 + (i % 28)))]);
      list.push({ url, label: "F" + i, n: i, on: true });
    }
    const w = make({ feeds: feeds(list) });
    assert.strictEqual(w.feedSlots().length, 12, "limite a 12 flux meme si 14 sont enregistres");
    await w.refresh();
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 12, "douze articles, un par flux");
    const tagColors = new Set(Array.from(w.ctx.el.querySelectorAll(".pwr-tag")).map((t) => (t.getAttribute("style").match(/--pwr-tag:(#[0-9a-f]{6})/) || [])[1]));
    assert.strictEqual(tagColors.size, 12, "douze teintes automatiques distinctes");
    console.log("  OK");
  }

  console.log("== Reprise des anciens reglages (trois emplacements) ==");
  {
    FEEDS["http://a.test/rss"] = rss("A", [rssItem("Titre A", "https://x.test/A", "02")]);
    FEEDS["http://b.test/rss"] = rss("B", [rssItem("Titre B", "https://x.test/B", "03")]);
    const old = make({ url: "http://a.test/rss", label1: "A", url2: "http://b.test/rss", label2: "B", feeds: "" });
    assert.strictEqual(old.feedSlots().length, 2);
    assert.deepStrictEqual(old.feedSlots().map((f) => f.idx), [0, 1], "teintes d'origine conservees");
    const saved = make({ url: "http://a.test/rss", label1: "A", feeds: feeds([{ url: "http://b.test/rss", label: "B", on: true }]) });
    assert.deepStrictEqual(saved.feedSlots().map((f) => f.url), ["http://b.test/rss"], "la liste enregistree l'emporte sur les anciens champs");
    const emptied = make({ url: "http://a.test/rss", feeds: "[]" });
    assert.strictEqual(emptied.feedSlots().length, 0, "liste videe volontairement : aucun flux, pas de retour a l'ancien");
    console.log("  OK");
  }

  console.log("== Flux decoche, adresse invalide ==");
  {
    const w = make({ feeds: feeds([
      { url: "http://a.test/rss", label: "A", on: true },
      { url: "http://b.test/rss", label: "B", on: false },
      { url: "ftp://c.test/rss", label: "C", on: true },
      { url: "", label: "D", on: true }
    ]) });
    assert.deepStrictEqual(w.feedSlots().map((f) => f.label), ["A"]);
    console.log("  OK");
  }

  console.log("== Mots a garder / masquer, quota, doublons ==");
  {
    FEEDS["http://foot.test/rss"] = rss("Foot", [
      rssItem("Foot : le PSG gagne", "https://f.test/1", "05", "12"),
      rssItem("Rugby : le XV de France", "https://f.test/2", "05", "11"),
      rssItem("Foot : mercato spoiler", "https://f.test/3", "05", "10"),
      rssItem("Foot : encore un match", "https://f.test/4", "04")
    ]);
    FEEDS["http://tech.test/rss"] = rss("Tech", [
      rssItem("Tech : un nouveau processeur", "https://t.test/1", "05", "09"),
      rssItem("Doublon : même histoire racontée deux fois", "https://same.test/story?utm=a", "05", "08")
    ]);
    FEEDS["http://gen.test/rss"] = rss("Gen", [
      rssItem("Doublon : même histoire racontée deux fois", "https://www.same.test/story/?utm=b", "05", "07"),
      rssItem("Rugby : Éléphants à la fête", "https://g.test/1", "05", "06")
    ]);
    const base = [
      { url: "http://foot.test/rss", label: "Foot", on: true },
      { url: "http://tech.test/rss", label: "Tech", on: true },
      { url: "http://gen.test/rss", label: "Gen", on: true }
    ];
    let w = make({ feeds: feeds(base) });
    await w.refresh();
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 7, "7 articles : 8 moins 1 doublon");
    assert.strictEqual(titles(w).filter((t) => t.startsWith("Doublon")).length, 1, "doublon retire (meme lien sans parametres)");

    w = make({ feeds: feeds(base), dedupe: false });
    await w.refresh();
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 8, "doublons gardes si l'option est decochee");

    w = make({ feeds: feeds(base), perFeedMax: 2, dedupe: false });
    await w.refresh();
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 6, "quota : 2 articles par flux");
    assert.ok(!titles(w).some((t) => /encore un match/.test(t)), "le plus ancien du flux bavard est ecarte");

    w = make({ feeds: feeds(base), hideWords: "spoiler, tennis" });
    await w.refresh();
    assert.ok(!titles(w).some((t) => /spoiler/.test(t)), "mot masque pour toute la tuile");

    w = make({ feeds: feeds(base), keepWords: "RUGBY" });
    await w.refresh();
    assert.deepStrictEqual(titles(w).every((t) => /Rugby/.test(t)), true, "mot a garder, sans tenir compte de la casse");
    assert.strictEqual(titles(w).length, 2);

    w = make({ feeds: feeds(base), keepWords: "rugby" });
    await w.refresh();
    assert.ok(titles(w).some((t) => /Éléphants/.test(t)), "les accents sont ignores (elephants / Éléphants)");
    w = make({ feeds: feeds(base), keepWords: "elephants" });
    await w.refresh();
    assert.strictEqual(titles(w).length, 1, "recherche sans accent");

    const own = base.slice(); own[0] = Object.assign({}, own[0], { keep: "rugby" });
    w = make({ feeds: feeds(own) });
    await w.refresh();
    assert.strictEqual(titles(w).filter((t) => /^Foot/.test(t)).length, 0, "mots propres au flux : seuls les articles rugby du flux Foot restent");
    assert.ok(titles(w).some((t) => /XV de France/.test(t)));
    assert.ok(titles(w).some((t) => /Tech : un nouveau/.test(t)), "les autres flux ne sont pas filtres");

    const hidden = base.slice(); hidden[0] = Object.assign({}, hidden[0], { hide: "mercato" });
    w = make({ feeds: feeds(hidden) });
    await w.refresh();
    assert.ok(!titles(w).some((t) => /mercato/.test(t)));
    console.log("  OK");
  }

  console.log("== Groupes de flux ==");
  {
    const g = [
      { url: "http://foot.test/rss", label: "Foot", on: true, group: "Sport" },
      { url: "http://tech.test/rss", label: "Tech", on: true, group: "Tech" },
      { url: "http://gen.test/rss", label: "Gen", on: true }
    ];
    let w = make({ feeds: feeds(g), groupView: "all" });
    await w.refresh();
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-group-chip").length, 0, "pas de selecteur en mode « tout ensemble »");

    w = make({ feeds: feeds(g), groupView: "tabs", dedupe: false });
    await w.init();
    const chips = () => Array.from(w.ctx.el.querySelectorAll(".pwr-group-chip")).map((c) => c.textContent);
    assert.deepStrictEqual(chips(), ["rss.group.all", "Sport", "Tech", "rss.group.other"]);
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 8, "tout par defaut");
    w.ctx.el.querySelectorAll(".pwr-group-chip")[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 2, "le groupe Tech : 2 articles");
    assert.ok(w.ctx.el.querySelector(".pwr-group-chip.active").textContent === "Tech");
    w.ctx.el.querySelectorAll(".pwr-group-chip")[3].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 2, "les flux sans groupe : « Autres »");
    w.ctx.el.querySelectorAll(".pwr-group-chip")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item").length, 8, "« Tous » remet tout");
    w.destroy();

    w = make({ feeds: feeds(g), groupView: "rotate", groupSeconds: 5, dedupe: false });
    await w.refresh();
    assert.strictEqual(w.groupSel, "Sport", "la rotation commence par le premier groupe");
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-group-chip").length, 3, "rotation : pas de pastille « Tous »");
    assert.ok(w.groupTimer, "la minuterie de rotation est armee");
    w.destroy();

    const plain = make({ feeds: feeds([{ url: "http://foot.test/rss", label: "Foot", on: true }]), groupView: "tabs" });
    await plain.refresh();
    assert.strictEqual(plain.ctx.el.querySelectorAll(".pwr-group-chip").length, 0, "aucun groupe nomme : aucun selecteur");
    console.log("  OK");
  }

  console.log("== Flux en panne ==");
  {
    DOWN.add("http://tech.test/rss");
    const l = [
      { url: "http://foot.test/rss", label: "Foot", on: true },
      { url: "http://tech.test/rss", label: "Tech", on: true },
      { url: "http://gen.test/rss", label: "", on: true }
    ];
    let w = make({ feeds: feeds(l) });
    await w.refresh();
    const warn = w.ctx.el.querySelector(".pwr-warn");
    assert.ok(warn && /Tech/.test(warn.textContent), "le flux en panne est nomme");
    assert.ok(w.ctx.el.querySelectorAll(".pwr-item").length > 0, "les autres flux s'affichent");
    w = make({ feeds: feeds(l), warnFailed: false });
    await w.refresh();
    assert.ok(!w.ctx.el.querySelector(".pwr-warn"), "avertissement desactivable");
    DOWN.add("http://foot.test/rss"); DOWN.add("http://gen.test/rss");
    w = make({ feeds: feeds(l) });
    await w.refresh();
    assert.ok(w.ctx.el.querySelector(".pwr-err"), "tous en panne : message d'erreur habituel");
    DOWN.clear();
    console.log("  OK");
  }

  console.log("rssFeeds : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
