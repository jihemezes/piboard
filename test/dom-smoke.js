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
      if (u.includes("/api/tele-program")) {
        // Reponse mock : une chaine avec un programme inedit + une sans
        const viewMatch = u.match(/[?&]view=([^&]+)/);
        return json({
          view: viewMatch ? viewMatch[1] : "now",
          generatedAt: new Date().toISOString(),
          channels: [
            { channelId: "TF1.fr", channelName: "TF1", channelIcon: null,
              program: { start: new Date().toISOString(), stop: new Date(Date.now() + 3600000).toISOString(),
                title: "Film de test", subtitle: null, desc: "Un synopsis de test.", category: "Film", icon: null, isNew: true } },
            { channelId: "France2.fr", channelName: "France 2", channelIcon: null, program: null }
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
        return Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: "no readable content" }) });
      }
      if (u.includes("/api/proxy") && u.includes("feed.test")) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(RSS_FEED_XML) });
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
  while (document.querySelectorAll(".grid-stack-item").length < 14 && tries++ < 60) await sleep(100);

  console.log("== Boot ==");
  assert("14 tuiles montees", document.querySelectorAll(".grid-stack-item").length === 14);
  assert("horloge affichee (heure presente)", /\d{2}:\d{2}/.test(document.querySelector(".pwc-time")?.textContent || ""));
  assert("bloc-notes charge depuis le serveur", (document.querySelector(".pw-notes .pwn-view")?.textContent || "").includes("note de test"));
  assert("webview en iframe", !!document.querySelector(".pw-webview iframe"));
  assert("i18n FR appliquee", document.documentElement.lang === "fr");
  assert("grille statique au depart (verrouillee)", document.querySelector(".grid-stack").classList.contains("grid-stack-static"));

  console.log("== Saint du jour (Horloge + Meteo) ==");
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
    assert("reglages avions : ville, reseau ADS-B, rayon, zoom, fond de carte, etiquettes, trainees, max, rafraichissement",
      ["city", "source", "radius", "zoom", "basemap", "showLabels", "showTrails", "maxPlanes", "refresh"].every((k) => keys.includes(k)));
    const sourceSetting = planesManifest.settings.find((s) => s.key === "source");
    assert("reseau ADS-B : choix entre adsb.lol et adsb.fi expose dans les reglages",
      (sourceSetting?.options || []).map((o) => o.value).sort().join(",") === "adsbfi,adsblol");
  }

  console.log("== Flux RSS : article cliquable, popup de lecture nettoyee ==");
  tries = 0;
  while (!document.querySelector(".pw-rss .pwr-item") && tries++ < 60) await sleep(50);
  const rssItems = [...document.querySelectorAll(".pw-rss .pwr-item")];
  assert("3 articles affiches", rssItems.length === 3);
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

  await sleep(3100); // laisse le temps a une bascule complete (toutes les 3s) / lets a full toggle happen (every 3s)
  assert("apres un cycle : la visibilite heure/date a bien bascule vers l'oppose",
    dateEl.hidden === !dateWasHidden && timeEl.hidden === dateWasHidden);

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
  assert("tuile ajoutee (15 au total)", document.querySelectorAll(".grid-stack-item").length === 15);

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
    const urlInput = document.querySelector('#tileForm [data-key="url"]');
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
    assert("tuile reutilise l'URL enregistree",
      !!restoredTile.querySelector('iframe[src="http://umbrel.local:1234/"]'));

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
