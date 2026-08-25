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
    /* `kind` sert au REGROUPEMENT A L'AFFICHAGE : la tuile trace un
       separateur entre les indices et les valeurs individuelles, deux
       natures d'information qu'on ne lit pas de la meme facon. Porte par
       la famille et non par l'instrument, pour rester declaratif.
       `kind` drives DISPLAY GROUPING: the tile draws a separator between
       indices and individual securities, two kinds of information one
       does not read the same way. Carried by the family, not the
       instrument, to stay declarative. */
    kind: "index",
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
  /* Compositions d'indices. Repondent au besoin "voir les valeurs qui
     composent le CAC 40" sans imposer de les chercher une par une dans
     la famille Euronext Paris. Ce sont bien des ACTIONS (kind par
     defaut), elles s'affichent donc sous le separateur, avec les autres
     valeurs individuelles.
     Les compositions evoluent (entrees et sorties d'indice une a
     quelques fois par an) : cette liste est un instantane, pas une
     verite permanente. L'aide le precise.
     Index constituents. They answer the "see the stocks making up the
     CAC 40" need without forcing you to hunt them one by one in the
     Euronext Paris family. These are SHARES (default kind), so they show
     below the separator with the other individual securities.
     Constituents change (index entries and exits once to a few times a
     year): this list is a snapshot, not a permanent truth. The help says
     so. */
  {
    id: "cac40",
    label: { fr: "Composition du CAC 40", en: "CAC 40 constituents" },
    instruments: [
      { symbol: "AC.FR", label: "Accor", currency: "EUR" },
      { symbol: "AI.FR", label: "Air Liquide", currency: "EUR" },
      { symbol: "AIR.FR", label: "Airbus", currency: "EUR" },
      { symbol: "ALO.FR", label: "Alstom", currency: "EUR" },
      { symbol: "MT.FR", label: "ArcelorMittal", currency: "EUR" },
      { symbol: "CS.FR", label: "AXA", currency: "EUR" },
      { symbol: "BNP.FR", label: "BNP Paribas", currency: "EUR" },
      { symbol: "EN.FR", label: "Bouygues", currency: "EUR" },
      { symbol: "CAP.FR", label: "Capgemini", currency: "EUR" },
      { symbol: "CA.FR", label: "Carrefour", currency: "EUR" },
      { symbol: "ACA.FR", label: "Crédit Agricole", currency: "EUR" },
      { symbol: "BN.FR", label: "Danone", currency: "EUR" },
      { symbol: "DSY.FR", label: "Dassault Systèmes", currency: "EUR" },
      { symbol: "EDEN.FR", label: "Edenred", currency: "EUR" },
      { symbol: "ENGI.FR", label: "Engie", currency: "EUR" },
      { symbol: "EL.FR", label: "EssilorLuxottica", currency: "EUR" },
      { symbol: "ERF.FR", label: "Eurofins Scientific", currency: "EUR" },
      { symbol: "RMS.FR", label: "Hermès", currency: "EUR" },
      { symbol: "KER.FR", label: "Kering", currency: "EUR" },
      { symbol: "LR.FR", label: "Legrand", currency: "EUR" },
      { symbol: "OR.FR", label: "L'Oréal", currency: "EUR" },
      { symbol: "MC.FR", label: "LVMH", currency: "EUR" },
      { symbol: "ML.FR", label: "Michelin", currency: "EUR" },
      { symbol: "ORA.FR", label: "Orange", currency: "EUR" },
      { symbol: "RI.FR", label: "Pernod Ricard", currency: "EUR" },
      { symbol: "PUB.FR", label: "Publicis", currency: "EUR" },
      { symbol: "RNO.FR", label: "Renault", currency: "EUR" },
      { symbol: "SAF.FR", label: "Safran", currency: "EUR" },
      { symbol: "SGO.FR", label: "Saint-Gobain", currency: "EUR" },
      { symbol: "SAN.FR", label: "Sanofi", currency: "EUR" },
      { symbol: "SU.FR", label: "Schneider Electric", currency: "EUR" },
      { symbol: "GLE.FR", label: "Société Générale", currency: "EUR" },
      { symbol: "STLAP.FR", label: "Stellantis", currency: "EUR" },
      { symbol: "STMPA.FR", label: "STMicroelectronics", currency: "EUR" },
      { symbol: "TEP.FR", label: "Teleperformance", currency: "EUR" },
      { symbol: "HO.FR", label: "Thales", currency: "EUR" },
      { symbol: "TTE.FR", label: "TotalEnergies", currency: "EUR" },
      { symbol: "URW.FR", label: "Unibail-Rodamco-Westfield", currency: "EUR" },
      { symbol: "VIE.FR", label: "Veolia", currency: "EUR" },
      { symbol: "DG.FR", label: "Vinci", currency: "EUR" }
    ]
  },
  {
    id: "dax40",
    label: { fr: "Composition du DAX (principales)", en: "DAX constituents (main)" },
    instruments: [
      { symbol: "ADS.DE", label: "Adidas", currency: "EUR" },
      { symbol: "ALV.DE", label: "Allianz", currency: "EUR" },
      { symbol: "BAS.DE", label: "BASF", currency: "EUR" },
      { symbol: "BAYN.DE", label: "Bayer", currency: "EUR" },
      { symbol: "BMW.DE", label: "BMW", currency: "EUR" },
      { symbol: "DBK.DE", label: "Deutsche Bank", currency: "EUR" },
      { symbol: "DTE.DE", label: "Deutsche Telekom", currency: "EUR" },
      { symbol: "IFX.DE", label: "Infineon", currency: "EUR" },
      { symbol: "MBG.DE", label: "Mercedes-Benz", currency: "EUR" },
      { symbol: "MUV2.DE", label: "Munich Re", currency: "EUR" },
      { symbol: "RWE.DE", label: "RWE", currency: "EUR" },
      { symbol: "SAP.DE", label: "SAP", currency: "EUR" },
      { symbol: "SIE.DE", label: "Siemens", currency: "EUR" },
      { symbol: "VOW3.DE", label: "Volkswagen", currency: "EUR" }
    ]
  },
  {
    id: "dow30",
    label: { fr: "Composition du Dow Jones", en: "Dow Jones constituents" },
    instruments: [
      { symbol: "AXP.US", label: "American Express", currency: "USD" },
      { symbol: "AMGN.US", label: "Amgen", currency: "USD" },
      { symbol: "AAPL.US", label: "Apple", currency: "USD" },
      { symbol: "BA.US", label: "Boeing", currency: "USD" },
      { symbol: "CAT.US", label: "Caterpillar", currency: "USD" },
      { symbol: "CVX.US", label: "Chevron", currency: "USD" },
      { symbol: "CSCO.US", label: "Cisco", currency: "USD" },
      { symbol: "KO.US", label: "Coca-Cola", currency: "USD" },
      { symbol: "DIS.US", label: "Disney", currency: "USD" },
      { symbol: "GS.US", label: "Goldman Sachs", currency: "USD" },
      { symbol: "HD.US", label: "Home Depot", currency: "USD" },
      { symbol: "HON.US", label: "Honeywell", currency: "USD" },
      { symbol: "IBM.US", label: "IBM", currency: "USD" },
      { symbol: "JNJ.US", label: "Johnson & Johnson", currency: "USD" },
      { symbol: "JPM.US", label: "JPMorgan Chase", currency: "USD" },
      { symbol: "MCD.US", label: "McDonald's", currency: "USD" },
      { symbol: "MRK.US", label: "Merck", currency: "USD" },
      { symbol: "MSFT.US", label: "Microsoft", currency: "USD" },
      { symbol: "NKE.US", label: "Nike", currency: "USD" },
      { symbol: "PG.US", label: "Procter & Gamble", currency: "USD" },
      { symbol: "CRM.US", label: "Salesforce", currency: "USD" },
      { symbol: "TRV.US", label: "Travelers", currency: "USD" },
      { symbol: "UNH.US", label: "UnitedHealth", currency: "USD" },
      { symbol: "VZ.US", label: "Verizon", currency: "USD" },
      { symbol: "V.US", label: "Visa", currency: "USD" },
      { symbol: "WMT.US", label: "Walmart", currency: "USD" }
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

/* ---------- Horaires de marche / market hours ----------

   Un indicateur "marche ferme" n'a d'interet que s'il est JUSTE. D'ou
   deux precautions :

   1. Chaque place porte son FUSEAU IANA, jamais un decalage fixe. Les
      passages a l'heure d'ete n'ont pas lieu aux memes dates en Europe,
      aux Etats-Unis et au Japon : un decalage en dur serait faux
      plusieurs semaines par an, et le Japon n'a pas d'heure d'ete du
      tout.
   2. L'heure locale de la place est obtenue via Intl, la meme API que
      celle qui alimente deja la tuile Horloge -- pas de calcul maison.

   Les horaires sont ceux de la seance principale, hors enchere de
   pre-ouverture et hors jours feries : PiBoard ne connait pas les
   calendriers feries de sept places, et un tableau mural n'a pas besoin
   de cette exactitude. L'aide le precise.

   A "market closed" indicator is only worth having if it is RIGHT. Hence
   two precautions:

   1. Each exchange carries its IANA TIME ZONE, never a fixed offset.
      Daylight-saving switches do not happen on the same dates in Europe,
      the US and Japan: a hard-coded offset would be wrong several weeks
      a year, and Japan has no DST at all.
   2. The exchange's local time comes from Intl, the same API that already
      drives the Clock tile -- no home-made arithmetic.

   Hours are those of the main session, excluding pre-opening auctions and
   public holidays: PiBoard does not know seven exchanges' holiday
   calendars, and a wall board does not need that precision. The help says
   so. */

const MARKETS = {
  euronext: { tz: "Europe/Paris", open: "09:00", close: "17:30", days: [1, 2, 3, 4, 5] },
  xetra:    { tz: "Europe/Berlin", open: "09:00", close: "17:30", days: [1, 2, 3, 4, 5] },
  lse:      { tz: "Europe/London", open: "08:00", close: "16:30", days: [1, 2, 3, 4, 5] },
  nyse:     { tz: "America/New_York", open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
  tokyo:    { tz: "Asia/Tokyo", open: "09:00", close: "15:30", days: [1, 2, 3, 4, 5] },
  hk:       { tz: "Asia/Hong_Kong", open: "09:30", close: "16:00", days: [1, 2, 3, 4, 5] },
  six:      { tz: "Europe/Zurich", open: "09:00", close: "17:30", days: [1, 2, 3, 4, 5] },
  /* Change et matieres premieres : cotation continue du dimanche soir au
     vendredi soir (heure de New York). Ce n'est pas "24/7" comme les
     cryptos -- le week-end, ces marches sont bel et bien fermes.
     FX and commodities: continuous trading from Sunday evening to Friday
     evening (New York time). This is not "24/7" like crypto -- at the
     weekend these markets really are closed. */
  fx:       { tz: "America/New_York", open: "00:00", close: "24:00", days: [0, 1, 2, 3, 4, 5], sundayFrom: "17:00", fridayTo: "17:00" }
};

/* Place de rattachement par famille du catalogue. Les indices sont
   traites symbole par symbole : le CAC et le Nikkei ne ferment
   evidemment pas a la meme heure.
   Market per catalog family. Indices are handled symbol by symbol: the
   CAC and the Nikkei obviously do not close at the same time. */
const EXCHANGE_MARKET = {
  paris: "euronext", us: "nyse", xetra: "xetra", lse: "lse",
  cac40: "euronext", dax40: "xetra", dow30: "nyse",
  fx: "fx", commodities: "fx"
};

const INDEX_MARKET = {
  "^CAC": "euronext", "^STOXX50E": "euronext",
  "^SPX": "nyse", "^NDQ": "nyse", "^DJI": "nyse",
  "^DAX": "xetra", "^FTM": "lse", "^NKX": "tokyo",
  "^SMI": "six", "^HSI": "hk"
};

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

/* Heure locale de la place, via Intl. `weekday: "short"` en anglais
   donne une valeur stable quelle que soit la langue de PiBoard --
   s'appuyer sur la locale du systeme casserait l'indicateur en francais.
   The exchange's local time, via Intl. `weekday: "short"` in English
   gives a stable value whatever PiBoard's language -- relying on the
   system locale would break the indicator in French. */
function localTime(tz, now) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
  });
  const parts = {};
  for (const p of fmt.formatToParts(now || new Date())) parts[p.type] = p.value;
  const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: DAYS[parts.weekday],
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute)
  };
}

