/* ============================================================
   PiBoard - server/serviceStatus.js
   Etat de sante des services en ligne, lu sur leur page de statut
   publique (GitHub, Cloudflare, AWS, Google Cloud, Azure, OVH...).

   CE QUE FAIT CE FICHIER, ET CE QU'IL NE FAIT PLUS. Il s'occupe du
   RESEAU et du CACHE : choisir l'adresse a interroger, respecter un
   plancher entre deux appels reels, partager un appel en cours, et ne
   jamais confondre « injoignable » avec « va bien ». L'ANALYSE des
   reponses, elle, a demenage dans server/serviceProviders.js, ou chaque
   format a son adaptateur -- c'est ce decoupage qui a permis de passer
   d'un seul format lisible (la « Statuspage » d'Atlassian) a cinq, sans
   toucher a la mecanique ci-dessous.

   POURQUOI PLUSIEURS FORMATS ETAIENT INEVITABLES. La premiere version
   pariait tout sur Statuspage : githubstatus.com n'est pas une page
   maison mais une Statuspage, exposee a /api/v2/summary.json, comme des
   centaines d'autres editeurs. Le pari etait bon et reste le meilleur
   point de depart -- mais AWS, Google Cloud et Azure, soit exactement
   les services qu'on veut surveiller en premier, n'emploient pas
   Statuspage. Voir serviceProviders.js pour les cinq formats.

   POURQUOI UN RELAIS SERVEUR plutot qu'un appel direct du navigateur :
   comme pour les autres tuiles reseau de PiBoard, le domaine distant
   n'a aucune raison d'autoriser nos requetes par CORS, et un cache
   partage evite que trois ecrans interrogent trois fois la meme page de
   statut pour une reponse identique.

   This file owns the NETWORK and the CACHE: choosing the address, a
   floor between two real calls, sharing an in-flight call, and never
   confusing "unreachable" with "fine". PARSING moved to
   server/serviceProviders.js, one adapter per format -- the split that
   took the tile from one readable format (Atlassian's Statuspage) to
   five without touching the machinery below. A server relay rather than
   a direct browser call: the remote domain has no reason to allow our
   requests through CORS, and a shared cache stops three screens asking
   three times for an identical answer.
   ============================================================ */
"use strict";

const providers = require("./serviceProviders");

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

const cache = new Map(); // cle (adaptateur + adresse) -> { at, value, inflight }

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

function hostIsPublic(u) {
  const host = u.hostname;
  if (u.protocol !== "https:") return false;
  if (!host || host.indexOf(".") === -1) return false;        // pas de nom nu / no bare name
  if (PRIVATE_HOST.test(host)) return false;
  if (PRIVATE_IPV4.test(host)) return false;
  if (/^\[|:/.test(host)) return false;                        // IPv6 litterale / literal IPv6
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;         // IPv4 litterale / literal IPv4
  return true;
}

function normalizeBase(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
  } catch (e) {
    return null;
  }
  if (!hostIsPublic(u)) return null;
  /* On ne garde QUE l'origine : le chemin colle par l'utilisateur est
     jete. Qu'il donne la page d'accueil, une page d'incident ou deja
     l'URL de l'API, on construit nous-memes le chemin -- une seule
     forme a tester, et aucun chemin arbitraire ne part sur le reseau.
     ONLY the origin is kept; whatever path the user pasted is dropped
     and we build the API path ourselves. */
  return u.origin;
}

/* Les trois formats non-Statuspage vivent a un chemin FIXE qui n'est pas
   devinable depuis l'origine (health.aws.amazon.com/public/currentevents,
   azurestatuscdn.../status/feed/). Le catalogue livre donc l'adresse
   complete, et celle-la garde son chemin -- mais le meme garde-fou
   s'applique a son hote, sans quoi le catalogue deviendrait une porte
   d'entree vers le reseau local le jour ou quelqu'un le modifie.
   The three non-Statuspage formats live at a FIXED path that cannot be
   guessed from the origin, so the catalogue supplies the full address and
   that one keeps its path -- but the same guard applies to its host, or
   the catalogue would become a way into the local network the day
   someone edits it. */
function normalizeApi(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
  } catch (e) {
    return null;
  }
  if (!hostIsPublic(u)) return null;
  return u.origin + u.pathname + (u.search || "");
}

function apiUrl(base) {
  return base + "/api/v2/summary.json";
}

/* L'adresse reellement interrogee pour un service donne. Ordre de
   priorite : l'adresse d'API explicite du catalogue, sinon l'origine
   plus le chemin de l'adaptateur.
   The address actually queried: the catalogue's explicit API address
   first, otherwise the origin plus the adapter's path. */
function endpointFor(spec) {
  const adapter = providers.ADAPTERS[spec.adapter];
  if (!adapter) return null;
  if (spec.api) return normalizeApi(spec.api);
  const base = normalizeBase(spec.url);
  return base ? base + adapter.path : null;
}

/* ---------- Analyse / parsing ----------
   Conservee ici sous son nom d'origine : parseSummary() reste le lecteur
   de Statuspage, et les tests comme le reste du code continuent de
   l'appeler ainsi. Les autres formats passent par leurs adaptateurs.
   Kept here under its original name: parseSummary() is still the
   Statuspage reader, and tests and callers keep using it as such. */
const parseSummary = providers.parseStatuspage;

/* ---------- Appel reseau / network call ---------- */

