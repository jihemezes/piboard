/* Routes /api/photos/* : serveur reel, phototheque factice passee par son
   chemin (la decouverte automatique ne vaut que sous macOS).
   /api/photos/* routes: real server, fake library given by its path (the
   automatic discovery only exists on macOS). */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-photos-routes-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
process.env.PIBOARD_UPDATE_CHECK = "0";
const { DatabaseSync } = require("node:sqlite");

const lib = path.join(tmp, "Photos Library.photoslibrary");
fs.mkdirSync(path.join(lib, "database"), { recursive: true });
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
for (const [d, f] of [["A", "AAAA1111.jpg"], ["B", "BBBB2222.jpg"]]) {
  fs.mkdirSync(path.join(lib, "originals", d), { recursive: true });
  fs.writeFileSync(path.join(lib, "originals", d, f), JPEG);
}
{
  const db = new DatabaseSync(path.join(lib, "database", "Photos.sqlite"));
  db.exec(`CREATE TABLE ZASSET (Z_PK INTEGER PRIMARY KEY, ZFILENAME TEXT, ZDIRECTORY TEXT, ZFAVORITE INTEGER, ZWIDTH INTEGER, ZHEIGHT INTEGER, ZDATECREATED REAL, ZKIND INTEGER);
    INSERT INTO ZASSET VALUES (1,'AAAA1111.jpg','A',1,4000,3000,700000000,0),(2,'BBBB2222.jpg','B',0,3000,4000,710000000,0);`);
  db.close();
}

let failed = 0;
function check(label, cond, detail) {
  if (cond) console.log("  OK   " + label);
  else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); }
}

(async () => {
  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port;
  const L = "library=" + encodeURIComponent(lib);
  const get = async (p) => { const r = await fetch(BASE + p); return { status: r.status, type: r.headers.get("content-type") || "", buf: Buffer.from(await r.arrayBuffer()) }; };
  const json = (r) => JSON.parse(r.buf.toString("utf8"));

  console.log("== Routes Photos ==");
  let r = await get("/api/photos/status");
  check("status : hors macOS, source non proposee", r.status === 200 && json(r).supported === false && json(r).libraries.length === 0, r.buf.toString());

  r = await get("/api/photos/list?" + L);
  const all = json(r);
  check("list : deux photos, plus recente d'abord", r.status === 200 && all.total === 2 && all.items[0].id === "B/BBBB2222.jpg", r.buf.toString());
  check("list : vignette et dimensions", /^\/api\/photos\/thumb\?library=/.test(all.items[0].thumb) && all.items[0].w === 3000);

  r = await get("/api/photos/list?" + L + "&source=favorites");
  check("list : favoris", json(r).items.length === 1 && json(r).items[0].id === "A/AAAA1111.jpg");

  r = await get("/api/photos/list?" + L + "&urls=1&order=oldest");
  const slide = json(r);
  check("list urls=1 : adresses de fichiers pour le diaporama",
    slide.items[0].name === "A/AAAA1111.jpg" && /^\/api\/photos\/file\?library=.*&id=A%2FAAAA1111\.jpg&max=2560$/.test(slide.items[0].url), JSON.stringify(slide.items[0]));

  r = await get(slide.items[0].url);
  check("file : l'image est servie", r.status === 200 && /image\/jpeg/.test(r.type) && r.buf.equals(JPEG));
  r = await get(all.items[0].thumb);
  check("thumb : la vignette est servie (a defaut de vignette Photos, l'original)", r.status === 200 && r.buf.length > 0);

  r = await get("/api/photos/file?" + L + "&id=" + encodeURIComponent("../../etc/passwd"));
  check("file : identifiant hors paquet refuse", r.status === 404);
  r = await get("/api/photos/file?" + L + "&id=" + encodeURIComponent("Z/none.jpg"));
  check("file : photo absente = 404", r.status === 404);
  r = await get("/api/photos/list?library=" + encodeURIComponent(tmp));
  check("list : un dossier qui n'est pas une phototheque est refuse", r.status === 400 && json(r).error === "invalid library", r.buf.toString());
  r = await get("/api/photos/list");
  check("list : sans phototheque trouvee, 404 « no library »", r.status === 404 && json(r).error === "no library", r.buf.toString());

  r = await get("/api/photos/albums?" + L);
  check("albums : liste vide sans album", r.status === 200 && json(r).albums.length === 0);

  const post = async (body) => { const x = await fetch(BASE + "/api/photos/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: x.status, body: await x.json() }; };
  let p = await post({ library: lib, section: "photos", ids: ["A/AAAA1111.jpg", "B/BBBB2222.jpg", "Z/none.jpg"] });
  check("import : deux photos ajoutees, une refusee", p.status === 200 && p.body.added.length === 2 && p.body.rejected.length === 1, JSON.stringify(p.body));
  const files = fs.readdirSync(path.join(process.env.PIBOARD_DATA, "library", "photos")).sort();
  check("import : fichiers dans data/library/photos", files.length === 2 && files.every((f) => /\.jpg$/.test(f)), files.join(","));
  p = await post({ library: lib, section: "inconnue", ids: ["A/AAAA1111.jpg"] });
  check("import : section inconnue refusee", p.status === 400 && /unknown section/.test(p.body.error));
  p = await post({ library: lib, section: "photos", ids: [] });
  check("import : rien de choisi refuse", p.status === 400);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? "\n" + failed + " echec(s)" : "\nTout est OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
