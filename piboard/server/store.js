/* ============================================================
   PiBoard - server/store.js
   Persistance JSON simple et atomique dans data/
   Simple, atomic JSON persistence in data/
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.PIBOARD_DATA || path.join(__dirname, "..", "data");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(name) {
  // Nom de fichier strictement contrôlé / strictly validated file name
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name)) {
    throw new Error("Invalid store key: " + name);
  }
  return path.join(DATA_DIR, name + ".json");
}

function read(name, fallback) {
  try {
    const raw = fs.readFileSync(fileFor(name), "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(name, value) {
  ensureDataDir();
  const file = fileFor(name);
  const tmp = file + ".tmp";
  // Ecriture atomique : tmp puis rename / atomic write: tmp then rename
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

module.exports = { read, write, DATA_DIR };
