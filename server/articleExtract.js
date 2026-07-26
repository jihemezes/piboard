/* ============================================================
   PiBoard - server/articleExtract.js
   Extrait le texte lisible d'un article a partir de sa page web (mode
   "lecture", comme le lecteur integre de Firefox/Safari), pour le
   widget RSS : le flux ne fournit souvent qu'un court resume
   (<description>), pas le texte complet. Utilise Mozilla Readability --
   la meme bibliotheque que le mode lecture de Firefox -- pour isoler le
   contenu de l'article et ecarter navigation, publicites, colonnes
   laterales, etc.

   Usage strictement a la demande (un appel par clic utilisateur sur un
   article, jamais de recuperation en masse ni de mise en cache
   persistante) : equivalent fonctionnel du mode lecture d'un navigateur,
   pour la consultation personnelle d'un lien que l'utilisateur a
   choisi -- pas une republication. Si la page est proche d'un
   paywall/anti-robot, l'extraction echoue proprement et le widget se
   rabat sur le resume du flux.

   Extracts an article's readable text from its web page ("reader mode",
   like Firefox/Safari's built-in reader), for the RSS widget: feeds
   often only provide a short summary (<description>), not the full
   text. Uses Mozilla Readability -- the same library behind Firefox's
   reader mode -- to isolate the article content and discard navigation,
   ads, sidebars, etc.

   Strictly on-demand usage (one call per user click on an article,
   never bulk fetching or persistent caching): the functional equivalent
   of a browser's reader mode, for personal reading of a link the user
   chose -- not republishing. If the page is paywalled/bot-blocked,
   extraction fails cleanly and the widget falls back to the feed's own
   summary.
   ============================================================ */
"use strict";

const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

const FETCH_TIMEOUT_MS = 10000;
// Plafond de securite sur la taille de la page recuperee : evite qu'une
// page demesuree (ou un flux infini) ne consomme trop de memoire sur un
// Raspberry Pi. Safety cap on the fetched page size: prevents an
// oversized page (or an infinite stream) from using too much memory on
// a Raspberry Pi.
const MAX_HTML_CHARS = 3 * 1024 * 1024; // ~3 Mo de HTML / ~3 MB of HTML
// En dessous de ce nombre de caracteres de texte utile, on considere
// l'extraction trop pauvre pour valoir la peine (souvent un paywall qui
// ne laisse voir que l'amorce, deja presente dans la description du
// flux) -- le widget se rabat alors sur le resume du flux.
// Below this amount of useful text, the extraction is considered too
// thin to be worth it (often a paywall only showing the teaser, already
// present in the feed's own description) -- the widget then falls back
// to the feed's summary.
const MIN_TEXT_LENGTH = 200;

async function extractArticle(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error("invalid url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("unsupported protocol");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Un identifiant honnete plutot qu'une usurpation de navigateur :
        // ce mode lecture se comporte comme n'importe quel lecteur RSS,
        // pas comme un robot d'indexation. A courteous, honest identifier
        // rather than impersonating a browser: this reader mode behaves
        // like any RSS reader, not like an indexing bot.
        "User-Agent": "Mozilla/5.0 (compatible; PiBoard-ReaderMode/1.0; +https://github.com/jihemezes/piboard)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    if (!res.ok) throw new Error("upstream status " + res.status);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);

  const dom = new JSDOM(html, { url });
  let article;
  try {
    article = new Readability(dom.window.document).parse();
  } finally {
    dom.window.close(); // libere la memoire jsdom sans attendre le GC / frees jsdom memory without waiting on GC
  }

  if (!article || !article.textContent || article.textContent.trim().length < MIN_TEXT_LENGTH) {
    throw new Error("no readable content");
  }

  return {
    title: article.title || null,
    byline: article.byline || null,
    siteName: article.siteName || null,
    excerpt: article.excerpt || null,
    content: article.content || null // HTML deja nettoye par Readability / HTML already cleaned up by Readability
  };
}

module.exports = { extractArticle };
