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

  /* ---------- Couleurs par niveau / level colors ----------
     Trois etats, trois couleurs, deux seuils -- tous reglables. Le rouge
     n'est utilise QUE pour l'etat critique : l'ancienne version peignait
     l'usage normal avec la couleur d'accent du theme (un rouge
     framboise), ce qui faisait passer un Pi au repos pour une machine en
     surchauffe. Three states, three colors, two thresholds -- all
     adjustable. Red is used ONLY for the critical state: the previous
     version painted normal usage with the theme's accent color (a
     raspberry red), which made an idle Pi look like an overheating
     machine. */
  const DEFAULTS = {
    thresholdWarn: 65, thresholdCrit: 85,
    colorNormal: "#3FA96B", colorWarn: "#E0A63C", colorCrit: "#E0556F",
    chartColor: "#5B8DEF"
  };

  function hexColor(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v) : fallback;
  }

  function levels(settings) {
    const s = settings || {};
    let warn = Number(s.thresholdWarn);
    let crit = Number(s.thresholdCrit);
    if (!Number.isFinite(warn)) warn = DEFAULTS.thresholdWarn;
    if (!Number.isFinite(crit)) crit = DEFAULTS.thresholdCrit;
    // Un seuil critique en dessous du seuil eleve n'a pas de sens : on
    // aligne plutot que d'ignorer l'un des deux en silence.
    // A critical threshold below the high one is meaningless: align
    // rather than silently ignore one of the two.
    if (crit < warn) crit = warn;
    return {
      warn, crit,
      normal: hexColor(s.colorNormal, DEFAULTS.colorNormal),
      high: hexColor(s.colorWarn, DEFAULTS.colorWarn),
      critical: hexColor(s.colorCrit, DEFAULTS.colorCrit),
      chart: hexColor(s.chartColor, DEFAULTS.chartColor),
      chartByLevel: !!s.chartByLevel
    };
  }

  function levelColor(pct, lv) {
    if (pct >= lv.crit) return lv.critical;
    if (pct >= lv.warn) return lv.high;
    return lv.normal;
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
      await this.loadPublicIp();
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const seconds = Math.max(2, Number(this.ctx.settings.refreshSeconds) || 5);
      this.timer = setInterval(() => this.refresh(), seconds * 1000);
    }

    onSettingsChanged(settings) {
      const wanted = !!settings.showPublicIp;
      this.ctx.settings = settings;
      // L'IP publique n'est demandee que si l'option vient d'etre cochee :
      // la charger sans raison solliciterait un service externe pour rien.
      // The public IP is only fetched when the option was just enabled:
      // loading it for no reason would hit an external service needlessly.
      (wanted && !this.publicIp ? this.loadPublicIp() : Promise.resolve()).then(() => this.refresh());
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    row(label, value, pct, key) {
      return `
        <div class="pws-row${key ? " pws-clickable" : ""}"${key ? ` data-metric="${key}" role="button" tabindex="0" title="${esc(this.ctx.i18n.t("system.chartOpen"))}"` : ""}>
          <div class="pws-row-head"><span>${label}</span><span class="pws-val">${value}</span></div>
          <div class="pws-bar"><div class="pws-bar-fill" style="width:${Math.max(2, Math.min(100, pct))}%;background:${levelColor(pct, levels(this.ctx.settings))}"></div></div>
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

        /* GPU : la ligne n'apparait que si la machine expose reellement
           sa charge (d.gpu non nul). Sur un Raspberry Pi, elle reste
           masquee -- afficher "GPU 0 %" laisserait croire a un GPU au
           repos alors qu'on ne mesure rien du tout.
           GPU: the row only appears if the machine actually exposes its
           load (d.gpu non-null). On a Raspberry Pi it stays hidden --
           showing "GPU 0%" would suggest an idle GPU when we are
           measuring nothing at all. */
        const gpu = d.gpu && Number.isFinite(d.gpu.percent) ? d.gpu : null;
        const showGpu = gpu && s.showGpu !== false;
        // La courbe est optionnelle : sans elle, la barre reste affichee
        // mais n'est plus cliquable. The chart is optional: without it,
        // the bar stays shown but is no longer clickable.
        const gpuChart = showGpu && s.gpuChart !== false;
        const gpuLabel = i18n.t("system.gpu") + (gpu && gpu.tempC != null ? ` ${gpu.tempC.toFixed(0)}°C` : "");

        const tempRow = d.tempC != null
          ? `<div class="pws-row-head"><span>${i18n.t("system.temp")}</span><span class="pws-val">${d.tempC.toFixed(1)}°C</span></div>`
          : "";

        el.innerHTML = `
          <div class="pw-system">
            ${head}
            ${this.row(i18n.t("system.cpu"), d.cpuPercent.toFixed(0) + "%", d.cpuPercent, "cpu")}
            ${this.row(i18n.t("system.ram"), d.memUsedGB + " / " + d.memTotalGB + " GB", d.memPercent, "mem")}
            ${showGpu ? this.row(gpuLabel, gpu.percent.toFixed(0) + "%", gpu.percent, gpuChart ? "gpu" : null) : ""}
            ${d.diskPercent != null ? this.row(i18n.t("system.disk"), d.diskUsedGB + " / " + d.diskTotalGB + " GB", d.diskPercent, "disk") : ""}
            ${tempRow}
            ${this.netRows()}
          </div>`;

        if (s.showPublicIp && (!this.publicIpAt || Date.now() - this.publicIpAt > 10 * 60 * 1000)) {
          this.loadPublicIp().then(() => { if (this.ctx.el.isConnected) this.refresh(); });
        }
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
      if (!this.history) this.history = { cpu: [], mem: [], disk: [], gpu: [], t: [] };
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
      push("gpu", d.gpu ? d.gpu.percent : null);
      /* Instant du releve, pour l'axe des abscisses. L'historique client
         (celui qui sert avant que l'historique serveur soit charge) n'en
         gardait aucun : la courbe ne disait pas de quand elle datait.
         Il est indexe sur la serie CPU, la seule toujours presente.
         Reading time, for the X axis. The client history (the one used
         before the server history is loaded) kept none: the curve did
         not say when it dated from. It is indexed on the CPU series, the
         only one always present. */
      this.history.t.push(Date.now());
      if (this.history.t.length > MAX_POINTS) this.history.t.shift();
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

      // Un onglet n'apparait que s'il a de quoi tracer : pas de disque
       // mesurable, pas d'onglet Disque ; GPU non expose ou courbe
       // desactivee dans les reglages, pas d'onglet GPU.
       // A tab only appears when it has something to draw: no measurable
       // disk, no Disk tab; GPU not exposed or chart disabled in the
       // settings, no GPU tab.
      const has = (k) => this.history && this.history[k] && this.history[k].length;
      const tabs = [["cpu", "system.cpu"], ["gpu", "system.gpu"], ["mem", "system.ram"], ["disk", "system.disk"]]
        .filter(([k]) => {
          if (k === "disk") return has("disk");
          if (k === "gpu") return has("gpu") && this.ctx.settings.gpuChart !== false;
          return true;
        });

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
              <path class="pwg-area" fill-opacity="0.14"></path>
              <path class="pwg-line" fill="none" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round"></path>
            </svg>
            <div class="pb-taxis pwg-taxis"></div>
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

      // La fenetre s'ouvre immediatement avec ce qu'on a deja, puis
      // s'enrichit de l'historique serveur.
      // The window opens right away with what we already have, then fills
      // in from the server history.
      this.drawChart();
      this.loadHistory().then(() => this.drawChart());
    }

    /* L'historique serveur est charge a l'OUVERTURE de la fenetre
       seulement : c'est le seul moment ou il sert, et le recharger a
       chaque cycle de la tuile serait du trafic pur.
       The server history is loaded when the window OPENS only: that is
       the only moment it is needed, and re-fetching it on every tile
       cycle would be pure traffic. */
    async loadHistory() {
      try {
        const r = await fetch("/api/system/history?minutes=" +
          encodeURIComponent(Math.max(5, Number(this.ctx.settings.historyMinutes) || 120)));
        if (!r.ok) throw new Error("status " + r.status);
        const pts = (await r.json()).points || [];
        if (!pts.length) return;
        this.history = {
          cpu: pts.map((p) => p.c),
          mem: pts.map((p) => p.m),
          // Une machine sans donnee disque renvoie null : les ecarter
          // evite un trou dans la courbe.
          // A machine with no disk reading returns null: dropping those
          // avoids a gap in the curve.
          disk: pts.filter((p) => p.d != null).map((p) => p.d),
          // Les points enregistres avant la version qui a introduit le
          // GPU n'ont pas de champ "g" : les ecarter fait commencer la
          // courbe a la mise a jour plutot que de la faire plonger a
          // zero sur tout le passe.
          // Points recorded before the version that introduced the GPU
          // have no "g" field: dropping them starts the curve at the
          // update rather than dragging it to zero across all the past.
          gpu: pts.filter((p) => p.g != null).map((p) => p.g),
          t: pts.map((p) => p.t),
          // Les series filtrees (disque, GPU) n'ont pas le meme nombre de
          // points que "t" : leurs instants sont donc conserves a part,
          // sans quoi l'axe serait decale pour ces deux onglets.
          // The filtered series (disk, GPU) do not hold the same number
          // of points as "t": their times are therefore kept separately,
          // otherwise the axis would be offset for those two tabs.
          tDisk: pts.filter((p) => p.d != null).map((p) => p.t),
          tGpu: pts.filter((p) => p.g != null).map((p) => p.t)
        };
      } catch (e) {
        // Repli silencieux sur l'historique client : la fenetre reste
        // utile, simplement plus courte.
        // Silent fallback to the client history: the window stays useful,
        // merely shorter.
        console.warn("[piboard/system] historique serveur", e);
      }
    }

    drawChart() {
      const m = this.chartModal;
      if (!m || !this.chart) return;
      const i18n = this.ctx.i18n;
      const series = (this.history && this.history[this.chart]) || [];
      const W = 600, H = 200, PAD = 8;

      const now = series.length ? series[series.length - 1] : null;
      // Couleur de la courbe : celle du reglage, ou celle du niveau du
      // dernier releve si l'utilisateur l'a demande. Le chiffre courant
      // prend toujours la couleur de son niveau -- c'est un signal utile
      // meme quand la courbe reste d'une couleur neutre.
      // Curve color: the setting's, or the latest reading's level color
      // when the user asked for it. The current figure always takes its
      // level color -- a useful signal even when the curve stays neutral.
      const lv = levels(this.ctx.settings);
      const color = lv.chartByLevel && now != null ? levelColor(now, lv) : lv.chart;
      m.querySelector(".pwg-line").setAttribute("stroke", color);
      m.querySelector(".pwg-area").setAttribute("fill", color);
      const nowEl = m.querySelector(".pwg-now-val");
      nowEl.textContent = now == null ? "—" : now.toFixed(0) + " %";
      nowEl.style.color = now == null ? "" : levelColor(now, lv);
      m.querySelector(".pwg-now-lbl").textContent =
        i18n.t(this.chart === "cpu" ? "system.cpu"
          : this.chart === "gpu" ? "system.gpu"
          : this.chart === "mem" ? "system.ram" : "system.disk");

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
        const emptyAxis = m.querySelector(".pwg-taxis");
        if (emptyAxis) emptyAxis.innerHTML = "";
        return;
      }

      /* Axe des abscisses. Chaque onglet a ses propres instants quand sa
         serie est filtree (disque et GPU peuvent avoir moins de points
         que le CPU) ; sinon on retombe sur la serie commune.
         X axis. Each tab has its own times when its series is filtered
         (disk and GPU may hold fewer points than the CPU); otherwise we
         fall back on the common series. */
      const axis = window.PiBoardTimeAxis;
      const axisEl = m.querySelector(".pwg-taxis");
      const times = (this.chart === "disk" && this.history.tDisk)
        || (this.chart === "gpu" && this.history.tGpu)
        || this.history.t || [];
      if (axis && axisEl && times.length >= series.length && series.length > 1) {
        const t0 = times[times.length - series.length];
        const t1 = times[times.length - 1];
        const ticks = axis.timeTicks(t0, t1, { locale: i18n.lang === "en" ? "en-GB" : "fr-FR", maxTicks: 5 });
        m.querySelector(".pwg-grid").innerHTML += axis.gridLines(ticks, 0, W, PAD, H - PAD);
        axisEl.innerHTML = axis.axisHtml(ticks, 0, 0);
      } else if (axisEl) {
        axisEl.innerHTML = "";
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
      const i18n = this.ctx.i18n;
      const rows = [];
      if (this.ctx.settings.showNetwork !== false) {
        const nets = this.net && this.net.adapters ? this.net.adapters : [];
        for (const a of nets) rows.push(`
        <div class="pws-net" data-net="1" role="button" tabindex="0"
             title="${esc(i18n.t("system.netDetails"))}">
          <span class="pws-net-name">${esc(a.name)}</span>
          <span class="pws-net-ip">${esc(a.ipv4)}</span>
        </div>`);
      }
      if (this.ctx.settings.showPublicIp) {
        const p = this.publicIp;
        const value = p && p.ip ? esc(p.ip) : `<span class="pws-net-na">${esc(i18n.t("system.netUnknown"))}</span>`;
        rows.push(`
        <div class="pws-net pws-net-public${p && p.stale ? " pws-stale" : ""}" data-net="1" role="button" tabindex="0"
             title="${esc(p && p.stale ? i18n.t("system.publicIpStale") : i18n.t("system.netDetails"))}">
          <span class="pws-net-name">${esc(i18n.t("system.publicIp"))}</span>
          <span class="pws-net-ip">${value}</span>
        </div>`);
      }
      return rows.join("");
    }

    /* Chargee a l'affichage puis rafraichie a la meme cadence que le
       cache serveur (dix minutes) : le serveur ne reinterroge Internet
       que si son cache a expire, la tuile ne fait que relire.
       Loaded on display then refreshed at the server cache's own pace
       (ten minutes): the server only re-queries the Internet if its
       cache expired, the tile merely re-reads. */
    async loadPublicIp() {
      if (!this.ctx.settings.showPublicIp) return;
      try {
        const r = await fetch("/api/public-ip");
        if (!r.ok) throw new Error("status " + r.status);
        this.publicIp = await r.json();
      } catch (e) {
        console.warn("[piboard/system] ip publique", e);
        this.publicIp = this.publicIp || { ip: null, error: String(e.message || e) };
      }
      this.publicIpAt = Date.now();
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
              ${this.ctx.settings.showPublicIp ? `<span class="pwn-public"><span>${esc(i18n.t("system.publicIp"))}</span> <b>${this.publicIp && this.publicIp.ip ? esc(this.publicIp.ip) : na}</b>${this.publicIp && this.publicIp.stale ? ` <span class="pwn-stale">${esc(i18n.t("system.publicIpStale"))}</span>` : ""}</span>` : ""}
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

  // Exposes pour les tests (fonctions pures, sans DOM) / exposed for tests
  // (pure functions, no DOM)
  SystemWidget.levels = levels;
  SystemWidget.levelColor = levelColor;
  SystemWidget.DEFAULTS = DEFAULTS;

  window.PiBoard.registerWidget("system", SystemWidget);
})();
