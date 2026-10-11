/* Tests hors ligne du suivi d'imprimante Bambu Lab (server/bambu.js) et
   des paliers d'affichage de la tuile. Aucun reseau, aucune imprimante :
   on verifie les decisions, pas la plomberie MQTT.

   Le rapport de reference reproduit la forme reelle publiee par une X1C
   (champs et unites), y compris le fait que l'imprimante n'envoie un
   etat COMPLET qu'une fois, puis uniquement des differences.

   Offline tests of the Bambu Lab printer monitoring and the tile's
   display levels. No network, no printer. */
"use strict";

const assert = require("assert");
const B = require("../server/bambu.js");
const W = require("../public/widgets/bambu/widget.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

const FULL = {
  gcode_state: "RUNNING",
  stg_cur: 2,
  mc_percent: 37,
  mc_remaining_time: 138,
  layer_num: 84,
  total_layer_num: 240,
  bed_temper: 58.5,
  bed_target_temper: 60,
  nozzle_temper: 219.8,
  nozzle_target_temper: 220,
  chamber_temper: 34,
  subtask_name: "Boitier capteur v3",
  gcode_file: "/data/Metadata/plate_1.gcode",
  printer_type: "X1C",
  spd_lvl: 2,
  cooling_fan_speed: "12",
  wifi_signal: "-48dBm",
  lights_report: [{ node: "chamber_light", mode: "on" }],
  hms: [],
  ams: {
    tray_now: "2",
    ams: [{
      id: "0", humidity: "3", temp: "28",
      tray: [
        { id: "0", tray_type: "PLA", tray_color: "FF6A13FF", remain: 62 },
        { id: "1", tray_type: "", tray_color: "" },
        { id: "2", tray_type: "PETG", tray_color: "1B7F4BFF", remain: 88 },
        { id: "3", tray_type: "", tray_color: "" }
      ]
    }]
  }
};

console.log("== Imprimante 3D Bambu Lab ==");

test("fusion : l'imprimante n'envoie que des differences, l'etat reste complet", () => {
  // C'est LE piege du protocole : sans fusion, la tuile clignoterait
  // entre un etat complet et trois champs.
  let state = B.mergeReport(null, FULL);
  state = B.mergeReport(state, { mc_percent: 38, nozzle_temper: 220.1 });
  assert.strictEqual(state.mc_percent, 38, "le nouveau chiffre est pris");
  assert.strictEqual(state.bed_temper, 58.5, "l'ancien est conserve");
  assert.strictEqual(state.subtask_name, "Boitier capteur v3");
});

test("fusion : un objet imbrique est fusionne, pas remplace", () => {
  const state = B.mergeReport({ a: { x: 1, y: 2 } }, { a: { y: 3 } });
  assert.deepStrictEqual(state.a, { x: 1, y: 3 });
});

test("fusion : un tableau remplace l'ancien (les plateaux arrivent complets)", () => {
  const state = B.mergeReport({ hms: [{ attr: 1, code: 2 }] }, { hms: [] });
  assert.deepStrictEqual(state.hms, []);
});

test("etat servi a la tuile : l'essentiel y est, dans une forme unique", () => {
  const p = B.snapshot(FULL, { model: "X1C", name: "Atelier" });
  assert.strictEqual(p.printing, true);
  assert.strictEqual(p.percent, 37);
  assert.strictEqual(p.layer, 84);
  assert.strictEqual(p.totalLayers, 240);
  assert.strictEqual(p.printName, "Boitier capteur v3");
  assert.strictEqual(p.bed.current, 58.5);
  assert.strictEqual(p.bed.target, 60);
  assert.strictEqual(p.nozzles.length, 1);
  assert.strictEqual(p.nozzles[0].target, 220);
  assert.strictEqual(p.name, "Atelier");
});

test("etape : le code est traduit dans les deux langues", () => {
  const p = B.snapshot(FULL, { model: "X1C" });
  assert.strictEqual(p.stage, 2);
  assert.strictEqual(p.stageLabel.fr, "Préchauffage du plateau");
  assert.strictEqual(p.stageLabel.en, "Heatbed preheating");
  assert.strictEqual(B.stageLabel(10).fr, "Inspection de la première couche");
  assert.strictEqual(B.stageLabel(255).en, "Idle");
});

test("etape : un code inconnu ne fabrique pas un libelle faux", () => {
  // Bambu en ajoute a chaque firmware : mieux vaut ne rien dire.
  assert.strictEqual(B.stageLabel(9999), null);
  assert.strictEqual(B.snapshot({ gcode_state: "RUNNING", stg_cur: 9999 }).stageLabel, null);
});

test("etat general : traduit lui aussi, et l'inconnu ne casse rien", () => {
  assert.strictEqual(B.stateLabel("FINISH").fr, "Terminée");
  assert.strictEqual(B.stateLabel("running").en, "Printing", "la casse est indifferente");
  assert.strictEqual(B.stateLabel("BIDULE"), null);
});

test("temps restant : des minutes, et l'heure de fin qui en decoule", () => {
  assert.strictEqual(B.remainingMs(138), 138 * 60000);
  const at = B.finishAt(138, new Date("2026-09-20T12:00:00Z"));
  assert.strictEqual(at.toISOString(), "2026-09-20T14:18:00.000Z");
});

test("temps restant : une valeur invraisemblable en minutes est relue en secondes", () => {
  // La documentation communautaire hesite entre minutes et secondes :
  // plutot que d'annoncer une fin dans deux ans, on choisit la lecture
  // qui a un sens.
  assert.strictEqual(B.remainingMs(36000), 36000 * 1000);
  assert.strictEqual(B.remainingMs(null), null);
  assert.strictEqual(B.remainingMs(-5), null);
});

test("machine a l'arret : pas d'heure de fin inventee", () => {
  const p = B.snapshot(Object.assign({}, FULL, { gcode_state: "FINISH" }));
  assert.strictEqual(p.printing, false);
  assert.strictEqual(p.finishAt, null);
  assert.strictEqual(p.printName, "Boitier capteur v3", "la derniere impression reste nommee");
});

test("modele : le code interne de Bambu est traduit en nom commercial", () => {
  /* Bambu ne publie pas le nom commercial : « BL-P001 » EST une X1
     Carbon. L'afficher brut n'apprend rien (1.115.6). */
  assert.strictEqual(B.modelName("BL-P001"), "X1 Carbon");
  assert.strictEqual(B.modelName("C12"), "P1S");
  assert.strictEqual(B.modelName("O1D"), "H2D");
  assert.strictEqual(B.modelName("bl-p001"), "X1 Carbon", "la casse est indifferente");
  assert.strictEqual(B.modelName("3DPrinter-X1-Carbon"), "X1 Carbon", "libelle deja lisible : nettoye");
  assert.strictEqual(B.modelName("machine inconnue"), "machine inconnue", "on n'invente pas de nom");
  assert.strictEqual(B.snapshot(FULL, { model: "BL-P001" }).model, "X1 Carbon");
});

test("modele : le code interne decide AUSSI de ce qui est affichable", () => {
  /* Le vrai degat du code brut : la detection du caisson cherchait
     « X1 » dans « BL-P001 » et echouait -- une X1 Carbon n'affichait
     donc pas la temperature de son caisson. */
  assert.strictEqual(B.capabilities("BL-P001").chamber, true, "une X1 Carbon mesure bien son caisson");
  assert.strictEqual(B.snapshot(FULL, { model: "BL-P001" }).chamber.current, 34);
  assert.strictEqual(B.capabilities("C12").chamber, false, "une P1S ne le publie pas");
  assert.strictEqual(B.capabilities("O1D").nozzles, 2, "la H2D et ses deux buses, par son code");
});

test("modele : le caisson n'est affiche que sur les machines qui le mesurent", () => {
  assert.strictEqual(B.capabilities("X1C").chamber, true);
  assert.strictEqual(B.capabilities("P1S").chamber, false);
  assert.strictEqual(B.capabilities("A1 mini").chamber, false);
  assert.strictEqual(B.snapshot(FULL, { model: "P1S" }).chamber, null, "pas de 0 °C pour un caisson absent");
  assert.strictEqual(B.snapshot(FULL, { model: "X1C" }).chamber.current, 34);
});

test("modele : la H2D porte deux buses", () => {
  assert.strictEqual(B.capabilities("H2D").nozzles, 2);
  const h2d = B.snapshot(Object.assign({}, FULL, {
    device: { extruder: { info: [{ temp: 2200, target_temp: 220 }, { temp: 1800, target_temp: 180 }] } }
  }), { model: "H2D" });
  assert.strictEqual(h2d.nozzles.length, 2);
  assert.strictEqual(h2d.nozzles[0].current, 220);
  assert.strictEqual(h2d.nozzles[1].target, 180);
  assert.strictEqual(h2d.chamber.current, 34);
});

test("nom de l'impression : le fichier sert de repli, sans chemin ni extension", () => {
  assert.strictEqual(B.printName({ gcode_file: "/data/Metadata/support gauche.gcode.3mf" }), "support gauche",
    "les deux extensions enchainees sont retirees");
  assert.strictEqual(B.printName({ gcode_file: "/cache/piece.3mf" }), "piece");
  assert.strictEqual(B.printName({}), "");
});

test("erreurs : le code lisible est celui de la base d'aide de Bambu", () => {
  assert.strictEqual(B.hmsCode(50331648, 65538), "0300_0000_0001_0002");
  assert.strictEqual(B.hmsCode("pas un nombre", 1), null);
  const p = B.snapshot(Object.assign({}, FULL, { hms: [{ attr: 50331648, code: 65538 }] }));
  assert.strictEqual(p.errors.length, 1);
  assert.ok(/wiki\.bambulab\.com/.test(p.errors[0].url), "un lien vers l'explication");
});

test("AMS : les bobines presentes, leur couleur, celle qui est engagee", () => {
  const p = B.snapshot(FULL, { model: "X1C" });
  assert.strictEqual(p.ams.length, 1);
  assert.strictEqual(p.ams[0].humidity, 3);
  const trays = p.ams[0].trays;
  assert.strictEqual(trays.length, 2, "les plateaux vides ne sont pas montres");
  assert.strictEqual(trays[0].color, "#FF6A13", "la transparence est retiree de la couleur");
  assert.strictEqual(trays[1].active, true, "le plateau 2 est celui qui sort");
  assert.strictEqual(trays[0].active, false);
});

test("decouverte : les entetes SSDP de Bambu donnent serie, modele et adresse", () => {
  const msg = [
    "NOTIFY * HTTP/1.1", "HOST: 239.255.255.250:1990",
    "Location: 192.168.1.42", "NT: urn:bambulab-com:device:3dprinter:1",
    "USN: 01P00A123456789", "DevModel.bambu.com: BL-P001",
    "DevName.bambu.com: Atelier", "DevVersion.bambu.com: 01.08.03.00", "", ""
  ].join("\r\n");
  const p = B.parseSsdp(msg, "192.168.1.42");
  assert.strictEqual(p.serial, "01P00A123456789");
  assert.strictEqual(p.host, "192.168.1.42");
  assert.strictEqual(p.model, "BL-P001");
  assert.strictEqual(p.name, "Atelier");
  assert.strictEqual(B.parseSsdp("rien du tout", "1.2.3.4"), null, "un message etranger est ignore");
});

test("compte Bambu : jeton obtenu, ou code de verification a reclamer", () => {
  assert.deepStrictEqual(B.loginOutcome({ accessToken: "abc" }), { ok: true, token: "abc" });
  assert.strictEqual(B.loginOutcome({ success: false, loginType: "verifyCode" }).needCode, true);
  assert.strictEqual(B.loginOutcome({ error: "mauvais mot de passe" }).ok, false);
});

test("compte Bambu : la double authentification par application est reconnue a part", () => {
  // Elle passe par un autre point d'entree, avec la cle remise ici.
  const out = B.loginOutcome({ loginType: "tfa", tfaKey: "cle-123" });
  assert.strictEqual(out.needCode, true);
  assert.strictEqual(out.tfa, true);
  assert.strictEqual(out.tfaKey, "cle-123");
});

test("compte Bambu : demander le code est une etape a part entiere", () => {
  /* C'est le correctif de la 1.115.1 : repondre « il me faut un code »
     ne le fait pas partir. Sans cet appel, la tuile attendait un
     courriel que personne n'avait demande. */
  assert.strictEqual(typeof B.cloudSendCode, "function");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "server", "bambu.js"), "utf8");
  assert.ok(/sendemail\/code/.test(src), "le point d'entree d'envoi du code est appele");
  assert.ok(/type: "codeLogin"/.test(src), "avec le type attendu par Bambu");
  const login = src.slice(src.indexOf("async function cloudLogin"), src.indexOf("async function cloudVerify"));
  assert.ok(/cloudSendCode/.test(login), "et il est appele depuis la connexion, pas laisse a l'appelant");
});

