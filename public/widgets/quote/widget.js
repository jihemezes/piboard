/* PiBoard widget: quote / citation du jour
   Bibliotheque locale embarquee : fonctionne hors-ligne, aucune requete
   externe. Depuis la 1.112.0 : trois sources combinables (citations et
   pensees, pensees de Jean-Claude Van Damme, blagues hommage a Chuck
   Norris), dosage des blagues, themes, citations personnelles, aucune
   repetition avant d'avoir tout vu, toucher pour la suivante, appui
   long pour les favoris. Le tirage vit dans engine.js (pur, teste).

   Bundled local library, fully offline. Since 1.112.0: three combinable
   sources, joke frequency, themes, custom quotes, no repetition until
   everything has been shown, tap for the next one, long press for
   favourites. Drawing lives in engine.js (pure, tested). */
(function () {
  "use strict";

  let DATA = null;
  let loadPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.PiBoardQuoteEngine) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        if (window.PiBoardQuoteEngine) resolve();
        else reject(new Error("engine.js charge mais vide / loaded but empty"));
      };
      s.onerror = () => reject(new Error("engine.js introuvable / not found (" + src + ")"));
      document.head.appendChild(s);
    });
  }

  /* Les fichiers passent par ctx.assetUrl : ils portent alors le numero
     de version, comme widget.js. Sans cela, apres une mise a jour, le
     kiosque pouvait servir depuis son cache l'ANCIEN quotes.json (ou
     ne pas aller chercher engine.js du tout) alors que le reste de la
     tuile etait a jour (1.112.4).
     Files go through ctx.assetUrl, so they carry the version number
     like widget.js. Without it, after an update the kiosk could serve
     the OLD quotes.json from its cache while the rest of the tile was
     up to date. */
  function load(ctx) {
    if (loadPromise) return loadPromise;
    const url = (f) => (typeof ctx.assetUrl === "function"
      ? ctx.assetUrl(f)
      : "widgets/" + ctx.manifest.dir + "/" + f);
    loadPromise = Promise.all([
      loadScript(url("engine.js")),
      fetch(url("quotes.json")).then(async (r) => {
        if (!r.ok) throw new Error("quotes.json : HTTP " + r.status);
        try { return await r.json(); } catch (e) { throw new Error("quotes.json illisible / unreadable"); }
      })
    ]).then(([, data]) => {
      // Ancien format (tableau simple) toujours accepte.
      // Old format (plain array) still accepted.
      DATA = Array.isArray(data)
        ? data.map((q, i) => Object.assign({ id: "legacy-" + i, cat: "quote", theme: "wisdom" }, q))
        : (data.items || []);
      if (!DATA.length) throw new Error("collection vide / empty collection");
      return DATA;
    }).catch((e) => { loadPromise = null; throw e; });
    return loadPromise;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Pictogrammes par source, desactivables. / Per-source icons. */
  const ICONS = {
    quote: '<svg viewBox="0 0 24 24"><path d="M7 7h4v4c0 3-1.5 5-4 6"/><path d="M14 7h4v4c0 3-1.5 5-4 6"/></svg>',
    jcvd: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/></svg>',
    chuck: '<svg viewBox="0 0 24 24"><path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 9.5V5.5a1.5 1.5 0 0 1 3 0v4"/><path d="M13 9.5V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M16 10a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L7 13"/></svg>',
    custom: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>'
  };

  const TXT = {
    fr: { fav: "Ajouté aux favoris", unfav: "Retiré des favoris", noFav: "Aucun favori pour l'instant : un appui long sur une citation l'ajoute.", empty: "Aucune source cochée dans les réglages de la tuile.", loadFailed: "La collection de citations n'a pas pu être chargée. Touchez pour réessayer." },
    en: { fav: "Added to favourites", unfav: "Removed from favourites", noFav: "No favourites yet: long-press a quote to add it.", empty: "No source ticked in the tile settings.", loadFailed: "The quote collection could not be loaded. Tap to retry." }
  };

  const LONG_PRESS_MS = 600;
  const STORE_PREFIX = "piboard.quote.";

  class QuoteWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.dayTimer = null;
      this.current = null;
      this.pressTimer = null;
      this.longPressed = false;
    }

    t(key) {
      return (TXT[this.ctx.i18n.lang] || TXT.en)[key];
    }

    /* Etat du tirage : dans le navigateur de l'ecran (il survit aux
       redemarrages du kiosque). Pas dans le layout : chaque citation
       declencherait un enregistrement et une diffusion a tous les
       ecrans.
       Draw state: kept in the screen's browser (survives kiosk
       restarts). Not in the layout: every quote would trigger a save
       and a broadcast to all screens. */
    readState() {
      try { return JSON.parse(localStorage.getItem(STORE_PREFIX + this.ctx.instanceId) || "null"); } catch (e) { return null; }
    }

    writeState(st) {
      try { localStorage.setItem(STORE_PREFIX + this.ctx.instanceId, JSON.stringify(st)); } catch (e) { /* stockage indisponible / storage unavailable */ }
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-quote" role="button" tabindex="0"></div>`;
      const box = this.ctx.el.querySelector(".pw-quote");
      this.bindGestures(box);
      /* Un echec de chargement est affiche DANS la tuile, avec sa
         cause : sinon le tableau ne montrait que « Cette tuile n'a pas
         pu etre chargee », sans rien pour comprendre. Toucher la tuile
         reessaye.
         A loading failure is shown IN the tile, with its cause:
         otherwise the board only showed the generic "This tile could
         not be loaded". Tapping the tile retries. */
      try {
        await load(this.ctx);
      } catch (e) {
        console.error("[piboard] citation : chargement", e);
        this.loadError = String((e && e.message) || e);
        this.render();
        return;
      }
      this.loadError = null;
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);
      this.show(false);
      this.arm();
    }

    bindGestures(box) {
      const editing = () => document.body.classList.contains("editing");
      const cancel = () => { clearTimeout(this.pressTimer); this.pressTimer = null; };
      box.addEventListener("pointerdown", (e) => {
        if (editing() || (e.button != null && e.button !== 0)) return;
        this.longPressed = false;
        cancel();
        this.pressTimer = setTimeout(() => {
          this.pressTimer = null;
          this.longPressed = true;
          this.toggleFavorite();
        }, LONG_PRESS_MS);
      });
      box.addEventListener("pointerup", cancel);
      box.addEventListener("pointerleave", cancel);
      box.addEventListener("pointercancel", cancel);
      box.addEventListener("contextmenu", (e) => { if (!editing()) e.preventDefault(); });
      box.addEventListener("click", () => {
        if (editing()) return;
        if (this.longPressed) { this.longPressed = false; return; }
        if (this.loadError) { this.init(); return; }
        this.show(true);
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.show(true); }
        else if (e.key === "f" || e.key === "F") this.toggleFavorite();
      });
    }

    draw(forceNext) {
      const E = window.PiBoardQuoteEngine;
      const s = this.ctx.settings;
      const opts = { seed: this.ctx.instanceId };
      const prev = this.readState();
      let r;
      if (s.mode === "interval" || forceNext) {
        r = E.next(DATA, s, prev, opts);
        // En mode quotidien, « suivante » devient la citation du jour.
        // In daily mode, "next" becomes the quote of the day.
        if (r.item && s.mode !== "interval") r.state.day = { date: this.today(), id: r.item.id };
      } else {
        r = E.forDay(DATA, s, prev, this.today(), opts);
      }
      this.writeState(r.state);
      return r.item;
    }

    today() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    show(forceNext) {
      if (!DATA) return;
      this.current = this.draw(forceNext);
      this.render();
      if (forceNext) this.arm();
    }

    render() {
      const box = this.ctx.el.querySelector(".pw-quote");
      if (!box) return;
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang === "fr" ? "fr" : "en";
      if (this.loadError) {
        box.innerHTML = `<div class="pwq-empty pwq-error">${esc(this.t("loadFailed"))}<br><small>${esc(this.loadError)}</small></div>`;
        return;
      }
      const q = this.current;
      if (!q) {
        box.innerHTML = `<div class="pwq-empty">${esc(this.t(s.favoritesOnly ? "noFav" : "empty"))}</div>`;
        return;
      }
      const E = window.PiBoardQuoteEngine;
      const fav = Array.isArray(s.favorites) && s.favorites.includes(q.id);
      const author = s.showAuthor === false ? "" : E.authorText(q, lang);
      const iconKey = q.custom ? "custom" : q.cat;
      box.dataset.cat = q.cat;
      box.dataset.id = q.id;
      box.innerHTML = `
        ${s.showIcon === false ? "" : `<span class="pwq-icon pwq-icon-${esc(iconKey)}" aria-hidden="true">${ICONS[iconKey] || ""}</span>`}
        ${fav ? `<span class="pwq-fav" aria-label="favori">\u2605</span>` : ""}
        <div class="pwq-text">${esc(q[lang] || q.fr || q.en)}</div>
        ${author ? `<div class="pwq-author">${esc(author)}</div>` : ""}
        <div class="pwq-toast" hidden></div>`;
      this.fit();
    }

    toggleFavorite() {
      const q = this.current;
      if (!q) return;
      const E = window.PiBoardQuoteEngine;
      const favorites = E.toggleFavorite(this.ctx.settings.favorites, q.id);
      const added = favorites.includes(q.id);
      if (typeof this.ctx.updateSettings === "function") this.ctx.updateSettings({ favorites });
      this.ctx.settings = Object.assign({}, this.ctx.settings, { favorites });
      this.render();
      const toast = this.ctx.el.querySelector(".pwq-toast");
      if (toast) {
        toast.textContent = this.t(added ? "fav" : "unfav");
        toast.hidden = false;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
      }
    }

    fit() {
      const box = this.ctx.el.querySelector(".pw-quote");
      if (!box) return;
      const text = box.querySelector(".pwq-text");
      const author = box.querySelector(".pwq-author");
      if (!text) return;

      // Recherche dichotomique de la plus grande taille qui tient en
      // hauteur ; le plafond combine hauteur et largeur.
      // Binary search for the largest size that fits vertically; the
      // cap combines height and width.
      const w = box.clientWidth || 100;
      const h = box.clientHeight || 100;
      // Marges proportionnees a CHAQUE dimension (voir widget.css).
      // Padding proportional to EACH dimension (see widget.css).
      const padV = Math.round(Math.min(h * 0.1, w * 0.06));
      const padH = Math.round(Math.min(w * 0.08, h * 0.4));
      box.style.padding = padV + "px " + padH + "px";
      // Le pictogramme s'adapte a la tuile, avant la mesure du texte.
      // The icon adapts to the tile, before the text is measured.
      const icon = box.querySelector(".pwq-icon");
      if (icon) {
        const size = Math.round(Math.max(12, Math.min(h * 0.22, w * 0.08, 40)));
        icon.style.width = icon.style.height = size + "px";
      }
      let lo = 9, hi = Math.max(12, Math.floor(Math.max(h * 0.34, Math.min(w * 0.12, h * 0.6))));
      for (let i = 0; i < 8; i++) {
        const mid = Math.floor((lo + hi + 1) / 2);
        text.style.fontSize = mid + "px";
        if (author) author.style.fontSize = Math.max(9, Math.round(mid * 0.42)) + "px";
        if (box.scrollHeight <= box.clientHeight + 1) lo = mid;
        else hi = mid - 1;
      }

      // Reglage manuel « Taille du texte » de la tuile (50 % a 200 %).
      // Manual tile "Text size" setting (50% to 200%).
      const scale = Number(this.ctx.settings._textScale) || 1;
      text.style.fontSize = Math.max(6, Math.round(lo * scale)) + "px";
      if (author) author.style.fontSize = Math.max(6, Math.round(lo * 0.42 * scale)) + "px";

      clearTimeout(this.refitTimer);
      this.refitTimer = setTimeout(() => {
        const bw = box.clientWidth, bh = box.clientHeight;
        if (bw !== w || bh !== h) this.fit();
      }, 180);
    }

    arm() {
      clearInterval(this.timer);
      clearTimeout(this.dayTimer);
      if (this.ctx.settings.mode === "interval") {
        const minutes = Math.max(1, Number(this.ctx.settings.intervalMinutes) || 30);
        this.timer = setInterval(() => this.show(false), minutes * 60000);
      } else {
        // Nouvelle citation au changement de jour.
        // New quote when the calendar day changes.
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
        this.dayTimer = setTimeout(() => { this.show(false); this.arm(); }, midnight - now);
      }
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      if (!DATA) return;
      /* Si la citation affichee ne fait plus partie de la selection
         (source decochee, theme retire), on en tire une autre.
         If the displayed quote no longer belongs to the selection
         (source unticked, theme removed), draw another one. */
      const E = window.PiBoardQuoteEngine;
      const pools = E.buildPools(DATA, settings);
      const stillIn = this.current && Object.values(pools).some((list) => list.some((it) => it.id === this.current.id));
      if (stillIn) this.render();
      else this.show(true);
      this.arm();
    }

    onLangChanged() { this.render(); }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.dayTimer);
      clearTimeout(this.refitTimer);
      clearTimeout(this.pressTimer);
      clearTimeout(this.toastTimer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("quote", QuoteWidget);
})();
