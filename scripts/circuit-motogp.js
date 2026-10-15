#!/usr/bin/env node
/* Complete scripts/circuit-seeds.json avec les donnees OFFICIELLES du
   flux MotoGP (api.motogp.pulselive.com), puis laisse
   scripts/circuit-catalog.js relever les trace manquants.

   USAGE :  node scripts/circuit-motogp.js [annee ...]      (defaut : l'annee en cours)

   POURQUOI. Dix circuits du calendrier MotoGP etaient dans la base sans
   trace, et la raison n'etait pas OpenStreetMap : leur fiche n'avait AUCUNE
   longueur de reference. Or le releve ne retient un trace que si sa longueur
   mesuree correspond a celle du tour (85 a 160 %) -- sans longueur reelle,
   il ne peut rien valider et classe le circuit « incomplet » d'office. Le
   flux MotoGP porte cette longueur, ainsi que le nombre de virages a gauche
   et a droite et la plus longue ligne droite.

   CE QU'IL ECRIT. Pour chaque circuit d'un Grand Prix MotoGP, rattache au
   circuit de la base par ses coordonnees (le plus proche, a moins de 4 km,
   en preferant un circuit deja marque MotoGP) :
     - specs.motogp = { lengthM, left, right, straightM }  (jamais melange
       avec les chiffres de la F1 : un meme circuit n'a pas toujours le meme
       trace dans les deux disciplines) ;
     - specs.lengthM et specs.openedYear UNIQUEMENT s'ils manquent.
   Un circuit du flux sans correspondant est signale, jamais invente.

   WHY. Ten MotoGP circuits were in the base without an outline, and OSM was
   not the reason: their spec sheet had NO reference length, and the survey
   only accepts an outline whose measured length matches the lap (85-160 %).
   The MotoGP feed carries that length, plus left/right corner counts and
   the longest straight. Written under specs.motogp, never mixed with the
   Formula 1 figures. */
"use strict";

const fs = require("fs");
const path = require("path");

const SEEDS_PATH = path.join(__dirname, "circuit-seeds.json");
const FEED = "https://api.motogp.pulselive.com/motogp/v1/events?seasonYear=";
const MAX_KM = 4;

/* Deux circuits dont le flux donne des COORDONNEES FAUSSES : Le Mans
   a 6 km du circuit Bugatti, Mandalika a 25 km du sien. Un rattachement
   par la distance les rate ; on les nomme donc, une fois, avec la raison.
   Two circuits whose feed COORDINATES ARE WRONG (6 km and 25 km off):
   matching by distance misses them, so they are named once, with the
   reason. */
const OVERRIDES = {
  "Le Mans": "bugatti",
  "Pertamina Mandalika International Circuit": "mandalika"
};

const R = 6371;
const rad = (d) => d * Math.PI / 180;
function km(a, b, c, d) {
  const x = rad(d - b) * Math.cos(rad((a + c) / 2));
  return Math.hypot(x, rad(c - a)) * R;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Fonction PURE : evenements du flux -> circuits (un par Grand Prix). */
function circuitsOf(events) {
  const out = new Map();
  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev || ev.kind !== "GP" || !ev.circuit) continue;
    const c = ev.circuit;
    const lat = Number(c.lat), lon = Number(c.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    /* LE BON TRACE. Un circuit porte plusieurs « tracks » (anciennes
       configurations) : on prend le plus recemment modifie parmi les
       actifs -- Red Bull Ring en a deux actifs, 4 348 m (2022) et 4 318 m
       (ancienne) -- et, si le flux n'en marque aucun actif (Goiania), le
       premier.
       THE RIGHT LAYOUT. Several tracks (old configurations): the most
       recently modified among the active ones, else the first. */
    const all = Array.isArray(c.tracks) ? c.tracks.filter(Boolean) : [];
    const active = all.filter((t) => t.is_active !== false);
    const when = (t) => Date.parse(t.modification_date || "") || 0;
    const t = (active.length ? active : all).slice().sort((a, b) => when(b) - when(a))[0] || {};
    out.set(c.id || c.name, {
      feedId: c.id || "", name: c.name, lat, lon,
      lengthM: num(t.lenght), left: num(t.left_corners), right: num(t.right_corners),
      straightM: num(t.longest_straight), built: num(c.constructed)
    });
  }
  return [...out.values()];
}

/* Fonction PURE : le circuit de la base le plus proche, ou null. */
function matchSeed(seeds, c) {
  if (OVERRIDES[c.name]) return seeds.find((s) => s.id === OVERRIDES[c.name]) || null;
  const near = seeds
    .map((s) => ({ s, d: km(c.lat, c.lon, s.lat, s.lon) }))
    .filter((x) => x.d <= MAX_KM)
    .sort((a, b) => {
      const ma = (a.s.specs.series || []).includes("motogp") ? 0 : 1;
      const mb = (b.s.specs.series || []).includes("motogp") ? 0 : 1;
      return ma - mb || a.d - b.d;
    });
  return near.length ? near[0].s : null;
}

function apply(seeds, circuits) {
  const report = [];
  for (const c of circuits) {
    const seed = matchSeed(seeds, c);
    if (!seed) { report.push("SANS CORRESPONDANT : " + c.name); continue; }
    const m = {};
    if (c.feedId) m.feedId = c.feedId;
    if (c.lengthM) m.lengthM = c.lengthM;
    if (c.left != null) m.left = c.left;
    if (c.right != null) m.right = c.right;
    if (c.straightM) m.straightM = c.straightM;
    seed.specs.motogp = m;
    if (!seed.specs.series.includes("motogp")) seed.specs.series.push("motogp");
    if (!seed.specs.lengthM && c.lengthM) seed.specs.lengthM = c.lengthM;
    if (!seed.specs.openedYear && c.built) seed.specs.openedYear = c.built;
    report.push(seed.id.padEnd(16) + " <- " + c.name + (m.lengthM ? "  " + m.lengthM + " m" : ""));
  }
  return report;
}

async function main() {
  const years = process.argv.slice(2).filter((a) => /^\d{4}$/.test(a));
  if (!years.length) years.push(String(new Date().getFullYear()));
  const seeds = JSON.parse(fs.readFileSync(SEEDS_PATH, "utf8"));
  for (const y of years) {
    const res = await fetch(FEED + y, { headers: { "User-Agent": "PiBoard/circuit-motogp (https://github.com/jihemezes/piboard)" } });
    if (!res.ok) throw new Error("flux MotoGP " + y + " : " + res.status);
    const report = apply(seeds, circuitsOf(await res.json()));
    console.log("== " + y + "\n" + report.join("\n"));
  }
  fs.writeFileSync(SEEDS_PATH, JSON.stringify(seeds, null, 1) + "\n", "utf8");
  console.log("\nSeeds mis a jour. Ensuite : node scripts/circuit-catalog.js --only <ids>");
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { circuitsOf, matchSeed, apply };
