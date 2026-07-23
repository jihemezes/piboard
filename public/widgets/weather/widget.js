/* PiBoard widget: weather / meteo (Open-Meteo, sans cle API / no API key)
   v2 : fond teinte selon la meteo + prevision du lendemain cote a cote
   v2: condition-tinted background + optional side-by-side tomorrow forecast */
(function () {
  "use strict";

  /* Codes meteo WMO -> icone + libelle / WMO weather codes -> icon + label */
  const WMO = [
    { codes: [0], icon: "sun", en: "Clear sky", fr: "Ciel dégagé" },
    { codes: [1, 2], icon: "sun-cloud", en: "Partly cloudy", fr: "Partiellement nuageux" },
    { codes: [3], icon: "cloud", en: "Overcast", fr: "Couvert" },
    { codes: [45, 48], icon: "fog", en: "Fog", fr: "Brouillard" },
    { codes: [51, 53, 55, 56, 57], icon: "drizzle", en: "Drizzle", fr: "Bruine" },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], icon: "rain", en: "Rain", fr: "Pluie" },
    { codes: [71, 73, 75, 77, 85, 86], icon: "snow", en: "Snow", fr: "Neige" },
    { codes: [95, 96, 99], icon: "storm", en: "Thunderstorm", fr: "Orage" }
  ];

  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    "sun-cloud": '<circle cx="8.5" cy="8.5" r="3.2"/><path d="M8.5 2.8v1.6M2.8 8.5h1.6M4.5 4.5l1.1 1.1"/><path d="M17.5 20a4 4 0 1 0-.9-7.9A5.2 5.2 0 1 0 7 17.5c.4 1.5 1.7 2.5 3.2 2.5z"/>',
    cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1-8.9A6 6 0 1 0 6 16.8 4 4 0 0 0 7 19z"/>',
    fog: '<path d="M4 10h16M6 14h13M4 18h14"/>',
    drizzle: '<path d="M17 15a4 4 0 1 0-.9-7.9A5.2 5.2 0 1 0 6 13"/><path d="M9 17.5v1.5M13 17.5v1.5M11 20.5v1.5"/>',
    rain: '<path d="M17 14a4 4 0 1 0-.9-7.9A5.2 5.2 0 1 0 6 12"/><path d="M8.5 16l-1 3.5M13 16l-1 3.5M17 16l-1 3.5"/>',
    snow: '<path d="M17 14a4 4 0 1 0-.9-7.9A5.2 5.2 0 1 0 6 12"/><path d="M9 17h.01M13 16h.01M11 20h.01M15.5 19h.01M7.5 20h.01"/>',
    storm: '<path d="M17 13a4 4 0 1 0-.9-7.9A5.2 5.2 0 1 0 6 11"/><path d="M12.5 12.5 9.5 17h4l-3 5"/>'
  };

  function describe(code, lang) {
    const found = WMO.find((w) => w.codes.includes(code)) || WMO[2];
    return { icon: found.icon, label: lang === "fr" ? found.fr : found.en };
  }

  function iconSvg(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`;
  }

  class WeatherWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.coords = null;
      this.lastData = null;   // derniere reponse API, pour re-mettre en page sans refetch
      this.layoutMode = "landscape"; // "landscape" | "portrait" | "square"
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-weather"><div class="pww-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      // Reajuster la mise en page ET la typographie quand la tuile change
      // de taille : la forme (portrait/paysage/carre) determine la mise
      // en page, recalculee sans requete reseau grace aux donnees en cache.
      // Refit the layout AND the typography whenever the tile is resized:
      // shape (portrait/landscape/square) drives the layout, recomputed
      // without a network request thanks to the cached data.
      this.observer = new ResizeObserver(() => this.handleResize());
      this.observer.observe(this.ctx.el);
      await this.refresh();
      this.arm();
    }

    /* Determine la forme de la tuile a partir de ses dimensions REELLES en
       pixels (pas du nombre de cellules de grille, qui ne sont pas
       forcement carrees). Determines the tile's shape from its ACTUAL
       pixel dimensions (not the grid cell count, which isn't necessarily square). */
    computeLayoutMode() {
      const w = this.ctx.el.clientWidth || 1;
      const h = this.ctx.el.clientHeight || 1;
      const ratio = w / h;
      if (ratio > 1.2) return "landscape";
      if (ratio < 0.83) return "portrait";
      return "square";
    }

    handleResize() {
      const mode = this.computeLayoutMode();
      if (mode !== this.layoutMode && this.lastData) {
        this.layoutMode = mode;
        this.renderMarkup();
      } else {
        this.fit();
      }
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 15);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.coords = null; // la ville a pu changer / city may have changed
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async geocode(city) {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city)
        + "&language=" + (this.ctx.i18n.lang === "fr" ? "fr" : "en");
      const data = await fetch(url).then((r) => r.json());
      if (!data.results || !data.results.length) throw new Error("city not found");
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name };
    }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang;
      try {
        if (!this.coords) this.coords = await this.geocode(s.city || "Paris");
        const { lat, lon, name } = this.coords;
        const provider = s.provider || "best_match";
        let url;
        if (provider === "custom") {
          if (!s.customUrl) throw new Error(this.ctx.i18n.t("weather.noCustomUrl"));
          url = s.customUrl.replace(/\{lat\}/g, lat).replace(/\{lon\}/g, lon);
        } else {
          // Toutes les options (sauf "custom") passent par l'API Open-Meteo,
          // sans cle : le parametre "models" choisit juste le modele
          // national sous-jacent. "best_match" (comportement historique)
          // omet le parametre pour laisser Open-Meteo choisir lui-meme.
          // All options (except "custom") go through Open-Meteo's keyless
          // API: the "models" parameter just picks the underlying national
          // model. "best_match" (historical behavior) omits the parameter
          // and lets Open-Meteo choose automatically.
          url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
            + `&current=temperature_2m,weather_code,wind_speed_10m`
            + `&daily=temperature_2m_min,temperature_2m_max,weather_code`
            + `&forecast_days=2&timezone=auto`
            + (provider !== "best_match" ? `&models=${encodeURIComponent(provider)}` : "");
        }
        const data = await fetch(url).then((r) => r.json());
        if (data.error) throw new Error(data.reason || "provider error");
        const cur = data.current;
        const day = data.daily;
        const today = describe(cur.weather_code, lang);

        // Photo de fond selon la condition (repli sur le degrade de couleur
        // si l'option est desactivee ou si la photo est indisponible).
        // Condition photo background (falls back to the color gradient if
        // the option is off or the photo is unavailable).
        let photo = null;
        if (s.usePhotos !== false) {
          try {
            photo = await fetch("/api/weather-photo/" + today.icon).then((r) => {
              if (!r.ok) throw new Error("status " + r.status);
              return r.json();
            });
          } catch (e) {
            photo = null; // fond colore en repli / color background as fallback
          }
        }

        this.lastData = { cur, day, today, name, lang, photo };
        this.layoutMode = this.computeLayoutMode();
        this.renderMarkup();
      } catch (e) {
        console.warn("[piboard/weather]", e);
        const detail = e && e.message ? ": " + e.message : "";
        el.innerHTML = `<div class="pw-weather"><div class="pww-err">${this.ctx.i18n.t("weather.error")}${detail}</div></div>`;
      }
    }

    /* Construit le HTML a partir des dernieres donnees recues, selon la
       forme actuelle de la tuile. Ne fait aucune requete reseau : appelee
       aussi bien apres un refresh() que lors d'un redimensionnement.
       Builds the HTML from the last received data, according to the
       tile's current shape. Makes no network request: called both after
       a refresh() and on resize. */
    renderMarkup() {
      const d = this.lastData;
      if (!d) return;
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const { cur, day, today, name, photo } = d;

      // Carre : uniquement la meteo du jour, quel que soit le reglage
      // "afficher demain". Portrait : demain empile sous aujourd'hui.
      // Paysage : cote a cote (comportement historique).
      // Square: today only, regardless of the "show tomorrow" setting.
      // Portrait: tomorrow stacked under today. Landscape: side by side
      // (historical behavior).
      const wantsTomorrow = !!s.showTomorrow && this.layoutMode !== "square"
        && day.weather_code && day.weather_code.length > 1;

      const wind = s.showWind
        ? ` · ${this.ctx.i18n.t("weather.wind")} ${Math.round(cur.wind_speed_10m)} km/h` : "";

      const todayCol = `
        <div class="pww-col pww-today">
          ${wantsTomorrow ? `<div class="pww-day">${this.ctx.i18n.t("weather.today")}</div>` : ""}
          <div class="pww-icon">${iconSvg(today.icon)}</div>
          <div class="pww-temp">${Math.round(cur.temperature_2m)}°</div>
          <div class="pww-city">${name} — ${today.label}</div>
          <div class="pww-extra">${Math.round(day.temperature_2m_min[0])}° / ${Math.round(day.temperature_2m_max[0])}°${wind}</div>
        </div>`;

      let tomorrowCol = "";
      if (wantsTomorrow) {
        const tom = describe(day.weather_code[1], d.lang);
        tomorrowCol = `
          <div class="pww-col pww-tomorrow">
            <div class="pww-day">${this.ctx.i18n.t("weather.tomorrow")}</div>
            <div class="pww-icon">${iconSvg(tom.icon)}</div>
            <div class="pww-temp pww-temp-range">${Math.round(day.temperature_2m_min[1])}° / ${Math.round(day.temperature_2m_max[1])}°</div>
            <div class="pww-city">${tom.label}</div>
          </div>`;
      }

      const credit = photo && photo.creator
        ? `<div class="pwv-credit">📷 <a href="${photo.sourceUrl || "#"}" target="_blank" rel="noopener">${photo.creator}</a>${photo.license ? " · " + photo.license : ""}</div>`
        : "";

      const colsClass = "pww-cols" + (wantsTomorrow && this.layoutMode === "portrait" ? " pww-stacked" : "");

      el.innerHTML = `
        <div class="pw-weather pww-bg-${today.icon}${photo ? " pww-has-photo" : ""}"
             ${photo ? `style="background-image:url('${photo.url.replace(/'/g, "%27")}')"` : ""}>
          <div class="${colsClass}">${todayCol}${tomorrowCol}</div>
          ${credit}
        </div>`;
      this.fit();
    }

    fit() {
      const el = this.ctx.el;
      const h = el.clientHeight || 120;
      const cols = el.querySelector(".pww-cols");
      const stacked = cols && cols.classList.contains("pww-stacked");
      const two = !!el.querySelector(".pww-tomorrow");

      // Hauteur reellement disponible pour CHAQUE bloc (aujourd'hui /
      // demain). En mode empile (portrait), les deux blocs se partagent
      // la hauteur de la tuile : se baser sur la hauteur totale, comme
      // avant, faisait deborder les elements car ils n'ont en realite
      // que la moitie de la place. En cote-a-cote, chaque bloc garde
      // toute la hauteur (c'est la largeur qui est partagee).
      // Height actually available to EACH block (today / tomorrow). In
      // stacked mode (portrait), the two blocks share the tile's height:
      // basing sizes on the total height, as before, made things
      // overflow since each block only really has half the room. Side
      // by side, each block keeps the full height (width is what's shared).
      const blockH = stacked ? (h - 14) / 2 : h;
      // Le facteur de compacite ne s'applique qu'au cote-a-cote : en
      // empile, blockH tient deja compte du partage de l'espace.
      // The compactness factor only applies side by side: stacked mode's
      // blockH already accounts for the shared space.
      const k = two && !stacked ? 0.8 : 1;

      el.querySelectorAll(".pww-icon").forEach((icon) => {
        icon.style.width = icon.style.height = Math.floor(blockH * 0.30 * k) + "px";
      });
      el.querySelectorAll(".pww-temp").forEach((n) => {
        n.style.fontSize = Math.max(14, Math.floor(blockH * (n.classList.contains("pww-temp-range") ? 0.14 : 0.24) * k)) + "px";
      });
      el.querySelectorAll(".pww-city").forEach((n) => {
        n.style.fontSize = Math.max(10, Math.floor(blockH * 0.095 * k)) + "px";
      });
      el.querySelectorAll(".pww-extra").forEach((n) => {
        n.style.fontSize = Math.max(9, Math.floor(blockH * 0.08 * k)) + "px";
      });
    }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("weather", WeatherWidget);
})();
