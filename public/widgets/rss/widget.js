/* PiBoard widget: RSS / Atom */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  /* Couleur d'etiquette par flux (1.169.0). Sans choix, chaque
     emplacement recoit sa propre teinte (bleu, orange, vert) pour que
     deux sources ne se confondent pas ; un choix explicite l'emporte.
     Per-feed tag colour. With no choice each slot gets its own hue so
     two sources are never mixed up; an explicit choice wins. */
  const AUTO_TAG_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#06b6d4", "#84cc16", "#f43f5e", "#6366f1"];
  const MAX_FEEDS = 12;

  /* Comparaison de mots : minuscules, sans accents. Words comparison:
     lower case, accents stripped. */
  function fold(str) {
    return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function wordList(raw) {
    return String(raw || "").split(/[,;]/).map((w) => fold(w).trim()).filter(Boolean);
  }
  /* Cle de dedoublonnage : le lien sans parametres ni ancre, sinon le
     titre simplifie. Duplicate key: the link without query or anchor,
     otherwise the simplified title. */
  function linkKey(link) {
    try {
      const u = new URL(link);
      return "l:" + u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
    } catch (e) { return ""; }
  }
  function titleKey(title) {
    const t = fold(title).replace(/[^a-z0-9]+/g, " ").trim();
    return t.length >= 12 ? "t:" + t : "";
  }

  function cleanColor(c) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? "#" + m[1].toLowerCase() : "";
  }
  /* Encre lisible sur la couleur choisie : sombre sur un fond clair
     (jaune, vert...), claire sur un fond fonce. Readable ink on the
     chosen colour: dark on a light fill, light on a dark one. */
  function inkOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    const white = 1.05 / (L + 0.05);
    const dark = (L + 0.05) / 0.0597;       // #111827, luminance ~0.0097
    // Blanc de preference tant que son contraste reste raisonnable.
    // White preferred as long as its contrast stays reasonable.
    return white >= dark * 0.75 ? "#ffffff" : "#111827";
  }
  function tagStyle(hex) {
    const c = cleanColor(hex);
    return c ? ` style="--pwr-tag:${c};--pwr-tag-ink:${inkOn(c)}"` : "";
  }

  function textOf(node, tag) {
    const el = node.querySelector(tag);
    return el ? el.textContent.trim() : "";
  }

  // Illustration fournie par le flux lui-meme (extension RSS Media :
  // <media:content>/<media:thumbnail>, avec legende et credit photo en
  // enfants) -- affichee dans la popup independamment du texte utilise
  // (extrait de la page ou resume du flux), le flux l'a deja preparee
  // pour un lecteur RSS.
  // Illustration provided by the feed itself (RSS Media extension:
  // <media:content>/<media:thumbnail>, with caption and photo credit as
  // children) -- shown in the popup independently from whichever text
  // is used (page extract or feed summary), the feed already prepared
  // it for an RSS reader.
  function imageOf(node) {
    const media = node.getElementsByTagName("media:content")[0] || node.getElementsByTagName("media:thumbnail")[0];
    if (!media) return null;
    const url = media.getAttribute("url");
    if (!url || !/^https?:\/\//i.test(url)) return null;
    const descEl = media.getElementsByTagName("media:description")[0];
    const creditEl = media.getElementsByTagName("media:credit")[0];
    return {
      url,
      caption: descEl ? descEl.textContent.trim() : "",
      credit: creditEl ? creditEl.textContent.trim() : ""
    };
  }

  // Lien "article" : RSS <link>texte</link>, ou Atom <link href="..."/>
  // (rel="alternate" prefere s'il y en a plusieurs, ex. "self" pour le
  // flux lui-meme). Article link: RSS <link>text</link>, or Atom
  // <link href="..."/> (rel="alternate" preferred when several are
  // present, e.g. "self" for the feed itself).
  function linkOf(node) {
    const links = [...node.querySelectorAll("link")];
    const rssLink = links.find((l) => !l.getAttribute("href") && l.textContent.trim());
    if (rssLink) return rssLink.textContent.trim();
    const alt = links.find((l) => (l.getAttribute("rel") || "alternate") === "alternate" && l.getAttribute("href"));
    if (alt) return alt.getAttribute("href");
    const any = links.find((l) => l.getAttribute("href"));
    return any ? any.getAttribute("href") : "";
  }

  // Contenu le plus riche disponible : content:encoded (RSS, souvent le
  // HTML complet de l'article) > content (Atom) > description (RSS) >
  // summary (Atom, un simple resume).
  // Richest content available: content:encoded (RSS, often the article's
  // full HTML) > content (Atom) > description (RSS) > summary (Atom, a
  // plain summary).
  function contentOf(node) {
    const encoded = node.getElementsByTagName("content:encoded")[0];
    if (encoded && encoded.textContent.trim()) return encoded.textContent;
    const content = node.querySelector("content");
    if (content && content.textContent.trim()) return content.textContent;
    const description = node.querySelector("description");
    if (description && description.textContent.trim()) return description.textContent;
    const summary = node.querySelector("summary");
    return summary ? summary.textContent : "";
  }

  // Nettoyage minimal avant affichage en popup : retire scripts/styles/
  // cadres embarques et gestionnaires d'evenements, et neutralise les
  // liens (le contenu est fait pour etre LU, pas pour naviguer -- evite
  // le piege d'un onglet ouvert qu'on ne peut plus fermer sur un kiosque
  // tactile sans clavier, meme raison que l'attribution des widgets
  // Trafic/Radar/Avions).
  // Minimal cleanup before showing in the popup: strips embedded
  // scripts/styles/frames and event handlers, and neutralizes links
  // (the content is meant to be READ, not navigated -- avoids the trap
  // of an unclosable tab on a keyboard-less touch kiosk, same reasoning
  // as the Traffic/Radar/Planes widgets' attribution). */
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      });
    });
    doc.querySelectorAll("a").forEach((a) => { a.removeAttribute("href"); a.removeAttribute("target"); });
    return doc.body.innerHTML;
  }

  function parseFeed(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("invalid xml");

    // RSS 2.0
    let items = [...doc.querySelectorAll("channel > item")].map((it) => ({
      title: textOf(it, "title"),
      date: textOf(it, "pubDate"),
      link: linkOf(it),
      content: contentOf(it),
      image: imageOf(it)
    }));
    let source = textOf(doc, "channel > title");

    // Atom
    if (!items.length) {
      items = [...doc.querySelectorAll("feed > entry")].map((it) => ({
        title: textOf(it, "title"),
        date: textOf(it, "updated") || textOf(it, "published"),
        link: linkOf(it),
        content: contentOf(it),
        image: imageOf(it)
      }));
      source = source || textOf(doc, "feed > title");
    }
    return { source, items: items.filter((i) => i.title) };
  }

  function niceDate(raw, lang) {
    const d = new Date(raw);
    if (isNaN(d)) return "";
    return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  /* ---------- Abonnements presse / press subscriptions (1.141.0) ----------
     Les sites pour lesquels une session existe (voir
     server/pressAccess.js), relus a chaque rafraichissement du flux --
     une requete legere, sans reseau externe.
     Et la memoire des articles RESERVES qui n'ont pas pu etre lus en
     entier : apprise a l'ouverture (jamais en interrogeant les sites en
     masse), gardee dans ce navigateur pour que le 🔒 survive a un
     rechargement. Plafonnee : un flux d'actualite se renouvelle vite.
     Sites with a session, re-read at each feed refresh (a light, local
     request). And the memory of RESTRICTED articles that could not be
     read in full: learned when opened (never by querying sites in bulk),
     kept in this browser so the lock survives a reload. Capped. */
  const LOCK_KEY = "piboard.rss.locked";
  const LOCK_MAX = 300;
  let lockedLinks = null;

  function loadLocked() {
    if (lockedLinks) return lockedLinks;
    lockedLinks = new Map();
    try {
      const raw = JSON.parse(localStorage.getItem(LOCK_KEY) || "[]");
      if (Array.isArray(raw)) raw.forEach((l) => lockedLinks.set(String(l), true));
    } catch (e) { /* stockage indisponible / storage unavailable */ }
    return lockedLinks;
  }

  function setLocked(link, locked) {
    const m = loadLocked();
    if (locked) m.set(link, true); else m.delete(link);
    while (m.size > LOCK_MAX) m.delete(m.keys().next().value);
    try { localStorage.setItem(LOCK_KEY, JSON.stringify([...m.keys()])); } catch (e) { /* idem */ }
  }

  function isLocked(link) {
    return !!(link && loadLocked().has(link));
  }

  function subscribedAccount(accounts, link) {
    let host;
    try { host = new URL(link).hostname.toLowerCase(); } catch (e) { return null; }
    return (accounts || []).find((a) => host === a.domain || host.endsWith("." + a.domain)) || null;
  }

  class RssWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.rotateTimer = null;
      this.feed = null;
      this.cursor = 0;
      this.currentItems = []; // items effectivement rendus (sous-ensemble ou rotation) / actually rendered items (subset or rotation)
      this.modal = null;
      this.press = { supported: false, accounts: [] }; // abonnements presse / press subscriptions
      this.failed = [];     // flux sans reponse / feeds that did not answer
      this.groups = [];     // groupes presents / groups present
      this.groupSel = null; // groupe affiche (null = tous, "" = sans groupe) / shown group (null = all, "" = ungrouped)
      this.groupTimer = null;
      this.openToken = 0; // ignore une extraction qui repond apres qu'un autre article a ete ouvert / ignores an extraction that answers after another article was opened
    }

    async init() {
      this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-err">${this.ctx.i18n.t("common.loading")}</div></div>`;
      // Delegation : un seul ecouteur, pose une fois, survit aux
      // re-rendus de render() (rotation, rafraichissement, changement de
      // langue) qui remplacent entierement le innerHTML.
      // Delegation: a single listener, set once, survives render()'s
      // re-renders (rotation, refresh, language change) which fully
      // replace the innerHTML.
      this.ctx.el.addEventListener("click", (e) => {
        // Un appui long vient d'ouvrir le partage : le clic qui suit est ignore.
        if (this.suppressClick) { this.suppressClick = false; e.stopPropagation(); return; }
        const rl = e.target.closest(".pwr-rl-chip");
        if (rl) { e.stopPropagation(); this.view = this.view === "later" ? "list" : "later"; this.render(); return; }
        const del = e.target.closest(".pwr-rl-del");
        if (del) { e.stopPropagation(); this.removeReadLater(Number(del.dataset.i)); return; }
        const rli = e.target.closest(".pwr-rl-item");
        if (rli) { e.stopPropagation(); const it = this.readLaterList()[Number(rli.dataset.i)]; if (it) this.openArticleItem(it); return; }
        const chip = e.target.closest(".pwr-group-chip");
        if (chip) {
          e.stopPropagation();
          const g = chip.dataset.g;
          this.groupSel = g === "*" ? null : g.slice(2);
          this.cursor = 0;
          this.render();
          return;
        }
        const li = e.target.closest(".pwr-item[data-link='1']");
        if (!li) return;
        e.stopPropagation(); // sinon rouvre les reglages en mode edition / else reopens settings in edit mode
        this.openArticle(Number(li.dataset.idx));
      });
      this.wireShareGestures();
      await this.refresh();
      this.arm();
    }

    /* ---------- Partage d'un article (1.176.0) ----------
       Appui long (doigt ou souris) ou clic droit sur un titre : fenetre de
       partage, sans ouvrir l'article. Long press or right-click on a
       title: share window, without opening the article. */
    wireShareGestures() {
      const el = this.ctx.el;
      let timer = null, start = null;
      const itemAt = (target) => {
        const li = target && target.closest ? target.closest(".pwr-item[data-link='1'], .pwr-rl-item") : null;
        if (!li) return null;
        if (li.classList.contains("pwr-rl-item")) return this.readLaterList()[Number(li.dataset.i)] || null;
        return (this.currentItems || [])[Number(li.dataset.idx)] || null;
      };
      el.addEventListener("pointerdown", (e) => {
        if (e.button && e.button !== 0) return;
        const it = itemAt(e.target);
        if (!it || document.body.classList.contains("editing")) return;
        start = { x: e.clientX || 0, y: e.clientY || 0 };
        clearTimeout(timer);
        timer = setTimeout(() => { timer = null; this.suppressClick = true; this.shareItem(it, start); }, 550);
      });
      const cancel = (e) => {
        if (!timer) return;
        if (e && e.type === "pointermove" && start && Math.abs((e.clientX || 0) - start.x) + Math.abs((e.clientY || 0) - start.y) < 10) return;
        clearTimeout(timer); timer = null;
      };
      ["pointerup", "pointercancel", "pointerleave", "pointermove"].forEach((ty) => el.addEventListener(ty, cancel));
      el.addEventListener("contextmenu", (e) => {
        const it = itemAt(e.target);
        if (!it) return;
        e.preventDefault();
        e.stopPropagation(); // pas le menu de la tuile / not the tile menu
        clearTimeout(timer); timer = null;
        this.shareItem(it, { x: e.clientX, y: e.clientY });
      });
    }

    shareData(it) {
      const s = this.ctx.settings;
      const source = it.sourceLabel || (this.feed && this.feed.source) || "";
      const parts = [it.title];
      if (s.shareText === "summary") {
        const sum = String(it.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (sum) parts.push(sum.length > 280 ? sum.slice(0, 277) + "…" : sum);
      }
      if (s.shareSource !== false && source) parts.push("— " + source);
      if (it.link) parts.push(it.link);
      return { title: it.title, url: it.link || "", source, text: parts.filter(Boolean).join("\n") };
    }

    shareItem(it, pos) {
      if (!it || !window.PiBoard || typeof window.PiBoard.share !== "function") return;
      const t = (k) => this.ctx.i18n.t(k);
      const saved = this.isReadLater(it);
      return window.PiBoard.share(this.shareData(it), {
        x: pos && pos.x, y: pos && pos.y,
        extras: [{ id: "later", icon: "📑", label: saved ? t("rss.later.remove") : t("rss.later.add"), run: () => {
          if (saved) this.removeReadLater(this.readLaterList().findIndex((x) => x.link === it.link));
          else this.addReadLater(it);
        } }]
      });
    }

    /* ---------- Lire plus tard ----------
       Liste propre a la tuile, enregistree avec ses reglages (50 au plus).
       Per-tile list, saved with its settings (50 at most). */
    readLaterList() {
      const raw = this.ctx.settings.readLater;
      try { const v = typeof raw === "string" ? JSON.parse(raw || "[]") : raw; return Array.isArray(v) ? v : []; }
      catch (e) { return []; }
    }
    saveReadLater(list) {
      const v = JSON.stringify(list.slice(0, 50));
      this.ctx.settings = Object.assign({}, this.ctx.settings, { readLater: v });
      if (typeof this.ctx.updateSettings === "function") this.ctx.updateSettings({ readLater: v });
      if (!list.length && this.view === "later") this.view = "list";
      this.render();
    }
    isReadLater(it) { return !!(it && it.link) && this.readLaterList().some((x) => x.link === it.link); }
    addReadLater(it) {
      if (!it || !it.link || this.isReadLater(it)) return;
      const list = this.readLaterList();
      list.unshift({ title: it.title, link: it.link, date: it.date || "", sourceLabel: it.sourceLabel || (this.feed && this.feed.source) || "",
        sourceColor: it.sourceColor || "", image: it.image || null, content: String(it.content || "").slice(0, 4000), addedAt: new Date().toISOString() });
      this.saveReadLater(list);
    }
    removeReadLater(i) {
      const list = this.readLaterList();
      if (i < 0 || i >= list.length) return;
      list.splice(i, 1);
      this.saveReadLater(list);
    }

    arm() {
      clearInterval(this.timer);
      const minutes = Math.max(2, Number(this.ctx.settings.refresh) || 10);
      this.timer = setInterval(() => this.refresh(), minutes * 60000);
    }

    onSettingsChanged(settings) {
      this.ctx.settings = settings;
      this.cursor = 0;
      this.groupSel = null;
      this.refresh();
      this.arm();
    }

    onLangChanged() { this.render(); }

    /* Recupere une a trois adresses de flux (voir feedSlots()), chacune
       avec sa propre etiquette de source, puis fusionne le tout par
       ordre chronologique -- un flux en panne n'empeche pas les autres
       de s'afficher, il est simplement absent du resultat.
       Fetches one to three feed addresses (see feedSlots()), each with
       its own source tag, then merges everything in chronological order
       -- a feed that's down doesn't prevent the others from showing, it
       simply stays absent from the result. */
    async refresh() {
      const slots = this.feedSlots();
      if (!slots.length) {
        this.feed = null;
        this.render();
        return;
      }
      const [results] = await Promise.all([
        Promise.allSettled(slots.map((slot) => this.fetchOneFeed(slot))),
        this.refreshPress()
      ]);
      const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      // Flux en panne : nommes, sans empecher les autres de s'afficher.
      // Failing feeds: named, without preventing the others from showing.
      this.failed = results.map((r, i) => {
        if (r.status !== "rejected") return null;
        const name = slots[i].label || this.hostOf(slots[i].url);
        const m = /proxy (\d{3})/.exec(String(r.reason && r.reason.message));
        return m ? name + " (" + m[1] + ")" : name;
      }).filter(Boolean);

      if (!ok.length) {
        console.warn("[piboard/rss] tous les flux configures ont echoue");
        this.ctx.el.innerHTML = `<div class="pw-rss"><div class="pwr-err">${this.ctx.i18n.t("rss.error")}</div></div>`;
        return;
      }

      const allItems = [].concat(...ok.map((f) => f.items));
      // Plus recent d'abord ; une date illisible (NaN) est reletee en
      // fin de liste plutot que de casser le tri.
      // Newest first; an unparsable date (NaN) is pushed to the end
      // rather than breaking the sort.
      allItems.sort((a, b) => {
        const ta = new Date(a.date).getTime(), tb = new Date(b.date).getTime();
        if (isNaN(ta) && isNaN(tb)) return 0;
        if (isNaN(ta)) return 1;
        if (isNaN(tb)) return -1;
        return tb - ta;
      });

      // Doublons : meme article publie par deux flux. L'ordre du tri etant
      // chronologique, le premier flux de la liste l'emporte a date egale.
      // Duplicates: the same article published by two feeds.
      let items = allItems;
      if (this.ctx.settings.dedupe !== false && ok.length > 1) {
        const seen = new Set();
        items = allItems.filter((it) => {
          const keys = [linkKey(it.link), titleKey(it.title)].filter(Boolean);
          if (keys.some((k) => seen.has(k))) return false;
          keys.forEach((k) => seen.add(k));
          return true;
        });
      }
      // Groupes : dans l'ordre de la liste, seulement ceux des flux qui ont
      // repondu. Groups: in list order, only those of feeds that answered.
      const groups = [];
      ok.forEach((f) => { if (f.group && !groups.includes(f.group)) groups.push(f.group); });
      this.groups = groups;
      if (this.groupSel && !groups.includes(this.groupSel)) this.groupSel = null;


      // flux (avec plusieurs, chaque article porte deja la sienne, voir
      // render()). Source name for the header: only meaningful with a
      // single feed (with several, each item already carries its own,
      // see render()).
      this.feed = {
        source: ok.length === 1 ? ok[0].source : null,
        /* Seul flux : sa couleur n'est utilisee que si elle a ete choisie
           (l'en-tete historique reste inchange sinon).
           Single feed: its colour is only used when chosen (the
           historical header stays unchanged otherwise). */
        sourceColor: ok.length === 1 && ok[0].sourceChosen ? ok[0].sourceColor : "",
        items
      };
      this.render();
      this.armGroups();
    }

    /* Flux configures : la liste du reglage `feeds` (jusqu'a 12, chacun
       avec nom, couleur, groupe et mots a garder / masquer). Tant que
       cette liste n'a jamais ete enregistree, on lit les anciens
       reglages a trois emplacements (url/label1/color1, url2..., url3...)
       : une tuile existante garde ses flux. Un flux decoche ou sans
       adresse http(s) est ignore.
       Configured feeds: the `feeds` setting's list (up to 12, each with
       name, colour, group and words to keep / hide). As long as that
       list was never saved, the old three-slot settings are read: an
       existing tile keeps its feeds. A ticked-off feed or one without
       an http(s) address is ignored. */
    feedSlots() {
      const s = this.ctx.settings;
      let list = null;
      const raw = String(s.feeds == null ? "" : s.feeds).trim();
      if (raw) {
        try { const p = JSON.parse(raw); if (Array.isArray(p)) list = p; } catch (e) { list = null; }
      }
      if (!list) {
        list = [
          { url: s.url, label: s.label1, color: s.color1, n: 0 },
          { url: s.url2, label: s.label2, color: s.color2, n: 1 },
          { url: s.url3, label: s.label3, color: s.color3, n: 2 }
        ];
      }
      return list.slice(0, MAX_FEEDS).map((f, i) => ({
        url: String((f && f.url) || "").trim(),
        label: (f && f.label) || "",
        color: (f && f.color) || "",
        idx: f && Number.isInteger(f.n) && f.n >= 0 ? f.n : i,
        group: String((f && f.group) || "").trim(),
        keep: wordList(f && f.keep),
        hide: wordList(f && f.hide),
        ua: !!(f && f.ua),
        on: !f || f.on !== false
      })).filter((f) => f.on && /^https?:\/\//i.test(f.url));
    }

    /* Filtre des articles d'UN flux : mots a garder / a masquer du flux
       et de la tuile, puis quota des plus recents. Filters ONE feed's
       items: the feed's and the tile's words to keep / hide, then the
       most-recent quota. */
    filterItems(items, slot) {
      const s = this.ctx.settings;
      const hide = slot.hide.concat(wordList(s.hideWords));
      const keepOwn = slot.keep, keepTile = wordList(s.keepWords);
      let out = items;
      if (keepOwn.length || keepTile.length || hide.length) {
        out = items.filter((it) => {
          const hay = fold(it.title + " " + String(it.content || "").replace(/<[^>]+>/g, " ").slice(0, 400));
          if (hide.some((w) => hay.includes(w))) return false;
          if (keepOwn.length && !keepOwn.some((w) => hay.includes(w))) return false;
          if (keepTile.length && !keepTile.some((w) => hay.includes(w))) return false;
          return true;
        });
      }
      const quota = Math.max(0, Math.min(20, Number(s.perFeedMax) || 0));
      if (quota > 0) {
        out = out.slice().sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)).slice(0, quota);
      }
      return out;
    }

    async refreshPress() {
      try {
        const r = await fetch("/api/press", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        this.press = { supported: !!data.supported, accounts: Array.isArray(data.accounts) ? data.accounts : [] };
      } catch (e) { /* serveur plus ancien : aucun indicateur / older server: no indicator */ }
    }

    /* ✓ : article d'un site auquel vous etes abonne (sauf si la derniere
       lecture n'a donne que l'apercu : session a renouveler). 🔒 : article
       reserve deja ouvert sans avoir pu etre lu en entier.
       ✓: article from a subscribed site (unless the last read only gave
       the preview). 🔒: restricted article already opened but not read
       in full. */
    badgeHtml(it) {
      const t = (k) => this.ctx.i18n.t(k);
      if (!it.link) return "";
      if (isLocked(it.link)) {
        return `<span class="pwr-badge pwr-badge-lock" title="${escapeAttr(t("rss.badge.locked"))}">🔒</span>`;
      }
      const acc = subscribedAccount(this.press.accounts, it.link);
      if (acc && !(acc.lastRead && acc.lastRead.full === false)) {
        return `<span class="pwr-badge pwr-badge-sub" title="${escapeAttr(t("rss.badge.subscribed").replace("{name}", acc.name))}">✓</span>`;
      }
      return "";
    }

    refreshBadges() {
      this.ctx.el.querySelectorAll(".pwr-item").forEach((li) => {
        const it = this.currentItems[Number(li.dataset.idx)];
        const title = li.querySelector(".pwr-title");
        if (!it || !title) return;
        const old = title.querySelector(".pwr-badge");
        if (old) old.remove();
        const html = this.badgeHtml(it);
        if (html) title.insertAdjacentHTML("afterbegin", html);
      });
    }

    /* Ligne de meta de la fenetre de lecture : la source en pastille
       de sa couleur (quand les etiquettes sont affichees), puis la date.
       Reading window's meta line: the source as a pill in its colour
       (when tags are shown), then the date. */
    setModalMeta(metaEl, it, extraMeta, date) {
      const s = this.ctx.settings;
      const name = it.sourceLabel || (this.feed && this.feed.source) || "";
      const multi = !!this.feed && this.feed.source == null;
      const coloured = s.showSource !== false && name && (multi || (this.feed && this.feed.sourceColor));
      const rest = [extraMeta, date].filter(Boolean).join(" · ");
      if (!coloured) {
        metaEl.textContent = [name, rest].filter(Boolean).join(" · ");
        return;
      }
      metaEl.innerHTML = `<span class="pwr-tag"${tagStyle(it.sourceColor)}>${escapeHtml(name)}</span>${rest ? " " + escapeHtml(rest) : ""}`;
    }

    async fetchOneFeed(slot) {
      // Meme classe de bug que celle deja corrigee sur le widget
      // Trafic : sans parametre variant d'un cycle a l'autre, l'URL
      // demandee est EXACTEMENT la meme a chaque rafraichissement, et le
      // cache HTTP du navigateur peut alors resservir indefiniment la
      // reponse d'un cycle precedent. Same bug class already fixed on
      // the Traffic widget: without a parameter that changes between
      // refreshes, the requested URL is EXACTLY the same each time, and
      // the browser's HTTP cache can keep serving a previous cycle's
      // response indefinitely.
      const proxied = this.ctx.api.proxyUrl(slot.url);
      const sep = proxied.includes("?") ? "&" : "?";
      // Identifiant « navigateur » : uniquement pour les flux ou la case est cochee.
      // "Browser" identity: only for feeds with the box ticked.
      const url = proxied + sep + (slot.ua ? "ua=browser&" : "") + "_=" + Date.now();
      const xml = await fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("proxy " + r.status);
        return r.text();
      });
      const parsed = parseFeed(xml);
      const sourceLabel = (slot.label || "").trim() || parsed.source || "";
      /* Couleur choisie (explicite) ou teinte automatique du
         emplacement : l'emplacement d'origine fixe la teinte, elle ne
         change donc pas quand on retire un autre flux.
         Chosen colour (explicit) or the slot's automatic hue: the
         original slot fixes the hue, so it does not change when
         another feed is removed. */
      const chosen = cleanColor(slot.color);
      const sourceColor = chosen || AUTO_TAG_COLORS[slot.idx % AUTO_TAG_COLORS.length];
      parsed.items = this.filterItems(parsed.items, slot);
      parsed.items.forEach((it) => { it.sourceLabel = sourceLabel; it.sourceColor = sourceColor; it.sourceChosen = !!chosen; it.group = slot.group; });
      parsed.group = slot.group;
      parsed.source = sourceLabel;
      parsed.sourceColor = sourceColor;
      parsed.sourceChosen = !!chosen;
      return parsed;
    }

    hostOf(url) {
      try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return String(url || ""); }
    }

    /* Liste des « vues » de groupe : chaque groupe, puis « Autres » si
       des articles n'ont pas de groupe. The group "views": each group,
       then "Other" if some items have none. */
    groupViews() {
      const views = this.groups.slice();
      if (this.feed && this.feed.items.some((it) => !it.group)) views.push("");
      return views;
    }

    groupChipsHtml() {
      const t = (k) => this.ctx.i18n.t(k);
      const chip = (value, text) => {
        const active = (value === null ? this.groupSel === null : this.groupSel === value);
        return `<button type="button" class="pwr-group-chip${active ? " active" : ""}" data-g="${value === null ? "*" : "g:" + escapeAttr(value)}">${escapeHtml(text)}</button>`;
      };
      const all = this.ctx.settings.groupView === "rotate" ? "" : chip(null, t("rss.group.all"));
      return `<div class="pwr-groups">${all}${this.groupViews().map((g) => chip(g, g || t("rss.group.other"))).join("")}</div>`;
    }

    /* Rotation automatique entre les groupes. Automatic rotation between
       groups. */
    armGroups() {
      clearInterval(this.groupTimer);
      const s = this.ctx.settings;
      if (s.groupView !== "rotate") { if (s.groupView !== "tabs") this.groupSel = null; return; }
      const views = this.groupViews();
      if (views.length < 2 && !this.groups.length) return;
      if (this.groupSel === null || !views.includes(this.groupSel)) this.groupSel = views[0] === undefined ? null : views[0];
      this.render();
      const secs = Math.max(5, Math.min(300, Number(s.groupSeconds) || 20));
      if (views.length < 2) return;
      this.groupTimer = setInterval(() => {
        const v = this.groupViews();
        const i = v.indexOf(this.groupSel);
        this.groupSel = v[(i + 1) % v.length];
        this.cursor = 0;
        this.render();
      }, secs * 1000);
    }

    render() {
      const s = this.ctx.settings;
      const lang = this.ctx.i18n.lang;
      clearInterval(this.rotateTimer);

      const later = this.readLaterList();
      const laterChip = later.length
        ? `<button type="button" class="pwr-rl-chip${this.view === "later" ? " active" : ""}">📑 ${escapeHtml(this.ctx.i18n.t(this.view === "later" ? "rss.later.back" : "rss.later.chip").replace("{n}", String(later.length)))}</button>`
        : "";
      if (this.view === "later" && later.length) {
        this.ctx.el.innerHTML = `<div class="pw-rss">${laterChip}<ul>${later.map((it, i) => `
          <li class="pwr-item pwr-rl-item pwr-clickable" data-i="${i}">
            <div class="pwr-title">${it.sourceLabel ? `<span class="pwr-tag"${tagStyle(it.sourceColor)}>${escapeHtml(it.sourceLabel)}</span>` : ""}${escapeHtml(it.title)}</div>
            <div class="pwr-meta">${niceDate(it.date, lang)}<button type="button" class="pwr-rl-del" data-i="${i}" title="${escapeAttr(this.ctx.i18n.t("rss.later.remove"))}">✕</button></div>
          </li>`).join("")}</ul></div>`;
        return;
      }
      if (!this.feed || !this.feed.items.length) {
        this.ctx.el.innerHTML = `<div class="pw-rss">${laterChip}<div class="pwr-empty">${this.ctx.i18n.t("rss.empty")}</div></div>`;
        return;
      }

      /* Groupes : le selecteur ou la rotation ne s'appliquent que si des
         flux portent un nom de groupe. Groups: the selector or rotation
         only apply if some feeds carry a group name. */
      const useGroups = (s.groupView === "tabs" || s.groupView === "rotate") && this.groups.length > 0;
      const pool = useGroups && this.groupSel !== null
        ? this.feed.items.filter((it) => (it.group || "") === this.groupSel)
        : this.feed.items;
      const chips = useGroups ? this.groupChipsHtml() : "";
      if (!pool.length) {
        this.ctx.el.innerHTML = `<div class="pw-rss">${chips}<div class="pwr-empty">${this.ctx.i18n.t("rss.empty")}</div></div>`;
        return;
      }

      const items = s.rotate
        ? [pool[this.cursor % pool.length]]
        : pool.slice(0, Math.max(1, Number(s.maxItems) || 6));
      this.currentItems = items;
      const warn = s.warnFailed !== false && this.failed.length
        ? `<div class="pwr-warn" title="${escapeAttr(this.failed.join(", "))}">⚠ ${escapeHtml(this.ctx.i18n.t(this.failed.length > 1 ? "rss.failedN" : "rss.failed1").replace("{n}", String(this.failed.length)))} : ${escapeHtml(this.failed.join(", "))}</div>`
        : "";

      // Un seul flux configure : en-tete unique au-dessus de la liste,
      // comportement historique inchange. Plusieurs flux combines :
      // l'en-tete n'aurait plus de sens (quelle source afficher ?), une
      // etiquette apparait a la place sur chaque article -- voir
      // feedSlots()/refresh(). Single feed configured: single header
      // above the list, historical behaviour unchanged. Several feeds
      // combined: the header would no longer make sense (which source to
      // show?), a tag appears on each item instead -- see
      // feedSlots()/refresh().
      const multiFeed = this.feed.source == null;
      const showTags = s.showSource !== false && multiFeed;
      // Liseré : flux combines, ou couleur choisie pour le flux unique.
      // Bar: combined feeds, or a colour chosen for the single feed.
      const showBar = s.showColorBar !== false && (multiFeed || !!this.feed.sourceColor);

      this.ctx.el.innerHTML = `
        <div class="pw-rss ${s.rotate ? "pwr-rotate" : ""}">
          ${laterChip}${chips}${warn}
          <div class="pwr-source${this.feed.sourceColor ? " pwr-source-coloured" : ""}"${tagStyle(this.feed.sourceColor)} ${s.showSource !== false && !multiFeed ? "" : "hidden"}>${this.feed.source || ""}</div>
          <ul>
            ${items.map((it, idx) => `
              <li class="pwr-item ${it.link ? "pwr-clickable" : ""}${showBar ? " pwr-barred" : ""}"${showBar ? tagStyle(it.sourceColor) : ""} data-idx="${idx}" data-link="${it.link ? "1" : ""}">
                <div class="pwr-title">${this.badgeHtml(it)}${showTags && it.sourceLabel ? `<span class="pwr-tag"${tagStyle(it.sourceColor)}>${escapeHtml(it.sourceLabel)}</span>` : ""}${it.title}</div>
                <div class="pwr-meta">${niceDate(it.date, lang)}</div>
              </li>`).join("")}
          </ul>
        </div>`;

      if (s.rotate && pool.length > 1) {
        this.rotateTimer = setInterval(() => {
          this.cursor = (this.cursor + 1) % pool.length;
          this.render();
        }, 8000);
      }
    }

    /* Cree la fenetre de lecture une seule fois (reutilisee ensuite) et
       l'ajoute a document.body pour echapper au cadre de la tuile.
       Fermeture par le bouton, la touche Echap, OU un clic sur le fond
       (contrairement a la fenetre de courbe du widget Crypto : ici pas
       de sous-navigation interne a proteger d'un clic accidentel).
       Creates the reading popup once (reused afterwards) and appends it
       to document.body to escape the tile's clipped frame. Closes via
       the button, the Escape key, OR a backdrop click (unlike the
       Crypto widget's chart popup: no internal sub-navigation to
       protect from an accidental click here). */
    ensureModal() {
      if (this.modal) return this.modal;
      const i18n = this.ctx.i18n;
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="modal-card pwr-modal-card">
          <header class="modal-head">
            <h2 class="pwr-modal-title"></h2>
            <button type="button" class="pwr-modal-share" data-share title="${i18n.t("share.title")}">⤴ ${i18n.t("share.title")}</button>
            <button type="button" class="modal-close" data-close aria-label="${i18n.t("common.close")}">&times;</button>
          </header>
          <div class="pwr-modal-meta"></div>
          <div class="pwr-modal-body"></div>
        </div>`;
      document.body.appendChild(wrap);

      wrap.addEventListener("click", (e) => {
        const sh = e.target.closest && e.target.closest("[data-share]");
        if (sh) { e.stopPropagation(); const r = sh.getBoundingClientRect(); this.shareItem(this.modalItem, { x: Math.round(r.left), y: Math.round(r.bottom) }); return; }
        if (e.target === wrap || e.target.hasAttribute("data-close")) wrap.hidden = true;
      });
      this._escHandler = (e) => { if (e.key === "Escape" && !wrap.hidden) wrap.hidden = true; };
      document.addEventListener("keydown", this._escHandler);

      this.modal = wrap;
      return wrap;
    }

    /* Illustration fournie par le flux (voir imageOf()), affichee au-dessus
       du texte quel qu'en soit la source. Image provided by the feed
       (see imageOf()), shown above the text whichever source it comes
       from. */
    figureHtml(image) {
      if (!image || !image.url) return "";
      const caption = [image.caption, image.credit].filter(Boolean).join(" — ");
      return `<figure class="pwr-modal-figure">
        <img src="${escapeAttr(image.url)}" alt="">
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>`;
    }

    async openArticle(idx) {
      const it = this.currentItems[idx];
      if (!it || !it.link) return;
      return this.openArticleItem(it);
    }

    async openArticleItem(it) {
      if (!it || !it.link) return;
      this.modalItem = it;
      const token = ++this.openToken;
      const i18n = this.ctx.i18n;
      const lang = i18n.lang;
      const modal = this.ensureModal();
      const figureHtml = this.figureHtml(it.image);

      modal.querySelector(".pwr-modal-title").textContent = it.title;
      const metaEl = modal.querySelector(".pwr-modal-meta");
      // it.sourceLabel (propre a cet article) prend le pas sur
      // this.feed.source (nul des que plusieurs flux sont combines, voir
      // refresh()). it.sourceLabel (specific to this item) takes
      // precedence over this.feed.source (null as soon as several feeds
      // are combined, see refresh()).
      this.setModalMeta(metaEl, it, "", niceDate(it.date, lang));
      const bodyEl = modal.querySelector(".pwr-modal-body");
      bodyEl.innerHTML = figureHtml + `<p class="pwr-modal-loading">${i18n.t("common.loading")}</p>`;
      modal.hidden = false;

      // Tente de recuperer le texte complet de la page liee (mode
      // lecture, comme le mode lecture d'un navigateur -- voir
      // server/articleExtract.js) : bien plus complet que la description
      // du flux, qui n'est souvent qu'un court resume. Se rabat
      // silencieusement sur le contenu du flux en cas d'echec (page
      // injoignable, paywall, contenu juge trop pauvre...).
      // Attempts to fetch the linked page's full text (reader mode, like
      // a browser's reader mode -- see server/articleExtract.js): much
      // more complete than the feed's description, which is often just
      // a short summary. Silently falls back to the feed's own content
      // on failure (unreachable page, paywall, content judged too
      // thin...).
      let html = null;
      let extraMeta = "";
      let isPaywall = false;
      let isPartialPreview = false;
      let subNote = ""; // note d'abonnement / subscription note
      try {
        const res = await fetch("/api/article-extract?url=" + encodeURIComponent(it.link));
        if (res.ok) {
          const article = await res.json();
          if (article && article.content) {
            html = sanitizeHtml(article.content);
            if (article.byline) extraMeta = article.byline;
            else if (article.siteName) extraMeta = article.siteName;
            // Du texte a bien ete extrait, mais le site le renvoyait avec
            // un statut de paywall (401/402) : c'est tres probablement
            // l'apercu gratuit precedant la barriere de paiement, pas
            // l'article complet -- le dire clairement plutot que de
            // laisser croire au texte integral (voir
            // server/articleExtract.js).
            // Text was extracted, but the site returned it with a
            // paywall status (401/402): this is very likely the free
            // preview before the payment barrier, not the full article
            // -- stated clearly rather than implying the full text (see
            // server/articleExtract.js).
            isPartialPreview = !!article.partial;
            const t = (k) => i18n.t(k);
            if (article.sessionExpired) {
              subNote = `<p class="pwr-modal-thin-note pwr-modal-sub-warn">${escapeHtml(t("rss.sub.expired").replace("{name}", article.subscription || ""))}</p>`;
            } else if (article.viaSubscription && article.premium === true && !article.partial) {
              subNote = `<p class="pwr-modal-sub-ok">${escapeHtml(t("rss.sub.read").replace("{name}", article.subscription || ""))}</p>`;
            } else if (article.premium === true && article.partial && !article.viaSubscription && this.press.supported) {
              subNote = `<p class="pwr-modal-thin-note">${escapeHtml(t("rss.sub.hint"))}</p>`;
            }
            // Memoire du 🔒 : seul un article DECLARE payant et non lu en
            // entier est verrouille ; un article lu en entier est libere.
            // Lock memory: only a DECLARED paid article not read in full.
            if (article.premium === true) setLocked(it.link, !!article.partial);
          }
        } else {
          // Statut 401/402 signale sans ambiguite un acces reserve aux
          // abonnes (voir server/articleExtract.js) : merite un message
          // honnete plutot qu'une mention vague de mode lecture
          // indisponible, qui laisserait croire a un probleme technique.
          // Status 401/402 unambiguously signals subscriber-only access
          // (see server/articleExtract.js): deserves an honest message
          // rather than a vague "reader mode unavailable" note, which
          // would suggest a technical problem.
          const errBody = await res.json().catch(() => null);
          isPaywall = !!(errBody && errBody.paywall);
        }
      } catch (e) {
        console.warn("[piboard/rss] extract", e);
      }

      // Une autre ouverture a eu lieu entre-temps (l'utilisateur a
      // clique un autre article, ou ferme puis rouvert) : n'ecrase pas
      // ce qui est affiche maintenant. Another opening happened in the
      // meantime (the user clicked a different article, or closed and
      // reopened): don't overwrite what's currently shown.
      if (token !== this.openToken) return;

      if (!html) {
        const fallback = sanitizeHtml(it.content);
        // Repli sur le contenu brut du flux : si celui-ci est lui-meme
        // tres pauvre en texte (souvent juste une image, comme signale
        // -- de nombreux flux ne fournissent qu'une vignette dans leur
        // resume), le dire clairement plutot que de laisser deviner si
        // le mode lecture a echoue ou si la fonctionnalite est cassee.
        // Message specifique et honnete si un paywall a ete detecte
        // (401/402) : "cet article necessite un abonnement" est plus
        // exact et rassurant que "mode lecture indisponible", qui
        // suggere a tort un probleme technique cote PiBoard.
        // Falls back to the feed's raw content: if that itself is very
        // thin on text (often just an image, as reported -- many feeds
        // only provide a thumbnail in their summary), say so clearly
        // rather than leaving it to guess whether reader mode failed or
        // the feature is broken. Specific, honest message when a
        // paywall was detected (401/402): "this article requires a
        // subscription" is more accurate and reassuring than "reader
        // mode unavailable", which wrongly suggests a technical problem
        // on PiBoard's side.
        const plainTextLen = fallback.replace(/<[^>]+>/g, "").trim().length;
        let thinNote = "";
        if (isPaywall) thinNote = `<p class="pwr-modal-thin-note">${i18n.t("rss.paywallDetected")}</p>`;
        else if (plainTextLen < 40) thinNote = `<p class="pwr-modal-thin-note">${i18n.t("rss.readerModeUnavailable")}</p>`;
        html = fallback.trim() ? thinNote + fallback : `<p class="pwr-modal-empty">${i18n.t("rss.noContent")}</p>`;
      } else if (extraMeta) {
        this.setModalMeta(metaEl, it, extraMeta, niceDate(it.date, lang));
      }
      const previewNote = isPartialPreview && !subNote.includes("pwr-modal-sub-warn")
        ? `<p class="pwr-modal-thin-note">${i18n.t("rss.freePreviewOnly")}</p>` : "";
      bodyEl.innerHTML = figureHtml + subNote + previewNote + html;
      // L'indicateur de la liste suit ce qui vient d'etre appris -- mis a
      // jour SUR PLACE : un re-rendu complet remplacerait les elements de
      // la liste sous le doigt de l'utilisateur.
      // The list's indicator follows what was just learned -- updated IN
      // PLACE: a full re-render would replace the list's elements.
      this.refreshBadges();
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.rotateTimer);
      clearInterval(this.groupTimer);
      if (this.modal) {
        this.modal.remove();
        if (this._escHandler) document.removeEventListener("keydown", this._escHandler);
      }
    }
  }

  window.PiBoard.registerWidget("rss", RssWidget);
})();
