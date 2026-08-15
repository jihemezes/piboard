/* ============================================================
   PiBoard - server/index.js
   Version 1.7.5

   Petit serveur Express :
     - sert le front (public/) et les bibliotheques vendorisees
       (Gridstack, Leaflet, node_modules)
     - API : disposition (layout), reglages globaux (dont l'economiseur
       d'ecran), version de l'application, etat des widgets
     - catalogue des widgets (scan de public/widgets/)
     - upload/gestion des photos (diaporama et economiseur d'ecran,
       chacun avec son propre identifiant de dossier sous data/media/)
     - proxy HTTP pour les flux RSS et les widgets tiers (contourne le
       CORS), sans mise en cache (voir le correctif anti-cache du widget
       RSS/Trafic)
     - point d'entree reserve a la machine locale pour redemarrer le
       kiosque (voir isLocalRequest())
     - SSE pour synchroniser les clients (kiosque <-> editeur)

   Small Express server:
     - serves the front-end (public/) and vendored libraries (Gridstack,
       Leaflet, node_modules)
     - API: layout, global settings (including the screen saver), app
       version, widget state
     - widget catalog (scans public/widgets/)
     - photo upload/management (slideshow and screen saver, each with
       its own folder id under data/media/)
     - HTTP proxy for RSS feeds and third-party widgets (bypasses CORS),
       with no caching (see the RSS/Traffic widgets' anti-cache fix)
     - local-machine-only endpoint to restart the kiosk (see
       isLocalRequest())
     - SSE to keep clients in sync (kiosk <-> editor)
   ============================================================ */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const platform = require("./platform");
const store = require("./store");
const media = require("./media");
const localFolder = require("./localFolder");
const usbMedia = require("./usbMedia");
const networkScan = require("./networkScan");
const webdav = require("./webdav");
const tileConfigs = require("./tileConfigs");
const teleProgram = require("./teleProgram");
const articleExtract = require("./articleExtract");
const webviewProxy = require("./webviewProxy");
const webviewShot = require("./webviewShot");
const crypto = require("./crypto");
const tileSecrets = require("./tileSecrets");
const mailbox = require("./mailbox");
const astronomy = require("./astronomy");
const backups = require("./backups");
const iptv = require("./iptv");
const iptvAudio = require("./iptvAudio");
const iptvHlsProxy = require("./iptvHlsProxy");
const iptvVlc = require("./iptvVlc");
const multer = require("multer");

const PORT = Number(process.env.PIBOARD_PORT || 8090);
/* Interface d'ecoute. Sur le Pi, 0.0.0.0 est voulu : le tableau de bord
   doit rester consultable et configurable depuis un autre poste du
   reseau. L'application de bureau Windows, elle, impose 127.0.0.1 : le
   serveur n'y sert que sa propre fenetre, et se limiter a la boucle
   locale evite l'invite du pare-feu Windows au premier lancement.
   Listening interface. On the Pi, 0.0.0.0 is intentional: the dashboard
   must stay viewable and configurable from another machine on the
   network. The Windows desktop application, however, forces 127.0.0.1:
   there the server only serves its own window, and staying on the
   loopback avoids the Windows firewall prompt on first launch. */
const HOST = process.env.PIBOARD_HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const WIDGETS_DIR = path.join(PUBLIC_DIR, "widgets");
const GRIDSTACK_DIST = path.join(__dirname, "..", "node_modules", "gridstack", "dist");
const LEAFLET_DIST = path.join(__dirname, "..", "node_modules", "leaflet", "dist");
const HLS_DIST = path.join(__dirname, "..", "node_modules", "hls.js", "dist");

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ---------- Valeurs par defaut / defaults ---------- */

const DEFAULT_SETTINGS = {
  lang: "en",            // en | fr
  theme: "auto",         // auto | dark | light
  cityName: "Paris",     // ville affichee / displayed city name
  latitude: 48.85,       // pour le theme auto (calcul solaire) / for auto theme (solar calc)
  longitude: 2.35,
  gridRows: 8,           // hauteur logique de l'ecran en lignes / logical screen height in rows
  touchMode: false,      // interface tactile : cibles agrandies / touch UI: enlarged targets
  multiColumnForms: true, // fenetres de reglages en plusieurs colonnes / settings windows in multiple columns
  colors: {
    dark: { bg: "#0B0E14", tile: "#141926" },
    light: { bg: "#EFEDE7", tile: "#FFFFFF" }
  },
  /* Economiseur d'ecran : jusqu'a 5 plages horaires, chacune en mode
     "noir" (calque plein ecran, aucune commande materielle -- fiable a
     coup sur, contrairement a l'extinction physique DPMS qui s'est averee
     peu fiable sous labwc, voir la doc) ou "slideshow" (cadre photo,
     reutilise le widget Diaporama avec sa propre config de photos,
     independante des tuiles). Reveil au premier clic/tap/touche.
     Screensaver: up to 5 time slots, each in "black" mode (full-screen
     overlay, no hardware command -- reliable by design, unlike physical
     DPMS power-off which proved unreliable under labwc, see docs) or
     "slideshow" mode (photo frame, reuses the Slideshow widget with its
     own dedicated photo config, independent from tiles). Wakes on the
     first click/tap/key. */
  screensaver: {
    enabled: false,
    slots: [
      { start: "", end: "", mode: "black" },
      { start: "", end: "", mode: "black" },
      { start: "", end: "", mode: "black" },
      { start: "", end: "", mode: "black" },
      { start: "", end: "", mode: "black" }
    ],
    slideshowSource: "upload",
    slideshowImages: "",
    slideshowFolderPath: "",
    slideshowWebdavUrl: "",
    slideshowWebdavUser: "",
    slideshowWebdavPass: "",
    slideshowInterval: 12,
    slideshowShuffle: false,
    slideshowKenBurns: true,
    slideshowFitLandscape: "cover",
    slideshowFitPortrait: "contain",
    slideshowContainBackground: "color",
    slideshowContainBackgroundColor: "#000000"
  }
};

const DEFAULT_LAYOUT = { version: 1, tiles: [] };

/* ---------- Catalogue des widgets / widget catalog ---------- */

function loadCatalog() {
  const catalog = [];
  let entries = [];
  try {
    entries = fs.readdirSync(WIDGETS_DIR, { withFileTypes: true });
  } catch (e) {
    return catalog;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(WIDGETS_DIR, entry.name, "manifest.json");
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifest.id = manifest.id || entry.name;
      manifest.dir = entry.name;
      catalog.push(manifest);
    } catch (e) {
      console.warn("[piboard] widget ignore (manifest invalide) / ignored widget (bad manifest):", entry.name);
    }
  }
  catalog.sort((a, b) => a.id.localeCompare(b.id));
  return catalog;
}

/* ---------- SSE : notification des clients / client notifications ---------- */

const sseClients = new Set();

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (e) { /* client parti / client gone */ }
  }
}

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.write("retry: 3000\n\n");
  sseClients.add(res);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

/* ---------- API ---------- */

app.get("/api/widgets", (req, res) => {
  res.json(loadCatalog());
});

/* ---------- Etat systeme (widget "system") ----------
   Lit les ressources locales de la machine qui heberge PiBoard : CPU, RAM,
   disque, temperature (Raspberry Pi), uptime. Sert uniquement des chiffres,
   aucune commande utilisateur n'est executee.
   Reads local resources of the machine hosting PiBoard: CPU, RAM, disk,
   temperature (Raspberry Pi), uptime. Only serves numbers, no user-supplied
   command is ever executed. */
const os = require("os");

function cpuSnapshot() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const t of Object.values(c.times)) total += t;
    idle += c.times.idle;
  }
  return { idle, total };
}

function cpuPercent() {
  return new Promise((resolve) => {
    const a = cpuSnapshot();
    setTimeout(() => {
      const b = cpuSnapshot();
      const totalDiff = b.total - a.total;
      const idleDiff = b.idle - a.idle;
      const pct = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;
      resolve(Math.max(0, Math.min(100, pct)));
    }, 250);
  });
}

