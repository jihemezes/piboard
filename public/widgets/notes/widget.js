/* PiBoard widget: notes / bloc-notes v3
   Vue rendue (Markdown leger + cases a cocher interactives), editeur au clic,
   taille auto-ajustee, couleurs post-it, lecture seule, horodatage + compteur.
   Rendered view (light Markdown + interactive checkboxes), click-to-edit,
   auto-fitting text, sticky-note colors, read-only, timestamp + word count. */
(function () {
  "use strict";

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Mise en forme en ligne : **gras** et *italique* / inline: bold, italic */
  function inline(s) {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  const TASK_RE = /^(?:- )?\[([ xX])\]\s?(.*)$/;

  function renderLines(text) {
    return text.split("\n").map((line, idx) => {
      const task = line.match(TASK_RE);
      if (task) {
        const done = task[1].toLowerCase() === "x";
        return `<div class="pwn-line pwn-task${done ? " pwn-done" : ""}">
          <button type="button" class="pwn-check" data-line="${idx}" aria-checked="${done}"></button>
          <span class="pwn-task-text">${inline(task[2])}</span></div>`;
      }
      const heading = line.match(/^#+\s+(.*)$/);
      if (heading) return `<div class="pwn-line pwn-h">${inline(heading[1])}</div>`;
      const bullet = line.match(/^-\s+(.*)$/);
      if (bullet) return `<div class="pwn-line pwn-bullet">${inline(bullet[1])}</div>`;
      if (line.trim() === "") return `<div class="pwn-line pwn-empty"></div>`;
      return `<div class="pwn-line">${inline(line)}</div>`;
    }).join("");
  }

  function countWords(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }

  class NotesWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.saveTimer = null;
      this.key = "notes-" + ctx.instanceId;
      this.text = "";
      this.updatedAt = null;
      this.editing = false;
    }

    async init() {
      this.ctx.el.innerHTML = `
        <div class="pw-notes">
          <div class="pwn-view"></div>
          <textarea class="pwn-edit" spellcheck="false" hidden></textarea>
          <div class="pwn-foot"><span class="pwn-meta"></span><span class="pwn-status"></span></div>
        </div>`;
      this.root = this.ctx.el.querySelector(".pw-notes");
      this.view = this.ctx.el.querySelector(".pwn-view");
      this.edit = this.ctx.el.querySelector(".pwn-edit");
      this.meta = this.ctx.el.querySelector(".pwn-meta");
      this.status = this.ctx.el.querySelector(".pwn-status");

      /* Etat : nouveau format {text, updatedAt}, compatible ancien format chaine
         State: new {text, updatedAt} shape, backward compatible with plain string */
      const saved = await this.ctx.api.state.get(this.key);
      if (typeof saved === "string") this.text = saved;
      else if (saved && typeof saved.text === "string") {
        this.text = saved.text;
        this.updatedAt = saved.updatedAt || null;
      }

      /* Clic sur la vue : cocher une case, ou passer en edition
         Click on the view: toggle a checkbox, or start editing */
      this.view.addEventListener("click", (e) => {
        // Meme correctif que le widget Diaporama : sans stopPropagation,
        // ce clic remonte jusqu'a la grille en mode edition et rouvre les
        // reglages de la tuile au lieu de cocher la case ou d'editer.
        // Same fix as the Slideshow widget: without stopPropagation, this
        // click bubbles up to the grid in edit mode and reopens the
        // tile's settings instead of checking the box or editing.
        e.stopPropagation();
        const check = e.target.closest(".pwn-check");
        if (check) { this.toggleTask(Number(check.dataset.line)); return; }
        if (!this.ctx.settings.readOnly) this.startEdit();
      });
      this.edit.addEventListener("blur", () => this.stopEdit());
      this.edit.addEventListener("input", () => {
        clearTimeout(this.saveTimer);
        this.status.textContent = "…";
        this.saveTimer = setTimeout(() => {
          this.text = this.edit.value;
          this.save();
        }, 800);
      });

      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);

      this.applySettings();
      this.render();
    }

    applySettings() {
      const s = this.ctx.settings;
      this.root.className = "pw-notes" + (s.color && s.color !== "none" ? " pwn-c-" + s.color : "");
      this.ctx.el.querySelector(".pwn-foot").hidden = !s.showMeta;
    }

    startEdit() {
      this.editing = true;
      this.edit.value = this.text;
      this.edit.style.fontSize = getComputedStyle(this.view).fontSize;
      this.view.hidden = true;
      this.edit.hidden = false;
      this.edit.focus();
      this.edit.setSelectionRange(this.edit.value.length, this.edit.value.length);
    }

    stopEdit() {
      if (!this.editing) return;
      this.editing = false;
      clearTimeout(this.saveTimer);
      if (this.edit.value !== this.text) {
        this.text = this.edit.value;
        this.save();
      }
      this.edit.hidden = true;
      this.view.hidden = false;
      this.render();
    }

    toggleTask(lineIdx) {
      const lines = this.text.split("\n");
      const m = (lines[lineIdx] || "").match(TASK_RE);
      if (!m) return;
      const done = m[1].toLowerCase() === "x";
      lines[lineIdx] = lines[lineIdx].replace(/\[([ xX])\]/, done ? "[ ]" : "[x]");
      this.text = lines.join("\n");
      this.save();
      this.render();
    }

    async save() {
      this.updatedAt = new Date().toISOString();
      try {
        await this.ctx.api.state.put(this.key, { text: this.text, updatedAt: this.updatedAt });
        this.status.textContent = this.ctx.i18n.t("notes.saved");
        setTimeout(() => { if (this.status) this.status.textContent = ""; }, 2000);
      } catch (e) {
        this.status.textContent = "!";
      }
      this.renderMeta();
    }

    renderMeta() {
      if (!this.ctx.settings.showMeta) return;
      const parts = [];
      if (this.updatedAt) {
        const d = new Date(this.updatedAt);
        const locale = this.ctx.i18n.lang === "fr" ? "fr-FR" : "en-GB";
        const sameDay = d.toDateString() === new Date().toDateString();
        const when = sameDay
          ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        parts.push(this.ctx.i18n.t("notes.updated") + " " + when);
      }
      const words = countWords(this.text);
      if (words > 0) parts.push(words + " " + this.ctx.i18n.t("notes.words"));
      this.meta.textContent = parts.join(" · ");
    }

    render() {
      this.view.innerHTML = this.text.trim() === ""
        ? `<div class="pwn-line pwn-hint">${this.ctx.i18n.t("notes.placeholder")}</div>`
        : renderLines(this.text);
      this.renderMeta();
      this.fit();
    }

    /* Taille du texte : auto-ajustee par dichotomie, sinon taille fixe
       Text size: binary-search auto-fit, or fixed size */
    fit() {
      const s = this.ctx.settings;
      if (!s.autoFit) {
        this.view.style.fontSize = (s.fontSize || 16) + "px";
        return;
      }
      if (this.view.hidden) return;
      const w = this.ctx.el.clientWidth || 200;
      const h = this.ctx.el.clientHeight || 200;
      // Plafond absolu : sans lui, un texte court (un seul titre, une note
      // vide) ne deborde jamais verticalement et la recherche converge vers
      // une police enorme qui mange toute la tuile. Le plafond depend aussi
      // de la plus petite dimension pour rester raisonnable sur une tuile
      // etroite ou basse.
      // Hard cap: without it, short content (a single heading, an empty
      // note) never overflows vertically and the search converges to a
      // huge font that eats the whole tile. The cap also follows the
      // smaller dimension to stay sane on a narrow or short tile.
      let lo = 12, hi = Math.min(30, Math.max(14, Math.floor(Math.min(w, h) * 0.16)));
      for (let i = 0; i < 7; i++) {
        const mid = Math.floor((lo + hi + 1) / 2);
        this.view.style.fontSize = mid + "px";
        if (this.view.scrollHeight <= this.view.clientHeight + 1) lo = mid;
        else hi = mid - 1;
      }
      this.view.style.fontSize = lo + "px";
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.applySettings();
      this.render();
    }

    onLangChanged() { this.render(); }

    destroy() {
      clearTimeout(this.saveTimer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("notes", NotesWidget);
})();
