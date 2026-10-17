/* ============================================================
   PiBoard - server/library.js
   Bibliotheque d'images fournie avec PiBoard, enrichissable par
   l'utilisateur : fonds de page, images pour la tuile Logo, photos pour
   le diaporama.

   DEUX ORIGINES, JAMAIS MELANGEES -- c'est toute la difficulte, et le
   mecanisme de mise a jour la dicte. La mise a jour du Raspberry Pi
   remplace l'arbre entier SAUF data/ (voir server/selfUpdate.js), et un
   paquet .deb ou un installeur remplace de meme tout le code. Donc :

     - public/library/  : le lot LIVRE avec l'application. Remplace a
       chaque mise a jour, ce qui est precisement le but : c'est par la
       que la bibliotheque s'enrichit d'une version a l'autre. Cote
       developpement, on depose les fichiers et on lance
       `npm run library:index` (scripts/library-index.js).
     - data/library/    : les ajouts de l'UTILISATEUR. Jamais touches
       par une mise a jour, sauvegardes avec le reste de ses donnees.

   On a volontairement ECARTE la solution qui consiste a recopier le lot
   livre dans data/ au premier demarrage : les images ajoutees dans les
   versions suivantes n'atteindraient jamais les installations
   existantes, ou au prix d'une gestion de versions et de doublons.

   SUPPRESSION. Un element livre ne peut pas etre efface : il
   reviendrait a la mise a jour suivante. Il peut en revanche etre
   MASQUE -- une simple liste d'identifiants dans data/library/
   hidden.json. L'utilisateur obtient le resultat qu'il attend sans
   qu'on lui mente sur ce qui est reellement effacable. Ses propres
   ajouts, eux, se suppriment pour de bon.

   CE MODULE NE SERT PAS LES IMAGES AUX TUILES. Les tuiles (fond de
   page, Logo, diaporama) passent toutes par l'API media existante, qui
   range les fichiers par tuile. Choisir une image de la bibliotheque la
   COPIE dans le dossier media de la tuile (voir la route
   /api/media/:tileId/from-library). Ainsi rien ne change pour les
   tuiles, et supprimer une image de la bibliotheque ne casse pas une
   page qui l'utilisait.

   Image library shipped with PiBoard and extensible by the user: page
   backgrounds, images for the Logo tile, photos for the slideshow.

   TWO ORIGINS, NEVER MIXED -- the whole difficulty, and the update
   mechanism dictates it. The Raspberry Pi's update replaces the entire
   tree EXCEPT data/ (see server/selfUpdate.js), and a .deb or an
   installer likewise replaces all the code. Hence:

     - public/library/ : the lot SHIPPED with the application. Replaced
       on every update, which is exactly the point: this is how the
       library grows from one version to the next. On the development
       side, drop the files in and run `npm run library:index`
       (scripts/library-index.js).
     - data/library/   : the USER's additions. Never touched by an
       update, backed up with the rest of their data.

   We deliberately RULED OUT copying the shipped lot into data/ on first
   run: images added in later versions would never reach existing
   installations, or only at the cost of version and duplicate handling.

   DELETION. A shipped item cannot be erased: it would come back with
   the next update. It can however be HIDDEN -- a plain list of ids in
   data/library/hidden.json. The user gets the result they expect
   without being lied to about what is actually erasable. Their own
   additions do get deleted for good.

   THIS MODULE DOES NOT SERVE IMAGES TO THE TILES. The tiles (page
   background, Logo, slideshow) all go through the existing media API,
   which files images per tile. Choosing a library image COPIES it into
   the tile's media folder (see the /api/media/:tileId/from-library
   route). Nothing changes for the tiles, and deleting a library image
   does not break a page that was using it.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const dns = require("dns");
const net = require("net");
const store = require("./store");

const BUILTIN_ROOT = path.join(__dirname, "..", "public", "library");
const USER_ROOT = path.join(store.DATA_DIR, "library");
const HIDDEN_FILE = path.join(USER_ROOT, "hidden.json");

/* Les sections repondent a un besoin d'affichage different, pas a un
   type de fichier different : un fond de page est une image large, une
   image de tuile Logo est souvent un fond transparent, une photo de
   diaporama est un cliche. Les separer evite de noyer l'utilisateur
   dans une grille ou tout se ressemble sans se valoir.
   Sections answer a different display need, not a different file type:
   a page background is a wide image, a Logo tile image is often
   transparent, a slideshow photo is a snapshot. Keeping them apart
   avoids drowning the user in a grid where everything looks alike
   without being interchangeable. */
