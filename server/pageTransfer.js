/* ============================================================
   PiBoard - server/pageTransfer.js
   Export et import d'UNE page du mode tableau de bord.

   CE QUI EXISTAIT DEJA, ET POURQUOI CA NE SUFFISAIT PAS. PiBoard sait
   sauvegarder la configuration d'une tuile (reglages reutilisables) et
   cloner l'installation ENTIERE (voir server/clone.js). Entre les deux,
   rien : composer une page sur une machine et la reproduire sur une
   autre obligeait soit a tout refaire a la main, soit a ecraser toute
   l'installation d'arrivee avec un clone complet. C'est ce manque que
   comble ce module.

   ON REUTILISE LA MECANIQUE DU CLONE plutot que d'en ecrire une
   seconde : meme archive ZIP, meme empreinte de controle, meme
   traitement des secrets par famille, meme traduction des chemins entre
   systemes. Un deuxieme jeu de regles aurait diverge du premier a la
   premiere correction -- et c'est precisement sur ce genre de sujet,
   ou l'on perd des donnees, qu'une divergence coute cher.

   LE POINT DELICAT : LES IDENTIFIANTS. Une tuile porte un identifiant
   (`t-xxxx`) qui nomme AUSSI son dossier d'images (`media/t-xxxx`), et
   qui sert de cle dans le coffre a secrets. Reimporter une page en
   gardant ses identifiants d'origine serait une bombe a retardement :
   sur la machine d'arrivee, un `t-abc123` peut deja exister et designer
   une tuile sans aucun rapport -- la nouvelle ecraserait ses images et
   ses mots de passe. Tous les identifiants sont donc REGENERES a
   l'import, et les dossiers d'images comme les entrees du coffre sont
   renommes en consequence. C'est la seule facon d'importer deux fois la
   meme page sans que la seconde detruise la premiere.

   Export and import of ONE dashboard-mode page. PiBoard could already
   save a tile's configuration and clone the WHOLE installation; between
   the two, nothing -- composing a page on one machine and reproducing it
   on another meant either redoing it by hand or overwriting the whole
   destination with a full clone. We reuse the clone's machinery rather
   than writing a second one, which would have diverged on the first fix.
   THE DELICATE POINT IS IDENTIFIERS: a tile's id also names its media
   folder and keys its secrets vault entry, so reimporting a page with
   its original ids would let it overwrite an unrelated tile's images and
   passwords on the destination. All ids are REGENERATED on import, with
   media folders and vault entries renamed accordingly -- the only way to
   import the same page twice without the second destroying the first.
   ============================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const store = require("./store");
const clone = require("./clone");
const zip = require("./zip");

const FORMAT = 1;
const KIND = "piboard-page";
const MEDIA_ROOT = clone.MEDIA_ROOT;

/* La page 1 n'est pas une page comme les autres : elle EST le plateau
   (`layout.tiles`), et ses metadonnees vivent dans `layout.mainPage`.
   Voir le long commentaire de public/app.js sur ce choix. On lui donne
   ici l'identifiant conventionnel "main", qui n'existe nulle part
   ailleurs mais evite d'eparpiller des "si c'est la premiere page" dans
   tout le module.
   Page 1 is not a page like the others: it IS the board, its metadata
   living in `layout.mainPage`. The conventional id "main" keeps "if it
   is the first page" out of the rest of this module. */
const MAIN = "main";

