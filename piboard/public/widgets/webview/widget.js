/* PiBoard widget: webview / page web (jusqu'a 5 sites via des onglets)

   Jusqu'a 5 sites (reglages site1Url..site5Url) sont proposes comme
   des onglets en haut de la tuile -- masques quand un seul site est
   configure, pour ne pas prendre de place inutilement dans le cas
   d'usage le plus courant. Un seul site est rendu a la fois (celui de
   l'onglet actif) : changer d'onglet remplace le contenu affiche
   plutot que de garder les autres sites charges en arriere-plan --
   c'est deja assez couteux de charger UN site (surtout en mode
   "Image", qui relance un navigateur), inutile d'en payer le prix pour
   5 a la fois alors qu'un seul est visible.

   Trois modes (reglage "mode"), communs a tous les onglets :
   - "proxy" (par defaut) : la page est recuperee cote serveur puis
     reexpediee depuis l'origine de PiBoard (voir /api/webview-proxy et
     server/webviewProxy.js pour le detail). Contourne le blocage
     d'affichage en iframe (X-Frame-Options/CSP) que la plupart des
     sites posent desormais par defaut -- sans ce detour, ces sites
     affichaient une page blanche silencieuse, sans la moindre erreur
     visible.
   - "direct" : l'iframe pointe directement vers l'URL du site. Plus
     rapide (pas de detour serveur) et garde le site pleinement
     interactif, mais ne fonctionne QUE si le site autorise
     explicitement l'affichage en iframe.
   - "shot" ("Image") : la page est rendue par Chromium headless cote
     serveur puis affichee comme une image fixe (voir
     /api/webview-shot et server/webviewShot.js). Fonctionne avec
     absolument n'importe quel site, au prix d'un affichage non
     interactif.

   Cas particulier : dans l'application de bureau (Electron), la balise
   <webview> est utilisee a la place de tout ce qui precede (sauf si le
   mode "Image" est explicitement choisi) -- elle affiche le site tel
   quel, interactif, en ignorant totalement son X-Frame-Options. Voir
   hasWebviewTag() plus bas.

   Up to 5 sites (settings site1Url..site5Url) are offered as tabs at
   the top of the tile -- hidden when only one site is configured, so
   as not to take up space needlessly in the most common case. Only one
   site is rendered at a time (the active tab's): switching tabs
   replaces the displayed content rather than keeping the other sites
   loaded in the background -- loading ONE site is already costly
   enough (especially in "Image" mode, which relaunches a browser), no
   point paying that cost for 5 at once when only one is visible.

   Three modes (setting "mode"), shared by every tab:
   - "proxy" (default): the page is fetched server-side then relayed
     from PiBoard's own origin (see /api/webview-proxy and
     server/webviewProxy.js for detail). Works around the
     iframe-embedding block (X-Frame-Options/CSP) most sites now set
     by default -- without this workaround, those sites showed a
     silent blank page, with no visible error at all.
   - "direct": the iframe points straight at the site's URL. Faster
     (no server round-trip) and keeps the site fully interactive, but
     only works if the site explicitly allows iframe embedding.
   - "shot" ("Image"): the page is rendered by headless Chromium
     server-side then shown as a static image (see /api/webview-shot
     and server/webviewShot.js). Works with absolutely any site, at
     the cost of a non-interactive display.

   Special case: in the desktop app (Electron), the <webview> tag is
   used instead of all of the above (unless "Image" mode is explicitly
   chosen) -- it shows the site as-is, interactive, while completely
   ignoring its X-Frame-Options. See hasWebviewTag() below. */
