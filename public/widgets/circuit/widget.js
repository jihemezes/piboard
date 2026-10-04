/* PiBoard widget: circuit / Plan du circuit.

   POURQUOI UNE TUILE A PART, ET NON UNE CARTE DE LA TUILE FORMULE 1.
   Le plan du circuit a d'abord ete une carte parmi d'autres dans la
   tuile Formule 1. Trois raisons l'en ont sorti, et la demande est
   venue de l'usage, pas de la theorie.

   1. CE N'EST PAS LA MEME DONNEE. Les autres cartes lisent le MEME
      releve d'une API de course : un classement, un calendrier, des
      resultats. Le trace, lui, vient d'OpenStreetMap, ne change jamais,
      et n'a rien a voir avec la saison en cours. Le loger a cote d'un
      classement obligeait une tuile a dependre de deux services sans
      rapport, dont l'un tombait regulierement.

   2. IL A SES PROPRES REGLAGES. Epingler un circuit, afficher ou non la
      fiche technique, les numeros de virages, la meteo : cinq reglages
      qui n'interessent que lui, noyes parmi ceux des classements.

   3. IL A BESOIN D'UNE BASE. Un trace est une donnee statique qu'on a
      tout interet a relever UNE fois et a garder. Cette base porte en
      plus ce qu'OpenStreetMap ne sait pas -- longueur, nombre de tours,
      record du tour -- et n'avait aucune raison de vivre dans une tuile
      de championnat.

   WHY A TILE OF ITS OWN rather than a card of the Formula 1 tile. The
   circuit map began as one card among others. Three reasons took it
   out, and they came from use rather than theory. (1) IT IS NOT THE
   SAME DATA: the other cards read the SAME reading of a racing API,
   while the outline comes from OpenStreetMap, never changes, and has
   nothing to do with the current season -- housing it beside a standings
   table made one tile depend on two unrelated services, one of which
   fell over regularly. (2) IT HAS ITS OWN SETTINGS. (3) IT NEEDS A
   BASE: an outline is static data, worth surveying ONCE and keeping,
   and that base also carries what OSM does not know.

   CE QU'ON N'EMBARQUE PAS. Les plans officiels de la Formule 1 sont des
   visuels sous droits : aucun n'est embarque. Le trace est DESSINE a
   partir d'OpenStreetMap (ODbL, cite dans la carte). Ni logo, ni police
   sous licence, ni livree d'ecurie.
   WHAT IS NOT EMBEDDED: official Formula 1 circuit maps are copyrighted
   visuals; none are embedded. The outline is DRAWN from OpenStreetMap
   (ODbL, credited in the card). */
