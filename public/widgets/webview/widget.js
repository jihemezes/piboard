/* PiBoard widget: webview / page web (iframe configurable)

   Deux modes (reglage "mode") :
   - "proxy" (par defaut) : la page est recuperee cote serveur puis
     reexpediee depuis l'origine de PiBoard (voir /api/webview-proxy et
     server/webviewProxy.js pour le detail). Contourne le blocage
     d'affichage en iframe (X-Frame-Options/CSP) que la plupart des
     sites posent desormais par defaut -- sans ce detour, ces sites
     affichaient une page blanche silencieuse, sans la moindre erreur
     visible.
   - "direct" : ancien comportement, l'iframe pointe directement vers
     l'URL du site. Plus rapide (pas de detour serveur) et garde le
     site pleinement interactif (ses propres requetes AJAX/fetch
     visent bien son origine), mais ne fonctionne QUE si le site
     autorise explicitement l'affichage en iframe.

   Two modes (setting "mode"):
   - "proxy" (default): the page is fetched server-side then relayed
     from PiBoard's own origin (see /api/webview-proxy and
     server/webviewProxy.js for detail). Works around the
     iframe-embedding block (X-Frame-Options/CSP) most sites now set
     by default -- without this workaround, those sites showed a
     silent blank page, with no visible error at all.
   - "direct": old behavior, the iframe points straight at the site's
     URL. Faster (no server round-trip) and keeps the site fully
     interactive (its own AJAX/fetch requests correctly target its own
     origin), but only works if the site explicitly allows iframe
     embedding. */
