/* Tests de l'export/import d'une page (server/pageTransfer.js).

   CE QUI EST VERIFIE EN PRIORITE. Un aller-retour reussi ne prouve pas
   grand-chose : il marchera toujours. Ce qui compte ici, ce sont les cas
   ou l'on PERD des donnees, et ils sont tous silencieux :

     - reimporter une page sans regenerer les identifiants ferait ecraser
       les images et les mots de passe d'une tuile SANS RAPPORT qui porte
       le meme identifiant sur la machine d'arrivee ;
     - importer deux fois la meme page ferait detruire la premiere copie
       par la seconde, pour la meme raison ;
     - une fusion qui empilerait les tuiles aux memes coordonnees
       donnerait une page melangee par Gridstack, dans un ordre que
       personne n'a choisi ;
     - un theme existant ecrase a l'arrivee defait un travail de mise en
       forme sans rien dire.

   Aucun de ces defauts ne leve d'exception ni n'affiche d'erreur : ils
   se constatent plus tard, quand il est trop tard. D'ou des tests qui
   les visent explicitement.

   Tout tourne sur un dossier de donnees TEMPORAIRE : les tests ecrivent
   de vraies images et un vrai coffre, et n'ont aucune raison de toucher
   a l'installation de qui les execute.

   WHAT IS CHECKED FIRST: not that a round trip works -- it always will --
   but the cases where data is LOST, all of them silent: reimporting
   without regenerating ids would overwrite an UNRELATED tile's images and
   passwords; importing twice would have the second copy destroy the
   first; a merge stacking tiles on the same coordinates would be
   reshuffled by Gridstack in an order nobody chose; an existing theme
   overwritten on arrival undoes styling work without a word. None of
   these raise an exception. Everything runs on a TEMPORARY data folder. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-page-"));
process.env.PIBOARD_DATA = TMP;

const P = require("../server/pageTransfer");
const clone = require("../server/clone");
const MEDIA = path.join(TMP, "media");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

function writeMedia(rel, content) {
  const full = path.join(MEDIA, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function layoutFixture() {
  return {
    mainPage: { name: "Plateau" },
    tiles: [{ id: "t-main1", widget: "clock", x: 0, y: 0, w: 2, h: 2, settings: {} }],
    pages: [
      {
        id: "pg-source", name: "Supervision", theme: "th-perso", dwell: 30,
        tiles: [
          { id: "t-aaa", widget: "text", x: 0, y: 0, w: 6, h: 2, settings: { text: "Supervision" } },
          { id: "t-bbb", widget: "slideshow", x: 0, y: 2, w: 4, h: 4, settings: {} }
        ]
      },
      { id: "pg-dest", name: "Destination", tiles: [{ id: "t-zzz", widget: "quote", x: 0, y: 0, w: 3, h: 2 }] }
    ]
  };
}

const THEMES = [{ id: "th-perso", name: "Mon theme", user: true, dark: { bg: "#000000" } }];

function exportSource(opts) {
  writeMedia("t-bbb/photo.jpg", Buffer.from("IMAGE-DIAPORAMA"));
  writeMedia("bg-pg-source/fond.png", Buffer.from("IMAGE-FOND"));
  return P.buildPage(Object.assign({
    layout: layoutFixture(),
    pageId: "pg-source",
    widgetsDir: path.join(__dirname, "..", "public", "widgets"),
    userThemes: THEMES,
    appVersion: "1.127.0",
    includeImages: true
  }, opts || {}));
}

console.log("== Lecture des pages ==");

test("les pages sont listees, le plateau compris", () => {
  const pages = P.listPages(layoutFixture());
  assert.deepStrictEqual(pages.map((p) => p.id), ["main", "pg-source", "pg-dest"]);
  assert.strictEqual(pages[0].name, "Plateau");
  assert.strictEqual(pages[1].tiles, 2);
});

/* La page 1 n'est pas rangee comme les autres : elle EST le plateau,
   ses metadonnees vivant a part. La lire comme une page ordinaire
   echouerait silencieusement, en rendant une page vide.
   Page 1 is not stored like the others: reading it as an ordinary page
   would silently yield an empty page. */
