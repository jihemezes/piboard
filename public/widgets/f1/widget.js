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

  /* ---------- Les seances du week-end (1.161.0) ----------
     ESSAIS LIBRES, QUALIFICATIONS, SPRINT, GRILLE : sept cartes
     facultatives, une par seance. Deux sources, chacune pour ce qu'elle
     sait faire :
       - jolpica (deja utilisee) : qualifications et course sprint, avec
         les noms, les ecuries et les temps Q1 / Q2 / Q3 ;
       - OpenF1 (gratuite, sans cle) : essais libres, qualifications
         sprint -- que jolpica n'a jamais publies -- et les PNEUS du
         meilleur tour. Elle sert aussi de secours aux deux autres.
     Une seance non encore courue n'est PAS demandee : on affiche son
     horaire. Une seance terminee est gardee en memoire et n'est relue
     que rarement ; seule la seance en cours est relue souvent, avec le
     badge EN DIRECT.
     THE WEEKEND'S SESSIONS: seven optional cards, one per session. Two
     sources, each for what it does well: jolpica (qualifying, sprint) and
     OpenF1 (free practice, sprint qualifying, tyres of the best lap),
     which also backs the other two up. A session not yet run is NOT
     requested; a finished one is kept and rarely re-read; only the
     session under way is re-read often, with the LIVE badge. */
  const OPENF1 = "https://api.openf1.org/v1";
  const SESSION_KINDS = ["fp1", "fp2", "fp3", "sprintQuali", "sprint", "quali"];
  const SESSION_BLOCKS = { fp1: "fp1", fp2: "fp2", fp3: "fp3", sprintQuali: "sprintQuali", sprint: "sprint", quali: "quali", grid: "quali" };
  const OPENF1_NAMES = {
    fp1: ["Practice 1"], fp2: ["Practice 2"], fp3: ["Practice 3"],
    sprintQuali: ["Sprint Qualifying", "Sprint Shootout"], sprint: ["Sprint"], quali: ["Qualifying"]
  };
  /* Durees prevues, pour savoir si une seance est EN COURS. Expected
     lengths, to know whether a session is under way. */
  const SESSION_MINUTES = { fp1: 60, fp2: 60, fp3: 60, sprintQuali: 50, sprint: 45, quali: 70 };
  const LIVE_GRACE_MS = 10 * 60000;

  /* Le week-end affiche : celui qui est EN COURS (douze heures avant la
     premiere seance jusqu'a trois heures apres la course), sinon le
     dernier Grand Prix couru, sinon -- avant la premiere course -- la
     prochaine. The weekend displayed: the one under way, else the last
     Grand Prix run, else the next one. */
  function weekendRace(races, now) {
    if (!Array.isArray(races) || !races.length) return null;
    for (const r of races) {
      if (r.at == null) continue;
      const first = r.sessions && r.sessions.length ? r.sessions[0].at : r.at;
      if (now >= first - 12 * 3600000 && now <= r.at + RACE_LENGTH_MS) return r;
    }
    return lastRace(races, now) || nextRace(races, now);
  }

  /* La seance en cours, ou null. The session under way, or null. */
  function liveSession(race, now) {
    if (!race || !Array.isArray(race.sessions)) return null;
    for (const s of race.sessions) {
      const len = SESSION_MINUTES[s.kind];
      if (!len) continue;
      if (now >= s.at && now <= s.at + len * 60000 + LIVE_GRACE_MS) return s.kind;
    }
    return null;
  }

  function sessionAt(race, kind) {
    const s = race && Array.isArray(race.sessions) ? race.sessions.find((x) => x.kind === kind) : null;
    return s ? s.at : null;
  }

  /* « 1:18.518 » -> 78.518 ; null si vide. */
  function parseLapTime(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(v).trim());
    if (!m) return null;
    return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  }

  /* 78.518 -> « 1:18.518 » ; 59.2 -> « 59.200 ». */
  function fmtLapTime(sec) {
    if (sec == null || !Number.isFinite(sec)) return "";
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    const ss = s.toFixed(3).padStart(m ? 6 : 1, "0");
    return m ? m + ":" + ss : ss;
  }

  function fmtGapTime(sec) {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return "";
    return "+" + sec.toFixed(3);
  }

  /* Les pneus : la gomme du meilleur tour, en une lettre.
     Tyres: the compound of the best lap, as one letter. */
  const TYRE = {
    SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W"
  };
  function tyreLetter(compound) { return TYRE[String(compound || "").toUpperCase()] || ""; }

  /* Gomme du meilleur tour de chaque pilote, a partir des tours et des
     relais d'OpenF1. Un pilote sans tour chronometre n'a pas de pastille.
     Compound of each driver's best lap, from OpenF1's laps and stints. */
  function tyresByDriver(laps, stints) {
    const best = new Map();
    for (const l of Array.isArray(laps) ? laps : []) {
      const d = Number(l.driver_number);
      const t = Number(l.lap_duration);
      if (!Number.isFinite(d) || !Number.isFinite(t) || t <= 0) continue;
      const cur = best.get(d);
      if (!cur || t < cur.t) best.set(d, { t, lap: Number(l.lap_number) });
    }
    const out = new Map();
    for (const [d, b] of best) {
      const st = (Array.isArray(stints) ? stints : []).find((s) => Number(s.driver_number) === d
        && Number(s.lap_start) <= b.lap && b.lap <= Number(s.lap_end));
      const letter = st ? tyreLetter(st.compound) : "";
      if (letter) out.set(d, letter);
    }
    return out;
  }

  /* Ecart a la pole (ou au premier) recalcule sur le MEILLEUR temps de
     chacun : un pilote sorti en Q1 est compare a la pole, pas au
     premier de sa propre manche.
     Gap to the pole (or leader), recomputed on EACH driver's best time. */
  function withGaps(rows) {
    const lead = rows.find((r) => r.best != null);
    for (const r of rows) {
      r.gap = lead && r.best != null && r !== lead ? fmtGapTime(r.best - lead.best) : "";
    }
    return rows;
  }

  /* Qualifications / sprint de jolpica. kind : "quali" | "sprint". */
  function parseJolpicaSession(json, kind) {
    const races = (((json || {}).MRData || {}).RaceTable || {}).Races || [];
    const race = races[0];
    const list = race && (kind === "sprint" ? race.SprintResults : race.QualifyingResults);
    if (!Array.isArray(list) || !list.length) return null;
    const rows = list.map((r) => {
      const d = r.Driver || {};
      const c = r.Constructor || {};
      const q = [r.Q1, r.Q2, r.Q3].map((x) => (x && String(x).trim()) || "");
      const lastQ = [parseLapTime(q[2]), parseLapTime(q[1]), parseLapTime(q[0])].find((x) => x != null);
      const finished = kind !== "sprint" || /^Finished$/i.test(r.status || "") || /^\+/.test(r.status || "");
      return {
        pos: Number(r.position) || null,
        number: Number(r.number) || Number(d.permanentNumber) || null,
        code: d.code || (d.familyName || "").slice(0, 3).toUpperCase(),
        name: ((d.givenName || "") + " " + (d.familyName || "")).trim(),
        nationality: d.nationality || "",
        team: c.name || "", teamId: c.constructorId || "",
        color: colorFor(c.constructorId),
        q,
        best: kind === "sprint" ? null : (lastQ == null ? null : lastQ),
        gap: kind === "sprint" ? ((r.Time && r.Time.time) || "") : "",
        time: kind === "sprint" ? ((r.Time && r.Time.time) || "") : "",
        laps: Number(r.laps) || null,
        status: r.status || "",
        finished,
        tyre: ""
      };
    });
    if (kind !== "sprint") withGaps(rows);
    else for (const r of rows) r.gap = r.finished ? (r.pos === 1 ? "" : r.time) : r.status;
    return { source: "jolpica", kind, hasQ: kind !== "sprint", rows };
  }

  /* Resultats OpenF1 (essais, qualifications, sprint). `result` est la
     liste de `session_result`, `drivers` celle de `drivers`.
     OpenF1 results. */
  function parseOpenF1Session(result, drivers, kind) {
    if (!Array.isArray(result) || !result.length) return null;
    const byNum = new Map();
    for (const d of Array.isArray(drivers) ? drivers : []) byNum.set(Number(d.driver_number), d);
    const isQ = kind === "quali" || kind === "sprintQuali";
    const rows = result.map((r) => {
      const d = byNum.get(Number(r.driver_number)) || {};
      const dur = Array.isArray(r.duration) ? r.duration : [r.duration];
      const q = isQ ? [0, 1, 2].map((i) => fmtLapTime(parseLapTime(dur[i]))) : ["", "", ""];
      let best = null;
      for (let i = dur.length - 1; i >= 0; i--) {
        const t = parseLapTime(dur[i]);
        if (t != null) { best = t; break; }
      }
      const out = r.dnf || r.dns || r.dsq;
      const gapRaw = Array.isArray(r.gap_to_leader) ? null : r.gap_to_leader;
      return {
        pos: Number(r.position) || null,
        number: Number(r.driver_number) || null,
        code: d.name_acronym || String(r.driver_number),
        name: ((d.first_name || "") + " " + (d.last_name || "")).trim() || d.full_name || "",
        nationality: "",
        team: d.team_name || "", teamId: String(d.team_name || "").toLowerCase().replace(/\s+/g, "_"),
        color: d.team_colour ? "#" + String(d.team_colour).replace(/^#/, "") : "var(--muted)",
        q,
        best: kind === "sprint" ? null : best,
        time: kind === "sprint" && typeof r.duration === "number" ? fmtLapTime(r.duration) : "",
        gap: "",
        gapRaw,
        laps: Number(r.number_of_laps) || null,
        status: r.dsq ? "DSQ" : (r.dns ? "DNS" : (r.dnf ? "DNF" : "")),
        finished: !out,
        tyre: ""
      };
    });
    if (kind === "sprint") {
      for (const r of rows) {
        r.gap = !r.finished ? r.status : (r.pos === 1 ? "" : (typeof r.gapRaw === "number" ? fmtGapTime(r.gapRaw) : String(r.gapRaw || "")));
      }
    } else {
      withGaps(rows);
    }
    return { source: "openf1", kind, hasQ: isQ, rows };
  }

  /* La grille de depart, d'apres les qualifications : meme ordre, avec
     l'ecart a la pole. Starting grid, from qualifying. */
  function gridFromQuali(data) {
    if (!data || !Array.isArray(data.rows)) return null;
    return { source: data.source, kind: "grid", hasQ: false, rows: data.rows.map((r) => Object.assign({}, r)) };
  }

  /* ---------- Favoris ----------
     Pilotes et ecuries favoris : listes separees par des virgules,
     comparees sans casse. Un pilote correspond par son code, son nom ou
     son numero ; une ecurie par son nom.
     Favourites: comma-separated lists, compared without case. */
  function parseFavs(text) {
    return String(text || "").split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  }
  function isFavDriver(tokens, row) {
    if (!tokens || !tokens.length || !row) return false;
    const code = String(row.code || "").toLowerCase();
    const name = String(row.name || "").toLowerCase();
    const num = row.number ? String(row.number) : "";
    return tokens.some((t) => t === code || t === num || (t.length >= 3 && name.includes(t)));
  }
  function isFavTeam(tokens, row) {
    if (!tokens || !tokens.length || !row) return false;
    const team = String(row.team || "").toLowerCase();
    const id = String(row.teamId || "").toLowerCase();
    return tokens.some((t) => t.length >= 3 && (team.includes(t) || id.includes(t.replace(/\s+/g, "_"))));
  }

  const SESSION_CARD_IDS = ["fp1", "fp2", "fp3", "sprintQuali", "quali", "sprint", "grid"];
  /* Reglage des tests : l'ecart entre deux appels OpenF1. Tuning for tests. */
  const TUNING = { gapMs: 350 };

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

  /* ---------- Les blocs de la grille interne (1.151.0) ----------
     Chaque carte est un BLOC de la grille interne de la tuile : on le
     deplace, on le redimensionne, on le masque en mode edition. La cle
     `key` est la case a cocher qui l'affiche : masquer un bloc d'un clic
     sur sa croix decoche exactement la meme case que la fenetre de
     reglages, et inversement -- une seule verite.
     THE INNER-GRID BLOCKS. Each card is a BLOCK of the tile's inner grid.
     `key` is the checkbox that shows it: hiding a block with its cross
     unticks exactly the same box as the settings window -- one truth. */
  const BLOCKS = [
    { id: "next", key: "showNext", titleKey: "f1.card.next" },
    { id: "schedule", key: "showSchedule", titleKey: "f1.card.schedule" },
    { id: "drivers", key: "showDrivers", titleKey: "f1.card.drivers" },
    { id: "constructors", key: "showConstructors", titleKey: "f1.card.constructors" },
    { id: "results", key: "showResults", titleKey: "f1.card.results" },
    { id: "weather", key: "showWeather", titleKey: "f1.card.weather" },
    /* Les seances du week-end (1.161.0) : facultatives, decochees par
       defaut -- une tuile existante n'en voit surgir aucune.
       The weekend sessions: optional, unticked by default. */
    { id: "fp1", key: "showFp1", titleKey: "f1.card.fp1", optIn: true },
    { id: "fp2", key: "showFp2", titleKey: "f1.card.fp2", optIn: true },
    { id: "fp3", key: "showFp3", titleKey: "f1.card.fp3", optIn: true },
    { id: "sprintQuali", key: "showSprintQuali", titleKey: "f1.card.sprintQuali", optIn: true },
    { id: "quali", key: "showQuali", titleKey: "f1.card.quali", optIn: true },
    { id: "sprint", key: "showSprint", titleKey: "f1.card.sprint", optIn: true },
    { id: "grid", key: "showGrid", titleKey: "f1.card.grid", optIn: true },
    /* Le plan ne s'ajuste pas a l'echelle du texte : c'est un dessin
       vectoriel, qui suit deja la taille du bloc.
       The map is not text-scaled: a vector drawing already follows the
       block's size. */
    { id: "circuit", key: "showCircuit", titleKey: "f1.card.circuit", fit: false },
    /* Le logo (1.153.0) : la tuile Logo / Image hebergee, en option.
       The logo: the hosted Logo / Image tile, optional. */
    { id: "logo", key: "showLogo", titleKey: "f1.card.logo", fit: false, optIn: true }
  ];

  /* Dispositions predefinies, sur la grille 12 x 12. Elles ne couvrent
     que des blocs connus ; un bloc masque laisse simplement sa place
     vide, que l'on reprend en deplacant ses voisins.
     Presets on the 12 x 12 grid. A hidden block just leaves its spot
     empty. */
  const PRESETS = [
    { id: "compact", labelKey: "ig.preset.compact", items: {
      next: { x: 0, y: 0, w: 4, h: 3 }, schedule: { x: 0, y: 3, w: 4, h: 4 }, weather: { x: 0, y: 7, w: 4, h: 5 },
      circuit: { x: 4, y: 0, w: 4, h: 5 }, drivers: { x: 4, y: 5, w: 4, h: 7 },
      constructors: { x: 8, y: 0, w: 4, h: 5 }, results: { x: 8, y: 5, w: 4, h: 7 } } },
    { id: "standings", labelKey: "ig.preset.standings", items: {
      drivers: { x: 0, y: 0, w: 4, h: 12 }, constructors: { x: 4, y: 0, w: 4, h: 6 }, results: { x: 8, y: 0, w: 4, h: 6 },
      next: { x: 4, y: 6, w: 4, h: 3 }, schedule: { x: 4, y: 9, w: 4, h: 3 },
      circuit: { x: 8, y: 6, w: 4, h: 3 }, weather: { x: 8, y: 9, w: 4, h: 3 } } },
    { id: "weekend", labelKey: "ig.preset.weekend", items: {
      circuit: { x: 0, y: 0, w: 6, h: 7 }, next: { x: 6, y: 0, w: 6, h: 3 },
      schedule: { x: 6, y: 3, w: 3, h: 4 }, weather: { x: 9, y: 3, w: 3, h: 4 },
      results: { x: 0, y: 7, w: 4, h: 5 }, drivers: { x: 4, y: 7, w: 4, h: 5 }, constructors: { x: 8, y: 7, w: 4, h: 5 } } },
    /* « Seances » : les cartes du week-end en grand, deux rangees de
       quatre. Les cartes non cochees laissent simplement leur place vide.
       "Sessions": the weekend's cards large, two rows of four. */
    { id: "sessions", labelKey: "ig.preset.sessions", items: {
      fp1: { x: 0, y: 0, w: 3, h: 6 }, fp2: { x: 3, y: 0, w: 3, h: 6 }, fp3: { x: 6, y: 0, w: 3, h: 6 }, quali: { x: 9, y: 0, w: 3, h: 6 },
      sprintQuali: { x: 0, y: 6, w: 3, h: 6 }, sprint: { x: 3, y: 6, w: 3, h: 6 }, grid: { x: 6, y: 6, w: 3, h: 6 },
      next: { x: 9, y: 6, w: 3, h: 3 }, weather: { x: 9, y: 9, w: 3, h: 3 } } },
    { id: "season", labelKey: "ig.preset.season", items: {
      drivers: { x: 0, y: 0, w: 5, h: 12 }, constructors: { x: 5, y: 0, w: 4, h: 6 }, results: { x: 5, y: 6, w: 4, h: 6 },
      next: { x: 9, y: 0, w: 3, h: 3 }, circuit: { x: 9, y: 3, w: 3, h: 3 },
      schedule: { x: 9, y: 6, w: 3, h: 3 }, weather: { x: 9, y: 9, w: 3, h: 3 } } }
  ];

  /* LE WEEK-END DE COURSE commence douze heures avant la premiere seance
     et finit trois heures apres le depart du Grand Prix : c'est la
     fenetre ou l'on regarde le programme et le plan plutot que les
     classements.
     THE RACE WEEKEND starts twelve hours before the first session and
     ends three hours after the Grand Prix start. */
  function isRaceWeekend(races, now) {
    const race = nextRace(races || [], now);
    if (!race || !race.sessions || !race.sessions.length) return false;
    const first = race.sessions[0].at;
    return now >= first - 12 * 3600000 && now <= race.at + RACE_LENGTH_MS;
  }

  class F1Widget {
    constructor(ctx) {
      this.ctx = ctx;
      this.data = null;
      this.error = null;
      this.weather = null;
      this.timer = null;
      this.tick = null;
      this.wrap = null;
      this.circuitHost = null;
      this.circuitInst = null;
      this.circuitConf = "";
      /* Seances du week-end / weekend sessions */
      this.sess = {};
      this.sessRound = "";
      this.sessBusy = false;
      this.lastFull = 0;
      this.of1 = { list: null, year: "", at: 0, last: 0, drivers: {}, tyres: {} };
      this.logo = window.PiBoardInnerGrid && window.PiBoardInnerGrid.LogoSlot
        ? new window.PiBoardInnerGrid.LogoSlot(ctx, "pwf1-logo") : null;
      this.board = window.PiBoardInnerGrid ? new window.PiBoardInnerGrid.BlockBoard({
        ctx, kind: "f1", blocks: BLOCKS, presets: PRESETS,
        defaultPreset: "compact", seasonPreset: "season", weekendPreset: "weekend",
        isWeekend: (now) => isRaceWeekend(this.data && this.data.races, now),
        onRelayout: () => this.render(),
        onShown: () => this.refresh()
      }) : null;
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
      this.tick = setInterval(() => {
        this.paintCountdown();
        /* Le passage saison -> week-end se verifie a la meme cadence,
           sans reseau : une comparaison de dates.
           The season -> weekend switch is checked at the same pace. */
        if (this.board && this.data && this.board.slotChanged(Date.now())) this.render();
      }, 1000);
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

    /* ---------- Les seances du week-end (1.161.0) ---------- */
    needSessions() {
      return this.visibleBlocks().some((b) => SESSION_CARD_IDS.indexOf(b.id) >= 0);
    }

    wantedKinds() {
      const out = [];
      for (const b of this.visibleBlocks()) {
        const k = SESSION_BLOCKS[b.id];
        if (k && out.indexOf(k) < 0) out.push(k);
      }
      return out;
    }

    liveSeconds() {
      return Math.max(30, Math.min(600, Number(this.ctx.settings.liveRefreshSeconds) || 60));
    }

    /* Un appel a OpenF1 au plus toutes les 350 ms : l'acces gratuit est
       limite (quelques requetes par seconde) et une rafale de quatre
       cartes au premier affichage la depasserait.
       At most one OpenF1 call every 350 ms: the free access is rate
       limited and a first-display burst of four cards would exceed it. */
    async throttle() {
      const gap = TUNING.gapMs;
      const wait = this.of1.last + gap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.of1.last = Date.now();
    }

    async openf1(path) {
      await this.throttle();
      const res = await fetch(this.ctx.api.proxyUrl(`${OPENF1}/${path}`), { cache: "no-store" });
      /* OpenF1 repond 404 quand il n'y a simplement rien a rendre.
         OpenF1 answers 404 when there is simply nothing to return. */
      if (res.status === 404) return [];
      if (!res.ok) {
        const e = new Error("status " + res.status);
        e.code = res.status === 401 || res.status === 403 ? "locked" : (res.status === 429 ? "rate" : "error");
        throw e;
      }
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    }

    async openf1Key(kind, race, at) {
      const now = Date.now();
      if (!this.of1.list || this.of1.year !== race.season || now - this.of1.at > 3600000) {
        this.of1.list = await this.openf1(`sessions?year=${encodeURIComponent(race.season)}`);
        this.of1.year = race.season;
        this.of1.at = now;
      }
      const names = OPENF1_NAMES[kind] || [];
      const hit = this.of1.list.find((s) => names.indexOf(s.session_name) >= 0
        && Math.abs(Date.parse(s.date_start) - at) < 3 * 3600000);
      return hit ? hit.session_key : null;
    }

    async openf1Drivers(key) {
      if (!this.of1.drivers[key]) this.of1.drivers[key] = await this.openf1(`drivers?session_key=${key}`);
      return this.of1.drivers[key];
    }

    async attachTyres(data, kind, race, at) {
      const key = data.key != null ? data.key : await this.openf1Key(kind, race, at);
      if (key == null) return;
      let map = this.of1.tyres[key];
      if (!map) {
        const laps = await this.openf1(`laps?session_key=${key}`);
        const stints = await this.openf1(`stints?session_key=${key}`);
        map = tyresByDriver(laps, stints);
        this.of1.tyres[key] = map;
      }
      for (const r of data.rows) r.tyre = map.get(r.number) || "";
    }

    async fetchSessionData(kind, race, at, live) {
      let data = null;
      if (kind === "quali" || kind === "sprint") {
        try {
          const j = await this.fetchJson(`${API}/${race.season}/${race.round}/${kind === "quali" ? "qualifying" : "sprint"}.json`);
          data = parseJolpicaSession(j, kind);
        } catch (e) { /* secours OpenF1 / OpenF1 takes over */ }
      }
      if (!data) {
        const key = await this.openf1Key(kind, race, at);
        if (key == null) { const e = new Error("no session"); e.code = "wait"; throw e; }
        const result = await this.openf1(`session_result?session_key=${key}`);
        const drivers = await this.openf1Drivers(key);
        data = parseOpenF1Session(result, drivers, kind);
        if (!data) { const e = new Error("empty"); e.code = "wait"; throw e; }
        data.key = key;
      }
      /* Les pneus sont un bonus : leur echec ne coute jamais la carte.
         Tyres are a bonus: their failure never costs the card. */
      if (this.ctx.settings.showTyres !== false && !live) {
        try { await this.attachTyres(data, kind, race, at); } catch (e) { /* noop */ }
      }
      return data;
    }

    async loadSession(kind, race, now) {
      const at = sessionAt(race, kind);
      if (at == null || at > now) return;
      const live = liveSession(race, now) === kind;
      const ended = now > at + (SESSION_MINUTES[kind] || 60) * 60000 + LIVE_GRACE_MS;
      const cur = this.sess[kind];
      if (cur && cur.data) {
        const age = now - cur.fetched;
        if (live && age < this.liveSeconds() * 900) return;
        if (!live && cur.final && age < 25 * 60000) return;
        if (!live && !cur.final && age < 45000) return;
      }
      try {
        const data = await this.fetchSessionData(kind, race, at, live);
        this.sess[kind] = { data, error: null, fetched: now, final: ended };
      } catch (e) {
        /* Une erreur n'efface pas ce qu'on affichait.
           An error does not wipe what was displayed. */
        this.sess[kind] = {
          data: cur ? cur.data : null,
          error: (e && e.code) || "error",
          fetched: cur && cur.data ? cur.fetched : now,
          final: false,
          retryAt: now + 60000
        };
      }
    }

    async refreshSessions() {
      if (this.sessBusy || !this.data || !this.data.races || !this.needSessions()) return;
      const race = weekendRace(this.data.races, Date.now());
      if (!race) return;
      const rid = race.season + ":" + race.round;
      if (this.sessRound !== rid) { this.sessRound = rid; this.sess = {}; }
      this.sessBusy = true;
      try {
        for (const kind of this.wantedKinds()) {
          const before = this.sess[kind];
          const cur = this.sess[kind];
          if (cur && cur.error && cur.retryAt && Date.now() < cur.retryAt) continue;
          await this.loadSession(kind, race, Date.now());
          if (this.sess[kind] !== before) this.render();
        }
      } finally {
        this.sessBusy = false;
        this.arm();
      }
    }

    /* Le prochain reveil : la duree choisie, raccourcie quand une seance
       est en cours (releve rapide), va commencer, ou vient de finir et
       n'a pas encore ete relue une derniere fois.
       The next wake-up: the chosen delay, shortened when a session is
       under way, about to start, or just ended and not re-read once more. */
    nextDelay(now) {
      const base = Math.max(5, Math.min(360, Number(this.ctx.settings.refreshMinutes) || 30)) * 60000;
      let ms = this.lastFull ? Math.max(5000, this.lastFull + base - now) : base;
      if (this.needSessions() && this.data && this.data.races) {
        const race = weekendRace(this.data.races, now);
        if (race) {
          if (liveSession(race, now)) {
            ms = Math.min(ms, this.liveSeconds() * 1000);
          } else {
            const nx = nextSession(race, now);
            if (nx && nx.at - now < base) ms = Math.min(ms, Math.max(15000, nx.at - now + 20000));
            const open = Object.keys(this.sess).some((k) => this.sess[k].data && !this.sess[k].final);
            if (open) ms = Math.min(ms, 60000);
          }
        }
      }
      return ms;
    }

    arm() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.onTimer(), this.nextDelay(Date.now()));
    }

    async onTimer() {
      const base = Math.max(5, Math.min(360, Number(this.ctx.settings.refreshMinutes) || 30)) * 60000;
      if (!this.lastFull || Date.now() - this.lastFull >= base - 1000) await this.refresh();
      else await this.refreshSessions();
      this.arm();
    }

    favs() {
      const s = this.ctx.settings;
      return { drivers: parseFavs(s.favDrivers), teams: parseFavs(s.favTeams) };
    }

    isFav(row) {
      const f = this.favs();
      return isFavDriver(f.drivers, row) || isFavTeam(f.teams, row);
    }

    tyreHtml(letter) {
      if (!letter) return "";
      const i18n = this.ctx.i18n;
      return `<span class="pwf1-tyre pwf1-tyre-${esc(letter)}" title="${esc(i18n.t("f1.tyre." + letter))}">${esc(letter)}</span>`;
    }

    sessionRowHtml(r, kind, withTyres, colors) {
      const flag = flagFor(FLAG, r.nationality);
      const fav = this.isFav(r);
      const isRace = kind === "sprint";
      const cells = [];
      cells.push(`<td class="pwf1-pos">${r.finished || !isRace ? esc(r.pos == null ? "" : r.pos) : "—"}</td>`);
      cells.push(`<td class="pwf1-who"><div class="pwf1-who-in">
        ${colors ? `<span class="pwf1-team" style="--pwf1-team:${esc(r.color)}"></span>` : ""}
        ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
        <span class="pwf1-code">${esc(r.code)}</span>
        <span class="pwf1-name">${esc(r.name)}</span>
        ${fav ? `<span class="pwf1-star" aria-hidden="true">★</span>` : ""}
      </div></td>`);
      if (withTyres) cells.push(`<td class="pwf1-tyrecell">${this.tyreHtml(r.tyre)}</td>`);
      if (kind === "quali" || kind === "sprintQuali") {
        cells.push(`<td class="pwf1-q pwf1-qopt">${esc(r.q[0])}</td><td class="pwf1-q pwf1-qopt">${esc(r.q[1])}</td><td class="pwf1-q pwf1-time">${esc(r.q[2] || r.q[1] || r.q[0])}</td>`);
        cells.push(`<td class="pwf1-gap">${esc(r.gap)}</td>`);
      } else if (kind === "grid") {
        cells.push(`<td class="pwf1-time">${esc(r.best != null ? fmtLapTime(r.best) : "")}</td><td class="pwf1-gap">${esc(r.gap)}</td>`);
      } else if (isRace) {
        cells.push(`<td class="pwf1-gap">${esc(r.pos === 1 && r.finished ? (r.time || "") : r.gap)}</td>`);
      } else {
        cells.push(`<td class="pwf1-time">${esc(r.best != null ? fmtLapTime(r.best) : "")}</td><td class="pwf1-gap">${esc(r.gap)}</td><td class="pwf1-laps">${esc(r.laps || "")}</td>`);
      }
      const cls = (r.finished || !isRace ? "" : "pwf1-dnf ") + (fav ? "pwf1-fav" : "");
      return `<tr${cls.trim() ? ` class="${cls.trim()}"` : ""}>${cells.join("")}</tr>`;
    }

    cardSession(id, now) {
      const i18n = this.ctx.i18n;
      const isGrid = id === "grid";
      const kind = SESSION_BLOCKS[id];
      const title = i18n.t("f1.card." + id);
      const race = weekendRace(this.data.races || [], now);
      if (!race) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);
      const full = title + " · " + race.name;
      const at = sessionAt(race, kind);
      if (at == null) return this.card(full, `<div class="pwf1-msg">${esc(i18n.t("f1.sess.none"))}</div>`);
      if (at > now) {
        const when = dayTime(at, this.locale());
        return this.card(full, `<div class="pwf1-msg">${esc(i18n.t("f1.sess.later").replace("{when}", when))}</div>`);
      }
      const st = this.sess[kind];
      let data = st && st.data;
      if (data && isGrid) data = gridFromQuali(data);
      if (!data) {
        const code = st && st.error;
        const msg = code === "locked" ? "f1.sess.locked" : (code === "error" || code === "rate" ? "f1.sess.error" : (st ? "f1.sess.wait" : "f1.loading"));
        return this.card(full, `<div class="pwf1-msg">${esc(i18n.t(msg))}</div>`);
      }
      const live = liveSession(race, now) === kind;
      const n = Math.max(3, Math.min(24, Number(this.ctx.settings.sessionRows) || 10));
      const colors = this.ctx.settings.showTeamColors !== false;
      const withTyres = this.ctx.settings.showTyres !== false && !isGrid && data.rows.some((r) => r.tyre);
      const rows = data.rows.slice(0, n).map((r) => this.sessionRowHtml(r, isGrid ? "grid" : kind, withTyres, colors)).join("");
      const th = (t, c) => `<th${c ? ` class="${c}"` : ""}>${esc(t)}</th>`;
      let head;
      if (isGrid) head = th("") + th(i18n.t("f1.th.driver")) + th(i18n.t("f1.th.best")) + th(i18n.t("f1.th.gapPole"));
      else if (kind === "quali" || kind === "sprintQuali") {
        head = th("") + th(i18n.t("f1.th.driver")) + (withTyres ? th("") : "")
          + th("Q1", "pwf1-qopt") + th("Q2", "pwf1-qopt") + th("Q3") + th(i18n.t("f1.th.gap"));
      } else if (kind === "sprint") head = th("") + th(i18n.t("f1.th.driver")) + (withTyres ? th("") : "") + th(i18n.t("f1.th.gap"));
      else head = th("") + th(i18n.t("f1.th.driver")) + (withTyres ? th("") : "") + th(i18n.t("f1.th.best")) + th(i18n.t("f1.th.gap")) + th(i18n.t("f1.th.laps"));
      const badge = live ? `<div class="pwf1-live"><span class="pwf1-live-dot"></span>${esc(i18n.t("f1.sess.live"))}</div>` : "";
      const note = st && st.error ? `<div class="pwf1-stale">${esc(i18n.t("f1.stale"))}</div>` : "";
      const credit = data.source === "openf1" ? "f1.sess.credit.openf1" : "f1.sess.credit.jolpica";
      return this.card(full, `
        ${badge}
        <div class="pwf1-sess">
          <table class="pwf1-table pwf1-sess-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${note}
        <div class="pwf1-circ-foot"><span class="pwf1-circ-src">${esc(i18n.t(credit))}${isGrid ? " · " + esc(i18n.t("f1.sess.gridNote")) : ""}</span></div>`,
      live ? "pwf1-is-live" : "");
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
      /* L'heure de la TENTATIVE, reussie ou non : un echec ne doit pas
         declencher une boucle de relectures. The time of the ATTEMPT. */
      this.lastFull = Date.now();
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
      const needRaces = s.showNext !== false || s.showSchedule !== false || s.showWeather !== false
        || s.showCircuit !== false || s.autoLayout === true || this.needSessions();
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
      if (this.ctx.settings.showWeather !== false) this.refreshWeather();
      /* Les cartes de seance se chargent apres le reste : le classement
         ne doit jamais attendre OpenF1. Session cards load after the rest. */
      this.refreshSessions();
      this.arm();
    }

    /* COMME LE TRACE, LA METEO EST CHARGEE A PART -- mais pour une
       raison opposee. Le trace ne change jamais et se garde en cache ;
       la prevision, elle, se perime. Elle n'est donc PAS mise en cache
       cote serveur, et repart a chaque relevé de la tuile. Open-Meteo
       est gratuit, sans cle, et genereux ; une requete toutes les trente
       minutes par circuit reste tres en deca de ce qu'il accepte.
       LIKE THE OUTLINE, THE WEATHER IS LOADED SEPARATELY -- but for the
       opposite reason. The outline never changes and is cached; the
       forecast goes stale, so it is NOT cached and is re-read on every
       refresh. */
    async refreshWeather() {
      const race = nextRace(this.data && this.data.races || [], Date.now())
        || lastRace(this.data && this.data.races || [], Date.now());
      if (!race || !Number.isFinite(race.lat) || !Number.isFinite(race.lon)) return;
      try {
        const json = await this.fetchJson(weatherUrl(race.lat, race.lon));
        this.weather = { id: race.circuitId, table: parseWeather(json) };
      } catch (e) {
        /* Une meteo indisponible ne doit pas effacer la carte : elle le
           dit, et le reste de la tuile n'en sait rien.
           Unavailable weather must not wipe the card. */
        this.weather = { id: race.circuitId, table: null, error: String((e && e.message) || e) };
      }
      this.render();
    }

    /* LE CONTENEUR DE LA TUILE EST GARDE d'un rendu a l'autre. Avant la
       grille, chaque rendu reecrivait toute la tuile ; ce n'est plus
       possible : la grille et le plan du circuit vivent dedans, et les
       reconstruire chaque fois reinitialiserait un geste en cours ou
       relancerait le dessin du trace.
       THE TILE'S CONTAINER IS KEPT between renders: the grid and the
       circuit map live inside it, and rebuilding them every time would
       reset a gesture in progress or redraw the outline. */
    ensureWrap() {
      const el = this.ctx.el;
      if (!this.wrap || this.wrap.parentNode !== el) {
        el.innerHTML = "";
        this.wrap = document.createElement("div");
        el.appendChild(this.wrap);
      }
      return this.wrap;
    }

    visibleBlocks() {
      const s = this.ctx.settings;
      /* Un bloc « optIn » (le logo) n'apparait que coche EXPLICITEMENT :
         une tuile posee avant son arrivee n'a pas ce reglage, et ne doit
         pas voir surgir un bloc vide. An optIn block shows only when
         explicitly ticked. */
      return BLOCKS.filter((b) => (b.optIn ? s[b.key] === true : s[b.key] !== false));
    }

    render() {
      const i18n = this.ctx.i18n;
      const wrap = this.ensureWrap();
      const skin = this.skinClass();
      const style = this.skinStyleValue();

      if (!this.data) {
        if (this.board) this.board.unmount();
        wrap.className = "pw-f1";
        wrap.removeAttribute("style");
        wrap.innerHTML = `<div class="pwf1-msg">${esc(i18n.t(this.error ? "f1.error" : "f1.loading"))}</div>`;
        return;
      }

      const now = Date.now();
      const vis = this.visibleBlocks();
      this.syncCircuit(vis.some((b) => b.id === "circuit"));
      if (this.logo) this.logo.sync(vis.some((b) => b.id === "logo"));

      /* UNE SEULE CARTE COCHEE : LA TUILE DEVIENT CETTE CARTE, sans
         cadre ni titre interne -- la barre de titre de la tuile en tient
         lieu. C'est toujours utile depuis l'arrivee de la grille : une
         tuile « Classement pilotes » seule n'a que faire d'une grille.
         ONE CARD TICKED: THE TILE BECOMES THAT CARD, with no frame and
         no inner title. Still useful with the grid: a lone "Driver
         standings" tile has no use for a grid. */
      this.solo = vis.length === 1;
      const stale = this.error ? `<div class="pwf1-stale">${esc(i18n.t("f1.stale"))}</div>` : "";
      if (style) wrap.setAttribute("style", style); else wrap.removeAttribute("style");

      if (!vis.length || this.solo || !this.board) {
        if (this.board) this.board.unmount();
        wrap.className = "pw-f1" + (this.solo ? " pwf1-solo" : "") + skin;
        const cards = vis.map((b) => this.cardFor(b.id, now)).filter(Boolean).join("");
        wrap.innerHTML = (cards || `<div class="pwf1-msg">${esc(i18n.t("f1.noCard"))}</div>`) + stale;
        this.placeCircuit(wrap);
        if (this.logo) this.logo.place(wrap);
        this.paintCountdown();
        return;
      }

      /* PLUSIEURS CARTES : LA GRILLE INTERNE. Chaque carte est ecrite
         dans le corps de son bloc ; la grille, elle, n'est pas
         reconstruite -- elle ne fait que se mettre a jour.
         SEVERAL CARDS: THE INNER GRID. Each card is written into its
         block's body; the grid itself is not rebuilt, only updated. */
      wrap.className = "pw-f1 pwf1-grid" + skin;
      for (const n of Array.from(wrap.children)) {
        if (!n.classList.contains("pig-root")) n.remove();
      }
      const grid = this.board.mount(wrap);
      for (const b of vis) {
        const body = grid.body(b.id);
        if (!body) continue;
        if (b.id === "circuit") {
          body.innerHTML = this.cardFor("circuit", now);
          this.placeCircuit(body);
        } else {
          body.innerHTML = this.cardFor(b.id, now);
          if (b.id === "logo" && this.logo) this.logo.place(body);
        }
      }
      if (stale) wrap.insertAdjacentHTML("beforeend", stale);
      grid.scheduleFit();
      this.paintCountdown();
    }

    cardFor(id, now) {
      switch (id) {
        case "next": return this.cardNext(now);
        case "schedule": return this.cardSchedule(now);
        case "drivers": return this.cardDrivers();
        case "constructors": return this.cardConstructors();
        case "results": return this.cardResults();
        case "weather": return this.cardWeather(now);
        case "fp1": case "fp2": case "fp3": case "sprintQuali": case "quali": case "sprint": case "grid":
          return this.cardSession(id, now);
        case "circuit": return this.cardCircuit(now);
        case "logo": return this.logo ? this.logo.markup(this.ctx.settings.logoFrame === true) : "";
        default: return "";
      }
    }

    /* ---------- Le plan du circuit (1.151.0) ----------
       LA TUILE PLAN DU CIRCUIT, REUTILISEE TELLE QUELLE. Le trace, la
       base des circuits, le style « ruban d'asphalte », les virages
       numerotes, la fiche technique : tout vient de la tuile Plan du
       circuit, hebergee dans ce bloc. Rien n'est recopie -- une
       correction du dessin profite aux deux tuiles a la fois.

       L'ELEMENT QUI L'HEBERGE EST DEPLACE, JAMAIS RECREE. La tuile du
       circuit dessine dans un element qui lui appartient ; a chaque
       rendu de la Formule 1, cet element est simplement remis a sa
       place. Le recreer effacerait le dessin et relancerait ses
       requetes chaque fois qu'un classement se rafraichit.

       THE CIRCUIT MAP TILE, REUSED AS IS. Outline, circuit base, asphalt
       ribbon, corner numbers, spec sheet: all from the Circuit map tile,
       hosted in this block. Nothing is copied. ITS HOST ELEMENT IS
       MOVED, NEVER RECREATED: recreating it would wipe the drawing and
       re-fetch every time a standings table refreshes. */
    circuitSettings() {
      const s = this.ctx.settings;
      return {
        circuit: "",
        showSpecs: s.circuitSpecs !== false,
        showCorners: true,
        showDirection: true,
        rotation: String(s.circuitRotation || "0"),
        /* La meteo a sa propre carte dans cette tuile : la repeter sous
           le plan mangerait la place du dessin.
           Weather has its own card in this tile. */
        showWeather: false
      };
    }

    syncCircuit(wanted) {
      if (!wanted) {
        if (this.circuitInst) { try { this.circuitInst.destroy(); } catch (e) { /* noop */ } }
        this.circuitInst = null;
        this.circuitHost = null;
        this.circuitConf = "";
        return;
      }
      const conf = JSON.stringify(this.circuitSettings());
      if (!this.circuitHost) {
        this.circuitHost = document.createElement("div");
        this.circuitHost.className = "pwf1-circ-host";
      }
      if (!this.circuitInst) {
        const P = window.PiBoard;
        this.circuitInst = P && typeof P.embedWidget === "function"
          ? P.embedWidget("circuit", this.circuitHost, this.circuitSettings()) : null;
        this.circuitConf = conf;
        if (!this.circuitInst) {
          this.circuitHost.innerHTML = `<div class="pwf1-msg">${esc(this.ctx.i18n.t("f1.circuit.unavailable"))}</div>`;
        }
      } else if (conf !== this.circuitConf) {
        this.circuitConf = conf;
        try { this.circuitInst.onSettingsChanged(Object.assign({}, this.circuitInst.ctx.settings, this.circuitSettings())); } catch (e) { /* noop */ }
      }
    }

    placeCircuit(scope) {
      if (!this.circuitHost || !scope) return;
      const slot = scope.querySelector(".pwf1-circ-slot");
      if (slot && this.circuitHost.parentNode !== slot) slot.appendChild(this.circuitHost);
    }

    cardCircuit(now) {
      const i18n = this.ctx.i18n;
      const race = nextRace(this.data.races || [], now);
      let overlay = "";
      /* LE COMPTE A REBOURS EN SURIMPRESSION : la prochaine seance, posee
         sur le coin du plan. Un week-end de course, c'est le duo qu'on
         regarde -- ou, et dans combien de temps.
         THE COUNTDOWN OVERLAY: the next session, laid on the map's
         corner -- where, and how long until. */
      if (race && this.ctx.settings.circuitCountdown !== false) {
        const sess = nextSession(race, now);
        const target = sess ? sess.at : race.at;
        const label = i18n.t("f1.session." + (sess ? sess.kind : "race"));
        overlay = `<div class="pwf1-circ-cd"><span class="pwf1-circ-cd-label">${esc(label)}</span><span class="pwf1-cd pwf1-circ-cd-time" data-cd="${target}"></span></div>`;
      }
      return this.card(i18n.t("f1.card.circuit"),
        `<div class="pwf1-circ-wrap">${overlay}<div class="pwf1-circ-slot"></div></div>`, "pwf1-circ-card");
    }

    /* Le chrono est reecrit a part, a la seconde. Il porte sa cible dans
       un attribut : si la tuile n'a pas ete redessinee depuis, le
       chrono reste juste. Il y en a deux depuis 1.151.0 (carte
       « Prochaine course » et surimpression du plan) : tous sont
       reecrits.
       The chrono is rewritten separately, every second; it carries its
       target in an attribute. There are two since 1.151.0: all are
       rewritten. */
    paintCountdown() {
      const all = this.ctx.el.querySelectorAll("[data-cd]");
      for (const el of all) {
        const target = Number(el.dataset.cd);
        if (!Number.isFinite(target)) continue;
        const left = target - Date.now();
        el.textContent = countdown(left, this.ctx.i18n);
        el.classList.toggle("pwf1-cd-now", left <= 0);
      }
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

    skinStyleValue() {
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
      return `--pwf1-skin-bg: ${raw}`;
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
        const fav = this.isFav({ code: d.code, name: ((d.givenName || "") + " " + (d.familyName || "")).trim(), number: d.permanentNumber, team: c.name, teamId: c.constructorId });
        return `<tr${fav ? ' class="pwf1-fav"' : ""}>
          <td class="pwf1-pos">${esc(x.position)}</td>
          <td class="pwf1-who"><div class="pwf1-who-in">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(c.constructorId)}"></span>` : ""}
            ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
            <span class="pwf1-code">${esc(d.code || "")}</span>
            <span class="pwf1-name">${esc(((d.givenName || "") + " " + (d.familyName || "")).trim())}</span>
            ${d.permanentNumber ? `<span class="pwf1-num">#${esc(d.permanentNumber)}</span>` : ""}
          </div></td>
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
        const fav = isFavTeam(this.favs().teams, { team: c.name, teamId: c.constructorId });
        return `<tr${fav ? ' class="pwf1-fav"' : ""}>
          <td class="pwf1-pos">${esc(x.position)}</td>
          <td class="pwf1-who"><div class="pwf1-who-in">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(c.constructorId)}"></span>` : ""}
            <span class="pwf1-name">${esc(c.name || "")}</span>
          </div></td>
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

    /* ---------- La meteo du circuit ---------- */
    cardWeather(now) {
      const i18n = this.ctx.i18n;
      const title = i18n.t("f1.card.weather");
      const race = nextRace(this.data.races || [], now) || lastRace(this.data.races || [], now);
      if (!race) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.noData"))}</div>`);
      if (!this.weather) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.loading"))}</div>`);
      if (!this.weather.table) return this.card(title, `<div class="pwf1-msg">${esc(i18n.t("f1.weather.none"))}</div>`);

      const lang = /^en/i.test(String(i18n.t("clock.date.format") || "")) ? "en" : "fr";
      const LIVE_MS = 90 * 60000;
      let beyond = false;

      const rows = race.sessions.map((x) => {
        const w = weatherAt(this.weather.table, x.at);
        const past = x.at + LIVE_MS <= now;
        if (!w && !past) beyond = true;

        /* UNE SEANCE SANS PREVISION GARDE SA LIGNE, avec un tiret. La
           retirer donnerait un programme amputé ou l'on croirait avoir
           tout vu ; le tiret dit « on ne sait pas », ce qui est la
           verite.
           A SESSION WITHOUT A FORECAST KEEPS ITS ROW, with a dash.
           Dropping it would give a truncated programme one would
           believe complete. */
        const cond = w ? describeWeather(w.code) : null;
        const rain = w && w.rain != null ? Math.round(w.rain) : null;
        /* Le seuil de mise en avant est a 30 % : en dessous, une averse
           reste une hypothese ; au-dessus, les equipes commencent a
           raisonner en pneus pluie.
           The highlight threshold is 30%: below that a shower is a
           hypothesis; above it, teams start thinking wet tyres. */
        const wet = rain != null && rain >= 30;

        return `<div class="pwf1-wx${past ? " pwf1-sess-past" : ""}">
          <span class="pwf1-sess-name">${esc(i18n.t("f1.session." + x.kind))}</span>
          <span class="pwf1-wx-when">${esc(dayTime(x.at, this.locale()))}</span>
          <span class="pwf1-wx-cond" title="${esc(cond ? cond[lang] : "")}">${cond ? cond.icon : "–"}</span>
          <span class="pwf1-wx-temp">${w && w.temp != null ? esc(Math.round(w.temp) + "°") : "–"}</span>
          <span class="pwf1-wx-rain${wet ? " pwf1-wx-wet" : ""}">${rain != null ? esc(rain + "%") : "–"}</span>
        </div>`;
      }).join("");

      return this.card(title, `
        <div class="pwf1-wx-list">
          <div class="pwf1-sched-head">${esc(race.circuitName || race.name)}</div>
          <div class="pwf1-wx pwf1-wx-head">
            <span class="pwf1-sess-name">${esc(i18n.t("f1.wx.session"))}</span>
            <span class="pwf1-wx-when"></span>
            <span class="pwf1-wx-cond"></span>
            <span class="pwf1-wx-temp">${esc(i18n.t("f1.wx.temp"))}</span>
            <span class="pwf1-wx-rain">${esc(i18n.t("f1.wx.rain"))}</span>
          </div>
          ${rows}
          ${beyond ? `<div class="pwf1-msg pwf1-wx-note">${esc(i18n.t("f1.weather.horizon"))}</div>` : ""}
          <div class="pwf1-circ-foot"><span class="pwf1-circ-src">${esc(i18n.t("f1.weather.credit"))}</span></div>
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
        const fav = this.isFav({ code: r.code, name: r.name, team: r.constructorName, teamId: r.constructorId });
        return `<tr class="${(r.finished ? "" : "pwf1-dnf ") + (fav ? "pwf1-fav" : "")}">
          <td class="pwf1-pos">${r.finished ? esc(r.position) : "—"}</td>
          <td class="pwf1-who"><div class="pwf1-who-in">
            ${colors ? `<span class="pwf1-team" style="--pwf1-team:${colorFor(r.constructorId)}"></span>` : ""}
            ${flag ? `<span class="pwf1-flag">${flag}</span>` : ""}
            <span class="pwf1-code">${esc(r.code)}</span>
            <span class="pwf1-name">${esc(r.name)}</span>
            ${r.fastest ? `<span class="pwf1-fast" title="${esc(i18n.t("f1.fastestLap"))}">⏱</span>` : ""}
          </div></td>
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
      this.syncCircuit(false);
      if (this.logo) this.logo.destroy();
      if (this.board) this.board.unmount();
    }
  }

  window.PiBoard.registerWidget("f1", F1Widget);

  /* Expose pour les tests : les fonctions pures, qui n'ont besoin ni du
     DOM ni du reseau. Exposed for tests: the pure helpers. */
  window.PiBoardF1Helpers = {
    parseRaces, parseStandings, parseResults, nextRace, lastRace, nextSession,
    parseWeather, weatherAt, weatherUrl, describeWeather, WMO,
    countdown, whenOf, colorFor, flagFor, FLAG, COUNTRY_FLAG, TEAM_COLOR, RACE_LENGTH_MS,
    isRaceWeekend, BLOCKS, PRESETS,
    weekendRace, liveSession, sessionAt, parseLapTime, fmtLapTime, fmtGapTime, tyreLetter, tyresByDriver,
    parseJolpicaSession, parseOpenF1Session, gridFromQuali, parseFavs, isFavDriver, isFavTeam,
    SESSION_KINDS, SESSION_MINUTES, TUNING
  };
})();
