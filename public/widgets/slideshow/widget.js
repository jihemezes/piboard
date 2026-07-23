/* PiBoard widget: slideshow / diaporama
   v2 : quatre sources possibles - photos televersees et gerees depuis la
   tuile (aucun serveur web requis), dossier local (partage NAS/SMB monte
   par le systeme, ou dossier synchronise par rclone depuis un service
   cloud), partage WebDAV, ou liste d'URLs d'images (methode d'origine).
   v2: four possible sources - photos uploaded and managed from the tile
   (no web server needed), a local folder (NAS/SMB share mounted by the
   OS, or a folder synced by rclone from a cloud service), a WebDAV
   share, or a list of image URLs (original method). */
(function () {
  "use strict";

  function parseUrls(text) {
    return (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  /* Attend qu'une image ait ses dimensions naturelles disponibles (deja
     chargee/en cache, ou apres son evenement load/error), avec un
     delai maximum pour ne jamais bloquer l'affichage si le reseau traine.
     Waits for an image to have its natural dimensions available (already
     loaded/cached, or after its load/error event), with a maximum delay
     so a slow network never blocks the display. */
  function waitForImage(img, timeoutMs) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
      setTimeout(finish, timeoutMs);
    });
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Source effective : retro-compatibilite avec les tuiles existantes
     creees avant l'ajout de ce reglage. Piege : le coeur de PiBoard
     pre-remplit TOUJOURS les reglages manquants avec les valeurs par
     defaut du manifeste des le montage (pas seulement a la creation),
     donc "source" vaut deja "upload" (son defaut) meme pour une vieille
     tuile qui n'a jamais connu ce reglage. Impossible de distinguer un
     choix explicite d'un defaut applique automatiquement : si la source
     resolue est "upload" (le defaut) mais qu'il reste du texte dans
     l'ancien champ URLs, on privilegie ce texte plutot que de faire
     disparaitre silencieusement les photos existantes d'un utilisateur.
     Effective source: backward compatibility with tiles created before
     this setting existed. Gotcha: PiBoard's core ALWAYS backfills
     missing settings with the manifest's default values as soon as a
     tile mounts (not just at creation), so "source" is already "upload"
     (its default) even for an old tile that never knew this setting.
     There's no way to tell an explicit choice apart from an
     auto-applied default: if the resolved source is "upload" (the
     default) but the old URLs field still has text in it, that text
     wins rather than silently making an existing user's photos vanish. */
  function effectiveSource(s) {
    if (s.source && s.source !== "upload") return s.source;
    if (s.images && s.images.trim()) return "urls";
    return s.source || "upload";
  }

  class SlideshowWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.refreshTimer = null;
      this.urls = [];
      this.index = 0;
      this.modal = null;
    }

    async init() {
      await this.build();
    }

    /* Charge la liste d'images selon la source configuree. Ne leve pas :
       renvoie {urls} ou {error}. Loads the image list per the configured
       source. Never throws: returns {urls} or {error}. */
    async loadImages() {
      const s = this.ctx.settings;
      const src = effectiveSource(s);
      try {
        if (src === "upload") {
          const data = await fetch("/api/media/" + this.ctx.instanceId).then((r) => r.json());
          return { urls: (data.items || []).map((it) => it.url), src };
        }
        if (src === "folder") {
          if (!s.folderPath) return { urls: [], src, empty: true };
          const data = await fetch("/api/local-folder?path=" + encodeURIComponent(s.folderPath)).then((r) => r.json());
          if (data.error) return { error: data.error, src };
          return { urls: (data.items || []).map((it) => it.url), src };
        }
        if (src === "webdav") {
          if (!s.webdavUrl) return { urls: [], src, empty: true };
          const data = await fetch("/api/webdav-list", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: s.webdavUrl, user: s.webdavUser, pass: s.webdavPass })
          }).then((r) => r.json());
          if (data.error) return { error: data.error, src };
          return { urls: (data.items || []).map((it) => it.url), src };
        }
        if (src === "usb") {
          // Zero reglage : on interroge simplement les cles actuellement
          // branchees. "noKey" distingue "aucune cle detectee" de "cle(s)
          // detectee(s) mais sans photo dedans", pour un message plus utile.
          // Zero settings: simply asks which keys are currently plugged
          // in. "noKey" distinguishes "no key detected" from "key(s)
          // detected but no photos on them", for a more useful message.
          const data = await fetch("/api/usb-media").then((r) => r.json());
          if (data.error) return { error: data.error, src };
          return { urls: (data.items || []).map((it) => it.url), src, noKey: !(data.volumes || []).length };
        }
        // "urls"
        return { urls: parseUrls(s.images), src };
      } catch (e) {
        return { error: String(e.message || e), src };
      }
    }

    async build() {
      const s = this.ctx.settings;
      clearInterval(this.timer);
      clearInterval(this.refreshTimer);

      const result = await this.loadImages();
      const src = result.src;

      if (result.error) {
        this.renderMessage(src, this.ctx.i18n.t("slideshow.sourceError") + " " + result.error);
        this.armRefresh(src);
        return;
      }

      let urls = result.urls || [];
      if (s.shuffle) urls = shuffleArray(urls);
      this.urls = urls;
      this.index = 0;

      if (!urls.length) {
        this.renderMessage(src, null, result.noKey);
        this.armRefresh(src);
        return;
      }

      this.ctx.el.innerHTML = `
        <div class="pw-slideshow">
          ${urls.map((u, i) => `<div class="pws-slide" data-i="${i}"><img class="pws-slide-img" alt="" src="${escapeAttr(u)}"></div>`).join("")}
          ${urls.length > 1 ? `<div class="pws-dots">${urls.map((_, i) => `<span data-dot="${i}"></span>`).join("")}</div>` : ""}
          ${this.manageButtonHtml(src)}
        </div>`;
      this.wireManageButton();

      // Determine le format (paysage/portrait) et l'ajustement de chaque
      // photo des que ses dimensions reelles sont connues -- inutile de
      // les attendre toutes, chaque <img> se met a jour independamment.
      // Determines the orientation (landscape/portrait) and fit of each
      // photo as soon as its actual dimensions are known -- no need to
      // wait for all of them, each <img> updates independently.
      const slideEls = this.ctx.el.querySelectorAll(".pws-slide");
      slideEls.forEach((slideEl) => {
        const img = slideEl.querySelector(".pws-slide-img");
        const url = img.getAttribute("src");
        const apply = () => this.applyFit(slideEl, img, url, s);
        if (img.complete && img.naturalWidth) apply();
        else img.addEventListener("load", apply, { once: true });
      });

      // La toute premiere photo affichee attend ses dimensions (avec
      // garde-fou de delai) pour eviter un flash avec le mauvais
      // ajustement ; les suivantes ont largement le temps de charger
      // pendant l'intervalle d'affichage.
      // The very first photo shown waits for its dimensions (with a
      // delay safety net) to avoid a flash with the wrong fit; later
      // ones have plenty of time to load during the display interval.
      const firstImg = slideEls.length ? slideEls[0].querySelector(".pws-slide-img") : null;
      if (firstImg) await waitForImage(firstImg, 1500);

      this.show(0, true);
      if (urls.length > 1) {
        const seconds = Math.max(3, Number(s.intervalSeconds) || 12);
        this.timer = setInterval(() => this.next(), seconds * 1000);
      }
      this.armRefresh(src);
    }

    /* Choisit l'ajustement (Remplir/Contenir) selon le FORMAT REEL de la
       photo (paysage/portrait), une fois ses dimensions naturelles
       connues, et pose le fond (couleur unie ou photo floutee) derriere
       une photo en mode "Contenir". C'est le coeur de la demande :
       chaque photo est traitee selon son propre format, pas un reglage
       unique applique bêtement a toutes.
       Chooses the fit (Fill/Show entire) based on the photo's ACTUAL
       orientation (landscape/portrait), once its natural dimensions are
       known, and sets the background (solid color or blurred photo)
       behind a photo shown in "Contain" mode. This is the crux of the
       request: each photo is handled per its own format, not a single
       setting bluntly applied to all of them. */
    applyFit(slideEl, img, url, s) {
      const isPortrait = img.naturalHeight > img.naturalWidth;
      const fit = (isPortrait ? s.fitPortrait : s.fitLandscape) === "cover" ? "cover" : "contain";
      slideEl.dataset.fit = fit;
      img.classList.remove("pws-fit-cover", "pws-fit-contain");
      img.classList.add(fit === "cover" ? "pws-fit-cover" : "pws-fit-contain");

      if (fit === "contain") {
        if (s.containBackground === "blur") {
          slideEl.style.backgroundColor = "";
          if (!slideEl.querySelector(".pws-slide-blurbg")) {
            const bg = document.createElement("img");
            bg.className = "pws-slide-blurbg";
            bg.alt = "";
            bg.src = url;
            slideEl.insertBefore(bg, img);
          }
        } else {
          const old = slideEl.querySelector(".pws-slide-blurbg");
          if (old) old.remove();
          slideEl.style.backgroundColor = s.containBackgroundColor || "#000000";
        }
      } else {
        const old = slideEl.querySelector(".pws-slide-blurbg");
        if (old) old.remove();
        slideEl.style.backgroundColor = "";
      }
    }

    /* Message d'etat (vide ou en erreur), avec le bouton de gestion pour
       le mode televersement. Status message (empty or error), with the
       manage button for upload mode. */
    renderMessage(src, errorText, noKey) {
      const msg = errorText || this.ctx.i18n.t(
        src === "upload" ? "slideshow.emptyUpload"
          : src === "folder" ? "slideshow.emptyFolder"
          : src === "webdav" ? "slideshow.emptyWebdav"
          : src === "usb" ? (noKey ? "slideshow.emptyUsbNoKey" : "slideshow.emptyUsb")
          : "slideshow.empty"
      );
      this.ctx.el.innerHTML = `
        <div class="pw-slideshow">
          <div class="pws-empty">
            <p>${msg}</p>
            ${src === "upload" ? `<button type="button" class="pws-add-btn pws-add-btn-big">${this.ctx.i18n.t("slideshow.addPhotos")}</button>` : ""}
          </div>
        </div>`;
      this.wireManageButton();
    }

    manageButtonHtml(src) {
      if (src !== "upload") return "";
      return `<button type="button" class="pws-manage-btn" title="${this.ctx.i18n.t("slideshow.managePhotos")}">🖼️</button>`;
    }

    wireManageButton() {
      const btn = this.ctx.el.querySelector(".pws-manage-btn, .pws-add-btn");
      // stopPropagation() est essentiel ici : en mode edition (actif par
      // defaut juste apres l'ajout d'une tuile, et qui le reste tant
      // qu'on ne le desactive pas explicitement), un simple clic sur une
      // tuile rouvre ses reglages (voir editClickHandler dans app.js).
      // Sans stopPropagation, ce clic remontait donc jusqu'a la grille et
      // refermait aussitot le gestionnaire de photos qu'on venait tout
      // juste d'ouvrir, en le remplacant par le panneau de reglages de
      // la tuile -- exactement le bug observe ("ca renvoie au panneau de
      // config, aucun gestionnaire de fichiers n'apparait").
      // stopPropagation() is essential here: in edit mode (on by default
      // right after adding a tile, and staying on until explicitly turned
      // off), a plain click on a tile reopens its settings (see
      // editClickHandler in app.js). Without stopPropagation, this click
      // therefore bubbled up to the grid and immediately closed the photo
      // manager that had just been opened, replacing it with the tile's
      // settings panel -- exactly the observed bug ("it goes back to the
      // config panel, no file manager appears").
      if (btn) btn.addEventListener("click", (e) => { e.stopPropagation(); this.openManager(); });
    }

    /* Re-verifie periodiquement le dossier local ou le partage WebDAV
       (les fichiers peuvent changer hors de PiBoard). Inutile pour
       "upload" (mis a jour immediatement depuis le gestionnaire) et
       "urls" (liste statique). Periodically re-checks the local folder
       or WebDAV share (files can change outside PiBoard). Not needed for
       "upload" (updated immediately from the manager) or "urls" (static list). */
    armRefresh(src) {
      if (src !== "folder" && src !== "webdav" && src !== "usb") return;
      const minutes = Math.max(2, Number(this.ctx.settings.refreshMinutes) || 15);
      this.refreshTimer = setInterval(() => this.build(), minutes * 60000);
    }

    show(i, first) {
      const s = this.ctx.settings;
      const slides = this.ctx.el.querySelectorAll(".pws-slide");
      const dots = this.ctx.el.querySelectorAll("[data-dot]");
      slides.forEach((el, idx) => {
        el.classList.toggle("pws-active", idx === i);
        if (idx === i && s.kenBurns) {
          const img = el.querySelector(".pws-slide-img");
          if (img) {
            // Zoom marque pour une photo qui remplit la tuile (recadree),
            // zoom bien plus leger pour une photo entierement visible --
            // afin de ne jamais rogner dans une photo qui ne devrait pas
            // l'etre (voir le commentaire de applyFit()).
            // Strong zoom for a photo filling the tile (cropped), a much
            // lighter zoom for a fully visible photo -- so it never crops
            // into a photo that shouldn't be cropped (see applyFit()'s
            // comment).
            const light = el.dataset.fit === "contain";
            img.classList.remove("pws-kb", "pws-kb-light", "pws-alt");
            void img.offsetWidth; // relancer l'animation / restart animation
            img.classList.add(light ? "pws-kb-light" : "pws-kb");
            if (i % 2 === 1) img.classList.add("pws-alt");
          }
        }
      });
      dots.forEach((d, idx) => d.classList.toggle("pws-dot-active", idx === i));
    }

    next() {
      this.index = (this.index + 1) % this.urls.length;
      this.show(this.index);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.build();
    }

    onLangChanged() { this.build(); }

    /* ---------- Gestionnaire de photos (mode "upload") ----------
       Fenetre propre au widget (comme la courbe du widget crypto),
       ajoutee a document.body pour echapper au cadre de la tuile.
       Own widget window (like the crypto widget's chart popup), appended
       to document.body to escape the tile's clipped frame. */
    ensureManagerModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pws-manager-card">
          <header class="modal-head">
            <h2>${i18n.t("slideshow.managePhotos")}</h2>
            <button type="button" class="modal-close" aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pws-manager-body">
            <div class="pws-manager-grid"></div>
            <div class="pws-manager-status" hidden></div>
          </div>
          <div class="form-actions modal-foot">
            <input type="file" class="pws-file-input" accept="image/*" multiple hidden>
            <button type="button" class="btn primary pws-upload-btn">${i18n.t("slideshow.addPhotos")}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);

      const close = () => { wrap.hidden = true; };
      wrap.querySelector(".modal-close").addEventListener("click", close);
      wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });

      const fileInput = wrap.querySelector(".pws-file-input");
      wrap.querySelector(".pws-upload-btn").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => this.uploadFiles(fileInput.files));

      this.modal = wrap;
      return wrap;
    }

    async openManager() {
      const modal = this.ensureManagerModal();
      modal.hidden = false;
      await this.refreshManagerGrid();
    }

    async refreshManagerGrid() {
      const modal = this.modal;
      const i18n = this.ctx.i18n;
      const grid = modal.querySelector(".pws-manager-grid");
      const status = modal.querySelector(".pws-manager-status");
      status.hidden = true;
      try {
        const data = await fetch("/api/media/" + this.ctx.instanceId).then((r) => r.json());
        const items = data.items || [];
        grid.innerHTML = items.length
          ? items.map((it) => `
              <div class="pws-thumb" data-name="${it.name.replace(/"/g, "&quot;")}">
                <img src="${it.url}" alt="">
                <button type="button" class="pws-thumb-del" title="${i18n.t("slideshow.deletePhoto")}">&times;</button>
              </div>`).join("")
          : `<p class="pws-manager-empty">${i18n.t("slideshow.emptyUpload")}</p>`;
        grid.querySelectorAll(".pws-thumb-del").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const name = e.target.closest(".pws-thumb").dataset.name;
            this.deletePhoto(name);
          });
        });
      } catch (e) {
        status.hidden = false;
        status.textContent = i18n.t("slideshow.managerError");
      }
    }

    async uploadFiles(fileList) {
      if (!fileList || !fileList.length) return;
      const modal = this.modal;
      const i18n = this.ctx.i18n;
      const status = modal.querySelector(".pws-manager-status");
      status.hidden = false;
      status.textContent = i18n.t("common.loading");
      const form = new FormData();
      for (const f of fileList) form.append("photos", f);
      try {
        const res = await fetch("/api/media/" + this.ctx.instanceId, { method: "POST", body: form });
        if (!res.ok) throw new Error("status " + res.status);
        status.hidden = true;
        await this.refreshManagerGrid();
        await this.build(); // rafraichit aussi le diaporama sur la tuile
      } catch (e) {
        status.hidden = false;
        status.textContent = i18n.t("slideshow.uploadError");
      }
      modal.querySelector(".pws-file-input").value = "";
    }

    async deletePhoto(name) {
      try {
        await fetch("/api/media/" + this.ctx.instanceId + "/" + encodeURIComponent(name), { method: "DELETE" });
        await this.refreshManagerGrid();
        await this.build();
      } catch (e) { /* le prochain refresh du gestionnaire le montrera toujours si echec */ }
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.refreshTimer);
      if (this.modal) this.modal.remove();
    }
  }

  window.PiBoard.registerWidget("slideshow", SlideshowWidget);
})();