function newTileId() {
  return "t-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function newPageId() {
  return "pg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

/* ---------- Lecture d'une page dans la disposition ---------- */

function listPages(layout) {
  const out = [{
    id: MAIN,
    name: (layout && layout.mainPage && layout.mainPage.name) || null,
    tiles: (layout && Array.isArray(layout.tiles)) ? layout.tiles.length : 0
  }];
  for (const p of (layout && Array.isArray(layout.pages) ? layout.pages : [])) {
    if (p && p.id) out.push({ id: p.id, name: p.name || null, tiles: Array.isArray(p.tiles) ? p.tiles.length : 0 });
  }
  return out;
}

function readPage(layout, pageId) {
  if (!layout || typeof layout !== "object") return null;
  if (pageId === MAIN) {
    const meta = Object.assign({}, layout.mainPage || {});
    return { id: MAIN, meta, tiles: Array.isArray(layout.tiles) ? layout.tiles : [] };
  }
  const page = (Array.isArray(layout.pages) ? layout.pages : []).find((p) => p && p.id === pageId);
  if (!page) return null;
  const meta = Object.assign({}, page);
  delete meta.tiles;
  delete meta.id;
  return { id: page.id, meta, tiles: Array.isArray(page.tiles) ? page.tiles : [] };
}

/* Dossier d'images du fond d'une page. Conventions de server/media.js :
   "bg-main" pour le plateau, "bg-<identifiant>" pour les suivantes.
   A page's background media folder, per server/media.js's conventions. */
function bgFolderFor(pageId) {
  return pageId === MAIN ? "bg-main" : "bg-" + pageId;
}

/* ---------- Construction de l'archive ---------- */

function buildPage(options) {
  const o = options || {};
  const layout = o.layout || {};
  const page = readPage(layout, o.pageId);
  if (!page) {
    const e = new Error("page introuvable / page not found");
    e.code = "no-such-page";
    throw e;
  }

  const keep = { service: !!o.includeServiceKeys, personal: !!o.includePersonalSecrets };
  const manifests = clone.readManifests(o.widgetsDir);
  const fields = clone.sensitiveFields(manifests);
  const home = o.home || os.homedir();
  const entries = [];
  const report = { media: 0, mediaBytes: 0, removedSecrets: [], paths: [] };

  /* On fabrique une disposition qui ne contient QUE cette page, puis on
     lui applique les outils du clone. Ils travaillent sur une forme de
     disposition, pas sur une page : leur donner ce qu'ils attendent evite
     d'ecrire une seconde version de chacun -- et de la voir diverger.
     A layout containing ONLY this page is built, then the clone's tools
     are applied to it: they work on a layout shape, and giving them what
     they expect avoids writing a second version of each. */
  const asLayout = { tiles: page.tiles };
  const stripped = clone.stripSecretsFromLayout(asLayout, fields, keep);
  report.removedSecrets = stripped.removed;
  report.paths = clone.collectPaths(asLayout, clone.pathFields(manifests), home)
    .map((p) => ({ tile: p.tile, widget: p.widget, key: p.key, value: p.value, classified: p.classified }));

  const tiles = stripped.layout.tiles || [];
  entries.push({
    name: "page/page.json",
    data: JSON.stringify({ id: page.id, meta: page.meta, tiles }, null, 2)
  });

  /* Le theme propre a la page, quand il est personnalise. Sans lui, une
     page soignee arrive sur l'autre machine avec les couleurs par
     defaut : le theme fait partie de la page autant que ses tuiles.
     Les themes LIVRES avec PiBoard ne voyagent pas -- ils sont deja
     des deux cotes, et les embarquer ferait grossir l'archive pour
     rien.
     The page's own theme when it is a custom one: without it a carefully
     themed page arrives in default colours. Built-in themes do not
     travel, being present on both sides already. */
  const themeId = page.meta && page.meta.theme;
  if (themeId && Array.isArray(o.userThemes)) {
    const theme = o.userThemes.find((t) => t && t.id === themeId);
    if (theme) entries.push({ name: "page/theme.json", data: JSON.stringify(theme, null, 2) });
  }

  /* Les secrets, filtres sur les SEULES tuiles de cette page : exporter
     une page ne doit jamais emporter le mot de passe d'une tuile d'une
     autre page.
     Secrets restricted to THIS page's tiles: exporting one page must
     never carry another page's password. */
  const split = clone.splitVault(vaultFor(page.tiles), fields, asLayout);
  if (keep.service && Object.keys(split.service).length) {
    entries.push({ name: "secrets/service.json", data: JSON.stringify(split.service, null, 2) });
  }
  if (keep.personal && Object.keys(split.personal).length) {
    entries.push(o.passphrase
      ? { name: "secrets/personal.enc.json", data: JSON.stringify(clone.encryptSecrets(split.personal, o.passphrase), null, 2) }
      : { name: "secrets/personal.json", data: JSON.stringify(split.personal, null, 2) });
  }

  if (o.includeImages !== false) {
    // Images des tuiles de la page.
    for (const tile of page.tiles) {
      if (!tile || !tile.id) continue;
      for (const file of clone.walk(path.join(MEDIA_ROOT, tile.id), "")) {
        entries.push({ name: "media/tiles/" + tile.id + "/" + file.rel, data: fs.readFileSync(file.full), store: clone.isAlreadyCompressed(file.rel) });
        report.media++; report.mediaBytes += file.size;
      }
    }
    /* Le fond de page va dans un dossier NEUTRE ("media/background"),
       sans l'identifiant de la page source : a l'arrivee il sera pose
       dans le dossier de la page de DESTINATION, qui porte un autre
       identifiant. Garder le nom d'origine aurait oblige a le deviner
       au moment de l'import.
       The background goes to a NEUTRAL folder, without the source page's
       id: on arrival it lands in the DESTINATION page's folder. */
    for (const file of clone.walk(path.join(MEDIA_ROOT, bgFolderFor(page.id)), "")) {
      entries.push({ name: "media/background/" + file.rel, data: fs.readFileSync(file.full), store: clone.isAlreadyCompressed(file.rel) });
      report.media++; report.mediaBytes += file.size;
    }
  }

  const payload = Buffer.concat(entries.map((e) =>
    Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), "utf8")));
  const manifest = {
    format: FORMAT,
    kind: KIND,
    createdAt: new Date().toISOString(),
    appVersion: o.appVersion || "",
    platform: process.platform,
    home,
    page: { name: (page.meta && page.meta.name) || null, tiles: tiles.length },
    contents: {
      serviceKeys: keep.service,
      personalSecrets: keep.personal,
      encrypted: !!(keep.personal && o.passphrase),
      theme: entries.some((e) => e.name === "page/theme.json"),
      images: o.includeImages !== false,
      mediaFiles: report.media,
      mediaBytes: report.mediaBytes
    },
    paths: report.paths,
    digest: crypto.createHash("sha256").update(payload).digest("hex")
  };
  entries.unshift({ name: KIND + ".json", data: JSON.stringify(manifest, null, 2) });
  entries.push({ name: "LISEZMOI.txt", data: readmeText(manifest) });

  return { buffer: zip.write(entries, { date: new Date() }), manifest, report };
}

