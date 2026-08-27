/* ============================================================
   PiBoard - server/internetHealth.js
   Surveillance de la sante de la connexion Internet : latence, gigue,
   perte de paquets, et debit descendant/montant a intervalle espace.
   Historique en tampon circulaire cote serveur + export CSV.

   POURQUOI COTE SERVEUR ET NON DANS LE NAVIGATEUR. C'est le point
   central de cette tuile. Un releve fait par le navigateur ne vaudrait
   que tant que la page est ouverte et repartirait de zero a chaque
   rechargement -- exactement le defaut que l'historique de l'Etat
   systeme a corrige en 1.7x. Or ici, l'interet PRINCIPAL n'est pas la
   valeur instantanee : c'est la COURBE. Une coupure de trois minutes a
   4 h du matin est precisement ce qu'on veut retrouver le lendemain, et
   aucun navigateur ne l'aurait vue. Le releve est donc fait par le
   serveur, en continu, et partage par tous les ecrans.

   POURQUOI PAS DE `ping` SYSTEME. ICMP demande une socket brute (donc
   les privileges root sous Linux), et l'appel a la commande `ping`
   varie d'un systeme a l'autre -- ce serait du code specifique a une
   plateforme, interdit hors de server/platform/. On mesure donc le
   temps d'etablissement d'une connexion TCP (poignee de main SYN /
   SYN-ACK) vers un resolveur DNS public sur le port 443. C'est du Node
   pur, identique sur Pi, Windows et macOS, et la valeur obtenue est un
   aller-retour reseau reel -- quelques millisecondes au-dessus d'un
   ping ICMP, ce qui est sans importance pour lire une TENDANCE.

   POURQUOI LE DEBIT EST MESURE RAREMENT. Une mesure de debit CONSOMME
   du debit. Mesurer toutes les minutes saturerait la ligne en
   permanence et fausserait au passage la mesure de latence. Le debit
   est donc mesure a intervalle long (3 h par defaut), plafonne en
   volume ET en duree, et peut etre coupe entierement. La latence, elle,
   ne coute presque rien : c'est elle qui porte la courbe.

   POURQUOI LES REGLAGES VIENNENT DE LA TUILE. Le module lit la
   disposition enregistree (data/layout.json) et y cherche une tuile
   `speedtest`. Consequences voulues :
     - AUCUNE tuile de ce type sur le tableau = AUCUNE mesure, donc
       aucun trafic. Personne ne paie pour une fonctionnalite qu'il
       n'utilise pas.
     - les reglages restent la ou la personne les cherche (les reglages
       de la tuile), sans second endroit de configuration a tenir a
       jour ni endpoint de synchronisation.
   Si plusieurs tuiles `speedtest` coexistent, la PREMIERE de la
   disposition fait foi -- l'historique etant unique et partage, il n'y
   a de toute facon qu'un seul rythme de mesure possible.

   Internet connection health monitoring: latency, jitter, packet loss,
   plus download/upload throughput at a long interval. Server-side ring
   buffer history + CSV export.

   WHY SERVER-SIDE AND NOT IN THE BROWSER. This is the heart of the
   tile. A reading taken by the browser would only exist while the page
   is open and would restart from scratch on every reload -- exactly the
   flaw the System status history fixed in 1.7x. Here the MAIN point is
   not the instant value: it is the CURVE. A three-minute outage at 4am
   is precisely what one wants to find the next day, and no browser
   would have seen it. The reading is therefore taken by the server,
   continuously, and shared by every screen.

   WHY NO SYSTEM `ping`. ICMP needs a raw socket (hence root on Linux),
   and invoking the `ping` command differs from one system to the next
   -- that would be platform-specific code, forbidden outside
   server/platform/. So we measure the time to establish a TCP
   connection (SYN / SYN-ACK handshake) to a public DNS resolver on port
   443. That is pure Node, identical on Pi, Windows and macOS, and the
   figure obtained is a real network round trip -- a few milliseconds
   above an ICMP ping, which does not matter for reading a TREND.

   WHY THROUGHPUT IS MEASURED RARELY. Measuring throughput CONSUMES
   throughput. Measuring every minute would saturate the line
   permanently and skew the latency reading along the way. Throughput is
   therefore measured on a long interval (3 h by default), capped in
   both volume AND duration, and can be switched off entirely. Latency
   costs almost nothing: it is what carries the curve.

   WHY THE SETTINGS COME FROM THE TILE. The module reads the saved
   layout (data/layout.json) and looks for a `speedtest` tile. Intended
   consequences:
     - NO such tile on the board = NO measurement, hence no traffic.
       Nobody pays for a feature they do not use.
     - the settings stay where one looks for them (the tile's settings),
       with no second configuration place to keep in sync and no
       synchronisation endpoint.
   If several `speedtest` tiles coexist, the FIRST one in the layout
   wins -- the history being single and shared, there can only be one
   measurement pace anyway.
   ============================================================ */
