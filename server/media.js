/* ============================================================
   PiBoard - server/media.js
   Photos televersees pour le widget diaporama, stockees localement sous
   data/media/<tileId>/. Chaque tuile a son propre dossier : pas de
   confusion entre plusieurs diaporamas, suppression de la tuile = on
   peut nettoyer son dossier.
   Uploaded photos for the slideshow widget, stored locally under
   data/media/<tileId>/. Each tile has its own folder: no mixing between
   multiple slideshows, deleting the tile means its folder can be cleaned up.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");

const MEDIA_ROOT = path.join(store.DATA_DIR, "media");
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_FILES_PER_TILE = 200;

/* Identifiant de tuile strictement valide (meme format que celui genere
   par le client : "t-" + caracteres alphanumeriques)
   Strictly validated tile id (same format the client generates:
   "t-" + alphanumeric characters) */
function isValidTileId(id) {
  return typeof id === "string" && /^t-[a-z0-9]{1,40}$/i.test(id);
}

function dirFor(tileId) {
  if (!isValidTileId(tileId)) throw new Error("invalid tile id");
  return path.join(MEDIA_ROOT, tileId);
}

function ensureDir(tileId) {
  const dir = dirFor(tileId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/* Nom de fichier sur disque : horodatage + alea + extension d'origine
   (validee), pour eviter toute collision et toute confusion de chemin.
   Filename on disk: timestamp + random + validated original extension,
   to avoid any collision or path confusion. */
function safeFilename(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  const finalExt = ALLOWED_EXT.has(ext) ? ext : ".jpg";
  const rand = Math.random().toString(36).slice(2, 8);
  return Date.now().toString(36) + "-" + rand + finalExt;
}

function listMedia(tileId) {
  const dir = dirFor(tileId);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const items = names
    .filter((n) => ALLOWED_EXT.has(path.extname(n).toLowerCase()))
    .map((n) => {
      const full = path.join(dir, n);
      const stat = fs.statSync(full);
      return { name: n, size: stat.size, mtime: stat.mtimeMs };
    });
  items.sort((a, b) => a.mtime - b.mtime);
  return items;
}

/* Chemin absolu d'un fichier, avec verification stricte qu'il reste
   contenu dans le dossier de la tuile (pas de traversee de chemin).
   Absolute path of a file, strictly verified to stay within the tile's
   folder (no path traversal). */
function resolveFile(tileId, filename) {
  const dir = dirFor(tileId);
  if (typeof filename !== "string" || !filename || filename.includes("/") || filename.includes("\\")) {
    throw new Error("invalid filename");
  }
  const full = path.resolve(dir, filename);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error("path escape");
  return full;
}

function deleteMedia(tileId, filename) {
  const full = resolveFile(tileId, filename);
  fs.unlinkSync(full);
}

function deleteAllMedia(tileId) {
  const dir = dirFor(tileId);
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  MEDIA_ROOT, ALLOWED_EXT, MAX_FILES_PER_TILE,
  isValidTileId, dirFor, ensureDir, safeFilename,
  listMedia, resolveFile, deleteMedia, deleteAllMedia
};
