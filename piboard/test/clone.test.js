/* Tests du clone complet (server/clone.js) et de l'archive ZIP
   (server/zip.js). Tout se passe dans un dossier de donnees temporaire :
   rien n'est lu ni ecrit dans l'installation reelle.

   Le parcours teste est celui qui compte : on fabrique une installation
   PiBoard credible sous Windows -- avec des cles de service, des
   identifiants personnels, des chemins Windows et des images --, on en
   fait un clone, puis on l'applique sur une machine Linux et on verifie
   que le tableau de bord est le MEME, que les chemins ont suivi, et que
   seuls les secrets coches ont voyage.

   Tests of the full clone and the ZIP archive, in a temporary data
   folder. The journey tested is the one that matters: a credible
   Windows install is cloned and applied on a Linux machine. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

/* Dossier de donnees isole, impose AVANT de charger les modules :
   store.js lit PIBOARD_DATA au chargement. */
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-clone-"));
process.env.PIBOARD_DATA = DATA;

const zip = require("../server/zip.js");
const clone = require("../server/clone.js");
const tileSecrets = require("../server/tileSecrets.js");

console.log("== Archive ZIP ==");

test("ce qu'on ecrit est ce qu'on relit, texte comme binaire", () => {
  const binary = Buffer.from([0, 1, 2, 250, 251, 255]);
  const buf = zip.write([
    { name: "a.json", data: JSON.stringify({ accent: "é", n: 1 }) },
    { name: "dossier/photo.png", data: binary, store: true },
    { name: "gros.txt", data: "x".repeat(40000) }
  ]);
  const back = zip.read(buf);
  assert.strictEqual(back.length, 3);
  assert.deepStrictEqual(JSON.parse(back[0].data.toString("utf8")), { accent: "é", n: 1 });
  assert.ok(back[1].data.equals(binary), "les octets bruts sont intacts");
  assert.strictEqual(back[2].data.toString("utf8").length, 40000);
});

test("la compression sert a quelque chose, et on ne recompresse pas une image", () => {
  const text = zip.write([{ name: "t.txt", data: "x".repeat(40000) }]);
  assert.ok(text.length < 1000, "un texte tres repetitif se comprime (" + text.length + " octets)");
  assert.strictEqual(clone.isAlreadyCompressed("photo.JPG"), true);
  assert.strictEqual(clone.isAlreadyCompressed("fond.png"), true);
  assert.strictEqual(clone.isAlreadyCompressed("layout.json"), false);
});

test("un fichier abîmé est refusé, pas applique a moitie", () => {
  const buf = zip.write([{ name: "a.txt", data: "contenu original" }]);
  const bad = Buffer.from(buf);
  // On retourne un octet DANS les donnees : l'empreinte doit le voir.
  const at = buf.indexOf(Buffer.from("contenu"));
  bad[at >= 0 ? at : 40] ^= 0xff;
  assert.throws(() => zip.read(bad), /corrompue|corrupted|abîmée|damaged/);
  assert.throws(() => zip.read(Buffer.from("ceci n'est pas une archive")), /ZIP|courte|short/);
});

console.log("== Chemins d'un systeme a l'autre ==");

test("un dossier standard est reconnu, quelle que soit la casse ou la langue", () => {
  const home = "C:\\Users\\JMEzes";
  const c = clone.classifyPath("C:\\Users\\JMEzes\\Videos\\PiBoard", home);
  assert.strictEqual(c.kind, "standard");
  assert.strictEqual(c.role, "videos");
  assert.deepStrictEqual(c.rest, ["PiBoard"]);
  // Nom francais de Windows, et casse indifferente.
  assert.strictEqual(clone.classifyPath("C:\\Users\\JMEzes\\vidéos", home).role, "videos");
  assert.strictEqual(clone.classifyPath("/home/jm/Pictures/fonds", "/home/jm").role, "pictures");
  assert.strictEqual(clone.classifyPath("/home/jm/Téléchargements", "/home/jm").role, "downloads");
});

test("un chemin hors du dossier personnel n'est pas devine", () => {
  // C'est le cas qui DOIT arriver a l'utilisateur pour decision :
  // inventer un equivalent a « D:\\Media » serait pire que de demander.
  const c = clone.classifyPath("D:\\Media\\Films", "C:\\Users\\JMEzes");
  assert.strictEqual(c.kind, "elsewhere");
  assert.strictEqual(clone.translatePath(c, "/home/jm"), null);
  const c2 = clone.classifyPath("/mnt/nas/photos", "/home/jm");
  assert.strictEqual(c2.kind, "elsewhere");
  assert.strictEqual(clone.translatePath(c2, "/home/jm"), null);
});

