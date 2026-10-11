/* ============================================================
   PiBoard - server/serviceCatalog.js
   Le catalogue de services de la tuile Statut de service, sorti du code.

   POURQUOI CE FICHIER EXISTE. En quatre versions, neuf adaptateurs ont
   du etre ecrits parce que les grands editeurs quittent Statuspage les
   uns apres les autres pour une page maison : Fastly, Vultr, PayPal,
   GitLab, Hugging Face, Backblaze, Heroku, Slack, PagerDuty, Zendesk.
   Ce mouvement ne va pas s'arreter. Or, neuf fois sur dix, ce qui
   change n'est pas le CODE mais une DONNEE : une adresse qui demenage,
   un adaptateur a changer, une entree a retirer. Tant que cette donnee
   vivait dans le code, la moindre correction exigeait une version de
   PiBoard, son build, sa publication et sa mise a jour sur chaque Pi --
   des jours pour une ligne de JSON.

   Le catalogue est donc desormais lu AUSSI depuis le depot public. Une
   page qui demenage devient une ligne poussee sur `main`, corrigee pour
   tout le monde dans les douze heures, sans release et sans que
   personne ait a recocher quoi que ce soit.

   CE QUE CE FICHIER NE FAIT PAS, et c'est deliberé :
     - il ne fait jamais dependre la tuile du reseau. Le catalogue
       embarque dans la version est toujours la, et sert de repli
       definitif ;
     - il n'accepte pas n'importe quoi. Un catalogue distant est une
       donnee qui dicte des adresses que le serveur ira interroger : il
       est donc valide ENTIEREMENT avant d'etre retenu, et rejete en
       bloc a la premiere anomalie. Un fichier a moitie bon serait pire
       qu'un fichier refuse, parce qu'on ne saurait pas quelle moitie ;
     - il ne recule jamais. Un catalogue distant dont le numero de
       version est inferieur ou egal a celui qu'on a deja est ignore :
       sans cette regle, un depot revenu en arriere par accident
       effacerait des corrections deja en place.

   WHY THIS FILE EXISTS. Nine adapters in four versions, because large
   vendors keep leaving Statuspage for in-house pages. Nine times out of
   ten what changes is not CODE but DATA: a moved address, an adapter to
   switch, an entry to drop. While that data lived in the code, the
   smallest fix needed a release, a build and an update on every Pi --
   days for one line of JSON. The catalogue is now ALSO read from the
   public repository. What this file deliberately does NOT do: make the
   tile depend on the network (the shipped catalogue is the final
   fallback); accept anything (a remote catalogue dictates addresses the
   server will query, so it is validated ENTIRELY and rejected wholesale
   on the first anomaly -- a half-good file would be worse than a
   refused one, because nobody would know which half); or go backwards
   (a remote version number lower than or equal to the one in hand is
   ignored, so a repository rolled back by accident cannot erase fixes
   already in place).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");
const providers = require("./serviceProviders");
const serviceStatus = require("./serviceStatus");

const EMBEDDED_PATH = path.join(__dirname, "..", "public", "data", "service-catalog.json");
const CACHE_PATH = path.join(store.DATA_DIR, "service-catalog.cache.json");

/* L'adresse du catalogue partage. `main` plutot qu'une etiquette de
   version : c'est tout l'interet -- une correction de catalogue ne doit
   PAS attendre la prochaine version de PiBoard.
   `main` rather than a version tag: that is the entire point -- a
   catalogue fix must NOT wait for the next PiBoard release. */
const REMOTE_URL = "https://raw.githubusercontent.com/jihemezes/piboard/main/public/data/service-catalog.json";

/* Douze heures. Un catalogue n'est pas une page de statut : il bouge
   quelques fois par an. Interroger plus souvent n'apporterait rien et
   ferait du bruit chez GitHub pour chaque Pi installe.
   Twelve hours. A catalogue is not a status page: it moves a few times
   a year. */
const REFRESH_MS = 12 * 3600 * 1000;
const TIMEOUT_MS = 10000;

