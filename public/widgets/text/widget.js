/* ============================================================
   PiBoard - tuile Texte / Text tile

   Tuile de STYLE : elle n'affiche aucune donnee, elle sert a composer
   une page (titre, intitule de section, legende). Associee au fond
   transparent des reglages universels, elle permet de titrer une page
   sans qu'aucun cadre ne soit visible.

   DEUX MODES DE TAILLE, et c'est le coeur de la tuile :
     - "fixe"    : la taille en pixels est celle des reglages, quelle que
                   soit la taille de la tuile. Previsible, mais le texte
                   deborde si l'on retrecit la tuile.
     - "adapter" : la taille est recalculee pour que le texte remplisse la
                   tuile sans deborder. C'est le defaut, parce qu'une
                   tuile de titre est presque toujours redimensionnee
                   apres coup, et qu'un titre coupe est le defaut le plus
                   visible qui soit sur un tableau mural.

   L'ajustement se fait par RECHERCHE DICHOTOMIQUE sur la taille de
   police, pas par une formule : la hauteur rendue depend de la police
   reellement disponible, du nombre de lignes apres retour automatique et
   de l'espacement des lettres -- autant de choses qu'aucune formule ne
   predit correctement. Une dizaine de mesures suffit et reste
   imperceptible.

   STYLE tile: it displays no data, it is there to compose a page (title,
   section heading, caption). Combined with the transparent background of
   the universal settings, it lets you title a page with no visible frame
   at all.

   TWO SIZE MODES, and this is the heart of the tile:
     - "fixed": the pixel size is the one in the settings, whatever the
                tile's size. Predictable, but the text overflows if the
                tile is shrunk.
     - "fit"  : the size is recomputed so the text fills the tile without
                overflowing. This is the default, because a title tile is
                almost always resized afterwards, and clipped text is the
                most visible defect there is on a wall board.

   Fitting is done by BINARY SEARCH on the font size, not by a formula:
   the rendered height depends on the font actually available, on the
   number of lines after wrapping and on letter spacing -- none of which
   a formula predicts correctly. About ten measurements are enough and
   stay imperceptible.
   ============================================================ */
(function () {
  "use strict";

  /* Chaque choix liste PLUSIEURS familles : sur un Raspberry Pi, la
     plupart des polices d'un PC sont absentes. Le navigateur prend la
     premiere disponible et retombe, au pire, sur la famille generique
     finale -- jamais sur rien.
     Each choice lists SEVERAL families: on a Raspberry Pi most of a PC's
     fonts are missing. The browser takes the first available one and
     falls back, at worst, on the final generic family -- never on
     nothing. */
  const FONTS = {
    sans: "var(--sans, system-ui), 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif",
    serif: "'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif",
    mono: "var(--mono), 'DejaVu Sans Mono', 'Liberation Mono', monospace",
    condensed: "'DejaVu Sans Condensed', 'Liberation Sans Narrow', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif",
    cursive: "'Comic Sans MS', 'Segoe Script', 'URW Chancery L', cursive"
  };

  const MIN_PX = 6;
  const MAX_PX = 400;

  class TextWidget {
    constructor(ctx) { this.ctx = ctx; }

    init() {
      this.el = document.createElement("div");
      this.el.className = "pw-text";
      this.inner = document.createElement("div");
      this.inner.className = "pw-text-inner";
      this.el.appendChild(this.inner);
      this.ctx.el.appendChild(this.el);
      this.render();

      /* La tuile doit se readapter quand on la redimensionne, y compris
         par un glissement de poignee (aucun evenement de reglage n'est
         alors emis). ResizeObserver est la seule source fiable.
         The tile must re-fit when resized, including by dragging a handle
         (no settings event is emitted then). ResizeObserver is the only
         reliable source. */
      if (typeof ResizeObserver === "function") {
        this.ro = new ResizeObserver(() => this.fit());
        this.ro.observe(this.ctx.el);
      }
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
    }

    onThemeChanged() {
      // Rien a recalculer : la couleur suit les variables CSS du theme,
      // sauf couleur personnalisee, qui elle ne doit pas bouger.
      // Nothing to recompute: the color follows the theme's CSS
      // variables, except a custom color, which must not move.
    }

    render() {
      const s = this.ctx.settings || {};
      const text = String(s.text == null ? "" : s.text);

      this.el.className = "pw-text"
        + " pw-text-h-" + (["left", "center", "right"].includes(s.align) ? s.align : "center")
        + " pw-text-v-" + (["top", "middle", "bottom"].includes(s.valign) ? s.valign : "middle")
        + (s.shadow ? " pw-text-shadow" : "");

      if (!text.trim()) {
        /* Une tuile vide ne doit pas etre une tuile INVISIBLE : sans ce
           texte d'attente, une tuile transparente et sans texte serait
           introuvable sur la page, y compris en mode edition.
           An empty tile must not be an INVISIBLE tile: without this
           placeholder, a transparent tile with no text would be
           impossible to find on the page, edit mode included. */
        this.inner.className = "pw-text-inner pw-text-placeholder";
        this.inner.textContent = this.ctx.i18n.t("text.placeholder");
        this.inner.style.cssText = "";
        return;
      }

      this.inner.className = "pw-text-inner";
      this.inner.textContent = s.uppercase ? text.toLocaleUpperCase(this.ctx.i18n.lang || "fr") : text;
      this.inner.style.fontFamily = FONTS[s.font] || FONTS.sans;
      this.inner.style.fontWeight = String(s.weight || "600");
      this.inner.style.fontStyle = s.italic ? "italic" : "normal";
      this.inner.style.letterSpacing = (Number(s.letterSpacing) || 0) + "px";
      this.inner.style.color = s.useCustomColor && s.color ? s.color : "";
      this.fit();
    }

    fit() {
      const s = this.ctx.settings || {};
      if (!this.inner || !this.inner.textContent) return;
      if (s.sizeMode === "fixed") {
        this.inner.style.fontSize = clamp(Number(s.fontSize) || 32) + "px";
        return;
      }
      const box = this.ctx.el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      this.inner.style.fontSize = fitSize(this.inner, box.width, box.height) + "px";
    }

    destroy() {
      if (this.ro) this.ro.disconnect();
    }
  }

  function clamp(px) {
    return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(px)));
  }

  /* Recherche dichotomique de la plus grande taille qui tient dans la
     boite. `el` doit deja porter la police, la graisse et le texte
     definitifs -- c'est ce rendu-la que l'on mesure, pas une
     approximation.
     Binary search for the largest size that fits in the box. `el` must
     already carry the final font, weight and text -- that rendering is
     what gets measured, not an approximation. */
  function fitSize(el, width, height) {
    let low = MIN_PX;
    let high = MAX_PX;
    let best = MIN_PX;
    for (let i = 0; i < 12 && low <= high; i++) {
      const mid = Math.floor((low + high) / 2);
      el.style.fontSize = mid + "px";
      // scrollWidth/scrollHeight refletent le texte reellement mis en
      // page, retours automatiques compris.
      // scrollWidth/scrollHeight reflect the actually laid out text,
      // automatic wrapping included.
      if (el.scrollHeight <= height && el.scrollWidth <= width) { best = mid; low = mid + 1; }
      else high = mid - 1;
    }
    return best;
  }

  TextWidget.FONTS = FONTS;
  TextWidget._fitSize = fitSize;
  TextWidget._clamp = clamp;

  window.PiBoard.registerWidget("text", TextWidget);
})();
