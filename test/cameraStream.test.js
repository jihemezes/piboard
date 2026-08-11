"use strict";
/* ============================================================
   PiBoard - test/cameraStream.test.js
   Tests unitaires de la tuile Camera (voir server/cameraStream.js) :
   lecture RTSP a la demande (video live) et capture d'une image
   (snapshot), pour les cameras IP / portiers connectes compatibles
   ONVIF/RTSP (ex. Philips WelcomeEye Connect 3).

   Un vrai serveur RTSP n'est pas mis en place ici (tentative faite
   avec le muxer RTSP integre de ffmpeg -- "-rtsp_flags listen" --
   sans succes dans cet environnement de test : le bind semble
   bloque). Les tests portent donc sur ce qui est reellement testable
   sans reseau RTSP fonctionnel : la construction PURE des arguments
   ffmpeg (buildLiveArgs/buildFrameArgs), et le comportement d'echec
   propre face a une camera injoignable (meme principe que
   test/iptvVlc.test.js : "verification indirecte", spawn reussit,
   le processus se termine proprement).

   Unit tests for the Camera tile (see server/cameraStream.js):
   on-demand RTSP playback (live video) and single-frame capture
   (snapshot), for ONVIF/RTSP-compatible IP cameras / smart doorbells
   (e.g. Philips WelcomeEye Connect 3).

   No real RTSP server is set up here (attempted with ffmpeg's built-in
   RTSP muxer -- "-rtsp_flags listen" -- without success in this test
   environment: the bind appears blocked). Tests therefore cover what
   is actually testable without a working RTSP network: the PURE
   construction of ffmpeg arguments (buildLiveArgs/buildFrameArgs), and
   clean failure behavior against an unreachable camera (same principle
   as test/iptvVlc.test.js: "indirect verification", spawn succeeds,
   the process terminates cleanly).
   ============================================================ */
const assert = require("assert");
const cameraStream = require("../server/cameraStream");

(async () => {
  console.log("== cameraStream : expose l'interface attendue ==");
  {
    for (const fn of ["buildLiveArgs", "buildFrameArgs", "streamLive", "grabFrame"]) {
      assert.ok(typeof cameraStream[fn] === "function", `cameraStream.${fn} doit etre une fonction`);
    }
    console.log("  OK");
  }

  console.log("== buildLiveArgs : sans audio, TCP, delai borne, video en 'copy' par defaut ==");
  {
    const args = cameraStream.buildLiveArgs("rtsp://cam.local/stream1", {});
    assert.ok(args.includes("-an"), "doit desactiver l'audio (-an)");
    assert.ok(args.includes("-rtsp_transport") && args.includes("tcp"), "doit forcer le transport TCP");
    assert.ok(args.includes("-timeout"), "doit fixer un delai de connexion borne");
    assert.ok(args.includes("-i") && args.includes("rtsp://cam.local/stream1"), "doit utiliser l'URL fournie comme entree");
    const cIdx = args.indexOf("-c:v");
    assert.strictEqual(args[cIdx + 1], "copy", "video en 'copy' (remuxage) par defaut, pas de reencodage");
    assert.ok(args.includes("-movflags") && args.includes("frag_keyframe+empty_moov+faststart"),
      "doit produire du MP4 fragmente (lecture progressive <video src>)");
    console.log("  OK");
  }

  console.log("== buildLiveArgs : reencodage explicite quand transcode=true (camera H.265 par ex.) ==");
  {
    const args = cameraStream.buildLiveArgs("rtsp://cam.local/stream1", { transcode: true });
    const cIdx = args.indexOf("-c:v");
    assert.strictEqual(args[cIdx + 1], "libx264", "reencodage vers H.264 quand demande explicitement");
    assert.ok(args.includes("-an"), "reste sans audio meme en mode reencodage");
    console.log("  OK");
  }

  console.log("== buildFrameArgs : une seule image, format JPEG, meme fiabilite reseau que le direct ==");
  {
    const args = cameraStream.buildFrameArgs("rtsp://cam.local/stream1");
    assert.ok(args.includes("-frames:v") && args.includes("1"), "doit demander UNE seule image");
    assert.ok(args.includes("-f") && args.includes("image2"), "doit produire une image (pas un conteneur video)");
    assert.ok(args.includes("-rtsp_transport") && args.includes("tcp"), "meme fiabilite TCP que le direct");
    console.log("  OK");
  }

  console.log("== grabFrame : camera injoignable -> echec propre (pas de blocage indefini) ==");
  {
    const start = Date.now();
    // Port 1 : quasi certain de ne rien ecouter, echoue vite (RST/ICMP),
    // sans attendre le delai complet de 15s prevu pour une camera qui ne
    // repond jamais du tout.
    // Port 1: virtually guaranteed nothing listens there, fails fast
    // (RST/ICMP), without waiting for the full 15s timeout meant for a
    // camera that never responds at all.
    const result = await cameraStream.grabFrame("rtsp://127.0.0.1:1/nonexistent");
    const elapsedMs = Date.now() - start;
    assert.strictEqual(result.ok, false, "doit signaler l'echec, pas une image vide silencieuse");
    assert.ok(typeof result.error === "string" && result.error.length > 0, "doit fournir un message d'erreur exploitable");
    assert.ok(elapsedMs < 14000, "doit echouer rapidement sur un port ferme, pas attendre le timeout complet (" + elapsedMs + "ms)");
    console.log("  OK (echec en", elapsedMs, "ms :", result.error.slice(0, 80), ")");
  }

  console.log("== streamLive : construit une commande valide (verification indirecte, comme iptvVlc.spawnTranscode) ==");
  {
    const { PassThrough } = require("stream");
    const fakeRes = new PassThrough();
    const proc = cameraStream.streamLive("rtsp://127.0.0.1:1/nonexistent", fakeRes, {});
    assert.ok(proc && proc.stdout && proc.stderr, "streamLive doit renvoyer un child_process avec stdout/stderr");
    proc.kill("SIGKILL");
    console.log("  OK");
  }

  console.log("\n>>> TOUS LES TESTS CAMERASTREAM PASSENT");
})();
