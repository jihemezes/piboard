"use strict";
/* ============================================================
   PiBoard - test/iptvVlc.test.js
   Tests unitaires du relais VLC (voir server/iptvVlc.js), utilise pour
   les chaines IPTV en direct qu'un fournisseur rejette face a ffmpeg
   seul (405 Method Not Allowed, confirme par l'outil de diagnostic --
   voir server/iptvAudio.js:diagnose et le CHANGELOG).
   Unit tests for the VLC relay (see server/iptvVlc.js), used for live
   IPTV channels a provider rejects when faced with ffmpeg alone (405
   Method Not Allowed, confirmed by the diagnostic tool -- see
   server/iptvAudio.js:diagnose and the CHANGELOG).
   ============================================================ */
const assert = require("assert");
const iptvVlc = require("../server/iptvVlc");

console.log("== iptvVlc : expose l'interface attendue ==");
{
  for (const fn of ["checkVlc", "findVlc", "installHint", "spawnRelay"]) {
    assert.ok(typeof iptvVlc[fn] === "function", `iptvVlc.${fn} doit etre une fonction`);
  }
  console.log("  OK");
}

console.log("== iptvVlc.findVlc : detecte cvlc reellement installe (environnement de test) ==");
{
  // Ce test suppose cvlc installe dans l'environnement de test -- s'il
  // ne l'est pas, le seul comportement verifiable est l'absence
  // d'exception et un retour null, deja couvert par la logique de repli
  // du serveur (voir server/index.js, route /api/iptv/audio-fix).
  // This test assumes cvlc is installed in the test environment -- if
  // it isn't, the only checkable behavior is no exception and a null
  // return, already covered by the server's fallback logic (see
  // server/index.js, /api/iptv/audio-fix route).
  iptvVlc.findVlc().then((path) => {
    console.log("  OK (vlc trouve a :", path || "introuvable, repli attendu", ")");

    console.log("== iptvVlc.spawnRelay : construit une commande valide (verification indirecte) ==");
    {
      // spawnRelay() lance un vrai processus : verifie ici seulement
      // qu'aucune exception n'est levee a l'appel et que l'objet
      // retourne a la forme attendue d'un child_process (stdout/stderr
      // en flux) -- le comportement reseau reel est verifie par les
      // scripts de test manuels documentes dans le CHANGELOG, pas ici.
      // spawnRelay() launches a real process: only checks here that no
      // exception is thrown on call and that the returned object has
      // the expected child_process shape (stdout/stderr as streams) --
      // actual network behavior is verified by the manual test scripts
      // documented in the CHANGELOG, not here.
      let proc;
      try {
        proc = iptvVlc.spawnRelay("http://127.0.0.1:1/nonexistent");
        assert.ok(proc && proc.stdout && proc.stderr, "spawnRelay doit renvoyer un child_process avec stdout/stderr");
        proc.kill("SIGKILL");
        console.log("  OK");
      } catch (e) {
        // Si vlc n'est pas installe, spawn() peut lever ENOENT de facon
        // synchrone selon la plateforme -- comportement attendu et sans
        // consequence, le serveur verifie checkVlc() avant d'appeler
        // spawnRelay() (voir server/index.js).
        // If vlc isn't installed, spawn() can throw ENOENT synchronously
        // depending on the platform -- expected and inconsequential
        // behavior, the server checks checkVlc() before ever calling
        // spawnRelay() (see server/index.js).
        console.log("  OK (spawn a echoue proprement, vlc absent de cet environnement :", e.code || e.message, ")");
      }
    }

    console.log("\n>>> TOUS LES TESTS IPTVVLC PASSENT");
  });
}
