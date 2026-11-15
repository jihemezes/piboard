/* ============================================================
   PiBoard - server/fsBrowse.js
   Parcours des DOSSIERS de la machine qui fait tourner PiBoard, pour
   choisir un emplacement (aujourd'hui : le dossier d'enregistrement de
   la tuile Chaines TV).

   PORTEE VOLONTAIREMENT ETROITE. Ce module sait lister les
   sous-dossiers d'un dossier, creer un dossier et (1.167.0) nommer les
   IMAGES qu'un dossier contient, pour en montrer des apercus pendant
   la navigation. Il ne renvoie jamais le contenu d'un fichier (les
   apercus passent par une route a part, limitee aux images) et ne
   supprime rien. Un chemin est un chemin absolu de la machine : c'est le propre
   d'un reglage qui designe un disque USB ou un partage reseau.

   Browsing the FOLDERS of the machine running PiBoard, to pick a
   location. Deliberately narrow: it lists a folder's subfolders,
   creates a folder and (1.167.0) names the IMAGES a folder holds so
   previews can be shown while browsing. It never returns file
   contents itself (previews go through a separate, images-only route)
   and deletes nothing.
   ============================================================ */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

/* Nom de dossier acceptable : ni separateur, ni remontee, ni caractere
   interdit sous Windows. C'est la seule chose a verifier, le dossier
   parent etant deja connu.
   Acceptable folder name: no separator, no traversal, no character
   forbidden on Windows. */