function vaultFor(tiles) {
  let all = {};
  try {
    const tileSecrets = require("./tileSecrets");
    if (typeof tileSecrets.all === "function") all = tileSecrets.all() || {};
  } catch (e) { all = {}; }
  const ids = new Set((tiles || []).map((t) => t && t.id).filter(Boolean));
  const out = {};
  for (const [id, entries] of Object.entries(all)) if (ids.has(id)) out[id] = entries;
  return out;
}

function readmeText(m) {
  return [
    "PiBoard - sauvegarde d'une page / page backup",
    "",
    "Page : " + ((m.page && m.page.name) || "(sans nom / unnamed)"),
    "Tuiles / tiles : " + ((m.page && m.page.tiles) || 0),
    "Cree le / created : " + m.createdAt,
    "Version de PiBoard : " + (m.appVersion || "?"),
    "",
    "A importer depuis PiBoard : Reglages > Sauvegarde, import et export,",
    "section « Page du tableau de bord ». Les identifiants des tuiles sont",
    "regeneres a l'import : la page peut donc etre importee plusieurs fois",
    "sans que l'une ecrase l'autre.",
    "",
    "Import from PiBoard: Settings > Backup, import and export, \"Dashboard",
    "page\" section. Tile identifiers are regenerated on import, so the page",
    "can be imported several times without one overwriting another."
  ].join("\n");
}

/* ---------- Aperçu avant import ---------- */

