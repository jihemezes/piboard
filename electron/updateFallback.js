/* PiBoard - repli de mise a jour (1.179.0)
   ---------------------------------------
   Les trois plateformes partagent une meme release GitHub, mais leurs
   paquets n'y arrivent pas en meme temps : Windows est publie en
   premier, macOS une dizaine de minutes plus tard (construction GitHub
   Actions). Pendant ce temps, electron-updater voit la nouvelle release
   comme « la plus recente », n'y trouve pas le fichier de version du
   systeme (latest-mac.yml…) et echoue.

   Ici, on cherche la release LA PLUS RECENTE QUI CONTIENT DEJA le fichier
   de ce systeme et qui reste plus recente que la version installee : si
   elle existe, elle est proposee a la place. Fonctions pures (testees
   hors Electron) + lecture de la liste des releases par l'API publique.

   Update fallback: while the newest release still lacks this system's
   package, offer the newest release that already has it (and is newer
   than the installed version). */
"use strict";

const API = "https://api.github.com/repos/jihemezes/piboard/releases?per_page=15";
const DOWNLOAD = "https://github.com/jihemezes/piboard/releases/download/";

/* Fichier de version qu'electron-updater lit pour ce systeme. */
function ymlName(platformId, arch) {
  if (platformId === "darwin") return "latest-mac.yml";
  if (platformId === "win32") return "latest.yml";
  return arch === "arm64" ? "latest-linux-arm64.yml" : "latest-linux.yml";
}

function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v || "").trim());
  return m ? { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || null } : null;
}

function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre && !y.pre) return -1;
  if (!x.pre && y.pre) return 1;
  return String(x.pre || "").localeCompare(String(y.pre || ""));
}

/* La release a proposer, ou null. */
function pickFallbackRelease(releases, currentVersion, yml, allowPrerelease) {
  const ok = (Array.isArray(releases) ? releases : [])
    .filter((r) => r && !r.draft && (allowPrerelease || !r.prerelease))
    .filter((r) => Array.isArray(r.assets) && r.assets.some((a) => a && a.name === yml && (!a.state || a.state === "uploaded")))
    .filter((r) => compareVersions(r.tag_name, currentVersion) > 0)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  return ok.length ? { tag: ok[0].tag_name, version: String(ok[0].tag_name).replace(/^v/, ""), url: DOWNLOAD + ok[0].tag_name } : null;
}

async function findFallback(opts) {
  const o = opts || {};
  const f = o.fetch || fetch;
  const res = await f(API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "PiBoard-updater" } });
  if (!res.ok) throw new Error("GitHub API HTTP " + res.status);
  const list = await res.json();
  return pickFallbackRelease(list, o.currentVersion, o.yml, !!o.allowPrerelease);
}

module.exports = { ymlName, parseVersion, compareVersions, pickFallbackRelease, findFallback, API, DOWNLOAD };
