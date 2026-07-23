# Changelog

## 1.7.0

- **Application de bureau Windows (Electron)** — PiBoard s'installe
  désormais comme n'importe quelle application Windows, via un
  installeur NSIS. Electron n'est qu'une **coquille** : le serveur
  Express et l'interface sont strictement les mêmes que sur le
  Raspberry Pi. Rien dans `public/` ni dans `server/` ne sait qu'Electron
  existe, à une exception volontaire près — le contrôleur enregistré par
  `electron/main.js` auprès de `server/platform/`, qui permet aux routes
  `/api/system/*` de fermer la fenêtre ou de modifier le lancement
  automatique sans jamais connaître Electron. Voir `docs/WINDOWS.md`.

- **Mise à jour automatique via GitHub Releases** — `electron-updater`
  compare la version publiée à celle installée et propose le
  téléchargement. Le téléchargement est explicite et non automatique :
  consommer la bande passante sans prévenir serait discourtois sur une
  connexion limitée. Une panne réseau ou une release absente n'empêche
  jamais le tableau de bord de fonctionner. Ce mécanisme remplace, sous
  Windows uniquement, le système d'archives ZIP — qui reste le canal de
  mise à jour du Pi.

- **Nouveau réglage « Lancer PiBoard au démarrage de la session »** —
  visible uniquement dans l'application de bureau. Le tableau de bord
  interroge `/api/system/app-integration` pour savoir s'il s'affiche dans
  une fenêtre Electron ou dans un simple navigateur, et masque la section
  partout ailleurs. Ce réglage ne vit pas dans `data/settings.json` : il
  appartient au système d'exploitation et transite par une route dédiée.

- **`server/index.js` expose désormais `start()`** — le processus
  principal Electron doit pouvoir attendre que le serveur écoute
  vraiment avant d'ouvrir sa fenêtre, et connaître le port réellement
  obtenu. Lancé directement (`npm start`, service systemd du Pi), le
  module conserve son comportement historique et écoute immédiatement.
  Si le port par défaut est occupé, l'application de bureau en demande
  un libre au système plutôt que d'échouer.

- **Écoute limitée à `127.0.0.1` dans l'application de bureau** — la
  fenêtre est le seul client du serveur, et rester sur la boucle locale
  évite l'invite du pare-feu Windows au premier lancement. Sur le Pi,
  l'écoute reste sur `0.0.0.0` : le tableau doit rester consultable
  depuis un autre poste du réseau.

- **Installation par utilisateur, données préservées** — PiBoard
  s'installe dans `%LOCALAPPDATA%\Programs\PiBoard` et non dans
  `Program Files`, sans quoi `electron-updater` ne pourrait pas écrire
  sans élévation et les mises à jour échoueraient silencieusement. Les
  données (`%APPDATA%\PiBoard`) survivent à la désinstallation.

---

- **Windows desktop application (Electron)** — PiBoard now installs like
  any other Windows application, through an NSIS installer. Electron is
  only a **shell**: the Express server and the interface are strictly
  the same as on the Raspberry Pi. Nothing in `public/` or `server/`
  knows Electron exists, with one deliberate exception — the controller
  `electron/main.js` registers with `server/platform/`, which lets the
  `/api/system/*` routes close the window or change the auto-launch
  setting without ever knowing about Electron. See `docs/WINDOWS.md`.

- **Automatic updates through GitHub Releases** — `electron-updater`
  compares the published version with the installed one and offers the
  download. Downloading is explicit rather than automatic: consuming
  bandwidth unannounced would be discourteous on a metered connection. A
  network failure or a missing release never prevents the dashboard from
  working. On Windows only, this mechanism replaces the ZIP-archive
  system — which remains the Pi's update channel.

- **New "Launch PiBoard when the session starts" setting** — visible
  only in the desktop application. The dashboard queries
  `/api/system/app-integration` to know whether it is displayed inside an
  Electron window or a plain browser, and hides the section everywhere
  else. This setting does not live in `data/settings.json`: it belongs to
  the operating system and travels through a dedicated route.