const SECTIONS = ["backgrounds", "logos", "photos"];

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
const MAX_USER_ITEMS = 500;

function isSection(section) {
  return SECTIONS.includes(String(section));
}

/* Nom de fichier accepte : ni point initial, ni separateur de chemin, ni
   antislash. Le controle porte sur le nom SEUL, jamais sur un chemin
   reconstruit -- c'est ce qui rend la traversee de repertoire
   impossible plutot que difficile.
   Accepted file name: no leading dot, no path separator, no backslash.
   The check applies to the name ALONE, never to a rebuilt path -- that
   is what makes directory traversal impossible rather than merely
   hard. */
function safeName(name) {
  const n = String(name || "");
  if (!n || n.length > 120) return null;
  if (n.includes("/") || n.includes("\\") || n.startsWith(".")) return null;
  if (!/^[A-Za-z0-9 ._()-]+$/.test(n)) return null;
  if (!ALLOWED_EXT.has(path.extname(n).toLowerCase())) return null;
  return n;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}

function hiddenSet() {
  const list = readJson(HIDDEN_FILE, []);
  return new Set(Array.isArray(list) ? list.map(String) : []);
}

function setHidden(id, hidden) {
  const set = hiddenSet();
  if (hidden) set.add(String(id));
  else set.delete(String(id));
  fs.mkdirSync(USER_ROOT, { recursive: true });
  fs.writeFileSync(HIDDEN_FILE, JSON.stringify([...set], null, 2));
  return [...set];
}

/* Identifiant d'un element : origine + section + nom de fichier. Il est
   deduit, jamais stocke, donc toujours coherent avec ce qui est sur le
   disque -- un index oublie ne peut pas creer d'element fantome.
   An item's id: origin + section + file name. It is derived, never
   stored, so always consistent with what sits on disk -- a forgotten
   index cannot conjure a phantom item. */
function idOf(origin, section, file) {
  return origin + ":" + section + ":" + file;
}

function parseId(id) {
  const parts = String(id || "").split(":");
  if (parts.length !== 3) return null;
  const [origin, section, file] = parts;
  if (origin !== "builtin" && origin !== "user") return null;
  if (!isSection(section)) return null;
  const name = safeName(file);
  if (!name) return null;
  return { origin, section, file: name };
}

function rootFor(origin) {
  return origin === "user" ? USER_ROOT : BUILTIN_ROOT;
}

/* Chemin sur disque d'un element. Renvoie null si le fichier n'existe
   pas : l'appelant n'a pas a distinguer « identifiant invalide » de
   « fichier disparu », les deux donnent le meme 404.
   On-disk path of an item. Returns null when the file does not exist:
   the caller need not tell apart "invalid id" from "vanished file",
   both yield the same 404. */
function fileOf(id) {
  const parsed = parseId(id);
  if (!parsed) return null;
  const full = path.join(rootFor(parsed.origin), parsed.section, parsed.file);
  return fs.existsSync(full) ? full : null;
}

/* Metadonnees. Le lot livre a son index genere
   (public/library/index.json, voir scripts/library-index.js) ; les
   ajouts de l'utilisateur ont le leur (data/library/index.json), ecrit
   au televersement. Dans les deux cas l'index ENRICHIT la liste des
   fichiers, il ne la remplace pas : un fichier present sans entree
   d'index apparait quand meme, avec son nom pour seul libelle. C'est
   ce qui permet a l'utilisateur de deposer des images directement dans
   data/library/backgrounds/ depuis un partage reseau, sans rien lancer.
   Metadata. The shipped lot has its generated index
   (public/library/index.json, see scripts/library-index.js); the user's
   additions have theirs (data/library/index.json), written on upload.
   In both cases the index ENRICHES the file list, it does not replace
   it: a file present with no index entry still shows up, with its name
   as its only label. That is what lets the user drop images straight
   into data/library/backgrounds/ from a network share, with nothing to
   run. */
