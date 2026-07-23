/* PiBoard widget: teleprog / programme TV
   Programme TV francais simplifie. Interroge /api/tele-program (voir
   server/teleProgram.js) qui fournit, pour une liste de chaines et une
   vue donnee (en cours / 1re partie de soiree / 2e partie), le
   programme correspondant sur chaque chaine. Trois onglets sur la tuile
   permettent de basculer de vue sans passer par la configuration. Un
   clic sur une emission ouvre son synopsis. Une pastille "inedit"
   apparait quand la source fournit l'information (jamais sinon). Une
   vignette est affichee quand la source en fournit une, sinon un
   placeholder.
   Simplified French TV guide. Queries /api/tele-program (see
   server/teleProgram.js) which returns, for a list of channels and a
   given view (now / prime time / late night), the matching program on
   each channel. Three tabs on the tile switch views without going
   through settings. Tapping a program opens its synopsis. A "new" badge
   appears when the source provides the info (never otherwise). A
   thumbnail is shown when the source provides one, otherwise a
   placeholder. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const VIEWS = ["now", "evening", "late"];

  /* Calcule, en millisecondes, le delai avant le prochain
     rafraichissement de la vue "En ce moment" : juste apres la fin
     annoncee du programme qui se termine le plus tot parmi les lignes
     affichees (+ marge), borne par [minDelayMs, ceilingMs]. Fonction
     pure (aucun acces DOM/reseau/horloge globale), separee de
     armNow() pour rester testable independamment des timers reels --
     meme principe que _computePhase sur le widget trafic.
     Computes, in milliseconds, the delay before the next "On now"
     refresh: right after the announced end of the soonest-ending
     program among the displayed rows (+ margin), clamped to
     [minDelayMs, ceilingMs]. Pure function (no DOM/network/global
     clock access), kept separate from armNow() to stay testable
     independently of real timers -- same idea as the traffic widget's
     _computePhase. */
  function computeNowRefreshDelay(rows, nowMs, opts) {
    const o = opts || {};
    const marginMs = o.marginMs != null ? o.marginMs : 20000;
    const minDelayMs = o.minDelayMs != null ? o.minDelayMs : 60000;
    const ceilingMs = o.ceilingMs != null ? o.ceilingMs : 5 * 60000;

    const stops = (rows || [])
      .map((r) => (r.program && r.program.stop) ? new Date(r.program.stop).getTime() : null)
      .filter((t) => t != null && t > nowMs);

    let delay = ceilingMs;
    if (stops.length) delay = Math.min(...stops) - nowMs + marginMs;
    return Math.min(Math.max(delay, minDelayMs), ceilingMs);
  }

  class TeleProgWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;     // minuteur des vues "ce soir" / "2e partie" (intervalle fixe)
      this.nowTimer = null;  // minuteur dedie a la vue "maintenant" (reprogramme au changement de programme)
      this.loading = false;
      this.data = null;          // derniere reponse /api/tele-program
      this.error = null;
      this.selected = null;      // index de chaine dont le synopsis est ouvert / channel index whose synopsis is open
      // Vue courante au demarrage : "ce soir" par defaut -- stable
      // pendant des heures, pas besoin d'un rafraichissement frequent
      // -- sauf si la config demande explicitement une autre vue.
      // Ensuite pilotee par les onglets de la tuile (independamment de
      // la config).
      // Initial view: "tonight" by default -- stable for hours, no
      // need for frequent refreshing -- unless config explicitly asks
      // for another default. Afterwards driven by the tile's own tabs
      // (independently of config).
      this.view = VIEWS.includes(ctx.settings.defaultView) ? ctx.settings.defaultView : "evening";
      // Expose pour les tests (fonction pure, aucune donnee sensible) / exposed for tests (pure function, no sensitive data)
      this._computeNowRefreshDelay = computeNowRefreshDelay;
    }

    async init() {
      this.renderShell();
      await this.refresh();
    }

    /* Programme le prochain rafraichissement selon la vue affichee.
       Appele a la fin de chaque refresh() (succes ou echec), pour
       toujours reprogrammer sur la base des donnees les plus recentes.
       Schedules the next refresh based on the displayed view. Called
       at the end of every refresh() (success or failure), to always
       reschedule from the freshest data. */
    arm() {
      clearInterval(this.timer);
      clearTimeout(this.nowTimer);
      if (this.view === "now") {
        this.armNow();
        return;
      }
      const minutes = Number(this.ctx.settings.refresh) || 30;
      this.timer = setInterval(() => this.refresh(), Math.max(5, minutes) * 60000);
    }

    /* La vue "En ce moment" ne sonde pas a intervalle fixe : elle se
       reprogramme pour se rafraichir juste apres l'heure de fin
       annoncee du programme qui se termine le plus tot parmi les
       chaines affichees (+ une petite marge), afin de changer
       d'emission a la bonne minute sans solliciter le serveur plus que
       necessaire (le cache serveur XMLTV tient de toute facon 30 min,
       donc ces requetes rapprochees restent tres legeres). Repli sur
       un plafond configurable si aucune heure de fin n'est disponible
       (certaines sources n'annoncent pas <stop>).
       The "On now" view doesn't poll at a fixed interval: it
       reschedules itself to refresh just after the announced end time
       of the soonest-ending program among the displayed channels (+ a
       small margin), so it switches programs at the right minute
       without hitting the server more than needed (the server-side
       XMLTV cache holds for 30 min anyway, so these closer-together
       requests stay very light). Falls back to a configurable ceiling
       if no end time is available (some sources don't provide <stop>). */
    armNow() {
      const rows = (this.data && this.data.channels) || [];
      const ceilingMin = Math.max(1, Number(this.ctx.settings.refreshNowCeiling) || 5);
      const delay = computeNowRefreshDelay(rows, Date.now(), { ceilingMs: ceilingMin * 60000 });
      this.nowTimer = setTimeout(() => this.refresh(), delay);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      if (VIEWS.includes(settings.defaultView) && !this._viewTouched) {
        this.view = settings.defaultView;
      }
      this.selected = null;
      this.refresh();
    }

    onLangChanged() { this.render(); }

    /* Construit la liste des chaines depuis le textarea de config (une
       par ligne). Chaque entree peut etre un nom lisible ou un
       identifiant XMLTV : le serveur resout les deux. */
    channelList() {
      return String(this.ctx.settings.channels || "")
        .split("\n").map((s) => s.trim()).filter(Boolean);
    }

    buildUrl() {
      const s = this.ctx.settings;
      const p = new URLSearchParams();
      p.set("source", s.source || "xmltvfr");
      p.set("view", this.view);
      p.set("guide", s.xmltvfrGuide === "france" ? "france" : "tnt");
      p.set("channels", this.channelList().join(","));
      if (s.source === "xmltv" && s.xmltvUrl) p.set("xmltvUrl", s.xmltvUrl);
      if (s.source === "scrape" && s.scrapeUrl) p.set("scrapeUrl", s.scrapeUrl);
      if (s.eveningStart) p.set("eveningStart", s.eveningStart);
      if (s.lateStart) p.set("lateStart", s.lateStart);
      if (s.eveningMinDuration != null && s.eveningMinDuration !== "") p.set("eveningMinDuration", s.eveningMinDuration);
      if (s.lateMinDuration != null && s.lateMinDuration !== "") p.set("lateMinDuration", s.lateMinDuration);
      if (s.showThumbnails === false) p.set("thumbnails", "0");
      return "/api/tele-program?" + p.toString();
    }

    async refresh() {
      this.loading = true;
      this.error = null;
      this.render();
      try {
        const res = await fetch(this.buildUrl());
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("status " + res.status));
        this.data = data;
        this.loading = false;
        this.render();
      } catch (e) {
        console.warn("[piboard/teleprog]", e);
        this.loading = false;
        this.error = String(e.message || e);
        this.render();
      }
      // Reprogramme toujours, succes ou echec (en cas d'echec, sans
      // donnees de fin de programme, armNow() se rabat sur le plafond).
      // Always reschedules, success or failure (on failure, with no
      // program end data, armNow() falls back to the ceiling).
      this.arm();
    }

    setView(view) {
      if (!VIEWS.includes(view) || view === this.view) return;
      this.view = view;
      this._viewTouched = true;
      this.selected = null;
      this.refresh();
    }

    formatTime(iso) {
      if (!iso) return "";
      try {
        const locale = this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-US";
        return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return ""; }
    }

    /* Ossature statique (onglets + conteneur de liste), posee une fois.
       Le contenu de la liste est (re)rendu par render(). */
    renderShell() {
      this.ctx.el.innerHTML = `<div class="pw-teleprog"><div class="pwtp-tabs"></div><div class="pwtp-body"></div></div>`;
    }

    render() {
      const root = this.ctx.el.querySelector(".pw-teleprog");
      if (!root) { this.renderShell(); }
      this.renderTabs();
      this.renderBody();
    }

    renderTabs() {
      const i18n = this.ctx.i18n;
      const tabs = this.ctx.el.querySelector(".pwtp-tabs");
      if (!tabs) return;
      const labels = { now: i18n.t("teleprog.now"), evening: i18n.t("teleprog.evening"), late: i18n.t("teleprog.late") };
      tabs.innerHTML = VIEWS.map((v) =>
        `<button type="button" class="pwtp-tab${v === this.view ? " pwtp-tab-active" : ""}" data-view="${v}">${escapeHtml(labels[v])}</button>`
      ).join("");
      tabs.querySelectorAll(".pwtp-tab").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
          this.setView(btn.dataset.view);
        });
      });
    }

    renderBody() {
      const i18n = this.ctx.i18n;
      const body = this.ctx.el.querySelector(".pwtp-body");
      if (!body) return;

      if (this.error) {
        body.innerHTML = `<div class="pwtp-msg pwtp-err">${i18n.t("teleprog.error")} ${escapeHtml(this.error)}</div>`;
        return;
      }
      const rows = (this.data && this.data.channels) || [];
      if (!rows.length && this.loading) {
        body.innerHTML = `<div class="pwtp-msg">${i18n.t("teleprog.loading")}</div>`;
        return;
      }
      if (!rows.length) {
        body.innerHTML = `<div class="pwtp-msg">${i18n.t("teleprog.empty")}</div>`;
        return;
      }

      const s = this.ctx.settings;
      const showThumbs = s.showThumbnails !== false;
      const showCat = s.showCategory !== false;

      body.innerHTML = `<div class="pwtp-list">${rows.map((row, i) => this.rowHtml(row, i, showThumbs, showCat)).join("")}</div>`;

      // Ouvre/ferme le synopsis au clic sur une ligne.
      body.querySelectorAll(".pwtp-row").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          this.selected = (this.selected === idx) ? null : idx;
          this.renderBody();
        });
      });
    }

    rowHtml(row, i, showThumbs, showCat) {
      const i18n = this.ctx.i18n;
      const p = row.program;
      const open = this.selected === i;
      const chName = escapeHtml(row.channelName || row.channelId);

      if (!p) {
        return `
          <div class="pwtp-row pwtp-row-empty" data-idx="${i}">
            <div class="pwtp-chan">${chName}</div>
            <div class="pwtp-noprog">${i18n.t("teleprog.noProgram")}</div>
          </div>`;
      }

      // Vignette : via le proxy image du serveur (evite CORS/mixed
      // content). Placeholder si absente (cf. Q3).
      let thumb = "";
      if (showThumbs) {
        if (p.icon) {
          thumb = `<img class="pwtp-thumb" loading="lazy" src="/api/image-proxy?url=${encodeURIComponent(p.icon)}" alt="">`;
        } else {
          thumb = `<div class="pwtp-thumb pwtp-thumb-ph" aria-hidden="true"></div>`;
        }
      }

      // Pastille inedit : uniquement si l'info existe (true). Rien pour
      // false (rediffusion) ni null (info absente), cf. Q2.
      const badge = p.isNew === true ? `<span class="pwtp-new">${i18n.t("teleprog.new")}</span>` : "";

      const cat = (showCat && p.category) ? `<span class="pwtp-cat">${escapeHtml(p.category)}</span>` : "";
      const time = this.formatTime(p.start);
      const sub = p.subtitle ? `<div class="pwtp-sub">${escapeHtml(p.subtitle)}</div>` : "";

      const synopsis = open ? `
        <div class="pwtp-synopsis">
          ${p.desc ? `<p>${escapeHtml(p.desc)}</p>` : `<p class="pwtp-nodesc">${i18n.t("teleprog.noSynopsis")}</p>`}
          ${p.stop ? `<div class="pwtp-times">${time}–${this.formatTime(p.stop)}</div>` : ""}
        </div>` : "";

      return `
        <div class="pwtp-row${open ? " pwtp-row-open" : ""}" data-idx="${i}">
          <div class="pwtp-main">
            ${thumb}
            <div class="pwtp-text">
              <div class="pwtp-line1"><span class="pwtp-chan">${chName}</span><span class="pwtp-time">${time}</span></div>
              <div class="pwtp-title">${escapeHtml(p.title)}${badge}</div>
              ${sub}
              <div class="pwtp-meta">${cat}</div>
            </div>
          </div>
          ${synopsis}
        </div>`;
    }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.nowTimer);
    }
  }

  window.PiBoard.registerWidget("teleprog", TeleProgWidget);
})();
