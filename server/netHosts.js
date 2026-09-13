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

/* ============================================================
   Export / import CSV
   ============================================================
   Pourquoi : les noms donnes aux appareils representent un vrai travail
   de saisie -- une trentaine d'appareils, dont beaucoup ne se
   presentent que par une MAC. Ce travail etait jusqu'ici captif d'une
   installation : reconstruire un PiBoard, ou en installer un second
   dans la meme maison, obligeait a tout ressaisir. L'export/import
   rend cette table portable.

   Pourquoi le CSV plutot que le JSON deja stocke : parce que le besoin
   n'est pas seulement de transporter le fichier (une sauvegarde le fait
   deja) mais de pouvoir le RELIRE et le MODIFIER dans un tableur. Une
   table de correspondance MAC -> nom est exactement ce qu'un tableur
   sait editer confortablement.

   Colonnes : type, identifiant, nom, modifie_le. `type` vaut "mac" ou
   "ip" et `identifiant` porte la valeur correspondante : c'est la
   decomposition lisible de la cle interne ("mac:aa:bb:..."), qui
   evite a l'utilisateur de comprendre ce prefixe, et evite surtout
   qu'un tableur ne prenne "mac:aa:bb:cc" pour autre chose qu'un texte.

   Why: the names given to devices represent real typing work -- a few
   dozen devices, many of which only introduce themselves by a MAC.
   That work used to be captive to one installation: rebuilding a
   PiBoard, or setting up a second one in the same house, meant typing
   everything again. Export/import makes this table portable.

   Why CSV rather than the JSON already stored: because the need is not
   only to carry the file over (a backup does that already) but to be
   able to READ and EDIT it in a spreadsheet. A MAC -> name mapping is
   exactly what a spreadsheet edits comfortably.

   Columns: type, identifier, name, updated_at. `type` is "mac" or "ip"
   and `identifier` carries the matching value: it is the readable
   decomposition of the internal key ("mac:aa:bb:..."), which spares
   the user from understanding that prefix, and above all keeps a
   spreadsheet from reading "mac:aa:bb:cc" as anything but text. */

/* En-tetes acceptes a l'import, par colonne. Les deux langues sont
   reconnues, ainsi que les variantes qu'un tableur peut produire
   (majuscules, espaces, accents). Un fichier exporte en francais se
   reimporte donc dans une installation en anglais, et un fichier
   retravaille a la main reste accepte tant que les intitules sont
   reconnaissables.
   Header names accepted on import, per column. Both languages are
   recognized, as well as the variants a spreadsheet may produce
   (case, spaces, accents). A file exported in French therefore
   re-imports into an English installation, and a hand-reworked file
   stays acceptable as long as the headings are recognizable. */
const CSV_HEADERS = {
  type: ["type"],
  id: ["identifiant", "identifier", "id", "adresse", "address", "mac", "ip"],
  name: ["nom", "name", "nom_convivial", "friendly_name", "alias"],
  updatedAt: ["modifie_le", "modified_at", "updated_at", "date"]
};

/* Une cellule CSV. Les guillemets sont doubles a l'interieur, et tout
   champ contenant separateur, guillemet ou saut de ligne est entoure de
   guillemets : c'est la RFC 4180. Un nom d'appareil peut tres bien
   contenir un point-virgule ("Imprimante bureau ; etage").
   One CSV cell. Inner quotes are doubled, and any field containing a
   separator, a quote or a line break is wrapped in quotes: that is RFC
   4180. A device name may well contain a semicolon ("Office printer ;
   upstairs"). */
