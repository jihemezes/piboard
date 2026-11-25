/* IPv6 dans la tuile Etat systeme (1.178.0) : module serveur (types
   d'adresses, prefixe, adresses temporaires lues dans ip / ifconfig /
   netsh), IP publique IPv6, et affichage dans la tuile (familles,
   masquage, pastille, copie au toucher). */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const v6 = require("../server/ipv6Info");
const { parseIpResponse } = require("../server/publicIp");
const netConfig = require("../server/netConfig");

(async () => {
  console.log("== Adresses ==");
  assert.strictEqual(v6.normalize("2A01:0E0A:0000:0000:0000:0000:0000:0001"), "2a01:e0a::1");
  assert.strictEqual(v6.kindOf("2a01:e0a::1"), "global");
  assert.strictEqual(v6.kindOf("fd12:3456::1"), "ula");
  assert.strictEqual(v6.kindOf("fe80::1%eth0"), "link");
  assert.strictEqual(v6.kindOf("::1"), "loopback");
  assert.strictEqual(v6.kindOf("192.168.1.1"), null);
  assert.strictEqual(v6.prefixOf("2a01:e0a:1f3:c4d0:5c3f:aa:bb:cc", 64), "2a01:e0a:1f3:c4d0::/64");
  assert.strictEqual(v6.prefixOf("2a01:e0a:1f3:c4d0::1", 56), "2a01:e0a:1f3:c400::/56");
  assert.strictEqual(v6.netmaskLen("ffff:ffff:ffff:ffff::"), 64);
  console.log("  OK");

  console.log("== Adresses temporaires ==");
  let f = v6.parseIpAddrLinux("2: eth0    inet6 2a01:e0a::5c3f/64 scope global temporary dynamic \\       valid_lft 86000sec\n2: eth0    inet6 2a01:e0a::1/64 scope global dynamic mngtmpaddr \\ \n2: eth0    inet6 2a01:e0a::9/64 scope global temporary deprecated dynamic");
  assert.deepStrictEqual(f.get("2a01:e0a::5c3f"), { temporary: true, deprecated: false });
  assert.deepStrictEqual(f.get("2a01:e0a::1"), { temporary: false, deprecated: false });
  assert.strictEqual(f.get("2a01:e0a::9").deprecated, true);
  f = v6.parseIfconfigDarwin("\tinet6 fe80::1%en0 prefixlen 64 secured scopeid 0x6\n\tinet6 2a01:e0a::abcd prefixlen 64 autoconf temporary\n\tinet6 2a01:e0a::1 prefixlen 64 autoconf secured");
  assert.ok(f.get("2a01:e0a::abcd").temporary && !f.get("2a01:e0a::1").temporary && f.has("fe80::1"));
  f = v6.parseNetshWin("Type adresse  État DAD  Durée vie valide  Durée vie préférée  Adresse\n---------  ---------  ------  ------  ------\nPublique   Préféré    6j23h   23h59m  2a01:e0a::1\nTemporaire Préféré    6j23h   23h59m  2a01:e0a::77\nAutre      Préféré    infini  infini  fe80::1%12");
  assert.ok(f.get("2a01:e0a::77").temporary && !f.get("2a01:e0a::1").temporary);
  console.log("  OK");

  console.log("== Carte reseau ==");
  const raw = { eth0: [
    { address: "192.168.1.20", family: "IPv4", internal: false, mac: "a8:bb:cc:00:00:01", netmask: "255.255.255.0", cidr: "192.168.1.20/24" },
    { address: "fe80::1", family: "IPv6", internal: false, mac: "a8:bb:cc:00:00:01", cidr: "fe80::1/64" },
    { address: "2a01:e0a:1f3:c4d0::77", family: "IPv6", internal: false, mac: "a8:bb:cc:00:00:01", cidr: "2a01:e0a:1f3:c4d0::77/64" },
    { address: "2a01:e0a:1f3:c4d0::1", family: "IPv6", internal: false, mac: "a8:bb:cc:00:00:01", cidr: "2a01:e0a:1f3:c4d0::1/64" },
    { address: "fd00::20", family: "IPv6", internal: false, mac: "a8:bb:cc:00:00:01", cidr: "fd00::20/64" }
  ] };
  const flags = new Map([["2a01:e0a:1f3:c4d0::77", { temporary: true, deprecated: false }]]);
  const [a] = netConfig._collectInterfaces(raw, flags);
  const d = a.ipv6Detail;
  assert.deepStrictEqual(d.map((x) => [x.address, x.kind, x.temporary]), [
    ["2a01:e0a:1f3:c4d0::1", "global", false], ["2a01:e0a:1f3:c4d0::77", "global", true], ["fd00::20", "ula", false], ["fe80::1", "link", false]
  ], "globale stable d'abord, puis temporaire, locale unique, lien local");
  assert.strictEqual(d[0].prefix, "2a01:e0a:1f3:c4d0::/64");
  assert.deepStrictEqual(a.ipv6, ["2a01:e0a:1f3:c4d0::77", "2a01:e0a:1f3:c4d0::1", "fd00::20"], "champ historique inchange");
  console.log("  OK");

  console.log("== IP publique IPv6 ==");
  assert.strictEqual(parseIpResponse('{"ip":"2A01:E0A::1"}', 6), "2a01:e0a::1");
  assert.strictEqual(parseIpResponse("82.64.1.2", 6), null, "une IPv4 n'est pas une IPv6");
  assert.strictEqual(parseIpResponse("2a01:e0a::1", 4), null, "et inversement");
  console.log("  OK");

  console.log("== Tuile ==");
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true, runScripts: "outside-only" });
  const w = dom.window;
  let Sys = null;
  w.PiBoard = { registerWidget: (id, k) => { if (id === "system") Sys = k; }, toneOf: () => "dark" };
  w.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "system", "widget.js"), "utf8"));
  const netCfg = { hostname: "pi", adapters: [Object.assign({}, a, { name: "eth0", type: "wired" })] };
  let v6ok = true;
  const calls = [];
  w.fetch = async (u) => {
    calls.push(String(u));
    const ok = (o) => ({ ok: true, status: 200, json: async () => o });
    if (u === "/api/network-config") return ok(netCfg);
    if (u === "/api/public-ip?family=6") return ok(v6ok ? { ip: "2a01:e0a:1f3:c4d0::1" } : { ip: null, error: "timeout" });
    if (u === "/api/public-ip") return ok({ ip: "82.64.10.20" });
    if (u === "/api/system") return ok({ hostname: "pi", uptimeSec: 100, loadavg: [0, 0, 0], cpuPercent: 5, memTotalGB: 4, memUsedGB: 1, memPercent: 25, diskTotalGB: 32, diskUsedGB: 8, diskPercent: 25, tempC: 45, gpu: null });
    return ok({});
  };
  const copied = [];
  Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  const make = async (settings) => {
    const el = w.document.createElement("div"); w.document.body.appendChild(el);
    const x = new Sys({ el, settings: Object.assign({ showNetwork: true }, settings), i18n: { lang: "fr", t: (k) => k }, api: {} });
    await x.init(); x.destroy();
    return el;
  };
  let el = await make({});
  assert.ok(!/2a01/.test(el.textContent), "par defaut : IPv4 seulement");
  assert.ok(!calls.includes("/api/public-ip?family=6"), "aucune requete IPv6 si l'IPv6 n'est pas affichee");
  el = await make({ netFamily: "both", showPublicIp: true, publicIpFamily: "both", showIpv6Prefix: true });
  const ips = [...el.querySelectorAll(".pws-net-ip")].map((x) => x.dataset.copy);
  assert.deepStrictEqual(ips, ["192.168.1.20", "2a01:e0a:1f3:c4d0::1", "2a01:e0a:1f3:c4d0::/64", "82.64.10.20", "2a01:e0a:1f3:c4d0::1"],
    "IPv4, IPv6 globale, prefixe, IP publiques v4 et v6");
  assert.ok(el.querySelector(".pws-v6dot.ok"), "pastille verte : IPv6 fonctionnel");
  el = await make({ netFamily: "v6", ipv6Temporary: true, ipv6Ula: true, ipv6LinkLocal: true });
  assert.strictEqual(el.querySelectorAll(".pws-ip6").length, 4, "les quatre types d'adresses IPv6");
  assert.ok(!/192\.168/.test(el.textContent), "IPv6 seule : pas d'IPv4");
  assert.ok(/system\.v6\.temporary/.test(el.textContent), "adresse temporaire nommee");
  v6ok = false;
  el = await make({ netFamily: "v6", showPublicIp: true, publicIpFamily: "v6" });
  assert.ok(el.querySelector(".pws-v6dot") && !el.querySelector(".pws-v6dot.ok"), "pas d'IPv6 de bout en bout : pastille grise");
  assert.ok(/system\.v6\.unavailable/.test(el.textContent));
  v6ok = true;
  el = await make({ netFamily: "both", showPublicIp: true, publicIpFamily: "both", maskPublicIp: true });
  const shown = [...el.querySelectorAll(".pws-net-ip")].map((x) => x.textContent.trim());
  assert.ok(shown.includes("82.64.x.x") && shown.includes("2a01:e0a:1f3:c4d0:****:****:****:****") && shown.includes("192.168.1.20"),
    "masquage : publiques et globales masquees, IPv4 privee intacte");
  const pub = [...el.querySelectorAll(".pws-net-ip")].find((x) => x.textContent.trim() === "82.64.x.x");
  // toucher l'adresse : copie (adresse complete), sans ouvrir la fenetre reseau
  const x2 = new Sys({ el, settings: { showNetwork: true, netFamily: "both", showPublicIp: true, publicIpFamily: "both", maskPublicIp: true }, i18n: { lang: "fr", t: (k) => k }, api: {} });
  el.innerHTML = ""; await x2.init();
  const target = [...el.querySelectorAll(".pws-net-ip")].find((x) => x.dataset.copy === "82.64.10.20");
  target.dispatchEvent(new w.Event("pointerup", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(copied, ["82.64.10.20"], "copie de l'adresse complete");
  assert.ok(/system\.copied/.test(target.textContent), "« Copié ✓ » affiche");
  assert.ok(!w.document.querySelector(".pwn-modal"), "la fenetre reseau ne s'ouvre pas");
  el.querySelector(".pws-net-name").dispatchEvent(new w.Event("pointerup", { bubbles: true, cancelable: true }));
  assert.ok(w.document.querySelector(".pwn-modal"), "toucher le nom ouvre toujours la configuration reseau");
  assert.ok(/fd00::20\/64/.test(w.document.querySelector(".pwn-modal").textContent), "fenetre : toutes les IPv6 avec leur prefixe");
  x2.destroy();
  void pub;
  console.log("  OK");

  console.log("ipv6 : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