(function () {
  "use strict";

  const API = "https://api.jolpi.ca/ergast/f1";
  const CATALOG_URL = "api/circuit-catalog";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dayTime(ms, locale) {
    if (ms == null) return "";
    const d = new Date(ms);
    return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })
      + " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  /* L'API rend la date et l'heure separement, et l'heure porte deja son
     « Z ». Une seance sans heure (il en reste dans l'historique) vaut
     minuit UTC : sans le Z force, le navigateur lirait minuit LOCAL et
     la seance glisserait d'un fuseau.
     The API returns date and time separately. A session without a time
     means midnight UTC; without the forced Z the browser would read
     LOCAL midnight. */
  function whenOf(obj) {
    if (!obj || !obj.date) return null;
    const time = obj.time && /\d/.test(obj.time) ? obj.time : "00:00:00Z";
    const iso = obj.date + "T" + (/[zZ]$/.test(time) ? time : time + "Z");
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  /* On ne lit du calendrier QUE ce dont cette tuile a besoin : quel
     circuit, ou il est, et quand se courent ses seances. Le reste --
     classements, resultats, ecuries -- appartient a la tuile Formule 1
     et n'a pas a etre recopie ici.
     Only what THIS tile needs is read from the calendar: which circuit,
     where it is, and when its sessions run. */
  function parseCalendar(json) {
    const races = (((json || {}).MRData || {}).RaceTable || {}).Races;
    if (!Array.isArray(races)) return null;
    return races.map((r) => {
      const c = r.Circuit || {};
      const loc = c.Location || {};
      const sessions = [
        ["fp1", r.FirstPractice], ["fp2", r.SecondPractice], ["fp3", r.ThirdPractice],
        ["sprintQuali", r.SprintQualifying || r.SprintShootout], ["sprint", r.Sprint],
        ["quali", r.Qualifying], ["race", { date: r.date, time: r.time }]
      ].map(([kind, o]) => ({ kind, at: whenOf(o) })).filter((x) => x.at != null)
        .sort((a, b) => a.at - b.at);
      return {
        round: Number(r.round) || 0,
        name: r.raceName || "",
        circuitId: c.circuitId || "",
        circuitName: c.circuitName || "",
        country: loc.country || "",
        locality: loc.locality || "",
        lat: Number(loc.lat),
        lon: Number(loc.long),
        at: whenOf({ date: r.date, time: r.time }),
        sessions
      };
    });
  }

  /* Une course COMMENCEE reste « la course du moment » pendant trois
     heures : pendant le depart, c'est elle qu'on regarde, pas la
     suivante.
     A STARTED race stays "the current race" for three hours. */
  const RACE_LENGTH_MS = 3 * 3600000;

  function currentRace(races, now) {
    if (!Array.isArray(races) || !races.length) return null;
    const next = races.filter((r) => r.at != null && r.at + RACE_LENGTH_MS > now)
      .sort((a, b) => a.at - b.at)[0];
    if (next) return next;
    /* Saison finie : on montre le DERNIER circuit visite plutot qu'une
       tuile vide. Un plan de circuit n'est pas une information perimable
       comme un classement -- entre decembre et mars, le dernier circuit
       reste la meilleure reponse possible.
       Season over: the LAST circuit visited is shown rather than an
       empty tile. An outline does not go stale like a standings table. */
    return races.filter((r) => r.at != null).sort((a, b) => a.at - b.at).slice(-1)[0] || null;
  }

  function nextSession(race, now) {
    if (!race || !Array.isArray(race.sessions)) return null;
    return race.sessions.find((s) => s.at > now) || null;
  }

  /* ---------- La carte du circuit ----------
     D'OU VIENT LE TRACE. Les plans officiels de la Formule 1 sont des
     visuels sous droits : on ne les embarque pas. Le tracé est donc
     dessine a partir d'OpenStreetMap (donnees ODbL, attribution faite
     dans la carte), interroge par Overpass autour des coordonnees que
     l'API Ergast donne pour chaque circuit. Resultat : un trace
     vectoriel, net a toute taille, qui suit le theme et ne doit rien a
     personne.

     CE QU'ON Y TROUVE, ET CE QU'ON N'Y TROUVE PAS. OSM porte le tracé,
     le SENS de la course (`oneway`), la voie des stands, et le NOM de
     certains virages -- verifie a Sepang : « Berjaya Tioman Corner »,
     « Kenyir Lake Corner ». En revanche, ni les NUMEROS de virages, ni
     les SECTEURS : les points de chronometrage S1/S2/S3 ne sont publies
     nulle part en donnees ouvertes. On pourrait colorer trois tiers de
     tour egaux, mais ce serait faux -- et une carte qui invente ses
     secteurs est pire qu'une carte sans secteurs.

     WHERE THE OUTLINE COMES FROM: official Formula 1 circuit maps are
     copyrighted, so they are not embedded. The outline is drawn from
     OpenStreetMap (ODbL, attributed in the card) through Overpass,
     around the coordinates Ergast gives for each circuit. OSM carries
     the outline, the racing DIRECTION, the pit lane and SOME corner
     names -- but neither corner NUMBERS nor SECTORS: the S1/S2/S3
     timing points are published nowhere as open data. Colouring three
     equal thirds would be a lie, and a map that invents its sectors is
     worse than one without. */
  const OVERPASS = "https://overpass-api.de/api/interpreter";
  const CORNER_RE = /(corner|turn|curve|curva|kurve|virage|chicane|bend|hairpin|esses)/i;
  const PIT_RE = /(pit ?lane|voie des stands|boxes)/i;
  /* UN NOM PUREMENT NUMERIQUE EST UN NUMERO DE VIRAGE. Verifie dans la
     donnee reelle de Sepang : a cote de « Genting Curve » et « Kenyir
     Lake Corner », OSM porte des tronçons nommes « 3 », « 10 », « 12 »,
     « 13 », « 15 ». Les numeros de virages existent donc en donnees
     ouvertes -- partiellement, circuit par circuit, selon ce que les
     contributeurs ont saisi. On les affiche la ou ils sont, et on n'en
     invente aucun ailleurs. Ce sont bien les SECTEURS, et eux seuls, qui
     n'existent nulle part.
     A PURELY NUMERIC NAME IS A CORNER NUMBER, verified in Sepang's real
     data. Corner numbers DO exist in open data -- partially, circuit by
     circuit, according to what contributors entered. They are shown
     where they exist and invented nowhere. It is the SECTORS, and they
     alone, that exist nowhere. */
  const CORNER_NUM_RE = /^\s*\d{1,2}[a-z]?\s*$/i;

  /* CE QUI PORTE `highway=raceway` SANS ETRE LE GRAND PRIX. Releve dans
     la vraie reponse d'Overpass autour de Sepang : deux tronçons de
     karting, et un circuit de motocross/quadcross sur terre. Les
     inclure collerait d'autres pistes au milieu du tracé.
     WHAT CARRIES `highway=raceway` WITHOUT BEING THE GRAND PRIX,
     observed in Overpass's real answer around Sepang: two karting
     segments and a dirt motocross/quadcross track. */
  const OTHER_SPORT_RE = /(karting|motocross|quadcross|rallycross|autocross|cyclo|bmx|speedway)/i;
  const LOOSE_SURFACE_RE = /(unpaved|dirt|ground|gravel|sand|grass|earth|compacted)/i;

  function overpassUrl(lat, lon) {
    const q = `[out:json][timeout:25];way[highway=raceway](around:2200,${lat},${lon});out geom;`;
    return OVERPASS + "?data=" + encodeURIComponent(q);
  }

  /* Fonction PURE. On ne cherche PAS a rechainer les tronçons en une
     boucle unique : un circuit est decoupe en dizaines de « ways » dont
     les extremites ne se rejoignent pas toujours proprement, et un
     mauvais rechainage dessinerait un trait a travers le paddock. Les
     tronçons sont donc traces tels quels, les uns a cote des autres --
     a l'ecran, ils forment le circuit.
     PURE function. Segments are NOT re-chained into a single loop: a
     circuit is cut into dozens of ways whose ends do not always meet
     cleanly, and a bad re-chaining would draw a line across the
     paddock. */
  function parseCircuit(json) {
    const els = (json && Array.isArray(json.elements)) ? json.elements : [];
    const ways = [];
    for (const e of els) {
      if (!e || e.type !== "way" || !Array.isArray(e.geometry) || e.geometry.length < 2) continue;
      const tags = e.tags || {};
      /* Le karting voisin porte le meme `highway=raceway` : l'inclure
         collerait une seconde piste au milieu du Grand Prix.
         The neighbouring karting track carries the same tag. */
      if (OTHER_SPORT_RE.test(tags.sport || "")) continue;
      /* Un Grand Prix ne se court pas sur de la terre : la surface suffit
         a ecarter ce que le `sport` n'a pas dit.
         A Grand Prix is not run on dirt. */
      if (LOOSE_SURFACE_RE.test(tags.surface || "")) continue;
      const name = tags.name || tags["name:en"] || "";
      ways.push({
        name,
        pit: PIT_RE.test(name),
        corner: CORNER_RE.test(name) || CORNER_NUM_RE.test(name),
        oneway: tags.oneway === "yes",
        pts: e.geometry.map((g) => [Number(g.lat), Number(g.lon)]).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
      });
    }
    return mainLoop(ways.filter((w) => w.pts.length >= 2));
  }

  /* ON NE GARDE QUE LE CIRCUIT PRINCIPAL, et c'est indispensable. Un
     complexe de circuit contient d'autres pistes bitumees qui ne sont
     pas le Grand Prix : la vraie reponse d'Overpass autour de Sepang
     renvoie un « Handling Circuit » -- une piste d'essais, bitume,
     `sport=motor`, donc impossible a ecarter par ses etiquettes -- situe
     a plusieurs centaines de metres au nord. La dessiner ne ferait pas
     seulement une tache en trop : elle agrandit le cadre commun, et le
     Grand Prix lui-meme se retrouve ecrase dans un coin. Aucun reglage
     n'y changerait rien, puisque la mise a l'echelle part des extremes.

     La regle est geometrique et non nominale : on groupe les tronçons
     qui se TOUCHENT (ils partagent leurs noeuds d'extremite, au metre),
     et on garde le groupe le plus long. Les variantes de tracé -- « North
     Circuit », « South Circuit » -- partagent leurs noeuds avec la piste
     principale et sont donc conservees : c'est bien le meme bitume.

     ONLY THE MAIN CIRCUIT IS KEPT, and this is essential. Sepang's real
     Overpass answer includes a "Handling Circuit" -- a test track,
     asphalt, `sport=motor`, impossible to rule out by its tags -- several
     hundred metres north. Drawing it would not merely add a blob: it
     enlarges the shared bounding box, and the Grand Prix itself ends up
     squashed in a corner. The rule is geometric, not nominal: segments
     that TOUCH are grouped and the longest group is kept. Layout
     variants share their nodes with the main track and are kept -- it is
     the same tarmac. */
  function mainLoop(ways) {
    if (ways.length < 2) return ways;
    const key = (p) => p[0].toFixed(5) + "," + p[1].toFixed(5);
    const parent = ways.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

    const at = new Map();
    ways.forEach((w, i) => {
      /* TOUS les noeuds, et non les seules extremites. J'avais commence
         par les extremites, en croyant eviter de relier deux pistes qui
         se croisent par-dessus. C'etait inutile et couteux : dans OSM,
         deux voies qui se croisent SANS jonction ne partagent aucun
         noeud -- c'est la convention, et c'est ce qui distingue un pont
         d'un carrefour. En revanche une voie des stands se raccorde
         souvent au MILIEU d'un tronçon de piste, et la regle des
         extremites la jetait : sur la donnee reelle de Sepang, deux des
         trois tronçons de la voie des stands disparaissaient.
         ALL nodes, not just the ends. I started with the ends, thinking
         it would avoid joining two tracks that cross over one another.
         That was both useless and costly: in OSM, two ways that cross
         WITHOUT a junction share no node -- that is the convention, and
         it is what tells a bridge from a crossroads. A pit lane, on the
         other hand, often joins the MIDDLE of a track segment, and the
         end-points rule threw it away: on Sepang's real data, two of the
         three pit-lane segments vanished. */
      for (const p of w.pts) {
        const k = key(p);
        if (at.has(k)) join(at.get(k), i); else at.set(k, i);
      }
    });

    const span = (w) => {
      let d = 0;
      for (let i = 1; i < w.pts.length; i++) {
        d += Math.abs(w.pts[i][0] - w.pts[i - 1][0]) + Math.abs(w.pts[i][1] - w.pts[i - 1][1]);
      }
      return d;
    };
    const total = new Map();
    ways.forEach((w, i) => {
      const r = find(i);
      total.set(r, (total.get(r) || 0) + span(w));
    });
    let best = null;
    for (const [r, d] of total) if (!best || d > best.d) best = { r, d };
    return ways.filter((_, i) => find(i) === best.r);
  }

  /* Projection equirectangulaire avec correction en cosinus : sans
     elle, un circuit proche de l'equateur passe encore, mais Silverstone
     (52° N) serait etire du double en largeur. On n'a pas besoin de plus
     savant -- un circuit tient dans quelques kilometres.
     Equirectangular projection with cosine correction: without it
     Silverstone (52°N) would come out twice too wide. */
  function projectCircuit(ways, width, height, pad, padY) {
    const all = [];
    for (const w of ways) for (const p of w.pts) all.push(p);
    if (!all.length) return null;
    const lats = all.map((p) => p[0]);
    const lons = all.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const kx = Math.cos(midLat * Math.PI / 180);

    const w0 = (maxLon - minLon) * kx;
    const h0 = (maxLat - minLat);
    if (!(w0 > 0) && !(h0 > 0)) return null;
    const py = Number.isFinite(padY) ? padY : pad;
    const inner = { w: width - pad * 2, h: height - py * 2 };
    const scale = Math.min(inner.w / (w0 || 1e-9), inner.h / (h0 || 1e-9));
    const offX = pad + (inner.w - w0 * scale) / 2;
    const offY = py + (inner.h - h0 * scale) / 2;

    const project = ([lat, lon]) => [
      offX + (lon - minLon) * kx * scale,
      /* La latitude croit vers le NORD, l'axe Y d'un SVG vers le BAS :
         sans cette inversion, le circuit serait dessine en miroir --
         juste assez ressemblant pour qu'on ne s'en apercoive pas tout
         de suite, et completement faux.
         Latitude grows NORTH, an SVG's Y axis grows DOWN: without this
         flip the circuit would be mirrored -- just similar enough not to
         be noticed at once, and completely wrong. */
      offY + (maxLat - lat) * scale
    ];
    return ways.map((w) => Object.assign({}, w, { xy: w.pts.map(project) }));
  }

  function toPath(xy) {
    return xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  }

  /* La fleche du sens de la course, posee au milieu du plus long
     tronçon a sens unique : c'est la ou le trait est le plus droit,
     donc la ou une fleche se lit.
     The direction arrow sits at the midpoint of the longest one-way
     segment: where the line is straightest, hence where an arrow
     reads. */
  function directionArrow(ways) {
    let best = null;
    for (const w of ways) {
      if (!w.oneway || w.pit || !w.xy || w.xy.length < 2) continue;
      const a = w.xy[0], b = w.xy[w.xy.length - 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!best || len > best.len) best = { len, w };
    }
    if (!best) return null;
    const xy = best.w.xy;
    const i = Math.max(1, Math.floor(xy.length / 2));
    const from = xy[i - 1], to = xy[i];
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
    return { x: to[0], y: to[1], angle };
  }

  /* ---------- La meteo du circuit ----------
     LA METEO D'UNE COURSE N'EST PAS LA METEO D'UN LIEU. Un bulletin
     « 24 degres, averses » pour Spa ne dit rien d'utile : ce qu'on vient
     chercher, c'est s'il pleuvra PENDANT les qualifications, qui durent
     une heure et qui ont lieu samedi a 16 h. La carte donne donc une
     ligne par SEANCE, avec la prevision a l'heure de cette seance -- et
     non la meteo du moment, qui ne concerne personne.

     POURQUOI LA PROBABILITE DE PLUIE EST MISE EN AVANT. En Formule 1,
     c'est le seul chiffre qui change une course : la temperature decide
     de la gomme, le vent gene en courbe rapide, mais la pluie
     rebat les cartes. Elle est donc coloree des qu'elle devient
     significative.

     L'HEURE DE REFERENCE EST L'UTC, DE BOUT EN BOUT. L'API des courses
     donne ses horaires en UTC ; la meteo est demandee en UTC
     (`timezone=UTC`) et appariee en UTC. Convertir en route -- vers le
     fuseau du circuit ou vers celui du spectateur -- n'apporterait rien
     et ouvrirait la porte a un decalage d'une heure deux fois par an,
     au changement d'heure. La conversion se fait UNE fois, a
     l'affichage, comme pour le programme du week-end.

     A RACE'S WEATHER IS NOT A PLACE'S WEATHER. "24 degrees, showers" for
     Spa says nothing useful: what one comes for is whether it will rain
     DURING qualifying, which lasts an hour and happens on Saturday at
     4pm. So the card gives one line per SESSION, with the forecast for
     that session's hour. UTC is the reference throughout: the race API
     gives UTC, the weather is requested in UTC and matched in UTC.
     Converting along the way would invite a one-hour slip twice a year,
     at the daylight-saving change. */
  const METEO = "https://api.open-meteo.com/v1/forecast";

  /* Le meme tableau WMO que la tuile Meteo. Il est RECOPIE et non
     partage : les tuiles de PiBoard sont independantes par construction
     -- chacune se charge seule, se desinstalle seule, et aucune ne doit
     cesser de fonctionner parce qu'une autre a ete retiree. Huit lignes
     recopiees valent mieux qu'une dependance entre tuiles.
     The same WMO table as the Weather tile, COPIED rather than shared:
     PiBoard's tiles are independent by construction -- each loads and is
     removed on its own, and none must break because another was
     uninstalled. */
  const WMO = [
    { codes: [0], icon: "☀", fr: "Ciel dégagé", en: "Clear sky" },
    { codes: [1, 2], icon: "⛅", fr: "Partiellement nuageux", en: "Partly cloudy" },
    { codes: [3], icon: "☁", fr: "Couvert", en: "Overcast" },
    { codes: [45, 48], icon: "🌫", fr: "Brouillard", en: "Fog" },
    { codes: [51, 53, 55, 56, 57], icon: "🌦", fr: "Bruine", en: "Drizzle" },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], icon: "🌧", fr: "Pluie", en: "Rain" },
    { codes: [71, 73, 75, 77, 85, 86], icon: "🌨", fr: "Neige", en: "Snow" },
    { codes: [95, 96, 99], icon: "⛈", fr: "Orage", en: "Thunderstorm" }
  ];

  function describeWeather(code) {
    return WMO.find((w) => w.codes.includes(Number(code))) || null;
  }

  function weatherUrl(lat, lon) {
    return METEO + `?latitude=${lat}&longitude=${lon}`
      + "&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m"
      + "&forecast_days=7&timezone=UTC";
  }

  /* Fonction PURE : la reponse horaire d'Open-Meteo devient une table
     indexee par l'heure UTC pleine. Open-Meteo rend ses heures sous la
     forme « 2026-10-04T14:00 », SANS fuseau : il faut ajouter le Z nous-
     memes, sinon le navigateur les lit comme des heures LOCALES et toute
     la meteo glisse d'autant d'heures que le decalage du spectateur.
     PURE function. Open-Meteo returns hours as "2026-10-04T14:00" with
     NO zone: the Z must be added, otherwise the browser reads them as
     LOCAL times and the whole forecast slides by the viewer's offset. */
  function parseWeather(json) {
    const h = (json || {}).hourly;
    if (!h || !Array.isArray(h.time) || !h.time.length) return null;
    const by = new Map();
    for (let i = 0; i < h.time.length; i++) {
      const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(h.time[i]) ? h.time[i] : h.time[i] + "Z");
      if (!Number.isFinite(t)) continue;
      by.set(t, {
        at: t,
        temp: num(h.temperature_2m, i),
        rain: num(h.precipitation_probability, i),
        wind: num(h.wind_speed_10m, i),
        code: num(h.weather_code, i)
      });
    }
    return by.size ? by : null;
  }

  function num(arr, i) {
    const v = Array.isArray(arr) ? arr[i] : null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  /* On arrondit a l'heure pleine la plus PROCHE, et non a l'heure
     inferieure : une course a 14 h 50 se court sous le temps de 15 h,
     pas sous celui de 14 h. Et au-dela d'une heure et demie d'ecart on
     ne rend rien : l'horizon d'Open-Meteo est de sept jours, et une
     seance plus lointaine n'a pas de prevision -- le dire vaut mieux que
     montrer la derniere heure connue comme si elle s'appliquait.
     Rounded to the NEAREST full hour, not down: a race at 2:50pm runs in
     3pm's weather. Beyond ninety minutes nothing is returned: Open-Meteo
     reaches seven days, and a session further out has no forecast --
     saying so beats showing the last known hour as if it applied. */
  function weatherAt(table, when) {
    if (!table || !Number.isFinite(when)) return null;
    const HOUR = 3600000;
    const near = Math.round(when / HOUR) * HOUR;
    const hit = table.get(near);
    if (hit) return hit;
    for (const delta of [HOUR, -HOUR]) {
      const alt = table.get(near + delta);
      if (alt && Math.abs(alt.at - when) <= 1.5 * HOUR) return alt;
    }
    return null;
  }

  class CircuitWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.catalog = null;
      this.calendar = null;
      this.circuit = null;      /* { id, name, ways, specs, source, error } */
      this.weather = null;
      this.timer = null;
    }

    locale() {
      const raw = this.ctx.i18n.t("clock.date.format");
      try {
        if (raw && typeof raw === "string") { new Intl.DateTimeFormat(raw); return raw; }
      } catch (e) { /* etiquette inutilisable / unusable label */ }
      return (typeof navigator !== "undefined" && navigator.language) || "fr-FR";
    }

    init() {
      this.render();
      this.refresh();
      this.arm();
    }

    onSettingsChanged(settings) {
      const before = String(this.ctx.settings.circuit || "");
      this.ctx.settings = settings || this.ctx.settings;
      if (String(this.ctx.settings.circuit || "") !== before) this.circuit = null;
      this.render();
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    arm() {
      clearTimeout(this.timer);
      /* Six heures par defaut, et non trente minutes. Un trace ne change
         jamais ; ce qui bouge, c'est le circuit du week-end (une fois
         par semaine) et la meteo (lentement). Relever toutes les demi-
         heures ne ferait que du bruit chez trois services gratuits.
         Six hours by default: an outline never changes; what moves is
         the weekend's circuit (once a week) and the weather (slowly). */
      const mins = Math.max(30, Math.min(1440, Number(this.ctx.settings.refreshMinutes) || 360));
      this.timer = setTimeout(() => this.refresh(), mins * 60000);
    }

    async fetchJson(url) {
      const res = await fetch(this.ctx.api.proxyUrl(url), { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }

    async refresh() {
      await this.loadCatalog();
      await this.resolveCircuit();
      if (this.ctx.settings.showWeather !== false) await this.loadWeather();
      this.render();
    }

    /* La base est demandee au SERVEUR et non au depot : c'est lui qui
       garde le cache sur disque, valide le fichier et ne recule jamais
       de version. Une tuile qui irait chercher le fichier elle-meme
       devrait refaire tout cela, mal, et une fois par tuile posee.
       The base is asked of the SERVER, not the repository: the server
       keeps the on-disk cache, validates the file and never goes back a
       version. */
    async loadCatalog() {
      if (this.catalog) return;
      try {
        const r = await fetch(CATALOG_URL, { cache: "no-store" });
        const body = await r.json();
        const cat = (body && body.catalog) || body;
        this.catalog = (cat && cat.circuits && typeof cat.circuits === "object") ? cat : null;
      } catch (e) {
        this.catalog = null;
      }
    }

    /* QUEL CIRCUIT ? Soit celui qu'on a epingle dans les reglages, soit
       celui du Grand Prix en cours -- et dans ce cas seulement, le
       calendrier est demande. Epingler Spa toute l'annee ne doit couter
       aucun appel a l'API des courses.
       WHICH CIRCUIT? Either the one pinned in the settings, or the
       current Grand Prix's -- and only in that case is the calendar
       asked for. Pinning Spa all year must cost no call to the racing
       API. */
    async wantedId() {
      const pinned = String(this.ctx.settings.circuit || "").trim();
      if (pinned) return { id: pinned, race: null };

      if (!this.calendar) {
        try {
          this.calendar = parseCalendar(await this.fetchJson(`${API}/current.json?limit=100`));
        } catch (e) {
          this.calendar = null;
        }
      }
      const race = currentRace(this.calendar || [], Date.now());
      return race ? { id: race.circuitId, race } : { id: "", race: null };
    }

    async resolveCircuit() {
      const { id, race } = await this.wantedId();
      this.race = race;
      if (!id) { this.circuit = { id: "", ways: [], error: "no-race" }; return; }
      if (this.circuit && this.circuit.id === id && this.circuit.ways.length) return;

      const entry = this.catalog && this.catalog.circuits[id];

      /* LA BASE SAIT AUSSI QU'ELLE N'A PAS DE TRACE, et cette
         information vaut mieux que son absence. Un circuit marque
         `incomplete` emprunte des routes ouvertes a la circulation :
         OpenStreetMap n'en porte qu'une fraction, et la dessiner
         donnerait un quart de Monaco presente comme Monaco. On
         n'interroge donc PAS Overpass en repli -- il renverrait
         exactement ce morceau -- et on garde la fiche technique, qui
         est juste, avec un message qui dit pourquoi.
         THE BASE ALSO KNOWS WHEN IT HAS NO OUTLINE, and that is worth
         more than its absence. A circuit marked `incomplete` runs on
         ordinary public roads; OSM carries only a fraction of the lap
         and drawing it would pass a quarter of Monaco off as Monaco. So
         Overpass is NOT asked as a fallback -- it would return exactly
         that fragment -- and the spec sheet, which is correct, is
         kept. */
      if (entry && entry.incomplete && (!entry.ways || !entry.ways.length)) {
        this.circuit = {
          id, name: entry.name || (race && race.circuitName) || id,
          ways: [], specs: entry.specs || null, source: "base", error: "absent"
        };
        return;
      }

      if (entry && Array.isArray(entry.ways) && entry.ways.length) {
        this.circuit = {
          id,
          name: entry.name || (race && race.circuitName) || id,
          ways: entry.ways.map((w) => ({
            name: w.n || "",
            pit: PIT_RE.test(w.n || ""),
            corner: CORNER_RE.test(w.n || "") || CORNER_NUM_RE.test(w.n || ""),
            oneway: !!w.o,
            pts: w.p
          })),
          specs: entry.specs || null,
          start: Array.isArray(entry.start) ? entry.start : null,
          source: "base"
        };
        return;
      }

      /* REPLI SUR OVERPASS pour un circuit que la base ne connait pas
         encore -- un Grand Prix inedit, par exemple. C'est le seul cas
         ou la tuile depend d'un service lent et sature, et c'est la
         rancon de ne pas obliger a une mise a jour pour un circuit neuf.
         FALLBACK TO OVERPASS for a circuit the base does not know yet.
         It is the only case where the tile depends on a slow, saturated
         service, and it is the price of not forcing an update for a
         brand-new circuit. */
      const lat = race ? race.lat : null;
      const lon = race ? race.lon : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        this.circuit = { id, name: (race && race.circuitName) || id, ways: [], error: "unknown" };
        return;
      }
      try {
        const ways = parseCircuit(await this.fetchJson(overpassUrl(lat, lon)));
        this.circuit = {
          id, name: (race && race.circuitName) || id, ways,
          specs: null, start: null, source: "overpass",
          /* UNE REPONSE VIDE N'EST PAS UNE PANNE, et les confondre est
             exactement l'erreur qui a fait croire que Sepang manquait.
             Overpass a repondu : ce circuit n'est pas dans OpenStreetMap
             sous la forme d'une piste. C'est le cas d'Albert Park, trace
             sur des routes publiques ordinaires.
             AN EMPTY ANSWER IS NOT AN OUTAGE, and confusing the two is
             exactly the mistake that made Sepang look missing. */
          error: ways.length ? null : "absent"
        };
      } catch (e) {
        /* UNE PANNE EST UNE PANNE, et le dit. L'ancienne version
           affichait « aucun trace dans OpenStreetMap » quand Overpass
           repondait 504 : une defaillance presentee comme un fait sur la
           donnee. C'est le pire genre de message, parce qu'il est
           credible et qu'il clot la question.
           AN OUTAGE IS AN OUTAGE, and says so. The old version displayed
           "no outline in OpenStreetMap" when Overpass answered 504: a
           failure presented as a fact about the data -- the worst kind of
           message, because it is credible and closes the question. */
        this.circuit = {
          id, name: (race && race.circuitName) || id, ways: [],
          error: "unreachable", detail: String((e && e.message) || e)
        };
      }
    }

    async loadWeather() {
      const race = this.race;
      if (!race || !Number.isFinite(race.lat) || !Number.isFinite(race.lon)) { this.weather = null; return; }
      try {
        this.weather = { table: parseWeather(await this.fetchJson(weatherUrl(race.lat, race.lon))) };
      } catch (e) {
        this.weather = { table: null };
      }
    }

    /* ---------- Rendu / rendering ---------- */

    render() {
      const i18n = this.ctx.i18n;
      const el = this.ctx.el;
      const c = this.circuit;

      if (!c) {
        el.innerHTML = `<div class="pw-circuit"><div class="pwcir-msg">${esc(i18n.t("circuit.loading"))}</div></div>`;
        return;
      }
      if (!c.ways.length) {
        /* Quatre situations, quatre messages. Les confondre, c'est
           mentir sur trois d'entre elles -- et c'est exactement
           l'erreur qui a fait croire qu'un circuit manquait alors
           qu'Overpass etait simplement en panne.
           Four situations, four messages. Confusing them lies about
           three of them -- and that is exactly the mistake that made a
           circuit look missing when Overpass was merely down. */
        const key = c.error === "unreachable" ? "circuit.unreachable"
          : c.error === "absent" ? "circuit.absent"
            : c.error === "no-race" ? "circuit.noRace" : "circuit.unknown";
        /* MEME SANS TRACE, LA FICHE TECHNIQUE RESTE AFFICHEE. Longueur,
           virages, tours et record sont justes et ne dependent pas
           d'OpenStreetMap : les cacher parce que le dessin manque
           priverait d'une information exacte au motif qu'une autre est
           absente.
           EVEN WITHOUT AN OUTLINE THE SPEC SHEET STAYS: those facts are
           correct and owe nothing to OpenStreetMap. */
        el.innerHTML = `<div class="pw-circuit">
          <div class="pwcir-msg">${esc(i18n.t(key))}</div>
          ${c.specs && this.ctx.settings.showSpecs !== false ? this.specs() : ""}
          <div class="pwcir-foot">
            <span class="pwcir-name">${esc(this.title())}</span>
            <span class="pwcir-src">${esc(this.credit())}</span>
          </div>
        </div>`;
        return;
      }

      el.innerHTML = `<div class="pw-circuit">
        ${this.map()}
        ${this.ctx.settings.showSpecs !== false ? this.specs() : ""}
        ${this.ctx.settings.showWeather !== false ? this.weatherLine() : ""}
        <div class="pwcir-foot">
          <span class="pwcir-name">${esc(this.title())}</span>
          <span class="pwcir-src">${esc(this.credit())}</span>
        </div>
      </div>`;
    }

    title() {
      const c = this.circuit;
      const race = this.race;
      /* Le nom du circuit, et le Grand Prix seulement quand on suit le
         calendrier : un circuit epingle hors saison n'a pas de Grand
         Prix a afficher, et en inventer un serait faux.
         The circuit's name, and the Grand Prix only when following the
         calendar. */
      if (!this.ctx.settings.circuit && race && race.name) return c.name + " · " + race.name;
      return c.name || "";
    }

    map() {
      const c = this.circuit;
      const W = 1000, H = 620;
      const showCorners = this.ctx.settings.showCorners !== false;
      const named = c.ways.filter((w) => w.corner && !w.pit && w.name).length;
      const withLabels = showCorners && named > 0 && named <= 16;
      const ways = projectCircuit(c.ways, W, H, withLabels ? 96 : 26, withLabels ? 34 : 26);
      if (!ways) return `<div class="pwcir-msg">${esc(this.ctx.i18n.t("circuit.absent"))}</div>`;

      const track = ways.filter((w) => !w.pit);
      const pit = ways.filter((w) => w.pit);
      const arrow = this.ctx.settings.showDirection !== false ? directionArrow(ways) : null;

      const corners = [];
      const seen = new Set();
      for (const w of ways) {
        if (!withLabels || !w.corner || w.pit || !w.name || seen.has(w.name)) continue;
        seen.add(w.name);
        const mid = w.xy[Math.floor(w.xy.length / 2)];
        corners.push({
          name: w.name.replace(/\s*(corner|turn)\s*$/i, ""),
          x: Math.min(W - 6, Math.max(6, mid[0])),
          y: Math.min(H - 8, Math.max(16, mid[1])),
          anchor: mid[0] < 150 ? "start" : (mid[0] > W - 150 ? "end" : "middle")
        });
      }

      const dir = arrow
        ? `<g class="pwcir-dir" transform="translate(${arrow.x.toFixed(1)} ${arrow.y.toFixed(1)}) rotate(${arrow.angle.toFixed(1)})">
             <path d="M -13 -11 L 15 0 L -13 11 Z"/></g>`
        : "";

      return `<div class="pwcir-map">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(c.name || "")}">
          ${pit.map((w) => `<path class="pwcir-pit" d="${toPath(w.xy)}"/>`).join("")}
          ${track.map((w) => `<path class="pwcir-track" d="${toPath(w.xy)}"/>`).join("")}
          ${dir}
          ${corners.map((k) => `<text class="pwcir-label" text-anchor="${k.anchor}" x="${k.x.toFixed(1)}" y="${k.y.toFixed(1)}">${esc(k.name)}</text>`).join("")}
        </svg>
      </div>`;
    }

    /* LA FICHE TECHNIQUE NE MONTRE QUE CE QUE LA BASE PORTE. Un circuit
       releve mais sans fiche n'affiche rien plutot qu'une rangee de
       tirets : une ligne vide fait croire a une donnee perdue, alors
       qu'elle n'a simplement jamais ete saisie.
       THE SPEC SHEET SHOWS ONLY WHAT THE BASE CARRIES. A circuit with an
       outline but no specs shows nothing rather than a row of dashes. */
    /* ON NE CITE QUE CE QU'ON MONTRE. La tuile creditait Open-Meteo
       meme lorsque la meteo etait decochee : un credit pour une donnee
       absente n'est pas une politesse de trop, c'est une information
       fausse -- et la prochaine personne qui lit l'ecran croit que la
       tuile interroge un service qu'elle n'appelle jamais.
       WE CREDIT ONLY WHAT WE SHOW. The tile credited Open-Meteo even
       when the weather was unticked: a credit for data that is not
       there is not politeness, it is a false statement. */
    credit() {
      const i18n = this.ctx.i18n;
      const parts = [i18n.t("circuit.credit.osm")];
      if (this.ctx.settings.showWeather !== false) parts.push(i18n.t("circuit.credit.meteo"));
      return parts.join(" · ");
    }

    specs() {
      const s = this.circuit.specs;
      if (!s) return "";
      const i18n = this.ctx.i18n;
      const items = [];
      if (Number.isFinite(s.lengthM)) items.push([i18n.t("circuit.spec.length"), (s.lengthM / 1000).toFixed(3).replace(/0$/, "") + " km"]);
      if (Number.isFinite(s.turns)) items.push([i18n.t("circuit.spec.turns"), String(s.turns)]);
      if (Number.isFinite(s.laps)) items.push([i18n.t("circuit.spec.laps"), String(s.laps)]);
      if (Number.isFinite(s.raceKm)) items.push([i18n.t("circuit.spec.distance"), s.raceKm.toFixed(1) + " km"]);
      /* LE LIEU ET L'ANNEE viennent de Wikidata et de l'API des courses,
         et sont connus pour presque tous les circuits -- contrairement
         au nombre de virages, que personne ne publie en donnees
         ouvertes. Les afficher donne une fiche utile la ou elle serait
         restee a une seule ligne.
         PLACE AND YEAR come from Wikidata and the racing API and are
         known for nearly every circuit -- unlike the number of turns,
         which nobody publishes as open data. */
      const place = [s.locality, s.country].filter(Boolean).join(", ");
      if (place) items.push([i18n.t("circuit.spec.place"), place]);
      if (Number.isFinite(s.openedYear)) items.push([i18n.t("circuit.spec.opened"), String(s.openedYear)]);
      if (Array.isArray(s.series) && s.series.length) {
        items.push([i18n.t("circuit.spec.series"), s.series.map((x) => i18n.t("circuit.series." + x)).join(" · ")]);
      }
      if (!items.length && !s.lapRecord) return "";

      const rec = s.lapRecord && s.lapRecord.time
        ? `<div class="pwcir-record"><span class="pwcir-rec-label">${esc(i18n.t("circuit.spec.record"))}</span>
             <span class="pwcir-rec-time">${esc(s.lapRecord.time)}</span>
             <span class="pwcir-rec-who">${esc([s.lapRecord.driver, s.lapRecord.year].filter(Boolean).join(" · "))}</span></div>`
        : "";

      return `<div class="pwcir-specs">
        ${items.map(([k, v]) => `<div class="pwcir-spec"><span class="pwcir-spec-k">${esc(k)}</span><span class="pwcir-spec-v">${esc(v)}</span></div>`).join("")}
        ${rec}
      </div>`;
    }

    /* UNE SEULE LIGNE DE METEO, celle de la prochaine seance. La tuile
       Formule 1 porte le tableau complet seance par seance ; le repeter
       ici ferait deux fois le meme travail et mangerait la place du
       trace, qui est la raison d'etre de cette tuile.
       ONE WEATHER LINE, for the next session. The Formula 1 tile carries
       the full session-by-session table; repeating it here would eat the
       room the outline needs. */
    weatherLine() {
      const i18n = this.ctx.i18n;
      if (!this.weather || !this.weather.table || !this.race) return "";
      const sess = nextSession(this.race, Date.now());
      if (!sess) return "";
      const w = weatherAt(this.weather.table, sess.at);
      if (!w) return "";
      const cond = describeWeather(w.code);
      const rain = w.rain != null ? Math.round(w.rain) : null;
      return `<div class="pwcir-wx">
        <span class="pwcir-wx-sess">${esc(i18n.t("f1.session." + sess.kind))}</span>
        <span class="pwcir-wx-when">${esc(dayTime(sess.at, this.locale()))}</span>
        <span class="pwcir-wx-cond">${cond ? cond.icon : "–"}</span>
        <span class="pwcir-wx-temp">${w.temp != null ? esc(Math.round(w.temp) + "°") : "–"}</span>
        <span class="pwcir-wx-rain${rain != null && rain >= 30 ? " pwcir-wx-wet" : ""}">${rain != null ? esc(rain + "%") : "–"}</span>
      </div>`;
    }

    destroy() { clearTimeout(this.timer); }
  }

  window.PiBoard.registerWidget("circuit", CircuitWidget);

  /* Expose pour les tests : les fonctions pures, sans DOM ni reseau.
     Exposed for tests: the pure helpers. */
  window.PiBoardCircuitHelpers = {
    parseCalendar, currentRace, nextSession, whenOf,
    parseCircuit, projectCircuit, directionArrow, toPath, overpassUrl,
    parseWeather, weatherAt, weatherUrl, describeWeather,
    CORNER_RE, CORNER_NUM_RE, PIT_RE, RACE_LENGTH_MS
  };
})();
