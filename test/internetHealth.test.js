/* PiBoard - test/internetHealth.test.js
   Fonctions pures de la tuile Sante Internet : analyse des cibles,
   mediane, gigue, notation, statistiques, reduction de courbe et export
   CSV. AUCUN appel reseau -- ces tests doivent passer sur une machine
   hors ligne, y compris pendant une coupure, ce qui est justement la
   situation que la tuile est censee mesurer.

   Pure functions of the Internet health tile: target parsing, median,
   jitter, grading, statistics, curve reduction and CSV export. NO
   network calls -- these tests must pass on an offline machine,
   including during an outage, which is precisely the situation the tile
   is meant to measure. */
"use strict";
const h = require("../server/internetHealth.js");
let ok = 0;
function check(label, cond) {
  if (!cond) { console.error("  FAIL " + label); process.exitCode = 1; }
  else { console.log("  OK   " + label); ok++; }
}

console.log("== sante Internet : analyse des cibles ==");
{
  const t = h._parseTargets("1.1.1.1:443, 8.8.8.8:53");
  check("deux cibles reconnues", t.length === 2);
  check("hote et port separes", t[0].host === "1.1.1.1" && t[0].port === 443);
  check("port explicite conserve", t[1].port === 53);
  check("port omis -> 443 (le seul qu'un hotspot laisse passer a coup sur)",
    h._parseTargets("dns.google")[0].port === 443);
  check("separateurs multiples acceptes (virgule, point-virgule, retour ligne)",
    h._parseTargets("a.test\nb.test; c.test").length === 3);
  check("espaces superflus ignores", h._parseTargets("  1.1.1.1  ")[0].host === "1.1.1.1");
  check("chaine vide -> aucune cible, sans exception", h._parseTargets("").length === 0);
  check("valeur nulle -> aucune cible, sans exception", h._parseTargets(null).length === 0);
  // IPv6 : sans crochets, les deux-points de l'adresse ne peuvent pas
  // etre distingues d'un separateur de port. On prend l'adresse entiere
  // plutot que de la tronquer silencieusement.
  check("IPv6 nue prise en entier (pas tronquee au premier deux-points)",
    h._parseTargets("2606:4700:4700::1111")[0].host === "2606:4700:4700::1111");
  check("IPv6 entre crochets : port correctement separe",
    h._parseTargets("[2606:4700:4700::1111]:853")[0].port === 853);
  // Garde-fou : une liste de cinquante cibles multiplierait la duree du
  // releve sans rien apporter.
  check("liste plafonnee a 5 cibles", h._parseTargets("a,b,c,d,e,f,g,h").length === 5);
}

console.log("== sante Internet : mediane et gigue ==");
{
  check("mediane d'un nombre impair de valeurs", h._median([10, 30, 20]) === 20);
  check("mediane d'un nombre pair = moyenne des deux centrales", h._median([10, 20, 30, 40]) === 25);
  check("serie vide -> null (jamais zero)", h._median([]) === null);
  // Point essentiel : une seule retransmission ne doit pas faire bondir
  // la courbe. La moyenne de cette serie vaut 216 ms, la mediane 20 ms.
  check("un pic isole ne deplace pas la mediane (20 ms, pas 216 ms)",
    h._median([18, 20, 22, 19, 1000]) === 20);

  check("gigue = moyenne des ecarts absolus consecutifs",
    h._computeJitter([10, 14, 12]) === 3);
  check("serie parfaitement stable -> gigue nulle", h._computeJitter([20, 20, 20]) === 0);
  check("une seule valeur -> gigue inconnue (null), pas zero",
    h._computeJitter([20]) === null);
  check("valeurs non numeriques ecartees sans exception",
    h._computeJitter([10, null, 14]) === 4);
}

