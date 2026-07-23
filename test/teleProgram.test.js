/* Tests unitaires de server/teleProgram.js : fonctions PURES
   (parsing XMLTV, dates, vues). Aucune I/O reseau/disque. */
"use strict";
const assert = require("assert");
const tp = require("../server/teleProgram");

/* Echantillon XMLTV minimal mais representatif : 2 chaines, plusieurs
   programmes, avec/sans <new>, <previously-shown>, <icon>, multilingue. */
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TF1.fr">
    <display-name lang="fr">TF1</display-name>
    <icon src="https://logo/tf1.png"/>
  </channel>
  <channel id="France2.fr">
    <display-name>France 2</display-name>
  </channel>
  <programme start="20240115200000 +0100" stop="20240115210000 +0100" channel="TF1.fr">
    <title lang="fr">Journal de 20h</title>
    <desc lang="fr">Les titres du jour.</desc>
    <category lang="fr">Information</category>
    <previously-shown/>
  </programme>
  <programme start="20240115210000 +0100" stop="20240115230000 +0100" channel="TF1.fr">
    <title lang="fr">Grand film inédit</title>
    <sub-title lang="fr">Un thriller</sub-title>
    <desc lang="en">English desc</desc>
    <desc lang="fr">Un synopsis en français.</desc>
    <category lang="fr">Film</category>
    <icon src="https://img/film.jpg"/>
    <new/>
  </programme>
  <programme start="20240115230000 +0100" stop="20240116003000 +0100" channel="TF1.fr">
    <title lang="fr">Deuxième partie de soirée</title>
    <desc lang="fr">Débat.</desc>
  </programme>
  <programme start="20240115204500 +0100" stop="20240115214500 +0100" channel="France2.fr">
    <title lang="fr">Série du soir</title>
    <category lang="fr">Série</category>
  </programme>
</tv>`;

console.log("== parseXmltvDate ==");
{
  const d = tp.parseXmltvDate("20240115203000 +0100");
  assert.strictEqual(d.toISOString(), "2024-01-15T19:30:00.000Z", "TZ +0100 -> UTC");
  assert.strictEqual(tp.parseXmltvDate("20240115203000").getUTCFullYear(), 2024, "sans TZ = UTC");
  assert.strictEqual(tp.parseXmltvDate(""), null);
  assert.strictEqual(tp.parseXmltvDate("nawak"), null);
  console.log("  OK");
}

console.log("== pickLangText : prefere le francais ==");
{
  const node = [{ "@_lang": "en", "#text": "English" }, { "@_lang": "fr", "#text": "Français" }];
  assert.strictEqual(tp.pickLangText(node, "fr"), "Français");
  assert.strictEqual(tp.pickLangText("simple"), "simple");
  assert.strictEqual(tp.pickLangText(null), null);
  console.log("  OK");
}

console.log("== detectNewFlag : inedit / rediffusion / inconnu ==");
{
  assert.strictEqual(tp.detectNewFlag({ "new": "" }), true);
  assert.strictEqual(tp.detectNewFlag({ "previously-shown": "" }), false);
  assert.strictEqual(tp.detectNewFlag({}), null, "aucune info -> null (cf. Q2)");
  console.log("  OK");
}

console.log("== parseXmltv : chaines et programmes normalises ==");
const grid = tp.parseXmltv(SAMPLE, { preferLang: "fr" });
{
  assert.strictEqual(grid.channels.size, 2);
  assert.strictEqual(grid.channels.get("TF1.fr").name, "TF1");
  assert.strictEqual(grid.channels.get("TF1.fr").icon, "https://logo/tf1.png");
  assert.strictEqual(grid.channels.get("France2.fr").icon, null);
  assert.strictEqual(grid.programmes.length, 4);

  const film = grid.programmes.find((p) => p.title === "Grand film inédit");
  assert.strictEqual(film.isNew, true, "inedit detecte");
  assert.strictEqual(film.subtitle, "Un thriller");
  assert.strictEqual(film.desc, "Un synopsis en français.", "desc FR preferee a EN");
  assert.strictEqual(film.icon, "https://img/film.jpg");
  assert.strictEqual(film.category, "Film");

  const jt = grid.programmes.find((p) => p.title === "Journal de 20h");
  assert.strictEqual(jt.isNew, false, "rediffusion detectee");

  const debat = grid.programmes.find((p) => p.title === "Deuxième partie de soirée");
  assert.strictEqual(debat.isNew, null, "info absente -> null");
  console.log("  OK");
}

console.log("== programAtInstant : programme en cours ==");
{
  // 20h30 (heure de Paris) = 19:30 UTC -> Journal de 20h (20h-21h)
  const at = new Date("2024-01-15T19:30:00.000Z");
  const p = tp.programAtInstant(grid.programmes, "TF1.fr", at);
  assert.strictEqual(p.title, "Journal de 20h");
  // 22h00 Paris = 21:00 UTC -> Grand film (21h-23h)
  const at2 = new Date("2024-01-15T21:00:00.000Z");
  assert.strictEqual(tp.programAtInstant(grid.programmes, "TF1.fr", at2).title, "Grand film inédit");
  console.log("  OK");
}

console.log("== programDurationMinutes ==");
{
  assert.strictEqual(tp.programDurationMinutes(grid.programmes.find((p) => p.title === "Journal de 20h")), 60);
  assert.strictEqual(tp.programDurationMinutes(grid.programmes.find((p) => p.title === "Grand film inédit")), 120);
  console.log("  OK");
}

console.log("== programNearHour : filtre de duree minimale ==");
{
  const raw = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TF1.fr"><display-name lang="fr">TF1</display-name></channel>
  <programme start="20240115210000 +0100" stop="20240115210500 +0100" channel="TF1.fr"><title lang="fr">Météo</title></programme>
  <programme start="20240115210500 +0100" stop="20240115223500 +0100" channel="TF1.fr"><title lang="fr">Vraie émission</title></programme>
</tv>`;
  const g = tp.parseXmltv(raw, { preferLang: "fr" });
  const target = tp.targetDateForHour(new Date("2024-01-15T19:30:00.000Z"), "21:00");
  // Sans seuil : prend le plus proche (la meteo, pile a l'heure)
  assert.strictEqual(tp.programNearHour(g.programmes, "TF1.fr", target, 45, 90).title, "Météo");
  // Avec seuil 45 min : ignore la meteo (5 min), prend la vraie emission (1h30)
  assert.strictEqual(tp.programNearHour(g.programmes, "TF1.fr", target, 45, 90, 45).title, "Vraie émission");
  // Seuil trop eleve (aucun programme n'atteint 200 min) -> repli sur le plus proche
  assert.strictEqual(tp.programNearHour(g.programmes, "TF1.fr", target, 45, 90, 200).title, "Météo");
  console.log("  OK");
}

