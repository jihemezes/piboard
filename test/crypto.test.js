"use strict";
/* ============================================================
   PiBoard - test/crypto.test.js
   Tests de server/crypto.js : le proxy crypto hybride de la tuile
   "Cours Cryptos" -- Binance en source PRINCIPALE (quota tres
   largement superieur), CoinGecko en REPLI pour tout ce que Binance ne
   couvre pas (voir server/cryptoBinance.js pour la table de
   correspondance) ou quand Binance echoue ponctuellement.

   Un serveur HTTP local est demarre pour la duree du test (127.0.0.1,
   port libre attribue par l'OS), servant a la fois les chemins
   Binance et CoinGecko (ils ne se recouvrent pas) -- global.fetch est
   redirige vers lui pour les deux hotes. Meme principe que
   test/webviewProxy.test.js et test/cryptoBinance.test.js :
   deterministe, sans dependre du reseau externe (que ce bac a sable de
   developpement ne peut de toute facon pas atteindre).

   "bitcoin" et "ethereum" sont reconnus par Binance (voir la table de
   server/cryptoBinance.js) ; "piece-hors-binance" et autres
   identifiants invente ne le sont pas et passent systematiquement par
   CoinGecko -- c'est cette difference qui permet de tester les deux
   chemins independamment, et leur combinaison.

   L'expiration du cache (TTL) est simulee via le parametre "deps.now"
   accepte par getPrices()/getChart() -- meme principe que
   teleProgram.js:loadGrid(config, deps).
   ============================================================ */
const assert = require("assert");
const http = require("http");

