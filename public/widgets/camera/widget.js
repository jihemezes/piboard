/* PiBoard widget: camera / camera IP
   Affiche une ou plusieurs cameras IP / portiers connectes (RTSP,
   compatibles ONVIF -- voir server/cameraStream.js pour le detail du
   pipeline serveur). Chaque camera configuree a son propre mode
   d'affichage : photo rafraichie periodiquement, direct demarre
   immediatement, ou photo avec bascule vers le direct au tap.

   Le direct est TOUJOURS a la demande cote client : l'element <video>
   n'a de src que pendant qu'il est effectivement affiche, et src est
   explicitement vide (+ video.load()) des qu'on revient a la photo ou
   que la tuile est detruite -- c'est ce qui coupe la connexion HTTP et
   donc tue le processus ffmpeg cote serveur (voir
   server/cameraStream.js:streamLive, qui tue ffmpeg sur "res close").
   Aucune minuterie ni etat a gerer ici pour ca : la duree de vie du
   flux suit exactement la duree de vie de l'element video.

   Shows one or more IP cameras / smart doorbells (RTSP,
   ONVIF-compatible -- see server/cameraStream.js for the server-side
   pipeline detail). Each configured camera has its own display mode:
   periodically refreshed photo, live started immediately, or photo
   with a tap-to-switch to live.

   Live is ALWAYS on demand on the client side: the <video> element
   only ever has a src while it's actually shown, and src is explicitly
   cleared (+ video.load()) as soon as we go back to photo or the tile
   is destroyed -- that's what closes the HTTP connection and so kills
   the ffmpeg process server-side (see server/cameraStream.js:
   streamLive, which kills ffmpeg on "res close"). No timer or state to
   manage for this: the stream's lifetime exactly follows the video
   element's lifetime. */
