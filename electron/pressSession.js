/* ============================================================
   PiBoard - electron/pressSession.js
   Session de navigateur des abonnements presse (voir
   server/pressAccess.js pour le principe).

   UNE PARTITION DEDIEE, PERSISTANTE. « persist:piboard-press » est un
   profil de navigateur a part : ses cookies survivent aux redemarrages,
   mais ne se melangent jamais a ceux de la fenetre du tableau de bord
   (servie par 127.0.0.1) ni a ceux d'autres tuiles. Se deconnecter
   d'un site efface SES cookies, et seulement les siens.

   DEUX USAGES :
   - login(url) : une fenetre visible ou l'utilisateur se connecte
     lui-meme, captcha et double authentification compris. PiBoard
     n'intercepte rien de ce qui y est tape.
   - fetchHtml(url) : une fenetre INVISIBLE charge l'article, laisse au
     site le temps d'afficher son contenu, puis rend le HTML de la page.
     C'est un vrai navigateur : les protections anti-robot qui refusent
     le mode lecture serveur le laissent passer, comme elles laissent
     passer l'utilisateur.

   L'IDENTIFIANT DE NAVIGATEUR. Celui d'Electron contient
   « Electron/x.y » et le nom de l'application, que certains sites
   traitent comme un robot. On les retire pour presenter l'identifiant
   du Chromium embarque -- qui est exactement le moteur utilise. Le
   MEME identifiant sert a la connexion et a la lecture : un site qui
   lie la session a l'identifiant ne la voit pas changer.

   Press subscriptions' browser session. A DEDICATED, PERSISTENT
   partition: its cookies survive restarts but never mix with the
   dashboard window's. login(url): a visible window where the user logs
   in themselves. fetchHtml(url): a HIDDEN window loads the article and
   returns the page's HTML -- a real browser, which anti-bot checks let
   through. The Electron user agent is stripped of "Electron/x.y" and
   the app name, leaving the embedded Chromium's own -- the same for
   login and reading.
   ============================================================ */
"use strict";

const { BrowserWindow, session } = require("electron");

const PARTITION = "persist:piboard-press";
const FETCH_TIMEOUT_MS = 30000;
// Laisse au site le temps d'inserer le texte par JavaScript apres le
// chargement (certains n'envoient le corps de l'article qu'ensuite).
// Gives the site time to insert the text via JavaScript after load.
const SETTLE_MS = 1500;

let loginWindow = null;

function pressSession() {
  return session.fromPartition(PARTITION);
}

function cleanUserAgent(ua) {
  return String(ua || "").replace(/\s(Electron|PiBoard|piboard)\/\S+/g, "");
}

function hostMatches(cookieDomain, domain) {
  const d = String(cookieDomain || "").replace(/^\./, "").toLowerCase();
  return d === domain || d.endsWith("." + domain);
}

function baseWebPreferences() {
  return {
    partition: PARTITION,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false
  };
}

/* Fenetre de connexion. Une seule a la fois : un second clic la remet
   au premier plan et la dirige vers le nouveau site.
   Login window, one at a time. */
function login(url, parent) {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.loadURL(url).catch(() => { /* redirection du site / site redirect */ });
    loginWindow.show();
    loginWindow.focus();
    return { ok: true };
  }
  loginWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "PiBoard — connexion / login",
    // Rattachee a la fenetre principale : elle reste visible au-dessus,
    // y compris en affichage immersif (plein ecran).
    // Attached to the main window: stays above it, even in immersive mode.
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences()
  });
  const wc = loginWindow.webContents;
  wc.setUserAgent(cleanUserAgent(wc.getUserAgent()));
  // Fenetres surgissantes de connexion (Google, Apple...) : ouvertes
  // dans la MEME partition, pour que la session qui en resulte soit
  // bien celle de PiBoard.
  // Login pop-ups (Google, Apple...): opened in the SAME partition.
  wc.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: baseWebPreferences() }
  }));
  loginWindow.on("closed", () => { loginWindow = null; });
  loginWindow.loadURL(url).catch(() => { /* redirection du site / site redirect */ });
  return { ok: true };
}

function loginOpen() {
  return !!(loginWindow && !loginWindow.isDestroyed());
}

/* Etat par site : nombre de cookies et date d'expiration la plus
   lointaine. PiBoard ne peut pas savoir s'ils representent une VRAIE
   connexion (un site pose des cookies a tout visiteur) ; l'interface
   dit donc « session enregistree », et c'est la lecture d'un article
   qui confirme ou non l'acces complet.
   Per-site state: cookie count and furthest expiry. PiBoard cannot tell
   whether they represent a REAL login; reading an article confirms. */
async function status(domains) {
  const all = await pressSession().cookies.get({});
  const out = {};
  for (const domain of domains || []) {
    const mine = all.filter((c) => hostMatches(c.domain, domain));
    const expiries = mine.map((c) => c.expirationDate).filter((x) => typeof x === "number");
    out[domain] = {
      cookies: mine.length,
      expires: expiries.length ? new Date(Math.max(...expiries) * 1000).toISOString() : null
    };
  }
  return { loginOpen: loginOpen(), sites: out };
}

/* Deconnexion : efface les cookies du site, et ceux-la seulement.
   Logout: deletes this site's cookies, and only those. */
async function logout(domain) {
  const ses = pressSession();
  const all = await ses.cookies.get({});
  let removed = 0;
  for (const c of all) {
    if (!hostMatches(c.domain, domain)) continue;
    const host = String(c.domain || "").replace(/^\./, "");
    const url = (c.secure ? "https://" : "http://") + host + (c.path || "/");
    try {
      await ses.cookies.remove(url, c.name);
      removed++;
    } catch (e) { /* cookie deja parti / already gone */ }
  }
  await ses.cookies.flushStore().catch(() => {});
  return { ok: true, removed };
}

/* Lecture d'un article dans une fenetre invisible. Une lecture a la
   fois : un tableau de bord n'ouvre qu'un article a la fois, et deux
   fenetres paralleles ne serviraient qu'a charger deux fois le site.
   Reads an article in a hidden window, one at a time. */
let queue = Promise.resolve();

function fetchHtml(url) {
  const run = () => new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: Object.assign(baseWebPreferences(), { backgroundThrottling: false })
    });
    const wc = win.webContents;
    wc.setUserAgent(cleanUserAgent(wc.getUserAgent()));
    wc.setAudioMuted(true);
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    let finished = false;
    const finish = (err, html) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!win.isDestroyed()) win.destroy();
      if (err) reject(err); else resolve(html);
    };
    const timer = setTimeout(() => finish(new Error("delai depasse / timeout")), FETCH_TIMEOUT_MS);
    wc.on("did-fail-load", (_e, code, desc, _url, isMainFrame) => {
      // -3 (ERR_ABORTED) : navigation remplacee par une autre (redirection
      // du site), pas un echec. -3: navigation superseded by another.
      if (code === -3 || isMainFrame === false) return;
      finish(new Error("chargement / load: " + code + " " + desc));
    });
    wc.once("did-finish-load", () => {
      setTimeout(() => {
        if (finished) return;
        wc.executeJavaScript("document.documentElement.outerHTML", true)
          .then((html) => finish(null, String(html || "")))
          .catch((e) => finish(e));
      }, SETTLE_MS);
    });
    win.loadURL(url).catch(() => { /* signale par did-fail-load / reported by did-fail-load */ });
  });
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

module.exports = { PARTITION, login, loginOpen, status, logout, fetchHtml, cleanUserAgent };
