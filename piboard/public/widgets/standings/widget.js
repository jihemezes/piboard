/* PiBoard widget: standings / classement
   Trois familles de sources, toutes publiques et sans cle :
   - sports collectifs : API JSON non officielle mais publique d'ESPN. Le
     classement vit sous /apis/v2/ (et non /apis/site/v2/ comme les
     scores) : particularite documentee de cette API non officielle.
   - Formule 1 : api.jolpi.ca (reprise maintenue de l'API Ergast), deja
     utilisee par la tuile Sports mecaniques.
   - MotoGP : api.motogp.pulselive.com, le flux public de motogp.com,
     lui aussi deja utilise par la tuile Sports mecaniques.

   Three families of sources, all public and key-free:
   - team sports: ESPN's unofficial but public JSON API. Standings live
     under /apis/v2/ (not /apis/site/v2/ like scores) — a documented
     quirk of this unofficial API.
   - Formula 1: api.jolpi.ca (the maintained continuation of the Ergast
     API), already used by the Motorsport tile.
   - MotoGP: api.motogp.pulselive.com, motogp.com's public feed, also
     already used by the Motorsport tile. */
(function () {
  "use strict";

  /* ---------- Libelles de colonnes / column labels ---------- */

  const LABELS = {
    en: {
      GP: "P", W: "W", D: "D", L: "L", PTS: "Pts", PCT: "Pct", OTL: "OTL",
      DIFF: "Diff", WINS: "Wins"
    },
    fr: {
      GP: "J", W: "G", D: "N", L: "P", PTS: "Pts", PCT: "%V", OTL: "OTL",
      DIFF: "Diff", WINS: "V"
    }
  };

  /* Ordre d'affichage des colonnes, de gauche a droite : l'ordre
     conventionnel d'un tableau de championnat (joues, gagnes, nuls,
     perdus, difference, points). Display order, left to right: the
     conventional order of a league table. */
  const COLUMN_ORDER = ["GP", "W", "D", "L", "OTL", "DIFF", "PCT", "PTS"];

  /* Nombre maximal de colonnes de statistiques affichees. La tuile peut
     etre etroite ; au-dela ca devient illisible. Les points echappent a
     cette limite (voir pickColumns) : c'est l'information centrale d'un
     classement, elle ne doit jamais etre celle qu'on sacrifie.
     Maximum number of stat columns shown. The tile can be narrow;
     beyond that it becomes unreadable. Points escape this limit (see
     pickColumns): it is the central piece of information of a table and
     must never be the one sacrificed. */
  const MAX_STAT_COLUMNS = 5;

  /* Correspondance vers nos colonnes canoniques.
     ---------------------------------------------------------------
     C'EST ICI QUE SE JOUAIT LE BUG DES POINTS MANQUANTS EN LIGUE 1 ET
     EN TOP 14. L'ancienne version ne comparait qu'au champ
     `abbreviation` d'ESPN, en cherchant litteralement "PTS". Or ESPN
     n'abrege pas les points de la meme facon selon le sport : "PTS" en
     NBA, mais simplement "P" au football et au rugby. La colonne des
     points n'etait donc jamais reconnue pour ces deux competitions, et
     comme l'ancien code se limitait par ailleurs aux 4 premieres
     colonnes trouvees, l'affichage retombait sur G / N / P / %V — soit
     exactement ce qui etait constate.
     On s'appuie desormais EN PRIORITE sur le champ `name`, qui lui est
     stable d'un sport a l'autre chez ESPN ("points", "gamesPlayed",
     "wins"...), et l'abreviation ne sert plus que de repli.

     Mapping to our canonical columns.
     ---------------------------------------------------------------
     THIS IS WHERE THE MISSING-POINTS BUG IN LIGUE 1 AND TOP 14 LIVED.
     The old version only compared against ESPN's `abbreviation` field,
     looking literally for "PTS". But ESPN doesn't abbreviate points the
     same way across sports: "PTS" in the NBA, but just "P" in football
     and rugby. The points column was therefore never recognised for
     those two competitions, and since the old code also capped itself
     at the first 4 columns found, the display fell back to W / D / L /
     Pct — exactly what was observed.
     We now rely FIRST on the `name` field, which is stable across
     sports at ESPN ("points", "gamesPlayed", "wins"...), with the
     abbreviation kept only as a fallback. */
  const BY_NAME = {
    points: "PTS", totalpoints: "PTS", championshippts: "PTS",
    gamesplayed: "GP", games: "GP",
    wins: "W", overallwins: "W",
    ties: "D", draws: "D",
    losses: "L", overalllosses: "L",
    otlosses: "OTL", overtimelosses: "OTL",
    pointdifferential: "DIFF", differential: "DIFF", pointdifference: "DIFF",
    winpercent: "PCT", percentage: "PCT", winpercentage: "PCT"
  };

  /* Repli sur l'abreviation, uniquement pour les formes NON ambigues.
     "P" est volontairement absent : il vaut "points" au football mais
     "played" ailleurs — le resoudre par le nom est la seule facon sure.
     Fallback on the abbreviation, only for UNAMBIGUOUS forms. "P" is
     deliberately absent: it means "points" in football but "played"
     elsewhere — resolving it by name is the only safe way. */
  const BY_ABBR = {
    PTS: "PTS", GP: "GP", W: "W", D: "D", T: "D", L: "L", OTL: "OTL",
    PCT: "PCT", DIFF: "DIFF", GD: "DIFF"
  };

  function canonicalKey(stat) {
    if (!stat) return null;
    const name = String(stat.name || "").toLowerCase().replace(/[^a-z]/g, "");
    if (BY_NAME[name]) return BY_NAME[name];
    const abbr = String(stat.abbreviation || "").toUpperCase();
    return BY_ABBR[abbr] || null;
  }

  /* Les colonnes disponibles varient d'une competition a l'autre : on
     inspecte toutes les lignes et pas seulement la premiere, car une
     equipe fraichement promue peut avoir une statistique absente.
     Available columns vary between competitions: we inspect every row
     and not just the first, since a newly promoted team may be missing
     a statistic. */
  /* Jeu de colonnes reduit : gagnes / nuls / perdus / points. C'est ce
     qui fait un classement, le reste (matchs joues, difference,
     pourcentage de victoires) est du contexte dont on se passe sur une
     tuile murale. Le mode "complet" garde le choix automatique d'avant.
     Reduced column set: won / drawn / lost / points. That is what makes
     a table; the rest (games played, difference, win percentage) is
     context one does without on a wall tile. The "full" mode keeps the
     previous automatic choice. */
  const ESSENTIAL_COLUMNS = ["W", "D", "L", "PTS"];

  function pickColumns(entries, mode) {
    if (mode === "essential") {
      /* On ne garde que celles que la source publie reellement : un
         sport sans match nul ne doit pas se voir imposer une colonne N
         remplie de tirets. We only keep those the source actually
         publishes: a sport without draws must not be given a D column
         full of dashes. */
      const seen = new Set();
      for (const e of entries) {
        for (const st of e.stats || []) {
          const k = canonicalKey(st);
          if (k) seen.add(k);
        }
      }
      const allowed = new Set(ESSENTIAL_COLUMNS);
      /* Les sports americains ne comptent pas de points de championnat :
         leur classement se lit au pourcentage de victoires. Sans cette
         exception, une tuile NBA se reduirait a "G / P", en perdant la
         colonne sur laquelle le classement est justement etabli.
         US sports have no championship points: their table is read by
         win percentage. Without this exception an NBA tile would shrink
         to "W / L", losing the very column the ranking is built on. */
      if (!seen.has("PTS") && seen.has("PCT")) allowed.add("PCT");
      const kept = COLUMN_ORDER.filter((k) => allowed.has(k) && seen.has(k));
      return kept.length ? kept : ESSENTIAL_COLUMNS;
    }
    const present = new Set();
    for (const e of entries) {
      for (const s of e.stats || []) {
        const key = canonicalKey(s);
        if (key) present.add(key);
      }
    }
    const ordered = COLUMN_ORDER.filter((k) => present.has(k));
    if (ordered.length <= MAX_STAT_COLUMNS) return ordered;
    // On coupe par la gauche (les colonnes les moins essentielles sont en
    // tete de l'ordre conventionnel) en gardant toujours les points.
    // We trim from the left (the least essential columns come first in
    // the conventional order), always keeping points.
    const kept = ordered.slice(ordered.length - MAX_STAT_COLUMNS);
    if (ordered.includes("PTS") && !kept.includes("PTS")) kept.push("PTS");
    return kept;
  }

  /* ESPN renvoie le pourcentage de victoires ("PCT") au format americain
     habituel aux sports US : une chaine du type ".692" (0,692 sans le
     zero initial, sans signe %). Affiche tel quel, ca ressemble a un
     nombre tronque/casse plutot qu'a un pourcentage. On le reformate
     clairement en "69.2%".
     ESPN returns the win percentage ("PCT") in the format usual for US
     sports: a string like ".692" (0.692 without the leading zero, no %
     sign). Shown as-is, it looks like a truncated/broken number rather
     than a percentage. We reformat it clearly as "69.2%". */
  function formatPercentStat(s) {
    const v = typeof s.value === "number" ? s.value : parseFloat(s.displayValue);
    if (!isFinite(v)) return s.displayValue != null ? s.displayValue : "—";
    // La plupart des sports expriment PCT en fraction (0 a 1) ; par
    // precaution, si la valeur depasse deja 1, on suppose qu'elle est
    // deja en pourcentage et on ne la multiplie pas.
    const pct = v <= 1 ? v * 100 : v;
    return pct.toFixed(1) + "%";
  }

  function statValue(entry, key) {
    const s = (entry.stats || []).find((x) => canonicalKey(x) === key);
    if (!s) return "—";
    if (key === "PCT") return formatPercentStat(s);
    return s.displayValue != null ? s.displayValue : s.value;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- Sources ----------
     Chaque chargeur renvoie le MEME modele, ce qui permet a l'affichage
     d'ignorer completement la provenance des donnees :
       [{ name, cols: ["PTS", ...], rows: [{ rank, team, sub, values }] }]
     Each loader returns the SAME model, which lets the rendering ignore
     where the data came from entirely. */

  async function fetchJson(ctx, url) {
    const res = await fetch(ctx.api.proxyUrl(url), { cache: "no-store" });
    if (!res.ok) throw new Error("status " + res.status);
    return res.json();
  }

  async function fetchText(ctx, url) {
    const res = await fetch(ctx.api.proxyUrl(url), { cache: "no-store" });
    if (!res.ok) throw new Error("status " + res.status);
    return res.text();
  }

  /* ---------- Ligue Nationale de Rugby (LNR) ----------
     Source officielle du TOP 14 et de la PRO D2, adoptee parce qu'ESPN
     a cesse de publier ces competitions (voir 1.96.2).

     Le site ne propose pas d'API : le classement est ecrit directement
     dans le HTML servi par le serveur -- aucun appel reseau
     supplementaire, aucun JavaScript a executer. On lit donc la page
     telle qu'un navigateur la recoit.

     Sa structure, verifiee sur la page reelle : deux colonnes en
     vis-a-vis. A gauche, des lignes "table-line--ranking-fixed" qui
     portent le rang et le logo ; a droite, des lignes
     "table-line--ranking-scrollable" qui portent le nom du club puis
     les chiffres, dans l'ordre annonce par la ligne d'en-tete
     "table-line--full-ranking-heading" (Pts, M, G, N, P, Bonus, Pts M.,
     Pts E., Diff...).

     C'est cet EN-TETE qui est lu pour savoir quelle cellule contient
     quoi, et non une position codee en dur : le jour ou la LNR
     intercalera une colonne, les chiffres suivront au lieu de se
     decaler silencieusement d'une case -- le pire des defauts pour un
     classement, puisque rien n'y parait.

     Official source for the TOP 14 and PRO D2, adopted because ESPN
     stopped publishing these competitions (see 1.96.2). The site offers
     no API: the table is written straight into the server-rendered HTML
     -- no extra network call, no JavaScript to run. Its structure,
     checked against the real page: ranks and logos on the left
     ("ranking-fixed" lines), club name then figures on the right
     ("ranking-scrollable" lines), in the order announced by the
     "full-ranking-heading" row. That HEADER is what is read to know
     which cell holds what, rather than hard-coded positions: the day
     the LNR inserts a column, the figures follow instead of silently
     shifting by one -- the worst kind of defect for a table, since
     nothing looks wrong. */
  const LNR_SITES = {
    "top14": { url: "https://top14.lnr.fr/classement", name: "TOP 14" },
    "prod2": { url: "https://prod2.lnr.fr/classement", name: "PRO D2" }
  };

  // Libelles de la LNR -> colonnes de la tuile. Les colonnes non citees
  // (Bonus, Pts M., Pts E., etat de forme, prochain match) sont ignorees.
  // LNR labels -> tile columns. Columns not listed here are ignored.
  const LNR_COLUMNS = { "Pts": "PTS", "M": "GP", "G": "W", "N": "D", "P": "L", "Diff": "DIFF" };

  function textOf(node) {
    return (node && node.textContent ? node.textContent : "").replace(/\s+/g, " ").trim();
  }

  function parseLnrRanking(html, mode) {
    const Parser = typeof DOMParser !== "undefined" ? DOMParser : null;
    if (!Parser) return null;
    const doc = new Parser().parseFromString(html, "text/html");

    /* Le tableau est place dans un <template> (le site alimente ainsi un
       composant a onglets). Le contenu d'un template est INERTE : il
       n'appartient pas au document et querySelector sur le document ne
       le voit pas. Il faut donc chercher aussi dans le fragment
       .content de chaque template -- sans quoi la page semble ne
       contenir aucun classement alors qu'il y est bel et bien.
       The table sits inside a <template> (that is how the site feeds its
       tab component). A template's content is INERT: it does not belong
       to the document, and querySelector on the document cannot see it.
       So the .content fragment of every template must be searched too --
       without which the page looks as if it held no table at all, while
       it does. */
    const roots = [doc];
    Array.from(doc.querySelectorAll("template")).forEach((t) => {
      if (t.content) roots.push(t.content);
    });
    const findAll = (sel) => {
      for (const root of roots) {
        const found = Array.from(root.querySelectorAll(sel));
        if (found.length) return found;
      }
      return [];
    };

    // Ordre des colonnes, lu dans la ligne d'en-tete.
    const head = findAll(".table-line--full-ranking-heading")[0];
    if (!head) return null;
    const labels = Array.from(head.querySelectorAll(".ranking__head")).map(textOf);

    const lines = findAll(".table-line--ranking-scrollable");
    if (!lines.length) return null;

    const wanted = mode === "full" ? ["GP", "W", "D", "L", "DIFF", "PTS"] : ["W", "D", "L", "PTS"];
    // Position de chaque colonne voulue parmi les cellules chiffrees.
    const index = {};
    labels.forEach((lab, i) => {
      const key = LNR_COLUMNS[lab];
      if (key && index[key] === undefined) index[key] = i;
    });
    const cols = COLUMN_ORDER.filter((k) => wanted.indexOf(k) >= 0 && index[k] !== undefined);

    const rows = lines.map((line, i) => {
      const cells = Array.from(line.querySelectorAll(".table-line__cell-wrapper--small")).map(textOf);
      const link = line.querySelector(".table-line__cell-wrapper--club-name a");
      return {
        rank: i + 1,
        team: textOf(link) || textOf(line.querySelector(".table-line__cell-wrapper--club-name")),
        sub: "",
        values: cols.map((k) => (cells[index[k]] !== undefined ? cells[index[k]] : "\u2014"))
      };
    }).filter((r) => r.team);

    if (!rows.length) return null;
    return { cols, rows, note: lnrSeasonNote(doc) };
  }

  /* Saison et journee, tirees du titre de la page ("Classement TOP 14
     2026-2027 | J1 | ..."). Affichees sous le tableau : sur un
     classement, savoir de quelle journee il date vaut mieux que de le
     supposer a jour.
     Season and matchday, taken from the page title. Shown under the
     table: on a standings table, knowing which matchday it reflects
     beats assuming it is current. */
  function lnrSeasonNote(doc) {
    const title = doc.querySelector("title");
    const t = textOf(title);
    const season = (t.match(/(\d{4}-\d{4})/) || [])[1];
    const day = (t.match(/\|\s*(J\d+)\s*\|/) || [])[1];
    if (!season) return "";
    return season + (day ? " \u2014 " + day : "");
  }

  async function loadLnr(ctx, comp, mode) {
    const site = LNR_SITES[comp] || LNR_SITES.top14;
    const parsed = parseLnrRanking(await fetchText(ctx, site.url), mode);
    if (!parsed) throw new Error("lnr: classement introuvable dans la page");
    const note = parsed.note
      ? (ctx.i18n ? ctx.i18n.t("standings.lnrNote").replace("{season}", parsed.note) : parsed.note)
      : "";
    return [{ name: "", cols: parsed.cols, rows: parsed.rows, note }];
  }

  /* ---------- Saison a demander a ESPN ----------
     Deux corrections d'un coup, apres verification sur l'API reelle :

     1. L'HOTE. Le parametre `season` n'est honore que par
        site.web.api.espn.com. Sur site.api.espn.com -- l'hote utilise
        jusqu'ici -- il est purement ignore : la reponse reste celle de la
        derniere saison close. C'est pour cela que le Top 14 affichait
        encore la saison precedente MALGRE la correction precedente.

     2. LA DEDUCTION. Deviner l'annee de saison a partir du mois etait de
        toute facon fragile. La reponse d'ESPN porte un tableau
        `seasons[]`, chaque entree donnant `year`, `startDate`, `endDate`
        et `hasStandings`. La saison en cours est donc LUE, pas devinee :
        c'est celle dont l'intervalle contient aujourd'hui. Plus de mois
        de bascule, plus de liste de championnats en annee civile, plus
        rien a maintenir quand une competition change de calendrier.

     Two fixes at once, after checking against the real API:
     1. THE HOST. The `season` parameter is only honoured by
        site.web.api.espn.com. On site.api.espn.com -- the host used until
        now -- it is simply ignored: the answer stays the last closed
        season. That is why the Top 14 still showed the previous season
        DESPITE the earlier fix.
     2. THE DEDUCTION. Guessing the season year from the month was
        fragile anyway. ESPN's answer carries a `seasons[]` array, each
        entry giving `year`, `startDate`, `endDate` and `hasStandings`.
        The current season is therefore READ, not guessed: the one whose
        interval contains today. No switch month, no list of
        calendar-year leagues, nothing to maintain when a competition
        changes its calendar. */

  /* Saison en cours d'apres le catalogue renvoye par ESPN, ou null si le
     catalogue est absent ou ne couvre pas aujourd'hui.
     Current season from the catalogue ESPN returns, or null if the
     catalogue is missing or does not cover today. */
  function currentSeasonYear(data, now) {
    const list = (data && Array.isArray(data.seasons)) ? data.seasons : [];
    const t = (now || new Date()).getTime();
    for (const s of list) {
      const start = Date.parse(s.startDate);
      const end = Date.parse(s.endDate);
      if (!isFinite(start) || !isFinite(end)) continue;
      if (t >= start && t < end && s.hasStandings !== false) return s.year;
    }
    return null;
  }

  /* Fin de la saison servie, d'apres le catalogue. Sert a savoir si le
     classement affiche appartient a une saison DEJA TERMINEE.
     End of the served season, per the catalogue. Used to know whether
     the displayed table belongs to an ALREADY FINISHED season. */
  function servedSeasonEnd(data, year) {
    const list = (data && Array.isArray(data.seasons)) ? data.seasons : [];
    for (const s of list) {
      if (s.year === year) {
        const end = Date.parse(s.endDate);
        return isFinite(end) ? end : null;
      }
    }
    return null;
  }

  /* Saison effectivement servie dans une reponse, pour savoir s'il faut
     en redemander une autre. Season actually served in a response, to
     know whether another one must be asked for. */
  function servedSeasonYear(data) {
    if (!data) return null;
    if (data.season && typeof data.season.year === "number") return data.season.year;
    const kids = Array.isArray(data.children) ? data.children : [];
    for (const c of kids) {
      if (c && c.standings && typeof c.standings.season === "number") return c.standings.season;
    }
    return null;
  }

  /* --- Sports collectifs (ESPN) / team sports (ESPN) --- */
  async function loadEspn(ctx, raw, mode) {
    const [sport, league] = raw.includes(":") ? raw.split(":") : ["soccer", raw];
    const base = `https://site.web.api.espn.com/apis/v2/sports/${sport}/${league}/standings`;

    /* Premier appel sans parametre : il sert un classement (celui de la
       derniere saison close, le plus souvent) ET le catalogue des
       saisons. Second appel seulement si le catalogue dit qu'une autre
       saison est en cours -- inutile de payer deux requetes le reste de
       l'annee.
       First call without a parameter: it serves a table (the last closed
       season's, most of the time) AND the season catalogue. A second call
       only if the catalogue says another season is under way -- no point
       paying for two requests the rest of the year. */
    let data = await fetchJson(ctx, base);
    const wanted = currentSeasonYear(data, new Date());
    if (wanted != null && wanted !== servedSeasonYear(data)) {
      try {
        const fresh = await fetchJson(ctx, base + "?season=" + wanted);
        if (hasEntries(fresh)) data = fresh;
      } catch (e) {
        // Saison refusee : on garde ce qu'on a plutot que rien.
        // Season refused: we keep what we have rather than nothing.
      }
    }

    // Une ou plusieurs poules/conferences selon la competition
    // One or several groups/conferences depending on the competition
    const groups = Array.isArray(data.children) && data.children.length
      ? data.children.map((c) => ({
          name: c.name || c.abbreviation || "",
          entries: (c.standings && c.standings.entries) || []
        }))
      : [{ name: "", entries: (data.standings && data.standings.entries) || [] }];

    /* Garde-fou de fraicheur. Certaines competitions ont ete abandonnees
       par ESPN sans que rien ne le signale : la reponse reste valide et
       complete, mais elle date d'une saison close depuis des annees. Le
       Top 14 (identifiant 270559) en est l'exemple : ESPN n'y publie
       plus rien depuis 2022-23, et la tuile affichait ce vieux tableau
       comme s'il etait celui du jour.

       Il n'y a rien a reparer cote code -- la donnee n'existe pas -- mais
       une tuile qui se tait est pire qu'une tuile qui previent. On
       annonce donc la saison sous le tableau des qu'elle est close.

       Freshness guard. Some competitions have been abandoned by ESPN
       with nothing to signal it: the answer stays valid and complete,
       but comes from a season closed years ago. The Top 14 (id 270559)
       is the example: ESPN has published nothing there since 2022-23,
       and the tile showed that old table as if it were today's. There
       is nothing to fix in the code -- the data does not exist -- but a
       silent tile is worse than one that warns. So we announce the
       season under the table as soon as it is closed. */
    const served = servedSeasonYear(data);
    const end = served != null ? servedSeasonEnd(data, served) : null;
    const stale = end != null && end < Date.now();
    const staleNote = stale && ctx.i18n
      ? ctx.i18n.t("standings.staleSeason").replace("{season}", served + "-" + String(served + 1).slice(2))
      : "";

    return groups.filter((g) => g.entries.length).map((g, gi) => {
      const cols = pickColumns(g.entries, mode);
      return {
        name: g.name,
        note: gi === 0 ? staleNote : "",
        cols,
        rows: g.entries.map((e, idx) => {
          const rankStat = (e.stats || []).find(
            (x) => String(x.abbreviation || x.name || "").toLowerCase() === "rank"
          );
          return {
            rank: rankStat ? rankStat.value : idx + 1,
            team: e.team ? (e.team.shortDisplayName || e.team.displayName || e.team.name) : "?",
            sub: "",
            values: cols.map((c) => statValue(e, c))
          };
        })
      };
    });
  }

  /* Vrai si la reponse d'ESPN contient au moins une equipe classee : une
     saison demandee trop tot renvoie une structure valide mais vide, ce
     qui doit compter comme un echec et non comme un classement vide.
     True if ESPN's answer holds at least one ranked team: a season asked
     for too early returns a valid but empty structure, which must count
     as a failure rather than as an empty table. */
  function hasEntries(data) {
    if (!data) return false;
    if (Array.isArray(data.children)) {
      for (const c of data.children) {
        if (c && c.standings && (c.standings.entries || []).length) return true;
      }
    }
    return !!(data.standings && (data.standings.entries || []).length);
  }

  /* --- Formule 1 (Jolpica / Ergast) ---
     Les classements pilotes et constructeurs sont deux points d'entree
     distincts, de structure identique a un nom de tableau pres.
     Driver and constructor standings are two distinct endpoints, with
     identical structure apart from one table name. */
  async function loadF1(ctx, kind, i18n) {
    const year = new Date().getFullYear();
    const path = kind === "constructors" ? "constructorStandings" : "driverStandings";
    const data = await fetchJson(ctx, `https://api.jolpi.ca/ergast/f1/${year}/${path}.json?limit=100`);
    const lists = ((data.MRData || {}).StandingsTable || {}).StandingsLists || [];
    // En debut d'annee civile, la saison en cours n'a pas encore de
    // classement : on retombe alors sur la saison precedente plutot que
    // d'afficher une erreur. At the turn of the calendar year the
    // current season has no standings yet: we fall back to the previous
    // season rather than showing an error.
    if (!lists.length) {
      const prev = await fetchJson(ctx, `https://api.jolpi.ca/ergast/f1/${year - 1}/${path}.json?limit=100`);
      const prevLists = ((prev.MRData || {}).StandingsTable || {}).StandingsLists || [];
      if (!prevLists.length) throw new Error("no f1 standings");
      return [f1Group(prevLists[0], kind, year - 1, i18n)];
    }
    return [f1Group(lists[0], kind, year, i18n)];
  }

  function f1Group(list, kind, year, i18n) {
    const isTeams = kind === "constructors";
    const entries = isTeams ? (list.ConstructorStandings || []) : (list.DriverStandings || []);
    const label = isTeams ? i18n.t("standings.f1Constructors") : i18n.t("standings.f1Drivers");
    return {
      name: `${label} ${year}`,
      cols: ["WINS", "PTS"],
      rows: entries.map((e, idx) => {
        const name = isTeams
          ? (e.Constructor || {}).name || "?"
          : [(e.Driver || {}).givenName, (e.Driver || {}).familyName].filter(Boolean).join(" ") || "?";
        // Pour un pilote, l'ecurie en second plan : c'est l'information
        // qu'on cherche juste apres le nom. For a driver, the team as
        // secondary info: it's what one looks for right after the name.
        const sub = !isTeams && Array.isArray(e.Constructors) && e.Constructors.length
          ? e.Constructors[e.Constructors.length - 1].name
          : "";
        return {
          rank: e.position != null ? e.position : idx + 1,
          team: name,
          sub,
          values: [e.wins != null ? e.wins : "—", e.points != null ? e.points : "—"]
        };
      })
    };
  }

  function riderName(entry) {
    const r = entry.rider || {};
    if (r.full_name) return r.full_name;
    const parts = [r.name, r.surname].filter(Boolean);
    return parts.length ? parts.join(" ") : "?";
  }

  /* --- MotoGP (pulselive) ---
     Le classement exige deux identifiants prealables : l'UUID de la
     saison, puis l'UUID de la categorie (MotoGP / Moto2 / Moto3) au
     sein de cette saison. Trois appels en cascade, comme le fait
     motogp.com lui-meme.
     Standings require two identifiers first: the season UUID, then the
     category UUID (MotoGP / Moto2 / Moto3) within that season. Three
     cascading calls, exactly as motogp.com itself does. */
  async function loadMotoGp(ctx, kind, i18n) {
    const base = "https://api.motogp.pulselive.com/motogp/v1/results";
    const seasons = await fetchJson(ctx, `${base}/seasons`);
    if (!Array.isArray(seasons) || !seasons.length) throw new Error("no motogp seasons");
    const season = seasons.find((s) => s.current) || seasons[0];

    const categories = await fetchJson(ctx, `${base}/categories?seasonUuid=${encodeURIComponent(season.id)}`);
    if (!Array.isArray(categories) || !categories.length) throw new Error("no motogp categories");
    const cat = categories.find((c) => /^motogp$/i.test(String(c.name || "").trim())) || categories[0];

    const data = await fetchJson(
      ctx,
      `${base}/standings?seasonUuid=${encodeURIComponent(season.id)}&categoryUuid=${encodeURIComponent(cat.id)}`
    );
    const classification = data.classification || [];
    if (!classification.length) throw new Error("no motogp classification");

    const year = season.year || new Date().getFullYear();
    if (kind !== "teams") {
      return [{
        name: `${i18n.t("standings.motogpRiders")} ${year}`,
        cols: ["PTS"],
        rows: classification.map((e, idx) => ({
          rank: e.position != null ? e.position : idx + 1,
          team: riderName(e),
          sub: (e.team && e.team.name) || (e.constructor && e.constructor.name) || "",
          values: [e.points != null ? e.points : "—"]
        }))
      }];
    }

    /* Classement equipes : le flux public expose le classement pilotes,
       pas celui des equipes. On l'obtient donc par agregation des points
       des pilotes de chaque equipe. C'est bien un CALCUL et non une
       donnee officielle — la mention l'indique sur la tuile. Le total
       coincide avec le classement officiel des equipes tant qu'une
       ecurie n'aligne que ses deux pilotes titulaires ; un remplacant ou
       une wild card peut introduire un ecart.
       Team standings: the public feed exposes the rider standings, not
       the team one. We therefore derive it by aggregating each team's
       riders' points. This is a COMPUTATION, not official data — the
       note says so on the tile. The total matches the official team
       standings as long as a team fields only its two regular riders; a
       stand-in or wild card can introduce a discrepancy. */
    const byTeam = new Map();
    for (const e of classification) {
      const team = (e.team && e.team.name) || (e.constructor && e.constructor.name) || "?";
      const pts = Number(e.points) || 0;
      byTeam.set(team, (byTeam.get(team) || 0) + pts);
    }
    const rows = [...byTeam.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([team, pts], idx) => ({ rank: idx + 1, team, sub: "", values: [pts] }));
    return [{
      name: `${i18n.t("standings.motogpTeams")} ${year}`,
      cols: ["PTS"],
      rows,
      note: i18n.t("standings.computedTeams")
    }];
  }

  class StandingsWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-standings"><div class="pws-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      await this.refresh();
      this.arm();
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(5, Number(this.ctx.settings.refresh) || 30);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.refresh(); }

    async refresh() {
      const el = this.ctx.el;
      const s = this.ctx.settings;
      const i18n = this.ctx.i18n;
      const labels = LABELS[i18n.lang] || LABELS.en;
      try {
        // Le code personnalise, si rempli, prend le pas sur la liste
        // deroulante : c'est la porte de sortie pour toute competition
        // absente de la liste (ex. NFL, NHL...). Il ne vaut que pour
        // ESPN, les sources mecaniques n'ayant pas de code equivalent.
        // The custom code, if filled, overrides the dropdown: it's the
        // escape hatch for any competition missing from the list (e.g.
        // NFL, NHL...). It applies to ESPN only, the motorsport sources
        // having no equivalent code.
        const custom = (s.customLeague || "").trim();
        let raw = custom || s.league || "soccer:fra.1";
        /* Les tuiles deja en place pointent sur l'ancien identifiant ESPN
           du Top 14, que la source n'alimente plus depuis 2022-23 : on
           les bascule sur la LNR sans rien demander a l'utilisateur.
           Une tuile qu'il faut reconfigurer soi-meme apres une mise a
           jour n'est pas une tuile reparee.
           Existing tiles point at the old ESPN id for the Top 14, which
           the source has not fed since 2022-23: they are switched to the
           LNR without asking. A tile the user must reconfigure himself
           after an update is not a fixed tile. */
        if (raw === "rugby:270559") raw = "lnr:top14";

        let groups;
        if (!custom && raw.startsWith("lnr:")) groups = await loadLnr(this.ctx, raw.slice(4), s.columns === "full" ? "full" : "essential");
        else if (!custom && raw.startsWith("f1:")) groups = await loadF1(this.ctx, raw.slice(3), i18n);
        else if (!custom && raw.startsWith("motogp:")) groups = await loadMotoGp(this.ctx, raw.slice(7), i18n);
        else groups = await loadEspn(this.ctx, raw, s.columns === "full" ? "full" : "essential");

        const filter = (s.highlightTeam || "").trim().toLowerCase();
        const maxRows = Math.max(3, Number(s.maxRows) || 10);

        const blocks = groups.filter((g) => g.rows && g.rows.length).map((g) => {
          const rows = g.rows.slice(0, maxRows);
          // L'en-tete doit avoir AUTANT de cellules que les lignes du
          // corps. Chaque ligne commence par DEUX cellules (rang + nom) ;
          // l'en-tete n'en avait qu'une seule (nom), ce qui decalait tous
          // les libelles de colonnes (G, N, P, %V) d'une case vers la
          // gauche -- ils se retrouvaient au-dessus de la mauvaise
          // colonne. On ajoute donc la cellule vide du rang en tete.
          // The header must have AS MANY cells as the body rows. Each row
          // starts with TWO cells (rank + name); the header had only one
          // (name), which shifted every column label one cell to the
          // left -- landing above the wrong column. So we add the empty
          // rank cell at the front.
          const head = `<tr><th class="pws-rank"></th><th class="pws-col-team"></th>${
            g.cols.map((c) => `<th class="pws-stat">${escapeHtml(labels[c] || c)}</th>`).join("")
          }</tr>`;
          const body = rows.map((r) => {
            const isHi = filter && String(r.team).toLowerCase().includes(filter);
            const sub = r.sub ? `<span class="pws-sub">${escapeHtml(r.sub)}</span>` : "";
            return `
              <tr class="${isHi ? "pws-highlight" : ""}">
                <td class="pws-rank">${escapeHtml(r.rank)}</td>
                <td class="pws-col-team">${escapeHtml(r.team)}${sub}</td>
                ${g.cols.map((c, i) => `<td class="pws-stat ${c === "PTS" ? "pws-pts" : ""}">${escapeHtml(r.values[i])}</td>`).join("")}
              </tr>`;
          }).join("");
          return `
            ${g.name ? `<div class="pws-group">${escapeHtml(g.name)}</div>` : ""}
            <table><thead>${head}</thead><tbody>${body}</tbody></table>
            ${g.note ? `<div class="pws-note">${escapeHtml(g.note)}</div>` : ""}`;
        }).join("");

        /* Les tableaux vivent dans un conteneur defilant : une tuile
           courte ne peut pas montrer 36 equipes de Ligue des champions,
           et rogner silencieusement le bas du classement serait pire que
           de le faire defiler. La tuile elle-meme reste sans
           debordement, c'est ce conteneur seul qui defile.
           The tables live in a scrolling container: a short tile cannot
           show 36 Champions League teams, and silently clipping the
           bottom of the table would be worse than letting it scroll. The
           tile itself stays overflow-free, only this container scrolls. */
        el.innerHTML = blocks
          ? `<div class="pw-standings"><div class="pws-scroll">${blocks}</div></div>`
          : `<div class="pw-standings"><div class="pws-err">${i18n.t("standings.error")}</div></div>`;
      } catch (e) {
        console.warn("[piboard/standings]", e);
        el.innerHTML = `<div class="pw-standings"><div class="pws-err">${i18n.t("standings.error")}</div></div>`;
      }
    }

    destroy() {
      clearInterval(this.timer);
    }
  }

  /* Exposition des fonctions pures pour test/standingsColumns.test.js :
     le navigateur n'a pas de module system ici, et ces fonctions sont
     precisement celles ou le bug se logeait.
     Pure functions exposed for test/standingsColumns.test.js: there is
     no module system in the browser here, and these functions are
     exactly where the bug was hiding. */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseLnrRanking, lnrSeasonNote, LNR_SITES, servedSeasonEnd, canonicalKey, pickColumns, formatPercentStat, statValue, COLUMN_ORDER, MAX_STAT_COLUMNS, ESSENTIAL_COLUMNS, currentSeasonYear, servedSeasonYear, hasEntries, loadEspn };
  } else {
    window.PiBoard.registerWidget("standings", StandingsWidget);
  }
})();