function metaFor(origin) {
  const index = readJson(path.join(rootFor(origin), "index.json"), {});
  return (index && typeof index === "object" && index.items) || {};
}

function listOrigin(origin, section) {
  const dir = path.join(rootFor(origin), section);
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const meta = metaFor(origin);
  const out = [];
  for (const file of files.sort()) {
    const name = safeName(file);
    if (!name) continue;
    const id = idOf(origin, section, name);
    const m = meta[id] || meta[section + "/" + name] || {};
    let size = null;
    try { size = fs.statSync(path.join(dir, name)).size; } catch (e) { /* ignore */ }
    out.push({
      id,
      origin,
      section,
      file: name,
      name: m.name || path.basename(name, path.extname(name)).replace(/[_-]+/g, " "),
      category: m.category || null,
      tone: m.tone === "light" || m.tone === "dark" ? m.tone : null,
      author: m.author || null,
      license: m.license || null,
      source: m.source || null,
      width: m.width || null,
      height: m.height || null,
      bytes: size,
      url: "/api/library/file/" + encodeURIComponent(id),
      // La vignette n'est pas un element de la bibliotheque : elle vit
      // dans un sous-dossier thumbs/ et a sa propre route, qui la
      // resout a partir de l'identifiant de l'image. Lui donner un
      // identifiant complet l'aurait fait apparaitre dans la grille.
      // The thumbnail is not a library item: it lives in a thumbs/
      // subfolder and has its own route, resolving it from the image's
      // id. Giving it a full id would have made it show up in the grid.
      thumb: m.thumb ? "/api/library/thumb/" + encodeURIComponent(id) : null
    });
  }
  return out;
}

function list(section, opts) {
  const sections = isSection(section) ? [section] : SECTIONS;
  const hidden = hiddenSet();
  const showHidden = !!(opts && opts.includeHidden);
  const items = [];
  for (const s of sections) {
    for (const origin of ["builtin", "user"]) {
      for (const item of listOrigin(origin, s)) {
        // Les vignettes ne sont pas des elements : elles vivent dans un
        // sous-dossier thumbs/ que readdirSync ignore (ce n'est pas un
        // fichier). Thumbnails are not items: they live in a thumbs/
        // subfolder, which readdirSync skips (not a file).
        item.hidden = hidden.has(item.id);
        if (item.hidden && !showHidden) continue;
        items.push(item);
      }
    }
  }
  return items;
}

function categories(section) {
  const set = new Set();
  for (const item of list(section)) if (item.category) set.add(item.category);
  return [...set].sort();
}

/* Index des ajouts de l'utilisateur (data/library/index.json). Une seule
   paire de fonctions lit et ecrit ce fichier : l'ajout, la suppression, le
   renommage et le deplacement passent tous par la, donc aucun ne peut
   l'abimer a sa maniere.
   Index of the user's additions (data/library/index.json). A single pair
   of functions reads and writes this file: adding, deleting, renaming and
   moving all go through it, so none can damage it in its own way. */
const USER_INDEX = path.join(USER_ROOT, "index.json");

function readUserIndex() {
  const index = readJson(USER_INDEX, { items: {} });
  if (!index || typeof index !== "object") return { items: {} };
  if (!index.items || typeof index.items !== "object") index.items = {};
  return index;
}

function writeUserIndex(index) {
  fs.mkdirSync(USER_ROOT, { recursive: true });
  fs.writeFileSync(USER_INDEX, JSON.stringify(index, null, 2));
}

/* Nom de fichier propre a partir d'un nom quelconque : accents replies,
   caracteres hors liste remplaces, longueur bornee. Un fichier « Été à
   la mer.JPG » devient « Ete a la mer.jpg » au lieu d'un « image-1729...
   .jpg » anonyme ; le libelle d'origine est conserve a part (voir
   addUserFile), c'est lui que l'utilisateur voit dans la grille.
   Clean file name from any name: accents folded, characters outside the
   list replaced, length bounded. A file "Été à la mer.JPG" becomes
   "Ete a la mer.jpg" instead of an anonymous "image-1729....jpg"; the
   original label is kept apart (see addUserFile), and that is what the
   user sees in the grid. */
