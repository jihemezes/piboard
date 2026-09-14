/* ============================================================
   PiBoard - server/hostWatch.js
   Surveillance de la joignabilite d'hotes et de services de la maison :
   un NAS Synology, un Raspberry Pi, un serveur Umbrel, une box
   domotique, mais aussi les services distants dont dependent les objets
   connectes -- Alexa/Amazon, Somfy, etc.

   POURQUOI CETTE TUILE, a cote de celles qui existent deja :
     - \"Analyse reseau\" DECOUVRE ce qui est present sur le sous-reseau,
       ponctuellement, et ne dit rien des services distants.
     - \"Sante Internet\" mesure la qualite de LA connexion (latence,
       gigue, pertes), pas la disponibilite de telle ou telle machine.
   Ici la question est autre : \"est-ce que CES machines et CES services,
   que j'ai choisis, repondent en ce moment ?\". C'est la tuile qu'on
   regarde quand une lampe ne s'allume plus, pour savoir en trente
   secondes si le probleme vient de la maison ou du fournisseur.

   TROIS SONDES, choisies selon la forme de la cible -- l'utilisateur
   n'a aucun type a declarer :
     - https://... ou http://...  -> requete HTTP. Seule facon de tester
       un service distant : Amazon et Somfy ne repondent pas au ping,
       et leur page d'etat, elle, repond.
     - hote:port                  -> connexion TCP. La bonne sonde pour
       un service precis d'une machine locale (l'interface d'un NAS sur
       5001, Home Assistant sur 8123) : elle verifie que le SERVICE
       ecoute, pas seulement que la machine est allumee.
     - hote ou adresse IP         -> ping ICMP. Le plus simple pour
       \"cette machine est-elle allumee ?\".

   CE QUE LA TUILE NE FAIT PAS, volontairement : aucune alerte, aucune
   notification, aucun historique sur disque. Elle montre l'etat courant
   et la tendance de la session en cours. Un systeme d'alerte suppose un
   canal (courriel, message) et une gestion des faux positifs qui
   depassent de loin le cadre d'un tableau de bord mural.

   Monitoring the reachability of the home's hosts and services: a
   Synology NAS, a Raspberry Pi, an Umbrel server, a home-automation
   hub, but also the remote services the connected objects depend on --
   Alexa/Amazon, Somfy, and so on.

   WHY THIS TILE, next to those that already exist:
     - \"Network scan\" DISCOVERS what is present on the subnet, at one
       point in time, and says nothing about remote services.
     - \"Internet health\" measures the quality of THE connection
       (latency, jitter, loss), not the availability of this or that
       machine.
   The question here is a different one: \"are THESE machines and THESE
   services, the ones I picked, answering right now?\". It is the tile
   you look at when a lamp stops turning on, to know within thirty
   seconds whether the problem is at home or at the provider's.

   THREE PROBES, picked from the shape of the target -- the user
   declares no type at all:
     - https://... or http://...  -> HTTP request. The only way to test
       a remote service: Amazon and Somfy do not answer pings, whereas
       their status page does.
     - host:port                  -> TCP connection. The right probe for
       one precise service of a local machine (a NAS's interface on
       5001, Home Assistant on 8123): it checks that the SERVICE is
       listening, not merely that the machine is powered on.
     - host or IP address         -> ICMP ping. The simplest answer to
       \"is that machine on?\".

   WHAT THE TILE DELIBERATELY DOES NOT DO: no alerting, no
   notification, no on-disk history. It shows the current state and the
   trend of the running session. An alerting system implies a channel
   (email, message) and false-positive handling that go well beyond a
   wall dashboard.
   ============================================================ */

"use strict";

const net = require("net");
const { execFile } = require("child_process");
const platform = require("./platform");

/* Delai au-dela duquel une cible est declaree injoignable. Genereux
   volontairement : un NAS qui sort de veille, ou un service distant un
   jour de forte charge, peut mettre deux ou trois secondes. Trop court,
   la tuile clignoterait au rouge sans raison -- le defaut le plus
   penible pour une tuile qu'on regarde du coin de l'oeil.
   Delay past which a target is declared unreachable. Deliberately
   generous: a NAS waking from sleep, or a remote service on a busy day,
   may take two or three seconds. Too short and the tile would blink red
   for nothing -- the most annoying flaw for a tile watched out of the
   corner of the eye. */
const TIMEOUT_MS = 5000;
const PING_TIMEOUT_SEC = 2;

/* Nombre de releves conserves par cible, en memoire seulement. A une
   minute d'intervalle, quarante releves couvrent environ quarante
   minutes -- de quoi voir une coupure recente sans faire de PiBoard un
   outil de supervision.
   Number of samples kept per target, in memory only. At one-minute
   intervals, forty samples cover roughly forty minutes -- enough to see
   a recent outage without turning PiBoard into a monitoring suite. */
const HISTORY_LENGTH = 40;

/* Nombre maximal de cibles. Chaque verification est un aller-retour
   reseau ; au-dela, une tuile murale devient illisible bien avant que
   le serveur ne peine.
   Maximum number of targets. Each check is a network round trip; beyond
   that, a wall tile becomes unreadable long before the server struggles. */
