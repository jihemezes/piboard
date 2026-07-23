/* PiBoard widget: sportscore / scores sportifs en direct
   Utilise l'API JSON non officielle mais publique d'ESPN (aucune cle,
   aucune inscription). Interface non documentee : en cas de panne ou de
   changement, la tuile affiche simplement un message d'indisponibilite.
   Uses ESPN's unofficial but public JSON API (no key, no signup required).
   Undocumented interface: if it breaks or changes, the tile simply shows
   an unavailable message. */
(function () {
  "use strict";

  function localTime(iso, lang) {
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  class SportScoreWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-sport"><div class="pws-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(1, Number(this.ctx.settings.refresh) || 2);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang;
      try {
        // Format "sport:ligue" (ex. "rugby:270559"). Retro-compatibilite :
        // une ancienne valeur sans ":" est un slug de football.
        // "sport:league" format (e.g. "rugby:270559"). Backward compat:
        // an old value without ":" is a soccer slug.
        const raw = (s.customLeague || "").trim() || s.league || "soccer:fifa.world";
        const [sport, league] = raw.includes(":") ? raw.split(":") : ["soccer", raw];
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
        const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });

        let events = data.events || [];
        const filter = (s.teamFilter || "").trim().toLowerCase();
        if (filter) {
          events = events.filter((ev) =>
            (ev.competitions[0].competitors || []).some((c) =>
              (c.team.displayName || "").toLowerCase().includes(filter)));
        }
        events = events.slice(0, Math.max(1, Number(s.maxItems) || 5));

        if (!events.length) {
          el.innerHTML = `<div class="pw-sport"><div class="pws-empty">${this.ctx.i18n.t("sport.empty")}</div></div>`;
          return;
        }

        const rows = events.map((ev) => {
          const comp = ev.competitions[0];
          const state = ev.status.type.state; // pre | in | post
          const home = comp.competitors.find((c) => c.homeAway === "home");
          const away = comp.competitors.find((c) => c.homeAway === "away");
          const showScore = state !== "pre";
          const homeWin = state === "post" && Number(home.score) > Number(away.score);
          const awayWin = state === "post" && Number(away.score) > Number(home.score);

          let statusHtml;
          if (state === "in") {
            statusHtml = `<span class="pws-live">${ev.status.type.shortDetail || this.ctx.i18n.t("sport.live")}</span>`;
          } else if (state === "post") {
            statusHtml = this.ctx.i18n.t("sport.final");
          } else {
            statusHtml = localTime(ev.date, lang);
          }

          return `
            <li>
              <div class="pws-teams">
                <div class="pws-team">
                  <span class="pws-team-name${homeWin ? " pws-winner" : ""}">${home.team.displayName}</span>
                  ${showScore ? `<span class="pws-score">${home.score}</span>` : ""}
                </div>
                <div class="pws-team">
                  <span class="pws-team-name${awayWin ? " pws-winner" : ""}">${away.team.displayName}</span>
                  ${showScore ? `<span class="pws-score">${away.score}</span>` : ""}
                </div>
              </div>
              <div class="pws-status">${statusHtml}</div>
            </li>`;
        }).join("");

        el.innerHTML = `<div class="pw-sport"><ul>${rows}</ul></div>`;
      } catch (e) {
        console.warn("[piboard/sportscore]", e);
        el.innerHTML = `<div class="pw-sport"><div class="pws-err">${this.ctx.i18n.t("sport.error")}</div></div>`;
      }
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("sportscore", SportScoreWidget);
})();
