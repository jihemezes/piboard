/* Phototheque Photos (macOS) : lecture du paquet, base, filtres, fichiers,
   import. Aucune vraie phototheque : un paquet factice est fabrique dans un
   dossier temporaire, avec une vraie base SQLite au schema Core Data.
   Photos library (macOS): reading the package, database, filters, files,
   import. No real library: a fake package is built in a temp folder, with
   a real SQLite database in the Core Data schema. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-photos-test-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
const photos = require("../server/photosLibrary");
const library = require("../server/library");
photos.setCacheDir(path.join(tmp, "cache"));

const { DatabaseSync } = require("node:sqlite");

/* ---------- Fabrication du paquet / building the package ---------- */
const root = path.join(tmp, "Pictures");
const lib = path.join(root, "Photos Library.photoslibrary");
fs.mkdirSync(path.join(lib, "database"), { recursive: true });
function put(rel, size) {
  const full = path.join(lib, "originals", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.alloc(size || 64, 7));
}
// pk, fichier, dossier, fav, w, h, date(Core Data), kind, trashed, hidden, orientation, screenshot, nom d'origine
const ROWS = [
  [1, "AAAA1111.jpg", "A", 1, 4000, 3000, 700000000, 0, 0, 0, 1, 0, "IMG_0001.JPG"],
  [2, "BBBB2222.heic", "B", 0, 3000, 4000, 710000000, 0, 0, 0, 1, 0, "IMG_0002.HEIC"],
  [3, "CCCC3333.png", "C", 0, 1170, 2532, 720000000, 0, 0, 0, 1, 1, "Screenshot 2024.png"],
  [4, "DDDD4444.mov", "D", 0, 1920, 1080, 730000000, 1, 0, 0, 1, 0, "VID_0004.MOV"],
  [5, "EEEE5555.jpg", "E", 0, 800, 600, 740000000, 0, 1, 0, 1, 0, "IMG_0005.JPG"],
  [6, "FFFF6666.jpg", "F", 0, 800, 600, 750000000, 0, 0, 1, 1, 0, "IMG_0006.JPG"],
  [7, "0000AAAA.jpg", "0", 1, 6000, 4000, 760000000, 0, 0, 0, 6, 0, "IMG_0007.JPG"],   // orientation 6 : pivotee
  [8, "1111BBBB.jpg", "1", 0, 2000, 1500, 770000000, 0, 0, 0, 1, 0, "IMG_0008.JPG"],   // original absent
  [9, "2222CCCC.jpg", "2", 0, 1600, 1200, 780000000, 0, 0, 0, 1, 0, "IMG_0009.JPG"]
];
{
  const db = new DatabaseSync(path.join(lib, "database", "Photos.sqlite"));
  db.exec(`CREATE TABLE ZASSET (Z_PK INTEGER PRIMARY KEY, ZFILENAME TEXT, ZDIRECTORY TEXT, ZFAVORITE INTEGER, ZWIDTH INTEGER, ZHEIGHT INTEGER, ZDATECREATED REAL, ZKIND INTEGER, ZTRASHEDSTATE INTEGER, ZHIDDEN INTEGER, ZORIENTATION INTEGER, ZISDETECTEDSCREENSHOT INTEGER);
    CREATE TABLE ZADDITIONALASSETATTRIBUTES (Z_PK INTEGER PRIMARY KEY, ZASSET INTEGER, ZORIGINALFILENAME TEXT);
    CREATE TABLE ZGENERICALBUM (Z_PK INTEGER PRIMARY KEY, ZTITLE TEXT, ZKIND INTEGER, ZTRASHEDSTATE INTEGER);
    CREATE TABLE Z_26ASSETS (Z_3ASSETS INTEGER, Z_26ALBUMS INTEGER);
    CREATE TABLE Z_40ASSETS (Z_3ASSETS INTEGER, Z_39MEMORIES INTEGER);
    CREATE TABLE Z_41ASSETS (Z_3ASSETS INTEGER, Z_41ALBUMS INTEGER);`);
  const ins = db.prepare("INSERT INTO ZASSET VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  const att = db.prepare("INSERT INTO ZADDITIONALASSETATTRIBUTES (ZASSET, ZORIGINALFILENAME) VALUES (?,?)");
  for (const r of ROWS) {
    ins.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]);
    att.run(r[0], r[12]);
  }
  for (const [pk, t, k, tr] of [[10, "Vacances", 2, 0], [11, "Famille", 2, 0], [12, "Supprime", 2, 1], [13, "Dossier", 4000, 0]]) {
    db.prepare("INSERT INTO ZGENERICALBUM VALUES (?,?,?,?)").run(pk, t, k, tr);
  }
  const join = db.prepare("INSERT INTO Z_26ASSETS VALUES (?,?)");
  for (const [a, al] of [[1, 10], [2, 10], [7, 10], [9, 11], [8, 11], [5, 12]]) join.run(a, al);
  db.prepare("INSERT INTO Z_41ASSETS VALUES (?,?)").run(1, 10); // leurre moins fourni / sparser decoy
  db.prepare("INSERT INTO Z_40ASSETS VALUES (?,?)").run(3, 99); // leurre « souvenirs » / "memories" decoy
  db.close();
}
for (const r of ROWS) if (r[0] !== 8) put(r[2] + "/" + r[1], r[1].startsWith("0000") ? 7 * 1024 * 1024 : 64);