const MAX_TARGETS = 20;

/* Historique par cle de cible, vide au demarrage du serveur.
   History per target key, empty when the server starts. */
const history = new Map();

/* ---------- Analyse de la liste saisie / parsing the typed list ----------
   Une ligne par cible, dans l'une de ces deux formes :
       Nom = cible
       cible
   Le nom est facultatif : sans lui, la cible s'affiche telle quelle.
   Le separateur accepte est \"=\" ou \"|\", parce que les deux viennent
   naturellement sous les doigts et qu'aucun des deux n'apparait dans
   une adresse. Les lignes vides et celles commencant par # sont
   ignorees : pouvoir commenter ou desactiver temporairement une ligne
   sans la supprimer est exactement ce qu'on veut dans une liste qu'on
   modifie a la main.

   One line per target, in either of these two shapes:
       Name = target
       target
   The name is optional: without it, the target shows as typed. The
   accepted separator is \"=\" or \"|\", because both come naturally under
   the fingers and neither appears in an address. Empty lines and lines
   starting with # are ignored: being able to comment out or temporarily
   disable a line without deleting it is exactly what one wants in a
   hand-edited list. */
function parseTargets(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text == null ? "" : text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const sep = line.search(/[=|]/);
    let name = "";
    let target = line;
    if (sep >= 0) {
      name = line.slice(0, sep).trim();
      target = line.slice(sep + 1).trim();
    }
    if (!target) continue;

    const probe = probeKind(target);
    if (!probe) continue;

    const key = probe + ":" + target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ key, name: name || target, target, probe });
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

/* Choix de la sonde a partir de la seule forme de la cible. L'ordre des
   tests compte : une URL contient \":\" (https://) et serait prise pour
   un couple hote:port si on cherchait le port en premier.
   Probe choice from the target's shape alone. The order of the tests
   matters: a URL contains \":\" (https://) and would be mistaken for a
   host:port pair if the port were looked for first. */
function probeKind(target) {
  if (/^https?:\/\//i.test(target)) return "http";
  const m = /^([^\s:/]+):(\d{1,5})$/.exec(target);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 65535) return "tcp";
  // Un nom d'hote ou une adresse : pas d'espace, pas de barre oblique.
  // A host name or an address: no space, no slash.
  if (/^[A-Za-z0-9._-]+$/.test(target)) return "ping";
  return null;
}

/* ---------- Les trois sondes / the three probes ---------- */

function probeHttp(url) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  /* GET et non HEAD : trop de serveurs repondent 405 ou 404 a un HEAD
     qu'ils servent pourtant tres bien en GET, ce qui ferait passer pour
     en panne un service parfaitement vivant. `redirect: manual` evite
     de suivre une chaine de redirections sans interet ici -- une
     redirection EST une reponse, donc le service repond.
     GET rather than HEAD: too many servers answer 405 or 404 to a HEAD
     they nonetheless serve perfectly well over GET, which would make a
     perfectly alive service look down. `redirect: manual` avoids
     following a chain of redirects of no interest here -- a redirect IS
     an answer, so the service is up. */
  return fetch(url, {
    method: "GET",
    signal: ctrl.signal,
    redirect: "manual",
    headers: { "User-Agent": "PiBoard host watch" }
  }).then((res) => {
    /* Tout code HTTP obtenu signifie que le service a repondu. Meme un
       403 ou un 500 : la machine est joignable et son serveur tourne.
       Seul un refus de connexion ou un delai depasse compte comme une
       panne. Le code est conserve pour l'affichage, car un 500 durable
       merite d'etre vu.
       Any HTTP code obtained means the service answered. Even a 403 or a
       500: the machine is reachable and its server is running. Only a
       refused connection or a timeout counts as an outage. The code is
       kept for display, since a lasting 500 deserves to be seen. */
    return { up: true, ms: Date.now() - started, detail: "HTTP " + res.status, code: res.status };
  }).catch((e) => {
    return { up: false, ms: null, detail: reasonOf(e) };
  }).finally(() => clearTimeout(timer));
}

function probeTcp(target) {
  const [host, portText] = target.split(":");
  const port = Number(portText);
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done({ up: true, ms: Date.now() - started, detail: "TCP " + port }));
    socket.once("timeout", () => done({ up: false, ms: null, detail: "timeout" }));
    socket.once("error", (e) => done({ up: false, ms: null, detail: reasonOf(e) }));
    socket.connect(port, host);
  });
}

/* Le ping delegue ses arguments a la couche plateforme : Linux compte
   en secondes (-W), Windows en millisecondes (-w), macOS a sa propre
   forme. Meme mecanisme que la tuile d'analyse reseau -- il n'y a
   aucune raison d'en avoir deux.
   Ping delegates its arguments to the platform layer: Linux counts in
   seconds (-W), Windows in milliseconds (-w), macOS has its own form.
   Same mechanism as the network scan tile -- there is no reason to have
   two. */
