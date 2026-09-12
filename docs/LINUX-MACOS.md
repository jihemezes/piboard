# PiBoard sous Linux et macOS — installer, mettre à jour, publier

*Install, update and publish the PiBoard desktop app on Linux and macOS —
English version below.*

---

## Français

### Ce que c'est

Le **même** PiBoard que l'application Windows (voir `docs/WINDOWS.md`) :
Electron n'est qu'une coquille autour du serveur Express et de
l'interface. Un seul code, trois empaquetages. Ce document ne couvre que
ce qui diffère de Windows.

À ne pas confondre avec l'installation **kiosque** du Raspberry Pi
(`INSTALL.md`) : là, le serveur tourne en service `systemd` et Chromium
affiche la page en plein écran. C'est toujours la méthode recommandée
pour un écran mural. L'application de bureau Linux vise un **Pi utilisé
comme ordinateur**, un PC sous Ubuntu / Debian / Zorin OS, ou n'importe
quelle autre distribution.

### Fichiers publiés à chaque release

| Fichier | Pour |
|---|---|
| `PiBoard-x.y.z-linux-amd64.deb` | PC 64 bits : Debian, Ubuntu, Zorin OS, Linux Mint… |
| `PiBoard-x.y.z-linux-arm64.deb` | Raspberry Pi 3/4/5 sous **Pi OS 64 bits** (Bookworm ou Trixie) |
| `PiBoard-x.y.z-linux-x86_64.AppImage` | PC 64 bits, toute distribution (Fedora, Arch, openSUSE…) |
| `PiBoard-x.y.z-linux-arm64.AppImage` | Raspberry Pi 64 bits, sans installation |
| `PiBoard-x.y.z-mac-arm64.dmg` | Mac Apple Silicon (M1 et suivants) |
| `PiBoard-x.y.z-mac-x64.dmg` | Mac Intel |
| `*.zip` (macOS) et `latest-*.yml` | Fichiers techniques pour `electron-updater`, à ignorer |

**Pas de 32 bits** : Electron 43 est la dernière série à fournir des
binaires `armv7l`, et une image Pi OS 64 bits est de toute façon la
norme depuis Bookworm. Un Pi sous OS 32 bits reste servi par
l'installation kiosque (`INSTALL.md`), qui n'a pas cette contrainte.

### Linux — quel format choisir ?

**Le `.deb` d'abord**, pour toute la famille Debian (Pi OS, Debian,
Ubuntu, Zorin, Mint) :

```bash
sudo apt install ./PiBoard-x.y.z-linux-arm64.deb     # ou -amd64 sur PC
```

L'application apparaît dans le menu, ses dépendances sont résolues par
`apt`, et surtout le bac à sable de Chromium (`chrome-sandbox`) est
installé avec les bons droits — y compris le profil AppArmor dont
Ubuntu 24.04 et suivants (donc Zorin OS 18) ont besoin. Désinstallation :
`sudo apt remove piboard` (les données restent, voir plus bas).

**L'AppImage ensuite**, quand il n'y a pas d'`apt` (Fedora, Arch…) ou
qu'on ne veut rien installer :

```bash
chmod +x PiBoard-x.y.z-linux-x86_64.AppImage
./PiBoard-x.y.z-linux-x86_64.AppImage
```

Deux pièges connus :

- **`libfuse2` absent** (« dlopen(): error loading libfuse.so.2 ») :
  `sudo apt install libfuse2` (`libfuse2t64` sur Ubuntu 24.04 / Debian
  Trixie), ou lancer avec `--appimage-extract-and-run`.
- **Ubuntu 24.04+ / Zorin 18** : AppArmor bloque les espaces de noms
  utilisateur dont le bac à sable a besoin, et l'application refuse de
  démarrer. Lancer avec `--no-sandbox`, ou — mieux — installer le `.deb`.

### Linux — différences avec Windows

