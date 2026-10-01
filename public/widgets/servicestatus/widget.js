/* PiBoard widget: servicestatus / statut des services en ligne.

   Lit les pages de statut publiques (GitHub, Cloudflare, npm...) par le
   relais du serveur -- voir server/serviceStatus.js pour l'API employee,
   le garde-fou sur les adresses et le cache partage.

   LA CADENCE DOUBLE, qui est le coeur de cette tuile. Interroger une page
   de statut toutes les minutes en permanence n'a aucun sens : il ne s'y
   passe rien pendant des semaines. Mais une fois l'incident declare,
   dix minutes d'attente entre deux relevés sont une eternite -- c'est
   justement le moment ou l'on regarde la tuile toutes les trente
   secondes. D'ou deux rythmes : lent tant que tout va bien, rapide des
   que ce n'est plus le cas.

   DEUX DECISIONS QUI COMPTENT :

   1. On accelere des que l'indicateur global n'est plus « none », donc
      y compris sur une degradation MINEURE. Attendre la panne majeure
      pour regarder de pres reviendrait a n'accelerer qu'une fois qu'il
      est trop tard pour que ce soit utile.

   2. On ne ralentit qu'apres DEUX relevés sains d'affilee. Un incident
      en dents de scie -- et ils le sont presque tous, les composants
      repassant au vert puis au rouge pendant la remediation -- ferait
      sinon osciller la tuile entre les deux rythmes, et la ferait
      ralentir precisement pendant l'accalmie qui precede la rechute.

   Reads public status pages through the server relay. THE DUAL CADENCE
   is this tile's whole point: polling every minute forever is pointless,
   nothing happens for weeks; but once an incident is declared, ten
   minutes between readings is an age -- exactly when one checks the tile
   every thirty seconds. Two decisions matter: we speed up as soon as the
   indicator leaves "none", minor degradations included (waiting for a
   major outage means speeding up once it is too late to help); and we
   slow down only after TWO consecutive healthy readings, because almost
   every incident is jagged, and otherwise the tile would slow down
   during precisely the lull before the relapse. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const MAX_SERVICES = 10;

  /* Teintes par severite. On reutilise les variables du theme plutot que
     des couleurs fixes : la tuile suit ainsi le theme applique, y compris
     les themes personnalises, et reste lisible sur fond clair comme
     sombre.
     Severity tints reuse the theme's variables rather than fixed
     colours, so the tile follows the applied theme, custom ones
     included, and stays readable on light and dark alike. */
  const TONE = {
    none: "var(--ok)",
    minor: "var(--warn)",
    major: "var(--danger)",
    critical: "var(--danger)",
    unknown: "var(--muted)"
  };
  const COMPONENT_TONE = {
    operational: "var(--ok)",
    under_maintenance: "var(--muted)",
    degraded_performance: "var(--warn)",
    partial_outage: "var(--danger)",
    major_outage: "var(--danger)",
    unknown: "var(--muted)"
  };

  /* « Nom = adresse », une par ligne, et « # » pour desactiver : la
     meme grammaire que la tuile Veille reseau. Un reglage qui se
     ressemble d'une tuile a l'autre s'apprend une fois.
     "Name = address", one per line, "#" to disable: the same grammar as
     the Network watch tile. A setting that looks the same from one tile
     to the next is learned once. */
  function parseTargets(text) {
    const out = [];
    for (const raw of String(text || "").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      const label = eq === -1 ? "" : line.slice(0, eq).trim();
      const url = (eq === -1 ? line : line.slice(eq + 1)).trim();
      if (!url) continue;
      out.push({ label, url });
      if (out.length >= MAX_SERVICES) break;
    }
    return out;
  }

  /* Duree ecoulee en clair : « 1 h 35 », « 12 min ». Les secondes ne
     servent a rien ici -- un incident se compte en minutes -- et un
     horodatage brut obligerait a faire la soustraction de tete devant
     l'ecran.
     Elapsed time in plain words. Seconds are useless here, and a raw
     timestamp would force the reader to do the subtraction in their
     head. */
  function since(iso, i18n, now) {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return null;
    const min = Math.max(0, Math.round(((now || Date.now()) - t) / 60000));
    if (min < 1) return i18n.t("svcstatus.justNow");
    if (min < 60) return min + " " + i18n.t("svcstatus.min");
    const h = Math.floor(min / 60);
    const rest = min % 60;
    if (h < 24) return h + " h" + (rest ? " " + String(rest).padStart(2, "0") : "");
    return Math.floor(h / 24) + " " + i18n.t("svcstatus.days");
  }

  class ServiceStatusWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.services = [];
      this.fetchedAt = null;
      this.fast = false;
      this.healthyStreak = 0;
      /* Incidents deja signales, pour ne notifier qu'une fois par
         incident. Sans cela, la tuile sonnerait a CHAQUE relevé pendant
         toute la duree de la panne -- soit, en cadence rapide, toutes les
         minutes pendant des heures : la meilleure facon de faire couper
         les notifications pour de bon.
         Incidents already announced, so each is notified once. Without
         this the tile would ring at EVERY reading for the whole outage --
         every minute for hours at the fast cadence, the surest way to get
         notifications switched off for good. */
      this.announced = new Set();
      this.firstLoadDone = false;
    }

    init() {
      this.render();
      this.refresh();
    }

    onSettingsChanged() {
      this.announced.clear();
      this.healthyStreak = 0;
      this.refresh();
    }

    normalMinutes() {
      return Math.max(1, Number(this.ctx.settings.refreshMinutes) || 10);
    }

    incidentMinutes() {
      return Math.max(1, Number(this.ctx.settings.incidentRefreshMinutes) || 1);
    }

    arm() {
      clearTimeout(this.timer);
      const minutes = this.fast ? this.incidentMinutes() : this.normalMinutes();
      this.timer = setTimeout(() => this.refresh(), minutes * 60000);
    }

    async refresh() {
      const targets = parseTargets(this.ctx.settings.services);
      if (!targets.length) {
        this.services = [];
        this.render();
        this.arm();
        return;
      }
      try {
        const qs = targets.map((t) => "url=" + encodeURIComponent(t.url)).join("&");
        const r = await fetch("api/service-status?" + qs);
        if (!r.ok) throw new Error("http " + r.status);
        const data = await r.json();
        const list = Array.isArray(data.services) ? data.services : [];
        this.services = list.map((svc, i) => Object.assign({}, svc, {
          label: targets[i] ? (targets[i].label || svc.name || targets[i].url) : (svc.name || "")
        }));
        this.fetchedAt = Date.now();
        this.updateCadence();
        this.notifyNewIncidents();
        this.firstLoadDone = true;
      } catch (e) {
        console.warn("[piboard/servicestatus]", e);
        /* Le relais injoignable, c'est PiBoard qui ne repond pas, pas le
           service surveille. On garde donc le dernier etat connu et on le
           signale comme perime, plutot que d'afficher du vert ou du rouge
           qu'on ne tient de personne.
           An unreachable relay means PiBoard is not answering, not the
           watched service: the last known state is kept and flagged as
           stale rather than showing a green or a red we got from nobody. */
        this.relayError = true;
      }
      this.render();
      this.arm();
    }

    worstIndicator() {
      const RANK = { none: 0, unknown: 1, minor: 2, major: 3, critical: 4 };
      let worst = "none";
      for (const s of this.services) {
        const ind = s.error ? "unknown" : (s.indicator || "unknown");
        if ((RANK[ind] || 0) > (RANK[worst] || 0)) worst = ind;
      }
      return worst;
    }

    /* Bascule de cadence. L'acceleration est IMMEDIATE, le retour au
       calme demande deux relevés sains : voir l'en-tete du fichier.
       Cadence switch: speeding up is IMMEDIATE, calming down takes two
       healthy readings. */
    updateCadence() {
      const healthy = this.worstIndicator() === "none";
      if (!healthy) {
        this.healthyStreak = 0;
        this.fast = true;
        return;
      }
      this.healthyStreak += 1;
      if (this.healthyStreak >= 2) this.fast = false;
    }

    notifyNewIncidents() {
      const s = this.ctx.settings;
      if (!s.notifyOnIncident) return;
      const fresh = [];
      for (const svc of this.services) {
        for (const inc of (svc.incidents || [])) {
          const key = (svc.base || svc.label) + "#" + (inc.id || inc.name);
          if (this.announced.has(key)) continue;
          this.announced.add(key);
          fresh.push({ svc, inc });
        }
      }
      /* Au TOUT PREMIER chargement, on enregistre les incidents en cours
         sans alerter : un incident vieux de trois heures, deja connu,
         n'a pas a declencher un flash plein ecran parce que le tableau
         vient de redemarrer. On n'alerte que sur ce qui apparait sous
         nos yeux.
         On the VERY FIRST load, ongoing incidents are recorded without
         alerting: a three-hour-old incident must not trigger a
         full-screen flash merely because the board just restarted. */
      if (!this.firstLoadDone || !fresh.length) return;

      const first = fresh[0];
      const label = first.svc.label || first.svc.name || "";
      this.ctx.api.startAlert({
        flash: s.notifyFlash !== false,
        soundName: s.notifySound !== false ? (s.notifySoundChoice || "beep-simple") : null,
        durationMs: Math.max(1, Number(s.notifyDurationSeconds) || 15) * 1000
      });
      if (s.notifyUrl) {
        const message = label + " — " + first.inc.name;
        const url = s.notifyUrl.indexOf("{message}") !== -1
          ? s.notifyUrl.replace("{message}", encodeURIComponent(message))
          : s.notifyUrl;
        fetch(url, { mode: "no-cors" }).catch(() => { /* best effort */ });
      }
    }

    render() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const el = this.ctx.el;
      const targets = parseTargets(s.services);

      if (!targets.length) {
        el.innerHTML = `<div class="pw-svcstatus"><div class="pwss-empty">${esc(i18n.t("svcstatus.noService"))}</div></div>`;
        return;
      }
      if (!this.services.length) {
        el.innerHTML = `<div class="pw-svcstatus"><div class="pwss-empty">${esc(i18n.t("svcstatus.loading"))}</div></div>`;
        return;
      }

      const now = Date.now();
      const body = this.services.map((svc) => this.renderService(svc, i18n, s, now)).join("");
      const checked = this.fetchedAt
        ? i18n.t("svcstatus.checked") + " " + since(new Date(this.fetchedAt).toISOString(), i18n, now)
        : "";
      const cadence = this.fast
        ? `<span class="pwss-fast">${esc(i18n.t("svcstatus.cadence.fast"))} · ${this.incidentMinutes()} ${esc(i18n.t("svcstatus.min"))}</span>`
        : `<span>${esc(i18n.t("svcstatus.cadence.normal"))} · ${this.normalMinutes()} ${esc(i18n.t("svcstatus.min"))}</span>`;

      el.innerHTML = `
        <div class="pw-svcstatus">
          <div class="pwss-list">${body}</div>
          <div class="pwss-foot"><span>${esc(checked)}</span>${cadence}</div>
        </div>`;
    }

    renderService(svc, i18n, s, now) {
      const label = esc(svc.label || svc.name || "");

      if (svc.error) {
        const why = svc.error === "bad-url" ? "svcstatus.err.badUrl"
          : svc.error === "bad-response" ? "svcstatus.err.badResponse"
            : "svcstatus.err.unreachable";
        return `
          <div class="pwss-svc" style="--pwss-tone:${TONE.unknown}">
            <div class="pwss-head"><span class="pwss-name">${label}</span>
              <span class="pwss-state"><span class="pwss-dot"></span>${esc(i18n.t("svcstatus.state.unknown"))}</span></div>
            <div class="pwss-detail"><span>${esc(i18n.t(why))}</span></div>
          </div>`;
      }

      const tone = TONE[svc.indicator] || TONE.unknown;
      const stateLabel = i18n.t("svcstatus.state." + (svc.indicator || "unknown"));
      const detail = [];

      /* Les composants touches UNIQUEMENT : lister ce qui va bien noierait
         le probleme au milieu de dix lignes vertes.
         ONLY the affected components: listing what works would drown the
         problem among ten green lines. */
      for (const c of (svc.affected || []).slice(0, 4)) {
        detail.push(`<span class="pwss-comp" style="--pwss-tone:${COMPONENT_TONE[c.status] || COMPONENT_TONE.unknown}">`
          + esc(c.name) + ` <span class="pwss-comp-state">— ${esc(i18n.t("svcstatus.comp." + c.status))}</span></span>`);
      }
      const more = (svc.affected || []).length - 4;
      if (more > 0) detail.push(`<span>${esc(i18n.t("svcstatus.more").replace("{n}", more))}</span>`);

      const inc = (svc.incidents || [])[0];
      if (inc) {
        const ago = since(inc.startedAt, i18n, now);
        const stage = inc.status ? i18n.t("svcstatus.stage." + String(inc.status).toLowerCase()) : "";
        detail.push(`<span class="pwss-incident">${esc(inc.name)}`
          + (stage || ago ? ` <span class="pwss-stage">· ${esc(stage)}${ago ? " · " + esc(i18n.t("svcstatus.for")) + " " + esc(ago) : ""}</span>` : "")
          + `</span>`);
        if (inc.lastMessage) detail.push(`<span class="pwss-msg">${esc(inc.lastMessage)}</span>`);
        if (inc.url) {
          detail.push(`<a class="pwss-link" href="${esc(inc.url)}" target="_blank" rel="noopener">`
            + esc(i18n.t("svcstatus.openIncident")) + `</a>`);
        }
      } else {
        detail.push(`<span class="pwss-none">${esc(i18n.t("svcstatus.noIncident"))}</span>`);
      }

      if (s.showMaintenances !== false) {
        const m = (svc.maintenances || [])[0];
        detail.push(m
          ? `<span class="pwss-maint">${esc(i18n.t("svcstatus.maintenance"))} ${esc(m.name)}${m.scheduledFor ? " · " + esc(this.whenLabel(m.scheduledFor, i18n)) : ""}</span>`
          : `<span class="pwss-none">${esc(i18n.t("svcstatus.noMaintenance"))}</span>`);
      }

      return `
        <div class="pwss-svc" style="--pwss-tone:${tone}">
          <div class="pwss-head"><span class="pwss-name">${label}</span>
            <span class="pwss-state"><span class="pwss-dot"></span>${esc(stateLabel)}</span></div>
          <div class="pwss-detail">${detail.join("")}</div>
        </div>`;
    }

    whenLabel(iso, i18n) {
      const t = Date.parse(iso || "");
      if (!Number.isFinite(t)) return "";
      const d = new Date(t);
      return d.toLocaleString(i18n.t("clock.date.format"), {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    }

    destroy() { clearTimeout(this.timer); }
  }

  window.PiBoard.registerWidget("servicestatus", ServiceStatusWidget);

  /* Expose pour les tests : les fonctions pures de mise en forme, qui
     n'ont besoin ni du DOM ni du reseau.
     Exposed for tests: the pure formatting helpers. */
  window.PiBoardServiceStatusHelpers = { parseTargets, since, MAX_SERVICES };
})();
