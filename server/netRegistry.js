/* ============================================================
   PiBoard - server/netRegistry.js  (1.181.0)
   Referentiel des appareils du reseau (tuile Analyse reseau) : fiches,
   champs saisis, export et FUSION entre plusieurs PiBoard.
   Network device registry (Network scan tile): records, user fields,
   export and MERGE between several PiBoards.

   PAS DE BASE CENTRALE. Chaque PiBoard garde son referentiel dans
   data/netBaseline.json ; « Exporter le referentiel » produit un fichier,
   « Fusionner un fichier… » le combine avec le sien. Les fusions
   successives dans n'importe quel ordre convergent.
   NO CENTRAL DATABASE. Each PiBoard keeps its own registry; export makes
   a file, "Merge a file…" combines it with its own. Successive merges in
   any order converge.

   CHAMPS DATES. Chaque champ saisi (nom, type, proprietaire, notes,
   confiance, nom d'un reseau) est {v, at, by, bases} :
     v      la valeur
     at     quand elle a ete saisie
     by     quel PiBoard l'a saisie
     bases  les dates des valeurs qu'elle remplace
   Deux valeurs differentes ne sont PAS forcement un conflit : si la
   valeur distante a ete saisie en connaissant la locale (sa liste
   `bases` contient la date locale), c'est une simple mise a jour, et
   inversement. Il n'y a conflit que si chacune a ete saisie sans
   connaitre l'autre : la fusion le montre alors pour que l'utilisateur
   tranche.
   DATED FIELDS. Each user field is {v, at, by, bases}. Two different
   values are NOT necessarily a conflict: if the remote value was typed
   knowing the local one (its `bases` holds the local date), it is a plain
   update, and vice versa. There is a conflict only when each was typed
   without knowing the other: the merge then shows it for the user to
   decide.

   NOMS. Les noms restent dans data/netHosts.json (rien n'est perdu ni
   deplace) ; le champ `name` du referentiel en est la copie datee, tenue
   a jour par syncNames() a chaque lecture.
   NAMES stay in data/netHosts.json (nothing lost or moved); the
   registry's `name` field is its dated copy, kept in sync by syncNames().

   MAC ALEATOIRES (Wi-Fi prive des telephones) : gardees localement, jamais
   exportees -- elles changent d'un reseau ou d'un jour a l'autre.
   RANDOM MACs: kept locally, never exported.
   ============================================================ */
"use strict";

const nb = require("./netBaseline");
const netHosts = require("./netHosts");

const FORMAT = "piboard-network-registry";
const FORMAT_VERSION = 1;
const MAX_BASES = 6;

const nowIso = () => new Date().toISOString();

/* ---------- Champs dates / dated fields ---------- */

function newField(v, t, by, prev, extraBases) {
  const bases = [];
  if (prev && prev.at) bases.push(prev.at);
  for (const b of extraBases || []) if (b && !bases.includes(b)) bases.push(b);
  return { v, at: t, by: by || null, bases: bases.slice(-MAX_BASES) };
}

function emptyValue(f) { return !f || f.v === "" || f.v === null || f.v === undefined || f.v === false; }

/* Relation entre une valeur locale et une valeur distante :
   "same" | "take" (adopter la distante) | "keep" (garder la locale) | "conflict" */
function relation(l, r) {
  if (!r) return "keep";
  if (!l) return "take";
  if (l.at === r.at) return "same";
  if (l.v === r.v) return "same";
  if ((r.bases || []).includes(l.at)) return "take";
  if ((l.bases || []).includes(r.at)) return "keep";
  // Une valeur vide jamais saisie ne s'oppose a rien. An empty never-typed value opposes nothing.
  if (emptyValue(l) && !(l.bases || []).length) return "take";
  if (emptyValue(r) && !(r.bases || []).length) return "keep";
  return "conflict";
}

/* Deux valeurs identiques : on garde la plus recente, bases reunies.
   Two identical values: keep the newest, bases united. */
function unite(l, r) {
  const keep = String(r.at) > String(l.at) ? r : l;
  const other = keep === l ? r : l;
  const bases = [...new Set([...(keep.bases || []), ...(other.bases || []), other.at !== keep.at ? other.at : null].filter(Boolean))];
  return { v: keep.v, at: keep.at, by: keep.by, bases: bases.slice(-MAX_BASES) };
}

/* ---------- Synchronisation avec netHosts.json / sync with netHosts.json ---------- */

