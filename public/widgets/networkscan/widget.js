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

  /* Variante pour les valeurs d'attribut : les guillemets doubles
     doivent etre echappes eux aussi, sinon un nom personnalise qui en
     contient tronquerait l'attribut value= (meme classe de bug que
     celui corrige dans l'editeur de rangees en v1.77).
     Variant for attribute values: double quotes must be escaped too,
     otherwise a custom name containing one would truncate the value=
     attribute (same bug class as the one fixed in the rows editor in
     v1.77). */
  function escapeHtmlAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
      this.editingIndex = null; // index de la ligne en cours de renommage / row being renamed
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
        ? hosts.map((h, idx) => this.rowHtml(h, idx)).join("")
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
      this.wireRows();
    }

    /* Nom affiche pour un hote : le nom personnalise s'il existe, sinon
       le nom detecte, sinon le libelle "Hote inconnu (fabricant)".
       Name shown for a host: the custom name if any, otherwise the
       detected one, otherwise the "Unknown host (vendor)" label. */
    displayName(h) {
      return h.alias || h.hostname || unknownLabel(h, this.ctx.i18n);
    }

    /* Une ligne, en mode lecture ou en mode edition. L'index sert de
       reference stable entre le DOM et this.lastData.hosts -- on ne met
       pas la MAC dans le DOM, elle n'a pas a etre exposee la.
       One row, in read or edit mode. The index is the stable reference
       between the DOM and this.lastData.hosts -- the MAC is not put in
       the DOM, it has no business being exposed there. */
    rowHtml(h, idx) {
      const i18n = this.ctx.i18n;
      if (this.editingIndex === idx) {
        const current = h.alias || h.hostname || "";
        return `
          <div class="pwn-row pwn-editing" data-idx="${idx}">
            <input type="text" class="pwn-edit-input" maxlength="40"
                   value="${escapeHtmlAttr(current)}"
                   placeholder="${escapeHtmlAttr(i18n.t("netscan.namePlaceholder"))}">
            <button type="button" class="pwn-edit-ok" title="${escapeHtmlAttr(i18n.t("netscan.save"))}">✓</button>
            <button type="button" class="pwn-edit-cancel" title="${escapeHtmlAttr(i18n.t("netscan.cancel"))}">✕</button>
          </div>`;
      }
      // Le nom detecte est rappele en second plan quand un nom
      // personnalise le remplace, pour garder la correspondance avec ce
      // que renvoie le reseau. The detected name is recalled as
      // secondary info when a custom name replaces it, to keep the
      // mapping with what the network reports.
      const orig = h.alias && h.hostname ? `<span class="pwn-orig">${escapeHtml(h.hostname)}</span>` : "";
      return `
        <div class="pwn-row${h.isSelf ? " pwn-self" : ""}${h.alias ? " pwn-aliased" : ""}" data-idx="${idx}">
          <span class="pwn-name">${escapeHtml(this.displayName(h))}</span>
          ${orig}
          <span class="pwn-sep">—</span>
          <span class="pwn-ip">${escapeHtml(h.ip)}</span>
          <button type="button" class="pwn-rename-btn" title="${escapeHtmlAttr(this.ctx.i18n.t("netscan.rename"))}">✎</button>
        </div>`;
    }

    wireRows() {
      const el = this.ctx.el;
      // pointerup plutot que click : sur l'ecran tactile du kiosque, le
      // click peut etre absorbe par les couches sous-jacentes (meme
      // constat que sur les autres tuiles tactiles du projet).
      // pointerup rather than click: on the kiosk touchscreen, click
      // can be swallowed by underlying layers (same finding as on the
      // project's other touch tiles).
      el.querySelectorAll(".pwn-rename-btn").forEach((btn) => {
        btn.addEventListener("pointerup", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const row = btn.closest(".pwn-row");
          this.editingIndex = Number(row && row.dataset.idx);
          this.render();
          const input = this.ctx.el.querySelector(".pwn-edit-input");
          if (input) { input.focus(); input.select(); }
        });
      });

      const input = el.querySelector(".pwn-edit-input");
      if (!input) return;
      // stopPropagation() sur les evenements de saisie : en mode
      // edition du tableau, un clic sur la tuile rouvrirait ses
      // reglages. stopPropagation() on input events: in board edit
      // mode, a click on the tile would reopen its settings.
      ["pointerdown", "pointerup", "click"].forEach((type) => {
        input.addEventListener(type, (e) => e.stopPropagation());
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); this.commitEdit(input.value); }
        else if (e.key === "Escape") { e.preventDefault(); this.cancelEdit(); }
      });
      const ok = el.querySelector(".pwn-edit-ok");
      if (ok) ok.addEventListener("pointerup", (e) => {
        e.stopPropagation(); e.preventDefault(); this.commitEdit(input.value);
      });
      const cancel = el.querySelector(".pwn-edit-cancel");
      if (cancel) cancel.addEventListener("pointerup", (e) => {
        e.stopPropagation(); e.preventDefault(); this.cancelEdit();
      });
    }

    cancelEdit() {
      this.editingIndex = null;
      this.render();
    }

    /* Enregistre le nom cote serveur (data/netHosts.json). Un champ
       vide supprime le nom personnalise et redonne le nom detecte.
       L'affichage est mis a jour localement sans relancer d'analyse.
       Saves the name server-side (data/netHosts.json). An empty field
       removes the custom name and restores the detected one. The
       display is updated locally without re-running a scan. */
    async commitEdit(value) {
      const idx = this.editingIndex;
      const hosts = (this.lastData && this.lastData.hosts) || [];
      const host = hosts[idx];
      this.editingIndex = null;
      if (!host) { this.render(); return; }
      const name = String(value || "").trim().slice(0, 40);
      try {
        const res = await fetch("/api/network-hosts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mac: host.mac || null, ip: host.ip, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("status " + res.status));
        host.alias = name || null;
      } catch (e) {
        console.warn("[piboard/networkscan] rename", e);
      }
      this.render();
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