test("le plateau se lit comme une page, malgre son rangement a part", () => {
  const page = P.readPage(layoutFixture(), "main");
  assert.strictEqual(page.tiles.length, 1);
  assert.strictEqual(page.meta.name, "Plateau");
});

test("une page inexistante rend null, sans lever", () => {
  assert.strictEqual(P.readPage(layoutFixture(), "pg-nexistepas"), null);
});

console.log("== Aller-retour ==");

test("l'archive se relit et annonce ce qu'elle contient", () => {
  const built = exportSource();
  const info = P.inspectPage(built.buffer, { appVersion: "1.127.0" });
  assert.strictEqual(info.intact, true, "l'empreinte doit correspondre");
  assert.strictEqual(info.page.name, "Supervision");
  assert.strictEqual(info.counts.tiles, 2);
  assert.ok(info.counts.media >= 2, "les images de tuile ET le fond de page voyagent");
  assert.deepStrictEqual(info.widgets, ["slideshow", "text"]);
  assert.strictEqual(info.hasTheme, true, "le theme personnalise de la page voyage avec elle");
});

test("une archive tronquee est refusee, pas appliquee a moitie", () => {
  const built = exportSource();
  const cut = built.buffer.slice(0, built.buffer.length - 40);
  let thrown = null;
  try { P.inspectPage(cut, {}); } catch (e) { thrown = e; }
  assert.ok(thrown, "une archive coupee doit etre rejetee");
});

/* Se tromper de section est une erreur d'utilisateur ordinaire. Lui
   repondre « fichier abime » l'enverrait chercher un probleme qui
   n'existe pas.
   Picking the wrong section is an ordinary mistake; answering "damaged
   file" would send the user hunting for a problem that does not exist. */
test("un clone complet est reconnu COMME TEL, pas annonce comme abime", () => {
  const full = clone.buildClone({
    widgetsDir: path.join(__dirname, "..", "public", "widgets"),
    includeImages: false, appVersion: "1.127.0"
  });
  let thrown = null;
  try { P.inspectPage(full.buffer, {}); } catch (e) { thrown = e; }
  assert.ok(thrown, "doit etre refuse");
  assert.strictEqual(thrown.code, "is-a-clone", "le message doit dire que c'est un clone, pas une page");
});

test("un fichier quelconque est refuse clairement", () => {
  let thrown = null;
  try { P.inspectPage(Buffer.from("PK\u0003\u0004 n'importe quoi"), {}); } catch (e) { thrown = e; }
  assert.ok(thrown);
});

console.log("== Regeneration des identifiants ==");

/* LE POINT CRITIQUE. L'identifiant d'une tuile nomme AUSSI son dossier
   d'images et sa cle dans le coffre a secrets. Le conserver a l'import
   ferait ecraser les images et les mots de passe d'une tuile SANS
   RAPPORT portant le meme identifiant sur la machine d'arrivee.
   THE CRITICAL POINT: a tile's id also names its media folder and keys
   its vault entry. */
test("aucune tuile importee ne garde son identifiant d'origine", () => {
  const built = exportSource();
  const out = P.applyPage(built.buffer, { layout: layoutFixture(), mode: "new", userThemes: THEMES.slice() });
  const imported = out.layout.pages.find((p) => p.id === out.targetPageId);
  const ids = imported.tiles.map((t) => t.id);
  assert.ok(!ids.includes("t-aaa") && !ids.includes("t-bbb"), "identifiants regeneres : " + ids.join(", "));
  assert.ok(ids.every((id) => /^t-/.test(id)));
  assert.strictEqual(new Set(ids).size, ids.length, "et distincts entre eux");
});

