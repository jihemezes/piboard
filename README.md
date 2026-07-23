# PiBoard

**EN** — A tile-based kiosk dashboard for Raspberry Pi. Clock, weather, notes, RSS feeds, embedded web pages… on a drag-and-drop grid, served by a tiny Node.js server and displayed fullscreen on a wall-mounted screen.

**FR** — Un tableau de bord à tuiles pour Raspberry Pi, façon kiosque. Horloge, météo, bloc-notes, flux RSS, pages web intégrées… sur une grille en glisser-déposer, servi par un petit serveur Node.js et affiché en plein écran sur un écran mural.

---

## English

### Features

- **Tile grid** — 12-column grid, tiles are moved and resized by drag and drop (edit mode), layout is saved on the server so every screen shows the same board.
- **Widget collection** — clock (digital/analog), weather (Open-Meteo, no API key), notes, RSS/Atom feed, and a configurable web page tile (iframe with zoom and periodic reload). Adding a widget to the collection is just adding a folder — see [docs/WIDGETS.md](docs/WIDGETS.md).
- **Hidden toolbar** — a discreet pull tab at the bottom edge reveals the toolbar: add tile, edit mode, settings, built-in help, and an "exit dashboard" menu with two choices — reset the dashboard (a plain reload) or return to the Raspberry Pi OS desktop without relaunching it (handy for a one-off task on the touchscreen, no keyboard or SSH needed). Nothing else ever covers the board.
- **Touch mode** — an opt-in setting that enlarges every interactive target (buttons, handles, pull tabs, form fields) for fingers on a touchscreen. Config windows then automatically arrange into 1–3 columns based on content, to cut down on scrolling.
- **Screen saver** — up to 5 time slots that turn the screen black (a software overlay — no physical power-off, kept off by design for reliability) or into a photo-frame slideshow, with a manual "start now" toolbar button too, independent of the schedule. Useful overnight or when no one's around. A touch/click/key wakes it up instantly; while still inside a scheduled slot, it goes back to sleep on its own after a configurable idle delay if nothing else happens.
- **Built-in help** — a searchable-by-topic window (the "?" button) documenting every setting, every tile, and how to get set up — no need to leave the board.
- **Kiosk-friendly** — automatic day/night theme from local sunrise/sunset computation (pick your city with live suggestions in the settings), customizable background and tile colors for each theme, auto-hidden cursor, live sync between screens (edit from your laptop, the wall screen follows).
- **Bilingual** — full English and French interface.
- **Mouse and touch** — works with a classic screen and mouse, or a touchscreen / iPad (resize handles stay visible on touch devices). Not designed for phone-sized screens.
- **Light** — vanilla JS + Gridstack, no build step, no database, no cloud. Runs comfortably on a Raspberry Pi 3/4/5 (and serves fine from a Pi Zero 2 W).

### Included widgets