function cleanName(original, fallbackExt) {
  const raw = path.basename(String(original || "").replace(/\\/g, "/"));
  const ext = (path.extname(raw) || fallbackExt || "").toLowerCase();
  const rawBase = path.basename(raw, path.extname(raw));
  let base = rawBase.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ._()-]+/g, "-")
    .replace(/^[.\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!base) base = "image-" + Date.now();
  return { file: base + ext, label: rawBase.trim().slice(0, 80), changed: base !== rawBase.trim() };
}

function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/* Ajout d'un fichier par l'utilisateur. Le nom est rendu unique plutot
   que refuse : quelqu'un qui televerse deux "fond.jpg" venus de deux
   dossiers differents ne comprendrait pas un refus.
   Adding a file by the user. The name is made unique rather than
   refused: someone uploading two "background.jpg" from two different
   folders would not understand a refusal. */
function addUserFile(section, originalName, buffer, meta) {
  if (!isSection(section)) throw new Error("unknown section");
  const ext = path.extname(String(originalName || "")).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error("unsupported file type");
  if (list(section, { includeHidden: true }).filter((i) => i.origin === "user").length >= MAX_USER_ITEMS) {
    throw new Error("library full");
  }

  const cleaned = cleanName(originalName || "image" + ext, ext);
  const base = safeName(cleaned.file) || ("image-" + Date.now() + ext);
  const dir = path.join(USER_ROOT, section);
  fs.mkdirSync(dir, { recursive: true });

  let file = base;
  let n = 1;
  while (fs.existsSync(path.join(dir, file))) {
    file = path.basename(base, ext) + "-" + (++n) + ext;
  }
  fs.writeFileSync(path.join(dir, file), buffer);

  // Le libelle d'origine est garde quand le nom de fichier a du etre
  // nettoye : l'utilisateur retrouve « Ete » avec ses accents.
  // The original label is kept when the file name had to be cleaned: the
  // user finds their accents again.
  const m = meta && typeof meta === "object" ? meta : null;
  const label = (m && m.name) || (cleaned.changed ? cleaned.label : "");
  if (m || label) {
    const index = readUserIndex();
    index.items[idOf("user", section, file)] = {
      name: label || undefined,
      category: (m && m.category) || undefined,
      tone: (m && m.tone) || undefined,
      author: (m && m.author) || undefined,
      license: (m && m.license) || undefined
    };
    writeUserIndex(index);
  }
  return idOf("user", section, file);
}

function removeUserFile(id) {
  const parsed = parseId(id);
  if (!parsed || parsed.origin !== "user") throw new Error("not a user item");
  const full = path.join(USER_ROOT, parsed.section, parsed.file);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  const index = readUserIndex();
  if (index.items[id]) {
    delete index.items[id];
    writeUserIndex(index);
  }
  return true;
}

/* Retouche des informations d'un ajout personnel : libelle, categorie,
   dominante claire ou sombre. Le NOM DE FICHIER ne change jamais : il
   sert d'identifiant et, copie dans une tuile, de reference. Seul le
   libelle que voit l'utilisateur est modifie, et il n'existe que dans
   l'index. Un element livre n'est pas modifiable (la mise a jour
   remettrait son libelle d'origine).
   Editing a personal addition's information: label, category, light or
   dark cast. The FILE NAME never changes: it serves as the id and, once
   copied into a tile, as a reference. Only the label the user sees is
   modified, and it exists only in the index. A shipped item is not
   editable (the update would put its original label back). */
function updateUserMeta(id, patch) {
  const parsed = parseId(id);
  if (!parsed || parsed.origin !== "user") throw new Error("not a user item");
  if (!fileOf(id)) throw new Error("unknown library item");
  const p = patch && typeof patch === "object" ? patch : {};
  const index = readUserIndex();
  const entry = Object.assign({}, index.items[id]);
  if ("name" in p) {
    const name = cleanText(p.name, 80);
    if (name) entry.name = name; else delete entry.name;
  }
  if ("category" in p) {
    const category = cleanText(p.category, 40);
    if (category) entry.category = category; else delete entry.category;
  }
  if ("tone" in p) {
    if (p.tone === "light" || p.tone === "dark") entry.tone = p.tone; else delete entry.tone;
  }
  if (Object.keys(entry).length) index.items[id] = entry; else delete index.items[id];
  writeUserIndex(index);
  return entry;
}

