/* PiBoard widget: notes / bloc-notes v3
   Vue rendue (Markdown leger + cases a cocher interactives), editeur au clic,
   taille auto-ajustee, couleurs post-it, lecture seule, horodatage + compteur.
   Rendered view (light Markdown + interactive checkboxes), click-to-edit,
   auto-fitting text, sticky-note colors, read-only, timestamp + word count. */
(function () {
  "use strict";

  /* Taille de texte la plus petite acceptee, pour l'ajustement
     automatique comme pour la taille imposee. Descendre a 8 px n'a de
     sens que sur un ecran de bureau, ou l'on lit a 60 cm ; c'est
     precisement le cas d'usage qui manquait (1.115.8).
     Smallest accepted text size, for both auto-fit and a fixed size.
     Going down to 8px only makes sense on a desktop screen. */
  const MIN_FONT_PX = 8;

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

  /* `old` : numeros de lignes cochees depuis longtemps, a estomper
     (reglage « Estomper les cases cochees depuis plus d'une heure »).
     `old`: line numbers checked a long time ago, to fade (setting "Fade
     items checked for more than an hour"). */
  function renderLines(text, old) {
    return text.split("\n").map((line, idx) => {
      const task = line.match(TASK_RE);
      if (task) {
        const done = task[1].toLowerCase() === "x";
        const aged = done && old && old.has(idx);
        return `<div class="pwn-line pwn-task${done ? " pwn-done" : ""}${aged ? " pwn-old" : ""}" data-row="${idx}">
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

  /* ================================================================
     DISPARITION DES ELEMENTS COCHES (1.159.0)
     Un element coche est une ligne « [x] texte ». Pour le faire
     disparaitre « le lendemain », il faut savoir QUAND il a ete coche :
     cette date n'est pas ecrite dans le texte (qui reste du Markdown
     propre, modifiable a la main) mais dans une table a part, rangee
     avec la note -- `doneAt`, cle = texte de la ligne + rang parmi les
     doublons. Deplacer ou reformuler une ligne ne casse donc rien : une
     ligne reformulee est simplement une nouvelle ligne cochee.
     Les elements disparus ne sont pas effaces : ils vont dans
     `archive` (30 jours), d'ou on peut les remettre en un geste.
     AUTO-REMOVAL OF CHECKED ITEMS (1.159.0). A checked item is a
     "[x] text" line. To make it vanish "the next day" we must know WHEN
     it was checked: that date is not written into the text (which stays
     clean, hand-editable Markdown) but in a separate table stored with
     the note -- `doneAt`, key = the line's text + rank among duplicates.
     Moving or rewording a line therefore breaks nothing: a reworded line
     is just a newly checked line. Vanished items are not erased: they go
     to `archive` (30 days), from where they can be put back in one tap.
     ================================================================ */
  const PURGE_MODES = ["off", "now", "midnight", "hours", "days"];
  const ARCHIVE_DAYS = 30;
  /* Mode « aussitot » : un court delai laisse le temps de se rattraper
     apres un tap malheureux (re-taper la case suffit). "At once" mode: a
     short delay leaves time to recover from a mis-tap (tapping the box
     again is enough). */
  const NOW_GRACE_MS = 1500;
  const OLD_DONE_MS = 3600 * 1000;
  const FADE_MS = 500;

  function normPurge(p) {
    const mode = p && PURGE_MODES.includes(p.mode) ? p.mode : "off";
    const max = mode === "hours" ? 168 : 365;
    const n = Math.max(1, Math.min(max, Math.round(Number(p && p.n)) || 1));
    return { mode, n };
  }

  /* Lignes cochees, avec leur cle. Le rang compte uniquement les lignes
     COCHEES de meme texte : cocher ou decocher un doublon plus haut ne
     decale donc pas les autres. Checked lines with their key. The rank
     only counts CHECKED lines with the same text: checking or unchecking
     a duplicate higher up therefore doesn't shift the others. */
  function doneEntries(text) {
    const seen = {};
    const out = [];
    String(text || "").split("\n").forEach((line, idx) => {
      const m = line.match(TASK_RE);
      if (!m || m[1].toLowerCase() !== "x") return;
      const body = m[2].trim();
      const k = seen[body] = (seen[body] || 0) + 1;
      out.push({ idx, body, key: body + "#" + (k - 1) });
    });
    return out;
  }

  function taskProgress(text) {
    let done = 0, total = 0;
    String(text || "").split("\n").forEach((line) => {
      const m = line.match(TASK_RE);
      if (!m) return;
      total++;
      if (m[1].toLowerCase() === "x") done++;
    });
    return { done, total };
  }

  /* Met la table des dates en phase avec le texte : une ligne cochee
     sans date recoit `now`, une date dont la ligne n'est plus cochee est
     retiree. Reconciles the date table with the text: a checked line with
     no date gets `now`, a date whose line is no longer checked is dropped. */
  function reconcileStamps(text, stamps, now) {
    const old = stamps && typeof stamps === "object" ? stamps : {};
    const out = {};
    let changed = false;
    doneEntries(text).forEach((e) => {
      if (typeof old[e.key] === "number") out[e.key] = old[e.key];
      else { out[e.key] = now; changed = true; }
    });
    if (Object.keys(old).length !== Object.keys(out).length) changed = true;
    return { stamps: out, changed };
  }

  /* Instant de disparition d'un element coche a `doneAt`.
     When a item checked at `doneAt` is due to vanish. */
  function dueAt(purge, doneAt) {
    const p = normPurge(purge);
    if (p.mode === "now") return doneAt + NOW_GRACE_MS;
    if (p.mode === "midnight") {
      const d = new Date(doneAt);
      d.setHours(24, 0, 0, 0); // minuit SUIVANT, heure locale / NEXT local midnight
      return d.getTime();
    }
    if (p.mode === "hours") return doneAt + p.n * 3600 * 1000;
    if (p.mode === "days") return doneAt + p.n * 86400 * 1000;
    return Infinity;
  }

  function dueEntries(text, stamps, purge, now) {
    if (normPurge(purge).mode === "off") return [];
    return doneEntries(text).filter((e) => {
      const t = stamps && stamps[e.key];
      return typeof t === "number" && dueAt(purge, t) <= now;
    });
  }

  /* Retire les elements arrives a echeance. Rend le nouveau texte, la
     table des dates recalee sur ce texte et la liste des elements retires.
     Removes the items that are due. Returns the new text, the date table
     realigned on it and the removed items. */
  function splitDue(text, stamps, purge, now) {
    const due = dueEntries(text, stamps, purge, now);
    if (!due.length) return { text, stamps, removed: [] };
    const gone = new Set(due.map((e) => e.idx));
    const stampAt = {};
    doneEntries(text).forEach((e) => { stampAt[e.idx] = stamps[e.key]; });
    const lines = String(text).split("\n");
    const keptIdx = [];
    lines.forEach((_, i) => { if (!gone.has(i)) keptIdx.push(i); });
    const next = keptIdx.map((i) => lines[i]).join("\n");
    const out = {};
    doneEntries(next).forEach((e) => {
      const was = stampAt[keptIdx[e.idx]];
      if (typeof was === "number") out[e.key] = was;
    });
    return {
      text: next,
      stamps: out,
      removed: due.map((e) => ({ text: e.body, doneAt: stamps[e.key] }))
    };
  }

  /* Lignes cochees depuis plus d'une heure (a estomper).
     Lines checked for over an hour (to fade). */
  function oldLines(text, stamps, now) {
    const s = new Set();
    doneEntries(text).forEach((e) => {
      const t = stamps && stamps[e.key];
      if (typeof t === "number" && now - t >= OLD_DONE_MS) s.add(e.idx);
    });
    return s;
  }

  /* Prochain instant ou il faut se reveiller (disparition ou passage au
     « estompe »), ou Infinity. Next moment to wake up at (a disappearance
     or a switch to "faded"), or Infinity. */
  function nextWake(notes, now, dim) {
    let best = Infinity;
    notes.forEach((n) => {
      const p = normPurge(n.purge);
      doneEntries(n.text).forEach((e) => {
        const t = n.doneAt && n.doneAt[e.key];
        if (typeof t !== "number") return;
        if (p.mode !== "off") best = Math.min(best, dueAt(p, t));
        if (dim && t + OLD_DONE_MS > now) best = Math.min(best, t + OLD_DONE_MS);
      });
    });
    return best;
  }

  function expireArchive(archive, now) {
    const limit = now - ARCHIVE_DAYS * 86400 * 1000;
    return (archive || []).filter((a) => typeof a.goneAt !== "number" || a.goneAt >= limit);
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
      updatedAt: null,
      // Disparition des elements coches (1.159.0) : reglage PROPRE a la
      // note, dates de cochage et archive des elements disparus.
      // Auto-removal of checked items (1.159.0): setting OWN to the note,
      // check dates and archive of the vanished items.
      purge: { mode: "off", n: 1 },
      doneAt: {},
      archive: []
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
            <button type="button" class="pwn-bar-btn pwn-bar-purge" data-act="purge" title="${i18n.t("notes.toolPurge")}" aria-label="${i18n.t("notes.toolPurge")}">&#9203;</button>
            <button type="button" class="pwn-bar-btn" data-act="newNote" title="${i18n.t("notes.toolNewNote")}" aria-label="${i18n.t("notes.toolNewNote")}">+</button>
            <button type="button" class="pwn-bar-btn pwn-bar-del" data-act="deleteNote" title="${i18n.t("notes.toolDeleteNote")}" aria-label="${i18n.t("notes.toolDeleteNote")}">&#128465;</button>
          </div>
          <div class="pwn-palette" hidden></div>
          <div class="pwn-purge" hidden></div>
          <div class="pwn-tabs" hidden></div>
          <div class="pwn-view"></div>
          <div class="pwn-archive" hidden></div>
          <textarea class="pwn-edit" spellcheck="false" hidden></textarea>
          <div class="pwn-sub" hidden><span class="pwn-prog"></span><button type="button" class="pwn-arch-btn" hidden></button></div>
          <div class="pwn-foot"><span class="pwn-meta"></span><span class="pwn-status"></span></div>
        </div>`;
      this.root = this.ctx.el.querySelector(".pw-notes");
      this.bar = this.ctx.el.querySelector(".pwn-bar");
      this.tabs = this.ctx.el.querySelector(".pwn-tabs");
      this.palette = this.ctx.el.querySelector(".pwn-palette");
      this.purgeRow = this.ctx.el.querySelector(".pwn-purge");
      this.archive = this.ctx.el.querySelector(".pwn-archive");
      this.sub = this.ctx.el.querySelector(".pwn-sub");
      this.prog = this.ctx.el.querySelector(".pwn-prog");
      this.archBtn = this.ctx.el.querySelector(".pwn-arch-btn");
      this.archiveOpen = false;
      this.tickTimer = null;
      this.sweepTimer = null;
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
          updatedAt: n.updatedAt || null,
          purge: normPurge(n.purge),
          doneAt: n.doneAt && typeof n.doneAt === "object" ? n.doneAt : {},
          archive: Array.isArray(n.archive)
            ? n.archive.filter((a) => a && typeof a.text === "string") : []
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

      // Pastille « Terminees (N) » et panneau d'archive. stopPropagation :
      // meme raison que la vue (un clic rouvrirait les reglages de la
      // tuile en mode edition). "Done (N)" pill and archive panel.
      // stopPropagation: same reason as the view.
      this.archBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.archiveOpen ? this.closeArchive() : this.openArchive();
      });
      this.archive.addEventListener("click", (e) => this.onArchiveClick(e));
      // pointerdown + preventDefault : meme raison que la palette.
      // pointerdown + preventDefault: same reason as the palette.
      this.purgeRow.addEventListener("pointerdown", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.mode) this.setPurge({ mode: b.dataset.mode });
        else if (b.dataset.step) {
          const p = normPurge(this.note && this.note.purge);
          this.setPurge({ n: p.n + Number(b.dataset.step) });
        }
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
      // Les dates de cochage sont posees maintenant pour les lignes deja
      // cochees (elles datent donc d'aujourd'hui : rien ne disparait d'un
      // coup a la mise a jour). N'ecrit en base que si une fonction qui
      // en a besoin est active -- un bloc-notes jamais touche reste intact.
      // Check dates are set now for lines that are already checked (so
      // they date from today: nothing vanishes at once on upgrade). Only
      // writes to storage if a feature needing them is on.
      if (this.needsStamps() && this.reconcileAll()) this.persist();
      this.render();
      this.sweep();
      this.scheduleTick();
    }

    needsStamps() {
      return !!this.ctx.settings.dimOldDone || this.notes.some((n) => normPurge(n.purge).mode !== "off");
    }

    reconcileNote(n, now) {
      const r = reconcileStamps(n.text, n.doneAt, now || Date.now());
      if (r.changed) n.doneAt = r.stamps;
      return r.changed;
    }

    reconcileAll() {
      const now = Date.now();
      let changed = false;
      this.notes.forEach((n) => { if (this.reconcileNote(n, now)) changed = true; });
      return changed;
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
        this.purgeRow.hidden = true;
        if (!this.palette.hidden) this.renderPalette();
        return;
      }
      if (act === "purge") {
        this.purgeRow.hidden = !this.purgeRow.hidden;
        this.palette.hidden = true;
        if (!this.purgeRow.hidden) this.renderPurge();
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
      this.closeArchive(false);
      this.activeId = id;
      this.applyNoteColor();
      this.render();
    }

    addNote() {
      if (this.editing) this.stopEdit();
      this.closeArchive(false);
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
      this.closeArchive(false);
      if (this.notes.length === 1) {
        cur.text = "";
        cur.color = "none";
        cur.purge = normPurge();
        cur.doneAt = {};
        cur.archive = [];
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
      this.purgeRow.hidden = true;
      this.view.hidden = false;
      this.render();
      // Rien ne disparait sous les doigts de l'utilisateur pendant qu'il
      // ecrit : les echeances manquees sont traitees des la sortie.
      // Nothing vanishes under the user's fingers while typing: missed
      // deadlines are handled as soon as editing ends.
      this.sweep();
      this.scheduleTick();
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
      this.sweep();
      this.scheduleTick();
    }

    async write() {
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
    }

    /* Ecriture silencieuse : ne touche ni a l'horodatage « modifie » ni
       au statut. Sert aux changements que l'utilisateur n'a pas faits
       lui-meme (disparition automatique, dates de cochage).
       Silent write: touches neither the "updated" timestamp nor the
       status. Used for changes the user didn't make himself (automatic
       removal, check dates). */
    async persist() {
      try { await this.write(); } catch (e) { /* le prochain essai suffira / next try will do */ }
    }

    async save() {
      this.updatedAt = new Date().toISOString();
      if (this.note) this.reconcileNote(this.note);
      try {
        await this.write();
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
      const dim = !!this.ctx.settings.dimOldDone && this.note;
      const old = dim ? oldLines(this.text, this.note.doneAt, Date.now()) : null;
      this.oldKey = old ? Array.from(old).join(",") : "";
      this.view.innerHTML = this.text.trim() === ""
        ? `<div class="pwn-line pwn-hint">${this.ctx.i18n.t("notes.placeholder")}</div>`
        : renderLines(this.text, old);
      this.renderSub();
      if (this.archiveOpen) this.renderArchive();
      this.updatePurgeBtn();
      if (!this.purgeRow.hidden) this.renderPurge();
      this.renderMeta();
      this.fit();
    }

    /* ---------- Progression et pastille « Terminees » ---------- */
    renderSub() {
      const i18n = this.ctx.i18n;
      const p = taskProgress(this.text);
      const showProg = this.ctx.settings.showProgress !== false && p.total > 0;
      this.prog.textContent = showProg
        ? i18n.t("notes.progress").replace("{done}", p.done).replace("{total}", p.total) : "";
      const n = this.note ? this.note.archive.length : 0;
      this.archBtn.hidden = n === 0 && !this.archiveOpen;
      this.archBtn.textContent = this.archiveOpen
        ? i18n.t("notes.archive.close") : i18n.t("notes.doneBtn").replace("{n}", n);
      this.sub.hidden = !showProg && this.archBtn.hidden;
    }

    /* ---------- Disparition automatique / auto-removal ---------- */
    updatePurgeBtn() {
      const b = this.bar.querySelector(".pwn-bar-purge");
      if (b) b.classList.toggle("pwn-bar-on", !!this.note && normPurge(this.note.purge).mode !== "off");
    }

    /* Meme principe que la palette : une rangee INTERNE a la tuile, des
       boutons (et non un <select>) pour que le focus reste dans le
       <textarea> -- voir wireToolbar().
       Same principle as the palette: a row INSIDE the tile, buttons (not
       a <select>) so focus stays in the <textarea> -- see wireToolbar(). */
    renderPurge() {
      const t = (k) => this.ctx.i18n.t(k);
      const p = normPurge(this.note && this.note.purge);
      const modes = ["off", "now", "midnight", "hours", "days"];
      const chips = modes.map((m) =>
        `<button type="button" class="pwn-chip${p.mode === m ? " pwn-chip-on" : ""}" data-mode="${m}">${t("notes.purge." + m)}</button>`
      ).join("");
      const step = (p.mode === "hours" || p.mode === "days")
        ? `<span class="pwn-step"><button type="button" class="pwn-chip" data-step="-1" aria-label="${t("notes.purge.less")}">&minus;</button><b>${p.n}</b><i>${t(p.mode === "hours" ? "notes.purge.unitH" : "notes.purge.unitD")}</i><button type="button" class="pwn-chip" data-step="1" aria-label="${t("notes.purge.more")}">+</button></span>`
        : "";
      const sum = t("notes.purge.sum." + p.mode).replace("{n}", p.n);
      this.purgeRow.innerHTML =
        `<span class="pwn-purge-lbl">${t("notes.purge.label")}</span>${chips}${step}<div class="pwn-purge-sum">${sum}</div>`;
    }

    setPurge(patch) {
      const n = this.note;
      if (!n) return;
      n.purge = normPurge(Object.assign({}, n.purge, patch));
      this.reconcileNote(n);
      this.save();
      this.renderPurge();
      this.updatePurgeBtn();
      this.scheduleTick();
    }

    /* Marque les lignes arrivees a echeance (fondu), puis les retire
       quand le fondu est fini. Jamais pendant la saisie.
       Marks the lines that are due (fade), then removes them once the
       fade is over. Never while typing. */
    sweep() {
      if (this.editing || this.sweepTimer) return;
      const now = Date.now();
      const act = this.note;
      const hasDue = this.notes.some((n) => dueEntries(n.text, n.doneAt, n.purge, now).length);
      if (!hasDue) { this.trimArchives(now); return; }
      let delay = 0;
      if (act && !this.archiveOpen && !this.view.hidden && !this.reducedMotion()) {
        const due = dueEntries(act.text, act.doneAt, act.purge, now);
        due.forEach((e) => {
          const row = this.view.querySelector('.pwn-line[data-row="' + e.idx + '"]');
          if (row) {
            row.style.maxHeight = row.offsetHeight + "px";
            void row.offsetHeight; // fige le point de depart / pins the starting point
            row.classList.add("pwn-leaving");
            row.style.maxHeight = "0px";
            delay = FADE_MS;
          }
        });
      }
      if (!delay) { this.commitPurge(); return; }
      this.sweepTimer = setTimeout(() => { this.sweepTimer = null; this.commitPurge(); }, delay);
    }

    reducedMotion() {
      try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
      catch (e) { return false; }
    }

    trimArchives(now) {
      let changed = false;
      this.notes.forEach((n) => {
        const kept = expireArchive(n.archive, now);
        if (kept.length !== n.archive.length) { n.archive = kept; changed = true; }
      });
      if (changed) { this.persist(); this.renderSub(); if (this.archiveOpen) this.renderArchive(); }
    }

    commitPurge() {
      if (this.editing) return; // reprendra a la sortie d'edition / resumes when editing ends
      const now = Date.now();
      let changed = false;
      this.notes.forEach((n) => {
        const r = splitDue(n.text, n.doneAt, n.purge, now);
        if (!r.removed.length) return;
        n.text = r.text;
        n.doneAt = r.stamps;
        r.removed.forEach((x) => n.archive.push({ text: x.text, doneAt: x.doneAt, goneAt: now }));
        changed = true;
      });
      this.notes.forEach((n) => { n.archive = expireArchive(n.archive, now); });
      if (changed) { this.persist(); this.render(); }
      else this.renderSub();
    }

    /* Un seul minuteur, reprogramme apres chaque passage : au plus tard
       dans la minute (reveil de veille, changement d'heure), plus tot si
       une echeance approche.
       A single timer, rescheduled after each pass: within a minute at the
       latest (wake from sleep, clock changes), sooner if a deadline is
       near. */
    scheduleTick() {
      clearTimeout(this.tickTimer);
      const wake = nextWake(this.notes, Date.now(), !!this.ctx.settings.dimOldDone);
      const delay = isFinite(wake) ? Math.min(60000, Math.max(1000, wake - Date.now())) : 60000;
      this.tickTimer = setTimeout(() => this.tick(), delay);
    }

    tick() {
      this.sweep();
      if (this.ctx.settings.dimOldDone && !this.editing && !this.archiveOpen && this.note) {
        const key = Array.from(oldLines(this.text, this.note.doneAt, Date.now())).join(",");
        if (key !== this.oldKey) this.render();
      }
      this.scheduleTick();
    }

    /* ---------- Archive « Terminees » ---------- */
    openArchive() {
      if (this.editing) this.stopEdit();
      this.archiveOpen = true;
      this.view.hidden = true;
      this.archive.hidden = false;
      // Un peu plus petit que la note : c'est une liste de consultation.
      // A little smaller than the note: it is a lookup list.
      this.archive.style.fontSize = Math.max(MIN_FONT_PX, Math.round((parseFloat(this.view.style.fontSize) || 16) * 0.8)) + "px";
      this.renderArchive();
      this.renderSub();
    }

    closeArchive(rerender) {
      if (!this.archiveOpen) return;
      this.archiveOpen = false;
      this.archive.hidden = true;
      this.view.hidden = false;
      if (rerender !== false) this.render();
    }

    renderArchive() {
      const i18n = this.ctx.i18n;
      const items = this.note ? this.note.archive : [];
      const locale = i18n.lang === "fr" ? "fr-FR" : "en-GB";
      const rows = items.map((a, i) => {
        const when = typeof a.doneAt === "number"
          ? new Date(a.doneAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : "";
        return { i, html: `<div class="pwn-arch-item"><span class="pwn-arch-text">${inline(a.text)}</span><span class="pwn-arch-when">${escapeHtml(when)}</span><button type="button" class="pwn-chip" data-arch="restore" data-i="${i}" title="${i18n.t("notes.archive.restore")}" aria-label="${i18n.t("notes.archive.restore")}">&#8617;</button></div>` };
      }).reverse().map((r) => r.html).join("");
      this.archive.innerHTML =
        `<div class="pwn-arch-head"><b>${i18n.t("notes.archive.title")}</b>${items.length ? `<button type="button" class="pwn-chip" data-arch="clear">${i18n.t("notes.archive.clear")}</button>` : ""}</div>` +
        `<div class="pwn-arch-hint">${i18n.t("notes.archive.hint").replace("{n}", ARCHIVE_DAYS)}</div>` +
        (items.length ? rows : `<div class="pwn-arch-empty">${i18n.t("notes.archive.empty")}</div>`);
    }

    onArchiveClick(e) {
      e.stopPropagation();
      const b = e.target.closest("[data-arch]");
      const n = this.note;
      if (!b || !n) return;
      if (b.dataset.arch === "restore") {
        const a = n.archive[Number(b.dataset.i)];
        if (!a) return;
        n.archive.splice(Number(b.dataset.i), 1);
        // Remis NON coche, en fin de note : on le retrouve la ou on
        // ajoute d'habitude. Put back UNCHECKED, at the end of the note.
        n.text += (!n.text || n.text.endsWith("\n") ? "" : "\n") + "[ ] " + a.text;
        this.save();
        this.render();
        this.scheduleTick();
      } else if (b.dataset.arch === "clear") {
        if (!window.confirm(this.ctx.i18n.t("notes.archive.confirmClear"))) return;
        n.archive = [];
        this.save();
        this.render();
      }
    }

    /* Taille du texte : auto-ajustee par dichotomie, sinon taille fixe
       Text size: binary-search auto-fit, or fixed size */
    fit() {
      const s = this.ctx.settings;
      if (!s.autoFit) {
        /* La borne basse suit celle du reglage : sur un ecran de bureau
           regarde a 60 cm, une taille pensee pour etre lue a travers la
           piece est enorme (1.115.8).
           The lower bound matches the setting's: on a desktop screen
           seen from 60 cm, a size meant to be read across the room is
           enormous. */
        const px = Math.max(MIN_FONT_PX, Math.min(40, Number(s.fontSize) || 16));
        this.view.style.fontSize = px + "px";
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
      let lo = MIN_FONT_PX, hi = Math.min(30, Math.max(14, Math.floor(Math.min(w, h) * 0.16)));
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
      if (this.needsStamps() && this.reconcileAll()) this.persist();
      this.render();
      this.scheduleTick();
    }

    onLangChanged() { this.render(); }

    destroy() {
      clearTimeout(this.saveTimer);
      clearTimeout(this.tickTimer);
      clearTimeout(this.sweepTimer);
      if (this.observer) this.observer.disconnect();
    }
  }

  NotesWidget._normPurge = normPurge;
  NotesWidget._doneEntries = doneEntries;
  NotesWidget._reconcileStamps = reconcileStamps;
  NotesWidget._dueAt = dueAt;
  NotesWidget._dueEntries = dueEntries;
  NotesWidget._splitDue = splitDue;
  NotesWidget._oldLines = oldLines;
  NotesWidget._nextWake = nextWake;
  NotesWidget._expireArchive = expireArchive;
  NotesWidget._taskProgress = taskProgress;
  NotesWidget._NOW_GRACE_MS = NOW_GRACE_MS;

  window.PiBoard.registerWidget("notes", NotesWidget);
})();
