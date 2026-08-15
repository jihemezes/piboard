/* ============================================================
   PiBoard - server/webviewShot.js
   Rendu d'une page web EN IMAGE, cote serveur, via Chromium en mode
   headless (sans interface). Troisieme approche de la tuile "Page web",
   apres l'iframe directe et le relais HTML (voir
   server/webviewProxy.js).

   Pourquoi celle-ci fonctionne la ou les autres echouent : il n'y a
   plus ni iframe (donc X-Frame-Options/CSP frame-ancestors n'ont plus
   aucune prise) ni reecriture de HTML (donc plus de ressources
   relatives cassees, plus de JavaScript qui appelle une origine
   inattendue). Chromium charge la page exactement comme le ferait un
   vrai navigateur -- il EXECUTE le JavaScript, attend le rendu, puis
   photographie le resultat. Ce que PiBoard affiche ensuite est une
   simple image PNG : rien ne peut plus la bloquer.

   Contrepartie assumee, et c'est la vraie limite a connaitre : le
   resultat est FIXE. Pas de defilement, pas de clic, pas de
   formulaire. Convient a un tableau mural qui affiche une page en
   consultation (page d'accueil d'une mairie, tableau de bord, page de
   statut) -- pas a un service avec lequel on interagit.

   Cout : un lancement de Chromium par capture. Sur un Pi 4, compter
   quelques secondes. C'est pourquoi la tuile met l'image en cache et
   ne recapture qu'a l'intervalle de rafraichissement configure, jamais
   en continu.

   Why this one works where the others fail: there's no iframe anymore
   (so X-Frame-Options/CSP frame-ancestors have nothing to act on) and
   no HTML rewriting (so no broken relative resources, no JavaScript
   calling an unexpected origin). Chromium loads the page exactly as a
   real browser would -- it RUNS the JavaScript, waits for rendering,
   then photographs the result. What PiBoard then displays is a plain
   PNG image: nothing can block it anymore.

   Accepted trade-off, and the real limitation to know about: the
   result is STATIC. No scrolling, no clicking, no forms. Suits a wall
   dashboard displaying a page for consultation (a town hall's home
   page, a dashboard, a status page) -- not a service you interact
   with.

   Cost: one Chromium launch per capture. On a Pi 4, expect a few
   seconds. This is why the tile caches the image and only recaptures
   at the configured refresh interval, never continuously.
   ============================================================ */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const platform = require("./platform");

const SHOT_TIMEOUT_MS = 45000; // Chromium sur un Pi peut etre lent au premier lancement / Chromium on a Pi can be slow on first launch

let cachedBinary;

/* Premier binaire Chromium reellement present, teste par EXISTENCE du
   fichier plutot qu'en lancant "--version" -- meme raison que la
   detection de VLC sous Windows (voir server/iptvVlc.js) : lancer un
   navigateur juste pour l'interroger peut ouvrir une fenetre ou rester
   bloque. Les entrees sans separateur de chemin (ex. "chromium") sont
   des noms a resoudre via le PATH : on les garde en dernier recours,
   spawn saura les resoudre lui-meme.
   First Chromium binary actually present, tested by file EXISTENCE
   rather than by running "--version" -- same reason as VLC detection
   on Windows (see server/iptvVlc.js): launching a browser just to
   query it may open a window or hang. Entries with no path separator
   (e.g. "chromium") are names to resolve through PATH: kept as a last
   resort, spawn can resolve them itself. */
function findChromium() {
  if (cachedBinary !== undefined) return cachedBinary;
  const candidates = platform.chromiumCandidates ? platform.chromiumCandidates() : [];
  let bareName = null;
  for (const c of candidates) {
    if (!c) continue;
    if (!c.includes("/") && !c.includes("\\")) {
      if (!bareName) bareName = c;
      continue;
    }
    try {
      if (fs.existsSync(c)) { cachedBinary = c; return cachedBinary; }
    } catch (e) { /* chemin inaccessible : on continue / unreachable path: keep going */ }
  }
  cachedBinary = bareName; // null si rien du tout / null if nothing at all
  return cachedBinary;
}

function installHint() {
  return platform.chromiumInstallHint ? platform.chromiumInstallHint() : { fr: "", en: "" };
}

