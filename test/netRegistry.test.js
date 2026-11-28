/* Referentiel reseau : fiches cumulatives, fusion entre PiBoard (1.181.0)
   Network registry: cumulative records, merge between PiBoards */
"use strict";
const assert = require("assert");
const nb = require("../server/netBaseline");
const reg = require("../server/netRegistry");

let n = 0;
const ok = (name, cond) => { assert.ok(cond, name); n++; console.log("  OK   " + name); };

const T0 = "2026-11-01T10:00:00.000Z", T1 = "2026-11-02T10:00:00.000Z", T2 = "2026-11-03T10:00:00.000Z", T3 = "2026-11-04T10:00:00.000Z";
const gw = { ip: "192.168.1.1", mac: "aa:aa:aa:00:00:01" };
const H = {
  box: { ip: "192.168.1.1", mac: "aa:aa:aa:00:00:01", hostname: "box" },
  tv: { ip: "192.168.1.20", mac: "a8:bb:cc:00:00:20", hostname: null, vendor: "Samsung" },
  nas: { ip: "192.168.1.30", mac: "a8:bb:cc:00:00:30", hostname: "nas" },
  prn: { ip: "192.168.1.40", mac: "a8:bb:cc:00:00:40", hostname: null, vendor: "HP" },
  self: { ip: "192.168.1.10", mac: "a8:bb:cc:00:00:10", hostname: "mac-mini", isSelf: true },
  phone: { ip: "192.168.1.50", mac: "3a:bb:cc:00:00:50", hostname: "iphone" } // MAC aleatoire
};
const withKey = (list) => list.map((h) => Object.assign({ key: "mac:" + h.mac }, h));
const scan = (list) => ({ cidr: "192.168.1.0/24", gateway: gw, hosts: list });

console.log("== referentiel cumulatif ==");
let A = nb.observe(nb.emptyState(), scan([H.self, H.box, H.tv, H.nas]), T0);
A = nb.memorize(A, withKey([H.self, H.box, H.tv, H.nas]), {}, T0, "gw:aa:aa:aa:00:00:01");
ok("4 fiches", Object.keys(A.baseline.hosts).length === 4);
A = nb.observe(A, scan([H.self, H.box, H.prn]), T1);
A = nb.memorize(A, withKey([H.self, H.box, H.prn]), {}, T1);
ok("mise a jour cumulative : la TV et le NAS absents restent", Object.keys(A.baseline.hosts).length === 5 && A.baseline.hosts["mac:" + H.tv.mac]);
ok("nombre ajoute", A.lastMemorize.added === 1);
ok("reseau reconnu par la MAC de la passerelle", A.currentNet === "gw:aa:aa:aa:00:00:01" && A.networks[A.currentNet].gatewayIp === "192.168.1.1");
ok("vu par ce PiBoard", Object.keys(A.baseline.hosts["mac:" + H.box.mac].seenBy).length === 1);
ok("historique des IP", A.baseline.hosts["mac:" + H.box.mac].ips.length === 1 && A.baseline.hosts["mac:" + H.box.mac].ips[0].net === A.currentNet);
const net2 = nb.networkIdOf({ cidr: "192.168.1.0/24", gateway: { ip: "192.168.1.1", mac: "bb:bb:bb:00:00:01" } });
ok("meme sous-reseau, autre box = autre reseau", net2.id !== A.currentNet);
ok("sans passerelle : reseau suppose", nb.networkIdOf({ cidr: "10.0.0.0/24" }).assumed === true);

console.log("== noms repris de netHosts.json ==");
const aliasesA = { ["mac:" + H.tv.mac]: { name: "TV salon", updatedAt: T1 }, "mac:c0:ff:ee:00:00:99": { name: "Imprimante etage", updatedAt: T0 } };
let s = reg.syncNames(A, aliasesA, T1);
A = s.state;
ok("nom copie dans la fiche", A.baseline.hosts["mac:" + H.tv.mac].fields.name.v === "TV salon");
ok("appareil nomme mais jamais memorise : ajoute au referentiel", !!A.baseline.hosts["mac:c0:ff:ee:00:00:99"]);
ok("deuxieme passage : rien a changer", reg.syncNames(A, aliasesA, T1).changed === false);
A = nb.sanitize(JSON.parse(JSON.stringify(A)));
ok("tout survit a l'enregistrement", A.baseline.hosts["mac:" + H.tv.mac].fields.name.v === "TV salon" && A.self && A.self.id);

console.log("== champs de la fiche ==");
A = reg.setFields(A, "mac:" + H.tv.mac, { type: "tv", owner: "Famille", notes: "Au mur", trusted: true }, T1);
const tvA = A.baseline.hosts["mac:" + H.tv.mac];
ok("type, proprietaire, notes, confiance", tvA.fields.type.v === "tv" && tvA.fields.owner.v === "Famille" && tvA.fields.trusted.v === true);
ok("type inconnu ramene a autre", reg.setFields(A, "mac:" + H.tv.mac, { type: "grille-pain" }, T1).baseline.hosts["mac:" + H.tv.mac].fields.type.v === "other");
A = reg.setNetworkName(A, A.currentNet, "Maison", T1);
const ann = nb.annotate(A, withKey([H.tv]), aliasesA, {});
ok("la tuile recoit la fiche et le reseau", ann.hosts[0].reg.type === "tv" && ann.network.name === "Maison");

