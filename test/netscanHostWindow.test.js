/* Tuile Analyse reseau : fenetre d'un hote (1.174.0). jsdom + fetch
   factice : un appui sur une ligne ouvre la fenetre, chaque bouton
   appelle la bonne route et affiche son resultat, la surveillance
   s'arrete a la fermeture. */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let failed = 0;
function check(label, cond, detail) {
  if (cond) console.log("  OK   " + label);
  else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 20));

(async () => {
  const dom = new JSDOM("<!doctype html><body><div id='t'></div></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  let Klass = null;
  w.PiBoard = { registerWidget: (id, k) => { if (id === "networkscan") Klass = k; } };
  w.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "networkscan", "widget.js"), "utf8"));

  const calls = [];
  const opened = [];
  w.open = (u) => { opened.push(u); return null; };
  const host = { ip: "192.168.1.20", hostname: "nas", mac: "a8:bb:cc:00:00:20", key: "mac:a8:bb:cc:00:00:20", isSelf: false, vendor: "Synology", status: "known", alias: null };
  const payload = { scanning: false, hosts: [host], cidr: "192.168.1.0/24", scannedAt: new Date().toISOString(), baseline: null, absent: [{ key: "mac:x", name: "Camera", ip: "192.168.1.30", mac: "a8:bb:cc:00:00:30", lastSeen: "2026-11-01T10:00:00.000Z" }], newCount: 0, alertCount: 0, changedCount: 0 };
  let pingDown = false;
  let stopped = false;
  w.fetch = async (url, opts) => {
    const u = String(url);
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    calls.push({ u, body });
    const ok = (o) => ({ ok: true, status: 200, json: async () => o });
    if (u.startsWith("/api/network-scan")) return ok(payload);
    if (u === "/api/net-tools/ping") return ok(pingDown
      ? { icmp: { available: true, times: [], sent: 1, received: 0, loss: 100 }, tcp: { port: null, times: [null], sent: 1, received: 0, loss: 100 }, alive: false }
      : { icmp: { available: true, ttl: 64, times: [0.5, 0.7], sent: 2, received: 2, loss: 0, min: 0.5, avg: 0.6, max: 0.7 }, alive: true });
    if (u === "/api/net-tools/portscan") return ok({ id: "j1", ip: body.ip, scope: body.scope, done: false, total: 1163, scanned: 100, closed: 99, filtered: 0, open: [{ port: 22, state: "open", service: "SSH" }], web: null });
    if (u === "/api/net-tools/portscan/j1/stop") { stopped = true; return ok({ ok: true }); }
    if (u === "/api/net-tools/portscan/j1") return ok({ id: "j1", ip: "192.168.1.20", done: true, stopped, total: 1163, scanned: 1163, closed: 1130, filtered: 31, open: [{ port: 5001, state: "open", service: "HTTPS (NAS)", http: { status: 200, title: "DiskStation", cert: { subject: "synology", issuer: "Synology Inc." } } }, { port: 22, state: "open", service: "SSH", banner: "SSH-2.0-OpenSSH_8.2" }], web: "https://192.168.1.20:5001/" });
    if (u === "/api/net-tools/traceroute") return ok({ available: false, hops: [] });
    if (u === "/api/net-tools/names") return ok({ system: "nas.local", dns: null, mdns: "nas.local", netbios: { name: "NAS", workgroup: "WORKGROUP" } });
    if (u === "/api/net-tools/arp") return ok({ ip: body.ip, self: false, ms: 312, mac: "a8:bb:cc:00:00:20", oui: "A8:BB:CC", local: false, vendor: "Synology" });
    if (u === "/api/net-tools/wol") return ok({ ok: true, targets: ["255.255.255.255", "192.168.1.255"], sent: 4 });
    return ok({});
  };
  const el = w.document.getElementById("t");
  const widget = new Klass({ el, settings: {}, i18n: { lang: "fr", t: (k) => k }, api: {} });
  await widget.init();
  await tick();

  const up = (node, opts) => node.dispatchEvent(new w.Event("pointerup", { bubbles: true, cancelable: true }));
  const down = (node) => node.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  const win = () => w.document.querySelector(".pwn-hw");
  const btn = (act) => win().querySelector('[data-hw="' + act + '"]');
  const card = (k) => win().querySelector('[data-card="' + k + '"]');

  console.log("== Ouverture ==");
  const row = el.querySelector(".pwn-row[data-idx='0']");
  down(row); up(row);
  check("un appui sur la ligne ouvre la fenetre de l'hote", !!win() && /192\.168\.1\.20/.test(win().textContent) && /a8:bb:cc:00:00:20/.test(win().textContent));
  check("fenetre posee sur <body>, hors de la tuile", !!win() && !el.contains(win()));
  check("informations : fabricant et type de MAC", /Synology/.test(win().textContent) && /netscan\.hw\.macGlobal/.test(win().textContent));
  w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
  check("Echap ferme la fenetre", !win());
  down(row); up(row.querySelector(".pwn-rename-btn"));
  check("un appui sur le bouton Renommer n'ouvre pas la fenetre", !win());
  widget.cancelEdit && widget.cancelEdit();
  const absent = el.querySelector(".pwn-row[data-aidx='0']");
  if (absent) { down(absent); up(absent); }
  check("un hote absent s'ouvre aussi", !!win() && /192\.168\.1\.30/.test(win().textContent) && /netscan\.hw\.stateAbsent/.test(win().textContent));
  btn("close") && up(btn("close"));
  check("le bouton Fermer ferme", !win());

  console.log("== Tests ==");
  const row2 = el.querySelector(".pwn-row[data-idx='0']");
  down(row2); up(row2);
  up(btn("ping")); await tick();
  check("ping : route appelee avec l'IP", calls.some((c) => c.u === "/api/net-tools/ping" && c.body.ip === "192.168.1.20"));
  check("ping : statistiques affichees", !!card("ping") && /TTL 64/.test(card("ping").textContent));
  win().querySelector(".pwn-hw-ports").value = "8888";
  check("etendue : trois choix, Rapide par defaut", win().querySelectorAll('input[name="pwn-scope"]').length === 3 && win().querySelector('input[name="pwn-scope"]:checked').value === "quick");
  win().querySelector('input[name="pwn-scope"][value="extended"]').checked = true;
  up(btn("ports")); await tick(60);
  const pc = calls.find((c) => c.u === "/api/net-tools/portscan");
  check("ports : etendue et ports en plus transmis", pc && pc.body.scope === "extended" && pc.body.ports === "8888");
  check("ports : progression et bouton Arreter pendant le test", !!card("ports").querySelector(".pwn-hw-prog") && !!card("ports").querySelector(".pwn-hw-stop") && /SSH/.test(card("ports").textContent));
  up(card("ports").querySelector(".pwn-hw-stop")); await tick(60);
  check("Arreter : demande envoyee au serveur", stopped === true);
  await tick(800);
  check("ports : services, titre web, certificat et banniere", /DiskStation/.test(card("ports").textContent) && /Synology Inc\./.test(card("ports").textContent) && /OpenSSH/.test(card("ports").textContent));
  up(btn("web"));
  check("interface web : ouvre l'adresse trouvee par le test de ports", opened[opened.length - 1] === "https://192.168.1.20:5001/");
  up(btn("trace")); await tick();
  check("traceroute absent : message d'installation", /netscan\.hw\.traceMissing/.test(card("trace").textContent));
  up(btn("names")); await tick();
  check("noms : mDNS, NetBIOS et groupe de travail", /nas\.local/.test(card("names").textContent) && /WORKGROUP/.test(card("names").textContent));
  up(btn("arp")); await tick();
  check("ARP : MAC, OUI et fabricant", /A8:BB:CC/.test(card("arp").textContent) && /Synology/.test(card("arp").textContent));
  up(btn("wol")); await tick();
  const wc = calls.find((c) => c.u === "/api/net-tools/wol");
  check("reveil reseau : MAC envoyee", wc && wc.body.mac === "a8:bb:cc:00:00:20" && /netscan\.hw\.wolSent/.test(card("wol").textContent));

  console.log("== Surveillance ==");
  const before = calls.filter((c) => c.u === "/api/net-tools/ping").length;
  pingDown = true;
  up(btn("watch")); await tick(30);
  check("surveiller : un ping est lance et la courbe affichee", calls.filter((c) => c.u === "/api/net-tools/ping").length > before && !!card("watch").querySelector("svg"));
  widget.hw.watch.misses = 2;
  widget.hw.watch.samples.push(null); widget.hw.watch.sent++; widget.hw.watch.lost++; widget.hw.watch.misses++;
  widget.renderWatch(widget.hw.watch);
  check("3 pertes de suite : alerte affichee", /netscan\.hw\.watchDown/.test(card("watch").textContent) && card("watch").classList.contains("down"));
  const w0 = widget.hw.watch;
  up(btn("close"));
  check("fermer la fenetre arrete la surveillance", !win() && !widget.hw);
  check("destroy : aucune fenetre restante", (() => { down(row2); up(row2); widget.destroy(); return !w.document.querySelector(".pwn-hw-back"); })());
  void w0;

  console.log(failed ? `\n${failed} echec(s)` : "\nnetscanHostWindow : tous les tests OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
