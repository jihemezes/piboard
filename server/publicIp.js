/* ============================================================
   PiBoard - server/publicIp.js
   Adresse IP publique du reseau local (widget "Etat systeme", option
   "Afficher l'adresse IP publique").

   Interrogee COTE SERVEUR plutot que depuis le navigateur : les services
   "quelle est mon IP" n'autorisent pas tous les requetes inter-origines,
   et centraliser l'appel evite que chaque ecran du tableau interroge
   Internet a son tour. Trois services independants sont essayes dans
   l'ordre ; le premier qui repond une adresse IPv4 valide gagne. Le
   resultat est mis en cache dix minutes : une IP publique change
   rarement, et un tableau mural n'a aucune raison de solliciter ces
   services toutes les cinq secondes.

   Aucune dependance reseau dans les fonctions pures (validation,
   analyse) : elles sont testees hors ligne dans test/publicIp.test.js.

   Public IP address of the local network ("System status" widget, "Show
   the public IP address" option).

   Queried SERVER-SIDE rather than from the browser: not every "what is
   my IP" service allows cross-origin requests, and centralising the call
   avoids every board screen hitting the Internet in turn. Three
   independent services are tried in order; the first to answer a valid
   IPv4 address wins. The result is cached for ten minutes: a public IP
   rarely changes, and a wall board has no reason to hit these services
   every five seconds.

   No network dependency in the pure functions (validation, parsing):
   they are tested offline in test/publicIp.test.js.
   ============================================================ */
"use strict";

const { isValidIp } = require("./ipv4");

const CACHE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 6000;

/* Reponse en texte brut ("1.2.3.4\n") ou en JSON ({"ip":"1.2.3.4"}) :
   les deux formats coexistent selon le service.
   Plain-text ("1.2.3.4\n") or JSON ({"ip":"1.2.3.4"}) answer: both
   formats coexist depending on the service. */
function parseIpResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  let candidate = raw;
  if (raw.startsWith("{")) {
    try { candidate = String(JSON.parse(raw).ip || ""); } catch (e) { return null; }
  }
  candidate = candidate.trim();
  return isValidIp(candidate) ? candidate : null;
}

const SERVICES = [
  "https://api.ipify.org?format=json",
  "https://ipv4.icanhazip.com/",
  "https://ifconfig.me/ip"
];

function createPublicIpLookup(options) {
  const opts = Object.assign({
    services: SERVICES,
    fetchImpl: typeof fetch === "function" ? fetch : null,
    cacheMs: CACHE_MS,
    now: () => Date.now()
  }, options || {});

  let cache = { ip: null, checkedAt: null, error: null, source: null };
  let inflight = null;

  async function query() {
    if (!opts.fetchImpl) throw new Error("fetch unavailable");
    let lastError = null;
    for (const url of opts.services) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await opts.fetchImpl(url, {
          signal: ctrl.signal,
          headers: { "User-Agent": "PiBoard", "Accept": "text/plain, application/json" }
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const ip = parseIpResponse(await res.text());
        if (ip) return { ip, source: url };
        throw new Error("unrecognized answer");
      } catch (e) {
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error("no service answered");
  }

  /* `force` ignore le cache (bouton de rafraichissement, par exemple).
     Un echec conserve la derniere adresse connue, datee : c'est plus
     utile qu'un vide, et l'interface indique qu'elle n'est pas fraiche.
     `force` bypasses the cache (a refresh button, for instance). A
     failure keeps the last known, dated address: more useful than a
     blank, and the interface flags it as stale. */
  function lookup(force) {
    const fresh = cache.checkedAt != null && (opts.now() - cache.checkedAt) < opts.cacheMs;
    if (fresh && !force && cache.ip) return Promise.resolve(snapshot());
    if (inflight) return inflight;
    inflight = query().then((r) => {
      cache = { ip: r.ip, checkedAt: opts.now(), error: null, source: r.source };
    }).catch((e) => {
      cache = Object.assign({}, cache, { checkedAt: opts.now(), error: String((e && e.message) || e) });
    }).then(() => { inflight = null; return snapshot(); });
    return inflight;
  }

  function snapshot() {
    return {
      ip: cache.ip,
      stale: !!(cache.ip && cache.error),
      error: cache.error,
      checkedAt: cache.checkedAt ? new Date(cache.checkedAt).toISOString() : null
    };
  }

  return { lookup, snapshot };
}

module.exports = { createPublicIpLookup, parseIpResponse, SERVICES };
