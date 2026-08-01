/* ============================================================
   PiBoard - server/mailbox.js
   Lecture seule d'une boite aux lettres IMAP pour la tuile Courriel.

   Principe, identique a celui de la tuile Flux RSS : rien n'est stocke
   sur le PiBoard. Chaque affichage ouvre une connexion, lit ce dont il a
   besoin, et referme. Aucun message, aucun en-tete, aucune piece jointe
   n'est ecrit sur le disque -- seul l'identifiant de connexion vit dans
   le coffre chiffre (voir tileSecrets.js).

   Lecture STRICTEMENT seule : le drapeau "vu" n'est jamais pose (option
   IMAP `PEEK`), aucun message n'est deplace ni supprime. Consulter un
   courriel depuis le tableau ne doit pas le faire disparaitre des
   non-lus du telephone ou de l'ordinateur.

   Read-only access to an IMAP mailbox for the Mail tile.

   Principle, identical to the RSS feed tile's: nothing is stored on the
   PiBoard. Each display opens a connection, reads what it needs, and
   closes. No message, header or attachment is ever written to disk --
   only the login credential lives in the encrypted vault (see
   tileSecrets.js).

   STRICTLY read-only: the "seen" flag is never set (IMAP `PEEK`
   option), no message is moved or deleted. Reading a mail from the board
   must not make it vanish from the unread list on the phone or
   computer.
   ============================================================ */
"use strict";

const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const tileSecrets = require("./tileSecrets");

const CONNECT_TIMEOUT_MS = 15000;
const MAX_LIMIT = 25;

function clientFor(cfg, pass) {
  const port = Number(cfg.port) || 993;
  return new ImapFlow({
    host: String(cfg.host || "").trim(),
    port,
    // Le port 993 est chiffre de bout en bout (TLS implicite) ; le 143
    // demarre en clair puis passe en TLS via STARTTLS, ce qu'ImapFlow
    // fait automatiquement quand secure vaut false.
    // Port 993 is encrypted end to end (implicit TLS); port 143 starts
    // in the clear then upgrades via STARTTLS, which ImapFlow does
    // automatically when secure is false.
    secure: port === 993,
    auth: { user: String(cfg.user || "").trim(), pass },
    logger: false,
    // Sans cela, un serveur injoignable laisserait la requete pendre
    // jusqu'au delai du navigateur. Without this, an unreachable server
    // would leave the request hanging until the browser times out.
    socketTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    connectionTimeout: CONNECT_TIMEOUT_MS
  });
}

function requireConfig(tileId, cfg) {
  const pass = tileSecrets.get(tileId, "imapPassword");
  if (!cfg.host || !cfg.user) throw new Error("incomplete configuration");
  if (!pass) throw new Error("no password configured");
  return pass;
}

/* Liste les en-tetes des messages les plus recents. Ne recupere QUE
   l'enveloppe (objet, expediteur, date) et les drapeaux : le corps des
   messages n'est jamais telecharge ici, ce qui garde l'affichage de la
   tuile leger meme sur une grosse boite.
   Lists the most recent messages' headers. Fetches ONLY the envelope
   (subject, sender, date) and flags: message bodies are never
   downloaded here, which keeps the tile's display light even on a large
   mailbox. */
async function listHeaders(tileId, cfg) {
  const pass = requireConfig(tileId, cfg);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(cfg.limit) || 8));
  const folder = String(cfg.folder || "INBOX");
  const client = clientFor(cfg, pass);
  await client.connect();
  let lock;
  try {
    lock = await client.getMailboxLock(folder);
    const total = client.mailbox.exists;
    if (!total) return { messages: [], unseen: 0 };
    // Les `limit` derniers messages, du plus recent au plus ancien.
    // The last `limit` messages, newest first.
    const from = Math.max(1, total - limit + 1);
    const out = [];
    for await (const msg of client.fetch(`${from}:${total}`, { envelope: true, flags: true, uid: true })) {
      const env = msg.envelope || {};
      const sender = (env.from && env.from[0]) || {};
      out.push({
        uid: msg.uid,
        subject: env.subject || "",
        from: sender.name || sender.address || "",
        fromAddress: sender.address || "",
        date: env.date ? new Date(env.date).toISOString() : null,
        // `flags` est un Set cote ImapFlow / `flags` is a Set in ImapFlow
        seen: !!(msg.flags && msg.flags.has("\\Seen"))
      });
    }
    out.reverse(); // plus recent en premier / newest first
    const unseen = out.filter((m) => !m.seen).length;
    return { messages: out, unseen, total };
  } finally {
    if (lock) lock.release();
    try { await client.logout(); } catch (e) { /* deja ferme / already closed */ }
  }
}

/* Recupere un message complet et le convertit en HTML lisible. Le
   drapeau "vu" n'est deliberement PAS pose (voir l'en-tete du fichier).
   Fetches a full message and turns it into readable HTML. The "seen"
   flag is deliberately NOT set (see the file header). */
async function getMessage(tileId, cfg, uid) {
  const pass = requireConfig(tileId, cfg);
  const folder = String(cfg.folder || "INBOX");
  const client = clientFor(cfg, pass);
  await client.connect();
  let lock;
  try {
    lock = await client.getMailboxLock(folder);
    const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
    if (!msg || !msg.source) throw new Error("message not found");
    const parsed = await simpleParser(msg.source);
    // Les images integrees au message (logo, signature...) sont
    // referencees dans le HTML par "cid:xxx", un identifiant interne au
    // message -- jamais une URL joignable par le navigateur. mailparser
    // les livre a part, dans les pieces jointes portant un "cid". Sans
    // cette conversion en donnee integree (data URI), elles resteraient
    // cassees meme une fois les images distantes autorisees cote client.
    // Images embedded in the message (logo, signature...) are referenced
    // in the HTML by "cid:xxx", an id internal to the message -- never a
    // URL the browser can reach. mailparser delivers them separately, as
    // attachments carrying a "cid". Without this conversion into inline
    // data (a data URI), they'd stay broken even once remote images are
    // allowed client-side.
    let html = parsed.html || null;
    if (html) {
      for (const att of parsed.attachments || []) {
        if (!att.cid || !att.content) continue;
        const dataUri = `data:${att.contentType || "application/octet-stream"};base64,${att.content.toString("base64")}`;
        html = html.split(`cid:${att.cid}`).join(dataUri);
      }
    }
    return {
      subject: parsed.subject || "",
      from: parsed.from ? parsed.from.text : "",
      to: parsed.to ? parsed.to.text : "",
      date: parsed.date ? parsed.date.toISOString() : null,
      // Le HTML est desinfecte cote client, avec la meme fonction que la
      // tuile RSS -- un seul endroit a auditer plutot que deux.
      // The HTML is sanitized client-side, with the same function as the
      // RSS tile -- a single place to audit rather than two.
      html,
      text: parsed.text || "",
      attachments: (parsed.attachments || [])
        // Une image de signature integree n'est pas vraiment une "piece
        // jointe" du point de vue de l'utilisateur : deja affichee dans
        // le corps (ou remplacee par sa mention), elle ne doit pas
        // s'ajouter en double a la liste des pieces jointes.
        // An embedded signature image isn't really an "attachment" from
        // the user's point of view: already shown in the body (or
        // replaced by its placeholder), it shouldn't also be listed as
        // an attachment.
        .filter((a) => !a.cid)
        .map((a) => ({ filename: a.filename || "", size: a.size || 0 }))
    };
  } finally {
    if (lock) lock.release();
    try { await client.logout(); } catch (e) { /* deja ferme / already closed */ }
  }
}

module.exports = { listHeaders, getMessage };
