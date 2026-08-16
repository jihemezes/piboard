/* ============================================================
   PiBoard - server/crypto.js
   Proxy cote serveur pour la tuile "Cours Cryptos".

   DEUX sources, dans cet ordre :
   1. Binance (server/cryptoBinance.js), en PRIORITE : API publique
      sans cle, limite de debit de 6000 de "poids" par minute --
      largement de quoi ne plus jamais reposer la question du quota
      pour les cryptos courantes.
   2. CoinGecko, en REPLI : pour toute crypto absente de la liste geree
      par Binance (voir server/cryptoBinance.js), ou si Binance echoue
      ponctuellement. Couvre des dizaines de milliers de cryptos,
      contre quelques centaines pour Binance -- mais avec une limite
      sans cle bien plus stricte (5 a 15 requetes/minute, PARTAGEE PAR
      TOUTE L'ADRESSE IP DU FOYER), d'ou le passage en repli plutot
      qu'en source principale.

   Ce module ajoute par-dessus, pour les DEUX sources :
   1. CACHE cote serveur, PAR CRYPTO INDIVIDUELLE (cours ~1 min,
      courbes ~10 min) : un rafraichissement de la tuile ou une
      consultation repetee de la meme courbe ne redeclenche PAS un
      appel a la source a chaque fois, quel que soit le nombre
      d'ecrans/onglets PiBoard ouverts en meme temps -- tous partagent
      le meme cache serveur. Le cache est tenu par crypto plutot que
      par lot de requete : la composition exacte du lot (quelles
      cryptos passent par Binance vs CoinGecko a un instant donne) peut
      varier sans invalider inutilement le cache des autres.
   2. Repli sur la DERNIERE VALEUR CONNUE en cas d'echec des DEUX
      sources pour une crypto donnee : une eviction momentanee ne doit
      pas faire disparaitre des cours qui etaient corrects il y a une
      minute. Le repli est signale (stale: true) plutot que camoufle.
   Un espacement minimal entre les appels CoinGecko (voir enqueue())
   borne le pire des cas a un rythme raisonnable meme sans cache --
   Binance n'a pas besoin de cette precaution, son quota etant sans
   commune mesure avec celui de CoinGecko.

   TWO sources, in this order:
   1. Binance (server/cryptoBinance.js), FIRST: public API, no key
      needed, 6000 "weight" points/minute rate limit -- more than
      enough that the quota question should never come up again for
      common coins.
   2. CoinGecko, as a FALLBACK: for any coin missing from Binance's
      list (see server/cryptoBinance.js), or if Binance momentarily
      fails. Covers tens of thousands of coins, versus a few hundred
      for Binance -- but with a much stricter keyless limit (5 to 15
      requests/minute, SHARED BY THE WHOLE HOUSEHOLD'S IP ADDRESS),
      hence the fallback role rather than primary source.

   On top of that, for BOTH sources, this module adds:
   1. Server-side cache, PER INDIVIDUAL COIN (prices ~1 min, charts ~10
      min): refreshing the tile or repeatedly viewing the same chart
      does NOT re-trigger a source call every time, no matter how many
      PiBoard screens/tabs are open at once -- they all share the same
      server-side cache. The cache is kept per coin rather than per
      request batch: the exact batch composition (which coins go
      through Binance vs CoinGecko at a given moment) can vary without
      needlessly invalidating other coins' cache.
   2. Falls back to the LAST KNOWN VALUE if BOTH sources fail for a
      given coin: a momentary eviction must not make prices that were
      correct a minute ago vanish. The fallback is flagged (stale:
      true) rather than hidden.
   A minimum spacing between CoinGecko calls (see enqueue()) bounds the
   worst case to a reasonable pace even without a cache hit -- Binance
   doesn't need this precaution, its quota being nothing like
   CoinGecko's.
   ============================================================ */
"use strict";

const binance = require("./cryptoBinance");