/* Deplacement d'un ajout personnel vers une autre section : le fichier
   change de dossier et son entree d'index le suit. Meme regle de nom
   unique qu'a l'ajout. Renvoie le NOUVEL identifiant, qui contient la
   section.
   Moving a personal addition to another section: the file changes folder
   and its index entry follows. Same unique-name rule as on adding.
   Returns the NEW id, which contains the section. */
function moveUserFile(id, toSection) {
  const parsed = parseId(id);
  if (!parsed || parsed.origin !== "user") throw new Error("not a user item");
  if (!isSection(toSection)) throw new Error("unknown section");
  const from = fileOf(id);
  if (!from) throw new Error("unknown library item");
  if (parsed.section === toSection) return id;
  if (list(toSection, { includeHidden: true }).filter((i) => i.origin === "user").length >= MAX_USER_ITEMS) {
    throw new Error("library full");
  }
  const dir = path.join(USER_ROOT, toSection);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(parsed.file);
  let file = parsed.file;
  let n = 1;
  while (fs.existsSync(path.join(dir, file))) {
    file = path.basename(parsed.file, ext) + "-" + (++n) + ext;
  }
  fs.renameSync(from, path.join(dir, file));
  const newId = idOf("user", toSection, file);
  const index = readUserIndex();
  if (index.items[id]) {
    index.items[newId] = index.items[id];
    delete index.items[id];
    writeUserIndex(index);
  }
  return newId;
}

/* Place occupee par la bibliotheque, pour l'afficher dans les reglages.
   Les ajouts de l'utilisateur sont comptes a part du lot livre : seuls
   les premiers pesent sur son disque de donnees, et seuls eux se
   suppriment. Le disque libre est un plus, pas une garantie : il
   manque sur les anciens Node ou certains systemes de fichiers, et l'on
   n'affiche alors rien plutot qu'un chiffre faux.
   Space taken by the library, to show in the settings. The user's
   additions are counted apart from the shipped lot: only the former
   weigh on their data disk, and only they can be deleted. Free disk
   space is a bonus, not a guarantee: it is missing on old Node versions
   or some file systems, in which case nothing is shown rather than a
   wrong figure. */
function usage() {
  const out = {
    maxPerSection: MAX_USER_ITEMS,
    user: { count: 0, bytes: 0, sections: {} },
    builtin: { count: 0, bytes: 0 },
    hidden: hiddenSet().size,
    disk: null
  };
  for (const s of SECTIONS) {
    let count = 0;
    let bytes = 0;
    for (const item of listOrigin("user", s)) { count++; bytes += item.bytes || 0; }
    out.user.sections[s] = { count, bytes };
    out.user.count += count;
    out.user.bytes += bytes;
    for (const item of listOrigin("builtin", s)) { out.builtin.count++; out.builtin.bytes += item.bytes || 0; }
  }
  try {
    if (typeof fs.statfsSync === "function") {
      fs.mkdirSync(USER_ROOT, { recursive: true });
      const st = fs.statfsSync(USER_ROOT);
      out.disk = { free: Number(st.bavail) * Number(st.bsize), total: Number(st.blocks) * Number(st.bsize) };
    }
  } catch (e) { /* pas de chiffre / no figure */ }
  return out;
}

/* Chemin de la vignette d'un element, si elle existe. Le nom est
   deduit de celui de l'image (meme base, extension .jpg) plutot que lu
   dans l'index : une vignette dont le nom ne suit pas cette regle n'a
   pas ete fabriquee par scripts/library-index.js, et on ne la sert pas.
   Path to an item's thumbnail, if any. The name is derived from the
   image's (same base, .jpg extension) rather than read from the index:
   a thumbnail whose name does not follow that rule was not made by
   scripts/library-index.js, and we do not serve it. */
function thumbFileOf(id) {
  const parsed = parseId(id);
  if (!parsed) return null;
  const base = path.basename(parsed.file, path.extname(parsed.file)) + ".jpg";
  const full = path.join(rootFor(parsed.origin), parsed.section, "thumbs", base);
  return fs.existsSync(full) ? full : null;
}

