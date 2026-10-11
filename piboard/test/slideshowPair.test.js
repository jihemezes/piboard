/* Test unitaire de l'appairage de deux photos portrait du widget
   Diaporama (public/widgets/slideshow/widget.js).

   Pourquoi un fichier separe plutot qu'un ajout a dom-smoke.js : y
   ajouter une tuile Diaporama decalerait le nombre de tuiles montees et
   les positions attendues par les tests existants. Ici, le widget est
   instancie seul, avec un contexte minimal, ce qui permet en prime de
   controler ce que jsdom ne sait pas fournir : les dimensions de la
   tuile (clientWidth/clientHeight valent toujours 0) et l'orientation
   des images (naturalWidth/naturalHeight ne sont jamais calculees, aucun
   fichier n'etant reellement charge).

   Unit test for the Slideshow widget's pairing of two portrait photos
   (public/widgets/slideshow/widget.js).

   Why a separate file rather than an addition to dom-smoke.js: adding a
   Slideshow tile there would shift the mounted tile count and the
   positions expected by existing tests. Here the widget is instantiated
   on its own with a minimal context, which additionally allows
   controlling what jsdom cannot provide: the tile's dimensions
   (clientWidth/clientHeight are always 0) and the images' orientation
   (naturalWidth/naturalHeight are never computed, since no file is
   actually loaded). */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const WIDGET = path.join(__dirname, "..", "public", "widgets", "slideshow", "widget.js");

const dom = new JSDOM("<!doctype html><html><body><div id=\"tile\"></div></body></html>", {
  pretendToBeVisual: true
});
const { window } = dom;
global.window = window;
global.document = window.document;

// Capture la classe enregistree par le widget / captures the class the widget registers
let SlideshowWidget = null;
window.PiBoard = { registerWidget: (id, cls) => { if (id === "slideshow") SlideshowWidget = cls; } };
global.PiBoard = window.PiBoard;

window.eval(fs.readFileSync(WIDGET, "utf8"));
assert.ok(SlideshowWidget, "le widget slideshow s'est bien enregistre");

/* Fabrique une tuile de dimensions imposees, avec n diapositives dont on
   fixe l'orientation. Builds a tile with forced dimensions and n slides
   whose orientation is set explicitly. */
function makeWidget(tileW, tileH, orientations, settings) {
  const el = window.document.getElementById("tile");
  el.innerHTML = "<div class=\"pw-slideshow\">" +
    orientations.map((o, i) =>
      "<div class=\"pws-slide\" data-i=\"" + i + "\"" +
      (o ? " data-orient=\"" + o + "\"" : "") +
      "><img class=\"pws-slide-img\"></div>" +
      "<span data-dot=\"" + i + "\"></span>"
    ).join("") + "</div>";

  // jsdom ne fait aucune mise en page : clientWidth/clientHeight valent
  // toujours 0. On les impose pour pouvoir tester la condition "tuile
  // plus large que haute". jsdom performs no layout: clientWidth/
  // clientHeight are always 0. They are forced here so the "tile wider
  // than tall" condition can be tested.
  Object.defineProperty(el, "clientWidth", { value: tileW, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: tileH, configurable: true });

  const w = new SlideshowWidget({
    el,
    settings: Object.assign({ kenBurns: false }, settings || {}),
    instanceId: "t-test",
    i18n: { t: (k) => k },
    api: {}
  });
  w.urls = orientations.map((_, i) => "photo" + i + ".jpg");
  return w;
}

function slides(w) { return w.ctx.el.querySelectorAll(".pws-slide"); }
function activeIdx(w) {
  return [...slides(w)].map((el, i) => el.classList.contains("pws-active") ? i : -1).filter((i) => i >= 0);
}