| Sujet | Windows | Linux |
|---|---|---|
| Données | `%APPDATA%\PiBoard\data` | `~/.config/piboard/data` (Electron utilise le nom du paquet, en minuscules) |
| Journal | `%APPDATA%\PiBoard\logs\piboard.log` | `~/.config/piboard/logs/piboard.log` |
| Emplacement du `.deb` | — | `/opt/PiBoard/piboard` |
| Démarrage automatique | Entrée de démarrage Windows | Fichier `~/.config/autostart/piboard.desktop`, créé/supprimé par la case à cocher des réglages (convention Freedesktop, comprise par labwc, GNOME, KDE, XFCE…) |
| Mise à jour automatique | Installeur relancé à la fermeture | AppImage : remplacée en place, sans droits. `.deb` : réinstallé par `pkexec dpkg -i`, d'où une demande de mot de passe administrateur |
| Quitter | `Alt+F4` | `Alt+F4` (ou le bouton du bureau) |

Comme sous Windows, le serveur n'écoute que sur `127.0.0.1` : le tableau
de bord n'est pas visible depuis les autres machines du réseau. Pour
cela, c'est l'installation kiosque qu'il faut (`0.0.0.0`).

### macOS — versions et limites

**Versions supportées : macOS 12 Monterey et suivants**, Intel comme
Apple Silicon. Cette limite ne vient pas de PiBoard mais de Chromium via
Electron : Electron 43 (celui de `package.json`) exige macOS 12 ;
Electron 44 exigera macOS 13 Ventura. Chaque montée d'Electron peut
donc abandonner une version de macOS — à vérifier dans les « breaking
changes » d'Electron avant de changer le numéro dans `package.json`.

Remonter plus loin (Big Sur 11, Catalina 10.15, High Sierra 10.13…)
reste **possible mais coûteux** : il faudrait une branche de
construction séparée épinglée sur un Electron ancien (33 pour macOS 11,
32 pour 10.15, 26 pour 10.13), donc un Chromium ancien, sans correctifs
de sécurité, et à maintenir à chaque version. Non mis en place ;
à envisager seulement si une vraie demande se présente.

Installation : ouvrir le `.dmg`, glisser PiBoard dans *Applications*.

**L'application n'est pas signée par Apple** (cela suppose un compte
développeur payant). Deux conséquences, connues et acceptées :

1. **Premier lancement bloqué par Gatekeeper** (« PiBoard est
   endommagé » ou « ne peut pas être ouvert »). Sur macOS 12 à 14 :
   clic droit sur l'application → *Ouvrir*. Sur macOS 15 Sequoia et
   suivants, le clic droit ne suffit plus : tenter d'ouvrir une fois,
   puis *Réglages Système → Confidentialité et sécurité → Ouvrir quand
   même*. En dernier recours, dans le Terminal :
   `xattr -cr /Applications/PiBoard.app`.
2. **Pas de mise à jour automatique** : `electron-updater` refuse par
   conception de mettre à jour une application non signée sur macOS.
   « Rechercher une mise à jour » affiche une erreur qui l'explique.
   Mettre à jour = retélécharger le `.dmg` depuis la page des releases.
   Les données (`~/Library/Application Support/piboard/data`) sont
   conservées.

Le jour où une signature Developer ID est disponible, il suffit de
retirer `identity: null` de `electron-builder.yml`, de fournir le
certificat au workflow (secrets `CSC_LINK` / `CSC_KEY_PASSWORD`, plus
les identifiants de notarisation) et les deux limites disparaissent.

### Publier — comment ça s'articule

`electron-builder` ne sait produire ni `.deb` / AppImage depuis Windows,
ni `.dmg` hors de macOS. D'où le partage suivant, sans rien changer aux
habitudes :

- **Windows** : toujours construit et publié depuis le PC par
  `npm run publish` (voir `docs/WINDOWS.md`).
- **Linux et macOS** : construits par **GitHub Actions**
  (`.github/workflows/release.yml`) sur des machines prêtées par GitHub,
  déclenché par le **tag `v*`** poussé. Rien à installer, aucun jeton à
  configurer : le workflow utilise le jeton automatique du dépôt.

Les deux écrivent dans la **même** release GitHub, celle du tag. Celui
qui arrive en premier la crée, l'autre y ajoute ses fichiers. Aucune
collision : chaque plateforme a ses noms de fichiers et son propre
`latest*.yml`. La séquence de livraison habituelle reste donc :

```bash
git add -A
git commit -m "x.y.z - ..."
git tag vx.y.z
git push
git push origin vx.y.z        # -> démarre le workflow Linux + macOS
npm run publish               # -> ajoute Windows à la même release
```

