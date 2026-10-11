#!/usr/bin/env node
/* ============================================================
   PiBoard - tools/whatsnew-dates.js
   Renseigne la DATE de chaque version dans WHATSNEW.md, a partir des
   etiquettes git du depot.

   POURQUOI UN OUTIL PLUTOT QU'UN CALCUL A L'EXECUTION. Une installation
   de PiBoard n'est pas un depot git : chez la personne qui s'en sert,
   il n'y a ni `.git` ni etiquettes, et rien ne pourrait donc dater les
   versions au moment de l'affichage. Les dates sont donc INSCRITES dans
   WHATSNEW.md, une fois, ici -- et livrees avec lui.

   USAGE :  node tools/whatsnew-dates.js          (ecrit le fichier)
            node tools/whatsnew-dates.js --check  (n'ecrit rien, liste
                                                   ce qui manque)

   A lancer depuis un clone COMPLET du depot : un clone superficiel
   (`--depth`) n'a pas les etiquettes anciennes, et l'outil le dit
   plutot que d'ecrire des dates partielles sans prevenir.

   Fills in each version's DATE in WHATSNEW.md from the repository's git
   tags. A PiBoard installation is not a git repository, so dates are
   written into the file once, here, and shipped with it. Run from a
   FULL clone: a shallow one lacks the older tags, and the tool says so
   rather than silently writing partial dates.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FILE = path.join(__dirname, "..", "WHATSNEW.md");
const check = process.argv.includes("--check");

/* Une seule invocation de git plutot qu'une par version : sur une
   centaine de versions, la difference se voit.
   One git call rather than one per version. */
function tagDates() {
  const out = execFileSync("git", [
    "for-each-ref", "--format=%(refname:short)\t%(creatordate:short)", "refs/tags"
  ], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
  const map = new Map();
  for (const line of out.split("\n")) {
    const [tag, date] = line.split("\t");
    if (!tag || !date) continue;
    map.set(tag.replace(/^v/, ""), date.trim());
  }
  return map;
}

function main() {
  let dates;
  try {
    dates = tagDates();
  } catch (e) {
    console.error("git introuvable ou hors depot / git unavailable or outside a repository");
    process.exit(1);
  }

  const raw = fs.readFileSync(FILE, "utf8");
  const missing = [];
  let filled = 0;

  /* La date existante est REMPLACEE : si une etiquette a ete deplacee,
     le fichier suit. Une version sans etiquette garde sa ligne telle
     quelle -- pas de date inventee.
     An existing date is REPLACED so the file follows a moved tag. A
     version with no tag keeps its line as is -- no invented date. */
  const updated = raw.replace(/^##[ \t]+(\S+)(?:[ \t]*[-—][ \t]*\d{4}-\d{2}-\d{2})?[ \t]*$/gm,
    (whole, version) => {
      const date = dates.get(version);
      if (!date) { missing.push(version); return "## " + version; }
      filled++;
      return "## " + version + " - " + date;
    });

  if (missing.length) {
    console.warn("sans etiquette git / no git tag (" + missing.length + ") : " + missing.join(", "));
    if (missing.length > 10) {
      console.warn("Beaucoup de versions sans etiquette : clone superficiel ?");
      console.warn("Many versions without a tag: shallow clone? Try `git fetch --tags --unshallow`.");
    }
  }

  if (check) {
    console.log(filled + " version(s) datable(s), " + missing.length + " sans etiquette.");
    return;
  }
  if (updated !== raw) fs.writeFileSync(FILE, updated);
  console.log(filled + " date(s) inscrite(s) dans WHATSNEW.md / date(s) written.");
}

main();
