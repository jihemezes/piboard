/* PiBoard widget: sportscore / scores sportifs en direct
   Utilise l'API JSON non officielle mais publique d'ESPN (aucune cle,
   aucune inscription). Interface non documentee : en cas de panne ou de
   changement, la tuile affiche simplement un message d'indisponibilite.
   Uses ESPN's unofficial but public JSON API (no key, no signup required).
   Undocumented interface: if it breaks or changes, the tile simply shows
   an unavailable message. */
(function () {
  "use strict";

  /* Le moteur (choix et mise en ordre des matchs) est un module pur,
     teste hors ligne. Charge via ctx.assetUrl : il porte alors le
     numero de version, sans quoi le kiosque pourrait en servir une
     ancienne copie depuis son cache.
     The engine (picking and ordering matches) is a pure, offline-tested
     module, loaded through ctx.assetUrl so it carries the version. */
  let enginePromise = null;
  function loadEngine(ctx) {
    if (window.PiBoardSportEngine) return Promise.resolve(window.PiBoardSportEngine);
    if (enginePromise) return enginePromise;
    const src = typeof ctx.assetUrl === "function"
      ? ctx.assetUrl("engine.js")
      : "widgets/" + ctx.manifest.dir + "/engine.js";
    enginePromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        if (window.PiBoardSportEngine) resolve(window.PiBoardSportEngine);
        else reject(new Error("engine.js charge mais vide / loaded but empty"));
      };
      s.onerror = () => reject(new Error("engine.js introuvable / not found (" + src + ")"));
      document.head.appendChild(s);
    });
    return enginePromise;
  }

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
      try { this.engine = await loadEngine(this.ctx); }
      catch (e) {
        console.warn("[piboard/sportscore]", e);
        this.ctx.el.innerHTML = `<div class="pw-sport"><div class="pws-err">${this.ctx.i18n.t("sport.error")}</div></div>`;
        return;
      }
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
        // Sans fenetre de dates, ESPN ne renvoie qu'UNE journee, la
        // sienne (fuseau americain) : un match joue hier soir en France
        // disparaissait du tableau alors que son score venait d'etre
        // publie. On demande donc explicitement les jours autour
        // d'aujourd'hui (1.113.4).
        // Without a date window ESPN returns only its OWN single day.
        const now = new Date();
        const win = this.engine.dateWindow(now, 2, 7);
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${win}`;
        // « no-store » + horodatage : l'URL etant identique d'un
        // rafraichissement a l'autre, le cache du kiosque pouvait servir
        // la reponse de la veille -- l'heure de coup d'envoi restait
        // alors affichee bien apres la fin du match (1.113.4).
        // no-store + timestamp: the URL being identical between
        // refreshes, the kiosk cache could serve yesterday's answer.
        const data = await fetch(this.ctx.api.proxyUrl(url) + "&_=" + Date.now(), {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        }).then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });

        const events = this.engine.pick(data.events || [], {
          now,
          filter: s.teamFilter,
          max: Number(s.maxItems) || 5
        });

        if (!events.length) {
          el.innerHTML = `<div class="pw-sport"><div class="pws-empty">${this.ctx.i18n.t("sport.empty")}</div></div>`;
          return;
        }

        const rows = events.map((ev) => {
          const comp = ev.competitions[0];
          const state = ev.status.type.state; // pre | in | post
          // Celui qui RECOIT en haut, celui qui se DEPLACE en bas.
          // Host on top, visitor below.
          const { home, away } = this.engine.orderCompetitors(comp);
          if (!home || !away) return "";
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
