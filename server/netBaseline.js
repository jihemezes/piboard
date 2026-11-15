/* ============================================================
   PiBoard - server/netBaseline.js
   Reference des hotes du reseau local (widget "Analyse reseau") :
   l'utilisateur « memorise » les appareils presents a un instant T ;
   tout hote qui apparait ensuite sans figurer dans cette reference est
   signale comme NOUVEAU. Le module tient aussi un journal (premier vu,
   dernier vu, arrivees, departs), detecte le changement d'identite d'un
   appareil connu (IP ou nom qui change) et repere les appareils connus
   qu'on n'a plus vus depuis longtemps.
   Identite : l'adresse MAC (cle "mac:..." de server/netHosts.js), a
   defaut l'IP. Une MAC « localement administree » (2e chiffre hexa du
   1er octet = 2, 6, a ou e) est typique du Wi-Fi prive des telephones :
   l'appareil change d'adresse a volonte, d'ou le drapeau randomMac, qui
   permet a la tuile de ne pas declencher d'alerte pour eux par defaut.
   Persistance : data/netBaseline.json via server/store.js, donc hors de
   l'arborescence livree par les ZIP de mise a jour et incluse dans les
   sauvegardes (server/backups.js recopie data/*.json).
   Les fonctions de calcul sont PURES (etat -> nouvel etat) pour etre
   testees sans disque ; seules load()/save() touchent a data/.

   Reference of the local network's hosts (the "Network scan" widget):
   the user "memorizes" the devices present at a moment T; any host
   that shows up afterwards without being in that reference is flagged
   as NEW. The module also keeps a journal (first seen, last seen,
   arrivals, departures), detects a known device's identity change (IP
   or name changing) and spots known devices not seen for a long time.
   Identity: the MAC address (the "mac:..." key of server/netHosts.js),
   the IP failing that. A "locally administered" MAC (2nd hex digit of
   the 1st octet = 2, 6, a or e) is typical of phones' private Wi-Fi
   mode: the device changes address at will, hence the randomMac flag,
   which lets the tile raise no alert for them by default.
   Persistence: data/netBaseline.json through server/store.js, outside
   the tree shipped in update ZIPs and included in backups.
   The computing functions are PURE (state -> new state) so they can be
   tested without a disk; only load()/save() touch data/.
   ============================================================ */
"use strict";

const store = require("./store");
const { hostKey, normalizeMac } = require("./netHosts");

const STORE_KEY = "netBaseline";
const MAX_LOG = 300;
const MAX_SEEN = 1000;
const MAX_BASELINE = 1000;
const MAX_CLAIMS = 500;
/* Un hote n'est declare parti qu'apres deux analyses successives sans
   lui : un ping perdu ne doit pas fabriquer un faux depart suivi d'une
   fausse arrivee. A host is declared gone only after two successive
   scans without it: one lost ping must not fabricate a false departure
   followed by a false arrival. */
const MISS_LIMIT = 2;
const KEY_RE = /^(mac:[0-9a-f:]{17}|ip:[0-9.]{7,15})$/;
const EVENT_RE = /^(new|changed|absent):(mac:[0-9a-f:]{17}|ip:[0-9.]{7,15})(:[0-9TZ:.\-]{0,40})?$/;

function emptyState() {
  return { baseline: null, seen: {}, log: [], claims: {} };
}

/* ---------- Utilitaires / helpers ---------- */

/* MAC « localement administree » : bit 1 du premier octet. Locally
   administered MAC: bit 1 of the first octet. */
function isRandomMac(mac) {
  const m = normalizeMac(mac);
  if (!m) return false;
  return (parseInt(m.slice(0, 2), 16) & 2) === 2;
}

function labelOf(h, alias) {
  return (alias || h.name || h.hostname || h.vendor || h.ip || "?");
}

