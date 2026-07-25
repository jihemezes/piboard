/* PiBoard widget: avions en vue / planes overhead
   Avions en vol en temps reel autour d'une ville, via un reseau ADS-B
   communautaire gratuit et sans cle (adsb.lol ou adsb.fi, au choix dans
   les reglages -- memes donnees, format compatible ADSBExchange v2), sur
   le meme fond de carte Leaflet que les widgets trafic et radar.
   Live aircraft around a city, via a free, keyless community ADS-B
   network (adsb.lol or adsb.fi, chosen in settings -- same data, format
   compatible with ADSBExchange v2), on the same Leaflet base map as the
   traffic and radar widgets. */
(function () {
  "use strict";

  const SOURCES = {
    adsblol: (lat, lon, radiusNm) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`,
    // adsb.fi : l'ancien point d'acces "v2/lat/.../lon/.../dist/..." est
    // officiellement deprecie et renvoie un format DIFFERENT des autres
    // points d'acces v2 (sans le tableau "ac") -- source confirmee du
    // bug "aucun avion affiche, sans erreur" : la reponse etait bien
    // recue (200 OK), mais son format n'etait pas celui attendu.
    // "v3/lat/.../lon/.../dist/..." est l'equivalent actuel, au format
    // standard compatible ADSBExchange v2 (avec "ac").
    // adsb.fi: the old "v2/lat/.../lon/.../dist/..." endpoint is
    // officially deprecated and returns a DIFFERENT format from the
    // other v2 endpoints (no "ac" array) -- confirmed source of the
    // "no aircraft shown, no error" bug: the response WAS received
    // (200 OK), but its shape wasn't the one expected. "v3/lat/.../
    // lon/.../dist/..." is the current equivalent, in the standard
    // ADSBExchange-v2-compatible format (with "ac").
    adsbfi: (lat, lon, radiusNm) => `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/${radiusNm}`
  };
  const SOURCE_CREDIT = {
    adsblol: '<a href="https://adsb.lol" target="_blank">adsb.lol</a>',
    adsbfi: '<a href="https://adsb.fi" target="_blank">adsb.fi</a>'
  };
  const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

  // Distance orthodromique en milles nautiques (rayon terrestre moyen),
  // utilisee seulement si la source ne fournit pas deja "dst".
  // Great-circle distance in nautical miles (mean Earth radius), used
  // only when the source doesn't already provide "dst".
  function haversineNm(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Formatage altitude façon aviation : niveau de vol (FLxxx) au-dessus
  // de 10 000 ft, pieds en dessous, "Sol" si l'appareil est au sol.
  // Aviation-style altitude formatting: flight level (FLxxx) above
  // 10,000 ft, feet below that, "Ground" if the aircraft is on the
  // ground.
  function formatAlt(plane, i18n) {
    if (plane.onGround) return i18n.t("planes.ground");
    if (plane.alt === null || Number.isNaN(plane.alt)) return "—";
    if (plane.alt >= 10000) return "FL" + Math.round(plane.alt / 100);
    return Math.round(plane.alt).toLocaleString(i18n.t("clock.date.format")) + " ft";
  }

  function toPlane(ac) {
    // Tolere lat/lon en nombre OU en chaine numerique -- certaines
    // reponses serialisent ces champs differemment selon le point
    // d'acces ou la version de l'API.
    // Tolerates lat/lon as a number OR a numeric string -- some
    // responses serialize these fields differently depending on the
    // endpoint or API version.
    const lat = typeof ac.lat === "number" ? ac.lat : Number(ac.lat);
    const lon = typeof ac.lon === "number" ? ac.lon : Number(ac.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const onGround = ac.alt_baro === "ground";
    const alt = onGround ? null : Number(ac.alt_baro);
    const squawk = ac.squawk ? String(ac.squawk) : null;
    const emergency = (squawk && EMERGENCY_SQUAWKS.has(squawk)) || (ac.emergency && ac.emergency !== "none");
    return {
      hex: ac.hex,
      callsign: (ac.flight || ac.r || ac.hex || "?").trim(),
      // Indicatif de vol brut, distinct de l'affichage ci-dessus : sert a
      // la recherche du trajet (une immatriculation ou un hex ne
      // correspond a aucune route dans la base adsbdb, seul un vrai
      // indicatif de vol le peut).
      // Raw flight callsign, distinct from the display value above: used
      // for the route lookup (a registration or a hex won't match any
      // route in the adsbdb database, only a real flight callsign can).
      flight: ac.flight ? ac.flight.trim() : null,
      lat, lon,
      alt, onGround,
      track: Number.isFinite(Number(ac.track)) ? Number(ac.track) : 0,
      gs: Number.isFinite(Number(ac.gs)) ? Math.round(Number(ac.gs)) : null,
      dst: Number.isFinite(Number(ac.dst)) ? Number(ac.dst) : null,
      emergency: !!emergency
    };
  }

  // Couleur partagee entre l'icone et la trainee d'un avion.
  // Color shared between an aircraft's icon and its trail.
  function planeColor(plane) {
    return plane.emergency ? "#E5384B" : plane.onGround ? "#8A98B2" : "#4C8DFF";
  }

  class PlanesWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.map = null;
      this.layerGroup = null;
      this.coords = null;
      this.timer = null;
      this.trails = new Map(); // hex -> [[lat,lon], ...], historique recent / recent history
    }

    async init() {
      this.ctx.el.innerHTML = `
        <div class="pw-planes">
          <div class="pwp-map"></div>
          <div class="pwp-panel">
            <span class="pwp-count">${this.ctx.i18n.t("common.loading")}</span>
          </div>
        </div>`;
      this.mapEl = this.ctx.el.querySelector(".pwp-map");
      this.countEl = this.ctx.el.querySelector(".pwp-count");

      try {
        this.coords = await this.geocode(this.ctx.settings.city || "Paris");
      } catch (e) {
        console.warn("[piboard/planes]", e);
        this.mapEl.innerHTML = `<div class="pwp-err">${this.ctx.i18n.t("planes.geocodeError")}</div>`;
        return;
      }
      this.buildMap();
      await this.refresh();
      this.arm();
    }

    async geocode(city) {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city);
      const data = await fetch(url).then((r) => r.json());
      if (!data.results || !data.results.length) throw new Error("city not found: " + city);
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name };
    }

    // Fonds de carte identiques aux widgets trafic et radar, pour une
    // identite visuelle coherente entre les tuiles cartographiques.
    // Base maps identical to the traffic and radar widgets, for a
    // consistent visual identity between the map tiles.
    basemapUrl() {
      const BASEMAPS = { dark: "dark_all", light: "light_all", voyager: "rastertiles/voyager" };
      let key = this.ctx.settings.basemap || "voyager";
      if (key === "auto") key = document.body.dataset.theme === "light" ? "light" : "dark";
      const style = BASEMAPS[key] || BASEMAPS.voyager;
      return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
    }

    buildMap() {
      const s = this.ctx.settings;
      this.map = L.map(this.mapEl, {
        center: [this.coords.lat, this.coords.lon],
        zoom: Number(s.zoom) || 9,
        zoomControl: false,
        attributionControl: false
      });

      const credit = SOURCE_CREDIT[s.source] || SOURCE_CREDIT.adsblol;
      L.control.attribution({ position: "bottomright" })
        .addAttribution(`&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a> &middot; ${credit}`)
        .addTo(this.map);

      this.baseLayer = L.tileLayer(this.basemapUrl(), { subdomains: "abcd", maxZoom: 19 }).addTo(this.map);
      L.control.zoom({ position: "topright" }).addTo(this.map);
      this.layerGroup = L.layerGroup().addTo(this.map);

      // Marqueur du point central (ville), repere visuel pour situer les
      // avions. Center point marker (city), a visual reference to place
      // the aircraft.
      L.circleMarker([this.coords.lat, this.coords.lon], {
        radius: 4, color: "#fff", weight: 2, fillColor: "#4C8DFF", fillOpacity: 1
      }).addTo(this.map);

      requestAnimationFrame(() => { if (this.map) this.map.invalidateSize(); });
      if (this.observer) this.observer.disconnect();
      this.observer = new ResizeObserver(() => { if (this.map) this.map.invalidateSize(); });
      this.observer.observe(this.ctx.el);
    }

    async fetchPlanes() {
      const s = this.ctx.settings;
      const radius = Math.max(5, Math.min(250, Number(s.radius) || 25));
      const build = SOURCES[s.source] || SOURCES.adsblol;
      const url = build(this.coords.lat, this.coords.lon, radius);
      // Passe par le proxy generique du serveur (deja utilise par RSS et
      // Agenda) : ni adsb.lol ni adsb.fi ne semblent renvoyer les en-tetes
      // CORS necessaires a un fetch() direct depuis le navigateur -- sans
      // ce detour, la requete echoue silencieusement quelle que soit la
      // source choisie. Le parametre "_=" evite un resultat mis en cache
      // par le navigateur (memes raisons que RSS/Trafic).
      // Goes through the server's generic proxy (already used by RSS and
      // Calendar): neither adsb.lol nor adsb.fi appear to return the CORS
      // headers a direct browser fetch() needs -- without this detour,
      // the request silently fails regardless of the chosen source. The
      // "_=" parameter avoids a browser-cached result (same reasoning as
      // RSS/Traffic).
      const proxied = this.ctx.api.proxyUrl(url);
      const sep = proxied.includes("?") ? "&" : "?";
      const data = await fetch(proxied + sep + "_=" + Date.now(), { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("adsb " + r.status);
        return r.json();
      });
      // Signale explicitement un format de reponse inattendu (par ex. si
      // une source venait a changer son API) plutot que de retomber
      // silencieusement sur "0 avion" -- c'est exactement ce qui s'est
      // produit avec l'ancien point d'acces adsb.fi deprecie : la requete
      // reussissait (200 OK) mais la reponse n'avait pas de tableau "ac",
      // donnant 0 avion sans la moindre erreur visible.
      // Explicitly flags an unexpected response shape (e.g. if a source
      // were to change its API) rather than silently falling back to
      // "0 aircraft" -- this is exactly what happened with the old,
      // deprecated adsb.fi endpoint: the request succeeded (200 OK) but
      // the response had no "ac" array, silently yielding 0 aircraft
      // with no visible error at all.
      if (!data || !Array.isArray(data.ac)) {
        throw new Error("unexpected response shape (no 'ac' array)");
      }
      return data.ac;
    }

    arm() {
      clearInterval(this.timer);
      const seconds = Math.max(15, Number(this.ctx.settings.refresh) || 20);
      this.timer = setInterval(() => this.refresh(), seconds * 1000);
    }

    async refresh() {
      try {
        const raw = await this.fetchPlanes();
        let planes = raw.map(toPlane).filter(Boolean);
        planes.forEach((p) => {
          if (p.dst === null) p.dst = haversineNm(this.coords.lat, this.coords.lon, p.lat, p.lon);
        });
        planes.sort((a, b) => a.dst - b.dst);
        const max = Math.max(5, Math.min(200, Number(this.ctx.settings.maxPlanes) || 30));
        const shown = planes.slice(0, max);
        this.updateTrails(shown);
        this.updateMarkers(shown);
        this.updateCount(shown.length, planes.length);
      } catch (e) {
        console.warn("[piboard/planes]", e);
        if (this.countEl) this.countEl.textContent = this.ctx.i18n.t("planes.error");
      }
    }

    updateCount(shown, total) {
      if (!this.countEl) return;
      const label = this.ctx.i18n.t("planes.count").replace("{n}", total);
      this.countEl.textContent = total > shown
        ? `${label} (${this.ctx.i18n.t("planes.showingClosest").replace("{n}", shown)})`
        : label;
    }

    // Historique de position (en option, reglage "showTrails") : chaque
    // rafraichissement ajoute la position courante de chaque avion
    // affiche a son historique, plafonne pour ne pas accumuler
    // indefiniment. Les avions qui sortent du rayon/plafond affiche
    // perdent leur historique (pas de "fantome" pour un avion qu'on ne
    // suit plus). Position history (optional, "showTrails" setting):
    // every refresh appends each shown aircraft's current position to
    // its history, capped so it doesn't accumulate forever. Aircraft
    // that fall out of the radius/display cap lose their history (no
    // "ghost" trail for a plane we're no longer tracking).
    updateTrails(planes) {
      const seen = new Set();
      for (const p of planes) {
        seen.add(p.hex);
        const path = this.trails.get(p.hex) || [];
        path.push([p.lat, p.lon]);
        if (path.length > 15) path.shift();
        this.trails.set(p.hex, path);
      }
      for (const hex of [...this.trails.keys()]) {
        if (!seen.has(hex)) this.trails.delete(hex);
      }
    }

    // Icone rotative (silhouette d'avion, orientee selon le cap) + une
    // etiquette non tournee (indicatif + altitude), reconstruite a
    // chaque rafraichissement -- plus simple et tout aussi lisible qu'un
    // suivi de marqueur individuel, vu le rythme de rafraichissement
    // (secondes, pas millisecondes).
    // Rotating icon (plane silhouette, oriented by heading) + a
    // non-rotated label (callsign + altitude), rebuilt on every refresh
    // -- simpler and just as legible as tracking individual markers,
    // given the refresh cadence (seconds, not milliseconds).
    buildIcon(plane) {
      const color = planeColor(plane);
      const label = this.ctx.settings.showLabels !== false
        ? `<div class="pwp-label">${plane.callsign}<br>${formatAlt(plane, this.ctx.i18n)}</div>`
        : "";
      const html = `
        <div class="pwp-marker">
          <div class="pwp-glyph" style="transform:rotate(${plane.track}deg)">
            <svg viewBox="0 0 24 24" fill="${color}">
              <path d="M12 2 L14 9 L22 13 L14 14.5 L14 19 L17.5 21 L17.5 22.5 L12 21 L6.5 22.5 L6.5 21 L10 19 L10 14.5 L2 13 L10 9 Z"/>
            </svg>
          </div>
          ${label}
        </div>`;
      return L.divIcon({ html, className: "pwp-icon", iconSize: [90, 44], iconAnchor: [13, 13] });
    }

    updateMarkers(planes) {
      if (!this.layerGroup) return;
      this.layerGroup.clearLayers();
      const showTrails = this.ctx.settings.showTrails === true;
      for (const p of planes) {
        if (showTrails) {
          const path = this.trails.get(p.hex);
          if (path && path.length > 1) {
            // Fine ligne pointillee : discrete, ne doit pas dominer la
            // carte quand beaucoup d'avions sont affiches.
            // Thin dashed line: discreet, shouldn't dominate the map
            // when many aircraft are shown.
            L.polyline(path, {
              color: planeColor(p), weight: 1.5, opacity: 0.55, dashArray: "1,6", lineCap: "round"
            }).addTo(this.layerGroup);
          }
        }
        const marker = L.marker([p.lat, p.lon], { icon: this.buildIcon(p) });
        // Le clic sur un marqueur Leaflet (pas un bouton HTML pose
        // par-dessus la carte) est deja gere correctement au toucher par
        // Leaflet lui-meme -- pas besoin du correctif pointerup utilise
        // ailleurs dans ce widget pour les boutons de survol.
        // Clicking a Leaflet marker (not an HTML button laid over the
        // map) is already handled correctly on touch by Leaflet itself
        // -- no need for the pointerup fix used elsewhere in this
        // widget for the overlay buttons.
        marker.on("click", () => this.showRoute(p, marker));
        marker.addTo(this.layerGroup);
      }
    }

    /* Recherche le trajet (ville de depart/arrivee) d'un avion au clic,
       via adsbdb.com -- une base communautaire gratuite et sans cle qui
       associe indicatifs de vol et trajets. L'ADS-B lui-meme ne transmet
       jamais cette information (uniquement position/altitude/vitesse) :
       elle doit venir d'une source tierce qui croise l'indicatif avec
       une base de vols. Ne fonctionne donc que pour les vols commerciaux
       / regualiers dotes d'un indicatif reconnu -- l'aviation generale,
       prive ou une partie du militaire n'aura pas de resultat.
       Looks up an aircraft's route (departure/arrival city) on click, via
       adsbdb.com -- a free, keyless community database matching flight
       callsigns to routes. ADS-B itself never transmits this information
       (only position/altitude/speed): it has to come from a third-party
       source that cross-references the callsign against a flight
       database. Only works for commercial/scheduled flights with a
       recognized callsign -- general aviation, private, or some military
       flights will have no result. */
    async showRoute(plane, marker) {
      const i18n = this.ctx.i18n;
      const popup = L.popup({ closeButton: true, maxWidth: 230, className: "pwp-popup-wrap" })
        .setLatLng(marker.getLatLng())
        .setContent(this.routePopupHtml(plane, `<span class="pwp-popup-muted">${i18n.t("common.loading")}</span>`))
        .openOn(this.map);

      if (!plane.flight) {
        popup.setContent(this.routePopupHtml(plane, `<span class="pwp-popup-muted">${i18n.t("planes.noCallsign")}</span>`));
        return;
      }

      try {
        const url = `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(plane.flight)}`;
        const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => {
          if (!r.ok) throw new Error("adsbdb " + r.status);
          return r.json();
        });
        const route = data && data.response && data.response.flightroute;
        if (!route || !route.origin || !route.destination) {
          popup.setContent(this.routePopupHtml(plane, `<span class="pwp-popup-muted">${i18n.t("planes.noRoute")}</span>`));
          return;
        }
        const originName = route.origin.municipality || route.origin.name;
        const destName = route.destination.municipality || route.destination.name;
        const airline = route.airline && route.airline.name ? `<div class="pwp-popup-airline">${route.airline.name}</div>` : "";
        popup.setContent(this.routePopupHtml(plane, `
          ${airline}
          <div class="pwp-popup-route">
            <span>${originName}</span>
            <span class="pwp-popup-arrow">→</span>
            <span>${destName}</span>
          </div>`));
      } catch (e) {
        console.warn("[piboard/planes] route", e);
        popup.setContent(this.routePopupHtml(plane, `<span class="pwp-popup-muted">${i18n.t("planes.routeError")}</span>`));
      }
    }

    routePopupHtml(plane, bodyHtml) {
      return `<div class="pwp-popup"><b>${plane.callsign}</b>${bodyHtml ? `<div class="pwp-popup-body">${bodyHtml}</div>` : ""}</div>`;
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      const needsRebuild = ["city", "basemap"].some((k) => settings[k] !== old[k]);
      this.ctx.settings = settings;
      if (needsRebuild || !this.map) {
        if (this.map) { this.map.remove(); this.map = null; }
        clearInterval(this.timer);
        this.init();
        return;
      }
      this.map.setZoom(Number(settings.zoom) || 9);
      this.lastRefreshForced = true;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
      if (this.map) this.map.remove();
    }
  }

  window.PiBoard.registerWidget("planes", PlanesWidget);
})();
