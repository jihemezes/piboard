/* Test des fonctions pures du widget Classements. Cible principale : la
   reconnaissance de la colonne des points, qui manquait en Ligue 1 et en
   Top 14 parce qu'ESPN y abrege les points en "P" et non "PTS". */
"use strict";
const assert = require("assert");
const { canonicalKey, pickColumns, formatPercentStat, statValue, MAX_STAT_COLUMNS } =
  require("../public/widgets/standings/widget.js");

/* Echantillons calques sur ce que renvoie ESPN selon le sport. */
const SOCCER_STATS = [
  { name: "gamesPlayed", abbreviation: "GP", displayValue: "20" },
  { name: "wins", abbreviation: "W", displayValue: "12" },
  { name: "ties", abbreviation: "D", displayValue: "4" },
  { name: "losses", abbreviation: "L", displayValue: "4" },
  { name: "points", abbreviation: "P", displayValue: "40" },
  { name: "pointDifferential", abbreviation: "GD", displayValue: "+15" },
  { name: "rank", abbreviation: "rank", value: 3 }
];
const NBA_STATS = [
  { name: "gamesPlayed", abbreviation: "GP", displayValue: "60" },
  { name: "wins", abbreviation: "W", displayValue: "40" },
  { name: "losses", abbreviation: "L", displayValue: "20" },
  { name: "winPercent", abbreviation: "PCT", value: 0.667 }
];

console.log("== canonicalKey : les points reconnus quelle que soit l'abreviation ==");
assert.strictEqual(canonicalKey({ name: "points", abbreviation: "P" }), "PTS", "football/rugby : abbr = P");
assert.strictEqual(canonicalKey({ name: "points", abbreviation: "PTS" }), "PTS", "NBA : abbr = PTS");
assert.strictEqual(canonicalKey({ name: "", abbreviation: "PTS" }), "PTS", "repli sur l'abreviation");
console.log("  OK");

console.log("== canonicalKey : \"P\" seul reste ambigu et n'est jamais devine ==");
assert.strictEqual(canonicalKey({ name: "", abbreviation: "P" }), null,
  "sans le nom, P peut valoir points ou played : on ne tranche pas");
assert.strictEqual(canonicalKey({ name: "gamesPlayed", abbreviation: "P" }), "GP",
  "le nom tranche, et il dit bien joues");
console.log("  OK");

console.log("== canonicalKey : autres colonnes et entrees invalides ==");
assert.strictEqual(canonicalKey({ name: "wins" }), "W");
assert.strictEqual(canonicalKey({ name: "ties" }), "D");
assert.strictEqual(canonicalKey({ name: "losses" }), "L");
assert.strictEqual(canonicalKey({ name: "winPercent" }), "PCT");
assert.strictEqual(canonicalKey({ name: "rank", abbreviation: "rank" }), null, "le rang n'est pas une colonne stat");
assert.strictEqual(canonicalKey(null), null);
assert.strictEqual(canonicalKey({}), null);
console.log("  OK");

console.log("== pickColumns : REGRESSION Ligue 1 / Top 14, les points sont presents ==");
{
  const cols = pickColumns([{ stats: SOCCER_STATS }]);
  assert.ok(cols.includes("PTS"), "la colonne des points doit apparaitre (bug corrige en 1.80.0)");
  assert.strictEqual(cols[cols.length - 1], "PTS", "et se placer en derniere colonne, comme un vrai tableau");
  assert.deepStrictEqual(cols, ["GP", "W", "D", "L", "DIFF", "PTS"].slice(-cols.length));
}
console.log("  OK");

console.log("== pickColumns : ordre conventionnel J G N P ==");
{
  const cols = pickColumns([{ stats: SOCCER_STATS }]);
  assert.ok(cols.indexOf("W") < cols.indexOf("D"), "gagnes avant nuls");
  assert.ok(cols.indexOf("D") < cols.indexOf("L"), "nuls avant perdus");
  assert.ok(cols.indexOf("L") < cols.indexOf("PTS"), "perdus avant points");
}
console.log("  OK");

