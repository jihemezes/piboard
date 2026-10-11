# Captures d'écran de l'aide

Ce dossier accueille les captures d'écran optionnelles affichées dans
l'aide intégrée (voir `showHelpSection()` dans `app.js` et le champ
`screenshot` d'une section dans `help-content.js`).

## Comment en ajouter une

1. Placez un PNG ou JPG ici, nommé d'après l'identifiant du widget
   (ex. `weather.png` pour la tuile Météo).
2. Dans `public/help-content.js`, ajoutez `screenshot: "help-assets/weather.png"`
   à la section correspondante — juste après `title` ou `sub` suffit,
   l'ordre des champs n'a pas d'importance.
3. Rien d'autre à faire : `showHelpSection()` l'affiche automatiquement
   au-dessus du texte si le champ est présent, sans rien changer pour
   les sections qui n'en ont pas.

## Recommandations

- Largeur conseillée : 900-1200px (elle s'adapte ensuite à la largeur
  de la fenêtre d'aide, pas besoin de viser une taille exacte).
- Cadrez sur la tuile elle-même plutôt que sur tout le tableau de bord,
  pour rester lisible une fois réduite dans la fenêtre d'aide.
- Poids raisonnable (quelques centaines de Ko) : ces images sont
  servies depuis le Raspberry Pi lui-même.

## Captures déjà présentes

- `toolbar.png` — la barre d'outils du bas et ses sept icônes. Utilisée
  à DEUX endroits : la fiche d'aide « Barre d'outils & réglages » (via le
  champ `screenshot`) et le guide de démarrage rapide (référencée en dur
  dans `public/quickstart-content.js`, classe `.qs-shot`). Si vous la
  remplacez, vérifiez donc les deux rendus.
