/* ============================================================
   PiBoard - server/teleProgram.js
   Programme TV simplifie pour la tuile "teleprog". Recupere une grille
   de programmes depuis une source configurable, la normalise vers un
   format commun, et sert des vues pretes a afficher (en cours / ce soir
   / 2e partie de soiree).

   Deux sources sont prevues :
     - "xmltv"  : un fichier XMLTV (standard de facto pour l'EPG,
                  utilise par TVHeadend, Jellyfin, Kodi...). URL http(s)
                  ou chemin local. C'est la source RECOMMANDEE : format
                  stable et documente. Pleinement fonctionnelle.
     - "scrape" : recuperation depuis un site de programme TV. PLUS
                  FRAGILE : le HTML d'un site peut changer a tout moment
                  et casser l'extraction. Fournie en complement, via des
                  adaptateurs par site (voir scrapeAdapters). A ajuster
                  selon le site reel.

   Simplified TV guide for the "teleprog" tile. Fetches a program grid
   from a configurable source, normalizes it to a common shape, and
   serves ready-to-display views (now / tonight / late night).

   Two sources are planned:
     - "xmltv"  : an XMLTV file (de-facto EPG standard, used by
                  TVHeadend, Jellyfin, Kodi...). http(s) URL or local
                  path. This is the RECOMMENDED source: stable,
                  documented format. Fully functional.
     - "scrape" : fetch from a TV-guide website. MORE FRAGILE: a site's
                  HTML can change at any time and break extraction.
                  Provided as a complement, via per-site adapters (see
                  scrapeAdapters). To be adjusted to the real site.
   ============================================================ */
"use strict";

const fs = require("fs");
const zlib = require("zlib");
const { XMLParser } = require("fast-xml-parser");

/* ---------- Source integree xmltvfr.fr / built-in xmltvfr.fr source ----------
   xmltvfr.fr publie des fichiers XMLTV prets a l'emploi, gratuits et
   sans inscription, mis a jour quotidiennement, dans le dossier stable
   /xmltv/. On vise en priorite le fichier dedie a la TNT francaise
   (leger : ~1,3 Mo compresse, toutes les chaines TNT, 5 jours de
   programme). Les noms de fichiers exacts peuvent evoluer ; on essaie
   donc une liste de candidats connus, du plus specifique (TNT) au plus
   large (France), et on garde le premier qui repond.
   xmltvfr.fr publishes ready-to-use XMLTV files, free and without
   signup, updated daily, in the stable /xmltv/ folder. We target the
   France DTT (TNT) file first (light: ~1.3 MB compressed, all DTT
   channels, 5 days of program). Exact filenames may change; so we try
   a list of known candidates, from most specific (DTT) to broadest
   (France), and keep the first that responds. */
const XMLTVFR_BASE = "https://xmltvfr.fr/xmltv/";
const XMLTVFR_TNT_CANDIDATES = [
  "xmltv_tnt.xml.gz",
  "tnt.xml.gz",
  "xmltv_fr_tnt.xml.gz"
];
const XMLTVFR_FRANCE_CANDIDATES = [
  "xmltv_fr.xml.gz",
  "france.xml.gz",
  "xmltv_france.xml.gz"
];

/* ---------- Modele commun / common shape ----------
   Un programme normalise :
   {
     channelId: "C1.tf1.fr",         // identifiant de chaine (source)
     start: Date,                     // debut
     stop: Date | null,               // fin (peut manquer)
     title: "Nom du programme",
     subtitle: "Sous-titre / episode" | null,
     desc: "Synopsis..." | null,
     category: "Film" | "Série" | ... | null,
     icon: "https://.../vignette.jpg" | null,
     isNew: true | false | null,      // inedit ? null = information absente
   }
   channelId n'a de sens qu'au sein d'une meme source ; la tuile
   rapproche les chaines par leur identifiant tel que fourni. */

/* ---------- Chaines TNT + Canal+ (reference d'affichage) ----------
   Liste par defaut proposee cote tuile. On garde ici la correspondance
   nom lisible -> identifiants XMLTV usuels (plusieurs alias possibles
   selon les grabbers), pour aider a apparier une grille XMLTV a cette
   liste sans configuration manuelle. Non exhaustif ni fige : la tuile
   permet de choisir/reordonner librement.

   tntNumber : numero logique (LCN) officiel sur la TNT gratuite,
   d'apres le plan de numerotation Arcom en vigueur depuis le 6 juin
   2025 (https://www.arcom.fr/presse/nouvelle-numerotation-des-chaines-
   compter-du-6-juin-2025-larcom-accompagne-les-telespectateurs).
   Absent pour les chaines qui n'ont plus de canal sur la TNT gratuite
   (Canal+, C8, NRJ 12, retirees lors de cette meme reforme) -- leur
   numero n'est alors simplement pas affiche par la tuile (numero non
   disponible), plutot que d'afficher une information perimee.

   Default list offered on the tile side. We keep here the mapping
   readable-name -> usual XMLTV ids (several aliases depending on the
   grabber), to help match an XMLTV grid to this list without manual
   configuration. Not exhaustive nor fixed: the tile lets you
   choose/reorder freely.

   tntNumber: official logical channel number (LCN) on free-to-air
   TNT, per the Arcom numbering plan in effect since June 6, 2025 (see
   URL above). Absent for channels no longer carried on free TNT
   (Canal+, C8, NRJ 12, dropped in that same reform) -- their number
   is then simply not shown by the tile (unavailable), rather than
   displaying stale information. */