try {
  console.log("== Deux portraits consecutifs dans une tuile paysage : appaires ==");
  {
    const w = makeWidget(800, 400, ["portrait", "portrait", "landscape"]);
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0, 1], "les deux portraits sont affiches ensemble");
    assert.ok(slides(w)[0].classList.contains("pws-pair-a"), "la premiere occupe la moitie gauche");
    assert.ok(slides(w)[1].classList.contains("pws-pair-b"), "la seconde occupe la moitie droite");
    console.log("  OK deux portraits accoles");
  }

  console.log("== Tuile plus haute que large : aucun appairage ==");
  {
    // C'est le cas ou une photo portrait remplit deja bien la tuile :
    // couper la largeur en deux degraderait l'affichage au lieu de
    // l'ameliorer. This is the case where a portrait photo already fills
    // the tile nicely: halving the width would degrade the display
    // rather than improve it.
    const w = makeWidget(400, 800, ["portrait", "portrait"]);
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0], "une seule photo affichee");
    assert.ok(!slides(w)[0].classList.contains("pws-pair-a"), "aucune classe d'appairage posee");
    console.log("  OK tuile portrait : pas d'appairage");
  }

  console.log("== Un paysage ne s'appaire jamais ==");
  {
    const w = makeWidget(800, 400, ["landscape", "portrait"]);
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0], "le paysage reste seul");
    console.log("  OK paysage seul");
  }

  console.log("== Portrait suivi d'un paysage : pas d'appairage ==");
  {
    const w = makeWidget(800, 400, ["portrait", "landscape"]);
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0], "le portrait reste seul faute de second portrait");
    console.log("  OK portrait isole");
  }

  console.log("== Portrait en fin de liste : affiche seul, sans erreur ==");
  {
    const w = makeWidget(800, 400, ["landscape", "portrait"]);
    w.show(1);
    assert.deepStrictEqual(activeIdx(w), [1], "le dernier portrait s'affiche seul");
    console.log("  OK dernier portrait");
  }

  console.log("== Orientation encore inconnue (image non chargee) : pas d'appairage ==");
  {
    // Degradation progressive : tant que les dimensions ne sont pas
    // connues, l'affichage reste celui d'avant, jamais casse.
    // Graceful degradation: while dimensions are unknown, the display
    // stays as it was before, never broken.
    const w = makeWidget(800, 400, ["portrait", null]);
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0], "aucun appairage sans orientation connue");
    console.log("  OK degradation progressive");
  }

  console.log("== Reglage desactive : aucun appairage ==");
  {
    const w = makeWidget(800, 400, ["portrait", "portrait"], { pairPortraits: false });
    w.show(0);
    assert.deepStrictEqual(activeIdx(w), [0], "le reglage desactive supprime bien l'appairage");
    console.log("  OK reglage respecte");
  }

  console.log("== next() avance de 2 apres une paire, de 1 sinon ==");
  {
    // Sans cela, la seconde photo de la paire reapparaitrait seule juste
    // apres l'avoir deja vue. Without this, the pair's second photo would
    // reappear on its own right after having just been seen.
    const w = makeWidget(800, 400, ["portrait", "portrait", "landscape", "landscape"]);
    w.show(0);
    assert.strictEqual(w.pairedWith, 1, "une paire est bien active");
    w.next();
    assert.strictEqual(w.index, 2, "apres une paire, on saute directement a la 3e photo");
    assert.strictEqual(w.pairedWith, -1, "plus de paire sur un paysage");
    w.next();
    assert.strictEqual(w.index, 3, "sans paire, on avance d'une seule photo");
    console.log("  OK progression correcte");
  }

  console.log("== Sortie d'appairage : la diapositive retrouve la pleine largeur ==");
  {
    // La demi-largeur vient de classes CSS : si elles n'etaient pas
    // retirees, la photo suivante affichee seule resterait coincee sur
    // une moitie d'ecran. The half width comes from CSS classes: if they
    // weren't removed, the next photo shown alone would stay stuck on
    // half the screen.
    const w = makeWidget(800, 400, ["portrait", "portrait", "landscape"]);
    w.show(0);
    assert.ok(slides(w)[0].classList.contains("pws-pair-a"), "appairage pose au depart");
    w.show(2);
    const cls = [...slides(w)].map((el) => el.className);
    assert.ok(!cls.some((c) => c.includes("pws-pair-")), "toutes les classes d'appairage sont retirees");
    console.log("  OK classes nettoyees");
  }

  console.log("== Pastilles de progression : les deux photos de la paire sont marquees ==");
  {
    const w = makeWidget(800, 400, ["portrait", "portrait"]);
    w.show(0);
    const dots = w.ctx.el.querySelectorAll("[data-dot]");
    assert.ok(dots[0].classList.contains("pws-dot-active"), "pastille de la 1re photo active");
    assert.ok(dots[1].classList.contains("pws-dot-active"), "pastille de la 2e photo active");
    console.log("  OK pastilles coherentes");
  }

  console.log("");
  console.log(">>> TOUS LES TESTS PASSENT");
} catch (e) {
  console.error("");
  console.error(">>> ECHEC:", e.message);
  process.exit(1);
}
