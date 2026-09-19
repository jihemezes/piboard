/* ============================================================
   PiBoard - server/iptvRecord.js
   Enregistrement d'un flux IPTV (direct ou VOD) dans un fichier, pendant
   que la lecture continue.

   PRINCIPE. ffmpeg RECOPIE les pistes telles quelles (`-c copy`) : pas
   de reencodage, donc un cout processeur negligeable, meme sur un
   Raspberry Pi. Un reencodage video, lui, serait hors de portee.

   CONNEXION SEPAREE. L'enregistrement ouvre sa PROPRE connexion vers le
   fournisseur, independante du lecteur. C'est ce qui permet de zapper,
   de fermer la tuile ou d'enregistrer a l'heure dite sans rien regarder.
   Contrepartie : un abonnement limite a une seule connexion simultanee
   refusera l'une des deux. L'echec est alors immediat et explicite (le
   fournisseur coupe), et le reglage « Enregistrement » de la tuile le
   rappelle.

   FICHIER .ts, ET RIEN D'AUTRE PENDANT L'ENREGISTREMENT. Le MPEG-TS se
   lit meme tronque : une coupure de courant en pleine ecriture laisse un
   fichier utilisable, la ou un .mp4 interrompu est perdu (son index n'est
   ecrit qu'a la fin). La conversion en .mp4, elle, se fait APRES coup, a
   la demande, et sans reencodage non plus.

   REPRISE APRES COUPURE. Un flux IPTV tombe regulierement sans que ce
   soit une panne. Chaque reprise ecrit une PARTIE numerotee
   (`nom.part1.ts`, `nom.part2.ts`...), et l'arret les assemble en un
   seul fichier. Assembler des MPEG-TS, c'est les mettre bout a bout :
   aucune reecriture, aucune perte.

   Recording an IPTV stream (live or VOD) to a file while playback
   continues. ffmpeg COPIES the tracks as they are (`-c copy`): no
   re-encoding, so negligible CPU, even on a Raspberry Pi. The recording
   opens its OWN connection to the provider, independent of the player,
   which is what allows zapping, closing the tile, or recording at a set
   time; a subscription limited to one simultaneous connection will
   refuse one of the two. Files are .ts while recording, because MPEG-TS
   plays even when truncated; .mp4 conversion happens afterwards, on
   demand, also without re-encoding. Each reconnection writes a numbered
   part, and stopping concatenates them into one file.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const iptvAudio = require("./iptvAudio");

/* ---------- Fonctions pures (testees hors ligne) ----------
   Pure functions (tested offline). */

/* Nom de fichier : chaine, programme s'il est connu, date et heure.
   Le programme vient du guide quand le fournisseur en donne un ; sinon
   la date et l'heure suffisent a s'y retrouver, et le nom reste unique.
   File name: channel, programme when known, date and time. */
function sanitizeName(s) {
  return String(s == null ? "" : s)
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")   // interdits sous Windows
    .replace(/\s+/g, " ")
    .replace(/^[ .]+|[ .]+$/g, "")
    .slice(0, 80)
    .trim();
}

function two(n) { return String(n).padStart(2, "0"); }

