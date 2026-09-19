/* Tests hors ligne de l'enregistrement IPTV (server/iptvRecord.js) :
   nommage, garde-fous, reprise apres coupure, assemblage des parties et
   enregistrements programmes. Aucun reseau, aucun ffmpeg : seules les
   decisions et les manipulations de fichiers sont verifiees.
   Offline tests of IPTV recording: naming, guards, retry, part
   concatenation and schedules. No network, no ffmpeg. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = require("../server/iptvRecord.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("== Enregistrement IPTV ==");

test("nom : chaine, programme et horodatage", () => {
  const d = new Date(2026, 8, 19, 20, 41);
  assert.strictEqual(R.buildFileName({ channel: "TF1 HD", programme: "Le Journal", date: d }),
    "TF1 HD - Le Journal - 2026-09-19 20h41");
});

test("nom : sans programme, la chaine et l'heure suffisent", () => {
  const d = new Date(2026, 0, 3, 9, 5);
  assert.strictEqual(R.buildFileName({ channel: "Arte", date: d }), "Arte - 2026-01-03 09h05");
  assert.strictEqual(R.buildFileName({ date: d }), "IPTV - 2026-01-03 09h05");
});

test("nom : caracteres interdits sous Windows retires", () => {
  const d = new Date(2026, 0, 3, 9, 5);
  const n = R.buildFileName({ channel: 'FR3 : Rhône/Alpes *?"<>|', date: d });
  assert.ok(!/[\\/:*?"<>|]/.test(n), n);
  assert.ok(/^FR3 Rhône Alpes/.test(n), n);
});

test("nom : un programme identique a la chaine n'est pas repete", () => {
  const d = new Date(2026, 0, 3, 9, 5);
  assert.strictEqual(R.buildFileName({ channel: "Arte", programme: "arte", date: d }), "Arte - 2026-01-03 09h05");
});

test("nom : deux enregistrements dans la meme minute ne s'ecrasent pas", () => {
  assert.strictEqual(R.uniqueName("Arte - 2026-01-03 09h05", []), "Arte - 2026-01-03 09h05");
  assert.strictEqual(R.uniqueName("Arte - 2026-01-03 09h05", ["Arte - 2026-01-03 09h05.ts"]),
    "Arte - 2026-01-03 09h05 (2)");
  assert.strictEqual(R.uniqueName("A", ["a.ts", "A (2).ts"]), "A (3)");
});

test("garde-fou : duree maximale", () => {
  assert.strictEqual(R.stopReason({ elapsedMs: 10 * 60000 }, { maxMinutes: 240 }), null);
  assert.strictEqual(R.stopReason({ elapsedMs: 240 * 60000 }, { maxMinutes: 240 }), "max-duration");
  assert.strictEqual(R.stopReason({ elapsedMs: 9e9 }, { maxMinutes: 0 }), null, "0 = pas de limite");
});

test("garde-fou : espace disque", () => {
  assert.strictEqual(R.stopReason({ elapsedMs: 0, freeMB: 500 }, { minFreeMB: 1024 }), "disk-full");
  assert.strictEqual(R.stopReason({ elapsedMs: 0, freeMB: 2048 }, { minFreeMB: 1024 }), null);
  assert.strictEqual(R.stopReason({ elapsedMs: 0, freeMB: null }, { minFreeMB: 1024 }), null,
    "espace inconnu : on n'arrete pas a tort");
});

test("reprise : seulement si l'arret n'a pas ete demande", () => {
  assert.strictEqual(R.shouldRetry({ retries: 0, stopping: false }, 20), true);
  assert.strictEqual(R.shouldRetry({ retries: 0, stopping: true }, 20), false);
  assert.strictEqual(R.shouldRetry({ retries: 0, stopReason: "max-duration" }, 20), false);
  assert.strictEqual(R.shouldRetry({ retries: 20, stopping: false }, 20), false);
});

test("reprise : delai croissant, plafonne", () => {
  const d0 = R.retryDelayMs(0), d3 = R.retryDelayMs(3), d50 = R.retryDelayMs(50);
  assert.ok(d0 >= 2000 && d0 <= 3000);
  assert.ok(d3 > d0);
  assert.strictEqual(d50, 30000);
});

test("programmation : ce qui est du maintenant, ce qui a ete manque", () => {
  const now = new Date("2026-09-19T20:00:00Z");
  const list = [
    { id: "a", startAt: "2026-09-19T20:00:00Z" },
    { id: "b", startAt: "2026-09-19T21:00:00Z" },
    { id: "c", startAt: "2026-09-19T18:00:00Z" },
    { id: "d", startAt: "2026-09-19T18:00:00Z", done: true },
    { id: "e", startAt: "pas une date" }
  ];
  const { due, missed } = R.scheduleDue(list, now);
  assert.deepStrictEqual(due.map((x) => x.id), ["a"]);
  assert.deepStrictEqual(missed.map((x) => x.id), ["c"], "un rendez-vous passe n'est pas lance en retard");
});

test("programmation : duree depuis une fin, ou donnee directement", () => {
  assert.strictEqual(R.scheduleDurationMinutes({ startAt: "2026-09-19T20:00:00Z", endAt: "2026-09-19T21:30:00Z" }), 90);
  assert.strictEqual(R.scheduleDurationMinutes({ durationMinutes: 45 }), 45);
  assert.strictEqual(R.scheduleDurationMinutes({}), 0);
});

test("dossier : cree s'il manque, erreur claire s'il est impossible", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-rec-"));
  const dir = path.join(base, "sous", "dossier");
  assert.strictEqual(R.ensureDir(dir), dir);
  assert.ok(fs.existsSync(dir));
  const file = path.join(base, "fichier");
  fs.writeFileSync(file, "x");
  assert.throws(() => R.ensureDir(file), /ENOTDIR|EEXIST/);
  fs.rmSync(base, { recursive: true, force: true });
});

test("dossier : les parties en cours ne sont pas listees comme des enregistrements", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-rec-"));
  fs.writeFileSync(path.join(dir, "Arte.ts"), "aa");
  fs.writeFileSync(path.join(dir, "Arte.part2.ts"), "bb");
  fs.writeFileSync(path.join(dir, "Arte.mp4"), "cc");
  fs.writeFileSync(path.join(dir, "notes.txt"), "dd");
  const names = R.files(dir).map((f) => f.name).sort();
  assert.deepStrictEqual(names, ["Arte.mp4", "Arte.ts"]);
  assert.strictEqual(R.remove(dir, "Arte.mp4"), true);
  assert.strictEqual(R.remove(dir, "absent.ts"), false);
  assert.strictEqual(R.remove(dir, "../../etc/passwd"), false, "un chemin remontant ne sort pas du dossier");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("espace libre : un nombre, ou null si le dossier n'existe pas", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-rec-"));
  const mb = R.freeMB(dir);
  assert.ok(mb === null || (typeof mb === "number" && mb >= 0));
  assert.strictEqual(R.freeMB(path.join(dir, "absent")), null);
  fs.rmSync(dir, { recursive: true, force: true });
});


/* ---------- Moteur complet : derivation du flux du lecteur ----------
   Aucun ffmpeg, aucun reseau : un flux en memoire joue le role du flux
   du fournisseur tel que PiBoard le lit pour le lecteur. C'est ce que
   l'enregistrement derive depuis la 1.113.1 -- plus de seconde
   connexion.
   No ffmpeg, no network: an in-memory stream plays the provider's
   stream as PiBoard reads it for the player. That is what recording
   taps since 1.113.1 -- no second connection. */
