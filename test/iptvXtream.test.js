/* PiBoard - test/iptvXtream.test.js

   Connexion Xtream par CHAMPS SEPARES (1.160.0) : adresse + identifiant +
   mot de passe, le mot de passe vivant dans le coffre chiffre du serveur.

   Ces tests montent un FAUX panneau Xtream en HTTP local (module `http`
   de Node, aucune dependance), puis le VRAI serveur PiBoard sur un dossier
   de donnees temporaire, et interrogent les routes comme le fait la tuile.
   Ils verifient ce qui compte vraiment ici :
     - que le mot de passe pris dans le coffre arrive bien au panneau ;
     - qu'il n'apparait JAMAIS dans le coffre en clair, dans la
       disposition, dans une reponse de route a part les URL de lecture
       qui en ont besoin, ni dans les journaux ;
     - que chaque cause d'echec donne un code et un message DISTINCTS
       (identifiants refuses, expire, banni, injoignable, panneau qui
       n'est pas Xtream...) ;
     - que l'URL conservee pour une programmation ne contient pas le mot
       de passe, et le retrouve par le coffre.

   Xtream connection by SEPARATE FIELDS (1.160.0): the password lives in
   the server's encrypted vault. These tests start a FAKE Xtream panel
   over local HTTP, then the REAL PiBoard server on a temporary data
   folder, and query the routes the way the tile does. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

let ok = 0;
function check(label, cond, extra) {
  if (!cond) {
    console.error("  FAIL " + label + (extra ? " -- " + extra : ""));
    process.exitCode = 1;
  } else {
    console.log("  OK   " + label);
    ok++;
  }
}

/* Dossier de donnees isole, AVANT de charger le serveur (store.js lit la
   variable a l'import). Isolated data folder, BEFORE loading the server. */
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-xtream-"));
process.env.PIBOARD_DATA = DATA;
process.env.PIBOARD_UPDATE_CHECK = "0";

const iptv = require("../server/iptv.js");

const PASSWORD = "S3cr3t-pw-ZQ91";

/* ---------------------------------------------------------------- */
console.log("== normalizeXtreamServer : ce que les gens tapent vraiment ==");
{
  const n = iptv.normalizeXtreamServer;
  check("adresse complete conservee", n("http://srv.test:8080") === "http://srv.test:8080");
  check("sans schema : http:// ajoute", n("srv.test:8080") === "http://srv.test:8080");
  check("barre finale retiree", n("http://srv.test:8080/") === "http://srv.test:8080");
  check("chemin de panneau retire (/c/)", n("http://srv.test:8080/c/") === "http://srv.test:8080");
  check("player_api.php colle en entier", n("http://srv.test/player_api.php?username=a&password=b") === "http://srv.test");
  check("lien get.php colle en entier", n("http://srv.test:80/get.php?username=a&password=b&type=m3u_plus") === "http://srv.test");
  check("https conserve", n("https://srv.test") === "https://srv.test");
  check("espaces autour ignores", n("  http://srv.test:8080  ") === "http://srv.test:8080");
  check("vide refuse", n("") === null && n("   ") === null && n(null) === null);
  check("protocole non http refuse", n("ftp://srv.test") === null && n("file:///etc/passwd") === null);
}

console.log("== redactSecrets : rien de sensible dans les journaux ==");
{
  const r = iptv.redactSecrets;
  const a = r("GET http://srv.test/get.php?username=bob&password=" + PASSWORD + "&type=m3u");
  check("parametres username/password masques", !a.includes("bob") && !a.includes(PASSWORD) && a.includes("type=m3u"), a);
  const b = r("Opening http://srv.test:8080/live/bob/" + PASSWORD + "/123.ts failed");
  check("chemin /live/id/mdp/ masque", !b.includes("bob") && !b.includes(PASSWORD) && b.includes("/123.ts"), b);
  const c = r("http://srv.test/movie/bob/" + PASSWORD + "/9.mkv et http://srv.test/series/bob/" + PASSWORD + "/7.mp4");
  check("film et serie masques aussi", !c.includes(PASSWORD) && !c.includes("bob"), c);
  check("texte sans identifiants inchange", r("ffmpeg exited with code 1") === "ffmpeg exited with code 1");
  check("null/undefined sans erreur", r(null) === "" && r(undefined) === "");
}