"use strict";

const fs = require("fs");
const net = require("net");
const path = require("path");
const store = require("./store");

const WIDGET_ID = "speedtest";
const HISTORY_FILE = path.join(store.DATA_DIR, "internet-health.json");

/* Retention de 72 h. Choix d'equilibre assume : la courbe demandee se
   lit sur 24 h, et trois jours laissent de quoi comparer "hier" et
   "avant-hier" apres une soiree douteuse. Au-dela, le fichier grossit
   dans data/ -- et donc dans CHAQUE sauvegarde de configuration, qui
   embarque automatiquement tout data/*.json (voir backups.js). C'est
   precisement pour cela que l'export CSV existe : la conservation
   longue se fait dans un fichier a soi, pas dans le tampon.
   72 h retention. A deliberate balance: the requested curve is read
   over 24 h, and three days leave enough to compare "yesterday" with
   "the day before" after a dubious evening. Beyond that the file grows
   inside data/ -- and therefore inside EVERY configuration backup,
   which automatically embeds all of data/*.json (see backups.js). That
   is exactly why the CSV export exists: long-term keeping happens in a
   file of your own, not in the buffer. */
const RETENTION_MS = 72 * 60 * 60 * 1000;
const HISTORY_MAX = 72 * 60;              // 72 h a raison d'un point par minute
const FLUSH_MS = 5 * 60 * 1000;
const TICK_MS = 15 * 1000;

/* Ces valeurs doivent rester alignees sur manifest.json du widget : ce
   sont les memes reglages vus des deux cotes. Elles servent de repli
   quand la tuile existe mais qu'un reglage n'a jamais ete enregistre.
   These must stay aligned with the widget's manifest.json: they are the
   same settings seen from both sides. They act as a fallback when the
   tile exists but a setting was never saved. */
const DEFAULTS = {
  targets: "1.1.1.1:443, 8.8.8.8:443, 9.9.9.9:443",
  probeCount: 5,
  probeTimeoutMs: 2000,
  latencySeconds: 60,
  throughputMinutes: 180,
  throughputMB: 20,
  throughputMaxSeconds: 10,
  measureUpload: false,
  downloadUrl: "https://speed.cloudflare.com/__down?bytes=200000000",
  uploadUrl: "https://speed.cloudflare.com/__up"
};

/* ============================================================
   Fonctions PURES -- aucune E/S, aucun reseau.
   Separees volontairement pour etre testables sur n'importe quelle
   machine, sans connexion Internet (voir test/internetHealth.test.js).
   PURE functions -- no I/O, no network. Deliberately separated so they
   can be tested on any machine, offline.
   ============================================================ */

/* "1.1.1.1:443, dns.google" -> [{host,port}]. Le port est facultatif
   et vaut 443 par defaut : c'est le seul port qu'un reseau d'entreprise
   ou un hotspot laisse passer a coup sur.
   The port is optional and defaults to 443: it is the one port a
   corporate network or a hotspot is sure to let through. */
function parseTargets(raw) {
  return String(raw || "")
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // Forme IPv6 entre crochets : [2606:4700:4700::1111]:443
      const v6 = entry.match(/^\[([^\]]+)\](?::(\d+))?$/);
      if (v6) return { host: v6[1], port: Number(v6[2]) || 443 };
      const parts = entry.split(":");
      // Deux-points multiples sans crochets = adresse IPv6 nue : on ne
      // peut pas distinguer le port, on prend tout comme hote.
      // Multiple colons without brackets = bare IPv6 address: the port
      // cannot be told apart, so the whole thing is the host.
      if (parts.length > 2) return { host: entry, port: 443 };
      return { host: parts[0], port: Number(parts[1]) || 443 };
    })
    .filter((t) => t.host)
    .slice(0, 5);
}

