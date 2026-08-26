/* ============================================================
   PiBoard - server/homeAssistant.js
   Connexion a Home Assistant : lecture des etats des entites.

   TRANSPORT : WebSocket en priorite, REST en repli.

   Le WebSocket est le bon choix ici parce qu'un tableau mural doit
   montrer une porte qui s'ouvre dans la seconde, pas au prochain
   sondage. Mais il impose trois precautions, dont la premiere nous a
   deja coute une version (voir 1.67.1, ImapFlow) :

   1. TOUT auditeur "error" doit exister. Un WebSocket qui emet une
      erreur sans auditeur, ou une promesse rejetee hors pile d'appel,
      remonte en uncaughtException et fait tomber le serveur.
   2. La reconnexion doit etre a DELAI CROISSANT. Une reconnexion
      immediate en boucle sur un HA eteint saturerait le journal et le
      reseau.
   3. UNE SEULE connexion par instance HA, partagee par toutes les
      tuiles et tous les ecrans. Le cache d'etats est cote serveur ; les
      tuiles sont notifiees par le SSE deja en place.

   Le repli REST (/api/states) sert au demarrage -- pour disposer d'un
   etat complet immediatement -- et si le WebSocket ne s'etablit pas.

   LECTURE SEULE. Ce module n'appelle AUCUN service et n'expose aucun
   moyen de le faire. Le pilotage viendra separement, avec les
   protections qu'il exige (liste blanche de services, confirmation).

   Connection to Home Assistant: reading entity states.

   TRANSPORT: WebSocket first, REST as a fallback.

   WebSocket is the right choice here because a wall board must show a
   door opening within the second, not at the next poll. But it demands
   three precautions, the first of which already cost us a release (see
   1.67.1, ImapFlow):

   1. EVERY "error" listener must exist. A WebSocket emitting an error
      with no listener, or a promise rejected outside any call stack,
      surfaces as an uncaughtException and brings the server down.
   2. Reconnection must use a GROWING DELAY. Immediate reconnection in a
      loop against a powered-off HA would flood the log and the network.
   3. ONE SINGLE connection per HA instance, shared by every tile and
      every screen. The state cache is server-side; tiles are notified
      through the SSE channel already in place.

   The REST fallback (/api/states) serves at startup -- to have a full
   state immediately -- and when the WebSocket cannot be established.

   READ ONLY. This module calls NO service and exposes no way to do so.
   Control will come separately, with the protections it requires
   (service allow-list, confirmation).
   ============================================================ */
"use strict";

const HTTP_TIMEOUT_MS = 10000;

/* Delai de reconnexion croissant, plafonne. Le plafond a 60 s evite
   qu'une absence prolongee (HA eteint la nuit) ne devienne un
   rafraichissement horaire inutilisable.
   Growing reconnect delay, capped. The 60 s cap stops a long absence (HA
   powered off overnight) from turning into an unusable hourly retry. */
const RECONNECT_MS = [2000, 5000, 15000, 30000, 60000];

/* Connexions par instance HA. La cle inclut le jeton : deux tuiles
   pointant le meme hote avec des jetons differents sont deux contextes
   distincts.
   Connections per HA instance. The key includes the token: two tiles
   pointing at the same host with different tokens are two distinct
   contexts. */
const connections = new Map();

function normalizeBase(url) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) return "http://" + u;
  return u;
}

function wsUrlFor(base) {
  return base.replace(/^http/i, "ws") + "/api/websocket";
}

