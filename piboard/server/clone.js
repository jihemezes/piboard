/* ============================================================
   PiBoard - server/clone.js
   Clone complet d'une installation : de quoi reconstruire le MEME
   tableau de bord sur une autre machine, y compris d'un systeme a
   l'autre, sans rien reconfigurer.

   CE QUE C'EST, PAR RAPPORT A LA SAUVEGARDE. La sauvegarde (voir
   backups.js) est un instantane LOCAL de la configuration : elle vit
   dans data/backups/ et sert a revenir en arriere sur la meme machine.
   Le clone est un fichier qu'on EMPORTE : il contient en plus les
   images (fonds d'ecran, diaporama, bibliotheque personnelle) et, au
   choix, les secrets. C'est une archive ZIP, parce qu'un JSON ne
   transporte pas des photos.

   LES SECRETS, EN DEUX FAMILLES. C'est la decision de conception
   centrale. Une cle d'API TomTom et un mot de passe de messagerie
   n'ont pas la meme nature, mais PiBoard les rangeait dans deux
   endroits choisis selon leur TYPE DE CHAMP, pas selon leur nature :
   la cle YouTube dormait dans le coffre chiffre a cote du mot de passe
   IMAP, tandis que la cle TomTom etait en clair dans layout.json.
   Chaque champ sensible declare donc desormais sa NATURE dans son
   manifeste :
     - « service » : une cle qui identifie PiBoard aupres d'un service
       (TomTom, CARTO, Google). La perdre coute un reglage a refaire.
     - « personal » : un identifiant qui vaut pour SOI (mot de passe de
       messagerie, jeton Home Assistant, code d'acces de l'imprimante).
   Chaque famille s'emporte ou non, par une case a cocher. Le clone
   n'emporte JAMAIS un secret que l'on n'a pas explicitement coche, ou
   qu'il vienne du coffre ou des reglages en clair.

   LES CHEMINS, LE VRAI SUJET DU « SANS RECONFIGURER ».
   « C:\\Users\\jm\\Videos » n'existe pas sur un Mac. Les reglages qui
   designent un dossier sont donc repris un par un : ceux qui visent un
   dossier STANDARD (Vidéos, Images, Documents, Téléchargements,
   Musique, Bureau, dossier personnel) sont retraduits tout seuls vers
   leur equivalent sur la machine d'arrivee ; les autres sont SIGNALES
   dans le rapport d'import, pour etre choisis a la main plutot que de
   pointer dans le vide.

   A full clone of an installation: enough to rebuild the SAME
   dashboard on another machine, across operating systems, with nothing
   to reconfigure. Secrets are split by NATURE (service key vs personal
   credential), each family optional. Folder settings pointing at
   standard folders are translated; the others are reported.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const store = require("./store");
const zip = require("./zip");

const FORMAT = 1;
const MEDIA_ROOT = path.join(store.DATA_DIR, "media");
const LIBRARY_ROOT = path.join(store.DATA_DIR, "library");

/* ---------- Ce qui ne voyage jamais ----------
   L'identite de la MACHINE, pas celle du tableau de bord : mesures,
   compteurs consommes, historiques et caches. Les emporter ferait
   croire a la machine d'arrivee qu'elle a deja consomme le quota d'un
   autre, ou afficherait l'historique systeme d'une machine qu'on n'a
   plus sous les yeux.
   What never travels: the MACHINE's identity rather than the
   dashboard's -- measurements, consumed counters, histories, caches. */
const NEVER_TRAVELS = [
  "tile-secrets",            // le coffre : traite a part, jamais copie tel quel
  "system-history",          // mesures de la machine d'origine
  "internet-health",         // mesures de la ligne d'origine
  "iptvSchedules"            // enregistrements programmes : ils restent sur leur machine
];

function travels(key) {
  if (NEVER_TRAVELS.indexOf(key) >= 0) return false;
  if (key.indexOf("trafficquota.") === 0) return false;   // quotas deja consommes
  return true;
}

