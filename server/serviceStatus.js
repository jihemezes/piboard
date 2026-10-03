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
/* UNE DATE DANS L'ADRESSE, ET POURQUOI ELLE EST SUBSTITUEE ICI.
   L'API de Zendesk veut le jour courant en parametre. Ecrire cette date
   dans le catalogue l'aurait figee a la date de la livraison : la tuile
   aurait interroge indefiniment le 3 octobre 2026 et affiche « tout va
   bien » pour l'eternite -- un defaut muet, qui ne se signale par
   aucune erreur et que personne ne voit venir. Le catalogue porte donc
   `{today}`, remplace a CHAQUE appel.
   A DATE IN THE ADDRESS: Zendesk's API wants the current day. Writing it
   into the catalogue would have frozen it at delivery time -- the tile
   querying 3 October 2026 for ever and showing "all fine" for ever, a
   silent defect no error reports. The catalogue carries {today}, which
   is replaced at EVERY call. */
function withToday(url) {
  if (!url || url.indexOf("{today}") === -1) return url;
  return url.replace(/\{today\}/g, new Date().toISOString().slice(0, 10));
}

function endpointFor(spec) {
  const adapter = providers.ADAPTERS[spec.adapter];
  if (!adapter) return null;
  if (spec.api) return normalizeApi(withToday(spec.api));
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

/* UNE ERREUR QUI DIT LAQUELLE. La premiere version ne connaissait qu'un
   echec, « injoignable », et l'affichait pour trois causes qui n'ont
   rien a voir : la page vraiment injoignable (DNS, coupure, timeout),
   la page qui repond mais refuse (403, 404), et la page qui repond tres
   bien mais dans un format qu'on ne sait pas lire. PayPal tombait dans
   le troisieme cas et s'affichait comme « page de statut injoignable »,
   ce qui envoie chercher une panne de reseau pour un probleme
   d'adaptateur. Trois causes, trois messages.
   ONE ERROR THAT SAYS WHICH. The first version knew a single failure,
   "unreachable", and showed it for three unrelated causes: genuinely
   unreachable (DNS, outage, timeout), answering but refusing (403, 404),
   and answering perfectly in a format we cannot read. PayPal fell in the
   third case and read as "status page unreachable", which sends one
   looking for a network fault to solve an adapter problem. */
class HttpError extends Error {
  constructor(status, url) {
    super("status " + status);
    this.httpStatus = status;
    this.url = url;
  }
}

/* Un en-tete de navigateur, et pourquoi. Plusieurs pages de statut
   passent par un pare-feu applicatif (Cloudflare, Fastly, Akamai) qui
   rend 403 a tout client dont l'agent n'est pas celui d'un navigateur.
   Ce n'est pas du contournement : on demande une page publique, en
   annoncant ce qu'on est dans le commentaire de l'agent. Sans cela, une
   partie des grands services -- exactement ceux qu'on veut surveiller --
   repondent « interdit » et la tuile conclut, a tort, a une panne de
   joignabilite.
   A browser-shaped header, and why: several status pages sit behind a
   WAF answering 403 to any client whose agent is not a browser's. Not a
   workaround -- we ask for a public page and say what we are in the
   agent's comment. Without it a number of large services answer
   "forbidden" and the tile wrongly concludes it cannot reach them. */
const UA = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PiBoard/service-status (+https://github.com/jihemezes/piboard)";

function headersFor(kind) {
  return {
    "Accept": kind === "text"
      ? "application/rss+xml, application/xml, text/xml, */*"
      : (kind === "probe" ? "*/*" : "application/json, text/plain, */*"),
    "Accept-Language": "fr, en;q=0.8, *;q=0.5",
    "User-Agent": UA
  };
}

async function httpGet(url, kind) {
  return fetch(url, {
    headers: headersFor(kind),
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
}

/* LA REDIRECTION QUI PERDAIT LE CHEMIN, et qui explique a elle seule
   plusieurs services muets. Des fournisseurs ont demenage leur page de
   statut sur un autre domaine en laissant une redirection : status.
   fastly.com -> fastlystatus.com, status.infomaniak.com ->
   infomaniakstatus.com, status.ovhcloud.com -> status-ovhcloud.com. Ces
   redirections renvoient vers la RACINE du nouveau site, pas vers le
   chemin demande : on partait chercher /api/v2/summary.json et on
   recevait la page d'accueil en HTML, donc un format non reconnu.
   On recommence donc UNE fois, en reposant le chemin de l'adaptateur sur
   la nouvelle origine. Une seule fois : deux domaines qui se
   redirigeraient l'un vers l'autre tourneraient en rond, et une tuile de
   supervision ne doit jamais etre ce qui tombe.
   THE REDIRECT THAT LOST THE PATH, which alone explains several silent
   services. Providers moved their status page to another domain leaving
   a redirect, and those redirects land on the new site's ROOT, not on
   the requested path: we asked for /api/v2/summary.json and received the
   home page as HTML, hence an unrecognised format. We therefore retry
   ONCE with the adapter's path rebuilt on the new origin. Once only: two
   domains redirecting to each other would loop, and a monitoring tile
   must never be the thing that falls over. */
function redirectedAway(res, requested) {
  if (!res || !res.redirected || !res.url) return null;
  let asked, got;
  try { asked = new URL(requested); got = new URL(res.url); } catch (e) { return null; }
  if (got.origin === asked.origin) return null;
  if (got.pathname === asked.pathname) return null;      // chemin conserve : rien a refaire
  return got.origin;
}

/* LE DEFAUT AWS, et il ne se voyait pas a la relecture. AWS sert
   `/public/currentevents` en **UTF-16** (`content-type:
   application/json;charset=utf-16`), ce que plus personne ne fait depuis
   quinze ans. Or `res.json()` de Node decode TOUJOURS en UTF-8, sans
   regarder le charset annonce : le corps ressortait en caracteres
   parasites, `JSON.parse` levait une SyntaxError, et comme ce n'etait
   pas une erreur HTTP la tuile concluait « page de statut injoignable ».
   AWS repondait pourtant en 44 ms avec 226 Ko de JSON parfaitement
   valide. On decode donc nous-memes, selon le charset annonce.

   THE AWS DEFECT, invisible on re-reading: AWS serves
   /public/currentevents in UTF-16, and Node's res.json() always decodes
   as UTF-8 regardless of the declared charset. The body came out as
   garbage, JSON.parse threw a SyntaxError, and since that is not an HTTP
   error the tile concluded "status page unreachable" -- while AWS was
   answering in 44 ms with 226 KB of perfectly valid JSON. */
const CHARSET_RE = /charset\s*=\s*["']?([\w-]+)/i;

function decodeText(buffer, contentType) {
  const m = CHARSET_RE.exec(String(contentType || ""));
  let label = m ? m[1].toLowerCase() : "utf-8";

  /* LA MARQUE D'ORDRE DES OCTETS FAIT FOI, avant l'etiquette. La version
     precedente traduisait « utf-16 » par du petit-boutien, parce que
     c'est le cas courant. AWS, lui, sert du GROS-boutien : sa reponse
     commence par FE FF. Decodee a l'envers, elle ressortait en
     ideogrammes, JSON.parse echouait, et la tuile affichait « format
     inconnu » -- un progres sur « injoignable », mais toujours faux.
     Deux octets lus au bon endroit valent mieux qu'une convention.
     THE BYTE ORDER MARK WINS over the label. The previous version read
     bare "utf-16" as little-endian, the common case; AWS serves BIG-
     endian (FE FF). Decoded backwards it came out as ideograms,
     JSON.parse failed and the tile said "unknown format" -- progress
     over "unreachable", but still wrong. */
  const head = buffer && buffer.byteLength >= 2 ? new Uint8Array(buffer.slice(0, 2)) : null;
  if (head && head[0] === 0xFE && head[1] === 0xFF) label = "utf-16be";
  else if (head && head[0] === 0xFF && head[1] === 0xFE) label = "utf-16le";
  else if (label === "utf-16" || label === "utf16") label = "utf-16le";
  let out;
  try {
    out = new TextDecoder(label).decode(buffer);
  } catch (e) {
    /* Un charset exotique ou mal orthographie ne doit pas faire perdre
       la reponse : on retombe sur UTF-8, qui est juste dans l'immense
       majorite des cas. An exotic or misspelt charset must not lose the
       answer: we fall back to UTF-8. */
    out = new TextDecoder("utf-8").decode(buffer);
  }
  return out.replace(/^\uFEFF/, "");
}

/* Une reponse illisible n'est PAS une panne de reseau. Distinguer les
   deux est tout l'objet des trois messages : du JSON casse envoie
   verifier l'adresse, pas la box.
   An unreadable answer is NOT a network failure; telling the two apart
   is the whole point of the three messages. */
class BadFormatError extends Error {}

async function readBody(res, kind) {
  const text = decodeText(await res.arrayBuffer(), res.headers.get("content-type"));
  if (kind === "text") return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new BadFormatError("reponse illisible / unreadable answer");
  }
}

/* Recupere le corps en suivant, si besoin, la redirection de domaine
   ci-dessus et le chemin de repli de l'adaptateur (Oracle Cloud).
   Fetches the body, following the domain redirect above and the
   adapter's fallback path (Oracle Cloud) when needed. */
/* Les chemins a rejouer sur la nouvelle origine, dans l'ordre. Sorti en
   fonction PURE parce que c'est ICI qu'etait le defaut, et qu'un ordre
   se teste hors ligne en trois lignes alors qu'une redirection
   demanderait un serveur.
   The paths to replay on the new origin, in order. Pulled out as a PURE
   function because the defect was HERE, and an order is tested offline
   in three lines where a redirect would need a server. */
function retryPaths(requestedUrl, adapter) {
  let asked = null;
  try { const u = new URL(requestedUrl); asked = u.pathname + (u.search || ""); } catch (e) { asked = null; }
  const out = [];
  if (asked && asked !== "/") out.push(asked);
  if (adapter && adapter.path && adapter.path !== asked) out.push(adapter.path);
  return out;
}

async function fetchBody(url, kind, adapter) {
  let res = await httpGet(url, kind);

  const moved = redirectedAway(res, url);
  if (moved) {
    /* On rejoue D'ABORD le chemin REELLEMENT demande sur la nouvelle
       origine, et seulement ensuite celui de l'adaptateur. La premiere
       version ne reposait que le second, ce qui marche quand le
       catalogue ne declare aucune adresse d'API -- mais pas quand il en
       declare une : Stripe demandait `/current/atom.xml`, se faisait
       rediriger vers `www.stripestatus.com`, et on y cherchait
       `/history.rss` au lieu du chemin demande. Deux essais valent
       mieux qu'un mauvais, et ils ne coutent que lorsqu'une page a
       reellement demenage.
       The REQUESTED path is replayed on the new origin FIRST, the
       adapter's path only after. The first version replayed only the
       latter, which works when the catalogue declares no API address --
       but not when it does. */
    for (const c of retryPaths(url, adapter)) {
      const retried = await httpGet(moved + c, kind);
      if (retried.ok) { res = retried; break; }
    }
  }

  if (res.status === 404 && adapter && adapter.fallbackPath) {
    let origin = null;
    try { origin = new URL(res.url || url).origin; } catch (e) { origin = null; }
    if (origin) {
      const retried = await httpGet(origin + adapter.fallbackPath, kind);
      if (retried.ok) res = retried;
    }
  }

  if (!res.ok) throw new HttpError(res.status, res.url || url);
  return readBody(res, kind);
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

  /* L'adaptateur « endpoint » ne lit aucun document : il constate une
     reponse. Un 403 ou un 404 y sont donc des resultats, pas des
     erreurs -- le serveur repond, donc il est la -- la ou un echec
     reseau en est bien un.
     The "endpoint" adapter reads no document, it observes an answer: a
     403 or a 404 are results there, not errors -- the server answered,
     so it is up -- whereas a network failure is a real one. */
  if (adapter.kind === "probe") {
    let host = null;
    try { host = new URL(url).hostname; } catch (e) { host = null; }
    let ok = false;
    try {
      const res = await httpGet(url, "probe");
      ok = res.status < 500;
    } catch (e) {
      ok = false;
    }
    const parsed = adapter.parse({ ok, url, host });
    return parsed ? Object.assign({ adapter: adapterName, endpoint: url }, parsed) : null;
  }

  const body = await fetchBody(url, adapter.kind, adapter);
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
  /* On retient si UNE page au moins a repondu correctement. C'est ce qui
     separe « je n'ai joint personne » de « j'ai tout joint sans rien
     comprendre » -- deux diagnostics opposes pour la personne devant la
     tuile : verifier son reseau, ou verifier son adresse.
     We remember whether at least one page answered properly: that is
     what separates "I reached nobody" from "I reached everything and
     understood none of it" -- opposite diagnoses for the person in front
     of the tile: check your network, or check your address. */
  let reached = false;
  for (const name of providers.AUTO_ORDER) {
    try {
      const out = await readWith(name, { url: spec.url });
      if (out) return out;
      reached = true;
    } catch (e) {
      /* Une page qui repond 404 a ETE jointe : le domaine existe, le
         serveur parle, c'est seulement ce chemin-la qui n'est pas le
         bon. Un 404 pendant un sondage n'est donc pas un echec de
         joignabilite. A page answering 404 HAS been reached. */
      if (e instanceof BadFormatError) reached = true;
      if (e instanceof HttpError && e.httpStatus >= 400 && e.httpStatus < 500) reached = true;
      lastError = e;
    }
  }
  if (reached) return null;              // joint, mais aucun format reconnu
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
        : { base: base || api, error: "bad-format", fetchedAt: new Date().toISOString() };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      const value = {
        base: base || api,
        /* Trois causes, trois messages : voir HttpError plus haut. Un
           code HTTP est conserve tel quel, parce que « 403 » et « 404 »
           n'appellent pas la meme verification.
           Three causes, three messages; the HTTP code is kept as is,
           because 403 and 404 do not call for the same check. */
        error: e instanceof HttpError ? "http" : (e instanceof BadFormatError ? "bad-format" : "unreachable"),
        httpStatus: e instanceof HttpError ? e.httpStatus : null,
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
  decodeText,
  retryPaths,
  withToday,
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