/* Aligne le champ `name` des fiches sur netHosts.json, et fait entrer dans
   le referentiel tout appareil (MAC) qui a deja un nom : le travail de
   nommage passe ainsi tel quel dans le referentiel. Renvoie {state, changed}.
   Aligns records' `name` field with netHosts.json, and brings into the
   registry every device (MAC) that already has a name. */
function syncNames(state, aliases, now) {
  const t = now || nowIso();
  const next = nb.clone(state);
  const self = nb.ensureSelf(next);
  let changed = !state || !state.self;
  if (!next.baseline) {
    if (!Object.keys(aliases || {}).some((k) => k.startsWith("mac:"))) return { state: next, changed };
    next.baseline = { at: t, hosts: {} };
    changed = true;
  }
  const hosts = next.baseline.hosts;
  // Fiches migrees de l'ancienne reference : dates reprises du journal.
  // Records migrated from the old reference: dates taken from the journal.
  for (const [key, r] of Object.entries(hosts)) {
    if (!r.fields) { r.fields = {}; changed = true; }
    const seen = next.seen[key];
    if (!r.firstSeen) { r.firstSeen = (seen && seen.firstSeen) || r.at || t; changed = true; }
    if (!r.lastSeen && seen && seen.lastSeen) { r.lastSeen = seen.lastSeen; changed = true; }
    if (!Array.isArray(r.ips)) { r.ips = r.ip ? [{ ip: r.ip, net: next.currentNet || null, first: r.firstSeen, last: r.lastSeen || r.firstSeen }] : []; changed = true; }
    if (!Array.isArray(r.networks)) { r.networks = next.currentNet ? [next.currentNet] : []; changed = true; }
    if (!r.seenBy) { r.seenBy = { [self.id]: { name: self.name, at: r.lastSeen || r.firstSeen } }; changed = true; }
  }
  for (const [key, a] of Object.entries(aliases || {})) {
    if (!key.startsWith("mac:")) continue;
    if (!hosts[key] && !next.deleted[key]) {
      if (Object.keys(hosts).length >= nb.MAX_BASELINE) continue;
      const mac = key.slice(4);
      hosts[key] = {
        mac, ip: null, hostname: null, vendor: null, name: a.name, at: t,
        firstSeen: t, lastSeen: null, randomMac: nb.isRandomMac(mac),
        ips: [], networks: [], seenBy: {}, fields: {}
      };
      changed = true;
    }
  }
  for (const [key, r] of Object.entries(hosts)) {
    const a = aliases ? aliases[key] : null;
    const f = r.fields.name;
    const want = a ? a.name : "";
    if (f && f.v === want) continue;
    if (!f && !want) continue;
    const okIso = a && typeof a.updatedAt === "string" && /^\d{4}-\d\d-\d\dT[0-9:.]{5,12}Z$/.test(a.updatedAt);
    const at = okIso && (!f || a.updatedAt > f.at) ? a.updatedAt : t;
    r.fields.name = newField(want, at, self.id, f);
    changed = true;
  }
  return { state: next, changed };
}

/* Saisie d'un champ depuis la tuile / a field typed in the tile */
function setFields(state, key, values, now) {
  const t = now || nowIso();
  const next = nb.clone(state);
  const self = nb.ensureSelf(next);
  if (!next.baseline || !next.baseline.hosts[key]) throw new Error("unknown device");
  const r = next.baseline.hosts[key];
  r.fields = r.fields || {};
  for (const name of ["type", "owner", "notes", "trusted"]) {
    if (!values || !(name in values)) continue;
    let v = values[name];
    if (name === "trusted") v = v === true;
    else v = String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, name === "notes" ? 500 : 60);
    if (name === "type" && v && !nb.DEVICE_TYPES.includes(v)) v = "other";
    const prev = r.fields[name];
    if (prev && prev.v === v) continue;
    if (!prev && (v === "" || v === false)) continue;
    r.fields[name] = newField(v, t, self.id, prev);
  }
  return next;
}

function setNetworkName(state, id, name, now) {
  const t = now || nowIso();
  const next = nb.clone(state);
  const self = nb.ensureSelf(next);
  const n = next.networks[id];
  if (!n) throw new Error("unknown network");
  const v = String(name == null ? "" : name).replace(/\s+/g, " ").trim().slice(0, 40);
  if (!(n.name && n.name.v === v)) n.name = newField(v, t, self.id, n.name);
  return next;
}

