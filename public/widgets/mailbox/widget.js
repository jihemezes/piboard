/* PiBoard widget: courriel / mailbox
   Affiche les derniers messages d'une boite IMAP -- objet, expediteur,
   date -- et permet de lire un message dans une popup au clic, sur le
   meme principe que la tuile Flux RSS.

   Rien n'est stocke : le widget n'a aucun cache persistant, et le
   serveur ouvre une connexion a la demande puis la referme (voir
   server/mailbox.js). Le mot de passe ne transite jamais par ce
   fichier : il vit dans le coffre chiffre du serveur, adresse par
   l'identifiant de la tuile (voir server/tileSecrets.js).

   Shows an IMAP mailbox's latest messages -- subject, sender, date --
   and lets you read one in a popup on tap, on the same principle as the
   RSS feed tile.

   Nothing is stored: the widget has no persistent cache, and the server
   opens a connection on demand then closes it (see server/mailbox.js).
   The password never passes through this file: it lives in the server's
   encrypted vault, addressed by the tile's id (see
   server/tileSecrets.js). */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Desinfection identique a celle de la tuile RSS : un courriel est du
     contenu distant non fiable, souvent bien plus hostile qu'un flux RSS
     (hameconnage, pixels espions, scripts). Sont retires : scripts et
     cadres, gestionnaires d'evenements, liens cliquables (le contenu est
     fait pour etre LU sur un tableau mural, pas navigue -- et surtout
     pas un lien d'hameconnage touche par megarde), et les images
     distantes, dont le chargement confirmerait a l'expediteur que le
     message a ete ouvert.
     Same sanitizing as the RSS tile's: an email is untrusted remote
     content, often far more hostile than an RSS feed (phishing, tracking
     pixels, scripts). Removed: scripts and frames, event handlers,
     clickable links (the content is meant to be READ on a wall display,
     not navigated -- and certainly not a phishing link tapped by
     mistake), and remote images, whose loading would confirm to the
     sender that the message was opened. */
  function sanitizeHtml(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,form,link,meta,base").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((a) => {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if (a.name === "href" && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    // Liens neutralises : le texte reste, la navigation disparait.
    // Links neutralized: the text stays, the navigation goes.
    doc.querySelectorAll("a[href]").forEach((a) => a.removeAttribute("href"));
    // Images distantes remplacees par une mention : evite les pixels
    // espions. Remote images replaced by a note: avoids tracking pixels.
    doc.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt");
      const span = doc.createElement("span");
      span.className = "pwmb-img-removed";
      span.textContent = alt ? `🖼 ${alt}` : "🖼";
      img.replaceWith(span);
    });
    return doc.body.innerHTML;
  }

  function niceDate(iso, lang) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const locale = lang === "fr" ? "fr-FR" : "en-GB";
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    // Un message du jour n'a pas besoin de sa date : l'heure est
    // l'information utile. A message from today doesn't need its date:
    // the time is the useful part.
    return sameDay
      ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  }

  class MailboxWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.messages = [];
      this.modal = null;
      this.openToken = 0; // ignore une reponse arrivee apres l'ouverture d'un autre message / ignores a response arriving after another message was opened
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-mailbox"><div class="pwmb-msg">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(2, Number(this.ctx.settings.refresh) || 10);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    // Parametres non sensibles envoyes a chaque appel ; le mot de passe,
    // lui, est retrouve cote serveur via l'identifiant de la tuile.
    // Non-sensitive parameters sent on each call; the password itself is
    // looked up server-side via the tile's id.
    query(extra) {
      const s = this.ctx.settings;
      const p = new URLSearchParams(Object.assign({
        host: s.host || "", port: s.port || 993, user: s.user || "",
        folder: s.folder || "INBOX", limit: s.limit || 8
      }, extra || {}));
      return p.toString();
    }

    async refresh() {
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      if (!s.host || !s.user) {
        this.ctx.el.innerHTML = `<div class="pw-mailbox"><div class="pwmb-msg">${i18n.t("mailbox.needConfig")}</div></div>`;
        return;
      }
      try {
        const url = `/api/mail/${encodeURIComponent(this.ctx.instanceId)}/list?${this.query()}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        this.messages = data.messages || [];
        this.unseen = data.unseen || 0;
        this.render();
      } catch (e) {
        console.warn("[piboard/mailbox]", e);
        // Distingue un probleme d'identifiants d'une panne generale : ce
        // sont deux actions tres differentes pour l'utilisateur.
        // Tells a credentials problem apart from a general failure: two
        // very different actions for the user.
        const msg = /no password|authenticat|login|credential/i.test(String(e.message))
          ? i18n.t("mailbox.authError") : i18n.t("mailbox.error");
        this.ctx.el.innerHTML = `<div class="pw-mailbox"><div class="pwmb-msg">${msg}</div></div>`;
      }
    }

    render() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const lang = i18n.lang;
      let list = this.messages;
      if (s.unreadOnly) list = list.filter((m) => !m.seen);

      if (!list.length) {
        this.ctx.el.innerHTML = `<div class="pw-mailbox"><div class="pwmb-msg">${i18n.t(s.unreadOnly ? "mailbox.noUnread" : "mailbox.empty")}</div></div>`;
        return;
      }

      const rows = list.map((m, i) => `
        <li class="pwmb-item ${m.seen ? "" : "pwmb-unread"}" data-idx="${i}">
          <div class="pwmb-line1">
            <span class="pwmb-subject">${escapeHtml(m.subject || i18n.t("mailbox.noSubject"))}</span>
            <span class="pwmb-date">${niceDate(m.date, lang)}</span>
          </div>
          ${s.showSender !== false ? `<div class="pwmb-from">${escapeHtml(m.from || m.fromAddress)}</div>` : ""}
        </li>`).join("");

      this.ctx.el.innerHTML = `
        <div class="pw-mailbox">
          <ul class="pwmb-list">${rows}</ul>
        </div>`;

      // Ecouteur delegue : survit au re-rendu complet ci-dessus, et evite
      // un ecouteur par ligne. Delegated listener: survives the full
      // re-render above, and avoids one listener per row.
      this.ctx.el.querySelector(".pwmb-list").addEventListener("click", (e) => {
        const li = e.target.closest(".pwmb-item");
        if (!li) return;
        e.stopPropagation();
        this.openMessage(list[Number(li.dataset.idx)]);
      });
    }

    ensureModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pwmb-modal-card">
          <header class="modal-head">
            <h2 class="pwmb-modal-title"></h2>
            <button type="button" class="modal-close" data-close aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pwmb-modal-meta"></div>
          <div class="pwmb-modal-body"></div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap || e.target.hasAttribute("data-close")) wrap.hidden = true;
      });
      this._escHandler = (e) => { if (e.key === "Escape" && !wrap.hidden) wrap.hidden = true; };
      document.addEventListener("keydown", this._escHandler);
      this.modal = wrap;
      return wrap;
    }

    async openMessage(m) {
      if (!m) return;
      const token = ++this.openToken;
      const i18n = this.ctx.i18n;
      const modal = this.ensureModal();
      modal.querySelector(".pwmb-modal-title").textContent = m.subject || i18n.t("mailbox.noSubject");
      modal.querySelector(".pwmb-modal-meta").textContent =
        [m.from || m.fromAddress, niceDate(m.date, i18n.lang)].filter(Boolean).join(" · ");
      const body = modal.querySelector(".pwmb-modal-body");
      body.innerHTML = `<p class="pwmb-loading">${i18n.t("common.loading")}</p>`;
      modal.hidden = false;

      try {
        const url = `/api/mail/${encodeURIComponent(this.ctx.instanceId)}/message?${this.query({ uid: m.uid })}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.error ? data.error : "status " + res.status);
        // Un autre message a ete ouvert entre-temps : ne pas ecraser ce
        // qui est affiche maintenant. Another message was opened in the
        // meantime: don't overwrite what's currently shown.
        if (token !== this.openToken) return;

        let html = data.html ? sanitizeHtml(data.html) : "";
        if (!html.trim()) {
          // Repli sur la version texte, en preservant les sauts de ligne
          // que le HTML aurait rendus. Falls back to the plain-text
          // version, preserving the line breaks HTML would have rendered.
          html = `<pre class="pwmb-plain">${escapeHtml(data.text || "")}</pre>`;
        }
        const att = (data.attachments || []).length
          ? `<div class="pwmb-attachments">📎 ${data.attachments.map((a) => escapeHtml(a.filename)).join(", ")}</div>`
          : "";
        body.innerHTML = html + att;
      } catch (e) {
        console.warn("[piboard/mailbox] message", e);
        if (token !== this.openToken) return;
        body.innerHTML = `<p class="pwmb-loading">${i18n.t("mailbox.readError")}</p>`;
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.modal) {
        this.modal.remove();
        if (this._escHandler) document.removeEventListener("keydown", this._escHandler);
      }
    }
  }

  window.PiBoard.registerWidget("mailbox", MailboxWidget);
})();