/* Usage disque et temperature CPU sont desormais fournis par la couche
   plateforme : fs.statfs() remplace l'appel a `df` (voir la note dans
   server/platform/index.js), et la lecture de /sys/class/thermal n'a de
   sens que sous Linux -- ailleurs, la temperature vaut null et le
   widget "Systeme" masque simplement la ligne correspondante.
   Disk usage and CPU temperature now come from the platform layer:
   fs.statfs() replaces the `df` call (see the note in
   server/platform/index.js), and reading /sys/class/thermal only makes
   sense on Linux -- elsewhere the temperature is null and the "System"
   widget simply hides the matching row. */

app.get("/api/system", async (req, res) => {
  try {
    const [cpu, disk] = await Promise.all([cpuPercent(), platform.diskUsage()]);
    const totalMemGB = os.totalmem() / 1073741824;
    const freeMemGB = os.freemem() / 1073741824;
    const usedMemGB = totalMemGB - freeMemGB;
    res.json({
      hostname: os.hostname(),
      uptimeSec: os.uptime(),
      loadavg: os.loadavg(),
      cpuPercent: Math.round(cpu * 10) / 10,
      memTotalGB: Math.round(totalMemGB * 100) / 100,
      memUsedGB: Math.round(usedMemGB * 100) / 100,
      memPercent: Math.round((usedMemGB / totalMemGB) * 1000) / 10,
      diskTotalGB: disk ? Math.round(disk.totalGB * 10) / 10 : null,
      diskUsedGB: disk ? Math.round(disk.usedGB * 10) / 10 : null,
      diskPercent: disk ? Math.round(disk.pct * 10) / 10 : null,
      tempC: platform.cpuTemperature()
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* ---------- Analyse reseau (widget "network scan") ----------
   Sans "rescan=1" : renvoie immediatement le dernier resultat connu (ou
   lance un premier scan s'il n'y en a encore jamais eu), pour que
   l'ouverture de la tuile ne bloque jamais sur une analyse de ~10-20s
   si un resultat recent est deja disponible. Le sous-reseau peut etre
   force via ?cidr=192.168.1.0/24 (reglage de la tuile) ; sans ce
   parametre, le sous-reseau du Pi est detecte automatiquement.
   Without "rescan=1": returns the last known result immediately (or
   triggers a first scan if none has ever run yet), so opening the tile
   never blocks on a ~10-20s scan if a recent result is already
   available. The subnet can be forced via ?cidr=192.168.1.0/24 (tile
   setting); without it, the Pi's subnet is auto-detected. */
app.get("/api/network-scan", async (req, res) => {
  const forceRescan = req.query.rescan === "1";
  const cidrOverride = req.query.cidr ? String(req.query.cidr) : undefined;
  const cached = networkScan.getState();
  if (!forceRescan && cached.result) {
    return res.json({
      scanning: cached.scanning,
      hosts: cached.result.hosts,
      cidr: cached.result.cidr,
      scannedAt: cached.result.scannedAt
    });
  }
  try {
    const result = await networkScan.scanNetwork(cidrOverride);
    res.json({ scanning: false, hosts: result.hosts, cidr: result.cidr, scannedAt: result.scannedAt });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* ---------- Programme TV / TV guide (voir server/teleProgram.js) ---------- */

/* Lecture/validation de la partie "source" de la config, commune aux
   deux routes ci-dessous (/api/tele-program a besoin de tout ; /api/
   tele-channels n'a besoin que de savoir OU charger la grille). Liste
   blanche stricte -- voir la note de securite plus bas.
   Reads/validates the "source" part of the config, shared by both
   routes below (/api/tele-program needs all of it; /api/tele-channels
   only needs to know WHERE to load the grid from). Strict whitelist --
   see the security note below. */
function teleProgramSourceConfig(q) {
  const source = ["xmltvfr", "xmltv", "scrape"].includes(String(q.source)) ? String(q.source) : "xmltvfr";
  return {
    source,
    xmltvfrGuide: q.guide === "france" ? "france" : "tnt",
    xmltvUrl: source === "xmltv" ? String(q.xmltvUrl || "") : "",
    scrapeAdapter: String(q.scrapeAdapter || "generic"),
    scrapeUrl: source === "scrape" ? String(q.scrapeUrl || "") : ""
  };
}

app.get("/api/tele-program", async (req, res) => {
  // La config vient des reglages de la tuile, transmis en query. On ne
  // fait confiance qu'a une liste blanche de champs, avec des valeurs
  // contraintes -- rien n'est passe tel quel a un shell ou a une URL
  // arbitraire cote serveur.
  // Config comes from the tile settings, passed as query. We only trust
  // a whitelist of fields, with constrained values -- nothing is passed
  // as-is to a shell or an arbitrary server-side URL.
  const q = req.query;
  const view = ["now", "evening", "late"].includes(String(q.view)) ? String(q.view) : "now";
  const channels = String(q.channels || "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const config = Object.assign(teleProgramSourceConfig(q), {
    view,
    channels,
    eveningStart: /^\d{1,2}:\d{2}$/.test(String(q.eveningStart)) ? String(q.eveningStart) : "21:00",
    lateStart: /^\d{1,2}:\d{2}$/.test(String(q.lateStart)) ? String(q.lateStart) : "22:45",
    // Bornes de la fenetre de demarrage acceptee pour la 1re partie de
    // soiree (v1.7.1) -- voir le commentaire de buildView() dans
    // server/teleProgram.js pour le detail du raisonnement.
    // Bounds of the accepted start window for prime time (v1.7.1) --
    // see buildView()'s comment in server/teleProgram.js for the full
    // reasoning.
    eveningEarliestStart: /^\d{1,2}:\d{2}$/.test(String(q.eveningEarliestStart)) ? String(q.eveningEarliestStart) : "20:00",
    eveningLatestStart: /^\d{1,2}:\d{2}$/.test(String(q.eveningLatestStart)) ? String(q.eveningLatestStart) : "21:30",
    eveningMinDurationMinutes: Number.isFinite(Number(q.eveningMinDuration)) && q.eveningMinDuration !== undefined
      ? Math.max(0, Math.min(180, Number(q.eveningMinDuration))) : undefined,
    lateMinDurationMinutes: Number.isFinite(Number(q.lateMinDuration)) && q.lateMinDuration !== undefined
      ? Math.max(0, Math.min(180, Number(q.lateMinDuration))) : undefined,
    showThumbnails: q.thumbnails !== "0",
    ttlMs: 30 * 60 * 1000
  });
  try {
    const result = await teleProgram.getView(config, {});
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

/* Grille horaire complete (voir teleProgram.getGrid) : TOUS les
   programmes de chaque chaine sur une fenetre [maintenant - N heures,
   maintenant + M heures], pour l'affichage en grille facon magazine TV
   du widget Programme TV. Meme liste blanche de champs et meme cache
   que /api/tele-program ci-dessus -- seule la selection des programmes
   change. Les bornes de la fenetre sont re-verifiees dans getGrid()
   (une requete forgee a la main ne peut pas demander 30 jours de
   guide sur 400 chaines).
   Full time grid (see teleProgram.getGrid): EVERY program on each
   channel over a [now - N hours, now + M hours] window, for the TV
   guide widget's magazine-style grid display. Same field whitelist and
   same cache as /api/tele-program above -- only the program selection
   differs. Window bounds are re-checked inside getGrid() (a
   hand-crafted request can't ask for 30 days of guide across 400
   channels). */
app.get("/api/tele-program/grid", async (req, res) => {
  const q = req.query;
  const channels = String(q.channels || "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const config = Object.assign(teleProgramSourceConfig(q), {
    channels,
    hoursBefore: Number.isFinite(Number(q.hoursBefore)) ? Number(q.hoursBefore) : 1,
    hoursAfter: Number.isFinite(Number(q.hoursAfter)) ? Number(q.hoursAfter) : 6,
    showThumbnails: q.thumbnails !== "0",
    ttlMs: 30 * 60 * 1000
  });
  try {
    const result = await teleProgram.getGrid(config, {});
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

/* Liste des chaines REELLEMENT disponibles pour la source configuree --
   utilisee par le bouton "Parcourir les chaines disponibles" du widget
   Programme TV (voir fieldMarkup() / le gestionnaire ".field-browse-btn"
   dans app.js). AVANT v1.7.4, cette route renvoyait toujours la meme
   liste TNT figee (~28 chaines), quelle que soit la source configuree :
   en choisissant le guide "France (~400 chaines)", rien ne permettait a
   l'utilisateur de decouvrir puis d'ajouter les ~370 chaines
   supplementaires a la liste de sa tuile -- il ne voyait donc toujours
   que les chaines TNT presentes par defaut dans son champ "Chaines".
   Desormais, la grille reellement configuree (TNT, France, XMLTV
   personnalise ou scraping) est chargee -- via le meme cache que /api/
   tele-program, donc sans cout reseau supplementaire au second appel --
   et la liste effectivement presente dans cette grille est renvoyee.
   Repli sur la liste TNT statique en cas d'echec (source injoignable,
   guide non encore selectionne...) pour que le bouton reste utile meme
   hors ligne ou pendant la configuration initiale.

   List of channels ACTUALLY available for the configured source -- used
   by the TV guide widget's "Browse available channels" button (see
   fieldMarkup() / the ".field-browse-btn" handler in app.js). BEFORE
   v1.7.4, this route always returned the same fixed DTT list
   (~28 channels), whatever source was configured: picking the "France
   (~400 channels)" guide gave the user no way to discover, then add,
   the ~370 extra channels to their tile's list -- they kept seeing only
   the DTT channels present by default in their "Channels" field.
   The actually configured grid (DTT, France, custom XMLTV, or scraping)
   is now loaded -- through the same cache as /api/tele-program, so no
   extra network cost on the second call -- and the list truly present in
   that grid is returned. Falls back to the static DTT list on failure
   (unreachable source, guide not yet picked...) so the button stays
   useful even offline or during initial setup. */
app.get("/api/tele-channels", async (req, res) => {
  const config = Object.assign(teleProgramSourceConfig(req.query), { ttlMs: 30 * 60 * 1000 });
  try {
    const grid = await teleProgram.loadGrid(config, {});
    const list = Array.from(grid.channels.values())
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (list.length) return res.json(list);
    // Grille chargee mais vide (source atypique) : repli.
    // Grid loaded but empty (unusual source): fall back.
    throw new Error("grille vide");
  } catch (e) {
    res.json(teleProgram.DEFAULT_CHANNELS.map((c) => ({ id: c.aliases[0] || c.name, name: c.name })));
  }
});

/* Proxy d'IMAGE (binaire) pour les vignettes de programme. Distinct de
   /api/proxy qui ne renvoie que du texte : ici on relaie les octets et
   le type MIME, en se limitant aux types image. Evite les soucis de
   CORS/mixed-content et permet un cache cote navigateur.
   Binary IMAGE proxy for program thumbnails. Distinct from /api/proxy
   which only returns text: here we relay the bytes and MIME type,
   restricted to image types. Avoids CORS/mixed-content issues and
   enables browser-side caching. */
app.get("/api/image-proxy", async (req, res) => {
  const target = String(req.query.url || "");
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return res.status(400).json({ error: "invalid url" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ error: "only http(s) urls are allowed" });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "PiBoard/0.1 (+https://github.com/jihemezes/piboard)" }
    });
    clearTimeout(timer);
    const type = upstream.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
      return res.status(415).json({ error: "not an image", type });
    }
    const ab = await upstream.arrayBuffer();
    res.status(upstream.status);
    res.set("Content-Type", type);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(ab));
  } catch (e) {
    res.status(502).json({ error: "upstream image fetch failed", detail: String(e.message || e) });
  }
});

/* Voir server/webviewProxy.js pour le detail complet : sert une page
   tierce depuis l'origine de PiBoard plutot que de la charger
   directement dans l'iframe du widget "Page web", pour contourner le
   blocage d'affichage en iframe (X-Frame-Options/CSP) qu'un site peut
   poser -- sinon une page blanche silencieuse, sans la moindre erreur
   visible.
   See server/webviewProxy.js for the full detail: serves a third-party
   page from PiBoard's own origin rather than loading it directly in
   the "Web page" widget's iframe, to work around iframe-embedding
   blocks (X-Frame-Options/CSP) a site may set -- otherwise a silent
   blank page, with no visible error at all. */
app.get("/api/webview-proxy", async (req, res) => {
  // Filet de securite indispensable ici : SANS lui, une exception
  // imprevue (reseau, TLS, ou un cas non couvert par les try/catch
  // internes de webviewProxy.js) laisse la requete sans reponse --
  // Express 4 ne rattrape PAS automatiquement le rejet d'une promesse
  // dans un gestionnaire async. Le navigateur voit alors une connexion
  // qui ne repond jamais et affiche sa propre page d'erreur generique
  // ("This page couldn't load"), DANS l'iframe -- distinct de la page
  // d'erreur maison ci-dessous, qui elle necessite une reponse HTTP
  // recue avec succes pour s'afficher. Log cote serveur pour permettre
  // un diagnostic si le cas se represente.
  // Essential safety net here: WITHOUT it, an unexpected exception
  // (network, TLS, or a case not covered by webviewProxy.js's own
  // try/catch blocks) leaves the request without a response -- Express
  // 4 does NOT automatically catch a rejected promise inside an async
  // handler. The browser then sees a connection that never responds
  // and shows its own generic error page ("This page couldn't load"),
  // INSIDE the iframe -- distinct from the custom error page below,
  // which itself requires a successfully received HTTP response to
  // display. Logged server-side to allow diagnosis if this recurs.
  try {
    const result = await webviewProxy.proxyPage(String(req.query.url || ""));
    if (!result.ok) {
      // Page HTML minimale plutot qu'une reponse JSON brute : c'est ce
      // que l'iframe du widget affichera directement -- un message
      // lisible vaut mieux qu'un JSON illisible ou (pire) une page
      // blanche qui laisse croire a une panne silencieuse.
      // Minimal HTML page rather than a raw JSON response: this is what
      // the widget's iframe will display directly -- a readable message
      // beats unreadable JSON or (worse) a blank page that looks like a
      // silent failure.
      console.warn("[piboard] webview-proxy echec ->", req.query.url, JSON.stringify(result.error));
      res.status(result.status || 502);
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store");
      return res.send(webviewProxy.errorPageHtml(result.error));
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store");
    res.send(result.html);
  } catch (e) {
    console.error("[piboard] webview-proxy exception non geree ->", req.query.url, e);
    if (!res.headersSent) {
      res.status(502);
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store");
      res.send(webviewProxy.errorPageHtml(String(e.message || e)));
    }
  }
});

/* Rendu de la page EN IMAGE via Chromium headless (voir
   server/webviewShot.js) : troisieme approche, celle qui ne depend
   d'aucune cooperation du site -- ni iframe, ni reecriture de HTML.
   Resultat fixe (pas d'interaction), mais fonctionne partout.
   Renders the page AS AN IMAGE through headless Chromium (see
   server/webviewShot.js): third approach, the one depending on no
   cooperation from the site -- no iframe, no HTML rewriting. Static
   result (no interaction), but works everywhere. */
app.get("/api/webview-shot", async (req, res) => {
  try {
    const url = webviewProxy.normalizeUrl(String(req.query.url || ""));
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "invalid url" });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return res.status(400).json({ error: "only http(s) urls are allowed" });
    }
    const result = await webviewShot.capture(parsed.href, {
      width: Number(req.query.w) || 1280,
      height: Number(req.query.h) || 800
    });
    if (!result.ok) {
      console.warn("[piboard] webview-shot echec ->", parsed.href, result.error);
      return res.status(502).json({ error: result.error, installHint: result.installHint });
    }
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(result.buffer);
  } catch (e) {
    console.error("[piboard] webview-shot exception non geree ->", req.query.url, e);
    if (!res.headersSent) res.status(502).json({ error: String(e.message || e) });
  }
});

/* Voir server/crypto.js pour le detail complet : proxy CoinGecko avec
   cache et repli sur la derniere valeur connue -- l'API publique sans
   cle est plafonnee a seulement 5-15 requetes/minute, PAR ADRESSE IP,
   partagee par tout le foyer. Appeler directement depuis le navigateur
   (comportement d'avant cette route) epuise ce quota en quelques
   rafraichissements, d'ou des echecs frequents et imprevisibles.
   See server/crypto.js for the full detail: CoinGecko proxy with
   caching and fallback to the last known value -- the keyless public
   API is capped at only 5-15 requests/minute, PER IP ADDRESS, shared
   by the whole household. Calling it directly from the browser (the
   behavior before this route) exhausts that quota within a few
   refreshes, hence frequent, unpredictable failures. */
app.get("/api/crypto/prices", async (req, res) => {
  const ids = String(req.query.ids || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const currency = String(req.query.currency || "eur").toLowerCase();
  if (!ids.length) return res.status(400).json({ error: "missing ids" });
  try {
    const result = await crypto.getPrices(ids, currency);
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (e) {
    console.warn("[piboard] crypto prices echec ->", ids.join(","), e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/crypto/chart", async (req, res) => {
  const id = String(req.query.id || "").trim();
  const currency = String(req.query.currency || "eur").toLowerCase();
  const days = Math.max(1, Math.min(365, Number(req.query.days) || 1));
  if (!id) return res.status(400).json({ error: "missing id" });
  try {
    const result = await crypto.getChart(id, currency, days);
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (e) {
    console.warn("[piboard] crypto chart echec ->", id, days, e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/layout", (req, res) => {
  res.json(store.read("layout", DEFAULT_LAYOUT));
});

app.put("/api/layout", (req, res) => {
  const layout = req.body;
  if (!layout || !Array.isArray(layout.tiles)) {
    return res.status(400).json({ error: "layout.tiles must be an array" });
  }
  layout.version = (store.read("layout", DEFAULT_LAYOUT).version || 0) + 1;
  layout.updatedAt = new Date().toISOString();
  store.write("layout", layout);
  broadcast("layout", { version: layout.version, source: req.get("x-piboard-client") || null });
  res.json({ ok: true, version: layout.version });
});

/* ---------- Bibliotheque de configurations de tuiles / saved tile
   configurations library (voir server/tileConfigs.js) ---------- */

app.get("/api/tile-configs/:widgetId", (req, res) => {
  try {
    res.json(tileConfigs.listConfigs(req.params.widgetId));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.put("/api/tile-configs/:widgetId", (req, res) => {
  try {
    const title = req.body && req.body.title;
    const settings = req.body && req.body.settings;
    res.json(tileConfigs.saveConfig(req.params.widgetId, title, settings));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.delete("/api/tile-configs/:widgetId/:title", (req, res) => {
  try {
    res.json(tileConfigs.deleteConfig(req.params.widgetId, req.params.title));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* Version affichee en bas de la fenetre de reglages generaux (voir
   fetchAppVersion() dans public/app.js). Lue une seule fois au demarrage
   depuis package.json -- source unique de verite pour le numero de
   version, evitant de devoir le mettre a jour a la main a deux endroits
   (package.json ET le HTML) a chaque nouvelle version.
   Version shown at the bottom of the general settings window (see
   fetchAppVersion() in public/app.js). Read once at startup from
   package.json -- single source of truth for the version number,
   avoiding having to update it by hand in two places (package.json AND
   the HTML) on every new release. */
const APP_VERSION = require("../package.json").version;

app.get("/api/version", (req, res) => {
  res.json({ version: APP_VERSION });
});

// Sert le contenu brut de CHANGELOG.md (a la racine du projet, pas dans
// public/ donc pas accessible via le middleware statique) pour que
// l'aide integree puisse afficher les nouveautes sans quitter le
// tableau. Lecture a chaque appel plutot que mise en cache au demarrage
// : le fichier peut changer suite a une mise a jour sans redemarrer le
// serveur. Serves CHANGELOG.md's raw content (at the project root, not
// in public/ so not reachable via the static middleware) so the
// built-in help can show what's new without leaving the board. Read on
// every call rather than cached at startup: the file can change after
// an update without restarting the server.
app.get("/api/changelog", (req, res) => {
  try {
    const text = fs.readFileSync(path.join(__dirname, "..", "CHANGELOG.md"), "utf8");
    res.set("Content-Type", "text/plain; charset=utf-8").send(text);
  } catch (e) {
    res.status(404).json({ error: "changelog not found" });
  }
});

app.get("/api/settings", (req, res) => {
  res.json(Object.assign({}, DEFAULT_SETTINGS, store.read("settings", {})));
});

app.put("/api/settings", (req, res) => {
  const merged = Object.assign({}, DEFAULT_SETTINGS, store.read("settings", {}), req.body || {});
  store.write("settings", merged);
  broadcast("settings", { source: req.get("x-piboard-client") || null });
  res.json(merged);
});

/* Etat libre par widget (ex : contenu du bloc-notes)
   Free per-widget state (e.g. notes content) */
app.get("/api/state/:key", (req, res) => {
  try {
    res.json({ key: req.params.key, value: store.read("state." + req.params.key, null) });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.put("/api/state/:key", (req, res) => {
  try {
    store.write("state." + req.params.key, req.body ? req.body.value : null);
    broadcast("state", { key: req.params.key, source: req.get("x-piboard-client") || null });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* ---------- Photo de fond meteo (widget "weather") ---------- */
const { getWeatherPhoto } = require("./weatherPhoto");

app.get("/api/weather-photo/:condition", async (req, res) => {
  try {
    const photo = await getWeatherPhoto(req.params.condition, fetch);
    res.json(photo);
  } catch (e) {
    res.status(502).json({ error: "photo unavailable" });
  }
});

/* ---------- Diaporama : photos televersees (mode "upload") ----------
   Stockage local sous data/media/<tileId>/. Chaque tuile a son propre
   dossier. Local storage under data/media/<tileId>/. Each tile has its
   own folder. */
const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        cb(null, media.ensureDir(req.params.tileId));
      } catch (e) {
        cb(e);
      }
    },
    filename: (req, file, cb) => cb(null, media.safeFilename(file.originalname))
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, media.ALLOWED_EXT.has(ext));
  }
});

app.get("/api/media/:tileId", (req, res) => {
  if (!media.isValidTileId(req.params.tileId)) return res.status(400).json({ error: "invalid tile id" });
  try {
    const items = media.listMedia(req.params.tileId).map((it) => ({
      name: it.name, size: it.size,
      url: "/media/" + req.params.tileId + "/" + encodeURIComponent(it.name)
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/media/:tileId", (req, res) => {
  if (!media.isValidTileId(req.params.tileId)) return res.status(400).json({ error: "invalid tile id" });
  const existing = media.listMedia(req.params.tileId).length;
  if (existing >= media.MAX_FILES_PER_TILE) {
    return res.status(400).json({ error: "too many files (max " + media.MAX_FILES_PER_TILE + ")" });
  }
  mediaUpload.array("photos", 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: String(err.message || err) });
    res.json({ ok: true, uploaded: (req.files || []).length });
  });
});

app.delete("/api/media/:tileId/:filename", (req, res) => {
  if (!media.isValidTileId(req.params.tileId)) return res.status(400).json({ error: "invalid tile id" });
  try {
    media.deleteMedia(req.params.tileId, decodeURIComponent(req.params.filename));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/media/:tileId/:filename", (req, res) => {
  if (!media.isValidTileId(req.params.tileId)) return res.status(400).end();
  try {
    const full = media.resolveFile(req.params.tileId, decodeURIComponent(req.params.filename));
    res.sendFile(full);
  } catch (e) {
    res.status(404).end();
  }
});

/* ---------- Diaporama : dossier local arbitraire (mode "folder") ----------
   Un partage NAS/SMB monte au niveau du systeme d'exploitation, ou un
   dossier synchronise par rclone depuis un service cloud. Voir le README
   pour des exemples de montage. A local NAS/SMB share mounted at the OS
   level, or a folder synced by rclone from a cloud service. See the
   README for mount examples. */
app.get("/api/local-folder", (req, res) => {
  try {
    const items = localFolder.listLocalFolder(String(req.query.path || ""));
    res.json({ items: items.map((it) => ({ name: it.name, url: "/api/local-folder-file?path=" + encodeURIComponent(req.query.path) + "&name=" + encodeURIComponent(it.name) })) });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/api/local-folder-file", (req, res) => {
  try {
    const full = localFolder.resolveLocalFile(String(req.query.path || ""), String(req.query.name || ""));
    res.sendFile(full);
  } catch (e) {
    res.status(404).end();
  }
});

/* ---------- Diaporama : cle(s) USB connectee(s) (mode "usb") ----------
   Zero configuration cote utilisateur : on lit ce qui est deja monte
   automatiquement par Pi OS Desktop sous /media/<utilisateur>/<nom>. Voir
   server/usbMedia.js. Zero user configuration: reads what Pi OS Desktop
   has already auto-mounted under /media/<user>/<name>. See
   server/usbMedia.js. */
app.get("/api/usb-media", (req, res) => {
  try {
    const { volumes, items } = usbMedia.listUsbImages();
    res.json({
      volumes: volumes.map((v) => ({ label: v.label })),
      items: items.map((it) => ({
        name: it.relPath,
        url: "/api/usb-media-file?volume=" + encodeURIComponent(it.volumePath) + "&name=" + encodeURIComponent(it.relPath)
      }))
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/api/usb-media-file", (req, res) => {
  try {
    const full = usbMedia.resolveUsbFile(String(req.query.volume || ""), String(req.query.name || ""));
    res.sendFile(full);
  } catch (e) {
    res.status(404).end();
  }
});

/* ---------- Diaporama : dossier WebDAV (mode "webdav") ----------
   Identifiants transmis au serveur puis utilises immediatement, jamais
   stockes en clair a part dans les reglages de la tuile elle-meme (voir
   le README pour les implications de securite). Credentials sent to the
   server and used immediately, never stored beyond the tile's own
   settings (see the README for the security implications). */
app.put("/api/webdav-list", async (req, res) => {
  const { url, user, pass } = req.body || {};
  if (!url) return res.status(400).json({ error: "missing url" });
  try {
    const items = await webdav.listWebdavImages(url, user, pass, fetch);
    res.json({
      items: items.map((it) => ({
        name: it.name,
        url: "/api/webdav-file?url=" + encodeURIComponent(it.url) + "&user=" + encodeURIComponent(user || "") + "&pass=" + encodeURIComponent(pass || "")
      }))
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/webdav-file", async (req, res) => {
  try {
    const upstream = await webdav.fetchWebdavFile(String(req.query.url || ""), String(req.query.user || ""), String(req.query.pass || ""), fetch);
    res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).end();
  }
});

/* ---------- Quitter le kiosque / exit the kiosk ----------
   Deux actions distinctes, proposees par le menu de sortie :
     - /api/system/exit-kiosk ("Reinitialiser le tableau de bord")
     - /api/system/exit-to-desktop ("Revenir au bureau")

   Leur mise en oeuvre depend entierement du systeme et vit donc dans
   server/platform/ : sur le Pi, ce sont les commandes pkill visant
   lwrespawn puis Chromium, dans cet ordre critique (voir la note
   detaillee dans server/platform/linux.js) ; sous Windows, ce sont les
   fonctions que le processus principal Electron enregistre via
   platform.registerKioskController(). Cette route ne connait ni l'un ni
   l'autre.

   Two distinct actions, offered by the exit menu:
     - /api/system/exit-kiosk ("Reset the dashboard")
     - /api/system/exit-to-desktop ("Return to the desktop")
   Their implementation is entirely system-dependent and therefore lives
   in server/platform/: on the Pi these are the pkill commands targeting
   lwrespawn then Chromium, in that critical order (see the detailed
   note in server/platform/linux.js); on Windows they are the functions
   the Electron main process registers through
   platform.registerKioskController(). This route knows about neither. */

/* N'agit QUE si la connexion vient de la machine elle-meme (l'affichage
   en kiosque, qui se connecte a son propre serveur via localhost) --
   jamais si la requete vient d'ailleurs sur le reseau. On se base sur
   l'adresse IP source reelle de la connexion TCP (req.ip), jamais
   falsifiable par le client, plutot que sur un quelconque en-tete ou
   parametre envoye par le navigateur : "trust proxy" n'est pas active
   dans cette appli (pas de proxy inverse), donc req.ip reflete
   directement le socket TCP entrant.
   Only acts if the connection comes from the machine itself (the kiosk
   display connecting to its own server via localhost) -- never if the
   request comes from elsewhere on the network. Based on the TCP
   connection's real source IP (req.ip), never spoofable by the client,
   rather than any header or parameter sent by the browser: "trust
   proxy" is not enabled in this app (no reverse proxy), so req.ip
   directly reflects the incoming TCP socket. */
function isLocalRequest(req) {
  const ip = req.ip || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

/* ---------- Integration a l'application de bureau / desktop app integration ----------
   Interrogee par l'interface au chargement pour savoir dans quel
   contexte elle s'execute. Dans un navigateur ordinaire (ou sur le Pi),
   "desktopApp" vaut false et la section de reglages correspondante
   reste masquee.
   Queried by the interface on load to know which context it runs in. In
   a plain browser (or on the Pi), "desktopApp" is false and the
   matching settings section stays hidden. */
app.get("/api/system/app-integration", (req, res) => {
  res.json({
    desktopApp: platform.isDesktopApp(),
    platform: platform.id,
    autoStart: platform.getAutoStart()
  });
});

app.post("/api/system/autostart", (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ supported: false, reason: "not-local" });
  }
  const enabled = !!(req.body || {}).enabled;
  res.json(platform.setAutoStart(enabled));
});

app.post("/api/system/exit-kiosk", (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ ok: false, reason: "not-local" });
  }
  // On repond avant meme que l'action ait pris effet : une fois
  // l'affichage ferme, il n'y a plus personne pour recevoir la reponse.
  // We respond before the action has even taken effect: once the display
  // is closed, there is no one left to receive the response.
  const result = platform.exitKiosk();
  res.json(result);
});

app.post("/api/system/exit-to-desktop", (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ ok: false, reason: "not-local" });
  }
  const result = platform.exitToDesktop();
  res.json(result);
});


/* ---------- Compteur de requetes trafic (widget "traffic") ---------- */
const trafficQuota = require("./trafficQuota");

app.get("/api/traffic-quota/:tileId", (req, res) => {
  try {
    res.json(trafficQuota.getToday(req.params.tileId));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/traffic-quota/:tileId", (req, res) => {
  try {
    const n = Number((req.body || {}).count) || 0;
    res.json(trafficQuota.increment(req.params.tileId, n));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* ---------- Notification webhook (compte a rebours, etc.) ----------
   Relaie un appel GET ou POST vers une URL de notification tierce
   (ntfy.sh, Voice Monkey pour Alexa, API SMS Free Mobile, Home Assistant,
   Pushover, IFTTT...). Cote serveur pour eviter tout probleme de CORS.
   Relays a GET or POST call to a third-party notification URL (ntfy.sh,
   Voice Monkey for Alexa, Free Mobile SMS API, Home Assistant, Pushover,
   IFTTT...). Server-side to avoid any CORS issue. */
app.put("/api/notify", async (req, res) => {
  const { url, method, body } = req.body || {};
  let parsed;
  try {
    parsed = new URL(String(url || ""));
  } catch (e) {
    return res.status(400).json({ error: "invalid url" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ error: "only http(s) urls are allowed" });
  }
  const verb = String(method || "GET").toUpperCase() === "POST" ? "POST" : "GET";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const upstream = await fetch(parsed.href, {
      method: verb,
      signal: controller.signal,
      headers: verb === "POST" ? { "Content-Type": "text/plain; charset=utf-8" } : undefined,
      body: verb === "POST" && body ? String(body) : undefined
    });
    clearTimeout(timer);
    res.json({ ok: upstream.ok, status: upstream.status });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
});

/* ---------- Proxy RSS / generique texte ----------
   Recupere une ressource http(s) et la renvoie telle quelle.
   Utilise par le widget RSS pour contourner le CORS des flux.
   Fetches an http(s) resource and returns it as-is.
   Used by the RSS widget to bypass feed CORS. */
app.get("/api/proxy", async (req, res) => {
  const target = String(req.query.url || "");
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return res.status(400).json({ error: "invalid url" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ error: "only http(s) urls are allowed" });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "PiBoard/0.1 (+https://github.com/jihemezes/piboard)" }
    });
    clearTimeout(timer);
    const body = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "text/plain; charset=utf-8");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed", detail: String(e.message || e) });
  }
});

/* ---------- Extraction d'article (widget RSS, mode lecture) ----------
   Voir server/articleExtract.js pour le detail et les precautions
   (usage a la demande uniquement, pas de mise en cache persistante).
   See server/articleExtract.js for details and precautions (on-demand
   use only, no persistent caching). */
app.get("/api/article-extract", async (req, res) => {
  const target = String(req.query.url || "");
  try {
    const article = await articleExtract.extractArticle(target);
    res.json(article);
  } catch (e) {
    // Journalise systematiquement : sans ca, un echec d'extraction est
    // totalement invisible depuis la console/journalctl du Pi, rendant
    // impossible de savoir POURQUOI le widget RSS se rabat sur le
    // resume du flux plutot que le texte complet (site qui bloque la
    // requete, delai depasse, contenu juge trop pauvre...).
    // Always logged: without this, an extraction failure is entirely
    // invisible from the Pi's console/journalctl, making it impossible
    // to tell WHY the RSS widget falls back to the feed's summary
    // instead of the full text (site blocking the request, timeout,
    // content judged too thin...).
    console.warn("[piboard] article-extract echec pour", target, "->", e.message || e);
    res.status(502).json({ error: String(e.message || e), paywall: !!e.paywall });
  }
});

/* ---------- Secrets de tuile / tile secrets ----------
   Voir server/tileSecrets.js. Une valeur sensible s'ECRIT et s'EFFACE,
   mais ne se RELIT jamais : aucune route ne renvoie un secret, seulement
   sa presence. Un secret qui a transite une fois vers le serveur ne
   redescend plus jamais vers le navigateur.
   See server/tileSecrets.js. A sensitive value can be WRITTEN and
   CLEARED, but never READ BACK: no route returns a secret, only whether
   one is set. A secret that went up to the server never comes back down
   to the browser. */
app.get("/api/tile-secrets/:tileId/:key", (req, res) => {
  res.json({ configured: tileSecrets.has(req.params.tileId, req.params.key) });
});

app.put("/api/tile-secrets/:tileId/:key", (req, res) => {
  const value = req.body && typeof req.body.value === "string" ? req.body.value : "";
  tileSecrets.set(req.params.tileId, req.params.key, value);
  res.json({ configured: tileSecrets.has(req.params.tileId, req.params.key) });
});

app.delete("/api/tile-secrets/:tileId", (req, res) => {
  tileSecrets.clearTile(req.params.tileId);
  res.json({ ok: true });
});

/* ---------- Boite aux lettres / mailbox ----------
   Voir server/mailbox.js : lecture STRICTEMENT seule, rien n'est stocke.
   La configuration non sensible (serveur, identifiant, dossier) arrive
   du client a chaque appel ; seul le mot de passe vient du coffre.
   See server/mailbox.js: STRICTLY read-only, nothing is stored. The
   non-sensitive configuration (server, user, folder) comes from the
   client on each call; only the password comes from the vault. */
function mailConfigFrom(req) {
  return {
    host: req.query.host, port: req.query.port, user: req.query.user,
    folder: req.query.folder, limit: req.query.limit
  };
}

app.get("/api/mail/:tileId/list", async (req, res) => {
  try {
    res.json(await mailbox.listHeaders(req.params.tileId, mailConfigFrom(req)));
  } catch (e) {
    console.warn("[piboard] mail list:", e.message);
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/mail/:tileId/message", async (req, res) => {
  try {
    res.json(await mailbox.getMessage(req.params.tileId, mailConfigFrom(req), req.query.uid));
  } catch (e) {
    console.warn("[piboard] mail message:", e.message);
    res.status(502).json({ error: String(e.message || e) });
  }
});

/* ---------- Astronomie / astronomy ----------
   Voir server/astronomy.js : calcul local, sans dependance reseau.
   See server/astronomy.js: local computation, no network dependency. */
app.get("/api/astronomy/moon", (req, res) => {
  try {
    res.json(astronomy.moonPhase(new Date()));
  } catch (e) {
    console.warn("[piboard] astronomy/moon:", e.message);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/astronomy/planets", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat/lon required" });
  }
  try {
    const elevation = Number(req.query.elevation) || 0;
    const includeOuter = req.query.includeOuter === "true";
    res.json({ planets: astronomy.visiblePlanets(lat, lon, elevation, includeOuter, new Date()) });
  } catch (e) {
    console.warn("[piboard] astronomy/planets:", e.message);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/astronomy/eclipse", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat/lon required" });
  }
  try {
    const elevation = Number(req.query.elevation) || 0;
    res.json(astronomy.nextEclipse(lat, lon, elevation, new Date()));
  } catch (e) {
    console.warn("[piboard] astronomy/eclipse:", e.message);
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* ---------- Sauvegarde / restauration -- backups ----------
   Voir server/backups.js : le coffre a secrets (mots de passe) n'en
   fait JAMAIS partie -- voir l'en-tete de ce fichier pour le
   raisonnement complet.
   See server/backups.js: the secrets vault (passwords) is NEVER part of
   it -- see that file's header for the full reasoning. */
const backupUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.get("/api/backups", (req, res) => {
  try {
    res.json({ backups: backups.list() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/backups", (req, res) => {
  try {
    const label = req.body && typeof req.body.label === "string" ? req.body.label : null;
    res.json(backups.create(APP_VERSION, label));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/backups/:id/download", (req, res) => {
  try {
    if (!backups.idIsValid(req.params.id)) return res.status(400).json({ error: "invalid id" });
    const record = backups.readRecord(req.params.id);
    res.setHeader("Content-Disposition", `attachment; filename="piboard-backup-${req.params.id}.json"`);
    res.json(record);
  } catch (e) {
    res.status(404).json({ error: "backup not found" });
  }
});

app.post("/api/backups/:id/restore", (req, res) => {
  try {
    if (!backups.idIsValid(req.params.id)) return res.status(400).json({ error: "invalid id" });
    res.json(backups.restore(req.params.id));
  } catch (e) {
    res.status(404).json({ error: "backup not found" });
  }
});

app.delete("/api/backups/:id", (req, res) => {
  try {
    if (!backups.idIsValid(req.params.id)) return res.status(400).json({ error: "invalid id" });
    backups.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: "backup not found" });
  }
});

app.post("/api/backups/import", backupUpload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no file" });
    res.json(backups.importAndRestore(req.file.buffer));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* ---------- IPTV : playlist de chaines / channel playlist ----------
   Voir server/iptv.js. Seule la LISTE transite par le serveur (question
   de CORS) ; les flux video sont lus directement par le navigateur.
   See server/iptv.js. Only the LIST goes through the server (a CORS
   matter); the video streams are read directly by the browser. */
/* Relais HLS (voir server/iptvHlsProxy.js) : contourne le blocage CORS
   du navigateur sur les manifestes et segments des flux en direct --
   necessaire, pas facultatif, ces flux ne demarrant simplement jamais
   sans lui. HLS relay (see server/iptvHlsProxy.js): works around the
   browser's CORS block on live streams' manifests and segments --
   necessary, not optional, these streams simply never starting
   without it. */
app.get("/api/iptv/hls-proxy", async (req, res) => {
  await iptvHlsProxy.handleProxyRequest(String(req.query.url || ""), res);
});

app.get("/api/iptv/playlist", async (req, res) => {
  const target = String(req.query.url || "");
  try {
    res.json(await iptv.fetchPlaylist(target));
  } catch (e) {
    console.warn("[piboard] iptv playlist echec pour", target, "->", e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

/* Xtream Codes : les trois routes suivantes attendent l'URL de
   playlist TELLE QUE SAISIE dans les reglages (le meme champ que pour
   un M3U simple) -- le serveur, jamais le widget, en extrait le
   serveur racine et les identifiants. Voir parseXtreamCredentials()
   dans server/iptv.js.
   Xtream Codes: the three routes below expect the playlist URL AS
   TYPED in the settings (the same field as for a plain M3U) -- the
   server, never the widget, extracts the root server and credentials
   from it. See parseXtreamCredentials() in server/iptv.js. */
function xtreamCredsOr400(req, res) {
  const creds = iptv.parseXtreamCredentials(String(req.query.url || ""));
  if (!creds) {
    res.status(400).json({ error: "not an Xtream-style playlist URL (no username/password found)" });
    return null;
  }
  return creds;
}

/* Reencodage audio d'un flux (voir server/iptvAudio.js) : uniquement
   sollicite quand l'utilisateur active l'option sur une tuile, les
   flux etant sinon lus directement par le navigateur.
   Audio re-encoding of a stream (see server/iptvAudio.js): only ever
   requested when the user enables the option on a tile, streams being
   otherwise read directly by the browser. */
app.get("/api/iptv/audio-fix", async (req, res) => {
  const target = String(req.query.url || "");
  if (!/^https?:\/\//i.test(target)) {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  const mode = req.query.mode === "full" ? "full" : "audio";
  if (!(await iptvAudio.checkFfmpeg())) {
    res.status(503).json({ error: "ffmpeg not available" });
    return;
  }

  // Pour un flux EN DIRECT (pas VOD -- movies/series fonctionnent deja
  // sans ceci, confirme par retour utilisateur), VLC recupere le flux
  // en amont quand il est disponible : certains fournisseurs IPTV
  // rejettent ffmpeg seul (405), constat confirme par examen du
  // lecteur de reference officiel, qui utilise libVLC nativement pour
  // le direct -- voir server/iptvVlc.js pour le detail complet. Repli
  // PROPRE sur ffmpeg seul si VLC n'est pas installe : certains
  // fournisseurs n'ont pas ce probleme, la fonctionnalite doit rester
  // utilisable sans VLC dans ce cas.
  // For a LIVE stream (not VOD -- movies/series already work without
  // this, confirmed by user feedback), VLC fetches the stream upstream
  // when available: some IPTV providers reject ffmpeg alone (405), a
  // finding confirmed by examining the official reference player,
  // which uses libVLC natively for live -- see server/iptvVlc.js for
  // the full detail. CLEAN fallback to ffmpeg alone if VLC isn't
  // installed: some providers don't have this problem, the feature
  // must stay usable without VLC in that case.
  const isLive = /\/live\//i.test(target) || !/\/(movie|series)\//i.test(target);
  let vlc = null;
  let inputStream;
  if (isLive && (await iptvVlc.checkVlc())) {
    vlc = iptvVlc.spawnTranscode(target);
    inputStream = vlc.stdout;
    // Capture de la sortie d'erreur de VLC : absente jusqu'ici, un echec
    // silencieux du cote VLC (0 octet produit, ffmpeg bloque a attendre
    // des donnees qui n'arrivent jamais) restait invisible. Journalisee
    // cote serveur ; a considerer pour un futur ajout au diagnostic si
    // le besoin s'en fait de nouveau sentir.
    // Captures VLC's own error output: missing until now, a silent
    // failure on VLC's side (0 bytes produced, ffmpeg stuck waiting for
    // data that never arrives) stayed invisible. Logged server-side;
    // worth adding to the diagnostic tool too if the need arises again.
    let vlcStderr = "";
    vlc.stderr.on("data", (d) => { vlcStderr = (vlcStderr + d.toString()).slice(-500); });
    vlc.on("close", (code) => {
      if (code !== 0 && code !== null) console.warn("[piboard] iptv vlc transcode code", code, vlcStderr.trim());
    });
    vlc.on("error", (e) => console.warn("[piboard] iptv vlc transcode", e.message || e));
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Cache-Control", "no-store");
  iptvAudio.streamTranscoded(target, res, undefined, mode, inputStream);

  // VLC est un processus SEPARE de ffmpeg (voir server/iptvAudio.js,
  // qui arrete deja ffmpeg a la deconnexion) : doit etre arrete ici
  // independamment, sinon un flux en direct continuerait a etre relaye
  // dans le vide -- fuite garantie sur un Pi.
  // VLC is a process SEPARATE from ffmpeg (see server/iptvAudio.js,
  // which already stops ffmpeg on disconnect): must be stopped here
  // independently, otherwise a live stream would keep being relayed
  // into the void -- a guaranteed leak on a Pi.
  if (vlc) {
    const killVlc = () => { try { vlc.kill("SIGKILL"); } catch (e) { /* noop */ } };
    res.on("close", killVlc);
    res.on("error", killVlc);
  }
});

app.get("/api/iptv/audio-fix-available", async (req, res) => {
  // Le conseil d'installation depend du systeme (voir server/platform/)
  // : l'exposer permet a l'interface d'afficher la bonne commande, au
  // lieu d'une instruction generique fausse sur deux systemes sur trois.
  // The install hint depends on the system (see server/platform/):
  // exposing it lets the interface show the right command, instead of a
  // generic instruction that's wrong on two systems out of three.
  res.json({ available: await iptvAudio.checkFfmpeg(), installHint: iptvAudio.installHint() });
});

/* Page de diagnostic, pensee pour etre consultee directement dans un
   navigateur (une simple URL a coller) plutot que via les outils de
   developpement -- un obstacle reel pour une application installee sous
   Windows, deja rencontre plusieurs fois. Lance le vrai pipeline ffmpeg
   sur l'URL fournie, pendant 8s seulement (jamais envoye au
   navigateur), et affiche precisement ce qui s'est passe.
   Diagnostic page, meant to be viewed directly in a browser (a plain
   URL to paste) rather than via developer tools -- a real obstacle for
   an installed Windows application, already run into several times.
   Runs the real ffmpeg pipeline on the given URL, for 8s only (never
   sent to the browser), and shows precisely what happened. */
app.get("/api/iptv/diagnose", async (req, res) => {
  const target = String(req.query.url || "");
  const mode = req.query.mode === "full" ? "full" : "audio";
  if (!/^https?:\/\//i.test(target)) {
    res.status(400).send("URL invalide / invalid URL");
    return;
  }
  if (!(await iptvAudio.checkFfmpeg())) {
    res.status(503).send("ffmpeg introuvable / ffmpeg not found");
    return;
  }

  // Meme logique que la route de lecture reelle (/api/iptv/audio-fix) :
  // sans ceci, ce diagnostic testerait ffmpeg seul alors que la vraie
  // lecture passe par VLC pour le direct -- deux chemins differents,
  // deux resultats potentiellement differents. Voir server/iptvVlc.js.
  // Same logic as the real playback route (/api/iptv/audio-fix):
  // without this, this diagnostic would test ffmpeg alone while real
  // playback goes through VLC for live -- two different paths, two
  // potentially different results. See server/iptvVlc.js.
  const isLive = /\/live\//i.test(target) || !/\/(movie|series)\//i.test(target);
  const vlcAvailable = isLive && (await iptvVlc.checkVlc());
  let vlc = null;
  let inputStream;
  let vlcStderr = "";
  if (vlcAvailable) {
    vlc = iptvVlc.spawnTranscode(target);
    inputStream = vlc.stdout;
    // Capture de la sortie d'erreur de VLC, incluse dans le rapport
    // final : absente jusqu'ici, un echec silencieux du cote VLC (0
    // octet produit, ffmpeg bloque sans jamais recevoir de donnees)
    // restait totalement invisible et impossible a diagnostiquer.
    // Captures VLC's own error output, included in the final report:
    // missing until now, a silent failure on VLC's side (0 bytes
    // produced, ffmpeg stuck never receiving any data) stayed entirely
    // invisible and impossible to diagnose.
    vlc.stderr.on("data", (d) => { vlcStderr = (vlcStderr + d.toString()).slice(-3000); });
  }

  const r = await iptvAudio.diagnose(target, mode, inputStream);
  if (vlc) { try { vlc.kill("SIGKILL"); } catch (e) { /* noop */ } }

  res.set("Content-Type", "text/plain; charset=utf-8");
  if (r.spawnError) {
    res.send("Echec au demarrage de ffmpeg / Failed to start ffmpeg:\n" + r.spawnError);
    return;
  }
  res.send(
    "=== Diagnostic IPTV / IPTV diagnostic ===\n" +
    "URL : " + target + "\n" +
    "Mode : " + mode + "\n" +
    "Chemin emprunte / Path used : " + (vlcAvailable ? "VLC -> ffmpeg" : "ffmpeg seul / ffmpeg alone" + (isLive ? " (VLC indisponible ou non installe / VLC unavailable or not installed)" : " (contenu VOD, VLC non necessaire / VOD content, VLC not needed)")) + "\n\n" +
    "Code de sortie ffmpeg / ffmpeg exit code : " + r.exitCode + "\n" +
    "Octets produits / bytes produced : " + r.bytesProduced + "\n" +
    "Premier octet apres / first byte after : " + (r.firstByteAfterMs == null ? "jamais (aucune donnee produite) / never (no data produced)" : r.firstByteAfterMs + " ms") + "\n" +
    "Duree totale / total duration : " + r.totalDurationMs + " ms\n\n" +
    (vlcAvailable ? "--- Sortie VLC (stderr) / VLC output (stderr) ---\n" + (vlcStderr || "(vide / empty)") + "\n\n" : "") +
    "--- Sortie ffmpeg (stderr) / ffmpeg output (stderr) ---\n" +
    (r.ffmpegStderr || "(vide / empty)")
  );
});

app.get("/api/iptv/xtream-categories", async (req, res) => {
  const creds = xtreamCredsOr400(req, res);
  if (!creds) return;
  try {
    res.json(await iptv.fetchXtreamCategories(creds.server, creds.username, creds.password));
  } catch (e) {
    console.warn("[piboard] iptv xtream-categories echec ->", e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/iptv/xtream-streams", async (req, res) => {
  const creds = xtreamCredsOr400(req, res);
  if (!creds) return;
  try {
    const kind = String(req.query.kind || "");
    res.json(await iptv.fetchXtreamStreams(creds.server, creds.username, creds.password, kind, req.query.categoryId));
  } catch (e) {
    console.warn("[piboard] iptv xtream-streams echec ->", e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/iptv/xtream-series-info", async (req, res) => {
  const creds = xtreamCredsOr400(req, res);
  if (!creds) return;
  try {
    res.json(await iptv.fetchXtreamSeriesEpisodes(creds.server, creds.username, creds.password, req.query.seriesId));
  } catch (e) {
    console.warn("[piboard] iptv xtream-series-info echec ->", e.message || e);
    res.status(502).json({ error: String(e.message || e) });
  }
});

/* ---------- Statique / static ---------- */

app.use("/vendor/gridstack", express.static(GRIDSTACK_DIST, { maxAge: "7d" }));
app.use("/vendor/leaflet", express.static(LEAFLET_DIST, { maxAge: "7d" }));
app.use("/vendor/hls", express.static(HLS_DIST, { maxAge: "7d" }));
app.use(express.static(PUBLIC_DIR, {
  setHeaders(res, filePath) {
    // Le front evolue : pas de cache agressif sur js/html/css
    // Front-end iterates: no aggressive caching on js/html/css
    if (/\.(js|html|css|json)$/.test(filePath)) {
      res.set("Cache-Control", "no-cache, must-revalidate");
    }
  }
}));

/* Verification au demarrage : si une dependance vendorisee manque (le
   dossier n'existe pas dans node_modules/), on le signale clairement
   dans le terminal plutot que de laisser les tuiles concernees echouer
   silencieusement avec des erreurs 404 confuses cote navigateur. Arrive
   typiquement apres une mise a jour qui ajoute une nouvelle dependance
   (ex. leaflet pour la carte de trafic, multer pour le diaporama) sans
   avoir relance "npm install".
   Startup check: if a vendored dependency is missing (its folder isn't
   in node_modules/), flag it clearly in the terminal rather than letting
   the affected tiles silently fail with confusing 404s in the browser.
   Typically happens after an update that adds a new dependency (e.g.
   leaflet for the traffic map, multer for the slideshow) without having
   re-run "npm install". */
for (const [name, dir] of [["gridstack", GRIDSTACK_DIST], ["leaflet", LEAFLET_DIST], ["hls.js", HLS_DIST]]) {
  if (!fs.existsSync(dir)) {
    console.warn(`\n[piboard] ATTENTION : la dependance "${name}" est introuvable (${dir}).`);
    console.warn(`[piboard] Lancez "npm install" dans le dossier de PiBoard, puis relancez "npm start".\n`);
  }
}

/* Le demarrage est expose sous forme de fonction plutot que declenche a
   l'import : le processus principal Electron doit pouvoir attendre que
   le serveur ecoute VRAIMENT avant d'ouvrir sa fenetre, et connaitre le
   port effectivement obtenu. Lance directement (`npm start`, service
   systemd du Pi), le module conserve son comportement historique et
   ecoute immediatement.

   Startup is exposed as a function rather than triggered on import: the
   Electron main process must be able to wait until the server is
   ACTUALLY listening before opening its window, and to know which port
   it ended up on. Run directly (`npm start`, the Pi's systemd service),
   the module keeps its historical behaviour and listens right away. */
function start(options) {
  const opts = options || {};
  const port = opts.port === undefined ? PORT : opts.port;
  const host = opts.host || HOST;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    server.once("error", reject);
    server.once("listening", () => {
      // Avec le port 0, le systeme en attribue un libre : il faut donc
      // relire l'adresse reelle plutot que de supposer "port".
      // With port 0 the system assigns a free one, so the real address
      // must be read back rather than assuming "port".
      const actual = server.address().port;
      console.log(`[piboard] listening on http://${host}:${actual}  (data: ${store.DATA_DIR})`);
      resolve({ server, port: actual, host });
    });
  });
}

if (require.main === module) {
  start().catch((e) => {
    console.error(`[piboard] impossible de demarrer le serveur / cannot start server: ${e.message || e}`);
    process.exit(1);
  });
}

module.exports = { app, start };
