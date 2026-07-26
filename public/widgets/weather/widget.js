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

  /* Paliers de l'indice UV, d'apres les recommandations de l'OMS.
     UV index bands, per WHO guidelines. */
  const UV_BANDS = [
    { max: 2, key: "low", color: "#4CAF50" },
    { max: 5, key: "moderate", color: "#F4C430" },
    { max: 7, key: "high", color: "#FF7A33" },
    { max: 10, key: "veryhigh", color: "#E5384B" },
    { max: Infinity, key: "extreme", color: "#8E24AA" }
  ];
  function uvBand(uv) {
    if (uv === null || uv === undefined || Number.isNaN(uv)) return null;
    return UV_BANDS.find((b) => uv <= b.max) || UV_BANDS[UV_BANDS.length - 1];
  }

  function fmtTime(iso, locale) {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  function fmtHour(iso, locale) {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit" });
  }
  // Les dates "YYYY-MM-DD" de "daily" sont analysees a la main (plutot
  // que via `new Date(iso)`, qui les interprete en UTC minuit) pour
  // eviter tout decalage d'un jour selon le fuseau du navigateur.
  // "daily"'s "YYYY-MM-DD" dates are parsed by hand (rather than via
  // `new Date(iso)`, which reads them as UTC midnight) to avoid any
  // one-day shift depending on the browser's timezone.
  function fmtDay(iso, locale) {
    const [y, m, dd] = iso.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(locale, { weekday: "short" });
  }

  class WeatherWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.coords = null;
      this.lastData = null;   // derniere reponse API, pour re-mettre en page sans refetch
      this.layoutMode = "landscape"; // "landscape" | "portrait" | "square"
      this.saints = null;     // calendrier des saints, charge une fois (cache sur window.PiBoard)
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
      this.loadSaints(); // en parallele, ne doit pas retarder l'affichage meteo
      await this.refresh();
      this.arm();
    }

    /* Charge le calendrier des prenoms (fete du jour), partage avec le
       widget horloge via un cache sur window.PiBoard pour eviter une
       double requete si les deux widgets sont presents.
       Loads the nameday calendar (saint of the day), shared with the
       clock widget via a cache on window.PiBoard to avoid a duplicate
       request when both widgets are present. */
    async loadSaints() {
      try {
        if (!window.PiBoard._saintsPromise) {
          window.PiBoard._saintsPromise = fetch("/data/saints-fr.json").then((r) => r.json());
        }
        this.saints = await window.PiBoard._saintsPromise;
        if (this.lastData) this.renderMarkup(); // peut arriver apres le premier rendu
      } catch (e) {
        this.saints = {};
      }
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
            + `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m`
            + `&hourly=temperature_2m,precipitation_probability,uv_index`
            + `&daily=temperature_2m_min,temperature_2m_max,weather_code,sunrise,sunset,`
            + `uv_index_max,wind_gusts_10m_max,precipitation_probability_max`
            + `&minutely_15=precipitation`
            + `&forecast_days=7&timezone=auto`
            + (provider !== "best_match" ? `&models=${encodeURIComponent(provider)}` : "");
        }
        const data = await fetch(url).then((r) => r.json());
        if (data.error) throw new Error(data.reason || "provider error");
        const cur = data.current;
        const day = data.daily;
        const hourly = data.hourly || null;
        const minutely = data.minutely_15 || null;
        const today = describe(cur.weather_code, lang);

        // Index de l'heure courante dans le tableau hourly.time (pour la
        // bande horaire 24h de la modal, qui doit commencer maintenant et
        // non a minuit). Absent si le fournisseur "Personnalise" ne
        // renvoie pas de bloc "hourly".
        // Index of the current hour in hourly.time (for the modal's 24h
        // strip, which should start now rather than at midnight). Absent
        // if the "Custom" provider doesn't return an "hourly" block.
        let nowHourIdx = 0;
        if (hourly && hourly.time && hourly.time.length) {
          const nowIso = new Date().toISOString().slice(0, 13);
          const found = hourly.time.findIndex((t) => t.slice(0, 13) === nowIso);
          nowHourIdx = found === -1 ? 0 : found;
        }

        // Pluie imminente (minutely_15) : cherche, dans l'heure qui
        // vient, le premier creneau de 15 minutes ou la pluie commence
        // alors qu'il ne pleut pas actuellement -- pour la ligne "pluie
        // dans ~15 min" affichee sur la tuile compacte, et rappelee dans
        // la modal.
        // Imminent rain (minutely_15): looks, within the coming hour,
        // for the first 15-minute slot where rain starts while it isn't
        // currently raining -- for the "rain in ~15 min" line shown on
        // the compact tile, and echoed in the modal.
        let rainSoonMinutes = null;
        if (minutely && minutely.time && minutely.precipitation) {
          const nowMs = Date.now();
          let currentIdx = -1;
          for (let i = 0; i < minutely.time.length; i++) {
            if (new Date(minutely.time[i]).getTime() <= nowMs) currentIdx = i; else break;
          }
          const currentlyRaining = currentIdx >= 0 && minutely.precipitation[currentIdx] > 0.1;
          if (!currentlyRaining) {
            for (let i = Math.max(0, currentIdx); i < minutely.time.length; i++) {
              const slotMs = new Date(minutely.time[i]).getTime();
              if (slotMs <= nowMs) continue;
              if (slotMs - nowMs > 60 * 60000) break; // fenetre d'1h / 1h window
              if (minutely.precipitation[i] > 0.1) {
                rainSoonMinutes = Math.max(15, Math.round((slotMs - nowMs) / 60000 / 15) * 15);
                break;
              }
            }
          }
        }

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

        this.lastData = { cur, day, hourly, minutely, nowHourIdx, rainSoonMinutes, today, name, lang, photo };
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
      const { cur, day, hourly, minutely, nowHourIdx, rainSoonMinutes, today, name, photo, lang } = d;

      // Carre : uniquement la meteo du jour, quel que soit le reglage
      // "afficher demain". Portrait : demain empile sous aujourd'hui.
      // Paysage : cote a cote (comportement historique).
      // Square: today only, regardless of the "show tomorrow" setting.
      // Portrait: tomorrow stacked under today. Landscape: side by side
      // (historical behavior).
      const wantsTomorrow = !!s.showTomorrow && this.layoutMode !== "square"
        && day.weather_code && day.weather_code.length > 1;

      // Saint du jour (et du lendemain, si la prevision de demain est
      // affichee) : tradition francaise, non affichee si la langue de
      // l'interface est l'anglais meme si le reglage est actif.
      // Name day for today (and for tomorrow, if tomorrow's forecast is
      // shown): French tradition, not shown when the interface language
      // is English even if the setting is on.
      let saintLine = "";
      let tomorrowSaintLine = "";
      if (s.showSaint && lang === "fr" && this.saints) {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const saint = this.saints[mm + "-" + dd];
        if (saint) saintLine = `<div class="pww-saint">${saint}</div>`;

        if (wantsTomorrow) {
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          const tmm = String(tomorrow.getMonth() + 1).padStart(2, "0");
          const tdd = String(tomorrow.getDate()).padStart(2, "0");
          const tomorrowSaint = this.saints[tmm + "-" + tdd];
          if (tomorrowSaint) tomorrowSaintLine = `<div class="pww-saint">${tomorrowSaint}</div>`;
        }
      }

      const wind = s.showWind
        ? ` · ${this.ctx.i18n.t("weather.wind")} ${Math.round(cur.wind_speed_10m)} km/h` : "";

      // Ligne "pluie dans ~X min" : uniquement affichee sur la tuile
      // compacte quand la pluie est effectivement imminente (dans
      // l'heure qui vient), pas en permanence -- comme demande.
      // "Rain in ~X min" line: only shown on the compact tile when rain
      // is actually imminent (within the coming hour), not permanently
      // -- as requested.
      const rainSoonLine = rainSoonMinutes
        ? `<div class="pww-rainsoon">🌧 ${this.ctx.i18n.t("weather.rainSoon").replace("{n}", rainSoonMinutes)}</div>`
        : "";

      const todayCol = `
        <div class="pww-col pww-today">
          ${wantsTomorrow ? `<div class="pww-day">${this.ctx.i18n.t("weather.today")}</div>` : ""}
          <div class="pww-icon">${iconSvg(today.icon)}</div>
          <div class="pww-temp">${Math.round(cur.temperature_2m)}°</div>
          <div class="pww-city">${name} — ${today.label}</div>
          <div class="pww-extra">${Math.round(day.temperature_2m_min[0])}° / ${Math.round(day.temperature_2m_max[0])}°${wind}</div>
          ${rainSoonLine}
          ${saintLine}
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
            ${tomorrowSaintLine}
          </div>`;
      }

      const credit = photo && photo.creator
        ? `<div class="pwv-credit">📷 <a href="${photo.sourceUrl || "#"}" target="_blank" rel="noopener">${photo.creator}</a>${photo.license ? " · " + photo.license : ""}</div>`
        : "";

      const colsClass = "pww-cols" + (wantsTomorrow && this.layoutMode === "portrait" ? " pww-stacked" : "");

      el.innerHTML = `
        <div class="pw-weather pww-bg-${today.icon}${photo ? " pww-has-photo" : ""} pww-clickable"
             ${photo ? `style="background-image:url('${photo.url.replace(/'/g, "%27")}')"` : ""}>
          <div class="${colsClass}">${todayCol}${tomorrowCol}</div>
          ${credit}
        </div>`;

      // Toute la tuile est cliquable pour ouvrir le detail (bande 24h,
      // 7 jours, UV, rafales, lever/coucher). stopPropagation : sinon le
      // clic remonte jusqu'a la grille en mode edition et rouvre les
      // reglages de la tuile par-dessus la modal qu'on vient d'ouvrir.
      // The whole tile is clickable to open the detail (24h strip, 7
      // days, UV, gusts, sunrise/sunset). stopPropagation: otherwise the
      // click bubbles up to the grid in edit mode and reopens the tile's
      // settings on top of the modal that was just opened.
      const tileEl = el.querySelector(".pw-weather");
      if (tileEl) {
        tileEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openDetails();
        });
      }
      this.fit();
    }

    /* Cree la fenetre de detail une seule fois (reutilisee ensuite) et
       l'ajoute a document.body pour echapper au cadre de la tuile.
       Fermeture par le bouton, la touche Echap, ou un clic sur le fond.
       Creates the detail popup once (reused afterwards) and appends it
       to document.body to escape the tile's clipped frame. Closes via
       the button, the Escape key, or a backdrop click. */
    ensureModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pww-modal-card">
          <header class="modal-head">
            <h2 class="pww-modal-title"></h2>
            <button type="button" class="modal-close" data-close aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pww-modal-body"></div>
        </div>`;
      document.body.appendChild(wrap);

      wrap.addEventListener("click", (e) => {
        if (e.target === wrap || e.target.hasAttribute("data-close")) wrap.hidden = true;
      });
      this._escHandler = (e) => { if (e.key === "Escape" && !wrap.hidden) wrap.hidden = true; };
      document.addEventListener("keydown", this._escHandler);

      this.modal = wrap;
      return wrap;
    }

    openDetails() {
      const d = this.lastData;
      if (!d) return;
      const modal = this.ensureModal();
      modal.querySelector(".pww-modal-title").textContent = `${d.name} — ${d.today.label}`;
      modal.querySelector(".pww-modal-body").innerHTML = this.buildDetailsHtml(d);
      modal.hidden = false;
    }

    /* Contenu de la modal : bande horaire 24h (temperature + probabilite
       de pluie), previsions 7 jours, UV, rafales, lever/coucher, et le
       rappel "pluie imminente" s'il y a lieu. Chaque section se degrade
       proprement (simplement absente) si la donnee correspondante n'est
       pas fournie -- notamment pour la source "Personnalisee", dont la
       reponse peut ne pas inclure hourly/minutely_15.
       Modal content: 24h strip (temperature + rain probability), 7-day
       forecast, UV, gusts, sunrise/sunset, and the "rain imminent"
       reminder when relevant. Each section degrades gracefully (simply
       absent) if the matching data isn't provided -- notably for the
       "Custom" source, whose response may not include hourly/minutely_15. */
    buildDetailsHtml(d) {
      const i18n = this.ctx.i18n;
      const lang = i18n.lang;
      const locale = i18n.t("clock.date.format");

      const rainBanner = d.rainSoonMinutes
        ? `<div class="pww-modal-rainsoon">🌧 ${i18n.t("weather.rainSoon").replace("{n}", d.rainSoonMinutes)}</div>`
        : "";

      const gusts = d.cur.wind_gusts_10m !== undefined && d.cur.wind_gusts_10m !== null
        ? `<div class="pww-modal-stat"><span class="pww-modal-stat-label">${i18n.t("weather.gusts")}</span><span class="pww-modal-stat-value">${Math.round(d.cur.wind_gusts_10m)} km/h</span></div>`
        : "";

      let uvStat = "";
      if (d.day.uv_index_max && d.day.uv_index_max[0] !== null && d.day.uv_index_max[0] !== undefined) {
        const band = uvBand(d.day.uv_index_max[0]);
        uvStat = `<div class="pww-modal-stat"><span class="pww-modal-stat-label">UV</span><span class="pww-modal-stat-value" style="color:${band.color}">${Math.round(d.day.uv_index_max[0])} · ${i18n.t("weather.uv." + band.key)}</span></div>`;
      }

      const sunStat = d.day.sunrise && d.day.sunrise[0]
        ? `<div class="pww-modal-stat"><span class="pww-modal-stat-label">${i18n.t("weather.sunTimes")}</span><span class="pww-modal-stat-value">${fmtTime(d.day.sunrise[0], locale)} – ${fmtTime(d.day.sunset[0], locale)}</span></div>`
        : "";

      let hourlyStrip = "";
      if (d.hourly && d.hourly.time && d.hourly.time.length) {
        const end = Math.min(d.nowHourIdx + 24, d.hourly.time.length);
        const items = [];
        for (let i = d.nowHourIdx; i < end; i++) {
          const pop = d.hourly.precipitation_probability ? d.hourly.precipitation_probability[i] : null;
          items.push(`
            <div class="pww-hour">
              <div class="pww-hour-time">${fmtHour(d.hourly.time[i], locale)}</div>
              <div class="pww-hour-temp">${Math.round(d.hourly.temperature_2m[i])}°</div>
              ${pop !== null ? `<div class="pww-hour-pop" style="opacity:${Math.max(0.3, pop / 100)}">${Math.round(pop)}%</div>` : ""}
            </div>`);
        }
        hourlyStrip = `<div class="pww-section-title">${i18n.t("weather.next24h")}</div><div class="pww-hourly-strip">${items.join("")}</div>`;
      }

      let dailyList = "";
      if (d.day.time && d.day.time.length) {
        const items = d.day.time.map((iso, i) => {
          const desc = describe(d.day.weather_code[i], lang);
          const dayLabel = i === 0 ? i18n.t("weather.today") : fmtDay(iso, locale);
          const pop = d.day.precipitation_probability_max ? d.day.precipitation_probability_max[i] : null;
          return `
            <div class="pww-day-row">
              <div class="pww-day-name">${dayLabel}</div>
              <div class="pww-day-icon">${iconSvg(desc.icon)}</div>
              <div class="pww-day-pop">${pop !== null && pop !== undefined ? "💧" + Math.round(pop) + "%" : ""}</div>
              <div class="pww-day-range">${Math.round(d.day.temperature_2m_min[i])}° / ${Math.round(d.day.temperature_2m_max[i])}°</div>
            </div>`;
        }).join("");
        dailyList = `<div class="pww-section-title">${i18n.t("weather.next7days")}</div><div class="pww-daily-list">${items}</div>`;
      }

      return `
        ${rainBanner}
        <div class="pww-modal-stats">${gusts}${uvStat}${sunStat}</div>
        ${hourlyStrip}
        ${dailyList}
        <div class="pwv-credit pww-modal-credit">Open-Meteo</div>`;
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
      el.querySelectorAll(".pww-saint").forEach((n) => {
        n.style.fontSize = Math.max(9, Math.floor(blockH * 0.075 * k)) + "px";
      });
    }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
      if (this.modal) {
        this.modal.remove();
        if (this._escHandler) document.removeEventListener("keydown", this._escHandler);
      }
    }
  }

  window.PiBoard.registerWidget("weather", WeatherWidget);
})();
