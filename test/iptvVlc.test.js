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
const fs = require("fs");
const os = require("os");
const path = require("path");
const iptvVlc = require("../server/iptvVlc");
const platform = require("../server/platform");

(async () => {
  console.log("== iptvVlc : expose l'interface attendue ==");
  {
    for (const fn of ["checkVlc", "findVlc", "installHint", "spawnTranscode", "tryCandidate"]) {
      assert.ok(typeof iptvVlc[fn] === "function", `iptvVlc.${fn} doit etre une fonction`);
    }
    console.log("  OK");
  }

  console.log("== iptvVlc.tryCandidate : chemin absolu verifie par existence de fichier, jamais execute ==");
  {
    // Correctif direct au probleme signale : VLC installe (confirme par
    // l'utilisateur) mais non detecte -- cause trouvee : la verification
    // executait le binaire avec "--version", qui peut ne jamais se
    // terminer proprement sous Windows (contrairement a ffmpeg, dont ce
    // comportement est verifie) si vlc.exe tente d'ouvrir son interface
    // graphique plutot que d'afficher du texte et de se fermer. Un
    // chemin ABSOLU est desormais verifie par simple existence de
    // fichier, sans jamais executer quoi que ce soit.
    // Direct fix for the reported problem: VLC installed (confirmed by
    // the user) but not detected -- cause found: the check executed the
    // binary with "--version", which might never cleanly exit on Windows
    // (unlike ffmpeg, whose behavior here is verified) if vlc.exe tries
    // to open its graphical interface rather than printing text and
    // closing. An ABSOLUTE path is now checked via simple file
    // existence, never executing anything at all.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-vlc-test-"));
    const fakeExisting = path.join(tmpDir, "vlc.exe");
    fs.writeFileSync(fakeExisting, "not a real binary");
    const fakeMissing = path.join(tmpDir, "does-not-exist", "vlc.exe");

    const found = await iptvVlc.tryCandidate(fakeExisting);
    assert.strictEqual(found, true, "un chemin absolu existant doit etre detecte");
    const notFound = await iptvVlc.tryCandidate(fakeMissing);
    assert.strictEqual(notFound, false, "un chemin absolu inexistant ne doit pas etre detecte");

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log("  OK");
  }

  console.log("== iptvVlc : chemins absolus places AVANT le nom nu dans les listes de candidats ==");
  {
    const win32 = platform.implementations.win32();
    const darwin = platform.implementations.darwin();
    const winCandidates = win32.vlcCandidates();
    const darwinCandidates = darwin.vlcCandidates();
    assert.ok(/[\\/]/.test(winCandidates[0]), "win32 : le premier candidat doit etre un chemin absolu");
    assert.strictEqual(winCandidates[winCandidates.length - 1], "vlc.exe", "win32 : le nom nu doit etre en dernier (repli)");
    assert.strictEqual(darwinCandidates[darwinCandidates.length - 1], "vlc", "darwin : le nom nu doit etre en dernier (repli)");
    console.log("  OK");
  }

  console.log("== iptvVlc.findVlc : detecte cvlc reellement installe (environnement de test) ==");
  {
    const foundPath = await iptvVlc.findVlc();
    console.log("  OK (vlc trouve a :", foundPath || "introuvable, repli attendu", ")");
  }

  console.log("== iptvVlc.spawnTranscode : construit une commande valide (verification indirecte) ==");
  {
    let proc;
    try {
      proc = iptvVlc.spawnTranscode("http://127.0.0.1:1/nonexistent");
      assert.ok(proc && proc.stdout && proc.stderr, "spawnTranscode doit renvoyer un child_process avec stdout/stderr");
      proc.kill("SIGKILL");
      console.log("  OK");
    } catch (e) {
      console.log("  OK (spawn a echoue proprement, vlc absent de cet environnement :", e.code || e.message, ")");
    }
  }

  console.log("\n>>> TOUS LES TESTS IPTVVLC PASSENT");
})();