/* ---------- Lot distant / remote catalogue ----------
   Le lot livre reste volontairement petit : il voyage dans l'installeur
   Windows, le .deb, le .dmg et l'archive du Pi, et chaque mega-octet y
   est paye quatre fois. Le reste vit dans un catalogue en ligne --- un
   simple JSON dans le depot --- que l'utilisateur parcourt et dont il
   telecharge, une image a la fois, ce qui l'interesse. L'image
   atterrit dans data/library/, donc du cote qui survit aux mises a
   jour : une fois recuperee, elle n'a plus besoin du reseau.

   Un JSON et des images unitaires plutot qu'une archive : Node ne sait
   pas decompresser un zip sans dependance, et surtout telecharger 200
   Mo pour trois fonds n'aurait aucun sens sur une connexion de
   campagne.

   The shipped lot stays deliberately small: it travels inside the
   Windows installer, the .deb, the .dmg and the Pi archive, and every
   megabyte is paid for four times. The rest lives in an online
   catalogue --- a plain JSON in the repository --- which the user
   browses and from which they download, one image at a time, whatever
   interests them. The image lands in data/library/, hence on the side
   that survives updates: once fetched, it no longer needs the network.

   A JSON and single images rather than an archive: Node cannot unzip
   without a dependency, and above all downloading 200 MB for three
   backgrounds would make no sense on a rural connection. */
const CATALOG_URL = "https://raw.githubusercontent.com/jihemezes/piboard/main/library-catalog.json";
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
let catalogCache = { at: 0, data: null };

