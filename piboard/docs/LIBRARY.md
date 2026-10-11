# Enrichir la bibliothèque d'images livrée

*How to extend the image library shipped with PiBoard — English version below.*

---

## Français

### Où vont les images

| Dossier | Contenu | Survit à une mise à jour ? |
|---|---|---|
| `public/library/<section>/` | Le lot **livré**, celui que vous préparez | Non : il est *remplacé* par celui de la nouvelle version — c'est par là qu'il s'enrichit |
| `data/library/<section>/` | Les ajouts de **l'utilisateur** | Oui, jamais touché |

Trois sections : `backgrounds`, `logos`, `photos`. Formats acceptés : `.jpg`,
`.jpeg`, `.png`, `.gif`, `.webp`, `.svg`.

### La marche à suivre

1. Déposez vos fichiers dans `public/library/backgrounds/` (ou `logos/`,
   `photos/`). Nommez-les lisiblement : sans entrée dans `meta.json`, le nom du
   fichier sert de libellé (`nuit-etoilee.jpg` → « nuit etoilee »).

2. **Laissez le script les décrire** — c'est le plus simple dès qu'il y a plus
   de trois images :

   ```bash
   npm run library:meta
   ```

   Il remplit le `meta.json` de chaque section à partir des noms de fichiers :
   `name` = le nom sans extension, `category` = **la première partie du nom**,
   avant le premier `_`, `-` ou espace (`Classy_Blue.png` → catégorie
   « Classy »). C'est donc la convention de nommage à respecter en déposant les
   fichiers. Le `tone` (clair/sombre) n'est pas deviné mais **mesuré** : ffmpeg
   réduit l'image à un pixel et la luminance de ce pixel tranche — sans ffmpeg,
   le champ est laissé vide plutôt que rempli au hasard.

   L'auteur et la licence se passent en option, et valent pour tout le lot :

   ```bash
   npm run library:meta -- --author "Jean-Michel EZES" --license "CC BY 4.0"
   ```

   Le script **n'écrase jamais une entrée existante** : relancez-le après chaque
   ajout, vos retouches à la main survivent. `--force` réécrit tout, à n'utiliser
   que pour repartir de zéro.

   Le champ `source` n'est pas rempli, et c'est voulu : il ne sert qu'à créditer
   une image trouvée ailleurs (page d'origine, banque d'images). Pour vos propres
   images il n'y a rien à pointer — l'interface n'affiche que ce qui existe.

3. Ou décrivez-les à la main dans le `meta.json` de la section. Une entrée par
   fichier, tous les champs facultatifs :

   ```json
   {
     "nuit-etoilee.jpg": {
       "name": "Nuit étoilée",
       "category": "nature",
       "tone": "dark",
       "author": "Prénom Nom",
       "license": "CC BY 4.0",
       "source": "https://exemple.org/photo"
     }
   }
   ```

   `category` est libre (elle alimente le filtre de l'interface : utilisez les
   mêmes mots d'une image à l'autre). `tone` vaut `light` ou `dark` et dit à
   l'utilisateur si le texte des tuiles restera lisible par-dessus.

4. Lancez l'indexation :

   ```bash
   npm run library:index
   ```

   Le script écrit `public/library/index.json` (dimensions lues dans l'en-tête
   des fichiers, métadonnées reprises de `meta.json`) et fabrique les vignettes
   dans `<section>/thumbs/` avec **ffmpeg**, s'il est installé. Il liste en fin
   d'exécution les fichiers sans entrée dans `meta.json` : ce n'est pas une
   erreur, seulement un affichage appauvri.

5. Commitez `public/library/` **et** `index.json`, puis livrez normalement.

### Ce qu'il faut surveiller

**Le poids.** Chaque méga-octet ajouté est payé quatre fois : installeur
Windows, `.deb`, `.dmg`, archive du Pi. Un fond en 4K non compressé pèse 5 à
8 Mo ; le même en 1920 px de large, qualité 80, tourne autour de 400 Ko pour un
rendu identique sur un écran mural. Redimensionnez avant de déposer. Gardez le
lot livré autour d'une dizaine de fonds : le reste a sa place dans le catalogue
en ligne.

**Sans ffmpeg, pas de vignettes**, et la grille charge alors les images en
taille réelle — pénible sur un Raspberry Pi. Le script vous prévient.

**Les licences.** Ne livrez que des images dont vous détenez les droits ou qui
sont sous licence libre, et renseignez `author` et `license` : ils s'affichent
sous la vignette. PiBoard est publié sous licence MIT, une image sous licence
incompatible contaminerait le paquet.

### Le catalogue en ligne

Ce qui ne rentre pas dans le lot livré va dans `library-catalog.json`, à la
racine du dépôt, lu par PiBoard depuis la branche `main` :

