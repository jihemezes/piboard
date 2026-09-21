/* ============================================================
   PiBoard - server/zip.js
   Lecture et ecriture d'archives ZIP, sans dependance.

   POURQUOI. Le clone complet d'une installation emporte des images en
   plus des fichiers de configuration : un JSON ne suffit plus, il faut
   une archive. Node sait deja compresser (zlib) ; il ne manque que
   l'enveloppe ZIP, soit quelques dizaines de lignes d'en-tetes. Ajouter
   un paquet pour cela serait disproportionne, et PiBoard tient a ne
   dependre de rien qui ne soit indispensable.

   PORTEE VOLONTAIREMENT ETROITE. Une archive plate : des entrees
   nommees, compressees en « deflate » ou stockees telles quelles,
   sans chiffrement, sans archives multi-volumes, sans ZIP64. Cela
   suffit tres largement pour un clone de PiBoard -- et au-dela, la
   lecture refuse explicitement plutot que de rendre des octets faux.

   COMPATIBILITE. Les archives produites s'ouvrent avec l'explorateur
   de Windows, Finder, `unzip` et tout outil courant ; c'est verifie par
   les tests, qui confrontent la sortie a l'outil `unzip` du systeme
   quand il est present.

   Reading and writing ZIP archives with no dependency. Node already
   has zlib; only the ZIP envelope is missing. Deliberately narrow: a
   flat archive, deflate or stored, no encryption, no ZIP64. Beyond
   that the reader refuses explicitly rather than returning wrong
   bytes.
   ============================================================ */

"use strict";

const zlib = require("zlib");

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

/* ---------- CRC32 ----------
   Le ZIP exige une empreinte CRC32 par entree ; c'est elle qui fait
   qu'une archive tronquee est detectee a l'extraction.
   ZIP requires a CRC32 per entry; it is what makes a truncated archive
   detectable on extraction. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* Date et heure au format MS-DOS, seule notion de temps que connaisse
   le ZIP : deux secondes de resolution, et rien avant 1980.
   MS-DOS date and time, the only notion of time ZIP knows. */
function dosTime(date) {
  const d = date instanceof Date && !isNaN(date) ? date : new Date();
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

function fromDosTime(time, date) {
  return new Date(
    ((date >> 9) & 0x7f) + 1980, ((date >> 5) & 0x0f) - 1, date & 0x1f,
    (time >> 11) & 0x1f, (time >> 5) & 0x3f, (time & 0x1f) * 2
  );
}

/* ---------- Ecriture ----------
   entries : [{ name, data, store? }]. « store » laisse l'entree non
   compressee, ce qui evite de recompresser un JPEG ou un PNG pour ne
   rien gagner.
   entries: [{ name, data, store? }]; "store" skips compression, which
   avoids re-compressing a JPEG or PNG for no gain. */
function write(entries, options) {
  const o = options || {};
  const when = dosTime(o.date);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries || []) {
    const name = Buffer.from(String(entry.name), "utf8");
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const stored = !!entry.store;
    const body = stored ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIG, 0);
    local.writeUInt16LE(20, 4);                 // version minimale
    local.writeUInt16LE(0x0800, 6);             // noms en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(when.time, 10);
    local.writeUInt16LE(when.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIG, 0);
    central.writeUInt16LE(20, 4);               // version d'ecriture
    central.writeUInt16LE(20, 6);               // version minimale
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(when.time, 12);
    central.writeUInt16LE(when.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38);               // attributs externes
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE((entries || []).length, 8);
  eocd.writeUInt16LE((entries || []).length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]);
}

/* ---------- Lecture ----------
   On passe par le REPERTOIRE CENTRAL, place a la fin : c'est la seule
   table qui fasse autorite dans un ZIP, les en-tetes locaux pouvant
   mentir sur les tailles quand l'archive a ete produite en flux.
   Reading goes through the CENTRAL DIRECTORY at the end: the only
   authoritative table in a ZIP. */
function read(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 22) throw new Error("archive trop courte / archive too short");

  let eocd = -1;
  const from = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ce fichier n'est pas une archive ZIP / not a ZIP archive");

  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CENTRAL_SIG) {
      throw new Error("archive abimée / damaged archive");
    }
    const method = buf.readUInt16LE(at + 10);
    const time = buf.readUInt16LE(at + 12);
    const date = buf.readUInt16LE(at + 14);
    const crc = buf.readUInt32LE(at + 16);
    const compSize = buf.readUInt32LE(at + 20);
    const rawSize = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.slice(at + 46, at + 46 + nameLen).toString("utf8");
    at += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localAt) !== LOCAL_SIG) throw new Error("entrée introuvable / entry not found: " + name);
    const localNameLen = buf.readUInt16LE(localAt + 26);
    const localExtraLen = buf.readUInt16LE(localAt + 28);
    const start = localAt + 30 + localNameLen + localExtraLen;
    const body = buf.slice(start, start + compSize);

    let data;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) data = zlib.inflateRawSync(body);
    else throw new Error("compression non gérée / unsupported compression (" + method + ") : " + name);

    /* L'empreinte est verifiee : une archive tronquee ou corrompue est
       refusee ici, pas decouverte plus tard sous forme de reglages
       incoherents.
       The checksum is verified here rather than discovered later as
       incoherent settings. */
    if (crc32(data) !== crc) throw new Error("entrée corrompue / corrupted entry: " + name);
    if (data.length !== rawSize) throw new Error("taille inattendue / unexpected size: " + name);
    entries.push({ name, data, date: fromDosTime(time, date) });
  }
  return entries;
}

module.exports = { write, read, crc32 };
