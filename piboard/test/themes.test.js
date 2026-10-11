/* Tests hors ligne de public/themes.js : lisibilite de CHAQUE theme
   livre, calculs de couleurs, palette tiree d'une image, nettoyage des
   themes importes, retouches du theme PiBoard.
   Offline tests of public/themes.js. */
"use strict";

const assert = require("assert");
const T = require("../public/themes.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("== themes ==");

const all = T.builtinThemes();

test("catalogue : au moins 50 themes, identifiants uniques", () => {
  assert.ok(all.length >= 50, String(all.length));
  assert.strictEqual(new Set(all.map((t) => t.id)).size, all.length);
});

test("catalogue : chaque famille demandee est representee", () => {
  for (const f of ["dark", "light", "colorful", "pink", "neutral", "mono", "duo", "elegant"]) {
    assert.ok(all.filter((t) => t.families.includes(f)).length >= 3, f);
  }
});

test("catalogue : chaque theme a un nom FR et EN", () => {
  for (const t of all) assert.ok(t.name.fr && t.name.en, t.id);
});

test("garde-fou : AUCUN theme livre n'a de probleme de lisibilite", () => {
  const bad = [];
  for (const t of all) for (const m of ["dark", "light"]) {
    if (!t[m]) continue;
    const issues = T.checkReadability(t[m]);
    if (issues.length) bad.push(`${t.id}/${m}: ${issues.map((i) => i.id + "=" + i.ratio).join(",")}`);
  }
  assert.deepStrictEqual(bad, []);
});

test("garde-fou : toutes les couleurs derivees sont des hex valides", () => {
  for (const t of all) for (const m of ["dark", "light"]) {
    if (!t[m]) continue;
    for (const k of T.COLOR_KEYS) {
      if (k === "overlay") continue;
      assert.ok(T.isHex(t[m][k]), `${t.id}/${m}/${k}=${t[m][k]}`);
    }
  }
});

test("variantes : un theme sombre fixe reste sombre en mode jour", () => {
  const oled = all.find((t) => t.id === "oled");
  assert.strictEqual(T.toneOf(oled, "light"), "dark");
  const nordic = all.find((t) => t.id === "nordic");
  assert.strictEqual(T.toneOf(nordic, "light"), "light");
  assert.strictEqual(T.toneOf(nordic, "dark"), "dark");
});

test("fonds assortis : tous les fonds colores livres ont un theme", () => {
  const files = ["Classy_Blue", "Classy_BlueGold", "Classy_BurgundyGold", "Classy_BurnedOrange",
    "Classy_DarkBlue_Copper", "Classy_Gold", "Classy_Red", "Classy_Slate_Copper", "Designer (5)",
    "Soft_BurgundyGold", "Soft_Red", "Soft_Warm", "Soft_Warm2", "Sport_AcidGreen",
    "Sport_B_BlackOrange", "Sport_BlackRed", "Sport_LightBlue", "Sport_ST_RedBlack"];
  for (const f of files) assert.ok(T.findMatching(all, f + ".png").length >= 1, f);
});

test("fonds assortis : la copie numerotee (-2) est reconnue", () => {
  assert.strictEqual(T.findMatching(all, "Classy_Blue-2.png")[0].id, "classy-blue");
  assert.deepStrictEqual(T.findMatching(all, "vacances.jpg"), []);
});

test("contraste : valeurs WCAG de reference", () => {
  assert.strictEqual(Math.round(T.contrast("#000000", "#FFFFFF")), 21);
  assert.strictEqual(T.contrast("#777777", "#777777"), 1);
});

test("ensureContrast atteint le seuil en gardant le sens", () => {
  const c = T.ensureContrast("#333333", "#111111", 4.5);
  assert.ok(T.contrast(c, "#111111") >= 4.5);
  assert.ok(T.luminance(c) > T.luminance("#333333"));
  const d = T.ensureContrast("#DDDDDD", "#FFFFFF", 4.5);
  assert.ok(T.contrast(d, "#FFFFFF") >= 4.5);
});

test("autoFix rend lisible un theme illisible sans toucher aux fonds", () => {
  const broken = T.derive({ bg: "#101010", tile: "#181818", text: "#1C1C1C", accent: "#202020" }, "dark");
  broken.muted = "#1A1A1A";
  assert.ok(T.checkReadability(broken).some((i) => i.level === "error"));
  const fixed = T.autoFix(broken);
  assert.ok(!T.checkReadability(fixed).some((i) => i.level === "error"), JSON.stringify(T.checkReadability(fixed)));
  assert.strictEqual(fixed.bg, broken.bg);
  assert.strictEqual(fixed.tile, broken.tile);
});

test("theme PiBoard : sans retouche = l'apparence historique", () => {
  const p = T.piboardTheme(null);
  assert.strictEqual(p.dark.bg, "#0B0E14");
  assert.strictEqual(p.light.tile, "#FFFFFF");
  assert.strictEqual(p.dark.accent, "#D6335C");
  assert.deepStrictEqual(p.style, { radius: 14, border: 1, font: "system" });
});

test("theme PiBoard : les anciennes couleurs perso (settings.colors) s'appliquent", () => {
  const p = T.piboardTheme({ dark: { bg: "#112233", tile: "#223344" }, light: { bg: "#EEEEEE" } });
  assert.strictEqual(p.dark.bg, "#112233");
  assert.strictEqual(p.dark.tile, "#223344");
  assert.strictEqual(p.light.bg, "#EEEEEE");
  assert.strictEqual(p.light.tile, "#FFFFFF");
});

test("theme PiBoard : valeurs invalides ignorees, style retouchable", () => {
  const p = T.piboardTheme({ dark: { bg: "rouge", text: "javascript:x" }, style: { radius: 99, font: "comic" } });
  assert.strictEqual(p.dark.bg, "#0B0E14");
  assert.strictEqual(p.style.radius, 32);
  assert.strictEqual(p.style.font, "system");
});

test("import : un theme valide est nettoye", () => {
  const t = T.sanitizeUserTheme({ id: "u-abc", name: "Test <b>", dark: { bg: "#000", tile: "#111111", text: "#fff", accent: "#ff0000", evil: "x" }, style: { radius: 5 } });
  assert.ok(t);
  assert.strictEqual(t.dark.bg, "#000000");
  assert.strictEqual(t.dark.evil, undefined);
  assert.strictEqual(t.style.radius, 5);
  assert.deepStrictEqual(t.families, ["user"]);
});

test("import : identifiant non perso, couleurs manquantes ou injection refuses", () => {
  assert.strictEqual(T.sanitizeUserTheme({ id: "piboard", dark: { bg: "#000000", tile: "#111111", text: "#FFFFFF" } }), null);
  assert.strictEqual(T.sanitizeUserTheme({ id: "u-x", dark: { bg: "#000000" } }), null);
  const t = T.sanitizeUserTheme({ id: "u-x", dark: { bg: "#000000", tile: "#111111", text: "#FFFFFF", overlay: "red;background:url(x)" } });
  assert.strictEqual(t.dark.overlay, undefined);
  assert.strictEqual(T.sanitizeUserTheme("nope"), null);
});

test("variables CSS : style et polices traduits", () => {
  const v = T.toCssVars(all[0].dark, { radius: 0, border: 2.5, font: "mono" });
  assert.strictEqual(v["--radius"], "0px");
  assert.strictEqual(v["--tile-border-w"], "2.5px");
  assert.ok(/monospace/.test(v["--font"]));
  assert.strictEqual(v["--on-accent"], all[0].dark.onAccent);
});

function pixels(spec) {
  const out = [];
  for (const [rgb, count] of spec) for (let i = 0; i < count; i++) out.push(rgb[0], rgb[1], rgb[2], 255);
  return out;
}

test("palette : couleurs dominantes trouvees, ponderees, ordonnees", () => {
  const pal = T.extractPalette(pixels([[[10, 20, 60], 700], [[240, 120, 20], 200], [[250, 250, 250], 100]]), 4);
  assert.strictEqual(pal[0].color, "#0A143C");
  assert.ok(Math.abs(pal[0].weight - 0.7) < 0.01);
  assert.ok(pal.some((p) => p.color === "#F07814"));
});

test("palette : deterministe et pixels transparents ignores", () => {
  const data = pixels([[[200, 0, 0], 50], [[0, 0, 200], 50]]).concat([0, 255, 0, 0]);
  assert.deepStrictEqual(T.extractPalette(data, 3), T.extractPalette(data, 3));
  assert.ok(!T.extractPalette(data, 3).some((p) => p.color === "#00FF00"));
  assert.deepStrictEqual(T.extractPalette([], 3), []);
});

test("theme depuis image sombre : fond sombre, accent vif, lisible", () => {
  const th = T.themeFromPalette(T.extractPalette(pixels([[[12, 20, 48], 800], [[240, 110, 20], 200]]), 5), "Nuit orange");
  assert.strictEqual(th.preferred, "dark");
  assert.ok(T.isDark(th.dark.bg) && !T.isDark(th.light.bg));
  const [h] = [T.parseHex(th.dark.accent)];
  assert.ok(h[0] > h[2], "accent orange " + th.dark.accent);
  for (const m of ["dark", "light"]) {
    assert.ok(!T.checkReadability(th[m]).some((i) => i.level === "error"), m + JSON.stringify(T.checkReadability(th[m])));
  }
  assert.strictEqual(th.name.fr, "Nuit orange");
});

test("theme depuis image claire et terne : prefere le jour, accent de secours", () => {
  const th = T.themeFromPalette(T.extractPalette(pixels([[[235, 232, 228], 900], [[200, 198, 196], 100]]), 4), "Brume");
  assert.strictEqual(th.preferred, "light");
  assert.ok(!T.checkReadability(th.light).some((i) => i.level === "error"));
  assert.strictEqual(T.themeFromPalette([], "x"), null);
});

test("vraies images livrees : chaque fond donne un theme lisible", () => {
  // Palettes mesurees sur les fonds (voir le catalogue) : evite une
  // dependance a une bibliotheque d'images dans les tests.
  const measured = {
    Classy_Blue: [["#131418", 0.44], ["#080709", 0.38], ["#01387A", 0.13], ["#121E2F", 0.05]],
    Soft_Warm: [["#F1D5AF", 0.8], ["#CE7442", 0.2]],
    Sport_AcidGreen: [["#111110", 0.9], ["#4F6411", 0.1]]
  };
  for (const [name, pal] of Object.entries(measured)) {
    const th = T.themeFromPalette(pal.map(([color, weight]) => ({ color, weight })), name);
    for (const m of ["dark", "light"]) {
      assert.ok(!T.checkReadability(th[m]).some((i) => i.level === "error"), name + "/" + m);
    }
  }
});

console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