async function fetchBody(url, kind) {
  const res = await fetch(url, {
    headers: {
      "Accept": kind === "text" ? "application/rss+xml, application/xml, text/xml, */*" : "application/json",
      /* Certaines pages de statut (Azure, quelques CDN) rendent un 403 a
         un client sans User-Agent. Ce n'est pas du contournement : c'est
         la meme politesse qu'un navigateur, et sans elle la moitie des
         flux RSS repondraient « injoignable » a tort.
         Some status pages answer 403 to a client with no User-Agent. Not
         a workaround: the same courtesy a browser extends, and without
         it half the RSS feeds would wrongly read as unreachable. */
      "User-Agent": "PiBoard/service-status (+https://github.com/jihemezes/piboard)"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("status " + res.status);
  return kind === "text" ? res.text() : res.json();
}

/* Lecture d'un service avec un adaptateur CONNU. Rend l'etat analyse, ou
   null si la reponse n'a pas la forme attendue -- ce qui, pour « auto »,
   est le signal de passer au format suivant.
   Reading with a KNOWN adapter. Returns the parsed state, or null when
   the answer is not of the expected shape -- which, for "auto", is the
   signal to try the next format. */
async function readWith(adapterName, spec) {
  const adapter = providers.ADAPTERS[adapterName];
  if (!adapter) return null;
  const url = endpointFor({ adapter: adapterName, url: spec.url, api: spec.api });
  if (!url) return null;
  const body = await fetchBody(url, adapter.kind);
  const parsed = adapter.parse(body);
  return parsed ? Object.assign({ adapter: adapterName, endpoint: url }, parsed) : null;
}

/* « auto » : on sonde les formats dans l'ordre jusqu'a ce qu'un reponde
   quelque chose d'exploitable. Un format qui echoue (404, HTML, JSON
   d'une autre forme) ne doit JAMAIS faire echouer le service entier --
   c'est tout l'interet du sondage.
   "auto": probe the formats in order until one answers something usable.
   A failing format must NEVER fail the whole service -- that is the
   entire point of probing. */
async function readAuto(spec) {
  let lastError = null;
  for (const name of providers.AUTO_ORDER) {
    try {
      const out = await readWith(name, { url: spec.url });
      if (out) return out;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return null;
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
async function getStatusFor(spec, opts) {
  const adapterName = spec && spec.adapter && (providers.ADAPTERS[spec.adapter] || spec.adapter === "auto")
    ? spec.adapter
    : "auto";
  const base = normalizeBase(spec && spec.url);
  const api = spec && spec.api ? normalizeApi(spec.api) : null;
  if (!base && !api) return { url: (spec && spec.url) || null, error: "bad-url" };

  const key = adapterName + "|" + (api || base);
  const now = Date.now();
  const hit = cache.get(key);
  const force = opts && opts.force;
  if (hit && hit.value && !force && (now - hit.at) < MIN_FETCH_MS) return hit.value;
  /* Un appel deja en cours est PARTAGE plutot que double : au demarrage,
     plusieurs tuiles demandent le meme service dans la meme seconde.
     An in-flight call is SHARED rather than duplicated. */
  if (hit && hit.inflight) return hit.inflight;

  const inflight = (async () => {
    try {
      const parsed = adapterName === "auto"
        ? await readAuto({ url: base })
        : await readWith(adapterName, { url: base, api });
      const value = parsed
        ? Object.assign({ base: base || api, fetchedAt: new Date().toISOString() }, parsed)
        : { base: base || api, error: "bad-response" };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      const value = {
        base: base || api,
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
      cache.set(key, { at: Date.now(), value });
      return value;
    }
  })();

  cache.set(key, Object.assign({ at: now, value: hit && hit.value }, { inflight }));
  const out = await inflight;
  const entry = cache.get(key);
  if (entry) delete entry.inflight;
  return out;
}

/* Signature historique conservee : getStatus("https://...") lit toujours
   un service, en laissant le sondage choisir le format. C'est ce qui
   permet aux reglages avances (une adresse collee a la main) de
   fonctionner sans que la personne ait a savoir quel editeur de page de
   statut son fournisseur emploie.
   The historical signature is kept: getStatus("https://...") still reads
   one service, letting the probe choose the format -- which is what lets
   the advanced setting (a hand-pasted address) work without the person
   having to know which status-page vendor their provider uses. */
function getStatus(rawUrl, opts) {
  return getStatusFor({ url: rawUrl, adapter: "auto" }, opts);
}

/* ---------- Detection a l'ajout / detection when adding ----------
   Appele par le formulaire quand on ajoute un service a la main. Le but
   est de repondre TOUT DE SUITE « format reconnu » ou « non reconnu »,
   dans la fenetre des reglages, plutot que de laisser la personne
   enregistrer et decouvrir trois heures plus tard une tuile grise sans
   savoir si c'est l'adresse, le reseau ou le service.
   Called by the form when a service is added by hand, to answer
   IMMEDIATELY whether the format is recognised -- rather than letting
   the person save and discover a grey tile three hours later with no way
   to tell whether the address, the network or the service is at fault. */
async function detect(rawUrl) {
  const base = normalizeBase(rawUrl);
  if (!base) return { ok: false, error: "bad-url" };
  for (const name of providers.AUTO_ORDER) {
    try {
      const out = await readWith(name, { url: base });
      if (out) {
        return {
          ok: true,
          adapter: name,
          url: base,
          name: out.name || null,
          indicator: out.indicator,
          approximate: !!out.approximate
        };
      }
    } catch (e) { /* on passe au format suivant / try the next format */ }
  }
  return { ok: false, error: "unknown-format", url: base };
}

module.exports = {
  getStatus,
  getStatusFor,
  detect,
  parseSummary,
  normalizeBase,
  normalizeApi,
  endpointFor,
  apiUrl,
  INDICATOR_RANK: providers.INDICATOR_RANK,
  COMPONENT_RANK: providers.COMPONENT_RANK,
  MIN_FETCH_MS
};