console.log("== sante Internet : notation d'ensemble ==");
{
  check("ligne saine -> bon", h._gradeStatus({ latencyMs: 15, jitterMs: 2, lossPct: 0 }) === "good");
  check("latence moyenne -> moyen", h._gradeStatus({ latencyMs: 90, jitterMs: 2, lossPct: 0 }) === "fair");
  check("latence elevee -> mauvais", h._gradeStatus({ latencyMs: 200, jitterMs: 2, lossPct: 0 }) === "poor");
  check("gigue elevee seule suffit a degrader", h._gradeStatus({ latencyMs: 15, jitterMs: 60, lossPct: 0 }) === "poor");
  check("perte de paquets seule suffit a degrader", h._gradeStatus({ latencyMs: 15, jitterMs: 1, lossPct: 8 }) === "poor");
  // Une latence absente n'est PAS une latence nulle : c'est une ligne
  // qui n'a pas repondu. Les confondre afficherait "excellent" pendant
  // une coupure -- exactement le contraire de l'information utile.
  check("aucune reponse -> hors ligne (surtout pas 'excellent')",
    h._gradeStatus({ latencyMs: null, jitterMs: null, lossPct: 100 }) === "down");
  check("echantillon absent -> hors ligne, sans exception", h._gradeStatus(null) === "down");
  check("gigue inconnue n'empeche pas de noter la latence",
    h._gradeStatus({ latencyMs: 15, jitterMs: null, lossPct: 0 }) === "good");
}

console.log("== sante Internet : statistiques d'une fenetre ==");
{
  const pts = [
    { t: 1000, l: 20, j: 2, p: 0, d: 300 },
    { t: 2000, l: 40, j: 4, p: 0 },
    { t: 3000, l: null, j: null, p: 100 },
    { t: 4000, l: 30, j: 3, p: 0 }
  ];
  const lat = h._summarize(pts, "l");
  check("minimum de latence", lat.min === 20);
  check("maximum de latence", lat.max === 40);
  check("moyenne calculee sur les seuls releves valides", lat.avg === 30);
  check("les releves sans valeur ne comptent pas comme des zeros", lat.count === 3);
  // Point important : une nuit sans mesure de debit ne doit pas
  // afficher un debit moyen de 0 Mb/s.
  const dl = h._summarize(pts, "d");
  check("un seul debit connu -> moyenne = ce debit, pas une moyenne diluee", dl.avg === 300);
  check("serie totalement absente -> null partout, jamais zero",
    h._summarize(pts, "u").avg === null && h._summarize(pts, "u").count === 0);

  check("disponibilite = part des releves ou la ligne a repondu", h._availability(pts) === 75);
  check("aucun releve -> disponibilite inconnue", h._availability([]) === null);

  check("fenetre : seuls les points recents sont retenus",
    h._sliceSince(pts, 2500).length === 2);
}

console.log("== sante Internet : reduction de courbe ==");
{
  const many = [];
  for (let i = 0; i < 1000; i++) many.push({ t: i * 60000, l: 20 });
  // Une coupure isolee au milieu d'un millier de points stables : c'est
  // EXACTEMENT ce que la courbe doit continuer a montrer apres
  // reduction. Une moyenne par tranche l'aurait effacee.
  many[500] = { t: 500 * 60000, l: null, p: 100 };
  const small = h._downsample(many, 100);
  check("la serie est bien reduite", small.length <= 101);
  check("la coupure isolee survit a la reduction",
    small.some((p) => p.l === null));
  check("une serie deja courte est renvoyee telle quelle",
    h._downsample([{ t: 1, l: 5 }], 100).length === 1);
  // Et le pire point de chaque tranche est retenu, pas le premier.
  const spiky = [
    { t: 0, l: 10 }, { t: 1000, l: 900 }, { t: 2000, l: 10 },
    { t: 3000, l: 10 }, { t: 4000, l: 10 }, { t: 5000, l: 10 }
  ];
  check("le pic de chaque tranche est conserve, pas le premier point",
    h._downsample(spiky, 2).some((p) => p.l === 900));
}