const FETCH_TIMEOUT_MS = 15000;
// Delai plus genereux pour une courbe sur 1 an : la reponse peut
// contenir bien plus de points qu'une courbe 24h, et un Raspberry Pi
// sur une connexion domestique plus lente peut avoir besoin de plus
// de temps pour la recevoir et la traiter en entier.
// More generous delay for a 1-year chart: the response can contain far
// more points than a 24h chart, and a Raspberry Pi on a slower home
// connection may need more time to receive and fully process it.
const CHART_FETCH_TIMEOUT_MS = 25000;
const PRICE_TTL_MS = 60 * 1000;        // 1 min : suffisant pour un tableau mural, pas un terminal de trading / enough for a wall dashboard, not a trading terminal
const CHART_TTL_MS = 10 * 60 * 1000;   // 10 min : une courbe 24h/7j/30j/1an n'a pas besoin d'etre a la seconde pres / a 24h/7d/30d/1y chart doesn't need to-the-second freshness
// Espacement minimal entre deux appels CoinGecko UNIQUEMENT (Binance
// n'a pas besoin de cette precaution, voir le commentaire d'en-tete).
// CoinGecko documente une fourchette de 5 A 15 requetes/minute pour
// l'acces sans cle, "selon les conditions d'utilisation dans le
// monde" -- donc potentiellement aussi basse que 5/min pour une
// adresse IP donnee. Cale ici sur ce PIRE cas documente (~4,8/min)
// plutot que sur le meilleur.
// Minimum spacing between CoinGecko calls ONLY (Binance doesn't need
// this precaution, see the header comment). CoinGecko documents a
// range of 5 to 15 requests/minute for keyless access, "depending on
// usage conditions worldwide" -- so potentially as low as 5/min for a
// given IP address. Calibrated here on that WORST documented case
// (~4.8/min) rather than the best.
const MIN_SPACING_MS = 12500;

const priceCache = new Map(); // "coinId::currency" -> { at, price, change }
const chartCache = new Map(); // "coinId::currency::days" -> { at, prices }

let chain = Promise.resolve();
let lastCallAt = 0;

/* File d'attente reservee aux appels CoinGecko : garantit l'espacement
   minimal meme si plusieurs requetes arrivent en meme temps. L'echec
   d'un appel ne bloque jamais les suivants.
   Queue reserved for CoinGecko calls: guarantees the minimum spacing
   even if several requests arrive at once. One call's failure never
   blocks the next ones. */
