/* Tests du generateur de QR code (public/qrcode.js).

   POURQUOI DES EMPREINTES. Un QR code ne se relit pas a l'oeil et
   PiBoard n'embarque aucun decodeur. La sortie de ce module a donc ete
   comparee, MODULE PAR MODULE, a celle d'une implementation de
   reference (le paquet npm « qrcode ») sur 1280 combinaisons : les
   quarante versions, les quatre niveaux de correction et les huit
   masques, plus le choix automatique du masque -- toutes identiques. Les empreintes
   ci-dessous sont celles de ces matrices verifiees. Elles gelent le
   resultat : si un jour une retouche change un seul module, le test le
   dit.

   La dependance de reference n'est PAS embarquee dans le projet : elle
   a servi une fois, a la mise au point. Ces tests-ci tournent seuls.

   WHY FINGERPRINTS. A QR code cannot be proofread by eye and PiBoard
   ships no decoder. This module's output was compared MODULE BY MODULE
   against a reference implementation over 1280 combinations, all
   identical. The fingerprints below are those verified matrices; they
   freeze the result. The reference package is NOT a project
   dependency: it was used once, during development. */
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const QR = require("../public/qrcode.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

function fingerprint(modules) {
  const flat = modules.map((row) => row.map((v) => (v ? 1 : 0)).join("")).join("");
  return crypto.createHash("sha256").update(flat).digest("hex").slice(0, 16);
}

/* Chaque ligne : texte, niveau, puis ce que la reference a confirme. */
const VERIFIED = [
  { text: "PiBoard", level: "L", version: 1, size: 21, mask: 2, sha: "600b3dafdd4addb1" },
  { text: "PiBoard", level: "M", version: 1, size: 21, mask: 0, sha: "eade66fe6561d810" },
  { text: "PiBoard", level: "Q", version: 1, size: 21, mask: 0, sha: "009205c1bb721467" },
  { text: "PiBoard", level: "H", version: 1, size: 21, mask: 6, sha: "b5e135f4dca46ac3" },
  { text: "https://github.com/jihemezes/piboard/issues/new", level: "M", version: 4, size: 33, mask: 4, sha: "439d6484dcca919a" },
  { text: "https://github.com/jihemezes/piboard/issues/new?template=bug.yml&title=%5BBug%5D+", level: "Q", version: 7, size: 45, mask: 2, sha: "e243d08532dc2c14" },
  // Accents : le mode octet encode en UTF-8, deux octets par caractere accentue.
  { text: "Impression 3D : buse bouchée à 37 %", level: "M", version: 3, size: 29, mask: 4, sha: "84c80b63b9628e0e" },
  { text: "x".repeat(100), level: "M", version: 6, size: 41, mask: 0, sha: "3b1cbac996b5a950" },
  { text: "y".repeat(200), level: "L", version: 9, size: 53, mask: 1, sha: "5117b3597dac6b55" },
  { text: "z".repeat(213), level: "M", version: 10, size: 57, mask: 1, sha: "b2bb2b06366d4879" },
  { text: "w".repeat(271), level: "L", version: 10, size: 57, mask: 4, sha: "a0612258efd3e211" },
  // Au-dela de la version 10 : c'est la taille reelle d'un ticket
  // pre-rempli, et c'est l'usage vise par le QR code de la section
  // « Participer ». La limite a dix versions ne l'aurait pas couvert.
  { text: "https://github.com/jihemezes/piboard/issues/new?" + new URLSearchParams({
    title: "[Bug] ", labels: "bug",
    body: "## Ce qui se passe\n\n\n\n## Ce que j'attendais\n\n\n\n## Comment le reproduire\n\n1. \n2. \n3. "
      + "\n\n## Tuile concernée\n\n\n\n## Contexte technique\n\n- PiBoard : v1.117.0"
      + "\n- Plateforme : Raspberry Pi 4 Model B Rev 1.5 (navigateur / browser)\n- Écran : 1920x1080\n- Langue : fr\n"
  }).toString(), level: "M", version: 16, size: 81, mask: 7, sha: "1cc41b0cf6fb5bb6" },
  { text: "big".repeat(600), level: "L", version: 31, size: 141, mask: null, sha: null },
  { text: "x".repeat(2953), level: "L", version: 40, size: 177, mask: null, sha: null }
];

console.log("== Generateur de QR code ==");

for (const c of VERIFIED) {
  const label = c.text.length > 24 ? c.text.slice(0, 18) + "… (" + c.text.length + ")" : c.text;
  test("conforme a la reference : « " + label + " » en niveau " + c.level, () => {
    const qr = QR.encode(c.text, { level: c.level });
    assert.strictEqual(qr.version, c.version, "version choisie");
    assert.strictEqual(qr.size, c.size, "taille de la matrice");
    if (c.mask != null) assert.strictEqual(qr.mask, c.mask, "masque retenu");
    if (c.sha) assert.strictEqual(fingerprint(qr.modules), c.sha, "matrice identique au module pres");
  });
}

console.log("== Structure imposee par la norme ==");

test("les trois motifs de reperage sont a leur place", () => {
  const qr = QR.encode("PiBoard", { level: "M" });
  const m = qr.modules;
  const corner = (r0, c0) => {
    // Un carre plein de 3x3 cercle de blanc, lui-meme cercle de noir.
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const gap = (r === 1 || r === 5 || c === 1 || c === 5) && !ring;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const want = ring || core;
        if (gap) assert.strictEqual(m[r0 + r][c0 + c], false, "anneau blanc");
        else assert.strictEqual(m[r0 + r][c0 + c], want, "module " + (r0 + r) + "," + (c0 + c));
      }
    }
  };
  corner(0, 0);
  corner(0, qr.size - 7);
  corner(qr.size - 7, 0);
});

