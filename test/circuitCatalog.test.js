/* Test de la BASE DES CIRCUITS (server/circuitCatalog.js, 1.139.0).

   CE QUE CETTE VALIDATION PROTEGE n'est pas la meme chose que pour le
   catalogue des services. Celui-la dicte des ADRESSES que le serveur
   ira interroger : le risque etait qu'un depot compromis fasse sonder
   le reseau interne de chaque personne. La base des circuits, elle, ne
   porte aucune adresse -- uniquement des coordonnees. Le risque n'est
   donc pas le reseau mais le DESSIN :

     - une latitude a 900 degres, ou une chaine la ou on attend un
       nombre, et le trace sort du cadre ou ne sort pas du tout ;
     - une seule coordonnee aberrante -- un signe oublie, une latitude et
       une longitude interverties -- et le cadrage s'etire sur un
       continent : le circuit devient un point, sans qu'aucune donnee
       ne soit « invalide » au sens strict. C'est le cas le plus
       sournois, et celui qui justifie le controle d'etendue ;
     - un tableau de cent mille points, et le navigateur du kiosque
       fige.

   Et comme pour le catalogue des services, la base est acceptee ou
   rejetee EN BLOC : une base a moitie bonne serait pire qu'une base
   refusee, parce que personne ne saurait quelle moitie. */
"use strict";
const assert = require("assert");
const cat = require("../server/circuitCatalog");

const OK = {
  version: 3,
  circuits: {
    sepang: {
      name: "Sepang International Circuit",
      specs: { lengthM: 5543, turns: 15, laps: 56 },
      ways: [
        { n: "Penang Straight", o: 1, p: [[2.75897, 101.73382], [2.76032, 101.74132]] },
        { n: "Pit Lane", p: [[2.7606, 101.74159], [2.76151, 101.7409]] }
      ]
    }
  }
};

const clone = (o) => JSON.parse(JSON.stringify(o));

console.log("== une base correcte est acceptee ==");
const good = cat.validateCatalog(OK);
assert.ok(good.ok, "base valide : " + good.reason);
assert.strictEqual(good.count, 1);
assert.strictEqual(good.version, 3);
console.log("  OK");

console.log("== une base qui n'en est pas une est refusee ==");
for (const bad of [null, undefined, 42, "texte", [], {}, { circuits: null }, { circuits: [] }, { circuits: {} }]) {
  assert.ok(!cat.validateCatalog(bad).ok, "doit etre refuse : " + JSON.stringify(bad));
}
console.log("  OK");

console.log("== un circuit sans nom ou sans trace est refuse ==");
{
  const c = clone(OK); delete c.circuits.sepang.name;
  assert.ok(!cat.validateCatalog(c).ok, "sans nom");
}
{
  const c = clone(OK); delete c.circuits.sepang.ways;
  assert.ok(!cat.validateCatalog(c).ok, "sans trace");
}
{
  const c = clone(OK); c.circuits.sepang.ways[0].p = [[2.75, 101.73]];
  assert.ok(!cat.validateCatalog(c).ok, "un tronçon d'un seul point ne se dessine pas");
}
console.log("  OK");

console.log("== une coordonnee qui n'est pas un nombre est refusee ==");
/* Le piege : "2.75" est vrai en JavaScript des qu'on le compare, et
   passerait un controle de bornes ecrit a la legere. Le TYPE est donc
   verifie, pas seulement la valeur. */
for (const p of [["2.75", 101.73], [2.75, "101.73"], [null, 101.73], [2.75], [2.75, 101.73, 0], "2.75,101.73", {}]) {
  const c = clone(OK);
  c.circuits.sepang.ways[0].p[0] = p;
  assert.ok(!cat.validateCatalog(c).ok, "doit etre refuse : " + JSON.stringify(p));
}
console.log("  OK");

