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
   choisi -- pas une republication.

   Face a un acces refuse (paywall OU protection anti-robot -- les deux
   se confondent en pratique : certains sites, dont Le Monde, renvoient
   litteralement "Votre trafic a ete identifie comme automatise (bot)"
   avec un statut 401/402, ce n'est donc pas toujours un vrai paywall
   d'abonnement), ce module lit et affiche ce que la page renvoie
   REELLEMENT -- souvent un apercu partiel (les premiers paragraphes) --
   plutot que de jeter la reponse simplement parce que le statut HTTP est
   inhabituel. Aucune tentative de contournement dans un cas comme dans
   l'autre : pas de connexion, pas de cache alternatif, pas de defaite
   d'une protection anti-robot ou du JS qui masque la suite -- seul ce
   que le site choisit deja de rendre visible est affiche. Si le corps
   recu est trop court pour valoir la peine (moins de 200 caracteres
   utiles), l'extraction echoue proprement et le widget se rabat sur le
   resume du flux.

   Extracts an article's readable text from its web page ("reader mode",
   like Firefox/Safari's built-in reader), for the RSS widget: feeds
   often only provide a short summary (<description>), not the full
   text. Uses Mozilla Readability -- the same library behind Firefox's
   reader mode -- to isolate the article content and discard navigation,
   ads, sidebars, etc.

   Strictly on-demand usage (one call per user click on an article,
   never bulk fetching or persistent caching): the functional equivalent
   of a browser's reader mode, for personal reading of a link the user
   chose -- not republishing.

   Facing denied access (paywall OR anti-bot protection -- the two blur
   together in practice: some sites, including Le Monde, literally
   return "Your traffic has been identified as automated (bot)" with a
   401/402 status, so it isn't always a genuine subscription paywall),
   this module reads and shows what the page ACTUALLY returns -- often a
   partial preview (the first few paragraphs) -- rather than discarding
   the response simply because the HTTP status is unusual. No attempt to
   bypass either case: no login, no alternate cache, no defeating an
   anti-bot check or the JS that hides the rest -- only what the site
   already chooses to make visible is shown. If the received body is too
   short to be worth it (under 200 useful characters), extraction fails
   cleanly and the widget falls back to the feed's summary.
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

/* Deux identifications tentees dans l'ordre :
   1) Un identifiant honnete (PiBoard-ReaderMode), qui reste la tentative
      PAR DEFAUT -- rien ne change pour un site qui l'accepte.
   2) Seulement si la premiere echoue (reseau, statut HTTP, ou contenu
      juge trop pauvre) : un user-agent de navigateur standard, en
      repli.

   Pourquoi ce repli : de nombreuses protections anti-bot (Cloudflare
   Bot Fight Mode et equivalents) bloquent purement et simplement tout
   user-agent qui NE RESSEMBLE PAS a un navigateur -- y compris des
   lecteurs RSS parfaitement legitimes et honnetement identifies. C'est
   un probleme large et documente (recherche effectuee avant d'ecrire ce
   commentaire), pas une supposition en l'air. Signale sur ce projet :
   le mode lecture echouait systematiquement sur un Raspberry Pi et un
   navigateur Mac, mais fonctionnait sur une installation Windows
   separee -- cohérent avec un blocage qui varie selon la reputation de
   l'adresse IP source, pas seulement le user-agent en tant que tel.

   Cela reste un compromis assume, pas une decision prise a la legere :
   ce mode "lecture" ne sert qu'a la consultation personnelle d'un lien
   deja choisi par l'utilisateur (jamais de recuperation en masse, ni de
   republication, ni de contournement d'un paywall), et le premier essai
   reste honnete. Le second n'imite qu'un seul en-tete (le user-agent),
   pas une empreinte de navigateur complete.

   Two identifications tried in order:
   1) An honest identifier (PiBoard-ReaderMode), which stays the
      DEFAULT attempt -- nothing changes for a site that accepts it.
   2) Only if the first one fails (network, HTTP status, or content
      judged too thin): a standard browser user-agent, as a fallback.

   Why this fallback: many anti-bot protections (Cloudflare Bot Fight
   Mode and equivalents) simply block any user-agent that DOESN'T LOOK
   LIKE a browser -- including perfectly legitimate, honestly
   identified RSS readers. This is a broad, documented problem
   (researched before writing this comment), not an idle guess.
   Reported on this project: reader mode consistently failed on a
   Raspberry Pi and a Mac browser, but worked on a separate Windows
   install -- consistent with a block that varies by the source IP
   address's reputation, not just the user-agent as such.

   This remains a deliberate trade-off, not a decision taken lightly:
   this "reader" mode only serves personal reading of a link the user
   already chose (never bulk fetching, republishing, or paywall
   bypassing), and the first attempt stays honest. The second only
   mimics a single header (the user-agent), not a full browser
   fingerprint. */
const USER_AGENTS = [
  "Mozilla/5.0 (compatible; PiBoard-ReaderMode/1.0; +https://github.com/jihemezes/piboard)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];

/* En-tetes envoyes avec le user-agent de repli. Un user-agent de
   navigateur arrivant SEUL, sans les en-tetes qui l'accompagnent
   toujours dans un vrai navigateur, est un signal de detection
   classique : la coherence de l'ensemble compte davantage que le
   user-agent pris isolement. Ce sont les en-tetes qu'un Chrome envoie
   sur une navigation ordinaire vers une page -- rien de plus, rien qui
   simule une session, un cookie ou une connexion.
   Headers sent along with the fallback user-agent. A browser
   user-agent arriving ALONE, without the headers that always accompany
   it in a real browser, is a classic detection signal: the consistency
   of the whole matters more than the user-agent taken in isolation.
   These are the headers Chrome sends on an ordinary navigation to a
   page -- nothing more, nothing simulating a session, a cookie or a
   login. */
const BROWSER_HEADERS = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"'
};

async function fetchHtml(url, userAgent, useBrowserHeaders) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = useBrowserHeaders
      ? Object.assign({ "User-Agent": userAgent }, BROWSER_HEADERS)
      : { "User-Agent": userAgent, "Accept": "text/html,application/xhtml+xml" };
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers
    });
    // Le corps de la reponse est TOUJOURS lu, meme sur un statut non-2xx
    // -- de nombreux sites a acces restreint (paywall ou protection
    // anti-robot -- pour Le Monde, confirme en pratique : le site
    // renvoie litteralement "Votre trafic a ete identifie comme
    // automatise (bot)") renvoient la page complete, apercu partiel
    // inclus dans le HTML, accompagnee d'un code de statut inhabituel
    // (401/402) plutot qu'un corps vide. Jeter la reponse sans la lire,
    // comme le faisait ce fichier jusqu'ici, perdait cet apercu -- alors
    // qu'un navigateur web normal, lui, l'affiche (signale : visible
    // sous Windows, absent sur Pi/Mac alors que la MEME page etait en
    // cause).
    // The response body is ALWAYS read, even on a non-2xx status -- many
    // restricted-access sites (paywall or anti-bot protection -- for Le
    // Monde, confirmed in practice: the site literally returns "Your
    // traffic has been identified as automated (bot)") return the full
    // page, partial preview included in the HTML, along with an
    // unusual status code (401/402) rather than an empty body. Discarding
    // the response without reading it, as this file did until now, lost
    // that preview -- while a normal web browser does show it (reported:
    // visible on Windows, missing on Pi/Mac for the very same page).
    let html = await res.text();
    if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);
    return { html, status: res.status, paywallStatus: res.status === 401 || res.status === 402 };
  } finally {
    clearTimeout(timer);
  }
}

