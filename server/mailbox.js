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

// Charges A LA DEMANDE (voir clientFor/getMessage ci-dessous), pas ici :
// meme principe qu'articleExtract.js pour jsdom -- imapflow mesure a lui
// seul ~480ms de chargement, paye jusqu'ici a chaque demarrage du
// serveur meme sans aucune tuile Courriel configuree.
// Loaded ON DEMAND (see clientFor/getMessage below), not here: same
// principle as articleExtract.js for jsdom -- imapflow alone measures
// ~480ms to load, paid until now on every server startup even with no
// Mailbox tile configured.
let ImapFlow = null, simpleParser = null;
function loadMailDeps() {
  if (!ImapFlow) {
    ImapFlow = require("imapflow").ImapFlow;
    simpleParser = require("mailparser").simpleParser;
  }
}
const tileSecrets = require("./tileSecrets");

const CONNECT_TIMEOUT_MS = 15000;
// Delai d'inactivite SOCKET, distinct des delais d'etablissement : une
// grosse boite peut mettre plus de 15 s a renvoyer 25 enveloppes, ce qui
// declenchait un faux timeout en pleine lecture. Etablir la connexion,
// en revanche, doit rester rapide a echouer.
// SOCKET inactivity timeout, distinct from the connection ones: a large
// mailbox can take more than 15 s to return 25 envelopes, which was
// triggering a false timeout mid-read. Establishing the connection, on
// the other hand, must still fail fast.
const SOCKET_TIMEOUT_MS = 40000;
const MAX_LIMIT = 25;

function clientFor(cfg, pass) {
  loadMailDeps();
  const port = Number(cfg.port) || 993;
  const client = new ImapFlow({
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
    socketTimeout: SOCKET_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    connectionTimeout: CONNECT_TIMEOUT_MS
  });

  // INDISPENSABLE. ImapFlow etend EventEmitter, et Node relance en
  // `throw` tout evenement "error" emis sans auditeur. Or imapflow emet
  // cet evenement depuis emitError(), appelee par le gestionnaire du
  // timeout socket -- donc depuis un callback de minuterie, hors de
  // toute pile d'appel `async`. Le `try/catch` des routes /api/mail ne
  // pouvait structurellement pas l'attraper : l'erreur remontait en
  // uncaughtException et faisait apparaitre la boite "A JavaScript error
  // occurred in the main process" sous Electron (et tuait le serveur sur
  // le Pi). Le rejet de la promesse `await`ee, lui, etait deja gere.
  //
  // MANDATORY. ImapFlow extends EventEmitter, and Node rethrows any
  // "error" event emitted with no listener. imapflow emits it from
  // emitError(), called by the socket timeout handler -- that is, from a
  // timer callback, outside any `async` call stack. The /api/mail
  // routes' `try/catch` structurally could not catch it: the error
  // surfaced as an uncaughtException and raised the "A JavaScript error
  // occurred in the main process" dialog under Electron (and killed the
  // server on the Pi). The awaited promise rejection was already handled.
  client.on("error", (err) => {
    console.warn("[piboard] mail socket:", (err && (err.code || err.message)) || err);
  });

  return client;
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
    /* Deux comptes DIFFERENTS, et la nuance compte.
       `unseenShown` ne porte que sur les messages affiches (les `limit`
       derniers). `unseenTotal` porte sur TOUTE la boite : c'est celui
       qu'on veut annoncer, sans quoi une boite avec 80 non-lus en
       afficherait 25 -- le maximum affichable -- et laisserait croire
       qu'on a fait le tour.
       Two DIFFERENT counts, and the distinction matters. `unseenShown`
       covers only the displayed messages (the last `limit`).
       `unseenTotal` covers the WHOLE mailbox: that is the one worth
       announcing, otherwise a mailbox with 80 unread would show 25 --
       the display maximum -- and suggest you had seen them all. */
    const unseenShown = out.filter((m) => !m.seen).length;

    let unseenTotal = null;
    try {
      const st = await client.status(folder, { unseen: true });
      if (st && Number.isFinite(Number(st.unseen))) unseenTotal = Number(st.unseen);
    } catch (e) {
      // Certains serveurs refusent STATUS sur le dossier deja
      // selectionne. On laisse null plutot que d'annoncer un compte
      // partiel comme s'il etait complet.
      // Some servers refuse STATUS on the already-selected folder. We
      // leave null rather than announcing a partial count as a full one.
      unseenTotal = null;
    }

    return { messages: out, unseen: unseenShown, unseenTotal, total };
  } finally {
    if (lock) lock.release();
    // Un logout() sur une connexion deja tombee attend une reponse qui
    // ne viendra pas ; close() est immediat et sans effet si deja ferme.
    // A logout() on an already-dropped connection waits for a reply that
    // will never come; close() is immediate and a no-op if already shut.
    try { if (client.usable) await client.logout(); else client.close(); }
    catch (e) { /* deja ferme / already closed */ }
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
    // NB : mailparser convertit deja de lui-meme les images integrees
    // ("cid:xxx", logo, signature...) en donnees base64 directement dans
    // parsed.html -- verifie directement plutot que suppose. Rien a
    // faire ici pour elles ; parsed.attachments les liste quand meme,
    // avec un champ "cid", d'ou le filtre plus bas pour ne pas les
    // compter comme de vraies pieces jointes.
    // NB: mailparser already converts embedded images ("cid:xxx", logo,
    // signature...) into base64 data directly within parsed.html --
    // checked directly rather than assumed. Nothing to do here for them;
    // parsed.attachments still lists them, with a "cid" field, hence the
    // filter below so they aren't counted as genuine attachments.
    return {
      subject: parsed.subject || "",
      from: parsed.from ? parsed.from.text : "",
      to: parsed.to ? parsed.to.text : "",
      date: parsed.date ? parsed.date.toISOString() : null,
      // Le HTML est desinfecte cote client, avec la meme fonction que la
      // tuile RSS -- un seul endroit a auditer plutot que deux.
      // The HTML is sanitized client-side, with the same function as the
      // RSS tile -- a single place to audit rather than two.
      html: parsed.html || null,
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
    // Un logout() sur une connexion deja tombee attend une reponse qui
    // ne viendra pas ; close() est immediat et sans effet si deja ferme.
    // A logout() on an already-dropped connection waits for a reply that
    // will never come; close() is immediate and a no-op if already shut.
    try { if (client.usable) await client.logout(); else client.close(); }
    catch (e) { /* deja ferme / already closed */ }
  }
}

module.exports = { listHeaders, getMessage };
