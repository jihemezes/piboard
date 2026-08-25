/* PiBoard widget: aiusage / quotas des comptes IA.

   La connexion se fait DEPUIS LA TUILE, pas depuis les reglages : le
   systeme de reglages n'a pas de type "bouton", et surtout l'autorisation
   est un aller-retour en deux temps (afficher une URL, puis recevoir
   l'URL de rappel) qui ne rentre pas dans un simple champ. La tuile non
   connectee affiche donc son propre bouton.

   Connection happens FROM THE TILE, not from the settings: the settings
   system has no "button" type, and above all the authorization is a
   two-step round trip (show a URL, then receive the callback URL) that
   does not fit in a plain field. So the disconnected tile shows its own
   button. */
(function () {
  "use strict";

  /* Compte a rebours lisible. On s'arrete a la minute : afficher les
     secondes ferait clignoter la tuile en permanence sur un tableau
     mural, pour une precision dont personne n'a besoin ici.
     Readable countdown. We stop at the minute: showing seconds would make
     the tile flicker permanently on a wall board, for a precision nobody
     needs here. */
  function formatReset(iso, i18n) {
    if (!iso) return "";
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    let mins = Math.round((t - Date.now()) / 60000);
    if (mins <= 0) return i18n.t("aiusage.resetSoon");
    const days = Math.floor(mins / 1440);
    mins -= days * 1440;
    const hours = Math.floor(mins / 60);
    mins -= hours * 60;
    const parts = [];
    if (days) parts.push(days + " j");
    if (hours) parts.push(hours + " h");
    if (!days && mins) parts.push(mins + " min");
    return i18n.t("aiusage.resetIn").replace("{d}", parts.join(" ") || "1 min");
  }

  function levelFor(pct, warnAt, dangerAt) {
    if (pct >= dangerAt) return "danger";
    if (pct >= warnAt) return "warn";
    return "ok";
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  class AiUsageWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.tick = null;
      this.modal = null;
      this.last = null;
      this._formatReset = formatReset;
      this._levelFor = levelFor;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-aiu"><div class="pwa-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      clearInterval(this.tick);
      const minutes = Math.max(1, Number(this.ctx.settings.refresh) || 5);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
      // Le compte a rebours doit avancer meme sans nouvel appel reseau,
      // sinon "reinitialisation dans 3 h" resterait fige pendant 5 min.
      // The countdown must move on even without a new network call,
      // otherwise "resets in 3 h" would stay frozen for 5 minutes.
      this.tick = setInterval(() => { if (this.last) this.render(this.last); }, 60000);
    }

    async refresh() {
      try {
        const r = await fetch("api/ai-usage");
        const data = await r.json();
        this.last = data;
        this.render(data);
      } catch (e) {
        console.warn("[piboard/aiusage]", e);
        // On garde le dernier etat connu plutot que de vider la tuile :
        // une coupure reseau de 30 s ne doit pas effacer l'affichage.
        // We keep the last known state rather than emptying the tile: a
        // 30 s network blip must not wipe the display.
        if (!this.last) this.renderMessage(this.ctx.i18n.t("aiusage.error"));
      }
    }

    renderMessage(msg, withButton) {
      const i18n = this.ctx.i18n;
      this.ctx.el.innerHTML = `
        <div class="pw-aiu">
          <div class="pwa-msg">${esc(msg)}</div>
          ${withButton ? `<button class="pwa-connect">${esc(i18n.t("aiusage.connect"))}</button>` : ""}
        </div>`;
      const btn = this.ctx.el.querySelector(".pwa-connect");
      if (btn) btn.addEventListener("pointerup", (e) => { e.preventDefault(); this.openAuth(); });
    }

    render(data) {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;

      if (!data || data.connected === false) {
        return this.renderMessage(i18n.t("aiusage.notConnected"), true);
      }
      if (data.error) {
        const key = data.error === "token_refresh_failed" || data.error === "unauthorized"
          ? "aiusage.reconnect"
          : data.error === "rate_limited" ? "aiusage.rateLimited" : "aiusage.error";
        // Un jeton mort se re-autorise : on remet le bouton, sinon la
        // personne n'a aucun moyen de s'en sortir depuis le tableau.
        // A dead token can be re-authorized: we bring the button back,
        // otherwise the person has no way out from the board.
        const reauth = key === "aiusage.reconnect";
        return this.renderMessage(i18n.t(key), reauth);
      }

      const wanted = {
        fiveHour: s.showFiveHour !== false,
        sevenDay: s.showSevenDay !== false,
        sevenDayOpus: s.showSevenDayOpus !== false
      };
      const windows = (data.windows || []).filter((w) => wanted[w.id] !== false);

      if (!windows.length) return this.renderMessage(i18n.t("aiusage.noWindows"));

      const warnAt = Math.max(1, Math.min(99, Number(s.warnAt) || 75));
      const dangerAt = Math.max(1, Math.min(100, Number(s.dangerAt) || 90));

      const rows = windows.map((w) => {
        const pct = Math.round(w.utilization);
        const lvl = levelFor(pct, warnAt, dangerAt);
        const reset = formatReset(w.resetsAt, i18n);
        return `
          <div class="pwa-row">
            <div class="pwa-head">
              <span class="pwa-label">${esc(i18n.t("aiusage.win." + w.id))}</span>
              <span class="pwa-pct pwa-${lvl}">${pct}%</span>
            </div>
            <div class="pwa-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
              <div class="pwa-fill pwa-${lvl}" style="width:${pct}%"></div>
            </div>
            <div class="pwa-reset">${esc(reset)}</div>
          </div>`;
      }).join("");

      this.ctx.el.innerHTML = `<div class="pw-aiu"><div class="pwa-rows">${rows}</div></div>`;
    }

    /* ---------- Autorisation / authorization ---------- */

    async openAuth() {
      const i18n = this.ctx.i18n;
      let authUrl = "";
      try {
        const r = await fetch("api/ai-usage/auth/start", { method: "POST" });
        authUrl = (await r.json()).authUrl || "";
      } catch (e) {
        return this.renderMessage(i18n.t("aiusage.error"), true);
      }
      if (!authUrl) return this.renderMessage(i18n.t("aiusage.error"), true);

      const m = document.createElement("div");
      // modal-stacked : la tuile peut etre ouverte par-dessus la fenetre
      // de reglages, il faut passer au-dessus (voir style.css).
      // modal-stacked: the tile can be opened over the settings window, so
      // we must sit above it (see style.css).
      m.className = "modal modal-stacked";
      m.innerHTML = `
        <div class="modal-card pwa-auth-card">
          <header class="modal-head">
            <h2>${esc(i18n.t("aiusage.authTitle"))}</h2>
            <button class="modal-close" data-x aria-label="Close">&times;</button>
          </header>
          <div class="pwa-auth-body">
            <p>${esc(i18n.t("aiusage.step1"))}</p>
            <textarea class="pwa-url" readonly rows="3">${esc(authUrl)}</textarea>
            <p>${esc(i18n.t("aiusage.step2"))}</p>
            <input class="pwa-cb" type="text" placeholder="http://localhost:18924/callback?code=...">
            <div class="pwa-auth-err" hidden></div>
            <div class="pwa-auth-foot">
              <button class="btn primary" data-ok>${esc(i18n.t("aiusage.validate"))}</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(m);
      this.modal = m;

      const close = () => { m.remove(); this.modal = null; };
      m.querySelector("[data-x]").addEventListener("pointerup", (e) => { e.preventDefault(); close(); });
      m.querySelector(".pwa-url").addEventListener("focus", (e) => e.target.select());

      m.querySelector("[data-ok]").addEventListener("pointerup", async (e) => {
        e.preventDefault();
        const err = m.querySelector(".pwa-auth-err");
        const val = m.querySelector(".pwa-cb").value.trim();
        if (!val) {
          err.hidden = false;
          err.textContent = i18n.t("aiusage.errEmpty");
          return;
        }
        try {
          const r = await fetch("api/ai-usage/auth/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callbackUrl: val })
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            err.hidden = false;
            err.textContent = i18n.t("aiusage.errAuth") + (j.error ? " (" + j.error + ")" : "");
            return;
          }
          close();
          await this.refresh();
        } catch (ex) {
          err.hidden = false;
          err.textContent = i18n.t("aiusage.errAuth");
        }
      });
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.tick);
      if (this.modal) this.modal.remove();
    }
  }

  window.PiBoard.registerWidget("aiusage", AiUsageWidget);
})();