console.log("== buildView 'now' ==");
{
  const ref = new Date("2024-01-15T19:30:00.000Z"); // 20h30 Paris
  const view = tp.buildView(grid.programmes, ["TF1.fr", "France2.fr"], "now", ref, {});
  assert.strictEqual(view.length, 2);
  assert.strictEqual(view[0].program.title, "Journal de 20h");
  console.log("  OK:", view.map((v) => v.program && v.program.title).join(" | "));
}

console.log("== buildView 'evening' (~21h) ==");
{
  const ref = new Date("2024-01-15T19:30:00.000Z");
  const view = tp.buildView(grid.programmes, ["TF1.fr", "France2.fr"], "evening", ref, { eveningStart: "21:00" });
  // TF1 : le film a 21h ; France 2 : serie a 20h45 (dans la tolerance)
  assert.strictEqual(view[0].program.title, "Grand film inédit");
  assert.strictEqual(view[1].program.title, "Série du soir");
  console.log("  OK:", view.map((v) => v.program && v.program.title).join(" | "));
}

console.log("== buildView 'evening' : ignore une case courte (météo) pile a l'heure cible ==");
{
  // TF1 : meteo de 5 min a 21h00, puis la vraie emission de 21h05 a 22h35 (1h30)
  const raw = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TF1.fr"><display-name lang="fr">TF1</display-name></channel>
  <programme start="20240115210000 +0100" stop="20240115210500 +0100" channel="TF1.fr">
    <title lang="fr">Météo</title>
  </programme>
  <programme start="20240115210500 +0100" stop="20240115223500 +0100" channel="TF1.fr">
    <title lang="fr">Le vrai film du soir</title>
  </programme>
</tv>`;
  const g = tp.parseXmltv(raw, { preferLang: "fr" });
  const ref = new Date("2024-01-15T19:30:00.000Z");
  const view = tp.buildView(g.programmes, ["TF1.fr"], "evening", ref, { eveningStart: "21:00" });
  assert.strictEqual(view[0].program.title, "Le vrai film du soir",
    "la meteo (5 min) doit etre ignoree au profit de l'emission qui suit (1h30)");
  console.log("  OK:", view[0].program.title);
}

console.log("== buildView 'evening' : seuil de duree desactivable (minDuration=0) ==");
{
  const raw = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TF1.fr"><display-name lang="fr">TF1</display-name></channel>
  <programme start="20240115210000 +0100" stop="20240115210500 +0100" channel="TF1.fr"><title lang="fr">Météo</title></programme>
  <programme start="20240115210500 +0100" stop="20240115223500 +0100" channel="TF1.fr"><title lang="fr">Le vrai film du soir</title></programme>
</tv>`;
  const g = tp.parseXmltv(raw, { preferLang: "fr" });
  const ref = new Date("2024-01-15T19:30:00.000Z");
  const view = tp.buildView(g.programmes, ["TF1.fr"], "evening", ref, { eveningStart: "21:00", eveningMinDurationMinutes: 0 });
  assert.strictEqual(view[0].program.title, "Météo", "seuil desactive -> reprend le plus proche, meme court");
  console.log("  OK:", view[0].program.title);
}

