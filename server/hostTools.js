/* PiBoard - outils de test d'un hote du reseau local (1.174.0)
   ------------------------------------------------------------
   Utilises par la fenetre « hote » de la tuile Analyse reseau : ping,
   ports ouverts (avec banniere du service), traceroute, noms (systeme,
   DNS inverse, mDNS, NetBIOS), sonde ARP, reveil reseau (Wake-on-LAN).

   SECURITE. Seules les adresses PRIVEES sont acceptees (10/8, 172.16/12,
   192.168/16, 169.254/16, 127/8) : le serveur PiBoard ne doit pas
   pouvoir servir a sonder Internet. Les commandes systeme (ping,
   traceroute) sont lancees par execFile() avec un tableau d'arguments,
   jamais par un shell, et l'adresse est validee avant.

   MAC. macOS jette en silence les paquets d'un `ping` lance en processus
   enfant par PiBoard (permission « Reseau local » attribuee par
   processus, voir server/networkScan.js). Le ping ICMP est donc complete
   d'un « ping TCP » emis par PiBoard lui-meme : une connexion acceptee
   OU refusee (RST) prouve que l'hote est la et donne un temps de reponse.

   Host test tools for the Network scan tile's host window. PRIVATE
   addresses only, so the server cannot be used to probe the Internet.
   System commands run through execFile() with an argument array, never a
   shell. On macOS a child `ping` can be silently dropped, so ICMP is
   backed by a "TCP ping" sent from PiBoard's own socket. */
"use strict";

const net = require("net");
const tls = require("tls");
const dgram = require("dgram");
const dns = require("dns");
const { execFile } = require("child_process");
const { isValidIp, ipToInt } = require("./ipv4");

/* ---------- Adresses autorisees / allowed addresses ---------- */
function isPrivateIp(ip) {
  if (!isValidIp(ip)) return false;
  const [a, b] = String(ip).split(".").map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 169 && b === 254);
}

function normalizeMac(mac) {
  const hex = String(mac || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(":");
}

/* Lecture d'une adresse MAC : fabricant non deduit ici (voir
   networkScan.vendorForMac), seulement ce que disent ses bits.
   What a MAC's bits tell: locally administered (random / private Wi-Fi
   address) and multicast. */
function macInfo(mac) {
  const m = normalizeMac(mac);
  if (!m) return null;
  const first = parseInt(m.slice(0, 2), 16);
  return { mac: m, oui: m.slice(0, 8).toUpperCase(), local: !!(first & 2), multicast: !!(first & 1) };
}

/* ---------- Ping ICMP ---------- */
function pingCommand(ip, count, platform) {
  const p = platform || process.platform;
  const n = String(count);
  if (p === "win32") return { cmd: "ping", args: ["-n", n, "-w", "1000", ip] };
  if (p === "darwin") return { cmd: "/sbin/ping", args: ["-c", n, "-W", "1000", ip] };
  return { cmd: "ping", args: ["-c", n, "-W", "1", "-i", "0.5", ip] };
}

/* Analyse la sortie de ping (Linux, macOS, Windows en toute langue) :
   chaque ligne de reponse porte « time=1.23 ms », « temps=1 ms » ou
   « time<1ms ». Le TTL est repere par « ttl= ».
   Parses ping output on all three systems and any Windows language. */
function parsePingOutput(stdout) {
  const times = [];
  let ttl = null;
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!/ttl\s*=\s*\d+/i.test(line)) continue;
    const t = /[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i.exec(line);
    if (!t) continue;
    times.push(Number(t[1].replace(",", ".")));
    const m = /ttl\s*=\s*(\d+)/i.exec(line);
    if (m && ttl == null) ttl = Number(m[1]);
  }
  return { times, ttl };
}

function stats(times, sent) {
  const ok = times.filter((t) => t != null);
  const out = { sent, received: ok.length, loss: sent ? Math.round((1 - ok.length / sent) * 100) : 100 };
  if (ok.length) {
    out.min = Math.min(...ok);
    out.max = Math.max(...ok);
    out.avg = Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 100) / 100;
  }
  return out;
}

