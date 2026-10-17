/* PiBoard widget: motogp / MotoGP (1.151.0).

   LE PENDANT DE LA TUILE FORMULE 1, POUR LE MOTOGP. Meme idee -- un
   tableau de bord du week-end en blocs que l'on dispose soi-meme dans
   la tuile -- et meme grille interne (innergrid.js) : on deplace, on
   redimensionne, on masque les blocs en mode edition, a la souris ou au
   doigt. Les deux tuiles partagent la grille, pas leurs donnees.

   LA SOURCE. Le flux public de motogp.com (api.motogp.pulselive.com),
   deja lu par les tuiles Sports mecaniques, Classement et Plan du
   circuit. Deux familles d'adresses :
   - `events?seasonYear=` : le calendrier, avec l'heure de chaque seance
     (les « broadcasts ») et les coordonnees du circuit ;
   - `results/...` : saisons, categories, classement, seances d'un
     Grand Prix et classement d'une seance -- par appels en cascade,
     exactement comme le fait le site lui-meme.

   CE QU'ON N'EMBARQUE PAS. Ni logos d'equipes ou de constructeurs, ni
   photos de pilotes, ni plans officiels : ce sont des marques et des
   visuels sous droits. La couleur du constructeur, le numero du pilote
   et son drapeau font le travail de reconnaissance.

   THE MOTOGP COUNTERPART OF THE FORMULA 1 TILE: a weekend dashboard in
   blocks arranged inside the tile, on the same inner grid. The two tiles
   share the grid, not their data. SOURCE: motogp.com's public feed,
   already read by the Motorsport, Standings and Circuit map tiles --
   `events?seasonYear=` for the calendar and session times, `results/...`
   for seasons, categories, standings, sessions and classifications, by
   cascading calls as the site itself does. NOT EMBEDDED: team or maker
   logos, rider photos, official maps. */
