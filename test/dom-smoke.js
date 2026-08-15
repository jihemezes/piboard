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
const AQ_IN2DAYS = new Date(AQ_TODAY.getFullYear(), AQ_TODAY.getMonth(), AQ_TODAY.getDate() + 2, 14, 0, 0);
const AQ_IN2DAYS_END = new Date(AQ_IN2DAYS.getTime() + 3600000);
const FAMILY_ICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:fam1@test\r\nDTSTART;VALUE=DATE:${icsDateOnly(AQ_TODAY)}\r\nSUMMARY:Anniversaire Lea\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const WORK_ICS = "\uFEFF" + `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:work1@test\r\nDTSTART:${icsDateTime(AQ_IN2DAYS)}\r\nDURATION:PT1H\r\nSUMMARY:Reunion equipe\r\nLOCATION:Salle B\r\nEND:VEVENT\r\nEND:VCALENDAR`;

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
    } }
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
      if (u.includes("/api/version")) {
        return json({ version: "9.9.9-test" });
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
        if (u.includes("/api/settings")) return json(settings);
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

(async () => {
  /* Attendre le boot / wait for boot */
  let tries = 0;
  while (document.querySelectorAll(".grid-stack-item").length < 20 && tries++ < 60) await sleep(100);

  console.log("== Boot ==");
  assert("20 tuiles montees", document.querySelectorAll(".grid-stack-item").length === 20);
  assert("horloge affichee (heure presente)", /\d{2}:\d{2}/.test(document.querySelector(".pwc-time")?.textContent || ""));
  assert("bloc-notes charge depuis le serveur", (document.querySelector(".pw-notes .pwn-view")?.textContent || "").includes("note de test"));
  assert("webview en iframe", !!document.querySelector(".pw-webview iframe"));
  assert("i18n FR appliquee", document.documentElement.lang === "fr");
  assert("grille statique au depart (verrouillee)", document.querySelector(".grid-stack").classList.contains("grid-stack-static"));

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

  {
    const weatherIdx = catalog.findIndex((m) => m.id === "weather");
    const weatherItem = document.querySelectorAll("#catalogList .catalog-item-wrap")[weatherIdx];
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
  assert("tuile ajoutee (21 au total)", document.querySelectorAll(".grid-stack-item").length === 21);

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
    document.querySelectorAll("#catalogList .catalog-item")[webviewIndex]
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
    document.querySelectorAll("#catalogList .catalog-item")[webviewIndex]
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
    document.querySelectorAll("#catalogList .catalog-item")[webviewIndex]
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
    document.querySelectorAll("#catalogList .catalog-item")[slideshowIndex]
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
    document.querySelectorAll("#catalogList .catalog-item")[tpIndex]
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
    document.querySelectorAll("#catalogList .catalog-item")[standingsIndex]
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