console.log("== second PiBoard et fusion ==");
let B = nb.observe(nb.emptyState(), scan([H.box, H.tv, H.nas, H.phone]), T1);
B = nb.memorize(B, withKey([H.box, H.tv, H.nas, H.phone]), {}, T1, "gw:aa:aa:aa:00:00:01");
B = reg.syncNames(B, { ["mac:" + H.nas.mac]: { name: "NAS Synology", updatedAt: T1 } }, T1).state;
ok("identites differentes", A.self.id !== B.self.id);
const fileB = reg.exportRegistry(B, T2);
ok("MAC aleatoire jamais exportee", !fileB.devices["mac:" + H.phone.mac]);
let plan = reg.planMerge(A, aliasesA, fileB);
ok("plan : le nom du NAS arrive", plan.updated.some((u) => u.key === "mac:" + H.nas.mac && u.changes.some((c) => c.field === "name" && c.to === "NAS Synology")));
ok("plan : aucun conflit", plan.conflicts.length === 0);
let m = reg.applyMerge(A, aliasesA, fileB, {}, T2);
A = m.state;
ok("nom recu ecrit dans netHosts", m.aliases["mac:" + H.nas.mac].name === "NAS Synology");
ok("vu par les deux PiBoard", Object.keys(A.baseline.hosts["mac:" + H.nas.mac].seenBy).length === 2);
const fileA = reg.exportRegistry(A, T2);
m = reg.applyMerge(B, {}, fileA, {}, T2);
B = m.state;
ok("fusion inverse : B recoit la fiche TV (nom, type, notes)", B.baseline.hosts["mac:" + H.tv.mac].fields.name.v === "TV salon" && B.baseline.hosts["mac:" + H.tv.mac].fields.notes.v === "Au mur");
ok("fusion inverse : B recoit l'imprimante", !!B.baseline.hosts["mac:" + H.prn.mac]);
ok("fusion inverse : nom du reseau recu", B.networks["gw:aa:aa:aa:00:00:01"].name.v === "Maison");
ok("B garde sa MAC aleatoire locale", !!B.baseline.hosts["mac:" + H.phone.mac]);
plan = reg.planMerge(A, m.aliases, reg.exportRegistry(B, T2));
ok("apres aller-retour : plus rien a fusionner", plan.added.length === 0 && plan.updated.length === 0 && plan.conflicts.length === 0);

console.log("== mise a jour simple, pas un conflit ==");
B = reg.setFields(B, "mac:" + H.tv.mac, { notes: "Au mur, HDMI 2" }, T3);
plan = reg.planMerge(A, {}, reg.exportRegistry(B, T3));
ok("modifie sur B en connaissant A : mise a jour", plan.conflicts.length === 0 && plan.updated.length === 1);

console.log("== vrai conflit ==");
A = reg.setFields(A, "mac:" + H.prn.mac, { owner: "Jean-Michel" }, T3);
B = reg.setFields(B, "mac:" + H.prn.mac, { owner: "Bureau" }, "2026-11-04T11:00:00.000Z");
plan = reg.planMerge(A, {}, reg.exportRegistry(B, T3));
const c = plan.conflicts.find((x) => x.field === "owner");
ok("conflit detecte et montre", !!c && c.local.v === "Jean-Michel" && c.remote.v === "Bureau");
ok("suggestion = le plus recent", c.suggested === "remote");
m = reg.applyMerge(A, {}, reg.exportRegistry(B, T3), { [c.id]: "local" }, "2026-11-04T12:00:00.000Z");
ok("choix de l'utilisateur respecte", m.state.baseline.hosts["mac:" + H.prn.mac].fields.owner.v === "Jean-Michel");
const B2 = reg.applyMerge(B, {}, reg.exportRegistry(m.state, T3), {}, "2026-11-04T13:00:00.000Z").state;
ok("la decision se propage sans nouveau conflit", B2.baseline.hosts["mac:" + H.prn.mac].fields.owner.v === "Jean-Michel");
A = m.state;

console.log("== oubli propage ==");
A = nb.forget(A, ["mac:" + H.nas.mac], "2026-11-05T10:00:00.000Z");
ok("pierre tombale", !!A.deleted["mac:" + H.nas.mac]);
plan = reg.planMerge(B2, {}, reg.exportRegistry(A, "2026-11-05T10:00:00.000Z"));
ok("plan : suppression annoncee", plan.removed.some((r) => r.key === "mac:" + H.nas.mac));
const aliB = { ["mac:" + H.nas.mac]: { name: "NAS Synology", updatedAt: T1 } };
m = reg.applyMerge(B2, aliB, reg.exportRegistry(A, "2026-11-05T10:00:00.000Z"), {}, "2026-11-05T11:00:00.000Z");
ok("supprime sur B, nom compris", !m.state.baseline.hosts["mac:" + H.nas.mac] && !m.aliases["mac:" + H.nas.mac]);
plan = reg.planMerge(A, {}, reg.exportRegistry(B2, T3));
ok("l'ancien export de B ne ressuscite pas le NAS", !plan.added.some((x) => x.key === "mac:" + H.nas.mac));

console.log("== fichier invalide / CSV ==");
assert.throws(() => reg.planMerge(A, {}, { format: "autre" }), /not a PiBoard/); n++;
ok("types reconnus en francais", reg.normalizeType("Imprimante") === "printer" && reg.normalizeType("box") === "router");
const ex = reg.csvExtras(A);
ok("colonnes CSV du referentiel", ex["mac:" + H.tv.mac].deviceType === "tv" && ex["mac:" + H.tv.mac].trusted === "oui");
const back = reg.applyCsvExtras(A, { ["mac:" + H.tv.mac]: { owner: "Salon", trusted: "non" } }, "2026-11-06T10:00:00.000Z");
ok("CSV relu dans les fiches", back.count === 1 && back.state.baseline.hosts["mac:" + H.tv.mac].fields.owner.v === "Salon" && back.state.baseline.hosts["mac:" + H.tv.mac].fields.trusted.v === false);

console.log(`\nnetRegistry : ${n} verifications OK`);
