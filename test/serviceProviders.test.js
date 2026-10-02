/* Tests des adaptateurs de pages de statut (server/serviceProviders.js) et
   du catalogue de services (public/data/service-catalog.json).

   TOUT EST HORS LIGNE, et c'est encore plus important ici que pour la
   Statuspage : on ne peut pas tester l'affichage d'une panne AWS en
   attendant qu'AWS tombe, et le jour ou elle arrive on n'a pas envie
   d'ecrire le code. Les relevés ci-dessous reproduisent donc la
   structure REELLE de chaque format, telle qu'on l'a observee sur les
   points d'entree publics.

   CE QUI EST VERIFIE EN PRIORITE : non pas que le cas nominal marche --
   il marche toujours -- mais les pieges propres a chaque format, ceux
   que personne ne verra avant le jour ou ils comptent :
     - Google rend TOUT l'historique, donc un incident referme il y a un
       an ne doit pas s'afficher comme en cours ;
     - le journal AWS est trie a l'envers de Statuspage ;
     - les dates AWS sont en secondes, parfois en millisecondes ;
     - un flux RSS ne contient aucun etat : celui qu'on affiche est
       deduit, et doit se declarer comme tel ;
     - une maintenance Instatus n'est pas une panne.

   EVERYTHING IS OFFLINE, and it matters even more here: one cannot test
   an AWS outage's display by waiting for AWS to fail, and on the day it
   does, writing the code is the last thing one wants to do. What is
   checked first is each format's own trap, which nobody sees until the
   day it counts. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const P = require("../server/serviceProviders");
const S = require("../server/serviceStatus");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

/* ============================================================
   Instatus
   ============================================================ */
console.log("== Instatus ==");

const INSTATUS_UP = {
  page: { name: "Railway", url: "https://status.railway.com", status: "UP" },
  activeIncidents: [],
  activeMaintenances: []
};

const INSTATUS_DOWN = {
  page: { name: "Railway", url: "https://status.railway.com", status: "HASISSUES" },
  activeIncidents: [{
    id: "inc-9",
    name: "Elevated deployment failures",
    status: "INVESTIGATING",
    impact: "MAJOROUTAGE",
    url: "https://status.railway.com/incident/9",
    started: "2026-10-02T09:00:00Z"
  }],
  activeMaintenances: []
};

const INSTATUS_MAINT = {
  page: { name: "Railway", url: "https://status.railway.com", status: "UNDERMAINTENANCE" },
  activeIncidents: [],
  activeMaintenances: [{
    id: "m1", name: "Database upgrade", status: "INPROGRESS",
    start: "2026-10-02T02:00:00Z", end: "2026-10-02T04:00:00Z"
  }]
};

test("un service Instatus sain est lu comme sain", () => {
  const r = P.parseInstatus(INSTATUS_UP);
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.name, "Railway");
  assert.strictEqual(r.approximate, false, "Instatus declare son etat : rien n'est deduit");
});

test("un incident Instatus porte son nom, son stade et son lien", () => {
  const r = P.parseInstatus(INSTATUS_DOWN);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.indicator, "major");
  assert.strictEqual(r.incidents.length, 1);
  assert.strictEqual(r.incidents[0].name, "Elevated deployment failures");
  assert.strictEqual(r.incidents[0].url, "https://status.railway.com/incident/9");
});

/* Une maintenance ANNONCEE n'est pas une panne. Les confondre ferait
   sonner la sirene pour une operation prevue de longue date -- la facon
   la plus sure de faire couper les notifications pour de bon, apres quoi
   la vraie panne passerait inapercue.
   A DECLARED maintenance is not an outage; conflating them would ring
   the siren for a long-planned operation, the surest way to get
   notifications switched off -- after which the real outage goes
   unnoticed. */
test("une maintenance Instatus en cours ne vaut pas une panne", () => {
  const r = P.parseInstatus(INSTATUS_MAINT);
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.maintenances.length, 1);
  assert.strictEqual(r.maintenances[0].name, "Database upgrade");
});

