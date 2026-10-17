/* PiBoard - tileCopy.js (1.154.0)
   « Dupliquer vers… » : la copie d'une tuile doit emporter ce qui vit EN
   DEHORS de ses reglages -- ses images (data/media/<tuile>/, et
   data/media/<tuile>logo/ pour le bloc logo des tuiles Formule 1 et
   MotoGP) et ses valeurs secretes (coffre des tuiles). Sans cela, la
   copie afficherait « choisir une image » et redemanderait le mot de
   passe de la boite mail.

   POURQUOI UN NOUVEL IDENTIFIANT ET UNE VRAIE COPIE, et non un partage :
   supprimer la copie effacerait sinon les images et le mot de passe de
   l'original. Les deux tuiles doivent etre independantes des la copie.

   Le DEPLACEMENT, lui, ne passe pas par ici : la tuile garde son
   identifiant, donc tout ce qui y est rattache la suit sans rien copier.

   "Duplicate to…": a tile copy must carry what lives OUTSIDE its settings
   -- its images (and the F1/MotoGP logo folder) and its secrets. A NEW id
   and a REAL copy, not sharing: deleting the copy must not wipe the
   original's files. MOVING does not come here: the tile keeps its id. */
"use strict";

const fs = require("fs");
const path = require("path");
const media = require("./media");

/* Les dossiers d'images rattaches a une tuile : le sien, et celui de son
   bloc logo (« <tuile>logo »). The image folders tied to a tile. */
function mediaFolders(tileId) {
  return [tileId, tileId + "logo"].filter((id) => media.isValidTileId(id));
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    const st = fs.statSync(src);
    if (!st.isFile()) continue;
    fs.copyFileSync(src, path.join(to, name));
    n++;
  }
  return n;
}

/* Copie images et secrets de `fromId` vers `toId`. Refuse d'ecraser une
   tuile existante : un identifiant deja pris signale une erreur de
   l'appelant, et ecraser serait silencieux et irreversible.
   Copies images and secrets. Refuses to overwrite an existing tile. */
function duplicate(fromId, toId, secretsModule) {
  if (!media.isValidTileId(fromId) || !media.isValidTileId(toId)) throw new Error("invalid tile id");
  if (fromId === toId) throw new Error("same tile id");
  for (const id of mediaFolders(toId)) {
    if (fs.existsSync(path.join(media.MEDIA_ROOT, id))) throw new Error("target already exists");
  }
  const report = { media: 0, secrets: 0 };
  const src = mediaFolders(fromId), dst = mediaFolders(toId);
  for (let i = 0; i < src.length && i < dst.length; i++) {
    report.media += copyDir(path.join(media.MEDIA_ROOT, src[i]), path.join(media.MEDIA_ROOT, dst[i]));
  }
  const vault = secretsModule && typeof secretsModule.all === "function" ? secretsModule.all() : {};
  const mine = vault[fromId] || {};
  for (const key of Object.keys(mine)) {
    secretsModule.set(toId, key, mine[key]);
    report.secrets++;
  }
  return report;
}

module.exports = { duplicate, mediaFolders };
