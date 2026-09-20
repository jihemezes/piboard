/* PiBoard widget: bambu / imprimante 3D Bambu Lab
   Afficheur en LECTURE SEULE. Tout le dialogue avec l'imprimante vit
   cote serveur (server/bambu.js) : la tuile lit un etat deja normalise
   et ne connait ni MQTT, ni le protocole de Bambu, ni le moindre
   secret -- le code d'acces ne redescend jamais au navigateur.

   L'AFFICHAGE SE DEGRADE PAR PALIERS. Plus la tuile est petite, plus
   on retire : l'avancement est le dernier a partir, parce que c'est
   pour lui qu'on pose cette tuile.

   Read-only display. All the talking to the printer happens server
   side; the tile reads an already normalised state. The display
   degrades in steps as the tile shrinks: progress is the last thing
   to go. */
(function () {
  "use strict";

  /* Paliers d'affichage, du plus complet au plus reduit. Le premier qui
     tient dans la tuile gagne. Les seuils sont en pixels reels, mesures
     sur la tuile, et non en nombre de cases : deux tuiles de meme taille
     de grille n'ont pas la meme taille a l'ecran selon l'ecran.
     Display levels, richest first; the first that fits wins. */
  const LEVELS = [
    { name: "full", minW: 300, minH: 260 },   // tout, AMS compris
    { name: "rich", minW: 260, minH: 200 },   // + temperatures
    { name: "mid", minW: 200, minH: 150 },    // + heure de fin, couche
    { name: "lite", minW: 150, minH: 100 },   // + etape
    { name: "bare", minW: 0, minH: 0 }        // avancement seul
  ];

  const SHOWN = {
    full: { stage: true, finish: true, temps: true, ams: true, extras: true },
    rich: { stage: true, finish: true, temps: true, ams: false, extras: false },
    mid: { stage: true, finish: true, temps: false, ams: false, extras: false },
    lite: { stage: true, finish: false, temps: false, ams: false, extras: false },
    bare: { stage: false, finish: false, temps: false, ams: false, extras: false }
  };

  function levelFor(w, h) {
    for (const l of LEVELS) if (w >= l.minW && h >= l.minH) return l.name;
    return "bare";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function temp(v) {
    return v == null ? "—" : Math.round(v) + "°";
  }

  /* « 2 h 18 » plutot que « 138 min » : c'est ce qu'on lit de loin. */
  function duration(ms, lang) {
    if (ms == null) return "";
    const total = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(total / 60), m = total % 60;
    if (h && m) return lang === "fr" ? h + " h " + String(m).padStart(2, "0") : h + "h " + m + "m";
    if (h) return lang === "fr" ? h + " h" : h + "h";
    return lang === "fr" ? m + " min" : m + "m";
  }

  function clock(iso, lang) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function fromManifest(label, lang) {
    if (!label) return "";
    return (lang === "fr" ? label.fr : label.en) || label.en || label.fr || "";
  }

  class BambuWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.state = null;
      this.lastAlertKey = "";
      this.cameraOpen = false;
      this.login = null;         // panneau de connexion au compte, si besoin
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-bambu" data-level="mid"><div class="pwb-msg">${esc(this.ctx.i18n.t("common.loading"))}</div></div>`;
      this.el = this.ctx.el.querySelector(".pw-bambu");
      this.wire();
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const s = Math.max(2, Number(this.ctx.settings.refresh) || 5);
      this.timer = setInterval(() => this.refresh(), s * 1000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.state = null;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }
    onResize() { this.render(); }

    wire() {
      this.ctx.el.addEventListener("click", (e) => {
        const btn = e.target.closest && e.target.closest("[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === "camera") this.openCamera();
        else if (act === "camera-close") this.closeCamera();
        else if (act === "login") this.submitLogin();
        else if (act === "retry") this.refresh();
      });
    }

    url() {
      const s = this.ctx.settings;
      const q = new URLSearchParams({
        mode: s.mode || "lan",
        host: s.host || "",
        serial: s.serial || "",
        model: s.model || "",
        name: s.printerName || "",
        region: s.region || "eu"
      });
      return "/api/bambu/" + encodeURIComponent(this.ctx.instanceId) + "/status?" + q.toString();
    }

    async refresh() {
      const s = this.ctx.settings;
      if (!s.serial || (s.mode !== "cloud" && !s.host)) {
        this.state = { setup: true };
        return this.render();
      }
      try {
        const res = await fetch(this.url(), { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          this.state = { failed: data.error || ("HTTP " + res.status), code: data.code || null };
          return this.render();
        }
        this.state = data;
        this.checkAlerts(data);
      } catch (e) {
        this.state = { failed: String(e.message || e) };
      }
      this.render();
    }

    /* ---------- Alertes ----------
       Sur TRANSITION seulement : sans cette memoire, une impression
       terminee ferait sonner le tableau a chaque rafraichissement.
       On transition only: without this memory a finished print would
       ring the board at every refresh. */
    checkAlerts(data) {
      const p = data && data.printer;
      if (!p) return;
      const s = this.ctx.settings;
      const errorKey = (p.errors || []).map((e) => e.code).join(",");
      const key = p.state + "|" + errorKey + "|" + (p.printError || "");
      if (!this.lastAlertKey) { this.lastAlertKey = key; return; }   // premier etat connu : rien a signaler
      if (key === this.lastAlertKey) return;
      const previous = this.lastAlertKey;
      this.lastAlertKey = key;

      const finished = p.state === "FINISH" && previous.indexOf("FINISH") !== 0;
      const failed = p.state === "FAILED" || (errorKey && previous.split("|")[1] !== errorKey) || p.printError;
      if (finished && s.alertOnFinish !== false) {
        this.fireAlert(this.ctx.i18n.t("bambu.alert.finished").replace("{name}", p.printName || ""));
      } else if (failed && s.alertOnError !== false) {
        const first = (p.errors || [])[0];
        this.fireAlert(this.ctx.i18n.t("bambu.alert.problem")
          .replace("{name}", p.printName || "")
          .replace("{code}", first ? first.code : (p.stageLabel ? fromManifest(p.stageLabel, this.ctx.i18n.lang) : "")));
      }
    }

    fireAlert(message) {
      const s = this.ctx.settings;
      const wantsFlash = s.flashScreen !== false;
      const wantsSound = s.playSound !== false;
      if ((wantsFlash || wantsSound) && this.ctx.api && this.ctx.api.startAlert) {
        this.ctx.api.startAlert({
          flash: wantsFlash,
          soundName: wantsSound ? (s.soundChoice || "beep-double") : null,
          durationMs: Math.max(1, Number(s.alertDurationSeconds) || 30) * 1000,
          onEnd: () => {}
        });
      }
      if (s.notifyUrl && this.ctx.api && this.ctx.api.notify) {
        const text = s.notifyMessage || message;
        const url = s.notifyUrl.indexOf("{message}") >= 0
          ? s.notifyUrl.replace("{message}", encodeURIComponent(text))
          : s.notifyUrl;
        this.ctx.api.notify(url, s.notifyMethod || "GET", text);
      }
    }

    /* ---------- Caméra ----------
       Le flux de l'imprimante n'est pas lisible tel quel par un
       navigateur : il passe par le meme relais que les chaines TV.
       Ouverte par-dessus le tableau, fermee au toucher.
       The printer's stream is not browser-readable as-is: it goes
       through the same relay as the TV channels. */
    openCamera() {
      const s = this.ctx.settings;
      if (!s.host) return;
      this.cameraOpen = true;
      this.render();
    }

    closeCamera() {
      this.cameraOpen = false;
      this.render();
    }

    async submitLogin() {
      const root = this.el;
      const account = (root.querySelector("[data-login-account]") || {}).value || "";
      const password = (root.querySelector("[data-login-password]") || {}).value || "";
      const code = (root.querySelector("[data-login-code]") || {}).value || "";
      const msg = root.querySelector("[data-login-msg]");
      if (msg) msg.textContent = this.ctx.i18n.t("bambu.login.working");
      try {
        const res = await fetch("/api/bambu/" + encodeURIComponent(this.ctx.instanceId) + "/cloud-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, password, code })
        });
        const data = await res.json();
        if (data.ok) { this.login = null; return this.refresh(); }
        this.login = { account, needCode: !!data.needCode, error: data.error || null };
      } catch (e) {
        this.login = { account, error: String(e.message || e) };
      }
      this.render();
    }

    render() {
      const el = this.el;
      if (!el) return;
      const t = (k) => this.ctx.i18n.t(k);
      const lang = this.ctx.i18n.lang;
      const s = this.ctx.settings;
      const level = levelFor(el.clientWidth || 300, el.clientHeight || 220);
      el.dataset.level = level;
      const show = SHOWN[level];
      const st = this.state || {};

      if (st.setup) return void (el.innerHTML = `<div class="pwb-msg">${esc(t("bambu.setup"))}</div>`);

      if (this.login || st.failed === "missing_token") {
        return void (el.innerHTML = this.loginHtml());
      }

      if (st.failed) {
        const why = st.code === "no-mqtt" ? t("bambu.err.noModule") : esc(st.failed);
        return void (el.innerHTML = `<div class="pwb-msg pwb-err">${esc(t("bambu.err.title"))}<small>${why}</small>
          <button type="button" class="pwb-btn" data-act="retry">${esc(t("bambu.retry"))}</button></div>`);
      }

      if (!st.printer) {
        /* Pas encore d'etat : soit la liaison se monte, soit elle est
           refusee -- et dans ce cas la cause est presque toujours le
           mode developpeur non active. On le dit, plutot que de laisser
           tourner un message d'attente sans fin.
           No state yet: almost always Developer mode left off. */
        const hint = st.errorKind === "auth" ? t("bambu.err.auth")
          : st.errorKind === "unreachable" || st.errorKind === "refused" ? t("bambu.err.unreachable")
            : t("bambu.connecting");
        return void (el.innerHTML = `<div class="pwb-msg">${esc(hint)}</div>`);
      }

      const p = st.printer;
      const printing = p.printing;
      const percent = p.percent == null ? 0 : p.percent;
      const stage = p.printing && p.stageLabel ? fromManifest(p.stageLabel, lang) : "";
      const stateText = p.stateLabel ? fromManifest(p.stateLabel, lang) : p.state;

      const parts = [];
      parts.push(`<div class="pwb-head">
        <span class="pwb-name">${esc(p.name || p.model || t("bambu.printer"))}</span>
        ${p.errors.length ? `<span class="pwb-badge pwb-badge-err" title="${esc(p.errors[0].code)}">!</span>` : ""}
        ${show.extras && s.showCamera && s.mode !== "cloud" ? `<button type="button" class="pwb-icon" data-act="camera" title="${esc(t("bambu.camera"))}">◉</button>` : ""}
      </div>`);

      parts.push(`<div class="pwb-ring" style="--pct:${percent}">
        <div class="pwb-ring-in">
          <span class="pwb-pct">${printing ? Math.round(percent) + "%" : (p.state === "FINISH" ? "✓" : "—")}</span>
          ${show.stage && (stage || stateText) ? `<span class="pwb-stage">${esc(stage || stateText)}</span>` : ""}
        </div>
      </div>`);

      if (printing && show.finish) {
        const remain = duration(p.remainingMs, lang);
        parts.push(`<div class="pwb-line">
          ${p.finishAt ? `<span class="pwb-finish">${esc(t("bambu.finishAt").replace("{time}", clock(p.finishAt, lang)))}</span>` : ""}
          ${remain ? `<span class="pwb-remain">${esc(remain)}</span>` : ""}
          ${p.layer != null && p.totalLayers ? `<span class="pwb-layer">${esc(t("bambu.layer").replace("{n}", p.layer).replace("{total}", p.totalLayers))}</span>` : ""}
        </div>`);
      }

      if (printing && show.finish && p.printName) {
        parts.push(`<div class="pwb-file" title="${esc(p.printName)}">${esc(p.printName)}</div>`);
      }

      /* Veille utile : une machine a l'arret n'a pas a donner une tuile
         vide -- la derniere impression et la chaleur residuelle disent
         deja beaucoup.
         Useful idle state: the last print and residual heat. */
      if (!printing && s.showIdleDetails !== false && show.stage) {
        const outcome = p.state === "FINISH" ? t("bambu.lastOk") : p.state === "FAILED" ? t("bambu.lastFailed") : "";
        parts.push(`<div class="pwb-line pwb-idle">
          ${p.printName ? `<span class="pwb-file">${esc(p.printName)}</span>` : `<span class="pwb-file">${esc(t("bambu.noPrint"))}</span>`}
          ${outcome ? `<span class="pwb-outcome">${esc(outcome)}</span>` : ""}
        </div>`);
      }

      if (show.temps && s.showTemps !== false) {
        const cells = [];
        cells.push(this.tempCell("⬓", t("bambu.bed"), p.bed));
        p.nozzles.forEach((n, i) => cells.push(this.tempCell("▽", p.nozzles.length > 1 ? t("bambu.nozzle") + " " + (i + 1) : t("bambu.nozzle"), n)));
        if (p.chamber) cells.push(this.tempCell("▣", t("bambu.chamber"), p.chamber));
        parts.push(`<div class="pwb-temps">${cells.join("")}</div>`);
      }

      if (show.ams && s.showAms && p.ams.length) {
        parts.push(`<div class="pwb-ams">${p.ams.map((u) => `
          <div class="pwb-ams-unit">
            <div class="pwb-trays">${u.trays.map((tr) => `
              <span class="pwb-tray${tr.active ? " pwb-tray-on" : ""}" title="${esc(tr.type)}"
                style="${tr.color ? "background:" + esc(tr.color) : ""}"></span>`).join("")}</div>
            ${u.humidity != null ? `<span class="pwb-hum">${esc(t("bambu.humidity").replace("{n}", u.humidity))}</span>` : ""}
          </div>`).join("")}</div>`);
      }

      if (show.extras && p.errors.length) {
        parts.push(`<div class="pwb-errors">${p.errors.slice(0, 2).map((e) => `<span>${esc(e.code)}</span>`).join("")}</div>`);
      }

      if (this.cameraOpen) parts.push(this.cameraHtml());

      el.innerHTML = parts.join("");
    }

    tempCell(icon, label, pair) {
      const target = pair && pair.target ? pair.target : null;
      /* La consigne n'est montree que si elle differe de la mesure :
         sinon la tuile repete deux fois le meme nombre. Un ecart signe
         une chauffe ou un refroidissement en cours, et c'est
         precisement ce qu'on veut voir.
         The target only shows when it differs from the reading. */
      const heating = target && pair.current != null && Math.abs(target - pair.current) > 2;
      return `<div class="pwb-temp${heating ? " pwb-heating" : ""}">
        <span class="pwb-temp-ico">${icon}</span>
        <span class="pwb-temp-val">${esc(temp(pair && pair.current))}</span>
        ${heating ? `<span class="pwb-temp-tgt">→ ${esc(temp(target))}</span>` : ""}
        <span class="pwb-temp-lbl">${esc(label)}</span>
      </div>`;
    }

    cameraHtml() {
      const s = this.ctx.settings;
      /* Le serveur convertit le flux de l'imprimante en une suite
         d'images JPEG : une balise <img> suffit, sans lecteur video ni
         bibliotheque. L'horodatage empeche le navigateur de resservir
         la meme connexion a la reouverture.
         The server turns the stream into MJPEG: a plain <img> is
         enough. */
      const src = "/api/bambu/" + encodeURIComponent(this.ctx.instanceId)
        + "/camera?host=" + encodeURIComponent(s.host) + "&_=" + Date.now();
      return `<div class="pwb-cam">
        <button type="button" class="pwb-cam-close" data-act="camera-close">✕</button>
        <img class="pwb-cam-img" alt="" src="${esc(src)}">
      </div>`;
    }

    loginHtml() {
      const t = (k) => this.ctx.i18n.t(k);
      const l = this.login || {};
      return `<div class="pwb-login">
        <div class="pwb-login-title">${esc(t("bambu.login.title"))}</div>
        <input type="email" data-login-account value="${esc(l.account || "")}" placeholder="${esc(t("bambu.login.account"))}" autocomplete="off">
        ${l.needCode
    ? `<input type="text" data-login-code placeholder="${esc(t("bambu.login.code"))}" inputmode="numeric" autocomplete="off">`
    : `<input type="password" data-login-password placeholder="${esc(t("bambu.login.password"))}" autocomplete="off">`}
        <button type="button" class="pwb-btn" data-act="login">${esc(l.needCode ? t("bambu.login.verify") : t("bambu.login.send"))}</button>
        <small data-login-msg class="pwb-login-msg">${esc(l.error || (l.needCode ? t("bambu.login.codeSent") : ""))}</small>
      </div>`;
    }

    destroy() {
      clearInterval(this.timer);
      // La liaison cesse d'etre entretenue : le serveur la ferme.
      fetch("/api/bambu/" + encodeURIComponent(this.ctx.instanceId) + "/link", { method: "DELETE" }).catch(() => {});
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { levelFor, duration, temp, clock, LEVELS, SHOWN };
  } else {
    window.PiBoard.registerWidget("bambu", BambuWidget);
  }
})();
