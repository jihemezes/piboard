/* PiBoard - test/gpu.test.js
   Parseurs de charge GPU des trois plateformes, verifies depuis
   n'importe quelle machine -- y compris un Raspberry Pi sans la moindre
   carte graphique dediee -- en leur fournissant des sorties de commandes
   reelles capturees a l'avance. Meme principe que test/platform.test.js
   pour les parseurs reseau : aucun processus n'est lance ici.

   GPU load parsers for all three platforms, verified from any machine --
   including a Raspberry Pi with no dedicated graphics card at all -- by
   feeding them real command output captured beforehand. Same principle
   as test/platform.test.js for the network parsers: no process is
   spawned here. */
"use strict";
const assert = require("assert");
const linux = require("../server/platform/linux");
const win32 = require("../server/platform/win32");
const darwin = require("../server/platform/darwin");

console.log("== nvidia-smi : sortie CSV (identique sous Linux et Windows) ==");
for (const [name, impl] of [["linux", linux], ["win32", win32]]) {
  const raw = "37, 54, 2048, 12288, NVIDIA GeForce RTX 3060\n";
  const g = impl.parseNvidiaSmi(raw);
  assert.strictEqual(g.percent, 37, name + " : utilisation");
  assert.strictEqual(g.tempC, 54, name + " : temperature");
  assert.strictEqual(g.memPercent, 16.7, name + " : memoire en pourcentage");
  assert.strictEqual(g.name, "NVIDIA GeForce RTX 3060", name + " : nom de la carte");

  // Une carte au repos renvoie 0 : a ne pas confondre avec une absence.
  // An idle card returns 0: not to be confused with an absence.
  assert.strictEqual(impl.parseNvidiaSmi("0, 31, 300, 8192, NVIDIA T400").percent, 0,
    name + " : 0 % est une valeur, pas une absence");
  // Champs manquants ("[N/A]" chez certains pilotes) : l'utilisation
  // reste exploitable, le reste passe a null plutot que NaN.
  const partial = impl.parseNvidiaSmi("12, [N/A], [N/A], [N/A], Quadro P400");
  assert.strictEqual(partial.percent, 12, name + " : utilisation lue malgre les champs absents");
  assert.strictEqual(partial.tempC, null, name + " : temperature absente -> null, jamais NaN");
  assert.strictEqual(partial.memPercent, null, name + " : memoire absente -> null");
  // Plusieurs cartes : la premiere ligne fait foi (une seule barre).
  assert.strictEqual(impl.parseNvidiaSmi("5, 40, 1, 2, A\n90, 70, 1, 2, B").percent, 5,
    name + " : premiere carte retenue quand il y en a plusieurs");

  assert.strictEqual(impl.parseNvidiaSmi(""), null, name + " : sortie vide");
  assert.strictEqual(impl.parseNvidiaSmi(null), null, name + " : entree nulle");
  assert.strictEqual(impl.parseNvidiaSmi("command not found"), null, name + " : message d'erreur ignore");
}
console.log("  OK");

console.log("== Linux : fichier amdgpu gpu_busy_percent ==");
{
  assert.strictEqual(linux.parseGpuBusyPercent("42\n"), 42);
  assert.strictEqual(linux.parseGpuBusyPercent("0"), 0, "0 % est une valeur");
  assert.strictEqual(linux.parseGpuBusyPercent("   17   "), 17, "espaces ignores");
  assert.strictEqual(linux.parseGpuBusyPercent("120"), 100, "valeur aberrante plafonnee");
  assert.strictEqual(linux.parseGpuBusyPercent(""), null);
  assert.strictEqual(linux.parseGpuBusyPercent("N/A"), null, "fichier illisible -> null");
  console.log("  OK");
}

