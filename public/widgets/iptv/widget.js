/* PiBoard widget: chaines TV / TV channels
   Deux modes, detectes automatiquement a partir de l'URL de playlist :

   - XTREAM CODES (le cas des plateformes IPTV par abonnement,
     identifiant + mot de passe dans l'URL) : navigation a plusieurs
     niveaux -- Direct / Films / Series, puis categories (ex. "France
     HD|OTT"), puis la liste des flux. Les series ont un niveau
     supplementaire (episodes par saison). C'est ce que gerent
     nativement SmartIPTV, TiviMate, IPTV Smarters.

   - M3U SIMPLE (une playlist statique, ex. les listes en clair du
     projet IPTV-org) : liste plate avec recherche et filtre par
     categorie -- le comportement d'origine de ce widget.

   Repartition des roles : le serveur PiBoard ne recupere QUE les
   listes (categories, flux) -- question de CORS, voir server/iptv.js.
   Les flux video eux-memes sont lus directement par le navigateur,
   sans transiter par le Pi (relayer de la video le mettrait a genoux).

   Lecture HLS via hls.js, sauf sur les navigateurs qui savent lire le
   HLS nativement (Safari, iOS), ou l'element <video> suffit et donne un
   meilleur resultat. Les films (VOD) dans un format que le navigateur
   ne sait pas lire nativement (Matroska/.mkv, tres courant) sont
   signales avant lecture plutot que d'echouer silencieusement.

   Two modes, auto-detected from the playlist URL:

   - XTREAM CODES (subscription IPTV platforms, username + password in
     the URL): multi-level navigation -- Live / Movies / Series, then
     categories (e.g. "France HD|OTT"), then the stream list. Series
     have an extra level (episodes by season). This is what SmartIPTV,
     TiviMate and IPTV Smarters natively handle.

   - PLAIN M3U (a static playlist, e.g. the IPTV-org project's
     free-to-air lists): flat list with search and category filter --
     this widget's original behaviour.

   Division of labour: the PiBoard server ONLY fetches the lists
   (categories, streams) -- a CORS matter, see server/iptv.js. The video
   streams themselves are read directly by the browser, without going
   through the Pi (relaying video would bring it to its knees).

   HLS playback via hls.js, except on browsers that read HLS natively
   (Safari, iOS), where the plain <video> element performs better.
   Movies (VOD) in a format the browser can't read natively
   (Matroska/.mkv, very common) are flagged before playback rather than
   failing silently. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  // Recherche insensible aux accents, comme la recherche de l'aide.
  // Accent-insensitive search, like the help's.
  function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Extensions qu'un navigateur sait raisonnablement lire nativement ou
  // via hls.js. Tout le reste (Matroska/.mkv en tete, tres courant en
  // VOD) est signale avant lecture plutot que d'echouer sans
  // explication. Extensions a browser can reasonably read natively or
  // via hls.js. Everything else (Matroska/.mkv chief among them, very
  // common for VOD) is flagged before playback rather than failing
  // without explanation.
  const BROWSER_FRIENDLY_EXT = new Set(["mp4", "m3u8", "webm", "ogg", "ogv"]);

  // hls.js est vendorise (voir la route /vendor/hls du serveur) et
  // charge une seule fois pour toutes les tuiles, a la premiere lecture.
  // hls.js is vendored (see the server's /vendor/hls route) and loaded
  // once for all tiles, on first playback.
  let hlsLoader = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoader) return hlsLoader;
    hlsLoader = (async () => {
      // Verifie d'abord le VRAI statut HTTP du fichier, avant de tenter
      // de l'executer comme script : distingue un fichier absent du
      // paquet (404 -- probleme d'empaquetage) d'une erreur survenant a
      // l'EXECUTION du script lui-meme (fichier present, mais qui plante
      // une fois lance). Sans cette verification prealable, un <script>
      // qui echoue ne donne qu'un evenement "error" generique, sans
      // indiquer LEQUEL de ces deux cas s'est produit -- information
      // cruciale pour diagnostiquer a distance, sans acces aux outils de
      // developpement.
      // First checks the file's ACTUAL HTTP status, before attempting to
      // execute it as a script: distinguishes a file missing from the
      // package (404 -- a packaging problem) from an error happening at
      // the script's own EXECUTION (file present, but crashing once
      // run). Without this upfront check, a failing <script> only gives
      // a generic "error" event, without indicating WHICH of these two
      // cases occurred -- crucial information for diagnosing remotely,
      // without access to developer tools.
      let httpStatus = null;
      try {
        const head = await fetch("/vendor/hls/hls.min.js", { method: "GET", cache: "no-store" });
        httpStatus = head.status;
        if (!head.ok) throw new Error("hls.min.js : statut HTTP " + head.status);
      } catch (e) {
        hlsLoader = null;
        throw new Error("hls.min.js injoignable" + (httpStatus ? " (statut " + httpStatus + ")" : " (reseau)"));
      }

      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/vendor/hls/hls.min.js";
        s.onload = () => {
          if (window.Hls) resolve(window.Hls);
          // Le fichier a bien ete servi (statut HTTP correct, verifie
          // ci-dessus) mais n'a pas defini window.Hls une fois execute :
          // fichier corrompu ou tronque, pas un probleme reseau.
          // The file WAS served correctly (verified above) but didn't
          // define window.Hls once executed: a corrupted or truncated
          // file, not a network problem.
          else reject(new Error("hls.min.js charge (HTTP " + httpStatus + ") mais n'a pas defini window.Hls -- fichier corrompu ?"));
        };
        s.onerror = () => reject(new Error("echec d'execution du script hls.min.js (HTTP " + httpStatus + ")"));
        document.head.appendChild(s);
      });
    })().catch((e) => {
      // Reinitialise le cache d'echec : sans ca, un chargement rate UNE
      // SEULE fois (potentiellement transitoire -- lenteur au tout
      // premier demarrage du serveur, par exemple) restait en cache
      // pour le reste de la session, condamnant TOUTE tentative future
      // au repli natif -- qui, lui, ne sait de toute facon pas lire du
      // HLS sur Chromium (voir plus bas) et contourne en plus le relais
      // CORS. Resets the failure cache: without this, a load that
      // failed ONCE (potentially transient -- slowness right at the
      // server's very first startup, for instance) stayed cached for
      // the rest of the session, dooming every future attempt to the
      // native fallback -- which, on Chromium, can't read HLS anyway
      // (see below) and additionally bypasses the CORS relay.
      hlsLoader = null;
      throw e;
    });
    return hlsLoader;
  }

  const SOURCES = [
    { key: "live", icon: "📡" },
    { key: "vod", icon: "🎬" },
    { key: "series", icon: "🎞" }
  ];

  class IptvWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.mode = null; // "xtream" | "flat", determine au chargement
      // -- mode M3U simple --
      this.channels = [];
      this.groups = [];
      this.filterGroup = "";
      // -- mode Xtream --
      this.xCategories = null; // { live:[], vod:[], series:[] }
      this.xSource = null; // "live" | "vod" | "series"
      this.xCategory = null; // categorie choisie
      this.xItems = []; // flux/films/series de la categorie choisie
      this.xSeries = null; // serie choisie (navigation episodes)
      this.xSeasons = [];
      // -- commun --
      this.search = "";
      this.current = null; // element en cours de lecture
      this.hls = null;
      this.view = "loading";
    }

    /* isRetry distingue le premier echec (probablement la politique de
       lecture automatique du navigateur, resolue par un clic -- voir
       plus bas) d'un second echec survenant APRES un vrai clic
       utilisateur : dans ce cas, ce n'est plus une question de geste,
       c'est que le FLUX lui-meme ne parvient pas a demarrer. Sans cette
       distinction, les deux se traduisaient par le meme message a
       l'ecran, donnant l'impression que le clic n'avait servi a rien
       (signale : "le message reste affiche meme apres un clic").
       isRetry distinguishes the first failure (likely the browser's
       autoplay policy, resolved by a click -- see below) from a second
       failure happening AFTER a genuine user click: in that case it's no
       longer a matter of gesture, it's that the STREAM itself fails to
       start. Without this distinction, both looked identical on screen,
       giving the impression the click had done nothing (reported: "the
       message stays even after a click"). */
    safePlay(video, isRetry) {
      let p;
      try { p = video.play(); } catch (e) { p = null; }
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          if (isRetry) {
            console.warn("[piboard/iptv] echec de lecture apres un clic reel -- probablement le flux lui-meme, pas la politique de lecture automatique", err);
            // Troisieme et dernier endroit ou un message generique sans
            // detail pouvait s'afficher : le nom et le message exacts de
            // l'erreur navigateur (ex. "NotSupportedError: The element
            // has no supported sources") s'affichent maintenant aussi a
            // l'ecran. Third and last spot where a generic, detail-less
            // message could show: the browser error's exact name and
            // message (e.g. "NotSupportedError: The element has no
            // supported sources") now also show on screen.
            const detail = err && (err.name || err.message) ? [err.name, err.message].filter(Boolean).join(": ") : "";
            this.setStatus(this.ctx.i18n.t("iptv.streamError") + (detail ? " (" + detail + ")" : ""));
            return;
          }
          // "Touchez pour lancer la lecture" doit etre une VRAIE
          // invite cliquable, pas un simple texte : un clic utilisateur
          // est justement ce qui satisfait la politique de lecture
          // automatique du navigateur, refusee jusqu'ici (video.play()
          // rejetee sans interaction prealable). Sans ce bouclage, le
          // message s'affichait indefiniment sans aucun moyen de
          // relancer la lecture -- signale sur les chaines en direct.
          // "Tap to start playback" needs to be a REAL clickable
          // prompt, not plain text: a user click is exactly what
          // satisfies the browser's autoplay policy, rejected until now
          // (video.play() refused without prior interaction). Without
          // this loop-back, the message stayed on screen forever with
          // no way to actually retry -- reported on live channels.
          this.setStatus(this.ctx.i18n.t("iptv.tapToPlay"), () => this.safePlay(video, true));
        });
      }
    }

    // Cle d'etat propre a CETTE tuile. State key specific to THIS tile.
    stateKey() { return "iptv-last-" + this.ctx.instanceId; }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.loadPlaylist();
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      const playlistChanged = settings.playlistUrl !== old.playlistUrl;
      this.ctx.settings = settings;
      if (playlistChanged) {
        this.stopPlayback();
        this.resetNav();
        this.loadPlaylist();
      } else {
        this.render();
      }
    }

    onLangChanged() { this.render(); }

    resetNav() {
      this.xSource = null; this.xCategory = null; this.xItems = [];
      this.xSeries = null; this.xSeasons = [];
      this.filterGroup = this.ctx.settings.defaultGroup || "";
      this.search = "";
      this.current = null;
    }

    /* Point d'entree : essaie Xtream Codes en premier des que l'URL
       ressemble a une URL Xtream (identifiant + mot de passe en
       parametres), avec repli automatique sur le M3U simple si ca
       echoue -- une URL qui ressemble a s'y meprendre sans en etre une
       reste geree correctement. Entry point: tries Xtream Codes first
       as soon as the URL looks like an Xtream one (username + password
       as params), with automatic fallback to plain M3U if that fails --
       a URL that looks the part without being one is still handled
       correctly. */
    async loadPlaylist() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      if (!s.playlistUrl) {
        this.mode = null;
        this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${i18n.t("iptv.needConfig")}</div></div>`;
        return;
      }

      const looksXtream = /[?&]username=/.test(s.playlistUrl) && /[?&]password=/.test(s.playlistUrl);
      if (looksXtream) {
        try {
          const res = await fetch("/api/iptv/xtream-categories?url=" + encodeURIComponent(s.playlistUrl));
          const data = await res.json();
          if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
          this.mode = "xtream";
          this.xCategories = data;
          this.resetNav();
          this.view = "xtream-sources";
          this.render();
          return;
        } catch (e) {
          console.warn("[piboard/iptv] xtream indisponible, repli sur M3U simple", e);
          // Repli silencieux : beaucoup de fournisseurs generent une URL
          // avec ces memes noms de parametres sans etre du vrai Xtream.
          // Silent fallback: many providers generate a URL with these
          // same parameter names without being genuine Xtream.
        }
      }

      try {
        const res = await fetch("/api/iptv/playlist?url=" + encodeURIComponent(s.playlistUrl));
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        this.mode = "flat";
        this.channels = data.channels || [];
        this.groups = data.groups || [];
        this.truncated = !!data.truncated;
        this.resetNav();
        this.view = "flat-list";
        this.render();
        if (s.autoplayLast === true && this.channels.length) await this.tryResumeLast(this.channels);
      } catch (e) {
        console.warn("[piboard/iptv]", e);
        this.mode = null;
        this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${i18n.t("iptv.playlistError")}</div></div>`;
      }
    }

    async tryResumeLast(candidates) {
      try {
        const last = await this.ctx.api.state.get(this.stateKey());
        const found = last ? candidates.find((c) => c.url === last) : null;
        if (found) this.play(found);
      } catch (e) { /* pas d'etat memorise / no stored state */ }
    }

    render() {
      const map = {
        "flat-list": () => this.renderFlatList(),
        "player": () => this.renderPlayer(),
        "xtream-sources": () => this.renderXtreamSources(),
        "xtream-categories": () => this.renderXtreamCategories(),
        "xtream-items": () => this.renderXtreamItems(),
        "xtream-episodes": () => this.renderXtreamEpisodes()
      };
      (map[this.view] || map["flat-list"])();
    }

    /* En-tete commun a toutes les vues de navigation (hors lecteur) :
       bouton retour facultatif + titre + barre de recherche facultative.
       Common header for every navigation view (except the player):
       optional back button + title + optional search bar. */
    navHeaderHtml(title, showBack, showSearch) {
      const i18n = this.ctx.i18n;
      return `
        <div class="pwtv-bar">
          ${showBack ? `<button type="button" class="pwtv-btn pwtv-navback" title="${i18n.t("iptv.back")}">‹</button>` : ""}
          <span class="pwtv-title">${escapeHtml(title)}</span>
        </div>
        ${showSearch ? `<div class="pwtv-searchbar"><input type="search" class="pwtv-search" placeholder="${i18n.t("iptv.search")}" value="${escapeAttr(this.search)}"></div>` : ""}`;
    }

    wireNavBack(handler) {
      const btn = this.ctx.el.querySelector(".pwtv-navback");
      if (btn) btn.addEventListener("click", handler);
    }

    /* ---------- Mode M3U simple (inchange) ---------- */

    visibleChannels() {
      const q = normalize(this.search);
      return this.channels.filter((c) => {
        if (this.filterGroup && c.group !== this.filterGroup) return false;
        if (q && !normalize(c.name).includes(q)) return false;
        return true;
      });
    }

    renderFlatList() {
      const i18n = this.ctx.i18n;
      const list = this.visibleChannels();
      const groupOpts = [`<option value="">${i18n.t("iptv.allGroups")}</option>`]
        .concat(this.groups.map((g) => `<option value="${escapeAttr(g)}" ${g === this.filterGroup ? "selected" : ""}>${escapeHtml(g)}</option>`))
        .join("");

      this.ctx.el.innerHTML = `
        <div class="pw-iptv">
          <div class="pwtv-bar">
            <input type="search" class="pwtv-search" placeholder="${i18n.t("iptv.search")}" value="${escapeAttr(this.search)}">
            <select class="pwtv-group">${groupOpts}</select>
          </div>
          <div class="pwtv-count">${i18n.t("iptv.channelCount").replace("{n}", list.length)}${this.truncated ? " " + i18n.t("iptv.truncated") : ""}</div>
          <ul class="pwtv-list">${this.itemsHtml(list)}</ul>
        </div>`;

      const searchEl = this.ctx.el.querySelector(".pwtv-search");
      searchEl.addEventListener("input", () => {
        this.search = searchEl.value;
        this.refreshFlatListOnly();
      });
      this.ctx.el.querySelector(".pwtv-group").addEventListener("change", (e) => {
        this.filterGroup = e.target.value;
        this.refreshFlatListOnly();
      });
      this.wireItemClicks(() => this.visibleChannels(), (chan) => this.play(chan));
    }

    refreshFlatListOnly() {
      const i18n = this.ctx.i18n;
      const list = this.visibleChannels();
      const ul = this.ctx.el.querySelector(".pwtv-list");
      const countEl = this.ctx.el.querySelector(".pwtv-count");
      if (countEl) countEl.textContent = i18n.t("iptv.channelCount").replace("{n}", list.length) + (this.truncated ? " " + i18n.t("iptv.truncated") : "");
      if (!ul) return;
      ul.innerHTML = this.itemsHtml(list);
      this.wireItemClicks(() => this.visibleChannels(), (chan) => this.play(chan));
    }

    /* ---------- Mode Xtream : 1er niveau (Direct / Films / Series) ---------- */

    renderXtreamSources() {
      const i18n = this.ctx.i18n;
      const c = this.xCategories;
      const rows = SOURCES.map((s) => `
        <li class="pwtv-source" data-source="${s.key}">
          <span class="pwtv-source-icon">${s.icon}</span>
          <span class="pwtv-source-name">${i18n.t("iptv.source." + s.key)}</span>
          <span class="pwtv-source-count">${i18n.t("iptv.categoryCount").replace("{n}", c[s.key].length)}</span>
        </li>`).join("");

      this.ctx.el.innerHTML = `
        <div class="pw-iptv">
          ${this.navHeaderHtml(i18n.t("iptv.sourcesTitle"), false, false)}
          <ul class="pwtv-list pwtv-sources-list">${rows}</ul>
        </div>`;

      this.ctx.el.querySelectorAll(".pwtv-source").forEach((li) => {
        li.addEventListener("click", () => {
          this.xSource = li.dataset.source;
          this.search = "";
          this.view = "xtream-categories";
          this.render();
        });
      });
    }

    /* ---------- Mode Xtream : 2e niveau (categories, ex. "France HD|OTT") ---------- */

    renderXtreamCategories() {
      const i18n = this.ctx.i18n;
      const cats = this.xCategories[this.xSource] || [];
      const q = normalize(this.search);
      const list = q ? cats.filter((c) => normalize(c.name).includes(q)) : cats;

      const rows = list.length
        ? list.map((c) => `<li class="pwtv-item" data-id="${escapeAttr(c.id)}"><span class="pwtv-name">${escapeHtml(c.name)}</span></li>`).join("")
        : `<li class="pwtv-empty">${i18n.t("iptv.noMatch")}</li>`;

      this.ctx.el.innerHTML = `
        <div class="pw-iptv">
          ${this.navHeaderHtml(i18n.t("iptv.source." + this.xSource), true, true)}
          <ul class="pwtv-list">${rows}</ul>
        </div>`;

      this.wireNavBack(() => { this.view = "xtream-sources"; this.search = ""; this.render(); });
      this.ctx.el.querySelector(".pwtv-search").addEventListener("input", (e) => { this.search = e.target.value; this.renderXtreamCategories(); });
      this.ctx.el.querySelectorAll(".pwtv-item[data-id]").forEach((li) => {
        li.addEventListener("click", () => this.openXtreamCategory(list.find((c) => c.id === li.dataset.id)));
      });
    }

    async openXtreamCategory(category) {
      this.xCategory = category;
      this.search = "";
      this.view = "xtream-items";
      this.xItems = null; // null = chargement en cours / null = loading
      this.render();
      const s = this.ctx.settings;
      try {
        const res = await fetch(`/api/iptv/xtream-streams?url=${encodeURIComponent(s.playlistUrl)}&kind=${this.xSource}&categoryId=${encodeURIComponent(category.id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        this.xItems = data;
      } catch (e) {
        console.warn("[piboard/iptv] xtream-streams", e);
        this.xItems = [];
        this.xItemsError = true;
      }
      if (this.view === "xtream-items") this.render();
    }

    /* ---------- Mode Xtream : 3e niveau (flux d'une categorie) ---------- */

    renderXtreamItems() {
      const i18n = this.ctx.i18n;
      const title = this.xCategory ? this.xCategory.name : "";

      if (this.xItems === null) {
        this.ctx.el.innerHTML = `
          <div class="pw-iptv">
            ${this.navHeaderHtml(title, true, false)}
            <div class="pwtv-msg">${i18n.t("common.loading")}</div>
          </div>`;
        this.wireNavBack(() => { this.view = "xtream-categories"; this.render(); });
        return;
      }

      const q = normalize(this.search);
      const list = q ? this.xItems.filter((it) => normalize(it.name).includes(q)) : this.xItems;

      this.ctx.el.innerHTML = `
        <div class="pw-iptv">
          ${this.navHeaderHtml(title, true, true)}
          ${this.xItemsError ? `<div class="pwtv-msg">${i18n.t("iptv.playlistError")}</div>` : `<ul class="pwtv-list">${this.itemsHtml(list, true)}</ul>`}
        </div>`;

      this.wireNavBack(() => { this.view = "xtream-categories"; this.search = ""; this.render(); });
      const searchEl = this.ctx.el.querySelector(".pwtv-search");
      if (searchEl) searchEl.addEventListener("input", (e) => { this.search = e.target.value; this.renderXtreamItems(); });
      this.wireItemClicks(() => list, (item) => {
        if (item.isSeries) this.openXtreamSeries(item);
        else this.play(item);
      });
    }

    /* ---------- Mode Xtream : niveau supplementaire pour les series (episodes) ---------- */

    async openXtreamSeries(series) {
      this.xSeries = series;
      this.view = "xtream-episodes";
      this.xSeasons = null;
      this.render();
      const s = this.ctx.settings;
      try {
        const res = await fetch(`/api/iptv/xtream-series-info?url=${encodeURIComponent(s.playlistUrl)}&seriesId=${encodeURIComponent(series.id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        this.xSeasons = data.seasons || [];
      } catch (e) {
        console.warn("[piboard/iptv] xtream-series-info", e);
        this.xSeasons = [];
        this.xSeasonsError = true;
      }
      if (this.view === "xtream-episodes") this.render();
    }

    renderXtreamEpisodes() {
      const i18n = this.ctx.i18n;
      const title = this.xSeries ? this.xSeries.name : "";

      if (this.xSeasons === null) {
        this.ctx.el.innerHTML = `
          <div class="pw-iptv">
            ${this.navHeaderHtml(title, true, false)}
            <div class="pwtv-msg">${i18n.t("common.loading")}</div>
          </div>`;
        this.wireNavBack(() => { this.view = "xtream-items"; this.render(); });
        return;
      }

      const seasonsHtml = (this.xSeasons || []).map((season) => `
        <div class="pwtv-season">
          <div class="pwtv-season-title">${i18n.t("iptv.season")} ${season.season}</div>
          <ul class="pwtv-list">${this.itemsHtml(season.episodes)}</ul>
        </div>`).join("");

      this.ctx.el.innerHTML = `
        <div class="pw-iptv pwtv-episodes-view">
          ${this.navHeaderHtml(title, true, false)}
          ${this.xSeasonsError ? `<div class="pwtv-msg">${i18n.t("iptv.playlistError")}</div>` : (this.xSeasons.length ? seasonsHtml : `<div class="pwtv-msg">${i18n.t("iptv.noEpisodes")}</div>`)}
        </div>`;

      this.wireNavBack(() => { this.view = "xtream-items"; this.render(); });
      const allEpisodes = [].concat(...(this.xSeasons || []).map((s) => s.episodes));
      this.wireItemClicks(() => allEpisodes, (ep) => this.play(ep));
    }

    /* ---------- Rendu et interaction communs aux listes d'elements ---------- */

    itemsHtml(list, showFormatWarning) {
      const i18n = this.ctx.i18n;
      if (!list.length) return `<li class="pwtv-empty">${i18n.t("iptv.noMatch")}</li>`;
      return list.map((c, i) => {
        const warn = showFormatWarning && c.containerExt && !BROWSER_FRIENDLY_EXT.has(String(c.containerExt).toLowerCase())
          ? `<span class="pwtv-format-warn" title="${i18n.t("iptv.formatWarning").replace("{ext}", c.containerExt)}">⚠</span>` : "";
        return `
          <li class="pwtv-item" data-idx="${i}">
            ${c.logo ? `<img class="pwtv-logo" src="${escapeAttr(c.logo)}" alt="" loading="lazy">` : `<span class="pwtv-logo pwtv-logo-empty">${c.isSeries ? "🎞" : "📺"}</span>`}
            <span class="pwtv-name">${escapeHtml(c.name)}</span>
            ${warn}
          </li>`;
      }).join("");
    }

    wireItemClicks(getList, onPick) {
      this.ctx.el.querySelectorAll(".pwtv-list").forEach((listEl) => {
        listEl.addEventListener("click", (e) => {
          const li = e.target.closest(".pwtv-item");
          if (!li || li.dataset.idx == null) return;
          e.stopPropagation();
          const item = getList()[Number(li.dataset.idx)];
          if (item) onPick(item);
        });
      });
    }

    /* ---------- Lecteur (commun aux deux modes) ---------- */

    renderPlayer() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const warn = this.current.containerExt && !BROWSER_FRIENDLY_EXT.has(String(this.current.containerExt).toLowerCase())
        ? `<div class="pwtv-format-banner">${i18n.t("iptv.formatWarning").replace("{ext}", this.current.containerExt)}</div>` : "";
      // VOD (film/serie) : duree finie, la navigation (lecture/pause,
      // avance/retour rapide) y a un sens -- utilise les commandes
      // NATIVES du navigateur, plus robustes et completes qu'une barre
      // maison. Repere via le chemin de l'URL (/movie/ ou /series/),
      // fiable quelle que soit la source (Xtream ou M3U simple), plutot
      // que de dependre d'un champ de donnees particulier. Absent pour
      // le direct, ou il n'y a rien a avancer/reculer.
      // VOD (movie/series): finite duration, navigation (play/pause,
      // fast-forward/rewind) makes sense there -- uses the browser's
      // NATIVE controls, more robust and complete than a custom bar.
      // Detected via the URL's path (/movie/ or /series/), reliable
      // regardless of the source (Xtream or plain M3U), rather than
      // depending on a specific data field. Absent for live, where
      // there's nothing to seek through.
      const isVod = /\/(movie|series)\//.test(this.current.url || "");
      this.ctx.el.innerHTML = `
        <div class="pw-iptv pwtv-playing">
          <div class="pwtv-video-wrap">
            <video class="pwtv-video" playsinline ${isVod ? "controls" : ""} ${s.startMuted !== false ? "muted" : ""}></video>
            <div class="pwtv-status" hidden></div>
          </div>
          ${warn}
          <div class="pwtv-controls">
            <button type="button" class="pwtv-btn pwtv-back" title="${i18n.t("iptv.backToList")}">☰</button>
            <span class="pwtv-current">${escapeHtml(this.current.name)}</span>
            <span class="pwtv-audio-warn" hidden>⚠</span>
            ${isVod ? "" : `
              ${this.navList && this.navList.length > 1 ? `<button type="button" class="pwtv-btn pwtv-prevchan" title="${i18n.t("iptv.prevChannel")}">⏮</button>` : ""}
              <button type="button" class="pwtv-btn pwtv-playpause" title="${i18n.t("iptv.pause")}">⏸</button>
              ${this.navList && this.navList.length > 1 ? `<button type="button" class="pwtv-btn pwtv-nextchan" title="${i18n.t("iptv.nextChannel")}">⏭</button>` : ""}
              <button type="button" class="pwtv-btn pwtv-mute">${s.startMuted !== false ? "🔇" : "🔊"}</button>
              <input type="range" class="pwtv-volume" min="0" max="100" value="${s.startMuted !== false ? "0" : "100"}" title="${i18n.t("iptv.volume")}">
              <button type="button" class="pwtv-btn pwtv-fullscreen" title="${i18n.t("iptv.fullscreen")}">⛶</button>
            `}
          </div>
        </div>`;

      const video = this.ctx.el.querySelector(".pwtv-video");
      video.muted = s.startMuted !== false;
      // Chaine precedente/suivante : navigue dans la liste COMPLETE
      // capturee au lancement de la lecture (voir play()), pas une
      // liste filtree par une recherche qui pourrait avoir change.
      // Reboucle aux extremites (de la derniere chaine, "suivant"
      // revient a la premiere), comme une vraie telecommande.
      // Previous/next channel: navigates the FULL list captured when
      // playback started (see play()), not a list filtered by a search
      // that might have changed. Wraps at the ends (from the last
      // channel, "next" goes back to the first), like a real remote.
      const prevBtn = this.ctx.el.querySelector(".pwtv-prevchan");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          const n = this.navList.length;
          this.play(this.navList[(this.navIndex - 1 + n) % n]);
        });
      }
      const nextBtn = this.ctx.el.querySelector(".pwtv-nextchan");
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          const n = this.navList.length;
          this.play(this.navList[(this.navIndex + 1) % n]);
        });
      }
      this.ctx.el.querySelector(".pwtv-back").addEventListener("click", () => {
        this.stopPlayback();
        this.view = this.mode === "xtream" ? (this.xSeries ? "xtream-episodes" : (this.xCategory ? "xtream-items" : "xtream-sources")) : "flat-list";
        this.render();
      });
      const muteBtn = this.ctx.el.querySelector(".pwtv-mute");
      const volumeSlider = this.ctx.el.querySelector(".pwtv-volume");
      if (muteBtn) {
        muteBtn.addEventListener("click", () => {
          video.muted = !video.muted;
          muteBtn.textContent = video.muted ? "🔇" : "🔊";
          // Garde le curseur coherent avec l'etat muet/non-muet : a 0
          // si muet, restaure le volume actuel du lecteur sinon (et non
          // 100 fixe, au cas ou l'utilisateur avait deja ajuste le
          // volume avant de couper le son).
          // Keeps the slider consistent with the muted/unmuted state: 0
          // if muted, restores the player's actual current volume
          // otherwise (not a fixed 100, in case the user had already
          // adjusted volume before muting).
          if (volumeSlider) volumeSlider.value = video.muted ? "0" : String(Math.round(video.volume * 100));
        });
      }
      // Curseur de volume : deplace au-dessus de 0 demute automatiquement
      // (sinon le changement de volume resterait sans effet audible, le
      // son restant coupe) ; a 0, remute -- comportement standard d'un
      // lecteur video.
      // Volume slider: moved above 0 automatically unmutes (otherwise
      // the volume change would stay inaudible, sound remaining cut);
      // at 0, mutes -- standard video player behavior.
      if (volumeSlider) {
        volumeSlider.addEventListener("input", () => {
          const v = Number(volumeSlider.value) / 100;
          video.volume = v;
          video.muted = v === 0;
          if (muteBtn) muteBtn.textContent = video.muted ? "🔇" : "🔊";
        });
      }
      // Pause/lecture : pas de barre de progression pour le direct
      // (rien a avancer/reculer, voir plus haut), mais mettre en pause
      // et reprendre gardent un sens meme sans elle -- l'image se fige
      // simplement sur l'instant courant, la reprise relance le direct
      // a l'instant reel (pas de rattrapage), comportement attendu pour
      // du direct.
      // Play/pause: no progress bar for live (nothing to seek through,
      // see above), but pausing and resuming still make sense without
      // it -- the image simply freezes on the current instant, resuming
      // restarts live at the real current time (no catch-up), expected
      // behavior for live content.
      const playPauseBtn = this.ctx.el.querySelector(".pwtv-playpause");
      if (playPauseBtn) {
        playPauseBtn.addEventListener("click", () => {
          if (video.paused) {
            this.safePlay(video);
            playPauseBtn.textContent = "⏸";
            playPauseBtn.title = i18n.t("iptv.pause");
          } else {
            video.pause();
            playPauseBtn.textContent = "▶";
            playPauseBtn.title = i18n.t("iptv.play");
          }
        });
        // Garde le bouton synchronise si la lecture s'arrete/reprend
        // pour une AUTRE raison que ce bouton (ex. mise en tampon
        // apres une coupure reseau, qui appelle aussi video.pause()
        // en interne).
        // Keeps the button in sync if playback stops/resumes for a
        // reason OTHER than this button (e.g. buffering after a network
        // drop, which also calls video.pause() internally).
        video.addEventListener("pause", () => { playPauseBtn.textContent = "▶"; playPauseBtn.title = i18n.t("iptv.play"); });
        video.addEventListener("playing", () => { playPauseBtn.textContent = "⏸"; playPauseBtn.title = i18n.t("iptv.pause"); });
      }
      // Plein ecran : cible le conteneur video (pas juste <video>), pour
      // que l'incrustation eventuelle (avertissement audio, banniere de
      // format) reste visible en plein ecran plutot que d'etre coupee.
      // requestFullscreen peut echouer (navigateur qui le refuse hors
      // d'un geste utilisateur direct, deja le cas ici) : capture
      // silencieusement, sans casser le reste de l'interface.
      // Fullscreen: targets the video container (not just <video>), so
      // any overlay (audio warning, format banner) stays visible in
      // fullscreen rather than being cut off. requestFullscreen can
      // fail (a browser refusing it outside a direct user gesture,
      // already the case here): caught silently, without breaking the
      // rest of the interface.
      const fullscreenBtn = this.ctx.el.querySelector(".pwtv-fullscreen");
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
          const wrap = this.ctx.el.querySelector(".pwtv-video-wrap");
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { /* noop */ });
          } else if (wrap && wrap.requestFullscreen) {
            wrap.requestFullscreen().catch(() => { /* noop */ });
          }
        });
      }
      this.attachStream(video, this.current.url);
    }

    /* onRetry, si fourni, rend le statut reellement cliquable
       (pointer-events active uniquement dans ce cas -- un statut purement
       informatif comme "Connexion..." reste traversable au clic, comme
       avant). onRetry, if provided, makes the status genuinely clickable
       (pointer-events enabled only in that case -- a purely informational
       status like "Connecting..." stays click-through, as before). */
    setStatus(text, onRetry) {
      const el = this.ctx.el.querySelector(".pwtv-status");
      if (!el) return;
      el.textContent = text || "";
      el.hidden = !text;
      el.classList.toggle("pwtv-status-clickable", !!onRetry);
      if (onRetry) {
        el.onclick = (e) => { e.stopPropagation(); onRetry(); };
      } else {
        el.onclick = null;
      }
    }

    async attachStream(video, url) {
      const i18n = this.ctx.i18n;
      this.setStatus(i18n.t("iptv.connecting"));
      const capHeight = Number(this.ctx.settings.maxHeight);
      // "playing" (lecture reellement demarree) plutot que
      // "loadedmetadata" : l'enumeration des pistes audio par le
      // navigateur peut legerement retarder sur les seules metadonnees.
      // Commun aux deux chemins de lecture ci-dessous (hls.js et natif).
      // "playing" (playback actually started) rather than
      // "loadedmetadata": the browser's audio track enumeration can lag
      // slightly behind bare metadata. Common to both playback paths
      // below (hls.js and native).
      video.addEventListener("playing", () => this.checkAudioTrack(video), { once: true });

      /* Mode de compatibilite active (audio seul ou complet) : le flux
         passe par le PiBoard, qui reencode l'audio (et la video en mode
         "full") -- voir server/iptvAudio.js. La sortie est du MP4
         fragmente, lu nativement : hls.js est donc court-circuite dans
         les deux cas, il n'aurait rien a faire ici. Le mode "full"
         contourne ENTIEREMENT hls.js/MediaSource, utile quand aucun
         diagnostic de codec cote navigateur n'a rien trouve d'anormal a
         signaler malgre un echec persistant.
         Compatibility mode enabled (audio-only or full): the stream
         goes through the PiBoard, which re-encodes the audio (and the
         video in "full" mode) -- see server/iptvAudio.js. The output is
         fragmented MP4, read natively: hls.js is therefore bypassed in
         both cases, it would have nothing to do here. "full" mode
         ENTIRELY bypasses hls.js/MediaSource, useful when no
         browser-side codec diagnostic found anything wrong to flag
         despite a persistent failure. */
      // Le DIRECT passe desormais TOUJOURS par le pipeline de
      // transcodage, independamment du reglage compatMode -- pas
      // seulement en option comme pour la VOD. Raison : les URLs de
      // direct se terminent maintenant en .ts (flux MPEG-TS brut, voir
      // server/iptv.js), jamais en .m3u8 (manifeste HLS) -- .ts n'est
      // JAMAIS lisible directement par un navigateur, quel que soit le
      // fournisseur. compatMode continue de controler UNIQUEMENT le
      // niveau (audio seul/complet) pour ce cas deja obligatoire, et
      // reste optionnel pour la VOD (qui, elle, se lit nativement,
      // confirme par retour utilisateur).
      // LIVE now ALWAYS goes through the transcode pipeline,
      // regardless of the compatMode setting -- not just optionally
      // like for VOD. Reason: live URLs now end in .ts (raw MPEG-TS
      // stream, see server/iptv.js), never .m3u8 (HLS manifest) -- .ts
      // is NEVER directly playable by a browser, whatever the
      // provider. compatMode still controls ONLY the level (audio-only/
      // full) for this now-mandatory case, and stays optional for VOD
      // (which plays natively, confirmed by user feedback).
      const isLiveUrl = /\/live\//i.test(url);
      const compatMode = isLiveUrl ? (this.ctx.settings.compatMode === "full" ? "full" : "audio") : this.ctx.settings.compatMode;
      if (compatMode === "audio" || compatMode === "full") {
        const fixUrl = "/api/iptv/audio-fix?url=" + encodeURIComponent(url) + "&mode=" + compatMode;
        video.src = fixUrl;
        // La lecture n'est tentee qu'UNE FOIS ASSEZ DE DONNEES
        // REELLEMENT DISPONIBLES ("canplay"), pas seulement une fois le
        // FORMAT reconnu ("loadedmetadata", qui peut se declencher
        // quasi instantanement avec ce type de flux -- les en-tetes
        // ftyp/moov minimalistes de "empty_moov" suffisent a la faire
        // reagir, avant meme qu'un seul fragment de donnees reelles ne
        // soit arrive). Cet ecart est particulierement marque pour un
        // flux EN DIRECT : ffmpeg transcode en temps reel, le premier
        // fragment exploitable prend donc un temps reel a etre produit
        // -- contrairement a un fichier VOD deja entierement encode,
        // ou les donnees s'accumulent bien plus vite que le debit de
        // lecture. Les lecteurs IPTV dedies affichent d'ailleurs
        // toujours une phase de mise en memoire tampon avant le direct,
        // jamais pour la VOD : signale comme piste probable pour ce
        // qui manquait ici.
        // Playback is only attempted ONCE ENOUGH DATA IS ACTUALLY
        // AVAILABLE ("canplay"), not merely once the FORMAT is
        // recognized ("loadedmetadata", which can fire almost instantly
        // with this kind of stream -- the minimal ftyp/moov headers
        // from "empty_moov" are enough to trigger it, before a single
        // fragment of real data has even arrived). This gap is
        // particularly pronounced for a LIVE stream: ffmpeg transcodes
        // in real time, so the first usable fragment takes real time to
        // produce -- unlike an already fully-encoded VOD file, where
        // data accumulates far faster than playback consumes it.
        // Dedicated IPTV players, notably, always show a buffering
        // phase before live playback, never for VOD: flagged as the
        // likely missing piece here.
        this.setStatus(i18n.t("iptv.buffering"));
        video.addEventListener("canplay", () => { this.setStatus(""); this.safePlay(video); }, { once: true });
        video.addEventListener("error", async () => {
          // L'element video n'expose pas le statut HTTP de la requete
          // ayant echoue (juste un code d'erreur media generique) : une
          // seconde requete, dediee au diagnostic, va le chercher.
          // The video element doesn't expose the HTTP status of the
          // failed request (just a generic media error code): a second,
          // diagnostic-only request fetches it.
          try {
            const check = await fetch(fixUrl, { method: "GET", cache: "no-store" });
            if (check.status === 503) this.setStatus(i18n.t("iptv.audioFixError"));
            else if (!check.ok) this.setStatus(i18n.t("iptv.streamError") + " (HTTP " + check.status + ")");
            else this.setStatus(i18n.t("iptv.streamError"));
          } catch (e) {
            this.setStatus(i18n.t("iptv.streamError"));
          }
        }, { once: true });
        return;
      }

      const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
      const looksHls = /\.m3u8(\?|$)/i.test(url);

      if (looksHls && !nativeHls) {
        try {
          const Hls = await loadHls();
          if (!Hls || !Hls.isSupported()) throw new Error("hls unsupported");
          this.hls = new Hls({ maxBufferLength: 20, capLevelToPlayerSize: false });
          this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (capHeight > 0 && this.hls.levels && this.hls.levels.length) {
              let best = -1, bestH = -1;
              this.hls.levels.forEach((lvl, i) => {
                if (lvl.height && lvl.height <= capHeight && lvl.height > bestH) { best = i; bestH = lvl.height; }
              });
              if (best >= 0) this.hls.currentLevel = best;
            }
            // Verification PROACTIVE du codec, avant meme de tenter la
            // lecture : le manifeste peut se recuperer et s'analyser
            // avec succes (le relais CORS fonctionne, confirme) tout en
            // annoncant un codec que le moteur MediaSource du navigateur
            // ne sait pas decoder -- un cas documente dans le suivi de
            // bugs de hls.js (video-dev/hls.js#5481, notamment avec des
            // configurations de canaux audio inhabituelles). Sans cette
            // verification, le navigateur echoue avec un message
            // generique ("NotSupportedError : aucune source prise en
            // charge") qui ne dit PAS lequel des deux codecs (video ou
            // audio) est en cause -- impossible a diagnostiquer plus
            // avant sans ca.
            // PROACTIVE codec check, before even attempting playback:
            // the manifest can be fetched and parsed successfully (the
            // CORS relay works, confirmed) while still announcing a
            // codec the browser's MediaSource engine can't decode -- a
            // case documented in hls.js's own issue tracker
            // (video-dev/hls.js#5481, notably with unusual audio channel
            // configurations). Without this check, the browser fails
            // with a generic message ("NotSupportedError: no supported
            // sources") that does NOT say which of the two codecs
            // (video or audio) is at fault -- impossible to diagnose
            // further without this.
            const lvl = this.hls.levels && this.hls.levels[this.hls.currentLevel >= 0 ? this.hls.currentLevel : 0];
            if (lvl && window.MediaSource && typeof window.MediaSource.isTypeSupported === "function") {
              const unsupported = [];
              if (lvl.videoCodec && !window.MediaSource.isTypeSupported('video/mp4;codecs="' + lvl.videoCodec + '"')) unsupported.push("video: " + lvl.videoCodec);
              if (lvl.audioCodec && !window.MediaSource.isTypeSupported('audio/mp4;codecs="' + lvl.audioCodec + '"')) unsupported.push("audio: " + lvl.audioCodec);
              if (unsupported.length) {
                console.warn("[piboard/iptv] codec(s) non pris en charge par ce navigateur :", unsupported.join(", "));
                this.setStatus(i18n.t("iptv.streamError") + " (codec non pris en charge : " + unsupported.join(", ") + ")");
                return;
              }
            }
            this.setStatus("");
            this.safePlay(video);
          });
          // Second controle, complementaire au precedent : le codec
          // indique dans le manifeste (verifie ci-dessus) est FACULTATIF
          // dans la norme HLS, et de nombreux flux IPTV -- concus pour
          // VLC, qui n'en a pas besoin -- ne le fournissent tout
          // simplement pas. BUFFER_CODECS, lui, reflete le codec
          // REELLEMENT DETECTE par hls.js apres analyse des donnees du
          // premier fragment (lecture du conteneur mp4 ou du type ADTS
          // pour l'AAC en MPEG-TS) : toujours disponible, meme quand le
          // manifeste ne dit rien. Necessaire pour couvrir precisement
          // le cas signale : plus de message generique du navigateur
          // apres un manifeste analyse avec succes, sans que le premier
          // controle n'ait rien trouve a signaler.
          // Second, complementary check: the codec stated in the
          // manifest (checked above) is OPTIONAL per the HLS spec, and
          // many IPTV streams -- built for VLC, which doesn't need it --
          // simply don't provide it. BUFFER_CODECS, on the other hand,
          // reflects the codec hls.js ACTUALLY DETECTED after analyzing
          // the first fragment's data (reading the mp4 container or the
          // ADTS type for AAC-in-MPEG-TS): always available, even when
          // the manifest says nothing. Needed to precisely cover the
          // reported case: still a generic browser message after a
          // successfully parsed manifest, with the first check finding
          // nothing to flag.
          this.hls.once(Hls.Events.BUFFER_CODECS, (evt, data) => {
            if (!window.MediaSource || typeof window.MediaSource.isTypeSupported !== "function") return;
            const unsupported = [];
            Object.keys(data.tracks || {}).forEach((kind) => {
              const track = data.tracks[kind];
              const codec = track && (track.levelCodec || track.codec);
              const container = (track && track.container) || "video/mp4";
              if (codec && !window.MediaSource.isTypeSupported(container + ';codecs="' + codec + '"')) {
                unsupported.push(kind + ": " + codec);
              }
            });
            if (unsupported.length) {
              console.warn("[piboard/iptv] codec(s) reellement detecte(s) non pris en charge :", unsupported.join(", "));
              this.setStatus(i18n.t("iptv.streamError") + " (codec non pris en charge : " + unsupported.join(", ") + ")");
            }
          });
          this.hls.on(Hls.Events.ERROR, (evt, data) => {
            if (!data.fatal) return;
            console.warn("[piboard/iptv] hls", data.type, data.details);
            // Le type + le code precis (ex. "networkError /
            // manifestLoadError", ou "networkError / levelLoadError")
            // s'affiche desormais a l'ecran, pas seulement dans la
            // console -- second endroit ou un message generique sans
            // detail pouvait s'afficher, en plus de l'echec de
            // chargement de hls.js lui-meme deja couvert. Precise
            // notamment SI le manifeste initial a ete recupere avec
            // succes (le relais CORS fonctionne) mais qu'un segment
            // individuel echoue ensuite -- un probleme distinct.
            // The type + precise code (e.g. "networkError /
            // manifestLoadError", or "networkError / levelLoadError")
            // now shows on screen, not just in the console -- a second
            // spot where a generic, detail-less message could show, in
            // addition to hls.js's own load failure already covered.
            // Notably clarifies WHETHER the initial manifest was
            // fetched successfully (the CORS relay works) but an
            // individual segment then failed -- a distinct problem.
            this.setStatus(i18n.t("iptv.streamError") + " (" + data.type + " / " + data.details + ")");
          });
          // attachMedia() D'ABORD, loadSource() ensuite -- declenche par
          // MEDIA_ATTACHED plutot qu'appele immediatement. Plusieurs
          // signalements independants dans le suivi de bugs de hls.js
          // (dont un "NotSupportedError" quasi identique, video-dev/
          // hls.js#432 et #4952) documentent que l'ordre inverse
          // (utilise jusqu'ici : loadSource() PUIS attachMedia(), tous
          // deux synchrones) provoque de facon intermittente cette
          // meme erreur -- une course entre l'attachement du flux
          // media et le debut du chargement, dependante du moment
          // exact ou le moteur MSE du navigateur devient pret. Cet
          // ordre est signale plus fiable.
          //
          // Le relais serveur (voir server/iptvHlsProxy.js) reste
          // inchange : hls.js recupere le manifeste ET chaque segment
          // via des requetes JavaScript, soumises au CORS --
          // contrairement a la lecture native (<video src>, utilisee
          // pour les films et series), qui n'y est pas soumise. Sans ce
          // relais, les chaines en direct ne demarrent jamais, les
          // panneaux IPTV n'envoyant pas d'en-tetes CORS.
          //
          // attachMedia() FIRST, loadSource() next -- triggered by
          // MEDIA_ATTACHED rather than called immediately. Several
          // independent reports in hls.js's own issue tracker (including
          // a near-identical "NotSupportedError", video-dev/hls.js#432
          // and #4952) document that the reverse order (used until now:
          // loadSource() THEN attachMedia(), both synchronous)
          // intermittently causes this exact error -- a race between
          // attaching the media source and starting the load, dependent
          // on exactly when the browser's MSE engine becomes ready. This
          // order is reported more reliable.
          //
          // The server relay (see server/iptvHlsProxy.js) stays
          // unchanged: hls.js fetches the manifest AND every segment via
          // JavaScript requests, subject to CORS -- unlike native
          // playback (<video src>, used for movies and series), which
          // isn't subject to it. Without this relay, live channels never
          // start, IPTV panels not sending CORS headers.
          this.hls.once(Hls.Events.MEDIA_ATTACHED, () => {
            this.hls.loadSource("/api/iptv/hls-proxy?url=" + encodeURIComponent(url));
          });
          this.hls.attachMedia(video);
          return;
        } catch (e) {
          console.warn("[piboard/iptv] hls.js indisponible", e);
          // AUCUN repli sur <video src=url> ici pour un flux .m3u8 sur
          // un navigateur sans decodage HLS natif : Chromium (Pi comme
          // Electron) ne sait de toute facon PAS lire un manifeste HLS
          // brut, quel que soit le relais -- confirme par le message
          // NotSupportedError observe en pratique. Utiliser l'URL brute
          // ici contournerait en plus le relais CORS (voir plus haut),
          // reproduisant exactement le blocage d'origine sous un autre
          // visage. Mieux vaut un message d'erreur honnete qu'une
          // tentative vouee a l'echec.
          // NO fallback to <video src=url> here for an .m3u8 stream on a
          // browser without native HLS decoding: Chromium (Pi as much as
          // Electron) simply CANNOT read a raw HLS manifest regardless
          // of the relay -- confirmed by the NotSupportedError observed
          // in practice. Using the raw URL here would also bypass the
          // CORS relay (see above), reproducing the exact original block
          // under a different guise. Better an honest error message than
          // an attempt doomed to fail.
          //
          // Le detail exact (voir loadHls()) s'affiche directement a
          // l'ecran plutot que dans la seule console : permet de
          // diagnostiquer a distance sans acces aux outils de
          // developpement, ce qui a ete un obstacle reel jusqu'ici.
          // The exact detail (see loadHls()) shows directly on screen
          // rather than only in the console: allows diagnosing remotely
          // without access to developer tools, which has been a real
          // obstacle so far.
          this.setStatus(i18n.t("iptv.streamError") + (e && e.message ? " (" + e.message + ")" : ""));
          return;
        }
      }

      video.src = url;
      video.addEventListener("loadedmetadata", () => this.setStatus(""), { once: true });
      video.addEventListener("error", () => this.setStatus(i18n.t("iptv.streamError")), { once: true });
      this.safePlay(video);
    }

    /* Verifie, une fois la lecture demarree, qu'une piste audio
       DECODABLE par le navigateur a bien ete trouvee. La plupart des
       fournisseurs IPTV encodent l'audio en AC3/DTS (compatibilite avec
       les box TV et televiseurs) -- des formats qu'AUCUN navigateur ne
       sait decoder (restriction de licence, verifie par recherche), meme
       si la video elle-meme (H.264) se lit sans probleme. Le bouton
       muet/son n'y change rien : il n'y a tout simplement aucun flux
       audio exploitable qui arrive jusqu'au navigateur. Le signaler
       honnetement plutot que de laisser deviner si la fonctionnalite est
       cassee. HTMLMediaElement.audioTracks est une extension propre a
       Chromium, mais ce projet ne vise que des navigateurs Chromium
       (kiosque Pi, Electron) -- fiable dans ce contexte precis.
       Checks, once playback has started, that a browser-DECODABLE audio
       track was actually found. Most IPTV providers encode audio in
       AC3/DTS (compatibility with set-top boxes and TVs) -- formats NO
       browser can decode (a licensing restriction, verified by
       research), even though the video itself (H.264) plays fine. The
       mute/sound button changes nothing about that: there simply is no
       usable audio stream reaching the browser. Reported honestly rather
       than leaving it to guess whether the feature is broken.
       HTMLMediaElement.audioTracks is a Chromium-specific extension, but
       this project only targets Chromium browsers (Pi kiosk, Electron)
       -- reliable in this specific context. */
    checkAudioTrack(video) {
      const i18n = this.ctx.i18n;
      const el = this.ctx.el.querySelector(".pwtv-audio-warn");
      if (!el) return;
      const tracks = video.audioTracks;
      const hasAudio = !tracks || tracks.length > 0; // API absente : ne pas affirmer a tort / API absent: don't wrongly assert
      el.hidden = hasAudio;
      el.title = i18n.t("iptv.noAudioTrack");
    }

    play(item) {
      this.stopPlayback();
      this.current = item;
      this.view = "player";
      // Liste COMPLETE (non filtree par une recherche en cours, qui
      // pourrait changer ou etre effacee independamment) et position de
      // l'element dans cette liste : necessaire pour la navigation
      // precedent/suivant. Naviguer dans la liste complete plutot que
      // filtree evite un blocage si une recherche ne laissait qu'un
      // seul resultat au moment du clic initial.
      // FULL list (not filtered by an in-progress search, which could
      // change or be cleared independently) and the item's position in
      // it: needed for previous/next navigation. Navigating the full
      // list rather than a filtered one avoids a dead end if a search
      // left only one result at the moment of the initial click.
      this.navList = this.mode === "xtream" ? (this.xItems || []) : this.channels;
      this.navIndex = this.navList.findIndex((it) => it.url === item.url);
      this.ctx.api.state.put(this.stateKey(), item.url).catch(() => { /* non bloquant / non-blocking */ });
      this.renderPlayer();
    }

    stopPlayback() {
      if (this.hls) {
        try { this.hls.destroy(); } catch (e) { /* noop */ }
        this.hls = null;
      }
      const video = this.ctx.el.querySelector(".pwtv-video");
      if (video) {
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) { /* noop */ }
      }
    }

    destroy() {
      // Essentiel ici : une tuile detruite ne doit surtout pas laisser
      // un flux video tourner en arriere-plan sur un Pi. Essential
      // here: a destroyed tile must absolutely not leave a video stream
      // running in the background on a Pi.
      this.stopPlayback();
    }
  }

  window.PiBoard.registerWidget("iptv", IptvWidget);
})();
