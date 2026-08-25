/* ============================================================
   PiBoard - server/stocks.js
   Cours de bourse, indices et change pour la tuile "Bourse".

   DEUX sources, meme schema que server/crypto.js :
   1. Stooq en PRIORITE : CSV public, sans cle ni compte.
   2. Yahoo Finance en REPLI : sans cle egalement, mais point d'entree
      non officiel, donc second.

   PIEGE DE STOOQ, la raison d'etre de isStooqError() : quand le quota
   journalier est depasse, Stooq renvoie le message d'erreur DANS LE
   CORPS avec un code HTTP 200. Un simple `res.ok` laisserait donc passer
   du texte d'erreur a la place d'un cours. On valide le contenu, pas le
   code de statut.

   COURS DIFFERES. Aucune de ces sources n'est du temps reel : les
   valeurs sont differees, souvent la cloture precedente pour les
   indices. C'est sans importance pour un tableau mural domestique, mais
   l'aide le dit clairement plutot que de laisser croire au direct.

   TWO sources, same pattern as server/crypto.js:
   1. Stooq FIRST: public CSV, no key or account.
   2. Yahoo Finance as a FALLBACK: keyless too, but an unofficial
      endpoint, hence second.

   STOOQ'S TRAP, the reason isStooqError() exists: when the daily quota is
   exceeded, Stooq returns the error message IN THE BODY with an HTTP 200
   status. A plain `res.ok` would therefore let error text through in
   place of a price. We validate the content, not the status code.

   DELAYED QUOTES. Neither source is real-time: values are delayed, often
   the previous close for indices. This does not matter for a home wall
   board, but the help says so plainly rather than implying live data.
   ============================================================ */
"use strict";

const catalog = require("./stocksCatalog");

const QUOTE_TTL_MS = 5 * 60 * 1000;
/* Marche ferme : le cours ne bougera plus avant la reouverture. Inutile
   d'interroger la source toutes les 5 minutes toute la nuit et tout le
   week-end -- on etire le cache a 2 h. Meme esprit d'economie que le
   cache Tempo : ces sources sont gratuites, autant ne pas les marteler
   pour une valeur figee.
   Market closed: the price will not move before it reopens. No point
   querying the source every 5 minutes all night and all weekend -- the
   cache stretches to 2 h. Same frugality as the Tempo cache: these
   sources are free, so let us not hammer them for a frozen value. */
const CLOSED_TTL_MS = 2 * 60 * 60 * 1000;
const CHART_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 12000;

const quoteCache = new Map();  // symbol -> { at, value }
const chartCache = new Map();  // "symbol:range" -> { at, value }

/* Reconnait une reponse Stooq qui n'est PAS une cotation. Deux cas
   distincts : le depassement de quota (message en clair), et le symbole
   inconnu (Stooq renvoie une ligne dont tous les champs valent "N/D").
   Recognises a Stooq reply that is NOT a quote. Two distinct cases: quota
   exceeded (plain-text message), and unknown symbol (Stooq returns a row
   whose fields are all "N/D"). */
function isStooqError(text) {
  if (!text) return true;
  const t = String(text).trim();
  if (!t) return true;
  if (/exceeded|limit|error|denied/i.test(t) && !/^symbol/i.test(t)) return true;
  return false;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "PiBoard", "Accept": "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("http " + res.status);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "PiBoard", "Accept": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("http " + res.status);
  return res.json();
}

/* ---------- Stooq ---------- */

/* CSV a deux lignes : entete puis valeurs.
   Symbol,Date,Time,Open,High,Low,Close,Volume
   Two-line CSV: header then values. */
function parseStooqQuote(text) {
  if (isStooqError(text)) return null;
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const cells = lines[1].split(",").map((c) => c.trim());
  const get = (name) => {
    const i = head.indexOf(name);
    return i === -1 ? null : cells[i];
  };
  const close = Number(get("close"));
  const open = Number(get("open"));
  // "N/D" partout = symbole inconnu. Number("N/D") vaut NaN, ce test
  // l'attrape sans cas particulier.
  // "N/D" everywhere = unknown symbol. Number("N/D") is NaN, so this test
  // catches it with no special case.
  if (!Number.isFinite(close) || close <= 0) return null;
  return {
    price: close,
    // Variation calculee sur open->close de la SEANCE, faute de cloture
    // veille dans cette reponse. C'est la variation du jour, ce qu'on
    // veut afficher.
    // Change computed on the SESSION's open->close, there being no
    // previous close in this reply. That is the day's change, which is
    // what we want to show.
    change: Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null,
    date: get("date") || null,
    time: get("time") || null
  };
}

async function stooqQuote(symbol) {
  const url = "https://stooq.com/q/l/?s=" + encodeURIComponent(symbol.toLowerCase()) +
    "&f=sd2t2ohlcv&h&e=csv";
  return parseStooqQuote(await fetchText(url));
}

/* Historique quotidien. Stooq renvoie tout l'historique disponible ; on
   ne garde que la fin, la tuile n'affichant que la periode demandee.
   Daily history. Stooq returns all available history; we keep only the
   tail, the tile showing just the requested range. */
function parseStooqChart(text, points) {
  if (isStooqError(text)) return null;
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length < 3) return null;
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const di = head.indexOf("date");
  const ci = head.indexOf("close");
  if (di === -1 || ci === -1) return null;
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const v = Number(cells[ci]);
    if (Number.isFinite(v) && v > 0) out.push({ date: cells[di], value: v });
  }
  return out.length ? out.slice(-points) : null;
}

async function stooqChart(symbol, points) {
  const url = "https://stooq.com/q/d/l/?s=" + encodeURIComponent(symbol.toLowerCase()) + "&i=d";
  return parseStooqChart(await fetchText(url), points);
}

