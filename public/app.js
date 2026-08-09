/* ============================================================
   PiBoard - app.js
   Version 1.49.0

   Coeur du tableau de bord :
     - grille Gridstack (12 colonnes) et persistance serveur, plus un
       tiroir lateral de tuiles independant
     - chargement dynamique des widgets (catalogue serveur)
     - languette + barre d'outils escamotable (ajout, edition, reglages,
       aide, menu de sortie : reinitialiser le tableau de bord ou
       revenir au bureau de Raspberry Pi OS)
     - mode tactile optionnel : cibles agrandies partout (boutons,
       poignees, formulaires), formulaires de configuration repartis
       automatiquement en colonnes selon la hauteur reelle des sections
       (voir layoutFormColumns())
     - economiseur d'ecran : plages horaires en noir ou en diaporama
       (reutilise directement la classe SlideshowWidget), plus un
       declenchement manuel depuis la barre d'outils
     - aide integree bilingue (voir help-content.js), navigable par
       sommaire
     - theme jour/nuit automatique (calcul solaire NOAA local)
     - synchronisation multi-clients par SSE

   Dashboard core:
     - Gridstack grid (12 columns) with server persistence, plus an
       independent side tile drawer
     - dynamic widget loading (server catalog)
     - pull tab + collapsible toolbar (add, edit, settings, help, exit
       menu: reset the dashboard or return to the Raspberry Pi OS
       desktop)
     - optional touch mode: enlarged targets everywhere (buttons,
       handles, forms), config forms automatically laid out in columns
       based on each section's real height (see layoutFormColumns())
     - screen saver: time slots in black or slideshow mode (directly
       reuses the SlideshowWidget class), plus a manual trigger from the
       toolbar
     - built-in bilingual help (see help-content.js), browsable by table
       of contents
     - automatic day/night theme (local NOAA solar calc)
     - multi-client sync through SSE
   ============================================================ */
