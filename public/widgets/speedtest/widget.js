/* PiBoard widget: speedtest / sante Internet

   La tuile ne MESURE rien elle-meme : elle lit ce que le serveur a deja
   releve (voir server/internetHealth.js). C'est deliberé et c'est tout
   l'interet de la tuile -- une mesure faite par le navigateur
   disparaitrait a chaque rechargement de page, alors que ce que l'on
   veut retrouver, c'est justement la coupure de 4 h du matin.

   Consequence visible : le "rafraichissement" reglable ci-dessous ne
   change QUE la frequence de relecture. Le rythme de mesure, lui, se
   regle dans la section "Mesure de la latence".

   The tile MEASURES nothing itself: it reads what the server has
   already recorded (see server/internetHealth.js). That is deliberate
   and is the whole point of the tile -- a reading taken by the browser
   would vanish on every page reload, whereas what one wants to find
   again is precisely the 4am outage.

   Visible consequence: the adjustable "refresh" below only changes the
   re-read frequency. The measurement pace is set in the "Latency
   measurement" section. */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Un debit se lit en Mb/s au-dessus de 10, avec une decimale en
     dessous : "0 Mb/s" sur une ligne a 800 kb/s serait faux et
     inquietant, "0,8" est juste.
     Throughput reads in Mb/s above 10, with one decimal below: "0 Mb/s"
     on an 800 kb/s line would be wrong and alarming, "0.8" is right. */
  function fmtMbps(v, locale) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    return n.toLocaleString(locale, {
      minimumFractionDigits: n < 10 ? 1 : 0,
      maximumFractionDigits: n < 10 ? 1 : 0
    });
  }

  function fmtMs(v, locale) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    return n.toLocaleString(locale, {
      minimumFractionDigits: n < 10 ? 1 : 0,
      maximumFractionDigits: n < 10 ? 1 : 0
    });
  }

  function fmtPct(v, locale) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    return Number(v).toLocaleString(locale, { maximumFractionDigits: 1 });
  }

  /* "il y a 2 min". Un horodatage absolu obligerait a faire la
     soustraction mentalement pour repondre a la seule question qui
     compte : est-ce que ce chiffre est encore d'actualite ?
     "2 min ago". An absolute timestamp would force one to do the
     subtraction mentally to answer the only question that matters: is
     this figure still current? */
  function fmtAge(ts, i18n) {
    if (!ts) return "";
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 90) return i18n.t("speed.ageSeconds").replace("{n}", sec);
    const min = Math.round(sec / 60);
    if (min < 90) return i18n.t("speed.ageMinutes").replace("{n}", min);
    return i18n.t("speed.ageHours").replace("{n}", Math.round(min / 60));
  }

  const RANGES = [1, 6, 24, 72];

  class SpeedtestWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.range = null;
      this.metric = "l";
    }

    get locale() { return this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-GB"; }

    async init() {
      this.ctx.el.innerHTML =
        `<div class="pw-speed"><div class="pwsp-msg">${esc(this.ctx.i18n.t("common.loading"))}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const seconds = Math.max(10, Number(this.ctx.settings.refreshSeconds) || 30);
      this.timer = setInterval(() => this.refresh(), seconds * 1000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    destroy() {
      clearInterval(this.timer);
      if (this.modal) this.modal.remove();
      this.modal = null;
    }

    /* ---------- Tuile / tile ---------- */

    async refresh() {
      const i18n = this.ctx.i18n;
      try {
        const [cur, hist] = await Promise.all([
          fetch("/api/internet-health").then((r) => {
            if (!r.ok) throw new Error("status " + r.status);
            return r.json();
          }),
          this.ctx.settings.showSparkline === false
            ? Promise.resolve(null)
            : this.fetchHistory(this.chartHours(), 160).catch(() => null)
        ]);
        this.current = cur;
        this.spark = hist;
        this.render();
      } catch (e) {
        console.warn("[piboard/speedtest]", e);
        this.ctx.el.innerHTML =
          `<div class="pw-speed"><div class="pwsp-msg">${esc(i18n.t("speed.error"))}</div></div>`;
      }
      // La fenetre ouverte suit le meme rythme que la tuile : c'est ce
      // qui rend la courbe vivante sans second minuteur.
      // An open window follows the tile's own pace: that is what keeps
      // the curve alive without a second timer.
      if (this.modal) this.loadChart();
    }

    chartHours() {
      return Math.max(1, Math.min(72, Number(this.ctx.settings.chartHours) || 24));
    }

    fetchHistory(hours, points) {
      return fetch(`/api/internet-health/history?hours=${encodeURIComponent(hours)}&points=${encodeURIComponent(points)}`)
        .then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });
    }

    render() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const d = this.current || {};

      // Aucune mesure encore enregistree : ce n'est PAS une erreur, la
      // premiere arrive dans la minute. Le dire evite qu'on aille
      // chercher un probleme qui n'existe pas.
      // No reading recorded yet: this is NOT an error, the first one
      // lands within the minute. Saying so avoids hunting for a problem
      // that does not exist.
      /* Le serveur ne trouve aucune tuile "Sante Internet" dans la
         disposition enregistree : il ne mesure donc rien, et attendre
         n'y changerait rien. Ce cas est distingue du premier releve
         parce que les deux se ressemblent a l'ecran mais n'ont RIEN a
         voir -- l'un se resout tout seul en une minute, l'autre jamais.
         Les confondre, c'est regarder un message d'attente pendant des
         heures en croyant que tout va bien.
         The server finds no "Internet health" tile in the saved layout:
         it is therefore measuring nothing, and waiting will change
         nothing. This case is told apart from the first reading because
         the two look alike on screen but have NOTHING in common -- one
         resolves by itself within a minute, the other never. Confusing
         them means staring at a waiting message for hours believing all
         is well. */
      if (d.enabled === false) {
        this.ctx.el.innerHTML =
          `<div class="pw-speed"><div class="pwsp-msg">${esc(i18n.t("speed.notSeen"))}</div></div>`;
        return;
      }

      if (!d.sample) {
        this.ctx.el.innerHTML =
          `<div class="pw-speed"><div class="pwsp-msg">${esc(i18n.t("speed.warmup"))}</div></div>`;
        return;
      }

      const sm = d.sample;
      const status = d.status || "unknown";
      const lat = fmtMs(sm.latencyMs, this.locale);

      const metrics = [];
      const jit = fmtMs(sm.jitterMs, this.locale);
      if (jit != null) metrics.push([i18n.t("speed.jitter"), jit + " ms"]);
      const loss = fmtPct(sm.lossPct, this.locale);
      if (loss != null) metrics.push([i18n.t("speed.loss"), loss + " %"]);

      if (s.showThroughput !== false && d.lastThroughput) {
        const down = fmtMbps(d.lastThroughput.downloadMbps, this.locale);
        if (down != null) metrics.push(["↓", down + " " + i18n.t("speed.mbps")]);
        const up = fmtMbps(d.lastThroughput.uploadMbps, this.locale);
        if (up != null) metrics.push(["↑", up + " " + i18n.t("speed.mbps")]);
      }

      const availability = this.spark && this.spark.stats && this.spark.stats.availability;
      const foot = availability == null ? "" : `
        <div class="pwsp-foot">${esc(i18n.t("speed.availability")
          .replace("{pct}", fmtPct(availability, this.locale))
          .replace("{h}", String(this.chartHours())))}</div>`;

      this.ctx.el.innerHTML = `
        <div class="pw-speed" role="button" tabindex="0" title="${esc(i18n.t("speed.openDetails"))}">
          <div class="pwsp-top">
            <span class="pwsp-dot pwsp-${esc(status)}"></span>
            <span class="pwsp-status">${esc(i18n.t("speed.status." + status))}</span>
            <span class="pwsp-age">${esc(fmtAge(sm.t, i18n))}</span>
          </div>
          <div class="pwsp-main">
            ${lat == null
              ? `<span class="pwsp-big pwsp-off">${esc(i18n.t("speed.noAnswer"))}</span>`
              : `<span class="pwsp-big">${esc(lat)}</span><span class="pwsp-unit">ms</span>`}
          </div>
          ${metrics.length ? `<div class="pwsp-metrics">${metrics.map(([k, v]) =>
            `<div class="pwsp-metric"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
          ${s.showSparkline === false ? "" : `<svg class="pwsp-spark" viewBox="0 0 300 48" preserveAspectRatio="none">
            <g class="pwsp-spark-out"></g>
            <path class="pwsp-spark-line" fill="none" stroke="var(--accent)" stroke-width="1.6"
                  stroke-linejoin="round" stroke-linecap="round"></path>
          </svg>`}
          ${foot}
        </div>`;

      this.drawSpark();
      const root = this.ctx.el.querySelector(".pw-speed");
      if (root) {
        root.addEventListener("pointerup", (e) => { e.preventDefault(); this.openDetails(); });
      }
    }

    /* Mini-courbe de la tuile. Volontairement sans axes ni graduations :
       a cette taille, elle repond a "est-ce que ca a bouge ?", pas a
       "de combien exactement ?" -- ca, c'est le role de la fenetre.
       Tile sparkline. Deliberately without axes or gridlines: at this
       size it answers "did it move?", not "by exactly how much?" --
       that is the window's job. */
    drawSpark() {
      const svg = this.ctx.el.querySelector(".pwsp-spark");
      if (!svg || !this.spark) return;
      const pts = this.spark.points || [];
      if (pts.length < 2) return;
      const W = 300, H = 48, PAD = 3;

      const vals = pts.map((p) => p.l).filter((v) => Number.isFinite(v));
      if (!vals.length) return;
      const max = Math.max(...vals, 1);
      const y = (v) => PAD + (H - 2 * PAD) * (1 - Math.min(v, max) / max);
      const x = (i) => (i / (pts.length - 1)) * W;

      // Les coupures ROMPENT le trait au lieu d'etre reliees : une ligne
      // qui traverse une coupure laisserait croire a une degradation
      // progressive, alors qu'il n'y avait rien du tout.
      // Outages BREAK the stroke instead of being bridged: a line
      // crossing an outage would suggest a gradual degradation, when
      // there was nothing at all.
      let d = "";
      let pen = false;
      const outages = [];
      pts.forEach((p, i) => {
        if (!Number.isFinite(p.l)) {
          pen = false;
          outages.push(x(i));
          return;
        }
        d += (pen ? " L" : " M") + x(i).toFixed(1) + " " + y(p.l).toFixed(1);
        pen = true;
      });
      svg.querySelector(".pwsp-spark-line").setAttribute("d", d.trim());
      svg.querySelector(".pwsp-spark-out").innerHTML = outages.map((px) =>
        `<rect x="${(px - 0.8).toFixed(1)}" y="0" width="1.6" height="${H}" fill="var(--pwsp-down)" opacity="0.55"/>`
      ).join("");
    }

    /* ---------- Fenetre de detail / detail window ---------- */

    openDetails() {
      const i18n = this.ctx.i18n;
      if (this.modal) this.modal.remove();
      if (this.range == null) this.range = this.chartHours();

      const m = document.createElement("div");
      m.className = "modal modal-stacked";
      m.innerHTML = `
        <div class="modal-card pwih-modal">
          <header class="modal-head">
            <h2>${esc(i18n.t("speed.detailTitle"))}</h2>
            <button class="modal-close" data-x aria-label="Close">&times;</button>
          </header>
          <div class="pwih-body">
            <div class="pwih-bars">
              <div class="pwih-chips" data-role="ranges">${RANGES.map((h) =>
                `<button class="pwih-chip${h === this.range ? " active" : ""}" data-range="${h}">${h} h</button>`).join("")}</div>
              <div class="pwih-chips" data-role="metrics">${[
                ["l", "speed.latency"], ["j", "speed.jitter"], ["p", "speed.loss"], ["d", "speed.download"]
              ].map(([k, lbl]) =>
                `<button class="pwih-chip${k === this.metric ? " active" : ""}" data-metric="${k}">${esc(i18n.t(lbl))}</button>`).join("")}</div>
            </div>

            <div class="pwih-now"><span class="pwih-now-val">—</span><span class="pwih-now-lbl"></span></div>

            <svg class="pwih-chart" viewBox="0 0 640 220" preserveAspectRatio="none">
              <g class="pwih-grid"></g>
              <g class="pwih-out"></g>
              <path class="pwih-area" fill="var(--accent)" fill-opacity="0.10"></path>
              <path class="pwih-line" fill="none" stroke="var(--accent)" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round"></path>
            </svg>
            <div class="pb-taxis pwih-taxis"></div>

            <dl class="pwih-stats"></dl>

            <div class="pwih-actions">
              <button class="btn small" data-act="run">${esc(i18n.t("speed.runNow"))}</button>
              <button class="btn small" data-act="download">${esc(i18n.t("speed.downloadCsv"))}</button>
              <button class="btn small" data-act="archive">${esc(i18n.t("speed.archiveCsv"))}</button>
            </div>
            <div class="pwih-note" data-role="note"></div>
            <div class="pwih-archives" data-role="archives"></div>
            <div class="pwih-hint">${esc(i18n.t("speed.detailHint"))}</div>
          </div>
        </div>`;
      document.body.appendChild(m);
      this.modal = m;

      m.querySelector("[data-x]").addEventListener("pointerup", (e) => {
        e.preventDefault();
        m.remove();
        this.modal = null;
      });

      m.querySelectorAll("[data-range]").forEach((b) => {
        b.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.range = Number(b.dataset.range);
          m.querySelectorAll("[data-range]").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          this.loadChart();
        });
      });
      m.querySelectorAll("[data-metric]").forEach((b) => {
        b.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.metric = b.dataset.metric;
          m.querySelectorAll("[data-metric]").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          this.drawChart();
        });
      });
      m.querySelectorAll("[data-act]").forEach((b) => {
        b.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.action(b.dataset.act, b);
        });
      });

      this.loadChart();
      this.loadArchives();
    }

    async loadChart() {
      if (!this.modal) return;
      try {
        this.detail = await this.fetchHistory(this.range || 24, 600);
      } catch (e) {
        this.detail = null;
      }
      this.drawChart();
    }

    metricLabel() {
      const keys = { l: "speed.latency", j: "speed.jitter", p: "speed.loss", d: "speed.download" };
      return this.ctx.i18n.t(keys[this.metric] || "speed.latency");
    }

    metricUnit() {
      if (this.metric === "p") return "%";
      if (this.metric === "d") return this.ctx.i18n.t("speed.mbps");
      return "ms";
    }

    drawChart() {
      const m = this.modal;
      if (!m) return;
      const i18n = this.ctx.i18n;
      const data = this.detail;
      const pts = (data && data.points) || [];
      const W = 640, H = 220, PAD = 10;

      const vals = pts.map((p) => p[this.metric]).filter((v) => Number.isFinite(v));
      const last = [...pts].reverse().find((p) => Number.isFinite(p[this.metric]));
      m.querySelector(".pwih-now-val").textContent = last
        ? fmtMs(last[this.metric], this.locale) + " " + this.metricUnit() : "—";
      m.querySelector(".pwih-now-lbl").textContent = this.metricLabel();

      /* Echelle. La perte de paquets est un pourcentage : 0-100 fixe,
         pour la meme raison que l'Etat systeme -- une echelle ajustee
         ferait paraitre catastrophique un 0,5 %. La latence et le debit,
         eux, n'ont pas de maximum naturel : les enfermer dans une
         echelle fixe rendrait la courbe plate sur une bonne ligne. Ils
         sont donc ajustes au contenu, mais TOUJOURS depuis zero, pour
         que la hauteur du trait reste proportionnelle a la valeur.
         Scale. Packet loss is a percentage: fixed 0-100, for the same
         reason as System status -- a fitted scale would make 0.5% look
         catastrophic. Latency and throughput have no natural maximum:
         locking them into a fixed scale would flatten the curve on a
         good line. They are therefore fitted to the content, but ALWAYS
         from zero, so the stroke's height stays proportional to the
         value. */
      const max = this.metric === "p" ? 100 : Math.max(1, ...vals) * 1.15;
      const y = (v) => PAD + (H - 2 * PAD) * (1 - Math.max(0, Math.min(v, max)) / max);
      const x = (i) => pts.length < 2 ? 0 : (i / (pts.length - 1)) * W;

      const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
      m.querySelector(".pwih-grid").innerHTML = ticks.map((v) =>
        `<line x1="0" y1="${y(v).toFixed(1)}" x2="${W}" y2="${y(v).toFixed(1)}"
               stroke="var(--tile-edge)" stroke-width="1"/>
         <text x="4" y="${(y(v) - 3).toFixed(1)}" fill="var(--muted)" font-size="10">${
           Math.round(v * 10) / 10}</text>`).join("");

      /* Axe des abscisses. Cette fenetre affichait deja les deux bornes
         de la periode, mais rien entre les deux : un creux au milieu de
         "24 h" restait impossible a dater. L'axe commun
         (public/chart-time-axis.js) place des graduations sur des heures
         rondes, avec les memes regles que les autres graphiques du
         tableau. Traits verticaux dans le SVG, etiquettes en HTML sous
         lui -- ce SVG est etire (`preserveAspectRatio="none"`) et
         deformerait le texte.
         X axis. This window already showed the period's two bounds, but
         nothing in between: a dip in the middle of "24 h" stayed
         impossible to date. The shared axis
         (public/chart-time-axis.js) puts ticks on round hours, with the
         same rules as every other chart on the board. Vertical lines in
         the SVG, labels in HTML below it -- this SVG is stretched
         (`preserveAspectRatio="none"`) and would distort the text. */
      const axis = window.PiBoardTimeAxis;
      const axisEl = m.querySelector(".pwih-taxis");
      if (axis && axisEl && pts.length > 1) {
        const ticks = axis.timeTicks(pts[0].t, pts[pts.length - 1].t, { locale: this.locale, maxTicks: 6 });
        m.querySelector(".pwih-grid").innerHTML += axis.gridLines(ticks, 0, W, PAD, H - PAD);
        axisEl.innerHTML = axis.axisHtml(ticks, 0, 0);
      } else if (axisEl) {
        axisEl.innerHTML = "";
      }

      this.renderStats(data);

      if (pts.length < 2 || !vals.length) {
        m.querySelector(".pwih-line").setAttribute("d", "");
        m.querySelector(".pwih-area").setAttribute("d", "");
        m.querySelector(".pwih-out").innerHTML = "";
        return;
      }

      // Le debit n'est mesure que toutes les quelques heures : ses
      // points sont donc EPARS. Les relier au trait plein comme la
      // latence donnerait l'illusion d'une mesure continue.
      // Throughput is only measured every few hours: its points are
      // therefore SPARSE. Joining them with a solid stroke like latency
      // would give the illusion of a continuous reading.
      let d = "";
      let pen = false;
      let firstX = null, lastX = null;
      const outages = [];
      pts.forEach((p, i) => {
        const v = p[this.metric];
        if (!Number.isFinite(v)) {
          pen = false;
          // Une coupure n'est marquee que sur les courbes qui la
          // subissent : un "trou" dans la courbe de debit est normal
          // (pas de mesure ce jour-la), pas une panne.
          // An outage is only marked on the curves that suffer it: a
          // "hole" in the throughput curve is normal (no reading that
          // day), not a failure.
          if (this.metric !== "d" && !Number.isFinite(p.l)) outages.push(x(i));
          return;
        }
        if (firstX == null) firstX = x(i);
        lastX = x(i);
        d += (pen ? " L" : " M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
        pen = true;
      });

      m.querySelector(".pwih-line").setAttribute("d", d.trim());
      m.querySelector(".pwih-area").setAttribute("d",
        (firstX == null || this.metric === "d") ? "" :
        d.trim() + ` L${lastX.toFixed(1)} ${H - PAD} L${firstX.toFixed(1)} ${H - PAD} Z`);
      m.querySelector(".pwih-out").innerHTML = outages.map((px) =>
        `<rect x="${(px - 1).toFixed(1)}" y="0" width="2" height="${H}" fill="var(--pwsp-down)" opacity="0.5"/>`
      ).join("");
    }

    renderStats(data) {
      const m = this.modal;
      if (!m) return;
      const i18n = this.ctx.i18n;
      const st = (data && data.stats) || {};
      const key = { l: "latency", j: "jitter", p: "loss", d: "download" }[this.metric] || "latency";
      const s = st[key] || {};
      const unit = this.metricUnit();
      const n = (v) => (v == null ? "—" : fmtMs(v, this.locale) + " " + unit);

      const rows = [
        [i18n.t("speed.min"), n(s.min)],
        [i18n.t("speed.avg"), n(s.avg)],
        [i18n.t("speed.max"), n(s.max)],
        [i18n.t("speed.readings"), s.count == null ? "—" : String(s.count)]
      ];
      if (st.availability != null) {
        rows.push([i18n.t("speed.uptime"), fmtPct(st.availability, this.locale) + " %"]);
      }
      m.querySelector(".pwih-stats").innerHTML = rows.map(([k, v]) =>
        `<div class="pwih-stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    }

    /* ---------- Actions ---------- */

    note(text, kind) {
      if (!this.modal) return;
      const el = this.modal.querySelector("[data-role=note]");
      if (!el) return;
      el.textContent = text || "";
      el.className = "pwih-note" + (kind ? " pwih-note-" + kind : "");
    }

    exportQuery() {
      const s = this.ctx.settings;
      const hours = Math.max(1, Math.min(72, Number(s.exportHours) || 24));
      const dialect = s.csvDialect === "international" ? "international" : "french";
      return `hours=${hours}&dialect=${dialect}`;
    }

    async action(act, button) {
      const i18n = this.ctx.i18n;

      if (act === "download") {
        // Navigation simple : le serveur pose deja l'en-tete
        // Content-Disposition. Plain navigation: the server already sets
        // the Content-Disposition header.
        window.open("/api/internet-health/export.csv?" + this.exportQuery(), "_blank");
        return;
      }

      if (act === "run") {
        // Un test complet dure plusieurs secondes : sans desactiver le
        // bouton, on en lancerait trois qui se partageraient la ligne et
        // annonceraient chacun un tiers du debit reel.
        // A full test takes several seconds: without disabling the
        // button, three would be launched, sharing the line and each
        // reporting a third of the real throughput.
        button.disabled = true;
        this.note(i18n.t("speed.running"));
        try {
          const r = await fetch("/api/internet-health/run?full=1", { method: "POST" });
          const out = await r.json();
          if (out && out.ok) {
            this.note(i18n.t("speed.runDone"), "ok");
            await this.refresh();
            await this.loadChart();
          } else {
            this.note(i18n.t("speed.runBusy"));
          }
        } catch (e) {
          this.note(i18n.t("speed.runFailed"), "err");
        } finally {
          button.disabled = false;
        }
        return;
      }

      if (act === "archive") {
        button.disabled = true;
        try {
          const r = await fetch("/api/internet-health/archive?" + this.exportQuery(), { method: "POST" });
          if (!r.ok) throw new Error("status " + r.status);
          const out = await r.json();
          this.note(i18n.t("speed.archiveDone")
            .replace("{file}", out.file)
            .replace("{n}", String(out.points))
            .replace("{path}", out.path), "ok");
          await this.loadArchives();
        } catch (e) {
          this.note(i18n.t("speed.archiveFailed"), "err");
        } finally {
          button.disabled = false;
        }
      }
    }

    /* La liste des archives deja constituees est affichee dans la
       fenetre : sans elle, l'archivage serait une action sans retour
       visible, et on ne saurait jamais si on l'a deja faite aujourd'hui.
       The list of archives already made is shown in the window: without
       it, archiving would be an action with no visible outcome, and one
       would never know whether it was already done today. */
    async loadArchives() {
      if (!this.modal) return;
      const i18n = this.ctx.i18n;
      const box = this.modal.querySelector("[data-role=archives]");
      if (!box) return;
      let list = [];
      try {
        const r = await fetch("/api/internet-health/archives");
        list = ((await r.json()).archives || []).slice(0, 8);
      } catch (e) {
        list = [];
      }
      if (!list.length) { box.innerHTML = ""; return; }
      box.innerHTML = `
        <div class="pwih-archives-title">${esc(i18n.t("speed.archivesTitle"))}</div>
        ${list.map((a) => `
          <a class="pwih-archive" href="/api/internet-health/archives/${encodeURIComponent(a.file)}" download>
            <span class="pwih-archive-name">${esc(a.file)}</span>
            <span class="pwih-archive-size">${Math.max(1, Math.round(a.bytes / 1024))} ko</span>
          </a>`).join("")}`;
    }
  }

  window.PiBoard.registerWidget("speedtest", SpeedtestWidget);
})();