function pushLog(state, entry) {
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

function clone(state) {
  return JSON.parse(JSON.stringify(state || emptyState()));
}

/* Ecarte ce qui n'a pas la forme attendue (fichier edite a la main ou
   sauvegarde plus ancienne). Discards what isn't shaped as expected
   (hand-edited file or older backup). */
function sanitize(raw) {
  const out = emptyState();
  if (!raw || typeof raw !== "object") return out;
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 80) : null);
  const iso = (v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT[0-9:.]{5,12}Z$/.test(v) ? v : null);

  if (raw.baseline && typeof raw.baseline === "object" && raw.baseline.hosts && typeof raw.baseline.hosts === "object") {
    const hosts = {};
    for (const [key, v] of Object.entries(raw.baseline.hosts).slice(0, MAX_BASELINE)) {
      if (!KEY_RE.test(key) || !v || typeof v !== "object") continue;
      hosts[key] = {
        mac: normalizeMac(v.mac) || null,
        ip: str(v.ip, 15),
        hostname: str(v.hostname),
        vendor: str(v.vendor),
        name: str(v.name),
        at: iso(v.at)
      };
    }
    out.baseline = { at: iso(raw.baseline.at), hosts };
  }
  if (raw.seen && typeof raw.seen === "object") {
    for (const [key, v] of Object.entries(raw.seen).slice(0, MAX_SEEN)) {
      if (!KEY_RE.test(key) || !v || typeof v !== "object") continue;
      const ch = v.changed && typeof v.changed === "object" && iso(v.changed.at)
        ? { at: iso(v.changed.at), fromIp: str(v.changed.fromIp, 15), fromHostname: str(v.changed.fromHostname) }
        : null;
      out.seen[key] = {
        mac: normalizeMac(v.mac) || null,
        ip: str(v.ip, 15),
        hostname: str(v.hostname),
        vendor: str(v.vendor),
        firstSeen: iso(v.firstSeen),
        lastSeen: iso(v.lastSeen),
        present: v.present !== false,
        away: v.away === true,
        misses: Math.max(0, Math.min(99, Number(v.misses) || 0)),
        changed: ch
      };
    }
  }
  if (Array.isArray(raw.log)) {
    for (const e of raw.log.slice(-MAX_LOG)) {
      if (!e || typeof e !== "object" || !iso(e.t)) continue;
      if (!/^(baseline|reset|new|arrive|leave|changed|ack|forget)$/.test(String(e.type))) continue;
      out.log.push({
        t: e.t,
        type: e.type,
        key: typeof e.key === "string" && KEY_RE.test(e.key) ? e.key : null,
        label: str(e.label, 80),
        ip: str(e.ip, 15),
        count: Number.isFinite(e.count) ? e.count : undefined
      });
    }
  }
  if (raw.claims && typeof raw.claims === "object") {
    for (const [id, t] of Object.entries(raw.claims).slice(0, MAX_CLAIMS)) {
      if (EVENT_RE.test(id) && iso(t)) out.claims[id] = t;
    }
  }
  return out;
}

/* ---------- Observation d'une analyse / observing a scan ---------- */

/* Met a jour le journal avec le resultat d'une analyse. Une analyse qui
   ne remonte aucun hote autre que la machine elle-meme est consideree
   comme ratee (reseau coupe, autorisation « Reseau local » refusee sur
   macOS...) : on n'en tire AUCUN depart.
   Updates the journal with a scan's result. A scan that reports no
   host other than the machine itself is treated as failed (network
   down, macOS "Local Network" permission denied...): NO departure is
   drawn from it. */
function observe(state, result, now) {
  const next = clone(state);
  const t = now || new Date().toISOString();
  const hosts = (result && Array.isArray(result.hosts)) ? result.hosts : [];
  const keyed = hosts.map((h) => ({ h, key: hostKey(h) })).filter((x) => x.key);
  if (!keyed.some((x) => !x.h.isSelf)) return next;

  const inScan = new Set();
  const known = next.baseline ? next.baseline.hosts : null;
  for (const { h, key } of keyed) {
    inScan.add(key);
    const rec = next.seen[key];
    const mac = normalizeMac(h.mac);
    if (!rec) {
      next.seen[key] = {
        mac, ip: h.ip || null, hostname: h.hostname || null, vendor: h.vendor || null,
        firstSeen: t, lastSeen: t, present: true, away: false, misses: 0, changed: null
      };
      const isNew = !!known && !known[key];
      pushLog(next, { t, type: isNew ? "new" : "arrive", key, label: labelOf(h), ip: h.ip || null });
      continue;
    }
    // Changement d'identite d'un appareil de la reference : l'IP ou le
    // nom a change. Les hotes reperes par IP seule n'en ont pas (leur
    // cle EST l'IP). Identity change of a reference device: IP or name
    // changed. IP-only hosts have none (their key IS the IP).
    if (known && known[key] && key.startsWith("mac:")) {
      const ipChanged = h.ip && rec.ip && h.ip !== rec.ip;
      const nameChanged = h.hostname && rec.hostname && h.hostname !== rec.hostname;
      if (ipChanged || nameChanged) {
        rec.changed = rec.changed
          ? { at: t, fromIp: rec.changed.fromIp, fromHostname: rec.changed.fromHostname }
          : { at: t, fromIp: rec.ip, fromHostname: rec.hostname };
        pushLog(next, { t, type: "changed", key, label: labelOf(h), ip: h.ip || null });
      }
    }
    if (rec.away) {
      pushLog(next, { t, type: "arrive", key, label: labelOf(h), ip: h.ip || null });
      rec.away = false;
    }
    rec.mac = mac || rec.mac;
    rec.ip = h.ip || rec.ip;
    rec.hostname = h.hostname || rec.hostname;
    rec.vendor = h.vendor || rec.vendor;
    rec.lastSeen = t;
    rec.present = true;
    rec.misses = 0;
  }
  for (const [key, rec] of Object.entries(next.seen)) {
    if (inScan.has(key) || !rec.present) continue;
    rec.misses = (rec.misses || 0) + 1;
    if (rec.misses >= MISS_LIMIT) {
      rec.present = false;
      rec.away = true;
      pushLog(next, { t, type: "leave", key, label: labelOf(rec), ip: rec.ip || null });
    }
  }
  // Garde-fou de taille : on ecarte les plus anciens, hors reference.
  // Size safety net: oldest dropped, reference members excepted.
  const keys = Object.keys(next.seen);
  if (keys.length > MAX_SEEN) {
    keys.filter((k) => !(known && known[k]))
      .sort((a, b) => String(next.seen[a].lastSeen).localeCompare(String(next.seen[b].lastSeen)))
      .slice(0, keys.length - MAX_SEEN)
      .forEach((k) => { delete next.seen[k]; });
  }
  return next;
}