console.log("== pickColumns : les points survivent au plafonnement ==");
{
  const many = [{ stats: SOCCER_STATS.concat([
    { name: "otLosses", abbreviation: "OTL", displayValue: "1" }
  ]) }];
  const cols = pickColumns(many);
  assert.ok(cols.length <= MAX_STAT_COLUMNS + 1, "le plafond est respecte");
  assert.ok(cols.includes("PTS"), "les points ne sont jamais la colonne sacrifiee");
}
console.log("  OK");

console.log("== pickColumns : NBA inchangee (pas de regression) ==");
{
  const cols = pickColumns([{ stats: NBA_STATS }]);
  assert.deepStrictEqual(cols, ["GP", "W", "L", "PCT"]);
}
console.log("  OK");

console.log("== pickColumns : balaye TOUTES les lignes, pas seulement la premiere ==");
{
  const cols = pickColumns([
    { stats: [{ name: "wins", abbreviation: "W", displayValue: "1" }] },
    { stats: SOCCER_STATS }
  ]);
  assert.ok(cols.includes("PTS"), "une premiere ligne incomplete ne doit pas amputer le tableau");
}
console.log("  OK");

console.log("== pickColumns : entrees vides ==");
assert.deepStrictEqual(pickColumns([]), []);
assert.deepStrictEqual(pickColumns([{}]), []);
console.log("  OK");

console.log("== formatPercentStat : le format americain .692 devient 69.2% ==");
assert.strictEqual(formatPercentStat({ value: 0.692 }), "69.2%");
assert.strictEqual(formatPercentStat({ displayValue: ".692" }), "69.2%");
assert.strictEqual(formatPercentStat({ value: 69.2 }), "69.2%", "deja en pourcentage : pas de double multiplication");
assert.strictEqual(formatPercentStat({ displayValue: "n/a" }), "n/a");
console.log("  OK");

console.log("== statValue ==");
{
  const entry = { stats: SOCCER_STATS };
  assert.strictEqual(statValue(entry, "PTS"), "40");
  assert.strictEqual(statValue(entry, "GP"), "20");
  assert.strictEqual(statValue(entry, "OTL"), "—", "colonne absente : tiret, pas undefined");
  assert.strictEqual(statValue({ stats: NBA_STATS }, "PCT"), "66.7%");
}
console.log("  OK");

console.log("Tous les tests standings sont passes.");

/* ---------- Saison demandee a ESPN ----------
   Deux defauts corriges en 1.96.1, verifies contre l'API reelle :
   l'hote (le parametre season n'est honore que par site.web.api) et la
   deduction (la saison en cours est desormais LUE dans le catalogue
   seasons[] que renvoie ESPN, au lieu d'etre devinee d'apres le mois). */
const { currentSeasonYear, servedSeasonYear, servedSeasonEnd, hasEntries, loadEspn, ESSENTIAL_COLUMNS } =
  require("../public/widgets/standings/widget.js");

/* Calque de ce que renvoie reellement ESPN. */
const SEASONS = [
  { year: 2026, startDate: "2026-06-01T04:00Z", endDate: "2027-06-01T03:59Z", hasStandings: true },
  { year: 2025, startDate: "2025-06-01T04:00Z", endDate: "2026-06-01T03:59Z", hasStandings: true }
];

console.log("== currentSeasonYear : la saison en cours est lue, pas devinee ==");
assert.strictEqual(currentSeasonYear({ seasons: SEASONS }, new Date("2026-09-07T12:00:00Z")), 2026,
  "septembre 2026 tombe dans la saison 2026-27");
assert.strictEqual(currentSeasonYear({ seasons: SEASONS }, new Date("2026-03-07T12:00:00Z")), 2025,
  "mars 2026 appartient encore a la saison 2025-26");
assert.strictEqual(currentSeasonYear({ seasons: [] }, new Date()), null,
  "sans catalogue, aucune saison n'est affirmee");
assert.strictEqual(currentSeasonYear({ seasons: [{ year: 2026, startDate: "2026-06-01T04:00Z", endDate: "2027-06-01T03:59Z", hasStandings: false }] },
  new Date("2026-09-07T12:00:00Z")), null, "une saison sans classement n'est pas proposee");
