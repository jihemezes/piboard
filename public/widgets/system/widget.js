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
  /* Environ une demi-heure au rythme par defaut (5 s), et une borne dure
     contre l'accumulation sur un tableau laisse allume des jours.
     Roughly half an hour at the default pace (5 s), and a hard cap
     against accumulation on a board left running for days. */
  const MAX_POINTS = 360;

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

    row(label, value, pct, key) {
      return `
        <div class="pws-row${key ? " pws-clickable" : ""}"${key ? ` data-metric="${key}" role="button" tabindex="0" title="${esc(this.ctx.i18n.t("system.chartOpen"))}"` : ""}>
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
            ${this.row(i18n.t("system.cpu"), d.cpuPercent.toFixed(0) + "%", d.cpuPercent, "cpu")}
            ${this.row(i18n.t("system.ram"), d.memUsedGB + " / " + d.memTotalGB + " GB", d.memPercent, "mem")}
            ${d.diskPercent != null ? this.row(i18n.t("system.disk"), d.diskUsedGB + " / " + d.diskTotalGB + " GB", d.diskPercent, "disk") : ""}
            ${tempRow}
            ${this.netRows()}
          </div>`;

        this.wireNetwork();
        this.record(d);
        this.wireMetrics();
        // La fenetre ouverte se met a jour au meme rythme que la tuile :
        // c'est ce qui rend les graphiques "dynamiques" sans minuteur
        // supplementaire.
        // An open window updates at the tile's own pace: that is what
        // makes the charts "live" without an extra timer.
        if (this.chart) this.drawChart();
      } catch (e) {
        console.warn("[piboard/system]", e);
        el.innerHTML = `<div class="pw-system"><div class="pws-err">${i18n.t("system.error")}</div></div>`;
      }
    }

    /* ---------- Historique / history ----------

       L'historique est tenu COTE CLIENT, alimente par les releves que la
       tuile fait deja. Deux raisons de ne pas le faire cote serveur :
       il faudrait echantillonner en permanence meme quand personne ne
       regarde, et il faudrait le stocker quelque part. Ici le cout est
       nul -- on conserve ce qui passe deja.

       Contrepartie assumee : l'historique repart de zero au rechargement
       de la page. C'est acceptable pour une lecture d'ambiance, et la
       fenetre le dit plutot que de laisser croire a un historique long.

       History is kept CLIENT-SIDE, fed by the readings the tile already
       takes. Two reasons not to do it server-side: it would require
       sampling continuously even when nobody is looking, and it would
       have to be stored somewhere. Here the cost is nil -- we keep what
       already goes by.

       Accepted trade-off: history restarts from scratch when the page
       reloads. That is fine for an at-a-glance reading, and the window
       says so rather than implying a long history. */
    record(d) {
      if (!this.history) this.history = { cpu: [], mem: [], disk: [] };
      const push = (k, v) => {
        if (v == null || !Number.isFinite(Number(v))) return;
        const a = this.history[k];
        a.push(Number(v));
        // Borne dure : sans elle, une tuile laissee des jours sur un
        // tableau mural accumulerait indefiniment.
        // Hard cap: without it, a tile left for days on a wall board
        // would accumulate indefinitely.
        if (a.length > MAX_POINTS) a.shift();
      };
      push("cpu", d.cpuPercent);
      push("mem", d.memPercent);
      push("disk", d.diskPercent);
      this.lastSample = d;
    }

    wireMetrics() {
      this.ctx.el.querySelectorAll("[data-metric]").forEach((el) => {
        el.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.openChart(el.dataset.metric);
        });
      });
    }

    openChart(metric) {
      const i18n = this.ctx.i18n;
      if (this.chartModal) this.chartModal.remove();
      this.chart = metric;

      const tabs = [["cpu", "system.cpu"], ["mem", "system.ram"], ["disk", "system.disk"]]
        .filter(([k]) => k !== "disk" || (this.history && this.history.disk.length));

      const m = document.createElement("div");
      m.className = "modal modal-stacked";
      m.innerHTML = `
        <div class="modal-card pwg-modal">
          <header class="modal-head">
            <h2>${esc(i18n.t("system.chartTitle"))}</h2>
            <button class="modal-close" data-x aria-label="Close">&times;</button>
          </header>
          <div class="pwg-body">
            <div class="pwg-tabs">${tabs.map(([k, lbl]) =>
              `<button class="pwg-tab${k === metric ? " active" : ""}" data-t="${k}">${esc(i18n.t(lbl))}</button>`).join("")}</div>
            <div class="pwg-now"><span class="pwg-now-val"></span><span class="pwg-now-lbl"></span></div>
            <svg class="pwg-chart" viewBox="0 0 600 200" preserveAspectRatio="none">
              <g class="pwg-grid"></g>
              <path class="pwg-area" fill="var(--accent)" fill-opacity="0.12"></path>
              <path class="pwg-line" fill="none" stroke="var(--accent)" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round"></path>
            </svg>
            <div class="pwg-hint">${esc(i18n.t("system.chartHint"))}</div>
          </div>
        </div>`;
      document.body.appendChild(m);
      this.chartModal = m;

      m.querySelector("[data-x]").addEventListener("pointerup", (e) => {
        e.preventDefault();
        m.remove();
        this.chartModal = null;
        this.chart = null;
      });
      m.querySelectorAll(".pwg-tab").forEach((b) => {
        b.addEventListener("pointerup", (e) => {
          e.preventDefault();
          m.querySelectorAll(".pwg-tab").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          this.chart = b.dataset.t;
          this.drawChart();
        });
      });

      this.drawChart();
    }

    drawChart() {
      const m = this.chartModal;
      if (!m || !this.chart) return;
      const i18n = this.ctx.i18n;
      const series = (this.history && this.history[this.chart]) || [];
      const W = 600, H = 200, PAD = 8;

      const now = series.length ? series[series.length - 1] : null;
      m.querySelector(".pwg-now-val").textContent = now == null ? "—" : now.toFixed(0) + " %";
      m.querySelector(".pwg-now-lbl").textContent =
        i18n.t(this.chart === "cpu" ? "system.cpu" : this.chart === "mem" ? "system.ram" : "system.disk");

      // Echelle FIXE de 0 a 100. Une echelle automatique ferait paraitre
      // dramatique une variation de 2 % en zoomant dessus : sur un
      // pourcentage, l'echelle absolue est la seule honnete.
      // FIXED 0-100 scale. An auto scale would make a 2% wobble look
      // dramatic by zooming into it: on a percentage, the absolute scale
      // is the only honest one.
      const y = (v) => PAD + (H - 2 * PAD) * (1 - Math.max(0, Math.min(100, v)) / 100);

      m.querySelector(".pwg-grid").innerHTML = [0, 25, 50, 75, 100].map((v) =>
        `<line x1="0" y1="${y(v).toFixed(1)}" x2="${W}" y2="${y(v).toFixed(1)}"
               stroke="var(--tile-edge)" stroke-width="1"/>
         <text x="4" y="${(y(v) - 3).toFixed(1)}" fill="var(--muted)" font-size="10">${v}</text>`).join("");

      // Un seul point ne trace pas une ligne : on attend d'en avoir deux
      // plutot que d'afficher un chemin vide.
      // A single point does not draw a line: we wait until there are two
      // rather than showing an empty path.
      if (series.length < 2) {
        m.querySelector(".pwg-line").setAttribute("d", "");
        m.querySelector(".pwg-area").setAttribute("d", "");
        return;
      }

      const step = W / (series.length - 1);
      const pts = series.map((v, i) => `${(i * step).toFixed(1)} ${y(v).toFixed(1)}`);
      const line = "M" + pts.join(" L");
      m.querySelector(".pwg-line").setAttribute("d", line);
      m.querySelector(".pwg-area").setAttribute("d",
        line + ` L${W} ${H - PAD} L0 ${H - PAD} Z`);
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
      if (this.chartModal) this.chartModal.remove();
    }
  }

  window.PiBoard.registerWidget("system", SystemWidget);
})();
