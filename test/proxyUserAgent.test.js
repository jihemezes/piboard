/* /api/proxy : identifiant envoye au site distant. Par defaut l'identifiant
   PiBoard ; avec ?ua=browser (liste blanche) un identifiant « compatible
   navigateur ». Un autre ua= est ignore. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-proxyua-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
process.env.PIBOARD_UPDATE_CHECK = "0";
let failed = 0;
const check = (l, c, d) => { if (c) console.log("  OK   " + l); else { failed++; console.log("  FAIL " + l + (d ? " -- " + d : "")); } };

(async () => {
  const up = http.createServer((req, res) => {
    const ua = String(req.headers["user-agent"] || "");
    if (/\+https?:/.test(ua)) { res.statusCode = 403; return res.end("forbidden"); }
    res.setHeader("Content-Type", "application/rss+xml"); res.end("<rss>" + ua + "</rss>");
  });
  await new Promise((r) => up.listen(0, "127.0.0.1", r));
  const target = "http://127.0.0.1:" + up.address().port + "/rss.xml";
  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port + "/api/proxy?url=" + encodeURIComponent(target);
  const ver = require("../package.json").version;

  let r = await fetch(BASE); 
  check("par defaut : identifiant PiBoard (ce site le refuse : 403)", r.status === 403);
  r = await fetch(BASE + "&ua=browser");
  const t = await r.text();
  check("ua=browser : accepte", r.status === 200, String(r.status));
  check("ua=browser : identifiant compatible navigateur avec la version", t.includes("Mozilla/5.0 (compatible; PiBoard/" + ver + ")"), t);
  r = await fetch(BASE + "&ua=Evil/1.0");
  check("ua libre ignore (retombe sur l'identifiant par defaut)", r.status === 403);

  up.close(); await srv.close && srv.close();
  if (failed) { console.log(failed + " echec(s)"); process.exit(1); }
  console.log("proxyUserAgent : tous les tests OK"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
