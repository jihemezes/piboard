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

module.exports = {
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
