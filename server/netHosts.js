/* ============================================================
   PiBoard - server/netHosts.js
   Noms personnalises des hotes du reseau local (widget "Analyse
   reseau"). L'analyse (server/networkScan.js) remonte toujours une
   adresse IP et, la plupart du temps, une adresse MAC ; en revanche le
   nom d'hote est souvent absent (telephones Android, objets connectes)
   ou peu parlant ("DESKTOP-4K7J1QA", "espressif-2f8a"). Ce module
   permet a l'utilisateur d'attribuer a chaque appareil un nom de son
   choix, conserve durablement.
   Cle de stockage : l'adresse MAC quand elle est connue -- c'est le
   seul identifiant reellement stable d'un appareil, l'IP pouvant
   changer a chaque bail DHCP. A defaut de MAC (hote repere par le
   seul ping, sans entree ARP), on retombe sur l'IP.
   Persistance : data/netHosts.json via server/store.js, donc en dehors
   de l'arborescence livree dans les ZIP de mise a jour -- les noms
   survivent a une reinstallation, et sont inclus dans les sauvegardes
   /restaurations (server/backups.js recopie tout data/*.json).

   Custom names for local network hosts (the "Network scan" widget).
   The scan (server/networkScan.js) always reports an IP address and,
   most of the time, a MAC address; the hostname however is often
   missing (Android phones, IoT gadgets) or unhelpful
   ("DESKTOP-4K7J1QA", "espressif-2f8a"). This module lets the user
   give each device a name of their own, kept for good.
   Storage key: the MAC address when known -- the only truly stable
   identifier of a device, since the IP can change with every DHCP
   lease. Without a MAC (host caught by ping only, with no ARP entry),
   we fall back to the IP.
   Persistence: data/netHosts.json through server/store.js, hence
   outside the tree shipped in update ZIPs -- names survive a
   reinstallation, and are included in backups/restores
   (server/backups.js copies every data/*.json).
   ============================================================ */
"use strict";

const store = require("./store");
const { isValidIp } = require("./ipv4");

const STORE_KEY = "netHosts";
const MAX_NAME_LENGTH = 40;
/* Garde-fou contre une croissance illimitee du fichier : un reseau
   domestique compte quelques dizaines d'appareils, mais des baux DHCP
   changeants sur des hotes sans MAC connue pourraient accumuler des
   cles IP au fil des annees. Les entrees les plus anciennes (par date
   de modification) sont ecartees au-dela.
   Safety net against unbounded file growth: a home network has a few
   dozen devices, but changing DHCP leases on hosts with no known MAC
   could pile up IP keys over the years. The oldest entries (by
   modification date) are dropped beyond this. */
const MAX_ENTRIES = 500;

/* ---------- Normalisation / normalization ---------- */

/* Ramene une adresse MAC a la forme canonique "aa:bb:cc:dd:ee:ff".
   Les tables ARP des trois plateformes ne s'accordent ni sur la casse
   (Windows majuscules, Linux minuscules) ni sur le separateur
   (Windows "-", Linux/macOS ":"), et macOS omet le zero de tete des
   octets ("a:1b:..."). Sans cette normalisation, le meme appareil
   pourrait recevoir deux cles differentes selon la plateforme ou la
   version du systeme.
   Reduces a MAC address to the canonical "aa:bb:cc:dd:ee:ff" form.
   The three platforms' ARP tables agree neither on case (Windows
   uppercase, Linux lowercase) nor on separator (Windows "-",
   Linux/macOS ":"), and macOS drops the leading zero of octets
   ("a:1b:..."). Without this normalization the same device could get
   two different keys depending on the platform or OS version. */
function normalizeMac(mac) {
  if (typeof mac !== "string") return null;
  const parts = mac.trim().split(/[:-]/);
  if (parts.length !== 6) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(part)) return null;
    octets.push(part.toLowerCase().padStart(2, "0"));
  }
  const joined = octets.join(":");
  // Une MAC toute a zero est un remplissage d'entree ARP incomplete,
  // pas un appareil. An all-zero MAC is filler for an incomplete ARP
  // entry, not a device.
  if (joined === "00:00:00:00:00:00") return null;
  return joined;
}

/* Cle de stockage d'un hote : MAC si disponible, sinon IP. Le prefixe
   ("mac:" / "ip:") evite toute ambiguite entre les deux espaces de
   noms. Renvoie null si aucun des deux n'est exploitable.
   Storage key for a host: MAC if available, IP otherwise. The prefix
   ("mac:" / "ip:") avoids any ambiguity between the two namespaces.
   Returns null if neither is usable. */
