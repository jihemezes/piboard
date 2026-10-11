/* ============================================================
   PiBoard - server/usbMedia.js
   Liste les images trouvees sur les cles USB actuellement connectees au
   Pi (mode "Cle USB" du widget diaporama / de l'ecran de veille).
   Aucune configuration requise cote utilisateur : Pi OS Desktop monte
   automatiquement les supports amovibles sous /media/<utilisateur>/<nom>
   (udisks2) des qu'une session de bureau est ouverte -- ce qui est
   toujours le cas ici puisque PiBoard tourne en kiosque avec connexion
   automatique. On se contente de lire ce qui est deja monte, exactement
   comme localFolder.js lit un dossier NAS/rclone deja monte.
   Lists the images found on USB keys currently connected to the Pi (the
   "USB key" mode of the slideshow widget / screen saver). No user
   configuration required: Pi OS Desktop automatically mounts removable
   media under /media/<user>/<name> (udisks2) as soon as a desktop
   session is open -- always true here since PiBoard runs kiosk-style
   with autologin. This module simply reads what's already mounted,
   exactly as localFolder.js reads an already-mounted NAS/rclone folder.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const platform = require("./platform");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/* La detection des supports amovibles est deleguee a la couche
   plateforme : sous-dossiers de /media/<utilisateur>/ sous Pi OS,
   /Volumes/ sous macOS, lettres de lecteur amovibles interrogees via
   WMI sous Windows. Ce module ne connait plus aucune de ces
   specificites : il recoit une liste [{label, path}] et se contente de
   parcourir les dossiers correspondants.
   Removable media detection is delegated to the platform layer:
   subfolders of /media/<user>/ on Pi OS, /Volumes/ on macOS, removable
   drive letters queried through WMI on Windows. This module no longer
   knows any of those specifics: it receives a [{label, path}] list and
   merely walks the matching folders. */

/* Garde-fous pour ne jamais lire une cle USB en desordre pendant une
   duree excessive (nombre de photos, profondeur de sous-dossiers).
   Safety limits so an untidy USB key never takes an excessive time to
   read (photo count, subfolder depth). */
const MAX_FILES = 3000;
const MAX_DEPTH = 6;

/* Detecte les volumes actuellement montes : chaque sous-dossier de
   /media/<utilisateur>/ (ou /run/media/<utilisateur>/) est traite comme
   un support amovible distinct. Le parametre "roots" n'est utilise que
   par les tests unitaires (voir test/usbMedia.test.js) pour pointer vers
   un dossier temporaire plutot que les vrais /media et /run/media du
   systeme ; le code de production ne le fournit jamais, et retombe donc
   toujours sur MOUNT_ROOTS. Detects currently mounted volumes: each
   subfolder of /media/<user>/ (or /run/media/<user>/) is treated as a
   separate removable volume. The "roots" parameter is only used by unit
   tests (see test/usbMedia.test.js) to point at a temp folder instead of
   the system's real /media and /run/media; production code never
   supplies it, so it always falls back to MOUNT_ROOTS. */
/* Le parametre "roots" n'est utilise que par les tests unitaires (voir
   test/usbMedia.test.js), qui simulent l'arborescence
   /media/<utilisateur>/<volume> dans un dossier temporaire plutot que
   de toucher au vrai materiel de la machine qui execute la suite. Le
   code de production ne le fournit jamais et passe donc toujours par la
   detection de la plateforme reelle.
   The "roots" parameter is only used by unit tests (see
   test/usbMedia.test.js), which simulate the /media/<user>/<volume>
   tree inside a temporary folder rather than touching the real hardware
   of the machine running the suite. Production code never supplies it
   and therefore always goes through real platform detection. */
function listVolumes(roots) {
  return roots ? platform.scanMountRootsPosix(roots) : platform.listRemovableVolumes();
}

/* Parcourt un dossier recursivement (profondeur et nombre de fichiers
   limites) et pousse les chemins d'images trouvees, relatifs a la racine
   du volume, dans "out". Walks a folder recursively (depth and file
   count capped) and pushes found image paths, relative to the volume
   root, into "out". */
function walkImages(dir, base, depth, out) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return;
    if (entry.name.startsWith(".")) continue; // dossiers/fichiers caches (ex. .Trash-1000) ignores
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkImages(full, base, depth + 1, out);
    } else if (entry.isFile() && IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.relative(base, full));
    }
  }
}

/* Liste toutes les images de tous les volumes USB actuellement montes.
   Lists every image across all currently mounted USB volumes. */
function listUsbImages(roots) {
  const volumes = listVolumes(roots);
  const items = [];
  for (const vol of volumes) {
    const rel = [];
    walkImages(vol.path, vol.path, 0, rel);
    for (const r of rel) {
      items.push({ volumeLabel: vol.label, volumePath: vol.path, relPath: r });
    }
  }
  return { volumes, items };
}

/* Resout un fichier a l'interieur d'un volume USB actuellement monte, en
   empechant toute sortie du volume (traversee de chemin) et en
   verifiant que ce volume est toujours bien monte au moment de la
   requete (une cle peut avoir ete debranchee entre-temps).
   Resolves a file inside a currently mounted USB volume, preventing any
   escape from the volume (path traversal) and checking the volume is
   still actually mounted at request time (a key may have been unplugged
   in the meantime). */
function resolveUsbFile(volumePath, relPath, roots) {
  if (typeof volumePath !== "string" || !path.isAbsolute(volumePath)) throw new Error("invalid volume path");
  if (typeof relPath !== "string" || !relPath) throw new Error("invalid file path");

  const volumes = listVolumes(roots);
  if (!volumes.some((v) => v.path === volumePath)) throw new Error("volume not mounted");

  /* Le separateur final doit etre retire AVANT la comparaison : a la
     racine d'un lecteur Windows, path.resolve("E:\\") conserve
     l'antislash final, et "base + path.sep" produirait alors "E:\\\\",
     que plus aucun chemin ne peut prefixer -- tout fichier de la racine
     d'une cle USB serait rejete a tort comme une traversee de chemin.
     Sous Linux le cas ne se presente jamais (/media/x/CLE n'a pas de
     separateur final), donc ce retrait est sans effet sur le Pi.
     The trailing separator must be stripped BEFORE comparing: at a
     Windows drive root, path.resolve("E:\\") keeps the trailing
     backslash, and "base + path.sep" would then produce "E:\\\\", which
     no path can be prefixed by -- every file at a USB key's root would
     be wrongly rejected as a path traversal. On Linux the case never
     arises (/media/x/KEY has no trailing separator), so this strip has
     no effect on the Pi. */
  const resolved = path.resolve(volumePath);
  const base = resolved.length > 1 && resolved.endsWith(path.sep)
    ? resolved.slice(0, -1)
    : resolved;
  const full = path.resolve(resolved, relPath);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error("path escape");
  if (!IMAGE_EXT.has(path.extname(full).toLowerCase())) throw new Error("not an image");
  return full;
}

module.exports = { listVolumes, listUsbImages, resolveUsbFile, IMAGE_EXT };
