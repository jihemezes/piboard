/* Tuile Flux RSS : couleur d'etiquette par flux (1.169.0). Le widget est
   instancie seul, fetch est simule. On verifie la couleur automatique par
   emplacement, le choix explicite, le texte lisible, le litere, l'en-tete
   du flux unique et la pastille de la fenetre de lecture.
   RSS tile: per-feed tag colour. Widget instantiated alone, fetch faked. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id=\"tile\"></div></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.DOMParser = window.DOMParser;
let Rss = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "rss") Rss = cls; } };
global.PiBoard = window.PiBoard;
window.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "rss", "widget.js"), "utf8"));
assert.ok(Rss);

const feedXml = (title, n, day) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>` +
  `<item><title>Titre ${n}</title><link>https://x.test/${n}</link><pubDate>Mon, ${day} Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
const FEEDS = { "http://a.test/rss": feedXml("Flux A complet", "A", "02"), "http://b.test/rss": feedXml("Flux B complet", "B", "03"), "http://c.test/rss": feedXml("Flux C complet", "C", "04") };
global.fetch = window.fetch = (url) => {
  const u = String(url);
  if (u.startsWith("/api/press")) return Promise.resolve({ ok: false });
  const key = Object.keys(FEEDS).find((k) => u.includes(encodeURIComponent(k)) || u.includes(k));
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(FEEDS[key] || ""), json: () => Promise.resolve({}) });
};

function make(settings) {
  const el = window.document.createElement("div");
  window.document.body.appendChild(el);
  return new Rss({
    el, settings: Object.assign({ maxItems: 6 }, settings), instanceId: "t-rss",
    i18n: { t: (k) => k, lang: "fr" },
    api: { proxyUrl: (u) => "/proxy?u=" + encodeURIComponent(u) }
  });
}
const tags = (w) => Array.from(w.ctx.el.querySelectorAll(".pwr-tag")).map((t) => ({ text: t.textContent, style: t.getAttribute("style") || "" }));

(async () => {
  console.log("== Flux RSS : couleur automatique par emplacement ==");
  {
    const w = make({ url: "http://a.test/rss", label1: "A", url2: "http://b.test/rss", label2: "B", url3: "http://c.test/rss", label3: "C" });
    await w.refresh();
    const t = tags(w);
    assert.strictEqual(t.length, 3);
    const byText = Object.fromEntries(t.map((x) => [x.text, x.style]));
    assert.ok(/--pwr-tag:#3b82f6/.test(byText.A), "flux 1 : bleu");
    assert.ok(/--pwr-tag:#f97316/.test(byText.B), "flux 2 : orange");
    assert.ok(/--pwr-tag:#22c55e/.test(byText.C), "flux 3 : vert");
    assert.ok(/--pwr-tag-ink:#ffffff/.test(byText.A), "encre claire sur le bleu");
    assert.ok(/--pwr-tag-ink:#111827/.test(byText.C), "encre foncee sur le vert clair");
    assert.strictEqual(w.ctx.el.querySelectorAll(".pwr-item.pwr-barred").length, 3, "litere present");
    console.log("  OK");
  }

  console.log("== Flux RSS : couleur choisie, stable quand un flux est retire ==");
  {
    const w = make({ url: "http://a.test/rss", label1: "A", color1: "#EAB308", url3: "http://c.test/rss", label3: "C" });
    await w.refresh();
    const byText = Object.fromEntries(tags(w).map((x) => [x.text, x.style]));
    assert.ok(/--pwr-tag:#eab308/.test(byText.A), "couleur choisie (casse normalisee)");
    assert.ok(/--pwr-tag-ink:#111827/.test(byText.A), "encre foncee sur le jaune");
    assert.ok(/--pwr-tag:#22c55e/.test(byText.C), "le flux 3 garde SA teinte meme sans flux 2");
    const bad = make({ url: "http://a.test/rss", label1: "A", color1: "red; background:url(x)", url2: "http://b.test/rss", label2: "B" });
    await bad.refresh();
    assert.ok(!/url\(x\)|red;/.test(bad.ctx.el.innerHTML), "une valeur non hexadecimale est ignoree (pas d'injection de style)");
    console.log("  OK");
  }

  console.log("== Flux RSS : un seul flux ==");
  {
    const plain = make({ url: "http://a.test/rss", label1: "A" });
    await plain.refresh();
    assert.ok(!plain.ctx.el.querySelector(".pwr-source-coloured"), "sans choix, l'en-tete historique est inchange");
    assert.strictEqual(plain.ctx.el.querySelectorAll(".pwr-barred").length, 0, "pas de litere sans choix");
    const colored = make({ url: "http://a.test/rss", label1: "A", color1: "#8b5cf6" });
    await colored.refresh();
    const head = colored.ctx.el.querySelector(".pwr-source-coloured");
    assert.ok(head && /--pwr-tag:#8b5cf6/.test(head.getAttribute("style")), "couleur choisie : l'en-tete la prend");
    assert.strictEqual(colored.ctx.el.querySelectorAll(".pwr-barred").length, 1, "et le litere aussi");
    const nobar = make({ url: "http://a.test/rss", label1: "A", color1: "#8b5cf6", showColorBar: false });
    await nobar.refresh();
    assert.strictEqual(nobar.ctx.el.querySelectorAll(".pwr-barred").length, 0, "litere desactivable");
    console.log("  OK");
  }

  console.log("== Flux RSS : fenetre de lecture ==");
  {
    const w = make({ url: "http://a.test/rss", label1: "A", url2: "http://b.test/rss", label2: "B" });
    await w.refresh();
    const meta = window.document.createElement("div");
    w.setModalMeta(meta, w.feed.items[0], "", "3 nov.");
    const pill = meta.querySelector(".pwr-tag");
    assert.ok(pill && /--pwr-tag:/.test(pill.getAttribute("style")), "la source est une pastille coloree");
    assert.ok(/3 nov\./.test(meta.textContent));
    const hidden = make({ url: "http://a.test/rss", label1: "A", url2: "http://b.test/rss", label2: "B", showSource: false });
    await hidden.refresh();
    const m2 = window.document.createElement("div");
    hidden.setModalMeta(m2, hidden.feed.items[0], "", "3 nov.");
    assert.ok(!m2.querySelector(".pwr-tag"), "source masquee : pas de pastille");
    console.log("  OK");
  }
})().catch((e) => { console.error(e); process.exit(1); });
