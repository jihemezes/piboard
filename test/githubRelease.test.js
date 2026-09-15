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

  console.log(failures ? `\n>>> ${failures} ECHEC(S)` : "\n>>> TOUS LES TESTS PASSENT");
  process.exit(failures ? 1 : 0);
})();
