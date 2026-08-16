"use strict";
/* ============================================================
   PiBoard - test/webviewShot.test.js
   Tests de server/webviewShot.js : le rendu d'une page web EN IMAGE
   via Chromium headless, troisieme approche de la tuile "Page web"
   (apres l'iframe directe et le relais HTML), la seule qui ne depende
   d'aucune cooperation du site.

   Aucun test ne lance reellement Chromium : le binaire n'est present
   ni sur toutes les machines de developpement, ni en CI, et un
   lancement de navigateur prendrait plusieurs secondes. Les tests
   portent donc sur ce qui est deterministe -- la construction PURE des
   arguments de capture, et le comportement d'echec propre quand
   Chromium est introuvable. Meme principe que test/iptvVlc.test.js.
   ============================================================ */
const assert = require("assert");
const webviewShot = require("../server/webviewShot");

(async () => {
  console.log("== webviewShot : expose l'interface attendue ==");
  {
    for (const fn of ["capture", "findChromium", "buildShotArgs", "installHint"]) {
      assert.ok(typeof webviewShot[fn] === "function", "webviewShot." + fn + " doit etre une fonction");
    }
    console.log("  OK");
  }

  console.log("== buildShotArgs : options indispensables au rendu sur un Pi en kiosque ==");
  {
    const args = webviewShot.buildShotArgs("https://exemple.test/page", "/tmp/x.png", "/tmp/profil", {});
    assert.ok(args.includes("--headless=new"), "mode sans interface");
    assert.ok(args.includes("--no-sandbox"),
      "bac a sable desactive : Chromium tourne souvent sous un utilisateur non privilegie, le bac a sable echouerait");
    assert.ok(args.includes("--disable-gpu"),
      "acceleration GPU desactivee : inutile hors ecran, source de plantages sur Pi");
    assert.ok(args.includes("--user-data-dir=/tmp/profil"),
      "profil SEPARE : sans lui, Chromium refuserait de demarrer pendant que le kiosque tourne deja");
    assert.ok(args.includes("--screenshot=/tmp/x.png"), "sortie vers le fichier demande");
    assert.strictEqual(args[args.length - 1], "https://exemple.test/page",
      "l'URL est le DERNIER argument (sinon Chromium la prendrait pour une option)");
    console.log("  OK");
  }

  console.log("== buildShotArgs : taille de rendu suivie, et bornee contre les valeurs absurdes ==");
  {
    let args = webviewShot.buildShotArgs("https://x.test/", "/tmp/x.png", "/tmp/p", { width: 900, height: 600 });
    assert.ok(args.includes("--window-size=900,600"), "taille demandee respectee");

    // Une tuile minuscule ou une valeur forgee ne doit pas produire un
    // rendu inexploitable (ou un Chromium qui refuse de demarrer).
    args = webviewShot.buildShotArgs("https://x.test/", "/tmp/x.png", "/tmp/p", { width: 1, height: 1 });
    assert.ok(args.includes("--window-size=320,240"), "taille minimale garantie");

    args = webviewShot.buildShotArgs("https://x.test/", "/tmp/x.png", "/tmp/p", { width: 99999, height: 99999 });
    assert.ok(args.includes("--window-size=3840,2160"), "taille maximale bornee");
    console.log("  OK");
  }

  console.log("== buildShotArgs : delai laisse au JavaScript avant la photo ==");
  {
    const args = webviewShot.buildShotArgs("https://x.test/", "/tmp/x.png", "/tmp/p", {});
    const budget = args.find((a) => a.startsWith("--virtual-time-budget="));
    assert.ok(budget, "un budget de temps est toujours accorde : sans lui, les sites modernes seraient photographies a moitie vides");
    assert.ok(Number(budget.split("=")[1]) > 0);
    console.log("  OK");
  }

  console.log("== installHint : indication d'installation fournie pour la plateforme courante ==");
  {
    const hint = webviewShot.installHint();
    assert.ok(hint && typeof hint === "object", "un objet est renvoye");
    assert.ok(typeof hint.fr === "string" && typeof hint.en === "string", "bilingue (FR/EN), comme le reste du projet");
    console.log("  OK");
  }

  console.log("== capture : Chromium introuvable -> echec propre, jamais un plantage ==");
  {
    // Verification indirecte (meme approche que test/iptvVlc.test.js) :
    // sur une machine sans Chromium, capture() doit renvoyer un echec
    // decrit et une indication d'installation ; sur une machine qui en
    // a un, la capture d'une URL injoignable doit echouer tout aussi
    // proprement. Dans les deux cas : jamais d'exception, toujours une
    // reponse exploitable.
    const r = await webviewShot.capture("http://127.0.0.1:1/injoignable", { width: 400, height: 300 });
    assert.strictEqual(r.ok, false, "echec signale, pas une image vide silencieuse");
    assert.ok(typeof r.error === "string" && r.error.length > 0, "message d'erreur exploitable fourni");
    console.log("  OK (" + r.error.slice(0, 70) + ")");
  }

  console.log("\n>>> TOUS LES TESTS WEBVIEWSHOT PASSENT");
})();