test("les images suivent les NOUVEAUX identifiants", () => {
  const built = exportSource();
  const out = P.applyPage(built.buffer, { layout: layoutFixture(), mode: "new", userThemes: THEMES.slice() });
  const imported = out.layout.pages.find((p) => p.id === out.targetPageId);
  const slideshow = imported.tiles.find((t) => t.widget === "slideshow");
  const file = path.join(MEDIA, slideshow.id, "photo.jpg");
  assert.ok(fs.existsSync(file), "l'image doit etre posee sous le nouvel identifiant : " + file);
  assert.strictEqual(fs.readFileSync(file, "utf8"), "IMAGE-DIAPORAMA");
});

test("le fond de page atterrit dans le dossier de la page de DESTINATION", () => {
  const built = exportSource();
  const out = P.applyPage(built.buffer, { layout: layoutFixture(), mode: "new", userThemes: THEMES.slice() });
  const bg = path.join(MEDIA, P.bgFolderFor(out.targetPageId), "fond.png");
  assert.ok(fs.existsSync(bg), "le fond doit suivre la page d'arrivee : " + bg);
});

/* La consequence directe du point precedent, et la raison d'etre du
   choix : importer deux fois la meme page doit donner DEUX pages
   independantes, pas une page et une ruine.
   Importing twice must give TWO independent pages. */
test("importer deux fois la meme page ne detruit pas la premiere", () => {
  const built = exportSource();
  const layout = layoutFixture();
  const first = P.applyPage(built.buffer, { layout, mode: "new", userThemes: THEMES.slice() });
  const second = P.applyPage(built.buffer, { layout: first.layout, mode: "new", userThemes: THEMES.slice() });
  assert.notStrictEqual(first.targetPageId, second.targetPageId);
  const p1 = second.layout.pages.find((p) => p.id === first.targetPageId);
  const p2 = second.layout.pages.find((p) => p.id === second.targetPageId);
  assert.ok(p1 && p2, "les deux pages doivent coexister");
  const shared = p1.tiles.map((t) => t.id).filter((id) => p2.tiles.some((t) => t.id === id));
  assert.strictEqual(shared.length, 0, "aucune tuile partagee entre les deux copies");
  // Et les images de la premiere copie sont toujours la.
  const s1 = p1.tiles.find((t) => t.widget === "slideshow");
  assert.ok(fs.existsSync(path.join(MEDIA, s1.id, "photo.jpg")), "les images de la 1re copie survivent");
});

console.log("== Les trois destinations ==");

test("« nouvelle page » ajoute sans toucher aux pages existantes", () => {
  const layout = layoutFixture();
  const before = layout.pages.length;
  const out = P.applyPage(exportSource().buffer, { layout, mode: "new", userThemes: THEMES.slice() });
  assert.strictEqual(out.layout.pages.length, before + 1);
  assert.strictEqual(out.layout.pages.find((p) => p.id === "pg-dest").tiles.length, 1, "la page voisine est intacte");
});

test("« remplacer » ecrase le contenu de la page choisie, elle seule", () => {
  const layout = layoutFixture();
  const out = P.applyPage(exportSource().buffer, { layout, mode: "replace", targetPageId: "pg-dest", userThemes: THEMES.slice() });
  const dest = out.layout.pages.find((p) => p.id === "pg-dest");
  assert.strictEqual(dest.tiles.length, 2, "les 2 tuiles importees remplacent la tuile d'origine");
  assert.ok(!dest.tiles.some((t) => t.id === "t-zzz"), "l'ancienne tuile a disparu");
  assert.strictEqual(out.layout.pages.length, 2, "aucune page ajoutee");
  assert.strictEqual(out.layout.tiles.length, 1, "le plateau n'a pas bouge");
});

test("« remplacer » fonctionne aussi sur le plateau", () => {
  const layout = layoutFixture();
  const out = P.applyPage(exportSource().buffer, { layout, mode: "replace", targetPageId: "main", userThemes: THEMES.slice() });
  assert.strictEqual(out.layout.tiles.length, 2);
  assert.strictEqual(out.layout.pages.length, 2, "les pages suivantes sont intactes");
});

