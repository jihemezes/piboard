/* ============================================================
   PiBoard - server/serviceProviders.js
   Adaptateurs de pages de statut : ramener CINQ formats differents a
   l'objet unique que la tuile « Statut de service » sait afficher.

   POURQUOI CE FICHIER EXISTE. La tuile ne lisait qu'un format, la
   « Statuspage » d'Atlassian (/api/v2/summary.json). Ce pari couvre la
   majorite des services -- GitHub, Cloudflare, npm, Stripe, OpenAI... --
   mais il laisse dehors exactement les plus gros : AWS, Google Cloud et
   Azure n'emploient pas Statuspage et publient chacun sa propre forme.
   Rallonger la liste des services sans toucher au lecteur n'aurait donc
   rien donne : le travail reel est ici, et il est fait UNE fois.

   LA REGLE DE CONCEPTION : chaque adaptateur est une fonction PURE. Il
   recoit le corps de la reponse (objet JSON deja analyse, ou texte pour
   le RSS) et rend la meme structure que parseSummary(), rien de plus. Pas
   de reseau, pas d'horloge sauf celle qu'on lui passe. C'est ce qui rend
   chacun testable hors ligne sur un relevé fige -- y compris un incident
   reel capture a l'avance, impossible a reproduire en attendant qu'AWS
   tombe en panne.

   CE QU'ON NE PEUT PAS FAIRE, ET POURQUOI C'EST DIT PLUTOT QUE CACHE.
   Les formats JSON (Statuspage, Instatus, Google, AWS) rendent un etat
   EXPLICITE : le fournisseur dit lui-meme « degrade » ou « panne ». Un
   flux RSS, lui, ne rend que des billets datés : il faut DEDUIRE l'etat
   de la presence d'un billet recent. La deduction est honnete mais ce
   n'est pas la meme information, et les services lus ainsi portent donc
   un drapeau `approximate` que la tuile affiche. Deux etats qui se
   ressemblent a l'ecran doivent produire deux messages distincts --
   lecon de la tuile Sante Internet, ou « premier relevé a venir » et
   « le serveur ne mesure rien » etaient indiscernables.

   Status page adapters: bringing FIVE different formats down to the one
   object the Service status tile knows how to display.
   WHY THIS FILE EXISTS: the tile read only Atlassian's Statuspage
   format, which covers most services but leaves out precisely the
   biggest -- AWS, Google Cloud and Azure each publish their own shape.
   Lengthening the service list without touching the reader would have
   achieved nothing; the real work is here, and it is done ONCE.
   DESIGN RULE: every adapter is a PURE function -- it takes the response
   body and returns parseSummary()'s structure, with no network and no
   clock but the one passed in, so each is testable offline against a
   frozen reading, including a real incident captured in advance.
   WHAT CANNOT BE DONE, SAID RATHER THAN HIDDEN: the JSON formats report
   an EXPLICIT state, whereas an RSS feed only yields dated posts, from
   which a state must be INFERRED. The inference is honest but it is not
   the same information, so services read that way carry an
   `approximate` flag the tile displays.
   ============================================================ */
"use strict";

const { XMLParser } = require("fast-xml-parser");

/* Severite croissante : partagee avec serviceStatus.js, qui la reexporte
   pour la tuile. Increasing severity, shared with serviceStatus.js. */
const INDICATOR_RANK = { none: 0, minor: 1, major: 2, critical: 3 };
const COMPONENT_RANK = {
  operational: 0,
  under_maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4
};

/* Forme commune rendue par TOUS les adaptateurs. La declarer ici plutot
   que de la recopier dans chacun evite qu'un adaptateur oublie un champ
   et fasse tomber l'affichage sur un `undefined` -- la tuile lit
   `svc.affected.length` sans precaution, et c'est tant mieux : elle n'a
   pas a se defendre contre ses propres fournisseurs de donnees.
   Common shape returned by ALL adapters, declared here rather than
   copied into each, so no adapter can forget a field and break the tile
   on an `undefined`. */
function emptyState(extra) {
  return Object.assign({
    name: null,
    url: null,
    updatedAt: null,
    indicator: "unknown",
    description: null,
    ok: false,
    componentCount: 0,
    affected: [],
    incidents: [],
    maintenances: [],
    approximate: false
  }, extra || {});
}

function dateMs(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
}

function text(v, max) {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return max ? s.slice(0, max) : s;
}

/* Les billets d'incident contiennent souvent du HTML (Azure, OVH). On ne
   l'affiche pas tel quel : la tuile echappe tout ce qu'elle recoit, donc
   des balises brutes apparaitraient a l'ecran. On les retire ici, au
   plus pres de la source.
   Incident posts often carry HTML; the tile escapes everything it
   receives, so raw tags would show on screen. Stripped here, closest to
   the source. */
function stripHtml(v) {
  return text(String(v == null ? "" : v)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\""));
}

/* ============================================================
   1. Statuspage (Atlassian) -- /api/v2/summary.json
   Le format d'origine, et toujours le plus riche : c'est le seul qui
   donne l'etat de CHAQUE composant, donc le seul qui permette de dire
   ou le probleme se situe plutot qu'un vague « ca ne va pas ».
   The original format and still the richest: the only one giving each
   COMPONENT's state, hence the only one able to say WHERE the problem
   is.
   ============================================================ */
