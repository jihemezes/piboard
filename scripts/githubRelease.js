/* ============================================================
   PiBoard - scripts/githubRelease.js
   Preparation de la release GitHub AVANT toute construction.

   LE DEFAUT CORRIGE (1.110.3). Trois publieurs ecrivent dans la meme
   release : le PC (Windows) et deux jobs GitHub Actions (Linux, macOS).
   Jusqu'ici, chacun laissait electron-builder creer la release s'il ne
   la trouvait pas. Or electron-builder lance parfois PLUSIEURS
   publieurs dans le meme processus (le journal Windows de la 1.110.2
   montre deux fois « creating GitHub release ») : chacun liste les
   releases, n'en voit aucune, et en cree une. GitHub, pris dans la
   course, en a accepte DEUX pour le meme tag -- les fichiers se sont
   repartis entre elles, et l'installeur Windows s'est perdu.
   Pire, le controle ajoute en 1.108.2 (« une release existe deja : on
   s'arrete ») tournait aussi dans Actions : le second job arrivant
   trouvait la release du premier et abandonnait -- d'ou une release
   sans aucun fichier Linux.

   LA REGLE DESORMAIS :
     1. La release est creee UNE fois, avant de construire, par ce
        module (job `release` d'Actions, et le PC s'il arrive premier).
     2. Si deux creations se croisent malgre tout, on garde la plus
        ancienne (plus petit identifiant) et on supprime les autres,
        tant qu'elles sont vides.
     3. Une release existante n'est PLUS une erreur. Ce qui en est une,
        c'est qu'elle contienne deja les fichiers de LA plateforme que
        l'on s'apprete a publier.
   electron-builder trouve alors la release existante et n'y fait
   qu'ajouter ses fichiers.

   Les fonctions de decision sont pures ; les appels reseau passent par
   une fonction `request` injectee, pour des tests hors ligne.

   Preparing the GitHub release BEFORE any build. Three publishers write
   into one release (the PC for Windows, two Actions jobs for Linux and
   macOS). electron-builder may run several publishers in one process,
   each creating the release when it sees none: GitHub accepted TWO
   releases for 1.110.2 and the Windows installer got lost. The 1.108.2
   pre-flight check also ran in Actions and made the second job give up,
   leaving no Linux files. Now: the release is created once, up front;
   duplicates from a crossed creation are removed (oldest kept); an
   existing release is fine unless it already holds THIS platform's
   files.
   ============================================================ */

"use strict";

const REPO = "jihemezes/piboard";

/* Plateformes demandees d'apres les arguments passes a publish.js.
   Platforms requested, from the arguments given to publish.js. */
function platformsOf(args) {
  const a = Array.isArray(args) ? args : [];
  const out = [];
  if (a.includes("--win") || a.includes("-w")) out.push("win");
  if (a.includes("--linux") || a.includes("-l")) out.push("linux");
  if (a.includes("--mac") || a.includes("-m")) out.push("mac");
  return out;
}

/* Fichiers qui appartiennent a une plateforme. Les .blockmap seuls ne
   comptent pas : un envoi interrompu en laisse souvent un sans
   l'installeur, et ce reste ne doit pas bloquer une nouvelle
   tentative.
   Files belonging to a platform. Lone .blockmap files do not count: an
   interrupted upload often leaves one without the installer, and that
   leftover must not block a retry. */
const PLATFORM_ASSETS = {
  win: [/Setup-.*\.exe$/i, /^latest\.yml$/i],
  linux: [/-linux-.*\.(AppImage|deb)$/i, /^latest-linux.*\.yml$/i],
  mac: [/-mac-.*\.(dmg|zip)$/i, /^latest-mac\.yml$/i]
};

function platformAssets(release, platform) {
  const patterns = PLATFORM_ASSETS[platform] || [];
  return ((release && release.assets) || [])
    .map((a) => a.name)
    .filter((n) => patterns.some((p) => p.test(n)));
}

