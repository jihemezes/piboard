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

  /* Mise en forme en ligne : **gras**, *italique* et ~~barre~~
     Le gras est traite AVANT l'italique : dans le cas contraire, le motif
     de l'italique consommerait la premiere paire d'asterisques de
     **gras** et produirait un italique vide suivi de texte brut.
     Inline formatting: **bold**, *italic* and ~~strikethrough~~
     Bold is handled BEFORE italic: otherwise the italic pattern would
     consume the first pair of asterisks in **bold** and yield an empty
     italic followed by raw text. */
  function inline(s) {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<s>$1</s>");
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

  /* Couleurs de note : tres pales, pour distinguer un onglet de son voisin
     sans jamais gener la lecture du texte par-dessus. Volontairement plus
     legeres que les couleurs post-it de la tuile (reglage "color"), qui
     teintent tout le bloc-notes : ici, chaque note porte la sienne.
     Note colors: very pale, so one tab can be told apart from its
     neighbour without ever hurting the readability of the text on top.
     Deliberately lighter than the tile's sticky-note colors (the "color"
     setting), which tint the whole notepad: here each note carries its own. */
  const NOTE_COLORS = ["none", "yellow", "green", "blue", "pink", "purple", "orange"];

  function newNote() {
    return {
      // Identifiant propre a la note : l'onglet actif est memorise par id
      // et non par position, sinon supprimer une note ferait glisser la
      // selection sur une autre. Note's own id: the active tab is tracked
      // by id rather than by position, otherwise deleting a note would
      // slide the selection onto a different one.
      id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: "",
      color: "none",
      updatedAt: null
    };
  }

  /* Libelle d'onglet deduit de la premiere ligne non vide, marqueurs de
     mise en forme retires. Evite d'imposer une etape de nommage a la
     creation : on tape, l'onglet se nomme tout seul.
     Tab label derived from the first non-empty line, formatting markers
     stripped. Avoids forcing a naming step at creation: you type, and the
     tab names itself. */
  function noteLabel(note, fallback) {
    const first = (note.text || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
    const bare = first
      .replace(/^#+\s+/, "")
      .replace(/^(?:- )?\[[ xX]\]\s?/, "")
      .replace(/^-\s+/, "")
      .replace(/\*\*/g, "").replace(/~~/g, "").replace(/\*/g, "")
      .trim();
    if (!bare) return fallback;
    return bare.length > 18 ? bare.slice(0, 17) + "\u2026" : bare;
  }

  class NotesWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.saveTimer = null;
      this.key = "notes-" + ctx.instanceId;
      this.notes = [];
      this.activeId = null;
      this.editing = false;
    }

    /* this.text et this.updatedAt restent des proprietes simples vues de
       l'exterieur, mais pointent desormais sur la note ACTIVE. Tout le
       code existant (toggleTask, render, save, fit, startEdit/stopEdit)
       continue donc de fonctionner sans modification.
       this.text and this.updatedAt remain plain properties as seen from
       outside, but now point at the ACTIVE note. All existing code
       (toggleTask, render, save, fit, startEdit/stopEdit) therefore keeps
       working unchanged. */
    get note() {
      return this.notes.find((n) => n.id === this.activeId) || this.notes[0] || null;
    }
    get text() { return this.note ? this.note.text : ""; }
    set text(v) { if (this.note) this.note.text = v; }
    get updatedAt() { return this.note ? this.note.updatedAt : null; }
    set updatedAt(v) { if (this.note) this.note.updatedAt = v; }

    async init() {
      const i18n = this.ctx.i18n;
      this.ctx.el.innerHTML = `
        <div class="pw-notes">
          <div class="pwn-bar" hidden>
            <button type="button" class="pwn-bar-btn" data-act="task" title="${i18n.t("notes.toolCheckbox")}" aria-label="${i18n.t("notes.toolCheckbox")}">&#9744;</button>
            <span class="pwn-bar-sep"></span>
            <button type="button" class="pwn-bar-btn pwn-bar-b" data-act="bold" title="${i18n.t("notes.toolBold")}" aria-label="${i18n.t("notes.toolBold")}">B</button>
            <button type="button" class="pwn-bar-btn pwn-bar-i" data-act="italic" title="${i18n.t("notes.toolItalic")}" aria-label="${i18n.t("notes.toolItalic")}">I</button>
            <button type="button" class="pwn-bar-btn pwn-bar-s" data-act="strike" title="${i18n.t("notes.toolStrike")}" aria-label="${i18n.t("notes.toolStrike")}">S</button>
            <span class="pwn-bar-sep"></span>
            <button type="button" class="pwn-bar-btn pwn-bar-wide" data-act="heading" title="${i18n.t("notes.toolHeading")}" aria-label="${i18n.t("notes.toolHeading")}">${i18n.t("notes.toolHeadingShort")}</button>
            <button type="button" class="pwn-bar-btn pwn-bar-wide" data-act="normal" title="${i18n.t("notes.toolNormal")}" aria-label="${i18n.t("notes.toolNormal")}">${i18n.t("notes.toolNormalShort")}</button>
            <span class="pwn-bar-sep"></span>
            <button type="button" class="pwn-bar-btn pwn-bar-color" data-act="color" title="${i18n.t("notes.toolColor")}" aria-label="${i18n.t("notes.toolColor")}"><i></i></button>
            <button type="button" class="pwn-bar-btn" data-act="newNote" title="${i18n.t("notes.toolNewNote")}" aria-label="${i18n.t("notes.toolNewNote")}">+</button>
            <button type="button" class="pwn-bar-btn pwn-bar-del" data-act="deleteNote" title="${i18n.t("notes.toolDeleteNote")}" aria-label="${i18n.t("notes.toolDeleteNote")}">&#128465;</button>
          </div>
          <div class="pwn-palette" hidden></div>
          <div class="pwn-tabs" hidden></div>
          <div class="pwn-view"></div>
          <textarea class="pwn-edit" spellcheck="false" hidden></textarea>
          <div class="pwn-foot"><span class="pwn-meta"></span><span class="pwn-status"></span></div>
        </div>`;
      this.root = this.ctx.el.querySelector(".pw-notes");
      this.bar = this.ctx.el.querySelector(".pwn-bar");
      this.tabs = this.ctx.el.querySelector(".pwn-tabs");
      this.palette = this.ctx.el.querySelector(".pwn-palette");
      this.view = this.ctx.el.querySelector(".pwn-view");
      this.edit = this.ctx.el.querySelector(".pwn-edit");
      this.meta = this.ctx.el.querySelector(".pwn-meta");
      this.status = this.ctx.el.querySelector(".pwn-status");
      this.wireToolbar();

      /* Etat : format multi-notes {notes, activeId}. Les DEUX formats
         precedents restent lus et convertis en une note unique -- une
         note existante ne doit jamais disparaitre a la mise a jour :
           - chaine brute (tout premier format) ;
           - {text, updatedAt} (format a note unique).
         La conversion n'est pas reecrite immediatement en base : elle le
         sera a la premiere modification, ce qui evite d'ecrire dans le
         stockage au simple montage d'une tuile jamais touchee.
         State: multi-note {notes, activeId} shape. BOTH previous formats
         are still read and converted into a single note -- an existing
         note must never vanish on upgrade:
           - raw string (the very first format);
           - {text, updatedAt} (the single-note format).
         The conversion isn't written back immediately: it will be on the
         first edit, which avoids writing to storage merely because a
         never-touched tile was mounted. */
      const saved = await this.ctx.api.state.get(this.key);
      if (saved && Array.isArray(saved.notes) && saved.notes.length) {
        this.notes = saved.notes.map((n) => Object.assign(newNote(), {
          id: n.id || newNote().id,
          text: typeof n.text === "string" ? n.text : "",
          color: NOTE_COLORS.includes(n.color) ? n.color : "none",
          updatedAt: n.updatedAt || null
        }));
        this.activeId = saved.notes.some((n) => n.id === saved.activeId) ? saved.activeId : this.notes[0].id;
      } else {
        const first = newNote();
        if (typeof saved === "string") first.text = saved;
        else if (saved && typeof saved.text === "string") {
          first.text = saved.text;
          first.updatedAt = saved.updatedAt || null;
        }
        this.notes = [first];
        this.activeId = first.id;
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
      // applySettings() reconstruit root.className depuis zero : la
      // classe de couleur de la note active doit etre reposee ensuite,
      // sinon elle disparaitrait silencieusement.
      // applySettings() rebuilds root.className from scratch: the active
      // note's color class must be re-applied afterwards, otherwise it
      // would silently disappear.
      this.applyNoteColor();
      this.render();
    }

    applySettings() {
      const s = this.ctx.settings;
      this.root.className = "pw-notes" + (s.color && s.color !== "none" ? " pwn-c-" + s.color : "");
      this.ctx.el.querySelector(".pwn-foot").hidden = !s.showMeta;
    }

    /* ---------- Barre d'outils / toolbar ----------
       Les boutons agissent sur le texte source du <textarea> : le
       bloc-notes stocke du Markdown leger, la barre ne fait donc
       qu'inserer ou retirer les marqueurs correspondants. Rien de neuf
       n'est stocke, une note reste parfaitement modifiable a la main.
       Buttons act on the <textarea>'s source text: the notepad stores
       light Markdown, so the toolbar merely inserts or removes the
       matching markers. Nothing new is stored, and a note stays fully
       editable by hand. */
    wireToolbar() {
      this.bar.querySelectorAll(".pwn-bar-btn").forEach((btn) => {
        // pointerdown plutot que click, avec preventDefault : SANS cela,
        // appuyer sur un bouton retire le focus du <textarea>, ce qui
        // declenche son evenement blur -> stopEdit() ferme l'editeur et
        // reaffiche la vue AVANT que l'action ait pu s'appliquer. Le
        // bouton semblerait alors sans effet, de facon totalement
        // silencieuse. preventDefault() empeche le deplacement du focus,
        // donc le blur, donc la fermeture.
        // Un seul evenement (et non pointerdown pour le focus + click
        // pour l'action) : sur ecran tactile, un pointerdown annule
        // n'est pas garanti d'etre suivi d'un click.
        // pointerdown rather than click, with preventDefault: WITHOUT
        // this, pressing a button removes focus from the <textarea>,
        // firing its blur event -> stopEdit() closes the editor and
        // re-renders the view BEFORE the action could apply. The button
        // would appear to do nothing, entirely silently. preventDefault()
        // blocks the focus move, hence the blur, hence the closing.
        // A single event (rather than pointerdown for focus + click for
        // the action): on a touch screen, a cancelled pointerdown is not
        // guaranteed to be followed by a click.
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.applyFormat(btn.dataset.act);
        });
      });
    }

    /* Remplace la portion [from, to) du <textarea> et repositionne le
       curseur, en preservant l'historique d'annulation du navigateur
       quand il est disponible (execCommand("insertText")). L'affectation
       directe de .value fonctionne partout mais vide la pile Ctrl+Z.
       Replaces the [from, to) span of the <textarea> and repositions the
       caret, preserving the browser's undo history when available
       (execCommand("insertText")). Assigning .value directly works
       everywhere but wipes the Ctrl+Z stack. */
    replaceRange(from, to, text, selStart, selEnd) {
      const ta = this.edit;
      ta.focus();
      ta.setSelectionRange(from, to);
      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, text);
      } catch (e) { inserted = false; }
      if (!inserted) {
        ta.value = ta.value.slice(0, from) + text + ta.value.slice(to);
      }
      ta.setSelectionRange(selStart, selEnd);
      // Declenche la sauvegarde differee deja branchee sur "input".
      // Triggers the debounced save already wired on "input".
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* Encadre la selection par un marqueur, ou le retire s'il y est deja
       (bascule). Sans selection, insere la paire de marqueurs et place le
       curseur entre les deux, pret a taper.
       Wraps the selection in a marker, or removes it if already present
       (toggle). With no selection, inserts the marker pair and places the
       caret between them, ready to type. */
    wrapSelection(marker) {
      const ta = this.edit;
      const v = ta.value;
      let from = ta.selectionStart;
      let to = ta.selectionEnd;
      const n = marker.length;

      // Marqueurs a l'INTERIEUR de la selection ("**mot**" selectionne en
      // entier) ou a l'EXTERIEUR ("mot" selectionne, entoure de "**") :
      // les deux cas doivent basculer, sinon reappuyer sur Gras
      // empilerait les asterisques au lieu de les enlever.
      // Markers INSIDE the selection ("**word**" fully selected) or
      // OUTSIDE it ("word" selected, surrounded by "**"): both cases must
      // toggle, otherwise pressing Bold again would stack asterisks
      // instead of removing them.
      const sel = v.slice(from, to);
      if (sel.length >= 2 * n && sel.startsWith(marker) && sel.endsWith(marker)) {
        const inner = sel.slice(n, sel.length - n);
        this.replaceRange(from, to, inner, from, from + inner.length);
        return;
      }
      if (v.slice(from - n, from) === marker && v.slice(to, to + n) === marker) {
        this.replaceRange(from - n, to + n, sel, from - n, to - n);
        return;
      }
      const out = marker + sel + marker;
      // Selection vide : curseur pose entre les deux marqueurs.
      // Empty selection: caret placed between the two markers.
      const caret = sel ? from + out.length : from + n;
      this.replaceRange(from, to, out, caret, sel ? caret : caret);
    }

    /* Applique une transformation a CHAQUE ligne couverte par la
       selection (ou a la ligne du curseur si rien n'est selectionne) :
       c'est ce qui permet de cocher d'un coup plusieurs lignes.
       Applies a transformation to EVERY line covered by the selection (or
       to the caret's line if nothing is selected): this is what allows
       turning several lines into checkboxes at once. */
    mapSelectedLines(fn) {
      const ta = this.edit;
      const v = ta.value;
      const lineStart = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      let lineEnd = v.indexOf("\n", ta.selectionEnd);
      if (lineEnd === -1) lineEnd = v.length;
      const lines = v.slice(lineStart, lineEnd).split("\n");
      // Bascule groupee : le bouton n'ajoute le marqueur que si au moins
      // une ligne ne l'a pas encore. Si toutes l'ont deja, il le retire
      // partout -- le meme bouton fait donc l'aller et le retour.
      // Group toggle: the button only adds the marker if at least one
      // line lacks it. If all lines already have it, it removes it
      // everywhere -- so the same button does both directions.
      const out = fn(lines).join("\n");
      this.replaceRange(lineStart, lineEnd, out, lineStart, lineStart + out.length);
    }

    applyFormat(act) {
      // Actions de gestion de note traitees AVANT le garde ci-dessous :
      // addNote() et deleteNote() referment volontairement l'editeur,
      // elles ne peuvent donc pas dependre de this.editing.
      // Note-management actions handled BEFORE the guard below:
      // addNote() and deleteNote() deliberately close the editor, so they
      // cannot depend on this.editing.
      if (act === "newNote") return this.addNote();
      if (act === "deleteNote") return this.deleteNote();
      if (act === "color") {
        this.palette.hidden = !this.palette.hidden;
        if (!this.palette.hidden) this.renderPalette();
        return;
      }

      if (!this.editing) return;
      if (act === "bold") return this.wrapSelection("**");
      if (act === "italic") return this.wrapSelection("*");
      if (act === "strike") return this.wrapSelection("~~");

      if (act === "task") {
        // Reconnait la meme forme que le rendu (TASK_RE), tiret optionnel
        // compris, pour que le bouton sache decocher ce que le rendu sait
        // afficher. Recognizes the same shape as the renderer (TASK_RE),
        // optional dash included, so the button can un-toggle whatever the
        // renderer can display.
        return this.mapSelectedLines((lines) => {
          const allTasks = lines.every((l) => TASK_RE.test(l) || l.trim() === "");
          return lines.map((l) => {
            if (l.trim() === "") return l;
            const m = l.match(TASK_RE);
            if (allTasks && m) return m[2];
            if (m) return l;
            // Un titre ou une puce devient une case a cocher : les
            // marqueurs de bloc sont exclusifs entre eux.
            // A heading or bullet becomes a checkbox: block markers are
            // mutually exclusive.
            return "[ ] " + l.replace(/^#+\s+/, "").replace(/^-\s+/, "");
          });
        });
      }

      if (act === "heading" || act === "normal") {
        return this.mapSelectedLines((lines) => lines.map((l) => {
          if (l.trim() === "") return l;
          const bare = l.replace(/^#+\s+/, "").replace(/^(?:- )?\[[ xX]\]\s?/, "").replace(/^-\s+/, "");
          return act === "heading" ? "# " + bare : bare;
        }));
      }
    }

    /* ---------- Onglets / tabs ---------- */

    /* La barre d'onglets n'apparait qu'a partir de deux notes : avec une
       seule il n'y a rien vers quoi basculer, et sur une petite tuile
       cette rangee prendrait de la hauteur pour rien.
       The tab bar only appears from two notes on: with a single one there
       is nothing to switch to, and on a small tile that row would eat
       height for nothing. */
    renderTabs() {
      const i18n = this.ctx.i18n;
      if (this.notes.length < 2) {
        this.tabs.hidden = true;
        this.tabs.innerHTML = "";
        return;
      }
      this.tabs.hidden = false;
      this.tabs.innerHTML = this.notes.map((n, i) => {
        const label = noteLabel(n, i18n.t("notes.noteN").replace("{n}", i + 1));
        const active = n.id === this.activeId;
        return `<button type="button" class="pwn-tab${active ? " pwn-tab-active" : ""}${n.color && n.color !== "none" ? " pwn-t-" + n.color : ""}" data-note="${n.id}"></button>`;
      }).join("");
      // textContent et non innerHTML pour le libelle : il vient du texte
      // de l'utilisateur et peut contenir < ou &. textContent rather than
      // innerHTML for the label: it comes from the user's text and may
      // contain < or &.
      this.tabs.querySelectorAll(".pwn-tab").forEach((btn, i) => {
        btn.textContent = noteLabel(this.notes[i], i18n.t("notes.noteN").replace("{n}", i + 1));
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
          this.selectNote(btn.dataset.note);
        });
      });
    }

    selectNote(id) {
      if (id === this.activeId) return;
      // Valide l'edition en cours avant de changer de note : sans cela,
      // le texte tape depuis la derniere sauvegarde differee (800 ms)
      // serait perdu au changement d'onglet. Commits the ongoing edit
      // before switching notes: without this, text typed since the last
      // debounced save (800 ms) would be lost when changing tabs.
      if (this.editing) this.stopEdit();
      this.activeId = id;
      this.applyNoteColor();
      this.render();
    }

    addNote() {
      if (this.editing) this.stopEdit();
      const n = newNote();
      this.notes.push(n);
      this.activeId = n.id;
      this.save();
      this.applyNoteColor();
      this.render();
      if (!this.ctx.settings.readOnly) this.startEdit();
    }

    /* Supprimer la DERNIERE note la viderait sans laisser de quoi ecrire :
       dans ce cas on remet simplement une note vierge, le bloc-notes
       reste utilisable. Deleting the LAST note would empty it with
       nothing left to write in: in that case a blank note is simply put
       back, so the notepad stays usable. */
    deleteNote() {
      const cur = this.note;
      if (!cur) return;
      if (!window.confirm(this.ctx.i18n.t("notes.confirmDelete"))) return;
      if (this.notes.length === 1) {
        cur.text = "";
        cur.color = "none";
      } else {
        const i = this.notes.indexOf(cur);
        this.notes.splice(i, 1);
        this.activeId = this.notes[Math.min(i, this.notes.length - 1)].id;
      }
      this.save();
      this.applyNoteColor();
      this.render();
    }

    /* ---------- Couleur de note / note color ----------
       La palette est une rangee INTERNE au widget, et non une fenetre
       positionnee par-dessus : la grille Gridstack rogne tout ce qui
       deborde de la tuile (overflow: hidden), un menu flottant ancre ici
       serait donc coupe. The palette is a row INSIDE the widget rather
       than a popup positioned above it: the Gridstack grid clips anything
       overflowing the tile (overflow: hidden), so a floating menu
       anchored here would be cut off. */
    renderPalette() {
      const i18n = this.ctx.i18n;
      this.palette.innerHTML = NOTE_COLORS.map((c) =>
        `<button type="button" class="pwn-swatch pwn-sw-${c}${this.note && this.note.color === c ? " pwn-swatch-on" : ""}" data-color="${c}" title="${i18n.t("notes.color." + c)}" aria-label="${i18n.t("notes.color." + c)}"></button>`
      ).join("");
      this.palette.querySelectorAll(".pwn-swatch").forEach((btn) => {
        // pointerdown + preventDefault, meme raison que les boutons de la
        // barre : garder le focus dans le <textarea> (voir wireToolbar()).
        // pointerdown + preventDefault, same reason as the toolbar
        // buttons: keep focus inside the <textarea> (see wireToolbar()).
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.note) this.note.color = btn.dataset.color;
          this.palette.hidden = true;
          this.applyNoteColor();
          this.renderTabs();
          this.renderPalette();
          this.save();
        });
      });
    }

    applyNoteColor() {
      const c = this.note && this.note.color;
      this.root.classList.forEach((cls) => {
        if (cls.startsWith("pwn-n-")) this.root.classList.remove(cls);
      });
      if (c && c !== "none") this.root.classList.add("pwn-n-" + c);
      const sw = this.bar.querySelector(".pwn-bar-color i");
      if (sw) sw.className = "pwn-sw-" + (c || "none");
    }

    startEdit() {
      this.editing = true;
      this.edit.value = this.text;
      this.edit.style.fontSize = getComputedStyle(this.view).fontSize;
      this.view.hidden = true;
      this.edit.hidden = false;
      // Barre visible uniquement en edition : elle agit sur le texte
      // source, elle n'aurait donc aucun sens sur la vue rendue, et elle
      // volerait de la place a la note le reste du temps.
      // Toolbar shown only while editing: it acts on the source text, so
      // it would be meaningless over the rendered view, and would steal
      // room from the note the rest of the time.
      this.bar.hidden = false;
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
      this.bar.hidden = true;
      this.palette.hidden = true;
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
        await this.ctx.api.state.put(this.key, {
          notes: this.notes,
          activeId: this.activeId,
          // Conserve pour d'eventuels lecteurs restes sur l'ancien format :
          // la note active y reste lisible telle quelle. Kept for any
          // reader still on the old format: the active note stays
          // readable there as-is.
          text: this.text,
          updatedAt: this.updatedAt
        });
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
      // Les onglets sont redessines a chaque rendu : leur libelle est
      // deduit de la premiere ligne de la note, il doit donc suivre le
      // texte. Tabs are redrawn on every render: their label is derived
      // from the note's first line, so it must follow the text.
      this.renderTabs();
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
      // applySettings() reconstruit root.className depuis zero : la
      // classe de couleur de la note active doit etre reposee ensuite,
      // sinon elle disparaitrait silencieusement.
      // applySettings() rebuilds root.className from scratch: the active
      // note's color class must be re-applied afterwards, otherwise it
      // would silently disappear.
      this.applyNoteColor();
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
