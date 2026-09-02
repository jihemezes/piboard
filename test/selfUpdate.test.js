/* PiBoard - test/selfUpdate.test.js
   Cycle complet de mise a jour automatique (server/selfUpdate.js) joue
   contre un FAUX GitHub (serveur HTTP local qui repond a
   /repos/.../releases/latest et sert une archive tar.gz fabriquee ici),
   un FAUX npm (script Node qui reussit ou echoue a la demande) et un
   faux dossier d'application dans un repertoire temporaire. Aucun acces
   a GitHub, aucun npm reel, aucun processus redemarre : le crochet de
   redemarrage est remplace par un espion.

   Ce qui est verifie, dans l'ordre du cycle :
     - comparaison de versions et lecture des tags ;
     - detection d'une nouvelle version, d'une version identique, d'une
       absence de release (404) ;
     - installation : nouveaux fichiers en place, fichiers supprimes
       reellement retires, data/ et node_modules/ intacts, ancienne
       version rangee dans previous/, manifeste ecrit ;
     - npm ignore quand package-lock.json est inchange, appele sinon ;
     - retour arriere automatique si npm echoue ;
     - archive dont la version ne correspond pas au tag : rien n'est
       touche ;
     - entree installee par une mise a jour precedente et absente de la
       suivante : retiree grace au manifeste.

   Full self-update cycle (server/selfUpdate.js) played against a FAKE
   GitHub (local HTTP server answering /repos/.../releases/latest and
   serving a tar.gz archive built here), a FAKE npm (Node script that
   succeeds or fails on demand) and a fake application folder in a temp
   directory. No GitHub access, no real npm, no restarted process: the
   restart hook is replaced by a spy. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const su = require("../server/selfUpdate");

let ok = 0;
function check(label, cond) {
  if (!cond) { console.error("  FAIL " + label); process.exitCode = 1; }
  else { console.log("  OK   " + label); ok++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------- Versions ---------- */
console.log("== versions : tags et comparaison ==");
{
  check("v1.81.0 -> 1.81.0", su.parseVersionTag("v1.81.0") === "1.81.0");
  check("1.81.0 sans v accepte", su.parseVersionTag("1.81.0") === "1.81.0");
  check("suffixe ignore", su.parseVersionTag("v2.0.0-rc1") === "2.0.0");
  check("tag non versionne -> null", su.parseVersionTag("nightly") === null);
  check("vide -> null", su.parseVersionTag("") === null && su.parseVersionTag(null) === null);
  check("1.81.0 > 1.80.1", su.compareVersions("1.81.0", "1.80.1") === 1);
  check("1.80.10 > 1.80.9 (numerique, pas lexical)", su.compareVersions("1.80.10", "1.80.9") === 1);
  check("2.0.0 > 1.99.99", su.compareVersions("2.0.0", "1.99.99") === 1);
  check("egalite", su.compareVersions("1.80.1", "1.80.1") === 0);
  check("inferieur", su.compareVersions("1.79.0", "1.80.1") === -1);
}

/* ---------- Faux GitHub / fake GitHub ---------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-update-"));
const REPO = "test/piboard";
let release = null;       // reponse de /releases/latest (null -> 404)
let archivePath = null;   // tar.gz servi par /tarball
const server = http.createServer((req, res) => {
  if (req.url === `/repos/${REPO}/releases/latest`) {
    if (!release) { res.writeHead(404); return res.end("{}"); }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(release));
  }
  if (req.url === "/tarball") {
    const data = fs.readFileSync(archivePath);
    res.writeHead(200, { "Content-Type": "application/gzip", "Content-Length": data.length });
    return res.end(data);
  }
  res.writeHead(404); res.end();
});

/* Construit une archive tar.gz au format GitHub (un dossier racine
   "<owner>-<repo>-<sha>/" contenant les sources).
   Builds a GitHub-style tar.gz (a "<owner>-<repo>-<sha>/" root folder
   holding the sources). */
