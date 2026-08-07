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
    hlsLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/hls/hls.min.js";
      s.onload = () => resolve(window.Hls);
      s.onerror = () => reject(new Error("hls.js introuvable"));
      document.head.appendChild(s);
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
            this.setStatus(this.ctx.i18n.t("iptv.streamError"));
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
      this.ctx.el.innerHTML = `
        <div class="pw-iptv pwtv-playing">
          <div class="pwtv-video-wrap">
            <video class="pwtv-video" playsinline ${s.startMuted !== false ? "muted" : ""}></video>
            <div class="pwtv-status" hidden></div>
          </div>
          ${warn}
          <div class="pwtv-controls">
            <button type="button" class="pwtv-btn pwtv-back" title="${i18n.t("iptv.backToList")}">☰</button>
            <span class="pwtv-current">${escapeHtml(this.current.name)}</span>
            <span class="pwtv-audio-warn" hidden>⚠</span>
            <button type="button" class="pwtv-btn pwtv-mute">${s.startMuted !== false ? "🔇" : "🔊"}</button>
          </div>
        </div>`;

      const video = this.ctx.el.querySelector(".pwtv-video");
      video.muted = s.startMuted !== false;
      this.ctx.el.querySelector(".pwtv-back").addEventListener("click", () => {
        this.stopPlayback();
        this.view = this.mode === "xtream" ? (this.xSeries ? "xtream-episodes" : (this.xCategory ? "xtream-items" : "xtream-sources")) : "flat-list";
        this.render();
      });
      const muteBtn = this.ctx.el.querySelector(".pwtv-mute");
      muteBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? "🔇" : "🔊";
      });
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

      /* Correction du son muet activee : le flux passe par le PiBoard,
         qui reencode UNIQUEMENT l'audio (AC3/DTS -> AAC) en recopiant la
         video telle quelle -- voir server/iptvAudio.js. La sortie est du
         MP4 fragmente, lu nativement : hls.js est donc court-circuite,
         il n'aurait rien a faire ici.
         Silent-sound fix enabled: the stream goes through the PiBoard,
         which re-encodes ONLY the audio (AC3/DTS -> AAC) while copying
         the video as-is -- see server/iptvAudio.js. The output is
         fragmented MP4, read natively: hls.js is therefore bypassed, it
         would have nothing to do here. */
      if (this.ctx.settings.fixAudio === true) {
        video.src = "/api/iptv/audio-fix?url=" + encodeURIComponent(url);
        video.addEventListener("loadedmetadata", () => this.setStatus(""), { once: true });
        video.addEventListener("error", () => this.setStatus(i18n.t("iptv.audioFixError")), { once: true });
        this.safePlay(video);
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
            this.setStatus("");
            this.safePlay(video);
          });
          this.hls.on(Hls.Events.ERROR, (evt, data) => {
            if (!data.fatal) return;
            console.warn("[piboard/iptv] hls", data.type, data.details);
            this.setStatus(i18n.t("iptv.streamError"));
          });
          // Passe par le relais serveur (voir server/iptvHlsProxy.js) :
          // hls.js recupere le manifeste ET chaque segment via des
          // requetes JavaScript, soumises au CORS -- contrairement a la
          // lecture native (<video src>, utilisee pour les films et
          // series), qui n'y est pas soumise. Sans ce relais, les
          // chaines en direct ne demarrent jamais, les panneaux IPTV
          // n'envoyant pas d'en-tetes CORS (confirme par diagnostic :
          // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin puis 405 sur les
          // segments).
          // Goes through the server relay (see server/iptvHlsProxy.js):
          // hls.js fetches the manifest AND every segment via JavaScript
          // requests, subject to CORS -- unlike native playback
          // (<video src>, used for movies and series), which isn't
          // subject to it. Without this relay, live channels never
          // start, IPTV panels not sending CORS headers (confirmed by
          // diagnosis: ERR_BLOCKED_BY_RESPONSE.NotSameOrigin then 405 on
          // segments).
          this.hls.loadSource("/api/iptv/hls-proxy?url=" + encodeURIComponent(url));
          this.hls.attachMedia(video);
          return;
        } catch (e) {
          console.warn("[piboard/iptv] hls.js indisponible, repli natif", e);
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