function hostKey(host) {
  if (!host || typeof host !== "object") return null;
  const mac = normalizeMac(host.mac);
  if (mac) return "mac:" + mac;
  if (isValidIp(host.ip)) return "ip:" + host.ip;
  return null;
}

/* Un nom vide (ou uniquement des espaces) signifie "revenir au nom
   detecte automatiquement" : c'est ainsi que l'effacement du champ
   dans la tuile supprime l'entree. An empty name (or whitespace only)
   means "go back to the auto-detected name": that's how clearing the
   field on the tile removes the entry. */
function normalizeName(name) {
  return String(name == null ? "" : name).replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

/* ---------- Operations pures sur la table / pure table operations ----------
   Separees des acces disque pour etre testables sans toucher a data/
   (voir test/netHosts.test.js). Separated from disk access so they can
   be tested without touching data/ (see test/netHosts.test.js). */

/* Ecarte tout ce qui n'a pas la forme attendue : le fichier peut avoir
   ete edite a la main ou provenir d'une sauvegarde plus ancienne.
   Discards anything that isn't shaped as expected: the file may have
   been hand-edited or come from an older backup. */
function sanitizeAliases(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== "string" || !/^(mac:[0-9a-f:]{17}|ip:[0-9.]{7,15})$/.test(key)) continue;
    const name = normalizeName(value && typeof value === "object" ? value.name : value);
    if (!name) continue;
    const updatedAt = value && typeof value === "object" && typeof value.updatedAt === "string"
      ? value.updatedAt
      : null;
    out[key] = { name, updatedAt };
  }
  return out;
}

/* Ajoute/remplace un nom, ou le supprime si le nom est vide. Renvoie
   une NOUVELLE table (jamais de mutation en place).
   Adds/replaces a name, or removes it when the name is empty. Returns
   a NEW table (never mutates in place). */
function setAlias(aliases, key, name, now) {
  const next = Object.assign({}, aliases || {});
  const clean = normalizeName(name);
  if (!clean) {
    delete next[key];
    return next;
  }
  next[key] = { name: clean, updatedAt: now || new Date().toISOString() };
  return trimAliases(next);
}

function removeAlias(aliases, key) {
  const next = Object.assign({}, aliases || {});
  delete next[key];
  return next;
}

/* Conserve les MAX_ENTRIES entrees les plus recemment modifiees. Les
   entrees sans date (fichier ancien) sont considerees comme les plus
   anciennes. Keeps the MAX_ENTRIES most recently modified entries.
   Entries without a date (older file) count as the oldest. */
function trimAliases(aliases) {
  const entries = Object.entries(aliases || {});
  if (entries.length <= MAX_ENTRIES) return aliases;
  entries.sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")));
  const out = {};
  for (const [key, value] of entries.slice(0, MAX_ENTRIES)) out[key] = value;
  return out;
}

/* Enrichit la liste d'hotes d'un scan avec le nom personnalise
   correspondant. Le nom detecte reste disponible dans `hostname` : la
   tuile peut ainsi le rappeler en second plan, et l'effacement du nom
   personnalise redonne immediatement le nom d'origine sans nouveau
   scan.
   Enriches a scan's host list with the matching custom name. The
   detected name stays available in `hostname`: the tile can show it
   as secondary info, and clearing the custom name immediately brings
   the original one back without a new scan. */
function applyAliases(hosts, aliases) {
  const table = aliases || {};
  return (Array.isArray(hosts) ? hosts : []).map((h) => {
    const key = hostKey(h);
    const entry = key ? table[key] : null;
    return Object.assign({}, h, { key, alias: entry ? entry.name : null });
  });
}

/* ---------- Persistance / persistence ---------- */

function loadAliases() {
  return sanitizeAliases(store.read(STORE_KEY, {}).aliases);
}

function saveAliases(aliases) {
  store.write(STORE_KEY, { aliases: sanitizeAliases(aliases) });
  return loadAliases();
}

/* Point d'entree utilise par la route POST /api/network-hosts.
   Entry point used by the POST /api/network-hosts route. */
function renameHost(host, name) {
  const key = hostKey(host);
  if (!key) throw new Error("unknown host (no valid MAC or IP)");
  return { key, aliases: saveAliases(setAlias(loadAliases(), key, name)) };
}

function clearAll() {
  return saveAliases({});
}

module.exports = {
  STORE_KEY,
  MAX_NAME_LENGTH,
  MAX_ENTRIES,
  normalizeMac,
  normalizeName,
  hostKey,
  sanitizeAliases,
  setAlias,
  removeAlias,
  trimAliases,
  applyAliases,
  loadAliases,
  saveAliases,
  renameHost,
  clearAll
};
