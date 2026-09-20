/* ============================================================
   PiBoard - server/bambu.js
   Suivi d'une imprimante 3D Bambu Lab (X1C, P1S, A1, H2D...).

   DEUX VOIES, AU CHOIX DANS LA TUILE
   - LIAISON DIRECTE (reseau local). L'imprimante heberge son propre
     courtier MQTT sur le port 8883 : identifiant « bblp », mot de passe
     = le code d'acces LAN affiche sur son ecran. Rien ne sort du
     reseau, et l'imprimante pousse son etat d'elle-meme -- pas
     d'interrogation repetee. C'est la voie a preferer pour un kiosque.
     Prealable, depuis les firmwares X1 01.08.03 / P1 01.08.02 /
     A1 01.05 / H2D 01.01 : activer sur l'ecran de l'imprimante le
     « mode LAN » PUIS le « mode developpeur » (Reglages > Reseau), avec
     un redemarrage apres la premiere activation. Sans cela l'acces
     local est ferme, et c'est le message que la tuile affiche.
   - LIAISON CLOUD. Meme protocole, mais chez Bambu
     (<region>.mqtt.bambulab.com), authentifie par le compte. Utile
     quand le PiBoard n'est pas sur le meme reseau que l'imprimante. La
     connexion au compte demande generalement un code de verification
     envoye par courriel : la tuile le reclame une fois, puis le jeton
     obtenu est conserve chiffre comme les autres secrets.

   CE QUE FAIT CE MODULE. Il tient UNE connexion par tuile, garde le
   dernier etat complet connu, et le sert a la tuile qui l'interroge.
   Il ne pilote rien : aucune commande n'est envoyee a l'imprimante en
   dehors de la demande d'etat initiale (« pushall »). La tuile est un
   afficheur, pas une telecommande.

   POURQUOI UN ETAT FUSIONNE. L'imprimante n'envoie un etat complet
   qu'une fois, puis uniquement des DIFFERENCES (souvent trois champs).
   Lire le dernier message recu donnerait donc une tuile qui clignote
   entre des valeurs completes et des valeurs manquantes : les rapports
   sont fusionnes dans un etat unique, qui est le seul a etre affiche.

   Monitoring a Bambu Lab 3D printer, over the local network (the
   printer's own MQTT broker) or through Bambu's cloud. Read-only: no
   command is ever sent beyond the initial state request. Reports are
   MERGED, because the printer only sends a full state once and then
   sends differences.
   ============================================================ */

"use strict";

const dgram = require("dgram");
const https = require("https");

/* ---------- Etapes de l'imprimante (stg_cur) ----------
   Table publiee par la communaute (OpenBambuAPI) et verifiee contre
   l'integration Home Assistant. Un code inconnu n'est pas une erreur :
   Bambu en ajoute a chaque firmware, la tuile affiche alors l'etat
   general plutot qu'un libelle invente.
   Stage table; an unknown code is not an error. */