async function engineTests() {
  const { PassThrough } = require("stream");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-rec-e2e-"));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let ok = 0, ko = 0;
  const check = (name, cond) => { if (cond) { ok++; console.log("  OK   " + name); } else { ko++; console.log("  FAIL " + name); } };

  // Sans flux en cours, l'enregistrement refuse plutot que d'ouvrir une
  // connexion a lui : c'est tout l'objet du correctif.
  let refused = null;
  try { await R.start({ sid: "absent", channel: "Arte", dir }); } catch (e) { refused = e; }
  check("derivation : sans flux en cours, l'enregistrement est refuse",
    refused && refused.code === "no-stream");

  const source = new PassThrough();
  const closeTap = R.openTap("sid1", source);
  source.write(Buffer.from("AVANT"));          // avant l'enregistrement
  await wait(30);

  const rec = await R.start({ sid: "sid1", channel: "Arte", dir });
  check("derivation : l'enregistrement demarre sur le flux en cours",
    rec.status === "recording" && rec.sid === "sid1" && R.list().length === 1);
  source.write(Buffer.from("PENDANT"));
  await wait(60);

  // Coupure du flux : le lecteur se reconnecte, le fichier continue.
  closeTap();
  await wait(30);
  check("derivation : une coupure met l'enregistrement en reconnexion",
    R.list()[0].status === "reconnecting" && R.list()[0].retries === 1);
  const source2 = new PassThrough();
  R.openTap("sid1", source2);
  await wait(30);
  check("derivation : la nouvelle derivation reprend l'enregistrement", R.list()[0].status === "recording");
  source2.write(Buffer.from("APRES"));
  await wait(60);

  const view = R.stop(rec.id, "user");
  await wait(60);
  const file = path.join(dir, view.file);
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  check("derivation : seul ce qui suit l'appui est enregistre", content.startsWith("PENDANT"));
  check("derivation : la reprise continue le MEME fichier, a la suite", content === "PENDANTAPRES");
  check("derivation : plus rien n'est en cours, l'enregistrement est termine",
    R.list().length === 0 && R.recent()[0].status === "done");

  // Fin de la lecture : ce qui en vivait s'arrete.
  const source3 = new PassThrough();
  R.openTap("sid2", source3);
  const rec2 = await R.start({ sid: "sid2", channel: "TF1", dir });
  source3.write(Buffer.from("X"));
  await wait(40);
  R.stopForSid("sid2", "stream-ended");
  check("derivation : fermer le lecteur arrete son enregistrement", R.list().length === 0);
  check("derivation : le fichier est conserve", fs.existsSync(path.join(dir, rec2.file)));

  // Un enregistrement sans un octet ne doit pas laisser de fichier vide.
  const source4 = new PassThrough();
  R.openTap("sid3", source4);
  const rec3 = await R.start({ sid: "sid3", channel: "Vide", dir });
  R.stop(rec3.id, "user");
  await wait(120);
  check("derivation : un enregistrement vide ne laisse pas de fichier",
    !fs.existsSync(path.join(dir, rec3.file)) && R.recent()[0].status === "failed");

  fs.rmSync(dir, { recursive: true, force: true });
  return { ok, ko };
}

engineTests().then(({ ko }) => {
  failures += ko;
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failures ? 1 : 0);
});