function inspectPage(buffer, options) {
  const o = options || {};
  const files = zip.read(buffer);
  const byName = new Map(files.map((f) => [f.name, f]));

  const manifestFile = byName.get(KIND + ".json");
  if (!manifestFile) {
    /* Message distinct selon ce qu'on a RECONNU : confondre « ce n'est
       pas une archive PiBoard » avec « c'est un clone complet, pas une
       page » enverrait l'utilisateur chercher un fichier abime alors
       qu'il s'est juste trompe de section.
       A distinct message depending on what was RECOGNISED: confusing
       "not a PiBoard archive" with "that is a full clone, not a page"
       would send the user hunting for a damaged file when they merely
       picked the wrong section. */
    const e = new Error(byName.get("piboard-clone.json")
      ? "ceci est un clone complet, pas une page / this is a full clone, not a page"
      : "ce fichier n'est pas une page PiBoard / not a PiBoard page");
    e.code = byName.get("piboard-clone.json") ? "is-a-clone" : "not-a-page";
    throw e;
  }
  const manifest = JSON.parse(manifestFile.data.toString("utf8"));
  if (manifest.kind !== KIND) {
    const e = new Error("ce fichier n'est pas une page PiBoard / not a PiBoard page");
    e.code = "not-a-page";
    throw e;
  }

  const payload = Buffer.concat(files
    .filter((f) => f.name !== KIND + ".json" && f.name !== "LISEZMOI.txt")
    .map((f) => f.data));
  const digest = crypto.createHash("sha256").update(payload).digest("hex");
  const intact = !manifest.digest || digest === manifest.digest;

  const pageFile = byName.get("page/page.json");
  const page = pageFile ? JSON.parse(pageFile.data.toString("utf8")) : null;
  const tiles = (page && Array.isArray(page.tiles)) ? page.tiles : [];
  const home = o.home || os.homedir();

  const paths = (manifest.paths || []).map((p) => {
    const to = clone.translatePath(p.classified, home);
    return { tile: p.tile, widget: p.widget, key: p.key, from: p.value, to, needsChoice: !to, kind: (p.classified && p.classified.kind) || "empty" };
  });

  return {
    manifest, intact, digest,
    newer: !!(o.appVersion && manifest.appVersion && clone.compareVersions(manifest.appVersion, o.appVersion) > 0),
    page: { name: (page && page.meta && page.meta.name) || (manifest.page && manifest.page.name) || null },
    counts: {
      tiles: tiles.length,
      media: (manifest.contents && manifest.contents.mediaFiles) || 0,
      mediaBytes: (manifest.contents && manifest.contents.mediaBytes) || 0
    },
    widgets: [...new Set(tiles.map((t) => t && t.widget).filter(Boolean))].sort(),
    hasTheme: !!byName.get("page/theme.json"),
    paths,
    needsPassphrase: !!byName.get("secrets/personal.enc.json")
  };
}

/* ---------- Application ----------
   L'appelant a DEJA pris une sauvegarde de la page de destination : ce
   module ecrit, il ne decide pas de la prudence a avoir. Voir la route
   dans server/index.js.
   The caller has ALREADY backed up the destination page: this module
   writes, it does not decide how careful to be. */