test("Windows vers Linux : le chemin est retraduit, le sous-dossier conserve", () => {
  const c = clone.classifyPath("C:\\Users\\JMEzes\\Videos\\PiBoard\\TV", "C:\\Users\\JMEzes");
  const to = clone.translatePath(c, "/home/jm");
  assert.strictEqual(to, path.join("/home/jm", "Videos", "PiBoard", "TV"));
});

test("un dossier personnel quelconque suit aussi", () => {
  const c = clone.classifyPath("/home/jm/piboard-films", "/home/jm");
  assert.strictEqual(c.kind, "home");
  assert.strictEqual(clone.translatePath(c, "C:\\Users\\Autre"),
    path.join("C:\\Users\\Autre", "piboard-films"));
});

console.log("== Ce qui ne voyage jamais ==");

test("les mesures et compteurs de la machine restent sur place", () => {
  assert.strictEqual(clone.travels("layout"), true);
  assert.strictEqual(clone.travels("settings"), true);
  assert.strictEqual(clone.travels("tileConfigs"), true);
  assert.strictEqual(clone.travels("system-history"), false, "historique systeme de la machine d'origine");
  assert.strictEqual(clone.travels("internet-health"), false, "mesures de la ligne d'origine");
  assert.strictEqual(clone.travels("iptvSchedules"), false, "enregistrements programmes");
  assert.strictEqual(clone.travels("trafficquota.t-abc"), false, "quota deja consomme");
  assert.strictEqual(clone.travels("tile-secrets"), false, "le coffre n'est jamais copie tel quel");
});

console.log("== Nature des secrets ==");

test("chaque champ sensible declare sa nature dans son manifeste", () => {
  const fields = clone.sensitiveFields(clone.readManifests());
  // Les cles de service : elles identifient PiBoard, pas la personne.
  assert.strictEqual(fields["traffic.apiKey"].nature, "service");
  assert.strictEqual(fields["commute.apiKey"].nature, "service");
  assert.strictEqual(fields["youtube.apiKey"].nature, "service");
  // Les identifiants personnels.
  assert.strictEqual(fields["mailbox.imapPassword"].nature, "personal");
  assert.strictEqual(fields["homeassistant.haToken"].nature, "personal");
  assert.strictEqual(fields["slideshow.webdavPass"].nature, "personal");
  assert.strictEqual(fields["bambu.accessCode"].nature, "personal");
  /* Aucun champ sensible ne doit rester sans nature : sans cela il
     serait traite comme personnel par defaut -- prudent, mais muet. */
  for (const [id, f] of Object.entries(fields)) {
    assert.ok(f.nature === "service" || f.nature === "personal", id + " sans nature");
  }
});

test("un secret retire l'est VRAIMENT, y compris ceux qui vivent en clair", () => {
  /* Les champs « password » ne sont pas dans le coffre : ils dorment
     dans layout.json. Decocher leur famille doit les en retirer, sinon
     la case a cocher ne servirait a rien pour eux. */
  const fields = clone.sensitiveFields(clone.readManifests());
  const layout = { tiles: [
    { id: "t-a", widget: "traffic", settings: { apiKey: "CLE-TOMTOM", zoom: 12 } },
    { id: "t-b", widget: "slideshow", settings: { webdavPass: "motdepasse", folderPath: "/x" } }
  ] };
  const none = clone.stripSecretsFromLayout(layout, fields, {});
  assert.strictEqual(none.layout.tiles[0].settings.apiKey, undefined, "cle de service retiree");
  assert.strictEqual(none.layout.tiles[1].settings.webdavPass, undefined, "mot de passe retire");
  assert.strictEqual(none.layout.tiles[0].settings.zoom, 12, "le reste est intact");
  assert.strictEqual(none.removed.length, 2);

  const services = clone.stripSecretsFromLayout(layout, fields, { service: true });
  assert.strictEqual(services.layout.tiles[0].settings.apiKey, "CLE-TOMTOM", "la cle de service reste");
  assert.strictEqual(services.layout.tiles[1].settings.webdavPass, undefined, "le mot de passe part quand meme");
  // L'original n'est jamais modifie.
  assert.strictEqual(layout.tiles[0].settings.apiKey, "CLE-TOMTOM");
});

test("un secret de nature inconnue est traite comme personnel", () => {
  // En cas de doute on protege : il ne partira pas sans decision.
  const split = clone.splitVault({ "t-x": { mystere: "valeur" } }, {}, { tiles: [{ id: "t-x", widget: "inconnu" }] });
  assert.deepStrictEqual(Object.keys(split.service), []);
  assert.deepStrictEqual(Object.keys(split.personal), ["t-x"]);
  assert.strictEqual(split.unknown.length, 1);
});

