/* Test unitaire de server/platform/ : verifie les parseurs des trois
   plateformes ET l'interface commune, quelle que soit la machine qui
   execute la suite. C'est le point essentiel de ce fichier : les
   parseurs Windows doivent pouvoir etre valides depuis le Raspberry Pi,
   sans acces a une machine Windows, en leur fournissant des sorties de
   commandes reelles capturees a l'avance.

   Unit test for server/platform/: checks all three platforms' parsers
   AND the shared interface, whatever machine runs the suite. That is
   the whole point of this file: the Windows parsers must be verifiable
   from the Raspberry Pi, with no access to a Windows machine, by
   feeding them real command output captured beforehand. */
"use strict";
const assert = require("assert");
const path = require("path");
const platform = require("../server/platform");
const linux = require("../server/platform/linux");
const win32 = require("../server/platform/win32");
const darwin = require("../server/platform/darwin");
const { normalizeMac, isBroadcastOrMulticastMac } = require("../server/ipv4");

console.log("== normalizeMac : deux-points, tirets, casse, zeros de tete ==");
assert.strictEqual(normalizeMac("AA:BB:CC:DD:EE:FF"), "aa:bb:cc:dd:ee:ff");
assert.strictEqual(normalizeMac("a4-2b-b0-11-22-33"), "a4:2b:b0:11:22:33", "format Windows (tirets)");
assert.strictEqual(normalizeMac("0:11:22:33:44:55"), "00:11:22:33:44:55", "zero de tete restaure (macOS)");
assert.strictEqual(normalizeMac("pas-une-mac"), null);
assert.strictEqual(normalizeMac("aa:bb:cc:dd:ee"), null, "5 octets rejetes");
assert.strictEqual(normalizeMac(""), null);
console.log("  OK");

console.log("== isBroadcastOrMulticastMac : diffusion et multidiffusion ecartees ==");
assert.strictEqual(isBroadcastOrMulticastMac("ff-ff-ff-ff-ff-ff"), true, "diffusion");
assert.strictEqual(isBroadcastOrMulticastMac("01-00-5e-00-00-16"), true, "multidiffusion IPv4");
assert.strictEqual(isBroadcastOrMulticastMac("a4-2b-b0-11-22-33"), false, "adresse unicast reelle");
console.log("  OK");

/* ---------- Windows : arp -a ---------- */
console.log("== win32.parseArp : sortie reelle de `arp -a` en FRANCAIS ==");
{
  // Sortie telle que produite par un Windows francais : les en-tetes et
  // le mot "dynamique"/"statique" sont traduits, mais aucun n'est
  // utilise par le parseur -- c'est precisement ce qu'on verifie ici.
  const raw = [
    "",
    "Interface : 192.168.1.10 --- 0x5",
    "  Adresse Internet      Adresse physique      Type",
    "  192.168.1.1           a4-2b-b0-11-22-33     dynamique",
    "  192.168.1.42          00-1a-2b-3c-4d-5e     dynamique",
    "  192.168.1.255         ff-ff-ff-ff-ff-ff     statique",
    "  224.0.0.22            01-00-5e-00-00-16     statique",
    "  239.255.255.250       01-00-5e-7f-ff-fa     statique"
  ].join("\n");
  const allowed = new Set(["192.168.1.1", "192.168.1.42", "192.168.1.255"]);
  const found = win32.parseArp(raw, allowed);
  assert.deepStrictEqual(found, [
    { ip: "192.168.1.1", mac: "a4:2b:b0:11:22:33" },
    { ip: "192.168.1.42", mac: "00:1a:2b:3c:4d:5e" }
  ], "diffusion, multidiffusion et hors-perimetre ecartes");
  console.log("  OK: " + JSON.stringify(found));
}

console.log("== win32.parseArp : la meme sortie en ANGLAIS donne le meme resultat ==");
{
  const rawEn = [
    "",
    "Interface: 192.168.1.10 --- 0x5",
    "  Internet Address      Physical Address      Type",
    "  192.168.1.1           a4-2b-b0-11-22-33     dynamic",
    "  192.168.1.255         ff-ff-ff-ff-ff-ff     static"
  ].join("\n");
  const found = win32.parseArp(rawEn, null);
  assert.deepStrictEqual(found, [{ ip: "192.168.1.1", mac: "a4:2b:b0:11:22:33" }]);
  console.log("  OK independance a la langue confirmee");
}