async function catalog() {
  if (catalogCache.data && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(CATALOG_URL, { signal: ctrl.signal, headers: { "User-Agent": "PiBoard library" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items.filter((i) => i && i.url && isSection(i.section)) : [];
    catalogCache = { at: Date.now(), data: { items } };
    return catalogCache.data;
  } finally {
    clearTimeout(timer);
  }
}

/* Telechargement d'un element du catalogue vers data/library/. On
   verifie le type de contenu ET la taille avant d'ecrire : le
   catalogue est un fichier du depot, mais rien n'oblige a faire
   confiance a une redirection qui renverrait autre chose qu'une image.
   Downloading a catalogue item into data/library/. The content type AND
   the size are checked before writing: the catalogue is a file in the
   repository, but nothing compels us to trust a redirect returning
   something other than an image. */
async function fetchFromCatalog(entry) {
  if (!entry || !isSection(entry.section) || !/^https:\/\//.test(String(entry.url || ""))) {
    throw new Error("invalid catalog entry");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(entry.url, { signal: ctrl.signal, headers: { "User-Agent": "PiBoard library" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const type = String(res.headers.get("content-type") || "");
    if (!/^image\//.test(type)) throw new Error("not an image");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) throw new Error("file too large");
    const name = entry.file || path.basename(new URL(entry.url).pathname) || "image.jpg";
    return addUserFile(entry.section, name, buf, {
      name: entry.name,
      category: entry.category,
      tone: entry.tone,
      author: entry.author,
      license: entry.license
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Ajout par adresse web / add from a web address ----------
   Pour recuperer une image vue sur un site ou sur un NAS sans passer par
   le navigateur du poste : on colle l'adresse, le serveur la telecharge.

   GARDE-FOUS. Le serveur va chercher une adresse choisie par un
   utilisateur du reseau local, il ne faut donc pas en faire un relais
   vers ce qui n'a pas a etre atteint : seules les adresses http(s) sont
   admises, chaque redirection est reverifiee (au plus quatre), et les
   adresses de bouclage, de liaison locale (dont l'adresse des services de
   metadonnees des hebergeurs) et non routables sont refusees. Les
   adresses du reseau local (192.168.x.x...) restent permises EXPRES : un
   NAS ou un serveur domestique est une source tout a fait normale. Le
   contenu doit se declarer image ET tenir sous 20 Mo, lu par morceaux
   pour ne jamais charger en memoire plus que la limite.

   To grab an image seen on a site or on a NAS without going through the
   workstation's browser: paste the address, the server downloads it.

   SAFEGUARDS. The server fetches an address chosen by a local-network
   user, so it must not become a relay to what should stay unreachable:
   only http(s) addresses are accepted, every redirect is rechecked (four
   at most), and loopback, link-local (including cloud metadata service
   addresses) and non-routable addresses are refused. Local-network
   addresses (192.168.x.x...) stay allowed ON PURPOSE: a NAS or a home
   server is a perfectly normal source. The content must declare itself an
   image AND fit under 20 MB, read in chunks so as never to hold more than
   the limit in memory. */
const URL_MAX_BYTES = 20 * 1024 * 1024;
const URL_MAX_REDIRECTS = 4;
const TYPE_EXT = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/pjpeg": ".jpg", "image/png": ".png",
  "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg"
};

/* Vrai si l'adresse IP ne doit pas etre jointe. True if the IP must not
   be reached. */
function isBlockedIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127) return true;              // inconnue, bouclage
    if (a === 169 && b === 254) return true;            // liaison locale / metadonnees
    if (a >= 224) return true;                          // multidiffusion, reservees
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
    return false;
  }
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (/^fe[89ab]/.test(low)) return true;             // fe80::/10
    if (/^f[cd]/.test(low)) return false;               // fc00::/7 : LAN prive, permis
    const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (/^ff/.test(low)) return true;                   // multidiffusion
    return false;
  }
  return true; // pas une IP : traite en amont / not an IP: handled upstream
}

async function assertReachable(hostname, lookup) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (!host) throw new Error("invalid address");
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error("address not allowed");
    return;
  }
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new Error("address not allowed");
  }
  let found;
  try {
    found = await lookup(host, { all: true });
  } catch (e) {
    throw new Error("host not found");
  }
  const list = Array.isArray(found) ? found : [found];
  if (!list.length || list.some((a) => isBlockedIp(a && a.address))) throw new Error("address not allowed");
}

async function readCapped(res, max) {
  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > max) throw new Error("file too large");
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        try { await reader.cancel(); } catch (e) { /* ignore */ }
        throw new Error("file too large");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new Error("file too large");
  return buf;
}

/* `opts.fetch` et `opts.lookup` : remplacables pour les tests, jamais
   passes par la route. `opts.fetch` and `opts.lookup`: replaceable for
   tests, never passed by the route. */
async function addFromUrl(section, rawUrl, meta, opts) {
  if (!isSection(section)) throw new Error("unknown section");
  const doFetch = (opts && opts.fetch) || fetch;
  const lookup = (opts && opts.lookup) || ((h, o) => dns.promises.lookup(h, o));

  let url;
  try { url = new URL(String(rawUrl || "").trim()); } catch (e) { throw new Error("invalid address"); }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    let res = null;
    for (let hop = 0; hop <= URL_MAX_REDIRECTS; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid address");
      if (url.username || url.password) throw new Error("invalid address");
      await assertReachable(url.hostname, lookup);
      res = await doFetch(url.href, { signal: ctrl.signal, redirect: "manual", headers: { "User-Agent": "PiBoard library" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop === URL_MAX_REDIRECTS) throw new Error("too many redirects");
        url = new URL(res.headers.get("location"), url);
        continue;
      }
      break;
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\//.test(type)) throw new Error("not an image");
    const buf = await readCapped(res, URL_MAX_BYTES);
    if (!buf.length) throw new Error("empty file");

    // L'extension vient du nom dans l'adresse si elle est reconnue, sinon
    // du type de contenu. The extension comes from the name in the
    // address when recognised, else from the content type.
    const fromPath = decodeURIComponent(path.basename(url.pathname) || "");
    const pathExt = path.extname(fromPath).toLowerCase();
    const ext = ALLOWED_EXT.has(pathExt) ? pathExt : (TYPE_EXT[type] || "");
    if (!ext) throw new Error("unsupported file type");
    const stem = ALLOWED_EXT.has(pathExt) ? fromPath : (path.basename(fromPath, path.extname(fromPath)) || "image") + ext;
    return addUserFile(section, stem, buf, meta);
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("download timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SECTIONS,
  catalog,
  fetchFromCatalog,
  BUILTIN_ROOT,
  USER_ROOT,
  isSection,
  safeName,
  parseId,
  idOf,
  fileOf,
  thumbFileOf,
  list,
  categories,
  addUserFile,
  addFromUrl,
  removeUserFile,
  updateUserMeta,
  moveUserFile,
  usage,
  isBlockedIp,
  cleanName,
  setHidden,
  hiddenSet
};
