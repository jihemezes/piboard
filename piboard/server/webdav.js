/* ============================================================
   PiBoard - server/webdav.js
   Client WebDAV minimal : liste le contenu d'un dossier distant
   (PROPFIND) et relaie le telechargement d'un fichier (GET), pour le
   mode "WebDAV" du widget diaporama. Les identifiants restent cote
   serveur : jamais transmis tels quels au navigateur.
   Minimal WebDAV client: lists a remote folder's contents (PROPFIND) and
   relays a file download (GET), for the slideshow widget's "WebDAV" mode.
   Credentials stay server-side: never sent as-is to the browser.
   ============================================================ */
"use strict";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

function authHeader(user, pass) {
  if (!user && !pass) return null;
  return "Basic " + Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

/* Extraction tolerante aux prefixes d'espace de noms (d:, D:, ou aucun),
   qui varient selon les serveurs WebDAV (Nextcloud, Synology, Apache...).
   Extraction tolerant of namespace prefixes (d:, D:, or none), which vary
   across WebDAV servers (Nextcloud, Synology, Apache...). */
function parsePropfindXml(xml) {
  const blocks = xml.split(/<[a-zA-Z0-9]*:?response[ >]/i).slice(1);
  const items = [];
  for (const block of blocks) {
    const hrefMatch = block.match(/<[a-zA-Z0-9]*:?href[^>]*>([^<]+)</i);
    if (!hrefMatch) continue;
    const isCollection = /<[a-zA-Z0-9]*:?collection\s*\/?>/i.test(block);
    const href = decodeXmlEntities(hrefMatch[1].trim());
    const segments = href.replace(/\/$/, "").split("/");
    const name = decodeURIComponent(segments[segments.length - 1] || "");
    if (isCollection || !IMAGE_EXT.test(name)) continue;
    items.push({ name, href });
  }
  return items;
}

/* Liste les images d'un dossier WebDAV. baseUrl doit pointer vers le
   dossier (avec ou sans / final). Lists the images in a WebDAV folder.
   baseUrl should point at the folder (trailing slash optional). */
async function listWebdavImages(baseUrl, user, pass, fetchImpl) {
  const url = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const headers = { "Depth": "1", "Content-Type": "application/xml; charset=utf-8" };
  const auth = authHeader(user, pass);
  if (auth) headers.Authorization = auth;
  const res = await fetchImpl(url, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:resourcetype/></D:prop></D:propfind>`
  });
  if (!res.ok && res.status !== 207) throw new Error("webdav status " + res.status);
  const xml = await res.text();
  const items = parsePropfindXml(xml);
  // Resout chaque href (souvent relatif) en URL absolue utilisable pour le GET
  // Resolves each href (often relative) into an absolute URL usable for GET
  return items.map((it) => ({ name: it.name, url: new URL(it.href, url).href }));
}

async function fetchWebdavFile(fileUrl, user, pass, fetchImpl) {
  const headers = {};
  const auth = authHeader(user, pass);
  if (auth) headers.Authorization = auth;
  const res = await fetchImpl(fileUrl, { headers });
  if (!res.ok) throw new Error("webdav file status " + res.status);
  return res;
}

module.exports = { listWebdavImages, fetchWebdavFile, parsePropfindXml, IMAGE_EXT };
