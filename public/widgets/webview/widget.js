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
      if (s.mode === "direct") return s.url;
      const p = "/api/webview-proxy?url=" + encodeURIComponent(s.url);
      return bust ? (p + "&t=" + Date.now()) : p;
    }

    render() {
      const s = this.ctx.settings;
      clearInterval(this.timer);
      if (this.observer) { this.observer.disconnect(); this.observer = null; }

      if (!s.url) {
        this.ctx.el.innerHTML = `<div class="pw-webview"><div class="pwv-missing">${this.ctx.i18n.t("webview.missing")}</div></div>`;
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
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("webview", WebviewWidget);
})();