test("un etat Instatus inconnu n'est jamais pris pour « tout va bien »", () => {
  const r = P.parseInstatus({ page: { status: "BANANE" } });
  assert.strictEqual(r.indicator, "unknown");
  assert.strictEqual(r.ok, false);
});

test("une reponse qui n'est pas de l'Instatus est refusee, pas devinee", () => {
  for (const bad of [null, [], 42, "", { page: {} }, { incidents: [] }]) {
    assert.strictEqual(P.parseInstatus(bad), null, JSON.stringify(bad));
  }
});

/* ============================================================
   Google (Cloud et Workspace)
   ============================================================ */
console.log("== Google ==");

const GOOGLE = [
  /* Incident REFERME, et vieux : il est dans le fichier comme les
     centaines d'autres de l'historique. C'est le piege du format.
     A CLOSED, old incident: it sits in the file like the hundreds of
     others in the history. This is the format's trap. */
  {
    id: "old1", number: "1", begin: "2025-03-01T10:00:00Z", end: "2025-03-01T12:00:00Z",
    external_desc: "Ancienne panne refermee depuis des mois",
    status_impact: "SERVICE_OUTAGE", uri: "incidents/old1",
    affected_products: [{ title: "Cloud Storage" }]
  },
  {
    id: "new1", number: "2", begin: "2026-10-02T08:30:00Z",
    external_desc: "Elevated error rates in Cloud Run",
    status_impact: "SERVICE_DISRUPTION",
    uri: "incidents/new1",
    modified: "2026-10-02T09:15:00Z",
    affected_products: [{ title: "Cloud Run" }, { title: "Cloud Build" }],
    most_recent_update: {
      status: "SERVICE_DISRUPTION",
      modified: "2026-10-02T09:15:00Z",
      text: "<p>We are <b>investigating</b> elevated error rates.</p>"
    }
  }
];

test("seuls les incidents OUVERTS comptent : un incident referme n'est pas affiche", () => {
  const r = P.parseGoogle(GOOGLE);
  assert.strictEqual(r.incidents.length, 1, "un seul incident ouvert");
  assert.strictEqual(r.incidents[0].id, "new1");
  assert.ok(!/Ancienne panne/.test(JSON.stringify(r)),
    "l'incident referme ne doit apparaitre nulle part");
});

test("la gravite vient de l'incident ouvert le plus grave", () => {
  const r = P.parseGoogle(GOOGLE);
  assert.strictEqual(r.indicator, "major", "SERVICE_DISRUPTION vaut une panne partielle");
  assert.strictEqual(r.ok, false);
});

/* Le HTML des messages Google doit partir ICI : la tuile echappe tout ce
   qu'elle recoit, donc une balise non retiree s'afficherait telle quelle
   a l'ecran, au milieu d'une phrase.
   Google's message HTML must be stripped HERE: the tile escapes
   everything it receives, so a surviving tag would appear verbatim on
   screen, mid-sentence. */
test("le dernier message est nettoye de son HTML", () => {
  const m = P.parseGoogle(GOOGLE).incidents[0].lastMessage;
  assert.ok(!/[<>]/.test(m), "aucune balise ne doit survivre : " + m);
  assert.ok(/investigating/.test(m));
});

test("les produits touches tiennent le role des composants", () => {
  const r = P.parseGoogle(GOOGLE);
  assert.deepStrictEqual(r.affected.map((c) => c.name), ["Cloud Run", "Cloud Build"]);
});

/* Le lien est RELATIF dans le fichier : laisse tel quel, il pointerait
   sur le tableau de bord PiBoard au lieu de la page de Google.
   The link is RELATIVE in the file; left as is, it would point at
   PiBoard's own dashboard instead of Google's page. */
