/* ============================================================
   PiBoard - server/fsBrowse.js
   Parcours des DOSSIERS de la machine qui fait tourner PiBoard, pour
   choisir un emplacement (aujourd'hui : le dossier d'enregistrement de
   la tuile Chaines TV).

   PORTEE VOLONTAIREMENT ETROITE. Ce module ne sait que deux choses :
   lister les sous-dossiers d'un dossier, et creer un dossier. Il ne
   lit aucun fichier, n'en renvoie jamais le contenu, et ne supprime
   rien. Un chemin est un chemin absolu de la machine : c'est le propre
   d'un reglage qui designe un disque USB ou un partage reseau.

   Browsing the FOLDERS of the machine running PiBoard, to pick a
   location. Deliberately narrow: it only lists a folder's subfolders
   and creates a folder. It never reads a file, never returns file
   contents, and deletes nothing.
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
function listDir(dir) {
  const full = path.resolve(String(dir || ""));
  const entries = fs.readdirSync(full, { withFileTypes: true });
  const dirs = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) {
      try { isDir = fs.statSync(path.join(full, e.name)).isDirectory(); } catch (err) { isDir = false; }
    }
    if (isDir) dirs.push({ name: e.name, path: path.join(full, e.name) });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  let writable = true;
  try { fs.accessSync(full, fs.constants.W_OK); } catch (e) { writable = false; }
  return { path: full, parent: parentOf(full), writable, dirs, breadcrumb: breadcrumb(full) };
}

function mkdir(parent, name) {
  if (!isValidFolderName(name)) { const e = new Error("nom invalide / invalid name"); e.code = "bad-name"; throw e; }
  const full = path.join(path.resolve(String(parent || "")), String(name).trim());
  fs.mkdirSync(full, { recursive: true });
  fs.accessSync(full, fs.constants.W_OK);
  return full;
}

module.exports = { isValidFolderName, parentOf, breadcrumb, listRoots, listDir, mkdir };
