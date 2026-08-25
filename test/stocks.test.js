/* PiBoard - test/stocks.test.js
   Analyse des reponses Stooq et traduction des symboles vers Yahoo.
   Aucun appel reseau. No network calls. */
"use strict";
const s = require("../server/stocks.js");
const c = require("../server/stocksCatalog.js");
let ok = 0;
function check(l, cond) {
  if (!cond) { console.error("  FAIL " + l); process.exitCode = 1; }
  else { console.log("  OK   " + l); ok++; }
}

const HEAD = "Symbol,Date,Time,Open,High,Low,Close,Volume";

console.log("== stooq : cotation ==");
const q = s._parseStooqQuote(HEAD + "\nAAPL.US,2026-08-25,22:00:00,230,232.5,229,231.75,4500000");
check("cours extrait de la colonne Close", q.price === 231.75);
check("variation calculee sur open->close", Math.abs(q.change - 0.7608) < 0.01);
check("date conservee", q.date === "2026-08-25");

console.log("== stooq : le piege du HTTP 200 ==");
// Stooq renvoie ses erreurs de quota DANS LE CORPS avec un statut 200 :
// un simple res.ok laisserait passer du texte d'erreur en guise de cours.
// Stooq returns quota errors IN THE BODY with a 200 status: a plain
// res.ok would let error text through as if it were a price.
check("message de quota depasse reconnu comme erreur",
  s._isStooqError("Exceeded the daily hits limit") === true);
check("reponse vide reconnue comme erreur", s._isStooqError("") === true);
check("un CSV valide n'est PAS pris pour une erreur", s._isStooqError(HEAD + "\nX,1,1,1,1,1,1,1") === false);
check("message de quota -> aucune cotation", s._parseStooqQuote("Exceeded the daily hits limit") === null);

console.log("== stooq : symbole inconnu ==");
// Stooq repond "N/D" partout plutot qu'une erreur : sans ce test, la
// tuile afficherait NaN.
// Stooq answers "N/D" everywhere rather than erroring: without this, the
// tile would show NaN.
check("ligne 'N/D' -> aucune cotation",
  s._parseStooqQuote(HEAD + "\nZZZZ,N/D,N/D,N/D,N/D,N/D,N/D,N/D") === null);
check("cours nul ou negatif rejete",
  s._parseStooqQuote(HEAD + "\nX,2026-01-01,10:00:00,0,0,0,0,0") === null);
check("CSV tronque -> null, sans exception", s._parseStooqQuote(HEAD) === null);

console.log("== stooq : historique ==");
const chart = s._parseStooqChart("Date,Open,High,Low,Close,Volume\n2026-01-01,1,1,1,10,5\n2026-01-02,1,1,1,12,5\n2026-01-03,1,1,1,11,5", 2);
check("seuls les N derniers points sont conserves", chart.length === 2);
check("les valeurs de cloture sont extraites", chart[1].value === 11);

console.log("== yahoo : traduction des symboles ==");
check("indice traduit vers sa graphie Yahoo", s._toYahooSymbol("^CAC") === "^FCHI");
check("suffixe .FR -> .PA", s._toYahooSymbol("MC.FR") === "MC.PA");
check("suffixe .US supprime", s._toYahooSymbol("AAPL.US") === "AAPL");
check("paire de change suffixee =X", s._toYahooSymbol("EURUSD") === "EURUSD=X");
// Mieux vaut PAS de repli qu'un repli sur le mauvais titre.
// No fallback beats a fallback on the wrong security.
check("indice inconnu -> null plutot qu'une traduction hasardeuse",
  s._toYahooSymbol("^INCONNU") === null);

console.log("== catalogue : devises ==");
check("devise connue lue dans le catalogue", c.currencyFor("MC.FR") === "EUR");
check("symbole affiche pour l'euro", c.symbolFor("EUR") === "\u20AC");
check("devise devinee pour une saisie libre", c.currencyFor("NESN.UK") === "GBP");
check("devise inconnue -> null, jamais une valeur inventee", c.currencyFor("ZZZ.XX") === null);
check("devise inconnue -> code ISO affiche tel quel", c.symbolFor("SEK") === "SEK");

console.log("== horaires de marche ==");
const at = (iso) => new Date(iso);
// Mardi 25/08/2026. 12:00 UTC = 14 h a Paris, 8 h a New York.
// Tuesday 2026-08-25. 12:00 UTC = 2pm in Paris, 8am in New York.
check("CAC ouvert un mardi a 14 h heure de Paris",
  c.isMarketOpen("^CAC", null, at("2026-08-25T12:00:00Z")) === true);
check("CAC ferme le meme mardi a 23 h heure de Paris",
  c.isMarketOpen("^CAC", null, at("2026-08-25T21:00:00Z")) === false);
check("CAC ferme le samedi", c.isMarketOpen("^CAC", null, at("2026-08-29T12:00:00Z")) === false);

// Le vrai test du fuseau : au meme instant, Paris est ouvert et New York
// ne l'est pas encore. Un decalage en dur se ferait prendre ici.
// The real time-zone test: at the same instant, Paris is open and New
// York is not yet. A hard-coded offset would be caught here.
check("S&P ferme quand il est 14 h a Paris (8 h a New York)",
  c.isMarketOpen("^SPX", null, at("2026-08-25T12:00:00Z")) === false);
check("S&P ouvert quand il est 14 h a New York",
  c.isMarketOpen("^SPX", null, at("2026-08-25T18:00:00Z")) === true);
check("Nikkei ouvert quand il est 2 h du matin a Paris",
  c.isMarketOpen("^NKX", null, at("2026-08-25T00:30:00Z")) === true);

check("le change est ouvert en semaine",
  c.isMarketOpen("EURUSD", null, at("2026-08-25T12:00:00Z")) === true);
// Le change n'est PAS 24/7 comme les cryptos : le week-end il ferme.
// FX is NOT 24/7 like crypto: it closes at the weekend.
check("le change est ferme le samedi",
  c.isMarketOpen("EURUSD", null, at("2026-08-29T12:00:00Z")) === false);

// Horaires inconnus -> null, pour n'afficher AUCUN indicateur plutot
// qu'un "ferme" faux.
// Unknown hours -> null, so NO indicator is shown rather than a wrong
// "closed".
check("symbole exotique -> null, jamais un 'ferme' invente",
  c.isMarketOpen("ZZZ.XX", null, at("2026-08-25T12:00:00Z")) === null);
check("saisie libre .UK rattachee a Londres",
  c.isMarketOpen("XYZ.UK", null, at("2026-08-25T12:00:00Z")) === true);

console.log("\n" + ok + " assertions OK");