(function () {
  "use strict";

  const MAX_SITES = 5;

  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Meme tolerance que server/webviewProxy.js:normalizeUrl (voir son
     commentaire) : une adresse tapee sans "https://" (par reflexe de
     barre d'adresse de navigateur) est completee plutot que rejetee.
     Necessaire ICI AUSSI, pas seulement cote serveur : le mode
     "direct" ne passe jamais par le serveur, une adresse sans schema y
     serait traitee comme une URL relative par le navigateur (echec
     silencieux) sans ce filet.
     Same tolerance as server/webviewProxy.js:normalizeUrl (see its
     comment): an address typed without "https://" (out of
     browser-address-bar habit) gets completed rather than rejected.
     Needed HERE TOO, not just server-side: "direct" mode never goes
     through the server, an address with no scheme would be treated as
     a relative URL by the browser (silent failure) without this net. */
  function normalizeUrl(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return trimmed;
    // Meme detection generique de schema que server/webviewProxy.js
    // (voir son commentaire) : un schema deja present, quel qu'il soit,
    // n'est jamais reinterprete de force.
    // Same generic scheme detection as server/webviewProxy.js (see its
    // comment): a scheme already present, whatever it is, is never
    // force-reinterpreted.
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  }

  /* Nom d'onglet par defaut quand aucun libelle n'est fourni : le nom
     de domaine, sans le "www." decoratif. Repli sur l'URL telle quelle
     si elle n'est meme pas parsable.
     Default tab name when no label is provided: the domain name,
     without the decorative "www.". Falls back to the raw URL if it
     isn't even parsable. */
  function labelFor(url) {
    try {
      return new URL(normalizeUrl(url)).hostname.replace(/^www\./i, "");
    } catch (e) {
      return url;
    }
  }

  /* PiBoard tourne-t-il dans l'application de bureau (Electron) ?
     Determinant pour cette tuile : Electron fournit la balise
     <webview>, qui affiche un site tiers en IGNORANT son
     X-Frame-Options / sa CSP frame-ancestors -- ce qu'une <iframe>
     ordinaire ne sait pas faire. C'est de loin la meilleure option
     quand elle est disponible : le site reste pleinement interactif,
     charge ses ressources normalement, et aucun detour serveur n'est
     necessaire.
     Sur un navigateur ordinaire (Chromium en kiosque sur le Pi), la
     balise n'existe pas : on retombe sur les modes serveur.
     Is PiBoard running inside the desktop app (Electron)? Decisive for
     this tile: Electron provides the <webview> tag, which displays a
     third-party site while IGNORING its X-Frame-Options /
     frame-ancestors CSP -- something a plain <iframe> cannot do. By far
     the best option when available: the site stays fully interactive,
     loads its resources normally, and no server round-trip is needed.
     In a plain browser (kiosk Chromium on the Pi), the tag doesn't
     exist: we fall back to the server-side modes. */
  function hasWebviewTag() {
    return /Electron\//i.test(navigator.userAgent);
  }

  class WebviewWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.observer = null;
      this.resizeDebounce = null;
      this.activeIdx = 0;
    }

    init() {
      this.render();
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
    }

    /* Liste des sites reellement configures (URL non vide) parmi les
       MAX_SITES emplacements fixes des reglages -- meme principe que
       les fuseaux additionnels de l'horloge. Le premier emplacement
       retombe sur l'ancien reglage "url" s'il est vide : compatibilite
       ascendante pour une tuile configuree avant l'ajout des onglets,
       qui ne doit pas se retrouver vide a la premiere ouverture apres
       mise a jour.
       List of ACTUALLY configured sites (non-empty URL) among the
       MAX_SITES fixed setting slots -- same principle as the clock's
       extra zones. The first slot falls back to the old "url" setting
       if empty: backward compatibility for a tile configured before
       tabs were added, which must not end up empty on first open after
       the update. */
    sites() {
      const s = this.ctx.settings;
      const list = [];
      for (let i = 1; i <= MAX_SITES; i++) {
        let raw = String(s["site" + i + "Url"] || "").trim();
        if (i === 1 && !raw && s.url) raw = String(s.url).trim();
        if (!raw) continue;
        const url = normalizeUrl(raw);
        const label = String(s["site" + i + "Label"] || "").trim() || labelFor(url);
        list.push({ url, label });
      }
      return list;
    }

    tabsHtml(sites) {
      const i18n = this.ctx.i18n;
      return `<div class="pwv-tabs">${sites.map((site, i) => `
        <div class="pwv-tab${i === this.activeIdx ? " pwv-tab-active" : ""}" data-idx="${i}" title="${escapeAttr(site.url)}">
          <span class="pwv-tab-label">${escapeAttr(site.label)}</span>
          <button type="button" class="pwv-tab-refresh" data-idx="${i}" title="${escapeAttr(i18n.t("webview.refreshTab"))}" aria-label="${escapeAttr(i18n.t("webview.refreshTab"))}">⟳</button>
        </div>`).join("")}</div>`;
    }

    render() {
      const sites = this.sites();

      if (!sites.length) {
        this.ctx.el.innerHTML = `<div class="pw-webview"><div class="pwv-missing">${this.ctx.i18n.t("webview.missing")}</div></div>`;
        return;
      }
      // Reglages modifies entre-temps (un onglet retire, par exemple) :
      // repli sur le premier onglet plutot qu'un index qui n'existe
      // plus. Settings changed in the meantime (a tab removed, for
      // instance): fall back to the first tab rather than an index that
      // no longer exists.
      if (this.activeIdx >= sites.length) this.activeIdx = 0;

      this.ctx.el.innerHTML = `<div class="pw-webview">${sites.length > 1 ? this.tabsHtml(sites) : ""}<div class="pwv-content"></div></div>`;

      if (sites.length > 1) {
        // stopPropagation partout ici : sinon ces clics remontent
        // jusqu'a la grille en mode edition et rouvrent les reglages de
        // la tuile en pleine consultation -- meme correctif que les
        // autres tuiles a onglets (Programme TV, Horloge...).
        // stopPropagation everywhere here: otherwise these clicks
        // bubble up to the grid in edit mode and reopen the tile's
        // settings mid-viewing -- same fix as other tabbed tiles (TV
        // guide, Clock...).
        this.ctx.el.querySelectorAll(".pwv-tab").forEach((tabEl) => {
          tabEl.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = Number(tabEl.dataset.idx);
            if (idx === this.activeIdx) return;
            this.activateTab(sites, idx);
          });
        });
        // Bouton de rafraichissement : distinct du clic sur l'onglet
        // lui-meme, puisque cliquer sur l'onglet DEJA actif ne fait
        // normalement rien (evite un rechargement accidentel) -- c'est
        // precisement ce que ce bouton permet de declencher malgre
        // tout, sans avoir a basculer vers un autre onglet puis revenir.
        // Refresh button: distinct from clicking the tab itself, since
        // clicking the ALREADY active tab normally does nothing (avoids
        // an accidental reload) -- this is exactly what this button
        // lets you trigger anyway, without switching to another tab and
        // back.
        this.ctx.el.querySelectorAll(".pwv-tab-refresh").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.activateTab(sites, Number(btn.dataset.idx));
          });
        });
      }

      this.renderContent(sites);
    }

    /* Bascule sur l'onglet demande (aucun effet s'il l'est deja) puis
       (re)charge son contenu -- utilise a la fois par le clic sur un
       onglet et par son bouton de rafraichissement, qui partagent la
       meme action concrete : afficher une version fraiche de ce site.
       Switches to the requested tab (no-op if it already is) then
       (re)loads its content -- used by both clicking a tab and its
       refresh button, which share the same concrete action: show a
       fresh version of that site. */
    activateTab(sites, idx) {
      this.activeIdx = idx;
      this.ctx.el.querySelectorAll(".pwv-tab").forEach((t) => t.classList.toggle("pwv-tab-active", Number(t.dataset.idx) === idx));
      this.renderContent(sites);
    }

    /* Construit le contenu de l'onglet actif -- seule cette zone est
       reconstruite au changement d'onglet, la barre d'onglets elle-meme
       reste en place. Builds the active tab's content -- only this area
       is rebuilt on tab switch, the tab bar itself stays in place. */
    renderContent(sites) {
      clearInterval(this.timer);
      clearTimeout(this.resizeDebounce);
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
      this.iframe = null;

      const s = this.ctx.settings;
      const site = sites[this.activeIdx];
      const content = this.ctx.el.querySelector(".pwv-content");
      if (!content) return;

      /* Application de bureau (Electron) : la balise <webview> est
         essayee AVANT tout le reste, sauf si le mode "Image" est
         explicitement demande. C'est la seule option qui affiche le
         site tel quel, interactif, sans se soucier de son
         X-Frame-Options -- les modes serveur ("proxy"/"direct") n'ont
         plus de raison d'etre ici.
         Desktop app (Electron): the <webview> tag is tried BEFORE
         anything else, unless "Image" mode is explicitly requested.
         It's the only option that shows the site as-is, interactive,
         regardless of its X-Frame-Options -- the server-side modes
         ("proxy"/"direct") have no reason to be used here. */
      if (hasWebviewTag() && s.mode !== "shot") {
        content.innerHTML = `<webview class="pwv-webview" src="${escapeAttr(site.url)}" allowpopups></webview>`;
        const wv = content.querySelector("webview");
        // Meme repli que le mode "Image" en cas d'echec de chargement :
        // un message plutot qu'un cadre vide sans explication.
        // Same fallback as "Image" mode on load failure: a message
        // rather than an empty frame with no explanation.
        wv.addEventListener("did-fail-load", (e) => {
          if (e.errorCode === -3) return; // chargement interrompu (navigation normale) / aborted load (normal navigation)
          content.innerHTML = `<div class="pwv-status">${escapeAttr(this.ctx.i18n.t("webview.shotError"))}</div>`;
        });

        const wvMinutes = Number(s.reload) || 0;
        if (wvMinutes > 0) {
          this.timer = setInterval(() => { try { wv.reload(); } catch (err) { /* noop */ } }, wvMinutes * 60000);
        }
        return;
      }

      if (s.mode === "shot") {
        content.innerHTML = `<img class="pwv-shot" alt="" hidden><div class="pwv-status">${this.ctx.i18n.t("webview.shotLoading")}</div>`;
        this.refreshShot(site.url);
        // Une tuile redimensionnee change la taille de rendu demandee :
        // on recapture, mais seulement apres stabilisation, pour ne pas
        // relancer Chromium a chaque pixel pendant un glisser.
        // A resized tile changes the requested render size: recapture,
        // but only once settled, so Chromium isn't relaunched on every
        // pixel during a drag.
        this.observer = new ResizeObserver(() => {
          clearTimeout(this.resizeDebounce);
          this.resizeDebounce = setTimeout(() => this.refreshShot(site.url), 800);
        });
        this.observer.observe(this.ctx.el);

        const shotMinutes = Number(s.reload) || 0;
        if (shotMinutes > 0) {
          this.timer = setInterval(() => this.refreshShot(site.url), shotMinutes * 60000);
        }
        return;
      }

      content.innerHTML = `<iframe src="${escapeAttr(this.frameSrc(site.url, false))}" loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
      this.iframe = content.querySelector("iframe");
      this.applyZoom();

      // Le zoom depend de la taille de la tuile / zoom depends on tile size
      this.observer = new ResizeObserver(() => this.applyZoom());
      this.observer.observe(this.ctx.el);

      const minutes = Number(s.reload) || 0;
      if (minutes > 0) {
        this.timer = setInterval(() => {
          // Mode direct : reassignation a l'identique, comme avant (une
          // partie des sites optimisent quand meme le rechargement).
          // Mode proxy : notre reponse porte deja Cache-Control:
          // no-store, mais un identifiant change garantit malgre tout
          // une navigation fraiche plutot qu'une reassignation a
          // l'identique que certains moteurs pourraient ignorer.
          // Direct mode: reassigned as-is, like before (some sites
          // still honor the reload anyway). Proxy mode: our response
          // already carries Cache-Control: no-store, but a changing
          // identifier still guarantees a fresh navigation rather than
          // an identical reassignment some engines might skip.
          this.iframe.src = this.frameSrc(site.url, true);
        }, minutes * 60000);
      }
    }

    frameSrc(url, bust) {
      const s = this.ctx.settings;
      if (s.mode === "direct") return url;
      const p = "/api/webview-proxy?url=" + encodeURIComponent(url);
      return bust ? (p + "&t=" + Date.now()) : p;
    }

    /* Adresse de la capture d'ecran (mode "image"). La taille demandee
       suit celle de la tuile, pour que la page soit rendue au bon
       format plutot que redimensionnee ensuite -- une page rendue en
       1280x800 puis ecrasee dans une tuile etroite serait illisible.
       Screenshot address ("image" mode). The requested size follows the
       tile's own, so the page is rendered at the right shape rather
       than squeezed afterwards -- a page rendered at 1280x800 then
       crammed into a narrow tile would be unreadable. */
    shotSrc(url) {
      const s = this.ctx.settings;
      const scale = (Number(s.zoom) || 100) / 100;
      const w = Math.max(320, Math.round((this.ctx.el.clientWidth || 640) / scale));
      const h = Math.max(240, Math.round((this.ctx.el.clientHeight || 480) / scale));
      return "/api/webview-shot?url=" + encodeURIComponent(url) + "&w=" + w + "&h=" + h + "&t=" + Date.now();
    }

    /* Mode "image" : la capture prend plusieurs secondes sur un Pi
       (lancement de Chromium). L'image n'est remplacee qu'une fois la
       nouvelle effectivement chargee -- evite un cadre vide clignotant
       a chaque rafraichissement.
       "Image" mode: capturing takes several seconds on a Pi (Chromium
       launch). The image is only swapped once the new one has actually
       loaded -- avoids a blinking empty frame on every refresh. */
    refreshShot(url) {
      const content = this.ctx.el.querySelector(".pwv-content");
      const img = content && content.querySelector(".pwv-shot");
      const status = content && content.querySelector(".pwv-status");
      if (!img) return;
      const shotUrl = this.shotSrc(url);
      const probe = new Image();
      probe.onload = () => {
        img.src = shotUrl;
        img.hidden = false;
        if (status) status.hidden = true;
      };
      probe.onerror = () => {
        if (status) {
          status.textContent = this.ctx.i18n.t("webview.shotError");
          status.hidden = false;
        }
      };
      probe.src = shotUrl;
    }

    applyZoom() {
      if (!this.iframe) return;
      const scale = (Number(this.ctx.settings.zoom) || 100) / 100;
      // Dimensions de la zone de CONTENU, pas de la tuile entiere : la
      // barre d'onglets (si affichee) prend une partie de la hauteur,
      // sans cela l'iframe deborderait sous les onglets.
      // Dimensions of the CONTENT area, not the whole tile: the tab bar
      // (when shown) takes up part of the height, without this the
      // iframe would overflow under the tabs.
      const content = this.ctx.el.querySelector(".pwv-content") || this.ctx.el;
      const w = content.clientWidth;
      const h = content.clientHeight;
      this.iframe.style.width = Math.round(w / scale) + "px";
      this.iframe.style.height = Math.round(h / scale) + "px";
      this.iframe.style.transform = "scale(" + scale + ")";
    }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.resizeDebounce);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("webview", WebviewWidget);
})();