function buildFileName(opts) {
  const o = opts || {};
  const d = o.date instanceof Date ? o.date : new Date();
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}h${two(d.getMinutes())}`;
  const parts = [sanitizeName(o.channel) || "IPTV"];
  const prog = sanitizeName(o.programme);
  if (prog && prog.toLowerCase() !== parts[0].toLowerCase()) parts.push(prog);
  parts.push(stamp);
  return parts.join(" - ");
}

/* Un nom deja pris re-sort avec un suffixe : deux enregistrements lances
   dans la meme minute ne doivent pas s'ecraser.
   A taken name comes back suffixed. */
function uniqueName(base, taken) {
  const used = new Set((taken || []).map((n) => String(n).toLowerCase()));
  if (!used.has((base + ".ts").toLowerCase())) return base;
  for (let i = 2; i < 500; i++) {
    if (!used.has((base + " (" + i + ").ts").toLowerCase())) return base + " (" + i + ")";
  }
  return base + " (" + Date.now().toString(36) + ")";
}

/* Faut-il arreter ? Duree maximale atteinte, ou espace disque tombe sous
   le seuil. Renvoie null, ou la raison.
   Should we stop? Maximum duration reached, or free disk space below the
   threshold. */
function stopReason(state, limits) {
  const l = limits || {};
  const maxMs = Number(l.maxMinutes) > 0 ? Number(l.maxMinutes) * 60000 : 0;
  if (maxMs && state.elapsedMs >= maxMs) return "max-duration";
  const minMB = Number(l.minFreeMB) > 0 ? Number(l.minFreeMB) : 0;
  if (minMB && typeof state.freeMB === "number" && state.freeMB < minMB) return "disk-full";
  return null;
}

/* Une reprise est-elle justifiee ? Oui tant que l'enregistrement n'a pas
   ete arrete volontairement, que la limite de tentatives n'est pas
   atteinte, et que ffmpeg a rendu la main AVANT la duree demandee.
   Is a retry warranted? */
function shouldRetry(rec, maxRetries) {
  if (rec.stopping || rec.stopReason) return false;
  if (rec.retries >= (maxRetries == null ? 20 : maxRetries)) return false;
  return true;
}

/* Delai avant une nouvelle tentative : court d'abord, puis de plus en
   plus long, plafonne. Evite de marteler un fournisseur en panne.
   Delay before a retry: short at first, then longer, capped. */
function retryDelayMs(retries) {
  return Math.min(30000, 2000 * Math.pow(1.7, Math.max(0, retries)));
}

/* Enregistrements programmes : ceux qui doivent demarrer maintenant, et
   ceux qui sont passes sans avoir pu l'etre (machine eteinte).
   Scheduled recordings: those due now, and those missed. */
function scheduleDue(list, now, graceMinutes) {
  const t = now instanceof Date ? now.getTime() : Number(now);
  const grace = (graceMinutes == null ? 10 : graceMinutes) * 60000;
  const due = [];
  const missed = [];
  for (const s of list || []) {
    if (!s || s.done) continue;
    const start = Date.parse(s.startAt);
    if (!Number.isFinite(start)) continue;
    if (t >= start && t < start + grace) due.push(s);
    else if (t >= start + grace) missed.push(s);
  }
  return { due, missed };
}

function scheduleDurationMinutes(s) {
  if (!s) return 0;
  if (Number(s.durationMinutes) > 0) return Number(s.durationMinutes);
  const start = Date.parse(s.startAt), end = Date.parse(s.endAt);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return Math.round((end - start) / 60000);
  return 0;
}

/* ---------- Dossier d'enregistrement / recording folder ---------- */

function defaultDir(dataDir) {
  return path.join(dataDir, "recordings");
}

/* Le chemin vient des reglages : il est donc verifie ici, pas suppose.
   Un dossier illisible ou impossible a creer doit se dire tout de suite,
   pas au premier enregistrement rate.
   The path comes from the settings, so it is checked here. */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.accessSync(dir, fs.constants.W_OK);
  return dir;
}

function freeMB(dir) {
  try {
    const st = fs.statfsSync(dir);
    return Math.round((st.bavail * st.bsize) / (1024 * 1024));
  } catch (e) {
    return null;
  }
}

/* ---------- Moteur / engine ---------- */

const recordings = new Map();   // id -> etat courant / current state
let seq = 0;

/* Arguments glisses AVANT ceux de ffmpeg. Uniquement pour les tests, qui
   remplacent ffmpeg par un petit script node et exercent ainsi le vrai
   moteur (reprise, assemblage, arret) sans reseau ni ffmpeg.
   Arguments slipped in BEFORE ffmpeg's own. For tests only. */
let spawnPrefix = [];
function __setSpawnPrefix(list) { spawnPrefix = Array.isArray(list) ? list : []; }

function publicView(rec) {
  return {
    id: rec.id,
    name: rec.name,
    channel: rec.channel,
    file: rec.finalFile || (rec.name + ".ts"),
    dir: rec.dir,
    status: rec.status,
    startedAt: rec.startedAt,
    elapsedSec: Math.round((Date.now() - rec.startedAt) / 1000),
    bytes: rec.bytes,
    retries: rec.retries,
    scheduled: !!rec.scheduled,
    maxMinutes: rec.maxMinutes || 0,
    error: rec.error || null,
    stopReason: rec.stopReason || null
  };
}

function list() {
  return [...recordings.values()].map(publicView);
}

function partPath(rec, n) {
  return path.join(rec.dir, rec.name + (n > 1 ? ".part" + n : "") + ".ts");
}

function ffmpegArgs(url, out) {
  return [
    "-hide_banner", "-loglevel", "error",
    // Reconnexion interne de ffmpeg : elle rattrape les micro-coupures
    // sans perdre le fichier. La reprise complete (nouveau processus)
    // ne sert que lorsqu'elle echoue.
    // ffmpeg's own reconnection catches micro-drops without losing the
    // file; a full retry only happens when it gives up.
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10",
    "-rw_timeout", "20000000",
    "-i", url,
    "-map", "0",
    "-c", "copy",
    // Horodatages recalcules : un flux en direct commence rarement a
    // zero, et un fichier qui demarre a 3 h 12 deroute les lecteurs.
    // Timestamps rebuilt: a live feed rarely starts at zero.
    "-avoid_negative_ts", "make_zero",
    "-f", "mpegts",
    "-y", out
  ];
}

async function start(opts) {
  const o = opts || {};
  const url = String(o.url || "");
  if (!/^https?:\/\//i.test(url)) throw new Error("url");
  const ffmpeg = await iptvAudio.findFfmpeg();
  if (!ffmpeg) { const e = new Error("ffmpeg"); e.code = "no-ffmpeg"; throw e; }

  const dir = ensureDir(o.dir);
  const existing = fs.readdirSync(dir);
  const name = uniqueName(buildFileName({ channel: o.channel, programme: o.programme }), existing);

  const rec = {
    id: "r" + (++seq) + "-" + Date.now().toString(36),
    name,
    channel: o.channel || "",
    url,
    dir,
    ffmpeg,
    status: "recording",
    startedAt: Date.now(),
    bytes: 0,
    part: 1,
    retries: 0,
    maxMinutes: Number(o.maxMinutes) > 0 ? Number(o.maxMinutes) : 0,
    minFreeMB: Number(o.minFreeMB) > 0 ? Number(o.minFreeMB) : 0,
    scheduled: !!o.scheduled,
    parts: [],
    stopping: false,
    stopReason: null,
    error: null
  };
  recordings.set(rec.id, rec);
  spawnPart(rec);
  rec.watch = setInterval(() => watch(rec), 5000);
  return publicView(rec);
}

function spawnPart(rec) {
  const out = partPath(rec, rec.part);
  rec.parts.push(out);
  rec.current = out;
  const child = spawn(rec.ffmpeg, spawnPrefix.concat(ffmpegArgs(rec.url, out)), { stdio: ["ignore", "ignore", "pipe"] });
  rec.child = child;
  let err = "";
  child.stderr.on("data", (d) => { err = (err + String(d)).slice(-2000); });
  child.on("error", (e) => { rec.error = String(e.message || e); });
  child.on("close", () => {
    rec.child = null;
    if (rec.stopping || rec.stopReason) return finish(rec);
    /* ffmpeg a rendu la main sans qu'on le lui demande : le flux est
       tombe. On garde ce qui est ecrit et on repart dans une nouvelle
       partie, qui sera assemblee a l'arret.
       ffmpeg exited on its own: the feed dropped. Keep what is written
       and start a new part, concatenated when stopping. */
    if (err) rec.error = err.split("\n").filter(Boolean).pop() || null;
    if (!shouldRetry(rec, 20)) {
      rec.stopReason = "stream-lost";
      return finish(rec);
    }
    rec.status = "reconnecting";
    const delay = retryDelayMs(rec.retries);
    rec.retries++;
    rec.part++;
    rec.retryTimer = setTimeout(() => {
      if (rec.stopping) return finish(rec);
      rec.status = "recording";
      spawnPart(rec);
    }, delay);
  });
}

function watch(rec) {
  let bytes = 0;
  for (const p of rec.parts) {
    try { bytes += fs.statSync(p).size; } catch (e) { /* partie pas encore creee */ }
  }
  rec.bytes = bytes;
  const reason = stopReason(
    { elapsedMs: Date.now() - rec.startedAt, freeMB: freeMB(rec.dir) },
    { maxMinutes: rec.maxMinutes, minFreeMB: rec.minFreeMB }
  );
  if (reason) stop(rec.id, reason);
}

/* Assemblage des parties : mises bout a bout, sans reecriture. Une seule
   partie est simplement renommee.
   Concatenating parts: end to end, no rewriting. */
function concatParts(rec) {
  const target = path.join(rec.dir, rec.name + ".ts");
  const present = rec.parts.filter((p) => { try { return fs.statSync(p).size > 0; } catch (e) { return false; } });
  if (!present.length) return null;
  if (present.length === 1) {
    if (present[0] !== target) fs.renameSync(present[0], target);
  } else {
    const tmp = target + ".joining";
    const out = fs.openSync(tmp, "w");
    try {
      for (const p of present) fs.writeSync(out, fs.readFileSync(p));
    } finally {
      fs.closeSync(out);
    }
    fs.renameSync(tmp, target);
    /* La PREMIERE partie porte deja le nom final (nom.ts) : la supprimer
       avec les autres effacerait le fichier qu'on vient d'assembler.
       The FIRST part already bears the final name (name.ts): deleting it
       along with the others would erase the file just assembled. */
    for (const p of present) {
      if (path.resolve(p) === path.resolve(target)) continue;
      try { fs.unlinkSync(p); } catch (e) { /* deja renomme */ }
    }
  }
  // Les parties vides d'une tentative ratee ne doivent pas trainer.
  // Empty parts from a failed attempt must not linger.
  for (const p of rec.parts) {
    if (p === target) continue;
    try { if (fs.existsSync(p) && fs.statSync(p).size === 0) fs.unlinkSync(p); } catch (e) { /* rien */ }
  }
  return target;
}

function finish(rec) {
  clearInterval(rec.watch);
  clearTimeout(rec.retryTimer);
  let file = null;
  try { file = concatParts(rec); } catch (e) { rec.error = String(e.message || e); }
  rec.finalFile = file ? path.basename(file) : null;
  try { rec.bytes = file ? fs.statSync(file).size : 0; } catch (e) { /* rien */ }
  rec.status = rec.bytes > 0 ? "done" : "failed";
  rec.endedAt = Date.now();
  const view = publicView(rec);
  recordings.delete(rec.id);
  lastResults.unshift(view);
  lastResults.splice(20);
  return view;
}

const lastResults = [];

function stop(id, reason) {
  const rec = recordings.get(id);
  if (!rec) return null;
  rec.stopping = true;
  rec.stopReason = reason || "user";
  rec.status = "stopping";
  clearTimeout(rec.retryTimer);
  if (rec.child) {
    // "q" sur l'entree n'est pas possible (stdio ignore) : SIGTERM suffit,
    // ffmpeg ferme proprement un MPEG-TS.
    // SIGTERM is enough: ffmpeg closes an MPEG-TS cleanly.
    try { rec.child.kill("SIGTERM"); } catch (e) { /* deja mort */ }
    return publicView(rec);
  }
  return finish(rec);
}

function recent() { return lastResults.slice(); }

/* Conversion en .mp4, apres coup et sans reencodage. Rend le fichier
   lisible partout, y compris la ou le .ts derange.
   Conversion to .mp4, afterwards and without re-encoding. */
async function convert(dir, file) {
  const ffmpeg = await iptvAudio.findFfmpeg();
  if (!ffmpeg) { const e = new Error("ffmpeg"); e.code = "no-ffmpeg"; throw e; }
  const src = path.join(dir, path.basename(file));
  if (!fs.existsSync(src)) throw new Error("introuvable / not found");
  const out = src.replace(/\.ts$/i, "") + ".mp4";
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, spawnPrefix.concat([
      "-hide_banner", "-loglevel", "error", "-i", src,
      "-map", "0", "-c", "copy",
      // Index en tete : le fichier se lit sans etre entierement telecharge.
      // Index up front: the file plays without a full download.
      "-movflags", "+faststart",
      "-bsf:a", "aac_adtstoasc",
      "-y", out
    ]), { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => { err = (err + String(d)).slice(-2000); });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(out)) resolve({ file: path.basename(out), bytes: fs.statSync(out).size });
      else reject(new Error(err.split("\n").filter(Boolean).pop() || ("ffmpeg " + code)));
    });
  });
}

function files(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names
    .filter((n) => /\.(ts|mp4)$/i.test(n) && !/\.part\d+\.ts$/i.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return { name: n, bytes: st.size, modified: st.mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified);
}

function remove(dir, file) {
  const target = path.join(dir, path.basename(file));
  if (!fs.existsSync(target)) return false;
  fs.unlinkSync(target);
  return true;
}

module.exports = {
  // pures / pure
  sanitizeName, buildFileName, uniqueName, stopReason, shouldRetry, retryDelayMs,
  scheduleDue, scheduleDurationMinutes, defaultDir,
  // moteur / engine
  ensureDir, freeMB, start, stop, list, recent, convert, files, remove,
  __setSpawnPrefix
};
