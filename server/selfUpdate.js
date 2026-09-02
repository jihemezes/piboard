/* ============================================================
   PiBoard - server/selfUpdate.js
   Mise a jour automatique du serveur (Raspberry Pi / Linux) depuis les
   versions publiees sur GitHub Releases.

   POURQUOI CE MODULE : sous Windows, electron-updater (voir
   electron/updater.js) lit le fichier latest.yml de la derniere release
   GitHub, compare les versions et installe l'installeur NSIS. Sur le Pi,
   il n'y a ni Electron ni installeur : jusqu'ici, la mise a jour se
   faisait a la main (git pull, ou archive ZIP ecrasee sur le dossier).
   Ce module reproduit le meme cycle -- verifier, proposer, installer --
   avec ce que GitHub fournit pour chaque tag publie : une archive
   tar.gz des sources.

   CYCLE COMPLET :
     1. check()  : deux canaux, selon le reglage "updateChannel".
                   - "stable" (defaut) : GET /releases/latest, qui ne
                     renvoie QUE la release marquee "Latest" sur GitHub.
                     Brouillons et pre-releases sont ignores par GitHub
                     lui-meme -- meme comportement qu'electron-updater
                     sous Windows.
                   - "preview" : GET /releases (liste), d'ou l'on retient
                     la version la plus HAUTE parmi les releases publiees,
                     pre-releases comprises. Les brouillons restent
                     exclus : un brouillon n'a pas d'archive telechargeable
                     et n'est visible que de son auteur.
                   Dans les deux cas, le tag est compare a package.json
                   (semver).
     2. apply()  : telecharge l'archive tar.gz du tag dans data/updates/,
                   l'extrait dans data/updates/staging/, puis REMPLACE le
                   code par un jeu de renommages : chaque dossier/fichier
                   de premier niveau de l'ancienne version est deplace
                   dans data/updates/previous/ avant que celui de la
                   nouvelle prenne sa place. Deux consequences voulues :
                     - les fichiers SUPPRIMES d'une version a l'autre
                       disparaissent reellement (un dossier server/ entier
                       est remplace, pas fusionne) -- contrairement a une
                       archive ZIP decompressee par-dessus, qui laisse
                       trainer les anciens fichiers ;
                     - un retour arriere est possible tant que previous/
                       existe : c'est ce qui est fait automatiquement si
                       `npm install` echoue.
     3. deps     : `npm install --omit=dev` UNIQUEMENT si package-lock.json
                   a change. Un correctif qui ne touche que le code n'a
                   donc besoin ni du reseau npm, ni meme de npm lui-meme
                   (absent d'un `apt install nodejs` Debian sans le paquet
                   `npm`).
     4. restart  : delegue a la couche plateforme (server/platform/). Sous
                   systemd, le processus se termine avec un code non nul
                   et Restart= le relance ; sinon un remplacant est lance
                   avant de quitter.

   CE QUI N'EST JAMAIS TOUCHE : data/ (reglages, disposition, cles,
   photos), node_modules/ (sauf par npm lui-meme), .git/ si present.

   Toutes les operations reseau et disque passent par des dependances
   injectables (fetchImpl, npmCommand, restart, apiBase...) pour que
   test/selfUpdate.test.js puisse derouler le cycle entier contre un faux
   serveur HTTP et un faux npm, sans jamais toucher a GitHub ni au vrai
   dossier de l'application.

   Automatic server update (Raspberry Pi / Linux) from the versions
   published on GitHub Releases.

   WHY THIS MODULE: on Windows, electron-updater (see electron/updater.js)
   reads the latest GitHub release's latest.yml, compares versions and
   installs the NSIS installer. On the Pi there is neither Electron nor an
   installer: until now, updating was manual (git pull, or a ZIP archive
   extracted over the folder). This module reproduces the same cycle --
   check, offer, install -- with what GitHub provides for every published
   tag: a tar.gz archive of the sources.

   FULL CYCLE:
     1. check()  : two channels, per the "updateChannel" setting.
                   - "stable" (default): GET /releases/latest, which
                     returns ONLY the release marked "Latest" on GitHub.
                     Drafts and pre-releases are filtered by GitHub
                     itself -- same behaviour as electron-updater on
                     Windows.
                   - "preview": GET /releases (the list), from which we
                     keep the HIGHEST version among published releases,
                     pre-releases included. Drafts stay excluded: a draft
                     has no downloadable archive and is visible only to
                     its author.
                   Either way, the tag is compared with package.json
                   (semver).
     2. apply()  : downloads the tag's tar.gz into data/updates/, extracts
                   it into data/updates/staging/, then REPLACES the code
                   through a set of renames: every top-level folder/file
                   of the old version is moved into data/updates/previous/
                   before the new one takes its place. Two intended
                   consequences:
                     - files REMOVED between versions really disappear (a
                       whole server/ folder is replaced, not merged) --
                       unlike a ZIP extracted on top, which leaves old
                       files lying around;
                     - a rollback is possible as long as previous/ exists:
                       that's what happens automatically if `npm install`
                       fails.
     3. deps     : `npm install --omit=dev` ONLY if package-lock.json
                   changed. A code-only fix therefore needs neither the
                   npm network nor even npm itself (missing from a Debian
                   `apt install nodejs` without the `npm` package).
     4. restart  : delegated to the platform layer (server/platform/).
                   Under systemd, the process exits with a non-zero code
                   and Restart= brings it back; otherwise a replacement is
                   spawned before quitting.

   NEVER TOUCHED: data/ (settings, layout, keys, photos), node_modules/
   (except by npm itself), .git/ if present.

   Every network and disk operation goes through injectable dependencies
   (fetchImpl, npmCommand, restart, apiBase...) so test/selfUpdate.test.js
   can run the whole cycle against a fake HTTP server and a fake npm,
   without ever touching GitHub or the real application folder.
   ============================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable, Transform } = require("stream");

const DEFAULT_REPO = "jihemezes/piboard";
const DEFAULT_API_BASE = "https://api.github.com";
const CHECK_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const NPM_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_STARTUP_DELAY_MS = 20000;
const LOG_MAX_LINES = 200;

/* Entrees de premier niveau du dossier de l'application qui ne sont
   JAMAIS remplacees ni deplacees, quel que soit le contenu de l'archive.
   Top-level entries of the application folder that are NEVER replaced
   nor moved, whatever the archive contains. */
