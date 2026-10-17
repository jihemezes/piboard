/* ============================================================
   PiBoard - innergrid.js (1.151.0)
   Grille interne d'une tuile : des BLOCS que l'on deplace et que l'on
   redimensionne a la souris ou au doigt, en mode edition, a l'interieur
   d'une seule tuile.

   POURQUOI UNE GRILLE DANS LA GRILLE, FINALEMENT. Jusqu'en 1.150.0, la
   tuile Formule 1 repondait au besoin « disposer les cartes » en
   conseillant de poser une tuile par carte. Ca marche, mais c'est un
   detour : six tuiles a regler une par une, six fenetres de reglages,
   six tuiles a deplacer ensemble quand on reorganise la page. La
   demande etait de reagencer les tableaux A L'INTERIEUR de la tuile, et
   c'est ce que fait ce module.

   CE QUI A GUIDE LA CONCEPTION.
   1. LA GRILLE EST PROPORTIONNELLE : 12 colonnes x 12 rangees, quelle
      que soit la taille de la tuile. Agrandir la tuile agrandit chaque
      bloc dans la meme proportion, au lieu de laisser un vide en bas ou
      de couper le dernier bloc. Un kiosque n'a pas de barre de
      defilement a offrir a une tuile.
   2. ON NE TOUCHE AUX BLOCS QU'EN MODE EDITION, comme aux tuiles. Hors
      edition, rien ne bouge sous le doigt : un tableau de bord mural
      qui se reagence quand on l'effleure est un tableau de bord casse.
   3. LA TUILE RESTE DEPLACABLE. En edition, toute la surface d'une
      tuile sert de prise pour la deplacer : les blocs ne prennent donc
      la main QUE sur leur barre de titre (deplacer), leur coin
      (redimensionner) et leurs boutons. Le reste de la tuile se saisit
      comme avant.
   4. LA GRILLE EST AIMANTEE et refuse le chevauchement : un bloc pose
      sur un autre pousse celui-ci vers la premiere place libre, et si
      aucune place ne convient, le geste est annule plutot que de
      superposer deux tableaux.
   5. LE MODULE NE SAIT RIEN DE LA FORMULE 1. Il recoit des blocs (un
      identifiant, un titre, un contenu) et rend des positions. La
      Formule 1 et le MotoGP s'en servent ; une autre tuile a tableaux
      multiples pourra s'en servir demain sans rien y changer.

   AN INNER GRID FOR A TILE: BLOCKS moved and resized with the mouse or a
   finger, in edit mode, inside one tile. Until 1.150.0 the Formula 1
   tile answered "arrange the cards" by suggesting one tile per card --
   it worked, but six tiles to configure and move together is a detour.
   Design: (1) the grid is PROPORTIONAL, 12x12 whatever the tile size, so
   resizing the tile scales every block instead of leaving a gap or
   cutting the last one; (2) blocks are touched ONLY in edit mode, like
   tiles; (3) the tile stays draggable -- blocks only take over their
   title bar, corner and buttons; (4) the grid snaps and refuses
   overlaps: a block dropped on another pushes it to the first free
   spot, and if none fits the gesture is cancelled; (5) the module knows
   nothing about Formula 1.
   ============================================================ */
