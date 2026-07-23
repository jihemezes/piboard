/* Test unitaire de server/weatherPhoto.js avec un fetch simule */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const TMP_DATA = path.join(__dirname, "..", "tmp-test-data");
fs.rmSync(TMP_DATA, { recursive: true, force: true });
process.env.PIBOARD_DATA = TMP_DATA;

const { getWeatherPhoto } = require("../server/weatherPhoto");

let calls = 0;
function fakeFetch(url) {
  calls++;
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      results: [
        { url: "https://example.org/photo1.jpg", width: 1200, creator: "Jane Doe",
          creator_url: "https://example.org/jane", license: "by", foreign_landing_url: "https://example.org/p1" },
        { url: "https://example.org/photo2.jpg", width: 1200, creator: "John Roe",
          license: "cc0", foreign_landing_url: "https://example.org/p2" }
      ]
    })
  });
}

function failFetch() {
  return Promise.resolve({ ok: false, status: 503 });
}

(async () => {
  console.log("== Premier appel : interroge Openverse (fetch simule) ==");
  const p1 = await getWeatherPhoto("rain", fakeFetch);
  assert(calls === 1, "un appel reseau effectue");
  assert(p1.url.startsWith("https://example.org/photo"), "url de photo retournee");
  assert(p1.license === "BY" || p1.license === "CC0", "licence presente: " + p1.license);
  console.log("  OK premier appel:", JSON.stringify(p1));

  console.log("== Deuxieme appel meme condition : sert le cache, pas de nouvel appel ==");
  const p2 = await getWeatherPhoto("rain", fakeFetch);
  assert(calls === 1, "aucun appel reseau supplementaire (cache utilise)");
  assert(p2.url === p1.url, "meme photo retournee depuis le cache");
  console.log("  OK cache utilise, calls toujours =", calls);

  console.log("== Condition differente : nouvel appel reseau ==");
  const p3 = await getWeatherPhoto("sun", fakeFetch);
  assert(calls === 2, "un appel reseau pour la nouvelle condition");
  console.log("  OK nouvelle condition declenche un appel, calls =", calls);

  console.log("== Panne reseau avec cache perime : repli sur le cache ==");
  // Fabriquer artificiellement un cache perime pour 'rain'
  const store = require("../server/store");
  const stale = store.read("weatherphoto.rain", null);
  stale.cachedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 jours, > TTL 7 jours
  store.write("weatherphoto.rain", stale);
  const p4 = await getWeatherPhoto("rain", failFetch);
  assert(p4.url === p1.url, "photo perimee servie plutot que rien");
  console.log("  OK repli sur cache perime en cas de panne reseau");

  console.log("== Panne reseau SANS aucun cache : l'erreur remonte ==");
  let threw = false;
  try {
    await getWeatherPhoto("storm", failFetch);
  } catch (e) {
    threw = true;
  }
  assert(threw, "erreur bien propagee quand aucun repli n'existe");
  console.log("  OK erreur propagee sans cache disponible");

  console.log("== Requete de recherche modifiee entre-temps : cache invalide immediatement ==");
  // Simule le cas reel rencontre : un cache frais (< 7 jours) existe pour
  // 'rain', mais les termes de recherche ont ete affines depuis (comme
  // lors de la validation avec l'utilisateur) -> il doit etre ignore et
  // une nouvelle photo doit etre recherchee, meme si le cache n'est pas
  // perime au sens du TTL.
  const beforeCalls = calls;
  const currentEntry = store.read("weatherphoto.rain", null);
  currentEntry.query = "un ancien terme de recherche perime";
  currentEntry.cachedAt = Date.now(); // volontairement tout frais malgre tout
  store.write("weatherphoto.rain", currentEntry);
  const p5 = await getWeatherPhoto("rain", fakeFetch);
  assert(calls === beforeCalls + 1, "nouvel appel reseau declenche malgre un cache non perime");
  assert(p5.query !== "un ancien terme de recherche perime", "la nouvelle entree porte la requete a jour");
  console.log("  OK cache invalide automatiquement quand la requete de recherche change");

  fs.rmSync(TMP_DATA, { recursive: true, force: true });
  console.log("\n>>> TOUS LES TESTS UNITAIRES PASSENT");
})().catch((e) => {
  console.error("ECHEC:", e);
  fs.rmSync(TMP_DATA, { recursive: true, force: true });
  process.exit(1);
});
