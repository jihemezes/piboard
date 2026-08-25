/* ============================================================
   PiBoard - server/stocksCatalog.js
   Catalogue CURE des places et instruments proposes dans les listes
   deroulantes de la tuile Bourse.

   POURQUOI UN CATALOGUE CURE plutot que la liste complete : la source
   couvre plus de 21 000 titres et ETF. Un menu deroulant de cette taille
   serait inutilisable, surtout au doigt sur un ecran tactile. On propose
   donc une selection courte et pertinente par place, TOUJOURS assortie
   d'une entree "Autre..." qui ouvre un champ de saisie libre : le
   confort du menu pour les cas courants, aucun mur pour le reste.

   Les symboles suivent la convention de Stooq : suffixe de place
   (.US, .DE, .UK, .JP...), les indices commencent par ^, les paires de
   change s'ecrivent en 6 lettres (EURUSD). Sans suffixe, Stooq suppose
   la Bourse de Varsovie -- d'ou le suffixe explicite partout.

   CURATED catalog of the exchanges and instruments offered in the Stocks
   tile's dropdowns.

   WHY A CURATED CATALOG rather than the full list: the source covers more
   than 21,000 stocks and ETFs. A dropdown that size would be unusable,
   especially with a finger on a touchscreen. So we offer a short,
   relevant selection per exchange, ALWAYS paired with an "Other..." entry
   opening a free-text field: the comfort of a menu for common cases, no
   wall for the rest.

   Symbols follow Stooq's convention: exchange suffix (.US, .DE, .UK,
   .JP...), indices start with ^, FX pairs are written as 6 letters
   (EURUSD). With no suffix Stooq assumes the Warsaw exchange -- hence the
   explicit suffix everywhere.
   ============================================================ */
"use strict";

/* `currency` est porte par l'INSTRUMENT et non par la place : une place
   peut coter en plusieurs devises, et surtout un indice n'a pas vraiment
   de devise. Il sert uniquement a choisir le symbole affiche a cote du
   cours -- on n'effectue AUCUNE conversion (convertir un indice n'aurait
   aucun sens).
   `currency` belongs to the INSTRUMENT, not the exchange: an exchange may
   quote in several currencies, and an index has no real currency anyway.
   It only picks the symbol shown next to the price -- we perform NO
   conversion (converting an index would be meaningless). */