function buildArchive(version, files) {
  const root = path.join(TMP, "build-" + version);
  fs.rmSync(root, { recursive: true, force: true });
  const inner = path.join(root, "test-piboard-abc123");
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(inner, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  const out = path.join(TMP, `archive-${version}.tar.gz`);
  execFileSync("tar", ["-czf", out, "-C", root, "test-piboard-abc123"]);
  return out;
}

/* Faux npm : script Node qui ecrit une trace puis sort avec le code
   demande via la variable FAKE_NPM_EXIT.
   Fake npm: Node script that writes a trace then exits with the code
   requested through FAKE_NPM_EXIT. */
const fakeNpm = path.join(TMP, "fake-npm.js");
fs.writeFileSync(fakeNpm, `
  const fs = require("fs");
  fs.appendFileSync(process.env.FAKE_NPM_TRACE, process.cwd() + "\\n");
  console.log("fake npm ran");
  process.exit(Number(process.env.FAKE_NPM_EXIT || 0));
`);
const npmTrace = path.join(TMP, "npm-trace.txt");
function npmCalls() { try { return fs.readFileSync(npmTrace, "utf8").trim().split("\n").filter(Boolean); } catch (e) { return []; } }
function resetNpm(exitCode) {
  fs.rmSync(npmTrace, { force: true });
  process.env.FAKE_NPM_TRACE = npmTrace;
  process.env.FAKE_NPM_EXIT = String(exitCode || 0);
}

function makeAppDir(name, lock) {
  const appDir = path.join(TMP, name);
  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(appDir, "server"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "public"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "data"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "node_modules", "express"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "server", "index.js"), "// old index\n");
  fs.writeFileSync(path.join(appDir, "server", "stale.js"), "// removed upstream\n");
  fs.writeFileSync(path.join(appDir, "public", "app.js"), "// old app\n");
  fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({ name: "piboard", version: "1.0.0" }));
  fs.writeFileSync(path.join(appDir, "package-lock.json"), lock);
  fs.writeFileSync(path.join(appDir, "data", "settings.json"), '{"lang":"fr"}');
  fs.writeFileSync(path.join(appDir, "node_modules", "express", "index.js"), "// dep\n");
  fs.writeFileSync(path.join(appDir, "LOCAL-NOTES.txt"), "user file, not part of the project\n");
  return appDir;
}

function newVersionFiles(version, lock, extra) {
  return Object.assign({
    "package.json": JSON.stringify({ name: "piboard", version }),
    "package-lock.json": lock,
    "server/index.js": "// new index " + version + "\n",
    "public/app.js": "// new app " + version + "\n",
    "CHANGELOG.md": "# " + version + "\n"
  }, extra || {});
}

async function waitJob(updater, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  while (Date.now() < deadline) {
    const st = updater.status();
    if (["done", "error", "restarting", "idle"].includes(st.job.phase) && !st.busy) return st;
    if (st.job.phase === "restarting") return st;
    await sleep(50);
  }
  return updater.status();
}

/* Attend que le crochet de redemarrage ait ete appele (800 ms apres
   la phase "restarting") ou que le job soit en erreur.
   Waits for the restart hook to have fired (800 ms after "restarting")
   or the job to be in error. */
