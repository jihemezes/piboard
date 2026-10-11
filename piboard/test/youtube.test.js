/* Tuile YouTube : reconnaissance des adresses, lecture du flux Atom,
   file collee. Rien ici ne touche au reseau -- le flux est un document
   de synthese -- ni au lecteur, qui vit dans le navigateur.
   YouTube tile: address recognition, Atom feed parsing, pasted queue.
   Nothing here touches the network -- the feed is a synthetic document
   -- nor the player, which lives in the browser. */
"use strict";
const assert = require("assert");
const { parseSource, parseFeed, parseQueue } = require("../server/youtube");

console.log("== Reconnaissance de ce qui a ete colle ==");
{
  const cases = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "video", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/abcdefghijk", "video", "abcdefghijk"],
    ["https://www.youtube-nocookie.com/embed/abcdefghijk", "video", "abcdefghijk"],
    ["dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", "playlist", "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"],
    // La playlist l'emporte sur la video qui l'accompagne.
    // The playlist wins over its accompanying video.
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", "playlist", "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"],
    ["https://www.youtube.com/channel/UCwI-JbGNsojunnHbFAc0M4Q", "channel", "UCwI-JbGNsojunnHbFAc0M4Q"],
    ["UCwI-JbGNsojunnHbFAc0M4Q", "channel", "UCwI-JbGNsojunnHbFAc0M4Q"],
    ["https://www.youtube.com/@ARTEfr", "handle", "@ARTEfr"],
    ["https://www.youtube.com/@ARTEfr/videos", "handle", "@ARTEfr"],
    ["@ARTEfr", "handle", "@ARTEfr"],
    ["https://www.youtube.com/user/ARTEfr", "handle", "@ARTEfr"]
  ];
  for (const [input, kind, id] of cases) {
    const out = parseSource(input);
    assert.ok(out, "reconnu : " + input);
    assert.strictEqual(out.kind, kind, input);
    assert.strictEqual(out.id, id, input);
  }
  for (const bad of ["", "https://example.com/watch?v=dQw4w9WgXcQ", "https://vimeo.com/123", "pas une adresse", "https://www.youtube.com/"]) {
    assert.strictEqual(parseSource(bad), null, "refuse : " + bad);
  }
  console.log("  OK   " + cases.length + " formes reconnues, les autres domaines refuses");
}

console.log("== Lecture du flux Atom d'une chaine ==");
{
  const xml = '<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">' +
    "<title>ARTE &amp; Co</title>" +
    "<entry><yt:videoId>abcdefghijk</yt:videoId><title>Premi&#39;ere &lt;vid&#233;o&gt;</title><author><name>ARTE</name></author><published>2026-09-01T10:00:00+00:00</published></entry>" +
    "<entry><yt:videoId>trop-court</yt:videoId><title>Ignoree</title></entry>" +
    "<entry><yt:videoId>zyxwvutsrqp</yt:videoId><title>Deuxieme</title><author><name>ARTE</name></author><published>2026-08-30T10:00:00+00:00</published></entry>" +
    "</feed>";
  const feed = parseFeed(xml);
  assert.strictEqual(feed.title, "ARTE & Co", "entites XML decodees dans le titre du flux");
  assert.strictEqual(feed.videos.length, 2, "une entree sans identifiant valide est ignoree");
  assert.strictEqual(feed.videos[0].id, "abcdefghijk");
  assert.ok(feed.videos[0].title.startsWith("Premi'ere <vid"), "guillemet et chevrons decodes");
  assert.strictEqual(feed.videos[0].author, "ARTE");
  assert.strictEqual(feed.videos[0].published, "2026-09-01T10:00:00+00:00");
  assert.strictEqual(feed.videos[0].thumbnail, "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg");
  assert.deepStrictEqual(parseFeed("").videos, [], "flux vide : liste vide, pas d'exception");
  console.log("  OK");
}

console.log("== File collee a la main ==");
{
  const q = parseQueue([
    "https://youtu.be/dQw4w9WgXcQ",
    "# en pause / paused",
    "abcdefghijk",
    "https://youtu.be/dQw4w9WgXcQ",              // doublon / duplicate
    "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", // pas une video / not a video
    "",
    "https://example.com"
  ].join("\n"));
  assert.deepStrictEqual(q.map((v) => v.id), ["dQw4w9WgXcQ", "abcdefghijk"],
    "commentaires, doublons, playlists et adresses etrangeres ecartes, ordre conserve");
  console.log("  OK");
}

console.log("Tous les tests YouTube sont passes.");