function parseStatuspage(json) {
  /* `typeof [] === "object"` : un tableau JSON franchissait ce filtre et
     ressortait en etat « inconnu » parfaitement forme, alors que ce
     n'est pas une reponse de Statuspage du tout. Defaut trouve par le
     test, pas a la relecture.
     `typeof [] === "object"`: a JSON array slipped through and came out
     as a well-formed "unknown" state although it is not a Statuspage
     response at all. Found by the test, not by re-reading. */
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const hasSection = ["status", "components", "incidents", "page", "scheduled_maintenances"]
    .some((k) => Object.prototype.hasOwnProperty.call(json, k));
  if (!hasSection) return null;

  const status = json.status || {};
  /* « maintenance » ne figure pas dans les quatre indicateurs documentes
     par Atlassian (none / minor / major / critical), mais les pages
     d'OVHcloud le rendent -- et il ressortait donc en etat INCONNU,
     alors meme que la tuile affichait en dessous les composants en
     maintenance et « aucun incident en cours ». Une maintenance
     declaree n'est pas une panne, et surtout pas une ignorance : elle
     vaut « operationnel », l'information etant portee par la ligne de
     maintenance. Meme regle que chez Instatus et Fastly.
     "maintenance" is not among Atlassian's four documented indicators,
     but OVHcloud's pages return it -- so it came out as UNKNOWN while
     the tile showed the components under maintenance right below. A
     declared maintenance is not an outage, and certainly not ignorance. */
  const raw = status.indicator === "maintenance" ? "none" : status.indicator;
  const indicator = Object.prototype.hasOwnProperty.call(INDICATOR_RANK, raw)
    ? raw
    : "unknown";

  /* Les entetes de GROUPE (« group: true ») ne sont pas des composants :
     ce sont des titres de rubrique, dont l'etat n'est qu'un resume de
     leurs enfants. Les afficher ferait apparaitre un probleme en double,
     une fois sous le nom du groupe et une fois sous celui du composant
     reellement touche -- et le nom du groupe est le moins precis des
     deux, donc le moins utile.
     GROUP headers are not components but section titles whose state
     merely summarises their children: showing them would double every
     problem, under the less precise of the two names. */
  const components = (Array.isArray(json.components) ? json.components : [])
    .filter((c) => c && !c.group && c.name)
    .map((c) => ({
      name: String(c.name),
      status: Object.prototype.hasOwnProperty.call(COMPONENT_RANK, c.status) ? c.status : "unknown",
      group: c.group_id ? groupNameFor(json.components, c.group_id) : null
    }));

  const affected = components
    .filter((c) => c.status !== "operational")
    .sort((a, b) => (COMPONENT_RANK[b.status] || 0) - (COMPONENT_RANK[a.status] || 0));

  const incidents = (Array.isArray(json.incidents) ? json.incidents : [])
    .filter((i) => i && i.name)
    .map((i) => {
      /* Le dernier message publie. Statuspage rend les mises a jour de
         la PLUS RECENTE a la plus ancienne, mais on ne s'y fie pas : on
         prend la plus recente par sa date. Un tableau reordonne un jour
         par l'editeur afficherait sinon le message d'ouverture de
         l'incident, c'est-a-dire la pire information possible -- la plus
         perimee, presentee comme la derniere nouvelle.
         The latest published message, picked by DATE rather than by
         position: a reordered array would otherwise show the incident's
         opening message as if it were the latest news. */
      const updates = Array.isArray(i.incident_updates) ? i.incident_updates.slice() : [];
      updates.sort((a, b) => dateMs(b && (b.display_at || b.created_at)) - dateMs(a && (a.display_at || a.created_at)));
      const last = updates[0] || null;
      return {
        id: i.id || null,
        name: String(i.name),
        status: i.status || null,
        impact: i.impact || null,
        url: i.shortlink || null,
        startedAt: i.started_at || i.created_at || null,
        updatedAt: i.updated_at || (last && (last.display_at || last.created_at)) || null,
        lastMessage: last && last.body ? String(last.body).trim() : null,
        components: (Array.isArray(i.components) ? i.components : [])
          .filter((c) => c && c.name).map((c) => String(c.name))
      };
    });

  const maintenances = (Array.isArray(json.scheduled_maintenances) ? json.scheduled_maintenances : [])
    .filter((m) => m && m.name)
    .map((m) => ({
      name: String(m.name),
      status: m.status || null,
      scheduledFor: m.scheduled_for || null,
      scheduledUntil: m.scheduled_until || null,
      url: m.shortlink || null
    }));

  return emptyState({
    name: (json.page && json.page.name) ? String(json.page.name) : null,
    url: (json.page && json.page.url) ? String(json.page.url) : null,
    updatedAt: (json.page && json.page.updated_at) || null,
    indicator,
    description: status.description ? String(status.description) : null,
    /* `ok` est volontairement STRICT : tout ce qui n'est pas « none »
       est anormal, y compris « minor ». C'est ce qui fait passer la
       tuile en cadence rapide, et une degradation mineure est
       precisement le moment ou l'on veut suivre de pres.
       `ok` is deliberately STRICT, minor included -- a minor degradation
       is exactly when one wants to watch closely. */
    ok: indicator === "none",
    componentCount: components.length,
    affected,
    incidents,
    maintenances
  });
}

function groupNameFor(components, groupId) {
  const g = components.find((c) => c && c.id === groupId && c.group);
  return g && g.name ? String(g.name) : null;
}

/* ============================================================
   2. Instatus -- /summary.json
   Concurrent direct de Statuspage, employe par Railway, Mistral et une
   partie des jeunes editeurs. Le format est proche mais PAS identique :
   l'etat global est une chaine en majuscules (« UP », « HASISSUES »,
   « UNDERMAINTENANCE ») et les composants ne portent pas d'etat
   exploitable dans le resume. On traduit, et on n'invente pas de
   composants qu'on n'a pas.
   Instatus: a direct Statuspage competitor whose shape is close but NOT
   identical -- the overall state is an upper-case string and the summary
   carries no usable per-component state. We translate, and do not invent
   components we do not have.
   ============================================================ */
const INSTATUS_STATE = {
  UP: "none",
  HASISSUES: "major",
  UNDERMAINTENANCE: "none",
  DEGRADEDPERFORMANCE: "minor",
  PARTIALOUTAGE: "major",
  MAJOROUTAGE: "critical"
};

