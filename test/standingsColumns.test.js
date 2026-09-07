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
   Sans parametre, ESPN sert la derniere saison close : le Top 14
   affichait donc tout l'automne le classement de la saison precedente
   alors que la competition avait repris. La saison en cours est
   desormais demandee explicitement, avec repli sur l'appel nu. */
const { seasonYearFor, hasEntries, loadEspn } = require("../public/widgets/standings/widget.js");

console.log("== seasonYearFor : ESPN nomme une saison par son annee de debut ==");
assert.strictEqual(seasonYearFor("rugby:270559", new Date("2026-09-07T12:00:00Z")), 2026,
  "en septembre, la saison en cours est celle qui vient de commencer");
assert.strictEqual(seasonYearFor("rugby:270559", new Date("2027-03-07T12:00:00Z")), 2026,
  "au printemps, c'est toujours la saison commencee l'automne d'avant");
assert.strictEqual(seasonYearFor("soccer:fra.1", new Date("2026-07-01T12:00:00Z")), 2026,
  "juillet bascule deja sur la saison a venir");
assert.strictEqual(seasonYearFor("baseball:mlb", new Date("2026-03-07T12:00:00Z")), 2026,
  "une competition en annee civile ne recule jamais d'un an");
assert.strictEqual(seasonYearFor("soccer:usa.1", new Date("2026-03-07T12:00:00Z")), 2026,
  "la MLS non plus");
console.log("  OK");

console.log("== hasEntries : une saison demandee trop tot est vide, pas valide ==");
assert.strictEqual(hasEntries(null), false, "reponse absente");
assert.strictEqual(hasEntries({ standings: { entries: [] } }), false, "structure valide mais vide");
assert.strictEqual(hasEntries({ standings: { entries: [{}] } }), true, "un classement simple");
assert.strictEqual(hasEntries({ children: [{ standings: { entries: [] } }, { standings: { entries: [{}] } }] }), true,
  "une seule poule remplie suffit");
assert.strictEqual(hasEntries({ children: [{ standings: { entries: [] } }] }), false, "toutes les poules vides");
console.log("  OK");

(async () => {
  const ROW = {
    team: { shortDisplayName: "Toulouse" },
    stats: [{ name: "points", abbreviation: "P", displayValue: "9" }]
  };
  function makeCtx(responses, seen) {
    global.fetch = async (url) => {
      seen.push(url);
      const body = responses[url];
      if (!body) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    };
    return { api: { proxyUrl: (u) => u } };
  }
  const BASE = "https://site.api.espn.com/apis/v2/sports/rugby/270559/standings";
  const YEAR = seasonYearFor("rugby:270559", new Date());

  console.log("== loadEspn demande d'abord la saison en cours ==");
  let seen = [];
  let ctx = makeCtx({
    [BASE + "?season=" + YEAR]: { standings: { entries: [ROW] } },
    [BASE]: { standings: { entries: [] } }
  }, seen);
  let groups = await loadEspn(ctx, "rugby:270559");
  assert.ok(seen[0].endsWith("?season=" + YEAR), "la saison est demandee explicitement, en premier");
  assert.strictEqual(seen.length, 1, "et l'appel nu n'est meme pas necessaire");
  assert.strictEqual(groups[0].rows[0].team, "Toulouse", "le classement de la saison en cours est rendu");
  console.log("  OK");

  console.log("== ... et retombe sur l'appel nu si cette saison n'existe pas encore ==");
  seen = [];
  ctx = makeCtx({ [BASE]: { standings: { entries: [ROW] } } }, seen);
  groups = await loadEspn(ctx, "rugby:270559");
  assert.strictEqual(seen.length, 2, "la saison a bien ete tentee avant le repli");
  assert.strictEqual(groups[0].rows[0].team, "Toulouse", "le repli affiche quand meme un classement");
  console.log("  OK");

  console.log("\n>>> TOUS LES TESTS CLASSEMENTS PASSENT");
})().catch((e) => { console.error("\n>>> ECHEC :", e.message); process.exit(1); });
