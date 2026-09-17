/* Tests hors ligne de scripts/githubRelease.js : un faux GitHub en
   memoire rejoue les situations reelles de la 1.110.2 (release creee
   par un autre publieur, doublons nes d'une course).
   Offline tests of scripts/githubRelease.js: an in-memory fake GitHub
   replays the real 1.110.2 situations. */
"use strict";

const assert = require("assert");
const rel = require("../scripts/githubRelease");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("  OK   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + "\n       " + e.message); }
}

function fakeGitHub(initial, opts) {
  const o = opts || {};
  const state = { releases: (initial || []).map((r) => Object.assign({ assets: [] }, r)), nextId: 100, calls: [] };
  const request = async (method, url, body) => {
    state.calls.push(method + " " + url);
    if (method === "GET") return { ok: true, status: 200, data: state.releases.map((r) => Object.assign({}, r)) };
    if (method === "POST") {
      // Course simulee : un autre publieur cree la sienne au meme instant.
      // Simulated race: another publisher creates its own at the same time.
      if (o.raceTwin) {
        state.releases.push({ id: state.nextId++, tag_name: body.tag_name, assets: o.twinAssets || [], html_url: "u/twin" });
      }
      if (o.conflict) return { ok: false, status: 422, data: { errors: [{ code: "already_exists" }] } };
      const r = { id: state.nextId++, tag_name: body.tag_name, prerelease: body.prerelease, assets: [], html_url: "u/mine" };
      state.releases.push(r);
      return { ok: true, status: 201, data: r };
    }
    if (method === "DELETE") {
      const id = Number(url.split("/").pop());
      state.releases = state.releases.filter((r) => r.id !== id);
      return { ok: true, status: 204, data: null };
    }
    return { ok: false, status: 400, data: null };
  };
  return { state, request };
}

const base = { tag: "v1.2.3", name: "1.2.3", prerelease: false, wait: async () => {} };

