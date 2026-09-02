"use strict";
/* ============================================================
   PiBoard - test/cryptoBinance.test.js
   Tests de server/cryptoBinance.js : la source de donnees PRINCIPALE
   de la tuile "Cours Cryptos" (voir server/crypto.js pour l'ordre des
   sources et le pourquoi de Binance en priorite -- quota tres
   largement superieur a celui de CoinGecko sans cle).

   Un serveur HTTP local est demarre pour la duree du test (127.0.0.1,
   port libre attribue par l'OS), et global.fetch est redirige vers lui
   -- meme principe que test/webviewProxy.test.js. api.binance.com
   n'est de toute facon pas dans la liste blanche de ce bac a sable de
   developpement.
   ============================================================ */
const assert = require("assert");
const http = require("http");

function startFixtureServer() {
  const state = { tickerCalls: 0, klineCalls: 0, lastTickerUrl: null, lastKlineUrl: null };
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/v3/ticker/24hr")) {
      state.tickerCalls++;
      state.lastTickerUrl = req.url;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([
        { symbol: "BTCEUR", lastPrice: "52341.12", priceChangePercent: "2.34" },
        { symbol: "ETHEUR", lastPrice: "2890.55", priceChangePercent: "-1.10" }
      ]));
      return;
    }
    if (req.url.startsWith("/api/v3/klines")) {
      state.klineCalls++;
      state.lastKlineUrl = req.url;
      const rows = [];
      // Une bougie dont la cloture est illisible (champ vide chez
      // Binance quand la bougie vient de s'ouvrir) sert a verifier que
      // prix et instants sont filtres ensemble.
      // A candle with an unreadable close (empty field at Binance when
      // the candle has just opened) checks that prices and times are
      // filtered together.
      if (state.injectBadRow) rows.push([1756796400000, "0", "0", "0", "", "0", 0, "0", 0, "0", "0", "0"]);
      for (let i = 0; i < 12; i++) {
        // Index 0 = instant d'ouverture de la bougie, index 4 = cloture.
        // Index 0 = the candle's open time, index 4 = close.
        rows.push([1756800000000 + i * 3600000, "0", "0", "0", String(100 + i), "0", 0, "0", 0, "0", "0", "0"]);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, state, port: server.address().port }));
  });
}

