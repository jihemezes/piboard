# PiBoard sous Windows — construire, installer, publier

*Build, install and publish PiBoard on Windows — English version below.*

---

## Français

### Ce que c'est

L'application de bureau Windows n'est pas un portage : c'est **exactement
le même PiBoard**, serveur Express et interface compris. Electron n'y
sert que de coquille — il démarre le serveur dans son propre processus,
puis ouvre une fenêtre pointant sur `http://127.0.0.1`.

Conséquence pratique : tout widget écrit pour le Raspberry Pi fonctionne
sous Windows sans modification, à condition de ne jamais tester
`process.platform` en dehors de `server/platform/` (voir README).

### Différences avec le Raspberry Pi

| Sujet | Raspberry Pi | Windows |
|---|---|---|
| Affichage | Chromium en kiosque, supervisé par `lwrespawn` | Fenêtre Electron redimensionnable |
| Quitter | « Revenir au bureau » tue `lwrespawn` puis Chromium | `Alt+F4`, ou « Revenir au bureau » qui ferme l'application |
| Données | `data/` à côté du code | `%APPDATA%\PiBoard\data` |
| Écoute réseau | `0.0.0.0` (accessible depuis le réseau) | `127.0.0.1` uniquement |
| Mise à jour | Archives ZIP déposées dans `~/updates/` | `electron-updater` via GitHub Releases |
| Démarrage auto | `systemd` + autostart labwc | Case à cocher dans les réglages |
| Température CPU | `/sys/class/thermal` | Indisponible, la ligne est masquée |
| Noms `.local` | `getent` consulte Avahi (mDNS) | `ping -a`, sans mDNS : plus d'appareils sans nom |

L'écoute sur `127.0.0.1` est délibérée : la fenêtre est le seul client du
serveur, et rester sur la boucle locale évite l'invite du pare-feu
Windows au premier lancement.

### Construire l'installeur

Prérequis : **Node.js ≥ 18.15** et **Git**, sur la machine Windows. La
génération d'un installeur NSIS depuis Linux exigerait Wine et donne un
résultat nettement moins fiable — mieux vaut construire directement sous
Windows.

```
git clone https://github.com/jihemezes/piboard.git
cd piboard
npm install
npm run dist
```

L'installeur apparaît dans `dist\PiBoard Setup <version>.exe`.

Pour tester sans construire :

```
npm run electron
```

### Accéder au menu de l'application

La barre de menu est **masquée par défaut** (fenêtre volontairement
épurée) mais reste entièrement fonctionnelle. Pour la faire apparaître :

> **Appuyez sur la touche `Alt`** (seule, sans la maintenir avec une
> autre touche). La barre de menu « PiBoard » apparaît en haut de la
> fenêtre. Un second appui sur `Alt`, ou un clic ailleurs dans la
> fenêtre, la referme.

Ce n'est pas intuitif — rien à l'écran n'indique que ce menu existe —
mais c'est le seul point d'accès à plusieurs fonctions qui n'ont pas
d'autre bouton dans l'interface :

| Fonction | Où |
|---|---|
| Recharger le tableau de bord | Menu PiBoard → *Recharger / Reload* (`Ctrl+R`) |
| Plein écran | Menu PiBoard → *Plein écran / Full screen* (`F11`) |
| Zoom de l'interface | Menu PiBoard → *Zoom +* / *Zoom -* / *Zoom 100 %* |
| Outils de développement | Menu PiBoard → *Outils de développement* (`F12`) |
| **Rechercher une mise à jour** | Menu PiBoard → *Rechercher une mise à jour / Check for updates* |
| Quitter | Menu PiBoard → *Quitter / Quit* (`Alt+F4`, fonctionne sans ouvrir le menu) |

`Alt+F4` et les raccourcis clavier (`Ctrl+R`, `F11`, `F12`) fonctionnent
directement, menu ouvert ou non — seul *Rechercher une mise à jour* n'a
pas de raccourci et nécessite d'ouvrir le menu.

### Publier une version (mise à jour automatique)

`electron-updater` lit un fichier `latest.yml` déposé dans la release
GitHub. C'est `electron-builder` qui le produit et le publie.

1. **Créer un jeton d'accès GitHub** — sur github.com, *Settings →
   Developer settings → Personal access tokens*. Un jeton classique avec
   la portée `repo` suffit. Ce jeton n'est utilisé qu'au moment de
   publier, depuis votre PC : il n'est **jamais** embarqué dans
   l'application distribuée.

2. **Le fournir à la commande**, dans PowerShell :

   ```powershell
   $env:GH_TOKEN = "ghp_votre_jeton"
   npm run publish
   ```

