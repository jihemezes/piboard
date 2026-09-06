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

/* Identifiant de dossier media strictement valide. DEUX familles, et
   c'est important : le nom "tileId" vient du diaporama, mais l'API media
   sert aussi de reserve d'images aux fonds de page du mode tableau de
   bord, qui n'appartiennent a AUCUNE tuile.

     - "t-<alphanum>"        : une tuile (diaporama, Logo/Image)
     - "bg-main"             : le fond de la page 1 (le plateau)
     - "bg-pg-<alphanum et tirets>" : le fond d'une page secondaire,
                               construit sur l'identifiant de page genere
                               par le client ("pg-" + base36 + "-" + alea)

   La deuxieme famille manquait : le motif n'acceptait que "t-" suivi de
   caracteres alphanumeriques SANS tiret, donc "bg-main" et
   "bg-pg-mh2k9x-a4f1" etaient refuses des le premier controle. Le
   televersement d'un fond de page repondait alors 400 pour tout fichier,
   quel qu'en soit le format -- et le message de l'interface ("le
   televersement a echoue") laissait croire a un probleme d'image.

   Aucun assouplissement cote securite : ni point, ni slash, ni
   antislash ne passent, donc toujours aucune traversee de chemin
   possible.

   Strictly validated media folder id. TWO families, and this matters:
   the name "tileId" comes from the slideshow, but the media API also
   serves as the image store for dashboard-mode page backgrounds, which
   belong to NO tile.
     - "t-<alnum>"                  : a tile (slideshow, Logo/Image)
     - "bg-main"                    : page 1's background (the board)
     - "bg-pg-<alnum and dashes>"   : a secondary page's background,
                                      built on the client-generated page
                                      id ("pg-" + base36 + "-" + random)
   The second family was missing: the pattern only accepted "t-" followed
   by alphanumeric characters WITHOUT a dash, so "bg-main" and
   "bg-pg-mh2k9x-a4f1" were rejected at the very first check. Uploading a
   page background then answered 400 for every file, whatever its format
   -- and the interface's message ("upload failed") suggested an image
   problem. No security loosening: no dot, no slash, no backslash gets
   through, so path traversal remains impossible. */
function isValidTileId(id) {
  if (typeof id !== "string") return false;
  return /^t-[a-z0-9]{1,40}$/i.test(id)
    || id === "bg-main"
    || /^bg-pg-[a-z0-9-]{1,60}$/i.test(id);
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