function probePing(host) {
  const started = Date.now();
  return new Promise((resolve) => {
    execFile(
      "ping",
      platform.pingArgs(host, PING_TIMEOUT_SEC),
      { timeout: (PING_TIMEOUT_SEC + 1) * 1000, windowsHide: true },
      (err, stdout) => {
        const up = platform.pingSucceeded(err, stdout);
        resolve(up
          ? { up: true, ms: Date.now() - started, detail: "ping" }
          : { up: false, ms: null, detail: "no reply" });
      }
    );
  });
}

/* Traduit une erreur systeme en motif court et parlant. Les messages
   bruts de Node (\"getaddrinfo ENOTFOUND nas.local\") sont exacts mais
   illisibles sur une tuile murale.
   Turns a system error into a short, telling reason. Node's raw
   messages (\"getaddrinfo ENOTFOUND nas.local\") are accurate but
   unreadable on a wall tile. */
function reasonOf(e) {
  const code = String((e && (e.cause && e.cause.code)) || (e && e.code) || "");
  const msg = String((e && e.message) || e || "");
  if (code === "ENOTFOUND" || /ENOTFOUND/.test(msg)) return "unknown name";
  if (code === "ECONNREFUSED" || /ECONNREFUSED/.test(msg)) return "refused";
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return "unreachable";
  if (code === "ETIMEDOUT" || /timeout|abort/i.test(msg)) return "timeout";
  if (code === "ECONNRESET") return "reset";
  if (code === "CERT_HAS_EXPIRED" || /certificate/i.test(msg)) return "certificate";
  return code || "error";
}

function probe(entry) {
  if (entry.probe === "http") return probeHttp(entry.target);
  if (entry.probe === "tcp") return probeTcp(entry.target);
  return probePing(entry.target);
}

/* ---------- Historique et statistiques / history and statistics ----------
   Conserve en memoire, jamais sur disque : cette tuile decrit le present,
   et un fichier de plus a sauvegarder pour quarante minutes de mesures
   ne se justifie pas. Un redemarrage du serveur repart donc d'une
   ardoise vide, ce que l'interface indique (\"--\" au lieu d'un
   pourcentage) plutot que d'afficher 100 % sur un seul releve.
   Kept in memory, never on disk: this tile describes the present, and
   one more file to back up for forty minutes of measurements is not
   justified. A server restart therefore starts from a blank slate,
   which the interface shows (\"--\" instead of a percentage) rather than
   displaying 100% off a single sample. */
function record(key, result) {
  const list = history.get(key) || [];
  list.push({ at: Date.now(), up: !!result.up, ms: result.ms });
  while (list.length > HISTORY_LENGTH) list.shift();
  history.set(key, list);
  return list;
}

function stats(list) {
  if (!list.length) return { samples: 0, uptime: null, avgMs: null, since: null };
  const ups = list.filter((s) => s.up);
  const times = ups.map((s) => s.ms).filter((ms) => typeof ms === "number");

  /* \"Depuis\" = date du releve a partir duquel l'etat n'a plus change.
     C'est l'information qu'on cherche vraiment devant une tuile rouge :
     non pas \"c'est en panne\" mais \"depuis quand\". On remonte le temps
     tant que l'etat est identique au dernier.
     \"Since\" = the date of the sample from which the state stopped
     changing. That is what one actually looks for in front of a red
     tile: not \"it is down\" but \"since when\". We walk back in time while
     the state matches the latest one. */
  const last = list[list.length - 1];
  let since = last.at;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].up !== last.up) break;
    since = list[i].at;
  }

  return {
    samples: list.length,
    uptime: Math.round((ups.length / list.length) * 100),
    avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    since,
    spark: list.map((s) => (s.up ? 1 : 0))
  };
}

/* ---------- Point d'entree / entry point ----------
   Toutes les cibles sont sondees EN PARALLELE. En serie, dix cibles
   dont deux injoignables prendraient plus de dix secondes (deux fois le
   delai d'attente), et la tuile paraitrait figee. En parallele, le tout
   prend le temps de la cible la plus lente.
   All targets are probed IN PARALLEL. Run in series, ten targets of
   which two are unreachable would take over ten seconds (twice the
   timeout), and the tile would look frozen. In parallel, the whole thing
   takes as long as the slowest target. */
async function check(text) {
  const entries = parseTargets(text);
  const results = await Promise.all(entries.map(async (entry) => {
    const result = await probe(entry);
    const list = record(entry.key, result);
    return {
      key: entry.key,
      name: entry.name,
      target: entry.target,
      probe: entry.probe,
      up: !!result.up,
      ms: result.ms,
      detail: result.detail,
      stats: stats(list)
    };
  }));
  return {
    at: new Date().toISOString(),
    targets: results,
    down: results.filter((r) => !r.up).length,
    total: results.length
  };
}

/* Expose pour les tests, et pour permettre a une suite de repartir d'un
   etat connu. Exposed for the tests, and to let a suite start from a
   known state. */
function resetHistory() {
  history.clear();
}

module.exports = {
  check,
  parseTargets,
  probeKind,
  reasonOf,
  stats,
  resetHistory,
  MAX_TARGETS,
  HISTORY_LENGTH,
  TIMEOUT_MS
};