const PRESERVED = new Set(["data", "node_modules", ".git", "dist"]);

/* ---------- Versions ---------- */

/* "v1.81.0" -> "1.81.0" ; "1.81.0" -> "1.81.0" ; autre -> null.
   Un tag GitHub qui n'est pas une version (ex : "nightly") est ignore
   plutot que compare a tort. A GitHub tag that isn't a version (e.g.
   "nightly") is ignored rather than wrongly compared. */
function parseVersionTag(tag) {
  const m = String(tag || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

/* Comparaison semver simplifiee sur les trois nombres : -1, 0 ou 1.
   Les suffixes ("-beta") sont ignores -- PiBoard n'en publie pas.
   Simplified three-number semver comparison: -1, 0 or 1. Suffixes
   ("-beta") are ignored -- PiBoard doesn't publish any. */
function compareVersions(a, b) {
  const pa = String(a || "").split(/[-+]/)[0].split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "").split(/[-+]/)[0].split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/* ---------- Utilitaires disque / disk helpers ---------- */

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

/* Deplacement : renommage quand source et cible sont sur le meme systeme
   de fichiers (cas normal : data/ est dans le dossier de l'application),
   copie puis suppression sinon (PIBOARD_DATA pointant ailleurs).
   Move: a rename when source and target share a filesystem (the normal
   case: data/ lives inside the application folder), copy then delete
   otherwise (PIBOARD_DATA pointing elsewhere). */
function moveEntry(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    fs.cpSync(from, to, { recursive: true, force: true });
    rmrf(from);
  }
}

function readTextOrNull(p) {
  try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; }
}