function enqueueCoinGecko(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_SPACING_MS - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  chain = run.then(() => {}, () => {});
  return run;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
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

async function fetchPricesFromCoinGecko(ids, currency) {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(ids.join(","))
    + "&vs_currencies=" + encodeURIComponent(currency) + "&include_24hr_change=true";
  return enqueueCoinGecko(() => fetchJson(url));
}

async function fetchChartFromCoinGecko(coinId, currency, days) {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart`
    + `?vs_currency=${encodeURIComponent(currency)}&days=${encodeURIComponent(days)}`;
  const data = await enqueueCoinGecko(() => fetchJson(url, CHART_FETCH_TIMEOUT_MS));
  const prices = (data.prices || []).map((p) => p[1]);
  if (!prices.length) throw new Error("no data");
  return prices;
}

/* Cours actuels d'une liste de pieces. "data" reprend le format
   CoinGecko tel quel (id -> {currency, currency_24h_change}), pour ne
   rien changer cote widget quelle que soit la source reellement
   utilisee en coulisses.

   Deroule en 3 temps : (1) le cache, par crypto individuelle -- une
   partie de la liste peut deja etre fraiche pendant que le reste ne
   l'est plus ; (2) Binance, pour ce qui reste a rafraichir et que
   Binance reconnait ; (3) CoinGecko, pour ce que Binance ne couvre pas
   ou n'a pas reussi a fournir. Le repli sur une valeur perimee ne
   s'applique qu'en tout dernier ressort, crypto par crypto.

   "deps.now" (optionnel) permet aux tests de simuler l'ecoulement du
   temps sans attendre reellement le TTL -- meme principe que
   teleProgram.js:loadGrid(config, deps).

   Current prices for a list of coins. "data" mirrors CoinGecko's own
   shape as-is (id -> {currency, currency_24h_change}), so nothing
   changes tile-side regardless of which source is actually used
   behind the scenes.

   Unfolds in 3 steps: (1) the cache, per individual coin -- part of
   the list may already be fresh while the rest isn't; (2) Binance, for
   what's left to refresh and that Binance recognizes; (3) CoinGecko,
   for whatever Binance doesn't cover or failed to provide. Falling
   back to a stale value only applies as a last resort, coin by coin.

   "deps.now" (optional) lets tests simulate the passage of time
   without actually waiting out the TTL -- same principle as
   teleProgram.js:loadGrid(config, deps). */
async function getPrices(ids, currency, deps) {
  const now = (deps && deps.now) || Date.now();
  const data = {};
  const needed = [];

  for (const id of ids) {
    const hit = priceCache.get(id + "::" + currency);
    if (hit && (now - hit.at) < PRICE_TTL_MS) {
      data[id] = { [currency]: hit.price, [currency + "_24h_change"]: hit.change };
    } else {
      needed.push(id);
    }
  }
  if (!needed.length) return { data, stale: false };

  let stillNeeded = needed;
  try {
    const fromBinance = await binance.fetchPrices(needed, currency);
    for (const id of Object.keys(fromBinance)) {
      priceCache.set(id + "::" + currency, {
        at: now, price: fromBinance[id][currency], change: fromBinance[id][currency + "_24h_change"]
      });
      data[id] = fromBinance[id];
    }
    stillNeeded = needed.filter((id) => !(id in fromBinance));
  } catch (e) {
    // Binance indisponible dans son ensemble pour cet appel : tout
    // retombe sur CoinGecko, comme si aucune piece n'y avait ete trouvee.
    // Binance entirely unavailable for this call: everything falls
    // back to CoinGecko, as if no coin had been found there.
  }

  if (stillNeeded.length) {
    try {
      const fromGecko = await fetchPricesFromCoinGecko(stillNeeded, currency);
      for (const id of stillNeeded) {
        if (!fromGecko[id]) continue;
        priceCache.set(id + "::" + currency, {
          at: now, price: fromGecko[id][currency], change: fromGecko[id][currency + "_24h_change"]
        });
        data[id] = fromGecko[id];
      }
    } catch (e) {
      // Echec CoinGecko egalement : chaque piece encore manquante tente
      // son propre repli individuel juste en dessous.
      // CoinGecko also failed: each still-missing coin tries its own
      // individual fallback right below.
    }
  }

  // Repli, crypto par crypto, sur la derniere valeur connue -- y
  // compris perimee -- pour tout ce qui manque encore a ce stade.
  // Fallback, coin by coin, to the last known value -- even if
  // stale -- for anything still missing at this point.
  let stale = false;
  for (const id of ids) {
    if (data[id]) continue;
    const hit = priceCache.get(id + "::" + currency);
    if (hit) {
      data[id] = { [currency]: hit.price, [currency + "_24h_change"]: hit.change };
      stale = true;
    }
  }

  if (!Object.keys(data).length) throw new Error("no data for any requested coin");
  return { data, stale };
}

/* Serie de prix pour une piece, sur une periode donnee (en jours).
   Meme ordre de sources que getPrices : Binance d'abord, CoinGecko en
   repli, puis la derniere serie connue si les deux echouent. Meme
   parametre "deps.now" que getPrices ci-dessus, meme raison.
   Price series for one coin, over a given period (in days). Same
   source order as getPrices: Binance first, CoinGecko as a fallback,
   then the last known series if both fail. Same "deps.now" parameter
   as getPrices above, same reason. */
async function getChart(coinId, currency, days, deps) {
  const now = (deps && deps.now) || Date.now();
  const key = coinId + "::" + currency + "::" + days;
  const hit = chartCache.get(key);
  if (hit && (now - hit.at) < CHART_TTL_MS) return { prices: hit.prices, stale: false };

  try {
    const prices = await binance.fetchChart(coinId, currency, days);
    if (prices && prices.length) {
      chartCache.set(key, { at: now, prices });
      return { prices, stale: false };
    }
  } catch (e) {
    // Binance a echoue (pas seulement "piece non reconnue", qui renvoie
    // null sans lever) : tente CoinGecko juste en dessous.
    // Binance failed (not just "coin not recognized", which returns
    // null without throwing): tries CoinGecko right below.
  }

  try {
    const prices = await fetchChartFromCoinGecko(coinId, currency, days);
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

/* Reservee aux tests : remet a zero l'etat de la file d'espacement
   CoinGecko (lastCallAt/chain), pour qu'un bloc de test n'herite pas
   de l'attente accumulee par les blocs precedents dans le meme
   fichier. Sans cette remise a zero, chaque appel CoinGecko reellement
   sortant du fichier de test s'additionnerait a MIN_SPACING_MS
   (~12,5s), rendant la suite inutilisable au quotidien -- l'espacement
   lui-meme n'a besoin d'etre exerce "en vrai" que par le test qui le
   verifie explicitement.
   Test-only: resets the CoinGecko spacing queue's state (lastCallAt/
   chain), so a test block doesn't inherit the wait accumulated by
   earlier blocks in the same file. Without this reset, every genuinely
   outbound CoinGecko call in the test file would add up to
   MIN_SPACING_MS (~12.5s), making the suite impractical for everyday
   use -- the spacing itself only needs to be exercised "for real" by
   the test that explicitly checks it. */
function _resetThrottleForTests() {
  chain = Promise.resolve();
  lastCallAt = 0;
}

module.exports = { getPrices, getChart, clearCache, PRICE_TTL_MS, CHART_TTL_MS, MIN_SPACING_MS, _resetThrottleForTests };
