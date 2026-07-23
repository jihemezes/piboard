/* PiBoard widget: clock / horloge */
(function () {
  "use strict";

  class ClockWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.appliedBgKey = null; // evite de reecrire le style si rien n'a change
    }

    init() {
      this.render();
      this.tick();
      this.timer = setInterval(() => this.tick(), 500);
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.appliedBgKey = null;
      this.render();
      this.tick();
    }

    onLangChanged() { this.tick(); }

    render() {
      const s = this.ctx.settings;
      if (s.mode === "analog") {
        this.ctx.el.innerHTML = `
          <div class="pw-clock">
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
            <div class="pwc-date" ${s.showDate ? "" : "hidden"}></div>
          </div>`;
      } else {
        // Cote a cote : seulement pertinent si la date est affichee.
        // Side by side: only meaningful when the date is shown.
        const row = s.layout === "row" && s.showDate;
        this.ctx.el.innerHTML = `
          <div class="pw-clock ${row ? "pwc-row" : ""}">
            <div class="pwc-time"></div>
            <div class="pwc-date" ${s.showDate ? "" : "hidden"}></div>
          </div>`;
      }
      this.appliedBgKey = null; // le DOM du fond vient d'etre recree
      this.applyBg();
      this.fit();
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
      const box = this.ctx.el.querySelector(".pw-clock");
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

    fit() {
      const el = this.ctx.el;
      const box = el.querySelector(".pw-clock");
      if (!box) return;
      const dateEl = box.querySelector(".pwc-date");

      if (this.ctx.settings.mode === "analog") {
        // Le cadran SVG s'adapte deja tout seul (viewBox) ; seule la date
        // a besoin d'une taille de police calculee.
        // The SVG face already scales itself (viewBox); only the date
        // needs a computed font size.
        if (dateEl) dateEl.style.fontSize = Math.max(11, Math.floor(box.clientHeight * 0.09)) + "px";
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
      let lo = 12, hi = Math.max(16, Math.floor(Math.min(w * 0.85, h * 0.65)));
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
      const now = new Date();
      const el = this.ctx.el;
      const locale = this.ctx.i18n.t("clock.date.format");

      this.applyBg();

      const dateEl = el.querySelector(".pwc-date");
      if (dateEl && s.showDate) {
        dateEl.textContent = now.toLocaleDateString(locale, {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        });
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
        this.fit();
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("clock", ClockWidget);
})();
