/* Routes /api/network-registry/* (1.181.0) : serveur reel, analyse factice. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-netreg-"));
process.env.PIBOARD_DATA = path.join(tmp, "data");
process.env.PIBOARD_UPDATE_CHECK = "0";
fs.mkdirSync(process.env.PIBOARD_DATA, { recursive: true });
// Noms deja saisis avant la mise a jour / names typed before the update
fs.writeFileSync(path.join(process.env.PIBOARD_DATA, "netHosts.json"), JSON.stringify({ aliases: {
  "mac:a8:bb:cc:00:00:20": { name: "TV salon", updatedAt: "2026-10-01T10:00:00.000Z" },
  "mac:a8:bb:cc:00:00:99": { name: "Imprimante (eteinte)", updatedAt: "2026-10-01T10:00:00.000Z" }
} }));

let failed = 0;
const check = (label, cond, detail) => { if (cond) console.log("  OK   " + label); else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); } };

const networkScan = require("../server/networkScan");
const hosts = [
  { ip: "192.168.1.1", hostname: "box", isSelf: false, vendor: null, mac: "aa:aa:aa:00:00:01" },
  { ip: "192.168.1.2", hostname: "pi", isSelf: true, vendor: null, mac: "b8:27:eb:00:00:01" },
  { ip: "192.168.1.20", hostname: null, isSelf: false, vendor: "Samsung", mac: "a8:bb:cc:00:00:20" }
];
networkScan.getState = () => ({ scanning: false, error: null, result: { cidr: "192.168.1.0/24", gateway: { ip: "192.168.1.1", mac: "aa:aa:aa:00:00:01" }, scannedAt: "2026-11-01T10:00:00.000Z", hosts } });

(async () => {
  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port;
  const call = async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    let b; try { b = JSON.parse(txt); } catch (e) { b = txt; }
    return { status: r.status, body: b, headers: r.headers };
  };

  let r = await call("GET", "/api/network-registry");
  check("noms existants repris dans le referentiel", r.status === 200 && r.body.count === 2, JSON.stringify(r.body));
  r = await call("POST", "/api/network-baseline/memorize", {});
  check("memorisation cumulative", r.status === 200 && r.body.baseline.count === 4 && r.body.added === 2, JSON.stringify(r.body));
  r = await call("GET", "/api/network-scan");
  const tv = r.body.hosts.find((h) => h.mac === "a8:bb:cc:00:00:20");
  check("la tuile voit la fiche", tv && tv.alias === "TV salon" && tv.reg && tv.status === "known", JSON.stringify(tv));
  await call("POST", "/api/network-baseline/memorize", {});
  r = await call("GET", "/api/network-scan");
  check("reseau courant sans nom", r.body.network && r.body.network.id === "gw:aa:aa:aa:00:00:01" && r.body.network.name === null, JSON.stringify(r.body.network));
  r = await call("POST", "/api/network-registry/network", { id: "gw:aa:aa:aa:00:00:01", name: "Maison" });
  check("nommer le reseau", r.status === 200);
  r = await call("POST", "/api/network-registry/device", { key: "mac:a8:bb:cc:00:00:20", fields: { type: "tv", owner: "Famille", trusted: true } });
  check("champs de la fiche", r.status === 200);
  r = await call("POST", "/api/network-hosts", { mac: "a8:bb:cc:00:00:20", name: "Télé du salon" });
  r = await call("GET", "/api/network-registry/export");
  const file = r.body;
  check("export du referentiel", r.status === 200 && file.format === "piboard-network-registry" && /attachment/.test(r.headers.get("content-disposition") || ""));
  check("renommage repris dans le referentiel", file.devices["mac:a8:bb:cc:00:00:20"].fields.name.v === "Télé du salon");
  check("nom du reseau exporte", file.networks["gw:aa:aa:aa:00:00:01"].name.v === "Maison");

  // Fichier d'un autre PiBoard / another PiBoard's file
  const other = JSON.parse(JSON.stringify(file));
  other.from = { id: "pb-0123456789ab", name: "PC bureau" };
  other.devices["mac:a8:bb:cc:00:00:20"].fields.owner = { v: "Salon", at: "2026-11-02T10:00:00.000Z", by: "pb-0123456789ab", bases: [] };
  other.devices["mac:c0:ff:ee:00:00:01"] = { mac: "c0:ff:ee:00:00:01", vendor: "HP", fields: { name: { v: "Imprimante bureau", at: "2026-11-02T10:00:00.000Z", by: "pb-0123456789ab", bases: [] } }, seenBy: { "pb-0123456789ab": { name: "PC bureau", at: "2026-11-02T10:00:00.000Z" } } };
  r = await call("POST", "/api/network-registry/preview", other);
  check("apercu : un ajout, un conflit", r.status === 200 && r.body.added.length === 1 && r.body.conflicts.length === 1 && r.body.from.name === "PC bureau", JSON.stringify(r.body).slice(0, 300));
  const cid = r.body.conflicts[0].id;
  r = await call("POST", "/api/network-registry/merge", { file: other, choices: { [cid]: "local" } });
  check("fusion appliquee", r.status === 200 && r.body.report.added === 1, JSON.stringify(r.body));
  r = await call("GET", "/api/network-hosts");
  check("nom recu ecrit dans netHosts.json", r.body.aliases["mac:c0:ff:ee:00:00:01"].name === "Imprimante bureau");
  r = await call("POST", "/api/network-registry/preview", { format: "nope" });
  check("fichier invalide refuse", r.status === 400);

  r = await fetch(BASE + "/api/network-hosts/export.csv");
  const csv = await r.text();
  check("CSV enrichi", /type_appareil/.test(csv) && /Famille/.test(csv) && /Maison/.test(csv), csv.slice(0, 300));
  r = await fetch(BASE + "/api/network-hosts/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: "type;identifiant;nom;proprietaire;notes\nmac;a8:bb:cc:00:00:20;;Moi;Dans le salon\n" });
  const imp = await r.json();
  check("CSV relu : champs des fiches", r.status === 200 && imp.fieldsUpdated === 1, JSON.stringify(imp));

  srv.server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `\n${failed} ECHEC(S)` : "\nnetRegistryRoutes : tous les tests OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
