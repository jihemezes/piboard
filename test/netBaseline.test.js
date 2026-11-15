/* Test unitaire de server/netBaseline.js : fonctions PURES uniquement
   (observation d'une analyse, annotation, memorisation, reconnaissance,
   revendication). Aucun acces au disque. */
"use strict";
const assert = require("assert");
const nb = require("../server/netBaseline");

const T0 = "2026-11-01T10:00:00.000Z";
const T1 = "2026-11-01T10:10:00.000Z";
const T2 = "2026-11-01T10:20:00.000Z";
const T3 = "2026-11-01T10:30:00.000Z";
const self = { ip: "192.168.1.2", mac: "b8:27:eb:00:00:01", hostname: "pi", isSelf: true };
const tv = { ip: "192.168.1.20", mac: "a8:bb:cc:00:00:20", hostname: "tv" };
const nas = { ip: "192.168.1.30", mac: "a8:bb:cc:00:00:30", hostname: "nas" };
const phone = { ip: "192.168.1.40", mac: "da:a1:19:00:00:40", hostname: null }; // bit local = MAC aleatoire
const scan = (hosts) => ({ hosts, cidr: "192.168.1.0/24", scannedAt: T0 });
const keyOf = (h) => "mac:" + h.mac;

console.log("== isRandomMac ==");
assert.strictEqual(nb.isRandomMac("da:a1:19:00:00:40"), true);
assert.strictEqual(nb.isRandomMac("a8:bb:cc:00:00:20"), false);
assert.strictEqual(nb.isRandomMac("aa:bb:cc:00:00:20"), true, "aa = bit local");
assert.strictEqual(nb.isRandomMac("02:00:00:00:00:01"), true);
assert.strictEqual(nb.isRandomMac(null), false);
console.log("  OK");

console.log("== observe : premiere vue, sans reference ==");
let st = nb.observe(nb.emptyState(), scan([self, tv, nas]), T0);
assert.strictEqual(Object.keys(st.seen).length, 3);
assert.strictEqual(st.seen[keyOf(tv)].firstSeen, T0);
assert.ok(st.log.every((e) => e.type === "arrive"), "sans reference rien n'est « new »");
let ann = nb.annotate(st, [Object.assign({ key: keyOf(tv) }, tv)], {});
assert.strictEqual(ann.baseline, null);
assert.strictEqual(ann.hosts[0].status, null);
assert.strictEqual(ann.alertCount, 0);
console.log("  OK");

console.log("== memorize puis nouvel hote ==");
st = nb.memorize(st, scan([self, tv, nas]).hosts, {}, T1);
assert.strictEqual(Object.keys(st.baseline.hosts).length, 3);
assert.strictEqual(st.log[st.log.length - 1].type, "baseline");
st = nb.observe(st, scan([self, tv, nas, phone]), T2);
const newcomer = { ip: "192.168.1.50", mac: "a8:bb:cc:00:00:50", hostname: "intrus" };
st = nb.observe(st, scan([self, tv, nas, newcomer]), T2);
ann = nb.annotate(st, scan([self, tv, nas, newcomer, phone]).hosts, {}, {});
const byIp = Object.fromEntries(ann.hosts.map((h) => [h.ip, h]));
assert.strictEqual(byIp["192.168.1.20"].status, "known");
assert.strictEqual(byIp["192.168.1.50"].status, "new");
assert.strictEqual(byIp["192.168.1.50"].alert, true);
assert.strictEqual(byIp["192.168.1.50"].eventId, "new:mac:a8:bb:cc:00:00:50");
assert.strictEqual(byIp["192.168.1.40"].status, "new");
assert.strictEqual(byIp["192.168.1.40"].randomMac, true);
assert.strictEqual(byIp["192.168.1.40"].alert, false, "MAC aleatoire : pas d'alerte par defaut");
assert.strictEqual(ann.newCount, 2);
assert.strictEqual(ann.alertCount, 1);
ann = nb.annotate(st, scan([self, tv, nas, newcomer, phone]).hosts, {}, { alertRandom: true });
assert.strictEqual(ann.alertCount, 2, "alertRandom l'active");
assert.ok(st.log.some((e) => e.type === "new" && e.ip === "192.168.1.50"));
console.log("  OK");

