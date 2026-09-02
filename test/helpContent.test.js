/* Verifie que les fiches d'aide couvrent bien les fonctionnalites
   livrees, et surtout qu'elles le font DANS LES DEUX LANGUES. Une
   section ajoutee en francais et oubliee en anglais est une erreur
   silencieuse : rien ne casse, la fiche anglaise est simplement plus
   pauvre, et ca ne se remarque qu'en changeant la langue de
   l'interface. Ce test rend cet oubli bruyant. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* help-content.js est un script navigateur : on l'evalue dans un bac a
   sable muni d'un objet window minimal, plutot que de le require(). */
const src = fs.readFileSync(path.join(__dirname, "..", "public", "help-content.js"), "utf8");
const sandbox = { window: {}, document: undefined };
sandbox.self = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const HELP = sandbox.window.PIBOARD_HELP;
assert.ok(HELP, "help-content.js doit exposer son contenu sur window");
const entries = Array.isArray(HELP) ? HELP : (HELP.entries || HELP.topics || []);
assert.ok(entries.length > 0, "au moins une fiche d'aide");

function entryById(id) {
  const e = entries.find((x) => x.id === id);
  assert.ok(e, `fiche d'aide manquante : ${id}`);
  return e;
}

console.log("== Toutes les fiches sont bilingues ==");
let checked = 0;
for (const e of entries) {
  assert.ok(e.title && e.title.fr && e.title.en, `titre FR/EN manquant : ${e.id}`);
  // Certaines fiches (le demarrage rapide) tirent leur contenu d'un
  // autre fichier et n'ont pas de bloc html ici : on ne les compare pas.
  if (!e.html || !e.html.fr || !e.html.en) continue;
  checked++;
  // Un contenu anglais tres court face a un francais long trahit
  // generalement une section ajoutee d'un seul cote.
  const ratio = e.html.en.length / e.html.fr.length;
  assert.ok(ratio > 0.5 && ratio < 2,
    `desequilibre FR/EN suspect sur "${e.id}" (rapport ${ratio.toFixed(2)}) : une section a-t-elle ete ajoutee dans une seule langue ?`);
}
console.log(`  OK   ${checked} fiches comparees sur ${entries.length}`);

console.log("== Analyse reseau : les noms personnalises sont documentes (1.79.0) ==");
{
  const e = entryById("networkscan");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/netHosts\.json/.test(html), `${lang} : le fichier de persistance doit etre nomme`);
    assert.ok(/MAC/.test(html), `${lang} : la cle MAC doit etre expliquee`);
    assert.ok(/help-opt-name">(Renommer un appareil|Rename a device)</.test(html),
      `${lang} : le renommage doit figurer dans la liste des options`);
  }
  assert.ok(/réinstallation/.test(e.html.fr), "fr : la conservation apres reinstallation doit etre dite");
  assert.ok(/reinstall/i.test(e.html.en), "en : la conservation apres reinstallation doit etre dite");
}
console.log("  OK");

console.log("== Classement : colonnes et sports mecaniques documentes (1.80.0) ==");
{
  const e = entryById("standings");
  assert.ok(/Lire le tableau/.test(e.html.fr), "fr : section de lecture du tableau");
  assert.ok(/Reading the table/.test(e.html.en), "en : section de lecture du tableau");
  assert.ok(/Sports mécaniques/.test(e.html.fr), "fr : section sports mecaniques");
  assert.ok(/Motorsport/.test(e.html.en), "en : section sports mecaniques");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/MotoGP/.test(html), `${lang} : MotoGP mentionne`);
    assert.ok(/F1|Formul/.test(html), `${lang} : F1 mentionnee`);
    assert.ok(/Pts/.test(html), `${lang} : la colonne des points doit etre expliquee`);
    // Le total equipes MotoGP est un calcul, pas une donnee officielle :
    // cette reserve DOIT figurer dans l'aide, dans les deux langues.
    assert.ok(/calculé|computed/i.test(html),
      `${lang} : la reserve sur le calcul des totaux equipes MotoGP doit etre presente`);
  }
  assert.ok(/MotoGP/.test(e.sub.fr) && /MotoGP/.test(e.sub.en), "sous-titre a jour dans les deux langues");
}
console.log("  OK");

/* Une section peut tres bien exister quelque part dans le fichier tout
   en ayant ete inseree dans la MAUVAISE fiche : l'aide affichee est
   alors incoherente (un paragraphe sur la F1 sous la fiche des scores),
   sans qu'aucune verification de simple presence ne s'en apercoive.
   C'est arrive lors de la redaction de la 1.80.0, l'ancre utilisee pour
   l'insertion existant aussi dans une fiche voisine. On verifie donc que
   les sections caracteristiques n'apparaissent QUE dans leur fiche. */