test("compte Bambu : le nom d'utilisateur MQTT se demande au COMPTE", () => {
  /* Correctif 1.115.5 : le courtier attend « u_<numero de compte> », et
     ce numero s'obtient aupres du compte. Le deduire du seul jeton
     donnait un nom vide ou faux -- d'ou « Not authorized ». Le jeton
     n'est qu'un repli. */
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "server", "bambu.js"), "utf8");
  assert.ok(/design-user-service\/my\/preference/.test(src),
    "le numero de compte est demande a l'API du compte");
  const resolver = src.slice(src.indexOf("async function mqttUsername"), src.indexOf("const links"));
  assert.ok(/cloudUserId/.test(resolver) && /userIdFromToken/.test(resolver),
    "avec le jeton en repli quand l'appel echoue");
});

test("compte Bambu : le repli par le jeton accepte les champs possibles", () => {
  const jwt = (payload) => "entete." + Buffer.from(JSON.stringify(payload), "utf8").toString("base64") + ".signature";
  assert.strictEqual(B.userIdFromToken(jwt({ username: "u_1234567" })), "u_1234567");
  assert.strictEqual(B.userIdFromToken(jwt({ uid: 1234567 })), "u_1234567", "le prefixe est ajoute si besoin");
  assert.strictEqual(B.userIdFromToken(jwt({ preferred_username: "u_9" })), "u_9");
  assert.strictEqual(B.userIdFromToken(jwt({ autre: 1 })), null, "rien d'exploitable : on ne devine pas");
  assert.strictEqual(B.userIdFromToken("pas un jeton"), null);
});