function csvCell(value, sep) {
  const s = String(value == null ? "" : value);
  return (s.includes(sep) || s.includes('"') || /[\r\n]/.test(s))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

/* Meme choix de dialecte que l'export de l'etat de la connexion (voir
   server/internetHealth.js) : point-virgule pour un tableur configure
   en francais, virgule pour le reste du monde. Ici aucun nombre
   decimal n'est en jeu, seul le separateur change.
   Same dialect choice as the connection-health export (see
   server/internetHealth.js): semicolon for a French-configured
   spreadsheet, comma for the rest of the world. No decimal number is
   involved here, only the separator changes. */
function toCsv(aliases, opts) {
  const sep = (opts && opts.dialect === "international") ? "," : ";";
  const table = sanitizeAliases(aliases);
  const lines = [["type", "identifiant", "nom", "modifie_le"].join(sep)];
  // Tri par identifiant : un ordre stable d'un export a l'autre rend
  // deux fichiers comparables, et le tableau plus agreable a relire.
  // Sorted by identifier: a stable order from one export to the next
  // makes two files comparable, and the table nicer to read.
  for (const key of Object.keys(table).sort()) {
    const sepIdx = key.indexOf(":");
    const type = key.slice(0, sepIdx);
    const id = key.slice(sepIdx + 1);
    const entry = table[key];
    lines.push([type, id, entry.name, entry.updatedAt || ""].map((v) => csvCell(v, sep)).join(sep));
  }
  return lines.join("\r\n") + "\r\n";
}

/* Decoupe une ligne CSV en respectant les guillemets. Ecrit a la main
   plutot qu'avec une expression reguliere : un champ entre guillemets
   peut contenir le separateur, et une expression reguliere lisible ne
   sait pas gerer ce cas.
   Splits a CSV line honouring quotes. Hand-written rather than done
   with a regular expression: a quoted field may contain the separator,
   and a readable regular expression cannot handle that case. */
function splitCsvLine(line, sep) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/* Ramene un intitule de colonne a une forme comparable : sans accents,
   sans espaces ni ponctuation, en minuscules. "Modifié le" et
   "modifie_le" deviennent ainsi la meme chose.
   Reduces a column heading to a comparable form: no accents, no spaces
   or punctuation, lower case. "Modifié le" and "modifie_le" thus
   become the same thing. */
function normalizeHeader(h) {
  return String(h || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Devine le separateur d'un fichier a importer plutot que de l'imposer :
   le fichier peut venir d'un PiBoard regle sur l'autre dialecte, ou
   d'un tableur qui a reenregistre a sa facon. On compte les deux
   candidats sur la ligne d'en-tete, le plus frequent gagne.
   Guesses the separator of an imported file rather than imposing one:
   the file may come from a PiBoard set to the other dialect, or from a
   spreadsheet that saved it its own way. Both candidates are counted on
   the header line, the most frequent wins. */
function guessSeparator(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semis >= commas ? ";" : ",";
}

/* Analyse un CSV et renvoie les entrees exploitables, plus le detail de
   ce qui a ete ecarte. On ne rejette JAMAIS le fichier entier pour
   quelques lignes douteuses : un fichier retravaille dans un tableur
   contient souvent une ligne de total, une ligne vide ou un
   commentaire. Les lignes valides sont importees, les autres comptees
   et rapportees a l'utilisateur.
   Parses a CSV and returns the usable entries, plus the detail of what
   was discarded. The whole file is NEVER rejected over a few dubious
   lines: a file reworked in a spreadsheet often holds a total row, an
   empty row or a comment. Valid rows are imported, the others counted
   and reported to the user. */
function parseCsv(text) {
  const clean = String(text == null ? "" : text).replace(/^\uFEFF/, "");
  const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (!lines.length) return { aliases: {}, rows: 0, skipped: 0, reasons: {} };

  const sep = guessSeparator(lines[0]);
  const header = splitCsvLine(lines[0], sep).map(normalizeHeader);
  const col = {};
  for (const [field, names] of Object.entries(CSV_HEADERS)) {
    col[field] = header.findIndex((h) => names.some((n) => normalizeHeader(n) === h));
  }
  if (col.id < 0 || col.name < 0) {
    throw new Error("missing columns: the file needs at least an identifier column and a name column");
  }

  const aliases = {};
  const reasons = { badId: 0, noName: 0, duplicate: 0 };
  let rows = 0;
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep);
    const rawId = String(cells[col.id] || "").trim();
    const declaredType = col.type >= 0 ? String(cells[col.type] || "").trim().toLowerCase() : "";
    const name = normalizeName(cells[col.name]);

    // Le type declare est une indication, pas une autorite : c'est la
    // FORME de l'identifiant qui tranche. Une colonne type absente, mal
    // orthographiee ou intervertie par un tri de tableur ne doit pas
    // faire perdre une ligne parfaitement lisible.
    // The declared type is a hint, not an authority: the identifier's
    // SHAPE decides. A type column that is missing, misspelled or
    // shuffled by a spreadsheet sort must not lose a perfectly readable
    // row.
    const mac = normalizeMac(rawId);
    let key = null;
    if (mac && declaredType !== "ip") key = "mac:" + mac;
    else if (isValidIp(rawId)) key = "ip:" + rawId;

    if (!key) { skipped++; reasons.badId++; continue; }
    if (!name) { skipped++; reasons.noName++; continue; }
    if (aliases[key]) { skipped++; reasons.duplicate++; }
    const updatedAt = col.updatedAt >= 0 ? String(cells[col.updatedAt] || "").trim() : "";
    aliases[key] = { name, updatedAt: updatedAt || new Date().toISOString() };
    rows++;
  }
  return { aliases: sanitizeAliases(aliases), rows, skipped, reasons };
}

/* Fusionne une table importee dans celle deja en place.
     - "merge" (defaut) : les noms importes l'emportent sur les noms
       existants pour les memes appareils, et les appareils absents du
       fichier gardent leur nom. C'est le comportement attendu quand on
       reinjecte une table apres une reconstruction.
     - "replace" : la table en place est remplacee. Utile quand on veut
       vraiment repartir du fichier, et seulement dans ce cas -- d'ou le
       choix explicite.
   Un import ne supprime jamais silencieusement : sans "replace", aucune
   entree existante ne disparait.
   Merges an imported table into the one already in place.
     - "merge" (default): imported names win over existing ones for the
       same devices, and devices absent from the file keep their name.
       That is the expected behaviour when re-injecting a table after a
       rebuild.
     - "replace": the table in place is replaced. Useful when one really
       wants to start from the file, and only then -- hence the explicit
       choice.
   An import never deletes silently: without "replace", no existing
   entry disappears. */
function importCsv(text, opts) {
  const parsed = parseCsv(text);
  const replace = !!(opts && opts.mode === "replace");
  const before = replace ? {} : loadAliases();
  const merged = trimAliases(Object.assign({}, before, parsed.aliases));
  const saved = saveAliases(merged);
  const existing = replace ? {} : before;
  let added = 0;
  let updated = 0;
  for (const [key, entry] of Object.entries(parsed.aliases)) {
    if (!existing[key]) added++;
    else if (existing[key].name !== entry.name) updated++;
  }
  return {
    imported: parsed.rows,
    added,
    updated,
    unchanged: parsed.rows - added - updated,
    skipped: parsed.skipped,
    reasons: parsed.reasons,
    total: Object.keys(saved).length,
    mode: replace ? "replace" : "merge",
    aliases: saved
  };
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
  clearAll,
  toCsv,
  parseCsv,
  importCsv
};
