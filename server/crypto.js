/* ============================================================
   PiBoard - server/crypto.js
   Proxy cote serveur pour la tuile "Cours Cryptos" (CoinGecko).

   Pourquoi ce detour est necessaire : le widget appelait jusqu'ici
   l'API publique CoinGecko DIRECTEMENT depuis le navigateur. Or cette
   API, sans cle, est plafonnee a seulement 5 a 15 requetes par minute
   -- et cette limite est appliquee PAR ADRESSE IP, partagee entre tous
   les appareils du foyer (voire, derriere un NAT operateur, entre
   plusieurs foyers). Un simple rafraichissement automatique toutes les
   quelques minutes, combine a l'ouverture d'une courbe (qui declenche
   un appel par periode consultee), suffit a epuiser ce quota -- d'ou
   des echecs frequents et imprevisibles, parfois sur une seule duree,
   parfois sur toutes.

   Ce module resout ca sur deux plans :
   1. CACHE cote serveur (cours ~1 min, courbes ~10 min) : un
      rafraichissement de la tuile ou une consultation repetee de la
      meme courbe ne redeclenche PAS un appel a CoinGecko a chaque
      fois, quel que soit le nombre d'ecrans/onglets PiBoard ouverts en
      meme temps -- tous partagent le meme cache serveur.
   2. Repli sur la DERNIERE VALEUR CONNUE en cas d'echec (quota depasse
      ou CoinGecko indisponible) : une eviction momentanee ne doit pas
      faire disparaitre des cours qui etaient corrects il y a une
      minute. Le repli est signale (stale: true) plutot que camoufle.
   Un espacement minimal entre les appels sortants (voir enqueue())
   borne le pire des cas (plusieurs pieces/courbes jamais vues
   consultees d'un coup) a un rythme raisonnable, meme sans cache.

   Why this detour is necessary: the widget used to call CoinGecko's
   public API DIRECTLY from the browser. Without a key, that API is
   capped at only 5 to 15 requests per minute -- and that limit is
   applied PER IP ADDRESS, shared across every device in the household
   (or, behind a carrier NAT, even across several households). A plain
   automatic refresh every few minutes, combined with opening a chart
   (which triggers a call per period viewed), is enough to exhaust that
   quota -- hence frequent, unpredictable failures, sometimes for a
   single duration, sometimes for all of them.

   This module fixes that on two fronts:
   1. Server-side CACHE (prices ~1 min, charts ~10 min): refreshing the
      tile or repeatedly viewing the same chart does NOT re-trigger a
      CoinGecko call every time, no matter how many PiBoard
      screens/tabs are open at once -- they all share the same
      server-side cache.
   2. Falls back to the LAST KNOWN VALUE on failure (quota exceeded or
      CoinGecko unavailable): a momentary eviction must not make prices
      that were correct a minute ago vanish. The fallback is flagged
      (stale: true) rather than hidden.
   A minimal spacing between outbound calls (see enqueue()) bounds the
   worst case (several never-before-seen coins/charts viewed at once)
   to a reasonable pace, even without a cache hit.
   ============================================================ */
"use strict";

const FETCH_TIMEOUT_MS = 10000;
const PRICE_TTL_MS = 60 * 1000;        // 1 min : suffisant pour un tableau mural, pas un terminal de trading / enough for a wall dashboard, not a trading terminal
const CHART_TTL_MS = 10 * 60 * 1000;   // 10 min : une courbe 24h/7j/30j/1an n'a pas besoin d'etre a la seconde pres / a 24h/7d/30d/1y chart doesn't need to-the-second freshness
// Espacement minimal entre deux appels sortants -- ~13-14/min au pire,
// sous la fourchette basse (5-15/min) documentee par CoinGecko pour
// l'acces sans cle. Minimum spacing between two outbound calls -- ~13-14/min
// worst case, under the low end (5-15/min) CoinGecko documents for keyless access.
const MIN_SPACING_MS = 4200;

const priceCache = new Map(); // "id1,id2::currency" -> { at, data }
const chartCache = new Map(); // "id::currency::days" -> { at, prices }

let chain = Promise.resolve();
let lastCallAt = 0;

/* File d'attente partagee par TOUS les appels sortants vers CoinGecko
   (cours et courbes confondus) : garantit l'espacement minimal meme si
   plusieurs requetes arrivent en meme temps (plusieurs tuiles, ou une
   tuile qui affiche a la fois sa liste de cours et une courbe).
   L'echec d'un appel ne bloque jamais les suivants.
   Queue shared by ALL outbound calls to CoinGecko (prices and charts
   alike): guarantees the minimum spacing even if several requests
   arrive at once (several tiles, or one tile showing both its price
   list and a chart at the same time). One call's failure never blocks
   the next ones. */
function enqueue(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_SPACING_MS - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  chain = run.then(() => {}, () => {});
  return run;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PiBoard/0.1 (+https://github.com/jihemezes/piboard)",
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      const err = new Error("status " + res.status);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* Cours actuels d'une liste de pieces. "data" reprend le format
   CoinGecko tel quel (id -> {currency, currency_24h_change}), pour ne
   rien changer cote widget au-dela de l'adresse appelee.
   "deps.now" (optionnel) permet aux tests de simuler l'ecoulement du
   temps sans attendre reellement le TTL -- meme principe que
   teleProgram.js:loadGrid(config, deps).
   Current prices for a list of coins. "data" mirrors CoinGecko's own
   shape as-is (id -> {currency, currency_24h_change}), so nothing
   changes tile-side beyond the called address.
   "deps.now" (optional) lets tests simulate the passage of time
   without actually waiting out the TTL -- same principle as
   teleProgram.js:loadGrid(config, deps). */
async function getPrices(ids, currency, deps) {
  const now = (deps && deps.now) || Date.now();
  const key = ids.slice().sort().join(",") + "::" + currency;
  const hit = priceCache.get(key);
  if (hit && (now - hit.at) < PRICE_TTL_MS) return { data: hit.data, stale: false };
  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(ids.join(","))
      + "&vs_currencies=" + encodeURIComponent(currency) + "&include_24hr_change=true";
    const data = await enqueue(() => fetchJson(url));
    priceCache.set(key, { at: now, data });
    return { data, stale: false };
  } catch (e) {
    if (hit) return { data: hit.data, stale: true };
    throw e;
  }
}

/* Serie de prix pour une piece, sur une periode donnee (en jours).
   Meme parametre "deps.now" que getPrices ci-dessus, meme raison.
   Price series for one coin, over a given period (in days). Same
   "deps.now" parameter as getPrices above, same reason. */
async function getChart(coinId, currency, days, deps) {
  const now = (deps && deps.now) || Date.now();
  const key = coinId + "::" + currency + "::" + days;
  const hit = chartCache.get(key);
  if (hit && (now - hit.at) < CHART_TTL_MS) return { prices: hit.prices, stale: false };
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart`
      + `?vs_currency=${encodeURIComponent(currency)}&days=${encodeURIComponent(days)}`;
    const data = await enqueue(() => fetchJson(url));
    const prices = (data.prices || []).map((p) => p[1]);
    if (!prices.length) throw new Error("no data");
    chartCache.set(key, { at: now, prices });
    return { prices, stale: false };
  } catch (e) {
    if (hit) return { prices: hit.prices, stale: true };
    throw e;
  }
}

function clearCache() {
  priceCache.clear();
  chartCache.clear();
}

module.exports = { getPrices, getChart, clearCache, PRICE_TTL_MS, CHART_TTL_MS, MIN_SPACING_MS };
