/* PiBoard widget: qualite de l'air et pollens / air quality and pollen
   Source : API Air Quality d'Open-Meteo (gratuite, sans cle), basee sur les
   previsions CAMS Europe. Indice de qualite de l'air europeen (EAQI) +
   niveaux de pollens (Europe uniquement, saison en cours seulement).
   Source: Open-Meteo's free, keyless Air Quality API, based on the CAMS
   Europe forecast. European Air Quality Index (EAQI) + pollen levels
   (Europe only, in-season plants only). */
(function () {
  "use strict";

  /* Paliers de l'indice europeen (EAQI), tels que definis par l'Agence
     europeenne pour l'environnement : 0-20 bon, 20-40 moyen, 40-60 degrade,
     60-80 mauvais, 80-100 tres mauvais, >100 extremement mauvais.
     European AQI thresholds, as defined by the European Environment
     Agency: 0-20 good, 20-40 fair, 40-60 moderate, 60-80 poor, 80-100 very
     poor, >100 extremely poor. */
  const EAQI_LEVELS = [
    { max: 20, key: "good", color: "#4CAF50" },
    { max: 40, key: "fair", color: "#9ACD32" },
    { max: 60, key: "moderate", color: "#F4C430" },
    { max: 80, key: "poor", color: "#FF7A33" },
    { max: 100, key: "verypoor", color: "#E5384B" },
    { max: Infinity, key: "extremelypoor", color: "#8E24AA" }
  ];

  function classifyEaqi(value) {
    if (value === null || value === undefined) return null;
    return EAQI_LEVELS.find((l) => value <= l.max) || EAQI_LEVELS[EAQI_LEVELS.length - 1];
  }

  /* Echelle de pollen volontairement simplifiee (grains/m3) : les seuils
     officiels varient selon l'espece et ne sont pas tous publies par
     Open-Meteo. Sert a un coup d'oeil rapide, pas a un usage medical.
     Deliberately simplified pollen scale (grains/m3): official thresholds
     vary per species and aren't all published by Open-Meteo. Meant for a
     quick glance, not medical use. */
  function classifyPollen(value) {
    if (value === null || value === undefined) return null;
    if (value < 1) return "none";
    if (value < 10) return "low";
    if (value < 50) return "moderate";
    return "high";
  }

  const POLLEN_COLOR = { none: "#8A98B2", low: "#9ACD32", moderate: "#F4C430", high: "#E5384B" };

  const POLLENS = [
    { key: "birch_pollen", en: "Birch", fr: "Bouleau" },
    { key: "grass_pollen", en: "Grass", fr: "Graminées" },
    { key: "ragweed_pollen", en: "Ragweed", fr: "Ambroisie" },
    { key: "alder_pollen", en: "Alder", fr: "Aulne" },
    { key: "mugwort_pollen", en: "Mugwort", fr: "Armoise" },
    { key: "olive_pollen", en: "Olive", fr: "Olivier" }
  ];

  const POLLUTANTS = [
    { key: "pm2_5", aqiKey: "european_aqi_pm2_5", label: "PM2.5" },
    { key: "pm10", aqiKey: "european_aqi_pm10", label: "PM10" },
    { key: "nitrogen_dioxide", aqiKey: "european_aqi_nitrogen_dioxide", label: "NO₂" },
    { key: "ozone", aqiKey: "european_aqi_ozone", label: "O₃" },
    { key: "sulphur_dioxide", aqiKey: "european_aqi_sulphur_dioxide", label: "SO₂" }
  ];

  class AirQualityWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.coords = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-airquality"><div class="paq-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(10, Number(this.ctx.settings.refresh) || 30);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.coords = null; // la ville a pu changer / city may have changed
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    /* Reutilise exactement le meme service de geocodage que le widget
       meteo (gratuit, sans cle). Reuses the exact same geocoding service
       as the weather widget (free, keyless). */
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
      try {
        if (!this.coords) this.coords = await this.geocode(s.city || "Paris");
        const { lat, lon, name } = this.coords;

        const vars = ["european_aqi", "european_aqi_pm2_5", "european_aqi_pm10",
          "european_aqi_nitrogen_dioxide", "european_aqi_ozone", "european_aqi_sulphur_dioxide",
          "pm2_5", "pm10", "nitrogen_dioxide", "ozone", "sulphur_dioxide",
          ...POLLENS.map((p) => p.key)];
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`
          + `&current=${vars.join(",")}&timezone=auto`;
        const data = await fetch(url).then((r) => r.json());
        if (data.error) throw new Error(data.reason || "provider error");
        const cur = data.current;

        // Polluant dominant : celui dont le sous-indice europeen egale (ou
        // approche le plus) l'indice consolide. Dominant pollutant: the
        // one whose European sub-index equals (or comes closest to) the
        // consolidated index.
        const pollutants = POLLUTANTS.map((p) => ({
          ...p, aqi: cur[p.aqiKey], raw: cur[p.key]
        }));
        const dominant = pollutants.reduce((a, b) => ((b.aqi ?? -1) > (a.aqi ?? -1) ? b : a), pollutants[0]);

        // Pollens actuellement en saison seulement (les autres arrivent a
        // "null" depuis l'API). Only pollens currently in season (others
        // come back as "null" from the API).
        const activePollens = POLLENS
          .map((p) => ({ ...p, value: cur[p.key], level: classifyPollen(cur[p.key]) }))
          .filter((p) => p.value !== null && p.value !== undefined);
        const dominantPollenRank = { none: 0, low: 1, moderate: 2, high: 3 };
        const dominantPollen = activePollens.length
          ? activePollens.reduce((a, b) => (dominantPollenRank[b.level] > dominantPollenRank[a.level] ? b : a))
          : null;

        this.lastData = { name, eaqi: cur.european_aqi, dominant, pollutants, activePollens, dominantPollen };
        this.renderMarkup();
      } catch (e) {
        console.warn("[piboard/airquality]", e);
        const detail = e && e.message ? ": " + e.message : "";
        el.innerHTML = `<div class="pw-airquality"><div class="paq-err">${this.ctx.i18n.t("airquality.error")}${detail}</div></div>`;
      }
    }

    renderMarkup() {
      const d = this.lastData;
      if (!d) return;
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const level = classifyEaqi(d.eaqi);
      const levelLabel = level ? i18n.t("airquality.level." + level.key) : "—";
      const color = level ? level.color : "#8A98B2";
      const detailed = s.displayMode === "detailed";

      const dominantLine = d.dominant && d.dominant.raw !== null && d.dominant.raw !== undefined
        ? `<div class="paq-dominant">${d.dominant.label} · ${Math.round(d.dominant.raw)} µg/m³</div>`
        : "";

      const pollenLine = s.showPollen !== false && d.dominantPollen
        ? `<div class="paq-pollen">🌾 ${i18n.t("airquality.pollen." + d.dominantPollen.key.replace("_pollen", ""))} · ${i18n.t("airquality.pollenLevel." + d.dominantPollen.level)}</div>`
        : "";

      if (!detailed) {
        el.innerHTML = `
          <div class="pw-airquality">
            <div class="paq-badge" style="background:${color}">
              <div class="paq-value">${d.eaqi != null ? Math.round(d.eaqi) : "—"}</div>
              <div class="paq-level">${levelLabel}</div>
            </div>
            <div class="paq-city">${d.name}</div>
            ${dominantLine}
            ${pollenLine}
            <div class="paq-credit">CAMS · Open-Meteo</div>
          </div>`;
        this.fit();
        return;
      }

      const chips = d.pollutants.map((p) => {
        const lvl = classifyEaqi(p.aqi);
        const c = lvl ? lvl.color : "#8A98B2";
        const val = p.raw !== null && p.raw !== undefined ? Math.round(p.raw) + " µg/m³" : "—";
        return `<div class="paq-chip" style="--chip:${c}"><span class="paq-chip-label">${p.label}</span><span class="paq-chip-value">${val}</span></div>`;
      }).join("");

      let pollenSection = "";
      if (s.showPollen !== false) {
        if (d.activePollens.length) {
          const pchips = d.activePollens.map((p) => {
            const name = i18n.t("airquality.pollen." + p.key.replace("_pollen", ""));
            const lvlLabel = i18n.t("airquality.pollenLevel." + p.level);
            return `<div class="paq-chip" style="--chip:${POLLEN_COLOR[p.level]}"><span class="paq-chip-label">${name}</span><span class="paq-chip-value">${lvlLabel}</span></div>`;
          }).join("");
          pollenSection = `<div class="paq-section-title">${i18n.t("airquality.pollenTitle")}</div><div class="paq-grid">${pchips}</div>`;
        } else {
          pollenSection = `<div class="paq-section-title">${i18n.t("airquality.pollenTitle")}</div><div class="paq-outofseason">${i18n.t("airquality.outOfSeason")}</div>`;
        }
      }

      el.innerHTML = `
        <div class="pw-airquality paq-detailed">
          <div class="paq-header">
            <div class="paq-badge" style="background:${color}">
              <div class="paq-value">${d.eaqi != null ? Math.round(d.eaqi) : "—"}</div>
            </div>
            <div class="paq-headtext">
              <div class="paq-level">${levelLabel}</div>
              <div class="paq-city">${d.name}</div>
            </div>
          </div>
          <div class="paq-grid">${chips}</div>
          ${pollenSection}
          <div class="paq-credit">CAMS · Open-Meteo</div>
        </div>`;
      this.fit();
    }

    /* Mise a l'echelle simple selon la hauteur de la tuile (pas de
       recherche dichotomique complexe : le contenu est deja fluide en
       CSS grace au flex-wrap des puces).
       Simple scaling based on tile height (no complex binary search: the
       content is already fluid via CSS flex-wrap on the chips). */
    fit() {
      const el = this.ctx.el;
      const h = el.clientHeight || 120;
      const badge = el.querySelector(".paq-badge");
      if (badge) {
        const size = Math.max(40, Math.min(96, Math.floor(h * (el.querySelector(".paq-detailed") ? 0.22 : 0.34))));
        badge.style.width = badge.style.height = size + "px";
        const value = badge.querySelector(".paq-value");
        if (value) value.style.fontSize = Math.floor(size * 0.36) + "px";
        const lvl = badge.querySelector(".paq-level");
        if (lvl) lvl.style.fontSize = Math.max(8, Math.floor(size * 0.13)) + "px";
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("airquality", AirQualityWidget);
})();