### Release « latest » ou « pre-release »

Le statut de la release n'est choisi ni sur le PC ni dans le workflow,
mais par le **numéro de version** de `package.json`, lu par
`scripts/publish.js` des deux côtés :

| Version dans `package.json` (et donc le tag) | Release GitHub |
|---|---|
| `1.101.0` → `v1.101.0` | **Latest** (version recommandée du dépôt) |
| `1.101.0-beta.1` → `v1.101.0-beta.1` | **Pre-release** (ne devient pas la « latest ») |

Le choix se fait donc au moment du push, sans aller sur GitHub : il
suffit du suffixe dans le numéro de version. C'est le même suffixe
sémantique que celui sur lequel s'appuie déjà le canal « Toutes les
versions (aperçu) » des réglages, donc une pre-release n'est proposée
qu'aux installations réglées sur ce canal.

Pourquoi le numéro de version plutôt qu'un simple drapeau : **deux**
machines publient dans la même release (le PC pour Windows, GitHub
Actions pour Linux et macOS), et la première arrivée fixe le statut.
Un drapeau connu du seul PC ferait dépendre le résultat de qui gagne
la course ; le numéro de version, lui, est dans le dépôt et lu à
l'identique des deux côtés.

Dérogation ponctuelle, sans toucher au numéro :
`PIBOARD_RELEASE=prerelease npm run publish` (ou `=latest`). À poser
des deux côtés si la publication Linux/macOS doit suivre — d'où
l'intérêt de s'en tenir au suffixe de version dans le cas normal.

Les brouillons (`draft`) ne sont volontairement pas proposés : l'API
GitHub ne les montre pas à un client non authentifié, et le Raspberry
Pi ne verrait plus aucune mise à jour.

`npm run publish` refuse par ailleurs de publier si le tag git posé sur
HEAD ne correspond pas à la version de `package.json`.

Le workflow prend 5 à 10 minutes ; l'onglet *Actions* du dépôt montre
son avancement. On peut aussi le lancer **à la main** depuis cet onglet
(*Run workflow*) : il construit alors sans publier et dépose les
paquets en « artifacts » téléchargeables 7 jours — pratique pour
vérifier qu'une modification de la configuration construit encore
avant de tagger.

Construire localement, pour tester : `npm run dist:linux` sur une
machine Linux (produit les quatre fichiers, x64 **et** arm64, sans
émulation), `npm run dist:mac` sur un Mac.

### Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié sur une machine Linux x64 : construction des quatre paquets
Linux, contenu du `.deb` (dépendances, `chrome-sandbox`, profil
AppArmor, entrée de menu), lancement de l'application déballée et de
l'AppImage (serveur, page, `/api/changelog` depuis l'archive asar),
case « démarrage automatique » (fichier `autostart` créé puis supprimé),
et l'appel de mise à jour d'`electron-updater` (il cherche bien
`latest-linux.yml` dans la release GitHub).

**Non vérifié** faute de machine : le paquet macOS (construction du
`.dmg`, comportement de Gatekeeper) et l'exécution réelle sur Raspberry
Pi (le paquet arm64 est produit, pas lancé). Le premier tag publié sera
le vrai test ; le lancement manuel du workflow permet de le faire sans
publier.

---

## English

### What it is

The **same** PiBoard as the Windows app (see `docs/WINDOWS.md`):
Electron is only a shell around the Express server and the interface.
One code base, three packagings. This document only covers what differs
from Windows.

Not to be confused with the Raspberry Pi **kiosk** install
(`INSTALL.md`): there, the server runs as a `systemd` service and
Chromium shows the page full screen. That remains the recommended
method for a wall screen. The Linux desktop app targets a **Pi used as
a computer**, a PC running Ubuntu / Debian / Zorin OS, or any other
distribution.

### Files published with every release

