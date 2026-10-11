#!/usr/bin/env node
/* Fabrique public/data/circuit-catalog.json a partir d'OpenStreetMap.

   USAGE :  node scripts/circuit-catalog.js [--out <fichier>] [--only <id,id>]

   A QUOI SERT CE SCRIPT. La tuile « Plan du circuit » ne parle PAS a
   Overpass : elle lit une base publiee. Ce script est ce qui fabrique
   cette base. On le lance a la main, quand le calendrier change ou
   qu'un circuit manquant apparait enfin dans OpenStreetMap -- pas a
   chaque affichage, et surtout pas sur le Raspberry Pi de quelqu'un.

   POURQUOI PAS A L'AFFICHAGE : mesure faite sur trois appels
   consecutifs pour le meme circuit -- 886 ms, 17,4 s, puis une erreur
   429 (quota depasse). Overpass est gratuit, public et partage ; il
   n'est pas fait pour etre interroge par chaque tuile de chaque
   tableau de bord.

   CE QUE LE SCRIPT GARANTIT. Un trace n'entre dans la base QUE si sa
   longueur mesuree correspond a la longueur reelle du tour (entre 85 %
   et 160 %). C'est le controle qui a rattrape une erreur de ma part :
   j'avais compte les « troncons » renvoyes par OSM pour declarer un
   circuit couvert -- Monaco en avait onze, donc Monaco etait bon. Faux.
   Ces onze troncons totalisent cinquante metres sur un tour de 3 337 :
   le reste emprunte des routes publiques, qu'OpenStreetMap ne distingue
   pas de la voirie. Compter des troncons ne prouve rien ; mesurer, si.
   Un circuit qui echoue a ce controle entre quand meme dans la base,
   avec sa fiche technique et `incomplete: true`, pour que la tuile
   EXPLIQUE au lieu de se taire.

   WHAT THIS SCRIPT GUARANTEES: an outline enters the base ONLY if its
   measured length matches the real lap length (85 % to 160 %). That is
   the check that caught a mistake of mine -- I had counted the "ways"
   OSM returned to declare a circuit covered. Monaco had eleven, so
   Monaco was fine. Wrong: those eleven total fifty metres of a
   3,337-metre lap. Counting ways proves nothing; measuring does.

   SOURCES. Traces : OpenStreetMap via Overpass, sous licence ODbL --
   l'attribution voyage dans le fichier produit, ce n'est pas une
   politesse mais une obligation. Longueurs, pays et annee : Wikidata
   (CC0) et l'API Jolpica/Ergast. */
"use strict";

const fs = require("fs");
const path = require("path");

const OVERPASS = "https://overpass-api.de/api/interpreter";
const OUT = path.join(__dirname, "..", "public", "data", "circuit-catalog.json");

/* Les circuits a relever, avec le point autour duquel chercher. Les
   coordonnees des circuits de Formule 1 viennent de l'API des courses
   (elles sont la reference : c'est elle que la tuile interroge pour
   savoir ou l'on court) ; les autres de Wikidata.
   The circuits to survey. F1 coordinates come from the racing API --
   the reference, since that is what the tile reads. */
const SEEDS = require("./circuit-seeds.json");

/* ---------- Geometrie, en fonctions pures ---------- */

const R = 6371000;
const rad = (d) => d * Math.PI / 180;

function segmentLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i - 1], [c, e] = points[i];
    d += Math.hypot(rad(e - b) * Math.cos(rad((a + c) / 2)), rad(c - a)) * R;
  }
  return d;
}

