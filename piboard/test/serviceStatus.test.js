/* Tests de l'etat des services en ligne (server/serviceStatus.js).

   TOUT EST HORS LIGNE. Les relevés ci-dessous reproduisent la structure
   reelle d'une Statuspage d'Atlassian -- celle de githubstatus.com comme
   de toutes les autres. Dependre du vrai reseau rendrait ces tests
   inutilisables sur une machine sans Internet ET, pire, FAUX le jour ou
   GitHub va bien : on ne peut pas tester l'affichage d'un incident en
   attendant qu'il s'en produise un.

   CE QUI EST VERIFIE EN PRIORITE : non pas que le cas nominal marche --
   il marche toujours -- mais les cas qui ne se presentent presque jamais
   et que personne ne verra avant le jour ou ils comptent : un incident
   en cours, une reponse abimee, une page injoignable, et surtout les
   deux pieges identifies a l'ecriture (les entetes de groupe comptes
   comme des composants, et le dernier message d'incident pris au mauvais
   bout du tableau).

   EVERYTHING IS OFFLINE. Depending on the real network would make these
   tests unusable without internet AND, worse, WRONG on a day GitHub is
   fine: one cannot test an incident's display by waiting for one to
   happen. What is checked first is not the nominal case -- that always
   works -- but the cases nobody sees until the day they matter. */
"use strict";

const assert = require("assert");
const S = require("../server/serviceStatus");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

/* ---------- Relevés figes / frozen readings ---------- */

const ALL_GOOD = {
  page: { name: "GitHub", url: "https://www.githubstatus.com", updated_at: "2026-10-01T16:00:00Z" },
  status: { indicator: "none", description: "All Systems Operational" },
  components: [
    { id: "g1", name: "Core", group: true },
    { id: "c1", name: "Git Operations", status: "operational", group_id: "g1" },
    { id: "c2", name: "API Requests", status: "operational", group_id: "g1" },
    { id: "c3", name: "Actions", status: "operational" }
  ],
  incidents: [],
  scheduled_maintenances: []
};

/* Incident reel, dans sa forme caracteristique : un groupe en tete, deux
   composants touches a des degres differents, et des mises a jour
   fournies de la plus recente a la plus ancienne.
   A real incident in its characteristic shape. */
const INCIDENT = {
  page: { name: "GitHub", url: "https://www.githubstatus.com" },
  status: { indicator: "major", description: "Partial System Outage" },
  components: [
    { id: "g1", name: "Core", group: true, status: "major_outage" },
    { id: "c1", name: "Git Operations", status: "operational", group_id: "g1" },
    { id: "c2", name: "Actions", status: "major_outage", group_id: "g1" },
    { id: "c3", name: "Webhooks", status: "degraded_performance" },
    { id: "c4", name: "Pages", status: "operational" }
  ],
  incidents: [{
    id: "inc1",
    name: "Incident with Actions and Webhooks",
    status: "Identified",
    impact: "major",
    shortlink: "https://stspg.io/abc123",
    started_at: "2026-10-01T14:05:00Z",
    updated_at: "2026-10-01T15:40:00Z",
    components: [{ name: "Actions" }, { name: "Webhooks" }],
    incident_updates: [
      { body: "We have identified the cause and are deploying a fix.", status: "identified", display_at: "2026-10-01T15:40:00Z" },
      { body: "We are investigating reports of degraded performance.", status: "investigating", display_at: "2026-10-01T14:05:00Z" }
    ]
  }],
  scheduled_maintenances: [{
    name: "Database maintenance",
    status: "scheduled",
    scheduled_for: "2026-10-05T02:00:00Z",
    scheduled_until: "2026-10-05T04:00:00Z",
    shortlink: "https://stspg.io/maint1"
  }]
};

console.log("== Cas nominal : tout operationnel ==");

test("tout va bien : ok vrai, aucun composant touche", () => {
  const r = S.parseSummary(ALL_GOOD);
  assert.strictEqual(r.indicator, "none");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.affected.length, 0);
  assert.strictEqual(r.incidents.length, 0);
  assert.strictEqual(r.description, "All Systems Operational");
  assert.strictEqual(r.name, "GitHub");
});