console.log("== maskPassword / unmaskPassword : l'URL conservee ==");
{
  const url = "http://srv.test/live/bob/" + PASSWORD + "/12.ts";
  const masked = iptv.maskPassword(url, PASSWORD);
  check("le mot de passe disparait de l'URL conservee", !masked.includes(PASSWORD), masked);
  check("le marqueur le remplace", masked.includes(iptv.PASSWORD_PLACEHOLDER));
  check("aller-retour exact", iptv.unmaskPassword(masked, PASSWORD) === url);
  check("sans mot de passe : inchange", iptv.maskPassword(url, "") === url);
}

console.log("== resolveXtreamCreds : lien historique OU champs + coffre ==");
{
  const vault = { "t1": PASSWORD };
  const getSecret = (tile, key) => (key === "xtreamPassword" ? vault[tile] || null : null);
  const legacy = iptv.resolveXtreamCreds({ url: "http://srv.test:8080/get.php?username=u1&password=p1&type=m3u_plus" }, getSecret);
  check("lien historique : serveur, identifiant, mot de passe extraits",
    legacy.creds && legacy.creds.server === "http://srv.test:8080" && legacy.creds.username === "u1" && legacy.creds.password === "p1");
  const legacyBad = iptv.resolveXtreamCreds({ url: "http://srv.test/liste.m3u" }, getSecret);
  check("lien historique sans identifiants : not-configured", legacyBad.error && legacyBad.error.code === "not-configured");

  const f = iptv.resolveXtreamCreds({ tile: "t1", server: "srv.test:8080/", user: " u1 " }, getSecret);
  check("champs : mot de passe pris dans le coffre, serveur et identifiant normalises",
    f.creds && f.creds.server === "http://srv.test:8080" && f.creds.username === "u1" && f.creds.password === PASSWORD);
  const typed = iptv.resolveXtreamCreds({ tile: "t1", server: "srv.test", user: "u1", password: "saisi" }, getSecret);
  check("mot de passe saisi (test non enregistre) prioritaire sur le coffre", typed.creds && typed.creds.password === "saisi");
  check("tuile sans mot de passe : no-password",
    iptv.resolveXtreamCreds({ tile: "inconnue", server: "srv.test", user: "u1" }, getSecret).error.code === "no-password");
  check("serveur manquant : not-configured",
    iptv.resolveXtreamCreds({ tile: "t1", user: "u1" }, getSecret).error.code === "not-configured");
  check("identifiant manquant : not-configured",
    iptv.resolveXtreamCreds({ tile: "t1", server: "srv.test" }, getSecret).error.code === "not-configured");
  check("adresse invalide : bad-server",
    iptv.resolveXtreamCreds({ tile: "t1", server: "ftp://x", user: "u1" }, getSecret).error.code === "bad-server");
}

console.log("== messages : un code, deux langues, jamais vide ==");
{
  for (const code of Object.keys(iptv.XTREAM_MESSAGES)) {
    const m = iptv.XTREAM_MESSAGES[code];
    check("message FR et EN pour « " + code + " »", !!(m.fr && m.en && m.fr !== m.en));
  }
  const j = new iptv.XtreamError("expired").toJSON();
  check("XtreamError.toJSON porte le code et le message bilingue", j.code === "expired" && !!j.message.fr && !!j.message.en);
  const msgs = new Set(Object.values(iptv.XTREAM_MESSAGES).map((m) => m.fr));
  check("aucun message FR en double (deux etats distincts, deux messages)", msgs.size === Object.keys(iptv.XTREAM_MESSAGES).length);
}

