/* Test de la GRILLE INTERNE des tuiles (1.151.0).

   Ce test est FONCTIONNEL : il appuie sur la barre d'un bloc, glisse,
   relache, et regarde ou le bloc a atterri -- il ne se contente pas de
   verifier qu'un ecouteur existe. Les decisions verifiees :

   1. RIEN NE BOUGE HORS EDITION. Un tableau mural qui se reagence quand
      on l'effleure est un tableau casse.
   2. LA GRILLE EST AIMANTEE : un glissement de 2,4 cases pose le bloc a
      2 cases, jamais entre deux.
   3. PAS DE CHEVAUCHEMENT : un bloc pose sur un autre echange sa place
      avec lui ; s'il n'y a de place nulle part, le geste est annule.
   4. LA TUILE NE PART PAS AVEC LE BLOC : le geste commence sur la barre
      du bloc ne remonte pas jusqu'a la tuile (Gridstack la
      deplacerait), ni le clic (il ouvrirait ses reglages).
   5. UNE DISPOSITION ENREGISTREE N'EST JAMAIS CRUE SUR PAROLE : blocs
      superposes ou hors grille sont repares.
   6. Masquer, rajouter, dispositions predefinies, copier-coller, moment
      (saison / week-end) et ajustement du texte. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const PUB = path.join(__dirname, "..", "public");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
  runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/"
});
const { window } = dom;
const { document } = window;
window.eval(fs.readFileSync(path.join(PUB, "innergrid.js"), "utf8"));
const IG = window.PiBoardInnerGrid;
assert.ok(IG && IG.InnerGrid && IG.BlockBoard, "le module doit s'exposer");

let passed = 0;
function ok(label, cond) {
  assert.ok(cond, label);
  passed++;
  console.log("  OK   " + label);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* La zone de la grille mesure 1200 x 600 : une case = 100 x 50 px. */
function sizeArea(grid) {
  grid.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 600, right: 1200, bottom: 600 });
}
function pointer(target, type, x, y) {
  const Ctor = window.PointerEvent || window.MouseEvent;
  const e = new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  if (!("pointerType" in e)) Object.defineProperty(e, "pointerType", { value: "mouse" });
  target.dispatchEvent(e);
  return e;
}
function setEditing(on) {
  document.body.classList.toggle("editing", on);
  document.dispatchEvent(new window.CustomEvent("piboard:editing", { detail: { editing: on } }));
}
const rect = (grid, id) => {
  const el = grid.els.get(id);
  return { x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h };
};

