/* PiBoard widget: network scan / analyse reseau
   Interroge /api/network-scan (endpoint du coeur PiBoard, voir
   server/networkScan.js) qui balaie le sous-reseau du Pi (ping + table
   ARP) et tente une resolution DNS inverse pour chaque hote actif.
   Affiche chaque hote au format "Nom d'hote — Adresse IP".
   Queries /api/network-scan (PiBoard core endpoint, see
   server/networkScan.js) which sweeps the Pi's subnet (ping + ARP
   table) and attempts a reverse DNS lookup for each active host.
   Displays each host as "Hostname — IP address".
   Surveillance (1.170.0) : l'utilisateur memorise les hotes presents a
   un instant T (bouton « Memoriser ») ; un hote absent de cette
   reference est ensuite signale NOUVEAU (pastille, bandeau, alerte
   plein ecran + son, webhook). Voir server/netBaseline.js.
   Surveillance (1.170.0): the user memorizes the hosts present at a
   moment T ("Memorize" button); a host missing from that reference is
   then flagged NEW (badge, banner, full-screen alert + sound,
   webhook). See server/netBaseline.js. */
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
      this.note = "";      // compte rendu du dernier export/import / last export-import report
      this.noteKind = "";  // "ok" | "err" | "" -- couleur du compte rendu / report colour
      this.view = "list";  // "list" | "log" -- journal des hotes / host journal
      this.logData = null; // dernier journal charge / last loaded journal
      this.confirm = null; // action en attente de confirmation (double touche) / action awaiting confirmation (double tap)
      this.screenSeen = null; // evenements deja annonces a l'ecran (null = 1er chargement) / events already announced on screen (null = first load)
      this.claimTried = new Set(); // evenements deja proposes au serveur pour le webhook / events already offered to the server for the webhook
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
      const absent = Number(s.absentHours) || 0;
      if (absent > 0) params.push("absentHours=" + Math.min(720, absent));
      if (s.alertRandomMac === true) params.push("alertRandom=1");
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
        this.processAlerts(data);
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

    formatDateTime(iso) {
      try {
        const locale = this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-US";
        return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        return "";
      }
    }

    /* Barre de la reference : date et taille de la reference memorisee,
       bouton pour la (re)memoriser, journal, suppression. Les actions
       destructives demandent une seconde touche (« Confirmer ? ») plutot
       qu'une boite de dialogue, que le kiosque tactile gere mal.
       Reference bar: date and size of the memorized reference, button to
       (re)memorize it, journal, deletion. Destructive actions ask for a
       second tap ("Confirm?") rather than a dialog box, which the touch
       kiosk handles poorly. */
    baselineBarHtml(data) {
      const i18n = this.ctx.i18n;
      const b = data.baseline;
      const noHost = !(data.hosts && data.hosts.length);
      const text = b
        ? i18n.t("netscan.baseSince") + " " + this.formatDateTime(b.at) + " · " + b.count + " " + i18n.t("netscan.baseDevices")
        : i18n.t("netscan.baseNone");
      const memLabel = this.confirm === "memorize"
        ? i18n.t("netscan.baseConfirm")
        : i18n.t(b ? "netscan.baseUpdate" : "netscan.baseMemorize");
      const reset = b
        ? `<button type="button" class="pwn-io-btn${this.confirm === "reset" ? " pwn-confirm" : ""}" data-act="reset" title="${escapeHtmlAttr(i18n.t("netscan.baseResetTitle"))}">${this.confirm === "reset" ? escapeHtml(i18n.t("netscan.baseConfirm")) : "✕"}</button>`
        : "";
      return `
          <div class="pwn-base">
            <span class="pwn-base-text">${escapeHtml(text)}</span>
            <button type="button" class="pwn-io-btn pwn-mem-btn${this.confirm === "memorize" ? " pwn-confirm" : ""}" data-act="memorize" ${noHost ? "disabled" : ""} title="${escapeHtmlAttr(i18n.t("netscan.baseMemorizeTitle"))}">${escapeHtml(memLabel)}</button>
            <button type="button" class="pwn-io-btn${this.view === "log" ? " pwn-on" : ""}" data-act="log" title="${escapeHtmlAttr(i18n.t("netscan.logTitle"))}">${escapeHtml(i18n.t(this.view === "log" ? "netscan.logBack" : "netscan.log"))}</button>
            ${reset}
          </div>`;
    }

    bannerHtml(data) {
      const i18n = this.ctx.i18n;
      const n = Number(data.newCount) || 0;
      const c = Number(data.changedCount) || 0;
      if (!n && !c) return "";
      const parts = [];
      if (n) parts.push(n + " " + i18n.t(n > 1 ? "netscan.bannerNewN" : "netscan.bannerNew1"));
      if (c) parts.push(c + " " + i18n.t(c > 1 ? "netscan.bannerChangedN" : "netscan.bannerChanged1"));
      return `
          <div class="pwn-banner">
            <span>⚠ ${escapeHtml(parts.join(" · "))}</span>
            <button type="button" class="pwn-io-btn" data-act="ackall">${escapeHtml(i18n.t("netscan.ackAll"))}</button>
          </div>`;
    }

    absentHtml(data) {
      const i18n = this.ctx.i18n;
      const list = data.absent || [];
      if (!list.length) return "";
      const h = Number(this.ctx.settings.absentHours) || 0;
      const rows = list.map((a, idx) => `
          <div class="pwn-row pwn-absent" data-aidx="${idx}">
            <span class="pwn-name">${escapeHtml(a.name)}</span>
            <span class="pwn-sep">—</span>
            <span class="pwn-ip">${escapeHtml(i18n.t("netscan.lastSeen") + " " + this.formatDateTime(a.lastSeen))}</span>
            <button type="button" class="pwn-rename-btn pwn-forget-btn" data-act="forget" title="${escapeHtmlAttr(i18n.t("netscan.forget"))}">✕</button>
          </div>`).join("");
      return `<div class="pwn-absent-title">${escapeHtml(i18n.t("netscan.absentTitle").replace("{h}", String(h)))}</div>${rows}`;
    }

    logHtml() {
      const i18n = this.ctx.i18n;
      const log = this.logData;
      if (!log) return `<div class="pwn-empty">${escapeHtml(i18n.t("netscan.scanning"))}</div>`;
      if (!log.length) return `<div class="pwn-empty">${escapeHtml(i18n.t("netscan.logEmpty"))}</div>`;
      const ICON = { new: "🆕", arrive: "➕", leave: "➖", changed: "🔁", baseline: "📌", reset: "♻️", ack: "✓", forget: "🗑" };
      return log.map((e) => {
        const label = e.type === "baseline"
          ? i18n.t("netscan.log_baseline").replace("{n}", String(e.count || 0))
          : (e.label ? e.label : "");
        return `
          <div class="pwn-row pwn-logrow">
            <span class="pwn-log-time">${escapeHtml(this.formatDateTime(e.t))}</span>
            <span class="pwn-log-icon" title="${escapeHtmlAttr(i18n.t("netscan.log_" + e.type))}">${ICON[e.type] || "•"}</span>
            <span class="pwn-name">${escapeHtml(label || i18n.t("netscan.log_" + e.type))}</span>
            <span class="pwn-ip">${escapeHtml(e.ip || "")}</span>
          </div>`;
      }).join("");
    }

    render() {
      const i18n = this.ctx.i18n;
      const data = this.lastData || { hosts: [], cidr: "", scannedAt: null };
      const hosts = data.hosts || [];

      const statusParts = [];
      if (this.scanning) statusParts.push(i18n.t("netscan.scanning"));
      else if (data.scannedAt) statusParts.push(i18n.t("netscan.lastScan") + " " + this.formatTime(data.scannedAt));
      if (data.cidr) statusParts.push(data.cidr);

      let body;
      if (this.view === "log") {
        body = this.logHtml();
      } else {
        const rows = hosts.length
          ? hosts.map((h, idx) => this.rowHtml(h, idx)).join("")
          : `<div class="pwn-empty">${this.scanning ? i18n.t("netscan.scanning") : i18n.t("netscan.empty")}</div>`;
        body = rows + this.absentHtml(data);
      }

      this.ctx.el.innerHTML = `
        <div class="pw-netscan">
          <div class="pwn-head">
            <span class="pwn-count">${hosts.length ? hosts.length + " " + i18n.t(hosts.length > 1 ? "netscan.hostsPlural" : "netscan.hostsSingular") : ""}</span>
            <button type="button" class="pwn-io-btn" data-io="export" title="${escapeHtmlAttr(i18n.t("netscan.exportTitle"))}">${i18n.t("netscan.export")}</button>
            <button type="button" class="pwn-io-btn" data-io="import" title="${escapeHtmlAttr(i18n.t("netscan.importTitle"))}">${i18n.t("netscan.import")}</button>
            <button type="button" class="pwn-scan-btn" ${this.scanning ? "disabled" : ""}>${this.scanning ? i18n.t("netscan.scanning") : i18n.t("netscan.scanNow")}</button>
          </div>
          <div class="pwn-status">${escapeHtml(statusParts.join(" · "))}</div>
          ${this.baselineBarHtml(data)}
          ${this.bannerHtml(data)}
          <div class="pwn-note${this.noteKind ? " pwn-note-" + this.noteKind : ""}">${escapeHtml(this.note || "")}</div>
          <div class="pwn-list">${body}</div>
        </div>`;
      this.wireScanButton();
      this.wireIoButtons();
      this.wireActions();
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
      // Pastilles de surveillance : NOUVEAU, MAC aleatoire, modifie.
      // Surveillance badges: NEW, random MAC, changed.
      let badges = "";
      let ack = "";
      if (h.status === "new") {
        badges += `<span class="pwn-badge pwn-badge-new">${escapeHtml(i18n.t("netscan.badgeNew"))}</span>`;
        if (h.randomMac) badges += `<span class="pwn-badge pwn-badge-rnd" title="${escapeHtmlAttr(i18n.t("netscan.badgeRandomTitle"))}">${escapeHtml(i18n.t("netscan.badgeRandom"))}</span>`;
      }
      if (h.changed) {
        const was = [h.changed.fromIp, h.changed.fromHostname].filter(Boolean).join(" / ");
        badges += `<span class="pwn-badge pwn-badge-chg" title="${escapeHtmlAttr(i18n.t("netscan.changedTitle") + " " + was)}">${escapeHtml(i18n.t("netscan.badgeChanged"))}</span>`;
      }
      if (h.status === "new" || h.changed) {
        ack = `<button type="button" class="pwn-rename-btn pwn-ack-btn" data-act="ack" title="${escapeHtmlAttr(i18n.t("netscan.ack"))}">✓</button>`;
      }
      return `
        <div class="pwn-row${h.isSelf ? " pwn-self" : ""}${h.alias ? " pwn-aliased" : ""}${h.status === "new" ? " pwn-new" : ""}${h.changed ? " pwn-changed" : ""}" data-idx="${idx}">
          <span class="pwn-name">${escapeHtml(this.displayName(h))}</span>
          ${badges}
          ${orig}
          <span class="pwn-sep">—</span>
          <span class="pwn-ip">${escapeHtml(h.ip)}</span>
          ${ack}
          <button type="button" class="pwn-rename-btn" title="${escapeHtmlAttr(this.ctx.i18n.t("netscan.rename"))}">✎</button>
        </div>`;
    }

    wireRows() {
      const el = this.ctx.el;
      /* Fenetre « hote » (1.174.0) : un appui sur la ligne, hors de ses
         boutons, l'ouvre. Un glissement (defilement de la liste au doigt)
         ne l'ouvre pas. Host window: a tap on the row, outside its
         buttons, opens it; a drag (scrolling the list) does not. */
      el.querySelectorAll(".pwn-row[data-idx]:not(.pwn-editing), .pwn-row[data-aidx]").forEach((row) => {
        let start = null;
        row.addEventListener("pointerdown", (e) => { start = { x: e.clientX || 0, y: e.clientY || 0 }; });
        row.addEventListener("pointerup", (e) => {
          if (e.target && e.target.closest && e.target.closest("button, input, a")) return;
          const moved = start ? Math.abs((e.clientX || 0) - start.x) + Math.abs((e.clientY || 0) - start.y) : 0;
          start = null;
          if (moved > 12) return;
          if (document.body.classList.contains("editing")) return;
          e.stopPropagation();
          const data = this.lastData || {};
          const host = row.dataset.aidx != null
            ? Object.assign({ absent: true }, (data.absent || [])[Number(row.dataset.aidx)])
            : (data.hosts || [])[Number(row.dataset.idx)];
          if (host && host.ip) this.openHost(host);
        });
      });
      // pointerup plutot que click : sur l'ecran tactile du kiosque, le
      // click peut etre absorbe par les couches sous-jacentes (meme
      // constat que sur les autres tuiles tactiles du projet).
      // pointerup rather than click: on the kiosk touchscreen, click
      // can be swallowed by underlying layers (same finding as on the
      // project's other touch tiles).
      el.querySelectorAll(".pwn-rename-btn:not([data-act])").forEach((btn) => {
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

    /* ---------- Reference des hotes : actions ----------
       Boutons a attribut data-act, relies apres chaque rendu. pointerup
       et stopPropagation() : meme raison que les autres boutons de la
       tuile (ecran tactile, mode edition du tableau).
       Host reference: actions. Buttons with a data-act attribute, wired
       after every render. pointerup and stopPropagation(): same reason
       as the tile's other buttons (touchscreen, board edit mode). */
    wireActions() {
      this.ctx.el.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("pointerup", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (btn.disabled) return;
          const row = btn.closest(".pwn-row");
          this.runAction(btn.dataset.act, row);
        });
      });
    }

    async api(url, method, body) {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || ("status " + res.status));
      return out;
    }

    /* Double touche : la 1re arme l'action (« Confirmer ? »), la 2nde, dans
       les 4 secondes, l'execute. Double tap: the 1st arms the action
       ("Confirm?"), the 2nd, within 4 seconds, runs it. */
    armed(act) {
      if (this.confirm === act) { this.confirm = null; clearTimeout(this.confirmTimer); return true; }
      this.confirm = act;
      this.render();
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => { this.confirm = null; this.render(); }, 4000);
      return false;
    }

    async runAction(act, row) {
      const i18n = this.ctx.i18n;
      const data = this.lastData || {};
      try {
        if (act === "log") {
          this.view = this.view === "log" ? "list" : "log";
          this.logData = null;
          this.render();
          if (this.view === "log") await this.loadLog();
          return;
        }
        if (act === "memorize") {
          if (data.baseline && !this.armed("memorize")) return;
          const out = await this.api("/api/network-baseline/memorize", "POST", {});
          this.screenSeen = null;
          this.claimTried.clear();
          this.setNote(i18n.t("netscan.baseDone") + " " + out.baseline.count + " " + i18n.t("netscan.baseDevices"), "ok");
          await this.refresh(false);
          return;
        }
        if (act === "reset") {
          if (!this.armed("reset")) return;
          await this.api("/api/network-baseline", "DELETE");
          this.claimTried.clear();
          this.setNote(i18n.t("netscan.baseResetDone"), "ok");
          await this.refresh(false);
          return;
        }
        if (act === "ack" || act === "ackall") {
          const hosts = data.hosts || [];
          const keys = act === "ackall"
            ? hosts.filter((h) => h.status === "new" || h.changed).map((h) => h.key)
            : [hosts[Number(row && row.dataset.idx)] && hosts[Number(row.dataset.idx)].key];
          const clean = keys.filter(Boolean);
          if (!clean.length) return;
          await this.api("/api/network-baseline/ack", "POST", { keys: clean });
          await this.refresh(false);
          return;
        }
        if (act === "forget") {
          const a = (data.absent || [])[Number(row && row.dataset.aidx)];
          if (!a) return;
          await this.api("/api/network-baseline/forget", "POST", { keys: [a.key] });
          await this.refresh(false);
        }
      } catch (e) {
        console.warn("[piboard/networkscan] action", act, e);
        const msg = /no scan yet/.test(String(e.message)) ? i18n.t("netscan.baseNoScan") : String(e.message || e);
        this.setNote(msg, "err");
      }
    }

    async loadLog() {
      try {
        const out = await this.api("/api/network-baseline?limit=100", "GET");
        this.logData = out.log || [];
      } catch (e) {
        this.logData = [];
      }
      if (this.view === "log") this.render();
    }

    /* ---------- Alertes ----------
       Trois evenements : « new » (hote absent de la reference),
       « changed » (IP ou nom d'un appareil connu modifie), « absent »
       (appareil connu non vu depuis N heures). Alerte a l'ecran : une
       seule fois par evenement et par ecran. Au tout premier chargement,
       seuls les evenements de moins de 3 minutes alertent : un hote
       arrive hier et deja connu ne doit pas faire clignoter l'ecran
       parce que le tableau vient de redemarrer. Webhook : l'evenement
       est revendique aupres du serveur, qui ne l'accorde qu'une fois,
       meme si le Pi et le Mac affichent tous deux la tuile.
       Alerts. Three events: "new" (host missing from the reference),
       "changed" (a known device's IP or name changed), "absent" (known
       device not seen for N hours). On-screen alert: once per event and
       per screen. On the very first load, only events under 3 minutes
       old alert: a host that arrived yesterday and is already known must
       not flash the screen because the board just restarted. Webhook:
       the event is claimed from the server, which grants it only once,
       even if the Pi and the Mac both display the tile. */
    collectEvents(data) {
      const s = this.ctx.settings;
      const events = [];
      (data.hosts || []).forEach((h) => {
        if (h.status === "new" && h.alert && h.eventId) {
          events.push({ id: h.eventId, kind: "new", name: this.displayName(h), ip: h.ip, mac: h.mac, vendor: h.vendor, ts: h.firstSeen });
        } else if (h.status === "known" && h.changed && s.alertChanges !== false && h.eventId) {
          events.push({ id: h.eventId, kind: "changed", name: this.displayName(h), ip: h.ip, mac: h.mac, vendor: h.vendor, ts: h.changed.at });
        }
      });
      if ((Number(s.absentHours) || 0) > 0) {
        (data.absent || []).forEach((a) => {
          events.push({ id: a.eventId, kind: "absent", name: a.name, ip: a.ip, mac: a.mac, vendor: a.vendor, ts: null, last: a.lastSeen });
        });
      }
      return events;
    }

    processAlerts(data) {
      const s = this.ctx.settings;
      const events = this.collectEvents(data);
      const first = this.screenSeen === null;
      if (first) this.screenSeen = new Set();
      const fresh = events.filter((e) => !this.screenSeen.has(e.id));
      events.forEach((e) => this.screenSeen.add(e.id));

      const recent = (e) => e.ts && (Date.now() - new Date(e.ts).getTime()) < 180000;
      const toScreen = fresh.filter((e) => !first || recent(e));
      const wantsFlash = s.alertFlash !== false;
      const wantsSound = s.alertSound !== false;
      if (toScreen.length && (wantsFlash || wantsSound) && this.ctx.api && this.ctx.api.startAlert) {
        this.ctx.api.startAlert({
          flash: wantsFlash,
          soundName: wantsSound ? (s.soundChoice || "beep-double") : null,
          durationMs: Math.max(1, Number(s.alertDurationSeconds) || 15) * 1000
        });
      }

      if (s.notifyUrl && String(s.notifyUrl).trim()) {
        const todo = events.filter((e) => !this.claimTried.has(e.id));
        todo.forEach((e) => this.claimTried.add(e.id));
        if (todo.length) this.sendNotifications(todo);
      }
    }

    fillTemplate(text, e) {
      const details = [e.ip, e.mac, e.vendor].filter(Boolean).join(", ");
      return String(text)
        .replace(/\{name\}/g, e.name || "")
        .replace(/\{ip\}/g, e.ip || "")
        .replace(/\{mac\}/g, e.mac || "")
        .replace(/\{vendor\}/g, e.vendor || "")
        .replace(/\{details\}/g, details)
        .replace(/\{event\}/g, e.kind)
        .replace(/\{last\}/g, e.last ? this.formatDateTime(e.last) : "");
    }

    async sendNotifications(list) {
      const s = this.ctx.settings;
      try {
        const out = await this.api("/api/network-baseline/claim", "POST", { ids: list.map((e) => e.id) });
        const granted = new Set(out.granted || []);
        const i18n = this.ctx.i18n;
        list.filter((e) => granted.has(e.id)).forEach((e) => {
          const tpl = (s.notifyMessage && String(s.notifyMessage).trim())
            || i18n.t(e.kind === "new" ? "netscan.msgNew" : e.kind === "changed" ? "netscan.msgChanged" : "netscan.msgAbsent");
          const message = this.fillTemplate(tpl, e).replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
          const url = String(s.notifyUrl).includes("{message}")
            ? String(s.notifyUrl).replace(/\{message\}/g, encodeURIComponent(message))
            : s.notifyUrl;
          this.ctx.api.notify(url, s.notifyMethod, message);
        });
      } catch (e) {
        console.warn("[piboard/networkscan] claim", e);
      }
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

    /* ---------- Export / import de la table des noms ----------
       Les noms donnes aux appareils sont une saisie longue et
       fastidieuse : ces deux boutons la rendent transportable d'un
       PiBoard a l'autre, et relisible dans un tableur. Le format et ses
       choix sont decrits dans server/netHosts.js.
       Export / import of the names table. The names given to devices
       are long, tedious typing: these two buttons make it portable from
       one PiBoard to another, and readable in a spreadsheet. The format
       and its choices are described in server/netHosts.js. */
    setNote(text, kind) {
      this.note = text || "";
      this.noteKind = kind || "";
      const el = this.ctx.el.querySelector(".pwn-note");
      if (el) {
        el.textContent = this.note;
        el.className = "pwn-note" + (this.noteKind ? " pwn-note-" + this.noteKind : "");
      }
      // Le compte rendu s'efface tout seul : il renseigne sur une action
      // ponctuelle et n'a pas a occuper durablement une tuile dont la
      // place est comptee.
      // The report clears itself: it informs about a one-off action and
      // has no business permanently occupying a tile where space is
      // tight.
      clearTimeout(this.noteTimer);
      if (this.note) this.noteTimer = setTimeout(() => this.setNote(""), 12000);
    }

    wireIoButtons() {
      this.ctx.el.querySelectorAll(".pwn-io-btn[data-io]").forEach((btn) => {
        // pointerup et stopPropagation() : meme raison que les autres
        // boutons de la tuile (ecran tactile, mode edition du tableau).
        // pointerup and stopPropagation(): same reason as the tile's
        // other buttons (touchscreen, board edit mode).
        btn.addEventListener("pointerup", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (btn.dataset.io === "export") this.exportCsv();
          else this.pickImportFile();
        });
      });
    }

    exportCsv() {
      const dialect = this.ctx.settings.csvDialect === "international" ? "international" : "french";
      // Navigation simple : le serveur pose deja Content-Disposition.
      // Plain navigation: the server already sets Content-Disposition.
      window.open("/api/network-hosts/export.csv?dialect=" + dialect, "_blank");
    }

    /* Le fichier est lu par le navigateur puis poste en texte brut :
       PiBoard n'embarque pas d'analyseur multipart, et cette voie evite
       d'en ajouter un pour un seul usage. Le champ de fichier est cree
       a la volee et jamais insere dans la tuile -- un input visible y
       serait a la fois encombrant et cliquable par megarde en mode
       edition.
       The file is read by the browser then posted as plain text:
       PiBoard embeds no multipart parser, and this route avoids adding
       one for a single use. The file field is created on the fly and
       never inserted into the tile -- a visible input would be both
       bulky and clickable by accident in edit mode. */
    pickImportFile() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv,text/plain";
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (file) await this.importCsv(file);
      });
      input.click();
    }

    async importCsv(file) {
      const i18n = this.ctx.i18n;
      this.setNote(i18n.t("netscan.importing"));
      try {
        const text = await file.text();
        const res = await fetch("/api/network-hosts/import", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: text
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out.error || ("status " + res.status));
        const parts = [
          out.added + " " + i18n.t("netscan.importAdded"),
          out.updated + " " + i18n.t("netscan.importUpdated")
        ];
        if (out.skipped) parts.push(out.skipped + " " + i18n.t("netscan.importSkipped"));
        this.setNote(parts.join(" · "), "ok");
        // Une analyse n'est pas necessaire : les noms importes
        // s'appliquent aux hotes deja affiches, et le serveur les
        // renvoie a la prochaine lecture. On rafraichit sans relancer
        // de balayage, donc sans les dix a vingt secondes d'attente.
        // No scan is needed: imported names apply to the hosts already
        // displayed, and the server returns them on the next read. We
        // refresh without starting a sweep, hence without the ten to
        // twenty seconds' wait.
        await this.refresh(false);
      } catch (e) {
        console.warn("[piboard/networkscan] import", e);
        this.setNote(i18n.t("netscan.importFailed") + " " + String(e.message || e), "err");
      }
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

    /* ====================================================================
       FENETRE D'UN HOTE (1.174.0) : informations, tests (ping, ports,
       traceroute, noms, ARP), surveillance, interface web, reveil reseau,
       copie de l'IP / de la MAC. Posee sur <body> : une tuile est trop
       petite, et un element `fixed` dans la grille serait mal place.
       HOST WINDOW: info, tests, monitoring, web UI, Wake-on-LAN, copy.
       ==================================================================== */
    openHost(h) {
      this.closeHost();
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const esc = escapeHtml, attr = escapeHtmlAttr;
      const mac = h.mac || "";
      const first = mac ? parseInt(mac.replace(/[^0-9a-f]/gi, "").slice(0, 2), 16) : NaN;
      const macKind = !mac ? "—" : (first & 2 ? t("macLocal") : t("macGlobal"));
      const name = h.absent ? h.name : this.displayName(h);
      const back = document.createElement("div");
      back.className = "pwn-hw-back";
      back.innerHTML = `
        <div class="pwn-hw" role="dialog" aria-modal="true" aria-label="${attr(name)}">
          <div class="pwn-hw-head">
            <div class="pwn-hw-title"><b>${esc(name)}</b><span>${esc(h.ip)}${mac ? " · " + esc(mac) : ""}</span></div>
            <button type="button" class="pwn-hw-x" data-hw="close" aria-label="${attr(t("close"))}">✕</button>
          </div>
          <div class="pwn-hw-info">
            <div><span>${esc(t("ip"))}</span><b>${esc(h.ip)}</b><button type="button" class="pwn-hw-mini" data-hw="copyip">${esc(t("copy"))}</button></div>
            <div><span>${esc(t("mac"))}</span><b>${esc(mac || "—")}</b>${mac ? `<button type="button" class="pwn-hw-mini" data-hw="copymac">${esc(t("copy"))}</button>` : ""}</div>
            <div><span>${esc(t("vendor"))}</span><b>${esc(h.vendor || "—")}</b></div>
            <div><span>${esc(t("macKind"))}</span><b>${esc(macKind)}</b></div>
            <div><span>${esc(t("hostname"))}</span><b>${esc(h.hostname || "—")}</b></div>
            <div><span>${esc(t("state"))}</span><b>${esc(h.absent ? t("stateAbsent") : h.isSelf ? t("stateSelf") : h.status === "new" ? t("stateNew") : t("statePresent"))}</b></div>
          </div>
          <div class="pwn-hw-acts">
            <button type="button" class="pwn-hw-btn" data-hw="ping">${esc(t("ping"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="ports">${esc(t("ports"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="trace">${esc(t("trace"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="names">${esc(t("names"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="arp">${esc(t("arp"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="watch">${esc(t("watch"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="web">${esc(t("web"))}</button>
            <button type="button" class="pwn-hw-btn" data-hw="wol"${mac && !h.isSelf ? "" : " disabled"}>${esc(t("wol"))}</button>
          </div>
          <label class="pwn-hw-portsline"><span>${esc(t("portsExtra"))}</span><input type="text" class="pwn-hw-ports" placeholder="8888, 10000-10010" autocomplete="off" spellcheck="false"></label>
          <div class="pwn-hw-results"></div>
        </div>`;
      document.body.appendChild(back);
      this.hw = { back, host: h, web: "http://" + h.ip + "/", watch: null };
      const box = back.querySelector(".pwn-hw");
      ["pointerdown", "pointerup", "click", "keydown", "contextmenu"].forEach((ty) => box.addEventListener(ty, (e) => e.stopPropagation()));
      back.addEventListener("pointerup", (e) => { if (e.target === back) this.closeHost(); });
      box.querySelectorAll("[data-hw]").forEach((b) => b.addEventListener("pointerup", (e) => {
        e.preventDefault();
        if (b.disabled) return;
        this.hostAction(b.dataset.hw, b);
      }));
      box.querySelectorAll("button[data-hw]").forEach((b) => b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.hostAction(b.dataset.hw, b); }
      }));
      this.hwKey = (e) => { if (e.key === "Escape") this.closeHost(); };
      document.addEventListener("keydown", this.hwKey);
      const firstBtn = box.querySelector('[data-hw="ping"]');
      if (firstBtn && firstBtn.focus) firstBtn.focus();
    }

    closeHost() {
      if (!this.hw) return;
      if (this.hw.watch) clearTimeout(this.hw.watch.timer);
      this.hw.back.remove();
      this.hw = null;
      if (this.hwKey) { document.removeEventListener("keydown", this.hwKey); this.hwKey = null; }
    }

    hwCard(key, title) {
      const res = this.hw.back.querySelector(".pwn-hw-results");
      let card = res.querySelector('[data-card="' + key + '"]');
      if (!card) {
        card = document.createElement("div");
        card.className = "pwn-hw-card";
        card.dataset.card = key;
        res.prepend(card);
      }
      card.innerHTML = `<div class="pwn-hw-card-t">${escapeHtml(title)}</div><div class="pwn-hw-card-b"></div>`;
      return card.querySelector(".pwn-hw-card-b");
    }

    async hwPost(path, body) {
      const r = await fetch("/api/net-tools/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(out.error || ("status " + r.status));
        err.code = out.error;
        throw err;
      }
      return out;
    }

    copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => this.copyFallback(text));
      } catch (e) { /* noop */ }
      return Promise.resolve(this.copyFallback(text));
    }

    copyFallback(text) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        return !!ok;
      } catch (e) { return false; }
    }

    ms(v) { return v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString(this.ctx.i18n.lang === "en" ? "en-GB" : "fr-FR") + " ms"; }

    async hostAction(act, btn) {
      if (!this.hw) return;
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const esc = escapeHtml;
      const h = this.hw.host;
      const ip = h.ip;
      const busy = (b, on) => { if (b) { b.disabled = on; b.classList.toggle("busy", on); } };
      const fail = (body, e) => { body.innerHTML = `<div class="pwn-hw-err">${esc(e && e.code === "private-only" ? t("privateOnly") : t("error") + " " + (e && e.message || ""))}</div>`; };

      if (act === "close") return this.closeHost();
      if (act === "copyip" || act === "copymac") {
        const ok = await this.copyText(act === "copyip" ? ip : h.mac);
        if (btn) { const old = btn.textContent; btn.textContent = ok ? t("copied") : t("copyFail"); setTimeout(() => { btn.textContent = old; }, 1500); }
        return;
      }
      if (act === "web") {
        window.open(this.hw.web, "_blank", "noopener");
        return;
      }
      if (act === "watch") return this.toggleWatch(btn);

      const titles = { ping: t("ping"), ports: t("ports"), trace: t("trace"), names: t("names"), arp: t("arp"), wol: t("wol") };
      const body = this.hwCard(act, titles[act] || act);
      body.innerHTML = `<div class="pwn-hw-wait">${esc(t("running"))}</div>`;
      busy(btn, true);
      try {
        if (act === "ping") {
          const r = await this.hwPost("ping", { ip, count: 4 });
          body.innerHTML = this.pingHtml(r);
        } else if (act === "ports") {
          const extra = (this.hw.back.querySelector(".pwn-hw-ports") || {}).value || "";
          const r = await this.hwPost("ports", extra.trim() ? { ip, ports: extra, withCommon: true } : { ip });
          if (r.web) this.hw.web = r.web;
          body.innerHTML = this.portsHtml(r);
        } else if (act === "trace") {
          const r = await this.hwPost("traceroute", { ip });
          body.innerHTML = !r.available ? `<div class="pwn-hw-err">${esc(t("traceMissing"))}</div>`
            : !r.hops.length ? `<div class="pwn-hw-muted">${esc(t("noAnswer"))}</div>`
            : `<table class="pwn-hw-tbl">${r.hops.map((x) => `<tr><td>${x.hop}</td><td>${esc(x.ip || "*")}</td><td>${esc(this.ms(x.ms))}</td></tr>`).join("")}</table>`;
        } else if (act === "names") {
          const r = await this.hwPost("names", { ip });
          const row = (k, v) => `<tr><td>${esc(t(k))}</td><td>${esc(v || "—")}</td></tr>`;
          body.innerHTML = `<table class="pwn-hw-tbl">${row("nameSystem", r.system)}${row("nameDns", r.dns)}${row("nameMdns", r.mdns)}${row("nameNetbios", r.netbios && r.netbios.name)}${r.netbios && r.netbios.workgroup ? row("nameWorkgroup", r.netbios.workgroup) : ""}</table>`;
        } else if (act === "arp") {
          const r = await this.hwPost("arp", { ip });
          body.innerHTML = r.self ? `<div class="pwn-hw-muted">${esc(t("arpSelf"))}</div>`
            : !r.mac ? `<div class="pwn-hw-err">${esc(t("arpNone"))}</div>`
            : `<table class="pwn-hw-tbl"><tr><td>${esc(t("mac"))}</td><td><b>${esc(r.mac)}</b></td></tr><tr><td>OUI</td><td>${esc(r.oui)}</td></tr><tr><td>${esc(t("vendor"))}</td><td>${esc(r.vendor || "—")}</td></tr><tr><td>${esc(t("macKind"))}</td><td>${esc(r.local ? t("macLocal") : t("macGlobal"))}</td></tr><tr><td>${esc(t("arpTime"))}</td><td>${esc(this.ms(r.ms))}</td></tr></table>`;
        } else if (act === "wol") {
          const r = await this.hwPost("wol", { mac: h.mac, ip });
          body.innerHTML = r.ok ? `<div class="pwn-hw-ok">${esc(t("wolSent").replace("{n}", String(r.targets.length)))}</div><div class="pwn-hw-muted">${esc(t("wolHint"))}</div>`
            : `<div class="pwn-hw-err">${esc(t("wolFail"))}</div>`;
        }
      } catch (e) {
        fail(body, e);
      } finally {
        busy(btn, false);
      }
    }

    pingHtml(r) {
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const esc = escapeHtml;
      const line = (s) => t("pingStats").replace("{s}", s.sent).replace("{r}", s.received).replace("{l}", s.loss);
      let html = "";
      const ic = r.icmp;
      if (ic.received) {
        html += `<div class="pwn-hw-ok">${esc(line(ic))}</div>
          <div>${esc(t("rtt"))} : min ${esc(this.ms(ic.min))} · ${esc(t("avg"))} ${esc(this.ms(ic.avg))} · max ${esc(this.ms(ic.max))}${ic.ttl != null ? " · TTL " + ic.ttl : ""}</div>
          <div class="pwn-hw-chips">${ic.times.map((x) => `<span>${esc(this.ms(x))}</span>`).join("")}</div>`;
      } else {
        html += `<div class="pwn-hw-muted">${esc(ic.available ? t("icmpNone") : t("icmpMissing"))}</div>`;
      }
      if (r.tcp) {
        html += r.tcp.received
          ? `<div class="pwn-hw-ok">${esc(t("tcpAlive").replace("{p}", String(r.tcp.port)))} · ${esc(t("avg"))} ${esc(this.ms(r.tcp.avg))}</div>`
          : `<div class="pwn-hw-err">${esc(t("noAnswer"))}</div>`;
      }
      return html;
    }

    portsHtml(r) {
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const esc = escapeHtml;
      const head = `<div>${esc(t("portsSummary").replace("{n}", r.scanned).replace("{o}", r.open.length).replace("{c}", r.closed).replace("{f}", r.filtered))}</div>`;
      if (!r.open.length) return head + `<div class="pwn-hw-muted">${esc(t("portsNone"))}</div>`;
      const rows = r.open.map((p) => {
        const d = [];
        if (p.http) {
          if (p.http.status) d.push("HTTP " + p.http.status);
          if (p.http.server) d.push(p.http.server);
          if (p.http.title) d.push("« " + p.http.title + " »");
          if (p.http.cert && p.http.cert.subject) d.push("🔒 " + p.http.cert.subject + (p.http.cert.issuer ? " (" + p.http.cert.issuer + ")" : ""));
        }
        if (p.banner) d.push(p.banner);
        return `<tr><td><b>${p.port}</b></td><td>${esc(p.service || "")}</td><td>${esc(d.join(" · "))}</td></tr>`;
      }).join("");
      const web = r.web ? `<div><button type="button" class="pwn-hw-mini pwn-hw-openweb">${esc(t("web"))} → ${esc(r.web)}</button></div>` : "";
      setTimeout(() => {
        const b = this.hw && this.hw.back.querySelector(".pwn-hw-openweb");
        if (b) b.addEventListener("pointerup", (e) => { e.preventDefault(); e.stopPropagation(); window.open(r.web, "_blank", "noopener"); });
      }, 0);
      return head + `<table class="pwn-hw-tbl">${rows}</table>` + web;
    }

    /* Surveillance : un ping toutes les 2 s tant que la fenetre est
       ouverte, courbe des 60 derniers temps, alerte apres 3 pertes de
       suite. Monitoring: one ping every 2 s while the window is open,
       chart of the last 60 times, alert after 3 losses in a row. */
    toggleWatch(btn) {
      const hw = this.hw;
      if (!hw) return;
      if (hw.watch) {
        clearTimeout(hw.watch.timer);
        hw.watch = null;
        if (btn) btn.classList.remove("on");
        return;
      }
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const body = this.hwCard("watch", t("watch"));
      hw.watch = { samples: [], misses: 0, sent: 0, lost: 0, timer: null, body };
      if (btn) btn.classList.add("on");
      const step = async () => {
        const w = this.hw && this.hw.watch;
        if (!w) return;
        let ms = null;
        try {
          const r = await this.hwPost("ping", { ip: this.hw.host.ip, count: 1 });
          ms = r.icmp && r.icmp.received ? r.icmp.avg : (r.tcp && r.tcp.received ? r.tcp.avg : null);
        } catch (e) { ms = null; }
        if (!this.hw || this.hw.watch !== w) return;
        w.sent++;
        if (ms == null) { w.lost++; w.misses++; } else w.misses = 0;
        w.samples.push(ms);
        if (w.samples.length > 60) w.samples.shift();
        this.renderWatch(w);
        w.timer = setTimeout(step, 2000);
      };
      this.renderWatch(hw.watch);
      step();
    }

    renderWatch(w) {
      const t = (k) => this.ctx.i18n.t("netscan.hw." + k);
      const esc = escapeHtml;
      const vals = w.samples.filter((v) => v != null);
      const max = Math.max(1, ...vals);
      const W = 300, H = 60, n = Math.max(2, w.samples.length);
      const pts = w.samples.map((v, i) => v == null ? null : [Math.round(i * (W / (n - 1))), Math.round(H - 4 - (v / max) * (H - 10))]);
      const path = pts.filter(Boolean).map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
      const losses = w.samples.map((v, i) => v == null ? `<line x1="${Math.round(i * (W / (n - 1)))}" x2="${Math.round(i * (W / (n - 1)))}" y1="0" y2="${H}" class="loss"/>` : "").join("");
      const last = w.samples.length ? w.samples[w.samples.length - 1] : null;
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const down = w.misses >= 3;
      w.body.innerHTML = `
        ${down ? `<div class="pwn-hw-alert">⚠ ${esc(t("watchDown").replace("{n}", String(w.misses)))}</div>` : ""}
        <svg class="pwn-hw-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${losses}<path d="${path}"/></svg>
        <div>${esc(t("watchLast"))} ${esc(this.ms(last))} · ${esc(t("avg"))} ${esc(this.ms(avg))} · max ${esc(this.ms(vals.length ? max : null))} · ${esc(t("watchLoss").replace("{l}", String(w.sent ? Math.round(w.lost / w.sent * 100) : 0)))}</div>
        <div class="pwn-hw-muted">${esc(t("watchHint"))}</div>`;
      const card = w.body.closest(".pwn-hw-card");
      if (card) card.classList.toggle("down", down);
    }

    destroy() {
      this.closeHost();
      clearInterval(this.timer);
      clearTimeout(this.noteTimer);
      clearTimeout(this.confirmTimer);
    }
  }

  window.PiBoard.registerWidget("networkscan", NetworkScanWidget);
})();