/* ---------------------------------------------------------------- */
/* Faux panneau Xtream / fake Xtream panel */
const hits = []; // { path, query }
const ACCOUNTS = {
  good:    { pass: PASSWORD, status: "Active", exp: "1893456000", max: "2", active: "0" },
  full:    { pass: PASSWORD, status: "Active", exp: "1893456000", max: "1", active: "1" },
  expired: { pass: PASSWORD, status: "Expired", exp: "1500000000", max: "1", active: "0" },
  banned:  { pass: PASSWORD, status: "Banned", exp: "1893456000", max: "1", active: "0" }
};

const panel = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  hits.push({ path: u.pathname, query: Object.fromEntries(u.searchParams) });
  if (u.pathname !== "/player_api.php") { res.statusCode = 404; return res.end("nope"); }
  const user = u.searchParams.get("username");
  const pass = u.searchParams.get("password");
  const action = u.searchParams.get("action") || "";
  if (user === "http401") { res.statusCode = 401; return res.end("unauthorized"); }
  if (user === "html") { res.setHeader("Content-Type", "text/html"); return res.end("<html><body>Maintenance</body></html>"); }
  if (user === "empty") return res.end("");
  const acc = ACCOUNTS[user];
  res.setHeader("Content-Type", "application/json");
  if (!acc || acc.pass !== pass) return res.end(JSON.stringify({ user_info: { auth: 0 } }));
  const userInfo = { auth: 1, status: acc.status, exp_date: acc.exp, max_connections: acc.max, active_cons: acc.active, is_trial: "0" };
  switch (action) {
    case "": return res.end(JSON.stringify({ user_info: userInfo, server_info: { url: "x" } }));
    case "get_live_categories": return res.end(JSON.stringify([{ category_id: "10", category_name: "France HD|OTT" }, { category_id: "11", category_name: "Adulte XXX" }]));
    case "get_vod_categories": return res.end(JSON.stringify([{ category_id: "20", category_name: "Films Action" }]));
    case "get_series_categories": return res.end(JSON.stringify([{ category_id: "30", category_name: "Series FR" }]));
    case "get_live_streams": return res.end(JSON.stringify([{ stream_id: 111, name: "France 24", stream_icon: "http://i/f24.png" }]));
    case "get_vod_streams": return res.end(JSON.stringify([{ stream_id: 222, name: "Un Film", container_extension: "mkv" }]));
    case "get_series": return res.end(JSON.stringify([{ series_id: 333, name: "Une Serie", cover: "" }]));
    case "get_series_info": return res.end(JSON.stringify({
      info: { plot: "Intrigue" },
      episodes: { "2": [{ id: "902", title: "S2E1", episode_num: 1, container_extension: "mp4" }], "1": [{ id: "901", title: "S1E1", episode_num: 1, container_extension: "mkv" }] }
    }));
    default: return res.end("[]");
  }
});

function jget(base, p) {
  return fetch(base + p).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}