console.log("== une coordonnee hors bornes est refusee ==");
for (const p of [[91, 101.73], [-91, 101.73], [2.75, 181], [2.75, -181], [NaN, 101.73], [2.75, Infinity]]) {
  const c = clone(OK);
  c.circuits.sepang.ways[0].p[0] = p;
  assert.ok(!cat.validateCatalog(c).ok, "doit etre refuse : " + JSON.stringify(p));
}
console.log("  OK");

console.log("== UN TRACE ETALE SUR UN CONTINENT N'EST PAS UN CIRCUIT ==");
/* Le cas sournois : chaque coordonnee est parfaitement valide, mais
   l'une d'elles a sa latitude et sa longitude interverties. Sans ce
   controle, le cadrage s'etire sur des milliers de kilometres et le
   circuit se reduit a un point -- un dessin vide, sans la moindre
   donnee « invalide ». */
{
  const c = clone(OK);
  /* Un point parfaitement valide, mais a quarante degres de la : une
     faute de saisie plausible (un chiffre change) qu'aucun controle de
     bornes ne peut voir. */
  c.circuits.sepang.ways.push({ p: [[2.76, 101.74], [42.76, 101.74]] });
  const r = cat.validateCatalog(c);
  assert.ok(!r.ok, "un point a quarante degres : le trace s'etend sur un continent");
  assert.ok(/etendu/.test(r.reason), "la raison doit nommer l'etendue, et non un type : " + r.reason);
}
{
  /* Un circuit reel reste accepte : le plus long du monde, la
     Nordschleife, fait 21 km -- trois centiemes de degre. La borne est
     large pour la realite et serree pour l'absurde. */
  const c = clone(OK);
  c.circuits.sepang.ways.push({ p: [[2.70, 101.70], [2.90, 101.90]] });
  assert.ok(cat.validateCatalog(c).ok, "un circuit de 20 km doit passer");
}
console.log("  OK");

console.log("== une base demesuree est refusee avant d'etre chargee ==");
{
  const c = clone(OK);
  c.circuits.sepang.ways[0].p = new Array(5000).fill([2.75, 101.73]);
  assert.ok(!cat.validateCatalog(c).ok, "un tronçon de 5000 points figerait le kiosque");
}
{
  const c = { version: 1, circuits: {} };
  for (let i = 0; i < 400; i++) c.circuits["c" + i] = clone(OK.circuits.sepang);
  assert.ok(!cat.validateCatalog(c).ok, "400 circuits : ce n'est plus une base de calendrier");
}
console.log("  OK");

console.log("== la fiche technique est facultative, mais doit etre un objet ==");
{
  const c = clone(OK); delete c.circuits.sepang.specs;
  assert.ok(cat.validateCatalog(c).ok, "un circuit sans fiche reste valide : le trace suffit");
}
{
  const c = clone(OK); c.circuits.sepang.specs = "5.5 km";
  assert.ok(!cat.validateCatalog(c).ok, "une fiche qui n'est pas un objet est refusee");
}
console.log("  OK");

console.log("== un circuit SANS trace est accepte s'il se declare incomplet ==");
/* Plusieurs circuits du calendrier empruntent des routes ouvertes a la
   circulation. Ils entrent dans la base avec leur fiche technique et
   `incomplete: true`, pour que la tuile explique au lieu de se taire --
   mais un trace vide SANS cet indicateur reste une anomalie, puisque
   rien ne le distinguerait d'un oubli. */
{
  const c = clone(OK);
  c.circuits.monaco = { name: "Circuit de Monaco", ways: [], incomplete: true, specs: { lengthM: 3337 } };
  assert.ok(cat.validateCatalog(c).ok, "un circuit declare incomplet garde sa fiche et sa place");
}
{
  const c = clone(OK);
  c.circuits.monaco = { name: "Circuit de Monaco", ways: [] };
  const r = cat.validateCatalog(c);
  assert.ok(!r.ok, "un trace vide sans indicateur est un oubli, pas une intention");
  assert.ok(/incomplete/.test(r.reason), "la raison doit nommer l'indicateur manquant : " + r.reason);
}
console.log("  OK");

