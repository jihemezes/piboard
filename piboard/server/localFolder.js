/* ============================================================
   PiBoard - server/localFolder.js
   Liste les images d'un dossier local ARBITRAIRE du systeme de fichiers
   (mode "Dossier local" du widget diaporama) : un partage NAS/SMB monte
   au niveau du systeme d'exploitation (fstab, systemd.mount...), ou un
   dossier synchronise/monte par rclone depuis un service cloud.
   PiBoard ne parle lui-meme ni SMB ni aucun protocole cloud : il se
   contente de lire un dossier deja rendu disponible localement par le
   systeme d'exploitation.
   Lists the images in an ARBITRARY local filesystem folder (the
   slideshow widget's "Local folder" mode): a NAS/SMB share mounted at
   the OS level (fstab, systemd.mount...), or a folder synced/mounted by
   rclone from a cloud service. PiBoard itself speaks neither SMB nor any
   cloud protocol: it simply reads a folder the OS has already made
   locally available.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/* Le chemin doit etre absolu : pas de resolution relative au process,
   qui serait source de confusion et de surprises.
   The path must be absolute: no resolution relative to the process,
   which would be confusing and surprising. */
function isValidFolderPath(p) {
  return typeof p === "string" && p.length > 0 && path.isAbsolute(p);
}

function listLocalFolder(folderPath) {
  if (!isValidFolderPath(folderPath)) throw new Error("path must be absolute");
  const stat = fs.statSync(folderPath); // leve si le dossier n'existe pas / throws if missing
  if (!stat.isDirectory()) throw new Error("not a directory");
  const names = fs.readdirSync(folderPath);
  return names
    .filter((n) => IMAGE_EXT.has(path.extname(n).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name }));
}

/* Resout un nom de fichier a l'interieur du dossier configure, en
   empechant toute sortie du dossier (traversee de chemin).
   Resolves a filename inside the configured folder, preventing any
   escape from the folder (path traversal). */
function resolveLocalFile(folderPath, filename) {
  if (!isValidFolderPath(folderPath)) throw new Error("path must be absolute");
  if (typeof filename !== "string" || !filename || filename.includes("/") || filename.includes("\\")) {
    throw new Error("invalid filename");
  }
  const base = path.resolve(folderPath);
  const full = path.resolve(base, filename);
  if (!full.startsWith(base + path.sep)) throw new Error("path escape");
  if (!IMAGE_EXT.has(path.extname(full).toLowerCase())) throw new Error("not an image");
  return full;
}

module.exports = { listLocalFolder, resolveLocalFile, isValidFolderPath, IMAGE_EXT };