test("refus du courtier : le message distingue le cloud du reseau local", () => {
  // Afficher « vérifiez le code d'accès LAN » a quelqu'un qui est en
  // liaison cloud l'envoie chercher au mauvais endroit.
  assert.strictEqual(B.diagnose({ connected: false, hasData: false, errorKind: "auth", diag: { mode: "cloud" } }), "cloud-auth");
  assert.strictEqual(B.diagnose({ connected: false, hasData: false, errorKind: "auth", diag: { mode: "lan" } }), "auth");
});

test("compte Bambu : seuls les DEUX hotes qui existent vraiment sont utilises", () => {
  /* Le bug de la 1.115.3 : l'hote etait FABRIQUE a partir du code de
     region, ce qui donnait « eu.mqtt.bambulab.com » -- un nom qui
     n'existe pas. Tout compte europeen echouait sur un ENOTFOUND avant
     meme d'essayer de se connecter. Il n'y a que le mondial et le
     chinois. */
  const REAL = ["us.mqtt.bambulab.com", "cn.mqtt.bambulab.com"];
  for (const r of ["eu", "us", "global", "cn", "bidule", "", null, undefined, "EU"]) {
    assert.ok(REAL.indexOf(B.cloudHost(r)) >= 0, "region « " + r + " » -> " + B.cloudHost(r));
  }
  assert.strictEqual(B.cloudHost("cn"), "cn.mqtt.bambulab.com", "la Chine a bien son infrastructure");
  assert.strictEqual(B.cloudHost("eu"), "us.mqtt.bambulab.com",
    "l'Europe est servie par l'infrastructure mondiale, pas par un hote europeen");
  assert.strictEqual(B.cloudApiHost("cn"), "api.bambulab.cn");
  assert.strictEqual(B.cloudApiHost("eu"), "api.bambulab.com");
});