Clock (digital/analog, with an automatic day/night background you can recolor, and an optional side-by-side time/date layout), weather (with a real photo background matching conditions, and tomorrow's forecast laid out automatically to fit the tile's shape: side by side, stacked, or hidden), notes (Markdown-lite, checklists, sticky-note colors), RSS/Atom feed (auto-scrolls if there are more articles than fit), web page (iframe), commute time (live driving time between two addresses, plus up to 5 named extra trips), system status (CPU/RAM/disk/temperature of the host), live sports scores (football and rugby Top 14), league standings (football, rugby, NBA), crypto prices with a tap-to-open 24h/7d/30d/1y chart, quote of the day (offline, real auto-fit text, adjustable 50–200%), countdown / timer (screen flash, beep, and notification webhook on completion), slideshow (upload photos from the tile, a local/NAS folder, a USB key plugged into the Pi, WebDAV, or a URL list — landscape/portrait handled separately, with a customizable border for fully-shown photos), and a live traffic map (official TomTom raster tiles, with a smart refresh schedule), and a network scan (pings the local subnet, cross-checked against the Pi's ARP table, and lists active hosts as "Hostname — IP address"). All can be added, configured, resized and removed from the tile catalog — see [docs/WIDGETS.md](docs/WIDGETS.md) to write your own, or the in-app help (the "?" button) for a full guide to each one.

### Install (Raspberry Pi OS Bookworm, Lite or Desktop)

```bash
git clone https://github.com/jihemezes/piboard.git
cd piboard
sudo ./install/install.sh            # server only
sudo ./install/install.sh --kiosk    # server + fullscreen Chromium at boot
```

Then open `http://<pi-ip>:8090`. Options: `--port 8090` to change the port.

**On a Desktop image** (Bookworm/Trixie Desktop), `--kiosk` detects the
already-running desktop compositor and won't install the Lite-only
`cage`-based kiosk service (it would silently fail there). See
**[INSTALL.md](INSTALL.md)** for the full guide, including the
tested-and-working kiosk method for Desktop images (labwc autostart),
service management, updating, and troubleshooting.

The installer sets up Node.js LTS (if missing), installs dependencies, and registers the `piboard` systemd service (plus `piboard-kiosk` with `--kiosk`, using `cage` as a minimal Wayland compositor).

### Using the board

Open the pull tab at the bottom edge, then the padlock to enter **edit mode**: tile contents dim, borders turn dashed. While editing, drag a tile anywhere on its surface to move it, use the raspberry-colored handles (corners and edges) to resize it, and click a tile (or its gear) to open its settings. Press the padlock again to lock the board.

Give a tile a custom title (in its settings, under Appearance) and removing it keeps its configuration saved under that name. Adding another tile of the same kind later offers to reuse it — handy for a widget you use more than once with different settings (e.g. two web page tiles pointing at different URLs).

### Update

```bash
cd piboard && git pull && npm install --omit=dev && sudo systemctl restart piboard
```

### Run anywhere else

PiBoard is plain Node.js ≥ 18.15: `npm install && npm start`, then open port 8090.

Everything that differs between operating systems lives in a single
folder, `server/platform/`, which provides three implementations
(`linux.js`, `win32.js`, `darwin.js`) behind one common interface:
ping arguments and result interpretation, ARP table reading, reverse
name lookup, removable-media detection, CPU temperature, and leaving
kiosk mode.

Two consequences worth knowing when writing a new widget:

- **Never test `process.platform` outside `server/platform/`.** If a new
  system need arises, add a function to the interface and one
  implementation per file.
- **Parsers are pure functions, exported and tested.** `test/platform.test.js`
  checks all three platforms from any machine, using real command output
  captured beforehand — the Windows parsers are validated straight from
  the Raspberry Pi.

Windows-specific limitation: reverse name lookup goes through `ping -a`,
which does not reach mDNS. More devices therefore appear without a name
than on the Pi (where `getent` consults Avahi), showing only their IP and
the manufacturer deduced from their MAC. CPU temperature is unavailable
on Windows and the *System* widget simply hides that row.

### Windows desktop application

PiBoard also installs as a regular Windows application (NSIS installer,
automatic updates through GitHub Releases). Electron is only a shell
around the very same Express server and interface — any widget written
for the Pi works there unmodified.

Build it with `npm install && npm run dist` **on Windows**. Full
instructions, differences from the Pi and publishing steps:
[`docs/WINDOWS.md`](docs/WINDOWS.md).

### Side drawer (for map-first or content-first screens)

If your main screen is mostly taken by one big tile (e.g. a full-screen traffic map in a web-page tile), the **left side drawer** gives you a second, hidden tile surface. Pull the tab on the left edge to slide it open; tap the tab again to close it. Tiles added while the drawer is open land in the drawer (otherwise they land on the board). Drawer tiles keep running even when the drawer is closed — a countdown keeps counting, scores keep refreshing — so nothing is missed while the map has the whole screen. The drawer takes half the screen by default and can be resized by dragging its right edge (25–75%); the width and the drawer's tiles are saved with the layout. Everything works the same inside the drawer: edit mode, tile settings, custom colors, removal.

### Choosing a weather source

Not happy with the forecast accuracy for your area? The weather tile's "Weather model / source" setting lets you pick which national weather service's model Open-Meteo uses, without switching APIs or needing a key — this was the whole forecast engine before, it just always used automatic "best match" selection:

- **Best match** (previous default) — Open-Meteo automatically blends the best available model for the tile's location.
- **Météo-France** (ARPEGE/AROME) — France's own national service; often the most locally accurate choice for French locations.
- **ECMWF** — the European Centre's model, generally strong for multi-day accuracy across Europe.
- **DWD ICON** (Germany), **MET Norway/Yr** (Northern/Western Europe, excellent short-term), **NOAA GFS** (USA/global) — the other major national models Open-Meteo exposes.
- **Custom** — for advanced users: point it at any URL (with `{lat}`/`{lon}` placeholders) that returns JSON in Open-Meteo's exact response shape. Works well with a [self-hosted Open-Meteo instance](https://github.com/open-meteo/open-meteo) or a small proxy you write yourself to reformat another provider's data.

### TV guide (French DTT + Canal+, turnkey)

The TV guide tile shows a simplified French TV listing. Three tabs **on the tile itself** switch between what's on now, tonight's prime time, and late night — no need to open settings. Tap any program to expand its synopsis. A "new" badge appears only when the source actually says so (never guessed), and a thumbnail is shown when the source provides one (otherwise a placeholder).

It works **turnkey** with nothing to install: by default it uses [xmltvfr.fr](https://xmltvfr.fr)'s free, no-signup French DTT guide (the server downloads and decompresses it for you, cached 30 min). You can instead point it at your own XMLTV file/URL (e.g. from TVHeadend or Jellyfin) — a `.gz` file is decompressed automatically. A third "website scraping" source is included as an experimental, per-site option; XMLTV is recommended for a permanent tile since a scraped site's HTML can change at any time.

Channels are listed one per line in the settings (readable names like "France 2" or exact XMLTV ids like "France2.fr" both work); reorder or remove lines to shape the tile. The prime-time and late-night hours are configurable, and thumbnails can be turned off to save network on the Pi. The tile is portrait by default with a minimum size, but can be enlarged. "Tonight" is the default view on load since it stays accurate for hours; the "On now" view instead reschedules itself right when the displayed program is due to end, so it switches at the right time without polling blindly.

### Traffic map (TomTom, quota-aware refresh schedule)

The traffic widget shows live road flow and incidents via TomTom's API, replacing the need for a separate app/container to display traffic on the board. It needs your own TomTom API key (free tier: 2500 requests/day — get one at [developer.tomtom.com](https://developer.tomtom.com)), entered in the tile's settings.

Because a full-screen map can need many tile requests, the tile follows a **smart refresh schedule** designed to stay comfortably under the free quota:

- **Two daily "active windows"** (e.g. your morning and evening commute) refresh fast (every 1–30 minutes, your choice — default 2).
- **Outside those windows**, it refreshes slower (default every 15 minutes).
- **A configurable quiet period** (default 22:00–05:00) uses **no requests at all** — the map keeps showing its last known state, with a small "stale data" badge.
- **A "refresh now" button** on the tile lets you force a fast refresh (5/10/15/30/60 minutes) at any time, independent of the schedule.
- A **live request counter** on the tile shows exactly how many requests were used today, so you can tune the schedule to your own usage rather than guess.

Two technical notes worth knowing:
- Flow tiles use TomTom's standard 256px size. An earlier version of this tile requested 512px tiles hoping to cut the request count roughly 4×, but TomTom's own docs describe that option as a Retina-style higher-resolution variant of the *same* area rather than a tile covering more ground — so it wouldn't have reduced the request count, and risked the map rendering at the wrong scale. The refresh schedule (active/normal/quiet windows) is what actually keeps requests within budget; watch the tile's live counter and tighten the intervals if the real number runs higher than you'd like.
- The tile also shows a small legend (slow/heavy/jam colors and the incident marker) and only highlights roads that actually have a problem — normal-flowing traffic isn't tinted, so the map stays readable at a glance.
- Incidents use TomTom's Incident Details API (a single request for the whole visible area, not tile-based), so they're cheap regardless of refresh rate.

**Recommended layout for a 1920×1200 touchscreen:** the tile's default size (half the board's width, full height) is sized for exactly this — after adding it, drag it to the right half of the board (with the default 12-column / 8-row grid, that's column 6) and it'll fill roughly a 960×1200 area, leaving the left half for other tiles or the side drawer.

The map is fully interactive — pan and pinch/scroll-zoom, with visible +/− buttons — starting from the configured city and zoom level. Its base style switches between day and night automatically with the board's theme. The cartouche in the top-left corner shows the flow/incident legend plus a live countdown to the next refresh and a Pause button (stops auto-refresh until you resume it, independent of the schedule).

The base map itself uses [CARTO](https://carto.com/basemaps)'s label-free tiles (built on OpenStreetMap data, free and keyless for personal/non-commercial use) rather than TomTom's own "basic" style — TomTom bakes road number badges (like "D902") directly into its rendered map tiles with no way to selectively hide them, while CARTO's "nolabels" variants are designed specifically as a clean backdrop for data overlays like this one. TomTom is still used for what it does best: the flow and incident layers on top. A small, required attribution is shown in the corner.

**Flow rendering — TomTom's own raster tiles, matching the reference app.** The tile displays TomTom's official pre-rendered flow tiles (`tile/flow/<style>/...`), the same rendering used by TomTom's own apps — rather than an earlier version that fetched raw per-segment vector data and recolored it by hand, which didn't accurately reflect real traffic. The flow coloring **style** is a tile setting: *Relative* (deviation from normal speed — recommended default), *Absolute* (actual speed), *Delay only* (hides free-flowing roads entirely), or *Reduced sensitivity* (major jams only). Incidents use TomTom's own incident tiles the same way, with a choice of icon detail (from plain lines to detailed chevrons, plus a variant for dark base maps). Both the flow and incident tile URLs include a timestamp parameter on every refresh — needed because the tile's map view never pans or zooms on its own (a stable kiosk tile), so without it the browser's HTTP cache could keep serving a previous cycle's image instead of fetching the actually-current state.

### On-screen keyboard (touchscreens)

For touchscreen setups without a physical keyboard, turn on "Show an on-screen keyboard for text fields" in the global settings (gear icon). Once enabled, a compact virtual keyboard appears automatically whenever a text field is focused — anywhere text can be typed: every tile's settings form, and the notes widget's own inline editor. It follows the interface language (French → AZERTY, English → QWERTY) and always positions itself above or below the active field, whichever side has room, so it never covers what you're typing. A "123" key switches to digits and common punctuation; "Done" dismisses it.

### Slideshow photo sources (no web server required)

The slideshow widget supports five ways to get photos onto the board — pick whichever fits how you already store your photos, via the "Photo source" setting:

- **Upload (default for new tiles)** — the simplest option. A small 🖼️ button appears on the tile (a bigger "Add photos" button when it's empty); tap it to open a manager where you add or remove photos directly, no computer or web server needed. Photos are stored locally in `data/media/<tile id>/` on the Pi.
- **Local folder** — points at a plain folder on the Pi's own filesystem. This is how you use a **NAS/SMB share**: mount it at the OS level first (outside of PiBoard, e.g. a line in `/etc/fstab` or a `systemd.mount` unit — standard Raspberry Pi OS practice), then just point the setting at the mount point, e.g. `/mnt/nas-photos/family`. The folder is re-checked every few minutes for new photos.
- **USB key** — zero setup: plug a USB drive into the Pi and its photos show up automatically (Pi OS Desktop auto-mounts it under `/media/<user>/<name>`). Subfolders on the key are included too. Unplugging the key is noticed on the next periodic re-check. If several keys are plugged in at once, photos from all of them are shown together.
- **WebDAV share** — for Nextcloud, ownCloud, Synology, or any NAS exposing WebDAV. Enter the folder's WebDAV URL and credentials. Note: like the rest of PiBoard, these credentials are stored and shown in plain text in the tile's settings (no authentication layer, trusted-LAN design) — if that's not acceptable for your WebDAV account, use an app-specific/restricted password if your provider supports one, or prefer the local-folder method below.
- **Image URLs** — the original method: one direct image URL per line.

**For cloud photo services (Google Photos, OneDrive, Amazon Photos, pCloud...)**: rather than PiBoard integrating with each provider's API directly (fragile OAuth flows, frequent API changes — Google Photos in particular has significantly restricted third-party library access), the recommended path is **[rclone](https://rclone.org)**, a mature open-source tool that already speaks to dozens of cloud providers. Set it up on the Pi with `rclone config`, then either `rclone sync` your album to a local folder on a schedule (cron/systemd timer), or `rclone mount` it as a live virtual folder — either way, point the slideshow's "Local folder" setting at the result. This keeps PiBoard simple and puts cloud authentication in a tool built and maintained specifically for that job.

### Countdown notifications (screen flash, sound, and remote alerts)

Beyond the on-screen digits, a countdown/timer tile can:

- **Flash the whole board** (not just the tile) when it reaches zero.
- **Play a sound** through the screen's speakers, if it has any — pick from a library of synthesized sounds (no audio files, works offline): two beeps, four sirens/klaxons (police, firefighter, fire alarm, submarine dive), two bells (train crossing, doorbell), and a short jingle.
- **Stay on for up to a minute, or stop it early** — the flash and sound keep going for the configured duration ("Alert duration" setting, default 60 seconds). While active, the tile's "Reset" button turns into "Stop": tap it to silence the alert immediately.
- **Call a notification webhook** — a plain URL that PiBoard requests (GET or POST) when the countdown ends. This one generic mechanism lets you plug in almost any notification channel, without PiBoard needing an account or API key of its own. A few ready-to-use recipes:

  | Channel | Webhook URL to paste | Notes |
  |---|---|---|
  | **Phone push (iOS/Android)**, via [ntfy.sh](https://ntfy.sh) | `https://ntfy.sh/<a-topic-name-you-invent>` (method: POST) | Free, no account. Install the ntfy app and subscribe to the same topic name. Can also be self-hosted. |
  | **Alexa announcement**, via [Voice Monkey](https://voicemonkey.io) | `https://api-v3.voicemonkey.io/announce?token=<your token>&device=<your device id>&speech={message}` (method: GET) | Free tier available. See the step-by-step setup just below — native Alexa↔IFTTT integration was discontinued in 2023, Voice Monkey is the current replacement. |
  | **Free SMS to yourself** (France, Free Mobile subscribers only) | `https://smsapi.free-mobile.fr/sendmsg?user=<your id>&pass=<your key>&msg=<message>` (method: GET) | Activate "Notifications par SMS" in your Free Mobile account settings first to get your id/key. Self-notification only. |
  | **Home Assistant automation** | Your HA webhook trigger URL (method: POST) | If you self-host Home Assistant, this can then do anything HA can do — including speaking through an Alexa/Google/Sonos device via the relevant integration. |
  | **Pushover, Discord, IFTTT Pro, etc.** | Their respective webhook/API URL | Any service that can be triggered by a plain HTTP GET or POST works. |

  The "Notification message" field lets you customize the text sent (for POST methods, it's sent as the request body — matching ntfy's convention). Leave it empty to use the countdown's own label and "time's up" text.

  **Setting up Alexa via Voice Monkey, step by step:**
  1. Go to [voicemonkey.io](https://voicemonkey.io), create a free account, and enable the Voice Monkey skill for your Amazon account (same account as your Echo).
  2. In the Voice Monkey console, create a **Speaker device** and link it to the target Echo through an Alexa Routine (Voice Monkey walks you through this — it's a one-time setup per Echo).
  3. Grab your API token at [app.voicemonkey.io/tokens](https://app.voicemonkey.io/tokens), and your device's ID from the Devices page.
  4. In the countdown tile's settings, paste: `https://api-v3.voicemonkey.io/announce?token=YOUR_TOKEN&device=YOUR_DEVICE_ID&speech={message}` as the webhook URL, method **GET**.
  5. The `{message}` placeholder is automatically replaced by PiBoard with the countdown's label (or your custom notification message) — so your Echo will say something like "Pasta — time's up!" instead of a fixed phrase.


### Finding an ESPN competition code (for a custom league)

The League standings and Live sports scores widgets ship with a handful of ready-made competitions, but ESPN's public data covers far more than that. Both widgets have a "Custom ESPN code" field — fill it in and it overrides the dropdown above it. The code always looks like `sport:league` (two words separated by a colon), and here's how to find it for any competition:

1. On [espn.com](https://espn.com), open the scoreboard page for that competition (e.g. `espn.com/nfl/scoreboard` for the NFL, `espn.com/nhl/scoreboard` for the NHL).
2. Open your browser's developer tools (F12, or right-click → Inspect) and switch to the **Network** tab.
3. Reload the page, and filter the requests for `site.api.espn.com`.
4. Find a request whose URL looks like `.../apis/site/v2/sports/<sport>/<league>/scoreboard` — the two path segments right after `/sports/` are your code. Enter them separated by a colon, e.g. `football/nfl` → `football:nfl`.

A few codes to save you the trip: NFL → `football:nfl`, NHL → `hockey:nhl`, MLB → `baseball:mlb`, NBA → `basketball:nba` (already in the dropdown), EPL → `soccer:eng.1` (already in the dropdown). This is ESPN's unofficial API — codes are stable in practice but undocumented, so double-check with the method above if one stops working.

### Third-party data sources

Several widgets call free, keyless public APIs: Open-Meteo (weather, geocoding), OpenStreetMap Nominatim + OSRM demo server (commute time — please keep refresh intervals reasonable, these are shared public services), CoinGecko (crypto prices), ESPN's public (unofficial) scoreboard/standings endpoints (live sports scores and league tables), and Openverse (Creative Commons / public domain photo backgrounds for the weather tile — one photo is cached per condition for 7 days, so the anonymous rate limit is never an issue; the photographer's name and license are shown as required by Creative Commons attribution). These are third-party services outside PiBoard's control and may change or become unavailable; each widget degrades to a simple "unavailable" message rather than breaking the board.

### Good to know

- The layout API has **no authentication**: PiBoard is designed for a trusted LAN. Do not expose it directly to the internet (use a VPN or an authenticating proxy if needed).
- The web page tile can only embed sites that allow iframes (no `X-Frame-Options: DENY` / restrictive CSP). Self-hosted apps are perfect for it.
- Data lives in `data/` (JSON files) — back up that folder to keep your board.

---

## Français

### Fonctionnalités

- **Grille de tuiles** — grille 12 colonnes, tuiles déplaçables et redimensionnables en glisser-déposer (mode édition), disposition enregistrée côté serveur : tous les écrans affichent le même tableau.
- **Collection de widgets** — horloge (digitale/analogique), météo (Open-Meteo, sans clé API), bloc-notes, flux RSS/Atom, et une tuile « page web » configurable (iframe avec zoom et rechargement périodique). Ajouter un widget à la collection = ajouter un dossier — voir [docs/WIDGETS.md](docs/WIDGETS.md).
- **Barre d'outils escamotable** — une languette discrète en bas d'écran révèle la barre : ajout de tuile, mode édition, paramètres, aide intégrée, et un menu « quitter le tableau de bord » à deux choix — réinitialiser le tableau de bord (un simple rechargement) ou revenir au bureau de Raspberry Pi OS sans le relancer (pratique pour une tâche ponctuelle sur l'écran tactile, sans clavier ni SSH). Rien d'autre n'empiète jamais sur le tableau.
- **Mode tactile** — un réglage optionnel qui agrandit toutes les cibles interactives (boutons, poignées, languettes, champs de formulaire) pour les doigts sur un écran tactile. Les fenêtres de configuration se répartissent alors automatiquement sur 1 à 3 colonnes selon leur contenu, pour limiter le défilement.
- **Économiseur d'écran** — jusqu'à 5 plages horaires qui font passer l'écran au noir (un calque logiciel — jamais d'extinction physique, volontairement évitée pour la fiabilité) ou en diaporama façon cadre photo, avec aussi un bouton « lancer maintenant » dans la barre d'outils, indépendant du calendrier. Utile la nuit ou quand personne n'est présent. Un tap/clic/touche le réveille instantanément ; tant qu'on reste dans une plage programmée, il repart tout seul en veille après un délai d'inactivité réglable si rien ne se passe.
- **Aide intégrée** — une fenêtre organisée par sommaire (bouton « ? ») qui documente chaque réglage, chaque tuile, et comment démarrer — sans jamais quitter le tableau.
- **Pensé pour le kiosque** — thème jour/nuit automatique par calcul local du lever/coucher du soleil (ville choisie avec suggestions dans les paramètres), couleurs du fond et des tuiles personnalisables pour chaque thème, curseur masqué automatiquement, synchronisation en direct entre écrans (éditez depuis votre ordinateur, l'écran mural suit).
- **Bilingue** — interface complète en français et en anglais.
- **Souris et tactile** — fonctionne avec un écran classique et une souris, ou un écran tactile / iPad (les poignées de redimensionnement restent visibles au tactile). Non conçu pour un écran de smartphone.
- **Léger** — JS vanilla + Gridstack, pas de build, pas de base de données, pas de cloud. Tourne confortablement sur Raspberry Pi 3/4/5 (et sert sans peine depuis un Pi Zero 2 W).

### Widgets inclus

Horloge (digitale/analogique, avec un fond jour/nuit automatique aux couleurs personnalisables, et une disposition heure/date côte à côte en option), météo (avec une vraie photo de fond selon les conditions, et la prévision du lendemain disposée automatiquement selon la forme de la tuile : côte à côte, empilée, ou masquée), bloc-notes (Markdown léger, listes à cocher, couleurs post-it), flux RSS/Atom (défile automatiquement s'il y a plus d'articles que de place), page web (iframe), trajet domicile-travail (temps de trajet en direct entre deux adresses, plus jusqu'à 5 trajets supplémentaires nommés), état système (CPU/RAM/disque/température de la machine hôte), scores sportifs en direct (football et rugby Top 14), classement (football, rugby, NBA), cours de cryptos avec courbe 24h/7j/30j/1an au clic, citation du jour (hors-ligne, ajustement automatique du texte, réglable de 50 à 200 %), compte à rebours / minuteur (flash d'écran, bip et webhook de notification à la fin), diaporama (photos téléversées depuis la tuile, dossier local/NAS, clé USB branchée sur le Pi, WebDAV, ou liste d'URLs — formats paysage/portrait traités séparément, avec une bordure personnalisable pour les photos affichées en entier), et une carte de trafic en direct (tuiles raster officielles TomTom, avec un calendrier de rafraîchissement intelligent), et une analyse réseau (ping du sous-réseau local, recoupé avec la table ARP du Pi, et liste des hôtes actifs au format « Nom d'hôte — Adresse IP »). Toutes se rajoutent, se configurent, se redimensionnent et se suppriment depuis le catalogue de tuiles — voir [docs/WIDGETS.md](docs/WIDGETS.md) pour en écrire une nouvelle, ou l'aide intégrée (bouton « ? ») pour un guide complet de chacune.

### Installation (Raspberry Pi OS Bookworm, Lite ou Desktop)

```bash
git clone https://github.com/jihemezes/piboard.git
cd piboard
sudo ./install/install.sh            # serveur seul
sudo ./install/install.sh --kiosk    # serveur + Chromium plein écran au démarrage
```

Puis ouvrez `http://<ip-du-pi>:8090`. Option : `--port 8090` pour changer le port.

**Sur une image Desktop** (Bookworm/Trixie Desktop), `--kiosk` détecte l'environnement de bureau déjà actif et n'installe pas le service kiosque basé sur `cage` (réservé aux images Lite — il échouerait silencieusement sur Desktop). Voir **[INSTALL.md](INSTALL.md)** pour le guide complet, incluant la méthode kiosque testée et fonctionnelle pour les images Desktop (démarrage automatique via labwc), la gestion du service, la mise à jour et le dépannage.

L'installateur met en place Node.js LTS (si absent), installe les dépendances et déclare le service systemd `piboard` (plus `piboard-kiosk` avec `--kiosk`, qui utilise `cage` comme compositeur Wayland minimal).

### Utiliser le tableau

Ouvrez la languette en bas d'écran, puis le cadenas pour passer en **mode édition** : le contenu des tuiles s'estompe, les bordures deviennent pointillées. En édition, saisissez une tuile n'importe où sur sa surface pour la déplacer, utilisez les poignées framboise (coins et bords) pour la redimensionner, et cliquez sur une tuile (ou sa roue dentée) pour ouvrir ses paramètres. Un nouvel appui sur le cadenas verrouille le tableau.

Donnez un titre personnalisé à une tuile (dans ses paramètres, sous Apparence) : la supprimer conserve alors sa configuration sous ce nom. Rajouter une tuile du même type plus tard proposera de la réutiliser — pratique pour un widget utilisé plusieurs fois avec des réglages différents (ex. deux tuiles "Page web" vers des URLs distinctes).

### Mise à jour

```bash
cd piboard && git pull && npm install --omit=dev && sudo systemctl restart piboard
```

### Ailleurs que sur un Pi

PiBoard est du Node.js ≥ 18.15 standard : `npm install && npm start`, puis port 8090.

Tout ce qui diffère d'un système d'exploitation à l'autre vit dans un
dossier unique, `server/platform/`, qui fournit trois implémentations
(`linux.js`, `win32.js`, `darwin.js`) derrière une seule interface
commune : arguments de `ping` et interprétation de son résultat, lecture
de la table ARP, résolution de nom inverse, détection des supports
amovibles, température du processeur et sortie du mode kiosque.

Deux conséquences à connaître avant d'écrire un nouveau widget :

- **Ne jamais tester `process.platform` hors de `server/platform/`.** Si
  un nouveau besoin système apparaît, on ajoute une fonction à
  l'interface et une implémentation dans chaque fichier.
- **Les analyseurs sont des fonctions pures, exportées et testées.**
  `test/platform.test.js` vérifie les trois plateformes depuis n'importe
  quelle machine, à partir de sorties de commandes réelles capturées à
  l'avance — les analyseurs Windows sont donc validés directement depuis
  le Raspberry Pi.

Limite propre à Windows : la résolution de nom inverse passe par
`ping -a`, qui n'atteint pas mDNS. Davantage d'appareils apparaissent
donc sans nom que sur le Pi (où `getent` consulte Avahi), avec seulement
leur IP et le fabricant déduit de leur adresse MAC. La température du
processeur n'est pas disponible sous Windows et le widget *Système*
masque simplement cette ligne.

### Application de bureau Windows

PiBoard s'installe aussi comme une application Windows ordinaire
(installeur NSIS, mises à jour automatiques via GitHub Releases).
Electron n'est qu'une coquille autour du même serveur Express et de la
même interface — tout widget écrit pour le Pi y fonctionne sans
modification.

Construction avec `npm install && npm run dist` **sous Windows**. Marche
à suivre complète, différences avec le Pi et procédure de publication :
[`docs/WINDOWS.md`](docs/WINDOWS.md).

### Tiroir latéral (pour les écrans dédiés à une carte ou un contenu principal)

Si votre écran principal est occupé en grande partie par une seule grande tuile (par ex. une carte de trafic plein écran dans une tuile page web), le **tiroir latéral gauche** offre une seconde surface de tuiles, masquée. Tirez la languette au bord gauche pour l'ouvrir en glissant ; touchez à nouveau la languette pour le refermer. Les tuiles ajoutées pendant que le tiroir est ouvert atterrissent dans le tiroir (sinon sur le tableau). Les tuiles du tiroir continuent de fonctionner même tiroir fermé — un compte à rebours continue de décompter, les scores de se rafraîchir — rien n'est manqué pendant que la carte occupe tout l'écran. Le tiroir prend la moitié de l'écran par défaut et se redimensionne en tirant son bord droit (25–75 %) ; la largeur et les tuiles du tiroir sont enregistrées avec la disposition. Tout fonctionne à l'identique dans le tiroir : mode édition, paramètres de tuile, couleurs personnalisées, suppression.

### Choisir une source météo

Les prévisions ne collent pas bien à votre région ? Le réglage « Modèle météo / source » de la tuile météo permet de choisir quel modèle météo national Open-Meteo utilise, sans changer d'API ni avoir besoin de clé — c'était déjà le seul moteur de prévision utilisé, il faisait juste toujours une sélection automatique « meilleure correspondance » :

- **Meilleure correspondance** (ancien réglage par défaut) — Open-Meteo mélange automatiquement le meilleur modèle disponible pour la localisation de la tuile.
- **Météo-France** (ARPEGE/AROME) — le service national français ; souvent le choix le plus précis localement pour une localisation en France.
- **ECMWF** — le modèle du Centre européen, généralement solide pour la précision à plusieurs jours en Europe.
- **DWD ICON** (Allemagne), **MET Norway/Yr** (Europe du Nord/Ouest, excellent à court terme), **NOAA GFS** (États-Unis/mondial) — les autres grands modèles nationaux exposés par Open-Meteo.
- **Personnalisé** — pour les utilisateurs avancés : pointez vers n'importe quelle URL (avec des espaces réservés `{lat}`/`{lon}`) qui renvoie du JSON au format exact d'Open-Meteo. Fonctionne bien avec une [instance Open-Meteo auto-hébergée](https://github.com/open-meteo/open-meteo) ou un petit proxy que vous écrivez vous-même pour reformater les données d'un autre fournisseur.

### Programme TV (TNT française + Canal+, clé en main)

La tuile Programme TV affiche une grille TV française simplifiée. Trois onglets **sur la tuile elle-même** basculent entre « en ce moment », la 1re partie de soirée et la 2e partie — sans passer par les réglages. Touchez une émission pour déplier son synopsis. Une pastille « inédit » apparaît uniquement quand la source le confirme (jamais deviné), et une vignette est affichée quand la source en fournit une (sinon un placeholder).

Elle fonctionne **clé en main**, rien à installer : par défaut elle utilise le guide TNT français gratuit et sans inscription de [xmltvfr.fr](https://xmltvfr.fr) (le serveur le télécharge et le décompresse pour vous, avec un cache de 30 min). Vous pouvez sinon pointer votre propre fichier/URL XMLTV (ex. depuis TVHeadend ou Jellyfin) — un fichier `.gz` est décompressé automatiquement. Une troisième source « scraping de site » est incluse comme option expérimentale et spécifique à un site ; XMLTV reste recommandé pour une tuile permanente, car le HTML d'un site scrapé peut changer à tout moment.

Les chaînes se listent une par ligne dans les réglages (les noms lisibles comme « France 2 » ou les identifiants XMLTV exacts comme « France2.fr » fonctionnent tous les deux) ; réordonnez ou supprimez des lignes pour façonner la tuile. Les heures de 1re et 2e partie de soirée sont configurables, et les vignettes peuvent être désactivées pour économiser le réseau sur le Pi. La tuile est en portrait par défaut avec une taille minimale, mais peut être agrandie. « Ce soir » est la vue par défaut au chargement, car elle reste juste pendant des heures ; la vue « En ce moment » se reprogramme au contraire automatiquement au moment où le programme affiché doit se terminer, pour changer d'émission au bon moment sans sonder à l'aveugle.

### Carte de trafic (TomTom, calendrier de rafraîchissement respectueux du quota)

Le widget trafic affiche le flux de circulation et les incidents en direct via l'API TomTom, sans besoin d'une application ou d'un conteneur séparé pour afficher le trafic sur le tableau. Il faut votre propre clé API TomTom (offre gratuite : 2500 requêtes/jour — à obtenir sur [developer.tomtom.com](https://developer.tomtom.com)), à saisir dans les paramètres de la tuile.

Comme une carte plein écran peut nécessiter beaucoup de requêtes de tuiles, la tuile suit un **calendrier de rafraîchissement intelligent** pensé pour rester confortablement sous le quota gratuit :

- **Deux « plages actives » quotidiennes** (par ex. vos trajets du matin et du soir) se rafraîchissent rapidement (toutes les 1 à 30 minutes, à votre choix — 2 par défaut).
- **Hors de ces plages**, le rafraîchissement est plus lent (15 minutes par défaut).
- **Une plage silencieuse configurable** (22h-5h par défaut) ne consomme **aucune requête** — la carte garde son dernier état connu, avec un petit badge « donnée figée ».
- **Un bouton « rafraîchir maintenant »** sur la tuile permet de forcer un rafraîchissement rapide (5/10/15/30/60 minutes) à tout moment, indépendamment du calendrier.
- Un **compteur de requêtes en direct** sur la tuile indique précisément combien ont été utilisées aujourd'hui, pour ajuster le calendrier à votre usage réel plutôt que de deviner.

Deux points techniques à connaître :
- Les tuiles de flux utilisent la taille standard TomTom de 256px. Une version précédente de cette tuile demandait des tuiles 512px en espérant diviser le nombre de requêtes par ~4, mais la documentation TomTom décrit cette option comme une variante haute résolution (type Retina) de la *même* zone plutôt qu'une tuile couvrant plus de terrain — elle n'aurait donc pas réduit le nombre de requêtes, et risquait un rendu à la mauvaise échelle. C'est le calendrier de rafraîchissement (plages actives/normales/silencieuses) qui maîtrise réellement le quota ; surveillez le compteur en direct sur la tuile et resserrez les intervalles si le chiffre réel est plus élevé que souhaité.
- La tuile affiche aussi une petite légende (couleurs ralenti/dense/bloqué et le marqueur d'incident) et ne met en évidence que les routes qui posent réellement problème — une circulation normale n'est pas teintée, pour que la carte reste lisible d'un coup d'œil.
- Les incidents utilisent l'API Incident Details de TomTom (une seule requête pour toute la zone visible, pas par tuile), donc peu coûteux quelle que soit la cadence.

**Disposition recommandée pour un écran tactile 1920×1200 :** la taille par défaut de la tuile (moitié de la largeur du tableau, pleine hauteur) est justement calibrée pour ça — une fois ajoutée, glissez-la vers la moitié droite du tableau (avec la grille par défaut 12 colonnes × 8 lignes, c'est la colonne 6) pour qu'elle occupe environ 960×1200 pixels, laissant la moitié gauche pour d'autres tuiles ou le tiroir latéral.

La carte est pleinement interactive — déplacement et zoom (pincer ou molette), avec des boutons +/− visibles — en partant de la ville et du niveau de zoom configurés. Son style de fond bascule automatiquement entre jour et nuit avec le thème du tableau. Le cartouche en haut à gauche affiche la légende flux/incidents, plus un compte à rebours en direct avant la prochaine actualisation et un bouton Pause (arrête le rafraîchissement automatique jusqu'à ce que vous le réactiviez, indépendamment du calendrier).

Le fond de carte lui-même utilise les tuiles sans étiquettes de [CARTO](https://carto.com/basemaps) (basées sur les données OpenStreetMap, gratuites et sans clé pour un usage personnel/non commercial) plutôt que le style « basic » propre à TomTom — TomTom intègre les cartouches de numéros de route (comme « D902 ») directement dans ses tuiles rendues, sans moyen de les masquer sélectivement, alors que les variantes « nolabels » de CARTO sont conçues justement comme fond neutre pour des superpositions de données comme celle-ci. TomTom reste utilisé pour ce qu'il fait de mieux : les couches de flux et d'incidents par-dessus. Une petite attribution requise s'affiche dans un coin.

**Rendu du flux — les tuiles raster officielles de TomTom, comme l'application de référence.** La tuile affiche les tuiles de flux pré-rendues officielles de TomTom (`tile/flow/<style>/...`), le même rendu que les applications TomTom elles-mêmes — plutôt qu'une version précédente qui récupérait les données vectorielles brutes par segment et les recoloriait à la main, sans refléter fidèlement le trafic réel. Le **style** de coloration du flux est un réglage de la tuile : *Relatif* (écart à la vitesse normale — recommandé par défaut), *Absolu* (vitesse réelle), *Retard seul* (masque complètement les axes fluides), ou *Sensibilité réduite* (gros bouchons uniquement). Les incidents utilisent de la même façon les tuiles d'incidents propres à TomTom, avec un choix de niveau de détail des icônes (de simples lignes à des chevrons détaillés, plus une variante pour fond de carte sombre). Les URLs des tuiles de flux et d'incidents incluent un paramètre horodaté à chaque rafraîchissement — nécessaire car la vue de la carte ne se déplace ni ne zoome jamais toute seule (une tuile de kiosque stable), donc sans cela le cache HTTP du navigateur pourrait continuer de servir l'image d'un cycle précédent au lieu d'aller chercher l'état réellement à jour.

### Clavier virtuel (écrans tactiles)

Pour une installation tactile sans clavier physique, activez « Afficher un clavier virtuel sur les champs de texte » dans les réglages globaux (icône d'engrenage). Une fois activé, un clavier virtuel compact apparaît automatiquement dès qu'un champ de texte reçoit le focus — partout où du texte se saisit : le formulaire de paramètres de chaque tuile, et l'éditeur intégré du bloc-notes. Il suit la langue de l'interface (français → AZERTY, anglais → QWERTY) et se positionne toujours au-dessus ou en dessous du champ actif, selon la place disponible, pour ne jamais masquer ce que vous tapez. Une touche « 123 » bascule vers les chiffres et la ponctuation courante ; « Terminé » le referme.

### Sources de photos du diaporama (sans serveur web)

Le widget diaporama propose cinq façons d'amener des photos sur le tableau — choisissez celle qui correspond à la manière dont vous stockez déjà vos photos, via le réglage « Source des photos » :

- **Téléversement (par défaut pour les nouvelles tuiles)** — l'option la plus simple. Un petit bouton 🖼️ apparaît sur la tuile (un bouton « Ajouter des photos » plus visible quand elle est vide) ; touchez-le pour ouvrir un gestionnaire où ajouter ou retirer des photos directement, sans ordinateur ni serveur web. Les photos sont stockées localement dans `data/media/<id de la tuile>/` sur le Pi.
- **Dossier local** — pointe vers un simple dossier du système de fichiers du Pi. C'est la façon d'utiliser un **partage NAS/SMB** : montez-le au niveau du système d'exploitation d'abord (en dehors de PiBoard, par exemple une ligne dans `/etc/fstab` ou une unité `systemd.mount` — pratique courante sous Raspberry Pi OS), puis faites simplement pointer le réglage vers le point de montage, par ex. `/mnt/nas-photos/famille`. Le dossier est revérifié toutes les quelques minutes pour détecter de nouvelles photos.
- **Clé USB** — zéro configuration : branchez une clé USB sur le Pi et ses photos apparaissent automatiquement (Pi OS Desktop la monte tout seul sous `/media/<utilisateur>/<nom>`). Les sous-dossiers de la clé sont inclus aussi. Le débranchement de la clé est détecté à la prochaine revérification périodique. Si plusieurs clés sont branchées en même temps, les photos de toutes s'affichent ensemble.
- **Partage WebDAV** — pour Nextcloud, ownCloud, Synology, ou tout NAS exposant WebDAV. Renseignez l'URL du dossier WebDAV et les identifiants. Remarque : comme le reste de PiBoard, ces identifiants sont stockés et affichés en clair dans les paramètres de la tuile (pas de couche d'authentification, conception pensée pour un réseau local de confiance) — si ce n'est pas acceptable pour votre compte WebDAV, utilisez un mot de passe applicatif/restreint si votre fournisseur le permet, ou préférez la méthode du dossier local ci-dessous.
- **URLs d'images** — la méthode d'origine : une URL directe d'image par ligne.

**Pour les services de photos cloud (Google Photos, OneDrive, Amazon Photos, pCloud...)** : plutôt que PiBoard s'intègre directement à l'API de chaque fournisseur (flux OAuth fragiles, API qui changent souvent — Google Photos en particulier a fortement restreint l'accès tiers à la bibliothèque), la voie recommandée est **[rclone](https://rclone.org)**, un outil open source mature qui sait déjà parler à des dizaines de fournisseurs cloud. Configurez-le sur le Pi avec `rclone config`, puis soit `rclone sync` votre album vers un dossier local selon une planification (cron/minuteur systemd), soit `rclone mount` pour l'avoir comme dossier virtuel en direct — dans les deux cas, faites pointer le réglage « Dossier local » du diaporama vers le résultat. Cela garde PiBoard simple et confie l'authentification cloud à un outil conçu et maintenu spécifiquement pour ça.

### Notifications de fin de compte à rebours (flash d'écran, son, alertes distantes)

Au-delà de l'affichage à l'écran, une tuile compte à rebours / minuteur peut :

- **Faire clignoter tout le tableau** (pas seulement la tuile) à la fin.
- **Jouer un son** via les haut-parleurs de l'écran, s'il en a — à choisir dans une bibliothèque de sons synthétisés (aucun fichier audio, fonctionne hors-ligne) : deux bips, quatre sirènes/klaxons (police, pompiers, alarme incendie, plongée sous-marine), deux cloches (passage à niveau, sonnette d'entrée), et un jingle bref.
- **Durer jusqu'à une minute, ou être arrêtée avant** — le flash et le son continuent pendant la durée configurée (réglage « Durée de l'alerte », 60 secondes par défaut). Tant que l'alerte est active, le bouton « Réinitialiser » de la tuile devient « Arrêter » : touchez-le pour la faire taire immédiatement.
- **Appeler un webhook de notification** — une simple URL que PiBoard interroge (GET ou POST) à la fin du compte à rebours. Ce mécanisme générique unique permet de brancher quasiment n'importe quel canal de notification, sans que PiBoard ait besoin de son propre compte ou clé API. Quelques recettes prêtes à l'emploi :

  | Canal | URL webhook à coller | Remarques |
  |---|---|---|
  | **Push mobile (iOS/Android)**, via [ntfy.sh](https://ntfy.sh) | `https://ntfy.sh/<un-nom-de-sujet-invente>` (méthode : POST) | Gratuit, sans compte. Installez l'app ntfy et abonnez-vous au même nom de sujet. Auto-hébergeable aussi. |
  | **Annonce Alexa**, via [Voice Monkey](https://voicemonkey.io) | `https://api-v3.voicemonkey.io/announce?token=<votre jeton>&device=<id de votre appareil>&speech={message}` (méthode : GET) | Offre gratuite disponible. Voir la configuration pas à pas juste en dessous — l'intégration native Alexa↔IFTTT a été supprimée en 2023, Voice Monkey est le remplaçant actuel. |
  | **SMS gratuit vers vous-même** (France, abonnés Free Mobile uniquement) | `https://smsapi.free-mobile.fr/sendmsg?user=<votre id>&pass=<votre clé>&msg=<message>` (méthode : GET) | Activez d'abord « Notifications par SMS » dans votre espace abonné Free Mobile pour obtenir votre id/clé. Auto-notification uniquement. |
  | **Automatisation Home Assistant** | Votre URL de webhook déclencheur HA (méthode : POST) | Si vous auto-hébergez Home Assistant, cela peut ensuite faire tout ce que HA sait faire — y compris parler via une enceinte Alexa/Google/Sonos par l'intégration correspondante. |
  | **Pushover, Discord, IFTTT Pro, etc.** | Leur URL webhook/API respective | Tout service déclenchable par un simple GET ou POST HTTP fonctionne. |

  Le champ « Message de la notification » permet de personnaliser le texte envoyé (pour la méthode POST, il est envoyé comme corps de la requête — convention utilisée par ntfy). Laissez-le vide pour utiliser l'occasion du compte à rebours et le texte « c'est l'heure ».

  **Configurer Alexa via Voice Monkey, pas à pas :**
  1. Rendez-vous sur [voicemonkey.io](https://voicemonkey.io), créez un compte gratuit, et activez la skill Voice Monkey sur votre compte Amazon (le même que votre enceinte Echo).
  2. Dans la console Voice Monkey, créez un **Speaker device** et liez-le à l'Echo cible via une routine Alexa (Voice Monkey vous guide — configuration à faire une seule fois par Echo).
  3. Récupérez votre jeton API sur [app.voicemonkey.io/tokens](https://app.voicemonkey.io/tokens), et l'identifiant de votre appareil depuis la page Devices.
  4. Dans les paramètres de la tuile compte à rebours, collez : `https://api-v3.voicemonkey.io/announce?token=VOTRE_JETON&device=VOTRE_ID_APPAREIL&speech={message}` comme URL webhook, méthode **GET**.
  5. Le paramètre `{message}` est automatiquement remplacé par PiBoard avec l'occasion du compte à rebours (ou votre message personnalisé) — votre Echo dira donc « Pâtes — c'est l'heure ! » plutôt qu'une phrase figée.


### Trouver le code d'une compétition ESPN (pour une ligue personnalisée)

Les widgets Classement et Scores sportifs en direct proposent d'office quelques compétitions courantes, mais les données publiques d'ESPN couvrent bien plus large. Les deux widgets ont un champ « Code ESPN personnalisé » — remplissez-le et il prend le pas sur la liste déroulante juste au-dessus. Le code a toujours la forme `sport:ligue` (deux mots séparés par deux-points), et voici comment le trouver pour n'importe quelle compétition :

1. Sur [espn.com](https://espn.com), ouvrez la page de classement de cette compétition (par ex. `espn.com/nfl/scoreboard` pour la NFL, `espn.com/nhl/scoreboard` pour la NHL).
2. Ouvrez les outils de développement de votre navigateur (F12, ou clic droit → Inspecter) et passez à l'onglet **Réseau** (Network).
3. Rechargez la page, et filtrez les requêtes sur `site.api.espn.com`.
4. Repérez une requête dont l'URL ressemble à `.../apis/site/v2/sports/<sport>/<ligue>/scoreboard` — les deux segments juste après `/sports/` forment votre code. Saisissez-les séparés par deux-points, par ex. `football/nfl` → `football:nfl`.

Quelques codes pour vous éviter le détour : NFL → `football:nfl`, NHL → `hockey:nhl`, MLB → `baseball:mlb`, NBA → `basketball:nba` (déjà dans la liste), Premier League → `soccer:eng.1` (déjà dans la liste). C'est l'API non officielle d'ESPN — les codes sont stables en pratique mais non documentés, donc revérifiez avec la méthode ci-dessus si l'un d'eux cesse de fonctionner un jour.

### Sources de données tierces

Plusieurs tuiles interrogent des API publiques gratuites et sans clé : Open-Meteo (météo, géocodage), OpenStreetMap Nominatim + le serveur de démonstration OSRM (trajet domicile-travail — merci de garder des intervalles de rafraîchissement raisonnables, ce sont des services publics partagés), CoinGecko (cours de cryptos), les points d'accès (non officiels) d'ESPN pour les scores et classements sportifs, et Openverse (photos de fond Creative Commons / domaine public pour la tuile météo — une photo est mise en cache par condition pendant 7 jours, la limite anonyme n'est donc jamais un problème ; le nom du photographe et la licence sont affichés comme l'exigent les licences Creative Commons). Ce sont des services tiers hors du contrôle de PiBoard, qui peuvent évoluer ou devenir indisponibles ; chaque tuile se replie sur un simple message d'indisponibilité plutôt que de casser le tableau.

### Bon à savoir

- L'API de disposition est **sans authentification** : PiBoard est conçu pour un réseau local de confiance. Ne l'exposez pas directement sur internet (VPN ou proxy authentifiant si besoin).
- La tuile « page web » ne peut afficher que les sites qui autorisent les iframes (pas de `X-Frame-Options: DENY` / CSP restrictive). Les applications auto-hébergées s'y prêtent parfaitement.
- Les données vivent dans `data/` (fichiers JSON) — sauvegardez ce dossier pour conserver votre tableau.

---

## License / Licence

MIT — see [LICENSE](LICENSE).
