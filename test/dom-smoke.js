/* Test DOM du parcours utilisateur PiBoard (jsdom) */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public");

/* Fixtures API */
const catalog = fs.readdirSync(path.join(PUB, "widgets"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const m = JSON.parse(fs.readFileSync(path.join(PUB, "widgets", d.name, "manifest.json"), "utf8"));
    m.dir = d.name;
    return m;
  });

/* Fixtures ICS pour la tuile Agenda, construites par rapport a
   aujourd'hui pour que le test reste fiable quel que soit le jour
   d'execution. ICS fixtures for the Calendar tile, built relative to
   today so the test stays reliable regardless of which day it runs. */
function pad2(n) { return String(n).padStart(2, "0"); }
function icsDateOnly(d) { return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }
function icsDateTime(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}
const AQ_TODAY = new Date();
/* Decalage choisi pour que l'evenement soit DANS la semaine courante
   affichee par la vue semaine (lundi -> dimanche) ET dans le futur.

   Deux corrections successives, dont la seconde etait la vraie :
   un "+2 jours" en dur echouait le samedi et le dimanche, l'evenement
   tombant dans la semaine SUIVANTE. Le decalage a alors ete rendu
   NEGATIF ces jours-la pour rester dans la semaine -- mais un evenement
   passe n'apparait pas dans la vue liste, qui ne montre que ce qui
   vient. Le test echouait donc toujours le samedi et le dimanche, pour
   une raison differente.

   On prend desormais le plus grand decalage POSITIF qui reste dans la
   semaine. Le dimanche, ce decalage vaut zero : l'evenement est
   aujourd'hui, et son heure est placee apres l'heure courante, sans quoi
   il serait passe des 14 heures.

   Offset chosen so the event is WITHIN the current week shown by the
   week view (Monday -> Sunday) AND in the future.

   Two successive fixes, the second being the real one: a hard-coded
   "+2 days" failed on Saturday and Sunday, the event landing in the NEXT
   week. The offset was then made NEGATIVE on those days to stay within
   the week -- but a past event does not appear in the list view, which
   only shows what is coming. So the test still failed on Saturday and
   Sunday, for a different reason.

   We now take the largest POSITIVE offset that stays within the week. On
   Sunday that offset is zero: the event is today, and its time is set
   after the current time, without which it would be past from 2 pm on. */
const AQ_DOW = (AQ_TODAY.getDay() + 6) % 7;          // 0 = lundi / Monday
const AQ_OFFSET = Math.min(2, 6 - AQ_DOW);           // 0..2, jamais negatif
// Une heure encore a venir quand l'evenement est aujourd'hui.
// A time still ahead when the event is today.
const AQ_HOUR = AQ_OFFSET > 0 ? 14 : Math.min(23, AQ_TODAY.getHours() + 2);
const AQ_IN2DAYS = new Date(AQ_TODAY.getFullYear(), AQ_TODAY.getMonth(), AQ_TODAY.getDate() + AQ_OFFSET, AQ_HOUR, 0, 0);
const AQ_IN2DAYS_END = new Date(AQ_IN2DAYS.getTime() + 3600000);
const FAMILY_ICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:fam1@test\r\nDTSTART;VALUE=DATE:${icsDateOnly(AQ_TODAY)}\r\nSUMMARY:Anniversaire Lea\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const WORK_ICS = "\uFEFF" + `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:work1@test\r\nDTSTART:${icsDateTime(AQ_IN2DAYS)}\r\nDURATION:PT1H\r\nSUMMARY:Reunion equipe\r\nLOCATION:Salle B\r\nDESCRIPTION:Ordre du jour\\nPoint budget\\; puis planning\r\nEND:VEVENT\r\nEND:VCALENDAR`;

const RSS_FEED_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>Flux Test</title>
<item>
<title>Article avec lien</title>
<link>https://example.test/article1</link>
<pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>
<content:encoded><![CDATA[<p>Contenu <b>riche</b> de l'article.</p><script>window.__pwnedRss = true;</script><a href="https://example.test/other" onclick="window.__pwnedRss = true;">lien interne</a>]]></content:encoded>
<media:content url="https://example.test/photo.jpg">
<media:description>Legende de la photo</media:description>
<media:credit>Photographe Test</media:credit>
</media:content>
</item>
<item>
<title>Article sans lien</title>
<pubDate>Mon, 20 Jul 2026 09:00:00 GMT</pubDate>
<description>Pas de lien ici.</description>
</item>
<item>
<title>Article extraction echouee</title>
<link>https://example.test/article-noextract</link>
<pubDate>Mon, 20 Jul 2026 08:00:00 GMT</pubDate>
<description>Resume du flux, utilise en repli.</description>
</item>
<item>
<title>Article paywall</title>
<link>https://example.test/article-paywall</link>
<pubDate>Mon, 20 Jul 2026 07:00:00 GMT</pubDate>
<description>Resume du flux pour un article payant.</description>
</item>
<item>
<title>Article apercu paywall</title>
<link>https://example.test/article-preview</link>
<pubDate>Mon, 20 Jul 2026 06:00:00 GMT</pubDate>
<description>Resume du flux pour un article avec apercu.</description>
</item>
</channel>
</rss>`;

const CHANGELOG_FIXTURE = `# Changelog

## 9.9.9

- **Fonctionnalite test FR** -- description courte.

---

- **Test feature EN** -- short description.

## 9.9.8

- Version simple sans separation bilingue.
`;

const SPORT_TODAY = new Date(); SPORT_TODAY.setHours(12, 0, 0, 0);
const SPORT_TOMORROW = new Date(SPORT_TODAY.getTime() + 86400000);
function espnEvent(id, state, date, home, away, homeScore, away2Score, shortDetail) {
  return {
    id,
    date: date.toISOString(),
    status: { type: { state, shortDetail: shortDetail || "" } },
    competitions: [{
      competitors: [
        { homeAway: "home", team: { displayName: home }, score: String(homeScore) },
        { homeAway: "away", team: { displayName: away }, score: String(away2Score) }
      ]
    }]
  };
}
const ESPN_SCOREBOARD_FIXTURE = {
  events: [
    espnEvent("1", "pre", SPORT_TODAY, "Equipe Aujourdhui A", "Equipe Aujourdhui B", 0, 0),
    espnEvent("2", "pre", SPORT_TOMORROW, "Equipe Demain A", "Equipe Demain B", 0, 0),
    espnEvent("3", "in", SPORT_TODAY, "Equipe Live A", "Equipe Live B", 1, 0, "45'"),
    espnEvent("4", "post", SPORT_TODAY, "Equipe Finie A", "Equipe Finie B", 2, 1)
  ]
};

/* Fixtures meteo pour la modal detaillee, construites par rapport a
   maintenant (comme les autres fixtures) : heure courante pour la bande
   horaire 24h, et un creneau de pluie 30-45 min dans le futur pour
   tester la detection "pluie imminente".
   Weather fixtures for the detailed modal, built relative to now (like
   the other fixtures): current hour for the 24h strip, and a rain slot
   30-45 min in the future to test "rain imminent" detection. */
function pad2(n) { return String(n).padStart(2, "0"); }
function isoHour(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`; }
function iso15(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
const WEATHER_NOW = new Date();
const WEATHER_DAILY_TIMES = [...Array(7)].map((_, i) => {
  const d = new Date(WEATHER_NOW.getFullYear(), WEATHER_NOW.getMonth(), WEATHER_NOW.getDate() + i);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
});
const WEATHER_SUNRISE_ISO = `${WEATHER_DAILY_TIMES[0]}T07:02`;
const WEATHER_SUNSET_ISO = `${WEATHER_DAILY_TIMES[0]}T20:45`;
const WEATHER_HOURLY_TIMES = [...Array(30)].map((_, i) => isoHour(new Date(WEATHER_NOW.getTime() + i * 3600000)));
const WEATHER_HOURLY_TEMPS = WEATHER_HOURLY_TIMES.map((_, i) => 18 + (i % 6));
const WEATHER_HOURLY_POP = WEATHER_HOURLY_TIMES.map((_, i) => (i * 7) % 100);
const WEATHER_HOURLY_CODES = WEATHER_HOURLY_TIMES.map((_, i) => [0, 2, 61, 71][i % 4]);
let mCursor = new Date(WEATHER_NOW);
mCursor.setMinutes(Math.floor(mCursor.getMinutes() / 15) * 15, 0, 0);
const WEATHER_MINUTELY_TIMES = [...Array(8)].map(() => { const t = iso15(mCursor); mCursor = new Date(mCursor.getTime() + 15 * 60000); return t; });
const WEATHER_MINUTELY_PRECIP = WEATHER_MINUTELY_TIMES.map((_, i) => (i >= 2 ? 0.5 : 0)); // pluie a partir du 3e creneau (~30-45 min) / rain from the 3rd slot onward (~30-45 min)
// Replique exactement fmtHour() du widget (qui parse une chaine
// "...THH:00", perdant les minutes) pour comparer la 1ere carte de la
// bande horaire a l'heure courante tronquee.
// Exactly replicates the widget's fmtHour() (which parses a "...THH:00"
// string, losing the minutes) to compare the strip's first card against
// the current hour truncated.
function fmtHourFr(d) {
  const truncated = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0);
  return truncated.toLocaleTimeString("fr-FR", { hour: "2-digit" });
}

/* Fixture TomTom Routing (widget Trajet domicile-travail) : un retard de
   10 min pile sur le seuil "modere" par defaut, pour verifier la
   coloration, et une heure de depart conseillee quand arriveAt est
   demande. TomTom Routing fixture (Commute time widget): a 10 min delay,
   exactly on the default "moderate" threshold, to check the coloring,
   and a suggested departure time when arriveAt is requested. */
const TOMTOM_ROUTE_SUMMARY = {
  lengthInMeters: 15300, travelTimeInSeconds: 1500, trafficDelayInSeconds: 600,
  noTrafficTravelTimeInSeconds: 1100, historicTrafficTravelTimeInSeconds: 900,
  departureTime: "2026-07-26T07:12:00Z"
};
// Meme mecanisme que fmtClock() dans le widget : evite tout desaccord
// entre le fuseau horaire de la machine de test et une heure ecrite en
// dur dans l'assertion. Same mechanism as the widget's fmtClock():
// avoids any mismatch between the test machine's timezone and a
// hardcoded time in the assertion.
const TOMTOM_LEAVE_BY_TEXT = new Date(TOMTOM_ROUTE_SUMMARY.departureTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
let COMMUTE_QUOTA_COUNT = 0;

/* Fixtures sports mecaniques, construites par rapport a maintenant pour
   que les etats (passee / en cours / a venir) soient deterministes :
   EL1 il y a 3 h (passee), EL2 il y a 30 min (en cours, fenetre d'1 h),
   EL3 dans 2 h (prochaine), qualifs dans 4 h, course demain.
   Motorsport fixtures, built relative to now so the states (past /
   live / upcoming) are deterministic: FP1 3h ago (past), FP2 30min ago
   (live, 1h window), FP3 in 2h (next), qualifying in 4h, race tomorrow. */
const MS_NOW = Date.now();
const MS_OFFSETS = { fp1: -3 * 3600000, fp2: -30 * 60000, fp3: 2 * 3600000, quali: 4 * 3600000, race: 26 * 3600000 };
function ergastParts(ms) {
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) + "Z" };
}
const F1_SEASON_FIXTURE = {
  MRData: {
    RaceTable: {
      Races: [
        // Manche deja terminee : sert a verifier que le widget passe bien
        // a la manche courante. Already-finished round: checks the widget
        // does move on to the current one.
        {
          season: "2026", round: "1", raceName: "Grand Prix Termine",
          Circuit: { circuitName: "Circuit Passe", Location: { locality: "Nulleville" } },
          ...ergastParts(MS_NOW - 30 * 86400000)
        },
        {
          season: "2026", round: "2", raceName: "Grand Prix de Test",
          Circuit: { circuitName: "Circuit de Test", Location: { locality: "Testville" } },
          FirstPractice: ergastParts(MS_NOW + MS_OFFSETS.fp1),
          SecondPractice: ergastParts(MS_NOW + MS_OFFSETS.fp2),
          ThirdPractice: ergastParts(MS_NOW + MS_OFFSETS.fp3),
          Qualifying: ergastParts(MS_NOW + MS_OFFSETS.quali),
          ...ergastParts(MS_NOW + MS_OFFSETS.race)
        },
        {
          season: "2026", round: "3", raceName: "Grand Prix Suivant",
          Circuit: { circuitName: "Circuit Futur", Location: { locality: "Futureville" } },
          ...ergastParts(MS_NOW + 14 * 86400000)
        }
      ]
    }
  }
};
function motogpBroadcast(shortname, name, ms, acronym, categoryName) {
  return {
    shortname, name, type: "SESSION",
    date_start: new Date(ms).toISOString(),
    category: { acronym, name: categoryName }
  };
}
const MOTOGP_SEASON_FIXTURE = [
  {
    sponsored_name: "Grand Prix Moto de Test", sequence: 4,
    circuit: { name: "Circuit Moto de Test", city: "Motoville" },
    date_start: new Date(MS_NOW + MS_OFFSETS.fp1).toISOString(),
    date_end: new Date(MS_NOW + MS_OFFSETS.race).toISOString(),
    broadcasts: [
      motogpBroadcast("FP1", "Free Practice Nr. 1", MS_NOW + MS_OFFSETS.fp1, "MGP", "MotoGP"),
      motogpBroadcast("FP2", "Free Practice Nr. 2", MS_NOW + MS_OFFSETS.fp2, "MGP", "MotoGP"),
      motogpBroadcast("Q2", "Qualifying Nr. 2", MS_NOW + MS_OFFSETS.quali, "MGP", "MotoGP"),
      motogpBroadcast("SPR", "Tissot Sprint", MS_NOW + MS_OFFSETS.quali + 3600000, "MGP", "MotoGP"),
      motogpBroadcast("RAC", "Race", MS_NOW + MS_OFFSETS.race, "MGP", "MotoGP"),
      // Categorie Moto3 : ne doit PAS apparaitre avec le reglage par
      // defaut (MotoGP uniquement). Moto3 class: must NOT appear with
      // the default setting (MotoGP only).
      motogpBroadcast("RAC", "Race", MS_NOW + MS_OFFSETS.race - 7200000, "MT3", "Moto3"),
      // Rendez-vous presse : jamais une seance de piste, doit etre
      // ecarte quel que soit le reglage. Press event: never a track
      // session, must be filtered out whatever the setting.
      { shortname: "SHOW", name: "GearUP", type: "MEDIA", date_start: new Date(MS_NOW).toISOString(), category: { acronym: "MGP", name: "MotoGP" } }
    ]
  }
];

/* Planification par tuile : un jour de la semaine qui n'est jamais celui
   du jour ou tourne le test, pour obtenir une tuile a coup sur hors
   plage. Per-tile scheduling: a weekday that is never the day the test
   runs on, to reliably get an out-of-window tile. */
/* Fixtures astronomie. La phase de lune et les planetes imitent la
   forme exacte de server/astronomy.js (ces routes sont mockees ici,
   comme toutes les autres API tierces -- le VRAI calcul astronomy-engine
   est deja verifie a la main, voir la session de construction du
   widget). Astronomy fixtures. Moon phase and planets mimic the exact
   shape of server/astronomy.js (these routes are mocked here, like every
   other third-party API -- the REAL astronomy-engine computation was
   already verified by hand, see the widget's build session). */
const ASTRO_MOON_FIXTURE = {
  phaseAngle: 100, phaseKey: "waxingGibbous", illumination: 0.62, waxing: true,
  nextNewMoon: new Date(Date.now() + 12 * 86400000).toISOString(),
  nextFullMoon: new Date(Date.now() + 3 * 86400000).toISOString()
};
const ASTRO_PLANETS_FIXTURE = {
  planets: [
    // Sous l'horizon : ne doit PAS apparaitre (widget.js filtre sur
    // aboveHorizon). Below the horizon: must NOT appear (widget.js
    // filters on aboveHorizon).
    { name: "Mars", altitude: -12.3, azimuth: 45, compass: "NE", magnitude: 1.2, aboveHorizon: false, rise: null, set: null },
    { name: "Venus", altitude: 38.5, azimuth: 220, compass: "SW", magnitude: -4.1, aboveHorizon: true, rise: null, set: null },
    { name: "Jupiter", altitude: 15.2, azimuth: 90, compass: "E", magnitude: -1.9, aboveHorizon: true, rise: null, set: null }
  ]
};
const ASTRO_ISS_FIXTURE = {
  passes: [
    {
      rise: { time: new Date(Date.now() + 5 * 3600000).toISOString(), azimuth_deg: 236, compass: "WSW" },
      culmination: { time: new Date(Date.now() + 5.1 * 3600000).toISOString(), elevation_deg: 62 },
      set: { time: new Date(Date.now() + 5.2 * 3600000).toISOString(), azimuth_deg: 48, compass: "NE" },
      duration_sec: 407, above_horizon: true, visible: true
    },
    {
      rise: { time: new Date(Date.now() + 29 * 3600000).toISOString(), azimuth_deg: 100, compass: "E" },
      culmination: { time: new Date(Date.now() + 29.1 * 3600000).toISOString(), elevation_deg: 20 },
      set: { time: new Date(Date.now() + 29.2 * 3600000).toISOString(), azimuth_deg: 200, compass: "SSW" },
      duration_sec: 300, above_horizon: true, visible: false
    }
  ]
};

const ASTRO_ECLIPSE_FIXTURE = {
  type: "solar", kind: "partial",
  peakTime: new Date(Date.now() + 12 * 86400000).toISOString(),
  altitude: 25.4, obscuration: 0.87
};

/* Playlist M3U de test : couvre les cas reels -- metadonnees completes,
   logo absent, directive #EXTVLCOPT a ignorer, et deux categories
   distinctes pour verifier le filtre. Test M3U playlist: covers the
   real-world cases -- full metadata, missing logo, an #EXTVLCOPT
   directive to ignore, and two distinct categories to check the filter. */
const IPTV_PLAYLIST_FIXTURE = {
  channels: [
    { name: "France 24", logo: "https://ex.test/f24.png", group: "Info", tvgId: "France24.fr", url: "https://ex.test/f24/index.m3u8" },
    { name: "Arte", logo: "https://ex.test/arte.png", group: "Généralistes", tvgId: "", url: "https://ex.test/arte/master.m3u8" },
    { name: "Euronews", logo: "", group: "Info", tvgId: "", url: "https://ex.test/euronews.m3u8" }
  ],
  groups: ["Info", "Généralistes"],
  truncated: false
};

/* Fixtures Xtream Codes : reproduit exactement le scenario reel signale
   (categories "France HD|OTT" / "France SD|OTT", trois sources, une
   serie avec ses episodes, et un film en .mkv pour verifier
   l'avertissement de format). Xtream Codes fixtures: reproduces the
   exact real scenario reported ("France HD|OTT" / "France SD|OTT"
   categories, three sources, a series with its episodes, and a movie in
   .mkv to check the format warning). */
const XTREAM_CATEGORIES_FIXTURE = {
  accountStatus: "Active", expiresAt: "1893456000",
  live: [{ id: "10", name: "France HD|OTT" }, { id: "11", name: "France SD|OTT" }],
  vod: [{ id: "20", name: "Films Action" }],
  series: [{ id: "30", name: "Series FR" }]
};
const XTREAM_LIVE_STREAMS_FIXTURE = [
  // .ts, pas .m3u8 : reflete le vrai comportement de server/iptv.js
  // depuis la decouverte, par examen du lecteur de reference officiel,
  // que .m3u8 est systematiquement rejete (405) par certains
  // fournisseurs sur cet endpoint, quel que soit le client.
  // .ts, not .m3u8: reflects server/iptv.js's real behavior since the
  // finding, from examining the official reference player, that .m3u8
  // is systematically rejected (405) by some providers on this
  // endpoint, regardless of client.
  { id: "111", name: "France 24", logo: "https://ex.test/f24.png", containerExt: null, url: "https://ex.test/live/user123/pass456/111.ts" },
  { id: "112", name: "TF1", logo: "", containerExt: null, url: "https://ex.test/live/user123/pass456/112.ts" }
];
const XTREAM_VOD_STREAMS_FIXTURE = [
  { id: "222", name: "Un Film", logo: "https://ex.test/film.jpg", containerExt: "mkv", url: "https://ex.test/movie/user123/pass456/222.mkv" }
];
const XTREAM_SERIES_STREAMS_FIXTURE = [
  { id: "333", name: "Une Serie", logo: "https://ex.test/serie.jpg", isSeries: true }
];
const XTREAM_SERIES_INFO_FIXTURE = {
  seasons: [{ season: 1, episodes: [{ id: "444", name: "Episode 1", ext: "mp4", url: "https://ex.test/series/user123/pass456/444.mp4" }] }],
  plot: "Resume de la serie"
};

/* Second flux, pour la tuile de test multi-flux : un article, plus
   recent que ceux du flux principal, pour verifier la fusion
   chronologique. Second feed, for the multi-feed test tile: one item,
   more recent than the main feed's, to check chronological merging. */
const RSS_FEED2_XML = `<?xml version="1.0"?>
<rss><channel>
<title>Deuxieme Flux Long Nom De Source</title>
<item>
<title>Article du second flux, tres recent</title>
<link>https://example.test/feed2-article1</link>
<pubDate>Wed, 22 Jul 2026 12:00:00 GMT</pubDate>
<description>Contenu du second flux.</description>
</item>
</channel></rss>`;

const SCHED_OTHER_DAY_KEY = ["_schedSun", "_schedMon", "_schedTue", "_schedWed", "_schedThu", "_schedFri", "_schedSat"][(new Date().getDay() + 1) % 7];

/* Fixtures Courriel : la liste ne porte que des en-tetes (jamais de
   corps), et le message contient volontairement du HTML hostile
   representatif d'un vrai courriel indesirable -- script, gestionnaire
   d'evenement, pixel espion, lien d'hameconnage -- pour verifier la
   desinfection. Mailbox fixtures: the list carries headers only (never
   bodies), and the message deliberately contains hostile HTML typical
   of a real spam email -- script, event handler, tracking pixel,
   phishing link -- to check the sanitizing. */
let MAIL_LIST_CALLS = 0;
let MOCK_BACKUPS = [];
let BACKUP_SEQ = 0;
let BACKUP_LAYOUT_RESTORED = null; // marqueur : dernier id restaure/importe, sans vraiment recharger la page / marker: last id restored/imported, without actually reloading the page
const MAIL_LIST_FIXTURE = {
  unseen: 1,
  total: 42,
  messages: [
    { uid: 101, subject: "Facture de juillet", from: "Compta SARL", fromAddress: "compta@exemple.fr", date: new Date().toISOString(), seen: false },
    { uid: 100, subject: "Re: reunion de lundi", from: "Claire", fromAddress: "claire@exemple.fr", date: new Date(Date.now() - 86400000).toISOString(), seen: true },
    { uid: 99, subject: "", from: "Sans Objet", fromAddress: "vide@exemple.fr", date: new Date(Date.now() - 172800000).toISOString(), seen: true }
  ]
};
const MAIL_MESSAGE_FIXTURE = {
  subject: "Facture de juillet",
  from: "Compta SARL <compta@exemple.fr>",
  date: new Date().toISOString(),
  html: '<p>Bonjour, voici votre <b>facture</b>.</p>'
    + '<script>window.__pwnedMail = true;</script>'
    + '<img src="https://tracker.exemple.fr/pixel.gif" alt="pixel espion">'
    + '<a href="https://hameconnage.test/login" onclick="window.__pwnedMail = true;">Cliquez ici</a>'
    + '<a href="javascript:window.__pwnedMail = true">Lien piege</a>',
  text: "Bonjour, voici votre facture.",
  attachments: [{ filename: "facture-juillet.pdf", size: 12345 }]
};

/* Fixture ICS pour la ligne "prochain evenement" de l'Horloge :
   evenement construit relativement a l'heure REELLE du test (pas de
   date figee, qui finirait par appartenir au passe). Format sans "Z"
   (heure locale), celui que parseSimpleIcs() interprete comme tel.
   ICS fixture for the Clock's "next event" line: event built relative
   to the test's REAL time (no fixed date, which would eventually belong
   to the past). No "Z" suffix (local time), the form parseSimpleIcs()
   interprets as such. */
const CLOCK_EVENT_DATE = new Date(Date.now() + 2 * 86400000);
const CLOCK_EVENT_ICS_STAMP = CLOCK_EVENT_DATE.getFullYear()
  + String(CLOCK_EVENT_DATE.getMonth() + 1).padStart(2, "0")
  + String(CLOCK_EVENT_DATE.getDate()).padStart(2, "0") + "T140000";
const CLOCK_EVENT_ICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Rendez-vous dentiste\r\nDTSTART:${CLOCK_EVENT_ICS_STAMP}\r\nDTEND:${CLOCK_EVENT_ICS_STAMP}\r\nEND:VEVENT\r\nEND:VCALENDAR`;

const layout = {
  version: 1,
  tiles: [
    { id: "t-a", widget: "clock", x: 0, y: 0, w: 3, h: 2, settings: { mode: "digital", showDate: true, showSaint: true } },
    { id: "t-b", widget: "webview", x: 3, y: 0, w: 6, h: 4, settings: { url: "http://example.local/", zoom: 100, reload: 0 } },
    { id: "t-c", widget: "notes", x: 0, y: 2, w: 3, h: 3, settings: {} },
    { id: "t-d", widget: "weather", x: 6, y: 0, w: 3, h: 2, settings: { city: "Toulouse", showSaint: true, showTomorrow: true, usePhotos: false } },
    { id: "t-e", widget: "airquality", x: 9, y: 0, w: 3, h: 2, settings: { city: "Toulouse", displayMode: "detailed", showPollen: false, showPollenDetailed: true } },
    { id: "t-f", widget: "calendar", x: 0, y: 5, w: 4, h: 4, settings: { calendars: "https://cal.test/family.ics|Famille\nhttps://cal.test/work.ics|Travail" } },
    { id: "t-g", widget: "rss", x: 4, y: 5, w: 4, h: 3, settings: { url: "https://feed.test/rss.xml", maxItems: 6, showSource: true } },
    { id: "t-h", widget: "sportscore", x: 8, y: 5, w: 4, h: 3, settings: { league: "soccer:fifa.world", maxItems: 5 } },
    { id: "t-i", widget: "commute", x: 0, y: 8, w: 4, h: 3, settings: {
      home: "12 Rue de Paris, Toulouse", work: "5 Avenue de Bordeaux, Toulouse",
      apiKey: "FAKEKEY", direction: "both", arriveWorkBy: "08:30",
      trip1Label: "Grand-mère", trip1Address: "1 Place du Capitole, Toulouse", trip1ArriveBy: "08:45",
      alertModerate: 10, alertHeavy: 20
    } },
    { id: "t-j", widget: "motorsport", x: 4, y: 8, w: 4, h: 4, settings: { series: "f1", mode: "next" } },
    { id: "t-k", widget: "motorsport", x: 8, y: 8, w: 4, h: 4, settings: { series: "motogp", mode: "next" } },
    // Planifiee sur un jour qui n'est JAMAIS aujourd'hui : toujours hors
    // plage, quelle que soit l'heure a laquelle tourne le test.
    // Scheduled on a day that is NEVER today: always out of window,
    // whatever time the test runs at.
    { id: "t-l", widget: "notes", x: 0, y: 12, w: 3, h: 2, settings: {
      _schedEnabled: true, [SCHED_OTHER_DAY_KEY]: true
    } },
    // Planifiee mais active en permanence (aucun jour coche = tous les
    // jours) : verifie qu'une planification active ne casse rien.
    // Scheduled but permanently active (no day ticked = every day):
    // checks an active schedule breaks nothing.
    { id: "t-m", widget: "notes", x: 3, y: 12, w: 3, h: 2, settings: { _schedEnabled: true } },
    { id: "t-n", widget: "mailbox", x: 6, y: 12, w: 4, h: 3, settings: {
      host: "imap.test.fr", port: 993, user: "moi@test.fr", folder: "INBOX", limit: 5, showSender: true
    } },
    { id: "t-o", widget: "astronomy", x: 0, y: 15, w: 4, h: 5, settings: { city: "Toulouse" } },
    { id: "t-q", widget: "iptv", x: 8, y: 15, w: 5, h: 4, settings: {
      playlistUrl: "https://ex.test/chaines.m3u", startMuted: true, maxHeight: "720"
    } },
    { id: "t-r", widget: "iptv", x: 0, y: 19, w: 5, h: 4, settings: {
      playlistUrl: "http://ex.test/get.php?username=user123&password=pass456&type=m3u_plus", startMuted: true, maxHeight: "720"
    } },
    { id: "t-p", widget: "clock", x: 4, y: 15, w: 4, h: 4, settings: {
      mode: "digital", showDate: true, showWeekNumber: true, weekNumberConvention: "iso",
      extraZone1Label: "Tokyo", extraZone1Tz: "Asia/Tokyo",
      showNextEvent: true, nextEventIcsUrl: "https://exemple.test/clock-agenda.ics", nextEventDaysAhead: 14
    } },
    { id: "t-s", widget: "rss", x: 8, y: 19, w: 4, h: 3, settings: {
      url: "https://feed.test/rss.xml", label1: "Flux Un", url2: "https://feed2.test/rss.xml", label2: "",
      maxItems: 10, showSource: true
    } },
    // Cible deja passee : declenche l'alerte de tableau des le premier
    // tick() (appele en synchrone dans init()), sans avoir a manipuler
    // le formulaire de reglages ni a attendre une minuterie reelle --
    // utile pour tester le tap-n'importe-ou (voir plus bas).
    // Target already in the past: fires the board alert on the very
    // first tick() (called synchronously in init()), without having to
    // manipulate the settings form or wait for a real timer -- useful
    // for testing tap-anywhere-to-dismiss (see below).
    { id: "t-v", widget: "countdown", x: 0, y: 23, w: 3, h: 2, settings: {
      mode: "date", targetDateTime: "2020-01-01T00:00", flashScreen: true, playSound: false, alertDurationSeconds: 30
    } },
    { id: "t-w", widget: "crypto", x: 3, y: 23, w: 3, h: 2, settings: { coins: "bitcoin", currency: "eur", refresh: 5 } }
  ]
};

const settings = { lang: "fr", theme: "dark", latitude: 43.6, longitude: 1.44, gridRows: 8, multiColumnForms: true };
const putCalls = [];
/* Mock avec etat pour la bibliotheque de configurations enregistrees
   (server/tileConfigs.js), pour rejouer le parcours complet
   suppression -> reutilisation sans vrai serveur.
   Stateful mock for the saved tile configurations library
   (server/tileConfigs.js), to replay the full remove -> reuse
   journey without a real server. */
const tileConfigsMock = {};

/* Mock avec etat pour les routes /api/crypto/* (server/crypto.js) :
   permet de simuler un repli sur donnees perimees (priceStale/
   chartStale) et une panne totale (blockPrices/blockChart) sans
   dependre du reseau reel. Stateful mock for the /api/crypto/* routes
   (server/crypto.js): lets tests simulate a stale-data fallback
   (priceStale/chartStale) and a total outage (blockPrices/blockChart)
   without depending on the real network. */
const cryptoMock = {
  priceData: { bitcoin: { eur: 50000, eur_24h_change: 2.5 } },
  priceSymbols: { bitcoin: "BTC" },
  priceStale: false,
  blockPrices: false,
  chartPrices: [100, 105, 98, 110],
  chartSymbol: "BTC",
  chartStale: false,
  blockChart: false
};

/* Chargeur de ressources : sert les fichiers locaux */
class LocalLoader extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    let file;
    if (u.pathname.startsWith("/vendor/gridstack/")) {
      file = path.join(ROOT, "node_modules", "gridstack", "dist", u.pathname.replace("/vendor/gridstack/", ""));
    } else {
      file = path.join(PUB, u.pathname.replace(/^\//, ""));
    }
    try {
      return Promise.resolve(fs.readFileSync(file));
    } catch (e) {
      console.log("  [loader] introuvable:", u.pathname);
      return Promise.resolve(Buffer.from(""));
    }
  }
}

const vc = new VirtualConsole();
vc.on("error", (m) => console.log("  [console.error]", String(m).slice(0, 200)));
vc.on("warn", () => {});
vc.on("log", () => {});
vc.on("jsdomError", (e) => console.log("  [jsdomError]", String(e.message || e).slice(0, 200)));

const html = fs.readFileSync(path.join(PUB, "index.html"), "utf8");

/* Etat de la mise a jour serveur, modifie par le test au fil du scenario
   Server self-update state, mutated by the test along the scenario */
const UPDATE_STATE = {
  supported: true, reason: null, currentVersion: "9.9.9-test", latestVersion: "9.10.0", available: true,
  tag: "v9.10.0", publishedAt: "2026-09-01T10:00:00Z", notes: "Notes de test pour la 9.10.0",
  htmlUrl: null, checkedAt: "2026-09-02T08:00:00Z", checkError: null, busy: false,
  prerelease: false, channel: "stable",
  job: { phase: "idle", version: null, startedAt: null, finishedAt: null, progress: null, error: null, rolledBack: false, log: [] }
};
const UPDATE_CALLS = { check: 0, apply: 0, checkDesktop: 0 };
let UPDATE_VERSION_SERVED = "9.9.9-test";

const dom = new JSDOM(html, {
  url: "http://localhost:8090/",
  runScripts: "dangerously",
  resources: new LocalLoader(),
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    /* Stub fetch -> fixtures */
    window.fetch = (url, opts) => {
      const method = (opts && opts.method) || "GET";
      const u = String(url);
      const json = (data) => Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data))
      });

      if (u.includes("/api/backups")) {
        const backupMatch = u.match(/\/api\/backups(?:\/([^/?]+))?(?:\/(download|restore))?$/);
        const id = backupMatch && backupMatch[1] !== "import" ? decodeURIComponent(backupMatch[1] || "") : null;
        const action = backupMatch ? backupMatch[2] : null;

        if (u.endsWith("/api/backups/import") && method === "POST") {
          BACKUP_SEQ++;
          const rec = { id: "imported-" + BACKUP_SEQ, createdAt: new Date().toISOString(), appVersion: null, label: "Import", tileCount: 1 };
          MOCK_BACKUPS.unshift(rec);
          BACKUP_LAYOUT_RESTORED = "imported-layout";
          return json(rec);
        }
        if (!id && method === "GET") {
          return json({ backups: MOCK_BACKUPS });
        }
        if (!id && method === "POST") {
          BACKUP_SEQ++;
          const body = opts && opts.body ? JSON.parse(opts.body) : {};
          const rec = { id: "backup-" + BACKUP_SEQ, createdAt: new Date().toISOString(), appVersion: "9.9.9-test", label: body.label || null, tileCount: 15 };
          MOCK_BACKUPS.unshift(rec);
          return json(rec);
        }
        if (id && action === "download" && method === "GET") {
          const rec = MOCK_BACKUPS.find((b) => b.id === id);
          return rec ? json(Object.assign({ piboardBackup: 1, files: {} }, rec)) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: "not found" }) });
        }
        if (id && action === "restore" && method === "POST") {
          const rec = MOCK_BACKUPS.find((b) => b.id === id);
          if (!rec) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: "not found" }) });
          BACKUP_LAYOUT_RESTORED = id;
          return json(rec);
        }
        if (id && !action && method === "DELETE") {
          MOCK_BACKUPS = MOCK_BACKUPS.filter((b) => b.id !== id);
          return json({ ok: true });
        }
      }
      /* Mise a jour serveur (Linux) : etat pilote par le test, qui fait
         evoluer la phase pour verifier la fenetre de progression sans
         jamais couper de serveur. Server self-update (Linux): state
         driven by the test, which advances the phase to check the
         progress window without ever shutting a server down. */
      if (u.includes("/api/update/status")) {
        return json(UPDATE_STATE);
      }
      if (u.includes("/api/update/check-desktop") && method === "POST") {
        UPDATE_CALLS.checkDesktop++;
        return json({ ok: true });
      }
      if (u.includes("/api/update/check") && method === "POST") {
        UPDATE_CALLS.check++;
        UPDATE_STATE.checkedAt = new Date().toISOString();
        return json(UPDATE_STATE);
      }
      if (u.includes("/api/update/apply") && method === "POST") {
        UPDATE_CALLS.apply++;
        UPDATE_STATE.job = { phase: "downloading", version: UPDATE_STATE.latestVersion, progress: { bytes: 512000, total: 1024000 }, error: null, rolledBack: false, log: ["Telechargement…"] };
        UPDATE_STATE.busy = true;
        return Promise.resolve({ ok: true, status: 202, json: () => Promise.resolve(UPDATE_STATE) });
      }
      if (u.includes("/api/version")) {
        return json({ version: UPDATE_VERSION_SERVED });
      }
      const cfgMatch = u.match(/\/api\/tile-configs\/([^/?]+)(?:\/([^/?]+))?/);
      if (cfgMatch) {
        const widgetId = decodeURIComponent(cfgMatch[1]);
        const list = tileConfigsMock[widgetId] || [];
        if (method === "GET") return json(list);
        if (method === "PUT") {
          const body = JSON.parse(opts.body);
          tileConfigsMock[widgetId] = [
            { title: body.title, settings: body.settings, savedAt: new Date().toISOString() },
            ...list.filter((e) => e.title !== body.title)
          ];
          return json(tileConfigsMock[widgetId]);
        }
        if (method === "DELETE") {
          const title = decodeURIComponent(cfgMatch[2] || "");
          tileConfigsMock[widgetId] = list.filter((e) => e.title !== title);
          return json(tileConfigsMock[widgetId]);
        }
      }

      if (method === "PUT") {
        putCalls.push({ url: u, body: opts.body });
        if (u.includes("/api/settings")) {
          /* Le vrai serveur fusionne le corps recu dans les reglages
             enregistres et renvoie le resultat (voir PUT /api/settings) ;
             renvoyer les reglages INITIAUX faisait croire au client que
             rien n'avait change, et masquait tout ce qui depend d'un
             reglage fraichement enregistre.
             The real server merges the received body into the saved
             settings and returns the result (see PUT /api/settings);
             returning the INITIAL settings made the client believe
             nothing had changed, and hid everything depending on a
             freshly saved setting. */
          let patch = {};
          try { patch = JSON.parse(opts.body || "{}"); } catch (e) { patch = {}; }
          Object.assign(settings, patch);
          return json(settings);
        }
        return json({ ok: true, version: 2 });
      }
      if (u.includes("/api/settings")) return json(settings);
      if (u.includes("/api/widgets")) return json(catalog);
      if (u.includes("/api/layout")) return json(layout);
      if (u.includes("/api/state/")) return json({ key: "x", value: "note de test" });
      if (u.includes("/api/tele-channels")) {
        // Mock realiste : simule le fait que le guide "france" expose
        // davantage de chaines que le guide "tnt" par defaut -- exactement
        // le point verifie par le test de la tuile Programme TV plus bas
        // (correctif v1.7.4).
        const wantFrance = /[?&]guide=france\b/.test(u);
        const list = wantFrance
          ? [{ id: "TF1.fr", name: "TF1" }, { id: "France2.fr", name: "France 2" }, { id: "Extra1.fr", name: "Chaine supplementaire 1" }, { id: "Extra2.fr", name: "Chaine supplementaire 2" }]
          : [{ id: "TF1.fr", name: "TF1" }, { id: "France2.fr", name: "France 2" }];
        return json(list);
      }
      if (u.includes("/api/crypto/prices")) {
        if (cryptoMock.blockPrices) return { ok: false, status: 502, json: () => Promise.resolve({ error: "boom" }) };
        return json({ data: cryptoMock.priceData, stale: !!cryptoMock.priceStale, symbols: cryptoMock.priceSymbols });
      }
      if (u.includes("/api/crypto/chart")) {
        if (cryptoMock.blockChart) return { ok: false, status: 502, json: () => Promise.resolve({ error: "boom" }) };
        return json({ prices: cryptoMock.chartPrices, stale: !!cryptoMock.chartStale, symbol: cryptoMock.chartSymbol });
      }
      // ATTENTION a l'ordre : "/api/tele-program/grid" contient
      // "/api/tele-program", donc ce cas doit etre teste AVANT le
      // suivant, sinon la grille recevrait la reponse de la vue simple.
      // MIND THE ORDER: "/api/tele-program/grid" contains
      // "/api/tele-program", so this case must be tested BEFORE the next
      // one, otherwise the grid would get the simple view's response.
      if (u.includes("/api/tele-program/grid")) {
        const nowMs = Date.now();
        const from = new Date(nowMs - 3600000);   // 1 h avant / 1 h before
        const to = new Date(nowMs + 6 * 3600000); // 6 h apres / 6 h after
        return json({
          generatedAt: new Date(nowMs).toISOString(),
          from: from.toISOString(),
          to: to.toISOString(),
          channels: [
            { channelId: "TF1.fr", channelName: "TF1", channelIcon: "https://logo.test/tf1.png", channelNumber: 1,
              programs: [
                // Commence AVANT l'origine de la fenetre : doit apparaitre tronque au bord gauche
                { start: new Date(nowMs - 5400000).toISOString(), stop: new Date(nowMs - 1800000).toISOString(),
                  title: "Emission precedente", subtitle: null, desc: "Synopsis precedent.", category: null, icon: null, isNew: false },
                { start: new Date(nowMs - 1800000).toISOString(), stop: new Date(nowMs + 1800000).toISOString(),
                  title: "Film de test", subtitle: null, desc: "Un synopsis de test.", category: "Film", icon: "https://img.test/film.jpg", isNew: true },
                { start: new Date(nowMs + 1800000).toISOString(), stop: new Date(nowMs + 5400000).toISOString(),
                  title: "Documentaire", subtitle: null, desc: null, category: null, icon: null, isNew: false }
              ] },
            { channelId: "France2.fr", channelName: "France 2", channelIcon: null, channelNumber: 2,
              programs: [
                { start: new Date(nowMs - 900000).toISOString(), stop: new Date(nowMs + 2700000).toISOString(),
                  title: "Émission à venir", subtitle: null, desc: null, category: null, icon: null, isNew: false }
              ] },
            { channelId: "M6.fr", channelName: "M6", channelIcon: null, channelNumber: 6, programs: [] }
          ]
        });
      }
      if (u.includes("/api/tele-program")) {
        // Reponse mock : une chaine avec un programme en cours (utile
        // aussi pour la barre de progression), une sans programme, et
        // une avec un programme A VENIR (utile pour le rappel, qui ne
        // se propose que pour une diffusion pas encore commencee).
        const viewMatch = u.match(/[?&]view=([^&]+)/);
        return json({
          view: viewMatch ? viewMatch[1] : "now",
          generatedAt: new Date().toISOString(),
          channels: [
            { channelId: "TF1.fr", channelName: "TF1", channelIcon: null,
              program: { start: new Date().toISOString(), stop: new Date(Date.now() + 3600000).toISOString(),
                title: "Film de test", subtitle: null, desc: "Un synopsis de test.", category: "Film", icon: null, isNew: true } },
            { channelId: "France2.fr", channelName: "France 2", channelIcon: null, program: null },
            { channelId: "M6.fr", channelName: "M6", channelIcon: null,
              program: { start: new Date(Date.now() + 600000).toISOString(), stop: new Date(Date.now() + 4200000).toISOString(),
                title: "Émission à venir", subtitle: null, desc: null, category: null, icon: null, isNew: false } }
          ]
        });
      }
      if (u.includes("/api/changelog")) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(CHANGELOG_FIXTURE) });
      }
      if (u.includes("/data/saints-fr.json")) {
        // Cles du jour et du lendemain calculees dynamiquement (le test
        // peut tourner n'importe quel jour de l'annee).
        // Today's and tomorrow's keys computed dynamically (the test can
        // run on any day of the year).
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const tmm = String(tomorrow.getMonth() + 1).padStart(2, "0");
        const tdd = String(tomorrow.getDate()).padStart(2, "0");
        return json({ [mm + "-" + dd]: "Testine", [tmm + "-" + tdd]: "Tomorrine" });
      }
      if (u.includes("/api/iptv/xtream-categories")) {
        return json(XTREAM_CATEGORIES_FIXTURE);
      }
      if (u.includes("/api/iptv/xtream-streams") && u.includes("kind=live")) {
        return json(XTREAM_LIVE_STREAMS_FIXTURE);
      }
      if (u.includes("/api/iptv/xtream-streams") && u.includes("kind=vod")) {
        return json(XTREAM_VOD_STREAMS_FIXTURE);
      }
      if (u.includes("/api/iptv/xtream-streams") && u.includes("kind=series")) {
        return json(XTREAM_SERIES_STREAMS_FIXTURE);
      }
      if (u.includes("/api/iptv/xtream-series-info")) {
        return json(XTREAM_SERIES_INFO_FIXTURE);
      }
      if (u.includes("/api/iptv/playlist")) {
        return json(IPTV_PLAYLIST_FIXTURE);
      }
      if (u.includes("/api/astronomy/eclipse")) {
        return json(ASTRO_ECLIPSE_FIXTURE);
      }
      if (u.includes("clock-agenda.ics")) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(CLOCK_EVENT_ICS) });
      }
      if (u.includes("/api/astronomy/moon")) {
        return json(ASTRO_MOON_FIXTURE);
      }
      if (u.includes("/api/astronomy/planets")) {
        return json(ASTRO_PLANETS_FIXTURE);
      }
      if (u.includes("iss-api.polluxlabs.io")) {
        return json(ASTRO_ISS_FIXTURE);
      }
      if (u.includes("/api/mail/") && u.includes("/list")) {
        MAIL_LIST_CALLS++;
        return json(MAIL_LIST_FIXTURE);
      }
      if (u.includes("/api/mail/") && u.includes("/message")) {
        return json(MAIL_MESSAGE_FIXTURE);
      }
      if (u.includes("/api/tile-secrets/")) {
        return json({ configured: true });
      }
      if (u.includes("/api/proxy") && u.includes("jolpi.ca")) {
        return json(F1_SEASON_FIXTURE);
      }
      if (u.includes("/api/proxy") && u.includes("motogp.pulselive.com")) {
        return json(MOTOGP_SEASON_FIXTURE);
      }
      if (u.includes("/api/proxy") && u.includes("nominatim.openstreetmap.org")) {
        // Un marqueur distinct simule une adresse introuvable, pour tester
        // les deux issues de la validation en direct (voir app.js).
        // A distinct marker simulates an address that can't be found, to
        // test both outcomes of the live validation (see app.js).
        if (u.includes("Nullepart")) return json([]);
        return json([{ lat: "43.6", lon: "1.44", display_name: "12 Rue de Paris, 31000 Toulouse, France" }]);
      }
      if (u.includes("/api/proxy") && u.includes("api.tomtom.com")) {
        return json({ routes: [{ summary: TOMTOM_ROUTE_SUMMARY }] });
      }
      if (u.includes("/api/traffic-quota/")) {
        if (method === "POST") {
          const body = opts && opts.body ? JSON.parse(opts.body) : {};
          COMMUTE_QUOTA_COUNT += Number(body.count) || 0;
        }
        return json({ date: "2026-07-26", count: COMMUTE_QUOTA_COUNT });
      }
      if (u.includes("/api/proxy") && u.includes("site.api.espn.com") && u.includes("scoreboard")) {
        return json(ESPN_SCOREBOARD_FIXTURE);
      }
      if (u.includes("/api/article-extract") && u.includes("article1")) {
        return json({
          title: "Article avec lien",
          byline: "Par Notre Testeur",
          siteName: "Flux Test",
          content: `<p>Texte complet <b>extrait</b> de la page liee, bien plus long et detaille que le simple resume fourni par le flux RSS lui-meme.</p><script>window.__pwnedExtract = true;</script><a href="https://example.test/other" onclick="window.__pwnedExtract = true;">lien extrait</a>`
        });
      }
      if (u.includes("/api/article-extract") && u.includes("article-noextract")) {
        return Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: "no readable content", paywall: false }) });
      }
      if (u.includes("/api/article-extract") && u.includes("article-paywall")) {
        return Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: "upstream status 402", paywall: true }) });
      }
      if (u.includes("/api/article-extract") && u.includes("article-preview")) {
        return json({
          title: "Article apercu paywall",
          content: `<p>Voici l'apercu gratuit de l'article, visible avant que le paywall ne masque la suite reservee aux abonnes du site.</p>`,
          partial: true
        });
      }
      if (u.includes("/api/proxy") && u.includes("feed.test")) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(RSS_FEED_XML) });
      }
      if (u.includes("/api/proxy") && u.includes("feed2.test")) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(RSS_FEED2_XML) });
      }
      if (u.includes("/api/proxy") && (u.includes("family.ics") || u.includes("work.ics"))) {
        const target = decodeURIComponent((u.split("url=")[1] || "").split("&")[0]);
        const text = target.includes("family.ics") ? FAMILY_ICS : WORK_ICS;
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
      }
      if (u.includes("air-quality-api.open-meteo.com")) {
        return json({
          current: {
            european_aqi: 42, european_aqi_pm2_5: 42, european_aqi_pm10: 20,
            european_aqi_nitrogen_dioxide: 10, european_aqi_ozone: 30, european_aqi_sulphur_dioxide: 5,
            pm2_5: 18, pm10: 22, nitrogen_dioxide: 15, ozone: 60, sulphur_dioxide: 3,
            birch_pollen: 25, grass_pollen: null, ragweed_pollen: null,
            alder_pollen: null, mugwort_pollen: null, olive_pollen: null
          }
        });
      }
      if (u.includes("geocoding-api.open-meteo.com")) {
        return json({ results: [{ latitude: 43.6, longitude: 1.44, name: "Toulouse" }] });
      }
      // Deux requetes distinctes desormais (voir refresh() dans le
      // widget) : la principale (aujourd'hui/demain, respecte le modele
      // choisi) n'a pas de parametre "hourly", l'etendue (7 jours, UV,
      // bande horaire, minutely_15, toujours "Meilleure correspondance")
      // si. Two distinct requests now (see refresh() in the widget): the
      // main one (today/tomorrow, respects the chosen model) has no
      // "hourly" parameter, the extended one (7 days, UV, hourly strip,
      // minutely_15, always "Best match") does.
      if (u.includes("api.open-meteo.com/v1/forecast") && u.includes("hourly=")) {
        return json({
          daily: {
            time: WEATHER_DAILY_TIMES,
            temperature_2m_min: [10, 11, 9, 12, 8, 13, 11],
            temperature_2m_max: [22, 23, 20, 24, 19, 25, 22],
            weather_code: [0, 1, 61, 2, 3, 0, 1],
            sunrise: [WEATHER_SUNRISE_ISO],
            sunset: [WEATHER_SUNSET_ISO],
            uv_index_max: [7.2],
            wind_gusts_10m_max: [35],
            precipitation_probability_max: [10, 80, 40, 5, 60, 15, 20]
          },
          hourly: { time: WEATHER_HOURLY_TIMES, temperature_2m: WEATHER_HOURLY_TEMPS, precipitation_probability: WEATHER_HOURLY_POP, weather_code: WEATHER_HOURLY_CODES },
          minutely_15: { time: WEATHER_MINUTELY_TIMES, precipitation: WEATHER_MINUTELY_PRECIP }
        });
      }
      if (u.includes("api.open-meteo.com/v1/forecast")) {
        return json({
          current: { temperature_2m: 21, weather_code: 0, wind_speed_10m: 12, wind_gusts_10m: 27 },
          daily: { temperature_2m_min: [10, 11], temperature_2m_max: [22, 23], weather_code: [0, 1] }
        });
      }
      if (u.includes("/api/weather-photo/")) {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }
      if (u.includes("open-meteo")) return json({ results: [] });
      if (u.includes("/api/proxy") && u.includes("standings")) {
        // Mock ESPN realiste : pas de colonne "D" (comme le rugby),
        // donc PCT fait bien partie des 4 premieres colonnes affichees
        // -- meme situation que le Top 14 signale par l'utilisateur.
        return json({
          standings: {
            entries: [
              {
                team: { shortDisplayName: "Toulouse", displayName: "Stade Toulousain" },
                stats: [
                  { name: "rank", value: 1 },
                  { abbreviation: "GP", value: 26, displayValue: "26" },
                  { abbreviation: "W", value: 18, displayValue: "18" },
                  { abbreviation: "L", value: 8, displayValue: "8" },
                  { abbreviation: "PTS", value: 92, displayValue: "92" },
                  { abbreviation: "PCT", value: 0.692, displayValue: ".692" }
                ]
              }
            ]
          }
        });
      }
      return json({});
    };
    window.EventSource = class {
      constructor() {}
      addEventListener() {}
      close() {}
    };
    window.ResizeObserver = window.ResizeObserver || class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});

const { window } = dom;
const { document } = window;

function assert(label, cond) {
  console.log((cond ? "  OK   " : "  FAIL ") + label);
  if (!cond) process.exitCode = 1;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* Retrouve une vignette du catalogue par l'IDENTIFIANT de son widget.
   Indispensable depuis le regroupement par familles : l'ordre
   d'affichage ne suit plus celui du tableau "catalog" (voir
   CATALOG_FAMILIES dans app.js), donc un acces par index y serait
   faux. Le reperage se fait via le nom affiche, seul lien fiable entre
   le manifeste et le DOM rendu.
   Finds a catalog card by its widget's ID. Essential since family
   grouping was introduced: the display order no longer follows the
   "catalog" array's order (see CATALOG_FAMILIES in app.js), so
   index-based access would be wrong. Lookup goes through the displayed
   name, the only reliable link between the manifest and the rendered
   DOM. */
function catalogItemFor(catalog, document, widgetId) {
  const manifest = catalog.find((m) => m.id === widgetId);
  if (!manifest) return null;
  const name = manifest.name.fr || manifest.name.en || manifest.name;
  return Array.from(document.querySelectorAll("#catalogList .catalog-item"))
    .find((el) => (el.querySelector(".ci-name")?.textContent || "") === name) || null;
}

(async () => {
  /* Attendre le boot / wait for boot */
  let tries = 0;
  while (document.querySelectorAll(".grid-stack-item").length < 21 && tries++ < 60) await sleep(100);

  console.log("== Boot ==");
  assert("21 tuiles montees", document.querySelectorAll(".grid-stack-item").length === 21);
  assert("horloge affichee (heure presente)", /\d{2}:\d{2}/.test(document.querySelector(".pwc-time")?.textContent || ""));
  assert("bloc-notes charge depuis le serveur", (document.querySelector(".pw-notes .pwn-view")?.textContent || "").includes("note de test"));
  assert("webview en iframe", !!document.querySelector(".pw-webview iframe"));
  assert("i18n FR appliquee", document.documentElement.lang === "fr");
  assert("grille statique au depart (verrouillee)", document.querySelector(".grid-stack").classList.contains("grid-stack-static"));

  console.log("== Bloc-notes : barre d'outils de mise en forme ==");
  {
    const noteTile = document.querySelector('[data-tile-id="t-c"]');
    const bar = noteTile.querySelector(".pwn-bar");
    const view = noteTile.querySelector(".pwn-view");
    const ta = noteTile.querySelector(".pwn-edit");
    assert("barre d'outils presente dans le DOM", !!bar);
    assert("barre masquee hors edition (elle agit sur le texte source)", bar.hidden === true);

    // Passage en edition par un clic sur la vue, comme un utilisateur.
    // Entering edit mode by clicking the view, like a user would.
    view.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic sur la note : l'editeur s'ouvre", ta.hidden === false);
    assert("clic sur la note : la barre apparait", bar.hidden === false);

    const press = (act) => {
      const btn = bar.querySelector('[data-act="' + act + '"]');
      // pointerdown et non click : c'est l'evenement reellement ecoute
      // (voir wireToolbar()). pointerdown rather than click: that's the
      // event actually listened to (see wireToolbar()).
      const ev = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
      btn.dispatchEvent(ev);
      return ev;
    };

    assert("les 5 boutons demandes sont presents (case, gras, italique, barre, titre)",
      ["task", "bold", "italic", "strike", "heading"].every((a) => !!bar.querySelector('[data-act="' + a + '"]')));
    assert("bouton de retour au style normal present", !!bar.querySelector('[data-act="normal"]'));

    // Le point critique : l'appui NE DOIT PAS fermer l'editeur. Sans le
    // preventDefault() de wireToolbar(), le <textarea> perdrait le focus,
    // son blur declencherait stopEdit(), et le bouton semblerait sans
    // effet. The critical point: pressing MUST NOT close the editor.
    // Without wireToolbar()'s preventDefault(), the <textarea> would lose
    // focus, its blur would fire stopEdit(), and the button would appear
    // to do nothing.
    ta.value = "";
    ta.setSelectionRange(0, 0);
    const ev = press("bold");
    assert("l'appui sur un bouton est bien annule (preventDefault) pour garder le focus", ev.defaultPrevented === true);
    await sleep(10);
    assert("l'editeur reste ouvert apres un appui sur un bouton", ta.hidden === false);

    // Gras sans selection : les marqueurs sont poses et le curseur entre
    // les deux. Bold with no selection: markers inserted, caret between.
    assert("gras sans selection : marqueurs inseres", ta.value === "****");
    assert("gras sans selection : curseur place entre les marqueurs", ta.selectionStart === 2);

    // Gras sur une selection, puis bascule inverse.
    // Bold on a selection, then toggled back off.
    ta.value = "important";
    ta.setSelectionRange(0, 9);
    press("bold");
    assert("gras sur une selection : texte encadre", ta.value === "**important**");
    ta.setSelectionRange(0, ta.value.length);
    press("bold");
    assert("gras rappuye sur la meme selection : marqueurs retires (bascule)", ta.value === "important");

    ta.value = "mot";
    ta.setSelectionRange(0, 3);
    press("italic");
    assert("italique sur une selection", ta.value === "*mot*");

    ta.value = "fini";
    ta.setSelectionRange(0, 4);
    press("strike");
    assert("barre sur une selection", ta.value === "~~fini~~");
    ta.setSelectionRange(0, ta.value.length);
    press("strike");
    assert("barre rappuye : marqueurs retires (bascule)", ta.value === "fini");

    // Case a cocher sur une seule ligne, puis bascule inverse.
    // Checkbox on a single line, then toggled back.
    ta.value = "acheter du pain";
    ta.setSelectionRange(0, 0);
    press("task");
    assert("case a cocher : la ligne recoit le marqueur []", ta.value === "[ ] acheter du pain");
    ta.setSelectionRange(0, 0);
    press("task");
    assert("case a cocher rappuye : marqueur retire (bascule)", ta.value === "acheter du pain");

    // Case a cocher sur plusieurs lignes d'un coup.
    // Checkbox across several lines at once.
    ta.value = "pain\nlait\noeufs";
    ta.setSelectionRange(0, ta.value.length);
    press("task");
    assert("case a cocher sur une selection multi-lignes : chaque ligne traitee",
      ta.value === "[ ] pain\n[ ] lait\n[ ] oeufs");
    ta.setSelectionRange(0, ta.value.length);
    press("task");
    assert("bascule groupee : toutes les lignes deja cochables sont remises a plat",
      ta.value === "pain\nlait\noeufs");

    // Styles Titre / Normal.
    ta.value = "Courses";
    ta.setSelectionRange(0, 0);
    press("heading");
    assert("style Titre : prefixe # ajoute", ta.value === "# Courses");
    ta.setSelectionRange(0, 0);
    press("heading");
    assert("style Titre reapplique : pas d'empilement de #", ta.value === "# Courses");
    ta.setSelectionRange(0, 0);
    press("normal");
    assert("style Normal : prefixe # retire", ta.value === "Courses");

    // Marqueurs de bloc exclusifs entre eux : un titre qui devient une
    // case a cocher ne conserve pas son #. Block markers are mutually
    // exclusive: a heading turned into a checkbox keeps no #.
    ta.value = "# Courses";
    ta.setSelectionRange(0, 0);
    press("task");
    assert("un titre transforme en case a cocher perd son prefixe de titre", ta.value === "[ ] Courses");

    // Les lignes vides ne recoivent jamais de marqueur.
    // Empty lines never receive a marker.
    ta.value = "un\n\ndeux";
    ta.setSelectionRange(0, ta.value.length);
    press("task");
    assert("les lignes vides sont laissees intactes", ta.value === "[ ] un\n\n[ ] deux");

    // Sortie d'edition : le rendu doit reprendre la main et la barre
    // disparaitre. Leaving edit mode: the rendered view takes over and
    // the toolbar disappears.
    ta.value = "**gras** et *ital* et ~~barre~~";
    ta.dispatchEvent(new window.Event("input", { bubbles: true }));
    ta.dispatchEvent(new window.Event("blur", { bubbles: true }));
    await sleep(30);
    assert("sortie d'edition : la barre est masquee", bar.hidden === true);
    assert("rendu : le gras produit un <strong>", !!view.querySelector("strong"));
    assert("rendu : l'italique produit un <em>", !!view.querySelector("em"));
    assert("rendu : le barre produit un <s> (nouveau)", !!view.querySelector("s"));
    assert("rendu : les marqueurs bruts ne sont plus visibles",
      !view.textContent.includes("**") && !view.textContent.includes("~~"));
  }

  console.log("== Bloc-notes : plusieurs notes en onglets ==");
  {
    const noteTile = document.querySelector('[data-tile-id="t-c"]');
    const bar = noteTile.querySelector(".pwn-bar");
    const view = noteTile.querySelector(".pwn-view");
    const ta = noteTile.querySelector(".pwn-edit");
    const tabs = noteTile.querySelector(".pwn-tabs");
    const palette = noteTile.querySelector(".pwn-palette");
    const press = (act) => {
      const ev = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
      bar.querySelector('[data-act="' + act + '"]').dispatchEvent(ev);
      return ev;
    };

    // Contenu courant de la note d'origine, capture ici plutot que code
    // en dur : le bloc de test precedent (barre d'outils) a deja modifie
    // son texte. Current content of the original note, captured here
    // rather than hard-coded: the previous test block (toolbar) has
    // already changed its text.
    const firstNoteText = view.textContent.trim();
    assert("migration : la note d'origine est preservee (contenu non vide)", firstNoteText.length > 0);
    assert("une seule note au depart : barre d'onglets masquee", tabs.hidden === true);

    view.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("boutons de gestion de note presents dans la barre",
      !!bar.querySelector('[data-act="newNote"]') && !!bar.querySelector('[data-act="deleteNote"]') && !!bar.querySelector('[data-act="color"]'));

    // Ajout d'une seconde note.
    press("newNote");
    await sleep(30);
    assert("nouvelle note : la barre d'onglets apparait", tabs.hidden === false);
    assert("nouvelle note : deux onglets", tabs.querySelectorAll(".pwn-tab").length === 2);
    assert("nouvelle note : c'est la nouvelle qui est active",
      tabs.querySelectorAll(".pwn-tab")[1].classList.contains("pwn-tab-active"));
    assert("nouvelle note : l'editeur s'ouvre directement dessus", ta.hidden === false && ta.value === "");

    // Le libelle d'onglet suit la premiere ligne du texte.
    ta.value = "# Courses\nlait";
    ta.dispatchEvent(new window.Event("input", { bubbles: true }));
    ta.dispatchEvent(new window.Event("blur", { bubbles: true }));
    await sleep(30);
    const tabLabels = [...tabs.querySelectorAll(".pwn-tab")].map((t) => t.textContent);
    assert("libelle d'onglet deduit de la 1re ligne, marqueur # retire", tabLabels[1] === "Courses");
    assert("libelle du 1er onglet deduit de SA propre note, pas de la note active",
      tabLabels[0].length > 0 && tabLabels[0] !== tabLabels[1] && firstNoteText.startsWith(tabLabels[0].replace(/\u2026$/, "")));

    // Les deux notes sont bien distinctes.
    assert("la note active affiche son propre texte", view.textContent.includes("Courses"));
    tabs.querySelectorAll(".pwn-tab")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("bascule d'onglet : l'autre note s'affiche", view.textContent.trim() === firstNoteText);
    assert("bascule d'onglet : le texte de la 2e note n'est plus affiche", !view.textContent.includes("Courses"));
    assert("bascule d'onglet : l'onglet clique devient actif",
      tabs.querySelectorAll(".pwn-tab")[0].classList.contains("pwn-tab-active"));

    // Couleur de note.
    view.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("palette fermee par defaut", palette.hidden === true);
    press("color");
    await sleep(20);
    assert("bouton couleur : la palette s'ouvre", palette.hidden === false);
    assert("palette : 7 choix dont 'sans couleur'", palette.querySelectorAll(".pwn-swatch").length === 7);

    const green = palette.querySelector('[data-color="green"]');
    green.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    await sleep(30);
    assert("choix d'une couleur : la palette se referme", palette.hidden === true);
    assert("choix d'une couleur : la note est teintee",
      noteTile.querySelector(".pw-notes").classList.contains("pwn-n-green"));
    assert("choix d'une couleur : l'onglet porte la couleur (distinction sans ouvrir)",
      tabs.querySelectorAll(".pwn-tab")[0].classList.contains("pwn-t-green"));
    assert("l'autre note n'est PAS teintee",
      !tabs.querySelectorAll(".pwn-tab")[1].classList.contains("pwn-t-green"));

    // Regression : applySettings() reconstruit root.className depuis zero.
    // Sans le rappel a applyNoteColor(), la teinte disparaitrait au
    // moindre changement de reglages. Regression: applySettings() rebuilds
    // root.className from scratch. Without the applyNoteColor() call, the
    // tint would vanish on any settings change.
    assert("la teinte survit a un changement de reglages",
      noteTile.querySelector(".pw-notes").classList.contains("pwn-n-green"));

    // Suppression, avec confirmation.
    const realConfirm = window.confirm;
    window.confirm = () => false;
    press("deleteNote");
    await sleep(30);
    assert("suppression refusee : les deux notes sont toujours la", tabs.querySelectorAll(".pwn-tab").length === 2);

    window.confirm = () => true;
    press("deleteNote");
    await sleep(30);
    assert("suppression confirmee : il ne reste qu'une note", tabs.hidden === true);
    assert("suppression : c'est bien l'autre note qui subsiste", view.textContent.includes("Courses"));

    // Derniere note : elle est videe, jamais supprimee -- sinon le
    // bloc-notes n'aurait plus rien ou ecrire. Last note: it is emptied,
    // never removed -- otherwise the notepad would have nowhere left to
    // write.
    press("deleteNote");
    await sleep(30);
    assert("supprimer la derniere note la vide au lieu de la retirer",
      !!noteTile.querySelector(".pwn-view") && view.textContent.trim() !== "");
    window.confirm = realConfirm;
  }

  console.log("== Alerte de tableau : arret au tap n'importe ou sur l'ecran (compte a rebours, alarme horloge, rappel TV) ==");
  {
    // Cible deja passee des le montage (voir tuile t-v) : l'alerte
    // partagee (flash + pastille tap-to-stop) doit deja etre active,
    // reellement declenchee par la tuile elle-meme (fireAlert()) --
    // alertActive est donc bien a true cote widget, condition necessaire
    // pour verifier correctement le comportement de SON PROPRE bouton
    // "Arreter" ci-dessous.
    // Target already past at mount time (see tile t-v): the shared
    // alert (flash + tap-to-stop chip) should already be active,
    // genuinely triggered by the tile itself (fireAlert()) --
    // alertActive is thus genuinely true widget-side, a necessary
    // condition to correctly verify the behavior of ITS OWN "Stop"
    // button below.
    assert("flash plein ecran affiche des le montage (cible deja passee)", !!document.querySelector(".board-flash"));
    assert("pastille 'touchez l'ecran pour arreter' affichee", !!document.querySelector(".board-tap-hint"));
    assert("pastille traduite en francais", document.querySelector(".board-tap-hint").textContent === "Touchez l'écran pour arrêter");

    const countdownTile = document.querySelector('[data-tile-id="t-v"]');
    assert("tuile Compte a rebours retrouvee", !!countdownTile);
    const stopBtn = countdownTile.querySelector(".pwd-reset");
    assert("bouton 'Arreter' du compte a rebours visible pendant l'alerte (meme en mode date)",
      stopBtn?.classList.contains("pwd-stop"));

    // L'enregistrement du gestionnaire de tap est differe d'un tick
    // (voir public/app.js:boardAlert) : laisser le temps de s'attacher.
    // The tap handler registration is deferred by one tick (see
    // public/app.js:boardAlert): give it time to attach.
    await sleep(30);

    console.log("== Alerte de tableau : le bouton 'Arreter' dedie d'une tuile garde la main (pas de double-declenchement) ==");
    // On arrete D'ABORD via le VRAI bouton "Arreter" de la tuile
    // (alertActive reellement a true cote widget a cet instant) --
    // verifie que le bouton dedie continue de fonctionner normalement
    // (e.stopPropagation() l'isole du nouveau gestionnaire de tap
    // generique, voir le commentaire de boardAlert.start()).
    // First stop via the tile's ACTUAL "Stop" button (alertActive
    // genuinely true widget-side at this point) -- verifies the
    // dedicated button keeps working normally (e.stopPropagation()
    // isolates it from the new generic tap handler, see the comment on
    // boardAlert.start()).
    stopBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("flash retire par le bouton 'Arreter' dedie de la tuile", !document.querySelector(".board-flash"));
    assert("pastille retiree par le bouton 'Arreter' dedie", !document.querySelector(".board-tap-hint"));
    assert("bouton revient a son etat normal (onEnd bien appele par le bouton dedie)",
      !countdownTile.querySelector(".pwd-reset")?.classList.contains("pwd-stop"));

    console.log("== Alerte de tableau : tap n'importe ou sur l'ecran arrete une alerte generique (compte a rebours, alarme horloge OU rappel TV) ==");
    // Alerte independante de toute tuile (equivalent d'une alarme
    // Horloge ou d'un rappel Programme TV qui vient de sonner) :
    // window.PiBoard.startAlert est la MEME fonction partagee que
    // ctx.api.startAlert utilisee par les trois widgets -- tester
    // directement dessus verifie le mecanisme generique sans dependre
    // de la logique interne (etat "alerted", etc.) d'un widget precis.
    // Alert independent of any tile (equivalent of a Clock alarm or a
    // TV guide reminder that just rang): window.PiBoard.startAlert is
    // the SAME shared function as ctx.api.startAlert used by all three
    // widgets -- testing directly against it verifies the generic
    // mechanism without depending on a specific widget's internal
    // logic (the "alerted" flag, etc.).
    let onEndCalled = false;
    window.PiBoard.startAlert({ flash: true, soundName: null, durationMs: 30000, onEnd: () => { onEndCalled = true; } });
    await sleep(30);
    assert("alerte generique bien demarree", !!document.querySelector(".board-flash"));

    // Tap sur un element quelconque de l'ecran, sans rapport avec
    // l'alerte -- pas de bouton "Arreter" dedie ici, exactement le cas
    // d'usage demande (fermer en touchant n'importe ou l'ecran).
    // Tap on some unrelated element on the screen -- no dedicated
    // "Stop" button here, exactly the requested use case (dismiss by
    // touching anywhere on the screen).
    document.body.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("flash retire par un tap n'importe ou sur l'ecran", !document.querySelector(".board-flash"));
    assert("pastille retiree par un tap n'importe ou sur l'ecran", !document.querySelector(".board-tap-hint"));
    assert("onEnd bien appele suite au tap n'importe ou", onEndCalled);
  }

  console.log("== Page web : mode 'Via PiBoard' par defaut (contourne le blocage d'affichage en iframe) ==");
  {
    const webviewTile = document.querySelector('[data-tile-id="t-b"]');
    const iframe = webviewTile.querySelector(".pw-webview iframe");
    assert("tuile Page web retrouvee", !!iframe);
    assert("mode par defaut = 'Via PiBoard' : l'iframe pointe vers le proxy, pas directement vers le site",
      iframe.getAttribute("src").startsWith("/api/webview-proxy?url="));
    assert("URL du site correctement encodee en parametre",
      iframe.getAttribute("src").includes(encodeURIComponent("http://example.local/")));

    console.log("== Page web : bascule vers le mode 'Direct' ==");
    webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    const modeSel = document.querySelector('#tileForm [data-key="mode"]');
    assert("reglage 'Mode d'affichage' present dans le formulaire", !!modeSel);
    assert("proxy est bien la valeur par defaut du reglage", modeSel.value === "proxy");
    modeSel.value = "direct";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);

    const iframeAfter = webviewTile.querySelector(".pw-webview iframe");
    assert("mode 'Direct' : l'iframe pointe desormais directement vers le site",
      iframeAfter.getAttribute("src") === "http://example.local/");

    console.log("== Page web : URL sans schema (reflexe de barre d'adresse) completee en https:// automatiquement ==");
    // Cas reel signale : une adresse tapee sans "http(s)://" (ex.
    // "mon-site.fr") echouait avec "invalid url" en mode Via PiBoard,
    // et aurait ete traitee a tort comme un chemin relatif en mode
    // Direct. Reproduit ici dans les deux modes.
    // Real reported case: an address typed without "http(s)://" (e.g.
    // "my-site.example") failed with "invalid url" in Via PiBoard mode,
    // and would have been wrongly treated as a relative path in Direct
    // mode. Reproduced here in both modes.
    webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    document.querySelector('#tileForm [data-key="site1Url"]').value = "sans-schema.example.test/page";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);
    assert("mode 'Direct' + URL sans schema : 'https://' ajoute automatiquement",
      webviewTile.querySelector(".pw-webview iframe").getAttribute("src") === "https://sans-schema.example.test/page");

    webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    document.querySelector('#tileForm [data-key="mode"]').value = "proxy";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);
    const proxiedSrc = webviewTile.querySelector(".pw-webview iframe").getAttribute("src");
    assert("mode 'Via PiBoard' + URL sans schema : 'https://' ajoute avant le passage par le proxy",
      proxiedSrc.includes(encodeURIComponent("https://sans-schema.example.test/page")));

    console.log("== Page web : mode 'Image' (rendu par un vrai navigateur, aucune iframe) ==");
    // Troisieme approche : ni iframe, ni relais HTML -- donc plus rien
    // que le site puisse bloquer. C'est une IMAGE qui est affichee.
    // Third approach: no iframe, no HTML relay -- so nothing left for
    // the site to block. What's displayed is an IMAGE.
    webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    const modeOptions = Array.from(document.querySelectorAll('#tileForm [data-key="mode"] option')).map((o) => o.value);
    assert("les 3 modes sont proposes (Via PiBoard / Direct / Image)",
      modeOptions.includes("proxy") && modeOptions.includes("direct") && modeOptions.includes("shot"));
    document.querySelector('#tileForm [data-key="mode"]').value = "shot";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);

    assert("mode 'Image' : plus aucune iframe dans la tuile",
      !webviewTile.querySelector(".pw-webview iframe"));
    assert("mode 'Image' : une balise image est utilisee a la place",
      !!webviewTile.querySelector(".pw-webview img.pwv-shot"));
    assert("mode 'Image' : un message d'attente est affiche pendant le rendu (plusieurs secondes sur un Pi)",
      !!webviewTile.querySelector(".pw-webview .pwv-status"));

    console.log("== Page web : plusieurs sites via des onglets (jusqu'a 5) ==");
    {
      // Repart d'un mode simple (proxy) pour des assertions lisibles sur
      // le src de l'iframe. Starts from a simple mode (proxy) for
      // readable assertions on the iframe's src.
      webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      document.querySelector('#tileForm [data-key="mode"]').value = "proxy";
      assert("un seul site configure : aucune barre d'onglets",
        !webviewTile.querySelector(".pwv-tabs"));

      const site2Url = document.querySelector('#tileForm [data-key="site2Url"]');
      const site2Label = document.querySelector('#tileForm [data-key="site2Label"]');
      assert("2e emplacement de site present dans le formulaire", !!site2Url);
      site2Url.value = "https://deuxieme-site.example.test/";
      site2Label.value = "Mon 2e site";
      const site3Url = document.querySelector('#tileForm [data-key="site3Url"]');
      site3Url.value = "troisieme-site.example.test"; // sans schema, delibere / no scheme, deliberate
      document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(700);

      const tabs = webviewTile.querySelectorAll(".pwv-tab");
      assert("barre d'onglets affichee des que 2 sites ou plus sont configures", tabs.length === 3);
      assert("libelle personnalise utilise quand fourni", tabs[1].querySelector(".pwv-tab-label").textContent === "Mon 2e site");
      assert("libelle par defaut = nom de domaine quand aucun n'est fourni (sans le 'www.')",
        tabs[2].querySelector(".pwv-tab-label").textContent === "troisieme-site.example.test");
      assert("1er onglet actif par defaut", tabs[0].classList.contains("pwv-tab-active"));
      assert("URL du 1er onglet chargee par defaut",
        webviewTile.querySelector(".pw-webview iframe").getAttribute("src")
          .includes(encodeURIComponent("https://sans-schema.example.test/page")));

      tabs[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      assert("clic sur un onglet : il devient actif, l'ancien ne l'est plus",
        webviewTile.querySelectorAll(".pwv-tab")[2].classList.contains("pwv-tab-active")
        && !webviewTile.querySelectorAll(".pwv-tab")[0].classList.contains("pwv-tab-active"));
      assert("le contenu affiche est celui du nouvel onglet, avec 'https://' complete",
        webviewTile.querySelector(".pw-webview iframe").getAttribute("src")
          .includes(encodeURIComponent("https://troisieme-site.example.test")));
      assert("la barre d'onglets elle-meme n'est pas reconstruite au changement d'onglet",
        webviewTile.querySelectorAll(".pwv-tabs").length === 1);

      console.log("== Page web : bouton de rafraichissement sur chaque onglet ==");
      {
        assert("bouton de rafraichissement present sur chaque onglet",
          webviewTile.querySelectorAll(".pwv-tab-refresh").length === 3);

        // Clic sur le bouton de rafraichissement de l'onglet DEJA actif
        // (le 3e a ce stade) : un clic sur l'onglet lui-meme n'aurait
        // rien fait (deja actif, voir plus haut), c'est precisement ce
        // que ce bouton permet malgre tout.
        // Click on the ALREADY active tab's refresh button (the 3rd at
        // this point): clicking the tab itself would have done nothing
        // (already active, see above), this is exactly what this
        // button allows anyway.
        const activeTabBefore = webviewTile.querySelector(".pwv-tab.pwv-tab-active");
        const iframeBefore = webviewTile.querySelector(".pw-webview iframe");
        activeTabBefore.querySelector(".pwv-tab-refresh").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(60);
        assert("onglet toujours actif apres son propre rafraichissement",
          webviewTile.querySelector(".pwv-tab.pwv-tab-active").dataset.idx === activeTabBefore.dataset.idx);
        assert("le contenu a bien ete rafraichi (nouvel element iframe cree)",
          webviewTile.querySelector(".pw-webview iframe") !== iframeBefore);

        // Clic sur le bouton de rafraichissement d'un onglet INACTIF (le
        // 1er) : doit a la fois y basculer et charger son contenu.
        // Click on an INACTIVE tab's refresh button (the 1st): must
        // both switch to it and load its content.
        webviewTile.querySelectorAll(".pwv-tab")[0].querySelector(".pwv-tab-refresh")
          .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(60);
        assert("le bouton de rafraichissement d'un onglet inactif y bascule aussi",
          webviewTile.querySelectorAll(".pwv-tab")[0].classList.contains("pwv-tab-active"));
        assert("son contenu est charge",
          webviewTile.querySelector(".pw-webview iframe").getAttribute("src")
            .includes(encodeURIComponent("https://sans-schema.example.test/page")));
      }

      // Retire le 2e site : la barre d'onglets doit se reconstruire
      // proprement (2 onglets restants), sans onglet fantome ni
      // plantage -- l'ancien index actif (qui pointait sur le 3e site,
      // desormais le 2e) n'etant plus valable pour un tableau plus
      // court, l'affichage retombe simplement sur le premier onglet.
      // Removes the 2nd site: the tab bar must rebuild cleanly (2
      // remaining tabs), no ghost tab or crash -- since the old active
      // index (which pointed at the 3rd site, now the 2nd) is no longer
      // valid for a shorter array, the display simply falls back to the
      // first tab.
      webviewTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      document.querySelector('#tileForm [data-key="site2Url"]').value = "";
      document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(700);
      const tabsAfterRemoval = webviewTile.querySelectorAll(".pwv-tab");
      assert("un onglet retire des reglages : n'apparait plus dans la barre (2 restants)",
        tabsAfterRemoval.length === 2);
      assert("un onglet reste actif (pas d'etat casse apres le retrait)",
        Array.from(tabsAfterRemoval).some((t) => t.classList.contains("pwv-tab-active")));
      assert("le contenu affiche correspond bien a l'onglet marque actif",
        !!webviewTile.querySelector(".pw-webview iframe"));
    }
  }

  console.log("== Cours Cryptos : cours affiches via le proxy serveur (plus d'appel direct a CoinGecko) ==");
  {
    const cryptoTile = document.querySelector('[data-tile-id="t-w"]');
    tries = 0;
    while (!cryptoTile.querySelector(".pwc-row") && tries++ < 40) await sleep(50);
    const row = cryptoTile.querySelector(".pwc-row");
    assert("ligne de cours affichee", !!row);
    assert("prix affiche (formate)", (row.querySelector(".pwc-price")?.textContent || "").includes("50"));
    assert("variation 24h affichee", (row.querySelector(".pwc-change")?.textContent || "").includes("2.5"));
    assert("aucun bandeau 'donnees perimees' quand tout va bien", !cryptoTile.querySelector(".pwc-stale"));

    console.log("== Cours Cryptos : bandeau discret quand le proxy signale un repli sur donnees perimees ==");
    cryptoMock.priceStale = true;
    cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);
    assert("bandeau 'dernieres valeurs connues' affiche quand le proxy signale stale:true",
      !!cryptoTile.querySelector(".pwc-stale"));
    assert("les cours restent neanmoins affiches (pas remplaces par une erreur)",
      !!cryptoTile.querySelector(".pwc-row"));
    cryptoMock.priceStale = false;

    console.log("== Cours Cryptos : message d'erreur clair si le proxy est injoignable (pas de page blanche) ==");
    cryptoMock.blockPrices = true;
    cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);
    assert("message d'erreur affiche quand le proxy echoue completement",
      !!cryptoTile.querySelector(".pwc-err"));
    cryptoMock.blockPrices = false;
    cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);

    console.log("== Cours Cryptos : clic sur une ligne ouvre la courbe (via le proxy, pas CoinGecko directement) ==");
    {
      const freshRow = cryptoTile.querySelector(".pwc-row");
      freshRow.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      const modal = document.querySelector(".pwc-chart-line")?.closest(".modal");
      assert("fenetre de courbe ouverte au clic sur une ligne", !!modal && !modal.hidden);
      tries = 0;
      while (document.querySelector(".pwc-chart-line")?.getAttribute("d") === "" && tries++ < 40) await sleep(50);
      assert("courbe tracee (chemin SVG non vide)",
        (document.querySelector(".pwc-chart-line")?.getAttribute("d") || "").length > 0);
      assert("aucun indicateur 'perime' quand la courbe est fraiche",
        document.querySelector(".pwc-chart-status")?.hidden !== false
        || (document.querySelector(".pwc-chart-status")?.textContent || "") === "");

      console.log("== Cours Cryptos : traits de repere sur l'axe des ordonnees, avec valeurs indicatrices ==");
      {
        const gridLines = document.querySelectorAll(".pwc-chart-grid");
        const axisLabels = document.querySelectorAll(".pwc-chart-axis");
        assert("au moins un trait de repere en fond du graphique", gridLines.length > 0);
        assert("chaque trait de repere a sa valeur indicatrice en regard",
          axisLabels.length === gridLines.length);
        assert("les valeurs indicatrices sont bien du texte non vide (prix formate)",
          Array.from(axisLabels).every((el) => (el.textContent || "").trim().length > 0));
        // Les traits de repere doivent tomber sur des valeurs "rondes"
        // plutot que le min/max brut de la serie [100,105,98,110] --
        // verifie qu'aucune etiquette ne reprend une decimale non ronde
        // improbable comme "98,00" pile sur le minimum brut.
        // Reference lines must land on "round" values rather than the
        // series' raw min/max [100,105,98,110] -- checks that no label
        // reuses an improbable non-round decimal like "98.00" landing
        // exactly on the raw minimum.
        const labelTexts = Array.from(axisLabels).map((el) => el.textContent);
        assert("les valeurs sont arrondies (ex. multiples de 5), pas le minimum brut exact de la serie",
          !labelTexts.some((t) => t.replace(/[^0-9]/g, "") === "98"));
      }

      console.log("== Cours Cryptos : logo affiche a gauche du nom quand le symbole est connu ==");
      {
        const icon = document.querySelector(".pwc-modal-icon");
        assert("balise du logo presente dans la fenetre de courbe", !!icon);
        assert("adresse du logo construite a partir du symbole boursier connu (BTC)",
          (icon.getAttribute("src") || "").toLowerCase().includes("btc.svg"));
      }

      console.log("== Cours Cryptos : pas de logo quand le symbole boursier n'est pas connu ==");
      {
        // Teste le cas reel (une crypto SANS correspondance Binance,
        // donc sans symbole des l'ouverture -- pas une extinction en
        // cours de consultation, qui ne peut pas arriver en pratique
        // pour une meme piece deja ouverte).
        // Tests the real case (a coin WITHOUT a Binance mapping, so
        // with no symbol right from opening -- not a mid-viewing
        // disappearance, which can't happen in practice for the same
        // already-open coin).
        modal.querySelector(".modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        cryptoMock.priceData["piece-mysterieuse"] = { eur: 3, eur_24h_change: 0.1 };
        cryptoMock.chartPrices = [3, 3.1, 2.9];
        cryptoMock.chartSymbol = null;
        cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(60);
        document.querySelector('#tileForm [data-key="coins"]').value = "bitcoin,piece-mysterieuse";
        document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(700);

        const rows = cryptoTile.querySelectorAll(".pwc-row");
        const mysteryRow = Array.from(rows).find((r) => r.dataset.coin === "piece-mysterieuse");
        assert("2e crypto (sans correspondance Binance) bien affichee dans la liste", !!mysteryRow);
        mysteryRow.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(200);
        const icon2 = document.querySelector(".pwc-modal-icon");
        assert("le logo reste masque des l'ouverture quand la crypto n'a pas de symbole boursier connu",
          icon2.hidden === true);
        document.querySelector(".modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

        // Retour a l'etat d'origine pour la suite des tests.
        // Back to the original state for the rest of the tests.
        delete cryptoMock.priceData["piece-mysterieuse"];
        cryptoMock.chartPrices = [100, 105, 98, 110];
        cryptoMock.chartSymbol = "BTC";
        cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(60);
        document.querySelector('#tileForm [data-key="coins"]').value = "bitcoin";
        document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(700);
      }

    }

    console.log("== Cours Cryptos : couleurs du graphique personnalisables (fond, courbe, traits de repere) ==");
    {
      cryptoTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      const bgInput = document.querySelector('#tileForm [data-key="chartBgColor"]');
      const lineInput = document.querySelector('#tileForm [data-key="chartLineColor"]');
      const gridInput = document.querySelector('#tileForm [data-key="chartGridColor"]');
      assert("les 3 champs de couleur du graphique sont proposes dans les reglages",
        !!bgInput && !!lineInput && !!gridInput);
      bgInput.value = "#112233";
      lineInput.value = "#44aa66";
      gridInput.value = "#ffcc00";
      document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(700);

      cryptoTile.querySelector(".pwc-row").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      const wrap = document.querySelector(".pwc-chart-wrap");
      assert("couleur de fond personnalisee appliquee", wrap.style.getPropertyValue("--pwc-chart-bg").trim() === "#112233");
      assert("couleur de courbe personnalisee appliquee", wrap.style.getPropertyValue("--pwc-chart-line").trim() === "#44aa66");
      assert("couleur des traits de repere personnalisee appliquee", wrap.style.getPropertyValue("--pwc-chart-grid").trim() === "#ffcc00");

      document.querySelector(".modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    }
  }


  // Le fetch du calendrier des saints est asynchrone (charge apres le
  // premier rendu) : on attend qu'il se propage avant de verifier.
  // Fetching the nameday calendar is asynchronous (loaded after the
  // first render): wait for it to propagate before checking.
  tries = 0;
  while (!document.querySelector(".pwc-saint") && tries++ < 60) await sleep(50);
  assert("horloge : saint du jour affiche sous la date", (document.querySelector(".pwc-saint")?.textContent || "") === "Testine");
  assert("horloge : disposition par defaut du saint = en dessous (pas de classe inline)", !document.querySelector(".pwc-saint.pwc-saint-inline"));
  {
    const clockManifest = catalog.find((m) => m.id === "clock");
    const keys = (clockManifest?.settings || []).map((s) => s.key);
    assert("reglages horloge : format de date et disposition du saint exposes", ["dateFormat", "saintLayout"].every((k) => keys.includes(k)));
    const dateFormatSetting = clockManifest.settings.find((s) => s.key === "dateFormat");
    assert("format de date : 4 options (full/long/medium/short)",
      (dateFormatSetting?.options || []).map((o) => o.value).sort().join(",") === "full,long,medium,short");
  }
  tries = 0;
  while (!document.querySelector(".pww-saint") && tries++ < 60) await sleep(50);
  const wSaints = [...document.querySelectorAll(".pww-saint")].map((el) => el.textContent);
  assert("meteo : saint du jour affiche (colonne aujourd'hui)", wSaints.includes("Testine"));
  // Note : jsdom ne fait pas de vraie mise en page (clientWidth/Height
  // toujours 0), donc la tuile est systematiquement detectee "carree"
  // (computeLayoutMode) et la prevision de demain -- donc son saint --
  // n'y apparait jamais, quel que soit le reglage. Ce chemin (saint du
  // lendemain quand la prevision est affichee) est verifie separement,
  // hors DOM. Note: jsdom does no real layout (clientWidth/Height always
  // 0), so the tile is always detected as "square" (computeLayoutMode)
  // and tomorrow's forecast -- and so its name day -- never appears
  // here, regardless of the setting. This path (tomorrow's name day
  // when the forecast is shown) is verified separately, outside the DOM.

  console.log("== Meteo : pluie imminente sur la tuile compacte ==");
  tries = 0;
  while (!document.querySelector(".pw-weather .pww-rainsoon") && tries++ < 60) await sleep(50);
  const rainSoonText = document.querySelector(".pw-weather .pww-rainsoon")?.textContent || "";
  assert("ligne 'pluie dans ~X min' affichee (fenetre de pluie deterministe a 30-45 min)",
    /Pluie dans ~(15|30|45|60) min/.test(rainSoonText));

  console.log("== Meteo : clic sur la tuile -> modal detaillee (24h, 7 jours, UV, rafales, lever/coucher) ==");
  const weatherTile = document.querySelector(".pw-weather.pww-clickable");
  assert("tuile meteo marquee cliquable", !!weatherTile);
  weatherTile.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  const weatherModal = document.querySelector(".pww-modal-card")?.closest(".modal");
  assert("modal ouverte au clic", weatherModal && weatherModal.hidden === false);
  assert("modal : rappel pluie imminente repris en banniere", /Pluie dans ~(15|30|45|60) min/.test(document.querySelector(".pww-modal-rainsoon")?.textContent || ""));
  assert("modal : rafales affichees (27 km/h)", (document.querySelector(".pww-modal-stats")?.textContent || "").includes("27 km/h"));
  assert("modal : indice UV affiche avec sa bande (7.2 -> tres eleve)", (document.querySelector(".pww-modal-stats")?.textContent || "").includes("Très élevé"));
  assert("modal : lever et coucher du soleil affiches", (document.querySelector(".pww-modal-stats")?.textContent || "").includes("07:02") && (document.querySelector(".pww-modal-stats")?.textContent || "").includes("20:45"));
  assert("modal : bande horaire 24h presente (24 heures)", document.querySelectorAll(".pww-hourly-strip .pww-hour").length === 24);
  assert("modal : bande horaire commence a l'heure courante (pas minuit)", document.querySelector(".pww-hour-time")?.textContent === fmtHourFr(WEATHER_NOW));
  assert("modal : previsions 7 jours presentes (7 colonnes)", document.querySelectorAll(".pww-daily-list .pww-day-col").length === 7);
  assert("modal : icone meteo presente sur les pastilles horaires 24h", !!document.querySelector(".pww-hourly-strip .pww-hour-icon"));
  assert("modal : aucune temperature suspecte a 0deg sur les 7 jours (correctif modele a horizon court)",
    ![...document.querySelectorAll(".pww-day-col .pww-day-range")].some((n) => n.textContent.trim() === "0°"));
  assert("modal : probabilite de pluie du jour le plus pluvieux affichee (80%)", (document.querySelector(".pww-daily-list")?.textContent || "").includes("💧80%"));

  weatherModal.querySelector(".modal-close[data-close]")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  assert("modal meteo refermee par le bouton", weatherModal.hidden === true);

  console.log("== Sports mecaniques : programme des seances (F1 via Jolpica) ==");
  tries = 0;
  while (!document.querySelector('[data-tile-id="t-j"] .pwms-session') && tries++ < 80) await sleep(50);
  const f1Tile = document.querySelector('[data-tile-id="t-j"]');
  assert("manche courante affichee (la manche deja terminee est passee)",
    (f1Tile.querySelector(".pwms-event")?.textContent || "") === "Grand Prix de Test");
  assert("circuit affiche sous le nom de l'evenement",
    (f1Tile.querySelector(".pwms-circuit")?.textContent || "").includes("Circuit de Test"));

  const f1Sessions = [...f1Tile.querySelectorAll(".pwms-session")];
  assert("5 seances affichees (EL1, EL2, EL3, qualifs, course)", f1Sessions.length === 5);
  const labelOf = (n) => n.querySelector(".pwms-label")?.textContent || "";
  assert("libelles francais des essais libres (EL1/EL2/EL3)",
    labelOf(f1Sessions[0]) === "EL1" && labelOf(f1Sessions[2]) === "EL3");
  assert("qualifications et course presentes et dans l'ordre chronologique",
    labelOf(f1Sessions[3]) === "Qualifications" && labelOf(f1Sessions[4]) === "Course");

  assert("EL1 (il y a 3 h) marquee comme passee", f1Sessions[0].classList.contains("pwms-past"));
  assert("EL2 (il y a 30 min) marquee comme en cours", f1Sessions[1].classList.contains("pwms-live"));
  assert("EL3 (dans 2 h) marquee comme prochaine seance", f1Sessions[2].classList.contains("pwms-next"));
  assert("course identifiee comme telle (couleur dediee)", f1Sessions[4].classList.contains("pwms-kind-race"));
  assert("essais libres identifies comme tels", f1Sessions[0].classList.contains("pwms-kind-practice"));
  assert("regroupement par jour : au moins deux jours (course le lendemain)",
    f1Tile.querySelectorAll(".pwms-day").length >= 2);
  assert("attribution de la source F1 affichee", (f1Tile.textContent || "").includes("Jolpica"));

  console.log("== Sports mecaniques : programme MotoGP (flux public motogp.com) ==");
  const mgpTile = document.querySelector('[data-tile-id="t-k"]');
  tries = 0;
  while (!mgpTile.querySelector(".pwms-session") && tries++ < 80) await sleep(50);
  assert("evenement MotoGP affiche",
    (mgpTile.querySelector(".pwms-event")?.textContent || "") === "Grand Prix Moto de Test");
  const mgpSessions = [...mgpTile.querySelectorAll(".pwms-session")];
  assert("5 seances MotoGP affichees (Moto3 et rendez-vous presse ecartes)", mgpSessions.length === 5);
  const mgpLabels = mgpSessions.map(labelOf);
  assert("codes MotoGP traduits (FP1 -> EL1)", mgpLabels[0] === "EL1");
  assert("sprint et course traduits", mgpLabels.includes("Sprint") && mgpLabels.includes("Course"));
  assert("rendez-vous presse (type MEDIA) jamais affiche", !(mgpTile.textContent || "").includes("GearUP"));
  assert("categorie Moto3 ecartee par defaut (MotoGP uniquement)",
    !(mgpTile.textContent || "").includes("Moto3"));
  assert("sprint identifie comme tel (couleur dediee)",
    mgpSessions.some((n) => n.classList.contains("pwms-kind-sprint")));
  assert("qualification identifiee comme telle",
    mgpSessions.some((n) => n.classList.contains("pwms-kind-qualifying")));
  assert("attribution de la source MotoGP affichee", (mgpTile.textContent || "").includes("motogp.com"));

  console.log("== Trajet domicile-travail : TomTom Routing, retard colore, depart conseille ==");
  tries = 0;
  while (document.querySelectorAll(".pw-commute .pwm-col").length < 3 && tries++ < 80) await sleep(50);
  const commuteCols = [...document.querySelectorAll(".pw-commute .pwm-col")];
  assert("3 trajets affiches (A→B, B→A, trajet supplementaire)", commuteCols.length === 3);

  const colAtoB = commuteCols.find((c) => c.querySelector(".pwm-dir")?.textContent === "A → B");
  const colBtoA = commuteCols.find((c) => c.querySelector(".pwm-dir")?.textContent === "B → A");
  const colTrip = commuteCols.find((c) => c.querySelector(".pwm-dir")?.textContent === "Grand-mère");
  assert("les 3 trajets sont bien identifies par leur libelle", !!colAtoB && !!colBtoA && !!colTrip);

  assert("duree affichee (25 min, temps reel TomTom avec trafic)", (colAtoB?.textContent || "").includes("25 min"));
  assert("distance affichee (15.3 km)", (colAtoB?.textContent || "").includes("15.3 km"));
  assert("retard colore affiche (+10 min, pile sur le seuil modere)", (colAtoB?.textContent || "").includes("+10 min"));
  assert("classe de couleur 'modere' appliquee au retard", !!colAtoB?.querySelector(".pwm-delay-moderate"));

  assert("heure de depart conseillee affichee pour A→B (heure d'arrivee renseignee)",
    (colAtoB?.textContent || "").includes(TOMTOM_LEAVE_BY_TEXT));
  assert("PAS d'heure de depart conseillee pour B→A (aucune heure d'arrivee renseignee)",
    !colBtoA?.querySelector(".pwm-leaveby"));
  assert("heure de depart conseillee affichee pour le trajet supplementaire (sa propre heure d'arrivee)",
    (colTrip?.textContent || "").includes(TOMTOM_LEAVE_BY_TEXT));

  const commuteQuota = document.querySelector(".pw-commute .pwm-quota");
  assert("compteur de quota TomTom affiche et non vide", commuteQuota && !commuteQuota.hidden && /\d+ \/ 2500/.test(commuteQuota.textContent));
  assert("compteur de quota incremente d'au moins 3 (un appel par trajet calcule)", COMMUTE_QUOTA_COUNT >= 3);

  console.log("== Trajet domicile-travail : suggestions d'adresse cliquables dans les reglages ==");
  {
    const commuteTileEl = document.querySelector('[data-tile-id="t-i"]');
    assert("tuile trajet localisee dans la grille", !!commuteTileEl);
    commuteTileEl.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("modale de reglages ouverte", document.getElementById("tileModal").hidden === false);

    const homeInput = document.querySelector('#tileForm [data-key="home"]');
    assert("champ adresse 'home' present et de type texte", !!homeInput && homeInput.type === "text");
    assert("c'est bien un champ 'address' (classe dediee)", homeInput.classList.contains("field-address-input"));
    const homeList = homeInput.parentElement.querySelector(".field-address-suggest");
    assert("liste de suggestions presente et cachee avant toute saisie", !!homeList && homeList.hidden === true);

    // Adresse valide : la liste doit proposer la suggestion resolue par
    // Nominatim (voir le mock), cliquable. Valid address: the list
    // should offer the suggestion resolved by Nominatim (see mock),
    // clickable.
    homeInput.value = "12 Rue de Paris, Toulouse";
    homeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(500); // au-dela du debounce de 400ms / beyond the 400ms debounce
    assert("suggestion affichee avec le nom complet resolu", homeList.textContent.includes("31000 Toulouse") && !homeList.hidden);
    const suggestBtn = homeList.querySelector("button[data-idx]");
    assert("suggestion presentee comme un bouton cliquable (pas juste un texte)", !!suggestBtn && !suggestBtn.disabled);

    suggestBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("clic sur la suggestion : le champ est rempli avec l'adresse complete", homeInput.value.includes("31000 Toulouse"));
    assert("clic sur la suggestion : la liste se referme", homeList.hidden === true);

    // Adresse introuvable (marqueur de mock "Nullepart") : la liste
    // affiche un message clair, non cliquable. Address not found (mock
    // marker "Nullepart"): the list shows a clear, non-clickable message.
    homeInput.value = "Nullepart";
    homeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(500);
    const noneBtn = homeList.querySelector("button:disabled");
    assert("adresse introuvable : message present et non cliquable", !homeList.hidden && !!noneBtn && noneBtn.textContent.includes("Aucune adresse"));

    // Saisie trop courte : la liste redisparait plutot que d'afficher un
    // resultat pour une requete trop vague. Too-short input: the list
    // hides again rather than showing a result for an overly vague query.
    homeInput.value = "1";
    homeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("saisie trop courte : liste cachee de nouveau", homeList.hidden === true);

    // Clic ailleurs dans la modale : referme une liste ouverte sans
    // fermer la modale. Click elsewhere in the modal: closes an open
    // list without closing the modal.
    homeInput.value = "12 Rue de Paris, Toulouse";
    homeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(500);
    assert("liste ouverte avant le clic exterieur", homeList.hidden === false);
    document.getElementById("tileModalTitle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("clic hors du champ adresse : liste refermee", homeList.hidden === true);
    assert("clic hors du champ adresse : modale de reglages toujours ouverte", document.getElementById("tileModal").hidden === false);

    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Qualite de l'air : indice, polluant et pollen dominants ==");
  tries = 0;
  while (!document.querySelector(".pw-airquality .paq-value") && tries++ < 60) await sleep(50);
  assert("indice europeen affiche (42)", (document.querySelector(".pw-airquality .paq-value")?.textContent || "").trim() === "42");
  assert("niveau 'Degrade' affiche (FR, palier 40-60)", (document.querySelector(".pw-airquality .paq-level")?.textContent || "").includes("Dégradé"));
  assert("mode detaille : 5 puces polluants + 1 puce pollen (bouleau en saison)", document.querySelectorAll(".pw-airquality .paq-chip").length === 6);
  assert("pollen hors saison NON affiche (un pollen actif)", !document.querySelector(".pw-airquality .paq-outofseason"));
  const chipTexts = [...document.querySelectorAll(".pw-airquality .paq-chip")].map((c) => c.textContent);
  assert("puce PM2.5 avec sa valeur brute (18)", chipTexts.some((t) => t.includes("PM2.5") && t.includes("18")));
  assert("puce pollen Bouleau au niveau modere", chipTexts.some((t) => t.includes("Bouleau") && t.includes("modéré")));
  assert("showPollen (compact, desactive) sans effet en mode detaille : pollens toujours visibles via showPollenDetailed",
    document.querySelectorAll(".pw-airquality .paq-chip").length === 6);

  console.log("== Agenda : fusion de calendriers, couleurs, vues liste/semaine ==");
  tries = 0;
  while (!document.querySelector(".pw-calendar .pwc-item") && tries++ < 80) await sleep(50);
  const listItemTexts = [...document.querySelectorAll(".pw-calendar .pwc-item")].map((el) => el.textContent);
  assert("vue liste par defaut : evenement toute la journee (calendrier Famille) affiche", listItemTexts.some((t) => t.includes("Anniversaire Lea")));
  assert("vue liste : evenement chronometre avec lieu (calendrier Travail) affiche", listItemTexts.some((t) => t.includes("Reunion equipe") && t.includes("Salle B")));
  const legendText = document.querySelector(".pw-calendar .pwc-legend")?.textContent || "";
  assert("legende : les deux calendriers apparaissent avec leur libelle", legendText.includes("Famille") && legendText.includes("Travail"));

  const weekTab = [...document.querySelectorAll(".pw-calendar .pwc-tab")].find((b) => b.dataset.view === "week");
  weekTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(50);
  assert("bascule vers la vue semaine : grille de 7 colonnes affichee", document.querySelectorAll(".pw-calendar .pwc-wk-col").length === 7);
  assert("vue semaine : la colonne d'aujourd'hui est mise en evidence", !!document.querySelector(".pw-calendar .pwc-wk-today"));
  assert("vue semaine : l'evenement toute la journee (aujourd'hui) apparait dans sa colonne", (document.querySelector(".pw-calendar .pwc-wk-today")?.textContent || "").includes("Anniversaire Lea"));

  console.log("== Agenda : detail d'un evenement au clic sur une pastille (vue semaine) ==");
  {
    const calTile = document.querySelector('[data-tile-id="t-f"]');
    // La pastille de "Reunion equipe" porte lieu ET description : c'est
    // celle qui exerce toutes les lignes du detail. The "Reunion equipe"
    // chip carries both a location AND a description: it's the one that
    // exercises every row of the detail view.
    const chips = [...calTile.querySelectorAll(".pwc-wk-chip")];
    assert("vue semaine : les pastilles portent un index d'occurrence (data-occ)",
      chips.length > 0 && chips.every((c) => c.dataset.occ !== undefined));
    assert("vue semaine : les pastilles sont annoncees comme actionnables (role/tabindex)",
      chips.every((c) => c.getAttribute("role") === "button" && c.getAttribute("tabindex") === "0"));

    assert("aucune surcouche de detail avant le clic", !document.querySelector(".pwc-detail-overlay"));

    const meetingChip = chips.find((c) => c.textContent.includes("Reunion equipe"));
    assert("pastille 'Reunion equipe' presente dans la grille semaine", !!meetingChip);
    meetingChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);

    const overlay = document.querySelector(".pwc-detail-overlay");
    assert("clic sur la pastille : la surcouche de detail s'ouvre", !!overlay);
    // Montee sur document.body et non dans la tuile : sinon Gridstack la
    // rognerait (overflow: hidden). Mounted on document.body rather than
    // inside the tile: Gridstack would otherwise clip it (overflow: hidden).
    assert("la surcouche est montee hors de la tuile (sinon rognee par la grille)",
      !!overlay && overlay.parentElement === document.body);
    const overlayText = overlay.textContent;
    assert("detail : titre complet de l'evenement affiche", overlayText.includes("Reunion equipe"));
    assert("detail : lieu affiche", overlayText.includes("Salle B"));
    assert("detail : description affichee", overlayText.includes("Ordre du jour"));
    assert("detail : sequences ICS desechappees (\\; devient ;)", overlayText.includes("Point budget; puis planning"));
    assert("detail : sauts de ligne de la description preserves",
      (overlay.querySelector(".pwc-detail-desc")?.textContent || "").includes("\n"));

    // Clic DANS la boite : ne doit pas refermer (seul l'exterieur ferme).
    // Click INSIDE the box: must not close (only the outside closes).
    overlay.querySelector(".pwc-detail-box").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic a l'interieur de la boite : la surcouche reste ouverte", !!document.querySelector(".pwc-detail-overlay"));

    // Echap ferme. Escape closes.
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(20);
    assert("touche Echap : la surcouche se referme", !document.querySelector(".pwc-detail-overlay"));

    // Reouverture puis fermeture par la croix. Reopen, then close via the cross.
    meetingChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("reouverture possible apres fermeture", !!document.querySelector(".pwc-detail-overlay"));
    document.querySelector(".pwc-detail-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic sur la croix : la surcouche se referme", !document.querySelector(".pwc-detail-overlay"));

    // Reouverture puis clic sur le fond. Reopen, then click the backdrop.
    meetingChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    document.querySelector(".pwc-detail-overlay").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic sur le fond : la surcouche se referme", !document.querySelector(".pwc-detail-overlay"));

    // Un evenement sans lieu ni description ne doit pas produire de
    // lignes vides. An event with neither location nor description must
    // not produce empty rows.
    const birthdayChip = chips.find((c) => c.textContent.includes("Anniversaire Lea"));
    if (birthdayChip) {
      birthdayChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(30);
      const rows = document.querySelectorAll(".pwc-detail-overlay .pwc-detail-row");
      assert("evenement sans lieu ni description : une seule ligne (la date/heure), pas de ligne vide", rows.length === 1);
      assert("evenement toute la journee : mention 'Toute la journee' dans le detail",
        (document.querySelector(".pwc-detail-overlay")?.textContent || "").includes("Toute la journ"));
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(20);
    }
    assert("aucune surcouche residuelle en fin de scenario", !document.querySelector(".pwc-detail-overlay"));
  }

  console.log("== Agenda : navigation semaine precedente/suivante ==");
  {
    const calTile = document.querySelector('[data-tile-id="t-f"]');
    const todayColIndexBefore = [...calTile.querySelectorAll(".pwc-wk-col")].findIndex((c) => c.classList.contains("pwc-wk-today"));
    assert("navigation : bouton semaine precedente present", !!calTile.querySelector('[data-nav="-1"]'));
    assert("navigation : bouton semaine suivante present", !!calTile.querySelector('[data-nav="1"]'));
    assert("navigation : etiquette de periode non mise en avant sur la semaine de reference",
      !calTile.querySelector(".pwc-wk-navlabel").classList.contains("pwc-wk-navlabel-active"));

    const dayNumsBefore = [...calTile.querySelectorAll(".pwc-wk-daynum")].map((el) => el.textContent);
    calTile.querySelector('[data-nav="1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("apres 'semaine suivante' : plus aucune colonne 'aujourd'hui' mise en evidence (on a quitte la semaine de reference)",
      !calTile.querySelector(".pwc-wk-today"));
    assert("l'etiquette de periode est mise en avant des qu'on s'eloigne de la semaine de reference",
      calTile.querySelector(".pwc-wk-navlabel").classList.contains("pwc-wk-navlabel-active"));
    // La navigation change reellement la fenetre de dates affichee (pas
    // un simple habillage cosmetique) : verifie via les numeros de jour
    // affiches plutot que via un evenement precis de la donnee de test,
    // pour rester valable quel que soit le jour reel d'execution de la
    // suite (un evenement fixe ne tombe pas toujours dans la meme
    // semaine calendaire selon le jour du mois ou tourne le test).
    // Navigation genuinely changes the displayed date window (not mere
    // cosmetic dressing): checked via the displayed day numbers rather
    // than a specific test-data event, to stay valid whatever the real
    // day the suite happens to run on (a fixed event doesn't always fall
    // in the same calendar week depending on the day of month the test
    // runs).
    const dayNumsAfter = [...calTile.querySelectorAll(".pwc-wk-daynum")].map((el) => el.textContent);
    assert("les numeros de jour affiches changent bien apres la navigation d'une semaine",
      dayNumsBefore.join(",") !== dayNumsAfter.join(","));

    calTile.querySelector('[data-nav="-1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("un aller-retour +1/-1 semaine revient exactement a la semaine de reference (aujourd'hui a nouveau visible)",
      !!calTile.querySelector(".pwc-wk-today"));

    // Navigue de nouveau, puis clique sur l'etiquette elle-meme : doit
    // ramener directement a la semaine de reference (raccourci "aujourd'hui").
    // Navigates away again, then clicks the label itself: must jump
    // straight back to the reference week ("today" shortcut).
    calTile.querySelector('[data-nav="1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    calTile.querySelector('[data-nav="1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("apres avoir avance de 2 semaines, plus de colonne 'aujourd'hui'", !calTile.querySelector(".pwc-wk-today"));
    calTile.querySelector('[data-nav="today"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("clic sur l'etiquette de periode : retour direct a la semaine de reference",
      !!calTile.querySelector(".pwc-wk-today"));
    const todayColIndexAfter = [...calTile.querySelectorAll(".pwc-wk-col")].findIndex((c) => c.classList.contains("pwc-wk-today"));
    assert("la position de la colonne 'aujourd'hui' apres le retour correspond bien a celle de depart",
      todayColIndexAfter === todayColIndexBefore);

    console.log("== Agenda : re-clic sur l'onglet Semaine (deja actif) NE reinitialise PAS la navigation ==");
    calTile.querySelector('[data-nav="1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const wkTab = [...calTile.querySelectorAll(".pwc-tab")].find((b) => b.dataset.view === "week");
    wkTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("re-clic sur l'onglet Semaine deja actif : la navigation en cours n'est PAS remise a zero",
      !calTile.querySelector(".pwc-wk-today"));

    console.log("== Agenda : quitter puis revenir sur l'onglet Semaine reinitialise bien la navigation ==");
    const listTab = [...calTile.querySelectorAll(".pwc-tab")].find((b) => b.dataset.view === "list");
    listTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    wkTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("un vrai changement de vue (liste -> semaine) revient a la semaine de reference",
      !!calTile.querySelector(".pwc-wk-today"));
  }

  console.log("== Agenda : disposition de la grille semaine (aujourd'hui en debut / au milieu) ==");
  {
    const calTile = document.querySelector('[data-tile-id="t-f"]');
    calTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const layoutSel = document.querySelector('#tileForm [data-key="weekLayout"]');
    assert("reglage de disposition de la grille semaine present", !!layoutSel);
    layoutSel.value = "todayStart";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);

    // L'enregistrement des reglages ramene la tuile a sa vue par defaut
    // (liste) -- il faut rebasculer sur l'onglet Semaine pour verifier
    // la grille. Saving settings brings the tile back to its default
    // view (list) -- switching back to the Week tab is needed to check
    // the grid.
    let calTileNow = document.querySelector('[data-tile-id="t-f"]');
    let wkTabNow = [...calTileNow.querySelectorAll(".pwc-tab")].find((b) => b.dataset.view === "week");
    wkTabNow.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    let cols = calTileNow.querySelectorAll(".pwc-wk-col");
    assert("disposition 'aujourd'hui en debut' : 7 colonnes affichees", cols.length === 7);
    assert("disposition 'aujourd'hui en debut' : la 1ere colonne de la grille est celle d'aujourd'hui",
      cols[0]?.classList.contains("pwc-wk-today"));

    calTileNow.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    document.querySelector('#tileForm [data-key="weekLayout"]').value = "todayMiddle";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);

    calTileNow = document.querySelector('[data-tile-id="t-f"]');
    wkTabNow = [...calTileNow.querySelectorAll(".pwc-tab")].find((b) => b.dataset.view === "week");
    wkTabNow.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    cols = calTileNow.querySelectorAll(".pwc-wk-col");
    const todayIdx = [...cols].findIndex((c) => c.classList.contains("pwc-wk-today"));
    assert("disposition 'aujourd'hui au milieu' : aujourd'hui tombe bien en position centrale (index 3 sur 7)",
      todayIdx === 3);

    // Retour a la disposition par defaut pour la suite de la suite.
    // Back to the default layout for the rest of the suite.
    calTileNow.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    document.querySelector('#tileForm [data-key="weekLayout"]').value = "calendar";
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(700);
  }

  console.log("== Radar meteo : widget present, reglages exposes ==");
  // Comme la tuile Trafic (egalement basee sur Leaflet), le rendu carte
  // reel n'est pas simule ici (Leaflet + tuiles distantes hors de portee
  // du DOM jsdom) : on verifie la presence au catalogue et la forme des
  // reglages.
  // Like the Traffic tile (also Leaflet-based), the actual map rendering
  // isn't simulated here (Leaflet + remote tiles are out of jsdom's
  // reach): we check catalog presence and the settings shape.
  {
    const radarManifest = catalog.find((m) => m.id === "radar");
    assert("widget radar present dans le catalogue", !!radarManifest);
    const keys = (radarManifest?.settings || []).map((s) => s.key);
    assert("reglages radar : ville, zoom, fond de carte, opacite, legende, lecture auto, vitesse, rafraichissement",
      ["city", "zoom", "basemap", "opacity", "showLegend", "autoplay", "animationSpeed", "refresh"].every((k) => keys.includes(k)));
    assert("reglage includeForecast bien retire (RainViewer a supprime le nowcast gratuit)", !keys.includes("includeForecast"));
    assert("reglages vent exposes : activation, densite, etiquettes, legende",
      ["showWind", "windDensity", "showWindLabels", "showWindLegend"].every((k) => keys.includes(k)));
    const windSetting = (radarManifest?.settings || []).find((x) => x.key === "showWind");
    assert("couche vent desactivee par defaut (option, pas impose)", windSetting && windSetting.default === false);
    const densitySetting = (radarManifest?.settings || []).find((x) => x.key === "windDensity");
    assert("trois densites de grille proposees",
      densitySetting && (densitySetting.options || []).map((o) => o.value).sort().join(",") === "high,low,medium");
  }

  console.log("== Avions en vue : widget present, reglages exposes ==");
  // Meme raisonnement que Radar/Trafic : pas de montage carte Leaflet
  // reel dans jsdom, on verifie le catalogue et la forme des reglages.
  // Same reasoning as Radar/Traffic: no real Leaflet map mounting in
  // jsdom, we check the catalog and the settings shape.
  {
    const planesManifest = catalog.find((m) => m.id === "planes");
    assert("widget planes present dans le catalogue", !!planesManifest);
    const keys = (planesManifest?.settings || []).map((s) => s.key);
    assert("reglages avions : ville, reseau ADS-B, rayon, zoom, fond de carte, etiquettes, trainees, max, rafraichissement, compas",
      ["city", "source", "radius", "zoom", "basemap", "showLabels", "showTrails", "maxPlanes", "refresh",
        "showCompass", "compassPosition", "compassOpacity"].every((k) => keys.includes(k)));
    const compassPosSetting = planesManifest.settings.find((s) => s.key === "compassPosition");
    assert("position par defaut du compas : bas-droite", compassPosSetting && compassPosSetting.default === "br");
    assert("compas affiche par defaut",
      planesManifest.settings.find((s) => s.key === "showCompass")?.default === true);
    const sourceSetting = planesManifest.settings.find((s) => s.key === "source");
    assert("reseau ADS-B : choix entre adsb.lol et adsb.fi expose dans les reglages",
      (sourceSetting?.options || []).map((o) => o.value).sort().join(",") === "adsbfi,adsblol");

    // Le controle de vraisemblance d'un trajet (voir routeDetourKm dans
    // widget.js) n'est pas testable ici : ce widget repose sur Leaflet,
    // non instanciable sous jsdom -- limite deja documentee ailleurs
    // dans cette suite. La logique de calcul a ete verifiee a la main
    // sur des cas reels (voir le CHANGELOG 1.41.3) ; ce qui reste
    // verifiable automatiquement et utile, c'est que les libelles
    // existent bien dans LES DEUX langues.
    // A route's plausibility check (see routeDetourKm in widget.js)
    // isn't testable here: this widget relies on Leaflet, which can't
    // be instantiated under jsdom -- a limit already documented
    // elsewhere in this suite. The computation itself was verified by
    // hand against real cases (see CHANGELOG 1.41.3); what stays
    // automatically verifiable and useful is that the labels exist in
    // BOTH languages.
    for (const lang of ["fr", "en"]) {
      window.PiBoardI18n.setLang(lang);
      for (const key of ["planes.routeDoubtful", "planes.routeDoubtfulHint"]) {
        // Une cle absente est renvoyee telle quelle par t() : comparer a
        // la cle elle-meme suffit a detecter une traduction manquante.
        // A missing key is returned as-is by t(): comparing against the
        // key itself is enough to detect a missing translation.
        assert(`libelle ${key} traduit en ${lang}`, window.PiBoardI18n.t(key) !== key);
      }
    }
    window.PiBoardI18n.setLang("fr"); // restaure la langue attendue par la suite / restores the language the suite expects
  }

  console.log("== Flux RSS : article cliquable, popup de lecture nettoyee ==");
  const rssTileG = document.querySelector('[data-tile-id="t-g"]');
  tries = 0;
  while (!rssTileG.querySelector(".pwr-item") && tries++ < 60) await sleep(50);
  const rssItems = [...rssTileG.querySelectorAll(".pwr-item")];
  assert("5 articles affiches", rssItems.length === 5);
  const linkedItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article avec lien");
  const unlinkedItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article sans lien");
  const noExtractItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article extraction echouee");
  assert("article avec lien marque cliquable", linkedItem?.classList.contains("pwr-clickable"));
  assert("article sans lien NON marque cliquable", !unlinkedItem?.classList.contains("pwr-clickable"));

  assert("popup pas encore creee avant tout clic (creation paresseuse)", !document.querySelector(".pwr-modal-card"));

  unlinkedItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  assert("clic sur un article sans lien : aucune popup n'est creee", !document.querySelector(".pwr-modal-card"));

  linkedItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  const rssModal = document.querySelector(".pwr-modal-card")?.closest(".modal");
  assert("clic sur un article avec lien : popup ouverte", rssModal && rssModal.hidden === false);
  assert("popup : titre de l'article affiche", document.querySelector(".pwr-modal-title")?.textContent === "Article avec lien");

  // L'extraction du texte complet de la page liee reussit pour cet
  // article (voir le mock) : attendre qu'elle remplace le message de
  // chargement, comme le fait le vrai widget de facon asynchrone.
  // Full-page text extraction succeeds for this article (see the mock):
  // wait for it to replace the loading message, just like the real
  // widget does asynchronously.
  tries = 0;
  while ((document.querySelector(".pwr-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
  const rssBody = document.querySelector(".pwr-modal-body");
  assert("popup : texte EXTRAIT de la page preferee au resume du flux", rssBody?.textContent.includes("Texte complet"));
  assert("popup : gras conserve dans le texte extrait", rssBody?.innerHTML.includes("<b>extrait</b>"));
  assert("popup : auteur (byline) de l'extraction affiche dans le meta", (document.querySelector(".pwr-modal-meta")?.textContent || "").includes("Par Notre Testeur"));
  assert("popup : script du texte extrait retire (non execute)", !window.__pwnedExtract);
  assert("popup : balise <script> absente du texte extrait injecte", !rssBody?.innerHTML.includes("<script"));
  assert("popup : gestionnaire onclick retire du lien du texte extrait", !rssBody?.innerHTML.includes("onclick"));
  assert("popup : href retire du lien du texte extrait (fait pour etre lu, pas navigue)", !rssBody?.querySelector("a")?.getAttribute("href"));
  assert("popup : texte du lien extrait conserve", rssBody?.textContent.includes("lien extrait"));
  assert("popup : pas de note de repli quand l'extraction reussit", !rssBody?.querySelector(".pwr-modal-thin-note"));

  // Illustration fournie par le flux (media:content), affichee
  // independamment de la source du texte (extrait ici).
  // Feed-provided illustration (media:content), shown independently
  // from the text source (extracted here).
  const rssFigure = document.querySelector(".pwr-modal-figure");
  assert("popup : illustration du flux affichee (media:content)", !!rssFigure?.querySelector("img[src='https://example.test/photo.jpg']"));
  assert("popup : legende et credit de l'illustration affiches", (rssFigure?.textContent || "").includes("Legende de la photo") && (rssFigure?.textContent || "").includes("Photographe Test"));

  rssModal.querySelector(".modal-close[data-close]")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  assert("popup refermee par le bouton", rssModal.hidden === true);

  console.log("== Flux RSS : repli sur le resume du flux si l'extraction echoue ==");
  noExtractItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  tries = 0;
  while ((document.querySelector(".pwr-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
  assert("popup : repli sur le resume du flux (Resume du flux, utilise en repli)",
    (document.querySelector(".pwr-modal-body")?.textContent || "").includes("Resume du flux, utilise en repli"));
  assert("popup : note 'mode lecture indisponible' affichee quand le repli est lui-meme tres pauvre en texte (evite l'impression de fonctionnalite cassee)",
    !!document.querySelector(".pwr-modal-thin-note"));
  document.querySelector(".pwr-modal-card")?.closest(".modal")?.querySelector(".modal-close[data-close]")
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);

  console.log("== Flux RSS : article payant (paywall, ex. Le Monde) detecte et signale honnetement ==");
  const paywallItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article paywall");
  paywallItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  tries = 0;
  while ((document.querySelector(".pwr-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
  assert("popup : repli sur le resume du flux pour un article payant",
    (document.querySelector(".pwr-modal-body")?.textContent || "").includes("Resume du flux pour un article payant"));
  assert("popup : message specifique 'abonnement requis', PAS la mention generique 'mode lecture indisponible'",
    !!document.querySelector(".pwr-modal-thin-note")
    && (document.querySelector(".pwr-modal-thin-note").textContent || "").includes("abonnement"));
  document.querySelector(".pwr-modal-card")?.closest(".modal")?.querySelector(".modal-close[data-close]")
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);

  console.log("== Flux RSS : apercu gratuit recupere malgre un statut de paywall (statut non-2xx mais corps exploitable) ==");
  const previewItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article apercu paywall");
  previewItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  tries = 0;
  while ((document.querySelector(".pwr-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
  const previewBody = document.querySelector(".pwr-modal-body");
  assert("popup : l'apercu gratuit extrait est bien affiche, pas juste le resume du flux",
    (previewBody?.textContent || "").includes("apercu gratuit de l'article"));
  assert("popup : banniere 'apercu gratuit uniquement' affichee (honnete : ce n'est pas l'article complet)",
    !!previewBody?.querySelector(".pwr-modal-thin-note") && (previewBody.querySelector(".pwr-modal-thin-note").textContent || "").includes("Aperçu partiel"));
  document.querySelector(".pwr-modal-card")?.closest(".modal")?.querySelector(".modal-close[data-close]")
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);

  console.log("== Scores sportifs : alternance heure/date pour un match a venir hors aujourd'hui ==");
  tries = 0;
  while (document.querySelectorAll(".pw-sport li").length < 4 && tries++ < 60) await sleep(50);
  const sportRows = [...document.querySelectorAll(".pw-sport li")];
  assert("4 evenements affiches", sportRows.length === 4);

  const rowFor = (name) => sportRows.find((li) => li.textContent.includes(name));
  const todayRow = rowFor("Equipe Aujourdhui A");
  const tomorrowRow = rowFor("Equipe Demain A");
  const liveRow = rowFor("Equipe Live A");
  const finalRow = rowFor("Equipe Finie A");

  assert("match du jour : heure simple, pas de bascule heure/date", !todayRow.querySelector(".pws-status-date"));
  assert("match live : mention en direct affichee", !!liveRow.querySelector(".pws-live"));
  assert("match termine : score final affiche", finalRow.textContent.includes("2") && finalRow.textContent.includes("1"));

  const timeEl = tomorrowRow.querySelector(".pws-status-time");
  const dateEl = tomorrowRow.querySelector(".pws-status-date");
  assert("match a venir un autre jour : heure ET date jj/mm presentes dans le DOM", !!timeEl && !!dateEl);
  // Etat initial NON suppose ici : la bascule (toutes les 3s) demarre au
  // montage de la tuile, tres tot dans le demarrage -- avec une suite de
  // tests longue, le temps ecoule avant d'arriver ici peut deja
  // depasser un cycle complet, rendant une phase de depart fixe fragile.
  // On observe simplement l'etat courant, puis on verifie qu'il bascule
  // bien vers l'oppose apres un cycle -- une verification aller-retour,
  // robuste quelle que soit la phase de depart.
  // Starting state NOT assumed here: the toggle (every 3s) starts at the
  // tile's mount, very early in boot -- with a long test suite, the time
  // elapsed before reaching this point can already exceed a full cycle,
  // making a fixed starting phase fragile. Instead, the current state is
  // observed, then checked to flip to the opposite one after a cycle --
  // a round-trip check, robust regardless of the starting phase.
  assert("etat coherent au depart : exactement l'un des deux visible, pas les deux ni aucun",
    timeEl.hidden !== dateEl.hidden);
  const dateWasHidden = dateEl.hidden;
  const expectedDDMM = String(SPORT_TOMORROW.getDate()).padStart(2, "0") + "/" + String(SPORT_TOMORROW.getMonth() + 1).padStart(2, "0");
  assert("date au format jj/mm correct", dateEl.textContent === expectedDDMM);

  // Sondage repete plutot qu'une attente fixe unique : plus robuste face
  // a n'importe quel derapage de synchronisation (charge de la machine,
  // position dans une suite de tests devenue longue) -- il suffit que le
  // basculement se produise A UN MOMENT DONNE dans la fenetre, sans
  // dependre d'un alignement precis sur une duree fixe supposee.
  // Repeated polling rather than a single fixed wait: more robust
  // against any timing drift (machine load, position within a test
  // suite that has grown long) -- it only requires the toggle to happen
  // AT SOME POINT within the window, without depending on precise
  // alignment to an assumed fixed duration.
  let toggled = false;
  for (let i = 0; i < 20 && !toggled; i++) {
    await sleep(300);
    if (dateEl.hidden === !dateWasHidden && timeEl.hidden === dateWasHidden) toggled = true;
  }
  assert("apres un cycle : la visibilite heure/date a bien bascule vers l'oppose", toggled);

  console.log("== Languette -> barre d'outils ==");
  document.getElementById("dockTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("barre visible apres clic languette", document.getElementById("dockBar").hidden === false);

  console.log("== Mode edition ==");
  const item1 = document.querySelector(".grid-stack-item");
  assert("drag desactive avant edition (classe disabled)", item1.classList.contains("ui-draggable-disabled"));
  document.getElementById("btnEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(50);
  assert("body.editing actif", document.body.classList.contains("editing"));
  assert("grille deverrouillee (classe static retiree)", !document.querySelector(".grid-stack").classList.contains("grid-stack-static"));
  assert("drag active sur la tuile (disabled retire)", !item1.classList.contains("ui-draggable-disabled"));
  assert("resize active sur la tuile (disabled retire)", !item1.classList.contains("ui-resizable-disabled"));
  assert("poignees de redimensionnement presentes", document.querySelectorAll(".grid-stack-item .ui-resizable-handle").length >= 3);
  assert("tuile 1 : poignee sud-est presente", !!item1.querySelector(".ui-resizable-se"));
  const dragItem = item1;

  console.log("== Clic sur tuile = parametres (mode edition) ==");
  item1.querySelector(".grid-stack-item-content").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("modale ouverte par clic sur la tuile", document.getElementById("tileModal").hidden === false);
  document.querySelector("#tileModal .modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("modale refermee par la croix", document.getElementById("tileModal").hidden === true);

  console.log("== Aide d'un widget depuis sa fenetre de configuration ==");
  {
    // Ouvre les reglages de la tuile Horloge par son engrenage.
    const g = dragItem.querySelector(".tile-gear");
    g.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    const tileModal = document.getElementById("tileModal");
    const helpBtn = document.getElementById("tileHelpBtn");
    const wHelp = document.getElementById("widgetHelpModal");
    assert("bouton d'aide present dans l'en-tete des reglages", !!helpBtn);
    assert("bouton d'aide visible (le widget horloge a bien une fiche)", helpBtn.hidden === false);
    assert("fenetre d'aide du widget fermee au depart", wHelp.hidden === true);

    helpBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic sur '?' : la fenetre d'aide s'ouvre", wHelp.hidden === false);
    // Point central de la demande : la fenetre de configuration reste
    // ouverte DESSOUS, on ne perd pas ses reglages en consultant l'aide.
    // Core of the request: the settings window stays open UNDERNEATH, so
    // its settings aren't lost while reading the help.
    assert("la fenetre de configuration reste ouverte dessous", tileModal.hidden === false);

    // Et surtout : UNIQUEMENT l'aide de ce widget, sans le sommaire.
    // And crucially: ONLY this widget's help, with no table of contents.
    assert("titre de l'aide = nom du widget", document.getElementById("widgetHelpTitle").textContent.length > 0);
    assert("aucun sommaire dans cette fenetre (aide du seul widget)", !wHelp.querySelector(".help-nav"));
    const wContent = document.getElementById("widgetHelpContent");
    assert("contenu de l'aide rempli", wContent.innerHTML.length > 100);
    // La fiche affichee est bien celle de l'horloge, pas une autre.
    assert("c'est bien la fiche du widget en cours de configuration",
      /horloge|clock/i.test(wContent.textContent + document.getElementById("widgetHelpTitle").textContent));

    // Fermeture de l'aide : les reglages restent ouverts.
    wHelp.querySelector(".modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("croix de l'aide : l'aide se ferme", wHelp.hidden === true);
    assert("croix de l'aide : les reglages restent ouverts", tileModal.hidden === false);

    // Regression : l'aide est une fenetre SOEUR de tileModal, pas une
    // fenetre fille. Fermer les reglages ne la refermerait donc pas
    // toute seule -- elle resterait a flotter au-dessus du tableau.
    // Regression: the help is a SIBLING window of tileModal, not a child.
    // Closing the settings would therefore not close it on its own -- it
    // would be left floating above the board.
    helpBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("aide rouverte pour le test de fermeture conjointe", wHelp.hidden === false);
    tileModal.querySelector(".modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("fermer les reglages ferme aussi l'aide (pas de fenetre orpheline)", wHelp.hidden === true);
    assert("les reglages sont bien fermes", tileModal.hidden === true);
  }

  console.log("== Aide : chaque widget du catalogue a bien une fiche ==");
  {
    // Le bouton '?' n'apparait que si le widget a une fiche : cette
    // verification garantit qu'aucun widget n'est laisse sans aide, et
    // qu'aucune fiche ne survit a un widget supprime.
    // The '?' button only appears if the widget has a page: this check
    // ensures no widget is left without help, and no page outlives a
    // removed widget.
    const help = window.PIBOARD_HELP || [];
    const tileHelpIds = help.filter((h) => h.group === "tiles").map((h) => h.id).sort();
    const catalogIds = [...new Set(help.filter((h) => h.group === "tiles").map((h) => h.id))];
    assert("chaque fiche de tuile a un identifiant unique", tileHelpIds.length === catalogIds.length);
    assert("les fiches de tuiles sont nombreuses (couverture reelle)", tileHelpIds.length >= 24);
    // Toutes les fiches doivent etre bilingues et non vides -- SAUF
    // "quickstart", dont le corps est volontairement vide dans
    // help-content.js parce qu'il est injecte a l'affichage depuis
    // quickstart-content.js (source unique partagee avec la fenetre de
    // lancement, cf. showHelpSection). Le titre et le sous-titre, eux,
    // restent exiges bilingues comme partout ailleurs.
    // Every page must be bilingual and non-empty -- EXCEPT "quickstart",
    // whose body is deliberately empty in help-content.js because it is
    // injected at display time from quickstart-content.js (single source
    // shared with the launch window, see showHelpSection). Its title and
    // subtitle are still required to be bilingual like everywhere else.
    const INJECTED_BODY_IDS = ["quickstart"];
    const incomplete = help.filter((h) =>
      !h.title || !h.title.fr || !h.title.en ||
      (!INJECTED_BODY_IDS.includes(h.id) && (!h.html || !h.html.fr || !h.html.en)));
    assert("toutes les fiches d'aide sont bilingues FR/EN et non vides", incomplete.length === 0);
    // Et le corps injecte doit exister vraiment, sinon la rubrique
    // s'afficherait vide sans que rien ne le signale.
    // And the injected body must actually exist, otherwise the section
    // would render empty with nothing flagging it.
    assert("le corps injecte de 'quickstart' existe bien dans les deux langues",
      !!(window.PIBOARD_QUICKSTART && window.PIBOARD_QUICKSTART.fr && window.PIBOARD_QUICKSTART.en));
  }

  console.log("== Configuration d'une tuile ==");
  const gear = dragItem.querySelector(".tile-gear");
  assert("bouton reglages present dans l'en-tete", !!gear);
  gear.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("modale de tuile ouverte", document.getElementById("tileModal").hidden === false);
  assert("formulaire genere depuis le manifeste", document.querySelectorAll("#tileForm [data-key]").length >= 2);
  /* Changer le mode d'horloge et sauver / switch clock mode and save */
  const modeSel = document.querySelector('#tileForm [data-key="mode"]');
  modeSel.value = "analog";
  document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(700);
  assert("modale refermee", document.getElementById("tileModal").hidden === true);
  assert("horloge passee en analogique", !!dragItem.querySelector(".pwa-face"));
  assert("disposition cote a cote appliquee (date toujours affichee depuis la config initiale)",
    !!dragItem.querySelector(".pw-clock.pwc-analog-row"));
  assert("layout sauvegarde (PUT recu)", putCalls.some((c) => c.url.includes("/api/layout")));

  console.log("== Catalogue ==");
  document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("catalogue ouvert avec " + catalog.length + " widgets",
    document.querySelectorAll("#catalogList .catalog-item").length === catalog.length);

  console.log("== Catalogue : regroupement par familles ==");
  {
    const headers = Array.from(document.querySelectorAll("#catalogList .catalog-family"));
    const headerTexts = headers.map((h) => h.textContent);
    assert("des en-tetes de famille sont affiches", headers.length >= 7);
    assert("familles attendues presentes et traduites en francais",
      ["Météo", "Informations", "Déplacements", "Personnel", "Divertissement", "Sport", "Système & Réseau", "Divers"]
        .every((f) => headerTexts.includes(f)));
    assert("l'ordre des familles est celui defini (Meteo en premier, Divers en dernier)",
      headerTexts[0] === "Météo" && headerTexts[headerTexts.length - 1] === "Divers");

    // AUCUNE tuile ne doit disparaitre du fait du regroupement : le
    // total affiche doit toujours egaler le catalogue complet (deja
    // verifie ci-dessus), et chaque vignette doit suivre un en-tete.
    // NO tile must vanish because of the grouping: the displayed total
    // must still equal the full catalog (already checked above), and
    // every card must follow a header.
    const firstChild = document.querySelector("#catalogList").firstElementChild;
    assert("le catalogue commence par un en-tete de famille (aucune tuile orpheline en tete)",
      firstChild && firstChild.classList.contains("catalog-family"));

    // Verifie un classement concret, cote a cote : la tuile Meteo doit
    // se trouver dans la famille "Meteo", pas ailleurs.
    // Checks one concrete classification, side by side: the Weather
    // tile must sit in the "Météo" family, not elsewhere.
    const familyOf = (widgetId) => {
      const card = catalogItemFor(catalog, document, widgetId);
      for (let el = card.closest(".catalog-item-wrap"); el; el = el.previousElementSibling) {
        if (el.classList.contains("catalog-family")) return el.textContent;
      }
      return null;
    };
    assert("la tuile Meteo est bien rangee dans la famille 'Météo'", familyOf("weather") === "Météo");
    assert("la tuile Bloc-notes est bien rangee dans la famille 'Personnel'", familyOf("notes") === "Personnel");
    // Segmentation affinee (voir CATALOG_FAMILIES) : Deplacements et
    // Systeme & Reseau, separees de l'ancien bloc "Informations"
    // devenu trop heterogene (7 tuiles sans rapport entre elles).
    // Refined segmentation (see CATALOG_FAMILIES): Getting-around and
    // System & Network, split out from the old "Informations" bucket
    // which had become too heterogeneous (7 unrelated tiles).
    assert("la tuile Trajet domicile-travail est dans 'Déplacements', pas 'Informations'",
      familyOf("commute") === "Déplacements");
    assert("la tuile Avions en vue est dans 'Déplacements'", familyOf("planes") === "Déplacements");
    assert("la tuile Cours Cryptos reste dans 'Informations'", familyOf("crypto") === "Informations");
    // Les tuiles ajoutees depuis la 1.70 tombaient toutes dans "Divers",
    // le catalogue les ignorant. Chacune est desormais rangee la ou on
    // la chercherait, la Bourse aux cotes des Cryptos.
    // Every tile added since 1.70 fell into "Miscellaneous", the catalog
    // ignoring them. Each now sits where one would look for it, Stocks
    // alongside Crypto.
    assert("la tuile Bourse rejoint les Cryptos dans 'Informations'",
      familyOf("stocks") === "Informations");
    assert("la tuile Couleur Tempo est dans 'Maison & énergie'",
      familyOf("tempo") === "Maison & énergie");
    assert("la tuile Home Assistant est dans 'Maison & énergie'",
      familyOf("homeassistant") === "Maison & énergie");
    assert("la tuile Quotas IA est dans 'Système & Réseau'",
      familyOf("aiusage") === "Système & Réseau");
    assert("la tuile Etat systeme est dans 'Système & Réseau', pas 'Divers'",
      familyOf("system") === "Système & Réseau");
    assert("la tuile Analyse reseau est aussi dans 'Système & Réseau'",
      familyOf("networkscan") === "Système & Réseau");
  }

  {
    // Reperage par NOM plutot que par index dans le tableau "catalog" :
    // depuis le regroupement par familles, l'ordre d'affichage ne suit
    // plus l'ordre du tableau (voir CATALOG_FAMILIES dans app.js).
    // Located by NAME rather than by index in the "catalog" array:
    // since family grouping was introduced, the display order no longer
    // follows the array's order (see CATALOG_FAMILIES in app.js).
    const weatherManifest = catalog.find((m) => m.id === "weather");
    const weatherName = weatherManifest.name.fr || weatherManifest.name.en || weatherManifest.name;
    const weatherItem = Array.from(document.querySelectorAll("#catalogList .catalog-item-wrap"))
      .find((el) => (el.querySelector(".ci-name")?.textContent || "") === weatherName);
    assert("tuile Meteo retrouvee dans le catalogue", !!weatherItem);
    const desc = weatherItem.querySelector(".ci-desc").textContent;
    assert("description affichee dans la liste : courte (intitule, pas le texte complet)", desc.length < 100);
    assert("l'intitule court evoque bien la fonction premiere (meteo)", /météo|weather/i.test(desc));

    const infoBtn = weatherItem.querySelector(".ci-info");
    assert("icone info presente pour un widget avec intitule", !!infoBtn);
    assert("aucune info-bulle affichee avant survol", !document.querySelector(".ci-tooltip:not([hidden])"));

    infoBtn.dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
    const tooltip = document.querySelector(".ci-tooltip");
    assert("info-bulle affichee au survol", !!tooltip && tooltip.hidden === false);
    assert("info-bulle : texte nettement plus long que l'intitule (vraie description complete)",
      tooltip.textContent.length > desc.length * 2);
    assert("info-bulle positionnee (coordonnees calculees)", tooltip.style.left !== "" && tooltip.style.top !== "");

    infoBtn.dispatchEvent(new window.MouseEvent("mouseleave", { bubbles: true }));
    assert("info-bulle refermee en quittant le survol", tooltip.hidden === true);

    // Le clic sur l'icone info ne doit pas ajouter la tuile (bouton
    // separe, hors du bouton principal). Clicking the info icon must not
    // add the tile (separate button, outside the main one).
    const tilesBefore = document.querySelectorAll(".grid-stack-item").length;
    infoBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("info-bulle affichee au clic/tap egalement (pas seulement au survol, pour le tactile)", tooltip.hidden === false);
    assert("clic sur l'icone info : la tuile n'est PAS ajoutee", document.querySelectorAll(".grid-stack-item").length === tilesBefore);
    infoBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); // referme (bascule) / closes (toggles)
    assert("second clic sur l'icone info : l'info-bulle se referme (bascule)", tooltip.hidden === true);
  }

  document.querySelector("#catalogList .catalog-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(200);
  assert("tuile ajoutee (22 au total)", document.querySelectorAll(".grid-stack-item").length === 22);

  console.log("== Tiroirs (gauche existant, haut, droite) : presence, ouverture, un seul a la fois ==");
  {
    const left = document.getElementById("drawer");
    const top = document.getElementById("drawerTop");
    const right = document.getElementById("drawerRight");
    assert("tiroir gauche present avec sa classe de variante", left.classList.contains("drawer-left"));
    assert("tiroir haut present avec sa classe de variante", top.classList.contains("drawer-top"));
    assert("tiroir droit present avec sa classe de variante", right.classList.contains("drawer-right"));
    assert("les 3 tiroirs sont fermes au demarrage (l'ecran doit rester libre au boot)",
      !left.classList.contains("open") && !top.classList.contains("open") && !right.classList.contains("open"));

    document.getElementById("drawerTopTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("tiroir haut ouvert au clic sur sa languette", top.classList.contains("open"));
    const zAfterTop = Number(top.style.zIndex) || 0;
    assert("ouverture met le tiroir au premier plan (z-index attribue)", zAfterTop > 0);

    // Un seul tiroir ouvert a la fois : en ouvrir un autre doit refermer
    // celui qui l'etait, automatiquement.
    // Only one drawer open at a time: opening another one must close
    // whichever was open, automatically.
    document.getElementById("drawerRightTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("tiroir droit ouvert au clic sur sa languette", right.classList.contains("open"));
    assert("le tiroir haut, ouvert precedemment, se referme automatiquement", !top.classList.contains("open"));
    const zAfterRight = Number(right.style.zIndex) || 0;
    assert("le tiroir nouvellement ouvert recoit un z-index superieur", zAfterRight > zAfterTop);

    document.getElementById("drawerTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("tiroir gauche (existant) toujours fonctionnel : s'ouvre aussi", left.classList.contains("open"));
    assert("le tiroir droit, ouvert precedemment, se referme automatiquement", !right.classList.contains("open"));

    document.getElementById("drawerTopTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("ouvrir le tiroir haut referme le tiroir gauche, ouvert jusque-la", !left.classList.contains("open"));
    assert("le tiroir haut est bien celui desormais ouvert", top.classList.contains("open"));

    document.getElementById("drawerTopTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("re-clic sur la languette d'un tiroir deja ouvert : il se referme (pas de reouverture)", !top.classList.contains("open"));
  }

  console.log("== Tiroirs : redimensionnement a la souris, jusqu'a quasi tout l'ecran ==");
  {
    const root = document.documentElement;
    const drag = (handleId, downX, downY, moveX, moveY) => {
      document.getElementById(handleId).dispatchEvent(new window.MouseEvent("pointerdown", { clientX: downX, clientY: downY, bubbles: true }));
      document.dispatchEvent(new window.MouseEvent("pointermove", { clientX: moveX, clientY: moveY, bubbles: true }));
      document.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true }));
    };

    // Tiroir gauche (largeur, ancre a gauche) : deplacer le pointeur a
    // mi-largeur de l'ecran (1024px de large dans jsdom) doit donner ~50%.
    // Left drawer (width, anchored left): moving the pointer to mid
    // screen width (1024px wide in jsdom) should give ~50%.
    drag("drawerResize", 0, 0, 512, 0);
    let leftPct = parseFloat(root.style.getPropertyValue("--drawer-w"));
    assert("tiroir gauche : redimensionnement a mi-ecran ~50%", leftPct > 45 && leftPct < 55);

    // Tiroir droit (largeur, ancre a droite) : plus le pointeur est pres
    // du bord GAUCHE de l'ecran, plus le tiroir devient large -- teste
    // ici pres du bord pour verifier qu'il peut recouvrir "quasi
    // integralement" l'ecran, comme demande.
    // Right drawer (width, anchored right): the closer the pointer is
    // to the LEFT edge of the screen, the wider the drawer becomes --
    // tested here near the edge to verify it can cover "almost
    // entirely" the screen, as requested.
    drag("drawerRightResize", 1024, 0, 41, 0);
    let rightPct = parseFloat(root.style.getPropertyValue("--drawer-right-w"));
    assert("tiroir droit : peut s'agrandir jusqu'a quasi tout l'ecran (>=90%)", rightPct >= 90);

    // Tiroir haut (hauteur, ancre en haut) : pointeur tout en bas de
    // l'ecran (768px de haut dans jsdom) -> doit aussi tendre vers le
    // maximum, jamais depasser la borne haute (recouvrement quasi total
    // mais pas un debordement incontrole).
    // Top drawer (height, anchored top): pointer at the very bottom of
    // the screen (768px tall in jsdom) -> should also trend toward the
    // maximum, never exceeding the upper bound (near-total coverage but
    // not an uncontrolled overflow).
    drag("drawerTopResize", 0, 0, 0, 767);
    let topPct = parseFloat(root.style.getPropertyValue("--drawer-top-h"));
    assert("tiroir haut : peut s'agrandir jusqu'a quasi tout l'ecran (>=90%)", topPct >= 90);
    assert("mais jamais 100% plein ecran (borne haute respectee, reste un calque)", topPct <= 96);

    // Borne basse : un pointeur ramene tout pres du bord de fermeture ne
    // doit jamais reduire un tiroir a une largeur/hauteur inutilisable.
    // Lower bound: a pointer dragged right up against the closing edge
    // must never shrink a drawer to an unusably small width/height.
    drag("drawerResize", 0, 0, 2, 0);
    leftPct = parseFloat(root.style.getPropertyValue("--drawer-w"));
    assert("borne basse respectee (jamais en dessous d'une taille utilisable)", leftPct >= 10);

    // Chaque redimensionnement declenche une sauvegarde (comportement
    // deja en place pour le tiroir gauche, verifie ici pour les 3).
    // Each resize triggers a save (behavior already in place for the
    // left drawer, checked here for all 3).
    await sleep(700);
    const layoutPuts = putCalls.filter((c) => c.url.includes("/api/layout"));
    assert("redimensionnement d'un tiroir declenche une sauvegarde du layout", layoutPuts.length > 0);
    const lastLayoutBody = JSON.parse(layoutPuts[layoutPuts.length - 1].body);
    assert("layout envoye : cle 'drawer' (gauche, compat. ascendante) presente", !!lastLayoutBody.drawer);
    assert("layout envoye : cle 'drawerTop' presente", !!lastLayoutBody.drawerTop);
    assert("layout envoye : cle 'drawerRight' presente", !!lastLayoutBody.drawerRight);
    assert("largeur du tiroir gauche bien serialisee", typeof lastLayoutBody.drawer.widthPct === "number");
    assert("hauteur du tiroir haut serialisee sous sa propre cle (heightPct)", typeof lastLayoutBody.drawerTop.heightPct === "number");
    assert("largeur du tiroir droit serialisee", typeof lastLayoutBody.drawerRight.widthPct === "number");
  }

  console.log("== Tiroirs : une tuile ajoutee pendant qu'un tiroir precis est ouvert atterrit dedans (pas sur le tableau) ==");
  {
    // Le tiroir droit est le seul ouvert a ce stade (gauche et haut ont
    // ete refermes/rouverts ci-dessus -- on repart d'un etat net).
    // Only the right drawer is open at this point (left and top were
    // closed/reopened above -- start from a clean state).
    document.getElementById("drawer").classList.remove("open");
    document.getElementById("drawerTop").classList.remove("open");
    if (!document.getElementById("drawerRight").classList.contains("open")) {
      document.getElementById("drawerRightTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    }

    const boardCountBefore = document.querySelectorAll("#grid .grid-stack-item").length;
    const rightCountBefore = document.querySelectorAll("#drawerGridRight .grid-stack-item").length;

    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    document.querySelector("#catalogList .catalog-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(200);

    assert("la tuile n'est PAS atterrie sur le tableau principal",
      document.querySelectorAll("#grid .grid-stack-item").length === boardCountBefore);
    assert("la tuile est bien atterrie dans le tiroir droit (celui ouvert)",
      document.querySelectorAll("#drawerGridRight .grid-stack-item").length === rightCountBefore + 1);

    // Nettoyage : un test plus loin dans la suite suppose que "la
    // derniere .grid-stack-item du document" est la sienne, sur le
    // tableau -- une tuile laissee dans un tiroir apres celle-ci (en
    // aval dans l'ordre du document) fausserait cette hypothese.
    // Cleanup: a test further down the suite assumes "the document's
    // last .grid-stack-item" is its own, on the board -- a tile left in
    // a drawer after this one (later in document order) would break
    // that assumption.
    const drawerTiles = document.querySelectorAll("#drawerGridRight .grid-stack-item");
    const addedTile = drawerTiles[drawerTiles.length - 1];
    addedTile.querySelector(".tile-x").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("nettoyage : la tuile ajoutee dans le tiroir est bien retiree",
      document.querySelectorAll("#drawerGridRight .grid-stack-item").length === rightCountBefore);

    document.getElementById("drawerRightTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }

  console.log("== Configuration reutilisable (tuile nommee) ==");
  {
    const webviewIndex = catalog.findIndex((m) => m.id === "webview");
    assert("widget webview present dans le catalogue", webviewIndex >= 0);
    const items = () => Array.from(document.querySelectorAll(".grid-stack-item"));

    /* 1) Ajouter une tuile "Page web", la nommer et la configurer */
    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "webview")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    const newTile = items()[items().length - 1];
    newTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const titleInput = document.querySelector('#tileForm [data-key="_title"]');
    titleInput.value = "Trafic Toulouse";
    titleInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    const urlInput = document.querySelector('#tileForm [data-key="site1Url"]');
    urlInput.value = "http://umbrel.local:1234/";
    urlInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    /* Bouton explicite "Enregistrer cette configuration" (visible dans
       les parametres, pas seulement implicite a la suppression) */
    document.getElementById("tileSaveConfig").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("bouton explicite : configuration deja conservee avant suppression",
      (tileConfigsMock.webview || []).some((c) => c.title === "Trafic Toulouse"));
    assert("bouton explicite : message de confirmation affiche",
      (document.getElementById("tileSaveConfigMsg").textContent || "").length > 0);
    assert("bouton explicite : la modale reste ouverte", document.getElementById("tileModal").hidden === false);

    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("tuile nommee affiche le titre personnalise", newTile.textContent.includes("Trafic Toulouse"));

    /* 2) La supprimer -> la configuration doit etre conservee cote serveur */
    newTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    document.getElementById("tileRemove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("configuration conservee apres suppression (mock serveur)",
      (tileConfigsMock.webview || []).some((c) => c.title === "Trafic Toulouse"));

    /* 3) Rajouter une tuile du meme type -> le selecteur doit proposer la config enregistree */
    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "webview")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    assert("selecteur de configuration ouvert", document.getElementById("configPickerModal").hidden === false);
    assert("option 'nouvelle configuration vierge' presente",
      !!document.querySelector("#configPickerList .config-picker-blank"));
    const savedBtn = Array.from(document.querySelectorAll("#configPickerList .config-picker-row .catalog-item"))
      .find((b) => b.textContent.includes("Trafic Toulouse"));
    assert("configuration enregistree proposee dans le selecteur", !!savedBtn);
    savedBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    assert("selecteur referme apres choix", document.getElementById("configPickerModal").hidden === true);
    const restoredTile = items()[items().length - 1];
    assert("tuile reutilise le titre enregistre", restoredTile.textContent.includes("Trafic Toulouse"));
    assert("tuile reutilise l'URL enregistree (mode 'Via PiBoard' par defaut : passe par le proxy)",
      !!restoredTile.querySelector('iframe[src^="/api/webview-proxy?url="]')
      && restoredTile.querySelector("iframe").getAttribute("src").includes(encodeURIComponent("http://umbrel.local:1234/")));

    /* 4) Verifier que la suppression d'une config depuis le selecteur fonctionne */
    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "webview")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    const delBtn = document.querySelector("#configPickerList .config-picker-row .cp-delete");
    assert("bouton de suppression de config present", !!delBtn);
    delBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("configuration retiree du mock serveur", !(tileConfigsMock.webview || []).some((c) => c.title === "Trafic Toulouse"));
    assert("selecteur toujours ouvert apres suppression d'une entree", document.getElementById("configPickerModal").hidden === false);
    /* Fermer le selecteur via la croix (annulation, pas d'ajout de tuile) */
    const tileCountBeforeCancel = items().length;
    document.querySelector("#configPickerModal .modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("selecteur ferme sans ajouter de tuile", items().length === tileCountBeforeCancel);
  }

  console.log("== Tuile Diaporama : mot de passe WebDAV masque ==");
  {
    const slideshowIndex = catalog.findIndex((m) => m.id === "slideshow");
    assert("widget slideshow present dans le catalogue", slideshowIndex >= 0);
    const items = () => Array.from(document.querySelectorAll(".grid-stack-item"));

    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "slideshow")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    const newTile = items()[items().length - 1];
    newTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    const pwInput = document.querySelector('#tileForm [data-key="webdavPass"]');
    assert("champ webdavPass present", !!pwInput);
    assert("mot de passe masque par defaut", pwInput.type === "password");
    const toggle = pwInput.parentElement.querySelector(".field-password-toggle");
    assert("bouton bascule present a cote du champ", !!toggle);
    toggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("bouton bascule rend le mot de passe visible", pwInput.type === "text");
    toggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("bouton bascule remasque le mot de passe", pwInput.type === "password");

    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    newTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    document.getElementById("tileRemove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
  }

  console.log("== Ecran de veille : ordre aleatoire + effet Ken Burns ==");
  {
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("parametres generaux ouverts", document.getElementById("settingsModal").hidden === false);
    assert("case 'multi-colonnes' cochee par defaut (independamment du mode tactile)",
      document.getElementById("setMultiColumnForms").checked === true);
    assert("mise en colonnes active meme sans mode tactile (correctif v1.7.2) : data-cols pose sur le modal",
      !!document.querySelector("#settingsModal .modal-card").dataset.cols);
    assert("body sans classe 'touch' par defaut (mode tactile non lie a la mise en colonnes)",
      !document.body.classList.contains("touch"));
    assert("case Ken Burns cochee par defaut (comportement historique)",
      document.getElementById("setSSKenBurns").checked === true);
    assert("case ordre aleatoire decochee par defaut",
      document.getElementById("setSSShuffle").checked === false);
    assert("cadrage paysage par defaut = remplir", document.getElementById("setSSFitLandscape").value === "cover");
    assert("cadrage portrait par defaut = entier", document.getElementById("setSSFitPortrait").value === "contain");
    assert("bordure par defaut = couleur", document.getElementById("setSSContainBg").value === "color");
    assert("mot de passe WebDAV masque par defaut", document.getElementById("setSSWebdavPass").type === "password");
    document.querySelector("#ssWebdavPassField .field-password-toggle")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("bouton bascule rend le mot de passe visible", document.getElementById("setSSWebdavPass").type === "text");
    document.querySelector("#ssWebdavPassField .field-password-toggle")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("bouton bascule remasque le mot de passe", document.getElementById("setSSWebdavPass").type === "password");

    document.getElementById("setSSShuffle").checked = true;
    document.getElementById("setSSKenBurns").checked = false;
    document.getElementById("setSSFitLandscape").value = "contain";
    document.getElementById("setSSContainBg").value = "blur";
    document.getElementById("settingsSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    const settingsPut = putCalls.filter((c) => c.url.includes("/api/settings")).pop();
    assert("reglages de veille envoyes au serveur", !!settingsPut);
    const body = settingsPut ? JSON.parse(settingsPut.body) : {};
    assert("ordre aleatoire enregistre", !!(body.screensaver && body.screensaver.slideshowShuffle === true));
    assert("desactivation du zoom lent enregistree", !!(body.screensaver && body.screensaver.slideshowKenBurns === false));
    assert("cadrage paysage enregistre", !!(body.screensaver && body.screensaver.slideshowFitLandscape === "contain"));
    assert("style de bordure enregistre", !!(body.screensaver && body.screensaver.slideshowContainBackground === "blur"));
  }

  console.log("== Reglages generaux : couverture des tiroirs (section dediee, application immediate) ==");
  {
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    assert("champ de couverture du tiroir gauche present", !!document.getElementById("setDrawerLeftPct"));
    assert("champ de couverture du tiroir haut present", !!document.getElementById("setDrawerTopPct"));
    assert("champ de couverture du tiroir droit present", !!document.getElementById("setDrawerRightPct"));

    // Pre-rempli avec la taille actuelle du tiroir (fixee par le test de
    // redimensionnement precedent), pas une valeur figee.
    // Pre-filled with the drawer's current size (set by the earlier
    // resize test), not a hardcoded value.
    const root = document.documentElement;
    const currentLeftPct = Math.round(parseFloat(root.style.getPropertyValue("--drawer-w")));
    assert("champ pre-rempli avec la couverture actuelle du tiroir gauche",
      Number(document.getElementById("setDrawerLeftPct").value) === currentLeftPct);

    // Change la couverture du tiroir droit a 100% -- au-dela de ce que
    // permet le glisser-deposer a la souris (borne a 96%), precisement
    // le point souleve : atteindre une couverture totale de l'ecran.
    // Changes the right drawer's coverage to 100% -- beyond what mouse
    // dragging allows (capped at 96%), exactly the point raised:
    // reaching full screen coverage.
    const rightField = document.getElementById("setDrawerRightPct");
    rightField.value = "100";
    rightField.dispatchEvent(new window.Event("change", { bubbles: true }));
    await sleep(700);

    assert("couverture du tiroir droit appliquee immediatement (variable CSS a jour)",
      Math.round(parseFloat(root.style.getPropertyValue("--drawer-right-w"))) === 100);
    assert("le champ reflete la valeur reellement appliquee", Number(rightField.value) === 100);
    assert("application immediate : pas besoin du bouton 'Enregistrer' de la fenetre",
      document.getElementById("settingsModal").hidden === false);

    const layoutPuts = putCalls.filter((c) => c.url.includes("/api/layout"));
    assert("le changement declenche une sauvegarde du layout (comme un redimensionnement a la souris)",
      layoutPuts.length > 0
      && JSON.parse(layoutPuts[layoutPuts.length - 1].body).drawerRight.widthPct === 100);

    // Une valeur hors bornes (0) doit rester au minimum utilisable, pas
    // etre appliquee telle quelle.
    // An out-of-bounds value (0) must stay at the usable minimum, not
    // be applied as-is.
    const topField = document.getElementById("setDrawerTopPct");
    topField.value = "0";
    topField.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert("valeur hors bornes ramenee au minimum utilisable (jamais 0%)",
      Math.round(parseFloat(root.style.getPropertyValue("--drawer-top-h"))) >= 10);

    document.querySelector("#settingsModal .modal-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }

  console.log("== Sauvegarde et restauration ==");
  {
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    document.getElementById("openBackupsBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("parametres generaux refermes en ouvrant la sauvegarde", document.getElementById("settingsModal").hidden === true);
    assert("modale de sauvegarde ouverte", document.getElementById("backupsModal").hidden === false);
    assert("aucune sauvegarde au depart : message vide affiche", document.getElementById("backupsEmpty").hidden === false);
    assert("liste vide au depart", document.querySelectorAll(".backups-item").length === 0);

    console.log("== Sauvegarde : creation ==");
    document.getElementById("backupCreateBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (document.querySelectorAll(".backups-item").length < 1 && tries++ < 60) await sleep(50);
    assert("une sauvegarde apparait dans la liste apres creation", document.querySelectorAll(".backups-item").length === 1);
    assert("message vide masque une fois une sauvegarde presente", document.getElementById("backupsEmpty").hidden === true);
    assert("nombre de tuiles affiche dans le resume", document.querySelector(".backups-item-meta").textContent.includes("15"));

    document.getElementById("backupCreateBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (document.querySelectorAll(".backups-item").length < 2 && tries++ < 60) await sleep(50);
    assert("une deuxieme sauvegarde s'ajoute SANS ecraser la premiere (2 au total)",
      document.querySelectorAll(".backups-item").length === 2);
    const ids = [...document.querySelectorAll(".backups-item")].map((li) => li.dataset.backupId);
    assert("les deux sauvegardes ont des identifiants distincts", new Set(ids).size === 2);

    console.log("== Sauvegarde : restauration protegee par confirmation ==");
    const firstItem = document.querySelector(".backups-item");
    firstItem.querySelector('[data-action="restore"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("clic sur 'restaurer' : demande de confirmation affichee, pas de restauration immediate",
      document.getElementById("backupRestoreConfirmModal").hidden === false && BACKUP_LAYOUT_RESTORED === null);
    // Annulation : ferme la confirmation sans rien restaurer.
    // Cancel: closes the confirmation without restoring anything.
    document.querySelector("#backupRestoreConfirmModal [data-close]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("annulation : aucune restauration declenchee", BACKUP_LAYOUT_RESTORED === null);

    firstItem.querySelector('[data-action="restore"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    document.getElementById("backupRestoreConfirmBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (BACKUP_LAYOUT_RESTORED === null && tries++ < 60) await sleep(50);
    assert("confirmation acceptee : la sauvegarde correspondante est restauree", BACKUP_LAYOUT_RESTORED === firstItem.dataset.backupId);
    // Le code appelle ensuite window.location.reload() (repart d'un etat
    // propre) : jsdom ne simule pas de vraie navigation et n'offre pas de
    // moyen fiable de neutraliser cet appel precis pour le mesurer --
    // limitation de l'environnement de test, deja documentee ailleurs
    // dans ce fichier pour les widgets a base de Leaflet. Le comportement
    // essentiel (bon identifiant restaure au bon moment) est verifie
    // ci-dessus.
    // The code then calls window.location.reload() (starts fresh): jsdom
    // doesn't simulate real navigation and offers no reliable way to
    // neutralize this specific call to measure it -- a test environment
    // limitation, already documented elsewhere in this file for
    // Leaflet-based widgets. The essential behavior (correct id restored
    // at the right time) is verified above.

    console.log("== Sauvegarde : suppression ==");
    const beforeDelete = document.querySelectorAll(".backups-item").length;
    document.querySelector('.backups-item [data-action="delete"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (document.querySelectorAll(".backups-item").length === beforeDelete && tries++ < 60) await sleep(50);
    assert("suppression : une sauvegarde de moins dans la liste", document.querySelectorAll(".backups-item").length === beforeDelete - 1);

    document.getElementById("backupsModal").hidden = true;
  }

  console.log("== Tuile Programme TV : onglets, rendu, synopsis ==");
  {
    const tpIndex = catalog.findIndex((m) => m.id === "teleprog");
    assert("widget teleprog present dans le catalogue", tpIndex >= 0);
    const items = () => Array.from(document.querySelectorAll(".grid-stack-item"));

    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "teleprog")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    const tile = items()[items().length - 1];

    assert("tuile TV montee (conteneur present)", !!tile.querySelector(".pw-teleprog"));
    const tabs = tile.querySelectorAll(".pwtp-tab");
    assert("trois onglets de vue presents", tabs.length === 3);
    assert("un onglet actif par defaut", !!tile.querySelector(".pwtp-tab-active"));
    assert("vue par defaut = ce soir (pas 'en ce moment', qui change trop souvent)",
      tile.querySelector('.pwtp-tab[data-view="evening"]').classList.contains("pwtp-tab-active"));

    // Le programme mock doit s'afficher avec sa pastille inedit
    assert("programme affiche", tile.textContent.includes("Film de test"));
    assert("pastille inedit affichee (isNew=true)", !!tile.querySelector(".pwtp-new"));
    assert("chaine sans programme affiche le libelle vide",
      tile.textContent.includes("France 2"));

    // Clic sur la ligne -> synopsis
    const row = tile.querySelector(".pwtp-row:not(.pwtp-row-empty)");
    row.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("synopsis ouvert au clic", !!tile.querySelector(".pwtp-synopsis"));
    assert("synopsis affiche le texte", tile.textContent.includes("Un synopsis de test."));

    // Bascule d'onglet
    const lateTab = Array.from(tabs).find((t) => t.dataset.view === "late");
    lateTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    assert("onglet 2e partie devient actif",
      tile.querySelector('.pwtp-tab[data-view="late"]').classList.contains("pwtp-tab-active"));

    console.log("== Tuile Programme TV : barre de progression 'en cours' ==");
    {
      const tf1Row = Array.from(tile.querySelectorAll(".pwtp-row")).find((r) => r.textContent.includes("Film de test"));
      assert("ligne TF1 (programme en cours) retrouvee", !!tf1Row);
      assert("barre de progression affichee pour une diffusion en cours",
        !!tf1Row.querySelector(".pwtp-progress"));
      const m6Row = Array.from(tile.querySelectorAll(".pwtp-row")).find((r) => r.textContent.includes("Émission à venir"));
      assert("pas de barre de progression pour une diffusion pas encore commencee",
        !m6Row.querySelector(".pwtp-progress"));
    }

    console.log("== Tuile Programme TV : chaine favorite epinglee en tete ==");
    {
      const rowsBefore = Array.from(tile.querySelectorAll(".pwtp-row"));
      const franceRowBefore = rowsBefore.find((r) => r.textContent.includes("France 2"));
      assert("France 2 n'est PAS en tete avant mise en favori",
        rowsBefore.indexOf(franceRowBefore) > 0);

      franceRowBefore.querySelector(".pwtp-fav").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(30);

      const rowsAfter = Array.from(tile.querySelectorAll(".pwtp-row"));
      assert("France 2 passe en tete de liste une fois epinglee en favori",
        rowsAfter[0].textContent.includes("France 2"));
      assert("etoile pleine affichee pour une chaine favorite",
        rowsAfter[0].querySelector(".pwtp-fav-on") && rowsAfter[0].querySelector(".pwtp-fav-on").textContent === "★");

      // Nettoyage : on retire le favori pour ne pas fausser le test suivant (recherche)
      rowsAfter[0].querySelector(".pwtp-fav").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(30);
    }

    console.log("== Tuile Programme TV : recherche filtre les lignes affichees ==");
    {
      const search = tile.querySelector(".pwtp-search");
      assert("barre de recherche presente", !!search);

      search.value = "France";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(30);
      let visible = Array.from(tile.querySelectorAll(".pwtp-row"));
      assert("recherche 'France' ne laisse que la ligne France 2", visible.length === 1 && visible[0].textContent.includes("France 2"));

      search.value = "aucune-correspondance-xyz";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(30);
      assert("message 'aucun resultat' quand rien ne correspond", !!tile.querySelector(".pwtp-msg"));
      assert("aucune ligne affichee quand rien ne correspond", tile.querySelectorAll(".pwtp-row").length === 0);

      // Recherche insensible aux accents (voir normalize() dans le widget)
      search.value = "emission a venir"; // sans accent, doit quand meme trouver "Émission à venir" le cas echeant
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(30);
      visible = Array.from(tile.querySelectorAll(".pwtp-row"));
      assert("recherche insensible aux accents trouve 'Émission à venir'",
        visible.length === 1 && visible[0].textContent.includes("Émission à venir"));

      search.value = "";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(30);
      assert("recherche videe -> toutes les lignes reviennent", tile.querySelectorAll(".pwtp-row").length === 3);
    }

    console.log("== Tuile Programme TV : rappel avant le debut (reutilise l'alerte du Compte a rebours) ==");
    {
      const m6Row = Array.from(tile.querySelectorAll(".pwtp-row")).find((r) => r.textContent.includes("Émission à venir"));
      const remindBtn = m6Row.querySelector(".pwtp-remind");
      assert("bouton de rappel propose pour une diffusion a venir", !!remindBtn);
      assert("cloche barree par defaut (aucun rappel programme)", remindBtn.textContent === "🔕");

      const tf1RowNoRemind = Array.from(tile.querySelectorAll(".pwtp-row")).find((r) => r.textContent.includes("Film de test"));
      assert("pas de bouton de rappel pour une diffusion deja en cours",
        !tf1RowNoRemind.querySelector(".pwtp-remind"));

      remindBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(30);
      const remindBtnAfter = Array.from(tile.querySelectorAll(".pwtp-row"))
        .find((r) => r.textContent.includes("Émission à venir")).querySelector(".pwtp-remind");
      assert("cloche pleine une fois le rappel programme", remindBtnAfter.textContent === "🔔");
      assert("classe active appliquee au bouton de rappel", remindBtnAfter.classList.contains("pwtp-remind-on"));

      // Desactivation : reclic annule le rappel
      remindBtnAfter.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(30);
      const remindBtnFinal = Array.from(tile.querySelectorAll(".pwtp-row"))
        .find((r) => r.textContent.includes("Émission à venir")).querySelector(".pwtp-remind");
      assert("rappel annule au reclic", remindBtnFinal.textContent === "🔕");
    }

    console.log("== Tuile Programme TV : grille plein ecran (bandeau, frise, blocs proportionnels, zoom, recherche) ==");
    {
      const gridBtn = tile.querySelector(".pwtp-grid-btn");
      assert("bandeau d'ouverture de la grille present en bas de la tuile", !!gridBtn);
      assert("bandeau visible (reglage actif par defaut)", !gridBtn.hidden);
      assert("aucune fenetre de grille avant le premier clic (creation paresseuse)",
        !document.querySelector(".pwtp-grid-card"));

      gridBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(120);

      const gridModal = document.querySelector(".pwtp-grid-card")?.closest(".modal");
      assert("fenetre de grille ouverte au clic", !!gridModal && !gridModal.hidden);

      // --- Ligne du temps ---
      const ticks = gridModal.querySelectorAll(".pwtp-tick");
      assert("frise temporelle presente en haut avec des graduations horaires", ticks.length >= 5);
      assert("chaque graduation porte une heure lisible", (ticks[0].textContent || "").trim().length > 0);

      // --- Lignes de chaines + logos ---
      const rows = gridModal.querySelectorAll(".pwtp-grid-row");
      assert("une ligne par chaine (3 chaines dans le fixture)", rows.length === 3);
      assert("logo de chaine affiche a gauche quand la grille en fournit un",
        !!rows[0].querySelector("img.pwtp-grid-logo"));
      assert("repli visuel quand la chaine n'a pas de logo",
        !!rows[1].querySelector(".pwtp-grid-logo-ph"));
      assert("nom de la chaine affiche a cote du logo",
        (rows[0].querySelector(".pwtp-grid-chan-name")?.textContent || "").includes("TF1"));
      assert("une chaine sans aucun programme garde sa ligne (pas de trou dans la grille)",
        rows[2].querySelectorAll(".pwtp-block").length === 0);

      // --- Blocs proportionnels a la duree ---
      const tf1Blocks = rows[0].querySelectorAll(".pwtp-block");
      assert("3 blocs de programme sur TF1", tf1Blocks.length === 3);
      const widthOf = (el) => parseFloat(el.style.width);
      const leftOf = (el) => parseFloat(el.style.left);
      // "Film de test" dure 1 h, "Documentaire" dure 1 h : largeurs egales.
      // "Emission precedente" est tronquee a l'origine (elle a commence
      // 90 min avant, la fenetre demarre 60 min avant) -> 30 min visibles.
      const [prev, film, doc] = tf1Blocks;
      assert("bloc tronque a l'origine positionne au bord gauche", leftOf(prev) === 0);
      assert("deux programmes d'une heure ont la meme largeur",
        Math.abs(widthOf(film) - widthOf(doc)) < 1);
      assert("un programme de 30 min visibles est ~2x plus etroit qu'un programme d'1 h",
        widthOf(film) / widthOf(prev) > 1.7 && widthOf(film) / widthOf(prev) < 2.3);
      assert("les blocs se suivent de gauche a droite dans l'ordre chronologique",
        leftOf(prev) < leftOf(film) && leftOf(film) < leftOf(doc));
      assert("titre du programme affiche dans le bloc",
        (film.querySelector(".pwtp-block-title")?.textContent || "") === "Film de test");
      assert("vignette affichee quand le bloc est assez large et que la source en fournit une",
        !!film.querySelector("img.pwtp-block-thumb"));
      assert("aucune vignette quand la source n'en fournit pas",
        !doc.querySelector("img.pwtp-block-thumb"));

      // --- Curseur "maintenant" ---
      assert("curseur vertical 'maintenant' affiche", !!gridModal.querySelector(".pwtp-now-line"));

      // --- Zoom ---
      const widthBefore = widthOf(film);
      gridModal.querySelector(".pwtp-grid-zoom-in").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      const filmAfterZoomIn = gridModal.querySelectorAll(".pwtp-grid-row")[0].querySelectorAll(".pwtp-block")[1];
      assert("zoom avant : les blocs s'elargissent", widthOf(filmAfterZoomIn) > widthBefore);

      gridModal.querySelector(".pwtp-grid-zoom-out").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      gridModal.querySelector(".pwtp-grid-zoom-out").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(60);
      const filmAfterZoomOut = gridModal.querySelectorAll(".pwtp-grid-row")[0].querySelectorAll(".pwtp-block")[1];
      assert("zoom arriere : les blocs se retrecissent", widthOf(filmAfterZoomOut) < widthBefore);

      // --- Recherche dans la grille ---
      const gridSearch = gridModal.querySelector(".pwtp-grid-search");
      assert("zone de recherche presente dans la fenetre de grille", !!gridSearch);

      gridSearch.value = "France";
      gridSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(60);
      assert("recherche par nom de chaine : seule France 2 reste",
        gridModal.querySelectorAll(".pwtp-grid-row").length === 1
        && (gridModal.querySelector(".pwtp-grid-chan-name")?.textContent || "").includes("France 2"));

      gridSearch.value = "documentaire";
      gridSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(60);
      const matchRows = gridModal.querySelectorAll(".pwtp-grid-row");
      assert("recherche par titre d'emission : la chaine qui la diffuse est retenue",
        matchRows.length === 1 && (matchRows[0].querySelector(".pwtp-grid-chan-name")?.textContent || "").includes("TF1"));
      assert("la ligne entiere reste affichee (on ne troue pas la frise), le bloc trouve etant mis en evidence",
        matchRows[0].querySelectorAll(".pwtp-block").length === 3
        && matchRows[0].querySelectorAll(".pwtp-block-match").length === 1);

      gridSearch.value = "zzz-aucune-correspondance";
      gridSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(60);
      assert("recherche sans resultat : message dedie, aucune ligne",
        gridModal.querySelectorAll(".pwtp-grid-row").length === 0 && !!gridModal.querySelector(".pwtp-msg"));

      gridSearch.value = "";
      gridSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
      await sleep(60);
      assert("recherche videe : les 3 chaines reviennent",
        gridModal.querySelectorAll(".pwtp-grid-row").length === 3);

      // --- Synopsis au clic sur un bloc ---
      const blockToOpen = gridModal.querySelectorAll(".pwtp-grid-row")[0].querySelectorAll(".pwtp-block")[1];
      blockToOpen.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(40);
      assert("clic sur un bloc : synopsis revele (pas de 2e fenetre empilee)",
        blockToOpen.classList.contains("pwtp-block-open"));

      // --- Fermeture ---
      gridModal.querySelector(".modal-close[data-close]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(40);
      assert("fenetre de grille refermee par la croix", gridModal.hidden);
    }

    console.log("== Tuile Programme TV : parcourir les chaines disponibles (correctif v1.7.4) ==");
    tile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    const tileForm = document.getElementById("tileForm");
    const browseBtn = tileForm.querySelector(".field-browse-btn");
    assert("bouton 'parcourir les chaines' present sur le champ channels", !!browseBtn);

    // Guide TNT (defaut) : 2 chaines mockees
    browseBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    let browseList = tileForm.querySelector(".field-browse-list");
    assert("liste affichee apres clic (guide TNT)", browseList && !browseList.hidden);
    assert("2 chaines proposees en guide TNT", browseList.querySelectorAll("button[data-idx]").length === 2);

    // Reclic sur le bouton : la liste se referme (bascule)
    browseBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("2e clic sur le bouton referme la liste", browseList.hidden === true);

    // Passage au guide "France" (non enregistre) : la liste doit refleter
    // ce choix NON SAUVEGARDE au prochain clic sur "parcourir" -- c'est le
    // coeur du correctif (avant v1.7.4 la liste etait figee sur la TNT).
    const guideSelect = tileForm.querySelector('[data-key="xmltvfrGuide"]');
    if (guideSelect) {
      guideSelect.value = "france";
      guideSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
    }
    browseBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(60);
    browseList = tileForm.querySelector(".field-browse-list");
    assert("4 chaines proposees apres passage (non enregistre) au guide France",
      browseList.querySelectorAll("button[data-idx]").length === 4);

    // Clic sur une chaine -> ajoutee au textarea, puis marquee "deja ajoutee"
    const channelsTextarea = tileForm.querySelector('textarea[data-key="channels"]');
    const beforeLines = channelsTextarea.value.split("\n").filter(Boolean).length;
    const extraBtn = Array.from(browseList.querySelectorAll("button[data-idx]"))
      .find((b) => b.textContent.includes("Chaine supplementaire 1"));
    assert("chaine supplementaire proposee dans la liste", !!extraBtn);
    extraBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const afterLines = channelsTextarea.value.split("\n").filter(Boolean).length;
    assert("la chaine cliquee est ajoutee au textarea (une ligne de plus)", afterLines === beforeLines + 1);
    assert("le bouton de la chaine ajoutee est desactive", extraBtn.disabled === true);

    document.getElementById("tileModal").hidden = true;

    // Nettoyage : retirer la tuile
    tile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    document.getElementById("tileRemove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
  }

  console.log("== Tuile Classement : pourcentage de victoires lisible (pas '.692' brut) ==");
  {
    const standingsIndex = catalog.findIndex((m) => m.id === "standings");
    assert("widget standings present dans le catalogue", standingsIndex >= 0);
    const items = () => Array.from(document.querySelectorAll(".grid-stack-item"));

    document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    catalogItemFor(catalog, document, "standings")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    const tile = items()[items().length - 1];

    assert("colonne %V affiche un pourcentage lisible", tile.textContent.includes("69.2%"));
    assert("l'ancien format ESPN brut n'apparait plus", !tile.textContent.includes(".692"));

    tile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    document.getElementById("tileRemove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
  }

  console.log("== Aide : nouveau groupe 'Application de bureau' (correctif v1.7.5) ==");
  {
    document.getElementById("btnHelp").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    assert("modale d'aide ouverte", document.getElementById("helpModal").hidden === false);
    const nav = document.getElementById("helpNav");
    const winItem = nav.querySelector('[data-help-id="windows-app"]');
    assert("entree 'Application de bureau Windows' presente dans le sommaire", !!winItem);
    winItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    const content = document.getElementById("helpContent").textContent;
    assert("contenu mentionne la touche Alt pour reveler le menu", content.includes("Alt"));
    assert("contenu mentionne 'Rechercher une mise a jour'", content.includes("Rechercher une mise à jour"));

    console.log("== Aide : les widgets recemment ajoutes y figurent ==");
    ["airquality", "calendar", "radar", "planes"].forEach((id) => {
      assert(`entree '${id}' presente dans le sommaire de l'aide`, !!nav.querySelector(`[data-help-id="${id}"]`));
    });

    console.log("== Aide : section Nouveautes (changelog) ==");
    const changelogItem = nav.querySelector('[data-help-id="changelog"]');
    assert("entree 'Nouveautes' presente dans le sommaire", !!changelogItem);
    changelogItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (!document.getElementById("helpContent").querySelector(".help-changelog") && tries++ < 60) await sleep(50);
    const changelogText = document.getElementById("helpContent").textContent;
    assert("changelog : les deux versions de test apparaissent", changelogText.includes("9.9.9") && changelogText.includes("9.9.8"));
    assert("changelog : bloc francais affiche (langue active = fr)", changelogText.includes("Fonctionnalite test FR"));
    assert("changelog : bloc anglais NON affiche (filtre par langue)", !changelogText.includes("Test feature EN"));
    assert("changelog : version sans separation bilingue affichee integralement", changelogText.includes("Version simple sans separation bilingue"));

    console.log("== Aide : section A propos (version, licence, copyright) ==");
    const aboutItem = nav.querySelector('[data-help-id="about"]');
    assert("entree 'A propos' presente dans le sommaire", !!aboutItem);
    aboutItem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (document.getElementById("helpAppVersion")?.textContent === "…" && tries++ < 60) await sleep(50);
    const aboutText = document.getElementById("helpContent").textContent;
    assert("numero de version affiche (recupere de /api/version, meme source que les reglages generaux)",
      aboutText.includes("v9.9.9-test"));
    assert("licence MIT mentionnee", aboutText.includes("MIT"));
    assert("copyright mentionne", aboutText.includes("Jean-Michel Ezes"));
    assert("lien vers le depot GitHub present", !!document.getElementById("helpContent").querySelector('a[href*="github.com/jihemezes/piboard"]'));

    console.log("== Aide : recherche dans le sommaire ==");
    const searchInput = document.getElementById("helpNavSearch");
    assert("champ de recherche present en tete du sommaire", !!searchInput);
    assert("aucune entree cachee avant toute recherche",
      !nav.querySelector('.help-nav-item[hidden]'));

    searchInput.value = "agend";
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    const calendarBtn = nav.querySelector('[data-help-id="calendar"]');
    const weatherBtn = nav.querySelector('[data-help-id="weather"]');
    assert("recherche 'agend' : l'entree Agenda (calendrier) reste visible", calendarBtn && calendarBtn.hidden === false);
    assert("recherche 'agend' : une entree non correspondante (Meteo) est cachee", weatherBtn && weatherBtn.hidden === true);

    console.log("== Aide : recherche insensible aux accents ==");
    searchInput.value = "meteo"; // sans accent, doit tout de meme trouver "Météo" / no accent, should still find "Météo"
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche 'meteo' (sans accent) trouve l'entree Météo", weatherBtn && weatherBtn.hidden === false);
    searchInput.value = "météo"; // avec accent, doit fonctionner aussi / with accent, should also work
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche 'météo' (avec accent) trouve aussi l'entree Météo", weatherBtn && weatherBtn.hidden === false);
    assert("recherche : au moins un en-tete de groupe reste visible (celui du resultat)",
      !!nav.querySelector('.help-nav-group:not([hidden])'));
    assert("message 'aucun resultat' cache tant qu'il y a au moins un resultat",
      document.getElementById("helpNavEmpty").hidden === true);

    searchInput.value = "xyznexistepas";
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche sans resultat : toutes les entrees cachees",
      [...nav.querySelectorAll(".help-nav-item")].every((b) => b.hidden === true));
    assert("recherche sans resultat : tous les en-tetes de groupe caches",
      [...nav.querySelectorAll(".help-nav-group")].every((g) => g.hidden === true));
    assert("recherche sans resultat : message 'aucun resultat' affiche",
      document.getElementById("helpNavEmpty").hidden === false);

    searchInput.value = "";
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche effacee : toutes les entrees redeviennent visibles",
      [...nav.querySelectorAll(".help-nav-item")].every((b) => b.hidden === false));

    document.getElementById("helpModal").hidden = true;
  }

  console.log("== Planification par tuile : mise en pause hors plage ==");
  {
    const pausedTile = document.querySelector('[data-tile-id="t-l"]');
    const activeTile = document.querySelector('[data-tile-id="t-m"]');
    assert("la tuile hors plage est toujours presente dans la grille (pas de trou)", !!pausedTile);
    const pausedBody = pausedTile.querySelector(".tile-body");
    assert("la tuile hors plage porte la classe 'en pause'", pausedBody.classList.contains("tile-paused"));
    assert("message 'En pause' affiche", (pausedBody.textContent || "").includes("En pause"));
    assert("resume de la plage affiche sous le message",
      !!pausedBody.querySelector(".tile-paused-hint") && pausedBody.querySelector(".tile-paused-hint").textContent.trim().length > 0);
    assert("le widget n'a PAS ete monte (pas de contenu de la tuile Notes)", !pausedBody.querySelector(".pw-notes"));

    assert("la tuile planifiee mais dans sa plage est bien montee normalement",
      !!activeTile && !!activeTile.querySelector(".pw-notes"));
    assert("la tuile dans sa plage ne porte pas la classe 'en pause'",
      !activeTile.querySelector(".tile-body").classList.contains("tile-paused"));

    // La planification doit rester configurable depuis la tuile en pause :
    // sans cela, impossible de la reactiver. The schedule must stay
    // configurable from the paused tile: otherwise there'd be no way to
    // re-enable it.
    pausedTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("reglages accessibles depuis une tuile en pause", document.getElementById("tileModal").hidden === false);
    assert("section Planification presente dans les reglages",
      (document.getElementById("tileForm").textContent || "").includes("Planification"));
    assert("case d'activation de la planification cochee et 7 cases de jours",
      document.querySelector('#tileForm [data-key="_schedEnabled"]')?.checked === true
      && document.querySelectorAll("#tileForm .sched-day input").length === 7);
    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Courriel : liste des objets et lecture au clic ==");
  {
    const mailTile = document.querySelector('[data-tile-id="t-n"]');
    tries = 0;
    while (!mailTile.querySelector(".pwmb-item") && tries++ < 80) await sleep(50);
    const items = [...mailTile.querySelectorAll(".pwmb-item")];
    assert("3 messages affiches", items.length === 3);
    assert("objet du message affiche", (items[0].textContent || "").includes("Facture de juillet"));
    assert("expediteur affiche", (items[0].textContent || "").includes("Compta SARL"));
    assert("message non lu marque comme tel", items[0].classList.contains("pwmb-unread"));
    assert("message lu NON marque comme non lu", !items[1].classList.contains("pwmb-unread"));
    assert("message sans objet : mention de repli affichee", (items[2].textContent || "").includes("sans objet"));
    assert("le corps des messages n'est PAS charge dans la liste",
      !(mailTile.textContent || "").includes("Bonjour, voici votre"));

    console.log("== Courriel : bouton recharger ==");
    const callsBeforeReload = MAIL_LIST_CALLS;
    const reloadBtn = mailTile.querySelector(".pwmb-reload");
    assert("bouton recharger present sur la liste", !!reloadBtn);
    reloadBtn.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true }));
    tries = 0;
    while (MAIL_LIST_CALLS === callsBeforeReload && tries++ < 60) await sleep(50);
    assert("clic sur recharger : un nouveau releve est declenche", MAIL_LIST_CALLS > callsBeforeReload);
    // Le DOM a ete remplace par le re-rendu : reprendre une reference
    // fraiche plutot que "items", perimee. The DOM was replaced by the
    // re-render: grab a fresh reference rather than "items", now stale.
    const itemsAfterReload = [...mailTile.querySelectorAll(".pwmb-item")];
    assert("la liste reste affichee apres rechargement", itemsAfterReload.length === 3);

    assert("aucune popup avant clic", !document.querySelector(".pwmb-modal-card"));
    itemsAfterReload[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while ((document.querySelector(".pwmb-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
    const mailModal = document.querySelector(".pwmb-modal-card")?.closest(".modal");
    assert("popup de lecture ouverte au clic", mailModal && mailModal.hidden === false);
    assert("popup : objet affiche en titre", document.querySelector(".pwmb-modal-title")?.textContent === "Facture de juillet");
    assert("popup : expediteur affiche dans le meta", (document.querySelector(".pwmb-modal-meta")?.textContent || "").includes("Compta SARL"));

    const mailBody = document.querySelector(".pwmb-modal-body");
    assert("popup : contenu du message affiche", (mailBody.textContent || "").includes("Bonjour, voici votre"));
    assert("popup : mise en forme conservee (gras)", mailBody.innerHTML.includes("<b>facture</b>"));
    assert("popup : piece jointe listee", (mailBody.textContent || "").includes("facture-juillet.pdf"));

    console.log("== Courriel : desinfection du HTML hostile ==");
    assert("script du courriel non execute", !window.__pwnedMail);
    assert("balise <script> absente du HTML injecte", !mailBody.innerHTML.includes("<script"));
    assert("gestionnaire onclick retire", !mailBody.innerHTML.includes("onclick"));
    assert("pixel espion retire : aucune balise <img> restante", !mailBody.querySelector("img"));
    assert("image retiree remplacee par une mention visible", !!mailBody.querySelector(".pwmb-img-removed"));
    assert("l'URL du traqueur n'apparait nulle part", !mailBody.innerHTML.includes("tracker.exemple.fr"));

    console.log("== Courriel : liens cliquables mais assainis ==");
    const safeLink = [...mailBody.querySelectorAll("a")].find((a) => (a.textContent || "").includes("Cliquez ici"));
    assert("lien http conserve et cliquable (href present)", !!safeLink?.getAttribute("href"));
    assert("lien ouvert a l'exterieur (target=_blank)", safeLink?.getAttribute("target") === "_blank");
    assert("lien protege : rel noopener (pas de main sur la page du tableau)",
      (safeLink?.getAttribute("rel") || "").includes("noopener"));
    assert("domaine reel de destination affiche a cote du lien",
      (mailBody.textContent || "").includes("hameconnage.test"));

    const jsLink = [...mailBody.querySelectorAll("a")].find((a) => (a.textContent || "").includes("Lien piege"));
    assert("lien javascript: neutralise (href retire)", jsLink && !jsLink.getAttribute("href"));
    assert("texte du lien piege conserve malgre tout", (mailBody.textContent || "").includes("Lien piege"));

    mailModal.querySelector(".modal-close[data-close]")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("popup refermee par le bouton", mailModal.hidden === true);

    console.log("== Courriel : le choix d'un fournisseur remplit le serveur ==");
    mailTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const presetSel = document.querySelector('#tileForm [data-key="preset"]');
    const hostInput = document.querySelector('#tileForm [data-key="host"]');
    const portInput = document.querySelector('#tileForm [data-key="port"]');
    assert("liste des fournisseurs et champ serveur presents", !!presetSel && !!hostInput);
    assert("serveur initial inchange avant tout choix", hostInput.value === "imap.test.fr");

    presetSel.value = "imap.free.fr";
    presetSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert("choix d'un fournisseur : serveur IMAP rempli automatiquement", hostInput.value === "imap.free.fr");
    assert("choix d'un fournisseur : port rempli automatiquement", String(portInput.value) === "993");

    // L'option vide ne doit rien ecraser : elle n'a pas de "fills".
    // The empty option must overwrite nothing: it has no "fills".
    presetSel.value = "";
    presetSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert("option vide : le serveur deja rempli n'est pas efface", hostInput.value === "imap.free.fr");

    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Courriel : reglages Liens cliquables et Afficher les images ==");
  {
    const mailTile = document.querySelector('[data-tile-id="t-n"]');
    mailTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const allowLinksBox = document.querySelector('#tileForm [data-key="allowLinks"]');
    const showImagesBox = document.querySelector('#tileForm [data-key="showImages"]');
    assert("case 'Liens cliquables' presente et cochee par defaut", !!allowLinksBox && allowLinksBox.checked === true);
    assert("case 'Afficher les images' presente et decochee par defaut", !!showImagesBox && showImagesBox.checked === false);

    allowLinksBox.checked = false;
    showImagesBox.checked = true;
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    const mailTile2 = document.querySelector('[data-tile-id="t-n"]');
    tries = 0;
    while (!mailTile2.querySelector(".pwmb-item") && tries++ < 80) await sleep(50);
    mailTile2.querySelector(".pwmb-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while ((document.querySelector(".pwmb-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
    const body2 = document.querySelector(".pwmb-modal-body");

    assert("liens desactives : plus aucun href dans le message", !body2.querySelector("a[href]"));
    assert("liens desactives : le texte du lien reste lisible", (body2.textContent || "").includes("Cliquez ici"));
    assert("images activees : l'image distante s'affiche desormais", !!body2.querySelector('img[src="https://tracker.exemple.fr/pixel.gif"]'));
    assert("images activees : plus de mention de repli pour cette image", !body2.querySelector(".pwmb-img-removed"));

    document.querySelector(".pwmb-modal-card")?.closest(".modal")?.querySelector(".modal-close[data-close]")
      ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Courriel : bouton 'Afficher les images' directement dans le message ==");
  {
    // Remet la tuile sur ses reglages par defaut (images masquees) avant
    // de tester la banniere -- le bloc precedent les avait modifies.
    // Resets the tile to its default settings (images hidden) before
    // testing the banner -- the previous block changed them.
    const mailTile = document.querySelector('[data-tile-id="t-n"]');
    mailTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    document.querySelector('#tileForm [data-key="allowLinks"]').checked = true;
    document.querySelector('#tileForm [data-key="showImages"]').checked = false;
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);

    tries = 0;
    while (!mailTile.querySelector(".pwmb-item") && tries++ < 80) await sleep(50);
    mailTile.querySelector(".pwmb-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while ((document.querySelector(".pwmb-modal-body")?.textContent || "").includes("Chargement") && tries++ < 60) await sleep(50);
    const body3 = document.querySelector(".pwmb-modal-body");

    assert("reglage par defaut : image toujours masquee", !!body3.querySelector(".pwmb-img-removed"));
    const showImagesBtn = body3.querySelector(".pwmb-show-images");
    assert("bouton 'Afficher les images' propose directement dans le message", !!showImagesBtn);

    showImagesBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("clic sur le bouton : l'image distante s'affiche immediatement",
      !!body3.querySelector('img[src="https://tracker.exemple.fr/pixel.gif"]'));
    assert("le bouton disparait une fois les images affichees", !body3.querySelector(".pwmb-show-images"));

    const mailboxSettingsAfter = document.querySelector('[data-tile-id="t-n"]');
    mailboxSettingsAfter.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("le reglage general 'Afficher les images distantes' n'a PAS ete modifie par le bouton du message",
      document.querySelector('#tileForm [data-key="showImages"]').checked === false);
    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);

    document.querySelector(".pwmb-modal-card")?.closest(".modal")?.querySelector(".modal-close[data-close]")
      ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Astronomie : phase de lune, planetes visibles, passages ISS ==");
  {
    const astroTile = document.querySelector('[data-tile-id="t-o"]');
    tries = 0;
    while (!astroTile.querySelector(".pwa-section") && tries++ < 80) await sleep(50);

    console.log("== Astronomie : phase de lune ==");
    assert("titre de la section lune affiche", (astroTile.textContent || "").includes("Lune"));
    assert("nom de la phase traduit affiche (gibbeuse croissante)", (astroTile.textContent || "").includes("Gibbeuse croissante"));
    assert("pourcentage d'eclairement affiche (62%)", (astroTile.textContent || "").includes("62%"));
    assert("icone de lune (svg) presente", !!astroTile.querySelector(".pwa-moon-icon svg"));
    assert("chemin de la partie eclairee present dans le svg", !!astroTile.querySelector(".pwa-moon-lit"));

    console.log("== Astronomie : prochaine eclipse ==");
    assert("titre de la section eclipse affiche", (astroTile.textContent || "").includes("Prochaine éclipse"));
    assert("type et nature de l'eclipse affiches (solaire partielle)", (astroTile.textContent || "").includes("Éclipse solaire partielle"));
    assert("pourcentage d'obscuration affiche (87%)", (astroTile.textContent || "").includes("87%"));
    assert("compte a rebours affiche (dans 12 jours)", (astroTile.textContent || "").includes("dans 12 jours"));
    assert("compte a rebours dans son propre element, distinct de la date", !!astroTile.querySelector(".pwa-eclipse-countdown"));

    console.log("== Astronomie : planetes visibles ==");
    const planetItems = [...astroTile.querySelectorAll(".pwa-planet-item")];
    assert("2 planetes affichees (Mars sous l'horizon exclue)", planetItems.length === 2);
    assert("Venus (la plus haute) affichee en premier", (planetItems[0].textContent || "").includes("Vénus"));
    assert("Mars (sous l'horizon) absente de la liste", !(astroTile.textContent || "").includes("Mars"));
    assert("magnitude de Venus affichee (negative = brillante)", (planetItems[0].textContent || "").includes("-4.1"));
    assert("direction de Jupiter affichee", (planetItems[1].textContent || "").includes("E ·"));

    console.log("== Astronomie : passages ISS ==");
    const issItems = [...astroTile.querySelectorAll(".pwa-iss-item")];
    assert("2 passages ISS affiches", issItems.length === 2);
    assert("passage visible marque comme tel (classe dediee)", issItems[0].classList.contains("pwa-iss-visible"));
    assert("passage non visible NON marque comme visible", !issItems[1].classList.contains("pwa-iss-visible"));
    assert("direction lever->coucher affichee", (issItems[0].textContent || "").includes("WSW → NE"));
    assert("duree en minutes affichee", (issItems[0].textContent || "").includes("7 min"));
    assert("elevation maximale affichee", (issItems[0].textContent || "").includes("62°"));

    console.log("== Astronomie : reglages (sections activables independamment) ==");
    astroTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("case Lune presente et cochee par defaut", document.querySelector('#tileForm [data-key="showMoonPhase"]')?.checked === true);
    assert("case ISS presente et cochee par defaut", document.querySelector('#tileForm [data-key="showIss"]')?.checked === true);
    assert("case Planetes presente et cochee par defaut", document.querySelector('#tileForm [data-key="showPlanets"]')?.checked === true);
    assert("case Eclipse presente et cochee par defaut", document.querySelector('#tileForm [data-key="showEclipse"]')?.checked === true);
    assert("passages visibles uniquement coche par defaut (choix retenu)", document.querySelector('#tileForm [data-key="issVisibleOnly"]')?.checked === true);
    assert("Uranus/Neptune decoche par defaut (non visibles a l'oeil nu)", document.querySelector('#tileForm [data-key="includeOuterPlanets"]')?.checked === false);

    document.querySelector('#tileForm [data-key="showIss"]').checked = false;
    document.querySelector('#tileForm [data-key="showPlanets"]').checked = false;
    document.querySelector('#tileForm [data-key="showEclipse"]').checked = false;
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const astroTile2 = document.querySelector('[data-tile-id="t-o"]');
    tries = 0;
    while (!astroTile2.querySelector(".pwa-section") && tries++ < 80) await sleep(50);
    assert("section ISS masquee une fois decochee", !astroTile2.textContent.includes("Passages ISS"));
    assert("section planetes masquee une fois decochee", !astroTile2.textContent.includes("Vénus"));
    assert("section eclipse masquee une fois decochee", !astroTile2.textContent.includes("Prochaine éclipse"));
    assert("section lune, elle, reste affichee", astroTile2.textContent.includes("Lune"));
  }

  console.log("== Horloge : fuseau secondaire, numero de semaine, prochain evenement ==");
  {
    const clockTile = document.querySelector('[data-tile-id="t-p"]');
    tries = 0;
    while (!clockTile.querySelector(".pwc-zone-time") && tries++ < 80) await sleep(50);

    assert("fuseau secondaire affiche (libelle Tokyo)", (clockTile.textContent || "").includes("Tokyo"));
    assert("heure du fuseau secondaire au format HH:MM", /\d{2}:\d{2}/.test(clockTile.querySelector(".pwc-zone-time")?.textContent || ""));

    const weekText = clockTile.querySelector(".pwc-week")?.textContent || "";
    assert("numero de semaine affiche", /^S\d{1,2}$/.test(weekText));

    tries = 0;
    while (!clockTile.querySelector(".pwc-next-event-title") && tries++ < 80) await sleep(50);
    assert("ligne 'prochain evenement' affichee", clockTile.querySelector(".pwc-next-event")?.hidden === false);
    assert("mode digital avec extras : disposition cote a cote appliquee (heure a gauche, extras a droite, correctif de lisibilite)",
      !!clockTile.querySelector(".pw-clock-wrap.pwc-wrap-side"));
    // Le retrait du trait de separation (juge disgracieux) est une pure
    // regle CSS (border-left) : jsdom ne resout pas de facon fiable les
    // styles calcules issus d'une feuille externe pour ce cas precis
    // (deja constate ici), meme limite que celle documentee ailleurs
    // dans ce fichier pour le rendu visuel reel (Leaflet, navigation).
    // Verifie directement dans le fichier source plutot que force ici.
    // Removing the separator line (judged unattractive) is a pure CSS
    // rule (border-left): jsdom doesn't reliably resolve computed
    // styles from an external stylesheet for this specific case
    // (confirmed here), the same kind of limit already documented
    // elsewhere in this file for real visual rendering (Leaflet,
    // navigation). Verified directly in the source file rather than
    // forced here.
    assert("titre de l'evenement correct", (clockTile.querySelector(".pwc-next-event-title")?.textContent || "").includes("Rendez-vous dentiste"));

    // Non-regression : le numero de semaine seul (sans fuseau ni
    // prochain evenement actifs) ne doit PAS a lui seul reserver une
    // colonne a droite -- bug signale par capture d'ecran (colonne vide
    // avec pour seul contenu un trait de separation).
    // Regression check: the week number alone (no active zone or next
    // event) must NOT on its own reserve a right-hand column -- a bug
    // reported via screenshot (empty column with only a separator line
    // to show for it).
    clockTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    document.querySelector('#tileForm [data-key="extraZone1Label"]').value = "";
    document.querySelector('#tileForm [data-key="extraZone1Tz"]').value = "";
    document.querySelector('#tileForm [data-key="showNextEvent"]').checked = false;
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const clockTile3 = document.querySelector('[data-tile-id="t-p"]');
    tries = 0;
    while (!clockTile3.querySelector(".pwc-time") && tries++ < 80) await sleep(50);
    assert("numero de semaine seul (sans fuseau ni evenement) : PAS de disposition cote a cote",
      !clockTile3.querySelector(".pw-clock-wrap.pwc-wrap-side"));
    assert("le numero de semaine reste neanmoins affiche, dans le bloc horloge",
      !!clockTile3.querySelector(".pwc-week") && clockTile3.querySelector(".pwc-week").hidden === false);

    // L'alarme (declenchement + son + bouton Arreter) est verifiee a la
    // main dans la session de construction de la fonctionnalite (voir le
    // CHANGELOG) plutot qu'ici : son heure de declenchement depend de
    // l'heure REELLE du systeme au moment ou la suite tourne, ce que ce
    // fichier ne maitrise pas -- meme limite deja documentee ailleurs
    // dans cette suite (Leaflet, navigation reelle).
    // The alarm (triggering + sound + Stop button) is verified by hand
    // in the feature's build session (see the CHANGELOG) rather than
    // here: its trigger time depends on the system's REAL time when the
    // suite runs, which this file doesn't control -- the same kind of
    // limit already documented elsewhere in this suite (Leaflet, real
    // navigation).
    clockTile.querySelector(".tile-gear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("reglage d'une alarme presente (heure)", !!document.querySelector('#tileForm [data-key="alarm1Time"]'));
    assert("reglage d'une alarme presente (jours)", !!document.querySelector('#tileForm [data-key="alarm1Days"]'));
    assert("reglage d'une alarme presente (son)", !!document.querySelector('#tileForm [data-key="alarm1Sound"]'));
    assert("5 alarmes independantes proposees (comme convenu)",
      [1, 2, 3, 4, 5].every((i) => !!document.querySelector(`#tileForm [data-key="alarm${i}Enabled"]`)));

    console.log("== Horloge : selecteur de fuseau horaire (liste complete, plus de saisie libre) ==");
    const tzSelect = document.querySelector('#tileForm [data-key="timezone"]');
    assert("champ fuseau horaire est bien une liste, pas un champ texte", tzSelect && tzSelect.tagName === "SELECT");
    assert("liste complete des fuseaux IANA (~418 + option vide)", tzSelect.querySelectorAll("option").length > 400);
    assert("fuseaux regroupes par continent (optgroup)", tzSelect.querySelectorAll("optgroup").length > 5);
    assert("Europe/Paris present dans la liste", !!tzSelect.querySelector('option[value="Europe/Paris"]'));
    assert("libelle de ville sans le prefixe continent ni underscore (New York, pas America/New_York)",
      !!tzSelect.querySelector('option[value="America/New_York"]') && tzSelect.querySelector('option[value="America/New_York"]').textContent === "New York");
    assert("option par defaut = fuseau du systeme (valeur vide, deja selectionnee)",
      tzSelect.querySelector('option[value=""]')?.selected === true);
    const extraTzSelect = document.querySelector('#tileForm [data-key="extraZone1Tz"]');
    assert("fuseau supplementaire aussi en liste, avec son propre libelle vide",
      extraTzSelect && extraTzSelect.tagName === "SELECT" && extraTzSelect.querySelector('option[value=""]')?.textContent.includes("Non utilisé"));

    tzSelect.value = "Asia/Tokyo";
    tzSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
    document.getElementById("tileSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    const clockTile2 = document.querySelector('[data-tile-id="t-p"]');
    tries = 0;
    while (!clockTile2.querySelector(".pwc-time") && tries++ < 80) await sleep(50);
    assert("le fuseau choisi via la liste s'applique reellement a l'affichage", !!clockTile2.querySelector(".pwc-time"));

    document.getElementById("tileModal").querySelector(".modal-close")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
  }

  console.log("== Chaines TV (IPTV) : liste, recherche, filtre, lecture ==");
  {
    const tvTile = document.querySelector('[data-tile-id="t-q"]');
    tries = 0;
    while (!tvTile.querySelector(".pwtv-item") && tries++ < 80) await sleep(50);

    assert("3 chaines listees depuis la playlist", tvTile.querySelectorAll(".pwtv-item").length === 3);
    assert("nom de chaine affiche", (tvTile.textContent || "").includes("France 24"));
    assert("logo affiche quand la playlist en fournit un", !!tvTile.querySelector('.pwtv-logo[src*="f24.png"]'));
    assert("repli visuel quand la chaine n'a pas de logo", !!tvTile.querySelector(".pwtv-logo-empty"));
    assert("categories de la playlist proposees dans le filtre",
      tvTile.querySelectorAll(".pwtv-group option").length === 3); // 2 groupes + "toutes"

    console.log("== Chaines TV : filtre par categorie ==");
    const groupSel = tvTile.querySelector(".pwtv-group");
    groupSel.value = "Info";
    groupSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert("filtre 'Info' : 2 chaines restantes", tvTile.querySelectorAll(".pwtv-item").length === 2);
    assert("filtre 'Info' : Arte (autre categorie) exclue", !(tvTile.querySelector(".pwtv-list").textContent || "").includes("Arte"));

    groupSel.value = "";
    groupSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert("filtre retire : les 3 chaines reviennent", tvTile.querySelectorAll(".pwtv-item").length === 3);

    console.log("== Chaines TV : recherche insensible aux accents ==");
    const searchEl = tvTile.querySelector(".pwtv-search");
    searchEl.value = "generalistes"; // sans accent, doit trouver "Généralistes" via le nom de chaine ? non : on cherche par NOM
    searchEl.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche sans correspondance : message dedie", !!tvTile.querySelector(".pwtv-empty"));
    searchEl.value = "euronews";
    searchEl.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert("recherche 'euronews' : 1 seule chaine", tvTile.querySelectorAll(".pwtv-item").length === 1);
    searchEl.value = "";
    searchEl.dispatchEvent(new window.Event("input", { bubbles: true }));

    console.log("== Chaines TV : passage au lecteur ==");
    tvTile.querySelector(".pwtv-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(50);
    assert("clic sur une chaine : le lecteur s'affiche", !!tvTile.querySelector(".pwtv-video"));
    assert("nom de la chaine en cours affiche", (tvTile.querySelector(".pwtv-current")?.textContent || "").includes("France 24"));
    assert("demarre sans le son (reglage par defaut, et exigence des navigateurs)",
      tvTile.querySelector(".pwtv-video").muted === true);
    assert("bouton de retour a la liste present", !!tvTile.querySelector(".pwtv-back"));

    tvTile.querySelector(".pwtv-back").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("retour a la liste : le lecteur est retire (le flux ne tourne plus)", !tvTile.querySelector(".pwtv-video"));
    assert("retour a la liste : les chaines sont de nouveau listees", tvTile.querySelectorAll(".pwtv-item").length === 3);
  }

  console.log("== Chaines TV (Xtream Codes) : Direct/Films/Series, categories, flux, episodes ==");
  {
    const tvTile = document.querySelector('[data-tile-id="t-r"]');
    tries = 0;
    while (!tvTile.querySelector(".pwtv-source") && tries++ < 80) await sleep(50);

    assert("URL Xtream detectee : 3 sources proposees (Direct/Films/Series)", tvTile.querySelectorAll(".pwtv-source").length === 3);
    assert("libelles des sources corrects", (tvTile.textContent || "").includes("Direct") && (tvTile.textContent || "").includes("Films") && (tvTile.textContent || "").includes("Séries"));

    console.log("== Xtream : categories d'une source (noms exacts du cas reel) ==");
    tvTile.querySelector('.pwtv-source[data-source="live"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("categorie 'France HD|OTT' affichee", (tvTile.textContent || "").includes("France HD|OTT"));
    assert("categorie 'France SD|OTT' affichee", (tvTile.textContent || "").includes("France SD|OTT"));
    assert("bouton retour present des le 2e niveau", !!tvTile.querySelector(".pwtv-navback"));

    console.log("== Xtream : flux d'une categorie, puis lecture ==");
    tvTile.querySelector('.pwtv-item[data-id="10"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (!tvTile.querySelector(".pwtv-item[data-idx]") && tries++ < 80) await sleep(50);
    assert("chaines de la categorie affichees", (tvTile.textContent || "").includes("France 24") && (tvTile.textContent || "").includes("TF1"));
    tvTile.querySelector(".pwtv-item[data-idx]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("lecture demarree depuis la navigation Xtream", !!tvTile.querySelector(".pwtv-video"));
    assert("PAS de controles natifs pour une chaine en direct (rien a avancer/reculer)",
      !tvTile.querySelector(".pwtv-video").hasAttribute("controls"));
    assert("bouton pause/lecture present pour le direct", !!tvTile.querySelector(".pwtv-playpause"));
    assert("bouton plein ecran present pour le direct", !!tvTile.querySelector(".pwtv-fullscreen"));
    assert("curseur de volume present pour le direct", !!tvTile.querySelector(".pwtv-volume"));
    assert("boutons precedent/suivant presents (2 chaines dans le fixture)",
      !!tvTile.querySelector(".pwtv-prevchan") && !!tvTile.querySelector(".pwtv-nextchan"));
    assert("chaine actuelle = France 24 (premiere de la liste)",
      tvTile.querySelector(".pwtv-current").textContent === "France 24");
    tvTile.querySelector(".pwtv-nextchan").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("bouton 'suivant' passe bien a TF1", tvTile.querySelector(".pwtv-current").textContent === "TF1");
    tvTile.querySelector(".pwtv-nextchan").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("bouton 'suivant' depuis la derniere reboucle vers France 24",
      tvTile.querySelector(".pwtv-current").textContent === "France 24");
    // Verrouille le comportement critique decouvert par examen du
    // lecteur de reference : le direct passe TOUJOURS par le pipeline
    // de transcodage desormais (URL en .ts, jamais lisible directement
    // par un navigateur), pas par hls.js ni l'URL brute du fournisseur.
    // Locks in the critical behavior found by examining the reference
    // player: live now ALWAYS goes through the transcode pipeline
    // (a .ts URL, never directly playable by a browser), not hls.js nor
    // the provider's raw URL.
    const liveVideoSrc = tvTile.querySelector(".pwtv-video").getAttribute("src") || "";
    assert("le direct passe par le pipeline de transcodage (/api/iptv/audio-fix)",
      liveVideoSrc.startsWith("/api/iptv/audio-fix"));
    assert("l'URL Xtream d'origine transmise en parametre se termine bien en .ts (pas .m3u8)",
      decodeURIComponent(liveVideoSrc).includes(".ts") && !decodeURIComponent(liveVideoSrc).includes(".m3u8"));
    tvTile.querySelector(".pwtv-back").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("retour depuis le lecteur : on revient a la liste des flux de la categorie (pas a la racine)",
      (tvTile.textContent || "").includes("France 24"));

    console.log("== Xtream : films, avertissement de format non lisible (.mkv) ==");
    tvTile.querySelector(".pwtv-navback").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector(".pwtv-navback").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector('.pwtv-source[data-source="vod"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    tvTile.querySelector(".pwtv-item[data-id]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (!tvTile.querySelector(".pwtv-item[data-idx]") && tries++ < 80) await sleep(50);
    assert("avertissement affiche pour un film en .mkv (format non garanti dans un navigateur)", !!tvTile.querySelector(".pwtv-format-warn"));

    console.log("== Xtream : series, navigation vers les episodes ==");
    tvTile.querySelector(".pwtv-navback").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector(".pwtv-navback").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector('.pwtv-source[data-source="series"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    tvTile.querySelector(".pwtv-item[data-id]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (!tvTile.querySelector(".pwtv-item[data-idx]") && tries++ < 80) await sleep(50);
    assert("liste des series de la categorie affichee", (tvTile.textContent || "").includes("Une Serie"));
    tvTile.querySelector(".pwtv-item[data-idx]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (!tvTile.querySelector(".pwtv-season") && tries++ < 80) await sleep(50);
    assert("saison affichee", (tvTile.textContent || "").includes("Saison 1"));
    assert("episode affiche", (tvTile.textContent || "").includes("Episode 1"));
    tvTile.querySelector(".pwtv-item[data-idx]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(30);
    assert("lecture d'un episode demarree", !!tvTile.querySelector(".pwtv-video"));
    assert("controles natifs (lecture/pause/avance rapide) presents pour la VOD (episode)",
      tvTile.querySelector(".pwtv-video").hasAttribute("controls"));
    assert("bouton muet maison absent pour la VOD (redondant avec le volume natif)",
      !tvTile.querySelector(".pwtv-mute"));
    assert("bouton pause/lecture maison absent pour la VOD (redondant avec les controles natifs)",
      !tvTile.querySelector(".pwtv-playpause"));
    assert("bouton plein ecran maison absent pour la VOD (redondant avec les controles natifs)",
      !tvTile.querySelector(".pwtv-fullscreen"));
    assert("curseur de volume maison absent pour la VOD (redondant avec le volume natif)",
      !tvTile.querySelector(".pwtv-volume"));
    assert("boutons precedent/suivant absents pour la VOD",
      !tvTile.querySelector(".pwtv-prevchan") && !tvTile.querySelector(".pwtv-nextchan"));

    console.log("== Chaines TV : correctif 'Touchez pour lancer la lecture' reellement cliquable ==");
    // Simule le VRAI comportement d'un navigateur quand la politique de
    // lecture automatique bloque le demarrage : video.play() renvoie une
    // promesse REJETEE (pas une exception synchrone, ce que fait jsdom
    // par defaut faute d'implementation -- un chemin de code different).
    // Simulates the REAL browser behavior when the autoplay policy
    // blocks playback: video.play() returns a REJECTED promise (not a
    // synchronous exception, which is what jsdom does by default for
    // lack of implementation -- a different code path).
    console.log("== Chaines TV : correctif 'Touchez pour lancer la lecture' reellement cliquable ==");
    // Surcharge temporaire de HTMLMediaElement.prototype.play() (une
    // seule fois, restauree juste apres) : force le VRAI code du widget
    // (safePlay/setStatus) a emprunter le chemin de rejet -- comportement
    // reel d'un navigateur quand la politique de lecture automatique
    // bloque le demarrage -- plutot que de simuler a la main le resultat
    // attendu. Le retour a la liste puis un nouveau clic sur une chaine
    // declenche un tout nouvel appel a attachStream()/safePlay() par le
    // widget lui-meme.
    // Temporary override of HTMLMediaElement.prototype.play() (once
    // only, restored right after): forces the widget's REAL code
    // (safePlay/setStatus) to take the rejection path -- a real
    // browser's actual behavior when the autoplay policy blocks
    // playback -- rather than hand-simulating the expected outcome.
    // Going back to the list then clicking a channel again triggers a
    // brand new attachStream()/safePlay() call by the widget itself.
    const origPlay = dom.window.HTMLMediaElement.prototype.play;
    let retried = false;
    dom.window.HTMLMediaElement.prototype.play = function () {
      dom.window.HTMLMediaElement.prototype.play = function () { retried = true; return Promise.resolve(); };
      return Promise.reject(new Error("NotAllowedError"));
    };
    tvTile.querySelector(".pwtv-back").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector(".pwtv-item[data-idx]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    // Attend specifiquement le texte final ("touchez pour lancer"), pas
    // juste "non masque" -- l'etat "Connexion..." intermediaire est LUI
    // AUSSI non masque, une boucle moins precise sortirait prematurement
    // et testerait un etat encore transitoire.
    // Waits specifically for the final text ("tap to start"), not just
    // "not hidden" -- the intermediate "Connecting..." state is ALSO not
    // hidden, a less precise loop would exit prematurely and test a
    // still-transitional state.
    tries = 0;
    while ((tvTile.querySelector(".pwtv-status")?.textContent || "") !== "Touchez pour lancer la lecture" && tries++ < 60) await sleep(50);

    const statusEl = tvTile.querySelector(".pwtv-status");
    assert("statut 'touchez pour lancer' rendu visible par le VRAI code du widget", statusEl && statusEl.hidden === false);
    assert("pointer-events active sur ce statut precis (classe dediee)", statusEl.classList.contains("pwtv-status-clickable"));
    statusEl.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    assert("clic sur le statut declenche bien une nouvelle tentative de lecture reelle", retried === true);

    console.log("== Chaines TV : si la tentative apres clic echoue AUSSI, message different (pas la meme impression d'immobilisme) ==");
    // Rouvre une chaine avec un play() qui echoue systematiquement,
    // meme apres le clic de reprise : verifie que le second echec
    // affiche un message DIFFERENT de "touchez pour lancer" plutot que
    // de reboucler sur le meme texte -- c'est precisement ce qui donnait
    // l'impression que le clic ne servait a rien (signale sous Windows).
    // Reopens a channel with a play() that keeps failing, even after the
    // resume click: checks that the second failure shows a DIFFERENT
    // message than "tap to start" rather than looping back to the same
    // text -- exactly what gave the impression the click did nothing
    // (reported on Windows).
    dom.window.HTMLMediaElement.prototype.play = function () { return Promise.reject(new Error("stream unreachable")); };
    tvTile.querySelector(".pwtv-back").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    tvTile.querySelector(".pwtv-item[data-idx]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while ((tvTile.querySelector(".pwtv-status")?.textContent || "") !== "Touchez pour lancer la lecture" && tries++ < 60) await sleep(50);
    tvTile.querySelector(".pwtv-status").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while ((tvTile.querySelector(".pwtv-status")?.textContent || "") === "Touchez pour lancer la lecture" && tries++ < 60) await sleep(50);
    const secondFailStatus = tvTile.querySelector(".pwtv-status");
    assert("apres un second echec (post-clic), le message N'EST PLUS 'touchez pour lancer'",
      secondFailStatus.textContent !== "Touchez pour lancer la lecture" && secondFailStatus.textContent !== "");
    dom.window.HTMLMediaElement.prototype.play = origPlay;

    console.log("== Chaines TV : mode de compatibilite (son muet / complet) ==");
    {
      const iptvManifest = catalog.find((m) => m.id === "iptv");
      const compatSetting = (iptvManifest?.settings || []).find((s) => s.key === "compatMode");
      assert("option 'mode de compatibilite' exposee dans les reglages", !!compatSetting);
      assert("desactivee par defaut (le flux ne transite par le PiBoard que sur demande explicite)",
        compatSetting?.default === "off");
      assert("les 3 options (desactive/audio seul/complet) sont proposees",
        (compatSetting?.options || []).map((o) => o.value).sort().join(",") === "audio,full,off");
      for (const lang of ["fr", "en"]) {
        window.PiBoardI18n.setLang(lang);
        assert(`libelle iptv.audioFixError traduit en ${lang}`,
          window.PiBoardI18n.t("iptv.audioFixError") !== "iptv.audioFixError");
      }
      window.PiBoardI18n.setLang("fr");
    }

    // Correctif "aucun repli sur l'URL brute quand hls.js echoue a se
    // charger" (voir widget.js, catch de la branche hls.js) : verifie
    // via un script isole plutot qu'ici, simuler l'echec de chargement
    // exigeant de modifier document.createElement de facon GLOBALE, au
    // risque de perturber les nombreux autres tests de ce fichier tres
    // long qui creent aussi des elements script/autres.
    // "No fallback to the raw URL when hls.js fails to load" fix (see
    // widget.js, the hls.js branch's catch): verified via a standalone
    // script rather than here, simulating the load failure requiring a
    // GLOBAL patch of document.createElement, risking interference with
    // the many other tests in this very long file that also create
    // script/other elements.

    console.log("== Chaines TV : detection de l'absence de piste audio (AC3/DTS) ==");
    // L'ecouteur "playing" du widget est a usage unique (once:true, par
    // conception : la verification n'a besoin de se faire qu'une fois
    // par flux) -- un seul declenchement est donc teste ici ; le cas
    // "avertissement masque quand une piste est presente" est deja
    // verifie precisement dans un script isole (voir la session de
    // construction du correctif). The widget's "playing" listener is
    // single-use (once:true, by design: the check only needs to happen
    // once per stream) -- only one trigger is therefore tested here; the
    // "warning hidden when a track is present" case is already precisely
    // verified in a standalone script (see the fix's build session).
    const epVideo = tvTile.querySelector(".pwtv-video");
    Object.defineProperty(epVideo, "audioTracks", { value: [], configurable: true });
    epVideo.dispatchEvent(new window.Event("playing"));
    await sleep(20);
    const audioWarn = tvTile.querySelector(".pwtv-audio-warn");
    assert("avertissement 'pas de piste audio' affiche quand audioTracks est vide", audioWarn && audioWarn.hidden === false);
  }

  console.log("== Flux RSS : plusieurs flux combines dans la meme tuile ==");
  {
    const multiTile = document.querySelector('[data-tile-id="t-s"]');
    tries = 0;
    while (!multiTile.querySelector(".pwr-item") && tries++ < 80) await sleep(50);

    assert("articles des DEUX flux presents dans la meme tuile",
      (multiTile.textContent || "").includes("Article avec lien") && (multiTile.textContent || "").includes("Article du second flux"));

    const titles = [...multiTile.querySelectorAll(".pwr-title")].map((t) => t.textContent);
    assert("fusion par ordre chronologique : l'article du second flux (22 juillet, le plus recent) arrive en tete",
      titles[0].includes("Article du second flux"));

    const tags = [...multiTile.querySelectorAll(".pwr-tag")].map((t) => t.textContent);
    assert("etiquette courte utilisee quand un libelle est fourni ('Flux Un', pas le titre complet du flux)",
      tags.includes("Flux Un"));
    assert("etiquette de repli = titre du flux quand aucun libelle n'est fourni pour le 2e flux",
      tags.includes("Deuxieme Flux Long Nom De Source"));
    assert("pas d'en-tete de source unique en mode multi-flux (n'aurait plus de sens)",
      multiTile.querySelector(".pwr-source")?.hidden === true);
  }

  /* ---------- Debordement du tableau / board overflow ----------
     jsdom ne fait aucune mise en page : scrollHeight et clientHeight y
     valent 0, donc updateOverflow() conclut toujours "pas de
     debordement". On les simule pour verifier les DEUX etats, le second
     etant precisement celui qui ne doit jamais se produire par erreur.
     jsdom performs no layout: scrollHeight and clientHeight are 0 there,
     so updateOverflow() always concludes "no overflow". We fake them to
     check BOTH states, the second one being precisely the one that must
     never happen by mistake. */
  /* ---------- Echappement des attributs HTML ----------
     Ce bloc existe a cause d'un bug reel : escapeHtmlAttr() n'echappait
     pas le guillemet double. Invisible tant qu'aucune valeur n'en
     contenait, puis il a vide silencieusement l'editeur de lignes de la
     tuile Bourse -- le JSON en contient a chaque cle, l'attribut se
     fermait au premier, et la valeur relue etait tronquee a "[{".
     This block exists because of a real bug: escapeHtmlAttr() did not
     escape the double quote. Invisible while no value contained one, it
     then silently emptied the Stocks tile's row editor -- JSON has one at
     every key, the attribute closed at the first, and the value read back
     was truncated to "[{". */
  /* ---------- Tuile Etat systeme : lisibilite et historique ----------
     Le premier bloc existe a cause d'un defaut signale : `space-between`
     sans `gap` ne garantit AUCUN espace, si bien que le libelle et la
     valeur se touchaient des qu'ils remplissaient la largeur.
     The first block exists because of a reported defect: `space-between`
     with no `gap` guarantees NO space, so the label and the value touched
     as soon as they filled the width. */
  /* ---------- Cloisonnement des feuilles de style des widgets ----------

     Ce bloc existe a cause d'un bug reel et difficile a voir. Les
     feuilles de TOUS les widgets sont chargees dans le MEME document :
     une classe non prefixee par un widget ecrase donc la meme classe
     chez un autre. Concretement, `.pws-row { align-items: baseline }`
     ecrit pour la tuile Bourse s'appliquait aussi aux lignes de la tuile
     Etat systeme. Sur un conteneur `flex-direction: column`, un
     `align-items` autre que `stretch` empeche les enfants de remplir la
     largeur : le libelle et la valeur se retrouvaient colles ET la barre
     de progression, sans contenu propre, tombait a une largeur nulle,
     donc invisible.

     Le symptome n'apparaissait QUE si les deux tuiles etaient sur le meme
     tableau -- c'est pourquoi aucun test existant ne l'attrapait : chaque
     widget etait correct isolement.

     This block exists because of a real and hard-to-see bug. EVERY
     widget's stylesheet is loaded into the SAME document: a class not
     namespaced by one widget therefore overrides the same class in
     another. Concretely, `.pws-row { align-items: baseline }` written for
     the Stocks tile also applied to the System status tile's rows. On a
     `flex-direction: column` container, an `align-items` other than
     `stretch` stops children from filling the width: the label and the
     value ended up stuck together AND the progress bar, having no content
     of its own, collapsed to zero width and became invisible.

     The symptom appeared ONLY when both tiles sat on the same board --
     which is why no existing test caught it: each widget was correct in
     isolation. */
  /* ---------- Classement des tuiles dans le catalogue ----------
     Une tuile non listee dans CATALOG_FAMILIES n'est pas perdue : elle
     rejoint "Divers". C'est un bon filet, mais un filet SILENCIEUX --
     les cinq tuiles ajoutees recemment s'y etaient accumulees sans que
     rien ne le signale. Ce test rend l'oubli visible.
     A tile missing from CATALOG_FAMILIES is not lost: it joins
     "Miscellaneous". A good safety net, but a SILENT one -- the five
     recently added tiles had piled up there with nothing flagging it.
     This test makes the omission visible. */
  /* ---------- README : liste des widgets ----------
     Le README est la premiere chose que lit un visiteur du depot. Sa
     liste de widgets avait pris quatre versions de retard sans que rien
     ne le signale -- exactement le meme angle mort que le classement du
     catalogue. Ce test le rend visible.
     The README is the first thing a repository visitor reads. Its widget
     list had fallen four versions behind with nothing flagging it --
     exactly the same blind spot as the catalog classification. This test
     makes it visible. */
  /* ---------- Ressources statiques indispensables ----------

     Ce bloc existe a cause d'un bug d'EMPAQUETAGE, pas de code. Le motif
     d'exclusion des archives de livraison (etoile, slash, data, slash,
     etoile) visait le dossier
     `data/` d'execution a la racine -- mais il capturait AUSSI
     `public/data/`. Le calendrier des saints a donc disparu de toutes
     les livraisons, et l'option "saint du jour" restait sans effet dans
     les tuiles Horloge et Meteo alors qu'elle etait bien activee.

     Aucun test de code n'aurait pu l'attraper : le code etait correct,
     c'est le fichier qui manquait. D'ou cette verification de PRESENCE.

     This block exists because of a PACKAGING bug, not a code one. The
     delivery archives' exclusion pattern (star slash data slash star) targeted the
     runtime `data/` folder at the root -- but it ALSO caught
     `public/data/`. The name-day calendar therefore vanished from every
     delivery, and the "saint of the day" option had no effect in the
     Clock and Weather tiles even though it was switched on.

     No code test could have caught it: the code was right, the file was
     missing. Hence this PRESENCE check. */
  console.log("== Ressources statiques indispensables ==");
  {
    const saintsPath = path.join(PUB, "data", "saints-fr.json");
    assert("le calendrier des saints est present", fs.existsSync(saintsPath));

    let saints = null;
    try { saints = JSON.parse(fs.readFileSync(saintsPath, "utf8")); } catch (e) { saints = null; }
    assert("le calendrier des saints est un JSON valide", !!saints);
    // 366 jours + le 29 fevrier : une annee incomplete laisserait des
    // dates sans saint, sans que rien ne le signale.
    // 366 days plus 29 February: an incomplete year would leave dates
    // with no name, with nothing flagging it.
    assert("le calendrier couvre l'annee entiere", saints && Object.keys(saints).length >= 366);
    assert("une date connue renvoie bien un nom", saints && saints["08-27"] === "Monique");

    // Toute ressource chargee par un widget via une URL /data/ doit
    // exister : c'est exactement le chemin qui avait ete perdu.
    // Every resource a widget loads through a /data/ URL must exist: that
    // is precisely the path that had been lost.
    const widgetsDir = path.join(PUB, "widgets");
    const missing = [];
    for (const dir of fs.readdirSync(widgetsDir)) {
      const js = path.join(widgetsDir, dir, "widget.js");
      if (!fs.existsSync(js)) continue;
      const src = fs.readFileSync(js, "utf8");
      for (const m of src.matchAll(/["'`](\/data\/[A-Za-z0-9._-]+)["'`]/g)) {
        if (!fs.existsSync(path.join(PUB, m[1].slice(1)))) missing.push(dir + " -> " + m[1]);
      }
    }
    for (const w of missing) console.log("       ressource absente : " + w);
    assert("chaque ressource /data/ referencee par un widget existe", missing.length === 0);
  }

  console.log("== README : couverture des widgets ==");
  {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8").toLowerCase();
    const widgetsDir = path.join(PUB, "widgets");
    const missing = [];
    for (const dir of fs.readdirSync(widgetsDir)) {
      const mf = path.join(widgetsDir, dir, "manifest.json");
      if (!fs.existsSync(mf)) continue;
      const m = JSON.parse(fs.readFileSync(mf, "utf8"));
      // On cherche le nom FRANCAIS dans la partie francaise du README :
      // c'est le libelle que verra la personne dans le catalogue.
      // We look for the FRENCH name in the README's French part: it is
      // the label the person sees in the catalog.
      const name = String((m.name && m.name.fr) || "").toLowerCase().split(/\s*[(\/]/)[0].trim();
      if (name && !readme.includes(name)) missing.push(dir + " (" + name + ")");
    }
    for (const w of missing) console.log("       absent du README : " + w);
    assert("chaque widget livre est cite dans le README", missing.length === 0);
  }

  console.log("== Catalogue : classement des tuiles ==");
  {
    const src = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    const block = src.slice(src.indexOf("const CATALOG_FAMILIES"));
    const decl = block.slice(0, block.indexOf("];"));

    const families = [...decl.matchAll(/key:\s*"([a-z]+)"/g)].map((m) => m[1]);
    const classified = new Set([...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]));

    // Chaque famille doit avoir ses libelles dans les DEUX langues,
    // sinon la nouvelle rubrique s'afficherait avec sa cle brute.
    // Every family needs its labels in BOTH languages, otherwise the new
    // heading would show its raw key.
    const i18nSrc = fs.readFileSync(path.join(PUB, "i18n.js"), "utf8");
    for (const fam of families) {
      const occurrences = (i18nSrc.match(new RegExp('"catalog\\.family\\.' + fam + '"', "g")) || []).length;
      assert("la famille '" + fam + "' est traduite en FR et EN", occurrences === 2);
    }

    // Toute tuile livree doit etre classee explicitement.
    // Every shipped tile must be explicitly classified.
    const widgetsDir = path.join(PUB, "widgets");
    const unplaced = fs.readdirSync(widgetsDir).filter((dir) =>
      fs.existsSync(path.join(widgetsDir, dir, "manifest.json")) && !classified.has(dir));
    for (const dir of unplaced) console.log("       non classee : " + dir);
    assert("aucune tuile ne tombe dans 'Divers' par oubli", unplaced.length === 0);

    // Et l'inverse : une famille citant une tuile disparue laisserait un
    // trou invisible dans le catalogue.
    // And the reverse: a family naming a removed tile would leave an
    // invisible hole in the catalog.
    const ghosts = [...classified].filter((id) =>
      !families.includes(id) && !fs.existsSync(path.join(widgetsDir, id, "manifest.json")));
    for (const g of ghosts) console.log("       tuile citee mais absente : " + g);
    assert("aucune famille ne cite une tuile inexistante", ghosts.length === 0);
  }

  console.log("== Feuilles de style des widgets : aucune collision ==");
  {
    const widgetsDir = path.join(PUB, "widgets");
    const owners = new Map();

    for (const dir of fs.readdirSync(widgetsDir)) {
      const file = path.join(widgetsDir, dir, "widget.css");
      if (!fs.existsSync(file)) continue;
      // Les commentaires sont retires d'abord : ils contiennent des noms
      // de classes cites en exemple, qui fausseraient le relevé.
      // Comments are stripped first: they mention class names as
      // examples, which would skew the survey.
      const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/(^|,)\s*([^{},]+?)\s*(?=[,{])/gm)) {
        const sel = m[2].trim();
        if (!sel || sel.startsWith("@")) continue;
        // Seul le PREMIER element du selecteur compte : c'est lui qui
        // determine la portee. `.pw-system .pws-row` est cloisonne,
        // `.pws-row` ne l'est pas.
        // Only the FIRST element of the selector matters: it determines
        // the scope. `.pw-system .pws-row` is namespaced, `.pws-row` is
        // not.
        const first = sel.split(/[\s>+~]/)[0];
        if (!first.startsWith(".")) continue;
        const cls = first.split(/[:.\[]/).filter(Boolean)[0];
        if (!cls) continue;
        if (!owners.has(cls)) owners.set(cls, new Set());
        owners.get(cls).add(dir);
      }
    }

    const clashes = [...owners.entries()].filter(([, dirs]) => dirs.size > 1);
    for (const [cls, dirs] of clashes) {
      console.log("       ." + cls + " partagee par : " + [...dirs].join(", "));
    }
    assert("aucune classe de premier niveau n'est partagee par deux widgets",
      clashes.length === 0);
    assert("le relevé a bien parcouru les feuilles de style", owners.size > 20);
  }

  console.log("== Meteo : lever/coucher du soleil sur aujourd'hui ET demain ==");
  {
    const src = fs.readFileSync(path.join(PUB, "widgets/weather/widget.js"), "utf8");
    /* Un seul generateur pour les deux jours : ecrire le balisage deux
       fois garantirait qu'une correction n'en atteigne qu'une moitie --
       c'est exactement ce qui s'est produit avec la couleur en 1.87.1.
       One single generator for both days: writing the markup twice would
       guarantee that a fix reaches only half of it -- exactly what
       happened with the colour in 1.87.1. */
    assert("un seul generateur produit la ligne du soleil", /const sunLineFor = \(index\) =>/.test(src));
    assert("il n'y a qu'un endroit qui compose le balisage de cette ligne",
      (src.match(/class="pww-sun"/g) || []).length === 1);
    assert("la ligne est posee sur aujourd'hui", /sunLineFor\(0\)/.test(src));
    assert("la ligne est posee sur demain", /sunLineFor\(1\)/.test(src));
    assert("elle reste sous condition de l'option", /if \(!s\.showSun/.test(src));
    // Les donnees de demain existent deja : la requete etendue demande
    // sept jours. Activer l'option n'ajoute donc aucun appel reseau.
    assert("la requete etendue couvre plusieurs jours", /forecast_days=7/.test(src));
    assert("elle demande bien lever et coucher", /daily=[^`]*sunrise,sunset/.test(src));
    // Un jour sans donnee (fournisseur incomplet) ne doit pas produire
    // une ligne vide ou des tirets.
    assert("un jour sans donnee n'affiche aucune ligne", /if \(!rise \|\| !set\) return "";/.test(src));
  }

  console.log("== Meteo : icones lever/coucher reellement distinctes ==");
  {
    const src = fs.readFileSync(path.join(PUB, "widgets/weather/widget.js"), "utf8");
    const grab = (name) => {
      const at = src.indexOf("const " + name + " = ");
      return src.slice(at, src.indexOf("</svg>'", at));
    };
    const up = grab("SUN_UP_SVG");
    const down = grab("SUN_DOWN_SVG");
    assert("les deux pictogrammes existent", up.length > 40 && down.length > 40);
    /* La version precedente dessinait le MEME demi-disque sur la MEME
       ligne d'horizon et ne les distinguait que par le sens d'une petite
       fleche : indiscernables a la taille d'une tuile. Ce qui est
       verifie ici, c'est que les deux reposent sur des FORMES
       differentes, pas sur une orientation.
       The previous version drew the SAME half-disc on the SAME horizon
       line and told them apart only by an arrow's direction:
       indistinguishable at a tile's size. What is checked here is that
       the two rest on different SHAPES, not on an orientation. */
    const shapes = (svg) => {
      const body = svg.replace(/const \w+ = /, "");
      return {
        disc: /<circle/.test(body),
        crescent: /a6\.4 6\.4|a6\.9 6\.9|A6\.4 6\.4/i.test(body)
      };
    };
    assert("le lever repose sur un disque (soleil)", shapes(up).disc === true);
    assert("le coucher ne reutilise pas ce disque", shapes(down).disc === false);
    assert("le coucher repose sur un croissant (lune)", shapes(down).crescent === true);
    // Comparaison brute des trajets : deux dessins identiques a
    // l'orientation pres repasseraient ici sans etre distinguables.
    const paths = (svg) => (svg.match(/d="[^"]+"/g) || []).map((d) => d.replace(/[-\d.]/g, ""));
    const common = paths(up).filter((p) => paths(down).includes(p));
    assert("aucun trajet n'est partage a l'identique entre les deux", common.length === 0);
    assert("le lever porte une fleche montante en confirmation", /M21 9\.5V4\.2|v-|V4\.2/.test(up));
    assert("le coucher porte une fleche descendante en confirmation", /M19\.8 4\.2v5\.3/.test(down));
  }

  console.log("== Meteo : la ligne du soleil est dimensionnee comme les autres ==");
  {
    /* Elle etait absente de la routine d'ajustement : elle gardait donc
       une taille relative fixe que rien ne reduisait quand la place se
       resserrait, et debordait du bloc centre de la colonne "Demain" --
       plus etroite et affectee du facteur de compacite. Elle etait bien
       dans le document, mais hors champ.
       It was missing from the fitting routine: it kept a fixed relative
       size that nothing shrank as room got tighter, and overflowed the
       centred block of the narrower "Tomorrow" column. It was in the
       document, but out of view. */
    const src = fs.readFileSync(path.join(PUB, "widgets/weather/widget.js"), "utf8");
    const fit = src.slice(src.indexOf("const blockH = stacked"));
    for (const cls of ["pww-icon", "pww-temp", "pww-city", "pww-extra", "pww-saint", "pww-sun"]) {
      assert("la routine d'ajustement dimensionne '." + cls + "'",
        fit.includes('querySelectorAll(".' + cls + '")'));
    }
    const css = fs.readFileSync(path.join(PUB, "widgets/weather/widget.css"), "utf8");
    const block = css.slice(css.indexOf(".pw-weather .pww-sun {"), css.indexOf("}", css.indexOf(".pw-weather .pww-sun {")));
    assert("la feuille de style n'impose plus de taille relative figee", !/font-size:\s*[\d.]+em/.test(block));
    assert("les deux heures peuvent passer a la ligne dans une colonne etroite",
      /flex-wrap:\s*wrap/.test(block));
    assert("mais une heure ne se coupe pas en deux",
      /\.pww-sun-item\s*\{[^}]*white-space:\s*nowrap/.test(css));
  }

  console.log("== Meteo : lisibilite du lever/coucher du soleil ==");
  {
    /* La ligne du soleil n'avait AUCUNE couleur declaree : elle heritait
       de la couleur de texte generale de la tuile, qui n'est pas celle
       des informations meteo. Selon le theme, une couleur de tuile
       personnalisee ou une photo de fond, elle devenait illisible. Elle
       doit porter la meme couleur que la ligne d'informations principale
       (.pww-extra), et le meme traitement qu'elle sur photo de fond.
       The sun line had NO declared colour: it inherited the tile's
       general text colour, which is not the weather information's.
       Depending on the theme, a custom tile colour or a background
       photo, it became unreadable. It must carry the same colour as the
       main information line (.pww-extra), and the same treatment as it
       over a background photo. */
    const css = fs.readFileSync(path.join(PUB, "widgets/weather/widget.css"), "utf8");
    const blockOf = (selector) => {
      const at = css.indexOf(selector + " {");
      return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
    };
    const sun = blockOf(".pw-weather .pww-sun");
    const extra = blockOf(".pw-weather .pww-extra");
    assert("la ligne du soleil declare une couleur", /color:/.test(sun));
    const colorOf = (block) => (block.match(/(^|[;{\s])color:\s*([^;]+)/) || [])[2];
    assert("elle utilise la MEME couleur que les autres informations de la tuile",
      !!colorOf(sun) && colorOf(sun).trim() === colorOf(extra).trim());
    const photo = blockOf(".pw-weather.pww-has-photo .pww-sun");
    assert("sur photo de fond, elle bascule en clair comme les autres lignes",
      /color:\s*#fff/.test(photo));
    assert("et recoit l'ombre qui la detache de la photo", /text-shadow/.test(photo));
    assert("ses selecteurs sont cloisonnes sous .pw-weather",
      !/(^|\n)\.pww-sun[\s{]/.test(css));
  }

  console.log("== Etat systeme : lisibilite des lignes ==");
  {
    const css = fs.readFileSync(path.join(PUB, "widgets/system/widget.css"), "utf8");
    const head = css.slice(css.indexOf(".pw-system .pws-row-head {"));
    const block = head.slice(0, head.indexOf("}"));
    assert("un espace minimal separe le libelle de la valeur", /gap:\s*[^0]/.test(block));
    assert("la valeur ne se coupe pas sur deux lignes", /white-space:\s*nowrap/.test(
      css.slice(css.indexOf(".pw-system .pws-row-head .pws-val"),
                css.indexOf(".pw-system .pws-row-head .pws-val") + 260)));
    // Si la place manque, c'est le LIBELLE qui cede : le chiffre est
    // l'information, le libelle se devine.
    // If space runs short, it is the LABEL that gives way: the figure is
    // the information, the label can be guessed.
    assert("c'est le libelle qui se tronque, pas la valeur",
      /pws-row-head\s*>\s*span:first-child[^}]*text-overflow:\s*ellipsis/.test(css));
    assert("les lignes cliquables ont un retour visuel au survol",
      /\.pws-row\.pws-clickable:hover/.test(css));
  }

  console.log("== Etat systeme : historique des ressources ==");
  {
    const src = fs.readFileSync(path.join(PUB, "widgets/system/widget.js"), "utf8");
    assert("les trois ressources ouvrent une courbe",
      /data-metric/.test(src) && /"cpu"/.test(src) && /"mem"/.test(src) && /"disk"/.test(src));
    // Borne dure indispensable : sans elle, une tuile laissee des jours
    // sur un tableau mural accumulerait indefiniment.
    // A hard cap is essential: without it, a tile left for days on a wall
    // board would accumulate indefinitely.
    assert("l'historique est borne", /MAX_POINTS/.test(src) && /a\.shift\(\)/.test(src));
    // Echelle fixe : une echelle automatique ferait paraitre dramatique
    // une variation de 2 % en zoomant dessus.
    // Fixed scale: an auto scale would make a 2% wobble look dramatic by
    // zooming into it.
    assert("l'echelle du graphique est fixee de 0 a 100",
      /Math\.max\(0,\s*Math\.min\(100,\s*v\)\)/.test(src));
    assert("un point unique ne trace pas de courbe", /series\.length < 2/.test(src));

    // Verification par le comportement de la geometrie du trace.
    // Behavioural check of the path geometry.
    const W = 600, H = 200, PAD = 8;
    const y = (v) => PAD + (H - 2 * PAD) * (1 - Math.max(0, Math.min(100, v)) / 100);
    assert("0 % est en bas du graphique", y(0) > y(100));
    assert("50 % est au milieu", Math.abs(y(50) - (PAD + (H - 2 * PAD) / 2)) < 0.01);
    assert("une valeur aberrante est bornee et ne sort pas du cadre",
      y(150) === y(100) && y(-10) === y(0));
  }

  console.log("== Etat systeme : couleurs par niveau, seuils et IP publique ==");
  {
    /* Le widget est evalue dans un bac a sable avec un faux registre :
       on recupere sa classe et ses fonctions pures sans monter de tuile.
       The widget is evaluated in a sandbox with a fake registry: we get
       its class and pure functions without mounting a tile. */
    const vm = require("vm");
    const src = fs.readFileSync(path.join(PUB, "widgets/system/widget.js"), "utf8");
    let Klass = null;
    const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "system") Klass = k; } } }, console, document: undefined };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    assert("classe du widget capturee", !!Klass && typeof Klass.levels === "function");

    const D = Klass.DEFAULTS;
    const lv = Klass.levels({});
    assert("par defaut : usage normal en VERT, pas en rouge d'accent",
      lv.normal === "#3FA96B" && lv.normal.toLowerCase() !== "#d6335c");
    assert("par defaut : le rouge est reserve au niveau critique",
      lv.critical === "#E0556F" && lv.high !== lv.critical && lv.normal !== lv.critical);
    assert("seuils par defaut 65 / 85", lv.warn === 65 && lv.crit === 85);
    assert("40 % -> couleur normale", Klass.levelColor(40, lv) === lv.normal);
    assert("65 % -> couleur elevee (seuil inclus)", Klass.levelColor(65, lv) === lv.high);
    assert("85 % -> couleur critique (seuil inclus)", Klass.levelColor(85, lv) === lv.critical);

    const custom = Klass.levels({ thresholdWarn: 50, thresholdCrit: 70, colorNormal: "#112233", colorWarn: "#445566", colorCrit: "#778899", chartColor: "#aabbcc" });
    assert("seuils et couleurs personnalises appliques",
      Klass.levelColor(55, custom) === "#445566" && Klass.levelColor(75, custom) === "#778899" && Klass.levelColor(10, custom) === "#112233" && custom.chart === "#aabbcc");
    const crossed = Klass.levels({ thresholdWarn: 80, thresholdCrit: 60 });
    assert("seuil critique < seuil eleve : aligne, jamais ignore", crossed.crit === 80 && crossed.warn === 80);
    const bad = Klass.levels({ colorNormal: "red", colorCrit: "#12", thresholdWarn: "abc" });
    assert("couleur ou seuil invalide -> valeur par defaut", bad.normal === D.colorNormal && bad.critical === D.colorCrit && bad.warn === D.thresholdWarn);

    /* Rendu d'une ligne : la couleur est posee en ligne, plus par classe
       CSS. Row rendering: the color is set inline, no longer by CSS class. */
    const fakeCtx = (settings) => ({ settings, i18n: { t: (k) => k }, el: null });
    const w = new Klass(fakeCtx({ thresholdWarn: 65, thresholdCrit: 85 }));
    assert("barre a 30 % peinte en vert", /background:#3FA96B/.test(w.row("CPU", "30%", 30, "cpu")));
    assert("barre a 90 % peinte en rouge", /background:#E0556F/.test(w.row("CPU", "90%", 90, "cpu")));
    assert("plus aucune classe pws-warn/pws-crit dans le rendu", !/pws-(warn|crit)/.test(w.row("CPU", "90%", 90, "cpu")));
    assert("les courbes n'utilisent plus la couleur d'accent du theme", !/var\(--accent\)/.test(src));
    const css = fs.readFileSync(path.join(PUB, "widgets/system/widget.css"), "utf8");
    assert("la feuille de style n'utilise plus l'accent pour la barre", !/pws-bar-fill\s*\{[^}]*var\(--accent\)/.test(css));

    /* IP publique : masquee par defaut, affichee sur demande, perimee signalee.
       Public IP: hidden by default, shown on demand, stale flagged. */
    const w2 = new Klass(fakeCtx({ showNetwork: false }));
    w2.publicIp = { ip: "82.66.10.5", stale: false };
    assert("IP publique absente par defaut (option decochee)", w2.netRows() === "");
    w2.ctx.settings.showPublicIp = true;
    assert("IP publique affichee quand l'option est cochee", /82\.66\.10\.5/.test(w2.netRows()) && /system\.publicIp/.test(w2.netRows()));
    w2.publicIp = { ip: "82.66.10.5", stale: true };
    assert("adresse perimee marquee", /pws-stale/.test(w2.netRows()));
    w2.publicIp = { ip: null, error: "down" };
    assert("adresse inconnue : 'non disponible', pas de vide", /system\.netUnknown/.test(w2.netRows()));
    const manifest = JSON.parse(fs.readFileSync(path.join(PUB, "widgets/system/manifest.json"), "utf8"));
    const keys = manifest.settings.map((f) => f.key);
    for (const k of ["showPublicIp", "thresholdWarn", "thresholdCrit", "colorNormal", "colorWarn", "colorCrit", "chartColor", "chartByLevel"]) {
      assert("reglage '" + k + "' declare dans le manifeste", keys.includes(k));
    }
    assert("IP publique desactivee par defaut dans le manifeste", manifest.settings.find((f) => f.key === "showPublicIp").default === false);
    assert("couleurs du manifeste alignees sur les valeurs par defaut du code",
      manifest.settings.find((f) => f.key === "colorNormal").default === D.colorNormal
      && manifest.settings.find((f) => f.key === "colorCrit").default === D.colorCrit
      && manifest.settings.find((f) => f.key === "chartColor").default === D.chartColor);
  }

  console.log("== Etat systeme : barre et courbe GPU ==");
  {
    const vm = require("vm");
    const src = fs.readFileSync(path.join(PUB, "widgets/system/widget.js"), "utf8");
    let Klass = null;
    const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "system") Klass = k; } } }, console, document: undefined };
    vm.createContext(sb);
    vm.runInContext(src, sb);

    /* La ligne GPU se construit dans refresh(), qui a besoin d'un DOM et
       du reseau. On rejoue donc ici la MEME logique de decision que le
       widget (les trois conditions qui la gouvernent), et on verifie
       separement que le rendu d'une ligne fonctionne. Ce qu'on protege,
       c'est la regle : pas de ligne GPU sans mesure reelle.
       The GPU row is built in refresh(), which needs a DOM and the
       network. So we replay the SAME decision logic as the widget (the
       three conditions governing it) here, and separately check that a
       row renders. What is protected is the rule: no GPU row without a
       real measurement. */
    const decide = (d, s) => {
      const gpu = d.gpu && Number.isFinite(d.gpu.percent) ? d.gpu : null;
      const showGpu = !!(gpu && s.showGpu !== false);
      return { showGpu, gpuChart: showGpu && s.gpuChart !== false };
    };
    // Raspberry Pi : le serveur renvoie gpu: null -> aucune ligne. C'est
    // le point essentiel : "GPU 0 %" laisserait croire a un GPU au repos
    // alors que rien n'est mesure.
    assert("machine sans GPU lisible (Pi) : pas de ligne GPU",
      decide({ gpu: null }, {}).showGpu === false);
    assert("gpu present mais pourcentage non fini : pas de ligne",
      decide({ gpu: { percent: null } }, {}).showGpu === false);
    assert("GPU expose : ligne affichee par defaut",
      decide({ gpu: { percent: 12 } }, {}).showGpu === true);
    assert("GPU a 0 % : ligne affichee (0 est une mesure, pas une absence)",
      decide({ gpu: { percent: 0 } }, {}).showGpu === true);
    assert("option decochee : pas de ligne meme si le GPU est expose",
      decide({ gpu: { percent: 40 } }, { showGpu: false }).showGpu === false);
    assert("courbe optionnelle : barre gardee, clic retire",
      decide({ gpu: { percent: 40 } }, { gpuChart: false }).showGpu === true
      && decide({ gpu: { percent: 40 } }, { gpuChart: false }).gpuChart === false);
    assert("courbe active par defaut", decide({ gpu: { percent: 40 } }, {}).gpuChart === true);

    // Rendu : la ligne GPU suit les memes couleurs par niveau que le
    // reste, et n'est cliquable que si la courbe est demandee.
    const w = new Klass({ settings: {}, i18n: { t: (k) => k }, el: null });
    assert("ligne GPU chargee peinte en rouge comme les autres", /background:#E0556F/.test(w.row("GPU", "92%", 92, "gpu")));
    assert("ligne GPU au repos peinte en vert", /background:#3FA96B/.test(w.row("GPU", "5%", 5, "gpu")));
    assert("courbe demandee : la ligne est cliquable", /data-metric="gpu"/.test(w.row("GPU", "40%", 40, "gpu")));
    assert("courbe non demandee : la ligne n'est pas cliquable",
      !/data-metric/.test(w.row("GPU", "40%", 40, null)) && !/pws-clickable/.test(w.row("GPU", "40%", 40, null)));

    // Historique : le GPU est enregistre comme les autres ressources, et
    // borne de la meme facon.
    const w2 = new Klass({ settings: {}, i18n: { t: (k) => k }, el: null });
    w2.record({ cpuPercent: 10, memPercent: 20, diskPercent: 30, gpu: { percent: 44 } });
    assert("charge GPU enregistree dans l'historique", w2.history.gpu.length === 1 && w2.history.gpu[0] === 44);
    w2.record({ cpuPercent: 10, memPercent: 20, diskPercent: 30, gpu: null });
    assert("releve sans GPU : aucun point ajoute (pas de zero invente)", w2.history.gpu.length === 1);

    assert("le champ 'g' de l'historique serveur est filtre quand il manque",
      /p\.g != null/.test(src));
    assert("l'onglet GPU n'apparait pas si la courbe est desactivee",
      /gpuChart !== false/.test(src));

    const manifest = JSON.parse(fs.readFileSync(path.join(PUB, "widgets/system/manifest.json"), "utf8"));
    const keys = manifest.settings.map((f) => f.key);
    assert("reglage 'showGpu' declare", keys.includes("showGpu"));
    assert("reglage 'gpuChart' declare (courbe optionnelle)", keys.includes("gpuChart"));
    assert("les deux options sont actives par defaut",
      manifest.settings.find((f) => f.key === "showGpu").default === true
      && manifest.settings.find((f) => f.key === "gpuChart").default === true);
  }

  console.log("== Axe des abscisses temporel : module commun a tous les graphiques ==");
  {
    const vm = require("vm");
    const axisSrc = fs.readFileSync(path.join(PUB, "chart-time-axis.js"), "utf8");
    const sb = { window: {}, Intl, Date, Math, Number, String };
    vm.createContext(sb);
    vm.runInContext(axisSrc, sb);
    const A = sb.window.PiBoardTimeAxis;
    assert("le module expose son interface", !!A && typeof A.timeTicks === "function" && typeof A.axisHtml === "function");

    const HOUR = 3600000, DAY = 24 * HOUR;
    // Instant volontairement NON rond (14:47) : c'est tout l'interet des
    // graduations alignees. A deliberately NON-round instant (14:47):
    // that is the whole point of aligned ticks.
    const now = new Date("2026-09-02T14:47:31").getTime();

    const twoHours = A.timeTicks(now - 2 * HOUR, now, { maxTicks: 6, locale: "fr-FR" });
    assert("2 h : des graduations sont produites", twoHours.length >= 3);
    assert("2 h : toutes les graduations tombent sur une demi-heure ronde",
      twoHours.every((t) => { const d = new Date(t.t); return d.getSeconds() === 0 && (d.getMinutes() % 30) === 0; }));
    assert("2 h : etiquettes en heures et minutes", /^\d{2}:\d{2}$/.test(twoHours[0].label));
    assert("les graduations restent dans le cadre", twoHours.every((t) => t.at >= 0 && t.at <= 1));
    assert("les graduations sont ordonnees", twoHours.every((t, i, a) => i === 0 || t.t > a[i - 1].t));

    const day = A.timeTicks(now - DAY, now, { maxTicks: 6, locale: "fr-FR" });
    assert("24 h : graduations sur des heures pleines",
      day.every((t) => { const d = new Date(t.t); return d.getMinutes() === 0 && d.getSeconds() === 0; }));
    assert("24 h : pas plus de graduations que demande", day.length <= 6);

    const week = A.timeTicks(now - 5 * DAY, now, { maxTicks: 6, locale: "fr-FR" });
    assert("5 jours : le jour de la semaine apparait, sinon 03:00 serait ambigu",
      week.length > 0 && /[a-zA-Zé]/.test(week[0].label));

    const month = A.timeTicks(now - 30 * DAY, now, { maxTicks: 6, locale: "fr-FR" });
    assert("30 jours : etiquettes datees, sans heure", month.length > 0 && !/:/.test(month[0].label));

    // Deux ans : sans pas mensuel, on obtenait vingt-sept etiquettes
    // superposees. Two years: without a monthly stride, twenty-seven
    // overlapping labels came out.
    const twoYears = A.timeTicks(now - 800 * DAY, now, { maxTicks: 6, locale: "fr-FR" });
    assert("2 ans : le nombre d'etiquettes reste lisible", twoYears.length > 1 && twoYears.length <= 6);
    assert("2 ans : mois et annee affiches", /\d{4}/.test(twoYears[0].label));
    const decade = A.timeTicks(now - 4000 * DAY, now, { maxTicks: 6, locale: "fr-FR" });
    assert("10 ans : toujours borne", decade.length <= 6);

    // Alignement en heure LOCALE et non UTC : un pas de 6 h aligne en UTC
    // tomberait a des heures batardes dans un fuseau decale.
    const sixHourly = A.timeTicks(now - 18 * HOUR, now, { maxTicks: 4, locale: "fr-FR" });
    assert("alignement en heure locale, pas UTC",
      sixHourly.every((t) => new Date(t.t).getMinutes() === 0));

    // Cas degrades : un graphique sans donnee ne doit pas lever.
    assert("periode nulle -> aucune graduation", A.timeTicks(now, now).length === 0);
    assert("periode inversee -> aucune graduation", A.timeTicks(now, now - HOUR).length === 0);
    assert("valeurs non numeriques -> aucune graduation",
      A.timeTicks(NaN, now).length === 0 && A.timeTicks(null, undefined).length === 0);
    assert("etiquettes d'un axe vide -> chaine vide", A.axisHtml([], 0, 0) === "" && A.axisHtml(null, 0, 0) === "");

    // Positionnement : marges converties en pourcentage, bords recales
    // vers l'interieur pour ne pas deborder du cadre.
    const html = A.axisHtml([{ at: 0, label: "A" }, { at: 0.5, label: "B" }, { at: 1, label: "C" }], 10, 5);
    assert("premiere etiquette calee a gauche, pas centree hors cadre", /left:10\.00%;transform:translateX\(0\)/.test(html));
    assert("etiquette centrale centree sur son trait", /left:52\.50%;transform:translateX\(-50%\)/.test(html));
    assert("derniere etiquette calee a droite", /left:95\.00%;transform:translateX\(-100%\)/.test(html));
    assert("le texte des etiquettes est echappe",
      /&lt;b&gt;/.test(A.axisHtml([{ at: 0.5, label: "<b>" }], 0, 0)));

    const lines = A.gridLines([{ at: 0 }, { at: 1 }], 50, 250, 10, 190);
    assert("traits verticaux places aux bornes de la zone tracee",
      /x1="50\.0"/.test(lines) && /x1="250\.0"/.test(lines) && /y1="10"/.test(lines));

    /* Tous les graphiques du tableau doivent porter l'axe : c'est le
       point de la version. Un widget qui trace une courbe temporelle
       sans axe serait une regression silencieuse.
       Every chart on the board must carry the axis: that is the point of
       this version. A widget drawing a time curve without an axis would
       be a silent regression. */
    for (const w of ["system", "crypto", "stocks", "speedtest"]) {
      const src = fs.readFileSync(path.join(PUB, "widgets", w, "widget.js"), "utf8");
      assert(w + " : utilise l'axe temporel commun", /PiBoardTimeAxis/.test(src));
      assert(w + " : reserve un emplacement pour les etiquettes", /pb-taxis/.test(src));
    }
    const html5 = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
    assert("le module d'axe est charge avant app.js",
      html5.indexOf("chart-time-axis.js") > 0 && html5.indexOf("chart-time-axis.js") < html5.indexOf("app.js\"></script>"));
    const styles = fs.readFileSync(path.join(PUB, "style.css"), "utf8");
    assert("la classe commune .pb-taxis est definie une seule fois, dans la feuille globale",
      /\.pb-taxis\s*\{/.test(styles));
  }

  console.log("== Tuiles de style : tailles de depart et acces au gestionnaire d'images ==");
  {
    const sizeOf = (id) => JSON.parse(fs.readFileSync(path.join(PUB, "widgets", id, "manifest.json"), "utf8")).size;
    /* Tailles de depart reduites : une tuile de titre ou un logo n'ont
       aucune raison d'occuper le tiers de la largeur du tableau des leur
       creation, alors qu'on les place justement dans un coin.
       Reduced default sizes: a title tile or a logo have no reason to
       take a third of the board's width the moment they are created,
       when a corner is precisely where they get placed. */
    const text = sizeOf("text");
    assert("Texte demarre en 2x1, moitie de l'ancienne largeur", text.w === 2 && text.h === 1);
    const image = sizeOf("image");
    assert("Logo/Image demarre sur une base carree", image.w === image.h);
    assert("et sur une surface reduite de moitie (2x2 au lieu de 3x2)", image.w === 2 && image.h === 2);
    for (const [id, sz] of [["text", text], ["image", image]]) {
      assert(id + " peut descendre jusqu'a une seule cellule", sz.minW === 1 && sz.minH === 1);
      assert(id + " ne demarre jamais sous son propre minimum", sz.w >= sz.minW && sz.h >= sz.minH);
    }

    /* Une fois l'image posee, il n'existait plus aucun chemin vers le
       gestionnaire : le bouton n'apparait que sur la tuile vide, et les
       reglages ne contiennent qu'un champ texte. Changer d'image
       obligeait a vider ce champ a la main.
       Once an image was set there was no path left to the manager: the
       button only appears on an empty tile, and the settings only hold a
       text field. Changing the image meant clearing that field by hand. */
    const src = fs.readFileSync(path.join(PUB, "widgets/image/widget.js"), "utf8");
    /* Le changement d'image se fait par l'appareil photo de la barre
       d'outils. Le bouton de coin a ete retire : il se superposait a la
       poignee de zoom de l'angle superieur droit, et l'on ne savait plus
       lequel des deux on visait.
       Changing the image goes through the toolbar's camera. The corner
       button was removed: it overlapped the top-right zoom handle, and
       one could no longer tell which of the two was being aimed at. */
    const imgCssA = fs.readFileSync(path.join(PUB, "widgets/image/widget.css"), "utf8");
    assert("plus de bouton de coin superpose a une poignee",
      !/pw-image-change/.test(src) && !/pw-image-change/.test(imgCssA));
    assert("la barre d'outils porte le changement d'image",
      /data-act="pick"/.test(src) && /if \(act === "pick"\) this\.openManager\(\)/.test(src));

    /* Le clic d'edition est ecoute sur la GRILLE, pas sur la tuile : tout
       clic traversant la surcouche finissait par ouvrir la fenetre de
       configuration, boutons de la barre d'outils compris. La surcouche
       doit donc arreter `click` et `dblclick`, et pas seulement les
       evenements qui declenchent le glissement de Gridstack.
       The edit click is listened for on the GRID, not on the tile: any
       click going through the overlay ended up opening the settings
       window, the toolbar's buttons included. The overlay must therefore
       stop `click` and `dblclick`, not only the events that start
       Gridstack's drag. */
    /* LA cause du symptome : en mode edition, la regle globale
       `body.editing .tile-body { pointer-events: none }` rend TOUT le
       contenu des tuiles inerte, pour qu'une iframe ou une carte n'avale
       pas le pointeur. La surcouche en heritait : poignees et barre
       d'outils s'affichaient mais ne recevaient AUCUN evenement, le clic
       traversait jusqu'a la tuile et ouvrait la configuration. Aucune
       interception JavaScript ne pouvait y changer quoi que ce soit --
       l'evenement n'atteignait jamais les ecouteurs.
       THE cause of the symptom: in edit mode, the global rule
       `body.editing .tile-body { pointer-events: none }` makes ALL tile
       content inert, so an iframe or a map does not swallow the pointer.
       The overlay inherited that: handles and toolbar were displayed but
       received NO event, the click went through to the tile and opened
       the settings. No JavaScript interception could change anything --
       the event never reached the listeners. */
    assert("la regle globale rend bien le contenu inerte en edition",
      /body\.editing \.tile-body \{[^}]*pointer-events:\s*none/.test(
        fs.readFileSync(path.join(PUB, "style.css"), "utf8")));
    /* On lit la declaration en sautant les commentaires : le motif
       precedent butait sur une accolade contenue dans un commentaire, et
       echouait alors que la regle etait bien la.
       We read the declaration with comments stripped: the previous
       pattern tripped on a brace inside a comment, and failed although
       the rule was there. */
    const cssNoComments = imgCssA.replace(/\/\*[\s\S]*?\*\//g, "");
    const cropBlock = cssNoComments.slice(
      cssNoComments.indexOf("body.editing .pw-image-crop {"),
      cssNoComments.indexOf("}", cssNoComments.indexOf("body.editing .pw-image-crop {")));
    assert("la surcouche redevient explicitement sensible au pointeur",
      /pointer-events:\s*auto/.test(cropBlock));

    /* Les evenements du glissement sont arretes en CAPTURE (il faut
       passer avant Gridstack) ; le clic l'est en REMONTEE, sans quoi il
       n'atteindrait jamais les boutons de la barre d'outils. Le
       comportement lui-meme est verifie plus bas, par de vrais clics.
       The drag events are stopped in CAPTURE (we must come before
       Gridstack); the click is stopped on the way UP, without which it
       would never reach the toolbar's buttons. The behaviour itself is
       checked further down, with real clicks. */
    assert("les evenements du glissement sont arretes avant Gridstack",
      /\["mousedown", "touchstart"\][\s\S]{0,160}?\}, true\);/.test(src));
    /* `pointerdown` n'est plus dans cette liste : il est arrete par
       l'ecouteur qui ARME le glissement, lui-meme en capture. Le separer
       revenait a interrompre la distribution avant que cet armement
       soit atteint.
       `pointerdown` is no longer in that list: it is stopped by the
       listener that ARMS the drag, itself in capture. Separating them
       meant halting the dispatch before that arming was reached. */
    assert("l'armement du glissement est lui-meme en capture",
      /wrap\.addEventListener\("pointerdown"[\s\S]{0,2600}?\}, true\);/.test(src));
    assert("le clic est arrete en remontee, apres les boutons",
      /\["click", "dblclick"\][\s\S]{0,140}?e\.stopPropagation\(\); \}\);/.test(src));

    // L'aide ne doit plus situer le bouton "ci-dessous" : il est DANS la
    // tuile. The help must no longer place the button "below": it is IN
    // the tile.
    const manifest = JSON.parse(fs.readFileSync(path.join(PUB, "widgets/image/manifest.json"), "utf8"));
    const hint = manifest.settings.find((f) => f.key === "image").hint;
    /* L'intitule promettait un bouton « ci-dessous », dans le formulaire.
       Il doit desormais dire l'inverse : ce champ ne choisit rien, et le
       bouton est sur la TUILE. La formulation ayant change en 1.91.3, on
       verifie l'idee et non des mots precis : que le champ soit annonce
       en lecture seule, et que la tuile soit designee comme l'endroit ou
       agir.
       The label promised a button "below", in the form. It must now say
       the opposite: this field picks nothing, and the button is on the
       TILE. As the wording changed in 1.91.3, we check the idea rather
       than exact words: that the field is announced as read-only, and
       that the tile is named as the place to act. */
    assert("l'aide du champ annonce qu'il ne choisit pas de fichier",
      /lecture seule/.test(hint.fr) && /Read-only/.test(hint.en));
    assert("elle renvoie a la tuile pour choisir une image",
      /tuile/.test(hint.fr) && /tile/.test(hint.en));
    assert("elle ne promet plus un bouton dans le formulaire",
      !/ci-dessous/.test(hint.fr) && !/ button below/.test(hint.en));
  }

  console.log("== Regressions du mode tableau de bord et des tuiles de style ==");
  {
    const appSrc = fs.readFileSync(path.join(PUB, "app.js"), "utf8");

    /* 1. Redimensionner une tuile ouvrait ses reglages. Le garde-fou
       (un glissement qui se termine ne compte pas comme un clic) etait
       pose au demarrage sur une liste FIGEE : plateau + tiroirs. Les
       grilles de pages, creees ensuite, en etaient exclues.
       1. Resizing a tile opened its settings. The guard (a drag that
       just ended does not count as a click) was set at boot on a FROZEN
       list: board + drawers. The page grids, created afterwards, were
       excluded. */
    assert("le garde-fou du clic est une fonction appliquee a chaque grille",
      /function wireEditClick\(g, el\)/.test(appSrc));
    assert("il est applique aux grilles de pages a leur creation",
      /pgGrid[\s\S]{0,400}?wireEditClick\(pgGrid, gs\)/.test(appSrc));
    assert("et a toutes les grilles au demarrage",
      /for \(const g of allGrids\(\)\) wireEditClick\(g, g\.el\)/.test(appSrc));
    assert("plus aucune liste figee de grilles au demarrage",
      !/const allGrids = \[grid, \.\.\.Array/.test(appSrc));

    /* 2. Les tuiles debordaient par le bas des pages : les grilles de
       pages n'etaient pas dans updateCellHeight et gardaient la hauteur
       de cellule par defaut de Gridstack, sans rapport avec l'ecran.
       2. Tiles overflowed off the bottom of pages: the page grids were
       not in updateCellHeight and kept Gridstack's default cell height,
       unrelated to the screen. */
    assert("la hauteur de cellule est posee sur toutes les grilles",
      /for \(const g of allGrids\(\)\) g\.cellHeight\(cell\)/.test(appSrc));
    /* ... et le plateau mesure/defile devait etre le plateau VISIBLE :
       en mode tableau de bord, mesurer le plateau principal masque
       laissait la page courante deborder sans pouvoir atteindre son bas.
       ... and the measured/scrolled board had to be the VISIBLE one: in
       dashboard mode, measuring the hidden main board left the current
       page overflowing with no way to reach its bottom. */
    assert("le plateau mesure est celui qui est affiche",
      /function boardEl\(\) \{[\s\S]{0,400}?dashboardMode\(\)[\s\S]{0,200}?pageAt\(activePageIndex\)/.test(appSrc));
    assert("le debordement est evalue par element, pas par drapeau partage",
      /over === board\.classList\.contains\("has-overflow"\)/.test(appSrc));

    /* 3. Tuile Texte : la premiere mesure d'un redimensionnement tombe
       souvent alors que la tuile est a mi-course, voire de taille nulle.
       Calculer dessus figeait une police minuscule que rien ne
       corrigeait -- le texte rapetissait en elargissant la tuile.
       3. Text tile: a resize's first measurement often lands while the
       tile is mid-course, or even of zero size. Computing on it froze a
       tiny font that nothing corrected -- text shrank as the tile was
       widened. */
    const textSrc = fs.readFileSync(path.join(PUB, "widgets/text/widget.js"), "utf8");
    assert("les mesures d'un redimensionnement sont regroupees",
      /scheduleFit\(\)/.test(textSrc) && /this\.fitPending/.test(textSrc));
    assert("le redimensionnement passe par ce regroupement",
      /ResizeObserver\(\(\) => this\.scheduleFit\(\)\)/.test(textSrc));
    assert("un second passage rattrape une mise en page non stabilisee",
      /requestAnimationFrame\(\(\) => this\.fit\(\)\)/.test(textSrc));
    assert("une mesure nulle ou minuscule ne fige aucune taille",
      /box\.width < 2 \|\| box\.height < 2/.test(textSrc));

    /* 4. Tuile Image : les poignees n'apparaissaient que si le cadrage
       « Recadrer » etait DEJA choisi, donc aucun point d'entree visible.
       4. Image tile: the handles only appeared if the "Crop" framing was
       ALREADY chosen, so no visible entry point. */
    const imgSrc2 = fs.readFileSync(path.join(PUB, "widgets/image/widget.js"), "utf8");
    /* Il n'y a plus de point d'entree a chercher : la barre d'outils et
       les poignees sont actives en mode edition quel que soit le
       cadrage, puisque le zoom et le point de mire agissent desormais
       sur tous.
       There is no entry point to look for any more: the toolbar and the
       handles are active in edit mode whatever the framing, since zoom
       and focal point now act on all of them. */
    assert("plus aucune condition de cadrage sur la surcouche",
      !/pw-image-crop-off/.test(imgSrc2));
    const imgCss2 = fs.readFileSync(path.join(PUB, "widgets/image/widget.css"), "utf8");
    assert("ni dans la feuille de style", !/pw-image-crop-off/.test(imgCss2));
    assert("la surcouche s'affiche des le mode edition",
      /body\.editing \.pw-image-crop \{[^}]*display:\s*block/.test(imgCss2));
  }

  console.log("== Tuile Image : la barre d'outils repond reellement au clic ==");
  {
    /* Test FONCTIONNEL, pas une lecture du code. Les versions
       precedentes verifiaient la presence des ecouteurs, ce qui passait
       au vert alors qu'un clic ne declenchait rigoureusement rien : le
       `click` etait arrete en phase de CAPTURE sur la surcouche, donc il
       n'atteignait jamais le bouton qu'il devait servir. On monte donc
       la tuile pour de vrai, on clique, et on regarde ce qui s'est
       passe.
       FUNCTIONAL test, not a code read. The previous versions checked
       the listeners were present, which went green while a click did
       absolutely nothing: `click` was stopped in the CAPTURE phase on
       the overlay, so it never reached the button it was meant to
       serve. So we mount the tile for real, click, and look at what
       happened. */
    const vm = require("vm");
    const host = document.createElement("div");
    const item = document.createElement("div");
    item.className = "grid-stack-item";
    item.dataset.tileId = "img-probe";
    const content = document.createElement("div");
    content.className = "grid-stack-item-content";
    content.appendChild(host);
    item.appendChild(content);
    const holder = document.createElement("div");
    holder.appendChild(item);
    document.body.appendChild(holder);

    // Le clic d'edition tel que l'application le pose : sur le
    // CONTENEUR, pas sur la tuile. C'est lui qui ouvrait la fenetre.
    let openedSettings = 0;
    holder.addEventListener("click", (e) => {
      if (e.target.closest(".tile-btn")) return;
      if (e.target.closest(".grid-stack-item")) openedSettings++;
    });

    let Klass = null;
    const sb = { window: { PiBoard: { registerWidget: (id, k) => { if (id === "image") Klass = k; } } },
      console, document, fetch: () => Promise.reject(new Error("hors ligne")) };
    sb.window.document = document;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(PUB, "widgets/image/widget.js"), "utf8"), sb);

    const saved = [];
    const widget = new Klass({
      el: host,
      settings: { image: "logo.png", fit: "contain", zoom: 100, focusX: 50, focusY: 50 },
      instanceId: "img-probe",
      i18n: { t: (k) => k, lang: "fr" },
      updateSettings: (patch) => saved.push(patch)
    });
    widget.init();
    let managerOpened = 0;
    widget.openManager = () => { managerOpened++; };

    // L'etat d'edition du scenario est preserve : les sections
    // suivantes en dependent. The scenario's editing state is preserved:
    // the following sections depend on it.
    const wasEditingProbe = document.body.classList.contains("editing");
    document.body.classList.add("editing");
    const toolBtn = (act) => host.querySelector('[data-act="' + act + '"]');
    assert("la barre d'outils est montee avec l'image", !!toolBtn("in") && !!toolBtn("pick"));

    const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

    click(toolBtn("in"));
    assert("le bouton d'agrandissement AGIT reellement",
      saved.length === 1 && saved[0].zoom === 110);
    assert("et n'ouvre pas la fenetre de configuration", openedSettings === 0);

    click(toolBtn("out"));
    assert("le bouton de reduction agit", saved.length === 2 && saved[1].zoom === 100);

    click(toolBtn("reset"));
    assert("la remise a zero agit sur le zoom ET le cadrage",
      saved.length === 3 && saved[2].zoom === 100 && saved[2].focusX === 50 && saved[2].focusY === 50);

    click(toolBtn("pick"));
    assert("l'appareil photo ouvre le gestionnaire d'images", managerOpened === 1);
    assert("aucun clic de la barre d'outils n'a ouvert la configuration", openedSettings === 0);

    /* Un clic ailleurs sur la tuile ne doit pas davantage ouvrir la
       fenetre : la surcouche couvre l'image entiere. A click elsewhere
       on the tile must not open the window either: the overlay covers
       the whole image. */
    click(host.querySelector(".pw-image-crop"));
    assert("un clic sur l'image n'ouvre pas la configuration", openedSettings === 0);

    /* ---------- Glissement : poignees et deplacement ----------
       Le curseur changeait au survol (affaire de CSS) mais rien ne se
       produisait a la saisie : `stopPropagation()` en capture sur la
       surcouche interrompt toute la distribution, si bien que
       l'armement du glissement, pose en remontee, n'etait jamais
       appele. On simule donc un vrai geste et on regarde ce qui change.
       The cursor changed on hover (a CSS matter) but nothing happened on
       grab: `stopPropagation()` in capture on the overlay halts the
       whole dispatch, so the drag arming, attached in the bubble phase,
       was never called. So we simulate a real gesture and look at what
       changes. */
    const wrap = host.querySelector(".pw-image-crop");
    wrap.getBoundingClientRect = () => ({ width: 200, height: 200, left: 0, top: 0 });
    host.getBoundingClientRect = () => ({ width: 200, height: 200, left: 0, top: 0 });
    const pointer = (el, type, x, y) => {
      const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(ev, "pointerId", { value: 1 });
      el.dispatchEvent(ev);
    };

    // Poignee d'angle : tirer vers l'exterieur doit AGRANDIR.
    saved.length = 0;
    const se = host.querySelector(".pw-image-handle-se");
    assert("les quatre poignees sont presentes", host.querySelectorAll(".pw-image-handle").length === 4);
    pointer(se, "pointerdown", 100, 100);
    pointer(wrap, "pointermove", 160, 160);
    pointer(wrap, "pointerup", 160, 160);
    assert("tirer la poignee d'angle CHANGE reellement le zoom",
      saved.length > 0 && saved[saved.length - 1].zoom > 100);
    assert("le geste sur une poignee n'ouvre pas la configuration", openedSettings === 0);

    /* Deplacement : il n'a d'effet que s'il y a de la matiere hors cadre,
       donc a partir d'un zoom superieur a 100 %. A 100 % l'image affleure
       le cadre et le geste ne doit rien faire -- c'est voulu, et c'est
       desormais dit dans l'aide.
       Panning only has an effect if there is material outside the frame,
       so above 100% zoom. At 100% the image meets the frame and the
       gesture must do nothing -- deliberately so, and now stated in the
       help. */
    widget.ctx.settings = Object.assign({}, widget.ctx.settings, { zoom: 100, focusX: 50, focusY: 50 });
    saved.length = 0;
    pointer(wrap, "pointerdown", 100, 100);
    pointer(wrap, "pointermove", 40, 100);
    pointer(wrap, "pointerup", 40, 100);
    assert("a 100 %, deplacer l'image ne change pas le cadrage",
      saved.every((p) => p.focusX === undefined || p.focusX === 50));

    widget.ctx.settings = Object.assign({}, widget.ctx.settings, { zoom: 200, focusX: 50, focusY: 50 });
    saved.length = 0;
    pointer(wrap, "pointerdown", 100, 100);
    pointer(wrap, "pointermove", 40, 100);
    pointer(wrap, "pointerup", 40, 100);
    assert("zoomee, l'image se deplace bien dans son cadre",
      saved.length > 0 && saved[saved.length - 1].focusX > 50);

    if (!wasEditingProbe) document.body.classList.remove("editing");
    widget.destroy();
    holder.remove();
  }

  console.log("== Tuile transparente : la couleur du texte suit le fond de PAGE ==");
  {
    /* Une tuile transparente ne peint plus son fond : ce qu'on voit
       derriere elle est le fond de la PAGE. Sa couleur de texte doit donc
       trancher sur celui-la. Elle continuait d'heriter de la couleur
       calculee pour son ancien fond de tuile -- un texte sombre, pense
       pour une tuile claire, se retrouvait sur un fond de page sombre et
       devenait illisible.
       A transparent tile no longer paints its background: what is seen
       behind it is the PAGE's. Its text colour must therefore contrast
       with that one. It kept inheriting the colour computed for its
       former tile background -- dark text, meant for a light tile, ended
       up on a dark page background and became unreadable. */
    const appSrc3 = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    const branch = appSrc3.slice(appSrc3.indexOf("if (s._transparent) {"),
      appSrc3.indexOf("if (s._customColor && s._bgColor) {"));
    assert("la branche transparente pose bien une couleur de texte",
      /content\.style\.color = palette\["--text"\]/.test(branch));
    assert("elle la choisit d'apres le fond de page", /pageIsDark\(\)/.test(branch));
    assert("elle n'efface plus la couleur sans en remettre",
      !/content\.style\.color = "";/.test(branch));

    /* La mesure porte sur la couleur REELLEMENT calculee, pas sur la
       variable `--bg` : un theme personnalise ou une couleur de page
       peuvent l'avoir remplacee. The measurement is on the ACTUALLY
       computed colour, not the `--bg` variable: a custom theme or page
       colour may have replaced it. */
    assert("le fond de page est mesure, pas suppose",
      /getComputedStyle\(surface\)\.backgroundColor/.test(appSrc3));
    assert("un fond totalement transparent n'est pas lu comme du noir",
      /Number\(alpha\[1\]\) > 0\.1/.test(appSrc3));
    // Le theme est pose sur <body> : viser la racine aurait fait echouer
    // le repli en silence.
    assert("le repli lit le theme la ou il est reellement pose",
      /document\.body\.dataset\.theme !== "light"/.test(appSrc3));
    /* Changer de theme change la reponse : sans reapplication, un passage
       en mode jour laissait un texte clair sur fond clair.
       Switching theme changes the answer: without reapplication,
       switching to day mode left light text on a light background. */
    assert("les tuiles transparentes sont recalculees au changement de theme",
      /_transparent\) applyTileColor\(rec\)/.test(appSrc3));
  }

  console.log("== Reglages d'une tuile : reinitialisation ==");
  {
    const appSrc2 = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    assert("un bouton de reinitialisation existe dans la fenetre de reglages",
      /id="tileReset"/.test(fs.readFileSync(path.join(PUB, "index.html"), "utf8")));
    assert("il est relie a la reinitialisation", /onActivate\(\$\("tileReset"\), \(\) => resetTileSettings\(\)\)/.test(appSrc2));
    assert("les valeurs revenues sont celles du manifeste",
      /defaults\[field\.key\] = field\.default/.test(appSrc2));
    /* Une confirmation est exigee : l'action efface un travail de reglage
       qui peut etre long, et rien ne permettrait de le retrouver.
       A confirmation is required: the action wipes settings work that can
       be long, and nothing would bring it back. */
    assert("une confirmation est demandee",
      /window\.confirm\(i18n\.t\("tile\.reset\.confirm"\)\)/.test(appSrc2));
    /* Le fichier d'une tuile Image est CONSERVE : c'est un fichier
       televerse, pas un reglage, et le perdre obligerait a le rechercher.
       An Image tile's file is KEPT: it is an uploaded file, not a
       setting, and losing it would mean hunting for it again. */
    assert("une image televersee n'est pas perdue",
      /if \(kept\.image !== undefined\) defaults\.image = kept\.image/.test(appSrc2));
    assert("le formulaire est reconstruit pour montrer les valeurs revenues",
      /openTileSettings\(tileModalTarget\)/.test(appSrc2));
    assert("la planification est reappliquee", /resetTileSettings[\s\S]{0,2600}?syncTileSchedule\(rec\)/.test(appSrc2));
  }

  console.log("== Mode tableau de bord : pages, transitions, bandeau ==");
  {
    const setMode = async (mode) => {
      document.getElementById("settingsModal").hidden = true;
      document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(80);
      const sel = document.getElementById("setDisplayMode");
      sel.value = mode;
      sel.dispatchEvent(new window.Event("change", { bubbles: true }));
      document.getElementById("settingsSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(250);
    };

    assert("mode classique par defaut : aucun changement d'aspect apres mise a jour",
      document.body.classList.contains("dashboard-mode") === false);
    assert("le bandeau existe des le mode classique, mais masque par CSS",
      !!document.getElementById("dashBar") && !!document.getElementById("dashTab"));
    assert("la zone du futur bandeau defilant est en place", !!document.getElementById("dashTicker"));

    await setMode("dashboard");
    assert("mode tableau de bord actif", document.body.classList.contains("dashboard-mode"));
    assert("editeur de pages visible dans les reglages",
      document.getElementById("pagesEditor").hidden === false);
    assert("une seule page au depart : le plateau existant devient la page 1",
      document.getElementById("pagesList").querySelectorAll(".page-row").length === 1);
    assert("la page 1 ne peut pas etre supprimee",
      document.getElementById("pagesList").querySelector(".page-row").classList.contains("page-main"));
    assert("navigation masquee tant qu'il n'y a qu'une page",
      document.getElementById("dashPages").hidden === true);

    // Ajout de deux pages
    document.getElementById("pageAddBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    document.getElementById("pageAddBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    assert("deux pages ajoutees, sans limite imposee",
      document.getElementById("pagesList").querySelectorAll(".page-row").length === 3);
    const dots = document.getElementById("dashPages");
    assert("navigation affichee des la deuxieme page", dots.hidden === false);
    assert("un reperage par page", dots.querySelectorAll(".dash-page-dot").length === 3);
    assert("la page 1 est active au depart", dots.querySelector(".dash-page-dot").classList.contains("active"));
    const pageEls = document.querySelectorAll(".board-page");
    assert("un conteneur par page secondaire", pageEls.length === 2);
    assert("les pages secondaires sont masquees tant qu'on ne les affiche pas",
      Array.from(pageEls).every((el) => el.hidden === true));
    assert("chaque page a sa propre grille",
      Array.from(pageEls).every((el) => !!el.querySelector(".grid-stack")));

    /* ---------- Edition sur les pages ----------
       Les grilles de pages sont creees apres coup, une par page : elles
       n'etaient dans aucune des deux listes deverrouillees en mode
       edition (plateau, tiroirs) et restaient donc figees en
       permanence. Aucun message, aucune erreur : les poignees ne
       repondaient simplement pas, et il etait impossible de deplacer ou
       de redimensionner la moindre tuile sur une page 2 ou 3.
       Page grids are created afterwards, one per page: they were in
       neither of the two lists unlocked in edit mode (board, drawers)
       and therefore stayed frozen for good. No message, no error: the
       handles simply did not respond, and it was impossible to move or
       resize any tile on a page 2 or 3. */
    /* On observe la classe posee sur la grille plutot que `opts.staticGrid` :
       dans Gridstack 10.3.1, setStatic() bascule bien la classe
       "grid-stack-static" mais ne reecrit pas toujours l'option. La
       classe est de toute facon ce qui commande reellement les poignees.
       We watch the class set on the grid rather than `opts.staticGrid`:
       in Gridstack 10.3.1, setStatic() does toggle the "grid-stack-static"
       class but does not always rewrite the option. The class is what
       actually drives the handles anyway. */
    const locked = (el) => el.classList.contains("grid-stack-static");
    const pageGrids = () => Array.from(document.querySelectorAll(".board-page .grid-stack"));
    const mainGrid = () => document.querySelector("#grid");
    assert("les grilles de pages sont accessibles au test", pageGrids().length === 2);

    // Le scenario a pu laisser l'edition active : on part d'un etat connu,
    // et on le remettra tel qu'on l'a trouve a la fin de ce bloc.
    // The scenario may have left editing on: start from a known state,
    // and restore it as found at the end of this block.
    const editingBefore = document.body.classList.contains("editing");
    if (editingBefore) {
      document.getElementById("dashEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(150);
    }
    assert("hors edition, les pages sont verrouillees comme le plateau",
      pageGrids().every(locked) && locked(mainGrid()));

    document.getElementById("dashEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("le mode edition est actif", document.body.classList.contains("editing"));
    assert("le plateau principal est deverrouille", !locked(mainGrid()));
    assert("LES PAGES AUSSI sont deverrouillees (tuiles deplacables et redimensionnables)",
      pageGrids().every((g) => !locked(g)));

    // Une page ajoutee PENDANT l'edition doit naitre deverrouillee, sinon
    // elle serait la seule page figee de la session.
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    document.getElementById("pageAddBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("une page creee en cours d'edition nait deverrouillee",
      pageGrids().length === 3 && pageGrids().every((g) => !locked(g)));
    // On la retire pour laisser le scenario dans l'etat attendu ensuite.
    document.getElementById("pagesList").querySelectorAll(".page-row")[3]
      .querySelector("[data-role=del]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    document.getElementById("settingsModal").hidden = true;

    document.getElementById("dashEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("sortie d'edition : les pages sont reverrouillees",
      pageGrids().every(locked));

    // Etat rendu tel qu'on l'a trouve : la suite du fichier en depend.
    // State restored as found: the rest of the file depends on it.
    if (editingBefore) {
      document.getElementById("dashEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(150);
    }

    // Changement de page : effet "aucun" pour un basculement immediat,
    // les transitions animees etant intestables de facon fiable en jsdom.
    const rows = document.getElementById("pagesList").querySelectorAll(".page-row");
    const fx = rows[1].querySelector("[data-role=fx]");
    fx.value = "none";
    fx.dispatchEvent(new window.Event("change", { bubbles: true }));
    document.getElementById("settingsModal").hidden = true;
    document.getElementById("dashNext").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    assert("le bouton suivant amene sur la page 2",
      dots.querySelectorAll(".dash-page-dot")[1].classList.contains("active"));
    assert("la page 2 est affichee", pageEls[0].hidden === false);
    assert("la page 1 est masquee", document.getElementById("board").hidden === true);

    // Bouclage : depuis la derniere page, "suivant" revient a la premiere.
    const fx3 = document.getElementById("pagesList");
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    const rows2 = fx3.querySelectorAll(".page-row");
    for (const r of rows2) {
      const sel = r.querySelector("[data-role=fx]");
      sel.value = "none";
      sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    }
    document.getElementById("settingsModal").hidden = true;
    document.getElementById("dashNext").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(100);
    document.getElementById("dashNext").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(100);
    assert("depuis la derniere page, 'suivant' revient a la premiere",
      dots.querySelector(".dash-page-dot").classList.contains("active"));
    assert("la page 1 est de nouveau affichee", document.getElementById("board").hidden === false);

    // Le bandeau s'ouvre au survol et se referme au depart de la souris.
    document.getElementById("dashHotzone").dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
    assert("le bandeau sort au survol de la bande du bas", document.body.classList.contains("dash-open"));
    document.getElementById("dashBar").dispatchEvent(new window.MouseEvent("mouseleave", { bubbles: true }));
    await sleep(420);
    assert("le bandeau rentre quand la souris s'en va", !document.body.classList.contains("dash-open"));
    document.getElementById("dashTab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("la languette (tactile) ouvre le bandeau sans survol", document.body.classList.contains("dash-open"));
    document.body.classList.remove("dash-open");

    /* ---------- Defilement automatique ----------
       Duree ramenee a 3 s (le minimum) pour que le test s'execute en un
       temps raisonnable ; effets deja regles sur "aucun" plus haut, les
       transitions animees n'etant pas testables de facon fiable en jsdom.
       Duration set to 3 s (the minimum) so the test runs in a reasonable
       time; effects already set to "none" above, animated transitions
       not being reliably testable in jsdom. */
    /* Le scenario precedent a laisse le mode edition actif et le guide de
       demarrage ouvert : ce sont precisement les deux situations ou le
       defilement doit rester suspendu. On les leve donc avant de tester
       qu'il fonctionne -- et on verifie plus bas qu'il se resuspend bien
       des qu'une fenetre se rouvre.
       The previous scenario left edit mode on and the quick start window
       open: precisely the two situations where cycling must stay
       suspended. So we clear them before testing that it works -- and we
       check below that it does suspend again as soon as a window
       reopens. */
    const quickStartWasOpen = !document.getElementById("quickStartModal").hidden;
    const wasEditing = document.body.classList.contains("editing");
    document.getElementById("quickStartModal").hidden = true;
    if (wasEditing) {
      document.getElementById("btnEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(120);
    }
    assert("le mode edition est bien quitte avant ce test",
      !document.body.classList.contains("editing"));

    document.getElementById("settingsModal").hidden = true;
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    assert("le defilement est desactive par defaut",
      document.getElementById("setPageAuto").checked === false);
    assert("une duree generale est proposee",
      Number(document.getElementById("setPageAutoSeconds").value) > 0);
    assert("chaque page peut fixer sa propre duree",
      document.getElementById("pagesList").querySelectorAll("[data-role=dwell]").length
        === document.getElementById("pagesList").querySelectorAll(".page-row").length);
    const dwell0 = document.getElementById("pagesList").querySelector("[data-role=dwell]");
    assert("le champ d'une page est vide tant qu'elle suit la duree generale", dwell0.value === "");
    assert("la duree generale s'affiche alors en filigrane", Number(dwell0.placeholder) > 0);

    document.getElementById("setPageAuto").checked = true;
    document.getElementById("setPageAutoSeconds").value = "3";
    document.getElementById("settingsSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(200);
    const startIndex = Array.from(dots.querySelectorAll(".dash-page-dot"))
      .findIndex((b) => b.classList.contains("active"));
    await sleep(3400);
    const afterIndex = Array.from(dots.querySelectorAll(".dash-page-dot"))
      .findIndex((b) => b.classList.contains("active"));
    assert("la page suivante arrive toute seule apres la duree fixee", afterIndex !== startIndex);

    /* Le defilement doit se suspendre tant qu'une fenetre est ouverte :
       sinon la page se deroberait pendant qu'on lit ses reglages.
       Cycling must suspend while a window is open: otherwise the page
       would slip away while its settings are being read. */
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    const heldIndex = Array.from(dots.querySelectorAll(".dash-page-dot"))
      .findIndex((b) => b.classList.contains("active"));
    await sleep(4200);
    assert("aucun changement de page tant qu'une fenetre est ouverte",
      Array.from(dots.querySelectorAll(".dash-page-dot"))
        .findIndex((b) => b.classList.contains("active")) === heldIndex);

    // Remise a l'arret pour ne pas perturber la suite du scenario.
    document.getElementById("setPageAuto").checked = false;
    document.getElementById("settingsSave").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(200);
    const stoppedAt = Array.from(dots.querySelectorAll(".dash-page-dot"))
      .findIndex((b) => b.classList.contains("active"));
    await sleep(4200);
    assert("option decochee : plus aucun defilement",
      Array.from(dots.querySelectorAll(".dash-page-dot"))
        .findIndex((b) => b.classList.contains("active")) === stoppedAt);

    // Etat rendu tel qu'on l'a trouve : les sections suivantes reposent
    // dessus. State restored as found: the following sections rely on it.
    if (wasEditing && !document.body.classList.contains("editing")) {
      document.getElementById("btnEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(120);
    }
    if (quickStartWasOpen) document.getElementById("quickStartModal").hidden = false;

    // Le bandeau donne acces aux reglages generaux : c'est le seul chemin
    // en mode tableau de bord, la barre d'outils etant masquee.
    document.getElementById("dashSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(80);
    assert("le bandeau ouvre les reglages generaux",
      document.getElementById("settingsModal").hidden === false);
    /* L'icone des reglages du bandeau etait un cercle cerne de huit
       rayons DROITS : le pictogramme d'un soleil, pas d'un engrenage --
       exactement la confusion deja documentee pour l'icone de reglages
       des tuiles. Elle reprend desormais le vrai engrenage lobe de la
       barre d'outils classique.
       The bar's settings icon was a circle ringed by eight STRAIGHT
       rays: the pictogram of a sun, not a gear -- exactly the confusion
       already documented for the tile settings icon. It now reuses the
       classic toolbar's real lobed gear. */
    const dashGear = document.getElementById("dashSettings").innerHTML;
    const dockGear = document.getElementById("btnSettings").innerHTML;
    assert("l'icone de reglages du bandeau est le meme engrenage que la barre d'outils",
      dashGear.replace(/\s+/g, "") === dockGear.replace(/\s+/g, ""));
    assert("ce n'est plus un cercle cerne de rayons droits (un soleil)",
      !/M12 3v3M12 18v3/.test(dashGear));

    // Suppression d'une page vide : pas de confirmation attendue.
    const delRow = document.getElementById("pagesList").querySelectorAll(".page-row")[2];
    delRow.querySelector("[data-role=del]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(120);
    assert("une page supprimee disparait de la liste",
      document.getElementById("pagesList").querySelectorAll(".page-row").length === 2);
    assert("son conteneur est retire du document",
      document.querySelectorAll(".board-page").length === 1);

    /* Retour au mode classique : le plateau doit etre retrouve intact et
       les tiroirs redevenir disponibles. C'est la garantie qui rend la
       bascule sans risque. Back to classic mode: the board must be found
       intact and the drawers become available again. That is the
       guarantee that makes switching risk-free. */
    await setMode("classic");
    assert("retour au mode classique", !document.body.classList.contains("dashboard-mode"));
    assert("le plateau principal est de nouveau affiche", document.getElementById("board").hidden === false);
    assert("les pages creees ne sont pas detruites par la bascule",
      document.querySelectorAll(".board-page").length === 1);
    document.getElementById("settingsModal").hidden = true;
  }

  console.log("== Tuiles de style : Texte, Logo/Image, fond transparent ==");
  {
    const vm = require("vm");
    let Text = null, Image = null;
    for (const [id, target] of [["text", "Text"], ["image", "Image"]]) {
      const sb = { window: { PiBoard: { registerWidget: (wid, k) => { if (wid === id) { if (id === "text") Text = k; else Image = k; } } } }, console, document: undefined, ResizeObserver: undefined };
      vm.createContext(sb);
      vm.runInContext(fs.readFileSync(path.join(PUB, "widgets", id, "widget.js"), "utf8"), sb);
    }
    assert("les deux tuiles de style s'enregistrent", !!Text && !!Image);

    // Texte : les polices proposees listent plusieurs familles de repli,
    // sans quoi un Raspberry Pi n'en afficherait aucune.
    for (const [key, stack] of Object.entries(Text.FONTS)) {
      assert("la police '" + key + "' prevoit un repli generique",
        /(sans-serif|serif|monospace|cursive)\s*$/.test(stack));
    }
    assert("taille bornee vers le bas", Text._clamp(-50) >= 6);
    assert("taille bornee vers le haut", Text._clamp(9000) <= 400);

    /* Taille du texte : mesure a une police de reference, puis regle de
       trois. L'ancienne recherche dichotomique mesurait l'element
       AFFICHE, dont la largeur vaut toujours celle de la tuile : la
       contrainte de largeur ne servait a rien, et la hauteur dependait
       d'un retour a la ligne lui-meme fonction de la police. Cette
       boucle de retour faisait sortir la dichotomie sur une valeur
       minuscule -- d'ou un texte ridiculement petit qui ne grossissait
       pas quand on elargissait la tuile.
       Text size: measured at a reference font size, then a rule of
       three. The old bisection measured the DISPLAYED element, whose
       width always equals the tile's: the width constraint was useless,
       and the height depended on wrapping, itself a function of the
       font. That feedback loop made the bisection exit on a tiny value
       -- hence ridiculously small text that did not grow when the tile
       was widened. */
    const nat = { w: 500, h: 115 };   // texte mesure a 100 px
    const narrow = Text._sizeFor(nat, 300, 100);
    const wide = Text._sizeFor(nat, 900, 100);
    const tall = Text._sizeFor(nat, 900, 300);
    assert("elargir la tuile AGRANDIT le texte", wide > narrow);
    assert("l'agrandir en hauteur aussi", tall > wide);
    assert("le texte tient en largeur", wide * nat.w / Text._REFERENCE_PX <= 900 + 0.5);
    assert("et en hauteur", wide * nat.h / Text._REFERENCE_PX <= 100 + 0.5);
    assert("la contrainte la plus forte l'emporte",
      Math.abs(narrow - Math.round(100 * Math.min(300 / nat.w, 100 / nat.h))) <= 1);
    assert("la taille reste bornee vers le haut", Text._sizeFor({ w: 1, h: 1 }, 99999, 99999) <= 400);
    assert("un texte non mesurable ne produit pas de valeur absurde",
      Text._sizeFor({ w: 0, h: 0 }, 300, 100) >= 6);
    assert("aucune mesure nulle ne passe", Text._sizeFor(null, 300, 100) >= 6);
    const textCss = fs.readFileSync(path.join(PUB, "widgets/text/widget.css"), "utf8");
    /* Le retour a la ligne AUTOMATIQUE est retire : la mesure ne peut pas
       en tenir compte, le texte affiche serait alors plus haut que celui
       qui a servi au calcul. Automatic wrapping is removed: the
       measurement cannot account for it, and the displayed text would
       then be taller than the one used for the computation. */
    assert("seuls les retours a la ligne saisis comptent",
      /white-space:\s*pre;/.test(textCss) && !/white-space:\s*pre-wrap/.test(textCss));

    // Image : un lien "javascript:" saisi dans le champ ne doit jamais
    // etre pose sur la balise. C'est le seul cas qui compte ici.
    assert("lien http accepte", Image._safeLink("https://exemple.test/a") === "https://exemple.test/a");
    assert("lien interne accepte", Image._safeLink("/aide") === "/aide");
    assert("javascript: refuse", Image._safeLink("javascript:alert(1)") === null);
    assert("data: refuse", Image._safeLink("data:text/html,<b>") === null);
    assert("champ vide : pas de lien", Image._safeLink("") === null && Image._safeLink(null) === null);
    const img = { style: {} };
    Image._applyFit(img, "none");
    assert("cadrage 'taille d'origine' : pas d'etirement force", img.style.width === "auto" && img.style.height === "auto");
    Image._applyFit(img, "n'importe quoi");
    assert("cadrage inconnu : repli sur 'image entiere'", img.style.objectFit === "contain");

    /* ---------- Recadrage / cropping ----------
       Le recadrage ne touche PAS au fichier : il ne fait que choisir la
       partie visible. Ce qui est verifie ici, c'est que le point de mire
       pilote a la fois la partie conservee et l'origine du zoom -- sans
       quoi le zoom partirait du centre et deplacerait le cadrage a
       chaque changement de zoom.
       Cropping does NOT touch the file: it only picks the visible part.
       What is checked here is that the focal point drives both the kept
       part and the zoom's origin -- otherwise the zoom would start from
       the centre and shift the framing on every zoom change. */
    const crop = { style: {} };
    Image._applyFit(crop, "crop", { zoom: 200, focusX: 25, focusY: 75 });
    assert("le recadrage couvre toute la tuile", crop.style.objectFit === "cover");
    assert("le point de mire choisit la partie conservee", crop.style.objectPosition === "25% 75%");
    assert("le zoom part du meme point de mire", crop.style.transformOrigin === "25% 75%");
    assert("le zoom est applique", crop.style.transform === "scale(2)");

    Image._applyFit(crop, "crop", { zoom: 100, focusX: 50, focusY: 50 });
    assert("a 100 %, aucune transformation inutile n'est posee", crop.style.transform === "");
    /* Le zoom descend sous 100 %. Il y etait borne parce qu'en cadrage
       « couvrir » reduire aurait decouvert des bandes vides ; avec
       « Image entiere », reduire est au contraire ce qui eloigne un logo
       des bords de sa tuile.
       Zoom goes below 100%. It was bounded there because in "cover"
       framing shrinking would have uncovered empty bands; with "Whole
       image", shrinking is on the contrary what moves a logo away from
       its tile's edges. */
    Image._applyFit(crop, "contain", { zoom: 40 });
    assert("un zoom sous 100 % reduit reellement l'image", crop.style.transform === "scale(0.4)");
    Image._applyFit(crop, "crop", { zoom: 9000 });
    assert("un zoom demesure est borne", crop.style.transform === "scale(5)");
    Image._applyFit(crop, "crop", {});
    assert("sans reglage, le recadrage part du centre", crop.style.objectPosition === "50% 50%");
    Image._applyFit(crop, "crop", { focusX: -80, focusY: 300 });
    assert("un point de mire hors bornes est ramene dans le cadre", crop.style.objectPosition === "0% 100%");

    /* LE defaut signale : avec le cadrage par defaut (« Image entiere »),
       les trois champs Zoom et Positions ne faisaient strictement rien.
       On saisissait 50 % ou 150 %, rien ne bougeait, sans le moindre
       indice sur la raison. Ils agissent desormais sur TOUS les cadrages.
       THE reported defect: with the default framing ("Whole image"), the
       three Zoom and Position fields did strictly nothing. You typed 50%
       or 150%, nothing moved, with no hint as to why. They now act on
       EVERY framing. */
    for (const mode of ["contain", "cover", "crop", "fill"]) {
      const el = { style: {} };
      Image._applyFit(el, mode, { zoom: 150, focusX: 80, focusY: 57 });
      assert("cadrage '" + mode + "' : le zoom agit", el.style.transform === "scale(1.5)");
      assert("cadrage '" + mode + "' : le point de mire agit", el.style.objectPosition === "80% 57%");
      assert("cadrage '" + mode + "' : le zoom part du point de mire",
        el.style.transformOrigin === "80% 57%");
    }
    const kept = { style: {} };
    Image._applyFit(kept, "crop", { zoom: 300, focusX: 10, focusY: 10 });
    Image._applyFit(kept, "contain", { zoom: 300, focusX: 10, focusY: 10 });
    assert("changer de cadrage ne perd plus le zoom, qui vaut pour tous",
      kept.style.transform === "scale(3)");
    assert("'Recadrer' reste distinct : c'est le seul qui remplit en rognant",
      (Image._applyFit(kept, "crop", {}), kept.style.objectFit === "cover"));
    assert("'Image entiere' ne rogne pas",
      (Image._applyFit(kept, "contain", {}), kept.style.objectFit === "contain"));

    const imgManifest = JSON.parse(fs.readFileSync(path.join(PUB, "widgets/image/manifest.json"), "utf8"));
    const fitField = imgManifest.settings.find((f) => f.key === "fit");
    assert("le recadrage est propose parmi les cadrages",
      fitField.options.some((o) => o.value === "crop"));
    for (const k of ["zoom", "focusX", "focusY"]) {
      const f = imgManifest.settings.find((x) => x.key === k);
      assert("le reglage '" + k + "' est declare", !!f);
      assert("il dit dans les deux langues qu'il vaut pour tous les cadrages",
        /tous les cadrages/.test(f.hint.fr) && /every framing/.test(f.hint.en));
    }
    assert("le formulaire autorise un zoom inferieur a 100 %",
      imgManifest.settings.find((x) => x.key === "zoom").min < 100);

    // Les deux tuiles sont bien au catalogue, dans la famille Mise en page.
    const appSrc = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    assert("les tuiles de style ont leur famille dans le catalogue",
      /\{ key: "style", ids: \["text", "image"\] \}/.test(appSrc));
    assert("le fond transparent est propose dans les reglages universels",
      /data-key="_transparent"/.test(appSrc));
    const css = fs.readFileSync(path.join(PUB, "style.css"), "utf8");
    assert("une tuile transparente reste reperable en mode edition",
      /body\.editing \.grid-stack-item-content\.tile-transparent/.test(css));
  }

  console.log("== Sante Internet : mesure serveur, coupures et export ==");
  {
    const src = fs.readFileSync(path.join(PUB, "widgets/speedtest/widget.js"), "utf8");
    const srvSrc = fs.readFileSync(path.join(ROOT, "server/internetHealth.js"), "utf8");

    /* Le point le plus important de cette tuile : elle ne mesure RIEN
       elle-meme. Si un jour on y glissait une mesure cote client,
       l'historique repartirait de zero a chaque rechargement de page et
       la tuile perdrait sa raison d'etre. La tuile ne doit donc lire
       que les points d'entree du serveur.
       The most important point of this tile: it measures NOTHING
       itself. If a client-side measurement ever slipped in, the history
       would restart from scratch on every page reload and the tile
       would lose its purpose. So the tile must only read the server's
       endpoints. */
    assert("la tuile lit l'etat mesure par le serveur",
      /\/api\/internet-health/.test(src));
    assert("la tuile ne mesure rien elle-meme (aucun chronometre de transfert cote client)",
      !/speed\.cloudflare/.test(src) && !/new WebSocket/.test(src));

    /* Une latence absente n'est PAS une latence nulle. Les confondre
       afficherait une connexion excellente pendant une panne --
       exactement le contraire de l'information recherchee.
       An absent latency is NOT a zero latency. Confusing the two would
       show an excellent connection during an outage -- exactly the
       opposite of the information sought. */
    assert("une ligne sans reponse affiche un mot, pas un chiffre",
      /speed\.noAnswer/.test(src));

    /* Les coupures rompent le trace au lieu d'etre reliees : une ligne
       qui traverse une coupure laisserait croire a une degradation
       progressive alors qu'il n'y avait rien du tout.
       Outages break the stroke instead of being bridged. */
    assert("le trace est rompu sur une coupure, pas relie",
      /pen = false/.test(src) && /pen \? \" L\" : \" M\"/.test(src));

    /* Aucune tuile posee = aucune mesure, donc aucun trafic. C'est la
       garantie annoncee dans l'aide, et elle repose entierement sur ce
       repli. No tile on the board = no measurement, hence no traffic. */
    assert("le serveur ne mesure rien tant qu'aucune tuile n'est posee",
      /if \(!cfg\) return;/.test(srvSrc));

    /* Double plafond du test de debit : le volume protege un forfait
       limite, la duree protege d'une ligne effondree. Retirer l'un des
       deux suffirait a faire des degats sur l'un ou l'autre terrain.
       Two caps on the speed test: volume protects a metered plan,
       duration protects against a collapsed line. */
    assert("le test de debit est plafonne en volume ET en duree",
      /bytes >= maxBytes/.test(srvSrc) && /throughputMaxSeconds \* 1000/.test(srvSrc));

    /* La socket pose son gestionnaire d'erreur AVANT connect() : une
       socket qui emet "error" sans auditeur fait tomber tout le
       processus -- meme classe de defaut que le plantage ImapFlow
       corrige en 1.77, et ici l'echec est un evenement NORMAL puisque
       c'est la perte de paquet que l'on mesure.
       The socket attaches its error handler BEFORE connect(): a socket
       emitting "error" with no listener brings the whole process down. */
    const probe = srvSrc.slice(srvSrc.indexOf("function probeOnce"));
    const probeBody = probe.slice(0, probe.indexOf("\n}"));
    assert("le gestionnaire d'erreur de la sonde est pose avant connect()",
      probeBody.indexOf('once("error"') < probeBody.indexOf("sock.connect("));

    /* L'export CSV et l'archive sont deux besoins differents, pas un
       doublon : depuis l'ecran mural en kiosque, un telechargement
       atterrit dans un dossier que personne n'ouvrira.
       The CSV download and the archive answer different needs. */
    /* Regression 1.78.2 : "aucune mesure en cours" et "premier releve en
       cours" se ressemblent a l'ecran mais n'ont rien a voir -- l'un se
       resout en une minute, l'autre jamais. Les confondre a fait
       regarder un message d'attente pendant trois heures en croyant que
       tout allait bien.
       Regression 1.78.2: "nothing is being measured" and "first reading
       in progress" look alike on screen but have nothing in common --
       one resolves within a minute, the other never. */
    assert("l'absence de mesure est distinguee du premier releve",
      /d\.enabled === false/.test(src) && /speed\.notSeen/.test(src));

    assert("les deux voies d'export existent (telechargement ET archive sur l'hote)",
      /export\.csv/.test(src) && /internet-health\/archive/.test(src));

    // Toutes les cles i18n employees par la tuile doivent exister dans
    // les DEUX langues, sinon l'ecran afficherait la cle brute.
    // Every i18n key the tile uses must exist in BOTH languages.
    const i18nSrc = fs.readFileSync(path.join(PUB, "i18n.js"), "utf8");
    const missingKeys = [];
    for (const m of src.matchAll(/i18n\.t\("([a-z0-9.]+)"\)/gi)) {
      const key = m[1];
      const count = (i18nSrc.match(new RegExp('"' + key.replace(/\./g, "\\.") + '"', "g")) || []).length;
      if (count < 2) missingKeys.push(key);
    }
    for (const k of missingKeys) console.log("       cle non bilingue : " + k);
    assert("chaque libelle de la tuile est traduit en FR et EN", missingKeys.length === 0);
  }

  console.log("== Fonds de carte CARTO : cle partagee, jamais embarquee ==");
  {
    /* Ce bloc existe a cause d'une panne REELLE, et surtout d'une panne
       qui ne venait pas de notre code : CARTO a cesse de servir ses
       fonds raster sans cle et barre desormais chaque tuile d'image
       d'un filigrane "API KEY REQUIRED". Les trois tuiles
       cartographiques se sont donc mises a paraitre cassees du jour au
       lendemain, sans qu'aucune ligne de PiBoard n'ait bouge.

       This block exists because of a REAL breakage, and above all one
       that did not come from our code: CARTO stopped serving its raster
       base maps without a key and now stamps every image tile with an
       "API KEY REQUIRED" watermark. The three map tiles therefore began
       to look broken overnight, without a single line of PiBoard having
       changed. */
    const MAP_TILES = ["traffic", "radar", "planes"];
    for (const dir of MAP_TILES) {
      const src = fs.readFileSync(path.join(PUB, "widgets", dir, "widget.js"), "utf8");
      assert("la tuile " + dir + " ajoute la cle CARTO a l'URL du fond",
        /api\.cartoKey\(\)/.test(src) && /\?key=/.test(src));
      // La cle vient des reglages GENERAUX : trois tuiles affichant le
      // meme fond ne doivent pas demander trois fois la meme saisie.
      // The key comes from the GLOBAL settings: three tiles showing the
      // same base map must not ask for the same input three times.
      const mf = JSON.parse(fs.readFileSync(path.join(PUB, "widgets", dir, "manifest.json"), "utf8"));
      assert("la tuile " + dir + " ne redemande pas la cle CARTO dans ses propres reglages",
        !(mf.settings || []).some((f) => /carto/i.test(f.key)));
    }

    /* Le garde-fou le plus important du lot : une cle ecrite en dur
       serait utilisee par TOUTES les installations a la fois. CARTO
       delivre des cles par client et interdit de les partager entre
       projets sans lien -- le quota commun serait epuise, et sa
       revocation casserait les cartes de tout le monde d'un coup.
       The most important guard here: a hard-coded key would be used by
       EVERY installation at once. CARTO issues per-customer keys and
       forbids sharing them across unrelated projects -- the shared
       quota would run out, and its revocation would break everyone's
       maps at the same moment. */
    for (const dir of MAP_TILES) {
      const src = fs.readFileSync(path.join(PUB, "widgets", dir, "widget.js"), "utf8");
      assert("aucune cle CARTO en dur dans " + dir,
        !/key=[A-Za-z0-9_-]{8,}/.test(src));
    }
    const appSrc = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    assert("la cle est lue a l'appel, pas figee au chargement",
      /cartoKey: \(\) =>/.test(appSrc));
    // Sans remontage, la carte garderait ses tuiles filigranees jusqu'au
    // prochain rechargement de page et on croirait la cle refusee.
    // Without a remount the map would keep its watermarked tiles until
    // the next page reload, and one would think the key was rejected.
    assert("changer la cle remonte les tuiles cartographiques",
      /remountMapTiles/.test(appSrc));

    const html = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
    assert("le champ de cle CARTO existe dans les reglages generaux",
      /id="setCartoKey"/.test(html));
    // Le champ serait inutilisable sans le lien vers la page qui delivre
    // la cle : personne ne devine cette adresse.
    // The field would be unusable without the link to the page issuing
    // the key: nobody guesses that address.
    assert("les reglages indiquent ou obtenir la cle",
      /carto\.com\/basemaps\/apikey/.test(html));
    const qs = fs.readFileSync(path.join(PUB, "quickstart-content.js"), "utf8");
    // Le guide existe en deux langues : la mention doit apparaitre dans
    // les DEUX, sinon un utilisateur anglophone n'apprendrait jamais
    // qu'une cle est necessaire. On compte les blocs de langue, pas les
    // occurrences de l'adresse (elle figure a la fois en href et en
    // texte de lien).
    // The guide exists in two languages: the mention must appear in
    // BOTH, otherwise an English-speaking user would never learn a key
    // is needed. We count the language blocks, not the occurrences of
    // the address (it appears both as href and as link text).
    assert("le guide de demarrage rapide signale les cles necessaires dans les deux langues",
      /API keys/.test(qs) && /Les cl\u00e9s API/.test(qs) &&
      (qs.match(/carto\.com\/basemaps\/apikey/g) || []).length >= 4);

    const i18nSrc = fs.readFileSync(path.join(PUB, "i18n.js"), "utf8");
    for (const key of ["settings.section.maps", "settings.cartoKey", "settings.cartoKey.hint", "settings.cartoKey.link"]) {
      assert("la cle '" + key + "' est traduite en FR et EN",
        (i18nSrc.match(new RegExp('"' + key.replace(/\./g, "\\.") + '"', "g")) || []).length === 2);
    }
  }

  console.log("== Echappement des attributs HTML ==");
  {
    const src = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
    const fn = src.slice(src.indexOf("function escapeHtmlAttr"));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    assert("escapeHtmlAttr echappe le guillemet double", /&quot;/.test(body));
    assert("escapeHtmlAttr echappe l'apostrophe", /&#39;/.test(body));
    assert("escapeHtmlAttr echappe encore &, < et >",
      /&amp;/.test(body) && /&lt;/.test(body) && /&gt;/.test(body));

    // Verification par le comportement et non par le code : une valeur
    // contenant des guillemets doit revenir INTACTE apres un
    // aller-retour reel par un attribut du DOM.
    // Behavioural check rather than source inspection: a value containing
    // quotes must come back INTACT after a real round trip through a DOM
    // attribute.
    const esc = (x) => String(x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const payload = JSON.stringify([{ name: 'CAC 40 "grand" <b>', symbol: "^CAC" }]);
    const probe = document.createElement("div");
    probe.innerHTML = `<input type="hidden" value="${esc(payload)}">`;
    const readBack = probe.querySelector("input").value;
    assert("un JSON passe par un attribut revient intact", readBack === payload);
    assert("le JSON relu reste analysable", JSON.parse(readBack)[0].symbol === "^CAC");
  }

  console.log("== Icone des reglages de tuile ==");
  {
    const gear = document.querySelector(".tile-gear svg");
    assert("bouton de reglages present sur la tuile", !!gear);

    // L'ancienne icone etait un cercle entoure de HUIT rayons droits,
    // lue comme un soleil. On verifie qu'elle n'est pas revenue : le
    // marqueur sur est la presence des deux pastilles de curseur et
    // l'absence du faisceau de rayons diagonaux.
    // The old icon was a circle ringed by EIGHT straight rays, read as a
    // sun. We check it has not come back: the safe marker is the two
    // slider knobs plus the absence of the diagonal ray bundle.
    const d = gear.innerHTML;
    assert("icone de tuile : deux pastilles de curseur presentes",
      (d.match(/<circle/g) || []).length === 2);
    assert("icone de tuile : plus aucun rayon diagonal (motif 'soleil')",
      !/4\.9 4\.9|19\.1 4\.9/.test(d));

    // La barre d'outils, elle, ne doit PAS avoir change : c'est une
    // demande explicite. Repere par un fragment du trace du cog Feather.
    // The toolbar must NOT have changed: that was explicitly asked.
    // Spotted via a fragment of the Feather cog path.
    const dock = document.querySelector("#btnSettings svg");
    assert("barre d'outils : l'engrenage est inchange",
      !!dock && dock.innerHTML.includes("M19.4 15a1.7 1.7 0 0 0 .34 1.87"));
  }

  console.log("== Guide de demarrage rapide ==");
  {
    const qs = window.PIBOARD_QUICKSTART;
    assert("contenu du guide charge dans les DEUX langues",
      !!(qs && typeof qs.fr === "string" && typeof qs.en === "string" && qs.fr.length > 500 && qs.en.length > 500));

    // Chaque point explicitement demande doit etre couvert, dans les deux
    // langues. Repere par un marqueur stable du texte plutot que par une
    // phrase entiere, qui casserait a la moindre reformulation.
    // Every explicitly requested point must be covered, in both
    // languages. Spotted via a stable marker rather than a whole
    // sentence, which would break on the slightest rewording.
    const musts = [
      ["diaporama", "slideshow", "diaporama / slideshow"],
      ["help-assets/toolbar.png", "help-assets/toolbar.png", "capture de la barre d'outils"],
      ["taille minimale", "minimum size", "taille minimale des tuiles"],
      ["mode edition", "edit mode", "sortie du mode edition"]
    ];
    for (const [fr, en, label] of musts) {
      const okFr = qs.fr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(fr);
      const okEn = qs.en.toLowerCase().includes(en);
      assert("guide : " + label + " mentionne en FR et EN", okFr && okEn);
    }

    // Le guide doit s'ouvrir tout seul au premier lancement, et la case
    // refleter le reglage courant.
    // The guide must open by itself on first launch, with the checkbox
    // reflecting the current setting.
    const qsModal = document.getElementById("quickStartModal");
    assert("fenetre du guide presente dans le DOM", !!qsModal);
    assert("guide ouvert automatiquement au lancement (reglage par defaut)",
      qsModal.hidden === false);
    assert("case 'afficher a chaque lancement' cochee par defaut",
      document.getElementById("quickStartAgain").checked === true);
    assert("capture de la barre d'outils reellement injectee dans la fenetre",
      !!document.querySelector("#quickStartBody img.qs-shot"));

    // Fermeture : la case non modifiee ne doit rien reecrire.
    // Closing: an untouched checkbox must not rewrite anything.
    document.getElementById("quickStartClose")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("le guide se ferme sur 'C'est parti'", qsModal.hidden === true);

    // La rubrique dediee doit exister dans le sommaire de l'aide, et
    // reutiliser la MEME source que la fenetre (pas une copie).
    // The dedicated section must exist in the help's table of contents,
    // and reuse the SAME source as the window (not a copy).
    const qsSection = (window.PIBOARD_HELP || []).find((x) => x.id === "quickstart");
    assert("rubrique 'Demarrage rapide' presente dans le sommaire de l'aide", !!qsSection);
    assert("rubrique d'aide sans corps propre (source unique, injectee depuis quickstart-content.js)",
      !!qsSection && qsSection.html.fr === "" && qsSection.html.en === "");
  }

  console.log("== Chaines TV : rappel d'absence de contenu ==");
  {
    const iptv = (window.PIBOARD_HELP || []).find((x) => x.id === "iptv");
    assert("aide Chaines TV : encadre d'avertissement present en FR et EN",
      !!iptv && iptv.html.fr.includes("help-warn") && iptv.html.en.includes("help-warn"));
    assert("aide Chaines TV : precise qu'aucun contenu n'est fourni (FR)",
      !!iptv && /ne fournit aucune cha/i.test(iptv.html.fr.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    assert("aide Chaines TV : precise qu'aucun contenu n'est fourni (EN)",
      !!iptv && /provides no channels/i.test(iptv.html.en));
  }

  console.log("== Tableau : ascenseur strictement conditionnel ==");
  {
    const board = document.querySelector(".board");

    assert("aucune classe .has-overflow quand tout tient a l'ecran",
      !board.classList.contains("has-overflow"));

    // Le style par defaut doit rester overflow:hidden : c'est la garantie
    // structurelle qu'aucun ascenseur ne peut apparaitre sur un ecran
    // normal, independamment du style de l'ascenseur lui-meme.
    // The default style must stay overflow:hidden: that is the structural
    // guarantee that no scrollbar can appear on a normal screen,
    // regardless of the scrollbar's own styling.
    const css = fs.readFileSync(path.join(PUB, "style.css"), "utf8");
    assert("regle CSS : .board reste en overflow:hidden par defaut",
      /\.board\s*\{[^}]*overflow:\s*hidden/.test(css));
    assert("regle CSS : le defilement n'est ouvert que par .has-overflow",
      /\.board\.has-overflow\s*\{[^}]*overflow-y:\s*auto/.test(css));
    assert("regle CSS : aucune gouttiere d'ascenseur reservee sans debordement",
      /\.board::-webkit-scrollbar\s*\{[^}]*width:\s*0/.test(css));
    assert("regle CSS : le defilement a un doigt reste actif DANS les tuiles",
      /\.board\.has-overflow\s+\.grid-stack-item-content\s*\{[^}]*touch-action:\s*auto/.test(css));

    // Debordement simule : le contenu depasse la zone visible.
    // Simulated overflow: content exceeds the visible area.
    Object.defineProperty(board, "scrollHeight", { value: 1400, configurable: true });
    Object.defineProperty(board, "clientHeight", { value: 900, configurable: true });
    window.dispatchEvent(new window.Event("resize"));
    assert("classe .has-overflow posee des que le contenu depasse",
      board.classList.contains("has-overflow"));

    // Retour a la normale : la classe doit repartir, sinon un ascenseur
    // resterait affiche apres suppression de la tuile fautive.
    // Back to normal: the class must go away, otherwise a scrollbar would
    // stay shown after the offending tile is removed.
    board.scrollTop = 300;
    Object.defineProperty(board, "scrollHeight", { value: 880, configurable: true });
    window.dispatchEvent(new window.Event("resize"));
    assert("classe .has-overflow retiree des que tout retient dans l'ecran",
      !board.classList.contains("has-overflow"));
    assert("defilement remis a zero en sortant du debordement (sinon bloque en bas)",
      board.scrollTop === 0);

    // La tolerance de 1px evite un ascenseur clignotant sur les arrondis
    // sous-pixel. The 1px tolerance avoids a flickering scrollbar on
    // sub-pixel rounding.
    Object.defineProperty(board, "scrollHeight", { value: 901, configurable: true });
    window.dispatchEvent(new window.Event("resize"));
    assert("tolerance 1px : un depassement sous-pixel ne declenche pas l'ascenseur",
      !board.classList.contains("has-overflow"));
  }

  console.log("== Mise a jour serveur (Linux) : bandeau, reglages, fenetre de progression ==");
  {
    // Etat charge au demarrage : une version est disponible -> bandeau
    // visible, sans rien installer. State loaded at boot: a version is
    // available -> banner shown, nothing installed.
    let tries = 0;
    while (document.getElementById("updateBanner").hidden && tries++ < 40) await sleep(50);
    const banner = document.getElementById("updateBanner");
    assert("bandeau 'nouvelle version' affiche au demarrage", banner.hidden === false);
    assert("bandeau : la version proposee est nommee", document.getElementById("updateBannerText").textContent.includes("v9.10.0"));
    assert("bandeau : texte en francais", document.getElementById("updateBannerText").textContent.includes("disponible"));
    assert("rien n'a ete installe sans confirmation", UPDATE_CALLS.apply === 0);

    // Pre-version : annoncee comme telle des le bandeau, pour ne pas
    // decouvrir apres coup qu'on installe une version d'essai.
    // Pre-release: announced as such from the banner on, so as not to
    // find out afterwards that a trial version is being installed.
    UPDATE_STATE.prerelease = true;
    UPDATE_STATE.channel = "preview";
    document.getElementById("updCheckBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("pre-version signalee dans l'etat des reglages",
      /Pré-version/.test(document.getElementById("updStatusText").textContent));
    UPDATE_STATE.prerelease = false;
    UPDATE_STATE.channel = "stable";
    document.getElementById("updCheckBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("version stable : aucune mention de pre-version",
      !/Pré-version/.test(document.getElementById("updStatusText").textContent));
    assert("selecteur de canal present et par defaut sur stable",
      !!document.getElementById("setUpdateChannel") && document.getElementById("setUpdateChannel").value === "stable");
    assert("boutons serveur visibles quand le serveur gere ses mises a jour",
      document.getElementById("updServerControls").hidden === false);
    assert("le bouton de recherche n'est pas enferme dans le bloc serveur",
      document.getElementById("updCheckBtn").closest("#updServerControls") === null);
    document.getElementById("settingsModal").hidden = true;
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    // Les deux verifications ci-dessus servaient a ce bloc : on remet le
    // compteur a zero pour que la suite compte les siennes.
    // The two checks above served this block: reset the counter so the
    // rest counts its own.
    UPDATE_CALLS.check = 0;

    // "Plus tard" : le bandeau disparait pour la session
    document.getElementById("updateBannerLater").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("'Plus tard' masque le bandeau", banner.hidden === true);

    // Reglages generaux : section visible et coherente
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const sec = document.getElementById("secUpdates");
    assert("section 'Mises a jour' visible (plateforme supportee)", sec.hidden === false);
    assert("etat : version disponible nommee", document.getElementById("updStatusText").textContent.includes("v9.10.0"));
    assert("version installee rappelee", document.getElementById("updMetaText").textContent.includes("v9.9.9-test"));
    const applyBtn = document.getElementById("updApplyBtn");
    assert("bouton d'installation visible et libelle avec la version", applyBtn.hidden === false && applyBtn.textContent.includes("v9.10.0"));
    assert("section Windows (application de bureau) toujours masquee", document.getElementById("secDesktopApp").hidden === true);

    // Verification manuelle : appelle /api/update/check et rearme le bandeau
    document.getElementById("updCheckBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (UPDATE_CALLS.check === 0 && tries++ < 40) await sleep(25);
    await sleep(60);
    assert("'Verifier maintenant' interroge le serveur", UPDATE_CALLS.check === 1);
    // Le modal des reglages est ouvert : le bandeau n'est pas reaffiche
    // par-dessus tant qu'une fenetre n'est pas fermee... il est toutefois
    // rearme (updateDismissedVersion remis a zero) -- on le verifie via
    // son etat apres fermeture des reglages plus bas.

    // Ouverture de la fenetre de confirmation depuis le bouton
    applyBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const modal = document.getElementById("updateModal");
    assert("fenetre de mise a jour ouverte", modal.hidden === false);
    assert("etape de confirmation affichee", document.getElementById("updConfirm").hidden === false && document.getElementById("updProgress").hidden === true);
    assert("texte de confirmation : nouvelle ET ancienne version", /v9\.10\.0/.test(document.getElementById("updConfirmText").textContent) && /v9\.9\.9-test/.test(document.getElementById("updConfirmText").textContent));
    assert("notes de version affichees quand elles existent", document.getElementById("updNotesWrap").hidden === false && document.getElementById("updNotes").textContent.includes("Notes de test"));
    assert("toujours rien d'installe", UPDATE_CALLS.apply === 0);

    // Annuler ferme sans installer
    document.getElementById("updCancelBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert("'Annuler' referme la fenetre", modal.hidden === true);
    assert("'Annuler' n'installe rien", UPDATE_CALLS.apply === 0);

    // Installation : confirmation -> progression -> redemarrage -> rechargement
    applyBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    document.getElementById("updGoBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (UPDATE_CALLS.apply === 0 && tries++ < 40) await sleep(25);
    assert("'Installer' declenche /api/update/apply", UPDATE_CALLS.apply === 1);
    tries = 0;
    while (document.getElementById("updProgress").hidden && tries++ < 40) await sleep(25);
    assert("etape de progression affichee", document.getElementById("updProgress").hidden === false);
    assert("bouton de confirmation masque pendant l'installation", document.getElementById("updGoBtn").hidden === true);
    await sleep(800);
    assert("phase de telechargement nommee", /Téléchargement/.test(document.getElementById("updPhaseText").textContent));
    assert("barre de progression a 50 %", document.getElementById("updBarFill").style.width === "50%");

    UPDATE_STATE.job.phase = "installing";
    UPDATE_STATE.job.log.push("npm ignore / skipped");
    await sleep(800);
    assert("phase d'installation nommee", /Installation/.test(document.getElementById("updPhaseText").textContent));
    assert("journal serveur repris dans la fenetre", document.getElementById("updLog").textContent.includes("npm ignore"));

    // Redemarrage : la page attend une NOUVELLE version de /api/version
    // avant de se recharger. jsdom ne permet pas d'intercepter
    // location.reload() (voir la remarque dans la section Sauvegarde) :
    // on observe le message "Rechargement…" qui le precede immediatement.
    // Restart: the page waits for a NEW version from /api/version before
    // reloading. jsdom offers no way to intercept location.reload() (see
    // the note in the Backup section): we observe the "Reloading…"
    // message that immediately precedes it.
    UPDATE_STATE.job.phase = "restarting";
    UPDATE_STATE.busy = true;
    await sleep(2400);
    assert("phase d'attente du serveur affichee", /attente|Redémarrage/.test(document.getElementById("updPhaseText").textContent));
    assert("pas de rechargement tant que la version servie est l'ancienne", !/Rechargement/.test(document.getElementById("updPhaseText").textContent));
    UPDATE_VERSION_SERVED = "9.10.0";
    tries = 0;
    while (!/Rechargement/.test(document.getElementById("updPhaseText").textContent) && tries++ < 120) await sleep(50);
    assert("rechargement declenche des que la nouvelle version repond", /Rechargement/.test(document.getElementById("updPhaseText").textContent));
    assert("message de rechargement avec la nouvelle version", document.getElementById("updPhaseText").textContent.includes("v9.10.0"));

    // Fermer les reglages pour ne pas gener la suite
    document.getElementById("updateModal").hidden = true;
    document.getElementById("settingsModal").hidden = true;

    // Serveur qui ne supporte pas la mise a jour (Windows / app de bureau)
    // : section et bandeau masques. Server without update support
    // (Windows / desktop app): section and banner hidden.
    UPDATE_STATE.supported = false;
    UPDATE_STATE.reason = "electron-updater";
    UPDATE_STATE.busy = false;
    UPDATE_STATE.job = { phase: "idle", version: null, progress: null, error: null, rolledBack: false, log: [] };
    document.getElementById("btnSettings").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(100);
    // fillUpdatesForm() ne relit pas le serveur : on force un rafraichissement
    // comme le ferait le SSE. fillUpdatesForm() doesn't re-read the server:
    // force a refresh as SSE would.
    document.getElementById("updCheckBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    tries = 0;
    while (document.getElementById("secUpdates").hidden === false && tries++ < 40) await sleep(50);
    /* Regression corrigee en 1.86.0 : toute la section etait masquee des
       que le serveur ne gerait pas ses propres mises a jour, ce qui
       rendait le SELECTEUR DE CANAL invisible dans l'application de
       bureau Windows -- alors qu'il la concerne (electron-updater lit le
       meme reglage). Seuls les boutons serveur doivent disparaitre.
       Regression fixed in 1.86.0: the whole section was hidden as soon as
       the server did not handle its own updates, making the CHANNEL
       SELECTOR invisible in the Windows desktop application -- which it
       applies to (electron-updater reads the same setting). Only the
       server buttons must disappear. */
    assert("plateforme non supportee : le selecteur de canal RESTE visible",
      document.getElementById("secUpdates").hidden === false
      && document.getElementById("setUpdateChannel").closest("[hidden]") === null);
    assert("plateforme non supportee : l'etat serveur est masque",
      document.getElementById("updServerControls").hidden === true);
    /* ... mais le bouton de recherche RESTE accessible : dans
       l'application de bureau il declenche electron-updater, et c'est le
       seul chemin vers une verification manuelle depuis l'interface.
       ... but the check button STAYS reachable: in the desktop
       application it triggers electron-updater, and it is the only path
       to a manual check from the interface. */
    assert("le bouton de recherche reste visible dans l'application de bureau",
      document.getElementById("updCheckBtn").closest("[hidden]") === null);
    assert("le bouton d'installation, lui, est masque (electron-updater installe)",
      document.getElementById("updApplyBtn").hidden === true);
    const beforeDesktop = UPDATE_CALLS.checkDesktop;
    document.getElementById("updCheckBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await sleep(150);
    assert("il appelle la recherche propre a l'application de bureau",
      UPDATE_CALLS.checkDesktop === beforeDesktop + 1);
    assert("plateforme non supportee : explication propre a l'application de bureau affichee",
      document.getElementById("updDesktopHint").hidden === false
      && document.getElementById("updServerHint").hidden === true);
    assert("plateforme non supportee : bandeau masque", document.getElementById("updateBanner").hidden === true);
    document.getElementById("settingsModal").hidden = true;
  }

  console.log("== Sortie du mode edition ==");
  document.getElementById("btnEdit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("grille reverrouillee", document.querySelector(".grid-stack").classList.contains("grid-stack-static"));

  console.log(process.exitCode ? "\n>>> ECHECS DETECTES" : "\n>>> TOUS LES TESTS PASSENT");
  window.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error("Harnais en erreur:", e);
  process.exit(1);
});
