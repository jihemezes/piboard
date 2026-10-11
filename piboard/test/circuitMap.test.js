/* Test du PLAN DU CIRCUIT (tuile « Plan du circuit », 1.139.0).

   La geometrie a d'abord vecu dans la tuile Formule 1, puis a demenage
   dans sa propre tuile avec la base des circuits. Le test l'a suivie :
   ce sont les memes verifications, sur le meme code, a la meme place
   que lui.

   Ce qui est verifie ici n'est pas « le code tourne » mais les quatre
   decisions dont une erreur donnerait une carte credible et fausse :
   la carte serait dessinee, elle ressemblerait a un circuit, et
   personne ne verrait le probleme.

   1. LE NORD EN HAUT. La latitude croit vers le nord, l'axe Y d'un SVG
      vers le bas. Oublier l'inversion dessine le circuit EN MIROIR --
      assez ressemblant pour passer inapercu, et completement faux.
   2. LES PROPORTIONS. Un degre de longitude est plus court qu'un degre
      de latitude des qu'on quitte l'equateur. Sans la correction en
      cosinus, Silverstone sort deux fois trop large.
   3. LE KARTING DEHORS. La piste de karting voisine porte le meme
      `highway=raceway` : l'inclure collerait une seconde piste au
      milieu du Grand Prix.
   4. LE SENS DE LA COURSE. La fleche doit suivre le tronçon, pas une
      direction supposee. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = {
  window: { PiBoard: { registerWidget() { } } },
  navigator: { language: "fr-FR" },
  document: { createElement: () => ({ setAttribute() { }, style: {} }) },
  CSS: { escape: (x) => String(x) },
  setInterval: () => 0, clearInterval() { }, setTimeout: () => 0, clearTimeout() { },
  fetch: () => Promise.reject(new Error("aucun reseau dans ce test")),
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + "/../public/widgets/circuit/widget.js", "utf8"), sandbox);
const H = sandbox.window.PiBoardCircuitHelpers;
assert.ok(H && H.parseCircuit, "les fonctions pures du plan doivent etre exposees");

/* Reponse Overpass calquee sur le vrai service (verifie sur Sepang :
   30 « ways », dont du karting, une voie des stands et des virages
   nommes). Les coordonnees sont choisies pour que le resultat attendu
   soit calculable a la main. */
const OVERPASS = {
  elements: [
    {
      type: "way", tags: { highway: "raceway", name: "Main Straight", oneway: "yes", sport: "motor" },
      geometry: [{ lat: 1.000, lon: 10.000 }, { lat: 1.000, lon: 10.010 }]
    },
    {
      type: "way", tags: { highway: "raceway", name: "Berjaya Tioman Corner", oneway: "yes" },
      geometry: [{ lat: 1.000, lon: 10.010 }, { lat: 1.005, lon: 10.010 }, { lat: 1.010, lon: 10.010 }]
    },
    {
      /* La voie des stands part d'un noeud de la piste : sans ce
         raccord elle formerait un groupe a part, et le filtre du
         circuit principal l'ecarterait -- a juste titre.
         The pit lane starts from a track node; without that join it
         would form its own group and the main-circuit filter would
         drop it -- rightly so. */
      type: "way", tags: { highway: "raceway", name: "Pit Lane" },
      geometry: [{ lat: 1.000, lon: 10.000 }, { lat: 1.001, lon: 10.004 }, { lat: 1.000, lon: 10.010 }]
    },
    {
      type: "way", tags: { highway: "raceway", name: "Kart Circuit", sport: "karting" },
      geometry: [{ lat: 1.200, lon: 10.200 }, { lat: 1.200, lon: 10.260 }]
    },
    { type: "node", lat: 1, lon: 10 },
    { type: "way", tags: { highway: "raceway" }, geometry: [{ lat: 1, lon: 10 }] }
  ]
};

