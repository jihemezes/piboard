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

  /* ---------- Effets (1.158.0) ----------
     La tuile reprend les effets de la tuile Logo / Image (animations 3D,
     respiration, flottement, brillance, halo ; miroir, rotation,
     opacite) et en ajoute qui n'ont de sens que pour un texte : machine
     a ecrire, arrivee des lettres, vague, degrade anime, bandeau
     defilant, alternance de messages ; neon, contour, texte creux et
     relief 3D.

     UNE SEULE ANIMATION A LA FOIS, choisie dans une liste : les
     combiner donnerait des conflits (une seule propriete `animation`
     par element) et des rendus que personne n'a voulus.

     LA STRUCTURE PORTE CHAQUE EFFET SUR SON PROPRE ELEMENT, pour que
     leurs `transform`, `filter` et `animation` ne s'ecrasent jamais :
       .pw-text           opacite
         .pw-text-orient  miroir + rotation, filtre statique, scintillement
           .pw-text-inner animation de l'ensemble (rotation 3D, respiration,
                          flottement, halo, degrade, brillance)
             lettres / piste / messages : animations propres a chaque mode

     Effects (1.158.0). The tile carries over the Logo / Image tile's
     effects and adds ones that only make sense for text. ONE ANIMATION
     AT A TIME, picked from a list. EACH EFFECT LIVES ON ITS OWN ELEMENT so
     transforms, filters and animations never overwrite one another. */
  const ANIMS = new Set(["none", "typewriter", "arrive", "wave", "gradient", "marquee", "cycle",
    "spinY", "spinX", "breathe", "float", "shine", "glow"]);
  const LETTER_ANIMS = new Set(["typewriter", "arrive", "wave"]);
  /* Ces deux animations peignent le texte par son FOND (`background-clip:
     text`) : les ombres doivent alors passer par `filter`, un
     `text-shadow` se verrait a travers les lettres transparentes.
     These two paint the text through its BACKGROUND: shadows must use
     `filter`, a `text-shadow` would show through the transparent
     letters. */
  const CLIP_ANIMS = new Set(["gradient", "shine"]);
  const ARRIVE_STYLES = ["rise", "drop", "zoom", "fade", "flip"];
  const ROTATIONS = new Set([0, 90, 180, 270]);
  const DROP_SHADOW = "0 2px 6px rgba(0, 0, 0, 0.55)";
  const RAINBOW = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#32ade6", "#5e5ce6", "#bf5af2"];
  const EXTRUDE_DIRS = { br: [1, 1], bl: [-1, 1], b: [0, 1], tr: [1, -1] };

  function clampRotate(v) {
    const n = Number(v);
    return ROTATIONS.has(n) ? n : 0;
  }

  function clampNum(v, min, max, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }

  /* Un message = une ligne non vide. Pour l'alternance de messages.
     A message = one non-empty line. For the message rotation. */
  function splitMessages(text) {
    return String(text == null ? "" : text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  /* Le bandeau defile sur UNE ligne : les retours saisis deviennent un
     separateur. A marquee scrolls on ONE line: typed line breaks become a
     separator. */
  function marqueeText(text) {
    return splitMessages(text).join("   •   ");
  }

  /* Miroir + rotation en une chaine `transform`. Le miroir est place
     AVANT la rotation dans la liste CSS, donc applique en dernier : il
     retourne le texte tel qu'on le voit a l'ecran, comme pour l'image.
     Quand la rotation est de 90 ou 270 degres, la boite est centree
     (translate) car ses dimensions sont echangees par fit().
     Mirror + rotation as one `transform` string. The mirror comes BEFORE
     the rotation, so it is applied last: it flips the text as seen on
     screen, as for the image. */
  function orientTransform(s) {
    const rot = clampRotate(s.rotate);
    const sx = s.flipH ? -1 : 1, sy = s.flipV ? -1 : 1;
    const parts = [];
    if (rot === 90 || rot === 270) parts.push("translate(-50%, -50%)");
    if (sx !== 1 || sy !== 1) parts.push("scale(" + sx + ", " + sy + ")");
    if (rot) parts.push("rotate(" + rot + "deg)");
    return parts.join(" ");
  }

  /* Halo de neon : quatre couches dont le rayon est en `em`, donc
     proportionnel a la taille du texte quelle qu'elle soit.
     Neon halo: four layers sized in `em`, hence proportional to the
     text size whatever it is. */
  function neonLayers() {
    return ["0 0 .04em var(--pwt-c)", "0 0 .12em var(--pwt-c)", "0 0 .3em var(--pwt-c)", "0 0 .65em var(--pwt-c)"];
  }

  /* Relief : une pile d'ombres pleines decalees d'un pixel, de plus en
     plus loin, qui forme l'epaisseur du texte.
     Relief: a stack of solid shadows offset by one pixel each, which
     forms the text's thickness. */
  function extrudeLayers(depthPx, dir) {
    const d = Math.max(0, Math.min(40, Math.round(depthPx)));
    const [dx, dy] = EXTRUDE_DIRS[dir] || EXTRUDE_DIRS.br;
    const out = [];
    for (let i = 1; i <= d; i++) out.push((dx * i) + "px " + (dy * i) + "px 0 var(--pwt-ex)");
    return out;
  }

  /* Degrade PERIODIQUE : la suite de couleurs est repetee sur la seconde
     moitie de l'image, qui fait 200 % de la largeur. Decaler le fond de
     100 % (une largeur d'element) revient alors EXACTEMENT a un
     periode : la boucle est sans couture.
     PERIODIC gradient: the colour list is repeated on the second half of
     the image, which is 200% wide. Shifting the background by 100% (one
     element width) is then EXACTLY one period: the loop has no seam. */
  function gradientCss(palette, a, b) {
    let cols;
    if (palette === "rainbow") cols = RAINBOW.slice();
    else if (palette === "custom") cols = [a || "#4cc9f0", b || "#f72585"];
    else cols = ["var(--accent)", "color-mix(in srgb, var(--accent) 40%, #ffffff)"];
    const list = cols.concat([cols[0]]);
    const stops = [];
    for (let half = 0; half < 2; half++) {
      list.forEach((c, i) => {
        stops.push(c + " " + (half * 50 + (i / (list.length - 1)) * 50).toFixed(2) + "%");
      });
    }
    return "linear-gradient(90deg, " + stops.join(", ") + ")";
  }

  function prefersReducedMotion() {
    try {
      return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  /* Decoupe en lettres (graphemes quand le navigateur sait le faire, pour
     ne pas separer une lettre de son accent). Les espaces et les retours
     restent des noeuds texte : ils ne s'animent pas, mais comptent dans
     le rythme.
     Splits into letters (graphemes where the browser can, so a letter is
     never parted from its accent). Spaces and line breaks stay text
     nodes: they do not animate but count in the rhythm. */
  function graphemes(text) {
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (x) => x.segment);
      }
    } catch (e) { /* repli / fallback */ }
    return Array.from(text);
  }

  function buildLetters(host, text, reverse) {
    const chars = graphemes(text);
    const n = chars.length;
    let lastLetter = -1;
    chars.forEach((c, i) => { if (!/^\s+$/.test(c)) lastLetter = i; });
    const frag = document.createDocumentFragment();
    chars.forEach((c, i) => {
      if (/^\s+$/.test(c)) { frag.appendChild(document.createTextNode(c)); return; }
      const span = document.createElement("span");
      span.className = "pw-text-ch" + (i === lastLetter ? " pw-text-last" : "");
      span.style.setProperty("--i", String(reverse ? n - 1 - i : i));
      span.textContent = c;
      frag.appendChild(span);
    });
    host.appendChild(frag);
    return n;
  }

  class TextWidget {
    constructor(ctx) { this.ctx = ctx; this.timers = []; this.kind = "none"; this.plain = ""; }

    init() {
      this.el = document.createElement("div");
      this.el.className = "pw-text";
      this.orient = document.createElement("div");
      this.orient.className = "pw-text-orient";
      this.inner = document.createElement("div");
      this.inner.className = "pw-text-inner";
      this.orient.appendChild(this.inner);
      this.el.appendChild(this.orient);
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

    later(fn, ms) { this.timers.push(setTimeout(fn, Math.max(0, ms))); }

    clearTimers() {
      for (const t of this.timers) clearTimeout(t);
      this.timers = [];
    }

    /* « Pause au survol » : les animations CSS s'arretent d'elles-memes
       (voir le CSS) ; les chronometres de cette tuile attendent aussi.
       "Pause on hover": CSS animations stop by themselves; this tile's
       timers wait as well. */
    held() {
      try {
        return this.el.classList.contains("pw-text-pausable") && this.el.matches(":hover, :active");
      } catch (e) { return false; }
    }

    render() {
      const s = this.ctx.settings || {};
      const text = String(s.text == null ? "" : s.text);
      const upper = s.uppercase ? text.toLocaleUpperCase(this.ctx.i18n.lang || "fr") : text;
      this.clearTimers();

      const rotate = clampRotate(s.rotate);
      const turned = rotate === 90 || rotate === 270;
      const outlineMode = s.outline === "outline" || s.outline === "hollow" ? s.outline : "none";
      const reduced = prefersReducedMotion();
      let kind = ANIMS.has(s.anim) ? s.anim : "none";
      if (reduced) kind = "none";
      /* Un texte creux n'a pas de fond a peindre : il ne peut donc pas
         recevoir un degrade ni une brillance.
         Hollow text has no fill to paint: no gradient or shine on it. */
      if (outlineMode === "hollow" && CLIP_ANIMS.has(kind)) kind = "none";
      const messages = kind === "cycle" ? splitMessages(upper) : null;
      if (kind === "cycle" && messages.length < 2) kind = "none";
      this.kind = kind;
      this.messages = messages;

      this.el.className = "pw-text"
        + " pw-text-h-" + (["left", "center", "right"].includes(s.align) ? s.align : "center")
        + " pw-text-v-" + (["top", "middle", "bottom"].includes(s.valign) ? s.valign : "middle")
        + (kind !== "none" ? " pw-text-anim pw-text-anim-" + kind : "")
        + (kind !== "none" && s.animPause ? " pw-text-pausable" : "");

      const op = clampNum(s.opacity, 10, 100, 100);
      this.el.style.opacity = op < 100 ? String(op / 100) : "";
      this.orient.className = "pw-text-orient" + (turned ? " pw-text-turned" : "")
        + (s.neon === "flicker" && !reduced ? " pw-text-flicker" : "");
      this.orient.style.transform = orientTransform(s);
      if (!turned) { this.orient.style.width = ""; this.orient.style.height = ""; }
      this.orient.style.filter = "";

      if (!text.trim()) {
        /* Une tuile vide ne doit pas etre une tuile INVISIBLE : sans ce
           texte d'attente, une tuile transparente et sans texte serait
           introuvable sur la page, y compris en mode edition.
           An empty tile must not be an INVISIBLE tile: without this
           placeholder, a transparent tile with no text would be
           impossible to find on the page, edit mode included. */
        this.plain = "";
        this.kind = "none";
        this.el.className = "pw-text pw-text-h-center pw-text-v-middle";
        this.orient.style.transform = "";
        this.inner.className = "pw-text-inner pw-text-placeholder";
        this.inner.textContent = this.ctx.i18n.t("text.placeholder");
        this.inner.style.cssText = "";
        return;
      }

      this.plain = kind === "marquee" ? marqueeText(upper) : upper;
      const clip = CLIP_ANIMS.has(kind);
      this.inner.className = "pw-text-inner" + (clip ? " pw-text-clip" : "");
      this.inner.style.cssText = "";
      this.inner.textContent = "";
      this.inner.style.fontFamily = FONTS[s.font] || FONTS.sans;
      this.inner.style.fontWeight = String(s.weight || "600");
      this.inner.style.fontStyle = s.italic ? "italic" : "normal";
      this.inner.style.letterSpacing = (Number(s.letterSpacing) || 0) + "px";
      /* Trois couleurs possibles, dans cet ordre de priorite :
            1. couleur personnalisee -- un choix explicite et chiffre, il
               doit l'emporter sur tout le reste ;
            2. accent du theme -- var(--accent), donc recalculee par le
               navigateur a chaque changement de theme et a la bascule
               jour/nuit, sans que ce widget ait rien a refaire (c'est
               pourquoi onThemeChanged() n'a toujours rien a recalculer) ;
            3. rien -- heritage de var(--text), le comportement
               historique et le defaut.
         L'accent passe par la VARIABLE et non par sa valeur resolue :
         figer la couleur ici la laisserait en arriere au premier
         changement de theme, et c'est exactement le defaut qu'on vient
         corriger.
         Three possible colors, in priority order: an explicit custom
         color wins; otherwise the theme's accent, referenced through the
         CSS VARIABLE so the browser recomputes it on every theme change
         and day/night switch -- freezing its resolved value here would
         leave it behind on the first theme change, the very fault being
         fixed; otherwise nothing, inheriting var(--text) as before. */
      this.inner.style.color = s.useCustomColor && s.color
        ? s.color
        : (s.useAccentColor ? "var(--accent)" : "");
      /* La couleur du texte, nommee une fois pour tous les effets (halo,
         relief, brillance, curseur) : variable CSS, donc toujours a jour.
         The text colour, named once for every effect (halo, relief,
         shine, caret): a CSS variable, so always up to date. */
      this.el.style.setProperty("--pwt-c", s.useCustomColor && s.color ? s.color
        : (s.useAccentColor ? "var(--accent)" : "var(--text)"));
      this.el.style.setProperty("--pwt-ex", "color-mix(in srgb, var(--pwt-c) 45%, #000000)");

      const dur = clampNum(s.animSeconds, 1, 120, 8);
      const reverse = s.animDir === "reverse";
      this.inner.style.setProperty("--pwt-dur", dur + "s");
      this.inner.style.setProperty("--pwt-dir", reverse ? "reverse" : "normal");
      this.inner.style.setProperty("--pwt-alt", reverse ? "alternate-reverse" : "alternate");
      this.applyPerspective(s);

      if (LETTER_ANIMS.has(kind)) {
        const n = buildLetters(this.inner, upper, reverse);
        const count = Math.max(1, n);
        const loop = s.animLoop !== false;
        if (kind === "typewriter") {
          this.inner.style.setProperty("--pwt-step", (dur * 0.6 / count) + "s");
          this.startRun(loop, dur * 1000);
        } else if (kind === "arrive") {
          const style = ARRIVE_STYLES.includes(s.arriveStyle) ? s.arriveStyle : "rise";
          this.inner.style.setProperty("--pwt-step", (dur * 0.55 / count) + "s");
          this.inner.style.setProperty("--pwt-ld", Math.max(0.3, Math.min(0.9, dur * 0.25)) + "s");
          this.inner.style.setProperty("--pwt-arr", "pwtx-" + style);
          this.startRun(loop, dur * 1000);
        } else {
          this.inner.style.setProperty("--pwt-step", (dur / Math.max(count, 8)) + "s");
        }
      } else if (kind === "marquee") {
        this.buildMarquee(2);
      } else if (kind === "cycle") {
        this.buildCycle(messages, dur * 1000, reverse);
      } else {
        this.inner.textContent = upper;
      }
      if (clip) {
        this.inner.style.backgroundImage = kind === "gradient"
          ? gradientCss(s.gradPalette, s.gradColorA, s.gradColorB) : "";
      }
      this.fit();
    }

    /* Perspective des rotations 3D, proportionnelle a la LARGEUR de la
       tuile (comme pour l'image) : une perspective fixe en pixels serait
       violente sur une petite tuile et invisible sur une grande.
       Perspective of the 3D rotations, proportional to the tile's
       width, as for the image. */
    applyPerspective(s) {
      const level = ["off", "light", "medium", "strong"].includes(s.animPersp) ? s.animPersp : "medium";
      const factor = { light: 6, medium: 3, strong: 1.8 }[level];
      const fit = { off: 1, light: 0.95, medium: 0.88, strong: 0.78 }[level];
      const w = Math.max(120, (this.el && this.el.clientWidth) || 400);
      this.inner.style.setProperty("--pwt-persp", level === "off" ? "scale(1)" : "perspective(" + Math.round(w * factor) + "px)");
      this.inner.style.setProperty("--pwt-fit", String(fit));
    }

    /* Machine a ecrire et arrivee des lettres : une « passe » rejouee
       en boucle. La passe revele les lettres, le texte reste affiche,
       puis s'efface en fondu avant la passe suivante : sans ce fondu, le
       texte disparaitrait d'un coup. Sans boucle, une seule passe.
       Typewriter and letter arrival: a "run" replayed in a loop. The run
       reveals the letters, the text holds, then fades out before the next
       run. Without the loop, a single run. */
    startRun(loop, durMs) {
      const inner = this.inner;
      const go = () => {
        inner.classList.remove("pw-text-out", "pw-text-run");
        void inner.offsetWidth;
        inner.classList.add("pw-text-run");
        if (loop) {
          this.later(() => inner.classList.add("pw-text-out"), durMs * 0.9);
          this.later(wait, durMs);
        }
      };
      const wait = () => { if (this.held()) this.later(wait, 300); else go(); };
      go();
    }

    buildMarquee(copies) {
      const track = document.createElement("div");
      track.className = "pw-text-track";
      for (let i = 0; i < copies; i++) {
        const item = document.createElement("span");
        item.className = "pw-text-mq";
        item.textContent = this.plain;
        track.appendChild(item);
      }
      this.inner.textContent = "";
      this.inner.appendChild(track);
    }

    /* Le bandeau doit etre AU MOINS deux fois plus large que la tuile,
       sinon un trou apparait pendant le defilement : on mesure un
       element, puis on en met autant de copies qu'il en faut. La vitesse
       est celle de « traverser la tuile en N secondes » : un texte long
       ne file donc pas plus vite qu'un court.
       The marquee must be AT LEAST twice as wide as the tile, otherwise a
       gap shows while scrolling: one item is measured, then as many
       copies as needed are laid. Speed is "crossing the tile in N
       seconds": a long text does not run faster than a short one. */
    setupMarquee() {
      const track = this.inner.firstChild;
      if (!track || !track.firstChild) return;
      const item = track.firstChild.getBoundingClientRect();
      const box = this.el.getBoundingClientRect();
      const turned = this.orient.classList.contains("pw-text-turned");
      const room = turned ? box.height : box.width;
      if (!(item.width > 1) || !(room > 1)) return;
      const copies = Math.max(2, Math.min(24, Math.ceil(room / item.width) + 1));
      if (track.childNodes.length !== copies) {
        this.buildMarquee(copies);
      }
      const secs = clampNum((this.ctx.settings || {}).animSeconds, 1, 120, 8);
      this.inner.style.setProperty("--pwt-shift", item.width + "px");
      this.inner.style.setProperty("--pwt-mqdur", Math.max(1, secs * item.width / room) + "s");
    }

    /* Alternance de messages : tous les messages sont empiles dans la
       meme cellule d'une grille (la boite a donc la taille du plus
       grand) et un seul est opaque ; on passe de l'un a l'autre par un
       fondu.
       Message rotation: all messages are stacked in the same grid cell
       (so the box is as large as the largest) and only one is opaque;
       they cross-fade. */
    buildCycle(messages, ms, reverse) {
      const wrap = document.createElement("div");
      wrap.className = "pw-text-msgs";
      messages.forEach((m, i) => {
        const d = document.createElement("div");
        d.className = "pw-text-msg" + (i === 0 ? " pw-text-msg-on" : "");
        d.textContent = m;
        wrap.appendChild(d);
      });
      this.inner.appendChild(wrap);
      let idx = 0;
      const next = () => {
        if (this.held()) { this.later(next, 300); return; }
        const items = wrap.children;
        items[idx].classList.remove("pw-text-msg-on");
        idx = (idx + (reverse ? items.length - 1 : 1)) % items.length;
        items[idx].classList.add("pw-text-msg-on");
        this.later(next, ms);
      };
      this.later(next, ms);
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

    /* Rotation de 90 ou 270 degres : la boite qui porte le texte prend
       les dimensions ECHANGEES de la tuile, puis tourne ; le texte est
       donc calcule pour la place qu'il occupera reellement a l'ecran.
       A 90 or 270 degree rotation: the box carrying the text takes the
       tile's SWAPPED dimensions, then turns; the text is sized for the
       room it will really occupy on screen. */
    fit() {
      const s = this.ctx.settings || {};
      if (!this.inner || !this.plain) return;
      const turned = this.orient.classList.contains("pw-text-turned");
      const avail = this.el.getBoundingClientRect();
      if (turned && avail.width >= 2 && avail.height >= 2) {
        this.orient.style.width = avail.height + "px";
        this.orient.style.height = avail.width + "px";
      }
      if (s.sizeMode === "fixed") {
        this.afterSize(clamp(Number(s.fontSize) || 32));
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
      let width = Math.max(2, (avail.width || box.width));
      let height = Math.max(2, (avail.height || box.height));
      if (turned) { const t = width; width = height; height = t; }
      /* Le contour et le relief debordent des lettres : on leur reserve
         de la place, proportionnelle a la taille (ils sont en %).
         Outline and relief spill beyond the letters: room is reserved,
         proportional to the size (they are in %). */
      const ow = s.outline === "outline" || s.outline === "hollow" ? clampNum(s.outlineWidth, 0.5, 15, 3) / 2 : 0;
      const ex = this.kind !== "none" && (CLIP_ANIMS.has(this.kind)) ? 0 : clampNum(s.extrude, 0, 15, 0);
      const k = (ow + ex) / 100;
      const style = this.inner.style;
      const sizeOne = (text) => {
        const nat = measureNatural(text, style);
        return sizeFor({ w: nat.w + 2 * k * REFERENCE_PX, h: nat.h + 2 * k * REFERENCE_PX }, width, height);
      };
      let px;
      if (this.kind === "marquee") {
        /* Une seule ligne qui defile : seule la HAUTEUR contraint.
           A single scrolling line: only the HEIGHT constrains. */
        px = Math.floor(sizeFor({ w: 1, h: measureNatural(this.plain, style).h + 2 * k * REFERENCE_PX }, 1e9, height) * 0.85);
      } else if (this.kind === "cycle" && this.messages) {
        px = Math.min.apply(null, this.messages.map(sizeOne));
      } else {
        px = sizeOne(this.plain);
      }
      /* Des lettres separees perdent un peu de crenage : un peu de marge.
         Separate letters lose a little kerning: a little margin. */
      if (LETTER_ANIMS.has(this.kind)) px = Math.max(MIN_PX, Math.floor(px * 0.96));
      this.afterSize(px);
    }

    afterSize(px) {
      this.inner.style.fontSize = px + "px";
      this.effects(px);
      if (this.kind === "marquee") this.setupMarquee();
    }

    /* Ombre, neon, relief et contour. Le relief depend de la taille en
       pixels : il est donc recalcule a chaque ajustement.
       Shadow, neon, relief and outline. The relief depends on the size
       in pixels, so it is recomputed at every fit. */
    effects(px) {
      const s = this.ctx.settings || {};
      const st = this.inner.style;
      const outlineMode = s.outline === "outline" || s.outline === "hollow" ? s.outline : "none";
      const hollow = outlineMode === "hollow";
      const useFilter = CLIP_ANIMS.has(this.kind) || hollow;
      const neon = s.neon === "steady" || s.neon === "flicker";
      const depth = useFilter ? 0 : Math.round(px * clampNum(s.extrude, 0, 15, 0) / 100);

      st.webkitTextStroke = "";
      st.paintOrder = "";
      st.webkitTextFillColor = "";
      if (outlineMode === "outline") {
        st.webkitTextStroke = (clampNum(s.outlineWidth, 0.5, 15, 3) / 100) + "em " + (s.outlineColor || "#000000");
        st.paintOrder = "stroke fill";
      } else if (hollow) {
        st.webkitTextStroke = (clampNum(s.outlineWidth, 0.5, 15, 3) / 100) + "em var(--pwt-c)";
        st.webkitTextFillColor = "transparent";
      }

      if (useFilter) {
        const f = [];
        if (neon) {
          f.push("drop-shadow(0 0 .06em var(--pwt-c))", "drop-shadow(0 0 .2em var(--pwt-c))", "drop-shadow(0 0 .5em var(--pwt-c))");
        }
        if (s.shadow) f.push("drop-shadow(" + DROP_SHADOW + ")");
        st.textShadow = "none";
        this.orient.style.filter = f.join(" ");
        this.el.classList.remove("pw-text-shadow");
      } else {
        const layers = [];
        if (neon) layers.push.apply(layers, neonLayers());
        if (depth > 0) layers.push.apply(layers, extrudeLayers(depth, s.extrudeDir));
        if (s.shadow) layers.push(DROP_SHADOW);
        const custom = neon || depth > 0;
        st.textShadow = custom ? layers.join(", ") : "";
        this.orient.style.filter = "";
        this.el.classList.toggle("pw-text-shadow", !!s.shadow && !custom);
      }
    }

    destroy() {
      this.clearTimers();
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
  TextWidget.ANIMS = ANIMS;
  TextWidget._splitMessages = splitMessages;
  TextWidget._marqueeText = marqueeText;
  TextWidget._gradientCss = gradientCss;
  TextWidget._neonLayers = neonLayers;
  TextWidget._extrudeLayers = extrudeLayers;
  TextWidget._orientTransform = orientTransform;
  TextWidget._sizeFor = sizeFor;
  TextWidget._REFERENCE_PX = REFERENCE_PX;
  TextWidget._clamp = clamp;

  window.PiBoard.registerWidget("text", TextWidget);
})();
