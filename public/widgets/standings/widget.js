/* PiBoard widget: standings / classement
   Utilise l'API JSON non officielle mais publique d'ESPN (aucune cle).
   Le classement vit sous /apis/v2/ (et non /apis/site/v2/ comme les scores) :
   particularite documentee de cette API non officielle.
   Uses ESPN's unofficial but public JSON API (no key). Standings live under
   /apis/v2/ (not /apis/site/v2/ like scores) — a documented quirk of this
   unofficial API. */
(function () {
  "use strict";

  /* Abbreviation ESPN -> libelle court localise
     ESPN abbreviation -> short localized label */
  const LABELS = {
    en: { GP: "P", W: "W", D: "D", L: "L", PTS: "Pts", PCT: "Pct", OTL: "OTL" },
    fr: { GP: "J", W: "G", D: "N", L: "P", PTS: "Pts", PCT: "%V", OTL: "OTL" }
  };
  const PRIORITY = ["PTS", "W", "D", "L", "PCT", "GP"];

  function pickColumns(entries) {
    const sample = entries[0];
    if (!sample || !sample.stats) return [];
    const present = new Set(sample.stats.map((s) => (s.abbreviation || s.name || "").toUpperCase()));
    const cols = PRIORITY.filter((k) => present.has(k));
    return cols.slice(0, 4);
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

  function statValue(entry, abbr) {
    const s = (entry.stats || []).find((x) => (x.abbreviation || x.name || "").toUpperCase() === abbr);
    if (!s) return "—";
    if (abbr === "PCT") return formatPercentStat(s);
    return s.displayValue != null ? s.displayValue : s.value;
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
        // absente de la liste (ex. NFL, NHL...).
        // The custom code, if filled, overrides the dropdown: it's the
        // escape hatch for any competition missing from the list
        // (e.g. NFL, NHL...).
        const raw = (s.customLeague || "").trim() || s.league || "soccer:fra.1";
        const [sport, league] = raw.includes(":") ? raw.split(":") : ["soccer", raw];
        const url = `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`;
        const data = await fetch(this.ctx.api.proxyUrl(url)).then((r) => {
          if (!r.ok) throw new Error("status " + r.status);
          return r.json();
        });

        // Une ou plusieurs poules/conferences selon la competition
        // One or several groups/conferences depending on the competition
        const groups = Array.isArray(data.children) && data.children.length
          ? data.children.map((c) => ({ name: c.name || c.abbreviation || "", entries: c.standings.entries }))
          : [{ name: "", entries: (data.standings && data.standings.entries) || [] }];

        const filter = (s.highlightTeam || "").trim().toLowerCase();
        const maxRows = Math.max(3, Number(s.maxRows) || 10);

        const blocks = groups.filter((g) => g.entries && g.entries.length).map((g) => {
          const entries = g.entries.slice(0, maxRows);
          const cols = pickColumns(entries);
          // L'en-tete doit avoir AUTANT de cellules que les lignes du
          // corps. Chaque ligne commence par DEUX cellules (rang + nom) ;
          // l'en-tete n'en avait qu'une seule (nom), ce qui decalait tous
          // les libelles de colonnes (G, N, P, %V) d'une case vers la
          // gauche -- ils se retrouvaient au-dessus de la mauvaise
          // colonne. On ajoute donc la cellule vide du rang en tete.
          // The header must have AS MANY cells as the body rows. Each row
          // starts with TWO cells (rank + name); the header had only one
          // (name), which shifted every column label (G, N, P, %V) one
          // cell to the left -- landing above the wrong column. So we add
          // the empty rank cell at the front.
          const head = `<tr><th class="pws-rank"></th><th class="pws-col-team"></th>${cols.map((c) => `<th class="pws-stat">${labels[c] || c}</th>`).join("")}</tr>`;
          const rows = entries.map((e, idx) => {
            const name = e.team ? (e.team.shortDisplayName || e.team.displayName || e.team.name) : "?";
            const isHi = filter && name.toLowerCase().includes(filter);
            const rankStat = (e.stats || []).find((x) => (x.abbreviation || x.name || "").toLowerCase() === "rank");
            const rank = rankStat ? rankStat.value : idx + 1;
            return `
              <tr class="${isHi ? "pws-highlight" : ""}">
                <td class="pws-rank">${rank}</td>
                <td class="pws-col-team">${name}</td>
                ${cols.map((c) => `<td class="pws-stat ${c === "PTS" ? "pws-pts" : ""}">${statValue(e, c)}</td>`).join("")}
              </tr>`;
          }).join("");
          return `
            ${g.name ? `<div class="pws-group">${g.name}</div>` : ""}
            <table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
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

  window.PiBoard.registerWidget("standings", StandingsWidget);
})();