function ids(list) { return list.map((a) => a.id); }

/* ---------- Reperage / locating ---------- */
console.log("== Photos : reperage des phototheques ==");
{
  assert.strictEqual(photos.isLibraryPath(lib), true);
  assert.strictEqual(photos.isLibraryPath(root), false, "un dossier quelconque n'est pas une phototheque");
  assert.strictEqual(photos.isLibraryPath("relatif.photoslibrary"), false, "chemin absolu exige");
  assert.strictEqual(photos.isLibraryPath(42), false);
  const found = photos.discoverLibraries([root, path.join(tmp, "inexistant")]);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].name, "Photos Library");
  assert.strictEqual(found[0].hasDb, true);
  assert.deepStrictEqual(photos.checkAccess(lib), { ok: true });
  assert.strictEqual(photos.checkAccess(path.join(tmp, "nope")).reason, "missing");
  console.log("  OK");
}

/* ---------- Base de donnees / database ---------- */
console.log("== Photos : lecture de la base (photos, favoris, albums, tailles) ==");
let data;
{
  data = photos.loadLibrary(lib);
  assert.strictEqual(data.mode, "database");
  // 9 lignes : video, corbeille et masquee ecartees -> 6 photos
  assert.deepStrictEqual(ids(data.assets).sort(), ["0/0000AAAA.jpg", "1/1111BBBB.jpg", "2/2222CCCC.jpg", "A/AAAA1111.jpg", "B/BBBB2222.heic", "C/CCCC3333.png"]);
  const a7 = data.assets.find((a) => a.pk === 7);
  assert.strictEqual(a7.w, 4000, "orientation 6 : largeur et hauteur echangees");
  assert.strictEqual(a7.h, 6000);
  assert.strictEqual(data.assets.find((a) => a.pk === 1).date, Math.round(700000000 * 1000 + 978307200000), "date Core Data convertie");
  assert.strictEqual(data.assets.find((a) => a.pk === 1).original, "IMG_0001.JPG");
  assert.strictEqual(data.assets.find((a) => a.pk === 3).shot, true, "capture d'ecran detectee");
  assert.strictEqual(data.assets.find((a) => a.pk === 1).fav, true);
  const titles = data.albums.map((a) => a.title);
  assert.deepStrictEqual(titles, ["Famille", "Vacances"], "albums utilisateur seulement (ni corbeille ni dossier), tries");
  const vac = data.albums.find((a) => a.title === "Vacances");
  assert.deepStrictEqual(vac.pks.slice().sort((x, y) => x - y), [1, 2, 7], "la bonne table de jointure est retenue, pas les leurres");
  console.log("  OK");
}