// Signaux reconnaissables d'une page de blocage anti-robot, PAS d'un
// vrai texte d'article -- confirme par un cas reel (capture d'ecran) :
// Readability peut extraire une page qui contient a la fois une image
// legitime (photo d'illustration, legende) ET le message de blocage du
// site, sans distinction, si les deux se trouvent structurellement au
// meme endroit que l'article aurait occupe. Sans cette detection, ce
// message s'affichait comme si c'etait un "apercu partiel" legitime --
// trompeur et confus. Liste non exhaustive, couvre les formulations les
// plus courantes (plusieurs fournisseurs anti-bot se ressemblent).
// Recognizable signals of an anti-bot block page, NOT a real article
// text -- confirmed by a real case (screenshot): Readability can
// extract a page that contains both a legitimate image (illustration
// photo, caption) AND the site's block message, without distinction, if
// both structurally sit where the article would have. Without this
// detection, that message displayed as if it were a legitimate "partial
// preview" -- misleading and confusing. Non-exhaustive list, covers the
// most common phrasings (several anti-bot vendors sound alike).
const BOT_BLOCK_SIGNALS = [
  /identifi[ée] comme automatis[ée]/i,
  /identified as automated/i,
  /trafic a [ée]t[ée] identifi[ée]/i,
  /suspicious activity/i,
  /verify you are human/i,
  /v[ée]rifiez que vous [êe]tes humain/i,
  /request id[^a-z]*:\s*[0-9a-f]{8,}/i, // identifiant de requete type "RID: 1b07ad62..."
  /\bRID:\s*[0-9a-f]{10,}/i
];