function parseInstatus(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const page = json.page;
  if (!page || typeof page !== "object" || !page.status) return null;
  const raw = String(page.status).toUpperCase().replace(/[^A-Z]/g, "");
  const indicator = Object.prototype.hasOwnProperty.call(INSTATUS_STATE, raw)
    ? INSTATUS_STATE[raw]
    : "unknown";

  const incidents = (Array.isArray(json.activeIncidents) ? json.activeIncidents : [])
    .filter((i) => i && i.name)
    .map((i) => ({
      id: i.id || null,
      name: text(i.name, 200),
      status: i.status || null,
      impact: i.impact || null,
      url: i.url || null,
      startedAt: i.started || i.createdAt || null,
      updatedAt: i.updated || null,
      lastMessage: null,
      components: []
    }));

  const maintenances = (Array.isArray(json.activeMaintenances) ? json.activeMaintenances : [])
    .filter((m) => m && m.name)
    .map((m) => ({
      name: text(m.name, 200),
      status: m.status || null,
      scheduledFor: m.start || null,
      scheduledUntil: m.end || null,
      url: m.url || null
    }));

  /* Une maintenance en cours declaree « UNDERMAINTENANCE » n'est pas une
     panne : l'etat global reste sain, et c'est la ligne de maintenance
     qui porte l'information. Confondre les deux ferait sonner l'alerte
     pour une operation prevue -- la facon la plus sure de faire couper
     les notifications.
     An ongoing declared maintenance is not an outage: the overall state
     stays healthy and the maintenance line carries the information. */
  return emptyState({
    name: page.name ? text(page.name, 120) : null,
    url: page.url ? String(page.url) : null,
    indicator,
    description: null,
    ok: indicator === "none",
    incidents,
    maintenances
  });
}

/* ============================================================
   3. Google -- incidents.json (Google Cloud et Google Workspace)
   Un TABLEAU d'incidents, pas un resume : il n'y a aucun etat global a
   lire, il faut le deduire des incidents OUVERTS. Et c'est la qu'est le
   piege : le fichier contient tout l'historique, des centaines
   d'incidents refermes depuis des mois. Prendre le premier element du
   tableau afficherait donc une panne vieille d'un an comme si elle etait
   en cours. Un incident est ouvert quand il n'a PAS de date de fin.
   Google: an ARRAY of incidents rather than a summary -- there is no
   overall state to read, it must be inferred from the OPEN ones. The
   trap: the file holds the whole history, hundreds of incidents closed
   months ago, so taking the array's first element would show a year-old
   outage as ongoing. An incident is open when it has NO end date.
   ============================================================ */
const GOOGLE_IMPACT = {
  SERVICE_INFORMATION: "minor",
  SERVICE_DISRUPTION: "major",
  SERVICE_OUTAGE: "critical"
};

function parseGoogle(json) {
  if (!Array.isArray(json)) return null;
  /* Un tableau vide est une reponse VALIDE et excellente nouvelle : zero
     incident. Le refuser comme « format inconnu » afficherait un etat
     inconnu les jours ou tout va bien.
     An empty array is a VALID answer and good news: zero incidents.
     Refusing it as "unknown format" would show an unknown state on the
     days everything is fine. */
  if (json.length && !json.some((i) => i && (i.id || i.number || i.external_desc))) return null;

  const open = json.filter((i) => i && !i.end);
  let indicator = "none";
  for (const i of open) {
    const mapped = GOOGLE_IMPACT[String(i.status_impact || "").toUpperCase()] || "minor";
    if ((INDICATOR_RANK[mapped] || 0) > (INDICATOR_RANK[indicator] || 0)) indicator = mapped;
  }

  const incidents = open.map((i) => {
    const last = i.most_recent_update || (Array.isArray(i.updates) ? i.updates[i.updates.length - 1] : null);
    return {
      id: i.id || String(i.number || ""),
      name: text(i.external_desc, 200),
      status: last && last.status ? String(last.status) : null,
      impact: i.status_impact || null,
      /* `uri` est relatif (« incidents/xyz ») : on le rend absolu, sinon
         le lien de la tuile pointerait sur le tableau de bord PiBoard.
         `uri` is relative, made absolute here or the tile's link would
         point at PiBoard's own dashboard. */
      url: i.uri ? ("https://status.cloud.google.com/" + String(i.uri).replace(/^\/+/, "")) : null,
      startedAt: i.begin || i.created || null,
      updatedAt: i.modified || (last && last.modified) || null,
      lastMessage: last && last.text ? stripHtml(last.text).slice(0, 600) : null,
      components: (Array.isArray(i.affected_products) ? i.affected_products : [])
        .filter((p) => p && p.title).map((p) => text(p.title, 80))
    };
  });

  /* Les produits touches servent de « composants » : Google ne publie pas
     d'etat par composant, mais il nomme les produits concernes par chaque
     incident ouvert -- c'est la meme information utile (« ou ? »), prise
     par l'autre bout.
     Affected products stand in as "components": Google publishes no
     per-component state but names the products each open incident hits --
     the same useful information ("where?"), taken from the other end. */
  const affectedNames = [];
  for (const inc of incidents) for (const c of inc.components) if (affectedNames.indexOf(c) === -1) affectedNames.push(c);
  const compStatus = indicator === "critical" ? "major_outage"
    : indicator === "major" ? "partial_outage"
      : indicator === "minor" ? "degraded_performance" : "operational";

  return emptyState({
    indicator,
    ok: indicator === "none",
    affected: affectedNames.map((n) => ({ name: n, status: compStatus, group: null })),
    incidents,
    maintenances: []
  });
}

/* ============================================================
   4. AWS -- health.aws.amazon.com/public/currentevents
   Un tableau d'evenements EN COURS (le nom du point d'entree le dit) avec
   un `status` numerique. Deux particularites qui comptent :
     - `region_name` est l'information la plus utile de toutes : une panne
       sur ap-southeast-2 ne concerne pas quelqu'un qui travaille sur
       eu-west-1, et l'afficher evite une inquietude inutile ;
     - le journal `event_log` est du plus ancien au plus recent, soit
       l'inverse de Statuspage. On prend donc par la DATE, comme partout
       ailleurs dans ce fichier, plutot qu'en se fiant a un bout du
       tableau.
   AWS: an array of CURRENT events with a numeric `status`. Two
   particulars that matter: `region_name` is the single most useful field
   (an ap-southeast-2 outage does not concern someone working on
   eu-west-1), and `event_log` runs oldest-to-newest, the opposite of
   Statuspage -- so, as everywhere in this file, the latest entry is
   picked by DATE rather than by position.
   ============================================================ */
const AWS_STATUS = { 0: "none", 1: "minor", 2: "major", 3: "critical" };

