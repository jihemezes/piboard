#!/usr/bin/env node
/* ============================================================
   PiBoard - scripts/library-meta.js
   Remplit le meta.json d'une section a partir des NOMS DE FICHIERS,
   pour ne pas avoir a decrire trente images a la main.

       npm run library:meta                    (toutes les sections)
       npm run library:meta -- --section backgrounds
       npm run library:meta -- --author "Jean-Michel EZES" --license "CC BY 4.0"

   CE QU'IL DEDUIT, et comment :
     - `name`     : le nom du fichier sans son extension, tel quel
                    ("Classy_Blue.png" -> "Classy_Blue").
     - `category` : la premiere partie du nom, avant le premier `_`,
                    `-` ou espace ("Classy_Blue.png" -> "Classy").
                    C'est la convention de nommage a respecter en
                    deposant les fichiers ; elle alimente le filtre par
                    categorie de l'interface.
     - `tone`     : MESURE, pas devine. ffmpeg reduit l'image a un seul
                    pixel et on lit sa luminance : au-dessus de la
                    moitie, `light` ; en dessous, `dark`. C'est
                    exactement la question que se pose l'utilisateur --
                    « le texte de mes tuiles restera-t-il lisible
                    par-dessus ? » -- et une reponse mesuree vaut mieux
                    qu'une reponse inventee a partir d'un nom de
                    couleur. Sans ffmpeg, le champ est laisse vide
                    plutot que rempli au hasard.
     - `author`, `license` : les valeurs passees en option, identiques
                    pour tout le lot.

   PAS DE CHAMP `source`. Il ne sert qu'a crediter une image trouvee
   ailleurs (page d'origine, banque d'images). Pour une image dont on
   est l'auteur, il n'y a rien a pointer : le champ est simplement omis,
   et l'interface n'affiche que ce qui existe.

   CE SCRIPT N'ECRASE JAMAIS une entree existante : il complete. Une
   description affinee a la main survit donc a une reexecution, ce qui
   permet de le relancer apres chaque ajout sans rien perdre. Avec
   `--force`, il reecrit tout -- a n'utiliser que pour repartir de zero.

   Fills a section's meta.json from FILE NAMES, so as not to describe
   thirty images by hand. It derives `name` (the file name without its
   extension), `category` (the first part of the name, before the first
   `_`, `-` or space), and `tone` -- MEASURED, not guessed: ffmpeg
   shrinks the image to a single pixel and its luminance is read. That
   is exactly the question the user asks -- "will my tile text stay
   readable on top?" -- and a measured answer beats one invented from a
   colour word. Without ffmpeg the field is left empty rather than
   filled at random. `author` and `license` come from the options.

   NO `source` FIELD: it only serves to credit an image found elsewhere.
   For an image you authored there is nothing to point at, so the field
   is simply left out.

   THIS SCRIPT NEVER OVERWRITES an existing entry: it completes. A
   hand-refined description therefore survives a re-run, which is what
   lets you run it again after every addition without losing anything.
   With `--force` it rewrites everything -- only to start over.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "public", "library");
const SECTIONS = ["backgrounds", "logos", "photos"];
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const FORCE = process.argv.includes("--force");
const AUTHOR = arg("author", "Jean-Michel EZES");
const LICENSE = arg("license", "CC BY 4.0");
const ONLY = arg("section", null);

function hasFfmpeg() {
  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

/* Categorie = premiere partie du nom. On accepte les trois separateurs
   qu'on rencontre en pratique dans un nom de fichier, et on renvoie le
   nom entier s'il n'en contient aucun -- mieux vaut une categorie egale
   au nom qu'une categorie vide.
   Category = first part of the name. The three separators one actually
   meets in a file name are accepted, and the whole name is returned when
   it holds none -- a category equal to the name beats an empty one. */
function categoryOf(stem) {
  const m = /^([^_\-\s]+)/.exec(stem);
  return m ? m[1] : stem;
}

/* Luminance moyenne, mesuree par ffmpeg : l'image est reduite a 1x1
   pixel (donc moyennee par le reechantillonnage), ecrite en brut, et on
   lit les trois octets RVB. La ponderation 0.2126 / 0.7152 / 0.0722 est
   celle de la luminance relative (Rec. 709) : l'oeil est bien plus
   sensible au vert qu'au bleu, une moyenne arithmetique classerait
   « sombre » des fonds bleus parfaitement lisibles.
   Average luminance, measured by ffmpeg: the image is reduced to 1x1
   pixel (hence averaged by the resampling), written raw, and the three
   RGB bytes are read. The 0.2126 / 0.7152 / 0.0722 weighting is relative
   luminance (Rec. 709): the eye is far more sensitive to green than to
   blue, and a plain arithmetic mean would class perfectly readable blue
   backgrounds as "dark". */
function toneOf(file) {
  const r = spawnSync("ffmpeg", [
    "-v", "error", "-i", file,
    "-vf", "scale=1:1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"
  ], { maxBuffer: 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 3) return null;
  const [red, green, blue] = r.stdout;
  const luma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luma >= 0.5 ? "light" : "dark";
}

function main() {
  const ffmpeg = hasFfmpeg();
  const sections = ONLY ? [ONLY] : SECTIONS;
  let added = 0;
  let kept = 0;
  let noTone = 0;

  for (const section of sections) {
    const dir = path.join(ROOT, section);
    if (!fs.existsSync(dir)) continue;
    const metaFile = path.join(dir, "meta.json");
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) || {}; } catch (e) { meta = {}; }

    for (const file of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, file);
      if (!fs.statSync(full).isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;

      if (meta[file] && !FORCE) { kept++; continue; }

      const stem = path.basename(file, ext);
      const tone = ffmpeg ? toneOf(full) : null;
      if (!tone) noTone++;

      const entry = { name: stem, category: categoryOf(stem) };
      if (tone) entry.tone = tone;
      if (AUTHOR) entry.author = AUTHOR;
      if (LICENSE) entry.license = LICENSE;
      meta[file] = entry;
      added++;
      console.log(`  ${section}/${file}  ->  categorie « ${entry.category} »` + (tone ? `, ${tone}` : ""));
    }

    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n");
  }

  console.log(
    `\n${added} entree(s) ecrite(s), ${kept} conservee(s) telle(s) quelle(s).` +
    (FORCE ? " (--force : tout a ete reecrit)" : "")
  );
  if (!ffmpeg) {
    console.log(
      "ffmpeg absent : le champ tone (clair/sombre) a ete laisse vide plutot que devine.\n" +
      "ffmpeg missing: the tone field (light/dark) was left empty rather than guessed."
    );
  } else if (noTone) {
    console.log(`${noTone} image(s) dont la luminance n'a pas pu etre mesuree : champ tone omis.`);
  }
  console.log("Lancez ensuite : npm run library:index\n");
}

main();
