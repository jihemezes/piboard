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
const WORK_ICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:work1@test\r\nDTSTART:${icsDateTime(AQ_IN2DAYS)}\r\nDTEND:${icsDateTime(AQ_IN2DAYS_END)}\r\nSUMMARY:Reunion equipe\r\nLOCATION:Salle B\r\nEND:VEVENT\r\nEND:VCALENDAR`;

const RSS_FEED_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>Flux Test</title>
<item>
<title>Article avec lien</title>
<link>https://example.test/article1</link>
<pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>
<content:encoded><![CDATA[<p>Contenu <b>riche</b> de l'article.</p><script>window.__pwnedRss = true;</script><a href="https://example.test/other" onclick="window.__pwnedRss = true;">lien interne</a>]]></content:encoded>
</item>
<item>
<title>Article sans lien</title>
<pubDate>Mon, 20 Jul 2026 09:00:00 GMT</pubDate>
<description>Pas de lien ici.</description>
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

const layout = {
  version: 1,
  tiles: [
    { id: "t-a", widget: "clock", x: 0, y: 0, w: 3, h: 2, settings: { mode: "digital", showDate: true, showSaint: true } },
    { id: "t-b", widget: "webview", x: 3, y: 0, w: 6, h: 4, settings: { url: "http://example.local/", zoom: 100, reload: 0 } },
    { id: "t-c", widget: "notes", x: 0, y: 2, w: 3, h: 3, settings: {} },
    { id: "t-d", widget: "weather", x: 6, y: 0, w: 3, h: 2, settings: { city: "Toulouse", showSaint: true, showTomorrow: true, usePhotos: false } },
    { id: "t-e", widget: "airquality", x: 9, y: 0, w: 3, h: 2, settings: { city: "Toulouse", displayMode: "detailed", showPollen: true } },
    { id: "t-f", widget: "calendar", x: 0, y: 5, w: 4, h: 4, settings: { calendars: "https://cal.test/family.ics|Famille\nhttps://cal.test/work.ics|Travail" } },
    { id: "t-g", widget: "rss", x: 4, y: 5, w: 4, h: 3, settings: { url: "https://feed.test/rss.xml", maxItems: 6, showSource: true } },
    { id: "t-h", widget: "sportscore", x: 8, y: 5, w: 4, h: 3, settings: { league: "soccer:fifa.world", maxItems: 5 } }
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
      if (u.includes("/api/proxy") && u.includes("site.api.espn.com") && u.includes("scoreboard")) {
        return json(ESPN_SCOREBOARD_FIXTURE);
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
      if (u.includes("api.open-meteo.com/v1/forecast")) {
        return json({
          current: { temperature_2m: 21, weather_code: 0, wind_speed_10m: 12 },
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
  while (document.querySelectorAll(".grid-stack-item").length < 8 && tries++ < 60) await sleep(100);

  console.log("== Boot ==");
  assert("8 tuiles montees", document.querySelectorAll(".grid-stack-item").length === 8);
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
    assert("reglages radar : ville, zoom, fond de carte, opacite, prevision, lecture auto, vitesse, rafraichissement",
      ["city", "zoom", "basemap", "opacity", "includeForecast", "autoplay", "animationSpeed", "refresh"].every((k) => keys.includes(k)));
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
  assert("2 articles affiches", rssItems.length === 2);
  const linkedItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article avec lien");
  const unlinkedItem = rssItems.find((li) => li.querySelector(".pwr-title")?.textContent === "Article sans lien");
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
  assert("popup : source et date affichees dans le meta", (document.querySelector(".pwr-modal-meta")?.textContent || "").includes("Flux Test"));
  const rssBody = document.querySelector(".pwr-modal-body");
  assert("popup : contenu HTML riche affiche (gras conserve)", rssBody?.innerHTML.includes("<b>riche</b>"));
  assert("popup : script embarque retire (non execute)", !window.__pwnedRss);
  assert("popup : balise <script> absente du HTML injecte", !rssBody?.innerHTML.includes("<script"));
  assert("popup : gestionnaire onclick retire du lien interne", !rssBody?.innerHTML.includes("onclick"));
  assert("popup : href retire du lien interne (contenu fait pour etre lu, pas navigue)", !rssBody?.querySelector("a")?.getAttribute("href"));
  assert("popup : texte du lien interne conserve", rssBody?.textContent.includes("lien interne"));

  rssModal.querySelector(".modal-close[data-close]")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(20);
  assert("popup refermee par le bouton", rssModal.hidden === true);

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
  assert("etat initial : heure visible, date cachee", timeEl.hidden === false && dateEl.hidden === true);
  const expectedDDMM = String(SPORT_TOMORROW.getDate()).padStart(2, "0") + "/" + String(SPORT_TOMORROW.getMonth() + 1).padStart(2, "0");
  assert("date au format jj/mm correct", dateEl.textContent === expectedDDMM);

  await sleep(3100); // laisse le temps a la premiere bascule (toutes les 3s) / lets the first toggle happen (every 3s)
  assert("apres bascule : date visible, heure cachee", dateEl.hidden === false && timeEl.hidden === true);

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
  assert("layout sauvegarde (PUT recu)", putCalls.some((c) => c.url.includes("/api/layout")));

  console.log("== Catalogue ==");
  document.getElementById("btnAdd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("catalogue ouvert avec " + catalog.length + " widgets",
    document.querySelectorAll("#catalogList .catalog-item").length === catalog.length);
  document.querySelector("#catalogList .catalog-item").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(200);
  assert("tuile ajoutee (9 au total)", document.querySelectorAll(".grid-stack-item").length === 9);

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
