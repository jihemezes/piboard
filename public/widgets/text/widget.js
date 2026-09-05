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
        this.ro = new ResizeObserver(() => this.scheduleFit());
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

    /* Un redimensionnement produit une rafale de mesures, et Gridstack
       redimensionne la tuile PENDANT le glissement de la poignee : la
       toute premiere mesure tombe souvent alors que l'element est encore
       a mi-course, voire de taille nulle. En calculant sur cette
       mesure-la, on figeait une taille de police minuscule que plus rien
       ne venait corriger -- d'ou un texte qui rapetissait au lieu de
       grossir quand on elargissait franchement la tuile.
       On ne garde donc que la DERNIERE mesure de la rafale, et on refait
       un passage a la trame suivante pour rattraper une mise en page qui
       n'etait pas encore stabilisee.

       A resize produces a burst of measurements, and Gridstack resizes
       the tile WHILE the handle is being dragged: the very first
       measurement often lands while the element is still mid-course, or
       even of zero size. Computing on that measurement froze a tiny font
       size that nothing came to correct afterwards -- hence text
       shrinking instead of growing when the tile was widened
       substantially.
       So we keep only the LAST measurement of the burst, and run one
       more pass on the next frame to catch a layout that had not settled
       yet. */
    scheduleFit() {
      if (this.fitPending) return;
      this.fitPending = true;
      const run = () => {
        this.fitPending = false;
        this.fit();
        // Second passage : la taille finale de la tuile n'est parfois
        // connue qu'a la trame suivante. Second pass: the tile's final
        // size is sometimes only known on the next frame.
        requestAnimationFrame(() => this.fit());
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else setTimeout(run, 16);
    }

    fit() {
      const s = this.ctx.settings || {};
      if (!this.inner || !this.inner.textContent) return;
      if (s.sizeMode === "fixed") {
        this.inner.style.fontSize = clamp(Number(s.fontSize) || 32) + "px";
        return;
      }
      const box = this.ctx.el.getBoundingClientRect();
      // Element pas encore en page (page masquee du mode tableau de
      // bord, tuile en cours de montage) : on ne calcule rien plutot que
      // de figer une taille sur une mesure nulle.
      // Element not laid out yet (hidden dashboard page, tile being
      // mounted): compute nothing rather than freeze a size on a zero
      // measurement.
      if (box.width < 2 || box.height < 2) return;
      /* On mesure la place reellement disponible POUR LE TEXTE, pas la
         boite de la tuile : `inner` peut etre en retrait (marges de la
         tuile, titre affiche). Mesurer la tuile entiere surestimait la
         largeur, et le texte pouvait alors deborder.
         We measure the room actually available FOR THE TEXT, not the
         tile's box: `inner` may be inset (tile margins, displayed
         title). Measuring the whole tile overestimated the width, and
         the text could then overflow. */
      const avail = this.el.getBoundingClientRect();
      const width = Math.max(2, (avail.width || box.width));
      const height = Math.max(2, (avail.height || box.height));
      const natural = measureNatural(this.inner.textContent, this.inner.style);
      this.inner.style.fontSize = sizeFor(natural, width, height) + "px";
    }

    destroy() {
      if (this.ro) this.ro.disconnect();
    }
  }

  function clamp(px) {
    return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(px)));
  }

  /* Taille du texte : MESURE puis REGLE DE TROIS, plutot qu'une
     recherche dichotomique sur l'element affiche.

     L'ancienne methode reglait la police, mesurait `scrollHeight` de
     l'element, et recommençait une douzaine de fois. Le probleme est que
     l'element mesure occupe TOUTE la largeur de la tuile : son
     `scrollWidth` vaut donc toujours cette largeur, quelle que soit la
     police, et la mesure de largeur ne contraignait rien. Pire, sa
     hauteur depend du retour a la ligne, lui-meme fonction de la police
     -- une boucle de retour dont la dichotomie sortait souvent sur une
     valeur minuscule, d'ou un texte ridiculement petit qui ne grossissait
     pas quand on elargissait la tuile.

     On mesure desormais le texte UNE fois, a une police de reference,
     dans un element hors flux qui n'est contraint par rien : on obtient
     ses dimensions naturelles. La taille finale est le simple rapport
     entre la place disponible et ces dimensions. C'est exact du premier
     coup, sans boucle, et la taille croit strictement avec la tuile.

     Text size: MEASURE then RULE OF THREE, rather than a binary search
     on the displayed element.

     The old method set the font, measured the element's `scrollHeight`,
     and started over a dozen times. The trouble is that the measured
     element spans the tile's FULL width: its `scrollWidth` therefore
     always equals that width whatever the font, and the width
     measurement constrained nothing. Worse, its height depends on
     wrapping, itself a function of the font -- a feedback loop the
     bisection often exited on a tiny value, hence ridiculously small
     text that did not grow when the tile was widened.

     We now measure the text ONCE, at a reference font size, in an
     out-of-flow element constrained by nothing: that gives its natural
     dimensions. The final size is the plain ratio between the available
     room and those dimensions. Exact on the first try, no loop, and the
     size grows strictly with the tile. */
  const REFERENCE_PX = 100;

  /* Dimensions naturelles du texte a REFERENCE_PX. L'element de mesure
     copie les proprietes qui changent la largeur du rendu (police,
     graisse, style, espacement) : en oublier une donnerait un rapport
     fausse. `white-space: pre` conserve les retours a la ligne saisis
     sans en ajouter d'autres -- c'est ce qui rend la mesure independante
     de la largeur de la tuile.
     Natural dimensions of the text at REFERENCE_PX. The measuring
     element copies the properties that change the rendered width (font,
     weight, style, spacing): forgetting one would skew the ratio.
     `white-space: pre` keeps the typed line breaks without adding any --
     that is what makes the measurement independent of the tile width. */
  function measureNatural(text, style) {
    const probe = document.createElement("span");
    probe.textContent = text;
    probe.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;"
      + "white-space:pre;display:inline-block;line-height:1.15;";
    probe.style.fontFamily = style.fontFamily;
    probe.style.fontWeight = style.fontWeight;
    probe.style.fontStyle = style.fontStyle;
    probe.style.letterSpacing = style.letterSpacing;
    probe.style.fontSize = REFERENCE_PX + "px";
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();
    return { w: rect.width, h: rect.height };
  }

  function sizeFor(natural, width, height) {
    if (!natural || natural.w <= 0 || natural.h <= 0) return MIN_PX;
    // Le plus contraignant des deux rapports : le texte doit tenir en
    // largeur ET en hauteur. The more constraining of the two ratios:
    // the text must fit in width AND in height.
    const ratio = Math.min(width / natural.w, height / natural.h);
    return clamp(REFERENCE_PX * ratio);
  }

  TextWidget.FONTS = FONTS;
  TextWidget._sizeFor = sizeFor;
  TextWidget._REFERENCE_PX = REFERENCE_PX;
  TextWidget._clamp = clamp;

  window.PiBoard.registerWidget("text", TextWidget);
})();
