/* Routes /api/network-baseline/* et enrichissement de /api/network-scan :
   serveur reel, analyse factice (getState du module reseau remplace --
   aucun ping n'est emis). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-netbase-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
process.env.PIBOARD_UPDATE_CHECK = "0";

let failed = 0;
function check(label, cond, detail) {
  if (cond) console.log("  OK   " + label);
  else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); }
}

const networkScan = require("../server/networkScan");
const netBaseline = require("../server/netBaseline");
const base = [
  { ip: "192.168.1.2", hostname: "pi", isSelf: true, vendor: null, mac: "b8:27:eb:00:00:01" },
  { ip: "192.168.1.20", hostname: "tv", isSelf: false, vendor: null, mac: "a8:bb:cc:00:00:20" }
];
let current = base;
networkScan.getState = () => ({ scanning: false, error: null, result: current && { cidr: "192.168.1.0/24", scannedAt: "2026-11-01T10:00:00.000Z", hosts: current } });

(async () => {
  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port;
  const call = async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };

  console.log("== Reference des hotes ==");
  let r = await call("GET", "/api/network-scan");
  check("sans reference : baseline null, aucun statut", r.status === 200 && r.body.baseline === null && r.body.hosts.every((h) => h.status === null), JSON.stringify(r.body).slice(0, 200));

  r = await call("POST", "/api/network-baseline/memorize", {});
  check("memorize : 2 appareils", r.status === 200 && r.body.baseline.count === 2, JSON.stringify(r.body));

  current = base.concat([{ ip: "192.168.1.50", hostname: "intrus", isSelf: false, vendor: null, mac: "a8:bb:cc:00:00:50" }]);
  r = await call("GET", "/api/network-scan");
  const intrus = r.body.hosts.find((h) => h.ip === "192.168.1.50");
  check("nouvel hote : statut new + alerte", intrus && intrus.status === "new" && intrus.alert === true && r.body.alertCount === 1, JSON.stringify(intrus));
  check("hote connu : statut known", r.body.hosts.find((h) => h.ip === "192.168.1.20").status === "known");

  r = await call("POST", "/api/network-baseline/claim", { ids: [intrus.eventId, "pas valide"] });
  check("claim : accorde une fois", r.body.granted.length === 1 && r.body.granted[0] === intrus.eventId, JSON.stringify(r.body));
  r = await call("POST", "/api/network-baseline/claim", { ids: [intrus.eventId] });
  check("claim : pas une seconde fois", r.body.granted.length === 0);

  r = await call("POST", "/api/network-baseline/ack", { keys: [intrus.key] });
  check("ack : count passe a 3", r.status === 200 && r.body.baseline.count === 3, JSON.stringify(r.body));
  r = await call("GET", "/api/network-scan");
  check("apres ack : plus de nouvel hote", r.body.newCount === 0);

  r = await call("POST", "/api/network-baseline/forget", { keys: [intrus.key] });
  check("forget : count revient a 2", r.body.baseline.count === 2);

  r = await call("GET", "/api/network-baseline?limit=10");
  check("journal : entrees recentes d'abord", r.status === 200 && Array.isArray(r.body.log) && r.body.log.length >= 2, JSON.stringify(r.body).slice(0, 200));

  r = await call("GET", "/api/network-scan?absentHours=1&alertRandom=1");
  check("parametres absentHours / alertRandom acceptes", r.status === 200 && Array.isArray(r.body.absent));

  r = await call("DELETE", "/api/network-baseline");
  check("reset : baseline null", r.status === 200 && r.body.baseline === null);
  r = await call("POST", "/api/network-baseline/ack", { keys: [intrus.key] });
  check("ack sans reference : 400", r.status === 400);

  current = null;
  r = await call("POST", "/api/network-baseline/memorize", {});
  check("memorize sans analyse : 409", r.status === 409);

  check("persistance : data/netBaseline.json present", fs.existsSync(path.join(tmp, "data", "netBaseline.json")));

  srv.close && srv.close();
  console.log(failed ? "\n" + failed + " echec(s)" : "\nnetBaselineRoutes : tous les tests OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