/* ---------- Dossiers standards ----------
   Les noms changent d'un systeme a l'autre, et avec la langue sous
   Windows. On raisonne donc sur un ROLE (« les videos »), pas sur un
   nom de dossier.
   Standard folders: reasoning on a ROLE, not on a folder name. */
const ROLES = ["videos", "pictures", "documents", "downloads", "music", "desktop", "home"];

const ROLE_NAMES = {
  videos: ["Videos", "Vidéos", "Movies", "Films"],
  pictures: ["Pictures", "Images", "Photos"],
  documents: ["Documents"],
  downloads: ["Downloads", "Téléchargements"],
  music: ["Music", "Musique"],
  desktop: ["Desktop", "Bureau"]
};

function splitPath(p) {
  return String(p || "").split(/[\\/]+/).filter(Boolean);
}

/* Dossier local correspondant a un role, sur CETTE machine. Le premier
   nom qui existe reellement gagne ; sinon le nom canonique, qui sera
   cree au besoin.
   The local folder for a role on THIS machine. */
function localFolderFor(role, home) {
  const base = home || os.homedir();
  if (role === "home") return base;
  const names = ROLE_NAMES[role] || [];
  for (const name of names) {
    const candidate = path.join(base, name);
    try { if (fs.statSync(candidate).isDirectory()) return candidate; } catch (e) { /* suivant */ }
  }
  return names.length ? path.join(base, names[0]) : base;
}

/* Reconnait un chemin : sous le dossier personnel et sous un dossier
   standard, ou simplement sous le dossier personnel, ou ailleurs.
   Classifies a path: under a standard folder, under the home folder, or
   elsewhere. */
function classifyPath(value, home) {
  const raw = String(value || "").trim();
  if (!raw) return { kind: "empty" };
  const base = splitPath(home || os.homedir());
  const parts = splitPath(raw);
  const windows = /^[a-z]:/i.test(raw);

  // Meme debut que le dossier personnel ?
  const sameHome = base.length && parts.length >= base.length
    && base.every((seg, i) => seg.toLowerCase() === String(parts[i]).toLowerCase());
  if (!sameHome) return { kind: "elsewhere", value: raw, windows };

  const rest = parts.slice(base.length);
  if (!rest.length) return { kind: "standard", role: "home", rest: [], value: raw };
  const first = rest[0].toLowerCase();
  for (const role of ROLES) {
    if (role === "home") continue;
    if ((ROLE_NAMES[role] || []).some((n) => n.toLowerCase() === first)) {
      return { kind: "standard", role, rest: rest.slice(1), value: raw };
    }
  }
  return { kind: "home", rest, value: raw };
}

/* Traduit un chemin classe vers CETTE machine. Renvoie null quand il
   n'y a rien de raisonnable a proposer : c'est alors a l'utilisateur de
   choisir, et le rapport d'import le lui demande.
   Translates a classified path to THIS machine; null when there is
   nothing sensible to propose. */
function translatePath(classified, home) {
  if (!classified || classified.kind === "empty") return null;
  const base = home || os.homedir();
  if (classified.kind === "standard") {
    return path.join(localFolderFor(classified.role, base), ...(classified.rest || []));
  }
  if (classified.kind === "home") {
    return path.join(base, ...(classified.rest || []));
  }
  return null;                                  // « elsewhere » : on ne devine pas
}

/* ---------- Champs sensibles et champs chemin ----------
   Lus dans les manifestes : chaque tuile declare elle-meme la nature de
   ses secrets et lesquels de ses reglages sont des chemins. Rien n'est
   devine ici, sans quoi une future tuile serait oubliee en silence.
   Read from the manifests: each tile declares the nature of its own
   secrets and which of its settings are paths. */
function readManifests(widgetsDir) {
  const dir = widgetsDir || path.join(__dirname, "..", "public", "widgets");
  const out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { names = []; }
  for (const name of names) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, name, "manifest.json"), "utf8")));
    } catch (e) { /* dossier sans manifeste */ }
  }
  return out;
}

