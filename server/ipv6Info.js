/* PiBoard - adresses IPv6 de la machine (1.178.0)
   ----------------------------------------------
   Pour la tuile Etat systeme : classe chaque adresse IPv6 d'une carte
   (globale, locale unique fd00::/8, lien local fe80::/10), calcule son
   prefixe reseau (/64 le plus souvent), et repere les adresses
   TEMPORAIRES (adresses de confidentialite, RFC 8981) -- information que
   os.networkInterfaces() ne donne pas : elle vient de `ip -6 addr` sous
   Linux, de `ifconfig` sous macOS et de `netsh` sous Windows. Sans ces
   commandes, les adresses sont toujours la, seule la mention
   « temporaire » manque.
   Machine IPv6 addresses: kind, network prefix, and TEMPORARY (privacy)
   addresses, which only the system commands reveal. */
"use strict";

const net = require("net");
const { execFile } = require("child_process");

/* Developpe une adresse IPv6 en 8 groupes de 16 bits. */
function expand(addr) {
  let a = String(addr || "").split("%")[0].toLowerCase();
  if (!net.isIPv6(a)) return null;
  if (a.includes(".")) { // forme mixte ::ffff:1.2.3.4
    const i = a.lastIndexOf(":");
    const v4 = a.slice(i + 1).split(".").map(Number);
    a = a.slice(0, i + 1) + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const [head, tail] = a.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const groups = h.concat(Array(fill).fill("0"), t).map((g) => parseInt(g || "0", 16));
  return groups.length === 8 ? groups : null;
}

/* Forme courte canonique (RFC 5952). */
function compress(groups) {
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) { i++; continue; }
    let j = i; while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen && j - i > 1) { best = i; bestLen = j - i; }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best < 0) return hex.join(":");
  return hex.slice(0, best).join(":") + "::" + hex.slice(best + bestLen).join(":");
}

function kindOf(addr) {
  const g = expand(addr);
  if (!g) return null;
  if ((g[0] & 0xffc0) === 0xfe80) return "link";
  if ((g[0] & 0xfe00) === 0xfc00) return "ula";
  if ((g[0] & 0xe000) === 0x2000) return "global";
  if (g.every((x, i) => (i < 7 ? x === 0 : x === 1))) return "loopback";
  return "other";
}

/* Prefixe reseau : « 2a01:e0a:1f3:c4d0::/64 ». */
function prefixOf(addr, len) {
  const g = expand(addr);
  const n = Number(len);
  if (!g || !Number.isInteger(n) || n < 0 || n > 128) return null;
  const out = g.map((x, i) => {
    const bits = Math.max(0, Math.min(16, n - i * 16));
    const mask = bits === 0 ? 0 : (0xffff << (16 - bits)) & 0xffff;
    return x & mask;
  });
  return compress(out) + "/" + n;
}

function prefixLen(cidr) {
  const m = /\/(\d{1,3})$/.exec(String(cidr || ""));
  return m ? Number(m[1]) : null;
}

/* ---------- Drapeaux « temporaire » / « obsolete » ---------- */
// Linux : `ip -6 -o addr show`
//   2: eth0    inet6 2a01:e0a::5c3f/64 scope global temporary dynamic \  valid_lft ...
function parseIpAddrLinux(stdout) {
  const out = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const m = /inet6\s+([0-9a-f:]+)\/(\d+)\s+(.*)$/i.exec(line);
    if (!m) continue;
    const rest = m[3];
    out.set(normalize(m[1]), { temporary: /\btemporary\b/.test(rest), deprecated: /\bdeprecated\b/.test(rest) });
  }
  return out;
}
// macOS : `ifconfig` -> « inet6 2a01:e0a::5c3f prefixlen 64 autoconf temporary »
function parseIfconfigDarwin(stdout) {
  const out = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const m = /inet6\s+([0-9a-f:]+)(?:%\S+)?\s+prefixlen\s+\d+(.*)$/i.exec(line);
    if (!m) continue;
    out.set(normalize(m[1]), { temporary: /\btemporary\b/.test(m[2]), deprecated: /\bdeprecated\b/.test(m[2]) });
  }
  return out;
}
// Windows : `netsh interface ipv6 show addresses` (anglais ou francais)
//   Temporary  Preferred  6d23h  23h59m  2a01:e0a::5c3f
//   Temporaire Préféré    ...            2a01:e0a::5c3f
function parseNetshWin(stdout) {
  const out = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 2) continue;
    const addr = cols[cols.length - 1].split("%")[0];
    if (!net.isIPv6(addr)) continue;
    out.set(normalize(addr), { temporary: /^tempor/i.test(cols[0]), deprecated: /deprecated|d[ée]conseill/i.test(line) });
  }
  return out;
}

function normalize(addr) {
  const g = expand(addr);
  return g ? compress(g) : String(addr || "").toLowerCase();
}

function readFlags(platformId) {
  const run = (cmd, args, parse) => new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000, windowsHide: true }, (err, stdout) => resolve(err && !stdout ? new Map() : parse(stdout)));
  });
  if (platformId === "linux") return run("ip", ["-6", "-o", "addr", "show"], parseIpAddrLinux);
  if (platformId === "darwin") return run("/sbin/ifconfig", [], parseIfconfigDarwin);
  if (platformId === "win32") return run("netsh", ["interface", "ipv6", "show", "addresses"], parseNetshWin);
  return Promise.resolve(new Map());
}

/* Detail IPv6 d'une liste d'adresses os.networkInterfaces() d'une carte. */
function describe(addrs, flags) {
  const f = flags || new Map();
  const list = [];
  for (const a of addrs || []) {
    if (!(a.family === "IPv6" || a.family === 6) || a.internal) continue;
    const address = normalize(a.address);
    const kind = kindOf(address);
    if (!kind || kind === "loopback") continue;
    const len = prefixLen(a.cidr) || (a.netmask ? netmaskLen(a.netmask) : null);
    const fl = f.get(address) || {};
    list.push({ address, kind, temporary: !!fl.temporary, deprecated: !!fl.deprecated, prefixLen: len, prefix: len != null && kind !== "link" ? prefixOf(address, len) : null });
  }
  const rank = { global: 0, ula: 1, link: 2, other: 3 };
  return list.sort((x, y) => (rank[x.kind] - rank[y.kind]) || (x.temporary - y.temporary) || (x.deprecated - y.deprecated));
}

function netmaskLen(mask) {
  const g = expand(mask);
  if (!g) return null;
  return g.reduce((n, x) => n + x.toString(2).split("").filter((b) => b === "1").length, 0);
}

module.exports = { expand, compress, kindOf, prefixOf, parseIpAddrLinux, parseIfconfigDarwin, parseNetshWin, normalize, readFlags, describe, netmaskLen };