function setSelfName(state, name) {
  const next = nb.clone(state);
  const self = nb.ensureSelf(next);
  const v = String(name == null ? "" : name).replace(/\s+/g, " ").trim().slice(0, 40);
  if (v) self.name = v;
  return next;
}

/* ---------- Export ---------- */

function exportRegistry(state, now) {
  const st = nb.clone(state);
  const self = nb.ensureSelf(st);
  const devices = {};
  const hosts = st.baseline ? st.baseline.hosts : {};
  for (const [key, r] of Object.entries(hosts)) {
    if (!key.startsWith("mac:") || r.randomMac || nb.isRandomMac(r.mac)) continue;
    devices[key] = {
      mac: r.mac, vendor: r.vendor || null, hostname: r.hostname || null, ip: r.ip || null,
      firstSeen: r.firstSeen || null, lastSeen: r.lastSeen || null, at: r.at || null,
      ips: r.ips || [], networks: r.networks || [], seenBy: r.seenBy || {}, fields: r.fields || {}
    };
  }
  const deleted = {};
  for (const [key, d] of Object.entries(st.deleted || {})) if (key.startsWith("mac:")) deleted[key] = d;
  return {
    format: FORMAT, version: FORMAT_VERSION, exportedAt: now || nowIso(),
    from: { id: self.id, name: self.name },
    networks: st.networks || {},
    devices, deleted
  };
}

/* Lit et nettoie un fichier recu / reads and cleans a received file */
function readFile(file) {
  if (!file || typeof file !== "object" || file.format !== FORMAT) throw new Error("not a PiBoard network registry file");
  const raw = {
    baseline: { at: file.exportedAt, hosts: file.devices || {} },
    deleted: file.deleted || {},
    networks: file.networks || {},
    self: file.from
  };
  const clean = nb.sanitize(raw);
  // On n'accepte jamais de MAC aleatoire d'un autre PiBoard.
  for (const [k, r] of Object.entries(clean.baseline ? clean.baseline.hosts : {})) {
    if (!k.startsWith("mac:") || nb.isRandomMac(r.mac)) delete clean.baseline.hosts[k];
  }
  return {
    from: clean.self || { id: null, name: "?" },
    devices: clean.baseline ? clean.baseline.hosts : {},
    deleted: clean.deleted,
    networks: clean.networks
  };
}

/* Date de derniere modification d'une fiche (pour arbitrer avec un oubli).
   Last modification date of a record (to weigh against a deletion). */
function lastModified(r) {
  let m = r.at || r.firstSeen || "";
  for (const f of Object.values(r.fields || {})) if (f && f.at > m) m = f.at;
  return m;
}

function labelOfRec(r, aliases, key) {
  const f = r.fields && r.fields.name;
  return (f && f.v) || (aliases && aliases[key] && aliases[key].name) || r.hostname || r.vendor || r.ip || (r.mac ? r.mac : key);
}

/* ---------- Plan de fusion (sans rien ecrire) / merge plan (no write) ---------- */

/* Calcule ce que la fusion ferait. Chaque conflit a un identifiant stable
   (`<cle>|<champ>` ou `net:<id>|name`) et une suggestion (la valeur la
   plus recente), que l'utilisateur peut inverser dans l'ecran de fusion.
   Computes what the merge would do. Each conflict has a stable id and a
   suggestion (the newest value), which the user can flip. */