test("le lien d'incident est rendu absolu", () => {
  assert.ok(/^https:\/\/status\.cloud\.google\.com\//.test(P.parseGoogle(GOOGLE).incidents[0].url));
});

/* Un tableau VIDE est la meilleure nouvelle possible : zero incident. Le
   refuser comme format inconnu afficherait un etat gris les jours ou
   tout va bien -- soit la quasi-totalite des jours.
   An EMPTY array is the best possible news: zero incidents. Refusing it
   as an unknown format would show a grey state on the days everything is
   fine -- that is, nearly every day. */
test("un historique sans aucun incident ouvert vaut « tout operationnel »", () => {
  const r = P.parseGoogle([GOOGLE[0]]);
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  const empty = P.parseGoogle([]);
  assert.strictEqual(empty.indicator, "none");
  assert.strictEqual(empty.ok, true);
});

test("une reponse qui n'est pas du Google incidents.json est refusee", () => {
  for (const bad of [null, {}, "", 7, [{ truc: 1 }]]) {
    assert.strictEqual(P.parseGoogle(bad), null, JSON.stringify(bad));
  }
});

/* ============================================================
   AWS Health
   ============================================================ */
console.log("== AWS ==");

const AWS = [{
  arn: "arn:aws:health:eu-west-1::event/EC2/abc",
  date: 1790000000,
  region_name: "eu-west-1",
  status: 2,
  service: "EC2",
  service_name: "Amazon Elastic Compute Cloud (Paris)",
  summary: "Increased API error rates",
  /* Journal du PLUS ANCIEN au PLUS RECENT : l'inverse de Statuspage.
     Log oldest-to-newest: the opposite of Statuspage. */
  event_log: [
    { timestamp: 1790000000, message: "We are investigating increased API error rates." },
    { timestamp: 1790003600, message: "The issue has been identified and a fix is being applied." }
  ]
}];

test("un evenement AWS porte le service ET la region", () => {
  const r = P.parseAws(AWS);
  assert.strictEqual(r.indicator, "major", "status 2 vaut une panne partielle");
  assert.ok(/eu-west-1/.test(r.incidents[0].name), "la region doit figurer dans le titre");
  assert.ok(/eu-west-1/.test(r.affected[0].name));
});

/* Prendre le premier element du journal afficherait le message
   d'OUVERTURE comme derniere nouvelle : la pire information possible,
   la plus perimee presentee comme la plus fraiche. On prend par la DATE,
   comme partout ailleurs.
   Taking the log's first entry would present the OPENING message as the
   latest news: the most stale information dressed as the freshest. */
test("le dernier message AWS est choisi par sa DATE, pas par sa position", () => {
  assert.ok(/fix is being applied/.test(P.parseAws(AWS).incidents[0].lastMessage));
});

/* Un horodatage en secondes pris pour des millisecondes afficherait
   « il y a 56 ans » -- visible, mais seulement si on regarde.
   Seconds mistaken for milliseconds display "56 years ago" -- visible,
   but only if one looks. */
test("les dates AWS en secondes ne sont pas prises pour des millisecondes", () => {
  const iso = P.isoFromAws(1790000000);
  assert.ok(/^20\d\d-/.test(iso), "annee plausible attendue, obtenu " + iso);
  assert.strictEqual(P.isoFromAws(1790000000000), iso, "secondes et millisecondes doivent converger");
  assert.strictEqual(P.isoFromAws(null), null);
});

test("aucun evenement en cours vaut « tout operationnel »", () => {
  const r = P.parseAws([]);
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.incidents, []);
});

test("une reponse qui n'est pas de l'AWS Health est refusee", () => {
  for (const bad of [null, {}, "x", [{ zzz: 1 }]]) {
    assert.strictEqual(P.parseAws(bad), null, JSON.stringify(bad));
  }
});

/* ============================================================
   RSS -- le cas honnete a part
   ============================================================ */
console.log("== RSS ==");

const NOW = Date.parse("2026-10-02T12:00:00Z");
function rss(items) {
  return `<?xml version="1.0"?><rss version="2.0"><channel>
    <title>Azure Status</title><link>https://status.azure.com</link>
    ${items}</channel></rss>`;
}
const RSS_QUIET = rss(`<item><title>Storage - East US - Mitigated</title>
  <description>&lt;p&gt;Resolved&lt;/p&gt;</description>
  <pubDate>Mon, 15 Sep 2026 10:00:00 GMT</pubDate><link>https://status.azure.com/a</link></item>`);
