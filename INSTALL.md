# Installation de PiBoard / Installing PiBoard

Ce guide couvre l'installation du serveur, la mise en place du mode kiosque
(sur image Lite **et** sur image Desktop — deux méthodes différentes), la
gestion du service, la mise à jour et le dépannage.

This guide covers installing the server, setting up kiosk mode (on a Lite
image **and** a Desktop image — two different methods), managing the
service, updating, and troubleshooting.

---

## Français

### Prérequis

- Un Raspberry Pi 3, 4 ou 5 (ou toute machine Linux ≥ Node.js 18).
- Raspberry Pi OS Bookworm ou Trixie, **Lite ou Desktop** — les deux
  fonctionnent, mais le mode kiosque se met en place différemment selon le
  cas (voir plus bas).
- Un accès réseau local (PiBoard n'a pas besoin d'internet pour
  fonctionner, à l'exception des widgets qui interrogent des services
  externes — météo, trafic, cours de cryptos, etc.).
- Pour un écran tactile : activez le **Mode tactile** dans les réglages
  généraux de PiBoard une fois installé (bouton engrenage du tiroir du
  bas) — voir l'aide intégrée (bouton « ? ») pour le détail de ce que ça
  agrandit.

### Installation rapide

```bash
git clone https://github.com/jihemezes/piboard.git
cd piboard
sudo ./install/install.sh              # serveur seul
sudo ./install/install.sh --kiosk      # serveur + tentative de kiosque automatique
```

Puis ouvrez `http://<ip-du-pi>:8090` depuis n'importe quel navigateur du
réseau local.

Option `--port 8090` pour changer le port. Le script installe Node.js LTS
si besoin, les dépendances npm, et déclare le service systemd `piboard`.

**Important sur `--kiosk`** : ce script installe automatiquement un
kiosque uniquement via `cage` (un compositeur Wayland minimal), qui ne
fonctionne que sur une image **Lite** (sans bureau). Sur une image
**Desktop**, le script détecte l'environnement de bureau déjà présent
(labwc, lightdm, gdm...) et **n'installe rien automatiquement** dans ce
cas — il vous redirige vers la section ci-dessous, qui décrit la méthode
qui fonctionne réellement.

### Installation manuelle (sans le script)

```bash
# 1. Node.js 18+ (déjà présent sur une image récente, sinon) :
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# 2. Dépendances et lancement :
cd piboard
npm install --omit=dev
node server/index.js          # écoute sur le port 8090 par défaut
```

Pour un démarrage automatique et une reprise après plantage, préférez le
service systemd (voir `install/piboard.service`, à copier dans
`/etc/systemd/system/` en remplaçant `@APP_DIR@`, `@USER@` et `@PORT@` par
vos valeurs, comme le fait `install.sh`).

### Mode kiosque sur image **Lite** (sans bureau)

C'est le cas géré automatiquement par `install.sh --kiosk` : Chromium
plein écran, lancé via `cage` (un compositeur Wayland minimal qui ne fait
rien d'autre que tenir l'écran pour une seule application), démarré comme
service systemd (`piboard-kiosk.service`) dès l'écran de connexion.
Fonctionne parce que rien d'autre ne dispute l'accès à l'écran sur une
image Lite.

### Mode kiosque sur image **Desktop** (Bookworm/Trixie Desktop)

**C'est la méthode réellement testée et fonctionnelle** pour ce cas — le
script `install.sh --kiosk` ne peut pas l'automatiser (elle modifie la
configuration du bureau de l'utilisateur connecté, plus sûr à faire à la
main), donc voici la procédure complète.

**Pourquoi `cage` ne convient pas ici :** sur une image Desktop avec
connexion automatique, un compositeur graphique (`labwc` sur les versions
récentes de Raspberry Pi OS Desktop) tient déjà le siège d'affichage dès
le démarrage. Un service kiosque basé sur `cage` reste alors bloqué en
attente indéfiniment, sans message d'erreur clair — c'est exactement le
problème qui a mené à cette méthode alternative.

