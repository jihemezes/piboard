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

  // Format jj/mm fixe, independant de la langue -- demande explicitement
  // dans ce format par l'utilisateur, plutot que de suivre l'ordre
  // jour/mois habituel de la locale (qui inverserait en jj/mm vs mm/jj
  // selon la langue de l'interface).
  // Fixed DD/MM format, independent of language -- explicitly requested
  // in this format by the user, rather than following the locale's
  // usual day/month order (which would flip between DD/MM and MM/DD
  // depending on the interface language).
  function dateDDMM(iso) {
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function isSameDay(iso, ref) {
    const d = new Date(iso);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  }

  class SportScoreWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.blinkTimer = null;
      this.showingDate = false; // etat courant de l'alternance heure/date
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-sport"><div class="pws-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
      clearInterval(this.blinkTimer);
      // Alternance heure/date pour les matchs a venir qui ne sont pas
      // aujourd'hui (voir refresh()) : un simple bascule d'affichage,
      // independant du cycle de rafraichissement des donnees.
      // Time/date alternation for upcoming matches that aren't today
      // (see refresh()): a simple display toggle, independent from the
      // data refresh cycle.
      this.blinkTimer = setInterval(() => this.toggleDateBlink(), 3000);
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

        const now = new Date();
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
          } else if (isSameDay(ev.date, now)) {
            statusHtml = localTime(ev.date, lang);
          } else {
            // Match a venir un autre jour : alterne heure et date (jj/mm)
            // via toggleDateBlink(), plutot que d'afficher les deux a la
            // fois ou de ne montrer que l'heure (ambigu sans le jour).
            // Upcoming match on another day: alternates time and date
            // (DD/MM) via toggleDateBlink(), rather than showing both at
            // once or only the time (ambiguous without the day).
            statusHtml = `<span class="pws-status-time">${localTime(ev.date, lang)}</span>`
              + `<span class="pws-status-date" hidden>${dateDDMM(ev.date)}</span>`;
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

    toggleDateBlink() {
      this.showingDate = !this.showingDate;
      const el = this.ctx.el;
      el.querySelectorAll(".pws-status-time").forEach((n) => { n.hidden = this.showingDate; });
      el.querySelectorAll(".pws-status-date").forEach((n) => { n.hidden = !this.showingDate; });
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.blinkTimer);
    }
  }

  window.PiBoard.registerWidget("sportscore", SportScoreWidget);
})();
