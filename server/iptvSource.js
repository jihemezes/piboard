/* ============================================================
   PiBoard - server/iptvSource.js
   Lecture du flux d'un fournisseur IPTV par PiBoard lui-meme.

   POURQUOI. Jusqu'en 1.113.0, ffmpeg allait chercher l'URL tout seul :
   les octets ne passaient jamais par PiBoard, qui ne pouvait donc pas en
   ecrire une copie pour l'enregistrement. Enregistrer supposait alors
   une SECONDE connexion chez le fournisseur -- inutilisable, puisqu'un
   abonnement IPTV n'autorise generalement qu'un seul flux simultane.
   PiBoard ouvre donc la connexion lui-meme, transmet les octets a ffmpeg
   pour le lecteur, et l'enregistrement se sert au passage.

   Reading the provider's stream in PiBoard itself. Until 1.113.0 ffmpeg
   fetched the URL on its own: the bytes never went through PiBoard,
   which therefore could not copy them for recording. Recording then
   required a SECOND connection -- unusable, since an IPTV subscription
   usually allows only one simultaneous stream.
   ============================================================ */

"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

/* Les plateformes IPTV servent souvent leurs flux a un lecteur reconnu
   et refusent un client inconnu. C'est l'entete que ffmpeg envoyait
   jusqu'ici, conserve tel quel.
   IPTV platforms often serve their streams to a recognised player and
   refuse an unknown client. This is the header ffmpeg used to send. */
const USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";
const MAX_REDIRECTS = 5;

function open(url, opts) {
  const o = opts || {};
  const redirects = o.redirects || 0;
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(new Error("url")); }
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.get(parsed, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      timeout: o.timeout || 20000
    }, (res) => {
      const code = res.statusCode || 0;
      /* Une redirection est la regle chez ces plateformes (repartition
         de charge) : elle est suivie, mais pas indefiniment.
         A redirect is the rule on these platforms; followed, but not
         indefinitely. */
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) return reject(new Error("trop de redirections / too many redirects"));
        const next = new URL(res.headers.location, parsed).href;
        return open(next, Object.assign({}, o, { redirects: redirects + 1 })).then(resolve, reject);
      }
      if (code < 200 || code >= 300) {
        res.resume();
        return reject(new Error("HTTP " + code));
      }
      /* Le delai ne vaut que pour l'ETABLISSEMENT : un direct dure des
         heures, et le laisser actif couperait la lecture.
         The timeout only covers CONNECTING: a live feed lasts hours. */
      req.setTimeout(0);
      resolve(res);
    });
    req.on("timeout", () => { req.destroy(new Error("delai depasse / timed out")); });
    req.on("error", (e) => reject(e));
  });
}

module.exports = { open, USER_AGENT };