const RSS_LIVE = rss(`<item><title>Virtual Machines - West Europe - Investigating</title>
  <description>&lt;p&gt;We are &lt;b&gt;investigating&lt;/b&gt; an issue.&lt;/p&gt;</description>
  <pubDate>Fri, 02 Oct 2026 09:30:00 GMT</pubDate><link>https://status.azure.com/b</link></item>`);
const RSS_RESOLVED_TODAY = rss(`<item><title>Virtual Machines - West Europe - Resolved</title>
  <description>Fixed</description>
  <pubDate>Fri, 02 Oct 2026 09:30:00 GMT</pubDate></item>`);

test("un flux sans billet recent vaut « sain », et se declare DEDUIT", () => {
  const r = P.parseRss(RSS_QUIET, { now: NOW });
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.approximate, true,
    "c'est toute la question : un silence n'est pas une declaration de bonne sante");
  assert.strictEqual(r.name, "Azure Status");
});

test("un billet recent et non resolu vaut une degradation MINEURE, jamais plus", () => {
  const r = P.parseRss(RSS_LIVE, { now: NOW });
  assert.strictEqual(r.indicator, "minor",
    "le flux ne contient pas l'information qui justifierait un rouge");
  assert.strictEqual(r.incidents.length, 1);
  assert.ok(/Virtual Machines/.test(r.incidents[0].name));
  assert.ok(!/[<>]/.test(r.incidents[0].lastMessage || ""), "le HTML du billet doit partir");
});

test("un billet recent qui annonce une resolution ne fait pas passer au rouge", () => {
  const r = P.parseRss(RSS_RESOLVED_TODAY, { now: NOW });
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.incidents.length, 0);
});

test("ce qui n'est pas un flux est refuse, sans exception", () => {
  for (const bad of [null, 42, "", "<html><body>oups</body></html>", "{\"json\":1}", "<rss"]) {
    assert.strictEqual(P.parseRss(bad, { now: NOW }), null, JSON.stringify(bad));
  }
});

/* ============================================================
   Choix de l'adresse interrogee
   ============================================================ */
console.log("== Adresse interrogee selon l'adaptateur ==");

test("chaque adaptateur construit son propre chemin depuis l'origine", () => {
  assert.strictEqual(S.endpointFor({ adapter: "statuspage", url: "https://www.githubstatus.com" }),
    "https://www.githubstatus.com/api/v2/summary.json");
  assert.strictEqual(S.endpointFor({ adapter: "instatus", url: "https://status.railway.com/incident/9" }),
    "https://status.railway.com/summary.json",
    "le chemin colle par l'utilisateur est jete, comme pour Statuspage");
});

/* Les trois formats non-Statuspage vivent a un chemin qu'on ne peut pas
   deviner depuis l'origine : le catalogue le fournit, et celui-la garde
   son chemin.
   The three non-Statuspage formats live at a path that cannot be guessed
   from the origin: the catalogue supplies it, and that one keeps its
   path. */
test("une adresse d'API explicite garde son chemin", () => {
  assert.strictEqual(
    S.endpointFor({ adapter: "aws", url: "https://health.aws.amazon.com", api: "https://health.aws.amazon.com/public/currentevents" }),
    "https://health.aws.amazon.com/public/currentevents");
});

/* Le catalogue est un fichier que n'importe qui peut editer. S'il
   pouvait porter une adresse interne, il deviendrait une porte d'entree
   vers le reseau local -- le relais serveur voyant des machines que le
   navigateur ne voit pas.
   The catalogue is a file anyone can edit; if it could carry an internal
   address it would become a way into the local network. */
test("le garde-fou sur l'hote s'applique AUSSI aux adresses d'API du catalogue", () => {
  for (const bad of [
    "http://health.aws.amazon.com/public/currentevents",
    "https://192.168.1.10/incidents.json",
    "https://nas.local/summary.json",
    "https://localhost/api/v2/summary.json"
  ]) {
    assert.strictEqual(S.normalizeApi(bad), null, "doit etre refuse : " + bad);
  }
  assert.ok(S.normalizeApi("https://status.cloud.google.com/incidents.json"));
});

