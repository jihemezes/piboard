/* PiBoard widget: quote / citation du jour
   Bibliotheque locale embarquee : fonctionne hors-ligne, aucune requete
   externe, aucune limite de frequence. Rotation quotidienne (deterministe,
   la meme citation toute la journee) ou minutee (tirage aleatoire).
   Bundled local library: works fully offline, no external request, no
   rate limit. Daily rotation (deterministic, same quote all day) or
   timed rotation (random pick). */
(function () {
  "use strict";

  let QUOTES = null;
  let loadPromise = null;

  function loadQuotes(dir) {
    if (loadPromise) return loadPromise;
    loadPromise = fetch("widgets/" + dir + "/quotes.json").then((r) => r.json()).then((data) => {
      QUOTES = data;
      return data;
    });
    return loadPromise;
  }

  /* Hash simple et stable pour choisir une citation "du jour"
     Simple stable hash to pick a deterministic "quote of the day" */
  function dayIndex(dateStr, length) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    return h % length;
  }

  class QuoteWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.dayTimer = null;
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-quote"></div>`;
      await loadQuotes(this.ctx.manifest.dir);
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.ctx.el);
      this.render();
      this.arm();
    }

    pick() {
      if (this.ctx.settings.mode === "interval") {
        return QUOTES[Math.floor(Math.random() * QUOTES.length)];
      }
      const today = new Date().toISOString().slice(0, 10);
      return QUOTES[dayIndex(today, QUOTES.length)];
    }

    render() {
      if (!QUOTES || !QUOTES.length) return;
      const s = this.ctx.settings;
      const q = this.pick();
      const text = this.ctx.i18n.lang === "fr" ? q.fr : q.en;
      this.ctx.el.querySelector(".pw-quote").innerHTML = `
        <div class="pwq-text">${text}</div>
        ${s.showAuthor ? `<div class="pwq-author">${q.author}</div>` : ""}`;
      this.fit();
    }

    fit() {
      const box = this.ctx.el.querySelector(".pw-quote");
      if (!box) return;
      const text = box.querySelector(".pwq-text");
      const author = box.querySelector(".pwq-author");
      if (!text) return;

      // Recherche dichotomique de la plus grande taille qui tient en
      // hauteur (le texte est en retour a la ligne, donc seule la hauteur
      // deborde). Le plafond combine hauteur ET largeur : sur une tuile
      // agrandie, l'ancien plafond (34 % de la hauteur seule) restait
      // parfois tres bas pour une tuile large et basse, d'ou des
      // citations minuscules dans un grand espace.
      // Binary search for the largest size that fits vertically (text
      // wraps, so only height can overflow). The cap combines height AND
      // width: on an enlarged tile, the old cap (34% of height alone)
      // could stay very low for a wide, short tile, hence tiny quotes in
      // a big space.
      const w = box.clientWidth || 100;
      const h = box.clientHeight || 100;
      let lo = 9, hi = Math.max(12, Math.floor(Math.max(h * 0.34, Math.min(w * 0.12, h * 0.6))));
      for (let i = 0; i < 8; i++) {
        const mid = Math.floor((lo + hi + 1) / 2);
        text.style.fontSize = mid + "px";
        if (author) author.style.fontSize = Math.max(9, Math.round(mid * 0.42)) + "px";
        if (box.scrollHeight <= box.clientHeight + 1) lo = mid;
        else hi = mid - 1;
      }

      // Reglage manuel "Taille du texte" de la tuile (50 % a 200 %,
      // section Apparence) : multiplicateur applique par-dessus la
      // taille automatique ci-dessus. Reduire (ex. 50-80 %) laisse
      // volontairement de la marge sous le maximum calcule -- utile pour
      // une citation longue ou un nom d'auteur long, la ou l'auto-fit
      // seul allait pile au maximum sans coussin de securite.
      // Manual tile "Text size" setting (50% to 200%, Appearance
      // section): multiplier applied on top of the automatic size
      // above. Reducing it (e.g. 50-80%) voluntarily leaves margin below
      // the computed maximum -- useful for a long quote or a long author
      // name, where auto-fit alone landed right at the max with no
      // safety cushion.
      const scale = Number(this.ctx.settings._textScale) || 1;
      text.style.fontSize = Math.max(6, Math.round(lo * scale)) + "px";
      if (author) author.style.fontSize = Math.max(6, Math.round(lo * 0.42 * scale)) + "px";

      // Gridstack anime le redimensionnement : la derniere mesure peut
      // avoir eu lieu sur une taille intermediaire. Une re-passe apres
      // stabilisation garantit la taille finale correcte.
      // Gridstack animates resizing: the last measurement may have
      // happened on an intermediate size. A re-pass after things settle
      // guarantees the correct final size.
      clearTimeout(this.refitTimer);
      this.refitTimer = setTimeout(() => {
        const bw = box.clientWidth, bh = box.clientHeight;
        if (bw !== w || bh !== h) this.fit();
      }, 180);
    }

    arm() {
      clearInterval(this.timer);
      clearTimeout(this.dayTimer);
      if (this.ctx.settings.mode === "interval") {
        const minutes = Math.max(1, Number(this.ctx.settings.intervalMinutes) || 30);
        this.timer = setInterval(() => this.render(), minutes * 60000);
      } else {
        // Reprogrammer a minuit pour changer de citation au changement de jour
        // Reschedule at midnight so the quote changes with the calendar day
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
        this.dayTimer = setTimeout(() => { this.render(); this.arm(); }, midnight - now);
      }
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.render();
      this.arm();
    }

    onLangChanged() { this.render(); }

    destroy() {
      clearInterval(this.timer);
      clearTimeout(this.dayTimer);
      clearTimeout(this.refitTimer);
      if (this.observer) this.observer.disconnect();
    }
  }

  window.PiBoard.registerWidget("quote", QuoteWidget);
})();
