/* ============================================================
   PiBoard - public/qrcode.js
   Generateur de QR code, en mode octet (UTF-8).

   POURQUOI ECRIT A LA MAIN. PiBoard doit fonctionner sans reseau et
   sans dependance supplementaire : aucune bibliotheque n'est chargee
   depuis un CDN, et ajouter un paquet npm pour dessiner un carre noir
   et blanc serait disproportionne. Le code ci-dessous est donc
   autonome, sans DOM ni reseau -- une matrice de booleens en sortie,
   que l'appelant dessine comme il veut (SVG, canvas, table...).

   PORTEE. Les quarante versions, les quatre niveaux de correction,
   mode octet uniquement. Cela va jusqu'a 2953 octets en correction
   basse. La limite a dix versions essayee d'abord etait trop courte :
   une URL de ticket pre-rempli fait facilement six cents octets, et
   c'est justement l'usage vise. Au-dela de la capacite, la fonction le
   dit plutot que de produire un code faux.

   VERIFICATION. La conformite ne se juge pas a l'oeil : la sortie de
   ce module a ete comparee, matrice par matrice, a celle d'une
   implementation de reference sur les quarante versions, les quatre
   niveaux et les huit masques -- 1280 combinaisons, aucune difference.
   Le test embarque les empreintes obtenues (voir test/qrcode.test.js).

   Hand-written QR encoder, byte mode (UTF-8). PiBoard must work
   offline with no added dependency. All 40 versions, all four error
   correction levels. Output is a boolean matrix; the caller draws it.
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PiBoardQR = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Arithmetique du corps de Galois GF(256) ----------
     Le code correcteur de Reed-Solomon y vit. Les tables
     d'exponentielles et de logarithmes evitent une multiplication
     couteuse a chaque octet.
     Galois field arithmetic; Reed-Solomon lives here. */
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function buildTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;          // polynome primitif du QR
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* Polynome generateur de degre n, produit des (x - a^i). */
  function generatorPoly(n) {
    let poly = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  /* Octets de correction d'un bloc de donnees. */
  function ecCodewords(data, count) {
    const gen = generatorPoly(count);
    const rem = new Array(count).fill(0);
    for (const byte of data) {
      const factor = byte ^ rem[0];
      rem.shift();
      rem.push(0);
      for (let i = 0; i < count; i++) rem[i] ^= gfMul(gen[i + 1], factor);
    }
    return rem;
  }

  /* ---------- Tables de la norme ----------
     Par version : nombre total d'octets, puis pour chaque niveau de
     correction le nombre d'octets correcteurs par bloc et la
     composition des blocs.
     Standard tables: total codewords, then per EC level the EC
     codewords per block and the block layout. */
  /* Par version (1 a 40) et par niveau : nombre d'octets correcteurs
     par bloc, puis la composition des blocs sous la forme
     [nombre de blocs, octets de donnees par bloc].
     Per version (1-40) and level: EC codewords per block, then the
     block layout. */
  const BLOCKS = {
    L: [null,
      [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]],
      [20, [[1, 80]]], [26, [[1, 108]]], [18, [[2, 68]]],
      [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]],
      [18, [[2, 68], [2, 69]]], [20, [[4, 81]]], [24, [[2, 92], [2, 93]]],
      [26, [[4, 107]]], [30, [[3, 115], [1, 116]]], [22, [[5, 87], [1, 88]]],
      [24, [[5, 98], [1, 99]]], [28, [[1, 107], [5, 108]]], [30, [[5, 120], [1, 121]]],
      [28, [[3, 113], [4, 114]]], [28, [[3, 107], [5, 108]]], [28, [[4, 116], [4, 117]]],
      [28, [[2, 111], [7, 112]]], [30, [[4, 121], [5, 122]]], [30, [[6, 117], [4, 118]]],
      [26, [[8, 106], [4, 107]]], [28, [[10, 114], [2, 115]]], [30, [[8, 122], [4, 123]]],
      [30, [[3, 117], [10, 118]]], [30, [[7, 116], [7, 117]]], [30, [[5, 115], [10, 116]]],
      [30, [[13, 115], [3, 116]]], [30, [[17, 115]]], [30, [[17, 115], [1, 116]]],
      [30, [[13, 115], [6, 116]]], [30, [[12, 121], [7, 122]]], [30, [[6, 121], [14, 122]]],
      [30, [[17, 122], [4, 123]]], [30, [[4, 122], [18, 123]]], [30, [[20, 117], [4, 118]]],
      [30, [[19, 118], [6, 119]]]],
    M: [null,
      [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]],
      [18, [[2, 32]]], [24, [[2, 43]]], [16, [[4, 27]]],
      [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]],
      [26, [[4, 43], [1, 44]]], [30, [[1, 50], [4, 51]]], [22, [[6, 36], [2, 37]]],
      [22, [[8, 37], [1, 38]]], [24, [[4, 40], [5, 41]]], [24, [[5, 41], [5, 42]]],
      [28, [[7, 45], [3, 46]]], [28, [[10, 46], [1, 47]]], [26, [[9, 43], [4, 44]]],
      [26, [[3, 44], [11, 45]]], [26, [[3, 41], [13, 42]]], [26, [[17, 42]]],
      [28, [[17, 46]]], [28, [[4, 47], [14, 48]]], [28, [[6, 45], [14, 46]]],
      [28, [[8, 47], [13, 48]]], [28, [[19, 46], [4, 47]]], [28, [[22, 45], [3, 46]]],
      [28, [[3, 45], [23, 46]]], [28, [[21, 45], [7, 46]]], [28, [[19, 47], [10, 48]]],
      [28, [[2, 46], [29, 47]]], [28, [[10, 46], [23, 47]]], [28, [[14, 46], [21, 47]]],
      [28, [[14, 46], [23, 47]]], [28, [[12, 47], [26, 48]]], [28, [[6, 47], [34, 48]]],
      [28, [[29, 46], [14, 47]]], [28, [[13, 46], [32, 47]]], [28, [[40, 47], [7, 48]]],
      [28, [[18, 47], [31, 48]]]],
    Q: [null,
      [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]],
      [26, [[2, 24]]], [18, [[2, 15], [2, 16]]], [24, [[4, 19]]],
      [18, [[2, 14], [4, 15]]], [22, [[4, 18], [2, 19]]], [20, [[4, 16], [4, 17]]],
      [24, [[6, 19], [2, 20]]], [28, [[4, 22], [4, 23]]], [26, [[4, 20], [6, 21]]],
      [24, [[8, 20], [4, 21]]], [20, [[11, 16], [5, 17]]], [30, [[5, 24], [7, 25]]],
      [24, [[15, 19], [2, 20]]], [28, [[1, 22], [15, 23]]], [28, [[17, 22], [1, 23]]],
      [26, [[17, 21], [4, 22]]], [30, [[15, 24], [5, 25]]], [28, [[17, 22], [6, 23]]],
      [30, [[7, 24], [16, 25]]], [30, [[11, 24], [14, 25]]], [30, [[11, 24], [16, 25]]],
      [30, [[7, 24], [22, 25]]], [28, [[28, 22], [6, 23]]], [30, [[8, 23], [26, 24]]],
      [30, [[4, 24], [31, 25]]], [30, [[1, 23], [37, 24]]], [30, [[15, 24], [25, 25]]],
      [30, [[42, 24], [1, 25]]], [30, [[10, 24], [35, 25]]], [30, [[29, 24], [19, 25]]],
      [30, [[44, 24], [7, 25]]], [30, [[39, 24], [14, 25]]], [30, [[46, 24], [10, 25]]],
      [30, [[49, 24], [10, 25]]], [30, [[48, 24], [14, 25]]], [30, [[43, 24], [22, 25]]],
      [30, [[34, 24], [34, 25]]]],
    H: [null,
      [17, [[1, 9]]], [28, [[1, 16]]], [22, [[2, 13]]],
      [16, [[4, 9]]], [22, [[2, 11], [2, 12]]], [28, [[4, 15]]],
      [26, [[4, 13], [1, 14]]], [26, [[4, 14], [2, 15]]], [24, [[4, 12], [4, 13]]],
      [28, [[6, 15], [2, 16]]], [24, [[3, 12], [8, 13]]], [28, [[7, 14], [4, 15]]],
      [22, [[12, 11], [4, 12]]], [24, [[11, 12], [5, 13]]], [24, [[11, 12], [7, 13]]],
      [30, [[3, 15], [13, 16]]], [28, [[2, 14], [17, 15]]], [28, [[2, 14], [19, 15]]],
      [26, [[9, 13], [16, 14]]], [28, [[15, 15], [10, 16]]], [30, [[19, 16], [6, 17]]],
      [24, [[34, 13]]], [30, [[16, 15], [14, 16]]], [30, [[30, 16], [2, 17]]],
      [30, [[22, 15], [13, 16]]], [30, [[33, 16], [4, 17]]], [30, [[12, 15], [28, 16]]],
      [30, [[11, 15], [31, 16]]], [30, [[19, 15], [26, 16]]], [30, [[23, 15], [25, 16]]],
      [30, [[23, 15], [28, 16]]], [30, [[19, 15], [35, 16]]], [30, [[11, 15], [46, 16]]],
      [30, [[59, 16], [1, 17]]], [30, [[22, 15], [41, 16]]], [30, [[2, 15], [64, 16]]],
      [30, [[24, 15], [46, 16]]], [30, [[42, 15], [32, 16]]], [30, [[10, 15], [67, 16]]],
      [30, [[20, 15], [61, 16]]]]
  };

  /* Centres des motifs d'alignement, par version. */
  const ALIGN = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
  ];

  const EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  const MAX_VERSION = 40;

  function dataCapacity(version, level) {
    const [ecPerBlock, groups] = BLOCKS[level][version];
    let blocks = 0;
    let bytes = 0;
    for (const [count, size] of groups) { blocks += count; bytes += count * size; }
    return { bytes, blocks, ecPerBlock, groups };
  }

  /* Nombre de caracteres utiles, mode octet : quatre bits de mode, le
     compteur (8 ou 16 bits selon la version), puis les octets.
     Usable byte count in byte mode. */
  function byteCapacity(version, level) {
    const counterBits = version < 10 ? 8 : 16;
    return dataCapacity(version, level).bytes - 2 - (counterBits > 8 ? 1 : 0);
  }

  /* Encodage UTF-8 fait a la main. TextEncoder n'existe pas partout --
     il manque par exemple dans l'environnement de test du projet, et
     sur de vieux navigateurs. Une dizaine de lignes evitent d'en
     dependre, et le mode octet du QR code EST de l'UTF-8.
     Hand-rolled UTF-8. TextEncoder is not available everywhere -- it is
     missing from the project's test environment and from old browsers.
     QR byte mode IS UTF-8. */
  function utf8Bytes(text) {
    const s = String(text);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let code = s.codePointAt(i);
      if (code > 0xffff) i++;                // paire de substitution
      if (code < 0x80) out.push(code);
      else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return out;
  }

  /* ---------- Assemblage du flux binaire ---------- */
  function buildData(bytes, version, level) {
    const cap = dataCapacity(version, level);
    const counterBits = version < 10 ? 8 : 16;
    const bits = [];
    const push = (value, count) => {
      for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
    };
    push(4, 4);                              // mode octet
    push(bytes.length, counterBits);
    for (const b of bytes) push(b, 8);

    // Terminateur, puis alignement sur l'octet.
    const capacityBits = cap.bytes * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    // Remplissage normalise, en alternance.
    const PAD = [0xec, 0x11];
    let p = 0;
    while (data.length < cap.bytes) data.push(PAD[p++ % 2]);
    return data;
  }

  /* Decoupage en blocs, calcul des octets correcteurs, puis
     entrelacement : la norme intercale les blocs pour qu'une tache sur
     le code n'abime pas un bloc entier.
     Split into blocks, compute EC, then interleave. */
  function interleave(data, version, level) {
    const cap = dataCapacity(version, level);
    const dataBlocks = [];
    const ecBlocks = [];
    let at = 0;
    for (const [count, size] of cap.groups) {
      for (let i = 0; i < count; i++) {
        const block = data.slice(at, at + size);
        at += size;
        dataBlocks.push(block);
        ecBlocks.push(ecCodewords(block, cap.ecPerBlock));
      }
    }
    const out = [];
    const maxData = Math.max(...dataBlocks.map((b) => b.length));
    for (let i = 0; i < maxData; i++) {
      for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
    }
    for (let i = 0; i < cap.ecPerBlock; i++) {
      for (const block of ecBlocks) out.push(block[i]);
    }
    return out;
  }

  /* ---------- Motifs fixes de la matrice ---------- */
  function emptyMatrix(size) {
    const m = [];
    for (let i = 0; i < size; i++) m.push(new Array(size).fill(null));
    return m;
  }

  function placeFinder(m, row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6))
          || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = inRing || inCore;
      }
    }
  }

  function placeAlignment(m, version) {
    const centers = ALIGN[version];
    for (const r of centers) {
      for (const c of centers) {
        // Pas sur les motifs de reperage des trois coins.
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= m.length - 9) || (r >= m.length - 9 && c <= 8)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          }
        }
      }
    }
  }

  function placeTiming(m) {
    for (let i = 8; i < m.length - 8; i++) {
      const on = i % 2 === 0;
      if (m[6][i] === null) m[6][i] = on;
      if (m[i][6] === null) m[i][6] = on;
    }
  }

  /* Emplacements reserves a l'information de format (et de version) :
     ils ne doivent pas recevoir de donnees.
     Reserved for format (and version) information. */
  function reserve(m, version) {
    const size = m.length;
    for (let i = 0; i <= 8; i++) {
      if (m[8][i] === null) m[8][i] = false;
      if (m[i][8] === null) m[i][8] = false;
    }
    for (let i = 0; i < 8; i++) {
      if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
      if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
    }
    m[size - 8][8] = true;                   // module toujours noir
    if (version >= 7) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          m[size - 11 + j][i] = false;
          m[i][size - 11 + j] = false;
        }
      }
    }
  }

  /* ---------- Pose des donnees ----------
     Deux colonnes a la fois, de droite a gauche, en serpentant.
     Two columns at a time, right to left, snaking. */
  function placeData(m, bytes, reserved) {
    const size = m.length;
    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--;              // la colonne de synchronisation est sautee
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (let c = 0; c < 2; c++) {
          const col = right - c;
          if (reserved[row][col]) continue;
          const byte = bytes[bitIndex >> 3];
          const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
          m[row][col] = bit === 1;
          bitIndex++;
        }
      }
      upward = !upward;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  /* ---------- Penalites ----------
     La norme impose de choisir le masque qui rend le code le plus
     lisible, selon quatre regles. Les appliquer toutes est ce qui
     separe un code qui se lit toujours d'un code qui se lit parfois.
     The standard picks the mask minimising four penalty rules. */
  function penalty(m) {
    const size = m.length;
    let score = 0;

    // Regle 1 : suites de cinq modules identiques ou plus.
    const runs = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          if (get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) score += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) score += 3 + (run - 5);
      }
    };
    runs((a, b) => m[a][b]);
    runs((a, b) => m[b][a]);

    // Regle 2 : carres de 2x2 de meme couleur.
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    // Regle 3 : motif ressemblant a un reperage (1:1:3:1:1 entoure de blanc).
    const P1 = [true, false, true, true, true, false, true, false, false, false, false];
    const P2 = [false, false, false, false, true, false, true, true, true, false, true];
    const matches = (get, a, b) => {
      for (let k = 0; k < 11; k++) {
        if (get(a, b + k) !== P1[k]) return false;
      }
      return true;
    };
    const matches2 = (get, a, b) => {
      for (let k = 0; k < 11; k++) {
        if (get(a, b + k) !== P2[k]) return false;
      }
      return true;
    };
    for (let a = 0; a < size; a++) {
      for (let b = 0; b + 11 <= size; b++) {
        if (matches((x, y) => m[x][y], a, b)) score += 40;
        if (matches2((x, y) => m[x][y], a, b)) score += 40;
        if (matches((x, y) => m[y][x], a, b)) score += 40;
        if (matches2((x, y) => m[y][x], a, b)) score += 40;
      }
    }

    // Regle 4 : desequilibre entre noir et blanc.
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
    const percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  /* ---------- Informations de format et de version ---------- */
  function formatBits(level, mask) {
    let value = (EC_BITS[level] << 3) | mask;
    let rem = value << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    }
    return ((value << 10) | rem) ^ 0x5412;
  }

  function versionBits(version) {
    let rem = version << 12;
    for (let i = 17; i >= 12; i--) {
      if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | rem;
  }

  /* Les quinze bits de format sont ecrits DEUX FOIS, a des
     emplacements que la norme enumere un par un -- il n'y a pas de
     regle courte a en tirer. C'est exactement la que se logeait
     l'ecart avec l'implementation de reference : la zone de donnees
     etait juste, le format non.
     The fifteen format bits are written TWICE, at positions the
     standard enumerates one by one. */
  function placeFormat(m, level, mask) {
    const size = m.length;
    const bits = formatBits(level, mask);
    // Premiere copie : colonne 8 du haut, puis bas de cette colonne.
    for (let i = 0; i < 15; i++) {
      const on = ((bits >> i) & 1) === 1;
      if (i < 6) m[i][8] = on;
      else if (i < 8) m[i + 1][8] = on;
      else m[size - 15 + i][8] = on;
    }
    // Seconde copie : ligne 8, de la droite vers la gauche.
    for (let i = 0; i < 15; i++) {
      const on = ((bits >> i) & 1) === 1;
      if (i < 8) m[8][size - i - 1] = on;
      else if (i === 8) m[8][7] = on;
      else m[8][15 - i - 1] = on;
    }
    m[size - 8][8] = true;                   // module toujours noir
  }

  function placeVersion(m, version) {
    if (version < 7) return;
    const size = m.length;
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      m[size - 11 + c][r] = on;
      m[r][size - 11 + c] = on;
    }
  }

  /* ---------- Entree publique ----------
     Renvoie { size, modules } ou modules[r][c] vaut true pour un module
     noir. Leve une erreur explicite si le texte est trop long : mieux
     vaut le dire que produire un code illisible.
     Returns a boolean matrix; throws a clear error when the text does
     not fit rather than producing an unreadable code. */
  function encode(text, options) {
    const o = options || {};
    const level = ["L", "M", "Q", "H"].indexOf(String(o.level || "M").toUpperCase()) >= 0
      ? String(o.level || "M").toUpperCase() : "M";
    const bytes = utf8Bytes(text);
    if (!bytes.length) throw new Error("texte vide / empty text");

    let version = Number(o.version) || 0;
    if (!version) {
      for (let v = 1; v <= MAX_VERSION; v++) {
        if (bytes.length <= byteCapacity(v, level)) { version = v; break; }
      }
    }
    if (!version || bytes.length > byteCapacity(version, level)) {
      throw new Error("texte trop long pour un QR code (" + bytes.length + " octets, maximum "
        + byteCapacity(MAX_VERSION, level) + " en niveau " + level + ")");
    }

    const data = interleave(buildData(bytes, version, level), version, level);
    const size = version * 4 + 17;

    const base = emptyMatrix(size);
    placeFinder(base, 0, 0);
    placeFinder(base, 0, size - 7);
    placeFinder(base, size - 7, 0);
    placeAlignment(base, version);
    placeTiming(base);
    reserve(base, version);

    // Tout ce qui est deja pose est reserve : les donnees l'evitent.
    const reserved = base.map((row) => row.map((v) => v !== null));

    /* Un masque peut etre impose : c'est ce qui permet de comparer la
       sortie, masque par masque, a une implementation de reference.
       A mask can be forced, which is what allows comparing the output
       mask by mask against a reference implementation. */
    const only = Number.isInteger(o.mask) && o.mask >= 0 && o.mask <= 7 ? o.mask : null;
    let best = null;
    for (let mask = only == null ? 0 : only; mask <= (only == null ? 7 : only); mask++) {
      const m = base.map((row) => row.slice());
      placeData(m, data, reserved);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] = !m[r][c];
        }
      }
      placeFormat(m, level, mask);
      placeVersion(m, version);
      const score = penalty(m);
      if (!best || score < best.score) best = { score, mask, modules: m };
    }
    return { size, version, level, mask: best.mask, modules: best.modules };
  }

  /* Rendu SVG, autonome : aucune image a charger, la couleur suit le
     theme et le code reste net a n'importe quelle taille.
     Self-contained SVG rendering: nothing to load, colour follows the
     theme, crisp at any size. */
  function toSvg(text, options) {
    const o = options || {};
    const qr = encode(text, o);
    const quiet = o.quiet == null ? 4 : Math.max(0, Number(o.quiet));
    const total = qr.size + quiet * 2;
    const dark = o.dark || "#000";
    const light = o.light || "#fff";
    let path = "";
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) path += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total + '"'
      + ' shape-rendering="crispEdges" role="img">'
      + '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>'
      + '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  return { encode, toSvg, byteCapacity, MAX_VERSION, formatBits, versionBits, ecCodewords };
});
