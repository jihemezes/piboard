/* ============================================================
   PiBoard - public/chart-time-axis.js
   Axe des abscisses temporel, partage par TOUS les graphiques du
   tableau (Etat systeme, Cryptos, Bourse, Sante Internet...).

   POURQUOI UN MODULE COMMUN : chaque widget tracait sa courbe sans la
   moindre indication de temps. On voyait un creux, sans pouvoir dire
   s'il datait de dix minutes ou de six heures. Ecrire l'axe quatre fois
   aurait donne quatre facons differentes d'arrondir les heures et quatre
   formats de date ; ici la regle est unique et testee une fois.

   DEUX PRINCIPES :

   1. Les graduations tombent sur des instants RONDS (une heure pile, un
      quart d'heure, minuit), jamais sur des divisions egales de la
      periode affichee. Diviser en cinq une fenetre de 47 minutes
      donnerait "14:03, 14:12, 14:21..." -- illisible. On choisit donc un
      pas dans une echelle de pas usuels (1, 2, 5, 10, 15, 30 min ;
      1, 2, 3, 6, 12 h ; 1, 2, 7 j ; 1 mois) et on aligne sur ce pas.

   2. Les etiquettes sont posees en HTML SOUS le graphique, pas dans le
      SVG. Tous les graphiques de PiBoard utilisent
      `preserveAspectRatio="none"` : le SVG est etire horizontalement
      pour remplir la tuile ou la fenetre, ce qui etirerait aussi le
      texte -- d'autant plus que la fenetre est large. Les traits
      verticaux, eux, restent dans le SVG : une ligne verticale etiree
      reste une ligne verticale.

   Le format s'adapte a l'etendue affichee : heures et minutes en deca
   d'une journee, jour de la semaine au-dela, date au-dela d'une semaine,
   mois et annee au-dela d'un an. Toujours dans la langue courante du
   tableau, via Intl.

   Time X axis, shared by ALL the board's charts (System status, Crypto,
   Stocks, Internet health...).

   WHY A COMMON MODULE: every widget drew its curve without any time
   indication. You saw a dip, with no way to tell whether it was ten
   minutes or six hours old. Writing the axis four times would have given
   four different ways of rounding hours and four date formats; here the
   rule is single and tested once.

   TWO PRINCIPLES:

   1. Ticks land on ROUND instants (a whole hour, a quarter, midnight),
      never on equal divisions of the displayed period. Splitting a
      47-minute window into five would give "14:03, 14:12, 14:21..." --
      unreadable. So we pick a step from a ladder of usual steps (1, 2,
      5, 10, 15, 30 min; 1, 2, 3, 6, 12 h; 1, 2, 7 d; 1 month) and align
      on it.

   2. Labels are laid out in HTML BELOW the chart, not inside the SVG.
      Every PiBoard chart uses `preserveAspectRatio="none"`: the SVG is
      stretched horizontally to fill the tile or window, which would
      stretch the text too -- all the more so as the window is wide.
      Vertical lines do stay in the SVG: a stretched vertical line is
      still a vertical line.

   The format adapts to the displayed span: hours and minutes below a
   day, weekday beyond, date beyond a week, month and year beyond a year.
   Always in the board's current language, through Intl.
   ============================================================ */
