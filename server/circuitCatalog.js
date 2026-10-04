/* Base des CIRCUITS — tracés et fiches techniques.

   POURQUOI UNE BASE, ET PAS UN APPEL EN DIRECT. La première version de
   la carte « Plan du circuit » interrogeait Overpass au moment de
   l'affichage. Mesuré sur trois appels consécutifs pour le même
   circuit : 886 ms, puis 17,4 s, puis une erreur 429 (quota dépassé).
   Le relais de PiBoard abandonne à 15 s : deux affichages sur trois
   échouaient, et la tuile annonçait « aucun tracé dans OpenStreetMap »,
   ce qui était faux. Le tracé existait ; c'est le service public qui
   n'avait pas répondu. Confondre une panne d'accès avec une absence de
   donnée est la faute que ce projet s'interdit.

   Un tracé de circuit ne change pas. Il est donc extrait UNE FOIS (voir
   scripts/circuit-catalog.js) et publié ici : l'affichage ne fait plus
   aucun appel vers Overpass.

   WHY A DATABASE RATHER THAN A LIVE CALL. The first version queried
   Overpass at display time: 886 ms, then 17.4 s, then a 429 on three
   consecutive calls. The relay gives up at 15 s, so two displays out of
   three failed -- and the tile announced "no outline in OpenStreetMap",
   which was false. A circuit outline does not change, so it is
   extracted once and published here.

   LE MECANISME EST CELUI DU CATALOGUE DE SERVICES, a dessein : il est
   eprouve, et deux mecanismes voisins mais differents seraient un piege
   pour qui relira le code dans six mois. Validation EN BLOC, jamais de
   retour en arriere par numero de version, cache disque, 12 h, et aucun
   blocage reseau au premier appel.
   THE MECHANISM IS THE SERVICE CATALOGUE'S, deliberately. */
"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");

const EMBEDDED_PATH = path.join(__dirname, "..", "public", "data", "circuit-catalog.json");
const CACHE_PATH = path.join(store.DATA_DIR, "circuit-catalog.cache.json");

/* La base vit sur la branche principale du depot : un circuit complete
   -- un trace ajoute, une longueur corrigee -- arrive chez tout le monde
   SANS livrer une version de PiBoard. C'est toute la raison d'etre de
   cette architecture.
   The base lives on the repository's main branch: a completed circuit
   reaches everyone WITHOUT shipping a release. */
const REMOTE_URL = "https://raw.githubusercontent.com/jihemezes/piboard/main/public/data/circuit-catalog.json";

const REFRESH_MS = 12 * 3600 * 1000;
const TIMEOUT_MS = 15000;

/* La base porte de la GEOMETRIE : 47 circuits pesent ~85 Ko. Le plafond
   a 2 Mo laisse la place a une centaine de circuits de plus sans jamais
   permettre qu'une reponse aberrante remplisse la memoire d'un Pi.
   The base carries GEOMETRY: 47 circuits weigh ~85 KB. */
const MAX_BYTES = 2 * 1024 * 1024;

const MAX_CIRCUITS = 300;
const MAX_POINTS_PER_WAY = 3000;
const MAX_POINTS = 400000;

/* Un circuit tient dans une boite de quelques kilometres. Le plus long
   du monde, la Nordschleife, fait 21 km, soit environ 0,2 degre. Une
   demi-degre de cote laisse donc une marge confortable au reel, tout en
   restant serre face a l'absurde.
   A circuit fits in a box a few kilometres across. */
const MAX_SPAN_DEG = 0.5;

/* ---------- Validation ----------
   Fonction PURE, testable hors ligne. La base est acceptee ou rejetee
   EN BLOC : une base a moitie bonne serait pire qu'une base refusee,
   parce que personne ne saurait quelle moitie.
   PURE function. The base is accepted or rejected WHOLESALE. */