/* Taille maximale acceptee. Le catalogue livre pese ~25 Ko ; au-dela de
   deux cents, ce n'est plus un catalogue, et on ne veut pas lire en
   memoire ce qu'un depot compromis enverrait.
   Maximum accepted size: the shipped catalogue is ~25 KB. */
const MAX_BYTES = 200 * 1024;

/* ---------- Validation / validation ----------
   Fonction PURE, testable hors ligne : elle prend un objet et rend
   `{ ok, reason }`. Toute la severite est ici, et elle est volontairement
   stricte -- ce fichier decide des adresses que le serveur ira
   interroger.
   PURE function, testable offline. All the severity lives here, and it
   is deliberately strict: this file decides which addresses the server
   will query. */
function validateCatalog(cat) {
  if (!cat || typeof cat !== "object" || Array.isArray(cat)) return { ok: false, reason: "pas un objet / not an object" };
  if (!Array.isArray(cat.families) || !cat.families.length) return { ok: false, reason: "familles manquantes / families missing" };
  if (!Array.isArray(cat.services) || !cat.services.length) return { ok: false, reason: "services manquants / services missing" };
  if (cat.services.length > 500) return { ok: false, reason: "trop de services / too many services" };

  const famIds = new Set();
  for (const f of cat.families) {
    if (!f || typeof f !== "object" || !f.id) return { ok: false, reason: "famille sans identifiant / family without id" };
    if (!f.label || !f.label.fr || !f.label.en) return { ok: false, reason: "famille non bilingue : " + f.id };
    famIds.add(String(f.id));
  }
  /* « Mes services » doit exister : sans elle, un service ajoute a la
     main n'aurait aucune rubrique et disparaitrait de l'ecran tout en
     restant surveille -- une tuile qui ment par omission.
     Without the "custom" family a hand-added service would have no
     section and would vanish from the screen while still being
     watched. */
  if (!famIds.has("custom")) return { ok: false, reason: "famille « custom » manquante / missing" };

  const seen = new Set();
  for (const s of cat.services) {
    if (!s || typeof s !== "object") return { ok: false, reason: "service non objet / service not an object" };
    const id = String(s.id || "");
    if (!id) return { ok: false, reason: "service sans identifiant / service without id" };
    if (seen.has(id)) return { ok: false, reason: "identifiant en double : " + id };
    seen.add(id);
    if (!s.name) return { ok: false, reason: "service sans nom : " + id };
    if (!famIds.has(String(s.family))) return { ok: false, reason: "famille inconnue pour " + id + " : " + s.family };

    const adapter = String(s.adapter || "auto");
    if (adapter !== "auto" && !providers.ADAPTERS[adapter]) {
      return { ok: false, reason: "adaptateur inconnu pour " + id + " : " + adapter };
    }

    /* LE GARDE-FOU QUI COMPTE VRAIMENT. Le catalogue distant dicte des
       adresses que le serveur ira chercher : on applique donc le MEME
       controle qu'a une adresse tapee a la main -- HTTPS public
       uniquement, jamais localhost ni une adresse privee. Sans cela, un
       depot compromis ferait du relais PiBoard un moyen de sonder le
       reseau interne de chaque personne qui l'installe.
       THE GUARD THAT MATTERS. The remote catalogue dictates addresses
       the server will fetch, so the SAME check as a hand-typed address
       applies: public HTTPS only, never localhost or a private address.
       Without it a compromised repository would turn PiBoard's relay
       into a way to probe each installer's internal network. */
    if (!serviceStatus.normalizeBase(s.url)) return { ok: false, reason: "adresse refusee pour " + id + " : " + s.url };
    if (s.api && !serviceStatus.normalizeApi(serviceStatus.withToday(s.api))) {
      return { ok: false, reason: "adresse d'API refusee pour " + id + " : " + s.api };
    }
  }
  return { ok: true, count: cat.services.length, version: Number(cat.version) || 0 };
}

/* ---------- Lectures locales / local reads ---------- */

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.length > MAX_BYTES * 2) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function embedded() {
  const cat = readJson(EMBEDDED_PATH);
  return cat && validateCatalog(cat).ok ? cat : null;
}