function applyPage(buffer, options) {
  const o = options || {};
  const mode = ["new", "replace", "merge"].includes(o.mode) ? o.mode : "new";
  const files = zip.read(buffer);
  const byName = new Map(files.map((f) => [f.name, f]));
  const info = inspectPage(buffer, o);
  if (!info.intact) {
    const e = new Error("archive incomplete ou abimee / incomplete or damaged archive");
    e.code = "damaged";
    throw e;
  }

  const page = JSON.parse(byName.get("page/page.json").data.toString("utf8"));
  const layout = o.layout && typeof o.layout === "object" ? o.layout : {};
  const report = { tiles: 0, media: 0, secrets: 0, warnings: [], mode };

  /* 1. Regeneration des identifiants. Voir l'en-tete du fichier : c'est
        ce qui permet d'importer deux fois la meme page sans que la
        seconde detruise la premiere. */
  const idMap = new Map();
  const tiles = (Array.isArray(page.tiles) ? page.tiles : []).map((tile) => {
    const copy = JSON.parse(JSON.stringify(tile || {}));
    const oldId = copy.id;
    copy.id = newTileId();
    if (oldId) idMap.set(oldId, copy.id);
    return copy;
  });
  if (o.pathDecisions) clone.applyPaths({ tiles }, o.pathDecisions);
  report.tiles = tiles.length;

  /* 2. Destination. */
  let targetId;
  if (mode === "new") {
    targetId = newPageId();
    const meta = Object.assign({}, page.meta || {});
    delete meta.theme; // repose plus bas, une fois le theme eventuellement ajoute
    const entry = Object.assign({ id: targetId }, meta, { tiles });
    if (page.meta && page.meta.theme) entry.theme = page.meta.theme;
    layout.pages = Array.isArray(layout.pages) ? layout.pages : [];
    layout.pages.push(entry);
  } else {
    targetId = o.targetPageId;
    const target = targetId === MAIN ? null : (Array.isArray(layout.pages) ? layout.pages : []).find((p) => p && p.id === targetId);
    if (targetId !== MAIN && !target) {
      const e = new Error("page de destination introuvable / destination page not found");
      e.code = "no-such-page";
      throw e;
    }
    const existing = targetId === MAIN
      ? (Array.isArray(layout.tiles) ? layout.tiles : [])
      : (Array.isArray(target.tiles) ? target.tiles : []);

    /* En FUSION, les tuiles importees sont posees SOUS celles qui sont
       deja la. Les empiler sur les memes coordonnees les ferait se
       recouvrir, et Gridstack les repousserait ensuite dans un ordre que
       personne n'a choisi -- le resultat serait une page melangee, bien
       pire qu'une page longue.
       On MERGE, imported tiles are placed BELOW the existing ones:
       stacking them on the same coordinates would have Gridstack shove
       them about in an order nobody chose. */
    let merged = tiles;
    if (mode === "merge") {
      const bottom = existing.reduce((max, t) => Math.max(max, (Number(t.y) || 0) + (Number(t.h) || 1)), 0);
      merged = existing.concat(tiles.map((t) => Object.assign({}, t, { y: (Number(t.y) || 0) + bottom })));
    }
    if (targetId === MAIN) {
      layout.tiles = merged;
      if (mode === "replace" && page.meta) {
        layout.mainPage = Object.assign({}, layout.mainPage || {}, page.meta);
      }
    } else {
      target.tiles = merged;
      if (mode === "replace" && page.meta) Object.assign(target, page.meta);
    }
  }

  /* 3. Le theme personnalise, ajoute SANS jamais ecraser un theme
        existant du meme identifiant : sur la machine d'arrivee, ce
        theme peut avoir ete retouche, et l'import d'une page n'a pas a
        defaire ce travail. */
  if (byName.get("page/theme.json") && Array.isArray(o.userThemes)) {
    const theme = JSON.parse(byName.get("page/theme.json").data.toString("utf8"));
    if (theme && theme.id && !o.userThemes.some((t) => t && t.id === theme.id)) {
      o.userThemes.push(theme);
      report.themeAdded = theme.id;
    } else if (theme && theme.id) {
      report.warnings.push({ code: "theme-exists", id: theme.id });
    }
  }

  /* 4. Les images, posees sous les NOUVEAUX identifiants. */
  for (const f of files) {
    const m = /^media\/tiles\/([^/]+)\/(.+)$/.exec(f.name);
    if (m) {
      const to = idMap.get(m[1]);
      if (!to) continue;
      writeMedia(path.join(MEDIA_ROOT, to, m[2]), f.data);
      report.media++;
      continue;
    }
    const b = /^media\/background\/(.+)$/.exec(f.name);
    if (b) {
      writeMedia(path.join(MEDIA_ROOT, bgFolderFor(targetId), b[1]), f.data);
      report.media++;
    }
  }

  /* 5. Les secrets, remappes sur les nouveaux identifiants. Sans ce
        remappage ils seraient ranges sous des identifiants que plus
        aucune tuile ne porte : invisibles, inutilisables, et pourtant
        bien presents dans le coffre.
        Secrets remapped onto the new ids; without it they would sit
        under ids no tile carries any more. */
  let tileSecrets = null;
  try { tileSecrets = require("./tileSecrets"); } catch (e) { tileSecrets = null; }
  const put = (obj) => {
    if (!tileSecrets || typeof tileSecrets.set !== "function") return;
    for (const [oldId, entries] of Object.entries(obj || {})) {
      const to = idMap.get(oldId);
      if (!to) continue;
      for (const [key, value] of Object.entries(entries || {})) {
        try { tileSecrets.set(to, key, value); report.secrets++; } catch (e) { /* non bloquant */ }
      }
    }
  };
  if (byName.get("secrets/service.json")) put(JSON.parse(byName.get("secrets/service.json").data.toString("utf8")));
  if (byName.get("secrets/personal.json")) put(JSON.parse(byName.get("secrets/personal.json").data.toString("utf8")));
  if (byName.get("secrets/personal.enc.json")) {
    if (!o.passphrase) {
      report.warnings.push({ code: "passphrase-missing" });
    } else {
      try { put(clone.decryptSecrets(JSON.parse(byName.get("secrets/personal.enc.json").data.toString("utf8")), o.passphrase)); }
      catch (e) { report.warnings.push({ code: "passphrase-wrong" }); }
    }
  }

  return { layout, targetPageId: targetId, report, info };
}

function writeMedia(full, data) {
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

module.exports = {
  FORMAT, KIND, MAIN,
  listPages, readPage, bgFolderFor,
  buildPage, inspectPage, applyPage,
  _newTileId: newTileId, _newPageId: newPageId
};
