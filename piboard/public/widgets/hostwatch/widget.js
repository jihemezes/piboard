/* PiBoard widget: network watch / veille reseau
   Interroge /api/host-watch (voir server/hostWatch.js) avec la liste de
   cibles saisie dans les reglages, et affiche pour chacune si elle
   repond, en combien de temps, et depuis quand son etat n'a pas change.

   Le serveur choisit la sonde d'apres la forme de la cible : HTTP pour
   une URL, connexion TCP pour un couple hote:port, ping sinon. La tuile
   se contente de l'afficher -- elle ne decide de rien, ce qui evite
   d'avoir la meme logique a deux endroits.

   Queries /api/host-watch (see server/hostWatch.js) with the target list
   typed in the settings, and shows for each one whether it answers, how
   fast, and since when its state has not changed.

   The server picks the probe from the target's shape: HTTP for a URL, a
   TCP connection for a host:port pair, ping otherwise. The tile merely
   displays it -- it decides nothing, which avoids having the same logic
   in two places. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* \"depuis 3 min\", \"depuis 2 h\". Une duree relative plutot qu'une heure
     absolue : devant une tuile, \"depuis 4 min\" se comprend
     instantanement, alors que \"14:32\" demande de regarder l'heure
     qu'il est et de soustraire.
     \"for 3 min\", \"for 2 h\". A relative duration rather than an absolute
     time: in front of a tile, \"for 4 min\" is understood instantly,
     whereas \"2:32 pm\" requires checking the time and subtracting. */
  function sinceLabel(ts, i18n) {
    if (!ts) return "";
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 60) return i18n.t("hostwatch.sinceSeconds").replace("{n}", sec);
    const min = Math.round(sec / 60);
    if (min < 60) return i18n.t("hostwatch.sinceMinutes").replace("{n}", min);
    return i18n.t("hostwatch.sinceHours").replace("{n}", Math.round(min / 60));
  }

  /* Traduit les motifs courts renvoyes par le serveur. Ils sont produits
     en anglais dans server/hostWatch.js (cle technique) et traduits
     ici : c'est la regle habituelle de PiBoard -- le serveur ne connait
     pas la langue de l'affichage.
     Translates the short reasons returned by the server. They are
     produced in English in server/hostWatch.js (a technical key) and
     translated here: PiBoard's usual rule -- the server does not know
     the display language. */
  function detailLabel(detail, i18n) {
    const key = "hostwatch.reason." + String(detail || "").replace(/\s+/g, "-");
    const translated = i18n.t(key);
    return translated === key ? String(detail || "") : translated;
  }

  class HostWatchWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.checking = false;
      this.lastData = null;
      this.lastError = "";
    }

    async init() {
      this.render();
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const seconds = Math.min(3600, Math.max(15, Number(this.ctx.settings.refreshSeconds) || 60));
      this.timer = setInterval(() => this.refresh(), seconds * 1000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    async refresh() {
      /* Une verification a la fois. Une liste lente (un service distant
         qui ne repond pas) peut durer plusieurs secondes ; sans ce
         verrou, un intervalle court empilerait les requetes et chaque
         vague fausserait l'historique de l'autre.
         One check at a time. A slow list (a remote service not
         answering) can take several seconds; without this lock, a short
         interval would stack requests and each wave would skew the
         other's history. */
      if (this.checking) return;
      this.checking = true;
      this.render();
      try {
        const res = await fetch("/api/host-watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: String(this.ctx.settings.targets || "") })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("status " + res.status));
        this.lastData = data;
        this.lastError = "";
      } catch (e) {
        console.warn("[piboard/hostwatch]", e);
        this.lastError = String(e.message || e);
      }
      this.checking = false;
      this.render();
    }

    rowHtml(t) {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const st = t.stats || {};

      /* Le temps de reponse n'est montre que pour une cible qui repond :
         afficher \"-- ms\" sur une ligne en panne ajouterait du bruit la
         ou l'oeil cherche juste le rouge.
         The response time is only shown for a target that answers:
         printing \"-- ms\" on a failing line would add noise exactly where
         the eye is only looking for red. */
      const latency = (s.showLatency && t.up && typeof t.ms === "number")
        ? `<span class="pwh-ms">${t.ms} ms</span>` : "";

      const spark = (s.showHistory && st.spark && st.spark.length > 1)
        ? `<span class="pwh-spark">${st.spark.map((v) =>
            `<i class="${v ? "pwh-bar-up" : "pwh-bar-down"}"></i>`).join("")}</span>`
        : "";

      const detail = t.up ? "" : detailLabel(t.detail, i18n);
      const since = sinceLabel(st.since, i18n);
      const meta = [detail, since].filter(Boolean).join(" · ");

      return `
        <div class="pwh-row ${t.up ? "pwh-up" : "pwh-down"}">
          <span class="pwh-dot" aria-hidden="true"></span>
          <span class="pwh-name" title="${escapeHtml(t.target)}">${escapeHtml(t.name)}</span>
          ${latency}
          ${spark}
          <span class="pwh-meta">${escapeHtml(meta)}</span>
        </div>`;
    }

    render() {
      const i18n = this.ctx.i18n;
      const el = this.ctx.el;

      if (this.lastError && !this.lastData) {
        el.innerHTML = `<div class="pw-hostwatch"><div class="pwh-empty">${escapeHtml(this.lastError)}</div></div>`;
        return;
      }
      if (!this.lastData) {
        el.innerHTML = `<div class="pw-hostwatch"><div class="pwh-empty">${i18n.t("hostwatch.checking")}</div></div>`;
        return;
      }

      const targets = this.lastData.targets || [];
      if (!targets.length) {
        el.innerHTML = `<div class="pw-hostwatch"><div class="pwh-empty">${i18n.t("hostwatch.noTargets")}</div></div>`;
        return;
      }

      /* Tri facultatif, et une copie plutot qu'un tri en place : muter
         this.lastData changerait l'ordre pour de bon, et desactiver
         l'option ne rendrait plus l'ordre d'origine.
         Optional sort, on a copy rather than in place: mutating
         this.lastData would change the order for good, and turning the
         option off would no longer restore the original order. */
      const rows = this.ctx.settings.downFirst
        ? targets.slice().sort((a, b) => (a.up === b.up ? 0 : a.up ? 1 : -1))
        : targets;

      const down = this.lastData.down || 0;
      const summary = down
        ? i18n.t("hostwatch.summaryDown").replace("{n}", down).replace("{total}", this.lastData.total)
        : i18n.t("hostwatch.summaryAllUp").replace("{total}", this.lastData.total);

      el.innerHTML = `
        <div class="pw-hostwatch">
          <div class="pwh-head ${down ? "pwh-head-down" : ""}">
            <span>${escapeHtml(summary)}</span>
            <span class="pwh-checking">${this.checking ? i18n.t("hostwatch.checking") : ""}</span>
          </div>
          <div class="pwh-list">${rows.map((t) => this.rowHtml(t)).join("")}</div>
        </div>`;
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  window.PiBoard.registerWidget("hostwatch", HostWatchWidget);
})();
