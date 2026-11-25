/* PiBoard widget: astronomie / astronomy
   Trois sections independamment activables : phase de lune, prochains
   passages visibles de l'ISS, planetes actuellement au-dessus de
   l'horizon.

   Phase de lune et planetes : calculees LOCALEMENT sur le serveur PiBoard
   (voir server/astronomy.js, bibliotheque astronomy-engine) -- aucune
   dependance reseau externe, contrairement a la plupart des widgets.
   Passages ISS : seule section necessitant une source externe, des
   elements orbitaux a jour etant indispensables (voir iss-api.polluxlabs.io
   ci-dessous, CORS active, appelee directement depuis le navigateur).

   Three independently toggleable sections: moon phase, upcoming visible
   ISS passes, planets currently above the horizon.

   Moon phase and planets: computed LOCALLY on the PiBoard server (see
   server/astronomy.js, astronomy-engine library) -- no external network
   dependency, unlike most widgets. ISS passes: the only section needing
   an external source, since up-to-date orbital elements are essential
   (see iss-api.polluxlabs.io below, CORS enabled, called directly from
   the browser). */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Icone de phase de lune en SVG, construite a partir de la fraction
     eclairee et du sens (croissante/decroissante) -- technique classique
     du demi-cercle combine a une ellipse representant le terminateur :
     - rx de l'ellipse = R*|1-2*illum| (0 a la moitie exacte -> ligne
       droite d'un quartier ; R aux extremes -> cercle complet, plein ou
       nouveau selon le sens de balayage) ;
     - le sens de balayage de l'ellipse est identique a celui du
       demi-cercle pour une gibbeuse (illum>0.5, l'ellipse "ajoute" de la
       surface) et oppose pour un croissant (illum<0.5, l'ellipse
       "retranche" de la surface).
     Dans l'hemisphere sud, la lune apparait inversee par rapport a
     l'hemisphere nord : le sens de balayage est inverse en consequence.

     SVG moon-phase icon, built from the illuminated fraction and
     direction (waxing/waning) -- the classic half-circle-plus-ellipse
     technique for the terminator:
     - ellipse rx = R*|1-2*illum| (0 at exactly half -> straight quarter
       line; R at the extremes -> a full circle, either fully lit or
       fully dark depending on sweep direction);
     - the ellipse's sweep direction matches the half-circle's for a
       gibbous (illum>0.5, the ellipse "adds" area) and is opposite for a
       crescent (illum<0.5, the ellipse "subtracts" area).
     In the southern hemisphere the Moon appears flipped relative to the
     northern hemisphere: the sweep direction is flipped accordingly. */
  function moonIconSvg(illum, waxing, southernHemisphere) {
    const R = 46, C = 50;
    const rx = Math.max(0, R * Math.abs(1 - 2 * illum));
    let sweep1 = waxing ? 1 : 0;
    if (southernHemisphere) sweep1 = 1 - sweep1;
    const sweep2 = illum > 0.5 ? sweep1 : 1 - sweep1;
    const path = `M ${C} ${C - R} A ${R} ${R} 0 0 ${sweep1} ${C} ${C + R} A ${rx} ${R} 0 0 ${sweep2} ${C} ${C - R} Z`;
    return `<svg viewBox="0 0 100 100">
      <circle cx="${C}" cy="${C}" r="${R}" class="pwa-moon-dark"/>
      <path d="${path}" class="pwa-moon-lit"/>
      <circle cx="${C}" cy="${C}" r="${R}" class="pwa-moon-ring" fill="none"/>
    </svg>`;
  }

  function fmtTime(iso, locale) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(iso, locale, i18n) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (sameDay) return i18n.t("astronomy.today");
    if (d.toDateString() === tomorrow.toDateString()) return i18n.t("astronomy.tomorrow");
    return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  }

  class AstronomyWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.coords = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 30);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async geocode(city) {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city)
        + "&language=" + (this.ctx.i18n.lang === "fr" ? "fr" : "en");
      const data = await fetch(url).then((r) => r.json());
      if (!data.results || !data.results.length) throw new Error("city not found");
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, elevation: r.elevation || 0, name: r.name };
    }

    async refresh() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      try {
        if (!this.coords) this.coords = await this.geocode(s.city || "Paris");
        const { lat, lon, elevation } = this.coords;

        const jobs = [];
        jobs.push(s.showMoonPhase !== false
          ? fetch("/api/astronomy/moon").then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] moon", e); return null; })
          : Promise.resolve(null));
        jobs.push(s.showPlanets !== false
          ? fetch(`/api/astronomy/planets?lat=${lat}&lon=${lon}&elevation=${elevation}&includeOuter=${s.includeOuterPlanets === true}`)
              .then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] planets", e); return null; })
          : Promise.resolve(null));
        jobs.push(s.showIss !== false ? this.loadIss(lat, lon, elevation) : Promise.resolve(null));
        jobs.push(s.showLaunches !== false
          ? fetch("/api/launches").then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] launches", e); return null; })
          : Promise.resolve(null));
        jobs.push(s.showEclipse !== false
          ? fetch(`/api/astronomy/eclipse?lat=${lat}&lon=${lon}&elevation=${elevation}`)
              .then((r) => r.json()).catch((e) => { console.warn("[piboard/astronomy] eclipse", e); return null; })
          : Promise.resolve(null));

        const [moon, planetsData, iss, launchData, eclipse] = await Promise.all(jobs);
        this.launchData = launchData && Array.isArray(launchData.upcoming) ? launchData : null;
        this.data = {
          moon,
          planets: planetsData && planetsData.planets ? planetsData.planets.filter((p) => p.aboveHorizon) : null,
          iss,
          eclipse: eclipse && !eclipse.error ? eclipse : null
        };
        this.render();
      } catch (e) {
        console.warn("[piboard/astronomy]", e);
        this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${i18n.t("astronomy.error")}</div></div>`;
      }
    }

    /* iss-api.polluxlabs.io : successeur communautaire gratuit et sans
       cle de l'ancienne API open-notify.org (dont les predictions de
       passage ont ferme). CORS active pour tous les domaines -- appel
       direct depuis le navigateur, sans passer par /api/proxy.
       Attention honnete : projet solo finance par des dons, meme risque
       de disparition qu'open-notify un jour -- c'est neanmoins la
       meilleure source actuellement disponible pour cette donnee (des
       elements orbitaux a jour, impossibles a calculer localement).
       iss-api.polluxlabs.io: free, keyless community successor to the
       old open-notify.org API (whose pass predictions shut down). CORS
       enabled for all origins -- called directly from the browser,
       without going through /api/proxy. Honest caveat: a solo,
       donation-funded project, same disappearance risk as open-notify
       one day -- still the best currently available source for this
       data (up-to-date orbital elements, impossible to compute
       locally). */
    async loadIss(lat, lon, elevation) {
      const s = this.ctx.settings;
      const n = Math.max(1, Math.min(10, Number(s.issMaxPasses) || 3));
      const params = new URLSearchParams({
        lat: lat.toFixed(4), lon: lon.toFixed(4), alt: Math.round(elevation),
        n: String(n), visible_only: s.issVisibleOnly !== false ? "true" : "false"
      });
      try {
        const res = await fetch("https://iss-api.polluxlabs.io/iss-pass?" + params.toString());
        if (!res.ok) throw new Error("iss-api status " + res.status);
        const data = await res.json();
        return data.passes || [];
      } catch (e) {
        console.warn("[piboard/astronomy] iss", e);
        return null; // distingue "echec" de "aucun passage" a l'affichage / tells "failure" apart from "no pass" at render time
      }
    }

    render() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const d = this.data;
      const sections = [];

      if (s.showMoonPhase !== false) sections.push(this.renderMoon(d.moon));
      if (s.showIss !== false) sections.push(this.renderIss(d.iss));
      if (s.showPlanets !== false) sections.push(this.renderPlanets(d.planets));
      if (s.showEclipse !== false) sections.push(this.renderEclipse(d.eclipse));
      if (s.showLaunches !== false) sections.push(this.renderLaunches());

      if (!sections.length) {
        this.ctx.el.innerHTML = `<div class="pw-astronomy"><div class="pwa-msg">${i18n.t("astronomy.nothingShown")}</div></div>`;
        return;
      }
      this.ctx.el.innerHTML = `<div class="pw-astronomy">${sections.join("")}</div>`;
      this.wireLaunches();
      this.armLaunchTimers();
    }

    /* ====================================================================
       LANCEMENTS SPATIAUX (1.177.0)
       Donnees servies par le serveur PiBoard (/api/launches, cache de
       Launch Library 2). Compte a rebours a la seconde dans la derniere
       heure, bouton « Regarder » vers la diffusion (YouTube surtout),
       fenetre de detail, alerte avant un lancement favori.
       ROCKET LAUNCHES: server-cached Launch Library 2 data, countdown,
       "Watch" button, detail window, alert before a favourite launch.
       ==================================================================== */
    words(v) {
      return String(v || "").split(/[,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    }
    matches(l, words) {
      const hay = [l.provider && l.provider.name, l.provider && l.provider.abbrev, l.rocket, l.name].join(" ").toLowerCase();
      return words.some((w) => hay.includes(w));
    }
    launchLists() {
      const s = this.ctx.settings;
      const d = this.launchData || { upcoming: [], previous: [] };
      const only = this.words(s.launchOperators);
      const keep = (l) => !only.length || this.matches(l, only);
      const now = Date.now();
      const upcoming = (d.upcoming || []).filter((l) => keep(l) && new Date(l.net).getTime() > now - 30 * 60000
        && !(l.status && /^(success|failure|partial failure)$/i.test(l.status.abbrev)));
      const days = Math.max(0, Number(s.launchPastDays != null ? s.launchPastDays : 3));
      const seen = new Set(upcoming.map((l) => l.id));
      const recent = days ? [...(d.previous || []), ...(d.upcoming || [])]
        .filter((l) => keep(l) && !seen.has(l.id) && l.status && /^(success|failure|partial failure)$/i.test(l.status.abbrev)
          && now - new Date(l.net).getTime() < days * 86400000)
        .filter((l, i, a) => a.findIndex((x) => x.id === l.id) === i)
        .sort((a, b) => new Date(b.net) - new Date(a.net)) : [];
      return { upcoming, recent };
    }
    statusClass(st) {
      const a = String(st && st.abbrev || "").toLowerCase();
      if (a === "go") return "go";
      if (a === "success") return "ok";
      if (/failure/.test(a)) return "ko";
      if (a === "hold" || a === "tbd") return "wait";
      if (a === "in flight") return "live";
      return "tbc";
    }
    tMinus(iso, fine) {
      const ms = new Date(iso).getTime() - Date.now();
      const neg = ms < 0;
      let sec = Math.floor(Math.abs(ms) / 1000);
      const d = Math.floor(sec / 86400); sec -= d * 86400;
      const h = Math.floor(sec / 3600); sec -= h * 3600;
      const m = Math.floor(sec / 60); sec -= m * 60;
      const pad = (n) => String(n).padStart(2, "0");
      const core = d > 0 ? `${d} j ${pad(h)} h ${pad(m)} min`.replace(" j ", this.ctx.i18n.lang === "en" ? "d " : " j ")
        : fine ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${h} h ${pad(m)} min`;
      return (neg ? "T+ " : "T− ") + core;
    }
    bestVideo(l) {
      const v = l.videos || [];
      return v.find((x) => x.live) || v.find((x) => x.youtube) || v[0] || null;
    }
    launchWhen(l) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      const day = fmtDay(l.net, locale, i18n);
      const prec = String(l.precision || "").toUpperCase();
      if (/^(MONTH|M|Q|Y|H1|H2|YEAR|QUARTER)/.test(prec) || /^(Q|H)\d/.test(prec)) {
        return new Date(l.net).toLocaleDateString(locale, { month: "long", year: "numeric" });
      }
      if (prec === "DAY" || prec === "D") return day;
      return day + " · " + fmtTime(l.net, locale);
    }

    renderLaunches() {
      const i18n = this.ctx.i18n;
      const t = (k) => i18n.t("astronomy.launch." + k);
      const s = this.ctx.settings;
      const title = `<div class="pwa-section-title">🚀 ${escapeHtml(t("title"))}</div>`;
      if (!this.launchData) return `<div class="pwa-section">${title}<div class="pwa-msg-inline">${escapeHtml(t("error"))}</div></div>`;
      const { upcoming, recent } = this.launchLists();
      this.launchIndex = new Map();
      const fav = this.words(s.launchFavorites);
      const n = Math.max(1, Math.min(10, Number(s.launchCount) || 3));
      const row = (l, past) => {
        this.launchIndex.set(l.id, l);
        const isFav = fav.length && this.matches(l, fav);
        const vid = this.bestVideo(l);
        const live = vid && vid.live;
        const st = l.status || {};
        const badge = `<span class="pwa-l-st pwa-l-${this.statusClass(st)}" title="${escapeHtml(st.name || "")}">${escapeHtml(t("st." + this.statusClass(st)))}</span>`;
        const watch = vid ? `<button type="button" class="pwa-l-watch${live ? " live" : ""}" data-watch="${escapeHtml(l.id)}" title="${escapeHtml(vid.title || vid.url)}">${live ? "● " + escapeHtml(t("live")) : past ? "▶ " + escapeHtml(t("replay")) : "▶ " + escapeHtml(t("watch"))}</button>` : "";
        const mission = l.mission && l.mission.name ? l.mission.name : (l.name.split("|")[1] || "").trim();
        return `<li class="pwa-l-item${isFav ? " fav" : ""}${past ? " past" : ""}" data-launch="${escapeHtml(l.id)}">
            <div class="pwa-l-top"><span class="pwa-l-when">${escapeHtml(this.launchWhen(l))}</span>${badge}</div>
            <div class="pwa-l-name">${isFav ? "★ " : ""}<b>${escapeHtml(l.rocket || l.name)}</b>${mission ? " · " + escapeHtml(mission) : ""}</div>
            <div class="pwa-l-sub"><span>${escapeHtml(l.provider.abbrev || l.provider.name || "")}${l.pad && l.pad.location ? " · " + escapeHtml(l.pad.location.split(",")[0]) : ""}</span>${past ? "" : `<span class="pwa-l-cd" data-net="${escapeHtml(l.net)}">${escapeHtml(this.tMinus(l.net))}</span>`}${watch}</div>
          </li>`;
      };
      const list = upcoming.slice(0, n).map((l) => row(l, false)).join("");
      const past = recent.length ? `<div class="pwa-l-subtitle">${escapeHtml(t("recent"))}</div><ul class="pwa-l-list">${recent.slice(0, n).map((l) => row(l, true)).join("")}</ul>` : "";
      const stale = this.launchData.stale ? `<div class="pwa-msg-inline">${escapeHtml(t("stale"))}</div>` : "";
      const body = list ? `<ul class="pwa-l-list">${list}</ul>` : `<div class="pwa-msg-inline">${escapeHtml(t("none"))}</div>`;
      return `<div class="pwa-section pwa-launches">${title}${stale}${body}${past}</div>`;
    }

    wireLaunches() {
      const root = this.ctx.el.querySelector(".pwa-launches");
      if (!root) return;
      root.addEventListener("click", (e) => {
        const w = e.target.closest("[data-watch]");
        if (w) { e.stopPropagation(); const l = this.launchIndex.get(w.dataset.watch); const v = l && this.bestVideo(l); if (v) this.openUrl(v.url, l.name); return; }
        const li = e.target.closest("[data-launch]");
        if (li) { e.stopPropagation(); const l = this.launchIndex.get(li.dataset.launch); if (l) this.openLaunch(l); }
      });
    }

    openUrl(url, title) {
      if (window.PiBoard && typeof window.PiBoard.openLink === "function") window.PiBoard.openLink(url, title);
      else window.open(url, "_blank", "noopener");
    }

    /* Compte a rebours : a la seconde dans la derniere heure, sinon chaque
       minute ; verifie aussi les alertes. Countdown: per second in the last
       hour, otherwise per minute; also checks alerts. */
    armLaunchTimers() {
      clearInterval(this.cdTimer);
      if (this.ctx.settings.showLaunches === false) return;
      const tick = () => {
        const els = this.ctx.el.querySelectorAll(".pwa-l-cd[data-net]");
        let fine = false;
        els.forEach((el) => {
          const ms = new Date(el.dataset.net).getTime() - Date.now();
          const f = ms < 3600000 && ms > -3600000;
          if (f) fine = true;
          el.textContent = this.tMinus(el.dataset.net, f);
          el.classList.toggle("soon", f);
        });
        this.checkLaunchAlerts();
        return fine;
      };
      const fine = tick();
      this.cdTimer = setInterval(tick, fine ? 1000 : 30000);
    }

    checkLaunchAlerts() {
      const s = this.ctx.settings;
      const min = Number(s.launchAlertMinutes) || 0;
      const fav = this.words(s.launchFavorites);
      if (!min || !fav.length || !this.launchData) return;
      this.alerted = this.alerted || new Set();
      const now = Date.now();
      const { upcoming } = this.launchLists();
      for (const l of upcoming) {
        if (!this.matches(l, fav)) continue;
        const ms = new Date(l.net).getTime() - now;
        if (ms <= 0 || ms > min * 60000) continue;
        if (l.status && /^(tbd|hold)$/i.test(l.status.abbrev)) continue;
        const id = "launch:" + l.id + ":" + l.net;
        if (this.alerted.has(id)) continue;
        this.alerted.add(id);
        this.fireLaunchAlert(l, id);
      }
    }

    async fireLaunchAlert(l, id) {
      const s = this.ctx.settings;
      const t = (k) => this.ctx.i18n.t("astronomy.launch." + k);
      if (s.launchAlertFlash !== false && this.ctx.api && this.ctx.api.startAlert) {
        this.ctx.api.startAlert({ flash: true, soundName: "beep-double", durationMs: 15000 });
      }
      this.showLaunchBanner(l);
      if (s.launchAlertPhone && window.PiBoard && window.PiBoard.notifyPhone) {
        try {
          const r = await fetch("/api/launches/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
          const out = await r.json();
          if (!out.granted || !out.granted.includes(id)) return;
        } catch (e) { return; }
        const v = this.bestVideo(l);
        const mins = Math.max(1, Math.round((new Date(l.net).getTime() - Date.now()) / 60000));
        const text = t("alertText").replace("{name}", l.name).replace("{n}", String(mins)) + (v ? "\n" + v.url : "");
        window.PiBoard.notifyPhone({ title: "🚀 " + l.name, url: v ? v.url : (l.infoUrl || ""), source: l.provider.name, text });
      }
    }

    showLaunchBanner(l) {
      const root = this.ctx.el.querySelector(".pwa-launches");
      if (!root) return;
      const t = (k) => this.ctx.i18n.t("astronomy.launch." + k);
      const old = root.querySelector(".pwa-l-banner"); if (old) old.remove();
      const b = document.createElement("div");
      b.className = "pwa-l-banner";
      const v = this.bestVideo(l);
      b.innerHTML = `🚀 ${escapeHtml(t("soon").replace("{name}", l.rocket || l.name))}${v ? ` <button type="button" class="pwa-l-watch live" data-watch="${escapeHtml(l.id)}">▶ ${escapeHtml(t("watch"))}</button>` : ""}`;
      root.insertBefore(b, root.children[1] || null);
    }

    /* Fenetre de detail, posee sur <body>. Detail window on <body>. */
    openLaunch(l) {
      this.closeLaunch();
      const i18n = this.ctx.i18n;
      const t = (k) => i18n.t("astronomy.launch." + k);
      const locale = i18n.t("clock.date.format");
      const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
      const row = (k, v) => v ? `<tr><td>${escapeHtml(t(k))}</td><td>${v}</td></tr>` : "";
      const m = l.mission || {};
      const st = l.status || {};
      const win = l.windowStart && l.windowEnd && l.windowStart !== l.windowEnd ? escapeHtml(fmt(l.windowStart) + " → " + fmt(l.windowEnd)) : "";
      const vids = (l.videos || []).map((v) => `<button type="button" class="pwa-l-vid" data-url="${escapeHtml(v.url)}">${v.live ? "● " : "▶ "}${escapeHtml(v.publisher || v.source || "")}${v.lang ? " (" + escapeHtml(v.lang) + ")" : ""}<small>${escapeHtml(v.title || v.url)}</small></button>`).join("");
      const back = document.createElement("div");
      back.className = "pwa-l-back";
      back.innerHTML = `<div class="pwa-l-win" role="dialog" aria-modal="true" aria-label="${escapeHtml(l.name)}">
          <div class="pwa-l-whead"><b>${escapeHtml(l.name)}</b><button type="button" class="pwa-l-x" aria-label="${escapeHtml(i18n.t("common.close"))}">✕</button></div>
          ${l.image ? `<img class="pwa-l-img" src="${escapeHtml(l.image)}" alt="">` : ""}
          <table class="pwa-l-tbl">
            ${row("date", escapeHtml(fmt(l.net)) + (l.precision && !/^(SEC|MIN|S|M)$/i.test(l.precision) ? " <i>(" + escapeHtml(t("approx")) + ")</i>" : ""))}
            ${row("window", win)}
            ${row("status", `<span class="pwa-l-st pwa-l-${this.statusClass(st)}">${escapeHtml(st.name || "")}</span>`)}
            ${row("reason", escapeHtml(l.holdreason || l.failreason || ""))}
            ${row("rocket", escapeHtml(l.rocket))}
            ${row("provider", escapeHtml(l.provider.name))}
            ${row("mission", escapeHtml([m.name, m.type].filter(Boolean).join(" · ")))}
            ${row("orbit", escapeHtml(m.orbitName || m.orbit || ""))}
            ${row("customers", escapeHtml((m.customers || []).join(", ")))}
            ${row("pad", escapeHtml([l.pad.name, l.pad.location].filter(Boolean).join(" · ")))}
            ${row("weather", l.probability != null ? escapeHtml(l.probability + " %" + (l.weather ? " · " + l.weather : "")) : escapeHtml(l.weather || ""))}
          </table>
          ${m.description ? `<p class="pwa-l-desc">${escapeHtml(m.description)}</p>` : ""}
          ${vids ? `<div class="pwa-l-subtitle">${escapeHtml(t("webcasts"))}</div><div class="pwa-l-vids">${vids}</div>` : `<div class="pwa-msg-inline">${escapeHtml(t("noWebcast"))}</div>`}
          ${(l.updates || []).length ? `<div class="pwa-l-subtitle">${escapeHtml(t("updates"))}</div><ul class="pwa-l-upd">${l.updates.map((u) => `<li><span>${escapeHtml(fmt(u.at))}</span> ${escapeHtml(u.text)}</li>`).join("")}</ul>` : ""}
          ${l.infoUrl ? `<p><button type="button" class="pwa-l-vid pwa-l-info" data-url="${escapeHtml(l.infoUrl)}">ℹ ${escapeHtml(t("info"))}</button></p>` : ""}
          <p class="pwa-l-credit">${escapeHtml(t("credit"))}</p>
        </div>`;
      document.body.appendChild(back);
      this.launchWin = back;
      const win2 = back.querySelector(".pwa-l-win");
      ["pointerdown", "pointerup", "click", "contextmenu"].forEach((ty) => win2.addEventListener(ty, (e) => e.stopPropagation()));
      back.addEventListener("click", (e) => { if (e.target === back) this.closeLaunch(); });
      back.querySelector(".pwa-l-x").addEventListener("click", () => this.closeLaunch());
      back.querySelectorAll("[data-url]").forEach((b) => b.addEventListener("click", () => this.openUrl(b.dataset.url, l.name)));
      this.launchKey = (e) => { if (e.key === "Escape") this.closeLaunch(); };
      document.addEventListener("keydown", this.launchKey);
    }

    closeLaunch() {
      if (this.launchWin) { this.launchWin.remove(); this.launchWin = null; }
      if (this.launchKey) { document.removeEventListener("keydown", this.launchKey); this.launchKey = null; }
    }

    renderMoon(moon) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      if (!moon) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.moonTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.error")}</div></div>`;
      }
      const southern = this.coords && this.coords.lat < 0;
      const icon = moonIconSvg(moon.illumination, moon.waxing, southern);
      const pct = Math.round(moon.illumination * 100);
      return `
        <div class="pwa-section pwa-moon-section">
          <div class="pwa-section-title">${i18n.t("astronomy.moonTitle")}</div>
          <div class="pwa-moon-row">
            <div class="pwa-moon-icon">${icon}</div>
            <div class="pwa-moon-info">
              <div class="pwa-moon-phase">${i18n.t("astronomy.phase." + moon.phaseKey)}</div>
              <div class="pwa-moon-pct">${pct}% ${i18n.t("astronomy.illuminated")}</div>
              <div class="pwa-moon-next">🌑 ${i18n.t("astronomy.nextNew")} ${fmtDay(moon.nextNewMoon, locale, i18n)}</div>
              <div class="pwa-moon-next">🌕 ${i18n.t("astronomy.nextFull")} ${fmtDay(moon.nextFullMoon, locale, i18n)}</div>
            </div>
          </div>
        </div>`;
    }

    renderIss(passes) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      let body;
      if (passes === null) {
        body = `<div class="pwa-msg-inline">${i18n.t("astronomy.issError")}</div>`;
      } else if (!passes.length) {
        body = `<div class="pwa-msg-inline">${i18n.t(this.ctx.settings.issVisibleOnly !== false ? "astronomy.issNoneVisible" : "astronomy.issNone")}</div>`;
      } else {
        body = `<ul class="pwa-iss-list">${passes.map((p) => `
          <li class="pwa-iss-item ${p.visible ? "pwa-iss-visible" : ""}">
            <div class="pwa-iss-when">${fmtDay(p.rise.time, locale, i18n)} · ${fmtTime(p.rise.time, locale)}</div>
            <div class="pwa-iss-detail">
              <span>${escapeHtml(p.rise.compass)} → ${escapeHtml(p.set.compass)}</span>
              <span>${Math.round(p.duration_sec / 60)} ${i18n.t("astronomy.min")}</span>
              <span>${Math.round(p.culmination.elevation_deg)}°</span>
            </div>
          </li>`).join("")}</ul>`;
      }
      return `
        <div class="pwa-section">
          <div class="pwa-section-title">🛰 ${i18n.t("astronomy.issTitle")}</div>
          ${body}
        </div>`;
    }

    renderPlanets(planets) {
      const i18n = this.ctx.i18n;
      if (!planets) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.error")}</div></div>`;
      }
      if (!planets.length) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.planetsNone")}</div></div>`;
      }
      // La plus haute dans le ciel d'abord : la plus facile a reperer.
      // Highest in the sky first: the easiest one to spot.
      const sorted = [...planets].sort((a, b) => b.altitude - a.altitude);
      const rows = sorted.map((p) => `
        <li class="pwa-planet-item">
          <span class="pwa-planet-name">${i18n.t("astronomy.planet." + p.name.toLowerCase())}</span>
          <span class="pwa-planet-dir">${escapeHtml(p.compass)} · ${Math.round(p.altitude)}°</span>
          <span class="pwa-planet-mag">${p.magnitude.toFixed(1)}</span>
        </li>`).join("");
      return `
        <div class="pwa-section">
          <div class="pwa-section-title">${i18n.t("astronomy.planetsTitle")}</div>
          <ul class="pwa-planet-list">${rows}</ul>
        </div>`;
    }

    /* Compte a rebours compact avant un instant donne : en jours quand
       c'est encore lointain, en heures le jour meme -- calcule a chaque
       rendu, donc reste a jour au rythme du rafraichissement normal de
       la tuile (une eclipse se compte en jours, pas besoin d'un
       minuteur dedie plus rapide).
       Compact countdown until a given moment: in days while still far
       off, in hours on the day itself -- computed on every render, so it
       stays current at the tile's normal refresh pace (an eclipse is
       counted in days, no need for a dedicated faster timer). */
    countdownText(iso) {
      const i18n = this.ctx.i18n;
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return i18n.t("astronomy.now");
      const hours = ms / 3600000;
      if (hours < 24) return i18n.t("astronomy.inHours").replace("{n}", Math.max(1, Math.round(hours)));
      return i18n.t("astronomy.inDays").replace("{n}", Math.round(hours / 24));
    }

    renderEclipse(eclipse) {
      const i18n = this.ctx.i18n;
      const locale = i18n.t("clock.date.format");
      if (!eclipse) {
        return `<div class="pwa-section"><div class="pwa-section-title">${i18n.t("astronomy.eclipseTitle")}</div><div class="pwa-msg-inline">${i18n.t("astronomy.error")}</div></div>`;
      }
      const icon = eclipse.type === "solar" ? "☀️" : "🌕";
      const kindLabel = i18n.t(`astronomy.eclipseKind.${eclipse.type}.${eclipse.kind}`);
      const pct = Math.round(eclipse.obscuration * 100);
      return `
        <div class="pwa-section">
          <div class="pwa-section-title">${i18n.t("astronomy.eclipseTitle")}</div>
          <div class="pwa-eclipse-row">
            <span class="pwa-eclipse-icon">${icon}</span>
            <div class="pwa-eclipse-info">
              <div class="pwa-eclipse-kind">${kindLabel}</div>
              <div class="pwa-eclipse-when">${fmtDay(eclipse.peakTime, locale, i18n)} · ${fmtTime(eclipse.peakTime, locale)} · ${pct}%</div>
              <div class="pwa-eclipse-countdown">${this.countdownText(eclipse.peakTime)}</div>
            </div>
          </div>
        </div>`;
    }

    destroy() {
      clearInterval(this.cdTimer);
      this.closeLaunch();
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("astronomy", AstronomyWidget);
})();
