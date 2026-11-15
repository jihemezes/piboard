/* ============================================================
   PiBoard - server/photosLibrary.js
   Lecture d'une phototheque Photos (macOS) -- le paquet
   « Photos Library.photoslibrary » -- comme SOURCE d'images : diaporama
   (lecture directe) et bibliotheque d'images de PiBoard (import de
   photos choisies).

   CHOIX : LECTURE DIRECTE DU PAQUET, EN LECTURE SEULE. On ne passe ni
   par AppleScript ni par un module natif PhotoKit. PiBoard ne modifie
   jamais la phototheque : il lit des fichiers, rien de plus.

   Le paquet contient :
     originals/<0-F>/<UUID>.<ext>     les photos d'origine (HEIC, JPEG...)
     resources/derivatives/<0-F>/...  des vignettes JPEG toutes pretes
     database/Photos.sqlite           la base (favoris, albums, tailles)

   Les fichiers seuls donnent TOUTE la phototheque, sans albums ni
   favoris. La base, elle, les donne -- mais son schema n'est pas
   documente par Apple et change selon la version de macOS. D'ou :
     - la base est lue sur une COPIE (Photos la verrouille et son
       journal WAL est vivant), en lecture seule ;
     - les requetes sont TOLERANTES : on interroge les colonnes qui
       existent, jamais celles qu'on suppose ; les tables de jointure
       des albums (Z_<n>ASSETS) sont retrouvees par leur forme ;
     - si la base est illisible, la source reste utilisable : on retombe
       sur la lecture des fichiers (recentes seulement, sans filtre de
       taille ni d'album) et l'interface le dit.
   Ce schema n'a pu etre verifie que sur des phototheques de test : tout
   ecart reel se traduit par un repli, jamais par une panne.

   HEIC & co ne s'affichent pas dans un navigateur : ils sont convertis
   en JPEG par la couche plateforme (`sips`, present sur tout macOS) et
   mis en cache. Les photos trop lourdes sont reduites de la meme
   facon -- un Raspberry Pi qui affiche un diaporama n'a que faire de
   JPEG de 12 Mpx.

   Reading a Photos library (macOS) -- the "Photos Library.photoslibrary"
   package -- as an image SOURCE: slideshow (direct reading) and the
   PiBoard image library (import of chosen photos).

   CHOICE: DIRECT, READ-ONLY READING OF THE PACKAGE. Neither AppleScript
   nor a native PhotoKit module. PiBoard never modifies the library: it
   reads files, nothing more.

   Files alone give the WHOLE library, without albums or favourites. The
   database gives them -- but Apple does not document its schema and it
   changes with the macOS version. Hence:
     - the database is read from a COPY (Photos locks it and its WAL
       journal is live), read-only;
     - queries are TOLERANT: we ask for the columns that exist, never
       for those we assume; the albums' join tables (Z_<n>ASSETS) are
       found by their shape;
     - if the database is unreadable, the source stays usable: it falls
       back to reading the files (recent only, no size or album filter)
       and the interface says so.
   The schema could only be checked against test libraries: any real
   difference results in a fallback, never in a failure.

   HEIC & co do not display in a browser: they are converted to JPEG by
   the platform layer (`sips`, present on every macOS) and cached. Heavy
   photos are shrunk the same way -- a Raspberry Pi showing a slideshow
   has no use for 12 Mpx JPEGs.
   ============================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const platform = require("./platform");

const BROWSER_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const CONVERT_EXT = new Set([".heic", ".heif", ".tif", ".tiff", ".bmp"]);
const LARGE_BYTES = 6 * 1024 * 1024;
const RECENT_COUNT = 300;
const MAX_SCAN_FILES = 60000;
const DB_TTL_MS = 60 * 1000;
const CORE_DATA_EPOCH_MS = 978307200000;
const CACHE_MAX_BYTES = 400 * 1024 * 1024;
const IMPORT_MAX = 50;
const SLIDE_MAX_PX = 2560;
const IMPORT_MAX_PX = 3840;
const THUMB_PX = 320;

/* Identifiant d'une photo = « <dossier>/<fichier> » sous originals/.
   Forme stricte : c'est ce qui rend toute sortie du paquet impossible.
   A photo id = "<folder>/<file>" under originals/. Strict shape: this is
   what makes any escape from the package impossible. */
const ID_RE = /^[0-9A-Za-z]{1,3}\/[A-Za-z0-9][A-Za-z0-9 ._()-]{0,150}$/;