function icmpPing(ip, count) {
  return new Promise((resolve) => {
    const { cmd, args } = pingCommand(ip, count);
    execFile(cmd, args, { timeout: (count + 3) * 1500, windowsHide: true }, (err, stdout) => {
      if (err && err.code === "ENOENT") return resolve({ available: false, times: [], ttl: null });
      const r = parsePingOutput(stdout);
      resolve({ available: true, times: r.times, ttl: r.ttl });
    });
  });
}

/* ---------- Connexion TCP / TCP connect ----------
   « open » : connexion acceptee ; « closed » : refusee (l'hote est
   present) ; « filtered » : pas de reponse dans le delai.
   "open": accepted; "closed": refused (host present); "filtered": no
   answer in time. */
function tcpProbe(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const sock = new net.Socket();
    let done = false;
    const finish = (state) => {
      if (done) return;
      done = true;
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      sock.destroy();
      resolve({ port, state, ms: Math.round(ms * 100) / 100 });
    };
    sock.setTimeout(timeoutMs || 900);
    sock.once("connect", () => finish("open"));
    sock.once("timeout", () => finish("filtered"));
    sock.once("error", (e) => finish(e && e.code === "ECONNREFUSED" ? "closed" : "filtered"));
    sock.connect(port, ip);
  });
}

const TCP_PING_PORTS = [80, 443, 22, 445, 53, 8080, 139, 554];

/* Un « ping » TCP : le premier port qui repond (ouvert ou refuse). */
async function tcpPingOnce(ip) {
  const results = await Promise.all(TCP_PING_PORTS.map((p) => tcpProbe(ip, p, 900)));
  const hits = results.filter((r) => r.state !== "filtered").sort((a, b) => a.ms - b.ms);
  return hits.length ? hits[0] : null;
}

async function ping(ip, count) {
  count = Math.max(1, Math.min(10, Number(count) || 4));
  const icmp = await icmpPing(ip, count);
  const out = { ip, icmp: Object.assign({ available: icmp.available, ttl: icmp.ttl, times: icmp.times }, stats(icmp.times, count)) };
  if (!icmp.times.length) {
    // ICMP muet (pare-feu, ou ping bloque par macOS) : on verifie par TCP.
    const tcpTimes = [];
    let port = null;
    for (let i = 0; i < Math.min(count, 4); i++) {
      const hit = await tcpPingOnce(ip);
      tcpTimes.push(hit ? hit.ms : null);
      if (hit && port == null) port = hit.port;
    }
    out.tcp = Object.assign({ port, times: tcpTimes }, stats(tcpTimes, tcpTimes.length));
  }
  out.alive = out.icmp.received > 0 || !!(out.tcp && out.tcp.received > 0);
  return out;
}

/* ---------- Ports ouverts / open ports ---------- */
const COMMON_PORTS = [
  [21, "FTP"], [22, "SSH"], [23, "Telnet"], [25, "SMTP"], [53, "DNS"], [80, "HTTP"],
  [110, "POP3"], [139, "NetBIOS"], [143, "IMAP"], [443, "HTTPS"], [445, "SMB"],
  [515, "LPD"], [548, "AFP"], [554, "RTSP"], [631, "IPP"], [1883, "MQTT"],
  [3000, "HTTP (app)"], [3306, "MySQL"], [3389, "RDP"], [5000, "HTTP (NAS / UPnP)"],
  [5001, "HTTPS (NAS)"], [5432, "PostgreSQL"], [5900, "VNC"], [7000, "AirPlay"],
  [8000, "HTTP alt"], [8008, "HTTP (Chromecast)"], [8009, "Cast"], [8080, "HTTP alt"],
  [8123, "Home Assistant"], [8443, "HTTPS alt"], [8883, "MQTT TLS"], [9000, "HTTP (admin)"],
  [9100, "Imprimante / printer (JetDirect)"], [32400, "Plex"], [49152, "UPnP"], [62078, "iPhone sync"]
];
const SERVICE = new Map(COMMON_PORTS);
const HTTP_PORTS = new Set([80, 3000, 5000, 8000, 8008, 8080, 8123, 9000, 32400, 49152]);
const TLS_PORTS = new Set([443, 5001, 8443, 8883]);
const BANNER_PORTS = new Set([21, 22, 23, 25, 110, 143, 3306]);