function validateCatalog(cat) {
  if (!cat || typeof cat !== "object" || Array.isArray(cat)) {
    return { ok: false, reason: "pas un objet / not an object" };
  }
  const circuits = cat.circuits;
  if (!circuits || typeof circuits !== "object" || Array.isArray(circuits)) {
    return { ok: false, reason: "circuits manquants / circuits missing" };
  }
  const ids = Object.keys(circuits);
  if (!ids.length) return { ok: false, reason: "aucun circuit / no circuit" };
  if (ids.length > MAX_CIRCUITS) return { ok: false, reason: "trop de circuits / too many circuits" };

  let points = 0;

  for (const id of ids) {
    const c = circuits[id];
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      return { ok: false, reason: "circuit non objet : " + id };
    }
    if (!c.name) return { ok: false, reason: "circuit sans nom : " + id };
    if (!Array.isArray(c.ways)) return { ok: false, reason: "trace manquant : " + id };

    /* La fiche technique est FACULTATIVE -- un trace sans fiche reste
       utile -- mais si elle est la, elle doit etre un objet : une chaine
       « 5,5 km » se lirait sans erreur et n'afficherait rien.
       The spec sheet is OPTIONAL but must be an object if present. */
    if (c.specs != null && (typeof c.specs !== "object" || Array.isArray(c.specs))) {
      return { ok: false, reason: "fiche technique non objet : " + id };
    }

    /* UN TRACE VIDE DOIT SE DECLARER. Plusieurs circuits du calendrier
       empruntent des routes ouvertes a la circulation, qu'OpenStreetMap
       ne distingue pas de la voirie : ils entrent dans la base avec leur
       fiche et `incomplete: true`, pour que la tuile EXPLIQUE au lieu de
       se taire. Mais un trace vide SANS cet indicateur reste une
       anomalie : rien ne le distinguerait d'un oubli d'extraction.
       AN EMPTY OUTLINE MUST DECLARE ITSELF: otherwise nothing tells it
       apart from a failed extraction. */
    if (!c.ways.length && c.incomplete !== true) {
      return { ok: false, reason: "trace vide sans indicateur incomplete : " + id };
    }

    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

    for (const w of c.ways) {
      if (!w || typeof w !== "object" || !Array.isArray(w.p)) {
        return { ok: false, reason: "tronçon sans geometrie : " + id };
      }
      /* Un tronçon d'un seul point ne se dessine pas : le garder
         reviendrait a publier une donnee qui ne produira jamais rien.
         A single-point way draws nothing. */
      if (w.p.length < 2) return { ok: false, reason: "tronçon d'un seul point : " + id };
      if (w.p.length > MAX_POINTS_PER_WAY) {
        return { ok: false, reason: "tronçon demesure (" + w.p.length + " points) : " + id };
      }

      for (const p of w.p) {
        /* LE TYPE, et pas seulement la valeur : "2.75" est vrai des
           qu'on le compare, et passerait un controle de bornes ecrit a
           la legere -- puis produirait un NaN au moment de projeter.
           THE TYPE, not merely the value. */
        if (!Array.isArray(p) || p.length !== 2) {
          return { ok: false, reason: "point mal forme : " + id };
        }
        const [lat, lon] = p;
        if (typeof lat !== "number" || typeof lon !== "number"
          || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          return { ok: false, reason: "coordonnee non numerique : " + id };
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return { ok: false, reason: "coordonnee hors bornes : " + id };
        }
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        points++;
      }
    }

    /* LE CAS SOURNOIS : chaque coordonnee est parfaitement valide, mais
       l'une d'elles est a quarante degres des autres -- un chiffre
       change a la saisie, ou une latitude et une longitude
       interverties. Aucun controle de bornes ne peut le voir. Le
       cadrage s'etire alors sur des milliers de kilometres et le
       circuit se reduit a un point : un dessin vide, sans la moindre
       donnee « invalide ».
       THE SNEAKY CASE: every coordinate is valid, but one sits forty
       degrees from the others. No bounds check can see it; the drawing
       comes out empty. */
    if (c.ways.length) {
      const span = Math.max(maxLat - minLat, maxLon - minLon);
      if (span > MAX_SPAN_DEG) {
        return { ok: false, reason: "trace etendu sur " + span.toFixed(1) + " degres : " + id };
      }
    }
  }

  /* Un plafond sur le NOMBRE DE POINTS, et non seulement sur les
     octets : un fichier compact peut decrire un million de points et
     mettre un Raspberry Pi a genoux au moment de dessiner.
     A ceiling on the number of POINTS, not just bytes. */
  if (points > MAX_POINTS) return { ok: false, reason: "trop de points : " + points };

  return { ok: true, count: ids.length, version: Number(cat.version) || 0, points };
}