console.log("== parseCircuit : le karting reste dehors ==");
const ways = H.parseCircuit(OVERPASS);
assert.ok(!ways.some((w) => /kart/i.test(w.name)),
  "le karting porte highway=raceway mais n'est pas le Grand Prix");
assert.strictEqual(ways.length, 3, "trois tronçons retenus : piste, virage, stands");
assert.ok(!ways.some((w) => w.pts.length < 2),
  "un tronçon d'un seul point ne se dessine pas et ne doit pas etre retenu");
console.log("  OK");

console.log("== parseCircuit : stands et virages reconnus par leur nom ==");
const pit = ways.find((w) => w.pit);
assert.ok(pit && /pit/i.test(pit.name), "la voie des stands est marquee comme telle");
assert.strictEqual(pit.corner, false, "la voie des stands n'est pas un virage");
assert.ok(ways.find((w) => w.name === "Berjaya Tioman Corner").corner,
  "un virage nomme par OSM est reconnu");
assert.ok(ways.find((w) => w.name === "Main Straight").oneway, "oneway=yes est lu");
console.log("  OK");

console.log("== parseCircuit : une reponse vide ne jette pas ==");
assert.strictEqual(H.parseCircuit(null).length, 0, "Overpass en panne = carte vide, pas d'exception");
assert.strictEqual(H.parseCircuit({}).length, 0);
assert.strictEqual(H.parseCircuit({ elements: "pas un tableau" }).length, 0);
console.log("  OK");

console.log("== projectCircuit : LE NORD EST EN HAUT ==");
const W = 1000, H0 = 620, PAD = 20;
const xy = H.projectCircuit(ways, W, H0, PAD);
const all = [];
for (const w of xy) for (let i = 0; i < w.pts.length; i++) all.push({ lat: w.pts[i][0], y: w.xy[i][1] });
const north = all.reduce((a, b) => (b.lat > a.lat ? b : a));
const south = all.reduce((a, b) => (b.lat < a.lat ? b : a));
assert.ok(north.y < south.y,
  "le point le plus au NORD doit avoir le Y le plus PETIT : sinon le circuit est dessine en miroir");
console.log("  OK");

console.log("== projectCircuit : le dessin tient dans le cadre, marge comprise ==");
for (const w of xy) for (const [x, y] of w.xy) {
  assert.ok(x >= PAD - 0.01 && x <= W - PAD + 0.01, "x dans le cadre : " + x);
  assert.ok(y >= PAD - 0.01 && y <= H0 - PAD + 0.01, "y dans le cadre : " + y);
}
console.log("  OK");

console.log("== projectCircuit : la correction en COSINUS des longitudes ==");
/* Meme circuit carre, place a l'equateur puis a 60 degres nord. A 60
   degres, cos(60) = 0.5 : un degre de longitude n'y vaut plus qu'un
   demi-degre de latitude. Le carre doit donc sortir deux fois moins
   LARGE que haut -- faute de quoi tous les circuits d'Europe du Nord
   sont etires. */
const square = (lat) => H.parseCircuit({
  elements: [{
    type: "way", tags: { highway: "raceway" },
    geometry: [{ lat: lat, lon: 0 }, { lat: lat, lon: 1 }, { lat: lat + 1, lon: 1 }, { lat: lat + 1, lon: 0 }, { lat: lat, lon: 0 }]
  }]
});
const span = (ws) => {
  const pts = ws[0].xy;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const eq = span(H.projectCircuit(square(0), 1000, 1000, 0));
assert.ok(Math.abs(eq.w / eq.h - 1) < 0.02, "a l'equateur, un carre reste carre");
const nordique = span(H.projectCircuit(square(59.5), 1000, 1000, 0));
assert.ok(Math.abs(nordique.w / nordique.h - 0.5) < 0.03,
  "a 60 degres nord, un degre de longitude vaut un demi-degre de latitude : ratio attendu 0,5, obtenu " + (nordique.w / nordique.h).toFixed(3));
console.log("  OK");

console.log("== projectCircuit : rien a dessiner ==");
assert.strictEqual(H.projectCircuit([], 1000, 620, 20), null, "aucun tronçon : la carte le dit, elle n'invente pas");
console.log("  OK");

console.log("== directionArrow : la fleche suit le tronçon, pas une supposition ==");
const arrow = H.directionArrow(xy);
assert.ok(arrow, "un tronçon a sens unique existe : la fleche doit etre posee");
assert.ok(Number.isFinite(arrow.angle) && Number.isFinite(arrow.x) && Number.isFinite(arrow.y));
/* Ligne droite vers l'EST, donc vers la droite de l'ecran : angle 0. */
const east = H.projectCircuit(H.parseCircuit({
  elements: [{
    type: "way", tags: { highway: "raceway", oneway: "yes" },
    geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]
  }]
}), 1000, 620, 0);
assert.ok(Math.abs(H.directionArrow(east).angle) < 0.01,
  "un tronçon parcouru vers l'est pointe a 0 degre");
