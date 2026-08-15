"use strict";
/* ============================================================
   PiBoard - test/crypto.test.js
   Tests de server/crypto.js : le proxy CoinGecko cote serveur, dont le
   but est d'eviter le tres faible quota de l'API publique sans cle
   (5-15 requetes/minute, PAR ADRESSE IP -- partagee par tout le foyer)
   -- cause reelle des echecs frequents et imprevisibles signales sur
   la tuile "Cours Cryptos".

   Un serveur HTTP local est demarre pour la duree du test (127.0.0.1,
   port libre attribue par l'OS), et global.fetch est redirige vers lui
   le temps du test -- meme principe que test/webviewProxy.test.js et
   test/webviewShot.test.js : deterministe, sans dependre du reseau
   externe (que ce bac a sable de developpement ne peut de toute facon
   pas atteindre -- api.coingecko.com n'est pas dans la liste blanche).

   L'expiration du cache (TTL) est simulee via le parametre "deps.now"
   accepte par getPrices()/getChart() -- meme principe que
   teleProgram.js:loadGrid(config, deps) -- plutot que d'attendre
   reellement 1 a 10 minutes dans la suite de tests.
   ============================================================ */
const assert = require("assert");
const http = require("http");

function startFixtureServer() {
  const state = { priceCalls: 0, chartCalls: 0, blockPrices: false, blockCharts: false, priceValue: 50000 };
  const server = http.createServer((req, res) => {
    if (req.url.includes("/simple/price")) {
      state.priceCalls++;
      if (state.blockPrices) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "rate limited" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ bitcoin: { eur: state.priceValue, eur_24h_change: 1.5 } }));
      return;
    }
    if (req.url.includes("/market_chart")) {
      state.chartCalls++;
      if (state.blockCharts) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "rate limited" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ prices: [[1, 100], [2, 101], [3, 99]] }));
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
  global.fetch = (url, opts) => realFetch(String(url).replace("https://api.coingecko.com", base), opts);

  const crypto = require("../server/crypto");
  const T0 = 1_700_000_000_000; // instant de reference arbitraire mais fixe / arbitrary but fixed reference instant

  try {
    console.log("== getPrices : interroge reellement la source au 1er appel ==");
    {
      crypto.clearCache();
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 });
      assert.strictEqual(r.stale, false, "premier appel : donnee fraiche, pas un repli");
      assert.strictEqual(r.data.bitcoin.eur, 50000);
      assert.strictEqual(state.priceCalls, 1, "un seul appel sortant pour ce premier appel");
      console.log("  OK");
    }

    console.log("== getPrices : un 2e appel dans la fenetre du TTL vient du cache (pas de nouvel appel sortant) ==");
    {
      const before = state.priceCalls;
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 + 30 * 1000 }); // +30s, TTL = 60s
      assert.strictEqual(r.stale, false);
      assert.strictEqual(state.priceCalls, before,
        "AUCUN appel sortant supplementaire : c'est precisement ce qui protege le quota CoinGecko (5-15/min) quand plusieurs ecrans/onglets PiBoard sont ouverts");
      console.log("  OK");
    }

    console.log("== getPrices : cle de cache distincte par devise ET par liste de pieces ==");
    {
      const before = state.priceCalls;
      await crypto.getPrices(["bitcoin"], "usd", { now: T0 }); // devise differente -> pas le meme cache
      await crypto.getPrices(["bitcoin", "ethereum"], "eur", { now: T0 }); // liste differente -> pas le meme cache
      assert.strictEqual(state.priceCalls, before + 2, "2 nouveaux appels, un par combinaison reellement differente");
      console.log("  OK");
    }

    console.log("== getPrices : le TTL expire -> re-interroge reellement la source (donnee toujours fraiche si ca reussit) ==");
    {
      crypto.clearCache();
      await crypto.getPrices(["bitcoin"], "eur", { now: T0 });
      const before = state.priceCalls;
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 + 90 * 1000 }); // +90s > TTL (60s)
      assert.strictEqual(state.priceCalls, before + 1, "TTL depasse : un nouvel appel sortant a bien lieu");
      assert.strictEqual(r.stale, false);
      console.log("  OK");
    }

    console.log("== getPrices : TTL expire ET source en panne (429) -> repli sur la derniere valeur connue, signale 'stale' ==");
    {
      crypto.clearCache();
      const fresh = await crypto.getPrices(["bitcoin"], "eur", { now: T0 });
      assert.strictEqual(fresh.stale, false);
      assert.strictEqual(fresh.data.bitcoin.eur, 50000);

      state.blockPrices = true;
      const r = await crypto.getPrices(["bitcoin"], "eur", { now: T0 + 90 * 1000 }); // TTL depasse -> tente vraiment la source
      state.blockPrices = false;

      assert.strictEqual(r.stale, true, "signale explicitement que la donnee affichee est perimee");
      assert.strictEqual(r.data.bitcoin.eur, 50000,
        "les cours restent ceux de la derniere reussite -- c'est le coeur du correctif : une panne momentanee de CoinGecko ne doit plus faire disparaitre des cours valables");
      console.log("  OK");
    }

    console.log("== getPrices : TTL expire ET source en panne, mais AUCUN cache prealable -> erreur exploitable remontee ==");
    {
      crypto.clearCache();
      state.blockPrices = true;
      try {
        await crypto.getPrices(["une-piece-jamais-vue"], "eur", { now: T0 });
        assert.fail("aurait du echouer (rien a servir en repli)");
      } catch (e) {
        assert.ok(String(e.message || e).length > 0, "message d'erreur exploitable fourni");
      }
      state.blockPrices = false;
      console.log("  OK");
    }

    console.log("== getChart : interroge reellement la source au 1er appel, met en cache par piece+devise+periode ==");
    {
      crypto.clearCache();
      const r = await crypto.getChart("bitcoin", "eur", 1, { now: T0 });
      assert.strictEqual(r.stale, false);
      assert.deepStrictEqual(r.prices, [100, 101, 99]);
      assert.strictEqual(state.chartCalls, 1);

      const before = state.chartCalls;
      await crypto.getChart("bitcoin", "eur", 1, { now: T0 + 60 * 1000 }); // dans le TTL (10 min)
      assert.strictEqual(state.chartCalls, before, "meme periode/piece/devise, dans le TTL : servi depuis le cache");

      await crypto.getChart("bitcoin", "eur", 7, { now: T0 });
      assert.strictEqual(state.chartCalls, before + 1, "periode differente (7j au lieu de 24h) : nouvel appel, cle de cache distincte");
      console.log("  OK");
    }

    console.log("== getChart : TTL expire ET source en panne -> repli sur la derniere serie connue, signale 'stale' ==");
    {
      crypto.clearCache();
      const fresh = await crypto.getChart("bitcoin", "eur", 30, { now: T0 });
      assert.strictEqual(fresh.stale, false);

      state.blockCharts = true;
      const r = await crypto.getChart("bitcoin", "eur", 30, { now: T0 + 11 * 60 * 1000 }); // +11 min > TTL (10 min)
      state.blockCharts = false;

      assert.strictEqual(r.stale, true);
      assert.deepStrictEqual(r.prices, [100, 101, 99], "la courbe deja tracee reste affichee plutot que de disparaitre");
      console.log("  OK");
    }

    console.log("== getChart : TTL expire ET panne, sans aucun cache -> erreur exploitable, jamais un plantage ==");
    {
      state.blockCharts = true;
      try {
        await crypto.getChart("autre-piece-jamais-vue", "eur", 1, { now: T0 });
        assert.fail("aurait du echouer");
      } catch (e) {
        assert.ok(String(e.message || e).length > 0);
      }
      state.blockCharts = false;
      console.log("  OK");
    }

    console.log("== Espacement minimal entre appels sortants (protege le quota CoinGecko en cas de rafale) ==");
    {
      crypto.clearCache();
      const start = Date.now();
      // Deux entrees JAMAIS VUES (cles de cache distinctes) demandees en
      // parallele : la 2e doit attendre l'espacement minimal avant de
      // partir, meme si les deux sont lancees en meme temps -- ceci
      // utilise le VRAI Date.now() (pas le "now" simule ci-dessus, qui ne
      // sert qu'a l'age du cache) puisque c'est l'espacement REEL entre
      // deux appels HTTP sortants qui est mesure ici.
      // Two NEVER-SEEN entries (distinct cache keys) requested in
      // parallel: the 2nd must wait for the minimum spacing before
      // firing, even though both are launched at the same time -- this
      // uses REAL Date.now() (not the simulated "now" above, which only
      // affects cache age) since it's the ACTUAL spacing between two
      // outbound HTTP calls being measured here.
      await Promise.all([
        crypto.getChart("piece-a", "eur", 1),
        crypto.getChart("piece-b", "eur", 1)
      ]);
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= crypto.MIN_SPACING_MS - 50,
        "les deux appels sont espaces d'au moins MIN_SPACING_MS (" + crypto.MIN_SPACING_MS + "ms), ecoule: " + elapsed + "ms");
      console.log("  OK (ecoule: " + elapsed + "ms, minimum attendu: " + crypto.MIN_SPACING_MS + "ms)");
    }

    console.log("\n>>> TOUS LES TESTS CRYPTO PASSENT");
  } finally {
    global.fetch = realFetch;
    server.close();
  }
})();