console.log("  OK");

console.log("== servedSeasonYear : quelle saison la reponse contient-elle ==");
assert.strictEqual(servedSeasonYear({ season: { year: 2025 } }), 2025, "champ season de la reponse");
assert.strictEqual(servedSeasonYear({ children: [{ standings: { season: 2025 } }] }), 2025, "ou celui de la poule");
assert.strictEqual(servedSeasonYear({}), null, "rien a dire si l'information manque");
console.log("  OK");

console.log("== hasEntries : une saison demandee trop tot est vide, pas valide ==");
assert.strictEqual(hasEntries(null), false, "reponse absente");
assert.strictEqual(hasEntries({ standings: { entries: [] } }), false, "structure valide mais vide");
assert.strictEqual(hasEntries({ standings: { entries: [{}] } }), true, "un classement simple");
assert.strictEqual(hasEntries({ children: [{ standings: { entries: [] } }, { standings: { entries: [{}] } }] }), true,
  "une seule poule remplie suffit");
console.log("  OK");

console.log("== Colonnes essentielles : G, N, P, Pts, et rien d'autre ==");
const RUGBY = [{ stats: [
  { name: "gamesPlayed", abbreviation: "GP", displayValue: "5" },
  { name: "wins", abbreviation: "W", displayValue: "4" },
  { name: "ties", abbreviation: "D", displayValue: "0" },
  { name: "losses", abbreviation: "L", displayValue: "1" },
  { name: "pointDifferential", abbreviation: "GD", displayValue: "+42" },
  { name: "points", abbreviation: "P", displayValue: "19" }
] }];
assert.deepStrictEqual(pickColumns(RUGBY, "essential"), ["W", "D", "L", "PTS"],
  "ni matchs joues, ni difference");
assert.ok(pickColumns(RUGBY, "full").includes("DIFF"), "le mode complet garde le choix automatique d'avant");
const NO_DRAW = [{ stats: [
  { name: "wins", abbreviation: "W", displayValue: "40" },
  { name: "losses", abbreviation: "L", displayValue: "20" },
  { name: "points", abbreviation: "PTS", displayValue: "80" }
] }];
assert.deepStrictEqual(pickColumns(NO_DRAW, "essential"), ["W", "L", "PTS"],
  "un sport sans match nul ne recoit pas une colonne N vide");
/* Sports americains : pas de points de championnat, le classement se lit
   au pourcentage de victoires -- une tuile NBA reduite a "G / P" perdrait
   la colonne sur laquelle le classement est etabli. */
const NBA = [{ stats: [
  { name: "wins", abbreviation: "W", displayValue: "40" },
  { name: "losses", abbreviation: "L", displayValue: "20" },
  { name: "winPercent", abbreviation: "PCT", value: 0.667 }
] }];
assert.deepStrictEqual(pickColumns(NBA, "essential"), ["W", "L", "PCT"],
  "sans points de championnat, le pourcentage de victoires est conserve");
assert.deepStrictEqual(ESSENTIAL_COLUMNS, ["W", "D", "L", "PTS"], "l'ordre reste celui d'un tableau de championnat");
console.log("  OK");

