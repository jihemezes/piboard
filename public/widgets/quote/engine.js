/* ============================================================
   PiBoard widget quote - engine.js
   Moteur de tirage de la tuile Citation (1.112.0). Module PUR : ni DOM
   ni reseau, charge par la tuile (window.PiBoardQuoteEngine) et par les
   tests Node (module.exports).

   CE QU'IL FAIT
   - Pools : trois sources cochables (citations, pensees de JCVD,
     blagues Chuck Norris), filtrees par themes pour les citations,
     completees par les citations personnelles ; ou, en mode « favoris
     seulement », un pool unique fait des favoris.
   - Dosage : le reglage de frequence fixe la PART des deux sources
     humoristiques face aux citations. Sans cela, 400 citations
     noieraient 39 perles.
   - Pas de repetition : chaque pool est un paquet melange (melange
     deterministe, graine = tuile + numero de tour). On tire dans
     l'ordre ; le paquet epuise, on en rebat un autre. L'etat tient en
     quelques nombres, memorises par la tuile.
   - Si le contenu d'un pool change (theme coche, citation perso
     ajoutee), son paquet est rebattu : les positions ne correspondent
     plus a rien.

   Quote tile draw engine. PURE module (no DOM, no network), loaded by
   the tile and by Node tests. Pools: three tickable sources, themes
   filter the quotes, custom quotes added; or a single favourites pool.
   The frequency setting sets the SHARE of the two humorous sources
   against the quotes. No repetition: each pool is a shuffled deck
   (deterministic shuffle seeded by tile + round), drawn in order and
   reshuffled once exhausted; the state is a few numbers. A pool whose
   content changed is reshuffled.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PiBoardQuoteEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const THEMES = ["wisdom", "life", "work", "science", "art", "nature", "humor"];
  const POOLS = ["quote", "jcvd", "chuck"];

  /* Part totale des sources humoristiques selon la frequence choisie.
     Total share of the humorous sources for each frequency. */
  const FUN_SHARE = { rare: 0.1, sometimes: 0.25, often: 0.5 };

  function hash(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* Generateur pseudo-aleatoire deterministe (mulberry32).
     Deterministic pseudo-random generator (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(ids, seed) {
    const out = ids.slice().sort();
    const r = rng(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* Citations personnelles : une par ligne, « texte — auteur » (tiret
     long, demi-cadratin ou « -- »), l'auteur etant facultatif.
     Custom quotes: one per line, "text — author", author optional. */
  function parseCustom(text) {
    const out = [];
    const seen = new Set();
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(.*?)\s+(?:—|–|--)\s+(.+)$/);
      const body = (m ? m[1] : line).trim().slice(0, 500);
      const author = m ? m[2].trim().slice(0, 80) : "";
      if (!body || seen.has(body)) continue;
      seen.add(body);
      out.push({
        id: "u-" + hash(body).toString(36),
        cat: "quote",
        theme: "custom",
        fr: body,
        en: body,
        author: author ? { fr: author, en: author } : null,
        custom: true
      });
    }
    return out;
  }

  function themeEnabled(settings, theme) {
    if (theme === "custom") return true;
    const v = settings["theme_" + theme];
    return v === undefined ? true : !!v;
  }

  /* Pools a partir de la collection et des reglages.
     Pools from the collection and the settings. */
  function buildPools(items, settings) {
    const s = settings || {};
    const all = (items || []).concat(parseCustom(s.customQuotes));
    const pools = { quote: [], jcvd: [], chuck: [] };
    if (s.favoritesOnly) {
      const fav = new Set(Array.isArray(s.favorites) ? s.favorites : []);
      return { favorites: all.filter((it) => fav.has(it.id)) };
    }
    for (const it of all) {
      if (it.cat === "quote") {
        // Les citations perso restent affichees meme si la source
        // « Citations » est decochee : ce sont les siennes.
        // Custom quotes stay even if the "Quotes" source is unticked.
        if (s.sourceQuotes === false && !it.custom) continue;
        if (!themeEnabled(s, it.theme)) continue;
        pools.quote.push(it);
      } else if (it.cat === "jcvd") {
        if (s.sourceJcvd) pools.jcvd.push(it);
      } else if (it.cat === "chuck") {
        if (s.sourceChuck) pools.chuck.push(it);
      }
    }
    return pools;
  }

  /* Poids de chaque pool non vide ; leur somme vaut 1.
     Weight of each non-empty pool; they add up to 1. */
  function poolWeights(pools, frequency) {
    const names = Object.keys(pools).filter((k) => pools[k].length);
    if (!names.length) return {};
    const fun = names.filter((k) => k === "jcvd" || k === "chuck");
    const serious = names.filter((k) => !fun.includes(k));
    const out = {};
    if (frequency === "equal" || !fun.length || !serious.length) {
      for (const k of names) out[k] = 1 / names.length;
      return out;
    }
    const share = FUN_SHARE[frequency] != null ? FUN_SHARE[frequency] : FUN_SHARE.sometimes;
    for (const k of fun) out[k] = share / fun.length;
    for (const k of serious) out[k] = (1 - share) / serious.length;
    return out;
  }

  function choosePool(weights, r) {
    let acc = 0;
    const names = Object.keys(weights);
    for (const k of names) {
      acc += weights[k];
      if (r < acc) return k;
    }
    return names[names.length - 1] || null;
  }

  function signature(list) {
    return hash(list.map((it) => it.id).sort().join(",")).toString(36);
  }

  function normalizeState(st) {
    const s = st && typeof st === "object" ? st : {};
    return {
      decks: s.decks && typeof s.decks === "object" ? s.decks : {},
      day: s.day && typeof s.day === "object" ? s.day : null,
      last: typeof s.last === "string" ? s.last : null
    };
  }

  /* Tirage suivant. `random` : fonction [0,1) (Math.random en usage
     reel, fixe dans les tests). Renvoie { item, state } ; l'etat rendu
     est a memoriser tel quel.
     Next draw. Returns { item, state }; store the returned state as is. */
  function next(items, settings, prevState, opts) {
    const o = opts || {};
    const random = o.random || Math.random;
    const seedBase = String(o.seed || "piboard");
    const state = normalizeState(prevState);
    const pools = buildPools(items, settings);
    const weights = poolWeights(pools, settings && settings.funFrequency);
    const name = choosePool(weights, random());
    if (!name) return { item: null, state };
    const list = pools[name];
    const byId = new Map(list.map((it) => [it.id, it]));
    const sig = signature(list);
    let deck = state.decks[name];
    if (!deck || deck.sig !== sig) deck = { sig, round: deck ? (deck.round || 0) + 1 : 0, pos: 0 };
    let order = shuffled([...byId.keys()], hash(seedBase + ":" + name + ":" + deck.round));
    if (deck.pos >= order.length) {
      deck = { sig, round: (deck.round || 0) + 1, pos: 0 };
      order = shuffled([...byId.keys()], hash(seedBase + ":" + name + ":" + deck.round));
      // Pas deux fois de suite a la jonction de deux tours.
      // No back-to-back repeat where two rounds meet.
      if (order.length > 1 && order[0] === state.last) order.push(order.shift());
    }
    const id = order[deck.pos];
    const decks = Object.assign({}, state.decks, { [name]: { sig, round: deck.round, pos: deck.pos + 1 } });
    return { item: byId.get(id), state: { decks, day: state.day, last: id } };
  }

  /* Mode « citation du jour » : le meme texte toute la journee, un
     nouveau (jamais vu du tour) le lendemain.
     "Quote of the day" mode: same text all day, a new one next day. */
  function forDay(items, settings, prevState, today, opts) {
    const state = normalizeState(prevState);
    if (state.day && state.day.date === today) {
      const pools = buildPools(items, settings);
      for (const k of Object.keys(pools)) {
        const hit = pools[k].find((it) => it.id === state.day.id);
        if (hit) return { item: hit, state };
      }
    }
    const r = next(items, settings, state, opts);
    if (r.item) r.state.day = { date: today, id: r.item.id };
    return r;
  }

  function toggleFavorite(favorites, id) {
    const list = Array.isArray(favorites) ? favorites.slice() : [];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    return list;
  }

  function authorText(item, lang) {
    if (!item || !item.author) return "";
    const a = item.author;
    if (typeof a === "string") return a;
    return (lang === "fr" ? a.fr : a.en) || a.fr || a.en || "";
  }

  return { THEMES, POOLS, FUN_SHARE, parseCustom, buildPools, poolWeights, choosePool, next, forDay, toggleFavorite, authorText, shuffled, hash };
});
