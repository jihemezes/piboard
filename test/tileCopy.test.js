/* Test de « Dupliquer vers… » cote serveur (server/tileCopy.js, 1.154.0).

   Ce qui compte : la copie emporte les images de la tuile ET celles de
   son bloc logo, ainsi que ses secrets, sous le NOUVEL identifiant -- et
   l'original n'est pas touche. Une copie qui PARTAGERAIT les fichiers
   perdrait les images de l'original le jour ou on la supprime.
   What matters: the copy carries the tile's images AND its logo block's,
   plus its secrets, under the NEW id -- and the original is untouched. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-tilecopy-"));
process.env.PIBOARD_DATA = DATA;
const media = require("../server/media.js");
const tileSecrets = require("../server/tileSecrets.js");
const tileCopy = require("../server/tileCopy.js");

let n = 0;
const ok = (label, cond) => { assert.ok(cond, label); n++; console.log("  OK   " + label); };

fs.mkdirSync(path.join(media.MEDIA_ROOT, "t-orig"), { recursive: true });
fs.writeFileSync(path.join(media.MEDIA_ROOT, "t-orig", "fond.jpg"), Buffer.from([1, 2, 3]));
fs.mkdirSync(path.join(media.MEDIA_ROOT, "t-origlogo"), { recursive: true });
fs.writeFileSync(path.join(media.MEDIA_ROOT, "t-origlogo", "logo.png"), Buffer.from([9, 9]));
tileSecrets.set("t-orig", "password", "s3cret");

const r = tileCopy.duplicate("t-orig", "t-copy", tileSecrets);
ok("les images de la tuile sont recopiees", fs.readFileSync(path.join(media.MEDIA_ROOT, "t-copy", "fond.jpg")).length === 3);
ok("celles du bloc logo aussi, dans le dossier logo de la copie", fs.existsSync(path.join(media.MEDIA_ROOT, "t-copylogo", "logo.png")));
ok("les secrets suivent sous le nouvel identifiant", tileSecrets.get("t-copy", "password") === "s3cret");
ok("le rapport compte ce qui a ete copie", r.media === 2 && r.secrets === 1);

fs.rmSync(path.join(media.MEDIA_ROOT, "t-copy"), { recursive: true });
tileSecrets.clearTile("t-copy");
ok("supprimer la copie ne touche pas l'original",
  fs.existsSync(path.join(media.MEDIA_ROOT, "t-orig", "fond.jpg")) && tileSecrets.get("t-orig", "password") === "s3cret");

fs.mkdirSync(path.join(media.MEDIA_ROOT, "t-taken"), { recursive: true });
assert.throws(() => tileCopy.duplicate("t-orig", "t-taken", tileSecrets), /exists/);
ok("une tuile existante n'est jamais ecrasee", true);
assert.throws(() => tileCopy.duplicate("../etc", "t-x", tileSecrets), /invalid/);
ok("un identifiant hors format est refuse (pas de chemin arbitraire)", true);
ok("une tuile sans image ni secret se duplique sans erreur", tileCopy.duplicate("t-vide", "t-vide2", tileSecrets).media === 0);

fs.rmSync(DATA, { recursive: true, force: true });
console.log(`\n>>> tileCopy : ${n} verifications OK`);
