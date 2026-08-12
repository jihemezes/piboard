/* PiBoard widget: teleprog / programme TV
   Programme TV francais simplifie. Interroge /api/tele-program (voir
   server/teleProgram.js) qui fournit, pour une liste de chaines et une
   vue donnee (en cours / 1re partie de soiree / 2e partie), le
   programme correspondant sur chaque chaine. Trois onglets sur la tuile
   permettent de basculer de vue sans passer par la configuration. Un
   clic sur une emission ouvre son synopsis. Une pastille "inedit"
   apparait quand la source fournit l'information (jamais sinon). Une
   vignette est affichee quand la source en fournit une, sinon un
   placeholder.

   Recherche, favoris, barre de progression et rappels (voir plus bas)
   sont tous purement cote client : ils filtrent/annotent les lignes
   deja recuperees par /api/tele-program, sans requete serveur
   supplementaire -- sauf le declenchement d'un rappel, qui reutilise
   l'alerte de tableau partagee (ctx.api.startAlert/stopAlert, la meme
   que la tuile Compte a rebours) et son webhook optionnel
   (ctx.api.notify), sans dupliquer cette mecanique.

   Simplified French TV guide. Queries /api/tele-program (see
   server/teleProgram.js) which returns, for a list of channels and a
   given view (now / prime time / late night), the matching program on
   each channel. Three tabs on the tile switch views without going
   through settings. Tapping a program opens its synopsis. A "new" badge
   appears when the source provides the info (never otherwise). A
   thumbnail is shown when the source provides one, otherwise a
   placeholder.

   Search, favorites, the progress bar and reminders (see below) are
   all purely client-side: they filter/annotate the rows already
   fetched by /api/tele-program, no extra server request -- except
   firing a reminder, which reuses the shared board alert
   (ctx.api.startAlert/stopAlert, the same one the Countdown tile uses)
   and its optional webhook (ctx.api.notify), without duplicating that
   mechanism. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Normalisation pour la recherche : insensible a la casse ET aux
     accents ("ce soir" doit trouver "Émission" comme "emission"),
     puisque le clavier virtuel AZERTY/QWERTY du tableau ne facilite pas
     toujours la frappe d'accents.
     Normalization for search: case- AND accent-insensitive ("ce soir"
     should find "Émission" just like "emission"), since the board's
     virtual AZERTY/QWERTY keyboard doesn't always make accented typing
     easy. */
  function normalize(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* Cle stable identifiant UNE diffusion precise (pas juste une
     emission) : chaine + heure de debut. Utilisee a la fois pour les
     favoris (par chaine -- pas besoin de l'heure) et les rappels (par
     diffusion -- l'heure de debut fait partie de l'identite du rappel).
     Stable key identifying ONE specific broadcast (not just a show):
     channel + start time. Used both for favorites (per channel -- no
     need for the time) and reminders (per broadcast -- the start time
     is part of the reminder's identity). */
  function reminderKey(channelId, startIso) {
    return channelId + "|" + (startIso || "");
  }

  const VIEWS = ["now", "evening", "late"];

  /* Calcule, en millisecondes, le delai avant le prochain
     rafraichissement de la vue "En ce moment" : juste apres la fin
     annoncee du programme qui se termine le plus tot parmi les lignes
     affichees (+ marge), borne par [minDelayMs, ceilingMs]. Fonction
     pure (aucun acces DOM/reseau/horloge globale), separee de
     armNow() pour rester testable independamment des timers reels --
     meme principe que _computePhase sur le widget trafic.
     Computes, in milliseconds, the delay before the next "On now"
     refresh: right after the announced end of the soonest-ending
     program among the displayed rows (+ margin), clamped to
     [minDelayMs, ceilingMs]. Pure function (no DOM/network/global
     clock access), kept separate from armNow() to stay testable
     independently of real timers -- same idea as the traffic widget's
     _computePhase. */
  function computeNowRefreshDelay(rows, nowMs, opts) {
    const o = opts || {};
    const marginMs = o.marginMs != null ? o.marginMs : 20000;
    const minDelayMs = o.minDelayMs != null ? o.minDelayMs : 60000;
    const ceilingMs = o.ceilingMs != null ? o.ceilingMs : 5 * 60000;

    const stops = (rows || [])
      .map((r) => (r.program && r.program.stop) ? new Date(r.program.stop).getTime() : null)
      .filter((t) => t != null && t > nowMs);

    let delay = ceilingMs;
    if (stops.length) delay = Math.min(...stops) - nowMs + marginMs;
    return Math.min(Math.max(delay, minDelayMs), ceilingMs);
  }

  /* Progression (0-100) d'une diffusion en cours, ou null si elle n'est
     pas actuellement a l'antenne (pas encore commencee, deja finie, ou
     heures manquantes). Fonction pure, testee isolement.
     Progress (0-100) of a currently airing broadcast, or null if it's
     not actually on air right now (not started yet, already over, or
     missing times). Pure function, tested in isolation. */
  function computeAiringProgress(program, nowMs) {
    if (!program || !program.start || !program.stop) return null;
    const start = new Date(program.start).getTime();
    const stop = new Date(program.stop).getTime();
    if (!(start < stop) || nowMs < start || nowMs >= stop) return null;
    return Math.min(100, Math.max(0, ((nowMs - start) / (stop - start)) * 100));
  }

  class TeleProgWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;         // minuteur des vues "ce soir" / "2e partie" (intervalle fixe)
      this.nowTimer = null;      // minuteur dedie a la vue "maintenant" (reprogramme au changement de programme)
      this.progressTimer = null; // rafraichit juste la barre de progression, sans re-requeter le serveur
      this.loading = false;
      this.data = null;          // derniere reponse /api/tele-program
      this.error = null;
      this.selected = null;      // index de chaine dont le synopsis est ouvert / channel index whose synopsis is open
      this.searchQuery = "";
      this.favorites = new Set();     // ids de chaines epinglees en tete / channel ids pinned to the top
      this.reminders = {};            // rk -> { channelId, channelName, title, startISO, minutesBefore }
      this.reminderTimers = new Map(); // rk -> id setTimeout (jamais persiste, reconstruit a l'init)
      this.visibleRows = [];          // derniere liste triee+filtree affichee (pour retrouver une ligne au clic)
      this.favoritesKey = "teleprog-favs-" + ctx.instanceId;
      this.remindersKey = "teleprog-reminders-" + ctx.instanceId;
      // Vue courante au demarrage : "ce soir" par defaut -- stable
      // pendant des heures, pas besoin d'un rafraichissement frequent
      // -- sauf si la config demande explicitement une autre vue.
      // Ensuite pilotee par les onglets de la tuile (independamment de
      // la config).
      // Initial view: "tonight" by default -- stable for hours, no
      // need for frequent refreshing -- unless config explicitly asks
      // for another default. Afterwards driven by the tile's own tabs
      // (independently of config).
      this.view = VIEWS.includes(ctx.settings.defaultView) ? ctx.settings.defaultView : "evening";
      // Expose pour les tests (fonctions pures, aucune donnee sensible) / exposed for tests (pure functions, no sensitive data)
      this._computeNowRefreshDelay = computeNowRefreshDelay;
      this._computeAiringProgress = computeAiringProgress;
    }

    async init() {
      this.renderShell();
      await this.loadPersistedState();
      this.armReminders();
      await this.refresh();
      this.progressTimer = setInterval(() => this.renderBody(), 30000);
    }

    /* Favoris et rappels vivent dans le stockage d'etat de la tuile
       (ctx.api.state, meme mecanisme que le minuteur du Compte a
       rebours) : ils survivent a un rechargement de page et ne sont PAS
       reinitialises quand on modifie les reglages de la tuile.
       Favorites and reminders live in the tile's state storage
       (ctx.api.state, same mechanism as the Countdown timer): they
       survive a page reload and are NOT reset when the tile's settings
       are edited. */
    async loadPersistedState() {
      try {
        const favs = await this.ctx.api.state.get(this.favoritesKey);
        if (Array.isArray(favs)) this.favorites = new Set(favs);
      } catch (e) { /* premiere utilisation : rien a charger / first use: nothing to load */ }
      try {
        const rem = await this.ctx.api.state.get(this.remindersKey);
        if (rem && typeof rem === "object") this.reminders = rem;
      } catch (e) { /* idem */ }
    }

    saveFavorites() {
      this.ctx.api.state.put(this.favoritesKey, Array.from(this.favorites)).catch(() => {});
    }

    saveReminders() {
      this.ctx.api.state.put(this.remindersKey, this.reminders).catch(() => {});
    }

    /* Programme le prochain rafraichissement selon la vue affichee.
       Appele a la fin de chaque refresh() (succes ou echec), pour
       toujours reprogrammer sur la base des donnees les plus recentes.
       Schedules the next refresh based on the displayed view. Called
       at the end of every refresh() (success or failure), to always
       reschedule from the freshest data. */
    arm() {
      clearInterval(this.timer);
      clearTimeout(this.nowTimer);
      if (this.view === "now") {
        this.armNow();
        return;
      }
      const minutes = Number(this.ctx.settings.refresh) || 30;
      this.timer = setInterval(() => this.refresh(), Math.max(5, minutes) * 60000);
    }

    /* La vue "En ce moment" ne sonde pas a intervalle fixe : elle se
       reprogramme pour se rafraichir juste apres l'heure de fin
       annoncee du programme qui se termine le plus tot parmi les
       chaines affichees (+ une petite marge), afin de changer
       d'emission a la bonne minute sans solliciter le serveur plus que
       necessaire (le cache serveur XMLTV tient de toute facon 30 min,
       donc ces requetes rapprochees restent tres legeres). Repli sur
       un plafond configurable si aucune heure de fin n'est disponible
       (certaines sources n'annoncent pas <stop>).
       The "On now" view doesn't poll at a fixed interval: it
       reschedules itself to refresh just after the announced end time
       of the soonest-ending program among the displayed channels (+ a
       small margin), so it switches programs at the right minute
       without hitting the server more than needed (the server-side
       XMLTV cache holds for 30 min anyway, so these closer-together
       requests stay very light). Falls back to a configurable ceiling
       if no end time is available (some sources don't provide <stop>). */
    armNow() {
      const rows = (this.data && this.data.channels) || [];
      const ceilingMin = Math.max(1, Number(this.ctx.settings.refreshNowCeiling) || 5);
      const delay = computeNowRefreshDelay(rows, Date.now(), { ceilingMs: ceilingMin * 60000 });
      this.nowTimer = setTimeout(() => this.refresh(), delay);
    }

    /* (Re)programme les minuteurs des rappels en attente, a partir de
       this.reminders. Idempotent : peut etre rappelee autant de fois
       que necessaire (init, ajout/retrait d'un rappel) sans dupliquer
       les timers. Purge au passage les rappels perimes (diffusion deja
       commencee), pour ne pas les faire declencher en retard apres un
       rechargement de page tardif et pour ne pas laisser l'etat
       persiste grossir indefiniment.
       (Re)schedules pending reminder timers from this.reminders. Idempotent:
       can be called as many times as needed (init, adding/removing a
       reminder) without duplicating timers. Along the way, prunes stale
       reminders (broadcast already started), so they don't fire late
       after a delayed page reload and so the persisted state doesn't
       grow unbounded. */
    armReminders() {
      this.reminderTimers.forEach((id) => clearTimeout(id));
      this.reminderTimers.clear();
      const now = Date.now();
      let changed = false;

      Object.keys(this.reminders).forEach((rk) => {
        const r = this.reminders[rk];
        const startMs = r && r.startISO ? new Date(r.startISO).getTime() : NaN;
        if (isNaN(startMs) || startMs <= now) {
          // Diffusion deja commencee (ou horaire invalide) : rappel perime.
          // Broadcast already started (or invalid time): stale reminder.
          delete this.reminders[rk];
          changed = true;
          return;
        }
        const minutesBefore = Math.max(1, Number(r.minutesBefore) || 5);
        const fireAt = startMs - minutesBefore * 60000;
        const delay = fireAt - now;
        if (delay <= 0) {
          // Fenetre de declenchement deja passee (ex. tuile rouverte
          // apres un rechargement) mais la diffusion elle-meme n'a pas
          // encore commence : on declenche quand meme, sauf si on est
          // vraiment a la toute derniere seconde.
          // Trigger window already passed (e.g. tile reopened after a
          // reload) but the broadcast itself hasn't started yet: fire
          // anyway, unless we're really down to the last second.
          if (startMs - now > 10000) this.fireReminder(r);
          delete this.reminders[rk];
          changed = true;
          return;
        }
        const id = setTimeout(() => {
          this.fireReminder(r);
          delete this.reminders[rk];
          this.saveReminders();
          this.renderBody();
        }, delay);
        this.reminderTimers.set(rk, id);
      });

      if (changed) this.saveReminders();
    }

    /* Declenche le rappel : reutilise TEL QUEL le mecanisme d'alerte
       partage (flash plein ecran + son synthetise, voir
       public/app.js:boardAlert) que la tuile Compte a rebours utilise
       deja pour sa propre fin de minuteur -- pas de logique dupliquee.
       Webhook optionnel via ctx.api.notify, meme principe.
       Fires the reminder: reuses AS-IS the shared alert mechanism
       (full-screen flash + synthesized sound, see
       public/app.js:boardAlert) that the Countdown tile already uses
       for its own timer completion -- no duplicated logic. Optional
       webhook via ctx.api.notify, same idea. */
    fireReminder(r) {
      const s = this.ctx.settings;
      const wantsFlash = s.reminderFlashScreen !== false;
      const wantsSound = s.reminderPlaySound !== false;

      if (wantsFlash || wantsSound) {
        const durationMs = Math.max(1, Number(s.reminderAlertDurationSeconds) || 20) * 1000;
        this.ctx.api.startAlert({
          flash: wantsFlash,
          soundName: wantsSound ? (s.reminderSoundChoice || "bell-door") : null,
          durationMs,
          onEnd: () => {}
        });
      }

      if (s.reminderNotifyUrl) {
        const defaultMsg = this.ctx.i18n.t("teleprog.reminderDefaultMessage")
          .replace("{title}", r.title || "").replace("{channel}", r.channelName || "");
        const message = (s.reminderNotifyMessage || defaultMsg)
          .replace("{title}", r.title || "").replace("{channel}", r.channelName || "");
        const url = s.reminderNotifyUrl.includes("{message}")
          ? s.reminderNotifyUrl.replace(/\{message\}/g, encodeURIComponent(message))
          : s.reminderNotifyUrl;
        this.ctx.api.notify(url, s.reminderNotifyMethod, message);
      }
    }

    /* Bascule le favori d'une chaine (epinglee en tete de liste, toutes
       vues confondues). Toggles a channel's favorite state (pinned to
       the top of the list, across every view). */
    toggleFavorite(channelId) {
      if (this.favorites.has(channelId)) this.favorites.delete(channelId);
      else this.favorites.add(channelId);
      this.saveFavorites();
      this.renderBody();
    }

    /* Bascule le rappel d'UNE diffusion precise (voir reminderKey). Ne
       fait rien si la diffusion n'a pas d'heure de debut connue (rien a
       programmer). Toggles the reminder for ONE specific broadcast (see
       reminderKey). No-op if the broadcast has no known start time
       (nothing to schedule). */
    toggleReminder(row) {
      const p = row.program;
      if (!p || !p.start) return;
      const rk = reminderKey(row.channelId, p.start);
      if (this.reminders[rk]) {
        delete this.reminders[rk];
      } else {
        const minutesBefore = Math.max(1, Number(this.ctx.settings.reminderMinutesBefore) || 5);
        this.reminders[rk] = {
          channelId: row.channelId,
          channelName: row.channelName || row.channelId,
          title: p.title,
          startISO: p.start,
          minutesBefore
        };
      }
      this.saveReminders();
      this.armReminders();
      this.renderBody();
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      if (VIEWS.includes(settings.defaultView) && !this._viewTouched) {
        this.view = settings.defaultView;
      }
      this.selected = null;
      this.refresh();
    }

    onLangChanged() { this.render(); }

    /* Construit la liste des chaines depuis le textarea de config (une
       par ligne). Chaque entree peut etre un nom lisible ou un
       identifiant XMLTV : le serveur resout les deux. */
    channelList() {
      return String(this.ctx.settings.channels || "")
        .split("\n").map((s) => s.trim()).filter(Boolean);
    }

    buildUrl() {
      const s = this.ctx.settings;
      const p = new URLSearchParams();
      p.set("source", s.source || "xmltvfr");
      p.set("view", this.view);
      p.set("guide", s.xmltvfrGuide === "france" ? "france" : "tnt");
      p.set("channels", this.channelList().join(","));
      if (s.source === "xmltv" && s.xmltvUrl) p.set("xmltvUrl", s.xmltvUrl);
      if (s.source === "scrape" && s.scrapeUrl) p.set("scrapeUrl", s.scrapeUrl);
      if (s.eveningStart) p.set("eveningStart", s.eveningStart);
      if (s.lateStart) p.set("lateStart", s.lateStart);
      if (s.eveningEarliestStart) p.set("eveningEarliestStart", s.eveningEarliestStart);
      if (s.eveningLatestStart) p.set("eveningLatestStart", s.eveningLatestStart);
      if (s.eveningMinDuration != null && s.eveningMinDuration !== "") p.set("eveningMinDuration", s.eveningMinDuration);
      if (s.lateMinDuration != null && s.lateMinDuration !== "") p.set("lateMinDuration", s.lateMinDuration);
      if (s.showThumbnails === false) p.set("thumbnails", "0");
      return "/api/tele-program?" + p.toString();
    }

    async refresh() {
      this.loading = true;
      this.error = null;
      this.render();
      try {
        const res = await fetch(this.buildUrl());
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("status " + res.status));
        this.data = data;
        this.loading = false;
        this.render();
      } catch (e) {
        console.warn("[piboard/teleprog]", e);
        this.loading = false;
        this.error = String(e.message || e);
        this.render();
      }
      // Reprogramme toujours, succes ou echec (en cas d'echec, sans
      // donnees de fin de programme, armNow() se rabat sur le plafond).
      // Always reschedules, success or failure (on failure, with no
      // program end data, armNow() falls back to the ceiling).
      this.arm();
    }

    setView(view) {
      if (!VIEWS.includes(view) || view === this.view) return;
      this.view = view;
      this._viewTouched = true;
      this.selected = null;
      this.refresh();
    }

    formatTime(iso) {
      if (!iso) return "";
      try {
        const locale = this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-US";
        return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return ""; }
    }

    /* Ossature statique (barre de recherche + onglets + conteneur de
       liste), posee une fois. La barre de recherche reste hors du
       cycle de rendu de renderBody()/renderTabs() : recreer l'input a
       chaque rafraichissement lui ferait perdre le focus et la position
       du curseur en pleine frappe.
       Static skeleton (search bar + tabs + list container), laid out
       once. The search bar stays outside renderBody()/renderTabs()'s
       render cycle: recreating the input on every refresh would make it
       lose focus and cursor position mid-typing.
       Le contenu de la liste est (re)rendu par render(). */
    renderShell() {
      const i18n = this.ctx.i18n;
      this.ctx.el.innerHTML = `
        <div class="pw-teleprog">
          <div class="pwtp-toolbar">
            <input type="text" class="pwtp-search" placeholder="${escapeHtml(i18n.t("teleprog.searchPlaceholder"))}">
          </div>
          <div class="pwtp-tabs"></div>
          <div class="pwtp-body"></div>
        </div>`;
      const search = this.ctx.el.querySelector(".pwtp-search");
      search.addEventListener("click", (e) => e.stopPropagation()); // sinon rouvre les reglages en mode edition
      search.addEventListener("input", () => {
        this.searchQuery = search.value;
        this.renderBody();
      });
    }

    render() {
      const root = this.ctx.el.querySelector(".pw-teleprog");
      if (!root) { this.renderShell(); }
      const toolbar = this.ctx.el.querySelector(".pwtp-toolbar");
      if (toolbar) toolbar.hidden = this.ctx.settings.showSearch === false;
      this.renderTabs();
      this.renderBody();
    }

    renderTabs() {
      const i18n = this.ctx.i18n;
      const tabs = this.ctx.el.querySelector(".pwtp-tabs");
      if (!tabs) return;
      const labels = { now: i18n.t("teleprog.now"), evening: i18n.t("teleprog.evening"), late: i18n.t("teleprog.late") };
      tabs.innerHTML = VIEWS.map((v) =>
        `<button type="button" class="pwtp-tab${v === this.view ? " pwtp-tab-active" : ""}" data-view="${v}">${escapeHtml(labels[v])}</button>`
      ).join("");
      tabs.querySelectorAll(".pwtp-tab").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
          this.setView(btn.dataset.view);
        });
      });
    }

    /* Trie les lignes recues (favoris d'abord, ordre stable par
       ailleurs) puis les filtre selon la recherche en cours. Fonction
       d'instance (lit this.favorites/this.searchQuery) mais sans effet
       de bord : produit juste le tableau a afficher.
       Sorts the received rows (favorites first, stable order otherwise)
       then filters them by the current search. Instance method (reads
       this.favorites/this.searchQuery) but no side effect: just
       produces the array to display. */
    visibleRowsFor(rows) {
      const sorted = rows.slice().sort((a, b) => {
        const af = this.favorites.has(a.channelId) ? 0 : 1;
        const bf = this.favorites.has(b.channelId) ? 0 : 1;
        return af - bf; // tri stable : ordre d'origine conserve au sein de chaque groupe / stable sort: original order kept within each group
      });
      const q = normalize(this.searchQuery);
      if (!q) return sorted;
      return sorted.filter((row) => {
        const p = row.program;
        return normalize(row.channelName).includes(q)
          || (p && normalize(p.title).includes(q))
          || (p && normalize(p.subtitle).includes(q));
      });
    }

    renderBody() {
      const i18n = this.ctx.i18n;
      const body = this.ctx.el.querySelector(".pwtp-body");
      if (!body) return;

      if (this.error) {
        body.innerHTML = `<div class="pwtp-msg pwtp-err">${i18n.t("teleprog.error")} ${escapeHtml(this.error)}</div>`;
        return;
      }
      const allRows = (this.data && this.data.channels) || [];
      if (!allRows.length && this.loading) {
        body.innerHTML = `<div class="pwtp-msg">${i18n.t("teleprog.loading")}</div>`;
        return;
      }
      if (!allRows.length) {
        body.innerHTML = `<div class="pwtp-msg">${i18n.t("teleprog.empty")}</div>`;
        return;
      }

      const rows = this.visibleRowsFor(allRows);
      this.visibleRows = rows;

      if (!rows.length) {
        body.innerHTML = `<div class="pwtp-msg">${i18n.t("teleprog.noResults").replace("{query}", escapeHtml(this.searchQuery))}</div>`;
        return;
      }

      const s = this.ctx.settings;
      const showThumbs = s.showThumbnails !== false;
      const showCat = s.showCategory !== false;
      const showChanNum = s.showChannelNumber !== false;
      const showProgress = s.showProgress !== false;

      body.innerHTML = `<div class="pwtp-list">${rows.map((row, i) => this.rowHtml(row, i, showThumbs, showCat, showChanNum, showProgress)).join("")}</div>`;

      // Ouvre/ferme le synopsis au clic sur une ligne.
      body.querySelectorAll(".pwtp-row").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          this.selected = (this.selected === idx) ? null : idx;
          this.renderBody();
        });
      });

      // Favori : bascule sans ouvrir/fermer le synopsis (stopPropagation).
      body.querySelectorAll(".pwtp-fav").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleFavorite(btn.dataset.channelId);
        });
      });

      // Rappel : idem, ne doit pas interferer avec le clic d'ouverture du synopsis.
      body.querySelectorAll(".pwtp-remind").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = Number(btn.dataset.idx);
          const row = this.visibleRows[idx];
          if (row) this.toggleReminder(row);
        });
      });
    }

    rowHtml(row, i, showThumbs, showCat, showChanNum, showProgress) {
      const i18n = this.ctx.i18n;
      const p = row.program;
      const open = this.selected === i;
      const chName = escapeHtml(row.channelName || row.channelId);
      const isFav = this.favorites.has(row.channelId);
      // Numero de chaine TNT, affiche seulement quand la grille en fournit
      // un (voir channelNumber cote serveur -- absent pour les chaines
      // sans canal gratuit, ex. Canal+) ET quand le reglage l'autorise.
      // TNT channel number, shown only when the grid provides one (see
      // channelNumber server-side -- absent for channels without a free
      // channel, e.g. Canal+) AND when the setting allows it.
      const chNum = (showChanNum && row.channelNumber) ? `<span class="pwtp-chan-num">${row.channelNumber}</span>` : "";

      // Etoile favori : toujours proposee, meme sans programme trouve
      // (on peut vouloir epingler une chaine avant meme qu'elle ait un
      // programme charge). Favorite star: always offered, even with no
      // program found (you may want to pin a channel before it even has
      // a loaded program).
      const favBtn = `<button type="button" class="pwtp-fav${isFav ? " pwtp-fav-on" : ""}" data-channel-id="${escapeHtml(row.channelId)}" title="${escapeHtml(isFav ? i18n.t("teleprog.favoriteOn") : i18n.t("teleprog.favoriteOff"))}">${isFav ? "★" : "☆"}</button>`;

      if (!p) {
        return `
          <div class="pwtp-row pwtp-row-empty" data-idx="${i}">
            <div class="pwtp-chan">${favBtn}${chNum}<span class="pwtp-chan-name">${chName}</span></div>
            <div class="pwtp-noprog">${i18n.t("teleprog.noProgram")}</div>
          </div>`;
      }

      // Vignette : via le proxy image du serveur (evite CORS/mixed
      // content). Placeholder si absente (cf. Q3).
      let thumb = "";
      if (showThumbs) {
        if (p.icon) {
          thumb = `<img class="pwtp-thumb" loading="lazy" src="/api/image-proxy?url=${encodeURIComponent(p.icon)}" alt="">`;
        } else {
          thumb = `<div class="pwtp-thumb pwtp-thumb-ph" aria-hidden="true"></div>`;
        }
      }

      // Pastille inedit : uniquement si l'info existe (true). Rien pour
      // false (rediffusion) ni null (info absente), cf. Q2.
      const badge = p.isNew === true ? `<span class="pwtp-new">${i18n.t("teleprog.new")}</span>` : "";

      const cat = (showCat && p.category) ? `<span class="pwtp-cat">${escapeHtml(p.category)}</span>` : "";
      const time = this.formatTime(p.start);
      const sub = p.subtitle ? `<div class="pwtp-sub">${escapeHtml(p.subtitle)}</div>` : "";

      // Barre "en cours" : uniquement si la diffusion est reellement a
      // l'antenne maintenant, quelle que soit la vue affichee (une
      // emission de la vue "Ce soir" peut deja avoir commence).
      // "On air" bar: only if the broadcast is genuinely airing right
      // now, whatever the displayed view (a "Tonight" view program may
      // already have started).
      const progressPct = showProgress ? computeAiringProgress(p, Date.now()) : null;
      const progress = progressPct != null
        ? `<div class="pwtp-progress"><div class="pwtp-progress-fill" style="width:${progressPct.toFixed(1)}%"></div></div>`
        : "";

      // Rappel : propose uniquement pour une diffusion a venir (ou deja
      // programmee -- on garde le bouton actif pour permettre
      // l'annulation meme si la limite vient d'etre franchie).
      // Reminder: only offered for an upcoming broadcast (or already
      // scheduled -- keep the button active to allow cancelling even if
      // the boundary was just crossed).
      const rk = reminderKey(row.channelId, p.start);
      const isReminded = !!this.reminders[rk];
      const upcoming = p.start && new Date(p.start).getTime() > Date.now();
      const remindBtn = (p.start && (upcoming || isReminded))
        ? `<button type="button" class="pwtp-remind${isReminded ? " pwtp-remind-on" : ""}" data-idx="${i}" title="${escapeHtml(isReminded ? i18n.t("teleprog.remindOn") : i18n.t("teleprog.remindOff"))}">${isReminded ? "🔔" : "🔕"}</button>`
        : "";

      const synopsis = open ? `
        <div class="pwtp-synopsis">
          ${p.desc ? `<p>${escapeHtml(p.desc)}</p>` : `<p class="pwtp-nodesc">${i18n.t("teleprog.noSynopsis")}</p>`}
          ${p.stop ? `<div class="pwtp-times">${time}–${this.formatTime(p.stop)}</div>` : ""}
        </div>` : "";

      return `
        <div class="pwtp-row${open ? " pwtp-row-open" : ""}" data-idx="${i}">
          <div class="pwtp-main">
            ${thumb}
            <div class="pwtp-text">
              <div class="pwtp-line1"><span class="pwtp-chan">${favBtn}${chNum}<span class="pwtp-chan-name">${chName}</span></span><span class="pwtp-line1-right">${remindBtn}<span class="pwtp-time">${time}</span></span></div>
              <div class="pwtp-title">${escapeHtml(p.title)}${badge}</div>
              ${sub}
              <div class="pwtp-meta">${cat}</div>
              ${progress}
            </div>
          </div>
          ${synopsis}
        </div>`;
    }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.nowTimer);
      clearInterval(this.progressTimer);
      this.reminderTimers.forEach((id) => clearTimeout(id));
      this.reminderTimers.clear();
    }
  }

  window.PiBoard.registerWidget("teleprog", TeleProgWidget);
})();