function keyFor(base, token) {
  // Le jeton n'est jamais journalise ; seule son empreinte courte sert
  // de cle, ce qui evite de le voir apparaitre dans un message d'erreur.
  // The token is never logged; only a short fingerprint acts as a key,
  // which keeps it out of any error message.
  let h = 0;
  const s = String(token || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return base + "#" + (h >>> 0).toString(36);
}

/* Reduit une entite HA a ce que la tuile affiche. On ne conserve PAS
   l'integralite des attributs : certaines entites en portent des
   dizaines (listes de zones, previsions meteo completes), et les
   transmettre a chaque changement d'etat inonderait le SSE.
   Reduces an HA entity to what the tile displays. We do NOT keep the
   full attribute set: some entities carry dozens (zone lists, complete
   weather forecasts), and shipping them on every state change would
   flood the SSE channel. */
function slimEntity(e) {
  if (!e || !e.entity_id) return null;
  const a = e.attributes || {};
  return {
    id: e.entity_id,
    domain: String(e.entity_id).split(".")[0],
    state: e.state,
    name: a.friendly_name || e.entity_id,
    unit: a.unit_of_measurement || null,
    deviceClass: a.device_class || null,
    changed: e.last_changed || null
  };
}

async function restStates(base, token) {
  const res = await fetch(base + "/api/states", {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http_" + res.status);
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error("bad_payload");
  const map = new Map();
  for (const raw of list) {
    const e = slimEntity(raw);
    if (e) map.set(e.id, e);
  }
  return map;
}

/* Traitement d'un message du WebSocket HA. Fonction PURE, sans effet de
   bord ni acces reseau : c'est ce qui la rend testable sans ouvrir de
   socket, et le protocole HA tient entierement dans ces quelques cas.
   Handling of a message from HA's WebSocket. A PURE function, with no
   side effect and no network access: that is what makes it testable
   without opening a socket, and HA's protocol fits entirely in these few
   cases. */
function handleMessage(msg, ctx) {
  if (!msg || typeof msg !== "object") return { action: "ignore" };
  switch (msg.type) {
    case "auth_required":
      return { action: "send", payload: { type: "auth", access_token: ctx.token } };
    case "auth_ok":
      // On s'abonne aux seuls changements d'etat. "subscribe_events" sans
      // event_type deverserait TOUS les evenements de HA (appels de
      // service, minuteries, journal) : un volume sans rapport avec ce
      // qu'on affiche.
      // We subscribe to state changes only. "subscribe_events" with no
      // event_type would pour out EVERY HA event (service calls, timers,
      // logbook): a volume unrelated to what we display.
      return { action: "send", payload: { id: ctx.nextId, type: "subscribe_events", event_type: "state_changed" } };
    case "auth_invalid":
      return { action: "fail", reason: "unauthorized" };
    case "event": {
      const d = msg.event && msg.event.data;
      if (!d || !d.entity_id) return { action: "ignore" };
      // new_state absent = entite supprimee de HA. On la retire du cache
      // plutot que de laisser une valeur figee a l'ecran.
      // Missing new_state = entity removed from HA. We drop it from the
      // cache rather than leaving a frozen value on screen.
      if (!d.new_state) return { action: "remove", id: d.entity_id };
      const e = slimEntity(d.new_state);
      return e ? { action: "update", entity: e } : { action: "ignore" };
    }
    case "result":
      return msg.success === false
        ? { action: "warn", reason: (msg.error && msg.error.message) || "result_error" }
        : { action: "ignore" };
    default:
      return { action: "ignore" };
  }
}

function getConnection(base, token, onChange) {
  const key = keyFor(base, token);
  let c = connections.get(key);
  if (c) return c;

  c = {
    base, token, key,
    states: new Map(),
    ready: false,
    lastError: null,
    transport: "none",
    ws: null,
    nextId: 1,
    attempt: 0,
    reconnectTimer: null,
    closed: false,
    onChange: onChange || (() => {})
  };
  connections.set(key, c);
  openSocket(c);
  return c;
}

function openSocket(c) {
  if (c.closed) return;
  let ws;
  try {
    ws = new WebSocket(wsUrlFor(c.base));
  } catch (e) {
    // Une URL invalide fait echouer le constructeur immediatement.
    // An invalid URL makes the constructor throw straight away.
    c.lastError = "bad_url";
    return scheduleReconnect(c);
  }
  c.ws = ws;

  ws.addEventListener("open", () => { c.attempt = 0; });

  ws.addEventListener("message", (ev) => {
    let msg = null;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    const r = handleMessage(msg, { token: c.token, nextId: c.nextId });
    switch (r.action) {
      case "send":
        if (r.payload.id) c.nextId++;
        try { ws.send(JSON.stringify(r.payload)); } catch (e) { /* socket ferme / socket closed */ }
        if (r.payload.type === "subscribe_events") {
          c.transport = "websocket";
          c.ready = true;
          c.lastError = null;
          // Un abonnement ne renvoie QUE les changements a venir : l'etat
          // courant doit etre charge en REST une fois, sinon la tuile
          // resterait vide jusqu'a ce que chaque entite bouge d'elle-meme.
          // A subscription returns ONLY future changes: the current state
          // must be loaded once over REST, otherwise the tile would stay
          // empty until each entity happened to change on its own.
          restStates(c.base, c.token)
            .then((map) => { c.states = map; c.onChange(c); })
            .catch((e) => { c.lastError = String(e.message || e); });
        }
        break;
      case "update":
        c.states.set(r.entity.id, r.entity);
        c.onChange(c, r.entity);
        break;
      case "remove":
        c.states.delete(r.id);
        c.onChange(c);
        break;
      case "fail":
        c.lastError = r.reason;
        c.ready = false;
        try { ws.close(); } catch (e) { /* deja ferme / already closed */ }
        break;
      case "warn":
        console.warn("[piboard] HA:", r.reason);
        break;
      default:
        break;
    }
  });

  // INDISPENSABLE. Un WebSocket qui emet "error" sans auditeur fait
  // remonter l'erreur en uncaughtException -- exactement le mecanisme qui
  // a fait planter l'application en 1.67.0 avec ImapFlow.
  // MANDATORY. A WebSocket emitting "error" with no listener surfaces the
  // error as an uncaughtException -- precisely the mechanism that crashed
  // the app in 1.67.0 with ImapFlow.
  ws.addEventListener("error", () => {
    c.lastError = c.lastError || "socket_error";
  });

  ws.addEventListener("close", () => {
    c.ready = false;
    if (!c.closed) scheduleReconnect(c);
  });
}

function scheduleReconnect(c) {
  if (c.closed || c.reconnectTimer) return;
  const delay = RECONNECT_MS[Math.min(c.attempt, RECONNECT_MS.length - 1)];
  c.attempt++;
  c.reconnectTimer = setTimeout(() => {
    c.reconnectTimer = null;
    openSocket(c);
  }, delay);
  // unref : ce minuteur ne doit pas empecher le processus de se terminer
  // (important pour que les tests rendent la main).
  // unref: this timer must not keep the process alive (important so the
  // tests can exit).
  if (c.reconnectTimer.unref) c.reconnectTimer.unref();
}

/* Etats demandes. Si le WebSocket n'est pas encore pret, on sert le REST
   directement : la tuile affiche quelque chose des le premier
   affichage, sans attendre l'etablissement du socket.
   Requested states. If the WebSocket is not ready yet, we serve REST
   directly: the tile shows something from the very first render, without
   waiting for the socket to come up. */
async function getStates(baseUrl, token, ids, onChange) {
  const base = normalizeBase(baseUrl);
  if (!base) throw new Error("missing_url");
  if (!token) throw new Error("missing_token");

  const c = getConnection(base, token, onChange);

  if (!c.states.size) {
    const map = await restStates(base, token);
    c.states = map;
    if (c.transport === "none") c.transport = "rest";
  }

  const wanted = Array.isArray(ids) && ids.length ? ids : null;
  const out = [];
  if (wanted) {
    for (const id of wanted) {
      // Une entite demandee mais absente est signalee et non omise : la
      // ligne reste visible avec "inconnue", ce qui rend le probleme
      // diagnosticable au lieu de faire disparaitre la ligne.
      // A requested but missing entity is flagged rather than skipped:
      // the row stays visible as "unknown", which makes the problem
      // diagnosable instead of silently dropping the row.
      out.push(c.states.get(id) || { id, domain: String(id).split(".")[0], state: null, name: id, unit: null, deviceClass: null, missing: true });
    }
  } else {
    for (const e of c.states.values()) out.push(e);
  }

  return {
    entities: out,
    transport: c.transport,
    live: c.transport === "websocket" && c.ready,
    error: c.lastError,
    updatedAt: new Date().toISOString()
  };
}

/* Catalogue pour le selecteur de la fenetre de reglages, au format
   attendu par le type de champ "rows" : familles + instruments. On
   regroupe par domaine (sensor, binary_sensor, light...), qui est le
   classement naturel de HA.
   Catalog for the settings window picker, in the shape the "rows" field
   type expects: families + instruments. We group by domain (sensor,
   binary_sensor, light...), HA's natural classification. */
async function getCatalog(baseUrl, token) {
  const base = normalizeBase(baseUrl);
  if (!base) throw new Error("missing_url");
  const map = await restStates(base, token);
  const byDomain = new Map();
  for (const e of map.values()) {
    if (!byDomain.has(e.domain)) byDomain.set(e.domain, []);
    byDomain.get(e.domain).push({ symbol: e.id, label: e.name });
  }
  const exchanges = [...byDomain.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, list]) => ({
      id: domain,
      label: domain,
      instruments: list.sort((a, b) => String(a.label).localeCompare(String(b.label)))
    }));
  return { exchanges };
}

function closeAll() {
  for (const c of connections.values()) {
    c.closed = true;
    if (c.reconnectTimer) clearTimeout(c.reconnectTimer);
    try { if (c.ws) c.ws.close(); } catch (e) { /* deja ferme / already closed */ }
  }
  connections.clear();
}

module.exports = {
  getStates, getCatalog, closeAll,
  _handleMessage: handleMessage,
  _slimEntity: slimEntity,
  _normalizeBase: normalizeBase,
  _wsUrlFor: wsUrlFor,
  _restStates: restStates,
  RECONNECT_MS
};