/* Meme geometrie parcourue en sens INVERSE : la fleche doit se
   retourner. C'est tout l'interet de `oneway` -- une fleche qui ne
   change pas avec le sens ne sert a rien. */
const west = H.projectCircuit(H.parseCircuit({
  elements: [{
    type: "way", tags: { highway: "raceway", oneway: "yes" },
    geometry: [{ lat: 0, lon: 2 }, { lat: 0, lon: 1 }, { lat: 0, lon: 0 }]
  }]
}), 1000, 620, 0);
assert.ok(Math.abs(Math.abs(H.directionArrow(west).angle) - 180) < 0.01,
  "le meme trait parcouru en sens inverse pointe a 180 degres");
console.log("  OK");

console.log("== directionArrow : la voie des stands ne donne jamais le sens ==");
const onlyPit = H.projectCircuit(H.parseCircuit({
  elements: [{
    type: "way", tags: { highway: "raceway", name: "Pit Lane", oneway: "yes" },
    geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }]
  }]
}), 1000, 620, 0);
assert.strictEqual(H.directionArrow(onlyPit), null,
  "les stands sont a sens unique eux aussi : s'en servir indiquerait le sens de l'entree des stands, pas celui de la course");
console.log("  OK");

console.log("== overpassUrl : la requete demande bien la geometrie ==");
const url = H.overpassUrl(2.76083, 101.738);
assert.ok(url.startsWith("https://overpass-api.de/api/interpreter?data="), "point d'entree Overpass");
const q = decodeURIComponent(url.split("data=")[1]);
assert.ok(/out:json/.test(q), "reponse en JSON");
assert.ok(/highway=raceway/.test(q), "on ne demande que des pistes");
assert.ok(/out geom/.test(q),
  "« out geom » est indispensable : sans lui Overpass renvoie des numeros de noeuds et aucune coordonnee");
assert.ok(/around:\d+,2\.76083,101\.738/.test(q), "centre sur le circuit, rayon borne");
assert.ok(/timeout:\d+/.test(q), "un timeout, pour ne pas laisser une requete lourde pendre indefiniment");
console.log("  OK");

console.log("\nTous les tests du plan du circuit passent.");

/* ============================================================
   SUR LA DONNEE REELLE DE SEPANG (relevee sur overpass-api.de et figee
   dans test/fixtures/overpass-sepang.json).

   Un echantillon ecrit a la main ne prouve que ce qu'on y a mis. Celui-
   ci porte ce qu'Overpass renvoie VRAIMENT autour d'un circuit de
   Formule 1, et chacune des trois surprises qu'il contenait a change le
   code :

   1. Le complexe comporte un « Handling Circuit » -- une piste d'essais,
      bitumee, `sport=motor`, donc impossible a ecarter par ses
      etiquettes -- a plusieurs centaines de metres au nord. La dessiner
      n'ajoutait pas qu'une tache : elle agrandissait le cadre commun, et
      le Grand Prix se retrouvait ecrase dans un coin.
   2. Il contient aussi du karting ET un circuit de motocross sur terre,
      tous deux en `highway=raceway`.
   3. LES NUMEROS DE VIRAGES EXISTENT. J'avais annonce le contraire. OSM
      porte ici des tronçons nommes « 3 », « 10 », « 12 », « 13 », « 15 »
      a cote des virages nommes. Ce sont les SECTEURS, et eux seuls, qui
      ne sont publies nulle part.
   ============================================================ */
