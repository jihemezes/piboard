/* PiBoard widget: iptvrec / enregistrements TV
   Surveille les enregistrements lances depuis la tuile Chaines TV (voir
   server/iptvRecord.js). Tout l'etat vient du serveur : cette tuile
   fonctionne meme quand la tuile lecteur est fermee, sur une autre page,
   ou sur un autre ecran.
   Watches the recordings started from the TV channels tile. All state
   comes from the server, so this tile works even when the player tile is
   closed, on another page, or on another screen. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function clock(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    return Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function size(bytes) {
    const mb = (bytes || 0) / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(1) + " Go" : Math.round(mb) + " Mo";
  }

  const TXT = {
    fr: {
      none: "Aucun enregistrement en cours.",
      noFiles: "Aucun enregistrement dans le dossier.",
      free: "Espace libre",
      reconnecting: "reconnexion…",
      stop: "Arrêter",
      convert: "Convertir en .mp4",
      del: "Supprimer",
      delConfirm: "Supprimer cet enregistrement ?",
      noFfmpeg: "ffmpeg est absent : l'enregistrement est impossible.",
      dirError: "Dossier d'enregistrement inaccessible :",
      unreachable: "Serveur injoignable."
    },
    en: {
      none: "Nothing recording right now.",
      noFiles: "No recordings in the folder.",
      free: "Free space",
      reconnecting: "reconnecting…",
      stop: "Stop",
      convert: "Convert to .mp4",
      del: "Delete",
      delConfirm: "Delete this recording?",
      noFfmpeg: "ffmpeg is missing: recording is not possible.",
      dirError: "Recording folder unreachable:",
      unreachable: "Server unreachable."
    }
  };

  class IptvRecWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.data = null;
      this.failed = false;
    }

    t(k) { return (TXT[this.ctx.i18n.lang] || TXT.en)[k]; }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-iptvrec"></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const sec = Math.max(3, Number(this.ctx.settings.refreshSeconds) || 10);
      this.timer = setInterval(() => this.refresh(), sec * 1000);
    }

    async refresh() {
      try {
        this.data = await fetch("/api/iptv/recordings").then((r) => r.json());
        this.failed = false;
      } catch (e) {
        this.failed = true;
      }
      this.render();
    }

    async act(url, opts) {
      try {
        await fetch(url, opts);
      } catch (e) {
        console.warn("[piboard] enregistrements", e);
      }
      await this.refresh();
    }

    render() {
      const box = this.ctx.el.querySelector(".pw-iptvrec");
      if (!box) return;
      const s = this.ctx.settings;
      const d = this.data;
      if (this.failed || !d) {
        box.innerHTML = `<p class="pwrec-msg">${esc(this.t("unreachable"))}</p>`;
        return;
      }

      const head = [];
      if (!d.ffmpeg) head.push(`<p class="pwrec-msg pwrec-err">${esc(this.t("noFfmpeg"))}</p>`);
      if (!d.ready) head.push(`<p class="pwrec-msg pwrec-err">${esc(this.t("dirError"))} ${esc(d.error || d.dir)}</p>`);
      if (s.showFree !== false && typeof d.freeMB === "number") {
        head.push(`<p class="pwrec-free">${esc(this.t("free"))} : ${esc(size(d.freeMB * 1048576))}</p>`);
      }

      const active = (d.active || []).map((a) => `
        <li class="pwrec-active">
          <span class="pwrec-dot"></span>
          <span class="pwrec-name">${esc(a.channel || a.name)}</span>
          <span class="pwrec-meta">${clock(a.elapsedSec)} · ${esc(size(a.bytes))}${a.status === "reconnecting" ? " · " + esc(this.t("reconnecting")) : ""}</span>
          <button type="button" class="pwrec-btn" data-stop="${esc(a.id)}">${esc(this.t("stop"))}</button>
        </li>`).join("");

      let files = "";
      if (s.showFiles !== false) {
        const max = Math.max(1, Number(s.maxFiles) || 10);
        const rows = (d.files || []).slice(0, max).map((f) => `
          <li class="pwrec-file">
            <span class="pwrec-name">${esc(f.name)}</span>
            <span class="pwrec-meta">${esc(size(f.bytes))}</span>
            ${/\.ts$/i.test(f.name) ? `<button type="button" class="pwrec-btn" data-convert="${esc(f.name)}" title="${esc(this.t("convert"))}">mp4</button>` : ""}
            <button type="button" class="pwrec-btn pwrec-del" data-del="${esc(f.name)}" title="${esc(this.t("del"))}">✕</button>
          </li>`).join("");
        files = rows || `<li class="pwrec-msg">${esc(this.t("noFiles"))}</li>`;
      }

      box.innerHTML = head.join("") + `<ul class="pwrec-list">${active || `<li class="pwrec-msg">${esc(this.t("none"))}</li>`}${files}</ul>`;

      box.querySelectorAll("[data-stop]").forEach((b) => b.addEventListener("click", () =>
        this.act("/api/iptv/recordings/" + encodeURIComponent(b.dataset.stop) + "/stop", { method: "POST" })));
      box.querySelectorAll("[data-convert]").forEach((b) => b.addEventListener("click", () => {
        b.disabled = true;
        this.act("/api/iptv/recordings/convert", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: b.dataset.convert })
        });
      }));
      box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        if (!window.confirm(this.t("delConfirm"))) return;
        this.act("/api/iptv/recordings/file?file=" + encodeURIComponent(b.dataset.del), { method: "DELETE" });
      }));
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
      this.arm();
    }

    onLangChanged() { this.render(); }

    destroy() { clearInterval(this.timer); }
  }

  window.PiBoard.registerWidget("iptvrec", IptvRecWidget);
})();