/* Mediane et non moyenne : un seul aller-retour ralenti par un paquet
   perdu et retransmis suffirait a faire bondir une moyenne de cinq
   valeurs, et la courbe montrerait un pic qui ne reflete pas l'etat de
   la ligne.
   Median rather than mean: a single round trip slowed by a lost and
   retransmitted packet would be enough to make an average of five
   values jump, and the curve would show a spike that does not reflect
   the state of the line. */
function median(values) {
  const a = values.filter((v) => Number.isFinite(v)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/* Gigue = moyenne des ecarts ABSOLUS entre releves consecutifs
   (principe de la RFC 3550). Ce n'est pas l'ecart-type : ce qui gene un
   appel visio, c'est la variation d'un paquet au suivant, pas la
   dispersion autour d'une moyenne.
   Jitter = mean of ABSOLUTE differences between consecutive readings
   (RFC 3550 principle). Not the standard deviation: what disturbs a
   video call is the variation from one packet to the next, not the
   spread around a mean. */
function computeJitter(values) {
  const a = values.filter((v) => Number.isFinite(v));
  if (a.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < a.length; i++) sum += Math.abs(a[i] - a[i - 1]);
  return sum / (a.length - 1);
}

/* Note d'ensemble, volontairement grossiere : quatre etats lisibles a
   travers une piece, pas un score sur 100 qui demanderait a etre
   interprete. Les seuils sont ceux communement retenus pour la
   visioconference, l'usage le plus exigeant d'un foyer.
   Overall grade, deliberately coarse: four states readable across a
   room, not a score out of 100 that would need interpreting. The
   thresholds are those commonly used for video calls, the most
   demanding household use. */
function gradeStatus(sample) {
  if (!sample || sample.latencyMs == null) return "down";
  if (sample.lossPct != null && sample.lossPct >= 100) return "down";
  const lat = sample.latencyMs;
  const jit = sample.jitterMs == null ? 0 : sample.jitterMs;
  const loss = sample.lossPct == null ? 0 : sample.lossPct;
  if (loss >= 5 || lat > 150 || jit > 50) return "poor";
  if (loss >= 1 || lat > 60 || jit > 20) return "fair";
  return "good";
}

function sliceSince(points, sinceMs) {
  return (points || []).filter((p) => p && p.t >= sinceMs);
}

/* Statistiques d'une serie. `count` compte les points RENSEIGNES, pas
   les points de la fenetre : une nuit sans mesure de debit ne doit pas
   faire croire a un debit nul.
   Series statistics. `count` counts the FILLED points, not the points
   in the window: a night without a throughput reading must not suggest
   a throughput of zero. */
function summarize(points, key) {
  const vals = (points || [])
    .map((p) => (p ? p[key] : null))
    .filter((v) => Number.isFinite(v));
  if (!vals.length) return { min: null, avg: null, max: null, count: 0 };
  let sum = 0, min = Infinity, max = -Infinity;
  for (const v of vals) { sum += v; if (v < min) min = v; if (v > max) max = v; }
  return { min, avg: sum / vals.length, max, count: vals.length };
}

/* Disponibilite = part des releves ou la ligne a repondu. Un releve
   sans latence du tout est une coupure ; c'est ce chiffre que l'on
   montre a un fournisseur d'acces.
   Availability = share of readings where the line answered. A reading
   with no latency at all is an outage; this is the figure one shows to
   an ISP. */
function availability(points) {
  const a = points || [];
  if (!a.length) return null;
  const up = a.filter((p) => p && Number.isFinite(p.l)).length;
  return (up / a.length) * 100;
}

/* Reduction pour l'affichage : une courbe de 4320 points dans un SVG de
   600 px de large trace plusieurs points par pixel pour rien. On garde
   le PIRE point (latence la plus haute, ou une coupure) de chaque
   tranche plutot que la moyenne : moyenner effacerait justement la
   micro-coupure que l'on cherche.
   Reduction for display: a 4320-point curve in a 600 px SVG draws
   several points per pixel for nothing. We keep the WORST point
   (highest latency, or an outage) of each slice rather than the
   average: averaging would erase precisely the micro-outage one is
   looking for. */
function downsample(points, maxPoints) {
  const a = points || [];
  const cap = Math.max(2, Number(maxPoints) || 600);
  if (a.length <= cap) return a.slice();
  const bucketMs = (a[a.length - 1].t - a[0].t) / cap || 1;
  const out = [];
  let bucketStart = a[0].t;
  let worst = null;
  for (const p of a) {
    if (p.t >= bucketStart + bucketMs) {
      if (worst) out.push(worst);
      worst = null;
      bucketStart = p.t;
    }
    if (!worst) worst = p;
    else if (!Number.isFinite(p.l)) worst = p;                       // coupure : prioritaire
    else if (Number.isFinite(worst.l) && p.l > worst.l) worst = p;
  }
  if (worst) out.push(worst);
  return out;
}

/* Colonnes de l'export, dans cet ordre. Definies une seule fois pour
   que l'en-tete et les lignes ne puissent pas diverger.
   Export columns, in this order. Defined once so the header and the
   rows cannot drift apart. */
const CSV_COLUMNS = [
  ["datetime", (p) => new Date(p.t).toISOString()],
  ["timestamp_ms", (p) => p.t],
  ["latency_ms", (p) => p.l],
  ["jitter_ms", (p) => p.j],
  ["loss_percent", (p) => p.p],
  ["download_mbps", (p) => p.d],
  ["upload_mbps", (p) => p.u],
  ["status", (p) => gradeStatus({ latencyMs: p.l == null ? null : p.l, jitterMs: p.j, lossPct: p.p })]
];

/* Deux dialectes CSV, et c'est deliberement un choix offert plutot
   qu'un defaut impose. Un tableur configure en francais attend le
   point-virgule ET la virgule decimale ; lui donner un fichier
   "international" affiche toute la ligne dans une seule cellule. Un
   outil d'analyse attend l'inverse. Aucun des deux n'est "le bon", donc
   les deux sont proposes.
   Two CSV dialects, and this is deliberately an offered choice rather
   than an imposed default. A spreadsheet set to French expects the
   semicolon AND the decimal comma; handing it an "international" file
   drops the whole row into a single cell. An analysis tool expects the
   opposite. Neither is "the right one", so both are offered. */
function toCsv(points, opts) {
  const french = !opts || opts.dialect !== "international";
  const sep = french ? ";" : ",";
  const num = (v) => {
    if (v == null || !Number.isFinite(Number(v))) return "";
    const s = String(Math.round(Number(v) * 100) / 100);
    return french ? s.replace(".", ",") : s;
  };
  // Horodatages et libelle d'etat sont recopies tels quels : seules les
  // MESURES subissent la conversion decimale. Convertir un horodatage
  // en millisecondes ferait apparaitre une virgule dans un entier.
  // Timestamps and the status label are copied verbatim: only the
  // MEASUREMENTS undergo the decimal conversion. Converting a
  // millisecond timestamp would put a comma inside an integer.
  const VERBATIM = new Set(["datetime", "timestamp_ms", "status"]);
  const lines = [CSV_COLUMNS.map((c) => c[0]).join(sep)];
  for (const p of points || []) {
    lines.push(CSV_COLUMNS.map(([name, get]) => {
      const v = get(p);
      if (VERBATIM.has(name)) return String(v == null ? "" : v);
      return num(v);
    }).join(sep));
  }
  // Fin de ligne CRLF : c'est ce que prevoit la RFC 4180 et ce
  // qu'attendent les tableurs sous Windows.
  // CRLF line endings: what RFC 4180 specifies and what spreadsheets
  // expect on Windows.
  return lines.join("\r\n") + "\r\n";
}

/* Nom de fichier d'archive horodate a la seconde. Deux archives lancees
   dans la meme seconde restent possibles en theorie ; en pratique
   l'action est manuelle, et un suffixe supplementaire n'apporterait
   qu'un nom plus laid.
   Archive file name timestamped to the second. Two archives launched
   within the same second remain theoretically possible; in practice the
   action is manual, and an extra suffix would only make the name
   uglier. */
function archiveName(date, hours) {
  const d = date instanceof Date ? date : new Date(date);
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `piboard-internet-${stamp}-${Math.round(hours)}h.csv`;
}

/* ============================================================
   Etat et persistance / state and persistence
   ============================================================ */

let history = null;
let dirty = false;
let running = false;
let lastLatencyAt = 0;
let lastThroughputAt = 0;
let lastError = null;

function load() {
  if (history) return history;
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch (e) { raw = null; }
  history = (raw && Array.isArray(raw.points)) ? raw : { points: [] };
  history.points = trim(history.points);
  return history;
}

function trim(points) {
  const since = Date.now() - RETENTION_MS;
  const kept = (points || []).filter((p) => p && Number.isFinite(p.t) && p.t >= since);
  return kept.length > HISTORY_MAX ? kept.slice(-HISTORY_MAX) : kept;
}

/* Ecriture atomique et COMPACTE. Compacte parce que ce fichier est le
   seul du projet a compter plusieurs milliers d'entrees : l'indentation
   de store.write() doublerait sa taille, et donc celle de chaque
   sauvegarde de configuration.
   Atomic and COMPACT write. Compact because this file is the only one
   in the project holding several thousand entries: store.write()'s
   indentation would double its size, and therefore that of every
   configuration backup. */
function flush() {
  if (!dirty || !history) return;
  try {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    const tmp = HISTORY_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(history), "utf8");
    fs.renameSync(tmp, HISTORY_FILE);
    dirty = false;
  } catch (e) {
    console.warn("[piboard] sante Internet non enregistree:", e.message || e);
  }
}

/* ============================================================
   Lecture des reglages depuis la disposition / settings from layout
   ============================================================ */

function readConfig() {
  let layout = null;
  try { layout = store.read("layout", null); } catch (e) { layout = null; }
  const tiles = (layout && Array.isArray(layout.tiles)) ? layout.tiles : [];
  const tile = tiles.find((t) => t && t.widget === WIDGET_ID);
  if (!tile) return null;
  const s = tile.settings || {};
  const num = (v, def, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };
  return {
    targets: String(s.targets || DEFAULTS.targets),
    probeCount: num(s.probeCount, DEFAULTS.probeCount, 3, 10),
    probeTimeoutMs: DEFAULTS.probeTimeoutMs,
    latencySeconds: num(s.latencySeconds, DEFAULTS.latencySeconds, 30, 900),
    throughputMinutes: num(s.throughputMinutes, DEFAULTS.throughputMinutes, 0, 1440),
    throughputMB: num(s.throughputMB, DEFAULTS.throughputMB, 5, 100),
    throughputMaxSeconds: num(s.throughputMaxSeconds, DEFAULTS.throughputMaxSeconds, 3, 30),
    measureUpload: s.measureUpload === true,
    downloadUrl: String(s.downloadUrl || DEFAULTS.downloadUrl),
    uploadUrl: String(s.uploadUrl || DEFAULTS.uploadUrl)
  };
}

/* ============================================================
   Mesures / measurements
   ============================================================ */

/* Un aller-retour TCP. Le gestionnaire d'erreur est pose AVANT
   connect() : une socket qui emet "error" sans auditeur fait tomber
   tout le processus (meme classe de defaut que le plantage ImapFlow
   corrige en 1.77). Un echec ici est un evenement NORMAL -- c'est la
   perte de paquet que l'on mesure -- et se traduit par null.
   One TCP round trip. The error handler is attached BEFORE connect(): a
   socket emitting "error" with no listener brings the whole process
   down (same class of defect as the ImapFlow crash fixed in 1.77). A
   failure here is a NORMAL event -- it is the packet loss being
   measured -- and maps to null. */
function probeOnce(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const sock = new net.Socket();
    let settled = false;
    const finish = (ms) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (e) { /* deja ferme / already closed */ }
      resolve(ms);
    };
    sock.once("error", () => finish(null));
    sock.once("timeout", () => finish(null));
    sock.once("connect", () => finish(Number(process.hrtime.bigint() - started) / 1e6));
    sock.setTimeout(Math.max(500, timeoutMs));
    try { sock.connect(port, host); } catch (e) { finish(null); }
  });
}