(function () {
  "use strict";

  const MIN = 60000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  /* Pas usuels, du plus fin au plus grossier. Un mois n'a pas de duree
     fixe : il est traite a part (voir stepTicks).
     Usual steps, finest first. A month has no fixed length: it is
     handled separately (see stepTicks). */
  const STEPS = [
    MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN,
    HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY
  ];

  /* Le plus petit pas qui ne produit pas plus de `maxTicks` graduations.
     The smallest step that yields no more than `maxTicks` ticks. */
  function chooseStep(span, maxTicks) {
    for (const step of STEPS) {
      if (span / step <= maxTicks) return step;
    }
    return null; // au-dela : graduations mensuelles / beyond: monthly ticks
  }

  /* Alignement sur le pas en heure LOCALE, pas en UTC. Un pas de 6 h
     aligne en UTC tomberait a 02:00 et 08:00 dans un fuseau a +2, ce qui
     n'a rien de rond pour qui regarde l'ecran. Le decalage du fuseau est
     donc retire avant l'arrondi puis remis.
     Alignment on the step in LOCAL time, not UTC. A 6 h step aligned in
     UTC would land on 02:00 and 08:00 in a +2 zone, which is not round
     at all for whoever looks at the screen. The zone's offset is
     therefore removed before rounding, then put back. */
  function ceilToStep(t, step) {
    const d = new Date(t);
    const offset = d.getTimezoneOffset() * MIN;
    const local = t - offset;
    return Math.ceil(local / step) * step + offset;
  }

  /* Au-dela de la semaine, on gradue par mois. Un mois n'ayant pas de
     duree fixe, on ne peut pas l'ajouter a l'echelle STEPS : on avance
     de mois en mois avec un PAS en nombre de mois (1, 2, 3, 6, 12, 24)
     choisi pour ne pas depasser `maxTicks`. Sans ce pas, deux ans
     d'historique produisaient vingt-sept etiquettes superposees.
     Beyond a week we tick by month. A month having no fixed length, it
     cannot join the STEPS ladder: we walk month by month with a STRIDE
     in months (1, 2, 3, 6, 12, 24) chosen so as not to exceed
     `maxTicks`. Without that stride, two years of history produced
     twenty-seven overlapping labels. */
  const MONTH_STRIDES = [1, 2, 3, 6, 12, 24];

  function monthTicks(from, to, maxTicks) {
    const months = Math.max(1, Math.round((to - from) / (30 * DAY)));
    const stride = MONTH_STRIDES.find((n) => months / n <= maxTicks) || 24;
    const out = [];
    const d = new Date(from);
    d.setDate(1); d.setHours(0, 0, 0, 0);
    if (d.getTime() < from) d.setMonth(d.getMonth() + 1);
    // Depart aligne sur le pas : avec un pas de 3 mois, on veut janvier,
    // avril, juillet, octobre -- pas trois mois apres un debut arbitraire.
    // Start aligned on the stride: with a 3-month stride we want January,
    // April, July, October -- not three months after an arbitrary start.
    while (d.getMonth() % stride !== 0 && d.getTime() <= to) d.setMonth(d.getMonth() + 1);
    // Borne dure : une periode absurde (une horloge deraillee, une date
    // a zero) ne doit pas boucler indefiniment.
    // Hard cap: an absurd period (a derailed clock, a zero date) must not
    // loop forever.
    while (d.getTime() <= to && out.length < 40) {
      out.push(d.getTime());
      d.setMonth(d.getMonth() + stride);
    }
    return out;
  }

  function stepTicks(from, to, maxTicks) {
    const span = to - from;
    const step = chooseStep(span, maxTicks);
    if (step == null) return { times: monthTicks(from, to, maxTicks), step: null };
    const times = [];
    for (let t = ceilToStep(from, step); t <= to && times.length < 40; t += step) times.push(t);
    return { times, step };
  }

  /* Format choisi d'apres l'ETENDUE affichee, pas d'apres le pas : sur
     une fenetre de 24 h, meme un pas de 6 h merite l'heure seule ; sur un
     an, meme un pas quotidien merite la date.
     Format chosen from the displayed SPAN, not from the step: over a
     24 h window even a 6 h step deserves the bare time; over a year even
     a daily step deserves the date. */
  function formatterFor(span, locale) {
    if (span <= DAY) return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
    if (span <= 7 * DAY) return new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    if (span <= 365 * DAY) return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  }

  /* Graduations pour l'intervalle [from, to].
     Renvoie [{ t, at, label }] ou `at` est la position en fraction de la
     largeur (0 = bord gauche, 1 = bord droit).
     Ticks for the [from, to] interval. Returns [{ t, at, label }] where
     `at` is the position as a fraction of the width (0 = left edge,
     1 = right edge). */
  function timeTicks(from, to, options) {
    const opts = options || {};
    const maxTicks = Math.max(2, opts.maxTicks || 6);
    const locale = opts.locale || "fr-FR";
    from = Number(from); to = Number(to);
    // Une periode nulle, inversee ou non numerique n'est pas une erreur a
    // signaler : c'est un graphique qui n'a pas encore de quoi tracer.
    // A zero, inverted or non-numeric period is not an error to report:
    // it is a chart with nothing to draw yet.
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
    const span = to - from;
    const fmt = formatterFor(span, locale);
    const { times } = stepTicks(from, to, maxTicks);
    return times.map((t) => ({ t, at: (t - from) / span, label: fmt.format(new Date(t)) }));
  }

  /* Traits verticaux, a inserer dans le SVG du graphique. `x0` et `x1`
     bornent la zone tracee dans le repere du viewBox (les graphiques a
     axe des ordonnees ont une marge a gauche).
     Vertical gridlines, to insert into the chart's SVG. `x0` and `x1`
     bound the plotted area in the viewBox's coordinates (charts with a
     y axis have a left margin). */
  function gridLines(ticks, x0, x1, y0, y1, attrs) {
    const width = x1 - x0;
    return (ticks || []).map((tick) => {
      const x = (x0 + tick.at * width).toFixed(1);
      return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" ${attrs || 'stroke="var(--tile-edge)" stroke-width="1"'}/>`;
    }).join("");
  }

  function escapeText(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Etiquettes HTML. `leftPct` / `rightPct` decrivent les marges du
     graphique en pourcentage de sa largeur, pour que les etiquettes
     tombent exactement sous leur trait quand le SVG reserve une bande a
     l'axe des ordonnees.
     Les etiquettes des deux bords sont recalees vers l'interieur : sans
     cela, une graduation a 0 % ou 100 % deborderait du cadre, a moitie
     coupee.
     HTML labels. `leftPct` / `rightPct` describe the chart's margins as
     a percentage of its width, so labels land exactly under their line
     when the SVG reserves a band for the y axis.
     Edge labels are pulled inwards: without that, a tick at 0% or 100%
     would overflow the frame, half cut off. */
  function axisHtml(ticks, leftPct, rightPct) {
    const left = Number(leftPct) || 0;
    const right = Number(rightPct) || 0;
    const usable = 100 - left - right;
    return (ticks || []).map((tick) => {
      const pos = left + tick.at * usable;
      /* Le recalage se decide sur la position DANS la zone tracee
         (`tick.at`), pas sur la position absolue : avec une marge gauche
         de 10 % pour l'axe des ordonnees, une graduation au tout debut
         de la courbe est a 10 % de la largeur totale mais bien au bord
         de ce qu'elle etiquette, et doit donc etre calee, pas centree.
         The pull-in is decided from the position WITHIN the plotted area
         (`tick.at`), not the absolute position: with a 10% left margin
         for the y axis, a tick at the very start of the curve sits at
         10% of the total width yet right at the edge of what it labels,
         so it must be pulled in, not centred. */
      let transform = "translateX(-50%)";
      if (tick.at <= 0.02 || pos < 4) transform = "translateX(0)";
      else if (tick.at >= 0.98 || pos > 96) transform = "translateX(-100%)";
      return `<span class="pb-taxis-tick" style="left:${pos.toFixed(2)}%;transform:${transform}">${escapeText(tick.label)}</span>`;
    }).join("");
  }

  /* Raccourci : pose les traits dans le SVG ET les etiquettes sous lui.
     Convenience: places the lines in the SVG AND the labels below it. */
  function render(opts) {
    const ticks = timeTicks(opts.from, opts.to, opts);
    if (opts.gridEl) {
      opts.gridEl.innerHTML = (opts.keepGrid || "") +
        gridLines(ticks, opts.x0 || 0, opts.x1 || 100, opts.y0 || 0, opts.y1 || 100, opts.lineAttrs);
    }
    if (opts.axisEl) opts.axisEl.innerHTML = axisHtml(ticks, opts.leftPct, opts.rightPct);
    return ticks;
  }

  window.PiBoardTimeAxis = { timeTicks, gridLines, axisHtml, render, STEPS };
})();