function parseAws(json) {
  if (!Array.isArray(json)) return null;
  if (json.length && !json.some((e) => e && (e.service || e.service_name || e.arn))) return null;

  let indicator = "none";
  const incidents = [];
  const affected = [];

  for (const e of json) {
    if (!e) continue;
    const sev = AWS_STATUS[Number(e.status)] || "minor";
    if ((INDICATOR_RANK[sev] || 0) > (INDICATOR_RANK[indicator] || 0)) indicator = sev;

    /* Le tri passe par msFromAws() et NON par dateMs() : les
       horodatages AWS sont des nombres (secondes depuis l'epoque), que
       Date.parse() rend NaN. Avec dateMs(), toutes les entrees valaient
       0, le tri ne changeait rien, et le message affiche etait celui
       d'OUVERTURE de l'incident -- exactement le piege que ce tri est
       la pour eviter. Defaut trouve par le test, pas a la relecture.
       The sort goes through msFromAws() and NOT dateMs(): AWS
       timestamps are numbers, which Date.parse() turns into NaN. With
       dateMs() every entry scored 0, the sort changed nothing, and the
       displayed message was the incident's OPENING one -- precisely the
       trap this sort exists to avoid. Found by the test, not by
       re-reading. */
    const log = (Array.isArray(e.event_log) ? e.event_log.slice() : [])
      .sort((a, b) => msFromAws(b && (b.timestamp || b.date)) - msFromAws(a && (a.timestamp || a.date)));
    const last = log[0] || null;
    const region = e.region_name ? text(e.region_name, 40) : null;
    const service = text(e.service_name || e.service, 80);

    incidents.push({
      id: e.arn || null,
      name: (service || "AWS") + (region ? " — " + region : ""),
      status: null,
      impact: sev,
      url: "https://health.aws.amazon.com/health/status",
      startedAt: isoFromAws(e.date),
      updatedAt: last && (last.timestamp || last.date) ? isoFromAws(last.timestamp || last.date) : null,
      lastMessage: stripHtml((last && (last.message || last.summary)) || e.summary).slice(0, 600) || null,
      components: service ? [service] : []
    });

    if (service) {
      const label = service + (region ? " (" + region + ")" : "");
      affected.push({
        name: label,
        status: sev === "critical" ? "major_outage" : sev === "major" ? "partial_outage" : "degraded_performance",
        group: region
      });
    }
  }

  affected.sort((a, b) => (COMPONENT_RANK[b.status] || 0) - (COMPONENT_RANK[a.status] || 0));

  return emptyState({
    name: "Amazon Web Services",
    url: "https://health.aws.amazon.com/health/status",
    indicator,
    ok: indicator === "none",
    affected,
    incidents,
    maintenances: []
  });
}

/* Les dates AWS arrivent tantot en secondes, tantot en millisecondes,
   tantot en texte. Un horodatage en secondes pris pour des millisecondes
   affiche « il y a 56 ans » -- visible, mais seulement si on regarde.
   AWS dates arrive as seconds, milliseconds or text; seconds mistaken
   for milliseconds display "56 years ago". */
function msFromAws(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n < 1e11 ? n * 1000 : n;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function isoFromAws(v) {
  const ms = msFromAws(v);
  if (!ms) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ============================================================
   5. RSS -- Azure, OVH et tous les « travaux.* »
   LE CAS HONNETE A PART. Un flux RSS ne dit pas « je vais bien » : il
   publie des billets datés. L'etat doit donc etre DEDUIT, et la
   deduction est explicitement arbitraire :
     - aucun billet recent (< 24 h) => on affiche « sain », parce que
       c'est l'interpretation utile ET parce que l'alternative -- un etat
       « inconnu » permanent -- rendrait la tuile muette pour ces
       services ;
     - un billet recent dont le titre annonce une resolution => sain ;
     - un billet recent quelconque => « mineur », jamais plus. On
       n'escalade pas en « panne majeure » sur la foi d'un titre : le
       flux ne contient pas l'information, et afficher un rouge qu'on
       n'a pas vu ecrit serait pire qu'un orange prudent.
   Et surtout : `approximate` est mis a vrai. La tuile l'affiche, et la
   personne sait que cet etat est deduit et non declare -- c'est la
   difference entre une information et une supposition presentee comme
   une information.
   THE HONEST SPECIAL CASE. An RSS feed never says "I am fine", it
   publishes dated posts, so the state is INFERRED and the inference is
   explicitly arbitrary: no recent post (< 24 h) means healthy (the
   useful reading, and the alternative -- a permanent "unknown" -- would
   make the tile mute for these services); a recent post announcing a
   resolution means healthy; any other recent post means "minor", never
   worse, because the feed does not carry that information and showing a
   red nobody wrote would be worse than a cautious amber. Above all,
   `approximate` is set, and the tile says so: the difference between
   information and a guess dressed as information.
   ============================================================ */
const RSS_FRESH_MS = 24 * 3600 * 1000;
const RSS_RESOLVED = /(resolved|resolu|résolu|closed|cloture|clôturé|termin|rétabli|retabli|mitigated)/i;

function parseRss(xml, opts) {
  const now = (opts && opts.now) || Date.now();
  if (typeof xml !== "string" || !/<(rss|feed|rdf:RDF)/i.test(xml)) return null;

  let doc;
  try {
    doc = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => name === "item" || name === "entry"
    }).parse(xml);
  } catch (e) {
    return null;
  }

  const channel = (doc.rss && doc.rss.channel) || (doc["rdf:RDF"] || {}) || {};
  const feed = doc.feed || {};
  const rawItems = channel.item || feed.entry || doc["rdf:RDF"] && doc["rdf:RDF"].item || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).filter(Boolean);

  const posts = items.map((it) => {
    const link = typeof it.link === "object" && it.link ? (it.link["@_href"] || it.link["#text"] || null) : (it.link || null);
    const when = it.pubDate || it.updated || it.published || it["dc:date"] || null;
    return {
      title: stripHtml(it.title && it.title["#text"] ? it.title["#text"] : it.title).slice(0, 200),
      body: stripHtml(it.description || it.summary || (it.content && (it.content["#text"] || it.content)) || "").slice(0, 600),
      at: when ? new Date(dateMs(when)).toISOString() : null,
      ms: dateMs(when),
      url: link ? String(link) : null
    };
  }).sort((a, b) => b.ms - a.ms);

  const recent = posts.filter((p) => p.ms && (now - p.ms) < RSS_FRESH_MS);
  const live = recent.filter((p) => !RSS_RESOLVED.test(p.title));
  const indicator = live.length ? "minor" : "none";

  return emptyState({
    name: stripHtml((channel.title && (channel.title["#text"] || channel.title)) || (feed.title && (feed.title["#text"] || feed.title))).slice(0, 120) || null,
    url: typeof channel.link === "string" ? channel.link : null,
    updatedAt: posts[0] ? posts[0].at : null,
    indicator,
    ok: indicator === "none",
    approximate: true,
    incidents: live.slice(0, 3).map((p, i) => ({
      id: "rss-" + i,
      name: p.title || "—",
      status: null,
      impact: "minor",
      url: p.url,
      startedAt: p.at,
      updatedAt: p.at,
      lastMessage: p.body || null,
      components: []
    })),
    maintenances: []
  });
}


