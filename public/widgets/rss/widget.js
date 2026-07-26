/* PiBoard widget: RSS / Atom */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function textOf(node, tag) {
    const el = node.querySelector(tag);
    return el ? el.textContent.trim() : "";
  }

  // Illustration fournie par le flux lui-meme (extension RSS Media :
  // <media:content>/<media:thumbnail>, avec legende et credit photo en
  // enfants) -- affichee dans la popup independamment du texte utilise
  // (extrait de la page ou resume du flux), le flux l'a deja preparee
  // pour un lecteur RSS.
  // Illustration provided by the feed itself (RSS Media extension:
  // <media:content>/<media:thumbnail>, with caption and photo credit as
  // children) -- shown in the popup independently from whichever text
  // is used (page extract or feed summary), the feed already prepared
  // it for an RSS reader.
  function imageOf(node) {
    const media = node.getElementsByTagName("media:content")[0] || node.getElementsByTagName("media:thumbnail")[0];
    if (!media) return null;
    const url = media.getAttribute("url");
    if (!url || !/^https?:\/\//i.test(url)) return null;
    const descEl = media.getElementsByTagName("media:description")[0];
    const creditEl = media.getElementsByTagName("media:credit")[0];
    return {
      url,
      caption: descEl ? descEl.textContent.trim() : "",
      credit: creditEl ? creditEl.textContent.trim() : ""
    };
  }

  // Lien "article" : RSS <link>texte</link>, ou Atom <link href="..."/>
  // (rel="alternate" prefere s'il y en a plusieurs, ex. "self" pour le
  // flux lui-meme). Article link: RSS <link>text</link>, or Atom
  // <link href="..."/> (rel="alternate" preferred when several are
  // present, e.g. "self" for the feed itself).
  function linkOf(node) {
    const links = [...node.querySelectorAll("link")];
    const rssLink = links.find((l) => !l.getAttribute("href") && l.textContent.trim());
    if (rssLink) return rssLink.textContent.trim();
    const alt = links.find((l) => (l.getAttribute("rel") || "alternate") === "alternate" && l.getAttribute("href"));
    if (alt) return alt.getAttribute("href");
    const any = links.find((l) => l.getAttribute("href"));
    return any ? any.getAttribute("href") : "";
  }

  // Contenu le plus riche disponible : content:encoded (RSS, souvent le
  // HTML complet de l'article) > content (Atom) > description (RSS) >
  // summary (Atom, un simple resume).
  // Richest content available: content:encoded (RSS, often the article's
  // full HTML) > content (Atom) > description (RSS) > summary (Atom, a
  // plain summary).
  function contentOf(node) {
    const encoded = node.getElementsByTagName("content:encoded")[0];
    if (encoded && encoded.textContent.trim()) return encoded.textContent;
    const content = node.querySelector("content");
    if (content && content.textContent.trim()) return content.textContent;
    const description = node.querySelector("description");
    if (description && description.textContent.trim()) return description.textContent;
    const summary = node.querySelector("summary");
    return summary ? summary.textContent : "";
  }

  // Nettoyage minimal avant affichage en popup : retire scripts/styles/
  // cadres embarques et gestionnaires d'evenements, et neutralise les
  // liens (le contenu est fait pour etre LU, pas pour naviguer -- evite
  // le piege d'un onglet ouvert qu'on ne peut plus fermer sur un kiosque
  // tactile sans clavier, meme raison que l'attribution des widgets
  // Trafic/Radar/Avions).
  // Minimal cleanup before showing in the popup: strips embedded
  // scripts/styles/frames and event handlers, and neutralizes links
  // (the content is meant to be READ, not navigated -- avoids the trap
  // of an unclosable tab on a keyboard-less touch kiosk, same reasoning
  // as the Traffic/Radar/Planes widgets' attribution). */
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      });
    });
    doc.querySelectorAll("a").forEach((a) => { a.removeAttribute("href"); a.removeAttribute("target"); });
    return doc.body.innerHTML;
  }

  function parseFeed(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("invalid xml");

    // RSS 2.0
    let items = [...doc.querySelectorAll("channel > item")].map((it) => ({
      title: textOf(it, "title"),
      date: textOf(it, "pubDate"),
      link: linkOf(it),
      content: contentOf(it),
      image: imageOf(it)
    }));
    let source = textOf(doc, "channel > title");

    // Atom
    if (!items.length) {
      items = [...doc.querySelectorAll("feed > entry")].map((it) => ({
        title: textOf(it, "title"),
        date: textOf(it, "updated") || textOf(it, "published"),
        link: linkOf(it),
        content: contentOf(it),
        image: imageOf(it)
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
      this.currentItems = []; // items effectivement rendus (sous-ensemble ou rotation) / actually rendered items (subset or rotation)
      this.modal = null;
      this.openToken = 0; // ignore une extraction qui repond apres qu'un autre article a ete ouvert / ignores an extraction that answers after another article was opened
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      // Delegation : un seul ecouteur, pose une fois, survit aux
      // re-rendus de render() (rotation, rafraichissement, changement de
      // langue) qui remplacent entierement le innerHTML.
      // Delegation: a single listener, set once, survives render()'s
      // re-renders (rotation, refresh, language change) which fully
      // replace the innerHTML.
      this.ctx.el.addEventListener("click", (e) => {
        const li = e.target.closest(".pwr-item[data-link='1']");
        if (!li) return;
        e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
        this.openArticle(Number(li.dataset.idx));
      });
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
      this.currentItems = items;

      this.ctx.el.innerHTML = `
        <div class="pw-rss ${s.rotate ? "pwr-rotate" : ""}">
          <div class="pwr-source" ${s.showSource ? "" : "hidden"}>${this.feed.source || ""}</div>
          <ul>
            ${items.map((it, idx) => `
              <li class="pwr-item ${it.link ? "pwr-clickable" : ""}" data-idx="${idx}" data-link="${it.link ? "1" : ""}">
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

    /* Cree la fenetre de lecture une seule fois (reutilisee ensuite) et
       l'ajoute a document.body pour echapper au cadre de la tuile.
       Fermeture par le bouton, la touche Echap, OU un clic sur le fond
       (contrairement a la fenetre de courbe du widget Crypto : ici pas
       de sous-navigation interne a proteger d'un clic accidentel).
       Creates the reading popup once (reused afterwards) and appends it
       to document.body to escape the tile's clipped frame. Closes via
       the button, the Escape key, OR a backdrop click (unlike the
       Crypto widget's chart popup: no internal sub-navigation to
       protect from an accidental click here). */
    ensureModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pwr-modal-card">
          <header class="modal-head">
            <h2 class="pwr-modal-title"></h2>
            <button type="button" class="modal-close" data-close aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pwr-modal-meta"></div>
          <div class="pwr-modal-body"></div>
        </div>`;
      document.body.appendChild(wrap);

      wrap.addEventListener("click", (e) => {
        if (e.target === wrap || e.target.hasAttribute("data-close")) wrap.hidden = true;
      });
      this._escHandler = (e) => { if (e.key === "Escape" && !wrap.hidden) wrap.hidden = true; };
      document.addEventListener("keydown", this._escHandler);

      this.modal = wrap;
      return wrap;
    }

    /* Illustration fournie par le flux (voir imageOf()), affichee au-dessus
       du texte quel qu'en soit la source. Image provided by the feed
       (see imageOf()), shown above the text whichever source it comes
       from. */
    figureHtml(image) {
      if (!image || !image.url) return "";
      const caption = [image.caption, image.credit].filter(Boolean).join(" — ");
      return `<figure class="pwr-modal-figure">
        <img src="${escapeAttr(image.url)}" alt="">
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>`;
    }

    async openArticle(idx) {
      const it = this.currentItems[idx];
      if (!it || !it.link) return;
      const token = ++this.openToken;
      const i18n = this.ctx.i18n;
      const lang = i18n.lang;
      const modal = this.ensureModal();
      const figureHtml = this.figureHtml(it.image);

      modal.querySelector(".pwr-modal-title").textContent = it.title;
      const metaEl = modal.querySelector(".pwr-modal-meta");
      metaEl.textContent = [this.feed && this.feed.source, niceDate(it.date, lang)].filter(Boolean).join(" · ");
      const bodyEl = modal.querySelector(".pwr-modal-body");
      bodyEl.innerHTML = figureHtml + `<p class="pwr-modal-loading">${i18n.t("common.loading")}</p>`;
      modal.hidden = false;

      // Tente de recuperer le texte complet de la page liee (mode
      // lecture, comme le mode lecture d'un navigateur -- voir
      // server/articleExtract.js) : bien plus complet que la description
      // du flux, qui n'est souvent qu'un court resume. Se rabat
      // silencieusement sur le contenu du flux en cas d'echec (page
      // injoignable, paywall, contenu juge trop pauvre...).
      // Attempts to fetch the linked page's full text (reader mode, like
      // a browser's reader mode -- see server/articleExtract.js): much
      // more complete than the feed's description, which is often just
      // a short summary. Silently falls back to the feed's own content
      // on failure (unreachable page, paywall, content judged too
      // thin...).
      let html = null;
      let extraMeta = "";
      try {
        const res = await fetch("/api/article-extract?url=" + encodeURIComponent(it.link));
        if (res.ok) {
          const article = await res.json();
          if (article && article.content) {
            html = sanitizeHtml(article.content);
            if (article.byline) extraMeta = article.byline;
            else if (article.siteName) extraMeta = article.siteName;
          }
        }
      } catch (e) {
        console.warn("[piboard/rss] extract", e);
      }

      // Une autre ouverture a eu lieu entre-temps (l'utilisateur a
      // clique un autre article, ou ferme puis rouvert) : n'ecrase pas
      // ce qui est affiche maintenant. Another opening happened in the
      // meantime (the user clicked a different article, or closed and
      // reopened): don't overwrite what's currently shown.
      if (token !== this.openToken) return;

      if (!html) {
        const fallback = sanitizeHtml(it.content);
        html = fallback.trim() ? fallback : `<p class="pwr-modal-empty">${i18n.t("rss.noContent")}</p>`;
      } else if (extraMeta) {
        metaEl.textContent = [this.feed && this.feed.source, extraMeta, niceDate(it.date, lang)].filter(Boolean).join(" · ");
      }
      bodyEl.innerHTML = figureHtml + html;
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.rotateTimer);
      if (this.modal) {
        this.modal.remove();
        if (this._escHandler) document.removeEventListener("keydown", this._escHandler);
      }
    }
  }

  window.PiBoard.registerWidget("rss", RssWidget);
})();