console.log("== Photos : albums et liste (originaux absents ecartes) ==");
{
  const al = photos.albums(lib);
  assert.strictEqual(al.mode, "database");
  assert.deepStrictEqual(al.albums.map((a) => a.title + ":" + a.count), ["Famille:2", "Vacances:3"]);
  const all = photos.list(lib, { limit: 100 });
  assert.strictEqual(all.total, 5, "6 photos moins l'original absent (iCloud)");
  assert.strictEqual(all.missing, 1);
  assert.strictEqual(all.items[0].id, "2/2222CCCC.jpg", "plus recentes d'abord");
  const page = photos.list(lib, { limit: 2, offset: 1 });
  assert.strictEqual(page.items.length, 2);
  assert.strictEqual(page.total, 5);
  console.log("  OK");
}

console.log("== Photos : selection (albums + photos - ecartees) ==");
{
  const f = (o) => ids(photos.filterAssets(data, Object.assign({ source: "selection", order: "oldest" }, o)).items);
  const vac = data.albums.find((a) => a.title === "Vacances");
  const fam = data.albums.find((a) => a.title === "Famille");
  assert.deepStrictEqual(f({ selection: "" }), [], "selection vide : aucune photo");
  assert.deepStrictEqual(f({ selection: { albums: [], include: [], exclude: ["A/AAAA1111.jpg"] } }), [], "seulement des ecartees : rien");
  assert.deepStrictEqual(f({ selection: { albums: [{ id: vac.id, title: vac.title }] } }), ["A/AAAA1111.jpg", "B/BBBB2222.heic", "0/0000AAAA.jpg"], "album entier");
  assert.deepStrictEqual(f({ selection: { albums: [{ id: vac.id, title: "Vacances" }], exclude: ["B/BBBB2222.heic"] } }), ["A/AAAA1111.jpg", "0/0000AAAA.jpg"], "tout l'album sauf une photo");
  assert.deepStrictEqual(f({ selection: { albums: [vac.title], include: ["C/CCCC3333.png"], exclude: ["A/AAAA1111.jpg"] } }), ["B/BBBB2222.heic", "C/CCCC3333.png", "0/0000AAAA.jpg"], "album + photo ajoutee - ecartee, album donne par titre seul");
  assert.deepStrictEqual(f({ selection: { albums: [{ id: "999", title: "vacances" }] } }), ["A/AAAA1111.jpg", "B/BBBB2222.heic", "0/0000AAAA.jpg"], "le numero interne a change : le titre fait foi");
  assert.deepStrictEqual(f({ selection: { albums: [{ id: "999", title: "Disparu" }] } }), [], "album disparu ignore");
  assert.deepStrictEqual(f({ selection: { include: ["../../etc/passwd", "A/AAAA1111.jpg"] } }), ["A/AAAA1111.jpg"], "identifiant invalide ecarte");
  assert.deepStrictEqual(f({ selection: JSON.stringify({ albums: [{ id: fam.id, title: "Famille" }] }) }), ["1/1111BBBB.jpg", "2/2222CCCC.jpg"], "selection donnee en JSON");
  assert.deepStrictEqual(f({ selection: { albums: [{ id: vac.id, title: "Vacances" }] }, orient: "portrait" }), ["B/BBBB2222.heic", "0/0000AAAA.jpg"], "les filtres s'appliquent ensuite");

  // list() : drapeaux sel / cov et total retenu (originaux locaux seulement)
  const l = photos.list(lib, { source: "all", limit: 100, selection: { albums: [{ id: vac.id, title: "Vacances" }], include: ["2/2222CCCC.jpg"], exclude: ["A/AAAA1111.jpg"] } });
  const by = Object.fromEntries(l.items.map((i) => [i.id, i]));
  assert.strictEqual(by["A/AAAA1111.jpg"].sel, false);
  assert.strictEqual(by["A/AAAA1111.jpg"].cov, true, "ecartee mais couverte par l'album");
  assert.strictEqual(by["B/BBBB2222.heic"].sel, true);
  assert.strictEqual(by["2/2222CCCC.jpg"].sel, true);
  assert.strictEqual(by["2/2222CCCC.jpg"].cov, false, "ajoutee a la main");
  assert.strictEqual(by["C/CCCC3333.png"].sel, false);
  assert.strictEqual(l.selTotal, 3, "B, 0 (album) + 2 (ajoutee)");
  assert.strictEqual(photos.list(lib, { limit: 5 }).selTotal, undefined, "sans selection, pas de total");
  console.log("  OK");
}

