/* ============================================================
   PiBoard - server/pressAccess.js
   Abonnements presse : lire en entier, depuis la tuile Flux RSS, les
   articles d'un media auquel l'utilisateur est abonne.

   LE PRINCIPE, ET POURQUOI PAS UN IDENTIFIANT/MOT DE PASSE. Chaque
   media a son propre parcours de connexion (formulaire, jetons,
   captcha, double authentification, connexion Google/Apple) et
   plusieurs bloquent toute requete automatisee -- Le Monde repond
   402 « trafic identifie comme automatise » au mode lecture serveur.
   Un connecteur par media casserait a chaque refonte de site, et
   PiBoard n'a aucune raison de stocker des mots de passe.
   On reutilise donc une SESSION DE NAVIGATEUR : l'utilisateur se
   connecte lui-meme, une fois, dans une fenetre de navigateur integree
   a l'application de bureau ; PiBoard ne voit jamais le mot de passe,
   seulement les cookies que le site a choisi de poser. Les articles du
   site sont ensuite ouverts par une fenetre invisible de CE MEME
   navigateur, puis passes au mode lecture habituel.

   CE QUE CE N'EST PAS : un contournement. Sans abonnement, rien ne
   change -- seul ce que le site rend visible est affiche, comme avant.
   Avec un abonnement, PiBoard lit ce que le site montre a l'abonne,
   exactement comme son navigateur le ferait.

   PAR SITE, PAS PAR FLUX. Une session couvre tous les flux d'un meme
   site (Une, International, Economie...) et toutes les tuiles RSS.

   Ce module ne contient que des fonctions PURES (presets, rattachement
   d'une adresse a un site, signaux de paywall) et la persistance de la
   liste ; la session elle-meme vit dans le processus Electron (voir
   electron/main.js, controleur « press* »).

   Press subscriptions: read in full, from the RSS tile, the articles of
   a news site the user subscribes to. A BROWSER SESSION is reused: the
   user logs in once, themselves, in a browser window built into the
   desktop app; PiBoard never sees the password, only the cookies the
   site sets. The site's articles are then opened by a hidden window of
   that SAME browser and run through the usual reader mode. Not a
   bypass: without a subscription nothing changes. Per SITE, not per
   feed. This module only holds PURE functions and the list's
   persistence; the session lives in the Electron process.
   ============================================================ */
"use strict";

/* Medias proposes d'office. L'adresse de connexion n'est donnee que
   lorsqu'elle a ete verifiee (repond 200) ; sinon la page d'accueil,
   ou se trouve toujours un bouton « Se connecter ».
   Built-in presets. The login address is only given when it was
   checked (answers 200); otherwise the home page, which always has a
   "Log in" button. */
const PRESETS = [
  { domain: "lemonde.fr", name: "Le Monde", loginUrl: "https://secure.lemonde.fr/sfuser/connexion" },
  { domain: "lefigaro.fr", name: "Le Figaro", loginUrl: "https://connect.lefigaro.fr/login" },
  { domain: "liberation.fr", name: "Libération", loginUrl: "https://www.liberation.fr/" },
  { domain: "mediapart.fr", name: "Mediapart", loginUrl: "https://www.mediapart.fr/login" },
  { domain: "ladepeche.fr", name: "La Dépêche", loginUrl: "https://www.ladepeche.fr/" },
  { domain: "lequipe.fr", name: "L'Équipe", loginUrl: "https://www.lequipe.fr/" }
];

/* Normalise ce que l'utilisateur tape : « https://www.LeMonde.fr/une »
   comme « lemonde.fr » donnent « lemonde.fr ». Renvoie null si ce
   n'est pas un nom de domaine plausible.
   Normalises user input to a bare domain, or null. */
function normalizeDomain(input) {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z]+:\/\//.test(s)) s = "https://" + s;
  let host;
  try { host = new URL(s).hostname; } catch (e) { return null; }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return host;
}

/* Le site abonne auquel se rattache une adresse d'article :
   www.lemonde.fr, abonnes.lemonde.fr et lemonde.fr relevent tous de
   « lemonde.fr ». Jamais de correspondance par simple suffixe de
   chaine : « fauxlemonde.fr » ne doit PAS profiter de la session.
   The subscribed site an article address belongs to. Never a mere
   string-suffix match: "fakelemonde.fr" must NOT use the session. */
function accountForUrl(accounts, url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
  for (const a of accounts || []) {
    if (!a || !a.domain) continue;
    if (host === a.domain || host.endsWith("." + a.domain)) return a;
  }
  return null;
}