const STAGES = {
  0: { fr: "Impression", en: "Printing" },
  1: { fr: "Nivellement automatique du plateau", en: "Auto bed levelling" },
  2: { fr: "Préchauffage du plateau", en: "Heatbed preheating" },
  3: { fr: "Vérification mécanique XY", en: "Sweeping XY mech mode" },
  4: { fr: "Changement de filament", en: "Changing filament" },
  5: { fr: "Pause programmée (M400)", en: "M400 pause" },
  6: { fr: "Pause : filament épuisé", en: "Paused: filament runout" },
  7: { fr: "Chauffe de la buse", en: "Heating nozzle" },
  8: { fr: "Calibration de l'extrusion", en: "Calibrating extrusion" },
  9: { fr: "Analyse de la surface du plateau", en: "Scanning bed surface" },
  10: { fr: "Inspection de la première couche", en: "Inspecting first layer" },
  11: { fr: "Identification du plateau", en: "Identifying build plate" },
  12: { fr: "Calibration du micro-lidar", en: "Calibrating micro lidar" },
  13: { fr: "Prise d'origine", en: "Homing toolhead" },
  14: { fr: "Nettoyage de la buse", en: "Cleaning nozzle tip" },
  15: { fr: "Contrôle de la température de buse", en: "Checking extruder temperature" },
  16: { fr: "Pause demandée", en: "Paused by user" },
  17: { fr: "Pause : capot ouvert", en: "Paused: front cover falling" },
  18: { fr: "Calibration du micro-lidar", en: "Calibrating micro lidar" },
  19: { fr: "Calibration du débit", en: "Calibrating extrusion flow" },
  20: { fr: "Pause : défaut de température de buse", en: "Paused: nozzle temperature malfunction" },
  21: { fr: "Pause : défaut de température de plateau", en: "Paused: bed temperature malfunction" },
  22: { fr: "Déchargement du filament", en: "Filament unloading" },
  23: { fr: "Pause : saut de pas", en: "Paused: skipped step" },
  24: { fr: "Chargement du filament", en: "Filament loading" },
  25: { fr: "Calibration des moteurs", en: "Motor noise calibration" },
  26: { fr: "Pause : AMS injoignable", en: "Paused: AMS lost" },
  27: { fr: "Pause : ventilateur du heat break trop lent", en: "Paused: heat break fan too slow" },
  28: { fr: "Pause : régulation du caisson en défaut", en: "Paused: chamber temperature control error" },
  29: { fr: "Refroidissement du caisson", en: "Cooling chamber" },
  30: { fr: "Pause demandée par le G-code", en: "Paused by G-code" },
  31: { fr: "Démonstration moteurs", en: "Motor noise showoff" },
  32: { fr: "Pause : filament détecté sur la buse", en: "Paused: filament on nozzle" },
  33: { fr: "Pause : erreur du massicot", en: "Paused: cutter error" },
  34: { fr: "Pause : erreur de première couche", en: "Paused: first layer error" },
  35: { fr: "Pause : buse bouchée", en: "Paused: nozzle clog" },
  255: { fr: "En attente", en: "Idle" }
};

/* Etat general renvoye par l'imprimante. */
const GCODE_STATES = {
  IDLE: { fr: "En attente", en: "Idle" },
  PREPARE: { fr: "Préparation", en: "Preparing" },
  SLICING: { fr: "Découpe", en: "Slicing" },
  RUNNING: { fr: "Impression", en: "Printing" },
  PAUSE: { fr: "En pause", en: "Paused" },
  FINISH: { fr: "Terminée", en: "Finished" },
  FAILED: { fr: "Échec", en: "Failed" }
};

function stageLabel(code) {
  const s = STAGES[Number(code)];
  return s || null;
}

function stateLabel(code) {
  return GCODE_STATES[String(code || "").toUpperCase()] || null;
}

/* ---------- Ce que le modele sait faire ----------
   Le caisson n'est mesure que sur les machines fermees ; seule la H2D
   porte deux buses. Sans ce filtre, la tuile afficherait « 0 °C » pour
   un caisson qui n'existe pas -- pire qu'une absence.
   What the model can do: only enclosed machines measure the chamber,
   only the H2D has two nozzles. */
function capabilities(model) {
  const m = String(model || "").toUpperCase();
  const isH2 = /H2/.test(m);
  return {
    chamber: isH2 || /X1|X2/.test(m),
    nozzles: isH2 ? 2 : 1,
    camera: true
  };
}

/* ---------- Fusion des rapports ----------
   Fusion en profondeur, l'imprimante n'envoyant que des differences.
   Un tableau remplace l'ancien (les plateaux de l'AMS arrivent
   complets) ; null efface.
   Deep merge: the printer only sends differences. */
function mergeReport(base, patch) {
  const out = Object.assign({}, base || {});
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    if (v === null) { delete out[k]; continue; }
    if (Array.isArray(v)) { out[k] = v; continue; }
    if (v && typeof v === "object") { out[k] = mergeReport(out[k], v); continue; }
    out[k] = v;
  }
  return out;
}

/* Une valeur absente n'est pas un zero : Number(null) vaut 0, ce qui
   afficherait « 0 °C » pour une sonde qui n'a rien renvoye.
   A missing value is not a zero: Number(null) is 0, which would show
   "0 °C" for a probe that reported nothing. */
