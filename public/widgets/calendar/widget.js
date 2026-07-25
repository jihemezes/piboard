/* PiBoard widget: agenda / calendar (ICS)
   Fusionne plusieurs calendriers iCal (.ics) en une seule tuile, chacun
   dans sa propre couleur. Parseur ICS et moteur de recurrence RRULE
   ecrits en JS pur (pas de dependance externe), en passant par le proxy
   generique /api/proxy du serveur pour eviter tout probleme de CORS et
   pour convertir les liens webcal:// (iPhone/iCloud) en https://.
   Merges several iCal (.ics) calendars into a single tile, each in its
   own color. Plain-JS ICS parser and RRULE recurrence engine (no
   external dependency), going through the server's generic /api/proxy
   to avoid CORS issues and to convert webcal:// links (iPhone/iCloud)
   into https://. */
(function () {
  "use strict";

  const PALETTE = ["#4C8DFF", "#FF7A33", "#4CAF50", "#E5384B", "#9C6ADE", "#F4C430", "#00BCD4", "#EC4899"];
  const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  /* ---------- Parseur ICS / ICS parser ---------- */

  // Deplie les lignes selon RFC5545 : une ligne de continuation commence
  // par un espace ou une tabulation et doit etre recollee a la precedente.
  // Unfolds lines per RFC5545: a continuation line starts with a space
  // or tab and must be joined back onto the previous one.
  function unfoldLines(text) {
    const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const lines = [];
    for (const line of raw) {
      if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else if (line.trim() !== "") {
        lines.push(line);
      }
    }
    return lines;
  }

  function parseLine(line) {
    const colon = line.indexOf(":");
    if (colon === -1) return null;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const parts = left.split(";");
    const name = parts[0].toUpperCase();
    const params = {};
    for (let i = 1; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      if (eq === -1) continue;
      params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
    }
    return { name, params, value };
  }

  function unescapeText(s) {
    return (s || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  }

  // Heures "flottantes" ou qualifiees TZID : traitees comme l'heure locale
  // du navigateur (simplification raisonnable, la tres grande majorite des
  // agendas personnels sont deja dans le fuseau de l'utilisateur). Les
  // heures UTC ("Z") sont, elles, converties correctement.
  // "Floating" or TZID-qualified times: treated as the browser's local
  // time (a reasonable simplification, the vast majority of personal
  // calendars are already in the user's own timezone). UTC times ("Z")
  // are converted correctly, though.
  function parseIcsDate(value, params) {
    if (!value) return null;
    const isDateOnly = (params && params.VALUE === "DATE") || /^\d{8}$/.test(value);
    if (isDateOnly) {
      const y = +value.slice(0, 4), mo = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
      return { date: new Date(y, mo, d), allDay: true };
    }
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, se, z] = m;
    const date = z
      ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se))
      : new Date(+y, +mo - 1, +d, +h, +mi, +se);
    return { date, allDay: false };
  }

  function parseRRule(value) {
    const rule = {};
    for (const p of value.split(";")) {
      const eq = p.indexOf("=");
      if (eq === -1) continue;
      rule[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    return {
      freq: rule.FREQ,
      interval: rule.INTERVAL ? +rule.INTERVAL : 1,
      count: rule.COUNT ? +rule.COUNT : null,
      until: rule.UNTIL ? (parseIcsDate(rule.UNTIL, {}) || {}).date || null : null,
      byday: rule.BYDAY ? rule.BYDAY.split(",") : null,
      bymonthday: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(",").map(Number) : null
    };
  }

  function parseIcs(text, source) {
    const lines = unfoldLines(text);
    const events = [];
    let cur = null;
    for (const raw of lines) {
      const line = parseLine(raw);
      if (!line) continue;
      if (line.name === "BEGIN" && line.value === "VEVENT") { cur = { source }; continue; }
      if (line.name === "END" && line.value === "VEVENT") { if (cur) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      switch (line.name) {
        case "SUMMARY": cur.summary = unescapeText(line.value); break;
        case "LOCATION": cur.location = unescapeText(line.value); break;
        case "UID": cur.uid = line.value; break;
        case "STATUS": cur.status = line.value.toUpperCase(); break;
        case "DTSTART": cur.dtstart = parseIcsDate(line.value, line.params); break;
        case "DTEND": cur.dtend = parseIcsDate(line.value, line.params); break;
        case "RRULE": cur.rrule = parseRRule(line.value); break;
        case "RECURRENCE-ID": cur.recurrenceId = parseIcsDate(line.value, line.params); break;
        case "EXDATE": {
          const d = parseIcsDate(line.value, line.params);
          if (d) (cur.exdates = cur.exdates || []).push(d.date.getTime());
          break;
        }
      }
    }
    // Un evenement sans DTSTART exploitable est ignore (flux mal formes).
    // An event without a usable DTSTART is skipped (malformed feeds).
    return events.filter((e) => e.dtstart);
  }

  /* ---------- Moteur de recurrence RRULE / RRULE recurrence engine ----------
     Couvre DAILY / WEEKLY (avec BYDAY) / MONTHLY (BYMONTHDAY ou BYDAY du
     type "2MO") / YEARLY, avec INTERVAL, COUNT et UNTIL -- ce qui couvre
     la grande majorite des agendas personnels et professionnels reels.
     Covers DAILY / WEEKLY (with BYDAY) / MONTHLY (BYMONTHDAY or "2MO"
     style BYDAY) / YEARLY, with INTERVAL, COUNT and UNTIL -- covering the
     large majority of real personal and professional calendars. */

  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function addMonths(d, n) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
  function startOfWeekMonday(d) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const offset = (r.getDay() + 6) % 7; // 0 = lundi / Monday
    return addDays(r, -offset);
  }
  function withTimeOf(dateOnly, ref) {
    return new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(),
      ref.getHours(), ref.getMinutes(), ref.getSeconds());
  }
  // n-ieme occurrence d'un jour de semaine dans un mois (ex. "2MO" = 2e
  // lundi). n negatif = a partir de la fin (derniere occurrence si -1).
  // nth occurrence of a weekday within a month (e.g. "2MO" = 2nd Monday).
  // Negative n = counted from the end (-1 = last occurrence).
  function nthWeekdayOfMonth(year, month, bydayToken, ref) {
    const m = bydayToken.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
    if (!m) return null;
    const n = m[1] ? +m[1] : 1;
    const dow = DOW[m[2]];
    if (n > 0) {
      let d = new Date(year, month, 1);
      let count = 0;
      while (d.getMonth() === month) {
        if (d.getDay() === dow) { count++; if (count === n) return withTimeOf(d, ref); }
        d = addDays(d, 1);
      }
      return null;
    }
    let d = new Date(year, month + 1, 0); // dernier jour du mois / last day of month
    let count = 0;
    while (d.getMonth() === month) {
      if (d.getDay() === dow) { count--; if (count === n) return withTimeOf(d, ref); }
      d = addDays(d, -1);
    }
    return null;
  }

  function* iterateDates(dtstart, rule) {
    const freq = rule.freq;
    if (freq === "DAILY") {
      let cur = new Date(dtstart);
      while (true) { yield new Date(cur); cur = addDays(cur, rule.interval); }
    } else if (freq === "WEEKLY") {
      const days = (rule.byday && rule.byday.length ? rule.byday.map((b) => DOW[b]) : [dtstart.getDay()])
        .filter((n) => n !== undefined).sort((a, b) => a - b);
      const weekStart = startOfWeekMonday(dtstart);
      let weekOffset = 0;
      while (true) {
        const thisWeekStart = addDays(weekStart, weekOffset * 7 * rule.interval);
        for (const dow of days) {
          const offsetFromMonday = (dow + 6) % 7;
          const d = withTimeOf(addDays(thisWeekStart, offsetFromMonday), dtstart);
          if (d >= dtstart) yield d;
        }
        weekOffset++;
      }
    } else if (freq === "MONTHLY") {
      let monthOffset = 0;
      while (true) {
        const base = addMonths(dtstart, monthOffset * rule.interval);
        if (rule.byday && rule.byday.length) {
          for (const bd of rule.byday) {
            const d = nthWeekdayOfMonth(base.getFullYear(), base.getMonth(), bd, dtstart);
            if (d) yield d;
          }
        } else {
          const day = rule.bymonthday ? rule.bymonthday[0] : dtstart.getDate();
          const d = new Date(base.getFullYear(), base.getMonth(), day,
            dtstart.getHours(), dtstart.getMinutes(), dtstart.getSeconds());
          if (d.getMonth() === base.getMonth()) yield d; // saute les mois sans ce jour / skips months without that day
        }
        monthOffset++;
      }
    } else if (freq === "YEARLY") {
      let yearOffset = 0;
      while (true) {
        const d = new Date(dtstart);
        d.setFullYear(dtstart.getFullYear() + yearOffset * rule.interval);
        yield d;
        yearOffset++;
      }
    } else {
      yield new Date(dtstart); // frequence non geree (ex. SECONDLY) : occurrence unique
    }
  }

  // Etend un evenement (recurrent ou non) en occurrences concretes dans
  // la fenetre [rangeStart, rangeEnd). Garde-fou a 3000 iterations pour
  // ne jamais bloquer sur une regle mal formee.
  // Expands an event (recurring or not) into concrete occurrences within
  // the [rangeStart, rangeEnd) window. 3000-iteration safety cap so a
  // malformed rule can never hang the widget.
  function expandOccurrences(ev, rangeStart, rangeEnd) {
    // Sans DTEND, un evenement "toute la journee" dure par defaut 1 jour
    // (comportement standard RFC5545) ; un evenement normal dure 0
    // (instantane, cas rare mais valide).
    // Without DTEND, an "all-day" event defaults to a 1-day duration
    // (standard RFC5545 behavior); a timed event defaults to 0 (instant,
    // a rare but valid case).
    const duration = ev.dtend
      ? (ev.dtend.date.getTime() - ev.dtstart.date.getTime())
      : (ev.dtstart.allDay ? 86400000 : 0);
    const out = [];
    if (!ev.rrule) {
      const start = ev.dtstart.date;
      const end = duration ? new Date(start.getTime() + duration) : start;
      if (start < rangeEnd && end >= rangeStart) {
        out.push({ start, end, allDay: ev.dtstart.allDay, summary: ev.summary, location: ev.location, uid: ev.uid, source: ev.source });
      }
      return out;
    }
    const rule = ev.rrule;
    const exSet = new Set(ev.exdates || []);
    let count = 0, iterations = 0;
    for (const start of iterateDates(ev.dtstart.date, rule)) {
      if (++iterations > 3000) break;
      if (rule.until && start > rule.until) break;
      count++;
      if (rule.count && count > rule.count) break;
      if (start > rangeEnd) break; // occurrences croissantes : inutile de continuer / increasing: no need to continue
      if (!exSet.has(start.getTime())) {
        const end = duration ? new Date(start.getTime() + duration) : start;
        if (end >= rangeStart) {
          out.push({ start, end, allDay: ev.dtstart.allDay, summary: ev.summary, location: ev.location, uid: ev.uid, source: ev.source });
        }
      }
    }
    return out;
  }

  // Applique les occurrences "override" (RECURRENCE-ID : instance unique
  // deplacee/modifiee/annulee) par-dessus la serie recurrente de base.
  // Applies "override" occurrences (RECURRENCE-ID: a single moved/
  // modified/cancelled instance) on top of the base recurring series.
  function buildOccurrences(events, rangeStart, rangeEnd) {
    const masters = events.filter((e) => !e.recurrenceId);
    const overridesByUid = {};
    events.filter((e) => e.recurrenceId).forEach((e) => {
      (overridesByUid[e.uid] = overridesByUid[e.uid] || []).push(e);
    });
    const out = [];
    for (const m of masters) {
      const occs = expandOccurrences(m, rangeStart, rangeEnd);
      const overrides = overridesByUid[m.uid] || [];
      for (const occ of occs) {
        const ov = overrides.find((o) => o.recurrenceId && o.recurrenceId.date.getTime() === occ.start.getTime());
        if (ov) {
          if (ov.status === "CANCELLED") continue;
          const ovDuration = ov.dtend
            ? (ov.dtend.date.getTime() - ov.dtstart.date.getTime())
            : (ov.dtstart.allDay ? 86400000 : 0);
          out.push({
            start: ov.dtstart.date, end: new Date(ov.dtstart.date.getTime() + ovDuration),
            allDay: ov.dtstart.allDay, summary: ov.summary || occ.summary, location: ov.location,
            uid: ov.uid, source: ov.source
          });
        } else {
          out.push(occ);
        }
      }
    }
    // Overrides deplaces dans la fenetre mais dont l'occurrence d'origine
    // (RECURRENCE-ID) tombe hors fenetre : sans ce passage ils seraient
    // invisibles. Overrides moved into the window whose original
    // occurrence (RECURRENCE-ID) falls outside it: without this pass
    // they'd be invisible.
    for (const uid in overridesByUid) {
      for (const ov of overridesByUid[uid]) {
        if (ov.status === "CANCELLED" || !ov.dtstart) continue;
        const alreadyIncluded = out.some((o) => o.uid === ov.uid && o.start.getTime() === ov.dtstart.date.getTime());
        if (alreadyIncluded) continue;
        const start = ov.dtstart.date;
        const ovDuration = ov.dtend
          ? (ov.dtend.date.getTime() - ov.dtstart.date.getTime())
          : (ov.dtstart.allDay ? 86400000 : 0);
        const end = new Date(start.getTime() + ovDuration);
        if (start < rangeEnd && end >= rangeStart) {
          out.push({ start, end, allDay: ov.dtstart.allDay, summary: ov.summary, location: ov.location, uid: ov.uid, source: ov.source });
        }
      }
    }
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /* ---------- Widget ---------- */

  class CalendarWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.dayTimer = null;
      this.view = null; // ecrase par les reglages a l'init / overwritten by settings at init
      this.occurrences = [];
      this.errors = [];
    }

    async init() {
      this.view = this.ctx.settings.defaultView || "list";
      this.ctx.el.innerHTML = `<div class="pw-calendar"><div class="pwc-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
      // Reajuste les libelles "Aujourd'hui/Demain" et la fenetre de la
      // semaine a chaque changement de jour, sans attendre le prochain
      // rafraichissement reseau. Refreshes "Today/Tomorrow" labels and
      // the week window on every day change, without waiting for the
      // next network refresh.
      this.dayTimer = setInterval(() => this.render(), 60000);
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(15, Number(this.ctx.settings.refresh) || 60);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.view = settings.defaultView || "list";
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    parseCalendarLines() {
      const raw = String(this.ctx.settings.calendars || "");
      return raw.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l, i) => {
          const sep = l.indexOf("|");
          const url = (sep === -1 ? l : l.slice(0, sep)).trim();
          const label = sep === -1 ? null : l.slice(sep + 1).trim();
          return { url, label: label || null, color: PALETTE[i % PALETTE.length] };
        });
    }

    async refresh() {
      const el = this.ctx.el;
      const calendars = this.parseCalendarLines();
      if (!calendars.length) {
        el.innerHTML = `<div class="pw-calendar"><div class="pwc-err">${this.ctx.i18n.t("calendar.noCalendars")}</div></div>`;
        return;
      }
      this.errors = [];
      const results = await Promise.all(calendars.map((cal) => this.fetchCalendar(cal)));
      const allEvents = [].concat(...results);
      if (!allEvents.length && this.errors.length === calendars.length) {
        el.innerHTML = `<div class="pw-calendar"><div class="pwc-err">${this.ctx.i18n.t("calendar.error")}</div></div>`;
        return;
      }
      this.rawEvents = allEvents;
      this.calendars = calendars;
      this.render();
    }

    async fetchCalendar(cal) {
      try {
        // webcal:// (lien de partage iPhone/iCloud) -> https:// : le
        // schema webcal:// n'existe que pour dire "ouvre ton app
        // calendrier", le contenu est identique en https://.
        // webcal:// (iPhone/iCloud share link) -> https://: the
        // webcal:// scheme only means "open your calendar app", the
        // content is identical over https://.
        const httpsUrl = cal.url.replace(/^webcal:\/\//i, "https://");
        const proxied = this.ctx.api.proxyUrl(httpsUrl);
        const sep = proxied.includes("?") ? "&" : "?";
        const text = await fetch(proxied + sep + "_=" + Date.now(), { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error("proxy " + r.status);
          return r.text();
        });
        return parseIcs(text, cal);
      } catch (e) {
        console.warn("[piboard/calendar]", cal.url, e);
        this.errors.push(cal);
        return [];
      }
    }

    switchView(view) {
      this.view = view;
      this.render();
    }

    render() {
      if (!this.rawEvents) return;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const now = new Date();

      const tabs = `
        <div class="pwc-tabs">
          <button type="button" class="pwc-tab ${this.view === "list" ? "pwc-tab-active" : ""}" data-view="list">${i18n.t("calendar.viewList")}</button>
          <button type="button" class="pwc-tab ${this.view === "week" ? "pwc-tab-active" : ""}" data-view="week">${i18n.t("calendar.viewWeek")}</button>
        </div>`;

      const body = this.view === "week" ? this.renderWeek(now) : this.renderList(now);
      const legend = this.calendars.length > 1 ? this.renderLegend() : "";

      this.ctx.el.innerHTML = `<div class="pw-calendar">${tabs}<div class="pwc-body">${body}</div>${legend}</div>`;

      this.ctx.el.querySelectorAll(".pwc-tab").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
          this.switchView(btn.dataset.view);
        });
      });
    }

    renderLegend() {
      const dots = this.calendars.map((c, i) =>
        `<span class="pwc-legend-item"><i style="background:${c.color}"></i>${c.label || (this.ctx.i18n.t("calendar.calendarLabel") + " " + (i + 1))}</span>`
      ).join("");
      return `<div class="pwc-legend">${dots}</div>`;
    }

    renderList(now) {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const days = Math.max(1, Number(s.daysAhead) || 7);
      const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const rangeEnd = addDays(rangeStart, days);
      let occs = buildOccurrences(this.rawEvents, rangeStart, rangeEnd)
        .filter((o) => o.end > now) // masque les evenements deja termines aujourd'hui / hide events already over today
        .filter((o) => s.showAllDay !== false || !o.allDay);

      if (!occs.length) {
        return `<div class="pwc-empty">${i18n.t("calendar.noEvents")}</div>`;
      }

      const locale = i18n.t("clock.date.format");
      const groups = [];
      let curKey = null, curGroup = null;
      for (const o of occs) {
        const key = o.start.toDateString();
        if (key !== curKey) {
          curKey = key;
          curGroup = { date: o.start, items: [] };
          groups.push(curGroup);
        }
        curGroup.items.push(o);
      }

      const todayKey = now.toDateString();
      const tomorrowKey = addDays(now, 1).toDateString();

      return groups.map((g) => {
        const key = g.date.toDateString();
        const label = key === todayKey ? i18n.t("calendar.today")
          : key === tomorrowKey ? i18n.t("calendar.tomorrow")
          : g.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
        const items = g.items.map((o) => {
          const time = o.allDay ? i18n.t("calendar.allDay")
            : o.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
          const loc = o.location ? `<div class="pwc-loc">📍 ${o.location}</div>` : "";
          return `
            <div class="pwc-item">
              <i class="pwc-dot" style="background:${o.source.color}"></i>
              <div class="pwc-item-text">
                <div class="pwc-item-top"><span class="pwc-time">${time}</span><span class="pwc-summary">${o.summary || i18n.t("calendar.untitled")}</span></div>
                ${loc}
              </div>
            </div>`;
        }).join("");
        return `<div class="pwc-day-group"><div class="pwc-day-label">${label}</div>${items}</div>`;
      }).join("");
    }

    renderWeek(now) {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = s.weekStartsMonday === false
        ? addDays(todayStart, -todayStart.getDay())
        : startOfWeekMonday(todayStart);
      const weekEnd = addDays(weekStart, 7);
      const occs = buildOccurrences(this.rawEvents, weekStart, weekEnd)
        .filter((o) => s.showAllDay !== false || !o.allDay);

      const byDay = [...Array(7)].map(() => []);
      for (const o of occs) {
        const idx = Math.floor((new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate()) - weekStart) / 86400000);
        if (idx >= 0 && idx < 7) byDay[idx].push(o);
      }

      const cols = byDay.map((items, i) => {
        const day = addDays(weekStart, i);
        const isToday = day.toDateString() === todayStart.toDateString();
        const dayName = day.toLocaleDateString(locale, { weekday: "short" });
        const chips = items.map((o) => {
          const time = o.allDay ? "" : `<span class="pwc-wk-time">${o.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>`;
          return `<div class="pwc-wk-chip" style="--chip:${o.source.color}">${time}<span class="pwc-wk-summary">${o.summary || i18n.t("calendar.untitled")}</span></div>`;
        }).join("");
        return `
          <div class="pwc-wk-col ${isToday ? "pwc-wk-today" : ""}">
            <div class="pwc-wk-head"><span class="pwc-wk-dayname">${dayName}</span><span class="pwc-wk-daynum">${day.getDate()}</span></div>
            <div class="pwc-wk-items">${chips}</div>
          </div>`;
      }).join("");

      return `<div class="pwc-week">${cols}</div>`;
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.dayTimer);
    }
  }

  window.PiBoard.registerWidget("calendar", CalendarWidget);
})();