/* ============================================================
   6. PayPal -- /api/v1/components
   Pourquoi un adaptateur rien que pour eux : paypal-status.com n'est
   aucun des cinq formats precedents, et c'est precisement le genre de
   service qu'on surveille. Leur API maison est publique, sans cle, et
   donne l'etat de CHAQUE produit -- donc aussi riche que Statuspage de
   ce point de vue.

   UN CHOIX A EXPLIQUER : chaque composant porte DEUX etats, production
   et sandbox. La tuile ne lit que la PRODUCTION. Afficher les deux
   doublerait trente composants pour une information qui n'interesse que
   pendant un developpement, et surtout : une sandbox en panne ferait
   passer la tuile au rouge alors que les paiements reels passent. On
   surveille ce qui encaisse.
   Why an adapter of their own: paypal-status.com is none of the five
   formats above, and it is exactly the kind of service one watches.
   Their in-house API is public, key-less, and gives EACH product's
   state. One choice to explain: every component carries TWO states,
   production and sandbox; the tile reads PRODUCTION only. Showing both
   would double thirty components for information that matters only
   while developing -- and a broken sandbox would turn the tile red
   while real payments go through. We watch what takes the money.
   ============================================================ */
const PAYPAL_STATE = {
  OPERATIONAL: "operational",
  DEGRADED: "degraded_performance",
  DEGRADEDPERFORMANCE: "degraded_performance",
  PARTIALOUTAGE: "partial_outage",
  PARTIALSERVICEDISRUPTION: "partial_outage",
  MAJOROUTAGE: "major_outage",
  OUTAGE: "major_outage",
  SERVICEDISRUPTION: "major_outage",
  MAINTENANCE: "under_maintenance",
  UNDERMAINTENANCE: "under_maintenance"
};

function parsePaypal(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.result)) return null;

  const components = json.result
    .filter((c) => c && c.name && c.status && typeof c.status === "object")
    .map((c) => {
      const raw = String(c.status.production || "").toUpperCase().replace(/[^A-Z]/g, "");
      return {
        name: text(c.displayName || c.name, 120),
        status: Object.prototype.hasOwnProperty.call(PAYPAL_STATE, raw) ? PAYPAL_STATE[raw] : "unknown",
        group: c.parentName ? text(c.parentName, 80) : null
      };
    });
  /* Une reponse bien formee mais VIDE n'est pas une lecture : si la
     liste est vide, on rend null pour que « auto » continue a sonder
     plutot que d'afficher un service sans aucun composant comme sain.
     A well-formed but EMPTY answer is not a reading. */
  if (!components.length) return null;

  return fromComponents({ name: "PayPal", url: "https://www.paypal-status.com", components });
}

/* ============================================================
   7. Status.io -- https://api.status.io/1.0/status/<id>
   Le troisieme editeur de pages de statut, derriere Atlassian et
   Instatus, et celui de GitLab. L'identifiant de page se lit dans la
   page elle-meme ; le catalogue le porte en adresse d'API explicite,
   ce qui evite d'avoir a le deviner.
   The third status-page vendor, behind Atlassian and Instatus, and
   GitLab's. The page id is carried by the catalogue as an explicit API
   address rather than guessed.
   ============================================================ */
const STATUSIO_CODE = {
  100: "operational",
  200: "under_maintenance",
  300: "degraded_performance",
  400: "partial_outage",
  500: "major_outage",
  600: "major_outage"
};

function parseStatusio(json) {
  const result = json && typeof json === "object" ? json.result : null;
  if (!result || typeof result !== "object" || !Array.isArray(result.status)) return null;

  const components = result.status
    .filter((s) => s && s.name)
    .map((s) => ({
      name: text(s.name, 120),
      status: Object.prototype.hasOwnProperty.call(STATUSIO_CODE, Number(s.status_code))
        ? STATUSIO_CODE[Number(s.status_code)]
        : "unknown",
      group: null
    }));
  if (!components.length) return null;

  const incidents = (Array.isArray(result.incidents) ? result.incidents : [])
    .filter((i) => i && i.name)
    .map((i) => {
      const updates = Array.isArray(i.messages) ? i.messages.slice() : [];
      updates.sort((a, b) => dateMs(b && b.datetime) - dateMs(a && a.datetime));
      const last = updates[0] || null;
      return {
        id: i._id || null,
        name: text(i.name, 200),
        status: null,
        impact: null,
        url: null,
        startedAt: i.datetime || null,
        updatedAt: last && last.datetime ? last.datetime : i.datetime || null,
        lastMessage: last && last.details ? stripHtml(last.details).slice(0, 600) : null,
        components: []
      };
    });

  const state = fromComponents({
    name: result.status_overall && result.status_overall.name ? text(result.status_overall.name, 120) : null,
    url: null,
    components
  });
  state.incidents = incidents;
  state.updatedAt = (result.status_overall && result.status_overall.updated) || null;
  return state;
}

/* ============================================================
   8. Fastly -- fastlystatus.com/summary.json
   Fastly a quitte Statuspage pour une page maison, au passage sur un
   AUTRE domaine : status.fastly.com redirige vers fastlystatus.com.
   Le chemin ressemble a celui d'Instatus (/summary.json) mais le schema
   n'a rien a voir -- piege a repetition : un JSON valide au bon chemin
   n'est pas le bon format pour autant, et c'est le lecteur qui doit le
   dire en rendant null.
   Fastly left Statuspage for an in-house page, on ANOTHER domain. The
   path looks like Instatus's but the schema is unrelated: a valid JSON
   at the right path is not the right format, and it is the reader's job
   to say so by returning null.
   ============================================================ */
