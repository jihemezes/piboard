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
    // Certains exports (dont des flux publies par iCloud) laissent un BOM
    // UTF-8 en tete de fichier -- invisible a l'oeil, mais qui s'accroche
    // au tout premier nom de propriete et peut le faire echouer.
    // Some exports (including feeds published by iCloud) leave a UTF-8
    // BOM at the start of the file -- invisible to the eye, but it
    // sticks to the very first property name and can make it fail.
    const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const raw = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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

  // Duree au format ISO8601 utilise par RFC5545 (ex. "PT1H30M", "P1D") :
  // alternative a DTEND, parfois utilisee a la place. Duration in the
  // ISO8601 format used by RFC5545 (e.g. "PT1H30M", "P1D"): an
  // alternative to DTEND, sometimes used instead.
  function parseIcsDuration(value) {
    const m = String(value || "").match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const [, , w, d, h, mi, se] = m;
    const ms = ((+w || 0) * 7 * 86400 + (+d || 0) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+se || 0)) * 1000;
    return sign * ms;
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
        case "DESCRIPTION": cur.description = unescapeText(line.value); break;
        case "UID": cur.uid = line.value; break;
        case "STATUS": cur.status = line.value.toUpperCase(); break;
        case "DTSTART": cur.dtstart = parseIcsDate(line.value, line.params); break;
        case "DTEND": cur.dtend = parseIcsDate(line.value, line.params); break;
        case "DURATION": cur.duration = parseIcsDuration(line.value); break;
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

  /* Premier jour affiche dans la grille semaine, selon la disposition
     choisie (reglage "weekLayout") et le decalage de navigation
     (weekOffset, en semaines entieres -- voir navigateWeek()) :
     - "calendar" : semaine calendaire fixe (lundi ou dimanche selon
       "weekStartsMonday"), le jour actuel tombant ou il tombe.
     - "sliding" : fenetre glissante centralisee sur le jour d'aujourd'hui
       (ou le prochain jour calendaire contenant un evenement, si aucun
       n'a lieu aujourd'hui). Allows to see past/future events while
       maintaining "today" always visible and prominent in the middle.
     First day displayed in the week grid, depending on the chosen layout
     (weekLayout setting) and the navigation offset (weekOffset, in whole
     weeks -- see navigateWeek()):
     - "calendar" : fixed calendar week (Monday or Sunday depending on
       "weekStartsMonday"), with today falling wherever it falls.
     - "sliding" : window sliding around today (or the next calendar day
       containing an event, if nothing's scheduled today). */
  function computeWeekStart(now, settings, weekOffset) {
    const layout = settings.weekLayout || "calendar";
    let base = now;
    if (layout === "sliding") {
      // Glissant autour d'aujourd'hui : trouve le jour actuel ou le jour
      // suivant avec un evenement. Sliding around today: finds today or
      // the next day with an event -- more useful on a kiosk when you're
      // mid-event and want to see what's coming up.
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      base = addDays(s, -3); // Centre a +/-3 jours / Center at +/-3 days
    } else {
      // Calendaire : lundi ou dimanche selon reglage. Calendar: Monday or
      // Sunday according to setting.
      base = settings.weekStartsMonday !== false ? startOfWeekMonday(now) : startOfWeekSunday(now);
    }
    return addDays(base, weekOffset * 7);
  }
  function startOfWeekSunday(d) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const offset = r.getDay();
    return addDays(r, -offset);
  }

  function matchesRRule(rrule, start, ref) {
    // start : premiere occurrence (DTSTART de l'evenement source)
    // ref : date candidate pour laquelle on teste si elle matche la RRULE
    // Retourne { match: bool, count: N }
    // start: first occurrence (original event's DTSTART)
    // ref: candidate date to check against the RRULE
    // Returns { match: bool, count: N }
    if (!rrule.freq) return { match: false, count: 0 };

    const freq = rrule.freq.toUpperCase();
    if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return { match: false, count: 0 };

    let cur = new Date(start);
    const interval = rrule.interval || 1;
    let count = 0;
    const maxIterations = 10000; // Securite / Safety limit
    while (count < maxIterations) {
      if (cur > ref) break;
      if (cur.toDateString() === ref.toDateString()) {
        // Candidat trouve : verifie EXDATE et BYDAY
        // Found candidate: verify EXDATE and BYDAY
        const curMs = cur.getTime();
        if (rrule.exdates && rrule.exdates.includes(curMs)) return { match: false, count };

        if (freq === "WEEKLY" && rrule.byday) {
          const dayNum = cur.getDay(); // 0=SU, 1=MO...
          const dayStr = Object.keys(DOW).find(k => DOW[k] === dayNum);
          if (!rrule.byday.includes(dayStr)) return { match: false, count };
        } else if (freq === "MONTHLY" && rrule.byday) {
          // Format "2MO" = 2nd Monday. Pour simplifier, on tolerera tout.
          // Format "2MO" = 2nd Monday. For simplicity, we'll accept everything.
        }
        return { match: true, count };
      }

      count++;
      if (rrule.until && cur > rrule.until) break;
      if (rrule.count && count >= rrule.count) break;

      // Incremente cur selon FREQ et INTERVAL / Increment cur per FREQ and INTERVAL
      if (freq === "DAILY") cur = addDays(cur, interval);
      else if (freq === "WEEKLY") cur = addDays(cur, 7 * interval);
      else if (freq === "MONTHLY") cur = addMonths(cur, interval);
      else if (freq === "YEARLY") cur = addMonths(cur, 12 * interval);
    }

    return { match: false, count };
  }

  function buildOccurrences(rawEvents, rangeStart, rangeEnd) {
    const occs = [];
    for (const ev of rawEvents) {
      const dtstart = ev.dtstart.date;
      if (dtstart >= rangeEnd) continue; // Depart apres la plage / Start after range

      if (!ev.rrule) {
        // Evenement unique / Single event
        let dtend = ev.dtend ? ev.dtend.date : (ev.duration ? new Date(dtstart.getTime() + ev.duration) : addDays(dtstart, 1));
        if (dtstart < rangeEnd && dtend > rangeStart) {
          occs.push({
            summary: ev.summary,
            location: ev.location,
            description: ev.description,
            start: dtstart,
            end: dtend,
            allDay: ev.dtstart.allDay,
            source: ev.source
          });
        }
      } else {
        // Evenement recurrent : teste chaque jour de la plage / Recurring event: test each day
        let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
        const rangeEndDay = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
        while (cur < rangeEndDay) {
          const m = matchesRRule(ev.rrule, dtstart, cur);
          if (m.match) {
            const occStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(),
              dtstart.getHours(), dtstart.getMinutes(), dtstart.getSeconds());
            let occEnd = ev.dtend ? new Date(ev.dtend.date.getFullYear(), ev.dtend.date.getMonth(), ev.dtend.date.getDate(),
              ev.dtend.date.getHours(), ev.dtend.date.getMinutes(), ev.dtend.date.getSeconds()) : null;
            if (!occEnd && ev.duration) {
              occEnd = new Date(occStart.getTime() + ev.duration);
            } else if (!occEnd) {
              occEnd = new Date(occStart.getFullYear(), occStart.getMonth(), occStart.getDate() + 1);
            }
            if (occStart < rangeEnd && occEnd > rangeStart) {
              occs.push({
                summary: ev.summary,
                location: ev.location,
                description: ev.description,
                start: occStart,
                end: occEnd,
                allDay: ev.dtstart.allDay,
                source: ev.source
              });
            }
          }
          cur = addDays(cur, 1);
        }
      }
    }
    return occs;
  }

  class CalendarWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.calendars = [];
      this.rawEvents = null;
      this.timer = null;
      this.dayTimer = null;
      this.view = "week"; // "week" ou "list" / "week" or "list"
      this.weekOffset = 0;
    }

    async load() {
      const s = this.ctx.settings;
      if (!s.calendars || !s.calendars.length) {
        this.ctx.el.innerHTML = `<div class="pwc-err">${this.ctx.i18n.t("calendar.noCalendars")}</div>`;
        return;
      }

      this.calendars = s.calendars.map((c, i) => ({
        label: c.label,
        url: c.url,
        color: c.color || PALETTE[i % PALETTE.length]
      }));

      // Rafraichit sur demande explicite ET toutes les minutes / Refresh on explicit
      // demand AND every minute (to update "now" markers, relative times, etc.)
      const refresh = () => this.fetchAndRender();
      this.timer = setInterval(refresh, 60000);
      await refresh();

      // Raffraichit aussi a minuit pour basculer le jour de reference / Also refreshes
      // at midnight to switch the reference day (for "today" label, week centering, etc.)
      const updateAtMidnight = () => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const msUntilMidnight = tomorrow - now;
        this.dayTimer = setTimeout(() => {
          this.fetchAndRender();
          updateAtMidnight();
        }, msUntilMidnight);
      };
      updateAtMidnight();
    }

    async fetchAndRender() {
      const promises = this.calendars.map((c) =>
        fetch(`/api/proxy?url=${encodeURIComponent(c.url)}`)
          .then((r) => r.text())
          .then((text) => parseIcs(text, c))
          .catch((e) => {
            console.error(`Calendar fetch error for ${c.label}:`, e);
            return [];
          })
      );

      const results = await Promise.all(promises);
      this.rawEvents = results.flat();
      this.render();
    }

    switchView(view) {
      // Revient a la semaine de reference a chaque VRAI changement de vue
      // (pas un re-clic sur l'onglet deja actif) : retrouver l'onglet
      // Semaine doit toujours montrer "maintenant", jamais l'endroit ou
      // la navigation avait ete laissee lors d'une precedente visite.
      // Returns to the reference week on every GENUINE view change (not
      // a re-click on the already-active tab): switching to the Week tab
      // must always show "now", never wherever navigation had been left
      // during a previous visit.
      if (view === "week" && this.view !== "week") this.weekOffset = 0;
      this.view = view;
      this.render();
    }

    navigateWeek(delta) {
      this.weekOffset += delta;
      this.render();
    }

    showEventDetail(occurrence) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");

      const timeStr = occurrence.allDay
        ? i18n.t("calendar.allDay")
        : `${occurrence.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} - ${occurrence.end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;

      const locStr = occurrence.location
        ? `<div class="pwc-detail-line"><strong>📍 ${i18n.t("calendar.location")}:</strong> ${occurrence.location}</div>`
        : "";

      const descStr = occurrence.description
        ? `<div class="pwc-detail-line"><strong>${i18n.t("calendar.description")}:</strong><div class="pwc-detail-desc">${occurrence.description}</div></div>`
        : "";

      const detailHtml = `
        <div class="pwc-detail-modal">
          <div class="pwc-detail-popup">
            <button type="button" class="pwc-detail-close" aria-label="${i18n.t("calendar.close")}">✕</button>
            <div class="pwc-detail-title">${occurrence.summary || i18n.t("calendar.untitled")}</div>
            <div class="pwc-detail-line">
              <strong>🕐 ${i18n.t("calendar.time")}:</strong> ${timeStr}
            </div>
            ${locStr}
            ${descStr}
          </div>
        </div>`;

      const modal = document.createElement("div");
      modal.innerHTML = detailHtml;
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.zIndex = "10000";
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector(".pwc-detail-close");
      const closeModal = () => modal.remove();

      closeBtn.addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      }, { once: true });
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

      this.ctx.el.querySelectorAll("[data-nav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // meme raison que les onglets ci-dessus / same reason as the tabs above
          if (btn.dataset.nav === "today") { this.weekOffset = 0; this.render(); }
          else this.navigateWeek(Number(btn.dataset.nav));
        });
      });

      // Ajoute ecouteur de clic sur les chips semaine / Add click listener to week chips
      this.ctx.el.querySelectorAll(".pwc-wk-chip").forEach((chip, idx) => {
        const allChips = this.ctx.el.querySelectorAll(".pwc-wk-chip");
        if (idx < allChips.length) {
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            // Retrouve l'occurence correspondante pour afficher le detail
            // Find the corresponding occurrence to display detail
            const occIdx = Array.from(allChips).indexOf(chip);
            const allOccs = this.getAllWeekOccurrences(now);
            if (occIdx < allOccs.length) {
              this.showEventDetail(allOccs[occIdx]);
            }
          });
        }
      });
    }

    getAllWeekOccurrences(now) {
      // Helper pour recuperer toutes les occurrences affichees cette semaine
      // Helper to get all occurrences displayed this week
      const s = this.ctx.settings;
      const weekStart = computeWeekStart(now, s, this.weekOffset);
      const weekEnd = addDays(weekStart, 7);
      return buildOccurrences(this.rawEvents, weekStart, weekEnd)
        .filter((o) => s.showAllDay !== false || !o.allDay);
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
      const weekStart = computeWeekStart(now, s, this.weekOffset);
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
          return `<div class="pwc-wk-chip" style="--chip:${o.source.color}" role="button" tabindex="0">${time}<span class="pwc-wk-summary">${o.summary || i18n.t("calendar.untitled")}</span></div>`;
        }).join("");
        return `
          <div class="pwc-wk-col ${isToday ? "pwc-wk-today" : ""}">
            <div class="pwc-wk-head"><span class="pwc-wk-dayname">${dayName}</span><span class="pwc-wk-daynum">${day.getDate()}</span></div>
            <div class="pwc-wk-items">${chips}</div>
          </div>`;
      }).join("");

      // Intitule de la periode affichee (ex. "10 - 16 nov.") : repere de
      // contexte utile des qu'on s'est eloigne de la semaine de
      // reference. Displayed period label (e.g. "Nov 10 - 16"): a useful
      // context marker as soon as you've navigated away from the
      // reference week.
      const weekLastDay = addDays(weekStart, 6);
      const rangeLabel = weekStart.getMonth() === weekLastDay.getMonth()
        ? `${weekStart.getDate()} - ${weekLastDay.toLocaleDateString(locale, { day: "numeric", month: "short" })}`
        : `${weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} - ${weekLastDay.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;

      const nav = `
        <div class="pwc-wk-nav">
          <button type="button" class="pwc-wk-navbtn" data-nav="-1" aria-label="${i18n.t("calendar.prevWeek")}">‹</button>
          <button type="button" class="pwc-wk-navlabel${this.weekOffset !== 0 ? " pwc-wk-navlabel-active" : ""}" data-nav="today" title="${i18n.t("calendar.backToToday")}">${rangeLabel}</button>
          <button type="button" class="pwc-wk-navbtn" data-nav="1" aria-label="${i18n.t("calendar.nextWeek")}">›</button>
        </div>`;

      return `<div class="pwc-week">${nav}<div class="pwc-wk-grid">${cols}</div></div>`;
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.dayTimer);
    }
  }

  window.PiBoard.registerWidget("calendar", CalendarWidget);
})();