function sensitiveFields(manifests) {
  const out = {};
  for (const m of manifests || []) {
    for (const f of m.settings || []) {
      if (f.type !== "secret" && f.type !== "password") continue;
      out[m.id + "." + f.key] = {
        widget: m.id, key: f.key, type: f.type,
        nature: f.sensitivity === "service" ? "service" : "personal"
      };
    }
  }
  return out;
}

function pathFields(manifests) {
  const out = {};
  for (const m of manifests || []) {
    for (const f of m.settings || []) {
      if (f.type === "folder" || f.isPath) out[m.id + "." + f.key] = { widget: m.id, key: f.key };
    }
  }
  return out;
}

/* ---------- Parcours des tuiles ----------
   Meme parcours generique que le reste du projet (voir
   internetHealth.js) : tuiles du mode classique, tuiles des tiroirs et
   tuiles de chaque page du mode tableau de bord. Refaire un parcours
   maison ici serait le meilleur moyen d'oublier en silence les tuiles
   d'une page 2.
   The same generic walk as the rest of the project: a hand-rolled one
   here would silently miss the tiles of a second page. */
function allTiles(layout) {
  const out = [];
  if (!layout || typeof layout !== "object") return out;
  if (Array.isArray(layout.tiles)) out.push(...layout.tiles);
  for (const value of Object.values(layout)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value.tiles)) out.push(...value.tiles);
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object" && Array.isArray(entry.tiles)) out.push(...entry.tiles);
      }
    }
  }
  return out.filter(Boolean);
}

/* ---------- Nettoyage de la disposition ----------
   Les champs « password » vivent en clair dans layout.json : si leur
   famille n'est pas cochee, ils doivent etre RETIRES de l'export. Sans
   ce passage, decocher « identifiants personnels » n'aurait aucun
   effet sur le mot de passe WebDAV du diaporama, qui partirait quand
   meme -- c'est tout l'interet d'avoir separe les deux familles.
   "password" fields live in the clear inside layout.json: if their
   family is not ticked they must be STRIPPED, otherwise unticking a
   family would have no effect on them. */
function stripSecretsFromLayout(layout, fields, keep) {
  const copy = JSON.parse(JSON.stringify(layout || {}));
  const removed = [];
  for (const tile of allTiles(copy)) {
    const settings = tile.settings;
    if (!settings) continue;
    for (const [id, field] of Object.entries(fields || {})) {
      if (field.widget !== tile.widget) continue;
      if (!(field.key in settings)) continue;
      if ((keep || {})[field.nature]) continue;
      if (settings[field.key] === "" || settings[field.key] == null) continue;
      delete settings[field.key];
      removed.push({ tile: tile.id || "", field: id, nature: field.nature });
    }
  }
  return { layout: copy, removed };
}

/* Chemins presents dans une disposition, avec leur classement. */
function collectPaths(layout, fields, home) {
  const found = [];
  for (const tile of allTiles(layout)) {
    const settings = tile.settings;
    if (!settings) continue;
    for (const [id, field] of Object.entries(fields || {})) {
      if (field.widget !== tile.widget) continue;
      const value = settings[field.key];
      if (!value || typeof value !== "string") continue;
      found.push({
        tile: tile.id || "", widget: field.widget, key: field.key, field: id,
        value, classified: classifyPath(value, home)
      });
    }
  }
  return found;
}

/* Applique les chemins choisis -- traduction automatique ou choix fait
   a l'import -- a une disposition.
   Applies the chosen paths to a layout. */