const FASTLY_STATE = {
  OPERATIONAL: "none",
  MAINTENANCE: "none",
  INFORMATIONAL: "none",
  DEGRADED: "minor",
  DEGRADEDPERFORMANCE: "minor",
  PARTIALOUTAGE: "major",
  OUTAGE: "critical",
  MAJOROUTAGE: "critical"
};

function parseFastly(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  if (typeof json.Status !== "string" || !Object.prototype.hasOwnProperty.call(json, "PageName")) return null;

  const raw = json.Status.toUpperCase().replace(/[^A-Z]/g, "");
  const indicator = Object.prototype.hasOwnProperty.call(FASTLY_STATE, raw) ? FASTLY_STATE[raw] : "unknown";

  /* Une maintenance declaree n'est pas une panne : elle ressort en
     maintenance programmee, pas en incident, exactement comme chez
     Instatus. A declared maintenance is not an outage. */
  const isMaintenance = raw === "MAINTENANCE";
  const open = (Array.isArray(json.UnresolvedIncidents) ? json.UnresolvedIncidents : [])
    .filter((i) => i && i.Title);

  return emptyState({
    name: json.PageName ? text(json.PageName, 120) : "Fastly",
    url: "https://www.fastlystatus.com",
    updatedAt: json.StatusInEffectSince || null,
    indicator,
    description: json.StatusText ? text(json.StatusText, 120) : null,
    ok: indicator === "none",
    incidents: isMaintenance ? [] : open.map((i) => ({
      id: i.Id != null ? String(i.Id) : null,
      name: text(i.Title, 200),
      status: i.Status || null,
      impact: i.IncidentType || null,
      url: i.ShortUrl || null,
      startedAt: i.StartDate || i.DateCreated || null,
      updatedAt: i.DateCreated || null,
      lastMessage: null,
      components: []
    })),
    maintenances: isMaintenance ? open.map((i) => ({
      name: text(i.Title, 200),
      status: i.Status || null,
      scheduledFor: i.StartDate || null,
      scheduledUntil: i.EndDate || null,
      url: i.ShortUrl || null
    })) : []
  });
}

/* ============================================================
   9. Vultr -- status.vultr.com/status.json
   Format maison, documente par Vultr. Sa particularite : l'etat est
   range par REGION, et une alerte porte son propre `status`
   (« ongoing » / « resolved »). Les alertes RESOLUES restent dans le
   fichier -- les prendre pour des incidents en cours afficherait du
   rouge pour une panne refermee il y a trois semaines. Meme piege que
   l'historique complet de Google : un fichier de statut n'est pas une
   liste de ce qui va mal maintenant.
   In-house format documented by Vultr, arranged by REGION. RESOLVED
   alerts stay in the file; taking them for live incidents would show
   red for an outage closed three weeks ago -- the same trap as Google's
   full history.
   ============================================================ */
function parseVultr(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  if (!json.regions || typeof json.regions !== "object") return null;

  const live = [];
  const components = [];

  const push = (where, alerts) => {
    const open = (Array.isArray(alerts) ? alerts : [])
      .filter((a) => a && a.subject && String(a.status || "").toLowerCase() !== "resolved");
    components.push({
      name: text(where, 120),
      status: open.length ? "partial_outage" : "operational",
      group: null
    });
    for (const a of open) {
      const entries = Array.isArray(a.entries) ? a.entries.slice() : [];
      entries.sort((x, y) => dateMs(y && y.updated_at) - dateMs(x && x.updated_at));
      const last = entries[0] || null;
      live.push({
        id: a.id || null,
        name: text(a.subject, 200) + " — " + text(where, 60),
        status: a.status || null,
        impact: "major",
        url: "https://status.vultr.com",
        startedAt: a.start_date || null,
        updatedAt: (last && last.updated_at) || a.updated_at || a.start_date || null,
        lastMessage: last && last.message ? stripHtml(last.message).slice(0, 600) : null,
        components: [text(where, 60)]
      });
    }
  };

  for (const key of Object.keys(json.regions)) {
    const r = json.regions[key];
    if (!r || typeof r !== "object") continue;
    push(r.location || key, r.alerts);
  }
  if (!components.length) return null;
  if (Array.isArray(json.service_alerts) && json.service_alerts.length) push("Services", json.service_alerts);

  const state = fromComponents({ name: "Vultr", url: "https://status.vultr.com", components });
  state.incidents = live.slice(0, 5);
  return state;
}

/* ============================================================
   10. Endpoint -- une simple requete HTTPS sur une API publique
   POUR LES SERVICES QUI NE PUBLIENT RIEN. pCloud, Alibaba Cloud,
   Hetzner : pas de page de statut lisible par une machine, pas de flux,
   rien. Le choix est alors entre ne rien dire du tout et mesurer ce
   qu'on PEUT mesurer -- la joignabilite de leur API publique depuis le
   Pi.

   CE QUE CET ADAPTATEUR NE DIT PAS, et c'est le plus important : il ne
   rapporte PAS la parole du fournisseur. « Joignable depuis chez vous »
   n'est pas « le fournisseur declare aller bien », et l'inverse non
   plus : un echec peut venir de votre connexion, de votre DNS, d'un
   cable sous-marin. L'etat est donc marque DEDUIT (`approximate`), comme
   pour le RSS, et un echec ne depasse jamais la degradation mineure --
   on ne declare pas une panne mondiale sur la foi d'un timeout.
   What this adapter does NOT say, and it matters most: it does not
   report the PROVIDER's word. "Reachable from your place" is not "the
   provider declares itself healthy", and a failure may be your own
   connection. The state is therefore marked INFERRED, as for RSS, and a
   failure never exceeds a minor degradation.
   ============================================================ */