(async () => {
  console.log("== pairFor : correspondance CoinGecko -> Binance, devise -> actif de cotation ==");
  {
    const binance = require("../server/cryptoBinance");
    assert.strictEqual(binance.pairFor("bitcoin", "eur"), "BTCEUR");
    assert.strictEqual(binance.pairFor("bitcoin", "usd"), "BTCUSDT",
      "le dollar US est approxime par USDT (Tether), Binance n'ayant pas de paire USD directe generalisee");
    assert.strictEqual(binance.pairFor("ethereum", "eur"), "ETHEUR");
    assert.strictEqual(binance.pairFor("crypto-totalement-inconnue-xyz", "eur"), null,
      "une crypto absente de la table de correspondance renvoie null -- signal de repli vers CoinGecko");
    console.log("  OK");
  }

  const { server, state, port } = await startFixtureServer();
  const base = "http://127.0.0.1:" + port;
  const realFetch = global.fetch;
  global.fetch = (url, opts) => realFetch(String(url).replace("https://api.binance.com", base), opts);

  try {
    const binance = require("../server/cryptoBinance");

    console.log("== fetchPrices : un seul appel groupe pour plusieurs cryptos ==");
    {
      const data = await binance.fetchPrices(["bitcoin", "ethereum"], "eur");
      assert.strictEqual(state.tickerCalls, 1, "un SEUL appel HTTP, quel que soit le nombre de cryptos demandees");
      assert.strictEqual(data.bitcoin.eur, 52341.12);
      assert.strictEqual(data.bitcoin.eur_24h_change, 2.34);
      assert.strictEqual(data.ethereum.eur, 2890.55);
      assert.strictEqual(data.ethereum.eur_24h_change, -1.1);
      console.log("  OK");
    }

    console.log("== fetchPrices : cryptos non reconnues silencieusement ecartees (pas d'erreur, juste absentes du resultat) ==");
    {
      const data = await binance.fetchPrices(["bitcoin", "crypto-inconnue-abc"], "eur");
      assert.ok(data.bitcoin, "la crypto reconnue est bien presente");
      assert.ok(!data["crypto-inconnue-abc"], "la crypto non reconnue est absente -- a l'appelant de la basculer vers CoinGecko");
      console.log("  OK");
    }

    console.log("== fetchPrices : liste entierement non reconnue -> objet vide, AUCUN appel HTTP ==");
    {
      const before = state.tickerCalls;
      const data = await binance.fetchPrices(["inconnue-1", "inconnue-2"], "eur");
      assert.deepStrictEqual(data, {});
      assert.strictEqual(state.tickerCalls, before, "aucune requete inutile vers Binance quand rien n'est reconnu");
      console.log("  OK");
    }

    console.log("== fetchChart : cloture de chaque bougie extraite (index 4 de la reponse Binance) ==");
    {
      const got = await binance.fetchChart("bitcoin", "eur", 1);
      assert.strictEqual(state.klineCalls, 1);
      assert.deepStrictEqual(got.prices, [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
      // Les instants accompagnent desormais les prix : ils portent l'axe
      // des abscisses du graphique (voir public/chart-time-axis.js).
      // Times now travel with the prices: they carry the chart's X axis
      // (see public/chart-time-axis.js).
      assert.strictEqual(got.times.length, got.prices.length,
        "autant d'instants que de prix -- une desynchronisation decalerait toute la courbe");
      assert.strictEqual(got.times[0], 1756800000000);
      assert.strictEqual(got.times[11], 1756800000000 + 11 * 3600000);
      console.log("  OK");
    }

    console.log("== fetchChart : intervalle/nombre de bougies adaptes a chaque duree proposee par la tuile ==");
    {
      await binance.fetchChart("bitcoin", "eur", 7);
      assert.ok(state.lastKlineUrl.includes("interval=1h") && state.lastKlineUrl.includes("limit=168"),
        "7 jours -> intervalle 1h, 168 bougies (7*24)");

      await binance.fetchChart("bitcoin", "eur", 365);
      assert.ok(state.lastKlineUrl.includes("interval=1d") && state.lastKlineUrl.includes("limit=365"),
        "1 an -> intervalle journalier, 365 bougies (un point par jour)");

      // Toujours tres en-dessous de la limite Binance de 1000 bougies
      // par requete, quelle que soit la duree -- aucune pagination
      // necessaire. Always well under Binance's 1000-candles-per-request
      // limit, whatever the duration -- no pagination needed.
      for (const days of [1, 7, 30, 365]) {
        const profile = binance.CHART_PROFILES[days];
        assert.ok(profile.limit <= 1000, "duree " + days + "j : " + profile.limit + " bougies, sous la limite Binance");
      }
      console.log("  OK");
    }

    console.log("== fetchChart : bougie incomplete ecartee SANS desynchroniser prix et instants ==");
    {
      state.injectBadRow = true;
      const got = await binance.fetchChart("bitcoin", "eur", 1);
      state.injectBadRow = false;
      assert.strictEqual(got.prices.length, got.times.length,
        "filtrage conjoint : une cloture illisible retire aussi son instant");
      assert.ok(!got.prices.some((v) => !Number.isFinite(v)), "aucune cloture illisible ne passe");
      assert.strictEqual(got.times[0], 1756800000000, "les instants restent alignes sur leurs prix");
    }
    console.log("  OK");

    console.log("== fetchChart : crypto non reconnue -> null (PAS d'exception), signal de repli explicite ==");
    {
      const before = state.klineCalls;
      const result = await binance.fetchChart("crypto-inconnue-xyz", "eur", 1);
      assert.strictEqual(result, null);
      assert.strictEqual(state.klineCalls, before, "aucune requete inutile vers Binance pour une crypto non reconnue");
      console.log("  OK");
    }

    console.log("\n>>> TOUS LES TESTS CRYPTOBINANCE PASSENT");
  } finally {
    global.fetch = realFetch;
    server.close();
  }
})();
