/* ============================================================
   PiBoard - server/astronomy.js
   Phase de lune et visibilite des planetes, calculees localement via
   astronomy-engine (MIT, la bibliotheque derriere l'API publique
   visibleplanets.dev) -- aucune requete reseau necessaire pour ces deux
   fonctions, contrairement aux passages ISS (voir le widget cote client,
   qui interroge iss-api.polluxlabs.io directement : des elements
   orbitaux a jour sont necessaires et ne peuvent pas etre "embarques").

   Moon phase and planet visibility, computed locally via astronomy-engine
   (MIT, the library behind the public visibleplanets.dev API) -- no
   network request needed for either of these two, unlike ISS passes (see
   the client-side widget, which queries iss-api.polluxlabs.io directly:
   up-to-date orbital elements are required and can't be "baked in").
   ============================================================ */
"use strict";

const Astronomy = require("astronomy-engine");

// 8 phases classiques, chacune centree sur un multiple de 45 degres de
// l'angle de phase (0=nouvelle lune, 90=premier quartier, 180=pleine
// lune, 270=dernier quartier). Classic 8 phases, each centered on a
// 45-degree multiple of the phase angle (0=new moon, 90=first quarter,
// 180=full moon, 270=last quarter).
const PHASE_KEYS = [
  "new", "waxingCrescent", "firstQuarter", "waxingGibbous",
  "full", "waningGibbous", "lastQuarter", "waningCrescent"
];

function moonPhaseKey(angleDeg) {
  const a = ((angleDeg % 360) + 360) % 360;
  return PHASE_KEYS[Math.round(a / 45) % 8];
}

function moonPhase(now) {
  const angle = Astronomy.MoonPhase(now);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, now);
  // Croissante (0-180) ou decroissante (180-360) : determine le sens du
  // croissant/gibbeuse a l'affichage cote client. Waxing (0-180) or
  // waning (180-360): determines the crescent/gibbous direction for the
  // client-side display.
  const waxing = angle < 180;

  // Prochaines nouvelle lune et pleine lune : SearchMoonQuarter avance
  // de quartier en quartier (0=nouvelle, 1=premier quartier, 2=pleine,
  // 3=dernier quartier) jusqu'a trouver les deux qui nous interessent.
  // Next new moon and full moon: SearchMoonQuarter steps quarter by
  // quarter (0=new, 1=first quarter, 2=full, 3=last quarter) until it
  // finds the two we care about.
  let nextNew = null, nextFull = null;
  let q = Astronomy.SearchMoonQuarter(now);
  for (let i = 0; i < 4 && (!nextNew || !nextFull); i++) {
    if (q.quarter === 0 && !nextNew) nextNew = q.time.date;
    if (q.quarter === 2 && !nextFull) nextFull = q.time.date;
    q = Astronomy.NextMoonQuarter(q);
  }

  return {
    phaseAngle: angle,
    phaseKey: moonPhaseKey(angle),
    illumination: illum.phase_fraction,
    waxing,
    nextNewMoon: nextNew ? nextNew.toISOString() : null,
    nextFullMoon: nextFull ? nextFull.toISOString() : null
  };
}

// Les 5 planetes visibles a l'oeil nu, dans leur ordre traditionnel.
// Uranus/Neptune existent dans astronomy-engine mais necessitent des
// jumelles/un telescope -- geres a part via includeOuter.
// The 5 naked-eye planets, in their traditional order. Uranus/Neptune
// exist in astronomy-engine but need binoculars/a telescope -- handled
// separately via includeOuter.
const NAKED_EYE = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const OUTER = ["Uranus", "Neptune"];

function compassOf(azimuthDeg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(azimuthDeg / 22.5) % 16];
}

