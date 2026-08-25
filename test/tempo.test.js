/* PiBoard - test/tempo.test.js
   Traduction des reponses de api-couleur-tempo.fr. Aucun appel reseau.
   Mapping of api-couleur-tempo.fr replies. No network calls. */
"use strict";
const t = require("../server/tempo.js");
let ok = 0;
function check(label, cond) {
  if (!cond) { console.error("  FAIL " + label); process.exitCode = 1; }
  else { console.log("  OK   " + label); ok++; }
}

console.log("== tempo : codes couleur ==");
// Forme reelle verifiee en direct sur l'API le 25/08/2026 :
// {"dateJour":"2026-08-25","codeJour":1,"periode":"2025-2026","libCouleur":"Bleu"}
// Real shape verified live against the API on 2026-08-25.
const day = t._mapDay({ dateJour: "2026-08-25", codeJour: 1, periode: "2025-2026", libCouleur: "Bleu" });
check("codeJour 1 -> bleu", day.color === "blue");
check("la date est conservee", day.date === "2026-08-25");
check("le libelle de l'API est conserve pour diagnostic", day.label === "Bleu");
check("codeJour 2 -> blanc", t._mapDay({ codeJour: 2 }).color === "white");
check("codeJour 3 -> rouge", t._mapDay({ codeJour: 3 }).color === "red");

// Le 0 est un ETAT NORMAL (couleur du lendemain pas encore publiee par
// RTE avant ~11 h), pas une erreur : il doit se traduire proprement.
// 0 is a NORMAL STATE (tomorrow's colour not yet published by RTE before
// ~11am), not an error: it must map cleanly.
check("codeJour 0 -> inconnu (etat normal avant 11 h)", t._mapDay({ codeJour: 0 }).color === "unknown");
check("codeJour absent -> inconnu, sans exception", t._mapDay({}).color === "unknown");
check("codeJour aberrant -> inconnu", t._mapDay({ codeJour: 9 }).color === "unknown");
check("reponse nulle -> null, sans exception", t._mapDay(null) === null);

console.log("== tempo : jours restants ==");
check("graphie principale reconnue",
  t._mapStats({ bleuRestants: 200, blancRestants: 12, rougeRestants: 3 }).red === 3);
check("graphie alternative reconnue",
  t._mapStats({ joursRougeRestants: 5 }).red === 5);
check("objet imbrique sous 'stats' reconnu",
  t._mapStats({ stats: { rougeRestants: 7 } }).red === 7);
// Point important : si AUCUN champ n'est reconnu, on renvoie null pour
// que le widget masque la ligne -- surtout pas des zeros, qui feraient
// croire a tort qu'il ne reste plus aucun jour rouge.
// Important: if NO field is recognised we return null so the widget hides
// the row -- definitely not zeros, which would wrongly suggest no red
// days are left.
check("aucun champ reconnu -> null (jamais zero)", t._mapStats({ inconnu: 1 }) === null);
check("reponse nulle -> null", t._mapStats(null) === null);
check("un champ manquant reste null sans annuler les autres",
  t._mapStats({ rougeRestants: 4 }).blue === null);

console.log("\n" + ok + " assertions OK");