test("les lignes de synchronisation alternent", () => {
  const qr = QR.encode("PiBoard", { level: "M" });
  for (let i = 8; i < qr.size - 8; i++) {
    assert.strictEqual(qr.modules[6][i], i % 2 === 0, "ligne horizontale, colonne " + i);
    assert.strictEqual(qr.modules[i][6], i % 2 === 0, "ligne verticale, ligne " + i);
  }
});

test("le module toujours noir l'est", () => {
  for (const level of ["L", "M", "Q", "H"]) {
    const qr = QR.encode("PiBoard", { level });
    assert.strictEqual(qr.modules[qr.size - 8][8], true, "niveau " + level);
  }
});

test("la taille suit la version : 4 x version + 17", () => {
  for (let v = 1; v <= QR.MAX_VERSION; v++) {
    const qr = QR.encode("x".repeat(QR.byteCapacity(v, "H")), { level: "H" });
    assert.strictEqual(qr.size, qr.version * 4 + 17, "version " + qr.version);
  }
});

console.log("== Information de format et de version ==");

test("les bits de format sont ceux de la table de la norme", () => {
  // Valeurs publiees par la norme, niveau M (masques 0 a 7).
  const M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];
  for (let mask = 0; mask < 8; mask++) assert.strictEqual(QR.formatBits("M", mask), M[mask], "masque " + mask);
  assert.strictEqual(QR.formatBits("L", 0), 0x77c4);
  assert.strictEqual(QR.formatBits("Q", 0), 0x355f);
  assert.strictEqual(QR.formatBits("H", 0), 0x1689);
});

test("les bits de version sont ceux de la table de la norme", () => {
  assert.strictEqual(QR.versionBits(7), 0x07c94);
  assert.strictEqual(QR.versionBits(8), 0x085bc);
  assert.strictEqual(QR.versionBits(9), 0x09a99);
  assert.strictEqual(QR.versionBits(10), 0x0a4d3);
});

console.log("== Correction d'erreurs ==");

test("les octets correcteurs sont ceux de l'exemple de la norme", () => {
  /* Exemple publie : « HELLO WORLD » en version 1, niveau M -- seize
     octets de donnees et dix octets correcteurs, tous connus.
     Published worked example: version 1, level M. */
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  const expected = [196, 35, 39, 119, 235, 215, 231, 226, 93, 23];
  assert.deepStrictEqual(QR.ecCodewords(data, 10), expected);
});

console.log("== Limites et refus ==");

test("un texte trop long est refuse, avec la raison", () => {
  assert.throws(() => QR.encode("x".repeat(2954), { level: "L" }), /trop long/);
  assert.throws(() => QR.encode("", { level: "M" }), /vide|empty/);
});

test("la capacite annoncee est tenue, a un octet pres", () => {
  for (const level of ["L", "M", "Q", "H"]) {
    const max = QR.byteCapacity(QR.MAX_VERSION, level);
    assert.doesNotThrow(() => QR.encode("x".repeat(max), { level }), level + " : la capacite annoncee passe");
    assert.throws(() => QR.encode("x".repeat(max + 1), { level }), level + " : un octet de plus est refuse");
  }
});

test("un accent compte pour deux octets, pas pour un caractere", () => {
  /* Piege classique : compter les caracteres au lieu des octets produit
     un code tronque sur un texte accentue. A la plus grande version,
     la moitie de la capacite en caracteres accentues passe tout juste,
     et la capacite entiere ne passe pas.
     Counting characters instead of bytes truncates accented text. */
  const max = QR.byteCapacity(QR.MAX_VERSION, "H");
  assert.doesNotThrow(() => QR.encode("é".repeat(Math.floor(max / 2)), { level: "H" }));
  assert.throws(() => QR.encode("é".repeat(max), { level: "H" }), /trop long/);
  // Et la version choisie tient compte des octets, pas des caracteres.
  assert.ok(QR.encode("é".repeat(20), { level: "M" }).version
    > QR.encode("e".repeat(20), { level: "M" }).version,
  "vingt caracteres accentues occupent plus de place que vingt lettres");
});

console.log("== Rendu SVG ==");

test("le SVG est autonome : pas d'image a charger, pas de script", () => {
  const svg = QR.toSvg("PiBoard", { level: "M" });
  assert.ok(/^<svg /.test(svg) && /<\/svg>$/.test(svg));
  assert.ok(!/<script|href=|<image/i.test(svg), "rien d'exterieur n'est reference");
  assert.ok(/shape-rendering="crispEdges"/.test(svg), "les modules restent nets");
});

test("la marge blanche reglementaire est presente", () => {
  // Sans elle, beaucoup de lecteurs echouent : quatre modules de blanc
  // tout autour font partie de la norme.
  const svg = QR.toSvg("PiBoard", { level: "M" });
  const box = /viewBox="0 0 (\d+) \1"/.exec(svg);
  assert.ok(box, "viewBox carre");
  const qr = QR.encode("PiBoard", { level: "M" });
  assert.strictEqual(Number(box[1]), qr.size + 8, "quatre modules de marge de chaque cote");
  assert.strictEqual(Number(/viewBox="0 0 (\d+)/.exec(QR.toSvg("PiBoard", { quiet: 0 }))[1]), qr.size,
    "la marge reste reglable");
});

test("les couleurs suivent ce qu'on demande", () => {
  const svg = QR.toSvg("PiBoard", { dark: "#123456", light: "#abcdef" });
  assert.ok(svg.indexOf('fill="#123456"') >= 0 && svg.indexOf('fill="#abcdef"') >= 0);
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