function applyPaths(layout, decisions) {
  const copy = JSON.parse(JSON.stringify(layout || {}));
  const wanted = new Map();
  for (const d of decisions || []) if (d && d.to) wanted.set((d.tile || "") + "|" + d.key, d.to);
  let changed = 0;
  for (const tile of allTiles(copy)) {
    if (!tile.settings) continue;
    for (const key of Object.keys(tile.settings)) {
      const to = wanted.get((tile.id || "") + "|" + key);
      if (to && tile.settings[key] !== to) { tile.settings[key] = to; changed++; }
    }
  }
  return { layout: copy, changed };
}

/* ---------- Chiffrement facultatif des identifiants personnels ----------
   Emporter des mots de passe dans un fichier telechargeable merite une
   protection : quand une phrase de passe est donnee, cette partie de
   l'archive est chiffree et elle seule. Sans phrase, le fichier le dit
   clairement plutot que de faire semblant.
   Optional encryption of personal credentials. */
function encryptSecrets(json, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(String(passphrase), salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(json), "utf8")), cipher.final()]);
  return {
    algo: "aes-256-gcm", salt: salt.toString("base64"), iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), data: body.toString("base64")
  };
}

function decryptSecrets(box, passphrase) {
  const key = crypto.scryptSync(String(passphrase), Buffer.from(box.salt, "base64"), 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(box.data, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}

/* ---------- Fichiers d'un dossier, a plat ---------- */
function walk(root, prefix) {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of names) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else if (entry.isFile()) out.push({ rel, full, size: fs.statSync(full).size });
  }
  return out;
}

/* Une image est deja compressee : la recompresser coute du temps pour
   ne rien gagner. An image is already compressed. */
function isAlreadyCompressed(name) {
  return /\.(jpe?g|png|gif|webp|avif|mp4|webm|mp3|ogg|zip)$/i.test(name);
}

/* ============================================================
   Construction, inspection et application d'un clone
   ============================================================ */

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; }
}

function vaultSecrets() {
  /* Le coffre est lu ICI, deliberement, et non via tileSecrets : on
     veut la liste complete pour la trier par nature, pas une valeur a
     la fois. Le coffre lui-meme n'est jamais copie tel quel dans
     l'archive -- seules les valeurs retenues y entrent.
     The vault is read here to sort it by nature; the vault file itself
     is never copied into the archive. */
  const tileSecrets = require("./tileSecrets");
  if (typeof tileSecrets.all !== "function") return {};
  try { return tileSecrets.all() || {}; } catch (e) { return {}; }
}

/* Repartit les secrets du coffre selon la nature declaree par les
   manifestes. Un secret dont on ne connait pas la nature est traite
   comme PERSONNEL : en cas de doute, on protege.
   Splits vault secrets by declared nature; an unknown one counts as
   personal -- when in doubt, protect. */
function splitVault(vault, fields, layout) {
  const widgetOf = new Map();
  for (const tile of allTiles(layout)) if (tile.id) widgetOf.set(tile.id, tile.widget);
  const out = { service: {}, personal: {}, unknown: [] };
  for (const [tileId, entries] of Object.entries(vault || {})) {
    for (const [key, value] of Object.entries(entries || {})) {
      const widget = widgetOf.get(tileId);
      const field = widget ? fields[widget + "." + key] : null;
      const nature = field ? field.nature : "personal";
      if (!field) out.unknown.push({ tile: tileId, key });
      out[nature][tileId] = out[nature][tileId] || {};
      out[nature][tileId][key] = value;
    }
  }
  return out;
}

/* Cles de service rangees dans les reglages generaux (la cle CARTO des
   fonds de carte) : meme nature, meme traitement.
   Service keys living in the general settings. */
const GLOBAL_SERVICE_KEYS = ["cartoKey"];

