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


  /* ============================================================
     Ligue Nationale de Rugby (LNR) -- source du TOP 14 et de la PRO D2

     POURQUOI. ESPN a cesse de publier correctement ces competitions :
     son tableau ignore purement et simplement le parametre de dates (il
     renvoie toujours SA journee, calee sur le fuseau americain), et sa
     liste d'equipes est en retard d'une saison -- le RC Vannes n'y
     figure meme pas. Resultat : le match de la veille au soir
     disparaissait sans jamais avoir affiche son score, et celui du soir
     meme n'apparaissait qu'en milieu de journee (1.114.0). La tuile
     Classement lit deja la LNR pour la meme raison depuis la 1.96.2.

     COMMENT. Le site ne propose pas d'API, mais ecrit le calendrier
     directement dans le HTML servi par le serveur : aucun JavaScript a
     executer, une seule requete. La page affiche d'office la journee en
     cours, samedi et dimanche compris -- exactement la fenetre utile.

     Why: ESPN ignores its own date parameter for rugby and its Top 14
     squad list is a season behind. How: the LNR writes the fixture list
     straight into the served HTML, and the page defaults to the current
     round.
     ============================================================ */

  const LNR_SITES = {
    "lnr.top14": { url: "https://top14.lnr.fr/calendrier-et-resultats", name: "TOP 14" },
    "lnr.prod2": { url: "https://prod2.lnr.fr/calendrier-et-resultats", name: "PRO D2" }
  };

  const FR_MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

  function noAccent(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function textOf(node) {
    return (node && node.textContent ? node.textContent : "").replace(/\s+/g, " ").trim();
  }

  /* « samedi 19 septembre » -> jour et mois. L'annee n'est pas ecrite sur
     la page : une saison de rugby est a cheval sur deux annees civiles,
     on retient donc celle qui place la date au plus pres d'aujourd'hui.
     The year is not printed on the page: a rugby season straddles two
     calendar years, so the year closest to today wins. */
  function lnrDayDate(label, now) {
    const t = noAccent(label);
    const m = t.match(/(\d{1,2})\s+([a-z]+)/);
    if (!m) return null;
    const month = FR_MONTHS.indexOf(m[2]);
    if (month < 0) return null;
    const day = Number(m[1]);
    const ref = now || new Date();
    let best = null;
    for (const y of [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]) {
      const d = new Date(y, month, day, 0, 0, 0, 0);
      if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d;
    }
    return best;
  }

  /* « 21h05 » -> heures et minutes posees sur la date du jour. */
  function lnrApplyTime(date, label) {
    const m = String(label || "").match(/(\d{1,2})\s*[h:]\s*(\d{2})/);
    if (!m) return date;
    const d = new Date(date.getTime());
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }

  /* « 23 - 29 » -> les deux scores, celui qui recoit d'abord. */
  function lnrScores(label) {
    const m = String(label || "").match(/(\d+)\s*[-–]\s*(\d+)/);
    return m ? { home: m[1], away: m[2] } : null;
  }

  /* Lit la page de la LNR et rend des matchs AU FORMAT D'ESPN, pour que
     tout le reste de la tuile (filtre, mise en ordre, affichage) reste
     inchange -- un adaptateur, pas une seconde tuile.
     Reads the LNR page and returns matches IN ESPN'S SHAPE, so the rest
     of the tile is untouched: an adapter, not a second tile. */
  function parseLnrMatches(html, now) {
    const Parser = typeof DOMParser !== "undefined" ? DOMParser : null;
    if (!Parser) return null;
    const doc = new Parser().parseFromString(html, "text/html");
    const inner = doc.querySelector(".calendar-results__inner");
    if (!inner) return null;

    const events = [];
    let day = null;
    for (const node of Array.from(inner.children)) {
      const cls = String(node.className || "");
      if (cls.indexOf("fixture-date") >= 0) { day = lnrDayDate(textOf(node), now); continue; }
      if (cls.indexOf("calendar-results__line") < 0 || !day) continue;

      const clubs = node.querySelectorAll(".club-line");
      if (clubs.length < 2) continue;
      /* Le club qui RECOIT est ecrit en premier (le site le marque
         « club-line--reversed » parce qu'il l'affiche logo a droite).
         The HOST club comes first. */
      const nameOf = (c) => textOf(c.querySelector(".club-line__name"));
      const rankOf = (c) => {
        const r = textOf(c.querySelector(".club-line__rank")).match(/\d+/);
        return r ? Number(r[0]) : null;
      };
      const home = clubs[0], away = clubs[1];
      if (!nameOf(home) || !nameOf(away)) continue;

      const scoreNode = node.querySelector(".match-line__score");
      const timeNode = node.querySelector(".match-line__time");
      const score = lnrScores(textOf(scoreNode));
      /* Le site ne distingue pas un match en cours : un score affiche
         vaut match joue. Si la LNR ajoute un jour un marqueur de direct,
         c'est ici qu'il se branchera.
         The site does not mark a match in progress: a shown score means
         played. */
      const state = score ? "post" : "pre";
      const when = lnrApplyTime(day, textOf(timeNode));

      events.push({
        date: when.toISOString(),
        status: { type: { state, shortDetail: score ? "" : textOf(timeNode) } },
        competitions: [{ competitors: [
          { homeAway: "home", score: score ? score.home : "", team: { displayName: nameOf(home), rank: rankOf(home) } },
          { homeAway: "away", score: score ? score.away : "", team: { displayName: nameOf(away), rank: rankOf(away) } }
        ] }]
      });
    }
    return events;
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
      try {
        // Format "sport:ligue" (ex. "rugby:270559"). Retro-compatibilite :
        // une ancienne valeur sans ":" est un slug de football.
        // "sport:league" format (e.g. "rugby:270559"). Backward compat:
        // an old value without ":" is a soccer slug.
        const raw = (s.customLeague || "").trim() || s.league || "soccer:fifa.world";
        const [sport, league] = raw.includes(":") ? raw.split(":") : ["soccer", raw];
        const now = new Date();

        /* Rugby francais : on passe par la LNR. « rugby:270559 » est
           l'ancien code ESPN -- les tuiles deja posees basculent donc
           toutes seules sur la bonne source, sans rien a rerregler.
           French rugby goes through the LNR; the old ESPN code is
           redirected so existing tiles fix themselves. */
        const lnrKey = league === "270559" ? "lnr.top14" : league;
        if (sport === "rugby" && LNR_SITES[lnrKey]) {
          const html = await this.fetchText(LNR_SITES[lnrKey].url);
          const parsed = parseLnrMatches(html, now);
          if (!parsed || !parsed.length) throw new Error("lnr : aucun match trouve dans la page");
          return this.render(this.engine.pick(parsed, { now, filter: s.teamFilter, max: Number(s.maxItems) || 5 }), now);
        }
        // Sans fenetre de dates, ESPN ne renvoie qu'UNE journee, la
        // sienne (fuseau americain) : un match joue hier soir en France
        // disparaissait du tableau alors que son score venait d'etre
        // publie. On demande donc explicitement les jours autour
        // d'aujourd'hui (1.113.4).
        // Without a date window ESPN returns only its OWN single day.
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

        this.render(events, now);
      } catch (e) {
        console.warn("[piboard/sportscore]", e);
        el.innerHTML = `<div class="pw-sport"><div class="pws-err">${this.ctx.i18n.t("sport.error")}</div></div>`;
      }
    }


    /* Requete texte passant par le proxy de PiBoard (le site de la LNR
       ne repond pas au navigateur directement) et jamais mise en cache.
       Text request through PiBoard's proxy, never cached. */
    async fetchText(url) {
      const res = await fetch(this.ctx.api.proxyUrl(url) + "&_=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!res.ok) throw new Error("status " + res.status);
      return res.text();
    }

    /* Affichage commun aux deux sources : les matchs arrivent toujours
       au format d'ESPN. Shared rendering: matches always arrive in
       ESPN's shape. */
    render(events, now) {
      const el = this.ctx.el;
      const lang = this.ctx.i18n.lang;
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

  /* Exposition des fonctions pures pour test/lnrCalendar.test.js : le
     navigateur n'a pas de module system ici.
     Pure functions exposed for the Node tests. */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseLnrMatches, lnrDayDate, lnrApplyTime, lnrScores, LNR_SITES };
  } else {
    window.PiBoard.registerWidget("sportscore", SportScoreWidget);
  }
})();
