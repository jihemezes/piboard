/* PiBoard widget: webview / page web (iframe configurable) */
(function () {
  "use strict";

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

    render() {
      const s = this.ctx.settings;
      clearInterval(this.timer);
      if (this.observer) { this.observer.disconnect(); this.observer = null; }

      if (!s.url) {
        this.ctx.el.innerHTML = `<div class="pw-webview"><div class="pwv-missing">${this.ctx.i18n.t("webview.missing")}</div></div>`;
        return;
      }

      this.ctx.el.innerHTML = `<div class="pw-webview"><iframe src="${s.url}" loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>`;
      this.iframe = this.ctx.el.querySelector("iframe");
      this.applyZoom();

      // Le zoom depend de la taille de la tuile / zoom depends on tile size
      this.observer = new ResizeObserver(() => this.applyZoom());
      this.observer.observe(this.ctx.el);

      const minutes = Number(s.reload) || 0;
      if (minutes > 0) {
        this.timer = setInterval(() => {
          // eslint-disable-next-line no-self-assign
          this.iframe.src = this.iframe.src;
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