function planMerge(state, aliases, file) {
  const remote = readFile(file);
  const st = state || nb.emptyState();
  const local = st.baseline ? st.baseline.hosts : {};
  const ldel = st.deleted || {};
  const self = st.self || { id: null };
  const plan = { from: remote.from, sameMachine: !!(self.id && remote.from.id === self.id), added: [], removed: [], updated: [], conflicts: [], networks: [], unchanged: 0, skipped: 0 };

  for (const [key, r] of Object.entries(remote.devices)) {
    const l = local[key];
    if (!l) {
      const tomb = ldel[key];
      if (tomb && tomb.at >= lastModified(r)) { plan.skipped++; continue; }
      plan.added.push({ key, label: labelOfRec(r, null, key), mac: r.mac, vendor: r.vendor });
      continue;
    }
    const changes = [];
    for (const f of nb.FIELD_NAMES) {
      const rel = relation(l.fields && l.fields[f], r.fields && r.fields[f]);
      if (rel === "take") changes.push({ field: f, from: l.fields && l.fields[f] ? l.fields[f].v : null, to: r.fields[f].v });
      else if (rel === "conflict") {
        const lf = l.fields[f], rf = r.fields[f];
        plan.conflicts.push({
          id: key + "|" + f, key, field: f, label: labelOfRec(l, aliases, key),
          local: { v: lf.v, at: lf.at, by: lf.by, byName: byName(st, remote, lf.by) },
          remote: { v: rf.v, at: rf.at, by: rf.by, byName: byName(st, remote, rf.by) },
          suggested: String(rf.at) > String(lf.at) ? "remote" : "local"
        });
      }
    }
    if (changes.length) plan.updated.push({ key, label: labelOfRec(l, aliases, key), changes });
    else plan.unchanged++;
  }
  for (const [key, d] of Object.entries(remote.deleted)) {
    const l = local[key];
    if (l && d.at > lastModified(l)) plan.removed.push({ key, label: labelOfRec(l, aliases, key), at: d.at, byName: byName(st, remote, d.by) });
  }
  for (const [id, rn] of Object.entries(remote.networks)) {
    const ln = (st.networks || {})[id];
    if (!ln) { plan.networks.push({ id, name: rn.name ? rn.name.v : null, isNew: true }); continue; }
    const rel = relation(ln.name, rn.name);
    if (rel === "take") plan.networks.push({ id, name: rn.name.v, from: ln.name ? ln.name.v : null });
    else if (rel === "conflict") {
      plan.conflicts.push({
        id: "net:" + id + "|name", key: id, field: "networkName", label: ln.name.v || id,
        local: { v: ln.name.v, at: ln.name.at, by: ln.name.by, byName: byName(st, remote, ln.name.by) },
        remote: { v: rn.name.v, at: rn.name.at, by: rn.name.by, byName: byName(st, remote, rn.name.by) },
        suggested: String(rn.name.at) > String(ln.name.at) ? "remote" : "local"
      });
    }
  }
  return plan;
}

function byName(st, remote, id) {
  if (!id) return null;
  if (st.self && st.self.id === id) return st.self.name;
  if (remote.from && remote.from.id === id) return remote.from.name;
  for (const r of Object.values((st.baseline && st.baseline.hosts) || {})) {
    if (r.seenBy && r.seenBy[id]) return r.seenBy[id].name;
  }
  for (const r of Object.values(remote.devices)) if (r.seenBy && r.seenBy[id]) return r.seenBy[id].name;
  return id;
}

/* ---------- Application de la fusion / applying the merge ---------- */

function mergeRecord(l, r) {
  if (r.firstSeen && (!l.firstSeen || r.firstSeen < l.firstSeen)) l.firstSeen = r.firstSeen;
  if (r.lastSeen && (!l.lastSeen || r.lastSeen > l.lastSeen)) {
    l.lastSeen = r.lastSeen;
    l.ip = r.ip || l.ip;
  }
  l.vendor = l.vendor || r.vendor || null;
  l.hostname = l.hostname || r.hostname || null;
  l.ips = Array.isArray(l.ips) ? l.ips : [];
  for (const e of r.ips || []) {
    const m = l.ips.find((x) => x.ip === e.ip && x.net === e.net);
    if (!m) l.ips.push(Object.assign({}, e));
    else {
      if (e.first && (!m.first || e.first < m.first)) m.first = e.first;
      if (e.last && (!m.last || e.last > m.last)) m.last = e.last;
    }
  }
  if (l.ips.length > nb.MAX_IPS) {
    l.ips.sort((a, b) => String(a.last).localeCompare(String(b.last)));
    l.ips.splice(0, l.ips.length - nb.MAX_IPS);
  }
  l.networks = [...new Set([...(l.networks || []), ...(r.networks || [])])].slice(0, nb.MAX_NETWORKS);
  l.seenBy = l.seenBy || {};
  for (const [id, sb] of Object.entries(r.seenBy || {})) {
    if (!l.seenBy[id] || sb.at > l.seenBy[id].at) l.seenBy[id] = Object.assign({}, sb);
  }
}

/* Applique la fusion. `choices` : {conflictId: "local"|"remote"} (sinon la
   suggestion). Renvoie {state, aliases, report}. Les noms retenus sont
   aussi ecrits dans netHosts.json (via les alias renvoyes).
   Applies the merge. Returns {state, aliases, report}. */
