/* ============================================================
   PiBoard - server/weatherPhoto.js
   Photo de fond pour la tuile meteo, via l'API Openverse (agregateur
   d'images sous licence Creative Commons ou domaine public, sans cle).
   Une photo est mise en cache par condition meteo (7 jours) dans data/,
   partagee par toutes les tuiles meteo : meme avec de nombreuses tuiles,
   on ne sollicite Openverse qu'une poignee de fois par semaine, tres en
   dessous de sa limite anonyme (5 requetes/heure, 100/jour).
   Weather tile background photo, via the Openverse API (an aggregator of
   Creative Commons / public domain images, keyless). One photo is cached
   per weather condition (7 days) in data/, shared by every weather tile:
   even with many tiles, Openverse is only hit a handful of times a week,
   well under its anonymous limit (5 requests/hour, 100/day).
   ============================================================ */
"use strict";

const store = require("./store");

/* Requete de recherche par condition (icone du widget meteo).
   Termes valides avec l'utilisateur a partir d'exemples concrets :
   des ciels purs, jamais de paysage qui alourdirait le fond.
   Search query per condition (weather widget icon). Terms validated
   with the user from concrete examples: plain skies, never a busy
   landscape that would clutter the background. */
const QUERIES = {
  sun: "clear blue sky bright sun",
  "sun-cloud": "sun clouds cumulus sky daytime",
  cloud: "overcast grey sky clouds",
  fog: "foggy misty sky atmosphere",
  drizzle: "raindrops window glass light rain",
  rain: "raindrops on window glass",
  snow: "falling snow winter sky",
  storm: "lightning storm sky electricity"
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours / 7 days
const USER_AGENT = "PiBoard/0.1 (personal dashboard; +https://github.com/jihemezes/piboard)";

function cacheKey(condition) {
  return "weatherphoto." + condition;
}

async function fetchFromOpenverse(condition, fetchImpl) {
  const q = QUERIES[condition] || "sky weather";
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q)
    + "&license_type=commercial&extension=jpg&page_size=12&orientation=wide";
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error("openverse status " + res.status);
  const data = await res.json();
  const results = (data.results || []).filter((r) => r.url && (!r.width || r.width >= 640));
  if (!results.length) throw new Error("no usable results");
  const pick = results[Math.floor(Math.random() * Math.min(results.length, 6))];
  return {
    condition,
    query: q,
    url: pick.url,
    creator: pick.creator || null,
    creatorUrl: pick.creator_url || null,
    license: (pick.license || "").toUpperCase(),
    sourceUrl: pick.foreign_landing_url || pick.url,
    cachedAt: Date.now()
  };
}

/* Retourne une photo pour la condition donnee, depuis le cache si elle est
   fraiche, sinon en interrogeant Openverse. En cas d'echec reseau, retombe
   sur une entree perimee du cache plutot que de ne rien renvoyer.
   Returns a photo for the given condition, from cache if fresh, otherwise
   by querying Openverse. On network failure, falls back to a stale cache
   entry rather than returning nothing. */
async function getWeatherPhoto(condition, fetchImpl) {
  const key = cacheKey(condition);
  const cached = store.read(key, null);
  const expectedQuery = QUERIES[condition] || "sky weather";
  // Le cache n'est valide que s'il est frais ET s'il correspond toujours a
  // la requete de recherche actuelle. Si les termes ont ete affines depuis
  // (comme ici, apres validation avec l'utilisateur), l'ancienne photo est
  // invalidee immediatement plutot que de rester servie jusqu'a expiration.
  // The cache is only valid if it's fresh AND still matches the current
  // search query. If the terms were refined since (as here, after user
  // validation), the old photo is invalidated right away instead of
  // being served until expiry.
  const isCacheValid = cached && cached.query === expectedQuery && Date.now() - cached.cachedAt < TTL_MS;
  if (isCacheValid) return cached;
  try {
    const photo = await fetchFromOpenverse(condition, fetchImpl);
    store.write(key, photo);
    return photo;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

module.exports = { getWeatherPhoto, QUERIES, TTL_MS };