function isValidFolderName(name) {
  const n = String(name == null ? "" : name).trim();
  if (!n || n === "." || n === "..") return false;
  if (/[\\/:*?"<>|\u0000-\u001F]/.test(n)) return false;
  if (/[. ]$/.test(n)) return false;             // Windows refuse ces fins
  return n.length <= 100;
}

/* Le parent d'un chemin, ou null a la racine (« C:\\ », « / »).
   A path's parent, or null at the root. */
function parentOf(dir) {
  const p = path.resolve(String(dir || ""));
  const up = path.dirname(p);
  return up === p ? null : up;
}

/* Fil d'Ariane : chaque segment avec son chemin complet, pour pouvoir
   remonter d'un clic. Breadcrumb: each segment with its full path. */
function breadcrumb(dir) {
  const out = [];
  let cur = path.resolve(String(dir || ""));
  for (let i = 0; i < 64; i++) {
    out.unshift({ name: path.basename(cur) || cur, path: cur });
    const up = parentOf(cur);
    if (!up) break;
    cur = up;
  }
  return out;
}

/* Points de depart : les emplacements ou l'on a une chance d'ecrire.
   Sous Windows, les lettres de lecteur ; ailleurs, la racine et les
   points de montage usuels des disques amovibles.
   Starting points: places one has a chance of writing to. */
function listRoots() {
  const roots = [];
  const add = (name, dir) => {
    if (!dir) return;
    if (roots.some((r) => r.path === dir)) return;
    try { if (fs.statSync(dir).isDirectory()) roots.push({ name, path: dir }); } catch (e) { /* absent */ }
  };
  add("Documents", path.join(os.homedir(), "Documents"));
  add("Videos", path.join(os.homedir(), process.platform === "win32" ? "Videos" : "Vidéos"));
  add("Videos", path.join(os.homedir(), "Videos"));
  add(os.userInfo().username, os.homedir());
  if (process.platform === "win32") {
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") add(letter + ":", letter + ":\\");
  } else {
    add("/", "/");
    for (const base of ["/media", "/mnt", "/Volumes"]) {
      let names = [];
      try { names = fs.readdirSync(base); } catch (e) { names = []; }
      for (const n of names) add(n, path.join(base, n));
      add(base, base);
    }
  }
  return roots;
}

/* Sous-dossiers d'un dossier. Les entrees illisibles sont ignorees
   plutot que de faire echouer la liste entiere : un dossier systeme
   inaccessible ne doit pas empecher de voir les autres.
   Subfolders of a folder. Unreadable entries are skipped rather than
   failing the whole listing. */
/* Images reconnues pour les apercus (1.167.0). Les formats que le
   navigateur affiche tels quels, puis ceux qu'il faut convertir
   (possible sous macOS seulement ; sinon l'interface montre un repere).
   Images recognised for previews. Browser-native formats first, then
   those needing conversion (macOS only; elsewhere a placeholder). */
const PREVIEW_EXT = ["jpg", "jpeg", "png", "gif", "webp"];
const CONVERT_EXT = ["heic", "heif", "tif", "tiff", "bmp"];
const IMAGES_MAX = 120;

function imageExt(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}
function isImageName(name) {
  const e = imageExt(name);
  return PREVIEW_EXT.includes(e) || CONVERT_EXT.includes(e);
}
function isLibraryName(name) { return /\.photoslibrary$/i.test(String(name || "")); }

function listDir(dir, opts) {
  const full = path.resolve(String(dir || ""));
  const entries = fs.readdirSync(full, { withFileTypes: true });
  const dirs = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) {
      try { isDir = fs.statSync(path.join(full, e.name)).isDirectory(); } catch (err) { isDir = false; }
    }
    if (isDir) {
      const d = { name: e.name, path: path.join(full, e.name) };
      if (isLibraryName(e.name)) d.library = true;
      dirs.push(d);
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  let writable = true;
  try { fs.accessSync(full, fs.constants.W_OK); } catch (e) { writable = false; }
  const out = { path: full, parent: parentOf(full), writable, dirs, breadcrumb: breadcrumb(full) };
  if (opts && opts.images) {
    const images = [];
    let total = 0;
    for (const e of entries) {
      if (e.name.startsWith(".") || !isImageName(e.name)) continue;
      if (!(e.isFile() || e.isSymbolicLink())) continue;
      total++;
      if (images.length < IMAGES_MAX) images.push({ name: e.name, path: path.join(full, e.name), native: PREVIEW_EXT.includes(imageExt(e.name)) });
    }
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    out.images = images;
    out.imageCount = total;
  }
  return out;
}

/* Emplacements usuels a proposer en un clic (1.167.0) : Images, Bureau,
   Documents, puis les phototheques deja decouvertes. Un dossier absent
   est simplement omis.
   Usual places offered in one click: Pictures, Desktop, Documents,
   then any libraries already discovered. Absent folders are omitted. */
function listShortcuts(libraries) {
  const out = [];
  const home = os.homedir();
  const add = (name, dir, kind) => {
    if (!dir || out.some((x) => x.path === dir)) return;
    try { if (fs.statSync(dir).isDirectory()) out.push({ name, path: dir, kind }); } catch (e) { /* absent */ }
  };
  add("Pictures", path.join(home, "Pictures"), "pictures");
  add("Pictures", path.join(home, "Images"), "pictures");
  add("Desktop", path.join(home, "Desktop"), "desktop");
  add("Desktop", path.join(home, "Bureau"), "desktop");
  add("Documents", path.join(home, "Documents"), "documents");
  add("Downloads", path.join(home, "Downloads"), "downloads");
  for (const l of libraries || []) {
    if (l && l.path) out.push({ name: l.name || path.basename(l.path), path: l.path, kind: "library" });
  }
  return out;
}

/* Un fichier image dont on peut donner un apercu : chemin absolu, image
   reconnue, fichier ordinaire. Renvoie le chemin resolu ou null.
   An image file safe to preview: absolute path, recognised image,
   regular file. Returns the resolved path or null. */
function previewable(file) {
  const f = String(file || "");
  if (!f || !path.isAbsolute(f) || f.includes("\u0000") || !isImageName(f)) return null;
  const full = path.resolve(f);
  try {
    if (!fs.statSync(full).isFile()) return null;
  } catch (e) { return null; }
  return full;
}

function mkdir(parent, name) {
  if (!isValidFolderName(name)) { const e = new Error("nom invalide / invalid name"); e.code = "bad-name"; throw e; }
  const full = path.join(path.resolve(String(parent || "")), String(name).trim());
  fs.mkdirSync(full, { recursive: true });
  fs.accessSync(full, fs.constants.W_OK);
  return full;
}

module.exports = {
  isValidFolderName, parentOf, breadcrumb, listRoots, listDir, mkdir,
  listShortcuts, previewable, isImageName, isLibraryName, PREVIEW_EXT, CONVERT_EXT, IMAGES_MAX
};
