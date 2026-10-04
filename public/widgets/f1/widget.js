/* PiBoard widget: f1 / Formule 1.

   UNE TUILE, DES CARTES. La demande venait d'un tableau de bord Home
   Assistant ou chaque information est une carte posee a part. On garde
   l'idee -- prochaine course, programme, classements, resultats -- mais
   dans UNE tuile dont chaque carte s'affiche ou se cache. La raison est
   concrete : les cinq cartes vivent du MEME relevé. En tuiles separees,
   cinq tuiles interrogeraient cinq fois la meme API pour afficher cinq
   morceaux du meme objet, et le classement pourrait afficher une course
   d'avance sur les resultats pendant quelques minutes. Qui veut tout de
   meme repartir ses cartes sur le tableau pose plusieurs tuiles
   Formule 1 : elles partagent le cache du relais serveur.

   LA SOURCE. api.jolpi.ca/ergast, successeur communautaire d'Ergast
   (ferme fin 2024), gratuit, sans cle ni compte, et deja employe par la
   tuile Sports mecaniques. C'est aussi ce que lisent les integrations
   Home Assistant dont est partie la demande : memes donnees, memes
   chiffres.

   CE QU'ON N'EMBARQUE PAS, ET POURQUOI. Ni logos d'ecuries, ni photos de
   pilotes, ni plans de circuit officiels : ce sont des marques deposees
   et des visuels sous droits, et PiBoard est publie sous licence libre
   sur un depot public. La couleur d'ecurie et le code a trois lettres du
   pilote (ANT, HAM, VER) font le meme travail de reconnaissance
   immediate, et ne doivent rien a personne.

   ONE TILE, SEVERAL CARDS. The request came from a Home Assistant
   dashboard where each piece of information is its own card. The idea is
   kept -- next race, timetable, standings, results -- inside ONE tile
   whose cards are shown or hidden. The reason is concrete: the five
   cards live off the SAME reading. As separate tiles, five of them would
   query the same API five times to show five pieces of one object, and
   the standings could sit one race ahead of the results for a few
   minutes.

   WHAT IS NOT EMBEDDED, AND WHY: no team logos, no driver photos, no
   official circuit maps -- registered trademarks and copyrighted
   visuals, in a project published under a free licence on a public
   repository. The team colour and the driver's three-letter code do the
   same job of instant recognition and owe nothing to anyone. */
