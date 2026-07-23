/* PiBoard widget: commute / trajet domicile-travail
   Geocodage des adresses via Nominatim (OpenStreetMap) et calcul
   d'itineraire via le serveur de demonstration OSRM, tous deux sans
   cle API. Les deux adresses ne sont geocodees qu'une fois (mises en
   cache) ; seul l'itineraire est recalcule a chaque rafraichissement.
   Geocodes addresses through Nominatim (OpenStreetMap) and computes the
   route through the OSRM demo server, both keyless. Addresses are
   geocoded only once (cached); only the route is recomputed on refresh. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 10);
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

    async route(from, to) {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
      const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => r.json());
      if (!data.routes || !data.routes.length) throw new Error("no route");
      return { durationMin: Math.round(data.routes[0].duration / 60), distanceKm: Math.round(data.routes[0].distance / 100) / 10 };
    }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      try {
        if (!s.home || !s.work) {
          el.innerHTML = `<div class="pw-commute"><div class="pwm-err">${i18n.t("commute.missing")}</div></div>`;
          return;
        }
        const home = await this.ensureCoords("home", s.home);
        const work = await this.ensureCoords("work", s.work);

        const cols = [];
        if (s.direction === "toWork" || s.direction === "both") {
          const r = await this.route(home, work);
          cols.push({ label: "A → B", ...r });
        }
        if (s.direction === "toHome" || s.direction === "both") {
          const r = await this.route(work, home);
          cols.push({ label: "B → A", ...r });
        }

        // Trajets supplementaires : depuis l'adresse A (domicile) vers
        // chaque destination nommee. Un emplacement sans nom OU sans
        // adresse est simplement ignore ; un echec de calcul sur un
        // trajet n'empeche pas l'affichage des autres.
        // Extra trips: from address A (home) to each named destination.
        // A slot missing its name OR address is simply skipped; a failed
        // computation on one trip doesn't prevent showing the others.
        for (let i = 1; i <= 5; i++) {
          const label = (s["trip" + i + "Label"] || "").trim();
          const address = (s["trip" + i + "Address"] || "").trim();
          if (!label || !address) continue;
          try {
            const dest = await this.ensureCoords("trip" + i, address);
            const r = await this.route(home, dest);
            cols.push({ label, ...r });
          } catch (e) {
            console.warn("[piboard/commute] trip" + i, e);
            cols.push({ label, error: true });
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
              : `<div class="pwm-duration">${c.durationMin} ${i18n.t("commute.min")}</div>
                 <div class="pwm-distance">${c.distanceKm} km</div>`}
          </div>`).join("");

        const rows = s.layout === "rows";
        el.innerHTML = `<div class="pw-commute"><div class="pwm-cols ${rows ? "pwm-rows" : ""}">${colHtml}</div></div>`;
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