const EXCHANGES = [
  {
    id: "indices",
    label: { fr: "Indices mondiaux", en: "World indices" },
    instruments: [
      { symbol: "^CAC", label: "CAC 40", currency: "EUR" },
      { symbol: "^SPX", label: "S&P 500", currency: "USD" },
      { symbol: "^NDQ", label: "Nasdaq Composite", currency: "USD" },
      { symbol: "^DJI", label: "Dow Jones", currency: "USD" },
      { symbol: "^DAX", label: "DAX", currency: "EUR" },
      { symbol: "^FTM", label: "FTSE 100", currency: "GBP" },
      { symbol: "^NKX", label: "Nikkei 225", currency: "JPY" },
      { symbol: "^STOXX50E", label: "Euro Stoxx 50", currency: "EUR" },
      { symbol: "^SMI", label: "SMI (Suisse)", currency: "CHF" },
      { symbol: "^HSI", label: "Hang Seng", currency: "HKD" }
    ]
  },
  {
    id: "paris",
    label: { fr: "Euronext Paris", en: "Euronext Paris" },
    instruments: [
      { symbol: "AI.FR", label: "Air Liquide", currency: "EUR" },
      { symbol: "AIR.FR", label: "Airbus", currency: "EUR" },
      { symbol: "BNP.FR", label: "BNP Paribas", currency: "EUR" },
      { symbol: "MC.FR", label: "LVMH", currency: "EUR" },
      { symbol: "OR.FR", label: "L'Oréal", currency: "EUR" },
      { symbol: "SAN.FR", label: "Sanofi", currency: "EUR" },
      { symbol: "SU.FR", label: "Schneider Electric", currency: "EUR" },
      { symbol: "TTE.FR", label: "TotalEnergies", currency: "EUR" }
    ]
  },
  {
    id: "us",
    label: { fr: "NYSE / Nasdaq", en: "NYSE / Nasdaq" },
    instruments: [
      { symbol: "AAPL.US", label: "Apple", currency: "USD" },
      { symbol: "MSFT.US", label: "Microsoft", currency: "USD" },
      { symbol: "GOOGL.US", label: "Alphabet", currency: "USD" },
      { symbol: "AMZN.US", label: "Amazon", currency: "USD" },
      { symbol: "NVDA.US", label: "NVIDIA", currency: "USD" },
      { symbol: "META.US", label: "Meta", currency: "USD" },
      { symbol: "TSLA.US", label: "Tesla", currency: "USD" }
    ]
  },
  {
    id: "xetra",
    label: { fr: "Xetra (Francfort)", en: "Xetra (Frankfurt)" },
    instruments: [
      { symbol: "BMW.DE", label: "BMW", currency: "EUR" },
      { symbol: "SAP.DE", label: "SAP", currency: "EUR" },
      { symbol: "SIE.DE", label: "Siemens", currency: "EUR" },
      { symbol: "ALV.DE", label: "Allianz", currency: "EUR" }
    ]
  },
  {
    id: "lse",
    label: { fr: "London Stock Exchange", en: "London Stock Exchange" },
    instruments: [
      { symbol: "SHEL.UK", label: "Shell", currency: "GBP" },
      { symbol: "HSBA.UK", label: "HSBC", currency: "GBP" },
      { symbol: "VOD.UK", label: "Vodafone", currency: "GBP" }
    ]
  },
  {
    id: "fx",
    label: { fr: "Change (devises)", en: "Foreign exchange" },
    instruments: [
      { symbol: "EURUSD", label: "EUR / USD", currency: "USD" },
      { symbol: "EURGBP", label: "EUR / GBP", currency: "GBP" },
      { symbol: "EURCHF", label: "EUR / CHF", currency: "CHF" },
      { symbol: "USDJPY", label: "USD / JPY", currency: "JPY" },
      { symbol: "EURJPY", label: "EUR / JPY", currency: "JPY" }
    ]
  },
  {
    id: "commodities",
    label: { fr: "Matières premières", en: "Commodities" },
    instruments: [
      { symbol: "XAUUSD", label: { fr: "Or (once)", en: "Gold (ounce)" }, currency: "USD" },
      { symbol: "XAGUSD", label: { fr: "Argent (once)", en: "Silver (ounce)" }, currency: "USD" },
      { symbol: "CL.F", label: { fr: "Pétrole WTI", en: "WTI crude" }, currency: "USD" },
      { symbol: "GC.F", label: { fr: "Or (contrat)", en: "Gold (futures)" }, currency: "USD" }
    ]
  }
];

/* Symboles de devise pour l'affichage. Volontairement minimal : un
   symbole inconnu retombe sur le code ISO, ce qui reste lisible.
   Currency symbols for display. Deliberately minimal: an unknown symbol
   falls back to the ISO code, which stays readable. */
const CURRENCY_SYMBOLS = {
  EUR: "€", USD: "$", GBP: "£", JPY: "¥", CHF: "CHF", HKD: "HK$", PLN: "zł"
};

/* Devise devinee a partir du seul symbole, pour les saisies libres
   ("Autre..."). Approximatif par nature -- on prefere une devise
   plausible a aucune, et l'aide previent que la saisie libre ne devine
   pas toujours juste.
   Currency guessed from the symbol alone, for free-text entries
   ("Other..."). Approximate by nature -- a plausible currency beats none,
   and the help warns that free entry does not always guess right. */
function guessCurrency(symbol) {
  const s = String(symbol || "").toUpperCase().trim();
  if (/^[A-Z]{3}(USD|EUR|GBP|JPY|CHF)$/.test(s)) return s.slice(3);
  if (s.endsWith(".US") || s.endsWith(".F")) return "USD";
  if (s.endsWith(".DE") || s.endsWith(".FR") || s.endsWith(".NL") || s.endsWith(".BE")) return "EUR";
  if (s.endsWith(".UK")) return "GBP";
  if (s.endsWith(".JP")) return "JPY";
  if (s.endsWith(".HK")) return "HKD";
  return null;
}

function findInstrument(symbol) {
  const s = String(symbol || "").toUpperCase().trim();
  for (const ex of EXCHANGES) {
    for (const it of ex.instruments) {
      if (it.symbol.toUpperCase() === s) return { exchange: ex.id, ...it };
    }
  }
  return null;
}

function currencyFor(symbol) {
  const known = findInstrument(symbol);
  return (known && known.currency) || guessCurrency(symbol) || null;
}

function symbolFor(currency) {
  if (!currency) return "";
  return CURRENCY_SYMBOLS[String(currency).toUpperCase()] || String(currency).toUpperCase();
}

module.exports = { EXCHANGES, CURRENCY_SYMBOLS, guessCurrency, findInstrument, currencyFor, symbolFor };
