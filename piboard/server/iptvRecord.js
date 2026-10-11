/* ============================================================
   PiBoard - server/iptvRecord.js
   Enregistrement d'une chaine IPTV PENDANT qu'on la regarde.

   UNE SEULE CONNEXION (1.113.1). Un abonnement IPTV n'autorise
   generalement qu'UN flux simultane. Ouvrir une deuxieme connexion pour
   enregistrer coupait donc le visionnage -- c'est ce qui s'est passe en
   1.113.0. L'enregistrement DERIVE desormais les octets deja recus pour
   le lecteur : PiBoard lit le flux du fournisseur, l'envoie au lecteur,
   et, quand l'enregistrement est en cours, en ecrit une copie dans un
   fichier. Zero connexion supplementaire.
   Consequence assumee : l'enregistrement est lie au visionnage. Changer
   de chaine ou fermer le lecteur arrete l'enregistrement en cours, et
   un enregistrement programme suppose que la chaine soit affichee a
   l'heure dite.

   FICHIER .ts, tel qu'il sort du fournisseur. C'est le format d'origine
   (MPEG-TS) : rien n'est reencode, le fichier se lit dans VLC et dans la
   plupart des lecteurs Windows, et il reste lisible meme tronque -- une
   coupure de courant en pleine ecriture laisse un enregistrement
   utilisable, la ou un .mp4 interrompu serait perdu. La conversion en
   .mp4 se fait apres coup, a la demande, sans reencodage non plus.

   REPRISE APRES COUPURE. Quand le flux tombe, le lecteur se reconnecte
   et une nouvelle derivation prend le relais : les octets repartent dans
   le MEME fichier, a la suite.

   Recording an IPTV channel WHILE watching it. ONE SINGLE CONNECTION: an
   IPTV subscription usually allows only one simultaneous stream, so
   opening a second connection to record cut off playback (what happened
   in 1.113.0). Recording now TAPS the bytes already received for the
   player: PiBoard reads the provider's stream, sends it to the player
   and, while recording, writes a copy to a file. No extra connection.
   Trade-off: recording is tied to playback. The file is the provider's
   own MPEG-TS, nothing re-encoded, readable even when truncated; .mp4
   conversion happens afterwards, on demand. When the feed drops, the
   player reconnects and the new tap continues the SAME file.
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
    sid: rec.tapSid,
    file: rec.name + ".ts",
    dir: rec.dir,
    status: rec.status,
    startedAt: rec.startedAt,
    elapsedSec: Math.round((Date.now() - rec.startedAt) / 1000),
    bytes: rec.bytes,
    /* Nombre de reprises du flux : la tuile affiche « reconnexion » tant
       qu'aucune derivation n'alimente le fichier.
       Number of feed resumptions. */
    retries: rec.retries,
    live: !!rec.tapSid && taps.has(rec.tapSid),
    scheduled: !!rec.scheduled,
    maxMinutes: rec.maxMinutes || 0,
    error: rec.error || null,
    stopReason: rec.stopReason || null
  };
}

function list() {
  return [...recordings.values()].map(publicView);
}

/* ---------- Derivations / taps ----------
   Une derivation, c'est le flux du fournisseur tel que PiBoard le lit
   pour le lecteur. Chaque lecture en cours s'enregistre ici sous
   l'identifiant que le lecteur a choisi (sid), et s'en retire a la fin.
   A tap is the provider's stream as PiBoard reads it for the player.
   Each playback registers here under the id the player chose (sid). */
const taps = new Map();   // sid -> { write(buf), close() }

function openTap(sid, sourceStream) {
  if (!sid || !sourceStream) return () => {};
  const tap = { sid, sinks: new Set() };
  const onData = (buf) => {
    for (const sink of tap.sinks) {
      try { sink.write(buf); } catch (e) { /* ecriture perdue, on continue */ }
    }
  };
  sourceStream.on("data", onData);
  taps.set(sid, tap);
  const close = () => {
    sourceStream.off("data", onData);
    if (taps.get(sid) === tap) taps.delete(sid);
    /* Le flux est tombe : les enregistrements qui en vivaient restent
       ouverts, en attente de la derivation suivante (le lecteur se
       reconnecte). Ils ne sont PAS arretes ici.
       The feed dropped: recordings living off it stay open, waiting for
       the next tap. They are NOT stopped here. */
    for (const rec of recordings.values()) {
      if (rec.tapSid === sid && rec.status === "recording") {
        rec.status = "reconnecting";
        rec.retries++;
      }
    }
  };
  sourceStream.on("end", close);
  sourceStream.on("close", close);
  sourceStream.on("error", close);
  /* Un enregistrement deja en cours pour ce sid reprend aussitot : c'est
     la reprise apres coupure, dans le MEME fichier.
     A recording already running for this sid resumes at once. */
  for (const rec of recordings.values()) {
    if (rec.tapSid === sid && !rec.stopping && rec.sink) {
      tap.sinks.add(rec.sink);
      rec.status = "recording";
    }
  }
  return close;
}

function hasTap(sid) { return taps.has(sid); }

/* ---------- Moteur / engine ---------- */