console.log("== LES TRACES DE LA BASE ONT LA BONNE LONGUEUR ==");
/* LE CONTROLE QUI COMPTE VRAIMENT, et celui qui a rattrape une erreur
   de ma part. J'avais compte les « troncons » renvoyes par OSM pour
   declarer un circuit couvert : Monaco en avait onze, donc Monaco
   etait bon. Faux. Ces onze troncons totalisent CINQUANTE METRES sur
   un tour de 3 337 -- le reste du tour emprunte des routes publiques,
   qu'OpenStreetMap ne distingue pas de la voirie ordinaire. Le dessin
   obtenu etait joli, et n'etait pas Monaco.
   Compter des troncons ne prouve rien ; mesurer, si. Chaque trace de
   la base est donc confronte a la longueur REELLE du tour, qui vient
   de la fiche technique et non d'OSM.
   THE CHECK THAT MATTERS, and the one that caught a mistake of mine. I
   had counted the "ways" OSM returned to declare a circuit covered:
   Monaco had eleven, so Monaco was fine. Wrong. Those eleven total
   FIFTY METRES of a 3,337-metre lap. Counting ways proves nothing;
   measuring does. */
{
  const fs = require("fs");
  const embedded = JSON.parse(fs.readFileSync(cat.EMBEDDED_PATH, "utf8"));
  const R = 6371000, rad = (d) => d * Math.PI / 180;
  const segLen = (pts) => {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [c2, e] = pts[i];
      d += Math.hypot(rad(e - b) * Math.cos(rad((a + c2) / 2)), rad(c2 - a)) * R;
    }
    return d;
  };
  const PIT = /(pit ?lane|voie des stands|sortie des stands|boxes)/i;
  const bad = [];
  let measured = 0;
  for (const id of Object.keys(embedded.circuits)) {
    const c = embedded.circuits[id];
    if (!c.ways.length) {
      assert.ok(c.incomplete === true, id + " : trace vide, il doit se declarer incomplet");
      continue;
    }
    const real = c.specs && c.specs.lengthM;
    assert.ok(Number.isFinite(real),
      id + " : un trace publie doit porter sa longueur reelle, faute de quoi il est invérifiable");
    const drawn = c.ways.filter((w) => !PIT.test(w.n || "")).reduce((a, w) => a + segLen(w.p), 0);
    const ratio = drawn / real;
    measured++;
    if (ratio < 0.85 || ratio > 1.6) bad.push(id + " (" + Math.round(drawn) + " m / " + real + " m, ratio " + ratio.toFixed(2) + ")");
  }
  assert.deepStrictEqual(bad, [],
    "ces traces ne correspondent pas a la longueur reelle du tour : " + bad.join(", "));
  assert.ok(measured >= 10, "la base doit porter plusieurs traces mesures, obtenu " + measured);
  console.log("  OK (" + measured + " traces mesures contre leur longueur reelle)");
}

console.log("== la base livree avec la version est valide ==");
{
  const fs = require("fs");
  const embedded = JSON.parse(fs.readFileSync(cat.EMBEDDED_PATH, "utf8"));
  const r = cat.validateCatalog(embedded);
  assert.ok(r.ok, "la base livree doit passer sa propre validation : " + r.reason);
  assert.ok(r.count >= 1, "elle doit porter au moins un circuit");
  assert.ok(Number(embedded.version) > 0, "elle doit porter un numero de version, sans quoi le distant ne pourrait jamais la depasser");
  /* L'ATTRIBUTION EST DANS LE FICHIER, et pas seulement dans l'ecran.
     OpenStreetMap est sous ODbL : la source voyage avec la donnee. */
  assert.ok(/OpenStreetMap/i.test(JSON.stringify(embedded.source || "")),
    "la base doit nommer sa source : les donnees sont sous ODbL");
  console.log("  OK (" + r.count + " circuits, " + r.points + " points, version " + r.version + ")");
}

console.log("\nTous les tests de la base des circuits passent.");