function marketFor(symbol, exchangeId) {
  const s = String(symbol || "").toUpperCase().trim();
  if (INDEX_MARKET[s]) return MARKETS[INDEX_MARKET[s]];
  const known = findInstrument(s);
  const id = (known && known.exchange) || exchangeId;
  const m = EXCHANGE_MARKET[id];
  if (m) return MARKETS[m];
  // Saisie libre : on devine d'apres le suffixe, comme pour la devise.
  // Free entry: guessed from the suffix, as for the currency.
  if (s.endsWith(".US") || s.endsWith(".F")) return MARKETS.nyse;
  if (s.endsWith(".UK")) return MARKETS.lse;
  if (s.endsWith(".DE")) return MARKETS.xetra;
  if (s.endsWith(".JP")) return MARKETS.tokyo;
  if (s.endsWith(".HK")) return MARKETS.hk;
  if (s.endsWith(".CH")) return MARKETS.six;
  if (s.endsWith(".FR") || s.endsWith(".NL") || s.endsWith(".BE")) return MARKETS.euronext;
  if (/^[A-Z]{6}$/.test(s) || /^X(AU|AG)USD$/.test(s)) return MARKETS.fx;
  return null;
}

/* Renvoie true (ouvert), false (ferme) ou null (horaires inconnus).
   Le null est important : pour un symbole exotique saisi a la main, mieux
   vaut n'afficher AUCUN indicateur qu'un "ferme" faux.
   Returns true (open), false (closed) or null (hours unknown). The null
   matters: for an exotic hand-typed symbol, showing NO indicator beats a
   wrong "closed". */