function applyMerge(state, aliases, file, choices, now) {
  const t = now || nowIso();
  const remote = readFile(file);
  const plan = planMerge(state, aliases, file);
  const pick = (c) => ((choices && (choices[c.id] === "local" || choices[c.id] === "remote")) ? choices[c.id] : c.suggested);
  const conflictBy = new Map(plan.conflicts.map((c) => [c.id, c]));
  const next = nb.clone(state);
  const self = nb.ensureSelf(next);
  if (!next.baseline) next.baseline = { at: t, hosts: {} };
  const hosts = next.baseline.hosts;
  const report = { added: 0, removed: 0, updated: 0, conflicts: plan.conflicts.length, networks: 0, from: remote.from };

  for (const [key, r] of Object.entries(remote.devices)) {
    const l = hosts[key];
    if (!l) {
      const tomb = next.deleted[key];
      if (tomb && tomb.at >= lastModified(r)) continue;
      if (Object.keys(hosts).length >= nb.MAX_BASELINE) continue;
      hosts[key] = JSON.parse(JSON.stringify(r));
      delete next.deleted[key];
      report.added++;
      continue;
    }
    let touched = false;
    l.fields = l.fields || {};
    for (const f of nb.FIELD_NAMES) {
      const lf = l.fields[f], rf = r.fields ? r.fields[f] : null;
      const rel = relation(lf, rf);
      if (rel === "take") { l.fields[f] = JSON.parse(JSON.stringify(rf)); touched = true; }
      else if (rel === "same" && lf && rf) l.fields[f] = unite(lf, rf);
      else if (rel === "conflict") {
        const c = conflictBy.get(key + "|" + f);
        const chosen = c && pick(c) === "remote" ? rf : lf;
        // La valeur retenue « connait » les deux : la fusion inverse sur
        // l'autre PiBoard sera une simple mise a jour.
        // The kept value "knows" both: the reverse merge on the other
        // PiBoard will be a plain update.
        l.fields[f] = newField(chosen.v, t, self.id, null, [lf.at, rf.at]);
        touched = true;
      }
    }
    mergeRecord(l, r);
    if (touched) report.updated++;
  }
  for (const [key, d] of Object.entries(remote.deleted)) {
    const l = hosts[key];
    if (l && d.at > lastModified(l)) { delete hosts[key]; report.removed++; }
    if (!next.deleted[key] || d.at > next.deleted[key].at) {
      if (!hosts[key]) next.deleted[key] = Object.assign({}, d);
    }
  }
  // Pierres tombales bornees / bounded tombstones
  const tombs = Object.keys(next.deleted);
  if (tombs.length > nb.MAX_DELETED) {
    tombs.sort((a, b) => String(next.deleted[a].at).localeCompare(String(next.deleted[b].at)))
      .slice(0, tombs.length - nb.MAX_DELETED).forEach((k) => delete next.deleted[k]);
  }
  for (const [id, rn] of Object.entries(remote.networks)) {
    const ln = next.networks[id];
    if (!ln) {
      if (Object.keys(next.networks).length >= nb.MAX_NETWORKS) continue;
      next.networks[id] = JSON.parse(JSON.stringify(rn));
      report.networks++;
      continue;
    }
    const rel = relation(ln.name, rn.name);
    if (rel === "take") { ln.name = JSON.parse(JSON.stringify(rn.name)); report.networks++; }
    else if (rel === "same" && ln.name && rn.name) ln.name = unite(ln.name, rn.name);
    else if (rel === "conflict") {
      const c = conflictBy.get("net:" + id + "|name");
      const chosen = c && pick(c) === "remote" ? rn.name : ln.name;
      ln.name = newField(chosen.v, t, self.id, null, [ln.name.at, rn.name.at]);
      report.networks++;
    }
    if (rn.firstSeen && (!ln.firstSeen || rn.firstSeen < ln.firstSeen)) ln.firstSeen = rn.firstSeen;
    ln.gatewayMac = ln.gatewayMac || rn.gatewayMac || null;
    ln.gatewayIp = ln.gatewayIp || rn.gatewayIp || null;
    ln.cidr = ln.cidr || rn.cidr || null;
  }

  // Noms -> netHosts.json : la table des noms suit le referentiel.
  // Names -> netHosts.json: the names table follows the registry.
  let outAliases = Object.assign({}, aliases || {});
  for (const [key, r] of Object.entries(hosts)) {
    const f = r.fields && r.fields.name;
    if (!f) continue;
    const cur = outAliases[key];
    if (f.v) {
      if (!cur || cur.name !== f.v) outAliases[key] = { name: f.v, updatedAt: f.at };
    } else if (cur) delete outAliases[key];
  }
  for (const key of Object.keys(remote.deleted)) if (!hosts[key]) delete outAliases[key];
  outAliases = netHosts.trimAliases(outAliases);

  next.baseline.at = next.baseline.at || t;
  next.log.push({ t, type: "merge", key: null, label: String(remote.from.name || "").slice(0, 80), ip: null, count: report.added + report.updated + report.removed });
  if (next.log.length > nb.MAX_LOG) next.log.splice(0, next.log.length - nb.MAX_LOG);
  return { state: next, aliases: outAliases, report };
}