console.log("== Photos : filtres ==");
{
  const f = (o) => ids(photos.filterAssets(data, o).items);
  assert.deepStrictEqual(f({ source: "favorites", order: "oldest" }), ["A/AAAA1111.jpg", "0/0000AAAA.jpg"]);
  assert.deepStrictEqual(f({ source: "album", album: "vacances", order: "oldest" }), ["A/AAAA1111.jpg", "B/BBBB2222.heic", "0/0000AAAA.jpg"], "titre sans casse");
  assert.deepStrictEqual(f({ source: "album", album: String(data.albums.find((a) => a.title === "Famille").id) }).sort(), ["1/1111BBBB.jpg", "2/2222CCCC.jpg"], "ou par identifiant");
  assert.strictEqual(photos.filterAssets(data, { source: "album", album: "Inconnu" }).albumFound, false);
  assert.deepStrictEqual(f({ source: "album", album: "Inconnu" }), []);
  assert.ok(!f({ noScreenshots: true }).includes("C/CCCC3333.png"), "captures d'ecran exclues");
  assert.ok(f({}).includes("C/CCCC3333.png"));
  assert.deepStrictEqual(f({ orient: "portrait", order: "oldest" }), ["B/BBBB2222.heic", "C/CCCC3333.png", "0/0000AAAA.jpg"]);
  assert.ok(!f({ orient: "landscape" }).includes("B/BBBB2222.heic"));
  assert.deepStrictEqual(f({ minWidth: 3500, order: "oldest" }), ["A/AAAA1111.jpg", "B/BBBB2222.heic", "0/0000AAAA.jpg"], "plus grand cote >= 3500");
  const recent = photos.filterAssets(data, { source: "recent" }).items;
  assert.strictEqual(recent.length, 6);
  assert.ok(recent[0].date >= recent[recent.length - 1].date);
  const rngA = ids(photos.filterAssets(data, { order: "random", rng: () => 0.1 }).items);
  const rngB = ids(photos.filterAssets(data, { order: "random", rng: () => 0.1 }).items);
  assert.deepStrictEqual(rngA, rngB, "ordre aleatoire reproductible avec le meme generateur");
  assert.strictEqual(rngA.length, 6);
  assert.deepStrictEqual(rngA.slice().sort(), f({}).sort(), "mele sans perdre ni dupliquer");
  console.log("  OK");
}

console.log("== Photos : sans base ou base illisible, repli sur les fichiers ==");
{
  const lib2 = path.join(tmp, "B", "Autre.photoslibrary");
  fs.mkdirSync(path.join(lib2, "originals", "A"), { recursive: true });
  fs.writeFileSync(path.join(lib2, "originals", "A", "X1.jpg"), "a");
  fs.writeFileSync(path.join(lib2, "originals", "A", "X2.heic"), "b");
  fs.writeFileSync(path.join(lib2, "originals", "A", "X3.mov"), "c");
  fs.writeFileSync(path.join(lib2, "originals", "A", "notes.txt"), "d");
  const none = photos.loadLibrary(lib2);
  assert.strictEqual(none.mode, "files");
  assert.deepStrictEqual(ids(none.assets).sort(), ["A/X1.jpg", "A/X2.heic"], "images seulement");
  fs.mkdirSync(path.join(lib2, "database"));
  fs.writeFileSync(path.join(lib2, "database", "Photos.sqlite"), "pas une base");
  const bad = photos.loadLibrary(lib2);
  assert.strictEqual(bad.mode, "files");
  assert.ok(bad.dbError, "la raison du repli est donnee");
  const out = photos.list(lib2, { source: "favorites" });
  assert.strictEqual(out.total, 0, "sans base, pas de favoris");
  assert.strictEqual(photos.list(lib2, { orient: "portrait", minWidth: 4000 }).total, 2, "sans dimensions, les filtres de forme ne rejettent rien");
  console.log("  OK");
}

