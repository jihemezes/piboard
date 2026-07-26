/* PiBoard widget: commute / trajet domicile-travail
   Geocodage des adresses via Nominatim (OpenStreetMap, gratuit, sans
   cle -- inchange) et calcul d'itineraire via l'API Routing de TomTom
   (meme cle que le widget Trafic), pour un temps de trajet integrant le
   trafic reel, une comparaison au temps habituel, et une heure de
   depart conseillee quand une heure d'arrivee souhaitee est renseignee.
   Les adresses ne sont geocodees qu'une fois (mises en cache) ; seul
   l'itineraire est recalcule a chaque rafraichissement.

   Geocodes addresses through Nominatim (OpenStreetMap, free, keyless --
   unchanged) and computes routes through TomTom's Routing API (same key
   as the Traffic widget), for a travel time that accounts for real
   traffic, a comparison against the usual time, and a suggested
   departure time when a desired arrival time is set. Addresses are
   geocoded only once (cached); only the route is recomputed on refresh. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Prochaine occurrence (aujourd'hui, ou demain si deja passee) d'une
  // heure "HH:MM", au format ISO8601 avec decalage local -- format exige
  // par le parametre "arriveAt" de l'API TomTom.
  // Next occurrence (today, or tomorrow if already past) of an "HH:MM"
  // time, in ISO8601 format with local offset -- the format TomTom's
  // "arriveAt" parameter requires.
  function nextArriveAtIso(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    if (d <= now) d = new Date(d.getTime() + 86400000); // demain si deja passee / tomorrow if already past
    const pad = (n) => String(n).padStart(2, "0");
    const offMin = -d.getTimezoneOffset();
    const sign = offMin >= 0 ? "+" : "-";
    const offH = pad(Math.floor(Math.abs(offMin) / 60));
    const offM = pad(Math.abs(offMin) % 60);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${offH}:${offM}`;
  }

  function fmtClock(iso, locale) {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  class CommuteWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      // Cache de geocodage par cle ("home", "work", "trip1"...) : chaque
      // adresse n'est geocodee qu'une fois tant qu'elle ne change pas.
      // Geocoding cache by key ("home", "work", "trip1"...): each address
      // is geocoded only once as long as it doesn't change.
      this.coords = {};
      this.geocodedFor = {};
      this.quotaCount = 0;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      this.loadQuota(); // en parallele, ne doit pas retarder l'affichage / in parallel, mustn't delay display
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      // Plancher releve a 10 min (au lieu de 5) : chaque rafraichissement
      // peut desormais declencher jusqu'a 7 appels TomTom (2 sens du
      // trajet principal + 5 trajets supplementaires), qui partagent le
      // meme quota gratuit que la tuile Trafic.
      // Floor raised to 10 min (from 5): each refresh can now trigger up
      // to 7 TomTom calls (2 directions of the main route + 5 extra
      // trips), which share the same free quota as the Traffic tile.
      const minutes = Math.max(10, Number(this.ctx.settings.refresh) || 15);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async geocode(address) {
      const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(address);
      const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => r.json());
      if (!data || !data.length) throw new Error("address not found: " + address);
      return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
    }

    async ensureCoords(which, address) {
      if (!address) throw new Error("missing address");
      if (this.geocodedFor[which] === address && this.coords[which]) return this.coords[which];
      const c = await this.geocode(address);
      this.coords[which] = c;
      this.geocodedFor[which] = address;
      return c;
    }

    /* Itineraire via l'API Routing de TomTom, avec trafic reel. Le champ
       "historicTrafficTravelTimeInSeconds" (temps typique pour ce jour
       et cette heure, hors incident ponctuel) sert de reference pour la
       comparaison "temps habituel" -- plus parlant que le temps sans
       aucun trafic (noTrafficTravelTimeInSeconds), qui est un ideal
       theorique rarement atteint en pratique. Si une heure d'arrivee
       souhaitee est fournie, TomTom calcule directement le trajet en
       tenant compte du trafic PREVU a ce moment futur, et renvoie
       l'heure de depart correspondante (champ "departureTime").
       Route via TomTom's Routing API, with real traffic.
       "historicTrafficTravelTimeInSeconds" (typical time for this day
       and hour, excluding one-off incidents) is used as the "usual
       time" baseline -- more meaningful than the zero-traffic time
       (noTrafficTravelTimeInSeconds), which is a theoretical ideal
       rarely reached in practice. If a desired arrival time is given,
       TomTom directly computes the trip accounting for PREDICTED
       traffic at that future moment, and returns the matching departure
       time (the "departureTime" field). */
    async routeTomTom(from, to, arriveBy) {
      const apiKey = this.ctx.settings.apiKey;
      if (!apiKey) throw new Error(this.ctx.i18n.t("commute.noApiKey"));
      const arriveAtIso = nextArriveAtIso(arriveBy);
      let url = `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lon}:${to.lat},${to.lon}/json`
        + `?key=${encodeURIComponent(apiKey)}&traffic=true&computeTravelTimeFor=all`;
      if (arriveAtIso) url += `&arriveAt=${encodeURIComponent(arriveAtIso)}`;
      const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => {
        if (!r.ok) throw new Error("tomtom " + r.status);
        return r.json();
      });
      this.bumpQuota(1);
      if (data.detailedError) throw new Error(data.detailedError.message || "tomtom error");
      if (!data.routes || !data.routes.length) throw new Error("no route");
      const sum = data.routes[0].summary;
      const usualSec = sum.historicTrafficTravelTimeInSeconds !== undefined && sum.historicTrafficTravelTimeInSeconds !== null
        ? sum.historicTrafficTravelTimeInSeconds : sum.noTrafficTravelTimeInSeconds;
      const delayMin = (usualSec !== undefined && usualSec !== null)
        ? Math.round((sum.travelTimeInSeconds - usualSec) / 60) : null;
      return {
        durationMin: Math.round(sum.travelTimeInSeconds / 60),
        distanceKm: Math.round(sum.lengthInMeters / 100) / 10,
        delayMin,
        departureTime: arriveAtIso ? sum.departureTime : null
      };
    }

    /* Compteur quotidien de requetes TomTom, partage avec le widget
       Trafic via la meme route serveur (deja generique, indexee par
       tuile) -- ce compteur reste propre a CETTE tuile, il ne se combine
       pas avec celui d'une eventuelle tuile Trafic separee, mais donne
       une vision claire de ce que cette tuile-ci consomme.
       Daily TomTom request counter, shared with the Traffic widget
       through the same server route (already generic, keyed per tile)
       -- this counter stays specific to THIS tile, it doesn't combine
       with a separate Traffic tile's, but gives a clear picture of what
       this tile alone consumes. */
    async loadQuota() {
      try {
        const q = await fetch("/api/traffic-quota/" + this.ctx.instanceId).then((r) => r.json());
        this.quotaCount = q.count;
        this.updateQuotaBadge();
      } catch (e) { /* discret : pas d'erreur bloquante pour un simple compteur / silent: not a blocking error for a mere counter */ }
    }

    bumpQuota(n) {
      fetch("/api/traffic-quota/" + this.ctx.instanceId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n })
      }).then((r) => r.json()).then((q) => {
        this.quotaCount = q.count;
        this.updateQuotaBadge();
      }).catch(() => {});
    }

    updateQuotaBadge() {
      if (!this.quotaBadge) return;
      this.quotaBadge.hidden = false;
      this.quotaBadge.textContent = this.ctx.i18n.t("commute.quota") + " " + this.quotaCount + " / 2500";
      this.quotaBadge.classList.toggle("pwm-quota-warn", this.quotaCount > 2000);
    }

    // Seuils d'alerte (en minutes de retard par rapport au temps
    // habituel) : au-dela du seuil "fort", rouge ; au-dela du seuil
    // "modere", orange ; en avance ou dans les temps, vert.
    // Alert thresholds (in minutes of delay versus the usual time):
    // beyond the "heavy" threshold, red; beyond the "moderate"
    // threshold, orange; early or on time, green.
    delayClass(delayMin) {
      if (delayMin === null || delayMin === undefined) return "";
      const s = this.ctx.settings;
      const moderate = Math.max(1, Number(s.alertModerate) || 10);
      const heavy = Math.max(moderate + 1, Number(s.alertHeavy) || 20);
      if (delayMin >= heavy) return "pwm-delay-heavy";
      if (delayMin >= moderate) return "pwm-delay-moderate";
      return "pwm-delay-good";
    }

    formatDelay(delayMin) {
      if (delayMin === null || delayMin === undefined) return "";
      const i18n = this.ctx.i18n;
      if (Math.abs(delayMin) < 1) return ` <span class="pwm-delay pwm-delay-good">(${i18n.t("commute.onTime")})</span>`;
      const sign = delayMin > 0 ? "+" : "−";
      return ` <span class="pwm-delay ${this.delayClass(delayMin)}">(${sign}${Math.abs(delayMin)} ${i18n.t("commute.min")})</span>`;
    }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      try {
        if (!s.home || !s.work) {
          el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${i18n.t("commute.missing")}</div></div>`;
          return;
        }
        if (!s.apiKey) {
          el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${i18n.t("commute.noApiKey")}</div></div>`;
          return;
        }
        const home = await this.ensureCoords("home", s.home);
        const work = await this.ensureCoords("work", s.work);

        // Definit chaque trajet a calculer -- trajet principal (un ou
        // deux sens) puis trajets supplementaires -- chacun avec sa
        // propre heure d'arrivee souhaitee optionnelle.
        // Defines each route to compute -- main route (one or both
        // directions) then extra trips -- each with its own optional
        // desired arrival time.
        const defs = [];
        if (s.direction === "toWork" || s.direction === "both") {
          defs.push({ label: "A → B", from: home, to: work, arriveBy: s.arriveWorkBy });
        }
        if (s.direction === "toHome" || s.direction === "both") {
          defs.push({ label: "B → A", from: work, to: home, arriveBy: s.arriveHomeBy });
        }
        for (let i = 1; i <= 5; i++) {
          const label = (s["trip" + i + "Label"] || "").trim();
          const address = (s["trip" + i + "Address"] || "").trim();
          if (!label || !address) continue;
          defs.push({ label, from: home, toAddress: address, toKey: "trip" + i, arriveBy: s["trip" + i + "ArriveBy"] });
        }

        // Un echec sur un trajet (adresse introuvable, erreur TomTom...)
        // n'empeche pas l'affichage des autres.
        // A failure on one trip (address not found, TomTom error...)
        // doesn't prevent showing the others.
        const cols = [];
        for (const def of defs) {
          try {
            const to = def.to || await this.ensureCoords(def.toKey, def.toAddress);
            const r = await this.routeTomTom(def.from, to, def.arriveBy);
            cols.push({ label: def.label, ...r });
          } catch (e) {
            console.warn("[piboard/commute]", def.label, e);
            cols.push({ label: def.label, error: true });
          }
        }

        // Les etiquettes deviennent utiles des qu'il y a plus d'un trajet
        // ou qu'un trajet supplementaire est present.
        // Labels become useful as soon as there is more than one trip or
        // any extra trip is present.
        const showLabels = cols.length > 1;
        const colHtml = cols.map((c, i) => `
          <div class="pwm-col ${i === 1 && s.direction === "both" ? "pwm-b" : ""}">
            ${showLabels ? `<div class="pwm-dir">${escapeHtml(c.label)}</div>` : ""}
            ${c.error
              ? `<div class="pwm-duration pwm-fail">—</div>`
              : `<div class="pwm-duration">${c.durationMin} ${i18n.t("commute.min")}${this.formatDelay(c.delayMin)}</div>
                 <div class="pwm-distance">${c.distanceKm} km</div>
                 ${c.departureTime ? `<div class="pwm-leaveby">${i18n.t("commute.leaveBy")} ${fmtClock(c.departureTime, locale)}</div>` : ""}`}
          </div>`).join("");

        const rows = s.layout === "rows";
        el.innerHTML = `
          <div class="pw-commute">
            <div class="pwm-cols ${rows ? "pwm-rows" : ""}">${colHtml}</div>
            <div class="pwm-quota" hidden></div>
          </div>`;
        this.quotaBadge = el.querySelector(".pwm-quota");
        this.updateQuotaBadge();
        this.fit();
      } catch (e) {
        console.warn("[piboard/commute]", e);
        el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${i18n.t("commute.error")}</div></div>`;
      }
    }

    fit() {
      const h = this.ctx.el.clientHeight || 100;
      // La taille s'adapte au nombre de trajets empiles pour que tout
      // reste visible. The size adapts to the number of stacked trips so
      // everything stays visible.
      const rows = this.ctx.el.querySelector(".pwm-rows");
      const count = this.ctx.el.querySelectorAll(".pwm-col").length || 1;
      const per = rows ? Math.floor((h * 0.9) / count) : h;
      this.ctx.el.querySelectorAll(".pwm-duration").forEach((n) => {
        n.style.fontSize = Math.max(15, Math.floor(per * 0.26)) + "px";
      });
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("commute", CommuteWidget);
})();
