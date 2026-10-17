/* Bibliotheque d'images : separation des deux origines, identifiants,
   masquage, ajouts et suppressions. Ce qui est verrouille ici, ce sont
   les proprietes dont depend la promesse faite a l'utilisateur : ses
   ajouts survivent aux mises a jour, un element livre ne peut pas etre
   efface, et aucun identifiant ne permet de sortir des deux dossiers.
   Image library: separation of the two origins, ids, hiding, additions
   and deletions. What is locked in here are the properties the promise
   made to the user rests on: their additions survive updates, a shipped
   item cannot be erased, and no id lets one escape the two folders. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Dossier de donnees isole : le module lit store.DATA_DIR au chargement.
// Isolated data folder: the module reads store.DATA_DIR at load time.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "piboard-library-"));
process.env.PIBOARD_DATA = path.join(TMP, "data");
const library = require("../server/library");

console.log("== Identifiants : analyse et refus ==");
{
  const ok = library.parseId("builtin:backgrounds:fond.jpg");
  assert.deepStrictEqual(ok, { origin: "builtin", section: "backgrounds", file: "fond.jpg" });
  assert.deepStrictEqual(library.parseId("user:photos:vacances.png"),
    { origin: "user", section: "photos", file: "vacances.png" });

  // Tout ce qui pourrait servir a sortir des deux dossiers, ou a lire un
  // fichier qui n'est pas une image. Everything that could serve to
  // escape the two folders, or to read a file that is not an image.
  for (const bad of [
    "builtin:backgrounds:../../package.json",
    "builtin:backgrounds:..\\..\\package.json",
    "builtin:backgrounds:.hidden.jpg",
    "builtin:backgrounds:script.js",
    "builtin:unknown:fond.jpg",
    "elsewhere:backgrounds:fond.jpg",
    "builtin:backgrounds",
    ""
  ]) {
    assert.strictEqual(library.parseId(bad), null, "refuse : " + bad);
    assert.strictEqual(library.fileOf(bad), null, "aucun fichier servi pour : " + bad);
  }
  console.log("  OK");
}

console.log("== Les ajouts de l'utilisateur vivent dans data/, jamais dans public/ ==");
{
  const id = library.addUserFile("backgrounds", "mon fond.jpg", Buffer.from("x"), { category: "maison" });
  assert.strictEqual(id, "user:backgrounds:mon fond.jpg");

  const file = library.fileOf(id);
  assert.ok(file, "le fichier est retrouve");
  assert.ok(file.startsWith(library.USER_ROOT), "ecrit sous data/library/, ce qui le fait survivre aux mises a jour");
  assert.ok(!file.startsWith(library.BUILTIN_ROOT), "jamais sous public/, que la mise a jour remplace");

  // Meme nom depose deux fois : rendu unique plutot que refuse.
  // Same name dropped twice: made unique rather than refused.
  const id2 = library.addUserFile("backgrounds", "mon fond.jpg", Buffer.from("y"), null);
  assert.strictEqual(id2, "user:backgrounds:mon fond-2.jpg");

  assert.throws(() => library.addUserFile("backgrounds", "virus.exe", Buffer.from("x"), null),
    /unsupported/, "extension refusee");
  assert.throws(() => library.addUserFile("inconnue", "x.jpg", Buffer.from("x"), null),
    /unknown section/);
  console.log("  OK");
}

console.log("== Masquage d'un element livre, suppression d'un ajout personnel ==");
{
  const shipped = "builtin:backgrounds:exemple.jpg";
  assert.throws(() => library.removeUserFile(shipped), /not a user item/,
    "un element livre ne s'efface pas : il reviendrait a la mise a jour suivante");

  library.setHidden(shipped, true);
  assert.ok(library.hiddenSet().has(shipped), "il est masque a la place");
  library.setHidden(shipped, false);
  assert.ok(!library.hiddenSet().has(shipped), "et se restaure");

  const id = library.addUserFile("photos", "photo.png", Buffer.from("x"), null);
  assert.ok(library.fileOf(id));
  library.removeUserFile(id);
  assert.strictEqual(library.fileOf(id), null, "un ajout personnel, lui, disparait pour de bon");
  console.log("  OK");
}

console.log("== Liste : metadonnees, masques ecartes, sections ==");
{
  const id = library.addUserFile("logos", "logo.png", Buffer.from("x"),
    { name: "Mon logo", category: "maison", tone: "light", author: "Moi", license: "CC0" });
  const items = library.list("logos");
  const mine = items.find((i) => i.id === id);
  assert.ok(mine, "present dans la liste");
  assert.strictEqual(mine.name, "Mon logo");
  assert.strictEqual(mine.tone, "light");
  assert.strictEqual(mine.author, "Moi");
  assert.strictEqual(mine.origin, "user");

  library.setHidden(id, true);
  assert.ok(!library.list("logos").some((i) => i.id === id), "un element masque n'est plus propose");
  assert.ok(library.list("logos", { includeHidden: true }).some((i) => i.id === id),
    "mais reste visible quand on le demande, sinon on ne pourrait pas le restaurer");

  assert.deepStrictEqual(library.SECTIONS, ["backgrounds", "logos", "photos"]);
  console.log("  OK");
}

console.log("== Noms accentues : fichier propre, libelle d'origine conserve ==");
{
  const id = library.addUserFile("photos", "Été à la mer.JPG", Buffer.from("x"), null);
  assert.strictEqual(id, "user:photos:Ete a la mer.jpg", "accents replies, extension en minuscules");
  const item = library.list("photos").find((i) => i.id === id);
  assert.strictEqual(item.name, "Été à la mer", "mais l'utilisateur retrouve son libelle accentue");
  const odd = library.addUserFile("photos", "###.png", Buffer.from("x"), null);
  assert.ok(library.fileOf(odd), "un nom sans aucun caractere admis donne quand meme un fichier");
  console.log("  OK");
}

console.log("== Renommer : le libelle change, jamais le nom de fichier ==");
{
  const id = library.addUserFile("logos", "equipe.png", Buffer.from("x"), { name: "Equipe", category: "sport" });
  library.updateUserMeta(id, { name: "  Mon   equipe <b>  ", category: "club", tone: "dark" });
  let item = library.list("logos").find((i) => i.id === id);
  assert.strictEqual(item.name, "Mon equipe <b>", "espaces ramenes a un seul, le balisage reste du texte");
  assert.strictEqual(item.category, "club");
  assert.strictEqual(item.tone, "dark");
  assert.strictEqual(item.file, "equipe.png", "le fichier n'a pas bouge : il sert de reference");

  library.updateUserMeta(id, { name: "", tone: "" });
  item = library.list("logos").find((i) => i.id === id);
  assert.strictEqual(item.name, "equipe", "libelle vide : on revient au nom du fichier");
  assert.strictEqual(item.tone, null);

  library.updateUserMeta(id, { name: "x".repeat(300) });
  item = library.list("logos").find((i) => i.id === id);
  assert.strictEqual(item.name.length, 80, "libelle borne");

  assert.throws(() => library.updateUserMeta("builtin:logos:exemple.png", { name: "x" }), /not a user item/,
    "un element livre garde son libelle : la mise a jour le remettrait");
  assert.throws(() => library.updateUserMeta("user:logos:fantome.png", { name: "x" }), /unknown library item/);
  console.log("  OK");
}

console.log("== Deplacer vers une autre section ==");
{
  const id = library.addUserFile("backgrounds", "ciel.jpg", Buffer.from("ciel"), { name: "Beau ciel", category: "nature" });
  const clash = library.addUserFile("photos", "ciel.jpg", Buffer.from("autre"), null);
  assert.strictEqual(clash, "user:photos:ciel.jpg");

  const moved = library.moveUserFile(id, "photos");
  assert.strictEqual(moved, "user:photos:ciel-2.jpg", "nom deja pris dans la section d'arrivee : rendu unique");
  assert.strictEqual(library.fileOf(id), null, "l'ancien emplacement est vide");
  assert.strictEqual(fs.readFileSync(library.fileOf(moved), "utf8"), "ciel", "le contenu a suivi");
  assert.strictEqual(fs.readFileSync(library.fileOf(clash), "utf8"), "autre", "le fichier deja en place n'est pas ecrase");
  const item = library.list("photos").find((i) => i.id === moved);
  assert.strictEqual(item.name, "Beau ciel", "libelle et categorie suivent");
  assert.strictEqual(item.category, "nature");

  assert.strictEqual(library.moveUserFile(moved, "photos"), moved, "meme section : rien a faire");
  assert.throws(() => library.moveUserFile(moved, "inconnue"), /unknown section/);
  assert.throws(() => library.moveUserFile("builtin:backgrounds:exemple.jpg", "photos"), /not a user item/);
  console.log("  OK");
}

console.log("== Place occupee ==");
{
  const u = library.usage();
  assert.strictEqual(u.maxPerSection, 500);
  const sum = library.SECTIONS.reduce((n, s) => n + u.user.sections[s].count, 0);
  assert.strictEqual(u.user.count, sum, "le total est la somme des sections");
  assert.ok(u.user.count >= 4 && u.user.bytes > 0, "compte les ajouts des tests precedents");
  assert.strictEqual(typeof u.builtin.count, "number");
  assert.ok(u.disk === null || (u.disk.free >= 0 && u.disk.total >= u.disk.free), "disque libre absent ou coherent");
  console.log("  OK");
}

console.log("== Adresses interdites pour l'ajout par URL ==");
{
  for (const ip of ["127.0.0.1", "127.8.8.8", "0.0.0.0", "169.254.169.254", "224.0.0.1", "100.64.0.1", "::1", "::", "fe80::1", "::ffff:127.0.0.1", "ff02::1"]) {
    assert.strictEqual(library.isBlockedIp(ip), true, "refusee : " + ip);
  }
  // Le reseau local reste permis expres (NAS, serveur domestique).
  // The local network stays allowed on purpose (NAS, home server).
  for (const ip of ["192.168.1.20", "10.0.0.5", "172.16.4.4", "8.8.8.8", "fd12:3456::1", "2001:4860:4860::8888"]) {
    assert.strictEqual(library.isBlockedIp(ip), false, "permise : " + ip);
  }
  console.log("  OK");
}

console.log("== Ajout par URL (reseau simule) ==");
(async () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const lookupOk = async () => [{ address: "93.184.216.34", family: 4 }];
  const mk = (map) => async (u) => {
    const r = map[u];
    if (!r) return new Response("nope", { status: 404 });
    return new Response(r.body, { status: r.status || 200, headers: r.headers || {} });
  };

  // Cas nominal : le nom vient de l'adresse, le type est controle.
  let id = await library.addFromUrl("backgrounds", "https://exemple.test/img/paysage.png?x=1", { category: "web" }, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/img/paysage.png?x=1": { body: png, headers: { "content-type": "image/png" } } })
  });
  assert.strictEqual(id, "user:backgrounds:paysage.png");
  assert.ok(library.fileOf(id));

  // Adresse sans extension : elle vient du type de contenu.
  id = await library.addFromUrl("photos", "https://exemple.test/photo", null, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/photo": { body: png, headers: { "content-type": "image/jpeg; charset=binary" } } })
  });
  assert.strictEqual(id, "user:photos:photo.jpg");

  // Redirection suivie, puis refusee quand elle mene vers le bouclage.
  id = await library.addFromUrl("logos", "https://exemple.test/court", null, {
    lookup: lookupOk,
    fetch: mk({
      "https://exemple.test/court": { status: 302, body: "", headers: { location: "/vrai/logo.svg" } },
      "https://exemple.test/vrai/logo.svg": { body: "<svg/>", headers: { "content-type": "image/svg+xml" } }
    })
  });
  assert.strictEqual(id, "user:logos:logo.svg", "redirection relative suivie");

  await assert.rejects(library.addFromUrl("logos", "https://exemple.test/piege", null, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/piege": { status: 302, body: "", headers: { location: "http://127.0.0.1:8080/secret.png" } } })
  }), /not allowed/, "une redirection vers le bouclage est refusee");

  await assert.rejects(library.addFromUrl("logos", "https://exemple.test/boucle", null, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/boucle": { status: 302, body: "", headers: { location: "/boucle" } } })
  }), /too many redirects/);

  // Refus : schema, identifiants dans l'adresse, bouclage direct, nom
  // d'hote qui se resout vers une adresse interdite, type, taille.
  const never = async () => { throw new Error("ne doit pas etre appele"); };
  for (const bad of ["ftp://exemple.test/a.png", "file:///etc/passwd", "javascript:alert(1)", "pas une adresse", "",
    "https://user:pw@exemple.test/a.png"]) {
    await assert.rejects(library.addFromUrl("logos", bad, null, { lookup: lookupOk, fetch: never }), /invalid address/, "refusee : " + bad);
  }
  for (const bad of ["http://127.0.0.1/a.png", "http://localhost/a.png", "http://[::1]/a.png", "http://169.254.169.254/latest/a.png"]) {
    await assert.rejects(library.addFromUrl("logos", bad, null, { lookup: lookupOk, fetch: never }), /not allowed/, "refusee : " + bad);
  }
  await assert.rejects(library.addFromUrl("logos", "https://rebind.test/a.png", null, {
    lookup: async () => [{ address: "127.0.0.1", family: 4 }], fetch: never
  }), /not allowed/, "nom d'hote resolu vers le bouclage");
  await assert.rejects(library.addFromUrl("logos", "https://absent.test/a.png", null, {
    lookup: async () => { throw new Error("ENOTFOUND"); }, fetch: never
  }), /host not found/);

  await assert.rejects(library.addFromUrl("logos", "https://exemple.test/page.png", null, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/page.png": { body: "<html/>", headers: { "content-type": "text/html" } } })
  }), /not an image/, "le type de contenu fait foi");

  await assert.rejects(library.addFromUrl("logos", "https://exemple.test/gros.png", null, {
    lookup: lookupOk,
    fetch: mk({ "https://exemple.test/gros.png": { body: "x", headers: { "content-type": "image/png", "content-length": String(30 * 1024 * 1024) } } })
  }), /too large/, "taille annoncee trop grande : refuse avant de lire");

  await assert.rejects(library.addFromUrl("logos", "https://exemple.test/404.png", null, {
    lookup: lookupOk, fetch: mk({})
  }), /HTTP 404/);

  await assert.rejects(library.addFromUrl("inconnue", "https://exemple.test/a.png", null, { lookup: lookupOk, fetch: never }), /unknown section/);

  console.log("  OK");

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("Tous les tests de bibliotheque sont passes.");
})().catch((e) => { console.error(e); process.exit(1); });