/* ---------- CSV enrichi / enriched CSV ---------- */

/* Colonnes supplementaires de l'export CSV, par cle. Extra CSV columns, per key. */
function csvExtras(state) {
  const out = {};
  const hosts = state && state.baseline ? state.baseline.hosts : {};
  for (const [key, r] of Object.entries(hosts)) {
    const f = r.fields || {};
    out[key] = {
      deviceType: f.type ? f.type.v : "",
      owner: f.owner ? f.owner.v : "",
      notes: f.notes ? f.notes.v : "",
      trusted: f.trusted && f.trusted.v === true ? "oui" : "",
      vendor: r.vendor || "",
      lastIp: r.ip || "",
      networks: (r.networks || []).map((id) => netNameOf(state, id) || id).join(" / "),
      seenBy: Object.values(r.seenBy || {}).map((s) => s.name).join(" / "),
      firstSeen: r.firstSeen || "",
      lastSeen: r.lastSeen || ""
    };
  }
  return out;
}

function netNameOf(state, id) {
  const n = state && state.networks ? state.networks[id] : null;
  return n && n.name && n.name.v ? n.name.v : null;
}

/* Champs relus d'un CSV importe -> fiches. CSV fields read back -> records. */
function applyCsvExtras(state, extras, now) {
  let next = state;
  let count = 0;
  for (const [key, e] of Object.entries(extras || {})) {
    if (!next.baseline || !next.baseline.hosts[key]) continue;
    const values = {};
    if (e.deviceType !== undefined) values.type = normalizeType(e.deviceType);
    if (e.owner !== undefined) values.owner = e.owner;
    if (e.notes !== undefined) values.notes = e.notes;
    if (e.trusted !== undefined) values.trusted = /^(oui|yes|y|o|1|true|vrai|x)$/i.test(String(e.trusted).trim());
    const before = JSON.stringify(next.baseline.hosts[key].fields || {});
    next = setFields(next, key, values, now);
    if (JSON.stringify(next.baseline.hosts[key].fields || {}) !== before) count++;
  }
  return { state: next, count };
}

const TYPE_WORDS = {
  router: ["router", "routeur", "box", "passerelle", "gateway"], computer: ["computer", "ordinateur", "pc", "desktop", "fixe"],
  laptop: ["laptop", "portable", "notebook"], phone: ["phone", "telephone", "téléphone", "smartphone", "mobile"],
  tablet: ["tablet", "tablette", "ipad"], tv: ["tv", "television", "télévision", "tele", "télé"], printer: ["printer", "imprimante"],
  nas: ["nas", "stockage", "storage"], camera: ["camera", "caméra", "webcam"], speaker: ["speaker", "enceinte", "haut-parleur"],
  console: ["console", "jeu", "game"], iot: ["iot", "objet", "objet connecte", "objet connecté", "domotique", "smart"],
  network: ["network", "reseau", "réseau", "switch", "wifi", "borne", "repeteur", "répéteur", "access point"],
  server: ["server", "serveur", "raspberry", "pi"], other: ["other", "autre"]
};
function normalizeType(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (nb.DEVICE_TYPES.includes(s)) return s;
  for (const [type, words] of Object.entries(TYPE_WORDS)) if (words.includes(s)) return type;
  return "other";
}

module.exports = {
  FORMAT, FORMAT_VERSION,
  relation, newField, unite,
  syncNames, setFields, setNetworkName, setSelfName,
  exportRegistry, readFile, planMerge, applyMerge,
  csvExtras, applyCsvExtras, normalizeType, lastModified
};
