/* ============================================================
   PiBoard - server/tileConfigs.js
   Bibliotheque de configurations de tuiles enregistrees. Quand une
   tuile nommee (titre personnalise) est supprimee, ses reglages sont
   conserves ici, sous ce nom, pour le meme type de widget. A l'ajout
   d'une nouvelle tuile de ce type, le client peut alors proposer de
   reutiliser l'une de ces configurations plutot que de repartir de
   zero -- utile pour un widget que l'on instancie plusieurs fois avec
   des reglages differents (ex. deux tuiles "Page web" pointant vers
   des URLs distinctes).
   Library of saved tile configurations. When a named tile (custom
   title) is removed, its settings are kept here, under that name, for
   the same widget type. When adding a new tile of that type, the
   client can then offer to reuse one of these configurations instead
   of starting from scratch -- useful for a widget instantiated several
   times with different settings (e.g. two "Web page" tiles pointing
   at different URLs).
   ============================================================ */
"use strict";

const store = require("./store");

const STORE_KEY = "tileConfigs";
const MAX_TITLE_LENGTH = 60;
/* Garde-fou par type de widget, pour eviter une croissance illimitee
   si l'on renomme/supprime beaucoup de tuiles au fil du temps -- les
   entrees les plus anciennes sont ecartees au-dela.
   Safety net per widget type, to avoid unbounded growth if many tiles
   get renamed/removed over time -- the oldest entries are dropped
   beyond this. */
const MAX_ENTRIES_PER_WIDGET = 20;

/* Meme esprit que les autres identifiants du projet (media.js,
   trafficQuota.js) : les id de widget viennent du nom de repertoire
   dans public/widgets/, jamais de texte libre.
   Same spirit as the project's other identifiers (media.js,
   trafficQuota.js): widget ids come from the directory name under
   public/widgets/, never free text. */
function isValidWidgetId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(id);
}

function normalizeTitle(title) {
  const t = String(title || "").trim();
  return t.slice(0, MAX_TITLE_LENGTH);
}

/* Insere/remplace une entree par titre (une seule configuration par
   nom et par widget), en tete de liste, et ecarte les plus anciennes
   au-dela de MAX_ENTRIES_PER_WIDGET. Fonction pure, testable sans
   toucher au disque (voir test/tileConfigs.test.js).
   Inserts/replaces an entry by title (a single configuration per name
   and widget), at the front of the list, dropping the oldest ones
   beyond MAX_ENTRIES_PER_WIDGET. Pure function, testable without
   touching disk (see test/tileConfigs.test.js). */
function upsertConfig(list, entry) {
  const title = normalizeTitle(entry.title);
  const withoutSameTitle = (list || []).filter((e) => e.title !== title);
  const next = [{ title, settings: entry.settings, savedAt: entry.savedAt }, ...withoutSameTitle];
  return next.slice(0, MAX_ENTRIES_PER_WIDGET);
}

function removeConfig(list, title) {
  const t = normalizeTitle(title);
  return (list || []).filter((e) => e.title !== t);
}

function listConfigs(widgetId) {
  if (!isValidWidgetId(widgetId)) throw new Error("invalid widget id");
  const all = store.read(STORE_KEY, {});
  return all[widgetId] || [];
}

function saveConfig(widgetId, title, settings) {
  if (!isValidWidgetId(widgetId)) throw new Error("invalid widget id");
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) throw new Error("title is required");
  const all = store.read(STORE_KEY, {});
  const current = all[widgetId] || [];
  all[widgetId] = upsertConfig(current, {
    title: normalizedTitle,
    settings: settings || {},
    savedAt: new Date().toISOString()
  });
  store.write(STORE_KEY, all);
  return all[widgetId];
}

function deleteConfig(widgetId, title) {
  if (!isValidWidgetId(widgetId)) throw new Error("invalid widget id");
  const all = store.read(STORE_KEY, {});
  const current = all[widgetId] || [];
  all[widgetId] = removeConfig(current, title);
  store.write(STORE_KEY, all);
  return all[widgetId];
}

module.exports = {
  isValidWidgetId,
  normalizeTitle,
  upsertConfig,
  removeConfig,
  listConfigs,
  saveConfig,
  deleteConfig,
  MAX_ENTRIES_PER_WIDGET,
  MAX_TITLE_LENGTH
};
