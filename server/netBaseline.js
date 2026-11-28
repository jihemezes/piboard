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

const os = require("os");
const crypto = require("crypto");
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

/* 1.181.0 - REFERENTIEL. La reference n'est plus une photo des hotes
   presents a un instant T : c'est un referentiel CUMULATIF, une fiche par
   appareil (cle MAC), qui ne perd jamais un appareil sauf « Oublier ».
     baseline.hosts[key] : fiche (mac, ip, nom reseau, fabricant, premiere
                           et derniere apparition, IP connues par reseau,
                           reseaux, « vu par » chaque PiBoard, champs
                           saisis : type, proprietaire, notes, confiance,
                           nom -- chacun date pour la fusion, voir
                           server/netRegistry.js)
     deleted[key]        : appareils oublies {at, by} (propages a la fusion)
     networks[id]        : reseaux reconnus (MAC de la passerelle)
     self                : identite de CE PiBoard {id, name}
   REGISTRY. The reference is no longer a snapshot of the hosts present at
   a moment T: it is a CUMULATIVE registry, one record per device (MAC
   key), which never loses a device except through "Forget". */
const FIELD_NAMES = ["name", "type", "owner", "notes", "trusted"];
const DEVICE_TYPES = ["router", "computer", "laptop", "phone", "tablet", "tv", "printer", "nas", "camera", "speaker", "console", "iot", "network", "server", "other"];
const MAX_IPS = 20;
const MAX_NETWORKS = 20;
const MAX_SEENBY = 20;
const MAX_DELETED = 2000;
const ID_RE = /^pb-[0-9a-f]{12}$/;
const NET_RE = /^(gw:[0-9a-f:]{17}|net:[0-9./]{9,18})$/;

function emptyState() {
  return { baseline: null, seen: {}, log: [], claims: {}, deleted: {}, networks: {}, currentNet: null, self: null };
}

/* Identite de ce PiBoard, creee une fois / this PiBoard's identity, created once */
function ensureSelf(state) {
  if (!state.self || !ID_RE.test(String(state.self.id))) {
    state.self = { id: "pb-" + crypto.randomBytes(6).toString("hex"), name: String(os.hostname() || "PiBoard").slice(0, 40) };
  }
  return state.self;
}

/* Identifiant du reseau : MAC de la passerelle, a defaut le sous-reseau
   (« suppose », moins sur). Network id: gateway MAC, failing that the
   subnet ("assumed", less certain). */
function networkIdOf(result) {
  const gw = result && result.gateway;
  const mac = gw && normalizeMac(gw.mac);
  if (mac) return { id: "gw:" + mac, assumed: false, gatewayIp: gw.ip || null, gatewayMac: mac };
  if (result && typeof result.cidr === "string" && /^[0-9./]{9,18}$/.test(result.cidr)) {
    return { id: "net:" + result.cidr, assumed: true, gatewayIp: gw ? gw.ip || null : null, gatewayMac: null };
  }
  return null;
}

/* ---------- Utilitaires / helpers ---------- */

/* MAC « localement administree » : bit 1 du premier octet. Locally
   administered MAC: bit 1 of the first octet. */
function isRandomMac(mac) {
  const m = normalizeMac(mac);
  if (!m) return false;
  return (parseInt(m.slice(0, 2), 16) & 2) === 2;
}

function netName(state, id) {
  const n = state && state.networks ? state.networks[id] : null;
  return n && n.name && n.name.v ? n.name.v : null;
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

/* Champ date pour la fusion : {v, at, by, bases} -- `bases` = dates des
   valeurs qu'il remplace (voir server/netRegistry.js).
   Dated field for merging: {v, at, by, bases}. */
function sanitizeField(f, str, iso, max) {
  if (!f || typeof f !== "object" || !iso(f.at)) return null;
  let v = f.v;
  if (typeof v === "boolean") { /* confiance / trusted */ }
  else v = typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, max || 80) : "";
  const bases = Array.isArray(f.bases) ? f.bases.filter((b) => iso(b)).slice(-6) : [];
  return { v, at: f.at, by: str(f.by, 15), bases };
}

