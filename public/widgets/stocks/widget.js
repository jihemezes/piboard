/* PiBoard widget: stocks / cours de bourse, indices, change.
   Meme moteur que la tuile Cryptos : lignes cliquables ouvrant une
   courbe. Sources Stooq puis Yahoo, via server/stocks.js.
   Same engine as the Crypto tile: clickable rows opening a chart.
   Sources Stooq then Yahoo, via server/stocks.js. */
(function () {
  "use strict";

  const RANGES = ["1m", "6m", "1y", "5y"];
  const CHART_W = 400, CHART_H = 200;
  const PAD = { left: 54, right: 10, top: 10, bottom: 10 };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Les indices se lisent avec des separateurs de milliers, les paires
     de change avec quatre decimales : un formatage unique rendrait
     EUR/USD illisible (1 au lieu de 1,0847).
     Indices read with thousands separators, FX pairs with four decimals:
     a single format would make EUR/USD unreadable (1 instead of 1.0847). */
  function formatValue(v, lang) {
    const digits = v >= 1000 ? 0 : v >= 100 ? 1 : v >= 10 ? 2 : 4;
    return v.toLocaleString(lang === "fr" ? "fr-FR" : "en-US",
      { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function niceTicks(min, max, count) {
    if (!(max > min)) { min -= 1; max += 1; }
    const rawStep = (max - min) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const values = [];
    for (let v = niceMin; v <= niceMax + step / 2; v += step) values.push(Math.round(v * 1e8) / 1e8);
    return { values, min: niceMin, max: niceMax };
  }

  function buildPath(series, domain) {
    if (!series.length) return "";
    const span = domain.max - domain.min || 1;
    const w = CHART_W - PAD.left - PAD.right;
    const h = CHART_H - PAD.top - PAD.bottom;
    return series.map((p, i) => {
      const x = PAD.left + (i / Math.max(1, series.length - 1)) * w;
      const y = PAD.top + h - ((p.value - domain.min) / span) * h;
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
  }

  class StocksWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.modal = null;
      this.activeSymbol = null;
      this.activeRange = "1y";
      this._niceTicks = niceTicks;
      this._buildPath = buildPath;
      this._formatValue = formatValue;
    }

    lines() {
      const raw = this.ctx.settings.lines;
      let arr = [];
      try { arr = typeof raw === "string" ? JSON.parse(raw || "[]") : (Array.isArray(raw) ? raw : []); }
      catch (e) { arr = []; }
      return arr.filter((l) => l && l.symbol);
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-stocks"><div class="pws-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(1, Number(this.ctx.settings.refresh) || 15);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    async refresh() {
      const lines = this.lines();
      if (!lines.length) {
        this.ctx.el.innerHTML = `<div class="pw-stocks"><div class="pws-msg">${esc(this.ctx.i18n.t("stocks.noLines"))}</div></div>`;
        return;
      }
      try {
        const symbols = [...new Set(lines.map((l) => l.symbol))].join(",");
        const r = await fetch("api/stocks/quotes?symbols=" + encodeURIComponent(symbols));
        if (!r.ok) throw new Error("http " + r.status);
        this.render(lines, (await r.json()).quotes || {});
      } catch (e) {
        console.warn("[piboard/stocks]", e);
        if (!this.rendered) {
          this.ctx.el.innerHTML = `<div class="pw-stocks"><div class="pws-msg">${esc(this.ctx.i18n.t("stocks.error"))}</div></div>`;
        }
      }
    }

    render(lines, quotes) {
      const i18n = this.ctx.i18n;
      const lang = this.ctx.settings._lang || i18n.lang || "fr";
      const showChange = this.ctx.settings.showChange !== false;

      const rows = lines.map((l) => {
        const q = quotes[l.symbol];
        if (!q) {
          return `<div class="pws-row pws-dead"><span class="pws-name">${esc(l.name || l.symbol)}</span><span class="pws-val">—</span></div>`;
        }
        const dir = q.change == null ? "flat" : q.change > 0 ? "up" : q.change < 0 ? "down" : "flat";
        const chg = (showChange && q.change != null)
          ? `<span class="pws-chg pws-${dir}">${q.change > 0 ? "+" : ""}${q.change.toFixed(2)}%</span>` : "";
        // stale : les deux sources ont echoue, on montre la derniere
        // valeur connue en le signalant plutot que de vider la ligne.
        // stale: both sources failed, we show the last known value and
        // flag it rather than emptying the row.
        // marketOpen vaut null pour un symbole dont on ne connait pas
        // les horaires : on n'affiche alors AUCUN indicateur, un "ferme"
        // faux etant pire que pas d'information.
        // marketOpen is null for a symbol whose hours we do not know: we
        // then show NO indicator, a wrong "closed" being worse than no
        // information at all.
        const closed = q.marketOpen === false;
        const mark = closed
          ? `<span class="pws-closed" title="${esc(i18n.t("stocks.closedTitle"))}">${esc(i18n.t("stocks.closed"))}</span>`
          : "";
        return `<div class="pws-row${q.stale ? " pws-stale" : ""}${closed ? " pws-shut" : ""}" data-symbol="${esc(l.symbol)}" data-name="${esc(l.name || l.symbol)}">
          <span class="pws-name">${esc(l.name || l.symbol)}${mark}</span>
          <span class="pws-val">${esc(formatValue(q.price, lang))}<span class="pws-cur">${esc(q.symbolChar || "")}</span></span>
          ${chg}
        </div>`;
      }).join("");

      this.ctx.el.innerHTML = `<div class="pw-stocks"><div class="pws-rows">${rows}</div></div>`;
      this.rendered = true;

      this.ctx.el.querySelectorAll(".pws-row[data-symbol]").forEach((el) => {
        el.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.openChart(el.dataset.symbol, el.dataset.name);
        });
      });
    }

    openChart(symbol, name) {
      const i18n = this.ctx.i18n;
      this.activeSymbol = symbol;
      this.activeRange = "1y";
      if (this.modal) this.modal.remove();

      const m = document.createElement("div");
      m.className = "modal modal-stacked";
      m.innerHTML = `
        <div class="modal-card pws-chart-card">
          <header class="modal-head">
            <h2>${esc(name)}</h2>
            <button class="modal-close" data-x aria-label="Close">&times;</button>
          </header>
          <div class="pws-chart-body">
            <div class="pws-ranges">${RANGES.map((r) =>
              `<button class="pws-range${r === "1y" ? " active" : ""}" data-r="${r}">${esc(i18n.t("stocks.range." + r))}</button>`).join("")}</div>
            <svg class="pws-chart" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none">
              <g class="pws-grid"></g>
              <path class="pws-line" fill="none" stroke-width="2"></path>
            </svg>
            <div class="pws-chart-status">${esc(i18n.t("common.loading"))}</div>
          </div>
        </div>`;
      document.body.appendChild(m);
      this.modal = m;

      const bg = this.ctx.settings.chartBgColor || "#141926";
      const line = this.ctx.settings.chartLineColor || "#D6335C";
      m.querySelector(".pws-chart").style.background = bg;
      m.querySelector(".pws-line").setAttribute("stroke", line);

      m.querySelector("[data-x]").addEventListener("pointerup", (e) => {
        e.preventDefault(); m.remove(); this.modal = null;
      });
      m.querySelectorAll(".pws-range").forEach((b) => {
        b.addEventListener("pointerup", (e) => {
          e.preventDefault();
          m.querySelectorAll(".pws-range").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          this.loadChart(symbol, b.dataset.r);
        });
      });

      this.loadChart(symbol, "1y");
    }

    async loadChart(symbol, range) {
      this.activeRange = range;
      const m = this.modal;
      if (!m) return;
      const status = m.querySelector(".pws-chart-status");
      const lang = this.ctx.i18n.lang || "fr";
      try {
        const r = await fetch(`api/stocks/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
        if (!r.ok) throw new Error("http " + r.status);
        const data = await r.json();
        // Une reponse tardive d'une periode qu'on a quittee ne doit pas
        // ecraser la courbe affichee.
        // A late reply for a range we have left must not overwrite the
        // chart on screen.
        if (this.activeSymbol !== symbol || this.activeRange !== range || this.modal !== m) return;

        const values = data.series.map((p) => p.value);
        const domain = niceTicks(Math.min(...values), Math.max(...values), 4);
        m.querySelector(".pws-line").setAttribute("d", buildPath(data.series, domain));

        const h = CHART_H - PAD.top - PAD.bottom;
        const span = domain.max - domain.min || 1;
        m.querySelector(".pws-grid").innerHTML = domain.values.map((v) => {
          const y = PAD.top + h - ((v - domain.min) / span) * h;
          return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${CHART_W - PAD.right}" y2="${y.toFixed(1)}" stroke="#565E73" stroke-width="0.5"/>
                  <text x="${PAD.left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#565E73" font-size="9">${esc(formatValue(v, lang))}</text>`;
        }).join("");
        status.textContent = "";
        status.hidden = true;
      } catch (e) {
        if (this.modal !== m) return;
        status.hidden = false;
        status.textContent = this.ctx.i18n.t("stocks.chartError");
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.modal) this.modal.remove();
    }
  }

  window.PiBoard.registerWidget("stocks", StocksWidget);
})();