function visiblePlanets(lat, lon, elevationM, includeOuter, now) {
  const observer = new Astronomy.Observer(lat, lon, elevationM || 0);
  const bodies = includeOuter ? [...NAKED_EYE, ...OUTER] : NAKED_EYE;

  return bodies.map((name) => {
    const body = Astronomy.Body[name];
    const eq = Astronomy.Equator(body, now, observer, true, true);
    const hor = Astronomy.Horizon(now, observer, eq.ra, eq.dec, "normal");
    const illum = Astronomy.Illumination(body, now);

    // Lever/coucher dans les prochaines 24h (peut etre absent : un
    // corps circumpolaire depuis certaines latitudes, ou deja leve/
    // couche pour aujourd'hui selon l'heure de la requete).
    // Rise/set within the next 24h (can be absent: a circumpolar body
    // from some latitudes, or already risen/set for today depending on
    // the request's time).
    let rise = null, set = null;
    try { rise = Astronomy.SearchRiseSet(body, observer, 1, now, 1); } catch (e) { /* ignore */ }
    try { set = Astronomy.SearchRiseSet(body, observer, -1, now, 1); } catch (e) { /* ignore */ }

    return {
      name,
      altitude: hor.altitude,
      azimuth: hor.azimuth,
      compass: compassOf(hor.azimuth),
      magnitude: illum.mag,
      aboveHorizon: hor.altitude > 0,
      rise: rise ? rise.date.toISOString() : null,
      set: set ? set.date.toISOString() : null
    };
  });
}

/* Prochaine eclipse -- solaire ou lunaire, celle qui arrive en premier
   -- reellement VISIBLE depuis la position donnee, pas simplement
   "en cours quelque part sur Terre".

   Solaire : SearchLocalSolarEclipse calcule directement les
   circonstances locales (l'eclipse solaire ne concerne par nature que
   l'endroit ou l'ombre de la Lune touche terre, donc uniquement en plein
   jour a cet endroit).

   Lunaire : SearchLunarEclipse ne renvoie qu'un evenement GLOBAL (visible
   depuis a peu pres la moitie de la Terre, cote nuit) ; il faut verifier
   soi-meme que la Lune est au-dessus de l'horizon au moment du pic pour
   cette position precise, et chercher l'evenement suivant sinon.

   Next eclipse -- solar or lunar, whichever comes first -- actually
   VISIBLE from the given position, not merely "happening somewhere on
   Earth".

   Solar: SearchLocalSolarEclipse directly computes local circumstances
   (a solar eclipse by nature only concerns wherever the Moon's shadow
   touches the ground, so only during daytime at that spot).

   Lunar: SearchLunarEclipse only returns a GLOBAL event (visible from
   roughly half of Earth, the night side); the Moon's altitude at peak
   time must be checked for this exact position, searching the next
   event otherwise. */
function nextEclipse(lat, lon, elevationM, now) {
  const observer = new Astronomy.Observer(lat, lon, elevationM || 0);

  const solar = Astronomy.SearchLocalSolarEclipse(now, observer);

  let lunar = null;
  let ev = Astronomy.SearchLunarEclipse(now);
  // Une eclipse lunaire visible depuis un point donne n'arrive que ~1 a 2
  // fois par an en moyenne ; 12 essais couvre large tout en restant
  // instantane a calculer. A lunar eclipse visible from a given point
  // only happens ~1-2 times a year on average; 12 tries covers this with
  // room to spare while staying instant to compute.
  for (let i = 0; i < 12 && !lunar; i++) {
    const eq = Astronomy.Equator(Astronomy.Body.Moon, ev.peak, observer, true, true);
    const hor = Astronomy.Horizon(ev.peak, observer, eq.ra, eq.dec, "normal");
    if (hor.altitude > 0) lunar = { ev, altitude: hor.altitude };
    else ev = Astronomy.NextLunarEclipse(ev.peak);
  }

  const solarPick = { type: "solar", kind: solar.kind, peakTime: solar.peak.time.date, altitude: solar.peak.altitude, obscuration: solar.obscuration };
  const lunarPick = lunar ? { type: "lunar", kind: lunar.ev.kind, peakTime: lunar.ev.peak.date, altitude: lunar.altitude, obscuration: lunar.ev.obscuration } : null;

  if (!lunarPick) return solarPick;
  return solarPick.peakTime < lunarPick.peakTime ? solarPick : lunarPick;
}

module.exports = { moonPhase, visiblePlanets, nextEclipse };
