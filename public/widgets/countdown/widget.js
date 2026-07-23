/* PiBoard widget: countdown / compte a rebours
   Deux modes : date fixe (pur affichage), ou minuteur demarrable dont
   l'etat (en cours, instant de depart) est persiste cote serveur pour
   survivre a un rechargement ou etre visible depuis un autre ecran.
   Two modes: fixed date (pure display), or a start/pause timer whose
   state (running, start instant) is persisted server-side so it survives
   a reload or stays visible from another screen. */
(function () {
  "use strict";

  function pad(n) { return String(Math.floor(n)).padStart(2, "0"); }

  function formatRemaining(ms, showSeconds) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hms = showSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
    return days > 0 ? { big: `${days}`, unit: "j", rest: hms } : { big: hms, unit: "", rest: "" };
  }

  class CountdownWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.key = "countdown-" + ctx.instanceId;
      this.state = { running: false, startEpoch: null, durationMs: 0, remainingMs: 0, alerted: false };
      this.alerted = false; // repli en memoire pour le mode "date" (sans etat persiste)
      this.alertActive = false; // alerte (flash/son) en cours, arretable via le bouton
    }

    async init() {
      this.ctx.el.innerHTML = `
        <div class="pw-countdown">
          <div class="pwd-label"></div>
          <div class="pwd-value"></div>
          <div class="pwd-controls" hidden>
            <button type="button" class="pwd-btn pwd-primary pwd-toggle"></button>
            <button type="button" class="pwd-btn pwd-reset"></button>
          </div>
        </div>`;
      this.labelEl = this.ctx.el.querySelector(".pwd-label");
      this.valueEl = this.ctx.el.querySelector(".pwd-value");
      this.controls = this.ctx.el.querySelector(".pwd-controls");
      this.toggleBtn = this.ctx.el.querySelector(".pwd-toggle");
      this.resetBtn = this.ctx.el.querySelector(".pwd-reset");

      if (this.ctx.settings.mode === "duration") {
        const saved = await this.ctx.api.state.get(this.key);
        if (saved && typeof saved === "object") this.state = saved;
        this.alerted = !!this.state.alerted;
      }

      // Meme correctif que le widget Diaporama (voir son wireManageButton) :
      // sans stopPropagation, ces clics remontent jusqu'a la grille en
      // mode edition et rouvrent les reglages de la tuile en pleine
      // manipulation du minuteur.
      // Same fix as the Slideshow widget (see its wireManageButton):
      // without stopPropagation, these clicks bubble up to the grid in
      // edit mode and reopen the tile's settings mid-interaction with
      // the timer.
      this.toggleBtn.addEventListener("click", (e) => { e.stopPropagation(); this.toggleTimer(); });
      this.resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.alertActive) this.stopAlertNow();
        else this.resetTimer();
      });

      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);

      this.render();
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }

    saveState() {
      if (this.ctx.settings.mode === "duration") {
        this.ctx.api.state.put(this.key, this.state).catch(() => {});
      }
    }

    toggleTimer() {
      const s = this.state;
      const durationMs = Math.max(1, Number(this.ctx.settings.durationMinutes) || 10) * 60000;
      if (!s.running) {
        // Demarre (ou reprend) avec la duree restante / start (or resume) with remaining time
        const remaining = s.remainingMs > 0 && s.durationMs === durationMs ? s.remainingMs : durationMs;
        s.running = true;
        s.durationMs = durationMs;
        s.startEpoch = Date.now();
        s.remainingMs = remaining;
        s.alerted = false;
        this.alerted = false;
      } else {
        // Pause : figer la duree restante / pause: freeze remaining time
        const elapsed = Date.now() - s.startEpoch;
        s.remainingMs = Math.max(0, s.remainingMs - elapsed);
        s.running = false;
      }
      this.saveState();
      this.tick();
    }

    resetTimer() {
      const durationMs = Math.max(1, Number(this.ctx.settings.durationMinutes) || 10) * 60000;
      this.state = { running: false, startEpoch: null, durationMs, remainingMs: durationMs, alerted: false };
      this.alerted = false;
      this.saveState();
      this.tick();
    }

    render() {
      const s = this.ctx.settings;
      this.labelEl.textContent = s.label || "";
      this.labelEl.hidden = !s.label;
      // Les controles apparaissent en mode minuteur, et aussi temporairement
      // pendant une alerte active (pour pouvoir l'arreter), meme en mode date.
      // Controls show in timer mode, and also temporarily during an active
      // alert (to allow stopping it), even in date mode.
      this.controls.hidden = s.mode !== "duration" && !this.alertActive;
      this.toggleBtn.hidden = s.mode !== "duration";
      this.toggleBtn.textContent = this.state.running
        ? this.ctx.i18n.t("countdown.pause") : this.ctx.i18n.t("countdown.start");
      this.resetBtn.textContent = this.alertActive
        ? this.ctx.i18n.t("countdown.stop") : this.ctx.i18n.t("countdown.reset");
      this.resetBtn.classList.toggle("pwd-stop", this.alertActive);
      this.fit();
    }

    currentRemainingMs() {
      const s = this.ctx.settings;
      if (s.mode === "duration") {
        const st = this.state;
        if (!st.durationMs) return Math.max(1, Number(s.durationMinutes) || 10) * 60000;
        if (st.running) return Math.max(0, st.remainingMs - (Date.now() - st.startEpoch));
        return st.remainingMs;
      }
      if (!s.targetDateTime) return null;
      const target = new Date(s.targetDateTime).getTime();
      if (isNaN(target)) return null;
      return target - Date.now();
    }

    tick() {
      const s = this.ctx.settings;
      const ms = this.currentRemainingMs();

      if (ms == null) {
        this.valueEl.innerHTML = `<span class="pwd-missing">${this.ctx.i18n.t("countdown.missing")}</span>`;
        return;
      }

      if (ms <= 0) {
        if (s.mode === "duration" && this.state.running) {
          this.state.running = false;
          this.state.remainingMs = 0;
          this.saveState();
        }
        if (!this.alerted) {
          this.alerted = true;
          if (s.mode === "duration") { this.state.alerted = true; this.saveState(); }
          this.fireAlert();
        }
        this.valueEl.innerHTML = `<span class="pwd-done">${this.ctx.i18n.t("countdown.done")}</span>`;
        this.toggleBtn.textContent = this.ctx.i18n.t("countdown.start");
        return;
      }

      const f = formatRemaining(ms, s.showSeconds);
      this.valueEl.innerHTML = f.unit
        ? `${f.big}<small>${f.unit}</small> ${f.rest}`
        : f.big;
      this.toggleBtn.textContent = this.state.running
        ? this.ctx.i18n.t("countdown.pause") : this.ctx.i18n.t("countdown.start");
    }

    /* Declenche l'alerte de fin : flash plein ecran et/ou son, pendant la
       duree configuree ou jusqu'a arret manuel (bouton "Arreter"), et/ou
       appel d'un webhook de notification externe (SMS, Alexa, push
       mobile...). Le webhook part une seule fois immediatement ; le
       flash/son peuvent durer et etre arretes independamment.
       Fires the completion alert: full-screen flash and/or sound, for the
       configured duration or until manually stopped ("Stop" button),
       and/or an external notification webhook call (SMS, Alexa, phone
       push...). The webhook fires once immediately; the flash/sound can
       last longer and be stopped independently. */
    fireAlert() {
      const s = this.ctx.settings;
      const wantsFlash = s.flashScreen !== false;
      const wantsSound = s.playSound !== false;

      if (wantsFlash || wantsSound) {
        const durationMs = Math.max(1, Number(s.alertDurationSeconds) || 60) * 1000;
        this.alertActive = true;
        this.render();
        this.ctx.api.startAlert({
          flash: wantsFlash,
          soundName: wantsSound ? (s.soundChoice || "beep-simple") : null,
          durationMs,
          onEnd: () => {
            this.alertActive = false;
            this.render();
          }
        });
      }

      if (s.notifyUrl) {
        const defaultMsg = s.label
          ? s.label + " — " + this.ctx.i18n.t("countdown.done")
          : this.ctx.i18n.t("countdown.done");
        const message = s.notifyMessage || defaultMsg;
        // {message} dans l'URL est remplace par le texte encode : utile pour
        // les webhooks GET (Voice Monkey, ntfy...) qui prennent le message
        // en parametre de requete plutot que dans le corps.
        // {message} in the URL is replaced with the encoded text: useful for
        // GET webhooks (Voice Monkey, ntfy...) that take the message as a
        // query parameter rather than in the body.
        const url = s.notifyUrl.includes("{message}")
          ? s.notifyUrl.replace(/\{message\}/g, encodeURIComponent(message))
          : s.notifyUrl;
        this.ctx.api.notify(url, s.notifyMethod, message);
      }
    }

    /* Arret manuel de l'alerte en cours (bouton "Arreter"), sans toucher
       au reste de l'etat du minuteur. Manual stop of the ongoing alert
       ("Stop" button), without touching the rest of the timer's state. */
    stopAlertNow() {
      this.ctx.api.stopAlert();
      this.alertActive = false;
      this.render();
    }

    fit() {
      const h = this.ctx.el.clientHeight || 100;
      this.valueEl.style.fontSize = Math.max(20, Math.floor(h * 0.30)) + "px";
      this.labelEl.style.fontSize = Math.max(11, Math.floor(h * 0.10)) + "px";
    }

    onSettingsChanged(settings) {
      const modeChanged = settings.mode !== this.ctx.settings.mode;
      this.ctx.settings = settings;
      if (modeChanged && settings.mode === "duration" && !this.state.durationMs) {
        this.resetTimer();
      }
      if (settings.mode === "date") this.alerted = false; // reglages modifies : on reautorise l'alerte
      this.render();
      this.tick();
    }

    onLangChanged() { this.render(); this.tick(); }

    destroy() {
      clearInterval(this.timer);
      if (this.observer) this.observer.disconnect();
      if (this.alertActive) this.ctx.api.stopAlert();
    }
  }

  window.PiBoard.registerWidget("countdown", CountdownWidget);
})();
