/* PiBoard widget: radar meteo / weather radar
   Boucle radar de precipitations animee (2 dernieres heures), via l'API
   gratuite et sans cle Weather Maps de RainViewer, sur un fond de carte
   Leaflet identique a celui des widgets trafic et avions. Ville, zoom et
   fond de carte independants de la tuile Meteo.

   Note (juillet 2026) : RainViewer a definitivement retire les images de
   prevision ("nowcast") de son offre gratuite le 1er janvier 2026 (ainsi
   que l'imagerie satellite et les schemas de couleurs autres que
   "Universal Blue") -- seules les 2 dernieres heures observees restent
   disponibles sans cle. Un mode Prevision avait ete ajoute ici avant que
   ce changement ne soit remarque ; il a ete retire car il ne pouvait
   plus jamais fonctionner (bouton en permanence desactive).
   https://www.rainviewer.com/api/transition-faq.html

   Animated precipitation radar loop (last 2 hours), via RainViewer's
   free, keyless Weather Maps API, over the same Leaflet base map as the
   traffic and planes widgets. City, zoom and base map independent from
   the Weather tile.

   Note (July 2026): RainViewer permanently removed forecast ("nowcast")
   frames from its free tier on January 1, 2026 (along with satellite
   imagery and color schemes other than "Universal Blue") -- only the
   last 2 observed hours remain available without a key. A Forecast mode
   was added here before this change was noticed; it was removed since it
   could never work anymore (permanently disabled button).
   https://www.rainviewer.com/api/transition-faq.html */
