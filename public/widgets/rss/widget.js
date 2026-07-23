/* PiBoard widget: RSS / Atom */
(function () {
  "use strict";

  function textOf(node, tag) {
    const el = node.querySelector(tag);
    return el ? el.textContent.trim() : "";
  }

  function parseFeed(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("invalid xml");

    // RSS 2.0
    let items = [...doc.querySelectorAll("channel > item")].map((it) => ({
      title: textOf(it, "title"),
      date: textOf(it, "pubDate")
    }));
    let source = textOf(doc, "channel > title");

    // Atom
    if (!items.length) {
      items = [...doc.querySelectorAll("feed > entry")].map((it) => ({
        title: textOf(it, "title"),
        date: textOf(it, "updated") || textOf(it, "published")
      }));
      source = source || textOf(doc, "feed > title");
    }
    return { source, items: items.filter((i) => i.title) };
  }

  function niceDate(raw, lang) {
    const d = new Date(raw);
    if (isNaN(d)) return "";
    return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  class RssWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.rotateTimer = null;
      this.feed = null;
      this.cursor = 0;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(2, Number(this.ctx.settings.refresh) || 10);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.cursor = 0;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    async refresh() {
      try {
        // Meme classe de bug que celle deja corrigee sur le widget
        // Trafic : sans parametre variant d'un cycle a l'autre, l'URL
        // demandee est EXACTEMENT la meme a chaque rafraichissement (le
        // flux ne change pas d'adresse), et le cache HTTP du navigateur
        // peut alors resservir indefiniment la reponse d'un cycle
        // precedent au lieu d'aller rechercher le flux reellement a jour
        // -- d'ou des articles qui ne bougent plus depuis la veille.
        // Same bug class already fixed on the Traffic widget: without a
        // parameter that changes from one cycle to the next, the
        // requested URL is EXACTLY the same on every refresh (the feed's
        // address doesn't change), and the browser's HTTP cache can then
        // keep serving a previous cycle's response indefinitely instead
        // of fetching the actually up-to-date feed -- hence articles
        // that stop moving since the day before.
        const proxied = this.ctx.api.proxyUrl(this.ctx.settings.url);
        const sep = proxied.includes("?") ? "&" : "?";
        const url = proxied + sep + "_=" + Date.now();
        const xml = await fetch(url, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error("proxy " + r.status);
          return r.text();
        });
        this.feed = parseFeed(xml);
        this.render();
      } catch (e) {
        console.warn("[piboard/rss]", e);
        this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-err">${this.ctx.i18n.t("rss.error")}</div></div>`;
      }
    }

    render() {
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang;
      clearInterval(this.rotateTimer);

      if (!this.feed || !this.feed.items.length) {
        this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-empty">${this.ctx.i18n.t("rss.empty")}</div></div>`;
        return;
      }

      const items = s.rotate
        ? [this.feed.items[this.cursor % this.feed.items.length]]
        : this.feed.items.slice(0, Math.max(1, Number(s.maxItems) || 6));

      this.ctx.el.innerHTML = `
        <div class="pw-rss ${s.rotate ? "pwr-rotate" : ""}">
          <div class="pwr-source" ${s.showSource ? "" : "hidden"}>${this.feed.source || ""}</div>
          <ul>
            ${items.map((it) => `
              <li>
                <div class="pwr-title">${it.title}</div>
                <div class="pwr-meta">${niceDate(it.date, lang)}</div>
              </li>`).join("")}
          </ul>
        </div>`;

      if (s.rotate && this.feed.items.length > 1) {
        this.rotateTimer = setInterval(() => {
          this.cursor = (this.cursor + 1) % this.feed.items.length;
          this.render();
        }, 8000);
      }
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.rotateTimer);
    }
  }

  window.PiBoard.registerWidget("rss", RssWidget);
})();