console.log("== Photos : un schema inattendu se solde par un repli, pas par une panne ==");
{
  const lib3 = path.join(tmp, "C", "Neuf.photoslibrary");
  fs.mkdirSync(path.join(lib3, "database"), { recursive: true });
  fs.mkdirSync(path.join(lib3, "originals", "A"), { recursive: true });
  fs.writeFileSync(path.join(lib3, "originals", "A", "Z.jpg"), "a");
  const db = new DatabaseSync(path.join(lib3, "database", "Photos.sqlite"));
  db.exec("CREATE TABLE ZASSET (Z_PK INTEGER PRIMARY KEY, AUTRE TEXT)");
  db.close();
  const r = photos.loadLibrary(lib3);
  assert.strictEqual(r.mode, "files");
  assert.match(r.dbError, /unsupported/);
  console.log("  OK");
}

/* ---------- Chemins / paths ---------- */
console.log("== Photos : un identifiant ne peut pas sortir du paquet ==");
{
  for (const bad of ["../x.jpg", "A/../../etc/passwd", "A/b/c.jpg", "/etc/passwd", "A\\x.jpg", ".hidden/x.jpg", "A/.x.jpg", "", "A/x.jpg/.."]) {
    assert.throws(() => photos.originalPath(lib, bad), /invalid photo id|path escape/, "refuse : " + bad);
  }
  assert.ok(photos.originalPath(lib, "A/AAAA1111.jpg").endsWith(path.join("originals", "A", "AAAA1111.jpg")));
  console.log("  OK");
}