3. **Publier la release sur GitHub** — `electron-builder` crée la release
   en mode brouillon. Tant qu'elle reste en brouillon, aucun client ne
   la voit ; c'est en la publiant qu'elle devient visible des
   installations existantes.

Le numéro de version publié est celui de `package.json`. La comparaison
est faite en semver : il doit donc être strictement supérieur au
précédent pour qu'une mise à jour soit proposée.

### Tester la détection de mise à jour

Le test ne prouve quelque chose que s'il existe un **écart de version**
entre ce qui est installé sur la machine et ce qui est publié sur
GitHub. Sans écart, `electron-updater` répond simplement « à jour » —
ce qui n'est pas un échec, mais un test qui ne démontre rien.

1. **Vérifier la version actuellement installée** :

   ```powershell
   (Get-Item "$env:LOCALAPPDATA\Programs\PiBoard\PiBoard.exe").VersionInfo.ProductVersion
   ```

2. **Publier sur GitHub une version strictement supérieure** à celle-ci
   (un simple bump de `package.json` suffit pour un test, pas besoin
   d'un vrai correctif) — `npm run dist` puis `npm run publish`, puis
   publier le brouillon sur GitHub comme ci-dessus.

3. **Sur la machine dont la version installée est plus ancienne**,
   ouvrir PiBoard, appuyer sur `Alt` pour révéler le menu, puis
   *Rechercher une mise à jour*. Une fenêtre doit proposer le
   téléchargement de la nouvelle version.

4. **Accepter le téléchargement puis le redémarrage proposé** —
   l'application se ferme et se relance automatiquement dans la nouvelle
   version.

5. **Reconfirmer** avec la commande de l'étape 1 : elle doit maintenant
   afficher le nouveau numéro.

Une vérification automatique et silencieuse a aussi lieu 8 secondes
après chaque lancement (sans fenêtre si tout est à jour) — mais le menu
manuel reste le moyen le plus fiable de déclencher un test volontaire.

### Points à connaître

**Avertissement SmartScreen.** Sans certificat de signature de code,
Windows affiche « Windows a protégé votre ordinateur » au premier
lancement de l'installeur. Il faut cliquer *Informations complémentaires*
puis *Exécuter quand même*. C'est attendu, et cela ne se reproduit pas
aux mises à jour suivantes.

**Installation par utilisateur.** PiBoard s'installe dans
`%LOCALAPPDATA%\Programs\PiBoard`, pas dans `Program Files`. Ce n'est pas
un détail : `electron-updater` ne pourrait pas écrire dans `Program
Files` sans élévation, et les mises à jour automatiques échoueraient
silencieusement.

**Les données survivent à la désinstallation.** `%APPDATA%\PiBoard`
contient la disposition des tuiles, les clés API et les photos
téléversées. La désinstallation ne l'efface pas — une réinstallation
retrouve tout. Pour repartir de zéro, supprimer ce dossier à la main.

**L'archive ASAR est désactivée.** `express.static` sert plusieurs
centaines de fichiers statiques, et la compatibilité ASAR d'Electron
reste une émulation de `fs`. Le code étant public sous licence MIT,
l'archive n'apporterait aucune protection : la robustesse a été
préférée. Voir le commentaire détaillé dans `electron-builder.yml`.

**Identifiant applicatif.** `com.jihemezes.piboard` ne doit **plus
jamais changer** : les installations existantes ne se reconnaîtraient
plus et la mise à jour automatique cesserait de fonctionner.

---

## English

### What it is

The Windows desktop application is not a port: it is **exactly the same
PiBoard**, Express server and interface included. Electron only acts as a
shell — it starts the server inside its own process, then opens a window
pointing at `http://127.0.0.1`.

Practical consequence: any widget written for the Raspberry Pi works on
Windows unmodified, provided it never tests `process.platform` outside
`server/platform/` (see README).

### Differences from the Raspberry Pi

| Topic | Raspberry Pi | Windows |
|---|---|---|
| Display | Chromium in kiosk mode, supervised by `lwrespawn` | Resizable Electron window |
| Quitting | "Return to the desktop" kills `lwrespawn` then Chromium | `Alt+F4`, or "Return to the desktop" which closes the app |
| Data | `data/` next to the code | `%APPDATA%\PiBoard\data` |
| Network binding | `0.0.0.0` (reachable from the network) | `127.0.0.1` only |
| Updates | ZIP archives dropped into `~/updates/` | `electron-updater` via GitHub Releases |
| Auto start | `systemd` + labwc autostart | Checkbox in the settings |
| CPU temperature | `/sys/class/thermal` | Unavailable, the row is hidden |
| `.local` names | `getent` consults Avahi (mDNS) | `ping -a`, no mDNS: more unnamed devices |

Binding to `127.0.0.1` is deliberate: the window is the server's only
client, and staying on the loopback avoids the Windows firewall prompt on
first launch.

### Building the installer

Requirements: **Node.js ≥ 18.15** and **Git**, on the Windows machine.
Generating an NSIS installer from Linux would require Wine and gives a
markedly less reliable result — better to build directly on Windows.

```
git clone https://github.com/jihemezes/piboard.git
cd piboard
npm install
npm run dist
```

The installer appears in `dist\PiBoard Setup <version>.exe`.

To test without building:

```
npm run electron
```

### Accessing the application menu

The menu bar is **hidden by default** (a deliberately clean window) but
stays fully functional. To reveal it:

> **Press the `Alt` key** (alone, not held with another key). The
> "PiBoard" menu bar appears at the top of the window. Pressing `Alt`
> again, or clicking elsewhere in the window, closes it.

This isn't intuitive — nothing on screen hints that this menu exists —
but it's the only entry point for several functions that have no other
button in the interface:

| Function | Where |
|---|---|
| Reload the dashboard | PiBoard menu → *Reload* (`Ctrl+R`) |
| Full screen | PiBoard menu → *Full screen* (`F11`) |
| Interface zoom | PiBoard menu → *Zoom +* / *Zoom -* / *Zoom 100%* |
| Developer tools | PiBoard menu → *Developer tools* (`F12`) |
| **Check for updates** | PiBoard menu → *Check for updates* |
| Quit | PiBoard menu → *Quit* (`Alt+F4`, works without opening the menu) |

`Alt+F4` and the keyboard shortcuts (`Ctrl+R`, `F11`, `F12`) work
directly whether the menu is open or not — only *Check for updates* has
no shortcut and requires opening the menu.

### Publishing a release (automatic updates)

`electron-updater` reads a `latest.yml` file dropped into the GitHub
release. `electron-builder` is what produces and publishes it.

1. **Create a GitHub access token** — on github.com, *Settings →
   Developer settings → Personal access tokens*. A classic token with the
   `repo` scope is enough. That token is only used when publishing, from
   your PC: it is **never** embedded in the distributed application.

2. **Provide it to the command**, in PowerShell:

   ```powershell
   $env:GH_TOKEN = "ghp_your_token"
   npm run publish
   ```

3. **Publish the release on GitHub** — `electron-builder` creates the
   release as a draft. While it stays a draft no client sees it; it is by
   publishing it that it becomes visible to existing installations.

The published version number is the one in `package.json`. Comparison is
done in semver: it must therefore be strictly greater than the previous
one for an update to be offered.

### Testing update detection

The test only proves something if there's a **version gap** between
what's installed on the machine and what's published on GitHub. Without
a gap, `electron-updater` simply reports "up to date" — which isn't a
failure, but a test that demonstrates nothing.

1. **Check the currently installed version**:

   ```powershell
   (Get-Item "$env:LOCALAPPDATA\Programs\PiBoard\PiBoard.exe").VersionInfo.ProductVersion
   ```

2. **Publish a strictly higher version** on GitHub than that one (a
   simple `package.json` bump is enough for a test, no real fix
   required) — `npm run dist` then `npm run publish`, then publish the
   draft on GitHub as above.

3. **On the machine whose installed version is older**, open PiBoard,
   press `Alt` to reveal the menu, then *Check for updates*. A window
   should offer to download the new version.

4. **Accept the download, then the restart it offers** — the application
   closes and relaunches automatically on the new version.

5. **Re-check** with the command from step 1: it should now show the new
   version number.

An automatic, silent check also runs 8 seconds after each launch (no
window if already up to date) — but the manual menu remains the most
reliable way to trigger a deliberate test.

### Good to know

**SmartScreen warning.** Without a code-signing certificate, Windows
displays "Windows protected your PC" the first time the installer runs.
You have to click *More info* then *Run anyway*. This is expected, and it
does not happen again on subsequent updates.

**Per-user installation.** PiBoard installs into
`%LOCALAPPDATA%\Programs\PiBoard`, not `Program Files`. This is not a
detail: `electron-updater` could not write into `Program Files` without
elevation, and automatic updates would fail silently.

**Data survives uninstallation.** `%APPDATA%\PiBoard` holds the tile
layout, API keys and uploaded photos. Uninstalling does not erase it — a
reinstallation finds everything back. To start from scratch, delete that
folder by hand.

**The ASAR archive is disabled.** `express.static` serves several hundred
static files, and Electron's ASAR compatibility remains an `fs`
emulation. The code being public under the MIT licence, the archive would
provide no protection whatsoever: robustness was preferred. See the
detailed comment in `electron-builder.yml`.

**Application id.** `com.jihemezes.piboard` must **never change**:
existing installations would no longer recognize themselves and automatic
updating would stop working.