function sanitizeRecord(v, str, iso) {
  const rec = {
    firstSeen: iso(v.firstSeen),
    lastSeen: iso(v.lastSeen),
    randomMac: v.randomMac === true || isRandomMac(v.mac),
    ips: [],
    networks: [],
    seenBy: {},
    fields: {}
  };
  if (Array.isArray(v.ips)) {
    for (const e of v.ips.slice(-MAX_IPS)) {
      if (e && typeof e.ip === "string" && /^[0-9.]{7,15}$/.test(e.ip)) {
        rec.ips.push({ ip: e.ip, net: NET_RE.test(String(e.net)) ? e.net : null, first: iso(e.first), last: iso(e.last) });
      }
    }
  }
  if (Array.isArray(v.networks)) rec.networks = v.networks.filter((n) => NET_RE.test(String(n))).slice(0, MAX_NETWORKS);
  if (v.seenBy && typeof v.seenBy === "object") {
    for (const [id, sb] of Object.entries(v.seenBy).slice(0, MAX_SEENBY)) {
      if (ID_RE.test(id) && sb && iso(sb.at)) rec.seenBy[id] = { name: str(sb.name, 40) || id, at: sb.at };
    }
  }
  if (v.fields && typeof v.fields === "object") {
    for (const f of FIELD_NAMES) {
      const clean = sanitizeField(v.fields[f], str, iso, f === "notes" ? 500 : f === "name" ? 40 : 60);
      if (!clean) continue;
      if (f === "trusted") clean.v = clean.v === true;
      else if (typeof clean.v !== "string") clean.v = "";
      if (f === "type" && clean.v && !DEVICE_TYPES.includes(clean.v)) clean.v = "other";
      rec.fields[f] = clean;
    }
  }
  return rec;
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
      Object.assign(hosts[key], sanitizeRecord(v, str, iso));
    }
    out.baseline = { at: iso(raw.baseline.at), hosts };
  }
  if (raw.deleted && typeof raw.deleted === "object") {
    for (const [key, v] of Object.entries(raw.deleted).slice(-MAX_DELETED)) {
      if (KEY_RE.test(key) && v && iso(v.at)) out.deleted[key] = { at: v.at, by: str(v.by, 15) };
    }
  }
  if (raw.networks && typeof raw.networks === "object") {
    for (const [id, v] of Object.entries(raw.networks).slice(0, MAX_NETWORKS)) {
      if (!NET_RE.test(id) || !v || typeof v !== "object") continue;
      out.networks[id] = {
        name: sanitizeField(v.name, str, iso, 40),
        gatewayIp: str(v.gatewayIp, 15),
        gatewayMac: normalizeMac(v.gatewayMac) || null,
        cidr: str(v.cidr, 18),
        assumed: v.assumed === true,
        firstSeen: iso(v.firstSeen),
        lastSeen: iso(v.lastSeen)
      };
    }
  }
  if (typeof raw.currentNet === "string" && NET_RE.test(raw.currentNet)) out.currentNet = raw.currentNet;
  if (raw.self && ID_RE.test(String(raw.self.id))) out.self = { id: raw.self.id, name: str(raw.self.name, 40) || "PiBoard" };
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
      if (!/^(baseline|reset|new|arrive|leave|changed|ack|forget|merge)$/.test(String(e.type))) continue;
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

  // Reseau courant (1.181.0) / current network
  const self = ensureSelf(next);
  const net = recordNetwork(next, result, t);
  // Fiches du referentiel vues dans cette analyse / registry records seen in this scan
  if (next.baseline) {
    for (const { h, key } of keyed) {
      const r = next.baseline.hosts[key];
      if (!r) continue;
      touchRecord(r, h, net ? net.id : null, self, t);
    }
  }

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
    if (base && key && base.hosts[key]) {
      // Fiche du referentiel pour la tuile / registry record for the tile
      const r = base.hosts[key];
      const f = r.fields || {};
      extra.reg = {
        type: f.type ? f.type.v || null : null,
        owner: f.owner ? f.owner.v || null : null,
        notes: f.notes ? f.notes.v || null : null,
        trusted: !!(f.trusted && f.trusted.v === true),
        firstSeen: r.firstSeen || null,
        lastSeen: r.lastSeen || null,
        networks: (r.networks || []).map((id) => ({ id, name: netName(state, id) })),
        seenBy: Object.entries(r.seenBy || {}).map(([id, sb]) => ({ id, name: sb.name, at: sb.at }))
          .sort((a, b) => String(b.at).localeCompare(String(a.at))),
        ips: (r.ips || []).slice().sort((a, b) => String(b.last).localeCompare(String(a.last)))
          .map((e) => ({ ip: e.ip, net: e.net ? netName(state, e.net) : null, first: e.first, last: e.last }))
      };
      if (r.firstSeen && (!extra.firstSeen || r.firstSeen < extra.firstSeen)) extra.firstSeen = r.firstSeen;
    }
    if (base && key) {
      if (base.hosts[key]) {
        extra.status = "known";
        if (rec && rec.changed && !(extra.reg && extra.reg.trusted)) {
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

  const cur = state && state.currentNet && state.networks ? state.networks[state.currentNet] : null;
  return {
    hosts: out,
    network: cur ? {
      id: state.currentNet,
      name: cur.name && cur.name.v ? cur.name.v : null,
      gatewayIp: cur.gatewayIp || null,
      gatewayMac: cur.gatewayMac || null,
      assumed: !!cur.assumed,
      known: Object.keys(state.networks).length
    } : null,
    self: state && state.self ? state.self : null,
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
/* 1.181.0 : « Mettre a jour la reference » est CUMULATIF. Les hotes de la
   derniere analyse sont ajoutes ou mis a jour ; les appareils absents ce
   jour-la restent dans le referentiel avec tout ce qu'on sait d'eux.
   "Update the reference" is CUMULATIVE: the last scan's hosts are added
   or updated; devices absent that day stay in the registry. */
function memorize(state, hosts, aliases, now, net) {
  const t = now || new Date().toISOString();
  const list = (Array.isArray(hosts) ? hosts : []).filter((h) => h && (h.key || hostKey(h)));
  if (!list.length) throw new Error("no host to memorize");
  const next = clone(state);
  const self = ensureSelf(next);
  if (!next.baseline) next.baseline = { at: t, hosts: {} };
  next.baseline.at = t;
  let added = 0;
  for (const h of list) {
    const key = h.key || hostKey(h);
    if (!next.baseline.hosts[key]) {
      if (Object.keys(next.baseline.hosts).length >= MAX_BASELINE) continue;
      const [, entry] = entryFromHost(h, aliases, t);
      next.baseline.hosts[key] = entry;
      added++;
    }
    delete next.deleted[key];
    touchRecord(next.baseline.hosts[key], h, net || next.currentNet, self, t);
  }
  next.claims = {};
  for (const rec of Object.values(next.seen)) rec.changed = null;
  pushLog(next, { t, type: "baseline", count: list.length });
  next.lastMemorize = { added, total: Object.keys(next.baseline.hosts).length };
  return next;
}

/* Note le reseau d'une analyse (en place). Records a scan's network (in place). */
function recordNetwork(next, result, t) {
  const net = networkIdOf(result);
  if (!net) return null;
  const n = next.networks[net.id] || (next.networks[net.id] = { name: null, firstSeen: t });
  n.gatewayIp = net.gatewayIp || n.gatewayIp || null;
  n.gatewayMac = net.gatewayMac || n.gatewayMac || null;
  n.cidr = (result && result.cidr) || n.cidr || null;
  n.assumed = net.assumed;
  n.lastSeen = t;
  next.currentNet = net.id;
  return net;
}
function noteNetwork(state, result, now) {
  const next = clone(state);
  recordNetwork(next, result, now || new Date().toISOString());
  return next;
}

/* Met a jour une fiche avec une observation / updates a record with a sighting */
function touchRecord(r, h, netId, self, t) {
  r.mac = normalizeMac(h.mac) || r.mac || null;
  r.ip = h.ip || r.ip || null;
  r.hostname = h.hostname || r.hostname || null;
  r.vendor = h.vendor || r.vendor || null;
  if (!r.firstSeen) r.firstSeen = t;
  if (!r.lastSeen || t > r.lastSeen) r.lastSeen = t;
  r.randomMac = isRandomMac(r.mac);
  r.ips = Array.isArray(r.ips) ? r.ips : [];
  if (h.ip) {
    const e = r.ips.find((x) => x.ip === h.ip && x.net === (netId || null));
    if (e) e.last = t;
    else r.ips.push({ ip: h.ip, net: netId || null, first: t, last: t });
    if (r.ips.length > MAX_IPS) {
      r.ips.sort((a, b) => String(a.last).localeCompare(String(b.last)));
      r.ips.splice(0, r.ips.length - MAX_IPS);
    }
  }
  r.networks = Array.isArray(r.networks) ? r.networks : [];
  if (netId && !r.networks.includes(netId)) r.networks.push(netId);
  r.seenBy = r.seenBy || {};
  if (self) r.seenBy[self.id] = { name: self.name, at: t };
  r.fields = r.fields || {};
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
    // Pierre tombale : l'oubli se propage aux autres PiBoard a la fusion.
    // Tombstone: forgetting spreads to the other PiBoards on merge.
    next.deleted[key] = { at: t, by: ensureSelf(next).id };
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
  STORE_KEY, MAX_LOG, MISS_LIMIT, KEY_RE, EVENT_RE, NET_RE, ID_RE, FIELD_NAMES, DEVICE_TYPES,
  MAX_BASELINE, MAX_DELETED, MAX_IPS, MAX_NETWORKS,
  emptyState, sanitize, sanitizeRecord, sanitizeField, isRandomMac, ensureSelf, networkIdOf, noteNetwork, touchRecord, clone,
  observe, annotate, memorize, acknowledge, forget, reset, claim,
  load, save
};