/* ---------- Yahoo (repli) / Yahoo (fallback) ---------- */

/* Les symboles ne s'ecrivent pas pareil chez les deux sources. Cette
   traduction est forcement partielle : elle couvre les conventions de
   suffixe et les indices du catalogue, et renvoie null si elle ne sait
   pas -- mieux vaut pas de repli qu'un repli sur le mauvais titre.
   The two sources do not spell symbols the same way. This translation is
   necessarily partial: it covers the suffix conventions and the catalog's
   indices, and returns null when it does not know -- no fallback beats a
   fallback on the wrong security. */
const YAHOO_INDEX = {
  "^CAC": "^FCHI", "^SPX": "^GSPC", "^NDQ": "^IXIC", "^DJI": "^DJI",
  "^DAX": "^GDAXI", "^FTM": "^FTSE", "^NKX": "^N225",
  "^STOXX50E": "^STOXX50E", "^SMI": "^SSMI", "^HSI": "^HSI"
};
const YAHOO_SUFFIX = { ".FR": ".PA", ".DE": ".DE", ".UK": ".L", ".JP": ".T", ".HK": ".HK", ".US": "" };

function toYahooSymbol(symbol) {
  const s = String(symbol || "").toUpperCase().trim();
  if (YAHOO_INDEX[s]) return YAHOO_INDEX[s];
  if (s.startsWith("^")) return null;
  if (/^[A-Z]{6}$/.test(s)) return s + "=X";           // change / FX
  if (/^X(AU|AG)USD$/.test(s)) return s + "=X";
  const m = s.match(/(\.[A-Z]{2})$/);
  if (m && YAHOO_SUFFIX[m[1]] !== undefined) return s.replace(m[1], YAHOO_SUFFIX[m[1]]);
  if (!s.includes(".")) return s;
  return null;
}

async function yahooQuote(symbol) {
  const y = toYahooSymbol(symbol);
  if (!y) return null;
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(y) + "?range=5d&interval=1d";
  const j = await fetchJson(url);
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  const meta = r && r.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  const prev = Number(meta.chartPreviousClose || meta.previousClose);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    price,
    change: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : null,
    date: null,
    time: null
  };
}

/* ---------- API publique du module / module public API ---------- */

const RANGE_POINTS = { "1m": 22, "6m": 130, "1y": 260, "5y": 1300 };

async function getQuotes(symbols) {
  const now = Date.now();
  const out = {};

  await Promise.all(symbols.map(async (symbol) => {
    // L'etat du marche est recalcule a CHAQUE appel, meme sur un cours
    // servi depuis le cache : sinon l'indicateur resterait bloque sur
    // "ouvert" pendant deux heures apres la cloture.
    // The market state is recomputed on EVERY call, even for a price
    // served from cache: otherwise the indicator would stay stuck on
    // "open" for two hours after the close.
    const open = catalog.isMarketOpen(symbol, null);
    const ttl = open === false ? CLOSED_TTL_MS : QUOTE_TTL_MS;

    const cached = quoteCache.get(symbol);
    if (cached && now - cached.at < ttl) {
      out[symbol] = { ...cached.value, marketOpen: open, kind: catalog.kindFor(symbol) };
      return;
    }

    let q = null;
    try { q = await stooqQuote(symbol); }
    catch (e) { console.warn("[piboard] stooq echec ->", symbol, e.message || e); }

    if (!q) {
      try { q = await yahooQuote(symbol); }
      catch (e) { console.warn("[piboard] yahoo echec ->", symbol, e.message || e); }
    }

    if (q) {
      const currency = catalog.currencyFor(symbol);
      const value = { ...q, currency, symbolChar: catalog.symbolFor(currency), stale: false };
      quoteCache.set(symbol, { at: now, value });
      out[symbol] = { ...value, marketOpen: open, kind: catalog.kindFor(symbol) };
      return;
    }

    // Les DEUX sources ont echoue : on ressort la derniere valeur connue
    // plutot que de faire disparaitre une ligne qui etait juste il y a
    // cinq minutes. L'etat degrade est SIGNALE (stale), pas camoufle.
    // BOTH sources failed: we surface the last known value rather than
    // making a line vanish that was correct five minutes ago. The
    // degraded state is FLAGGED (stale), not hidden.
    if (cached) out[symbol] = { ...cached.value, stale: true, marketOpen: open, kind: catalog.kindFor(symbol) };
    else out[symbol] = null;
  }));

  return { quotes: out, updatedAt: new Date().toISOString() };
}

async function getChart(symbol, range) {
  const points = RANGE_POINTS[range] || RANGE_POINTS["1y"];
  const key = symbol + ":" + range;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.at < CHART_TTL_MS) return cached.value;

  let series = null;
  try { series = await stooqChart(symbol, points); }
  catch (e) { console.warn("[piboard] stooq courbe echec ->", symbol, e.message || e); }

  if (!series) throw new Error("chart_unavailable");

  const currency = catalog.currencyFor(symbol);
  const value = { symbol, range, series, currency, symbolChar: catalog.symbolFor(currency) };
  chartCache.set(key, { at: Date.now(), value });
  return value;
}

function clearCache() { quoteCache.clear(); chartCache.clear(); }

module.exports = {
  getQuotes, getChart, clearCache,
  QUOTE_TTL_MS, CLOSED_TTL_MS, CHART_TTL_MS, RANGE_POINTS,
  _parseStooqQuote: parseStooqQuote,
  _parseStooqChart: parseStooqChart,
  _isStooqError: isStooqError,
  _toYahooSymbol: toYahooSymbol
};
