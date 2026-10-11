/* Test unitaire de server/webdav.js : parsing PROPFIND, filtrage images,
   resolution d'URL absolue, avec fetch simule. */
"use strict";
const assert = require("assert");
const { listWebdavImages, parsePropfindXml } = require("../server/webdav");

const NEXTCLOUD_STYLE_XML = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/jme/Photos/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/jme/Photos/vacances%20%C3%A9t%C3%A9.jpg</d:href>
    <d:propstat>
      <d:prop><d:resourcetype/><d:displayname>vacances ete.jpg</d:displayname></d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/jme/Photos/notes.txt</d:href>
    <d:propstat>
      <d:prop><d:resourcetype/></d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/jme/Photos/sous-dossier/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/jme/Photos/plage.PNG</d:href>
    <d:propstat>
      <d:prop><d:resourcetype/></d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

(async () => {
  console.log("== Parsing brut : filtre dossiers et fichiers non-image ==");
  const items = parsePropfindXml(NEXTCLOUD_STYLE_XML);
  assert.strictEqual(items.length, 2, "seules les 2 images doivent rester (pas les dossiers, pas notes.txt)");
  assert(items.some((i) => i.name === "vacances été.jpg"), "nom avec accents correctement decode");
  assert(items.some((i) => i.name === "plage.PNG"), "extension en majuscules acceptee");
  console.log("  OK parsing:", JSON.stringify(items));

  console.log("== listWebdavImages : requete PROPFIND correcte + URLs absolues ==");
  let capturedRequest = null;
  const fakeFetch = (url, opts) => {
    capturedRequest = { url, method: opts.method, headers: opts.headers };
    return Promise.resolve({ ok: true, status: 207, text: () => Promise.resolve(NEXTCLOUD_STYLE_XML) });
  };
  const result = await listWebdavImages("https://nas.local/remote.php/dav/files/jme/Photos", "jme", "secret", fakeFetch);
  assert.strictEqual(capturedRequest.method, "PROPFIND", "methode PROPFIND utilisee");
  assert.strictEqual(capturedRequest.headers.Depth, "1", "en-tete Depth: 1 present");
  assert(capturedRequest.headers.Authorization.startsWith("Basic "), "authentification Basic presente");
  assert(capturedRequest.url.endsWith("/"), "slash final ajoute a l'URL de base");
  assert.strictEqual(result.length, 2, "2 images retournees");
  const vacances = result.find((r) => r.name === "vacances été.jpg");
  assert(vacances.url.startsWith("https://nas.local/"), "URL absolue resolue correctement: " + vacances.url);
  console.log("  OK requete + resolution URL:", JSON.stringify(result));

  console.log("== Panne serveur : l'erreur remonte proprement ==");
  const failFetch = () => Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
  let threw = false;
  try {
    await listWebdavImages("https://nas.local/dav/Photos", "x", "y", failFetch);
  } catch (e) {
    threw = true;
  }
  assert(threw, "erreur 401 bien propagee");
  console.log("  OK erreur propagee");

  console.log("\n>>> TOUS LES TESTS WEBDAV PASSENT");
})().catch((e) => {
  console.error("ECHEC:", e);
  process.exit(1);
});