/* « 22, 80, 8000-8010 » -> [22, 80, 8000..8010] ; 1024 ports au plus. */
function parsePortList(text) {
  const out = new Set();
  for (const part of String(text || "").split(/[\s,;]+/)) {
    if (!part) continue;
    const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(part);
    if (!m) throw new Error("bad port: " + part);
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b > 65535 || b < a) throw new Error("bad port: " + part);
    for (let p = a; p <= b; p++) { out.add(p); if (out.size > 1024) throw new Error("too many ports"); }
  }
  return [...out].sort((x, y) => x - y);
}

function readBanner(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.connect(port, ip);
    let buf = "";
    const end = () => { sock.destroy(); resolve(cleanBanner(buf)); };
    sock.setTimeout(timeoutMs || 1500, end);
    sock.on("data", (d) => { buf += d.toString("latin1"); if (buf.length > 300 || /\n/.test(buf)) end(); });
    sock.on("error", end);
    sock.on("close", end);
  });
}

function cleanBanner(s) {
  const line = String(s || "").split(/\r?\n/)[0].replace(/[^\x20-\x7e -ÿ]/g, "").trim();
  return line.slice(0, 120) || null;
}

/* En-tete HTTP minimal : code, Server, titre de la page.
   Minimal HTTP probe: status, Server header, page title. */
function httpProbe(ip, port, useTls, timeoutMs) {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
    const opts = { host: ip, port, rejectUnauthorized: false, servername: undefined };
    const sock = useTls ? tls.connect(opts) : net.connect(port, ip);
    const finish = () => {
      if (done) return;
      done = true;
      let cert = null;
      if (useTls && sock.getPeerCertificate) {
        try {
          const c = sock.getPeerCertificate();
          if (c && c.subject) cert = { subject: c.subject.CN || c.subject.O || null, issuer: c.issuer ? (c.issuer.O || c.issuer.CN || null) : null, validTo: c.valid_to || null };
        } catch (e) { /* noop */ }
      }
      sock.destroy();
      resolve(Object.assign(parseHttpHead(buf), cert ? { cert } : {}));
    };
    sock.setTimeout(timeoutMs || 2000, finish);
    sock.on(useTls ? "secureConnect" : "connect", () => {
      sock.write("GET / HTTP/1.0\r\nHost: " + ip + "\r\nUser-Agent: PiBoard\r\nConnection: close\r\n\r\n");
    });
    sock.on("data", (d) => { buf += d.toString("latin1"); if (buf.length > 16384) finish(); });
    sock.on("error", finish);
    sock.on("end", finish);
    sock.on("close", finish);
  });
}