(async () => {
  console.log("== githubRelease ==");

  await test("plateformes lues depuis les arguments", () => {
    assert.deepStrictEqual(rel.platformsOf(["--win"]), ["win"]);
    assert.deepStrictEqual(rel.platformsOf(["--linux", "--x64", "--arm64"]), ["linux"]);
    assert.deepStrictEqual(rel.platformsOf(["--ensure-only"]), []);
  });

  await test("un .blockmap seul ne compte pas comme fichier publie", () => {
    const r = { assets: [{ name: "PiBoard-Setup-1.2.3.exe.blockmap" }] };
    assert.deepStrictEqual(rel.platformAssets(r, "win"), []);
    const r2 = { assets: [{ name: "PiBoard-Setup-1.2.3.exe" }, { name: "latest.yml" }, { name: "latest-mac.yml" }] };
    assert.deepStrictEqual(rel.platformAssets(r2, "win"), ["PiBoard-Setup-1.2.3.exe", "latest.yml"]);
  });

  await test("aucune release : elle est creee une fois", async () => {
    const gh = fakeGitHub([]);
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["win"] }, base));
    assert.strictEqual(out.created, true);
    assert.strictEqual(gh.state.releases.length, 1);
    assert.strictEqual(gh.state.releases[0].prerelease, false);
  });

  await test("release creee par Actions (fichiers mac) : Windows continue sans erreur", async () => {
    const gh = fakeGitHub([{ id: 5, tag_name: "v1.2.3", assets: [{ name: "PiBoard-1.2.3-mac-x64.dmg" }, { name: "latest-mac.yml" }] }]);
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["win"] }, base));
    assert.strictEqual(out.created, false);
    assert.strictEqual(out.release.id, 5);
    assert.ok(!gh.state.calls.some((c) => c.startsWith("POST")), "aucune creation");
  });

  await test("la plateforme deja publiee est refusee, avec explication", async () => {
    const gh = fakeGitHub([{ id: 5, tag_name: "v1.2.3", html_url: "u/5", assets: [{ name: "PiBoard-1.2.3-linux-arm64.deb" }] }]);
    await assert.rejects(
      rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["linux"] }, base)),
      /contient deja les fichiers linux/
    );
  });

  await test("course a la creation : le doublon vide est supprime, la plus ancienne gardee", async () => {
    const gh = fakeGitHub([], { raceTwin: true });
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["win"] }, base));
    assert.strictEqual(gh.state.releases.length, 1);
    assert.strictEqual(out.release.id, 100);
  });

  await test("course perdue (422) : on reprend la release de l'autre", async () => {
    const gh = fakeGitHub([], { raceTwin: true, conflict: true });
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["mac"] }, base));
    assert.strictEqual(out.created, false);
    assert.strictEqual(gh.state.releases.length, 1);
  });

  await test("doublons qui ont chacun de vrais fichiers : arret, rien supprime", async () => {
    const gh = fakeGitHub([
      { id: 1, tag_name: "v1.2.3", html_url: "u/1", assets: [{ name: "latest-mac.yml" }] },
      { id: 2, tag_name: "v1.2.3", html_url: "u/2", assets: [{ name: "PiBoard-Setup-1.2.3.exe" }] }
    ]);
    await assert.rejects(
      rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["linux"] }, base)),
      /Plusieurs releases/
    );
    assert.strictEqual(gh.state.releases.length, 2);
  });

  await test("doublon ne contenant qu'un .blockmap : supprime (cas reel 1.110.2)", async () => {
    const gh = fakeGitHub([
      { id: 1, tag_name: "v1.2.3", assets: [{ name: "latest-mac.yml" }, { name: "PiBoard-1.2.3-mac-x64.zip" }] },
      { id: 2, tag_name: "v1.2.3", assets: [{ name: "PiBoard-Setup-1.2.3.exe.blockmap" }] }
    ]);
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["win"] }, base));
    assert.strictEqual(out.release.id, 1);
    assert.deepStrictEqual(gh.state.releases.map((r) => r.id), [1]);
  });

  await test("une pre-release est creee comme telle", async () => {
    const gh = fakeGitHub([]);
    await rel.ensureRelease(Object.assign({ request: gh.request, platforms: [] }, base, { prerelease: true }));
    assert.strictEqual(gh.state.releases[0].prerelease, true);
  });

  await test("les autres tags sont ignores", async () => {
    const gh = fakeGitHub([{ id: 9, tag_name: "v1.2.2", assets: [{ name: "latest.yml" }] }]);
    const out = await rel.ensureRelease(Object.assign({ request: gh.request, platforms: ["win"] }, base));
    assert.strictEqual(out.created, true);
    assert.strictEqual(gh.state.releases.length, 2);
  });

  await test("verification : fichiers Linux manquants detectes (cas du job vert sans envoi)", async () => {
    const gh = fakeGitHub([{ id: 1, tag_name: "v1.2.3", assets: [{ name: "latest-mac.yml" }, { name: "PiBoard-1.2.3-linux-arm64.deb" }] }]);
    const out = await rel.verifyPublished({ request: gh.request, tag: "v1.2.3", platforms: ["linux"], wait: async () => {}, attempts: 2 });
    assert.strictEqual(out.ok, false);
    assert.ok(/AppImage x64/.test(out.problems[0]) && !/deb arm64/.test(out.problems[0]));
  });

  await test("verification : Windows complet accepte, .blockmap seul refuse", async () => {
    const ok = fakeGitHub([{ id: 1, tag_name: "v1.2.3", assets: [{ name: "PiBoard-Setup-1.2.3.exe" }, { name: "latest.yml" }] }]);
    assert.strictEqual((await rel.verifyPublished({ request: ok.request, tag: "v1.2.3", platforms: ["win"], wait: async () => {} })).ok, true);
    const ko = fakeGitHub([{ id: 1, tag_name: "v1.2.3", assets: [{ name: "PiBoard-Setup-1.2.3.exe.blockmap" }] }]);
    const out = await rel.verifyPublished({ request: ko.request, tag: "v1.2.3", platforms: ["win"], wait: async () => {}, attempts: 1 });
    assert.strictEqual(out.ok, false);
    assert.ok(/installeur .exe/.test(out.problems[0]) && /latest\.yml/.test(out.problems[0]));
  });

  await test("verification : deux releases pour le tag = echec", async () => {
    const gh = fakeGitHub([{ id: 1, tag_name: "v1.2.3" }, { id: 2, tag_name: "v1.2.3" }]);
    const out = await rel.verifyPublished({ request: gh.request, tag: "v1.2.3", platforms: [], wait: async () => {}, attempts: 1 });
    assert.strictEqual(out.ok, false);
  });

  await test("verification : fichiers arrives avec retard, acceptes au second essai", async () => {
    const gh = fakeGitHub([{ id: 1, tag_name: "v1.2.3", assets: [] }]);
    let n = 0;
    const out = await rel.verifyPublished({
      request: gh.request, tag: "v1.2.3", platforms: ["mac"], attempts: 3,
      wait: async () => { if (++n === 1) gh.state.releases[0].assets = ["x64.dmg", "arm64.dmg", "x64.zip", "arm64.zip"].map((e) => ({ name: "PiBoard-1.2.3-mac-" + e })).concat([{ name: "latest-mac.yml" }]); }
    });
    assert.strictEqual(out.ok, true);
  });

  await test("reprise : seuls les fichiers manquants de la plateforme sont envoyes", async () => {
    const local = [
      { name: "PiBoard-1.2.3-linux-x86_64.AppImage", size: 10, path: "/d/a" },
      { name: "PiBoard-1.2.3-linux-x86_64.AppImage.blockmap", size: 2, path: "/d/b" },
      { name: "latest-linux.yml", size: 1, path: "/d/c" },
      { name: "PiBoard-1.2.3-mac-x64.dmg", size: 9, path: "/d/d" },
      { name: "builder-effective-config.yaml", size: 1, path: "/d/e" }
    ];
    const release = { assets: [{ id: 1, name: "latest-linux.yml", size: 1, state: "uploaded" }] };
    const plan = rel.planUploads(local, release, "linux");
    assert.deepStrictEqual(plan.uploads.map((f) => f.name).sort(),
      ["PiBoard-1.2.3-linux-x86_64.AppImage", "PiBoard-1.2.3-linux-x86_64.AppImage.blockmap"]);
    assert.deepStrictEqual(plan.stale, []);
  });

  await test("reprise : un reste d'envoi interrompu est remplace", async () => {
    const local = [{ name: "PiBoard-1.2.3-mac-x64.dmg", size: 100, path: "/d/a" }];
    const partial = { assets: [{ id: 7, name: "PiBoard-1.2.3-mac-x64.dmg", size: 40, state: "starter" }] };
    const plan = rel.planUploads(local, partial, "mac");
    assert.deepStrictEqual(plan.stale.map((a) => a.id), [7]);
    assert.strictEqual(plan.uploads.length, 1);
    // Taille differente, meme etat "uploaded" : remplace aussi.
    const wrongSize = { assets: [{ id: 8, name: "PiBoard-1.2.3-mac-x64.dmg", size: 40, state: "uploaded" }] };
    assert.deepStrictEqual(rel.planUploads(local, wrongSize, "mac").stale.map((a) => a.id), [8]);
    // Identique : rien a faire.
    const same = { assets: [{ id: 9, name: "PiBoard-1.2.3-mac-x64.dmg", size: 100, state: "uploaded" }] };
    assert.deepStrictEqual(rel.planUploads(local, same, "mac").uploads, []);
  });

  await test("reprise : un envoi refuse par GitHub est retente (cas reel 1.112.1)", async () => {
    let calls = 0;
    const r = await rel.uploadWithRetries({
      file: { name: "x.dmg", size: 1, path: "/d/x" },
      release: { id: 1 },
      wait: async () => {},
      uploader: async () => {
        calls++;
        // 500 « Error saving asset », puis delai depasse, puis OK.
        if (calls === 1) return { ok: false, status: 500, error: "HTTP 500 Error saving asset" };
        if (calls === 2) return { ok: false, error: "delai depasse" };
        return { ok: true };
      }
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(calls, 3);
  });

  await test("reprise : un echec persistant est signale, pas masque", async () => {
    const r = await rel.uploadWithRetries({
      file: { name: "x.dmg", size: 1, path: "/d/x" }, release: { id: 1 }, attempts: 2, wait: async () => {},
      uploader: async () => ({ ok: false, error: "HTTP 500 Error saving asset" })
    });
    assert.strictEqual(r.ok, false);
    assert.ok(/500/.test(r.error));
  });

  await test("reprise : la release est completee puis rendue conforme", async () => {
    const gh = fakeGitHub([{ id: 5, tag_name: "v1.2.3", assets: [
      { id: 1, name: "PiBoard-1.2.3-linux-arm64.AppImage", size: 3, state: "uploaded" },
      { id: 2, name: "PiBoard-1.2.3-linux-amd64.deb", size: 3, state: "uploaded" },
      { id: 3, name: "PiBoard-1.2.3-linux-arm64.deb", size: 3, state: "uploaded" },
      { id: 4, name: "latest-linux-arm64.yml", size: 3, state: "uploaded" }
    ] }]);
    const local = ["PiBoard-1.2.3-linux-x86_64.AppImage", "latest-linux.yml"].map((name) => ({ name, size: 3, path: "/d/" + name }));
    const sentNames = [];
    const out = await rel.repairRelease({
      request: gh.request, tag: "v1.2.3", platforms: ["linux"], localFiles: local, wait: async () => {},
      uploader: async ({ file }) => { sentNames.push(file.name); gh.state.releases[0].assets.push({ id: 90 + sentNames.length, name: file.name, size: file.size, state: "uploaded" }); return { ok: true }; }
    });
    assert.strictEqual(out.ok, true);
    assert.deepStrictEqual(sentNames.sort(), ["PiBoard-1.2.3-linux-x86_64.AppImage", "latest-linux.yml"]);
    const check = await rel.verifyPublished({ request: gh.request, tag: "v1.2.3", platforms: ["linux"], wait: async () => {}, attempts: 1 });
    assert.strictEqual(check.ok, true, JSON.stringify(check.problems));
  });

  await test("reprise : type de contenu correct pour les yml et les zip", () => {
    assert.strictEqual(rel.contentType("latest-mac.yml"), "text/yaml");
    assert.strictEqual(rel.contentType("PiBoard-mac-x64.zip"), "application/zip");
    assert.strictEqual(rel.contentType("PiBoard.exe.blockmap"), "application/octet-stream");
  });

  await test("reprise : le nom du disque est traduit en nom publie (cas reel 1.112.2)", async () => {
    // electron-builder ecrit « PiBoard Setup 1.2.3.exe » et publie
    // « PiBoard-Setup-1.2.3.exe » : la reprise croyait n'avoir rien a faire.
    assert.strictEqual(rel.assetName("PiBoard Setup 1.2.3.exe"), "PiBoard-Setup-1.2.3.exe");
    const local = [
      { name: "PiBoard Setup 1.2.3.exe", size: 5, path: "/d/a" },
      { name: "PiBoard Setup 1.2.3.exe.blockmap", size: 1, path: "/d/b" },
      { name: "latest.yml", size: 1, path: "/d/c" }
    ];
    const plan = rel.planUploads(local, { assets: [] }, "win");
    assert.deepStrictEqual(plan.uploads.map((f) => f.assetName),
      ["PiBoard-Setup-1.2.3.exe", "PiBoard-Setup-1.2.3.exe.blockmap", "latest.yml"]);
    const already = { assets: [{ id: 1, name: "PiBoard-Setup-1.2.3.exe", size: 5, state: "uploaded" }] };
    assert.deepStrictEqual(rel.planUploads(local, already, "win").uploads.map((f) => f.assetName),
      ["PiBoard-Setup-1.2.3.exe.blockmap", "latest.yml"]);
  });

  await test("reprise : un fichier absent de la release ET de dist est signale", async () => {
    const gh = fakeGitHub([{ id: 5, tag_name: "v1.2.3", assets: [] }]);
    const out = await rel.repairRelease({
      request: gh.request, tag: "v1.2.3", platforms: ["win"], wait: async () => {},
      localFiles: [{ name: "PiBoard Setup 1.2.3.exe", size: 5, path: "/d/a" }],
      uploader: async () => ({ ok: true })
    });
    assert.strictEqual(out.sent, 1, "l'exe est bien envoye");
    assert.strictEqual(out.ok, false);
    assert.ok(/latest\.yml.*dist/.test(out.problems.join(" ")), out.problems.join(" "));
  });

  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failures ? 1 : 0);
})();
