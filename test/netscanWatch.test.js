/* Tuile « Analyse reseau » : surveillance des nouveaux hotes. Le widget
   est execute dans jsdom avec un fetch factice ; on verifie l'affichage
   (pastilles, bandeau, absents, journal), les alertes ecran et webhook,
   et les actions (reconnaitre, memoriser en deux touches). */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let failed = 0;
function check(label, cond, detail) {
  if (cond) console.log("  OK   " + label);
  else { failed++; console.log("  FAIL " + label + (detail ? " -- " + detail : "")); }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 15));

(async () => {
  const dom = new JSDOM("<!doctype html><body><div id='t'></div></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  let Klass = null;
  w.PiBoard = { registerWidget: (id, k) => { if (id === "networkscan") Klass = k; } };
  w.eval(fs.readFileSync(path.join(__dirname, "..", "public", "widgets", "networkscan", "widget.js"), "utf8"));

  const calls = [];
  let payload = null;
  let claimGrant = true;
  w.fetch = async (url, opts) => {
    const method = (opts && opts.method) || "GET";
    calls.push({ url: String(url), method, body: opts && opts.body ? JSON.parse(opts.body) : null });
    const ok = (o) => ({ ok: true, status: 200, json: async () => o });
    if (String(url).startsWith("/api/network-scan")) return ok(payload);
    if (String(url).startsWith("/api/network-baseline/claim")) {
      const ids = JSON.parse(opts.body).ids;
      return ok({ ok: true, granted: claimGrant ? ids : [] });
    }
    if (String(url).startsWith("/api/network-baseline?")) {
      return ok({ baseline: null, log: [
        { t: "2026-11-01T10:00:00.000Z", type: "new", label: "intrus", ip: "192.168.1.50" },
        { t: "2026-11-01T09:00:00.000Z", type: "baseline", count: 3 }
      ] });
    }
    if (String(url).startsWith("/api/network-baseline")) return ok({ ok: true, baseline: { at: "2026-11-01T10:00:00.000Z", count: 3 } });
    return ok({});
  };

  const alerts = [];
  const notes = [];
  const el = w.document.getElementById("t");
  const ctx = {
    el, lang: "fr",
    settings: { alertFlash: true, alertSound: true, soundChoice: "beep-double", alertDurationSeconds: 15, notifyUrl: "https://ntfy.example/topic?m={message}", notifyMethod: "GET", notifyMessage: "", alertChanges: true, absentHours: 6 },
    i18n: { lang: "fr", t: (k) => ({ "netscan.msgNew": "Nouvel appareil : {name} ({details})", "netscan.msgChanged": "Modifie : {name} ({details})", "netscan.msgAbsent": "Absent : {name}" }[k] || k) },
    api: { startAlert: (o) => alerts.push(o), notify: (u, m, b) => notes.push({ u, m, b }) }
  };
  const host = (o) => Object.assign({ ip: "192.168.1.20", hostname: "tv", mac: "a8:bb:cc:00:00:20", key: "mac:a8:bb:cc:00:00:20", isSelf: false, vendor: null, randomMac: false, status: "known", alert: false, changed: null, eventId: null, firstSeen: "2026-10-01T10:00:00.000Z", lastSeen: "2026-11-01T10:00:00.000Z", alias: null }, o);
  const intrus = (iso) => host({ ip: "192.168.1.50", hostname: "intrus", mac: "a8:bb:cc:00:00:50", key: "mac:a8:bb:cc:00:00:50", status: "new", alert: true, eventId: "new:mac:a8:bb:cc:00:00:50", firstSeen: iso });
  const mk = (hosts, extra) => Object.assign({ scanning: false, hosts, cidr: "192.168.1.0/24", scannedAt: new Date().toISOString(), baseline: { at: "2026-11-01T10:00:00.000Z", count: 2 }, absent: [], newCount: 0, alertCount: 0, changedCount: 0 }, extra || {});

  console.log("== Surveillance : affichage et alertes ==");
  // Premier chargement : hote nouveau mais ancien (hier) -> pas d'alerte ecran, pastille oui.
  payload = mk([host(), intrus("2026-10-30T10:00:00.000Z")], { newCount: 1, alertCount: 1 });
  const widget = new Klass(ctx);
  await widget.init();
  await tick();
  check("pastille NOUVEAU affichee", el.querySelector(".pwn-badge-new") !== null);
  check("ligne nouvelle surlignee", el.querySelector(".pwn-row.pwn-new") !== null);
  check("bandeau d'alerte avec « tout reconnaitre »", el.querySelector(".pwn-banner [data-act='ackall']") !== null);
  check("barre de reference affichee", /netscan\.(baseSince|regSummary)/.test(el.querySelector(".pwn-base-text").textContent) || /2/.test(el.querySelector(".pwn-base-text").textContent));
  check("1er chargement, evenement ancien : aucune alerte ecran", alerts.length === 0, JSON.stringify(alerts));
  check("webhook : evenement revendique puis notifie", notes.length === 1 && /intrus/.test(decodeURIComponent(notes[0].u)) && notes[0].m === "GET", JSON.stringify(notes));
  check("message sans parentheses vides, avec details", /Nouvel appareil : intrus \(192\.168\.1\.50, a8:bb:cc:00:00:50\)/.test(decodeURIComponent(notes[0].u)), notes[0] && notes[0].u);

  // Nouvel hote qui apparait sous nos yeux : alerte ecran, une fois.
  payload = mk([host(), intrus("2026-10-30T10:00:00.000Z"), host({ ip: "192.168.1.60", hostname: "visiteur", mac: "a8:bb:cc:00:00:60", key: "mac:a8:bb:cc:00:00:60", status: "new", alert: true, eventId: "new:mac:a8:bb:cc:00:00:60", firstSeen: new Date().toISOString() })], { newCount: 2, alertCount: 2 });
  await widget.refresh(true);
  await tick();
  check("hote apparu pendant la session : alerte ecran", alerts.length === 1 && alerts[0].flash === true && alerts[0].soundName === "beep-double" && alerts[0].durationMs === 15000, JSON.stringify(alerts));
  check("seul le nouvel evenement part en webhook", notes.length === 2 && /visiteur/.test(decodeURIComponent(notes[1].u)));
  await widget.refresh(true);
  await tick();
  check("pas de nouvelle alerte au scan suivant", alerts.length === 1 && notes.length === 2);

  // Webhook deja revendique par un autre ecran : pas d'envoi ici.
  claimGrant = false;
  payload = mk([host(), host({ ip: "192.168.1.70", mac: "a8:bb:cc:00:00:70", key: "mac:a8:bb:cc:00:00:70", hostname: "x", status: "new", alert: true, eventId: "new:mac:a8:bb:cc:00:00:70", firstSeen: new Date().toISOString() })], { newCount: 1, alertCount: 1 });
  await widget.refresh(true);
  await tick();
  check("revendique ailleurs : aucun webhook ici", notes.length === 2, String(notes.length));
  claimGrant = true;

  // MAC aleatoire : pastille mais jamais d'alerte (alert=false cote serveur).
  payload = mk([host(), host({ ip: "192.168.1.80", mac: "da:a1:19:00:00:80", key: "mac:da:a1:19:00:00:80", hostname: null, status: "new", alert: false, randomMac: true, eventId: "new:mac:da:a1:19:00:00:80", firstSeen: new Date().toISOString() })], { newCount: 1, alertCount: 0 });
  const nA = alerts.length;
  await widget.refresh(true);
  await tick();
  check("MAC aleatoire : pastille dediee", el.querySelector(".pwn-badge-rnd") !== null);
  check("MAC aleatoire : silencieuse", alerts.length === nA);

  // Changement d'identite + absent.
  payload = mk([host({ ip: "192.168.1.99", changed: { at: new Date().toISOString(), fromIp: "192.168.1.20", fromHostname: "tv" }, eventId: "changed:mac:a8:bb:cc:00:00:20:" + new Date().toISOString() })], {
    changedCount: 1,
    absent: [{ key: "mac:a8:bb:cc:00:00:30", name: "Mon NAS", ip: "192.168.1.30", mac: "a8:bb:cc:00:00:30", vendor: null, lastSeen: "2026-11-01T01:00:00.000Z", eventId: "absent:mac:a8:bb:cc:00:00:30:2026-11-01T01:00:00.000Z" }]
  });
  await widget.refresh(true);
  await tick();
  check("badge « modifie » avec l'ancienne IP en infobulle", /192\.168\.1\.20/.test((el.querySelector(".pwn-badge-chg") || { title: "" }).title));
  check("section des absents", el.querySelector(".pwn-absent .pwn-name") && el.querySelector(".pwn-absent .pwn-name").textContent === "Mon NAS");
  check("changement et absence alertent a l'ecran", alerts.length === nA + 1, String(alerts.length - nA));

  console.log("== Surveillance : actions ==");
  // Regression 1.170.1 : les boutons de surveillance partageaient la classe
  // des boutons Export/Import, et ouvraient la fenetre « Ouvrir un fichier ».
  let fileDialogs = 0;
  const realCreate = w.document.createElement.bind(w.document);
  w.document.createElement = (tag) => { const n = realCreate(tag); if (String(tag).toLowerCase() === "input") n.click = () => { if (n.type === "file") fileDialogs++; }; return n; };
  const tap = (node) => node.dispatchEvent(new w.Event("pointerup", { bubbles: true, cancelable: true }));
  payload = mk([host(), intrus("2026-10-30T10:00:00.000Z")], { newCount: 1, alertCount: 1 });
  await widget.refresh(true);
  await tick();
  calls.length = 0;
  tap(el.querySelector(".pwn-row.pwn-new .pwn-ack-btn"));
  await tick(40);
  const ack = calls.find((c) => c.url === "/api/network-baseline/ack");
  check("reconnaitre : POST ack avec la cle de l'hote", ack && ack.method === "POST" && ack.body.keys[0] === "mac:a8:bb:cc:00:00:50", JSON.stringify(calls));

  calls.length = 0;
  tap(el.querySelector("[data-act='ackall']"));
  await tick(40);
  check("tout reconnaitre : POST ack", calls.some((c) => c.url === "/api/network-baseline/ack" && c.body.keys.length === 1));

  calls.length = 0;
  tap(el.querySelector("[data-act='memorize']"));
  await tick(20);
  // 1.181.0 : referentiel cumulatif, une seule touche suffit.
  check("mise a jour du referentiel en une touche (cumulatif, sans confirmation)", calls.some((c) => c.url === "/api/network-baseline/memorize" && c.method === "POST") && el.querySelector(".pwn-mem-btn.pwn-confirm") === null);

  calls.length = 0;
  tap(el.querySelector("[data-act='reset']"));
  await tick(20);
  check("reinitialiser : 1re touche ne supprime rien", !calls.some((c) => c.method === "DELETE"));
  tap(el.querySelector("[data-act='reset']"));
  await tick(40);
  check("reinitialiser : 2e touche supprime", calls.some((c) => c.url === "/api/network-baseline" && c.method === "DELETE"));

  tap(el.querySelector("[data-act='log']"));
  await tick(40);
  check("journal : lignes affichees", el.querySelectorAll(".pwn-logrow").length === 2 && /intrus/.test(el.querySelector(".pwn-list").textContent));
  tap(el.querySelector("[data-act='log']"));
  await tick();
  check("retour a la liste", el.querySelector(".pwn-logrow") === null && el.querySelector(".pwn-row") !== null);

  // Sans reference : bouton « Memoriser » direct, sans confirmation.
  payload = mk([host()], { baseline: null });
  await widget.refresh(true);
  await tick();
  calls.length = 0;
  tap(el.querySelector("[data-act='memorize']"));
  await tick(40);
  check("sans reference : memorisation immediate", calls.some((c) => c.url === "/api/network-baseline/memorize"));
  check("sans reference : pas de bouton de suppression", el.querySelector("[data-act='reset']") === null);

  // Les boutons d'action ne sont pas pris pour le renommage.
  check("renommage : un seul bouton ✎ par ligne d'hote", el.querySelectorAll(".pwn-row:not(.pwn-absent) .pwn-rename-btn:not([data-act])").length === el.querySelectorAll(".pwn-row:not(.pwn-absent):not(.pwn-logrow)").length);

  check("aucun bouton de surveillance n'ouvre de selecteur de fichier", fileDialogs === 0, String(fileDialogs));
  tap(el.querySelector("[data-io='import']"));
  check("le bouton Importer, lui, en ouvre bien un", fileDialogs === 1, String(fileDialogs));

  console.log("== Referentiel, reseau, fiche, fusion (1.181.0) ==");
  const tv = host({ alias: "TV salon", reg: { type: "tv", owner: "Famille", notes: "", trusted: true, firstSeen: "2026-10-01T10:00:00.000Z", lastSeen: "2026-11-01T10:00:00.000Z", networks: [{ id: "gw:aa:aa:aa:00:00:01", name: null }], seenBy: [{ id: "pb-0123456789ab", name: "mac-mini", at: "2026-11-01T10:00:00.000Z" }], ips: [{ ip: "192.168.1.20", net: null, first: "2026-10-01T10:00:00.000Z", last: "2026-11-01T10:00:00.000Z" }] } });
  payload = mk([tv], { network: { id: "gw:aa:aa:aa:00:00:01", name: null, gatewayIp: "192.168.1.1", assumed: false } });
  await widget.refresh(false);
  await tick();
  check("bandeau nouveau reseau", el.querySelector(".pwn-net-new [data-net='edit']") !== null);
  check("icone du type, proprietaire, confiance", el.querySelector(".pwn-row .pwn-type") !== null && /Famille/.test(el.querySelector(".pwn-row .pwn-owner").textContent) && el.querySelector(".pwn-row .pwn-trusted") !== null);
  tap(el.querySelector(".pwn-net-new [data-net='edit']"));
  await tick();
  const ni = el.querySelector(".pwn-net-input");
  check("saisie du nom du reseau", !!ni);
  ni.value = "Maison";
  calls.length = 0;
  tap(el.querySelector("[data-net='ok']"));
  await tick(30);
  check("nom du reseau envoye", calls.some((c) => c.url === "/api/network-registry/network" && c.body.name === "Maison" && c.body.id === "gw:aa:aa:aa:00:00:01"));
  check("reseau affiche avec son nom", /Maison/.test((el.querySelector(".pwn-net-name") || {}).textContent || ""));
  check("le crayon du reseau n'ouvre pas le renommage d'un hote", (tap(el.querySelector(".pwn-net [data-net='edit']")), el.querySelector(".pwn-edit-input") === null));
  widget.editingNet = false; widget.render();
  widget.openHost(payload.hosts[0]);
  const box = w.document.querySelector(".pwn-hw");
  check("fiche dans la fenetre de l'hote", box && box.querySelector(".pwn-rec-type") && box.querySelector(".pwn-rec-type").value === "tv" && box.querySelector(".pwn-rec-trusted").checked);
  check("vu par affiche", /mac-mini/.test(box.querySelector(".pwn-rec-info").textContent));
  box.querySelector(".pwn-rec-owner").value = "Salon";
  calls.length = 0;
  tap(box.querySelector("[data-hw='regsave']"));
  await tick(30);
  const sv = calls.find((c) => c.url === "/api/network-registry/device");
  check("fiche enregistree", sv && sv.body.key === "mac:a8:bb:cc:00:00:20" && sv.body.fields.owner === "Salon" && sv.body.fields.type === "tv" && sv.body.fields.trusted === true, JSON.stringify(sv && sv.body));
  widget.closeHost();
  const plan = { from: { id: "pb-0123456789ab", name: "PC bureau" }, sameMachine: false, added: [{ key: "mac:c0:ff:ee:00:00:01", label: "Imprimante" }], updated: [], removed: [], networks: [],
    conflicts: [{ id: "mac:a8:bb:cc:00:00:20|owner", key: "mac:a8:bb:cc:00:00:20", field: "owner", label: "TV salon", local: { v: "Famille", at: "2026-11-01T10:00:00.000Z", byName: "mac-mini" }, remote: { v: "Salon", at: "2026-11-02T10:00:00.000Z", byName: "PC bureau" }, suggested: "remote" }] };
  widget.openMerge({ format: "piboard-network-registry" }, plan);
  const mg = w.document.querySelector(".pwn-mg");
  check("ecran de fusion : conflit montre, plus recent coche", mg && mg.querySelectorAll(".pwn-mg-conf").length === 1 && mg.querySelector(".pwn-mg-conf input[value='remote']").checked);
  mg.querySelector(".pwn-mg-conf input[value='local']").checked = true;
  calls.length = 0;
  tap(mg.querySelector("[data-mg='apply']"));
  await tick(40);
  const mc = calls.find((c) => c.url === "/api/network-registry/merge");
  check("fusion envoyee avec le choix de l'utilisateur", mc && mc.body.choices["mac:a8:bb:cc:00:00:20|owner"] === "local");
  check("ecran de fusion ferme", w.document.querySelector(".pwn-mg") === null);
  check("boutons export et fusion du referentiel", el.querySelector("[data-io='regexport']") && el.querySelector("[data-io='regmerge']"));

  widget.destroy();
  console.log(failed ? "\n" + failed + " echec(s)" : "\nnetscanWatch : tous les tests OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