async function start(opts) {
  const o = opts || {};
  const sid = String(o.sid || "");
  const tap = taps.get(sid);
  if (!tap) { const e = new Error("aucun flux en cours / no stream in progress"); e.code = "no-stream"; throw e; }

  const dir = ensureDir(o.dir);
  const existing = fs.readdirSync(dir);
  const name = uniqueName(buildFileName({ channel: o.channel, programme: o.programme }), existing);
  const file = path.join(dir, name + ".ts");

  const rec = {
    id: "r" + (++seq) + "-" + Date.now().toString(36),
    name,
    channel: o.channel || "",
    dir,
    tapSid: sid,
    status: "recording",
    startedAt: Date.now(),
    bytes: 0,
    retries: 0,
    maxMinutes: Number(o.maxMinutes) > 0 ? Number(o.maxMinutes) : 0,
    minFreeMB: Number(o.minFreeMB) > 0 ? Number(o.minFreeMB) : 0,
    scheduled: !!o.scheduled,
    file,
    stopping: false,
    stopReason: null,
    error: null
  };
  /* `flags: "a"` : une reprise apres coupure ecrit a la SUITE du meme
     fichier, sans rien effacer. / Appending, so a resumption continues
     the same file. */
  rec.sink = fs.createWriteStream(file, { flags: "a" });
  rec.sink.on("error", (e) => { rec.error = String(e.message || e); stop(rec.id, "write-error"); });
  tap.sinks.add(rec.sink);
  recordings.set(rec.id, rec);
  rec.watch = setInterval(() => watch(rec), 3000);
  return publicView(rec);
}

function watch(rec) {
  try { rec.bytes = fs.statSync(rec.file).size; } catch (e) { /* pas encore ecrit */ }
  const reason = stopReason(
    { elapsedMs: Date.now() - rec.startedAt, freeMB: freeMB(rec.dir) },
    { maxMinutes: rec.maxMinutes, minFreeMB: rec.minFreeMB }
  );
  if (reason) stop(rec.id, reason);
}

function finish(rec) {
  clearInterval(rec.watch);
  const tap = taps.get(rec.tapSid);
  if (tap) tap.sinks.delete(rec.sink);
  try { rec.bytes = fs.statSync(rec.file).size; } catch (e) { rec.bytes = 0; }
  rec.status = rec.bytes > 0 ? "done" : "failed";
  /* Le fichier n'est referme qu'ensuite, et le menage se fait DANS ce
     rappel : un flux d'ecriture ouvre le fichier au moment ou il en a
     besoin, parfois apres notre appel. Supprimer avant aurait laisse un
     fichier vide recree juste apres -- constate en test.
     The file is closed afterwards, and the cleanup happens IN that
     callback: a write stream opens the file when it needs to, sometimes
     after our call. Deleting before would leave an empty file recreated
     right after -- seen in testing. */
  try {
    rec.sink.end(() => {
      let size = 0;
      try { size = fs.statSync(rec.file).size; } catch (e) { size = 0; }
      /* Un fichier vide ferait croire a un enregistrement reussi.
         An empty file would look like a successful recording. */
      if (!size) { try { fs.unlinkSync(rec.file); } catch (e) { /* rien */ } }
      const kept = lastResults.find((v) => v.id === rec.id);
      if (kept) { kept.bytes = size; kept.status = size > 0 ? "done" : "failed"; }
    });
  } catch (e) { /* deja ferme */ }
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
  return finish(rec);
}

/* Fin d'une lecture : les enregistrements qui en vivaient s'arretent,
   puisque le flux qui les alimentait n'existe plus.
   End of a playback: the recordings living off it stop. */
function stopForSid(sid, reason) {
  const out = [];
  for (const rec of [...recordings.values()]) {
    if (rec.tapSid === sid) out.push(stop(rec.id, reason || "stream-ended"));
  }
  return out;
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
  if (!fs.statSync(src).size) throw new Error("fichier vide / empty file");
  const out = src.replace(/\.ts$/i, "") + ".mp4";
  /* Ecriture dans un fichier TEMPORAIRE, renomme seulement en cas de
     succes. En 1.113.0, ffmpeg creait le .mp4 puis echouait, et le
     fichier vide restait dans la liste comme un enregistrement -- c'est
     le « mp4 qui reste a 0 » constate. Un echec ne laisse plus rien.
     Written to a TEMPORARY file, renamed only on success. In 1.113.0,
     ffmpeg created the .mp4 then failed, and the empty file stayed in
     the list as if it were a recording. A failure now leaves nothing. */
  const tmp = out + ".converting";
  const cleanup = () => { try { fs.unlinkSync(tmp); } catch (e) { /* rien */ } };
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, spawnPrefix.concat([
      "-hide_banner", "-loglevel", "error", "-i", src,
      "-map", "0", "-c", "copy",
      // Index en tete : le fichier se lit sans etre entierement telecharge.
      // Index up front: the file plays without a full download.
      "-movflags", "+faststart",
      "-bsf:a", "aac_adtstoasc",
      "-f", "mp4",
      "-y", tmp
    ]), { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => { err = (err + String(d)).slice(-2000); });
    child.on("error", (e) => { cleanup(); reject(e); });
    child.on("close", (code) => {
      let size = 0;
      try { size = fs.statSync(tmp).size; } catch (e) { size = 0; }
      if (code !== 0 || !size) {
        cleanup();
        return reject(new Error(err.split("\n").filter(Boolean).pop() || ("ffmpeg " + code)));
      }
      fs.renameSync(tmp, out);
      resolve({ file: path.basename(out), bytes: size });
    });
  });
}

function files(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names
    // Ni les parties d'un ancien format, ni une conversion en cours.
    // Neither old-format parts nor a conversion in progress.
    .filter((n) => /\.(ts|mp4)$/i.test(n) && !/\.part\d+\.ts$/i.test(n) && !/\.converting$/i.test(n))
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
  ensureDir, freeMB, start, stop, stopForSid, list, recent, convert, files, remove,
  openTap, hasTap,
  __setSpawnPrefix
};
