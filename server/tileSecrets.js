/* ============================================================
   PiBoard - server/tileSecrets.js
   Petit coffre pour les valeurs sensibles d'une tuile (mot de passe
   IMAP, jeton d'API...), volontairement SEPARE de data/layout.json.

   Pourquoi separe : layout.json contient tous les reglages des tuiles et
   se retrouve naturellement dans une sauvegarde, une capture d'ecran de
   fichier, un export de configuration reutilisable, un depot git... Y
   laisser un mot de passe de boite mail personnelle serait le vrai
   risque. Le secret n'y figure jamais : la tuile ne conserve qu'un
   marqueur, et le serveur seul detient la valeur.

   Ce que le chiffrement protege reellement -- et ce qu'il ne protege
   pas : la cle vit a cote du coffre, sur la meme machine. Quelqu'un
   ayant un acces complet au systeme de fichiers du Pi peut donc tout
   dechiffrer ; ce n'est pas de la magie. Il protege en revanche contre
   les fuites bien plus courantes : un fichier de sauvegarde copie
   ailleurs, un coffre lu sans sa cle, un partage involontaire.
   Les deux fichiers sont crees en 0600 (lisibles par le seul
   proprietaire).

   Small vault for a tile's sensitive values (IMAP password, API
   token...), deliberately SEPARATE from data/layout.json.

   Why separate: layout.json holds every tile setting and naturally ends
   up in a backup, a shared config export, a git repository... Leaving a
   personal mailbox password in there would be the real risk. The secret
   never appears in it: the tile only keeps a marker, and the server
   alone holds the value.

   What the encryption actually protects -- and what it doesn't: the key
   lives next to the vault, on the same machine. Anyone with full
   filesystem access to the Pi can therefore decrypt everything; this is
   not magic. It does protect against far more common leaks: a backup
   file copied elsewhere, a vault read without its key, an accidental
   share. Both files are created 0600 (owner-readable only).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./store");

const KEY_FILE = path.join(store.DATA_DIR, ".tile-secrets.key");
const VAULT = "tile-secrets";
const ALGO = "aes-256-gcm";

function loadKey() {
  try {
    const raw = fs.readFileSync(KEY_FILE);
    if (raw.length === 32) return raw;
  } catch (e) { /* absente : creee juste apres / missing: created right after */ }
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, loadKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: enc.toString("base64")
  };
}

function decrypt(rec) {
  if (!rec || !rec.iv || !rec.tag || !rec.data) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, loadKey(), Buffer.from(rec.iv, "base64"));
    decipher.setAuthTag(Buffer.from(rec.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(rec.data, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch (e) {
    // Cle changee ou coffre altere : traite comme "pas de secret" plutot
    // que de faire tomber le serveur. Key changed or vault tampered
    // with: treated as "no secret" rather than crashing the server.
    console.warn("[piboard] secret illisible:", e.message);
    return null;
  }
}

function vaultKey(tileId, key) { return `${tileId}::${key}`; }

function readVault() { return store.read(VAULT, {}); }

function writeVault(v) {
  store.write(VAULT, v);
  // store.write ne fixe pas de permissions : on les restreint ici, ce
  // fichier n'ayant aucune raison d'etre lisible par d'autres comptes.
  // store.write doesn't set permissions: restricted here, as this file
  // has no reason to be readable by other accounts.
  try { fs.chmodSync(path.join(store.DATA_DIR, VAULT + ".json"), 0o600); } catch (e) { /* noop */ }
}

function set(tileId, key, value) {
  const v = readVault();
  if (value === "" || value == null) {
    delete v[vaultKey(tileId, key)];
  } else {
    v[vaultKey(tileId, key)] = encrypt(value);
  }
  writeVault(v);
}

function get(tileId, key) {
  return decrypt(readVault()[vaultKey(tileId, key)]);
}

function has(tileId, key) {
  return Object.prototype.hasOwnProperty.call(readVault(), vaultKey(tileId, key));
}

// Appele quand une tuile est supprimee : evite d'accumuler indefiniment
// des secrets orphelins. Called when a tile is removed: avoids piling up
// orphaned secrets forever.
function clearTile(tileId) {
  const v = readVault();
  const prefix = tileId + "::";
  let changed = false;
  for (const k of Object.keys(v)) {
    if (k.startsWith(prefix)) { delete v[k]; changed = true; }
  }
  if (changed) writeVault(v);
}

module.exports = { set, get, has, clearTile };
