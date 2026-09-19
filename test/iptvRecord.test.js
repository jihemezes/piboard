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


/* ---------- Moteur complet, avec un FAUX ffmpeg ----------
   Un petit script remplace ffmpeg : il ecrit dans le fichier demande,
   puis s'arrete tout seul (flux coupe) ou attend qu'on l'arrete. Cela
   exerce pour de vrai la reprise, l'assemblage des parties et l'arret,
   sans reseau ni ffmpeg.
   A small script stands in for ffmpeg: it writes to the requested file,
   then either exits on its own (feed dropped) or waits to be stopped. */
async function engineTests() {
  const iptvAudio = require("../server/iptvAudio.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-rec-e2e-"));
  const fake = path.join(dir, "fake-ffmpeg.js");
  const flag = path.join(dir, "drop.flag");
  fs.writeFileSync(fake, `
    const fs = require("fs");
    const out = process.argv[process.argv.length - 1];
    fs.writeFileSync(out, "X".repeat(1000));
    // Tant que le drapeau existe, on simule un flux qui tombe aussitot.
    if (fs.existsSync(${JSON.stringify(flag)})) { fs.unlinkSync(${JSON.stringify(flag)}); process.exit(1); }
    process.on("SIGTERM", () => { fs.appendFileSync(out, "END"); process.exit(0); });
    setInterval(() => {}, 1000);
  `);
  const realFind = iptvAudio.findFfmpeg;
  // node <script> : le dernier argument reste le fichier de sortie.
  iptvAudio.findFfmpeg = async () => process.execPath;
  const realSpawnArgs = R.__testSpawnPrefix;
  R.__setSpawnPrefix([fake]);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let ok = 0, ko = 0;
  const check = (name, cond) => { if (cond) { ok++; console.log("  OK   " + name); } else { ko++; console.log("  FAIL " + name); } };

  // 1. Enregistrement simple : demarrage, arret, fichier assemble.
  const rec = await R.start({ url: "http://example.invalid/live/1.ts", channel: "Arte", dir });
  check("moteur : l'enregistrement demarre et est listable", R.list().length === 1 && rec.status === "recording");
  await wait(300);
  const stopped = R.stop(rec.id, "user");
  check("moteur : l'arret est pris en compte", !!stopped);
  await wait(400);
  const done = R.recent()[0];
  check("moteur : le fichier final existe et porte le nom de la chaine",
    done && done.status === "done" && fs.existsSync(path.join(dir, done.file)) && /^Arte - /.test(done.file));
  check("moteur : l'arret laisse ffmpeg fermer proprement",
    fs.readFileSync(path.join(dir, done.file), "utf8").endsWith("END"));
  check("moteur : plus rien n'est en cours", R.list().length === 0);

  // 2. Coupure du flux : une deuxieme partie est ecrite, puis assemblee.
  fs.writeFileSync(flag, "1");
  const rec2 = await R.start({ url: "http://example.invalid/live/2.ts", channel: "TF1", dir });
  await wait(2600);   // le temps de la premiere tentative + reprise
  const live = R.list()[0];
  check("moteur : apres une coupure, l'enregistrement repart", live && live.retries >= 1);
  R.stop(rec2.id, "user");
  await wait(500);
  const joined = R.recent()[0];
  const size = joined && fs.statSync(path.join(dir, joined.file)).size;
  check("moteur : les parties sont assemblees en un seul fichier",
    joined && joined.status === "done" && size > 1500
    && !fs.readdirSync(dir).some((n) => /\.part\d+\.ts$/.test(n)));

  iptvAudio.findFfmpeg = realFind;
  R.__setSpawnPrefix(realSpawnArgs || []);
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok, ko };
}

engineTests().then(({ ko }) => {
  failures += ko;
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failures ? 1 : 0);
});
