"use strict";
/* ============================================================
   PiBoard - test/webviewProxy.test.js
   Tests de server/webviewProxy.js : le contournement du blocage
   d'affichage en iframe (X-Frame-Options/CSP) que la plupart des
   sites -- les sites municipaux francais en particulier -- posent
   desormais par defaut, cause reelle signalee d'une tuile "Page web"
   qui reste silencieusement blanche.

   Un serveur HTTP local est demarre pour la duree du test (127.0.0.1,
   port libre attribue par l'OS) afin de simuler ces cas reels sans
   dependre du reseau externe -- deterministe, utilisable sur
   n'importe quelle machine de developpement/CI. Meme principe que
   test/cameraStream.test.js.
   ============================================================ */
const assert = require("assert");
const http = require("http");
const webviewProxy = require("../server/webviewProxy");

function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/blocked") {
      // Simule un site qui bloque l'affichage en iframe (X-Frame-Options
      // + CSP), mais repond normalement a une requete HTTP directe --
      // exactement le cas reel signale (mairie sous RGS/ANSSI).
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'"
      });
      res.end('<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><link rel="stylesheet" href="/style.css"><title>Mairie Test</title></head><body><img src="/logo.png"><h1>Bienvenue a la mairie</h1></body></html>');
      return;
    }
    if (req.url === "/only-browser-ua") {
      // Bloque le premier identifiant (honnete), accepte le repli
      // navigateur -- verifie que la strategie a deux temps fonctionne.
      const ua = req.headers["user-agent"] || "";
      if (ua.includes("PiBoard-ReaderMode")) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("blocked");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><head></head><body>Contenu via repli</body></html>");
      return;
    }
    if (req.url === "/not-html") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  console.log("== rewriteHtml : injection de <base>, retrait de la CSP en <meta> ==");
  {
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><title>T</title></head><body>x</body></html>';
    const out = webviewProxy.rewriteHtml(html, "https://exemple.test/page");
    assert.ok(out.includes('<base href="https://exemple.test/page">'), "balise <base> injectee avec l'URL finale");
    assert.ok(out.indexOf("<base") < out.indexOf("<title>"), "la balise <base> precede le reste du <head> (doit etre la 1ere)");
    assert.ok(!/http-equiv=["']?content-security-policy/i.test(out), "la CSP posee en <meta> par le site source est retiree");
    assert.ok(out.includes("<body>x</body>"), "le reste du contenu est preserve tel quel");
    console.log("  OK");
  }

  console.log("== rewriteHtml : document sans <head> bien forme -> <base> quand meme injectee ==");
  {
    const out = webviewProxy.rewriteHtml("<body>sans tete</body>", "https://exemple.test/");
    assert.ok(out.startsWith('<base href="https://exemple.test/">'), "repli : <base> ajoutee en tete de document");
    console.log("  OK");
  }

  console.log("== rewriteHtml : guillemets dans l'URL correctement echappes dans l'attribut ==");
  {
    const out = webviewProxy.rewriteHtml("<head></head>", 'https://exemple.test/?a="x"');
    assert.ok(out.includes("&quot;x&quot;"), "guillemets de l'URL echappes, pas d'echappement de balise possible");
    console.log("  OK");
  }

  console.log("== errorPageHtml : message lisible et echappe, pour affichage direct dans l'iframe ==");
  {
    const out = webviewProxy.errorPageHtml({ status: 404, type: "text/plain" });
    assert.ok(out.includes("<html"), "page HTML complete (affichable directement dans une iframe)");
    assert.ok(out.includes("404"), "code de statut visible dans le message");
    const xss = webviewProxy.errorPageHtml("<script>alert(1)</script>");
    assert.ok(!xss.includes("<script>alert"), "le detail de l'erreur est echappe (pas d'injection HTML)");
    console.log("  OK");
  }

  console.log("== normalizeUrl : complete 'https://' quand absent (reflexe de barre d'adresse) ==");
  {
    assert.strictEqual(webviewProxy.normalizeUrl("mairiederouffiac.fr"), "https://mairiederouffiac.fr",
      "domaine seul, sans schema -> https:// ajoute");
    assert.strictEqual(webviewProxy.normalizeUrl("www.mairiederouffiac.fr"), "https://www.mairiederouffiac.fr",
      "domaine avec www., sans schema -> https:// ajoute");
    assert.strictEqual(webviewProxy.normalizeUrl("https://deja-complete.test/"), "https://deja-complete.test/",
      "schema https deja present -> inchange");
    assert.strictEqual(webviewProxy.normalizeUrl("http://deja-complete.test/"), "http://deja-complete.test/",
      "schema http deja present -> inchange (pas force en https)");
    assert.strictEqual(webviewProxy.normalizeUrl("  mairiederouffiac.fr  "), "https://mairiederouffiac.fr",
      "espaces en trop retires avant completion");
    assert.strictEqual(webviewProxy.normalizeUrl(""), "", "chaine vide laissee telle quelle");
    console.log("  OK");
  }

  console.log("== proxyPage : URL invalide (chaine non parsable, meme apres completion du schema) rejetee proprement ==");
  {
    // Espaces : reste syntaxiquement invalide meme apres l'ajout de
    // "https://" par normalizeUrl -- contrairement a un simple nom de
    // domaine sans schema (voir plus bas), qui lui devient une URL
    // valide une fois complete.
    // Spaces: stays syntactically invalid even after normalizeUrl adds
    // "https://" -- unlike a plain domain name with no scheme (see
    // below), which becomes a valid URL once completed.
    let r = await webviewProxy.proxyPage("ceci n'est pas une url");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 400);

    r = await webviewProxy.proxyPage("");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 400);

    r = await webviewProxy.proxyPage("ftp://exemple.test/fichier");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 400);
    console.log("  OK");
  }

  const server = await startFixtureServer();
  const base = "http://127.0.0.1:" + server.address().port;

  try {
    console.log("== proxyPage : URL sans schema (cas reel signale : 'invalid url' malgre un site valide) ==");
    {
      // Sans "http(s)://" -- typiquement "mairiederouffiac.fr" tape par
      // reflexe de barre d'adresse -- ne doit PLUS jamais echouer avec
      // "invalid url" des la validation. normalizeUrl la complete
      // d'abord en "https://<host>/blocked", qui atteint ensuite
      // reellement la couche reseau (et echoue la pour une tout autre
      // raison : le serveur de test ne parle que du HTTP simple, pas
      // HTTPS -- ce qui prouve justement que la requete a bien ete
      // tentee, au lieu d'etre rejetee en amont).
      // With no "http(s)://" -- typically "mairiederouffiac.fr" typed
      // out of address-bar habit -- must NEVER again fail with
      // "invalid url" at validation. normalizeUrl completes it first
      // into "https://<host>/blocked", which then genuinely reaches the
      // network layer (and fails there for an entirely different
      // reason: the test server only speaks plain HTTP, not HTTPS --
      // which is exactly what proves the request was actually
      // attempted, rather than rejected upfront).
      const hostOnly = base.replace(/^https?:\/\//, "");
      const r = await webviewProxy.proxyPage(hostOnly + "/blocked");
      assert.notStrictEqual(r.status, 400, "n'est plus rejetee des la validation comme une 'invalid url'");
      assert.strictEqual(r.ok, false, "echoue bien plus loin, au niveau reseau (pas de HTTPS sur ce serveur de test)");
      assert.strictEqual(r.status, 502, "echec de type reseau (502), pas de validation (400)");
    }
    console.log("  OK");

    console.log("== proxyPage : site qui bloque le framing (X-Frame-Options + CSP) -- cas reel signale ==");
    {
      const r = await webviewProxy.proxyPage(base + "/blocked");
      assert.strictEqual(r.ok, true, "la recuperation cote serveur reussit malgre le blocage d'affichage en iframe");
      assert.ok(r.html.includes("Bienvenue a la mairie"), "contenu de la page present");
      assert.ok(r.html.includes("<base href="), "balise <base> presente pour que les ressources relatives (CSS/images) se chargent toujours depuis le vrai site");
      assert.ok(!/http-equiv=["']?content-security-policy/i.test(r.html), "CSP en <meta> du site source retiree");
    }
    console.log("  OK");

    console.log("== proxyPage : repli sur l'identifiant navigateur si l'identifiant honnete est bloque ==");
    {
      const r = await webviewProxy.proxyPage(base + "/only-browser-ua");
      assert.strictEqual(r.ok, true, "le 2e essai (user-agent navigateur) reussit la ou le 1er (honnete) echoue");
      assert.ok(r.html.includes("Contenu via repli"));
    }
    console.log("  OK");

    console.log("== proxyPage : page introuvable -> echec propre avec detail exploitable ==");
    {
      const r = await webviewProxy.proxyPage(base + "/not-found");
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.status, 502);
      assert.ok(r.error, "detail d'erreur fourni pour construire un message lisible");
    }
    console.log("  OK");

    console.log("== proxyPage : reponse non-HTML (JSON) -> pas relayee telle quelle ==");
    {
      const r = await webviewProxy.proxyPage(base + "/not-html");
      assert.strictEqual(r.ok, false, "un type de contenu non-HTML n'est pas presente comme une page web");
    }
    console.log("  OK");
  } finally {
    server.close();
  }

  console.log("\n>>> TOUS LES TESTS WEBVIEWPROXY PASSENT");
})();