const DEFAULT_CHANNELS = [
  { name: "TF1", aliases: ["TF1.fr", "C192.api.telerama.fr"], tntNumber: 1 },
  { name: "France 2", aliases: ["France2.fr", "C3.api.telerama.fr"], tntNumber: 2 },
  { name: "France 3", aliases: ["France3.fr", "C4.api.telerama.fr"], tntNumber: 3 },
  { name: "Canal+", aliases: ["CanalPlus.fr", "Canal-plus.fr"] },
  { name: "France 5", aliases: ["France5.fr"], tntNumber: 5 },
  { name: "M6", aliases: ["M6.fr"], tntNumber: 6 },
  { name: "Arte", aliases: ["Arte.fr"], tntNumber: 7 },
  { name: "C8", aliases: ["C8.fr"] },
  { name: "W9", aliases: ["W9.fr"], tntNumber: 9 },
  { name: "TMC", aliases: ["TMC.fr"], tntNumber: 10 },
  { name: "TFX", aliases: ["TFX.fr", "NT1.fr"], tntNumber: 11 },
  { name: "NRJ 12", aliases: ["NRJ12.fr"] },
  { name: "LCP", aliases: ["LCP.fr", "PublicSenat.fr"], tntNumber: 8 },
  { name: "France 4", aliases: ["France4.fr"], tntNumber: 4 },
  { name: "BFM TV", aliases: ["BFMTV.fr"], tntNumber: 13 },
  { name: "CNews", aliases: ["CNews.fr", "Inews.fr"], tntNumber: 14 },
  { name: "CStar", aliases: ["CStar.fr", "Direct8.fr"], tntNumber: 17 },
  { name: "Gulli", aliases: ["Gulli.fr"], tntNumber: 12 },
  { name: "TF1 Séries Films", aliases: ["TF1SeriesFilms.fr", "HD1.fr"], tntNumber: 20 },
  { name: "L'Équipe", aliases: ["LEquipe.fr", "Equipe21.fr"], tntNumber: 21 },
  { name: "6ter", aliases: ["6ter.fr"], tntNumber: 22 },
  { name: "RMC Story", aliases: ["RMCStory.fr", "Numeroe23.fr"], tntNumber: 23 },
  { name: "RMC Découverte", aliases: ["RMCDecouverte.fr"], tntNumber: 24 },
  { name: "Chérie 25", aliases: ["Cherie25.fr"], tntNumber: 25 },
  { name: "LCI", aliases: ["LCI.fr"], tntNumber: 15 },
  { name: "Franceinfo", aliases: ["Franceinfo.fr", "France-info.fr"], tntNumber: 16 },
  { name: "T18", aliases: ["T18.fr"], tntNumber: 18 },
  { name: "Novo 19", aliases: ["Novo19.fr"], tntNumber: 19 },
  { name: "Paris Première", aliases: ["ParisPremiere.fr"], tntNumber: 26 }
];


/* ---------- Utilitaires de date XMLTV / XMLTV date helpers ----------
   XMLTV encode les horaires ainsi : "20240115203000 +0100"
   (YYYYMMDDHHMMSS suivi d'un decalage optionnel). Fonction pure. */
