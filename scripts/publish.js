#!/usr/bin/env node
/* ============================================================
   PiBoard - scripts/publish.js
   Enveloppe autour d'electron-builder qui decide si la release GitHub
   doit etre marquee "latest" ou "pre-release", et le dit clairement
   avant de construire.

   POURQUOI CE SCRIPT. Jusqu'a la 1.100.0, `publish` etait un appel
   direct a electron-builder avec `releaseType: release` fige dans
   electron-builder.yml : toute release poussee devenait
   immediatement la "latest" du depot, sans qu'on puisse choisir. Le
   choix inverse (tout passer en brouillon) n'est pas envisageable :
   l'API GitHub ne montre jamais les brouillons a un client non
   authentifie, et le Raspberry Pi, qui interroge cette API pour ses
   mises a jour, ne verrait plus rien (voir le long commentaire de la
   section `publish:` d'electron-builder.yml).

   COMMENT LE CHOIX SE FAIT -- par le NUMERO DE VERSION, dans cet
   ordre :
     1. La variable d'environnement PIBOARD_RELEASE, si elle vaut
        `prerelease` ou `latest` : une derogation ponctuelle.
     2. Sinon, le numero de version de package.json : s'il porte un
        suffixe semver (1.101.0-beta.1, -rc.2, -preview.3...), la
        release est une PRE-RELEASE ; sinon elle est publiee en
        "latest".

   POURQUOI LE NUMERO DE VERSION ET PAS UN SIMPLE DRAPEAU. Parce que
   deux machines publient dans la MEME release : le PC de
   developpement pour Windows (`npm run publish`) et GitHub Actions
   pour Linux et macOS (declenche par le tag). La premiere arrivee
   cree la release et fixe son statut. Un drapeau local ne serait
   connu que du PC, et le statut dependrait alors de qui gagne la
   course. Le numero de version, lui, est dans le depot : les deux
   cotes lisent le meme et decident pareil. C'est aussi ce que
   comprend deja le reste de la chaine -- le canal "Toutes les
   versions (apercu)" des reglages s'appuie sur ce meme suffixe semver
   (`allowPrerelease` dans electron/updater.js).

   GARDE-FOU. Le script refuse de publier si le tag git couramment
   pointe sur HEAD ne correspond pas a la version de package.json :
   c'est la seule erreur qui produirait une release incoherente
   (fichiers d'une version, tag d'une autre), et elle se rattrape mal
   une fois poussee.

   Wrapper around electron-builder deciding whether the GitHub release
   is marked "latest" or "pre-release", and saying so clearly before
   building. The decision is made from the VERSION NUMBER: a semver
   suffix (1.101.0-beta.1, -rc.2...) means pre-release, a plain number
   means latest; the PIBOARD_RELEASE environment variable
   (`prerelease` / `latest`) overrides it for one run. The version
   number rather than a local flag, because two machines publish into
   the same release (this PC for Windows, GitHub Actions for Linux and
   macOS) and both must decide identically -- the version is in the
   repository, a local flag would not be. Draft releases are
   deliberately not offered: GitHub's API hides drafts from
   unauthenticated clients, so the Raspberry Pi would stop seeing
   updates entirely (see the `publish:` section of
   electron-builder.yml).
   ============================================================ */

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const version = String(pkg.version || "");

/* Suffixe semver = tout ce qui suit le premier tiret : 1.101.0-beta.1
   -> "beta.1". C'est la definition de semver, et celle qu'utilise
   electron-updater pour son canal "apercu".
   Semver suffix = everything after the first dash: 1.101.0-beta.1 ->
   "beta.1". That is semver's definition, and the one electron-updater
   uses for its "preview" channel. */
const suffix = version.includes("-") ? version.slice(version.indexOf("-") + 1) : "";

const override = String(process.env.PIBOARD_RELEASE || "").trim().toLowerCase();
if (override && override !== "prerelease" && override !== "latest") {
  console.error(
    `PIBOARD_RELEASE="${process.env.PIBOARD_RELEASE}" n'est pas comprise : valeurs acceptees, ` +
    `"prerelease" ou "latest". / not understood: accepted values are "prerelease" or "latest".`
  );
  process.exit(1);
}

const prerelease = override ? override === "prerelease" : !!suffix;
const releaseType = prerelease ? "prerelease" : "release";

/* Les arguments recus (--win, --linux --x64 --arm64, --mac...) sont
   passes tels quels a electron-builder ; on n'ajoute que la
   publication et le type de release.
   The received arguments (--win, --linux --x64 --arm64, --mac...) are
   passed through to electron-builder as is; we only add the
   publication and the release type. */
const passthrough = process.argv.slice(2);
const publishing = !passthrough.includes("--publish") || passthrough.includes("always");

/* Verification du tag, uniquement quand on publie pour de bon. `git
   tag --points-at HEAD` liste les tags du commit courant ; s'il n'y en
   a aucun, on laisse passer (electron-builder creera le tag depuis la
   version), s'il y en a, l'un d'eux doit etre v<version>. Hors depot
   git (archive telechargee) ou sans git installe, la commande echoue :
   on n'en fait pas une erreur.
   Tag check, only when actually publishing. `git tag --points-at HEAD`
   lists the current commit's tags; if there is none we let it pass
   (electron-builder will create the tag from the version), if there
   are some, one of them must be v<version>. Outside a git repository
   (downloaded archive) or without git installed the command fails: we
   do not turn that into an error. */