console.log("== Chiffrement des identifiants personnels ==");

test("avec une phrase de passe, les identifiants sont illisibles sans elle", () => {
  const secret = { "t-mail": { imapPassword: "tres-secret" } };
  const box = clone.encryptSecrets(secret, "ma phrase");
  assert.ok(!JSON.stringify(box).includes("tres-secret"), "rien de lisible dans l'archive");
  assert.deepStrictEqual(clone.decryptSecrets(box, "ma phrase"), secret);
  assert.throws(() => clone.decryptSecrets(box, "mauvaise phrase"), /.*/);
});

console.log("== Parcours complet : Windows -> Linux ==");

/* Une installation credible, montee dans le dossier temporaire. */
function buildInstallation() {
  const layout = {
    pages: [
      { name: "Salon", tiles: [
        { id: "t-traffic", widget: "traffic", settings: { apiKey: "CLE-TOMTOM", city: "Toulouse" } },
        { id: "t-mail", widget: "mailbox", settings: { host: "imap.free.fr", user: "jm" } }
      ] },
      { name: "Atelier", tiles: [
        { id: "t-iptv", widget: "iptv", settings: { recordDir: "C:\\Users\\JMEzes\\Videos\\PiBoard" } },
        { id: "t-diapo", widget: "slideshow", settings: { folderPath: "D:\\Photos\\Vacances", webdavPass: "wd-secret" } },
        { id: "t-youtube", widget: "youtube", settings: { channel: "x" } },
        { id: "t-bambu", widget: "bambu", settings: { mode: "lan", host: "192.168.1.42" } }
      ] }
    ]
  };
  fs.writeFileSync(path.join(DATA, "layout.json"), JSON.stringify(layout));
  fs.writeFileSync(path.join(DATA, "settings.json"), JSON.stringify({ lang: "fr", cartoKey: "CLE-CARTO", touchMode: true }));
  fs.writeFileSync(path.join(DATA, "tileConfigs.json"), JSON.stringify({ traffic: [{ name: "Maison" }] }));
  // Ce qui ne doit pas voyager :
  fs.writeFileSync(path.join(DATA, "system-history.json"), JSON.stringify({ cpu: [1, 2, 3] }));
  fs.writeFileSync(path.join(DATA, "iptvSchedules.json"), JSON.stringify([{ id: "s1" }]));
  fs.writeFileSync(path.join(DATA, "trafficquota.t-traffic.json"), JSON.stringify({ date: "2026-09-21", count: 900 }));
  // Des images.
  const media = path.join(DATA, "media", "t-diapo");
  fs.mkdirSync(media, { recursive: true });
  fs.writeFileSync(path.join(media, "photo1.jpg"), Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
  fs.writeFileSync(path.join(media, "fond.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 9]));
  fs.mkdirSync(path.join(DATA, "library"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "library", "logo.svg"), "<svg/>");
  // Des secrets, des deux familles.
  tileSecrets.set("t-mail", "imapPassword", "mot-de-passe-imap");
  tileSecrets.set("t-youtube", "apiKey", "CLE-GOOGLE");
  tileSecrets.set("t-bambu", "accessCode", "12345678");
  return layout;
}

buildInstallation();
const WIN_HOME = "C:\\Users\\JMEzes";

test("le clone emporte la configuration, pas les mesures de la machine", () => {
  const made = clone.buildClone({ includeImages: true, home: WIN_HOME, appVersion: "1.118.0" });
  const names = zip.read(made.buffer).map((f) => f.name);
  assert.ok(names.includes("config/layout.json"));
  assert.ok(names.includes("config/settings.json"));
  assert.ok(names.includes("config/tileConfigs.json"));
  assert.ok(!names.includes("config/system-history.json"), "historique systeme laisse sur place");
  assert.ok(!names.includes("config/iptvSchedules.json"), "programmations laissees sur place");
  assert.ok(!names.some((n) => n.indexOf("trafficquota") >= 0), "quota consomme laisse sur place");
  assert.ok(!names.some((n) => n.indexOf("tile-secrets") >= 0), "le coffre n'est jamais copie tel quel");
});

test("sans les cases cochees, aucun secret ne quitte la machine", () => {
  const made = clone.buildClone({ includeImages: false, home: WIN_HOME });
  const files = zip.read(made.buffer);
  const text = files.map((f) => f.data.toString("utf8")).join("\n");
  assert.ok(!text.includes("CLE-TOMTOM"), "la cle TomTom, pourtant en clair dans layout.json");
  assert.ok(!text.includes("CLE-CARTO"), "la cle CARTO des reglages generaux");
  assert.ok(!text.includes("wd-secret"), "le mot de passe WebDAV");
  assert.ok(!text.includes("mot-de-passe-imap"), "le mot de passe du courriel");
  assert.ok(!text.includes("CLE-GOOGLE"), "la cle Google");
  assert.ok(!files.some((f) => f.name.indexOf("secrets/") === 0), "pas de fichier de secrets du tout");
});

test("les cles de service seules : elles partent, les identifiants restent", () => {
  const made = clone.buildClone({ includeServiceKeys: true, home: WIN_HOME });
  const text = zip.read(made.buffer).map((f) => f.data.toString("utf8")).join("\n");
  assert.ok(text.includes("CLE-TOMTOM"), "cle TomTom emportee");
  assert.ok(text.includes("CLE-CARTO"), "cle CARTO emportee");
  assert.ok(text.includes("CLE-GOOGLE"), "cle Google du coffre emportee");
  assert.ok(!text.includes("mot-de-passe-imap"), "mot de passe du courriel laisse");
  assert.ok(!text.includes("wd-secret"), "mot de passe WebDAV laisse");
  assert.ok(!text.includes("12345678"), "code d'acces de l'imprimante laisse");
});

test("les identifiants personnels, chiffres quand une phrase est donnee", () => {
  const clair = clone.buildClone({ includePersonalSecrets: true, home: WIN_HOME });
  assert.ok(zip.read(clair.buffer).map((f) => f.data.toString("utf8")).join("").includes("mot-de-passe-imap"),
    "sans phrase : en clair, et le LISEZMOI le dit");
  const readme = zip.read(clair.buffer).find((f) => f.name === "LISEZMOI.txt").data.toString("utf8");
  assert.ok(/ATTENTION|WARNING/.test(readme), "l'archive previent que des mots de passe y sont en clair");

  const chiffre = clone.buildClone({ includePersonalSecrets: true, passphrase: "phrase", home: WIN_HOME });
  const text = zip.read(chiffre.buffer).map((f) => f.data.toString("utf8")).join("");
  assert.ok(!text.includes("mot-de-passe-imap"), "avec phrase : rien de lisible");
  assert.ok(zip.read(chiffre.buffer).some((f) => f.name === "secrets/personal.enc.json"));
});

test("les images voyagent quand on le demande, et pas autrement", () => {
  const avec = clone.buildClone({ includeImages: true, home: WIN_HOME });
  const noms = zip.read(avec.buffer).map((f) => f.name);
  assert.ok(noms.includes("media/t-diapo/photo1.jpg"));
  assert.ok(noms.includes("media/t-diapo/fond.png"));
  assert.ok(noms.includes("library/logo.svg"));
  assert.strictEqual(avec.manifest.contents.mediaFiles, 2);

  const sans = clone.buildClone({ includeImages: false, home: WIN_HOME });
  assert.ok(!zip.read(sans.buffer).some((f) => f.name.indexOf("media/") === 0));
  assert.ok(sans.buffer.length < avec.buffer.length);
});

test("avant d'ecraser, on peut REGARDER ce que contient le clone", () => {
  const made = clone.buildClone({ includeImages: true, home: WIN_HOME, appVersion: "1.118.0" });
  const info = clone.inspectClone(made.buffer, { home: "/home/jm", appVersion: "1.118.0" });
  assert.strictEqual(info.intact, true);
  assert.strictEqual(info.counts.tiles, 6);
  assert.strictEqual(info.counts.pages, 2);
  assert.strictEqual(info.counts.media, 2);
  assert.deepStrictEqual(info.widgets, ["bambu", "iptv", "mailbox", "slideshow", "traffic", "youtube"]);
  assert.strictEqual(info.manifest.platform, process.platform);
  // Les chemins, avec ce qui sera propose.
  const iptv = info.paths.find((p) => p.key === "recordDir");
  assert.strictEqual(iptv.to, path.join("/home/jm", "Videos", "PiBoard"), "chemin Windows traduit");
  assert.strictEqual(iptv.needsChoice, false);
  const diapo = info.paths.find((p) => p.key === "folderPath");
  assert.strictEqual(diapo.to, null);
  assert.strictEqual(diapo.needsChoice, true, "« D:\\\\Photos » demande une decision");
});

test("un clone d'une version plus recente est signale", () => {
  const made = clone.buildClone({ home: WIN_HOME, appVersion: "1.200.0" });
  assert.strictEqual(clone.inspectClone(made.buffer, { appVersion: "1.118.0" }).newer, true);
  assert.strictEqual(clone.inspectClone(made.buffer, { appVersion: "2.0.0" }).newer, false);
  assert.strictEqual(clone.compareVersions("1.9.0", "1.10.0"), -1, "on compare des nombres, pas du texte");
});

test("un fichier qui n'est pas un clone est refuse clairement", () => {
  const autre = zip.write([{ name: "quelconque.txt", data: "bonjour" }]);
  assert.throws(() => clone.inspectClone(autre), (e) => e.code === "not-a-clone");
});

test("appliquer le clone sur une autre machine reconstruit le meme tableau", () => {
  const made = clone.buildClone({
    includeServiceKeys: true, includePersonalSecrets: true, includeImages: true,
    home: WIN_HOME, appVersion: "1.118.0"
  });

  // Machine d'arrivee : un dossier de donnees vierge.
  const TARGET = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-target-"));
  const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-home-"));
  fs.mkdirSync(path.join(HOME, "Videos"), { recursive: true });
  const before = process.env.PIBOARD_DATA;
  /* Les modules ont deja lu PIBOARD_DATA : on rejoue donc l'application
     dans un processus neuf, ce qui est aussi plus honnete -- c'est ce
     qui se passe vraiment sur la machine d'arrivee.
     A fresh process, which is what really happens on the target. */
  const script = `
    process.env.PIBOARD_DATA = ${JSON.stringify(TARGET)};
    const clone = require(${JSON.stringify(path.join(__dirname, "..", "server", "clone.js"))});
    const buf = require("fs").readFileSync(${JSON.stringify(path.join(TARGET, "in.zip"))});
    const out = clone.applyClone(buf, { home: ${JSON.stringify(HOME)},
      paths: { "t-diapo|folderPath": ${JSON.stringify(path.join(HOME, "Images", "Vacances"))} } });
    console.log(JSON.stringify(out.report));
  `;
  fs.writeFileSync(path.join(TARGET, "in.zip"), made.buffer);
  const result = JSON.parse(require("child_process").execFileSync(process.execPath, ["-e", script], { encoding: "utf8" }));
  process.env.PIBOARD_DATA = before;

  const layout = JSON.parse(fs.readFileSync(path.join(TARGET, "layout.json"), "utf8"));
  const tiles = clone.allTiles(layout);
  assert.strictEqual(tiles.length, 6, "les six tuiles sont la");
  assert.strictEqual(layout.pages.length, 2, "les deux pages aussi");

  const iptv = tiles.find((t) => t.widget === "iptv");
  assert.strictEqual(iptv.settings.recordDir, path.join(HOME, "Videos", "PiBoard"),
    "le dossier d'enregistrement a suivi, traduit pour cette machine");
  const diapo = tiles.find((t) => t.widget === "slideshow");
  assert.strictEqual(diapo.settings.folderPath, path.join(HOME, "Images", "Vacances"),
    "le chemin sans equivalent a pris le dossier choisi a l'import");

  assert.strictEqual(tiles.find((t) => t.widget === "traffic").settings.apiKey, "CLE-TOMTOM",
    "la cle de service a suivi");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(TARGET, "settings.json"), "utf8")).cartoKey, "CLE-CARTO");
  assert.ok(fs.existsSync(path.join(TARGET, "media", "t-diapo", "photo1.jpg")), "les photos ont suivi");
  assert.ok(fs.existsSync(path.join(TARGET, "library", "logo.svg")), "la bibliotheque personnelle aussi");
  assert.ok(!fs.existsSync(path.join(TARGET, "system-history.json")), "les mesures ne sont pas revenues");
  assert.ok(!fs.existsSync(path.join(TARGET, "iptvSchedules.json")), "ni les programmations");

  assert.strictEqual(result.secrets, 3, "les trois secrets du coffre sont poses");
  assert.strictEqual(result.media, 2);
  assert.strictEqual(result.warnings.length, 0, "aucun avertissement : tout a trouve sa place");
  fs.rmSync(TARGET, { recursive: true, force: true });
  fs.rmSync(HOME, { recursive: true, force: true });
});

test("un clone abîmé n'est pas applique a moitie", () => {
  const made = clone.buildClone({ home: WIN_HOME });
  const bad = Buffer.from(made.buffer);
  const at = bad.indexOf(Buffer.from("piboard-clone"));
  bad[at + 400] ^= 0xff;
  assert.throws(() => clone.applyClone(bad, {}), /.*/);
});

fs.rmSync(DATA, { recursive: true, force: true });
console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
process.exit(failures ? 1 : 0);