console.log("== acknowledge : le nouvel hote devient connu ==");
const named = scan([self, tv, nas, newcomer]).hosts.map((h) => Object.assign({ key: keyOf(h) }, h));
st = nb.acknowledge(st, [keyOf(newcomer), "n'importe quoi"], named, {}, T3);
ann = nb.annotate(st, named, {}, {});
assert.strictEqual(ann.newCount, 0);
assert.throws(() => nb.acknowledge(nb.emptyState(), [keyOf(tv)], named, {}), /no baseline/);
console.log("  OK");

console.log("== depart apres deux analyses seulement ==");
st = nb.observe(st, scan([self, tv, newcomer]), "2026-11-01T11:00:00.000Z");
assert.strictEqual(st.seen[keyOf(nas)].present, true, "un seul scan manque : toujours present");
assert.ok(!st.log.some((e) => e.type === "leave" && e.ip === "192.168.1.30"));
st = nb.observe(st, scan([self, tv, newcomer]), "2026-11-01T11:10:00.000Z");
assert.strictEqual(st.seen[keyOf(nas)].present, false);
assert.ok(st.log.some((e) => e.type === "leave" && e.ip === "192.168.1.30"));
st = nb.observe(st, scan([self, tv, newcomer, nas]), "2026-11-01T11:20:00.000Z");
assert.strictEqual(st.log[st.log.length - 1].type, "arrive");
assert.strictEqual(st.seen[keyOf(nas)].present, true);
console.log("  OK");

console.log("== analyse ratee (aucun hote autre que soi) : aucun depart ==");
const before = JSON.stringify(st.seen);
const after = nb.observe(st, scan([self]), "2026-11-01T12:00:00.000Z");
after.seen = JSON.parse(JSON.stringify(after.seen));
assert.strictEqual(JSON.stringify(after.seen), before);
console.log("  OK");

console.log("== changement d'identite (IP / nom) ==");
st = nb.observe(st, scan([self, tv, newcomer, Object.assign({}, nas, { ip: "192.168.1.99" })]), "2026-11-01T12:10:00.000Z");
assert.ok(st.seen[keyOf(nas)].changed, "IP modifiee");
assert.strictEqual(st.seen[keyOf(nas)].changed.fromIp, "192.168.1.30");
const hostsNow = [self, tv, newcomer, Object.assign({}, nas, { ip: "192.168.1.99" })].map((h) => Object.assign({ key: keyOf(h) }, h));
ann = nb.annotate(st, hostsNow, {}, {});
const nasAnn = ann.hosts.find((h) => h.mac === nas.mac);
assert.ok(nasAnn.changed);
assert.ok(nasAnn.eventId.startsWith("changed:mac:a8:bb:cc:00:00:30:"));
assert.strictEqual(ann.changedCount, 1);
st = nb.acknowledge(st, [keyOf(nas)], hostsNow, {}, "2026-11-01T12:20:00.000Z");
assert.strictEqual(st.seen[keyOf(nas)].changed, null, "reconnaitre efface le changement");
st = nb.observe(st, scan([self, tv, newcomer, Object.assign({}, nas, { hostname: "autre" , ip: "192.168.1.99"})]), "2026-11-01T12:30:00.000Z");
assert.ok(st.seen[keyOf(nas)].changed, "nom modifie");
console.log("  OK");

