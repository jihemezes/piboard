/* PiBoard widget: traffic / carte de trafic
   Carte Leaflet avec flux de circulation et incidents TomTom, et un
   calendrier de rafraichissement pense pour rester dans le quota gratuit
   (2500 requetes/jour) : rapide pendant les plages actives (matin/soir),
   plus lent le reste du temps, en pause la nuit. Un bouton permet de
   forcer un rafraichissement rapide temporaire, independamment du
   calendrier. La vue (centre/zoom) est verrouillee : pas de pan/zoom
   utilisateur, pour une tuile de kiosque stable.
   Leaflet map with TomTom traffic flow and incidents, with a refresh
   schedule designed to stay within the free quota (2500 requests/day):
   fast during active windows (morning/evening commute), slower
   otherwise, paused overnight. A button lets you force a temporary fast
   refresh, independently of the schedule. The view (center/zoom) is
   locked: no user pan/zoom, for a stable kiosk tile. */
(function () {
  "use strict";

  const BOOST_REFRESH_MINUTES = 1; // cadence dediee et fixe du boost / fixed, dedicated boost cadence

  /* ---------- Calendrier : fonctions pures, testables sans DOM ----------
     Schedule: pure functions, testable without a DOM. ---------- */

  function toMinutes(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function nowMinutes(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  /* Vrai si "t" (minutes depuis minuit) tombe dans [start, start+dur),
     avec prise en charge du chevauchement de minuit.
     True if "t" (minutes since midnight) falls in [start, start+dur),
     handling midnight wraparound. */
  function inWindow(t, startStr, durMin) {
    const start = toMinutes(startStr);
    if (start == null || !durMin) return false;
    const end = start + durMin;
    if (end <= 1440) return t >= start && t < end;
    return t >= start || t < (end - 1440);
  }

  /* Vrai si "t" tombe dans [start, end), avec chevauchement de minuit
     (ex. 22h-5h). start === end desactive la plage.
     True if "t" falls in [start, end), handling midnight wraparound
     (e.g. 22:00-05:00). start === end disables the period. */
  function inQuiet(t, startStr, endStr) {
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    if (start == null || end == null || start === end) return false;
    if (start < end) return t >= start && t < end;
    return t >= start || t < end;
  }

  /* Determine la phase actuelle et la cadence de rafraichissement (en
     minutes ; null = aucun rafraichissement). Le boost, s'il est actif,
     prime sur tout le reste. Determines the current phase and refresh
     cadence (in minutes; null = no refresh). The boost, if active,
     overrides everything else. */
  function computePhase(date, s, boostUntil) {
    if (boostUntil && date.getTime() < boostUntil) {
      return { phase: "boost", refreshMinutes: BOOST_REFRESH_MINUTES };
    }
    const t = nowMinutes(date);
    if (inQuiet(t, s.quietStart, s.quietEnd)) {
      return { phase: "quiet", refreshMinutes: null };
    }
    if (inWindow(t, s.morningStart, Number(s.morningDurationMinutes) || 0)
      || inWindow(t, s.afternoonStart, Number(s.afternoonDurationMinutes) || 0)) {
      return { phase: "active", refreshMinutes: Math.max(1, Number(s.activeRefreshMinutes) || 2) };
    }
    return { phase: "normal", refreshMinutes: Math.max(1, Number(s.normalRefreshMinutes) || 15) };
  }

  /* Couleurs des traces de bouchons, reprises de l'app Umbrel de
     reference, selon la gravite TomTom (magnitudeOfDelay) : 0 inconnu,
     1 mineur, 2 modere, 3 majeur, 4 route coupee. Le jaune sert aussi de
     repli neutre -- jamais le rouge par defaut, qui exagererait un bouchon
     dont la gravite n'est simplement pas connue.
     Jam trace colors, taken from the reference Umbrel app, by TomTom
     severity (magnitudeOfDelay): 0 unknown, 1 minor, 2 moderate, 3 major,
     4 road closed. Yellow doubles as the neutral fallback -- never red by
     default, which would overstate a jam whose severity is simply
     unknown. */
  const JAM_COLORS = {
    0: "#f5c542",  // inconnu -> jaune / unknown -> yellow
    1: "#f5c542",  // mineur  -> jaune / minor   -> yellow
    2: "#f5a623",  // modere  -> orange / moderate -> orange
    3: "#e2493b",  // majeur  -> rouge / major   -> red
    4: "#8b1e14"   // route coupee -> rouge fonce / road closed -> dark red
  };
  const JAM_COLOR_DEFAULT = "#f5c542";

  class TrafficWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.map = null;
      this.baseLayer = null;
      this.flowLayer = null;
      this.incidentTileLayer = null;
      this.incidentLayer = null;
      this.jamsLayer = null;
      this.coords = null;
      this.scheduleTimer = null;
      this.lastRefreshAt = 0;
      this.refreshing = false;
      this.boostUntil = 0;
      this.pendingTileCount = 0;
      this.quotaCount = 0;
      this.paused = false;
      this.uiTimer = null;
      // Expose pour les tests (aucune donnee sensible) / exposed for tests (no sensitive data)
      this._computePhase = computePhase;
    }

    async init() {
      this.refreshing = false;
      this.ctx.el.innerHTML = `
        <div class="pw-traffic">
          <div class="pwt-map"></div>
          <div class="pwt-legend">
            <div class="pwt-legend-row">
              <span class="pwt-legend-item"><i class="pwt-swatch pwt-sw-free"></i>${this.ctx.i18n.t("traffic.legendFree")}</span>
              <span class="pwt-legend-item"><i class="pwt-swatch pwt-sw-slow"></i>${this.ctx.i18n.t("traffic.legendSlow")}</span>
              <span class="pwt-legend-item"><i class="pwt-swatch pwt-sw-heavy"></i>${this.ctx.i18n.t("traffic.legendHeavy")}</span>
              <span class="pwt-legend-item"><i class="pwt-swatch pwt-sw-jam"></i>${this.ctx.i18n.t("traffic.legendJam")}</span>
              <span class="pwt-legend-item"><i class="pwt-incident-icon pwt-sev-3"></i>${this.ctx.i18n.t("traffic.legendIncident")}</span>
            </div>
            <div class="pwt-refresh-row">
              <span class="pwt-refresh-countdown"></span>
              <button type="button" class="pwt-pause-btn"></button>
            </div>
          </div>
          <div class="pwt-badge-row">
            <span class="pwt-badge pwt-quota" hidden></span>
            <span class="pwt-badge pwt-stale" hidden>${this.ctx.i18n.t("traffic.stale")}</span>
          </div>
          <div class="pwt-boost">
            <button type="button" class="pwt-boost-trigger">${this.ctx.i18n.t("traffic.boostPick")}</button>
            <ul class="pwt-boost-menu" hidden>
              <li data-min="5"><button type="button">5 min</button></li>
              <li data-min="10"><button type="button">10 min</button></li>
              <li data-min="15"><button type="button">15 min</button></li>
              <li data-min="30"><button type="button">30 min</button></li>
              <li data-min="60"><button type="button">60 min</button></li>
            </ul>
          </div>
        </div>`;
      this.mapEl = this.ctx.el.querySelector(".pwt-map");
      this.quotaBadge = this.ctx.el.querySelector(".pwt-quota");
      this.staleBadge = this.ctx.el.querySelector(".pwt-stale");
      this.refreshCountdownEl = this.ctx.el.querySelector(".pwt-refresh-countdown");
      this.pauseBtn = this.ctx.el.querySelector(".pwt-pause-btn");
      this.pauseBtn.textContent = this.ctx.i18n.t("traffic.pause");
      // pointerup (souris + tactile unifies) plutot que click : meme
      // raison que le menu ci-dessous. pointerup rather than click (mouse
      // + touch unified): same reason as the menu below.
      this.pauseBtn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.paused = !this.paused;
        this.pauseBtn.textContent = this.paused ? this.ctx.i18n.t("traffic.resume") : this.ctx.i18n.t("traffic.pause");
        this.pauseBtn.classList.toggle("pwt-paused", this.paused);
        this.updateCartouche();
      });
      this.uiTimer = setInterval(() => this.updateCartouche(), 1000);

      /* Menu "Rafraichir maintenant" maison, a la place d'un <select>
         natif : sur ce navigateur kiosque tactile (Chromium/labwc, sans
         gestionnaire de fenetres classique), le popup natif d'un <select>
         se comportait de facon peu fiable au toucher -- agrandir sa
         police/son remplissage n'y changeait rien, le probleme etait le
         controle natif lui-meme, pas sa taille. Ici, le declencheur et
         chaque ligne du menu sont de vrais <button>, donc toute leur
         surface est cliquable/tapable de facon fiable et previsible.
         Home-made "Refresh now" menu, replacing a native <select>: on
         this touchscreen kiosk browser (Chromium/labwc, no classic window
         manager), a native <select>'s popup behaved unreliably to touch --
         enlarging its font/padding didn't help, the native control itself
         was the problem, not its size. Here, the trigger and every menu
         row are real <button> elements, so their entire surface is
         reliably tappable. */
      this.boostTrigger = this.ctx.el.querySelector(".pwt-boost-trigger");
      this.boostMenu = this.ctx.el.querySelector(".pwt-boost-menu");

      /* On ecoute "pointerup" plutot que "click" : sur un navigateur
         tactile (Chromium kiosque), l'evenement "click" synthetise a
         partir d'un tap peut etre retarde, voire jamais emis si un
         gestionnaire tactile en amont (ici celui de la carte Leaflet, qui
         couvre toute la surface) a deja "consomme" la sequence
         touchstart/touchend. "pointerup" est emis directement par le
         geste physique, unifie souris + doigt + stylet, et arrive avant
         cette synthese -- c'est LA correction du "rien ne se passe au
         tap" (la souris, elle, produisait bien un click, d'ou le fait que
         ca marchait a la souris).
         We listen to "pointerup" rather than "click": on a touchscreen
         browser (kiosk Chromium), the "click" synthesized from a tap can
         be delayed, or never emitted if an upstream touch handler (here
         the Leaflet map's, which covers the whole surface) already
         "consumed" the touchstart/touchend sequence. "pointerup" is
         emitted directly by the physical gesture, unifies mouse + finger
         + stylus, and fires before that synthesis -- this is THE fix for
         "nothing happens on tap" (the mouse did produce a click, which is
         why it worked with a mouse). */
      const onTrigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.boostMenu.hidden = !this.boostMenu.hidden;
      };
      this.boostTrigger.addEventListener("pointerup", onTrigger);

      this.boostMenu.querySelectorAll("li").forEach((li) => {
        // Le bouton occupe toute la ligne (voir CSS) : la ligne entiere
        // est donc activable, pas seulement le texte.
        // The button fills the entire row (see CSS): the whole row is
        // therefore actionable, not just the text.
        li.querySelector("button").addEventListener("pointerup", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.boostMenu.hidden = true;
          const minutes = Number(li.dataset.min);
          if (minutes > 0) this.startBoost(minutes);
        });
      });

      // Tap/clic en dehors du menu : le referme. Meme raisonnement
      // pointer plutot que click. Reference nommee pour pouvoir retirer
      // ce listener dans destroy() -- sinon, chaque reconstruction de la
      // tuile (changement de reglage) en accumulerait un nouveau sur
      // document. Le stopPropagation() sur le declencheur ci-dessus
      // empeche ce handler de refermer le menu dans la foulee de son
      // ouverture.
      // Tap/click outside the menu: closes it. Same pointer-not-click
      // reasoning. Named reference so it can be removed in destroy() --
      // otherwise, every tile rebuild (settings change) would pile up
      // another one on document. The stopPropagation() on the trigger
      // above prevents this handler from closing the menu right as it
      // opens.
      if (this.closeBoostMenu) document.removeEventListener("pointerup", this.closeBoostMenu);
      this.closeBoostMenu = () => { this.boostMenu.hidden = true; };
      document.addEventListener("pointerup", this.closeBoostMenu);

      const s = this.ctx.settings;
      if (!s.apiKey) {
        this.mapEl.parentElement.innerHTML += `<div class="pwt-err">${this.ctx.i18n.t("traffic.noKey")}</div>`;
        return;
      }

      try {
        this.coords = await this.geocode(s.city || "Toulouse");
      } catch (e) {
        console.warn("[piboard/traffic]", e);
        this.ctx.el.querySelector(".pw-traffic").innerHTML += `<div class="pwt-err">${this.ctx.i18n.t("traffic.geocodeError")}</div>`;
        return;
      }

      try {
        this.buildMap();
      } catch (e) {
        console.error("[piboard/traffic] buildMap failed:", e);
        const detail = e && e.message ? " (" + e.message + ")" : "";
        this.ctx.el.querySelector(".pw-traffic").innerHTML += `<div class="pwt-err">${this.ctx.i18n.t("traffic.mapError")}${detail}</div>`;
        return;
      }
      await this.refreshQuotaDisplay();
      this.tick();
      this.scheduleTimer = setInterval(() => this.tick(), 15000);
    }

    async geocode(city) {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city);
      const data = await fetch(url).then((r) => r.json());
      if (!data.results || !data.results.length) throw new Error("city not found: " + city);
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name };
    }

    /* Fonds de carte identiques a ceux de l'app Umbrel de reference :
       des fonds COLORES, avec les noms de rues, et non les variantes
       "nolabels" (grises, sans etiquettes) utilisees jusqu'ici.
       Base maps identical to the reference Umbrel app: COLORED base maps,
       with street names, rather than the "nolabels" variants (gray, no
       labels) used until now. */
    basemapUrl() {
      const BASEMAPS = {
        dark: "dark_all",
        light: "light_all",
        voyager: "rastertiles/voyager"
      };
      let key = this.ctx.settings.basemap || "voyager";
      if (key === "auto") key = document.body.dataset.theme === "light" ? "light" : "dark";
      const style = BASEMAPS[key] || BASEMAPS.voyager;
      return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
    }

    buildMap() {
      const s = this.ctx.settings;
      this.map = L.map(this.mapEl, {
        center: [this.coords.lat, this.coords.lon],
        zoom: Number(s.zoom) || 13,
        zoomControl: false,
        attributionControl: false
      });

      // Attribution complete, dans le meme esprit que l'app Umbrel :
      // "Leaflet" y figure (prefixe par defaut de Leaflet, exige par sa
      // licence et volontairement conserve), en plus d'OpenStreetMap,
      // CARTO et TomTom.
      // Full attribution, in the same spirit as the Umbrel app: "Leaflet"
      // appears there (Leaflet's default prefix, required by its license
      // and intentionally kept), alongside OpenStreetMap, CARTO and
      // TomTom.
      L.control.attribution({ position: "bottomright" })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a> &middot; Trafic &copy; TomTom')
        .addTo(this.map);

      this.baseLayer = L.tileLayer(this.basemapUrl(), {
        subdomains: "abcd", maxZoom: 19
      }).addTo(this.map);

      // Couche de flux et couche d'incidents : construites ici, mais PAS
      // ajoutees a la carte tout de suite -- Leaflet chargerait les tuiles
      // des l'attachement, ce qui court-circuiterait le calendrier (meme
      // en plage silencieuse). C'est refreshData() qui les ajoute, au
      // moment du tout premier rafraichissement autorise.
      // Flow layer and incident layer: built here, but NOT added to the
      // map right away -- Leaflet would load tiles as soon as they're
      // attached, bypassing the schedule (even during the quiet period).
      // refreshData() adds them, at the very first allowed refresh.
      if (s.showFlow !== false) this.flowLayer = this.buildFlowLayer();
      if (s.showIncidents !== false) this.incidentTileLayer = this.buildIncidentTileLayer();

      // Tracés de bouchons cliquables (retard estime), au-dessus du flux.
      // Clickable jam traces (estimated delay), above the flow.
      this.jamsLayer = L.layerGroup().addTo(this.map);
      this.incidentLayer = L.layerGroup().addTo(this.map);

      // Boutons +/- en haut a droite : la legende occupe deja le
      // haut-gauche. Zoom/deplacement libres, comme demande.
      // +/- buttons top-right: the legend already occupies the top-left
      // corner. Free zoom/pan, as requested.
      L.control.zoom({ position: "topright" }).addTo(this.map);
      window.__piboardTrafficMap__ = this.map; // pour les tests uniquement / test-only

      // Piege classique de Leaflet : si le conteneur n'a pas encore sa
      // taille finale au moment de l'initialisation (mise en page de
      // Gridstack pas totalement retombee), la carte peut se retrouver
      // mal dimensionnee, voire lever une erreur. On force un recalcul
      // une fois la peinture reellement posee.
      // Classic Leaflet pitfall: if the container doesn't have its final
      // size yet at initialization time (Gridstack's layout not fully
      // settled), the map can end up mis-sized, or even throw. Force a
      // recalculation once the paint has actually happened.
      requestAnimationFrame(() => {
        if (this.map) this.map.invalidateSize();
      });
      if (this.observer) this.observer.disconnect();
      this.observer = new ResizeObserver(() => { if (this.map) this.map.invalidateSize(); });
      this.observer.observe(this.ctx.el);
    }

    /* ---------- Couches TomTom : tuiles RASTER, comme l'app Umbrel ----------

       Point cle de cette correction. La version precedente demandait des
       tuiles VECTORIELLES (.pbf) et les recoloriait elle-meme segment par
       segment : en pratique le rendu ne correspondait pas au flux de
       circulation reel de TomTom. L'app Umbrel de reference, elle, affiche
       simplement les tuiles raster (.png) DEJA rendues par TomTom -- c'est
       le rendu officiel du trafic, celui qu'on voulait depuis le debut.
       On revient donc a cette approche, avec en prime le choix du style
       expose dans les reglages de la tuile.

       Key point of this fix. The previous version requested VECTOR tiles
       (.pbf) and re-colored them itself, segment by segment: in practice
       the result did not match TomTom's actual traffic flow. The reference
       Umbrel app simply displays the raster tiles (.png) ALREADY rendered
       by TomTom -- that's the official traffic rendering, the one we
       wanted all along. So we go back to that approach, and additionally
       expose the style choice in the tile's settings.

       Le parametre ts= horodate chaque cycle : la vue etant stable, les
       URLs seraient sinon identiques d'un rafraichissement a l'autre et
       le cache HTTP du navigateur pourrait resservir un etat perime.
       The ts= parameter timestamps each cycle: the view being stable, the
       URLs would otherwise be identical between refreshes and the
       browser's HTTP cache could serve a stale state. */

    buildFlowLayer() {
      const s = this.ctx.settings;
      const style = s.flowStyle || "relative0";
      const thickness = Math.min(20, Math.max(1, Number(s.flowThickness) || 7));
      const layer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/{z}/{x}/{y}.png`
        + `?key=${encodeURIComponent(s.apiKey)}&thickness=${thickness}&ts=${Date.now()}`,
        { maxZoom: 19, opacity: 0.85 }
      );
      layer.on("tileloadstart", () => { this.pendingTileCount++; });
      return layer;
    }

    buildIncidentTileLayer() {
      const s = this.ctx.settings;
      const style = s.incidentStyle || "s1";
      const layer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/incidents/${style}/{z}/{x}/{y}.png`
        + `?key=${encodeURIComponent(s.apiKey)}&ts=${Date.now()}`,
        { maxZoom: 19, opacity: 0.9 }
      );
      layer.on("tileloadstart", () => { this.pendingTileCount++; });
      return layer;
    }

    /* Remplace une couche de tuiles par une version fraichement horodatee,
       en ajoutant la nouvelle avant de retirer l'ancienne (pas de
       clignotement). Swaps a tile layer for a freshly timestamped one,
       adding the new one before removing the old (no flicker). */
    swapLayer(oldLayer, newLayer) {
      newLayer.addTo(this.map);
      if (oldLayer && this.map.hasLayer(oldLayer)) this.map.removeLayer(oldLayer);
      return newLayer;
    }

    /* Rafraichit flux et incidents, comptabilise les requetes reellement
       effectuees, et signale le total au serveur.
       Refreshes flow and incidents, tallies requests actually made, and
       reports the total to the server. */
    async refreshData() {
      // tick() n'attend pas refreshData() : sans ce verrou, un cycle lent
      // (reseau) pourrait en voir un second demarrer par-dessus, et
      // compter les tuiles deux fois dans le quota.
      // tick() doesn't await refreshData(): without this lock, a slow
      // cycle (network) could see a second one start on top of it, and
      // double-count tiles against the quota.
      if (this.refreshing) return;
      this.refreshing = true;
      this.pendingTileCount = 0;
      const s = this.ctx.settings;

      try {
        if (s.showFlow !== false) {
          this.flowLayer = this.swapLayer(this.flowLayer, this.buildFlowLayer());
        }
        if (s.showIncidents !== false) {
          this.incidentTileLayer = this.swapLayer(this.incidentTileLayer, this.buildIncidentTileLayer());
        }
        if (s.showFlow !== false || s.showIncidents !== false) {
          // Laisser les evenements tileloadstart s'accumuler brievement
          // Let tileloadstart events accumulate briefly
          await new Promise((r) => setTimeout(r, 400));
        }
        // Pas de bringToFront() ici : les traces de bouchons et les
        // marqueurs sont des couches vectorielles, donc deja placees par
        // Leaflet dans l'overlayPane, au-dessus du tilePane des tuiles.
        // (Et L.layerGroup n'expose de toute facon pas bringToFront.)
        // No bringToFront() here: jam traces and markers are vector layers,
        // so Leaflet already places them in the overlayPane, above the
        // tiles' tilePane. (And L.layerGroup doesn't expose bringToFront
        // anyway.)

        let requestCount = this.pendingTileCount;

        if (s.showJams !== false && this.map) {
          try {
            await this.refreshIncidents();
            requestCount += 1;
          } catch (e) {
            console.warn("[piboard/traffic] incidents", e);
          }
        }

        if (requestCount > 0) this.reportQuota(requestCount);
        this.setStale(false);
      } catch (e) {
        console.error("[piboard/traffic] refresh failed:", e);
      } finally {
        // Toujours horodater, meme en cas d'echec : sinon lastRefreshAt
        // reste a 0, le compte a rebours affiche 0:00 en permanence et
        // tick() relance un rafraichissement a chaque battement (15 s),
        // ce qui consomme le quota TomTom pour rien.
        // Always timestamp, even on failure: otherwise lastRefreshAt stays
        // at 0, the countdown shows 0:00 forever and tick() retries a
        // refresh on every beat (15 s), burning the TomTom quota for
        // nothing.
        this.lastRefreshAt = Date.now();
        this.refreshing = false;
      }
    }

    /* Appel JSON "incidentDetails" : sert a dessiner les BOUCHONS
       (iconCategory 6) sous forme de traces cliquables avec leur retard
       estime -- exactement comme l'app Umbrel. Les autres incidents
       (accidents, travaux, fermetures) sont, eux, deja dessines par la
       couche de tuiles raster ci-dessus ; on ne pose qu'un marqueur
       cliquable discret par-dessus, pour la popup de detail.
       "incidentDetails" JSON call: used to draw JAMS (iconCategory 6) as
       clickable traces with their estimated delay -- exactly like the
       Umbrel app. Other incidents (accidents, roadworks, closures) are
       already drawn by the raster tile layer above; we only place a
       discreet clickable marker on top, for the detail popup. */
    async refreshIncidents() {
      const s = this.ctx.settings;
      const b = this.map.getBounds();
      const bbox = [b.getSouthWest().lng, b.getSouthWest().lat, b.getNorthEast().lng, b.getNorthEast().lat].join(",");
      const fields = "{incidents{type,geometry{type,coordinates},properties{"
        + "iconCategory,magnitudeOfDelay,delay,from,to,events{description}}}}";
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${encodeURIComponent(bbox)}`
        + `&fields=${encodeURIComponent(fields)}&language=${this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-GB"}`
        + `&timeValidityFilter=present`
        + `&key=${encodeURIComponent(s.apiKey)}&_=${Date.now()}`;
      const data = await fetch(this.ctx.api.proxyUrl(url), { cache: "no-store" }).then((r) => r.json());
      this.jamsLayer.clearLayers();
      this.incidentLayer.clearLayers();
      const t = (k) => this.ctx.i18n.t(k);

      for (const inc of (data.incidents || [])) {
        const geom = inc.geometry;
        if (!geom || !geom.coordinates) continue;
        const props = inc.properties || {};
        const desc = (props.events && props.events[0] && props.events[0].description) || t("traffic.incident");
        const delayMin = props.delay ? Math.round(props.delay / 60) : 0;

        // --- Bouchons : trace complet le long de l'axe, colore par gravite
        // --- Jams: full trace along the road, colored by severity
        if (props.iconCategory === 6) {
          if (s.showJams === false) continue;
          const color = JAM_COLORS[props.magnitudeOfDelay] || JAM_COLOR_DEFAULT;
          let popup = `<b>${desc}</b>`;
          if (props.from && props.to) popup += `<br>${props.from} → ${props.to}`;
          if (delayMin > 0) popup += `<br>${t("traffic.delay")} : +${delayMin} min`;

          if (geom.type === "LineString" && geom.coordinates.length > 1) {
            const latlngs = geom.coordinates.map((c) => [c[1], c[0]]);
            L.polyline(latlngs, { color, weight: 6, opacity: 0.9, lineCap: "round" })
              .bindPopup(popup).addTo(this.jamsLayer);
          } else if (geom.type === "Point") {
            const [lon, lat] = geom.coordinates;
            L.circleMarker([lat, lon], {
              radius: 6, weight: 1.5, color: "rgba(255,255,255,0.6)",
              fillColor: color, fillOpacity: 0.85
            }).bindPopup(popup).addTo(this.jamsLayer);
          }
          continue;
        }

        // --- Autres incidents : deja dessines par la couche de tuiles ;
        // on n'ajoute qu'un point cliquable transparent pour la popup.
        // --- Other incidents: already drawn by the tile layer; we only
        // add a transparent clickable dot for the popup.
        const point = geom.type === "Point" ? geom.coordinates : geom.coordinates[0];
        if (!point) continue;
        const [lon, lat] = point;
        let popup = `<b>${desc}</b>`;
        if (props.iconCategory === 8) popup += `<br>${t("traffic.closed")}`;
        else if (delayMin > 0) popup += `<br>${t("traffic.delay")} : +${delayMin} min`;
        L.circleMarker([lat, lon], {
          radius: 9, weight: 0, opacity: 0, fillOpacity: 0
        }).bindPopup(popup).addTo(this.incidentLayer);
      }
    }

    reportQuota(n) {
      fetch("/api/traffic-quota/" + this.ctx.instanceId, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: n })
      }).then((r) => r.json()).then((q) => {
        this.quotaCount = q.count;
        this.renderQuotaBadge();
      }).catch(() => {});
    }

    async refreshQuotaDisplay() {
      try {
        const q = await fetch("/api/traffic-quota/" + this.ctx.instanceId).then((r) => r.json());
        this.quotaCount = q.count;
        this.renderQuotaBadge();
      } catch (e) { /* pas grave / not critical */ }
    }

    renderQuotaBadge() {
      this.quotaBadge.hidden = false;
      this.quotaBadge.textContent = this.ctx.i18n.t("traffic.quota") + " " + this.quotaCount + " / 2500";
      this.quotaBadge.classList.toggle("pwt-quota-warn", this.quotaCount > 2000);
    }

    setStale(isStale) {
      this.staleBadge.hidden = !isStale;
    }

    startBoost(minutes) {
      this.boostUntil = Date.now() + minutes * 60000;
      // Un rafraichissement immediat donne un effet visible tout de suite,
      // plutot que d'attendre jusqu'a une minute avant le premier effet
      // perceptible du boost. An immediate refresh gives a visible effect
      // right away, rather than waiting up to a minute before the boost
      // has any perceptible effect.
      this.lastRefreshAt = 0;
      this.tick();
    }

    /* Appele periodiquement : determine la phase actuelle et declenche un
       rafraichissement si la cadence voulue l'exige.
       Called periodically: determines the current phase and triggers a
       refresh if the desired cadence calls for it. */
    tick() {
      if (!this.map) return;
      const now = new Date();
      const { phase, refreshMinutes } = computePhase(now, this.ctx.settings, this.boostUntil);
      this.currentPhase = phase;

      if (phase === "quiet") {
        this.setStale(this.lastRefreshAt > 0);
        this.updateCartouche();
        return;
      }

      if (!this.paused) {
        const dueAt = this.lastRefreshAt + refreshMinutes * 60000;
        if (Date.now() >= dueAt) this.refreshData();
      }
      this.updateCartouche();
    }

    /* Met a jour le compte a rebours avant la prochaine actualisation
       (ou l'etat pause/silencieux), chaque seconde.
       Updates the countdown until the next refresh (or the paused/quiet
       state), every second. */
    updateCartouche() {
      if (!this.refreshCountdownEl) return;
      if (this.paused) {
        this.refreshCountdownEl.textContent = this.ctx.i18n.t("traffic.pausedLabel");
        return;
      }
      if (this.currentPhase === "quiet") {
        this.refreshCountdownEl.textContent = this.ctx.i18n.t("traffic.quietNow");
        return;
      }
      const { refreshMinutes } = computePhase(new Date(), this.ctx.settings, this.boostUntil);
      if (!refreshMinutes) return;
      const dueAt = this.lastRefreshAt + refreshMinutes * 60000;
      const remain = Math.max(0, dueAt - Date.now());
      const mm = Math.floor(remain / 60000);
      const ss = Math.floor((remain % 60000) / 1000);
      this.refreshCountdownEl.textContent = this.ctx.i18n.t("traffic.nextRefresh") + " " + mm + ":" + String(ss).padStart(2, "0");
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      // Ces reglages changent la nature meme des couches (URLs des tuiles,
      // fond de carte) : la carte est reconstruite pour les reprendre.
      // These settings change the very nature of the layers (tile URLs,
      // base map): the map is rebuilt to pick them up.
      const needsRebuild = ["city", "basemap", "flowStyle", "flowThickness",
        "incidentStyle", "showFlow", "showIncidents", "apiKey"]
        .some((k) => settings[k] !== old[k]);
      this.ctx.settings = settings;
      if (needsRebuild || !this.map) {
        if (this.map) { this.map.remove(); this.map = null; }
        this.init();
        return;
      }
      if (this.map) this.map.setZoom(Number(settings.zoom) || 13);
      this.lastRefreshAt = 0; // reappliquer immediatement les nouveaux reglages de calendrier
      this.tick();
    }

    onLangChanged() {
      this.renderQuotaBadge();
    }

    destroy() {
      clearInterval(this.scheduleTimer);
      clearInterval(this.uiTimer);
      if (this.closeBoostMenu) document.removeEventListener("pointerup", this.closeBoostMenu);
      if (this.observer) this.observer.disconnect();
      if (this.map) this.map.remove();
    }
  }

  window.PiBoard.registerWidget("traffic", TrafficWidget);
  window.__piboardTrafficTest__ = computePhase;
  // Note : __piboardFlowStyleTest__ (coloration segment par segment des
  // tuiles vectorielles) n'a plus d'objet -- le flux est desormais rendu
  // par TomTom lui-meme, en tuiles raster.
  // Note: __piboardFlowStyleTest__ (per-segment coloring of vector tiles)
  // no longer has any purpose -- the flow is now rendered by TomTom
  // itself, as raster tiles.
})();
