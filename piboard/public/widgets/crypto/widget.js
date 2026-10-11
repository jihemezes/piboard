/* PiBoard widget: crypto / cours de cryptos (CoinGecko, sans cle API)
   v2 : clic sur une ligne -> fenetre avec courbe 24h/7j/30j/1an,
   fermeture manuelle uniquement (pas de clic sur le fond).
   v2: click a row -> popup with a 24h/7d/30d/1y chart, manual close
   only (no backdrop-click dismissal). */
(function () {
  "use strict";

  const SYMBOL = { eur: "€", usd: "$" };
  const RANGES = [
    { days: 1, key: "24h" },
    { days: 7, key: "7d" },
    { days: 30, key: "30d" },
    { days: 365, key: "1y" }
  ];
  // Marges internes du graphique SVG (viewBox 400x200) : la marge
  // gauche est nettement plus large que les autres pour loger les
  // valeurs indicatrices de l'axe des ordonnees.
  // Internal margins of the SVG chart (400x200 viewBox): the left
  // margin is notably wider than the others to fit the y-axis value
  // labels.
  const CHART_PAD = { left: 54, right: 10, top: 10, bottom: 10 };
  const CHART_W = 400;
  const CHART_H = 200;

  function formatPrice(v, currency) {
    const digits = v >= 100 ? 0 : v >= 1 ? 2 : 4;
    return v.toLocaleString(currency === "eur" ? "fr-FR" : "en-US", {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    });
  }

  /* Calcule des valeurs de repere "rondes" (1/2/5 x une puissance de
     10) qui encadrent la plage [min, max] -- meme principe que les
     graduations d'une bibliotheque de graphiques classique (D3, etc.).
     Sert a la fois a placer les traits de repere ET a definir le
     domaine reellement utilise pour tracer la courbe : les repères
     tombent ainsi toujours sur des valeurs lisibles (52 000 plutot que
     51 847,23), au prix d'une petite marge au-dessus/en-dessous de la
     courbe plutot que des bords colles aux extremes exacts des
     donnees -- plus lisible pour juger des fluctuations d'un coup
     d'oeil, precisement ce qui est demande.
     Computes "round" reference values (1/2/5 x a power of 10) that
     bracket the [min, max] range -- same principle as a standard
     charting library's tick marks (D3, etc.). Used both to place the
     gridlines AND to define the domain actually used to plot the
     curve: reference lines then always land on readable values (52,000
     rather than 51,847.23), at the cost of a small margin above/below
     the curve rather than edges glued to the data's exact extremes --
     more readable for judging fluctuations at a glance, precisely
     what's requested. */
  function niceTicks(min, max, count) {
    if (!(max > min)) { min -= 1; max += 1; }
    const rawStep = (max - min) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const step = niceNorm * mag;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const values = [];
    for (let v = niceMin; v <= niceMax + step / 2; v += step) {
      values.push(Math.round(v * 1e8) / 1e8); // evite les artefacts de virgule flottante / avoids floating-point artifacts
    }
    return { values, min: niceMin, max: niceMax };
  }

  /* Construit un chemin SVG normalise a partir d'une serie de points,
     sur le domaine [domain.min, domain.max] fourni (voir niceTicks) --
     PAS le min/max brut des donnees, pour que la courbe s'aligne avec
     les traits de repere.
     Builds a normalized SVG path from a series of points, over the
     supplied [domain.min, domain.max] (see niceTicks) -- NOT the raw
     data's min/max, so the curve lines up with the gridlines. */
  function buildPath(values, w, h, pad, domain) {
    const range = (domain.max - domain.min) || 1;
    const stepX = (w - pad.left - pad.right) / Math.max(1, values.length - 1);
    const yFor = (v) => pad.top + (1 - (v - domain.min) / range) * (h - pad.top - pad.bottom);
    const pts = values.map((v, i) => [pad.left + i * stepX, yFor(v)]);
    const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const fill = line + ` L${pts[pts.length - 1][0].toFixed(1)},${(h - pad.bottom).toFixed(1)} L${pts[0][0].toFixed(1)},${(h - pad.bottom).toFixed(1)} Z`;
    return { line, fill, yFor };
  }

  /* Adresse du logo de la crypto, a partir de son symbole boursier
     (ex. "BTC") -- CDN public et gratuit (jsDelivr, sert le paquet npm
     "cryptocurrency-icons"), aucune cle ni compte requis. Absent (pas
     de logo) pour toute crypto sans symbole connu -- voir
     server/crypto.js:symbolsFor, limite aux pieces geree par Binance.
     Crypto logo address, from its ticker symbol (e.g. "BTC") -- free
     public CDN (jsDelivr, serving the "cryptocurrency-icons" npm
     package), no key or account required. Absent (no logo) for any
     coin with no known symbol -- see server/crypto.js:symbolsFor,
     limited to coins Binance manages. */
  function iconUrl(symbol) {
    if (!symbol) return null;
    return "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/" + symbol.toLowerCase() + ".svg";
  }

  class CryptoWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.modal = null;
      this.activeCoin = null;
      this.activeDays = 1;
      this.chartCache = {}; // "id:days" -> {prices, name}
      // Expose pour les tests (fonctions pures, aucune donnee sensible) / exposed for tests (pure functions, no sensitive data)
      this._niceTicks = niceTicks;
      this._buildPath = buildPath;
      this._iconUrl = iconUrl;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-crypto"><div class="pwc-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(1, Number(this.ctx.settings.refresh) || 5);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.chartCache = {};
      this.applyChartColors();
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const ids = (s.coins || "bitcoin,ethereum").split(",").map((c) => c.trim()).filter(Boolean);
      if (!ids.length) {
        el.innerHTML = `<div class="pw-crypto"><div class="pwc-err">${this.ctx.i18n.t("crypto.error")}</div></div>`;
        return;
      }
      try {
        const url = "/api/crypto/prices?ids=" + encodeURIComponent(ids.join(",")) + "&currency=" + encodeURIComponent(s.currency);
        const result = await fetch(url).then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });
        const data = result.data || {};
        const symbols = result.symbols || {};
        const symbol = SYMBOL[s.currency] || "";
        const rows = ids.filter((id) => data[id]).map((id) => {
          const price = data[id][s.currency];
          const change = data[id][s.currency + "_24h_change"];
          const up = change >= 0;
          const changeTxt = change != null ? (up ? "+" : "") + change.toFixed(1) + "%" : "—";
          return `
            <div class="pwc-row" data-coin="${id}" data-price="${price}" data-change="${changeTxt}" data-up="${up}" data-symbol="${symbols[id] || ""}">
              <span class="pwc-name">${id.replace(/-/g, " ")}</span>
              <span class="pwc-right">
                <span class="pwc-price">${formatPrice(price, s.currency)}${symbol}</span>
                <span class="pwc-change ${up ? "pwc-up" : "pwc-down"}">${changeTxt}</span>
              </span>
            </div>`;
        }).join("");
        // Repli signale (voir server/crypto.js) : les cours affiches sont
        // corrects mais pas les plus recents -- un discret rappel plutot
        // que de le camoufler ou d'afficher une erreur alors que des
        // chiffres exploitables sont bien la.
        // Flagged fallback (see server/crypto.js): the shown prices are
        // correct but not the most recent -- a discreet reminder rather
        // than hiding it, or showing an error when usable numbers are
        // actually there.
        const staleNotice = result.stale ? `<div class="pwc-stale">${this.ctx.i18n.t("crypto.stale")}</div>` : "";
        el.innerHTML = `<div class="pw-crypto">${rows || `<div class="pwc-err">${this.ctx.i18n.t("crypto.error")}</div>`}${staleNotice}</div>`;

        el.querySelectorAll(".pwc-row").forEach((row) => {
          // Meme correctif que le bouton de gestion du widget Diaporama :
          // sans stopPropagation, ce clic remonte jusqu'a la grille en
          // mode edition et rouvre les reglages de la tuile par-dessus la
          // courbe qu'on vient d'ouvrir.
          // Same fix as the Slideshow widget's manage button: without
          // stopPropagation, this click bubbles up to the grid in edit
          // mode and reopens the tile's settings on top of the chart that
          // was just opened.
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            this.openChart(row.dataset.coin, row.dataset.price, row.dataset.change, row.dataset.up === "true", row.dataset.symbol || null);
          });
        });
      } catch (e) {
        console.warn("[piboard/crypto]", e);
        el.innerHTML = `<div class="pw-crypto"><div class="pwc-err">${this.ctx.i18n.t("crypto.error")}</div></div>`;
      }
    }

    /* Cree la fenetre de courbe une seule fois (reutilisee ensuite) et
       l'ajoute a document.body pour echapper au cadre de la tuile.
       Creates the chart popup once (reused afterwards) and appends it to
       document.body to escape the tile's clipped frame. */
    ensureModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card">
          <header class="modal-head">
            <img class="pwc-modal-icon" alt="" hidden>
            <h2 class="pwc-modal-title"></h2>
            <button type="button" class="modal-close" aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pwc-chart-head">
            <span class="pwc-chart-price"></span>
            <span class="pwc-chart-change"></span>
          </div>
          <div class="pwc-ranges">
            ${RANGES.map((r) => `<button type="button" class="pwc-range-btn" data-days="${r.days}">${i18n.t("crypto.range." + r.key)}</button>`).join("")}
          </div>
          <div class="pwc-chart-wrap">
            <svg viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none">
              <g class="pwc-chart-grid-group"></g>
              <path class="pwc-chart-fill" d=""></path>
              <path class="pwc-chart-line" d=""></path>
            </svg>
            <div class="pb-taxis pwc-taxis"></div>
            <div class="pwc-chart-status"></div>
          </div>
        </div>`;
      document.body.appendChild(wrap);

      // Fermeture strictement manuelle : uniquement le bouton (et Echap).
      // Un clic sur le fond ne ferme PAS la fenetre, comme demande.
      // Strictly manual close: button only (and Escape). Clicking the
      // backdrop does NOT close the window, as requested.
      wrap.querySelector(".modal-close").addEventListener("click", () => { wrap.hidden = true; });
      this._escHandler = (e) => { if (e.key === "Escape" && !wrap.hidden) wrap.hidden = true; };
      document.addEventListener("keydown", this._escHandler);

      wrap.querySelectorAll(".pwc-range-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.activeDays = Number(btn.dataset.days);
          this.renderRangeButtons();
          this.loadChart();
        });
      });

      this.modal = wrap;
      return wrap;
    }

    renderRangeButtons() {
      this.modal.querySelectorAll(".pwc-range-btn").forEach((btn) => {
        btn.classList.toggle("pwc-range-active", Number(btn.dataset.days) === this.activeDays);
      });
    }

    /* Applique les 3 couleurs personnalisables (fond, courbe, traits de
       repere) via des variables CSS posees sur la fenetre -- voir
       widget.css. Appelee a chaque ouverture et a chaque changement de
       reglages, pour qu'une modification de couleur se voie sans avoir
       a rouvrir la fenetre.
       Applies the 3 customizable colors (background, curve, gridlines)
       through CSS variables set on the window -- see widget.css. Called
       on every open and every settings change, so a color change shows
       up without having to reopen the window. */
    applyChartColors() {
      if (!this.modal) return;
      const s = this.ctx.settings;
      const wrap = this.modal.querySelector(".pwc-chart-wrap");
      wrap.style.setProperty("--pwc-chart-bg", s.chartBgColor || "#141926");
      wrap.style.setProperty("--pwc-chart-line", s.chartLineColor || "#D6335C");
      wrap.style.setProperty("--pwc-chart-grid", s.chartGridColor || "#565E73");
    }

    openChart(coinId, price, changeTxt, up, symbol) {
      const modal = this.ensureModal();
      const s = this.ctx.settings;
      const symbolChar = SYMBOL[s.currency] || "";
      this.activeCoin = coinId;
      this.activeDays = 1;
      modal.querySelector(".pwc-modal-title").textContent = coinId.replace(/-/g, " ");
      this.setModalIcon(symbol);
      modal.querySelector(".pwc-chart-price").textContent = formatPrice(Number(price), s.currency) + symbolChar;
      const changeEl = modal.querySelector(".pwc-chart-change");
      changeEl.textContent = changeTxt;
      changeEl.className = "pwc-chart-change " + (up ? "pwc-up" : "pwc-down");
      this.renderRangeButtons();
      this.applyChartColors();
      modal.hidden = false;
      this.loadChart();
    }

    /* Logo a cote du nom, quand le symbole boursier de la crypto est
       connu (voir server/crypto.js:symbolsFor -- limite aux pieces
       gerees par Binance). Absent sinon : pas de repli sur un logo
       generique, un logo errone serait pire que pas de logo du tout.
       Une image qui echoue a charger (symbole reconnu mais absent du
       jeu d'icones) se masque proprement plutot que d'afficher une
       icone de lien casse.
       Logo next to the name, when the coin's ticker symbol is known
       (see server/crypto.js:symbolsFor -- limited to coins Binance
       manages). Absent otherwise: no fallback to a generic logo, a
       wrong logo would be worse than no logo at all. An image that
       fails to load (symbol recognized but missing from the icon set)
       hides itself cleanly rather than showing a broken-link icon. */
    setModalIcon(symbol) {
      const img = this.modal.querySelector(".pwc-modal-icon");
      const url = iconUrl(symbol);
      if (!url) { img.hidden = true; img.removeAttribute("src"); return; }
      img.onerror = () => { img.hidden = true; };
      img.onload = () => { img.hidden = false; };
      img.hidden = true;
      img.src = url;
    }

    async loadChart() {
      const modal = this.modal;
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const coinId = this.activeCoin;
      const days = this.activeDays;
      const status = modal.querySelector(".pwc-chart-status");
      const lineEl = modal.querySelector(".pwc-chart-line");
      const fillEl = modal.querySelector(".pwc-chart-fill");
      const gridGroup = modal.querySelector(".pwc-chart-grid-group");
      status.hidden = false;
      status.textContent = i18n.t("common.loading");
      lineEl.setAttribute("d", "");
      fillEl.setAttribute("d", "");
      gridGroup.innerHTML = "";
      const oldAxis = modal.querySelector(".pwc-taxis");
      if (oldAxis) oldAxis.innerHTML = "";

      const cacheKey = coinId + ":" + days;
      try {
        let cached = this.chartCache[cacheKey];
        if (!cached) {
          const url = "/api/crypto/chart?id=" + encodeURIComponent(coinId)
            + "&currency=" + encodeURIComponent(s.currency) + "&days=" + days;
          const result = await fetch(url).then((r) => {
            if (!r.ok) throw new Error("status " + r.status);
            return r.json();
          });
          if (!result.prices || !result.prices.length) throw new Error("no data");
          cached = result;
          this.chartCache[cacheKey] = cached;
        }
        // Toujours la meme requete active ? (l'utilisateur a pu changer de periode entre-temps)
        // Still the current request? (the user may have switched range meanwhile)
        if (coinId !== this.activeCoin || days !== this.activeDays) return;

        // Symbole confirme par la reponse de la courbe elle-meme -- au
        // cas ou l'appel initial (liste des cours) n'aurait pas encore
        // eu l'occasion de le fournir.
        // Symbol confirmed by the chart response itself -- in case the
        // initial call (price list) hadn't had the chance to provide it
        // yet.
        if (cached.symbol) this.setModalIcon(cached.symbol);

        // Traits de repere + valeurs indicatrices de l'axe des
        // ordonnees, sur des valeurs "rondes" plutot que le min/max
        // brut des donnees -- voir niceTicks(). Reference gridlines +
        // y-axis value labels, on "round" values rather than the data's
        // raw min/max -- see niceTicks().
        const rawMin = Math.min(...cached.prices);
        const rawMax = Math.max(...cached.prices);
        const ticks = niceTicks(rawMin, rawMax, 4);
        const { line, fill, yFor } = buildPath(cached.prices, CHART_W, CHART_H, CHART_PAD, ticks);
        const symbolChar = SYMBOL[s.currency] || "";
        gridGroup.innerHTML = ticks.values.map((v) => {
          const y = yFor(v);
          return `<line class="pwc-chart-grid" x1="${CHART_PAD.left}" x2="${CHART_W - CHART_PAD.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>
            <text class="pwc-chart-axis" x="${CHART_PAD.left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${formatPrice(v, s.currency)}${symbolChar}</text>`;
        }).join("");
        /* Axe des abscisses : les instants viennent desormais de la
           source (Binance ou CoinGecko), voir server/crypto.js. Les
           traits verticaux vont dans le SVG, les etiquettes en HTML sous
           lui -- le SVG est etire, il deformerait le texte. Les marges
           gauche/droite du viewBox sont converties en pourcentage pour
           que chaque etiquette tombe sous son trait.
           X axis: the times now come from the source (Binance or
           CoinGecko), see server/crypto.js. Vertical lines go into the
           SVG, labels into HTML below it -- the SVG is stretched and
           would distort the text. The viewBox's left/right margins are
           converted to percentages so each label lands under its line. */
        const times = cached.times || [];
        const axis = window.PiBoardTimeAxis;
        const axisEl = modal.querySelector(".pwc-taxis");
        if (axis && axisEl && times.length > 1 && times[0] != null && times[times.length - 1] != null) {
          const ticks = axis.timeTicks(times[0], times[times.length - 1], {
            locale: i18n.lang === "en" ? "en-GB" : "fr-FR",
            maxTicks: 5
          });
          gridGroup.innerHTML += axis.gridLines(ticks, CHART_PAD.left, CHART_W - CHART_PAD.right,
            CHART_PAD.top, CHART_H - CHART_PAD.bottom, 'class="pwc-chart-grid"');
          axisEl.innerHTML = axis.axisHtml(ticks,
            (CHART_PAD.left / CHART_W) * 100, (CHART_PAD.right / CHART_W) * 100);
        } else if (axisEl) {
          axisEl.innerHTML = "";
        }

        lineEl.setAttribute("d", line);
        fillEl.setAttribute("d", fill);
        status.hidden = !cached.stale;
        status.textContent = cached.stale ? i18n.t("crypto.stale") : "";
      } catch (e) {
        console.warn("[piboard/crypto/chart]", e);
        if (coinId !== this.activeCoin || days !== this.activeDays) return;
        status.hidden = false;
        status.textContent = i18n.t("crypto.chartError");
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.modal) {
        this.modal.remove();
        if (this._escHandler) document.removeEventListener("keydown", this._escHandler);
      }
    }
  }

  window.PiBoard.registerWidget("crypto", CryptoWidget);
})();
