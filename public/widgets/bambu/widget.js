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
      this.tokenReady = false;   // jeton du compte deja dans le coffre ?
      this.loginOpen = false;    // panneau de saisie a l'ecran : ne rien reecrire
      this.cloudList = [];       // imprimantes rattachees au compte
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
      // Rien a rafraichir tant qu'on saisit ses identifiants : la
      // minuterie ne repart qu'une fois la connexion faite.
      // Nothing to refresh while credentials are being typed.
      if (this.loginOpen) return;
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
        else if (act === "login") this.submitLogin(false);
        else if (act === "resend") this.submitLogin(true);
        else if (act === "pick") this.pickPrinter(btn);
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
      /* TANT QUE L'ON SAISIT, ON NE REECRIT RIEN. La tuile se
         rafraichit toutes les quelques secondes ; comme chaque rendu
         reconstruit le contenu, le panneau de connexion etait remplace
         par un panneau NEUF -- donc vide -- au milieu de la frappe. On
         ne pouvait meme pas finir d'ecrire son adresse (1.115.2).
         WHILE THE USER IS TYPING, NOTHING IS REWRITTEN. Each render
         rebuilds the content, so the sign-in panel was replaced by a
         FRESH, empty one mid-typing. */
      if (this.loginOpen) return;
      /* En liaison cloud, la connexion au compte vient AVANT tout le
         reste : sans elle on ne connait meme pas la liste des
         imprimantes, donc pas leur numero de serie. Reclamer le numero
         d'abord enfermait la tuile dans « choisissez votre imprimante »
         et le panneau de connexion n'etait jamais atteint (1.115.1).
         On the cloud link, signing in comes BEFORE everything else:
         without it we do not even know the printer list, hence no
         serial number. Asking for the serial first locked the tile out
         of its own sign-in panel. */
      if (s.mode === "cloud" && !this.tokenReady) {
        const ok = await this.checkCloudToken();
        if (!ok) return this.render();
        if (!s.serial) { this.state = { pickPrinter: true }; return this.renderPrinterPick(); }
      }
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

    /* Le jeton est-il deja dans le coffre ? La reponse decide entre le
       panneau de connexion et la suite.
       Is the token already in the vault? */
    async checkCloudToken() {
      try {
        const res = await fetch("/api/bambu/" + encodeURIComponent(this.ctx.instanceId)
          + "/cloud-printers?region=" + encodeURIComponent(this.ctx.settings.region || ""), { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          this.tokenReady = true;
          this.cloudList = data.printers || [];
          this.login = null;
          return true;
        }
        this.login = this.login || {};
        return false;
      } catch (e) {
        this.state = { failed: String(e.message || e) };
        return false;
      }
    }

    /* Choix de l'imprimante parmi celles du compte, dans la tuile : on
       evite l'oeuf et la poule (il faut etre connecte pour connaitre la
       liste, et la liste pour se connecter a une machine).
       Picking the printer among the account's, inside the tile. */
    renderPrinterPick() {
      this.loginOpen = false;
      const t = (k) => this.ctx.i18n.t(k);
      const list = this.cloudList || [];
      this.el.innerHTML = `<div class="pwb-login">
        <div class="pwb-login-title">${esc(t("bambu.pick.title"))}</div>
        ${list.length ? list.map((p) => `<button type="button" class="pwb-btn" data-act="pick" data-serial="${esc(p.serial)}"
            data-model="${esc(p.model)}" data-name="${esc(p.name)}">${esc(p.name || p.serial)}${p.model ? " — " + esc(p.model) : ""}</button>`).join("")
    : `<small class="pwb-login-msg">${esc(t("bambu.pick.empty"))}</small>`}
      </div>`;
    }

    pickPrinter(btn) {
      this.ctx.updateSettings({
        serial: btn.dataset.serial,
        model: btn.dataset.model || "",
        printerName: btn.dataset.name || ""
      });
      this.ctx.settings = Object.assign({}, this.ctx.settings, {
        serial: btn.dataset.serial, model: btn.dataset.model || "", printerName: btn.dataset.name || ""
      });
      this.refresh();
    }

    async submitLogin(resend) {
      const root = this.el;
      const account = (root.querySelector("[data-login-account]") || {}).value || "";
      const password = (root.querySelector("[data-login-password]") || {}).value || "";
      const code = (root.querySelector("[data-login-code]") || {}).value || "";
      const msg = root.querySelector("[data-login-msg]");
      if (msg) msg.textContent = this.ctx.i18n.t("bambu.login.working");
      // L'adresse est conservee d'une etape a l'autre.
      this.login = Object.assign({}, this.login, { account });
      try {
        const res = await fetch("/api/bambu/" + encodeURIComponent(this.ctx.instanceId) + "/cloud-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, password, code, region: this.ctx.settings.region || "",
            tfaKey: (this.login && this.login.tfaKey) || "", resend })
        });
        const data = await res.json();
        if (data.ok) {
          this.login = null;
          this.loginOpen = false;           // la minuterie peut repartir
          this.tokenReady = false;          // on relit la liste du compte
          this.arm();
          return this.refresh();
        }
        this.login = {
          account,
          needCode: !!data.needCode,
          tfaKey: data.tfaKey || (this.login && this.login.tfaKey) || null,
          resent: !!data.resent,
          error: data.error || null
        };
      } catch (e) {
        this.login = { account, needCode: !!(this.login && this.login.needCode), error: String(e.message || e) };
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

      if (st.pickPrinter) return void this.renderPrinterPick();
      if (st.setup) return void (el.innerHTML = `<div class="pwb-msg">${esc(t("bambu.setup"))}</div>`);

      if (this.login || st.failed === "missing_token") {
        return void this.showLogin();
      }

      if (st.failed) {
        const why = st.code === "no-mqtt" ? t("bambu.err.noModule") : esc(st.failed);
        return void (el.innerHTML = `<div class="pwb-msg pwb-err">${esc(t("bambu.err.title"))}<small>${why}</small>
          <button type="button" class="pwb-btn" data-act="retry">${esc(t("bambu.retry"))}</button></div>`);
      }

      if (!st.printer) {
        /* Pas encore d'etat. Le serveur dit POURQUOI quand il le sait :
           une attente sans fin n'apprend rien, et le cas le plus
           frequent -- une imprimante en mode LAN uniquement, donc
           absente du cloud -- se nomme (1.115.3).
           No state yet: the server says WHY when it knows. The
           commonest case, a LAN-only printer that is therefore absent
           from the cloud, is named. */
        const KEYS = {
          auth: "bambu.err.auth",
          unreachable: "bambu.err.unreachable",
          dns: "bambu.err.unreachable",
          subscribe: "bambu.err.subscribe",
          "no-connect": "bambu.err.noConnect",
          "printer-offline": "bambu.err.offline",
          "cloud-silent": "bambu.err.cloudSilent",
          "lan-silent": "bambu.err.lanSilent"
        };
        const key = KEYS[st.problem];
        if (!key) return void (el.innerHTML = `<div class="pwb-msg">${esc(t("bambu.connecting"))}</div>`);
        return void (el.innerHTML = `<div class="pwb-msg pwb-err">${esc(t("bambu.err.title"))}
          <small>${esc(t(key))}</small>
          ${st.error ? `<small class="pwb-detail">${esc(st.error)}</small>` : ""}
          <button type="button" class="pwb-btn" data-act="retry">${esc(t("bambu.retry"))}</button></div>`);
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

    /* Le panneau n'est ECRIT QU'UNE FOIS. S'il est deja a l'ecran, on
       ne remplace que ce qui a change (le message, et le passage du mot
       de passe au code) : les champs deja remplis restent intacts.
       The panel is WRITTEN ONLY ONCE; afterwards only what changed is
       replaced, so filled fields survive. */
    showLogin() {
      const wantCode = !!(this.login && this.login.needCode);
      const already = this.el.querySelector(".pwb-login");
      const sameStep = already && (!!already.querySelector("[data-login-code]") === wantCode);
      if (sameStep) {
        const msg = this.el.querySelector("[data-login-msg]");
        if (msg) msg.textContent = this.loginMessage();
        return;
      }
      /* On change d'etape (mot de passe -> code) : l'adresse deja
         saisie est reportee plutot que d'etre a retaper.
         Moving to the code step: the address already typed is carried
         over rather than retyped. */
      const typed = (this.el.querySelector("[data-login-account]") || {}).value;
      if (typed && this.login) this.login.account = typed;
      this.loginOpen = true;
      clearInterval(this.timer);
      this.el.innerHTML = this.loginHtml();
      const first = this.el.querySelector(wantCode ? "[data-login-code]" : "[data-login-account]");
      if (first && first.focus) first.focus();
    }

    loginMessage() {
      const t = (k) => this.ctx.i18n.t(k);
      const l = this.login || {};
      return l.error
        || (l.resent ? t("bambu.login.codeSent") : "")
        || (l.tfaKey ? t("bambu.login.tfa") : "")
        || (l.needCode ? t("bambu.login.codeSent") : "");
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
        ${l.needCode && !l.tfaKey ? `<button type="button" class="pwb-btn" data-act="resend">${esc(t("bambu.login.resend"))}</button>` : ""}
        <small data-login-msg class="pwb-login-msg">${esc(this.loginMessage())}</small>
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
