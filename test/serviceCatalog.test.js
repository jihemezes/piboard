/* Tests du catalogue de services sorti du code (server/serviceCatalog.js).

   CE QUI EST VERIFIE EN PRIORITE. Pas le cas nominal -- un JSON correct
   est accepte, il n'y a rien a demontrer -- mais le REFUS. Ce fichier
   decide des adresses que le serveur PiBoard ira interroger : un
   catalogue distant est donc une donnee hostile par defaut, et la
   question n'est pas « sait-on lire un bon catalogue » mais « rejette-
   t-on tout ce qui n'en est pas un ».

   TOUT EST HORS LIGNE : la validation est une fonction pure, et c'est
   precisement pour cela qu'elle a ete ecrite a part.

   What is checked first is not the nominal case but the REFUSAL: this
   file decides which addresses the PiBoard server will query, so a
   remote catalogue is hostile data by default. Everything is offline:
   the validation is a pure function, which is exactly why it was
   written separately. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const C = require("../server/serviceCatalog");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

const GOOD = {
  version: 9,
  families: [
    { id: "cloud", label: { fr: "Cloud", en: "Cloud" } },
    { id: "custom", label: { fr: "Mes services", en: "My services" } }
  ],
  services: [
    { id: "github", name: "GitHub", family: "cloud", url: "https://www.githubstatus.com", adapter: "statuspage" },
    { id: "aws", name: "AWS", family: "cloud", url: "https://health.aws.amazon.com/health/status", adapter: "aws", api: "https://health.aws.amazon.com/public/currentevents" }
  ]
};
const clone = (o) => JSON.parse(JSON.stringify(o));

console.log("== Le catalogue livre avec la version est lui-meme valide ==");

/* Si le catalogue embarque ne passait pas sa propre validation, la
   tuile n'aurait AUCUN repli -- ni reseau, ni fichier. C'est le test le
   plus important du fichier. */
test("le catalogue livre passe la validation", () => {
  const cat = JSON.parse(fs.readFileSync(C.EMBEDDED_PATH, "utf8"));
  const r = C.validateCatalog(cat);
  assert.ok(r.ok, "catalogue livre invalide -> " + r.reason);
  assert.ok(r.count >= 40, "catalogue anormalement court : " + r.count);
  assert.ok(r.version > 0, "le catalogue doit porter un numero de version, sinon le distant ne pourra jamais le depasser");
});

console.log("== Ce qui est refuse, et pourquoi ==");

test("un catalogue bien forme est accepte", () => {
  assert.strictEqual(C.validateCatalog(GOOD).ok, true);
});

/* LE GARDE-FOU QUI COMPTE. Une adresse privee dans un catalogue
   distant ferait du relais PiBoard un moyen de sonder le reseau
   interne de chaque personne qui l'installe -- le serveur tourne sur un
   Pi qui voit des machines que le navigateur ne voit pas. */
test("une adresse interne est refusee, en bloc", () => {
  for (const url of ["http://192.168.1.10/status", "https://localhost/status", "https://nas.local/status", "http://10.0.0.5"]) {
    const bad = clone(GOOD);
    bad.services[0].url = url;
    assert.strictEqual(C.validateCatalog(bad).ok, false, "adresse acceptee a tort : " + url);
  }
});

test("une adresse d'API interne est refusee aussi", () => {
  const bad = clone(GOOD);
  bad.services[1].api = "https://192.168.1.10/public/currentevents";
  assert.strictEqual(C.validateCatalog(bad).ok, false);
});

/* Un adaptateur inconnu viendrait d'un catalogue ecrit pour une version
   PLUS RECENTE de PiBoard. L'accepter afficherait une ligne grise
   inexplicable ; le refuser garde le catalogue precedent, qui marche. */
test("un adaptateur que cette version ne connait pas fait refuser le catalogue", () => {
  const bad = clone(GOOD);
  bad.services[0].adapter = "format-de-2027";
  const r = C.validateCatalog(bad);
  assert.strictEqual(r.ok, false);
  assert.ok(/adaptateur/.test(r.reason));
});

test("une famille inconnue, un identifiant en double ou un nom manquant font refuser", () => {
  const noFam = clone(GOOD); noFam.services[0].family = "inexistante";
  assert.strictEqual(C.validateCatalog(noFam).ok, false);
  const dup = clone(GOOD); dup.services[1].id = "github";
  assert.strictEqual(C.validateCatalog(dup).ok, false);
  const noName = clone(GOOD); delete noName.services[0].name;
  assert.strictEqual(C.validateCatalog(noName).ok, false);
});

/* Sans la famille « Mes services », un service ajoute a la main n'aurait
   aucune rubrique : il disparaitrait de l'ecran tout en restant
   surveille -- une tuile qui ment par omission. */
test("un catalogue sans la famille « Mes services » est refuse", () => {
  const bad = clone(GOOD);
  bad.families = bad.families.filter((f) => f.id !== "custom");
  assert.strictEqual(C.validateCatalog(bad).ok, false);
});

test("une famille non bilingue est refusee", () => {
  const bad = clone(GOOD);
  delete bad.families[0].label.en;
  assert.strictEqual(C.validateCatalog(bad).ok, false);
});

test("ce qui n'est pas un catalogue du tout est refuse", () => {
  for (const junk of [null, 42, "texte", [], {}, { families: [], services: [] }, { families: GOOD.families }]) {
    assert.strictEqual(C.validateCatalog(junk).ok, false, "accepte a tort : " + JSON.stringify(junk));
  }
});

/* Une page HTML rendue par une redirection de portail captif, par
   exemple, ne doit pas passer pour un catalogue. */
test("une reponse HTML analysee en objet ne passe pas", () => {
  assert.strictEqual(C.validateCatalog({ html: "<!doctype html>" }).ok, false);
});

console.log("== Le numero de version, qui empeche de reculer ==");

/* Sans cette regle, un depot revenu en arriere par accident effacerait
   des corrections deja en place sur tous les tableaux -- exactement ce
   que cette mecanique est censee eviter. */
test("la validation rend le numero de version, pour pouvoir comparer", () => {
  assert.strictEqual(C.validateCatalog(GOOD).version, 9);
  const noV = clone(GOOD); delete noV.version;
  assert.strictEqual(C.validateCatalog(noV).version, 0,
    "un catalogue sans version vaut 0 : il ne pourra jamais remplacer celui qu'on a");
});

console.log("== L'adresse interrogee ==");

test("le catalogue distant est lu sur le depot public, en HTTPS", () => {
  assert.ok(/^https:\/\/raw\.githubusercontent\.com\//.test(C.REMOTE_URL), C.REMOTE_URL);
  assert.ok(/jihemezes\/piboard/.test(C.REMOTE_URL));
});

test("l'intervalle de rafraichissement se compte en heures, pas en minutes", () => {
  assert.ok(C.REFRESH_MS >= 3600 * 1000,
    "un catalogue bouge quelques fois par an : l'interroger souvent ferait du bruit chez GitHub pour chaque Pi installe");
});

setTimeout(() => {
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS SERVICECATALOG PASSENT");
  process.exit(failures ? 1 : 0);
}, 50);