/* Douglas-Peucker. Le releve brut d'un circuit pese 50 Ko ; simplifie a
   environ 3,5 m de tolerance il en pese 2, et le dessin est
   rigoureusement identique a l'ecran -- un pixel vaut deja plusieurs
   metres des que le circuit tient dans une tuile.
   Raw, a circuit weighs 50 KB; simplified to ~3.5 m it weighs 2, and
   the drawing is identical on screen. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const sqDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = -1, at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = sqDist(points[k], points[i], points[j]);
      if (d > worst) { worst = d; at = k; }
    }
    if (worst > tolerance * tolerance) { keep[at] = true; stack.push([i, at], [at, j]); }
  }
  return points.filter((_, i) => keep[i]);
}

/* On ne garde que le groupe de troncons qui SE TOUCHENT le plus long.
   Un complexe de circuit contient d'autres pistes bitumees : Sepang a
   un « Handling Circuit » en `sport=motor`, impossible a ecarter par
   ses etiquettes, a plusieurs centaines de metres au nord. Le dessiner
   n'ajoutait pas qu'une tache : il agrandissait le cadre commun, et le
   Grand Prix se retrouvait ecrase dans un coin.
   La jonction se teste sur TOUS les noeuds, et non les seules
   extremites : une voie des stands se raccorde souvent au MILIEU d'un
   troncon, et la regle des extremites en perdait les deux tiers. Deux
   voies qui se croisent sans jonction ne partagent aucun noeud -- c'est
   la convention OSM, et c'est ce qui distingue un pont d'un carrefour.
   Only the longest group of TOUCHING segments is kept. */
function mainLoop(ways) {
  if (ways.length < 2) return ways;
  const key = (p) => p[0].toFixed(5) + "," + p[1].toFixed(5);
  const parent = ways.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const at = new Map();
  ways.forEach((w, i) => {
    for (const p of w.p) {
      const k = key(p);
      if (at.has(k)) union(at.get(k), i); else at.set(k, i);
    }
  });
  const total = new Map();
  ways.forEach((w, i) => {
    const r = find(i);
    total.set(r, (total.get(r) || 0) + segmentLength(w.p));
  });
  let best = null;
  for (const [r, d] of total) if (!best || d > best.d) best = { r, d };
  return ways.filter((_, i) => find(i) === best.r);
}

const PIT_RE = /(pit ?lane|voie des stands|boxes)/i;
const CORNER_RE = /(corner|turn|curve|curva|kurve|virage|chicane|bend|hairpin|esses)/i;
const CORNER_NUM_RE = /^\s*\d{1,2}[a-z]?\s*$/i;

/* Ce qui porte `highway=raceway` sans etre le Grand Prix, releve dans
   la vraie reponse d'Overpass : karting, motocross sur terre, et les
   tracés SECONDAIRES qui partagent le bitume (variantes courtes,
   anneau de vitesse, piste d'acceleration). Sans ce filtre, Monza
   sortait a 196 % de sa longueur reelle et le Circuit des Ameriques a
   185 % : le dessin etait joli et n'etait pas le circuit.
   What carries `highway=raceway` without being the Grand Prix. */
const OTHER_SPORT_RE = /(karting|motocross|quadcross|rallycross|autocross|cyclo|bmx|speedway|drag)/i;
const LOOSE_SURFACE_RE = /(unpaved|dirt|ground|gravel|sand|grass|earth|compacted)/i;
const SECONDARY_RE = /(short course|short track|junior|inner circuit|outer circuit|endurance circuit|drag strip|paddock layout|flat oval|anello alta velocit|sopraelevata|ex circuito|rettilineo anello|nascar short|\btondo\b|runoff|north circuit|south circuit|handling)/i;

function parseOverpass(json) {
  const elements = (json && Array.isArray(json.elements)) ? json.elements : [];
  const ways = [];
  for (const e of elements) {
    if (!e || e.type !== "way" || !Array.isArray(e.geometry) || e.geometry.length < 2) continue;
    const tags = e.tags || {};
    if (OTHER_SPORT_RE.test(tags.sport || "")) continue;
    if (LOOSE_SURFACE_RE.test(tags.surface || "")) continue;
    const name = tags.name || tags["name:en"] || "";
    if (SECONDARY_RE.test(name)) continue;
    const p = e.geometry
      .map((g) => [Number(g.lat), Number(g.lon)])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (p.length < 2) continue;
    ways.push({ n: name || undefined, o: tags.oneway === "yes" ? 1 : undefined, p });
  }
  return mainLoop(ways);
}

/* Longueur DESSINEE : les stands sont exclus, puisqu'ils ne font pas
   partie du tour. C'est cette mesure que l'on confronte a la longueur
   reelle. DRAWN length, excluding the pit lane. */