(function () {
  "use strict";

  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Meme tolerance que server/webviewProxy.js:normalizeUrl (voir son
     commentaire) : une adresse tapee sans "https://" (par reflexe de
     barre d'adresse de navigateur) est completee plutot que rejetee.
     Necessaire ICI AUSSI, pas seulement cote serveur : le mode
     "direct" ne passe jamais par le serveur, une adresse sans schema y
     serait traitee comme une URL relative par le navigateur (echec
     silencieux) sans ce filet.
     Same tolerance as server/webviewProxy.js:normalizeUrl (see its
     comment): an address typed without "https://" (out of
     browser-address-bar habit) gets completed rather than rejected.
     Needed HERE TOO, not just server-side: "direct" mode never goes
     through the server, an address with no scheme would be treated as
     a relative URL by the browser (silent failure) without this net. */
  function normalizeUrl(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return trimmed;
    // Meme detection generique de schema que server/webviewProxy.js
    // (voir son commentaire) : un schema deja present, quel qu'il soit,
    // n'est jamais reinterprete de force.
    // Same generic scheme detection as server/webviewProxy.js (see its
    // comment): a scheme already present, whatever it is, is never
    // force-reinterpreted.
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  }

  class WebviewWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.observer = null;
    }

    init() {
      this.render();
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
    }

    frameSrc(bust) {
      const s = this.ctx.settings;
      const url = normalizeUrl(s.url);
      if (s.mode === "direct") return url;
      const p = "/api/webview-proxy?url=" + encodeURIComponent(url);
      return bust ? (p + "&t=" + Date.now()) : p;
    }

    /* Adresse de la capture d'ecran (mode "image"). La taille demandee
       suit celle de la tuile, pour que la page soit rendue au bon
       format plutot que redimensionnee ensuite -- une page rendue en
       1280x800 puis ecrasee dans une tuile etroite serait illisible.
       Screenshot address ("image" mode). The requested size follows the
       tile's own, so the page is rendered at the right shape rather
       than squeezed afterwards -- a page rendered at 1280x800 then
       crammed into a narrow tile would be unreadable. */
    shotSrc() {
      const s = this.ctx.settings;
      const scale = (Number(s.zoom) || 100) / 100;
      const w = Math.max(320, Math.round((this.ctx.el.clientWidth || 640) / scale));
      const h = Math.max(240, Math.round((this.ctx.el.clientHeight || 480) / scale));
      return "/api/webview-shot?url=" + encodeURIComponent(normalizeUrl(s.url))
        + "&w=" + w + "&h=" + h + "&t=" + Date.now();
    }

    /* Mode "image" : la capture prend plusieurs secondes sur un Pi
       (lancement de Chromium). L'image n'est remplacee qu'une fois la
       nouvelle effectivement chargee -- meme precaution que la tuile
       Camera : on evite un cadre vide clignotant a chaque
       rafraichissement.
       "Image" mode: capturing takes several seconds on a Pi (Chromium
       launch). The image is only swapped once the new one has actually
       loaded -- same precaution as the Camera tile: avoids a blinking
       empty frame on every refresh. */
    refreshShot() {
      const img = this.ctx.el.querySelector(".pwv-shot");
      const status = this.ctx.el.querySelector(".pwv-status");
      if (!img) return;
      const url = this.shotSrc();
      const probe = new Image();
      probe.onload = () => {
        img.src = url;
        img.hidden = false;
        if (status) status.hidden = true;
      };
      probe.onerror = () => {
        if (status) {
          status.textContent = this.ctx.i18n.t("webview.shotError");
          status.hidden = false;
        }
      };
      probe.src = url;
    }

    render() {
      const s = this.ctx.settings;
      clearInterval(this.timer);
      if (this.observer) { this.observer.disconnect(); this.observer = null; }

      if (!s.url) {
        this.ctx.el.innerHTML = `<div class="pw-webview"><div class="pwv-missing">${this.ctx.i18n.t("webview.missing")}</div></div>`;
        return;
      }

      if (s.mode === "shot") {
        this.ctx.el.innerHTML = `<div class="pw-webview">
          <img class="pwv-shot" alt="" hidden>
          <div class="pwv-status">${this.ctx.i18n.t("webview.shotLoading")}</div>
        </div>`;
        this.iframe = null;
        this.refreshShot();
        // Une tuile redimensionnee change la taille de rendu demandee :
        // on recapture, mais seulement apres stabilisation, pour ne pas
        // relancer Chromium a chaque pixel pendant un glisser.
        // A resized tile changes the requested render size: recapture,
        // but only once settled, so Chromium isn't relaunched on every
        // pixel during a drag.
        this.observer = new ResizeObserver(() => {
          clearTimeout(this.resizeDebounce);
          this.resizeDebounce = setTimeout(() => this.refreshShot(), 800);
        });
        this.observer.observe(this.ctx.el);

        const shotMinutes = Number(s.reload) || 0;
        if (shotMinutes > 0) {
          this.timer = setInterval(() => this.refreshShot(), shotMinutes * 60000);
        }
        return;
      }

      this.ctx.el.innerHTML = `<div class="pw-webview"><iframe src="${escapeAttr(this.frameSrc(false))}" loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>`;
      this.iframe = this.ctx.el.querySelector("iframe");
      this.applyZoom();

      // Le zoom depend de la taille de la tuile / zoom depends on tile size
      this.observer = new ResizeObserver(() => this.applyZoom());
      this.observer.observe(this.ctx.el);

      const minutes = Number(s.reload) || 0;
      if (minutes > 0) {
        this.timer = setInterval(() => {
          // Mode direct : reassignation a l'identique, comme avant (une
          // partie des sites optimisent quand meme le rechargement).
          // Mode proxy : notre reponse porte deja Cache-Control:
          // no-store, mais un identifiant change garantit malgre tout
          // une navigation fraiche plutot qu'une reassignation a
          // l'identique que certains moteurs pourraient ignorer.
          // Direct mode: reassigned as-is, like before (some sites
          // still honor the reload anyway). Proxy mode: our response
          // already carries Cache-Control: no-store, but a changing
          // identifier still guarantees a fresh navigation rather than
          // an identical reassignment some engines might skip.
          this.iframe.src = this.frameSrc(true);
        }, minutes * 60000);
      }
    }

    applyZoom() {
      if (!this.iframe) return;
      const scale = (Number(this.ctx.settings.zoom) || 100) / 100;
      const w = this.ctx.el.clientWidth;
      const h = this.ctx.el.clientHeight;
      this.iframe.style.width = Math.round(w / scale) + "px";
      this.iframe.style.height = Math.round(h / scale) + "px";
      this.iframe.style.transform = "scale(" + scale + ")";
    }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.resizeDebounce);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("webview", WebviewWidget);
})();
