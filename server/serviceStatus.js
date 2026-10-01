/* ============================================================
   PiBoard - server/serviceStatus.js
   Etat de sante des services en ligne, lu sur leur page de statut
   publique (GitHub, Cloudflare, npm, Docker Hub...).

   POURQUOI UNE SEULE IMPLEMENTATION SUFFIT POUR TOUS. La demande de
   depart ne visait que GitHub. Mais githubstatus.com n'est pas une page
   maison : c'est une « Statuspage » d'Atlassian, le service qu'emploient
   des centaines d'editeurs, et toutes exposent la MEME API publique au
   MEME chemin -- /api/v2/summary.json, sans cle ni compte. Ecrire une
   tuile specifique a GitHub aurait donc coute le meme travail tout en ne
   servant qu'une fois. On lit ici n'importe quelle Statuspage, et GitHub
   n'est que la premiere de la liste.

   CE QUE REND CETTE API, et qui est exactement ce qu'on veut afficher :
     - un indicateur global : none / minor / major / critical ;
     - l'etat de chaque COMPOSANT (« Git Operations », « Actions »,
       « Webhooks »...), ce qui permet de dire ou le probleme se situe
       plutot qu'un vague « ca ne va pas » ;
     - les INCIDENTS en cours, avec leur stade (Investigating,
       Identified, Monitoring...), leur impact, leur lien et surtout le
       dernier message publie -- souvent la seule information vraiment
       utile ;
     - les MAINTENANCES programmees : savoir qu'une interruption est
       prevue demain evite de chercher une panne qui n'existe pas.

   POURQUOI UN RELAIS SERVEUR plutot qu'un appel direct du navigateur :
   comme pour les autres tuiles reseau de PiBoard, le domaine distant
   n'a aucune raison d'autoriser nos requetes par CORS, et un cache
   partage evite que trois ecrans interrogent trois fois la meme page de
   statut pour une reponse identique.

   Health of online services, read from their public status page.
   WHY ONE IMPLEMENTATION COVERS THEM ALL: githubstatus.com is not a
   bespoke page but an Atlassian "Statuspage", used by hundreds of
   vendors, all exposing the SAME public API at the SAME path --
   /api/v2/summary.json, no key, no account. A GitHub-specific tile
   would have cost the same work and served once. Any Statuspage is read
   here, GitHub merely being first on the list.
   The API yields the overall indicator, each COMPONENT's state (so one
   can say WHERE the problem is), ongoing INCIDENTS with their stage,
   impact, link and latest message, and scheduled MAINTENANCES.
   A server relay rather than a direct browser call: the remote domain
   has no reason to allow our requests through CORS, and a shared cache
   stops three screens asking three times for an identical answer.
   ============================================================ */
"use strict";

const TIMEOUT_MS = 12000;

/* Duree minimale entre deux appels REELS vers une meme page de statut.
   Elle ne dicte PAS le rythme d'affichage -- celui-la est choisi par
   l'utilisateur dans la tuile, et peut descendre a la minute pendant un
   incident. Ce plancher protege simplement d'un tableau a plusieurs
   ecrans, ou de plusieurs tuiles surveillant le meme service : tous
   partagent la meme reponse. 20 s laisse passer une cadence d'une
   minute sans jamais la brider.
   Minimum between two REAL calls to the same status page. It does NOT
   dictate the display rhythm, chosen by the user and possibly down to
   the minute during an incident; this floor merely protects against a
   multi-screen board or several tiles watching the same service. */
const MIN_FETCH_MS = 20000;

const cache = new Map(); // url normalisee -> { at, value, inflight }