function readJsonOrNull(p) {
  const text = readTextOrNull(p);
  if (text == null) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function runCommand(cmd, args, opts) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, Object.assign({ stdio: ["ignore", "pipe", "pipe"] }, opts || {}));
    } catch (e) {
      return resolve({ code: -1, error: e, output: "" });
    }
    const lines = [];
    const onData = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const t = line.trim();
        if (t) { lines.push(t); if (opts && opts.onLine) opts.onLine(t); }
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) { /* deja termine / already gone */ } },
      (opts && opts.timeoutMs) || NPM_TIMEOUT_MS);
    child.on("error", (err) => { clearTimeout(timer); resolve({ code: -1, error: err, output: lines.join("\n") }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, error: null, output: lines.join("\n") }); });
  });
}

/* ---------- Remplacement de l'arborescence / tree swap ----------
   Fonction pure vis-a-vis du reseau : ne travaille qu'avec des dossiers
   locaux. Exposee pour les tests.
     appDir     : dossier de l'application / application folder
     stagingDir : nouvelle version extraite / extracted new version
     previousDir: ou ranger l'ancienne / where to park the old one
     manifest   : entrees installees par la mise a jour precedente (null
                  la premiere fois) / entries installed by the previous
                  update (null the first time)
   Renvoie la liste des entrees desormais en place. Returns the list of
   entries now in place. */
function swapTree(appDir, stagingDir, previousDir, manifest) {
  rmrf(previousDir);
  fs.mkdirSync(previousDir, { recursive: true });

  const incoming = fs.readdirSync(stagingDir).filter((n) => !PRESERVED.has(n));
  const incomingSet = new Set(incoming);

  /* Entrees installees la fois precedente et absentes de la nouvelle
     archive : supprimees du projet, donc deplacees vers previous/ elles
     aussi (retour arriere possible) plutot que laissees a trainer.
     Entries installed last time and absent from the new archive: removed
     from the project, so moved to previous/ as well (rollback possible)
     rather than left lying around. */
  const stale = (manifest && Array.isArray(manifest.entries) ? manifest.entries : [])
    .filter((n) => !incomingSet.has(n) && !PRESERVED.has(n) && fs.existsSync(path.join(appDir, n)));

  const moved = [];
  for (const name of [...incoming, ...stale]) {
    const current = path.join(appDir, name);
    if (fs.existsSync(current)) {
      moveEntry(current, path.join(previousDir, name));
      moved.push(name);
    }
  }
  for (const name of incoming) {
    moveEntry(path.join(stagingDir, name), path.join(appDir, name));
  }
  return { installed: incoming, moved };
}

/* Retour arriere : remet en place tout ce qui avait ete deplace dans
   previous/, en ecartant d'abord la version fraichement installee.
   Rollback: puts back everything that had been moved into previous/,
   discarding the freshly installed version first. */
function rollbackTree(appDir, previousDir, installed) {
  for (const name of installed || []) rmrf(path.join(appDir, name));
  let names = [];
  try { names = fs.readdirSync(previousDir); } catch (e) { return; }
  for (const name of names) {
    if (PRESERVED.has(name)) continue;
    moveEntry(path.join(previousDir, name), path.join(appDir, name));
  }
}

/* ---------- L'updater / the updater ---------- */

