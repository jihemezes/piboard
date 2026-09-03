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
  function safeLink(url) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    return null;
  }

  const FITS = new Set(["contain", "cover", "fill", "none"]);

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
      applyFit(img, s.fit);
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

      this.root.innerHTML = "";
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

    destroy() {
      if (this.modal) this.modal.remove();
    }
  }

  function applyFit(img, fit) {
    const mode = FITS.has(fit) ? fit : "contain";
    img.style.objectFit = mode;
    if (mode === "none") {
      img.style.width = "auto";
      img.style.height = "auto";
    } else {
      img.style.width = "100%";
      img.style.height = "100%";
    }
  }

  ImageWidget._safeLink = safeLink;
  ImageWidget._applyFit = applyFit;

  window.PiBoard.registerWidget("image", ImageWidget);
})();