function parseHttpHead(raw) {
  const s = String(raw || "");
  const st = /^HTTP\/[\d.]+\s+(\d{3})/.exec(s);
  const server = /^server:\s*(.+)$/im.exec(s);
  const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(s);
  const out = {};
  if (st) out.status = Number(st[1]);
  if (server) out.server = server[1].trim().slice(0, 100);
  if (title) out.title = title[1].replace(/\s+/g, " ").trim().slice(0, 100);
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function scanPorts(ip, ports, opts) {
  const o = opts || {};
  const list = ports && ports.length ? ports : COMMON_PORTS.map((p) => p[0]);
  const probes = await mapLimit(list, 48, (p) => tcpProbe(ip, p, o.timeoutMs || 900));
  const open = probes.filter((r) => r.state === "open");
  await mapLimit(open, 8, async (r) => {
    r.service = SERVICE.get(r.port) || null;
    if (o.banners === false) return;
    if (HTTP_PORTS.has(r.port)) r.http = await httpProbe(ip, r.port, false, 2000);
    else if (TLS_PORTS.has(r.port)) r.http = await httpProbe(ip, r.port, true, 2500);
    else if (BANNER_PORTS.has(r.port)) r.banner = await readBanner(ip, r.port, 1500);
    if (r.http && !r.http.status && !r.http.cert) delete r.http;
  });
  return {
    ip,
    scanned: list.length,
    open: open.sort((a, b) => a.port - b.port),
    closed: probes.filter((r) => r.state === "closed").length,
    filtered: probes.filter((r) => r.state === "filtered").length,
    // Une interface web a proposer : premier port HTTP(S) ouvert.
    web: (() => {
      const w = open.find((r) => HTTP_PORTS.has(r.port) || TLS_PORTS.has(r.port));
      if (!w) return null;
      const secure = TLS_PORTS.has(w.port);
      const def = secure ? 443 : 80;
      return (secure ? "https://" : "http://") + ip + (w.port === def ? "" : ":" + w.port) + "/";
    })()
  };
}

/* ---------- Etendue du test de ports (1.175.0) ----------
   « quick » : les ports courants ci-dessus ; « extended » : les ports 1 a
   1024 (services systeme) plus les ports applicatifs courants au-dela ;
   « full » : les 65 535 ports. Les deux derniers tournent en TACHE de
   fond interrogee par la fenetre (progression, ports ouverts au fil de
   l'eau, arret possible).
   Port scan scope: quick / extended (1-1024 + common app ports) / full
   (all 65,535). The last two run as a background JOB polled by the
   window (progress, open ports as found, can be stopped). */
const EXTENDED_HIGH = [1080, 1194, 1433, 1521, 1723, 1883, 1900, 2049, 2082, 2083, 2181, 2375, 2376, 3000, 3001, 3128,
  3260, 3306, 3389, 3478, 3689, 4000, 4040, 4443, 4444, 4567, 4711, 4848, 5000, 5001, 5004, 5005, 5060, 5061, 5222,
  5353, 5357, 5432, 5555, 5601, 5672, 5683, 5800, 5900, 5901, 5938, 5984, 6000, 6379, 6443, 6667, 7000, 7001, 7070,
  7100, 7443, 7547, 7676, 8000, 8001, 8008, 8009, 8010, 8042, 8060, 8069, 8080, 8081, 8082, 8083, 8086, 8088, 8089,
  8090, 8096, 8123, 8181, 8200, 8222, 8243, 8291, 8333, 8384, 8443, 8444, 8448, 8500, 8554, 8581, 8686, 8728, 8729,
  8765, 8800, 8834, 8843, 8880, 8883, 8888, 8889, 8989, 9000, 9001, 9042, 9080, 9090, 9091, 9100, 9101, 9102, 9200,
  9443, 9999, 10000, 10001, 10050, 10051, 10243, 11211, 15672, 16992, 16993, 17500, 18080, 19999, 20000, 25565,
  27017, 28017, 32400, 32469, 37777, 49152, 49153, 49154, 50000, 51413, 55443, 62078];
function portsForScope(scope) {
  if (scope === "full") return Array.from({ length: 65535 }, (_, i) => i + 1);
  if (scope === "extended") {
    const set = new Set(Array.from({ length: 1024 }, (_, i) => i + 1));
    EXTENDED_HIGH.forEach((p) => set.add(p));
    COMMON_PORTS.forEach((p) => set.add(p[0]));
    return [...set].sort((a, b) => a - b);
  }
  return COMMON_PORTS.map((p) => p[0]);
}

async function describeOpen(ip, r) {
  r.service = SERVICE.get(r.port) || null;
  if (HTTP_PORTS.has(r.port)) r.http = await httpProbe(ip, r.port, false, 2000);
  else if (TLS_PORTS.has(r.port)) r.http = await httpProbe(ip, r.port, true, 2500);
  else if (BANNER_PORTS.has(r.port)) r.banner = await readBanner(ip, r.port, 1500);
  if (r.http && !r.http.status && !r.http.cert) delete r.http;
  return r;
}

const jobs = new Map();
const MAX_JOBS = 3;
let jobSeq = 0;

function webUrl(ip, open) {
  const w = open.find((r) => HTTP_PORTS.has(r.port) || TLS_PORTS.has(r.port));
  if (!w) return null;
  const secure = TLS_PORTS.has(w.port);
  return (secure ? "https://" : "http://") + ip + (w.port === (secure ? 443 : 80) ? "" : ":" + w.port) + "/";
}

function jobView(job) {
  return {
    id: job.id, ip: job.ip, scope: job.scope, done: job.done, stopped: job.stopped,
    total: job.total, scanned: job.scanned, closed: job.closed, filtered: job.filtered,
    open: job.open.slice().sort((a, b) => a.port - b.port), web: webUrl(job.ip, job.open),
    elapsedMs: (job.endedAt || Date.now()) - job.startedAt
  };
}

function startPortJob(ip, ports, opts) {
  const o = opts || {};
  for (const [id, j] of jobs) if (Date.now() - (j.endedAt || j.startedAt) > 10 * 60000) jobs.delete(id);
  const running = [...jobs.values()].filter((j) => !j.done);
  if (running.length >= MAX_JOBS) { const e = new Error("too many scans"); e.code = "busy"; throw e; }
  const job = { id: "ps" + (++jobSeq) + "-" + Date.now().toString(36), ip, scope: o.scope || "quick", total: ports.length,
    scanned: 0, closed: 0, filtered: 0, open: [], done: false, stopped: false, startedAt: Date.now(), endedAt: null };
  jobs.set(job.id, job);
  const timeoutMs = o.timeoutMs || (job.scope === "full" ? 600 : 900);
  const limit = job.scope === "quick" ? 48 : 200;
  let i = 0;
  const pendingDescribe = [];
  (async () => {
    await Promise.all(Array.from({ length: Math.min(limit, ports.length) }, async () => {
      while (i < ports.length && !job.stopped) {
        const port = ports[i++];
        const r = await tcpProbe(ip, port, timeoutMs);
        job.scanned++;
        if (r.state === "open") { job.open.push(r); pendingDescribe.push(describeOpen(ip, r).catch(() => r)); }
        else if (r.state === "closed") job.closed++;
        else job.filtered++;
      }
    }));
    await Promise.all(pendingDescribe);
    job.done = true;
    job.endedAt = Date.now();
  })();
  return job;
}

function getPortJob(id) { const j = jobs.get(String(id)); return j ? jobView(j) : null; }
function stopPortJob(id) { const j = jobs.get(String(id)); if (j) j.stopped = true; return !!j; }

/* ---------- Traceroute ---------- */
function tracerouteCommand(ip, platform) {
  const p = platform || process.platform;
  if (p === "win32") return { cmd: "tracert", args: ["-d", "-h", "15", "-w", "1000", ip] };
  if (p === "darwin") return { cmd: "/usr/sbin/traceroute", args: ["-n", "-w", "1", "-q", "1", "-m", "15", ip] };
  return { cmd: "traceroute", args: ["-n", "-w", "1", "-q", "1", "-m", "15", ip] };
}

/* Lignes « 1  192.168.1.1  0.612 ms » (Linux/macOS) ou
   « 1    <1 ms   192.168.1.1 » (Windows), « * » pour un saut muet. */
function parseTraceroute(stdout) {
  const hops = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const m = /^\s*(\d{1,2})\s+(.*)$/.exec(line);
    if (!m) continue;
    const rest = m[2];
    const ipm = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(rest);
    const tm = /[<]?\s*(\d+(?:[.,]\d+)?)\s*ms/i.exec(rest);
    hops.push({ hop: Number(m[1]), ip: ipm ? ipm[1] : null, ms: tm ? Number(tm[1].replace(",", ".")) : null });
  }
  return hops;
}

