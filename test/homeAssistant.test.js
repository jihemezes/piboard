/* PiBoard - test/homeAssistant.test.js

   Ces tests montent un FAUX Home Assistant en HTTP local (module `http`
   de Node, aucune dependance) et interrogent reellement le module. Cette
   tuile a ete developpee sans instance Home Assistant disponible pour la
   valider : des tests d'analyse de reponses figees n'auraient donc rien
   prouve sur le chemin reseau lui-meme.

   These tests spin up a FAKE Home Assistant over local HTTP (Node's
   `http` module, no dependency) and genuinely query the module. This tile
   was developed with no Home Assistant instance available to validate it:
   tests over frozen sample replies would therefore have proven nothing
   about the network path itself. */
"use strict";

const http = require("http");
const ha = require("../server/homeAssistant.js");

let ok = 0;
function check(l, cond) {
  if (!cond) { console.error("  FAIL " + l); process.exitCode = 1; }
  else { console.log("  OK   " + l); ok++; }
}

const TOKEN = "test-token-123";
const STATES = [
  { entity_id: "sensor.salon_temp", state: "21.4",
    attributes: { friendly_name: "Salon", unit_of_measurement: "°C", device_class: "temperature" } },
  { entity_id: "binary_sensor.porte_entree", state: "on",
    attributes: { friendly_name: "Porte d'entrée", device_class: "door" } },
  { entity_id: "sensor.conso", state: "1234.567",
    attributes: { friendly_name: "Consommation", unit_of_measurement: "W", device_class: "power" } },
  { entity_id: "light.cuisine", state: "off",
    attributes: { friendly_name: "Cuisine", supported_color_modes: ["brightness"], brightness: 0 } }
];

let sawAuthHeader = null;

const server = http.createServer((req, res) => {
  sawAuthHeader = req.headers.authorization || null;
  if (sawAuthHeader !== "Bearer " + TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ message: "Unauthorized" }));
  }
  if (req.url === "/api/states") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(STATES));
  }
  res.writeHead(404); res.end();
});