/* Sondes EN SERIE et non en parallele : cinq connexions simultanees se
   feraient concurrence sur la meme liaison et mesureraient la file
   d'attente plutot que la latence.
   Probes IN SEQUENCE, not in parallel: five simultaneous connections
   would compete over the same link and would measure the queue rather
   than the latency. */
async function measureLatency(cfg) {
  const targets = parseTargets(cfg.targets);
  if (!targets.length) return { latencyMs: null, jitterMs: null, lossPct: 100 };
  const results = [];
  for (let i = 0; i < cfg.probeCount; i++) {
    const t = targets[i % targets.length];
    results.push(await probeOnce(t.host, t.port, cfg.probeTimeoutMs));
  }
  const ok = results.filter((v) => Number.isFinite(v));
  return {
    latencyMs: median(ok),
    jitterMs: computeJitter(ok),
    lossPct: ((results.length - ok.length) / results.length) * 100
  };
}

/* Double plafond, volume ET duree, et c'est intentionnel :
     - le plafond de VOLUME protege un forfait limite (une mesure ne
       telechargera jamais plus que ce qui est annonce dans les
       reglages) ;
     - le plafond de DUREE protege d'une ligne effondree, ou 20 Mo
       mettraient dix minutes a descendre.
   Le chronometre demarre au PREMIER octet recu, pas a l'envoi de la
   requete : sinon on mesurerait le temps d'etablissement TLS et de
   reponse du serveur en plus du transfert, ce qui sous-estimerait le
   debit d'autant.
   Two caps, volume AND duration, on purpose:
     - the VOLUME cap protects a metered plan (a reading will never
       download more than what the settings announce);
     - the DURATION cap protects against a collapsed line, where 20 MB
       would take ten minutes to come down.
   The clock starts at the FIRST byte received, not when the request is
   sent: otherwise we would measure TLS setup and server response time
   on top of the transfer, underestimating throughput accordingly. */