(function () {
  "use strict";

  const i18n = window.PiBoardI18n;
  const CLIENT_ID = "c-" + Math.random().toString(36).slice(2, 10);
  const COLS = 12; // colonnes du tableau ET du tiroir : Gridstack n'a de
  // regles CSS de largeur precompilees que pour 1 et 12 colonnes ; un autre
  // nombre (ex. 6) laisse les tuiles a largeur nulle, invisibles.
  // columns for the board AND the drawer: Gridstack only ships precompiled
  // width CSS rules for 1 and 12 columns; any other count (e.g. 6) leaves
  // tiles at zero width, invisible. The drawer stays compact simply
  // because its container is narrower (50vw), not via a different column count.

  let grid = null;
  let drawerGrid = null;
  let drawerWidthPct = 50;
  let settings = null;
  let catalog = [];                 // manifestes / manifests
  const widgetClasses = new Map();  // id -> classe / class
  const tiles = new Map();          // tileId -> { conf, instance, manifest }
  let editing = false;
  let saveTimer = null;
  let themeTimer = null;
  let scheduleTicker = null;        // reevalue la planification des tuiles / re-evaluates tile scheduling

  /* ---------- Registre public des widgets / public widget registry ---------- */

  window.PiBoard = {
    registerWidget(id, klass) { widgetClasses.set(id, klass); }
  };

  /* ---------- Petites aides / small helpers ---------- */

  const $ = (id) => document.getElementById(id);

  /* Active un element de facon fiable au clic souris ET au tap tactile.
     Sur un ecran tactile, l'evenement "click" synthetise a partir d'un
     tap peut etre retarde (~300ms) ou perdu selon le contexte, ce qui
     donne l'impression de clics "aleatoires" un coup sur deux. On ecoute
     donc "pointerup" (unifie souris + doigt + stylet, emis directement
     par le geste), avec un garde-fou : ne declencher que si le geste est
     un vrai tap/clic (bouton principal ou tactile), et pas la fin d'un
     glissement. Un fallback "click" reste branche pour les rares
     environnements sans Pointer Events (tres anciens navigateurs).
     Reliably activates an element on both mouse click AND touch tap.
     On a touchscreen, the "click" synthesized from a tap can be delayed
     (~300ms) or lost depending on context, giving the impression of
     "random" clicks working every other time. So we listen to
     "pointerup" (unifies mouse + finger + stylus, emitted directly by
     the gesture), with a guard: only fire on a real tap/click (primary
     or touch), not the end of a drag. A "click" fallback stays wired for
     the rare environments without Pointer Events (very old browsers). */
  function onActivate(el, handler) {
    if (!el) return;
    let usedPointer = false;
    if (window.PointerEvent) {
      el.addEventListener("pointerup", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return; // clic droit/milieu ignore
        usedPointer = true;
        handler(e);
      });
    }
    // Fallback : si Pointer Events indisponible, ou pour tout chemin qui
    // n'emettrait qu'un click classique. Le drapeau evite le double
    // declenchement quand pointerup a deja fait le travail.
    // Fallback: if Pointer Events unavailable, or for any path emitting
    // only a classic click. The flag prevents double firing when
    // pointerup already did the job.
    el.addEventListener("click", (e) => {
      if (usedPointer) { usedPointer = false; return; }
      handler(e);
    });
  }

  async function apiGet(url) {
    const r = await fetch(url, { headers: { "x-piboard-client": CLIENT_ID } });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  }

  async function apiPut(url, body) {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-piboard-client": CLIENT_ID },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  }

  async function apiDelete(url) {
    const r = await fetch(url, { method: "DELETE", headers: { "x-piboard-client": CLIENT_ID } });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  }

  const widgetApi = {
    state: {
      get: (key) => apiGet("/api/state/" + encodeURIComponent(key)).then((d) => d.value),
      put: (key, value) => apiPut("/api/state/" + encodeURIComponent(key), { value })
    },
    proxyUrl: (url) => "/api/proxy?url=" + encodeURIComponent(url),
    /* Appelle une URL de notification (webhook) via le serveur, pour eviter
       tout probleme de CORS. Utilisable avec ntfy.sh, Voice Monkey (Alexa),
       l'API SMS Free Mobile, Home Assistant, Pushover, IFTTT, etc.
       Calls a notification URL (webhook) through the server, to avoid any
       CORS issue. Works with ntfy.sh, Voice Monkey (Alexa), the Free
       Mobile SMS API, Home Assistant, Pushover, IFTTT, etc. */
    notify(url, method, body) {
      if (!url) return Promise.resolve();
      return apiPut("/api/notify", { url, method: method || "GET", body: body || "" })
        .catch((e) => console.warn("[piboard] notify failed", e));
    }
  };

  /* ============================================================
     Alerte de tableau (flash plein ecran + son), duree controlable
     et interruptible. Utilisee par le compte a rebours ; exposee via
     widgetApi pour que d'autres widgets puissent s'en servir plus tard.
     Board alert (full-screen flash + sound), controllable duration and
     stoppable. Used by the countdown; exposed via widgetApi so other
     widgets can use it later too.
     ============================================================ */
  const boardAlert = (() => {
    function tone(ctx, t, freq, dur, type) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    function bellTone(ctx, t, freq, dur) {
      // Superposition de partiels non harmoniques : timbre approximatif de cloche
      // Stacked inharmonic partials: an approximate bell timbre
      [1, 2.4, 3.8].forEach((mult, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        const amp = 0.22 / (i + 1);
        gain.gain.setValueAtTime(amp, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    }

    /* Chaque son planifie UN cycle a partir de t0 et renvoie sa duree en
       secondes (silence inclus avant la repetition suivante).
       Each sound schedules ONE cycle starting at t0 and returns its
       duration in seconds (including the gap before the next repeat). */
    const SOUNDS = {
      "beep-simple": (ctx, t0) => { tone(ctx, t0, 880, 0.3, "sine"); return 0.6; },
      "beep-double": (ctx, t0) => {
        tone(ctx, t0, 988, 0.15, "sine");
        tone(ctx, t0 + 0.22, 988, 0.15, "sine");
        return 0.75;
      },
      "siren-police": (ctx, t0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        gain.gain.setValueAtTime(0.28, t0);
        osc.frequency.setValueAtTime(600, t0);
        osc.frequency.linearRampToValueAtTime(900, t0 + 0.6);
        osc.frequency.linearRampToValueAtTime(600, t0 + 1.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 1.2);
        return 1.3;
      },
      "siren-firefighter": (ctx, t0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.2, t0);
        osc.frequency.setValueAtTime(500, t0);
        osc.frequency.linearRampToValueAtTime(760, t0 + 0.3);
        osc.frequency.linearRampToValueAtTime(500, t0 + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.6);
        return 0.65;
      },
      "siren-fire-alarm": (ctx, t0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 970;
        for (let i = 0; i < 4; i++) {
          const s = t0 + i * 0.15;
          gain.gain.setValueAtTime(0.0001, s);
          gain.gain.exponentialRampToValueAtTime(0.26, s + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.11);
        }
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.65);
        return 0.7;
      },
      "siren-submarine": (ctx, t0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.3, t0);
        osc.frequency.setValueAtTime(300, t0);
        osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.8);
        gain.gain.setValueAtTime(0.3, t0 + 0.8);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + 1.0);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 1.0);
        return 1.4;
      },
      "bell-train": (ctx, t0) => {
        bellTone(ctx, t0, 1300, 0.5);
        bellTone(ctx, t0 + 0.45, 1300, 0.5);
        return 1.1;
      },
      "bell-door": (ctx, t0) => {
        bellTone(ctx, t0, 1046, 0.6);
        bellTone(ctx, t0 + 0.35, 784, 0.7);
        return 1.4;
      },
      "jingle": (ctx, t0) => {
        [523, 659, 784, 1046].forEach((f, i) => tone(ctx, t0 + i * 0.14, f, 0.16, "triangle"));
        return 1.0;
      }
    };

    let state = { active: false, endTimer: null, soundTimer: null, flashEl: null, ctx: null };

    function stop() {
      clearTimeout(state.endTimer);
      clearTimeout(state.soundTimer);
      if (state.flashEl && state.flashEl.parentNode) state.flashEl.remove();
      if (state.ctx) { try { state.ctx.close(); } catch (e) { /* deja ferme */ } }
      state = { active: false, endTimer: null, soundTimer: null, flashEl: null, ctx: null };
    }

    function start({ flash, soundName, durationMs, onEnd }) {
      stop(); // une seule alerte a la fois / only one alert at a time
      const dur = Math.max(1000, Math.min(300000, durationMs || 60000));
      state.active = true;

      if (flash) {
        const overlay = document.createElement("div");
        overlay.className = "board-flash board-flash-loop";
        document.body.appendChild(overlay);
        state.flashEl = overlay;
      }

      if (soundName) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const ctx = new Ctx();
          state.ctx = ctx;
          const gen = SOUNDS[soundName] || SOUNDS["beep-simple"];
          const endAt = ctx.currentTime + dur / 1000;
          const scheduleNext = () => {
            if (!state.active || ctx.currentTime >= endAt) return;
            const cycleDur = gen(ctx, ctx.currentTime + 0.03);
            state.soundTimer = setTimeout(scheduleNext, Math.max(60, (cycleDur - 0.03) * 1000));
          };
          scheduleNext();
        } catch (e) { /* pas d'audio disponible / no audio available */ }
      }

      state.endTimer = setTimeout(() => { stop(); if (onEnd) onEnd(); }, dur);
    }

    return { start, stop, isActive: () => state.active, SOUND_NAMES: Object.keys(SOUNDS) };
  })();

  widgetApi.startAlert = boardAlert.start;
  widgetApi.stopAlert = boardAlert.stop;
  widgetApi.isAlertActive = boardAlert.isActive;
  window.PiBoard.startAlert = boardAlert.start;
  window.PiBoard.stopAlert = boardAlert.stop;

  /* ============================================================
     Clavier virtuel (ecrans tactiles) / on-screen keyboard
     Mecanisme du coeur, applicable a tout input[type=text] et
     textarea de l'application (formulaires de reglages ET edition
     directe dans un widget, ex. bloc-notes). Bascule AZERTY/QWERTY
     selon la langue de l'interface. Se positionne au-dessus OU en
     dessous du champ actif selon la place disponible, pour ne
     jamais le masquer.
     Core mechanism, applicable to any input[type=text] and textarea
     in the app (settings forms AND direct in-widget editing, e.g.
     notes). Switches AZERTY/QWERTY based on the interface language.
     Positions itself above OR below the active field depending on
     available room, so it never covers it.
     ============================================================ */
  const vkb = (() => {
    const LAYOUTS = {
      fr: {
        letters: [
          ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
          ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
          ["w", "x", "c", "v", "b", "n", "'", "-"]
        ],
        symbols: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
          ["@", "#", "&", "_", "(", ")", "€", "%", "+", "="],
          ["!", "?", ",", ".", ";", ":", "/", "\""]
        ]
      },
      en: {
        letters: [
          ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
          ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
          ["z", "x", "c", "v", "b", "n", "m", "'", "-"]
        ],
        symbols: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
          ["@", "#", "&", "_", "(", ")", "$", "%", "+", "="],
          ["!", "?", ",", ".", ";", ":", "/", "\""]
        ]
      }
    };

    let enabled = false;
    let lang = "en";
    let panel = null;
    let target = null;   // element input/textarea actif
    let shift = false;
    let page = "letters"; // "letters" | "symbols"

    function isTypable(el) {
      if (!el) return false;
      if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
      if (el.tagName === "INPUT") {
        const t = (el.getAttribute("type") || "text").toLowerCase();
        return (t === "text" || t === "url" || t === "search") && !el.readOnly && !el.disabled;
      }
      return false;
    }

    function insertAtCursor(text) {
      if (!target) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const before = target.value.slice(0, start);
      const after = target.value.slice(end);
      target.value = before + text + after;
      const pos = start + text.length;
      target.setSelectionRange(pos, pos);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function backspace() {
      if (!target) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      if (start === end && start > 0) {
        target.value = target.value.slice(0, start - 1) + target.value.slice(end);
        target.setSelectionRange(start - 1, start - 1);
      } else {
        target.value = target.value.slice(0, start) + target.value.slice(end);
        target.setSelectionRange(start, start);
      }
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function keyBtn(label, cls, handler) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vkb-key" + (cls ? " " + cls : "");
      b.textContent = label;
      // pointerdown + preventDefault : le champ actif ne perd jamais le focus
      // pointerdown + preventDefault: the active field never loses focus
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); handler(); });
      return b;
    }

    function render() {
      if (!panel) return;
      panel.innerHTML = "";
      const layout = LAYOUTS[lang] || LAYOUTS.en;
      const rows = page === "symbols" ? layout.symbols : layout.letters;

      rows.forEach((row, i) => {
        const rowEl = document.createElement("div");
        rowEl.className = "vkb-row";
        row.forEach((ch) => {
          const label = page === "letters" && shift ? ch.toUpperCase() : ch;
          rowEl.appendChild(keyBtn(label, "", () => insertAtCursor(label)));
        });
        if (i === rows.length - 1 && page === "letters") {
          rowEl.appendChild(keyBtn("⌫", "vkb-wide", backspace));
        }
        panel.appendChild(rowEl);
      });

      const bottom = document.createElement("div");
      bottom.className = "vkb-row";
      bottom.appendChild(keyBtn(
        page === "letters" ? i18n.t("vkb.symbols") : i18n.t("vkb.letters"),
        "vkb-wide",
        () => { page = page === "letters" ? "symbols" : "letters"; render(); }
      ));
      if (page === "letters") {
        bottom.appendChild(keyBtn(i18n.t("vkb.shift"), "vkb-wide" + (shift ? " vkb-active" : ""),
          () => { shift = !shift; render(); }));
      }
      bottom.appendChild(keyBtn(i18n.t("vkb.space"), "vkb-space", () => insertAtCursor(" ")));
      if (page === "symbols") {
        bottom.appendChild(keyBtn("⌫", "vkb-wide", backspace));
      }
      bottom.appendChild(keyBtn(i18n.t("vkb.done"), "vkb-wide vkb-done", () => hide()));
      panel.appendChild(bottom);

      reposition();
    }

    /* Place le clavier au-dessus OU en dessous du champ actif, selon la
       place disponible, pour ne jamais le recouvrir.
       Places the keyboard above OR below the active field, depending on
       available room, so it never covers it. */
    function reposition() {
      if (!panel || !target) return;
      const rect = target.getBoundingClientRect();
      const kbH = panel.offsetHeight || 230;
      const margin = 10;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      let top;
      if (spaceBelow >= kbH + margin || spaceBelow >= spaceAbove) {
        top = Math.min(rect.bottom + margin, window.innerHeight - kbH - margin);
      } else {
        top = Math.max(margin, rect.top - kbH - margin);
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - kbH - margin));
      panel.style.top = top + "px";
    }

    function show(el) {
      if (!enabled || !isTypable(el)) return;
      target = el;
      shift = false;
      page = "letters";
      if (!panel) panel = $("vkb");
      panel.hidden = false;
      render();
    }

    function hide() {
      if (panel) panel.hidden = true;
      if (target && document.activeElement === target) target.blur();
      target = null;
    }

    function attach() {
      document.addEventListener("focusin", (e) => {
        if (isTypable(e.target)) show(e.target);
        else if (panel && !panel.hidden && !panel.contains(e.target)) hide();
      });
      window.addEventListener("resize", () => { if (panel && !panel.hidden) reposition(); });
    }

    return {
      attach,
      setEnabled(v) { enabled = v; if (!v) hide(); },
      setLang(l) { lang = l === "fr" ? "fr" : "en"; if (panel && !panel.hidden) render(); },
      hide
    };
  })();

  /* ---------- Theme : calcul solaire NOAA simplifie ----------
     Retourne {sunrise, sunset} en heures locales decimales.
     Returns {sunrise, sunset} as local decimal hours. */
  function solarTimes(date, lat, lon) {
    const rad = Math.PI / 180;
    const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const gamma = (2 * Math.PI / 365) * (day - 1 + (date.getHours() - 12) / 24);
    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
      - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
      - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    const cosHa = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)))
      - Math.tan(lat * rad) * Math.tan(decl);
    if (cosHa > 1 || cosHa < -1) {
      // Jour ou nuit polaire / polar day or night
      return cosHa > 1 ? { sunrise: 12, sunset: 12 } : { sunrise: 0, sunset: 24 };
    }
    const ha = Math.acos(cosHa) / rad;
    const tzOffset = -date.getTimezoneOffset(); // minutes
    const sunrise = (720 - 4 * (lon + ha) - eqtime + tzOffset) / 60;
    const sunset = (720 - 4 * (lon - ha) - eqtime + tzOffset) / 60;
    return { sunrise, sunset };
  }

  const DEFAULT_COLORS = {
    dark: { bg: "#0B0E14", tile: "#141926" },
    light: { bg: "#EFEDE7", tile: "#FFFFFF" }
  };

  function currentColors() {
    const c = settings.colors || {};
    return {
      dark: Object.assign({}, DEFAULT_COLORS.dark, c.dark),
      light: Object.assign({}, DEFAULT_COLORS.light, c.light)
    };
  }

  function applyTheme() {
    let theme = settings.theme;
    if (theme === "auto") {
      const now = new Date();
      const { sunrise, sunset } = solarTimes(now, settings.latitude, settings.longitude);
      const h = now.getHours() + now.getMinutes() / 60;
      theme = (h >= sunrise && h < sunset) ? "light" : "dark";
    }
    document.body.dataset.theme = theme;
    // Couleurs personnalisees du fond et des tuiles / custom board & tile colors
    const colors = currentColors()[theme];
    document.body.style.setProperty("--bg", colors.bg);
    document.body.style.setProperty("--tile", colors.tile);
    clearTimeout(themeTimer);
    if (settings.theme === "auto") themeTimer = setTimeout(applyTheme, 60000);
  }

  /* ---------- Chargement des widgets / widget loading ---------- */

  function loadWidgetAssets(manifest) {
    return new Promise((resolve) => {
      const base = "widgets/" + manifest.dir + "/";
      if (manifest.css !== false) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = base + "widget.css";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = base + "widget.js";
      script.onload = () => resolve(true);
      script.onerror = () => { console.warn("[piboard] widget js failed:", manifest.id); resolve(false); };
      document.body.appendChild(script);
    });
  }

  /* ---------- Tuiles / tiles ---------- */

  function tileMarkup(conf, manifest) {
    const name = i18n.fromManifest(manifest ? manifest.name : conf.widget);
    return `
      <div class="tile-head">
        <span class="tile-name">${name}</span>
        <button class="tile-btn tile-gear" title="${i18n.t("tile.settings")}">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>
        </button>
        <button class="tile-btn tile-x" title="${i18n.t("tile.remove")}">
          <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
      <div class="tile-title" hidden>
        <img src="widgets/${manifest ? manifest.dir : conf.widget}/icon.svg" alt="">
        <span class="tile-title-text"></span>
      </div>
      <div class="tile-body"></div>`;
  }

  /* Barre de titre universelle : optionnelle sur chaque tuile.
     Texte = titre personnalise, sinon nom du widget (langue courante).
     Universal title bar: optional on every tile. Text = custom title,
     otherwise the widget name in the current language. */
  function applyTitleBar(rec) {
    const bar = rec.el.querySelector(".tile-title");
    if (!bar) return;
    const s = rec.conf.settings || {};
    const show = s._showTitle != null ? !!s._showTitle : !!(rec.manifest && rec.manifest.titleBar);
    bar.hidden = !show;
    bar.querySelector(".tile-title-text").textContent =
      s._title || s.title || (rec.manifest ? i18n.fromManifest(rec.manifest.name) : rec.conf.widget);
  }

  /* Couleur de tuile personnalisee : independante du theme jour/nuit et des
     couleurs globales. Vide/desactivee = couleur de tuile du theme courant.
     Custom tile color: independent from the day/night theme and global
     colors. Empty/disabled = current theme's tile color. */
  /* Luminance perceptuelle approximative d'une couleur hex (0 = noir, 1 = blanc)
     Approximate perceptual luminance of a hex color (0 = black, 1 = white) */
  function relLuminance(hex) {
    const c = (hex || "").replace("#", "");
    if (c.length !== 6) return 0.5;
    const r = parseInt(c.substr(0, 2), 16) / 255;
    const g = parseInt(c.substr(2, 2), 16) / 255;
    const b = parseInt(c.substr(4, 2), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const LIGHT_TEXT_PALETTE = { "--text": "#F3F5FA", "--muted": "#C3C9DB", "--faint": "#9AA1B8",
    "--tile-edge": "rgba(255,255,255,0.18)", "--field-bg": "rgba(255,255,255,0.08)" };
  const DARK_TEXT_PALETTE = { "--text": "#1B1F2A", "--muted": "#5B6272", "--faint": "#848CA0",
    "--tile-edge": "rgba(0,0,0,0.14)", "--field-bg": "rgba(0,0,0,0.05)" };
  const OVERRIDE_PROPS = Object.keys(LIGHT_TEXT_PALETTE);

  function applyTileColor(rec) {
    const content = rec.el.querySelector(".grid-stack-item-content");
    if (!content) return;
    const s = rec.conf.settings || {};
    if (s._customColor && s._bgColor) {
      content.style.backgroundColor = s._bgColor;
      // Le texte bascule automatiquement en clair ou en sombre selon la
      // luminosite de la couleur choisie, pour garder un contraste lisible
      // quel que soit le theme jour/nuit actif.
      // Text automatically switches to light or dark based on the chosen
      // color's luminance, to keep readable contrast regardless of the
      // active day/night theme.
      const palette = relLuminance(s._bgColor) < 0.5 ? LIGHT_TEXT_PALETTE : DARK_TEXT_PALETTE;
      for (const prop of OVERRIDE_PROPS) content.style.setProperty(prop, palette[prop]);
      // Certains elements de widget n'ecrivent pas explicitement
      // "color: var(--text)" et heritent simplement de la couleur deja
      // resolue du body : changer la variable seule ne les atteindrait pas.
      // On fixe donc aussi "color" directement, qui s'herite normalement.
      // Some widget elements don't explicitly write "color: var(--text)"
      // and just inherit the already-resolved body color: changing the
      // variable alone wouldn't reach them. So we also set "color"
      // directly, which inherits normally.
      content.style.color = palette["--text"];
    } else {
      content.style.backgroundColor = "";
      content.style.color = "";
      for (const prop of OVERRIDE_PROPS) content.style.removeProperty(prop);
    }
  }

  /* Taille du texte par tuile : agrandit uniformement tout le contenu du
     widget via la propriete CSS "zoom" (bien supportee par Chromium, le
     navigateur du kiosque). Les widgets a police auto-ajustee (citation,
     horloge...) se recalibrent d'eux-memes et ne changent pas ; ceux a
     tailles fixes en px (RSS, meteo...) grossissent, ce qui est le but.
     La tuile Trafic est exclue (le zoom CSS fausse les coordonnees de la
     carte Leaflet).
     Per-tile text size: uniformly enlarges the whole widget content via
     the CSS "zoom" property (well supported by Chromium, the kiosk's
     browser). Auto-fitting widgets (quote, clock...) recalibrate
     themselves and don't change; fixed-px ones (RSS, weather...) grow,
     which is the point. The Traffic tile is excluded (CSS zoom breaks
     the Leaflet map's coordinates). */
  function applyTextScale(rec) {
    const body = rec.el.querySelector(".tile-body");
    if (!body) return;
    // Trafic : le zoom CSS fausse les coordonnees de la carte Leaflet.
    // Citations : gere elle-meme l'echelle dans son propre calcul
    // d'ajustement (fit()), pour rester coherente avec son algorithme
    // qui vise deja "la plus grande taille qui tient" -- empiler un zoom
    // CSS par-dessus un dimensionnement JS deja optimise donnait des
    // interactions confuses (l'un peut annuler l'autre).
    // Traffic: CSS zoom breaks the Leaflet map's coordinates.
    // Quote: handles the scale itself within its own fit() calculation,
    // to stay consistent with its algorithm which already aims for "the
    // largest size that fits" -- stacking a CSS zoom on top of an
    // already-optimized JS sizing gave confusing interactions (one could
    // cancel out the other).
    if (rec.conf.widget === "traffic" || rec.conf.widget === "quote") {
      body.style.zoom = "";
      return;
    }
    const scale = Number((rec.conf.settings || {})._textScale) || 1;
    body.style.zoom = scale === 1 ? "" : String(scale);
  }

  /* Couleur hexadecimale actuelle d'une tuile (pour pre-remplir le selecteur)
     Current hex color of a tile (to pre-fill the color picker) */
  function currentTileColorHex(rec) {
    const s = rec.conf.settings || {};
    if (s._customColor && s._bgColor) return s._bgColor;
    const rgb = getComputedStyle(rec.el.querySelector(".grid-stack-item-content")).backgroundColor;
    const m = rgb.match(/\d+/g);
    if (!m) return "#141926";
    return "#" + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  }

  async function mountTile(conf, zone) {
    zone = zone || "board";
    const targetGrid = zone === "drawer" ? drawerGrid : grid;
    const manifest = catalog.find((m) => m.id === conf.widget);

    // Garde-fou : une tuile enregistree AVANT que son minimum de manifest
    // ne soit releve (ex. tuile Trafic sauvee en 2x2 alors que le minimum
    // est passe a 4x3) resterait sinon sous la taille minimale, car
    // Gridstack n'applique minW/minH qu'a la creation, pas retroactivement
    // aux dimensions fournies. On hisse donc conf.w/conf.h au minimum ici,
    // ce qui evite les chevauchements d'overlays sur une tuile trop petite.
    // Safety net: a tile saved BEFORE its manifest minimum was raised
    // (e.g. a Traffic tile saved at 2x2 while the minimum is now 4x3)
    // would otherwise stay below the minimum size, because Gridstack only
    // applies minW/minH at creation, not retroactively to the provided
    // dimensions. So we raise conf.w/conf.h to the minimum here, which
    // prevents overlapping overlays on a too-small tile.
    if (manifest && manifest.size) {
      if (manifest.size.minW) conf.w = Math.max(conf.w || 1, manifest.size.minW);
      if (manifest.size.minH) conf.h = Math.max(conf.h || 1, manifest.size.minH);
    }

    const el = targetGrid.addWidget({
      x: conf.x, y: conf.y, w: conf.w, h: conf.h,
      minW: manifest && manifest.size ? manifest.size.minW : 1,
      minH: manifest && manifest.size ? manifest.size.minH : 1,
      maxW: manifest && manifest.size ? manifest.size.maxW : undefined,
      maxH: manifest && manifest.size ? manifest.size.maxH : undefined,
      content: tileMarkup(conf, manifest)
    });
    el.dataset.tileId = conf.id;

    const record = { conf, manifest, instance: null, el, zone };
    tiles.set(conf.id, record);
    applyTitleBar(record);
    applyTileColor(record);
    applyTextScale(record);

    onActivate(el.querySelector(".tile-gear"), (e) => {
      e.stopPropagation();
      openTileSettings(conf.id);
    });
    onActivate(el.querySelector(".tile-x"), (e) => {
      e.stopPropagation();
      removeTile(conf.id);
    });

    // Demarre le widget, ou le laisse d'emblee en pause si sa
    // planification l'exclut a cet instant (voir syncTileSchedule).
    // Starts the widget, or leaves it paused from the outset if its
    // schedule excludes it right now (see syncTileSchedule).
    syncTileSchedule(record);
  }

  /* ---------- Planification par tuile / per-tile scheduling ----------
     Une tuile hors de sa plage n'est PAS masquee (la disposition ne bouge
     jamais) : elle reste en place avec un message "En pause", et son
     widget est reellement DETRUIT. C'est le vrai interet de la
     fonctionnalite : un widget detruit arrete ses minuteries et ses
     appels reseau -- la tuile Trajet cesse par exemple de consommer le
     quota TomTom la nuit et le week-end.
     A tile outside its window is NOT hidden (the layout never moves): it
     stays in place with a "Paused" message, and its widget is actually
     DESTROYED. That's the real point of the feature: a destroyed widget
     stops its timers and network calls -- the Commute tile, for
     instance, stops eating the TomTom quota at night and on weekends. */

  // Indexees par Date.getDay() (0 = dimanche) / indexed by Date.getDay()
  // (0 = Sunday).
  const SCHED_DAY_KEYS = ["_schedSun", "_schedMon", "_schedTue", "_schedWed", "_schedThu", "_schedFri", "_schedSat"];
  // Ordre d'affichage : semaine d'abord, dimanche en dernier (usage
  // francais/europeen). Display order: week first, Sunday last
  // (French/European convention).
  const SCHED_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function schedDayLabels() {
    const locale = i18n.t("clock.date.format");
    // 7 janvier 2024 etait un dimanche : donne les 7 noms dans l'ordre de
    // getDay(). January 7, 2024 was a Sunday: yields the 7 names in
    // getDay() order.
    return [...Array(7)].map((_, i) =>
      new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" }));
  }

  function parseHHMM(v) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ""));
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /* Vraie si la tuile doit tourner maintenant. Sans planification active,
     toujours vraie -- une tuile existante ne change donc pas de
     comportement.
     True if the tile should be running now. With no active schedule,
     always true -- an existing tile therefore doesn't change behavior. */
  function isWithinSchedule(s, now) {
    if (!s || s._schedEnabled !== true) return true;
    const days = SCHED_DAY_KEYS.map((k) => !!s[k]);
    // Aucun jour coche = tous les jours, plutot qu'une tuile
    // definitivement en pause (qui aurait tout l'air d'un bug).
    // No day checked = every day, rather than a permanently paused tile
    // (which would look exactly like a bug).
    const anyDay = days.some(Boolean);
    const dayOk = (d) => !anyDay || days[d];

    const from = parseHHMM(s._schedFrom);
    const to = parseHHMM(s._schedTo);
    // Plage horaire incomplete ou degeneree : on ne filtre que sur les
    // jours. Incomplete or degenerate time window: filter on days only.
    if (from == null || to == null || from === to) return dayOk(now.getDay());

    const mins = now.getHours() * 60 + now.getMinutes();
    if (from < to) return dayOk(now.getDay()) && mins >= from && mins < to;

    // Plage a cheval sur minuit (ex. 22:00 -> 06:00) : le jour coche
    // designe le jour ou la plage COMMENCE, donc un samedi 2 h releve du
    // vendredi soir. Window crossing midnight (e.g. 22:00 -> 06:00): the
    // checked day refers to the day the window STARTS on, so Saturday
    // 2am belongs to Friday evening.
    if (mins >= from) return dayOk(now.getDay());
    if (mins < to) return dayOk((now.getDay() + 6) % 7);
    return false;
  }

  // Resume lisible de la plage, affiche sous le message "En pause".
  // Readable summary of the window, shown under the "Paused" message.
  function scheduleSummary(s) {
    const labels = schedDayLabels();
    const days = SCHED_DAY_KEYS.map((k) => !!s[k]);
    const chosen = SCHED_DAY_ORDER.filter((d) => days[d]);
    const dayPart = (chosen.length === 0 || chosen.length === 7)
      ? i18n.t("tile.schedule.everyDay")
      : chosen.map((d) => labels[d]).join(", ");
    const from = parseHHMM(s._schedFrom), to = parseHHMM(s._schedTo);
    const timePart = (from == null || to == null || from === to)
      ? "" : ` · ${s._schedFrom}–${s._schedTo}`;
    return dayPart + timePart;
  }

  function destroyInstance(rec) {
    if (!rec.instance) return;
    try { rec.instance.destroy && rec.instance.destroy(); } catch (e) { /* noop */ }
    rec.instance = null;
  }

  function startWidget(rec) {
    const body = rec.el.querySelector(".tile-body");
    if (!body) return;
    const Klass = widgetClasses.get(rec.conf.widget);
    if (!Klass) {
      body.innerHTML = `<div class="tile-error">${i18n.t("tile.error")}</div>`;
      return;
    }
    body.classList.remove("tile-paused");
    body.innerHTML = "";
    try {
      const instance = new Klass({
        el: body,
        settings: Object.assign({}, defaultsFor(rec.manifest), rec.conf.settings || {}),
        instanceId: rec.conf.id,
        manifest: rec.manifest,
        api: widgetApi,
        i18n
      });
      rec.instance = instance;
      // init peut etre lent (reseau) : on ne bloque pas les autres tuiles
      // init may be slow (network): don't block the other tiles
      Promise.resolve(instance.init()).catch((e) => {
        console.error("[piboard] widget init failed:", rec.conf.widget, e);
        body.innerHTML = `<div class="tile-error">${i18n.t("tile.error")}</div>`;
      });
    } catch (e) {
      console.error("[piboard] widget init failed:", rec.conf.widget, e);
      body.innerHTML = `<div class="tile-error">${i18n.t("tile.error")}</div>`;
    }
  }

  function pauseWidget(rec) {
    destroyInstance(rec);
    const body = rec.el.querySelector(".tile-body");
    if (!body) return;
    body.classList.add("tile-paused");
    body.innerHTML = `
      <div class="tile-paused-msg">
        <div class="tile-paused-title">${i18n.t("tile.paused")}</div>
        <div class="tile-paused-hint">${escapeHtmlAttr(scheduleSummary(rec.conf.settings || {}))}</div>
      </div>`;
  }

  /* Applique la planification a une tuile. N'agit qu'aux transitions (ou
     au tout premier appel) pour ne pas relancer un widget a chaque tick.
     Applies the schedule to a tile. Only acts on transitions (or on the
     very first call) so a widget isn't restarted on every tick. */
  function syncTileSchedule(rec) {
    const paused = !isWithinSchedule(rec.conf.settings || {}, new Date());
    if (rec.paused === paused && (paused || rec.instance)) return;
    rec.paused = paused;
    if (paused) pauseWidget(rec); else startWidget(rec);
  }

  function startScheduleTicker() {
    clearInterval(scheduleTicker);
    // Toutes les 30 s : assez reactif pour une plage a la minute pres,
    // sans cout notable (une comparaison de dates par tuile).
    // Every 30s: responsive enough for a minute-accurate window, at no
    // notable cost (one date comparison per tile).
    scheduleTicker = setInterval(() => {
      for (const [, rec] of tiles) syncTileSchedule(rec);
    }, 30000);
  }

  function defaultsFor(manifest) {
    const out = {};
    if (manifest && Array.isArray(manifest.settings)) {
      for (const f of manifest.settings) out[f.key] = f.default;
    }
    return out;
  }

  function unmountAll() {
    for (const [, rec] of tiles) {
      try { rec.instance && rec.instance.destroy && rec.instance.destroy(); } catch (e) { /* noop */ }
    }
    tiles.clear();
    grid.removeAll();
    drawerGrid.removeAll();
  }

  async function renderLayout(layout) {
    unmountAll();
    const drawer = layout.drawer || { widthPct: 50, tiles: [] };
    applyDrawerWidth(drawer.widthPct || 50);
    grid.batchUpdate();
    drawerGrid.batchUpdate();
    for (const conf of layout.tiles) await mountTile(conf, "board");
    for (const conf of drawer.tiles || []) await mountTile(conf, "drawer");
    grid.batchUpdate(false);
    drawerGrid.batchUpdate(false);
    $("boardEmpty").hidden = layout.tiles.length > 0;
    $("drawerEmpty").hidden = (drawer.tiles || []).length > 0;
    startScheduleTicker();
  }

  function serializeZone(sourceGrid, zone) {
    const out = [];
    for (const node of sourceGrid.engine.nodes) {
      const id = node.el && node.el.dataset.tileId;
      const rec = id && tiles.get(id);
      if (!rec || rec.zone !== zone) continue;
      out.push({
        id,
        widget: rec.conf.widget,
        x: node.x, y: node.y, w: node.w, h: node.h,
        settings: rec.conf.settings || {}
      });
    }
    return out;
  }

  function serializeLayout() {
    return {
      tiles: serializeZone(grid, "board"),
      drawer: {
        widthPct: drawerWidthPct,
        tiles: serializeZone(drawerGrid, "drawer")
      }
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      apiPut("/api/layout", serializeLayout()).catch((e) => console.error("[piboard] save failed", e));
    }, 600);
  }

  /* Recherche d'un emplacement libre dans la zone VISIBLE de la grille
     (12 colonnes x gridRows lignes). Essaie d'abord la taille par defaut du
     widget, puis la reduit progressivement vers son minimum si necessaire,
     pour qu'une tuile ne soit jamais placee hors champ (invisible, donc
     impossible a saisir) faute de place.
     Finds a free spot within the VISIBLE grid area (12 columns x gridRows
     rows). Tries the widget's default size first, then progressively
     shrinks it toward its minimum if needed, so a tile is never placed
     off-screen (invisible, hence impossible to grab) for lack of room. */
  function shrinkPath(defaultW, defaultH, minW, minH) {
    const path = [];
    let w = defaultW, h = defaultH;
    path.push({ w, h });
    while (w > minW || h > minH) {
      if (w > minW && (h <= minH || w >= h)) w--;
      else if (h > minH) h--;
      path.push({ w, h });
    }
    return path;
  }

  function fitsAt(x, y, w, h, cols, rows, occupied) {
    if (x + w > cols || y + h > rows) return false;
    for (const n of occupied) {
      const overlap = x < n.x + n.w && x + w > n.x && y < n.y + n.h && y + h > n.y;
      if (overlap) return false;
    }
    return true;
  }

  function findPlacement(defaultW, defaultH, minW, minH, targetGrid, cols) {
    const rows = Math.max(4, settings.gridRows || 8);
    const occupied = targetGrid.engine.nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    for (const cand of shrinkPath(Math.min(defaultW, cols), defaultH, minW || 1, minH || 1)) {
      for (let y = 0; y <= rows - cand.h; y++) {
        for (let x = 0; x <= cols - cand.w; x++) {
          if (fitsAt(x, y, cand.w, cand.h, cols, rows, occupied)) {
            return { x, y, w: cand.w, h: cand.h };
          }
        }
      }
    }
    // Grille pleine meme au minimum : on laisse Gridstack se debrouiller
    // (autoPosition), quitte a deborder, plutot que de refuser l'ajout.
    // Grid fully packed even at minimum size: let Gridstack figure it out
    // (autoPosition), even if it overflows, rather than refusing to add.
    return { x: undefined, y: undefined, w: Math.min(defaultW, cols), h: defaultH };
  }

  async function addTile(widgetId) {
    // Tiroir ouvert = on ajoute dans le tiroir ; sinon sur le tableau.
    // Drawer open = the tile goes into the drawer; otherwise on the board.
    const toDrawer = $("drawer").classList.contains("open");
    const zone = toDrawer ? "drawer" : "board";
    const targetGrid = toDrawer ? drawerGrid : grid;
    const cols = COLS;
    const manifest = catalog.find((m) => m.id === widgetId);

    // Si ce type de widget possede des configurations enregistrees
    // (tuiles nommees supprimees precedemment), proposer de reutiliser
    // l'une d'elles plutot que de repartir de zero -- utile pour un
    // widget instancie plusieurs fois avec des reglages differents
    // (ex. deux tuiles "Page web" vers des URLs distinctes).
    // If this widget type has saved configurations (previously removed
    // named tiles), offer to reuse one instead of starting from
    // scratch -- useful for a widget instantiated several times with
    // different settings (e.g. two "Web page" tiles pointing at
    // different URLs).
    let settings = defaultsFor(manifest);
    try {
      const saved = await apiGet("/api/tile-configs/" + encodeURIComponent(widgetId));
      if (saved && saved.length) {
        const choice = await openConfigPicker(manifest, saved);
        if (choice === false) return; // annule par l'utilisateur / cancelled by the user
        if (choice) settings = Object.assign({}, defaultsFor(manifest), choice.settings);
      }
    } catch (e) {
      console.warn("[piboard] configurations enregistrees indisponibles:", e);
    }

    const size = (manifest && manifest.size) || { w: 2, h: 2 };
    const place = findPlacement(size.w, size.h, size.minW, size.minH, targetGrid, cols);
    const conf = {
      id: "t-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      widget: widgetId,
      x: place.x, y: place.y,
      w: place.w, h: place.h,
      settings
    };
    mountTile(conf, zone).then(() => {
      $("boardEmpty").hidden = true;
      if (toDrawer) $("drawerEmpty").hidden = true;
      scheduleSave();
    });
  }

  function removeTile(tileId) {
    const rec = tiles.get(tileId);
    if (!rec) return;
    // Une tuile nommee (titre personnalise) voit sa configuration
    // conservee cote serveur sous ce nom, pour ce type de widget --
    // elle pourra etre reproposee si l'on rajoute une tuile du meme
    // type plus tard (voir addTile ci-dessus). Une tuile sans titre
    // personnalise n'a pas de nom fiable pour l'identifier : rien
    // n'est conserve dans ce cas.
    // A named tile (custom title) has its configuration kept
    // server-side under that name, for that widget type -- it can be
    // offered again if a tile of the same type is added later (see
    // addTile above). A tile without a custom title has no reliable
    // name to identify it by: nothing is kept in that case.
    const title = rec.conf.settings && String(rec.conf.settings._title || "").trim();
    if (title) {
      apiPut("/api/tile-configs/" + encodeURIComponent(rec.conf.widget), { title, settings: rec.conf.settings })
        .catch((e) => console.warn("[piboard] configuration non conservee:", e));
    }
    try { rec.instance && rec.instance.destroy && rec.instance.destroy(); } catch (e) { /* noop */ }
    // Efface aussi le secret eventuel de cette tuile : un mot de passe de
    // boite mail n'a aucune raison de survivre a la tuile qui l'utilisait.
    // Also clears this tile's secret, if any: a mailbox password has no
    // reason to outlive the tile that used it.
    fetch("/api/tile-secrets/" + encodeURIComponent(tileId), { method: "DELETE" })
      .catch((e) => console.warn("[piboard] secret non efface:", e));
    (rec.zone === "drawer" ? drawerGrid : grid).removeWidget(rec.el);
    tiles.delete(tileId);
    let boardCount = 0, drawerCount = 0;
    for (const [, r] of tiles) (r.zone === "drawer" ? drawerCount++ : boardCount++);
    $("boardEmpty").hidden = boardCount > 0;
    $("drawerEmpty").hidden = drawerCount > 0;
    scheduleSave();
  }

  /* ---------- Parametres d'une tuile / tile settings ---------- */

  let tileModalTarget = null;

  /* Regroupe les champs par section logique (propriete "group" du
     manifest) et rend chaque groupe dans un encadre visuel titre. Le but
     est d'organiser les fenetres de configuration en blocs coherents
     plutot qu'une longue liste a plat, pour limiter le defilement.
     Les champs sans "group" sont rassembles dans une premiere section
     "generale" sans titre (comportement naturel des reglages de base).
     L'ordre des sections suit celui de leur premiere apparition dans le
     manifest, donc l'auteur du manifest controle l'agencement.
     Groups fields by logical section (manifest "group" property) and
     renders each group in a titled visual box. The goal is to organize
     config windows into coherent blocks rather than one long flat list,
     to limit scrolling. Fields without "group" are gathered into a first
     untitled "general" section (natural behavior for basic settings).
     Section order follows first appearance in the manifest, so the
     manifest author controls the layout. */
  /* Calcule et applique la meilleure disposition en colonnes des sections
     d'un formulaire, une fois celui-ci rendu et visible (les hauteurs
     reelles ne sont mesurables qu'a ce moment). Actif des lors que le
     reglage "multiColumnForms" est active (c'est le cas par defaut,
     independamment du mode tactile -- voir settings.multiColumnForms) ;
     sinon le formulaire reste en une colonne.

     Principe : on essaie 1, 2 puis 3 colonnes (dans la limite de ce que la
     largeur permet). Pour chaque nombre de colonnes, on range les sections
     dans l'ordre, chacune dans la colonne actuellement la moins haute
     (repartition "au plus court", type LPT) ; la hauteur du formulaire est
     alors celle de la colonne la plus haute. On retient le nombre de
     colonnes qui MINIMISE cette hauteur -- donc le defilement. A hauteur
     quasi egale, on prefere MOINS de colonnes (colonnes plus larges =
     champs plus lisibles, lignes plus longues), ce qui evite par exemple
     une 3e colonne vide quand 2 colonnes suffisent (cas RSS).

     Computes and applies the best column layout for a form's sections,
     once rendered and visible (real heights are only measurable then).
     Active whenever the "multiColumnForms" setting is on (the default,
     independently of touch mode -- see settings.multiColumnForms);
     otherwise the form stays single-column.
     Approach: try 1, 2 then 3 columns (within what width allows). For
     each count, place sections in order, each into the currently shortest
     column (shortest-first, LPT-like); the form height is then the
     tallest column's. Keep the count that MINIMIZES that height -- thus
     scrolling. At near-equal height, prefer FEWER columns (wider columns =
     more readable fields, longer lines), which avoids e.g. an empty 3rd
     column when 2 suffice (RSS case). */
  function layoutFormColumns(form) {
    if (!form) return;
    const modalCardReset = form.closest(".modal-card");
    // Par defaut : pas d'info de colonnes (largeur par defaut du modal).
    // On ne la (re)pose qu'apres un calcul multi-colonnes reussi. Cela
    // evite de garder une largeur large sur un widget simple ouvert
    // ensuite. Default: no column info (modal's default width). We only
    // (re)set it after a successful multi-column layout. This avoids
    // keeping a wide width on a simple widget opened afterwards.
    if (modalCardReset) delete modalCardReset.dataset.cols;
    if (!settings.multiColumnForms) return;

    // Si le formulaire a deja ete dispose en colonnes lors d'une ouverture
    // precedente (cas du modal de reglages, dont le HTML est statique et
    // reutilise), on "aplatit" d'abord : on remet toutes les sections et
    // elements pleine largeur comme enfants directs du formulaire, dans
    // l'ordre, avant de recalculer. Sans cela, la 2e ouverture verrait des
    // .form-col au lieu des sections.
    // If the form was already laid out in columns on a previous open (the
    // settings modal case, whose HTML is static and reused), first
    // "flatten": move all sections and full-width elements back as direct
    // children of the form, in order, before recomputing. Otherwise the
    // 2nd open would see .form-col instead of the sections.
    const existingRow = form.querySelector(":scope > .form-cols-row");
    if (existingRow) {
      const restored = [];
      form.querySelectorAll(".form-col > *").forEach((el) => restored.push(el));
      const trailing = Array.from(form.children).filter((el) => el !== existingRow);
      form.innerHTML = "";
      restored.forEach((el) => form.appendChild(el));
      trailing.forEach((el) => form.appendChild(el));
    }

    // Recuperer les sections (blocs a repartir) et les elements pleine
    // largeur (actions, about) qui restent en dehors des colonnes.
    // Collect sections (blocks to distribute) and full-width elements
    // (actions, about) that stay outside the columns.
    const all = Array.from(form.children);
    const sections = all.filter((el) =>
      el.classList.contains("form-section") || el.classList.contains("form-section-plain"));
    const fullWidth = all.filter((el) =>
      el.classList.contains("form-actions") || el.classList.contains("about"));
    if (sections.length < 2) return; // rien a optimiser

    const gap = 24;
    const minCol = 300;
    const maxAvailWidth = Math.min(window.innerWidth * 0.96, 1700) - 48; // -padding
    const maxByWidth = Math.max(1, Math.floor((maxAvailWidth + gap) / (minCol + gap)));
    const maxCols = Math.min(3, maxByWidth, sections.length);

    // Elargir le modal a sa largeur MAX potentielle AVANT de mesurer les
    // hauteurs : la largeur d'une section influe sur sa hauteur (les champs
    // se reorganisent). En mesurant deja a la largeur cible, la
    // repartition calculee reste valable une fois le modal elargi. On
    // ajustera ensuite la largeur au nombre de colonnes reellement retenu.
    // Widen the modal to its MAX potential width BEFORE measuring heights:
    // a section's width affects its height (fields reflow). By measuring at
    // the target width already, the computed layout stays valid once the
    // modal is widened. We then adjust the width to the actually chosen
    // column count.
    const modalCard = form.closest(".modal-card");
    if (modalCard) modalCard.dataset.cols = String(maxCols);

    // Mesurer la hauteur de chaque section (marge verticale incluse).
    // Measure each section's height (vertical margin included).
    const heights = sections.map((el) => {
      const r = el.getBoundingClientRect();
      return r.height + 16; // + gap vertical entre sections / + vertical gap between sections
    });

    // Pour un nombre de colonnes donne, repartir et renvoyer la hauteur
    // max resultante + l'affectation.
    //
    // Important : on traite les sections par hauteur DECROISSANTE (indices
    // tries dans "order" ci-dessous), pas dans leur ordre d'apparition --
    // c'est l'algorithme classique "LPT" (Longest Processing Time first) de
    // repartition en colonnes. Sans ce tri, un gros bloc arrivant tard
    // (ex. "Ecran de veille", place apres "Ecran tactile" dans le
    // formulaire) ne pouvait rejoindre que les colonnes deja partiellement
    // remplies par les blocs precedents, forcant parfois un petit bloc
    // (ex. "Ecran tactile") a se retrouver seul dans sa propre colonne
    // alors qu'il aurait largement sa place a cote du gros bloc. Traiter
    // les gros blocs en premier laisse ensuite les petits se glisser la ou
    // il reste le plus de place, quel que soit leur ordre d'origine.
    //
    // For a given column count, distribute and return the resulting max
    // height + the assignment.
    //
    // Important: sections are processed by DECREASING height (indices
    // sorted in "order" below), not in their appearance order -- this is
    // the classic "LPT" (Longest Processing Time first) column-packing
    // algorithm. Without this sort, a large block arriving late (e.g.
    // "Screen saver", placed after "Touchscreen" in the form) could only
    // join columns already partially filled by earlier blocks, sometimes
    // forcing a small block (e.g. "Touchscreen") to end up alone in its
    // own column when it would easily fit next to the large block.
    // Processing large blocks first leaves the small ones free to slot in
    // wherever there's the most room left, regardless of their original
    // order.
    const order = heights.map((_, i) => i).sort((a, b) => heights[b] - heights[a]);

    function trial(nCols) {
      const colH = new Array(nCols).fill(0);
      const assign = new Array(nCols).fill(null).map(() => []);
      for (const i of order) {
        let min = 0;
        for (let c = 1; c < nCols; c++) if (colH[c] < colH[min]) min = c;
        assign[min].push(i);
        colH[min] += heights[i];
      }
      // Chaque colonne retrouve l'ordre d'origine des sections (l'ordre
      // d'AFFECTATION ci-dessus sert seulement a bien repartir, pas a
      // l'affichage final).
      // Each column gets sections back in their original order (the
      // ASSIGNMENT order above is only for good packing, not for final
      // display).
      assign.forEach((col) => col.sort((a, b) => a - b));
      return { height: Math.max(...colH), assign };
    }

    let best = null;
    for (let n = 1; n <= maxCols; n++) {
      const t = trial(n);
      // Preferer moins de colonnes si la hauteur n'est pas nettement
      // meilleure (marge de 8 %). Prefer fewer columns unless the height
      // is clearly better (8% margin).
      if (!best || t.height < best.height * 0.92) best = { n, ...t };
    }
    if (!best) return;

    // Construire les colonnes et y deplacer les sections selon best.assign.
    // Build the columns and move the sections into them per best.assign.
    const cols = [];
    for (let c = 0; c < best.n; c++) {
      const col = document.createElement("div");
      col.className = "form-col";
      best.assign[c].forEach((idx) => col.appendChild(sections[idx]));
      cols.push(col);
    }
    // Reconstruire le formulaire : d'abord une rangee de colonnes, puis
    // les elements pleine largeur (actions, about) en dessous.
    // Rebuild the form: first a row of columns, then the full-width
    // elements (actions, about) below.
    const row = document.createElement("div");
    row.className = "form-cols-row";
    cols.forEach((c) => row.appendChild(c));
    form.innerHTML = "";
    form.appendChild(row);
    fullWidth.forEach((el) => form.appendChild(el));

    // Ajuster la largeur du modal au nombre de colonnes FINALEMENT retenu
    // (best.n peut etre < maxCols, ex. RSS ou 2 colonnes suffisent alors
    // que 3 tenaient en largeur). C'est ce qui evite une fenetre trop
    // large avec une colonne vide.
    // Adjust the modal width to the FINALLY chosen column count (best.n
    // may be < maxCols, e.g. RSS where 2 columns suffice while 3 fit in
    // width). This avoids an over-wide window with an empty column.
    if (modalCard) modalCard.dataset.cols = String(best.n);
  }

  function fieldsBySection(fields, settings) {
    const sections = [];
    const byName = new Map();
    for (const f of fields) {
      const name = f.group ? i18n.fromManifest(f.group) : "";
      let sec = byName.get(name);
      if (!sec) { sec = { name, fields: [] }; byName.set(name, sec); sections.push(sec); }
      sec.fields.push(f);
    }
    return sections.map((sec) => {
      const inner = sec.fields
        .map((f) => fieldMarkup(f, settings[f.key] !== undefined ? settings[f.key] : f.default))
        .join("");
      // Une section titree est un encadre ; la section generale (sans
      // titre) reste sans cadre pour ne pas alourdir les widgets simples.
      // A titled section is a boxed group; the untitled general section
      // stays frameless so simple widgets aren't made heavier.
      if (!sec.name) return `<div class="form-section form-section-plain">${inner}</div>`;
      return `<fieldset class="form-section"><legend>${sec.name}</legend>${inner}</fieldset>`;
    }).join("");
  }

  function fieldMarkup(f, value) {
    const label = i18n.fromManifest(f.label);
    const v = value == null ? "" : value;
    const hint = f.hint ? `<small class="field-hint">${i18n.fromManifest(f.hint)}</small>` : "";
    switch (f.type) {
      case "select": {
        // Options avec regroupement facultatif (propriete "group" par
        // option, ex. les fuseaux horaires groupes par continent) :
        // rendu en <optgroup>, dans l'ordre de premiere apparition des
        // groupes. Une option sans "group" reste au niveau racine --
        // comportement inchange pour tous les champs select existants,
        // aucun d'eux n'utilisant cette propriete.
        // Options with optional grouping (a per-option "group" property,
        // e.g. time zones grouped by continent): rendered as
        // <optgroup>, in the groups' first-seen order. An option with no
        // "group" stays at the root level -- unchanged behavior for
        // every existing select field, none of which use this property.
        const opts = f.options || [];
        const optionHtml = (o) => `<option value="${o.value}" ${String(o.value) === String(v) ? "selected" : ""}>${i18n.fromManifest(o.label)}</option>`;
        let body = "";
        const groupOrder = [];
        const byGroup = new Map();
        for (const o of opts) {
          if (!o.group) { body += optionHtml(o); continue; }
          const gLabel = i18n.fromManifest(o.group);
          if (!byGroup.has(gLabel)) { byGroup.set(gLabel, []); groupOrder.push(gLabel); }
          byGroup.get(gLabel).push(o);
        }
        body += groupOrder.map((g) => `<optgroup label="${escapeHtmlAttr(g)}">${byGroup.get(g).map(optionHtml).join("")}</optgroup>`).join("");
        return `<label class="field"><span>${label}</span><select data-key="${f.key}">${body}</select>${hint}</label>`;
      }
      /* Champ "fuseau horaire" : construit sa liste d'options a la volee
         via Intl.supportedValuesOf("timeZone") -- la meme API que celle
         qui alimente deja l'affichage reel du fuseau (voir nowInZone()
         dans le widget Horloge), plutot qu'une liste figee de ~420
         entrees x4 champs embarquee dans chaque manifeste (essaye
         d'abord, ecarte : 437 Ko rien que pour ce widget). Regroupee par
         continent (optgroup, voir le cas "select" juste au-dessus).
         Repli sur une petite liste si l'API est indisponible (tres
         ancien navigateur) : mieux qu'un champ vide.
         "Time zone" field: builds its option list on the fly via
         Intl.supportedValuesOf("timeZone") -- the same API that already
         powers the actual zone display (see nowInZone() in the Clock
         widget), rather than a fixed list of ~420 entries x4 fields
         embedded in every manifest (tried first, dropped: 437 KB for
         this widget alone). Grouped by continent (optgroup, see the
         "select" case just above). Falls back to a short list if the
         API is unavailable (very old browser): better than an empty
         field. */
      case "timezone": {
        const FALLBACK_ZONES = ["UTC", "Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"];
        let zones;
        try { zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : FALLBACK_ZONES; }
        catch (e) { zones = FALLBACK_ZONES; }
        const CONTINENT_LABELS = {
          Africa: { en: "Africa", fr: "Afrique" }, America: { en: "America", fr: "Amérique" },
          Antarctica: { en: "Antarctica", fr: "Antarctique" }, Arctic: { en: "Arctic", fr: "Arctique" },
          Asia: { en: "Asia", fr: "Asie" }, Atlantic: { en: "Atlantic", fr: "Atlantique" },
          Australia: { en: "Australia", fr: "Australie" }, Europe: { en: "Europe", fr: "Europe" },
          Indian: { en: "Indian Ocean", fr: "Océan Indien" }, Pacific: { en: "Pacific", fr: "Pacifique" },
          Etc: { en: "Other", fr: "Autre" }
        };
        const emptyLabel = f.emptyLabel || { en: "— System's own —", fr: "— Fuseau du système —" };
        let body = `<option value="" ${v ? "" : "selected"}>${i18n.fromManifest(emptyLabel)}</option>`;
        const byGroup = new Map();
        const order = [];
        for (const z of zones) {
          const slash = z.indexOf("/");
          const continent = slash === -1 ? "Etc" : z.slice(0, slash);
          const city = (slash === -1 ? z : z.slice(slash + 1)).replace(/_/g, " ");
          const gLabel = i18n.fromManifest(CONTINENT_LABELS[continent] || { en: continent, fr: continent });
          if (!byGroup.has(gLabel)) { byGroup.set(gLabel, []); order.push(gLabel); }
          byGroup.get(gLabel).push({ value: z, city });
        }
        order.sort((a, b) => a.localeCompare(b));
        body += order.map((g) => {
          const items = [...byGroup.get(g)].sort((a, b) => a.city.localeCompare(b.city));
          const optsHtml = items.map((it) => `<option value="${it.value}" ${String(it.value) === String(v) ? "selected" : ""}>${escapeHtmlAttr(it.city)}</option>`).join("");
          return `<optgroup label="${escapeHtmlAttr(g)}">${optsHtml}</optgroup>`;
        }).join("");
        return `<label class="field"><span>${label}</span><select data-key="${f.key}">${body}</select>${hint}</label>`;
      }
      case "checkbox":
        return `<label class="field checkbox"><input type="checkbox" data-key="${f.key}" ${v ? "checked" : ""}><span>${label}</span></label>${hint}`;
      case "number":
        return `<label class="field"><span>${label}</span><input type="number" data-key="${f.key}" value="${v}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.step != null ? `step="${f.step}"` : ""}>${hint}</label>`;
      case "textarea": {
        /* Bouton optionnel "parcourir" : disponible pour tout champ
           textarea declarant "browseChannels" dans le manifest (voir
           server/index.js: GET /api/tele-channels pour le premier
           usage, widget Programme TV). Generique par construction --
           un futur widget pourrait reutiliser le meme mecanisme avec
           son propre point d'entree -- mais le gestionnaire de clic
           (voir plus bas, ".field-browse-btn") lit pour l'instant des
           noms de champs specifiques au Programme TV pour construire
           la requete ; a generaliser le jour ou un second widget en a
           besoin.
           Optional "browse" button: available for any textarea field
           declaring "browseChannels" in the manifest (see
           server/index.js: GET /api/tele-channels for the first use,
           TV guide widget). Generic by construction -- a future widget
           could reuse the same mechanism with its own endpoint -- but
           the click handler (see below, ".field-browse-btn") currently
           reads TV-guide-specific field names to build the request; to
           be generalized once a second widget needs it. */
        const browse = f.browseChannels;
        const browseUi = browse
          ? `<div class="field-browse">
               <button type="button" class="btn small field-browse-btn" data-endpoint="${browse.endpoint}">${i18n.fromManifest(browse.label)}</button>
               ${browse.hint ? `<small class="field-hint">${i18n.fromManifest(browse.hint)}</small>` : ""}
               <div class="field-browse-list" hidden></div>
             </div>`
          : "";
        return `<label class="field field-wide"><span>${label}</span><textarea data-key="${f.key}" autocomplete="off" spellcheck="false">${v}</textarea>${hint}</label>${browseUi}`;
      }
      case "datetime":
        return `<label class="field"><span>${label}</span><input type="datetime-local" data-key="${f.key}" value="${v}">${hint}</label>`;
      case "color":
        return `<label class="field"><span>${label}</span><input type="color" data-key="${f.key}" value="${v || "#000000"}">${hint}</label>`;
      case "time":
        return `<label class="field"><span>${label}</span><input type="time" data-key="${f.key}" value="${v}">${hint}</label>`;
      case "password":
        return `<label class="field"><span>${label}</span><div class="field-password-wrap"><input type="password" data-key="${f.key}" value="${String(v).replace(/"/g, "&quot;")}" autocomplete="off" spellcheck="false"><button type="button" class="btn small field-password-toggle" data-i18n="field.password.show">${i18n.t("field.password.show")}</button></div>${hint}</label>`;
      /* Champ "secret" : contrairement a "password" ci-dessus, la valeur
         n'est JAMAIS conservee dans les reglages de la tuile (donc jamais
         dans layout.json, ni dans une configuration exportable). Elle est
         envoyee au coffre chiffre du serveur (voir server/tileSecrets.js)
         et n'en redescend jamais : le champ reste donc vide a la
         reouverture, avec une mention indiquant qu'un secret est deja
         enregistre. A reserver aux vrais secrets (mot de passe de boite
         mail...) -- "password" suffit pour une cle d'API qu'on accepte de
         voir figurer dans les reglages.
         "secret" field: unlike "password" above, the value is NEVER kept
         in the tile's settings (so never in layout.json, nor in an
         exportable config). It is sent to the server's encrypted vault
         (see server/tileSecrets.js) and never comes back down: the field
         is therefore empty on reopening, with a note saying a secret is
         already stored. Reserved for genuine secrets (mailbox
         password...) -- "password" is enough for an API key one accepts
         seeing in the settings. */
      case "secret":
        return `<label class="field"><span>${label}</span><div class="field-password-wrap"><input type="password" data-secret-key="${f.key}" value="" autocomplete="off" spellcheck="false" placeholder="${i18n.t("field.secret.placeholder")}"><button type="button" class="btn small field-password-toggle" data-i18n="field.password.show">${i18n.t("field.password.show")}</button></div><small class="field-hint field-secret-status" data-secret-status="${f.key}"></small>${hint}</label>`;
      /* Champ adresse avec suggestions cliquables (voir les gestionnaires
         delegues plus bas, ".field-address-input"/".field-address-suggest") :
         recherche Nominatim debouncee des la saisie, resultats affiches
         en liste -- cliquer une suggestion remplit le champ avec
         l'adresse complete telle que comprise. Meme principe que la
         recherche de ville des reglages generaux (voir initCitySearch()),
         plus fiable qu'une simple confirmation textuelle : plus besoin de
         taper une adresse parfaitement formee, ni de deviner si ce qui a
         ete compris correspond a ce qui etait vise.
         Address field with clickable suggestions (see the delegated
         handlers further below, ".field-address-input"/
         ".field-address-suggest"): debounced Nominatim search as you
         type, results shown as a list -- clicking a suggestion fills the
         field with the full address as understood. Same idea as the
         general settings' city search (see initCitySearch()), more
         reliable than a plain text confirmation: no need to type a
         perfectly-formed address, or guess whether what got understood
         matches what was meant. */
      case "address":
        return `<label class="field field-address-wrap"><span>${label}</span><input type="text" data-key="${f.key}" class="field-address-input" value="${String(v).replace(/"/g, "&quot;")}" autocomplete="off" spellcheck="false"><div class="field-address-suggest" hidden></div>${hint}</label>`;
      default:
        // autocomplete="off" : evite que Chromium propose une suggestion
        // au-dessus du champ, ce qui sur ecran tactile intercepte le
        // premier tap suivant (ex. sur le bouton Enregistrer) sans
        // qu'il atteigne sa cible.
        // autocomplete="off": prevents Chromium from popping up a
        // suggestion above the field, which on a touchscreen intercepts
        // the next tap (e.g. on the Save button) before it reaches its
        // target.
        return `<label class="field"><span>${label}</span><input type="text" data-key="${f.key}" value="${String(v).replace(/"/g, "&quot;")}" autocomplete="off" spellcheck="false">${hint}</label>`;
    }
  }

  function openTileSettings(tileId) {
    const rec = tiles.get(tileId);
    if (!rec || !rec.manifest) return;
    tileModalTarget = tileId;
    const form = $("tileForm");
    const fields = rec.manifest.settings || [];
    $("tileModalTitle").textContent = i18n.fromManifest(rec.manifest.name);
    const s = rec.conf.settings || {};
    const showTitleNow = s._showTitle != null ? !!s._showTitle : !!rec.manifest.titleBar;
    const textScaleNow = String(s._textScale || "1");
    const textScaleField = rec.conf.widget === "traffic" ? "" : `
      <label class="field">
        <span>${i18n.t("tile.textScale")}</span>
        <select data-key="_textScale">
          ${[["0.5", "50 %"], ["0.65", "65 %"], ["0.8", "80 %"], ["1", "100 %"], ["1.15", "115 %"],
             ["1.3", "130 %"], ["1.5", "150 %"], ["1.75", "175 %"], ["2", "200 %"]]
            .map(([v, l]) => `<option value="${v}" ${textScaleNow === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <small class="field-hint">${i18n.t("tile.textScale.hint")}</small>
      </label>`;
    const universal = `
      <fieldset class="form-section">
        <legend>${i18n.t("tile.appearance")}</legend>
        <label class="field checkbox">
          <input type="checkbox" data-key="_showTitle" ${showTitleNow ? "checked" : ""}>
          <span>${i18n.t("tile.showTitle")}</span>
        </label>
        <label class="field">
          <span>${i18n.t("tile.customTitle")}</span>
          <input type="text" data-key="_title" value="${String(s._title || "").replace(/"/g, "&quot;")}"
                 placeholder="${i18n.fromManifest(rec.manifest.name)}">
        </label>
        ${textScaleField}
        <label class="field checkbox">
          <input type="checkbox" data-key="_customColor" ${s._customColor ? "checked" : ""}>
          <span>${i18n.t("tile.customColor")}</span>
        </label>
        <label class="field">
          <span>${i18n.t("tile.color")}</span>
          <input type="color" data-key="_bgColor" value="${currentTileColorHex(rec)}">
        </label>
      </fieldset>
      <fieldset class="form-section">
        <legend>${i18n.t("tile.schedule")}</legend>
        <label class="field checkbox">
          <input type="checkbox" data-key="_schedEnabled" ${s._schedEnabled ? "checked" : ""}>
          <span>${i18n.t("tile.schedule.enable")}</span>
        </label>
        <small class="field-hint">${i18n.t("tile.schedule.enable.hint")}</small>
        <div class="field">
          <span>${i18n.t("tile.schedule.days")}</span>
          <div class="sched-days">
            ${SCHED_DAY_ORDER.map((d) => `
              <label class="sched-day">
                <input type="checkbox" data-key="${SCHED_DAY_KEYS[d]}" ${s[SCHED_DAY_KEYS[d]] ? "checked" : ""}>
                <span>${schedDayLabels()[d]}</span>
              </label>`).join("")}
          </div>
          <small class="field-hint">${i18n.t("tile.schedule.days.hint")}</small>
        </div>
        <label class="field">
          <span>${i18n.t("tile.schedule.from")}</span>
          <input type="time" data-key="_schedFrom" value="${String(s._schedFrom || "")}">
        </label>
        <label class="field">
          <span>${i18n.t("tile.schedule.to")}</span>
          <input type="time" data-key="_schedTo" value="${String(s._schedTo || "")}">
          <small class="field-hint">${i18n.t("tile.schedule.time.hint")}</small>
        </label>
      </fieldset>`;
    form.innerHTML = fieldsBySection(fields, s) + universal;

    /* Une option de liste peut pre-remplir d'autres champs du formulaire
       via sa propriete "fills" du manifeste (ex. choisir un fournisseur
       de courriel renseigne le serveur IMAP et son port). Ne remplace
       que les champs concernes, et seulement au choix explicite d'une
       option -- jamais a l'ouverture, pour ne pas ecraser une
       configuration manuelle deja en place.
       A select option can pre-fill other form fields via its manifest
       "fills" property (e.g. picking a mail provider fills in the IMAP
       server and its port). Only replaces the fields concerned, and only
       on an explicit option choice -- never on opening, so an existing
       manual configuration is not overwritten. */
    fields.filter((f) => f.type === "select" && (f.options || []).some((o) => o.fills)).forEach((f) => {
      const sel = form.querySelector(`select[data-key="${f.key}"]`);
      if (!sel) return;
      sel.addEventListener("change", () => {
        const opt = (f.options || []).find((o) => String(o.value) === sel.value);
        if (!opt || !opt.fills) return;
        for (const [key, value] of Object.entries(opt.fills)) {
          const target = form.querySelector(`[data-key="${key}"]`);
          if (!target) continue;
          if (target.type === "checkbox") target.checked = !!value;
          else target.value = value;
        }
      });
    });

    // Etat de chaque secret ("enregistre" / "non defini") : demande au
    // serveur, jamais devine depuis les reglages -- ils ne le contiennent
    // pas. Each secret's state ("stored" / "not set"): asked of the
    // server, never guessed from the settings -- they don't contain it.
    fields.filter((f) => f.type === "secret").forEach((f) => refreshSecretStatus(tileId, f.key));
    $("tileSaveConfigMsg").textContent = "";
    $("tileSaveConfigMsg").classList.remove("field-hint-error");
    $("tileModal").hidden = false;
    // Apres affichage (hauteurs mesurables) : calculer la meilleure
    // disposition en colonnes. requestAnimationFrame garantit que le
    // navigateur a bien effectue la mise en page.
    // After display (heights measurable): compute the best column layout.
    // requestAnimationFrame ensures the browser has laid things out.
    requestAnimationFrame(() => layoutFormColumns(form));
  }

  function collectTileFormValues() {
    const values = {};
    $("tileForm").querySelectorAll("[data-key]").forEach((input) => {
      const key = input.dataset.key;
      if (input.type === "checkbox") values[key] = input.checked;
      else if (input.type === "number") values[key] = input.value === "" ? null : Number(input.value);
      else values[key] = input.value;
    });
    return values;
  }

  /* Envoie les champs "secret" renseignes au coffre du serveur, puis vide
     le champ : la valeur ne doit ni rester a l'ecran, ni rejoindre les
     reglages de la tuile (voir le cas "secret" de fieldMarkup()). Un
     champ laisse vide ne touche a rien -- c'est ce qui permet de rouvrir
     les reglages pour changer autre chose sans effacer le mot de passe
     deja enregistre.
     Sends filled-in "secret" fields to the server's vault, then clears
     the field: the value must neither stay on screen nor join the tile's
     settings (see fieldMarkup()'s "secret" case). A field left empty
     touches nothing -- which is what lets you reopen the settings to
     change something else without wiping the already-stored password. */
  function pushTileSecrets(tileId) {
    const inputs = $("tileForm").querySelectorAll("[data-secret-key]");
    const jobs = [];
    inputs.forEach((input) => {
      if (input.value === "") return;
      const key = input.dataset.secretKey;
      jobs.push(
        apiPut(`/api/tile-secrets/${encodeURIComponent(tileId)}/${encodeURIComponent(key)}`, { value: input.value })
          .then(() => { input.value = ""; refreshSecretStatus(tileId, key); })
          .catch((e) => console.warn("[piboard] secret non enregistre:", e))
      );
    });
    return Promise.all(jobs);
  }

  function refreshSecretStatus(tileId, key) {
    const el = $("tileForm").querySelector(`[data-secret-status="${key}"]`);
    if (!el) return;
    fetch(`/api/tile-secrets/${encodeURIComponent(tileId)}/${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => {
        el.textContent = i18n.t(d.configured ? "field.secret.set" : "field.secret.unset");
        el.classList.toggle("field-secret-ok", !!d.configured);
      })
      .catch(() => { el.textContent = ""; });
  }

  function applyTileFormValues(rec, values) {
    rec.conf.settings = Object.assign({}, rec.conf.settings, values);
    applyTitleBar(rec);
    applyTileColor(rec);
    applyTextScale(rec);
    scheduleSave();

    // La planification a pu changer : une tuile peut devoir passer en
    // pause (ou en sortir) immediatement, sans attendre le prochain tick.
    // Scheduling may have changed: a tile may need to pause (or resume)
    // immediately, without waiting for the next tick.
    const shouldPause = !isWithinSchedule(rec.conf.settings, new Date());
    if (shouldPause !== !!rec.paused) {
      rec.paused = shouldPause;
      if (shouldPause) pauseWidget(rec); else startWidget(rec);
      return; // le widget vient d'etre (re)cree avec les nouveaux reglages / the widget was just (re)created with the new settings
    }
    if (shouldPause) {
      pauseWidget(rec); // rafraichit le resume de la plage affiche / refreshes the displayed window summary
      return;
    }

    const merged = Object.assign({}, defaultsFor(rec.manifest), rec.conf.settings);
    if (rec.instance && rec.instance.onSettingsChanged) {
      rec.instance.onSettingsChanged(merged);
    } else {
      // Remontage complet / full remount
      destroyInstance(rec);
      startWidget(rec);
    }
  }

  function saveTileSettings() {
    const rec = tiles.get(tileModalTarget);
    if (!rec) return;
    const tileId = tileModalTarget;
    // Les secrets partent au coffre AVANT de relancer le widget : sans
    // cela, sa toute premiere requete tomberait sur un coffre encore
    // vide et afficherait une erreur d'identifiants a tort.
    // Secrets go to the vault BEFORE restarting the widget: otherwise
    // its very first request would hit a still-empty vault and wrongly
    // show a credentials error.
    pushTileSecrets(tileId).then(() => {
      applyTileFormValues(rec, collectTileFormValues());
    });
    $("tileModal").hidden = true;
    vkb.hide();
  }

  /* Enregistrement EXPLICITE d'une configuration reutilisable, sans
     attendre la suppression de la tuile (voir removeTile) -- rend la
     fonctionnalite visible et decouvrable directement dans les
     parametres de la tuile, plutot que purement implicite. Applique
     aussi les reglages courants a la tuile (comme "Enregistrer"), mais
     laisse la fenetre ouverte pour confirmer visuellement le succes.
     EXPLICIT save of a reusable configuration, without waiting for the
     tile to be removed (see removeTile) -- makes the feature visible
     and discoverable directly in the tile's settings, rather than
     purely implicit. Also applies the current settings to the tile
     (like "Save"), but leaves the window open to visually confirm
     success. */
  function saveTileConfigForReuse() {
    const rec = tiles.get(tileModalTarget);
    if (!rec) return;
    const values = collectTileFormValues();
    const title = String(values._title || "").trim();
    const msgEl = $("tileSaveConfigMsg");
    if (!title) {
      msgEl.classList.add("field-hint-error");
      msgEl.textContent = i18n.t("tile.saveConfig.needTitle");
      return;
    }
    applyTileFormValues(rec, values);
    apiPut("/api/tile-configs/" + encodeURIComponent(rec.conf.widget), { title, settings: rec.conf.settings })
      .then(() => {
        msgEl.classList.remove("field-hint-error");
        msgEl.textContent = i18n.t("tile.saveConfig.done");
      })
      .catch((e) => {
        msgEl.classList.add("field-hint-error");
        msgEl.textContent = i18n.t("tile.saveConfig.error");
        console.warn("[piboard] configuration non enregistree:", e);
      });
  }

  /* ---------- Catalogue / catalog ---------- */

  function openCatalog() {
    const list = $("catalogList");
    list.innerHTML = "";
    for (const m of catalog) {
      const wrap = document.createElement("div");
      wrap.className = "catalog-item-wrap";
      const btn = document.createElement("button");
      btn.className = "catalog-item";
      // Intitule court, focalise sur la fonction premiere de la tuile
      // (voir "tagline" dans chaque manifeste) -- la description
      // complete, plus longue, reste accessible via l'icone info au
      // survol/tap plutot que d'etre affichee en permanence dans la
      // liste, ce qui produisait des paves de texte demesures.
      // Short blurb, focused on the tile's primary function (see
      // "tagline" in each manifest) -- the full, longer description
      // stays available via the info icon on hover/tap rather than
      // being permanently shown in the list, which produced oversized
      // text blocks.
      const tagline = m.tagline ? i18n.fromManifest(m.tagline) : i18n.fromManifest(m.description);
      btn.innerHTML = `
        <img src="widgets/${m.dir}/icon.svg" alt="">
        <span>
          <span class="ci-name">${i18n.fromManifest(m.name)}</span><br>
          <span class="ci-desc">${tagline}</span>
        </span>`;
      btn.addEventListener("click", () => {
        $("catalogModal").hidden = true;
        if (!editing) toggleEdit(true);
        addTile(m.id);
      });
      wrap.appendChild(btn);

      if (m.tagline) {
        // Bouton separe (pas imbrique dans btn, un <button> ne peut pas
        // en contenir un autre) positionne par-dessus, dans le coin.
        // Separate button (not nested inside btn, a <button> can't
        // contain another one) positioned on top, in the corner.
        const info = document.createElement("button");
        info.type = "button";
        info.className = "ci-info";
        info.setAttribute("aria-label", i18n.t("catalog.moreInfo"));
        info.textContent = "ⓘ";
        info.addEventListener("mouseenter", () => showCatalogTooltip(info, i18n.fromManifest(m.description)));
        info.addEventListener("mouseleave", hideCatalogTooltip);
        info.addEventListener("click", (e) => {
          e.stopPropagation();
          catalogTooltipEl && !catalogTooltipEl.hidden
            ? hideCatalogTooltip()
            : showCatalogTooltip(info, i18n.fromManifest(m.description));
        });
        wrap.appendChild(info);
      }

      list.appendChild(wrap);
    }
    $("catalogModal").hidden = false;
  }

  /* Info-bulle partagee (une seule instance reutilisee, plutot qu'une par
     tuile) pour la description complete d'un widget -- positionnee en
     "fixed" a partir des coordonnees reelles du bouton info, pour ne
     jamais se faire rogner par le defilement du catalogue.
     Shared tooltip (a single reused instance, rather than one per tile)
     for a widget's full description -- "fixed" positioned from the info
     button's real coordinates, so it never gets clipped by the
     catalog's scrolling. */
  let catalogTooltipEl = null;
  function showCatalogTooltip(triggerEl, text) {
    if (!catalogTooltipEl) {
      catalogTooltipEl = document.createElement("div");
      catalogTooltipEl.className = "ci-tooltip";
      catalogTooltipEl.hidden = true;
      document.body.appendChild(catalogTooltipEl);
    }
    catalogTooltipEl.textContent = text;
    catalogTooltipEl.hidden = false;
    const r = triggerEl.getBoundingClientRect();
    // Mesure une fois affichee (dimensions encore inconnues avant) pour
    // la garder dans l'ecran, en la faisant plutot passer au-dessus si
    // elle deborderait en bas. Measured once shown (dimensions unknown
    // before that) to keep it on screen, flipping it above instead if it
    // would overflow at the bottom.
    const tw = catalogTooltipEl.offsetWidth, th = catalogTooltipEl.offsetHeight;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - tw - 8);
    let top = r.bottom + 6;
    if (top + th > window.innerHeight - 8) top = r.top - th - 6;
    catalogTooltipEl.style.left = left + "px";
    catalogTooltipEl.style.top = top + "px";
  }
  function hideCatalogTooltip() {
    if (catalogTooltipEl) catalogTooltipEl.hidden = true;
  }

  /* ---------- Selecteur de configuration enregistree / saved config picker ----------
     Propose une configuration deja enregistree (tuile nommee supprimee
     precedemment) ou une configuration vierge, pour un type de widget
     donne. Retourne une Promise qui se resout en :
       - false  si l'utilisateur a ferme la fenetre sans choisir
                (annulation -- la tuile ne doit pas etre ajoutee) ;
       - null   si "Nouvelle configuration (vierge)" a ete choisi ;
       - { title, settings, savedAt } si une configuration enregistree
                a ete choisie.
     Offers an already-saved configuration (previously removed named
     tile) or a blank one, for a given widget type. Returns a Promise
     that resolves to:
       - false  if the user closed the window without choosing
                (cancelled -- the tile must not be added);
       - null   if "New (blank) configuration" was chosen;
       - { title, settings, savedAt } if a saved configuration was
                chosen. */
  function openConfigPicker(manifest, savedConfigs) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        $("configPickerModal").hidden = true;
        resolve(value);
      };

      $("configPickerTitle").textContent = i18n.t("configPicker.title") + " " + i18n.fromManifest(manifest.name);

      const list = $("configPickerList");
      list.innerHTML = "";

      const blankBtn = document.createElement("button");
      blankBtn.className = "catalog-item config-picker-blank";
      blankBtn.innerHTML = `<span class="ci-name">${i18n.t("configPicker.blank")}</span>`;
      blankBtn.addEventListener("click", () => settle(null));
      list.appendChild(blankBtn);

      for (const cfg of savedConfigs) {
        const row = document.createElement("div");
        row.className = "config-picker-row";

        const btn = document.createElement("button");
        btn.className = "catalog-item";
        btn.innerHTML = `
          <span>
            <span class="ci-name">${escapeHtmlAttr(cfg.title)}</span><br>
            <span class="ci-desc">${i18n.t("configPicker.savedOn")} ${formatSavedDate(cfg.savedAt)}</span>
          </span>`;
        btn.addEventListener("click", () => settle(cfg));

        const del = document.createElement("button");
        del.type = "button";
        del.className = "cp-delete";
        del.setAttribute("aria-label", i18n.t("configPicker.delete"));
        del.textContent = "\u00d7";
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await apiDelete("/api/tile-configs/" + encodeURIComponent(manifest.id) + "/" + encodeURIComponent(cfg.title));
            row.remove();
          } catch (err) {
            console.warn("[piboard] suppression de la configuration impossible:", err);
          }
        });

        row.appendChild(btn);
        row.appendChild(del);
        list.appendChild(row);
      }

      const modal = $("configPickerModal");
      const onBackdrop = (e) => {
        if (e.target === modal || e.target.hasAttribute("data-close")) settle(false);
      };
      modal.addEventListener("click", onBackdrop, { once: true });

      modal.hidden = false;
    });
  }

  function escapeHtmlAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatSavedDate(iso) {
    try {
      const locale = i18n.lang === "fr" ? "fr-FR" : "en-US";
      return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) {
      return "";
    }
  }

  /* ---------- Mode edition / edit mode ---------- */

  function toggleEdit(force) {
    editing = force != null ? force : !editing;
    document.body.classList.toggle("editing", editing);
    grid.setStatic(!editing);
    drawerGrid.setStatic(!editing);
    $("btnEdit").classList.toggle("active", editing);
    // Barre visible en permanence pendant l'edition ; minuterie au retour
    // Toolbar stays visible while editing; timer re-armed on exit
    showDockBar(true);
  }

  /* ---------- Dock ---------- */

  let dockTimer = null;

  function showDockBar(show) {
    $("dockBar").hidden = !show;
    $("dockTab").style.visibility = show ? "hidden" : "visible";
    clearTimeout(dockTimer);
    if (show && !editing) {
      dockTimer = setTimeout(() => showDockBar(false), 20000);
    }
  }

  /* ---------- Parametres globaux / global settings ---------- */

  let pendingCity = null; // { name, lat, lon } choisi mais pas encore enregistre

  function cityCurrentLabel() {
    const name = pendingCity ? pendingCity.name : settings.cityName;
    return name ? i18n.t("settings.city.current") + " " + name : "";
  }

  /* ---------- Integration a l'application de bureau / desktop app integration ----------
     Le tableau de bord est servi par le meme serveur Express dans les
     deux cas : rien ne distingue a priori une fenetre de l'application
     Windows d'un onglet de navigateur ouvert sur le Pi. On interroge
     donc le serveur, qui sait si un processus Electron s'est enregistre
     aupres de lui. Les reglages qui n'ont de sens que sur le bureau
     restent masques partout ailleurs.
     The dashboard is served by the same Express server in both cases:
     nothing inherently distinguishes a Windows application window from a
     browser tab opened on the Pi. We therefore ask the server, which
     knows whether an Electron process registered itself with it.
     Settings that only make sense on the desktop stay hidden everywhere
     else. */
  let appIntegration = { desktopApp: false, autoStart: { supported: false, enabled: false } };

  async function refreshAppIntegration() {
    try {
      const r = await fetch("/api/system/app-integration");
      if (!r.ok) return;
      appIntegration = await r.json();
    } catch (e) {
      // Serveur plus ancien ou route indisponible : on reste sur les
      // valeurs par defaut, la section demeure simplement masquee.
      // Older server or route unavailable: we keep the defaults, the
      // section simply stays hidden.
    }
  }

  function fillDesktopAppForm() {
    const supported = !!(appIntegration.desktopApp && appIntegration.autoStart && appIntegration.autoStart.supported);
    $("secDesktopApp").hidden = !supported;
    $("setAutoStart").checked = supported && !!appIntegration.autoStart.enabled;
  }

  function openSettings() {
    $("setLang").value = settings.lang;
    $("setTheme").value = settings.theme;
    $("setRows").value = settings.gridRows;
    $("setKeyboard").checked = !!settings.keyboardEnabled;
    $("setTouch").checked = !!settings.touchMode;
    $("setMultiColumnForms").checked = settings.multiColumnForms !== false;
    pendingCity = null;
    $("setCity").value = "";
    $("citySuggest").hidden = true;
    $("cityCurrent").textContent = cityCurrentLabel();
    const colors = currentColors();
    $("setDarkBg").value = colors.dark.bg;
    $("setDarkTile").value = colors.dark.tile;
    $("setLightBg").value = colors.light.bg;
    $("setLightTile").value = colors.light.tile;
    fillScreensaverForm();
    fillDesktopAppForm();
    $("settingsModal").hidden = false;
    requestAnimationFrame(() => layoutFormColumns(document.querySelector("#settingsModal .form")));
  }

  async function saveSettings() {
    const body = {
      lang: $("setLang").value,
      theme: $("setTheme").value,
      gridRows: Math.max(4, Math.min(16, Number($("setRows").value) || 8)),
      keyboardEnabled: $("setKeyboard").checked,
      touchMode: $("setTouch").checked,
      multiColumnForms: $("setMultiColumnForms").checked,
      colors: {
        dark: { bg: $("setDarkBg").value, tile: $("setDarkTile").value },
        light: { bg: $("setLightBg").value, tile: $("setLightTile").value }
      },
      screensaver: collectScreensaverSettings()
    };
    if (pendingCity) {
      body.cityName = pendingCity.name;
      body.latitude = pendingCity.lat;
      body.longitude = pendingCity.lon;
    }
    /* Le lancement au demarrage de la session n'est PAS un reglage
       PiBoard : il vit dans le systeme d'exploitation, pas dans
       data/settings.json. Il est donc applique par une route dediee,
       separement, et son echec eventuel ne doit pas empecher
       l'enregistrement du reste.
       Launch at session startup is NOT a PiBoard setting: it lives in
       the operating system, not in data/settings.json. It is therefore
       applied through a dedicated route, separately, and its possible
       failure must not prevent the rest from being saved. */
    if (appIntegration.desktopApp && appIntegration.autoStart && appIntegration.autoStart.supported) {
      const wanted = $("setAutoStart").checked;
      if (wanted !== !!appIntegration.autoStart.enabled) {
        try {
          const r = await fetch("/api/system/autostart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: wanted })
          });
          if (r.ok) appIntegration.autoStart = await r.json();
        } catch (e) {
          // Sans effet sur le reste des reglages / no effect on the other settings
        }
      }
    }

    settings = await apiPut("/api/settings", body);
    $("settingsModal").hidden = true;
    vkb.hide();
    applySettings();
    vkb.setEnabled(!!settings.keyboardEnabled);
    vkb.setLang(settings.lang);
  }

  /* Autocompletion de ville (Open-Meteo, comme City Road Traffic)
     City autocomplete (Open-Meteo geocoding) */
  let citySearchTimer = null;

  async function citySearch(query) {
    const url = "https://geocoding-api.open-meteo.com/v1/search?count=5&name=" + encodeURIComponent(query)
      + "&language=" + (i18n.lang === "fr" ? "fr" : "en");
    const data = await fetch(url).then((r) => r.json());
    return (data.results || []).map((r) => ({
      name: r.name,
      detail: [r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.latitude,
      lon: r.longitude
    }));
  }

  function initCitySearch() {
    const input = $("setCity");
    const list = $("citySuggest");

    input.addEventListener("input", () => {
      clearTimeout(citySearchTimer);
      const q = input.value.trim();
      if (q.length < 2) { list.hidden = true; return; }
      citySearchTimer = setTimeout(async () => {
        try {
          const results = await citySearch(q);
          list.innerHTML = results.length
            ? results.map((r, idx) =>
                `<button type="button" data-idx="${idx}">${r.name} <small>${r.detail}</small></button>`
              ).join("")
            : `<button type="button" disabled>${i18n.t("settings.city.none")}</button>`;
          list.hidden = false;
          list._results = results;
        } catch (e) {
          list.hidden = true;
        }
      }, 300);
    });

    list.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-idx]");
      if (!btn) return;
      const r = list._results[Number(btn.dataset.idx)];
      pendingCity = { name: r.name + (r.detail ? " (" + r.detail + ")" : ""), lat: r.lat, lon: r.lon };
      input.value = "";
      list.hidden = true;
      $("cityCurrent").textContent = cityCurrentLabel();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".city-box")) list.hidden = true;
    });
  }

  /* Menu "Quitter le tableau de bord" : deux options distinctes.
     - Reinitialiser le tableau de bord : un simple location.reload().
       Purement cote navigateur, ca marche a l'identique depuis le
       kiosque ou depuis n'importe quel autre navigateur qui affiche
       PiBoard -- chacun ne recharge que son propre onglet. Pas besoin
       du serveur ni de toucher au processus Chromium : c'est deja un
       rechargement complet et fiable du tableau de bord.
     - Revenir au bureau : appelle /api/system/exit-to-desktop cote
       serveur. Le fichier autostart labwc reellement deploye enveloppe
       Chromium dans le superviseur "lwrespawn", qui le relance
       automatiquement des qu'il se ferme -- tuer Chromium seul ne
       revele donc jamais le bureau. Cette route tue D'ABORD lwrespawn,
       PUIS Chromium (voir server/index.js pour le detail et pourquoi
       l'ordre compte). N'agit que depuis le kiosque local ; depuis un
       autre navigateur, le serveur refuse et on se contente de fermer
       l'onglet (meme logique que documentee plus bas dans
       performExit()).

     "Exit dashboard" menu: two distinct options.
     - Reset the dashboard: a plain location.reload(). Purely
       client-side, works identically from the kiosk or from any other
       browser displaying PiBoard -- each one only reloads its own tab.
       No need for the server or to touch the Chromium process at all:
       this is already a complete, reliable reload of the dashboard.
     - Return to the desktop: calls the server's
       /api/system/exit-to-desktop. The actually deployed labwc autostart
       file wraps Chromium in the "lwrespawn" supervisor, which
       automatically relaunches it as soon as it closes -- so killing
       Chromium alone never reveals the desktop. This route kills
       lwrespawn FIRST, THEN Chromium (see server/index.js for the
       detail and why the order matters). Only acts from the local
       kiosk; from another browser, the server refuses and we just close
       the tab (same logic documented further below in performExit()). */
  function openExitMenu() {
    $("exitMenuModal").hidden = false;
  }

  function resetDashboard() {
    $("exitMenuModal").hidden = true;
    location.reload();
  }

  async function performExit(endpoint, fallbackText) {
    try {
      await fetch(endpoint, { method: "POST" });
    } catch (e) {
      console.warn("[piboard] exit", endpoint, e);
    }
    // Dans les deux cas (le kiosque local va se fermer de lui-meme, ou la
    // requete a ete refusee car on est ailleurs) : fermer l'onglet est le
    // bon geste ici, ou n'a simplement aucun effet si le navigateur
    // l'interdit (onglet non ouvert par script) -- sans consequence.
    // Either way (the local kiosk is about to close on its own, or the
    // request was refused because we're elsewhere): closing the tab is
    // the right move here, or simply has no effect if the browser
    // disallows it (tab not opened by script) -- harmless either way.
    window.close();
    // window.close() est une restriction de securite universelle des
    // navigateurs : un script ne peut fermer que les onglets qu'il a
    // lui-meme ouverts via window.open(). Sur un onglet ouvert
    // normalement (tape dans la barre d'adresse, favori, etc.), l'appel
    // echoue silencieusement -- aucune page web, aucun code cote client,
    // ne peut contourner cette regle. Si on est encore la un instant
    // plus tard, c'est que ca s'est produit : on affiche alors un
    // message clair plutot que de laisser croire que rien ne s'est passe.
    // window.close() is a universal browser security restriction: a
    // script can only close tabs it opened itself via window.open(). On
    // a normally-opened tab (typed in the address bar, a bookmark, etc.),
    // the call silently fails -- no web page, no client-side code, can
    // bypass this rule. If we're still here a moment later, that's what
    // happened: we then show a clear message instead of leaving the
    // impression that nothing happened.
    setTimeout(() => {
      $("exitFallbackText").textContent = fallbackText;
      $("exitFallback").hidden = false;
    }, 300);
  }

  function exitToDesktop() {
    $("exitMenuModal").hidden = true;
    performExit("/api/system/exit-to-desktop", i18n.t("exit.desktop.fallback"));
  }

  /* ---------- Economiseur d'ecran / screensaver ---------- */

  const SS_SLOT_COUNT = 5;
  let ssActiveInstance = null;   // instance SlideshowWidget en cours, ou null (mode noir / inactif)
  let ssActiveSlotKey = null;    // identifie la plage actuellement affichee, pour eviter de la rouvrir apres reveil manuel
  let ssDismissedKey = null;     // plage que l'utilisateur a explicitement fermee (ne se rouvre pas avant la prochaine plage)

  /* Options du delai avant retour automatique en veille, en minutes ; 0 =
     desactive (comportement d'origine : reste reveille jusqu'a la
     prochaine plage). Options for the auto-return-to-screensaver delay,
     in minutes; 0 = disabled (original behavior: stays awake until the
     next slot). */
  const SS_INACTIVITY_OPTIONS = [0, 1, 2, 5, 10, 15, 30];

  /* Horodatage de la derniere activite utilisateur (touche/clic/tap),
     utilise uniquement pour re-endormir automatiquement l'ecran apres un
     reveil manuel pendant une plage programmee (voir checkScreensaver).
     Timestamp of the last user activity (key/click/tap), used only to
     automatically put the screen back to sleep after a manual wake
     during a scheduled slot (see checkScreensaver). */
  let ssLastActivityAt = Date.now();

  /* Construit les 5 lignes de plages horaires dans le formulaire de
     reglages. Une plage avec debut ET fin vides est simplement ignoree au
     moment de la sauvegarde (meme principe que les trajets supplementaires
     du widget Trajet domicile-travail).
     Builds the 5 time-slot rows in the settings form. A slot with both
     start AND end empty is simply skipped when saving (same principle as
     the Commute time widget's extra trips). */
  function renderScreensaverSlots() {
    const el = $("ssSlots");
    let html = "";
    for (let i = 0; i < SS_SLOT_COUNT; i++) {
      html += `
        <div class="ss-slot">
          <span>${i18n.t("ss.slot")} ${i + 1}</span>
          <input type="time" id="setSSSlot${i}Start">
          <span class="ss-slot-sep">→</span>
          <input type="time" id="setSSSlot${i}End">
          <select id="setSSSlot${i}Mode">
            <option value="black">${i18n.t("ss.mode.black")}</option>
            <option value="slideshow">${i18n.t("ss.mode.slideshow")}</option>
          </select>
        </div>`;
    }
    el.innerHTML = html;
  }

  /* Remplit le select du delai avant retour automatique en veille.
     Rendu une seule fois au demarrage (meme principe que
     renderScreensaverSlots ci-dessus, dont les options "Noir"/"Diaporama"
     ne sont elles non plus jamais re-rendues apres un changement de
     langue). Fills the auto-return delay select. Rendered once at
     startup (same principle as renderScreensaverSlots above, whose
     "Black"/"Slideshow" options also never get re-rendered after a
     language change). */
  function renderScreensaverInactivityOptions() {
    const el = $("setSSInactivityTimeout");
    el.innerHTML = SS_INACTIVITY_OPTIONS.map((min) =>
      `<option value="${min}">${min === 0 ? i18n.t("ss.inactivityTimeout.never") : min + " min"}</option>`
    ).join("");
  }

  function fillScreensaverForm() {
    const ss = settings.screensaver || {};
    $("setSSEnabled").checked = !!ss.enabled;
    const slots = ss.slots || [];
    for (let i = 0; i < SS_SLOT_COUNT; i++) {
      const s = slots[i] || {};
      $("setSSSlot" + i + "Start").value = s.start || "";
      $("setSSSlot" + i + "End").value = s.end || "";
      $("setSSSlot" + i + "Mode").value = s.mode || "black";
    }
    // Repli "uploaded" -> "upload" : une config deja enregistree AVANT ce
    // correctif contient encore l'ancienne valeur erronee. Sans cette
    // conversion silencieuse, il aurait fallu re-selectionner et
    // re-enregistrer manuellement pour que le correctif prenne effet.
    // Fallback "uploaded" -> "upload": a config already saved BEFORE this
    // fix still holds the old, wrong value. Without this silent
    // conversion, one would have had to manually reselect and re-save for
    // the fix to take effect.
    const savedSource = ss.slideshowSource === "uploaded" ? "upload" : ss.slideshowSource;
    $("setSSSource").value = savedSource || "upload";
    $("setSSFolderPath").value = ss.slideshowFolderPath || "";
    $("setSSWebdavUrl").value = ss.slideshowWebdavUrl || "";
    $("setSSWebdavUser").value = ss.slideshowWebdavUser || "";
    $("setSSWebdavPass").value = ss.slideshowWebdavPass || "";
    $("setSSImages").value = ss.slideshowImages || "";
    $("setSSInterval").value = ss.slideshowInterval || 12;
    $("setSSShuffle").checked = !!ss.slideshowShuffle;
    // Comportement historique (avant que ce reglage soit expose) : le
    // zoom lent etait toujours actif, sans reglage possible -- coche
    // par defaut pour ne rien changer aux installations existantes.
    // Historical behavior (before this setting was exposed): the slow
    // zoom was always on, with no way to disable it -- checked by
    // default so existing installs see no change.
    $("setSSKenBurns").checked = ss.slideshowKenBurns != null ? !!ss.slideshowKenBurns : true;
    $("setSSFitLandscape").value = ss.slideshowFitLandscape || "cover";
    $("setSSFitPortrait").value = ss.slideshowFitPortrait || "contain";
    $("setSSContainBg").value = ss.slideshowContainBackground || "color";
    $("setSSContainBgColor").value = ss.slideshowContainBackgroundColor || "#000000";
    $("setSSInactivityTimeout").value = SS_INACTIVITY_OPTIONS.includes(Number(ss.inactivityTimeout))
      ? String(ss.inactivityTimeout) : "5";
    loadScreensaverMedia();
  }

  function collectScreensaverSettings() {
    const slots = [];
    for (let i = 0; i < SS_SLOT_COUNT; i++) {
      slots.push({
        start: $("setSSSlot" + i + "Start").value || "",
        end: $("setSSSlot" + i + "End").value || "",
        mode: $("setSSSlot" + i + "Mode").value || "black"
      });
    }
    return {
      enabled: $("setSSEnabled").checked,
      slots,
      slideshowSource: $("setSSSource").value,
      slideshowFolderPath: $("setSSFolderPath").value,
      slideshowWebdavUrl: $("setSSWebdavUrl").value,
      slideshowWebdavUser: $("setSSWebdavUser").value,
      slideshowWebdavPass: $("setSSWebdavPass").value,
      slideshowImages: $("setSSImages").value,
      slideshowInterval: Math.max(3, Number($("setSSInterval").value) || 12),
      slideshowShuffle: $("setSSShuffle").checked,
      slideshowKenBurns: $("setSSKenBurns").checked,
      slideshowFitLandscape: $("setSSFitLandscape").value,
      slideshowFitPortrait: $("setSSFitPortrait").value,
      slideshowContainBackground: $("setSSContainBg").value,
      slideshowContainBackgroundColor: $("setSSContainBgColor").value,
      inactivityTimeout: Number($("setSSInactivityTimeout").value) || 0
    };
  }

  /* Photos televersees pour la veille : meme mecanisme que le widget
     Diaporama (server/media.js), avec un identifiant synthetique mais
     valide selon son format habituel ("t-" + alphanumerique) -- aucune
     tuile Diaporama n'a besoin d'exister pour que ce dossier de photos
     fonctionne, il vit independamment sous data/media/t-screensaver/.
     Uploaded photos for the screensaver: same mechanism as the Slideshow
     widget (server/media.js), with a synthetic id that's still valid per
     its usual format ("t-" + alphanumeric) -- no Slideshow tile needs to
     exist for this photo folder to work, it lives independently under
     data/media/t-screensaver/. */
  const SS_MEDIA_ID = "t-screensaver";

  async function loadScreensaverMedia() {
    let items = [];
    try {
      // Le serveur renvoie { items: [...] }, pas directement un tableau --
      // exactement comme le lit deja le widget Diaporama (data.items || []).
      // Ma version precedente traitait la reponse comme si c'etait deja le
      // tableau : items.map() plantait alors silencieusement a chaque
      // rafraichissement, y compris juste apres un upload qui, lui, avait
      // reellement reussi cote serveur -- donnant l'impression trompeuse
      // que rien ne s'etait televerse.
      // The server returns { items: [...] }, not a plain array -- exactly
      // as the Slideshow widget already reads it (data.items || []). My
      // previous version treated the response as if it were already the
      // array: items.map() then silently threw on every refresh, including
      // right after an upload that had actually succeeded server-side --
      // giving the misleading impression that nothing was uploaded.
      const data = await fetch("/api/media/" + SS_MEDIA_ID).then((r) => r.json());
      items = data.items || [];
    } catch (e) { /* dossier pas encore cree, liste vide / folder not created yet, empty list */ }
    const list = $("ssMediaList");
    $("ssMediaEmpty").hidden = items.length > 0;
    // On utilise le champ "url" deja fourni par le serveur (comme le fait
    // le diaporama), plutot que de reconstruire un chemin a la main :
    // c'etait aussi une erreur ("/api/media/..." ne sert pas le fichier,
    // seulement sa fiche JSON -- le fichier lui-meme est servi sur
    // "/media/..." sans le prefixe /api).
    // We use the "url" field already provided by the server (as the
    // Slideshow widget does), rather than hand-building a path: that was
    // also wrong ("/api/media/..." doesn't serve the file, only its JSON
    // listing -- the file itself is served at "/media/..." without the
    // /api prefix).
    list.innerHTML = items.map((it) => `
      <div class="ss-media-item">
        <img src="${it.url}" alt="">
        <button type="button" data-name="${it.name.replace(/"/g, "&quot;")}" aria-label="${i18n.t("common.close")}">&times;</button>
      </div>`).join("");
    list.querySelectorAll("button[data-name]").forEach((btn) => {
      onActivate(btn, async () => {
        await fetch("/api/media/" + SS_MEDIA_ID + "/" + encodeURIComponent(btn.dataset.name), { method: "DELETE" });
        loadScreensaverMedia();
      });
    });
  }

  function wireScreensaverUpload() {
    // Declenchement du selecteur de fichiers via un "click" natif classique,
    // pas via onActivate() (base sur pointerup) : c'est exactement ce que
    // fait deja le widget Diaporama pour son propre bouton d'upload (qui,
    // lui, fonctionne). Un input[type=file] cache, declenche depuis un
    // gestionnaire pointerup plutot que click, peut ne pas ouvrir le
    // selecteur de fichiers natif de facon fiable selon le navigateur --
    // c'etait l'ecart exact avec le diaporama.
    // File picker triggered via a plain, classic "click", not via
    // onActivate() (pointerup-based): this is exactly what the Slideshow
    // widget already does for its own upload button (which does work). A
    // hidden input[type=file], triggered from a pointerup handler rather
    // than click, may not reliably open the native file picker depending
    // on the browser -- that was the exact discrepancy with the slideshow.
    $("ssUploadBtn").addEventListener("click", () => $("ssFileInput").click());
    $("ssFileInput").addEventListener("change", async () => {
      const files = $("ssFileInput").files;
      if (!files || !files.length) return;
      const form = new FormData();
      for (const f of files) form.append("photos", f);
      try {
        await fetch("/api/media/" + SS_MEDIA_ID, { method: "POST", body: form });
      } catch (e) {
        console.warn("[piboard] screensaver upload", e);
      }
      $("ssFileInput").value = "";
      loadScreensaverMedia();
    });
  }

  /* Une plage est active si l'heure courante s'y trouve. Gere le
     passage a minuit (ex. 22:00 -> 06:00) exactement comme le calendrier
     de rafraichissement du widget Trafic.
     A slot is active if the current time falls within it. Handles
     crossing midnight (e.g. 22:00 -> 06:00) exactly like the Traffic
     widget's refresh schedule. */
  function isSlotActive(slot, hhmm) {
    if (!slot.start || !slot.end || slot.start === slot.end) return false;
    if (slot.start < slot.end) return hhmm >= slot.start && hhmm < slot.end;
    return hhmm >= slot.start || hhmm < slot.end; // plage traversant minuit / slot crossing midnight
  }

  function currentHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function anyModalOpen() {
    return Array.from(document.querySelectorAll(".modal")).some((m) => !m.hidden);
  }

  function checkScreensaver() {
    // Une session lancee manuellement (bouton "Lancer le cadre photo" du
    // tiroir) ne doit JAMAIS etre interrompue par le calendrier
    // automatique -- ni parce que l'economiseur programme est desactive,
    // ni parce qu'on est hors de toute plage horaire. Sans ce garde-fou,
    // le prochain passage de checkScreensaver() (toutes les 15s) refermait
    // la veille manuelle des le premier tick, quelle que soit la photo en
    // cours -- exactement le bug observe ("on ne voit qu'une seule
    // image"). Seul un reveil explicite (clic/tap/touche) la referme.
    // A manually-launched session ("Start photo frame" button in the
    // drawer) must NEVER be interrupted by the automatic schedule -- not
    // because the scheduled screensaver is disabled, nor because we're
    // outside any time slot. Without this guard, the next
    // checkScreensaver() pass (every 15s) closed the manual screensaver on
    // its very first tick, whatever photo was showing -- exactly the
    // observed bug ("only one image is shown"). Only an explicit wake
    // (click/tap/key) closes it.
    if (ssActiveSlotKey === "manual") return;

    const ss = settings && settings.screensaver;
    if (!ss || !ss.enabled) {
      if (ssActiveSlotKey) deactivateScreensaver();
      return;
    }
    // Ne jamais se declencher pendant une session de configuration active
    // (edition du tableau, ou une fenetre de reglages ouverte).
    // Never trigger during an active configuration session (editing the
    // board, or a settings window open).
    if (editing || anyModalOpen()) return;

    const hhmm = currentHHMM();
    const slots = ss.slots || [];
    const match = slots.find((s) => isSlotActive(s, hhmm));

    if (!match) {
      if (ssActiveSlotKey) deactivateScreensaver();
      ssDismissedKey = null; // hors de toute plage : on reautorise un futur declenchement / outside any slot: re-arm for a future trigger
      return;
    }

    const key = match.start + "-" + match.end + "-" + match.mode;
    if (key === ssDismissedKey) {
      // Reveille manuellement pour cette occurrence : normalement on ne le
      // rouvre pas tout seul, SAUF si le delai d'inactivite configure est
      // ecoule -- on est toujours dans la meme plage horaire, donc on doit
      // revenir en veille au bout d'un moment sans aucune action.
      // Manually woken for this occurrence: normally we don't reopen it on
      // our own, EXCEPT if the configured inactivity delay has elapsed --
      // we're still within the same time slot, so it should return to
      // sleep after a while with no activity at all.
      const timeoutMin = Number(ss.inactivityTimeout) || 0;
      if (timeoutMin <= 0) return;
      if (Date.now() - ssLastActivityAt < timeoutMin * 60000) return;
      ssDismissedKey = null; // delai ecoule : on retombe dans le cas normal ci-dessous / delay elapsed: fall through to the normal case below
    }
    if (key === ssActiveSlotKey) return; // deja affiche pour cette plage
    activateScreensaver(match, key);
  }

  function activateScreensaver(slot, key) {
    ssActiveSlotKey = key;
    const overlay = $("screensaverOverlay");
    const ssiEl = $("screensaverSlideshow");
    ssiEl.hidden = slot.mode !== "slideshow";

    if (slot.mode === "slideshow") {
      const manifest = catalog.find((m) => m.id === "slideshow");
      const Klass = widgetClasses.get("slideshow");
      if (Klass && manifest) {
        const ss = settings.screensaver;
        // Meme repli qu'a l'ouverture des reglages (voir fillScreensaverForm) :
        // garde-fou independant, au cas ou la veille se declenche sans que
        // les reglages n'aient ete rouverts/re-enregistres depuis le
        // correctif.
        // Same fallback as when opening settings (see fillScreensaverForm):
        // an independent safety net, in case the screensaver triggers
        // without settings having been reopened/re-saved since the fix.
        const ssSource = ss.slideshowSource === "uploaded" ? "upload" : ss.slideshowSource;
        const ssSettings = Object.assign({}, defaultsFor(manifest), {
          source: ssSource,
          folderPath: ss.slideshowFolderPath,
          webdavUrl: ss.slideshowWebdavUrl,
          webdavUser: ss.slideshowWebdavUser,
          webdavPass: ss.slideshowWebdavPass,
          images: ss.slideshowImages,
          intervalSeconds: ss.slideshowInterval,
          shuffle: !!ss.slideshowShuffle,
          // Comportement historique : zoom lent actif par defaut tant
          // que le reglage n'a jamais ete enregistre (voir
          // fillScreensaverForm ci-dessus pour le meme repli).
          // Historical behavior: slow zoom on by default until the
          // setting has ever been saved (see fillScreensaverForm above
          // for the same fallback).
          kenBurns: ss.slideshowKenBurns != null ? !!ss.slideshowKenBurns : true,
          fitLandscape: ss.slideshowFitLandscape || "cover",
          fitPortrait: ss.slideshowFitPortrait || "contain",
          containBackground: ss.slideshowContainBackground || "color",
          containBackgroundColor: ss.slideshowContainBackgroundColor || "#000000",
          _showTitle: false
        });
        try {
          ssActiveInstance = new Klass({
            el: ssiEl, settings: ssSettings, instanceId: SS_MEDIA_ID,
            manifest, api: widgetApi, i18n
          });
          Promise.resolve(ssActiveInstance.init()).catch((e) => console.warn("[piboard] screensaver slideshow", e));
        } catch (e) {
          console.warn("[piboard] screensaver slideshow init", e);
        }
      }
    }
    overlay.hidden = false;
  }

  /* Lance le cadre photo immediatement, depuis le bouton du tiroir de
     configuration -- independant du calendrier programme (les plages
     horaires de la section "Economiseur d'ecran"). Fonctionne meme si
     l'economiseur automatique est desactive dans les reglages : c'est un
     geste explicite de l'utilisateur, pas une regle programmee, donc les
     garde-fous du declenchement automatique (pas pendant l'edition, pas
     si une fenetre est deja ouverte) ne s'appliquent pas ici -- si on
     clique ce bouton depuis le tiroir, une fenetre modale n'est de toute
     facon pas ouverte en meme temps. Reutilise la meme config de photos
     dediee que la veille programmee (section Ecran de veille des
     reglages).
     Launches the photo frame immediately, from the config drawer's
     button -- independent of the programmed schedule (the time slots in
     the "Screen saver" section). Works even if the automatic screensaver
     is disabled in settings: this is an explicit user gesture, not a
     scheduled rule, so the automatic-trigger safety nets (not while
     editing, not if a window is already open) don't apply here -- if this
     button is clicked from the drawer, a modal window isn't open at the
     same time anyway. Reuses the same dedicated photo config as the
     scheduled screensaver (Settings' "Screen saver" section). */
  function launchScreensaverNow() {
    showDockBar(false);
    activateScreensaver({ mode: "slideshow" }, "manual");
  }

  function deactivateScreensaver() {
    ssActiveSlotKey = null;
    const overlay = $("screensaverOverlay");
    overlay.hidden = true;
    if (ssActiveInstance) {
      try { if (ssActiveInstance.destroy) ssActiveInstance.destroy(); } catch (e) { /* ignore */ }
      ssActiveInstance = null;
    }
    $("screensaverSlideshow").innerHTML = "";
  }

  /* Reveil : clic/tap/touche n'importe ou pendant que la veille est
     affichee. On memorise la plage pour ne pas la rouvrir aussitot --
     elle ne redeviendra active qu'a la prochaine occurrence (nouvelle
     plage, ou le lendemain pour une plage quotidienne).
     Wake: click/tap/key anywhere while the screensaver is shown. The slot
     is remembered so it doesn't reopen immediately -- it only becomes
     active again at the next occurrence (a new slot, or the next day for
     a daily slot). */
  function wakeScreensaver() {
    if ($("screensaverOverlay").hidden) return;
    ssDismissedKey = ssActiveSlotKey;
    deactivateScreensaver();
  }

  /* Marque une activite utilisateur, pour le compte a rebours du retour
     automatique en veille (voir checkScreensaver). Appelee sur tout clic/
     tap/touche, que la veille soit affichee ou non -- c'est bien
     l'inactivite pendant la periode REVEILLEE qui doit etre mesuree.
     Marks user activity, for the auto-return-to-screensaver countdown
     (see checkScreensaver). Called on any click/tap/key, whether the
     screensaver is shown or not -- it's inactivity during the AWAKE
     period that must be measured. */
  function noteScreensaverActivity() {
    ssLastActivityAt = Date.now();
  }


  /* ---------- Aide du tableau de bord / dashboard help ---------- */

  let helpActiveId = null;

  /* Le contenu bilingue complet est defini dans help-content.js (charge
     avant app.js), sous window.PIBOARD_HELP -- un tableau de sections
     {id, group, title:{fr,en}, sub:{fr,en}, html:{fr,en}}. On se contente
     ici de construire le sommaire (groupe par groupe) et de basculer
     l'affichage de la section active. Separer le contenu (donnees) du
     rendu (ce fichier) permet de faire evoluer l'aide sans toucher a la
     logique d'affichage.
     The full bilingual content is defined in help-content.js (loaded
     before app.js), as window.PIBOARD_HELP -- an array of sections
     {id, group, title:{fr,en}, sub:{fr,en}, html:{fr,en}}. Here we only
     build the table of contents (group by group) and switch which
     section is shown. Separating content (data) from rendering (this
     file) lets the help text evolve without touching display logic. */
  /* Normalise une chaine pour la recherche : minuscules, accents retires
     (NFD decompose "é" en "e" + accent combinant, qu'on retire ensuite).
     Applique aux deux cotes de la comparaison (index construit a
     l'ouverture ET saisie de l'utilisateur) -- sans ca, taper "meteo"
     sans accent ne trouvait pas "Météo".
     Normalizes a string for search: lowercase, diacritics stripped (NFD
     decomposes "é" into "e" + a combining accent, then removed).
     Applied on both sides of the comparison (index built on open AND the
     user's input) -- without this, typing "meteo" without an accent
     wouldn't find "Météo". */
  function normalizeSearch(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* ---------- Sauvegarde / restauration -- backups ----------
     Voir server/backups.js : instantanes horodates de toute la
     configuration, mot de passe de boite mail toujours exclu.
     See server/backups.js: timestamped snapshots of the whole
     configuration, mailbox password always excluded. */

  function formatBackupDate(iso) {
    try {
      const locale = i18n.lang === "fr" ? "fr-FR" : "en-US";
      return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return iso;
    }
  }

  function showBackupsMessage(text, isError) {
    const el = $("backupsMsg");
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle("backups-msg-error", !!isError);
  }

  async function refreshBackupsList() {
    const listEl = $("backupsList");
    try {
      const data = await fetch("/api/backups").then((r) => r.json());
      const items = data.backups || [];
      $("backupsEmpty").hidden = items.length > 0;
      listEl.innerHTML = items.map((b) => `
        <li class="backups-item" data-backup-id="${b.id}">
          <div class="backups-item-info">
            <div class="backups-item-date">${escapeHtmlAttr(b.label || formatBackupDate(b.createdAt))}</div>
            <div class="backups-item-meta">${b.label ? formatBackupDate(b.createdAt) + " · " : ""}${b.tileCount != null ? i18n.t("backups.tileCount").replace("{n}", b.tileCount) : ""}${b.appVersion ? " · v" + escapeHtmlAttr(b.appVersion) : ""}</div>
          </div>
          <div class="backups-item-actions">
            <button type="button" class="btn small" data-action="download" title="${i18n.t("backups.download")}">⬇</button>
            <button type="button" class="btn small" data-action="restore">${i18n.t("backups.restoreConfirmAction")}</button>
            <button type="button" class="btn small danger" data-action="delete" title="${i18n.t("common.delete")}">🗑</button>
          </div>
        </li>`).join("");
    } catch (e) {
      listEl.innerHTML = "";
      showBackupsMessage(i18n.t("backups.error"), true);
    }
  }

  function openBackups() {
    $("settingsModal").hidden = true;
    showBackupsMessage("");
    $("backupsModal").hidden = false;
    refreshBackupsList();
  }

  let pendingRestoreId = null;

  function askRestoreConfirm(id, dateLabel) {
    pendingRestoreId = id;
    $("backupRestoreConfirmDate").textContent = dateLabel;
    $("backupRestoreConfirmModal").hidden = false;
  }

  async function doRestore(id) {
    try {
      await fetch(`/api/backups/${encodeURIComponent(id)}/restore`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("restore failed");
        return r.json();
      });
      // Le plus sur pour reprendre un etat propre (grille, tuiles,
      // reglages, tiroir) est de recharger entierement la page plutot
      // que d'essayer de reappliquer chaque partie a chaud.
      // The safest way to pick up a clean state (grid, tiles, settings,
      // drawer) is a full page reload rather than trying to reapply
      // every part live.
      window.location.reload();
    } catch (e) {
      showBackupsMessage(i18n.t("backups.restoreError"), true);
    }
  }

  function wireBackups() {
    $("openBackupsBtn").addEventListener("click", openBackups);

    $("backupCreateBtn").addEventListener("click", async () => {
      showBackupsMessage(i18n.t("common.loading"));
      try {
        await fetch("/api/backups", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
        }).then((r) => { if (!r.ok) throw new Error("create failed"); return r.json(); });
        showBackupsMessage(i18n.t("backups.created"));
        refreshBackupsList();
      } catch (e) {
        showBackupsMessage(i18n.t("backups.error"), true);
      }
    });

    $("backupImportBtn").addEventListener("click", () => $("backupImportInput").click());
    $("backupImportInput").addEventListener("change", async () => {
      const file = $("backupImportInput").files[0];
      $("backupImportInput").value = "";
      if (!file) return;
      showBackupsMessage(i18n.t("common.loading"));
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/backups/import", { method: "POST", body });
        if (!res.ok) throw new Error("import failed");
        // L'import restaure immediatement (voir server/backups.js) :
        // recharge pour reprendre le nouvel etat, comme apres une
        // restauration classique. Import restores immediately (see
        // server/backups.js): reloads to pick up the new state, just
        // like after a regular restore.
        window.location.reload();
      } catch (e) {
        showBackupsMessage(i18n.t("backups.importError"), true);
      }
    });

    $("backupsList").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const li = btn.closest("[data-backup-id]");
      const id = li.dataset.backupId;
      const action = btn.dataset.action;

      if (action === "download") {
        // Telechargement direct : une simple navigation suffit, le
        // serveur fixe deja l'en-tete Content-Disposition.
        // Direct download: a plain navigation is enough, the server
        // already sets the Content-Disposition header.
        window.open(`/api/backups/${encodeURIComponent(id)}/download`, "_blank");
      } else if (action === "restore") {
        askRestoreConfirm(id, li.querySelector(".backups-item-date").textContent);
      } else if (action === "delete") {
        try {
          await fetch(`/api/backups/${encodeURIComponent(id)}`, { method: "DELETE" });
          refreshBackupsList();
        } catch (e) {
          showBackupsMessage(i18n.t("backups.error"), true);
        }
      }
    });

    $("backupRestoreConfirmBtn").addEventListener("click", () => {
      if (pendingRestoreId) doRestore(pendingRestoreId);
      $("backupRestoreConfirmModal").hidden = true;
    });
  }

  function openHelp() {
    const sections = window.PIBOARD_HELP || [];
    if (!sections.length) return;

    const groupLabels = {
      presentation: i18n.t("help.group.presentation"),
      drawer: i18n.t("help.group.drawer"),
      tiles: i18n.t("help.group.tiles"),
      platform: i18n.t("help.group.platform"),
      credits: i18n.t("help.group.credits")
    };

    const nav = $("helpNav");
    let lastGroup = null;
    const itemsHtml = sections.map((sec) => {
      const groupHtml = sec.group !== lastGroup
        ? `<div class="help-nav-group" data-help-group="${sec.group}">${groupLabels[sec.group] || sec.group}</div>` : "";
      lastGroup = sec.group;
      return groupHtml +
        `<button type="button" class="help-nav-item" data-help-id="${sec.id}" data-help-search="${normalizeSearch(i18n.fromManifest(sec.title))}">${i18n.fromManifest(sec.title)}</button>`;
    }).join("");
    // Recherche en tete du sommaire : utile des que la liste des tuiles
    // s'allonge (plus de 20 desormais) pour retrouver une entree sans
    // faire defiler. Filtre les boutons par leur titre normalise, et
    // masque un en-tete de groupe devenu entierement vide plutot que de
    // laisser un titre de section sans rien dessous.
    // Search box at the top of the sidebar: useful once the tile list
    // grows long (20+ now) to find an entry without scrolling. Filters
    // buttons by their normalized title, and hides a group header that
    // became entirely empty rather than leaving a section title with
    // nothing underneath it.
    nav.innerHTML =
      `<div class="help-nav-search">
        <input type="search" id="helpNavSearch" placeholder="${i18n.t("help.search")}" autocomplete="off">
      </div>
      <div class="help-nav-list" id="helpNavList">${itemsHtml}</div>
      <div class="help-nav-empty" id="helpNavEmpty" hidden>${i18n.t("help.searchEmpty")}</div>`;

    const searchInput = $("helpNavSearch");
    const listEl = $("helpNavList");
    const emptyEl = $("helpNavEmpty");
    searchInput.addEventListener("input", () => {
      const q = normalizeSearch(searchInput.value.trim());
      listEl.querySelectorAll(".help-nav-item").forEach((btn) => {
        btn.hidden = !(!q || btn.dataset.helpSearch.includes(q));
      });
      // Un groupe reste visible tant qu'au moins un de ses boutons l'est
      // -- reparcourt dans l'ordre du DOM plutot que par cle, chaque
      // en-tete de groupe n'etant suivi que par les boutons lui
      // appartenant jusqu'au prochain en-tete.
      // A group stays visible as long as at least one of its buttons
      // does -- walked in DOM order rather than by key, since each group
      // header is only followed by the buttons belonging to it, up to
      // the next header.
      let currentGroupHeader = null, groupHasVisible = false;
      listEl.querySelectorAll(".help-nav-group, .help-nav-item").forEach((el) => {
        if (el.classList.contains("help-nav-group")) {
          if (currentGroupHeader) currentGroupHeader.hidden = !groupHasVisible;
          currentGroupHeader = el;
          groupHasVisible = false;
        } else if (!el.hidden) {
          groupHasVisible = true;
        }
      });
      if (currentGroupHeader) currentGroupHeader.hidden = !groupHasVisible;
      emptyEl.hidden = !!listEl.querySelector(".help-nav-item:not([hidden])");
    });

    listEl.querySelectorAll("[data-help-id]").forEach((btn) => {
      onActivate(btn, () => showHelpSection(btn.dataset.helpId));
    });

    showHelpSection(helpActiveId && sections.some((s) => s.id === helpActiveId)
      ? helpActiveId : sections[0].id);
    $("helpModal").hidden = false;
  }

  let changelogRaw = null; // mis en cache apres le premier chargement / cached after first load

  /* Convertisseur markdown-lite pour le changelog : titres ##, listes a
     puces (a plat, sans imbrication -- suffisant pour une lecture
     rapide), gras, code en ligne, et separateurs ---. Meme esprit que le
     rendu du bloc-notes (widgets/notes/widget.js), en plus simple.
     Markdown-lite converter for the changelog: ## headings, bullet
     lists (flat, no nesting -- enough for a quick read), bold, inline
     code, and --- separators. Same spirit as the Notes widget's
     rendering (widgets/notes/widget.js), simpler. */
  function mdLiteToHtml(md) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    let html = "", inList = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
    for (const line of md.split("\n")) {
      if (/^#{1,2}\s+/.test(line)) { closeList(); html += `<h4>${inline(line.replace(/^#{1,2}\s+/, ""))}</h4>`; continue; }
      const li = line.match(/^\s*-\s+(.*)$/);
      if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
      if (line.trim() === "") { closeList(); continue; }
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
    closeList();
    return html;
  }

  /* Chaque version du CHANGELOG.md est bilingue, separee par une ligne
     "---" (voir CHANGELOG.md) : n'affiche que le bloc correspondant a la
     langue active plutot que le doublon FR+EN complet.
     Each CHANGELOG.md version is bilingual, split by a "---" line (see
     CHANGELOG.md): shows only the block matching the active language
     rather than the full FR+EN duplicate. */
  function renderChangelog(raw, lang) {
    const versions = raw.replace(/\r\n/g, "\n").split(/\n(?=## )/).map((part) => {
      const m = part.match(/^##\s+(\S+)\s*\n([\s\S]*)$/);
      return m ? { version: m[1], body: m[2] } : null;
    }).filter(Boolean);
    if (!versions.length) return `<p class="help-sub">${i18n.t("help.changelogEmpty")}</p>`;
    return versions.map(({ version, body }) => {
      const halves = body.split(/\n-{3,}\n/);
      const chosen = halves.length >= 2 ? (lang === "fr" ? halves[0] : halves[1]) : body;
      return `<h4 class="help-changelog-version">v${version}</h4>` + mdLiteToHtml(chosen.trim());
    }).join("");
  }

  function showHelpSection(id) {
    const sections = window.PIBOARD_HELP || [];
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;
    helpActiveId = id;

    $("helpNav").querySelectorAll("[data-help-id]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.helpId === id);
    });

    const content = $("helpContent");
    // Capture d'ecran optionnelle (voir help-content.js, champ
    // "screenshot" d'une section) : simple chemin d'image relatif a
    // public/, affichee au-dessus du texte si present, sans rien changer
    // pour les nombreuses sections qui n'en ont pas encore.
    // Optional screenshot (see help-content.js, a section's "screenshot"
    // field): a plain image path relative to public/, shown above the
    // text if present, with no change for the many sections that don't
    // have one yet.
    const screenshotHtml = sec.screenshot
      ? `<img class="help-screenshot" src="${sec.screenshot}" alt="${i18n.fromManifest(sec.title)}" loading="lazy">`
      : "";
    content.innerHTML =
      `<h3>${i18n.fromManifest(sec.title)}</h3>` +
      (sec.sub ? `<p class="help-sub">${i18n.fromManifest(sec.sub)}</p>` : "") +
      screenshotHtml +
      i18n.fromManifest(sec.html);
    content.scrollTop = 0;

    if (id === "about") {
      // Meme source que la version affichee dans les reglages generaux
      // (voir plus haut /api/version) : un seul appel reseau au demarrage
      // aurait suffi, mais la reutilisation d'un cache introduirait un
      // couplage pour un gain negligeable -- ce texte n'est lu qu'a
      // l'ouverture volontaire de cette section precise.
      // Same source as the version shown in general settings (see
      // /api/version above): a single network call at startup would have
      // been enough, but reusing a cache would add coupling for a
      // negligible gain -- this text is only read when this specific
      // section is deliberately opened.
      fetch("/api/version").then((r) => r.json()).then((d) => {
        const el = document.getElementById("helpAppVersion");
        if (el && d && d.version) el.textContent = "v" + d.version;
      }).catch(() => {});
    }

    if (id === "changelog") {
      const renderNow = () => {
        // La section a pu changer pendant le chargement reseau / the
        // section may have changed during the network load.
        if (helpActiveId !== "changelog") return;
        const zone = document.createElement("div");
        zone.className = "help-changelog";
        zone.innerHTML = renderChangelog(changelogRaw, i18n.lang);
        content.appendChild(zone);
      };
      if (changelogRaw) {
        renderNow();
      } else {
        fetch("/api/changelog").then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.text();
        }).then((text) => {
          changelogRaw = text;
          renderNow();
        }).catch((e) => {
          console.warn("[piboard] changelog indisponible:", e);
          if (helpActiveId === "changelog") {
            const err = document.createElement("p");
            err.className = "help-sub";
            // Le detail (ex. "status 404") aide a diagnostiquer sans
            // ouvrir les outils de developpement -- un 404 signifie
            // typiquement que le serveur n'a pas ete redemarre depuis la
            // mise a jour qui a ajoute cette route.
            // The detail (e.g. "status 404") helps diagnose without
            // opening devtools -- a 404 typically means the server
            // hasn't been restarted since the update that added this
            // route.
            const detail = (e && e.message) ? ` (${e.message})` : "";
            err.textContent = i18n.t("help.changelogError") + detail;
            content.appendChild(err);
          }
        });
      }
    }
  }

  function applySettings() {
    i18n.setLang(settings.lang);
    // Mode tactile : cibles agrandies via CSS (voir body.touch dans style.css)
    // Touch mode: enlarged targets via CSS (see body.touch in style.css)
    document.body.classList.toggle("touch", !!settings.touchMode);
    vkb.setLang(settings.lang);
    vkb.setEnabled(!!settings.keyboardEnabled);
    applyTheme();
    updateCellHeight();
    // Les tuiles peuvent dependre de la langue / tiles may depend on language
    for (const [, rec] of tiles) {
      applyTitleBar(rec);
      if (rec.instance && rec.instance.onLangChanged) rec.instance.onLangChanged(settings.lang);
    }
  }

  function updateCellHeight() {
    const gap = 10;
    const rows = settings.gridRows || 8;
    const cell = Math.floor((window.innerHeight - gap) / rows);
    grid.cellHeight(cell);
    drawerGrid.cellHeight(cell);
  }

  /* Applique la largeur du tiroir (en % de l'ecran) via une variable CSS.
     Applies the drawer width (as a % of the screen) through a CSS variable. */
  function applyDrawerWidth(pct) {
    drawerWidthPct = Math.max(25, Math.min(75, Math.round(pct)));
    document.documentElement.style.setProperty("--drawer-w", drawerWidthPct + "vw");
  }

  /* ---------- Curseur en kiosque / kiosk cursor ---------- */

  let cursorTimer = null;
  function armCursorHide() {
    document.body.classList.remove("hide-cursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add("hide-cursor"), 8000);
  }

  /* ---------- SSE ---------- */

  function initSse() {
    const es = new EventSource("/api/events");
    es.addEventListener("layout", async (ev) => {
      const data = JSON.parse(ev.data || "{}");
      if (data.source === CLIENT_ID || editing) return;
      renderLayout(await apiGet("/api/layout"));
    });
    es.addEventListener("settings", async (ev) => {
      const data = JSON.parse(ev.data || "{}");
      if (data.source === CLIENT_ID) return;
      settings = await apiGet("/api/settings");
      applySettings();
    });
  }

  /* ---------- Demarrage / boot ---------- */

  async function boot() {
    settings = await apiGet("/api/settings");
    await refreshAppIntegration();
    i18n.setLang(settings.lang);
    vkb.attach();
    vkb.setLang(settings.lang);
    vkb.setEnabled(!!settings.keyboardEnabled);

    // Version affichee dans les reglages generaux : recuperee du serveur
    // (source unique de verite, voir /api/version), plutot que codee en
    // dur ici -- evite un texte de version obsolete apres une mise a
    // jour. Echec silencieux : le texte de repli statique du HTML reste
    // affiche si l'appel echoue.
    // Version shown in general settings: fetched from the server (single
    // source of truth, see /api/version), rather than hardcoded here --
    // avoids a stale version string after an update. Fails silently: the
    // HTML's static fallback text stays shown if the call fails.
    fetch("/api/version").then((r) => r.json()).then((d) => {
      if (d && d.version) $("appVersion").textContent = "v" + d.version;
    }).catch(() => {});

    grid = GridStack.init({
      column: COLS,
      margin: 5,
      float: true,
      staticGrid: true,
      // En mode edition, toute la surface de la tuile sert de prise
      // In edit mode, the whole tile surface is the drag handle
      resizable: { handles: "e,se,s,sw,w" },
      // Tactile (iPad, ecran tactile) : poignees toujours affichees
      // Touch (iPad, touchscreen): handles always shown
      alwaysShowResizeHandle: "mobile"
    }, "#grid");

    drawerGrid = GridStack.init({
      column: COLS,
      margin: 5,
      float: true,
      staticGrid: true,
      resizable: { handles: "e,se,s,sw,w" },
      alwaysShowResizeHandle: "mobile"
    }, "#drawerGrid");

    updateCellHeight();
    window.addEventListener("resize", updateCellHeight);
    grid.on("change", () => { if (editing) scheduleSave(); });
    drawerGrid.on("change", () => { if (editing) scheduleSave(); });

    /* En mode edition : un clic simple sur une tuile ouvre ses parametres.
       Un drag/resize qui vient de se terminer ne compte pas comme un clic.
       While editing: a plain click on a tile opens its settings.
       A drag/resize that just ended does not count as a click. */
    let justManipulated = false;
    [grid, drawerGrid].forEach((g) => {
      ["dragstart", "resizestart"].forEach((evt) => g.on(evt, () => { justManipulated = true; }));
      ["dragstop", "resizestop"].forEach((evt) => g.on(evt, () => {
        setTimeout(() => { justManipulated = false; }, 250);
      }));
    });
    const editClickHandler = (e) => {
      if (!editing || justManipulated) return;
      if (e.target.closest(".tile-btn")) return;
      const item = e.target.closest(".grid-stack-item");
      if (item && item.dataset.tileId) openTileSettings(item.dataset.tileId);
    };
    document.getElementById("grid").addEventListener("click", editClickHandler);
    document.getElementById("drawerGrid").addEventListener("click", editClickHandler);

    /* Tiroir lateral : languette d'ouverture + poignee de redimensionnement.
       La largeur est persistee dans le layout ; l'etat ouvert/ferme ne l'est
       pas (au demarrage kiosque, la carte doit occuper tout l'ecran).
       Side drawer: pull tab + resize handle. The width is persisted in the
       layout; the open/closed state is not (on kiosk boot, the map must
       have the whole screen). */
    $("drawerTab").addEventListener("click", () => {
      $("drawer").classList.toggle("open");
    });

    const drawerEl = $("drawer");
    const resizeHandle = $("drawerResize");
    let resizing = false;
    const onResizeMove = (e) => {
      if (!resizing) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(25, Math.min(75, (x / window.innerWidth) * 100));
      applyDrawerWidth(pct);
    };
    const onResizeEnd = () => {
      if (!resizing) return;
      resizing = false;
      drawerEl.classList.remove("resizing");
      document.removeEventListener("pointermove", onResizeMove);
      document.removeEventListener("pointerup", onResizeEnd);
      scheduleSave();
    };
    resizeHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizing = true;
      drawerEl.classList.add("resizing");
      document.addEventListener("pointermove", onResizeMove);
      document.addEventListener("pointerup", onResizeEnd);
    });

    applyTheme();
    // Appliquer le mode tactile des le demarrage. Sans cela, la classe
    // body.touch n'etait posee que lors de l'ENREGISTREMENT des reglages
    // (saveSettings -> applySettings), jamais au chargement : apres un
    // redemarrage, la case "Mode tactile" restait cochee mais son effet
    // n'etait pas applique tant qu'on ne re-enregistrait pas les reglages.
    // Apply touch mode from startup. Without this, the body.touch class
    // was only set when SAVING settings (saveSettings -> applySettings),
    // never on load: after a restart, the "Touch mode" checkbox stayed
    // checked but its effect wasn't applied until settings were re-saved.
    document.body.classList.toggle("touch", !!settings.touchMode);

    catalog = await apiGet("/api/widgets");
    await Promise.all(catalog.map(loadWidgetAssets));

    await renderLayout(await apiGet("/api/layout"));

    initSse();

    /* Dock */
    onActivate($("dockTab"), () => showDockBar(true));
    onActivate($("btnCollapse"), () => showDockBar(false));
    onActivate($("btnAdd"), openCatalog);
    onActivate($("btnEdit"), () => toggleEdit());
    onActivate($("btnSettings"), openSettings);
    onActivate($("btnHelp"), openHelp);
    onActivate($("btnScreensaverNow"), () => launchScreensaverNow());
    onActivate($("btnExit"), () => openExitMenu());
    onActivate($("exitOptionReset"), () => resetDashboard());
    onActivate($("exitOptionDesktop"), () => exitToDesktop());

    /* Boutons "Afficher/Masquer" des champs mot de passe : delegue sur
       document car ces boutons existent aussi bien dans le formulaire
       statique (mot de passe WebDAV de la veille) que dans les
       formulaires de tuile regeneres dynamiquement (widget Diaporama) --
       un seul gestionnaire couvre les deux sans re-cablage a chaque
       ouverture de modale.
       "Show/Hide" buttons for password fields: delegated on document
       since these buttons exist both in the static form (screen
       saver's WebDAV password) and in tile forms that get regenerated
       dynamically (Slideshow widget) -- a single handler covers both
       without rewiring on every modal open. */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".field-password-toggle");
      if (!btn) return;
      const input = btn.previousElementSibling;
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      btn.textContent = i18n.t(reveal ? "field.password.hide" : "field.password.show");
    });

    /* Suggestions cliquables pour les champs "address" (voir
       fieldMarkup() : cas "address") : recherche Nominatim debouncee
       400ms apres la derniere frappe, resultats affiches en liste --
       cliquer une suggestion remplit le champ avec l'adresse complete.
       Delegue sur document pour la meme raison que les gestionnaires
       ci-dessus : le formulaire de tuile est regenere a chaque ouverture.
       Le debounce est stocke sur l'element lui-meme (pas de fuite entre
       plusieurs champs adresse dans le meme formulaire, ex. domicile +
       travail + jusqu'a 5 trajets supplementaires du widget Trajet).
       Clickable suggestions for "address" fields (see fieldMarkup():
       "address" case): debounced Nominatim search 400ms after the last
       keystroke, results shown as a list -- clicking a suggestion fills
       the field with the full address. Delegated on document for the
       same reason as the handlers above: the tile form is regenerated
       on every open. The debounce is stored on the element itself (no
       leakage between several address fields in the same form, e.g.
       home + work + up to 5 extra trips in the Commute widget). */
    document.addEventListener("input", (e) => {
      const input = e.target.closest(".field-address-input");
      if (!input) return;
      const list = input.parentElement.querySelector(".field-address-suggest");
      if (!list) return;
      clearTimeout(input._addrTimer);
      const q = input.value.trim();
      if (q.length < 3) { list.hidden = true; return; }
      input._addrTimer = setTimeout(async () => {
        try {
          const url = "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" + encodeURIComponent(q);
          const data = await fetch("/api/proxy?url=" + encodeURIComponent(url)).then((r) => r.json());
          // La saisie a change entre-temps : reponse perimee, on l'ignore.
          // The input changed in the meantime: stale response, ignored.
          if (input.value.trim() !== q) return;
          const results = Array.isArray(data) ? data.filter((r) => r.display_name) : [];
          list.innerHTML = results.length
            ? results.map((r, idx) => `<button type="button" data-idx="${idx}">${escapeHtmlAttr(r.display_name)}</button>`).join("")
            : `<button type="button" disabled>${i18n.t("field.address.notfound")}</button>`;
          list._results = results;
          list.hidden = false;
        } catch (err) {
          list.hidden = true;
        }
      }, 400);
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".field-address-suggest button[data-idx]");
      if (!btn) return;
      const list = btn.closest(".field-address-suggest");
      const input = list.previousElementSibling;
      if (!input || !list._results) return;
      const r = list._results[Number(btn.dataset.idx)];
      if (!r) return;
      input.value = r.display_name;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      list.hidden = true;
    });

    // Clic ailleurs qu'un champ adresse : referme toute liste de
    // suggestions ouverte, sans fermer la modale elle-meme. Click
    // elsewhere than an address field: closes any open suggestion list,
    // without closing the modal itself.
    document.addEventListener("click", (e) => {
      if (e.target.closest(".field-address-wrap")) return;
      document.querySelectorAll(".field-address-suggest:not([hidden])").forEach((el) => { el.hidden = true; });
    });

    /* Bouton "Parcourir les chaines disponibles" du champ "channels" du
       widget Programme TV (voir fieldMarkup() : cas "textarea" /
       "browseChannels"). Delegue sur document pour la meme raison que
       le bouton mot de passe ci-dessus : le formulaire de tuile est
       regenere a chaque ouverture.
       Specifique au Programme TV pour l'instant : les noms de champs
       lus ci-dessous (source/xmltvfrGuide/xmltvUrl/scrapeAdapter/
       scrapeUrl) et le mappage vers le parametre "guide" attendu par
       /api/tele-channels sont ceux de CE widget. Si un second widget
       adopte un jour "browseChannels", generaliser via une regle de
       correspondance portee par le manifest plutot que ces noms en dur.

       "Browse available channels" button for the TV guide widget's
       "channels" field (see fieldMarkup(): "textarea" /
       "browseChannels" case). Delegated on document for the same reason
       as the password button above: the tile form is regenerated on
       every open.
       TV-guide-specific for now: the field names read below
       (source/xmltvfrGuide/xmltvUrl/scrapeAdapter/scrapeUrl) and the
       mapping to the "guide" parameter expected by /api/tele-channels
       belong to THIS widget. If a second widget ever adopts
       "browseChannels", generalize through a manifest-carried mapping
       rule instead of these hardcoded names. */
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".field-browse-btn");
      if (!btn) return;
      // ".form" et non "form" : #tileForm/#settingsForm sont des <div
      // class="form">, pas de veritables balises <form> (l'app ne
      // soumet jamais de formulaire HTML classique -- tout passe par
      // fetch()). ".form" and not "form": #tileForm/#settingsForm are
      // <div class="form">, not actual <form> tags (the app never
      // submits a classic HTML form -- everything goes through
      // fetch()).
      const form = btn.closest(".form");
      const textarea = form && form.querySelector('textarea[data-key="channels"]');
      const listBox = btn.parentElement.querySelector(".field-browse-list");
      if (!form || !textarea || !listBox) return;

      const fieldValue = (key) => {
        const el = form.querySelector(`[data-key="${key}"]`);
        return el ? el.value : "";
      };
      const params = new URLSearchParams();
      params.set("source", fieldValue("source") || "xmltvfr");
      params.set("guide", fieldValue("xmltvfrGuide") === "france" ? "france" : "tnt");
      if (fieldValue("xmltvUrl")) params.set("xmltvUrl", fieldValue("xmltvUrl"));
      if (fieldValue("scrapeAdapter")) params.set("scrapeAdapter", fieldValue("scrapeAdapter"));
      if (fieldValue("scrapeUrl")) params.set("scrapeUrl", fieldValue("scrapeUrl"));

      const wasOpen = !listBox.hidden;
      listBox.hidden = true;
      if (wasOpen) return; // un 2e clic referme simplement la liste / a 2nd click just closes the list

      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = i18n.t("field.browse.loading");
      try {
        const list = await fetch(`${btn.dataset.endpoint}?${params.toString()}`).then((r) => r.json());
        if (!Array.isArray(list) || !list.length) {
          listBox.innerHTML = `<div class="field-browse-empty">${i18n.t("field.browse.empty")}</div>`;
        } else {
          // Chaines deja presentes dans le textarea : pas reproposees en
          // double, mais visuellement signalees (deja ajoutee).
          // Channels already present in the textarea: not offered again
          // as a duplicate, but visually flagged (already added).
          const current = new Set(
            textarea.value.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)
          );
          listBox.innerHTML = list.map((c, idx) => {
            const already = current.has(c.name.toLowerCase()) || current.has(String(c.id).toLowerCase());
            return `<button type="button" data-idx="${idx}" ${already ? "disabled" : ""}>${c.name}${already ? ` <small>${i18n.t("field.browse.added")}</small>` : ""}</button>`;
          }).join("");
          listBox._items = list;
        }
        listBox.hidden = false;
      } catch (err) {
        listBox.innerHTML = `<div class="field-browse-empty">${i18n.t("field.browse.error")}</div>`;
        listBox.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });

    document.addEventListener("click", (e) => {
      const item = e.target.closest(".field-browse-list button[data-idx]");
      if (!item) return;
      const listBox = item.closest(".field-browse-list");
      const form = item.closest(".form"); // voir la note ci-dessus / see the note above
      const textarea = form && form.querySelector('textarea[data-key="channels"]');
      if (!textarea || !listBox || !listBox._items) return;
      const chosen = listBox._items[Number(item.dataset.idx)];
      if (!chosen) return;
      const lines = textarea.value.split("\n").map((s) => s.trim()).filter(Boolean);
      lines.push(chosen.name);
      textarea.value = lines.join("\n");
      item.disabled = true;
      item.innerHTML = `${chosen.name} <small>${i18n.t("field.browse.added")}</small>`;
    });

    // Clic ailleurs dans la modale : referme toute liste ouverte, sans
    // fermer la modale elle-meme (comportement attendu d'un menu
    // deroulant). Click elsewhere in the modal: closes any open list,
    // without closing the modal itself (expected dropdown behaviour).
    document.addEventListener("click", (e) => {
      if (e.target.closest(".field-browse")) return;
      document.querySelectorAll(".field-browse-list:not([hidden])").forEach((el) => { el.hidden = true; });
    });

    $("settingsSave").addEventListener("click", () => saveSettings().catch(console.error));
    initCitySearch();
    $("colorsReset").addEventListener("click", () => {
      $("setDarkBg").value = DEFAULT_COLORS.dark.bg;
      $("setDarkTile").value = DEFAULT_COLORS.dark.tile;
      $("setLightBg").value = DEFAULT_COLORS.light.bg;
      $("setLightTile").value = DEFAULT_COLORS.light.tile;
    });
    $("tileSave").addEventListener("click", saveTileSettings);
    $("tileSaveConfig").addEventListener("click", saveTileConfigForReuse);
    $("tileRemove").addEventListener("click", () => {
      $("tileModal").hidden = true;
      vkb.hide();
      removeTile(tileModalTarget);
    });

    /* Fermeture des modales / modal closing */
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.hasAttribute("data-close")) {
          modal.hidden = true;
          vkb.hide();
          hideCatalogTooltip(); // vit hors de la modale (position fixed) : ne se referme pas toute seule / lives outside the modal (fixed position): doesn't close on its own
        }
      });
    });
    // Le defilement de la liste rend la position "fixed" de l'info-bulle
    // perimee : on la referme plutot que de la laisser flotter au mauvais
    // endroit. Scrolling the list makes the tooltip's "fixed" position
    // stale: closing it rather than letting it float in the wrong place.
    $("catalogList").addEventListener("scroll", hideCatalogTooltip, { passive: true });

    /* Curseur / cursor */
    ["mousemove", "mousedown", "keydown", "touchstart"].forEach((evt) =>
      document.addEventListener(evt, armCursorHide, { passive: true })
    );
    armCursorHide();

    /* Sauvegarde / restauration / backup and restore */
    wireBackups();

    /* Economiseur d'ecran / screensaver */
    renderScreensaverSlots();
    renderScreensaverInactivityOptions();
    wireScreensaverUpload();
    // Reveil : clic souris, tap tactile ou n'importe quelle touche --
    // exactement ce qui a ete demande, rien de plus (un simple survol/
    // mousemove ne reveille pas, pour eviter un reveil accidentel). Ces
    // memes evenements font aussi office de marqueur d'activite pour le
    // retour automatique en veille apres un delai d'inactivite.
    // Wake: mouse click, touch tap, or any key -- exactly as requested,
    // nothing more (a plain hover/mousemove does not wake it, to avoid
    // an accidental wake-up). These same events also mark activity for
    // the auto-return-to-screensaver-after-idle feature.
    ["mousedown", "touchstart", "keydown"].forEach((evt) =>
      document.addEventListener(evt, () => { noteScreensaverActivity(); wakeScreensaver(); }, { passive: true })
    );
    checkScreensaver();
    setInterval(checkScreensaver, 15000);
  }

  boot().catch((e) => {
    console.error("[piboard] boot failed", e);
    document.body.innerHTML = "<pre style='color:#E0556F;padding:2rem'>PiBoard failed to start:\n" + e + "</pre>";
  });
})();