let cacheDir = path.join(os.tmpdir(), "piboard-photos-cache");
const dbCache = new Map();
let lastPrune = 0;

function setCacheDir(dir) { cacheDir = dir; dbCache.clear(); lastPrune = 0; }
function clearMemory() { dbCache.clear(); }

/* ---------- Reperage des phototheques / locating libraries ---------- */

function isLibraryPath(p) {
  if (typeof p !== "string" || !p || !path.isAbsolute(p)) return false;
  if (!/\.photoslibrary[\\/]?$/i.test(p)) return false;
  try {
    if (!fs.statSync(p).isDirectory()) return false;
    return fs.existsSync(path.join(p, "originals")) || fs.existsSync(path.join(p, "database"));
  } catch (e) {
    return false;
  }
}

function defaultRoots() {
  return typeof platform.photosLibraryRoots === "function" ? platform.photosLibraryRoots() : [];
}

function discoverLibraries(roots) {
  const out = [];
  for (const root of roots || defaultRoots()) {
    let names = [];
    try { names = fs.readdirSync(root); } catch (e) { continue; }
    for (const n of names.sort((a, b) => a.localeCompare(b))) {
      if (!/\.photoslibrary$/i.test(n)) continue;
      const p = path.join(root, n);
      if (!isLibraryPath(p)) continue;
      out.push({
        path: p,
        name: n.replace(/\.photoslibrary$/i, ""),
        hasDb: fs.existsSync(path.join(p, "database", "Photos.sqlite"))
      });
    }
  }
  return out;
}

/* macOS protege le contenu d'une phototheque : sans autorisation, la
   lecture echoue en EPERM/EACCES. On le distingue d'un paquet absent
   pour dire a la personne QUOI faire.
   macOS protects a library's contents: without permission the read
   fails with EPERM/EACCES. It is told apart from a missing package so
   the person is told WHAT to do. */
function checkAccess(libPath) {
  try {
    fs.readdirSync(path.join(libPath, "originals"));
    return { ok: true };
  } catch (e) {
    const code = e && e.code;
    if (code === "EPERM" || code === "EACCES") return { ok: false, reason: "permission" };
    return { ok: false, reason: "missing" };
  }
}

/* ---------- Base SQLite / database ---------- */

function tryRequireSqlite() {
  try { return require("node:sqlite"); } catch (e) { return null; }
}

function openDb(file, deps) {
  const sqlite = deps && "sqlite" in deps ? deps.sqlite : tryRequireSqlite();
  if (sqlite && sqlite.DatabaseSync) {
    const db = new sqlite.DatabaseSync(file, { readOnly: true });
    return { all: (sql) => db.prepare(sql).all(), close: () => { try { db.close(); } catch (e) { /* deja fermee */ } } };
  }
  // Repli : l'outil sqlite3 livre avec macOS. Fallback: the sqlite3 tool shipped with macOS.
  const { execFileSync } = require("child_process");
  const run = (deps && deps.sqliteCli) || ((sql) => execFileSync("sqlite3", ["-readonly", "-json", file, sql], { maxBuffer: 512 * 1024 * 1024 }).toString());
  return { all: (sql) => { const t = String(run(sql) || "").trim(); return t ? JSON.parse(t) : []; }, close: () => {} };
}

function copyDatabase(libPath) {
  const srcDir = path.join(libPath, "database");
  const dir = path.join(cacheDir, "db-" + crypto.createHash("sha1").update(libPath).digest("hex").slice(0, 10));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["Photos.sqlite", "Photos.sqlite-wal", "Photos.sqlite-shm"]) {
    const s = path.join(srcDir, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dir, f));
  }
  return { dir, file: path.join(dir, "Photos.sqlite") };
}

