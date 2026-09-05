/* ============================================================
   PiBoard - tuile Logo / Image

   Tuile de STYLE, comme la tuile Texte : elle sert a composer une page
   (logo d'entreprise en coin d'ecran, bandeau, illustration de fond
   d'une page de tableau de bord).

   STOCKAGE LOCAL, et c'est deliberé : l'image est televersee sur la
   machine PiBoard et servie par elle. Pas d'adresse externe a saisir,
   donc rien qui casse le jour ou le site distant disparait, rien qui
   parte sur Internet depuis un tableau mural, et une image qui reste
   affichee meme sans connexion.

   Le stockage reutilise l'API media deja en place pour le Diaporama
   (/api/media/<idDeLaTuile>) : les fichiers vivent sous
   data/media/<idDeLaTuile>/, donc DANS le dossier data/ -- celui qui
   n'est jamais touche par les mises a jour et qui est inclus dans les
   sauvegardes. Reutiliser cette API plutot que d'en ecrire une seconde
   evite d'avoir deux mecanismes de televersement a maintenir, et fait
   heriter cette tuile des controles deja ecrits (extensions autorisees,
   taille maximale, noms de fichiers assainis).

   STYLE tile, like the Text tile: it is there to compose a page (a
   company logo in a screen corner, a banner, a background illustration
   for a dashboard page).

   LOCAL STORAGE, deliberately: the image is uploaded to the PiBoard
   machine and served by it. No external address to type, so nothing
   breaks the day the remote site disappears, nothing leaves for the
   Internet from a wall board, and the image stays displayed even with no
   connection.

   Storage reuses the media API already in place for the Slideshow
   (/api/media/<tileId>): files live under data/media/<tileId>/, so
   INSIDE the data/ folder -- the one never touched by updates and
   included in backups. Reusing that API rather than writing a second one
   avoids maintaining two upload mechanisms, and makes this tile inherit
   the controls already written (allowed extensions, maximum size,
   sanitised file names).
   ============================================================ */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Un lien n'est ouvert que s'il pointe vers le web ou vers le tableau
     lui-meme. "javascript:" est le cas qui compte : saisi dans le champ
     de lien, il executerait du code au clic.
     A link is only opened if it points to the web or to the board
     itself. "javascript:" is the case that matters: typed into the link
     field, it would run code on click. */
  function escAttr(v) {
    // Les guillemets doubles DOIVENT etre echappes : un intitule traduit
    // en contenant un tronquerait l'attribut.
    // Double quotes MUST be escaped: a translated label containing one
    // would truncate the attribute.
    return esc(v);
  }

  function safeLink(url) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    return null;
  }

  const FITS = new Set(["contain", "crop", "cover", "fill", "none"]);

  class ImageWidget {
    constructor(ctx) { this.ctx = ctx; }

    init() {
      this.root = document.createElement("div");
      this.root.className = "pw-image";
      this.ctx.el.appendChild(this.root);
      this.render();
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
    }

    /* URL servie par PiBoard pour le fichier choisi. Le nom est encode :
       un fichier "logo été.png" est parfaitement legitime.
       URL served by PiBoard for the chosen file. The name is encoded: a
       "logo été.png" file is perfectly legitimate. */
    fileUrl(name) {
      return "/media/" + encodeURIComponent(this.ctx.instanceId) + "/" + encodeURIComponent(name);
    }

    render() {
      const s = this.ctx.settings || {};
      const i18n = this.ctx.i18n;
      const name = String(s.image || "").trim();

      this.root.className = "pw-image"
        + " pw-image-h-" + (["left", "center", "right"].includes(s.align) ? s.align : "center")
        + " pw-image-v-" + (["top", "middle", "bottom"].includes(s.valign) ? s.valign : "middle");
      this.root.style.padding = (Number(s.padding) || 0) + "px";

      if (!name) {
        /* Aucune image choisie : on affiche le bouton qui ouvre le
           gestionnaire, plutot qu'une tuile vide dont on ne saurait pas
           quoi faire. C'est le chemin normal a la creation de la tuile.
           No image chosen: we show the button that opens the manager,
           rather than an empty tile one would not know what to do with.
           This is the normal path when the tile is created. */
        this.root.innerHTML = `
          <div class="pw-image-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/>
            </svg>
            <span>${esc(i18n.t("image.empty"))}</span>
            <button type="button" class="btn small" data-act="choose">${esc(i18n.t("image.choose"))}</button>
          </div>`;
        const btn = this.root.querySelector("[data-act=choose]");
        btn.addEventListener("click", (e) => { e.stopPropagation(); this.openManager(); });
        return;
      }

      const link = safeLink(s.link);
      const img = document.createElement("img");
      img.src = this.fileUrl(name);
      img.alt = "";
      img.style.opacity = String(Math.max(10, Math.min(100, Number(s.opacity) || 100)) / 100);
      img.style.borderRadius = (Number(s.radius) || 0) + "px";
      applyFit(img, s.fit, s);
      /* Fichier absent (supprime depuis le gestionnaire, ou dossier
         data/ restaure sans ses medias) : on retombe sur l'invite plutot
         que de laisser l'icone de lien casse du navigateur.
         Missing file (deleted from the manager, or data/ folder restored
         without its media): fall back to the prompt rather than leaving
         the browser's broken-link icon. */
      img.onerror = () => {
        this.ctx.settings = Object.assign({}, this.ctx.settings, { image: "" });
        this.render();
      };

      /* Une fois l'image posee, il n'existait plus AUCUN chemin vers le
         gestionnaire : le bouton n'apparait que sur la tuile vide, et le
         formulaire de reglages ne contient qu'un champ texte portant le
         nom du fichier. Changer d'image obligeait donc a vider ce champ
         a la main. Ce petit bouton de coin, affiche en mode edition,
         retablit le chemin.
         Once an image was set there was NO path left to the manager: the
         button only appears on an empty tile, and the settings form only
         holds a text field carrying the file name. Changing the image
         therefore meant clearing that field by hand. This small corner
         button, shown in edit mode, restores the path. */
      const change = document.createElement("button");
      change.type = "button";
      change.className = "pw-image-change";
      change.title = i18n.t("image.choose");
      change.setAttribute("aria-label", i18n.t("image.choose"));
      change.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
        + ' stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/>'
        + '<path d="m4 17 5-5 4 4 3-2 4 4"/></svg>';
      /* Les trois evenements sont arretes, pas seulement le clic :
         Gridstack demarre son glissement sur `mousedown`/`touchstart`,
         et le clic d'edition remonte jusqu'a la grille. Sans cela,
         appuyer sur ce bouton pouvait deplacer la tuile ou ouvrir ses
         reglages au lieu d'ouvrir le gestionnaire d'images.
         All three events are stopped, not just the click: Gridstack
         starts its drag on `mousedown`/`touchstart`, and the edit click
         bubbles up to the grid. Without this, pressing this button could
         move the tile or open its settings instead of opening the image
         manager. */
      for (const type of ["mousedown", "touchstart", "pointerdown"]) {
        change.addEventListener(type, (e) => e.stopPropagation());
      }
      change.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.openManager();
      });

      this.root.innerHTML = "";
      this.root.appendChild(change);
      this.root.appendChild(this.buildCropOverlay());
      if (link) {
        const a = document.createElement("a");
        a.href = link;
        a.className = "pw-image-link";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.appendChild(img);
        this.root.appendChild(a);
      } else {
        this.root.appendChild(img);
      }
    }

    /* ---------- Gestionnaire d'images / image manager ---------- */

    ensureManager() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const m = document.createElement("div");
      m.className = "modal modal-stacked pw-image-manager";
      m.hidden = true;
      m.innerHTML = `
        <div class="modal-card">
          <header class="modal-head">
            <h2>${esc(i18n.t("image.manager.title"))}</h2>
            <button class="modal-close" data-act="close" aria-label="${esc(i18n.t("common.close"))}">&times;</button>
          </header>
          <div class="pw-image-mgr-body">
            <button type="button" class="btn small primary" data-act="upload">${esc(i18n.t("image.upload"))}</button>
            <input type="file" accept="image/*" multiple hidden data-role="file">
            <div class="pw-image-mgr-grid" data-role="grid"></div>
            <p class="pw-image-mgr-status" data-role="status" hidden></p>
          </div>
        </div>`;
      document.body.appendChild(m);
      m.querySelector("[data-act=close]").addEventListener("click", () => { m.hidden = true; });
      const file = m.querySelector("[data-role=file]");
      m.querySelector("[data-act=upload]").addEventListener("click", () => file.click());
      file.addEventListener("change", () => this.upload(file.files));
      this.modal = m;
      return m;
    }

    async openManager() {
      const m = this.ensureManager();
      m.hidden = false;
      await this.refreshManager();
    }

    async refreshManager() {
      const m = this.modal;
      const i18n = this.ctx.i18n;
      const grid = m.querySelector("[data-role=grid]");
      const status = m.querySelector("[data-role=status]");
      status.hidden = true;
      try {
        const data = await fetch("/api/media/" + encodeURIComponent(this.ctx.instanceId)).then((r) => r.json());
        const items = data.items || [];
        const current = String((this.ctx.settings || {}).image || "");
        grid.innerHTML = items.length
          ? items.map((it) => `
              <div class="pw-image-thumb${it.name === current ? " selected" : ""}" data-name="${esc(it.name)}">
                <img src="${esc(it.url)}" alt="">
                <button type="button" class="pw-image-thumb-del" title="${esc(i18n.t("image.delete"))}">&times;</button>
              </div>`).join("")
          : `<p class="pw-image-mgr-empty">${esc(i18n.t("image.managerEmpty"))}</p>`;
        grid.querySelectorAll(".pw-image-thumb").forEach((el) => {
          el.addEventListener("click", (e) => {
            if (e.target.closest(".pw-image-thumb-del")) return;
            this.choose(el.dataset.name);
          });
          el.querySelector(".pw-image-thumb-del").addEventListener("click", (e) => {
            e.stopPropagation();
            this.remove(el.dataset.name);
          });
        });
      } catch (e) {
        status.hidden = false;
        status.textContent = i18n.t("image.managerError");
      }
    }

    /* Le choix est ecrit dans les reglages de la tuile via le contexte,
       donc persiste comme n'importe quel autre reglage -- pas dans un
       coin d'etat qui serait perdu au rechargement.
       The choice is written into the tile's settings through the
       context, so it persists like any other setting -- not into some
       state corner that would be lost on reload. */
    choose(name) {
      if (typeof this.ctx.updateSettings === "function") {
        this.ctx.updateSettings({ image: name });
      } else {
        this.ctx.settings = Object.assign({}, this.ctx.settings, { image: name });
      }
      this.render();
      if (this.modal) this.modal.hidden = true;
    }

    async upload(fileList) {
      if (!fileList || !fileList.length) return;
      const m = this.modal;
      const status = m.querySelector("[data-role=status]");
      status.hidden = false;
      status.textContent = this.ctx.i18n.t("common.loading");
      const form = new FormData();
      // Le champ s'appelle "photos" : c'est le nom attendu par l'API
      // media, partagee avec le Diaporama.
      // The field is named "photos": that is the name the media API,
      // shared with the Slideshow, expects.
      for (const f of fileList) form.append("photos", f);
      try {
        const res = await fetch("/api/media/" + encodeURIComponent(this.ctx.instanceId), { method: "POST", body: form });
        if (!res.ok) throw new Error("status " + res.status);
        status.hidden = true;
        await this.refreshManager();
      } catch (e) {
        status.hidden = false;
        status.textContent = this.ctx.i18n.t("image.uploadError");
      }
      m.querySelector("[data-role=file]").value = "";
    }

    async remove(name) {
      try {
        await fetch("/api/media/" + encodeURIComponent(this.ctx.instanceId) + "/" + encodeURIComponent(name),
          { method: "DELETE" });
        if (String((this.ctx.settings || {}).image || "") === name) this.choose("");
        await this.refreshManager();
      } catch (e) {
        // Le prochain rafraichissement du gestionnaire montrera le fichier
        // toujours present. The next manager refresh will show the file
        // still there.
      }
    }

    /* ---------- Recadrage direct sur l'image / direct crop overlay ----------
       La surcouche n'est presente dans le document qu'en mode edition
       (CSS), et n'agit que si le cadrage « Recadrer » est choisi. Elle
       intercepte les evenements de pointeur AVANT Gridstack : sans cela,
       un glissement sur l'image deplacerait la tuile sur la grille au
       lieu de recadrer.
       The overlay is only present in the document in edit mode (CSS),
       and only acts if the "Crop" framing is chosen. It intercepts
       pointer events BEFORE Gridstack: without that, a drag on the image
       would move the tile on the grid instead of cropping. */
    buildCropOverlay() {
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "pw-image-crop";
      wrap.innerHTML =
        ['nw', 'ne', 'sw', 'se'].map((c) =>
          `<span class="pw-image-handle pw-image-handle-${c}" data-corner="${c}"></span>`).join("")
        + '<div class="pw-image-croptools">'
        + `<button type="button" data-act="out" title="${escAttr(i18n.t("image.zoomOut"))}">&minus;</button>`
        + '<span data-role="zoom"></span>'
        + `<button type="button" data-act="in" title="${escAttr(i18n.t("image.zoomIn"))}">+</button>`
        + `<button type="button" data-act="reset" title="${escAttr(i18n.t("image.cropReset"))}">&#8634;</button>`
        + `<button type="button" data-act="pick" title="${escAttr(i18n.t("image.choose"))}">&#128247;</button>`
        + "</div>"
        + `<div class="pw-image-crophint">${esc(i18n.t("image.cropHint"))}</div>`;

      const zoomLabel = wrap.querySelector("[data-role=zoom]");
      const refresh = () => {
        const s = this.ctx.settings || {};
        // Plus aucune condition sur le cadrage : le zoom et le point de
        // mire agissent maintenant sur tous, la barre d'outils et les
        // poignees ont donc toujours un effet.
        // No condition on the framing any more: zoom and focal point now
        // act on all of them, so the toolbar and the handles always have
        // an effect.
        zoomLabel.textContent = clampZoom(s.zoom) + " %";
      };
      this.refreshCropTools = refresh;
      refresh();

      const commit = (patch, persist) => {
        this.ctx.settings = Object.assign({}, this.ctx.settings, patch);
        const img = this.root.querySelector("img");
        if (img) applyFit(img, this.ctx.settings.fit, this.ctx.settings);
        refresh();
        // Enregistrement au relachement seulement : ecrire le layout a
        // chaque pixel parcouru en produirait des centaines par geste.
        // Saved on release only: writing the layout at every pixel
        // travelled would produce hundreds per gesture.
        if (persist && typeof this.ctx.updateSettings === "function") this.ctx.updateSettings(patch);
      };
      this.commitCrop = commit;

      for (const act of ["in", "out", "reset", "pick"]) {
        const b = wrap.querySelector('[data-act="' + act + '"]');
        b.addEventListener("pointerdown", (e) => e.stopPropagation());
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const s = this.ctx.settings || {};
          // Second chemin vers le gestionnaire d'images, dans la barre
          // d'outils elle-meme : le bouton de coin est petit et se
          // confond avec les commandes de la tuile.
          // A second path to the image manager, in the toolbar itself:
          // the corner button is small and blends in with the tile's own
          // controls.
          if (act === "pick") this.openManager();
          else if (act === "reset") commit({ zoom: 100, focusX: 50, focusY: 50 }, true);
          else commit({ zoom: clampZoom(clampZoom(s.zoom) + (act === "in" ? 10 : -10)) }, true);
        });
      }

      /* Gridstack demarre son glissement sur `mousedown`/`touchstart` :
         il faut donc arreter ces evenements-la, pas seulement
         `pointerdown`. En phase de capture, pour passer avant lui.
         Gridstack starts its drag on `mousedown`/`touchstart`: those are
         the events to stop, not just `pointerdown`. In the capture
         phase, so as to come before it. */
      for (const type of ["mousedown", "touchstart", "pointerdown"]) {
        wrap.addEventListener(type, (e) => { e.stopPropagation(); }, true);
      }

      let drag = null;
      wrap.addEventListener("pointerdown", (e) => {
        const s = this.ctx.settings || {};
        if (e.target.closest(".pw-image-croptools")) return;
        const box = this.ctx.el.getBoundingClientRect();
        const corner = e.target.closest(".pw-image-handle");
        drag = {
          x: e.clientX, y: e.clientY, w: box.width, h: box.height,
          zoom: clampZoom(s.zoom), focusX: pct(s.focusX, 50), focusY: pct(s.focusY, 50),
          corner: corner ? corner.dataset.corner : null
        };
        e.preventDefault();
        try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* pointeur deja relache / already released */ }
      });

      wrap.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (drag.corner) {
          const sx = drag.corner[1] === "e" ? 1 : -1;
          const sy = drag.corner[0] === "s" ? 1 : -1;
          commit({ zoom: zoomFromDrag(drag.zoom, dx, dy, sx, sy, drag.w, drag.h) }, false);
        } else {
          commit({
            focusX: panFocus(drag.focusX, dx, drag.w, drag.zoom),
            focusY: panFocus(drag.focusY, dy, drag.h, drag.zoom)
          }, false);
        }
      });

      const end = () => {
        if (!drag) return;
        drag = null;
        const s = this.ctx.settings || {};
        // Un seul enregistrement pour tout le geste.
        // A single save for the whole gesture.
        commit({ zoom: clampZoom(s.zoom), focusX: pct(s.focusX, 50), focusY: pct(s.focusY, 50) }, true);
      };
      wrap.addEventListener("pointerup", end);
      wrap.addEventListener("pointercancel", end);
      return wrap;
    }

    destroy() {
      if (this.modal) this.modal.remove();
    }
  }

  /* ============================================================
     RECADRAGE DIRECT / DIRECT CROPPING

     Regler le recadrage par des champs numeriques revenait a travailler
     a l'aveugle : les valeurs saisies n'etaient reportees sur l'image
     qu'apres enregistrement des reglages, si bien qu'on ne voyait pas ce
     qu'on faisait au moment ou on le faisait. Le recadrage se manipule
     donc desormais SUR l'image, en mode edition :

       - glisser sur l'image la deplace dans son cadre (recadrage) ;
       - glisser une des quatre poignees d'angle, en diagonale, zoome ;
       - une petite barre d'outils donne le zoom courant, deux boutons
         d'increment et une remise a zero.

     Les champs numeriques restent dans les reglages : ils servent a
     poser une valeur exacte, ou a reproduire a l'identique le reglage
     d'une autre tuile.

     L'affichage est mis a jour A CHAQUE mouvement, mais l'enregistrement
     n'a lieu qu'au RELACHEMENT : enregistrer a chaque pixel parcouru
     aurait declenche des centaines d'ecritures du layout pour un seul
     glissement.

     Setting the crop through numeric fields meant working blind: the
     typed values only reached the image once the settings were saved, so
     one could not see what one was doing while doing it. Cropping is
     therefore now handled ON the image, in edit mode:

       - dragging on the image moves it within its frame (cropping);
       - dragging one of the four corner handles, diagonally, zooms;
       - a small toolbar shows the current zoom, two step buttons and a
         reset.

     The numeric fields stay in the settings: they are there to set an
     exact value, or to reproduce another tile's setting identically.

     The display updates on EVERY movement, but saving only happens on
     RELEASE: saving at every pixel travelled would have triggered
     hundreds of layout writes for a single drag. */

  /* Le zoom descend desormais sous 100 %. Il y etait borne parce qu'en
     cadrage « couvrir », reduire aurait decouvert des bandes vides. Avec
     « Image entiere », reduire est au contraire parfaitement legitime :
     c'est ainsi qu'on eloigne un logo des bords de sa tuile.
     Zoom now goes below 100%. It was bounded there because in "cover"
     framing, shrinking would have uncovered empty bands. With "Whole
     image", shrinking is on the contrary perfectly legitimate: that is
     how a logo is moved away from its tile's edges. */
  const ZOOM_MIN = 20;
  const ZOOM_MAX = 500;

  function clampZoom(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return ZOOM_MIN;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(n)));
  }

  /* Deplacement : un glissement vers la DROITE doit faire venir la partie
     GAUCHE de l'image, comme lorsqu'on pousse une photo sous un cache.
     Le point de mire evolue donc a l'inverse du geste.

     L'amplitude depend du zoom : a 100 % l'image affleure exactement le
     cadre, il n'y a rien a deplacer et le geste ne doit rien faire. Plus
     on zoome, plus il y a de matiere hors cadre, et plus un meme geste
     doit parcourir de pourcentage. Sans cette dependance, le deplacement
     serait ridiculement lent a fort zoom et brutal a faible zoom.

     Panning: a drag to the RIGHT must bring in the LEFT part of the
     image, as when pushing a photo under a mask. The focal point
     therefore moves opposite to the gesture.

     The amplitude depends on the zoom: at 100% the image exactly meets
     the frame, there is nothing to move and the gesture must do nothing.
     The more you zoom, the more material sits outside the frame, and the
     further a same gesture must travel in percentage terms. Without that
     dependency, panning would be absurdly slow at high zoom and brutal
     at low zoom. */
  function panFocus(focus, deltaPx, sizePx, zoom) {
    const z = clampZoom(zoom);
    const from = pct(focus, 50);
    if (!sizePx || z <= ZOOM_MIN) return from;
    const overflow = sizePx * (z / 100 - 1);
    if (overflow <= 0) return from;
    return pct(from - (deltaPx / overflow) * 100, from);
  }

  /* Zoom par une poignee d'angle. `sx`/`sy` valent -1 ou 1 selon l'angle
     saisi : tirer VERS L'EXTERIEUR agrandit, quel que soit l'angle. La
     diagonale de la tuile sert d'echelle, pour qu'un meme geste produise
     le meme effet sur une petite comme sur une grande tuile.
     Zoom through a corner handle. `sx`/`sy` are -1 or 1 depending on the
     grabbed corner: pulling OUTWARDS enlarges, whatever the corner. The
     tile's diagonal is the scale, so a same gesture has the same effect
     on a small tile as on a large one. */
  function zoomFromDrag(startZoom, dx, dy, sx, sy, widthPx, heightPx) {
    const diag = Math.sqrt(widthPx * widthPx + heightPx * heightPx) || 1;
    const along = (dx * sx + dy * sy) / diag;
    return clampZoom(clampZoom(startZoom) + along * 200);
  }

  function pct(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  }

  /* Cadrage, recadrage compris.

     LE RECADRAGE NE TOUCHE PAS AU FICHIER. Zoomer et deplacer ne font
     que changer la partie de l'image qui reste visible : le fichier
     televerse reste intact, on peut donc revenir en arriere a tout
     moment, et deux tuiles peuvent recadrer differemment la meme image.
     Rogner reellement le fichier aurait impose une etape de traitement
     d'image cote serveur et rendu l'operation irreversible -- pour un
     resultat visuellement identique.

     Il repose sur deux mecanismes complementaires :
       - `object-fit: cover` fait deja couvrir toute la tuile en rognant
         ce qui depasse, et `object-position` choisit QUELLE partie est
         conservee (c'est le point de mire) ;
       - `transform: scale()` agrandit au-dela, pour zoomer dans l'image.
         Son origine est calee sur le meme point de mire, sans quoi le
         zoom partirait du centre et deplacerait le cadrage a chaque
         changement de zoom.
     Le debordement est coupe par `.pw-image`, qui masque ce qui sort.

     Framing, cropping included.

     CROPPING DOES NOT TOUCH THE FILE. Zooming and moving only change
     which part of the image stays visible: the uploaded file remains
     intact, so one can go back at any time, and two tiles may crop the
     same image differently. Actually cropping the file would have
     required a server-side image-processing step and made the operation
     irreversible -- for a visually identical result.

     It rests on two complementary mechanisms:
       - `object-fit: cover` already covers the whole tile by cropping
         the overflow, and `object-position` picks WHICH part is kept
         (that is the focal point);
       - `transform: scale()` enlarges beyond that, to zoom into the
         image. Its origin is pinned to the same focal point, otherwise
         the zoom would start from the centre and shift the framing on
         every zoom change.
     The overflow is cut by `.pw-image`, which hides what sticks out. */
  function applyFit(img, fit, settings) {
    const s = settings || {};
    const mode = FITS.has(fit) ? fit : "contain";

    if (mode === "none") {
      img.style.width = "auto";
      img.style.height = "auto";
    } else {
      img.style.width = "100%";
      img.style.height = "100%";
    }

    /* Le zoom et le point de mire s'appliquent a TOUS les cadrages, pas
       au seul cadrage « Recadrer ».

       Ils y etaient reserves, si bien qu'avec le cadrage par defaut
       (« Image entiere ») les trois champs Zoom, Position horizontale et
       Position verticale ne faisaient strictement rien : on saisissait
       50 % ou 150 %, rien ne bougeait, sans le moindre indice sur la
       raison. Un reglage sans aucun effet dans la configuration par
       defaut est un reglage casse.

       « Recadrer » se distingue desormais du reste par ce qu'il est
       vraiment : le seul cadrage qui remplit la tuile en rognant plutot
       qu'en laissant des marges. Le zoom, lui, marche partout.

       Zoom and focal point apply to EVERY framing, not to the "Crop"
       framing alone.

       They used to be reserved to it, so that with the default framing
       ("Whole image") the three Zoom, Horizontal position and Vertical
       position fields did strictly nothing: you typed 50% or 150%,
       nothing moved, with no hint as to why. A setting with no effect at
       all in the default configuration is a broken setting.

       "Crop" is now distinguished from the rest by what it actually is:
       the only framing that fills the tile by cropping rather than
       leaving margins. Zoom, meanwhile, works everywhere. */
    img.style.objectFit = mode === "crop" ? "cover" : mode;

    const x = pct(s.focusX, 50);
    const y = pct(s.focusY, 50);
    const zoom = clampZoom(s.zoom);
    img.style.objectPosition = x + "% " + y + "%";
    img.style.transformOrigin = x + "% " + y + "%";
    img.style.transform = zoom === 100 ? "" : "scale(" + (zoom / 100) + ")";
  }

  ImageWidget._safeLink = safeLink;
  ImageWidget._applyFit = applyFit;
  ImageWidget._pct = pct;
  ImageWidget._panFocus = panFocus;
  ImageWidget._zoomFromDrag = zoomFromDrag;
  ImageWidget._clampZoom = clampZoom;

  window.PiBoard.registerWidget("image", ImageWidget);
})();