function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ---------- Temps restant ----------
   Le champ est publie en MINUTES sur les machines vues jusqu'ici, mais
   la documentation communautaire parle de secondes : une valeur
   invraisemblable en minutes (plus de dix jours) est donc relue comme
   des secondes, plutot que d'annoncer une fin d'impression en 2027.
   Remaining time is published in MINUTES, but an implausible value is
   re-read as seconds rather than announcing a finish date years away. */
function remainingMs(raw) {
  const n = num(raw);
  if (n == null || n < 0) return null;
  if (n > 14400) return n * 1000;          // > 10 jours en minutes : ce sont des secondes
  return n * 60000;
}

function finishAt(raw, now) {
  const ms = remainingMs(raw);
  if (ms == null) return null;
  return new Date((now ? now.getTime() : Date.now()) + ms);
}

/* ---------- Erreurs HMS ----------
   Bambu identifie ses pannes par deux entiers ; le code lisible est la
   concatenation de leurs quatre moities, en hexadecimal. C'est ce code
   que l'on retrouve dans la base d'aide de Bambu.
   Bambu identifies faults with two integers; the readable code is the
   concatenation of their four halves in hex. */
function hmsCode(attr, code) {
  const a = Number(attr), c = Number(code);
  if (!isFinite(a) || !isFinite(c)) return null;
  const hex = (n) => n.toString(16).toUpperCase().padStart(4, "0");
  return [hex(a >>> 16), hex(a & 0xffff), hex(c >>> 16), hex(c & 0xffff)].join("_");
}

function hmsUrl(code, lang) {
  if (!code) return null;
  return "https://wiki.bambulab.com/" + (lang === "fr" ? "fr" : "en") + "/x1/troubleshooting/hmscode/" + code;
}

function hmsList(report) {
  const raw = (report && report.hms) || [];
  const out = [];
  for (const h of raw) {
    const code = hmsCode(h.attr, h.code);
    if (code) out.push({ code, severity: (Number(h.code) >> 16) & 0xffff, url: hmsUrl(code) });
  }
  return out;
}

/* ---------- AMS ----------
   Les plateaux vides sont ecartes : une bobine absente n'a rien a
   montrer. La couleur arrive en RGBA hexadecimal.
   Empty trays are dropped; colour comes as hex RGBA. */
function parseAms(report) {
  const ams = (report && report.ams) || {};
  const units = Array.isArray(ams.ams) ? ams.ams : [];
  const activeTray = ams.tray_now == null ? null : String(ams.tray_now);
  return units.map((u) => ({
    id: String(u.id),
    humidity: num(u.humidity),
    temperature: num(u.temp),
    trays: (u.tray || []).map((t) => {
      const globalId = String(Number(u.id) * 4 + Number(t.id));
      return {
        id: String(t.id),
        active: activeTray != null && globalId === activeTray,
        empty: !t.tray_type,
        type: t.tray_type || "",
        color: t.tray_color ? "#" + String(t.tray_color).slice(0, 6) : null,
        remainPercent: num(t.remain)
      };
    }).filter((t) => !t.empty || t.active)
  }));
}

/* Nom lisible de l'impression : le sous-titre de la tache quand il
   existe, sinon le nom du fichier sans son chemin ni son extension.
   Readable print name. */
function printName(report) {
  const sub = report && report.subtask_name;
  if (sub) return String(sub);
  const f = (report && report.gcode_file) || "";
  const base = String(f).split(/[\\/]/).pop() || "";
  return base.replace(/\.(gcode|3mf)(\.\w+)?$/i, "");
}

/* ---------- Etat servi a la tuile ----------
   Une seule forme, quelle que soit la voie (locale ou cloud) et quel
   que soit le modele : la tuile n'a pas a connaitre Bambu.
   One shape, whatever the route and the model. */