function parseXmltvDate(raw) {
  if (!raw) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(String(raw).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  // Construit une chaine ISO 8601 que Date sait interpreter avec le TZ.
  // Builds an ISO 8601 string Date can parse together with the TZ.
  const off = tz ? tz.slice(0, 3) + ":" + tz.slice(3) : "Z";
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s || "00"}${off}`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/* Recupere une valeur texte multilingue XMLTV, en preferant le
   francais quand plusieurs langues sont fournies. Les elements XMLTV
   comme <title>, <desc> peuvent etre un objet unique, un tableau, ou
   une chaine, d'ou la normalisation. Pure. */
function pickLangText(node, preferLang) {
  if (node == null) return null;
  const arr = Array.isArray(node) ? node : [node];
  const texts = arr.map((n) => {
    if (n == null) return null;
    if (typeof n === "string" || typeof n === "number") return { lang: null, text: String(n) };
    // fast-xml-parser : texte dans "#text", attribut lang dans "@_lang"
    return { lang: n["@_lang"] || null, text: n["#text"] != null ? String(n["#text"]) : null };
  }).filter((x) => x && x.text);
  if (!texts.length) return null;
  const pref = texts.find((t) => t.lang === (preferLang || "fr"));
  return (pref || texts[0]).text;
}

/* Determine le caractere inedit d'un programme XMLTV.
   - <new/> present  -> true
   - <previously-shown/> present -> false
   - aucun des deux  -> null (information absente, cf. Q2 : on n'affiche
     un indicateur que lorsque l'info existe reellement)
   Pure. */
function detectNewFlag(prog) {
  if (prog == null) return null;
  const hasNew = Object.prototype.hasOwnProperty.call(prog, "new");
  const hasPrev = Object.prototype.hasOwnProperty.call(prog, "previously-shown");
  if (hasNew) return true;
  if (hasPrev) return false;
  return null;
}

/* Extrait l'URL d'icone/vignette d'un programme XMLTV (<icon src="..."/>),
   ou null si absente (cf. Q3 : placeholder cote tuile sinon). Pure. */
function pickIcon(prog) {
  const icon = prog && prog.icon;
  if (!icon) return null;
  const first = Array.isArray(icon) ? icon[0] : icon;
  const src = first && first["@_src"];
  return src ? String(src) : null;
}

/* ---------- Parsing XMLTV complet / full XMLTV parsing ----------
   Transforme le XML brut en { channels, programmes } normalises.
   channels : Map id -> { id, name, icon }
   programmes : tableau de programmes normalises (cf. modele commun).
   Pure (prend le XML en chaine, ne touche ni disque ni reseau). */
function parseXmltv(xml, opts) {
  const preferLang = (opts && opts.preferLang) || "fr";
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Force certains elements a toujours etre des tableaux, pour un
    // traitement uniforme quel que soit leur nombre d'occurrences.
    isArray: (name) => ["channel", "programme", "display-name", "title", "desc", "sub-title", "category", "icon"].includes(name),
    /* fast-xml-parser limite par defaut a 1000 le nombre total de
       substitutions d'entites XML (&amp;, &#233;...), protection contre
       les attaques par expansion exponentielle ("billion laughs"). Un
       guide de 400 chaines sur plusieurs jours contient legitimement
       bien plus de 1000 caracteres accentues encodes en entites dans
       les titres/synopsis -- le seuil par defaut, pense pour un
       document XML generique, est bien trop bas pour un XMLTV
       volumineux et declenche l'erreur "Entity expansion limit
       exceeded" sur du contenu parfaitement normal.
       On ne desactive PAS la protection : on la recalibre. Les deux
       reglages qui gardent une vraie valeur defensive sont resserres
       (maxEntityCount, maxExpansionDepth) -- un fichier XMLTV legitime
       ne declare jamais d'entites personnalisees (<!ENTITY> en DOCTYPE)
       ni ne les imbrique, contrairement a une charge "billion laughs".
       Les deux reglages qui bornaient a tort le volume de texte
       ordinaire (maxTotalExpansions, maxExpandedLength) sont eleves a
       des valeurs larges mais toujours finies.

       fast-xml-parser defaults to a total limit of 1000 XML entity
       substitutions (&amp;, &#233;...), a defence against exponential
       expansion attacks ("billion laughs"). A 400-channel, multi-day
       guide legitimately contains far more than 1000 accented
       characters encoded as entities in titles/synopses -- the default
       threshold, sized for a generic XML document, is far too low for
       a large XMLTV file and trips the "Entity expansion limit
       exceeded" error on perfectly normal content.
       This does NOT disable the protection: it recalibrates it. The two
       settings that keep genuine defensive value are tightened
       (maxEntityCount, maxExpansionDepth) -- a legitimate XMLTV file
       never declares custom entities (DOCTYPE <!ENTITY>) nor nests
       them, unlike a "billion laughs" payload. The two settings that
       were wrongly capping ordinary text volume (maxTotalExpansions,
       maxExpandedLength) are raised to large but still finite values. */
    processEntities: {
      enabled: true,
      maxEntityCount: 20,           // XMLTV n'a jamais d'entites personnalisees / XMLTV never has custom entities
      maxExpansionDepth: 5,         // aucune imbrication legitime en XMLTV / no legitimate nesting in XMLTV
      maxEntitySize: 100,           // une entite isolee ne fait que quelques caracteres / a single entity is only a few chars
      maxTotalExpansions: 500000,   // large guide multi-chaines/multi-jours / large multi-channel multi-day guide
      maxExpandedLength: 5000000    // marge generreuse (5 Mo de texte issu d'entites) / generous headroom (5 MB of entity-derived text)
    }
  });
  const doc = parser.parse(xml);
  const tv = doc && doc.tv;
  if (!tv) return { channels: new Map(), programmes: [] };

  const channels = new Map();
  for (const ch of (tv.channel || [])) {
    const id = ch["@_id"];
    if (!id) continue;
    channels.set(String(id), {
      id: String(id),
      name: pickLangText(ch["display-name"], preferLang) || String(id),
      icon: pickIcon(ch)
    });
  }

  const programmes = [];
  for (const p of (tv.programme || [])) {
    const start = parseXmltvDate(p["@_start"]);
    if (!start) continue;
    programmes.push({
      channelId: String(p["@_channel"] || ""),
      start,
      stop: parseXmltvDate(p["@_stop"]),
      title: pickLangText(p.title, preferLang) || "",
      subtitle: pickLangText(p["sub-title"], preferLang),
      desc: pickLangText(p.desc, preferLang),
      category: pickLangText(p.category, preferLang),
      icon: pickIcon(p),
      isNew: detectNewFlag(p)
    });
  }
  return { channels, programmes };
}

/* ---------- Selection de vue / view selection ----------
   Trois vues (cf. Q4) :
     - "now"     : le programme en cours sur chaque chaine a l'instant t
     - "evening" : le programme debutant au plus pres de eveningStart
                   (1re partie de soiree, ~21h) sur chaque chaine
     - "late"    : le programme debutant au plus pres de lateStart
                   (2e partie de soiree, ~22h45) sur chaque chaine
   Fonctions PURES : prennent la liste de programmes deja normalisee, la
   date de reference et les heures de bascule, pour rester testables. */

function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* Construit la Date correspondant a une heure "HH:MM" **en heure de
   Paris** le jour de "ref", quel que soit le fuseau du serveur. On ne
   peut pas se contenter de setHours() : sur un serveur en UTC (ou tout
   autre fuseau), cela donnerait l'heure dans CE fuseau, pas a Paris. On
   passe donc par le decalage effectif de Paris a cette date (gere
   l'heure d'ete/hiver via Intl).
   Builds the Date matching an "HH:MM" time **in Paris local time** on
   ref's day, regardless of the server's timezone. setHours() alone
   won't do: on a UTC server (or any other zone) it would give the time
   in THAT zone, not in Paris. So we go through Paris's effective offset
   at that date (DST-aware via Intl). Pure. */
function parisOffsetMinutes(date) {
  // Difference entre l'heure murale de Paris et l'heure murale UTC pour
  // cet instant, en minutes (ex. +60 en hiver, +120 en ete).
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function targetDateForHour(ref, hhmm) {
  const mins = hhmmToMinutes(hhmm);
  if (mins == null) return null;
  // Composantes calendaires du jour de "ref" telles que vues a Paris.
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const parts = dtf.formatToParts(ref).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const y = Number(parts.year), mo = Number(parts.month), d = Number(parts.day);
  // Instant UTC correspondant a HH:MM a Paris ce jour-la. On calcule le
  // decalage de Paris a une heure de reference proche pour rester juste
  // meme lors des bascules d'heure.
  const approx = new Date(Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0));
  const off = parisOffsetMinutes(approx);
  return new Date(Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0) - off * 60000);
}

function programAtInstant(programmes, channelId, instant) {
  const t = instant.getTime();
  let current = null;
  for (const p of programmes) {
    if (p.channelId !== channelId) continue;
    const s = p.start.getTime();
    const e = p.stop ? p.stop.getTime() : s + 3600000; // defaut 1h si fin absente / default 1h if stop missing
    if (s <= t && t < e) {
      if (!current || s > current.start.getTime()) current = p;
    }
  }
  return current;
}

/* Duree d'un programme en minutes. Repli a 60 min si la fin est
   absente de la source -- generalement suffisant pour ne pas exclure a
   tort un programme dont on ignore juste la duree exacte.
   A program's duration in minutes. Falls back to 60 min if the source
   doesn't provide an end time -- generally enough to avoid wrongly
   excluding a program whose exact duration is simply unknown. */
function programDurationMinutes(p) {
  const s = p.start.getTime();
  const e = p.stop ? p.stop.getTime() : s + 3600000;
  return (e - s) / 60000;
}

/* Programme d'une chaine representant la "vraie" emission de soiree
   proche d'une heure cible -- PAS simplement celui dont le debut est le
   plus proche. En television francaise, l'heure cible (21h, 22h45...)
   est souvent occupee par une case courte (meteo, bande-annonce,
   transition entre 2 pages de pub) avant l'emission principale, qui
   peut demarrer 5-15 min plus tard mais dure bien plus longtemps.
   On filtre donc d'abord les programmes trop courts (< minDurationMin)
   dans la fenetre de tolerance, puis on prend, parmi les survivants,
   celui dont le debut est le plus proche de la cible. Si aucun
   programme de la fenetre n'atteint la duree minimale (source
   incomplete, grille inhabituelle...), on se rabat sur l'ensemble des
   candidats pour ne jamais retourner "rien" alors qu'il y a une grille.
   A channel's "real" evening program near a target hour -- NOT simply
   the one whose start is closest. On French TV, the target hour (9pm,
   10:45pm...) is often filled by a short segment (weather, trailer, a
   bridge between two ad breaks) before the main show, which may start
   5-15 min later but runs far longer.
   So we first filter out programs shorter than minDurationMin within
   the tolerance window, then take, among survivors, the one whose
   start is closest to the target. If nothing in the window reaches the
   minimum duration (incomplete source, unusual schedule...), we fall
   back to the full candidate set so we never return nothing when a
   grid actually exists. */
function programNearHour(programmes, channelId, targetDate, toleranceBeforeMin, toleranceAfterMin, minDurationMin) {
  const target = targetDate.getTime();
  const before = target - (toleranceBeforeMin || 30) * 60000;
  const after = target + (toleranceAfterMin || 90) * 60000;
  const candidates = [];
  for (const p of programmes) {
    if (p.channelId !== channelId) continue;
    const s = p.start.getTime();
    if (s < before || s > after) continue;
    candidates.push(p);
  }
  if (!candidates.length) return null;

  // Programme dont le debut est le plus proche de la cible, dans une
  // liste donnee -- utilise quand aucun filtre de duree n'est demande,
  // et en repli quand rien n'atteint le seuil minimal.
  function closestToTarget(list) {
    let best = null;
    let bestDelta = Infinity;
    for (const p of list) {
      const delta = Math.abs(p.start.getTime() - target);
      if (delta < bestDelta) { best = p; bestDelta = delta; }
    }
    return best;
  }

  if (!minDurationMin) return closestToTarget(candidates);

  const long = candidates.filter((p) => programDurationMinutes(p) >= minDurationMin);
  if (!long.length) return closestToTarget(candidates); // repli : rien n'atteint le seuil / fallback: nothing meets the threshold

  // Parmi les programmes assez longs, celui qui dure le PLUS
  // l'emporte -- pas forcement celui dont le debut est le plus proche
  // de la cible. Certaines chaines (TMC en particulier) demarrent leur
  // programme du soir tot (~20h20) ; un intercalaire (publicite,
  // bande-annonces, transition) diffuse ensuite, plus proche de 21h,
  // peut lui-meme durer assez longtemps pour passer le filtre de duree
  // -- mais il reste presque toujours plus court que la vraie emission
  // qui l'entoure. Prendre le plus long plutot que le plus proche
  // evite de se faire piegier par ce genre d'intercalaire.
  // Among programs long enough, the LONGEST one wins -- not
  // necessarily the one whose start is closest to the target. Some
  // channels (TMC in particular) start their evening program early
  // (~8:20pm); an interstitial (ads, trailers, transition) aired
  // afterwards, closer to 9pm, can itself last long enough to pass the
  // duration filter -- but it's almost always shorter than the real
  // show surrounding it. Picking the longest rather than the closest
  // avoids falling for that kind of interstitial.
  let best = long[0];
  for (const p of long) {
    if (programDurationMinutes(p) > programDurationMinutes(best)) best = p;
  }
  return best;
}

/* Construit la vue demandee : pour chaque chaine (dans l'ordre fourni),
   le programme correspondant a la vue, ou null si rien de pertinent.
   channelsOrder : tableau d'identifiants de chaine (source) dans
   l'ordre d'affichage souhaite. Pure. */
/* Convertit une difference "borne - cible" en minutes, positive
   uniquement (une borne du mauvais cote de la cible est ignoree au
   profit du repli). Permet d'exprimer les tolerances de
   programNearHour a partir d'heures ABSOLUES (ex. "21:30") plutot que
   d'un nombre de minutes arbitraire, ce qui reste correct quel que
   soit l'heure cible choisie par l'utilisateur.
   Converts a "bound - target" difference to minutes, positive only (a
   bound on the wrong side of the target is ignored in favor of the
   fallback). Lets programNearHour's tolerances be expressed from
   ABSOLUTE times (e.g. "21:30") rather than an arbitrary minute count,
   which stays correct whatever target hour the user picks. */
function minutesFromBound(targetHHMM, boundHHMM, fallbackMin) {
  const t = hhmmToMinutes(targetHHMM);
  const b = hhmmToMinutes(boundHHMM);
  if (t == null || b == null) return fallbackMin;
  const diff = Math.abs(b - t);
  return diff > 0 ? diff : fallbackMin;
}

function buildView(programmes, channelsOrder, view, ref, opts) {
  const o = opts || {};
  const eveningStart = o.eveningStart || "21:00";
  const lateStart = o.lateStart || "22:45";
  // Duree minimale (minutes) pour qu'un programme soit considere comme
  // "la vraie emission" plutot qu'une case courte de transition.
  // 1re partie : releve a 30 min par defaut (v1.7.1) -- la fenetre de
  // demarrage plafonnee ci-dessous filtre desormais la 2e partie de
  // soiree independamment de la duree, donc un seuil de duree plus bas
  // suffit pour ecarter les intercalaires courts sans risquer de
  // reprendre un programme de 2e partie.
  // 2e partie : souvent plus courte (debat, documentaire), seuil plus
  // bas.
  // Minimum duration (minutes) for a program to count as "the real
  // show" rather than a short transition slot.
  // 1st part: raised to 30 min by default (v1.7.1) -- the capped start
  // window below now filters out second-part-evening programs
  // independently of duration, so a lower duration threshold is enough
  // to discard short interstitials without risking picking up a
  // second-part-evening program.
  // 2nd part: often shorter (debate, documentary), lower threshold.
  const eveningMinDuration = o.eveningMinDurationMinutes != null ? o.eveningMinDurationMinutes : 30;
  const lateMinDuration = o.lateMinDurationMinutes != null ? o.lateMinDurationMinutes : 20;

  /* Bornes ABSOLUES de la fenetre de demarrage pour la 1re partie de
     soiree. La borne haute (21h30 par defaut) est ce qui EMPECHE un
     programme de 2e partie (souvent diffuse a partir de 22h) d'entrer
     dans la comparaison, meme s'il est tres long -- c'est la correction
     du bug signale (v1.7.1) : avant cette version, la tolerance
     apres-cible etait fixee a 90 min (soit 22h30 pour une cible a 21h),
     assez large pour laisser un programme de 22h l'emporter sur la
     "plus longue duree" au sein de la fenetre.

     La borne basse (20h15 par defaut, resserree en v1.34.0) doit rester
     assez tot pour ne pas exclure les chaines qui demarrent leur
     programme principal avant l'heure cible (TMC, generalement des
     20h20-20h30), tout en excluant les longs magazines diffuses avant
     la vraie soiree -- le bug signale cette fois : "Stade 2" sur
     France 3 (dimanche, ~20h05-20h10, 65 min) est plus long que bien
     des programmes de soiree, et l'emportait donc a tort sur la vraie
     1re partie via la regle "le plus long gagne" quand la borne basse
     etait a 20h00. Un ecart de 10-15 minutes separe les deux cas
     (Stade 2 vs TMC), d'ou le choix de 20h15 comme nouveau defaut.

     ABSOLUTE bounds of the start window for prime time. The upper bound
     (9:30pm by default) is what PREVENTS a second-part-evening program
     (usually airing from 10pm) from entering the comparison, even if
     very long -- this is the fix for the reported bug (v1.7.1): before
     this version, the after-target tolerance was fixed at 90 min (i.e.
     10:30pm for a 9pm target), wide enough to let a 10pm program win
     the "longest duration" comparison within the window.

     The lower bound (8:15pm by default, tightened in v1.34.0) must stay
     early enough not to exclude channels that start their main show
     ahead of the target hour (TMC, typically from 8:20-8:30pm), while
     excluding long-running magazines airing before actual prime time --
     this time's reported bug: "Stade 2" on France 3 (Sunday, ~8:05-
     8:10pm, 65 min) outlasts many prime-time programs, so it wrongly
     won over the real prime-time show via the "longest wins" rule when
     the lower bound was 8:00pm. A 10-15 minute gap separates the two
     cases (Stade 2 vs TMC), hence 8:15pm as the new default. */
  const eveningEarliestStart = o.eveningEarliestStart || "20:15";
  const eveningLatestStart = o.eveningLatestStart || "21:30";
  const eveningToleranceBefore = minutesFromBound(eveningStart, eveningEarliestStart, 60);
  const eveningToleranceAfter = minutesFromBound(eveningStart, eveningLatestStart, 30);

  const out = [];
  for (const channelId of channelsOrder) {
    let prog = null;
    if (view === "now") {
      prog = programAtInstant(programmes, channelId, ref);
    } else if (view === "evening") {
      prog = programNearHour(
        programmes, channelId, targetDateForHour(ref, eveningStart),
        eveningToleranceBefore, eveningToleranceAfter, eveningMinDuration
      );
    } else if (view === "late") {
      prog = programNearHour(programmes, channelId, targetDateForHour(ref, lateStart), 30, 120, lateMinDuration);
    }
    out.push({ channelId, program: prog });
  }

  return out;
}

/* ---------- Recuperation source / source fetching ---------- */

/* Recupere le contenu texte d'une source XMLTV : chemin local ou URL
   http(s), avec decompression gzip transparente quand l'URL se termine
   par .gz (ou .xml.gz). Les fichiers XMLTV publics sont quasi toujours
   servis en gzip pour economiser la bande passante ; on decompresse
   cote serveur pour que le parseur recoive du XML texte.
   Fetches the text content of an XMLTV source: local path or http(s)
   URL, with transparent gzip decompression when the URL ends in .gz
   (or .xml.gz). Public XMLTV files are almost always served gzipped to
   save bandwidth; we decompress server-side so the parser gets text
   XML. */
async function fetchText(urlOrPath, fetchImpl) {
  const isGz = /\.gz($|\?)/i.test(urlOrPath);
  // Chemin local (pas de schema http) : lecture fichier.
  // Local path (no http scheme): file read.
  if (!/^https?:\/\//i.test(urlOrPath)) {
    const buf = await fs.promises.readFile(urlOrPath);
    return isGz ? zlib.gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  }
  const doFetch = fetchImpl || global.fetch;
  const res = await doFetch(urlOrPath);
  if (!res.ok) throw new Error("HTTP " + res.status + " sur " + urlOrPath);
  if (isGz) {
    const ab = await res.arrayBuffer();
    return zlib.gunzipSync(Buffer.from(ab)).toString("utf8");
  }
  return res.text();
}

/* Essaie plusieurs URL candidates dans l'ordre et retourne le texte de
   la premiere qui aboutit. Sert a viser xmltvfr.fr dont les noms de
   fichiers exacts peuvent varier (voir XMLTVFR_*_CANDIDATES).
   Tries several candidate URLs in order and returns the text of the
   first that succeeds. Used to target xmltvfr.fr whose exact filenames
   may vary (see XMLTVFR_*_CANDIDATES). */
async function fetchFirstAvailable(urls, fetchImpl) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const text = await fetchText(url, fetchImpl);
      if (text && text.indexOf("<tv") !== -1) return { url, text };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error("aucune source xmltvfr disponible" + (lastErr ? " (" + lastErr.message + ")" : ""));
}

/* ---------- Adaptateurs de scraping / scraping adapters ----------
   ATTENTION : le scraping est fragile par nature. Chaque adaptateur est
   specifique a un site et son HTML ; si le site change sa structure,
   l'adaptateur cesse de fonctionner et doit etre mis a jour. XMLTV
   reste la source recommandee. Un adaptateur recoit le HTML brut d'une
   page et l'heure de reference, et retourne { channels, programmes } au
   meme format normalise que parseXmltv.

   WARNING: scraping is inherently fragile. Each adapter is specific to
   one site and its HTML; if the site changes its structure, the adapter
   stops working and must be updated. XMLTV remains the recommended
   source. An adapter receives a page's raw HTML and the reference time,
   and returns { channels, programmes } in the same normalized shape as
   parseXmltv.

   Les adaptateurs concrets sont volontairement laisses a brancher sur
   un site reel (le HTML exact doit etre observe sur place). La
   mecanique d'appel et de normalisation est en place ; il ne reste qu'a
   ecrire le selecteur DOM du site retenu dans un adaptateur.
   Concrete adapters are intentionally left to be wired to a real site
   (the exact HTML must be observed there). The call and normalization
   machinery is in place; only the chosen site's DOM selectors remain to
   be written in an adapter. */
const scrapeAdapters = {
  // Exemple de squelette d'adaptateur, a completer avec les selecteurs
  // reels du site. Retourne le format normalise commun.
  // Example adapter skeleton, to be completed with the site's real
  // selectors. Returns the common normalized shape.
  generic(/* html, ref */) {
    return { channels: new Map(), programmes: [] };
  }
};

/* ---------- Cache en memoire / in-memory cache ----------
   Evite de retelecharger/reparser la grille a chaque requete de la
   tuile. Cle = source + reference (url/chemin/adaptateur). */
const cache = new Map();
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min

function cacheKey(source, ref) {
  return source + "::" + ref;
}

async function loadGrid(config, deps) {
  const d = deps || {};
  const now = d.now || Date.now();
  const ttl = config.ttlMs || DEFAULT_TTL_MS;
  const source = config.source || "xmltv";

  let key, loader;
  if (source === "xmltvfr") {
    // Source integree cle en main : xmltvfr.fr, fichier TNT par defaut
    // (ou France si "france" demande). Rien a configurer cote
    // utilisateur. Built-in turnkey source.
    const wantFrance = config.xmltvfrGuide === "france";
    const names = wantFrance ? XMLTVFR_FRANCE_CANDIDATES : XMLTVFR_TNT_CANDIDATES;
    const urls = names.map((n) => XMLTVFR_BASE + n);
    key = cacheKey("xmltvfr", wantFrance ? "france" : "tnt");
    loader = async () => {
      const { text } = await fetchFirstAvailable(urls, d.fetchImpl);
      return parseXmltv(text, { preferLang: config.preferLang });
    };
  } else if (source === "xmltv") {
    if (!config.xmltvUrl) throw new Error("xmltvUrl manquant");
    key = cacheKey("xmltv", config.xmltvUrl);
    loader = async () => parseXmltv(await fetchText(config.xmltvUrl, d.fetchImpl), { preferLang: config.preferLang });
  } else if (source === "scrape") {
    const adapterName = config.scrapeAdapter || "generic";
    const adapter = scrapeAdapters[adapterName];
    if (!adapter) throw new Error("adaptateur de scraping inconnu: " + adapterName);
    if (!config.scrapeUrl) throw new Error("scrapeUrl manquant");
    key = cacheKey("scrape:" + adapterName, config.scrapeUrl);
    loader = async () => adapter(await fetchText(config.scrapeUrl, d.fetchImpl), new Date(now));
  } else {
    throw new Error("source inconnue: " + source);
  }

  const hit = cache.get(key);
  if (hit && (now - hit.at) < ttl) return hit.grid;
  const grid = await loader();
  cache.set(key, { at: now, grid });
  return grid;
}

function clearCache() {
  cache.clear();
}

/* ---------- Point d'entree de haut niveau / high-level entry ----------
   Charge la grille (avec cache) et construit la vue demandee pour la
   liste de chaines fournie. Retourne un objet pret a serialiser pour la
   tuile : chaque entree porte le nom de chaine, son icone eventuelle,
   et le programme correspondant a la vue (ou null). */
async function getView(config, deps) {
  const grid = await loadGrid(config, deps);
  const ref = new Date((deps && deps.now) || Date.now());
  const view = config.view || "now";

  /* channelsWanted : liste fournie par la tuile. Chaque entree peut
     etre soit un identifiant XMLTV exact (ex. "France2.fr"), soit un
     nom lisible (ex. "France 2"). On resout chaque entree vers
     l'identifiant reellement present dans la grille, en essayant dans
     l'ordre : identifiant exact, alias connu (DEFAULT_CHANNELS),
     rapprochement souple sur le nom d'affichage de la grille.
     channelsWanted: list provided by the tile. Each entry is either an
     exact XMLTV id (e.g. "France2.fr") or a readable name (e.g.
     "France 2"). We resolve each to the id actually present in the
     grid, trying in order: exact id, known alias (DEFAULT_CHANNELS),
     loose match on the grid's display name. */
  const wanted = (config.channels && config.channels.length)
    ? config.channels
    : Array.from(grid.channels.keys());

  const channelsOrder = wanted.map((entry) => resolveChannelId(entry, grid.channels)).filter(Boolean);

  const rows = buildView(grid.programmes, channelsOrder, view, ref, {
    eveningStart: config.eveningStart,
    lateStart: config.lateStart,
    eveningEarliestStart: config.eveningEarliestStart,
    eveningLatestStart: config.eveningLatestStart,
    eveningMinDurationMinutes: config.eveningMinDurationMinutes,
    lateMinDurationMinutes: config.lateMinDurationMinutes
  });

  return {
    view,
    generatedAt: ref.toISOString(),
    channels: rows.map((r) => {
      const ch = grid.channels.get(r.channelId);
      const chName = ch ? ch.name : r.channelId;
      return {
        channelId: r.channelId,
        channelName: chName,
        channelIcon: ch ? ch.icon : null,
        // Numero TNT (LCN) officiel, si la chaine en a encore un sur la
        // TNT gratuite (voir DEFAULT_CHANNELS plus haut) -- rapproche le
        // nom tel qu'affiche dans la grille XMLTV de la reference
        // Arcom via le meme index d'alias que resolveChannelId().
        // Absent (null) si la chaine n'est pas reconnue ou n'a plus de
        // canal gratuit (ex. Canal+, C8, NRJ 12).
        // Official TNT logical channel number, if the channel still has
        // one on free-to-air TNT (see DEFAULT_CHANNELS above) -- matches
        // the name as shown in the XMLTV grid against the Arcom
        // reference via the same alias index used by resolveChannelId().
        // Absent (null) if the channel isn't recognized or no longer has
        // a free channel (e.g. Canal+, C8, NRJ 12).
        channelNumber: (ALIAS_INDEX.get(normalizeChannelKey(chName)) || {}).tntNumber || null,
        program: r.program ? {
          start: r.program.start.toISOString(),
          stop: r.program.stop ? r.program.stop.toISOString() : null,
          title: r.program.title,
          subtitle: r.program.subtitle,
          desc: r.program.desc,
          category: r.program.category,
          icon: config.showThumbnails === false ? null : r.program.icon,
          isNew: r.program.isNew
        } : null
      };
    })
  };
}

/* Normalise un libelle pour comparaison souple : minuscules, sans
   accents, sans espaces ni ponctuation. "France 2" ~ "france2". Pure. */
function normalizeChannelKey(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Table alias-normalise -> nom lisible, construite une fois depuis
   DEFAULT_CHANNELS, pour rapprocher un nom saisi de ses identifiants
   XMLTV connus. */
const ALIAS_INDEX = (() => {
  const idx = new Map();
  for (const ch of DEFAULT_CHANNELS) {
    idx.set(normalizeChannelKey(ch.name), ch);
    for (const a of ch.aliases) idx.set(normalizeChannelKey(a), ch);
  }
  return idx;
})();

/* Resout une entree (identifiant ou nom) vers un identifiant present
   dans la grille. Pure (prend la Map des chaines de la grille). */
function resolveChannelId(entry, gridChannels) {
  // 1. Identifiant exact present dans la grille.
  if (gridChannels.has(entry)) return entry;
  const key = normalizeChannelKey(entry);
  // 2. Alias connu -> on cherche un identifiant de la grille qui matche
  //    l'un des alias de cette chaine, ou son nom.
  const known = ALIAS_INDEX.get(key);
  if (known) {
    for (const a of known.aliases) {
      if (gridChannels.has(a)) return a;
    }
    // Repli : une chaine de la grille dont le nom d'affichage correspond.
    for (const [id, ch] of gridChannels) {
      if (normalizeChannelKey(ch.name) === normalizeChannelKey(known.name)) return id;
    }
  }
  // 3. Rapprochement direct sur le nom d'affichage de la grille.
  for (const [id, ch] of gridChannels) {
    if (normalizeChannelKey(ch.name) === key) return id;
  }
  return null;
}

module.exports = {
  // fonctions pures (testees)
  parseXmltvDate,
  pickLangText,
  detectNewFlag,
  pickIcon,
  parseXmltv,
  hhmmToMinutes,
  targetDateForHour,
  programAtInstant,
  programDurationMinutes,
  programNearHour,
  buildView,
  normalizeChannelKey,
  resolveChannelId,
  // chargement / cache
  loadGrid,
  getView,
  clearCache,
  scrapeAdapters,
  DEFAULT_CHANNELS
};