function buildClone(options) {
  const o = options || {};
  const keep = { service: !!o.includeServiceKeys, personal: !!o.includePersonalSecrets };
  const manifests = readManifests(o.widgetsDir);
  const fields = sensitiveFields(manifests);

  const entries = [];
  const report = { config: [], media: 0, library: 0, mediaBytes: 0, removedSecrets: [], paths: [] };

  // 1. Les fichiers de configuration, moins ce qui ne voyage pas.
  let names = [];
  try { names = fs.readdirSync(store.DATA_DIR); } catch (e) { names = []; }
  let layout = null;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const key = name.slice(0, -5);
    if (!travels(key)) continue;
    const data = readJson(path.join(store.DATA_DIR, name));
    if (data == null) continue;
    if (key === "layout") { layout = data; continue; }       // traite plus bas
    let value = data;
    if (key === "settings" && !keep.service) {
      value = Object.assign({}, data);
      for (const k of GLOBAL_SERVICE_KEYS) {
        if (value[k]) { delete value[k]; report.removedSecrets.push({ field: "settings." + k, nature: "service" }); }
      }
    }
    entries.push({ name: "config/" + name, data: JSON.stringify(value, null, 2) });
    report.config.push(key);
  }

  // 2. La disposition, nettoyee des secrets non retenus.
  if (layout) {
    const stripped = stripSecretsFromLayout(layout, fields, keep);
    report.removedSecrets.push(...stripped.removed);
    report.paths = collectPaths(layout, pathFields(manifests), o.home)
      .map((p) => ({ tile: p.tile, widget: p.widget, key: p.key, value: p.value, classified: p.classified }));
    entries.push({ name: "config/layout.json", data: JSON.stringify(stripped.layout, null, 2) });
    report.config.push("layout");
  }

  // 3. Les secrets du coffre, par famille.
  const split = splitVault(vaultSecrets(), fields, layout);
  if (keep.service && Object.keys(split.service).length) {
    entries.push({ name: "secrets/service.json", data: JSON.stringify(split.service, null, 2) });
  }
  if (keep.personal && Object.keys(split.personal).length) {
    const payload = split.personal;
    if (o.passphrase) {
      entries.push({ name: "secrets/personal.enc.json", data: JSON.stringify(encryptSecrets(payload, o.passphrase), null, 2) });
    } else {
      entries.push({ name: "secrets/personal.json", data: JSON.stringify(payload, null, 2) });
    }
  }

  // 4. Les images : fonds d'ecran, diaporama, bibliotheque personnelle.
  if (o.includeImages) {
    for (const [root, prefix, counter] of [[MEDIA_ROOT, "media", "media"], [LIBRARY_ROOT, "library", "library"]]) {
      for (const file of walk(root, "")) {
        entries.push({
          name: prefix + "/" + file.rel,
          data: fs.readFileSync(file.full),
          store: isAlreadyCompressed(file.rel)
        });
        report[counter]++;
        report.mediaBytes += file.size;
      }
    }
  }

  // 5. Le manifeste du clone, ecrit EN DERNIER : il porte l'empreinte
  //    de tout le reste, ce qui rend un fichier tronque detectable.
  const payload = Buffer.concat(entries.map((e) =>
    Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), "utf8")));
  const manifest = {
    format: FORMAT,
    kind: "piboard-clone",
    createdAt: new Date().toISOString(),
    appVersion: o.appVersion || "",
    platform: process.platform,
    home: o.home || os.homedir(),
    contents: {
      config: report.config.slice().sort(),
      serviceKeys: keep.service,
      personalSecrets: keep.personal,
      encrypted: !!(keep.personal && o.passphrase),
      images: !!o.includeImages,
      mediaFiles: report.media,
      libraryFiles: report.library,
      mediaBytes: report.mediaBytes
    },
    paths: report.paths,
    digest: crypto.createHash("sha256").update(payload).digest("hex")
  };
  entries.unshift({ name: "piboard-clone.json", data: JSON.stringify(manifest, null, 2) });
  entries.push({ name: "LISEZMOI.txt", data: readmeText(manifest) });

  return { buffer: zip.write(entries, { date: new Date() }), manifest, report };
}