(function () {
  "use strict";

  const API = "https://api.jolpi.ca/ergast/f1";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Les couleurs d'ecurie sont des FAITS, pas des logos : une teinte
     n'est pas une marque, et c'est ce qui permet de reconnaitre une
     ecurie d'un coup d'oeil sans embarquer un seul visuel protege. La
     cle est l'identifiant stable de l'API, pas le nom affiche, qui
     change au gre des sponsors (« Red Bull » devient « Oracle Red Bull
     Racing » et retour).
     Team colours are FACTS, not logos. Keyed on the API's stable id
     rather than the display name, which follows the sponsors. */
  const TEAM_COLOR = {
    mercedes: "#00D7B6", ferrari: "#E8002D", red_bull: "#3671C6", mclaren: "#FF8000",
    aston_martin: "#229971", alpine: "#0093CC", williams: "#64C4FF", rb: "#6692FF",
    alphatauri: "#6692FF", sauber: "#52E252", alfa: "#52E252", haas: "#B6BABD",
    audi: "#52E252", cadillac: "#B6BABD", racing_bulls: "#6692FF"
  };

  /* Nationalite -> drapeau. L'API rend une nationalite en toutes lettres
     (« Italian », « British »), pas un code pays : il faut donc cette
     table. Le drapeau est un emoji et le code du pilote reste affiche a
     cote -- si la machine n'a pas de police emoji complete, ce qui
     arrive sur un Raspberry Pi minimal, le code porte toujours
     l'information. Un drapeau qui manque ne doit pas effacer la ligne.
     Nationality -> flag. The API returns a spelled-out nationality, not
     a country code. The flag is an emoji and the driver's code stays
     beside it: on a minimal Raspberry Pi without a full emoji font the
     code still carries the information. */
  const FLAG = {
    british: "🇬🇧", italian: "🇮🇹", dutch: "🇳🇱", german: "🇩🇪", french: "🇫🇷",
    spanish: "🇪🇸", monegasque: "🇲🇨", australian: "🇦🇺", mexican: "🇲🇽", canadian: "🇨🇦",
    japanese: "🇯🇵", thai: "🇹🇭", chinese: "🇨🇳", american: "🇺🇸", danish: "🇩🇰",
    finnish: "🇫🇮", "new zealander": "🇳🇿", brazilian: "🇧🇷", argentine: "🇦🇷",
    argentinian: "🇦🇷", belgian: "🇧🇪", swiss: "🇨🇭", austrian: "🇦🇹", swedish: "🇸🇪",
    polish: "🇵🇱", russian: "🇷🇺", irish: "🇮🇪", portuguese: "🇵🇹", colombian: "🇨🇴",
    venezuelan: "🇻🇪", indian: "🇮🇳", indonesian: "🇮🇩", "south african": "🇿🇦",
    malaysian: "🇲🇾", hungarian: "🇭🇺", czech: "🇨🇿", chilean: "🇨🇱", uruguayan: "🇺🇾",
    "american-italian": "🇺🇸", "east german": "🇩🇪", rhodesian: "🇿🇼", liechtensteiner: "🇱🇮"
  };

  /* Pays du circuit -> drapeau, pour l'en-tete de la prochaine course.
     L'API rend le pays en anglais. Circuit country -> flag. */
  const COUNTRY_FLAG = {
    bahrain: "🇧🇭", "saudi arabia": "🇸🇦", australia: "🇦🇺", japan: "🇯🇵", china: "🇨🇳",
    usa: "🇺🇸", "united states": "🇺🇸", italy: "🇮🇹", monaco: "🇲🇨", canada: "🇨🇦",
    spain: "🇪🇸", austria: "🇦🇹", uk: "🇬🇧", "united kingdom": "🇬🇧", hungary: "🇭🇺",
    belgium: "🇧🇪", netherlands: "🇳🇱", azerbaijan: "🇦🇿", singapore: "🇸🇬",
    mexico: "🇲🇽", brazil: "🇧🇷", qatar: "🇶🇦", uae: "🇦🇪", "united arab emirates": "🇦🇪",
    france: "🇫🇷", germany: "🇩🇪", portugal: "🇵🇹", russia: "🇷🇺", turkey: "🇹🇷",
    malaysia: "🇲🇾", korea: "🇰🇷", india: "🇮🇳", "south africa": "🇿🇦", argentina: "🇦🇷",
    switzerland: "🇨🇭", sweden: "🇸🇪", morocco: "🇲🇦"
  };

  function flagFor(table, value) {
    const k = String(value || "").trim().toLowerCase();
    return table[k] || "";
  }

  function colorFor(constructorId) {
    return TEAM_COLOR[String(constructorId || "").toLowerCase()] || "var(--muted)";
  }

  /* ---------- Dates et compte a rebours ----------
     L'API donne une date et une heure UTC separees ; `new Date(a + "T" +
     b)` n'est fiable que si l'on garde le « Z ». Un oubli de fuseau
     ici decalerait toutes les seances de deux heures en ete, ce qui ne
     se remarquerait pas sur une seance a 14 h mais ferait rater une
     qualification a minuit.
     The API gives a UTC date and time separately; the "Z" must be kept.
     A missing zone here would shift every session by two hours in
     summer. */
  function whenOf(obj) {
    if (!obj || !obj.date) return null;
    const iso = obj.date + "T" + (obj.time || "00:00:00Z");
    const t = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
    return Number.isFinite(t) ? t : null;
  }

  /* « 0j 09h 19m 53s ». On garde les jours meme a zero pendant le
     week-end : « 0j 09h » et « 09h » se lisent pareil, mais la colonne
     ne saute pas d'une seconde a l'autre, ce qui evite le papillotement
     d'un compte a rebours qui change de largeur.
     Days are kept even at zero so the column never jumps width, which
     avoids the flicker of a countdown changing size every second. */
  function countdown(ms, i18n) {
    if (ms == null) return "";
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const two = (n) => String(n).padStart(2, "0");
    return `${d}${i18n.t("f1.unit.d")} ${two(h)}${i18n.t("f1.unit.h")} ${two(m)}${i18n.t("f1.unit.m")} ${two(s)}${i18n.t("f1.unit.s")}`;
  }

  function dayTime(ms, locale) {
    if (ms == null) return "";
    const d = new Date(ms);
    const day = d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return day + " · " + time;
  }

  /* ---------- Lecture de la saison ----------
     Fonctions PURES : elles prennent le JSON de l'API et rendent ce que
     les cartes affichent, sans DOM ni reseau. C'est ce qui permet de
     tester la logique delicate -- quelle est la prochaine seance, un
     abandon n'est pas une vingtieme place -- sur des relevés figes.
     PURE functions: they take the API's JSON and return what the cards
     display, with no DOM and no network. */
  function parseRaces(json) {
    const races = (((json || {}).MRData || {}).RaceTable || {}).Races;
    if (!Array.isArray(races)) return null;
    return races.map((r) => {
      const sessions = [
        ["fp1", r.FirstPractice], ["fp2", r.SecondPractice], ["fp3", r.ThirdPractice],
        ["sprintQuali", r.SprintQualifying || r.SprintShootout], ["sprint", r.Sprint],
        ["quali", r.Qualifying], ["race", { date: r.date, time: r.time }]
      ].map(([kind, o]) => ({ kind, at: whenOf(o) })).filter((x) => x.at != null);
      sessions.sort((a, b) => a.at - b.at);
      const circuit = r.Circuit || {};
      const loc = circuit.Location || {};
      return {
        season: r.season, round: Number(r.round) || 0,
        name: r.raceName || "", url: r.url || null,
        circuitName: circuit.circuitName || "", circuitId: circuit.circuitId || "",
        country: loc.country || "", locality: loc.locality || "",
        lat: Number(loc.lat), lon: Number(loc.long),
        at: whenOf({ date: r.date, time: r.time }),
        sessions
      };
    });
  }

  /* La prochaine course est la premiere dont la COURSE n'est pas encore
     terminee -- pas la premiere dont la date est a venir. Pendant les
     deux heures d'un Grand Prix, la course a commence mais elle n'est
     pas finie : la prendre pour passee afficherait le week-end suivant
     au moment ou l'on regarde le plus la tuile. On laisse donc trois
     heures de grace apres le depart.
     The next race is the first whose RACE is not over yet -- not the
     first in the future. During a Grand Prix the race has started but is
     not finished: treating it as past would show next weekend precisely
     when the tile is looked at most. */
  const RACE_LENGTH_MS = 3 * 3600 * 1000;

  function nextRace(races, now) {
    if (!Array.isArray(races) || !races.length) return null;
    for (const r of races) {
      if (r.at != null && (r.at + RACE_LENGTH_MS) > now) return r;
    }
    return null;
  }

  function lastRace(races, now) {
    if (!Array.isArray(races)) return null;
    let found = null;
    for (const r of races) {
      if (r.at != null && r.at <= now) found = r;
    }
    return found;
  }

  /* La seance visee par le compte a rebours : la prochaine qui n'a pas
     commence. Hors week-end c'est la course, ce qui revient au meme ; le
     samedi matin c'est la qualification, et c'est la toute la
     difference entre une information utile et un chiffre decoratif.
     The session the countdown targets: the next one not yet started. */
  function nextSession(race, now) {
    if (!race) return null;
    for (const s of race.sessions) {
      if (s.at > now) return s;
    }
    return null;
  }

  function parseStandings(json, key) {
    const lists = ((((json || {}).MRData || {}).StandingsTable || {}).StandingsLists) || [];
    const list = lists[0];
    if (!list || !Array.isArray(list[key])) return null;
    return list[key];
  }

  /* Un ABANDON n'est pas une vingtieme place. L'API rend bien un
     classement final, mais le statut dit « Accident », « Engine »,
     « +1 Lap »... Afficher « 18e » pour une voiture partie au mur au
     deuxieme tour raconte une autre course que celle qui a eu lieu.
     A RETIREMENT is not a twentieth place. */
  function parseResults(json) {
    const races = (((json || {}).MRData || {}).RaceTable || {}).Races || [];
    const race = races[0];
    if (!race || !Array.isArray(race.Results)) return null;
    return {
      name: race.raceName || "", round: Number(race.round) || 0, season: race.season,
      rows: race.Results.map((r) => {
        const d = r.Driver || {};
        const c = (r.Constructor || {});
        const finished = /^Finished$/i.test(r.status || "") || /^\+/.test(r.status || "");
        return {
          position: Number(r.position) || null,
          code: d.code || (d.familyName || "").slice(0, 3).toUpperCase(),
          name: ((d.givenName || "") + " " + (d.familyName || "")).trim(),
          nationality: d.nationality || "",
          constructorId: c.constructorId || "", constructorName: c.name || "",
          points: Number(r.points) || 0,
          status: r.status || "",
          finished,
          gap: (r.Time && r.Time.time) || null,
          fastest: !!(r.FastestLap && String(r.FastestLap.rank) === "1")
        };
      })
    };
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

  class F1Widget {
    constructor(ctx) {
      this.ctx = ctx;
      this.data = null;
      this.error = null;
      this.circuit = null;
      this.timer = null;
      this.tick = null;
    }

    /* Le format de date vient des traductions. S'il manque -- traduction
       incomplete, cle renommee -- `toLocaleDateString` ne rend pas une
       date approximative : il LEVE une exception, et la tuile entiere
       disparait. Une etiquette manquante ne doit jamais couter
       l'affichage, surtout pas ici ou elle ne sert qu'a choisir entre
       « 04/10 » et « 10/04 ». Defaut trouve par le test, pas a la
       relecture.
       The date format comes from the translations. If it is missing,
       toLocaleDateString does not return an approximate date: it THROWS,
       and the whole tile vanishes. A missing label must never cost the
       display. Found by the test, not by re-reading. */
    locale() {
      const raw = this.ctx.i18n.t("clock.date.format");
      try {
        if (raw && typeof raw === "string") {
          new Intl.DateTimeFormat(raw);
          return raw;
        }
      } catch (e) { /* etiquette inutilisable / unusable label */ }
      return (typeof navigator !== "undefined" && navigator.language) || "fr-FR";
    }

    season() {
      const raw = String(this.ctx.settings.season || "").trim();
      return /^\d{4}$/.test(raw) ? raw : "current";
    }

    init() {
      this.render();
      this.refresh();
      this.arm();
      /* Le compte a rebours bat a la seconde, SANS toucher au reseau :
         seule la ligne du chrono est reecrite. Redessiner toute la tuile
         chaque seconde ferait clignoter les tableaux et perdrait la
         position de defilement.
         The countdown ticks every second WITHOUT touching the network:
         only the chrono line is rewritten. */
      this.tick = setInterval(() => this.paintCountdown(), 1000);
    }

    onSettingsChanged(settings) {
      const before = this.season();
      this.ctx.settings = settings || this.ctx.settings;
      if (this.season() !== before) this.data = null;
      this.render();
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    arm() {
      clearTimeout(this.timer);
      const mins = Math.max(5, Math.min(360, Number(this.ctx.settings.refreshMinutes) || 30));
      this.timer = setTimeout(() => this.refresh(), mins * 60000);
    }

    async fetchJson(url) {
      const res = await fetch(this.ctx.api.proxyUrl(url), { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }

    /* UN SEUL RELEVE POUR TOUTES LES CARTES. Les quatre appels partent
       ensemble et, surtout, chaque carte absente n'est pas demandee :
       afficher la seule carte « Prochaine course » ne doit pas couter
       quatre requetes a une API communautaire gratuite, qui limite le
       debit et que tout le monde partage.
       ONE READING FOR EVERY CARD, and a card not shown is not fetched:
       displaying only "Next race" must not cost four requests to a free
       community API everyone shares. */
    async refresh() {
      const s = this.ctx.settings;
      const y = this.season();
      /* LA CARTE DU CIRCUIT COMPTE PARMI CELLES QUI ONT BESOIN DU
         CALENDRIER : c'est lui qui donne le circuit du week-end et ses
         coordonnees. L'oublier laissait une tuile montrant le SEUL plan
         du circuit eternellement en chargement -- sans erreur, sans
         message, puisque rien n'avait echoue : la question n'avait
         simplement jamais ete posee. Defaut trouve par le test de bout
         en bout, pas a la relecture.
         THE CIRCUIT CARD IS ONE OF THOSE NEEDING THE CALENDAR: it is
         what gives the weekend's circuit and its coordinates. Omitting
         it left a tile showing ONLY the circuit map loading forever --
         no error, no message, since nothing had failed: the question
         had simply never been asked. Found by the end-to-end test. */
      const needRaces = s.showNext !== false || s.showSchedule !== false || s.showCircuit !== false;
      const jobs = [
        needRaces ? this.fetchJson(`${API}/${y}.json?limit=100`) : Promise.resolve(null),
        s.showDrivers !== false ? this.fetchJson(`${API}/${y}/driverStandings.json?limit=100`) : Promise.resolve(null),
        s.showConstructors !== false ? this.fetchJson(`${API}/${y}/constructorStandings.json?limit=100`) : Promise.resolve(null),
        s.showResults !== false ? this.fetchJson(`${API}/${y}/last/results.json?limit=100`) : Promise.resolve(null)
      ];
      try {
        const [races, drivers, constructors, results] = await Promise.all(jobs);
        this.data = {
          races: races ? parseRaces(races) : null,
          drivers: drivers ? parseStandings(drivers, "DriverStandings") : null,
          constructors: constructors ? parseStandings(constructors, "ConstructorStandings") : null,
          results: results ? parseResults(results) : null,
          at: Date.now()
        };
        this.error = null;
      } catch (e) {
        /* Une erreur ne doit pas effacer ce qu'on affichait : un
           classement d'il y a vingt minutes vaut mieux qu'une tuile
           vide, et la ligne du bas dit depuis quand il date.
           An error must not wipe what was displayed. */
        this.error = String((e && e.message) || e);
      }
      this.render();
      if (this.ctx.settings.showCircuit !== false) this.refreshCircuit();
    }

    /* LE TRACE EST CHARGE A PART, ET NON AVEC LE RESTE. Overpass met
       plusieurs secondes a repondre et renvoie bien plus d'octets que
       tout le reste de la tuile reuni. L'attendre retarderait le compte
       a rebours et les classements, qui n'en ont pas besoin ; et une
       panne d'Overpass -- il arrive qu'il soit sature -- ne doit pas
       priver la tuile de son classement.
       LOADED SEPARATELY: Overpass takes seconds and returns more bytes
       than all the rest put together. Waiting for it would delay the
       countdown and the standings, and an Overpass outage must not cost
       the tile its standings. */
    async refreshCircuit() {
      const race = nextRace(this.data && this.data.races || [], Date.now())
        || lastRace(this.data && this.data.races || [], Date.now());
      if (!race || !race.circuitId || !Number.isFinite(race.lat) || !Number.isFinite(race.lon)) return;
      if (this.circuit && this.circuit.id === race.circuitId) return;

      /* Un trace ne change pas d'une semaine a l'autre : on le garde
         cote serveur, par circuit. Changer de Grand Prix ne doit pas
         rappeler Overpass pour un circuit deja vu.
         An outline does not change from one week to the next: it is
         kept server-side, per circuit. */
      const key = "f1.circuit." + race.circuitId;
      try {
        const cached = await this.ctx.api.state.get(key);
        if (cached && Array.isArray(cached.ways) && cached.ways.length) {
          this.circuit = { id: race.circuitId, ways: cached.ways, name: race.circuitName };
          this.render();
          return;
        }
      } catch (e) { /* pas de cache, on demande / no cache, we ask */ }

      try {
        const json = await this.fetchJson(overpassUrl(race.lat, race.lon));
        const ways = parseCircuit(json);
        if (!ways.length) { this.circuit = { id: race.circuitId, ways: [], name: race.circuitName }; this.render(); return; }
        this.circuit = { id: race.circuitId, ways, name: race.circuitName };
        this.ctx.api.state.put(key, { ways, at: Date.now() }).catch(() => { });
      } catch (e) {
        this.circuit = { id: race.circuitId, ways: [], name: race.circuitName, error: String((e && e.message) || e) };
      }
      this.render();
    }

    render() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const el = this.ctx.el;

      if (!this.data) {
        el.innerHTML = `<div class="pw-f1"><div class="pwf1-msg">${esc(i18n.t(this.error ? "f1.error" : "f1.loading"))}</div></div>`;
        return;
      }

      const now = Date.now();
      const wanted = [
        s.showNext !== false ? () => this.cardNext(now) : null,
        s.showSchedule !== false ? () => this.cardSchedule(now) : null,
        s.showDrivers !== false ? () => this.cardDrivers() : null,
        s.showConstructors !== false ? () => this.cardConstructors() : null,
        s.showResults !== false ? () => this.cardResults() : null,
        s.showCircuit !== false ? () => this.cardCircuit() : null
      ].filter(Boolean);

      /* UNE SEULE CARTE COCHEE : LA TUILE DEVIENT CETTE CARTE. Plus de
         cadre interne, plus de titre interne -- la barre de titre de la
         tuile en tient lieu, et elle se renomme dans les reglages
         universels.

         C'EST LA REPONSE AU VRAI BESOIN : on ne peut pas deplacer ni
         redimensionner des cartes a l'interieur d'une tuile, et il
         serait absurde de rebatir une grille dans la grille. PiBoard en
         a deja une, excellente. Pour disposer les cartes librement, on
         pose donc PLUSIEURS tuiles Formule 1 en ne cochant qu'une carte
         dans chacune : chaque carte devient alors une vraie tuile, qui
         se deplace et se redimensionne comme n'importe quelle autre. Le
         relais serveur partage le cache, donc cinq tuiles ne coutent
         pas cinq fois plus de requetes -- l'argument qui m'avait fait
         preferer une tuile unique ne tenait pas.

         ONE CARD TICKED: THE TILE BECOMES THAT CARD -- no inner frame,
         no inner title, the tile's own title bar does the job. This is
         the answer to the real need: cards cannot be moved or resized
         inside a tile, and rebuilding a grid inside the grid would be
         absurd when PiBoard already has an excellent one. To arrange the
         cards freely, place SEVERAL Formula 1 tiles with a single card
         ticked in each. The relay shares its cache, so five tiles do not
         cost five times the requests -- the argument that made me prefer
         a single tile did not hold. */
      this.solo = wanted.length === 1;
      const cards = wanted.map((fn) => fn());

      const body = cards.filter(Boolean).join("");
      el.innerHTML = `
        <div class="pw-f1${this.solo ? " pwf1-solo" : ""}${this.skinClass()}" ${this.skinStyle()}>
          ${body || `<div class="pwf1-msg">${esc(i18n.t("f1.noCard"))}</div>`}
          ${this.error ? `<div class="pwf1-stale">${esc(i18n.t("f1.stale"))}</div>` : ""}
        </div>`;
      this.paintCountdown();
    }

    /* Le chrono est reecrit a part, a la seconde. Il porte sa cible dans
       un attribut : si la tuile n'a pas ete redessinee depuis, le
       chrono reste juste.
       The chrono is rewritten separately, every second; it carries its
       target in an attribute so it stays right between renders. */
    paintCountdown() {
      const el = this.ctx.el.querySelector("[data-cd]");
      if (!el) return;
      const target = Number(el.dataset.cd);
      if (!Number.isFinite(target)) return;
      const left = target - Date.now();
      el.textContent = countdown(left, this.ctx.i18n);
      el.classList.toggle("pwf1-cd-now", left <= 0);
    }

    /* LE STYLE « PISTE ». Deux classes seulement, et aucune couleur en
       dur dans le HTML : la carte lit des variables CSS, ce qui laisse
       le theme de la page decider en mode « theme » et l'utilisateur
       decider en mode « couleur choisie ». Les couleurs du texte ne sont
       PAS reprises du theme en mode sombre, sinon un theme clair
       ecrirait du gris anthracite sur du noir.
       THE "TRACK" SKIN. Two classes and no hard-coded colour in the
       HTML: the card reads CSS variables, so the page theme decides in
       theme mode and the user decides in custom mode. */
    skinClass() {
      const v = String(this.ctx.settings.cardStyle || "theme");
      if (v === "dark") return " pwf1-skin-dark";
      if (v === "custom") return " pwf1-skin-dark pwf1-skin-custom";
      return "";
    }

    skinStyle() {
      if (String(this.ctx.settings.cardStyle || "theme") !== "custom") return "";
      /* La couleur vient d'un selecteur de couleur, donc deja au format
         `#rrggbb` -- mais elle finit dans un attribut `style`, et une
         valeur inattendue y injecterait du CSS. On ne fait pas
         confiance, on verifie.
         The colour comes from a colour picker, so it is already
         `#rrggbb` -- but it ends up in a `style` attribute, where an
         unexpected value would inject CSS. We verify rather than
         trust. */
      const raw = String(this.ctx.settings.cardColor || "").trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return "";
      return `style="--pwf1-skin-bg: ${raw}"`;
    }

    card(title, inner, extraClass) {
      /* En solo, le titre interne ferait doublon avec la barre de titre
         de la tuile, qui porte deja le nom -- et que l'on peut renommer
         (« Pilotes 2026 ») dans les reglages universels.
         In solo mode the inner title would duplicate the tile's own
         title bar, which can be renamed in the universal settings. */
      const head = this.solo ? "" : `<h3 class="pwf1-card-title">${esc(title)}</h3>`;
      return `<section class="pwf1-card${extraClass ? " " + extraClass : ""}">${head}${inner}</section>`;
    }

    cardNext(now) {
      const i18n = this.ctx.i18n;
      const race = nextRace(this.data.races || [], now);
      if (!race) return this.card(i18n.t("f1.card.next"), `<div class="pwf1-msg">${esc(i18n.t("f1.seasonOver"))}</div>`);

      const sess = nextSession(race, now);
      const target = sess ? sess.at : race.at;
      const label = sess ? i18n.t("f1.session." + sess.kind) : i18n.t("f1.session.race");
      const flag = flagFor(COUNTRY_FLAG, race.country);

      return this.card(i18n.t("f1.card.next"), `
        <div class="pwf1-next">
          <div class="pwf1-next-head">
            ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
            <span class="pwf1-round">${esc(String(race.round))}</span>
            <span class="pwf1-race">${esc(race.name)}</span>
          </div>
          <div class="pwf1-next-sub">${esc(race.circuitName)}${race.locality ? " · " + esc(race.locality) : ""}</div>
          <div class="pwf1-cd-wrap">
            <span class="pwf1-cd-label">${esc(label)}</span>
            <span class="pwf1-cd" data-cd="${target}"></span>
          </div>
          <div class="pwf1-next-when">${esc(dayTime(target, this.locale()))}</div>
        </div>`);
    }

    cardSchedule(now) {
      const i18n = this.ctx.i18n;
      const race = nextRace(this.data.races || [], now) || lastRace(this.data.races || [], now);
      if (!race) return this.card(i18n.t("f1.card.schedule"), `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);

      /* Une seance « en cours » est une seance commencee depuis moins
         d'une heure et demie : l'API ne donne aucune heure de fin, et
         l'inventer plus large ferait briller trois seances a la fois.
         A "live" session is one started less than ninety minutes ago:
         the API gives no end time. */
      const LIVE_MS = 90 * 60000;
      const rows = race.sessions.map((x) => {
        const live = x.at <= now && (now - x.at) < LIVE_MS;
        const past = x.at + LIVE_MS <= now;
        return `<div class="pwf1-sess${live ? " pwf1-sess-live" : ""}${past ? " pwf1-sess-past" : ""}">
          <span class="pwf1-sess-name">${esc(i18n.t("f1.session." + x.kind))}</span>
          <span class="pwf1-sess-when">${esc(dayTime(x.at, this.locale()))}</span>
        </div>`;
      }).join("");

      return this.card(i18n.t("f1.card.schedule"),
        `<div class="pwf1-sched"><div class="pwf1-sched-head">${esc(race.name)}</div>${rows}</div>`);
    }

    cardDrivers() {
      const i18n = this.ctx.i18n;
      const list = this.data.drivers;
      if (!list || !list.length) return this.card(i18n.t("f1.card.drivers"), `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);
      const n = Math.max(3, Math.min(24, Number(this.ctx.settings.driverRows) || 10));
      const colors = this.ctx.settings.showTeamColors !== false;

      const rows = list.slice(0, n).map((x) => {
        const d = x.Driver || {};
        const c = (x.Constructors || [])[0] || {};
        const flag = flagFor(FLAG, d.nationality);
        return `<tr>
          <td class="pwf1-pos">${esc(x.position)}</td>
          <td class="pwf1-who">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(c.constructorId)}"></span>` : ""}
            ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
            <span class="pwf1-code">${esc(d.code || "")}</span>
            <span class="pwf1-name">${esc(((d.givenName || "") + " " + (d.familyName || "")).trim())}</span>
            ${d.permanentNumber ? `<span class="pwf1-num">#${esc(d.permanentNumber)}</span>` : ""}
          </td>
          <td class="pwf1-pts">${esc(x.points)}</td>
          <td class="pwf1-wins">${esc(x.wins)}</td>
        </tr>`;
      }).join("");

      return this.card(i18n.t("f1.card.drivers"), `
        <table class="pwf1-table">
          <thead><tr><th></th><th>${esc(i18n.t("f1.th.driver"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th><th>${esc(i18n.t("f1.th.wins"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    cardConstructors() {
      const i18n = this.ctx.i18n;
      const list = this.data.constructors;
      if (!list || !list.length) return this.card(i18n.t("f1.card.constructors"), `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);
      const n = Math.max(3, Math.min(12, Number(this.ctx.settings.constructorRows) || 10));
      const colors = this.ctx.settings.showTeamColors !== false;

      const rows = list.slice(0, n).map((x) => {
        const c = x.Constructor || {};
        return `<tr>
          <td class="pwf1-pos">${esc(x.position)}</td>
          <td class="pwf1-who">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(c.constructorId)}"></span>` : ""}
            <span class="pwf1-name">${esc(c.name || "")}</span>
          </td>
          <td class="pwf1-pts">${esc(x.points)}</td>
          <td class="pwf1-wins">${esc(x.wins)}</td>
        </tr>`;
      }).join("");

      return this.card(i18n.t("f1.card.constructors"), `
        <table class="pwf1-table">
          <thead><tr><th></th><th>${esc(i18n.t("f1.th.team"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th><th>${esc(i18n.t("f1.th.wins"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    /* ---------- La carte du circuit ---------- */
    cardCircuit() {
      const i18n = this.ctx.i18n;
      const c = this.circuit;
      const title = i18n.t("f1.card.circuit");
      if (!c) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.loading"))}</div>`);
      if (!c.ways.length) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.circuit.none"))}</div>`);

      /* Le dessin se fait dans un repere fixe de 1000 x 620, et c'est le
         `viewBox` qui le met a l'echelle de la tuile. Un SVG recalcule a
         chaque redimensionnement couterait un reflow par pixel tire a la
         souris ; la, le navigateur ne fait qu'un changement d'echelle,
         et le trait reste net a toute taille -- c'est l'interet du
         vectoriel.
         Drawing happens in a fixed 1000 x 620 space and the `viewBox`
         scales it to the tile. Recomputing the SVG on every resize would
         cost a reflow per pixel dragged; here the browser merely
         rescales, and the line stays crisp at any size -- which is the
         whole point of vector. */
      const W = 1000, H = 620;

      /* LES ETIQUETTES SE DECIDENT AVANT LA PROJECTION, parce qu'elles
         changent la marge : un nom de virage est ecrit DE PART ET
         D'AUTRE de son point, et « Pangkor Laut Chicane » pose sur un
         virage du bord gauche depasse largement du cadre. Sans marge
         laterale elargie, la moitie des noms sortait du dessin -- vu a
         l'ecran, pas devine.
         LABELS ARE DECIDED BEFORE PROJECTING, because they change the
         margin: a corner name is written on BOTH SIDES of its point, so
         one placed on a left-edge corner runs well outside the frame.
         Seen on screen, not guessed. */
      const named = c.ways.filter((w) => w.corner && !w.pit && w.name).length;
      const withLabels = named > 0 && named <= 16;
      const ways = projectCircuit(c.ways, W, H, withLabels ? 96 : 26, withLabels ? 34 : 26);
      if (!ways) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.circuit.none"))}</div>`);

      const track = ways.filter((w) => !w.pit);
      const pit = ways.filter((w) => w.pit);
      const arrow = directionArrow(ways);

      /* Les virages NOMMES seulement, et seulement s'ils tiennent : une
         carte de huit centimetres couverte d'etiquettes ne se lit plus.
         Au-dela de douze, on n'en met aucune plutot que d'en choisir
         douze au hasard.
         NAMED corners only, and only if they fit. */
      const corners = [];
      const seen = new Set();
      for (const w of ways) {
        if (!withLabels || !w.corner || w.pit || !w.name || seen.has(w.name)) continue;
        seen.add(w.name);
        const mid = w.xy[Math.floor(w.xy.length / 2)];
        /* Pres d'un bord, le nom n'est plus centre sur son virage mais
           pousse vers l'interieur : mieux vaut un nom legerement decale
           qu'un nom coupe en deux par le bord du dessin.
           Near an edge the name is pushed inwards: a slightly offset
           name beats one cut in half by the edge. */
        const anchor = mid[0] < 150 ? "start" : (mid[0] > W - 150 ? "end" : "middle");
        corners.push({
          name: w.name.replace(/\s*(corner|turn)\s*$/i, ""),
          x: Math.min(W - 6, Math.max(6, mid[0])),
          y: Math.min(H - 8, Math.max(16, mid[1])),
          anchor
        });
      }

      const paths = track.map((w) =>
        `<path class="pwf1-circ-track" d="${toPath(w.xy)}"/>`).join("");
      /* La voie des stands en pointilles : c'est du bitume, mais ce
         n'est pas la piste, et les confondre fausse la lecture du
         trace.
         The pit lane dashed: it is tarmac, but it is not the track. */
      const pits = pit.map((w) =>
        `<path class="pwf1-circ-pit" d="${toPath(w.xy)}"/>`).join("");

      const dir = arrow
        ? `<g class="pwf1-circ-dir" transform="translate(${arrow.x.toFixed(1)} ${arrow.y.toFixed(1)}) rotate(${arrow.angle.toFixed(1)})">
             <path d="M -13 -11 L 15 0 L -13 11 Z"/>
           </g>`
        : "";

      const labels = corners.length
        ? corners.map((k) => `<text class="pwf1-circ-label" text-anchor="${k.anchor}" x="${k.x.toFixed(1)}" y="${k.y.toFixed(1)}">${esc(k.name)}</text>`).join("")
        : "";

      return this.card(title, `
        <div class="pwf1-circ">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
               aria-label="${esc(c.name || title)}">
            ${pits}${paths}${dir}${labels}
          </svg>
          <div class="pwf1-circ-foot">
            <span class="pwf1-circ-name">${esc(c.name || "")}</span>
            <span class="pwf1-circ-src">${esc(i18n.t("f1.circuit.credit"))}</span>
          </div>
        </div>`);
    }

    cardResults() {
      const i18n = this.ctx.i18n;
      const res = this.data.results;
      if (!res || !res.rows.length) return this.card(i18n.t("f1.card.results"), `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);
      const n = Math.max(3, Math.min(24, Number(this.ctx.settings.resultRows) || 10));
      const colors = this.ctx.settings.showTeamColors !== false;

      const rows = res.rows.slice(0, n).map((r) => {
        const flag = flagFor(FLAG, r.nationality);
        /* L'ecart au vainqueur quand il existe, le STATUT sinon : un
           abandon s'affiche « Accident » ou « Moteur », pas « 18e ».
           The gap when there is one, the STATUS otherwise. */
        const right = r.finished && r.gap ? r.gap : (r.finished ? "" : r.status);
        return `<tr class="${r.finished ? "" : "pwf1-dnf"}">
          <td class="pwf1-pos">${r.finished ? esc(r.position) : "—"}</td>
          <td class="pwf1-who">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(r.constructorId)}"></span>` : ""}
            ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
            <span class="pwf1-code">${esc(r.code)}</span>
            <span class="pwf1-name">${esc(r.name)}</span>
            ${r.fastest ? `<span class="pwf1-fast" title="${esc(i18n.t("f1.fastestLap"))}">⏱</span>` : ""}
          </td>
          <td class="pwf1-gap">${esc(right)}</td>
          <td class="pwf1-pts">${esc(r.points)}</td>
        </tr>`;
      }).join("");

      return this.card(i18n.t("f1.card.results") + " · " + res.name, `
        <table class="pwf1-table">
          <thead><tr><th></th><th>${esc(i18n.t("f1.th.driver"))}</th><th>${esc(i18n.t("f1.th.gap"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    destroy() {
      clearTimeout(this.timer);
      clearInterval(this.tick);
    }
  }

  window.PiBoard.registerWidget("f1", F1Widget);

  /* Expose pour les tests : les fonctions pures, qui n'ont besoin ni du
     DOM ni du reseau. Exposed for tests: the pure helpers. */
  window.PiBoardF1Helpers = {
    parseRaces, parseStandings, parseResults, nextRace, lastRace, nextSession,
    parseCircuit, projectCircuit, directionArrow, overpassUrl,
    countdown, whenOf, colorFor, flagFor, FLAG, COUNTRY_FLAG, TEAM_COLOR, RACE_LENGTH_MS
  };
})();