async function measureDownload(cfg) {
  const maxBytes = Math.round(cfg.throughputMB * 1024 * 1024);
  const controller = new AbortController();
  const guard = setTimeout(() => controller.abort(), cfg.throughputMaxSeconds * 1000 + 5000);
  let bytes = 0;
  let startedAt = 0;
  try {
    const res = await fetch(cfg.downloadUrl, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache", "User-Agent": "PiBoard" }
    });
    if (!res.ok || !res.body) throw new Error("status " + res.status);
    for await (const chunk of res.body) {
      if (!startedAt) startedAt = Date.now();
      bytes += chunk.length;
      if (bytes >= maxBytes || Date.now() - startedAt >= cfg.throughputMaxSeconds * 1000) {
        controller.abort();
        break;
      }
    }
  } catch (e) {
    // Une interruption VOLONTAIRE (plafond atteint) passe par la meme
    // exception qu'un echec reseau : seuls les octets deja recus
    // permettent de les distinguer.
    // A DELIBERATE abort (cap reached) raises the same exception as a
    // network failure: only the bytes already received tell them apart.
    if (!bytes) throw e;
  } finally {
    clearTimeout(guard);
  }
  const seconds = (Date.now() - startedAt) / 1000;
  if (!bytes || seconds <= 0.05) return null;
  return (bytes * 8) / seconds / 1e6;
}

