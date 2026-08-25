/* ============================================================
   PiBoard - server/aiUsage.js
   Consommation des quotas des comptes IA (Claude, et d'autres a venir).

   ARCHITECTURE A FOURNISSEURS. Chaque fournisseur ne fait qu'une chose :
   renvoyer une liste de "fenetres" au format canonique

     { id, label, utilization, resetsAt }

   ou `utilization` est un pourcentage 0-100. Le widget ne connait donc
   AUCUN service : ajouter ChatGPT, Gemini ou Copilot plus tard ne
   touchera ni au widget, ni aux routes, ni au rendu -- seulement ce
   fichier. C'est aussi ce qui limite les degats si un point d'entree
   change : un fournisseur casse, les autres continuent.

   IMPORTANT -- ces points d'entree ne sont PAS documentes publiquement.
   Ils sont ceux qu'utilise le client officiel. Ils peuvent donc changer
   sans preavis. Tout le code ci-dessous est ecrit pour ECHOUER PROPREMENT
   dans ce cas (la tuile affiche "indisponible"), jamais pour planter.

   SECURITE. Les jetons vivent dans le coffre chiffre (tileSecrets), pas
   dans data/layout.json qui part dans les sauvegardes. Les routes ne
   renvoient JAMAIS de jeton, uniquement des pourcentages et des heures.
   Un jeton de rafraichissement Claude permet de generer de nouveaux
   jetons d'acces a distance : il est traite comme un mot de passe.

   Usage quotas for AI accounts (Claude, others to come).

   PROVIDER ARCHITECTURE. Each provider does one thing: return a list of
   "windows" in the canonical shape { id, label, utilization, resetsAt },
   where `utilization` is a 0-100 percentage. The widget therefore knows
   NO service: adding ChatGPT, Gemini or Copilot later touches neither
   the widget, nor the routes, nor the rendering -- only this file. It is
   also what limits the blast radius when an endpoint changes: one
   provider breaks, the others carry on.

   IMPORTANT -- these endpoints are NOT publicly documented. They are the
   ones the official client uses, and may change without notice. All the
   code below is written to FAIL CLEANLY in that case (the tile shows
   "unavailable"), never to crash.

   SECURITY. Tokens live in the encrypted vault (tileSecrets), not in
   data/layout.json which ends up in backups. The routes NEVER return a
   token, only percentages and times. A Claude refresh token can mint new
   access tokens remotely: it is treated as a password.
   ============================================================ */
"use strict";

const crypto = require("crypto");
const secrets = require("./tileSecrets");

/* ---------- Fournisseur Claude / Claude provider ---------- */

const CLAUDE = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e", // public / public
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://platform.claude.com/v1/oauth/token",
  usageUrl: "https://api.anthropic.com/api/oauth/usage",
  redirectUri: "http://localhost:18924/callback",
  scopes: "user:inference user:profile",
  beta: "oauth-2025-04-20",
  userAgent: "claude-code/2.0.32"
};

// Marge avant expiration : on rafraichit AVANT que le jeton soit mort,
// sinon la premiere requete de chaque cycle echouerait pour rien.
// Buffer before expiry: we refresh BEFORE the token dies, otherwise the
// first request of every cycle would fail for nothing.
const REFRESH_BUFFER_MS = 10 * 60 * 1000;

const HTTP_TIMEOUT_MS = 15000;

/* Le verificateur PKCE est genere a l'etape 1 (construction de l'URL) et
   n'est utilise qu'a l'etape 2 (echange du code). Il doit donc survivre
   entre deux requetes HTTP -- mais surtout PAS etre persiste : c'est un
   secret a usage unique et a duree de vie de quelques minutes. On le
   garde en memoire, avec expiration.
   The PKCE verifier is generated at step 1 (building the URL) and only
   used at step 2 (code exchange). It must therefore survive between two
   HTTP requests -- but must NOT be persisted: it is a single-use secret
   living for a few minutes. We keep it in memory, with expiry. */
const pendingAuth = new Map();
const PENDING_TTL_MS = 15 * 60 * 1000;

function prunePending() {
  const now = Date.now();
  for (const [k, v] of pendingAuth) if (now > v.expiresAt) pendingAuth.delete(k);
}

function generatePkce() {
  const verifier = base64url(crypto.randomBytes(64)).slice(0, 128);
  const challenge = base64url(crypto.createHash("sha256").update(verifier, "ascii").digest());
  return { verifier, challenge };
}