(async () => {
  console.log("== Geometrie pure ==");
  {
    const n = IG.normalize(["a", "b", "c"],
      { a: { x: 0, y: 0, w: 6, h: 6 }, b: { x: 3, y: 3, w: 6, h: 6 }, c: { x: 40, y: -3, w: 99, h: 1 } }, null);
    ok("un bloc enregistre par-dessus un autre est reloge", !IG.overlaps(n.a, n.b));
    ok("un bloc hors grille y est ramene, a une taille minimale lisible",
      n.c.x >= 0 && n.c.x + n.c.w <= 12 && n.c.y >= 0 && n.c.h >= IG.MIN_H);
    const all = Object.values(n);
    ok("aucun chevauchement dans une disposition reparee",
      all.every((r, i) => all.every((q, j) => i === j || !IG.overlaps(r, q))));

    const items = { a: { x: 0, y: 0, w: 6, h: 6 }, b: { x: 6, y: 0, w: 6, h: 6 } };
    const sw = IG.resolveMove(items, "a", { x: 6, y: 0, w: 6, h: 6 }, items.a);
    ok("poser un bloc sur un autre les echange", sw && sw.a.x === 6 && sw.b.x === 0);

    const full = {};
    let k = 0;
    for (let y = 0; y < 12; y += 4) for (let x = 0; x < 12; x += 4) full["b" + (k++)] = { x, y, w: 4, h: 4 };
    const big = IG.resolveMove(full, "b0", { x: 0, y: 0, w: 12, h: 12 }, full.b0);
    ok("sans aucune place pour les blocs pousses, le geste est refuse", big === null);

    /* Grille PLEINE (les dispositions predefinies la remplissent) :
       agrandir un bloc d'une rangee doit rogner son voisin, pas etre
       refuse -- sinon on ne pourrait jamais rien agrandir.
       A FULL grid: enlarging a block by one row must trim its neighbour,
       not be refused. */
    const grown = IG.resolveMove(full, "b0", { x: 0, y: 0, w: 4, h: 5 }, full.b0, "resize");
    ok("grille pleine : agrandir un bloc rogne son voisin au lieu d'etre refuse",
      grown && grown.b3.y === 5 && grown.b3.h === 3 && grown.b3.x === 0);
    const tooMuch = IG.resolveMove(full, "b0", { x: 0, y: 0, w: 4, h: 7 }, full.b0, "resize");
    ok("mais jamais en dessous de la taille minimale lisible", tooMuch === null);
  }

  console.log("== Glisser et redimensionner, en edition seulement ==");
  const host = document.createElement("div");
  /* La tuile autour : on verifie que rien ne lui parvient. */
  const tile = document.createElement("div");
  tile.className = "grid-stack-item";
  tile.appendChild(host);
  document.body.appendChild(tile);
  const tileHeard = [];
  for (const t of ["mousedown", "pointerdown", "touchstart", "click"]) tile.addEventListener(t, () => tileHeard.push(t));

  const layouts = [];
  const grid = new IG.InnerGrid({
    host, kind: "test", i18n: { t: (k) => k },
    blocks: [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }],
    hidden: [{ id: "d", title: "D" }],
    presets: [
      { id: "p1", label: "P1", items: { a: { x: 0, y: 0, w: 4, h: 6 }, b: { x: 4, y: 0, w: 4, h: 6 }, c: { x: 8, y: 0, w: 4, h: 6 } } },
      { id: "p2", label: "P2", items: { c: { x: 0, y: 0, w: 12, h: 4 }, a: { x: 0, y: 4, w: 6, h: 8 }, b: { x: 6, y: 4, w: 6, h: 8 } } }
    ],
    defaultPreset: "p1",
    onLayout: (items) => layouts.push(items),
    onHide: (id) => layouts.push({ hidden: id }),
    onShow: (id) => layouts.push({ shown: id })
  });
  sizeArea(grid);
  ok("sans disposition enregistree, la disposition par defaut s'applique",
    rect(grid, "a").x === 0 && rect(grid, "b").x === 4 && rect(grid, "c").x === 8);
  ok("chaque bloc est place en pourcentages de la tuile",
    grid.els.get("b").style.left === (4 / 12 * 100) + "%");

  const barA = grid.els.get("a").querySelector(".pig-bar");
  pointer(barA, "pointerdown", 50, 10);
  pointer(window, "pointermove", 50, 210);
  pointer(window, "pointerup", 50, 210);
  ok("hors edition, une barre glissee ne deplace rien", rect(grid, "a").y === 0 && layouts.length === 0);
  ok("et hors edition, les commandes d'edition sont absentes", grid.tools.hidden === true);

  setEditing(true);
  ok("le passage en edition est entendu par la grille", grid.editing === true && grid.root.classList.contains("pig-editing"));
  ok("la barre d'outils d'edition apparait", grid.tools.hidden === false && !!grid.tools.querySelector(".pig-add"));

  tileHeard.length = 0;
  pointer(barA, "pointerdown", 50, 10);
  /* 2,4 cases vers le bas (120 px / 50) : l'aimant pose a 2. */
  pointer(window, "pointermove", 50, 130);
  ok("pendant le geste, le bloc suit, aimante a la case", rect(grid, "a").y === 2);
  pointer(window, "pointerup", 50, 130);
  ok("relache, le bloc reste a sa nouvelle place", rect(grid, "a").y === 2 && rect(grid, "a").x === 0);
  ok("la nouvelle disposition est remise a la tuile pour etre enregistree",
    layouts.length === 1 && layouts[0].a.y === 2);
  ok("le geste commence sur la barre n'atteint pas la tuile (Gridstack la deplacerait)",
    !tileHeard.includes("pointerdown") && !tileHeard.includes("mousedown"));

  /* Redimensionner : le coin, 2 cases a droite et 1 en bas. b est a
     droite : il doit etre reloge, pas chevauche. */
  const rzA = grid.els.get("a").querySelector(".pig-resize");
  pointer(rzA, "pointerdown", 390, 390);
  pointer(window, "pointermove", 590, 440);
  pointer(window, "pointerup", 590, 440);
  const ra = rect(grid, "a"), rb = rect(grid, "b"), rc = rect(grid, "c");
  ok("le coin agrandit le bloc, case par case", ra.w === 6 && ra.h === 7);
  ok("le bloc voisin recouvert est reloge au lieu d'etre chevauche",
    !IG.overlaps(ra, rb) && !IG.overlaps(ra, rc) && !IG.overlaps(rb, rc));

  /* Echange : on pose c exactement sur la place de b. */
  const before = rect(grid, "b");
  const cFrom = rect(grid, "c");
  const barC = grid.els.get("c").querySelector(".pig-bar");
  pointer(barC, "pointerdown", cFrom.x * 100 + 10, cFrom.y * 50 + 10);
  pointer(window, "pointermove", before.x * 100 + 10, before.y * 50 + 10);
  pointer(window, "pointerup", before.x * 100 + 10, before.y * 50 + 10);
  const rc2 = rect(grid, "c");
  ok("deplacer un bloc sur un autre ne les superpose jamais",
    rc2.x === before.x && rc2.y === before.y && !IG.overlaps(rc2, rect(grid, "b")));

  /* Un releve de donnees qui tombe PENDANT le geste (la tuile se
     redessine toutes les trente minutes) ne doit pas arracher le bloc au
     doigt. A data refresh DURING the gesture must not snatch the block. */
  {
    const fromB = rect(grid, "b");
    const barB = grid.els.get("b").querySelector(".pig-bar");
    pointer(barB, "pointerdown", fromB.x * 100 + 10, fromB.y * 50 + 10);
    pointer(window, "pointermove", fromB.x * 100 + 10, (fromB.y + 1) * 50 + 10);
    grid.update({});
    ok("un rafraichissement pendant le geste laisse le bloc sous le doigt", rect(grid, "b").y === Math.min(fromB.y + 1, 12 - fromB.h));
    pointer(window, "pointerup", fromB.x * 100 + 10, fromB.y * 50 + 10);
  }

  console.log("== La tuile ne s'ouvre pas sous un clic de commande ==");
  tileHeard.length = 0;
  grid.els.get("a").querySelector(".pig-x").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  ok("la croix masque le bloc", layouts.some((x) => x.hidden === "a"));
  ok("et son clic n'ouvre pas les reglages de la tuile", !tileHeard.includes("click"));

  const add = grid.tools.querySelector(".pig-add");
  add.value = "d";
  add.dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("la barre d'outils rajoute un bloc masque", layouts.some((x) => x.shown === "d"));

  console.log("== Dispositions predefinies, reinitialiser, copier-coller ==");
  const pre = grid.tools.querySelector(".pig-preset");
  pre.value = "p2";
  pre.dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("une disposition predefinie s'applique d'un choix", rect(grid, "c").w === 12 && rect(grid, "a").y === 4);
  grid.tools.querySelector(".pig-copy").click();
  grid.tools.querySelector(".pig-reset").click();
  ok("Reinitialiser revient a la disposition par defaut", rect(grid, "a").x === 0 && rect(grid, "c").x === 8 && rect(grid, "c").w === 4);
  ok("la disposition copiee est gardee pour une autre tuile", !!IG.clipRead("test"));

  /* Une SECONDE tuile du meme genre colle la disposition copiee. */
  const host2 = document.createElement("div");
  document.body.appendChild(host2);
  let pasted = null;
  const grid2 = new IG.InnerGrid({
    host: host2, kind: "test", i18n: { t: (k) => k },
    blocks: [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }],
    presets: [], defaultPreset: null, onLayout: (items) => { pasted = items; }
  });
  sizeArea(grid2);
  ok("une autre tuile en edition voit le bouton Coller actif", grid2.tools.querySelector(".pig-paste").disabled === false);
  grid2.tools.querySelector(".pig-paste").click();
  ok("et la disposition collee y est identique", pasted && pasted.c.w === 12 && pasted.a.y === 4);
  grid2.destroy();

  console.log("== Sortie d'edition ==");
  setEditing(false);
  ok("hors edition, la barre d'outils disparait", grid.tools.hidden === true && !grid.root.classList.contains("pig-editing"));
  const css = fs.readFileSync(path.join(PUB, "innergrid.css"), "utf8");
  ok("les poignees ne s'affichent qu'en edition",
    /\.pig-bar,\s*\n?\s*\.pig-resize,\s*\n?\s*\.pig-tools\s*\{\s*display:\s*none/.test(css)
    && /\.pig-root\.pig-editing \.pig-bar\s*\{[^}]*display:\s*flex/.test(css));
  ok("les commandes reprennent le pointeur alors que la tuile est inerte en edition",
    /\.pig-root\.pig-editing \.pig-ctl\s*\{\s*pointer-events:\s*auto/.test(css));
  ok("au doigt, les poignees grandissent (mode tactile)",
    /body\.touch-mode \.pig-root\.pig-editing \.pig-bar/.test(css) && /body\.touch-mode \.pig-root\.pig-editing \.pig-resize/.test(css));
  ok("toutes les classes de la feuille sont prefixees pig-",
    css.replace(/\/\*[\s\S]*?\*\//g, "").match(/\.[a-z][\w-]*/g).every((c) => c.startsWith(".pig-") || [".touch-mode", ".touch"].includes(c)));

  console.log("== Ajuster le texte a la taille du bloc ==");
  {
    /* jsdom ne mesure rien : on simule un contenu de 300 px de haut qui
       suit l'echelle, dans un bloc de 240 px. */
    const body = grid.body("b");
    Object.defineProperty(body, "clientHeight", { configurable: true, get: () => 240 });
    Object.defineProperty(body, "clientWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(body, "scrollWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(body, "scrollHeight", { configurable: true,
      get: () => 300 * Number(body.style.getPropertyValue("--pig-scale") || 1) });
    const s = grid.fitBlock("b");
    ok("un contenu trop haut est resserre juste ce qu'il faut", s >= 0.79 && s <= 0.8);
    Object.defineProperty(body, "scrollHeight", { configurable: true,
      get: () => 100 * Number(body.style.getPropertyValue("--pig-scale") || 1) });
    ok("un contenu court grandit, sans depasser le maximum", grid.fitBlock("b") === IG.FIT_MAX);
    Object.defineProperty(body, "scrollHeight", { configurable: true,
      get: () => 2000 * Number(body.style.getPropertyValue("--pig-scale") || 1) });
    ok("au-dela du minimum lisible, le bloc defile plutot que de rapetisser", grid.fitBlock("b") === IG.FIT_MIN);
    grid.o.autoFit = false;
    ok("et l'ajustement se coupe dans les reglages", grid.fitBlock("b") === 1 && !body.style.getPropertyValue("--pig-scale"));
  }

  grid.destroy();
  ok("detruite, la grille quitte la tuile et n'ecoute plus l'edition",
    !host.querySelector(".pig-root") && (setEditing(true), true) && grid.editing === false);
  setEditing(false);

  console.log("== Le tableau a blocs : une disposition par tuile, et par moment ==");
  {
    const saved = [];
    const ctx = {
      i18n: { t: (k) => k },
      settings: { showA: true, showB: true, showC: false, autoLayout: false },
      updateSettings(p) { saved.push(p); }
    };
    let weekend = false;
    let relayouts = 0;
    const board = new IG.BlockBoard({
      ctx, kind: "t2",
      blocks: [{ id: "a", key: "showA", titleKey: "A" }, { id: "b", key: "showB", titleKey: "B" }, { id: "c", key: "showC", titleKey: "C" }],
      presets: [
        { id: "def", labelKey: "def", items: { a: { x: 0, y: 0, w: 6, h: 12 }, b: { x: 6, y: 0, w: 6, h: 12 } } },
        { id: "wk", labelKey: "wk", items: { a: { x: 0, y: 0, w: 12, h: 6 }, b: { x: 0, y: 6, w: 12, h: 6 } } }
      ],
      defaultPreset: "def", seasonPreset: "def", weekendPreset: "wk",
      isWeekend: () => weekend,
      onRelayout: () => { relayouts++; }
    });
    const h = document.createElement("div");
    document.body.appendChild(h);
    const g = board.mount(h);
    ok("seuls les blocs coches sont dans la grille", g.els.size === 2 && !g.els.has("c"));
    ok("un bloc decoche est propose dans « Ajouter un bloc »", g.o.hidden.length === 1 && g.o.hidden[0].id === "c");
    g.commit({ a: { x: 0, y: 0, w: 4, h: 12 }, b: { x: 4, y: 0, w: 8, h: 12 } });
    ok("la disposition est enregistree DANS les reglages de la tuile",
      saved.length === 1 && saved[0].layouts.main.b.w === 8);
    board.toggle("a", false);
    ok("masquer un bloc decoche la meme case que la fenetre de reglages",
      ctx.settings.showA === false && relayouts === 1);
    board.toggle("a", true);

    ctx.settings.autoLayout = true;
    ok("avec la disposition par moment, hors week-end c'est la Saison", board.slot(0) === "season");
    weekend = true;
    ok("et le week-end de course bascule de lui-meme", board.slot(0) === "weekend");
    const g2 = board.mount(h);
    ok("la disposition du week-end part de son preset propre", +g2.els.get("a").dataset.w === 12);
    ok("le changement de moment est detecte sans reseau", (weekend = false, board.slotChanged(0)) === true);
    g2.commit({ a: { x: 0, y: 0, w: 3, h: 3 }, b: { x: 3, y: 0, w: 3, h: 3 } });
    const last = saved[saved.length - 1].layouts;
    ok("chaque moment garde sa propre disposition", !!last.weekend && !!last.main && last.main.b.w === 8);
    board.unmount();
  }

  console.log(`\n>>> innerGrid : ${passed} verifications OK`);
})().catch((e) => { console.error(e); process.exit(1); });