function jsend(base, p, method, body) {
  return fetch(base + p, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}

(async () => {
  await new Promise((r) => panel.listen(0, "127.0.0.1", r));
  const PANEL = "http://127.0.0.1:" + panel.address().port;

  /* Port ferme : serveur injoignable / closed port: unreachable server */
  const dead = http.createServer();
  await new Promise((r) => dead.listen(0, "127.0.0.1", r));
  const DEAD = "http://127.0.0.1:" + dead.address().port;
  await new Promise((r) => dead.close(r));

  console.log("== Module : l'API Xtream reelle, via le faux panneau ==");
  {
    const cats = await iptv.fetchXtreamCategories(PANEL, "good", PASSWORD);
    check("categories : 2 direct, 1 film, 1 serie", cats.live.length === 2 && cats.vod.length === 1 && cats.series.length === 1);
    check("compte : statut, expiration, connexions", cats.accountStatus === "Active" && cats.expiresAt === "1893456000" && cats.maxConnections === 2 && cats.activeConnections === 0);

    const live = await iptv.fetchXtreamStreams(PANEL, "good", PASSWORD, "live", "10", false);
    check("direct : URL de lecture en .ts avec identifiants", live[0].url === PANEL + "/live/good/" + PASSWORD + "/111.ts");
    check("sans mask : pas de ref", live[0].ref === undefined);
    const masked = await iptv.fetchXtreamStreams(PANEL, "good", PASSWORD, "live", "10", true);
    check("avec mask : ref SANS mot de passe", masked[0].ref && !masked[0].ref.includes(PASSWORD) && masked[0].ref.includes("{xtream-password}"));
    check("avec mask : url de lecture toujours complete", masked[0].url.includes(PASSWORD));
    const vod = await iptv.fetchXtreamStreams(PANEL, "good", PASSWORD, "vod", "20", true);
    check("film : extension du panneau (.mkv) et chemin /movie/", vod[0].url.endsWith("/movie/good/" + PASSWORD + "/222.mkv") && vod[0].containerExt === "mkv");
    const series = await iptv.fetchXtreamSeriesEpisodes(PANEL, "good", PASSWORD, "333", true);
    check("serie : saisons triees 1 puis 2", series.seasons.map((s) => s.season).join(",") === "1,2");
    check("episode : url /series/ et ref sans mot de passe",
      series.seasons[0].episodes[0].url.includes("/series/good/" + PASSWORD + "/901.mkv") && !series.seasons[0].episodes[0].ref.includes(PASSWORD));
    check("synopsis de la serie", series.plot === "Intrigue");

    const expectCode = async (label, fn, code) => {
      try { await fn(); check(label, false, "aucune erreur levee"); }
      catch (e) { check(label, e instanceof iptv.XtreamError && e.code === code, "code obtenu : " + (e && e.code) + " / " + (e && e.message)); }
    };
    await expectCode("identifiants refuses (auth:0) -> bad-credentials", () => iptv.fetchXtreamCategories(PANEL, "wrong", "x"), "bad-credentials");
    await expectCode("mot de passe faux, bon identifiant -> bad-credentials", () => iptv.fetchXtreamCategories(PANEL, "good", "faux"), "bad-credentials");
    await expectCode("HTTP 401 -> bad-credentials", () => iptv.fetchXtreamCategories(PANEL, "http401", "x"), "bad-credentials");
    await expectCode("abonnement expire -> expired", () => iptv.fetchXtreamCategories(PANEL, "expired", PASSWORD), "expired");
    await expectCode("compte banni -> disabled", () => iptv.fetchXtreamCategories(PANEL, "banned", PASSWORD), "disabled");
    await expectCode("page HTML a la place du JSON -> not-xtream", () => iptv.fetchXtreamCategories(PANEL, "html", "x"), "not-xtream");
    await expectCode("corps vide -> not-xtream", () => iptv.fetchXtreamCategories(PANEL, "empty", "x"), "not-xtream");
    await expectCode("port ferme -> unreachable", () => iptv.fetchXtreamCategories(DEAD, "good", PASSWORD), "unreachable");

    // Le detail d'une erreur ne doit jamais contenir le mot de passe.
    try { await iptv.fetchXtreamCategories(DEAD, "good", PASSWORD); }
    catch (e) { check("detail d'une erreur reseau sans mot de passe", !String(e.detail + e.message).includes(PASSWORD)); }

    const full = await iptv.fetchXtreamAccount(PANEL, "full", PASSWORD);
    const txt = iptv.describeTest(full, "fr");
    check("test FR : limite de connexions atteinte signalee", /1\/1/.test(txt) && /Limite atteinte/.test(txt), txt);
    const txtEn = iptv.describeTest(await iptv.fetchXtreamAccount(PANEL, "good", PASSWORD), "en");
    check("test EN : succes, expiration et connexions", /successful/.test(txtEn) && /Expires/.test(txtEn) && /0\/2/.test(txtEn), txtEn);
  }

  console.log("== Serveur reel : coffre -> panneau, de bout en bout ==");
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => { warnings.push(a.map(String).join(" ")); };

  const { start } = require("../server/index.js");
  const srv = await start({ port: 0, host: "127.0.0.1" });
  const BASE = "http://127.0.0.1:" + srv.port;
  const TILE = "t-xtream";
  const q = (extra) => "tile=" + TILE + "&server=" + encodeURIComponent(PANEL) + "&user=good" + (extra ? "&" + extra : "");

  {
    let r = await jget(BASE, "/api/iptv/xtream-categories?" + q());
    check("sans mot de passe en coffre : 400 no-password, message bilingue",
      r.status === 400 && r.body.code === "no-password" && !!r.body.message.fr && !!r.body.message.en, JSON.stringify(r.body));

    r = await jsend(BASE, "/api/tile-secrets/" + TILE + "/xtreamPassword", "PUT", { value: PASSWORD });
    check("le mot de passe est enregistre dans le coffre", r.status === 200 && r.body.configured === true);

    r = await jget(BASE, "/api/tile-secrets/" + TILE + "/xtreamPassword");
    check("la route du coffre ne renvoie JAMAIS la valeur", r.body && r.body.configured === true && !JSON.stringify(r.body).includes(PASSWORD));

    const vaultRaw = fs.readFileSync(path.join(DATA, "tile-secrets.json"), "utf8");
    check("le coffre ne contient pas le mot de passe en clair", !vaultRaw.includes(PASSWORD));

    hits.length = 0;
    r = await jget(BASE, "/api/iptv/xtream-categories?" + q());
    check("avec le coffre : 200 et categories", r.status === 200 && r.body.live.length === 2 && r.body.accountStatus === "Active", JSON.stringify(r.body));
    check("le panneau a REELLEMENT recu le mot de passe du coffre",
      hits.length > 0 && hits.every((h) => h.query.password === PASSWORD && h.query.username === "good"));
    check("le mot de passe n'etait pas dans la requete du navigateur", !q().includes(PASSWORD));

    r = await jget(BASE, "/api/iptv/xtream-streams?" + q("mask=1&kind=live&categoryId=10"));
    check("flux direct : url complete pour lire + ref sans mot de passe",
      r.status === 200 && r.body[0].url.includes(PASSWORD) && r.body[0].ref && !r.body[0].ref.includes(PASSWORD));
    const ref = r.body[0].ref;

    r = await jget(BASE, "/api/iptv/xtream-streams?" + q("kind=live&categoryId=10"));
    check("sans mask=1 : pas de ref", r.status === 200 && r.body[0].ref === undefined);

    r = await jget(BASE, "/api/iptv/xtream-series-info?" + q("mask=1&seriesId=333"));
    check("episodes : ref sans mot de passe", r.status === 200 && r.body.seasons[0].episodes[0].ref && !r.body.seasons[0].episodes[0].ref.includes(PASSWORD));

    r = await jsend(BASE, "/api/iptv/xtream-unmask", "POST", { tile: TILE, url: ref });
    check("unmask : l'URL retrouve son mot de passe depuis le coffre", r.status === 200 && r.body.url === PANEL + "/live/good/" + PASSWORD + "/111.ts", JSON.stringify(r.body));
    r = await jsend(BASE, "/api/iptv/xtream-unmask", "POST", { tile: "autre-tuile", url: ref });
    check("unmask : une autre tuile n'a pas ce mot de passe", r.status === 400 && r.body.code === "no-password");

    // Modes d'echec via la route / failure modes through the route
    const route = async (user, pass) => {
      const rr = await jsend(BASE, "/api/iptv/xtream-test", "POST", { tile: "tuile-test", lang: "fr", values: { xtreamServer: PANEL, xtreamUser: user }, secrets: pass ? { xtreamPassword: pass } : {} });
      return rr.body;
    };
    let t = await route("good", PASSWORD);
    check("Tester : succes avec le mot de passe saisi (non enregistre)", t.ok === true && /Connexion réussie/.test(t.message), JSON.stringify(t));
    t = await route("good", "mauvais");
    check("Tester : mauvais mot de passe -> bad-credentials", t.ok === false && t.code === "bad-credentials");
    t = await route("expired", PASSWORD);
    check("Tester : abonnement expire -> expired", t.ok === false && t.code === "expired" && /expiré/.test(t.message));
    t = await route("banned", PASSWORD);
    check("Tester : compte banni -> disabled", t.ok === false && t.code === "disabled");
    t = await route("html", "x");
    check("Tester : panneau qui n'est pas Xtream -> not-xtream", t.ok === false && t.code === "not-xtream");
    const tDead = (await jsend(BASE, "/api/iptv/xtream-test", "POST", { tile: "tuile-test", lang: "en", values: { xtreamServer: DEAD, xtreamUser: "good" }, secrets: { xtreamPassword: PASSWORD } })).body;
    check("Tester : serveur injoignable -> unreachable, message EN", tDead.ok === false && tDead.code === "unreachable" && /unreachable/.test(tDead.message), JSON.stringify(tDead));
    t = await route("good", "");
    check("Tester : tuile sans mot de passe en coffre ni saisi -> no-password", t.ok === false && t.code === "no-password");
    const tEmpty = (await jsend(BASE, "/api/iptv/xtream-test", "POST", { tile: TILE, lang: "fr", values: { xtreamServer: "", xtreamUser: "" }, secrets: {} })).body;
    check("Tester : champs vides -> not-configured", tEmpty.ok === false && tEmpty.code === "not-configured");

    // Mauvais identifiants via la route de liste : statut et code corrects
    r = await jget(BASE, "/api/iptv/xtream-categories?tile=" + TILE + "&server=" + encodeURIComponent(PANEL) + "&user=expired");
    check("liste : identifiants valides mais compte expire -> 401 expired", r.status === 401 && r.body.code === "expired");
    r = await jget(BASE, "/api/iptv/xtream-categories?tile=" + TILE + "&server=" + encodeURIComponent(DEAD) + "&user=good");
    check("liste : serveur injoignable -> 502 unreachable", r.status === 502 && r.body.code === "unreachable");

    console.log("== Compatibilite : l'ancien lien get.php continue de fonctionner ==");
    const legacy = "/api/iptv/xtream-categories?url=" + encodeURIComponent(PANEL + "/get.php?username=good&password=" + PASSWORD + "&type=m3u_plus");
    r = await jget(BASE, legacy);
    check("lien historique : 200 et categories", r.status === 200 && r.body.live.length === 2);
    r = await jget(BASE, "/api/iptv/xtream-streams?url=" + encodeURIComponent(PANEL + "/get.php?username=good&password=" + PASSWORD) + "&kind=live&categoryId=10");
    check("lien historique : flux avec url, sans ref", r.status === 200 && r.body[0].url.includes(PASSWORD) && r.body[0].ref === undefined);
    r = await jget(BASE, "/api/iptv/xtream-categories?url=" + encodeURIComponent("http://x.test/liste.m3u"));
    check("lien sans identifiants : 400 not-configured", r.status === 400 && r.body.code === "not-configured");

    console.log("== Confidentialite : le mot de passe ne fuit nulle part ==");
    const logs = warnings.join("\n");
    check("aucun journal ne contient le mot de passe", !logs.includes(PASSWORD), logs.split("\n").filter((l) => l.includes(PASSWORD)).join(" | "));
    check("des echecs ont bien ete journalises (le test est significatif)", /iptv xtream/.test(logs));
    let leaked = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (fs.readFileSync(p).includes(Buffer.from(PASSWORD))) leaked.push(path.relative(DATA, p));
    });
    walk(DATA);
    check("aucun fichier de donnees ne contient le mot de passe en clair", leaked.length === 0, leaked.join(", "));

    // Effacer la tuile efface le secret (pas de secret orphelin).
    await fetch(BASE + "/api/tile-secrets/" + TILE, { method: "DELETE" });
    r = await jget(BASE, "/api/tile-secrets/" + TILE + "/xtreamPassword");
    check("supprimer la tuile efface son mot de passe", r.body.configured === false);
  }

  console.warn = realWarn;
  await new Promise((r) => srv.server.close(r));
  await new Promise((r) => panel.close(r));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* noop */ }
  console.log("\n" + ok + " verifications" + (process.exitCode ? " -- ECHECS" : " -- OK"));
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error("Harnais en erreur:", e);
  process.exit(1);
});