test("compte Bambu : aucun nom d'hote n'est assemble a partir d'un code", () => {
  // La regle qui empeche le bug de revenir : les hotes sont une liste
  // fermee, pas une concatenation.
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "server", "bambu.js"), "utf8");
  assert.ok(!/["'`]\s*\+\s*["'`]\.mqtt\.bambulab\.com/.test(src),
    "un hote MQTT ne doit jamais etre construit par concatenation");
  assert.deepStrictEqual(Object.keys(B.CLOUD_HOSTS).sort(), ["china", "global"]);
});

test("diagnostic : chaque panne courante recoit une cause nommee", () => {
  assert.strictEqual(B.describeError(new Error("connect ECONNREFUSED 192.168.1.42:8883")), "refused");
  assert.strictEqual(B.describeError(new Error("connect ETIMEDOUT")), "unreachable");
  assert.strictEqual(B.describeError(new Error("Connection refused: Not authorized")), "auth");
  assert.strictEqual(B.describeError(new Error("getaddrinfo ENOTFOUND x")), "dns");
});

test("liaison muette : la cause est nommee, pas subie", () => {
  /* Le cas signale a l'usage sur la 1.115.2 : connecte au cloud, mais
     « Connexion a l'imprimante... » pour toujours. Une imprimante en
     mode LAN UNIQUEMENT est coupee des serveurs de Bambu -- les deux
     reglages s'excluent. */
  const connectedSilent = (mode, waited) => ({
    connected: true, hasData: false,
    diag: { mode, waitedMs: waited, subscribed: true, messages: 0 }
  });
  assert.strictEqual(B.diagnose(connectedSilent("cloud", 3000)), null, "on laisse sa chance au demarrage");
  assert.strictEqual(B.diagnose(connectedSilent("cloud", 30000)), "cloud-silent");
  assert.strictEqual(B.diagnose(connectedSilent("cloud", 30000), { cloudOnline: false }), "printer-offline",
    "Bambu la dit hors ligne : c'est la reponse la plus precise");
  assert.strictEqual(B.diagnose(connectedSilent("lan", 30000)), "lan-silent");
});