function cached() {
  const cat = readJson(CACHE_PATH);
  return cat && validateCatalog(cat).ok ? cat : null;
}

function writeCache(cat) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cat), "utf8");
    return true;
  } catch (e) {
    /* Un cache qu'on n'arrive pas a ecrire (disque plein, lecture
       seule) ne doit pas faire echouer la lecture : on s'en passe,
       quitte a reinterroger au prochain demarrage.
       A cache we cannot write must not fail the read. */
    return false;
  }
}

/* Le meilleur des trois, par numero de version. Le catalogue embarque
   gagne s'il est plus recent que le cache -- c'est le cas apres une
   mise a jour de PiBoard, et il serait absurde de servir un cache plus
   ancien que ce qu'on vient d'installer.
   The best of the three, by version number: the shipped catalogue wins
   when it is newer than the cache, which is what happens right after a
   PiBoard update. */
function pickBest(candidates) {
  let best = null;
  for (const c of candidates) {
    if (!c || !c.cat) continue;
    const v = Number(c.cat.version) || 0;
    if (!best || v > best.version) best = { cat: c.cat, source: c.source, version: v };
  }
  return best;
}

/* ---------- Catalogue distant / remote catalogue ---------- */

let lastFetch = 0;
let inflight = null;

async function fetchRemote() {
  const res = await fetch(REMOTE_URL, {
    headers: { "Accept": "application/json", "User-Agent": "PiBoard/service-catalog" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("status " + res.status);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("trop volumineux / too large");
  return JSON.parse(text);
}

/* Rend le catalogue a servir. `remote: false` (la case decochee dans la
   tuile) coupe net toute idee de reseau : on ne regarde meme pas le
   cache, puisque la personne a demande a s'en tenir a la version
   installee.
   Returns the catalogue to serve. `remote: false` (the box unticked in
   the tile) rules out the network entirely -- the cache is not even
   consulted, since the person asked to stay with what is installed. */
async function get(opts) {
  const useRemote = !(opts && opts.remote === false);
  const emb = embedded();

  if (!useRemote) {
    return { catalog: emb, source: "embedded", remote: false };
  }

  const best = pickBest([
    { cat: emb, source: "embedded" },
    { cat: cached(), source: "cache" }
  ]);

  const now = Date.now();
  const fresh = (now - lastFetch) < REFRESH_MS;
  if (!fresh && !inflight) {
    lastFetch = now;
    inflight = (async () => {
      try {
        const remote = await fetchRemote();
        const check = validateCatalog(remote);
        if (!check.ok) {
          console.warn("[piboard] catalogue distant refuse ->", check.reason);
          return null;
        }
        /* On ne RECULE jamais : un catalogue distant qui n'est pas plus
           recent que celui qu'on a deja est ignore. We never go
           backwards. */
        const have = best ? best.version : 0;
        if ((Number(remote.version) || 0) <= have) return null;
        writeCache(remote);
        return remote;
      } catch (e) {
        console.warn("[piboard] catalogue distant injoignable ->", (e && e.message) || e);
        return null;
      }
    })();
    inflight.finally(() => { inflight = null; });
  }

  /* Le premier appel ne BLOQUE pas sur le reseau : on sert ce qu'on a
     tout de suite, et la version distante prendra effet au relevé
     suivant. Une fenetre de reglages qui attend GitHub pour afficher sa
     liste de cases serait insupportable sur un Pi derriere une
     connexion lente.
     The first call does not BLOCK on the network: what we have is
     served at once and the remote version takes effect on the next
     reading. A settings window waiting on GitHub to draw its checkboxes
     would be unbearable on a Pi behind a slow link. */
  return best
    ? { catalog: best.cat, source: best.source, remote: true }
    : { catalog: null, source: "none", remote: true };
}

module.exports = {
  get,
  validateCatalog,
  REMOTE_URL,
  REFRESH_MS,
  CACHE_PATH,
  EMBEDDED_PATH,
  /* Pour les tests : remettre l'horloge a zero entre deux cas.
     For tests: reset the clock between cases. */
  _resetClock() { lastFetch = 0; inflight = null; }
};