(function () {
  "use strict";

  const MAX_CAMERAS = 4;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Liste des cameras reellement configurees (nom ET URL RTSP
     presents) parmi les MAX_CAMERAS emplacements fixes des reglages --
     meme principe que les fuseaux additionnels de l'horloge
     (extraZone1..3). Pure.
     List of ACTUALLY configured cameras (both name AND RTSP URL
     present) among the MAX_CAMERAS fixed setting slots -- same
     principle as the clock's extra zones (extraZone1..3). Pure. */
  function cameraConfigs(settings) {
    const list = [];
    for (let i = 1; i <= MAX_CAMERAS; i++) {
      const name = (settings["camera" + i + "Name"] || "").trim();
      const rtsp = (settings["camera" + i + "Rtsp"] || "").trim();
      if (!name || !rtsp) continue;
      list.push({
        idx: i,
        name,
        rtsp,
        snapshotUrl: (settings["camera" + i + "SnapshotUrl"] || "").trim(),
        mode: settings["camera" + i + "Mode"] || "both",
        transcode: !!settings["camera" + i + "Transcode"]
      });
    }
    return list;
  }

  class CameraWidget {
    constructor(ctx) {
      this.ctx = ctx;
      // idx -> { mode: "snapshot"|"live", refreshTimer }
      this.cards = new Map();
    }

    async init() {
      this.render();
    }

    render() {
      const i18n = this.ctx.i18n;
      this.teardownCards();
      const cams = cameraConfigs(this.ctx.settings);

      if (!cams.length) {
        this.ctx.el.innerHTML = `<div class="pw-camera"><div class="pwcam-empty">${i18n.t("camera.empty")}</div></div>`;
        return;
      }

      this.ctx.el.innerHTML = `
        <div class="pw-camera">
          <div class="pwcam-grid" style="--pwcam-count:${cams.length}">
            ${cams.map((c) => this.cardHtml(c)).join("")}
          </div>
        </div>`;

      cams.forEach((c) => this.wireCard(c));
    }

    cardHtml(c) {
      const i18n = this.ctx.i18n;
      const hasSnapshot = c.mode !== "live";
      const hasLive = c.mode !== "snapshot";
      return `
        <div class="pwcam-card" data-idx="${c.idx}">
          <div class="pwcam-header">
            <span class="pwcam-name">${escapeHtml(c.name)}</span>
            ${(hasLive && hasSnapshot) ? `<button type="button" class="pwcam-toggle" data-idx="${c.idx}" title=""></button>` : ""}
          </div>
          <div class="pwcam-body">
            ${hasSnapshot ? `<img class="pwcam-img" alt="${escapeHtml(c.name)}" hidden>` : ""}
            ${hasLive ? `<video class="pwcam-video" muted playsinline autoplay hidden></video>` : ""}
            <div class="pwcam-status">${i18n.t("common.loading")}</div>
          </div>
        </div>`;
    }

    wireCard(c) {
      const el = this.ctx.el.querySelector(`.pwcam-card[data-idx="${c.idx}"]`);
      if (!el) return;
      const state = { mode: null, refreshTimer: null };
      this.cards.set(c.idx, state);

      const toggleBtn = el.querySelector(".pwcam-toggle");
      if (toggleBtn) {
        // stopPropagation : meme correctif que les autres tuiles
        // interactives (horloge, minuteur, diaporama) -- sans lui, ce
        // clic remonte jusqu'a la grille en mode edition et rouvre les
        // reglages de la tuile en pleine consultation.
        // stopPropagation: same fix as other interactive tiles (clock,
        // countdown, slideshow) -- without it, this click bubbles up to
        // the grid in edit mode and reopens the tile's settings mid-
        // viewing.
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (state.mode === "live") this.showSnapshot(c, el, state);
          else this.showLive(c, el, state);
        });
      }

      if (c.mode === "live") this.showLive(c, el, state);
      else this.showSnapshot(c, el, state);
    }

    setStatus(el, text) {
      const status = el.querySelector(".pwcam-status");
      if (!status) return;
      if (text) { status.textContent = text; status.hidden = false; }
      else status.hidden = true;
    }

    showSnapshot(c, el, state) {
      this.stopLive(el, state);
      state.mode = "snapshot";
      const img = el.querySelector(".pwcam-img");
      const video = el.querySelector(".pwcam-video");
      if (video) video.hidden = true;
      if (img) img.hidden = false;
      this.updateToggle(el, state);
      this.refreshSnapshotNow(c, el);
      const seconds = Math.max(5, Number(this.ctx.settings.snapshotRefreshSeconds) || 15);
      state.refreshTimer = setInterval(() => this.refreshSnapshotNow(c, el), seconds * 1000);
    }

    refreshSnapshotNow(c, el) {
      const img = el.querySelector(".pwcam-img");
      if (!img) return;
      // URL propre a la camera (plus legere, pas d'appel a ffmpeg) si
      // fournie, sinon extraction d'une image depuis le flux RTSP.
      // Camera's own URL (lighter, no ffmpeg call) if provided,
      // otherwise a frame extracted from the RTSP feed.
      const base = c.snapshotUrl
        ? "/api/camera/snapshot-url?url=" + encodeURIComponent(c.snapshotUrl)
        : "/api/camera/snapshot?url=" + encodeURIComponent(c.rtsp);
      const url = base + (base.includes("?") ? "&" : "?") + "t=" + Date.now();
      // Prechargement hors DOM : evite l'icone d'image cassee ou un
      // flash de contenu vide dans la tuile pendant le rafraichissement
      // -- l'image affichee ne change qu'une fois la nouvelle
      // effectivement disponible.
      // Off-DOM preload: avoids a broken-image icon or an empty-content
      // flash in the tile during refresh -- the displayed image only
      // changes once the new one is actually available.
      const probe = new Image();
      probe.onload = () => { img.src = url; img.hidden = false; this.setStatus(el, ""); };
      probe.onerror = () => { this.setStatus(el, this.ctx.i18n.t("camera.unavailable")); };
      probe.src = url;
    }

    showLive(c, el, state) {
      this.stopSnapshotTimer(state);
      state.mode = "live";
      const img = el.querySelector(".pwcam-img");
      const video = el.querySelector(".pwcam-video");
      if (img) img.hidden = true;
      if (!video) return;
      video.hidden = false;
      this.setStatus(el, this.ctx.i18n.t("common.loading"));
      this.updateToggle(el, state);

      video.src = "/api/camera/live?url=" + encodeURIComponent(c.rtsp) + (c.transcode ? "&transcode=1" : "");
      video.addEventListener("playing", () => this.setStatus(el, ""), { once: true });
      video.addEventListener("error", () => this.setStatus(el, this.ctx.i18n.t("camera.unavailable")), { once: true });

      let p;
      try { p = video.play(); } catch (e) { p = null; }
      if (p && typeof p.catch === "function") {
        // Muet (-an cote serveur, "muted" ici) : l'autoplay est presque
        // toujours autorise sans geste prealable. Filet de securite au
        // cas ou (politique navigateur plus stricte) -- un tap sur la
        // carte relance la lecture.
        // Muted (-an server-side, "muted" here): autoplay is almost
        // always allowed without a prior gesture. Safety net just in
        // case (a stricter browser policy) -- a tap on the card retries
        // playback.
        p.catch(() => {
          this.setStatus(el, this.ctx.i18n.t("camera.tapToView"));
          const retry = () => { video.play().catch(() => {}); el.removeEventListener("click", retry); };
          el.addEventListener("click", retry);
        });
      }
    }

    stopLive(el, state) {
      const video = el.querySelector(".pwcam-video");
      if (!video) return;
      // Vide ET recharge : c'est ce qui coupe reellement la connexion
      // HTTP en cours (une simple pause() laisse le flux ouvert cote
      // serveur, ffmpeg continuerait de tourner dans le vide).
      // Cleared AND reloaded: this is what actually closes the ongoing
      // HTTP connection (a plain pause() leaves the stream open
      // server-side, ffmpeg would keep running into the void).
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    stopSnapshotTimer(state) {
      if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
    }

    updateToggle(el, state) {
      const btn = el.querySelector(".pwcam-toggle");
      if (!btn) return;
      const i18n = this.ctx.i18n;
      if (state.mode === "live") {
        btn.textContent = "📷";
        btn.title = i18n.t("camera.backToPhoto");
      } else {
        btn.textContent = "▶";
        btn.title = i18n.t("camera.watchLive");
      }
    }

    teardownCards() {
      this.cards.forEach((state, idx) => {
        this.stopSnapshotTimer(state);
        const el = this.ctx.el.querySelector(`.pwcam-card[data-idx="${idx}"]`);
        if (el) this.stopLive(el, state);
      });
      this.cards.clear();
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
    }

    onLangChanged() { this.render(); }

    destroy() {
      this.teardownCards();
    }
  }

  window.PiBoard.registerWidget("camera", CameraWidget);
})();
