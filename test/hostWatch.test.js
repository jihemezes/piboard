/* Veille reseau : choix de la sonde, analyse de la liste, statistiques.
   Les sondes elles-memes ne sont PAS testees ici -- elles demandent un
   reseau, et un test qui depend d'internet echoue un jour pour de
   mauvaises raisons. Ce qui est teste est tout ce qui decide : comment
   une ligne saisie devient une cible, quelle sonde lui est attribuee, et
   comment l'historique se resume.
   Network watch: probe selection, list parsing, statistics. The probes
   themselves are NOT tested here -- they need a network, and a test that
   depends on the internet fails one day for the wrong reasons. What is
   tested is everything that decides: how a typed line becomes a target,
   which probe it gets, and how the history is summarized. */
"use strict";
const assert = require("assert");
const { parseTargets, probeKind, reasonOf, stats, MAX_TARGETS } = require("../server/hostWatch");

console.log("== Choix de la sonde d'apres la forme de la cible ==");
{
  assert.strictEqual(probeKind("https://alexa.amazon.com"), "http");
  assert.strictEqual(probeKind("http://192.168.1.1"), "http");
  // Une URL contient ":" : elle ne doit surtout pas etre prise pour un
  // couple hote:port. An URL contains ":": it must not be mistaken for a
  // host:port pair.
  assert.strictEqual(probeKind("https://nas.local:5001"), "http");
  assert.strictEqual(probeKind("nas.local:5001"), "tcp");
  assert.strictEqual(probeKind("192.168.1.10"), "ping");
  assert.strictEqual(probeKind("pi.local"), "ping");
  assert.strictEqual(probeKind("nas:70000"), null, "port hors plage");
  assert.strictEqual(probeKind("deux mots"), null);
  assert.strictEqual(probeKind(""), null);
  console.log("  OK");
}

console.log("== Analyse de la liste saisie ==");
{
  const list = parseTargets([
    "NAS = 192.168.1.10:5001",
    "Alexa | https://alexa.amazon.com",
    "pi.local",
    "# Somfy = https://www.somfy.fr",   // desactivee / disabled
    "",
    "   ",
    "pas une cible du tout"
  ].join("\n"));
  assert.strictEqual(list.length, 3, "commentaires, lignes vides et cibles invalides ecartes");
  assert.deepStrictEqual(list.map((t) => t.probe), ["tcp", "http", "ping"]);
  assert.strictEqual(list[0].name, "NAS");
  assert.strictEqual(list[1].name, "Alexa", "le separateur | est accepte comme =");
  assert.strictEqual(list[2].name, "pi.local", "sans nom, la cible sert de libelle");
  console.log("  OK");
}

console.log("== Doublons et plafond ==");
{
  const dup = parseTargets("A = pi.local\nB = PI.LOCAL\n");
  assert.strictEqual(dup.length, 1, "meme cible a la casse pres : sondee une seule fois");

  const many = [];
  for (let i = 0; i < MAX_TARGETS + 10; i++) many.push("h" + i + ".local");
  assert.strictEqual(parseTargets(many.join("\n")).length, MAX_TARGETS,
    "le plafond protege la lisibilite de la tuile autant que le serveur");
  console.log("  OK");
}

console.log("== Motifs d'erreur lisibles ==");
{
  assert.strictEqual(reasonOf({ code: "ECONNREFUSED" }), "refused");
  assert.strictEqual(reasonOf({ cause: { code: "ENOTFOUND" } }), "unknown name",
    "fetch enveloppe l'erreur systeme dans cause");
  assert.strictEqual(reasonOf(new Error("This operation was aborted")), "timeout");
  console.log("  OK");
}

console.log("== Statistiques : disponibilite et « depuis quand » ==");
{
  assert.deepStrictEqual(stats([]), { samples: 0, uptime: null, avgMs: null, since: null });

  const t0 = Date.now() - 5 * 60000;
  const list = [
    { at: t0, up: true, ms: 10 },
    { at: t0 + 60000, up: true, ms: 20 },
    { at: t0 + 120000, up: false, ms: null },
    { at: t0 + 180000, up: false, ms: null },
    { at: t0 + 240000, up: false, ms: null }
  ];
  const out = stats(list);
  assert.strictEqual(out.samples, 5);
  assert.strictEqual(out.uptime, 40, "2 reussites sur 5");
  assert.strictEqual(out.avgMs, 15, "moyenne des seules reussites");
  assert.strictEqual(out.since, t0 + 120000,
    "depuis le PREMIER releve de l'etat courant, pas le dernier");
  assert.deepStrictEqual(out.spark, [1, 1, 0, 0, 0]);

  // Un etat qui n'a jamais change : \"depuis\" remonte au tout premier
  // releve. A state that never changed: \"since\" goes back to the very
  // first sample.
  assert.strictEqual(stats([{ at: 100, up: true, ms: 5 }, { at: 200, up: true, ms: 7 }]).since, 100);
  console.log("  OK");
}

console.log("Tous les tests de veille reseau sont passes.");
