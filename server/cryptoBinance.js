/* ============================================================
   PiBoard - server/cryptoBinance.js
   Source de donnees PRINCIPALE de la tuile "Cours Cryptos" : l'API
   publique de Binance (donnees de marche, pas de compte). CoinGecko
   (server/crypto.js) reste utilisee en REPLI pour les cryptos absentes
   de la liste ci-dessous, ou si Binance echoue ponctuellement.

   Pourquoi Binance en priorite : sa limite de debit publique est de
   6000 de "poids" par minute (chaque requete de marche coute
   generalement 1 a 2 points) -- sans commune mesure avec les 5 a 15
   requetes/minute, partagees par toute l'adresse IP du foyer, de
   l'API CoinGecko sans cle. Dans les faits, avec Binance en source
   principale, le quota qui posait probleme jusqu'ici ne devrait plus
   jamais etre atteint pour les cryptos courantes.

   Contrepartie assumee : Binance ne liste "que" plusieurs centaines de
   cryptos (les plus echangees), quand CoinGecko en reference des
   dizaines de milliers. La correspondance ci-dessous couvre les
   cryptos les plus consultees ; toute crypto absente de cette liste
   (ou dont la paire EUR/USDT specifique n'existerait finalement pas)
   retombe automatiquement sur CoinGecko, de facon totalement
   transparente pour la tuile.

   Sans cle API, comme l'ancienne integration CoinGecko -- aucune
   configuration supplementaire pour l'utilisateur.

   Main data source for the "Crypto prices" tile: Binance's public API
   (market data, no account needed). CoinGecko (server/crypto.js)
   remains the FALLBACK for coins missing from the list below, or if
   Binance fails momentarily.

   Why Binance first: its public rate limit is 6000 "weight" points per
   minute (a market data request typically costs 1-2 points) -- nothing
   like CoinGecko's keyless 5 to 15 requests/minute, shared by the
   whole household's IP address. In practice, with Binance as the main
   source, the quota that used to be a problem should no longer ever be
   reached for common coins.

   Accepted trade-off: Binance only lists a few hundred coins (the most
   traded ones), while CoinGecko references tens of thousands. The
   mapping below covers the most commonly tracked coins; any coin
   missing from this list (or whose specific EUR/USDT pair doesn't
   actually exist) automatically falls back to CoinGecko, fully
   transparently to the tile.

   No API key, same as the previous CoinGecko-only integration -- no
   extra configuration for the user.
   ============================================================ */
"use strict";

const FETCH_TIMEOUT_MS = 10000;

/* Identifiant CoinGecko (celui saisi dans les reglages de la tuile,
   pour rester compatible avec les configurations existantes) -> actif
   de base Binance. Liste non exhaustive par construction (voir le
   commentaire d'en-tete) : les ~150 cryptos les plus suivies
   couramment. Toute absence retombe sur CoinGecko sans reglage a
   changer.
   CoinGecko identifier (the one typed into the tile's settings, to
   stay compatible with existing configurations) -> Binance base asset.
   Non-exhaustive by design (see header comment): the ~150 most
   commonly tracked coins. Any absence falls back to CoinGecko with no
   setting to change. */
