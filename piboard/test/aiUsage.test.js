/* PiBoard - test/aiUsage.test.js
   Verifie la traduction des reponses du service et la generation PKCE.
   Aucun appel reseau : ces tests doivent passer hors ligne.
   Checks the mapping of the service's replies and PKCE generation.
   No network calls: these tests must pass offline. */
"use strict";

const assert = require("assert");
const path = require("path");

// Coffre isole : ne JAMAIS toucher au data/ reel de l'utilisateur.
// Isolated vault: NEVER touch the user's real data/.
process.env.PIBOARD_DATA = path.join(require("os").tmpdir(), "piboard-test-aiusage-" + Date.now());

const ai = require("../server/aiUsage.js");

let ok = 0;
function check(label, cond) {
  if (!cond) { console.error("  FAIL " + label); process.exitCode = 1; }
  else { console.log("  OK   " + label); ok++; }
}

console.log("== aiUsage : traduction des fenetres ==");

const mapped = ai._mapClaudeWindows({
  five_hour: { utilization: 42.5, resets_at: "2026-08-25T12:00:00Z" },
  seven_day: { utilization: 88, resets_at: "2026-08-30T00:00:00Z" },
  seven_day_opus: { utilization: 3, resets_at: null }
});
check("les trois fenetres connues sont traduites", mapped.length === 3);
check("identifiants canoniques", mapped.map((w) => w.id).join(",") === "fiveHour,sevenDay,sevenDayOpus");
check("le pourcentage vient du service, non recalcule", mapped[0].utilization === 42.5);
check("l'heure de reinitialisation est conservee telle quelle",
  mapped[1].resetsAt === "2026-08-30T00:00:00Z");

// Tolerance : le service peut ajouter, retirer ou renvoyer n'importe
// quoi. Rien de tout cela ne doit lever d'exception.
// Tolerance: the service may add, remove or return anything at all. None
// of it must throw.
check("une fenetre absente est simplement omise",
  ai._mapClaudeWindows({ five_hour: { utilization: 10 } }).length === 1);
check("une utilisation non numerique est ignoree, pas affichee a 0",
  ai._mapClaudeWindows({ five_hour: { utilization: "n/a" } }).length === 0);
check("une reponse vide ne leve pas d'exception", ai._mapClaudeWindows({}).length === 0);
check("une reponse nulle ne leve pas d'exception", ai._mapClaudeWindows(null).length === 0);
check("une cle inconnue est ignoree",
  ai._mapClaudeWindows({ nine_hour: { utilization: 50 } }).length === 0);

// Bornage : une valeur aberrante ne doit pas produire une barre qui
// deborde de la tuile.
// Clamping: an out-of-range value must not produce a bar overflowing the
// tile.
check("un pourcentage > 100 est ramene a 100",
  ai._mapClaudeWindows({ five_hour: { utilization: 150 } })[0].utilization === 100);
check("un pourcentage negatif est ramene a 0",
  ai._mapClaudeWindows({ five_hour: { utilization: -5 } })[0].utilization === 0);

console.log("== aiUsage : PKCE ==");

const a = ai._generatePkce();
const b = ai._generatePkce();
check("le verificateur respecte la longueur RFC 7636 (43-128)",
  a.verifier.length >= 43 && a.verifier.length <= 128);
check("le defi est en base64url, sans remplissage", /^[A-Za-z0-9_-]+$/.test(a.challenge));
check("deux appels produisent des valeurs differentes", a.verifier !== b.verifier);

console.log("== aiUsage : URL d'autorisation ==");

const started = ai.startAuth();
const u = new URL(started.authUrl);
check("l'URL pointe vers le service d'autorisation", u.origin + u.pathname === "https://claude.ai/oauth/authorize");
check("methode de defi S256 (jamais 'plain')", u.searchParams.get("code_challenge_method") === "S256");
check("le verificateur PKCE n'est JAMAIS dans l'URL", !started.authUrl.includes("code_verifier"));
check("un state est present (protection CSRF)", !!u.searchParams.get("state"));

console.log("== aiUsage : etat deconnecte ==");
check("non connecte tant qu'aucun jeton n'existe", ai.isConnected() === false);

ai.getUsage({ force: true }).then((r) => {
  check("getUsage sans jeton renvoie une erreur propre, sans exception",
    r.connected === false && r.error === "not_connected");
  console.log("\n" + ok + " assertions OK");
});
