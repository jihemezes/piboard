/* PiBoard widget: chaines TV / TV channels
   Lit une playlist M3U (format standard de VLC/Kodi) et diffuse une
   chaine dans la tuile. Deux vues qui alternent : la LISTE (recherche +
   filtre par categorie) et le LECTEUR.

   Repartition des roles : le serveur PiBoard ne recupere QUE la liste
   des chaines (question de CORS, voir server/iptv.js) ; les flux video
   sont lus directement par le navigateur, sans transiter par le Pi --
   relayer de la video le mettrait a genoux.

   Lecture HLS via hls.js, sauf sur les navigateurs qui savent lire le
   HLS nativement (Safari, iOS), ou l'element <video> suffit et donne un
   meilleur resultat.

   Reads an M3U playlist (VLC/Kodi's standard format) and plays a channel
   in the tile. Two alternating views: the LIST (search + category
   filter) and the PLAYER.

   Division of labour: the PiBoard server ONLY fetches the channel list
   (a CORS matter, see server/iptv.js); video streams are read directly
   by the browser, without going through the Pi -- relaying video would
   bring it to its knees.

   HLS playback via hls.js, except on browsers that read HLS natively
   (Safari, iOS), where the plain <video> element is enough and performs
   better. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  // Recherche insensible aux accents, comme la recherche de l'aide : une
  // liste de chaines melange volontiers "Télé", "TELE" et "Tele".
  // Accent-insensitive search, like the help's: a channel list happily
  // mixes "Télé", "TELE" and "Tele".
  function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // hls.js est vendorise (voir la route /vendor/hls du serveur) et
  // charge une seule fois pour toutes les tuiles, a la premiere lecture
  // -- inutile de peser 500 Ko au demarrage du tableau si aucune chaine
  // n'est regardee. hls.js is vendored (see the server's /vendor/hls
  // route) and loaded once for all tiles, on first playback -- no point
  // weighing 500 KB at board startup if no channel is ever watched.
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

  class IptvWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.channels = [];
      this.groups = [];
      this.filterGroup = "";
      this.search = "";
      this.current = null; // chaine en cours de lecture / channel currently playing
      this.hls = null;
      this.view = "list"; // "list" ou "player"
    }

    /* video.play() renvoie une promesse dans les navigateurs modernes,
       mais la specification autorise undefined (navigateurs anciens, et
       certains environnements de test) : appeler .catch() dessus sans
       verifier fait tomber la tuile. Enveloppe donc systematiquement.
       video.play() returns a promise in modern browsers, but the spec
       allows undefined (older browsers, and some test environments):
       calling .catch() on it unguarded takes the tile down. So it's
       always wrapped. */
    safePlay(video) {
      let p;
      try { p = video.play(); } catch (e) { p = null; }
      if (p && typeof p.catch === "function") {
        p.catch(() => this.setStatus(this.ctx.i18n.t("iptv.tapToPlay")));
      }
    }

    // Cle d'etat propre a CETTE tuile : deux tuiles Chaines TV cote a
    // cote gardent chacune leur derniere chaine. State key specific to
    // THIS tile: two side-by-side TV tiles each keep their own last
    // channel.
    stateKey() { return "iptv-last-" + this.ctx.instanceId; }

    async init() {
      this.renderShell();
      await this.loadPlaylist();
    }

    onSettingsChanged(settings) {
      const old = this.ctx.settings;
      const playlistChanged = settings.playlistUrl !== old.playlistUrl;
      this.ctx.settings = settings;
      if (playlistChanged) {
        this.stopPlayback();
        this.current = null;
        this.view = "list";
        this.filterGroup = settings.defaultGroup || "";
        this.loadPlaylist();
      } else {
        this.render();
      }
    }

    onLangChanged() { this.render(); }

    renderShell() {
      this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
    }

    async loadPlaylist() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      if (!s.playlistUrl) {
        this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${i18n.t("iptv.needConfig")}</div></div>`;
        return;
      }
      try {
        const res = await fetch("/api/iptv/playlist?url=" + encodeURIComponent(s.playlistUrl));
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        this.channels = data.channels || [];
        this.groups = data.groups || [];
        this.truncated = !!data.truncated;
        this.filterGroup = s.defaultGroup || "";
        this.render();
        if (s.autoplayLast === true && this.channels.length) {
          // Etat persistant par tuile (voir ctx.api.state dans app.js) :
          // survit a un rechargement de page, contrairement a une
          // variable en memoire. Per-tile persistent state (see
          // ctx.api.state in app.js): survives a page reload, unlike an
          // in-memory variable.
          try {
            const last = await this.ctx.api.state.get(this.stateKey());
            const found = last ? this.channels.find((c) => c.url === last) : null;
            if (found) this.play(found);
          } catch (e) { /* pas d'etat memorise / no stored state */ }
        }
      } catch (e) {
        console.warn("[piboard/iptv]", e);
        this.ctx.el.innerHTML = `<div class="pw-iptv"><div class="pwtv-msg">${i18n.t("iptv.playlistError")}</div></div>`;
      }
    }

    visibleChannels() {
      const q = normalize(this.search);
      return this.channels.filter((c) => {
        if (this.filterGroup && c.group !== this.filterGroup) return false;
        if (q && !normalize(c.name).includes(q)) return false;
        return true;
      });
    }

    render() {
      if (this.view === "player" && this.current) this.renderPlayer();
      else this.renderList();
    }

    renderList() {
      const i18n = this.ctx.i18n;
      const list = this.visibleChannels();
      const groupOpts = [`<option value="">${i18n.t("iptv.allGroups")}</option>`]
        .concat(this.groups.map((g) => `<option value="${escapeAttr(g)}" ${g === this.filterGroup ? "selected" : ""}>${escapeHtml(g)}</option>`))
        .join("");

      const rows = list.length
        ? list.map((c, i) => `
            <li class="pwtv-item" data-idx="${i}">
              ${c.logo ? `<img class="pwtv-logo" src="${escapeAttr(c.logo)}" alt="" loading="lazy">` : `<span class="pwtv-logo pwtv-logo-empty">📺</span>`}
              <span class="pwtv-name">${escapeHtml(c.name)}</span>
            </li>`).join("")
        : `<li class="pwtv-empty">${i18n.t("iptv.noMatch")}</li>`;

      this.ctx.el.innerHTML = `
        <div class="pw-iptv">
          <div class="pwtv-bar">
            <input type="search" class="pwtv-search" placeholder="${i18n.t("iptv.search")}" value="${escapeAttr(this.search)}">
            <select class="pwtv-group">${groupOpts}</select>
          </div>
          <div class="pwtv-count">${i18n.t("iptv.channelCount").replace("{n}", list.length)}${this.truncated ? " " + i18n.t("iptv.truncated") : ""}</div>
          <ul class="pwtv-list">${rows}</ul>
        </div>`;

      const searchEl = this.ctx.el.querySelector(".pwtv-search");
      searchEl.addEventListener("input", () => {
        this.search = searchEl.value;
        // Re-rend uniquement la liste, pour ne pas perdre le focus ni le
        // curseur du champ pendant la saisie. Re-renders only the list,
        // so the field's focus and caret aren't lost while typing.
        this.refreshListOnly();
      });
      this.ctx.el.querySelector(".pwtv-group").addEventListener("change", (e) => {
        this.filterGroup = e.target.value;
        this.refreshListOnly();
      });
      this.wireListClicks();
    }

    refreshListOnly() {
      const i18n = this.ctx.i18n;
      const list = this.visibleChannels();
      const ul = this.ctx.el.querySelector(".pwtv-list");
      const countEl = this.ctx.el.querySelector(".pwtv-count");
      if (countEl) countEl.textContent = i18n.t("iptv.channelCount").replace("{n}", list.length) + (this.truncated ? " " + i18n.t("iptv.truncated") : "");
      if (!ul) return;
      ul.innerHTML = list.length
        ? list.map((c, i) => `
            <li class="pwtv-item" data-idx="${i}">
              ${c.logo ? `<img class="pwtv-logo" src="${escapeAttr(c.logo)}" alt="" loading="lazy">` : `<span class="pwtv-logo pwtv-logo-empty">📺</span>`}
              <span class="pwtv-name">${escapeHtml(c.name)}</span>
            </li>`).join("")
        : `<li class="pwtv-empty">${i18n.t("iptv.noMatch")}</li>`;
      this.wireListClicks();
    }

    wireListClicks() {
      const ul = this.ctx.el.querySelector(".pwtv-list");
      if (!ul || ul.dataset.wired === "1") return;
      ul.dataset.wired = "1";
      ul.addEventListener("click", (e) => {
        const li = e.target.closest(".pwtv-item");
        if (!li) return;
        e.stopPropagation();
        const chan = this.visibleChannels()[Number(li.dataset.idx)];
        if (chan) this.play(chan);
      });
    }

    renderPlayer() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      this.ctx.el.innerHTML = `
        <div class="pw-iptv pwtv-playing">
          <div class="pwtv-video-wrap">
            <video class="pwtv-video" playsinline ${s.startMuted !== false ? "muted" : ""}></video>
            <div class="pwtv-status" hidden></div>
          </div>
          <div class="pwtv-controls">
            <button type="button" class="pwtv-btn pwtv-back" title="${i18n.t("iptv.backToList")}">☰</button>
            <span class="pwtv-current">${escapeHtml(this.current.name)}</span>
            <button type="button" class="pwtv-btn pwtv-mute">${s.startMuted !== false ? "🔇" : "🔊"}</button>
          </div>
        </div>`;

      const video = this.ctx.el.querySelector(".pwtv-video");
      // L'attribut HTML "muted" seul ne suffit pas de facon fiable : la
      // propriete doit etre fixee en JS pour que les navigateurs
      // acceptent de lancer la lecture automatiquement (comportement
      // connu de Chrome et Safari). The HTML "muted" attribute alone
      // isn't reliably enough: the property must be set in JS for
      // browsers to allow autoplay (a known Chrome and Safari
      // behaviour).
      video.muted = s.startMuted !== false;
      this.ctx.el.querySelector(".pwtv-back").addEventListener("click", () => {
        this.stopPlayback();
        this.view = "list";
        this.render();
      });
      const muteBtn = this.ctx.el.querySelector(".pwtv-mute");
      muteBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? "🔇" : "🔊";
      });
      this.attachStream(video, this.current.url);
    }

    setStatus(text) {
      const el = this.ctx.el.querySelector(".pwtv-status");
      if (!el) return;
      el.textContent = text || "";
      el.hidden = !text;
    }

    async attachStream(video, url) {
      const i18n = this.ctx.i18n;
      this.setStatus(i18n.t("iptv.connecting"));
      const capHeight = Number(this.ctx.settings.maxHeight);

      // Safari/iOS lisent le HLS nativement : l'element <video> seul y
      // donne un meilleur resultat (decodage materiel plus fiable) que
      // hls.js. Safari/iOS read HLS natively: the plain <video> element
      // performs better there (more reliable hardware decoding) than
      // hls.js.
      const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
      const looksHls = /\.m3u8(\?|$)/i.test(url);

      if (looksHls && !nativeHls) {
        try {
          const Hls = await loadHls();
          if (!Hls || !Hls.isSupported()) throw new Error("hls unsupported");
          this.hls = new Hls({
            // Un tableau de bord n'a pas besoin d'un long tampon : ca
            // economise memoire et bande passante sur un Pi.
            // A dashboard doesn't need a long buffer: saves memory and
            // bandwidth on a Pi.
            maxBufferLength: 20,
            capLevelToPlayerSize: false
          });
          this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (capHeight > 0 && this.hls.levels && this.hls.levels.length) {
              // Retient la meilleure qualite qui reste sous le plafond
              // configure -- 1080p met un Pi 4 en difficulte des lors
              // que le reste du tableau tourne a cote.
              // Picks the best quality that stays under the configured
              // cap -- 1080p strains a Pi 4 once the rest of the board
              // is running alongside.
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
          this.hls.loadSource(url);
          this.hls.attachMedia(video);
          return;
        } catch (e) {
          console.warn("[piboard/iptv] hls.js indisponible, repli natif", e);
        }
      }

      // Repli (HLS natif, ou flux direct type MP4/TS progressif).
      // Fallback (native HLS, or a direct MP4/progressive-TS stream).
      video.src = url;
      video.addEventListener("loadedmetadata", () => this.setStatus(""), { once: true });
      video.addEventListener("error", () => this.setStatus(i18n.t("iptv.streamError")), { once: true });
      this.safePlay(video);
    }

    play(channel) {
      this.stopPlayback();
      this.current = channel;
      this.view = "player";
      // Memorise la derniere chaine pour l'option "reprendre
      // automatiquement". Remembers the last channel for the "resume
      // automatically" option.
      this.ctx.api.state.put(this.stateKey(), channel.url).catch(() => { /* non bloquant / non-blocking */ });
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
      // Essentiel ici : une tuile detruite (changement de disposition,
      // planification, restauration...) ne doit surtout pas laisser un
      // flux video tourner en arriere-plan sur un Pi.
      // Essential here: a destroyed tile (layout change, scheduling,
      // restore...) must absolutely not leave a video stream running in
      // the background on a Pi.
      this.stopPlayback();
    }
  }

  window.PiBoard.registerWidget("iptv", IptvWidget);
})();
