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
  const indicator = Object.prototype.hasOwnProperty.call(INDICATOR_RANK, status.indicator)
    ? status.indicator
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

/* ---------- Table des adaptateurs / adapter table ----------
   `path` : ce qu'on ajoute a l'origine quand le catalogue ne fournit pas
   d'adresse d'API explicite. `kind` : comment lire la reponse.
   `path`: appended to the origin when the catalogue gives no explicit
   API address. `kind`: how to read the answer. */
const ADAPTERS = {
  statuspage: { path: "/api/v2/summary.json", kind: "json", parse: parseStatuspage },
  instatus: { path: "/summary.json", kind: "json", parse: parseInstatus },
  google: { path: "/incidents.json", kind: "json", parse: parseGoogle },
  aws: { path: "/public/currentevents", kind: "json", parse: parseAws },
  rss: { path: "/history.rss", kind: "text", parse: parseRss }
};

/* Ordre de SONDAGE pour « auto ». Statuspage d'abord parce qu'il couvre
   la majorite des services et qu'on veut le toucher au premier essai ;
   le RSS en dernier parce qu'il ne rend qu'un etat deduit : si un format
   explicite existe, il doit gagner.
   PROBE order for "auto": Statuspage first because it covers most
   services and should be hit on the first try; RSS last because it only
   yields an inferred state -- any explicit format must win over it. */
const AUTO_ORDER = ["statuspage", "instatus", "google", "rss"];

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
  stripHtml,
  msFromAws,
  isoFromAws
};
