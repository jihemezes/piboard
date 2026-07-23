/* ============================================================
   PiBoard - server/trafficQuota.js
   Compteur de requetes TomTom quotidien, par tuile. Le widget trafic
   incremente ce compteur cote client (apres chaque lot de tuiles/appels
   reellement effectues) pour donner un chiffre precis, centralise meme
   si plusieurs ecrans affichent la meme tuile, et qui survit aux
   rechargements de page. Remise a zero automatique au changement de jour
   (heure locale du serveur).
   Daily TomTom request counter, per tile. The traffic widget increments
   this counter client-side (after each batch of tiles/calls actually
   made) to give an accurate figure, centralized even if several screens
   show the same tile, and that survives page reloads. Automatically
   resets when the day changes (server's local time).
   ============================================================ */
"use strict";

const store = require("./store");

function todayKey(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storeKey(tileId) {
  // Meme format d'identifiant que les autres modules (media.js, etc.)
  // Same id format as the other modules (media.js, etc.)
  if (!/^t-[a-z0-9]{1,40}$/i.test(tileId || "")) throw new Error("invalid tile id");
  return "trafficquota." + tileId;
}

function getToday(tileId, now) {
  const key = storeKey(tileId);
  const today = todayKey(now);
  const saved = store.read(key, null);
  if (saved && saved.date === today) return { date: today, count: saved.count };
  return { date: today, count: 0 };
}

function increment(tileId, n, now) {
  const key = storeKey(tileId);
  const current = getToday(tileId, now);
  const next = { date: current.date, count: current.count + Math.max(0, Number(n) || 0) };
  store.write(key, next);
  return next;
}

module.exports = { getToday, increment, todayKey };