console.log("== buildView 'evening' : chaine demarrant tot (TMC ~20h20) + intercalaire proche de 21h ==");
{
  // TMC : le vrai film demarre a 20h20 (100 min), suivi d'un
  // intercalaire de 45 min (juste assez long pour passer le seuil par
  // defaut) beaucoup plus proche de 21h -- ne doit PAS etre choisi.
  const raw = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TMC.fr"><display-name lang="fr">TMC</display-name></channel>
  <programme start="20240115202000 +0100" stop="20240115220000 +0100" channel="TMC.fr">
    <title lang="fr">Film du soir TMC</title>
  </programme>
  <programme start="20240115205000 +0100" stop="20240115213500 +0100" channel="TMC.fr">
    <title lang="fr">Intermède publicitaire</title>
  </programme>
</tv>`;
  const g = tp.parseXmltv(raw, { preferLang: "fr" });
  const ref = new Date("2024-01-15T18:30:00.000Z");
  const view = tp.buildView(g.programmes, ["TMC.fr"], "evening", ref, { eveningStart: "21:00" });
  assert.strictEqual(view[0].program.title, "Film du soir TMC",
    "le plus long doit l'emporter, meme si l'intercalaire demarre plus pres de 21h");
  console.log("  OK:", view[0].program.title);
}

console.log("== buildView 'late' (~22h45) ==");
{
  const ref = new Date("2024-01-15T19:30:00.000Z");
  const view = tp.buildView(grid.programmes, ["TF1.fr"], "late", ref, { lateStart: "22:45" });
  // 22h45 Paris ~ le "Deuxième partie de soirée" commence a 23h -> dans tolerance
  assert.strictEqual(view[0].program.title, "Deuxième partie de soirée");
  console.log("  OK:", view[0].program.title);
}

console.log("== resolveChannelId : nom lisible OU identifiant XMLTV ==");
{
  const gridCh = new Map([
    ["France2.fr", { id: "France2.fr", name: "France 2" }],
    ["TF1.fr", { id: "TF1.fr", name: "TF1" }]
  ]);
  assert.strictEqual(tp.resolveChannelId("France2.fr", gridCh), "France2.fr", "identifiant exact");
  assert.strictEqual(tp.resolveChannelId("France 2", gridCh), "France2.fr", "nom lisible");
  assert.strictEqual(tp.resolveChannelId("france2", gridCh), "France2.fr", "nom normalise");
  assert.strictEqual(tp.resolveChannelId("Chaine inconnue", gridCh), null, "inconnue -> null");
  console.log("  OK");
}

console.log("== parseXmltv : robustesse (XML vide/malformé) ==");
{
  assert.deepStrictEqual(tp.parseXmltv("", {}).programmes, []);
  assert.deepStrictEqual(tp.parseXmltv("<tv></tv>", {}).programmes, []);
  console.log("  OK");
}

console.log("== loadGrid : decompression gzip locale (.gz) ==");
{
  const zlib = require("zlib");
  const fs = require("fs");
  const path = "/tmp/_tp_test_epg.xml.gz";
  fs.writeFileSync(path, zlib.gzipSync(Buffer.from(SAMPLE)));
  return (async () => {
    tp.clearCache();
    const grid = await tp.loadGrid({ source: "xmltv", xmltvUrl: path }, {});
    assert.strictEqual(grid.programmes.length, 4, "gz decompresse et parse");
    fs.unlinkSync(path);
    console.log("  OK");

    console.log("== getView : source xmltvfr avec fallback multi-candidats (mock) ==");
    const zlib2 = require("zlib");
    const gzBuf = zlib2.gzipSync(Buffer.from(SAMPLE));
    const mockFetch = async (url) => {
      // 1er candidat TNT indisponible -> doit passer au suivant
      if (url.includes("xmltv_tnt")) return { ok: false, status: 404 };
      return { ok: true, status: 200, arrayBuffer: async () => gzBuf.buffer.slice(gzBuf.byteOffset, gzBuf.byteOffset + gzBuf.byteLength) };
    };
    tp.clearCache();
    const res = await tp.getView(
      { source: "xmltvfr", view: "now", channels: ["TF1.fr"] },
      { fetchImpl: mockFetch, now: new Date("2024-01-15T19:30:00.000Z").getTime() }
    );
    assert.strictEqual(res.channels[0].channelName, "TF1");
    assert.strictEqual(res.channels[0].program.title, "Journal de 20h");
    console.log("  OK");

    console.log("\n>>> TOUS LES TESTS TELEPROGRAM PASSENT");
  })();
}