/* LE PIEGE N°1. Statuspage melange, dans le MEME tableau, les composants
   et les entetes de groupe qui les coiffent. Compter un entete comme un
   composant ferait apparaitre chaque probleme DEUX fois -- une sous le
   nom du groupe, une sous celui du composant reellement touche -- et le
   nom du groupe est le moins precis des deux.
   TRAP #1: Statuspage mixes components and their group headers in the
   SAME array. Counting a header as a component would show every problem
   TWICE, under the less precise of the two names. */
test("les entetes de groupe ne sont pas comptes comme des composants", () => {
  const r = S.parseSummary(ALL_GOOD);
  assert.strictEqual(r.componentCount, 3, "3 composants, pas 4 : « Core » est un groupe");
  assert.ok(!r.affected.some((c) => c.name === "Core"));
});

console.log("== Incident en cours ==");

test("l'indicateur global et les composants touches sont rendus", () => {
  const r = S.parseSummary(INCIDENT);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.indicator, "major");
  assert.deepStrictEqual(r.affected.map((c) => c.name), ["Actions", "Webhooks"],
    "seuls les composants NON operationnels, du plus grave au moins grave");
  assert.strictEqual(r.affected[0].status, "major_outage");
});

/* Ce qui va bien n'a pas a etre affiche : sur une tuile murale, lister
   « Pages : operationnel » a cote du vrai probleme le noie.
   What works needs no display: listing it drowns the real problem. */
test("les composants operationnels restent hors de la liste", () => {
  const r = S.parseSummary(INCIDENT);
  assert.ok(!r.affected.some((c) => c.name === "Pages"));
  assert.ok(!r.affected.some((c) => c.name === "Git Operations"));
  assert.strictEqual(r.componentCount, 4);
});

/* LE PIEGE N°2. Les mises a jour arrivent de la plus recente a la plus
   ancienne, mais s'y fier sans verifier, c'est risquer d'afficher le
   message d'OUVERTURE de l'incident comme s'il etait la derniere
   nouvelle -- la pire information possible : la plus perimee, presentee
   comme la plus fraiche.
   TRAP #2: relying on the array's order risks showing the incident's
   OPENING message as the latest news -- the most stale information,
   presented as the freshest. */
test("le dernier message est choisi par sa DATE, pas par sa position", () => {
  const r = S.parseSummary(INCIDENT);
  assert.ok(/identified the cause/.test(r.incidents[0].lastMessage));

  const shuffled = JSON.parse(JSON.stringify(INCIDENT));
  shuffled.incidents[0].incident_updates.reverse(); // plus ancienne en tete / oldest first
  const r2 = S.parseSummary(shuffled);
  assert.ok(/identified the cause/.test(r2.incidents[0].lastMessage),
    "un tableau reordonne ne doit pas changer le message affiche");
});

test("l'incident porte son stade, son impact, son lien et ses dates", () => {
  const i = S.parseSummary(INCIDENT).incidents[0];
  assert.strictEqual(i.status, "Identified");
  assert.strictEqual(i.impact, "major");
  assert.strictEqual(i.url, "https://stspg.io/abc123");
  assert.strictEqual(i.startedAt, "2026-10-01T14:05:00Z");
  assert.deepStrictEqual(i.components, ["Actions", "Webhooks"]);
});

test("les maintenances programmees sont rendues a part des incidents", () => {
  const r = S.parseSummary(INCIDENT);
  assert.strictEqual(r.maintenances.length, 1);
  assert.strictEqual(r.maintenances[0].scheduledFor, "2026-10-05T02:00:00Z");
  assert.strictEqual(r.maintenances[0].name, "Database maintenance");
});

console.log("== Reponses abimees ou inattendues ==");

/* Une page de statut peut changer de forme, ou un intermediaire rendre
   du HTML a la place du JSON. On veut alors un etat EXPLOITABLE, jamais
   une exception qui ferait tomber la tuile entiere.
   A status page may change shape, or a middlebox return HTML instead of
   JSON. We want a usable state, never an exception. */
test("une reponse vide ou d'un autre type ne leve jamais", () => {
  /* `[]` compte ici : `typeof [] === "object"`, et un tableau JSON
     franchissait le filtre pour ressortir en etat « inconnu » bien
     forme -- un faux etat, plus trompeur qu'une absence de reponse.
     `[]` matters here: a JSON array used to slip through. */
  for (const bad of [null, undefined, "", 42, "<html>", [], [{ status: {} }], true]) {
    assert.strictEqual(S.parseSummary(bad), null, JSON.stringify(bad));
  }
  // Un objet JSON sans AUCUNE section attendue n'est pas une page de
  // statut : une erreur d'API ou une redirection rendrait cela.
  assert.strictEqual(S.parseSummary({ message: "Not Found" }), null);
});

