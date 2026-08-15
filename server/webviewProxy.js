/* ============================================================
   PiBoard - server/webviewProxy.js
   Proxy pour la tuile "Page web" (public/widgets/webview) : recupere
   une page cote serveur et la reexpedie telle quelle au navigateur,
   plutot que de la charger directement en <iframe src="URL d'origine">.

   Pourquoi : la grande majorite des sites -- les sites municipaux
   francais tout particulierement, souvent par conformite RGS/ANSSI --
   envoient un en-tete X-Frame-Options ou une CSP "frame-ancestors" qui
   interdit explicitement leur affichage dans une iframe. Chromium
   n'affiche alors RIEN et ne remonte aucune erreur visible a
   l'utilisateur -- une page blanche silencieuse, exactement le
   symptome signale. C'est un choix de securite deliberement du cote du
   site (anti-clickjacking), pas un bug PiBoard, mais il rend le widget
   totalement inutilisable pour ces sites sans ce detour.

   Le detour : PiBoard recupere le HTML lui-meme, cote serveur (une
   requete HTTP normale n'est PAS soumise a X-Frame-Options -- cet
   en-tete ne s'applique qu'au chargement d'un DOCUMENT dans une frame,
   pas a une requete HTTP quelconque), puis le sert depuis SA PROPRE
   origine, sans jamais transmettre l'en-tete X-Frame-Options/CSP de la
   source. L'iframe du widget pointe alors vers ce proxy plutot que vers
   le site d'origine : du point de vue du navigateur, il n'y a plus de
   document tiers a bloquer, juste du contenu servi par PiBoard.

   Limite assumee, documentee ici plutot que cachee : ceci REEXPEDIE le
   HTML tel quel (avec une balise <base> injectee pour que les images/
   CSS/scripts continuent de se charger depuis le vrai site), mais ne
   REECRIT PAS les appels reseau que le JavaScript de la page pourrait
   faire vers sa propre origine (fetch/XHR relatifs) -- ceux-la
   cibleraient a tort PiBoard plutot que le site d'origine. Convient tres
   bien a l'immense majorite des sites vitrines/institutionnels
   (contenu essentiellement statique cote serveur) ; un site tres
   fortement interactif (application web complete) peut afficher son
   apparence mais perdre certaines fonctionnalites dynamiques.

   Why: the vast majority of sites -- French municipal sites in
   particular, often for RGS/ANSSI compliance -- send an
   X-Frame-Options header or a "frame-ancestors" CSP that explicitly
   forbids embedding them in an iframe. Chromium then displays NOTHING
   and surfaces no visible error to the user -- a silent blank page,
   exactly the reported symptom. This is a deliberate security choice
   on the site's side (anti-clickjacking), not a PiBoard bug, but it
   makes the widget entirely unusable for those sites without this
   workaround.

   The workaround: PiBoard fetches the HTML itself, server-side (a
   plain HTTP request is NOT subject to X-Frame-Options -- that header
   only applies to loading a DOCUMENT inside a frame, not to an
   arbitrary HTTP request), then serves it from ITS OWN origin, never
   forwarding the source's X-Frame-Options/CSP header. The widget's
   iframe then points at this proxy rather than the original site: from
   the browser's point of view, there's no longer a third-party
   document to block, just content served by PiBoard.

   Accepted limitation, documented here rather than hidden: this
   RELAYS the HTML as-is (with a <base> tag injected so images/CSS/
   scripts keep loading from the real site), but does NOT REWRITE
   network calls the page's own JavaScript might make back to its own
   origin (relative fetch/XHR) -- those would wrongly target PiBoard
   instead of the source site. Works very well for the vast majority of
   showcase/institutional sites (essentially server-rendered static
   content); a very heavily interactive site (a full web application)
   may display its look but lose some dynamic functionality.
   ============================================================ */
"use strict";

const { USER_AGENTS, BROWSER_HEADERS } = require("./articleExtract");

const FETCH_TIMEOUT_MS = 12000;
// Une page complete (avec son HTML de mise en page) peut legitimement
// peser plus lourd qu'un article seul -- plafond releve par rapport a
// articleExtract.js, mais borne tout de meme, pour un Raspberry Pi.
// A full page (with its layout HTML) can legitimately weigh more than
// a lone article -- ceiling raised compared to articleExtract.js, but
// still bounded, for a Raspberry Pi's sake.
const MAX_HTML_CHARS = 6 * 1024 * 1024; // ~6 Mo / ~6 MB

/* Meme strategie a deux temps que articleExtract.js (voir son
   commentaire pour le detail et le pourquoi) : un identifiant honnete
   d'abord, un user-agent de navigateur standard en repli si bloque.
   Same two-step strategy as articleExtract.js (see its comment for
   detail and rationale): an honest identifier first, a standard
   browser user-agent as a fallback if blocked. */
async function fetchPage(url) {
  let lastError = null;
  for (let i = 0; i < USER_AGENTS.length; i++) {
    const isFallback = i > 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const headers = isFallback
        ? Object.assign({ "User-Agent": USER_AGENTS[i] }, BROWSER_HEADERS)
        : { "User-Agent": USER_AGENTS[i], "Accept": "text/html,application/xhtml+xml" };
      const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers });
      clearTimeout(timer);
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.includes("html")) {
        lastError = { status: res.status, type };
        continue; // tente le repli / try the fallback
      }
      let html = await res.text();
      if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);
      return { ok: true, html, finalUrl: res.url || url };
    } catch (e) {
      clearTimeout(timer);
      lastError = { error: String(e.message || e) };
    }
  }
  return { ok: false, error: lastError };
}

