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
  function pickColumns(entries) {
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

  /* --- Sports collectifs (ESPN) / team sports (ESPN) --- */
  async function loadEspn(ctx, raw) {
    const [sport, league] = raw.includes(":") ? raw.split(":") : ["soccer", raw];
    const url = `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`;
    const data = await fetchJson(ctx, url);

    // Une ou plusieurs poules/conferences selon la competition
    // One or several groups/conferences depending on the competition
    const groups = Array.isArray(data.children) && data.children.length
      ? data.children.map((c) => ({
          name: c.name || c.abbreviation || "",
          entries: (c.standings && c.standings.entries) || []
        }))
      : [{ name: "", entries: (data.standings && data.standings.entries) || [] }];

    return groups.filter((g) => g.entries.length).map((g) => {
      const cols = pickColumns(g.entries);
      return {
        name: g.name,
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
        const raw = custom || s.league || "soccer:fra.1";

        let groups;
        if (!custom && raw.startsWith("f1:")) groups = await loadF1(this.ctx, raw.slice(3), i18n);
        else if (!custom && raw.startsWith("motogp:")) groups = await loadMotoGp(this.ctx, raw.slice(7), i18n);
        else groups = await loadEspn(this.ctx, raw);

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

        el.innerHTML = blocks
          ? `<div class="pw-standings">${blocks}</div>`
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
    module.exports = { canonicalKey, pickColumns, formatPercentStat, statValue, COLUMN_ORDER, MAX_STAT_COLUMNS };
  } else {
    window.PiBoard.registerWidget("standings", StandingsWidget);
  }
})();