console.log("== Chaque section est dans SA fiche, et nulle part ailleurs ==");
{
  const EXCLUSIVE = [
    ["standings", ["Lire le tableau", "Reading the table"]],
    ["networkscan", ["netHosts.json"]]
  ];
  for (const [id, markers] of EXCLUSIVE) {
    for (const marker of markers) {
      const owners = entries.filter(
        (e) => e.html && ((e.html.fr || "").includes(marker) || (e.html.en || "").includes(marker))
      );
      assert.strictEqual(owners.length, 1,
        `"${marker}" apparait dans ${owners.length} fiches (${owners.map((o) => o.id).join(", ")}) au lieu de la seule "${id}"`);
      assert.strictEqual(owners[0].id, id, `"${marker}" se trouve dans "${owners[0].id}" au lieu de "${id}"`);
    }
  }
}
console.log("  OK");

/* Et symetriquement : la section doit se trouver du bon COTE, dans le
   bloc de la bonne langue. Une section francaise glissee dans le bloc
   anglais passerait les tests precedents. */
console.log("== Chaque section est dans le bloc de sa langue ==");
{
  const e = entryById("standings");
  assert.ok(e.html.fr.includes("Lire le tableau") && !e.html.en.includes("Lire le tableau"),
    "la section francaise doit etre dans le bloc francais, et lui seul");
  assert.ok(e.html.en.includes("Reading the table") && !e.html.fr.includes("Reading the table"),
    "la section anglaise doit etre dans le bloc anglais, et lui seul");
  assert.ok(e.html.fr.includes("Sports mécaniques") && !e.html.fr.includes("<h4>Motorsport</h4>"),
    "fr : section mecanique en francais uniquement");
  assert.ok(e.html.en.includes("<h4>Motorsport</h4>"), "en : section mecanique presente");
}
console.log("  OK");


console.log("== Mises a jour Linux : la fiche existe et couvre le cycle dans les deux langues (1.81.0) ==");
{
  const e = entryById("linux-update");
  assert.strictEqual(e.group, "platform", "rangee avec les fiches de plateforme");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/data\/updates\//.test(html), `${lang} : le dossier de travail doit etre nomme`);
    assert.ok(/previous\//.test(html), `${lang} : le retour arriere (previous/) doit etre explique`);
    assert.ok(/package-lock\.json/.test(html), `${lang} : la condition de npm install doit etre dite`);
    assert.ok(/PIBOARD_UPDATE_CHECK=0/.test(html), `${lang} : la variable de desactivation doit etre documentee`);
    assert.ok(/systemd/.test(html), `${lang} : le redemarrage via systemd doit etre mentionne`);
    assert.ok(/<code>data\/<\/code>/.test(html), `${lang} : la conservation de data/ doit etre dite`);
  }
  assert.ok(/Plus tard/.test(e.html.fr) && /Later/.test(e.html.en), "le bouton du bandeau est nomme dans les deux langues");
  // Exclusivite : la fiche Windows ne doit pas decrire le mecanisme Linux, et inversement.
  // Exclusivity: the Windows topic must not describe the Linux mechanism, and vice versa.
  const win = entryById("windows-app");
  assert.ok(!/previous\//.test(win.html.fr) && !/previous\//.test(win.html.en), "la fiche Windows ne decrit pas le retour arriere Linux");
  assert.ok(!/latest\.yml|electron-updater/.test(e.html.fr) && !/latest\.yml|electron-updater/.test(e.html.en), "la fiche Linux ne decrit pas le mecanisme Windows");
}
console.log("  OK");

console.log("== Etat systeme : IP publique et couleurs/seuils documentees (1.82.0) ==");
{
  const e = entryById("system");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/help-opt-name">(Afficher l'adresse IP publique|Show the public IP address)</.test(html), `${lang} : option IP publique listee`);
    assert.ok(/help-opt-name">(Couleur des courbes|Chart color)</.test(html), `${lang} : couleur des courbes listee`);
    assert.ok(/65\s?%/.test(html) && /85\s?%/.test(html), `${lang} : seuils par defaut cites`);
    assert.ok(/(réservé|reserved)/.test(html), `${lang} : le rouge reserve au critique est dit`);
  }
}
console.log("  OK");

console.log("Tous les tests d'aide sont passes.");