server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;

  console.log("== normalisation de l'adresse ==");
  check("un schema manquant est complete en http://", ha._normalizeBase("homeassistant.local:8123") === "http://homeassistant.local:8123");
  check("une barre oblique finale est retiree", ha._normalizeBase("http://x:8123/") === "http://x:8123");
  check("une adresse vide -> null", ha._normalizeBase("  ") === null);
  // Le WebSocket doit suivre le schema : ws:// en clair, wss:// en TLS.
  // Se tromper ici donnerait une connexion refusee sans message clair.
  // The WebSocket must follow the scheme: ws:// in clear, wss:// over
  // TLS. Getting this wrong gives a refused connection with no clear
  // message.
  check("http -> ws", ha._wsUrlFor("http://x:8123") === "ws://x:8123/api/websocket");
  check("https -> wss", ha._wsUrlFor("https://x:8123") === "wss://x:8123/api/websocket");

  console.log("== lecture REST reelle contre un faux Home Assistant ==");
  const map = await ha._restStates(base, TOKEN);
  check("le jeton part bien en en-tete Bearer", sawAuthHeader === "Bearer " + TOKEN);
  check("toutes les entites sont lues", map.size === 4);
  const t = map.get("sensor.salon_temp");
  check("le nom lisible est repris", t.name === "Salon");
  check("l'unite est reprise", t.unit === "°C");
  check("la classe d'appareil est reprise", t.deviceClass === "temperature");
  check("le domaine est deduit de l'identifiant", t.domain === "sensor");

  // Un jeton refuse doit donner une erreur EXPLICITE, pas un echec
  // generique : c'est l'erreur de configuration la plus probable.
  // A refused token must give an EXPLICIT error, not a generic failure:
  // it is the likeliest configuration mistake.
  let authErr = null;
  try { await ha._restStates(base, "mauvais-jeton"); } catch (e) { authErr = e.message; }
  check("un jeton refuse remonte 'unauthorized'", authErr === "unauthorized");

  console.log("== selecteur d'entites ==");
  const cat = await ha.getCatalog(base, TOKEN);
  check("les entites sont regroupees par domaine", cat.exchanges.length === 3);
  check("les domaines sont tries", cat.exchanges.map((e) => e.id).join(",") === "binary_sensor,light,sensor");
  check("chaque entree porte l'identifiant en valeur",
    cat.exchanges.find((e) => e.id === "light").instruments[0].symbol === "light.cuisine");

  console.log("== protocole WebSocket (fonction pure) ==");
  const ctx = { token: TOKEN, nextId: 1 };
  const a = ha._handleMessage({ type: "auth_required" }, ctx);
  check("auth_required -> envoi du jeton", a.action === "send" && a.payload.access_token === TOKEN);
  const b = ha._handleMessage({ type: "auth_ok" }, ctx);
  check("auth_ok -> abonnement", b.action === "send" && b.payload.type === "subscribe_events");
  // S'abonner a TOUS les evenements deverserait appels de service,
  // minuteries et journal : un volume sans rapport avec l'affichage.
  // Subscribing to ALL events would pour out service calls, timers and
  // logbook entries: a volume unrelated to the display.
  check("l'abonnement se limite aux changements d'etat", b.payload.event_type === "state_changed");
  check("auth_invalid -> echec explicite",
    ha._handleMessage({ type: "auth_invalid" }, ctx).reason === "unauthorized");

  const ev = ha._handleMessage({ type: "event", event: { data: {
    entity_id: "sensor.salon_temp",
    new_state: { entity_id: "sensor.salon_temp", state: "22.1", attributes: { friendly_name: "Salon" } } } } }, ctx);
  check("un changement d'etat met a jour l'entite", ev.action === "update" && ev.entity.state === "22.1");

  // new_state absent = entite supprimee de HA. La retirer evite de
  // laisser une valeur figee a l'ecran indefiniment.
  // Missing new_state = entity removed from HA. Dropping it avoids
  // leaving a frozen value on screen indefinitely.
  check("une entite supprimee est retiree du cache",
    ha._handleMessage({ type: "event", event: { data: { entity_id: "x.y", new_state: null } } }, ctx).action === "remove");
  check("un message inconnu est ignore sans exception",
    ha._handleMessage({ type: "pong" }, ctx).action === "ignore");
  check("un message nul est ignore sans exception",
    ha._handleMessage(null, ctx).action === "ignore");
  check("un resultat en echec est signale sans casser la connexion",
    ha._handleMessage({ type: "result", success: false, error: { message: "boom" } }, ctx).action === "warn");

  console.log("== etats demandes ==");
  const r = await ha.getStates(base, TOKEN, ["sensor.salon_temp", "sensor.inexistant"]);
  check("les entites demandees sont renvoyees dans l'ordre", r.entities[0].id === "sensor.salon_temp");
  // Une entite absente reste VISIBLE et marquee : la faire disparaitre
  // rendrait le probleme invisible et indiagnosticable.
  // A missing entity stays VISIBLE and flagged: hiding it would make the
  // problem invisible and undiagnosable.
  check("une entite absente est signalee, pas omise",
    r.entities.length === 2 && r.entities[1].missing === true);
  check("l'absence de jeton est refusee explicitement",
    await ha.getStates(base, "", []).then(() => false, (e) => e.message === "missing_token"));
  check("l'absence d'adresse est refusee explicitement",
    await ha.getStates("", TOKEN, []).then(() => false, (e) => e.message === "missing_url"));

  console.log("== reconnexion ==");
  // Un delai croissant evite de marteler un Home Assistant eteint.
  // A growing delay avoids hammering a powered-off Home Assistant.
  check("le delai de reconnexion est croissant",
    ha.RECONNECT_MS.every((v, i, arr) => i === 0 || v > arr[i - 1]));
  check("le delai est plafonne a une minute",
    ha.RECONNECT_MS[ha.RECONNECT_MS.length - 1] <= 60000);

  ha.closeAll();
  server.close();
  console.log("\n" + ok + " assertions OK");
});