async function measureUpload(cfg) {
  // Volume montant volontairement plus modeste : une ligne ADSL ou
  // fibre grand public monte bien plus lentement qu'elle ne descend, et
  // saturer la voie montante degrade tout le reste du foyer pendant la
  // mesure. Upload volume deliberately more modest: a consumer ADSL or
  // fibre line uploads far more slowly than it downloads, and
  // saturating the uplink degrades everything else in the home during
  // the reading.
  const bytes = Math.min(8, cfg.throughputMB) * 1024 * 1024;
  const payload = Buffer.alloc(bytes, 0);
  const controller = new AbortController();
  const guard = setTimeout(() => controller.abort(), cfg.throughputMaxSeconds * 1000 + 5000);
  const startedAt = Date.now();
  try {
    const res = await fetch(cfg.uploadUrl, {
      method: "POST",
      body: payload,
      signal: controller.signal,
      headers: { "Content-Type": "application/octet-stream", "User-Agent": "PiBoard" }
    });
    if (!res.ok) throw new Error("status " + res.status);
    await res.arrayBuffer();
  } finally {
    clearTimeout(guard);
  }
  const seconds = (Date.now() - startedAt) / 1000;
  if (seconds <= 0.05) return null;
  return (bytes * 8) / seconds / 1e6;
}

/* ============================================================
   Echantillonnage / sampling
   ============================================================ */

function pushPoint(point) {
  const h = load();
  h.points.push(point);
  h.points = trim(h.points);
  dirty = true;
  return point;
}