const SHOT_NAME_RE = /^(screenshot|screen shot|capture d[’']?écran)/i;
const SAFE_IDENT_RE = /^[A-Za-z0-9_]+$/;

function columnsOf(db, table) {
  if (!SAFE_IDENT_RE.test(table)) return [];
  try { return db.all("PRAGMA table_info(" + table + ")").map((r) => String(r.name)); } catch (e) { return []; }
}

function toAsset(r, original) {
  const dir = r.ZDIRECTORY == null ? "" : String(r.ZDIRECTORY);
  const file = r.ZFILENAME == null ? "" : String(r.ZFILENAME);
  const ext = path.extname(file).toLowerCase();
  if (!dir || !file || (!BROWSER_EXT.has(ext) && !CONVERT_EXT.has(ext))) return null;
  const id = dir + "/" + file;
  if (!ID_RE.test(id)) return null;
  if (r.ZKIND != null && Number(r.ZKIND) !== 0) return null;          // video / video
  if (Number(r.ZTRASHEDSTATE) === 1 || Number(r.ZHIDDEN) === 1) return null;
  let w = Number(r.ZWIDTH) || 0;
  let h = Number(r.ZHEIGHT) || 0;
  const o = Number(r.ZORIENTATION) || 0;
  if (o >= 5 && o <= 8) { const t = w; w = h; h = t; }
  const date = r.ZDATECREATED == null ? 0 : Math.round(Number(r.ZDATECREATED) * 1000 + CORE_DATA_EPOCH_MS);
  return {
    pk: r.Z_PK,
    id, file, ext,
    original: original || "",
    w, h,
    date: Number.isFinite(date) ? date : 0,
    fav: Number(r.ZFAVORITE) === 1,
    shot: Number(r.ZISDETECTEDSCREENSHOT) === 1 || SHOT_NAME_RE.test(original || "")
  };
}

function readAlbums(db) {
  const albums = [];
  let titles = [];
  try {
    const gc = columnsOf(db, "ZGENERICALBUM");
    if (!gc.includes("ZTITLE") || !gc.includes("ZKIND")) return albums;
    const where = gc.includes("ZTRASHEDSTATE") ? " AND (ZTRASHEDSTATE IS NULL OR ZTRASHEDSTATE=0)" : "";
    titles = db.all("SELECT Z_PK AS pk, ZTITLE AS title FROM ZGENERICALBUM WHERE ZKIND=2 AND ZTITLE IS NOT NULL" + where);
  } catch (e) { return albums; }
  if (!titles.length) return albums;
  const byPk = new Map(titles.map((t) => [t.pk, { id: String(t.pk), title: String(t.title), pks: [] }]));

  /* La table de jointure album/photo s'appelle Z_<n>ASSETS, avec une
     colonne Z_<m>ASSETS (photo) et une Z_<k>ALBUMS (album), ou n, m, k
     changent d'une version de macOS a l'autre. Plusieurs tables ont
     cette forme (souvenirs, personnes...) : on retient celle dont les
     lignes designent le plus d'albums utilisateur.
     The album/photo join table is Z_<n>ASSETS with a Z_<m>ASSETS (photo)
     and a Z_<k>ALBUMS (album) column, n, m, k changing from one macOS
     version to the next. Several tables have that shape (memories,
     people...): we keep the one whose rows designate the most user
     albums. */
  let best = null;
  try {
    const tables = db.all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => String(r.name)).filter((n) => /^Z_\d+ASSETS$/.test(n));
    for (const t of tables) {
      const cols = columnsOf(db, t);
      const a = cols.find((c) => /^Z_\d+ASSETS$/.test(c));
      const b = cols.find((c) => /^Z_\d+ALBUMS$/.test(c));
      if (!a || !b) continue;
      let rows;
      try { rows = db.all("SELECT " + b + " AS album, " + a + " AS asset FROM " + t); } catch (e) { continue; }
      const hits = rows.filter((r) => byPk.has(r.album));
      if (!best || hits.length > best.length) best = hits;
    }
  } catch (e) { return albums; }
  for (const r of best || []) byPk.get(r.album).pks.push(r.asset);
  for (const a of byPk.values()) if (a.pks.length) albums.push(a);
  return albums.sort((x, y) => x.title.localeCompare(y.title));
}

function readDatabase(libPath, deps) {
  const dbFile = path.join(libPath, "database", "Photos.sqlite");
  const st = fs.statSync(dbFile);
  let walM = 0;
  try { walM = fs.statSync(dbFile + "-wal").mtimeMs; } catch (e) { /* pas de journal */ }
  const key = libPath + "|" + st.mtimeMs + "|" + walM;
  const hit = dbCache.get(libPath);
  if (hit && hit.key === key && Date.now() - hit.at < DB_TTL_MS) return hit.data;

  const copy = copyDatabase(libPath);
  let db = null;
  try {
    db = openDb(copy.file, deps);
    const have = new Set(columnsOf(db, "ZASSET"));
    if (!have.has("ZFILENAME") || !have.has("ZDIRECTORY")) throw new Error("unsupported database");
    const wanted = ["Z_PK", "ZFILENAME", "ZDIRECTORY", "ZFAVORITE", "ZHIDDEN", "ZTRASHEDSTATE", "ZWIDTH", "ZHEIGHT",
      "ZORIENTATION", "ZDATECREATED", "ZKIND", "ZISDETECTEDSCREENSHOT"].filter((c) => have.has(c));
    const rows = db.all("SELECT " + wanted.join(",") + " FROM ZASSET");

    const originals = new Map();
    try {
      const ac = columnsOf(db, "ZADDITIONALASSETATTRIBUTES");
      if (ac.includes("ZORIGINALFILENAME")) {
        let o = [];
        if (ac.includes("ZASSET")) {
          o = db.all("SELECT ZASSET AS a, ZORIGINALFILENAME AS n FROM ZADDITIONALASSETATTRIBUTES");
        } else if (have.has("ZADDITIONALATTRIBUTES")) {
          o = db.all("SELECT z.Z_PK AS a, t.ZORIGINALFILENAME AS n FROM ZASSET z JOIN ZADDITIONALASSETATTRIBUTES t ON t.Z_PK = z.ZADDITIONALATTRIBUTES");
        }
        for (const r of o) if (r.n) originals.set(r.a, String(r.n));
      }
    } catch (e) { /* noms d'origine absents : sans gravite / original names missing: harmless */ }

    const assets = [];
    for (const r of rows) {
      const a = toAsset(r, originals.get(r.Z_PK));
      if (a) assets.push(a);
    }
    const albums = readAlbums(db);
    const data = { mode: "database", assets, albums };
    dbCache.set(libPath, { key, at: Date.now(), data });
    return data;
  } finally {
    if (db) db.close();
    try { fs.rmSync(copy.dir, { recursive: true, force: true }); } catch (e) { /* tant pis */ }
  }
}

/* Sans base : tout ce qui est sous originals/, date = date du fichier.
   Without database: everything under originals/, date = file date. */
function scanFiles(libPath) {
  const assets = [];
  const root = path.join(libPath, "originals");
  for (const dir of fs.readdirSync(root).sort()) {
    if (!/^[0-9A-Za-z]{1,3}$/.test(dir)) continue;
    let names = [];
    try { names = fs.readdirSync(path.join(root, dir)); } catch (e) { continue; }
    for (const file of names) {
      const ext = path.extname(file).toLowerCase();
      if (!BROWSER_EXT.has(ext) && !CONVERT_EXT.has(ext)) continue;
      const id = dir + "/" + file;
      if (!ID_RE.test(id)) continue;
      let date = 0;
      try { date = fs.statSync(path.join(root, dir, file)).mtimeMs; } catch (e) { continue; }
      assets.push({ pk: id, id, file, ext, original: "", w: 0, h: 0, date, fav: false, shot: false });
      if (assets.length >= MAX_SCAN_FILES) return assets;
    }
  }
  return assets;
}

function loadLibrary(libPath, deps) {
  let dbError = "";
  if (fs.existsSync(path.join(libPath, "database", "Photos.sqlite"))) {
    try { return readDatabase(libPath, deps); } catch (e) { dbError = String((e && e.message) || e); }
  } else {
    dbError = "no database";
  }
  return { mode: "files", assets: scanFiles(libPath), albums: [], dbError };
}

/* ---------- Filtrage (pur) / filtering (pure) ---------- */

function shuffled(list, rng) {
  const a = list.slice();
  const rand = rng || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function findAlbum(albums, ref) {
  const q = String(ref == null ? "" : ref).trim().toLowerCase();
  if (!q) return null;
  return albums.find((a) => a.id === q) || albums.find((a) => a.title.toLowerCase() === q) || null;
}

/* opts : source (all|favorites|recent|album), album, order
   (recent|oldest|random), orient (any|landscape|portrait), minWidth,
   noScreenshots, rng. Les photos sans dimensions connues (repli sans
   base) passent les filtres de forme et de taille.
   Photos without known dimensions (database-less fallback) pass the
   shape and size filters. */
function filterAssets(lib, opts) {
  const o = opts || {};
  let list = lib.assets;
  let albumFound = true;
  if (o.source === "favorites") {
    list = list.filter((a) => a.fav);
  } else if (o.source === "album") {
    const album = findAlbum(lib.albums || [], o.album);
    if (!album) { albumFound = false; list = []; }
    else {
      const pks = new Set(album.pks);
      list = list.filter((a) => pks.has(a.pk));
    }
  }
  if (o.noScreenshots) list = list.filter((a) => !a.shot);
  if (o.orient === "landscape") list = list.filter((a) => !(a.w && a.h) || a.w >= a.h);
  else if (o.orient === "portrait") list = list.filter((a) => !(a.w && a.h) || a.h > a.w);
  const minW = Number(o.minWidth) || 0;
  if (minW > 0) list = list.filter((a) => !(a.w && a.h) || Math.max(a.w, a.h) >= minW);

  const order = o.order === "oldest" ? "oldest" : o.order === "random" ? "random" : "recent";
  if (o.source === "recent") {
    list = list.slice().sort((a, b) => b.date - a.date).slice(0, RECENT_COUNT);
  }
  if (order === "recent") list = list.slice().sort((a, b) => b.date - a.date);
  else if (order === "oldest") list = list.slice().sort((a, b) => a.date - b.date);
  else list = shuffled(list, o.rng);
  return { items: list, albumFound };
}

/* ---------- Chemins et fichiers / paths and files ---------- */

function originalPath(libPath, id) {
  if (!ID_RE.test(String(id)) || String(id).includes("..")) throw new Error("invalid photo id");
  const base = path.resolve(libPath, "originals");
  const full = path.resolve(base, ...String(id).split("/"));
  if (!full.startsWith(base + path.sep)) throw new Error("path escape");
  return full;
}

function derivativePath(libPath, id) {
  const [dir, file] = String(id).split("/");
  const stem = path.basename(file, path.extname(file));
  for (const suffix of ["_1_105_c.jpeg", "_1_201_a.jpeg", "_4_5005_c.jpeg"]) {
    for (const p of [
      path.join(libPath, "resources", "derivatives", dir, stem + suffix),
      path.join(libPath, "resources", "derivatives", stem + suffix)
    ]) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function localFlag(lib, libPath, a) {
  if (!lib.local) lib.local = new Map();
  if (!lib.local.has(a.id)) {
    let ok = false;
    try { ok = fs.existsSync(originalPath(libPath, a.id)); } catch (e) { /* invalide */ }
    lib.local.set(a.id, ok);
  }
  return lib.local.get(a.id);
}

/* Liste paginee. Les photos dont l'original n'est pas sur ce Mac
   (« Optimiser le stockage » d'iCloud) sont ecartees : il n'y a rien a
   afficher ni a importer. `missing` dit combien.
   Paged list. Photos whose original is not on this Mac (iCloud
   "Optimise Storage") are left out: there is nothing to show or import.
   `missing` says how many. */
function list(libPath, opts, deps) {
  const lib = loadLibrary(libPath, deps);
  const { items, albumFound } = filterAssets(lib, opts);
  const here = items.filter((a) => localFlag(lib, libPath, a));
  const offset = Math.max(0, Number(opts && opts.offset) || 0);
  const limit = Math.min(2000, Math.max(1, Number(opts && opts.limit) || 120));
  return {
    mode: lib.mode,
    dbError: lib.dbError || "",
    albumFound,
    total: here.length,
    missing: items.length - here.length,
    items: here.slice(offset, offset + limit)
  };
}

function albums(libPath, deps) {
  const lib = loadLibrary(libPath, deps);
  const present = new Set(lib.assets.map((a) => a.pk));
  return {
    mode: lib.mode,
    albums: (lib.albums || []).map((a) => ({ id: a.id, title: a.title, count: a.pks.filter((p) => present.has(p)).length })).filter((a) => a.count)
  };
}

/* ---------- Conversion et cache / conversion and cache ---------- */

function pruneCache() {
  const now = Date.now();
  if (now - lastPrune < 10 * 60 * 1000) return;
  lastPrune = now;
  try {
    const files = fs.readdirSync(cacheDir).filter((n) => n.endsWith(".jpg")).map((n) => {
      const p = path.join(cacheDir, n);
      const s = fs.statSync(p);
      return { p, size: s.size, t: s.mtimeMs };
    }).sort((a, b) => a.t - b.t);
    let total = files.reduce((n, f) => n + f.size, 0);
    for (const f of files) {
      if (total <= CACHE_MAX_BYTES) break;
      try { fs.unlinkSync(f.p); total -= f.size; } catch (e) { /* tant pis */ }
    }
  } catch (e) { /* pas de cache : rien a elaguer */ }
}

async function ensureJpeg(src, key, maxPx, deps) {
  const dest = path.join(cacheDir, key + ".jpg");
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(cacheDir, { recursive: true });
  const part = path.join(cacheDir, key + ".part.jpg");
  const convert = (deps && deps.convert) || platform.imageToJpeg;
  let ok = false;
  try { ok = typeof convert === "function" ? await convert(src, part, maxPx) : false; } catch (e) { ok = false; }
  if (!ok || !fs.existsSync(part)) {
    try { fs.unlinkSync(part); } catch (e) { /* rien a retirer */ }
    return null;
  }
  fs.renameSync(part, dest);
  pruneCache();
  return dest;
}

/* Fichier a servir pour une photo : l'original quand le navigateur sait
   l'afficher et qu'il n'est pas trop lourd, sinon un JPEG reduit mis en
   cache. `max` = plus grand cote voulu (pixels) ; `thumb` = vignette.
   Renvoie { file } ou null (format non convertible ici).
   File to serve for a photo: the original when the browser can show it
   and it is not too heavy, otherwise a cached, shrunk JPEG. Returns
   { file } or null (format that cannot be converted here). */
async function servedFile(libPath, id, opts, deps) {
  const o = opts || {};
  if (o.thumb) {
    const d = derivativePath(libPath, id);
    if (d) return { file: d };
  }
  const src = originalPath(libPath, id);
  const st = fs.statSync(src);
  const ext = path.extname(src).toLowerCase();
  const max = o.thumb ? THUMB_PX : (Number(o.max) || 0);
  const heavy = max > 0 && (o.thumb || st.size > LARGE_BYTES);
  if (BROWSER_EXT.has(ext) && !heavy) return { file: src };
  if (!BROWSER_EXT.has(ext) && !CONVERT_EXT.has(ext)) return null;
  const key = crypto.createHash("sha1").update([libPath, id, st.mtimeMs, st.size, max || "full"].join("|")).digest("hex");
  const conv = await ensureJpeg(src, key, max || IMPORT_MAX_PX, deps);
  if (conv) return { file: conv };
  return BROWSER_EXT.has(ext) ? { file: src } : null;
}

/* ---------- Import dans la bibliotheque de PiBoard / import ---------- */

function labelFor(a) {
  if (a && a.original) return path.basename(a.original, path.extname(a.original));
  const d = a && a.date ? new Date(a.date).toISOString().slice(0, 10) : "";
  const stem = path.basename(a ? a.file : "photo", path.extname(a ? a.file : ""));
  return "Photo " + (d ? d + " " : "") + stem.slice(0, 6);
}

/* Copie les photos choisies dans une section de la bibliotheque PiBoard
   (fonds / logos / photos) : de ce moment, ce sont des fichiers de
   PiBoard, qui ne dependent plus de la phototheque. Une photo qui echoue
   n'arrete pas les autres.
   Copies the chosen photos into a PiBoard library section (backgrounds /
   logos / photos): from then on they are PiBoard files, no longer
   depending on the library. A failing photo does not stop the others. */
async function importAssets(libPath, ids, section, libraryMod, deps) {
  if (!libraryMod.isSection(section)) throw new Error("unknown section");
  const wanted = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String))).slice(0, IMPORT_MAX);
  if (!wanted.length) throw new Error("no photo chosen");
  const lib = loadLibrary(libPath, deps);
  const byId = new Map(lib.assets.map((a) => [a.id, a]));
  const added = [];
  const rejected = [];
  for (const id of wanted) {
    try {
      const a = byId.get(id) || { id, file: id.split("/")[1] || "photo", original: "", date: 0 };
      const served = await servedFile(libPath, id, { max: IMPORT_MAX_PX }, deps);
      if (!served) throw new Error("unsupported file type");
      const ext = path.extname(served.file).toLowerCase();
      const safeExt = BROWSER_EXT.has(ext) ? ext : ".jpg";
      const buf = fs.readFileSync(served.file);
      const name = libraryMod.cleanName(labelFor(a) + safeExt, safeExt).file;
      added.push(libraryMod.addUserFile(section, name, buf, { name: labelFor(a), author: "Photos" }));
    } catch (e) {
      rejected.push({ id, error: String((e && e.message) || e) });
    }
  }
  return { added, rejected };
}

/* ---------- Etat pour l'interface / status for the interface ---------- */

function status() {
  const supported = defaultRoots().length > 0;
  const libraries = supported ? discoverLibraries().map((l) => Object.assign({}, l, { access: checkAccess(l.path) })) : [];
  return { supported, libraries };
}

module.exports = {
  ID_RE, RECENT_COUNT, SLIDE_MAX_PX, IMPORT_MAX, THUMB_PX,
  isLibraryPath, discoverLibraries, checkAccess, status,
  loadLibrary, filterAssets, list, albums,
  originalPath, derivativePath, servedFile, importAssets, labelFor,
  setCacheDir, clearMemory, pruneCache
};
