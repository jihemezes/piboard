#!/usr/bin/env node
/* ============================================================
   PiBoard - scripts/library-index.js
   Construit public/library/index.json a partir des fichiers deposes
   dans public/library/<section>/, et fabrique les vignettes.

   A LANCER APRES AVOIR AJOUTE DES IMAGES, avant de tagger :
       npm run library:index

   POURQUOI UN INDEX PLUTOT QUE DE TOUT LIRE A LA VOLEE. Le serveur
   sait deja lister les fichiers d'un dossier ; ce qu'il ne peut pas
   deviner, ce sont le nom lisible, la categorie, la dominante claire ou
   sombre, l'auteur et la licence. Ces informations sont saisies UNE
   fois dans un fichier meta.json par section, et ce script les fige
   dans un index que le serveur lit d'un seul coup -- plutot que
   d'ouvrir trente fichiers a chaque affichage de la bibliotheque sur un
   Raspberry Pi.

   L'index ENRICHIT, il ne filtre pas : une image presente sans entree
   apparait quand meme, avec son nom de fichier pour libelle. Oublier de
   lancer ce script degrade donc l'affichage, il ne fait rien
   disparaitre.

   LES VIGNETTES sont fabriquees avec ffmpeg, s'il est disponible.
   PiBoard sait deja le detecter et l'installer pour l'IPTV (voir
   server/mediaTools.js), donc aucune dependance nouvelle. Sans ffmpeg,
   le script continue et se contente d'indexer : les images seront
   affichees en taille reelle dans la grille, ce qui est lourd sur un
   Pi -- d'ou l'avertissement en fin d'execution.

   Builds public/library/index.json from the files dropped into
   public/library/<section>/, and makes the thumbnails.

   RUN IT AFTER ADDING IMAGES, before tagging:
       npm run library:index

   WHY AN INDEX RATHER THAN READING EVERYTHING ON THE FLY. The server
   can already list a folder's files; what it cannot guess are the
   readable name, the category, the light or dark cast, the author and
   the licence. That information is entered ONCE in a meta.json per
   section, and this script freezes it into an index the server reads in
   one go -- rather than opening thirty files every time the library is
   displayed on a Raspberry Pi.

   The index ENRICHES, it does not filter: an image present with no
   entry still shows up, with its file name as its label. Forgetting to
   run this script therefore degrades the display, it makes nothing
   disappear.

   THUMBNAILS are made with ffmpeg, when available. PiBoard already
   knows how to detect and install it for IPTV (see
   server/mediaTools.js), so no new dependency. Without ffmpeg the
   script carries on and merely indexes: images will be shown at full
   size in the grid, which is heavy on a Pi -- hence the warning at the
   end.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "public", "library");
const SECTIONS = ["backgrounds", "logos", "photos"];
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
const THUMB_WIDTH = 480;

function hasFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return r.status === 0;
}

/* Dimensions lues dans l'EN-TETE du fichier, sans decoder l'image et
   sans bibliotheque. Trois formats couvrent tout ce qu'on livre ; pour
   les autres (webp, svg) on renonce plutot que d'embarquer un
   analyseur : l'information est confortable, pas indispensable.
   Dimensions read from the file's HEADER, without decoding the image and
   without a library. Three formats cover everything we ship; for the
   others (webp, svg) we give up rather than embed a parser: the
   information is a comfort, not a necessity. */