test("un adaptateur inconnu ne construit aucune adresse", () => {
  assert.strictEqual(S.endpointFor({ adapter: "banane", url: "https://exemple.fr" }), null);
});

/* ============================================================
   Catalogue de services
   ============================================================ */
console.log("== Catalogue de services ==");

const catalog = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "public", "data", "service-catalog.json"), "utf8"));

test("le catalogue est utilisable : des familles, et une quarantaine de services au moins", () => {
  assert.ok(Array.isArray(catalog.families) && catalog.families.length >= 5);
  assert.ok(Array.isArray(catalog.services) && catalog.services.length >= 40,
    "le catalogue livre doit valoir le detour : " + catalog.services.length + " entrees");
});

/* Un identifiant en double ferait cocher deux services d'un seul clic,
   ou decocher le mauvais : la case a cocher est designee par cet
   identifiant, et rien d'autre.
   A duplicate id would tick two services with one click, or untick the
   wrong one: the checkbox is addressed by that id and nothing else. */
test("aucun identifiant en double", () => {
  const ids = catalog.services.map((s) => s.id);
  assert.strictEqual(new Set(ids).size, ids.length,
    "doublons : " + ids.filter((x, i) => ids.indexOf(x) !== i).join(", "));
});

test("chaque service a un nom, une famille connue et un adaptateur connu", () => {
  const fams = new Set(catalog.families.map((f) => f.id));
  const adapters = new Set(Object.keys(P.ADAPTERS).concat(["auto"]));
  for (const s of catalog.services) {
    assert.ok(s.id && s.name, "entree sans identifiant ou sans nom : " + JSON.stringify(s));
    assert.ok(fams.has(s.family), s.id + " : famille inconnue « " + s.family + " »");
    assert.ok(adapters.has(s.adapter), s.id + " : adaptateur inconnu « " + s.adapter + " »");
  }
});

/* Le garde-fou du serveur refuserait silencieusement une entree en HTTP
   ou pointant une adresse privee : la case se cocherait, et la tuile
   afficherait « adresse refusee » sans que personne comprenne pourquoi.
   On verifie donc le catalogue AVANT livraison.
   The server's guard would silently refuse an HTTP or private entry: the
   box would tick and the tile would show "address refused" with nobody
   understanding why. So the catalogue is checked BEFORE delivery. */
test("toutes les adresses du catalogue passent le garde-fou du serveur", () => {
  for (const s of catalog.services) {
    assert.ok(S.normalizeBase(s.url), s.id + " : adresse refusee par le garde-fou -> " + s.url);
    if (s.api) assert.ok(S.normalizeApi(s.api), s.id + " : adresse d'API refusee -> " + s.api);
  }
});

/* Les formats non devinables depuis l'origine DOIVENT fournir leur
   adresse d'API : sans elle, l'adaptateur irait chercher
   /incidents.json a la racine du site et ne trouverait rien -- une
   entree morte, cochee de bonne foi.
   Formats whose path cannot be guessed MUST supply their API address, or
   the adapter would look for /incidents.json at the site's root and find
   nothing: a dead entry, ticked in good faith. */
test("les entrees Google, AWS et RSS declarent leur adresse d'API", () => {
  for (const s of catalog.services) {
    if (["google", "aws", "rss"].indexOf(s.adapter) !== -1) {
      assert.ok(s.api, s.id + " (" + s.adapter + ") doit declarer son adresse d'API");
    }
  }
});

test("la famille « Mes services » existe, pour accueillir les ajouts a la main", () => {
  assert.ok(catalog.families.some((f) => f.id === "custom"),
    "sans elle, un service ajoute a la main n'aurait aucune rubrique et disparaitrait de l'ecran tout en restant surveille");
});

test("chaque famille est bilingue", () => {
  for (const f of catalog.families) {
    assert.ok(f.label && f.label.fr && f.label.en, "famille sans libelle FR/EN : " + f.id);
  }
});


/* ============================================================
   Les cinq formats ajoutes en 1.129.0, et le defaut qui les a fait
   ecrire : neuf services du catalogue affichaient « page de statut
   injoignable » alors que leurs pages repondaient parfaitement. Trois
   causes distinctes, verifiees ici separement.
   ============================================================ */