/* ---------- Annotation du resultat pour la tuile / annotating for the tile ---------- */

/* Ajoute a chaque hote son statut par rapport a la reference :
     status  null (pas de reference) | "known" | "new"
     alert   true si l'hote doit declencher une alerte (nouveau, et pas
             une MAC aleatoire sauf si alertRandom)
     changed {at, fromIp, fromHostname} quand l'identite a change
     eventId identifiant d'evenement (pour claim)
   et rend aussi la liste des appareils connus absents depuis plus de
   absentHours heures (0 = desactive).
   Adds to each host its status relative to the reference (...) and
   also returns the list of known devices absent for more than
   absentHours hours (0 = disabled). */
function annotate(state, hosts, aliases, opts) {
  const o = opts || {};
  const now = o.now ? new Date(o.now).getTime() : Date.now();
  const absentMs = Math.max(0, Number(o.absentHours) || 0) * 3600000;
  const table = aliases || {};
  const base = state && state.baseline ? state.baseline : null;
  const seen = (state && state.seen) || {};
  const list = Array.isArray(hosts) ? hosts : [];
  const present = new Set();
  let newCount = 0;
  let alertCount = 0;
  let changedCount = 0;

  const out = list.map((h) => {
    const key = h.key || hostKey(h);
    if (key) present.add(key);
    const rec = key ? seen[key] : null;
    const randomMac = isRandomMac(h.mac);
    const extra = {
      randomMac,
      firstSeen: rec ? rec.firstSeen : null,
      lastSeen: rec ? rec.lastSeen : null,
      status: null,
      alert: false,
      changed: null,
      eventId: null
    };
    if (base && key) {
      if (base.hosts[key]) {
        extra.status = "known";
        if (rec && rec.changed) {
          extra.changed = rec.changed;
          extra.eventId = "changed:" + key + ":" + rec.changed.at;
          changedCount++;
        }
      } else {
        extra.status = "new";
        extra.eventId = "new:" + key;
        extra.alert = !randomMac || o.alertRandom === true;
        newCount++;
        if (extra.alert) alertCount++;
      }
    }
    return Object.assign({}, h, extra);
  });

  const absent = [];
  if (base && absentMs > 0) {
    for (const [key, b] of Object.entries(base.hosts)) {
      if (present.has(key)) continue;
      const rec = seen[key];
      const last = (rec && rec.lastSeen) || b.at;
      const lastMs = last ? new Date(last).getTime() : NaN;
      if (!Number.isFinite(lastMs) || now - lastMs < absentMs) continue;
      absent.push({
        key,
        name: (table[key] && table[key].name) || b.name || b.hostname || b.vendor || b.ip || key,
        ip: b.ip, mac: b.mac, vendor: b.vendor,
        lastSeen: last,
        eventId: "absent:" + key + ":" + last
      });
    }
    absent.sort((a, b) => String(a.lastSeen).localeCompare(String(b.lastSeen)));
  }

  return {
    hosts: out,
    absent,
    baseline: base ? { at: base.at, count: Object.keys(base.hosts).length } : null,
    newCount, alertCount, changedCount
  };
}

/* ---------- Actions de l'utilisateur / user actions ---------- */

function entryFromHost(h, aliases, t) {
  const key = h.key || hostKey(h);
  const alias = key && aliases && aliases[key] ? aliases[key].name : null;
  return [key, {
    mac: normalizeMac(h.mac) || null,
    ip: h.ip || null,
    hostname: h.hostname || null,
    vendor: h.vendor || null,
    name: alias || null,
    at: t
  }];
}

