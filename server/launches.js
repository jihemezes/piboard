/* PiBoard - lancements spatiaux (1.177.0)
   ---------------------------------------
   Source : Launch Library 2 (The Space Devs), API publique et gratuite.
   Le niveau gratuit limite a une quinzaine d'appels par heure : le serveur
   lit donc la liste A SA PLACE, la garde en cache et la sert a toutes les
   tuiles. Rythme : toutes les 30 min, toutes les 10 min dans les 3 heures
   qui precedent un tir ; les lancements passes toutes les heures. Sur une
   erreur (dont 429 « trop d'appels »), les dernieres donnees restent
   servies et la lecture suivante est repoussee.

   Le mode « detailed » est necessaire : c'est le seul qui porte les liens
   des diffusions (vid_urls, YouTube le plus souvent).

   Rocket launches. Source: Launch Library 2 (The Space Devs). The free
   tier allows ~15 calls per hour, so the server fetches on the tiles'
   behalf, caches and serves them all: every 30 min, every 10 min within
   3 h of a launch, past launches hourly; on error (429 included) the last
   data keeps being served and the next fetch is pushed back. "detailed"
   mode is required: only it carries webcast links (vid_urls). */
"use strict";

const BASE = "https://ll.thespacedevs.com/2.3.0/launches/";
const UA = "PiBoard (+https://github.com/jihemezes/piboard)";
const MIN = 60000;

const state = {
  upcoming: null, previous: null,
  upcomingAt: 0, previousAt: 0,
  nextUpcomingAt: 0, nextPreviousAt: 0,
  error: null, inflight: null
};

function pickVideos(list) {
  return (Array.isArray(list) ? list : [])
    .filter((v) => v && /^https?:\/\//i.test(String(v.url || "")))
    .sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99))
    .slice(0, 6)
    .map((v) => ({
      url: v.url,
      title: v.title || "",
      publisher: v.publisher || "",
      source: v.source || "",
      youtube: /youtu\.?be/i.test(String(v.url) + " " + String(v.source || "")),
      live: !!v.live,
      lang: v.language && v.language.code ? v.language.code : null,
      start: v.start_time || null
    }));
}

/* Ramene un lancement a ce dont la tuile a besoin. */
function normalize(r) {
  if (!r || !r.id) return null;
  const lsp = r.launch_service_provider || {};
  const rocket = (r.rocket && r.rocket.configuration) || {};
  const mission = r.mission || {};
  const pad = r.pad || {};
  const img = r.image || {};
  return {
    id: String(r.id),
    name: r.name || "",
    net: r.net || null,
    windowStart: r.window_start || null,
    windowEnd: r.window_end || null,
    precision: r.net_precision ? (r.net_precision.abbrev || r.net_precision.name || null) : null,
    status: r.status ? { abbrev: r.status.abbrev || "", name: r.status.name || "", id: r.status.id || null } : null,
    provider: { name: lsp.name || "", abbrev: lsp.abbrev || "", country: lsp.country && lsp.country[0] ? (lsp.country[0].alpha_2_code || "") : "" },
    rocket: rocket.full_name || rocket.name || "",
    mission: mission.name ? {
      name: mission.name,
      description: String(mission.description || "").slice(0, 1200),
      type: mission.type || "",
      orbit: mission.orbit ? (mission.orbit.abbrev || mission.orbit.name || "") : "",
      orbitName: mission.orbit ? (mission.orbit.name || "") : "",
      customers: Array.isArray(mission.agencies) ? mission.agencies.map((a) => a && a.name).filter(Boolean).slice(0, 4) : []
    } : null,
    pad: { name: pad.name || "", location: pad.location ? (pad.location.name || "") : "", country: pad.country ? (pad.country.alpha_2_code || "") : "" },
    image: img.thumbnail_url || img.image_url || null,
    probability: Number.isFinite(r.probability) ? r.probability : null,
    weather: r.weather_concerns || null,
    failreason: r.failreason || null,
    holdreason: r.holdreason || null,
    webcastLive: !!r.webcast_live,
    videos: pickVideos(r.vid_urls),
    infoUrl: (Array.isArray(r.info_urls) && r.info_urls[0] && r.info_urls[0].url) || null,
    updates: (Array.isArray(r.updates) ? r.updates : []).slice(0, 5).map((u) => ({ at: u.created_on || null, text: String(u.comment || "").slice(0, 300) })).filter((u) => u.text)
  };
}

async function fetchList(kind, limit, fetchImpl) {
  const f = fetchImpl || fetch;
  const url = BASE + kind + "/?mode=detailed&limit=" + limit;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await f(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
    const data = await res.json();
    return (data.results || []).map(normalize).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

/* Prochaine lecture de la liste a venir : plus rapprochee a l'approche
   d'un tir. Next upcoming fetch: closer as a launch approaches. */
function upcomingDelay(list, now) {
  const t = now || Date.now();
  const soon = (list || []).some((l) => {
    const n = new Date(l.net).getTime();
    return Number.isFinite(n) && n - t < 3 * 60 * MIN && n - t > -60 * MIN;
  });
  return soon ? 10 * MIN : 30 * MIN;
}

async function refresh(opts) {
  const o = opts || {};
  const now = o.now || Date.now();
  if (state.inflight) return state.inflight;
  if (!(o.force || now >= state.nextUpcomingAt || now >= state.nextPreviousAt)) return Promise.resolve();
  const job = (async () => {
    await null; // jamais synchrone : l'enregistrement ci-dessous precede la fin / never synchronous
    try {
      if (o.force || now >= state.nextUpcomingAt) {
        try {
          state.upcoming = await fetchList("upcoming", 25, o.fetch);
          state.upcomingAt = now;
          state.nextUpcomingAt = now + upcomingDelay(state.upcoming, now);
          state.error = null;
        } catch (e) {
          state.error = e.status === 429 ? "rate-limited" : String(e.message || e);
          state.nextUpcomingAt = now + (e.status === 429 ? 30 : 10) * MIN;
        }
      }
      if (o.force || now >= state.nextPreviousAt) {
        try {
          state.previous = await fetchList("previous", 10, o.fetch);
          state.previousAt = now;
          state.nextPreviousAt = now + 60 * MIN;
        } catch (e) {
          state.nextPreviousAt = now + 30 * MIN;
          if (!state.error) state.error = e.status === 429 ? "rate-limited" : String(e.message || e);
        }
      }
    } finally {
      if (state.inflight === job) state.inflight = null;
    }
  })();
  state.inflight = job;
  return job;
}

async function getLaunches(opts) {
  await refresh(opts);
  return {
    upcoming: state.upcoming || [],
    previous: state.previous || [],
    updatedAt: state.upcomingAt ? new Date(state.upcomingAt).toISOString() : null,
    error: state.error,
    stale: !!state.error
  };
}

/* Alertes : un lancement n'est annonce qu'une fois, meme si plusieurs
   ecrans affichent la tuile. Alerts: announced once across screens. */
const claimed = new Map();
function claim(ids) {
  const now = Date.now();
  for (const [k, t] of claimed) if (now - t > 2 * 24 * 60 * MIN) claimed.delete(k);
  const granted = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const k = String(id).slice(0, 120);
    if (!claimed.has(k)) { claimed.set(k, now); granted.push(k); }
  }
  return granted;
}

function _reset() {
  Object.assign(state, { upcoming: null, previous: null, upcomingAt: 0, previousAt: 0, nextUpcomingAt: 0, nextPreviousAt: 0, error: null, inflight: null });
  claimed.clear();
}

module.exports = { normalize, pickVideos, upcomingDelay, getLaunches, refresh, claim, _reset };