console.log("== PayPal ==");

const PAYPAL_OK = {
  result: [
    { id: 3, name: "Online Checkout", displayName: "Online Checkout", parentName: "PRODUCT",
      status: { production: "Operational", sandbox: "Operational" } },
    { id: 4, name: "Payouts", displayName: "Payouts", parentName: "PRODUCT",
      status: { production: "Operational", sandbox: "Major Outage" } }
  ]
};

test("PayPal : l'etat global se deduit des composants", () => {
  const out = P.parsePaypal(PAYPAL_OK);
  assert.ok(out, "la reponse PayPal doit etre lue");
  assert.strictEqual(out.indicator, "none");
  assert.strictEqual(out.componentCount, 2);
});

/* LE CHOIX QUI COMPTE, et qu'un test doit figer : une sandbox en panne
   ne doit PAS faire rougir la tuile. Les paiements reels passent ; une
   alerte ici ferait couper les notifications, et on ne serait plus
   averti le jour ou la production tombe. */
test("PayPal : une sandbox en panne ne fait pas rougir la production", () => {
  const out = P.parsePaypal(PAYPAL_OK);
  assert.strictEqual(out.ok, true, "sandbox HS + production OK doit rester sain");
  assert.strictEqual(out.affected.length, 0);
});

test("PayPal : une panne de production ressort, avec son composant", () => {
  const out = P.parsePaypal({ result: [
    { name: "Online Checkout", displayName: "Online Checkout",
      status: { production: "Major Outage", sandbox: "Operational" } }
  ] });
  assert.strictEqual(out.indicator, "critical");
  assert.strictEqual(out.affected[0].name, "Online Checkout");
  assert.strictEqual(out.affected[0].status, "major_outage");
});

test("PayPal : une liste vide n'est pas une lecture valide", () => {
  assert.strictEqual(P.parsePaypal({ result: [] }), null,
    "sinon un service sans aucun composant s'afficherait comme sain");
  assert.strictEqual(P.parsePaypal({ components: [] }), null);
  assert.strictEqual(P.parsePaypal([]), null);
});

console.log("== Status.io (GitLab) ==");

const STATUSIO = { result: {
  status_overall: { updated: "2026-10-01T21:48:01.469Z", status: "Degraded Performance", status_code: 300 },
  status: [
    { id: "a", name: "Website", status: "Operational", status_code: 100 },
    { id: "b", name: "CI/CD", status: "Degraded Performance", status_code: 300 }
  ],
  incidents: [
    { _id: "i1", name: "Runners saturés", datetime: "2026-10-01T20:00:00.000Z", messages: [
      { datetime: "2026-10-01T20:00:00.000Z", details: "<p>Premier message</p>" },
      { datetime: "2026-10-01T21:30:00.000Z", details: "<p>Dernier message</p>" }
    ] }
  ]
} };

test("Status.io : les codes numeriques deviennent des etats de composant", () => {
  const out = P.parseStatusio(STATUSIO);
  assert.ok(out);
  assert.strictEqual(out.indicator, "minor");
  assert.strictEqual(out.affected.length, 1);
  assert.strictEqual(out.affected[0].name, "CI/CD");
});

/* Meme piege que partout ailleurs : le dernier message est choisi par sa
   DATE, jamais par sa position dans le tableau. */
test("Status.io : le dernier message est choisi par sa date", () => {
  const out = P.parseStatusio(STATUSIO);
  assert.strictEqual(out.incidents.length, 1);
  assert.strictEqual(out.incidents[0].lastMessage, "Dernier message");
});

test("Status.io : ce qui n'est pas du Status.io est refuse", () => {
  assert.strictEqual(P.parseStatusio({ result: {} }), null);
  assert.strictEqual(P.parseStatusio({ page: { status: "UP" } }), null);
});

console.log("== Fastly ==");

const FASTLY = {
  PageName: "Fastly | Service Status",
  Domain: "fastly",
  StatusInEffectSince: "2026-09-14T17:56:00",
  StatusText: "Maintenance",
  Status: "Maintenance",
  UnresolvedIncidents: [
    { Id: 378875, Title: "Controlled Support Access", Status: "InProgress",
      IncidentType: "Informational", StartDate: "2026-09-22T15:02:00" }
  ]
};