function base64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Petit fetch avec delai maximal. AbortSignal.timeout est disponible en
   Node 22 ; l'appelant doit toujours envelopper dans try/catch.
   Small fetch with a hard timeout. AbortSignal.timeout is available in
   Node 22; the caller must still wrap in try/catch. */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* reponse non JSON / non-JSON reply */ }
  return { ok: res.ok, status: res.status, json, text };
}

/* ---------- Etape 1 : URL d'autorisation / step 1: authorize URL ---------- */

function startAuth() {
  prunePending();
  const { verifier, challenge } = generatePkce();
  const state = base64url(crypto.randomBytes(32));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLAUDE.clientId,
    redirect_uri: CLAUDE.redirectUri,
    scope: CLAUDE.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  pendingAuth.set(state, { verifier, expiresAt: Date.now() + PENDING_TTL_MS });
  return { authUrl: CLAUDE.authorizeUrl + "?" + params.toString(), state };
}

/* ---------- Etape 2 : echange du code / step 2: code exchange ---------- */

/* Accepte l'URL de rappel COMPLETE collee par la personne. On extrait
   nous-memes le code : demander "colle seulement le code" serait une
   source d'erreur garantie, la barre d'adresse contenant aussi le state
   et parfois un fragment.
   Accepts the FULL callback URL pasted by the person. We extract the code
   ourselves: asking "paste only the code" would be a guaranteed source of
   mistakes, since the address bar also carries the state and sometimes a
   fragment. */
