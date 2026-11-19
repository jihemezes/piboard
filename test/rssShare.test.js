/* Tuile Flux RSS : partage d'un article et liste « Lire plus tard »
   (1.176.0). Le widget appelle window.PiBoard.share (fenetre commune de
   l'application, testee dans dom-smoke) : on verifie ce qu'il lui passe,
   et comment on y accede (bouton, appui long, clic droit). */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document; global.DOMParser = window.DOMParser;
let Rss = null;
const shared = [];
window.PiBoard = { registerWidget: (id, cls) => { if (id === "rss") Rss = cls; }, share: (d, o) => { shared.push({ d, o }); } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "rss", "widget.js"), "utf8"));
assert.ok(Rss);

const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Le Journal</title>
  <item><title>Premier titre</title><link>https://journal.test/a1</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate><description>Un résumé &lt;b&gt;court&lt;/b&gt; de l'article.</description></item>
  <item><title>Second titre</title><link>https://journal.test/a2</link><pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate><description>Autre</description></item>
</channel></rss>`;
window.fetch = global.fetch = async (u) => String(u).startsWith("/api/") ? { ok: false, json: async () => ({}) } : { ok: true, status: 200, text: async () => xml };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function make(settings) {
  const el = window.document.createElement("div");
  window.document.body.appendChild(el);
  const saved = [];
  const w = new Rss({
    el, settings: Object.assign({ maxItems: 20, feeds: JSON.stringify([{ url: "https://journal.test/rss", label: "Journal", on: true }]) }, settings || {}),
    instanceId: "t-share", i18n: { t: (k) => k, lang: "fr" },
    api: { proxyUrl: (u) => "/proxy?u=" + encodeURIComponent(u) },
    updateSettings: (p) => saved.push(p)
  });
  return { w, el, saved };
}
const ev = (el, type, extra) => el.dispatchEvent(Object.assign(new window.Event(type, { bubbles: true, cancelable: true }), extra || {}));

(async () => {
  console.log("== Texte partage ==");
  let { w, el, saved } = make();
  await w.init();
  let d = w.shareData(w.currentItems[0]);
  assert.deepStrictEqual(d.url, "https://journal.test/a1");
  assert.strictEqual(d.text, "Premier titre\n— Journal\nhttps://journal.test/a1", "titre + source + lien par defaut");
  w.ctx.settings.shareText = "summary";
  d = w.shareData(w.currentItems[0]);
  assert.ok(/Un résumé court de l'article\./.test(d.text) && !/<b>/.test(d.text), "titre + resume (sans balises) + lien");
  w.ctx.settings.shareSource = false;
  assert.ok(!/Journal/.test(w.shareData(w.currentItems[0]).text), "sans le nom de la source");
  console.log("  OK");

  console.log("== Acces au partage ==");
  shared.length = 0;
  const li = el.querySelector(".pwr-item[data-idx='1']");
  const cm = new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 40 });
  li.dispatchEvent(cm);
  assert.ok(cm.defaultPrevented, "clic droit : menu du navigateur et menu de tuile remplaces");
  assert.strictEqual(shared.length, 1);
  assert.strictEqual(shared[0].d.url, "https://journal.test/a2", "clic droit : c'est le bon article");
  assert.ok(shared[0].o.extras.some((x) => x.id === "later"), "« Lire plus tard » propose dans la fenetre");
  // appui long
  ev(li, "pointerdown", { button: 0, clientX: 10, clientY: 10 });
  await sleep(650);
  assert.strictEqual(shared.length, 2, "appui long : partage");
  let opened = 0; w.openArticle = () => { opened++; };
  ev(li, "pointerup"); li.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.strictEqual(opened, 0, "le clic qui suit l'appui long n'ouvre pas l'article");
  // appui bref : pas de partage
  ev(li, "pointerdown", { button: 0, clientX: 10, clientY: 10 });
  await sleep(100);
  ev(li, "pointerup");
  await sleep(600);
  assert.strictEqual(shared.length, 2, "appui bref : pas de partage");
  // bouton de la fenetre de lecture
  w.openArticle = Rss.prototype.openArticle;
  await w.openArticleItem(w.currentItems[0]);
  const btn = window.document.querySelector(".pwr-modal-share");
  assert.ok(btn, "bouton Partager dans la fenetre de lecture");
  btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.strictEqual(shared.length, 3);
  assert.strictEqual(shared[2].d.url, "https://journal.test/a1", "le bouton partage l'article lu");
  console.log("  OK");

  console.log("== Lire plus tard ==");
  shared[2].o.extras.find((x) => x.id === "later").run();
  assert.ok(saved.length && JSON.parse(saved[saved.length - 1].readLater)[0].link === "https://journal.test/a1", "enregistre avec la tuile");
  const chip = el.querySelector(".pwr-rl-chip");
  assert.ok(chip && /rss\.later\.chip/.test(chip.textContent), "pastille « A lire (n) »");
  chip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.strictEqual(el.querySelectorAll(".pwr-rl-item").length, 1, "la liste « A lire » s'affiche");
  w.shareItem(w.readLaterList()[0]);
  assert.ok(/rss\.later\.remove/.test(shared[shared.length - 1].o.extras[0].label), "deja range : propose de le retirer");
  el.querySelector(".pwr-rl-del").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.strictEqual(w.readLaterList().length, 0, "✕ retire l'article");
  assert.ok(!el.querySelector(".pwr-rl-chip") && el.querySelectorAll(".pwr-item[data-idx]").length === 2, "liste vide : retour aux flux, pastille masquee");
  for (let k = 0; k < 55; k++) w.addReadLater({ title: "T" + k, link: "https://x.test/" + k });
  assert.strictEqual(w.readLaterList().length, 50, "50 articles au plus");
  w.destroy();
  console.log("  OK");

  console.log("rssShare : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
