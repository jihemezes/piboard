/* PiBoard widget: tempo / couleur du jour de l'offre Tempo (EDF).
   Source : api-couleur-tempo.fr, relayee par server/tempo.js.
   Source: api-couleur-tempo.fr, relayed by server/tempo.js. */
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  class TempoWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.last = null;
    }

    async init() {
      this.ctx.el.innerHTML =
        `<div class="pw-tempo pwt-unknown"><div class="pwt-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 30);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    async refresh() {
      try {
        const r = await fetch("api/tempo");
        if (!r.ok) throw new Error("http " + r.status);
        this.last = await r.json();
        this.render(this.last);
      } catch (e) {
        console.warn("[piboard/tempo]", e);
        // Dernier etat connu conserve : une coupure ne doit pas effacer
        // une couleur qui, par nature, ne change qu'une fois par jour.
        // Last known state kept: a blip must not wipe a colour that, by
        // nature, only changes once a day.
        if (!this.last) this.renderError();
      }
    }

    renderError() {
      this.ctx.el.innerHTML =
        `<div class="pw-tempo pwt-unknown"><div class="pwt-msg">${esc(this.ctx.i18n.t("tempo.error"))}</div></div>`;
    }

    render(d) {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      if (!d) return this.renderError();

      /* Journee Tempo = 6 h -> 6 h. Avant 6 h du matin, la couleur
         REELLEMENT applicable est celle de la veille : c'est ce que
         renvoie /api/now. Afficher "today" la nuit serait faux, d'ou ce
         reglage actif par defaut.
         Tempo day = 6am -> 6am. Before 6am the ACTUALLY applicable colour
         is the previous day's: that is what /api/now returns. Showing
         "today" at night would be wrong, hence this setting on by
         default. */
      const main = (s.useNow !== false && d.now) ? d.now : (d.today || d.now);
      if (!main) return this.renderError();

      const color = main.color || "unknown";
      const label = i18n.t("tempo.color." + color);

      let sub = "";
      if (s.showTomorrow !== false && d.tomorrow) {
        const tc = d.tomorrow.color || "unknown";
        // code 0 = couleur pas encore publiee par RTE (avant ~11 h).
        // C'est un etat normal, affiche comme une attente et non comme
        // une erreur.
        // code 0 = colour not yet published by RTE (before ~11am). A
        // normal state, shown as pending rather than as an error.
        const tl = tc === "unknown" ? i18n.t("tempo.pending") : i18n.t("tempo.color." + tc);
        sub += `<div class="pwt-tomorrow">${esc(i18n.t("tempo.tomorrow"))} <b class="pwt-dot pwt-dot-${tc}"></b>${esc(tl)}</div>`;
      }

      if (s.showRemaining !== false && d.remaining) {
        const r = d.remaining;
        const bits = [];
        if (r.blue != null) bits.push(`<span class="pwt-rem pwt-rem-blue">${r.blue}</span>`);
        if (r.white != null) bits.push(`<span class="pwt-rem pwt-rem-white">${r.white}</span>`);
        if (r.red != null) bits.push(`<span class="pwt-rem pwt-rem-red">${r.red}</span>`);
        if (bits.length) {
          sub += `<div class="pwt-remaining" title="${esc(i18n.t("tempo.remainingTitle"))}">${bits.join("")}</div>`;
        }
      }

      this.ctx.el.innerHTML = `
        <div class="pw-tempo pwt-${color}">
          <div class="pwt-main">${esc(label)}</div>
          ${sub ? `<div class="pwt-sub">${sub}</div>` : ""}
        </div>`;
    }

    destroy() { clearInterval(this.timer); }
  }

  window.PiBoard.registerWidget("tempo", TempoWidget);
})();
