"use strict";
/* ============================================================
   PiBoard - test/iptvHlsProxy.test.js
   Tests unitaires du relais HLS (voir server/iptvHlsProxy.js).
   Unit tests for the HLS relay (see server/iptvHlsProxy.js).
   ============================================================ */
const assert = require("assert");
const { rewriteM3u8, isPlaylist } = require("../server/iptvHlsProxy");

console.log("== isPlaylist : detection manifeste vs segment ==");
{
  assert.strictEqual(isPlaylist("https://x.test/live/9541.m3u8", ""), true);
  assert.strictEqual(isPlaylist("https://x.test/live/9541.m3u8?token=abc", ""), true, "parametres de requete ignores");
  assert.strictEqual(isPlaylist("https://x.test/seg.ts", "application/vnd.apple.mpegurl"), true, "type de contenu prioritaire sur l'extension");
  assert.strictEqual(isPlaylist("https://x.test/live/seg001.ts", ""), false);
  assert.strictEqual(isPlaylist("https://x.test/live/key.bin", ""), false);
  console.log("  OK");
}

console.log("== rewriteM3u8 : segments ordinaires reecrits vers le relais ==");
{
  const M3U8 = "#EXTM3U\n#EXTINF:10.0,\nsegment001.ts\n#EXTINF:10.0,\nsegment002.ts\n#EXT-X-ENDLIST";
  const out = rewriteM3u8(M3U8, "https://provider.test/live/user/pass/9541.m3u8", "/api/iptv/hls-proxy");
  assert.ok(out.includes("/api/iptv/hls-proxy?url=" + encodeURIComponent("https://provider.test/live/user/pass/segment001.ts")));
  assert.ok(out.includes("/api/iptv/hls-proxy?url=" + encodeURIComponent("https://provider.test/live/user/pass/segment002.ts")));
  assert.ok(out.includes("#EXTINF:10.0,"), "les lignes de metadonnees restent inchangees");
  assert.ok(out.includes("#EXT-X-ENDLIST"));
  console.log("  OK");
}

console.log("== rewriteM3u8 : cle de dechiffrement AES-128 (URI=\"...\") reecrite ==");
{
  const M3U8 = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1234\n#EXTINF:10.0,\nsegment001.ts';
  const out = rewriteM3u8(M3U8, "https://provider.test/live/user/pass/9541.m3u8", "/api/iptv/hls-proxy");
  assert.ok(out.includes('URI="/api/iptv/hls-proxy?url=' + encodeURIComponent("https://provider.test/live/user/pass/key.bin") + '"'));
  assert.ok(out.includes("IV=0x1234"), "le reste de la ligne EXT-X-KEY reste intact");
  console.log("  OK");
}

console.log("== rewriteM3u8 : manifeste maitre multi-debit (sous-playlists) ==");
{
  const MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\n720p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n480p/index.m3u8";
  const out = rewriteM3u8(MASTER, "https://provider.test/live/user/pass/9541.m3u8", "/api/iptv/hls-proxy");
  assert.ok(out.includes(encodeURIComponent("https://provider.test/live/user/pass/720p/index.m3u8")),
    "resolution relative correcte pour le sous-manifeste 720p");
  assert.ok(out.includes(encodeURIComponent("https://provider.test/live/user/pass/480p/index.m3u8")),
    "resolution relative correcte pour le sous-manifeste 480p");
  console.log("  OK");
}

console.log("== rewriteM3u8 : URL de segment deja absolue laissee telle quelle avant relais ==");
{
  const M3U8 = "#EXTM3U\n#EXTINF:10.0,\nhttps://cdn.autre-domaine.test/seg001.ts\n#EXT-X-ENDLIST";
  const out = rewriteM3u8(M3U8, "https://provider.test/live/9541.m3u8", "/api/iptv/hls-proxy");
  assert.ok(out.includes("/api/iptv/hls-proxy?url=" + encodeURIComponent("https://cdn.autre-domaine.test/seg001.ts")),
    "une URL absolue vers un AUTRE domaine (CDN) est aussi relayee, pas seulement les chemins relatifs");
  console.log("  OK");
}

console.log("\n>>> TOUS LES TESTS IPTVHLSPROXY PASSENT");
