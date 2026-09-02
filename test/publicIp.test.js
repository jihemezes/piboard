/* PiBoard - test/publicIp.test.js
   Adresse IP publique (server/publicIp.js) : analyse des reponses (texte
   ou JSON), enchainement des services de repli, cache et conservation
   de la derniere adresse connue apres un echec. Aucun appel reseau : un
   faux fetch rejoue les reponses.

   Public IP address (server/publicIp.js): answer parsing (text or JSON),
   fallback chaining across services, cache and retention of the last
   known address after a failure. No network call: a fake fetch replays
   the answers. */
"use strict";
const { createPublicIpLookup, parseIpResponse } = require("../server/publicIp");
let ok = 0;
function check(label, cond) {
  if (!cond) { console.error("  FAIL " + label); process.exitCode = 1; }
  else { console.log("  OK   " + label); ok++; }
}

console.log("== analyse des reponses ==");
check("texte brut avec retour ligne", parseIpResponse("82.66.10.5\n") === "82.66.10.5");
check("JSON ipify", parseIpResponse('{"ip":"82.66.10.5"}') === "82.66.10.5");
check("page HTML (service en erreur) -> null", parseIpResponse("<html>oops</html>") === null);
check("IPv6 -> null (on ne veut que l'IPv4 publique)", parseIpResponse("2a01:e0a::1") === null);
check("vide -> null", parseIpResponse("") === null && parseIpResponse(null) === null);
check("JSON invalide -> null", parseIpResponse("{ip:") === null);

function fakeFetch(script) {
  const calls = [];
  const f = async (url) => {
    calls.push(url);
    const step = script[url];
    if (!step) throw new Error("no route " + url);
    if (step instanceof Error) throw step;
    return { ok: step.status ? step.status < 400 : true, status: step.status || 200, text: async () => step.body };
  };
  f.calls = calls;
  return f;
}

(async () => {
  console.log("== premier service qui repond gagne ==");
  {
    let t = 1000;
    const f = fakeFetch({ "a": { body: '{"ip":"1.2.3.4"}' }, "b": { body: "9.9.9.9" } });
    const l = createPublicIpLookup({ services: ["a", "b"], fetchImpl: f, now: () => t });
    const r = await l.lookup();
    check("adresse du premier service", r.ip === "1.2.3.4" && r.stale === false && r.error === null);
    check("second service jamais appele", f.calls.length === 1);
    await l.lookup();
    check("cache : pas de second appel dans les dix minutes", f.calls.length === 1);
    t += 11 * 60 * 1000;
    await l.lookup();
    check("cache expire : nouvel appel", f.calls.length === 2);
    await l.lookup(true);
    check("refresh force : appel meme si le cache est frais", f.calls.length === 3);
  }

  console.log("== repli sur le service suivant ==");
  {
    const f = fakeFetch({ "a": new Error("timeout"), "b": { status: 503, body: "" }, "c": { body: "5.6.7.8\n" } });
    const l = createPublicIpLookup({ services: ["a", "b", "c"], fetchImpl: f });
    const r = await l.lookup();
    check("troisieme service utilise apres deux echecs", r.ip === "5.6.7.8" && f.calls.length === 3);
  }

  console.log("== echec total : derniere adresse conservee et signalee perimee ==");
  {
    let t = 0;
    const script = { "a": { body: "5.6.7.8" } };
    const f = fakeFetch(script);
    const l = createPublicIpLookup({ services: ["a"], fetchImpl: f, now: () => t });
    await l.lookup();
    script.a = new Error("down");
    t += 20 * 60 * 1000;
    const r = await l.lookup();
    check("adresse precedente encore renvoyee", r.ip === "5.6.7.8");
    check("marquee perimee, avec la cause", r.stale === true && /down/.test(r.error));
    const l2 = createPublicIpLookup({ services: ["a"], fetchImpl: f });
    const r2 = await l2.lookup();
    check("jamais resolue : ip nulle, erreur presente, sans exception", r2.ip === null && !!r2.error);
  }

  console.log(`\n${ok} verifications OK${process.exitCode ? " -- ECHECS" : ""}`);
})();