function drawnLength(ways) {
  return ways.filter((w) => !PIT_RE.test(w.n || "")).reduce((a, w) => a + segmentLength(w.p), 0);
}

/* ---------- Releve ---------- */

async function overpass(lat, lon, radius) {
  const q = `[out:json][timeout:60];way[highway=raceway](around:${radius || 2600},${lat},${lon});out geom;`;
  /* Overpass refuse regulierement (429) quand il est charge : on
     reessaie, en laissant le temps au quota de se liberer. Abandonner
     au premier refus produirait une base a trous, et un trou passe
     inapercu.
     Overpass regularly refuses (429) under load: we retry. */
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(OVERPASS + "?data=" + encodeURIComponent(q), {
        headers: { "Accept": "application/json", "User-Agent": "PiBoard/circuit-catalog" }
      });
      if (!res.ok) { await wait(8000); continue; }
      return await res.json();
    } catch (e) {
      await wait(8000);
    }
  }
  throw new Error("Overpass injoignable");
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.indexOf("--out");
  const out = outArg >= 0 ? args[outArg + 1] : OUT;
  const onlyArg = args.indexOf("--only");
  const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(",")) : null;

  const previous = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : { circuits: {} };
  const circuits = {};
  let drawn = 0, incomplete = 0;

  for (const seed of SEEDS) {
    if (only && !only.has(seed.id)) {
      /* Un releve partiel ne doit pas effacer le reste de la base.
         A partial run must not wipe the rest of the base. */
      if (previous.circuits[seed.id]) circuits[seed.id] = previous.circuits[seed.id];
      continue;
    }

    process.stdout.write(seed.id.padEnd(18));
    let ways = [];
    try {
      ways = parseOverpass(await overpass(seed.lat, seed.lon, seed.radius));
    } catch (e) {
      console.log("ECHEC (" + e.message + ")");
    }

    const entry = { name: seed.name, specs: Object.assign({}, seed.specs) };
    const real = seed.specs && seed.specs.lengthM;
    const measured = ways.length ? drawnLength(ways) : 0;
    const ratio = real ? measured / real : 0;

    if (ways.length && real && ratio >= 0.85 && ratio <= 1.6) {
      entry.ways = ways.map((w) => {
        const o = { p: simplify(w.p, 0.00003).map((p) => [+p[0].toFixed(5), +p[1].toFixed(5)]) };
        if (w.n) o.n = w.n;
        if (w.o) o.o = 1;
        return o;
      });
      drawn++;
      console.log("ok  " + Math.round(measured) + " m / " + real + " m  (ratio " + ratio.toFixed(2) + ")");
    } else {
      /* Le circuit entre quand meme, avec sa fiche et l'indicateur :
         la tuile expliquera, au lieu de laisser croire a une panne.
         It still goes in, with its facts and the flag. */
      entry.ways = [];
      entry.incomplete = true;
      incomplete++;
      console.log("incomplet  " + (ways.length ? Math.round(measured) + " m" : "aucun trace")
        + (real ? " / " + real + " m" : " (longueur reelle inconnue)"));
    }
    circuits[seed.id] = entry;
    await wait(2200);
  }

  const catalog = {
    /* Le numero de VERSION est ce qui permet au distant de remplacer
       l'embarque : il doit croitre a chaque publication, sans quoi la
       base publiee serait ignoree par toutes les installations.
       The VERSION number is what lets the remote replace the shipped
       one: it must grow on every publication. */
    version: (Number(previous.version) || 0) + 1,
    updated: new Date().toISOString().slice(0, 10),
    source: "Tracés : OpenStreetMap (ODbL), relevés via Overpass · Fiches : Wikidata (CC0) et Jolpica/Ergast",
    circuits
  };

  fs.writeFileSync(out, JSON.stringify(catalog), "utf8");
  console.log("\n" + drawn + " tracés publiés, " + incomplete + " incomplets -> " + out);
  console.log("Verifiez avec : node test/circuitCatalog.test.js");
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { parseOverpass, mainLoop, simplify, segmentLength, drawnLength };