function startFixtureServer() {
  const state = {
    binancePriceCalls: 0, binanceChartCalls: 0,
    geckoPriceCalls: 0, geckoChartCalls: 0,
    blockBinancePrices: false, blockBinanceCharts: false,
    blockGeckoPrices: false, blockGeckoCharts: false
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api/v3/ticker/24hr") {
      state.binancePriceCalls++;
      if (state.blockBinancePrices) { res.writeHead(500); res.end("boom"); return; }
      const symbols = JSON.parse(url.searchParams.get("symbols") || "[]");
      const rows = symbols
        .filter((s) => s.startsWith("BTC") || s.startsWith("ETH"))
        .map((s) => ({ symbol: s, lastPrice: s.startsWith("BTC") ? "50000" : "3000", priceChangePercent: "1.0" }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    if (url.pathname === "/api/v3/klines") {
      state.binanceChartCalls++;
      if (state.blockBinanceCharts) { res.writeHead(500); res.end("boom"); return; }
      const rows = [[0, "0", "0", "0", "200", "0", 0, "0", 0, "0", "0", "0"]];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    if (url.pathname === "/api/v3/simple/price") {
      state.geckoPriceCalls++;
      if (state.blockGeckoPrices) { res.writeHead(429); res.end("rate limited"); return; }
      const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
      const currency = url.searchParams.get("vs_currencies") || "eur";
      const data = {};
      for (const id of ids) data[id] = { [currency]: 42, [currency + "_24h_change"]: 3.3 };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }
    if (url.pathname.includes("/market_chart")) {
      state.geckoChartCalls++;
      if (state.blockGeckoCharts) { res.writeHead(429); res.end("rate limited"); return; }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ prices: [[1, 300], [2, 301]] }));
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
  const { server, state, port } = await startFixtureServer();
  const base = "http://127.0.0.1:" + port;
  const realFetch = global.fetch;
  global.fetch = (url, opts) => realFetch(
    String(url).replace("https://api.binance.com", base).replace("https://api.coingecko.com/api/v3", base + "/api/v3"),
    opts
  );

  const crypto = require("../server/crypto");
  const T0 = 1_700_000_000_000;

  try {
    console.log("== getPrices : une crypto reconnue par Binance passe UNIQUEMENT par Binance (CoinGecko jamais sollicite) ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 });
      assert.strictEqual(r.stale, false);
      assert.strictEqual(r.data.bitcoin.eur, 50000);
      assert.strictEqual(state.binancePriceCalls, 1, "Binance interroge");
      assert.strictEqual(state.geckoPriceCalls, 0,
        "CoinGecko n'est JAMAIS sollicite pour une crypto que Binance sait fournir -- c'est le coeur du correctif");
      console.log("  OK");
    }

    console.log("== getPrices : une crypto absente de Binance passe par CoinGecko, sans jamais appeler Binance pour elle ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const r = await crypto.getPrices(["piece-hors-binance"], "eur", { now: T0 });
      assert.strictEqual(r.stale, false);
      assert.strictEqual(r.data["piece-hors-binance"].eur, 42);
      assert.strictEqual(state.geckoPriceCalls, 1, "CoinGecko interroge en repli");
      console.log("  OK");
    }

    console.log("== getPrices : lot mixte (une crypto Binance + une crypto CoinGecko) -> chaque source ne recoit que ce qui la concerne ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const beforeBinance = state.binancePriceCalls;
      const beforeGecko = state.geckoPriceCalls;
      const r = await crypto.getPrices(["bitcoin", "piece-hors-binance"], "eur", { now: T0 });
      assert.strictEqual(r.data.bitcoin.eur, 50000, "cote Binance");
      assert.strictEqual(r.data["piece-hors-binance"].eur, 42, "cote CoinGecko");
      assert.strictEqual(state.binancePriceCalls, beforeBinance + 1);
      assert.strictEqual(state.geckoPriceCalls, beforeGecko + 1);
      console.log("  OK");
    }

    console.log("== getPrices : Binance echoue pour une crypto qu'il reconnait -> repli automatique et transparent sur CoinGecko ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      state.blockBinancePrices = true;
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 });
      state.blockBinancePrices = false;
      assert.strictEqual(r.stale, false, "CoinGecko a fourni une donnee fraiche, pas un repli sur du perime");
      assert.strictEqual(r.data.bitcoin.eur, 42, "vient bien de CoinGecko (prix mock distinct de celui de Binance)");
      console.log("  OK");
    }

    console.log("== getPrices : cache par crypto INDIVIDUELLE -- une partie du lot peut rester en cache pendant que le reste est rafraichi ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      await crypto.getPrices(["bitcoin"], "eur", { now: T0 }); // met "bitcoin" en cache
      const beforeBinance = state.binancePriceCalls;
      const beforeGecko = state.geckoPriceCalls;
      // "piece-hors-binance" n'a encore jamais ete demandee : doit
      // declencher un appel, SANS re-solliciter Binance pour "bitcoin"
      // (deja frais en cache).
      const r = await crypto.getPrices(["bitcoin", "piece-hors-binance"], "eur", { now: T0 + 5000 });
      assert.strictEqual(r.data.bitcoin.eur, 50000, "toujours la valeur mise en cache");
      assert.strictEqual(state.binancePriceCalls, beforeBinance,
        "AUCUN nouvel appel Binance : 'bitcoin' etait deja frais en cache");
      assert.strictEqual(state.geckoPriceCalls, beforeGecko + 1, "seule la crypto manquante declenche un appel");
      console.log("  OK");
    }

    console.log("== getPrices : les DEUX sources echouent pour une crypto avec un cache existant -> repli sur la derniere valeur connue ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      await crypto.getPrices(["bitcoin"], "eur", { now: T0 });

      state.blockBinancePrices = true;
      state.blockGeckoPrices = true;
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 + 90 * 1000 }); // TTL (60s) depasse
      state.blockBinancePrices = false;
      state.blockGeckoPrices = false;

      assert.strictEqual(r.stale, true, "signale explicitement que la donnee est perimee");
      assert.strictEqual(r.data.bitcoin.eur, 50000,
        "les cours restent ceux de la derniere reussite -- une panne des DEUX sources ne doit pas faire disparaitre des cours valables");
      console.log("  OK");
    }

    console.log("== getPrices : les DEUX sources echouent, AUCUN cache prealable -> erreur exploitable ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      state.blockBinancePrices = true;
      state.blockGeckoPrices = true;
      try {
        await crypto.getPrices(["piece-jamais-vue-du-tout"], "eur", { now: T0 });
        assert.fail("aurait du echouer");
      } catch (e) {
        assert.ok(String(e.message || e).length > 0);
      }
      state.blockBinancePrices = false;
      state.blockGeckoPrices = false;
      console.log("  OK");
    }

    console.log("== getChart : crypto reconnue par Binance -> Binance uniquement, CoinGecko jamais sollicite ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const r = await crypto.getChart("bitcoin", "eur", 1, { now: T0 });
      assert.strictEqual(r.stale, false);
      assert.deepStrictEqual(r.prices, [200]);
      assert.strictEqual(state.geckoChartCalls, 0);
      console.log("  OK");
    }

    console.log("== getChart : crypto absente de Binance -> CoinGecko directement ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const r = await crypto.getChart("piece-hors-binance", "eur", 1, { now: T0 });
      assert.deepStrictEqual(r.prices, [300, 301]);
      assert.strictEqual(state.geckoChartCalls, 1);
      console.log("  OK");
    }

    console.log("== getChart : Binance echoue pour une crypto qu'il reconnait -> repli automatique sur CoinGecko ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      state.blockBinanceCharts = true;
      const r = await crypto.getChart("bitcoin", "eur", 1, { now: T0 });
      state.blockBinanceCharts = false;
      assert.deepStrictEqual(r.prices, [300, 301], "vient bien de CoinGecko (serie mock distincte de celle de Binance)");
      console.log("  OK");
    }

    console.log("== getChart : les DEUX sources echouent avec un cache existant -> repli sur la derniere serie connue ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      await crypto.getChart("bitcoin", "eur", 30, { now: T0 });

      state.blockBinanceCharts = true;
      state.blockGeckoCharts = true;
      const r = await crypto.getChart("bitcoin", "eur", 30, { now: T0 + 11 * 60 * 1000 }); // TTL (10 min) depasse
      state.blockBinanceCharts = false;
      state.blockGeckoCharts = false;

      assert.strictEqual(r.stale, true);
      assert.deepStrictEqual(r.prices, [200], "la courbe deja tracee reste affichee plutot que de disparaitre");
      console.log("  OK");
    }

    console.log("== getChart : les DEUX sources echouent, AUCUN cache prealable -> erreur exploitable ==");
    {
      crypto._resetThrottleForTests();
      state.blockBinanceCharts = true;
      state.blockGeckoCharts = true;
      try {
        await crypto.getChart("bitcoin", "eur", 7, { now: T0 }); // "7" = cle de cache differente, jamais vue
        assert.fail("aurait du echouer");
      } catch (e) {
        assert.ok(String(e.message || e).length > 0);
      }
      state.blockBinanceCharts = false;
      state.blockGeckoCharts = false;
      console.log("  OK");
    }

    console.log("== Espacement minimal entre appels CoinGecko UNIQUEMENT (Binance n'y est pas soumis) ==");
    {
      crypto.clearCache(); crypto._resetThrottleForTests();
      const start = Date.now();
      await Promise.all([
        crypto.getChart("piece-hors-binance-a", "eur", 1),
        crypto.getChart("piece-hors-binance-b", "eur", 1)
      ]);
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= crypto.MIN_SPACING_MS - 50,
        "les deux appels CoinGecko sont espaces d'au moins MIN_SPACING_MS, ecoule: " + elapsed + "ms");
      console.log("  OK (ecoule: " + elapsed + "ms, minimum attendu: " + crypto.MIN_SPACING_MS + "ms)");
    }

    console.log("\n>>> TOUS LES TESTS CRYPTO PASSENT");
  } finally {
    global.fetch = realFetch;
    server.close();
  }
})();