console.log("== sante Internet : export CSV ==");
{
  const pts = [
    { t: Date.UTC(2026, 0, 15, 8, 30, 0), l: 18.4, j: 2.1, p: 0, d: 312.5, u: 41.2 },
    { t: Date.UTC(2026, 0, 15, 8, 31, 0), l: null, j: null, p: 100 }
  ];

  const fr = h._toCsv(pts, { dialect: "french" });
  const frLines = fr.trim().split("\r\n");
  check("en-tete present", frLines[0].startsWith("datetime;"));
  check("toutes les colonnes annoncees sont ecrites",
    frLines[0].split(";").length === frLines[1].split(";").length);
  check("dialecte francais : separateur point-virgule", frLines[1].includes(";"));
  check("dialecte francais : virgule decimale (lisible par un tableur FR)",
    frLines[1].includes("18,4"));
  // Et surtout : l'horodatage en millisecondes est un ENTIER, il ne
  // doit pas heriter de la virgule decimale.
  check("l'horodatage en millisecondes reste un entier sans virgule",
    /;\d+;/.test(frLines[1]) && !frLines[1].includes(String(pts[0].t).replace(".", ",") + ",")); 
  check("une mesure absente laisse une cellule VIDE (pas un zero trompeur)",
    frLines[2].split(";")[2] === "");
  check("l'etat est calcule pour chaque ligne", frLines[1].endsWith("good"));
  check("une coupure est etiquetee comme telle dans le CSV", frLines[2].endsWith("down"));

  const intl = h._toCsv(pts, { dialect: "international" });
  const intlLines = intl.trim().split("\r\n");
  check("dialecte international : separateur virgule", intlLines[0].startsWith("datetime,"));
  check("dialecte international : point decimal", intlLines[1].includes("18.4"));

  check("fins de ligne CRLF (RFC 4180, attendu des tableurs Windows)",
    fr.includes("\r\n") && fr.endsWith("\r\n"));
  check("aucun point -> l'en-tete seul, pas une chaine vide",
    h._toCsv([], {}).trim().split("\r\n").length === 1);
  check("liste nulle -> l'en-tete seul, sans exception",
    h._toCsv(null, {}).trim().split("\r\n").length === 1);
}

console.log("== sante Internet : nom des archives ==");
{
  const name = h._archiveName(new Date(2026, 1, 3, 9, 5, 7), 24);
  check("nom horodate a la seconde", name === "piboard-internet-20260203-090507-24h.csv");
  check("l'extension est bien .csv", name.endsWith(".csv"));
  // Le nom doit satisfaire la validation de archivePath(), sinon le
  // fichier serait ecrit puis impossible a retelecharger.
  check("le nom genere passe la validation de re-telechargement",
    /^piboard-internet-[0-9]{8}-[0-9]{6}-[0-9]+h\.csv$/.test(name));
}

console.log("== sante Internet : tuiles des tiroirs ==");
{
  /* Regression 1.78.2. Une tuile posee dans un TIROIR n'est pas dans
     `layout.tiles` : elle vit sous `layout.drawer.tiles`,
     `layout.drawerTop.tiles` ou `layout.drawerRight.tiles`. Ne lire que
     `layout.tiles` rendait la tuile invisible au serveur, qui ne
     mesurait alors jamais rien -- pendant des heures, sans le moindre
     message d'erreur.
     Regression 1.78.2. A tile placed in a DRAWER is not in
     `layout.tiles`. Reading only `layout.tiles` made the tile invisible
     to the server, which then measured nothing at all -- for hours,
     without a single error message. */
  const layout = {
    version: 1,
    tiles: [{ id: "a", widget: "clock" }],
    drawer: { widthPct: 50, tiles: [{ id: "b", widget: "speedtest" }] },
    drawerTop: { heightPct: 40, tiles: [] },
    drawerRight: { widthPct: 38, tiles: [{ id: "c", widget: "rss" }] }
  };
  const all = h._allTiles(layout);
  check("les tuiles du tableau principal sont vues", all.some((t) => t.id === "a"));
  check("les tuiles d'un tiroir sont vues AUSSI (le bug de la 1.78.1)",
    all.some((t) => t.id === "b"));
  check("les trois tiroirs sont balayes, pas seulement le premier",
    all.some((t) => t.id === "c"));
  check("une tuile de tiroir est bien retrouvee par son widget",
    all.filter((t) => t.widget === "speedtest").length === 1);

  // Robustesse : une disposition partielle ou absente ne doit pas lever
  // d'exception, sinon l'echantillonneur mourrait a chaque tour.
  // Robustness: a partial or absent layout must not throw, otherwise the
  // sampler would die on every tick.
  check("disposition nulle -> liste vide, sans exception", h._allTiles(null).length === 0);
  check("disposition vide -> liste vide, sans exception", h._allTiles({}).length === 0);
  check("cle sans tableau tiles ignoree sans exception",
    h._allTiles({ drawer: { widthPct: 50 } }).length === 0);
  check("valeurs nulles ecartees",
    h._allTiles({ tiles: [null, { id: "x", widget: "speedtest" }] }).length === 1);
}

console.log("\n" + ok + " assertions OK");
