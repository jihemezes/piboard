/* PiBoard widget: system / etat systeme
   Interroge /api/system (endpoint du coeur PiBoard) qui lit les ressources
   locales de la machine hote : CPU, RAM, disque, temperature, uptime.
   Queries /api/system (PiBoard core endpoint) which reads local resources
   of the host machine: CPU, RAM, disk, temperature, uptime. */
(function () {
  "use strict";

  /* Les valeurs affichees viennent du systeme (noms de cartes, suffixe
     de domaine) : elles sont sures, mais on les echappe quand meme --
     un nom de carte peut contenir des parentheses et des caracteres
     inattendus, et l'echappement coute moins cher qu'une exception.
     The displayed values come from the system (adapter names, domain
     suffix): they are trustworthy, but we escape them anyway -- an
     adapter name can hold brackets and unexpected characters, and
     escaping costs less than an exception. */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

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
      // Chargee AVANT le premier rendu, sinon la tuile s'afficherait une
      // fois sans ses adresses puis sauterait au rafraichissement suivant.
      // Loaded BEFORE the first render, otherwise the tile would show once
      // without its addresses then jump on the next refresh.
      await this.loadNetwork();
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
            ${this.netRows()}
          </div>`;

        this.wireNetwork();
      } catch (e) {
        console.warn("[piboard/system]", e);
        el.innerHTML = `<div class="pw-system"><div class="pws-err">${i18n.t("system.error")}</div></div>`;
      }
    }

    /* Les adresses sont chargees SEPAREMENT de /api/system, et une seule
       fois : la configuration reseau ne change pratiquement jamais, alors
       que /api/system est reinterroge toutes les quelques secondes.
       Les lier aurait fait executer `ipconfig` ou `ip route` a chaque
       rafraichissement, pour un resultat identique.
       Addresses are loaded SEPARATELY from /api/system, and only once:
       network configuration hardly ever changes, whereas /api/system is
       re-queried every few seconds. Tying them together would have run
       `ipconfig` or `ip route` on every refresh, for an identical result. */
    netRows() {
      if (this.ctx.settings.showNetwork === false) return "";
      const nets = this.net && this.net.adapters ? this.net.adapters : [];
      if (!nets.length) return "";
      return nets.map((a) => `
        <div class="pws-net" data-net="1" role="button" tabindex="0"
             title="${esc(this.ctx.i18n.t("system.netDetails"))}">
          <span class="pws-net-name">${esc(a.name)}</span>
          <span class="pws-net-ip">${esc(a.ipv4)}</span>
        </div>`).join("");
    }

    async loadNetwork() {
      try {
        const r = await fetch("/api/network-config");
        if (!r.ok) throw new Error("status " + r.status);
        this.net = await r.json();
      } catch (e) {
        console.warn("[piboard/system] reseau", e);
        this.net = null;
      }
    }

    wireNetwork() {
      // pointerup et non click : convention du projet sur les surfaces
      // tactiles, ou le click peut etre precede d'un defilement.
      // pointerup rather than click: the project's convention on touch
      // surfaces, where a click can follow a scroll.
      this.ctx.el.querySelectorAll("[data-net]").forEach((el) => {
        el.addEventListener("pointerup", (e) => { e.preventDefault(); this.openNetwork(); });
      });
    }

    openNetwork() {
      const i18n = this.ctx.i18n;
      const d = this.net;
      if (!d) return;
      if (this.modal) this.modal.remove();

      const na = `<span class="pwn-na">${esc(i18n.t("system.netUnknown"))}</span>`;
      const val = (v) => (v == null || v === "" ? na : esc(String(v)));

      const cards = (d.adapters || []).map((a) => {
        const rows = [
          [i18n.t("system.netIp"), val(a.ipv4)],
          [i18n.t("system.netMask"), val(a.netmask)],
          [i18n.t("system.netGateway"), val(a.gateway)],
          // dhcp vaut null quand on n'a pas pu conclure : afficher "non"
          // laisserait croire a une adresse fixe, ce qui est une
          // affirmation qu'on n'est pas en mesure de faire.
          // dhcp is null when we could not conclude: showing "no" would
          // suggest a static address, an assertion we are in no position
          // to make.
          [i18n.t("system.netDhcp"),
            a.dhcp == null ? na : esc(i18n.t(a.dhcp ? "common.yes" : "common.no"))]
        ];
        if (a.dhcp) {
          rows.push([i18n.t("system.netDhcpServer"), val(a.dhcpServer)]);
          rows.push([i18n.t("system.netLease"), val(a.leaseExpires)]);
        }
        rows.push([i18n.t("system.netDns"), a.dns && a.dns.length ? esc(a.dns.join(", ")) : na]);
        rows.push([i18n.t("system.netDomain"), val(a.domain || d.domain)]);
        if (a.mac) rows.push([i18n.t("system.netMac"), esc(a.mac)]);
        if (a.ipv6 && a.ipv6.length) rows.push(["IPv6", esc(a.ipv6.join(", "))]);

        return `<div class="pwn-card">
          <h3 class="pwn-title"><span class="pwn-kind pwn-${a.type === "wifi" ? "wifi" : "wired"}"></span>${esc(a.name)}</h3>
          <dl class="pwn-list">${rows.map(([k, v]) =>
            `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
        </div>`;
      }).join("");

      const m = document.createElement("div");
      m.className = "modal modal-stacked";
      m.innerHTML = `
        <div class="modal-card pwn-modal">
          <header class="modal-head">
            <h2>${esc(i18n.t("system.netTitle"))}</h2>
            <button class="modal-close" data-x aria-label="Close">&times;</button>
          </header>
          <div class="pwn-body">
            <div class="pwn-host">
              <span>${esc(i18n.t("system.netHostname"))}</span>
              <b>${esc(d.hostname || "")}</b>
              ${d.domain ? `<span class="pwn-suffix">${esc(d.domain)}</span>` : ""}
            </div>
            ${cards || `<div class="pwn-empty">${esc(i18n.t("system.netNone"))}</div>`}
            ${d.partial ? `<div class="pwn-partial">${esc(i18n.t("system.netPartial"))}</div>` : ""}
          </div>
        </div>`;
      document.body.appendChild(m);
      this.modal = m;
      m.querySelector("[data-x]").addEventListener("pointerup", (e) => {
        e.preventDefault(); m.remove(); this.modal = null;
      });
    }

    destroy() {
      clearInterval(this.timer);
      if (this.modal) this.modal.remove();
    }
  }

  window.PiBoard.registerWidget("system", SystemWidget);
})();
