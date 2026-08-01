/* PiBoard widget: astronomie / astronomy
   Trois sections independamment activables : phase de lune, prochains
   passages visibles de l'ISS, planetes actuellement au-dessus de
   l'horizon.

   Phase de lune et planetes : calculees LOCALEMENT sur le serveur PiBoard
   (voir server/astronomy.js, bibliotheque astronomy-engine) -- aucune
   dependance reseau externe, contrairement a la plupart des widgets.
   Passages ISS : seule section necessitant une source externe, des
   elements orbitaux a jour etant indispensables (voir iss-api.polluxlabs.io
   ci-dessous, CORS active, appelee directement depuis le navigateur).

   Three independently toggleable sections: moon phase, upcoming visible
   ISS passes, planets currently above the horizon.

   Moon phase and planets: computed LOCALLY on the PiBoard server (see
   server/astronomy.js, astronomy-engine library) -- no external network
   dependency, unlike most widgets. ISS passes: the only section needing
   an external source, since up-to-date orbital elements are essential
   (see iss-api.polluxlabs.io below, CORS enabled, called directly from
   the browser). */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Icone de phase de lune en SVG, construite a partir de la fraction
     eclairee et du sens (croissante/decroissante) -- technique classique
     du demi-cercle combine a une ellipse representant le terminateur :
     - rx de l'ellipse = R*|1-2*illum| (0 a la moitie exacte -> ligne
       droite d'un quartier ; R aux extremes -> cercle complet, plein ou
       nouveau selon le sens de balayage) ;
     - le sens de balayage de l'ellipse est identique a celui du
       demi-cercle pour une gibbeuse (illum>0.5, l'ellipse "ajoute" de la
       surface) et oppose pour un croissant (illum<0.5, l'ellipse
       "retranche" de la surface).
     Dans l'hemisphere sud, la lune apparait inversee par rapport a
     l'hemisphere nord : le sens de balayage est inverse en consequence.

     SVG moon-phase icon, built from the illuminated fraction and
     direction (waxing/waning) -- the classic half-circle-plus-ellipse
     technique for the terminator:
     - ellipse rx = R*|1-2*illum| (0 at exactly half -> straight quarter
       line; R at the extremes -> a full circle, either fully lit or
       fully dark depending on sweep direction);
     - the ellipse's sweep direction matches the half-circle's for a
       gibbous (illum>0.5, the ellipse "adds" area) and is opposite for a
       crescent (illum<0.5, the ellipse "subtracts" area).
     In the southern hemisphere the Moon appears flipped relative to the
     northern hemisphere: the sweep direction is flipped accordingly. */
  function moonIconSvg(illum, waxing, southernHemisphere) {
    const R = 46, C = 50;
    const rx = Math.max(0, R * Math.abs(1 - 2 * illum));
    let sweep1 = waxing ? 1 : 0;
    if (southernHemisphere) sweep1 = 1 - sweep1;
    const sweep2 = illum > 0.5 ? sweep1 : 1 - sweep1;
    const path = `M ${C} ${C - R} A ${R} ${R} 0 0 ${sweep1} ${C} ${C + R} A ${rx} ${R} 0 0 ${sweep2} ${C} ${C - R} Z`;
    return `<svg viewBox="0 0 100 100">
      <circle cx="${C}" cy="${C}" r="${R}" class="pwa-moon-dark"/>
      <path d="${path}" class="pwa-moon-lit"/>
      <circle cx="${C}" cy="${C}" r="${R}" class="pwa-moon-ring" fill="none"/>
    </svg>`;
  }

  function fmtTime(iso, locale) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(iso, locale, i18n) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (sameDay) return i18n.t("astronomy.today");
    if (d.toDateString() === tomorrow.toDateString()) return i18n.t("astronomy.tomorrow");
    return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  }

  class AstronomyWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.coords = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 30);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
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
      return { lat: r.latitude, lon: r.longitude, elevation: r.elevation || 0, name: r.name };
    }

    async refresh() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      try {
        if (!this.coords) this.coords = await this.geocode(s.city || "Paris");
        const { lat, lon, elevation } = this.coords;

        const jobs = [];
        jobs.push(s.showMoonPhase !== false
          ? fetch("/api/astronomy/moon").then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] moon", e); return null; })
          : Promise.resolve(null));
        jobs.push(s.showPlanets !== false
          ? fetch(`/api/astronomy/planets?lat=${lat}&lon=${lon}&elevation=${elevation}&includeOuter=${s.includeOuterPlanets === true}`)
              .then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] planets", e); return null; })
          : Promise.resolve(null));
        jobs.push(s.showIss !== false ? this.loadIss(lat, lon, elevation) : Promise.resolve(null));

        const [moon, planetsData, iss] = await Promise.all(jobs);
        this.data = {
          moon,
          planets: planetsData && planetsData.planets ? planetsData.planets.filter((p) => p.aboveHorizon) : null,
          iss
        };
        this.render();
      } catch (e) {
        console.warn("[piboard/astronomy]", e);
        this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${i18n.t("astronomy.error")}</div></div>`;
      }
    }

    /* iss-api.polluxlabs.io : successeur communautaire gratuit et sans
       cle de l'ancienne API open-notify.org (dont les predictions de
       passage ont ferme). CORS active pour tous les domaines -- appel
       direct depuis le navigateur, sans passer par /api/proxy.
       Attention honnete : projet solo finance par des dons, meme risque
       de disparition qu'open-notify un jour -- c'est neanmoins la
       meilleure source actuellement disponible pour cette donnee (des
       elements orbitaux a jour, impossibles a calculer localement).
       iss-api.polluxlabs.io: free, keyless community successor to the
       old open-notify.org API (whose pass predictions shut down). CORS
       enabled for all origins -- called directly from the browser,
       without going through /api/proxy. Honest caveat: a solo,
       donation-funded project, same disappearance risk as open-notify
       one day -- still the best currently available source for this
       data (up-to-date orbital elements, impossible to compute
       locally). */
    async loadIss(lat, lon, elevation) {
      const s = this.ctx.settings;
      const n = Math.max(1, Math.min(10, Number(s.issMaxPasses) || 3));
      const params = new URLSearchParams({
        lat: lat.toFixed(4), lon: lon.toFixed(4), alt: Math.round(elevation),
        n: String(n), visible_only: s.issVisibleOnly !== false ? "true" : "false"
      });
      try {
        const res = await fetch("https://iss-api.polluxlabs.io/iss-pass?" + params.toString());
        if (!res.ok) throw new Error("iss-api status " + res.status);
        const data = await res.json();
        return data.passes || [];
      } catch (e) {
        console.warn("[piboard/astronomy] iss", e);
        return null; // distingue "echec" de "aucun passage" a l'affichage / tells "failure" apart from "no pass" at render time
      }
    }

    render() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const d = this.data;
      const sections = [];

      if (s.showMoonPhase !== false) sections.push(this.renderMoon(d.moon));
      if (s.showIss !== false) sections.push(this.renderIss(d.iss));
      if (s.showPlanets !== false) sections.push(this.renderPlanets(d.planets));

      if (!sections.length) {
        this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${i18n.t("astronomy.nothingShown")}</div></div>`;
        return;
      }
      this.ctx.el.innerHTML = `<div class="pw-astronomy">${sections.join("")}</div>`;
    }

    renderMoon(moon) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      if (!moon) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.moonTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.error")}</div></div>`;
      }
      const southern = this.coords && this.coords.lat < 0;
      const icon = moonIconSvg(moon.illumination, moon.waxing, southern);
      const pct = Math.round(moon.illumination * 100);
      return `
        <div class="pwa-section pwa-moon-section">
          <div class="pwa-section-title">${i18n.t("astronomy.moonTitle")}</div>
          <div class="pwa-moon-row">
            <div class="pwa-moon-icon">${icon}</div>
            <div class="pwa-moon-info">
              <div class="pwa-moon-phase">${i18n.t("astronomy.phase." + moon.phaseKey)}</div>
              <div class="pwa-moon-pct">${pct}% ${i18n.t("astronomy.illuminated")}</div>
              <div class="pwa-moon-next">🌑 ${i18n.t("astronomy.nextNew")} ${fmtDay(moon.nextNewMoon, locale, i18n)}</div>
              <div class="pwa-moon-next">🌕 ${i18n.t("astronomy.nextFull")} ${fmtDay(moon.nextFullMoon, locale, i18n)}</div>
            </div>
          </div>
        </div>`;
    }

    renderIss(passes) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      let body;
      if (passes === null) {
        body = `<div class="pwa-msg-inline">${i18n.t("astronomy.issError")}</div>`;
      } else if (!passes.length) {
        body = `<div class="pwa-msg-inline">${i18n.t(this.ctx.settings.issVisibleOnly !== false ? "astronomy.issNoneVisible" : "astronomy.issNone")}</div>`;
      } else {
        body = `<ul class="pwa-iss-list">${passes.map((p) => `
          <li class="pwa-iss-item ${p.visible ? "pwa-iss-visible" : ""}">
            <div class="pwa-iss-when">${fmtDay(p.rise.time, locale, i18n)} · ${fmtTime(p.rise.time, locale)}</div>
            <div class="pwa-iss-detail">
              <span>${escapeHtml(p.rise.compass)} → ${escapeHtml(p.set.compass)}</span>
              <span>${Math.round(p.duration_sec / 60)} ${i18n.t("astronomy.min")}</span>
              <span>${Math.round(p.culmination.elevation_deg)}°</span>
            </div>
          </li>`).join("")}</ul>`;
      }
      return `
        <div class="pwa-section">
          <div class="pwa-section-title">🛰 ${i18n.t("astronomy.issTitle")}</div>
          ${body}
        </div>`;
    }

    renderPlanets(planets) {
      const i18n = this.ctx.i18n;
      if (!planets) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.error")}</div></div>`;
      }
      if (!planets.length) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.planetsNone")}</div></div>`;
      }
      // La plus haute dans le ciel d'abord : la plus facile a reperer.
      // Highest in the sky first: the easiest one to spot.
      const sorted = [...planets].sort((a, b) => b.altitude - a.altitude);
      const rows = sorted.map((p) => `
        <li class="pwa-planet-item">
          <span class="pwa-planet-name">${i18n.t("astronomy.planet." + p.name.toLowerCase())}</span>
          <span class="pwa-planet-dir">${escapeHtml(p.compass)} · ${Math.round(p.altitude)}°</span>
          <span class="pwa-planet-mag">${p.magnitude.toFixed(1)}</span>
        </li>`).join("");
      return `
        <div class="pwa-section">
          <div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div>
          <ul class="pwa-planet-list">${rows}</ul>
        </div>`;
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("astronomy", AstronomyWidget);
})();
