/* ============================================================
   PiBoard - server/backups.js
   Sauvegarde et restauration complètes de la configuration : tuiles
   affichées, leur emplacement, leurs réglages, les configurations
   réutilisables enregistrées, et l'état libre par widget (ex. contenu
   du bloc-notes).

   Approche volontairement generique : plutot que de lister a la main
   chaque fichier de configuration a sauvegarder (fragile, oublie
   facilement une future fonctionnalite), CHAQUE fichier JSON present
   dans data/ est inclus automatiquement -- a une exception pres,
   deliberee et non negociable.

   Le coffre a secrets (voir tileSecrets.js : tile-secrets.json et sa
   cle .tile-secrets.key) est TOUJOURS exclu, y compris de futures
   extensions de ce module. Ce choix a ete confirme explicitement :
   restaurer une sauvegarde laisse la tuile Courriel sans mot de passe
   (a ressaisir), plutot que de faire d'un fichier de sauvegarde un
   objet aussi sensible qu'un fichier de mots de passe. C'est le meme
   principe qui a motive la separation du coffre de data/layout.json des
   la construction de la tuile Courriel.

   Chaque sauvegarde recoit un identifiant horodate a la milliseconde :
   une nouvelle sauvegarde ne peut donc jamais en ecraser une ancienne.

   Complete configuration backup and restore: displayed tiles, their
   position, their settings, saved reusable configurations, and free
   per-widget state (e.g. notepad content).

   Deliberately generic approach: rather than hand-listing every
   configuration file to back up (fragile, easy to forget a future
   feature), EVERY JSON file present in data/ is included automatically
   -- with one deliberate, non-negotiable exception.

   The secrets vault (see tileSecrets.js: tile-secrets.json and its
   .tile-secrets.key) is ALWAYS excluded, including from future
   extensions of this module. This choice was explicitly confirmed:
   restoring a backup leaves the Mailbox tile without its password (to
   be re-entered), rather than turning a backup file into something as
   sensitive as a password file. Same principle that motivated keeping
   the vault separate from data/layout.json when the Mailbox tile was
   built.

   Each backup gets a millisecond-precision timestamped id: a new backup
   can therefore never overwrite an older one.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");

const BACKUPS_DIR = path.join(store.DATA_DIR, "backups");
const FORMAT_VERSION = 1;

// Fichiers JAMAIS inclus dans une sauvegarde, quel que soit le contenu
// futur de data/ -- voir l'en-tete du fichier.
// Files NEVER included in a backup, whatever data/ contains in the
// future -- see the file header.
const EXCLUDED_FILES = new Set(["tile-secrets.json"]);

function ensureDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Identifiant strictement horodate (a la milliseconde, deux-points
// remplaces pour rester un nom de fichier valide) : une nouvelle
// sauvegarde ne peut donc jamais porter le meme identifiant qu'une
// sauvegarde existante, et ne l'ecrase donc jamais.
// Strictly timestamped id (millisecond precision, colons replaced to
// stay a valid filename): a new backup can therefore never share an id
// with an existing one, and so never overwrites it.
function newId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function idIsValid(id) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z$/.test(id);
}

function fileForId(id) {
  if (!idIsValid(id)) throw new Error("invalid backup id");
  return path.join(BACKUPS_DIR, id + ".json");
}

/* Rassemble tous les fichiers de configuration actuels (hors coffre a
   secrets) en un seul objet. Gathers every current configuration file
   (excluding the secrets vault) into a single object. */
function collectCurrentFiles() {
  let names;
  try {
    names = fs.readdirSync(store.DATA_DIR);
  } catch (e) {
    names = [];
  }
  const files = {};
  for (const name of names) {
    if (!name.endsWith(".json") || EXCLUDED_FILES.has(name)) continue;
    const key = name.slice(0, -".json".length);
    try {
      files[key] = JSON.parse(fs.readFileSync(path.join(store.DATA_DIR, name), "utf8"));
    } catch (e) {
      // Fichier illisible/corrompu : ignore plutot que de faire echouer
      // toute la sauvegarde. Unreadable/corrupted file: skipped rather
      // than failing the whole backup.
      console.warn("[piboard] backup: fichier ignore", name, e.message);
    }
  }
  return files;
}