function readmeText(manifest) {
  const warn = manifest.contents.personalSecrets && !manifest.contents.encrypted
    ? "\nATTENTION : ce clone contient des identifiants personnels EN CLAIR\n"
      + "(mots de passe, jetons). Traitez-le comme un trousseau de cles.\n"
      + "WARNING: this clone contains personal credentials IN THE CLEAR.\n"
    : "";
  return [
    "Clone PiBoard / PiBoard clone",
    "Cree le / created " + manifest.createdAt,
    "Version d'origine / source version : " + (manifest.appVersion || "?"),
    "Plateforme d'origine / source platform : " + manifest.platform,
    "",
    "Ce fichier se restaure depuis PiBoard : Reglages generaux, section",
    "Sauvegardes, « Importer un clone ». Ne le decompressez pas a la main.",
    "Restore it from PiBoard: General settings, Backups, \"Import a clone\".",
    warn
  ].join("\n");
}

/* ---------- Inspection : ce que contient un clone, sans l'appliquer ----------
   Le but est de pouvoir REGARDER avant d'ecraser : combien de tuiles,
   quelle version d'origine, quels chemins demanderont une decision.
   Looking before overwriting. */
function inspectClone(buffer, options) {
  const o = options || {};
  const files = zip.read(buffer);
  const byName = new Map(files.map((f) => [f.name, f]));
  const manifestFile = byName.get("piboard-clone.json");
  if (!manifestFile) {
    const e = new Error("ce fichier n'est pas un clone PiBoard / not a PiBoard clone");
    e.code = "not-a-clone";
    throw e;
  }
  const manifest = JSON.parse(manifestFile.data.toString("utf8"));
  if (manifest.kind !== "piboard-clone") {
    const e = new Error("ce fichier n'est pas un clone PiBoard / not a PiBoard clone");
    e.code = "not-a-clone";
    throw e;
  }

  /* Empreinte : l'archive doit etre entiere. Un clone tronque est
     refuse ici plutot que d'etre applique a moitie. */
  const payload = Buffer.concat(files
    .filter((f) => f.name !== "piboard-clone.json" && f.name !== "LISEZMOI.txt")
    .map((f) => f.data));
  const digest = crypto.createHash("sha256").update(payload).digest("hex");
  const intact = !manifest.digest || digest === manifest.digest;

  const layout = byName.get("config/layout.json")
    ? JSON.parse(byName.get("config/layout.json").data.toString("utf8")) : null;
  const tiles = allTiles(layout);
  const home = o.home || os.homedir();

  /* Chaque chemin recoit une proposition : traduit tout seul, ou a
     choisir. C'est ce que l'import affiche. */
  const paths = (manifest.paths || []).map((p) => {
    const to = translatePath(p.classified, home);
    return {
      tile: p.tile, widget: p.widget, key: p.key, from: p.value,
      to, needsChoice: !to, kind: (p.classified && p.classified.kind) || "empty"
    };
  });

  return {
    manifest, intact, digest,
    newer: !!(o.appVersion && manifest.appVersion && compareVersions(manifest.appVersion, o.appVersion) > 0),
    counts: {
      tiles: tiles.length,
      pages: (layout && Array.isArray(layout.pages) ? layout.pages.length : 0),
      config: (manifest.contents && manifest.contents.config || []).length,
      media: (manifest.contents && manifest.contents.mediaFiles) || 0,
      library: (manifest.contents && manifest.contents.libraryFiles) || 0
    },
    widgets: [...new Set(tiles.map((t) => t.widget).filter(Boolean))].sort(),
    paths,
    needsPassphrase: !!byName.get("secrets/personal.enc.json")
  };
}

function compareVersions(a, b) {
  const pa = String(a).split("."), pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]) || 0, nb = Number(pb[i]) || 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

/* ---------- Application ----------
   Ecrit reellement le clone. L'appelant a deja pris une sauvegarde de
   securite (voir la route) : ici on applique, et on rend compte.
   Actually writes the clone; the caller has already taken a safety
   backup. */
