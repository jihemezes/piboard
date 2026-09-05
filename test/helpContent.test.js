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
  /* Exclusivite : la fiche Windows ne doit pas decrire le MECANISME
     Linux (archive, retour arriere), et la fiche Linux ne doit pas
     decrire celui de Windows.
     Nuance apportee en 1.88.0 : depuis que le reglage de canal et le
     bouton de recherche valent pour les DEUX, la fiche Linux doit
     pouvoir nommer electron-updater pour dire ce que fait le bouton dans
     l'application de bureau -- l'ancienne regle l'interdisait et aurait
     force a taire la moitie de la reponse. Ce qui reste interdit, c'est
     de decrire le mecanisme lui-meme : latest.yml, l'installeur NSIS.
     Exclusivity: the Windows topic must not describe the Linux
     MECHANISM (archive, rollback), and the Linux topic must not describe
     Windows's.
     Nuance introduced in 1.88.0: now that the channel setting and the
     check button apply to BOTH, the Linux topic must be able to name
     electron-updater to say what the button does in the desktop
     application -- the old rule forbade it and would have forced half
     the answer to go unsaid. What stays forbidden is describing the
     mechanism itself: latest.yml, the NSIS installer. */
  const win = entryById("windows-app");
  assert.ok(!/previous\//.test(win.html.fr) && !/previous\//.test(win.html.en), "la fiche Windows ne decrit pas le retour arriere Linux");
  assert.ok(!/latest\.yml|NSIS/.test(e.html.fr) && !/latest\.yml|NSIS/.test(e.html.en), "la fiche Linux ne decrit pas le mecanisme Windows");
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

console.log("== Etat systeme : charge GPU documentee, y compris son absence sur Pi (1.83.0) ==");
{
  const e = entryById("system");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/nvidia-smi/.test(html), `${lang} : la source NVIDIA doit etre nommee`);
    assert.ok(/gpu_busy_percent/.test(html), `${lang} : la source AMD doit etre nommee`);
    assert.ok(/vcgencmd/.test(html), `${lang} : l'absence de mesure sur Pi doit etre expliquee, pas passee sous silence`);
    assert.ok(/help-opt-name">(Courbe d'utilisation du GPU|GPU usage chart)</.test(html),
      `${lang} : la courbe optionnelle doit figurer dans les options`);
  }
}
console.log("  OK");

console.log("== Axe des abscisses temporel documente (1.84.0) ==");
{
  const e = entryById("system");
  assert.ok(/graduations horaires/.test(e.html.fr), "fr : l'axe temporel doit etre explique");
  assert.ok(/time ticks/.test(e.html.en), "en : l'axe temporel doit etre explique");
  assert.ok(/échelle verticale est <b>fixée de 0 à 100/.test(e.html.fr),
    "fr : l'echelle verticale reste distinguee de l'axe des abscisses");
  assert.ok(/vertical scale is <b>fixed from 0 to 100/.test(e.html.en),
    "en : l'echelle verticale reste distinguee de l'axe des abscisses");
}
console.log("  OK");

console.log("== Canal des mises a jour documente (1.85.0) ==");
{
  const e = entryById("linux-update");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/Latest/.test(html), `${lang} : le libelle GitHub "Latest" doit etre cite tel quel`);
    assert.ok(/Pre-release/.test(html), `${lang} : le libelle GitHub "Pre-release" doit etre cite tel quel`);
    assert.ok(/(brouillon|draft)/.test(html), `${lang} : l'exclusion des brouillons doit etre dite`);
  }
  assert.ok(/Versions stables uniquement/.test(e.html.fr) && /Stable versions only/.test(e.html.en),
    "les deux choix doivent etre nommes comme dans l'interface");
}
console.log("  OK");

console.log("== Meteo : lever/coucher du soleil documente (1.86.0) ==");
{
  const e = entryById("weather");
  assert.ok(/help-opt-name">Afficher le lever et le coucher du soleil</.test(e.html.fr),
    "fr : l'option doit figurer parmi les reglages de la tuile");
  assert.ok(/help-opt-name">Show sunrise and sunset</.test(e.html.en),
    "en : l'option doit figurer parmi les reglages de la tuile");
  const u = entryById("linux-update");
  assert.ok(/application de bureau Windows, qui lit le même réglage/.test(u.html.fr),
    "fr : la portee du reglage de canal (serveur ET application Windows) doit etre dite");
  assert.ok(/Windows desktop application, which reads the same setting/.test(u.html.en),
    "en : la portee du reglage de canal doit etre dite");
}
console.log("  OK");