```json
{
  "items": [
    {
      "section": "backgrounds",
      "file": "aurore-boreale.jpg",
      "url": "https://raw.githubusercontent.com/jihemezes/piboard/main/catalog/aurore-boreale.jpg",
      "thumb": "https://raw.githubusercontent.com/jihemezes/piboard/main/catalog/thumbs/aurore-boreale.jpg",
      "name": "Aurore boréale",
      "category": "nature",
      "tone": "dark",
      "author": "Prénom Nom",
      "license": "CC BY 4.0"
    }
  ]
}
```

Les images elles-mêmes peuvent vivre n'importe où en **https** — dans le dépôt,
dans une release, ailleurs. Le serveur vérifie le type de contenu et la taille
avant d'écrire, et refuse tout ce qui n'est pas une image.

Un catalogue mis à jour est visible par toutes les installations **sans
publier de version** : il est lu depuis `main`, avec un cache de six heures.
C'est le bon endroit pour ajouter des fonds entre deux livraisons.

---

## English

### Where images go

| Folder | Contents | Survives an update? |
|---|---|---|
| `public/library/<section>/` | The **shipped** lot, the one you prepare | No: it is *replaced* by the new version's — that is how it grows |
| `data/library/<section>/` | The **user's** additions | Yes, never touched |

Three sections: `backgrounds`, `logos`, `photos`. Accepted formats: `.jpg`,
`.jpeg`, `.png`, `.gif`, `.webp`, `.svg`.

### The procedure

1. Drop your files into `public/library/backgrounds/` (or `logos/`, `photos/`).
   Name them readably: with no entry in `meta.json`, the file name is the label
   (`starry-night.jpg` → "starry night").

2. **Let the script describe them** — the simplest route as soon as there are
   more than three images:

   ```bash
   npm run library:meta
   ```

   It fills each section's `meta.json` from the file names: `name` = the name
   without its extension, `category` = **the first part of the name**, before
   the first `_`, `-` or space (`Classy_Blue.png` → category "Classy"). That is
   therefore the naming convention to follow when dropping files in. The `tone`
   (light/dark) is not guessed but **measured**: ffmpeg shrinks the image to one
   pixel and that pixel's luminance decides — without ffmpeg the field is left
   empty rather than filled at random.

   Author and licence are passed as options and apply to the whole lot:

   ```bash
   npm run library:meta -- --author "Jean-Michel EZES" --license "CC BY 4.0"
   ```

   The script **never overwrites an existing entry**: run it again after every
   addition, your hand edits survive. `--force` rewrites everything, only to
   start over.

   The `source` field is left out on purpose: it only credits an image found
   elsewhere. For your own images there is nothing to point at — the interface
   shows only what exists.

3. Or describe them by hand in the section's `meta.json`. One entry per file,
   every field optional:

   ```json
   {
     "starry-night.jpg": {
       "name": "Starry night",
       "category": "nature",
       "tone": "dark",
       "author": "First Last",
       "license": "CC BY 4.0",
       "source": "https://example.org/photo"
     }
   }
   ```

   `category` is free-form (it feeds the interface's filter: use the same words
   from one image to the next). `tone` is `light` or `dark` and tells the user
   whether tile text will stay readable on top.

4. Run the indexing:

   ```bash
   npm run library:index
   ```

   The script writes `public/library/index.json` (dimensions read from the
   files' headers, metadata taken from `meta.json`) and makes the thumbnails in
   `<section>/thumbs/` with **ffmpeg**, when installed. It lists at the end the
   files with no `meta.json` entry: not an error, just a poorer display.

5. Commit `public/library/` **and** `index.json`, then release as usual.

### What to watch out for

**Weight.** Every megabyte added is paid for four times: Windows installer,
`.deb`, `.dmg`, Pi archive. An uncompressed 4K background weighs 5 to 8 MB; the
same at 1920 px wide, quality 80, sits around 400 KB for an identical result on
a wall screen. Resize before dropping in. Keep the shipped lot around ten
backgrounds: the rest belongs in the online catalogue.

**No ffmpeg, no thumbnails**, and the grid then loads images at full size —
painful on a Raspberry Pi. The script warns you.

**Licences.** Only ship images you own the rights to or that are freely
licensed, and fill in `author` and `license`: they show under the thumbnail.
PiBoard is released under the MIT licence, and an incompatibly licensed image
would contaminate the package.

### The online catalogue

What does not fit in the shipped lot goes into `library-catalog.json` at the
repository root, read by PiBoard from the `main` branch (see the French example
above for the shape). The images themselves may live anywhere over **https** —
in the repository, in a release, elsewhere. The server checks the content type
and the size before writing, and refuses anything that is not an image.

An updated catalogue is visible to every installation **without publishing a
version**: it is read from `main`, with a six-hour cache. That is the right
place to add backgrounds between two releases.