/* ---------- Lectures locales / local reads ---------- */

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.length > MAX_BYTES * 2) return null;
    const cat = JSON.parse(raw);
    return validateCatalog(cat).ok ? cat : null;
  } catch (e) {
    return null;
  }
}

function embedded() { return readJson(EMBEDDED_PATH); }
function cached() { return readJson(CACHE_PATH); }

function writeCache(cat) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cat), "utf8");
  } catch (e) {
    /* Un cache non ecrit n'est pas une panne : on refera l'appel dans
       douze heures. A cache that cannot be written is not a failure. */
  }
}

function pickBest(candidates) {
  let best = null;
  for (const c of candidates) {
    if (!c || !c.cat) continue;
    const v = Number(c.cat.version) || 0;
    if (!best || v > best.version) best = { cat: c.cat, source: c.source, version: v };
  }
  return best;
}

/* ---------- Base distante / remote base ---------- */

let lastFetch = 0;
let inflight = null;

async function fetchRemote() {
  const res = await fetch(REMOTE_URL, {
    headers: { "Accept": "application/json", "User-Agent": "PiBoard/circuit-catalog" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error("status " + res.status);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("trop volumineux / too large");
  return JSON.parse(text);
}

async function get(opts) {
  const useRemote = !(opts && opts.remote === false);
  const emb = embedded();

  if (!useRemote) return { catalog: emb, source: "embedded", remote: false };

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
          console.warn("[piboard] base de circuits refusee ->", check.reason);
          return null;
        }
        /* On ne RECULE jamais : une base distante qui n'est pas plus
           recente que celle qu'on a deja est ignoree.
           We never go backwards. */
        const have = best ? best.version : 0;
        if ((Number(remote.version) || 0) <= have) return null;
        writeCache(remote);
        return remote;
      } catch (e) {
        console.warn("[piboard] base de circuits injoignable ->", (e && e.message) || e);
        return null;
      }
    })();
    inflight.finally(() => { inflight = null; });
  }

  /* Le premier appel ne BLOQUE pas sur le reseau : on sert ce qu'on a
     tout de suite. The first call does not BLOCK on the network. */
  return best
    ? { catalog: best.cat, source: best.source, remote: true }
    : { catalog: null, source: "none", remote: true };
}

/* ---------- Index leger / light index ----------
   La fenetre de reglages n'a besoin que des NOMS pour remplir sa liste
   deroulante. Lui envoyer les 85 Ko de geometrie a chaque ouverture
   serait absurde, surtout sur un Pi derriere une connexion lente.
   The settings window only needs the NAMES. */
function index(cat) {
  if (!cat || !cat.circuits || typeof cat.circuits !== "object") return {};
  const out = {};
  for (const id of Object.keys(cat.circuits)) {
    const c = cat.circuits[id];
    out[id] = { name: c.name, incomplete: c.incomplete === true };
  }
  return out;
}

function find(cat, id) {
  if (!cat || !cat.circuits || !id) return null;
  return cat.circuits[String(id)] || null;
}

module.exports = {
  get, validateCatalog, index, find,
  REMOTE_URL, REFRESH_MS, CACHE_PATH, EMBEDDED_PATH, MAX_BYTES,
  _resetClock() { lastFetch = 0; inflight = null; }
};