function traceroute(ip) {
  return new Promise((resolve) => {
    const { cmd, args } = tracerouteCommand(ip);
    execFile(cmd, args, { timeout: 40000, windowsHide: true }, (err, stdout) => {
      if (err && err.code === "ENOENT") return resolve({ ip, available: false, hops: [] });
      resolve({ ip, available: true, hops: parseTraceroute(stdout) });
    });
  });
}

/* ---------- Noms : NetBIOS et mDNS ---------- */
function encodeNetbiosName(name) {
  const n = (name + "                ").slice(0, 16);
  const out = Buffer.alloc(34);
  out[0] = 32;
  for (let i = 0; i < 16; i++) {
    const c = n.charCodeAt(i);
    out[1 + i * 2] = 0x41 + (c >> 4);
    out[2 + i * 2] = 0x41 + (c & 0x0f);
  }
  out[33] = 0;
  return out;
}

function nbstatQuery() {
  const head = Buffer.from([0x50, 0x42, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const name = encodeNetbiosName("*\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0");
  return Buffer.concat([head, name, Buffer.from([0x00, 0x21, 0x00, 0x01])]);
}

/* Reponse NBSTAT : liste de noms (15 caracteres + suffixe), groupe de
   travail reconnu par le drapeau « groupe ». Parses an NBSTAT reply. */
function parseNbstat(buf) {
  try {
    let off = 12;
    while (off < buf.length && buf[off] !== 0) off += buf[off] + 1;
    off += 1 + 2 + 2 + 4 + 2; // fin du nom, type, classe, TTL, longueur
    const count = buf[off]; off += 1;
    const names = [];
    for (let i = 0; i < count && off + 18 <= buf.length; i++) {
      const name = buf.slice(off, off + 15).toString("latin1").trim();
      const suffix = buf[off + 15];
      const flags = buf.readUInt16BE(off + 16);
      names.push({ name, suffix, group: !!(flags & 0x8000) });
      off += 18;
    }
    let mac = null;
    if (off + 6 <= buf.length) mac = normalizeMac(buf.slice(off, off + 6).toString("hex"));
    const host = names.find((n) => n.suffix === 0x00 && !n.group);
    const group = names.find((n) => n.suffix === 0x00 && n.group);
    return { name: host ? host.name : null, workgroup: group ? group.name : null, mac: mac && mac !== "00:00:00:00:00:00" ? mac : null };
  } catch (e) { return null; }
}

function udpQuery(ip, port, payload, timeoutMs) {
  return new Promise((resolve) => {
    let sock;
    try { sock = dgram.createSocket("udp4"); } catch (e) { return resolve(null); }
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { sock.close(); } catch (e) { /* noop */ } resolve(v); };
    const timer = setTimeout(() => finish(null), timeoutMs || 1500);
    sock.on("message", (msg) => { clearTimeout(timer); finish(msg); });
    sock.on("error", () => { clearTimeout(timer); finish(null); });
    sock.send(payload, port, ip, (err) => { if (err) { clearTimeout(timer); finish(null); } });
  });
}

async function netbiosName(ip) {
  const r = await udpQuery(ip, 137, nbstatQuery(), 1500);
  return r ? parseNbstat(r) : null;
}

/* Requete mDNS envoyee directement a l'hote (« legacy unicast ») : nom
   inverse PTR de son adresse. Avahi et Bonjour y repondent.
   mDNS query sent straight to the host: reverse PTR of its address. */
function mdnsQuery(ip) {
  const labels = ip.split(".").reverse().concat(["in-addr", "arpa"]);
  const parts = [Buffer.from([0x12, 0x34, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0])];
  for (const l of labels) parts.push(Buffer.from([l.length]), Buffer.from(l, "ascii"));
  parts.push(Buffer.from([0, 0x00, 0x0c, 0x00, 0x01]));
  return Buffer.concat(parts);
}

function readDnsName(buf, off, depth) {
  const labels = [];
  let jumped = false, end = off;
  for (let guard = 0; guard < 64 && off < buf.length; guard++) {
    const len = buf[off];
    if (len === 0) { if (!jumped) end = off + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = off + 2;
      if ((depth || 0) > 8) break;
      off = ((len & 0x3f) << 8) | buf[off + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.slice(off + 1, off + 1 + len).toString("utf8"));
    off += len + 1;
  }
  return { name: labels.join("."), end };
}

function parseMdnsPtr(buf) {
  try {
    const qd = buf.readUInt16BE(4), an = buf.readUInt16BE(6);
    let off = 12;
    for (let i = 0; i < qd; i++) off = readDnsName(buf, off).end + 4;
    for (let i = 0; i < an; i++) {
      const n = readDnsName(buf, off); off = n.end;
      const type = buf.readUInt16BE(off); const rdlen = buf.readUInt16BE(off + 8);
      off += 10;
      if (type === 12) return readDnsName(buf, off).name.replace(/\.$/, "");
      off += rdlen;
    }
  } catch (e) { /* noop */ }
  return null;
}

async function mdnsName(ip) {
  const r = await udpQuery(ip, 5353, mdnsQuery(ip), 1500);
  return r ? parseMdnsPtr(r) : null;
}

function dnsReverse(ip) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    dns.reverse(ip, (err, names) => { clearTimeout(timer); resolve(err || !names || !names.length ? null : names[0].replace(/\.$/, "")); });
  });
}