function createUpdater(options) {
  // Les cles a `undefined` ne doivent pas ecraser les valeurs par defaut
  // (Object.assign les copierait telles quelles).
  // Keys set to `undefined` must not override the defaults
  // (Object.assign would copy them as-is).
  const given = {};
  for (const [k, v] of Object.entries(options || {})) if (v !== undefined) given[k] = v;
  const opts = Object.assign({
    appDir: path.join(__dirname, ".."),
    dataDir: null,
    currentVersion: "0.0.0",
    repo: DEFAULT_REPO,
    // "stable" | "preview". Fonction ou valeur : le reglage peut changer
    // sans redemarrer le serveur, il est donc relu a chaque verification.
    // "stable" | "preview". Function or value: the setting can change
    // without restarting the server, so it is re-read on every check.
    channel: "stable",
    apiBase: DEFAULT_API_BASE,
    fetchImpl: typeof fetch === "function" ? fetch : null,
    support: { supported: false, reason: "unknown" },   // objet ou fonction / object or function
    restart: () => ({ ok: false, reason: "no-restart" }),
    // ["npm", ["install", ...]] par defaut ; remplacable par les tests
    // default ["npm", ["install", ...]]; replaceable by tests
    npmCommand: null,
    tarCommand: "tar",
    checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
    startupDelayMs: DEFAULT_STARTUP_DELAY_MS,
    onChange: null,
    log: console
  }, given);

  const dataDir = opts.dataDir || path.join(opts.appDir, "data");
  const updatesDir = path.join(dataDir, "updates");
  const stagingDir = path.join(updatesDir, "staging");
  const previousDir = path.join(updatesDir, "previous");
  const manifestPath = path.join(updatesDir, "manifest.json");

  const info = {
    checkedAt: null,
    latestVersion: null,
    tag: null,
    publishedAt: null,
    notes: null,
    htmlUrl: null,
    prerelease: false,
    tarballUrl: null,
    error: null
  };

  const job = {
    phase: "idle",     // idle | downloading | extracting | installing | restarting | done | error
    version: null,
    startedAt: null,
    finishedAt: null,
    progress: null,    // { bytes, total } pendant le telechargement / during download
    error: null,
    rolledBack: false,
    log: []
  };

  let checkPromise = null;
  let timers = [];

  function emit() {
    if (typeof opts.onChange === "function") {
      try { opts.onChange(status()); } catch (e) { /* observateur defaillant / faulty observer */ }
    }
  }

  function logLine(line) {
    const text = String(line || "").trim();
    if (!text) return;
    job.log.push(text);
    if (job.log.length > LOG_MAX_LINES) job.log.splice(0, job.log.length - LOG_MAX_LINES);
    if (opts.log && typeof opts.log.log === "function") opts.log.log("[piboard] update: " + text);
    emit();
  }

  function setPhase(phase, extra) {
    job.phase = phase;
    if (extra) Object.assign(job, extra);
    emit();
  }

  function support() {
    const sup = typeof opts.support === "function" ? opts.support() : opts.support;
    return sup && typeof sup === "object" ? sup : { supported: false, reason: "unknown" };
  }

  function isBusy() {
    return ["downloading", "extracting", "installing", "restarting"].includes(job.phase);
  }

  function available() {
    return !!(info.latestVersion && compareVersions(info.latestVersion, opts.currentVersion) > 0);
  }

  function status() {
    return {
      supported: !!support().supported,
      reason: support().reason || null,
      currentVersion: opts.currentVersion,
      latestVersion: info.latestVersion,
      available: available(),
      tag: info.tag,
      publishedAt: info.publishedAt,
      notes: info.notes,
      htmlUrl: info.htmlUrl,
      prerelease: info.prerelease,
      channel: channel(),
      checkedAt: info.checkedAt,
      checkError: info.error,
      busy: isBusy(),
      job: {
        phase: job.phase,
        version: job.version,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        progress: job.progress,
        error: job.error,
        rolledBack: job.rolledBack,
        log: job.log.slice(-40)
      }
    };
  }

  /* ---------- Verification / check ---------- */

  function channel() {
    const c = typeof opts.channel === "function" ? opts.channel() : opts.channel;
    return c === "preview" ? "preview" : "stable";
  }

  /* Parmi une liste de releases, la version la plus HAUTE publiee.
     Deux precautions :
     - les brouillons (`draft`) sont ecartes : leur archive n'est pas
       telechargeable et ils ne sont visibles que de leur auteur ;
     - on compare les VERSIONS, pas les dates de publication. Republier
       un correctif sur une ancienne branche apres une pre-release plus
       recente ne doit pas faire "reculer" le tableau.
     Fonction pure, testee dans test/selfUpdate.test.js.
     Among a list of releases, the HIGHEST published version. Two
     precautions:
     - drafts are dropped: their archive is not downloadable and they are
       visible only to their author;
     - we compare VERSIONS, not publication dates. Republishing a fix on
       an older branch after a more recent pre-release must not make the
       board "go backwards".
     Pure function, tested in test/selfUpdate.test.js. */
  function pickLatest(releases, includePrerelease) {
    let best = null;
    let bestVersion = null;
    for (const rel of (Array.isArray(releases) ? releases : [])) {
      if (!rel || rel.draft) continue;
      if (rel.prerelease && !includePrerelease) continue;
      const v = parseVersionTag(rel.tag_name);
      if (!v) continue;
      if (!bestVersion || compareVersions(v, bestVersion) > 0) { best = rel; bestVersion = v; }
    }
    return best;
  }

  async function doCheck() {
    if (!opts.fetchImpl) throw new Error("fetch unavailable (Node >= 18 required)");
    const base = opts.apiBase.replace(/\/$/, "");
    const preview = channel() === "preview";
    const url = preview
      ? `${base}/repos/${opts.repo}/releases?per_page=30`
      : `${base}/repos/${opts.repo}/releases/latest`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    let res;
    try {
      res = await opts.fetchImpl(url, {
        signal: ctrl.signal,
        headers: {
          // GitHub exige un User-Agent identifiable / GitHub requires an
          // identifiable User-Agent
          "User-Agent": "PiBoard/" + opts.currentVersion,
          "Accept": "application/vnd.github+json"
        }
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) {
      // Aucune release publiee (que des brouillons, ou depot sans release)
      // No published release (drafts only, or repo without any release)
      throw new Error("no-release");
    }
    if (!res.ok) throw new Error("GitHub HTTP " + res.status);
    const body = await res.json();
    const rel = preview ? pickLatest(body, true) : body;
    // En canal "preview", un depot dont toutes les releases sont des
    // brouillons renvoie une liste vide plutot qu'un 404 : meme cause,
    // meme message qu'au-dessus.
    // On the "preview" channel, a repo whose releases are all drafts
    // returns an empty list rather than a 404: same cause, same message
    // as above.
    if (!rel) throw new Error("no-release");
    const version = parseVersionTag(rel && rel.tag_name);
    if (!version) throw new Error("unrecognized tag: " + (rel && rel.tag_name));
    info.latestVersion = version;
    info.tag = rel.tag_name;
    info.publishedAt = rel.published_at || null;
    info.notes = typeof rel.body === "string" && rel.body.trim() ? rel.body.trim() : null;
    info.htmlUrl = rel.html_url || null;
    // Signale a l'interface qu'il s'agit d'une pre-release : la fenetre
    // de confirmation le dit clairement avant d'installer.
    // Tells the interface this is a pre-release: the confirmation window
    // says so plainly before installing.
    info.prerelease = !!rel.prerelease;
    info.tarballUrl = rel.tarball_url
      || `https://github.com/${opts.repo}/archive/refs/tags/${encodeURIComponent(rel.tag_name)}.tar.gz`;
  }

  function check() {
    if (checkPromise) return checkPromise;
    checkPromise = (async () => {
      try {
        await doCheck();
        info.error = null;
      } catch (e) {
        info.error = String((e && e.message) || e);
        if (opts.log && typeof opts.log.warn === "function") {
          opts.log.warn("[piboard] update check: " + info.error);
        }
      } finally {
        info.checkedAt = new Date().toISOString();
        checkPromise = null;
        emit();
      }
      return status();
    })();
    return checkPromise;
  }

  /* ---------- Telechargement / download ---------- */

  async function download(url, dest) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await opts.fetchImpl(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": "PiBoard/" + opts.currentVersion, "Accept": "application/octet-stream" }
      });
      if (!res.ok || !res.body) throw new Error("download HTTP " + res.status);
      const total = Number(res.headers.get("content-length")) || null;
      let bytes = 0;
      let lastEmit = 0;
      const counter = new Transform({
        transform(chunk, enc, cb) {
          bytes += chunk.length;
          const now = Date.now();
          if (now - lastEmit > 300) { lastEmit = now; job.progress = { bytes, total }; emit(); }
          cb(null, chunk);
        }
      });
      const body = typeof res.body.pipe === "function" ? res.body : Readable.fromWeb(res.body);
      await pipeline(body, counter, fs.createWriteStream(dest));
      job.progress = { bytes, total: total || bytes };
      emit();
      return bytes;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Installation ---------- */

  function npmSpec() {
    if (opts.npmCommand) return opts.npmCommand;
    return ["npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--no-progress", "--loglevel=error"]];
  }

  async function runNpm() {
    const [cmd, args] = npmSpec();
    const env = Object.assign({}, process.env);
    // Sous systemd, HOME peut manquer : npm en a besoin pour son cache.
    // Under systemd, HOME can be missing: npm needs it for its cache.
    if (!env.HOME) { try { env.HOME = os.homedir(); } catch (e) { /* inconnu / unknown */ } }
    return runCommand(cmd, args, { cwd: opts.appDir, env, timeoutMs: NPM_TIMEOUT_MS, onLine: logLine });
  }

  async function doApply() {
    const version = info.latestVersion;
    job.version = version;
    job.startedAt = new Date().toISOString();
    job.finishedAt = null;
    job.error = null;
    job.rolledBack = false;
    job.progress = null;
    job.log = [];

    fs.mkdirSync(updatesDir, { recursive: true });
    rmrf(stagingDir);
    fs.mkdirSync(stagingDir, { recursive: true });
    const archive = path.join(updatesDir, `piboard-${version}.tar.gz`);
    rmrf(archive);

    // 1. Telechargement / download
    setPhase("downloading");
    logLine(`Telechargement de / downloading ${info.tag} (${info.tarballUrl})`);
    const bytes = await download(info.tarballUrl, archive);
    logLine(`Archive recue / archive received: ${(bytes / 1048576).toFixed(2)} Mo`);

    // 2. Extraction. --strip-components=1 retire le dossier racine
    //    "<owner>-<repo>-<sha>/" que GitHub met dans ses archives.
    //    --strip-components=1 removes the "<owner>-<repo>-<sha>/" root
    //    folder GitHub puts in its archives.
    setPhase("extracting");
    logLine("Extraction / extracting…");
    const tar = await runCommand(opts.tarCommand, ["-xzf", archive, "-C", stagingDir, "--strip-components=1"],
      { cwd: updatesDir, timeoutMs: 10 * 60 * 1000, onLine: logLine });
    if (tar.code !== 0) {
      throw new Error("tar failed" + (tar.error ? ": " + tar.error.message : " (code " + tar.code + ")"));
    }
    const pkg = readJsonOrNull(path.join(stagingDir, "package.json"));
    if (!pkg || !pkg.version || !fs.existsSync(path.join(stagingDir, "server", "index.js"))) {
      throw new Error("archive invalide / invalid archive (package.json or server/index.js missing)");
    }
    if (compareVersions(pkg.version, version) !== 0) {
      throw new Error(`version inattendue dans l'archive / unexpected archive version: ${pkg.version} (attendu / expected ${version})`);
    }

    // 3. Remplacement / swap
    setPhase("installing");
    const oldLock = readTextOrNull(path.join(opts.appDir, "package-lock.json"));
    const newLock = readTextOrNull(path.join(stagingDir, "package-lock.json"));
    const manifest = readJsonOrNull(manifestPath);
    logLine("Remplacement des fichiers / replacing files…");
    const swapped = swapTree(opts.appDir, stagingDir, previousDir, manifest);
    logLine(`${swapped.installed.length} entrees installees, ${swapped.moved.length} ecartees dans previous/ / entries installed, parked`);
    rmrf(stagingDir);

    // 4. Dependances, seulement si le verrou a change / dependencies,
    //    only if the lock file changed
    const nodeModulesOk = fs.existsSync(path.join(opts.appDir, "node_modules"));
    const depsChanged = !nodeModulesOk || oldLock == null || newLock == null || oldLock !== newLock;
    if (depsChanged) {
      logLine("Dependances modifiees : npm install --omit=dev / dependencies changed: running npm install");
      const npm = await runNpm();
      if (npm.code !== 0) {
        const why = npm.error
          ? (npm.error.code === "ENOENT" ? "npm introuvable / npm not found (sudo apt install npm)" : npm.error.message)
          : "npm install a echoue / failed (code " + npm.code + ")";
        logLine("Echec : retour a la version precedente / failure: restoring previous version");
        rollbackTree(opts.appDir, previousDir, swapped.installed);
        job.rolledBack = true;
        throw new Error(why);
      }
    } else {
      logLine("Dependances inchangees : npm ignore / dependencies unchanged: npm skipped");
    }

    // 5. Verification minimale du point d'entree / minimal entry-point check
    const check = await runCommand(process.execPath, ["--check", path.join(opts.appDir, "server", "index.js")],
      { cwd: opts.appDir, timeoutMs: 60000, onLine: logLine });
    if (check.code !== 0) {
      logLine("Point d'entree invalide : retour a la version precedente / invalid entry point: restoring previous version");
      rollbackTree(opts.appDir, previousDir, swapped.installed);
      job.rolledBack = true;
      throw new Error("server/index.js failed `node --check`");
    }

    fs.writeFileSync(manifestPath, JSON.stringify({
      version,
      installedAt: new Date().toISOString(),
      previousVersion: opts.currentVersion,
      entries: swapped.installed
    }, null, 2));
    rmrf(archive);

    // 6. Redemarrage / restart
    setPhase("restarting");
    logLine(`PiBoard ${version} installe. Redemarrage du serveur / installed. Restarting the server…`);
    job.finishedAt = new Date().toISOString();
    emit();
    // Petit delai : laisser partir la reponse HTTP / le dernier evenement
    // SSE avant de couper. Short delay: let the HTTP response / last SSE
    // event go out before cutting.
    setTimeout(() => {
      const r = opts.restart(version);
      if (!r || !r.ok) {
        setPhase("error", { error: "restart: " + ((r && r.reason) || "unknown"), finishedAt: new Date().toISOString() });
      }
    }, 800);
  }

  function apply() {
    if (!support().supported) {
      return { ok: false, reason: "not-supported", status: status() };
    }
    if (isBusy()) return { ok: false, reason: "busy", status: status() };
    if (!available()) return { ok: false, reason: "no-update", status: status() };

    doApply().catch((e) => {
      const msg = String((e && e.message) || e);
      logLine("ERREUR / ERROR: " + msg);
      setPhase("error", { error: msg, finishedAt: new Date().toISOString() });
    });
    return { ok: true, status: status() };
  }

  /* ---------- Verification periodique / periodic check ---------- */

  function startAutoCheck() {
    stopAutoCheck();
    if (!support().supported) return;
    if (opts.checkIntervalMs <= 0) return;
    timers.push(setTimeout(() => { check(); }, opts.startupDelayMs));
    const iv = setInterval(() => { if (!isBusy()) check(); }, opts.checkIntervalMs);
    if (typeof iv.unref === "function") iv.unref();
    timers.push(iv);
  }

  function stopAutoCheck() {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
  }

  return { status, check, apply, startAutoCheck, stopAutoCheck, _pickLatest: pickLatest, paths: { updatesDir, stagingDir, previousDir, manifestPath } };
}

module.exports = {
  createUpdater,
  compareVersions,
  parseVersionTag,
  // Exposes pour les tests / exposed for tests
  _swapTree: swapTree,
  _rollbackTree: rollbackTree,
  _PRESERVED: PRESERVED
};