/* L'article est-il reserve aux abonnes ? Signal GENERIQUE : la donnee
   structuree schema.org « isAccessibleForFree », que les editeurs
   posent pour les moteurs de recherche (recommandation de Google pour
   les contenus payants). Verifie le 13 oct. 2026 sur Le Figaro,
   Mediapart (false) et La Depeche (true pour un article libre).
   Renvoie true (reserve), false (libre) ou null (non declare).
   Is the article subscriber-only? GENERIC signal: schema.org
   "isAccessibleForFree" structured data, set by publishers for search
   engines. Returns true (restricted), false (free) or null (unknown). */
function premiumFromHtml(html) {
  const text = String(html || "");
  const m = text.match(/"isAccessibleForFree"\s*:\s*"?(true|false)"?/i);
  if (!m) return null;
  return m[1].toLowerCase() === "false";
}

/* Phrases qu'un site place a la fin de l'apercu gratuit. Leur presence
   dans le texte EXTRAIT signifie que seul l'apercu a ete obtenu --
   avec une session, c'est le signe qu'elle a expire.
   Phrases a site puts at the end of the free preview. Their presence in
   the EXTRACTED text means only the preview was obtained -- with a
   session, a sign it has expired. */
const PAYWALL_TEXT_SIGNALS = [
  /il vous reste \d+\s?% de cet article/i,
  /article r[ée]serv[ée] aux abonn[ée]s/i,
  /la suite est r[ée]serv[ée]e aux abonn[ée]s/i,
  /pour lire la suite/i,
  /abonnez-vous pour lire/i,
  /d[ée]j[àa] abonn[ée]\s*\?\s*(se connecter|connectez-vous)/i,
  /this article is for subscribers/i,
  /subscribe to (continue|read)/i
];

/* Seule la FIN du texte est examinee : c'est la que se trouve la
   barriere, et un article peut tres bien parler d'« abonnes » ou
   ecrire « pour lire la suite » au fil du texte.
   Only the END of the text is examined: that's where the barrier sits,
   and an article may well mention "subscribers" in its body. */
const PAYWALL_TAIL_CHARS = 600;

function looksLikePaywallPreview(text) {
  const tail = String(text || "").trim().slice(-PAYWALL_TAIL_CHARS);
  return PAYWALL_TEXT_SIGNALS.some((re) => re.test(tail));
}

/* ---------- Persistance / persistence ---------- */
const STORE_KEY = "press";

function readAccounts(store) {
  const data = store.read(STORE_KEY, null);
  const list = data && Array.isArray(data.accounts) ? data.accounts : [];
  return list.filter((a) => a && normalizeDomain(a.domain) === a.domain);
}

function writeAccounts(store, accounts) {
  store.write(STORE_KEY, { accounts });
}

/* Ajoute un site, depuis un preset ou une saisie libre. Un site deja
   present n'est pas duplique.
   Adds a site, from a preset or free input; never duplicated. */
function addAccount(store, input) {
  const domain = normalizeDomain(input && input.domain);
  if (!domain) return { ok: false, reason: "invalid-domain" };
  const accounts = readAccounts(store);
  if (accounts.some((a) => a.domain === domain)) return { ok: true, accounts };
  const preset = PRESETS.find((p) => p.domain === domain);
  const name = String((input && input.name) || (preset && preset.name) || domain).slice(0, 60);
  let loginUrl = (preset && preset.loginUrl) || "https://www." + domain + "/";
  const custom = input && input.loginUrl ? String(input.loginUrl) : "";
  if (custom && /^https:\/\//i.test(custom) && accountForUrl([{ domain }], custom)) loginUrl = custom;
  accounts.push({ domain, name, loginUrl });
  writeAccounts(store, accounts);
  return { ok: true, accounts };
}

/* Memorise le resultat de la derniere lecture avec abonnement : c'est
   la seule preuve fiable que la session donne VRAIMENT acces aux
   articles payants (un site pose des cookies a tout visiteur, connecte
   ou non). Seuls les articles declares payants comptent : un article
   libre lu en entier ne prouve rien.
   Records the last subscriber read's outcome: the only reliable proof
   the session REALLY gives access to paid articles. Only articles
   declared paid count. */
function recordRead(store, domain, full) {
  const accounts = readAccounts(store);
  const a = accounts.find((x) => x.domain === domain);
  if (!a) return;
  a.lastRead = { full: !!full, at: new Date().toISOString() };
  writeAccounts(store, accounts);
}

function removeAccount(store, domain) {
  const accounts = readAccounts(store).filter((a) => a.domain !== domain);
  writeAccounts(store, accounts);
  return accounts;
}

module.exports = {
  PRESETS,
  normalizeDomain,
  accountForUrl,
  premiumFromHtml,
  looksLikePaywallPreview,
  readAccounts,
  addAccount,
  recordRead,
  removeAccount
};
