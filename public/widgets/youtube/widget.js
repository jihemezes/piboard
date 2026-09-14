/* PiBoard widget: YouTube
   Lecteur officiel de YouTube en \"mode confidentialite avancee\"
   (youtube-nocookie.com), pilote par son API IFrame. Pas de cookie de
   suivi, pas de publicite personnalisee -- et, aujourd'hui, le plus
   souvent aucune publicite. Ce n'est PAS un bloqueur : rien n'est
   intercepte, la tuile joue ce que YouTube sert a ce lecteur. Voir
   l'en-tete de server/youtube.js.

   ORGANISATION. Le serveur transforme ce que l'utilisateur a colle
   (video, playlist, chaine, file) en UNE forme unique : une file de
   videos. La tuile ne connait donc qu'un seul modele -- une liste, un
   index courant -- quel que soit le mode.

   DEMARRAGE MANUEL, par choix : la tuile s'ouvre sur une affiche
   (vignette + bouton Lecture) et ne cree le lecteur qu'au premier
   clic. C'est ce clic, un vrai geste de l'utilisateur, qui autorise le
   navigateur a demarrer le son ; une lecture automatique au chargement
   serait de toute facon forcee en muet par Chromium.

   YouTube's official player in \"privacy-enhanced mode\"
   (youtube-nocookie.com), driven through its IFrame API. No tracking
   cookie, no personalized advertising -- and, today, most often no
   advertising at all. It is NOT a blocker: nothing is intercepted, the
   tile plays what YouTube serves to that player. See the header of
   server/youtube.js.

   ORGANIZATION. The server turns what the user pasted (video, playlist,
   channel, queue) into ONE single shape: a queue of videos. The tile
   therefore knows a single model -- a list, a current index -- whatever
   the mode.

   MANUAL START, by choice: the tile opens on a poster (thumbnail + Play
   button) and only creates the player on the first click. That click, a
   genuine user gesture, is what lets the browser start the sound; an
   autoplay on load would be forced muted by Chromium anyway. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Le script de l'API IFrame est charge une seule fois pour toutes les
     tuiles YouTube de la page. YouTube appelle la fonction globale
     onYouTubeIframeAPIReady quand il est pret ; on la transforme en
     promesse partagee.
     The IFrame API script is loaded once for every YouTube tile on the
     page. YouTube calls the global onYouTubeIframeAPIReady when ready;
     we turn it into a shared promise. */
  let apiPromise = null;
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => { apiPromise = null; reject(new Error("iframe_api")); };
      document.head.appendChild(tag);
      // Sans reseau, YouTube ne rappellera jamais : on ne laisse pas la
      // tuile attendre indefiniment. Without network YouTube will never
      // call back: we do not let the tile wait forever.
      setTimeout(() => { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error("iframe_api_timeout")); } }, 15000);
    });
    return apiPromise;
  }

  function i18n_title(i18n, query) {
    return i18n.t("youtube.resultsFor").replace("{query}", query);
  }

  class YouTubeWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.videos = [];        // la file / the queue
      this.index = 0;          // video courante / current video
      this.title = "";         // titre de la chaine ou playlist / channel or playlist title
      this.player = null;      // instance YT.Player, creee au premier clic / created on first click
      this.playerEl = null;    // element conteneur du lecteur / player container element
      this.error = "";
      this.loading = true;
      this.searchable = false; // une cle API est enregistree / an API key is stored
      this.search = { query: "", results: null };
      this.searchModal = null;
      this.timer = null;
      this.playing = false;
      this.panelOpen = false;
      /* Liste repliee ou non. Elle prenait jusqu'a 40 % de la hauteur
         sans aucun moyen de la reduire : sur une tuile de taille
         moyenne, la video se retrouvait a l'etroit alors que la liste
         n'est utile que le temps de choisir. L'etat est conserve avec
         la source ad hoc, pour qu'un ecran mural reste comme on l'a
         laisse.
         List collapsed or not. It took up to 40% of the height with no
         way to shrink it: on a medium tile the video ended up cramped
         while the list is only useful long enough to pick. The state is
         kept alongside the ad-hoc source, so a wall display stays as it
         was left. */
      this.listCollapsed = false;
      /* Source choisie depuis la tuile elle-meme, sans passer par les
         reglages. Elle est conservee dans le stockage d'etat de la
         tuile (meme mecanisme que les favoris du Programme TV) : coller
         un lien devant l'ecran doit survivre a un rechargement de la
         page, sinon le tableau revient a la source d'origine des que le
         Pi se reveille. Les REGLAGES, eux, ne sont pas modifies : ils
         restent la reference, et le bouton « Revenir » de la fenetre y
         ramene d'un clic.
         Source chosen from the tile itself, without going through the
         settings. It is kept in the tile's state storage (same
         mechanism as the TV guide's favourites): pasting a link in
         front of the screen must survive a page reload, otherwise the
         board reverts to the original source as soon as the Pi wakes
         up. The SETTINGS are not modified: they remain the reference,
         and the window's \"Revert\" button returns to them in one click. */
      this.stateKey = "youtube-source-" + ctx.instanceId;
      this.adhoc = null;
    }

    async init() {
      this.render();
      try {
        const saved = await this.ctx.api.state.get(this.stateKey);
        if (saved && typeof saved === "object") {
          if (saved.source) this.adhoc = { source: saved.source };
          this.listCollapsed = !!saved.listCollapsed;
        }
      } catch (e) { /* premier demarrage / first run */ }
      await Promise.all([this.loadQueue(), this.checkKey()]);
      this.render();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refreshMinutes) || 30);
      const s = this.ctx.settings;
      if (s.mode !== "queue") {
        this.timer = setInterval(() => {
          // Jamais pendant une lecture : remplacer la file sous le
          // lecteur en pleine video serait une aberration.
          // Never during playback: swapping the queue under the player
          // mid-video would be absurd.
          if (!this.playing) this.loadQueue().then(() => this.render());
        }, minutes * 60000);
      }
    }

    async onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.destroyPlayer();
      this.loading = true;
      this.render();
      await Promise.all([this.loadQueue(), this.checkKey()]);
      this.render();
      this.arm();
    }

    onLangChanged() { this.render(); }

    async checkKey() {
      try {
        const r = await fetch(`api/tile-secrets/${encodeURIComponent(this.ctx.instanceId)}/apiKey`);
        const d = await r.json();
        this.searchable = !!(d && d.configured);
      } catch (e) {
        this.searchable = false;
      }
    }

    async loadQueue() {
      const s = this.ctx.settings;
      this.error = "";
      try {
        let data;
        if (s.mode === "queue" && !(this.adhoc && this.adhoc.source)) {
          const r = await fetch("api/youtube/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: String(s.queue || "") })
          });
          data = await r.json();
        } else {
          const source = String((this.adhoc && this.adhoc.source) || s.source || "").trim();
          if (!source) { this.videos = []; this.loading = false; return; }
          const r = await fetch(`api/youtube/${encodeURIComponent(this.ctx.instanceId)}/resolve?source=${encodeURIComponent(source)}&limit=${Number(s.listCount) || 8}`);
          data = await r.json();
          if (!r.ok) throw new Error(data.error || ("status " + r.status));
        }
        this.videos = data.videos || [];
        this.title = data.title || "";
        if (this.index >= this.videos.length) this.index = 0;
      } catch (e) {
        console.warn("[piboard/youtube]", e);
        /* Les motifs techniques du serveur sont traduits ; un motif
           inconnu (erreur reseau, HTTP) est montre tel quel.
           The server's technical reasons are translated; an unknown one
           (network error, HTTP) is shown as is. */
        const msg = String(e.message || e);
        const key = "youtube.error." + msg.replace(/[^a-z_]/gi, "");
        const translated = this.ctx.i18n.t(key);
        this.error = translated === key ? msg : translated;
        this.videos = [];
      }
      this.loading = false;
    }

    /* ---------- Lecteur / player ---------- */

    async startPlayer(index) {
      if (typeof index === "number") this.index = index;
      const video = this.videos[this.index];
      if (!video) return;
      const i18n = this.ctx.i18n;
      this.playing = true;
      this.render();
      try {
        await loadApi();
      } catch (e) {
        this.playing = false;
        this.error = i18n.t("youtube.apiUnavailable");
        this.render();
        return;
      }
      const host = this.ctx.el.querySelector(".pwy-player");
      if (!host) return;
      this.destroyPlayer();
      this.playerEl = document.createElement("div");
      host.appendChild(this.playerEl);
      this.player = new window.YT.Player(this.playerEl, {
        /* youtube-nocookie.com : c'est ce parametre qui fait tout le
           mode confidentialite avancee. Le reste sont des options
           d'affichage : pas de suggestions d'autres chaines en fin de
           video (rel=0), lecture dans la page sur mobile (playsinline).
           youtube-nocookie.com: this parameter is the whole
           privacy-enhanced mode. The rest are display options: no
           suggestions from other channels at the end (rel=0), in-page
           playback on mobile (playsinline). */
        host: "https://www.youtube-nocookie.com",
        videoId: video.id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady: (ev) => {
            if (this.opt("startMuted")) ev.target.mute();
            this.applyQuality(ev.target);
            ev.target.playVideo();
          },
          onStateChange: (ev) => this.onState(ev),
          onError: (ev) => this.onPlayerError(ev)
        }
      });
    }

    /* Qualite demandee au lecteur. A dire honnetement : YouTube garde le
       dernier mot. setPlaybackQuality est une SUGGESTION, souvent
       ignoree depuis que le lecteur choisit seul selon le debit et la
       taille reelle du cadre -- une tuile de 300 pixels de large ne
       recevra pas du 1080p, quoi qu'on demande. La suggestion est
       renouvelee a chaque chargement de video parce que le lecteur
       remet son choix a zero d'une video a l'autre.
       « La plus elevee possible » se traduit par \"highres\", la valeur la
       plus haute du vocabulaire de l'API ; le lecteur redescend tout
       seul si le debit ne suit pas.
       Quality asked of the player. To be said honestly: YouTube has the
       final say. setPlaybackQuality is a SUGGESTION, often ignored now
       that the player picks on its own from bandwidth and the frame's
       real size -- a 300-pixel-wide tile will not get 1080p, whatever is
       asked. The suggestion is renewed on every video load because the
       player resets its choice from one video to the next.
       \"Highest available\" maps to \"highres\", the API vocabulary's top
       value; the player steps down by itself if bandwidth cannot keep
       up. */
    applyQuality(player) {
      const q = this.ctx.settings.quality;
      if (!q || q === "auto") return;
      try {
        if (player && typeof player.setPlaybackQuality === "function") player.setPlaybackQuality(q);
      } catch (e) { /* le lecteur reste maitre / the player stays in charge */ }
    }

    onState(ev) {
      const YT = window.YT;
      // Le lecteur reinitialise sa qualite a chaque video : on la
      // redemande des que la lecture demarre.
      // The player resets its quality on every video: we ask again as
      // soon as playback starts.
      if (ev.data === YT.PlayerState.PLAYING) this.applyQuality(ev.target);
      if (ev.data === YT.PlayerState.ENDED) {
        if (this.opt("autoNext")) this.next(true);
        else { this.playing = false; }
      }
    }

    /* Codes d'erreur du lecteur : 100 = video supprimee ou privee,
       101/150 = integration interdite par l'auteur. Dans une file, on
       passe simplement a la suivante -- une video retiree ne doit pas
       figer la tuile. Player error codes: 100 = removed or private
       video, 101/150 = embedding forbidden by the author. In a queue we
       simply move on -- a removed video must not freeze the tile. */
    onPlayerError(ev) {
      console.warn("[piboard/youtube] player error", ev.data);
      if (this.videos.length > 1 && this.opt("autoNext")) this.next(true);
      else {
        this.playing = false;
        this.error = this.ctx.i18n.t("youtube.notEmbeddable");
        this.render();
      }
    }

    next(auto) {
      if (!this.videos.length) return;
      let i = this.index + 1;
      if (i >= this.videos.length) {
        if (!this.opt("loop") && auto) { this.playing = false; this.render(); return; }
        i = 0;
      }
      this.play(i);
    }

    prev() {
      if (!this.videos.length) return;
      this.play((this.index - 1 + this.videos.length) % this.videos.length);
    }

    play(i) {
      this.index = i;
      const video = this.videos[i];
      if (!video) return;
      if (this.player && typeof this.player.loadVideoById === "function") {
        this.playing = true;
        this.player.loadVideoById(video.id);
        this.applyQuality(this.player);
        this.renderList();
      } else {
        this.startPlayer(i);
      }
    }

    destroyPlayer() {
      if (this.player) {
        try { this.player.destroy(); } catch (e) { /* deja detruit / already destroyed */ }
      }
      this.player = null;
      this.playerEl = null;
      this.playing = false;
    }

    /* ---------- Recherche (cle API) / search (API key) ----------
       Les resultats s'affichent dans une FENETRE plein ecran, comme la
       grille complete du Programme TV, et non dans la tuile : une
       vignette lisible fait 200 pixels de large, une tuile moyenne n'en
       montrerait que deux ou trois -- on ne choisit pas une video entre
       trois. La fenetre vit dans document.body (hors de la tuile) et
       est construite au premier usage.

       La pagination est celle de l'API YouTube : des jetons opaques
       (page suivante / precedente) renvoyes par le serveur et rendus
       tels quels. Une page coute 100 unites du quota gratuit
       quotidien (10 000) -- une centaine de pages par jour, largement
       assez, mais pas de quoi feuilleter sans fin : d'ou 24 resultats
       par page plutot que 12.

       Results show in a FULL-SCREEN window, like the TV guide's full
       grid, not inside the tile: a readable thumbnail is 200 pixels
       wide, a medium tile would show two or three -- nobody picks a
       video out of three. The window lives in document.body (outside
       the tile) and is built on first use.

       Pagination is YouTube's API's: opaque tokens (next / previous
       page) returned by the server and sent back as is. One page costs
       100 units of the free daily quota (10,000) -- a hundred pages a
       day, plenty, but not endless browsing: hence 24 results per page
       rather than 12. */
    ensureSearchModal() {
      if (this.searchModal) return this.searchModal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pwy-search-card">
          <header class="modal-head">
            <h2>${escapeHtml(i18n.t("youtube.searchTitle"))}</h2>
            <button type="button" class="modal-close" data-close aria-label="${escapeHtml(i18n.t("common.close"))}">&times;</button>
          </header>
          <form class="pwy-search-toolbar">
            <input type="search" class="pwy-search-q" placeholder="${escapeHtml(i18n.t("youtube.searchPlaceholder"))}" autocomplete="off">
            <select class="pwy-search-order">
              <option value="relevance">${escapeHtml(i18n.t("youtube.orderRelevance"))}</option>
              <option value="date">${escapeHtml(i18n.t("youtube.orderDate"))}</option>
              <option value="viewCount">${escapeHtml(i18n.t("youtube.orderViews"))}</option>
            </select>
            <button type="submit" class="pwy-btn">${escapeHtml(i18n.t("youtube.search"))}</button>
          </form>
          <div class="pwy-search-body"></div>
          <footer class="pwy-search-foot">
            <button type="button" class="pwy-btn" data-page="prev">&#9664; ${escapeHtml(i18n.t("youtube.prevPage"))}</button>
            <span class="pwy-search-status"></span>
            <button type="button" class="pwy-btn" data-page="next">${escapeHtml(i18n.t("youtube.nextPage"))} &#9654;</button>
          </footer>
        </div>`;
      document.body.appendChild(wrap);

      wrap.addEventListener("click", (e) => {
        if (e.target === wrap || e.target.closest("[data-close]")) this.closeSearch();
      });
      wrap.querySelector(".pwy-search-toolbar").addEventListener("submit", (e) => {
        e.preventDefault();
        this.runSearch(wrap.querySelector(".pwy-search-q").value, null);
      });
      wrap.querySelector(".pwy-search-order").addEventListener("change", () => {
        if (this.search.query) this.runSearch(this.search.query, null);
      });
      wrap.querySelectorAll("[data-page]").forEach((b) => {
        b.addEventListener("click", () => {
          const token = b.dataset.page === "next" ? this.search.nextPage : this.search.prevPage;
          if (token) this.runSearch(this.search.query, token);
        });
      });
      this.searchModal = wrap;
      return wrap;
    }

    openSearch(query) {
      const modal = this.ensureSearchModal();
      modal.hidden = false;
      const input = modal.querySelector(".pwy-search-q");
      if (query != null) input.value = query;
      if (String(input.value || "").trim()) this.runSearch(input.value, null);
      else { this.renderSearchBody(); input.focus(); }
    }

    closeSearch() {
      if (this.searchModal) this.searchModal.hidden = true;
    }

    async runSearch(query, pageToken) {
      const q = String(query || "").trim();
      const modal = this.ensureSearchModal();
      const i18n = this.ctx.i18n;
      if (!q) return;
      if (!this.searchable) {
        this.search = { query: q, results: null, error: i18n.t("youtube.searchNeedsKey"), loading: false };
        this.renderSearchBody();
        return;
      }
      const order = modal.querySelector(".pwy-search-order").value;
      // Le compteur de page n'est qu'indicatif : l'API ne donne pas de
      // numero, seulement des jetons. On le tient a la main.
      // The page counter is indicative only: the API gives no number,
      // only tokens. We keep it by hand.
      const page = !pageToken ? 1
        : (pageToken === this.search.nextPage ? this.search.page + 1 : Math.max(1, this.search.page - 1));
      this.search = { query: q, order, page, results: null, error: "", loading: true, nextPage: null, prevPage: null, total: null };
      this.renderSearchBody();
      try {
        const url = `api/youtube/${encodeURIComponent(this.ctx.instanceId)}/search?q=${encodeURIComponent(q)}&max=24&order=${encodeURIComponent(order)}${pageToken ? "&page=" + encodeURIComponent(pageToken) : ""}`;
        const r = await fetch(url);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || ("status " + r.status));
        Object.assign(this.search, { results: d.videos || [], nextPage: d.nextPage, prevPage: d.prevPage, total: d.total, loading: false });
      } catch (e) {
        console.warn("[piboard/youtube] search", e);
        const key = "youtube.error." + String(e.message || e).replace(/[^a-z_]/gi, "");
        const translated = i18n.t(key);
        Object.assign(this.search, { results: [], loading: false, error: translated === key ? String(e.message || e) : translated });
      }
      this.renderSearchBody();
    }

    renderSearchBody() {
      const modal = this.searchModal;
      if (!modal) return;
      const i18n = this.ctx.i18n;
      const body = modal.querySelector(".pwy-search-body");
      const status = modal.querySelector(".pwy-search-status");
      const prev = modal.querySelector("[data-page=prev]");
      const next = modal.querySelector("[data-page=next]");
      const st = this.search || {};

      prev.disabled = !st.prevPage;
      next.disabled = !st.nextPage;
      status.textContent = st.results && st.results.length
        ? i18n.t("youtube.pageStatus").replace("{page}", st.page || 1)
        : "";

      if (st.loading) { body.innerHTML = `<div class="pwy-empty">${i18n.t("youtube.searching")}</div>`; return; }
      if (st.error) { body.innerHTML = `<div class="pwy-empty">${escapeHtml(st.error)}</div>`; return; }
      if (!st.results) { body.innerHTML = `<div class="pwy-empty">${i18n.t("youtube.searchHint")}</div>`; return; }
      if (!st.results.length) { body.innerHTML = `<div class="pwy-empty">${i18n.t("youtube.noResults")}</div>`; return; }

      body.innerHTML = `<div class="pwy-results">${st.results.map((v, i) => `
        <button type="button" class="pwy-result" data-idx="${i}">
          <img class="pwy-result-thumb" src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy">
          <span class="pwy-result-title">${escapeHtml(v.title || v.id)}</span>
          <span class="pwy-result-meta">${escapeHtml(v.author || "")}${v.published ? " · " + escapeHtml(new Date(v.published).toLocaleDateString()) : ""}</span>
        </button>`).join("")}</div>`;
      body.scrollTop = 0;
      body.querySelectorAll(".pwy-result").forEach((b) => {
        b.addEventListener("click", () => this.playSearchResult(Number(b.dataset.idx)));
      });
    }

    /* Le resultat choisi devient la video courante et la page de
       resultats devient la file : les boutons ◀ ▶ de la tuile passent
       alors d'un resultat a l'autre sans rouvrir la fenetre. La file
       d'origine revient a la prochaine source collee, au prochain
       changement de reglages ou au prochain rechargement -- rien n'est
       enregistre.
       The chosen result becomes the current video and the results page
       becomes the queue: the tile's ◀ ▶ buttons then move between
       results without reopening the window. The original queue returns
       with the next pasted source, settings change or reload -- nothing
       is saved. */
    playSearchResult(i) {
      const list = this.search && this.search.results;
      const v = list && list[i];
      if (!v) return;
      this.closeSearch();
      this.videos = list.slice();
      this.title = i18n_title(this.ctx.i18n, this.search.query);
      this.play(i);
      this.render();
    }

    /* Une option de lecture : la valeur choisie dans la fenetre rapide
       si elle existe, sinon celle des reglages. Les reglages restent la
       valeur par defaut, la fenetre ne fait que la couvrir pour la
       session.
       A playback option: the value chosen in the quick panel if there is
       one, otherwise the settings'. The settings stay the default value,
       the panel merely covers it for the session. */
    opt(key) {
      if (this.overrides && Object.prototype.hasOwnProperty.call(this.overrides, key)) return this.overrides[key];
      return !!this.ctx.settings[key];
    }

    saveUiState() {
      const payload = Object.assign({}, this.adhoc || {}, { listCollapsed: this.listCollapsed });
      this.ctx.api.state.put(this.stateKey, payload).catch(() => {});
    }

    async setSource(text) {
      const value = String(text || "").trim();
      this.adhoc = value ? { source: value } : null;
      this.saveUiState();
      this.destroyPlayer();
      this.index = 0;
      this.loading = true;
      this.render();
      await this.loadQueue();
      this.render();
    }

    /* ---------- Rendu / rendering ---------- */

    render() {
      const i18n = this.ctx.i18n;
      const el = this.ctx.el;
      const current = this.videos[this.index];

      let main;
      if (this.loading) {
        main = `<div class="pwy-empty">${i18n.t("youtube.loading")}</div>`;
      } else if (this.error && !this.playing) {
        main = `<div class="pwy-empty">${escapeHtml(this.error)}</div>`;
      } else if (!this.videos.length) {
        main = `<div class="pwy-empty">${i18n.t("youtube.noSource")}</div>`;
      } else if (this.playing) {
        // Le lecteur est insere dans .pwy-player par startPlayer() ; le
        // rendu ne doit pas le detruire. On ne touche donc pas a ce
        // bloc s'il existe deja.
        // The player is inserted into .pwy-player by startPlayer(); the
        // rendering must not destroy it. So we leave that block alone if
        // it already exists.
        const existing = el.querySelector(".pwy-player");
        if (existing && this.playerEl) { this.renderList(); return; }
        main = `<div class="pwy-player"></div>`;
      } else {
        main = `
          <button type="button" class="pwy-poster" style="background-image:url('${escapeHtml(current.thumbnail)}')" title="${escapeHtml(i18n.t("youtube.play"))}">
            <span class="pwy-play" aria-hidden="true">&#9654;</span>
            <span class="pwy-poster-title">${escapeHtml(current.title || "")}</span>
          </button>`;
      }

      /* Barre de recherche toujours presente : sans cle API, la fenetre
         explique comment en obtenir une plutot que de cacher la
         fonction -- on ne devine pas une fonction qu'on ne voit pas.
         Search bar always present: without an API key the window
         explains how to get one rather than hiding the feature -- one
         does not guess at a feature one cannot see. */
      const search = `
        <form class="pwy-search">
          <input type="search" class="pwy-search-input" placeholder="${escapeHtml(i18n.t("youtube.searchPlaceholder"))}" autocomplete="off">
          <button type="submit" class="pwy-btn">${i18n.t("youtube.search")}</button>
        </form>`;

      const listBtn = this.videos.length > 1
        ? `<button type="button" class="pwy-btn" data-list="toggle" title="${escapeHtml(i18n.t(this.listCollapsed ? "youtube.showList" : "youtube.hideList"))}">${this.listCollapsed ? "\u25B4" : "\u25BE"}</button>`
        : "";

      const openBtn = `<button type="button" class="pwy-btn" data-panel="toggle" title="${escapeHtml(i18n.t("youtube.openPanelTitle"))}">${i18n.t("youtube.openPanel")}</button>`;

      /* Fenetre de saisie rapide. Elle ne duplique PAS les reglages :
         elle porte ce qu'on change devant l'ecran (quoi regarder, et
         les trois bascules de lecture), pas ce qu'on configure une fois
         (cle API, intervalle de relecture, nombre de videos listees).
         Quick entry panel. It does NOT duplicate the settings: it holds
         what one changes in front of the screen (what to watch, and the
         three playback toggles), not what one configures once (API key,
         re-read interval, number of videos listed). */
      const panel = this.panelOpen ? `
        <div class="pwy-panel">
          <form class="pwy-panel-form">
            <input type="text" class="pwy-url" placeholder="${escapeHtml(i18n.t("youtube.urlPlaceholder"))}" value="${escapeHtml((this.adhoc && this.adhoc.source) || "")}" autocomplete="off">
            <button type="submit" class="pwy-btn">${i18n.t("youtube.load")}</button>
          </form>
          <div class="pwy-panel-opts">
            <label><input type="checkbox" data-opt="autoNext" ${this.opt("autoNext") ? "checked" : ""}> ${i18n.t("youtube.optAutoNext")}</label>
            <label><input type="checkbox" data-opt="loop" ${this.opt("loop") ? "checked" : ""}> ${i18n.t("youtube.optLoop")}</label>
            <label><input type="checkbox" data-opt="startMuted" ${this.opt("startMuted") ? "checked" : ""}> ${i18n.t("youtube.optMuted")}</label>
          </div>
          ${this.adhoc && this.adhoc.source ? `<button type="button" class="pwy-btn pwy-revert" data-panel="revert">${i18n.t("youtube.revert")}</button>` : ""}
        </div>` : "";

      const nav = this.videos.length > 1 ? `
        <div class="pwy-nav">
          <button type="button" class="pwy-btn" data-nav="prev" title="${escapeHtml(i18n.t("youtube.prev"))}">&#9664;</button>
          <span class="pwy-counter">${this.index + 1} / ${this.videos.length}</span>
          <button type="button" class="pwy-btn" data-nav="next" title="${escapeHtml(i18n.t("youtube.next"))}">&#9654;</button>
        </div>` : "";

      el.innerHTML = `
        <div class="pw-youtube">
          <div class="pwy-main">${main}</div>
          <div class="pwy-bar">
            ${this.title ? `<span class="pwy-title" title="${escapeHtml(this.title)}">${escapeHtml(this.title)}</span>` : "<span></span>"}
            ${nav}
            ${listBtn}
            ${openBtn}
          </div>
          ${panel}
          ${search}
          <div class="pwy-list"></div>
        </div>`;
      this.renderList();
      this.wire();
    }

    renderList() {
      const box = this.ctx.el.querySelector(".pwy-list");
      if (!box) return;
      const i18n = this.ctx.i18n;
      const list = this.videos;
      if (list.length <= 1) { box.innerHTML = ""; box.hidden = true; return; }
      if (this.listCollapsed) { box.innerHTML = ""; box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = list.map((v, i) => `
        <button type="button" class="pwy-item ${i === this.index ? "pwy-current" : ""}" data-idx="${i}">
          <img class="pwy-thumb" src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy">
          <span class="pwy-item-text">
            <span class="pwy-item-title">${escapeHtml(v.title || v.id)}</span>
            ${v.author ? `<span class="pwy-item-meta">${escapeHtml(v.author)}</span>` : ""}
          </span>
        </button>`).join("");
      const cur = box.querySelector(".pwy-current");
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
      box.querySelectorAll(".pwy-item").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.play(Number(b.dataset.idx));
        });
      });
    }

    wire() {
      const el = this.ctx.el;
      // stopPropagation() partout : en mode edition, un clic sur la tuile
      // ouvrirait ses reglages a la place de l'action.
      // stopPropagation() everywhere: in edit mode, a click on the tile
      // would open its settings instead of the action.
      const poster = el.querySelector(".pwy-poster");
      if (poster) poster.addEventListener("click", (e) => { e.stopPropagation(); this.startPlayer(); });
      el.querySelectorAll("[data-nav]").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (b.dataset.nav === "next") this.next(false); else this.prev();
        });
      });
      const form = el.querySelector(".pwy-search");
      if (form) {
        form.addEventListener("click", (e) => e.stopPropagation());
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openSearch(form.querySelector(".pwy-search-input").value);
        });
      }
      const player = el.querySelector(".pwy-player");
      if (player) player.addEventListener("click", (e) => e.stopPropagation());

      el.querySelectorAll("[data-list]").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.listCollapsed = !this.listCollapsed;
          this.saveUiState();
          this.render();
        });
      });

      el.querySelectorAll("[data-panel]").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (b.dataset.panel === "revert") { this.panelOpen = false; this.setSource(""); return; }
          this.panelOpen = !this.panelOpen;
          this.render();
        });
      });
      const panelForm = el.querySelector(".pwy-panel-form");
      if (panelForm) {
        panelForm.addEventListener("click", (e) => e.stopPropagation());
        panelForm.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.panelOpen = false;
          this.setSource(panelForm.querySelector(".pwy-url").value);
        });
      }
      el.querySelectorAll("[data-opt]").forEach((box) => {
        box.addEventListener("click", (e) => e.stopPropagation());
        box.addEventListener("change", () => {
          this.overrides = this.overrides || {};
          this.overrides[box.dataset.opt] = box.checked;
          // Le muet s'applique tout de suite s'il y a un lecteur : sinon
          // l'option ne servirait qu'a la video suivante, ce qui n'est
          // pas ce qu'on attend d'une case a cocher devant l'ecran.
          // Muting applies at once if a player exists: otherwise the
          // option would only affect the next video, which is not what
          // one expects from a checkbox in front of the screen.
          if (box.dataset.opt === "startMuted" && this.player) {
            if (box.checked && this.player.mute) this.player.mute();
            else if (this.player.unMute) this.player.unMute();
          }
        });
      });
    }

    destroy() {
      clearInterval(this.timer);
      this.destroyPlayer();
      // La fenetre de recherche vit dans document.body : sans ce retrait,
      // supprimer la tuile la laisserait orpheline dans la page.
      // The search window lives in document.body: without this removal,
      // deleting the tile would leave it orphaned in the page.
      if (this.searchModal && this.searchModal.parentNode) this.searchModal.remove();
      this.searchModal = null;
    }
  }

  window.PiBoard.registerWidget("youtube", YouTubeWidget);
})();