if (publishing) {
  const git = spawnSync("git", ["tag", "--points-at", "HEAD"], { cwd: root, encoding: "utf8" });
  if (git.status === 0) {
    const tags = String(git.stdout || "").split("\n").map((t) => t.trim()).filter(Boolean);
    if (tags.length && !tags.includes("v" + version)) {
      console.error(
        `\nIncoherence entre le tag git et la version :\n` +
        `  package.json : ${version}  (tag attendu : v${version})\n` +
        `  tag(s) sur HEAD : ${tags.join(", ")}\n\n` +
        `Corrige l'un ou l'autre avant de publier, sinon la release portera un tag\n` +
        `qui ne correspond pas aux fichiers qu'elle contient.\n\n` +
        `Mismatch between the git tag and the version -- fix either one before\n` +
        `publishing, or the release will carry a tag that does not match its files.\n`
      );
      process.exit(1);
    }
  }
}

/* Verification prealable cote GitHub : une release portant deja ce tag
   fait echouer electron-builder par un 422 "already_exists" -- mais
   SEULEMENT a la toute fin, apres trois a cinq minutes de construction
   et l'envoi d'un installeur de 130 Mo. Constate sur la 1.108.1 : une
   release vide creee par un essai precedent, et tout le travail perdu.
   On regarde donc AVANT de construire. L'appel est anonyme (depot
   public) et sans consequence s'il echoue : en cas de doute, on laisse
   passer plutot que de bloquer une publication legitime.

   Pre-flight check on GitHub's side: a release already carrying this tag
   makes electron-builder fail with a 422 "already_exists" -- but ONLY at
   the very end, after three to five minutes of building and uploading a
   130 MB installer. Observed on 1.108.1: an empty release left by an
   earlier attempt, and all the work wasted. So we look BEFORE building.
   The call is anonymous (public repository) and inconsequential if it
   fails: when in doubt we let it through rather than block a legitimate
   publication. */
async function existingRelease(tag) {
  const repo = "jihemezes/piboard";
  /* Le jeton de publication, s'il est pose (GH_TOKEN pour
     electron-builder, GITHUB_TOKEN dans Actions), sert aussi ici : sans
     lui l'API limite a 60 appels par heure et par adresse, et un refus
     de quota renverrait 403 -- que l'on traite comme \"je ne sais pas\",
     donc en laissant passer. Avec le jeton, la reponse est fiable.
     The publishing token, when set (GH_TOKEN for electron-builder,
     GITHUB_TOKEN in Actions), is used here too: without it the API caps
     at 60 calls an hour per address, and a quota refusal would answer
     403 -- which we treat as \"I do not know\", hence letting it through.
     With the token, the answer is reliable. */
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const headers = { "User-Agent": "PiBoard publish", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return { assets: (data.assets || []).length, url: data.html_url, draft: !!data.draft };
  } catch (e) {
    return null;
  }
}

async function main() {
if (publishing) {
  const tag = "v" + version;
  const found = await existingRelease(tag);
  if (found) {
    console.error(
      `\nUne release ${tag} existe deja sur GitHub` +
      (found.assets ? ` avec ${found.assets} fichier(s).` : ` mais elle est VIDE (aucun fichier).`) +
      `\n  ${found.url}\n\n` +
      (found.assets
        ? `Publier a nouveau sous ce numero est refuse par GitHub. Passe au numero suivant\n` +
          `(package.json + tag), ou supprime cette release si elle est ratee.\n`
        : `Elle vient sans doute d'un essai precedent, ou du workflow GitHub Actions declenche\n` +
          `par le tag. Supprime-la sur la page ci-dessus (bouton Delete), puis relance\n` +
          `npm run publish. Le tag git, lui, peut rester s'il pointe sur le bon commit.\n`) +
      `\nA release ${tag} already exists on GitHub -- delete it or move to the next version\n` +
      `number before publishing again.\n`
    );
    process.exit(1);
  }
}

console.log(
  `\nPiBoard ${version} -> release GitHub marquee ` +
  (prerelease
    ? `PRE-RELEASE (elle ne deviendra pas la "latest" du depot)`
    : `LATEST (version recommandee du depot)`) +
  (override
    ? `  [impose par PIBOARD_RELEASE=${override}]`
    : suffix
      ? `  [suffixe de version "-${suffix}"]`
      : `  [numero de version sans suffixe]`) +
  `\n`
);

const args = passthrough.concat(["-c.publish.releaseType=" + releaseType]);
if (!passthrough.includes("--publish")) args.push("--publish", "always");

/* electron-builder est appele par son chemin dans node_modules plutot
   que par `npx` : plus rapide, et surtout insensible au PATH sous
   Windows. Le `.cmd` est necessaire la-bas, shell:true suffirait mais
   exposerait les arguments a l'interpretation du shell.
   electron-builder is called through its path in node_modules rather
   than through `npx`: faster, and above all insensitive to PATH on
   Windows. The `.cmd` is required there; shell:true would do but would
   expose the arguments to the shell's interpretation. */
const bin = path.join(
  root, "node_modules", ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);
const run = spawnSync(bin, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
process.exit(run.status === null ? 1 : run.status);
}

main();