(async () => {
  const ROW = {
    team: { shortDisplayName: "Toulouse" },
    stats: [
      { name: "wins", abbreviation: "W", displayValue: "4" },
      { name: "ties", abbreviation: "D", displayValue: "0" },
      { name: "losses", abbreviation: "L", displayValue: "1" },
      { name: "points", abbreviation: "P", displayValue: "19" },
      { name: "gamesPlayed", abbreviation: "GP", displayValue: "5" }
    ]
  };
  const seen = [];
  /* La reponse nue sert la saison close 2025 mais annonce 2026 en cours :
     exactement le cas du Top 14 en septembre. */
  const BASE = "https://site.web.api.espn.com/apis/v2/sports/rugby/270559/standings";
  const NOW_YEAR = currentSeasonYear({ seasons: SEASONS }, new Date());
  const responses = {
    [BASE]: { season: { year: 2025 }, seasons: SEASONS, standings: { entries: [ROW] } },
    [BASE + "?season=" + NOW_YEAR]: { season: { year: NOW_YEAR }, seasons: SEASONS, standings: { entries: [ROW] } }
  };
  global.fetch = async (url) => {
    seen.push(url);
    const body = responses[url];
    if (!body) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  const ctx = { api: { proxyUrl: (u) => u } };

  console.log("== loadEspn redemande la saison en cours quand la reponse est perimee ==");
  const groups = await loadEspn(ctx, "rugby:270559", "essential");
  assert.ok(seen[0].startsWith("https://site.web.api.espn.com/"),
    "l'hote est celui qui honore le parametre season");
  assert.strictEqual(seen.length, 2, "un second appel, cible sur la saison en cours");
  assert.ok(seen[1].endsWith("?season=" + NOW_YEAR), "et c'est bien celle lue dans le catalogue");
  assert.deepStrictEqual(groups[0].cols, ["W", "D", "L", "PTS"], "avec les seules colonnes utiles");
  assert.strictEqual(groups[0].rows[0].team, "Toulouse");
  console.log("  OK");

  console.log("== Une saison close est annoncee sous le tableau ==");
  /* Cas reel du Top 14 : ESPN ne publie plus rien pour l'identifiant
     270559 depuis 2022-23. La donnee n'existe pas, il n'y a rien a
     reparer -- mais la tuile doit le dire au lieu de presenter un vieux
     tableau comme celui du jour. */
  seen.length = 0;
  const OLD = {
    season: { year: 2022 },
    seasons: [{ year: 2022, startDate: "2022-06-01T04:00Z", endDate: "2023-06-01T03:59Z", hasStandings: true }],
    standings: { entries: [ROW] }
  };
  responses[BASE] = OLD;
  const ctxI18n = { api: { proxyUrl: (u) => u }, i18n: { t: () => "Saison {season} perimee" } };
  const stale = await loadEspn(ctxI18n, "rugby:270559", "essential");
  assert.ok(/2022-23/.test(stale[0].note), "la saison close est nommee sous le tableau");
  assert.strictEqual(servedSeasonEnd(OLD, 2022), Date.parse("2023-06-01T03:59Z"), "fin de saison lue dans le catalogue");
  console.log("  OK");

  console.log("== ... et se contente d'un appel quand la saison servie est deja la bonne ==");
  seen.length = 0;
  responses[BASE] = { season: { year: NOW_YEAR }, seasons: SEASONS, standings: { entries: [ROW] } };
  await loadEspn(ctx, "rugby:270559", "essential");
  assert.strictEqual(seen.length, 1, "pas de requete inutile le reste de l'annee");
  console.log("  OK");

  console.log("\n>>> TOUS LES TESTS CLASSEMENTS PASSENT");
})().catch((e) => { console.error("\n>>> ECHEC :", e.message); process.exit(1); });

/* ---------- Ligue des champions et defilement ---------- */
const fsSt = require("fs");
const pathSt = require("path");
const DIR = pathSt.join(__dirname, "..", "public", "widgets", "standings");

console.log("== La Ligue des champions figure dans la liste des competitions ==");
assert.ok(fsSt.readFileSync(pathSt.join(DIR, "manifest.json"), "utf8").includes("soccer:uefa.champions"),
  "le code ESPN de la C1 est propose");
console.log("  OK");

console.log("== Le tableau defile quand il depasse la hauteur de la tuile ==");
const wjs = fsSt.readFileSync(pathSt.join(DIR, "widget.js"), "utf8");
const wcss = fsSt.readFileSync(pathSt.join(DIR, "widget.css"), "utf8");
assert.ok(/<div class="pws-scroll">/.test(wjs), "les tableaux sont places dans le conteneur defilant");
const scrollRule = (wcss.match(/\.pw-standings \.pws-scroll \{[^}]*\}/) || [""])[0];
assert.ok(/overflow-y:\s*auto/.test(scrollRule), "le conteneur defile verticalement");
assert.ok(/min-height:\s*0/.test(scrollRule), "et peut retrecir sous la taille de son contenu");
console.log("  OK");