console.log("== Bouton de recherche et soleil de demain documentes (1.88.0) ==");
{
  const u = entryById("linux-update");
  assert.ok(/Rechercher des mises à jour/.test(u.html.fr) && /electron-updater/.test(u.html.fr),
    "fr : le bouton doit etre dit disponible dans les deux cas");
  assert.ok(/Check for updates/.test(u.html.en) && /electron-updater/.test(u.html.en),
    "en : le bouton doit etre dit disponible dans les deux cas");
  const w = entryById("weather");
  assert.ok(/demain/.test(w.html.fr), "fr : la ligne du soleil sur demain doit etre dite");
  assert.ok(/tomorrow's/.test(w.html.en), "en : la ligne du soleil sur demain doit etre dite");
}
console.log("  OK");

console.log("== Defilement automatique des pages documente (1.89.0) ==")
{
  const e = entryById("dashboard");
  assert.ok(/désactivée par défaut/.test(e.html.fr) && /off by default/.test(e.html.en),
    "le defaut (arret) doit etre dit : un tableau qui tourne seul sans qu'on l'ait demande surprendrait");
  assert.ok(/chaque page peut fixer la sienne/.test(e.html.fr) && /each page may set its own/.test(e.html.en),
    "la duree propre a chaque page doit etre expliquee");
  assert.ok(/mode édition/.test(e.html.fr) && /edit mode/.test(e.html.en),
    "la suspension pendant l'edition doit etre dite");
  assert.ok(/repart de zéro/.test(e.html.fr) && /restarts from zero/.test(e.html.en),
    "la remise a zero apres navigation manuelle doit etre dite");
}
console.log("  OK");

console.log("== Tuile Image : recadrage documente (1.90.0) ==")
{
  const e = entryById("image");
  assert.ok(/help-opt-name">Recadrer</.test(e.html.fr) && /help-opt-name">Crop</.test(e.html.en),
    "le cadrage \"Recadrer\" doit figurer parmi les cadrages");
  assert.ok(/fichier n'est pas modifié/.test(e.html.fr) && /file is not modified/.test(e.html.en),
    "le fait que le fichier reste intact doit etre dit : c'est ce qui rend l'operation reversible");
}
console.log("  OK");

console.log("== Tuile Image : recadrage direct documente (1.91.0) ==")
{
  const e = entryById("image");
  assert.ok(/recadrer directement sur l'image/.test(e.html.fr) && /crop directly on the image/.test(e.html.en),
    "la manipulation directe doit etre presentee comme le chemin principal");
  assert.ok(/tous les cadrages/.test(e.html.fr) && /every framing/.test(e.html.en),
    "le fait que zoom et positions valent pour tous les cadrages doit etre dit : c'est le defaut corrige");
  assert.ok(/mode édition/.test(e.html.fr) && /edit mode/.test(e.html.en),
    "le fait qu'elle n'existe qu'en mode edition doit etre dit");
  assert.ok(/pendant<\/b> le geste/.test(e.html.fr) && /while<\/b> you drag/.test(e.html.en),
    "l'affichage en direct est justement ce qui manquait : il doit etre dit");
  /* Le deplacement n'a d'effet qu'au-dessus de 100 % de zoom. Sans cette
     condition ecrite, le curseur laisse croire a un geste possible qui ne
     produit rien -- c'est ce qui a ete signale.
     Panning only has an effect above 100% zoom. Without that condition
     written down, the cursor suggests a possible gesture that produces
     nothing -- which is what was reported. */
  assert.ok(/au-dessus de 100 % de zoom/.test(e.html.fr) && /above 100% zoom/.test(e.html.en),
    "la condition du deplacement doit etre dite explicitement");
  assert.ok(/Tirer une poignée d'angle/.test(e.html.fr) && /Pulling a corner handle/.test(e.html.en),
    "chaque geste doit etre decrit avec sa condition");
}
console.log("  OK");

console.log("== Tuile Image : chemins reels vers le gestionnaire (1.91.3) ==")
{
  const e = entryById("image");
  /* L'aide annoncait que le petit bouton ouvrait le gestionnaire, alors
     que la surcouche de recadrage le recouvrait et que le clic ouvrait
     les reglages -- ou rien ne permet de changer d'image. Elle doit
     nommer les chemins qui marchent, et dire ce que la fenetre de
     reglages ne fait PAS.
     The help announced that the small button opened the manager, while
     the crop overlay covered it and the click opened the settings --
     where nothing lets you change the image. It must name the paths that
     work, and say what the settings window does NOT do. */
  assert.ok(/appareil photo/.test(e.html.fr) && /camera/.test(e.html.en),
    "le chemin reel (appareil photo de la barre d'outils) doit etre documente");
  assert.ok(/ne permet pas de choisir un fichier/.test(e.html.fr) && /does not let you pick a file/.test(e.html.en),
    "l'aide doit dire que la fenetre de reglages ne choisit pas de fichier");
}
console.log("  OK");

console.log("== Fond de page documente (1.93.0) ==")
{
  const e = entryById("dashboard");
  for (const [lang, html] of [["fr", e.html.fr], ["en", e.html.en]]) {
    assert.ok(/data\//.test(html), `${lang} : le stockage local doit etre dit`);
    assert.ok(/(propre dossier|own folder)/.test(html),
      `${lang} : le cloisonnement par page doit etre dit -- supprimer une page ne doit pas effacer un autre fond`);
  }
  /* Le voile est ce qui rend le fond utilisable : sans lui, une photo
     contrastee rend les tuiles transparentes illisibles.
     The veil is what makes the background usable: without it, a
     contrasted photo makes transparent tiles unreadable. */
  assert.ok(/Voile sur l'image/.test(e.html.fr) && /Veil over the image/.test(e.html.en),
    "le voile doit etre documente avec son role de lisibilite");
  assert.ok(/mode classique/.test(e.html.fr) && /classic mode/.test(e.html.en),
    "la portee (page 1 = plateau du mode classique) doit etre dite");
}
console.log("  OK");

console.log("Tous les tests d'aide sont passes.");
