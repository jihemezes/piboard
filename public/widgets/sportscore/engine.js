/* ============================================================
   PiBoard widget sportscore - engine.js
   Choix et mise en ordre des matchs de la tuile Scores (1.113.4).
   Module PUR : ni DOM ni reseau, charge par la tuile
   (window.PiBoardSportEngine) et par les tests Node (module.exports).

   CE QU'IL FAIT
   - Fenetre de dates : ESPN, interroge sans parametre, ne renvoie
     qu'UNE journee, la sienne (fuseau americain). Un match joue hier
     soir en France disparaissait donc du tableau des que la journee
     ESPN changeait, en laissant a l'ecran la derniere reponse connue --
     c'est-a-dire l'heure de coup d'envoi sans le score (1.113.4). La
     tuile demande maintenant explicitement une fenetre autour du jour
     courant.
   - Mise en ordre : en direct d'abord, puis les matchs recemment
     termines (score encore frais), puis les prochains, puis les plus
     anciens.
   - Qui recoit : le club qui recoit est en HAUT, celui qui se deplace
     en BAS. ESPN donne « homeAway » ; quand il manque, on garde son
     ordre d'origine plutot que d'inventer.

   What it does: date window (ESPN's bare scoreboard only returns its
   OWN single day, so a match played yesterday evening in France fell
   off the board), ranking (live, then recently finished, then
   upcoming), and home/away ordering with the host on top.
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PiBoardSportEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY = 86400000;

  /* Date au format attendu par ESPN (AAAAMMJJ), en heure locale : c'est
     la journee telle que la voit l'utilisateur.
     Date in ESPN's format, in local time. */
  function yyyymmdd(d) {
    return String(d.getFullYear())
      + String(d.getMonth() + 1).padStart(2, "0")
      + String(d.getDate()).padStart(2, "0");
  }

  /* Fenetre « AAAAMMJJ-AAAAMMJJ ». Deux jours en arriere suffisent pour
     qu'un match du vendredi soir garde son score tout le week-end, et
     une semaine en avant pour annoncer la prochaine journee.
     Window "YYYYMMDD-YYYYMMDD". */
  function dateWindow(now, pastDays, futureDays) {
    const back = pastDays == null ? 2 : Math.max(0, pastDays);
    const fwd = futureDays == null ? 7 : Math.max(0, futureDays);
    return yyyymmdd(new Date(now.getTime() - back * DAY))
      + "-" + yyyymmdd(new Date(now.getTime() + fwd * DAY));
  }

  /* Le club qui recoit et celui qui se deplace. ESPN marque « home » et
     « away » ; si l'information manque (competition sur terrain neutre,
     donnee incomplete), on n'invente pas : le premier reste le premier.
     Host and visitor. If ESPN gives no homeAway, the original order is
     kept rather than guessed. */
  function orderCompetitors(competition) {
    const list = (competition && competition.competitors) || [];
    const home = list.find((c) => c && c.homeAway === "home");
    const away = list.find((c) => c && c.homeAway === "away");
    if (home && away) return { home, away, known: true };
    return { home: list[0] || null, away: list[1] || null, known: false };
  }

  function stateOf(ev) {
    const t = ev && ev.status && ev.status.type;
    return (t && t.state) || "pre";
  }

  function timeOf(ev) {
    const t = ev && ev.date ? Date.parse(ev.date) : NaN;
    return isNaN(t) ? 0 : t;
  }

  /* Rang d'affichage. 0 : en direct. 1 : termine recemment (le score
     interesse encore). 2 : a venir. 3 : termine il y a longtemps.
     Display bucket. */
  function bucket(ev, now, freshHours) {
    const fresh = (freshHours == null ? 36 : freshHours) * 3600000;
    const st = stateOf(ev);
    if (st === "in") return 0;
    if (st === "post") return (now.getTime() - timeOf(ev) <= fresh) ? 1 : 3;
    return 2;
  }

  /* Tri : par rang, puis par date -- les termines du plus recent au plus
     ancien, les autres du plus proche au plus lointain.
     Sort by bucket, then by date. */
  function rank(events, now, freshHours) {
    const ref = now || new Date();
    return (events || []).slice().sort((a, b) => {
      const ba = bucket(a, ref, freshHours), bb = bucket(b, ref, freshHours);
      if (ba !== bb) return ba - bb;
      const desc = ba === 1 || ba === 3;
      return desc ? timeOf(b) - timeOf(a) : timeOf(a) - timeOf(b);
    });
  }

  function matchesFilter(ev, filter) {
    const f = String(filter || "").trim().toLowerCase();
    if (!f) return true;
    const comp = (ev.competitions && ev.competitions[0]) || {};
    return (comp.competitors || []).some((c) => {
      const t = (c && c.team) || {};
      return [t.displayName, t.shortDisplayName, t.name, t.abbreviation, t.location]
        .some((v) => String(v || "").toLowerCase().includes(f));
    });
  }

  /* Ce que la tuile affiche : filtre, mise en ordre, puis coupe.
     What the tile shows. */
  function pick(events, opts) {
    const o = opts || {};
    const max = Math.max(1, Number(o.max) || 5);
    const kept = (events || []).filter((ev) => ev && ev.competitions && ev.competitions[0]
      && matchesFilter(ev, o.filter));
    return rank(kept, o.now, o.freshHours).slice(0, max);
  }

  return { yyyymmdd, dateWindow, orderCompetitors, rank, bucket, matchesFilter, pick, stateOf };
});