test("Fastly : une maintenance declaree n'est pas une panne", () => {
  const out = P.parseFastly(FASTLY);
  assert.ok(out);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.incidents.length, 0, "une maintenance ne doit pas sortir en incident");
  assert.strictEqual(out.maintenances.length, 1);
});

test("Fastly : une panne ressort bien en incident", () => {
  const out = P.parseFastly(Object.assign({}, FASTLY, { Status: "Outage", StatusText: "Outage" }));
  assert.strictEqual(out.indicator, "critical");
  assert.strictEqual(out.incidents.length, 1);
});

/* LE PIEGE DU CHEMIN PARTAGE : Fastly sert son format maison a
   /summary.json, exactement le chemin d'Instatus. Un JSON valide au bon
   chemin n'est pas le bon format pour autant, et chaque lecteur doit
   refuser ce qui n'est pas a lui -- sans quoi le sondage « auto »
   s'arreterait sur le premier qui ne plante pas. */
test("Fastly et Instatus partagent un chemin mais pas un schema", () => {
  assert.strictEqual(P.parseInstatus(FASTLY), null, "Instatus ne doit pas avaler du Fastly");
  assert.strictEqual(P.parseFastly({ page: { name: "X", status: "UP" } }), null,
    "Fastly ne doit pas avaler de l'Instatus");
});

console.log("== Vultr ==");

const VULTR = {
  service_alerts: [],
  regions: {
    global: { location: "All Locations", alerts: [
      { id: "g1", subject: "DNS", status: "resolved", start_date: "2026-10-02T10:40:00+00:00", entries: [] } ] },
    cdg: { location: "Paris", alerts: [] },
    atl: { location: "Atlanta", alerts: [
      { id: "a1", subject: "Partial Outage", status: "ongoing", start_date: "2026-09-18T18:07:00+00:00",
        entries: [
          { updated_at: "2026-09-18T18:07:00+00:00", message: "Premier" },
          { updated_at: "2026-09-19T09:00:00+00:00", message: "Dernier" }
        ] } ] }
  }
};

/* MEME PIEGE QUE GOOGLE : le fichier garde les alertes RESOLUES. Les
   prendre pour des incidents en cours afficherait du rouge pour une
   panne refermee il y a trois semaines. */
test("Vultr : une alerte resolue n'est pas un incident en cours", () => {
  const out = P.parseVultr(VULTR);
  assert.ok(out);
  assert.strictEqual(out.incidents.length, 1, "seule l'alerte « ongoing » compte");
  assert.ok(/Atlanta/.test(out.incidents[0].name));
});

test("Vultr : la region en panne est nommee, les regions saines ne le sont pas", () => {
  const out = P.parseVultr(VULTR);
  assert.strictEqual(out.indicator, "major");
  assert.deepStrictEqual(out.affected.map((c) => c.name), ["Atlanta"]);
});

test("Vultr : le dernier message d'une alerte est choisi par sa date", () => {
  const out = P.parseVultr(VULTR);
  assert.strictEqual(out.incidents[0].lastMessage, "Dernier");
});

test("Vultr : ce qui n'a pas de regions est refuse", () => {
  assert.strictEqual(P.parseVultr({ service_alerts: [] }), null);
});

console.log("== Endpoint (services sans page de statut) ==");

/* CE QUE CET ADAPTATEUR DOIT TOUJOURS DIRE : que son etat est DEDUIT.
   Un vert deduit lu comme un vert declare serait pire que pas de tuile
   du tout -- c'est la meme lecon que le RSS, et que « premier relevé a
   venir » contre « le serveur ne mesure rien » sur la tuile Sante
   Internet. */
test("Endpoint : une reponse vaut « sain », et se declare DEDUIT", () => {
  const out = P.parseEndpoint({ ok: true, url: "https://api.pcloud.com/getdigest", host: "api.pcloud.com" });
  assert.ok(out);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.approximate, true, "sans ce drapeau, le tilde disparait et l'etat passe pour declare");
});