/* « Memoriser maintenant » : la reference devient exactement les hotes
   de la derniere analyse. Les alertes en attente sont purgees.
   "Memorize now": the reference becomes exactly the hosts of the last
   scan. Pending alerts are cleared. */
function memorize(state, hosts, aliases, now) {
  const t = now || new Date().toISOString();
  const keyed = (Array.isArray(hosts) ? hosts : []).map((h) => entryFromHost(h, aliases, t)).filter((e) => e[0]);
  if (!keyed.some((e) => e[1].mac || e[1].ip)) throw new Error("no host to memorize");
  const next = clone(state);
  next.baseline = { at: t, hosts: Object.fromEntries(keyed.slice(0, MAX_BASELINE)) };
  next.claims = {};
  for (const rec of Object.values(next.seen)) rec.changed = null;
  pushLog(next, { t, type: "baseline", count: keyed.length });
  return next;
}

/* « Reconnaitre » : ajoute des hotes a la reference (nouvel appareil
   legitime) et efface leur changement d'identite en attente.
   "Acknowledge": adds hosts to the reference (a legitimate new device)
   and clears their pending identity change. */
function acknowledge(state, keys, hosts, aliases, now) {
  if (!state || !state.baseline) throw new Error("no baseline");
  const t = now || new Date().toISOString();
  const next = clone(state);
  const byKey = new Map();
  for (const h of Array.isArray(hosts) ? hosts : []) {
    const k = h.key || hostKey(h);
    if (k) byKey.set(k, h);
  }
  for (const key of Array.isArray(keys) ? keys : []) {
    if (!KEY_RE.test(String(key))) continue;
    const h = byKey.get(key);
    if (h) {
      const [, entry] = entryFromHost(h, aliases, t);
      next.baseline.hosts[key] = entry;
    } else if (!next.baseline.hosts[key]) continue;
    if (next.seen[key]) next.seen[key].changed = null;
    pushLog(next, { t, type: "ack", key, label: labelOf(h || next.baseline.hosts[key]), ip: (h && h.ip) || null });
  }
  return next;
}

/* « Oublier » : retire des appareils de la reference (ancien appareil
   disparu pour de bon). "Forget": removes devices from the reference
   (an old device that is gone for good). */
function forget(state, keys, now) {
  if (!state || !state.baseline) throw new Error("no baseline");
  const t = now || new Date().toISOString();
  const next = clone(state);
  for (const key of Array.isArray(keys) ? keys : []) {
    const b = next.baseline.hosts[key];
    if (!b) continue;
    delete next.baseline.hosts[key];
    pushLog(next, { t, type: "forget", key, label: labelOf(b), ip: b.ip || null });
  }
  return next;
}

function reset(state, now) {
  const next = clone(state);
  next.baseline = null;
  next.claims = {};
  pushLog(next, { t: now || new Date().toISOString(), type: "reset" });
  return next;
}

/* Revendique des evenements : rend ceux qui n'avaient PAS encore ete
   revendiques. Plusieurs ecrans (le Pi et le Mac, par exemple) peuvent
   afficher la tuile : la notification externe (webhook) ne doit partir
   qu'une fois par evenement, donc seul celui qui revendique en premier
   l'envoie.
   Claims events: returns those that had NOT yet been claimed. Several
   screens (the Pi and the Mac, say) may display the tile: the external
   notification (webhook) must go out only once per event, so only
   whoever claims first sends it. */
function claim(state, ids, now) {
  const t = now || new Date().toISOString();
  const next = clone(state);
  const granted = [];
  for (const id of Array.isArray(ids) ? ids.slice(0, 50) : []) {
    if (!EVENT_RE.test(String(id)) || next.claims[id]) continue;
    next.claims[id] = t;
    granted.push(id);
  }
  const keys = Object.keys(next.claims);
  if (keys.length > MAX_CLAIMS) {
    keys.sort((a, b) => String(next.claims[a]).localeCompare(String(next.claims[b])))
      .slice(0, keys.length - MAX_CLAIMS)
      .forEach((k) => { delete next.claims[k]; });
  }
  return { state: next, granted };
}

/* ---------- Persistance / persistence ---------- */

function load() {
  return sanitize(store.read(STORE_KEY, null));
}

function save(state) {
  const clean = sanitize(state);
  store.write(STORE_KEY, clean);
  return clean;
}

module.exports = {
  STORE_KEY, MAX_LOG, MISS_LIMIT, KEY_RE, EVENT_RE,
  emptyState, sanitize, isRandomMac,
  observe, annotate, memorize, acknowledge, forget, reset, claim,
  load, save
};