/* `withThroughput` force la mesure de debit, quel que soit l'intervalle
   configure : c'est ce que fait le bouton "Tester maintenant". Le
   verrou `running` evite qu'un appui repete ne lance trois mesures qui
   se marcheraient dessus et donneraient chacune un tiers du debit reel.
   `withThroughput` forces a throughput reading regardless of the
   configured interval: that is what the "Test now" button does. The
   `running` lock stops repeated presses from launching three readings
   that would tread on each other and each report a third of the real
   throughput. */
async function sample(options) {
  const opts = options || {};
  const cfg = opts.config || readConfig();
  if (!cfg) return null;
  if (running) return null;
  running = true;
  try {
    const lat = await measureLatency(cfg);
    const point = { t: Date.now(), l: round1(lat.latencyMs), j: round1(lat.jitterMs), p: round1(lat.lossPct) };
    lastLatencyAt = point.t;

    const wantThroughput = opts.withThroughput === true ||
      (cfg.throughputMinutes > 0 && Date.now() - lastThroughputAt >= cfg.throughputMinutes * 60000);

    // Pas de mesure de debit sur une ligne qui ne repond deja plus :
    // elle echouerait de toute facon, apres avoir attendu le delai
    // d'expiration complet.
    // No throughput reading on a line that already stopped answering:
    // it would fail anyway, after waiting out the full timeout.
    if (wantThroughput && lat.latencyMs != null) {
      lastThroughputAt = Date.now();
      try {
        point.d = round1(await measureDownload(cfg));
        if (cfg.measureUpload) point.u = round1(await measureUpload(cfg));
        lastError = null;
      } catch (e) {
        lastError = String(e.message || e);
        console.warn("[piboard] mesure de debit:", lastError);
      }
    }
    return pushPoint(point);
  } finally {
    running = false;
  }
}

function round1(v) {
  return (v == null || !Number.isFinite(Number(v))) ? null : Math.round(Number(v) * 10) / 10;
}

let tickTimer = null;
let flushTimer = null;

function tick() {
  const cfg = readConfig();
  // Aucune tuile : on ne mesure rien du tout. C'est la garantie
  // annoncee dans l'en-tete de ce fichier.
  // No tile: nothing is measured at all. That is the guarantee stated
  // in this file's header.
  if (!cfg) return;
  if (Date.now() - lastLatencyAt < cfg.latencySeconds * 1000) return;
  sample({ config: cfg }).catch((e) => {
    console.warn("[piboard] sante Internet:", e.message || e);
  });
}

function start() {
  if (tickTimer) return;
  load();
  tickTimer = setInterval(tick, TICK_MS);
  flushTimer = setInterval(flush, FLUSH_MS);
  if (tickTimer.unref) tickTimer.unref();
  if (flushTimer.unref) flushTimer.unref();
  // Premier releve immediat : sans lui, une tuile ajoutee a l'instant
  // resterait vide une minute entiere sans explication.
  // Immediate first reading: without it, a tile just added would stay
  // empty for a whole minute with no explanation.
  tick();
}

/* ============================================================
   Lecture / read API
   ============================================================ */

function getHistory(hours, maxPoints) {
  const h = load();
  const span = Math.max(0.25, Math.min(RETENTION_MS / 3600000, Number(hours) || 24));
  const pts = sliceSince(h.points, Date.now() - span * 3600000);
  return {
    points: downsample(pts, maxPoints),
    stats: {
      latency: summarize(pts, "l"),
      jitter: summarize(pts, "j"),
      loss: summarize(pts, "p"),
      download: summarize(pts, "d"),
      upload: summarize(pts, "u"),
      availability: availability(pts),
      samples: pts.length
    },
    hours: span,
    retentionHours: RETENTION_MS / 3600000
  };
}