/* Un echec ne depasse JAMAIS la degradation mineure : il peut venir de
   votre connexion, de votre DNS, d'un cable sous-marin. On ne declare
   pas une panne mondiale sur la foi d'un timeout. */
test("Endpoint : un echec reste une degradation mineure, jamais une panne", () => {
  const out = P.parseEndpoint({ ok: false, url: "https://api.pcloud.com/getdigest", host: "api.pcloud.com" });
  assert.strictEqual(out.indicator, "minor");
  assert.strictEqual(out.approximate, true);
  assert.strictEqual(out.affected.length, 1);
});

test("Endpoint : il ne figure pas dans l'ordre de sondage automatique", () => {
  assert.strictEqual(P.AUTO_ORDER.indexOf("endpoint"), -1,
    "il reussirait sur n'importe quelle adresse joignable et gagnerait toujours : tout service deviendrait « sain, deduit »");
});

console.log("== Les neuf services qui affichaient « injoignable » ==");

/* Ce test est la memoire du defaut. Chacune de ces entrees a ete
   verifiee a la main sur sa page reelle ; si une future modification du
   catalogue les remet en « auto » ou sur l'ancienne adresse, le probleme
   reviendrait en silence, et c'est precisement ce qui est arrive la
   premiere fois. */
test("chacune des entrees fautives declare desormais le bon format", () => {
  const expect = {
    gitlab: "statusio",
    fastly: "fastly",
    vultr: "vultr",
    oraclecloud: "statuspage",
    alibabacloud: "endpoint",
    hetzner: "endpoint",
    sfr: "endpoint",
    paypal: "paypal",
    aws: "aws"
  };
  for (const id of Object.keys(expect)) {
    const s = catalog.services.find((x) => x.id === id);
    assert.ok(s, "entree disparue du catalogue : " + id);
    assert.strictEqual(s.adapter, expect[id], id + " doit etre lu par l'adaptateur " + expect[id]);
  }
});

/* OVHcloud : la racine status.ovhcloud.com n'est qu'un MENU, sans aucun
   etat. Chaque produit a sa propre Statuspage sur son sous-domaine, et
   c'est la seule facon d'obtenir un etat : une entree unique pointant
   sur la racine ne pouvait rien rendre. */
test("OVHcloud est eclate par produit, chacun sur sa propre Statuspage", () => {
  const ovh = catalog.services.filter((s) => /^ovh-/.test(s.id));
  assert.ok(ovh.length >= 4, "la racine OVH ne rend aucun etat : il faut les sous-domaines produits");
  for (const s of ovh) {
    assert.strictEqual(s.adapter, "statuspage");
    assert.ok(/\.status-ovhcloud\.com$/.test(new URL(s.url).hostname), "mauvais domaine : " + s.url);
  }
  assert.ok(!catalog.services.some((s) => s.id === "ovhcloud"),
    "l'ancienne entree pointant sur le menu doit avoir disparu, sinon elle reste muette");
});

/* Les formats maison ne se devinent pas depuis l'origine : ils doivent
   porter leur adresse d'API, comme Google, AWS et RSS avant eux. */
test("les formats maison declarent leur adresse d'API", () => {
  for (const s of catalog.services) {
    if (["statusio", "fastly", "vultr", "paypal", "endpoint"].indexOf(s.adapter) !== -1) {
      assert.ok(s.api, s.id + " (" + s.adapter + ") doit declarer son adresse d'API");
    }
  }
});

test("la famille « partage de fichiers » existe et contient pCloud", () => {
  assert.ok(catalog.families.some((f) => f.id === "files"));
  const pcloud = catalog.services.find((s) => s.id === "pcloud");
  assert.ok(pcloud, "pCloud doit figurer au catalogue");
  assert.strictEqual(pcloud.adapter, "endpoint",
    "pCloud ne publie AUCUNE page de statut : seule la joignabilite de son API est mesurable, et elle doit se declarer deduite");
});

setTimeout(() => {
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS SERVICEPROVIDERS PASSENT");
  process.exit(failures ? 1 : 0);
}, 50);