test("liaison muette : un abonnement refuse ne passe pas pour une attente", () => {
  // Echec silencieux typique : connecte, mais rien n'arrivera jamais.
  assert.strictEqual(B.diagnose({
    connected: true, hasData: false,
    diag: { mode: "cloud", waitedMs: 3000, subscribeError: "refusé / refused" }
  }), "subscribe");
});

test("liaison muette : des donnees recues valent mieux qu'un diagnostic", () => {
  assert.strictEqual(B.diagnose({ connected: true, hasData: true, diag: { waitedMs: 999999 } }), null);
});

test("liaison muette : une connexion qui ne s'etablit pas finit par se dire", () => {
  const st = { connected: false, hasData: false, diag: { mode: "cloud", waitedMs: 5000 } };
  assert.strictEqual(B.diagnose(st), null);
  st.diag.waitedMs = 30000;
  assert.strictEqual(B.diagnose(st), "no-connect");
  assert.strictEqual(B.diagnose({ connected: false, hasData: false, errorKind: "auth", diag: {} }), "auth");
});

/* ---------- Verification en ligne, si le reseau est la ----------
   Un test hors ligne ne peut pas dire qu'un nom d'hote existe ; celui-ci
   le demande vraiment au DNS. Sans reseau, il s'abstient plutot que
   d'echouer a tort -- c'est le cas sur une machine de construction
   isolee.
   An offline test cannot tell whether a host name exists; this one
   really asks DNS, and abstains when there is no network. */
async function dnsCheck() {
  const dns = require("dns").promises;
  let reachable = true;
  try { await dns.lookup("api.bambulab.com"); }
  catch (e) { reachable = false; }
  if (!reachable) {
    console.log("  (ignore) verification DNS des hotes Bambu : pas de reseau");
    return;
  }
  for (const host of [B.cloudHost("eu"), B.cloudHost("cn"), B.cloudApiHost("eu")]) {
    try {
      await dns.lookup(host);
      console.log("  OK   l'hote " + host + " existe bel et bien");
    } catch (e) {
      failures++;
      console.log("  FAIL l'hote " + host + " n'existe pas (" + e.code + ")");
    }
  }
}

console.log("== Paliers d'affichage de la tuile ==");

test("palier : plus la tuile est petite, plus on retire", () => {
  assert.strictEqual(W.levelFor(420, 320), "full");
  assert.strictEqual(W.levelFor(280, 220), "rich");
  assert.strictEqual(W.levelFor(220, 160), "mid");
  assert.strictEqual(W.levelFor(180, 120), "lite");
  assert.strictEqual(W.levelFor(90, 70), "bare");
});

test("palier : l'avancement est le dernier a partir", () => {
  // C'est l'engagement de la tuile : quelle que soit sa taille, on voit
  // ou en est l'impression.
  for (const name of Object.keys(W.SHOWN)) {
    assert.ok(W.SHOWN[name], name);
  }
  assert.strictEqual(W.SHOWN.bare.temps, false);
  assert.strictEqual(W.SHOWN.bare.ams, false);
  assert.strictEqual(W.SHOWN.bare.stage, false);
  assert.strictEqual(W.SHOWN.full.ams, true);
  // Une tuile aplatie retombe sur le palier reduit, pas sur le complet.
  assert.strictEqual(W.levelFor(600, 80), "bare");
});

test("duree : lisible de loin, dans les deux langues", () => {
  assert.strictEqual(W.duration(138 * 60000, "fr"), "2 h 18");
  assert.strictEqual(W.duration(120 * 60000, "fr"), "2 h");
  assert.strictEqual(W.duration(7 * 60000, "fr"), "7 min");
  assert.strictEqual(W.duration(138 * 60000, "en"), "2h 18m");
  assert.strictEqual(W.duration(null, "fr"), "");
});

test("temperature : une mesure absente n'affiche pas zero", () => {
  assert.strictEqual(W.temp(58.5), "59°");
  assert.strictEqual(W.temp(null), "—");
});

dnsCheck().then(() => {
  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failures ? 1 : 0);
});
