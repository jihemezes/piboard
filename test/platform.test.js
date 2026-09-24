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
    "filesystemRoot", "exitKiosk", "exitToDesktop",
    "updateSupport", "restartServer", "gpuUsage",
    "ffmpegCandidates", "ffmpegInstallHint", "vlcCandidates", "vlcInstallHint"
  ];
  for (const [name, impl] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    for (const fn of REQUIRED) {
      assert.ok(impl[fn] !== undefined, name + " doit exposer " + fn);
    }
  }
  console.log("  OK: " + REQUIRED.length + " membres verifies sur 3 implementations");
}

/* ---------- Recherche de ffmpeg ---------- */
console.log("== ffmpeg : emplacements et conseil d'installation propres a chaque systeme ==");
{
  for (const [name, impl] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    const candidates = impl.ffmpegCandidates();
    assert.ok(Array.isArray(candidates) && candidates.length > 0, name + " doit proposer au moins un emplacement");
    assert.ok(candidates.every((p) => typeof p === "string" && p.length), name + " : tous les emplacements sont des chaines non vides");
    const hint = impl.ffmpegInstallHint();
    assert.ok(hint && hint.fr && hint.en, name + " doit fournir un conseil d'installation bilingue");
  }
  // Windows est le cas ou la detection compte vraiment : ffmpeg n'y est
  // pas fourni par le systeme et se retrouve rarement dans le PATH.
  // Windows is where detection genuinely matters: ffmpeg doesn't ship
  // with the system there and rarely ends up in PATH.
  const winCandidates = win32.ffmpegCandidates();
  assert.ok(winCandidates.some((p) => p.endsWith(".exe")), "win32 doit chercher des executables .exe");
  assert.ok(winCandidates.length > 1, "win32 doit chercher au-dela du seul PATH");
  assert.ok(!win32.ffmpegInstallHint().fr.includes("apt"), "win32 ne doit pas conseiller une commande Linux");
  assert.ok(!darwin.ffmpegInstallHint().fr.includes("apt"), "macOS ne doit pas conseiller une commande Linux");

  // Emplacement de l'etape optionnelle d'installation (voir
  // build/installer.nsh) : verifie en PREMIER, c'est le cas le plus
  // probable si l'utilisateur a accepte cette etape a l'installation.
  // Optional installer step's location (see build/installer.nsh):
  // checked FIRST, the most likely case if the user accepted that step
  // at install time.
  const prevAppData = process.env.APPDATA;
  process.env.APPDATA = "C:\\Users\\Test\\AppData\\Roaming";
  const winCandidatesWithAppData = win32.ffmpegCandidates();
  assert.ok(winCandidatesWithAppData[0].includes("PiBoard\\ffmpeg\\ffmpeg.exe"),
    "l'emplacement de l'installeur doit etre en premiere position quand APPDATA est defini");
  if (prevAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = prevAppData;

  console.log("  OK: 3 implementations, conseils d'installation distincts et adaptes");
}

/* ---------- Recherche de VLC (relais des chaines en direct) ---------- */
console.log("== VLC : emplacements et conseil d'installation propres a chaque systeme ==");
{
  for (const [name, impl] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    const candidates = impl.vlcCandidates();
    assert.ok(Array.isArray(candidates) && candidates.length > 0, name + " doit proposer au moins un emplacement VLC");
    const hint = impl.vlcInstallHint();
    assert.ok(hint && hint.fr && hint.en, name + " doit fournir un conseil d'installation VLC bilingue");
  }
  // Linux utilise cvlc (script qui ajoute --intf dummy automatiquement) ;
  // Windows/macOS n'ont PAS de cvlc distinct -- le code appelant doit
  // donc passer --intf dummy explicitement pour fonctionner
  // identiquement sur les trois systemes.
  // Linux uses cvlc (a script that adds --intf dummy automatically);
  // Windows/macOS have NO separate cvlc -- the calling code must
  // therefore pass --intf dummy explicitly to work identically across
  // all three systems.
  assert.ok(linux.vlcCandidates().some((p) => p.includes("cvlc")), "linux doit chercher cvlc");
  assert.ok(!win32.vlcCandidates().some((p) => p.toLowerCase().includes("cvlc")), "win32 ne doit PAS chercher cvlc.exe (n'existe pas)");
  assert.ok(win32.vlcCandidates().some((p) => p.endsWith("vlc.exe")), "win32 doit chercher vlc.exe");
  assert.ok(darwin.vlcCandidates().some((p) => p.includes(".app/Contents/MacOS/VLC")), "darwin doit chercher le binaire a l'interieur du bundle .app");
  console.log("  OK: cvlc sur Linux uniquement, vlc.exe/VLC sans wrapper sur Windows/macOS");
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

/* ---------- Extinction reelle de l'ecran ----------
   L'ordre des methodes n'est pas indifferent : Pi OS a change deux fois
   de pile graphique, et vcgencmd -- longtemps la reponse evidente sur
   Raspberry Pi -- ne fonctionne plus avec le pilote KMS des versions
   recentes. Il doit donc rester en DERNIER recours, jamais en tete.
   Et une inversion "on"/"off" passerait inapercue jusqu'a l'ecran reste
   noir : c'est verifie explicitement. */
{
  const linux = require("../server/platform/linux.js");
  const off = linux.displayPowerCommands(false, "HDMI-A-1");
  const on = linux.displayPowerCommands(true, "HDMI-A-1");
  const methods = off.map((c) => c.method);

  assert.strictEqual(methods[0], "wlopm",
    "Wayland d'abord : c'est la pile de Pi OS Bookworm et Trixie");
  assert.strictEqual(methods[methods.length - 1], "vcgencmd",
    "vcgencmd en dernier recours : inoperant avec le pilote KMS recent");
  assert.ok(methods.indexOf("xset") > methods.indexOf("wlr-randr"),
    "X11 apres Wayland");

  assert.deepStrictEqual(off[0].args, ["--off", "*"], "wlopm eteint bien");
  assert.deepStrictEqual(on[0].args, ["--on", "*"], "et rallume bien");
  assert.deepStrictEqual(off.find((c) => c.method === "xset").args, ["dpms", "force", "off"]);
  assert.deepStrictEqual(on.find((c) => c.method === "xset").args, ["dpms", "force", "on"]);
  assert.deepStrictEqual(off.find((c) => c.method === "vcgencmd").args, ["display_power", "0"]);
  assert.deepStrictEqual(on.find((c) => c.method === "vcgencmd").args, ["display_power", "1"]);

  /* Sans nom de sortie (wlr-randr absent), la methode correspondante est
     sautee plutot que lancee avec un argument vide. */
  assert.ok(!linux.displayPowerCommands(false, null).some((c) => c.method === "wlr-randr"),
    "wlr-randr saute quand la sortie n'a pas pu etre lue");

  /* Les trois plateformes exposent la meme surface ; Windows et macOS
     repondent franchement que ce n'est pas supporte plutot que d'echouer
     a l'usage. */
  for (const name of ["win32", "darwin"]) {
    const mod = require("../server/platform/" + name + ".js");
    assert.strictEqual(typeof mod.setDisplayPower, "function", name + " expose setDisplayPower");
  }
  console.log("  OK extinction reelle de l'ecran : ordre des methodes et on/off");
}

/* ---------- Extinction : diagnostic d'un refus (1.111.1) ----------
   Le message etait identique quelle que soit la cause. On verifie ici
   le classement des causes et la lecture des sorties systeme reelles.
   Shutdown: diagnosing a refusal. */
{
  const linux = require("../server/platform/linux.js");
  const C = linux.classifyShutdownFailure;
  assert.strictEqual(C({ pk: { powerOff: false, multi: false, inhibit: false } }), "no-rule",
    "power-off refuse : la regle manque (Pi installe avant 1.104.0)");
  assert.strictEqual(C({ pk: { powerOff: true, multi: false }, otherUsers: ["bob"] }), "multiple-sessions",
    "autre utilisateur connecte, droit multi-sessions absent");
  assert.strictEqual(C({ pk: { powerOff: true, multi: true }, otherUsers: ["bob"] }), "unknown",
    "multi-sessions autorise : ce n'est pas la cause");
  assert.strictEqual(C({ pk: { powerOff: true, inhibit: false }, blockers: ["x"] }), "inhibited",
    "verrou bloquant, droit de passer outre absent");
  assert.strictEqual(C({ pk: { powerOff: null }, error: "Access denied" }), "no-rule",
    "sans pkcheck, le message systeme suffit a reconnaitre le refus");
  assert.strictEqual(C({ pk: {}, error: "Failed to connect to bus" }), "unknown");

  const sessions = [
    "     1 1000 jeanmichel seat0 tty7 active no",
    "     4 1000 jeanmichel -     pts/0 active no",
    "     7 1001 bob        -     pts/1 active no",
    ""
  ].join("\n");
  assert.deepStrictEqual(linux.parseOtherUsers(sessions, "jeanmichel"), ["bob"],
    "seuls les AUTRES utilisateurs comptent");
  assert.deepStrictEqual(linux.parseOtherUsers("", "jeanmichel"), []);

  const inhibitors = [
    "ModemManager 0 root 863 ModemManager sleep ModemManager needs to reset devices delay",
    "Unattended Upgrades Shutdown 0 root 900 unattended-upgr shutdown Stop ongoing upgrades delay",
    "packagekitd 0 root 1200 packagekitd shutdown:sleep Packages are being installed block"
  ].join("\n");
  const blockers = linux.parseBlockers(inhibitors);
  assert.strictEqual(blockers.length, 1, "seul un verrou BLOQUANT sur l'extinction compte");
  assert.ok(/packagekitd/.test(blockers[0]));
  console.log("  OK extinction : causes d'un refus identifiees");
}

/* ================= MEMOIRE UTILISEE / MEMORY IN USE (1.122.0) =================
   Le releve macOS ci-dessous est REEL : Mac mini 32 Gio, Apple Silicon
   (donc 16 Kio par page), capture en meme temps qu'une copie d'ecran du
   Moniteur d'activite. C'est ce qui permet de verifier le calcul contre
   ce que le systeme affiche lui-meme, plutot que contre une formule
   trouvee en ligne -- et depuis n'importe quelle machine, Pi compris.

   The macOS reading below is REAL: 32 GiB Apple Silicon Mac mini (hence
   16 KiB pages), captured alongside an Activity Monitor screenshot.
   That is what lets the calculation be checked against what the system
   itself displays, from any machine. */
{
  const GiB = 1024 ** 3;
  const VM_STAT = [
    "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
    "Pages free:                                    10859.",
    "Pages active:                                 492044.",
    "Pages inactive:                               492609.",
    "Pages speculative:                               281.",
    "Pages throttled:                                   0.",
    "Pages wired down:                             231835.",
    "Pages purgeable:                                   2.",
    "File-backed pages:                            299223.",
    "Anonymous pages:                              685711.",
    "Pages stored in compressor:                  1582322.",
    "Pages occupied by compressor:                 819216.",
    ""
  ].join("\n");
  const TOTAL = 34359738368;

  const mac = darwin.parseVmStat(VM_STAT, TOTAL);
  assert.ok(mac, "le releve macOS doit etre interprete");
  assert.strictEqual(mac.totalBytes, TOTAL);
  /* Le Moniteur d'activite affichait 27,27 Gio utilises. On tolere un
     ecart d'un gigaoctet : il ajoute une part de memoire noyau qu'il ne
     detaille pas, et les deux releves sont separes de quelques
     secondes. Ce qui compte est l'ORDRE DE GRANDEUR -- 26,5 et non 31,8
     comme le donnait os.freemem().
     Activity Monitor showed 27.27 GiB used. A one-gigabyte tolerance:
     what matters is the ORDER OF MAGNITUDE -- 26.5, not the 31.8
     os.freemem() used to give. */
  const usedGiB = mac.usedBytes / GiB;
  assert.ok(Math.abs(usedGiB - 27.27) < 1,
    `macOS : ${usedGiB.toFixed(2)} Gio attendu proche des 27,27 du Moniteur d'activite`);
  assert.ok(Math.abs(mac.cachedBytes / GiB - 4.60) < 0.1,
    "macOS : les fichiers mis en cache doivent retomber sur les 4,60 Gio affiches");

  /* LE TEST QUI DIT POURQUOI CE CORRECTIF EXISTE : l'ancien calcul, sur
     ce meme releve, annoncait 99 % sur une machine qui n'etait qu'aux
     deux tiers. Si un jour quelqu'un revient a os.freemem() sous macOS,
     cette ligne le dira.
     THE TEST THAT SAYS WHY THIS FIX EXISTS: the old calculation
     announced 99% on a machine that was two-thirds full. */
  const oldPercent = ((TOTAL - 10859 * 16384) / TOTAL) * 100;
  assert.ok(oldPercent > 99, "l'ancien calcul annoncait bien la saturation");
  assert.ok(mac.usedBytes / TOTAL * 100 < 90,
    "le nouveau calcul ne doit plus annoncer une machine saturee");

  assert.strictEqual(darwin.parseVmStat("", TOTAL), null, "sortie vide : aucun chiffre invente");
  assert.strictEqual(darwin.parseVmStat(VM_STAT, 0), null, "total inconnu : aucun chiffre invente");
  assert.strictEqual(darwin.parseVmStat("page size of 0 bytes", TOTAL), null,
    "taille de page absurde : aucun chiffre invente");
  /* Un releve dont la somme depasserait la RAM physique trahit un
     format inattendu : on prefere ne rien rendre. A reading exceeding
     physical RAM betrays an unexpected format. */
  assert.strictEqual(darwin.parseVmStat(VM_STAT, 1024 * 1024 * 1024), null,
    "somme superieure au total physique : releve ecarte");
  // Taille de page Intel (4096) : le calcul doit suivre l'en-tete et
  // non supposer 16 Kio. Intel page size: follow the header.
  const intel = darwin.parseVmStat(VM_STAT.replace("16384 bytes", "4096 bytes"), TOTAL);
  assert.ok(Math.abs(intel.usedBytes * 4 - mac.usedBytes) < 4,
    "la taille de page est bien lue dans l'en-tete, pas supposee");
  console.log("  OK macOS : la memoire utilisee retombe sur le Moniteur d'activite");

  /* Linux : MemAvailable, et non MemFree. Le releve ci-dessous est
     celui d'un Pi ou le cache occupe l'essentiel de la memoire -- le
     cas exact ou les deux valeurs divergent.
     Linux: MemAvailable, not MemFree. */
  const MEMINFO = [
    "MemTotal:        8127816 kB",
    "MemFree:          214536 kB",
    "MemAvailable:    6520140 kB",
    "Buffers:          132048 kB",
    "Cached:          5904312 kB",
    "SwapTotal:        102396 kB",
    ""
  ].join("\n");
  const lin = linux.parseMeminfo(MEMINFO);
  assert.ok(lin, "le /proc/meminfo doit etre interprete");
  assert.strictEqual(lin.totalBytes, 8127816 * 1024);
  assert.strictEqual(lin.usedBytes, (8127816 - 6520140) * 1024, "utilise = total - MemAvailable");
  assert.ok(lin.usedBytes / lin.totalBytes * 100 < 25,
    "avec MemAvailable, un Pi dont le cache est plein n'est pas annonce sature");
  const viaMemFree = (8127816 - 214536) / 8127816 * 100;
  assert.ok(viaMemFree > 95, "MemFree seul aurait annonce la saturation");
  assert.strictEqual(lin.cachedBytes, (5904312 + 132048) * 1024, "cache = Cached + Buffers");
  // Noyau anterieur a 3.14 : pas de MemAvailable, repli sur MemFree
  // plutot que rien. Pre-3.14 kernel: fall back to MemFree, not to null.
  const old = linux.parseMeminfo(MEMINFO.split("\n").filter((l) => !/^MemAvailable/.test(l)).join("\n"));
  assert.ok(old && old.usedBytes === (8127816 - 214536) * 1024, "repli sur MemFree si MemAvailable absent");
  assert.strictEqual(linux.parseMeminfo(""), null);
  assert.strictEqual(linux.parseMeminfo("MemTotal: 8127816 kB"), null, "sans memoire libre, aucun chiffre invente");
  console.log("  OK Linux : MemAvailable plutot que MemFree");

  /* L'interface commune : les trois plateformes exposent memoryUsage,
     et la couche partagee rend toujours quelque chose d'exploitable --
     une jauge absente serait pire qu'un chiffre approche.
     The shared interface: all three expose memoryUsage, and the shared
     layer always returns something usable. */
  for (const [name, mod] of [["linux", linux], ["win32", win32], ["darwin", darwin]]) {
    assert.strictEqual(typeof mod.memoryUsage, "function", name + " : memoryUsage doit exister");
  }
  assert.strictEqual(typeof platform.memoryUsage, "function",
    "la couche commune doit exposer memoryUsage");
}

console.log("Tests plateforme : memoire OK");