(function () {
  "use strict";

  const FEED = "https://api.motogp.pulselive.com/motogp/v1";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Le drapeau se deduit du code pays ISO a deux lettres, que le flux
     donne pour chaque pilote et chaque Grand Prix : deux « lettres
     regionales » Unicode font le drapeau. Sur une machine sans police
     emoji, le code reste affiche a cote.
     The flag derives from the two-letter ISO code the feed gives for
     every rider and Grand Prix. */
  function flagOf(iso) {
    const c = String(iso || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return "";
    return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
  }

  /* Couleur du CONSTRUCTEUR : un fait, pas un logo. La cle est le nom du
     constructeur en minuscules (le flux n'a pas d'identifiant court).
     The MAKER's colour: a fact, not a logo. */
  const MAKER_COLOR = {
    ducati: "#E2001A", aprilia: "#41BFAA", ktm: "#FF6600",
    yamaha: "#1D3E9E", honda: "#B9BEC6"
  };
  function makerColor(name) {
    const k = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    for (const key of Object.keys(MAKER_COLOR)) if (k.includes(key)) return MAKER_COLOR[key];
    return "var(--muted)";
  }

  /* « ™ » et espaces de fin : le flux ecrit « MotoGP™ » et « Aprilia
     Racing ». Le symbole n'apporte rien a l'ecran et casse les
     comparaisons. The "™" sign adds nothing on screen and breaks
     comparisons. */
  function clean(s) { return String(s == null ? "" : s).replace(/[™®]/g, "").trim(); }

  /* ---------- Dates ----------
     Les horaires du calendrier ont la forme « 2026-10-25T14:00:00+1100 » :
     un decalage sans deux-points, que la specification ne garantit pas.
     On le corrige avant d'analyser plutot que de compter sur la
     tolerance du navigateur.
     Calendar times look like "...+1100": an offset without a colon, not
     guaranteed by the spec, fixed before parsing. */
  function parseIso(str) {
    if (!str) return null;
    const t = Date.parse(String(str).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    return Number.isFinite(t) ? t : null;
  }

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
    return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })
      + " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- Le calendrier (fonctions PURES) ---------- */

  /* Le code de seance du flux -> une famille. RAC2 existe (course
     reprise) : tout code qui commence par RAC est une course.
     The feed's session code -> a kind; RAC2 exists. */
  function sessionKind(code) {
    const c = String(code || "").toUpperCase();
    if (c.startsWith("RAC")) return "race";
    return { FP1: "fp1", FP2: "fp2", PR: "practice", Q1: "q1", Q2: "q2", SPR: "sprint", WUP: "warmup" }[c] || "";
  }

  /* On ne garde que les Grands Prix (`kind` GP : ni essais prives, ni
     presentations), et pour chacun les seances de la CATEGORIE REINE --
     Moto2 et Moto3 doubleraient le programme sans repondre a la
     question qu'on se pose devant une tuile MotoGP.
     Only Grands Prix are kept, with the PREMIER CLASS's sessions. */
  function parseCalendar(events) {
    if (!Array.isArray(events)) return null;
    const races = [];
    for (const ev of events) {
      if (!ev || ev.kind !== "GP") continue;
      const c = ev.circuit || {};
      const sessions = (Array.isArray(ev.broadcasts) ? ev.broadcasts : [])
        .filter((b) => b && String(b.type || "").toUpperCase() === "SESSION"
          && String((b.category && b.category.acronym) || "").toUpperCase() === "MGP")
        .map((b) => ({ kind: sessionKind(b.shortname), at: parseIso(b.date_start) }))
        .filter((x) => x.kind && x.at != null)
        .sort((a, b) => a.at - b.at);
      const raceSessions = sessions.filter((x) => x.kind === "race");
      const at = raceSessions.length ? raceSessions[raceSessions.length - 1].at : parseIso(ev.date_end);
      if (at == null) continue;
      /* Le nombre de tours de la classe reine : le flux le range par
         categorie, et la categorie MotoGP se reconnait a son acronyme
         dans la liste des categories de l'evenement.
         The premier class's lap count, stored per category. */
      const mgp = (Array.isArray(ev.categories) ? ev.categories : [])
        .find((k) => String(k.acronym || "").toUpperCase() === "MGP");
      const ec = mgp && Array.isArray(ev.event_categories)
        ? ev.event_categories.find((k) => k.category_id === mgp.id) : null;
      races.push({
        round: Number(ev.sequence) || races.length + 1,
        place: clean(ev.additional_name),
        fullName: clean(ev.name),
        iso: String(ev.country || c.iso_code || "").toUpperCase(),
        circuitName: c.name || "",
        country: c.country || "",
        lat: Number(c.lat), lon: Number(c.lng),
        laps: ec && Number(ec.num_laps) || null,
        sprintLaps: ec && Number(ec.sprint_num_laps) || null,
        at, sessions
      });
    }
    return races.sort((a, b) => a.at - b.at);
  }

  /* Une course commencee reste « la prochaine » pendant trois heures :
     pendant le depart, c'est elle qu'on regarde.
     A started race stays "the next one" for three hours. */
  const RACE_LENGTH_MS = 3 * 3600000;

  function nextRace(races, now) {
    if (!Array.isArray(races)) return null;
    return races.find((r) => r.at != null && r.at + RACE_LENGTH_MS > now) || null;
  }

  function lastRace(races, now) {
    if (!Array.isArray(races)) return null;
    let found = null;
    for (const r of races) if (r.at != null && r.at <= now) found = r;
    return found;
  }

  function nextSession(race, now) {
    if (!race || !Array.isArray(race.sessions)) return null;
    return race.sessions.find((s) => s.at > now) || null;
  }

  function isRaceWeekend(races, now) {
    const race = nextRace(races || [], now);
    if (!race || !race.sessions.length) return false;
    return now >= race.sessions[0].at - 12 * 3600000 && now <= race.at + RACE_LENGTH_MS;
  }

  /* Le nom du Grand Prix dans la langue de la tuile. Le flux donne un
     « additional_name » en anglais majuscule (« AUSTRALIA », « CATALONIA »).
     Quand c'est le nom du pays, on le traduit ; sinon (Catalogne, Aragon,
     Valence : trois Grands Prix d'un meme pays) on garde le nom du flux,
     en casse normale. Meme regle que la tuile Plan du circuit.
     The Grand Prix name in the tile's language; same rule as the Circuit
     map tile. */
  function raceName(race, lang) {
    const raw = race && race.place;
    if (!raw) return "";
    let out = raw.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    try {
      const en = new Intl.DisplayNames(["en"], { type: "region" }).of(race.iso);
      const norm = (x) => String(x).toUpperCase().replace(/^THE /, "").replace(/\s+/g, " ").trim();
      const alias = { USA: "UNITED STATES", "GREAT BRITAIN": "UNITED KINGDOM" };
      const key = alias[norm(raw)] || norm(raw);
      if (en && norm(en) === key) out = new Intl.DisplayNames([lang || "en"], { type: "region" }).of(race.iso) || out;
    } catch (e) { /* Intl.DisplayNames absent : nom du flux */ }
    return out;
  }

  /* ---------- Les resultats (fonctions PURES) ---------- */

  function pickSeason(seasons, year) {
    if (!Array.isArray(seasons) || !seasons.length) return null;
    if (year) return seasons.find((s) => String(s.year) === String(year)) || null;
    return seasons.find((s) => s.current) || seasons.slice().sort((a, b) => b.year - a.year)[0];
  }

  function pickCategory(categories) {
    if (!Array.isArray(categories) || !categories.length) return null;
    return categories.find((c) => /^motogp$/i.test(clean(c.name))) || null;
  }

  function parseRiders(json) {
    const list = json && Array.isArray(json.classification) ? json.classification : null;
    if (!list) return null;
    return list.map((x) => {
      const r = x.rider || {};
      return {
        position: Number(x.position) || null,
        name: r.full_name || "",
        number: r.number != null ? String(r.number) : "",
        iso: (r.country && r.country.iso) || "",
        team: clean((x.team && x.team.name) || ""),
        maker: clean((x.constructor && x.constructor.name) || ""),
        points: Number(x.points) || 0,
        wins: Number(x.race_wins) || 0,
        podiums: Number(x.podiums) || 0,
        sprintWins: Number(x.sprint_wins) || 0
      };
    }).filter((x) => x.name);
  }

  /* LE CLASSEMENT DES EQUIPES EST CALCULE : le flux ne le publie pas a
     cette adresse. Au MotoGP, il additionne les points des pilotes de
     l'equipe -- y compris ceux d'un remplacant, qui roule pour elle --
     c'est donc ce qu'on fait, et l'aide le dit. Le classement des
     CONSTRUCTEURS, lui, ne retient que le meilleur pilote de chaque
     marque a chaque course : impossible a reconstituer depuis un total,
     il n'est donc pas propose plutot que d'etre faux.
     THE TEAM STANDINGS ARE COMPUTED: the feed does not publish them at
     this address. In MotoGP they add up the team riders' points, which
     is what we do (and the help says so). The MAKERS' standings keep only
     each brand's best rider per race: impossible to rebuild from totals,
     so they are not offered rather than being wrong. */
  function teamStandings(riders) {
    if (!Array.isArray(riders)) return null;
    const by = new Map();
    for (const r of riders) {
      if (!r.team) continue;
      const t = by.get(r.team) || { team: r.team, maker: r.maker, points: 0, wins: 0, riders: [] };
      t.points += r.points;
      t.wins += r.wins;
      t.riders.push(r.name.split(" ").slice(-1)[0]);
      by.set(r.team, t);
    }
    return Array.from(by.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.team.localeCompare(b.team))
      .map((t, i) => Object.assign(t, { position: i + 1 }));
  }

  /* Le dernier Grand Prix COURU : on ecarte les essais (`test`), qui ont
     aussi leur fiche de resultats, et l'on garde le plus recent par date
     de fin. The last Grand Prix RUN: tests are dropped. */
  function lastEvent(events) {
    if (!Array.isArray(events)) return null;
    const gp = events.filter((e) => e && !e.test && String(e.status || "").toUpperCase() === "FINISHED");
    gp.sort((a, b) => String(a.date_end || "").localeCompare(String(b.date_end || "")));
    const e = gp[gp.length - 1];
    return e ? { id: e.id, name: clean(e.name), short: e.short_name || "", iso: (e.country && e.country.iso) || "" } : null;
  }

  /* La seance voulue d'un Grand Prix : la course (RAC, ou RAC2 si elle a
     ete reprise) ou le sprint. On prend la DERNIERE du type : une course
     reprise remplace la premiere.
     The wanted session of a Grand Prix: the LAST of its type, since a
     restarted race supersedes the first. */
  function pickSession(sessions, which) {
    if (!Array.isArray(sessions)) return null;
    const want = which === "sprint" ? /^SPR/ : /^RAC/;
    const hits = sessions.filter((s) => want.test(String(s.type || "").toUpperCase())
      && String(s.status || "").toUpperCase() === "FINISHED");
    hits.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    return hits.length ? hits[hits.length - 1] : null;
  }

  /* UNE CHUTE N'EST PAS UNE VINGTIEME PLACE. Le flux marque les pilotes
     non classes d'un statut OUTSTND et d'une position vide : on les
     affiche comme tels, en fin de tableau et estompes.
     A CRASH IS NOT A TWENTIETH PLACE: unclassified riders carry OUTSTND
     and no position. */
  function parseClassification(json) {
    const list = json && Array.isArray(json.classification) ? json.classification : null;
    if (!list) return null;
    return list.map((x) => {
      const r = x.rider || {};
      const finished = x.position != null && String(x.status || "").toUpperCase() !== "OUTSTND";
      const gap = x.gap && x.gap.first != null ? String(x.gap.first) : "";
      const lap = x.gap && x.gap.lap && String(x.gap.lap) !== "0" ? String(x.gap.lap) : "";
      return {
        position: finished ? Number(x.position) : null,
        name: r.full_name || "",
        number: r.number != null ? String(r.number) : "",
        iso: (r.country && r.country.iso) || "",
        team: clean((x.team && x.team.name) || ""),
        maker: clean((x.constructor && x.constructor.name) || ""),
        points: Number(x.points) || 0,
        time: x.time || "",
        gap: lap ? "+" + lap + " " + "lap" : (gap && gap !== "0.000" ? "+" + gap : ""),
        laps: Number(x.total_laps) || 0,
        finished
      };
    }).filter((x) => x.name);
  }

  /* ---------- Meteo du circuit, a l'heure de chaque seance ----------
     Meme raisonnement que la tuile Formule 1 : la meteo d'une course
     n'est pas la meteo d'un lieu. Une ligne par seance, prevision a
     l'heure de la seance, en UTC de bout en bout. Le tableau WMO est
     RECOPIE et non partage : les tuiles restent independantes.
     Same reasoning as the Formula 1 tile: one line per session, forecast
     for that hour, UTC throughout. The WMO table is COPIED, not shared. */
  const METEO = "https://api.open-meteo.com/v1/forecast";
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
  function describeWeather(code) { return WMO.find((w) => w.codes.includes(Number(code))) || null; }
  function weatherUrl(lat, lon) {
    return METEO + `?latitude=${lat}&longitude=${lon}`
      + "&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&forecast_days=7&timezone=UTC";
  }
  function num(arr, i) {
    const v = Array.isArray(arr) ? arr[i] : null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  function parseWeather(json) {
    const h = (json || {}).hourly;
    if (!h || !Array.isArray(h.time) || !h.time.length) return null;
    const by = new Map();
    for (let i = 0; i < h.time.length; i++) {
      const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(h.time[i]) ? h.time[i] : h.time[i] + "Z");
      if (!Number.isFinite(t)) continue;
      by.set(t, { at: t, temp: num(h.temperature_2m, i), rain: num(h.precipitation_probability, i), code: num(h.weather_code, i) });
    }
    return by.size ? by : null;
  }
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

  /* ---------- Les blocs de la grille interne ---------- */
  const BLOCKS = [
    { id: "next", key: "showNext", titleKey: "motogp.card.next" },
    { id: "schedule", key: "showSchedule", titleKey: "motogp.card.schedule" },
    { id: "riders", key: "showRiders", titleKey: "motogp.card.riders" },
    { id: "teams", key: "showTeams", titleKey: "motogp.card.teams" },
    { id: "results", key: "showResults", titleKey: "motogp.card.results" },
    { id: "weather", key: "showWeather", titleKey: "motogp.card.weather" },
    { id: "circuit", key: "showCircuit", titleKey: "motogp.card.circuit", fit: false },
    /* Le logo (1.153.0) : la tuile Logo / Image hebergee, en option.
       The logo: the hosted Logo / Image tile, optional. */
    { id: "logo", key: "showLogo", titleKey: "motogp.card.logo", fit: false, optIn: true }
  ];

  const PRESETS = [
    { id: "compact", labelKey: "ig.preset.compact", items: {
      next: { x: 0, y: 0, w: 4, h: 3 }, schedule: { x: 0, y: 3, w: 4, h: 4 }, weather: { x: 0, y: 7, w: 4, h: 5 },
      circuit: { x: 4, y: 0, w: 4, h: 5 }, riders: { x: 4, y: 5, w: 4, h: 7 },
      teams: { x: 8, y: 0, w: 4, h: 5 }, results: { x: 8, y: 5, w: 4, h: 7 } } },
    { id: "standings", labelKey: "ig.preset.standings", items: {
      riders: { x: 0, y: 0, w: 4, h: 12 }, teams: { x: 4, y: 0, w: 4, h: 6 }, results: { x: 8, y: 0, w: 4, h: 6 },
      next: { x: 4, y: 6, w: 4, h: 3 }, schedule: { x: 4, y: 9, w: 4, h: 3 },
      circuit: { x: 8, y: 6, w: 4, h: 3 }, weather: { x: 8, y: 9, w: 4, h: 3 } } },
    { id: "weekend", labelKey: "ig.preset.weekend", items: {
      circuit: { x: 0, y: 0, w: 6, h: 7 }, next: { x: 6, y: 0, w: 6, h: 3 },
      schedule: { x: 6, y: 3, w: 3, h: 4 }, weather: { x: 9, y: 3, w: 3, h: 4 },
      results: { x: 0, y: 7, w: 4, h: 5 }, riders: { x: 4, y: 7, w: 4, h: 5 }, teams: { x: 8, y: 7, w: 4, h: 5 } } },
    { id: "season", labelKey: "ig.preset.season", items: {
      riders: { x: 0, y: 0, w: 5, h: 12 }, teams: { x: 5, y: 0, w: 4, h: 6 }, results: { x: 5, y: 6, w: 4, h: 6 },
      next: { x: 9, y: 0, w: 3, h: 3 }, circuit: { x: 9, y: 3, w: 3, h: 3 },
      schedule: { x: 9, y: 6, w: 3, h: 3 }, weather: { x: 9, y: 9, w: 3, h: 3 } } }
  ];

  const LIVE_MS = 60 * 60000;

  class MotoGpWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.data = null;
      this.error = null;
      this.weather = null;
      this.ids = null;          /* { season, year, category } -- stables pour la saison */
      this.resultsKey = "";
      this.timer = null;
      this.tick = null;
      this.wrap = null;
      this.circuitHost = null;
      this.circuitInst = null;
      this.circuitConf = "";
      this.logo = window.PiBoardInnerGrid && window.PiBoardInnerGrid.LogoSlot
        ? new window.PiBoardInnerGrid.LogoSlot(ctx, "pwmgp-logo") : null;
      this.board = window.PiBoardInnerGrid ? new window.PiBoardInnerGrid.BlockBoard({
        ctx, kind: "motogp", blocks: BLOCKS, presets: PRESETS,
        defaultPreset: "compact", seasonPreset: "season", weekendPreset: "weekend",
        isWeekend: (now) => isRaceWeekend(this.data && this.data.races, now),
        onRelayout: () => this.render(),
        onShown: () => this.refresh()
      }) : null;
    }

    locale() {
      const raw = this.ctx.i18n.t("clock.date.format");
      try {
        if (raw && typeof raw === "string") { new Intl.DateTimeFormat(raw); return raw; }
      } catch (e) { /* etiquette inutilisable / unusable label */ }
      return (typeof navigator !== "undefined" && navigator.language) || "fr-FR";
    }

    lang() {
      const l = this.ctx.i18n && this.ctx.i18n.lang;
      return typeof l === "string" ? l : "fr";
    }

    year() {
      const raw = String(this.ctx.settings.season || "").trim();
      return /^\d{4}$/.test(raw) ? raw : "";
    }

    init() {
      this.render();
      this.refresh();
      this.arm();
      this.tick = setInterval(() => {
        this.paintCountdown();
        if (this.board && this.data && this.board.slotChanged(Date.now())) this.render();
      }, 1000);
    }

    onSettingsChanged(settings) {
      const before = this.year() + "|" + this.ctx.settings.resultsSession;
      this.ctx.settings = settings || this.ctx.settings;
      if (this.year() + "|" + this.ctx.settings.resultsSession !== before) {
        this.data = null; this.ids = null; this.resultsKey = "";
      }
      this.render();
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    arm() {
      clearTimeout(this.timer);
      const mins = Math.max(5, Math.min(360, Number(this.ctx.settings.refreshMinutes) || 30));
      this.timer = setTimeout(() => { this.refresh(); this.arm(); }, mins * 60000);
    }

    async fetchJson(url) {
      const res = await fetch(this.ctx.api.proxyUrl(url), { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }

    /* La saison et la categorie ne changent pas d'un releve a l'autre :
       elles sont demandees UNE fois. Season and category are asked ONCE. */
    async resolveIds() {
      if (this.ids) return this.ids;
      const season = pickSeason(await this.fetchJson(`${FEED}/results/seasons`), this.year());
      if (!season) throw new Error("no season");
      const cat = pickCategory(await this.fetchJson(`${FEED}/results/categories?seasonUuid=${season.id}`));
      if (!cat) throw new Error("no category");
      this.ids = { season: season.id, year: season.year, category: cat.id };
      return this.ids;
    }

    /* CHAQUE BLOC ABSENT N'EST PAS DEMANDE, comme pour la Formule 1 : le
       flux est public et gratuit, autant ne pas l'interroger pour rien.
       Les resultats ne sont relus que si un nouveau Grand Prix a ete
       couru : un classement de course termine ne change plus.
       A BLOCK NOT SHOWN IS NOT FETCHED. Results are re-read only when a
       new Grand Prix has been run. */
    async refresh() {
      const s = this.ctx.settings;
      const needCal = s.showNext !== false || s.showSchedule !== false || s.showWeather !== false
        || s.showCircuit !== false || s.autoLayout === true;
      const needStand = s.showRiders !== false || s.showTeams !== false;
      const needRes = s.showResults !== false;
      const prev = this.data || {};
      try {
        const ids = (needStand || needRes) ? await this.resolveIds() : null;
        const calYear = this.year() || (ids && ids.year) || new Date().getFullYear();
        const jobs = [
          needCal ? this.fetchJson(`${FEED}/events?seasonYear=${calYear}`).then(parseCalendar) : Promise.resolve(prev.races || null),
          needStand ? this.fetchJson(`${FEED}/results/standings?seasonUuid=${ids.season}&categoryUuid=${ids.category}`).then(parseRiders) : Promise.resolve(prev.riders || null),
          needRes ? this.loadResults(ids) : Promise.resolve(prev.results || null)
        ];
        const [races, riders, results] = await Promise.all(jobs);
        this.data = { races, riders, teams: teamStandings(riders), results, at: Date.now() };
        this.error = null;
      } catch (e) {
        /* Une erreur n'efface pas ce qu'on affichait. An error does not
           wipe what was displayed. */
        this.error = String((e && e.message) || e);
      }
      this.render();
      if (this.data && s.showWeather !== false) this.refreshWeather();
    }

    async loadResults(ids) {
      const which = this.ctx.settings.resultsSession === "sprint" ? "sprint" : "race";
      const ev = lastEvent(await this.fetchJson(`${FEED}/results/events?seasonUuid=${ids.season}&isFinished=true`));
      if (!ev) return null;
      const key = ev.id + "|" + which;
      if (key === this.resultsKey && this.data && this.data.results) return this.data.results;
      const sess = pickSession(await this.fetchJson(`${FEED}/results/sessions?eventUuid=${ev.id}&categoryUuid=${ids.category}`), which);
      if (!sess) return { event: ev, which, rows: [] };
      const rows = parseClassification(await this.fetchJson(`${FEED}/results/session/${sess.id}/classification?test=false`)) || [];
      this.resultsKey = key;
      return { event: ev, which, rows };
    }

    async refreshWeather() {
      const now = Date.now();
      const race = nextRace(this.data.races || [], now) || lastRace(this.data.races || [], now);
      if (!race || !Number.isFinite(race.lat) || !Number.isFinite(race.lon)) return;
      try {
        this.weather = { round: race.round, table: parseWeather(await this.fetchJson(weatherUrl(race.lat, race.lon))) };
      } catch (e) {
        this.weather = { round: race.round, table: null };
      }
      this.render();
    }

    /* ---------- Rendu : meme mecanique que la tuile Formule 1 ---------- */
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

    skinClass() {
      const v = String(this.ctx.settings.cardStyle || "theme");
      if (v === "dark") return " pwmgp-skin-dark";
      if (v === "custom") return " pwmgp-skin-dark pwmgp-skin-custom";
      return "";
    }

    skinStyleValue() {
      if (String(this.ctx.settings.cardStyle || "theme") !== "custom") return "";
      const raw = String(this.ctx.settings.cardColor || "").trim();
      return /^#[0-9a-fA-F]{6}$/.test(raw) ? `--pwmgp-skin-bg: ${raw}` : "";
    }

    render() {
      const i18n = this.ctx.i18n;
      const wrap = this.ensureWrap();
      const style = this.skinStyleValue();
      if (style) wrap.setAttribute("style", style); else wrap.removeAttribute("style");

      if (!this.data) {
        if (this.board) this.board.unmount();
        wrap.className = "pw-motogp";
        wrap.innerHTML = `<div class="pwmgp-msg">${esc(i18n.t(this.error ? "motogp.error" : "motogp.loading"))}</div>`;
        return;
      }

      const now = Date.now();
      const vis = this.visibleBlocks();
      this.syncCircuit(vis.some((b) => b.id === "circuit"));
      if (this.logo) this.logo.sync(vis.some((b) => b.id === "logo"));
      this.solo = vis.length === 1;
      const stale = this.error ? `<div class="pwmgp-stale">${esc(i18n.t("motogp.stale"))}</div>` : "";

      if (!vis.length || this.solo || !this.board) {
        if (this.board) this.board.unmount();
        wrap.className = "pw-motogp" + (this.solo ? " pwmgp-solo" : "") + this.skinClass();
        const cards = vis.map((b) => this.cardFor(b.id, now)).join("");
        wrap.innerHTML = (cards || `<div class="pwmgp-msg">${esc(i18n.t("motogp.noCard"))}</div>`) + stale;
        this.placeCircuit(wrap);
        if (this.logo) this.logo.place(wrap);
        this.paintCountdown();
        return;
      }

      wrap.className = "pw-motogp pwmgp-grid" + this.skinClass();
      for (const n of Array.from(wrap.children)) if (!n.classList.contains("pig-root")) n.remove();
      const grid = this.board.mount(wrap);
      for (const b of vis) {
        const body = grid.body(b.id);
        if (!body) continue;
        body.innerHTML = this.cardFor(b.id, now);
        if (b.id === "circuit") this.placeCircuit(body);
        if (b.id === "logo" && this.logo) this.logo.place(body);
      }
      if (stale) wrap.insertAdjacentHTML("beforeend", stale);
      grid.scheduleFit();
      this.paintCountdown();
    }

    cardFor(id, now) {
      switch (id) {
        case "next": return this.cardNext(now);
        case "schedule": return this.cardSchedule(now);
        case "riders": return this.cardRiders();
        case "teams": return this.cardTeams();
        case "results": return this.cardResults();
        case "weather": return this.cardWeather(now);
        case "circuit": return this.cardCircuit(now);
        case "logo": return this.logo ? this.logo.markup(this.ctx.settings.logoFrame === true) : "";
        default: return "";
      }
    }

    card(title, inner, extra) {
      const head = this.solo ? "" : `<h3 class="pwmgp-card-title">${esc(title)}</h3>`;
      return `<section class="pwmgp-card${extra ? " " + extra : ""}">${head}${inner}</section>`;
    }

    msgCard(titleKey, msgKey) {
      return this.card(this.ctx.i18n.t(titleKey), `<div class="pwmgp-msg">${esc(this.ctx.i18n.t(msgKey))}</div>`);
    }

    sessionLabel(kind) { return this.ctx.i18n.t("motogp.session." + kind); }

    gpTitle(race) {
      const place = raceName(race, this.lang());
      return place ? this.ctx.i18n.t("motogp.gp").replace("{place}", place) : (race.fullName || "");
    }

    cardNext(now) {
      const i18n = this.ctx.i18n;
      const race = nextRace(this.data.races || [], now);
      if (!race) return this.msgCard("motogp.card.next", "motogp.seasonOver");
      const sess = nextSession(race, now);
      const target = sess ? sess.at : race.at;
      const flag = flagOf(race.iso);
      const laps = race.laps ? i18n.t("motogp.laps").replace("{n}", race.laps)
        + (race.sprintLaps ? " · " + i18n.t("motogp.sprintLaps").replace("{n}", race.sprintLaps) : "") : "";
      return this.card(i18n.t("motogp.card.next"), `
        <div class="pwmgp-next">
          <div class="pwmgp-next-head">
            ${flag ? `<span class="pwmgp-flag">${flag}</span>` : ""}
            <span class="pwmgp-round">${esc(String(race.round))}</span>
            <span class="pwmgp-race">${esc(this.gpTitle(race))}</span>
          </div>
          <div class="pwmgp-next-sub">${esc(race.circuitName)}${laps ? " · " + esc(laps) : ""}</div>
          <div class="pwmgp-cd-wrap">
            <span class="pwmgp-cd-label">${esc(this.sessionLabel(sess ? sess.kind : "race"))}</span>
            <span class="pwmgp-cd" data-cd="${target}"></span>
          </div>
          <div class="pwmgp-next-when">${esc(dayTime(target, this.locale()))}</div>
        </div>`);
    }

    cardSchedule(now) {
      const race = nextRace(this.data.races || [], now) || lastRace(this.data.races || [], now);
      if (!race) return this.msgCard("motogp.card.schedule", "motogp.noData");
      const rows = race.sessions.map((x) => {
        const live = x.at <= now && now - x.at < LIVE_MS;
        const past = x.at + LIVE_MS <= now;
        return `<div class="pwmgp-sess${live ? " pwmgp-sess-live" : ""}${past ? " pwmgp-sess-past" : ""}${x.kind === "race" || x.kind === "sprint" ? " pwmgp-sess-race" : ""}">
          <span class="pwmgp-sess-name">${esc(this.sessionLabel(x.kind))}</span>
          <span class="pwmgp-sess-when">${esc(dayTime(x.at, this.locale()))}</span>
        </div>`;
      }).join("");
      return this.card(this.ctx.i18n.t("motogp.card.schedule"),
        `<div class="pwmgp-sched"><div class="pwmgp-sched-head">${esc(this.gpTitle(race))}</div>${rows}</div>`);
    }

    who(r) {
      const colors = this.ctx.settings.showTeamColors !== false;
      const flag = flagOf(r.iso);
      return `<div class="pwmgp-who-in">
        ${colors ? `<span class="pwmgp-team" style="--pwmgp-team:${makerColor(r.maker)}"></span>` : ""}
        ${flag ? `<span class="pwmgp-flag">${flag}</span>` : ""}
        ${r.number ? `<span class="pwmgp-num">${esc(r.number)}</span>` : ""}
        <span class="pwmgp-name">${esc(r.name)}</span>
      </div>`;
    }

    cardRiders() {
      const i18n = this.ctx.i18n;
      const list = this.data.riders;
      if (!list || !list.length) return this.msgCard("motogp.card.riders", "motogp.noData");
      const n = Math.max(3, Math.min(30, Number(this.ctx.settings.riderRows) || 10));
      const rows = list.slice(0, n).map((r) => `<tr>
          <td class="pwmgp-pos">${esc(r.position || "")}</td>
          <td class="pwmgp-who">${this.who(r)}</td>
          <td class="pwmgp-pts">${esc(r.points)}</td>
          <td class="pwmgp-wins">${esc(r.wins)}</td>
        </tr>`).join("");
      return this.card(i18n.t("motogp.card.riders"), `
        <table class="pwmgp-table">
          <thead><tr><th></th><th>${esc(i18n.t("motogp.th.rider"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th><th>${esc(i18n.t("f1.th.wins"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    cardTeams() {
      const i18n = this.ctx.i18n;
      const list = this.data.teams;
      if (!list || !list.length) return this.msgCard("motogp.card.teams", "motogp.noData");
      const n = Math.max(3, Math.min(12, Number(this.ctx.settings.teamRows) || 11));
      const colors = this.ctx.settings.showTeamColors !== false;
      const rows = list.slice(0, n).map((t) => `<tr>
          <td class="pwmgp-pos">${esc(t.position)}</td>
          <td class="pwmgp-who"><div class="pwmgp-who-in">
            ${colors ? `<span class="pwmgp-team" style="--pwmgp-team:${makerColor(t.maker)}"></span>` : ""}
            <span class="pwmgp-name" title="${esc(t.riders.join(", "))}">${esc(t.team)}</span>
          </div></td>
          <td class="pwmgp-pts">${esc(t.points)}</td>
        </tr>`).join("");
      return this.card(i18n.t("motogp.card.teams"), `
        <table class="pwmgp-table">
          <thead><tr><th></th><th>${esc(i18n.t("f1.th.team"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="pwmgp-note">${esc(i18n.t("motogp.teams.computed"))}</div>`);
    }

    cardResults() {
      const i18n = this.ctx.i18n;
      const res = this.data.results;
      const titleKey = res && res.which === "sprint" ? "motogp.card.sprint" : "motogp.card.results";
      if (!res || !res.rows || !res.rows.length) return this.msgCard(titleKey, "motogp.noData");
      const n = Math.max(3, Math.min(30, Number(this.ctx.settings.resultRows) || 10));
      const rows = res.rows.slice(0, n).map((r) => `<tr class="${r.finished ? "" : "pwmgp-dnf"}">
          <td class="pwmgp-pos">${r.finished ? esc(r.position) : "—"}</td>
          <td class="pwmgp-who">${this.who(r)}</td>
          <td class="pwmgp-gap">${esc(r.finished ? (r.position === 1 ? r.time : r.gap.replace(" lap", " " + i18n.t("motogp.lap"))) : i18n.t("motogp.dnf"))}</td>
          <td class="pwmgp-pts">${r.points ? esc(r.points) : ""}</td>
        </tr>`).join("");
      const place = res.event && res.event.name ? res.event.name : "";
      return this.card(i18n.t(titleKey), `
        ${place ? `<div class="pwmgp-sched-head">${esc(place)}</div>` : ""}
        <table class="pwmgp-table">
          <thead><tr><th></th><th>${esc(i18n.t("motogp.th.rider"))}</th><th>${esc(i18n.t("f1.th.gap"))}</th><th>${esc(i18n.t("f1.th.pts"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    cardWeather(now) {
      const i18n = this.ctx.i18n;
      const race = nextRace(this.data.races || [], now) || lastRace(this.data.races || [], now);
      if (!race) return this.msgCard("motogp.card.weather", "motogp.noData");
      if (!this.weather) return this.msgCard("motogp.card.weather", "motogp.loading");
      if (!this.weather.table) return this.msgCard("motogp.card.weather", "f1.weather.none");
      const lang = this.lang() === "en" ? "en" : "fr";
      let beyond = false;
      const rows = race.sessions.map((x) => {
        const w = weatherAt(this.weather.table, x.at);
        const past = x.at + LIVE_MS <= now;
        if (!w && !past) beyond = true;
        const cond = w ? describeWeather(w.code) : null;
        const rain = w && w.rain != null ? Math.round(w.rain) : null;
        return `<div class="pwmgp-wx${past ? " pwmgp-sess-past" : ""}">
          <span class="pwmgp-sess-name">${esc(this.sessionLabel(x.kind))}</span>
          <span class="pwmgp-wx-when">${esc(dayTime(x.at, this.locale()))}</span>
          <span class="pwmgp-wx-cond" title="${esc(cond ? cond[lang] : "")}">${cond ? cond.icon : "–"}</span>
          <span class="pwmgp-wx-temp">${w && w.temp != null ? esc(Math.round(w.temp) + "°") : "–"}</span>
          <span class="pwmgp-wx-rain${rain != null && rain >= 30 ? " pwmgp-wx-wet" : ""}">${rain != null ? esc(rain + "%") : "–"}</span>
        </div>`;
      }).join("");
      return this.card(i18n.t("motogp.card.weather"), `
        <div class="pwmgp-sched-head">${esc(race.circuitName)}</div>
        <div class="pwmgp-wx pwmgp-wx-head">
          <span class="pwmgp-sess-name">${esc(i18n.t("f1.wx.session"))}</span><span class="pwmgp-wx-when"></span><span class="pwmgp-wx-cond"></span>
          <span class="pwmgp-wx-temp">${esc(i18n.t("f1.wx.temp"))}</span><span class="pwmgp-wx-rain">${esc(i18n.t("f1.wx.rain"))}</span>
        </div>
        ${rows}
        ${beyond ? `<div class="pwmgp-note">${esc(i18n.t("f1.weather.horizon"))}</div>` : ""}
        <div class="pwmgp-note pwmgp-credit">Open-Meteo</div>`);
    }

    /* LE PLAN DU CIRCUIT : la tuile Plan du circuit, hebergee telle
       quelle et reglee sur « Suivre le calendrier de MotoGP » -- la base
       des circuits, le rattachement aux Grands Prix MotoGP et les
       chiffres officiels du flux viennent tous d'elle.
       THE CIRCUIT MAP: the Circuit map tile, hosted as is and set to
       "Follow the MotoGP calendar". */
    circuitSettings() {
      const s = this.ctx.settings;
      return { circuit: "follow:motogp", showSpecs: s.circuitSpecs !== false, showCorners: true, showDirection: true, showWeather: false };
    }

    syncCircuit(wanted) {
      if (!wanted) {
        if (this.circuitInst) { try { this.circuitInst.destroy(); } catch (e) { /* noop */ } }
        this.circuitInst = null; this.circuitHost = null; this.circuitConf = "";
        return;
      }
      const conf = JSON.stringify(this.circuitSettings());
      if (!this.circuitHost) {
        this.circuitHost = document.createElement("div");
        this.circuitHost.className = "pwmgp-circ-host";
      }
      if (!this.circuitInst) {
        const P = window.PiBoard;
        this.circuitInst = P && typeof P.embedWidget === "function"
          ? P.embedWidget("circuit", this.circuitHost, this.circuitSettings()) : null;
        this.circuitConf = conf;
        if (!this.circuitInst) this.circuitHost.innerHTML = `<div class="pwmgp-msg">${esc(this.ctx.i18n.t("f1.circuit.unavailable"))}</div>`;
      } else if (conf !== this.circuitConf) {
        this.circuitConf = conf;
        try { this.circuitInst.onSettingsChanged(Object.assign({}, this.circuitInst.ctx.settings, this.circuitSettings())); } catch (e) { /* noop */ }
      }
    }

    placeCircuit(scope) {
      if (!this.circuitHost || !scope) return;
      const slot = scope.querySelector(".pwmgp-circ-slot");
      if (slot && this.circuitHost.parentNode !== slot) slot.appendChild(this.circuitHost);
    }

    cardCircuit(now) {
      const race = nextRace(this.data.races || [], now);
      let overlay = "";
      if (race && this.ctx.settings.circuitCountdown !== false) {
        const sess = nextSession(race, now);
        overlay = `<div class="pwmgp-circ-cd"><span class="pwmgp-circ-cd-label">${esc(this.sessionLabel(sess ? sess.kind : "race"))}</span><span class="pwmgp-cd pwmgp-circ-cd-time" data-cd="${sess ? sess.at : race.at}"></span></div>`;
      }
      return this.card(this.ctx.i18n.t("motogp.card.circuit"),
        `<div class="pwmgp-circ-wrap">${overlay}<div class="pwmgp-circ-slot"></div></div>`, "pwmgp-circ-card");
    }

    paintCountdown() {
      for (const el of this.ctx.el.querySelectorAll("[data-cd]")) {
        const target = Number(el.dataset.cd);
        if (!Number.isFinite(target)) continue;
        const left = target - Date.now();
        el.textContent = countdown(left, this.ctx.i18n);
        el.classList.toggle("pwmgp-cd-now", left <= 0);
      }
    }

    destroy() {
      clearTimeout(this.timer);
      clearInterval(this.tick);
      this.syncCircuit(false);
      if (this.logo) this.logo.destroy();
      if (this.board) this.board.unmount();
    }
  }

  window.PiBoard.registerWidget("motogp", MotoGpWidget);

  /* Expose pour les tests : les fonctions pures. Exposed for tests. */
  window.PiBoardMotoGpHelpers = {
    parseCalendar, nextRace, lastRace, nextSession, isRaceWeekend, raceName, sessionKind, parseIso,
    pickSeason, pickCategory, parseRiders, teamStandings, lastEvent, pickSession, parseClassification,
    parseWeather, weatherAt, weatherUrl, flagOf, makerColor, countdown, BLOCKS, PRESETS, RACE_LENGTH_MS
  };
})();