function snapshot(report, opts) {
  const o = opts || {};
  const r = report || {};
  const caps = capabilities(o.model || r.printer_type);
  const state = String(r.gcode_state || "").toUpperCase();
  const printing = state === "RUNNING" || state === "PREPARE" || state === "PAUSE";
  const nozzles = [];
  if (num(r.nozzle_temper) != null || caps.nozzles === 1) {
    nozzles.push({ current: num(r.nozzle_temper), target: num(r.nozzle_target_temper) });
  }
  /* H2D : la seconde buse est publiee sous « device.extruder ». Absente
     sur les autres machines, on ne l'invente pas.
     H2D publishes its second nozzle under device.extruder. */
  const ext = r.device && r.device.extruder && Array.isArray(r.device.extruder.info)
    ? r.device.extruder.info : null;
  if (caps.nozzles > 1 && ext) {
    nozzles.length = 0;
    for (const e of ext) nozzles.push({ current: num(e.temp) != null ? num(e.temp) / 10 : null, target: num(e.target_temp) });
  }

  const percent = num(r.mc_percent);
  return {
    model: o.model || r.printer_type || "",
    name: o.name || "",
    state,
    stateLabel: stateLabel(state),
    stage: num(r.stg_cur),
    stageLabel: stageLabel(r.stg_cur),
    printing,
    percent: percent == null ? null : Math.max(0, Math.min(100, percent)),
    layer: num(r.layer_num),
    totalLayers: num(r.total_layer_num),
    remainingMs: remainingMs(r.mc_remaining_time),
    finishAt: (() => { const d = printing ? finishAt(r.mc_remaining_time) : null; return d ? d.toISOString() : null; })(),
    printName: printName(r),
    bed: { current: num(r.bed_temper), target: num(r.bed_target_temper) },
    chamber: caps.chamber ? { current: num(r.chamber_temper), target: num(r.chamber_target_temper) } : null,
    nozzles,
    speedLevel: num(r.spd_lvl),
    speedPercent: num(r.spd_mag),
    fans: {
      part: num(r.cooling_fan_speed),
      aux: num(r.big_fan1_speed),
      chamber: num(r.big_fan2_speed)
    },
    wifi: r.wifi_signal || null,
    lightOn: Array.isArray(r.lights_report)
      ? (r.lights_report.find((l) => l.node === "chamber_light") || {}).mode === "on"
      : null,
    ams: parseAms(r),
    errors: hmsList(r),
    printError: num(r.print_error) || null,
    capabilities: caps
  };
}

/* ---------- Decouverte sur le reseau local ----------
   Les imprimantes Bambu s'annoncent en SSDP sur le port 2021 et
   repondent a une recherche envoyee en multidiffusion. On ecoute
   quelques secondes : c'est ce qui evite d'avoir a relever a la main
   une adresse IP et un numero de serie sur un petit ecran.
   Bambu printers announce themselves over SSDP on port 2021. */
function discover(timeoutMs) {
  const wait = Math.max(1000, Math.min(15000, Number(timeoutMs) || 4000));
  return new Promise((resolve) => {
    const found = new Map();
    let sock;
    try { sock = dgram.createSocket({ type: "udp4", reuseAddr: true }); }
    catch (e) { return resolve([]); }

    const done = () => {
      try { sock.close(); } catch (e) { /* deja ferme */ }
      resolve(Array.from(found.values()));
    };
    const timer = setTimeout(done, wait);
    timer.unref && timer.unref();

    sock.on("error", () => { clearTimeout(timer); done(); });
    sock.on("message", (msg, rinfo) => {
      const p = parseSsdp(msg.toString("utf8"), rinfo.address);
      if (p && p.serial) found.set(p.serial, p);
    });
    sock.bind(2021, () => {
      try { sock.setBroadcast(true); sock.addMembership("239.255.255.250"); } catch (e) { /* reseau sans multidiffusion */ }
      const search = Buffer.from([
        "M-SEARCH * HTTP/1.1", "HOST: 239.255.255.250:1990",
        'MAN: "ssdp:discover"', "MX: 1", "ST: urn:bambulab-com:device:3dprinter:1", "", ""
      ].join("\r\n"));
      try { sock.send(search, 0, search.length, 1990, "239.255.255.250"); } catch (e) { /* ignore */ }
      try { sock.send(search, 0, search.length, 2021, "255.255.255.255"); } catch (e) { /* ignore */ }
    });
  });
}

/* Entetes SSDP de Bambu : le numero de serie est dans USN, le modele et
   le nom dans des entetes maison.
   Bambu's SSDP headers: serial in USN, model and name in custom ones. */
