/* PiBoard widget: homeassistant / etats des entites Home Assistant.
   LECTURE SEULE : ce widget n'appelle aucun service et ne peut rien
   changer dans la maison.
   READ ONLY: this widget calls no service and cannot change anything in
   the home. */
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Etats "actifs" par classe d'appareil. Le vocabulaire de HA est le
     meme (on/off) pour toutes les classes, mais le SENS differe : une
     porte "on" est ouverte, un detecteur "on" a detecte quelque chose.
     "Active" states by device class. HA's vocabulary is the same (on/off)
     for every class, but the MEANING differs: a door that is "on" is
     open, a detector that is "on" has detected something. */
  const BINARY_WORDS = {
    door: ["ha.open", "ha.closed"],
    window: ["ha.open", "ha.closed"],
    garage_door: ["ha.open", "ha.closed"],
    opening: ["ha.open", "ha.closed"],
    motion: ["ha.detected", "ha.clear"],
    occupancy: ["ha.detected", "ha.clear"],
    smoke: ["ha.detected", "ha.clear"],
    gas: ["ha.detected", "ha.clear"],
    moisture: ["ha.wet", "ha.dry"]
  };

  /* Etats qui signalent un probleme plutot qu'une valeur. HA les renvoie
     comme des chaines ordinaires : sans ce test, la tuile afficherait
     litteralement "unavailable" a cote d'un "°C".
     States that flag a problem rather than a value. HA returns them as
     ordinary strings: without this check the tile would literally show
     "unavailable" next to a "°C". */
  function isDead(state) {
    return state == null || state === "unavailable" || state === "unknown" || state === "";
  }

  function describe(e, i18n) {
    if (e.missing) return { text: i18n.t("ha.unknown"), level: "dead" };
    if (isDead(e.state)) {
      return { text: i18n.t(e.state === "unknown" ? "ha.unknown" : "ha.unavailable"), level: "dead" };
    }

    if (e.domain === "binary_sensor") {
      const words = BINARY_WORDS[e.deviceClass] || ["ha.on", "ha.off"];
      const active = e.state === "on";
      return {
        text: i18n.t(active ? words[0] : words[1]),
        // Une porte ouverte ou une fumee detectee doit sauter aux yeux ;
        // une porte fermee est l'etat normal, donc discret.
        // An open door or detected smoke must stand out; a closed door is
        // the normal state, so it stays discreet.
        level: active ? "alert" : "calm"
      };
    }

    if (e.domain === "light" || e.domain === "switch" || e.domain === "fan") {
      const on = e.state === "on";
      return { text: i18n.t(on ? "ha.on" : "ha.off"), level: on ? "active" : "calm" };
    }

    // Valeur numerique : on n'arrondit PAS a l'aveugle. Une temperature
    // veut une decimale, une puissance n'en veut aucune, un compteur
    // d'energie en veut deux.
    // Numeric value: we do NOT round blindly. A temperature wants one
    // decimal, a power reading none, an energy meter two.
    const n = Number(e.state);
    if (Number.isFinite(n)) {
      const digits = e.deviceClass === "energy" ? 2
        : (e.deviceClass === "power" || Math.abs(n) >= 100) ? 0 : 1;
      return { text: n.toFixed(digits) + (e.unit ? " " + e.unit : ""), level: "value" };
    }

    return { text: String(e.state), level: "value" };
  }

  class HomeAssistantWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.last = null;
      this._describe = describe;
      this._isDead = isDead;
    }

    lines() {
      const raw = this.ctx.settings.lines;
      let arr = [];
      try { arr = typeof raw === "string" ? JSON.parse(raw || "[]") : (Array.isArray(raw) ? raw : []); }
      catch (e) { arr = []; }
      return arr.filter((l) => l && l.symbol);
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-ha"><div class="pwh-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
      this.listen();
    }

    /* Le rafraichissement periodique n'est qu'un FILET : normalement les
       changements arrivent par SSE des que Home Assistant les signale.
       Il couvre le cas ou le WebSocket serveur est tombe.
       The periodic refresh is only a SAFETY NET: normally changes arrive
       over SSE as soon as Home Assistant reports them. It covers the case
       where the server-side WebSocket has dropped. */
    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(1, Number(this.ctx.settings.refresh) || 5);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    /* On ecoute l'evenement DOM rediffuse par app.js depuis le flux SSE
       DEJA ouvert, plutot que d'ouvrir un EventSource par tuile : le flux
       est unique, quel que soit le nombre de tuiles Home Assistant.
       We listen to the DOM event re-broadcast by app.js from the SSE
       stream that is ALREADY open, rather than opening one EventSource
       per tile: the stream stays single, however many Home Assistant
       tiles there are. */
    listen() {
      this.onPush = () => this.refresh();
      window.addEventListener("piboard:ha-states", this.onPush);
    }

    async refresh() {
      const lines = this.lines();
      if (!lines.length) {
        this.ctx.el.innerHTML = `<div class="pw-ha"><div class="pwh-msg">${esc(this.ctx.i18n.t("ha.noEntities"))}</div></div>`;
        return;
      }
      try {
        const url = encodeURIComponent(this.ctx.settings.url || "");
        const ids = encodeURIComponent(lines.map((l) => l.symbol).join(","));
        const r = await fetch(`api/ha/${encodeURIComponent(this.ctx.instanceId)}/states?url=${url}&ids=${ids}`);
        if (!r.ok) throw new Error("http " + r.status);
        this.last = await r.json();
        this.render(lines, this.last);
      } catch (e) {
        console.warn("[piboard/ha]", e);
        if (!this.last) {
          this.ctx.el.innerHTML = `<div class="pw-ha"><div class="pwh-msg">${esc(this.ctx.i18n.t("ha.error"))}</div></div>`;
        }
      }
    }

    render(lines, data) {
      const i18n = this.ctx.i18n;
      const showDead = this.ctx.settings.showUnavailable !== false;
      const byId = new Map((data.entities || []).map((e) => [e.id, e]));

      const rows = lines.map((l) => {
        const e = byId.get(l.symbol);
        if (!e) return "";
        const d = describe(e, i18n);
        if (d.level === "dead" && !showDead) return "";
        // Le nom saisi dans les reglages prime sur celui de HA : la
        // personne l'a choisi pour SON tableau, souvent plus court.
        // The name typed in the settings wins over HA's: the person chose
        // it for THEIR board, often shorter.
        const name = l.name || e.name || e.id;
        return `<div class="pwh-row pwh-${d.level}">
          <span class="pwh-name">${esc(name)}</span>
          <span class="pwh-val">${esc(d.text)}</span>
        </div>`;
      }).join("");

      if (!rows) {
        this.ctx.el.innerHTML = `<div class="pw-ha"><div class="pwh-msg">${esc(i18n.t("ha.noEntities"))}</div></div>`;
        return;
      }

      // L'indicateur "direct" n'apparait QUE si le WebSocket est
      // reellement etabli : le montrer en repli REST serait mentir sur la
      // fraicheur des donnees.
      // The "live" dot appears ONLY when the WebSocket is actually up:
      // showing it on the REST fallback would misrepresent how fresh the
      // data is.
      const live = data.live ? `<span class="pwh-live" title="${esc(i18n.t("ha.liveTitle"))}"></span>` : "";
      this.ctx.el.innerHTML = `<div class="pw-ha">${live}<div class="pwh-rows">${rows}</div></div>`;
    }

    destroy() {
      clearInterval(this.timer);
      if (this.onPush) window.removeEventListener("piboard:ha-states", this.onPush);
    }
  }

  window.PiBoard.registerWidget("homeassistant", HomeAssistantWidget);
})();
