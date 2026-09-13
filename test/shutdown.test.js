/* Extinction de la machine : capacite par plateforme et refus propre.
   Machine shutdown: per-platform capability and clean refusal. */
"use strict";
const assert = require("assert");
const path = require("path");

console.log("== Extinction : reservee a Linux ==");
{
  const linux = require(path.join(__dirname, "..", "server", "platform", "linux.js"));
  const win32 = require(path.join(__dirname, "..", "server", "platform", "win32.js"));
  const darwin = require(path.join(__dirname, "..", "server", "platform", "darwin.js"));
  assert.strictEqual(typeof linux.shutdown, "function", "Linux sait eteindre");
  assert.strictEqual(typeof win32.shutdown, "function", "la couche garde la meme forme partout");
  assert.strictEqual(typeof darwin.shutdown, "function");
  console.log("  OK   les trois plateformes exposent shutdown()");
}

(async () => {
  const win32 = require(path.join(__dirname, "..", "server", "platform", "win32.js"));
  const darwin = require(path.join(__dirname, "..", "server", "platform", "darwin.js"));
  for (const [name, impl] of [["win32", win32], ["darwin", darwin]]) {
    const out = await impl.shutdown();
    assert.strictEqual(out.ok, false, name + " ne doit jamais eteindre la machine");
    assert.strictEqual(out.reason, "unsupported");
  }
  console.log("  OK   Windows et macOS refusent, sans jamais lancer de commande");

  const platform = require(path.join(__dirname, "..", "server", "platform"));
  assert.strictEqual(platform.shutdownSupported(), platform.id === "linux",
    "la capacite annoncee a l'interface suit la plateforme reelle");
  if (platform.id !== "linux") {
    const out = await platform.shutdown();
    assert.strictEqual(out.ok, false);
  } else {
    /* Sur Linux sans droits (conteneur d'integration, installation
       anterieure a la regle polkit), l'appel doit ECHOUER PROPREMENT --
       un objet explicite, jamais une exception : l'interface s'en sert
       pour expliquer quoi faire.
       On Linux without the rights (integration container, installation
       predating the polkit rule), the call must FAIL CLEANLY -- an
       explicit object, never an exception: the interface uses it to
       explain what to do. */
    const out = await platform.shutdown();
    assert.ok(typeof out === "object" && typeof out.ok === "boolean",
      "un resultat exploitable, meme en cas de refus");
    if (!out.ok) assert.ok(out.reason, "un refus porte toujours un motif");
  }
  console.log("  OK   refus propre plutot qu'exception quand le droit manque");

  console.log("Tous les tests d'extinction sont passes.");
})();
