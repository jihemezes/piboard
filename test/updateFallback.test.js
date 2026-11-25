/* Repli de mise a jour (1.179.0) : quand le paquet de la toute derniere
   release manque encore pour ce systeme, l'application propose la release
   la plus recente qui le contient deja. */
"use strict";
const assert = require("assert");
const f = require("../electron/updateFallback");

const asset = (name) => ({ name, state: "uploaded" });
const rel = (tag, names, o) => Object.assign({ tag_name: tag, draft: false, prerelease: false, assets: names.map(asset) }, o || {});
const releases = [
  rel("v1.178.0", ["latest.yml", "latest-linux.yml", "latest-linux-arm64.yml"]),          // Mac encore en construction
  rel("v1.177.0", ["latest.yml", "latest-linux.yml", "latest-linux-arm64.yml", "latest-mac.yml"]),
  rel("v1.176.0", ["latest.yml", "latest-mac.yml"]),
  rel("v1.179.0-beta.1", ["latest-mac.yml"], { prerelease: true }),
  rel("v1.180.0", ["latest-mac.yml"], { draft: true })
];

(async () => {
  assert.strictEqual(f.ymlName("darwin", "arm64"), "latest-mac.yml");
  assert.strictEqual(f.ymlName("win32", "x64"), "latest.yml");
  assert.strictEqual(f.ymlName("linux", "arm64"), "latest-linux-arm64.yml");
  assert.strictEqual(f.ymlName("linux", "x64"), "latest-linux.yml");
  assert.ok(f.compareVersions("1.178.0", "1.177.9") > 0 && f.compareVersions("v1.9.0", "1.10.0") < 0);
  assert.ok(f.compareVersions("1.179.0-beta.1", "1.179.0") < 0, "une pre-version precede la version finale");

  let r = f.pickFallbackRelease(releases, "1.176.0", "latest-mac.yml", false);
  assert.deepStrictEqual(r, { tag: "v1.177.0", version: "1.177.0", url: "https://github.com/jihemezes/piboard/releases/download/v1.177.0" },
    "Mac en 1.176.0, 1.178.0 sans paquet Mac : la 1.177.0 est proposee");
  assert.strictEqual(f.pickFallbackRelease(releases, "1.177.0", "latest-mac.yml", false), null, "deja en 1.177.0 : rien de plus recent avec paquet Mac");
  r = f.pickFallbackRelease(releases, "1.177.0", "latest-mac.yml", true);
  assert.strictEqual(r.tag, "v1.179.0-beta.1", "canal pre-versions : la beta compte");
  assert.strictEqual(f.pickFallbackRelease(releases, "1.170.0", "latest-linux-arm64.yml", false).tag, "v1.178.0", "Pi : la 1.178.0 a deja son paquet");
  assert.strictEqual(f.pickFallbackRelease([rel("v1.181.0", ["latest-mac.yml"], { assets: [{ name: "latest-mac.yml", state: "starter" }] })], "1.170.0", "latest-mac.yml", false), null,
    "fichier en cours de televersement : ignore");

  let seen = null;
  const fake = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => releases }; };
  r = await f.findFallback({ fetch: fake, currentVersion: "1.176.0", yml: "latest-mac.yml" });
  assert.strictEqual(r.tag, "v1.177.0");
  assert.ok(/api\.github\.com\/repos\/jihemezes\/piboard\/releases/.test(seen.url));
  await assert.rejects(f.findFallback({ fetch: async () => ({ ok: false, status: 403 }), currentVersion: "1", yml: "x" }), /403/);

  // Le module de mise a jour s'appuie bien sur le repli et remet la source GitHub avant chaque verification.
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "electron", "updater.js"), "utf8");
  assert.ok(/tryFallback\(\)/.test(src) && /useGithubFeed\(\);\s*\n\s*autoUpdater\.checkForUpdates/.test(src), "repli branche dans updater.js");
  console.log("updateFallback : tous les tests OK");
})().catch((e) => { console.error(e); process.exit(1); });