function tileCountOf(files) {
  const layout = files.layout;
  if (!layout) return null;
  const board = Array.isArray(layout.tiles) ? layout.tiles.length : 0;
  const drawer = layout.drawer && Array.isArray(layout.drawer.tiles) ? layout.drawer.tiles.length : 0;
  return board + drawer;
}

function create(appVersion, label) {
  ensureDir();
  const id = newId();
  const files = collectCurrentFiles();
  const record = {
    piboardBackup: FORMAT_VERSION,
    id,
    createdAt: new Date().toISOString(),
    appVersion: appVersion || null,
    label: label ? String(label).slice(0, 200) : null,
    files
  };
  fs.writeFileSync(fileForId(id), JSON.stringify(record, null, 2), "utf8");
  return summaryOf(record);
}

function summaryOf(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    appVersion: record.appVersion,
    label: record.label,
    tileCount: tileCountOf(record.files || {})
  };
}

function list() {
  ensureDir();
  let names;
  try {
    names = fs.readdirSync(BACKUPS_DIR);
  } catch (e) {
    names = [];
  }
  const out = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, name), "utf8"));
      out.push(summaryOf(record));
    } catch (e) { /* fichier illisible ignore / unreadable file skipped */ }
  }
  // Plus recente d'abord / newest first
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

function readRecord(id) {
  const raw = fs.readFileSync(fileForId(id), "utf8");
  return JSON.parse(raw);
}

function remove(id) {
  fs.unlinkSync(fileForId(id));
}

/* Ecrit chaque fichier du paquet comme fichier de configuration ACTUEL,
   en ecrasant l'existant -- le coffre a secrets n'en fait jamais partie
   (voir collectCurrentFiles) donc n'est jamais touche.
   Writes every file in the bundle as the CURRENT configuration file,
   overwriting what exists -- the secrets vault is never part of it (see
   collectCurrentFiles) so it's never touched. */
function applyFiles(files) {
  for (const [key, value] of Object.entries(files || {})) {
    if (EXCLUDED_FILES.has(key + ".json")) continue; // garde-fou supplementaire / extra safety net
    store.write(key, value);
  }
}

function restore(id) {
  const record = readRecord(id);
  applyFiles(record.files);
  return summaryOf(record);
}

/* Valide et importe un fichier de sauvegarde envoye par l'utilisateur :
   devient une nouvelle entree de l'historique (meme comportement qu'une
   sauvegarde creee localement) puis est immediatement restauree.
   Validates and imports a backup file sent by the user: becomes a new
   history entry (same behavior as a locally created backup) then is
   immediately restored. */
function importAndRestore(buffer) {
  let record;
  try {
    record = JSON.parse(buffer.toString("utf8"));
  } catch (e) {
    throw new Error("invalid backup file (not valid JSON)");
  }
  if (!record || typeof record !== "object" || !record.files || typeof record.files !== "object") {
    throw new Error("invalid backup file (unexpected format)");
  }
  ensureDir();
  const id = newId();
  const clean = {
    piboardBackup: FORMAT_VERSION,
    id,
    createdAt: new Date().toISOString(),
    appVersion: record.appVersion || null,
    // Le fichier importe peut venir d'une autre machine : son propre nom
    // devient le libelle par defaut, pour qu'on sache d'ou il vient.
    // The imported file may come from another machine: its own name
    // becomes the default label, so its origin stays visible.
    label: record.label ? String(record.label).slice(0, 200) : "Import",
    files: {}
  };
  for (const [key, value] of Object.entries(record.files)) {
    if (EXCLUDED_FILES.has(key + ".json")) continue; // un fichier importe ne peut pas non plus glisser un secret / an imported file can't slip a secret in either
    clean.files[key] = value;
  }
  fs.writeFileSync(fileForId(id), JSON.stringify(clean, null, 2), "utf8");
  applyFiles(clean.files);
  return summaryOf(clean);
}

module.exports = { create, list, readRecord, remove, restore, importAndRestore, idIsValid };