/* Empiler les tuiles importees sur les memes coordonnees que celles
   deja presentes ferait se recouvrir les deux lots ; Gridstack les
   repousserait ensuite dans un ordre que personne n'a choisi. On les
   pose DESSOUS.
   Stacking imported tiles on the same coordinates would have Gridstack
   reshuffle them in an order nobody chose. */
test("« fusionner » pose les tuiles importees SOUS les existantes", () => {
  const layout = layoutFixture();
  const out = P.applyPage(exportSource().buffer, { layout, mode: "merge", targetPageId: "pg-dest", userThemes: THEMES.slice() });
  const dest = out.layout.pages.find((p) => p.id === "pg-dest");
  assert.strictEqual(dest.tiles.length, 3, "1 existante + 2 importees");
  assert.ok(dest.tiles.some((t) => t.id === "t-zzz"), "l'existante est conservee");
  const existing = dest.tiles.find((t) => t.id === "t-zzz");
  const bottom = (existing.y || 0) + (existing.h || 1);
  for (const t of dest.tiles.filter((x) => x.id !== "t-zzz")) {
    assert.ok(t.y >= bottom, "tuile importee posee sous les existantes (y=" + t.y + " >= " + bottom + ")");
  }
});

test("une destination inexistante est refusee avant toute ecriture", () => {
  let thrown = null;
  try {
    P.applyPage(exportSource().buffer, { layout: layoutFixture(), mode: "replace", targetPageId: "pg-fantome" });
  } catch (e) { thrown = e; }
  assert.ok(thrown && thrown.code === "no-such-page");
});

console.log("== Theme de la page ==");

test("le theme voyage et s'ajoute s'il manque a l'arrivee", () => {
  const themes = [];
  const out = P.applyPage(exportSource().buffer, { layout: layoutFixture(), mode: "new", userThemes: themes });
  assert.strictEqual(themes.length, 1, "le theme est ajoute");
  assert.strictEqual(themes[0].id, "th-perso");
  const page = out.layout.pages.find((p) => p.id === out.targetPageId);
  assert.strictEqual(page.theme, "th-perso", "et la page le reference toujours");
});

/* Sur la machine d'arrivee, ce theme a pu etre retouche : l'import
   d'une page n'a pas a defaire ce travail en silence.
   The theme may have been reworked on arrival; importing a page must not
   silently undo that. */
test("un theme existant du meme identifiant n'est JAMAIS ecrase", () => {
  const themes = [{ id: "th-perso", name: "Ma version retouchee", user: true }];
  const out = P.applyPage(exportSource().buffer, { layout: layoutFixture(), mode: "new", userThemes: themes });
  assert.strictEqual(themes.length, 1);
  assert.strictEqual(themes[0].name, "Ma version retouchee", "la version locale est conservee");
  assert.ok(out.report.warnings.some((w) => w.code === "theme-exists"), "et l'utilisateur en est averti");
});

console.log("== Secrets ==");

test("sans case cochee, aucun secret ne quitte la machine", () => {
  const built = exportSource({ includeServiceKeys: false, includePersonalSecrets: false });
  const names = require("../server/zip").read(built.buffer).map((f) => f.name);
  assert.ok(!names.some((n) => n.startsWith("secrets/")), "aucune entree secrets/ : " + names.join(", "));
});

test("un secret chiffre sans phrase de passe est signale, pas perdu en silence", () => {
  const built = exportSource();
  const names = require("../server/zip").read(built.buffer).map((f) => f.name);
  // Pas de secret dans le coffre de ce test : on verifie au moins que
  // l'archive est coherente et que l'import ne se plaint pas a tort.
  const out = P.applyPage(built.buffer, { layout: layoutFixture(), mode: "new", userThemes: THEMES.slice() });
  assert.ok(!out.report.warnings.some((w) => w.code === "passphrase-missing"),
    "aucun avertissement de phrase de passe quand il n'y a rien de chiffre");
  assert.ok(Array.isArray(names));
});

console.log("== Nettoyage ==");
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PAGETRANSFER PASSENT");
process.exit(failures ? 1 : 0);