/* Injecte <base href="..."> juste apres l'ouverture de <head> (ou en
   tout debut de document si <head> est absent/mal forme) : les URL
   relatives de la page (images, CSS, scripts, liens) continuent ainsi
   de se resoudre vers le VRAI site plutot que vers PiBoard. Seule la
   PREMIERE balise <base> d'un document fait foi (regle HTML standard),
   donc inutile de chercher/retirer un <base> deja present dans la page
   -- la notre, placee en tete, l'emporte naturellement.

   Retire aussi toute CSP posee via <meta http-equiv> : une politique
   comme "script-src 'self'" ecrite par le site d'origine designerait
   par erreur PiBoard une fois la page servie depuis son origine a lui,
   bloquant des scripts pourtant legitimes du site d'origine. (Une CSP
   "frame-ancestors" posee via <meta>, elle, n'a de toute facon aucun
   effet -- seule la variante par en-tete HTTP compte, jamais transmise
   ici : rien de plus a faire de ce cote.)

   Injects <base href="..."> right after <head> opens (or at the very
   start of the document if <head> is missing/malformed): the page's
   relative URLs (images, CSS, scripts, links) then keep resolving
   against the REAL site rather than PiBoard. Only the FIRST <base> tag
   in a document counts (standard HTML rule), so no need to
   find/remove any <base> already present in the page -- ours, placed
   first, naturally wins.

   Also strips any CSP set via <meta http-equiv>: a policy like
   "script-src 'self'" written by the source site would wrongly refer
   to PiBoard once the page is served from its own origin, blocking
   otherwise-legitimate scripts from the source site. (A
   "frame-ancestors" CSP set via <meta> has no effect anyway -- only
   the HTTP header variant counts, never forwarded here: nothing more
   to do on that front.) */
function rewriteHtml(html, baseUrl) {
  let out = html.replace(
    /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,
    ""
  );
  const baseTag = `<base href="${baseUrl.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => m + baseTag);
  } else {
    out = baseTag + out;
  }
  return out;
}

/* Normalise une adresse saisie sans schema explicite (ex. "mon-site.fr"
   ou "www.mon-site.fr" tape dans le champ de reglage, par reflexe de
   barre d'adresse de navigateur -- laquelle complete automatiquement
   "https://", contrairement a new URL() qui exige une URL absolue et
   echoue sinon avec "invalid url"). Ajoute "https://" par defaut
   lorsque l'entree ne commence pas deja par un schema http(s)
   reconnu. Fonction PURE, testee isolement.
   Normalizes an address typed without an explicit scheme (e.g.
   "my-site.example" or "www.my-site.example" typed into the setting
   field, out of browser-address-bar habit -- which auto-completes
   "https://", unlike new URL() which requires an absolute URL and
   otherwise fails with "invalid url"). Adds "https://" by default when
   the input doesn't already start with a recognized http(s) scheme.
   PURE function, tested in isolation. */
function normalizeUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;
  // Detecte un schema DEJA present, quel qu'il soit (http, https, ftp,
  // ws...) -- pas seulement http(s) -- et le laisse alors intact : un
  // schema differe (ex. "ftp://...") doit rester tel quel pour etre
  // rejete par la verification "http(s) uniquement" qui suit dans
  // proxyPage(), jamais reinterprete en le prefixant de force de
  // "https://" (ce qui le mangleraita en une URL https bancale plutot
  // que de le rejeter correctement).
  // Detects a scheme ALREADY present, whatever it is (http, https,
  // ftp, ws...) -- not just http(s) -- and then leaves it untouched: a
  // different scheme (e.g. "ftp://...") must stay as-is so it gets
  // correctly rejected by the "http(s) only" check that follows in
  // proxyPage(), never reinterpreted by force-prefixing it with
  // "https://" (which would mangle it into a broken https URL instead
  // of correctly rejecting it).
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
}

async function proxyPage(url) {
  let parsed;
  try {
    parsed = new URL(normalizeUrl(url));
  } catch (e) {
    return { ok: false, status: 400, error: "invalid url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, status: 400, error: "only http(s) urls are allowed" };
  }

  const result = await fetchPage(parsed.href);
  if (!result.ok) {
    return { ok: false, status: 502, error: result.error };
  }
  const html = rewriteHtml(result.html, result.finalUrl);
  return { ok: true, html };
}

/* Petite page HTML lisible affichee DANS L'IFRAME du widget en cas
   d'echec -- plutot qu'une reponse JSON brute (illisible dans une
   iframe) ou, pire, un echec silencieux qui ressemblerait a une
   nouvelle page blanche. Volontairement minimaliste (pas de dependance
   au theme de PiBoard : ce fragment vit dans une iframe isolee par son
   sandbox, sans acces aux feuilles de style du tableau).
   Small readable HTML page shown INSIDE the widget's iframe on
   failure -- rather than a raw JSON response (unreadable in an
   iframe) or, worse, a silent failure that would look like yet
   another blank page. Deliberately minimal (no dependency on
   PiBoard's theme: this fragment lives in an iframe isolated by its
   sandbox, without access to the board's stylesheets). */
function errorPageHtml(error) {
  const detail = typeof error === "object" && error !== null
    ? (error.error || (error.status ? "HTTP " + error.status : JSON.stringify(error)))
    : String(error || "");
  const safeDetail = String(detail).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
           font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #1a1a1f; color: #cfd2da; }
    .box { text-align: center; padding: 24px; max-width: 90%; }
    .box b { display: block; font-size: 15px; margin-bottom: 6px; color: #fff; }
    .box small { display: block; font-size: 12px; color: #8b8f9a; word-break: break-word; }
  </style></head><body>
    <div class="box"><b>Page indisponible</b><small>${safeDetail}</small></div>
  </body></html>`;
}

module.exports = { proxyPage, errorPageHtml, rewriteHtml, fetchPage, normalizeUrl };
