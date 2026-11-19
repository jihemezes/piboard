/* Outils de test d'un hote (1.174.0) : analyseurs (ping, traceroute,
   NetBIOS, mDNS, HTTP), adresses autorisees, ports sur un vrai serveur
   local, paquet magique, et routes du serveur (refus hors reseau local). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const assert = require("assert");
const ht = require("../server/hostTools");

(async () => {
  console.log("== Adresses autorisees ==");
  for (const ip of ["192.168.1.10", "10.0.0.1", "172.16.5.4", "172.31.255.1", "169.254.1.1", "127.0.0.1"]) assert.ok(ht.isPrivateIp(ip), ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "192.169.0.1", "abc", "", "192.168.1.300"]) assert.ok(!ht.isPrivateIp(ip), ip);
  console.log("  OK");

  console.log("== Ping : analyse des sorties ==");
  let r = ht.parsePingOutput("64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.512 ms\n64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=1.20 ms\n");
  assert.deepStrictEqual(r, { times: [0.512, 1.2], ttl: 64 }, "Linux / macOS");
  r = ht.parsePingOutput("Réponse de 192.168.1.1 : octets=32 temps=3 ms TTL=64\r\nRéponse de 192.168.1.1 : octets=32 temps<1ms TTL=64\r\n");
  assert.deepStrictEqual(r, { times: [3, 1], ttl: 64 }, "Windows en francais");
  r = ht.parsePingOutput("Réponse de 192.168.1.254 : Impossible de joindre l'hôte de destination.\r\n");
  assert.deepStrictEqual(r.times, [], "Windows : hote injoignable n'est pas une reponse");
  assert.deepStrictEqual(ht.pingCommand("1.2.3.4", 4, "darwin").cmd, "/sbin/ping");
  assert.ok(ht.pingCommand("1.2.3.4", 4, "linux").args.includes("-c"));
  assert.ok(ht.pingCommand("1.2.3.4", 4, "win32").args.includes("-n"));
  console.log("  OK");

  console.log("== Traceroute : analyse ==");
  const hops = ht.parseTraceroute("traceroute to 192.168.1.20, 15 hops max\n 1  192.168.1.1  0.612 ms\n 2  *\n 3  192.168.1.20  1,5 ms\n");
  assert.deepStrictEqual(hops, [{ hop: 1, ip: "192.168.1.1", ms: 0.612 }, { hop: 2, ip: null, ms: null }, { hop: 3, ip: "192.168.1.20", ms: 1.5 }]);
  const win = ht.parseTraceroute("Détermination de l'itinéraire\r\n  1    <1 ms    <1 ms    <1 ms  192.168.1.1\r\n");
  assert.strictEqual(win[0].ip, "192.168.1.1");
  console.log("  OK");

  console.log("== Ports : liste et sondage reel ==");
  assert.deepStrictEqual(ht.parsePortList("22, 80;8000-8002"), [22, 80, 8000, 8001, 8002]);
  assert.throws(() => ht.parsePortList("70000"));
  assert.throws(() => ht.parsePortList("1-2000"), /too many/);
  const srv = net.createServer((s) => {
    s.once("data", () => s.end("HTTP/1.0 200 OK\r\nServer: TestBox/1.0\r\nContent-Type: text/html\r\n\r\n<html><title>Ma box</title></html>"));
  });
  await new Promise((res) => srv.listen(0, "127.0.0.1", res));
  const port = srv.address().port;
  const closedPort = await new Promise((res) => { const s2 = net.createServer(); s2.listen(0, "127.0.0.1", () => { const p = s2.address().port; s2.close(() => res(p)); }); });
  const scan = await ht.scanPorts("127.0.0.1", [port, closedPort], { timeoutMs: 800 });
  assert.strictEqual(scan.open.length, 1, "un port ouvert");
  assert.strictEqual(scan.open[0].port, port);
  assert.strictEqual(scan.closed, 1, "un port ferme");
  srv.close();
  assert.deepStrictEqual(ht.parseHttpHead("HTTP/1.1 401 Unauthorized\r\nserver: lighttpd\r\n\r\n<title> Routeur </title>"), { status: 401, server: "lighttpd", title: "Routeur" });
  console.log("  OK");

  console.log("== Etendue et tache de fond ==");
  assert.strictEqual(ht.portsForScope("quick").length, 36);
  const ext = ht.portsForScope("extended");
  assert.ok(ext.length > 1100 && ext.includes(1) && ext.includes(1024) && ext.includes(8123) && ext.includes(32400), "etendue : 1-1024 + applicatifs");
  assert.strictEqual(ht.portsForScope("full").length, 65535);
  {
    const s3 = net.createServer((c) => c.end());
    await new Promise((res) => s3.listen(0, "127.0.0.1", res));
    const p3 = s3.address().port;
    const job = ht.startPortJob("127.0.0.1", [p3, closedPort], { scope: "extended", timeoutMs: 500 });
    let v; for (let k = 0; k < 50; k++) { v = ht.getPortJob(job.id); if (v.done) break; await new Promise((r) => setTimeout(r, 100)); }
    assert.ok(v.done && v.scanned === 2 && v.open.length === 1 && v.open[0].port === p3 && v.closed === 1, "tache : resultat complet");
    // arret : une longue liste s'arrete avant la fin
    const big = Array.from({ length: 3000 }, (_, k) => 20000 + k);
    const j2 = ht.startPortJob("127.0.0.1", big, { scope: "full", timeoutMs: 300 });
    ht.stopPortJob(j2.id);
    for (let k = 0; k < 50; k++) { v = ht.getPortJob(j2.id); if (v.done) break; await new Promise((r) => setTimeout(r, 100)); }
    assert.ok(v.done && v.stopped && v.scanned < 3000, "Arreter interrompt la tache");
    s3.close();
  }
  console.log("  OK");

  console.log("== NetBIOS, mDNS ==");
  assert.strictEqual(ht.encodeNetbiosName("*\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0").length, 34);
  // reponse NBSTAT fabriquee : 2 noms (PC-SALON <00> unique, WORKGROUP <00> groupe) + MAC
  const nm = (s) => Buffer.from((s + "               ").slice(0, 15), "latin1");
  const reply = Buffer.concat([
    Buffer.from([0x50, 0x42, 0x84, 0x00, 0, 0, 0, 1, 0, 0, 0, 0]),
    ht.encodeNetbiosName("*\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"),
    Buffer.from([0, 0x21, 0, 1, 0, 0, 0, 0, 0, 0x41, 2]),
    nm("PC-SALON"), Buffer.from([0x00, 0x04, 0x00]),
    nm("WORKGROUP"), Buffer.from([0x00, 0x84, 0x00]),
    Buffer.from("a8bbcc001122", "hex")
  ]);
  assert.deepStrictEqual(ht.parseNbstat(reply), { name: "PC-SALON", workgroup: "WORKGROUP", mac: "a8:bb:cc:00:11:22" });
  // reponse mDNS PTR fabriquee
  const q = ht.mdnsQuery("192.168.1.20");
  const name = Buffer.concat([Buffer.from([7]), Buffer.from("imac-jm"), Buffer.from([5]), Buffer.from("local"), Buffer.from([0])]);
  const ans2 = Buffer.concat([Buffer.from([0x12, 0x34, 0x84, 0, 0, 1, 0, 1, 0, 0, 0, 0]), q.slice(12),
    Buffer.from([0xc0, 0x0c, 0, 0x0c, 0, 1, 0, 0, 0, 10, 0, name.length]), name]);
  assert.strictEqual(ht.parseMdnsPtr(ans2), "imac-jm.local");
  console.log("  OK");

  console.log("== Wake-on-LAN, MAC ==");
  const pkt = ht.magicPacket("A8-BB-CC-00-11-22");
  assert.strictEqual(pkt.length, 102);
  assert.ok(pkt.slice(0, 6).equals(Buffer.alloc(6, 0xff)));
  assert.strictEqual(pkt.slice(6, 12).toString("hex"), "a8bbcc001122");
  assert.throws(() => ht.magicPacket("zz"));
  assert.deepStrictEqual(ht.broadcastFor("192.168.1.20", ["192.168.1.5/24", "10.0.0.2/8"]), ["255.255.255.255", "192.168.1.255"]);
  assert.deepStrictEqual(ht.macInfo("da:a1:19:00:00:01"), { mac: "da:a1:19:00:00:01", oui: "DA:A1:19", local: true, multicast: false });
  assert.strictEqual(ht.macInfo("a8:bb:cc:00:00:01").local, false);
  console.log("  OK");

  console.log("== Routes du serveur ==");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-hosttools-"));
  process.env.PIBOARD_DATA = path.join(tmp, "data");
  process.env.PIBOARD_UPDATE_CHECK = "0";
  const { start } = require("../server/index.js");
  const s = await start({ port: 0, host: "127.0.0.1" });
  const post = async (p, body) => {
    const res = await fetch("http://127.0.0.1:" + s.port + "/api/net-tools/" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  for (const p of ["ping", "ports", "traceroute", "names", "arp"]) {
    const x = await post(p, { ip: "8.8.8.8" });
    assert.strictEqual(x.status, 400, p + " : adresse publique refusee");
    assert.strictEqual(x.body.error, "private-only");
  }
  let x = await post("ports", { ip: "127.0.0.1", ports: "abc" });
  assert.strictEqual(x.status, 400, "liste de ports invalide refusee");
  x = await post("wol", { mac: "pas-une-mac" });
  assert.strictEqual(x.status, 400, "WoL : MAC invalide refusee");
  const srv2 = net.createServer((c) => c.end());
  await new Promise((res) => srv2.listen(0, "127.0.0.1", res));
  x = await post("ports", { ip: "127.0.0.1", ports: String(srv2.address().port) });
  assert.strictEqual(x.status, 200);
  assert.ok(x.body.open.some((o) => o.port === srv2.address().port), "route ports : port ouvert trouve");
  srv2.close();
  x = await post("portscan", { ip: "8.8.8.8", scope: "full" });
  assert.strictEqual(x.status, 400, "portscan : adresse publique refusee");
  x = await post("portscan", { ip: "127.0.0.1", scope: "quick" });
  assert.strictEqual(x.status, 200, "portscan demarre");
  assert.ok(x.body.id && x.body.total === 36);
  const g = await fetch("http://127.0.0.1:" + s.port + "/api/net-tools/portscan/" + x.body.id);
  assert.strictEqual(g.status, 200, "suivi de la tache");
  await post("portscan/" + x.body.id + "/stop", {});
  x = await post("ping", { ip: "127.0.0.1", count: 1 });
  assert.strictEqual(x.status, 200, "route ping repond");
  assert.ok("icmp" in x.body && "alive" in x.body);
  console.log("  OK");

  console.log("hostTools : tous les tests OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