/* ---------- Garde-fou sur l'adresse / address guard ----------
   L'utilisateur colle une URL librement : il n'y a pas de liste blanche
   possible, les pages de statut vivant sur des domaines quelconques
   (githubstatus.com, status.npmjs.org, xxx.statuspage.io...). On ne peut
   donc pas verifier QUI est au bout, mais on peut refuser ce qui n'a
   aucune raison d'etre une page de statut publique.

   CE QU'ON REFUSE, ET POURQUOI. Le serveur PiBoard tourne sur le reseau
   local, souvent sur un Pi qui voit des machines que le navigateur ne
   voit pas. Une URL pointant vers localhost ou vers une adresse privee
   ferait du relais un moyen d'interroger le reseau interne depuis
   l'exterieur -- un classique, et il n'y a aucune raison de l'offrir ici
   puisqu'une page de statut publique est, par definition, publique.
   HTTP simple est refuse pour la meme raison qu'ailleurs dans PiBoard :
   rien ne justifie d'aller chercher en clair une ressource qui existe en
   HTTPS partout.

   The user pastes a URL freely and no allowlist is possible, status
   pages living on arbitrary domains. We cannot check WHO is at the other
   end, but we can refuse what has no business being a public status
   page: the PiBoard server runs on the local network, often on a Pi that
   sees machines the browser cannot, so a URL pointing at localhost or a
   private address would turn the relay into a way to probe the internal
   network. A public status page is, by definition, public. */
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;
const PRIVATE_IPV4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function normalizeBase(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
  } catch (e) {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname;
  if (!host || host.indexOf(".") === -1) return null;        // pas de nom nu / no bare name
  if (PRIVATE_HOST.test(host)) return null;
  if (PRIVATE_IPV4.test(host)) return null;
  if (/^\[|:/.test(host)) return null;                        // IPv6 litterale / literal IPv6
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;         // IPv4 litterale / literal IPv4
  /* On ne garde QUE l'origine : le chemin colle par l'utilisateur est
     jete. Qu'il donne la page d'accueil, une page d'incident ou deja
     l'URL de l'API, on construit nous-memes le chemin -- une seule
     forme a tester, et aucun chemin arbitraire ne part sur le reseau.
     ONLY the origin is kept; whatever path the user pasted is dropped
     and we build the API path ourselves. */
  return u.origin;
}

function apiUrl(base) {
  return base + "/api/v2/summary.json";
}

/* ---------- Analyse / parsing ----------
   Fonction PURE : elle prend l'objet JSON et rend ce que la tuile
   affiche, sans reseau ni horloge. Toute la logique delicate -- quels
   composants sont « touches », quel est le dernier message d'un
   incident -- est donc testable hors ligne, sur des relevés figes, y
   compris un incident reel capture a l'avance.
   PURE function: takes the JSON object and returns what the tile shows,
   with no network and no clock, so every delicate decision is testable
   offline against frozen readings. */

/* Severite croissante, pour comparer deux etats sans empiler des "si".
   Increasing severity, to compare two states without stacking ifs. */
const INDICATOR_RANK = { none: 0, minor: 1, major: 2, critical: 3 };
const COMPONENT_RANK = {
  operational: 0,
  under_maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4
};

function parseSummary(json) {
  /* `typeof [] === "object"` : un tableau JSON franchissait ce filtre et
     ressortait en etat « inconnu » parfaitement forme, alors que ce
     n'est pas une reponse de Statuspage du tout. On exige donc un objet
     NON tableau, portant au moins une des sections attendues -- sans
     quoi une page qui rend du JSON quelconque (une erreur d'API, une
     redirection vers autre chose) serait affichee comme un service dont
     on ne comprend pas l'etat, plutot que comme une reponse a jeter.
     Defaut trouve par le test, pas a la relecture.
     `typeof [] === "object"`: a JSON array slipped through and came out
     as a perfectly formed "unknown" state, although it is not a
     Statuspage response at all. A NON-array object carrying at least one
     expected section is now required. Found by the test, not by
     re-reading. */
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
      // Le nom de la rubrique, utile pour situer un composant au nom
      // ambigu. The section's name, useful to place an ambiguous one.
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
         The latest published message. Statuspage returns updates newest
         first, but we do not rely on it and pick by date: a reordered
         array would otherwise show the incident's opening message as if
         it were the latest news. */
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
        // Composants nommes par l'incident lui-meme, quand il en cite.
        // Components the incident itself names, when it names any.
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

  return {
    name: (json.page && json.page.name) ? String(json.page.name) : null,
    url: (json.page && json.page.url) ? String(json.page.url) : null,
    updatedAt: (json.page && json.page.updated_at) || null,
    indicator,
    description: status.description ? String(status.description) : null,
    /* `ok` est volontairement STRICT : tout ce qui n'est pas « none »
       est anormal, y compris « minor ». C'est ce qui fait passer la
       tuile en cadence rapide, et une degradation mineure est
       precisement le moment ou l'on veut suivre de pres.
       `ok` is deliberately STRICT: anything other than "none" is
       abnormal, minor included -- and a minor degradation is exactly
       when one wants to watch closely. */
    ok: indicator === "none",
    componentCount: components.length,
    affected,
    incidents,
    maintenances
  };
}

function groupNameFor(components, groupId) {
  const g = components.find((c) => c && c.id === groupId && c.group);
  return g && g.name ? String(g.name) : null;
}

function dateMs(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
}

/* ---------- Appel reseau / network call ---------- */

async function fetchSummary(base) {
  const res = await fetch(apiUrl(base), {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("status " + res.status);
  return res.json();
}

/* Un echec n'est PAS un etat vide : la tuile doit pouvoir dire « je
   n'ai pas pu joindre la page de statut », ce qui ne veut pas du tout
   dire « le service va bien ». Confondre les deux ferait afficher du
   vert pendant une coupure d'Internet -- le contraire de ce qu'on
   attend d'une tuile de supervision.
   A failure is NOT an empty state: the tile must be able to say "I
   could not reach the status page", which does not mean "the service is
   fine". Confusing the two would show green during an internet outage --
   the opposite of what a monitoring tile is for. */
async function getStatus(rawUrl, opts) {
  const base = normalizeBase(rawUrl);
  if (!base) return { url: rawUrl || null, error: "bad-url" };

  const now = Date.now();
  const hit = cache.get(base);
  const force = opts && opts.force;
  if (hit && hit.value && !force && (now - hit.at) < MIN_FETCH_MS) return hit.value;
  /* Un appel deja en cours est PARTAGE plutot que double : au demarrage,
     plusieurs tuiles demandent le meme service dans la meme seconde.
     An in-flight call is SHARED rather than duplicated. */
  if (hit && hit.inflight) return hit.inflight;

  const inflight = (async () => {
    try {
      const parsed = parseSummary(await fetchSummary(base));
      const value = parsed
        ? Object.assign({ base, fetchedAt: new Date().toISOString() }, parsed)
        : { base, error: "bad-response" };
      cache.set(base, { at: Date.now(), value });
      return value;
    } catch (e) {
      const value = {
        base,
        error: "unreachable",
        detail: String((e && e.message) || e).slice(0, 200),
        fetchedAt: new Date().toISOString()
      };
      /* On garde la derniere reponse VALIDE a cote de l'erreur : la
         tuile peut alors montrer « injoignable depuis 3 min » tout en
         rappelant le dernier etat connu, au lieu de perdre d'un coup ce
         qu'elle savait.
         The last VALID answer is kept alongside the error so the tile
         can show "unreachable for 3 min" while still recalling the last
         known state. */
      if (hit && hit.value && !hit.value.error) value.last = hit.value;
      cache.set(base, { at: Date.now(), value });
      return value;
    }
  })();

  cache.set(base, Object.assign({ at: now, value: hit && hit.value }, { inflight }));
  const out = await inflight;
  const entry = cache.get(base);
  if (entry) delete entry.inflight;
  return out;
}

module.exports = {
  getStatus,
  parseSummary,
  normalizeBase,
  apiUrl,
  INDICATOR_RANK,
  COMPONENT_RANK,
  MIN_FETCH_MS
};