function applyClone(buffer, options) {
  const o = options || {};
  const info = inspectClone(buffer, o);
  if (!info.intact && !o.force) {
    const e = new Error("clone incomplet ou abîmé / incomplete or damaged clone");
    e.code = "damaged";
    throw e;
  }
  const files = zip.read(buffer);
  const byName = new Map(files.map((f) => [f.name, f]));
  const report = { config: [], media: 0, library: 0, secrets: 0, paths: [], skipped: [], warnings: [] };

  // 1. Les chemins : traduction automatique ou choix venu de l'import.
  const decisions = [];
  for (const p of info.paths) {
    const chosen = (o.paths || {})[p.tile + "|" + p.key];
    const to = chosen || p.to;
    if (to) decisions.push({ tile: p.tile, key: p.key, to });
    else report.warnings.push({ kind: "path", tile: p.tile, widget: p.widget, key: p.key, from: p.from });
    report.paths.push({ tile: p.tile, widget: p.widget, key: p.key, from: p.from, to: to || null, chosen: !!chosen });
  }

  // 2. Les fichiers de configuration.
  for (const file of files) {
    if (file.name.indexOf("config/") !== 0 || !file.name.endsWith(".json")) continue;
    const key = file.name.slice("config/".length, -5);
    if (!travels(key)) { report.skipped.push(key); continue; }
    let value;
    try { value = JSON.parse(file.data.toString("utf8")); }
    catch (e) { report.skipped.push(key); continue; }
    if (key === "layout") value = applyPaths(value, decisions).layout;
    store.write(key, value);
    report.config.push(key);
  }

  // 3. Les secrets, chacun dans le coffre.
  const tileSecrets = require("./tileSecrets");
  const put = (payload) => {
    for (const [tileId, entries] of Object.entries(payload || {})) {
      for (const [key, value] of Object.entries(entries || {})) {
        try { tileSecrets.set(tileId, key, value); report.secrets++; }
        catch (e) { report.warnings.push({ kind: "secret", tile: tileId, key }); }
      }
    }
  };
  if (byName.get("secrets/service.json")) put(JSON.parse(byName.get("secrets/service.json").data.toString("utf8")));
  if (byName.get("secrets/personal.json")) put(JSON.parse(byName.get("secrets/personal.json").data.toString("utf8")));
  if (byName.get("secrets/personal.enc.json")) {
    if (!o.passphrase) report.warnings.push({ kind: "passphrase" });
    else {
      try { put(decryptSecrets(JSON.parse(byName.get("secrets/personal.enc.json").data.toString("utf8")), o.passphrase)); }
      catch (e) { report.warnings.push({ kind: "passphrase-wrong" }); }
    }
  }

  // 4. Les images.
  for (const file of files) {
    let root = null, rel = null;
    if (file.name.indexOf("media/") === 0) { root = MEDIA_ROOT; rel = file.name.slice("media/".length); }
    else if (file.name.indexOf("library/") === 0) { root = LIBRARY_ROOT; rel = file.name.slice("library/".length); }
    if (!root || !rel || rel.endsWith("/")) continue;
    /* Un nom d'entree ne doit JAMAIS sortir de son dossier : une
       archive mal intentionnee pourrait sinon ecrire n'importe ou.
       An entry name must never escape its folder. */
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) { report.skipped.push(file.name); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.data);
    if (root === MEDIA_ROOT) report.media++; else report.library++;
  }

  return { info, report };
}

module.exports = {
  FORMAT, NEVER_TRAVELS, ROLES, ROLE_NAMES, MEDIA_ROOT, LIBRARY_ROOT,
  travels, splitPath, localFolderFor, classifyPath, translatePath,
  readManifests, sensitiveFields, pathFields,
  allTiles, stripSecretsFromLayout, collectPaths, applyPaths,
  encryptSecrets, decryptSecrets, walk, isAlreadyCompressed, zip,
  buildClone, inspectClone, applyClone, compareVersions, splitVault, GLOBAL_SERVICE_KEYS
};