async function finishAuth(callbackUrl) {
  prunePending();
  const raw = String(callbackUrl || "").trim();
  if (!raw) throw new Error("empty_callback");

  let code = null;
  let state = null;
  try {
    const u = new URL(raw);
    code = u.searchParams.get("code");
    state = u.searchParams.get("state");
    // Certaines redirections renvoient "code#state" dans le fragment.
    // Some redirects return "code#state" in the fragment.
    if (!code && u.hash) {
      const parts = u.hash.replace(/^#/, "").split("#");
      if (parts[0]) code = parts[0];
      if (!state && parts[1]) state = parts[1];
    }
  } catch (e) {
    throw new Error("invalid_callback_url");
  }
  if (!code) throw new Error("no_code_in_url");

  const pending = state ? pendingAuth.get(state) : null;
  if (!pending) throw new Error("unknown_or_expired_state");
  pendingAuth.delete(state);

  const r = await postJson(CLAUDE.tokenUrl, {
    grant_type: "authorization_code",
    code,
    client_id: CLAUDE.clientId,
    redirect_uri: CLAUDE.redirectUri,
    code_verifier: pending.verifier,
    state
  });
  if (!r.ok || !r.json || !r.json.access_token) {
    throw new Error("token_exchange_failed_" + r.status);
  }
  saveCreds(fromTokenResponse(r.json, null));
  return true;
}

function fromTokenResponse(data, previous) {
  return {
    accessToken: data.access_token,
    // Anthropic fait tourner les jetons de rafraichissement : si un
    // nouveau arrive, il REMPLACE l'ancien, sinon l'ancien reste valable.
    // Anthropic rotates refresh tokens: if a new one arrives it REPLACES
    // the old one, otherwise the old one stays valid.
    refreshToken: data.refresh_token || (previous && previous.refreshToken) || null,
    expiresAt: Date.now() + (Number(data.expires_in) || 28800) * 1000
  };
}

/* ---------- Coffre / vault ----------
   On reutilise tileSecrets avec un identifiant de tuile reserve : les
   jetons sont ainsi chiffres au repos et absents de layout.json, sans
   inventer un second mecanisme de stockage.
   We reuse tileSecrets under a reserved tile id: tokens are therefore
   encrypted at rest and absent from layout.json, without inventing a
   second storage mechanism. */
const VAULT_TILE = "__aiusage_claude";

function loadCreds() {
  const raw = secrets.get(VAULT_TILE, "creds");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveCreds(creds) {
  secrets.set(VAULT_TILE, "creds", JSON.stringify(creds));
}

function disconnect() {
  secrets.clearTile(VAULT_TILE);
  pendingAuth.clear();
  cache = null;
  return true;
}

function isConnected() {
  return !!(loadCreds() || {}).refreshToken;
}

/* ---------- Rafraichissement / refresh ---------- */

async function refresh(creds) {
  if (!creds || !creds.refreshToken) return null;
  const r = await postJson(CLAUDE.tokenUrl, {
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: CLAUDE.clientId
  });
  if (!r.ok || !r.json || !r.json.access_token) return null;
  const next = fromTokenResponse(r.json, creds);
  saveCreds(next);
  return next;
}

function expired(creds) {
  return !creds || !creds.expiresAt || Date.now() >= (creds.expiresAt - REFRESH_BUFFER_MS);
}

/* ---------- Lecture de l'usage / usage fetch ---------- */

async function fetchUsage(accessToken) {
  const res = await fetch(CLAUDE.usageUrl, {
    headers: {
      "Authorization": "Bearer " + accessToken,
      "anthropic-beta": CLAUDE.beta,
      "User-Agent": CLAUDE.userAgent,
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  if (!res.ok) return { httpStatus: res.status, data: null };
  try { return { httpStatus: 200, data: await res.json() }; }
  catch (e) { return { httpStatus: 200, data: null }; }
}

/* Cache court. Le point d'entree n'a pas de quota documente ; plusieurs
   tuiles (ou plusieurs ecrans) peuvent interroger en parallele, et il
   serait absurde de multiplier les appels pour une donnee qui bouge a
   l'echelle de la minute.
   Short cache. The endpoint has no documented quota; several tiles (or
   several screens) may query in parallel, and multiplying calls for data
   that moves on a minute scale would be absurd. */
let cache = null;
const CACHE_MS = 60 * 1000;

/* Traduit la reponse brute vers le format canonique. Tolerant par
   construction : une fenetre absente est simplement omise plutot que de
   faire echouer l'ensemble, ce qui permet a la tuile de continuer a
   afficher ce qui reste si le service en ajoute ou en retire une.
   Maps the raw reply to the canonical shape. Tolerant by construction: a
   missing window is simply skipped rather than failing the whole thing,
   which lets the tile keep showing what remains if the service adds or
   removes one. */
function mapClaudeWindows(raw) {
  if (!raw || typeof raw !== "object") return [];
  const defs = [
    ["five_hour", "fiveHour"],
    ["seven_day", "sevenDay"],
    ["seven_day_opus", "sevenDayOpus"]
  ];
  const out = [];
  for (const [key, id] of defs) {
    const w = raw[key];
    if (!w || typeof w !== "object") continue;
    const u = Number(w.utilization);
    if (!Number.isFinite(u)) continue;
    out.push({
      id,
      // Le pourcentage vient du service : aucun seuil n'est devine ni
      // calibre par l'utilisateur. C'est ce qui rend la jauge honnete.
      // The percentage comes from the service: no threshold is guessed or
      // user-calibrated. That is what makes the gauge honest.
      utilization: Math.max(0, Math.min(100, u)),
      resetsAt: w.resets_at || null
    });
  }
  return out;
}

async function getUsage(opts) {
  const force = !!(opts && opts.force);
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let creds = loadCreds();
  if (!creds) return { connected: false, windows: [], error: "not_connected" };

  if (expired(creds)) {
    creds = await refresh(creds);
    if (!creds) return { connected: true, windows: [], error: "token_refresh_failed" };
  }

  let r = await fetchUsage(creds.accessToken);
  // 401 malgre une expiration apparemment lointaine : le jeton a pu etre
  // revoque cote serveur. On tente UNE fois un rafraichissement, sans
  // boucler -- une boucle sur un compte revoque martelerait le service.
  // 401 despite an apparently distant expiry: the token may have been
  // revoked server-side. We try ONE refresh, without looping -- looping on
  // a revoked account would hammer the service.
  if (r.httpStatus === 401) {
    creds = await refresh(creds);
    if (!creds) return { connected: true, windows: [], error: "unauthorized" };
    r = await fetchUsage(creds.accessToken);
  }
  if (r.httpStatus === 429) return { connected: true, windows: [], error: "rate_limited" };
  if (!r.data) return { connected: true, windows: [], error: "fetch_failed_" + r.httpStatus };

  const value = {
    connected: true,
    provider: "claude",
    windows: mapClaudeWindows(r.data),
    updatedAt: new Date().toISOString(),
    error: null
  };
  cache = { at: Date.now(), value };
  return value;
}

module.exports = {
  startAuth,
  finishAuth,
  disconnect,
  isConnected,
  getUsage,
  // exportes pour les tests / exported for tests
  _mapClaudeWindows: mapClaudeWindows,
  _generatePkce: generatePkce
};