**1. Activez la connexion automatique** (si ce n'est pas déjà fait) :

```bash
sudo raspi-config
# System Options > Boot / Auto Login > Desktop Autologin
```

**2. Installez Chromium** (si absent) :

```bash
sudo apt-get install -y chromium
```

Le nom du paquet/binaire est **`chromium`**, pas `chromium-browser`, sur
les versions actuelles de Raspberry Pi OS — une confusion fréquente qui
fait échouer silencieusement le lancement.

**3. Créez le fichier de démarrage automatique de labwc**, propre à
l'utilisateur connecté :

```bash
mkdir -p ~/.config/labwc
cat >> ~/.config/labwc/autostart << 'EOF'

# --- PiBoard kiosk ---
(
  until curl -fsS http://localhost:8090/api/settings >/dev/null 2>&1; do sleep 1; done
  exec /usr/bin/lwrespawn /usr/bin/chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    http://localhost:8090/
) &
EOF
```

Points importants :
- `>>` (ajout) et non `>` (écrasement) : `labwc` charge à la fois le
  fichier système `/etc/xdg/labwc/autostart` et celui de l'utilisateur —
  le fichier utilisateur doit **compléter**, pas dupliquer, ce que le
  système lance déjà (barre des tâches, fond d'écran...). Si votre
  fichier utilisateur contient déjà d'autres lignes, ajoutez seulement le
  bloc Chromium ci-dessus à la fin, ne remplacez pas le fichier entier.
- La boucle `until curl ...` attend que le serveur PiBoard réponde avant
  de lancer Chromium — utile après un redémarrage si le service met
  quelques secondes à démarrer.
- `lwrespawn` (fourni avec `labwc`) enveloppe Chromium et le **relance
  automatiquement dès qu'il se ferme**, quelle qu'en soit la raison.
  C'est ce qui permet au bouton « Réinitialiser le tableau de bord » de
  PiBoard (et au script `update-piboard.sh`) de recharger le kiosque
  avec un simple `pkill chromium`, sans avoir à relancer Chromium
  manuellement. Si `/usr/bin/lwrespawn` n'existe pas sur votre système,
  retirez `exec /usr/bin/lwrespawn` de la ligne : le kiosque fonctionnera
  quand même, seule la relance automatique après un `pkill` ne se
  produira pas (PiBoard s'appuiera alors sur un rechargement de page
  depuis le navigateur à la place, ce qui reste suffisant dans la
  plupart des cas — voir « Réinitialiser le tableau de bord » ci-dessous).
- `--password-store=basic` supprime une invite de trousseau de clés qui
  bloquerait sinon le lancement en attente d'une saisie impossible en
  kiosque.
- Adaptez `http://localhost:8090/` (les deux occurrences) si vous avez
  changé le port à l'installation.

**4. Redémarrez** : `sudo reboot`. Chromium doit s'ouvrir automatiquement
en plein écran sur le tableau de bord.

### Quitter ou redémarrer le kiosque

Plusieurs façons, de la plus simple à la plus radicale :

1. **Depuis l'écran lui-même** (recommandé, ne nécessite ni clavier ni
   accès distant) : ouvrez le tiroir du bas et touchez le bouton
   « Quitter le tableau de bord » (icône d'interrupteur). Un menu propose
   deux choix :
   - **Réinitialiser le tableau de bord** : recharge PiBoard de zéro dans
     le navigateur, sans toucher à Chromium — utile en cas de blocage
     visuel ou après une mise à jour du serveur.
   - **Revenir au bureau** : ferme Chromium et révèle le bureau `labwc`
     en dessous, sans qu'il ne se rouvre tout seul. Pour revenir au
     tableau de bord ensuite : relancez Chromium vous-même sur
     `http://localhost:8090/` (ou l'adresse configurée), ou redémarrez
     le Pi.
2. **Fermer Chromium sans redémarrer tout le Pi**, par SSH — fait la même
   chose que « Revenir au bureau » ci-dessus, en ligne de commande.
   **Important** : si `lwrespawn` est configuré (voir étape 3
   ci-dessus), il faut le fermer **en premier**, sinon il relance
   Chromium dans l'instant qui suit :
   ```bash
   ssh <user>@<ip-du-pi>
   DISPLAY=:0 pkill -x lwrespawn; DISPLAY=:0 pkill -x chromium
   ```
   Cela révèle le bureau `labwc` en dessous, sans relance automatique.
3. **Redémarrage complet** : `sudo reboot`.

### Gestion du service

```bash
sudo systemctl status piboard          # état
sudo systemctl restart piboard         # redémarrer le serveur
sudo journalctl -u piboard -f          # logs en direct
```

### Mise à jour

```bash
cd piboard
git pull
npm install --omit=dev
sudo systemctl restart piboard
```

Si vous déployez par écrasement de fichiers plutôt que par `git pull`
(par exemple en copiant un zip), un `sudo systemctl restart piboard`
suffit pour les changements côté serveur (`server/*.js`) ; pour les
changements côté navigateur seulement (`public/*`), un simple
rechargement de la page (ou redémarrage du kiosque, voir ci-dessus)
suffit — pas besoin de redémarrer le service.

### Dépannage

**Le kiosque ne démarre pas sur une image Desktop.** Vérifiez que vous
avez bien suivi la méthode `labwc` ci-dessus, et non le service
`piboard-kiosk.service` (qui échoue silencieusement sur Desktop, voir
plus haut). Vérifiez les fautes de frappe dans `~/.config/labwc/autostart`
(`chromium`, pas `chromium-browser`).

**Écran blanc ou tuile « indisponible ».** Le serveur n'est peut-être pas
encore prêt au moment où Chromium démarre. Vérifiez qu'il répond :
`curl http://localhost:8090/api/settings`. S'il ne répond pas, regardez
les logs : `sudo journalctl -u piboard -n 50`.

**Port déjà utilisé.** Changez de port à l'installation
(`--port 8091`), ou libérez le port 8090 (`sudo lsof -i :8090`).

**Perte de la disposition/des réglages après une mise à jour.** Toutes
les données vivent dans `data/` (fichiers JSON) à la racine du projet —
ce dossier n'est jamais touché par `git pull` ni par un écrasement de
fichiers côté `public/`/`server/`. Sauvegardez-le si vous voulez pouvoir
restaurer votre tableau ailleurs.

**Widget Trafic : besoin d'une clé API.** Voir l'aide intégrée
(bouton « ? » du tiroir du bas → section « Carte de trafic ») pour la
procédure pas à pas d'obtention d'une clé gratuite TomTom.

### Désinstallation

```bash
sudo systemctl disable --now piboard piboard-kiosk 2>/dev/null
sudo rm -f /etc/systemd/system/piboard.service /etc/systemd/system/piboard-kiosk.service
sudo systemctl daemon-reload
rm -rf ~/.config/labwc/autostart   # si methode labwc utilisee : retirez seulement le bloc PiBoard
rm -rf /chemin/vers/piboard        # le dossier du projet, avec vos donnees dans data/
```

---

## English

### Prerequisites

- A Raspberry Pi 3, 4, or 5 (or any Linux machine with Node.js ≥ 18).
- Raspberry Pi OS Bookworm or Trixie, **Lite or Desktop** — both work, but
  kiosk mode is set up differently for each (see below).
- Local network access (PiBoard itself needs no internet access, except
  for widgets that call external services — weather, traffic, crypto
  prices, etc.).
- For a touchscreen: enable **Touch mode** in PiBoard's general settings
  once installed (gear button in the bottom drawer) — see the built-in
  help (the "?" button) for what exactly it enlarges.

### Quick install

```bash
git clone https://github.com/jihemezes/piboard.git
cd piboard
sudo ./install/install.sh              # server only
sudo ./install/install.sh --kiosk      # server + automatic kiosk attempt
```

Then open `http://<pi-ip>:8090` from any browser on the local network.

Use `--port 8090` to change the port. The script installs Node.js LTS if
needed, npm dependencies, and registers the `piboard` systemd service.

**Important about `--kiosk`**: this script only automatically installs a
kiosk via `cage` (a minimal Wayland compositor), which only works on a
**Lite** image (no desktop). On a **Desktop** image, the script detects
the already-present desktop environment (labwc, lightdm, gdm...) and
**installs nothing automatically** in that case — it points you to the
section below, which describes the method that actually works.

### Manual install (without the script)

```bash
# 1. Node.js 18+ (already present on a recent image, otherwise):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# 2. Dependencies and launch:
cd piboard
npm install --omit=dev
node server/index.js          # listens on port 8090 by default
```

For automatic startup and recovery after a crash, prefer the systemd
service (see `install/piboard.service`, to copy into
`/etc/systemd/system/` after replacing `@APP_DIR@`, `@USER@`, and
`@PORT@` with your values, as `install.sh` does).

### Kiosk mode on a **Lite** image (no desktop)

This is the case `install.sh --kiosk` handles automatically: fullscreen
Chromium, launched through `cage` (a minimal Wayland compositor that does
nothing but hold the screen for a single application), started as a
systemd service (`piboard-kiosk.service`) right from the login screen.
Works because nothing else competes for the screen on a Lite image.

### Kiosk mode on a **Desktop** image (Bookworm/Trixie Desktop)

**This is the method actually tested and working** for this case — the
`install.sh --kiosk` script can't automate it (it edits the logged-in
user's own desktop configuration, safer to do by hand), so here's the
full procedure.

**Why `cage` doesn't work here:** on a Desktop image with autologin, a
graphical compositor (`labwc` on current Raspberry Pi OS Desktop
versions) already holds the display seat right at boot. A `cage`-based
kiosk service then stays stuck waiting indefinitely, with no clear error
message — this is exactly the problem that led to this alternative
method.

**1. Enable autologin** (if not already):

```bash
sudo raspi-config
# System Options > Boot / Auto Login > Desktop Autologin
```

**2. Install Chromium** (if missing):

```bash
sudo apt-get install -y chromium
```

The package/binary name is **`chromium`**, not `chromium-browser`, on
current Raspberry Pi OS versions — a common mix-up that makes the launch
fail silently.

**3. Create labwc's autostart file**, specific to the logged-in user:

```bash
mkdir -p ~/.config/labwc
cat >> ~/.config/labwc/autostart << 'EOF'

# --- PiBoard kiosk ---
(
  until curl -fsS http://localhost:8090/api/settings >/dev/null 2>&1; do sleep 1; done
  exec /usr/bin/lwrespawn /usr/bin/chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    http://localhost:8090/
) &
EOF
```

Key points:
- `>>` (append), not `>` (overwrite): `labwc` loads both the system file
  `/etc/xdg/labwc/autostart` and the user's own — the user file must
  **add to**, not duplicate, what the system already launches (taskbar,
  wallpaper...). If your user file already has other lines, just append
  the Chromium block above at the end, don't replace the whole file.
- The `until curl ...` loop waits for the PiBoard server to respond
  before launching Chromium — useful after a reboot if the service takes
  a few seconds to come up.
- `lwrespawn` (shipped with `labwc`) wraps Chromium and **automatically
  relaunches it as soon as it closes**, for any reason. This is what lets
  PiBoard's "Reset the dashboard" button (and the `update-piboard.sh`
  script) reload the kiosk with a plain `pkill chromium`, with no need to
  relaunch Chromium by hand. If `/usr/bin/lwrespawn` doesn't exist on
  your system, drop `exec /usr/bin/lwrespawn` from the line: the kiosk
  will still work, it just won't auto-relaunch after a `pkill` (PiBoard
  falls back to a plain browser page reload instead, which is enough in
  most cases — see "Reset the dashboard" below).
- `--password-store=basic` suppresses a keyring prompt that would
  otherwise block the launch waiting for input that's impossible in
  kiosk mode.
- Adjust `http://localhost:8090/` (both occurrences) if you changed the
  port at install time.

**4. Reboot**: `sudo reboot`. Chromium should open automatically
fullscreen on the dashboard.

### Exiting or restarting the kiosk

Several ways, from simplest to most drastic:

1. **From the screen itself** (recommended, needs neither a keyboard nor
   remote access): open the bottom drawer and tap "Exit dashboard" (the
   power-icon button). A menu offers two choices:
   - **Reset the dashboard**: reloads PiBoard from scratch in the
     browser, without touching Chromium at all — handy after a visual
     glitch or once a server-side update has been applied.
   - **Return to the desktop**: closes Chromium and reveals the `labwc`
     desktop underneath, without it reopening on its own. To get back to
     the dashboard afterward: reopen Chromium yourself at
     `http://localhost:8090/` (or whichever address was configured), or
     reboot the Pi.
2. **Close Chromium without rebooting the whole Pi**, over SSH — does
   the same thing as "Return to the desktop" above, from the command
   line. **Important**: if `lwrespawn` is configured (see step 3 above),
   it must be closed **first**, otherwise it relaunches Chromium right
   after:
   ```bash
   ssh <user>@<pi-ip>
   DISPLAY=:0 pkill -x lwrespawn; DISPLAY=:0 pkill -x chromium
   ```
   This reveals the `labwc` desktop underneath, with no auto-relaunch.
3. **Full reboot**: `sudo reboot`.

### Managing the service

```bash
sudo systemctl status piboard          # status
sudo systemctl restart piboard         # restart the server
sudo journalctl -u piboard -f          # live logs
```

### Updating

```bash
cd piboard
git pull
npm install --omit=dev
sudo systemctl restart piboard
```

If you deploy by overwriting files rather than `git pull` (e.g. copying
a zip), a `sudo systemctl restart piboard` is enough for server-side
changes (`server/*.js`); for browser-side changes only (`public/*`), a
plain page reload (or restarting the kiosk, see above) is enough — no
need to restart the service.

### Troubleshooting

**The kiosk doesn't start on a Desktop image.** Make sure you followed
the `labwc` method above, not the `piboard-kiosk.service` unit (which
fails silently on Desktop, see above). Check for typos in
`~/.config/labwc/autostart` (`chromium`, not `chromium-browser`).

**Blank screen or an "unavailable" tile.** The server might not be ready
yet when Chromium starts. Check that it responds:
`curl http://localhost:8090/api/settings`. If it doesn't, check the
logs: `sudo journalctl -u piboard -n 50`.

**Port already in use.** Pick a different port at install time
(`--port 8091`), or free port 8090 (`sudo lsof -i :8090`).

**Lost layout/settings after an update.** All data lives in `data/`
(JSON files) at the project's root — this folder is never touched by
`git pull` or by overwriting `public/`/`server/` files. Back it up if
you want to be able to restore your board elsewhere.

**Traffic widget: needs an API key.** See the built-in help (the "?"
button in the bottom drawer → "Traffic map" section) for the step-by-step
process to get a free TomTom key.

### Uninstalling

```bash
sudo systemctl disable --now piboard piboard-kiosk 2>/dev/null
sudo rm -f /etc/systemd/system/piboard.service /etc/systemd/system/piboard-kiosk.service
sudo systemctl daemon-reload
rm -rf ~/.config/labwc/autostart   # if the labwc method was used: only remove the PiBoard block
rm -rf /path/to/piboard            # the project folder, with your data in data/
```