(function () {
  "use strict";

  const COLS = 12;
  const ROWS = 12;
  const MIN_W = 2;
  const MIN_H = 2;

  /* L'echelle du texte d'un bloc. En dessous de 0,7 un tableau devient
     illisible a deux metres de l'ecran, et c'est alors au bloc de
     defiler ; au-dessus de 1,6 une carte de cinq lignes se mettrait a
     crier. The block text scale: below 0.7 a table is unreadable from
     two metres, so the block scrolls instead; above 1.6 a five-line
     card would shout. */
  const FIT_MIN = 0.7;
  const FIT_MAX = 1.6;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Geometrie PURE (testee sans DOM) ----------
     Un rectangle est { x, y, w, h } en cases de grille.
     PURE geometry (tested without a DOM). A rect is { x, y, w, h } in
     grid cells. */

  function clampRect(r) {
    const w = Math.max(MIN_W, Math.min(COLS, Math.round(Number(r && r.w) || 4)));
    const h = Math.max(MIN_H, Math.min(ROWS, Math.round(Number(r && r.h) || 4)));
    const x = Math.max(0, Math.min(COLS - w, Math.round(Number(r && r.x) || 0)));
    const y = Math.max(0, Math.min(ROWS - h, Math.round(Number(r && r.y) || 0)));
    return { x, y, w, h };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  function inBounds(r) {
    return r.x >= 0 && r.y >= 0 && r.x + r.w <= COLS && r.y + r.h <= ROWS && r.w >= MIN_W && r.h >= MIN_H;
  }

  function isFree(r, others) {
    return inBounds(r) && !others.some((o) => overlaps(r, o));
  }

  /* La premiere place libre, en lisant la grille comme une page : de
     haut en bas, puis de gauche a droite. C'est l'ordre dans lequel on
     cherche des yeux, donc celui ou l'on s'attend a retrouver un bloc
     pousse. First free spot, reading the grid like a page. */
  function findSpot(w, h, others) {
    for (let y = 0; y + h <= ROWS; y++) {
      for (let x = 0; x + w <= COLS; x++) {
        const r = { x, y, w, h };
        if (isFree(r, others)) return r;
      }
    }
    return null;
  }

  /* Une place pour un bloc, en essayant d'abord SA taille, puis des
     tailles de plus en plus modestes : un bloc pousse qui retrecit vaut
     mieux qu'un bloc qui disparait. A spot for a block: its own size
     first, then smaller ones -- a shrunk block beats a vanished one. */
  function placeSomewhere(pref, others) {
    const sizes = [];
    const push = (w, h) => {
      w = Math.max(MIN_W, Math.min(COLS, w)); h = Math.max(MIN_H, Math.min(ROWS, h));
      if (!sizes.some((s) => s[0] === w && s[1] === h)) sizes.push([w, h]);
    };
    if (pref) push(pref.w, pref.h);
    if (pref) { push(pref.w, pref.h - 1); push(pref.w - 1, pref.h); push(pref.w - 1, pref.h - 1); }
    [[4, 4], [4, 3], [3, 4], [3, 3], [4, 2], [3, 2], [2, 3], [2, 2]].forEach(([w, h]) => push(w, h));
    for (const [w, h] of sizes) {
      const r = findSpot(w, h, others);
      if (r) return r;
    }
    return null;
  }

  /* Rend une disposition COMPLETE et SANS CHEVAUCHEMENT pour les blocs
     visibles : positions enregistrees d'abord, puis celles de la
     disposition par defaut pour les blocs qui n'en ont pas, puis une
     place libre. Une disposition enregistree peut etre fausse -- un
     bloc ajoute depuis, un fichier edite a la main, une disposition
     collee depuis une autre tuile : elle est reparee, jamais crue sur
     parole.
     Returns a COMPLETE, NON-OVERLAPPING layout for the visible blocks:
     saved positions first, then the default preset's, then a free spot.
     A saved layout may be wrong; it is repaired, never taken on trust. */
  function normalize(ids, saved, preset) {
    const out = {};
    const taken = [];
    const sources = [saved || {}, preset || {}];
    const pending = [];
    for (const id of ids) {
      let placed = null;
      for (const src of sources) {
        const raw = src[id];
        if (!raw) continue;
        const r = clampRect(raw);
        if (isFree(r, taken)) { placed = r; break; }
      }
      if (placed) { out[id] = placed; taken.push(placed); } else pending.push(id);
    }
    for (const id of pending) {
      const pref = (saved && saved[id]) || (preset && preset[id]) || null;
      let r = placeSomewhere(pref ? clampRect(pref) : null, taken);
      if (!r) {
        /* GRILLE PLEINE : on taille une place dans le plus grand bloc, en
           le rognant, plutot que de poser le nouveau par-dessus. C'est le
           cas courant d'un bloc qu'on rajoute (le logo) a une disposition
           predefinie, qui remplit les 12 x 12 cases.
           FULL GRID: carve a spot out of the largest block by trimming
           it, rather than overlapping. */
        const ids = Object.keys(out).sort((a, b) => out[b].w * out[b].h - out[a].w * out[a].h);
        for (const big of ids) {
          const b = out[big];
          for (const [w, h] of [[3, 3], [3, 2], [2, 2]]) {
            if (b.w < w || b.h < h) continue;
            const cands = [{ x: b.x + b.w - w, y: b.y + b.h - h, w, h }, { x: b.x, y: b.y + b.h - h, w, h }];
            for (const c of cands) {
              const trimmed = trimAway(b, c).find((t) => !overlaps(t, c));
              if (!trimmed) continue;
              const others = taken.filter((t) => t !== b);
              if (isFree(c, others) && isFree(trimmed, others)) {
                out[big] = trimmed;
                taken.splice(taken.indexOf(b), 1, trimmed);
                r = c;
                break;
              }
            }
            if (r) break;
          }
          if (r) break;
        }
      }
      /* Grille pleine : le bloc est pose en haut a gauche, par-dessus.
         C'est laid, mais visible -- et un bloc visible se deplace,
         alors qu'un bloc perdu ne se retrouve pas.
         Grid full: the block is put top-left, on top. Ugly but visible --
         a visible block can be moved, a lost one cannot be found. */
      out[id] = r || { x: 0, y: 0, w: MIN_W, h: MIN_H };
      taken.push(out[id]);
    }
    return out;
  }

  /* Un bloc vient d'etre deplace ou redimensionne vers `rect`. Les blocs
     qu'il recouvre sont reloges : d'abord a la place qu'il vient de
     quitter (c'est un echange, le geste le plus naturel), sinon a la
     premiere place libre, eventuellement en retrecissant. Si un seul
     d'entre eux ne trouve aucune place, on rend `null` et le geste est
     annule : superposer deux tableaux n'est jamais une issue.
     A block has just been moved or resized to `rect`. Blocks it covers
     are relocated: first into the spot it just left (a swap, the most
     natural gesture), otherwise to the first free spot, possibly shrunk.
     If any of them finds no room, `null` is returned and the gesture is
     cancelled. */
  /* ROGNER un bloc recouvert plutot que de le deplacer : on retire la
     bande qu'occupe desormais le bloc agrandi, du cote ou elle se trouve.
     Le resultat doit garder la taille minimale lisible, sinon on renonce.
     TRIM a covered block rather than moving it: the strip now taken by
     the enlarged block is cut away, on its side. The result must keep the
     minimum readable size, otherwise this gives up. */
  function trimAway(v, t) {
    const out = [];
    if (t.y + t.h > v.y && t.y + t.h < v.y + v.h && t.y <= v.y) out.push({ x: v.x, y: t.y + t.h, w: v.w, h: v.y + v.h - (t.y + t.h) });
    if (t.y > v.y && t.y < v.y + v.h && t.y + t.h >= v.y + v.h) out.push({ x: v.x, y: v.y, w: v.w, h: t.y - v.y });
    if (t.x + t.w > v.x && t.x + t.w < v.x + v.w && t.x <= v.x) out.push({ x: t.x + t.w, y: v.y, w: v.x + v.w - (t.x + t.w), h: v.h });
    if (t.x > v.x && t.x < v.x + v.w && t.x + t.w >= v.x + v.w) out.push({ x: v.x, y: v.y, w: t.x - v.x, h: v.h });
    return out.filter((r) => r.w >= MIN_W && r.h >= MIN_H && !overlaps(r, t))
      .sort((a, b) => b.w * b.h - a.w * a.h);
  }

  function resolveMove(items, id, rect, from, mode) {
    const target = clampRect(rect);
    const next = {};
    for (const k of Object.keys(items)) next[k] = Object.assign({}, items[k]);
    next[id] = target;
    const victims = Object.keys(next).filter((k) => k !== id && overlaps(next[k], target));
    if (!victims.length) return next;
    for (const v of victims) delete next[v];
    const others = () => Object.keys(next).map((k) => next[k]);
    /* L'ordre des recours depend du geste. On AGRANDIT un bloc : le
       voisin est d'abord rogne, il reste a sa place. On DEPLACE un bloc :
       c'est un echange qu'on attend, le voisin prend la place laissee.
       The order of fallbacks depends on the gesture. ENLARGING: the
       neighbour is trimmed first and stays put. MOVING: a swap is
       expected, the neighbour takes the vacated spot. */
    const trim = (old) => {
      for (const r of trimAway(old, target)) if (isFree(r, others())) return r;
      return null;
    };
    for (const v of victims) {
      const old = items[v];
      let spot = null;
      if (mode === "resize") spot = trim(old);
      if (!spot && from && mode !== "resize") {
        const swap = { x: from.x, y: from.y, w: old.w, h: old.h };
        if (isFree(swap, others())) spot = swap;
        if (!spot) {
          const fitIn = { x: from.x, y: from.y, w: Math.min(old.w, from.w), h: Math.min(old.h, from.h) };
          if (isFree(fitIn, others())) spot = fitIn;
        }
      }
      if (!spot) spot = placeSomewhere(old, others());
      if (!spot && mode !== "resize") spot = trim(old);
      if (!spot) return null;
      next[v] = spot;
    }
    return next;
  }

  /* ---------- Presse-papiers des dispositions ----------
     Copier la disposition d'une tuile Formule 1 vers une autre. Le
     presse-papiers vit dans le navigateur (localStorage) : il sert a
     passer d'une tuile a l'autre sur le meme ecran, et rien n'oblige a
     le faire voyager. Toute lecture ou ecriture est protegee : en
     navigation privee ou en apercu, le stockage peut lever une
     exception, et une tuile ne doit jamais tomber pour un copier-coller.
     Layout clipboard, kept in the browser: it serves to go from one tile
     to another on the same screen. Every access is guarded: storage may
     throw, and a tile must never break over copy-paste. */
  const CLIP_PREFIX = "piboard.innergrid.clip.";
  const memClip = {};

  function clipWrite(kind, items) {
    const raw = JSON.stringify(items || {});
    memClip[kind] = raw;
    try { window.localStorage.setItem(CLIP_PREFIX + kind, raw); } catch (e) { /* stockage indisponible / storage unavailable */ }
  }

  function clipRead(kind) {
    let raw = null;
    try { raw = window.localStorage.getItem(CLIP_PREFIX + kind); } catch (e) { raw = null; }
    if (!raw) raw = memClip[kind] || null;
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : null;
    } catch (e) { return null; }
  }

  /* ---------- La grille, cote DOM ---------- */

  function isEditingNow() {
    return !!(typeof document !== "undefined" && document.body && document.body.classList.contains("editing"));
  }

  class InnerGrid {
    /* opts : {
         host        : element qui recoit la grille
         kind        : "f1", "motogp"... (presse-papiers partage par genre)
         i18n        : { t(key) }
         blocks      : [{ id, title, fit }]           -- blocs VISIBLES
         hidden      : [{ id, title }]                -- blocs masques, a rajouter
         items       : { id: {x,y,w,h} }              -- disposition enregistree
         presets     : [{ id, label, items }]         -- dispositions predefinies
         defaultPreset : id du preset de repli
         slots       : null | [{ id, label }]         -- dispositions par moment
         slot        : id du moment affiche
         autoFit     : bool                           -- ajuster le texte
         onLayout(items, slot), onHide(id), onShow(id), onSlot(id)
       } */
    constructor(opts) {
      this.o = Object.assign({ blocks: [], hidden: [], items: null, presets: [], slots: null, autoFit: true }, opts || {});
      this.kind = this.o.kind || "grid";
      this.editing = isEditingNow();
      this.els = new Map();
      this.items = {};
      this.drag = null;

      this.root = document.createElement("div");
      this.root.className = "pig-root";
      this.tools = document.createElement("div");
      this.tools.className = "pig-tools pig-ctl";
      this.area = document.createElement("div");
      this.area.className = "pig-area";
      this.root.appendChild(this.tools);
      this.root.appendChild(this.area);
      this.o.host.appendChild(this.root);

      /* LA TUILE NE DOIT PAS PARTIR AVEC LE BLOC. Gridstack ecoute
         `mousedown`, `touchstart` et `pointerdown` sur la tuile pour la
         deplacer, et un clic en edition ouvre ses reglages. Tout geste
         commence sur une commande de la grille (barre, coin, boutons)
         est donc arrete ICI, avant d'atteindre la tuile. Le reste de la
         surface n'est pas concerne : la tuile se saisit toujours par
         son contenu.
         THE TILE MUST NOT LEAVE WITH THE BLOCK. Gridstack listens to
         mousedown, touchstart and pointerdown on the tile to move it, and
         a click while editing opens its settings. Any gesture started on
         a grid control is stopped HERE, before it reaches the tile. */
      this.stopper = (e) => {
        if (e.target && e.target.closest && e.target.closest(".pig-ctl")) e.stopPropagation();
      };
      for (const t of ["mousedown", "touchstart", "pointerdown", "click", "dblclick"]) {
        this.root.addEventListener(t, this.stopper);
      }

      this.onEditing = (e) => {
        const v = e && e.detail && typeof e.detail.editing === "boolean" ? e.detail.editing : isEditingNow();
        this.setEditing(v);
      };
      document.addEventListener("piboard:editing", this.onEditing);

      this.ro = null;
      if (typeof ResizeObserver === "function") {
        this.ro = new ResizeObserver(() => this.scheduleFit());
        this.ro.observe(this.area);
      }

      this.update(this.o);
    }

    t(key) {
      const i = this.o.i18n;
      const v = i && typeof i.t === "function" ? i.t(key) : key;
      return v == null ? key : v;
    }

    presetItems(id) {
      const p = (this.o.presets || []).find((x) => x.id === id);
      return p ? p.items : null;
    }

    /* Met la grille en accord avec ce que la tuile demande : blocs
       visibles, blocs masques, disposition, moment. Les elements des
       blocs qui restent sont GARDES, et c'est essentiel : un bloc qui
       heberge une autre tuile (le plan du circuit) perdrait son dessin
       et relancerait ses requetes a chaque reconstruction.
       Brings the grid in line with what the tile asks for. Elements of
       blocks that stay are KEPT: a block hosting another tile (the
       circuit map) would lose its drawing and re-fetch on each rebuild. */
    update(patch) {
      Object.assign(this.o, patch || {});
      const ids = this.o.blocks.map((b) => b.id);
      const preset = this.presetItems(this.o.defaultPreset);
      this.items = normalize(ids, this.o.items, preset);

      for (const [id, el] of this.els) {
        if (!ids.includes(id)) { el.remove(); this.els.delete(id); }
      }
      for (const b of this.o.blocks) {
        let el = this.els.get(b.id);
        if (!el) {
          el = this.makeBlock(b);
          this.els.set(b.id, el);
          this.area.appendChild(el);
        }
        el.querySelector(".pig-title").textContent = b.title || "";
        el.classList.toggle("pig-nofit", b.fit === false);
        /* UN RELEVE QUI TOMBE PENDANT UN GESTE ne doit pas ramener le bloc
           sous le doigt a son ancienne place : il garde la position du
           geste jusqu'au relachement.
           A REFRESH LANDING DURING A GESTURE must not pull the block back
           from under the finger. */
        if (this.drag && this.drag.id === b.id) this.position(b.id, this.drag.rect);
        else this.position(b.id);
      }
      if (this.drag && !this.els.has(this.drag.id)) this.cancelGesture();
      this.root.classList.toggle("pig-editing", this.editing);
      this.renderTools();
      this.scheduleFit();
    }

    makeBlock(b) {
      const el = document.createElement("div");
      el.className = "pig-block";
      el.dataset.block = b.id;
      el.innerHTML = `
        <div class="pig-frame">
          <div class="pig-body"></div>
        </div>
        <div class="pig-bar pig-ctl" title="${esc(this.t("ig.move"))}">
          <span class="pig-grip" aria-hidden="true">⠿</span>
          <span class="pig-title"></span>
          <button type="button" class="pig-x pig-ctl" title="${esc(this.t("ig.hide"))}" aria-label="${esc(this.t("ig.hide"))}">✕</button>
        </div>
        <div class="pig-resize pig-ctl" title="${esc(this.t("ig.resize"))}" aria-hidden="true"></div>`;
      const bar = el.querySelector(".pig-bar");
      const x = el.querySelector(".pig-x");
      const rz = el.querySelector(".pig-resize");
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".pig-x")) return;
        this.startGesture(e, b.id, "move");
      });
      rz.addEventListener("pointerdown", (e) => this.startGesture(e, b.id, "resize"));
      x.addEventListener("click", (e) => {
        e.preventDefault();
        if (!this.editing) return;
        if (typeof this.o.onHide === "function") this.o.onHide(b.id);
      });
      return el;
    }

    body(id) {
      const el = this.els.get(id);
      return el ? el.querySelector(".pig-body") : null;
    }

    position(id, rect) {
      const el = this.els.get(id);
      const r = rect || this.items[id];
      if (!el || !r) return;
      el.style.left = (r.x / COLS * 100) + "%";
      el.style.top = (r.y / ROWS * 100) + "%";
      el.style.width = (r.w / COLS * 100) + "%";
      el.style.height = (r.h / ROWS * 100) + "%";
      el.dataset.x = r.x; el.dataset.y = r.y; el.dataset.w = r.w; el.dataset.h = r.h;
    }

    setEditing(v) {
      if (this.editing === !!v) return;
      this.editing = !!v;
      this.root.classList.toggle("pig-editing", this.editing);
      if (!this.editing) this.cancelGesture();
      this.renderTools();
      if (typeof this.o.onEditing === "function") this.o.onEditing(this.editing);
      this.scheduleFit();
    }

    /* ---------- La barre d'outils d'edition ----------
       Une seule ligne, visible seulement en edition : ajouter un bloc
       masque, choisir une disposition, revenir a celle par defaut,
       copier/coller, et -- si la tuile change de disposition selon le
       moment -- choisir laquelle on modifie.
       THE EDIT TOOLBAR: one line, shown only while editing. */
    renderTools() {
      if (!this.editing) { this.tools.innerHTML = ""; this.tools.hidden = true; return; }
      this.tools.hidden = false;
      const hidden = this.o.hidden || [];
      const presets = this.o.presets || [];
      const slots = Array.isArray(this.o.slots) && this.o.slots.length > 1 ? this.o.slots : null;
      const canPaste = !!clipRead(this.kind);
      this.tools.innerHTML = `
        ${slots ? `<select class="pig-slot pig-ctl" title="${esc(this.t("ig.slot"))}">
          ${slots.map((s) => `<option value="${esc(s.id)}"${s.id === this.o.slot ? " selected" : ""}>${esc(s.label)}</option>`).join("")}
        </select>` : ""}
        <select class="pig-add pig-ctl"${hidden.length ? "" : " disabled"} title="${esc(this.t("ig.add"))}">
          <option value="">${esc(this.t("ig.add"))}${hidden.length ? " (" + hidden.length + ")" : ""}</option>
          ${hidden.map((b) => `<option value="${esc(b.id)}">${esc(b.title)}</option>`).join("")}
        </select>
        <select class="pig-preset pig-ctl" title="${esc(this.t("ig.preset"))}">
          <option value="">${esc(this.t("ig.preset"))}</option>
          ${presets.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join("")}
        </select>
        <button type="button" class="pig-btn pig-reset pig-ctl" title="${esc(this.t("ig.reset.hint"))}">${esc(this.t("ig.reset"))}</button>
        <button type="button" class="pig-btn pig-copy pig-ctl" title="${esc(this.t("ig.copy.hint"))}">${esc(this.t("ig.copy"))}</button>
        <button type="button" class="pig-btn pig-paste pig-ctl"${canPaste ? "" : " disabled"} title="${esc(this.t("ig.paste.hint"))}">${esc(this.t("ig.paste"))}</button>
        <span class="pig-note" aria-live="polite"></span>`;
      const q = (s) => this.tools.querySelector(s);
      const add = q(".pig-add");
      add.addEventListener("change", () => {
        const id = add.value;
        if (id && typeof this.o.onShow === "function") this.o.onShow(id);
      });
      const pre = q(".pig-preset");
      pre.addEventListener("change", () => { if (pre.value) this.applyPreset(pre.value); });
      q(".pig-reset").addEventListener("click", () => this.applyPreset(this.o.defaultPreset));
      q(".pig-copy").addEventListener("click", () => {
        clipWrite(this.kind, this.items);
        this.note(this.t("ig.copied"));
        const p = q(".pig-paste"); if (p) p.disabled = false;
      });
      q(".pig-paste").addEventListener("click", () => {
        const items = clipRead(this.kind);
        if (!items) return;
        this.commit(normalize(Object.keys(this.items), items, this.presetItems(this.o.defaultPreset)));
        this.note(this.t("ig.pasted"));
      });
      const slot = q(".pig-slot");
      if (slot) slot.addEventListener("change", () => {
        if (typeof this.o.onSlot === "function") this.o.onSlot(slot.value);
      });
    }

    note(text) {
      const n = this.tools.querySelector(".pig-note");
      if (!n) return;
      n.textContent = text;
      clearTimeout(this.noteTimer);
      this.noteTimer = setTimeout(() => { if (n) n.textContent = ""; }, 2500);
    }

    /* Une disposition predefinie REMPLACE celle du moment pour les blocs
       qu'elle connait, et les autres trouvent une place libre. On
       repart donc du preset, et non de la disposition actuelle : sinon
       une ancienne position bloquerait celle que le preset prevoit.
       A preset REPLACES the current layout for the blocks it knows; the
       others find a free spot. */
    applyPreset(id) {
      const items = this.presetItems(id);
      if (!items) return;
      this.commit(normalize(Object.keys(this.items), items, null));
    }

    commit(items) {
      this.items = items;
      for (const id of Object.keys(items)) this.position(id);
      this.scheduleFit();
      if (typeof this.o.onLayout === "function") this.o.onLayout(Object.assign({}, items), this.o.slot);
    }

    /* ---------- Glisser et redimensionner ----------
       Pointer Events : souris, doigt et stylet par le meme chemin. Les
       deplacements sont ecoutes sur la FENETRE pendant le geste, et non
       sur la barre : un doigt qui glisse vite quitte la barre bien avant
       la fin du geste, et le bloc resterait en plan.
       Pointer Events: mouse, finger and stylus through one path. Moves are
       listened to on the WINDOW during the gesture: a fast finger leaves
       the bar long before the gesture ends. */
    startGesture(e, id, mode) {
      if (!this.editing) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const box = this.area.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const from = Object.assign({}, this.items[id]);
      this.drag = {
        id, mode, from, rect: Object.assign({}, from),
        sx: e.clientX, sy: e.clientY,
        cw: box.width / COLS, ch: box.height / ROWS
      };
      const el = this.els.get(id);
      if (el) el.classList.add(mode === "move" ? "pig-moving" : "pig-sizing");
      this.root.classList.add("pig-busy");
      this.onMove = (ev) => this.moveGesture(ev);
      this.onUp = (ev) => this.endGesture(ev);
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
    }

    moveGesture(e) {
      const d = this.drag;
      if (!d) return;
      e.preventDefault();
      const dx = Math.round((e.clientX - d.sx) / d.cw);
      const dy = Math.round((e.clientY - d.sy) / d.ch);
      const f = d.from;
      d.rect = d.mode === "move"
        ? clampRect({ x: f.x + dx, y: f.y + dy, w: f.w, h: f.h })
        : clampRect({ x: f.x, y: f.y, w: Math.min(COLS - f.x, f.w + dx), h: Math.min(ROWS - f.y, f.h + dy) });
      this.position(d.id, d.rect);
      /* Le bloc suit le geste ; ceux qu'il chevaucherait sont signales,
         pas encore pousses : on ne bouscule pas toute la tuile a chaque
         case survolee.
         The block follows the gesture; those it would overlap are only
         flagged, not yet pushed. */
      for (const [k, el] of this.els) {
        el.classList.toggle("pig-target", k !== d.id && overlaps(this.items[k], d.rect));
      }
    }

    endGesture() {
      const d = this.drag;
      this.cancelGesture(true);
      if (!d) return;
      const same = d.rect.x === d.from.x && d.rect.y === d.from.y && d.rect.w === d.from.w && d.rect.h === d.from.h;
      if (same) { this.position(d.id); return; }
      const next = resolveMove(this.items, d.id, d.rect, d.from, d.mode);
      if (!next) {
        this.position(d.id);
        this.note(this.t("ig.noRoom"));
        return;
      }
      this.commit(next);
    }

    cancelGesture(keep) {
      if (this.onMove) window.removeEventListener("pointermove", this.onMove);
      if (this.onUp) {
        window.removeEventListener("pointerup", this.onUp);
        window.removeEventListener("pointercancel", this.onUp);
      }
      this.onMove = this.onUp = null;
      this.root.classList.remove("pig-busy");
      for (const [, el] of this.els) el.classList.remove("pig-moving", "pig-sizing", "pig-target");
      if (!keep && this.drag) this.position(this.drag.id);
      this.drag = null;
    }

    /* ---------- Ajuster le texte a la taille du bloc ----------
       Chaque bloc cherche la plus grande echelle de texte a laquelle son
       contenu tient sans defiler, entre 0,7 et 1,6. Un bloc agrandi lit
       donc son tableau en plus gros, un bloc reduit le resserre, et
       au-dela du minimum il defile plutot que de devenir illisible.
       Recherche par dichotomie : sept mesures suffisent, et un tableau
       qui « tient » a l'echelle s tient a toute echelle plus petite.
       FIT THE TEXT TO THE BLOCK: each block looks for the largest text
       scale at which its content fits without scrolling, between 0.7 and
       1.6. Binary search: seven measurements are enough, and content
       that fits at scale s fits at any smaller one. */
    scheduleFit() {
      if (this.fitPending) return;
      this.fitPending = true;
      const run = () => { this.fitPending = false; this.fitAll(); };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run); else setTimeout(run, 0);
    }

    fitAll() {
      for (const b of this.o.blocks) {
        if (b.fit === false) continue;
        this.fitBlock(b.id);
      }
    }

    fitBlock(id) {
      const body = this.body(id);
      if (!body) return 1;
      if (!this.o.autoFit) { body.style.removeProperty("--pig-scale"); return 1; }
      if (!body.clientHeight || !body.clientWidth) return 1;
      /* TENIR NE SUFFIT PAS : IL FAUT RESTER LISIBLE. Un tableau dont les
         colonnes se partagent la largeur ne « deborde » jamais : en
         grossissant le texte, c'est la colonne des noms qui fond, jusqu'a
         n'afficher que « F… » -- constate sur la meteo du circuit, ou
         l'heure et la pluie mangeaient le nom des seances. On compte donc
         aussi les NOMS TRONQUES (les classes `…-name` des tuiles) et le
         contenu qui sort de sa carte : grossir n'est permis que s'il ne
         tronque rien de plus qu'a l'echelle normale.
         FITTING IS NOT ENOUGH: IT MUST STAY READABLE. A table whose
         columns share the width never "overflows": as text grows, the
         name column melts down to "F…" -- seen on the circuit weather.
         TRUNCATED NAMES (tiles' `…-name` classes) and content leaving its
         card are counted too: growing is allowed only if it truncates
         nothing more than at normal scale. */
      const names = Array.from(body.querySelectorAll('[class*="-name"]'));
      const truncated = () => names.reduce((n, e) => n + (e.scrollWidth > e.clientWidth + 1 ? 1 : 0), 0);
      const cardsFit = () => Array.from(body.children).every((c) => c.scrollWidth <= c.clientWidth + 1);
      body.style.setProperty("--pig-scale", "1");
      const base = truncated();
      const fits = (s) => {
        body.style.setProperty("--pig-scale", String(s));
        if (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1) return false;
        if (!cardsFit()) return false;
        return s <= 1 || truncated() <= base;
      };
      let lo = FIT_MIN, hi = FIT_MAX;
      if (!fits(lo)) { return lo; }
      if (fits(hi)) { return hi; }
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      const s = Math.floor(lo * 100) / 100;
      body.style.setProperty("--pig-scale", String(s));
      return s;
    }

    destroy() {
      this.cancelGesture();
      document.removeEventListener("piboard:editing", this.onEditing);
      if (this.ro) { try { this.ro.disconnect(); } catch (e) { /* noop */ } }
      clearTimeout(this.noteTimer);
      this.root.remove();
      this.els.clear();
    }
  }

  /* ============================================================
     LE TABLEAU A BLOCS : ce que partagent la Formule 1 et le MotoGP.

     Une tuile a tableaux multiples a toujours les memes besoins autour
     de la grille : savoir quels blocs sont affiches (ce sont ses cases a
     cocher), enregistrer la disposition DANS SES REGLAGES (donc une par
     tuile), choisir la disposition selon le moment, et retomber sur une
     carte unique sans cadre quand un seul bloc est coche. Tout cela est
     ici, une fois, plutot que recopie dans chaque tuile -- ou il
     divergerait a la premiere correction.

     THE BLOCK BOARD: what Formula 1 and MotoGP share around the grid --
     which blocks are shown (their checkboxes), saving the layout IN THE
     TILE'S SETTINGS (so one per tile), picking the layout by moment, and
     falling back to a frameless single card when one block is ticked.
     All of it lives here once rather than copied into each tile.
     ============================================================ */
  class BlockBoard {
    /* cfg : {
         ctx, kind,
         blocks   : [{ id, key, titleKey, fit, persistent }]
         presets  : [{ id, labelKey, items }]
         defaultPreset, seasonPreset, weekendPreset
         isWeekend(now) -> bool
         onShown(id)   -- un bloc vient d'etre rajoute (la tuile recharge)
       } */
    constructor(cfg) {
      this.cfg = cfg;
      this.grid = null;
      this.editSlot = null;
      this.lastSlot = null;
    }

    get ctx() { return this.cfg.ctx; }
    get s() { return this.cfg.ctx.settings || {}; }

    visible() {
      return this.cfg.blocks.filter((b) => this.shown(b));
    }

    /* `optIn` : bloc optionnel, visible seulement s'il est coche (le
       logo) ; les autres sont visibles tant qu'ils ne sont pas decoches.
       `optIn`: optional block, shown only when ticked. */
    shown(b) { return b.optIn ? this.s[b.key] === true : this.s[b.key] !== false; }

    title(b) { return this.ctx.i18n.t(b.titleKey); }

    /* LE MOMENT : saison ou week-end de course. Seulement si la tuile le
       demande ; sinon, une seule disposition, « main ». En edition, le
       moment choisi dans la barre d'outils l'emporte jusqu'a la sortie
       du mode edition : on modifie la disposition du week-end un mardi
       sans attendre le vendredi.
       THE MOMENT: season or race weekend, only when the tile asks for it.
       While editing, the moment picked in the toolbar wins until edit
       mode ends: one edits the weekend layout on a Tuesday. */
    slot(now) {
      if (this.s.autoLayout !== true) return "main";
      if (this.editSlot) return this.editSlot;
      return this.cfg.isWeekend && this.cfg.isWeekend(now == null ? Date.now() : now) ? "weekend" : "season";
    }

    presetFor(slot) {
      if (slot === "weekend") return this.cfg.weekendPreset || this.cfg.defaultPreset;
      if (slot === "season") return this.cfg.seasonPreset || this.cfg.defaultPreset;
      return this.cfg.defaultPreset;
    }

    savedItems(slot) {
      const all = this.s.layouts;
      const v = all && typeof all === "object" ? all[slot] : null;
      return v && typeof v === "object" ? v : null;
    }

    save(slot, items) {
      const all = Object.assign({}, (this.s.layouts && typeof this.s.layouts === "object") ? this.s.layouts : {});
      all[slot] = items;
      this.patch({ layouts: all });
    }

    /* Ecrit un reglage de la tuile ET le garde en memoire. Hors PiBoard
       (les tests), `updateSettings` n'existe pas : on garde quand meme
       la valeur, pour que la tuile reste coherente avec elle-meme.
       Writes a tile setting AND keeps it in memory. */
    patch(p) {
      if (typeof this.ctx.updateSettings === "function") this.ctx.updateSettings(p);
      this.ctx.settings = Object.assign({}, this.ctx.settings, p);
    }

    solo() { return this.visible().length === 1; }

    /* Monte ou met a jour la grille dans `host`. Rend la grille (ou
       null en solo). Mounts or updates the grid in `host`. */
    mount(host) {
      const vis = this.visible();
      const slot = this.slot();
      this.lastSlot = slot;
      const hidden = this.cfg.blocks.filter((b) => !this.shown(b))
        .map((b) => ({ id: b.id, title: this.title(b) }));
      const slots = this.s.autoLayout === true
        ? [{ id: "season", label: this.ctx.i18n.t("ig.slot.season") }, { id: "weekend", label: this.ctx.i18n.t("ig.slot.weekend") }]
        : null;
      const presets = this.cfg.presets.map((p) => ({ id: p.id, label: this.ctx.i18n.t(p.labelKey), items: p.items }));
      const opts = {
        host, kind: this.cfg.kind, i18n: this.ctx.i18n,
        blocks: vis.map((b) => ({ id: b.id, title: this.title(b), fit: b.fit !== false })),
        hidden, presets, slots, slot,
        items: this.savedItems(slot),
        defaultPreset: this.presetFor(slot),
        autoFit: this.s.autoFit !== false,
        onLayout: (items, sl) => this.save(sl || slot, items),
        onHide: (id) => this.toggle(id, false),
        onShow: (id) => this.toggle(id, true),
        onSlot: (id) => { this.editSlot = id; if (this.cfg.onRelayout) this.cfg.onRelayout(); },
        onEditing: (on) => {
          if (!on && this.editSlot) { this.editSlot = null; if (this.cfg.onRelayout) this.cfg.onRelayout(); }
        }
      };
      if (this.grid && this.grid.o.host === host && this.grid.root.parentNode === host) this.grid.update(opts);
      else {
        if (this.grid) this.grid.destroy();
        this.grid = new InnerGrid(opts);
      }
      return this.grid;
    }

    toggle(id, on) {
      const b = this.cfg.blocks.find((x) => x.id === id);
      if (!b) return;
      this.patch({ [b.key]: !!on });
      if (this.cfg.onRelayout) this.cfg.onRelayout();
      if (on && this.cfg.onShown) this.cfg.onShown(id);
    }

    /* A appeler regulierement (la tuile le fait a la seconde) : vrai si
       le moment a change et qu'il faut redisposer.
       Call regularly: true when the moment changed and a relayout is due. */
    slotChanged(now) {
      return this.lastSlot != null && this.slot(now) !== this.lastSlot;
    }

    body(id) { return this.grid ? this.grid.body(id) : null; }

    fit() { if (this.grid) this.grid.scheduleFit(); }

    unmount() {
      if (this.grid) { this.grid.destroy(); this.grid = null; }
    }
  }

  /* ============================================================
     LE BLOC LOGO (1.153.0) : la tuile Logo / Image, hebergee telle
     quelle dans un bloc -- gestionnaire d'images, recadrage direct en
     mode edition, animations. Son dossier d'images est rattache a la
     tuile hote (identifiant « <tuile>logo ») et ses reglages sont
     enregistres dans ceux de la tuile hote, sous `logo`. Aucun logo
     n'est fourni : les logos officiels sont des marques deposees ; on
     televerse le sien.
     THE LOGO BLOCK: the Logo / Image tile hosted as is in a block --
     image manager, direct crop in edit mode, animations. Its image folder
     belongs to the host tile and its settings are saved in the host's,
     under `logo`. No logo is shipped: official logos are trademarks.
     ============================================================ */
  class LogoSlot {
    constructor(ctx, cls) {
      this.ctx = ctx;
      this.cls = cls || "pig-logo";
      this.host = null;
      this.inst = null;
    }

    instanceId() {
      const id = String(this.ctx.instanceId || "");
      const out = id + "logo";
      return /^t-[a-z0-9]{1,40}$/i.test(out) ? out : null;
    }

    sync(wanted) {
      if (!wanted) { this.destroy(); return; }
      if (!this.host) {
        this.host = document.createElement("div");
        this.host.className = "pig-logo-host";
      }
      if (this.inst) return;
      const P = window.PiBoard;
      const iid = this.instanceId();
      const saved = (this.ctx.settings && this.ctx.settings.logo && typeof this.ctx.settings.logo === "object") ? this.ctx.settings.logo : {};
      this.inst = iid && P && typeof P.embedWidget === "function"
        ? P.embedWidget("image", this.host, Object.assign({ fit: "contain" }, saved), {
          instanceId: iid,
          onUpdate: (patch) => {
            const cur = (this.ctx.settings && this.ctx.settings.logo && typeof this.ctx.settings.logo === "object") ? this.ctx.settings.logo : {};
            const next = Object.assign({}, cur, patch);
            if (typeof this.ctx.updateSettings === "function") this.ctx.updateSettings({ logo: next });
            this.ctx.settings = Object.assign({}, this.ctx.settings, { logo: next });
          }
        }) : null;
      if (!this.inst) {
        const t = this.ctx.i18n && this.ctx.i18n.t ? this.ctx.i18n.t("ig.logo.unavailable") : "ig.logo.unavailable";
        this.host.innerHTML = `<div class="pig-logo-msg">${esc(t)}</div>`;
      }
    }

    /* Le conteneur du logo est DEPLACE dans le bloc a chaque rendu, jamais
       recree : l'image et son recadrage restent en place.
       Moved into the block on every render, never recreated. */
    place(scope) {
      if (!this.host || !scope) return;
      const slot = scope.querySelector(".pig-logo-slot");
      if (slot && this.host.parentNode !== slot) slot.appendChild(this.host);
    }

    /* Le bloc : transparent par defaut (le logo se pose sur le fond de la
       tuile, donc sur son theme), avec cadre en option.
       The block: transparent by default, frame optional. */
    markup(framed) {
      return `<div class="pig-logo-card${framed ? " pig-logo-framed" : ""} ${this.cls}"><div class="pig-logo-slot"></div></div>`;
    }

    destroy() {
      if (this.inst) { try { this.inst.destroy(); } catch (e) { /* noop */ } }
      this.inst = null;
      this.host = null;
    }
  }

  window.PiBoardInnerGrid = {
    LogoSlot,
    InnerGrid, BlockBoard,
    clampRect, overlaps, isFree, findSpot, placeSomewhere, normalize, resolveMove, trimAway,
    clipWrite, clipRead,
    COLS, ROWS, MIN_W, MIN_H, FIT_MIN, FIT_MAX
  };
})();