/* ---------- Wake-on-LAN ---------- */
function magicPacket(mac) {
  const m = normalizeMac(mac);
  if (!m) throw new Error("invalid mac");
  const hw = Buffer.from(m.replace(/:/g, ""), "hex");
  return Buffer.concat([Buffer.alloc(6, 0xff)].concat(Array(16).fill(hw)));
}

function broadcastFor(ip, cidrs) {
  const out = new Set(["255.255.255.255"]);
  const n = ipToInt(ip);
  for (const c of cidrs || []) {
    const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/.exec(String(c));
    if (!m) continue;
    const bits = Number(m[2]);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const base = ipToInt(m[1]) & mask;
    if (n != null && ((n & mask) >>> 0) === (base >>> 0)) {
      const b = (base | (~mask >>> 0)) >>> 0;
      out.add([b >>> 24, (b >>> 16) & 255, (b >>> 8) & 255, b & 255].join("."));
    }
  }
  return [...out];
}

function wakeOnLan(mac, targets) {
  const pkt = magicPacket(mac);
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    let sent = 0, pending = 0;
    const done = () => { try { sock.close(); } catch (e) { /* noop */ } resolve({ sent }); };
    sock.on("error", done);
    sock.bind(0, () => {
      try { sock.setBroadcast(true); } catch (e) { /* noop */ }
      for (const t of targets) for (const port of [9, 7]) {
        pending++;
        sock.send(pkt, port, t, (err) => { if (!err) sent++; if (--pending === 0) done(); });
      }
      if (!pending) done();
    });
  });
}

module.exports = {
  isPrivateIp,
  normalizeMac,
  macInfo,
  pingCommand,
  parsePingOutput,
  ping,
  tcpProbe,
  COMMON_PORTS,
  portsForScope,
  startPortJob,
  getPortJob,
  stopPortJob,
  parsePortList,
  parseHttpHead,
  scanPorts,
  tracerouteCommand,
  parseTraceroute,
  traceroute,
  encodeNetbiosName,
  parseNbstat,
  netbiosName,
  mdnsQuery,
  parseMdnsPtr,
  mdnsName,
  dnsReverse,
  magicPacket,
  broadcastFor,
  wakeOnLan
};