function parseSsdp(text, fallbackIp) {
  const head = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) head[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const serial = head["usn"] || "";
  if (!serial) return null;
  const loc = head["location"] || fallbackIp || "";
  return {
    serial: serial.replace(/^uuid:/i, ""),
    host: loc.replace(/^https?:\/\//, "").split(/[:/]/)[0] || fallbackIp || "",
    model: head["devmodel.bambu.com"] || "",
    name: head["devname.bambu.com"] || "",
    version: head["devversion.bambu.com"] || ""
  };
}

/* ---------- Compte Bambu (voie cloud) ----------
   Deux temps : identifiants, puis code de verification recu par
   courriel. Le module ne conserve rien lui-meme : le jeton remonte a
   l'appelant, qui le range avec les autres secrets.
   Two steps: credentials, then the emailed verification code. */
function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const req = https.request({
      host: "api.bambulab.com", path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": payload.length, "User-Agent": "PiBoard" },
      timeout: 15000
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = null; }
        if (!json) return reject(new Error("réponse illisible / unreadable answer (HTTP " + res.statusCode + ")"));
        resolve(json);
      });
    });
    req.on("timeout", () => req.destroy(new Error("délai dépassé / timed out")));
    req.on("error", reject);
    req.end(payload);
  });
}

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: "api.bambulab.com", path, method: "GET",
      headers: { Authorization: "Bearer " + token, "User-Agent": "PiBoard" }, timeout: 15000
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("réponse illisible / unreadable answer")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("délai dépassé / timed out")));
    req.on("error", reject);
    req.end();
  });
}

/* Lecture de la reponse de connexion : jeton obtenu, ou code de
   verification a reclamer a l'utilisateur.
   Reading the login answer: token, or verification code needed. */
function loginOutcome(json) {
  const j = json || {};
  if (j.accessToken) return { ok: true, token: j.accessToken };
  const type = String(j.loginType || "").toLowerCase();
  if (type.indexOf("verify") >= 0 || type === "emailcode") return { ok: false, needCode: true };
  if (type.indexOf("tfa") >= 0) return { ok: false, needCode: true, tfaKey: j.tfaKey || null };
  return { ok: false, error: j.error || j.message || "identifiants refusés / credentials refused" };
}

async function cloudLogin(account, password) {
  return loginOutcome(await apiPost("/v1/user-service/user/login", { account, password }));
}

async function cloudVerify(account, code) {
  return loginOutcome(await apiPost("/v1/user-service/user/login", { account, code }));
}

/* Numero d'utilisateur : il est ecrit dans le jeton lui-meme (JWT), le
   nom d'utilisateur MQTT en decoulant directement.
   The user id is inside the token itself (a JWT). */
function userIdFromToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const body = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return body.username || (body.uid != null ? "u_" + body.uid : null);
  } catch (e) { return null; }
}

async function cloudPrinters(token) {
  const json = await apiGet("/v1/iot-service/api/user/bind", token);
  const list = (json && json.devices) || [];
  return list.map((d) => ({
    serial: d.dev_id, name: d.name, model: d.dev_product_name || d.dev_model_name || "",
    online: !!d.online, accessCode: d.dev_access_code || ""
  }));
}

function cloudHost(region) {
  const r = String(region || "eu").toLowerCase();
  return (r === "cn" ? "cn" : r === "us" ? "us" : "eu") + ".mqtt.bambulab.com";
}

/* ============================================================
   Connexions vivantes. Une par tuile ; la tuile interroge /status, ce
   qui entretient la connexion. Une tuile qu'on ne consulte plus voit
   la sienne fermee, plutot que de laisser une session MQTT ouverte
   pour rien.
   Live connections, one per tile; an unread one is closed.
   ============================================================ */
const links = new Map();
const IDLE_CLOSE_MS = 5 * 60000;

function key(cfg) {
  return [cfg.id || "", cfg.mode || "lan", cfg.host || "", cfg.serial || ""].join("|");
}