console.log("== win32.parseArp : entree vide/malformee sans planter ==");
assert.deepStrictEqual(win32.parseArp("", null), []);
assert.deepStrictEqual(win32.parseArp(null, null), []);
assert.deepStrictEqual(win32.parseArp("n'importe quoi\n\n", null), []);
console.log("  OK");

/* ---------- Windows : code de sortie de ping ---------- */
console.log("== win32.pingSucceeded : le PIEGE de l'hote inaccessible ==");
{
  // Vraie reponse : le marqueur TTL= est present.
  const reply = "Reponse de 192.168.1.1 : octets=32 temps<1ms TTL=64";
  assert.strictEqual(win32.pingSucceeded(null, reply), true, "vraie reponse d'echo");

  // Piege : Windows renvoie un code de sortie NUL alors que la reponse
  // vient du routeur et non de l'hote vise. Sans le test TTL=, toutes
  // les adresses libres du sous-reseau seraient declarees actives.
  const unreachable = "Reponse de 192.168.1.10 : Hote de destination inaccessible.";
  assert.strictEqual(win32.pingSucceeded(null, unreachable), false, "hote inaccessible malgre un code de sortie nul");

  const timeout = "Delai d'attente de la demande depasse.";
  assert.strictEqual(win32.pingSucceeded(null, timeout), false, "delai depasse");
  assert.strictEqual(win32.pingSucceeded(new Error("killed"), ""), false);
  console.log("  OK");
}

console.log("== win32.pingArgs : delai converti en millisecondes ==");
assert.deepStrictEqual(win32.pingArgs("192.168.1.1", 1), ["-n", "1", "-w", "1000", "192.168.1.1"]);
assert.deepStrictEqual(linux.pingArgs("192.168.1.1", 1), ["-c", "1", "-W", "1", "192.168.1.1"], "Linux compte en secondes");
console.log("  OK");

/* ---------- Windows : ping -a (resolution inverse) ---------- */
console.log("== win32.parsePingHostname : nom extrait de `ping -a`, toutes langues ==");
{
  const fr = "\nEnvoi d'une requete 'Ping'  NAS-SALON [192.168.1.42] avec 32 octets de donnees :";
  assert.strictEqual(win32.parsePingHostname(fr, "192.168.1.42"), "NAS-SALON");

  const en = "\nPinging NAS-SALON [192.168.1.42] with 32 bytes of data:";
  assert.strictEqual(win32.parsePingHostname(en, "192.168.1.42"), "NAS-SALON");

  // Aucun nom resolu : Windows affiche l'adresse sans crochets, on doit
  // renvoyer null pour laisser le repli dns.reverse() intervenir.
  const noName = "\nEnvoi d'une requete 'Ping' 192.168.1.42 avec 32 octets de donnees :";
  assert.strictEqual(win32.parsePingHostname(noName, "192.168.1.42"), null, "pas de nom -> null");

  assert.strictEqual(win32.parsePingHostname("", "192.168.1.42"), null);
  assert.strictEqual(win32.parsePingHostname("peu importe", "pas-une-ip"), null);
  console.log("  OK");
}

/* ---------- Windows : volumes amovibles ---------- */
console.log("== win32.parseVolumesJson : objet seul, tableau, et absence de volume ==");
{
  // ConvertTo-Json produit un OBJET quand il n'y a qu'un seul volume.
  const single = '{"DeviceID":"E:","VolumeName":"CLE_VACANCES"}';
  assert.deepStrictEqual(win32.parseVolumesJson(single), [
    { label: "CLE_VACANCES", path: "E:" + path.sep }
  ]);

  const many = '[{"DeviceID":"E:","VolumeName":"CLE_VACANCES"},{"DeviceID":"F:","VolumeName":null}]';
  assert.deepStrictEqual(win32.parseVolumesJson(many), [
    { label: "CLE_VACANCES", path: "E:" + path.sep },
    { label: "F:", path: "F:" + path.sep } // cle sans nom : la lettre sert d'etiquette
  ]);

  assert.deepStrictEqual(win32.parseVolumesJson(""), [], "aucun volume branche");
  assert.deepStrictEqual(win32.parseVolumesJson("pas du json"), [], "sortie inattendue ignoree");
  assert.deepStrictEqual(win32.parseVolumesJson('{"DeviceID":"bidon"}'), [], "lettre de lecteur invalide");
  console.log("  OK");
}