function dimensions(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(32);
    fs.readSync(fd, head, 0, 32, 0);

    // PNG : largeur et hauteur en big-endian aux octets 16 et 20.
    // PNG: width and height big-endian at bytes 16 and 20.
    if (head.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }

    // GIF : little-endian aux octets 6 et 8.
    // GIF: little-endian at bytes 6 and 8.
    if (head.slice(0, 3).toString("latin1") === "GIF") {
      return { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
    }

    // JPEG : il faut parcourir les segments jusqu'au marqueur SOFn, la
    // taille n'etant pas a une position fixe.
    // JPEG: segments must be walked until an SOFn marker, the size not
    // sitting at a fixed position.
    if (head[0] === 0xff && head[1] === 0xd8) {
      const size = fs.statSync(file).size;
      const buf = Buffer.alloc(Math.min(size, 512 * 1024));
      fs.readSync(fd, buf, 0, buf.length, 0);
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch (e) {
    // Un fichier illisible n'arrete pas l'indexation.
    // An unreadable file does not stop the indexing.
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* ignore */ }
  }
  return { width: null, height: null };
}

function makeThumb(section, file, ffmpeg) {
  if (!ffmpeg) return null;
  const ext = path.extname(file).toLowerCase();
  // Les SVG et les GIF animes ne gagnent rien a une vignette : le
  // premier est deja leger, le second perdrait son animation pour un
  // gain nul sur un fichier rarement enorme.
  // SVGs and animated GIFs gain nothing from a thumbnail: the former is
  // already light, the latter would lose its animation for no gain on a
  // rarely huge file.
  if (ext === ".svg" || ext === ".gif") return null;

  const dir = path.join(ROOT, section);
  const thumbDir = path.join(dir, "thumbs");
  fs.mkdirSync(thumbDir, { recursive: true });
  const out = path.join(thumbDir, path.basename(file, ext) + ".jpg");
  const src = path.join(dir, file);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
    return "thumbs/" + path.basename(out);
  }
  const r = spawnSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", src,
    "-vf", `scale=${THUMB_WIDTH}:-1:flags=lanczos`,
    "-q:v", "4",
    out
  ], { stdio: "inherit" });
  return r.status === 0 ? "thumbs/" + path.basename(out) : null;
}

function readMeta(section) {
  const file = path.join(ROOT, section, "meta.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

function main() {
  const ffmpeg = hasFfmpeg();
  const items = {};
  let count = 0;
  let missingMeta = [];

  for (const section of SECTIONS) {
    const dir = path.join(ROOT, section);
    fs.mkdirSync(dir, { recursive: true });
    const meta = readMeta(section);
    for (const file of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, file);
      if (!fs.statSync(full).isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;

      const m = meta[file] || {};
      if (!meta[file]) missingMeta.push(section + "/" + file);
      const dim = dimensions(full);
      const thumb = makeThumb(section, file, ffmpeg);

      items["builtin:" + section + ":" + file] = {
        name: m.name || path.basename(file, ext).replace(/[_-]+/g, " "),
        category: m.category || null,
        tone: m.tone === "light" || m.tone === "dark" ? m.tone : null,
        author: m.author || null,
        license: m.license || null,
        source: m.source || null,
        width: dim.width,
        height: dim.height,
        thumb: thumb ? "thumbs/" + path.basename(thumb) : null
      };
      count++;
    }
  }

  const out = {
    generated: new Date().toISOString(),
    items
  };
  fs.writeFileSync(path.join(ROOT, "index.json"), JSON.stringify(out, null, 2) + "\n");

  console.log(`\nBibliotheque indexee : ${count} element(s) dans public/library/index.json`);
  if (!ffmpeg) {
    console.log(
      "ffmpeg absent : aucune vignette n'a ete fabriquee. Les images seront affichees\n" +
      "en taille reelle dans la grille, ce qui est lourd sur un Raspberry Pi.\n" +
      "ffmpeg missing: no thumbnail was made. Images will be shown at full size in the\n" +
      "grid, which is heavy on a Raspberry Pi."
    );
  }
  if (missingMeta.length) {
    console.log(
      `\n${missingMeta.length} fichier(s) sans entree dans meta.json (nom, categorie, clair/sombre,\n` +
      "auteur, licence). Ils apparaitront quand meme, avec leur nom de fichier pour libelle :\n  " +
      missingMeta.slice(0, 12).join("\n  ") +
      (missingMeta.length > 12 ? `\n  ... et ${missingMeta.length - 12} autre(s)` : "")
    );
  }
  console.log("");
}

main();
