/* PiBoard widget: network scan / analyse reseau
   Interroge /api/network-scan (endpoint du coeur PiBoard, voir
   server/networkScan.js) qui balaie le sous-reseau du Pi (ping + table
   ARP) et tente une resolution DNS inverse pour chaque hote actif.
   Affiche chaque hote au format "Nom d'hote — Adresse IP".
   Queries /api/network-scan (PiBoard core endpoint, see
   server/networkScan.js) which sweeps the Pi's subnet (ping + ARP
   table) and attempts a reverse DNS lookup for each active host.
   Displays each host as "Hostname — IP address". */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Libelle affiche quand aucun nom d'hote n'a pu etre resolu : le
     fabricant deduit de l'adresse MAC (server/networkScan.js) vient
     completer l'indication generique, ex. "Hote inconnu (Samsung
     Electronics)" -- sans jamais remplacer un vrai nom d'hote.
     Label shown when no hostname could be resolved: the manufacturer
     deduced from the MAC address (server/networkScan.js) complements
     the generic label, e.g. "Unknown host (Samsung Electronics)" --
     never replacing a real hostname. */
  function unknownLabel(h, i18n) {
    const base = i18n.t("netscan.unknownHost");
    return h.vendor ? base + " (" + h.vendor + ")" : base;
  }

  class NetworkScanWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.scanning = false;
      this.lastData = null; // {hosts, cidr, scannedAt} le plus recent connu / most recent known
    }

    async init() {
      this.renderScanning();
      await this.refresh(false);
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Number(this.ctx.settings.refreshMinutes) || 0;
      if (minutes > 0) {
        this.timer = setInterval(() => this.refresh(true), Math.max(5, minutes) * 60000);
      }
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh(false);
      this.arm();
    }

    onLangChanged() { this.render(); }

    buildUrl(forceRescan) {
      const s = this.ctx.settings;
      const params = [];
      if (forceRescan) params.push("rescan=1");
      if (s.subnetOverride && s.subnetOverride.trim()) params.push("cidr=" + encodeURIComponent(s.subnetOverride.trim()));
      return "/api/network-scan" + (params.length ? "?" + params.join("&") : "");
    }

    async refresh(forceRescan) {
      this.scanning = true;
      this.renderScanning();
      try {
        const res = await fetch(this.buildUrl(forceRescan));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("status " + res.status));
        this.lastData = data;
        this.scanning = !!data.scanning;
        this.render();
      } catch (e) {
        console.warn("[piboard/networkscan]", e);
        this.scanning = false;
        this.renderError(String(e.message || e));
      }
    }

    /* Affiche l'etat "analyse en cours" en conservant la derniere liste
       connue en dessous plutot que de tout effacer -- evite un flash
       vide a chaque rafraichissement automatique ou reveil de tuile.
       Shows the "scanning" state while keeping the last known list
       underneath rather than clearing everything -- avoids an empty
       flash on every auto-refresh or tile wake. */
    renderScanning() {
      if (this.lastData) { this.render(); return; }
      const i18n = this.ctx.i18n;
      this.ctx.el.innerHTML = `<div class="pw-netscan"><div class="pwn-empty">${i18n.t("netscan.scanning")}</div></div>`;
    }

    formatTime(iso) {
      try {
        const locale = this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-US";
        return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        return "";
      }
    }

    render() {
      const i18n = this.ctx.i18n;
      const data = this.lastData || { hosts: [], cidr: "", scannedAt: null };
      const hosts = data.hosts || [];

      const statusParts = [];
      if (this.scanning) statusParts.push(i18n.t("netscan.scanning"));
      else if (data.scannedAt) statusParts.push(i18n.t("netscan.lastScan") + " " + this.formatTime(data.scannedAt));
      if (data.cidr) statusParts.push(data.cidr);

      const rows = hosts.length
        ? hosts.map((h) => `
            <div class="pwn-row${h.isSelf ? " pwn-self" : ""}">
              <span class="pwn-name">${escapeHtml(h.hostname || unknownLabel(h, i18n))}</span>
              <span class="pwn-sep">—</span>
              <span class="pwn-ip">${escapeHtml(h.ip)}</span>
            </div>`).join("")
        : `<div class="pwn-empty">${this.scanning ? i18n.t("netscan.scanning") : i18n.t("netscan.empty")}</div>`;

      this.ctx.el.innerHTML = `
        <div class="pw-netscan">
          <div class="pwn-head">
            <span class="pwn-count">${hosts.length ? hosts.length + " " + i18n.t(hosts.length > 1 ? "netscan.hostsPlural" : "netscan.hostsSingular") : ""}</span>
            <button type="button" class="pwn-scan-btn" ${this.scanning ? "disabled" : ""}>${this.scanning ? i18n.t("netscan.scanning") : i18n.t("netscan.scanNow")}</button>
          </div>
          <div class="pwn-status">${escapeHtml(statusParts.join(" · "))}</div>
          <div class="pwn-list">${rows}</div>
        </div>`;
      this.wireScanButton();
    }

    renderError(message) {
      const i18n = this.ctx.i18n;
      this.ctx.el.innerHTML = `
        <div class="pw-netscan">
          <div class="pwn-head">
            <span class="pwn-count"></span>
            <button type="button" class="pwn-scan-btn">${i18n.t("netscan.scanNow")}</button>
          </div>
          <div class="pwn-empty pwn-err">${i18n.t("netscan.error")} ${escapeHtml(message)}</div>
        </div>`;
      this.wireScanButton();
    }

    wireScanButton() {
      const btn = this.ctx.el.querySelector(".pwn-scan-btn");
      if (!btn) return;
      // stopPropagation() : meme raison que le bouton de gestion du
      // diaporama -- en mode edition, un clic sur la tuile rouvrirait ses
      // reglages a la place de lancer l'analyse.
      // stopPropagation(): same reason as the Slideshow manage button --
      // in edit mode, a click on the tile would reopen its settings
      // instead of starting the scan.
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.scanning) this.refresh(true);
      });
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("networkscan", NetworkScanWidget);
})();