/* Arguments de capture. --headless=new est le mode sans interface des
   Chromium recents ; les options qui suivent evitent les ecueils
   classiques sur un Pi en kiosque : pas de bac a sable (Chromium
   tourne souvent deja sous un utilisateur non privilegie et le bac a
   sable echouerait), pas d'acceleration GPU (inutile hors ecran et
   source de plantages sur Pi), et un profil TEMPORAIRE distinct --
   indispensable, sans quoi Chromium refuserait de demarrer une seconde
   instance en reutilisant le profil du kiosque deja lance.
   Capture arguments. --headless=new is recent Chromium's headless
   mode; the options that follow avoid the classic pitfalls on a kiosk
   Pi: no sandbox (Chromium often already runs as an unprivileged user
   and the sandbox would fail), no GPU acceleration (pointless
   off-screen and a source of crashes on Pi), and a SEPARATE temporary
   profile -- essential, otherwise Chromium would refuse to start a
   second instance reusing the already-running kiosk's profile. */
function buildShotArgs(url, outFile, profileDir, opts) {
  const o = opts || {};
  const width = Math.max(320, Math.min(3840, Number(o.width) || 1280));
  const height = Math.max(240, Math.min(2160, Number(o.height) || 800));
  const delayMs = Math.max(0, Math.min(15000, Number(o.delayMs) || 2000));
  return [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--user-data-dir=" + profileDir,
    "--window-size=" + width + "," + height,
    // Laisse le temps au JavaScript et aux polices/images de finir --
    // sans cela, beaucoup de sites modernes seraient photographies
    // a moitie vides. Gives JavaScript and fonts/images time to
    // settle -- without it, many modern sites would be photographed
    // half-empty.
    "--virtual-time-budget=" + delayMs,
    "--screenshot=" + outFile,
    url
  ];
}

/* Capture la page et renvoie l'image PNG en memoire. Le fichier
   temporaire et le profil jetable sont systematiquement nettoyes, y
   compris en cas d'echec ou de depassement du delai : une capture qui
   echoue ne doit jamais laisser grossir le disque d'un Pi.
   Captures the page and returns the PNG image in memory. The temporary
   file and throwaway profile are always cleaned up, including on
   failure or timeout: a failed capture must never be left growing a
   Pi's disk. */
function capture(url, opts) {
  return new Promise((resolve) => {
    const bin = findChromium();
    if (!bin) {
      resolve({ ok: false, error: "chromium not found", installHint: installHint() });
      return;
    }

    let tmpDir;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-shot-"));
    } catch (e) {
      resolve({ ok: false, error: "cannot create temp dir: " + (e.message || e) });
      return;
    }
    const outFile = path.join(tmpDir, "shot.png");
    const profileDir = path.join(tmpDir, "profile");

    const cleanup = () => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* noop */ }
    };

    const args = buildShotArgs(url, outFile, profileDir, opts);
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderrTail = "";
    proc.stderr.on("data", (d) => { stderrTail = (stderrTail + d.toString()).slice(-800); });

    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch (e) { /* noop */ }
    }, SHOT_TIMEOUT_MS);

    proc.on("error", (e) => {
      clearTimeout(timer);
      cleanup();
      resolve({ ok: false, error: "cannot launch chromium: " + (e.message || e), installHint: installHint() });
    });

    proc.on("close", () => {
      clearTimeout(timer);
      let buffer = null;
      try {
        if (fs.existsSync(outFile)) buffer = fs.readFileSync(outFile);
      } catch (e) { /* lecture impossible : traite comme un echec / unreadable: treated as a failure */ }
      cleanup();
      if (buffer && buffer.length) {
        resolve({ ok: true, buffer });
      } else {
        // Le code de sortie de Chromium n'est pas fiable pour ce mode
        // (il peut renvoyer 0 sans avoir rien ecrit) : c'est la
        // PRESENCE du fichier qui fait foi.
        // Chromium's exit code isn't reliable for this mode (it can
        // return 0 without having written anything): the file's
        // PRESENCE is what counts.
        resolve({ ok: false, error: stderrTail.trim() || "chromium produced no image" });
      }
    });
  });
}

module.exports = { capture, findChromium, buildShotArgs, installHint };