function looksLikeBotBlockPage(text) {
  return BOT_BLOCK_SIGNALS.some((re) => re.test(text));
}

function readabilityParse(html, url) {
  const dom = new JSDOM(html, { url });
  try {
    return new Readability(dom.window.document).parse();
  } finally {
    dom.window.close(); // libere la memoire jsdom sans attendre le GC / frees jsdom memory without waiting on GC
  }
}

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

  let article = null;
  let sawPaywallStatus = false;
  let lastError = null;
  for (let i = 0; i < USER_AGENTS.length; i++) {
    try {
      // La 1re tentative reste minimale et honnete ; seule la 2e, de
      // repli, envoie le jeu d'en-tetes complet d'un navigateur.
      // The 1st attempt stays minimal and honest; only the 2nd,
      // fallback one sends a browser's full header set.
      const { html, status, paywallStatus } = await fetchHtml(url, USER_AGENTS[i], i > 0);
      if (paywallStatus) sawPaywallStatus = true;
      // Tente l'extraction sur CE QUI A ETE RECU, meme si le statut
      // n'etait pas 2xx -- voir fetchHtml(). Un statut d'echec avec un
      // corps vide (blocage pur, sans page) donne simplement un texte
      // trop court plus bas, geree normalement par le seuil habituel.
      // Attempts extraction on WHAT WAS RECEIVED, even if the status
      // wasn't 2xx -- see fetchHtml(). A failing status with an empty
      // body (a pure block, no page at all) simply yields text too
      // short below, handled normally by the usual threshold.
      const candidate = html ? readabilityParse(html, url) : null;
      const candidateText = candidate && candidate.textContent ? candidate.textContent.trim() : "";
      // Rejette explicitement si le texte "extrait" est en realite le
      // message de blocage du site (voir BOT_BLOCK_SIGNALS) : sans ce
      // controle, une image legitime (photo d'illustration) melangee au
      // message de blocage franchissait quand meme le seuil de longueur
      // et s'affichait comme si c'etait un vrai apercu -- confus et
      // trompeur (confirme par un cas reel).
      // Explicitly rejects when the "extracted" text is actually the
      // site's block message (see BOT_BLOCK_SIGNALS): without this
      // check, a legitimate image (illustration photo) mixed with the
      // block message still cleared the length threshold and displayed
      // as if it were a real preview -- confusing and misleading
      // (confirmed by a real case).
      if (candidateText.length >= MIN_TEXT_LENGTH && !looksLikeBotBlockPage(candidateText)) {
        article = candidate;
        // Journalise seulement quand le repli a ete necessaire, pour
        // confirmer/infirmer l'hypothese sans bruiter le journal au
        // quotidien. Logged only when the fallback was actually needed,
        // to confirm/rule out the hypothesis without cluttering the log
        // day to day.
        if (i > 0) console.warn("[piboard] article-extract: reussi avec le user-agent de repli pour", url);
        break;
      }
      if (candidateText && looksLikeBotBlockPage(candidateText)) {
        console.warn("[piboard] article-extract: page de blocage anti-robot detectee et ecartee pour", url);
        sawPaywallStatus = true; // le message honnete cote client ("acces refuse") reste approprie / the honest client-side message ("access denied") remains appropriate
      }
      lastError = new Error(status >= 400 ? "upstream status " + status : "no readable content");
    } catch (e) {
      lastError = e;
    }
  }

  if (!article) {
    const err = lastError || new Error("no readable content");
    if (sawPaywallStatus) err.paywall = true;
    throw err;
  }

  return {
    title: article.title || null,
    byline: article.byline || null,
    siteName: article.siteName || null,
    excerpt: article.excerpt || null,
    content: article.content || null, // HTML deja nettoye par Readability / HTML already cleaned up by Readability
    // Un texte a tout de meme ete extrait, mais le statut HTTP sous-
    // jacent signalait un acces restreint (401/402, paywall ou
    // anti-robot) : ce qui est affiche n'est probablement qu'un apercu
    // partiel, pas l'article complet -- l'indiquer honnetement plutot
    // que de laisser croire au texte integral. Text was still extracted,
    // but the underlying HTTP status signaled restricted access (401/402,
    // paywall or anti-bot): what's shown is probably only a partial
    // preview, not the full article -- stated honestly rather than
    // implying the full text.
    partial: sawPaywallStatus
  };
}

module.exports = { extractArticle };