(function () {
  "use strict";

  const API_URL = "https://api.rainviewer.com/public/weather-maps.json";

  // Repere pour la legende, d'apres l'echelle officielle "Universal Blue"
  // de RainViewer (seul schema disponible sur l'API gratuite -- c'est
  // celui utilise par l'URL des tuiles ci-dessous, suffixe "/2/1_1.png").
  // Simplifiee a 5 couleurs representatives pour un coup d'oeil rapide.
  // Reference for the legend, from RainViewer's official "Universal
  // Blue" scale (the only scheme available on the free API -- it's the
  // one used by the tile URL below, "/2/1_1.png" suffix). Simplified to
  // 5 representative colors for a quick glance.
  const LEGEND_COLORS = ["#7fbfff", "#005588", "#ffee00", "#ff4400", "#ffaaff"];

  /* Echelle de force du vent, calee sur les paliers de l'echelle de
     Beaufort (vitesse en km/h a 10 m du sol, comme la donnee renvoyee
     par Open-Meteo). Palette volontairement differente de celle de la
     pluie ci-dessus : les deux couches se superposent sur la meme carte,
     elles ne doivent pas pouvoir etre confondues.
     Wind strength scale, aligned with the Beaufort scale's thresholds
     (speed in km/h at 10 m above ground, as returned by Open-Meteo).
     Palette deliberately different from the rain one above: both layers
     overlay the same map, they must not be confusable. */
  const WIND_STEPS = [
    { max: 11, color: "#8FD3C1" }, // 0-2 Bft : calme a legere brise / calm to light breeze
    { max: 28, color: "#4CAF50" }, // 3-4 Bft : petite a jolie brise / gentle to moderate breeze
    { max: 49, color: "#F4C430" }, // 5-6 Bft : bonne a forte brise / fresh to strong breeze
    { max: 74, color: "#FF7A33" }, // 7-8 Bft : grand frais a coup de vent / near gale to gale
    { max: 102, color: "#E5384B" }, // 9-10 Bft : fort coup de vent a tempete / strong gale to storm
    { max: Infinity, color: "#8E24AA" } // 11+ Bft : violente tempete, ouragan / violent storm, hurricane
  ];
  const WIND_COLORS = WIND_STEPS.map((s) => s.color);
  function windColor(kmh) {
    const step = WIND_STEPS.find((s) => kmh <= s.max);
    return (step || WIND_STEPS[WIND_STEPS.length - 1]).color;
  }

  class RadarWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.map = null;
      this.coords = null;
      this.host = null;
      this.frames = [];
      this.layerCache = {};
      this.currentLayer = null;
      this.position = 0;
      this.playing = false;
      this.playTimer = null;
      this.loadingFrame = false;
      this.refreshTimer = null;
      this.windLayer = null;
      this.windMoveTimer = null;
    }

    async init() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const showLegend = s.showLegend !== false;
      const showWindLegend = s.showWind === true && s.showWindLegend !== false;
      this.ctx.el.innerHTML = `
        <div class="pw-radar">
          <div class="pwrd-map"></div>
          <div class="pwrd-legend" ${showLegend ? "" : "hidden"}>
            <div class="pwrd-legend-title">${i18n.t("radar.legend.rain")}</div>
            <div class="pwrd-legend-bar" style="background:linear-gradient(to right, ${LEGEND_COLORS.join(",")})"></div>
            <div class="pwrd-legend-labels">
              <span>${i18n.t("radar.legend.light")}</span>
              <span>${i18n.t("radar.legend.extreme")}</span>
            </div>
          </div>
          <div class="pwrd-legend pwrd-legend-wind" ${showWindLegend ? "" : "hidden"}>
            <div class="pwrd-legend-title">${i18n.t("radar.legend.wind")}</div>
            <div class="pwrd-legend-bar" style="background:linear-gradient(to right, ${WIND_COLORS.join(",")})"></div>
            <div class="pwrd-legend-labels">
              <span>${i18n.t("radar.legend.windCalm")}</span>
              <span>${i18n.t("radar.legend.windStorm")}</span>
            </div>
          </div>
          <div class="pwrd-panel">
            <span class="pwrd-time">${i18n.t("common.loading")}</span>
            <div class="pwrd-controls">
              <button type="button" class="pwrd-btn pwrd-prev">‹</button>
              <button type="button" class="pwrd-btn pwrd-play">▶</button>
              <button type="button" class="pwrd-btn pwrd-next">›</button>
            </div>
          </div>
        </div>`;
      this.mapEl = this.ctx.el.querySelector(".pwrd-map");
      this.timeEl = this.ctx.el.querySelector(".pwrd-time");
      this.playBtn = this.ctx.el.querySelector(".pwrd-play");
      this.legendEl = this.ctx.el.querySelector(".pwrd-legend");
      this.windLegendEl = this.ctx.el.querySelector(".pwrd-legend-wind");

      const on = (sel, fn) => this.ctx.el.querySelector(sel).addEventListener("pointerup", (e) => {
        // pointerup plutot que click : sur ce navigateur kiosque tactile,
        // le gestionnaire tactile de la carte Leaflet (qui couvre toute
        // la tuile) "consomme" la sequence touchstart/touchend avant
        // qu'un evenement "click" ne soit synthetise -- le bouton
        // semblait alors ne rien faire (a la souris, ca marchait,
        // d'ou le bug passe inapercu en test). Meme correctif que le
        // widget Trafic.
        // pointerup rather than click: on this touchscreen kiosk
        // browser, the Leaflet map's touch handler (which covers the
        // whole tile) "consumes" the touchstart/touchend sequence
        // before a "click" event gets synthesized -- the button then
        // appeared to do nothing (it worked with a mouse, which is why
        // the bug went unnoticed in testing). Same fix as the Traffic
        // widget.
        e.preventDefault();
        e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
        fn();
      });
      on(".pwrd-prev", () => { this.stop(); this.showFrame(this.position - 1); });
      on(".pwrd-next", () => { this.stop(); this.showFrame(this.position + 1); });
      on(".pwrd-play", () => this.playStop());

      try {
        this.coords = await this.geocode(this.ctx.settings.city || "Paris");
      } catch (e) {
        console.warn("[piboard/radar]", e);
        this.mapEl.innerHTML = `<div class="pwrd-err">${this.ctx.i18n.t("radar.geocodeError")}</div>`;
        return;
      }
      this.buildMap();
      await this.loadFrames();
      this.loadWind(); // en parallele : ne doit pas retarder l'affichage du radar / in parallel: mustn't delay the radar display
      this.arm();
    }

    /* Reutilise exactement le meme service de geocodage que les widgets
       meteo et trafic (gratuit, sans cle). Reuses the exact same
       geocoding service as the weather and traffic widgets (free,
       keyless). */
    async geocode(city) {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city);
      const data = await fetch(url).then((r) => r.json());
      if (!data.results || !data.results.length) throw new Error("city not found: " + city);
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name };
    }

    // Fonds de carte identiques aux widgets trafic et avions, pour une
    // identite visuelle coherente entre les tuiles cartographiques.
    // Base maps identical to the traffic and planes widgets, for a
    // consistent visual identity between the map tiles.
    basemapUrl() {
      const BASEMAPS = { dark: "dark_all", light: "light_all", voyager: "rastertiles/voyager" };
      let key = this.ctx.settings.basemap || "voyager";
      if (key === "auto") key = document.body.dataset.theme === "light" ? "light" : "dark";
      const style = BASEMAPS[key] || BASEMAPS.voyager;
      /* La cle CARTO est passee en parametre `key`. Sans elle, CARTO
         sert depuis peu des tuiles barrees d'un filigrane
         "API KEY REQUIRED" -- la carte fonctionne toujours, mais elle a
         l'air cassee. La cle est gratuite et se demande sur
         carto.com/basemaps/apikey ; elle se saisit UNE FOIS dans les
         reglages generaux, section "Cartes", et sert aux trois tuiles
         cartographiques.
         Elle n'est pas embarquee dans PiBoard : CARTO delivre des cles
         par client, a ne pas partager entre projets sans lien.
         The CARTO key is passed as a `key` parameter. Without it, CARTO
         has recently begun serving tiles stamped with an
         "API KEY REQUIRED" watermark -- the map still works, but it
         looks broken. The key is free, requested at
         carto.com/basemaps/apikey; it is typed ONCE in the global
         settings, "Maps" section, and serves all three map tiles.
         It is not shipped inside PiBoard: CARTO issues per-customer
         keys, not to be shared across unrelated projects. */
      const apiKey = (this.ctx.api && this.ctx.api.cartoKey) ? this.ctx.api.cartoKey() : "";
      const suffix = apiKey ? "?key=" + encodeURIComponent(apiKey) : "";
      return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png` + suffix;
    }

    buildMap() {
      const s = this.ctx.settings;
      this.map = L.map(this.mapEl, {
        center: [this.coords.lat, this.coords.lon],
        zoom: Number(s.zoom) || 6,
        zoomControl: false,
        attributionControl: false
      });

      // Attribution "Weather data by RainViewer" avec lien vers
      // rainviewer.com : obligatoire selon les conditions d'usage
      // gratuites de RainViewer, en plus d'OpenStreetMap/CARTO pour le
      // fond de carte et de Leaflet (prefixe par defaut, conserve).
      // "Weather data by RainViewer" attribution with a link to
      // rainviewer.com: mandatory under RainViewer's free terms of use,
      // in addition to OpenStreetMap/CARTO for the base map and Leaflet
      // (default prefix, kept).
      L.control.attribution({ position: "bottomright" })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a> &middot; <a href="https://www.rainviewer.com" target="_blank">Weather data by RainViewer</a>')
        .addTo(this.map);

      this.baseLayer = L.tileLayer(this.basemapUrl(), { subdomains: "abcd", maxZoom: 19 }).addTo(this.map);
      L.control.zoom({ position: "topright" }).addTo(this.map);

      // Met la lecture en pause pendant qu'on zoome ou qu'on deplace la
      // carte : au-dela du correctif ci-dessus (once() plutot que on()),
      // regarder le radar changer d'image PENDANT qu'on essaie de zoomer
      // sur une zone precise est de toute facon plus genant qu'utile.
      // L'utilisateur relance la lecture au besoin avec le bouton.
      // Pauses playback while zooming or panning the map: beyond the fix
      // above (once() rather than on()), watching the radar change
      // frames WHILE trying to zoom into a specific area is more
      // distracting than useful anyway. The user resumes playback with
      // the button if they want to.
      this.map.on("zoomstart movestart", () => this.stop());

      /* La couche vent est recalculee a chaque changement de vue : la
         grille de fleches est construite a partir des limites affichees,
         donc zoomer resserre naturellement la grille sur la zone
         regardee (c'est le comportement attendu -- des fleches figees
         sur une zone qu'on ne regarde plus n'auraient aucun interet).
         Attendu 700 ms apres la fin du geste pour ne pas declencher un
         appel a chaque cran de zoom intermediaire.
         The wind layer is recomputed on every view change: the arrow
         grid is built from the displayed bounds, so zooming in naturally
         tightens the grid onto the area being looked at (that's the
         expected behaviour -- arrows frozen on an area no longer in view
         would be useless). Waits 700ms after the gesture ends so an
         intermediate zoom step doesn't fire its own request. */
      this.windLayer = L.layerGroup().addTo(this.map);
      this.map.on("moveend zoomend", () => {
        clearTimeout(this.windMoveTimer);
        this.windMoveTimer = setTimeout(() => this.loadWind(), 700);
      });

      // Piege classique de Leaflet : conteneur pas encore a sa taille
      // finale (mise en page Gridstack pas totalement retombee).
      // Classic Leaflet pitfall: container not at its final size yet
      // (Gridstack layout not fully settled).
      requestAnimationFrame(() => { if (this.map) this.map.invalidateSize(); });
      if (this.observer) this.observer.disconnect();
      this.observer = new ResizeObserver(() => { if (this.map) this.map.invalidateSize(); });
      this.observer.observe(this.ctx.el);
    }

    /* Grille de fleches de vent couvrant la zone affichee. Toutes les
       positions partent en UNE seule requete (Open-Meteo accepte des
       listes de coordonnees separees par des virgules) plutot qu'en une
       requete par point : indispensable pour rester raisonnable vis-a-vis
       du service gratuit.
       Convention meteorologique importante : "wind_direction_10m" est la
       direction d'ou vient le vent. La fleche, elle, pointe vers ou il
       va -- c'est ce qu'on attend en regardant une carte -- d'ou le +180.
       Grid of wind arrows covering the displayed area. Every position is
       fetched in ONE request (Open-Meteo accepts comma-separated
       coordinate lists) rather than one request per point: essential to
       stay reasonable towards the free service.
       Important meteorological convention: "wind_direction_10m" is the
       direction the wind comes FROM. The arrow points where it's going
       TO -- what you expect when looking at a map -- hence the +180. */
    windGridSize() {
      const DENSITIES = { low: 6, medium: 12, high: 24 };
      const target = DENSITIES[this.ctx.settings.windDensity] || DENSITIES.medium;
      const w = this.mapEl ? this.mapEl.clientWidth || 1 : 1;
      const h = this.mapEl ? this.mapEl.clientHeight || 1 : 1;
      // Repartit le nombre de points voulu selon la forme de la tuile,
      // pour des fleches a peu pres regulierement espacees plutot
      // qu'ecrasees sur une tuile large ou etroite.
      // Spreads the desired point count according to the tile's shape,
      // for roughly evenly spaced arrows rather than squashed ones on a
      // wide or narrow tile.
      const cols = Math.max(2, Math.min(8, Math.round(Math.sqrt(target * (w / h)))));
      const rows = Math.max(2, Math.min(8, Math.ceil(target / cols)));
      return { cols, rows };
    }

    async loadWind() {
      if (!this.map || !this.windLayer) return;
      if (this.ctx.settings.showWind !== true) { this.windLayer.clearLayers(); return; }
      const { cols, rows } = this.windGridSize();
      const b = this.map.getBounds();
      const latSpan = b.getNorth() - b.getSouth();
      const lonSpan = b.getEast() - b.getWest();
      const lats = [];
      const lons = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Centre de chaque cellule, pour que les fleches ne collent ni
          // aux bords ni aux coins de la carte.
          // Center of each cell, so arrows sit neither on the edges nor
          // in the corners of the map.
          lats.push((b.getSouth() + latSpan * (r + 0.5) / rows).toFixed(4));
          lons.push((b.getWest() + lonSpan * (c + 0.5) / cols).toFixed(4));
        }
      }
      try {
        const url = "https://api.open-meteo.com/v1/forecast"
          + `?latitude=${lats.join(",")}&longitude=${lons.join(",")}`
          + "&current=wind_speed_10m,wind_direction_10m&timezone=auto";
        const data = await fetch(url).then((r) => {
          if (!r.ok) throw new Error("open-meteo " + r.status);
          return r.json();
        });
        // Reponse : un tableau en multi-coordonnees, un objet simple si
        // une seule position -- normalise pour traiter les deux.
        // Response: an array for multiple coordinates, a plain object for
        // a single position -- normalized to handle both.
        const list = Array.isArray(data) ? data : [data];
        this.renderWind(list);
      } catch (e) {
        console.warn("[piboard/radar] wind", e);
        this.windLayer.clearLayers();
      }
    }

    renderWind(list) {
      if (!this.windLayer) return;
      this.windLayer.clearLayers();
      const showLabels = this.ctx.settings.showWindLabels === true;
      for (const p of list) {
        const cur = p && p.current;
        if (!cur || !Number.isFinite(Number(cur.wind_speed_10m))) continue;
        const speed = Math.round(Number(cur.wind_speed_10m));
        const from = Number(cur.wind_direction_10m) || 0;
        const color = windColor(speed);
        const html = `
          <div class="pwrd-wind">
            <div class="pwrd-wind-arrow" style="transform:rotate(${(from + 180) % 360}deg)">
              <svg viewBox="0 0 24 24" fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="1">
                <path d="M12 2 L18 20 L12 16 L6 20 Z"/>
              </svg>
            </div>
            ${showLabels ? `<div class="pwrd-wind-label">${speed}</div>` : ""}
          </div>`;
        L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({ html, className: "pwrd-wind-icon", iconSize: [30, 30], iconAnchor: [15, 15] }),
          interactive: false // purement informatif : ne doit pas intercepter les gestes sur la carte / purely informative: mustn't intercept map gestures
        }).addTo(this.windLayer);
      }
    }

    async loadFrames() {
      try {
        const data = await fetch(API_URL).then((r) => r.json());
        this.host = data.host;
        // Uniquement les images passees : RainViewer a retire le
        // "nowcast" (prevision) de son offre gratuite le 1er janvier
        // 2026, voir la note en tete de fichier.
        // Past frames only: RainViewer removed "nowcast" (forecast)
        // frames from its free tier on January 1, 2026, see the note at
        // the top of this file.
        const past = (data.radar && data.radar.past) || [];
        if (!past.length) throw new Error("no radar frames");
        this.clearLayerCache();
        this.frames = past;
        this.showFrame(this.frames.length - 1); // dernier releve observe / latest observed frame
        if (this.ctx.settings.autoplay !== false) this.play();
      } catch (e) {
        console.warn("[piboard/radar]", e);
        if (this.timeEl) this.timeEl.textContent = this.ctx.i18n.t("radar.error");
      }
    }

    // 512px sur les ecrans haute densite pour un rendu net, 256px sinon.
    // 512px on high-density screens for a crisp render, 256px otherwise.
    tileSize() { return (window.devicePixelRatio || 1) >= 2 ? 512 : 256; }

    targetOpacity() {
      return Math.max(0.2, Math.min(1, (Number(this.ctx.settings.opacity) || 75) / 100));
    }

    createRadarLayer(frame) {
      return L.tileLayer(`${this.host}${frame.path}/${this.tileSize()}/{z}/{x}/{y}/2/1_1.png`, {
        tileSize: 256,
        opacity: 0.001, // monte progressivement au chargement, voir showFrame() / ramped up on load, see showFrame()
        maxNativeZoom: 7,
        maxZoom: 19
      });
    }

    wrapPosition(p) {
      const n = this.frames.length;
      if (!n) return 0;
      return ((p % n) + n) % n;
    }

    clearLayerCache() {
      this.stop();
      for (const pos in this.layerCache) {
        if (this.map) this.map.removeLayer(this.layerCache[pos]);
      }
      this.layerCache = {};
      this.currentLayer = null;
    }

    // Precharge et met en cache chaque calque de la boucle : une fois
    // visitee, une image reapparait instantanement (juste un changement
    // d'opacite), l'animation reste fluide.
    // Preloads and caches each loop frame: once visited, a frame
    // reappears instantly (just an opacity change), keeping the
    // animation smooth.
    showFrame(position) {
      if (this.loadingFrame || !this.frames.length || !this.map) return;
      position = this.wrapPosition(position);
      const frame = this.frames[position];
      this.updateTimestamp(frame);
      const oldLayer = this.currentLayer;
      const opacity = this.targetOpacity();

      if (this.layerCache[position]) {
        if (oldLayer) oldLayer.setOpacity(0);
        this.layerCache[position].setOpacity(opacity);
        this.currentLayer = this.layerCache[position];
        this.position = position;
        if (this.playing) this.playTimer = setTimeout(() => this.play(), this.animDelay());
        return;
      }

      this.loadingFrame = true;
      const layer = this.createRadarLayer(frame);
      // once() et non on() : GridLayer emet "load" a CHAQUE rechargement
      // de ses tuiles, pas seulement au premier -- y compris apres un
      // zoom ou un deplacement de la carte. Comme les calques en cache
      // restent tous montes en permanence (juste rendus invisibles via
      // l'opacite), un simple on() laissait cet ecouteur se redeclencher
      // a chaque zoom pour CHAQUE calque en cache, empilant autant de
      // planifications concurrentes de la boucle de lecture -- d'ou une
      // animation qui s'emballait des qu'on zoomait/dezoomait.
      // once(), not on(): GridLayer fires "load" on EVERY tile reload,
      // not just the first one -- including after a map zoom or pan.
      // Since cached layers all stay permanently mounted (just made
      // invisible via opacity), a plain on() let this listener refire on
      // every zoom for EVERY cached layer, stacking that many concurrent
      // playback-loop schedulings -- which is why the animation would go
      // haywire as soon as you zoomed in or out.
      layer.once("load", () => {
        layer.setOpacity(opacity);
        if (oldLayer) oldLayer.setOpacity(0);
        this.layerCache[position] = layer;
        this.currentLayer = layer;
        this.position = position;
        this.loadingFrame = false;
        if (this.playing) this.playTimer = setTimeout(() => this.play(), this.animDelay());
      });
      layer.addTo(this.map);
    }

    animDelay() {
      return Math.max(200, Math.min(2000, Number(this.ctx.settings.animationSpeed) || 500));
    }

    updateTimestamp(frame) {
      if (!this.timeEl) return;
      const locale = this.ctx.i18n.t("clock.date.format");
      this.timeEl.textContent = new Date(frame.time * 1000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }

    stop() {
      if (this.playTimer) { clearTimeout(this.playTimer); this.playTimer = null; }
      const was = this.playing;
      this.playing = false;
      if (this.playBtn) this.playBtn.textContent = "▶";
      return was;
    }

    play() {
      this.playing = true;
      if (this.playBtn) this.playBtn.textContent = "⏸";
      this.showFrame(this.position + 1);
    }

    playStop() { if (!this.stop()) this.play(); }

    arm() {
      clearInterval(this.refreshTimer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 10);
      this.refreshTimer = setInterval(() => {
        this.loadFrames();
        this.loadWind();
      }, minutes * 60000);
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      // Ces reglages changent la nature meme de la carte (position,
      // fond) : reconstruite pour les reprendre, comme le widget trafic.
      // These settings change the very nature of the map (position,
      // base): rebuilt to pick them up, like the traffic widget.
      const needsRebuild = ["city", "basemap"].some((k) => settings[k] !== old[k]);
      this.ctx.settings = settings;
      if (needsRebuild || !this.map) {
        if (this.map) { this.map.remove(); this.map = null; }
        clearInterval(this.refreshTimer);
        this.init();
        return;
      }
      this.map.setZoom(Number(settings.zoom) || 6);
      if (this.currentLayer) this.currentLayer.setOpacity(this.targetOpacity());
      if (this.legendEl) this.legendEl.hidden = settings.showLegend === false;
      if (this.windLegendEl) {
        this.windLegendEl.hidden = !(settings.showWind === true && settings.showWindLegend !== false);
      }
      this.loadWind(); // reprend showWind / densite / etiquettes / picks up showWind / density / labels
      this.arm();
    }

    onLangChanged() {
      if (this.frames.length) this.updateTimestamp(this.frames[this.position]);
    }

    destroy() {
      this.stop();
      clearInterval(this.refreshTimer);
      clearTimeout(this.windMoveTimer);
      if (this.observer) this.observer.disconnect();
      if (this.map) this.map.remove();
    }
  }

  window.PiBoard.registerWidget("radar", RadarWidget);
})();