const SYMBOL_MAP = {
  bitcoin: "BTC", ethereum: "ETH", tether: "USDT", "binancecoin": "BNB",
  solana: "SOL", ripple: "XRP", "usd-coin": "USDC", cardano: "ADA",
  dogecoin: "DOGE", tron: "TRX", "avalanche-2": "AVAX", "shiba-inu": "SHIB",
  chainlink: "LINK", "polkadot": "DOT", "bitcoin-cash": "BCH", near: "NEAR",
  litecoin: "LTC", uniswap: "UNI", "internet-computer": "ICP", aptos: "APT",
  stellar: "XLM", cosmos: "ATOM", "ethereum-classic": "ETC", filecoin: "FIL",
  "hedera-hashgraph": "HBAR", vechain: "VET", "the-graph": "GRT",
  algorand: "ALGO", eos: "EOS", aave: "AAVE", tezos: "XTZ",
  "the-sandbox": "SAND", decentraland: "MANA", "axie-infinity": "AXS",
  fantom: "FTM", flow: "FLOW", chiliz: "CHZ", gala: "GALA",
  "quant-network": "QNT", maker: "MKR", "synthetix-network-token": "SNX",
  "1inch": "1INCH", "curve-dao-token": "CRV",
  "compound-governance-token": "COMP", "pancakeswap-token": "CAKE",
  zcash: "ZEC", dash: "DASH", waves: "WAVES", kusama: "KSM",
  enjincoin: "ENJ", "basic-attention-token": "BAT", zilliqa: "ZIL",
  ravencoin: "RVN", qtum: "QTUM", ontology: "ONT", icon: "ICX",
  nano: "NANO", harmony: "ONE", celo: "CELO",
  "injective-protocol": "INJ", optimism: "OP", arbitrum: "ARB",
  sui: "SUI", pepe: "PEPE", "worldcoin-wld": "WLD", "sei-network": "SEI",
  celestia: "TIA", "render-token": "RENDER", "immutable-x": "IMX",
  mantle: "MNT", starknet: "STRK", "jupiter-exchange-solana": "JUP",
  "dogwifcoin": "WIF", bonk: "BONK", "the-open-network": "TON",
  okb: "OKB", polygon: "POL", "matic-network": "MATIC", stacks: "STX",
  theta: "THETA", "theta-token": "THETA", iota: "IOTA", neo: "NEO",
  "trust-wallet-token": "TWT", kaspa: "KAS", "arweave": "AR",
  "helium": "HNT", "conflux-token": "CFX", "gmx": "GMX",
  "rocket-pool": "RPL", "lido-dao": "LDO", "frax-share": "FXS",
  "blur": "BLUR", "pyth-network": "PYTH", "jito-governance-token": "JTO",
  "wormhole": "W", "ondo-finance": "ONDO", "ethena": "ENA",
  "eigenlayer": "EIGEN", "notcoin": "NOT"
};

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PiBoard/0.1 (+https://github.com/jihemezes/piboard)", "Accept": "application/json" }
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

/* Devise -> "quote asset" Binance. Le dollar US n'a pas de paire
   directe generalisee sur Binance : USDT (Tether, adosse au dollar en
   principe a 1 pour 1) sert d'equivalent -- approximation courante et
   largement admise pour un affichage, pas pour une execution d'ordre.
   Currency -> Binance "quote asset". The US dollar has no generally
   available direct pair on Binance: USDT (Tether, pegged to the dollar
   roughly 1:1) serves as a stand-in -- a common, widely accepted
   approximation for DISPLAY purposes, not for placing an actual order. */
function quoteAsset(currency) {
  return currency === "usd" ? "USDT" : "EUR";
}

function pairFor(coinId, currency) {
  const base = SYMBOL_MAP[coinId];
  if (!base) return null;
  return base + quoteAsset(currency);
}

/* Cours + variation 24h pour une liste de pieces, en un seul appel
   groupe (Binance accepte un tableau JSON de symboles). Renvoie
   uniquement les identifiants CoinGecko reconnus ET effectivement
   trouves par Binance -- a l'appelant (server/crypto.js) de completer
   le reste via CoinGecko.
   Prices + 24h change for a list of coins, in a single batched call
   (Binance accepts a JSON array of symbols). Returns only the
   CoinGecko identifiers that are both recognized AND actually found by
   Binance -- it's up to the caller (server/crypto.js) to fill in the
   rest via CoinGecko. */
async function fetchPrices(ids, currency) {
  const pairs = {}; // symbole Binance -> identifiant CoinGecko d'origine / Binance symbol -> original CoinGecko id
  for (const id of ids) {
    const pair = pairFor(id, currency);
    if (pair) pairs[pair] = id;
  }
  const symbols = Object.keys(pairs);
  if (!symbols.length) return {};

  const url = "https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols));
  const rows = await fetchJson(url);
  const data = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = pairs[row.symbol];
    if (!id) continue;
    const price = Number(row.lastPrice);
    const change = Number(row.priceChangePercent);
    if (!Number.isFinite(price)) continue;
    data[id] = { [currency]: price, [currency + "_24h_change"]: Number.isFinite(change) ? change : null };
  }
  return data;
}

/* Nombre de bougies et intervalle Binance pour chaque duree proposee
   par la tuile -- toujours tres en-dessous de la limite de 1000
   bougies par requete, aucune pagination necessaire.
   Candle count and Binance interval for each duration the tile offers
   -- always well under the 1000-candles-per-request limit, no
   pagination needed. */
const CHART_PROFILES = {
  1: { interval: "15m", limit: 96 },     // 24h, un point tous les 1/4h / 24h, one point every 15 min
  7: { interval: "1h", limit: 168 },     // 7j / 7d
  30: { interval: "4h", limit: 180 },    // 30j / 30d
  365: { interval: "1d", limit: 365 }    // 1 an, un point par jour / 1y, one point per day
};

/* Serie de prix (cloture de chaque bougie) pour une piece. Renvoie
   null -- plutot que de lever une exception -- quand la piece n'est
   pas reconnue ou n'a pas de paire correspondante : c'est le signal
   attendu par server/crypto.js pour basculer sur CoinGecko sans que ce
   soit traite comme une "vraie" panne.
   Price series (each candle's close) for one coin. Returns null --
   rather than throwing -- when the coin isn't recognized or has no
   matching pair: that's the signal server/crypto.js expects to switch
   to CoinGecko without treating it as a "real" outage. */
async function fetchChart(coinId, currency, days) {
  const pair = pairFor(coinId, currency);
  if (!pair) return null;
  const profile = CHART_PROFILES[days] || CHART_PROFILES[1];
  const url = "https://api.binance.com/api/v3/klines?symbol=" + encodeURIComponent(pair)
    + "&interval=" + profile.interval + "&limit=" + profile.limit;
  const rows = await fetchJson(url);
  if (!Array.isArray(rows) || !rows.length) return null;
  // Index 4 d'une bougie Binance = prix de cloture (voir la doc citee
  // en tete de fichier). Index 4 of a Binance candle = close price
  // (see the doc cited at the top of the file).
  return rows.map((r) => Number(r[4])).filter((v) => Number.isFinite(v));
}

module.exports = { fetchPrices, fetchChart, pairFor, SYMBOL_MAP, CHART_PROFILES };