| File | For |
|---|---|
| `PiBoard-x.y.z-linux-amd64.deb` | 64-bit PC: Debian, Ubuntu, Zorin OS, Linux Mint… |
| `PiBoard-x.y.z-linux-arm64.deb` | Raspberry Pi 3/4/5 on **64-bit Pi OS** (Bookworm or Trixie) |
| `PiBoard-x.y.z-linux-x86_64.AppImage` | 64-bit PC, any distribution (Fedora, Arch, openSUSE…) |
| `PiBoard-x.y.z-linux-arm64.AppImage` | 64-bit Raspberry Pi, no installation |
| `PiBoard-x.y.z-mac-arm64.dmg` | Apple Silicon Mac (M1 and later) |
| `PiBoard-x.y.z-mac-x64.dmg` | Intel Mac |
| `*.zip` (macOS) and `latest-*.yml` | Technical files for `electron-updater`, ignore them |

**No 32-bit**: Electron 43 is the last series shipping `armv7l`
binaries, and a 64-bit Pi OS image has been the norm since Bookworm
anyway. A Pi on a 32-bit OS is still served by the kiosk install
(`INSTALL.md`), which has no such constraint.

### Linux — which format?

**The `.deb` first**, for the whole Debian family (Pi OS, Debian,
Ubuntu, Zorin, Mint):

```bash
sudo apt install ./PiBoard-x.y.z-linux-arm64.deb     # or -amd64 on a PC
```

The app shows up in the menu, its dependencies are resolved by `apt`,
and above all Chromium's sandbox (`chrome-sandbox`) is installed with
the right permissions — including the AppArmor profile that Ubuntu
24.04 and later (hence Zorin OS 18) require. Uninstall:
`sudo apt remove piboard` (data is kept, see below).

**The AppImage otherwise**, when there is no `apt` (Fedora, Arch…) or
you don't want to install anything:

```bash
chmod +x PiBoard-x.y.z-linux-x86_64.AppImage
./PiBoard-x.y.z-linux-x86_64.AppImage
```

Two known traps:

- **Missing `libfuse2`** ("dlopen(): error loading libfuse.so.2"):
  `sudo apt install libfuse2` (`libfuse2t64` on Ubuntu 24.04 / Debian
  Trixie), or launch with `--appimage-extract-and-run`.
- **Ubuntu 24.04+ / Zorin 18**: AppArmor blocks the user namespaces the
  sandbox needs, and the app refuses to start. Launch with
  `--no-sandbox`, or — better — install the `.deb`.

### Linux — differences from Windows