async function waitRestart(updater, spy, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  while (Date.now() < deadline) {
    if (spy.calls.length || updater.status().job.phase === "error") return updater.status();
    await sleep(50);
  }
  return updater.status();
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const LOCK_A = '{"lockfileVersion":3,"deps":"A"}';
  const LOCK_B = '{"lockfileVersion":3,"deps":"B"}';

  function makeUpdater(appDir, currentVersion, spy, extra) {
    return su.createUpdater(Object.assign({
      appDir,
      currentVersion,
      repo: REPO,
      apiBase: base,
      support: { supported: true },
      restart: (v) => { spy.calls.push(v); return { ok: true }; },
      npmCommand: [process.execPath, [fakeNpm]],
      log: { log() {}, warn() {} },
      checkIntervalMs: 0
    }, extra || {}));
  }

  console.log("== verification : nouvelle version, version identique, aucune release ==");
  {
    const appDir = makeAppDir("app-check", LOCK_A);
    const spy = { calls: [] };
    const u = makeUpdater(appDir, "1.0.0", spy);
    release = { tag_name: "v1.1.0", published_at: "2026-09-01T10:00:00Z", body: "Notes de la 1.1.0", html_url: "https://example.test/rel", tarball_url: base + "/tarball" };
    let st = await u.check();
    check("nouvelle version detectee", st.available === true && st.latestVersion === "1.1.0");
    check("notes et date de publication transmises", st.notes === "Notes de la 1.1.0" && st.publishedAt === "2026-09-01T10:00:00Z");
    check("horodatage de verification", typeof st.checkedAt === "string");
    check("aucune erreur", st.checkError === null);

    const u2 = makeUpdater(appDir, "1.1.0", spy);
    st = await u2.check();
    check("version identique -> pas de mise a jour", st.available === false && st.latestVersion === "1.1.0");
    const u3 = makeUpdater(appDir, "1.2.0", spy);
    st = await u3.check();
    check("version installee plus recente -> pas de mise a jour", st.available === false);
    check("installer sans mise a jour disponible est refuse", u3.apply().reason === "no-update");

    release = null;
    st = await u.check();
    check("404 -> erreur 'no-release', l'ancienne info reste affichee", st.checkError === "no-release" && st.latestVersion === "1.1.0");

    release = { tag_name: "nightly", tarball_url: base + "/tarball" };
    st = await u.check();
    check("tag non versionne -> erreur explicite", /unrecognized tag/.test(st.checkError || ""));

    const noSup = makeUpdater(appDir, "1.0.0", spy, { support: { supported: false, reason: "electron-updater" } });
    release = { tag_name: "v1.1.0", tarball_url: base + "/tarball" };
    await noSup.check();
    check("plateforme non supportee : statut explicite et installation refusee",
      noSup.status().supported === false && noSup.status().reason === "electron-updater" && noSup.apply().reason === "not-supported");
    check("support fourni sous forme de fonction (evalue a la demande)",
      makeUpdater(appDir, "1.0.0", spy, { support: () => ({ supported: true }) }).status().supported === true);
  }

  console.log("== installation : verrou inchange -> npm ignore, fichiers remplaces, data/ intact ==");
  {
    const appDir = makeAppDir("app-install", LOCK_A);
    const spy = { calls: [] };
    resetNpm(0);
    archivePath = buildArchive("1.1.0", newVersionFiles("1.1.0", LOCK_A));
    release = { tag_name: "v1.1.0", tarball_url: base + "/tarball" };
    const u = makeUpdater(appDir, "1.0.0", spy);
    await u.check();
    const r = u.apply();
    check("installation acceptee", r.ok === true);
    check("second appel pendant l'installation refuse (busy)", u.apply().reason === "busy");
    const st = await waitRestart(u, spy);
    check("phase finale 'restarting'", st.job.phase === "restarting");
    check("aucune erreur", st.job.error === null);
    check("crochet de redemarrage appele avec la version", spy.calls.length === 1 && spy.calls[0] === "1.1.0");
    check("server/index.js remplace", fs.readFileSync(path.join(appDir, "server", "index.js"), "utf8").includes("new index 1.1.0"));
    check("public/app.js remplace", fs.readFileSync(path.join(appDir, "public", "app.js"), "utf8").includes("new app 1.1.0"));
    check("fichier supprime en amont reellement retire (server/stale.js)", !fs.existsSync(path.join(appDir, "server", "stale.js")));
    check("nouveau fichier de premier niveau ajoute (CHANGELOG.md)", fs.existsSync(path.join(appDir, "CHANGELOG.md")));
    check("package.json a la nouvelle version", JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")).version === "1.1.0");
    check("data/settings.json intact", fs.readFileSync(path.join(appDir, "data", "settings.json"), "utf8") === '{"lang":"fr"}');
    check("node_modules/ intact", fs.existsSync(path.join(appDir, "node_modules", "express", "index.js")));
    check("fichier local etranger au projet conserve", fs.existsSync(path.join(appDir, "LOCAL-NOTES.txt")));
    check("npm NON appele (package-lock.json identique)", npmCalls().length === 0);
    check("ancienne version rangee dans data/updates/previous/",
      fs.readFileSync(path.join(u.paths.previousDir, "server", "index.js"), "utf8") === "// old index\n");
    const manifest = JSON.parse(fs.readFileSync(u.paths.manifestPath, "utf8"));
    check("manifeste ecrit (version + entrees installees)",
      manifest.version === "1.1.0" && manifest.entries.includes("server") && manifest.entries.includes("CHANGELOG.md"));
    check("dossier de travail et archive nettoyes",
      !fs.existsSync(u.paths.stagingDir) && !fs.existsSync(path.join(u.paths.updatesDir, "piboard-1.1.0.tar.gz")));
    check("journal de l'installation renseigne", st.job.log.some((l) => /npm ignore|npm skipped/.test(l)));
    check("progression du telechargement rapportee", st.job.progress && st.job.progress.bytes > 0);
  }

  console.log("== installation : verrou modifie -> npm appele dans le dossier de l'application ==");
  {
    const appDir = makeAppDir("app-npm", LOCK_A);
    const spy = { calls: [] };
    resetNpm(0);
    archivePath = buildArchive("1.2.0", newVersionFiles("1.2.0", LOCK_B));
    release = { tag_name: "v1.2.0", tarball_url: base + "/tarball" };
    const u = makeUpdater(appDir, "1.0.0", spy);
    await u.check();
    u.apply();
    const st = await waitRestart(u, spy);
    check("installation terminee", st.job.phase === "restarting" && spy.calls.length === 1);
    const calls = npmCalls();
    check("npm appele une fois, dans le dossier de l'application", calls.length === 1 && fs.realpathSync(calls[0]) === fs.realpathSync(appDir));
    check("sortie de npm reprise dans le journal", st.job.log.includes("fake npm ran"));
  }

  console.log("== echec de npm -> retour arriere automatique, pas de redemarrage ==");
  {
    const appDir = makeAppDir("app-rollback", LOCK_A);
    const spy = { calls: [] };
    resetNpm(1);
    archivePath = buildArchive("1.3.0", newVersionFiles("1.3.0", LOCK_B));
    release = { tag_name: "v1.3.0", tarball_url: base + "/tarball" };
    const u = makeUpdater(appDir, "1.0.0", spy);
    await u.check();
    u.apply();
    const st = await waitRestart(u, spy);
    check("phase 'error'", st.job.phase === "error");
    check("retour arriere signale", st.job.rolledBack === true);
    check("erreur explicite", /npm/.test(st.job.error || ""));
    check("redemarrage NON declenche", spy.calls.length === 0);
    check("server/index.js d'origine restaure", fs.readFileSync(path.join(appDir, "server", "index.js"), "utf8") === "// old index\n");
    check("server/stale.js restaure", fs.existsSync(path.join(appDir, "server", "stale.js")));
    check("package.json d'origine restaure", JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")).version === "1.0.0");
    check("CHANGELOG.md de la version echouee retire", !fs.existsSync(path.join(appDir, "CHANGELOG.md")));
    check("data/ toujours intact", fs.readFileSync(path.join(appDir, "data", "settings.json"), "utf8") === '{"lang":"fr"}');
    check("manifeste NON ecrit apres un echec", !fs.existsSync(u.paths.manifestPath));
    check("une nouvelle tentative reste possible (plus 'busy')", st.busy === false && u.status().available === true);
  }

  console.log("== archive dont la version ne correspond pas au tag -> rien n'est touche ==");
  {
    const appDir = makeAppDir("app-mismatch", LOCK_A);
    const spy = { calls: [] };
    resetNpm(0);
    archivePath = buildArchive("9.9.9", newVersionFiles("9.9.9", LOCK_A));
    release = { tag_name: "v1.4.0", tarball_url: base + "/tarball" };
    const u = makeUpdater(appDir, "1.0.0", spy);
    await u.check();
    u.apply();
    const st = await waitRestart(u, spy);
    check("phase 'error' avec message de version", st.job.phase === "error" && /9\.9\.9/.test(st.job.error || ""));
    check("fichiers d'origine intacts", fs.readFileSync(path.join(appDir, "server", "index.js"), "utf8") === "// old index\n");
    check("pas de redemarrage", spy.calls.length === 0);
  }

  console.log("== archive invalide (sans server/index.js) -> refusee ==");
  {
    const appDir = makeAppDir("app-invalid", LOCK_A);
    const spy = { calls: [] };
    archivePath = buildArchive("1.5.0", { "package.json": JSON.stringify({ version: "1.5.0" }), "README.md": "x" });
    release = { tag_name: "v1.5.0", tarball_url: base + "/tarball" };
    const u = makeUpdater(appDir, "1.0.0", spy);
    await u.check();
    u.apply();
    const st = await waitRestart(u, spy);
    check("erreur 'archive invalide'", st.job.phase === "error" && /invalid archive/.test(st.job.error || ""));
    check("fichiers d'origine intacts", fs.readFileSync(path.join(appDir, "server", "index.js"), "utf8") === "// old index\n");
  }

  console.log("== seconde mise a jour : une entree de la precedente, absente de la nouvelle, est retiree (manifeste) ==");
  {
    const appDir = makeAppDir("app-manifest", LOCK_A);
    const spy = { calls: [] };
    resetNpm(0);
    // 1re mise a jour : ajoute un dossier docs/ (nouveau) et install/
    // 1st update: adds a docs/ folder (new) and install/
    archivePath = buildArchive("1.1.0", newVersionFiles("1.1.0", LOCK_A, { "docs/EXTRA.md": "extra", "install/x.sh": "#!/bin/sh" }));
    release = { tag_name: "v1.1.0", tarball_url: base + "/tarball" };
    let u = makeUpdater(appDir, "1.0.0", spy);
    await u.check(); u.apply();
    await waitRestart(u, spy);
    check("1re mise a jour : docs/ installe", fs.existsSync(path.join(appDir, "docs", "EXTRA.md")));
    // 2e mise a jour : docs/ n'existe plus en amont
    // 2nd update: docs/ no longer exists upstream
    spy.calls.length = 0;
    archivePath = buildArchive("1.2.0", newVersionFiles("1.2.0", LOCK_A, { "install/x.sh": "#!/bin/sh v2" }));
    release = { tag_name: "v1.2.0", tarball_url: base + "/tarball" };
    u = makeUpdater(appDir, "1.1.0", spy);
    await u.check(); u.apply();
    const st = await waitRestart(u, spy);
    check("2e mise a jour terminee", st.job.phase === "restarting");
    check("docs/ retire (il venait de la mise a jour precedente)", !fs.existsSync(path.join(appDir, "docs")));
    check("docs/ conserve dans previous/ pour retour arriere", fs.existsSync(path.join(u.paths.previousDir, "docs", "EXTRA.md")));
    check("install/ mis a jour", fs.readFileSync(path.join(appDir, "install", "x.sh"), "utf8").includes("v2"));
    check("fichier local etranger toujours conserve", fs.existsSync(path.join(appDir, "LOCAL-NOTES.txt")));
    const manifest = JSON.parse(fs.readFileSync(u.paths.manifestPath, "utf8"));
    check("manifeste mis a jour (1.2.0, sans docs)", manifest.version === "1.2.0" && !manifest.entries.includes("docs") && manifest.previousVersion === "1.1.0");
  }

  console.log("== entrees preservees ==");
  {
    for (const n of ["data", "node_modules", ".git"]) check("'" + n + "' jamais remplace", su._PRESERVED.has(n));
  }

  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${ok} verifications OK${process.exitCode ? " -- ECHECS" : ""}`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
