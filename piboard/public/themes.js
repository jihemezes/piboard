/* ============================================================
   PiBoard - themes.js
   Moteur de themes de couleurs : catalogue livre, calcul des nuances,
   controle de lisibilite, palette tiree d'une image.

   Module PUR : aucune dependance au DOM ni au reseau. Il est charge
   par le navigateur (window.PiBoardThemes) ET par les tests Node
   (module.exports), ce qui permet de verifier hors ligne que CHAQUE
   theme livre reste lisible.

   CE QU'EST UN THEME. Un jeu de « jetons » (couleurs + style) traduits
   en variables CSS. Tout ce que la feuille de style et les widgets
   peignent avec ces variables suit donc le theme, sans toucher aux
   widgets un par un.
     - couleurs : bg, tile, tileEdge, text, muted, faint, accent,
       onAccent, fieldBg, overlay, ok, warn, danger
     - style    : radius (px), border (px), font (cle de FONTS)
   Un theme a une variante `dark` et/ou `light`. Avec les deux, il suit
   le reglage Jour / Nuit / Auto ; avec une seule, il est fixe.

   LE THEME « PiBoard ». C'est le theme d'origine, modifiable : ses
   valeurs par defaut sont celles de toujours, et les couleurs
   personnalisees des versions precedentes (settings.colors) en sont
   desormais les retouches -- rien ne change a la mise a jour.

   NUANCES DERIVEES. Un theme du catalogue ne declare que l'essentiel
   (fond, tuile, texte, accent) ; bordures, textes secondaires, champs
   et voile en sont calcules. Cela garde le catalogue lisible et
   coherent, et l'editeur peut « recalculer les nuances » de la meme
   facon.

   Colour theme engine: shipped catalogue, derived shades, readability
   check, palette extracted from an image. PURE module (no DOM, no
   network), loaded by the browser (window.PiBoardThemes) and by Node
   tests (module.exports), so every shipped theme can be checked offline
   for readability. A theme is a set of tokens (colours + style) turned
   into CSS variables; it has a `dark` and/or `light` variant -- with
   both it follows the Day / Night / Auto setting, with one it is fixed.
   The "PiBoard" theme is the original, editable one; the custom colours
   of earlier versions (settings.colors) are now its tweaks.
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PiBoardThemes = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Couleurs / colours ---------- */

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function parseHex(hex) {
    let c = String(hex || "").trim().replace(/^#/, "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }

  function toHex(rgb) {
    return "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function isHex(v) { return parseHex(v) !== null; }

  /* Melange lineaire en sRGB : t = part de b. / Linear sRGB mix: t = share of b. */
  function mix(a, b, t) {
    const x = parseHex(a), y = parseHex(b);
    if (!x || !y) return a;
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
  }

  /* Luminance relative WCAG 2.x (0 = noir, 1 = blanc). */
  function luminance(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return 0;
    const lin = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function isDark(hex) { return luminance(hex) < 0.18; }

  function rgbToHsl(rgb) {
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l, l, l].map((v) => v * 255);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => v * 255);
  }

  function hsl(hex) { return rgbToHsl(parseHex(hex) || [0, 0, 0]); }
  function fromHsl(h, s, l) { return toHex(hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1))); }

  /* Eclaircit ou assombrit `fg`, en gardant sa teinte, jusqu'a atteindre
     le contraste `min` avec `bg`. On s'eloigne toujours du fond : plus
     clair sur un fond sombre, plus sombre sur un fond clair. Renvoie la
     couleur d'origine si elle suffit deja.
     Lightens or darkens `fg`, keeping its hue, until contrast `min` with
     `bg` is reached -- always moving away from the background. */
  function ensureContrast(fg, bg, min) {
    if (!isHex(fg) || !isHex(bg)) return fg;
    if (contrast(fg, bg) >= min) return toHex(parseHex(fg));
    const [h, s, l0] = hsl(fg);
    const up = luminance(bg) < 0.25;
    for (let i = 1; i <= 50; i++) {
      const l = up ? l0 + (1 - l0) * i / 50 : l0 * (1 - i / 50);
      const c = fromHsl(h, s, l);
      if (contrast(c, bg) >= min) return c;
    }
    return up ? "#FFFFFF" : "#000000";
  }

  /* Texte pose SUR la couleur d'accent : blanc ou noir, le plus lisible.
     Text laid ON the accent colour: white or black, whichever reads best. */
  function onColor(hex) {
    return contrast("#FFFFFF", hex) >= contrast("#111111", hex) ? "#FFFFFF" : "#111111";
  }

  /* ---------- Jetons / tokens ---------- */

  const COLOR_KEYS = ["bg", "tile", "tileEdge", "text", "muted", "faint", "accent",
    "onAccent", "fieldBg", "overlay", "ok", "warn", "danger"];

  /* Variables CSS correspondantes. / Matching CSS variables. */
  const CSS_VARS = {
    bg: "--bg", tile: "--tile", tileEdge: "--tile-edge", text: "--text",
    muted: "--muted", faint: "--faint", accent: "--accent", onAccent: "--on-accent",
    fieldBg: "--field-bg", overlay: "--overlay", ok: "--ok", warn: "--warn", danger: "--danger",
    radius: "--radius", border: "--tile-border-w", font: "--font"
  };

  /* Polices : uniquement des polices INSTALLEES sur la machine, avec des
     replis. Aucun telechargement -- le kiosque doit rester autonome.
     Fonts: only fonts INSTALLED on the machine, with fallbacks. No
     download -- the kiosk must stay self-sufficient. */
  const FONTS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif',
    humanist: '"Segoe UI Variable", "Segoe UI", "Noto Sans", Ubuntu, Cantarell, "DejaVu Sans", sans-serif',
    rounded: 'ui-rounded, "SF Pro Rounded", Nunito, "Varela Round", "Arial Rounded MT Bold", "Comfortaa", system-ui, sans-serif',
    geometric: '"Century Gothic", Futura, "URW Gothic", "URW Gothic L", Avenir, "Avenir Next", "Poppins", sans-serif',
    condensed: '"Roboto Condensed", "Bahnschrift SemiCondensed", "Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", sans-serif',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", "P052", "Noto Serif", Georgia, serif',
    elegant: 'Didot, "Bodoni MT", "Bodoni 72", "Playfair Display", "Libre Baskerville", Baskerville, "Noto Serif Display", Georgia, serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Mono", "DejaVu Sans Mono", "Liberation Mono", monospace'
  };
  const FONT_KEYS = Object.keys(FONTS);

  const DEFAULT_STYLE = { radius: 14, border: 1, font: "system" };

  const STATUS = {
    dark: { ok: "#4CAF7D", warn: "#E0A63C", danger: "#E0556F" },
    light: { ok: "#2E8B57", warn: "#B7791F", danger: "#C0364F" }
  };

  /* Complete une variante a partir de ses couleurs essentielles. Toute
     valeur deja fournie est respectee.
     Completes a variant from its essential colours. Any value already
     given is kept. */
  function derive(partial, tone) {
    const p = Object.assign({}, partial);
    const t = tone || (isDark(p.bg || "#000000") ? "dark" : "light");
    const dark = t === "dark";
    const bg = isHex(p.bg) ? p.bg : (dark ? "#0B0E14" : "#EFEDE7");
    const tile = isHex(p.tile) ? p.tile : (dark ? mix(bg, "#FFFFFF", 0.06) : "#FFFFFF");
    const text = isHex(p.text) ? p.text : (dark ? "#E8ECF4" : "#1B1F2A");
    const accent = isHex(p.accent) ? p.accent : "#D6335C";
    const out = {
      bg, tile, text, accent,
      tileEdge: isHex(p.tileEdge) ? p.tileEdge : mix(tile, text, dark ? 0.1 : 0.13),
      muted: isHex(p.muted) ? p.muted : ensureContrast(mix(text, tile, 0.38), tile, 4.5),
      faint: isHex(p.faint) ? p.faint : ensureContrast(mix(text, tile, 0.6), tile, 2.2),
      onAccent: isHex(p.onAccent) ? p.onAccent : onColor(accent),
      fieldBg: isHex(p.fieldBg) ? p.fieldBg : mix(bg, tile, 0.5),
      overlay: typeof p.overlay === "string" && p.overlay ? p.overlay
        : (dark ? "rgba(" + (parseHex(bg) || [6, 8, 12]).map((v) => Math.round(v * 0.5)).join(", ") + ", 0.72)"
          : "rgba(30, 32, 38, 0.45)")
    };
    for (const k of ["ok", "warn", "danger"]) {
      out[k] = isHex(p[k]) ? p[k] : ensureContrast(STATUS[t][k], tile, 3);
    }
    return out;
  }

  function normalizeStyle(s) {
    const src = s && typeof s === "object" ? s : {};
    const r = Number(src.radius), b = Number(src.border);
    return {
      radius: Number.isFinite(r) ? clamp(Math.round(r), 0, 32) : DEFAULT_STYLE.radius,
      border: Number.isFinite(b) ? clamp(Math.round(b * 2) / 2, 0, 4) : DEFAULT_STYLE.border,
      font: FONT_KEYS.includes(src.font) ? src.font : DEFAULT_STYLE.font
    };
  }

  /* Jetons -> proprietes CSS. / Tokens -> CSS properties. */
  function toCssVars(colors, style) {
    const st = normalizeStyle(style);
    const out = {};
    for (const k of COLOR_KEYS) if (colors[k]) out[CSS_VARS[k]] = colors[k];
    out["--radius"] = st.radius + "px";
    out["--tile-border-w"] = st.border + "px";
    out["--font"] = FONTS[st.font];
    return out;
  }

  /* ---------- Lisibilite / readability ----------
     Seuils WCAG : 4,5 pour le texte courant, 3 pour les grands textes
     et les elements graphiques. `error` bloque l'enregistrement dans
     l'editeur ; `warn` est signale seulement.
     WCAG thresholds: 4.5 for body text, 3 for large text and graphical
     elements. `error` blocks saving in the editor; `warn` is only
     reported. */
  const CHECKS = [
    { id: "textTile", fg: "text", bg: "tile", min: 4.5, level: "error" },
    { id: "textBg", fg: "text", bg: "bg", min: 4.5, level: "error" },
    { id: "onAccent", fg: "onAccent", bg: "accent", min: 4.5, level: "error" },
    { id: "mutedTile", fg: "muted", bg: "tile", min: 3, level: "error" },
    { id: "accentTile", fg: "accent", bg: "tile", min: 2.5, level: "warn" },
    { id: "dangerTile", fg: "danger", bg: "tile", min: 3, level: "warn" },
    { id: "okTile", fg: "ok", bg: "tile", min: 3, level: "warn" },
    { id: "tileBg", fg: "tile", bg: "bg", min: 1.04, level: "warn" }
  ];

  function checkReadability(colors) {
    const issues = [];
    for (const c of CHECKS) {
      const ratio = contrast(colors[c.fg], colors[c.bg]);
      // Tuile de la couleur du fond : acceptable si sa BORDURE la detache.
      // Tile the colour of the background: fine if its BORDER sets it apart.
      if (c.id === "tileBg" && ratio < c.min && contrast(colors.tileEdge, colors.bg) >= 3) continue;
      if (ratio < c.min) issues.push({ id: c.id, level: c.level, ratio: Math.round(ratio * 100) / 100, min: c.min });
    }
    return issues;
  }

  /* Correction automatique : ne touche QUE les couleurs de premier plan,
     jamais les fonds que l'utilisateur a choisis.
     Automatic fix: only touches foreground colours, never the
     backgrounds the user chose. */
  function autoFix(colors) {
    const c = Object.assign({}, colors);
    const ref = contrast(c.text, c.tile) < contrast(c.text, c.bg) ? c.tile : c.bg;
    c.text = ensureContrast(c.text, ref, 4.7);
    const other = ref === c.tile ? c.bg : c.tile;
    if (contrast(c.text, other) < 4.5) c.text = ensureContrast(c.text, other, 4.7);
    c.muted = ensureContrast(c.muted, c.tile, 3.2);
    c.faint = ensureContrast(c.faint, c.tile, 1.8);
    c.onAccent = onColor(c.accent);
    if (contrast(c.onAccent, c.accent) < 4.5) {
      // Accent trop moyen : on le pousse vers le clair ou le sombre.
      // Accent too mid-toned: pushed towards light or dark.
      c.accent = ensureContrast(c.accent, c.onAccent, 4.6);
    }
    c.accent = contrast(c.accent, c.tile) < 2.5 ? ensureContrast(c.accent, c.tile, 2.6) : c.accent;
    c.onAccent = onColor(c.accent);
    for (const k of ["ok", "warn", "danger"]) c[k] = ensureContrast(c[k], c.tile, 3.1);
    if (contrast(c.tile, c.bg) < 1.04) c.tile = mix(c.tile, isDark(c.bg) ? "#FFFFFF" : "#000000", 0.05);
    return c;
  }

  /* ---------- Catalogue / catalogue ----------
     `f` : familles (filtres du selecteur). `m` : fonds de la
     bibliotheque livree auxquels le theme est assorti (nom de fichier
     sans extension). Couleurs mesurees sur les images elles-memes.
     `f`: families (picker filters). `m`: shipped library backgrounds the
     theme matches (file name without extension). Colours measured on
     the images themselves. */
  const FAMILIES = ["dark", "light", "colorful", "pink", "neutral", "mono", "duo", "elegant"];

  const S = (radius, border, font) => ({ radius, border, font });

  const CATALOG = [
    /* --- PiBoard : l'origine, modifiable / the original, editable --- */
    { id: "piboard", n: ["PiBoard", "PiBoard"], f: ["dark", "light"],
      dark: { bg: "#0B0E14", tile: "#141926", tileEdge: "#1E2536", text: "#E8ECF4", muted: "#8B93A7",
        faint: "#565E73", accent: "#D6335C", fieldBg: "#0E1220", overlay: "rgba(6, 8, 12, 0.72)" },
      light: { bg: "#EFEDE7", tile: "#FFFFFF", tileEdge: "#DDD9CF", text: "#1B1F2A", muted: "#6B7180",
        faint: "#A3A8B4", accent: "#D6335C", fieldBg: "#F6F5F1", overlay: "rgba(30, 32, 38, 0.45)" },
      s: S(14, 1, "system") },

    /* --- Sombres / dark --- */
    { id: "midnight", n: ["Minuit", "Midnight"], f: ["dark"],
      dark: { bg: "#070B1A", tile: "#10182E", text: "#E6ECFF", accent: "#5B8CFF" },
      light: { bg: "#E8EDF8", tile: "#FFFFFF", text: "#14203D", accent: "#2F5FD0" }, s: S(14, 1, "system") },
    { id: "slate", n: ["Ardoise", "Slate"], f: ["dark", "neutral"],
      dark: { bg: "#15191E", tile: "#1F252C", text: "#E4E8EC", accent: "#6FA8DC" },
      light: { bg: "#E6E9EC", tile: "#F7F8F9", text: "#1F262E", accent: "#3A6EA5" }, s: S(10, 1, "humanist") },
    { id: "graphite", n: ["Graphite", "Graphite"], f: ["dark", "neutral"],
      dark: { bg: "#111111", tile: "#1C1C1E", text: "#EDEDED", accent: "#FF9F0A" }, s: S(12, 1, "system") },
    { id: "oled", n: ["Noir absolu (OLED)", "Pure black (OLED)"], f: ["dark", "mono"],
      dark: { bg: "#000000", tile: "#0A0A0A", tileEdge: "#262626", text: "#F2F2F2", accent: "#FFFFFF" }, s: S(12, 1, "system") },
    { id: "forest", n: ["Forêt nocturne", "Night forest"], f: ["dark"],
      dark: { bg: "#0B1510", tile: "#13231B", text: "#E3F1E8", accent: "#5CC98A" },
      light: { bg: "#E7F0EA", tile: "#FBFDFB", text: "#15291D", accent: "#267A4B" }, s: S(16, 1, "humanist") },
    { id: "aubergine", n: ["Aubergine", "Aubergine"], f: ["dark"],
      dark: { bg: "#160E1C", tile: "#23172C", text: "#F0E6F5", accent: "#C678DD" },
      light: { bg: "#F1EAF4", tile: "#FFFFFF", text: "#2A1833", accent: "#8E44AD" }, s: S(14, 1, "system") },
    { id: "dracula", n: ["Vampire", "Vampire"], f: ["dark", "colorful"],
      dark: { bg: "#1E1F29", tile: "#282A36", text: "#F8F8F2", muted: "#A5A9C2", accent: "#BD93F9", ok: "#50FA7B", warn: "#F1FA8C", danger: "#FF5555" },
      s: S(10, 1, "system") },

    /* --- Clairs / light --- */
    { id: "paper", n: ["Papier", "Paper"], f: ["light", "neutral"],
      light: { bg: "#F4F1EA", tile: "#FFFDF8", text: "#2B2A26", accent: "#B5522B" },
      dark: { bg: "#1A1916", tile: "#24231F", text: "#EEE9DD", accent: "#E07A4F" }, s: S(6, 1, "serif") },
    { id: "nordic", n: ["Nordique", "Nordic"], f: ["light", "dark"],
      light: { bg: "#ECEFF4", tile: "#FFFFFF", text: "#2E3440", accent: "#5E81AC" },
      dark: { bg: "#2E3440", tile: "#3B4252", text: "#ECEFF4", muted: "#B4BCCB", accent: "#88C0D0" }, s: S(10, 1, "humanist") },
    { id: "linen", n: ["Lin", "Linen"], f: ["light", "neutral", "elegant"],
      light: { bg: "#EEE8DF", tile: "#FAF7F2", text: "#3A332B", accent: "#8C6D4F" }, s: S(8, 1, "serif") },
    { id: "mint", n: ["Menthe", "Mint"], f: ["light"],
      light: { bg: "#E4F4EE", tile: "#FFFFFF", text: "#16332A", accent: "#12A37A" },
      dark: { bg: "#0C1A16", tile: "#132822", text: "#DDF3EB", accent: "#3DD6A6" }, s: S(18, 1, "rounded") },
    { id: "sky", n: ["Ciel", "Sky"], f: ["light"],
      light: { bg: "#E3F0FB", tile: "#FFFFFF", text: "#12314D", accent: "#1E88E5" },
      dark: { bg: "#0A1826", tile: "#11253A", text: "#DDEBF8", accent: "#5AB0FF" }, s: S(16, 1, "rounded") },
    { id: "highcontrast-light", n: ["Contraste élevé clair", "High contrast light"], f: ["light", "mono"],
      light: { bg: "#FFFFFF", tile: "#FFFFFF", tileEdge: "#000000", text: "#000000", muted: "#333333", faint: "#666666", accent: "#0033CC" },
      s: S(4, 2, "system") },

    /* --- Tres colores / vivid --- */
    { id: "neon", n: ["Néon", "Neon"], f: ["colorful", "dark"],
      dark: { bg: "#07060F", tile: "#120F24", tileEdge: "#3B1D6E", text: "#F2EEFF", accent: "#FF2BD6", ok: "#29FFB0", warn: "#FFE14D", danger: "#FF4D6D" },
      s: S(14, 2, "geometric") },
    { id: "synthwave", n: ["Synthwave", "Synthwave"], f: ["colorful", "dark", "pink"],
      dark: { bg: "#1A0B2E", tile: "#2A1248", tileEdge: "#5A2A8C", text: "#FDEBFF", accent: "#FF6AD5", warn: "#FFD166" },
      s: S(12, 1, "geometric") },
    { id: "tropical", n: ["Tropical", "Tropical"], f: ["colorful"],
      dark: { bg: "#032A2B", tile: "#07403F", text: "#E8FFF9", accent: "#FF8A3D" },
      light: { bg: "#DDF6F0", tile: "#FFFFFF", text: "#053B3A", accent: "#E8590C" }, s: S(20, 1, "rounded") },
    { id: "candy", n: ["Bonbon", "Candy"], f: ["colorful", "light", "pink"],
      light: { bg: "#FFE3F3", tile: "#FFFFFF", tileEdge: "#FFB8DF", text: "#4A1545", accent: "#9B30D9" },
      s: S(22, 2, "rounded") },
    { id: "pop", n: ["Pop", "Pop"], f: ["colorful", "light"],
      light: { bg: "#FFD60A", tile: "#FFFFFF", tileEdge: "#111111", text: "#111111", accent: "#E63946" },
      s: S(6, 3, "geometric") },
    { id: "ocean", n: ["Océan", "Ocean"], f: ["colorful"],
      dark: { bg: "#021B35", tile: "#062A52", text: "#E3F2FF", accent: "#00D1FF" },
      light: { bg: "#D8ECFF", tile: "#FFFFFF", text: "#062A52", accent: "#0077C8" }, s: S(16, 1, "humanist") },
    { id: "sunset", n: ["Coucher de soleil", "Sunset"], f: ["colorful", "dark"],
      dark: { bg: "#1C0F1E", tile: "#2E1630", text: "#FFEFE6", accent: "#FF7A45", warn: "#FFC145" },
      light: { bg: "#FFE9DC", tile: "#FFFFFF", text: "#3B1726", accent: "#C23F0C" }, s: S(18, 1, "rounded") },
    { id: "lagoon", n: ["Lagon", "Lagoon"], f: ["colorful", "light"],
      light: { bg: "#C9F2EC", tile: "#F4FFFD", tileEdge: "#7FD8CC", text: "#08343A", accent: "#7A2FE0" },
      s: S(20, 1, "rounded") },

    /* --- Roses / pink --- */
    { id: "powder-pink", n: ["Rose poudré", "Powder pink"], f: ["pink", "light", "elegant"],
      light: { bg: "#F6E6E8", tile: "#FFFAFB", text: "#3D2429", accent: "#A84F68" },
      dark: { bg: "#1E1417", tile: "#2B1D21", text: "#F6E3E7", accent: "#E79AAE" }, s: S(16, 1, "serif") },
    { id: "raspberry", n: ["Framboise", "Raspberry"], f: ["pink", "dark"],
      dark: { bg: "#1A0710", tile: "#2B0D1B", tileEdge: "#4E1831", text: "#FFE8F1", accent: "#FF3D7F" },
      light: { bg: "#FDE7EF", tile: "#FFFFFF", text: "#3F0A21", accent: "#C2185B" }, s: S(14, 1, "system") },
    { id: "flamingo", n: ["Flamant rose", "Flamingo"], f: ["pink", "colorful", "light"],
      light: { bg: "#FF9EC4", tile: "#FFF0F6", tileEdge: "#FF6FA8", text: "#3A0B25", accent: "#B0105A" },
      s: S(24, 2, "rounded") },
    { id: "sakura", n: ["Sakura", "Sakura"], f: ["pink", "light"],
      light: { bg: "#FBEFF3", tile: "#FFFFFF", text: "#352A30", accent: "#D9607F", ok: "#4E8F5B" },
      dark: { bg: "#17121A", tile: "#221A26", text: "#F7E9F0", accent: "#F28CA8" }, s: S(18, 1, "humanist") },
    { id: "pink-noir", n: ["Rose & noir", "Pink & black"], f: ["pink", "duo", "dark"],
      dark: { bg: "#050505", tile: "#121212", tileEdge: "#FF4FA3", text: "#FFFFFF", accent: "#FF4FA3" },
      s: S(8, 2, "geometric") },

    /* --- Neutres / neutral --- */
    { id: "neutral", n: ["Gris neutre", "Neutral grey"], f: ["neutral"],
      dark: { bg: "#1A1A1A", tile: "#242424", text: "#E6E6E6", accent: "#9E9E9E" },
      light: { bg: "#EBEBEB", tile: "#FAFAFA", text: "#1F1F1F", accent: "#616161" }, s: S(10, 1, "system") },
    { id: "sand", n: ["Sable", "Sand"], f: ["neutral", "light"],
      light: { bg: "#E9E1D3", tile: "#F7F2EA", text: "#3B3226", accent: "#A0763C" },
      dark: { bg: "#1D1A15", tile: "#29251E", text: "#EFE6D6", accent: "#D1A366" }, s: S(12, 1, "humanist") },
    { id: "concrete", n: ["Béton", "Concrete"], f: ["neutral"],
      dark: { bg: "#23262A", tile: "#2D3136", text: "#E2E5E8", accent: "#E4572E" },
      light: { bg: "#D9DCDF", tile: "#EEF0F1", text: "#22262A", accent: "#C0391B" }, s: S(2, 1, "condensed") },
    { id: "stone", n: ["Pierre", "Stone"], f: ["neutral", "elegant"],
      dark: { bg: "#1C1B19", tile: "#262522", text: "#E8E4DC", accent: "#B3A07A" },
      light: { bg: "#E4E1DA", tile: "#F5F3EE", text: "#2A2824", accent: "#7A6A48" }, s: S(8, 1, "serif") },

    /* --- Monochromes / monochrome --- */
    { id: "terminal", n: ["Terminal vert", "Green terminal"], f: ["mono", "dark"],
      dark: { bg: "#020A04", tile: "#06140A", tileEdge: "#0F3A1B", text: "#5CFF8A", muted: "#3FBF66", faint: "#237A3E",
        accent: "#5CFF8A", ok: "#5CFF8A", warn: "#C8FF5C", danger: "#FF6B5C" }, s: S(2, 1, "mono") },
    { id: "amber", n: ["Ambre", "Amber"], f: ["mono", "dark"],
      dark: { bg: "#0D0800", tile: "#1A1000", tileEdge: "#4A2F00", text: "#FFB000", muted: "#CC8C00", faint: "#7A5400",
        accent: "#FFB000", ok: "#FFD266", warn: "#FFB000", danger: "#FF6A3D" }, s: S(2, 1, "mono") },
    { id: "mono-blue", n: ["Monochrome bleu", "Blue monochrome"], f: ["mono"],
      dark: { bg: "#06101F", tile: "#0C1C33", tileEdge: "#17345C", text: "#CFE3FF", accent: "#6FA8FF" },
      light: { bg: "#E6EEFA", tile: "#F7FAFF", tileEdge: "#BCD1F0", text: "#0B2A57", accent: "#1F5FBF" }, s: S(12, 1, "system") },
    { id: "bw", n: ["Noir & blanc", "Black & white"], f: ["mono", "duo"],
      dark: { bg: "#000000", tile: "#000000", tileEdge: "#FFFFFF", text: "#FFFFFF", muted: "#BDBDBD", faint: "#7A7A7A", accent: "#FFFFFF" },
      light: { bg: "#FFFFFF", tile: "#FFFFFF", tileEdge: "#000000", text: "#000000", muted: "#424242", faint: "#8A8A8A", accent: "#000000" },
      s: S(0, 2, "geometric") },
    { id: "sepia", n: ["Sépia", "Sepia"], f: ["mono", "light", "elegant"],
      light: { bg: "#EFE2C8", tile: "#F8EFDC", tileEdge: "#D6C29A", text: "#3E2C16", accent: "#8A5A2B" },
      dark: { bg: "#1B140B", tile: "#261C10", text: "#EBD9B8", accent: "#C99A5B" }, s: S(6, 1, "serif") },

    /* --- Bichromes et elegants assortis aux fonds / two-tone and
           elegant themes matching the backgrounds --- */
    { id: "classy-blue", n: ["Bleu royal", "Royal blue"], f: ["elegant", "dark"], m: ["Classy_Blue"],
      dark: { bg: "#0B0C10", tile: "#121E2F", tileEdge: "#01387A", text: "#E6EEF9", accent: "#1A6FD0" }, s: S(10, 1, "elegant") },
    { id: "blue-gold", n: ["Nuit & or", "Night & gold"], f: ["elegant", "duo", "dark"], m: ["Classy_BlueGold"],
      dark: { bg: "#050D1B", tile: "#0C1525", tileEdge: "#3D3325", text: "#F4EAD5", accent: "#DDB462" },
      light: { bg: "#F4EEDF", tile: "#FFFCF4", tileEdge: "#D9C293", text: "#0C1525", accent: "#8A6420" }, s: S(8, 1, "elegant") },
    { id: "burgundy-gold", n: ["Bordeaux & or", "Burgundy & gold"], f: ["elegant", "duo", "dark"], m: ["Classy_BurgundyGold", "Soft_BurgundyGold"],
      dark: { bg: "#190507", tile: "#2D0C10", tileEdge: "#603F36", text: "#F4E0C1", accent: "#CBA782" },
      light: { bg: "#F4E9DD", tile: "#FFFAF3", tileEdge: "#D8BFA0", text: "#3E1218", accent: "#7A2430" }, s: S(8, 1, "elegant") },
    { id: "burned-orange", n: ["Orange brûlé", "Burnt orange"], f: ["elegant", "duo", "dark"], m: ["Classy_BurnedOrange"],
      dark: { bg: "#0E0E0E", tile: "#1E1C1C", tileEdge: "#4C1F0F", text: "#F2E8E2", accent: "#F45F01" }, s: S(10, 1, "geometric") },
    { id: "navy-copper", n: ["Bleu nuit & cuivre", "Navy & copper"], f: ["elegant", "duo", "dark"], m: ["Classy_DarkBlue_Copper"],
      dark: { bg: "#00141F", tile: "#011B28", tileEdge: "#433A31", text: "#F4E4D4", accent: "#D68148" },
      light: { bg: "#EDE3D9", tile: "#FBF7F2", tileEdge: "#CFB59C", text: "#011B28", accent: "#9A4F1F" }, s: S(8, 1, "serif") },
    { id: "gold", n: ["Or", "Gold"], f: ["elegant", "dark"], m: ["Classy_Gold"],
      dark: { bg: "#0B0A0A", tile: "#171716", tileEdge: "#3F2E12", text: "#F3E6C8", accent: "#E6BF51" }, s: S(6, 1, "elegant") },
    { id: "classy-red", n: ["Rouge velours", "Velvet red"], f: ["elegant", "duo", "dark"], m: ["Classy_Red", "Designer (5)", "Soft_Red"],
      dark: { bg: "#0B0A0A", tile: "#171717", tileEdge: "#4C0E10", text: "#F3E9E9", accent: "#D42227" }, s: S(8, 1, "elegant") },
    { id: "slate-copper", n: ["Ardoise & cuivre", "Slate & copper"], f: ["elegant", "duo", "dark"], m: ["Classy_Slate_Copper"],
      dark: { bg: "#100F10", tile: "#1F1A19", tileEdge: "#442F24", text: "#F1E5DC", accent: "#E08541" }, s: S(8, 1, "serif") },
    { id: "warm", n: ["Douceur chaude", "Warm glow"], f: ["elegant", "light"], m: ["Soft_Warm", "Soft_Warm2"],
      light: { bg: "#F2D8B8", tile: "#FFF6EC", tileEdge: "#E3B98E", text: "#3B2415", accent: "#B4531F" },
      dark: { bg: "#1E140D", tile: "#2B1D13", tileEdge: "#5A3A22", text: "#F6E2C7", accent: "#E08A4F" }, s: S(20, 1, "humanist") },
    { id: "acid", n: ["Vert acide", "Acid green"], f: ["duo", "colorful", "dark"], m: ["Sport_AcidGreen"],
      dark: { bg: "#0C0B0C", tile: "#161615", tileEdge: "#4F6411", text: "#F1F6E4", accent: "#A5CA23" }, s: S(4, 2, "condensed") },
    { id: "black-orange", n: ["Noir & orange", "Black & orange"], f: ["duo", "dark"], m: ["Sport_B_BlackOrange"],
      dark: { bg: "#070605", tile: "#18120F", tileEdge: "#8C2D03", text: "#F5EDE8", accent: "#FC7700" }, s: S(4, 2, "condensed") },
    { id: "black-red", n: ["Noir & rouge", "Black & red"], f: ["duo", "dark"], m: ["Sport_BlackRed", "Sport_ST_RedBlack"],
      dark: { bg: "#0E0C0C", tile: "#181616", tileEdge: "#6C0A0D", text: "#F4F2F2", accent: "#DE1A20" }, s: S(4, 2, "condensed") },
    { id: "sport-blue", n: ["Sport bleu glacier", "Glacier sport blue"], f: ["duo", "dark"], m: ["Sport_LightBlue"],
      dark: { bg: "#202021", tile: "#2B2A2C", tileEdge: "#245B61", text: "#EEF3F4", accent: "#00BDCC" }, s: S(4, 2, "condensed") },
    { id: "teal-coral", n: ["Canard & corail", "Teal & coral"], f: ["duo", "colorful"],
      dark: { bg: "#08201F", tile: "#0E302E", text: "#E6F6F3", accent: "#FF7F6B" },
      light: { bg: "#E2F2EF", tile: "#FFFFFF", text: "#0B3431", accent: "#C63F2B" }, s: S(14, 1, "humanist") },
    { id: "violet-lime", n: ["Violet & citron vert", "Violet & lime"], f: ["duo", "colorful", "dark"],
      dark: { bg: "#140A24", tile: "#1F1236", tileEdge: "#3D2466", text: "#F1EAFF", accent: "#B8F23A" }, s: S(14, 1, "geometric") }
  ];

  const BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

  /* Theme complet (variantes derivees), a partir d'une entree du
     catalogue ou d'un theme utilisateur. / Full theme (derived variants)
     from a catalogue entry or a user theme. */
  function build(def) {
    if (!def) return null;
    const out = {
      id: String(def.id),
      name: def.name || { fr: (def.n || [])[0] || def.id, en: (def.n || [])[1] || def.id },
      families: Array.isArray(def.families) ? def.families : (def.f || []),
      matches: Array.isArray(def.matches) ? def.matches : (def.m || []),
      user: !!def.user,
      style: normalizeStyle(def.style || def.s)
    };
    if (def.dark) out.dark = derive(def.dark, "dark");
    if (def.light) out.light = derive(def.light, "light");
    if (!out.dark && !out.light) out.dark = derive({}, "dark");
    return out;
  }

  const BUILTIN = CATALOG.map(build);

  function builtinThemes() { return BUILTIN.slice(); }

  /* Theme PiBoard avec les retouches de l'utilisateur. `overrides` a la
     forme de settings.colors : { dark: {...}, light: {...}, style: {...} }.
     PiBoard theme with the user's tweaks. */
  function piboardTheme(overrides) {
    const o = overrides && typeof overrides === "object" ? overrides : {};
    const base = BY_ID.get("piboard");
    const clean = (v) => {
      const out = {};
      if (v && typeof v === "object") for (const k of COLOR_KEYS) if (k === "overlay" ? typeof v[k] === "string" && v[k] : isHex(v[k])) out[k] = v[k];
      return out;
    };
    return build({
      id: "piboard", n: base.n, f: base.f,
      dark: Object.assign({}, base.dark, clean(o.dark)),
      light: Object.assign({}, base.light, clean(o.light)),
      s: Object.assign({}, base.s, o.style || {})
    });
  }

  /* Nettoyage d'un theme utilisateur (enregistre ou importe).
     Cleaning a user theme (saved or imported). */
  function sanitizeUserTheme(t) {
    if (!t || typeof t !== "object") return null;
    const id = String(t.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
    if (!/^u-/.test(id)) return null;
    const pick = (v) => {
      if (!v || typeof v !== "object") return null;
      const out = {};
      for (const k of COLOR_KEYS) {
        if (k === "overlay") { if (typeof v[k] === "string" && /^rgba?\([\d\s.,]+\)$|^#[0-9a-f]{6}$/i.test(v[k])) out[k] = v[k]; }
        else if (isHex(v[k])) out[k] = toHex(parseHex(v[k]));
      }
      return isHex(out.bg) && isHex(out.tile) && isHex(out.text) ? out : null;
    };
    const dark = pick(t.dark), light = pick(t.light);
    if (!dark && !light) return null;
    const nm = t.name && typeof t.name === "object" ? t.name : { fr: String(t.name || ""), en: String(t.name || "") };
    const label = String(nm.fr || nm.en || "").trim().slice(0, 60) || "Theme";
    const out = { id, user: true, name: { fr: String(nm.fr || label).slice(0, 60), en: String(nm.en || label).slice(0, 60) },
      families: ["user"], style: normalizeStyle(t.style) };
    if (dark) out.dark = dark;
    if (light) out.light = light;
    return out;
  }

  /* Variante a afficher. `mode` : "dark" ou "light" (deja resolu depuis
     Auto). Un theme a variante unique ignore le mode.
     Variant to display. `mode`: "dark" or "light" (already resolved from
     Auto). A single-variant theme ignores the mode. */
  function variant(theme, mode) {
    if (!theme) return null;
    if (mode === "light") return theme.light || theme.dark;
    return theme.dark || theme.light;
  }

  function toneOf(theme, mode) {
    const v = variant(theme, mode);
    return v && isDark(v.bg) ? "dark" : "light";
  }

  /* ---------- Palette tiree d'une image / image palette ----------
     k-moyennes sur les pixels (tableau RGBA a plat, comme ImageData).
     Initialisation deterministe (point le plus eloigne), pour qu'une
     meme image donne toujours le meme theme. Aucune IA : de la
     statistique sur les couleurs.
     k-means over the pixels (flat RGBA array, as ImageData).
     Deterministic initialisation (farthest point), so one image always
     yields the same theme. No AI: plain colour statistics. */
  function extractPalette(data, k) {
    const K = k || 6;
    const px = [];
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (!px.length) return [];
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const mean = [0, 1, 2].map((c) => px.reduce((s, p) => s + p[c], 0) / px.length);
    const centers = [px.reduce((best, p) => (d2(p, mean) < d2(best, mean) ? p : best), px[0]).slice()];
    while (centers.length < K) {
      let far = null, fd = -1;
      for (const p of px) {
        const d = Math.min(...centers.map((c) => d2(p, c)));
        if (d > fd) { fd = d; far = p; }
      }
      if (fd <= 0) break;
      centers.push(far.slice());
    }
    let assign = new Array(px.length).fill(0);
    for (let iter = 0; iter < 12; iter++) {
      assign = px.map((p) => {
        let bi = 0, bd = Infinity;
        centers.forEach((c, i) => { const d = d2(p, c); if (d < bd) { bd = d; bi = i; } });
        return bi;
      });
      const sums = centers.map(() => [0, 0, 0, 0]);
      px.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
      sums.forEach((s, i) => { if (s[3]) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    }
    const counts = centers.map(() => 0);
    assign.forEach((a) => counts[a]++);
    return centers
      .map((c, i) => ({ color: toHex(c), weight: counts[i] / px.length }))
      .filter((c) => c.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }

  /* Theme complet (nuit + jour) a partir d'une palette. Le fond reprend
     la teinte dominante, l'accent la couleur la plus vive qui ressort
     sur les tuiles ; le reste est derive puis corrige.
     Full theme (night + day) from a palette. The background takes the
     dominant hue, the accent the most vivid colour that stands out on
     the tiles; the rest is derived, then fixed. */
  function themeFromPalette(palette, label) {
    const pal = (palette || []).filter((p) => isHex(p.color));
    if (!pal.length) return null;
    const dominant = pal[0].color;
    const [dh, ds] = hsl(dominant);
    const avgLum = pal.reduce((s, p) => s + luminance(p.color) * p.weight, 0);
    const vividness = (p) => { const [, s, l] = hsl(p.color); return s * (1 - Math.abs(l - 0.5) * 1.6) * (0.4 + Math.sqrt(p.weight)); };
    const sorted = pal.slice().sort((a, b) => vividness(b) - vividness(a));
    let accent = sorted[0].color;
    if (hsl(accent)[1] < 0.18) accent = fromHsl(dh + 180, 0.65, 0.55);
    const sat = Math.min(ds, 0.45);

    const darkBg = fromHsl(dh, sat, 0.06);
    const darkTile = fromHsl(dh, sat, 0.11);
    const dark = autoFix(derive({
      bg: darkBg, tile: darkTile, text: fromHsl(dh, Math.min(sat, 0.2), 0.93),
      accent: ensureContrast(accent, darkTile, 3)
    }, "dark"));

    const lightBg = fromHsl(dh, Math.min(sat, 0.35), 0.91);
    const lightTile = fromHsl(dh, Math.min(sat, 0.3), 0.98);
    const light = autoFix(derive({
      bg: lightBg, tile: lightTile, text: fromHsl(dh, Math.min(sat, 0.35), 0.13),
      accent: ensureContrast(accent, lightTile, 3)
    }, "light"));

    return {
      name: { fr: label || "Thème", en: label || "Theme" },
      preferred: avgLum < 0.2 ? "dark" : "light",
      dark, light,
      style: normalizeStyle({ radius: 14, border: 1, font: "system" }),
      palette: pal.map((p) => p.color)
    };
  }

  function findMatching(themes, backgroundFile) {
    const base = String(backgroundFile || "").replace(/\.[a-z0-9]+$/i, "").replace(/-\d+$/, "");
    if (!base) return [];
    return (themes || []).filter((t) => (t.matches || []).some((m) => m.toLowerCase() === base.toLowerCase()));
  }

  return {
    COLOR_KEYS, CSS_VARS, FONTS, FONT_KEYS, FAMILIES, DEFAULT_STYLE,
    parseHex, toHex, isHex, mix, luminance, contrast, isDark, ensureContrast, onColor,
    derive, normalizeStyle, toCssVars, checkReadability, autoFix,
    build, builtinThemes, piboardTheme, sanitizeUserTheme, variant, toneOf,
    extractPalette, themeFromPalette, findMatching
  };
});