function parseEndpoint(probe) {
  if (!probe || typeof probe !== "object" || typeof probe.ok !== "boolean") return null;
  const indicator = probe.ok ? "none" : "minor";
  return emptyState({
    name: null,
    url: probe.url || null,
    updatedAt: new Date().toISOString(),
    indicator,
    description: null,
    ok: probe.ok,
    approximate: true,
    componentCount: 1,
    affected: probe.ok ? [] : [{
      name: probe.host || "API",
      status: "degraded_performance",
      group: null
    }],
    incidents: [],
    maintenances: []
  });
}

/* Etat global deduit d'une liste de composants, pour les formats qui
   donnent les composants mais pas d'indicateur global (PayPal, Vultr,
   Status.io). Le global vaut le PIRE des composants : un seul composant
   en panne majeure ne doit pas se noyer dans trente composants verts.
   Overall state inferred from a component list, for the formats giving
   components but no overall indicator. The overall state is the WORST
   component: one major outage must not drown in thirty green ones. */
const COMPONENT_TO_INDICATOR = {
  operational: "none",
  under_maintenance: "none",
  degraded_performance: "minor",
  partial_outage: "major",
  major_outage: "critical",
  unknown: "unknown"
};

function fromComponents(opts) {
  const components = opts.components || [];
  const affected = components
    .filter((c) => c.status !== "operational")
    .sort((a, b) => (COMPONENT_RANK[b.status] || 0) - (COMPONENT_RANK[a.status] || 0));

  let indicator = "none";
  for (const c of affected) {
    const cand = COMPONENT_TO_INDICATOR[c.status] || "unknown";
    if ((INDICATOR_RANK[cand] || 0) > (INDICATOR_RANK[indicator] || 0)) indicator = cand;
  }

  return emptyState({
    name: opts.name || null,
    url: opts.url || null,
    indicator,
    ok: indicator === "none",
    componentCount: components.length,
    affected,
    incidents: [],
    maintenances: []
  });
}

/* ============================================================
   11. Better Stack -- <page>/index.json
   Le quatrieme editeur de pages de statut, et celui de Hugging Face.
   Format JSON:API : l'etat global est dans `data.attributes`, les
   composants et les incidents sont melanges dans un seul tableau
   `included`, distingues par leur `type`.

   PARTICULARITE QUI PIEGE : une page Better Stack rend 200 avec du HTML
   pour N'IMPORTE QUEL chemin inconnu -- y compris /api/v2/summary.json
   et /summary.json. Le sondage « auto » recevait donc 200 partout et
   concluait « format inconnu » ; c'est le message qu'a vu Jean-Michel.
   Chaque lecteur refusant ce qui n'est pas a lui, le sondage finit par
   tomber sur le bon, mais il fallait encore que celui-ci existe.
   The fourth status-page vendor, and Hugging Face's. A Better Stack page
   answers 200 with HTML for ANY unknown path, so probing received 200
   everywhere and concluded "unknown format".
   ============================================================ */
const BETTERSTACK_STATE = {
  operational: "operational",
  degraded: "degraded_performance",
  downtime: "major_outage",
  maintenance: "under_maintenance",
  resolved: "operational"
};

function parseBetterstack(json) {
  const data = json && typeof json === "object" ? json.data : null;
  if (!data || typeof data !== "object" || data.type !== "status_page") return null;
  const attrs = data.attributes || {};
  const included = Array.isArray(json.included) ? json.included : [];

  const components = included
    .filter((x) => x && x.type === "status_page_resource" && x.attributes && x.attributes.public_name)
    .map((x) => ({
      name: text(x.attributes.public_name, 120),
      status: Object.prototype.hasOwnProperty.call(BETTERSTACK_STATE, String(x.attributes.status))
        ? BETTERSTACK_STATE[String(x.attributes.status)]
        : "unknown",
      group: null
    }));
  if (!components.length) return null;

  /* Les rapports RESOLUS restent dans le fichier -- meme piege que
     Google et Vultr. On ne garde que ce qui est encore ouvert.
     RESOLVED reports stay in the file -- the same trap as Google and
     Vultr; only what is still open is kept. */
  const open = included
    .filter((x) => x && x.type === "status_report" && x.attributes && x.attributes.title)
    .filter((x) => String(x.attributes.aggregate_state || "").toLowerCase() !== "resolved");

  const state = fromComponents({
    name: attrs.company_name ? text(attrs.company_name, 120) : null,
    url: attrs.company_url ? String(attrs.company_url) : null,
    components
  });

  /* L'etat global DECLARE prime sur celui qu'on deduirait des
     composants : l'editeur peut annoncer une degradation avant que ses
     sondes ne la voient, et c'est sa parole qu'on affiche.
     The DECLARED overall state wins over the one inferred from the
     components: the vendor may announce a degradation before its probes
     see it, and it is their word we display. */
  const declared = String(attrs.aggregate_state || "").toLowerCase();
  if (declared === "downtime") { state.indicator = "critical"; state.ok = false; }
  else if (declared === "degraded") { state.indicator = state.indicator === "none" ? "minor" : state.indicator; state.ok = false; }

  state.updatedAt = attrs.updated_at || null;
  state.incidents = open.map((x) => ({
    id: x.id || null,
    name: text(x.attributes.title, 200),
    status: x.attributes.aggregate_state || null,
    impact: x.attributes.report_type || null,
    url: attrs.custom_domain ? "https://" + String(attrs.custom_domain) : null,
    startedAt: x.attributes.starts_at || null,
    updatedAt: x.attributes.ends_at || x.attributes.starts_at || null,
    lastMessage: null,
    components: []
  }));
  return state;
}

/* ============================================================
   12. Backblaze -- /data/payload.json
   Page maison. Deux particularites qui obligent a la traiter a part :
   ses composants ne portent AUCUN etat (juste un nom et un
   identifiant), et ses incidents ne declarent pas « resolu » -- c'est
   l'ABSENCE d'un horodatage de cloture qui dit qu'un incident est
   encore ouvert. L'etat global se deduit donc des seuls incidents
   ouverts, et non des composants comme partout ailleurs.
   In-house page. Its components carry NO state at all, and its
   incidents never declare "resolved": it is the ABSENCE of a closing
   timestamp that marks one as still open. The overall state is
   therefore inferred from open incidents alone. */
const BACKBLAZE_SEV = { SEV1: "critical", SEV2: "major", SEV3: "minor", SEV4: "minor" };
const BACKBLAZE_CLOSED = ["resolved", "closed", "completed", "ended"];