function describeError(e) {
  const msg = String((e && e.message) || e || "");
  if (/ECONNREFUSED/.test(msg)) return "refused";
  if (/ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|timed? ?out/i.test(msg)) return "unreachable";
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return "dns";
  if (/Not authorized|bad user|Connection refused: Not authorized|code 4|code 5/i.test(msg)) return "auth";
  return "other";
}

function open(cfg) {
  let mqtt;
  try { mqtt = require("mqtt"); }
  catch (e) {
    const err = new Error("le module « mqtt » n'est pas installé / the \"mqtt\" module is not installed");
    err.code = "no-mqtt";
    throw err;
  }

  const cloud = cfg.mode === "cloud";
  const host = cloud ? cloudHost(cfg.region) : cfg.host;
  const username = cloud ? (userIdFromToken(cfg.token) || "") : "bblp";
  const password = cloud ? cfg.token : cfg.code;

  const link = {
    cfg, report: null, connected: false, lastMessageAt: 0, lastReadAt: Date.now(),
    error: null, errorKind: null, client: null
  };

  const client = mqtt.connect("mqtts://" + host + ":8883", {
    username, password,
    /* Le certificat de l'imprimante est auto-signe et porte un nom qui
       ne correspond pas a son adresse : le verifier reviendrait a
       refuser toute liaison locale. La liaison reste chiffree, sur le
       reseau local, vers une adresse que l'utilisateur a lui-meme
       designee.
       The printer's certificate is self-signed and does not match its
       address: verifying it would refuse every local link. */
    rejectUnauthorized: cloud,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    clientId: "piboard_" + Math.random().toString(16).slice(2, 10),
    protocolVersion: 4
  });
  link.client = client;

  const topic = "device/" + cfg.serial + "/report";
  client.on("connect", () => {
    link.connected = true;
    link.error = null;
    link.errorKind = null;
    client.subscribe(topic, () => {
      /* Une seule commande est jamais envoyee : « donne-moi ton etat
         complet ». Sans elle, il faudrait attendre le prochain
         changement pour afficher quoi que ce soit.
         The only command ever sent: "give me your full state". */
      client.publish("device/" + cfg.serial + "/request", JSON.stringify({
        pushing: { sequence_id: "0", command: "pushall", version: 1, push_target: 1 }
      }));
    });
  });
  client.on("message", (t, payload) => {
    let json = null;
    try { json = JSON.parse(payload.toString("utf8")); } catch (e) { return; }
    if (!json || !json.print) return;
    link.report = mergeReport(link.report, json.print);
    link.lastMessageAt = Date.now();
  });
  client.on("error", (e) => {
    link.error = String((e && e.message) || e);
    link.errorKind = describeError(e);
    link.connected = false;
  });
  client.on("close", () => { link.connected = false; });
  return link;
}

function status(cfg) {
  const k = key(cfg);
  let link = links.get(k);
  if (!link) {
    link = open(cfg);
    links.set(k, link);
  }
  link.lastReadAt = Date.now();
  link.cfg = cfg;
  return {
    connected: link.connected,
    hasData: !!link.report,
    error: link.error,
    errorKind: link.errorKind,
    ageMs: link.lastMessageAt ? Date.now() - link.lastMessageAt : null,
    printer: link.report ? snapshot(link.report, { model: cfg.model, name: cfg.name }) : null
  };
}

function close(cfg) {
  const k = key(cfg);
  const link = links.get(k);
  if (!link) return false;
  try { link.client && link.client.end(true); } catch (e) { /* deja ferme */ }
  links.delete(k);
  return true;
}

/* Fermeture des liaisons dont plus personne ne lit l'etat. */
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [k, link] of links) {
    if (now - link.lastReadAt > IDLE_CLOSE_MS) {
      try { link.client && link.client.end(true); } catch (e) { /* deja ferme */ }
      links.delete(k);
    }
  }
}, 60000);
sweeper.unref && sweeper.unref();

module.exports = {
  STAGES, GCODE_STATES, stageLabel, stateLabel, capabilities, mergeReport,
  remainingMs, finishAt, hmsCode, hmsUrl, hmsList, parseAms, printName, snapshot,
  parseSsdp, discover, loginOutcome, userIdFromToken, cloudLogin, cloudVerify,
  cloudPrinters, cloudHost, describeError, status, close
};
