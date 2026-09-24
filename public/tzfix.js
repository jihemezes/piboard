/* ============================================================
   PiBoard - public/tzfix.js
   Rattrapage des fuseaux horaires dont la base embarquee est perimee.

   LE PROBLEME. PiBoard n'embarque aucune table de fuseaux : l'horloge
   lit l'heure d'un fuseau via Intl.DateTimeFormat, donc via la base
   tzdata compilee dans ICU. Or cette base est figee au moment de la
   construction du navigateur : Chromium et Electron embarquent la
   leur et ne lisent PAS /usr/share/zoneinfo. Mettre a jour Windows,
   Raspberry Pi OS ou le paquet tzdata du systeme ne change donc rien
   a ce qu'affiche PiBoard. Quand un pays change d'heure legale, il
   faut attendre une tzdata a jour dans ICU, puis une version de
   Chromium/Electron qui l'embarque, puis une reconstruction de
   PiBoard -- plusieurs mois, pendant lesquels l'ecran mural est faux.

   CAS FONDATEUR. Le Maroc (decret n° 2.26.530, BO du 29 juin 2026)
   est repasse a GMT/UTC+0 le dimanche 20 septembre 2026 a 02h00
   locales, de facon permanente, et l'exception qui faisait basculer
   le pays a UTC pendant le Ramadan disparait. Une ICU 78.2 (tzdata
   2025c) rend toujours Africa/Casablanca a UTC+1.

   LE PRINCIPE. Une table d'overrides DATEE ci-dessous. Pour chaque
   fuseau concerne, on demande a Intl le decalage qu'il croit, on le
   compare a celui que la table annonce, et on ne corrige QUE s'ils
   different. Consequence utile : le jour ou Electron rattrape son
   retard, la comparaison tombe juste, la correction ne s'applique
   plus d'elle-meme, et la ligne de la table devient inerte sans
   qu'il faille y revenir. Une table figee qui corrigerait en aveugle
   aurait au contraire casse l'affichage a ce moment-la.

   PORTEE ASSUMEE. Ces overrides decrivent un decalage FIXE a partir
   d'un instant donne. C'est exactement la forme des changements
   d'heure legale recents (abandon ou adoption d'un decalage
   permanent). Un pays qui garderait une heure d'ete saisonniere ne
   peut pas etre decrit ici : il faudrait embarquer ses regles, ce
   qui reviendrait a embarquer une tzdata -- refuse. Dans ce cas, la
   seule issue reste la mise a jour d'Electron.

   ------------------------------------------------------------
   Catching up time zones whose embedded database is out of date.

   THE PROBLEM. PiBoard ships no time zone table: the clock reads a
   zone's time through Intl.DateTimeFormat, hence through the tzdata
   compiled into ICU. That database is frozen when the browser is
   built: Chromium and Electron embed their own and do NOT read
   /usr/share/zoneinfo. Updating Windows, Raspberry Pi OS or the
   system's tzdata package therefore changes nothing in what PiBoard
   displays.

   FOUNDING CASE. Morocco (decree n° 2.26.530) moved back to
   GMT/UTC+0 on Sunday 20 September 2026 at 02:00 local, permanently,
   and the Ramadan exception is abolished. ICU 78.2 (tzdata 2025c)
   still renders Africa/Casablanca at UTC+1.

   THE PRINCIPLE. A DATED override table below. For each zone
   concerned we ask Intl what offset it believes, compare it with the
   table's, and correct ONLY when they differ -- so the correction
   disappears by itself once Electron catches up.

   SCOPE. These overrides describe a FIXED offset from a given
   instant, which is exactly the shape of recent legal time changes.
   A zone keeping a seasonal DST cannot be described here: that would
   mean embedding tzdata, which is refused.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PiBoardTzFix = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Table des corrections. Une entree par changement d'heure legale
     qu'ICU peut ignorer.
       zone   : nom IANA, tel qu'ecrit dans les reglages
       from   : instant UTC (ms) a partir duquel la regle s'applique
       offset : decalage FIXE en minutes par rapport a UTC
       label  : ce qu'on montre a l'utilisateur dans le diagnostic
       source : la reference officielle, pour pouvoir verifier
     Plusieurs entrees pour un meme fuseau sont permises : la plus
     recente dont `from` est passe l'emporte.

     The correction table. One entry per legal time change ICU may be
     unaware of. Several entries per zone are allowed: the most recent
     one whose `from` has passed wins. */
  const OVERRIDES = [
    {
      zone: "Africa/Casablanca",
      from: Date.UTC(2026, 8, 20, 1, 0, 0), // 20/09/2026 02:00 locales = 01:00 UTC
      offset: 0,
      label: { fr: "Maroc — retour a GMT (UTC+0)", en: "Morocco — back to GMT (UTC+0)" },
      source: "Decret n° 2.26.530, BO du 29/06/2026"
    }
  ];

  /* Decalage, en minutes, que la base embarquee CROIT pour ce fuseau a
     cet instant. Technique standard : on demande a Intl l'heure murale
     du fuseau, on la relit comme si elle etait UTC, et l'ecart avec
     l'instant reel est le decalage. Renvoie null si le fuseau est
     inconnu de la base (nom invalide, ou navigateur sans Intl).

     The offset, in minutes, that the embedded database BELIEVES for
     this zone at this instant. Returns null when the zone is unknown. */
  function intlOffsetMinutes(zone, date) {
    if (!zone) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).formatToParts(date);
      const get = (type) => {
        const p = parts.find((x) => x.type === type);
        return p ? Number(p.value) : NaN;
      };
      const wall = Date.UTC(get("year"), get("month") - 1, get("day"),
        get("hour") % 24, get("minute"), get("second"));
      if (!isFinite(wall)) return null;
      // L'instant est arrondi a la seconde des deux cotes : Intl ne
      // rend pas les millisecondes, les garder fausserait l'ecart.
      // Both sides rounded to the second: Intl yields no milliseconds.
      return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    } catch (e) {
      return null;
    }
  }

  /* Decalage que la table annonce pour ce fuseau a cet instant, ou
     null si aucune regle ne le couvre (cas de l'immense majorite des
     fuseaux, qui n'ont pas a etre corriges).
     The offset the table announces, or null when no rule covers it. */
  function expectedOffsetMinutes(zone, date) {
    const t = date.getTime();
    let best = null;
    for (const rule of OVERRIDES) {
      if (rule.zone !== zone || t < rule.from) continue;
      if (!best || rule.from > best.from) best = rule;
    }
    return best ? best.offset : null;
  }

  function ruleFor(zone, date) {
    const t = date.getTime();
    let best = null;
    for (const rule of OVERRIDES) {
      if (rule.zone !== zone || t < rule.from) continue;
      if (!best || rule.from > best.from) best = rule;
    }
    return best;
  }

  /* Minutes a AJOUTER a l'heure rendue par la base embarquee pour
     retomber sur l'heure legale. 0 = rien a corriger, ce qui est le
     cas normal : soit le fuseau n'est pas dans la table, soit la base
     est deja a jour.
     Minutes to ADD to the embedded database's time. 0 = nothing to
     correct, which is the normal case. */
  function correctionMinutes(zone, date) {
    const expected = expectedOffsetMinutes(zone, date);
    if (expected === null) return 0;
    const actual = intlOffsetMinutes(zone, date);
    if (actual === null) return 0;
    return expected - actual;
  }

  /* Vrai quand la base embarquee est en retard SUR CE FUSEAU.
     True when the embedded database lags on THIS zone. */
  function isStale(zone, date) {
    return correctionMinutes(zone, date || new Date()) !== 0;
  }

  /* Heure murale d'un fuseau, corrigee. Remplace le calcul qui vivait
     dans la tuile Horloge : meme contrat, meme repli silencieux sur
     l'heure du systeme si le fuseau est vide ou invalide. L'objet rendu
     porte l'heure du fuseau dans ses champs LOCAUX (getHours()...) : il
     sert a LIRE des composantes a afficher, jamais a calculer une duree
     entre deux instants.

     A zone's wall-clock time, corrected. Same contract as the
     calculation that used to live in the Clock tile, including the
     silent fallback to system time. */
  function nowInZone(zone, now) {
    const ref = now || new Date();
    if (!zone) return new Date(ref.getTime());
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).formatToParts(ref);
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      const d = new Date(
        get("year"), get("month") - 1, get("day"),
        get("hour") % 24, get("minute"), get("second")
      );
      const corr = correctionMinutes(zone, ref);
      if (corr) d.setTime(d.getTime() + corr * 60000);
      return d;
    } catch (e) {
      return new Date(ref.getTime()); // nom de fuseau invalide / invalid zone name
    }
  }

  /* Liste des fuseaux actuellement corriges -- sert a marquer les
     entrees concernees dans le selecteur de fuseau.
     Zones currently corrected -- used to flag them in the picker. */
  function correctedZones(now) {
    const ref = now || new Date();
    const seen = new Set();
    const out = [];
    for (const rule of OVERRIDES) {
      if (seen.has(rule.zone)) continue;
      seen.add(rule.zone);
      if (correctionMinutes(rule.zone, ref) !== 0) out.push(rule.zone);
    }
    return out;
  }

  function formatOffset(minutes) {
    if (minutes === null || minutes === undefined) return "?";
    if (minutes === 0) return "UTC";
    const sign = minutes < 0 ? "-" : "+";
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return "UTC" + sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
  }

  /* Rapport de diagnostic : ce que la base embarquee croit, ce que la
     loi dit, et ce que PiBoard corrige. Fonction pure, sans DOM --
     l'affichage est fait par l'appelant (voir la rubrique « A propos »
     de l'aide).
     Diagnostic report: pure, DOM-free; the caller renders it. */
  function report(now) {
    const ref = now || new Date();
    const zones = [];
    const seen = new Set();
    for (const rule of OVERRIDES) {
      if (seen.has(rule.zone)) continue;
      seen.add(rule.zone);
      const active = ruleFor(rule.zone, ref);
      if (!active) continue; // regle pas encore entree en vigueur / not yet in force
      const embedded = intlOffsetMinutes(rule.zone, ref);
      const expected = active.offset;
      zones.push({
        zone: rule.zone,
        label: active.label,
        source: active.source,
        embedded: embedded,
        embeddedText: formatOffset(embedded),
        expected: expected,
        expectedText: formatOffset(expected),
        corrected: embedded !== null && embedded !== expected
      });
    }
    return {
      zones: zones,
      correctedCount: zones.filter((z) => z.corrected).length,
      upToDate: zones.length > 0 && zones.every((z) => !z.corrected),
      checkedAt: ref.toISOString()
    };
  }

  return {
    OVERRIDES: OVERRIDES,
    intlOffsetMinutes: intlOffsetMinutes,
    expectedOffsetMinutes: expectedOffsetMinutes,
    correctionMinutes: correctionMinutes,
    isStale: isStale,
    nowInZone: nowInZone,
    correctedZones: correctedZones,
    formatOffset: formatOffset,
    report: report
  };
});