| Topic | Windows | Linux |
|---|---|---|
| Data | `%APPDATA%\PiBoard\data` | `~/.config/piboard/data` (Electron uses the package name, lower case) |
| Log | `%APPDATA%\PiBoard\logs\piboard.log` | `~/.config/piboard/logs/piboard.log` |
| `.deb` install location | — | `/opt/PiBoard/piboard` |
| Launch at login | Windows startup entry | `~/.config/autostart/piboard.desktop` file, created/removed by the settings checkbox (Freedesktop convention, understood by labwc, GNOME, KDE, XFCE…) |
| Automatic update | Installer re-run on close | AppImage: replaced in place, no rights needed. `.deb`: reinstalled through `pkexec dpkg -i`, hence an administrator password prompt |
| Quit | `Alt+F4` | `Alt+F4` (or the desktop's close button) |

As on Windows, the server only listens on `127.0.0.1`: the dashboard is
not reachable from other machines on the network. For that, use the
kiosk install (`0.0.0.0`).

### macOS — versions and limits

**Supported versions: macOS 12 Monterey and later**, Intel and Apple
Silicon alike. That floor does not come from PiBoard but from Chromium
through Electron: Electron 43 (the one in `package.json`) requires
macOS 12; Electron 44 will require macOS 13 Ventura. Every Electron
bump may therefore drop a macOS version — check Electron's "breaking
changes" before changing the number in `package.json`.

Going further back (Big Sur 11, Catalina 10.15, High Sierra 10.13…)
stays **possible but costly**: it would take a separate build branch
pinned to an old Electron (33 for macOS 11, 32 for 10.15, 26 for
10.13), hence an old Chromium with no security fixes, to be maintained
with every version. Not set up; to be considered only if a real request
comes up.

Install: open the `.dmg`, drag PiBoard into *Applications*.

**The app is not signed by Apple** (that requires a paid developer
account). Two known and accepted consequences:

1. **First launch blocked by Gatekeeper** ("PiBoard is damaged" or
   "cannot be opened"). On macOS 12 to 14: right-click the app →
   *Open*. On macOS 15 Sequoia and later, right-click no longer
   suffices: try opening once, then *System Settings → Privacy &
   Security → Open Anyway*. As a last resort, in Terminal:
   `xattr -cr /Applications/PiBoard.app`.
2. **No automatic update**: `electron-updater` refuses by design to
   update an unsigned app on macOS. "Check for updates" shows an error
   explaining it. Updating = re-download the `.dmg` from the releases
   page. Data (`~/Library/Application Support/piboard/data`) is kept.

Once a Developer ID signature is available, remove `identity: null`
from `electron-builder.yml`, hand the certificate to the workflow
(`CSC_LINK` / `CSC_KEY_PASSWORD` secrets, plus the notarization
credentials) and both limits go away.

### Publishing — how it fits together

`electron-builder` can produce neither `.deb` / AppImage from Windows,
nor `.dmg` outside macOS. Hence the following split, with no change to
the usual routine:

- **Windows**: still built and published from the PC with
  `npm run publish` (see `docs/WINDOWS.md`).
- **Linux and macOS**: built by **GitHub Actions**
  (`.github/workflows/release.yml`) on machines lent by GitHub,
  triggered by the pushed **`v*` tag**. Nothing to install, no token to
  set up: the workflow uses the repository's automatic token.

Both write into the **same** GitHub release, the tag's one. Whichever
comes first creates it, the other adds its files. No collision: each
platform has its own file names and its own `latest*.yml`. The usual
delivery sequence therefore stays:

```bash
git add -A
git commit -m "x.y.z - ..."
git tag vx.y.z
git push
git push origin vx.y.z        # -> starts the Linux + macOS workflow
npm run publish               # -> adds Windows to the same release
```

### "Latest" or "pre-release"

The release's status is chosen neither on the PC nor in the workflow,
but by `package.json`'s **version number**, read by
`scripts/publish.js` on both sides:

| Version in `package.json` (hence the tag) | GitHub release |
|---|---|
| `1.101.0` → `v1.101.0` | **Latest** (the repository's recommended version) |
| `1.101.0-beta.1` → `v1.101.0-beta.1` | **Pre-release** (does not become the "latest") |

The choice is therefore made at push time, without visiting GitHub: the
suffix in the version number is all it takes. It is the same semver
suffix the settings' "All versions (preview)" channel already relies
on, so a pre-release is only offered to installations set to that
channel.

Why the version number rather than a plain flag: **two** machines
publish into the same release (the PC for Windows, GitHub Actions for
Linux and macOS), and whichever arrives first sets the status. A flag
known only to the PC would make the result depend on who wins the race;
the version number is in the repository and read identically on both
sides.

One-off override, without touching the number:
`PIBOARD_RELEASE=prerelease npm run publish` (or `=latest`). To be set
on both sides if the Linux/macOS publication must follow — hence the
interest of sticking to the version suffix in the normal case.

Drafts are deliberately not offered: GitHub's API hides them from
unauthenticated clients, and the Raspberry Pi would stop seeing any
update.

`npm run publish` also refuses to publish if the git tag on HEAD does
not match `package.json`'s version.

The workflow takes 5 to 10 minutes; the repository's *Actions* tab
shows its progress. It can also be run **by hand** from that tab
(*Run workflow*): it then builds without publishing and stores the
packages as "artifacts" downloadable for 7 days — handy to check that a
configuration change still builds before tagging.

Building locally, to test: `npm run dist:linux` on a Linux machine
(produces all four files, x64 **and** arm64, no emulation),
`npm run dist:mac` on a Mac.

### What was verified, and what was not

Verified on a Linux x64 machine: build of the four Linux packages,
`.deb` content (dependencies, `chrome-sandbox`, AppArmor profile, menu
entry), launch of the unpacked app and of the AppImage (server, page,
`/api/changelog` served from the asar archive), the "launch at login"
checkbox (`autostart` file created then removed), and
`electron-updater`'s update call (it does look for `latest-linux.yml`
in the GitHub release).

**Not verified** for lack of a machine: the macOS package (`.dmg`
build, Gatekeeper behaviour) and actual execution on a Raspberry Pi
(the arm64 package is produced, not launched). The first published tag
will be the real test; running the workflow by hand allows doing it
without publishing.