function getCurrent() {
  const h = load();
  const last = h.points.length ? h.points[h.points.length - 1] : null;
  const cfg = readConfig();
  return {
    enabled: !!cfg,
    sample: last && {
      t: last.t,
      latencyMs: last.l,
      jitterMs: last.j,
      lossPct: last.p,
      downloadMbps: last.d == null ? null : last.d,
      uploadMbps: last.u == null ? null : last.u
    },
    status: last ? gradeStatus({ latencyMs: last.l, jitterMs: last.j, lossPct: last.p }) : "unknown",
    // Dernier debit CONNU, meme s'il date de plusieurs heures : masquer
    // la valeur entre deux mesures laisserait une case vide 99 % du
    // temps, ce qui serait pire que de la dater.
    // Last KNOWN throughput, even hours old: hiding the value between
    // two readings would leave an empty box 99% of the time, which
    // would be worse than dating it.
    lastThroughput: lastKnownThroughput(h.points),
    lastError,
    nextThroughputAt: (cfg && cfg.throughputMinutes > 0 && lastThroughputAt)
      ? lastThroughputAt + cfg.throughputMinutes * 60000 : null
  };
}

function lastKnownThroughput(points) {
  for (let i = (points || []).length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && Number.isFinite(p.d)) return { t: p.t, downloadMbps: p.d, uploadMbps: Number.isFinite(p.u) ? p.u : null };
  }
  return null;
}

function exportCsv(hours, dialect) {
  const h = load();
  const span = Math.max(1, Math.min(RETENTION_MS / 3600000, Number(hours) || 24));
  const pts = sliceSince(h.points, Date.now() - span * 3600000);
  return { csv: toCsv(pts, { dialect }), points: pts.length, hours: span };
}

/* Archivage SUR LA MACHINE qui heberge PiBoard, et non un
   telechargement navigateur. Les deux existent parce qu'ils ne
   repondent pas au meme besoin : depuis un PC on telecharge, mais
   depuis l'ecran mural en kiosque un telechargement atterrit dans un
   dossier que personne n'ira jamais ouvrir. L'archive, elle, se
   retrouve a un chemin connu, recuperable en SSH ou par un partage.
   Archiving ON THE MACHINE hosting PiBoard, not a browser download.
   Both exist because they answer different needs: from a PC one
   downloads, but from the wall screen in kiosk mode a download lands in
   a folder nobody will ever open. An archive, by contrast, sits at a
   known path, retrievable over SSH or through a share. */
function archive(hours, dialect) {
  const out = exportCsv(hours, dialect);
  const dir = path.join(store.DATA_DIR, "exports");
  fs.mkdirSync(dir, { recursive: true });
  const name = archiveName(new Date(), out.hours);
  const file = path.join(dir, name);
  // BOM UTF-8 : sans lui, un tableur sous Windows affiche les accents
  // en mojibake. Il est inoffensif pour tous les autres lecteurs.
  // UTF-8 BOM: without it, a spreadsheet on Windows shows accents as
  // mojibake. It is harmless to every other reader.
  fs.writeFileSync(file, "\uFEFF" + out.csv, "utf8");
  return { file: name, path: file, points: out.points, hours: out.hours, bytes: Buffer.byteLength(out.csv, "utf8") };
}

function listArchives() {
  const dir = path.join(store.DATA_DIR, "exports");
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names
    .filter((n) => n.endsWith(".csv"))
    .map((n) => {
      let size = 0, mtime = 0;
      try { const st = fs.statSync(path.join(dir, n)); size = st.size; mtime = st.mtimeMs; } catch (e) { /* noop */ }
      return { file: n, bytes: size, t: mtime };
    })
    .sort((a, b) => b.t - a.t)
    .slice(0, 50);
}

function archivePath(name) {
  // Nom strictement controle : jamais de chemin venant du client sans
  // validation (meme regle que store.fileFor).
  // Strictly validated name: never a client-supplied path without
  // checking (same rule as store.fileFor).
  if (!/^piboard-internet-[0-9]{8}-[0-9]{6}-[0-9]+h\.csv$/.test(String(name || ""))) {
    throw new Error("invalid archive name");
  }
  return path.join(store.DATA_DIR, "exports", name);
}

module.exports = {
  start,
  sample,
  flush,
  getHistory,
  getCurrent,
  exportCsv,
  archive,
  listArchives,
  archivePath,
  readConfig,
  DEFAULTS,
  RETENTION_MS,
  // Fonctions pures exposees pour les tests / pure functions exposed for tests
  _parseTargets: parseTargets,
  _median: median,
  _computeJitter: computeJitter,
  _gradeStatus: gradeStatus,
  _summarize: summarize,
  _availability: availability,
  _downsample: downsample,
  _sliceSince: sliceSince,
  _toCsv: toCsv,
  _archiveName: archiveName
};