/* Releases d'un tag, la plus ancienne d'abord. Releases of a tag,
   oldest first. */
function releasesForTag(releases, tag) {
  return (Array.isArray(releases) ? releases : [])
    .filter((r) => r && r.tag_name === tag)
    .sort((a, b) => a.id - b.id);
}

/* Parmi plusieurs releases du meme tag : celle a garder et celles a
   supprimer. On ne supprime jamais une release qui porte un vrai
   fichier -- dans ce cas on s'arrete et on explique.
   Among several releases of one tag: which to keep, which to delete.
   A release holding a real file is never deleted -- then we stop and
   explain. */
function planDuplicates(list) {
  if (list.length <= 1) return { keep: list[0] || null, remove: [], blocked: [] };
  const [keep, ...others] = list;
  const remove = [];
  const blocked = [];
  for (const r of others) {
    const real = Object.keys(PLATFORM_ASSETS).some((p) => platformAssets(r, p).length);
    (real ? blocked : remove).push(r);
  }
  return { keep, remove, blocked };
}

function makeRequest(token, fetchImpl) {
  const f = fetchImpl || fetch;
  return async function request(method, url, body) {
    const headers = {
      "User-Agent": "PiBoard publish",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (token) headers.Authorization = "Bearer " + token;
    if (body) headers["Content-Type"] = "application/json";
    const res = await f("https://api.github.com" + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, ok: res.ok, data };
  };
}

async function listReleases(request) {
  // La liste (et non /releases/tags/) : elle seule montre les brouillons.
  // The list (not /releases/tags/): only it shows drafts.
  const r = await request("GET", `/repos/${REPO}/releases?per_page=100`);
  if (!r.ok) throw new Error("liste des releases / release list: HTTP " + r.status);
  return r.data || [];
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* Garantit une release unique pour le tag et verifie qu'elle ne
   contient pas deja les fichiers des plateformes a publier.
   Renvoie { release, created }. Leve une erreur explicite sinon.
   Ensures a single release for the tag and checks it does not already
   hold the files of the platforms being published. */
async function ensureRelease(opts) {
  const { request, tag, name, body, prerelease, platforms, log, wait } = opts;
  const say = log || (() => {});
  const pause = wait || sleep;

  let list = releasesForTag(await listReleases(request), tag);
  let created = false;

  if (!list.length) {
    const r = await request("POST", `/repos/${REPO}/releases`, {
      tag_name: tag, name, body: body || undefined, draft: false, prerelease: !!prerelease
    });
    if (r.ok) {
      created = true;
      say(`Release ${tag} creee / created (${prerelease ? "pre-release" : "latest"}).`);
    } else if (r.status !== 422) {
      throw new Error(`creation de la release ${tag} / creating release: HTTP ${r.status} ` + JSON.stringify(r.data));
    } else {
      say(`Release ${tag} creee entre-temps par un autre publieur / created meanwhile by another publisher.`);
    }
    // Laisser a une eventuelle creation concurrente le temps d'apparaitre.
    // Give a possible concurrent creation time to show up.
    await pause(4000);
    list = releasesForTag(await listReleases(request), tag);
  }

  const plan = planDuplicates(list);
  if (plan.blocked.length) {
    throw new Error(
      `Plusieurs releases portent le tag ${tag} et plusieurs contiennent des fichiers :\n` +
      list.map((r) => `  ${r.html_url}  (${(r.assets || []).length} fichier(s))`).join("\n") +
      `\nSupprime celles en trop sur GitHub, puis relance.\n` +
      `Several releases carry tag ${tag} and more than one holds files -- delete the extra ones, then retry.`
    );
  }
  for (const r of plan.remove) {
    const d = await request("DELETE", `/repos/${REPO}/releases/${r.id}`);
    say(`Doublon supprime / duplicate removed: release #${r.id}` + (d.ok ? "" : ` (echec HTTP ${d.status})`));
  }
  const release = plan.keep;
  if (!release) throw new Error(`release ${tag} introuvable apres creation / not found after creation`);

  for (const p of platforms || []) {
    const already = platformAssets(release, p);
    if (already.length) {
      throw new Error(
        `La release ${tag} contient deja les fichiers ${p} : ${already.join(", ")}\n  ${release.html_url}\n` +
        `Supprime-les sur GitHub (ou passe au numero de version suivant), puis relance.\n` +
        `Release ${tag} already holds the ${p} files -- delete them or bump the version, then retry.`
      );
    }
  }
  return { release, created };
}

/* Fichiers REQUIS par plateforme apres publication : l'installeur ET le
   fichier de version lu par electron-updater. Sans l'un ou l'autre, la
   mise a jour automatique est cassee pour cette plateforme.
   Files REQUIRED per platform after publishing: the installer AND the
   version file electron-updater reads. */
const REQUIRED_ASSETS = {
  win: [["installeur .exe", /Setup-.*\.exe$/i], ["latest.yml", /^latest\.yml$/i]],
  linux: [
    ["AppImage x64", /-linux-x86_64\.AppImage$/i], ["AppImage arm64", /-linux-arm64\.AppImage$/i],
    ["deb amd64", /-linux-amd64\.deb$/i], ["deb arm64", /-linux-arm64\.deb$/i],
    ["latest-linux.yml", /^latest-linux\.yml$/i], ["latest-linux-arm64.yml", /^latest-linux-arm64\.yml$/i]
  ],
  mac: [
    ["dmg x64", /-mac-x64\.dmg$/i], ["dmg arm64", /-mac-arm64\.dmg$/i],
    ["zip x64", /-mac-x64\.zip$/i], ["zip arm64", /-mac-arm64\.zip$/i],
    ["latest-mac.yml", /^latest-mac\.yml$/i]
  ]
};

function missingAssets(release, platform) {
  const names = ((release && release.assets) || []).map((a) => a.name);
  return (REQUIRED_ASSETS[platform] || [])
    .filter(([, re]) => !names.some((n) => re.test(n)))
    .map(([label]) => label);
}

/* Verification APRES publication, sur GitHub meme : electron-builder
   peut « sauter » l'envoi avec un simple avertissement et rendre la
   main sans erreur -- le job etait alors vert sans aucun fichier
   publie (1.110.2). Quelques essais espaces : la liste des fichiers
   d'une release met parfois quelques secondes a se mettre a jour.
   Post-publication check on GitHub itself: electron-builder may "skip"
   the upload with a mere warning and exit cleanly -- the job was green
   with no file published (1.110.2). A few spaced attempts: a release's
   asset list sometimes takes seconds to update. */
async function verifyPublished(opts) {
  const { request, tag, platforms, wait, attempts } = opts;
  const pause = wait || sleep;
  let problems = [];
  for (let i = 0; i < (attempts || 4); i++) {
    const list = releasesForTag(await listReleases(request), tag);
    if (list.length !== 1) {
      problems = [`${list.length} release(s) pour ${tag} au lieu d'une seule / release(s) instead of one`];
    } else {
      problems = [];
      for (const p of platforms || []) {
        const miss = missingAssets(list[0], p);
        if (miss.length) problems.push(`${p} : manquant(s) / missing: ${miss.join(", ")}`);
      }
    }
    if (!problems.length) return { ok: true, release: list[0] };
    if (i < (attempts || 4) - 1) await pause(5000);
  }
  return { ok: false, problems };
}


/* ------------------------------------------------------------
   Reprise des envois rates (1.112.2)
   ------------------------------------------------------------
   GitHub refuse parfois un fichier de 150 Mo : delai depasse
   (« Request timed out ») ou erreur serveur (« 500 Error saving
   asset »). electron-builder abandonne au PREMIER echec, sans
   reessayer, et la release reste incomplete -- c'est ce qui est arrive
   a la 1.112.1 (AppImage x64, zip mac arm64 et les latest*.yml
   manquants). PiBoard termine donc le travail lui-meme : il compare ce
   qui est en ligne a ce qui se trouve dans dist/, et televerse ce qui
   manque, avec des tentatives espacees.

   Resuming failed uploads. GitHub sometimes refuses a 150 MB file
   (timeout, or a 500 "Error saving asset"). electron-builder gives up
   on the FIRST failure without retrying and the release stays
   incomplete. So PiBoard finishes the job itself: it compares what is
   online with what sits in dist/ and uploads what is missing, with
   spaced attempts. */

/* Fichiers de dist/ qui appartiennent a la plateforme : les fichiers
   requis, leurs .blockmap et les latest*.yml.
   Files in dist/ belonging to the platform. */
/* Nom SOUS LEQUEL un fichier est publie. electron-builder ecrit
   « PiBoard Setup 1.2.3.exe » sur le disque mais le publie en
   « PiBoard-Setup-1.2.3.exe » : comparer les noms bruts faisait croire
   a la reprise qu'il n'y avait rien a envoyer (1.112.3).
   The name a file is PUBLISHED under. electron-builder writes
   "PiBoard Setup 1.2.3.exe" on disk but publishes it as
   "PiBoard-Setup-1.2.3.exe": comparing raw names made the repair think
   there was nothing to upload. */
function assetName(fileName) {
  return String(fileName || "").replace(/[ ]/g, "-");
}

function platformFiles(names, platform) {
  const pats = (REQUIRED_ASSETS[platform] || []).map(([, re]) => re);
  return (names || []).filter((n) => {
    const a = assetName(n);
    return pats.some((re) => re.test(a) || re.test(a.replace(/\.blockmap$/i, "")));
  });
}

/* Ce qu'il reste a envoyer, et les restes a supprimer d'abord : un
   fichier deja present mais de taille differente, ou qu'un envoi
   interrompu a laisse dans un etat inutilisable, doit etre remplace.
   What still needs uploading, and the leftovers to delete first. */
function planUploads(localFiles, release, platform) {
  const assets = (release && release.assets) || [];
  const wanted = platformFiles(localFiles.map((f) => f.name), platform);
  const uploads = [];
  const stale = [];
  for (const f of localFiles) {
    if (!wanted.includes(f.name)) continue;
    f.assetName = assetName(f.name);
    const found = assets.find((a) => a.name === f.assetName);
    if (!found) { uploads.push(f); continue; }
    const badState = found.state && found.state !== "uploaded";
    const badSize = typeof found.size === "number" && typeof f.size === "number" && found.size !== f.size;
    if (badState || badSize) { stale.push(found); uploads.push(f); }
  }
  return { uploads, stale };
}

function contentType(name) {
  if (/\.ya?ml$/i.test(name)) return "text/yaml";
  if (/\.blockmap$/i.test(name)) return "application/octet-stream";
  if (/\.zip$/i.test(name)) return "application/zip";
  return "application/octet-stream";
}

/* Envoi d'un fichier, avec reprises. `uploader` est injecte pour les
   tests ; en vrai, c'est uploadAsset ci-dessous.
   Uploading one file, with retries. */
async function uploadWithRetries(opts) {
  const { uploader, release, file, attempts, wait, log } = opts;
  const tries = attempts || 3;
  const pause = wait || sleep;
  const say = log || (() => {});
  let last = null;
  for (let i = 1; i <= tries; i++) {
    const r = await uploader({ release, file, contentType: contentType(file.name) });
    if (r && r.ok) { say(`Envoye / uploaded: ${file.assetName || file.name}`); return { ok: true, attempts: i }; }
    last = r && (r.error || r.status);
    say(`Echec ${i}/${tries} pour ${file.assetName || file.name} (${last}) / attempt ${i} failed`);
    if (i < tries) await pause(5000 * i);
  }
  return { ok: false, error: last };
}

/* Complete une release : supprime les restes, renvoie ce qui manque.
   Completes a release: removes leftovers, uploads what is missing. */
async function repairRelease(opts) {
  const { request, uploader, tag, platforms, localFiles, log, wait, attempts } = opts;
  const say = log || (() => {});
  const list = releasesForTag(await listReleases(request), tag);
  if (list.length !== 1) return { ok: false, problems: [`${list.length} release(s) pour ${tag}`] };
  const release = list[0];
  const problems = [];
  let sent = 0;
  for (const platform of platforms || []) {
    const plan = planUploads(localFiles, release, platform);
    /* Ce qui manque en ligne ET sur le disque : la reprise n'y peut
       rien, il faut le dire plutot que de se taire (1.112.3).
       Missing online AND on disk: the repair cannot help; say so
       rather than staying silent. */
    const localNames = localFiles.map((f) => assetName(f.name));
    for (const label of missingAssets(release, platform)) {
      const covered = plan.uploads.length && (REQUIRED_ASSETS[platform] || [])
        .filter(([l]) => l === label)
        .some(([, re]) => localNames.some((n) => re.test(n)));
      if (!covered && !localNames.some((n) => (REQUIRED_ASSETS[platform] || []).find(([l]) => l === label)[1].test(n))) {
        problems.push(`${label} : absent de la release ET de dist/ (a reconstruire) / missing online AND in dist/`);
      }
    }
    for (const a of plan.stale) {
      const d = await request("DELETE", `/repos/${REPO}/releases/assets/${a.id}`);
      say(`Reste supprime / leftover removed: ${a.name}` + (d.ok ? "" : ` (HTTP ${d.status})`));
    }
    for (const f of plan.uploads) {
      const r = await uploadWithRetries({ uploader, release, file: f, attempts, wait, log });
      if (r.ok) sent++;
      else problems.push(`${f.name}: ${r.error}`);
    }
  }
  return { ok: !problems.length, sent, problems, release };
}

/* Envoi reel vers GitHub : en FLUX, pour ne pas charger 160 Mo en
   memoire, avec un delai large (un .dmg met plusieurs minutes).
   Real upload to GitHub: STREAMED, so a 160 MB file is not loaded into
   memory, with a generous timeout. */
function makeUploader(token, timeoutMs) {
  const https = require("https");
  const fs = require("fs");
  return function upload({ release, file, contentType: type }) {
    return new Promise((resolve) => {
      const req = https.request({
        method: "POST",
        host: "uploads.github.com",
        path: `/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(file.assetName || file.name)}`,
        headers: {
          Authorization: "Bearer " + token,
          "User-Agent": "PiBoard publish",
          Accept: "application/vnd.github+json",
          "Content-Type": type,
          "Content-Length": file.size
        },
        timeout: timeoutMs || 900000
      }, (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          error: res.statusCode >= 300 ? "HTTP " + res.statusCode + " " + body.slice(0, 200) : null
        }));
      });
      req.on("timeout", () => { req.destroy(new Error("delai depasse / timed out")); });
      req.on("error", (e) => resolve({ ok: false, error: String(e.message || e) }));
      fs.createReadStream(file.path).on("error", (e) => {
        req.destroy();
        resolve({ ok: false, error: String(e.message || e) });
      }).pipe(req);
    });
  };
}

/* Fichiers construits, tels que les attend repairRelease.
   Built files, as repairRelease expects them. */
function listDistFiles(dir) {
  const fs = require("fs");
  const path = require("path");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((name) => ({ name, path: path.join(dir, name) }))
    .filter((f) => { try { return fs.statSync(f.path).isFile(); } catch (e) { return false; } })
    .map((f) => Object.assign(f, { size: fs.statSync(f.path).size }));
}

module.exports = {
  assetName,
  makeUploader,
  listDistFiles,
  platformFiles,
  planUploads,
  contentType,
  uploadWithRetries,
  repairRelease,
  missingAssets,
  verifyPublished,
  REPO,
  platformsOf,
  platformAssets,
  releasesForTag,
  planDuplicates,
  makeRequest,
  ensureRelease
};
