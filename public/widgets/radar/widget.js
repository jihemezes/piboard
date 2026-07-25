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
    }

    async init() {
      const i18n = this.ctx.i18n;
      const showLegend = this.ctx.settings.showLegend !== false;
      this.ctx.el.innerHTML = `
        <div class="pw-radar">
          <div class="pwrd-map"></div>
          <div class="pwrd-legend" ${showLegend ? "" : "hidden"}>
            <div class="pwrd-legend-bar" style="background:linear-gradient(to right, ${LEGEND_COLORS.join(",")})"></div>
            <div class="pwrd-legend-labels">
              <span>${i18n.t("radar.legend.light")}</span>
              <span>${i18n.t("radar.legend.extreme")}</span>
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
      return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
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

      // Piege classique de Leaflet : conteneur pas encore a sa taille
      // finale (mise en page Gridstack pas totalement retombee).
      // Classic Leaflet pitfall: container not at its final size yet
      // (Gridstack layout not fully settled).
      requestAnimationFrame(() => { if (this.map) this.map.invalidateSize(); });
      if (this.observer) this.observer.disconnect();
      this.observer = new ResizeObserver(() => { if (this.map) this.map.invalidateSize(); });
      this.observer.observe(this.ctx.el);
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
      layer.on("load", () => {
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
      this.refreshTimer = setInterval(() => this.loadFrames(), minutes * 60000);
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
      this.arm();
    }

    onLangChanged() {
      if (this.frames.length) this.updateTimestamp(this.frames[this.position]);
    }

    destroy() {
      this.stop();
      clearInterval(this.refreshTimer);
      if (this.observer) this.observer.disconnect();
      if (this.map) this.map.remove();
    }
  }

  window.PiBoard.registerWidget("radar", RadarWidget);
})();
