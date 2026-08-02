/* PiBoard widget: clock / horloge */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  // Options Intl selon le format de date choisi. "full" reproduit le
  // comportement historique (seul format avant cette option).
  // Intl options for the chosen date format. "full" reproduces the
  // historical behavior (the only format before this setting existed).
  function dateFormatOptions(key) {
    switch (key) {
      case "long": return { day: "numeric", month: "long", year: "numeric" };
      case "medium": return { weekday: "short", day: "numeric", month: "short" };
      case "short": return { day: "2-digit", month: "2-digit", year: "numeric" };
      default: return { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    }
  }

  /* Heure "actuelle" dans un fuseau horaire arbitraire, sous forme d'un
     objet Date dont les methodes locales (getHours(), getDay()...)
     refletent directement l'heure murale de ce fuseau -- pratique de
     triche courante : on ne s'en sert jamais pour un calcul de duree
     entre deux instants, seulement pour LIRE des composantes a
     afficher, ce que ce widget fait deja partout ailleurs.
     Fuseau vide ou invalide : repli silencieux sur l'heure du systeme.
     "Current" time in an arbitrary time zone, as a Date object whose
     local methods (getHours(), getDay()...) directly reflect that
     zone's wall-clock time -- a common trick: never used for duration
     math between two instants, only to READ components for display,
     which is all this widget ever does elsewhere.
     Empty or invalid zone: silently falls back to the system's time. */
  function nowInZone(tz) {
    if (!tz) return new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type).value;
      return new Date(
        Number(get("year")), Number(get("month")) - 1, Number(get("day")),
        Number(get("hour")) % 24, Number(get("minute")), Number(get("second"))
      );
    } catch (e) {
      return new Date(); // nom de fuseau invalide / invalid zone name
    }
  }

  /* Semaine ISO 8601 : la semaine 1 est celle qui contient le premier
     jeudi de l'annee (algorithme standard, verifie contre des dates de
     reference connues). ISO 8601 week: week 1 is the one containing the
     year's first Thursday (standard algorithm, checked against known
     reference dates). */
  function isoWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // dimanche=0 -> 7 / Sunday=0 -> 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /* Convention "simple" : la semaine 1 est celle qui contient le 1er
     janvier (semaines demarrant le lundi, comme le reste de
     l'application -- voir weekStartsMonday dans le widget Agenda).
     "Simple" convention: week 1 is the one containing January 1st
     (weeks starting on Monday, like the rest of the app -- see
     weekStartsMonday in the Calendar widget). */
  function simpleWeekNumber(date) {
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const jan1Day = (jan1.getDay() + 6) % 7; // lundi=0 / Monday=0
    const startOfWeek1 = new Date(year, 0, 1 - jan1Day);
    const diffDays = Math.floor((date - startOfWeek1) / 86400000);
    return Math.floor(diffDays / 7) + 1;
  }

  function weekNumberOf(date, convention) {
    return convention === "jan1" ? simpleWeekNumber(date) : isoWeekNumber(date);
  }

  /* Analyseur ICS volontairement SIMPLIFIE pour la ligne "prochain
     evenement" : lit uniquement SUMMARY/DTSTART/DTEND de chaque
     VEVENT, sans interpreter RRULE (recurrence). Un evenement recurrent
     n'apparaitra donc pas ici, contrairement au widget Agenda complet
     (~250 lignes de moteur RRULE dedie) qui, lui, les gere. Choix
     assume : dupliquer ce moteur dans la tuile Horloge, deja chargee de
     plusieurs fonctionnalites avec cette session, aurait ajoute un
     risque et une charge d'entretien disproportionnes pour une simple
     ligne d'apercu. Documente aussi dans le texte d'aide du reglage.
     Deliberately SIMPLIFIED ICS parser for the "next event" line: reads
     only SUMMARY/DTSTART/DTEND from each VEVENT, without interpreting
     RRULE (recurrence). A recurring event therefore won't show up here,
     unlike the full Calendar widget (~250 lines of dedicated RRULE
     engine) which does handle them. A deliberate trade-off: duplicating
     that engine into the Clock tile, already carrying several features
     added this session, would have added disproportionate risk and
     upkeep for a simple preview line. Also documented in the setting's
     help text. */
  function parseSimpleIcs(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n")
      .reduce((acc, line) => {
        if (/^[ \t]/.test(line) && acc.length) acc[acc.length - 1] += line.slice(1);
        else acc.push(line);
        return acc;
      }, []);
    const events = [];
    let cur = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (line === "BEGIN:VEVENT") { cur = {}; continue; }
      if (line === "END:VEVENT") { if (cur && cur.start) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const left = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const name = left.split(";")[0].toUpperCase();
      if (name === "SUMMARY") {
        cur.summary = value.replace(/\\,/g, ",").replace(/\\n/gi, " ").trim();
      } else if (name === "DTSTART" || name === "DTEND") {
        const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
        if (!m) continue;
        const allDay = !m[4];
        const date = allDay
          ? new Date(+m[1], +m[2] - 1, +m[3])
          : (m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        if (name === "DTSTART") { cur.start = date; cur.allDay = allDay; } else { cur.end = date; }
      }
    }
    return events;
  }

  class ClockWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.appliedBgKey = null; // evite de reecrire le style si rien n'a change
      this.saints = null; // calendrier des saints, charge une fois (mis en cache sur window.PiBoard)
      this.nextEvent = null; // prochain evenement d'agenda (voir loadNextEvent())
      this.activeAlarmIndex = null; // index (1-5) de l'alarme en cours de sonnerie, ou null
      this.triggeredThisMinute = new Set(); // cles "index:jour heure:minute" deja declenchees, evite un re-declenchement a chaque tick de 500ms au sein de la meme minute
    }

    init() {
      this.render();
      this.tick();
      this.loadSaints();
      this.loadNextEvent();
      this.timer = setInterval(() => this.tick(), 500);
      // Rechargement reseau du prochain evenement toutes les 10 min : la
      // recomputation a chaque tick (voir recomputeNextEvent) suffit pour
      // qu'un evenement deja passe disparaisse au bon moment, mais ne
      // peut pas decouvrir un evenement nouvellement ajoute au
      // calendrier -- il faut pour ca revenir interroger le serveur de
      // temps en temps. Network reload of the next event every 10 min:
      // the per-tick recomputation (see recomputeNextEvent) is enough for
      // an already-passed event to disappear at the right time, but can't
      // discover an event newly added to the calendar -- that requires
      // periodically querying the server again.
      this.nextEventTimer = setInterval(() => this.loadNextEvent(), 10 * 60000);
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);
    }

    /* Charge le calendrier des prenoms (fete du jour), partage entre les
       widgets horloge et meteo via un cache sur window.PiBoard pour eviter
       une double requete si les deux sont presents sur le tableau.
       Loads the nameday calendar (saint of the day), shared between the
       clock and weather widgets via a cache on window.PiBoard to avoid a
       duplicate request when both are present on the board. */
    async loadSaints() {
      try {
        if (!window.PiBoard._saintsPromise) {
          window.PiBoard._saintsPromise = fetch("/data/saints-fr.json").then((r) => r.json());
        }
        this.saints = await window.PiBoard._saintsPromise;
        this.tick(); // le saint peut arriver apres le premier rendu / may arrive after first render
      } catch (e) {
        this.saints = {};
      }
    }

    /* Prochain evenement d'agenda, via une URL ICS independante de toute
       tuile Agenda (voir le raisonnement dans la description du reglage
       "Adresse du calendrier"). Parseur volontairement simplifie, voir
       parseSimpleIcs() en tete de fichier.
       Next calendar event, via an ICS URL independent from any Calendar
       tile (see the reasoning in the "Calendar address" setting's
       description). Deliberately simplified parser, see parseSimpleIcs()
       at the top of the file. */
    async loadNextEvent() {
      const s = this.ctx.settings;
      if (s.showNextEvent === false || !s.nextEventIcsUrl) {
        this.allEvents = null;
        this.nextEvent = null;
        this.renderNextEvent();
        return;
      }
      try {
        const text = await fetch(this.ctx.api.proxyUrl(s.nextEventIcsUrl)).then((r) => r.text());
        this.allEvents = parseSimpleIcs(text);
      } catch (e) {
        console.warn("[piboard/clock] next event", e);
        this.allEvents = null;
      }
      this.recomputeNextEvent();
    }

    /* Recalcul LEGER (sans reseau) du prochain evenement a partir du
       cache this.allEvents -- appele a chaque tick pour qu'un evenement
       deja passe disparaisse au bon moment, sans re-interroger le
       serveur toutes les 500ms. Le vrai rechargement reseau (voir
       loadNextEvent) ne se fait que ponctuellement, voir arm() dans
       init().
       LIGHT recomputation (no network) of the next event from the
       this.allEvents cache -- called on every tick so an already-passed
       event disappears at the right time, without re-querying the
       server every 500ms. The real network reload (see loadNextEvent)
       only happens periodically, see arm() in init(). */
    recomputeNextEvent() {
      const s = this.ctx.settings;
      if (!this.allEvents) { this.nextEvent = null; this.renderNextEvent(); return; }
      const now = new Date();
      const maxDate = new Date(now.getTime() + Math.max(1, Number(s.nextEventDaysAhead) || 14) * 86400000);
      const upcoming = this.allEvents
        .filter((e) => e.start > now && e.start <= maxDate)
        .sort((a, b) => a.start - b.start);
      const next = upcoming[0] || null;
      if (next !== this.nextEvent) {
        this.nextEvent = next;
        this.renderNextEvent();
      }
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      const eventChanged = settings.nextEventIcsUrl !== old.nextEventIcsUrl || settings.showNextEvent !== old.showNextEvent;
      this.ctx.settings = settings;
      this.appliedBgKey = null;
      this.render();
      this.tick();
      if (eventChanged) this.loadNextEvent();
    }

    onLangChanged() { this.tick(); this.renderNextEvent(); }

    render() {
      const s = this.ctx.settings;
      // Le numero de semaine concerne MA date, pas les autres fuseaux :
      // il rejoint donc le bloc horloge lui-meme (juste apres la date),
      // plutot que le bloc des fuseaux supplementaires ou il vivait
      // jusqu'ici -- a la fois plus coherent et plus econome en largeur,
      // puisqu'il n'a plus besoin de sa propre colonne.
      // The week number is about MY date, not other zones: it therefore
      // joins the clock block itself (right after the date), rather than
      // the extra-zones block where it used to live -- both more
      // coherent and more width-efficient, since it no longer needs its
      // own column.
      const weekHtml = `<div class="pwc-week" ${s.showWeekNumber ? "" : "hidden"}></div>`;
      let clockHtml;
      if (s.mode === "analog") {
        // Cote a cote (cadran a gauche, texte a droite) uniquement si la
        // date est affichee : sans elle, rien ne justifie de reserver de
        // la place a droite, le cadran occupe alors tout le cadre comme
        // avant. Corrige le probleme du cadran ecrase verticalement par
        // le texte en dessous (empilement), en lui laissant toute la
        // hauteur disponible.
        // Side by side (face on the left, text on the right) only when
        // the date is shown: without it, nothing justifies reserving
        // room on the right, the face then fills the whole frame as
        // before. Fixes the face being vertically squeezed by the text
        // below it (stacking), by giving it the full available height.
        const analogRow = s.showDate;
        clockHtml = `
          <div class="pw-clock ${analogRow ? "pwc-analog-row" : ""}">
            <svg viewBox="0 0 100 100">
              <circle class="pwa-face" cx="50" cy="50" r="46"/>
              ${[...Array(12)].map((_, i) => {
                const a = (i * 30) * Math.PI / 180;
                const r1 = i % 3 === 0 ? 38 : 41;
                return `<line class="pwa-tick" x1="${50 + r1 * Math.sin(a)}" y1="${50 - r1 * Math.cos(a)}" x2="${50 + 44 * Math.sin(a)}" y2="${50 - 44 * Math.cos(a)}"/>`;
              }).join("")}
              <line class="pwa-hand pwa-h" x1="50" y1="50" x2="50" y2="26" stroke-width="4"/>
              <line class="pwa-hand pwa-m" x1="50" y1="50" x2="50" y2="16" stroke-width="2.6"/>
              <line class="pwa-hand pwa-sec pwa-s" x1="50" y1="54" x2="50" y2="13" ${s.showSeconds ? "" : "visibility='hidden'"}/>
              <circle class="pwa-pin" cx="50" cy="50" r="2.6"/>
            </svg>
            <div class="pwc-analog-text" ${s.showDate ? "" : "hidden"}>
              <div class="pwc-date"></div>
              ${weekHtml}
            </div>
          </div>`;
      } else {
        // Cote a cote : seulement pertinent si la date est affichee.
        // Side by side: only meaningful when the date is shown.
        const row = s.layout === "row" && s.showDate;
        clockHtml = `
          <div class="pw-clock ${row ? "pwc-row" : ""}">
            <div class="pwc-time"></div>
            <div class="pwc-date-block" ${s.showDate ? "" : "hidden"}>
              <div class="pwc-date"></div>
              ${weekHtml}
            </div>
          </div>`;
      }
      // Enveloppe commune aux deux modes : l'horloge (existante,
      // inchangee ci-dessus -- fit() continue de cibler ".pw-clock"
      // exactement comme avant) et, en dessous, les extras ajoutes cette
      // session. En flex-colonne, ".pw-clock" se redimensionne
      // naturellement pour laisser la place aux extras -- fit() lit deja
      // sa hauteur dynamiquement, aucun changement necessaire la-bas.
      // Common wrapper for both modes: the clock (existing, unchanged
      // above -- fit() keeps targeting ".pw-clock" exactly as before)
      // and, below it, the extras added this session. In a flex column,
      // ".pw-clock" naturally resizes to make room for the extras --
      // fit() already reads its height dynamically, nothing to change
      // there.
      // Cote a cote (horloge a gauche, extras a droite) des qu'il y a
      // quelque chose a montrer a droite -- meme principe que la
      // disposition analogique deja en place : sans ca, l'heure
      // numerique reste toujours centree meme quand des extras
      // (fuseaux, semaine, prochain evenement) s'empilent en dessous,
      // ce qui la comprime verticalement et nuit a la lisibilite (signale
      // par capture d'ecran). Fonde sur les REGLAGES (pas sur la donnee
      // effectivement chargee, ex. showNextEvent=true meme sans
      // evenement trouve pour l'instant) pour eviter que la disposition
      // change au fil du chargement des donnees.
      // Side by side (clock on the left, extras on the right) as soon as
      // there's something to show on the right -- same principle as the
      // analog layout already in place: without this, the digital time
      // always stays centered even when extras (zones, week, next
      // event) stack up below it, squeezing it vertically and hurting
      // legibility (reported via screenshot). Based on the SETTINGS (not
      // on data actually loaded, e.g. showNextEvent=true even with no
      // event found yet) to avoid the layout shifting as data loads.
      const hasExtras = [1, 2, 3].some((i) => s["extraZone" + i + "Label"] && s["extraZone" + i + "Tz"])
        || s.showWeekNumber === true || s.showNextEvent === true;
      const wrapSide = s.mode === "digital" && hasExtras;
      this.ctx.el.innerHTML = `<div class="pw-clock-wrap ${wrapSide ? "pwc-wrap-side" : ""}">${clockHtml}${this.extrasHtml()}</div>`;

      const stopBtn = this.ctx.el.querySelector(".pwc-alarm-stop");
      if (stopBtn) stopBtn.addEventListener("click", () => this.stopAlarmNow());

      this.appliedBgKey = null; // le DOM du fond vient d'etre recree
      this.applyBg();
      this.renderNextEvent();
      this.renderAlarmBanner();
      this.fit();
    }

    /* Gabarit des "extras" ajoutes cette session : fuseaux
       supplementaires, numero de semaine, prochain evenement, banniere
       d'alarme. Volontairement HORS de ".pw-clock" (voir render()) pour
       ne pas perturber le calcul de taille de police, deja delicat, de
       l'heure/la date. Markup for this session's "extras": extra time
       zones, week number, next event, alarm banner. Deliberately OUTSIDE
       ".pw-clock" (see render()) so as not to disturb the already
       delicate font-size computation of the time/date. */
    extrasHtml() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const zones = [1, 2, 3]
        .map((i) => ({ label: s["extraZone" + i + "Label"], tz: s["extraZone" + i + "Tz"] }))
        .filter((z) => z.label && z.tz);
      const zonesHtml = zones.length
        ? `<div class="pwc-zones">${zones.map((z) => `
            <div class="pwc-zone">
              <span class="pwc-zone-label">${escapeHtml(z.label)}</span>
              <span class="pwc-zone-time" data-tz="${escapeAttr(z.tz)}"></span>
            </div>`).join("")}</div>`
        : "";
      return `
        <div class="pwc-extras-col">
          ${zonesHtml}
          <div class="pwc-next-event" hidden></div>
          <div class="pwc-alarm-banner" hidden>
            <span class="pwc-alarm-label"></span>
            <button type="button" class="pwc-alarm-stop">${i18n.t("clock.alarm.stop")}</button>
          </div>
        </div>`;
    }

    /* Luminance perceptuelle approximative (0 = noir, 1 = blanc)
       Approximate perceptual luminance (0 = black, 1 = white) */
    relLuminance(hex) {
      const c = (hex || "").replace("#", "");
      if (c.length !== 6) return 0.5;
      const r = parseInt(c.substr(0, 2), 16) / 255;
      const g = parseInt(c.substr(2, 2), 16) / 255;
      const b = parseInt(c.substr(4, 2), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /* Fond jour/nuit : suit le theme resolu du tableau (calcul solaire,
       ou choix manuel jour/nuit) plutot que de recalculer sa propre heure
       de lever/coucher. Le texte bascule clair/sombre automatiquement
       selon la luminosite de la couleur choisie.
       Day/night background: follows the board's resolved theme (solar
       calculation, or a manual day/night choice) rather than recomputing
       its own sunrise/sunset. Text switches light/dark automatically
       based on the chosen color's luminance. */
    applyBg() {
      const box = this.ctx.el.querySelector(".pw-clock-wrap");
      if (!box) return;
      const s = this.ctx.settings;

      if (!s.dayNightBg) {
        if (this.appliedBgKey !== "off") {
          box.style.backgroundColor = "";
          box.style.color = "";
          box.style.removeProperty("--text");
          box.style.removeProperty("--muted");
          this.appliedBgKey = "off";
        }
        return;
      }

      const isDay = document.body.dataset.theme === "light";
      const color = (isDay ? s.dayColor : s.nightColor) || (isDay ? "#DCE9F7" : "#0B1220");
      const key = isDay + ":" + color;
      if (this.appliedBgKey === key) return;
      this.appliedBgKey = key;

      box.style.backgroundColor = color;
      const dark = this.relLuminance(color) < 0.5;
      const textColor = dark ? "#F3F5FA" : "#1B1F2A";
      const mutedColor = dark ? "#C3C9DB" : "#5B6272";
      box.style.color = textColor;
      // Les aiguilles/graduations de l'horloge analogique referencent
      // var(--text) et var(--muted) explicitement (pas de simple heritage
      // de "color") : il faut donc aussi surcharger ces variables.
      // The analog clock's hands/ticks explicitly reference var(--text)
      // and var(--muted) (not plain "color" inheritance): the variables
      // themselves must also be overridden.
      box.style.setProperty("--text", textColor);
      box.style.setProperty("--muted", mutedColor);
    }

    renderNextEvent() {
      const el = this.ctx.el.querySelector(".pwc-next-event");
      if (!el) return;
      if (!this.nextEvent) { el.hidden = true; return; }
      const locale = this.ctx.i18n.t("clock.date.format");
      const d = this.nextEvent.start;
      const when = this.nextEvent.allDay
        ? d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })
        : d.toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      el.hidden = false;
      el.innerHTML = `📅 <span class="pwc-next-event-title">${escapeHtml(this.nextEvent.summary || "")}</span> <span class="pwc-next-event-when">${escapeHtml(when)}</span>`;
    }

    /* Verifie chaque alarme activee a chaque tick (500ms) : declenche au
       plus une fois par minute grace a triggeredThisMinute, sans quoi
       une meme alarme repartirait a chaque tick tant que l'heure
       correspond. Checks every enabled alarm on each tick (500ms):
       fires at most once per minute thanks to triggeredThisMinute,
       otherwise the same alarm would refire on every tick as long as
       the time matches. */
    checkAlarms(now) {
      const s = this.ctx.settings;
      const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      const dow = now.getDay(); // 0=dimanche / 0=Sunday
      const minuteKey = now.toDateString() + " " + hhmm;
      for (let i = 1; i <= 5; i++) {
        if (s["alarm" + i + "Enabled"] !== true) continue;
        if ((s["alarm" + i + "Time"] || "07:00") !== hhmm) continue;
        const days = s["alarm" + i + "Days"] || "daily";
        const dayOk = days === "daily"
          || (days === "weekdays" && dow >= 1 && dow <= 5)
          || (days === "weekend" && (dow === 0 || dow === 6));
        if (!dayOk) continue;
        const triggerKey = i + ":" + minuteKey;
        if (this.triggeredThisMinute.has(triggerKey)) continue;
        this.triggeredThisMinute.add(triggerKey);
        this.triggerAlarm(i);
      }
      // Purge occasionnelle : evite une croissance sans fin sur une tuile
      // restee ouverte des jours durant. Occasional purge: avoids
      // unbounded growth on a tile left open for days.
      if (this.triggeredThisMinute.size > 500) this.triggeredThisMinute.clear();
    }

    /* Declenche une alarme : reutilise le systeme d'alerte du tableau
       (flash plein ecran + son genere), deja construit et eprouve pour
       le widget Compte a rebours -- meme mecanisme, meme plafond de
       duree (5 min), meme bouton "Arreter" affiche tant que l'alerte est
       active. Pas de bouton "Repousser" : choix assume, une alarme
       s'arrete ou se laisse suivre son cours.
       Triggers an alarm: reuses the board's alert system (full-screen
       flash + generated sound), already built and proven for the
       Countdown widget -- same mechanism, same duration cap (5 min),
       same "Stop" button shown while the alert is active. No "Snooze"
       button: a deliberate choice, an alarm either gets stopped or runs
       its course. */
    triggerAlarm(index) {
      const s = this.ctx.settings;
      this.activeAlarmIndex = index;
      this.renderAlarmBanner();
      this.ctx.api.startAlert({
        flash: true,
        soundName: s["alarm" + index + "Sound"] || "beep-simple",
        durationMs: 300000, // plafond du systeme d'alerte / alert system's own cap
        onEnd: () => {
          if (this.activeAlarmIndex === index) { this.activeAlarmIndex = null; this.renderAlarmBanner(); }
        }
      });
    }

    stopAlarmNow() {
      this.ctx.api.stopAlert();
      this.activeAlarmIndex = null;
      this.renderAlarmBanner();
    }

    renderAlarmBanner() {
      const el = this.ctx.el.querySelector(".pwc-alarm-banner");
      if (!el) return;
      const ringing = this.activeAlarmIndex != null;
      // Le reste des extras s'efface tant qu'une alarme sonne : elle
      // doit capter l'attention, pas se noyer au milieu des fuseaux/du
      // prochain evenement. Le numero de semaine, lui, ne fait plus
      // partie des extras (voir render()) : il reste toujours visible.
      // Restaure automatiquement a l'arret (chacun reprend sa propre
      // condition d'affichage au prochain tick).
      // The rest of the extras step aside while an alarm rings: it
      // should grab attention, not get lost among the time zones/next
      // event. The week number, though, is no longer part of the extras
      // (see render()): it always stays visible. Automatically restored
      // once stopped (each picks its own display condition back up on
      // the next tick).
      const zonesEl = this.ctx.el.querySelector(".pwc-zones");
      const eventEl = this.ctx.el.querySelector(".pwc-next-event");
      if (zonesEl) zonesEl.hidden = ringing;
      if (eventEl && !ringing) this.renderNextEvent(); // reevalue sa propre visibilite / re-evaluates its own visibility
      else if (eventEl) eventEl.hidden = true;

      el.hidden = !ringing;
      if (!ringing) return;
      const s = this.ctx.settings;
      const label = s["alarm" + this.activeAlarmIndex + "Label"] || this.ctx.i18n.t("clock.alarm.default");
      el.querySelector(".pwc-alarm-label").textContent = "⏰ " + label;
    }

    fit() {
      const el = this.ctx.el;
      const box = el.querySelector(".pw-clock");
      if (!box) return;
      const dateEl = box.querySelector(".pwc-date");

      if (this.ctx.settings.mode === "analog") {
        // Cadran carre dont la taille exacte est calculee ici plutot que
        // laissee a l'aspect-ratio implicite du SVG en CSS : garantit un
        // carre net dans les deux dispositions, plutot qu'un rendu
        // deforme si les limites CSS (largeur ET hauteur) entrent en
        // conflit. Cote a cote : la plus petite des deux limites parmi
        // la hauteur totale et une fraction de la largeur (pour laisser
        // de la place au texte a droite). Empile (pas de date) : le
        // cadran occupe tout le cadre comme avant.
        // Square face whose exact size is computed here rather than left
        // to the SVG's implicit CSS aspect-ratio: guarantees a clean
        // square in both layouts, rather than a distorted render if the
        // CSS constraints (width AND height) conflict. Side by side: the
        // smaller of the total height and a fraction of the width (to
        // leave room for the text on the right). Stacked (no date): the
        // face fills the whole frame as before.
        const svg = box.querySelector("svg");
        const row = box.classList.contains("pwc-analog-row");
        const side = row ? Math.max(20, Math.min(box.clientHeight, box.clientWidth * 0.62)) : 0;
        if (svg) {
          if (row) {
            svg.style.width = side + "px";
            svg.style.height = side + "px";
          } else {
            svg.style.width = "";
            svg.style.height = "";
          }
        }
        // Le cadran SVG s'adapte deja tout seul (viewBox) ; la date, elle,
        // a besoin d'une taille de police calculee. En disposition cote a
        // cote, un pourcentage fixe de la hauteur laissait la colonne de
        // texte trop petite par rapport a l'espace reellement disponible
        // a droite du cadran (large sur une tuile large) -- recherche
        // dichotomique a la place, comme pour l'heure en mode digital :
        // agrandit le texte jusqu'a la limite de largeur OU de hauteur
        // disponible, ce qui remplit vraiment la colonne.
        // The SVG face already scales itself (viewBox); the date, though,
        // needs a computed font size. In the side-by-side layout, a fixed
        // percentage of the height left the text column too small
        // compared to the space actually available to the right of the
        // face (generous on a wide tile) -- binary search instead, like
        // for the time in digital mode: grows the text up to the
        // available width OR height limit, which actually fills the
        // column.
        if (dateEl) {
          if (row) {
            const gap = box.clientWidth * 0.06; // doit correspondre au "gap" du CSS .pwc-analog-row / must match the CSS .pwc-analog-row "gap"
            const availW = Math.max(30, box.clientWidth - side - gap);
            const availH = Math.max(20, box.clientHeight);
            let lo = 10, hi = Math.max(14, Math.floor(availH * 0.45));
            for (let i = 0; i < 7; i++) {
              const mid = Math.floor((lo + hi + 1) / 2);
              dateEl.style.fontSize = mid + "px";
              const fits = dateEl.scrollWidth <= availW && dateEl.scrollHeight <= availH;
              if (fits) lo = mid; else hi = mid - 1;
            }
            dateEl.style.fontSize = lo + "px";
          } else {
            dateEl.style.fontSize = Math.max(11, Math.floor(box.clientHeight * 0.09)) + "px";
          }
        }
        return;
      }

      const time = box.querySelector(".pwc-time");
      if (!time) return;
      const w = box.clientWidth || 120;
      const h = box.clientHeight || 80;
      const row = box.classList.contains("pwc-row");

      // Recherche dichotomique tenant compte a la fois de la largeur
      // disponible (l'heure ne doit jamais deborder sur les tuiles larges
      // et basses ou carrees) et de la hauteur (tuiles hautes et etroites).
      // En disposition cote a cote, c'est la largeur CUMULEE heure + date
      // qui doit tenir (mesuree via scrollWidth du conteneur en ligne).
      // Binary search accounting for both available width (the time must
      // never overflow on wide/short or square tiles) and height (tall/
      // narrow tiles). In side-by-side layout, the COMBINED time + date
      // width must fit (measured via the row container's scrollWidth).
      // Plafond de depart volontairement genereux : c'est la verification
      // de debordement (fitsWidth/fitsHeight) qui protege reellement
      // contre un texte trop grand, ce plafond n'est qu'une borne
      // maximale pour la recherche. Un plafond trop bas (l'ancien,
      // 0.65 x hauteur) empechait de decouvrir une taille plus grande
      // pourtant disponible -- signale par capture d'ecran (chiffres
      // trop petits malgre l'espace libre autour).
      // Deliberately generous starting ceiling: the overflow check
      // (fitsWidth/fitsHeight) is what actually protects against text
      // too large, this ceiling is only an upper search bound. A ceiling
      // too low (the old one, 0.65 x height) prevented discovering a
      // bigger size that was actually available -- reported via
      // screenshot (digits too small despite free space around them).
      let lo = 12, hi = Math.max(16, Math.floor(Math.min(w * 0.95, h * 0.9)));
      for (let i = 0; i < 7; i++) {
        const mid = Math.floor((lo + hi + 1) / 2);
        time.style.fontSize = mid + "px";
        if (dateEl) dateEl.style.fontSize = Math.max(10, Math.round(mid * (row ? 0.4 : 0.32))) + "px";
        const fitsWidth = row
          ? box.scrollWidth <= w + 1
          : time.scrollWidth <= w * 0.94;
        const fitsHeight = box.scrollHeight <= h + 1;
        if (fitsWidth && fitsHeight) lo = mid;
        else hi = mid - 1;
      }
      time.style.fontSize = lo + "px";
      if (dateEl) dateEl.style.fontSize = Math.max(10, Math.round(lo * (row ? 0.4 : 0.32))) + "px";
    }

    tick() {
      const s = this.ctx.settings;
      // "now" sert a TOUT l'affichage (heure, date, semaine) et suit le
      // fuseau choisi ; "realNow", l'heure reelle du systeme, sert
      // UNIQUEMENT aux alarmes -- une alarme doit sonner a l'heure
      // physique du Pi, pas selon un fuseau affiche a titre de reference
      // (ex. une petite horloge "Tokyo" en plus ne doit pas faire sonner
      // le reveil a l'heure de Tokyo).
      // "now" drives ALL of the display (time, date, week) and follows
      // the chosen zone; "realNow", the system's actual time, is used
      // ONLY for alarms -- an alarm must ring at the Pi's physical time,
      // not according to a zone shown for reference (e.g. a small extra
      // "Tokyo" clock shouldn't make the alarm ring on Tokyo time).
      const now = nowInZone(s.timezone);
      const realNow = new Date();
      const el = this.ctx.el;
      const locale = this.ctx.i18n.t("clock.date.format");

      this.applyBg();
      this.checkAlarms(realNow);
      this.recomputeNextEvent();

      const weekEl = el.querySelector(".pwc-week");
      if (weekEl && s.showWeekNumber) {
        weekEl.textContent = this.ctx.i18n.t("clock.week.short") + weekNumberOf(now, s.weekNumberConvention);
      }

      el.querySelectorAll(".pwc-zone-time").forEach((zoneEl) => {
        const tz = zoneEl.dataset.tz;
        const zoneNow = nowInZone(tz);
        zoneEl.textContent = String(zoneNow.getHours()).padStart(2, "0") + ":" + String(zoneNow.getMinutes()).padStart(2, "0");
      });

      const dateEl = el.querySelector(".pwc-date");
      if (dateEl && s.showDate) {
        const dateStr = now.toLocaleDateString(locale, dateFormatOptions(s.dateFormat));

        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const saint = s.showSaint && this.ctx.i18n.lang === "fr" && this.saints
          ? this.saints[mm + "-" + dd] : null;

        if (!saint) {
          dateEl.innerHTML = dateStr;
        } else {
          // "En dessous" (2e ligne) a besoin de hauteur : bascule
          // automatiquement sur "cote a cote" (une seule ligne, apres un
          // point median) si la tuile est trop basse pour une 2e ligne,
          // ou si la disposition heure/date est deja "cote a cote" (une
          // seule ligne par principe) -- le saint du jour ne doit jamais
          // faire deborder la tuile, quel que soit le reglage choisi.
          // "Below" (2nd line) needs vertical room: automatically falls
          // back to "side by side" (single line, after a middot) when the
          // tile is too short for a 2nd line, or when the time/date
          // arrangement is already "side by side" (single line by
          // design) -- the name day must never overflow the tile,
          // whatever setting is chosen.
          const box = el.querySelector(".pw-clock");
          const rowLayout = s.mode !== "analog" && s.layout === "row";
          const boxH = box ? box.clientHeight : 0;
          const fitsBelow = boxH === 0 || boxH >= 90; // 0 = pas encore mesure (1er rendu) / not yet measured (first render)
          const wantsBelow = s.saintLayout !== "inline" && !rowLayout && fitsBelow;

          dateEl.innerHTML = wantsBelow
            ? `${dateStr}<br><span class="pwc-saint">${saint}</span>`
            : `${dateStr} <span class="pwc-saint pwc-saint-inline">· ${saint}</span>`;
        }
      }

      if (s.mode === "analog") {
        const hh = (now.getHours() % 12) + now.getMinutes() / 60;
        const mm = now.getMinutes() + now.getSeconds() / 60;
        const ss = now.getSeconds();
        const rot = (q, deg) => {
          const hand = el.querySelector(q);
          if (hand) hand.setAttribute("transform", `rotate(${deg} 50 50)`);
        };
        rot(".pwa-h", hh * 30);
        rot(".pwa-m", mm * 6);
        rot(".pwa-s", ss * 6);
      } else {
        const timeEl = el.querySelector(".pwc-time");
        if (timeEl) {
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          const ss = String(now.getSeconds()).padStart(2, "0");
          timeEl.innerHTML = s.showSeconds
            ? `${hh}:${mm}<small>:${ss}</small>`
            : `${hh}:${mm}`;
        }
      }
      // Appele dans tous les cas, apres la mise a jour du texte ci-dessus :
      // render() appelle deja fit() une fois, mais a ce moment-la
      // ".pwc-date" est encore vide (son contenu n'est ecrit qu'ici, dans
      // tick()) -- la taille de police calculee sur du vide "tenait"
      // trivialement, puis debordait des que le vrai texte (date, saint
      // du jour) etait insere sans nouveau calcul. Egalement necessaire
      // quand le saint arrive apres coup (loadSaints() est asynchrone) ou
      // que la longueur du texte change (langue, jour de semaine...).
      // Called in both cases, after the text update above: render()
      // already calls fit() once, but at that point ".pwc-date" is still
      // empty (its content is only written here, in tick()) -- the font
      // size computed against emptiness trivially "fit", then overflowed
      // as soon as the real text (date, name day) was inserted with no
      // new calculation. Also needed when the name day arrives later
      // (loadSaints() is asynchronous) or when the text's length changes
      // (language, weekday...).
      this.fit();
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.nextEventTimer);
      if (this.observer) this.observer.disconnect();
      if (this.activeAlarmIndex != null) this.ctx.api.stopAlert();
    }
  }

  window.PiBoard.registerWidget("clock", ClockWidget);
})();