function isMarketOpen(symbol, exchangeId, now) {
  const m = marketFor(symbol, exchangeId);
  if (!m) return null;
  const t = localTime(m.tz, now);
  if (!m.days.includes(t.day)) return false;
  if (m.sundayFrom && t.day === 0) return t.minutes >= toMinutes(m.sundayFrom);
  if (m.fridayTo && t.day === 5) return t.minutes < toMinutes(m.fridayTo);
  return t.minutes >= toMinutes(m.open) && t.minutes < toMinutes(m.close);
}

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

/* "index" ou "security" : determine de quel cote du separateur la ligne
   s'affiche. Un symbole inconnu est traite comme une valeur, jamais
   comme un indice -- un indice ajoute par erreur en bas est anodin, un
   titre promu en haut brouillerait la lecture.
   "index" or "security": decides which side of the separator a row falls
   on. An unknown symbol is treated as a security, never as an index -- an
   index wrongly placed at the bottom is harmless, a share promoted to the
   top would muddle the reading. */
function kindFor(symbol) {
  const known = findInstrument(symbol);
  if (known) {
    const ex = EXCHANGES.find((e) => e.id === known.exchange);
    if (ex && ex.kind === "index") return "index";
    return "security";
  }
  return String(symbol || "").trim().startsWith("^") ? "index" : "security";
}

function currencyFor(symbol) {
  const known = findInstrument(symbol);
  return (known && known.currency) || guessCurrency(symbol) || null;
}

function symbolFor(currency) {
  if (!currency) return "";
  return CURRENCY_SYMBOLS[String(currency).toUpperCase()] || String(currency).toUpperCase();
}

module.exports = {
  EXCHANGES, CURRENCY_SYMBOLS, MARKETS,
  guessCurrency, findInstrument, currencyFor, symbolFor, kindFor,
  isMarketOpen, marketFor, _localTime: localTime
};