console.log("== Windows : compteurs de performance GPU Engine ==");
{
  /* Windows publie un compteur par moteur ET par processus. La charge de
     la carte est la SOMME des moteurs 3D/Compute -- prendre un seul
     compteur donnerait la charge d'un seul processus. */
  const samples = JSON.stringify([
    { Path: "\\\\PC\\gpu engine(pid_1234_luid_0x00000000_0x0000C1B2_phys_0_eng_0_engtype_3D)\\utilization percentage", CookedValue: 30 },
    { Path: "\\\\PC\\gpu engine(pid_5678_luid_0x00000000_0x0000C1B2_phys_0_eng_1_engtype_3D)\\utilization percentage", CookedValue: 12.4 },
    { Path: "\\\\PC\\gpu engine(pid_5678_luid_0x00000000_0x0000C1B2_phys_0_eng_2_engtype_Copy)\\utilization percentage", CookedValue: 55 },
    { Path: "\\\\PC\\gpu engine(pid_9999_luid_0x00000000_0x0000C1B2_phys_0_eng_3_engtype_VideoDecode)\\utilization percentage", CookedValue: 40 }
  ]);
  const g = win32.parseGpuCounters(samples);
  assert.strictEqual(g.percent, 42, "somme des moteurs 3D uniquement (30 + 12,4), arrondie");
  assert.strictEqual(g.tempC, null, "ce compteur ne donne pas la temperature");

  // Copy et VideoDecode sont volontairement ecartes : une simple lecture
  // video les fait monter tres haut sans que la carte travaille vraiment.
  const videoOnly = JSON.stringify([
    { Path: "\\\\PC\\gpu engine(pid_1_engtype_VideoDecode)\\utilization percentage", CookedValue: 80 }
  ]);
  assert.strictEqual(win32.parseGpuCounters(videoOnly), null,
    "aucun moteur 3D/Compute -> null, pas 80 % de charge imaginaire");

  const compute = JSON.stringify([
    { Path: "\\\\PC\\gpu engine(pid_2_engtype_Compute)\\utilization percentage", CookedValue: 63 }
  ]);
  assert.strictEqual(win32.parseGpuCounters(compute).percent, 63, "les moteurs Compute comptent");

  // Plusieurs processus peuvent depasser 100 % cumules : on plafonne.
  const over = JSON.stringify([
    { Path: "\\\\PC\\gpu engine(pid_1_engtype_3D)\\utilization percentage", CookedValue: 90 },
    { Path: "\\\\PC\\gpu engine(pid_2_engtype_3D)\\utilization percentage", CookedValue: 70 }
  ]);
  assert.strictEqual(win32.parseGpuCounters(over).percent, 100, "cumul plafonne a 100 %");

  // Un echantillon unique n'est pas renvoye dans un tableau par
  // ConvertTo-Json : le parseur doit accepter les deux formes.
  const single = JSON.stringify({ Path: "\\\\PC\\gpu engine(pid_1_engtype_3D)\\utilization percentage", CookedValue: 25 });
  assert.strictEqual(win32.parseGpuCounters(single).percent, 25, "objet seul accepte, pas seulement un tableau");

  assert.strictEqual(win32.parseGpuCounters("pas du json"), null);
  assert.strictEqual(win32.parseGpuCounters("[]"), null, "aucun echantillon -> null");
  assert.strictEqual(win32.parseGpuCounters(null), null);
  console.log("  OK");
}

console.log("== gpuUsage : jamais d'exception, null accepte partout ==");
(async () => {
  for (const [name, impl] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    const v = await impl.gpuUsage();
    // Sur la machine qui execute ce test, il n'y a probablement aucun GPU
    // lisible : null est le resultat ATTENDU et doit rester exploitable.
    // On the machine running this test there is probably no readable GPU:
    // null is the EXPECTED result and must stay usable.
    assert.ok(v === null || (v && Number.isFinite(v.percent)),
      name + " : renvoie null ou un objet avec un pourcentage fini");
    if (v) assert.ok(v.percent >= 0 && v.percent <= 100, name + " : pourcentage borne 0-100");
  }
  assert.strictEqual(await darwin.gpuUsage(), null, "macOS : null assume (powermetrics exige root)");
  console.log("  OK");
  console.log("\n>>> TOUS LES TESTS GPU PASSENT");
})().catch((e) => { console.error(e); process.exitCode = 1; });