test("un indicateur inconnu n'est jamais pris pour « tout va bien »", () => {
  const r = S.parseSummary({ status: { indicator: "banane" }, components: [], incidents: [] });
  assert.strictEqual(r.indicator, "unknown");
  assert.strictEqual(r.ok, false, "un etat qu'on ne comprend pas n'est PAS un etat sain");
});

test("un etat de composant inconnu est signale, pas ignore", () => {
  const r = S.parseSummary({
    status: { indicator: "minor" },
    components: [{ id: "c1", name: "Truc", status: "etat_inedit" }],
    incidents: []
  });
  assert.strictEqual(r.affected.length, 1);
  assert.strictEqual(r.affected[0].status, "unknown");
});

test("les tableaux absents sont traites comme vides", () => {
  const r = S.parseSummary({ status: { indicator: "none" } });
  assert.deepStrictEqual(r.affected, []);
  assert.deepStrictEqual(r.incidents, []);
  assert.deepStrictEqual(r.maintenances, []);
  assert.strictEqual(r.componentCount, 0);
});

console.log("== Garde-fou sur l'adresse ==");

test("une page de statut publique est acceptee, quel que soit le chemin colle", () => {
  for (const u of [
    "https://www.githubstatus.com",
    "www.githubstatus.com",
    "https://www.githubstatus.com/incidents/abc",
    "https://status.npmjs.org/api/v2/summary.json"
  ]) {
    const base = S.normalizeBase(u);
    assert.ok(base && /^https:\/\//.test(base), u);
    assert.ok(base.indexOf("/incidents") === -1 && base.indexOf("/api") === -1,
      "le chemin colle par l'utilisateur est jete : " + u);
  }
  assert.strictEqual(S.apiUrl("https://www.githubstatus.com"),
    "https://www.githubstatus.com/api/v2/summary.json");
});

/* Le serveur PiBoard tourne sur le reseau local et voit des machines que
   le navigateur ne voit pas. Laisser coller une adresse interne ferait
   du relais un moyen de sonder ce reseau. Une page de statut publique
   est, par definition, publique : il n'y a rien a perdre a refuser tout
   le reste.
   The PiBoard server sits on the local network and sees machines the
   browser cannot; allowing an internal address would turn the relay into
   a way to probe that network. */
test("tout ce qui n'a aucune raison d'etre une page publique est refuse", () => {
  const refuses = [
    "http://www.githubstatus.com",  // en clair / cleartext
    "https://localhost", "https://nas.local", "https://truc.internal",
    "https://192.168.1.10", "https://127.0.0.1", "https://10.0.0.5",
    "https://172.16.0.1", "https://169.254.1.1",
    "ftp://exemple.fr", "https://sansdomaine", "", "   ", null, undefined
  ];
  for (const u of refuses) {
    assert.strictEqual(S.normalizeBase(u), null, "doit etre refuse : " + JSON.stringify(u));
  }
});

test("une adresse refusee rend une erreur nette, sans appel reseau", async () => {
  const r = await S.getStatus("https://192.168.1.10");
  assert.strictEqual(r.error, "bad-url");
});

console.log("== Severites ==");

test("les severites se comparent dans le bon ordre", () => {
  assert.ok(S.INDICATOR_RANK.critical > S.INDICATOR_RANK.major);
  assert.ok(S.INDICATOR_RANK.major > S.INDICATOR_RANK.minor);
  assert.ok(S.INDICATOR_RANK.minor > S.INDICATOR_RANK.none);
  assert.ok(S.COMPONENT_RANK.major_outage > S.COMPONENT_RANK.partial_outage);
  assert.ok(S.COMPONENT_RANK.partial_outage > S.COMPONENT_RANK.degraded_performance);
  assert.ok(S.COMPONENT_RANK.degraded_performance > S.COMPONENT_RANK.operational);
});

setTimeout(() => {
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS SERVICESTATUS PASSENT");
  process.exit(failures ? 1 : 0);
}, 50);