console.log("== absence prolongee ==");
let s2 = nb.memorize(nb.emptyState(), [self, tv, nas].map((h) => Object.assign({ key: keyOf(h) }, h)), {}, T0);
s2 = nb.observe(s2, scan([self, tv, nas]), T0);
const later = "2026-11-01T20:00:00.000Z"; // 10 h plus tard
const nasLost = [self, tv].map((h) => Object.assign({ key: keyOf(h) }, h));
ann = nb.annotate(s2, nasLost, { [keyOf(nas)]: { name: "Mon NAS" } }, { absentHours: 6, now: later });
assert.strictEqual(ann.absent.length, 1);
assert.strictEqual(ann.absent[0].name, "Mon NAS");
assert.ok(ann.absent[0].eventId.startsWith("absent:mac:a8:bb:cc:00:00:30:"));
ann = nb.annotate(s2, nasLost, {}, { absentHours: 12, now: later });
assert.strictEqual(ann.absent.length, 0, "pas encore 12 h");
ann = nb.annotate(s2, nasLost, {}, { absentHours: 0, now: later });
assert.strictEqual(ann.absent.length, 0, "0 = desactive");
console.log("  OK");

console.log("== forget / reset ==");
s2 = nb.forget(s2, [keyOf(nas), "x"]);
assert.strictEqual(Object.keys(s2.baseline.hosts).length, 2);
s2 = nb.reset(s2);
assert.strictEqual(s2.baseline, null);
assert.strictEqual(nb.annotate(s2, nasLost, {}, {}).baseline, null);
console.log("  OK");

console.log("== claim : une seule revendication par evenement ==");
let c = nb.claim(nb.emptyState(), ["new:mac:a8:bb:cc:00:00:20", "pas un id", "new:mac:a8:bb:cc:00:00:20"], T0);
assert.deepStrictEqual(c.granted, ["new:mac:a8:bb:cc:00:00:20"]);
c = nb.claim(c.state, ["new:mac:a8:bb:cc:00:00:20", "new:mac:a8:bb:cc:00:00:21"], T1);
assert.deepStrictEqual(c.granted, ["new:mac:a8:bb:cc:00:00:21"]);
// un nouvel hote deja revendique n'est pas re-annonce apres memorize (claims purges)
assert.deepStrictEqual(nb.memorize(c.state, nasLost, {}, T2).claims, {});
console.log("  OK");

console.log("== sanitize : fichier abime ==");
assert.deepStrictEqual(nb.sanitize(null), nb.emptyState());
const dirty = nb.sanitize({
  baseline: { at: T0, hosts: { "mac:a8:bb:cc:00:00:20": { ip: "1.2.3.4", name: "x".repeat(500) }, "poubelle": {} } },
  seen: { "mac:zz": {}, "ip:192.168.1.5": { ip: "192.168.1.5", firstSeen: "n'importe quoi" } },
  log: [{ t: "pas une date", type: "new" }, { t: T0, type: "inconnu" }, { t: T0, type: "new", key: "ip:192.168.1.5" }],
  claims: { "new:mac:a8:bb:cc:00:00:20": T0, "evil": T0 }
});
assert.strictEqual(Object.keys(dirty.baseline.hosts).length, 1);
assert.strictEqual(dirty.baseline.hosts["mac:a8:bb:cc:00:00:20"].name.length, 80);
assert.strictEqual(Object.keys(dirty.seen).length, 1);
assert.strictEqual(dirty.log.length, 1);
assert.deepStrictEqual(Object.keys(dirty.claims), ["new:mac:a8:bb:cc:00:00:20"]);
console.log("  OK");

console.log("== hote sans MAC (cle ip:) ==");
const noMac = { ip: "192.168.1.77", mac: null, hostname: "cam" };
let s3 = nb.memorize(nb.emptyState(), [self, noMac], {}, T0);
assert.ok(s3.baseline.hosts["ip:192.168.1.77"]);
s3 = nb.observe(s3, scan([self, noMac, { ip: "192.168.1.78", mac: null }]), T1);
ann = nb.annotate(s3, [self, noMac, { ip: "192.168.1.78", mac: null }], {}, {});
assert.strictEqual(ann.newCount, 1);
console.log("  OK");

console.log("netBaseline : tous les tests OK");
