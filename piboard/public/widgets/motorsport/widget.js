/* PiBoard widget: sports mecaniques / motorsport schedule
   Programme complet des seances d'un week-end de F1 ou de MotoGP.

   Deux sources, toutes deux gratuites et sans cle :
   - F1 : api.jolpi.ca (Jolpica), successeur communautaire d'Ergast
     (retire fin 2024) et compatible avec son schema. Le calendrier de
     la saison porte, pour chaque manche, la date et l'heure de chaque
     seance (essais, qualifications, sprint, course).
   - MotoGP : api.motogp.pulselive.com, le flux public que motogp.com
     utilise lui-meme pour son propre calendrier. Non documente
     officiellement (voir github.com/robschmitt/MotoGP-API pour un
     travail de documentation communautaire) : il peut donc changer
     sans preavis. Le widget se replie proprement sur un message
     d'indisponibilite le cas echeant, comme les autres tuiles.

   Les deux passent par /api/proxy (CORS), comme les autres widgets qui
   interrogent des API tierces depuis le navigateur.

   Full session timetable for an F1 or MotoGP race weekend.

   Two sources, both free and keyless:
   - F1: api.jolpi.ca (Jolpica), the community successor to Ergast
     (retired end of 2024) and compatible with its schema. The season
     calendar carries, for each round, the date and time of every
     session (practice, qualifying, sprint, race).
   - MotoGP: api.motogp.pulselive.com, the public feed motogp.com uses
     for its own calendar. Not officially documented (see
     github.com/robschmitt/MotoGP-API for community documentation work):
     it may therefore change without notice. The widget degrades
     cleanly to an "unavailable" message if so, like the other tiles.

   Both go through /api/proxy (CORS), like the other widgets querying
   third-party APIs from the browser. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Certaines dates MotoGP arrivent avec un decalage horaire sans
     deux-points ("+0100"), forme que la specification ECMAScript
     n'impose pas aux moteurs d'accepter. Normalise en "+01:00" avant
     analyse, plutot que de dependre de la tolerance du navigateur.
     Some MotoGP dates come with a timezone offset without a colon
     ("+0100"), a form the ECMAScript spec doesn't require engines to
     accept. Normalized to "+01:00" before parsing, rather than relying
     on browser leniency. */
  function parseIso(s) {
    if (!s) return null;
    const d = new Date(String(s).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    return isNaN(d.getTime()) ? null : d;
  }

  // Ergast/Jolpica separe date ("2026-03-08") et heure ("15:00:00Z").
  // Ergast/Jolpica splits date ("2026-03-08") and time ("15:00:00Z").
  function ergastDate(node) {
    if (!node || !node.date) return null;
    return parseIso(node.time ? `${node.date}T${node.time}` : `${node.date}T00:00:00Z`);
  }

  /* Classe une seance en 4 familles, pour la couleur et la mise en
     avant. Volontairement tolerant : une seance inconnue retombe sur
     "practice" (neutre) plutot que de casser l'affichage.
     Sorts a session into 4 families, driving color and emphasis.
     Deliberately lenient: an unknown session falls back to "practice"
     (neutral) rather than breaking the display. */
  function kindOf(shortname) {
    const s = String(shortname || "").toUpperCase();
    if (s.startsWith("RAC") || s === "RACE") return "race";
    if (s.startsWith("SPR")) return "sprint";
    if (s.startsWith("Q") || s.startsWith("SQ")) return "qualifying";
    return "practice";
  }

  // Libelles courts localises des seances MotoGP, a partir de leur code
  // officiel. Localized short session labels for MotoGP, from their
  // official code.
  function motogpLabel(shortname, fallbackName, lang) {
    const s = String(shortname || "").toUpperCase();
    const FR = { RAC: "Course", SPR: "Sprint", WUP: "Warm-up", Q1: "Q1", Q2: "Q2" };
    const EN = { RAC: "Race", SPR: "Sprint", WUP: "Warm-up", Q1: "Q1", Q2: "Q2" };
    const map = lang === "fr" ? FR : EN;
    if (map[s]) return map[s];
    // FP1/FP2/P1/P2/PR... -> "EL1"/"FP1"
    const m = s.match(/^(?:FP|P)(\d*)$/);
    if (m) return (lang === "fr" ? "EL" : "FP") + (m[1] || "");
    return fallbackName || shortname || "?";
  }

  class MotorsportWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.tickTimer = null;
      this.data = null; // { events: [...] } normalise / normalized
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-motorsport"><div class="pwms-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      clearInterval(this.tickTimer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 60);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
      /* Re-rendu chaque minute a partir des donnees deja en memoire :
         garde a jour les mises en avant "en direct" et "prochaine
         seance" sans refaire d'appel reseau -- un programme de
         week-end ne change pas, seule notre position dedans change.
         Re-render every minute from already-cached data: keeps the
         "live" and "next session" highlights current without any
         network call -- a weekend timetable doesn't change, only our
         position within it does. */
      this.tickTimer = setInterval(() => { if (this.data) this.render(); }, 60000);
    }

    onSettingsChanged(settings) {
      const seriesChanged = settings.series !== this.ctx.settings.series;
      this.ctx.settings = settings;
      if (seriesChanged) this.data = null;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async fetchJson(url) {
      const res = await fetch(this.ctx.api.proxyUrl(url), { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }

    /* Normalise les deux sources vers une meme forme :
       { name, circuit, round, start, end, sessions: [{ label, kind, start }] }
       Normalizes both sources into a single shape. */
    async loadF1(year, lang) {
      const data = await this.fetchJson(`https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`);
      const races = (data && data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races) || [];
      if (!races.length) throw new Error("no f1 races");
      const L = lang === "fr"
        ? { fp1: "EL1", fp2: "EL2", fp3: "EL3", sq: "Qualif. sprint", spr: "Sprint", q: "Qualifications", r: "Course" }
        : { fp1: "FP1", fp2: "FP2", fp3: "FP3", sq: "Sprint Quali", spr: "Sprint", q: "Qualifying", r: "Race" };
      return races.map((r) => {
        const defs = [
          [L.fp1, "practice", r.FirstPractice],
          [L.fp2, "practice", r.SecondPractice],
          [L.fp3, "practice", r.ThirdPractice],
          [L.sq, "qualifying", r.SprintQualifying || r.SprintShootout],
          [L.spr, "sprint", r.Sprint],
          [L.q, "qualifying", r.Qualifying],
          [L.r, "race", { date: r.date, time: r.time }]
        ];
        const sessions = defs
          .map(([label, kind, node]) => ({ label, kind, start: ergastDate(node) }))
          .filter((s) => s.start)
          .sort((a, b) => a.start - b.start);
        const loc = (r.Circuit && r.Circuit.Location) || {};
        return {
          name: r.raceName,
          circuit: [r.Circuit && r.Circuit.circuitName, loc.locality].filter(Boolean).join(" · "),
          round: r.round,
          sessions,
          start: sessions.length ? sessions[0].start : null,
          end: sessions.length ? sessions[sessions.length - 1].start : null
        };
      }).filter((e) => e.sessions.length);
    }

    async loadMotoGp(year, lang) {
      const events = await this.fetchJson(`https://api.motogp.pulselive.com/motogp/v1/events?seasonYear=${year}`);
      if (!Array.isArray(events) || !events.length) throw new Error("no motogp events");
      const onlyMgp = this.ctx.settings.motogpClasses !== "all";
      return events.map((ev, i) => {
        const broadcasts = Array.isArray(ev.broadcasts) ? ev.broadcasts : [];
        const sessions = broadcasts
          // Seules les vraies seances de piste : le flux contient aussi
          // des rendez-vous presse et emissions ("MEDIA"/"PRESS").
          // Track sessions only: the feed also carries press events and
          // TV shows ("MEDIA"/"PRESS").
          .filter((b) => String(b.type || "").toUpperCase() === "SESSION")
          .filter((b) => !onlyMgp || String((b.category && b.category.acronym) || "").toUpperCase() === "MGP")
          .map((b) => {
            const cat = (b.category && b.category.name) || "";
            const base = motogpLabel(b.shortname, b.name, lang);
            return {
              // En multi-categories, le nom de la categorie est
              // indispensable pour distinguer les seances homonymes.
              // With multiple classes, the class name is essential to
              // tell same-named sessions apart.
              label: onlyMgp || !cat ? base : `${base} · ${cat}`,
              kind: kindOf(b.shortname),
              start: parseIso(b.date_start)
            };
          })
          .filter((s) => s.start)
          .sort((a, b) => a.start - b.start);
        const circuit = ev.circuit || {};
        return {
          name: ev.sponsored_name || ev.name || "",
          circuit: [circuit.name, circuit.city].filter(Boolean).join(" · "),
          round: ev.sequence != null ? String(ev.sequence) : String(i + 1),
          sessions,
          start: sessions.length ? sessions[0].start : parseIso(ev.date_start),
          end: sessions.length ? sessions[sessions.length - 1].start : parseIso(ev.date_end)
        };
      }).filter((e) => e.sessions.length);
    }

    async refresh() {
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang;
      const year = new Date().getFullYear();
      try {
        const events = s.series === "motogp"
          ? await this.loadMotoGp(year, lang)
          : await this.loadF1(year, lang);
        this.data = { events, lang };
        this.render();
      } catch (e) {
        console.warn("[piboard/motorsport]", e);
        this.ctx.el.innerHTML = `<div class="pw-motorsport"><div class="pwms-err">${this.ctx.i18n.t("motorsport.error")}</div></div>`;
      }
    }

    /* Manche "courante" : la premiere dont la derniere seance n'est pas
       encore passee (un week-end en cours reste donc affiche jusqu'a sa
       course, plutot que de sauter a la manche suivante des le samedi).
       "Current" round: the first whose last session hasn't happened yet
       (an ongoing weekend therefore stays displayed through its race,
       rather than jumping to the next round from Saturday onward). */
    currentEventIndex() {
      const now = Date.now();
      const evts = this.data.events;
      const idx = evts.findIndex((e) => e.end && e.end.getTime() + 2 * 3600000 >= now);
      return idx === -1 ? evts.length - 1 : idx;
    }

    render() {
      if (!this.data) return;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const credit = s.series === "motogp" ? "motogp.com" : "Jolpica · Ergast";
      const body = s.mode === "season" ? this.renderSeason() : this.renderNext();
      this.ctx.el.innerHTML = `<div class="pw-motorsport">${body}<div class="pwms-credit">${credit}</div></div>`;
      void i18n;
    }

    renderNext() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const locale = i18n.t("clock.date.format");
      const evts = this.data.events;
      if (!evts.length) return `<div class="pwms-empty">${i18n.t("motorsport.empty")}</div>`;
      const ev = evts[this.currentEventIndex()];
      const now = Date.now();

      // Premiere seance encore a venir : mise en avant "prochaine".
      // First session still ahead: gets the "next" emphasis.
      const nextIdx = ev.sessions.findIndex((x) => x.start.getTime() > now);

      let html = "";
      let lastDay = "";
      ev.sessions.forEach((x, i) => {
        const startMs = x.start.getTime();
        // Une seance est consideree "en cours" pendant une heure apres
        // son debut : le flux ne donne pas toujours une heure de fin
        // fiable, et c'est l'ordre de grandeur d'une seance.
        // A session counts as "live" for an hour after its start: the
        // feed doesn't always give a reliable end time, and that's the
        // right order of magnitude for a session.
        const live = startMs <= now && now < startMs + 3600000;
        const past = startMs + 3600000 <= now;
        if (past && s.hidePast) return;
        const day = x.start.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "2-digit" });
        if (day !== lastDay) {
          html += `<div class="pwms-day">${escapeHtml(day)}</div>`;
          lastDay = day;
        }
        const cls = ["pwms-session", "pwms-kind-" + x.kind];
        if (live) cls.push("pwms-live");
        else if (past) cls.push("pwms-past");
        else if (i === nextIdx) cls.push("pwms-next");
        html += `
          <div class="${cls.join(" ")}">
            <div class="pwms-chip"></div>
            <div class="pwms-label">${escapeHtml(x.label)}</div>
            <div class="pwms-time">${x.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div>
          </div>`;
      });
      if (!html) html = `<div class="pwms-empty">${i18n.t("motorsport.allDone")}</div>`;

      return `
        <div class="pwms-head">
          <div class="pwms-event">${escapeHtml(ev.name)}</div>
          <div class="pwms-circuit">${escapeHtml(ev.circuit)}</div>
        </div>
        <div class="pwms-body">${html}</div>`;
    }

    renderSeason() {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      const evts = this.data.events;
      if (!evts.length) return `<div class="pwms-empty">${i18n.t("motorsport.empty")}</div>`;
      const currentIdx = this.currentEventIndex();
      const max = Math.max(1, Math.min(25, Number(this.ctx.settings.maxItems) || 6));
      const shown = evts.slice(currentIdx, currentIdx + max);
      const fmt = (d) => d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
      const rows = shown.map((ev, i) => {
        const range = ev.start && ev.end && fmt(ev.start) !== fmt(ev.end)
          ? `${fmt(ev.start)} – ${fmt(ev.end)}`
          : (ev.start ? fmt(ev.start) : "");
        return `
          <div class="pwms-evt ${i === 0 ? "pwms-current" : ""}">
            <div class="pwms-evt-round">${escapeHtml(ev.round)}</div>
            <div class="pwms-evt-name">${escapeHtml(ev.name)}</div>
            <div class="pwms-evt-date">${escapeHtml(range)}</div>
          </div>`;
      }).join("");
      return `<div class="pwms-body">${rows}</div>`;
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.tickTimer);
    }
  }

  window.PiBoard.registerWidget("motorsport", MotorsportWidget);
})();