function parseBackblaze(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  if (!json.config || !Array.isArray(json.components)) return null;

  const open = (Array.isArray(json.incidents) ? json.incidents : [])
    .filter((i) => i && i.title)
    .filter((i) => {
      const ts = (i.timestamps && typeof i.timestamps === "object") ? i.timestamps : {};
      return !BACKBLAZE_CLOSED.some((k) => ts[k]);
    });

  let indicator = "none";
  for (const i of open) {
    const sev = BACKBLAZE_SEV[String(i.severitySlug || "").toUpperCase()] || "minor";
    if ((INDICATOR_RANK[sev] || 0) > (INDICATOR_RANK[indicator] || 0)) indicator = sev;
  }

  return emptyState({
    name: (json.config && json.config.companyName) ? text(json.config.companyName, 120) : "Backblaze",
    url: "https://status.backblaze.com",
    indicator,
    description: (json.config && json.config.operationalMessage && indicator === "none")
      ? text(json.config.operationalMessage, 120) : null,
    ok: indicator === "none",
    componentCount: json.components.length,
    /* Les composants n'ayant pas d'etat, on ne peut pas dire LESQUELS
       sont touches : l'incident le dit dans son titre, et c'est tout ce
       dont on dispose. Mieux vaut ne rien affirmer que de deviner.
       The components have no state, so we cannot say WHICH are
       affected; the incident says so in its title, and that is all we
       have. Better to assert nothing than to guess. */
    affected: [],
    incidents: open.map((i) => ({
      id: i.id || null,
      name: text(i.title, 200),
      status: i.severitySlug || null,
      impact: BACKBLAZE_SEV[String(i.severitySlug || "").toUpperCase()] || "minor",
      url: "https://status.backblaze.com",
      startedAt: (i.timestamps && (i.timestamps.started || i.timestamps.detected)) || null,
      updatedAt: (i.timestamps && (i.timestamps.investigating || i.timestamps.reported)) || null,
      lastMessage: i.customerImpactSummary ? stripHtml(i.customerImpactSummary).slice(0, 600) : null,
      components: []
    })),
    maintenances: []
  });
}

/* ---------- Table des adaptateurs / adapter table ----------
   `path` : ce qu'on ajoute a l'origine quand le catalogue ne fournit pas
   d'adresse d'API explicite. `kind` : comment lire la reponse.
   `path`: appended to the origin when the catalogue gives no explicit
   API address. `kind`: how to read the answer. */
const ADAPTERS = {
  statuspage: {
    path: "/api/v2/summary.json",
    kind: "json",
    parse: parseStatuspage,
    /* Repli quand summary.json n'existe pas. Oracle Cloud expose une
       Statuspage, mais SEULEMENT /api/v2/status.json : l'indicateur
       global, sans les composants. Un service lu a moitie vaut mieux
       qu'un service affiche comme illisible, et c'est la difference
       entre « OCI : tout operationnel » et une ligne grise.
       Fallback when summary.json does not exist: Oracle Cloud exposes a
       Statuspage, but ONLY /api/v2/status.json -- the overall indicator
       without the components. Half a reading beats an unreadable
       service. */
    fallbackPath: "/api/v2/status.json"
  },
  instatus: { path: "/summary.json", kind: "json", parse: parseInstatus },
  google: { path: "/incidents.json", kind: "json", parse: parseGoogle },
  aws: { path: "/public/currentevents", kind: "json", parse: parseAws },
  rss: { path: "/history.rss", kind: "text", parse: parseRss },
  paypal: { path: "/api/v1/components", kind: "json", parse: parsePaypal },
  statusio: { path: "/1.0/status", kind: "json", parse: parseStatusio },
  fastly: { path: "/summary.json", kind: "json", parse: parseFastly },
  vultr: { path: "/status.json", kind: "json", parse: parseVultr },
  /* `kind: "probe"` : le seul adaptateur qui ne lit pas un document mais
     constate une reponse. Voir parseEndpoint ci-dessus pour ce qu'il ne
     dit pas. The only adapter reading no document but observing an
     answer. */
  betterstack: { path: "/index.json", kind: "json", parse: parseBetterstack },
  backblaze: { path: "/data/payload.json", kind: "json", parse: parseBackblaze },
  endpoint: { path: "/", kind: "probe", parse: parseEndpoint }
};

/* Ordre de SONDAGE pour « auto ». Statuspage d'abord parce qu'il couvre
   la majorite des services et qu'on veut le toucher au premier essai ;
   le RSS en dernier parce qu'il ne rend qu'un etat deduit : si un format
   explicite existe, il doit gagner.
   PROBE order for "auto": Statuspage first because it covers most
   services and should be hit on the first try; RSS last because it only
   yields an inferred state -- any explicit format must win over it. */
/* Ordre de SONDAGE pour « auto ». Les formats maison (PayPal, Fastly,
   Vultr) y figurent APRES les trois generiques : ils sont rares, et
   chacun coute une requete a tous les autres services. L'« endpoint »
   n'y figure PAS DU TOUT -- il reussirait sur n'importe quelle adresse
   joignable, donc il gagnerait toujours, et tout service deviendrait
   « sain, deduit » au lieu d'etre lu pour de bon. Il ne s'emploie que
   declare explicitement par le catalogue.
   The in-house formats come AFTER the generic three: they are rare and
   each costs one request to every other service. "endpoint" is NOT in
   the list at all -- it would succeed on any reachable address, hence
   always win, and every service would become "healthy, inferred"
   instead of being properly read. It is used only when the catalogue
   declares it. */
const AUTO_ORDER = ["statuspage", "instatus", "betterstack", "google", "fastly", "vultr", "paypal", "rss"];

module.exports = {
  ADAPTERS,
  AUTO_ORDER,
  INDICATOR_RANK,
  COMPONENT_RANK,
  emptyState,
  parseStatuspage,
  parseInstatus,
  parseGoogle,
  parseAws,
  parseRss,
  parsePaypal,
  parseStatusio,
  parseFastly,
  parseVultr,
  parseEndpoint,
  parseBetterstack,
  parseBackblaze,
  fromComponents,
  stripHtml,
  msFromAws,
  isoFromAws
};