/* ---------- Fichiers servis / served files ---------- */
(async () => {
  console.log("== Photos : fichiers servis, conversion et cache ==");
  let conversions = 0;
  const convert = async (src, dest, px) => { conversions++; fs.writeFileSync(dest, "jpeg:" + px); return true; };
  const deps = { convert };

  let r = await photos.servedFile(lib, "A/AAAA1111.jpg", {}, deps);
  assert.strictEqual(r.file, photos.originalPath(lib, "A/AAAA1111.jpg"), "un JPEG leger est servi tel quel");
  assert.strictEqual(conversions, 0);

  r = await photos.servedFile(lib, "B/BBBB2222.heic", {}, deps);
  assert.ok(r.file.startsWith(path.join(tmp, "cache")) && r.file.endsWith(".jpg"), "le HEIC est converti en JPEG dans le cache");
  assert.strictEqual(conversions, 1);
  await photos.servedFile(lib, "B/BBBB2222.heic", {}, deps);
  assert.strictEqual(conversions, 1, "deuxieme demande : servi depuis le cache");

  r = await photos.servedFile(lib, "0/0000AAAA.jpg", { max: 2560 }, deps);
  assert.strictEqual(fs.readFileSync(r.file, "utf8"), "jpeg:2560", "un JPEG lourd est reduit quand on demande une taille");
  r = await photos.servedFile(lib, "0/0000AAAA.jpg", {}, deps);
  assert.strictEqual(r.file, photos.originalPath(lib, "0/0000AAAA.jpg"), "sans taille demandee, l'original");

  r = await photos.servedFile(lib, "B/BBBB2222.heic", {}, { convert: async () => false });
  assert.strictEqual(r.file.endsWith(".jpg"), true, "deja en cache : pas de nouvelle conversion");
  photos.setCacheDir(path.join(tmp, "cache2"));
  assert.strictEqual(await photos.servedFile(lib, "B/BBBB2222.heic", {}, { convert: async () => false }), null, "HEIC sans convertisseur : rien a servir");
  r = await photos.servedFile(lib, "0/0000AAAA.jpg", { max: 2560 }, { convert: async () => false });
  assert.strictEqual(r.file, photos.originalPath(lib, "0/0000AAAA.jpg"), "JPEG lourd sans convertisseur : l'original plutot que rien");
  photos.setCacheDir(path.join(tmp, "cache"));

  // vignette fournie par Photos / thumbnail supplied by Photos
  const der = path.join(lib, "resources", "derivatives", "A");
  fs.mkdirSync(der, { recursive: true });
  fs.writeFileSync(path.join(der, "AAAA1111_1_105_c.jpeg"), "thumb");
  assert.strictEqual(photos.derivativePath(lib, "A/AAAA1111.jpg"), path.join(der, "AAAA1111_1_105_c.jpeg"));
  r = await photos.servedFile(lib, "A/AAAA1111.jpg", { thumb: true }, deps);
  assert.strictEqual(fs.readFileSync(r.file, "utf8"), "thumb", "vignette de Photos reutilisee");
  r = await photos.servedFile(lib, "2/2222CCCC.jpg", { thumb: true }, deps);
  assert.strictEqual(fs.readFileSync(r.file, "utf8"), "jpeg:320", "sinon vignette fabriquee");
  await assert.rejects(() => photos.servedFile(lib, "1/1111BBBB.jpg", {}, deps), /ENOENT/, "original absent : erreur nette");
  photos.pruneCache();
  console.log("  OK");

  /* ---------- Import ---------- */
  console.log("== Photos : import dans la bibliotheque PiBoard ==");
  const out = await photos.importAssets(lib, ["A/AAAA1111.jpg", "B/BBBB2222.heic", "1/1111BBBB.jpg", "A/AAAA1111.jpg"], "photos", library, deps);
  assert.strictEqual(out.added.length, 2, "doublon ignore, original absent refuse");
  assert.strictEqual(out.rejected.length, 1);
  assert.strictEqual(out.rejected[0].id, "1/1111BBBB.jpg");
  const items = library.list("photos", {}).filter((i) => i.origin === "user");
  assert.strictEqual(items.length, 2);
  const names = items.map((i) => i.file).sort();
  assert.deepStrictEqual(names, ["IMG_0001.jpg", "IMG_0002.jpg"], "nom d'origine conserve, HEIC devenu .jpg");
  assert.ok(items.every((i) => /^IMG_000/.test(i.name || i.file)));
  const written = fs.readFileSync(path.join(library.USER_ROOT, "photos", "IMG_0002.jpg"), "utf8");
  assert.strictEqual(written, "jpeg:3840", "le HEIC importe est reduit a 3840 px");
  await assert.rejects(() => photos.importAssets(lib, ["A/AAAA1111.jpg"], "inconnue", library, deps), /unknown section/);
  await assert.rejects(() => photos.importAssets(lib, [], "photos", library, deps), /no photo chosen/);
  const many = Array.from({ length: 80 }, (_, i) => "A/NOPE" + i + ".jpg");
  const lim = await photos.importAssets(lib, many, "photos", library, deps);
  assert.strictEqual(lim.rejected.length, photos.IMPORT_MAX, "50 photos au plus par demande");
  assert.strictEqual(photos.labelFor({ original: "IMG_9.HEIC" }), "IMG_9");
  assert.match(photos.labelFor({ file: "ABCDEF123.jpg", date: Date.UTC(2024, 4, 12) }), /^Photo 2024-05-12 ABCDEF$/);
  console.log("  OK");

  /* ---------- Plateformes ---------- */
  console.log("== Photos : fonction propre a macOS, absente ailleurs ==");
  const platform = require("../server/platform");
  for (const n of ["linux", "win32"]) {
    const impl = platform.implementations[n]();
    assert.deepStrictEqual(impl.photosLibraryRoots(), [], n + " : aucune racine, source jamais proposee");
    assert.strictEqual(await impl.imageToJpeg("a", "b", 100), false);
  }
  const mac = platform.implementations.darwin();
  assert.ok(mac.photosLibraryRoots()[0].endsWith("Pictures"));
  console.log("  OK");

  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
