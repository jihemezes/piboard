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

  function formatPrice(v, currency) {
    const digits = v >= 100 ? 0 : v >= 1 ? 2 : 4;
    return v.toLocaleString(currency === "eur" ? "fr-FR" : "en-US", {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    });
  }

  /* Construit un chemin SVG normalise a partir d'une serie de points
     Builds a normalized SVG path from a series of points */
  function buildPath(values, w, h, pad) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => [
      pad + i * stepX,
      pad + (1 - (v - min) / range) * (h - pad * 2)
    ]);
    const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const fill = line + ` L${pts[pts.length - 1][0].toFixed(1)},${(h - pad).toFixed(1)} L${pts[0][0].toFixed(1)},${(h - pad).toFixed(1)} Z`;
    return { line, fill, min, max };
  }

  class CryptoWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.modal = null;
      this.activeCoin = null;
      this.activeDays = 1;
      this.chartCache = {}; // "id:days" -> {prices, name}
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
        const url = "https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(ids.join(","))
          + "&vs_currencies=" + s.currency + "&include_24hr_change=true";
        const data = await fetch(url).then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });
        const symbol = SYMBOL[s.currency] || "";
        const rows = ids.filter((id) => data[id]).map((id) => {
          const price = data[id][s.currency];
          const change = data[id][s.currency + "_24h_change"];
          const up = change >= 0;
          const changeTxt = change != null ? (up ? "+" : "") + change.toFixed(1) + "%" : "—";
          return `
            <div class="pwc-row" data-coin="${id}" data-price="${price}" data-change="${changeTxt}" data-up="${up}">
              <span class="pwc-name">${id.replace(/-/g, " ")}</span>
              <span class="pwc-right">
                <span class="pwc-price">${formatPrice(price, s.currency)}${symbol}</span>
                <span class="pwc-change ${up ? "pwc-up" : "pwc-down"}">${changeTxt}</span>
              </span>
            </div>`;
        }).join("");
        el.innerHTML = `<div class="pw-crypto">${rows || `<div class="pwc-err">${this.ctx.i18n.t("crypto.error")}</div>`}</div>`;

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
            this.openChart(row.dataset.coin, row.dataset.price, row.dataset.change, row.dataset.up === "true");
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
            <svg viewBox="0 0 400 200" preserveAspectRatio="none">
              <path class="pwc-chart-fill" d=""></path>
              <path class="pwc-chart-line" d=""></path>
            </svg>
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

    openChart(coinId, price, changeTxt, up) {
      const modal = this.ensureModal();
      const s = this.ctx.settings;
      const symbol = SYMBOL[s.currency] || "";
      this.activeCoin = coinId;
      this.activeDays = 1;
      modal.querySelector(".pwc-modal-title").textContent = coinId.replace(/-/g, " ");
      modal.querySelector(".pwc-chart-price").textContent = formatPrice(Number(price), s.currency) + symbol;
      const changeEl = modal.querySelector(".pwc-chart-change");
      changeEl.textContent = changeTxt;
      changeEl.className = "pwc-chart-change " + (up ? "pwc-up" : "pwc-down");
      this.renderRangeButtons();
      modal.hidden = false;
      this.loadChart();
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
      status.hidden = false;
      status.textContent = i18n.t("common.loading");
      lineEl.setAttribute("d", "");
      fillEl.setAttribute("d", "");

      const cacheKey = coinId + ":" + days;
      try {
        let prices = this.chartCache[cacheKey];
        if (!prices) {
          const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart`
            + `?vs_currency=${s.currency}&days=${days}`;
          const data = await fetch(url).then((r) => {
            if (!r.ok) throw new Error("status " + r.status);
            return r.json();
          });
          prices = (data.prices || []).map((p) => p[1]);
          if (!prices.length) throw new Error("no data");
          this.chartCache[cacheKey] = prices;
        }
        // Toujours la meme requete active ? (l'utilisateur a pu changer de periode entre-temps)
        // Still the current request? (the user may have switched range meanwhile)
        if (coinId !== this.activeCoin || days !== this.activeDays) return;
        const { line, fill } = buildPath(prices, 400, 200, 12);
        lineEl.setAttribute("d", line);
        fillEl.setAttribute("d", fill);
        status.hidden = true;
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
