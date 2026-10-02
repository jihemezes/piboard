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

setTimeout(() => {
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS SERVICEPROVIDERS PASSENT");
  process.exit(failures ? 1 : 0);
}, 50);
