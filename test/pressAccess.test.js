/* PiBoard - test/pressAccess.test.js
   Abonnements presse (1.141.0) : fonctions pures, persistance, et
   lecture d'article via une session (simulee) -- sans reseau.
   Press subscriptions: pure functions, persistence, and article reading
   through a (simulated) session -- offline. */
"use strict";
const assert = require("assert");
const press = require("../server/pressAccess");
const { extractWithSession } = require("../server/articleExtract");

(async () => {
  console.log("== normalizeDomain : ce que l'utilisateur tape devient un domaine nu ==");
  assert.strictEqual(press.normalizeDomain("https://www.LeMonde.fr/une"), "lemonde.fr");
  assert.strictEqual(press.normalizeDomain("lefigaro.fr"), "lefigaro.fr");
  assert.strictEqual(press.normalizeDomain("abonnes.ladepeche.fr"), "abonnes.ladepeche.fr");
  assert.strictEqual(press.normalizeDomain("pas un site"), null);
  assert.strictEqual(press.normalizeDomain(""), null);
  assert.strictEqual(press.normalizeDomain("localhost"), null, "un nom sans point n'est pas un site de presse");
  console.log("  OK");

  console.log("== accountForUrl : sous-domaines oui, faux domaine non ==");
  const accounts = [{ domain: "lemonde.fr", name: "Le Monde" }];
  assert.ok(press.accountForUrl(accounts, "https://www.lemonde.fr/article/x.html"));
  assert.ok(press.accountForUrl(accounts, "https://abonnes.lemonde.fr/x"));
  assert.ok(press.accountForUrl(accounts, "https://lemonde.fr/"));
  assert.strictEqual(press.accountForUrl(accounts, "https://fauxlemonde.fr/x"), null,
    "un domaine qui se termine par le meme texte ne doit PAS profiter de la session");
  assert.strictEqual(press.accountForUrl(accounts, "https://lemonde.fr.evil.com/x"), null);
  assert.strictEqual(press.accountForUrl(accounts, "pas une url"), null);
  console.log("  OK");

  console.log("== premiumFromHtml : la donnee schema.org des editeurs ==");
  assert.strictEqual(press.premiumFromHtml('{"isAccessibleForFree":false}'), true);
  assert.strictEqual(press.premiumFromHtml('{"isAccessibleForFree": "False"}'), true);
  assert.strictEqual(press.premiumFromHtml('{"isAccessibleForFree":true}'), false);
  assert.strictEqual(press.premiumFromHtml("<html>rien</html>"), null);
  console.log("  OK");

  console.log("== looksLikePaywallPreview : fin d'apercu reconnue ==");
  assert.ok(press.looksLikePaywallPreview("... Il vous reste 78 % de cet article à lire. La suite est réservée aux abonnés."));
  assert.ok(press.looksLikePaywallPreview("Article réservé aux abonnés"));
  assert.ok(!press.looksLikePaywallPreview("Un article ordinaire sur les abonnés du métro."));
  assert.ok(!press.looksLikePaywallPreview("Article réservé aux abonnés : la mention au DEBUT ne compte pas. " + "Suite normale. ".repeat(80)),
    "seule la fin du texte compte");
  console.log("  OK");

  console.log("== Persistance : ajout depuis un preset, saisie libre, doublon, retrait ==");
  const mem = {};
  const store = { read: (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d), write: (k, v) => { mem[k] = v; } };
  let r = press.addAccount(store, { domain: "lemonde.fr" });
  assert.ok(r.ok);
  assert.strictEqual(r.accounts[0].name, "Le Monde");
  assert.ok(/^https:\/\/secure\.lemonde\.fr\//.test(r.accounts[0].loginUrl), "page de connexion verifiee du preset");
  r = press.addAccount(store, { domain: "https://www.lemonde.fr/" });
  assert.strictEqual(r.accounts.length, 1, "pas de doublon");
  r = press.addAccount(store, { domain: "exemple-presse.fr", loginUrl: "https://evil.com/login" });
  assert.strictEqual(r.accounts[1].loginUrl, "https://www.exemple-presse.fr/",
    "une page de connexion hors du site est refusee");
  assert.strictEqual(press.addAccount(store, { domain: "n'importe quoi" }).reason, "invalid-domain");
  press.recordRead(store, "lemonde.fr", true);
  assert.strictEqual(press.readAccounts(store)[0].lastRead.full, true);
  assert.deepStrictEqual(press.removeAccount(store, "lemonde.fr").map((a) => a.domain), ["exemple-presse.fr"]);
  console.log("  OK");

  console.log("== Lecture avec session : article complet, session expiree, echec ==");
  const body = "<p>" + "Texte complet de l'article, paragraphe ordinaire. ".repeat(20) + "</p>";
  const page = (inner, free) => `<html><head><title>T</title>
    <script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":${free}}</script>
    </head><body><article><h1>Titre</h1>${inner}</article></body></html>`;

  let a = await extractWithSession("https://www.lemonde.fr/a.html", async () => page(body, false));
  assert.ok(a && a.viaSubscription, "lu par la session");
  assert.strictEqual(a.premium, true);
  assert.strictEqual(a.partial, false, "article payant lu en entier");
  assert.strictEqual(a.sessionExpired, false);

  a = await extractWithSession("https://www.lemonde.fr/a.html",
    async () => page(body + "<p>Il vous reste 80 % de cet article à lire. La suite est réservée aux abonnés.</p>", false));
  assert.strictEqual(a.partial, true);
  assert.strictEqual(a.sessionExpired, true, "payant + apercu = session expiree");

  a = await extractWithSession("https://www.lemonde.fr/a.html", async () => { throw new Error("timeout"); });
  assert.strictEqual(a, null, "un echec de session rend la main au chemin ordinaire");
  console.log("  OK");

  console.log("\n>>> TOUS LES TESTS PRESSACCESS PASSENT");
})().catch((e) => { console.error(e); process.exit(1); });