const SEPANG = JSON.parse(fs.readFileSync(__dirname + "/fixtures/overpass-sepang.json", "utf8"));

console.log("\n== Sepang : 30 tronçons bruts, le Grand Prix seul retenu ==");
assert.strictEqual(SEPANG.elements.length, 30, "le releve brut compte 30 tronçons");
const sepang = H.parseCircuit(SEPANG);
const names = sepang.map((w) => w.name);
assert.ok(!names.includes("Handling Circuit"),
  "la piste d'essais est bitumee et sport=motor : seule la geometrie peut l'ecarter");
assert.ok(sepang.length > 20 && sepang.length < 30,
  "le circuit principal garde l'essentiel sans tout prendre, obtenu " + sepang.length);
console.log("  OK (" + sepang.length + " tronçons sur 30)");

console.log("== Sepang : le karting et le motocross sur terre sont ecartes ==");
const raw = SEPANG.elements.filter((e) => /karting|motocross/.test((e.tags || {}).sport || ""));
assert.strictEqual(raw.length, 3, "le releve contient bien 3 tronçons d'autres disciplines");
for (const e of raw) {
  assert.ok(!sepang.some((w) => w.pts.length === e.geometry.length
    && w.pts[0][0] === Number(e.geometry[0].lat)), "tronçon d'une autre discipline retenu a tort");
}
console.log("  OK");

console.log("== Sepang : la voie des stands est complete ==");
/* Trois tronçons, dont deux se raccordent au MILIEU d'une portion de
   piste : la premiere version, qui ne reliait que les extremites, en
   perdait deux. */
assert.strictEqual(sepang.filter((w) => w.pit).length, 3,
  "les trois tronçons de la voie des stands doivent survivre au filtre");
console.log("  OK");

console.log("== Sepang : NUMEROS de virages ET noms, les uns comme les autres ==");
const labels = sepang.filter((w) => w.corner && !w.pit).map((w) => w.name);
for (const n of ["3", "10", "12", "13", "15"]) {
  assert.ok(labels.includes(n), "le numero de virage « " + n + " » est dans OSM et doit etre affiche");
}
for (const n of ["Genting Curve", "Berjaya Tioman Corner", "Kenyir Lake Corner", "Pangkor Laut Chicane", "KLIA Curve"]) {
  assert.ok(labels.includes(n), "le virage nomme « " + n + " » doit etre reconnu");
}
assert.ok(!labels.some((n) => /straight|circuit/i.test(n)),
  "une ligne droite n'est pas un virage : " + labels.join(", "));
console.log("  OK (" + labels.length + " virages : " + labels.join(", ") + ")");

console.log("== Sepang : le dessin reste dans son cadre, etiquettes comprises ==");
const SW = 1000, SH = 620, PX = 96, PY = 34;
for (const w of H.projectCircuit(sepang, SW, SH, PX, PY)) for (const [x, y] of w.xy) {
  assert.ok(x >= PX - 0.01 && x <= SW - PX + 0.01, "x hors cadre : " + x);
  assert.ok(y >= PY - 0.01 && y <= SH - PY + 0.01, "y hors cadre : " + y);
}
console.log("  OK");

console.log("== Sepang : le sens de la course est determine ==");
const sa = H.directionArrow(H.projectCircuit(sepang, SW, SH, PX, PY));
assert.ok(sa && Number.isFinite(sa.angle), "la fleche doit etre posee sur un circuit reel");
console.log("  OK");

console.log("\nTous les tests du plan du circuit passent, donnee reelle comprise.");