/* ---------- Interface commune ---------- */
console.log("== interface : les trois implementations exposent les memes fonctions ==");
{
  const REQUIRED = [
    "id", "pingArgs", "pingSucceeded", "parseArp", "readArpEntries",
    "reverseLookup", "listRemovableVolumes", "cpuTemperature",
    "filesystemRoot", "exitKiosk", "exitToDesktop"
  ];
  for (const [name, impl] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    for (const fn of REQUIRED) {
      assert.ok(impl[fn] !== undefined, name + " doit exposer " + fn);
    }
  }
  console.log("  OK: " + REQUIRED.length + " membres verifies sur 3 implementations");
}

console.log("== platform : implementation choisie selon process.platform ==");
{
  const expected = ["linux", "win32", "darwin"].includes(process.platform) ? process.platform : "linux";
  assert.strictEqual(platform.id, expected, "repli sur Linux si plateforme inconnue");
  console.log("  OK: plateforme detectee = " + platform.id);
}

console.log("== platform.diskUsage : fs.statfs remplace `df` ==");
{
  platform.diskUsage().then((disk) => {
    assert.ok(disk, "usage disque disponible");
    assert.ok(disk.totalGB > 0, "taille totale positive");
    assert.ok(disk.usedGB >= 0 && disk.usedGB <= disk.totalGB, "utilise coherent");
    assert.ok(disk.pct >= 0 && disk.pct <= 100, "pourcentage dans [0,100]");
    console.log("  OK: " + disk.usedGB.toFixed(1) + " / " + disk.totalGB.toFixed(1) + " Go (" + disk.pct.toFixed(1) + " %)");

    /* ---------- Controleur de kiosque ---------- */
    console.log("== platform.registerKioskController : Electron prend la main ==");
    let reset = 0;
    let quit = 0;
    platform.registerKioskController({
      reset: () => { reset++; },
      quit: () => { quit++; }
    });
    assert.deepStrictEqual(platform.exitKiosk(), { ok: true });
    assert.deepStrictEqual(platform.exitToDesktop(), { ok: true });
    assert.strictEqual(reset, 1, "reset appele une fois");
    assert.strictEqual(quit, 1, "quit appele une fois");

    // Desenregistrement : on retombe sur l'implementation de la
    // plateforme (les commandes pkill sur le Pi).
    platform.registerKioskController(null);
    assert.ok(typeof platform.exitKiosk === "function");
    console.log("  OK");

    console.log("== platform.isDesktopApp : distingue application de bureau et navigateur ==");
    assert.strictEqual(platform.isDesktopApp(), false, "sans controleur : simple navigateur / Pi");
    platform.registerKioskController({ reset: () => {}, quit: () => {} });
    assert.strictEqual(platform.isDesktopApp(), true, "avec controleur : application de bureau");
    platform.registerKioskController(null);
    console.log("  OK");

    console.log("== platform.getAutoStart / setAutoStart : delegation au processus Electron ==");
    {
      // Sans controleur : la fonctionnalite est declaree indisponible,
      // ce qui masque la section de reglages cote interface.
      assert.deepStrictEqual(platform.getAutoStart(), { supported: false, enabled: false });
      assert.deepStrictEqual(platform.setAutoStart(true), { supported: false, enabled: false });

      let value = false;
      platform.registerKioskController({
        reset: () => {},
        quit: () => {},
        getAutoStart: () => value,
        setAutoStart: (v) => { value = !!v; }
      });
      assert.deepStrictEqual(platform.getAutoStart(), { supported: true, enabled: false });
      assert.deepStrictEqual(platform.setAutoStart(true), { supported: true, enabled: true });
      assert.deepStrictEqual(platform.getAutoStart(), { supported: true, enabled: true });
      assert.deepStrictEqual(platform.setAutoStart(false), { supported: true, enabled: false });

      // Une exception cote Electron ne doit jamais faire echouer la
      // route : elle est convertie en reponse "non supporte".
      platform.registerKioskController({
        reset: () => {},
        quit: () => {},
        getAutoStart: () => { throw new Error("acces refuse"); },
        setAutoStart: () => {}
      });
      const failed = platform.getAutoStart();
      assert.strictEqual(failed.supported, false);
      assert.ok(failed.reason, "raison de l'echec remontee");
      platform.registerKioskController(null);
      console.log("  OK");
    }

    console.log("\n>>> TOUS LES TESTS PLATFORM PASSENT");
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