- **`server/index.js` now exposes `start()`** — the Electron main process
  must be able to wait until the server is actually listening before
  opening its window, and to know which port it ended up on. Run
  directly (`npm start`, the Pi's systemd service), the module keeps its
  historical behaviour and listens right away. If the default port is
  busy, the desktop application asks the system for a free one rather
  than failing.

- **Binding restricted to `127.0.0.1` in the desktop application** — the
  window is the server's only client, and staying on the loopback avoids
  the Windows firewall prompt on first launch. On the Pi, binding stays
  on `0.0.0.0`: the board must remain viewable from another machine on
  the network.

- **Per-user installation, data preserved** — PiBoard installs into
  `%LOCALAPPDATA%\Programs\PiBoard` rather than `Program Files`, without
  which `electron-updater` could not write unelevated and updates would
  fail silently. Data (`%APPDATA%\PiBoard`) survives uninstallation.

## 1.6.0

- **Socle multi-plateforme : nouvelle couche `server/platform/`** —
  première étape de la version Windows (Electron). Toutes les
  spécificités système, jusqu'ici disséminées dans `server/index.js`,
  `server/networkScan.js` et `server/usbMedia.js`, sont regroupées dans
  un dossier unique offrant trois implémentations (`linux.js`,
  `win32.js`, `darwin.js`) derrière une interface commune. Règle
  désormais appliquée : **plus aucun test `process.platform` hors de ce
  dossier**. Le comportement du Raspberry Pi est strictement inchangé —
  le code Linux a été déplacé sans modification fonctionnelle.

- **`df` remplacé par `fs.statfs()`** — l'usage disque du widget
  *Système* ne lance plus de processus externe. Les formules
  reproduisent celles de `df -P`, donc les chiffres affichés sur le Pi
  restent identiques au dixième près. Conséquence : Node 18.15 minimum
  (au lieu de 18).

- **Correctif : fabricant erroné pour les adresses MAC commençant par
  un octet inférieur à `0x10`** — les adresses MAC sont désormais
  normalisées vers la forme canonique `aa:bb:cc:dd:ee:ff` par tous les
  analyseurs ARP. Sans le zéro initial, `arp -an` (macOS) produisait
  `0:11:22:...`, dont l'OUI extrait était `011223` au lieu de `001122` :
  le widget *Analyse réseau* affichait donc un fabricant faux, ou aucun.

- **Correctif : refus à tort d'un fichier situé à la racine d'un
  volume** — le contrôle anti-traversée de chemin de `usbMedia.js`
  comparait `base + séparateur`, ce qui produisait un double séparateur
  à la racine d'un lecteur Windows (`E:\`) et rejetait toute photo
  posée à la racine d'une clé USB. Sans effet sur le Pi, où le cas ne
  se présente jamais.

- **Analyse réseau : détection de l'interface portant la route par
  défaut** — le sous-réseau analysé était celui de la première
  interface renvoyée par le système. Sur un PC équipé d'adaptateurs
  virtuels (WSL, Hyper-V, VirtualBox, VPN), l'analyse partait balayer un
  sous-réseau virtuel vide. L'interface réellement utilisée pour sortir
  est maintenant repérée par une socket UDP « connectée » (aucun paquet
  n'est émis). Bénéficie aussi au Pi lorsque `docker0` ou un VPN est
  présent.

- **Nouveau fichier de tests `test/platform.test.js`** — vérifie les
  analyseurs des trois plateformes depuis n'importe quelle machine, à
  partir de sorties de commandes réelles capturées à l'avance. Les
  analyseurs Windows sont donc validés depuis le Raspberry Pi, sans
  accès à une machine Windows.

---

- **Cross-platform foundation: new `server/platform/` layer** — first
  step of the Windows (Electron) version. Every system specific,
  previously scattered across `server/index.js`,
  `server/networkScan.js` and `server/usbMedia.js`, is now gathered in a
  single folder offering three implementations (`linux.js`, `win32.js`,
  `darwin.js`) behind a common interface. Rule now enforced: **no
  `process.platform` test outside that folder**. The Raspberry Pi's
  behaviour is strictly unchanged — the Linux code was moved with no
  functional modification.

- **`df` replaced by `fs.statfs()`** — the *System* widget's disk usage
  no longer spawns an external process. The formulas reproduce those of
  `df -P`, so the figures shown on the Pi stay identical to the tenth.
  Consequence: Node 18.15 minimum (instead of 18).

- **Fix: wrong manufacturer for MAC addresses starting with an octet
  below `0x10`** — MAC addresses are now normalized to the canonical
  `aa:bb:cc:dd:ee:ff` form by every ARP parser. Without the leading
  zero, `arp -an` (macOS) produced `0:11:22:...`, whose extracted OUI
  was `011223` instead of `001122`: the *Network scan* widget therefore
  displayed a wrong manufacturer, or none.

- **Fix: file at a volume's root wrongly rejected** — `usbMedia.js`'s
  path-traversal guard compared `base + separator`, which produced a
  double separator at a Windows drive root (`E:\`) and rejected any
  photo placed at a USB key's root. No effect on the Pi, where the case
  never arises.

- **Network scan: detection of the interface carrying the default
  route** — the subnet scanned was the one of the first interface
  returned by the system. On a PC with virtual adapters (WSL, Hyper-V,
  VirtualBox, VPN), the scan swept an empty virtual subnet. The
  interface actually used to reach the outside is now identified through
  a "connected" UDP socket (no packet is ever sent). Also benefits the
  Pi when `docker0` or a VPN is present.

- **New test file `test/platform.test.js`** — checks all three
  platforms' parsers from any machine, using real command output
  captured beforehand. The Windows parsers are therefore validated from
  the Raspberry Pi, with no access to a Windows machine.

## 1.5.4

- **Correctif : colonne %V du widget Classement peu lisible (ex.
  ".692" au lieu de "69,2 %")** — ESPN renvoie le pourcentage de
  victoires au format américain habituel aux sports US : une chaîne
  du type ".692" (0,692 sans le zéro initial, sans signe %), affichée
  telle quelle. Reformatée clairement en "69.2%". Colonne légèrement
  élargie pour accueillir ce format sans retour à la ligne.
  **Fix: Standings widget's "PCT" column hard to read (e.g. ".692"
  instead of "69.2%")** — ESPN returns the win percentage in the
  format usual for US sports: a string like ".692" (0.692 without the
  leading zero, no % sign), shown as-is. Now clearly reformatted as
  "69.2%". Column widened slightly to fit this format without
  wrapping.

## 1.5.3

- **Amélioration : la vue « En ce moment » de la tuile Programme TV
  restait figée jusqu'à 30 min avant de changer d'émission** — elle
  partageait le même rafraîchissement périodique que les vues « Ce
  soir »/« 2e partie », pourtant bien plus stables. Deux changements :
  la vue par défaut au chargement est désormais **« Ce soir »**
  (recommandé, l'ancien comportement — vue « En ce moment » par
  défaut — reste possible via les réglages) ; et surtout, la vue « En
  ce moment » ne sonde plus à intervalle fixe mais **se reprogramme
  automatiquement à la minute où le programme affiché doit se
  terminer** (+ une petite marge), pour changer d'émission au bon
  moment sans solliciter le serveur inutilement. Un nouveau réglage
  « Plafond de rafraîchissement » (5 min par défaut) sert de filet de
  sécurité quand la source ne fournit pas d'heure de fin.
  **Improvement: the TV guide tile's "On now" view stayed stale for up
  to 30 min before switching programs** — it shared the same periodic
  refresh as the far more stable "Tonight"/"Late night" views. Two
  changes: the default view on load is now **"Tonight"** (recommended;
  the previous "On now" default remains available in settings); and
  more importantly, the "On now" view no longer polls at a fixed
  interval — it now **reschedules itself right when the displayed
  program is due to end** (+ a small margin), switching programs at
  the right time without hitting the server unnecessarily. A new
  "Refresh ceiling" setting (5 min by default) acts as a safety net
  when the source doesn't provide an end time.

## 1.5.2

- **Correctif : la tuile Programme TV pouvait afficher un intercalaire
  publicitaire au lieu de l'émission de soirée (ex. TMC)** — la 1.5.1
  filtrait déjà les segments trop courts, mais choisissait ensuite le
  survivant dont l'heure de début était la plus proche de la cible
  (21h). Sur une chaîne qui démarre son programme du soir tôt (TMC vers
  20h20 par exemple), un intercalaire diffusé ensuite plus près de 21h
  pouvait passer le filtre de durée et l'emporter à tort, alors que le
  vrai film, démarré plus tôt, était bien plus long. La sélection
  retient désormais, parmi les programmes assez longs, celui qui dure
  le **plus longtemps** — pas le plus proche de l'heure cible. Fenêtre
  de recherche également élargie avant 21h (45 → 60 min) pour bien
  couvrir ces démarrages précoces.
  **Fix: the TV guide tile could show an ad interstitial instead of the
  evening program (e.g. TMC)** — 1.5.1 already filtered out segments
  that were too short, but then picked whichever survivor's start time
  was closest to the target hour (9pm). On a channel that starts its
  evening program early (TMC around 8:20pm, for instance), an
  interstitial aired afterwards, closer to 9pm, could pass the duration
  filter and wrongly win, even though the real movie, started earlier,
  ran far longer. Selection now picks, among long-enough programs, the
  one that runs **longest** — not the one closest to the target hour.
  The search window before 9pm was also widened (45 → 60 min) to
  properly cover such early starts.

## 1.5.1

- **Correctif : la tuile Programme TV prenait parfois une case courte
  (météo, transition) pour l'émission de soirée** — les vues « 1re
  partie » et « 2e partie » choisissaient jusqu'ici le programme dont
  l'heure de début était la plus proche de la cible (21h, 22h45), sans
  tenir compte de sa durée. Une météo de 5 min diffusée pile à 21h
  passait donc avant le vrai programme du soir, qui démarre parfois
  quelques minutes plus tard mais dure bien plus longtemps. La
  sélection écarte désormais les programmes trop courts dans la
  fenêtre horaire (seuil configurable, 45 min par défaut en 1re
  partie, 20 min en 2e partie — les émissions de 2e partie étant
  souvent plus courtes), et ne retient le plus proche que si aucun
  n'atteint ce seuil, pour ne jamais retourner un écran vide. Deux
  nouveaux réglages dans la tuile permettent d'ajuster ces seuils, ou
  de désactiver le filtre (0 = comportement précédent).
  **Fix: the TV guide tile sometimes picked a short filler segment
  (weather, transition) as the evening program** — the "prime time"
  and "late night" views used to pick the program whose start time
  was closest to the target hour (9pm, 10:45pm), regardless of its
  duration. A 5-minute weather bulletin airing right at 9pm would
  therefore outrank the real evening show, which sometimes starts a
  few minutes later but runs far longer. Selection now discards
  programs that are too short within the time window (configurable
  threshold, 45 min by default for prime time, 20 min for late night —
  late-night programs tend to be shorter), and only falls back to the
  closest one if none reaches that threshold, so it never returns a
  blank screen. Two new tile settings let you tune these thresholds,
  or disable the filter (0 = previous behavior).

## 1.5.0

- **Nouveau widget : Programme TV (TNT française + Canal+)** — une
  grille TV simplifiée avec trois vues basculables directement sur la
  tuile : « en ce moment », 1re partie de soirée et 2e partie de
  soirée. Un clic sur une émission déplie son synopsis. Pastille
  « inédit » affichée uniquement quand la source fournit
  l'information ; vignette affichée quand disponible, placeholder
  sinon. Fonctionne clé en main via xmltvfr.fr (guide TNT gratuit et
  sans inscription, téléchargé et décompressé côté serveur, cache 30
  min), ou avec votre propre fichier/URL XMLTV (`.gz` décompressé
  automatiquement) ; une source « scraping de site » expérimentale est
  également prévue. Chaînes configurables (nom lisible ou identifiant
  XMLTV, une par ligne, réordonnables), heures de bascule soirée
  réglables, vignettes désactivables pour économiser le réseau. Tuile
  portrait avec taille minimale, agrandissable. Nouvelle dépendance :
  `fast-xml-parser`. Nouveaux endpoints serveur : `/api/tele-program`,
  `/api/tele-channels`, et `/api/image-proxy` (proxy d'image binaire
  pour les vignettes, distinct du proxy texte existant). Le calcul des
  heures de soirée est ancré explicitement sur le fuseau Europe/Paris
  (gère été/hiver) pour rester correct quel que soit le fuseau du
  serveur.
  **New widget: TV guide (French DTT + Canal+)** — a simplified TV
  listing with three views switchable right on the tile: on now,
  prime time, and late night. Tapping a program expands its synopsis.
  A "new" badge is shown only when the source provides the info; a
  thumbnail is shown when available, a placeholder otherwise. Works
  turnkey via xmltvfr.fr (free, no-signup DTT guide, downloaded and
  decompressed server-side, 30-min cache), or with your own XMLTV
  file/URL (`.gz` auto-decompressed); an experimental "website
  scraping" source is also scaffolded. Configurable channels (readable
  name or XMLTV id, one per line, reorderable), adjustable evening
  switchover hours, thumbnails can be turned off to save network.
  Portrait tile with a minimum size, enlargeable. New dependency:
  `fast-xml-parser`. New server endpoints: `/api/tele-program`,
  `/api/tele-channels`, and `/api/image-proxy` (binary image proxy for
  thumbnails, distinct from the existing text proxy). Evening-hour
  computation is explicitly anchored to the Europe/Paris timezone
  (DST-aware) to stay correct regardless of the server's timezone.

## 1.4.4

- **Amélioration : mot de passe WebDAV masqué, avec bouton
  Afficher/Masquer** — le mot de passe WebDAV de la tuile Diaporama et
  de l'écran de veille (Paramètres généraux) s'affichait en clair
  dans le champ. Il est désormais masqué par défaut (comme un champ
  de mot de passe classique), avec un bouton à côté pour le révéler
  ponctuellement si besoin (ex. pour vérifier une faute de frappe).
  Un nouveau type de champ générique "password" a été ajouté au
  moteur de formulaire, réutilisable par tout futur widget qui en
  aurait besoin.
  **Improvement: WebDAV password masked, with a Show/Hide button** —
  the WebDAV password field in the Slideshow tile and in the screen
  saver (General settings) showed the password in plain text. It's
  now masked by default (like a normal password field), with a button
  next to it to reveal it on demand (e.g. to check for a typo). A new
  generic "password" field type was added to the form engine, reusable
  by any future widget that needs one.

## 1.4.3

- **Nouveau : réglages de cadrage pour l'écran de veille** — comme
  pour l'ordre aléatoire et l'effet Ken Burns (1.4.2), la tuile
  Diaporama supportait déjà le cadrage par orientation (paysage/
  portrait, recadré ou entier) et le style de bordure quand une photo
  est affichée en entier (couleur unie ou photo floutée), mais l'écran
  de veille n'exposait aucun de ces réglages. Quatre nouveaux champs
  apparaissent dans Paramètres > Écran de veille : format des photos
  paysage/portrait (identiques aux valeurs par défaut de la tuile :
  paysage recadré, portrait entier) et style/couleur de bordure.
  **New: framing settings for the screen saver** — like shuffle order
  and the Ken Burns effect (1.4.2), the Slideshow tile already
  supported per-orientation framing (landscape/portrait, cropped or
  shown in full) and a border style for photos shown in full (solid
  color or blurred photo), but the screen saver exposed none of it.
  Four new fields appear in Settings > Screen saver: landscape/
  portrait photo framing (same defaults as the tile: landscape
  cropped, portrait shown in full) and border style/color.

## 1.4.2

- **Nouveau : ordre aléatoire et effet Ken Burns pour l'écran de
  veille** — la tuile Diaporama supportait deja ces deux options,
  mais l'ecran de veille (Paramètres généraux > Écran de veille), qui
  reutilise le meme moteur, n'exposait ni l'une ni l'autre. L'effet de
  zoom lent (Ken Burns) etait meme deja actif en permanence, sans
  aucun moyen de le desactiver. Deux nouvelles cases apparaissent
  desormais dans cette section : "Ordre aléatoire" (decochee par
  defaut, comportement inchange) et "Effet de zoom lent" (cochee par
  defaut, pour ne rien changer aux installations existantes).
  **New: shuffle order and Ken Burns effect for the screen saver** —
  the Slideshow tile already supported both options, but the screen
  saver (General settings > Screen saver), which reuses the same
  engine, exposed neither. The slow zoom (Ken Burns) effect was even
  already always on, with no way to turn it off. Two new checkboxes
  now appear in that section: "Shuffle order" (unchecked by default,
  unchanged behavior) and "Slow zoom effect" (checked by default, so
  existing installs see no change).

## 1.4.1

- **Amelioration : bouton explicite "Enregistrer cette configuration"**
  — la 1.4.0 ne conservait une configuration que de facon implicite,
  au moment de la suppression d'une tuile nommee, sans aucune option
  visible dans les parametres de la tuile pour le faire. Un nouveau
  bouton apparait desormais dans les parametres de chaque tuile, a
  cote de "Enregistrer" : il applique les reglages courants (comme
  d'habitude) et les conserve immediatement sous le titre personnalise
  de la tuile, avec confirmation visuelle. La sauvegarde automatique a
  la suppression est conservee en complement (filet de securite si
  l'on oublie de cliquer ce bouton avant de supprimer).
  **Improvement: explicit "Save this configuration" button** — 1.4.0
  only kept a configuration implicitly, when a named tile was removed,
  with no visible option in the tile's settings to do so. A new button
  now appears in every tile's settings, next to "Save": it applies the
  current settings (as usual) and immediately keeps them under the
  tile's custom title, with a visual confirmation. The automatic save
  on removal is kept as well, as a safety net for when that button is
  forgotten before deleting.

## 1.4.0

- **Nouveau : bibliotheque de configurations de tuiles reutilisables**
  — donner un titre personnalise a une tuile (Parametres > Apparence)
  puis la supprimer conserve desormais ses reglages sous ce nom, cote
  serveur (`data/tileConfigs.json`). En rajoutant une tuile du meme
  type de widget, une fenetre propose de reutiliser l'une des
  configurations enregistrees ou de repartir d'une configuration
  vierge -- pratique pour un widget instancie plusieurs fois avec des
  reglages differents (ex. deux tuiles "Page web" vers des URLs
  distinctes). Chaque configuration enregistree peut aussi etre
  supprimee individuellement depuis cette fenetre (bouton ×). Les
  tuiles sans titre personnalise ne sont pas concernees (aucun nom
  fiable pour les identifier).
  **New: reusable tile configuration library** — giving a tile a
  custom title (Settings > Appearance) then removing it now keeps its
  settings saved under that name, server-side
  (`data/tileConfigs.json`). When adding another tile of the same
  widget type, a picker offers to reuse one of the saved
  configurations or start from a blank one -- handy for a widget
  instantiated several times with different settings (e.g. two "Web
  page" tiles pointing at different URLs). Each saved configuration
  can also be individually deleted from that picker (× button). Tiles
  without a custom title are unaffected (no reliable name to identify
  them by).

## 1.3.5

- **Correctif : aucune adresse MAC (donc aucun fabricant) recuperee en
  test local sur macOS** — la lecture de la table ARP passait par
  `/proc/net/arp`, un fichier virtuel propre au noyau **Linux**,
  inexistant sur macOS. Sur Mac, chaque lecture echouait donc
  silencieusement et retournait une table vide : aucune adresse MAC
  disponible, donc aucun fabricant jamais deduit (voir 1.3.3), en plus
  du nom d'hote deja absent. La lecture de la table ARP utilise
  desormais `arp -an` sous macOS (avec son format different : octets
  MAC sans zero de tete, entrees non resolues marquees
  "(incomplete)") et continue de lire `/proc/net/arp` sous Linux (la
  cible de production, Pi OS) — sans changement de comportement sur le
  Pi.
  **Fix: no MAC address (and therefore no manufacturer) recovered when
  testing locally on macOS** — reading the ARP table went through
  `/proc/net/arp`, a virtual file specific to the **Linux** kernel,
  which doesn't exist on macOS. On a Mac, every read therefore failed
  silently and returned an empty table: no MAC address available, so
  no manufacturer was ever deduced (see 1.3.3), on top of the hostname
  already being absent. Reading the ARP table now uses `arp -an` on
  macOS (with its different format: MAC octets without a leading
  zero, unresolved entries marked "(incomplete)") and keeps reading
  `/proc/net/arp` on Linux (the production target, Pi OS) — no
  behavior change on the Pi itself.

## 1.3.4

- **Correctif : resolution de nom "Analyse reseau" ne fonctionnait pas
  en local sur macOS** — `getent` (utilise pour interroger nsswitch/
  mDNS) n'existe pas sous macOS, seulement sous Linux. En test local
  sur Mac, l'appel echouait silencieusement et tout retombait sur le
  DNS classique (donc "Hote inconnu" partout, y compris pour des
  machines qui repondent normalement au mDNS). La resolution "systeme"
  utilise desormais `dscacheutil -q host -a ip_address <ip>` sous
  macOS et continue d'utiliser `getent hosts <ip>` sous Linux (la cible
  de production, Pi OS) — sans changement de comportement sur le Pi.
  **Fix: "Network scan" hostname resolution didn't work when testing
  locally on macOS** — `getent` (used to query nsswitch/mDNS) doesn't
  exist on macOS, only on Linux. When testing locally on a Mac, the
  call silently failed and everything fell back to classic DNS (so
  "Unknown host" everywhere, even for machines that normally answer
  mDNS). "System" resolution now uses `dscacheutil -q host -a
  ip_address <ip>` on macOS and keeps using `getent hosts <ip>` on
  Linux (the production target, Pi OS) — no behavior change on the Pi
  itself.

## 1.3.3

- **Amelioration : "Analyse reseau" affiche le fabricant a defaut du
  nom d'hote** — pour les appareils qu'aucune technique de resolution
  ne peut nommer (Android sans service mDNS actif, Windows sans
  Bonjour, la plupart des objets connectes), la tuile affiche desormais
  "Hote inconnu (Fabricant)" en deduisant le fabricant des 3 premiers
  octets de l'adresse MAC (base IEEE embarquee via le paquet npm
  `oui-data`, environ 39 000 prefixes). Ne remplace jamais un vrai nom
  d'hote resolu par mDNS/DNS ; purement indicatif pour aider a
  identifier concretement l'appareil.
  **Improvement: "Network scan" shows the manufacturer when no
  hostname is found** — for devices no resolution technique can name
  (Android without an active mDNS service, Windows without Bonjour,
  most IoT gadgets), the tile now shows "Unknown host (Manufacturer)"
  by deducing the manufacturer from the MAC address's first 3 octets
  (IEEE database bundled via the `oui-data` npm package, ~39,000
  prefixes). Never replaces a real hostname resolved via mDNS/DNS;
  purely a hint to help identify the device in practice.

## 1.3.2

- **Correctif : tuile "Analyse reseau" ne trouvait pas les noms d'hote
  du LAN** — la resolution utilisait `dns.reverse()`, qui interroge
  directement les serveurs DNS configures (la box) en ignorant
  totalement `/etc/nsswitch.conf`, et donc le module `mdns4_minimal`
  (Avahi/Bonjour) que Pi OS Desktop utilise pour resoudre les noms
  `.local`. Une box grand public ne sert pas de PTR pour ses baux DHCP,
  donc seule PiBoard elle-meme apparaissait (son nom vient de
  `os.hostname()`, sans DNS). La resolution passe desormais d'abord par
  `getent hosts <ip>` (respecte nsswitch, donc mDNS inclus), avec
  `dns.reverse()` garde en repli pour les reseaux possedant une vraie
  zone DNS inverse.
  **Fix: "Network scan" tile couldn't find LAN hostnames** — resolution
  used `dns.reverse()`, which queries the configured DNS servers (the
  router) directly, completely ignoring `/etc/nsswitch.conf` and
  therefore the `mdns4_minimal` module (Avahi/Bonjour) that Pi OS
  Desktop uses to resolve `.local` names. A consumer router doesn't
  serve PTR records for its DHCP leases, so only PiBoard itself ever
  showed up (its name comes from `os.hostname()`, no DNS involved).
  Resolution now tries `getent hosts <ip>` first (respects nsswitch, so
  mDNS is included), with `dns.reverse()` kept as a fallback for
  networks that do have a real reverse DNS zone.

- **Correctif : tuile "Page web" pouvait ignorer un premier appui sur
  Enregistrer** — sans clavier physique, la suggestion d'autocompletion
  de Chromium pouvait s'afficher par-dessus le formulaire de reglages
  apres la saisie ; le premier tap sur "Enregistrer" ne faisait alors
  que la fermer, sans activer le bouton. Ajout de `autocomplete="off"`
  et `spellcheck="false"` sur les champs texte et zone de texte des
  formulaires de reglages de tuile.
  **Fix: "Web page" tile could swallow the first tap on Save** —
  without a physical keyboard, Chromium's autocomplete suggestion
  could appear over the settings form after typing; the first tap on
  "Save" then only dismissed it instead of activating the button.
  Added `autocomplete="off"` and `spellcheck="false"` to the text and
  textarea fields in tile settings forms.

## 1.3.1

- **Correctif : « Revenir au bureau » relançait le tableau de bord** —
  le fichier d'autostart labwc réellement déployé enveloppe Chromium
  dans le superviseur `lwrespawn`, qui le relance automatiquement dès
  qu'il se ferme (c'est ce mécanisme qui permet par ailleurs au bouton
  « Réinitialiser le tableau de bord » de fonctionner de façon fiable).
  L'option « Revenir au bureau » ne tuait jusqu'ici que Chromium, que
  `lwrespawn` relançait donc aussitôt. Elle ferme désormais `lwrespawn`
  **avant** Chromium, ce qui laisse effectivement le bureau de Raspberry
  Pi OS visible et utilisable normalement. Testé avec un superviseur et
  un Chromium factices reproduisant fidèlement le comportement réel.
  INSTALL.md et le script de déploiement (`install-piboard-enhanced.sh`)
  mis à jour en conséquence pour documenter/générer ce mécanisme dès
  l'installation initiale.
  **Fix: "Return to the desktop" relaunched the dashboard** — the
  actually deployed labwc autostart file wraps Chromium in the
  `lwrespawn` supervisor, which automatically relaunches it as soon as
  it closes (this is also what makes the "Reset the dashboard" button
  work reliably). The "Return to the desktop" option used to kill only
  Chromium, which `lwrespawn` then immediately relaunched. It now closes
  `lwrespawn` **before** Chromium, which actually leaves the Raspberry Pi
  OS desktop visible and usable normally. Tested with a fake supervisor
  and Chromium faithfully reproducing the real behavior. INSTALL.md and
  the deployment script (`install-piboard-enhanced.sh`) updated
  accordingly to document/generate this mechanism from initial install
  onward.

## 1.3.0

- **Menu « Quitter le tableau de bord » à 2 options** — le bouton du
  tiroir (auparavant « Redémarrer l'affichage ») ouvre désormais un
  petit menu :
  - **Réinitialiser le tableau de bord** : recharge PiBoard de zéro dans
    le navigateur (un simple rechargement de page — plus fiable et
    immédiat que l'ancien comportement, qui fermait Chromium sans
    garantie de relance).
  - **Revenir au bureau** *(nouveau)* : ferme Chromium et révèle le
    bureau de Raspberry Pi OS en dessous, sans relancer le tableau de
    bord — l'équivalent du `pkill chromium` par SSH déjà documenté dans
    INSTALL.md, désormais accessible directement depuis l'écran tactile,
    sans clavier ni accès distant.
  Aucune modification requise du script d'autostart existant.
  **"Exit dashboard" 2-option menu** — the drawer button (previously
  "Restart display") now opens a small menu:
  - **Reset the dashboard**: reloads PiBoard from scratch in the
    browser (a plain page reload — more reliable and immediate than the
    previous behavior, which closed Chromium with no guarantee it would
    relaunch).
  - **Return to the desktop** *(new)*: closes Chromium and reveals the
    Raspberry Pi OS desktop underneath, without relaunching the
    dashboard — the equivalent of the SSH `pkill chromium` command
    already documented in INSTALL.md, now directly available from the
    touchscreen, with no keyboard or remote access needed.
  No change required to the existing autostart script.

## 1.2.0

- **Nouveau widget « Analyse réseau »** — balaie le sous-réseau local
  (ping + lecture de la table ARP du Pi, pour aussi repérer les hôtes
  dont le pare-feu bloque le ping) et liste les hôtes actifs au format
  « Nom d'hôte — Adresse IP » (résolution DNS inverse ; l'adresse IP
  seule est affichée si aucun nom n'est trouvé). Sous-réseau détecté
  automatiquement par défaut (forçable via un réglage CIDR). Bouton
  « Analyser maintenant » sur la tuile, et réanalyse automatique
  optionnelle (désactivée par défaut). Aucune donnée ne quitte le réseau
  local.
  **New "Network scan" widget** — sweeps the local subnet (ping + a read
  of the Pi's ARP table, to also catch hosts whose firewall blocks ping)
  and lists active hosts as "Hostname — IP address" (reverse DNS; the IP
  alone is shown if no name is found). Subnet auto-detected by default
  (can be forced via a CIDR setting). "Scan now" button on the tile, and
  optional automatic rescanning (off by default). No data ever leaves
  the local network.

## 1.1.0

- **Écran de veille : retour automatique après inactivité** — après un
  réveil manuel (tap/clic/touche) alors qu'on est toujours dans une
  plage horaire programmée, l'écran repart tout seul en veille au bout
  d'un délai réglable (1 à 30 min, ou « Jamais » pour retrouver le
  comportement d'origine : ne se rouvrir qu'à la prochaine plage).
  Nouveau réglage dans la section « Économiseur d'écran ».
  **Screen saver: automatic return after inactivity** — after a manual
  wake (touch/click/key) while still inside a scheduled time slot, the
  screen goes back to sleep on its own after a configurable delay (1 to
  30 min, or "Never" for the original behavior: only reopen at the next
  slot). New setting in the "Screen saver" section.
- **Diaporama : source « Clé USB »** — nouvelle source de photos pour le
  widget Diaporama et pour l'écran de veille, sans aucune configuration :
  branchez une clé USB sur le Pi (montée automatiquement par Pi OS
  Desktop sous `/media/<utilisateur>/<nom>`), ses photos (y compris dans
  ses sous-dossiers) apparaissent directement. Plusieurs clés branchées
  en même temps sont toutes prises en compte.
  **Slideshow: "USB key" source** — new photo source for the Slideshow
  widget and the screen saver, with zero configuration: plug a USB key
  into the Pi (auto-mounted by Pi OS Desktop under
  `/media/<user>/<name>`), and its photos (including in subfolders) show
  up directly. Several keys plugged in at once are all picked up.

## 1.0.0

Première version stable. Point d'étape après une longue série
d'ajustements sur la tuile Trafic, l'ergonomie tactile, et l'ajout de
plusieurs fonctionnalités majeures (économiseur d'écran, aide intégrée).

First stable release. A checkpoint after a long series of adjustments to
the Traffic tile, touch ergonomics, and the addition of several major
features (screen saver, built-in help).

### Ajouté / Added

- **Économiseur d'écran** — jusqu'à 5 plages horaires, en mode noir
  (calque logiciel, jamais d'extinction physique — trop peu fiable sous
  labwc) ou diaporama (réutilise la tuile Diaporama, avec sa propre
  source de photos indépendante). Réveil au clic/tap/touche. Un bouton du
  tiroir permet aussi de le lancer manuellement à tout moment,
  indépendamment du calendrier.
  **Screen saver** — up to 5 time slots, in black mode (software overlay,
  never a physical power-off — too unreliable under labwc) or slideshow
  mode (reuses the Slideshow tile, with its own independent photo
  source). Wakes on click/tap/key. A toolbar button also lets you launch
  it manually at any time, independent of the schedule.
- **Aide intégrée** — fenêtre en deux colonnes (sommaire + contenu),
  couvrant la présentation générale, le tiroir de configuration, chaque
  tuile en détail (objectif, possibilités, options), et les
  remerciements. Bilingue.
  **Built-in help** — two-column window (table of contents + content),
  covering the general overview, the config drawer, every tile in detail
  (goal, possibilities, options), and credits. Bilingual.
- **Bouton "Redémarrer l'affichage"** dans le tiroir — recharge le
  tableau de bord ; sur le Pi lui-même, relance le kiosque. Une requête
  serveur dédiée (`/api/system/exit-kiosk`) n'agit que si elle vient de
  la machine locale (vérifié via l'adresse IP réelle de la connexion
  TCP), jamais depuis un autre navigateur du réseau.
  **"Restart display" button** in the drawer — reloads the dashboard; on
  the Pi itself, relaunches the kiosk. A dedicated server endpoint
  (`/api/system/exit-kiosk`) only acts if the request comes from the
  local machine (checked via the TCP connection's real IP), never from
  another browser on the network.
- **Mode tactile** (réglage global) — agrandit boutons, poignées,
  languettes, champs et cases à cocher partout dans l'interface. Les
  fenêtres de configuration se répartissent alors automatiquement sur 1 à
  3 colonnes, l'algorithme choisissant la répartition qui minimise la
  hauteur totale (donc le défilement).
  **Touch mode** (global setting) — enlarges buttons, handles, pull tabs,
  fields and checkboxes throughout the interface. Config windows then
  automatically lay out across 1 to 3 columns, the algorithm picking
  whichever arrangement minimizes total height (thus scrolling).
- **Clavier virtuel** agrandi (~x2) avec repli automatique à la largeur
  de l'écran.
  **On-screen keyboard** enlarged (~2x) with automatic fallback to
  screen width.
- **Trajet domicile-travail** — jusqu'à 5 trajets supplémentaires nommés,
  au-delà du trajet principal A↔B, avec une disposition côte à côte ou
  empilée.
  **Commute time** — up to 5 named extra trips, beyond the main A↔B trip,
  with a side-by-side or stacked layout.
- **Diaporama** — ajustement (remplir/photo entière) réglable séparément
  pour les formats paysage et portrait, avec un fond personnalisable
  (couleur unie ou photo floutée) pour les photos affichées en entier.
  **Slideshow** — fit (fill/show entire photo) adjustable separately for
  landscape and portrait orientations, with a customizable background
  (solid color or blurred photo) for fully-shown photos.
- **Flux RSS** — défilement (au doigt ou à la souris) quand le nombre
  d'articles dépasse la place disponible, plutôt que de couper les
  derniers titres.
  **RSS feed** — scrolling (finger or mouse) when the article count
  exceeds available space, instead of cutting off the latest headlines.
- **Horloge** et **trajet domicile-travail** — disposition "côte à côte"
  optionnelle pour l'heure/date ou les différents trajets.
  **Clock** and **commute time** — optional "side by side" layout for
  the time/date or the different trips.

### Corrigé / Fixed

- **Carte de trafic** — passage des tuiles de flux vectorielles
  (recoloriées à la main, imprécises) aux tuiles raster TomTom
  officielles, identiques à l'application Umbrel de référence. Bouton
  "Rafraîchir maintenant" remplacé par un menu maison entièrement
  tactile (le `<select>` natif se comportait mal sur le navigateur
  kiosque). Cache-busting sur les tuiles de flux et les incidents pour
  éviter l'affichage de données périmées un jour où le trafic a changé
  depuis le dernier cycle.
  **Traffic map** — switched from vector flow tiles (hand-recolored,
  inaccurate) to official TomTom raster tiles, matching the reference
  Umbrel app. "Refresh now" button replaced by a fully touch-friendly
  custom menu (the native `<select>` behaved poorly on the kiosk
  browser). Cache-busting on flow and incident tiles to avoid showing
  stale data on a day traffic had actually changed since the last cycle.
- **Flux RSS** — même correctif anti-cache que le trafic : le flux ne se
  rafraîchissait plus après le premier chargement.
  **RSS feed** — same anti-cache fix as traffic: the feed stopped
  refreshing after the first load.
- **Classement** — en-têtes de colonnes (G, N, P, %V) qui ne
  correspondaient pas à la bonne colonne.
  **League standings** — column headers (W, D, L, %W) that didn't line
  up with the right column.
- **Citation du jour** — l'auteur pouvait être coupé selon la taille de
  la tuile ; il reste désormais toujours entièrement visible.
  **Quote of the day** — the author could get clipped depending on tile
  size; it now always stays fully visible.
- **Mode édition et clics internes aux widgets** — un clic sur un bouton
  à l'intérieur d'un widget (upload de photos, courbe de cours,
  démarrer/pause d'un minuteur, cocher une case de note) pouvait, en mode
  édition, rouvrir par erreur les réglages de la tuile au lieu d'agir sur
  le widget — corrigé sur les 4 widgets concernés (diaporama, cryptos,
  compte à rebours, bloc-notes).
  **Edit mode and clicks inside widgets** — clicking a button inside a
  widget (photo upload, price chart, timer start/pause, note checkbox)
  could, in edit mode, mistakenly reopen the tile's settings instead of
  acting on the widget — fixed on the 4 affected widgets (slideshow,
  crypto, countdown, notes).
- **Mode tactile non appliqué après redémarrage** — la case restait
  cochée mais son effet n'était appliqué qu'à l'enregistrement des
  réglages, jamais au chargement de la page.
  **Touch mode not applied after a restart** — the checkbox stayed
  checked but its effect only applied when saving settings, never on
  page load.

### Retiré / Removed

- Dépendance `leaflet.vectorgrid`, plus utilisée depuis le passage aux
  tuiles raster du widget Trafic (retirée de `package.json`, du script
  chargé sur chaque page, et du service de fichiers statiques).
  `leaflet.vectorgrid` dependency, no longer used since the Traffic
  widget switched to raster tiles (removed from `package.json`, the
  script loaded on every page, and static file serving).
