/* PiBoard widget: clock / horloge */
(function () {
  "use strict";

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

  class ClockWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.appliedBgKey = null; // evite de reecrire le style si rien n'a change
      this.saints = null; // calendrier des saints, charge une fois (mis en cache sur window.PiBoard)
    }

    init() {
      this.render();
      this.tick();
      this.loadSaints();
      this.timer = setInterval(() => this.tick(), 500);
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
        this.ctx.el.innerHTML = `
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
