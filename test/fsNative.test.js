/* Choix d'un dossier sans taper de chemin (1.167.0) : routes reelles.
   Raccourcis, apercus, et fenetre native (simulee par un controleur de
   kiosque) reservee aux requetes locales.
   Folder choice without typing a path: real routes. Shortcuts,
   previews, and the native window (faked by a kiosk controller) for
   local requests only. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-fs-native-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
process.env.PIBOARD_UPDATE_CHECK = "0";

const pics = path.join(tmp, "pics");
fs.mkdirSync(path.join(pics, "Lib.photoslibrary", "originals"), { recursive: true });
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
fs.writeFileSync(path.join(pics, "a.jpg"), JPEG);
fs.writeFileSync(path.join(pics, "notes.txt"), "secret");
const fakeLib = path.join(pics, "Lib.photoslibrary");

let failed = 0;
function check(label, cond, detail) {
  if (cond) console.log("  OK   " + label);
  else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); }
}

(async () => {
  const platform = require("../server/platform");
  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port;
  const get = async (p) => { const r = await fetch(BASE + p); return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) }; };
  const post = async (p, body) => {
    const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };

  console.log("== Choix de dossier : routes ==");
  let r = await get("/api/fs/roots");
  let j = JSON.parse(r.buf.toString());
  check("roots : raccourcis presents (tableau)", Array.isArray(j.shortcuts) && Array.isArray(j.roots));

  r = await get("/api/fs/list?images=1&path=" + encodeURIComponent(pics));
  j = JSON.parse(r.buf.toString());
  check("list : image nommee, texte ignore", j.images.length === 1 && j.images[0].name === "a.jpg" && j.imageCount === 1);
  check("list : phototheque marquee", j.dirs.some((d) => d.name === "Lib.photoslibrary" && d.library === true));

  r = await get("/api/fs/thumb?path=" + encodeURIComponent(path.join(pics, "a.jpg")));
  check("thumb : une image est servie", r.status === 200 && r.buf.equals(JPEG));
  r = await get("/api/fs/thumb?path=" + encodeURIComponent(path.join(pics, "notes.txt")));
  check("thumb : un fichier non image est refuse", r.status === 404);
  r = await get("/api/fs/thumb?path=" + encodeURIComponent("a.jpg"));
  check("thumb : un chemin relatif est refuse", r.status === 404);
  r = await get("/api/fs/thumb?path=" + encodeURIComponent("/etc/passwd"));
  check("thumb : /etc/passwd est refuse", r.status === 404);

  r = await get("/api/fs/native");
  check("native : indisponible sans application de bureau", JSON.parse(r.buf.toString()).available === false);
  let p = await post("/api/fs/native", { kind: "folder" });
  check("native : POST refuse sans application de bureau", p.status === 404);

  let answer = { path: pics };
  let asked = null;
  platform.registerKioskController({ pickPath: async (o) => { asked = o; return answer; } });
  r = await get("/api/fs/native");
  check("native : disponible avec l'application de bureau (requete locale)", JSON.parse(r.buf.toString()).available === true);
  p = await post("/api/fs/native", { kind: "folder", start: "/x" });
  check("native : renvoie le dossier choisi", p.status === 200 && p.json.path === pics && asked.kind === "folder" && asked.start === "/x");
  answer = { cancelled: true };
  p = await post("/api/fs/native", { kind: "folder" });
  check("native : annulation transmise", p.status === 200 && p.json.cancelled === true);
  answer = { path: pics };
  p = await post("/api/fs/native", { kind: "photoslib" });
  check("native : un dossier ordinaire n'est pas une phototheque", p.status === 400 && p.json.error === "not-a-library");
  answer = { path: fakeLib };
  p = await post("/api/fs/native", { kind: "photoslib" });
  check("native : une phototheque est acceptee", p.status === 200 && p.json.path === fakeLib);
  platform.registerKioskController(null);

  await new Promise((res) => srv.server ? srv.server.close(res) : res());
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? "\n>>> " + failed + " ECHEC(S)" : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
