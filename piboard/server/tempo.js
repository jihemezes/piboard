/* ============================================================
   PiBoard - server/tempo.js
   Couleur du jour de l'offre Tempo d'EDF, via api-couleur-tempo.fr
   (gratuite, sans authentification, JSON).

   POURQUOI UN RELAIS SERVEUR plutot qu'un appel direct depuis le
   navigateur : le domaine ne renvoie pas d'en-tetes CORS permissifs, et
   surtout un cache partage evite que chaque tuile de chaque ecran ne
   frappe une API gratuite hebergee benevolement. La couleur du lendemain
   n'est publiee qu'une fois par jour vers 11 h : interroger plus souvent
   que toutes les 30 minutes n'apporte rien.

   SUBTILITE DE LA JOURNEE TEMPO. Une journee Tempo court de 6 h a 6 h le
   lendemain, pas de minuit a minuit. /api/jourTempo/today renvoie donc la
   couleur de la journee CALENDAIRE, tandis que /api/now tient compte de
   l'heure reelle et renvoie la couleur de la veille s'il est moins de
   6 h du matin. Sur un tableau mural allume la nuit, afficher "today"
   entre minuit et 6 h donnerait la MAUVAISE couleur applicable. On
   expose donc les deux et le widget choisit.

   Colour of the day for EDF's Tempo tariff, via api-couleur-tempo.fr
   (free, no authentication, JSON).

   WHY A SERVER RELAY rather than a direct call from the browser: the
   domain does not send permissive CORS headers, and above all a shared
   cache stops every tile on every screen from hammering a free API hosted
   out of goodwill. Tomorrow's colour is published once a day around
   11am: polling more often than every 30 minutes gains nothing.

   TEMPO DAY SUBTLETY. A Tempo day runs from 6am to 6am, not midnight to
   midnight. /api/jourTempo/today therefore returns the CALENDAR day's
   colour, whereas /api/now accounts for the actual time and returns the
   previous day's colour when it is before 6am. On a wall board left on
   overnight, showing "today" between midnight and 6am would give the
   WRONG applicable colour. So we expose both and let the widget choose.
   ============================================================ */
"use strict";

const BASE = "https://www.api-couleur-tempo.fr/api";
const TIMEOUT_MS = 12000;

/* Cache partage. 30 min : la couleur du lendemain tombe vers 11 h et ne
   bouge plus ensuite ; inutile d'insister.
   Shared cache. 30 min: tomorrow's colour lands around 11am and does not
   move afterwards; no point insisting. */
const CACHE_MS = 30 * 60 * 1000;
let cache = null;

/* codeJour : 0 = pas encore defini, 1 = bleu, 2 = blanc, 3 = rouge.
   Le 0 est un etat NORMAL, pas une erreur : la couleur du lendemain est
   inconnue jusqu'a la publication de RTE vers 11 h. Le widget doit
   l'afficher comme "en attente", surtout pas comme un echec.
   codeJour: 0 = not yet defined, 1 = blue, 2 = white, 3 = red.
   The 0 is a NORMAL state, not an error: tomorrow's colour is unknown
   until RTE publishes around 11am. The widget must show it as "pending",
   definitely not as a failure. */
const COLORS = { 0: "unknown", 1: "blue", 2: "white", 3: "red" };

async function getJson(path) {
  const res = await fetch(BASE + path, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(path + " -> " + res.status);
  return res.json();
}

function mapDay(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = Number(raw.codeJour);
  return {
    date: raw.dateJour || null,
    code: Number.isFinite(code) ? code : 0,
    color: COLORS[Number.isFinite(code) ? code : 0] || "unknown",
    // Libelle renvoye par l'API quand il existe. On ne s'en sert PAS
    // pour l'affichage (le widget traduit lui-meme via i18n, sinon la
    // tuile serait en francais sur une interface en anglais), mais il
    // est utile au diagnostic.
    // Label returned by the API when present. We do NOT use it for
    // display (the widget translates via i18n itself, otherwise the tile
    // would be French on an English interface), but it helps diagnosis.
    label: raw.libCouleur || null,
    periode: raw.periode || null
  };
}

/* Les compteurs de jours restants : la route existe, mais le NOM EXACT
   de ses champs n'est pas documente publiquement et je n'ai pas pu la
   verifier en direct. On accepte donc plusieurs graphies plausibles, et
   on renvoie null plutot que d'inventer un chiffre. Une tuile sans
   compteur reste utile ; une tuile avec un compteur faux ne l'est pas.
   Remaining-day counters: the route exists, but the EXACT NAME of its
   fields is not publicly documented and I could not verify it live. So we
   accept several plausible spellings, and return null rather than
   inventing a number. A tile without counters is still useful; a tile
   with wrong counters is not. */
function pick(obj, names) {
  for (const n of names) {
    if (obj && obj[n] != null && Number.isFinite(Number(obj[n]))) return Number(obj[n]);
  }
  return null;
}

function mapStats(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = raw.stats || raw;
  const out = {
    blue: pick(src, ["bleuRestants", "joursBleuRestants", "restantsBleu", "bleu_restant", "blueRemaining"]),
    white: pick(src, ["blancRestants", "joursBlancRestants", "restantsBlanc", "blanc_restant", "whiteRemaining"]),
    red: pick(src, ["rougeRestants", "joursRougeRestants", "restantsRouge", "rouge_restant", "redRemaining"])
  };
  // Aucun champ reconnu : on l'assume au lieu de renvoyer trois null
  // silencieux que le widget prendrait pour "zero jour restant".
  // No recognised field: we own it rather than returning three silent
  // nulls the widget could read as "zero days left".
  if (out.blue === null && out.white === null && out.red === null) return null;
  return out;
}

async function getTempo(opts) {
  const force = !!(opts && opts.force);
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  // Promise.allSettled et non all : la couleur du jour doit s'afficher
  // meme si la route des statistiques est en panne. Un echec partiel ne
  // doit pas vider la tuile.
  // Promise.allSettled, not all: today's colour must show even if the
  // stats route is down. A partial failure must not empty the tile.
  const [today, tomorrow, now, stats] = await Promise.allSettled([
    getJson("/jourTempo/today"),
    getJson("/jourTempo/tomorrow"),
    getJson("/now"),
    getJson("/stats")
  ]);

  const val = (r) => (r.status === "fulfilled" ? r.value : null);

  const value = {
    today: mapDay(val(today)),
    tomorrow: mapDay(val(tomorrow)),
    now: mapDay(val(now)),
    remaining: mapStats(val(stats)),
    updatedAt: new Date().toISOString()
  };

  if (!value.today && !value.now) throw new Error("tempo_unavailable");

  cache = { at: Date.now(), value };
  return value;
}

module.exports = { getTempo, _mapDay: mapDay, _mapStats: mapStats, COLORS };
