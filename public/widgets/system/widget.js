/* PiBoard widget: system / etat systeme
   Interroge /api/system (endpoint du coeur PiBoard) qui lit les ressources
   locales de la machine hote : CPU, RAM, disque, temperature, uptime.
   Queries /api/system (PiBoard core endpoint) which reads local resources
   of the host machine: CPU, RAM, disk, temperature, uptime. */
(function () {
  "use strict";

  function barClass(pct) {
    if (pct >= 85) return "pws-crit";
    if (pct >= 65) return "pws-warn";
    return "";
  }

  function formatUptime(sec, i18n) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}${i18n.t("system.d")} ${h}${i18n.t("system.h")}`;
    if (h > 0) return `${h}${i18n.t("system.h")} ${m}${i18n.t("system.m")}`;
    return `${m}${i18n.t("system.m")}`;
  }

  class SystemWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-system"><div class="pws-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const seconds = Math.max(2, Number(this.ctx.settings.refreshSeconds) || 5);
      this.timer = setInterval(() => this.refresh(), seconds * 1000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    row(label, value, pct) {
      return `
        <div class="pws-row">
          <div class="pws-row-head"><span>${label}</span><span class="pws-val">${value}</span></div>
          <div class="pws-bar"><div class="pws-bar-fill ${barClass(pct)}" style="width:${Math.max(2, Math.min(100, pct))}%"></div></div>
        </div>`;
    }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      try {
        const d = await fetch("/api/system").then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });

        const head = (s.showHostname || s.showUptime) ? `
          <div class="pws-head">
            ${s.showHostname ? `<span>${d.hostname}</span>` : "<span></span>"}
            ${s.showUptime ? `<span>${i18n.t("system.uptime")} ${formatUptime(d.uptimeSec, i18n)}</span>` : ""}
          </div>` : "";

        const tempRow = d.tempC != null
          ? `<div class="pws-row-head"><span>${i18n.t("system.temp")}</span><span class="pws-val">${d.tempC.toFixed(1)}°C</span></div>`
          : "";

        el.innerHTML = `
          <div class="pw-system">
            ${head}
            ${this.row(i18n.t("system.cpu"), d.cpuPercent.toFixed(0) + "%", d.cpuPercent)}
            ${this.row(i18n.t("system.ram"), d.memUsedGB + " / " + d.memTotalGB + " GB", d.memPercent)}
            ${d.diskPercent != null ? this.row(i18n.t("system.disk"), d.diskUsedGB + " / " + d.diskTotalGB + " GB", d.diskPercent) : ""}
            ${tempRow}
          </div>`;
      } catch (e) {
        console.warn("[piboard/system]", e);
        el.innerHTML = `<div class="pw-system"><div class="pws-err">${i18n.t("system.error")}</div></div>`;
      }
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("system", SystemWidget);
})();
