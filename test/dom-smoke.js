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

const layout = {
  version: 1,
  tiles: [
    { id: "t-a", widget: "clock", x: 0, y: 0, w: 3, h: 2, settings: { mode: "digital", showDate: true } },
    { id: "t-b", widget: "webview", x: 3, y: 0, w: 6, h: 4, settings: { url: "http://example.local/", zoom: 100, reload: 0 } },
    { id: "t-c", widget: "notes", x: 0, y: 2, w: 3, h: 3, settings: {} }
  ]
};

const settings = { lang: "fr", theme: "dark", latitude: 43.6, longitude: 1.44, gridRows: 8 };
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
  while (document.querySelectorAll(".grid-stack-item").length < 3 && tries++ < 60) await sleep(100);

  console.log("== Boot ==");
  assert("3 tuiles montees", document.querySelectorAll(".grid-stack-item").length === 3);
  assert("horloge affichee (heure presente)", /\d{2}:\d{2}/.test(document.querySelector(".pwc-time")?.textContent || ""));
  assert("bloc-notes charge depuis le serveur", (document.querySelector(".pw-notes .pwn-view")?.textContent || "").includes("note de test"));
  assert("webview en iframe", !!document.querySelector(".pw-webview iframe"));
  assert("i18n FR appliquee", document.documentElement.lang === "fr");
  assert("grille statique au depart (verrouillee)", document.querySelector(".grid-stack").classList.contains("grid-stack-static"));

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
  assert("tuile ajoutee (4 au total)", document.querySelectorAll(".grid-stack-item").length === 4);

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
