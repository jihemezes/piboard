# Changelog

## 1.91.0

- **Tuile Logo/Image : le recadrage se fait desormais SUR l'image.**
  Regler le zoom et le cadrage par des champs numeriques revenait a
  travailler a l'aveugle : les valeurs saisies n'atteignaient l'image
  qu'apres enregistrement des reglages, si bien qu'on ne voyait pas ce
  qu'on faisait au moment ou on le faisait. En **mode edition**, la tuile
  porte maintenant :
  - **quatre poignees d'angle** : tirer en diagonale vers l'exterieur
    agrandit, vers l'interieur reduit ;
  - **le glissement sur l'image** pour la deplacer dans son cadre ;
  - **une petite barre d'outils** avec le zoom courant, deux boutons pas
    a pas et une remise a zero.

- **L'affichage suit le geste, l'enregistrement attend le relachement.**
  Ecrire le layout a chaque pixel parcouru aurait declenche des centaines
  d'ecritures pour un seul glissement ; l'image, elle, est remise en
  forme a chaque mouvement.

- **Deux details qui font tout** : glisser vers la droite fait venir la
  partie GAUCHE de l'image, comme lorsqu'on pousse une photo sous un
  cache -- l'inverse aurait paru casse. Et l'amplitude du deplacement
  depend du zoom : a 100 % l'image affleure exactement le cadre, il n'y a
  rien hors champ et le geste ne fait donc rien ; plus on zoome, moins un
  meme geste deplace le cadrage. Sans cette dependance, le recadrage
  aurait ete brutal a faible zoom et interminable a fort zoom. Le zoom
  par les angles est mis a l'echelle de la diagonale de la tuile, pour
  qu'un meme geste produise le meme effet sur une petite comme sur une
  grande tuile.

- **Gridstack demarre son glissement sur `mousedown`/`touchstart`** : ce
  sont ces evenements-la que la surcouche intercepte, en phase de
  capture, et non le seul `pointerdown`. Sans cela, glisser sur l'image
  aurait deplace la tuile sur la grille au lieu de recadrer.

- La surcouche n'apparait qu'en mode edition, et s'efface si le cadrage
  choisi n'est pas « Recadrer » : des poignees sans effet auraient
  menti. Les champs numeriques restent dans les reglages, pour poser une
  valeur exacte ou reproduire a l'identique le recadrage d'une autre
  tuile.

- **Tests** : `dom-smoke.js` couvre le sens du deplacement, sa symetrie,
  son absence d'effet a 100 %, sa decroissance quand le zoom augmente, le
  bornage du cadrage et du zoom, l'equivalence d'un geste proportionnel
  entre petite et grande tuile, ainsi que la presence des poignees, de la
  barre d'outils, de l'interception des evenements de Gridstack en phase
  de capture et de la separation affichage/enregistrement.

---

- **Logo/Image tile: cropping now happens ON the image.** Setting zoom
  and framing through numeric fields meant working blind: the typed
  values only reached the image once the settings were saved, so one
  could not see what one was doing while doing it. In **edit mode** the
  tile now carries:
  - **four corner handles**: pulling diagonally outwards enlarges,
    inwards reduces;
  - **dragging on the image** to move it within its frame;
  - **a small toolbar** with the current zoom, two step buttons and a
    reset.

- **The display follows the gesture, saving waits for release.** Writing
  the layout at every pixel travelled would have triggered hundreds of
  writes for a single drag; the image itself is re-laid out on every
  movement.

- **Two details that make it work**: dragging right brings in the LEFT
  part of the image, as when pushing a photo under a mask -- the
  opposite would have felt broken. And the pan amplitude depends on the
  zoom: at 100% the image exactly meets the frame, nothing is off-screen
  and the gesture therefore does nothing; the more you zoom, the less a
  same gesture moves the framing. Without that dependency, cropping would
  have been brutal at low zoom and interminable at high zoom. Corner
  zooming is scaled by the tile's diagonal, so a same gesture has the
  same effect on a small tile as on a large one.

- **Gridstack starts its drag on `mousedown`/`touchstart`**: those are
  the events the overlay intercepts, in the capture phase, not
  `pointerdown` alone. Without that, dragging on the image would have
  moved the tile on the grid instead of cropping.

- The overlay only appears in edit mode, and vanishes if the chosen
  framing is not "Crop": handles with no effect would have lied. The
  numeric fields stay in the settings, to set an exact value or to
  reproduce another tile's crop identically.

- **Tests**: `dom-smoke.js` covers the pan direction, its symmetry, its
  absence of effect at 100%, its decrease as zoom rises, the bounding of
  framing and zoom, the equivalence of a proportional gesture between
  small and large tiles, plus the presence of the handles, the toolbar,
  the capture-phase interception of Gridstack's events and the
  display/save separation.

## 1.90.1

- **Correctif majeur : en mode tableau de bord, aucune tuile des pages 2
  et suivantes ne pouvait etre deplacee ni redimensionnee.** Cause : le
  passage en mode edition deverrouillait deux listes de grilles -- le
  plateau principal et les tiroirs -- mais les grilles de PAGES, creees
  apres coup et une par page, ne figuraient dans aucune des deux. Elles
  restaient donc `staticGrid: true` en permanence. Aucun message, aucune
  erreur en console : les poignees ne repondaient simplement pas.

- **Deux autres oublis de la meme famille, corriges dans la foulee** :
  les grilles de pages n'etaient pas videes par `unmountAll()` -- leurs
  elements survivaient au rechargement du layout et les tuiles s'y
  seraient accumulees en double a chaque nouveau rendu -- et une page
  ajoutee PENDANT le mode edition naissait verrouillee, seule page figee
  de la session.

- **Cause commune, traitee a la racine** : trois endroits enumeraient les
  grilles a la main (`grid`, puis les tiroirs), et il fallait penser a
  chacun en ajoutant une zone. Ils passent desormais tous par une
  fonction unique `allGrids()`, qui balaie plateau, tiroirs ET pages --
  une zone ajoutee plus tard ne pourra plus etre oubliee a moitie.

- **Test** : `dom-smoke.js` verifie qu'en mode edition les grilles de
  pages sont deverrouillees comme le plateau, qu'elles se reverrouillent
  en sortie, et qu'une page creee en cours d'edition nait deverrouillee.
  Le test observe la classe `grid-stack-static` posee sur la grille
  plutot que `opts.staticGrid` : dans Gridstack 10.3.1, `setStatic()`
  bascule bien la classe -- qui commande reellement les poignees -- mais
  ne reecrit pas toujours l'option.

---

- **Major fix: in dashboard mode, no tile on page 2 or beyond could be
  moved or resized.** Cause: entering edit mode unlocked two lists of
  grids -- the main board and the drawers -- but the PAGE grids, created
  afterwards and one per page, were in neither. They therefore stayed
  `staticGrid: true` for good. No message, no console error: the handles
  simply did not respond.

- **Two other oversights of the same family, fixed along the way**: the
  page grids were not emptied by `unmountAll()` -- their items survived a
  layout reload and tiles would have piled up in duplicate on every new
  render -- and a page added WHILE in edit mode was born locked, the only
  frozen page of the session.

- **Common cause, treated at the root**: three places enumerated the
  grids by hand (`grid`, then the drawers), and each had to be remembered
  when adding a zone. They all now go through a single `allGrids()`
  function sweeping board, drawers AND pages -- a zone added later can no
  longer be half-forgotten.

- **Test**: `dom-smoke.js` checks that in edit mode the page grids are
  unlocked like the board, that they lock again on exit, and that a page
  created while editing is born unlocked. The test watches the
  `grid-stack-static` class set on the grid rather than
  `opts.staticGrid`: in Gridstack 10.3.1, `setStatic()` does toggle the
  class -- which actually drives the handles -- but does not always
  rewrite the option.

## 1.90.0

- **Tuile Logo/Image : recadrage.** Nouveau cadrage « Recadrer », qui
  s'ajoute aux quatre existants : l'image couvre la tuile, un **zoom**
  (100 a 500 %) l'agrandit, et deux **positions de recadrage**
  choisissent la partie qui reste visible. Les bords qui sortent de la
  tuile sont coupes. Utile pour garder un visage ou un logo dans le
  cadre plutot que le milieu de l'image.

- **Le fichier n'est jamais modifie.** Zoomer et deplacer ne changent que
  la partie affichee : on peut revenir en arriere a tout moment, et deux
  tuiles peuvent recadrer differemment la meme image. Rogner reellement
  le fichier aurait impose une etape de traitement d'image cote serveur
  et rendu l'operation irreversible -- pour un resultat visuellement
  identique.

- **Mise en oeuvre** : `object-fit: cover` couvre deja la tuile en
  rognant ce qui depasse et `object-position` choisit la partie
  conservee ; `transform: scale()` agrandit au-dela. L'origine du zoom
  est calee sur le MEME point de mire que la position, sans quoi le zoom
  partirait du centre et deplacerait le cadrage a chaque changement de
  zoom. Un zoom sous 100 % est ramene a 100 % : en dessous, l'image ne
  couvrirait plus la tuile et laisserait des bandes vides -- ce n'est
  plus un recadrage. Changer de cadrage **efface** les reglages de
  recadrage, sans quoi une image repassee en « Image entiere » serait
  restee zoomee.

- **Tests** : `dom-smoke.js` verifie que le point de mire pilote a la
  fois la partie conservee et l'origine du zoom, le bornage du zoom et
  des positions, la remise a zero au changement de cadrage, et que les
  trois nouveaux reglages precisent dans les deux langues qu'ils ne
  servent qu'au recadrage -- ce dernier controle a d'ailleurs attrape un
  intitule incomplet avant la livraison.

---

- **Logo/Image tile: cropping.** A new "Crop" framing joins the four
  existing ones: the image covers the tile, a **zoom** (100 to 500%)
  enlarges it, and two **crop positions** choose the part that stays
  visible. The edges leaving the tile are cut off. Useful to keep a face
  or a logo in frame rather than the middle of the picture.

- **The file is never modified.** Zooming and moving only change the
  displayed part: one can go back at any time, and two tiles may crop the
  same image differently. Actually cropping the file would have required
  a server-side image-processing step and made the operation
  irreversible -- for a visually identical result.

- **Implementation**: `object-fit: cover` already covers the tile by
  cropping the overflow and `object-position` picks the kept part;
  `transform: scale()` enlarges beyond that. The zoom's origin is pinned
  to the SAME focal point as the position, otherwise the zoom would start
  from the centre and shift the framing on every zoom change. A zoom
  below 100% is raised to 100%: under that the image would no longer
  cover the tile and would leave empty bands -- that is no longer
  cropping. Switching framing **clears** the crop settings, without which
  an image switched back to "Whole image" would have stayed zoomed.

- **Tests**: `dom-smoke.js` checks that the focal point drives both the
  kept part and the zoom's origin, the bounding of zoom and positions,
  the reset on framing change, and that the three new settings state in
  both languages that they only serve the crop -- that last check did
  catch an incomplete label before delivery.

## 1.89.0

- **Mode tableau de bord : defilement automatique des pages.** Un
  tableau mural n'a personne pour tourner ses pages : sans cela, les
  pages 2 et suivantes n'etaient jamais vues. La nouvelle option
  « Passer a la page suivante automatiquement » (reglages generaux ->
  Mode d'affichage) les fait defiler en boucle. **Desactivee par
  defaut** : un tableau qui se met a tourner tout seul sans qu'on l'ait
  demande serait deroutant.

- **La duree est reglable PAR PAGE**, avec une valeur generale par
  defaut. Une page dense (un tableau de valeurs) demande plus de temps de
  lecture qu'une page portant une grande horloge ; imposer la meme duree
  a toutes aurait rendu l'option inutilisable des que les pages ne se
  ressemblent pas. Le champ de chaque page reste vide tant qu'elle suit
  la duree generale, qui s'affiche alors en filigrane. Minimum 3
  secondes ; une valeur inferieure (ou un 0 saisi par erreur) est lue
  comme « pas de duree propre » plutot que corrigee en silence.

- **Le defilement se suspend tout seul** quand il generait : en mode
  edition (des tuiles sont en cours de deplacement, la page ne doit pas
  se derober), tant qu'une fenetre est ouverte (reglages, aide, details
  d'une tuile) et pendant une transition. L'etat est **revalide au
  moment d'avancer**, pas seulement au moment d'armer le minuteur : une
  fenetre ouverte pendant l'attente suspend donc bien le passage.

- **Il repart de zero apres toute navigation manuelle**, y compris un
  clic sur le numero de la page deja affichee -- c'est une facon de dire
  « je la regarde ». Quelqu'un qui vient de choisir une page ne doit pas
  la voir disparaitre une seconde plus tard.

- **Tests** : `dom-smoke.js` verifie l'arret par defaut, la presence d'un
  champ de duree par page avec la valeur generale en filigrane, le
  passage effectif a la page suivante apres le delai, l'absence de
  defilement tant qu'une fenetre est ouverte, et l'arret complet quand
  l'option est decochee. Le scenario leve explicitement le mode edition
  et le guide de demarrage avant de tester, puis **remet l'etat tel
  qu'il l'a trouve** -- les sections suivantes reposent dessus.

---

- **Dashboard mode: automatic page cycling.** A wall board has nobody to
  turn its pages: without this, pages 2 and beyond were never seen. The
  new "Move to the next page automatically" option (general settings ->
  Display mode) cycles them in a loop. **Off by default**: a board
  starting to cycle on its own without being asked would be baffling.

- **The duration is adjustable PER PAGE**, with a general default. A
  dense page (a table of figures) needs more reading time than one
  carrying a large clock; forcing the same duration on all of them would
  have made the option unusable as soon as pages differ. Each page's
  field stays empty while it follows the general duration, which then
  shows as a placeholder. Minimum 3 seconds; a lower value (or a 0 typed
  by mistake) reads as "no own duration" rather than being silently
  corrected.

- **Cycling suspends itself** whenever it would get in the way: in edit
  mode (tiles are being moved, the page must not slip away), while a
  window is open (settings, help, a tile's details) and during a
  transition. State is **revalidated at the moment of advancing**, not
  only when arming the timer: a window opened while waiting therefore
  does hold the advance back.

- **It restarts from zero after any manual navigation**, including a
  click on the already displayed page's number -- that is a way of
  saying "I am looking at it". Someone who just picked a page must not
  see it vanish a second later.

- **Tests**: `dom-smoke.js` checks the off-by-default state, the presence
  of a per-page duration field with the general value as a placeholder,
  the actual move to the next page after the delay, the absence of
  cycling while a window is open, and the complete stop when the option
  is unticked. The scenario explicitly clears edit mode and the quick
  start window before testing, then **restores the state as it found
  it** -- the following sections rely on it.

## 1.88.2

- **Tuile Logo/Image : l'aide situait mal le bouton.** Elle annoncait un
  bouton « Choisir une image » *ci-dessous*, dans le formulaire de
  reglages, alors qu'il s'affiche **dans la tuile elle-meme** tant
  qu'elle est vide. Le texte du champ et la fiche d'aide disent
  desormais ou il se trouve reellement.

- **Et surtout, il n'y avait plus de chemin du tout une fois l'image
  posee** : le bouton ne s'affiche que sur une tuile vide, et le
  formulaire de reglages ne contient qu'un champ texte portant le nom du
  fichier -- changer d'image obligeait donc a vider ce champ a la main.
  Un petit bouton apparait maintenant dans le coin de la tuile **en mode
  edition** et rouvre le gestionnaire. Il ne s'affiche qu'en edition :
  sur un tableau en fonctionnement, il n'aurait rien a faire par-dessus
  l'image.

- **Tailles de depart reduites de moitie** pour les deux tuiles de
  style : **Texte** demarre en 2x1 (au lieu de 4x1) et **Logo/Image** en
  2x2, base carree (au lieu de 3x2). Un titre court ou un logo n'ont
  aucune raison d'occuper le tiers de la largeur du tableau des leur
  creation, alors qu'on les place justement dans un coin. Le minimum
  reste d'une seule cellule dans les deux cas, et le maximum est
  inchange.

- **Tests** : `dom-smoke.js` verifie les tailles de depart (base carree
  pour l'image, surface reduite, jamais sous le minimum du manifeste),
  l'existence du bouton de changement et son affichage limite au mode
  edition, et que l'aide du champ ne situe plus le bouton « ci-dessous ».

---

- **Logo/Image tile: the help placed the button wrongly.** It announced a
  "Choose an image" button *below*, in the settings form, whereas it is
  shown **inside the tile itself** as long as it is empty. The field's
  text and the help page now say where it actually is.

- **And above all, there was no path at all once an image was set**: the
  button only appears on an empty tile, and the settings form only holds
  a text field carrying the file name -- changing the image therefore
  meant clearing that field by hand. A small button now appears in the
  tile's corner **in edit mode** and reopens the manager. It is only
  shown while editing: on a running board it would have no business
  sitting over the image.

- **Default sizes halved** for both style tiles: **Text** starts at 2x1
  (instead of 4x1) and **Logo/Image** at 2x2, a square base (instead of
  3x2). A short title or a logo have no reason to take a third of the
  board's width the moment they are created, when a corner is precisely
  where they get placed. The minimum stays a single cell in both cases,
  and the maximum is unchanged.

- **Tests**: `dom-smoke.js` checks the default sizes (square base for the
  image, reduced area, never below the manifest's own minimum), the
  existence of the change button and its display limited to edit mode,
  and that the field's help no longer places the button "below".

## 1.88.1

- **Correctif : lever et coucher invisibles dans la colonne « Demain ».**
  Cause : la ligne etait absente de la routine d'ajustement des tailles
  (`fit()`), qui dimensionne toutes les autres lignes de la tuile en
  fonction de la place disponible. Elle gardait donc une taille relative
  figee que rien ne reduisait ; dans la colonne « Demain » -- plus
  etroite et affectee en plus du facteur de compacite -- elle debordait
  du bloc centre et se retrouvait hors champ. Elle etait bien presente
  dans le document, simplement invisible. Elle est desormais
  dimensionnee comme les autres, et les deux heures peuvent passer a la
  ligne dans une colonne etroite (sans jamais couper une heure en deux).

- **Correctif : les icones du lever et du coucher etaient
  indiscernables.** Elles dessinaient le MEME demi-disque sur la MEME
  ligne d'horizon et ne differaient que par le sens d'une fleche de
  quelques pixels -- illisible a la taille ou ces pictogrammes
  s'affichent. Le lever utilise maintenant un **soleil rayonnant**, le
  coucher un **croissant de lune** : deux FORMES differentes, qui se
  lisent instantanement meme minuscules et de loin. Les fleches montante
  et descendante sont conservees, mais elles ne font plus que confirmer
  une lecture deja acquise au lieu de la porter a elles seules.

- **Correctif : l'icone des reglages du bandeau ressemblait a un
  soleil.** C'etait un cercle cerne de huit rayons DROITS -- exactement
  la confusion deja documentee pour l'icone de reglages des tuiles, ou
  un engrenage simplifie de la sorte se lit comme un soleil. Le bandeau
  reprend desormais le vrai engrenage lobe de la barre d'outils
  classique, garantissant au passage que les deux acces aux reglages
  generaux portent le meme pictogramme.

- **Tests** : `dom-smoke.js` verifie que les deux pictogrammes reposent
  sur des formes differentes et ne partagent aucun trajet identique
  (deux dessins ne differant que par une orientation echoueraient), que
  la ligne du soleil figure bien dans la routine d'ajustement au meme
  titre que les autres lignes, et que l'icone du bandeau est identique a
  celle de la barre d'outils.

---

- **Fix: sunrise and sunset invisible in the "Tomorrow" column.** Cause:
  the line was missing from the size-fitting routine (`fit()`), which
  sizes every other line of the tile according to the available room. It
  therefore kept a frozen relative size that nothing shrank; in the
  "Tomorrow" column -- narrower and additionally carrying the
  compactness factor -- it overflowed the centred block and ended up out
  of view. It was very much present in the document, merely invisible. It
  is now sized like the others, and the two times may wrap in a narrow
  column (without ever splitting a time in two).

- **Fix: the sunrise and sunset icons were indistinguishable.** They drew
  the SAME half-disc on the SAME horizon line and differed only by the
  direction of a few-pixel arrow -- unreadable at the size these
  pictograms are displayed. Sunrise now uses a **radiating sun**, sunset
  a **crescent moon**: two different SHAPES, read instantly even tiny and
  from a distance. The upward and downward arrows are kept, but they now
  merely confirm a reading already acquired instead of carrying it on
  their own.

- **Fix: the bar's settings icon looked like a sun.** It was a circle
  ringed by eight STRAIGHT rays -- exactly the confusion already
  documented for the tile settings icon, where a gear simplified that way
  reads as a sun. The bar now reuses the classic toolbar's real lobed
  gear, guaranteeing along the way that both paths to the general
  settings carry the same pictogram.

- **Tests**: `dom-smoke.js` checks that the two pictograms rest on
  different shapes and share no identical path (two drawings differing
  only by an orientation would fail), that the sun line does appear in
  the fitting routine like the other lines, and that the bar's icon is
  identical to the toolbar's.

## 1.88.0

- **Meteo : lever et coucher du soleil aussi sur demain.** Quand
  l'option est activee, la ligne apparait desormais sous les
  informations du jour ET sous celles de demain, quand la colonne de
  demain est affichee. Les donnees etaient deja la : la requete etendue
  demande sept jours, activer l'option n'ajoute donc **aucun appel
  reseau**. Un jour dont le fournisseur ne donne pas ces heures
  n'affiche pas de ligne, plutot qu'une ligne de tirets.
  Le balisage est produit par **un seul generateur** pour les deux jours :
  l'ecrire deux fois aurait garanti qu'une correction n'en atteigne
  qu'une moitie -- exactement ce qui s'est produit avec la couleur en
  1.87.1.

- **Bouton « Rechercher des mises a jour » toujours accessible.** Il
  etait enferme dans le bloc masque des que le serveur ne gere pas ses
  propres mises a jour -- c'est-a-dire dans l'application de bureau
  Windows, ou il est pourtant le seul chemin vers une verification
  manuelle depuis l'interface (le menu de l'application restait la seule
  possibilite). Il est desormais hors de ce bloc : sur le Pi il
  interroge GitHub depuis le serveur, dans l'application de bureau il
  declenche la recherche d'electron-updater, qui affiche ensuite sa
  propre fenetre. Le bouton d'installation, lui, reste masque dans
  l'application de bureau : c'est electron-updater qui installe.

- **Mise en oeuvre** : la nouvelle route `POST /api/update/check-desktop`
  (reservee aux requetes locales) passe par le **controleur de kiosque**
  deja en place -- le point de contact unique entre Electron et le reste
  du code -- plutot que par un pont IPC dedie, qui aurait ouvert un canal
  supplementaire entre la page et le processus principal pour une action
  dont le canal existait deja. Libelle du bouton precise : « Rechercher
  des mises a jour » au lieu de « Verifier maintenant ».

- **Tests** : `dom-smoke.js` verifie qu'un seul endroit compose la ligne
  du soleil et qu'elle est posee sur les deux jours, que le bouton de
  recherche n'est pas enferme dans le bloc serveur, qu'il reste visible
  et appelle bien la recherche de l'application de bureau quand le
  serveur ne gere pas ses mises a jour.

---

- **Weather: sunrise and sunset on tomorrow too.** When the option is on,
  the line now appears under today's information AND under tomorrow's,
  when the tomorrow column is shown. The data was already there: the
  extended request asks for seven days, so turning the option on adds
  **no network call**. A day whose provider does not give those times
  shows no line, rather than a line of dashes.
  The markup is produced by **one single generator** for both days:
  writing it twice would have guaranteed that a fix reaches only half of
  it -- exactly what happened with the colour in 1.87.1.

- **"Check for updates" button always reachable.** It was locked inside
  the block hidden as soon as the server does not handle its own updates
  -- that is, in the Windows desktop application, where it is
  nonetheless the only path to a manual check from the interface (the
  application menu remained the only option). It now sits outside that
  block: on the Pi it queries GitHub from the server, in the desktop
  application it triggers electron-updater's check, which then shows its
  own window. The install button stays hidden in the desktop
  application: electron-updater is what installs.

- **Implementation**: the new `POST /api/update/check-desktop` route
  (local requests only) goes through the **kiosk controller** already in
  place -- the single contact point between Electron and the rest of the
  code -- rather than a dedicated IPC bridge, which would have opened one
  more channel between the page and the main process for an action whose
  channel already existed. Button label clarified: "Check for updates"
  instead of "Check now".

- **Tests**: `dom-smoke.js` checks that a single place composes the sun
  line and that it is placed on both days, that the check button is not
  locked inside the server block, and that it stays visible and does call
  the desktop application's check when the server does not handle its
  updates.

## 1.87.1

- **Correctif : lever et coucher du soleil illisibles sur la tuile
  Meteo.** Cause : la ligne ajoutee en 1.86.0 ne declarait AUCUNE
  couleur. Elle heritait donc de la couleur de texte generale de la
  tuile, qui n'est pas celle des informations meteo -- ces dernieres
  utilisent `var(--faint)`. Selon le theme, une couleur de tuile
  personnalisee ou une photo de fond, le contraste pouvait devenir
  insuffisant. La ligne reprend desormais exactement la couleur de la
  ligne d'informations principale, et bascule en blanc avec ombre portee
  sur une photo de fond, comme les autres lignes. Ses selecteurs sont au
  passage cloisonnes sous `.pw-weather`, comme le reste du fichier.

- **Test** : `dom-smoke.js` compare la couleur declaree de la ligne du
  soleil a celle de la ligne d'informations principale et verifie le
  traitement sur photo de fond -- une regle de couleur absente ou
  divergente echoue desormais.

---

- **Fix: unreadable sunrise and sunset on the Weather tile.** Cause: the
  line added in 1.86.0 declared NO colour. It therefore inherited the
  tile's general text colour, which is not the weather information's --
  those use `var(--faint)`. Depending on the theme, a custom tile colour
  or a background photo, the contrast could become insufficient. The line
  now takes exactly the main information line's colour, and switches to
  white with a shadow over a background photo, like the other lines. Its
  selectors are namespaced under `.pw-weather` along the way, like the
  rest of the file.

- **Test**: `dom-smoke.js` compares the sun line's declared colour with
  the main information line's and checks the background-photo treatment
  -- a missing or diverging colour rule now fails.

## 1.87.0

- **NOUVEAU : mode tableau de bord.** Une seconde facon d'afficher
  PiBoard, choisie dans les reglages generaux (« Mode d'affichage ») --
  le mode classique reste le defaut et ne change en rien. En mode
  tableau de bord, plus de tiroirs ni de barre d'outils : une suite de
  pages qui se remplacent en glissant, et un fin bandeau au bas de
  l'ecran.

- **Le plateau existant devient la page 1**, sans migration ni recopie.
  Les pages suivantes vivent dans `layout.pages`. La page 1 n'est
  deliberement PAS recopiee dans ce tableau : elle y serait dupliquee,
  avec la certitude qu'un jour les deux copies divergent. Consequence
  voulue : basculer d'un mode a l'autre ne perd rien, et repasser en
  classique retrouve le plateau et ses tiroirs intacts -- les pages
  creees ne sont pas detruites pour autant.

- **Nombre de pages non limite.** Chaque page se regle dans les reglages
  generaux : nom, **sens** d'arrivee (gauche, droite, haut, bas) et
  **effet** (pousser, recouvrir, decouvrir, fondu, aucun). La transition
  appliquee est celle de la page QUI ARRIVE -- chaque page decrit la
  facon dont elle entre -- et revenir en arriere inverse
  automatiquement le sens. Depuis la derniere page, « suivant » revient
  a la premiere. Une tuile ajoutee pendant qu'une page est affichee
  atterrit sur CETTE page.

- **Bandeau du bas** : sort quand la souris atteint le bas de l'ecran,
  rentre apres un court delai quand elle s'en va (sans ce delai, il
  disparaitrait pendant le trajet du pointeur vers un bouton). **En mode
  tactile, une languette reste visible en permanence** : au doigt il n'y
  a pas de survol, et sans elle les reglages deviendraient inaccessibles.
  Il porte le reperage des pages, les fleches precedent/suivant et
  l'acces aux reglages, au catalogue, au mode edition et a l'aide. Une
  zone y est **deja reservee** pour les informations defilantes a venir
  (titres des flux RSS, a la maniere des chaines d'info en continu).
  Navigation aussi au **glissement du doigt** et aux **fleches du
  clavier**.

- **TOUTES les pages tournent en meme temps**, pas seulement celle
  affichee : une tuile Meteo en page 3 doit avoir ses donnees a jour
  quand la page arrive, pas commencer a les charger a ce moment-la.
  C'est le comportement attendu d'un tableau qui defile ; en
  contrepartie, ajouter des pages coute des ressources, et la
  planification horaire des tuiles reste disponible pour endormir ce qui
  doit l'etre. C'est dit dans l'aide.

- **Deux tuiles de STYLE**, nouvelle famille « Mise en page » du
  catalogue, utilisables dans les deux modes :
  - **Texte** : titre ou legende, avec police, graisse, italique,
    majuscules, espacement, couleur, position, ombre. La taille
    s'**adapte a la tuile** par defaut (recherche dichotomique sur le
    rendu reel, pas une formule : la hauteur depend de la police
    disponible, du retour a la ligne et de l'espacement) ou reste fixe.
    Chaque police liste plusieurs familles de repli -- un Raspberry Pi
    n'a pas celles d'un PC.
  - **Logo / Image** : image **stockee sur la machine PiBoard**, pas
    d'adresse externe. Le stockage reutilise l'API media du Diaporama :
    les fichiers vivent sous `data/`, jamais touche par les mises a jour
    et inclus dans les sauvegardes, et la tuile herite de ses controles
    (extensions, taille, noms assainis). Cadrage, position, marge,
    arrondi, opacite, lien optionnel -- un lien `javascript:` saisi dans
    le champ est refuse.

- **Fond de tuile transparent** (reglages universels d'apparence) : la
  tuile prend le fond de la page, sans cadre ni ombre. Pensee pour les
  deux tuiles de style, disponible sur toutes. En mode edition elle
  reste cernee d'un pointille, sans quoi elle serait impossible a saisir.

- **Correctif de fond** : `allTiles()` (server/internetHealth.js)
  balayait les objets porteurs d'un tableau `tiles`, or `layout.pages`
  est un TABLEAU d'objets -- une tuile posee sur une page 2 ou 3 serait
  restee invisible a toute lecture de configuration passant par la.

- **Aide reorganisee** : la section « Tuiles » du sommaire, une
  trentaine d'entrees a la file dans un ordre qui n'etait celui d'aucune
  autre partie de l'application, est desormais decoupee selon les MEMES
  familles que le catalogue d'ajout de tuiles. Une seule classification
  a apprendre, et la fiche se trouve la ou l'on avait trouve la tuile.
  Nouvelles fiches « Mode tableau de bord », « Texte » et
  « Logo / Image » ; guide de demarrage rapide mis a jour (FR/EN).

- **Correctif du harnais de test** : le faux serveur renvoyait au PUT des
  reglages les valeurs INITIALES au lieu de fusionner le corps recu,
  comme le fait le vrai serveur. Tout ce qui depend d'un reglage
  fraichement enregistre etait donc invisible aux tests.

---

- **NEW: dashboard mode.** A second way of displaying PiBoard, chosen in
  the general settings ("Display mode") -- classic mode stays the default
  and changes in no way. In dashboard mode there are no drawers and no
  toolbar: a series of pages replacing each other by sliding, and a thin
  bar at the bottom of the screen.

- **The existing board becomes page 1**, with no migration and no copy.
  Following pages live in `layout.pages`. Page 1 is deliberately NOT
  copied into that array: it would be duplicated there, with the
  certainty that one day the two copies diverge. Intended consequence:
  switching between modes loses nothing, and going back to classic finds
  the board and its drawers intact -- the created pages are not destroyed
  either.

- **Unlimited number of pages.** Each page is set up in the general
  settings: name, arrival **direction** (left, right, up, down) and
  **effect** (push, cover, uncover, fade, none). The applied transition
  is that of the INCOMING page -- each page describes how it enters --
  and going back automatically reverses the direction. From the last
  page, "next" returns to the first. A tile added while a page is
  displayed lands on THAT page.

- **Bottom bar**: comes out when the mouse reaches the bottom of the
  screen, goes back in after a short delay when it leaves (without that
  delay it would vanish while the pointer travels to a button). **In
  touch mode a tab stays permanently visible**: with a finger there is no
  hover, and without it the settings would become unreachable. It carries
  the page markers, the previous/next arrows and access to the settings,
  the catalog, edit mode and the help. A zone in it is **already
  reserved** for the scrolling information to come (RSS headlines, in the
  manner of rolling news channels). Navigation also by **finger swipe**
  and **keyboard arrows**.

- **ALL pages run at the same time**, not only the displayed one: a
  Weather tile on page 3 must have fresh data when the page arrives, not
  start loading then. That is the expected behaviour of a cycling board;
  in exchange, adding pages costs resources, and per-tile scheduling
  remains available to put to sleep whatever should be. This is stated in
  the help.

- **Two STYLE tiles**, a new "Page design" catalog family, usable in both
  modes:
  - **Text**: title or caption, with font, weight, italic, uppercase,
    spacing, colour, position, shadow. The size **fits the tile** by
    default (binary search on the real rendering, not a formula: the
    height depends on the available font, on wrapping and on spacing) or
    stays fixed. Each font lists several fallback families -- a Raspberry
    Pi does not have a PC's.
  - **Logo / Image**: image **stored on the PiBoard machine**, no
    external address. Storage reuses the Slideshow's media API: files
    live under `data/`, never touched by updates and included in backups,
    and the tile inherits its controls (extensions, size, sanitised
    names). Framing, position, margin, rounding, opacity, optional link
    -- a `javascript:` link typed into the field is refused.

- **Transparent tile background** (universal appearance settings): the
  tile takes the page's background, with no frame and no shadow. Designed
  for the two style tiles, available on all of them. In edit mode it
  stays outlined with a dashed border, without which it would be
  impossible to grab.

- **Underlying fix**: `allTiles()` (server/internetHealth.js) swept
  objects carrying a `tiles` array, but `layout.pages` is an ARRAY of
  objects -- a tile placed on page 2 or 3 would have stayed invisible to
  every config read going through there.

- **Reorganised help**: the sidebar's "Tiles" section, some thirty
  entries in a row in an order matching no other part of the application,
  is now split along the SAME families as the tile-adding catalog. One
  single classification to learn, and the page is found where the tile
  was found. New "Dashboard mode", "Text" and "Logo / Image" pages; quick
  start guide updated (FR/EN).

- **Test harness fix**: the fake server returned the INITIAL values to a
  settings PUT instead of merging the received body, as the real server
  does. Everything depending on a freshly saved setting was therefore
  invisible to the tests.

## 1.86.0

- **Correctif : le selecteur « Mises a jour a installer » etait
  invisible.** Cause : le champ avait ete place dans la section
  « Mises a jour », elle-meme masquee des que le serveur ne gere pas ses
  propres mises a jour -- ce qui est precisement le cas de
  l'application de bureau Windows (electron-updater s'en charge) et de
  macOS. Le reglage devenait donc introuvable la ou il s'applique
  pourtant. Desormais la section est **toujours affichee** : seuls les
  boutons « Verifier maintenant » et « Installer », propres au serveur,
  suivent l'etat de la plateforme, et une explication remplace l'aide
  serveur dans l'application de bureau.

- **Le canal choisi vaut aussi pour l'application de bureau Windows.**
  `electron/updater.js` lit le meme reglage et positionne
  `allowPrerelease` en consequence, **avant chaque verification** plutot
  qu'au demarrage : le changer prend effet sans relancer l'application.
  Une lecture impossible (fichier de reglages absent au tout premier
  lancement) retombe sur le canal stable, jamais sur les pre-versions.

- **Meteo : affichage optionnel du lever et du coucher du soleil** sur
  la tuile (nouveau reglage, desactive par defaut), avec une fleche
  montante et une fleche descendante. Les heures viennent de la requete
  etendue **deja effectuee** pour la fenetre de detail : activer
  l'option n'ajoute aucun appel reseau. Si cette requete n'a pas abouti
  (fournisseur « Personnalise » ne fournissant pas ces champs, panne
  passagere), la ligne est simplement omise plutot que d'afficher des
  tirets. Ces heures restent presentes dans la fenetre de detail quelle
  que soit l'option.

- **Tests** : `dom-smoke.js` verifie que le selecteur de canal reste
  visible quand le serveur ne gere pas ses mises a jour et que seuls les
  boutons serveur disparaissent -- exactement la regression corrigee ici ;
  aide FR/EN couverte par `helpContent.test.js`.

---

- **Fix: the "Updates to install" selector was invisible.** Cause: the
  field had been placed inside the "Updates" section, itself hidden as
  soon as the server does not handle its own updates -- which is exactly
  the case of the Windows desktop application (electron-updater does the
  job) and of macOS. The setting therefore became unreachable in the
  very place it applies. The section is now **always shown**: only the
  "Check now" and "Install" buttons, specific to the server, follow the
  platform state, and an explanation replaces the server help in the
  desktop application.

- **The chosen channel also governs the Windows desktop application.**
  `electron/updater.js` reads the same setting and sets `allowPrerelease`
  accordingly, **before every check** rather than at startup: changing it
  takes effect without restarting the application. An impossible read
  (settings file absent on the very first launch) falls back to the
  stable channel, never to pre-releases.

- **Weather: optional sunrise and sunset display** on the tile (new
  setting, off by default), with an up arrow and a down arrow. The times
  come from the extended request **already made** for the detail window:
  turning the option on adds no network call. If that request did not
  succeed (a "Custom" provider not supplying those fields, a passing
  outage), the line is simply omitted rather than showing dashes. Those
  times remain present in the detail window whatever the option.

- **Tests**: `dom-smoke.js` checks the channel selector stays visible
  when the server does not handle its updates and that only the server
  buttons disappear -- exactly the regression fixed here; FR/EN help
  covered by `helpContent.test.js`.

## 1.85.0

- **Choix du niveau des mises a jour** (reglages generaux -> Mises a
  jour, Raspberry Pi / Linux). Deux canaux, correspondant exactement aux
  etiquettes que GitHub propose au moment de publier une release :
  - **Versions stables uniquement** (defaut) : seule la release marquee
    « Latest » est proposee. Le defaut compte : une installation qui n'a
    jamais touche a ce reglage ne doit pas se retrouver a installer des
    versions d'essai.
  - **Installer aussi les pre-versions** : les releases marquees
    « Pre-release » le sont egalement.

- **Une pre-version est annoncee comme telle** dans le bandeau, dans
  l'etat des reglages et dans la fenetre de confirmation : on ne
  decouvre jamais apres coup qu'on installe une version d'essai.

- **Mise en oeuvre** (`server/selfUpdate.js`) : le canal stable
  interroge `/releases/latest`, ou GitHub filtre lui-meme brouillons et
  pre-releases ; le canal preview interroge `/releases` et retient la
  version la plus haute parmi les releases publiees. Deux precautions :
  les **brouillons** restent exclus dans les deux cas (pas d'archive
  telechargeable, visibles du seul auteur), et la selection se fait sur
  le **numero de version**, pas sur la date de publication -- republier
  un correctif ancien apres une pre-release plus recente ne doit pas
  faire reculer le tableau.

- Le reglage est **relu a chaque verification** : le changer prend effet
  sans redemarrer le serveur, et l'enregistrer relance immediatement une
  verification (sinon la version affichee viendrait encore de l'ancien
  canal). Cette verification n'est relancee que si le reglage a
  reellement change.

- **Tests** : `selfUpdate.test.js` (84 verifications) couvre les deux
  canaux sur une meme liste de releases, l'exclusion des brouillons, le
  choix par version et non par date, le canal fourni sous forme de
  fonction relu a la demande, et un depot sans aucune release publiee ;
  `dom-smoke.js` verifie le selecteur et la mention « Pre-version » dans
  l'interface ; aide FR/EN.

---

- **Update level choice** (general settings -> Updates, Raspberry Pi /
  Linux). Two channels, matching exactly the labels GitHub offers when
  publishing a release:
  - **Stable versions only** (default): only the release marked "Latest"
    is offered. The default matters: an installation that never touched
    this setting must not end up installing trial versions.
  - **Also install pre-releases**: releases marked "Pre-release" are
    offered too.

- **A pre-release is announced as such** in the banner, in the settings
  state and in the confirmation window: you never find out afterwards
  that you are installing a trial version.

- **Implementation** (`server/selfUpdate.js`): the stable channel queries
  `/releases/latest`, where GitHub itself filters drafts and
  pre-releases; the preview channel queries `/releases` and keeps the
  highest version among published releases. Two precautions: **drafts**
  stay excluded either way (no downloadable archive, visible only to
  their author), and the pick is made on the **version number**, not the
  publication date -- republishing an old fix after a more recent
  pre-release must not make the board go backwards.

- The setting is **re-read on every check**: changing it takes effect
  without restarting the server, and saving it immediately re-runs a
  check (otherwise the version shown would still come from the old
  channel). That check is only re-run if the setting actually changed.

- **Tests**: `selfUpdate.test.js` (84 checks) covers both channels over
  the same release list, draft exclusion, picking by version rather than
  date, the channel supplied as a function and re-read on demand, and a
  repo with no published release at all; `dom-smoke.js` checks the
  selector and the "Pre-release" mention in the interface; FR/EN help.

## 1.84.0

- **Axe des abscisses temporel sur TOUS les graphiques** : Etat systeme
  (CPU, GPU, RAM, disque), Cryptos, Bourse et Sante Internet. Jusqu'ici
  les courbes se lisaient sans aucun repere de temps : on voyait un
  creux sans pouvoir dire s'il datait de dix minutes ou de six heures.

- **Un module commun** (`public/chart-time-axis.js`), plutot que quatre
  implementations qui auraient donne quatre facons d'arrondir les heures
  et quatre formats de date. Deux principes :
  - Les graduations tombent sur des instants **ronds** (heure pleine,
    quart d'heure, minuit), jamais sur des divisions egales de la
    periode : diviser en cinq une fenetre de 47 minutes donnerait
    « 14:03, 14:12, 14:21… ». Le pas est choisi dans une echelle usuelle
    (1, 2, 5, 10, 15, 30 min ; 1, 2, 3, 6, 12 h ; 1, 2, 7 j ; puis par
    mois avec un pas de 1, 2, 3, 6, 12 ou 24 mois), et l'alignement se
    fait en heure **locale** : aligne en UTC, un pas de 6 h tomberait a
    02:00 et 08:00 dans un fuseau a +2.
  - Les etiquettes sont posees en **HTML sous le graphique**, pas dans le
    SVG : tous les graphiques utilisent `preserveAspectRatio="none"` et
    etireraient le texte horizontalement. Les traits verticaux, eux,
    restent dans le SVG -- une ligne verticale etiree reste droite.
  - Le format suit l'etendue affichee : heure et minute en deca d'une
    journee, jour de la semaine au-dela, date au-dela d'une semaine, mois
    et annee au-dela d'un an. Toujours dans la langue du tableau.

- **Sante Internet** : les deux bornes de la periode, seule indication de
  temps jusqu'ici, sont remplacees par l'axe complet -- un creux au
  milieu de « 24 h » etait impossible a dater.

- **Instants conserves cote serveur pour les cryptos** : Binance et
  CoinGecko fournissent tous deux l'instant de chaque point, qui etait
  **jete** a l'extraction (`server/cryptoBinance.js`, `server/crypto.js`).
  Il accompagne desormais les prix. Prix et instants sont filtres
  **ensemble** : filtrer les prix seuls les aurait desynchronises des la
  premiere bougie incomplete, decalant toute la courbe.

- **Bug attrape par les tests** : `Number("")` vaut `0`, et Binance
  renvoie une chaine **vide** pour la cloture d'une bougie qui vient de
  s'ouvrir. Ce champ devenait donc un prix de 0 et la courbe plongeait a
  zero sur son dernier point. Les deux extracteurs exigent maintenant une
  valeur non vide. (Meme piege que celui corrige en 1.83.0 sur le GPU.)

- **Etat systeme** : l'historique client garde desormais l'instant de
  chaque releve, et les series filtrees (disque, GPU, qui peuvent avoir
  moins de points que le CPU) gardent leurs propres instants -- sans quoi
  l'axe aurait ete decale sur ces deux onglets.

- **Tests** : `dom-smoke.js` couvre l'alignement sur des instants ronds a
  toutes les echelles (2 h, 24 h, 5 j, 30 j, 2 ans, 10 ans), la densite
  bornee des etiquettes, l'alignement en heure locale, les cas degrades
  (periode nulle, inversee, non numerique), le recalage des etiquettes de
  bord, l'echappement du texte, et verifie que les quatre widgets
  utilisent bien le module commun ; `cryptoBinance.test.js` verifie que
  les instants accompagnent les prix et que le filtrage conjoint ne les
  desynchronise pas.

---

- **Time X axis on EVERY chart**: System status (CPU, GPU, RAM, disk),
  Crypto, Stocks and Internet health. Until now the curves were read
  with no time reference at all: you saw a dip with no way to tell
  whether it was ten minutes or six hours old.

- **One shared module** (`public/chart-time-axis.js`), rather than four
  implementations that would have given four ways of rounding hours and
  four date formats. Two principles:
  - Ticks land on **round** instants (whole hour, quarter, midnight),
    never on equal divisions of the period: splitting a 47-minute window
    into five would give "14:03, 14:12, 14:21…". The step is picked from
    a usual ladder (1, 2, 5, 10, 15, 30 min; 1, 2, 3, 6, 12 h; 1, 2, 7 d;
    then monthly with a 1, 2, 3, 6, 12 or 24-month stride), and alignment
    happens in **local** time: aligned in UTC, a 6 h step would land on
    02:00 and 08:00 in a +2 zone.
  - Labels are laid out in **HTML below the chart**, not inside the SVG:
    every chart uses `preserveAspectRatio="none"` and would stretch the
    text horizontally. Vertical lines do stay in the SVG -- a stretched
    vertical line is still straight.
  - The format follows the displayed span: hour and minute below a day,
    weekday beyond, date beyond a week, month and year beyond a year.
    Always in the board's language.

- **Internet health**: the period's two bounds, the only time indication
  so far, are replaced by the full axis -- a dip in the middle of "24 h"
  was impossible to date.

- **Times kept server-side for crypto**: Binance and CoinGecko both
  supply each point's time, which was **thrown away** during extraction
  (`server/cryptoBinance.js`, `server/crypto.js`). It now travels with
  the prices. Prices and times are filtered **together**: filtering
  prices alone would have desynchronised them at the first incomplete
  candle, offsetting the whole curve.

- **Bug caught by the tests**: `Number("")` is `0`, and Binance returns
  an **empty** string for the close of a candle that has just opened.
  That field therefore became a price of 0 and the curve dived to zero on
  its last point. Both extractors now require a non-empty value. (The
  same trap as the one fixed in 1.83.0 on the GPU.)

- **System status**: the client history now keeps each reading's time,
  and the filtered series (disk, GPU, which may hold fewer points than
  the CPU) keep their own times -- otherwise the axis would have been
  offset on those two tabs.

- **Tests**: `dom-smoke.js` covers alignment on round instants at every
  scale (2 h, 24 h, 5 d, 30 d, 2 years, 10 years), bounded label density,
  local-time alignment, degraded cases (zero, inverted, non-numeric
  period), edge-label pull-in, text escaping, and checks all four widgets
  do use the shared module; `cryptoBinance.test.js` checks times travel
  with prices and that joint filtering does not desynchronise them.

## 1.83.0

- **Etat systeme : charge du GPU**, barre au meme titre que le CPU et la
  RAM, avec la temperature de la carte dans le libelle quand la source
  la fournit, et **courbe optionnelle** (reglage « Courbe d'utilisation
  du GPU » : decoche, la barre reste mais n'est plus cliquable et
  l'onglet GPU disparait de la fenetre des courbes).

- **Sources, par plateforme** (`gpuUsage()` ajoute aux trois
  implementations de `server/platform/`) :
  - Linux : `/sys/class/drm/cardN/device/gpu_busy_percent` (amdgpu,
    simple lecture de fichier, aucun processus lance), sinon
    `nvidia-smi` en sortie CSV. La frequence Intel
    (`gt_act_freq_mhz`) n'est PAS utilisee : ce n'est pas une charge, la
    convertir en pourcentage serait une invention.
  - Windows : `nvidia-smi`, sinon les compteurs de performance
    « GPU Engine » (universels depuis Windows 10). Windows publie un
    compteur par moteur ET par processus : la charge de la carte est la
    SOMME des moteurs 3D et Compute, les moteurs Copy et VideoDecode
    etant volontairement ecartes (une simple lecture video les fait
    monter tres haut sans que la carte travaille). Le jeu de compteurs
    est designe par son identifiant numerique, invariable d'une langue
    de Windows a l'autre.
  - macOS : null assume (`powermetrics` exige les droits root).

- **Sur un Raspberry Pi, la ligne reste masquee.** Le VideoCore n'expose
  nulle part son taux d'occupation -- `vcgencmd` donne des temperatures
  et des frequences, jamais un pourcentage. Afficher « GPU 0 % »
  laisserait croire a un GPU au repos alors que rien n'est mesure :
  l'absence de ligne est la seule reponse honnete.

- **Mise en cache de quatre secondes, partagee par tous les ecrans.**
  Contrairement au CPU (lecture d'un fichier systeme, gratuite), lire la
  charge du GPU lance un processus : sans cache, trois tuiles sur trois
  ecrans en lanceraient des dizaines par minute pour un chiffre
  identique.

- **Historique** : nouveau champ `g` dans les points echantillonnes
  chaque minute. Les points enregistres par les versions precedentes
  n'en ont pas et sont ecartes a la lecture -- la courbe GPU demarre
  donc a la mise a jour, plutot que de plonger a zero sur tout le passe.

- **Bug attrape par les tests** : `Number("")` vaut `0` et non `NaN`, si
  bien qu'un fichier `gpu_busy_percent` vide ou tronque se serait lu
  comme un GPU parfaitement au repos. Le parseur exige desormais une
  suite de chiffres.

- **Tests** : nouveau `test/gpu.test.js` (parseurs des trois
  plateformes verifiables depuis un Pi sans carte graphique : sortie
  CSV nvidia-smi complete et partielle, plusieurs cartes, fichier
  amdgpu, compteurs Windows avec somme des moteurs 3D/Compute,
  exclusion de VideoDecode, plafonnement a 100 %, formes JSON objet et
  tableau) ; `dom-smoke.js` couvre la regle d'affichage (aucune ligne
  sans mesure reelle, 0 % affiche, options), le rendu de la ligne et
  l'historique ; `platform.test.js` verifie que les trois
  implementations exposent `gpuUsage`.

---

- **System status: GPU load**, a bar alongside CPU and RAM, with the
  card's temperature in the label when the source provides it, and an
  **optional chart** ("GPU usage chart" setting: unticked, the bar stays
  but is no longer clickable and the GPU tab disappears from the charts
  window).

- **Sources, per platform** (`gpuUsage()` added to all three
  `server/platform/` implementations):
  - Linux: `/sys/class/drm/cardN/device/gpu_busy_percent` (amdgpu, a
    plain file read, no process spawned), otherwise `nvidia-smi` with
    CSV output. Intel's frequency (`gt_act_freq_mhz`) is NOT used: it is
    not a load, turning it into a percentage would be making things up.
  - Windows: `nvidia-smi`, otherwise the "GPU Engine" performance
    counters (universal since Windows 10). Windows publishes one counter
    per engine AND per process: the card's load is the SUM of the 3D and
    Compute engines, with Copy and VideoDecode deliberately excluded
    (plain video playback sends them very high without the card really
    working). The counter set is designated by its numeric id, invariant
    across Windows languages.
  - macOS: null by design (`powermetrics` requires root).

- **On a Raspberry Pi the row stays hidden.** The VideoCore exposes its
  occupancy nowhere -- `vcgencmd` gives temperatures and frequencies,
  never a percentage. Showing "GPU 0%" would suggest an idle GPU when
  nothing is measured: no row at all is the only honest answer.

- **Four-second cache, shared by every screen.** Unlike the CPU (a free
  system file read), reading GPU load spawns a process: without a cache,
  three tiles on three screens would spawn dozens a minute for an
  identical figure.

- **History**: new `g` field in the points sampled every minute. Points
  recorded by previous versions have none and are dropped when read --
  the GPU curve therefore starts at the update rather than diving to
  zero across all the past.

- **Bug caught by the tests**: `Number("")` is `0`, not `NaN`, so an
  empty or truncated `gpu_busy_percent` file would have read as a
  perfectly idle GPU. The parser now requires a run of digits.

- **Tests**: new `test/gpu.test.js` (all three platforms' parsers
  verifiable from a Pi with no graphics card: full and partial
  nvidia-smi CSV, several cards, amdgpu file, Windows counters with the
  3D/Compute sum, VideoDecode exclusion, 100% cap, both JSON object and
  array shapes); `dom-smoke.js` covers the display rule (no row without
  a real reading, 0% shown, options), row rendering and history;
  `platform.test.js` checks all three implementations expose `gpuUsage`.

## 1.82.0

- **Etat systeme : le rouge n'est plus la couleur de l'usage normal.**
  Cause : les barres CPU/RAM/disque et les courbes utilisaient
  `var(--accent)`, la couleur d'accent du theme (#D6335C, un rouge
  framboise), pour l'etat NORMAL -- seuls les niveaux eleve (ambre) et
  critique (rouge) changeaient de couleur. Un Pi au repos avait donc
  l'air en surchauffe. Desormais trois couleurs par niveau, toutes
  reglables : normal (vert #3FA96B), eleve (ambre #E0A63C), critique
  (rouge #E0556F) -- **le rouge est reserve au niveau critique**.

- **Seuils et couleurs personnalisables** (nouvelle section « Couleurs &
  seuils » des reglages de la tuile) : seuil « eleve » (65 % par
  defaut) et « critique » (85 %), couleurs des trois niveaux, couleur
  des courbes (bleu #5B8DEF par defaut) et option « la couleur des
  courbes suit le niveau d'utilisation actuel ». Le chiffre courant en
  tete de la fenetre des courbes prend toujours la couleur de son
  niveau. Un seuil critique place sous le seuil eleve est aligne dessus
  plutot qu'ignore ; une couleur ou un seuil invalide retombe sur la
  valeur par defaut.

- **Adresse IP publique** (option, desactivee par defaut) : l'adresse
  sous laquelle le reseau local apparait sur Internet, affichee parmi
  les adresses reseau de la tuile et dans l'en-tete de la fenetre de
  configuration reseau. Obtenue **cote serveur** (`server/publicIp.js`,
  route `GET /api/public-ip`) aupres de trois services independants
  essayes a tour de role (ipify, icanhazip, ifconfig.me), avec cache de
  dix minutes : un seul appel pour tous les ecrans. Si le service est
  injoignable, la derniere adresse connue reste affichee, attenuee et
  signalee perimee, plutot qu'un vide. `?refresh=1` force une nouvelle
  interrogation.

- **Tests** : nouveau `test/publicIp.test.js` (analyse texte/JSON, repli
  entre services, cache, adresse conservee apres echec) ; `dom-smoke.js`
  verifie les couleurs par defaut (vert normal, rouge reserve au
  critique), les seuils, les personnalisations, l'alignement des seuils
  croises, le rendu inline des barres, l'absence de `var(--accent)`
  dans le widget, et l'IP publique masquee/affichee/perimee ; aide FR/EN
  couverte par `helpContent.test.js`.

---

- **System status: red is no longer the normal-usage color.** Cause:
  the CPU/RAM/disk bars and the charts used `var(--accent)`, the theme's
  accent color (#D6335C, a raspberry red), for the NORMAL state -- only
  the high (amber) and critical (red) levels changed color. An idle Pi
  therefore looked like it was overheating. Now three colors by level,
  all adjustable: normal (green #3FA96B), high (amber #E0A63C), critical
  (red #E0556F) -- **red is reserved for the critical level**.

- **Adjustable thresholds and colors** (new "Colors & thresholds"
  section in the tile's settings): "high" threshold (65% by default)
  and "critical" (85%), the three level colors, chart color (blue
  #5B8DEF by default) and a "chart color follows the current usage
  level" option. The current figure at the top of the charts window
  always takes its level color. A critical threshold placed below the
  high one is aligned to it rather than ignored; an invalid color or
  threshold falls back to the default.

- **Public IP address** (option, off by default): the address the local
  network presents on the Internet, shown among the tile's network
  addresses and in the network configuration window's header. Obtained
  **server-side** (`server/publicIp.js`, `GET /api/public-ip`) from three
  independent services tried in turn (ipify, icanhazip, ifconfig.me),
  with a ten-minute cache: a single call for every screen. If the
  service is unreachable, the last known address stays shown, dimmed and
  flagged stale, rather than a blank. `?refresh=1` forces a new query.

- **Tests**: new `test/publicIp.test.js` (text/JSON parsing, fallback
  across services, cache, address kept after failure); `dom-smoke.js`
  checks the default colors (green normal, red reserved for critical),
  thresholds, customisations, crossed-threshold alignment, inline bar
  rendering, absence of `var(--accent)` in the widget, and the public IP
  hidden/shown/stale; FR/EN help covered by `helpContent.test.js`.

## 1.81.0

- **NOUVEAU : mise a jour automatique sur Raspberry Pi et Linux**
  (Debian, Ubuntu, ZorinOS...), comme pour l'application Windows. Le
  serveur interroge les versions publiees sur GitHub une vingtaine de
  secondes apres son demarrage puis toutes les six heures ; une nouvelle
  version fait apparaitre un bandeau discret en haut de l'ecran
  (« Mettre a jour » / « Plus tard ») et une section « Mises a jour »
  dans les reglages generaux (« Verifier maintenant », « Installer »).
  Rien n'est jamais installe sans confirmation. Seules les releases
  effectivement publiees comptent (brouillons et pre-versions ignores),
  exactement comme electron-updater sous Windows.

- **Comment ca marche** (`server/selfUpdate.js`) : l'archive tar.gz du
  tag est telechargee dans `data/updates/`, extraite, puis mise en place
  par **renommage** -- chaque entree de premier niveau de l'ancienne
  version est deplacee dans `data/updates/previous/` avant que la
  nouvelle prenne sa place. Consequence voulue : les fichiers supprimes
  d'une version a l'autre disparaissent reellement (un dossier `server/`
  entier est remplace, pas fusionne), contrairement a un ZIP decompresse
  par-dessus. Un manifeste retient les entrees installees pour retirer,
  a la mise a jour suivante, un dossier disparu en amont.
  `npm install --omit=dev` n'est lance **que si `package-lock.json` a
  change** : un correctif de code s'installe en quelques secondes, sans
  reseau npm et meme sans `npm` (absent d'un `apt install nodejs`
  Debian). Si npm echoue, **retour arriere automatique** : la version
  precedente est remise en place et le serveur continue sans redemarrer.
  `data/`, `node_modules/` et `.git/` ne sont jamais touches.

- **Redemarrage** : sous systemd, le processus sort avec un code non nul
  pour que `Restart=on-failure` du service existant le relance -- il n'a
  pas le droit d'appeler `systemctl` (`NoNewPrivileges=true`). Lance a
  la main, il demarre un remplacant avant de quitter. Le tableau de bord
  ne se recharge que lorsque `/api/version` repond avec une version
  **differente** : un serveur revenu avec la meme version, ou absent
  apres 180 s, produit un message explicite plutot qu'un rechargement
  sur l'ancien code. Un kiosque qui n'a pas lance la mise a jour (faite
  depuis un telephone du reseau) se recharge tout seul via le SSE.

- **Couche plateforme** : `updateSupport()` et `restartServer()` ajoutes
  aux trois implementations. Dans l'application de bureau (controleur
  de kiosque Electron enregistre), la mise a jour serveur est declaree
  non supportee quelle que soit la plateforme : electron-updater reste
  seul maitre sous Windows.

- **Routes** : `GET /api/update/status`, `POST /api/update/check`,
  `POST /api/update/apply`. Accessibles depuis le reseau local (pas
  reservees a localhost) : mettre a jour un kiosque mural sans clavier
  depuis un autre appareil est l'un des usages vises, et le code
  installe est toujours celui de la release officielle. Variables :
  `PIBOARD_UPDATE_CHECK=0` desactive la verification periodique,
  `PIBOARD_UPDATE_REPO` vise un fork.

- **Aide** : nouvelle fiche « Mises a jour sur Raspberry Pi / Linux »
  (FR/EN) ; groupe d'aide renomme « Plateformes & donnees » ;
  `INSTALL.md` reecrit sur la mise a jour.

- **Tests** : nouveau `test/selfUpdate.test.js` (69 verifications) qui
  joue le cycle entier contre un faux GitHub HTTP, un faux npm et une
  archive tar.gz fabriquee : detection, installation, npm ignore ou
  appele, retour arriere, archive de mauvaise version refusee,
  manifeste. `platform.test.js`, `helpContent.test.js` et
  `dom-smoke.js` (829 assertions : bandeau, reglages, confirmation,
  progression, attente du redemarrage) etendus.

---

- **NEW: automatic updates on Raspberry Pi and Linux** (Debian, Ubuntu,
  ZorinOS...), like the Windows application. The server looks up the
  versions published on GitHub about twenty seconds after starting,
  then every six hours; a new version shows a discreet banner at the
  top of the screen ("Update" / "Later") and an "Updates" section in
  general settings ("Check now", "Install"). Nothing is ever installed
  without confirmation. Only actually published releases count (drafts
  and pre-releases ignored), exactly like electron-updater on Windows.

- **How it works** (`server/selfUpdate.js`): the tag's tar.gz archive
  is downloaded into `data/updates/`, extracted, then put in place by
  **rename** -- every top-level entry of the old version is moved into
  `data/updates/previous/` before the new one takes its place. Intended
  consequence: files removed between versions really disappear (a whole
  `server/` folder is replaced, not merged), unlike a ZIP extracted on
  top. A manifest remembers installed entries so a folder gone upstream
  is removed at the next update. `npm install --omit=dev` runs **only
  if `package-lock.json` changed**: a code-only fix installs in seconds,
  with no npm network and even without `npm` (missing from a Debian
  `apt install nodejs`). If npm fails, **automatic rollback**: the
  previous version is put back and the server keeps running without a
  restart. `data/`, `node_modules/` and `.git/` are never touched.

- **Restart**: under systemd, the process exits with a non-zero code so
  the existing service's `Restart=on-failure` brings it back -- it is
  not allowed to call `systemctl` (`NoNewPrivileges=true`). Started by
  hand, it spawns a replacement before quitting. The dashboard only
  reloads once `/api/version` answers with a **different** version: a
  server back with the same version, or absent after 180 s, yields an
  explicit message rather than a reload on the old code. A kiosk that
  didn't start the update (done from a phone on the LAN) reloads by
  itself through SSE.

- **Platform layer**: `updateSupport()` and `restartServer()` added to
  all three implementations. Inside the desktop application (Electron
  kiosk controller registered), server-side updating is declared
  unsupported whatever the platform: electron-updater stays in sole
  charge on Windows.

- **Routes**: `GET /api/update/status`, `POST /api/update/check`,
  `POST /api/update/apply`. Reachable from the LAN (not localhost-only):
  updating a keyboard-less wall kiosk from another device is one of the
  intended uses, and the installed code is always the official release.
  Variables: `PIBOARD_UPDATE_CHECK=0` disables the periodic check,
  `PIBOARD_UPDATE_REPO` targets a fork.

- **Help**: new "Updates on Raspberry Pi / Linux" topic (FR/EN); help
  group renamed "Platforms & data"; `INSTALL.md` update section
  rewritten.

- **Tests**: new `test/selfUpdate.test.js` (69 checks) playing the whole
  cycle against a fake GitHub HTTP server, a fake npm and a built
  tar.gz archive: detection, install, npm skipped or run, rollback,
  wrong-version archive refused, manifest. `platform.test.js`,
  `helpContent.test.js` and `dom-smoke.js` (829 assertions: banner,
  settings, confirmation, progress, restart wait) extended.

## 1.80.1

- **CORRIGE : la section d'aide francaise sur les sports mecaniques,
  ajoutee en 1.80.0, se trouvait sous la mauvaise fiche.** Elle avait
  ete inseree dans la fiche « Scores en direct » au lieu de la fiche
  « Classement ». Cause : l'ancre d'insertion (un intitule d'option
  « Competition ») existe a l'identique dans les deux fiches, et la
  premiere occurrence rencontree appartenait a la fiche voisine. La
  version anglaise, elle, etait au bon endroit -- ce qui rendait
  l'incoherence invisible tant qu'on ne comparait pas les deux langues.

- **Aide completee** pour les deux dernieres versions :
  - Classement : nouvelle section « Lire le tableau » (FR/EN)
    expliquant chaque colonne (J G N P Diff %V Pts), le fait que les
    points restent toujours affiches quand la tuile est etroite, et la
    colonne des victoires en F1/MotoGP.
  - Classement : les descriptions des options « Competition » et « Code
    ESPN personnalise » precisent desormais que les championnats F1 et
    MotoGP figurent dans la liste, et que remplir le code personnalise
    reprend la main sur eux.
  - Analyse reseau : le renommage des appareils apparait maintenant
    aussi dans la liste des options de la fiche, avec le rappel qu'il se
    fait sur la tuile et non dans les reglages.

- **Nouveau `test/helpContent.test.js`.** L'aide n'etait couverte que
  par son mecanisme d'affichage, pas par son contenu. Le test verifie
  desormais : parite FR/EN de toutes les fiches (avec detection d'un
  desequilibre de volume, symptome d'une section ajoutee d'un seul
  cote), presence effective des fonctionnalites des 1.79.0 et 1.80.0
  dans les deux langues, et surtout **exclusivite** -- une section
  caracteristique ne doit apparaitre que dans sa propre fiche et dans le
  bloc de sa propre langue. C'est precisement ce controle qui aurait
  attrape le defaut ci-dessus ; sa capacite a le detecter a ete verifiee
  en le reintroduisant volontairement.

## 1.80.0

- **CORRIGE : la colonne des points manquait en Ligue 1 et en Top 14.**
  Le tableau affichait le rang, les matchs gagnes/nuls/perdus et le
  pourcentage, mais pas les points -- l'information centrale d'un
  classement. Cause : la selection des colonnes ne comparait qu'au champ
  `abbreviation` d'ESPN, en cherchant litteralement "PTS". Or ESPN
  n'abrege pas les points de la meme facon selon le sport : "PTS" en
  NBA, mais simplement "P" au football et au rugby. La colonne n'etait
  donc jamais reconnue pour ces competitions ; et comme le code se
  limitait par ailleurs aux quatre premieres colonnes trouvees,
  l'affichage retombait exactement sur G / N / P / %V.
  La correspondance s'appuie desormais en priorite sur le champ `name`,
  stable d'un sport a l'autre chez ESPN ("points", "gamesPlayed",
  "wins"), l'abreviation ne servant plus que de repli -- et jamais pour
  le "P" isole, ambigu par nature. Les points sont en outre exemptes du
  plafond de colonnes : ils ne peuvent plus etre la statistique
  sacrifiee quand la place manque.

- **Colonnes dans l'ordre conventionnel** d'un tableau de championnat
  (J G N P Diff Pts) au lieu de l'ordre d'apparition dans la reponse, et
  balayage de toutes les lignes pour determiner les colonnes -- une
  equipe promue a qui une statistique manque n'ampute plus le tableau
  entier.

- **NOUVEAU : classements Formule 1 et MotoGP**, pilotes et equipes,
  ajoutes a la liste des competitions :
  - **F1 pilotes** et **F1 constructeurs** via api.jolpi.ca (reprise
    maintenue de l'API Ergast), deja utilisee par la tuile Sports
    mecaniques. Victoires affichees a cote des points, ecurie du pilote
    rappelee sous son nom. Repli automatique sur la saison precedente en
    debut d'annee civile, tant que la nouvelle saison n'a pas de
    classement.
  - **MotoGP pilotes** via le flux public de motogp.com. Le classement
    exige deux identifiants prealables (UUID de saison puis UUID de
    categorie) : trois appels en cascade, comme le fait le site
    lui-meme.
  - **MotoGP equipes** : le flux public ne publie que le classement
    pilotes. Le total par equipe est donc CALCULE en additionnant les
    points de ses pilotes, ce que la tuile indique explicitement sous le
    tableau. Le resultat correspond au classement officiel tant qu'une
    ecurie n'aligne que ses deux titulaires ; un remplacant ou une wild
    card peut creer un ecart.

- **Refonte interne du widget** : les trois familles de sources
  alimentent desormais un modele de tableau unique, l'affichage ignorant
  completement la provenance des donnees. Echappement HTML applique a
  toutes les valeurs affichees, y compris les noms venant des API.

- **Tests.** Nouveau `test/standingsColumns.test.js` (11 blocs) :
  reconnaissance des points quelle que soit l'abreviation, refus de
  deviner un "P" isole, non-regression NBA, ordre conventionnel des
  colonnes, survie des points au plafonnement, balayage de toutes les
  lignes, et reformatage du pourcentage americain ".692" en "69.2%".

## 1.79.0

- **NOUVEAU : noms personnalises des appareils dans la tuile Analyse
  reseau.** L'analyse remonte toujours une adresse IP et, le plus
  souvent, une adresse MAC, mais le nom d'hote est frequemment absent
  (telephones Android, objets connectes) ou illisible
  ("DESKTOP-4K7J1QA"). Chaque ligne de la liste porte desormais un
  bouton de renommage : on saisit le nom voulu ("Imprimante bureau",
  "Chaudiere"), on valide, c'est fini. Vider le champ puis valider
  supprime le nom personnalise et redonne le nom detecte
  automatiquement.

  - **Cle = adresse MAC, pas adresse IP.** Le nom est associe a
    l'adresse MAC de l'appareil des qu'elle est connue. Une IP change a
    chaque nouveau bail DHCP ; un nom rattache a l'IP se serait retrouve
    sur le mauvais appareil au premier redemarrage du routeur. Repli sur
    l'IP uniquement pour les hotes repérés par le seul ping, sans entree
    ARP exploitable.

  - **Normalisation des adresses MAC.** Les tables ARP des trois
    plateformes ne s'accordent ni sur la casse (Windows en majuscules,
    Linux en minuscules) ni sur le separateur ("-" contre ":"), et
    macOS omet les zeros de tete ("a:1b:..."). Sans normalisation
    canonique, le meme appareil aurait recu deux cles differentes selon
    la plateforme. Les six formes sont ramenees a
    "aa:bb:cc:dd:ee:ff".

  - **Conservation apres reinstallation.** Les noms sont ecrits dans
    `data/netHosts.json` via `server/store.js`, donc hors de
    l'arborescence livree par les ZIP de mise a jour : ils survivent a
    une mise a jour comme a une reinstallation complete. Ils sont aussi
    embarques dans les sauvegardes/restaurations de configuration, qui
    recopient tout `data/*.json` sans modification a apporter a
    `server/backups.js`.

  - **Le nom detecte n'est jamais perdu.** L'alias ne remplace pas
    `hostname` cote serveur : il s'y ajoute. La tuile rappelle le nom
    d'origine en second plan a cote du nom personnalise, et l'effacement
    de l'alias redonne le nom reseau immediatement, sans relancer une
    analyse de ~15 secondes.

  - **Detail d'implementation.** L'application des alias se fait a la
    volee dans la route `/api/network-scan`, jamais dans le cache de
    scan : un renommage se voit donc instantanement. Le scan expose
    desormais le champ `mac` de chaque hote (il ne quitte pas le reseau
    local, comme le reste des donnees de cette tuile).

  - **Echappement des attributs.** Le champ de saisie utilise
    `escapeHtmlAttr()` (guillemets doubles ET simples echappes), pour ne
    pas rejouer la classe de bug corrigee dans l'editeur de rangees en
    1.77 : un nom contenant un guillemet aurait tronque l'attribut
    `value=`.

  - **Tests.** Nouveau `test/netHosts.test.js` : normalisation MAC des
    trois plateformes, stabilite de la cle a travers un changement
    d'IP, upsert/suppression sans mutation des tables d'entree, rejet
    des cles douteuses a la relecture du fichier, plafonnement du
    nombre d'entrees, et application des alias sans ecraser le nom
    detecte.

## 1.78.2

- **CORRECTIF : la tuile Sante Internet ne mesurait RIEN quand elle
  etait posee dans un tiroir.** Elle restait indefiniment sur "premier
  releve en cours", sans aucune erreur, ni cote serveur ni cote client.

  - **Cause.** `layout.tiles` ne contient que les tuiles du tableau
    principal. Une tuile posee dans un tiroir vit ailleurs, sous
    `layout.drawer.tiles`, `layout.drawerTop.tiles` ou
    `layout.drawerRight.tiles`. Le serveur ne lisait que `layout.tiles`
    et ne voyait donc pas la tuile. Or "aucune tuile posee = aucune
    mesure" est le comportement VOULU quand il n'y en a vraiment pas :
    le serveur s'arretait silencieusement, exactement comme prevu, mais
    pour une mauvaise raison.

  - **Correction.** Le serveur balaie desormais toute structure de la
    disposition portant un tableau `tiles`, plutot qu'une liste de trois
    noms codes en dur : le jour ou un quatrieme emplacement apparaitra,
    cette fonction n'aura pas besoin d'etre retouchee.

  - **La cause reelle du temps perdu.** Le bug etait invisible parce que
    la tuile affichait le meme message dans deux situations qui n'ont
    RIEN a voir : "le premier releve arrive" (qui se resout tout seul en
    une minute) et "le serveur ne mesure rien du tout" (qui ne se
    resoudra jamais). Un message distinct existe desormais pour le
    second cas, qui aurait rendu le diagnostic immediat au lieu de
    laisser regarder une attente pendant trois heures.

  - **Garde-fous** : `test/internetHealth.test.js` couvre les tuiles de
    tiroir (les trois emplacements, plus les dispositions partielles,
    nulles ou malformees qui ne doivent jamais lever d'exception --
    sinon l'echantillonneur mourrait a chaque tour), et `dom-smoke.js`
    verifie que les deux messages restent distincts.

---

- **FIX: the Internet health tile measured NOTHING when placed in a
  drawer.** It sat forever on "first reading in progress", with no error
  anywhere. `layout.tiles` only holds the main board's tiles; a tile in
  a drawer lives under `layout.drawer.tiles` and its siblings, so the
  server never saw it and stopped silently -- exactly as designed for a
  board with no such tile, but for the wrong reason. The server now
  sweeps every structure in the layout carrying a `tiles` array. The bug
  stayed invisible because one message covered two unrelated situations:
  "the first reading is coming" and "nothing is being measured at all".
  These now read differently. Tests cover drawer tiles, malformed
  layouts, and the distinction between the two messages.

## 1.78.1

- **CORRECTIF : les cartes affichaient toutes "API KEY REQUIRED".**
  Tuiles Carte de trafic, Radar meteo et Avions en vue.

  - **Cause : un changement de politique chez CARTO, pas un bug de
    PiBoard.** Les fonds raster de `basemaps.cartocdn.com` etaient
    historiquement servis sans cle ; ils exigent desormais une cle API
    et sont en cours de retrait. Le filigrane est peint dans le PNG cote
    serveur, ce qu'aucune modification de notre code ne pouvait changer.
    Home Assistant a ete touche de la meme facon au meme moment.

  - **Ce n'etait pas propre a macOS et Linux**, contrairement a ce que
    laissait croire l'observation : le service ne connait pas le systeme
    du client. Windows paraissait epargne parce qu'Electron conservait
    en cache les tuiles deja telechargees.

  - **Champ "Cle CARTO des fonds de carte" dans les REGLAGES GENERAUX**,
    nouvelle section "Cartes". Une seule saisie pour les trois tuiles :
    elles affichent le meme fond, la redemander trois fois n'aurait
    aucun sens. Le lien vers la page qui delivre la cle figure juste
    a cote -- personne ne devine cette adresse.

  - **Application immediate.** Changer la cle remonte les tuiles
    cartographiques : la couche de fond Leaflet est construite une seule
    fois, a la creation. Sans remontage, la carte aurait garde ses
    tuiles filigranees jusqu'au prochain rechargement de page et on
    aurait cru la cle refusee alors qu'elle etait bonne.

  - **PiBoard n'embarque AUCUNE cle, et c'est definitif.** CARTO delivre
    des cles par client et interdit de les partager entre projets sans
    lien. Une cle placee dans le depot serait utilisee par toutes les
    installations a la fois : quota commun epuise, puis cartes de tout
    le monde cassees d'un coup a la revocation. Un test verifie qu'aucune
    cle en dur ne se glisse dans les trois widgets.

  - **La cle n'est PAS rangee dans le coffre chiffre.** Une cle CARTO
    circule en clair dans l'adresse de chaque tuile d'image, visible
    dans l'onglet reseau du navigateur : la classer avec les mots de
    passe donnerait une fausse impression de confidentialite.

  - **Documentation mise a jour** : section "Cartes" detaillee dans
    l'aide generale (barre d'outils & reglages), mention ajoutee aux
    trois fiches de tuiles concernees, credits CARTO, README dans les
    deux langues, et surtout **le guide de demarrage rapide**, qui
    annonce desormais les besoins en cles des le premier lancement --
    CARTO pour les fonds de carte, TomTom pour le trafic lui-meme, en
    precisant bien que ce sont deux choses distinctes.

  - **Garde-fous ajoutes a `dom-smoke.js`** : presence de la cle dans
    l'URL des trois fonds, absence de cle en dur, lecture a l'appel et
    non figee au chargement, remontage sur changement, champ et lien
    presents dans les reglages, mention bilingue dans le guide de
    demarrage, et traduction FR/EN des quatre nouveaux libelles.

---

- **FIX: every map showed "API KEY REQUIRED".** Traffic map, Weather
  radar and Planes overhead tiles. The cause was a policy change at
  CARTO, not a PiBoard bug: its raster base maps now require an API key
  and the watermark is painted into the PNG server-side. This was not
  macOS- or Linux-specific -- Windows merely looked spared because
  Electron still had cached tiles. A "CARTO base map key" field has been
  added to the GENERAL settings, under a new "Maps" section, with a link
  to the page issuing the free key; one entry serves all three tiles,
  and changing it remounts them so it applies immediately. PiBoard ships
  no key of its own, deliberately and permanently: CARTO issues keys per
  customer and forbids sharing them across unrelated projects. The key
  is not filed in the encrypted vault, since it travels in the clear
  inside every tile URL. The general help, the three tile pages, the
  credits, the README and the quick start guide were all updated -- the
  latter now announces the API keys needed, from the very first launch.

## 1.78.0

- **NOUVELLE TUILE : Sante Internet** (famille "Systeme & Reseau").
  Latence, gigue et perte de paquets mesurees EN CONTINU, courbe sur
  24 h (jusqu'a 72 h), tests de debit periodiques et archivage CSV.

  - **La mesure est faite par le SERVEUR, pas par le navigateur.** C'est
    le coeur de la tuile : ce qu'on cherche n'est pas la valeur de
    l'instant, c'est la coupure de 4 h du matin. Une mesure faite cote
    client n'existerait que page ouverte et repartirait de zero a chaque
    rechargement -- exactement le defaut corrige sur l'Etat systeme.
    L'historique survit donc aux rechargements et est partage par tous
    les ecrans.

  - **Aucun `ping` systeme.** ICMP demande root sous Linux et l'appel de
    la commande differe par OS : ce serait du code specifique a une
    plateforme, interdit hors de `server/platform/`. On mesure le temps
    d'etablissement d'une connexion TCP vers un resolveur DNS public sur
    le port 443 -- Node pur, identique Pi / Windows / macOS, sans aucun
    privilege. Contrepartie assumee et documentee dans l'aide : le
    chiffre est quelques millisecondes au-dessus d'un ping ICMP.

  - **Mediane et non moyenne.** Un seul aller-retour ralenti par une
    retransmission ferait bondir une moyenne de cinq sondes et
    afficherait un pic qui ne reflete pas l'etat de la ligne.

  - **Une latence absente n'est PAS une latence nulle.** Une ligne qui
    ne repond pas affiche "aucune reponse" en rouge, jamais "0 ms" --
    qui annoncerait une connexion excellente pendant une panne. Meme
    principe dans le CSV : cellule VIDE, jamais un zero qui serait pris
    pour une mesure reelle.

  - **Les coupures ROMPENT le trace** au lieu d'etre reliees, et sont
    signalees par une bande rouge. Une ligne qui traverse une coupure
    laisserait croire a une degradation progressive alors qu'il n'y
    avait rien du tout. La reduction de courbe conserve le PIRE point de
    chaque tranche, pas la moyenne : moyenner effacerait justement la
    micro-coupure qu'on cherche.

  - **Le test de debit est rare et DOUBLEMENT plafonne.** Mesurer un
    debit consomme du debit : toutes les 3 h par defaut, plafonne en
    volume (protege un forfait limite) ET en duree (protege d'une ligne
    effondree). ~160 Mo/jour aux reglages par defaut ; intervalle a 0 =
    tests desactives, la latence continuant d'etre mesuree. Debit
    montant desactive par defaut (saturer la voie montante ralentit tout
    le foyer pendant le test).

  - **Aucune tuile posee = aucune mesure, donc aucun trafic.** Les
    reglages sont lus dans `data/layout.json` : pas de second endroit de
    configuration a tenir a jour, et personne ne paie pour une
    fonctionnalite qu'il n'utilise pas.

  - **Archivage CSV a la demande, par DEUX voies volontairement
    distinctes** : telechargement navigateur (depuis un PC), et
    ecriture sur la machine hote dans `data/exports/` sous un nom
    horodate (depuis l'ecran mural en kiosque, un telechargement
    atterrirait dans un dossier que personne n'ouvrira jamais). Les
    archives deja constituees sont listees dans la fenetre, avec leur
    taille, retelechargeables d'un clic. Nom de fichier strictement
    valide avant relecture (meme regle que `store.fileFor`).

  - **Deux dialectes CSV, en choix et non en defaut impose** : francais
    (point-virgule + virgule decimale -- sans quoi un tableur FR met
    toute la ligne dans une seule cellule) ou international. BOM UTF-8
    pour les accents sous Windows, fins de ligne CRLF (RFC 4180).

  - **Retention volontairement courte (72 h).** Le fichier vit dans
    `data/`, donc dans CHAQUE sauvegarde de configuration (`backups.js`
    embarque tout `data/*.json`). Ecriture compacte et espacee de 5 min
    plutot qu'a chaque releve, comme pour l'historique systeme : sur un
    Pi, marteler la carte SD serait inutilement agressif. La
    conservation longue duree, c'est justement le role du CSV.

  - **Garde-fous ajoutes** : `test/internetHealth.test.js` (56
    assertions, AUCUN appel reseau -- ces tests doivent passer pendant
    une coupure, ce qui est justement la situation que la tuile mesure)
    et un bloc `dom-smoke.js` qui verifie notamment que la sonde pose
    son gestionnaire d'erreur AVANT `connect()` : une socket qui emet
    "error" sans auditeur fait tomber tout le processus -- meme classe
    de defaut que le plantage ImapFlow corrige en 1.77, et ici l'echec
    est un evenement NORMAL puisque c'est la perte de paquet qu'on
    mesure.

---

- **NEW TILE: Internet health** ("System & Network" family). Latency,
  jitter and packet loss measured CONTINUOUSLY, 24 h curve (up to 72 h),
  periodic speed tests and CSV archiving. Measurement is done by the
  SERVER, not the browser, so the history survives page reloads and is
  shared by every screen. No system `ping` (TCP handshake timing
  instead, identical on every platform, no privileges). Median rather
  than mean. An absent latency is never shown as zero. Outages break the
  stroke and are flagged. Speed tests are rare and capped twice, in
  volume and duration, and can be switched off. No tile on the board
  means no measurement at all. On-demand CSV archiving through two
  deliberately distinct routes, browser download and host-side archive,
  in either a French or an international dialect.

## 1.77.0

- **CORRECTIF MAJEUR : le saint du jour ne s'affichait plus.** Bug
  d'EMPAQUETAGE, pas de code -- le code etait correct, c'est le fichier
  qui manquait.
  - Le motif d'exclusion de mes archives de livraison visait le dossier
    `data/` d'execution a la racine, mais il capturait AUSSI
    `public/data/`. Le calendrier `saints-fr.json` a donc disparu de
    TOUTES les livraisons depuis la 1.67.1, et l'option "saint du jour"
    restait sans effet dans les tuiles Horloge et Meteo bien qu'activee.
  - Fichier restitue (367 entrees, annee bissextile comprise) et motif
    d'exclusion corrige.
  - **Garde-fou** : `dom-smoke.js` verifie la presence et la validite du
    calendrier, ET que chaque ressource `/data/` referencee par un widget
    existe reellement. Aucun test de code n'aurait pu attraper ceci.

- **Tuile Bourse : les jours feries sont pris en compte.** Limite
  assumee en 1.72.1, desormais levee.
  - Les dates MOBILES (Vendredi saint, Lundi de Paques) sont CALCULEES
    depuis Paques (algorithme de Gauss/Meeus), pas listees annee par
    annee : une table figee serait devenue fausse au 1er janvier suivant
    sans que rien ne le signale.
  - Les deux feries de Paques sont traites SEPAREMENT : le NYSE ferme le
    Vendredi saint mais ouvre le Lundi de Paques. Les confondre aurait
    signale la place fermee un lundi ouvre.
  - Restent hors perimetre, et l'aide le dit : demi-seances (24 decembre,
    signalee ouverte -- c'est exact), reports au lundi, calendrier
    lunaire de Hong Kong.

- **Tuile Courriel : pastille de messages non lus.** Le compte etait deja
  calcule cote client... et jamais affiche.
  - La pastille porte sur TOUTE la boite (commande IMAP `STATUS`), pas
    seulement sur les messages affiches : une boite a 80 non-lus en
    aurait annonce 25 -- le maximum affichable -- laissant croire qu'on
    avait fait le tour.
  - Repli sur le compte des messages affiches si le serveur refuse
    `STATUS`. Masquee a zero : un "0" permanent est du bruit sur un
    tableau mural.

- **Historique des ressources persistant.** Les courbes CPU/RAM/disque
  repartaient de zero a chaque rechargement de page.
  - Echantillonnage cote SERVEUR, une fois par minute : l'historique
    survit aux rechargements et il est PARTAGE par tous les ecrans.
  - Tampon CIRCULAIRE borne a 24 h : sans borne, le fichier croitrait
    indefiniment sur une machine allumee en permanence.
  - Ecriture disque espacee de 5 minutes et non a chaque echantillon :
    sur un Pi, ecrire 1440 fois par jour sur la carte SD serait
    inutilement agressif. Perdre les dernieres minutes apres une coupure
    brutale est sans consequence.
  - Profondeur reglable de 5 min a 24 h. Repli silencieux sur
    l'historique client si la route ne repond pas.

- **Test Agenda : fin de l'echec deux jours sur sept.** La fixture
  placait l'evenement a "aujourd'hui + 2 jours" en dur ; le samedi, +2
  tombe lundi, donc dans la semaine SUIVANTE, hors de la grille affichee.
  Le decalage est desormais calcule pour rester dans la semaine courante
  -- verifie sur les sept jours.

## 1.76.0

- **README remis a jour.** Sa liste de widgets avait quatre versions de
  retard : Quotas IA, Couleur Tempo, Bourse et indices, et Chaines TV
  n'y figuraient pas du tout.
  - **Liste restructuree par famille**, avec le meme classement que le
    catalogue. Elle tenait jusqu'ici dans un unique paragraphe de 28
    widgets, illisible en pratique.
  - Le point "Collection de widgets" ne citait que 5 tuiles sur 28 : il
    renvoie desormais a la liste complete.
  - Fonctionnalites transverses ajoutees : guide de demarrage rapide et
    tableau defilant, tous deux absents alors qu'ils datent des 1.68 et
    1.69.
  - Titre d'installation : "Bookworm ou Trixie", le corps du texte
    mentionnant deja Trixie.
  - La tuile Chaines TV est decrite avec son avertissement : PiBoard ne
    fournit aucune chaine ni aucun contenu.

- **Aide integree : verifiee, rien a corriger.** Les 28 tuiles ont leur
  fiche, et les neuf fonctionnalites livrees depuis la 1.68 y sont toutes
  documentees. C'est le README, et lui seul, qui avait derive.

- **Garde-fou contre la recidive** : `dom-smoke.js` verifie desormais que
  CHAQUE widget livre est cite dans le README, et nomme ceux qui
  manquent. Le test a d'ailleurs immediatement releve une imprecision de
  redaction ("cours de cryptos" au lieu du libelle reel "Cours Cryptos"),
  corrigee.

## 1.75.3

- **Correctif : les cinq tuiles ajoutees depuis la 1.70 s'entassaient
  dans "Divers".** Elles n'etaient listees dans aucune famille de
  `CATALOG_FAMILIES`, et le filet de securite du catalogue les envoyait
  toutes dans "Divers". Un filet utile, mais SILENCIEUX : rien ne
  signalait l'oubli.
  - **Nouvelle famille "Maison & energie"** : Couleur Tempo et Home
    Assistant. Toutes deux parlent de ce qui se passe DANS le logement,
    ce qu'aucune famille existante ne couvrait.
  - **Bourse et indices** rejoint les Cryptos dans "Informations" -- on
    cherche les deux au meme endroit.
  - **Quotas IA** rejoint "Systeme & Reseau" : comme l'Etat systeme, la
    tuile surveille une consommation par rapport a un seuil, meme si la
    ressource surveillee n'est pas celle de la machine.
  - Une famille "Finance" distincte se defendrait, mais elle deplacerait
    la tuile Cryptos, dont la place resulte d'une segmentation
    deliberee anterieure (verrouillee par un test). Hors sujet pour cette
    correction : le choix existant est conserve.

- **Garde-fou contre la recidive** : `dom-smoke.js` verifie desormais que
  CHAQUE tuile livree est explicitement classee, et nomme celles qui ne
  le sont pas. Verifie par retrait volontaire d'une tuile de sa famille :
  le test echoue bien et la designe.
  - Verification inverse egalement : une famille citant une tuile
    inexistante laisserait un trou invisible dans le catalogue.
  - Chaque famille doit avoir ses libelles dans les DEUX langues, sans
    quoi la rubrique s'afficherait avec sa cle brute.

## 1.75.2

- **Correctif : la tuile Etat systeme perdait ses barres de progression
  et collait ses libelles aux valeurs.** Cause racine trouvee, et elle
  explique les DEUX symptomes d'un coup -- ce n'etait pas un probleme
  d'espacement.
  - Les feuilles de style de TOUS les widgets sont chargees dans le MEME
    document. J'avais ecrit les classes de la tuile Bourse avec le
    prefixe `.pws-` SANS les cloisonner sous `.pw-stocks`, alors que la
    tuile Etat systeme utilise ce prefixe depuis toujours.
  - `.pws-row { align-items: baseline }`, ecrit pour la Bourse,
    s'appliquait donc aux lignes de l'Etat systeme. Sur un conteneur
    `flex-direction: column`, un `align-items` autre que `stretch`
    empeche les enfants de remplir la largeur : le libelle et la valeur
    se retrouvaient colles, ET la barre de progression -- qui n'a pas de
    contenu propre -- tombait a une largeur nulle, donc invisible.
  - **Le symptome n'apparaissait QUE si les deux tuiles etaient sur le
    meme tableau.** Chaque widget etait correct isolement, ce qui
    explique qu'aucun test ne l'ait attrape.
  - Prefixe de la tuile Bourse renomme `.pwb-`. Une SECONDE collision du
    meme type, egalement de mon fait, a ete trouvee au passage :
    `.pwa-msg` de la tuile Quotas IA ecrasait celle de la tuile
    Astronomie, anterieure. Prefixe renomme `.pwq-`.

- **Garde-fou contre la recidive** : `dom-smoke.js` releve desormais la
  classe de premier niveau de CHAQUE selecteur de CHAQUE feuille de
  widget et echoue si deux widgets se partagent la meme, en les nommant.
  Verifie par injection d'une collision volontaire : le test echoue bien,
  il ne se contente pas de passer.

- **Espacement libelle / valeur** (issu de 1.75.1, conserve) : `gap`
  minimal de `1em`, et c'est le libelle qui se tronque si la place
  manque, pas la valeur.

- **Courbes d'utilisation** (issu de 1.75.1, conserve) : clic sur CPU,
  RAM ou Disque -> fenetre a trois onglets, echelle fixe 0-100 %,
  historique cote client borne a 360 points.

## 1.75.1

- **Correctif de lisibilite : le libelle et la valeur se touchaient.**
  `.pws-row-head` utilisait `justify-content: space-between` SANS `gap`.
  Or `space-between` ne garantit aucun espace : des que le libelle et la
  valeur remplissent la largeur, ils se collent. Sur une tuile etroite,
  "RAM" et "5,2 / 8 GB" finissaient accoles.
  - Espace minimal de `1em` ajoute -- un minimum, qui ne s'ajoute pas a
    l'espace deja reparti quand la place est suffisante.
  - Si la place manque vraiment, c'est le LIBELLE qui se tronque et non
    la valeur : le chiffre est l'information, le libelle se devine.

- **Courbes d'utilisation : un clic sur CPU, RAM ou Disque** ouvre une
  fenetre a trois onglets, une courbe par ressource, mise a jour en
  direct au rythme de rafraichissement de la tuile (aucun minuteur
  supplementaire).
  - **Echelle FIXE de 0 a 100 %**, jamais ajustee au contenu : une
    echelle automatique ferait paraitre dramatique une variation de deux
    points en zoomant dessus. Sur un pourcentage, l'echelle absolue est
    la seule honnete. Les valeurs sont bornees pour ne pas sortir du
    cadre.
  - **Historique tenu COTE CLIENT**, alimente par les releves que la
    tuile fait deja : aucun echantillonnage supplementaire, aucun
    stockage. Un historique serveur aurait impose d'echantillonner en
    permanence, meme quand personne ne regarde.
  - **Contrepartie assumee et documentee** : l'historique repart de zero
    au rechargement de la page. La fenetre le dit, plutot que de laisser
    croire a un historique de longue duree.
  - Borne dure a 360 points (environ une demi-heure au rythme par
    defaut) : sans elle, une tuile laissee des jours sur un tableau mural
    accumulerait indefiniment.
  - L'onglet Disque n'apparait que si la machine remonte cette donnee.
  - Un seul point ne trace pas de courbe : on attend d'en avoir deux
    plutot que d'afficher un chemin vide.

- **Tests** : 11 assertions ajoutees a `dom-smoke.js`, dont la
  verification que l'espacement existe reellement dans la feuille de
  style, que c'est bien le libelle qui se tronque, et une verification
  par le comportement de la geometrie du trace (0 % en bas, 50 % au
  milieu, valeur aberrante bornee).

## 1.75.0

- **Tuile "Etat systeme" : adresses IP des cartes reseau, et fenetre de
  configuration complete.** Un clic sur une adresse ou un nom de carte
  ouvre le detail de TOUTES les cartes : adresse et masque, passerelle,
  DHCP (serveur et expiration du bail le cas echeant), serveurs DNS,
  suffixe de domaine, adresse MAC, IPv6 publiques, plus le nom d'hote.

- **Seules les VRAIES cartes connectees sont montrees.** Une carte
  VirtualBox, VMware, Docker ou Hyper-V porte une adresse IP tout a fait
  valide : `os.networkInterfaces()` ne permet pas de la distinguer seule.
  Trois criteres combines, du plus fiable au moins fiable :
  1. `internal` -- la boucle locale.
  2. Le **prefixe OUI de la MAC**, critere le plus solide : ces prefixes
     sont attribues aux editeurs d'hyperviseurs et ne peuvent pas
     apparaitre sur une vraie carte.
  3. Le **nom**, en dernier recours et volontairement etroit : un motif
     trop gourmand ecarterait une vraie carte.
  Une carte sans adresse IPv4 est egalement ecartee -- non connectee, ce
  qui couvre aussi le cable debranche.

- **Regroupement par carte.** Node renvoie une entree PAR ADRESSE : une
  carte ayant une IPv4 et deux IPv6 apparaissait trois fois. Les adresses
  de lien local (`fe80:`) sont exclues, elles n'apprennent rien.

- **Respect de la couche d'abstraction plateforme.** `networkDetails()`
  a ete ajoutee a l'interface et implementee dans les TROIS fichiers,
  conformement a la regle du projet (aucun `process.platform` hors de
  `server/platform/`).
  - **Windows** : `ipconfig /all` plutot que PowerShell -- present
    partout, aucun droit particulier, demarrage instantane. Contrepartie
    assumee : la sortie est LOCALISEE, donc le parseur se repere sur des
    motifs independants de la langue et laisse `null` en cas de doute.
    Les serveurs DNS en ligne de continuation (sans etiquette) sont lus,
    sans quoi le second serveur serait perdu.
  - **Linux** : trois sources independantes et facultatives -- `ip route`
    pour la passerelle, `resolvectl` (repli `/etc/resolv.conf`) pour les
    DNS, fichiers de bail pour le DHCP. Perdre les DNS ne fait pas perdre
    la passerelle. Le resolveur local systemd (127.0.0.53) est ecarte :
    ce n'est pas un vrai serveur.
  - **macOS** : `netstat -rn` et `scutil --dns`. Ce n'est pas une cible
    de deploiement, l'implementation existe pour honorer le contrat.

- **Aucune valeur inventee.** Un champ inconnu vaut `null` et s'affiche
  "non disponible". En particulier DHCP reste vide quand on n'a pas pu
  conclure : afficher "non" laisserait croire a tort a une adresse fixe,
  et une passerelle fausse enverrait chercher une panne inexistante.

- **Lecture unique, hors du cycle de rafraichissement.** La configuration
  reseau ne change pratiquement jamais, alors que `/api/system` est
  reinterroge toutes les quelques secondes : les lier aurait execute
  `ipconfig` ou `ip route` a chaque cycle pour un resultat identique.

- **Tests** : nouveau `test/netConfig.test.js`, 41 assertions. Les
  parseurs etant PURS, la suite valide les TROIS plateformes depuis
  n'importe quelle machine -- dont une sortie `ipconfig` en francais, et
  la verification que `networkDetails()` existe bien dans les trois
  implementations (une absence casserait le deploiement sur une seule
  plateforme, donc silencieusement).

## 1.74.1

- **Correctif : le bouton "+" creait un doublon immediat.** Une nouvelle
  ligne etait pre-remplie avec le PREMIER instrument de la PREMIERE
  famille -- le CAC 40. Cliquer "+" ajoutait donc aussitot une seconde
  ligne CAC affichee sur la tuile, avant meme tout choix. Et comme le nom
  restait vide, la ligne fautive etait quasi invisible dans le formulaire
  (colonne "Nom" en texte grise) alors qu'elle etait bien presente.
  - Une nouvelle ligne part desormais avec un symbole VIDE, et le menu
    affiche une invite explicite "— choisir —" tant qu'aucun instrument
    n'est retenu.
  - Changer de place vide le symbole au lieu d'en imposer un autre.
  - **Les lignes sans instrument ne sont plus enregistrees** : une ligne
    en cours de saisie ne peut plus produire d'entree fantome.
  - **Un symbole deja present est refuse** a la selection, avec un
    message : c'est exactement le doublon qu'on cherche a eviter.

- **Un nom laisse vide affiche le libelle du catalogue, plus le symbole
  brut.** La ligne s'affichait "^CAC" au lieu de "CAC 40" -- inutilement
  cryptique. Le serveur renvoie desormais le libelle connu en repli.

- **Correctif : l'or et le petrole restaient vides.** Les contrats a
  terme sont suffixes ".F" chez Stooq, soit UNE seule lettre -- ils
  echappaient a l'expression a deux lettres de la traduction vers Yahoo
  et ne recevaient donc AUCUN repli. Des que Stooq ne repondait pas, les
  trois lignes de matieres premieres affichaient un tiret. Traduction
  ajoutee (`GC.F` -> `GC=F`), avec des tests de non-regression pour que
  `.FR` et `.US` ne soient pas captes par la nouvelle regle.

- **Nombre de decimales selon la NATURE de l'instrument** et non son seul
  ordre de grandeur. L'ancienne regle affichait une action a 4,49 EUR
  comme "4,4880" : quatre decimales sur une action sont du bruit, alors
  qu'une paire de change en a besoin pour rester lisible (1,0847).
  Desormais : change 4 decimales, valeur >= 1000 aucune, sinon 2 -- et 4
  sous 1, ou deux decimales ecraseraient l'information.

- **Tests** : 5 assertions ajoutees a `test/stocks.test.js` (71 au
  total).

## 1.74.0

- **Nouvelle tuile "Home Assistant", en LECTURE SEULE.** Affiche les
  entites de l'installation domotique : temperatures, portes et fenetres,
  consommation, humidite, batteries. Un etat qui merite l'attention
  (porte ouverte, fumee detectee) passe en couleur d'alerte, l'etat
  normal reste discret.
  - **Aucun appel de service, aucun moyen d'en faire.** Le module
    n'expose ni route ni fonction de pilotage. Ce n'est pas un oubli :
    un ecran tactile mural est accessible aux enfants et aux visiteurs,
    et le pilotage viendra avec ses protections propres (liste blanche de
    services, confirmation sur les domaines sensibles).

- **Transport WebSocket, repli REST.** Une porte qui s'ouvre apparait
  dans la seconde.
  - **UNE SEULE connexion** vers Home Assistant pour toute
    l'installation, quel que soit le nombre de tuiles et d'ecrans. Le
    cache d'etats est cote serveur.
  - **Auditeur "error" systematique sur le WebSocket** : un EventEmitter
    qui emet "error" sans auditeur remonte en uncaughtException -- c'est
    exactement le mecanisme qui a fait planter l'application en 1.67.0
    avec ImapFlow.
  - **Reconnexion a delai croissant** (2 s -> 60 s, plafonne) : une
    reconnexion immediate en boucle sur un HA eteint saturerait journal
    et reseau. Minuteurs en `unref()` pour ne pas retenir le processus.
  - L'abonnement se limite a `state_changed` : `subscribe_events` sans
    filtre deverserait appels de service, minuteries et journal.
  - Un abonnement ne renvoyant QUE les changements a venir, l'etat
    courant est charge une fois en REST -- sinon la tuile resterait vide
    jusqu'a ce que chaque entite bouge d'elle-meme.

- **Le flux SSE existant est rediffuse aux widgets** sous forme
  d'evenements DOM `piboard:<nom>`. Un widget qui a besoin d'etre pousse
  n'ouvre donc PAS son propre EventSource, ce qui aurait multiplie les
  connexions SSE par le nombre de tuiles pour un seul et meme flux.

- **Selecteur d'entites alimente par l'instance de la personne.**
  Contrairement au catalogue fige de la tuile Bourse, les listes sont
  construites depuis `GET /api/states` et groupees par domaine.
  - Le type de champ `rows` accepte desormais une source DYNAMIQUE :
    `{tileId}` et `{field:cle}` y sont substitues. Generique, reutilisable.
  - Un catalogue vide alors qu'une source etait prevue affiche un message
    explicite : sans lui, la personne verrait des listes vides sans
    savoir si l'adresse est fausse, le jeton refuse ou le service
    injoignable.

- **Jeton dans le coffre chiffre** (`tileSecrets`), absent de
  `layout.json`, JAMAIS renvoye au navigateur : les routes ne sortent que
  des etats d'entites.

- **Tests** : nouveau `test/homeAssistant.test.js`, 30 assertions. Cette
  tuile ayant ete developpee SANS instance Home Assistant disponible, les
  tests montent un FAUX Home Assistant en HTTP local (module `http` de
  Node, aucune dependance ajoutee) et interrogent reellement le module --
  en-tete Bearer, jeton refuse, regroupement par domaine, entite absente
  signalee. Le protocole WebSocket est teste via une fonction pure.

## 1.73.2

- **Correctif : l'editeur de lignes de la tuile Bourse etait
  silencieusement vide.** UNE seule cause explique les TROIS symptomes
  signales (bouton de restauration sans effet, ligne ajoutee absente a la
  reouverture, contenu efface a l'enregistrement suivant).
  - **Cause racine** : `escapeHtmlAttr()` echappait `&`, `<` et `>` mais
    PAS le guillemet double. Le JSON de la liste en contient a chaque
    cle : l'attribut `value="..."` se fermait donc au premier guillemet du
    JSON, et la valeur relue etait tronquee a `[{`. `JSON.parse` echouait,
    le `catch` retombait sur `[]`.
  - Consequences enchainees : la fenetre de reglages n'a JAMAIS montre la
    liste (seule la tuile l'affichait, via le defaut du manifeste) ;
    ajouter une ligne partait donc d'une liste vide et effacait le reste ;
    a la reouverture la meme troncature revidait tout ; et le bouton
    "Restaurer la liste par defaut" lisait un `data-default` tronque de
    la meme facon, donc ne restaurait rien.
  - **Bug LATENT et generique**, pas propre a la tuile Bourse : n'importe
    quelle valeur contenant un guillemet (un nom de tuile, un libelle)
    aurait produit le meme genre de troncature ailleurs dans l'interface.
    `escapeHtmlAttr()` echappe desormais aussi `"` et `'`.

- **Le JSON ne transite plus par des attributs HTML.** Meme correctement
  echappe, faire circuler une structure par du texte a echapper puis a
  reparser est fragile pour rien : les valeurs des champs `rows` passent
  maintenant par une `Map` cote JavaScript, de `fieldMarkup()` a
  `initRowsEditor()`, en restant des objets de bout en bout.

- **Le champ cache est renseigne AVANT l'attente du catalogue** :
  enregistrer pendant ce chargement -- ou apres son echec -- envoyait
  sinon une chaine vide, et effacait donc la liste.

- **Tests** : 5 assertions ajoutees a `dom-smoke.js`, dont un
  aller-retour REEL d'un JSON contenant guillemets et chevrons a travers
  un attribut du DOM. C'est le test qui manquait : les assertions
  existantes portaient sur la logique metier, aucune ne verifiait que les
  valeurs survivaient au passage par le HTML.

## 1.73.1

- **Correctif : AUCUN graphique de la tuile Bourse ne fonctionnait.**
  Cause racine : `getChart()` n'avait qu'UNE SEULE source. Le moteur a
  deux sources (Stooq puis Yahoo) avait bien ete construit pour les
  COURS, mais pas pour les COURBES -- oubli de ma part en 1.72.0. Pire,
  la source unique retenue etait `stooq.com/q/d/l/`, le point d'entree le
  plus strictement limite de tous. Aucun repli : echec total.
  - **Yahoo Finance passe en PRIORITE pour les courbes**, a l'inverse des
    cours ou Stooq reste premier. Stooq redevient un repli pour les
    periodes quotidiennes.
  - Les pas sans transaction (`close: null`, frequents en
    intrajournalier) sont ecartes : les laisser passer produisait des
    `NaN` dans les coordonnees et cassait le trace du chemin SVG.
  - Moins de deux points exploitables -> bascule sur le repli plutot que
    de tracer un segment vide.

- **Nouvelle periode "1 jour"**, avec un pas de 5 minutes, et desormais
  celle sur laquelle la courbe s'ouvre. Elle n'est possible QUE via
  Yahoo : l'historique de Stooq est quotidien, une seule bougie par jour
  ne fait pas une courbe intrajournaliere -- Stooq n'est donc
  volontairement pas propose en repli de cette periode, ou il renverrait
  une courbe fausse.
  - Cache de la courbe du jour ramene a 5 min (contre 1 h pour les
    periodes longues) : une courbe intrajournaliere bouge pendant la
    seance, la garder une heure la figerait.

- **Les fichiers de widgets portent desormais la version de
  l'application dans leur URL** (`widget.js?v=1.73.1`). Le serveur
  envoyait deja `no-cache, must-revalidate`, mais revalider suppose que
  le navigateur INTERROGE le serveur -- ce qui n'arrive pas toujours dans
  une application Electron empaquetee, ni apres une mise a jour
  automatique. Une URL qui change a chaque version ne laisse aucune place
  a l'ambiguite. Sans version disponible, on retombe sur le comportement
  precedent : degradation, pas panne.

- **Tests** : 12 assertions ajoutees a `test/stocks.test.js` (66 au
  total), dont le filtrage des `null` intrajournaliers et la
  verification que Stooq n'est pas propose en repli du "1 jour".

## 1.73.0

- **Tuile Bourse : les indices ne peuvent plus etre perdus sans recours.**
  Un defaut de CONCEPTION, pas une corruption de donnees : le
  round-trip formulaire -> enregistrement -> reouverture a ete verifie et
  ne perd rien. Le probleme etait que les valeurs par defaut d'un
  manifeste ne s'appliquent QUE tant que le reglage n'a jamais ete
  enregistre. Des la premiere sauvegarde, `lines` existe -- supprimer les
  actions ne pouvait donc pas faire revenir les indices, et il n'existait
  AUCUN moyen de les recuperer.
  - **Bouton "Restaurer la liste par defaut"** sur tout champ de type
    `rows`. Il **fusionne** au lieu de remplacer : les indices standards
    sont remis, les lignes ajoutees par la personne sont conservees. Seuls
    les symboles absents sont ajoutes.

- **Indices et valeurs individuelles cohabitent, avec un separateur.**
  La tuile rassemble les indices en tete, trace un trait, puis affiche
  actions, devises et matieres premieres.
  - L'ordre choisi dans les reglages est RESPECTE a l'interieur de chaque
    groupe : on regroupe, on ne trie pas.
  - Le trait n'apparait que si les DEUX groupes existent -- un trait en
    tete ou en pied d'une liste homogene serait du bruit.
  - Nouveau reglage "Separer les indices des valeurs individuelles",
    actif par defaut.
  - Un symbole inconnu est classe en VALEUR, jamais en indice : un indice
    range en bas est anodin, un titre promu en haut brouillerait la
    lecture. Un symbole libre prefixe de `^` reste traite comme un indice.

- **Composition des indices** : trois nouvelles familles dans les listes
  deroulantes -- CAC 40 (les 40 valeurs), DAX (principales) et Dow Jones.
  Permet d'ajouter quelques composants d'un indice sans les chercher un
  par un. Ce sont des ACTIONS : elles s'affichent sous le separateur.
  - **Instantane, pas une verite permanente** : les indices connaissent
    des entrees et sorties une a quelques fois par an, la liste n'est pas
    mise a jour automatiquement. L'aide le signale dans un encadre.

- **Tests** : 22 assertions ajoutees a `test/stocks.test.js` (54 au
  total), dont la verification que le CAC 40 compte bien 40 valeurs, que
  chaque composant a un marche et une devise identifies, et qu'aucune
  famille ne contient de symbole en doublon.

## 1.72.1

- **Indicateur "marche ferme" sur la tuile Bourse.** Hors seance, la
  ligne s'attenue et porte la mention "cloture". Sans cela, une variation
  figee pendant tout un week-end ressemble a une tuile en panne.
  - **Fuseau IANA par place, jamais un decalage fixe.** Les passages a
    l'heure d'ete n'ont pas lieu aux memes dates en Europe, aux
    Etats-Unis et au Japon, et le Japon n'en a pas du tout : un decalage
    en dur serait faux plusieurs semaines par an. L'heure locale vient
    d'`Intl`, la meme API que la tuile Horloge -- aucun calcul maison.
    Un test verifie qu'au meme instant Paris est ouvert et New York ne
    l'est pas encore, ce qu'un decalage en dur ne passerait pas.
  - **`weekday` lu en anglais** et non dans la locale courante : sinon
    l'indicateur se serait casse des que PiBoard passe en francais.
  - **Horaires inconnus -> aucun indicateur** (`null`, pas `false`) :
    pour un symbole exotique saisi a la main, mieux vaut pas
    d'information qu'un "ferme" faux.
  - **Le change n'est PAS 24/7** contrairement aux cryptos : il ouvre le
    dimanche soir et ferme le vendredi soir, heure de New York. Il est
    donc bien signale ferme le samedi.
  - **Cache etire a 2 h marche ferme** (au lieu de 5 min) : inutile
    d'interroger la source toutes les 5 minutes toute la nuit et tout le
    week-end pour une valeur figee. L'etat du marche est en revanche
    recalcule a CHAQUE appel, meme sur un cours servi depuis le cache,
    sans quoi l'indicateur resterait bloque sur "ouvert" deux heures
    apres la cloture.

- **Limite assumee** : les JOURS FERIES ne sont pas connus -- PiBoard ne
  gere pas les calendriers feries de sept places. Un 1er janvier, la
  tuile affichera "ouvert" a tort. L'aide le dit explicitement plutot que
  de laisser decouvrir la surprise.

- **Tests** : 10 assertions ajoutees a `test/stocks.test.js` (32 au
  total), dont le decalage Paris / New York, le Nikkei ouvert la nuit
  europeenne, et le change ferme le samedi.

## 1.72.0

- **Nouvelle tuile "Bourse et indices"** : indices, actions, devises et
  matieres premieres, une ligne chacun avec la variation du jour, sur le
  modele de la tuile Cryptos. Clic sur une ligne -> courbe 1 mois /
  6 mois / 1 an / 5 ans. Par defaut : CAC 40, S&P 500, Nasdaq, DAX,
  EUR/USD.
  - **DEUX sources**, meme schema que Cryptos : Stooq en principal,
    Yahoo Finance en repli. Aucune cle, aucun compte.
  - **Le piege de Stooq** : quand le quota journalier est depasse,
    l'erreur revient DANS LE CORPS avec un statut HTTP 200. Un simple
    `res.ok` aurait affiche du texte d'erreur a la place d'un cours.
    `isStooqError()` valide le contenu et non le statut. Meme traitement
    pour un symbole inconnu, ou Stooq repond "N/D" partout plutot que
    d'echouer -- sans quoi la tuile afficherait NaN.
  - **Cours DIFFERES**, jamais du temps reel : l'aide le dit dans un
    encadre plutot que de laisser croire au direct.
  - Repli sur la derniere valeur connue si les deux sources echouent, la
    ligne s'estompant legerement -- signale, pas camoufle.

- **Nouveau type de reglage `rows`** dans le moteur de formulaires :
  editeur de lignes repetables a colonnes decrites dans le manifeste.
  - **Aucune modification de `collectTileFormValues()`** : le tableau
    ecrit son contenu en JSON dans un `<input type="hidden" data-key>`,
    et la collecte, qui parcourt simplement `[data-key]`, continue de
    fonctionner telle quelle. Le type est donc reutilisable par d'autres
    widgets sans nouvelle plomberie.
  - Listes dependantes : changer de place recharge les instruments et
    reinitialise le symbole, plutot que de conserver un symbole
    inexistant sur la nouvelle place.
  - Le nom se remplit automatiquement depuis le libelle de l'instrument
    s'il est vide, sans JAMAIS ecraser un nom saisi par la personne.

- **Entree "Autre..." avec saisie libre** : la source couvre plus de
  21 000 titres, impossible a loger dans un menu deroulant. Le catalogue
  cure (`server/stocksCatalog.js`) couvre les cas courants, et "Autre..."
  ouvre un champ acceptant n'importe quel symbole reconnu.

- **Devise native, sans conversion** : chaque ligne affiche son propre
  symbole (EUR, USD, GBP, JPY...). Convertir un indice n'aurait aucun
  sens. Pour un symbole saisi a la main, la devise est DEVINEE d'apres le
  suffixe -- juste dans la plupart des cas mais pas tous, ce que l'aide
  precise. Une devise indeterminee reste `null` plutot qu'inventee.

- **Tests** : nouveau `test/stocks.test.js` (22 assertions, sans reseau),
  dont la detection du quota Stooq en HTTP 200, la ligne "N/D", et le
  refus de traduire vers Yahoo un indice inconnu (mieux vaut pas de repli
  qu'un repli sur le mauvais titre).

## 1.71.0

- **Nouvelle tuile "Couleur Tempo"** : la couleur du jour de l'offre
  d'electricite Tempo d'EDF, en bandeau PLEINE TUILE (bleu / blanc /
  rouge) lisible a l'autre bout d'une piece sans avoir a lire le texte.
  Couleur du lendemain et jours restants par couleur en dessous.
  - **Une journee Tempo va de 6 h a 6 h**, pas de minuit a minuit. Entre
    minuit et 6 h, la couleur REELLEMENT applicable est encore celle de
    la veille. La tuile utilise donc `/api/now` (qui en tient compte)
    plutot que `/api/today` -- reglable, mais actif par defaut : sur un
    tableau mural allume la nuit, afficher "today" donnerait la mauvaise
    couleur pendant six heures chaque nuit.
  - **`codeJour: 0` est un ETAT NORMAL**, pas une erreur : RTE ne publie
    la couleur du lendemain que vers 11 h. La tuile affiche "pas encore
    publiee" plutot qu'un echec.
  - **Jours restants** : les noms exacts des champs de `/api/stats` ne
    sont pas documentes publiquement et n'ont pas pu etre verifies en
    direct. Le module accepte plusieurs graphies plausibles et renvoie
    `null` si aucune n'est reconnue -- la ligne est alors masquee, plutot
    que d'afficher des zeros qui feraient croire a tort qu'il ne reste
    aucun jour rouge.
  - **Relais serveur avec cache partage de 30 min** (`server/tempo.js`) :
    le domaine n'envoie pas d'en-tetes CORS permissifs, et l'API est
    hebergee benevolement -- une seule requete par demi-heure quel que
    soit le nombre de tuiles ou d'ecrans. La couleur du lendemain ne
    tombant qu'une fois par jour, interroger plus souvent n'apporte rien.
  - `Promise.allSettled` et non `all` : la couleur du jour s'affiche meme
    si la route des statistiques est en panne.
  - Le texte du bandeau est en couleur fixe et non `var(--text)` : il
    doit contraster avec le FOND DU BANDEAU, pas avec le theme -- le
    texte clair du theme nuit serait illisible sur le bandeau blanc.
  - L'aide precise d'emblee que la tuile n'a d'interet qu'avec un contrat
    Tempo.

- **Tests** : nouveau `test/tempo.test.js` (15 assertions, sans reseau),
  dont la verification que des statistiques non reconnues donnent `null`
  et jamais zero.

## 1.70.0

- **Nouvelle tuile "Quotas IA"** : barres de progression des limites
  d'usage du compte Claude, avec l'heure de reinitialisation de chacune.
  - **Fenetres affichees** : 5 heures (limite de session glissante),
    7 jours (plafond hebdomadaire) et, selon le compte, Opus sur 7 jours.
    Chacune peut etre masquee dans les reglages.
  - **Il n'y a PAS de fenetre "quotidienne"** : le service n'en expose
    pas. Ce qui est appele "limite du jour" ailleurs est en realite la
    fenetre glissante de 5 heures. La tuile n'invente donc pas de barre
    journaliere -- l'aide le precise explicitement.
  - **Les pourcentages viennent du service**, champ `utilization`. Rien
    n'est estime ni calibre par l'utilisateur : une barre a 62 % signifie
    que le service declare 62 %.
  - **Architecture a fournisseurs** (`server/aiUsage.js`) : chaque
    fournisseur renvoie des fenetres au format canonique
    `{ id, label, utilization, resetsAt }`. Le widget ne connait aucun
    service. Ajouter ChatGPT, Gemini ou Copilot plus tard ne touchera ni
    au widget, ni aux routes, ni au rendu.

- **Autorisation OAuth autonome, depuis la tuile.** PiBoard fait son
  propre flux OAuth 2.0 avec PKCE (S256) plutot que de lire les
  identifiants de Claude Code.
  - **Aucune dependance a Claude Code** : fonctionne avec un simple
    abonnement Claude.
  - **Aucun risque de corrompre l'etat d'identifiants de Claude Code** :
    PiBoard n'ecrit que dans son propre coffre, jamais dans
    `~/.claude/.credentials.json`. C'etait le danger de l'approche
    "lecture du fichier local", ecartee pour cette raison.
  - **PiBoard ne voit jamais le mot de passe** : l'authentification a
    lieu chez le service, qui delivre un jeton `user:profile`.
  - Le verificateur PKCE reste en memoire cote serveur, avec expiration a
    15 min : il n'est jamais envoye au navigateur, ce qui annulerait
    l'interet de PKCE. Un `state` protege du CSRF.

- **Securite des jetons.** Conserves dans le coffre chiffre existant
  (`tileSecrets`, identifiant de tuile reserve), donc absents de
  `data/layout.json` qui part dans les sauvegardes. Les routes ne
  renvoient JAMAIS de jeton -- uniquement des pourcentages et des heures.
  Un jeton de rafraichissement permet de generer des jetons d'acces a
  distance : il est traite comme un mot de passe.

- **Robustesse.** Le point d'entree d'usage n'est PAS une API publique
  documentee : c'est celle du client officiel, susceptible de changer
  sans preavis. Tout le code echoue proprement (tuile "Quotas
  indisponibles") au lieu de planter. Rafraichissement du jeton tente UNE
  fois sur 401 sans boucler, cache de 60 s pour ne pas marteler le
  service, et le dernier etat connu est conserve en cas de coupure reseau
  plutot que de vider la tuile.

- **Tests** : nouveau `test/aiUsage.test.js` (20 assertions, sans reseau)
  couvrant la traduction des reponses, la tolerance aux reponses
  inattendues, le bornage des pourcentages aberrants, la conformite PKCE
  et l'absence du verificateur dans l'URL d'autorisation.

## 1.69.1

- **Nouvelle icone pour les reglages d'une tuile : des curseurs, plus un
  "soleil".** L'icone precedente etait un cercle entoure de HUIT rayons
  droits -- un engrenage dont on avait retire les lobes, c'est-a-dire
  exactement le pictogramme d'un soleil. Ce n'etait pas un artefact de
  redimensionnement : la tuile et la barre d'outils utilisaient bel et
  bien deux traces differents.
  - **Pourquoi pas le vrai engrenage du dock** : il est rendu a 44 px
    dans la barre d'outils contre 15 px sur une tuile, et ses dents
    s'agglutinent a cette taille. Les curseurs n'ont aucun detail sous
    2 px et restent donc francs en 15 px.
  - **Effet de bord utile** : deux icones distinctes separent desormais
    visuellement les deux niveaux de reglages (engrenage = tout PiBoard,
    curseurs = cette tuile), confusion que le guide de demarrage rapide
    signale comme la plus frequente.
  - **La barre d'outils est inchangee**, conformement a la demande : son
    engrenage Feather est conserve tel quel. Une assertion de test le
    verrouille explicitement, pour qu'une retouche future de l'icone de
    tuile ne l'emporte pas au passage.
  - Aide et guide de demarrage rapide mis a jour en FR/EN : les passages
    qui decrivaient "l'engrenage de la tuile" parlent desormais des
    curseurs, et explicitent le contraste entre les deux icones. Les
    mentions de l'engrenage de la BARRE D'OUTILS sont, elles, laissees
    intactes.
  - Taille de la cible tactile inchangee (15 px + 2 px de marge
    interieure) : ce point n'a pas ete demande et reste ouvert.

- **Tests** : 4 assertions ajoutees a `dom-smoke.js`, dont la
  verification que le motif de rayons diagonaux "soleil" n'est pas revenu
  et que l'engrenage de la barre d'outils n'a pas bouge.

## 1.69.0

- **Guide de demarrage rapide au premier lancement.** Nouvelle fenetre
  ouverte automatiquement au tout premier demarrage, couvrant l'essentiel
  en une minute : objectif de PiBoard et diaporama, distinction entre les
  reglages GENERAUX et les reglages de CHAQUE TUILE, ajout d'une tuile,
  redimensionnement et taille minimale propre a chaque widget, bouton "?"
  disponible pendant la configuration d'une tuile, et sortie du mode
  edition. La capture de la barre d'outils y est integree, avec la
  legende des sept icones.
  - **Aucun drapeau "premier lancement" a maintenir** : le reglage
    `quickStartOnLaunch` vaut `true` dans `DEFAULT_SETTINGS`, qui
    s'applique tant qu'aucun `data/settings.json` n'existe -- le guide
    s'ouvre donc de lui-meme la premiere fois, et la case a cocher suffit
    ensuite a decider.
  - Ouverture en TOUTE FIN de `boot()`, pour que le guide s'affiche
    par-dessus le tableau deja rendu plutot que devant un ecran vide.
  - Case "Afficher ce guide a chaque lancement" dans la fenetre, doublee
    d'une case dans les reglages generaux. La fermeture n'enregistre QUE
    si la case a reellement change : une consultation depuis l'aide ne
    reecrit pas les reglages et ne diffuse pas d'evenement SSE inutile
    vers les autres ecrans.
  - Acces manuel a tout moment : nouvelle rubrique "Demarrage rapide" en
    tete du sommaire de l'aide.
  - **Source unique** : la rubrique d'aide n'a pas de contenu propre,
    elle reinjecte le texte de `public/quickstart-content.js`, plutot
    qu'une copie qui divergerait a la premiere retouche. L'assertion
    existante "toutes les fiches d'aide sont bilingues et non vides" a
    donc ete rendue plus precise (titre et sous-titre toujours exiges
    bilingues, seule l'exception de corps injecte est nommee) au lieu
    d'etre affaiblie, et une assertion verifie que le corps injecte
    existe vraiment.

- **Tuile Chaines TV : rappel explicite qu'aucun contenu n'est fourni.**
  Encadre d'avertissement en tete de la fiche d'aide (FR/EN) : PiBoard ne
  fournit aucune chaine ni aucun contenu, la tuile n'est qu'un lecteur,
  utilisable uniquement si l'on dispose deja par soi-meme d'un abonnement
  ou d'un acces a un service IPTV, ou d'une playlist en libre acces.
  Aucune adresse de service n'est fournie, suggeree ni integree, et la
  legalite de la source relevee revient a l'utilisateur. Le meme rappel
  prefixe la description du manifeste, donc **visible des le catalogue**,
  avant meme d'ajouter la tuile.

- **Fenetre de reglages generaux sur 3 colonnes.**
  `layoutFormColumns(form, opts)` accepte desormais `preferMax`, utilise
  par la seule fenetre de reglages generaux : la marge de 8 % qui
  privilegiait MOINS de colonnes devient 1.0001, si bien que le plus
  grand nombre de colonnes l'emporte a hauteur egale -- mais **jamais un
  decoupage qui rendrait le formulaire PLUS haut**. Les fenetres de
  reglages de TUILE conservent exactement l'ancien comportement, et le
  repli sur 1 ou 2 colonnes sur ecran etroit est preserve
  (`minCol = 300`).

- **Aide globale** : capture de la barre d'outils ajoutee a la fiche
  "Barre d'outils & reglages" ; nouvelle rubrique "Demarrage rapide".

- **Tests** : 16 assertions ajoutees a `dom-smoke.js` (guide bilingue,
  couverture des points obligatoires du guide, ouverture automatique,
  case cochee par defaut, capture reellement injectee, fermeture,
  rubrique d'aide a source unique, double rappel IPTV aide + manifeste).

## 1.68.0

- **Le tableau devient defilant quand -- et seulement quand -- une tuile
  sort de la zone visible.** Une tuile ajoutee alors que la grille etait
  pleine etait placee par Gridstack SOUS la derniere ligne visible ;
  `overflow: hidden` la rendait invisible ET insaisissable, sauf a
  deplacer une autre tuile vers le bas pour la faire remonter.
  - **Ascenseur strictement conditionnel.** `updateOverflow()` pose la
    classe `.has-overflow` sur `.board` uniquement si
    `scrollHeight > clientHeight + 1`. Sans cette classe, `.board` reste
    litteralement en `overflow: hidden` : sur un ecran ou tout tient, ce
    n'est pas un ascenseur discret qui s'affiche, c'est le defilement qui
    n'existe pas. La gouttiere est a `width: 0` par defaut, pour ne pas
    decaler les tuiles de quelques pixels.
  - **Mesure DOM plutot que calcul en lignes.** Comparer
    `grid.getRow()` a `gridRows` aurait ignore le `padding` de `.board`,
    la marge des tuiles et l'arrondi `Math.floor` d'`updateCellHeight`.
    La tolerance de 1px absorbe les arrondis sous-pixel, qui faisaient
    autrement clignoter l'ascenseur a certains facteurs de zoom.
  - **Molette** : aucun code. `overflow-y: auto` suffit, et le
    comportement natif (l'enfant defilant consomme d'abord) est celui
    attendu. La carte Trafic conserve donc son zoom a la molette,
    Leaflet appelant `preventDefault()`.
  - **Tactile : deux doigts.** Un seul doigt reste integralement
    disponible aux widgets (deplacer la carte, faire defiler la liste
    des courriels). `touch-action: none` sur `.board.has-overflow`
    empeche le navigateur de s'approprier le glissement a un doigt --
    avec sa contrepartie indispensable `touch-action: auto` sur
    `.grid-stack-item-content`, car `touch-action` se resout en
    remontant la chaine des ancetres et aurait sinon supprime AUSSI le
    defilement a un doigt A L'INTERIEUR des tuiles. Ecouteur en
    `passive: false` (sans quoi `preventDefault()` est ignore) et en
    capture (pour passer avant les gestionnaires des widgets).
  - **Defilement automatique vers une tuile posee hors champ**, a
    l'ajout : sans cela, la personne n'a aucun indice de l'endroit ou sa
    tuile a atterri -- c'etait exactement le symptome d'origine.
  - `scrollTop` remis a zero en entrant en mode edition : Gridstack
    calcule les positions de glisser-deposer par rapport au haut de sa
    grille, une prise aurait ete decalee du montant du defilement.
  - `mountTile()` renvoie desormais son enregistrement, pour que
    `addTile()` puisse agir sur la tuile qui vient d'etre montee.

- **Aucun changement au redimensionnement des tuiles.** Verifie :
  `updateCellHeight()` derive la hauteur de cellule de
  `window.innerHeight`, jamais de la hauteur du contenu -- la dependance
  ne va que dans un sens, il n'y a donc aucune boucle de retour.
  `updateOverflow()` est appelee APRES le recalcul dans le gestionnaire
  `resize`, sinon elle mesurerait la hauteur d'avant redimensionnement.
  Quand la fenetre retrecit, les tuiles rapetissent proportionnellement
  comme avant et une disposition qui tenait continue de tenir.

- **Aide** : nouvelle rubrique "Quand une tuile ne tient plus a l'ecran"
  dans la fiche Presentation (FR/EN).

- **Tests** : 9 assertions ajoutees a `dom-smoke.js`, dont la
  verification que `.board` reste en `overflow: hidden` par defaut et que
  le defilement a un doigt reste actif dans les tuiles.

## 1.67.1

- **Correctif : la tuile Courriel pouvait faire planter l'application
  entiere.** Un delai d'attente reseau pendant la lecture de la boite
  faisait apparaitre la boite modale Windows "A JavaScript error
  occurred in the main process" (message `Error: Socket timeout`), et
  vidait la tuile jusqu'au rafraichissement suivant. Les deux symptomes
  n'etaient pas deux bugs mais un seul evenement sortant par deux
  chemins.
  - **Cause racine.** `ImapFlow` etend `EventEmitter`. Lors d'un timeout
    socket, imapflow appelle `emitError()`, qui se termine par
    `this.emit("error", err)`. Node relance en `throw` tout evenement
    `error` emis sans auditeur -- et aucun n'etait pose sur le client.
    Comme cette emission a lieu dans un callback de minuterie, hors de
    toute pile d'appel `async`, le `try/catch` des routes `/api/mail`
    ne pouvait STRUCTURELLEMENT pas l'attraper : il ne voyait que le
    rejet de la promesse, correctement traite en `502`. L'erreur
    remontait donc en `uncaughtException` jusqu'au processus principal.
  - **Correction** : ajout de l'auditeur `client.on("error", ...)`
    manquant dans `clientFor()`. C'est le correctif de fond ; le reste
    ci-dessous est du durcissement.
  - `socketTimeout` dissocie des delais d'etablissement et porte de 15 s
    a 40 s : les trois options partageaient la meme constante, si bien
    qu'une grosse boite mettant plus de 15 s a renvoyer 25 enveloppes
    declenchait un faux timeout en pleine lecture.
    `connectionTimeout` et `greetingTimeout` restent a 15 s -- une
    connexion doit toujours echouer vite.
  - `logout()` remplace par `close()` quand la connexion est deja tombee
    (`client.usable`) : un `logout()` sur socket mort attend une reponse
    qui ne viendra jamais.

- **Filet de securite global dans le processus principal Electron.**
  `uncaughtException` et `unhandledRejection` sont desormais journalises
  dans `piboard.log` au lieu de faire surgir un dialogue bloquant. Sur un
  PiBoard mural, personne n'est la pour cliquer sur OK : le tableau
  restait fige derriere la boite. Ce filet ne remplace pas le traitement
  des erreurs a la source, il evite qu'un cas non anticipe n'immobilise
  l'affichage.

## 1.67.0

- **Aide d'un widget accessible depuis sa fenetre de configuration.** Un
  bouton `?` apparait dans l'en-tete des reglages d'une tuile et ouvre
  une seconde fenetre contenant UNIQUEMENT la fiche de ce widget, sans
  le sommaire ni les autres sections de l'aide generale.
  - La fenetre de configuration reste ouverte dessous : consulter l'aide
    ne fait pas perdre les reglages en cours de saisie.
  - Meme source de contenu que l'aide generale (`window.PIBOARD_HELP`,
    ou l'identifiant d'une fiche de tuile est celui du widget) : il n'y a
    qu'un seul contenu a tenir a jour, et une fiche ajoutee la apparait
    automatiquement ici.
  - Le bouton est masque si le widget n'a pas de fiche : proposer une
    aide vide serait pire que ne rien proposer.
  - `z-index` superieur (`.modal-stacked`) : toutes les fenetres du
    tableau etant a 1000, l'aide se serait ouverte DERRIERE la fenetre
    qui l'appelle, l'ordre du DOM tranchant a egalite.
  - Fermer la configuration referme aussi l'aide : c'est une fenetre
    SOEUR et non une fenetre fille, elle serait sinon restee a flotter
    seule au-dessus du tableau. Les trois sorties de la configuration
    (croix, enregistrement, suppression de la tuile) sont couvertes.
  - `#tileModal .modal-head h2` passe en `flex: 1` pour que le `?` et la
    croix restent groupes a droite (l'en-tete est en `space-between`, un
    troisieme element s'y serait retrouve isole au milieu). Regle
    limitee a cette fenetre pour ne rien changer aux autres.

- **Aide : mise a jour du contenu, en retard sur plusieurs versions.**
  - **Fiche Programme TV ajoutee** : elle manquait completement, c'etait
    le seul widget sans aide. Couvre les trois vues, la grille plein
    ecran, les rappels, et surtout l'explication du choix de la premiere
    partie de soiree (fenetre horaire acceptee + duree minimale), qui
    est le reglage a ajuster quand une chaine affiche la mauvaise
    emission.
  - **Bloc-notes** : la fiche ne mentionnait ni la barre d'outils, ni les
    notes multiples en onglets, ni la couleur par note (1.65 et 1.66).
  - **Agenda** : ajout du detail complet d'un evenement au clic sur une
    pastille de la vue semaine (1.64).
  - **Diaporama** : ajout de l'appairage de deux photos portrait (1.65),
    et correction d'une erreur ancienne -- la fiche annoncait "quatre
    sources" alors que la cle USB en fait une cinquieme.
  - Verification automatisee ajoutee : chaque widget du catalogue doit
    avoir une fiche, chaque fiche doit correspondre a un widget existant,
    et toutes doivent etre bilingues et non vides. Correspondance
    actuelle : 24 widgets, 24 fiches, aucun orphelin.
  - La section "Nouveautes" lit deja le CHANGELOG en direct : elle etait
    donc a jour, et le reste.
  - 17 assertions ajoutees a `test/dom-smoke.js`.

---

## 1.66.1

- **Bloc-notes : cases a cocher desormais alignees verticalement sur leur
  ligne de texte.** Deux causes se cumulaient :
  - **Cause racine :** un `<button>` n'herite pas de la police de son
    parent (regle du navigateur), et aucun `button { font: inherit }`
    global n'existe dans `style.css`. Les unites `em` de `.pwn-check` se
    resolvaient donc sur la police par defaut du navigateur (~13.3 px) et
    non sur celle de la note. La case gardait une taille fixe d'environ
    14 px quelle que soit la taille du texte, alors que l'ajustement
    automatique la fait varier de 12 a 30 px : l'alignement etait correct
    vers 13 px, et de plus en plus decale a mesure que le texte
    grandissait -- donc d'autant plus visible sur une grande tuile.
    Corrige par `font: inherit`.
  - L'ancien `margin-top: 0.22em` etait une valeur ajustee a l'oeil,
    juste pour une seule combinaison taille/interligne. Elle est
    remplacee par un centrage structurel : le bouton occupe exactement la
    hauteur d'une ligne (1.5em, l'interligne de `.pwn-view`) et le carre
    visible y est centre par flexbox. Plus aucun nombre magique, et le
    resultat suit automatiquement toute taille de police.
  - La coche passe de `::after` (positionne en `inset: 0` sur le bouton,
    qui mesure desormais 1.5em) au fond de `::before`, qui porte le carre.
  - `.pwn-task` conserve `align-items: flex-start` : sur une tache de
    plusieurs lignes, la case reste alignee sur la PREMIERE ligne.
  - Verification faite que le meme piege ne touchait aucun autre widget :
    `.pwrd-btn` (radar) est dimensionne en px, `.pwrd-time` est un
    `<span>` qui herite correctement.
  - Correctif purement CSS, aucun code JS modifie.

---

## 1.66.0

- **Bloc-notes : plusieurs notes en onglets, avec couleur par note.**
  Une meme tuile peut desormais contenir plusieurs notes, chacune sur son
  onglet. Le bouton `+` de la barre d'outils en cree une, le bouton de
  couleur lui affecte une teinte tres pale pour la distinguer de sa
  voisine.
  - **Compatibilite ascendante : les deux formats de stockage precedents
    sont toujours lus** et convertis en une note unique -- la chaine brute
    du tout premier format, et `{text, updatedAt}` du format a note
    unique. Une note existante ne peut donc pas disparaitre a la mise a
    jour. La conversion n'est ecrite qu'a la premiere modification, pour
    ne pas ecrire en base au simple montage d'une tuile jamais touchee.
  - `this.text` et `this.updatedAt` sont devenus des accesseurs pointant
    sur la note active : tout le code existant (`toggleTask`, `render`,
    `save`, `fit`, `startEdit`/`stopEdit`) fonctionne sans modification.
  - Le libelle d'onglet est deduit de la premiere ligne non vide,
    marqueurs de mise en forme retires : aucune etape de nommage n'est
    imposee a la creation.
  - L'onglet actif est memorise par identifiant et non par position :
    supprimer une note ne fait pas glisser la selection sur une autre.
  - La barre d'onglets n'apparait qu'a partir de deux notes, et defile
    horizontalement plutot que de se replier sur deux lignes (elle
    mangerait la note sur une petite tuile).
  - Changer d'onglet valide d'abord l'edition en cours : le texte tape
    depuis la derniere sauvegarde differee (800 ms) n'est pas perdu.
  - Couleurs volontairement bien plus pales que les couleurs post-it de
    la tuile, dont elles sont independantes : elles s'y superposent et
    doivent rester lisibles sous du texte. La teinte est reportee sur
    l'onglet, ce qui permet de distinguer une note sans l'ouvrir.
  - La palette est une rangee INTERNE au widget et non une fenetre
    flottante : la grille Gridstack rogne tout ce qui deborde de la tuile
    (`overflow: hidden`), un menu ancre ici aurait ete coupe.
  - **Correctif lie :** `applySettings()` reconstruit `root.className`
    depuis zero. Sans rappel explicite a `applyNoteColor()`, la teinte de
    la note disparaissait silencieusement au moindre changement de
    reglages. Les deux appels sont concernes.
  - Bouton de suppression ajoute : sans lui, on ne pouvait qu'ajouter des
    notes. Confirmation demandee ; supprimer la derniere note la vide au
    lieu de la retirer, pour que le bloc-notes reste utilisable.
  - 25 assertions ajoutees a `test/dom-smoke.js`.

---

## 1.65.0

- **Diaporama : deux photos portrait accolees plutot qu'une seule bordee
  de deux bandes vides.** Sur une tuile plus large que haute, une photo
  portrait affichee en entier laissait une large bande de chaque cote.
  Quand deux photos portrait se suivent, elles sont desormais affichees
  cote a cote, separees d'un fin espace (8 px) pour qu'elles ne se
  touchent jamais.
  - Aucun changement de structure HTML : les diapositives etant deja en
    position absolue avec `inset: 0`, il suffit de redefinir un seul cote
    de chacune (`right` pour la gauche, `left` pour la droite) et de leur
    poser la classe `pws-active` en meme temps.
  - Trois conditions, toutes necessaires : tuile plus large que haute,
    deux photos portrait, et orientations deja connues. Une photo dont
    l'image n'est pas encore chargee n'est jamais appairee -- l'affichage
    reste alors celui d'avant, jamais casse.
  - Seules deux photos CONSECUTIVES sont appairees : l'ordre voulu
    (chronologique ou aleatoire) n'est jamais modifie. Deux portraits
    separes par un paysage ne sont donc pas rapproches.
  - `next()` avance de 2 apres une paire, sinon de 1 : sans cela la
    seconde photo de la paire reapparaissait seule juste apres.
  - Les deux premieres images sont desormais attendues au demarrage (et
    non la seule premiere) : l'appairage exige de connaitre l'orientation
    de la suivante, faute de quoi la toute premiere vue manquait
    systematiquement son appairage alors que les suivantes l'obtenaient.
  - Reglage `Accoler deux photos portrait cote a cote` (groupe Cadrage),
    active par defaut, pour revenir au comportement precedent.
  - Nouveau fichier `test/slideshowPair.test.js` : 10 scenarios couvrant
    l'appairage, son absence, la progression et le nettoyage des classes.

- **Bloc-notes : mini barre d'outils de mise en forme.** Cases a cocher,
  gras, italique, barre, et bascule Titre / Normal. La barre n'apparait
  qu'en edition : elle agit sur le texte source, elle n'aurait aucun sens
  sur la vue rendue et volerait de la place a la note le reste du temps.
  - Piege traite : sans `preventDefault()`, appuyer sur un bouton retirait
    le focus du `<textarea>`, dont l'evenement `blur` refermait l'editeur
    AVANT que l'action s'applique -- le bouton aurait semble sans effet,
    de facon totalement silencieuse. Les boutons ecoutent donc
    `pointerdown` (et non `click`) avec `preventDefault()`, un seul
    evenement car sur ecran tactile un `pointerdown` annule n'est pas
    garanti d'etre suivi d'un `click`.
  - Le barre `~~texte~~` est ajoute au Markdown leger du widget (il n'y
    existait pas) et rendu en `<s>`.
  - Chaque bouton bascule : reappuyer retire le marqueur au lieu de
    l'empiler. Les cases a cocher s'appliquent a toutes les lignes
    selectionnees d'un coup, avec bascule groupee.
  - Les marqueurs de bloc sont exclusifs : un titre transforme en case a
    cocher perd son prefixe de titre.
  - Les lignes vides ne recoivent jamais de marqueur.
  - L'historique d'annulation du navigateur est preserve quand
    `execCommand("insertText")` est disponible, avec repli sur une
    affectation directe de `.value`.
  - 29 assertions ajoutees a `test/dom-smoke.js`.

---

## 1.64.0

- **Installateur Windows : correctif du correctif 1.63.1 -- la
  compilation echouait purement et simplement.** Le remplacement de
  `NSISdl` par `inetc` etait juste sur le fond (WinINet gere HTTPS et
  les redirections), mais `inetc` est un plugin TIERS, absent de la
  distribution NSIS minimale qu'electron-builder telecharge dans son
  propre cache. `npm run publish` s'arretait donc sur
  `Plugin not found, cannot call inetc::get`, et aucun installateur
  1.63.1 n'a pu etre produit.
  - Bascule sur `curl.exe`, livre nativement avec Windows depuis la
    version 10 1803 : gere HTTPS et les redirections (`-L`), et surtout
    ne demande AUCUNE dependance a la compilation. Vendorer `INetC.dll`
    aurait impose de versionner une DLL et de la reinjecter via
    `!addplugindir` a chaque nettoyage du cache d'electron-builder.
  - `--fail` transforme une reponse HTTP 4xx/5xx en code de sortie non
    nul : sans lui, une page d'erreur serait enregistree telle quelle
    dans le `.zip` et l'echec ne se verrait qu'a l'extraction.
  - Le test de reussite passe de `$0 != "OK"` (convention `inetc`) a
    `$0 != "0"` (code de sortie du processus renvoye par `nsExec`) --
    sans ce changement, un telechargement REUSSI aurait ete lu comme un
    echec.
  - Nouvelle fonction `ResolveCurl` : l'installateur NSIS etant un
    binaire 32 bits, la redirection WOW64 fait pointer `$SYSDIR` vers
    `SysWOW64`. `$WINDIR\Sysnative`, `$WINDIR\System32` puis le `PATH`
    sont couverts en repli.
  - Correctif verifie par compilation reelle : le script echoue bien sur
    `Plugin not found` avant, et compile sans erreur apres.

- **Agenda : le detail complet d'un evenement s'ouvre au clic sur une
  pastille de la vue semaine.** Les colonnes de la vue semaine sont
  etroites et le libelle y est tronque a deux lignes -- le titre entier
  etait donc souvent illisible. Un clic (ou Entree/Espace au clavier)
  ouvre desormais une surcouche avec le titre complet, la date et la
  plage horaire, le lieu et la description.
  - Le champ `DESCRIPTION` des flux ICS est desormais lu et propage aux
    occurrences, y compris pour les instances redefinies
    (`RECURRENCE-ID`), qui heritent de la description de la serie quand
    elles n'en portent pas.
  - La surcouche est montee sur `document.body` et non dans la tuile :
    la grille Gridstack rogne tout ce qui deborde (`overflow: hidden`),
    une fenetre ancree a l'interieur aurait ete coupee. Elle est fermee
    explicitement dans `destroy()`, sans quoi elle survivrait au retrait
    de la tuile.
  - Fermeture par la croix, par le fond, ou par Echap. Un clic dans la
    boite ne ferme pas.
  - Les lignes vides sont omises : un evenement sans lieu ni description
    n'affiche que sa date et son horaire.
  - Titre et valeurs inseres via `textContent` et non `innerHTML` : le
    contenu vient d'un flux externe et peut comporter `<` ou `&`.
  - Les animations sont desactivees si le systeme demande de les reduire
    (`prefers-reduced-motion`).
  - 20 assertions ajoutees a `test/dom-smoke.js`.

---

## 1.63.1

- **Correctif installateur Windows : ffmpeg (et VLC) restaient
  souvent non installés malgré la case cochée.** Cause identifiée et
  confirmée (documentation officielle NSIS + retours d'utilisateurs) :
  le plugin utilisé pour le téléchargement, `NSISdl`, télécharge
  **toujours en HTTP, même pour une adresse `https://`**, et échoue
  par délai dépassé dès que le lien redirige de HTTP vers HTTPS —
  exactement le cas d'un lien de release GitHub, qui redirige vers son
  service de stockage de fichiers. L'échec passait totalement
  inaperçu : seul un message technique (`DetailPrint`), jamais
  consulté en usage normal, en gardait la trace.
  - Remplacé par `inetc`, le plugin qu'electron-builder utilise
    lui-même pour sa propre fonctionnalité de téléchargement web — il
    s'appuie sur WinINet (le moteur réseau de Windows) et gère
    correctement HTTPS et les redirections.
  - Une vérification a posteriori confirme désormais que le fichier
    est bien arrivé à destination après extraction, pour qu'un futur
    problème à cette étape ne reste plus invisible non plus.
  - Le même correctif s'applique à VLC (composant optionnel similaire,
    touché par exactement le même défaut).
  - Le contenu réel du fichier de release ffmpeg a été vérifié
    directement (téléchargé et inspecté) pour confirmer que la
    structure attendue par le script d'installation (fichiers à la
    racine de l'archive) correspond bien à la réalité.

---

- **Windows installer fix: ffmpeg (and VLC) often stayed uninstalled
  despite the checkbox being checked.** Root cause identified and
  confirmed (official NSIS documentation + user reports): the plugin
  used for downloading, `NSISdl`, **always downloads over HTTP, even
  for an `https://` address**, and fails with a timeout as soon as the
  link redirects from HTTP to HTTPS — exactly the case for a GitHub
  release link, which redirects to its file storage service. The
  failure went completely unnoticed: only a technical message
  (`DetailPrint`), never consulted in normal use, kept any trace of
  it.
  - Replaced with `inetc`, the plugin electron-builder itself uses for
    its own web-download installer feature — it relies on WinINet
    (Windows' network engine) and correctly handles HTTPS and
    redirects.
  - A post-download check now confirms the file genuinely landed after
    extraction, so a future problem at that step won't stay invisible
    either.
  - The same fix applies to VLC (a similar optional component, hit by
    the exact same flaw).
  - The ffmpeg release file's actual content was directly verified
    (downloaded and inspected) to confirm the structure the install
    script expects (files at the archive's root) genuinely matches
    reality.

## 1.63.0

- **Agenda : navigation dans la vue semaine, et nouvelle option pour
  ancrer aujourd'hui en début ou au milieu de la grille.**
  - Des flèches ‹ › déplacent désormais la fenêtre affichée d'une
    semaine entière à la fois, sans aucun temps de chargement (tous
    les événements sont déjà en mémoire, seule la fenêtre affichée
    change). Une étiquette centrale rappelle la période affichée, se
    met en évidence dès qu'on s'éloigne de la semaine actuelle, et
    ramène directement à aujourd'hui d'un geste.
  - Nouveau réglage **« Disposition de la grille semaine »** : en plus
    de la semaine calendaire classique (comportement inchangé), deux
    fenêtres glissantes toujours ancrées sur aujourd'hui — en première
    colonne, ou centrée au milieu du tableau — pour ne jamais avoir de
    jours passés vides à l'écran.
  - Quitter puis revenir sur l'onglet Semaine réinitialise toujours la
    navigation à la semaine actuelle ; un simple re-clic sur l'onglet
    déjà actif, lui, préserve la position en cours.

---

- **Calendar: navigation in the week view, and a new option to anchor
  today at the start or in the middle of the grid.**
  - ‹ › arrows now move the displayed window a full week at a time,
    with no loading delay at all (every event is already in memory,
    only the displayed window changes). A center label recalls the
    displayed period, lights up as soon as you've navigated away from
    the current week, and jumps straight back to today with one tap.
  - New **"Week grid layout"** setting: besides the standard calendar
    week (unchanged behavior), two sliding windows always anchored on
    today — in the first column, or centered in the middle of the
    grid — so you never have empty past days on screen.
  - Leaving and returning to the Week tab always resets navigation
    back to the current week; a plain re-click on the already-active
    tab, on the other hand, keeps the current position.

## 1.62.1

- **Catalogue : segmentation affinée en 8 familles.** L'ancienne
  famille « Informations » regroupait 7 tuiles sans grand rapport
  entre elles (actualités, trafic, avions, finance, diagnostic
  système…). Deux nouvelles familles en sont extraites : **Déplacements**
  (Carte de trafic, Trajet domicile-travail, Avions en vue) et
  **Système & Réseau** (État système, Analyse réseau — ce dernier
  quittant « Divers »). « Informations » se recentre sur le contenu
  qu'on consulte (Flux RSS, Page web, Cours Cryptos).
- **Nettoyage de commentaires résiduels** faisant encore référence à
  l'ancienne tuile Caméra (retirée du projet il y a plusieurs
  versions) — aucun code fonctionnel n'était concerné, le catalogue
  ne l'a jamais proposée depuis son retrait complet.

---

- **Catalog: refined into 8 families.** The old "Information" family
  grouped 7 largely unrelated tiles (news, traffic, planes, finance,
  system diagnostics…). Two new families are split out of it: **Getting
  around** (Traffic map, Home-work commute, Planes nearby) and **System
  & Network** (System status, Network scan — the latter moving out of
  "Miscellaneous"). "Information" now focuses on content you consult
  (RSS feed, Web page, Crypto prices).
- **Cleaned up leftover comments** still referencing the old Camera
  tile (removed from the project several versions ago) — no
  functional code was involved, the catalog has never offered it
  since its full removal.

## 1.62.0

- **Catalogue de tuiles regroupé par familles.** Le catalogue
  présentait jusqu'ici une seule longue liste ; les tuiles sont
  désormais rangées sous six en-têtes : **Météo**, **Informations**,
  **Personnel**, **Divertissement**, **Sport** et **Divers**. L'ordre
  des familles, comme celui des tuiles au sein de chacune, est un
  classement délibéré (les plus courantes d'abord) plutôt qu'un tri
  alphabétique. Une tuile qui ne serait rattachée à aucune famille
  rejoint automatiquement « Divers » — ajouter un widget sans toucher
  au classement reste donc sans danger.

---

- **Tile catalog grouped into families.** The catalog used to be one
  long list; tiles are now filed under six headers: **Weather**,
  **Information**, **Personal**, **Entertainment**, **Sport** and
  **Miscellaneous**. The order of the families, like that of the tiles
  within each, is a deliberate ordering (most common first) rather
  than an alphabetical sort. A tile attached to no family
  automatically joins "Miscellaneous" — adding a widget without
  touching the classification is therefore harmless.

## 1.61.0

- **Cours Cryptos : amélioration de la fenêtre de courbe.**
  - **Traits de repère sur l'axe des ordonnées**, en fond du
    graphique, avec une valeur de prix « ronde » en regard de chacun
    (par exemple des multiples de 5 000 plutôt que les valeurs exactes
    de la série) — pratique pour évaluer les fluctuations d'un coup
    d'œil.
  - **Logo de la crypto** affiché à gauche de son nom, quand elle fait
    partie des cryptos les plus courantes (celles gérées par Binance,
    voir 1.60.0) ; absent pour les cryptos plus confidentielles,
    plutôt qu'un logo générique trompeur.
  - **Couleurs personnalisables** : fond du graphique, couleur de la
    courbe et couleur des traits de repère se règlent chacune
    indépendamment dans les réglages de la tuile.

---

- **Crypto prices: chart window improvements.**
  - **Y-axis reference lines**, in the chart's background, with a
    "round" price value next to each (e.g. multiples of 5,000 rather
    than the series' exact values) — handy for gauging fluctuations at
    a glance.
  - **Coin logo** shown left of its name, when it's among the most
    common coins (the ones managed by Binance, see 1.60.0); absent for
    more niche coins, rather than a misleading generic logo.
  - **Customizable colors**: chart background, curve color and
    reference-line color can each be set independently in the tile's
    settings.

## 1.60.0

- **Cours Cryptos : Binance ajouté comme source principale, CoinGecko
  passe en repli.** L'API publique de Binance (données de marché, sans
  compte ni clé) accepte un débit de 6000 points de « poids » par
  minute — sans commune mesure avec les 5 à 15 requêtes/minute de
  CoinGecko sans clé, partagées par toute l'adresse IP du foyer, qui
  restaient la vraie cause des échecs malgré le cache et l'espacement
  ajoutés en 1.59.x.
  - Pour toute cryptomonnaie courante (~150 références : Bitcoin,
    Ethereum, et la plupart des autres cryptos usuelles), les cours et
    les courbes passent désormais **exclusivement par Binance** —
    CoinGecko n'est même plus sollicité.
  - Pour une cryptomonnaie plus confidentielle que Binance ne
    référence pas, ou en cas de panne ponctuelle de Binance, **repli
    automatique et transparent sur CoinGecko**, exactement comme
    avant.
  - Le cache passe d'un cache par lot de requête à un **cache par
    cryptomonnaie individuelle** : dans une liste de plusieurs cours,
    ceux déjà frais restent servis depuis le cache pendant que seuls
    les autres sont rafraîchis, quelle que soit la source qui les a
    fournis.
  - Aucun réglage à changer : les identifiants saisis dans la tuile
    restent les mêmes (identifiants CoinGecko), la correspondance vers
    Binance se fait automatiquement en coulisses.

---

- **Crypto prices: Binance added as the main source, CoinGecko
  demoted to fallback.** Binance's public API (market data, no
  account or key needed) allows 6000 "weight" points per minute —
  nothing like CoinGecko's keyless 5 to 15 requests/minute, shared by
  the household's entire IP address, which remained the real cause of
  failures despite the caching and spacing added in 1.59.x.
  - For any common coin (~150 references: Bitcoin, Ethereum, and most
    other usual coins), prices and charts now go **exclusively
    through Binance** — CoinGecko isn't even queried anymore.
  - For a more niche coin Binance doesn't list, or during a momentary
    Binance outage, **automatic, transparent fallback to CoinGecko**,
    exactly as before.
  - The cache moved from per-request-batch to **per individual coin**:
    within a list of several prices, the ones already fresh keep being
    served from cache while only the rest get refreshed, whichever
    source provided them.
  - No setting to change: the identifiers typed into the tile stay the
    same (CoinGecko identifiers), the mapping to Binance happens
    automatically behind the scenes.

## 1.59.2

- **Application de bureau Windows : nouveau menu « Ouvrir le journal ».**
  Une application Windows installée n'affiche aucune console par
  défaut — les messages techniques du serveur PiBoard (par exemple un
  échec d'accès à CoinGecko pour la tuile Cours Cryptos) étaient donc
  invisibles, y compris via les Outils de développement (qui ne
  montrent que la fenêtre elle-même, pas le serveur). Un fichier
  journal est désormais tenu à jour en continu et accessible via
  `Alt` → **Ouvrir le journal**, remis à zéro à chaque démarrage de
  l'application.

- **Cours Cryptos : espacement entre requêtes resserré, calé sur le
  pire cas documenté par CoinGecko (5/min) plutôt que le meilleur
  (15/min).** Explique un symptôme précis : parcourir plusieurs
  cryptos à la suite pouvait épuiser le quota en cours de route, la
  ou les premières cryptos consultées fonctionnant sur toutes les
  durées tandis que la dernière échouait au-delà de la plus courte.
  Ce n'est donc pas propre à une crypto en particulier.

---

- **Windows desktop app: new "Open log" menu item.** An installed
  Windows application shows no console by default — the PiBoard
  server's technical messages (for instance a failed CoinGecko
  request for the Crypto prices tile) were therefore invisible, even
  through Developer Tools (which only show the window itself, not the
  server). A log file is now kept continuously up to date and
  reachable via `Alt` → **Open log**, reset on every app launch.

- **Crypto prices: request spacing tightened, calibrated on
  CoinGecko's worst documented case (5/min) rather than the best
  (15/min).** Explains a specific symptom: browsing through several
  coins in a row could exhaust the quota partway through, with the
  first coin(s) checked working across every duration while the last
  one failed past the shortest. Not specific to any one coin, then.

## 1.59.1

- **Cours Cryptos : délai d'attente allongé pour les courbes.** 10 s
  pouvaient être insuffisantes pour une courbe sur 1 an (davantage de
  points à recevoir et traiter qu'une courbe 24h) sur la connexion
  parfois plus lente d'un Raspberry Pi — porté à 25 s pour les courbes
  (15 s pour les cours). Amélioration de robustesse ; si le message
  « Courbe indisponible » persiste après cette mise à jour, la cause
  exacte apparaît désormais dans la console du serveur PiBoard (ligne
  commençant par `[piboard] crypto chart echec ->`).

---

- **Crypto prices: longer timeout for charts.** 10s could be too short
  for a 1-year chart (more points to receive and process than a 24h
  one) on a Raspberry Pi's sometimes slower connection — raised to 25s
  for charts (15s for prices). Robustness improvement; if "Chart
  unavailable" persists after this update, the exact cause now shows
  up in the PiBoard server console (line starting with `[piboard]
  crypto chart echec ->`).

## 1.59.0

- **Renommage : « Cours de cryptos » devient « Cours Cryptos ».**

- **Correctif : la tuile Cours Cryptos échouait souvent à afficher les
  courbes, sur une durée en particulier ou sur l'ensemble.** Cause
  identifiée : le widget appelait l'API publique CoinGecko
  **directement depuis le navigateur**, sans clé — cette API est
  plafonnée à seulement **5 à 15 requêtes par minute, partagées par
  toute l'adresse IP du foyer** (pas par appareil). Un simple
  rafraîchissement automatique combiné à la consultation d'une courbe
  suffisait à épuiser ce quota, d'où des échecs fréquents et
  imprévisibles.
  - Les cours et les courbes passent désormais par le **serveur
    PiBoard** (nouveau module `server/crypto.js`), qui **met en cache**
    les résultats (cours ~1 min, courbes ~10 min) — un rafraîchissement
    ou une consultation répétée ne redéclenche plus d'appel à
    CoinGecko à chaque fois, quel que soit le nombre d'écrans ouverts.
  - En cas de panne momentanée de CoinGecko, la **dernière valeur
    connue** reste affichée plutôt que de disparaître, avec un discret
    rappel « dernières valeurs connues » plutôt qu'une erreur ou une
    tuile vide.
  - Un espacement minimal entre les appels sortants protège le quota
    même en cas de consultation de plusieurs cryptos/courbes jamais
    vues à la fois.

---

- **French display name simplified: "Cours de cryptos" → "Cours
  Cryptos".** (English name unchanged: "Crypto prices".)

- **Fix: the Crypto prices tile often failed to show charts, for one
  specific duration or for all of them.** Root cause identified: the
  widget called CoinGecko's public API **directly from the browser**,
  without a key — that API is capped at only **5 to 15 requests per
  minute, shared by the household's entire IP address** (not per
  device). A plain automatic refresh combined with viewing a chart was
  enough to exhaust that quota, hence frequent, unpredictable
  failures.
  - Prices and charts now go through the **PiBoard server** (new
    `server/crypto.js` module), which **caches** results (prices ~1
    min, charts ~10 min) — refreshing or repeatedly viewing the same
    chart no longer re-triggers a CoinGecko call every time, no matter
    how many screens are open.
  - On a momentary CoinGecko outage, the **last known value** stays
    displayed rather than vanishing, with a discreet "last known
    values" reminder rather than an error or an empty tile.
  - A minimum spacing between outbound calls protects the quota even
    when viewing several never-before-seen coins/charts at once.

## 1.58.1

- **Page web : bouton de rafraîchissement sur chaque onglet.** Une
  petite icône ⟳ à côté du nom de chaque onglet permet de recharger sa
  page à tout moment — y compris celui déjà affiché, puisqu'un simple
  clic sur l'onglet actif ne fait normalement rien.

---

- **Web page: refresh button on each tab.** A small ⟳ icon next to
  each tab's name reloads its page at any time — including the one
  already shown, since a plain click on the active tab normally does
  nothing.

## 1.58.0

- **Tuile Page web : jusqu'à 5 sites, basculables par onglets.** Une
  barre d'onglets apparaît en haut de la tuile dès qu'un deuxième site
  est configuré (« Site 2 » à « Site 5 » dans les réglages) — masquée
  tant qu'un seul site est renseigné, pour ne rien encombrer
  inutilement dans le cas d'usage le plus courant. Un nom d'onglet
  personnalisé peut être donné à chacun ; à défaut, le nom de domaine
  du site est utilisé. Seul l'onglet actif est réellement chargé :
  passer d'un onglet à l'autre remplace le contenu affiché plutôt que
  de garder les 5 sites actifs en même temps — un seul site à la fois
  suffit déjà à solliciter le réseau ou, en mode Image, à relancer un
  navigateur. Mode d'affichage, zoom et intervalle de rechargement
  restent des réglages communs, appliqués à l'onglet actif. Tuiles déjà
  configurées avant cette mise à jour : leur site s'affiche
  automatiquement dans le premier onglet, sans rien à reconfigurer.

---

- **Web page tile: up to 5 sites, switchable via tabs.** A tab bar
  appears at the top of the tile as soon as a second site is
  configured ("Site 2" through "Site 5" in the settings) — hidden
  while only one site is filled in, so nothing is cluttered needlessly
  in the most common use case. A custom tab name can be given to each;
  otherwise the site's domain name is used. Only the active tab is
  actually loaded: switching tabs replaces the displayed content
  rather than keeping all 5 sites active at once — a single site is
  already enough to load the network or, in Image mode, relaunch a
  browser. Display mode, zoom and reload interval remain shared
  settings, applied to the active tab. Tiles already configured before
  this update: their site now shows automatically in the first tab,
  with nothing to reconfigure.

## 1.57.0

- **Tuile Page web : affichage natif dans l'application de bureau
  Windows.** Sous Windows, PiBoard tourne dans Electron, qui dispose
  d'une capacité qu'un navigateur ordinaire n'a pas : afficher un site
  tiers **en ignorant complètement son en-tête `X-Frame-Options`**,
  tout en le gardant **pleinement interactif** (défilement, clics,
  formulaires) et en lui laissant charger ses ressources normalement.
  C'est désormais le comportement par défaut de la tuile dans
  l'application de bureau — sans détour serveur, sans réécriture de
  page, sans capture d'image.
  Les trois modes précédents restent utiles sur un Raspberry Pi en
  mode kiosque, où cette capacité n'existe pas ; le mode « Image »
  reste également accessible sous Windows si on le choisit
  explicitement.

---

- **Web page tile: native display in the Windows desktop app.** On
  Windows, PiBoard runs inside Electron, which has a capability a
  plain browser doesn't: displaying a third-party site while
  **completely ignoring its `X-Frame-Options` header**, while keeping
  it **fully interactive** (scrolling, clicks, forms) and letting it
  load its resources normally. This is now the tile's default
  behavior in the desktop app — no server round-trip, no page
  rewriting, no screenshot.
  The three previous modes remain useful on a Raspberry Pi in kiosk
  mode, where this capability doesn't exist; "Image" mode also stays
  reachable on Windows if explicitly chosen.

## 1.56.0

- **Tuile Page web : nouveau mode « Image », qui fonctionne avec
  n'importe quel site.** Après l'iframe directe et le relais HTML, une
  troisième approche, radicalement différente : la page est rendue par
  un **vrai navigateur** lancé sur le PiBoard (Chromium en mode sans
  interface — déjà installé sur un Raspberry Pi en kiosque, puisque
  c'est lui qui affiche PiBoard), puis affichée comme une simple image.
  Comme il n'y a plus ni cadre ni relais de code, il ne reste plus rien
  qu'un site puisse bloquer — le JavaScript de la page s'exécute
  normalement avant la capture, contrairement au mode « Via PiBoard ».
  - **Contrepartie assumée** : l'affichage est **fixe** (pas de
    défilement, pas de clic, pas de formulaire). Adapté à une page
    qu'on consulte du regard, pas à un service interactif.
  - Chaque rafraîchissement lance un navigateur et prend quelques
    secondes sur un Pi : un intervalle de rechargement généreux
    (10 minutes ou plus) est recommandé. L'image n'est remplacée
    qu'une fois la nouvelle chargée, sans cadre vide clignotant.
  - En cas d'échec, la raison est journalisée dans la console PiBoard
    et un message s'affiche dans la tuile.

---

- **Web page tile: new "Image" mode, which works with any site.**
  After the direct iframe and the HTML relay, a third, radically
  different approach: the page is rendered by a **real browser**
  launched on the PiBoard (headless Chromium — already installed on a
  Raspberry Pi kiosk, since it's the very browser displaying PiBoard),
  then shown as a plain image. Since there's no longer a frame or
  relayed code, there's nothing left for a site to block — the page's
  JavaScript runs normally before the capture, unlike "Via PiBoard"
  mode.
  - **Accepted trade-off**: the display is **static** (no scrolling,
    no clicking, no forms). Suited to a page you just look at, not an
    interactive service.
  - Each refresh launches a browser and takes a few seconds on a Pi: a
    generous reload interval (10 minutes or more) is recommended. The
    image is only swapped once the new one has loaded, with no
    blinking empty frame.
  - On failure, the reason is logged to the PiBoard console and a
    message is shown in the tile.

## 1.55.2

- **Correctif : la tuile Page web affichait « invalid url » pour une
  adresse tapée sans « https:// ».** Une adresse saisie par réflexe de
  barre de navigateur (ex. « mairiederouffiac.fr » plutôt que
  « https://mairiederouffiac.fr/ ») était rejetée d'emblée en mode
  « Via PiBoard », et aurait été traitée à tort comme un chemin relatif
  en mode « Direct ». Le préfixe « https:// » est désormais ajouté
  automatiquement quand il est omis, dans les deux modes — un schéma
  déjà présent (y compris un schéma incorrect comme `ftp://`, désormais
  détecté correctement) n'est en revanche jamais modifié.

---

- **Fix: the Web page tile showed "invalid url" for an address typed
  without "https://".** An address typed out of browser-address-bar
  habit (e.g. "mairiederouffiac.fr" rather than
  "https://mairiederouffiac.fr/") was rejected outright in "Via
  PiBoard" mode, and would have been wrongly treated as a relative
  path in "Direct" mode. The "https://" prefix is now added
  automatically when left out, in both modes — a scheme already
  present (including an incorrect one like `ftp://`, now correctly
  detected) is never altered.

## 1.55.1

- **Correctif : la tuile Page web pouvait afficher l'erreur générique
  du navigateur (« This page couldn't load ») au lieu du message
  d'erreur lisible de PiBoard.** La route `/api/webview-proxy`
  n'avait aucun filet de sécurité : une exception imprévue laissait la
  requête sans réponse au lieu d'échouer proprement — Express 4 ne
  rattrape pas automatiquement le rejet d'une promesse dans un
  gestionnaire asynchrone. Le navigateur voyait alors une connexion
  qui ne répond jamais et affichait sa propre page d'erreur, dans
  l'iframe de la tuile. Ajout d'un `try/catch` complet autour de la
  route, avec journalisation côté serveur (console) pour faciliter un
  diagnostic si le cas se reproduit — la tuile affiche désormais
  toujours le message d'erreur lisible de PiBoard plutôt qu'une
  connexion qui traîne en longueur.

---

- **Fix: the Web page tile could show the browser's generic error
  ("This page couldn't load") instead of PiBoard's readable error
  message.** The `/api/webview-proxy` route had no safety net: an
  unexpected exception left the request without a response instead of
  failing cleanly — Express 4 doesn't automatically catch a rejected
  promise inside an async handler. The browser then saw a connection
  that never responds and displayed its own error page, inside the
  tile's iframe. Added a full `try/catch` around the route, with
  server-side (console) logging to help diagnose it if it recurs — the
  tile now always shows PiBoard's readable error message rather than a
  hanging connection.

## 1.55.0

- **Correctif : la tuile Page web n'affichait rien pour de nombreux
  sites (page blanche silencieuse, sans erreur).** Cause identifiée :
  la plupart des sites — les sites municipaux et institutionnels
  français en particulier, souvent par conformité RGS/ANSSI — bloquent
  volontairement leur affichage en iframe (en-tête `X-Frame-Options`
  ou CSP `frame-ancestors`), pour se protéger du détournement de clic.
  Sans contournement, Chromium n'affiche rien du tout et ne remonte
  aucune erreur visible. Nouveau mode d'affichage **« Via PiBoard »**
  (activé par défaut) : la page est récupérée par le serveur PiBoard
  puis relayée depuis sa propre adresse, rendant ce blocage sans effet
  — testé et confirmé sur le scénario exact signalé (site avec
  `X-Frame-Options` + CSP). Si la page reste malgré tout inaccessible
  (site injoignable, page introuvable…), un message clair s'affiche
  directement dans la tuile plutôt qu'un vide silencieux. L'ancien
  comportement reste disponible via le mode **« Direct »** (plus
  rapide, garde le site pleinement interactif, mais nécessite que le
  site autorise explicitement son affichage en iframe).

---

- **Fix: the Web page tile showed nothing for many sites (a silent
  blank page, no error).** Root cause identified: most sites — French
  municipal and institutional sites in particular, often for
  RGS/ANSSI compliance — deliberately block being shown in an iframe
  (`X-Frame-Options` header or CSP `frame-ancestors`), as
  anti-clickjacking protection. With no workaround, Chromium displays
  nothing at all and surfaces no visible error. New **"Via PiBoard"**
  display mode (on by default): the page is fetched by the PiBoard
  server then relayed from its own address, making that block
  ineffective — tested and confirmed against the exact reported
  scenario (a site with `X-Frame-Options` + CSP). If the page still
  can't be reached at all (unreachable site, page not found…), a clear
  message shows right in the tile instead of a silent void. The old
  behavior remains available via **"Direct"** mode (faster, keeps the
  site fully interactive, but requires the site to explicitly allow
  being shown in an iframe).

## 1.54.1

- **Un seul tiroir de tuiles ouvert à la fois.** Ouvrir un tiroir
  (gauche, haut ou droite) referme désormais automatiquement celui qui
  était ouvert — plus de superposition à gérer manuellement.
- **Couverture d'écran des tiroirs réglable dans les réglages
  généraux.** Nouvelle section « Tiroirs de tuiles » : un champ par
  tiroir donnant sa couverture en pourcentage, appliqué immédiatement
  (pas besoin du bouton « Enregistrer »). Le glisser-déposer à la
  souris reste plafonné à 96 % (au-delà, la poignée sortirait de
  l'écran et deviendrait insaisissable) ; ces nouveaux champs vont
  jusqu'à **100 %**, la seule voie pour une couverture réellement
  totale de l'écran — le point signalé après la précédente mise à
  jour.

---

- **Only one tile drawer open at a time.** Opening a drawer (left, top
  or right) now automatically closes whichever one was open — no more
  overlap to manage by hand.
- **Drawer screen coverage configurable in general settings.** New
  "Tile drawers" section: one field per drawer giving its coverage as
  a percentage, applied immediately (no need for the "Save" button).
  Mouse dragging stays capped at 96% (beyond that, the handle would
  land off-screen and become ungrabbable); these new fields go all the
  way to **100%**, the only way to reach genuinely full screen
  coverage — the issue flagged after the previous update.

## 1.54.0

- **Deux nouveaux tiroirs de tuiles : en haut et à droite de l'écran.**
  Sur le modèle du tiroir latéral gauche déjà existant, deux tiroirs
  supplémentaires — tiré depuis le bord supérieur et depuis le bord
  droit de l'écran — augmentent la surface d'affichage disponible.
  Chaque tiroir :
  - est **indépendant** des deux autres (ouverture, fermeture et
    contenu propres) et peut rester ouvert en même temps qu'eux ;
  - se **redimensionne à la souris ou au doigt** (poignée sur son
    bord ouvert), jusqu'à recouvrir **quasi intégralement l'écran** —
    la limite est passée de 25–75 % à 10–96 % pour les trois tiroirs,
    gauche compris ;
  - passe **au premier plan** dès qu'on l'ouvre ou qu'on le
    redimensionne, pour rester accessible même quand un autre tiroir,
    déjà très agrandi, le recouvrirait sinon ;
  - reçoit directement une tuile ajoutée pendant qu'il est ouvert
    (celui le plus récemment ouvert, si plusieurs le sont à la fois) ;
    sinon la tuile rejoint le tableau principal, comme avant.
  Widgets toujours actifs en arrière-plan tiroir fermé (comptes à
  rebours, scores en direct...), exactement comme pour le tiroir
  gauche. Les tailles des trois tiroirs sont sauvegardées
  indépendamment ; les tableaux de bord déjà configurés avant cette
  mise à jour conservent la largeur de leur tiroir gauche sans rien à
  reconfigurer.

---

- **Two new tile drawers: at the top and on the right of the
  screen.** Modeled on the already-existing left side drawer, two
  additional drawers — pulled from the screen's top edge and right
  edge — increase the available display surface. Each drawer:
  - is **independent** from the other two (its own open/closed state
    and content) and can stay open at the same time as them;
  - **resizes with the mouse or a finger** (handle on its open edge),
    up to covering **almost the entire screen** — the limit moved from
    25–75% to 10–96% for all three drawers, left included;
  - comes **to the front** as soon as it's opened or resized, staying
    reachable even when another, already much-enlarged drawer would
    otherwise cover it;
  - directly receives a tile added while it's open (the most recently
    opened one, if several are open at once); otherwise the tile joins
    the main board, as before.
  Widgets keep running in the background while their drawer is closed
  (countdowns, live scores...), exactly as with the left drawer. The
  three drawers' sizes are saved independently; dashboards already
  configured before this update keep their left drawer's width with
  nothing to reconfigure.

## 1.53.0

- **Programme TV : grille plein écran façon magazine TV.** Un bandeau
  en bas de la tuile ouvre une grande fenêtre présentant le programme
  sur une véritable échelle de temps :
  - **Une ligne par chaîne**, avec son logo et son numéro TNT à gauche.
    La colonne des chaînes reste visible pendant le défilement
    horizontal.
  - **Blocs proportionnels à la durée** de chaque programme, disposés
    sur l'axe du temps. Le titre est affiché dès que le bloc est assez
    large, et une vignette s'y ajoute quand la place le permet et que
    la source en fournit une. Un clic sur un bloc révèle son synopsis.
  - **Ligne du temps en haut**, graduée à l'heure pleine, plus un
    curseur rouge marquant l'instant présent — la grille s'ouvre
    d'ailleurs cadrée sur « maintenant ».
  - **Zoom** (6 niveaux) pour passer d'une vue d'ensemble de la soirée
    au détail d'une plage horaire précise, en conservant le centre de
    la vue d'un niveau à l'autre.
  - **Recherche** propre à la fenêtre, insensible aux accents : filtre
    par nom de chaîne ou par titre d'émission. Quand un programme
    correspond, sa ligne reste affichée entière (on ne troue pas une
    frise temporelle), le bloc trouvé étant simplement mis en évidence.
  Les durées affichées **avant** et **après** l'heure courante sont
  réglables (0 à 12 h avant, 1 à 48 h après). Un programme dont la
  source ne donne pas d'heure de fin reçoit une durée estimée, signalée
  par un bord en pointillés plutôt qu'écarté de la grille.

---

- **TV guide: full-screen, TV-magazine-style grid.** A bar at the
  bottom of the tile opens a large window laying out the schedule on a
  real time scale:
  - **One row per channel**, with its logo and DTT number on the left.
    The channel column stays visible while scrolling horizontally.
  - **Blocks proportional to each program's duration**, placed along
    the time axis. The title shows as soon as the block is wide
    enough, and a thumbnail is added when there's room and the source
    provides one. Clicking a block reveals its synopsis.
  - **Timeline at the top**, marked on the hour, plus a red marker for
    the current moment — the grid actually opens framed on "now".
  - **Zoom** (6 levels) to go from an overview of the evening to the
    detail of a specific time range, keeping the view's center from one
    level to the next.
  - **Search** within the window, accent-insensitive: filters by
    channel name or program title. When a program matches, its row
    stays fully displayed (you don't punch holes in a timeline), the
    matching block simply being highlighted.
  The hours shown **before** and **after** the current time are
  configurable (0–12 h before, 1–48 h after). A program whose source
  gives no end time gets an estimated duration, flagged with a dashed
  border rather than being dropped from the grid.

## 1.52.2

- **Toutes les fenêtres popup redimensionnables à la souris.** Lecture
  d'un mail, article RSS, détail météo, réglages d'une tuile, aide,
  catalogue… toute fenêtre construite sur le même principe partagé
  (`.modal-card`) peut désormais être agrandie en tirant son coin
  bas-droit — pratique quand un contenu mis en forme (un mail HTML
  complexe, par exemple) a besoin de plus de largeur pour rester
  lisible. Poignée native du navigateur, bornée pour ne jamais
  descendre en dessous d'une taille lisible ni déborder de l'écran.
  N'apparaît qu'avec une souris — masquée en mode tactile, où elle
  n'aurait pas de sens.

---

- **Every popup window resizable with the mouse.** Reading an email,
  an RSS article, weather details, a tile's settings, help, the
  catalog… every window built on the same shared principle
  (`.modal-card`) can now be enlarged by dragging its bottom-right
  corner — handy when formatted content (a complex HTML email, for
  instance) needs more width to stay readable. Native browser handle,
  bounded so it never shrinks below a readable size or overflows the
  screen. Only shows up with a mouse — hidden in touch mode, where it
  wouldn't make sense.

## 1.52.1

- **Toutes les alertes/alarmes/rappels : arrêt en touchant ou cliquant
  n'importe où sur l'écran.** Le mécanisme d'alerte partagé (flash
  plein écran + son) — utilisé par le Compte à rebours, les alarmes de
  l'Horloge et les rappels du Programme TV — s'arrête désormais aussi
  bien via le bouton « Arrêter » dédié d'une tuile qu'en touchant ou
  cliquant n'importe où ailleurs sur l'écran, y compris quand seul le
  son est activé (sans flash). Une pastille discrète « Touchez l'écran
  pour arrêter » le rappelle pendant qu'une alerte est active. Chaque
  widget n'a plus qu'un seul endroit à gérer sa remise à jour
  d'affichage (via `onEnd`, désormais toujours appelé à l'arrêt, quelle
  qu'en soit la cause) plutôt que de la dupliquer dans son propre
  bouton.

---

- **Every alert/alarm/reminder: stop by tapping or clicking anywhere
  on the screen.** The shared alert mechanism (full-screen flash +
  sound) — used by the Countdown, the Clock's alarms, and the TV
  guide's reminders — now stops both via a tile's own dedicated "Stop"
  button and by tapping or clicking anywhere else on the screen,
  including when only sound is enabled (no flash). A discreet "Tap the
  screen to stop" chip reminds you of this while an alert is active.
  Each widget now only has one place to handle its display reset (via
  `onEnd`, now always called on stop, whatever the cause) rather than
  duplicating it in its own button.

## 1.52.0

- **Programme TV : recherche, favoris, barre de progression, rappels.**
  Quatre ajouts à la tuile Programme TV :
  - **Recherche** : une barre filtre en direct les lignes affichées
    (titre, sous-titre, nom de chaîne), insensible aux accents. Ne
    cherche que dans la vue actuellement affichée.
  - **Chaînes favorites en tête** : une étoile sur chaque ligne épingle
    la chaîne en tête de liste, toutes vues confondues. Persisté (survit
    à un rechargement de page).
  - **Barre de progression « en cours »** : une fine barre apparaît sous
    toute émission réellement à l'antenne en ce moment (début ≤
    maintenant ≤ fin), quelle que soit la vue affichée.
  - **Rappel avant le début** : une cloche sur une émission à venir
    programme un rappel X minutes avant son début (réglable). Réutilise
    TEL QUEL l'alerte de tableau déjà utilisée par la tuile Compte à
    rebours (flash plein écran + son synthétisé), avec le même webhook
    de notification optionnel. Persisté : survit à un rechargement de
    page.
  Trois nouveaux réglages d'affichage (barre de recherche, barre de
  progression, activables/désactivables) et un nouveau groupe de
  réglages « Rappels » (délai, flash, son, durée, webhook).

---

- **TV guide: search, favorites, progress bar, reminders.** Four
  additions to the TV guide tile:
  - **Search**: a bar live-filters the displayed rows (title, subtitle,
    channel name), accent-insensitive. Only searches the currently
    displayed view.
  - **Favorite channels pinned to the top**: a star on each row pins
    the channel to the top of the list, across every view. Persisted
    (survives a page reload).
  - **"On air" progress bar**: a thin bar appears under any program
    that's genuinely airing right now (start ≤ now ≤ end), whatever the
    displayed view.
  - **Reminder before start**: a bell on an upcoming program schedules
    a reminder X minutes before it starts (configurable). Reuses AS-IS
    the same board alert already used by the Countdown tile
    (full-screen flash + synthesized sound), with the same optional
    notification webhook. Persisted: survives a page reload.
  Three new display settings (search bar, progress bar, toggleable) and
  a new "Reminders" settings group (delay, flash, sound, duration,
  webhook).

## 1.51.3

- **Horloge : dispositions « côte à côte » écrasées sur une tuile
  portrait étroite.** Corrigé — quand la tuile est réellement trop
  haute et étroite pour accueillir une disposition côte à côte (heure
  + date sur une ligne, cadran + date, horloge + fuseaux additionnels),
  la tuile revient automatiquement à un empilement vertical classique,
  quel que soit le réglage choisi. Avant ce correctif, ces dispositions
  restaient forcées par les réglages sans tenir compte de la forme
  réelle de la tuile, tassant tout le contenu dans une bande
  horizontale minuscule entourée de vide (signalé par capture d'écran).
  Bascule calculée en direct sur les dimensions réelles du cadre (pas
  un nouveau réglage) : rien à configurer, la tuile s'adapte d'elle-
  même en la redimensionnant.

---

- **Clock: "side by side" layouts squeezed on a narrow portrait
  tile.** Fixed — when the tile is genuinely too tall and narrow to
  host a side-by-side layout (time + date on one line, face + date,
  clock + extra time zones), the tile now automatically falls back to
  normal vertical stacking, whatever the chosen setting. Before this
  fix, these layouts stayed forced by settings regardless of the
  tile's actual shape, squeezing all content into a tiny horizontal
  band surrounded by empty space (reported via screenshot). Computed
  live from the frame's actual dimensions (not a new setting): nothing
  to configure, the tile adapts on its own as you resize it.

## 1.51.2

- **Programme TV : numéro de la chaîne TNT.** La tuile affiche
  désormais une petite pastille avec le numéro officiel de la chaîne
  sur la TNT gratuite (ex. « 6 » pour M6, « 21 » pour L'Équipe) devant
  son nom, quand il est connu — basé sur le plan de numérotation Arcom
  en vigueur depuis le 6 juin 2025. Absent pour les chaînes qui n'ont
  plus de canal sur la TNT gratuite (Canal+, C8, NRJ 12). Nouveau
  réglage « Afficher le numéro de la chaîne TNT » (activé par défaut)
  pour le masquer si besoin.

---

- **TV guide: TNT (DTT) channel number.** The tile now shows a small
  badge with the channel's official number on free-to-air French DTT
  (e.g. "6" for M6, "21" for L'Équipe) before its name, when known —
  based on the Arcom numbering plan in effect since June 6, 2025.
  Absent for channels no longer carried on free DTT (Canal+, C8,
  NRJ 12). New "Show TNT channel number" setting (on by default) to
  hide it if you prefer.

## 1.51.1

- **Horloge : le saint du jour bascule à tort « côté à côté » en
  disposition heure/date « Côté à côté ».** Corrigé — le saint du jour
  reste désormais **en dessous de la date** dans tous les cas (réglage
  par défaut), y compris quand l'heure et la date elles-mêmes sont
  affichées côte à côte. Seule une tuile réellement trop basse pour
  accueillir une 2e ligne fait encore basculer automatiquement
  l'affichage sur « côte à côte », comme documenté par le réglage
  « Disposition du saint du jour ».

---

- **Clock: the name day wrongly switched to "side by side" whenever
  the time/date arrangement was itself "side by side".** Fixed — the
  name day now always stays **below the date** (default setting),
  including when the time and date are shown side by side. Only a
  tile genuinely too short for a 2nd line still triggers the
  automatic "side by side" fallback, as documented by the "Name day
  arrangement" setting.

## 1.51.0

- **Chaînes TV en direct : navigation précédent/suivant et curseur de
  volume.** Deux nouveaux boutons dans la barre de contrôle, avec
  rebouclage aux extrémités (comme une vraie télécommande) : depuis la
  dernière chaîne, « suivant » revient à la première, et inversement.

  La navigation s'appuie sur la liste **complète** des chaînes,
  capturée au moment de lancer la lecture — pas une liste filtrée par
  une recherche en cours, qui aurait pu créer un blocage (une seule
  chaîne visible au moment du clic). Absents quand une seule chaîne
  est disponible (rien à naviguer).

  Le bouton muet devient un **curseur de volume** complet : déplacer le
  curseur au-dessus de 0 démute automatiquement, le ramener à 0 remute
  — comportement standard d'un lecteur vidéo, plus seulement muet/non
  muet.

  Vérifié avec le vrai code du widget (pas une simulation isolée),
  dans son contexte réel de navigation Xtream : passage effectif
  d'une chaîne à l'autre, rebouclage aux deux extrémités, absence
  correcte pour la VOD (contrôles natifs déjà suffisants) et pour une
  liste à un seul élément.

---

- **Live TV channels: previous/next navigation and a volume slider.**
  Two new buttons in the control bar, wrapping at the ends (like a
  real remote): from the last channel, "next" goes back to the first,
  and vice versa.

  Navigation relies on the **full** channel list, captured when
  playback starts — not a list filtered by an in-progress search,
  which could have created a dead end (only one channel visible at
  click time). Absent when only one channel is available (nothing to
  navigate).

  The mute button becomes a full **volume slider**: moving it above 0
  automatically unmutes, bringing it back to 0 mutes — standard video
  player behavior, not just mute/unmute anymore.

  Verified with the real widget code (not an isolated simulation), in
  its real Xtream navigation context: actual channel switching,
  wrapping at both ends, correct absence for VOD (native controls
  already sufficient) and for a single-item list.

## 1.50.3

- **Correctif décisif : la construction de l'installeur échouait
  réellement**, expliquant à la fois l'absence de VLC et le retour à
  l'ancien comportement (fenêtre modale) rapportés en v1.50.1/1.50.2.
  Le vrai journal de construction fourni par l'utilisateur a permis de
  trouver la cause exacte : `warning 6010: install function
  "OptDownloadsPageCreate" not referenced`, traité comme une erreur
  fatale par electron-builder — la construction n'a donc jamais
  abouti, et Windows/electron-builder sont probablement restés sur un
  ancien exécutable déjà présent.

  **Cause identifiée avec certitude, reproduite directement avec
  `makensis`** : `assistedInstaller.nsh` (le modèle interne
  d'electron-builder) enveloppe sa déclaration de page dans
  `!ifndef BUILD_UNINSTALLER` — pendant la passe de compilation du
  désinstalleur (où cet indicateur est défini), ma page ne s'insère
  jamais, mais mes fonctions, elles, restaient compilées sans
  condition, provoquant exactement l'avertissement observé.

  Variables, macro et fonctions désormais enveloppées dans la même
  condition. **Vérifié en reproduisant l'échec exact** (même message
  exact que dans le journal fourni), **avant et après le correctif**,
  dans les deux passes de compilation (installeur et désinstalleur) —
  zéro avertissement des deux côtés.

---

- **Decisive fix: the installer build was genuinely failing**,
  explaining both the missing VLC and the reversion to the old
  behavior (modal dialog) reported in v1.50.1/1.50.2. The real build
  log supplied by the user made it possible to find the exact cause:
  `warning 6010: install function "OptDownloadsPageCreate" not
  referenced`, treated as a fatal error by electron-builder — the
  build therefore never completed, and Windows/electron-builder likely
  fell back to an already-present older executable.

  **Cause identified with certainty, directly reproduced with
  `makensis`**: `assistedInstaller.nsh` (electron-builder's own
  internal template) wraps its page declaration in `!ifndef
  BUILD_UNINSTALLER` — during the uninstaller compile pass (where that
  flag is defined), my page never gets inserted, but my functions
  themselves stayed compiled unconditionally, causing exactly the
  observed warning.

  Variables, macro, and functions now wrapped in the same guard.
  **Verified by reproducing the exact failure** (the same exact
  message as in the supplied log), **before and after the fix**, in
  both compile passes (installer and uninstaller) — zero warnings on
  both sides.

## 1.50.2

- **Correctif : fenêtre PowerShell supplémentaire pendant l'extraction
  de ffmpeg/VLC.** `nsExec::ExecToLog` masque normalement la fenêtre du
  processus lancé, mais PowerShell est connu pour parfois afficher
  brièvement la sienne malgré tout. `-WindowStyle Hidden` ajouté en
  renfort explicite, pour les deux extractions (ffmpeg et VLC).

- **Page à cases à cocher toujours pas visible, malgré la v1.50.1** :
  investigation approfondie du mécanisme d'inclusion d'electron-builder
  (tracé jusque dans son code source) sans trouver de problème
  d'ordonnancement — le fichier `installer.nsh` est bien inséré avant
  le modèle principal. Cause probable restant à confirmer : version
  précédente encore testée plutôt qu'une reconstruction complète pour
  1.50.2 précisément (déjà arrivé plusieurs fois dans le
  développement de cette fonctionnalité).

  **Vérification sans ambiguïté cette fois** : avant de tester,
  supprimer entièrement le dossier `dist\` existant, puis lancer
  `npm run dist` et confirmer qu'un nouveau fichier `.exe` apparaît
  avec une date de modification très récente, avant de désinstaller
  et réinstaller.

---

- **Fix: an extra PowerShell window during ffmpeg/VLC extraction.**
  `nsExec::ExecToLog` normally hides the launched process's window, but
  PowerShell is known to sometimes flash its own regardless.
  `-WindowStyle Hidden` added as explicit reinforcement, for both
  extractions (ffmpeg and VLC).

- **Checkbox page still not visible, despite v1.50.1**: thorough
  investigation of electron-builder's include mechanism (traced into
  its own source code) without finding an ordering issue -- the
  `installer.nsh` file is indeed inserted before the main template.
  Likely remaining cause: a previous version still being tested rather
  than a full rebuild specifically for 1.50.2 (already happened several
  times during this feature's development).

  **Unambiguous verification this time**: before testing, fully delete
  the existing `dist\` folder, then run `npm run dist` and confirm a
  new `.exe` file appears with a very recent modification date, before
  uninstalling and reinstalling.

## 1.50.1

- **Installeur Windows : vraie page à cases à cocher, plus de fenêtre
  modale.** Signalé par l'utilisateur : la fenêtre « Oui/Non » de la
  v1.45.0 redemandait à chaque réinstallation tant qu'on répondait
  Non. Remplacée par une véritable page de l'assistant d'installation,
  avec de vraies cases à cocher, décochées par défaut — ne rien cocher
  fait simplement avancer à la page suivante, sans jamais redemander
  bruyamment.

  **VLC ajouté selon le même principe que ffmpeg.** Contrairement à
  ffmpeg (un seul exécutable autonome), VLC dépend de son dossier
  « plugins » et de plusieurs DLL pour fonctionner — le dossier
  complet est copié, pas seulement `vlc.exe`.

  La page entière est sautée si les deux outils sont déjà présents
  (une mise à jour ne redemande donc rien) ; si un seul manque, seule
  sa case s'affiche.

  **Vérifié avec le vrai compilateur NSIS** : compile sans la moindre
  erreur ni le moindre avertissement, produit un véritable exécutable
  Windows valide.

---

- **Windows installer: a real checkbox page, no more modal dialog.**
  Reported by the user: the v1.45.0 "Yes/No" dialog kept re-asking on
  every reinstall as long as the answer was No. Replaced with a
  genuine installer wizard page, with real checkboxes, unchecked by
  default — checking nothing simply moves to the next page, never
  noisily asking again.

  **VLC added following the same principle as ffmpeg.** Unlike ffmpeg
  (a single standalone executable), VLC depends on its "plugins"
  folder and several DLLs to function — the full folder is copied,
  not just `vlc.exe`.

  The whole page is skipped if both tools are already present (an
  update therefore asks nothing); if only one is missing, only its
  checkbox shows.

  **Verified with the real NSIS compiler**: compiles with zero errors
  and zero warnings, produces a genuine valid Windows executable.

## 1.50.0

- **Chaînes TV en direct : boutons pause et plein écran ajoutés.**
  Les chaînes en direct n'ont pas de contrôles natifs du navigateur
  (pas de barre de progression, rien à avancer/reculer sur du
  direct), mais mettre en pause et passer en plein écran gardent tout
  leur sens même sans elle. Deux nouveaux boutons dans la barre de
  contrôle, à côté du bouton muet existant.

  Mettre en pause fige simplement l'image sur l'instant courant ;
  reprendre relance le direct à l'instant réel (pas de rattrapage,
  comportement attendu pour du direct). Le plein écran cible le
  conteneur vidéo entier (pas seulement l'élément `<video>`), pour que
  d'éventuelles incrustations (avertissement audio, bannière de
  format) restent visibles.

  Absents pour les films/séries, qui utilisent déjà les contrôles
  natifs du navigateur (redondant sinon).

---

- **Live TV channels: pause and fullscreen buttons added.** Live
  channels have no native browser controls (no progress bar, nothing
  to seek through on live), but pausing and going fullscreen still
  fully make sense without one. Two new buttons in the control bar,
  next to the existing mute button.

  Pausing simply freezes the image at the current instant; resuming
  restarts live at the real current time (no catch-up, expected
  behavior for live content). Fullscreen targets the entire video
  container (not just the `<video>` element), so any overlay (audio
  warning, format banner) stays visible.

  Absent for movies/series, which already use the browser's native
  controls (redundant otherwise).

## 1.49.1

- **Correctif *Chaînes TV* : image figée sur toutes les chaînes en
  direct, après la correction de l'extension `.ts` (v1.49.0).**
  Identifié précisément par l'outil de diagnostic : `Malformed AAC
  bitstream detected`, puis `Conversion failed!` après une seule
  image (`frame=1`). Cause : VLC encode l'audio AAC au format ADTS
  (standard pour un conteneur TS, chaque trame porte son propre
  en-tête), mais le conteneur MP4 final exige le format ASC (Audio
  Specific Config, un seul en-tête global). Sans conversion de ce
  framing — pas un réencodage, le codec audio reste identique —
  ffmpeg échouait dès la première trame audio et abandonnait tout le
  flux, expliquant précisément le symptôme : une image, puis plus
  rien, sur n'importe quelle chaîne.

  Filtre de flux binaire `aac_adtstoasc` ajouté au remuxage audio
  quand l'entrée vient de VLC. **Vérifié en reproduisant l'échec
  exact** avec un flux continu de test (6,7 Ko produits et erreur
  identique sans le correctif) puis en confirmant la résolution
  (581 Ko produits, 282 images sur ~5 s de flux — un direct
  réellement continu, pas une image figée).

---

- **Fix for *TV Channels*: frozen image on all live channels, after
  the `.ts` extension fix (v1.49.0).** Precisely identified by the
  diagnostic tool: `Malformed AAC bitstream detected`, then
  `Conversion failed!` after a single frame (`frame=1`). Cause: VLC
  encodes AAC audio in ADTS format (standard for a TS container, each
  frame carries its own header), but the final MP4 container requires
  the ASC format (Audio Specific Config, a single global header).
  Without converting this framing — not a re-encode, the audio codec
  itself stays the same — ffmpeg failed on the very first audio frame
  and abandoned the entire stream, precisely explaining the symptom:
  one frame, then nothing, on any channel.

  `aac_adtstoasc` bitstream filter added to the audio remux when the
  input comes from VLC. **Verified by reproducing the exact failure**
  with a continuous test stream (6.7 KB produced and the identical
  error without the fix) then confirming the resolution (581 KB
  produced, 282 frames over ~5s of stream — a genuinely continuous
  live feed, not a frozen image).

## 1.49.0

- **Chaînes TV : cause racine du 405 enfin trouvée — mauvaise
  extension d'URL, pas un problème de client.** VLC natif (le vrai
  moteur, testé directement en v1.48.1) recevait le même 405 que
  ffmpeg, éliminant toute piste liée au user-agent, aux méthodes HTTP,
  ou à la bibliothèque réseau utilisée. Cause trouvée par examen
  statique du code source d'un lecteur IPTV de référence officiel
  (installeur fourni par l'utilisateur, précédemment examiné pour
  découvrir l'usage de libVLC) : il construit l'URL des chaînes en
  direct avec l'extension **`.ts`** (flux MPEG-TS brut), jamais
  `.m3u8` (manifeste HLS) — alors que PiBoard utilisait `.m3u8`
  jusqu'ici pour toutes les chaînes en direct.

  Le fournisseur (via son proxy « PremiumProxy ») rejette
  systématiquement les requêtes `.m3u8` sur cet endpoint, quel que
  soit le client — confirmé par la même erreur 405 obtenue avec le
  navigateur, ffmpeg, et VLC natif, avant que cette différence
  d'extension ne soit découverte.

  **Conséquence architecturale** : un flux `.ts` brut n'est jamais
  lisible directement par un navigateur, ni par hls.js (conçu pour de
  vrais manifestes HLS). Le pipeline de transcodage (VLC si
  disponible, sinon ffmpeg — voir v1.45.0-v1.48.1) devient donc
  **obligatoire** pour toutes les chaînes en direct, plus seulement
  optionnel comme pour les films/séries. Le réglage « Mode de
  compatibilité » ne contrôle plus que le *niveau* (audio seul ou
  complet) pour ce cas désormais systématique.

  Nouveau test dédié, qui verrouille ce comportement critique :
  vérifie que le direct passe bien par le pipeline de transcodage
  avec une URL en `.ts`, jamais en `.m3u8`.

---

- **TV Channels: root cause of the 405 finally found — wrong URL
  extension, not a client problem.** Native VLC (the real engine,
  directly tested in v1.48.1) received the same 405 as ffmpeg,
  ruling out any lead related to user-agent, HTTP methods, or the
  networking library used. Cause found by statically examining an
  official reference IPTV player's source code (installer supplied by
  the user, previously examined to discover its use of libVLC): it
  builds live channel URLs with a **`.ts`** extension (raw MPEG-TS
  stream), never `.m3u8` (HLS manifest) — while PiBoard was using
  `.m3u8` for all live channels until now.

  The provider (via its "PremiumProxy" proxy) systematically rejects
  `.m3u8` requests on this endpoint, regardless of client — confirmed
  by the same 405 error obtained with the browser, ffmpeg, and native
  VLC, before this extension difference was discovered.

  **Architectural consequence**: a raw `.ts` stream is never directly
  playable by a browser, nor by hls.js (built for genuine HLS
  manifests). The transcode pipeline (VLC if available, else ffmpeg —
  see v1.45.0-v1.48.1) therefore becomes **mandatory** for all live
  channels, no longer just optional like for movies/series. The
  "Compatibility mode" setting now only controls the *level* (audio-
  only or full) for this now-systematic case.

  New dedicated test added, which locks in this critical behavior:
  verifies live correctly goes through the transcode pipeline with a
  `.ts` URL, never `.m3u8`.

## 1.48.1

- **Correctif *Chaînes TV* : sortie de VLC totalement vide dans le
  diagnostic, malgré 15 secondes sans le moindre octet produit.**
  Cause : VLC reste quasi muet à son niveau de verbosité par défaut,
  même en cas d'échec de connexion — aucune option de verbosité
  n'était passée. `-vv` ajouté.

  **Vérifié directement** contre une connexion refusée délibérée :
  sans `-vv`, sortie d'erreur totalement vide (reproduit exactement le
  symptôme signalé) ; avec `-vv`, VLC rapporte clairement `HTTP
  connection failure` / `connection failed: Connection refused`. Le
  prochain diagnostic devrait enfin révéler ce que VLC tente de faire
  et pourquoi ça échoue.

---

- **Fix for *TV Channels*: VLC's output completely empty in the
  diagnostic, despite 15 seconds with not a single byte produced.**
  Cause: VLC stays nearly silent at its default verbosity level, even
  on a connection failure — no verbosity option was being passed.
  `-vv` added.

  **Directly verified** against a deliberately refused connection:
  without `-vv`, completely empty error output (reproduces the exact
  reported symptom); with `-vv`, VLC clearly reports "HTTP connection
  failure" / "connection failed: Connection refused". The next
  diagnostic run should finally reveal what VLC is attempting and why
  it fails.

## 1.48.0

- **Chaînes TV : VLC transcode désormais lui-même**, au lieu d'un
  simple relais brut vers ffmpeg. Signalé par l'utilisateur : le
  relais brut laissait ffmpeg bloqué, sans jamais recevoir la moindre
  donnée (0 octet, aucune erreur — symptôme distinct du 405 d'origine,
  jamais totalement expliqué). Plutôt que de chercher pourquoi le tube
  VLC → ffmpeg restait silencieux, VLC fait maintenant **tout le
  travail lui-même** (récupération et conversion vidéo H.264 + audio
  AAC), ffmpeg n'intervenant plus qu'en simple remuxage (recopie pure,
  aucun réencodage) — plus rapide et plus fiable qu'un second passage
  de réencodage inutile.

  `vcodec=copy` (repli vidéo sans réencodage, comme pour ffmpeg) **ne
  fonctionne pas** dans le module de transcodage de VLC (« cannot find
  video encoder fourcc:copy », vérifié directement) : la vidéo est donc
  toujours réencodée par VLC pour les chaînes en direct, plus coûteux
  qu'une simple recopie mais fiable, confirmé par test direct.

  **Capture de la sortie d'erreur de VLC ajoutée**, absente jusqu'ici —
  un échec silencieux du côté VLC restait totalement invisible.
  L'outil de diagnostic l'inclut désormais dans son rapport.

  Vérifié de bout en bout : flux source AC3 converti en AAC par VLC ;
  pipeline complet VLC → ffmpeg → réponse HTTP testé avec un vrai flux
  continu, sortie H.264+AAC valide ; aucun processus VLC/ffmpeg
  orphelin après une requête terminée.

---

- **TV Channels: VLC now transcodes itself**, instead of a plain raw
  relay into ffmpeg. Reported by the user: the raw relay left ffmpeg
  hanging, never receiving any data at all (0 bytes, no error — a
  symptom distinct from the original 405, never fully explained).
  Rather than chasing why the VLC → ffmpeg pipe stayed silent, VLC now
  does **all the work itself** (fetching and converting to H.264 video
  + AAC audio), with ffmpeg only doing a simple remux (plain copy, no
  re-encoding) — faster and more reliable than a needless second
  re-encoding pass.

  `vcodec=copy` (a video passthrough without re-encoding, like
  ffmpeg's) **does not work** in VLC's transcode module ("cannot find
  video encoder fourcc:copy", verified directly): video is therefore
  always re-encoded by VLC for live channels, costlier than a plain
  copy but reliable, confirmed by direct testing.

  **VLC's own error output capture added**, missing until now — a
  silent failure on VLC's side stayed entirely invisible. The
  diagnostic tool now includes it in its report.

  Verified end to end: an AC3 source stream converted to AAC by VLC;
  full VLC → ffmpeg → HTTP response pipeline tested against a real
  continuous stream, valid H.264+AAC output; no orphaned VLC/ffmpeg
  process after a completed request.

## 1.47.2

- **Correctif *Chaînes TV* : VLC installé et confirmé par l'utilisateur,
  mais signalé « indisponible » par le diagnostic.** Cause trouvée :
  la détection de VLC vérifiait sa présence en **l'exécutant** avec
  `--version` — fiable pour ffmpeg (vérifié, affiche du texte et se
  termine), mais rien ne garantit ce même comportement pour `vlc.exe`
  sous Windows, qui pourrait tenter d'ouvrir son interface graphique
  au lieu de simplement répondre et se fermer, faisant échouer la
  vérification par expiration du délai — même quand VLC est bel et
  bien installé.

  Un **chemin absolu** (emplacements d'installation connus) est
  désormais vérifié par simple **existence de fichier**, sans jamais
  l'exécuter. Les listes de candidats Windows/macOS ont aussi été
  réordonnées : chemins absolus en premier (rapide, sûr), nom nu
  (`vlc.exe`/`vlc`) en dernier, comme simple repli.

  Test dédié ajouté, qui reproduit exactement le bug corrigé
  (détection d'un chemin absolu existant sans jamais l'exécuter).

---

- **Fix for *TV Channels*: VLC installed and confirmed by the user, but
  reported "unavailable" by the diagnostic.** Cause found: VLC's
  detection checked for its presence by **executing** it with
  `--version` — reliable for ffmpeg (verified, prints text and exits),
  but nothing guarantees the same behavior for `vlc.exe` on Windows,
  which might try to open its graphical interface instead of simply
  responding and closing, making the check fail via timeout — even when
  VLC is genuinely installed.

  An **absolute path** (known install locations) is now checked via
  simple **file existence**, never executing it at all. The Windows/
  macOS candidate lists were also reordered: absolute paths first
  (fast, safe), bare name (`vlc.exe`/`vlc`) last, as a plain fallback.

  Dedicated test added, which reproduces the exact fixed bug (detecting
  an existing absolute path without ever executing it).

## 1.47.1

- **Correctif : fenêtre de console qui s'ouvre puis se referme sous
  Windows.** Signalé par l'utilisateur pendant un test. Cause :
  `child_process.spawn()` affiche par défaut une fenêtre de console
  visible pour tout processus lancé depuis une application Electron,
  sauf indication contraire — jamais précisé pour ffmpeg ni VLC.
  `windowsHide: true` ajouté aux trois appels concernés. Sans effet sur
  Linux/macOS.

- **Correctif de cohérence : l'outil de diagnostic testait ffmpeg
  seul**, alors que la lecture réelle passe désormais par VLC pour le
  direct (v1.47.0) — deux chemins différents, deux résultats
  potentiellement différents. Le diagnostic emprunte désormais
  exactement le même chemin que la lecture réelle, et indique
  clairement lequel des deux (VLC → ffmpeg, ou ffmpeg seul) a été
  utilisé.

---

- **Fix: a console window flashing open then closed on Windows.**
  Reported by the user during testing. Cause: `child_process.spawn()`
  shows a visible console window by default for any process launched
  from an Electron application, unless told otherwise — never
  specified for ffmpeg or VLC. `windowsHide: true` added to the three
  calls involved. No effect on Linux/macOS.

- **Consistency fix: the diagnostic tool was testing ffmpeg alone**,
  while real playback now goes through VLC for live (v1.47.0) — two
  different paths, two potentially different results. The diagnostic
  now takes the exact same path as real playback, and clearly states
  which of the two (VLC → ffmpeg, or ffmpeg alone) was used.

## 1.47.0

- **Chaînes TV : relais VLC pour les fournisseurs qui rejettent
  ffmpeg.** Le `405 Method Not Allowed` persistait malgré le
  user-agent VLC et la désactivation de Range/ICY-Metadata (v1.46.2,
  v1.46.3). Cause trouvée par examen statique de l'application
  officielle du fournisseur (installeur fourni par l'utilisateur) :
  elle n'utilise **jamais** le pipeline vidéo du navigateur pour le
  direct — elle embarque le vrai moteur natif de VLC (libVLC, via
  WebChimera.js). Aucun en-tête ni astuce visible dans son code : le
  succès vient vraisemblablement de différences d'implémentation HTTP
  bas niveau entre libVLC et ffmpeg, pas d'un réglage qu'on pouvait
  simplement copier.

  Plutôt que d'embarquer le module natif complet (compilation liée à
  une version précise d'Electron, chantier bien plus lourd), VLC est
  utilisé comme un **processus séparé** — exactement le même principe
  déjà en place pour ffmpeg. Pour les chaînes en direct spécifiquement,
  VLC récupère désormais le flux en amont (relais brut, aucun
  réencodage) quand il est installé, puis le transmet à ffmpeg pour le
  réencodage audio/vidéo final — réutilise telle quelle la logique de
  muxage déjà éprouvée.

  **Repli propre si VLC n'est pas installé** : les chaînes en direct
  continuent de fonctionner via ffmpeg seul pour les fournisseurs sans
  cette restriction — rien ne casse pour ceux qui n'en ont pas besoin.

  Détection multi-plateforme ajoutée (Linux via `cvlc`, Windows/macOS
  via `vlc`/`VLC` avec `--intf dummy` passé explicitement — ces deux
  systèmes n'ont pas de `cvlc` distinct, vérifié avant d'écrire le
  code plutôt que supposé).

  **Vérifié de bout en bout**, pas seulement en théorie : pipeline
  complet testé avec un vrai flux continu (VLC → ffmpeg → réponse
  HTTP, sortie H.264+AAC valide) ; confirmé que les URLs de films/séries
  contournent bien VLC (inutile pour ce cas, déjà fonctionnel) ; confirmé
  qu'aucun processus VLC ne survit à une déconnexion client — point
  critique pour éviter une fuite sur un Pi, un flux en direct n'ayant
  pas de fin.

---

- **TV Channels: VLC relay for providers that reject ffmpeg.** The
  `405 Method Not Allowed` persisted despite the VLC user-agent and
  disabling Range/ICY-Metadata (v1.46.2, v1.46.3). Cause found by
  statically examining the provider's official app (installer supplied
  by the user): it **never** uses the browser's video pipeline for
  live — it embeds VLC's actual native engine (libVLC, via
  WebChimera.js). No header or trick visible in its code: success is
  most likely due to low-level HTTP implementation differences between
  libVLC and ffmpeg, not a setting that could simply be copied.

  Rather than embedding the full native module (compilation tied to a
  precise Electron version, a much heavier undertaking), VLC is used as
  a **separate process** — the exact same principle already in place
  for ffmpeg. For live channels specifically, VLC now fetches the
  stream upstream (raw relay, no re-encoding) when installed, then
  hands it to ffmpeg for the final audio/video re-encoding — reuses the
  already-proven muxing logic as-is.

  **Clean fallback if VLC isn't installed**: live channels keep working
  via ffmpeg alone for providers without this restriction — nothing
  breaks for those who don't need it.

  Cross-platform detection added (Linux via `cvlc`, Windows/macOS via
  `vlc`/`VLC` with `--intf dummy` passed explicitly — these two systems
  have no separate `cvlc`, verified before writing the code rather than
  assumed).

  **Verified end to end**, not just in theory: full pipeline tested
  against a real continuous stream (VLC → ffmpeg → HTTP response,
  valid H.264+AAC output); confirmed movie/series URLs correctly skip
  VLC (unneeded for that case, already working); confirmed no VLC
  process survives a client disconnect — critical to avoid a leak on a
  Pi, a live stream having no end.

## 1.46.3

- **Correctif *Chaînes TV* : `405` toujours présent malgré le
  user-agent VLC (v1.46.2).** Cause trouvée en examinant la requête
  HTTP brute que ffmpeg envoie réellement : deux en-têtes envoyés par
  défaut, sans rapport avec l'identification du client, mais tout
  aussi susceptibles de faire rejeter la requête par un serveur de
  streaming en direct —
  - `Range: bytes=0-` : une demande de « rembobinage », pensée pour du
    contenu fini à taille connue — sans grand sens pour un flux en
    direct sans fin ;
  - `Icy-MetaData: 1` : une demande de métadonnées façon SHOUTcast,
    hors de propos pour un flux vidéo IPTV.

  Les deux désormais désactivés (`-seekable 0 -icy 0`). **Vérifié
  concrètement** en capturant la requête brute réellement envoyée par
  ffmpeg, avec et sans ces options : les deux en-têtes disparaissent
  bien.

  Cette sandbox de développement n'ayant toujours pas accès au réseau
  du fournisseur concerné, la disparition effective du `405` sur le
  vrai flux reste à confirmer avec l'outil de diagnostic (v1.46.1).

---

- **Fix for *TV Channels*: `405` still present despite the VLC
  user-agent (v1.46.2).** Cause found by examining the raw HTTP
  request ffmpeg actually sends: two headers sent by default,
  unrelated to client identification, but just as likely to get the
  request rejected by a live streaming server —
  - `Range: bytes=0-`: a "seek" request, meant for finite content with
    a known size — not particularly meaningful for an endless live
    stream;
  - `Icy-MetaData: 1`: a SHOUTcast-style metadata request, irrelevant
    for an IPTV video stream.

  Both now disabled (`-seekable 0 -icy 0`). **Concretely verified** by
  capturing the raw request ffmpeg actually sends, with and without
  these options: both headers correctly disappear.

  This development sandbox still having no network access to the
  provider in question, whether the `405` actually disappears on the
  real stream remains to be confirmed with the diagnostic tool
  (v1.46.1).

## 1.46.2

- **Correctif *Chaînes TV* : cause identifiée sans ambiguïté grâce à
  l'outil de diagnostic** — `405 Method Not Allowed` renvoyé par le
  serveur du fournisseur IPTV lui-même, 0 octet produit. Rien à voir
  avec hls.js, les codecs, le format MP4 fragmenté ou la mise en
  mémoire tampon explorés jusqu'ici.

  Deux user-agents corrigés vers `VLC/3.0.20 LibVLC/3.0.20` — déjà
  utilisé avec succès pour la liste des chaînes, seul point qui n'avait
  jamais posé problème :
  - **`server/iptvAudio.js`** (mode compatibilité) : ffmpeg envoyait son
    identifiant par défaut (`Lavf/X.Y.Z`), rejeté par ce fournisseur ;
  - **`server/iptvHlsProxy.js`** (relais du direct, mode par défaut) :
    utilisait par erreur l'identifiant du mode lecture des articles
    RSS (`PiBoard-ReaderMode`, hérité d'un copier-coller, sans rapport
    avec l'IPTV) — très probablement la vraie cause du tout premier
    signalement (`405` observé dès la toute première capture de
    console partagée), avant même la découverte du besoin de ffmpeg.

  **Non vérifié directement** : cette sandbox de développement n'a pas
  accès au réseau du fournisseur concerné (restriction propre à
  l'environnement), donc impossible de confirmer ici que le `405`
  disparaît réellement. À vérifier avec l'outil de diagnostic introduit
  en v1.46.1, sur ta machine.

---

- **Fix for *TV Channels*: cause identified without ambiguity thanks to
  the diagnostic tool** — `405 Method Not Allowed` returned by the IPTV
  provider's own server, 0 bytes produced. Unrelated to hls.js,
  codecs, the fragmented MP4 format, or buffering, all explored until
  now.

  Two user-agents fixed to `VLC/3.0.20 LibVLC/3.0.20` — already used
  successfully for the channel list, the one part that never had a
  problem:
  - **`server/iptvAudio.js`** (compatibility mode): ffmpeg was sending
    its default identifier (`Lavf/X.Y.Z`), rejected by this provider;
  - **`server/iptvHlsProxy.js`** (the live relay, default mode): was
    mistakenly using the RSS article reader mode's identifier
    (`PiBoard-ReaderMode`, inherited via copy-paste, unrelated to
    IPTV) — very likely the real cause of the very first report (a
    `405` observed in the very first console capture shared), before
    the need for ffmpeg was even discovered.

  **Not directly verified**: this development sandbox has no network
  access to the provider in question (an environment-specific
  restriction), so it's impossible to confirm here that the `405`
  actually disappears. To be checked with the diagnostic tool
  introduced in v1.46.1, on your machine.

## 1.46.1

- **Nouvel outil de diagnostic *Chaînes TV*, consultable directement
  dans un navigateur.** L'échec persistant sur plusieurs chaînes
  différentes malgré les correctifs précédents, sans accès facile à la
  console/au journal du serveur pour une application installée sous
  Windows, appelait un outil dédié plutôt qu'une nouvelle hypothèse à
  l'aveugle. Lance le pipeline ffmpeg réel sur une URL donnée, pendant
  8 secondes seulement (jamais envoyé au lecteur), et affiche
  précisément : code de sortie, octets produits, délai avant le
  premier octet, et surtout la sortie d'erreur complète de ffmpeg.

  Usage : coller dans un navigateur (remplacer l'URL de la chaîne par
  celle affichée dans l'onglet Réseau) —
  `http://127.0.0.1:8090/api/iptv/diagnose?url=URL_DE_LA_CHAINE&mode=full`
  (ou `mode=audio`).

  Vérifié de bout en bout sur un vrai flux continu : révèle par exemple
  un délai de plus d'1 seconde avant le premier octet produit,
  cohérent avec un flux réellement en direct.

---

- **New *TV Channels* diagnostic tool, viewable directly in a
  browser.** The persistent failure across several different channels
  despite previous fixes, with no easy access to the server's console/
  log for an installed Windows application, called for a dedicated
  tool rather than another blind guess. Runs the real ffmpeg pipeline
  on a given URL, for 8 seconds only (never sent to the player), and
  precisely reports: exit code, bytes produced, delay before the first
  byte, and above all ffmpeg's full error output.

  Usage: paste into a browser (replace the channel URL with the one
  shown in the Network tab) —
  `http://127.0.0.1:8090/api/iptv/diagnose?url=CHANNEL_URL&mode=full`
  (or `mode=audio`).

  Verified end to end against a real continuous stream: reveals, for
  instance, a delay of over 1 second before the first byte produced,
  consistent with a genuinely live stream.

## 1.46.0

- **Correctif *Chaînes TV* : cause probable enfin trouvée pour le
  direct — signalée par une observation de l'utilisateur.** La lecture
  était tentée dès que le *format* du flux était reconnu
  (« loadedmetadata »), pas une fois qu'il y avait *réellement assez de
  données* pour démarrer (« canplay ») — un écart particulièrement
  marqué pour un flux en direct, où ffmpeg transcode en temps réel : le
  premier fragment exploitable prend un temps réel à être produit,
  contrairement à un fichier VOD déjà entièrement encodé. Les lecteurs
  IPTV dédiés affichent d'ailleurs toujours une phase de mise en
  mémoire tampon avant le direct, jamais pour la VOD — exactement
  l'indice qui manquait. Une mention « Mise en mémoire tampon… »
  s'affiche désormais pendant l'attente. Vérifié : la lecture n'est
  plus tentée prématurément sur le seul « loadedmetadata ».

- **Nouveau : commandes de lecture pour les films et séries.**
  Lecture/pause, avance et retour rapide, volume — via les contrôles
  natifs du navigateur, plus robustes qu'une barre personnalisée.
  Apparaissent automatiquement pour ce contenu (durée finie,
  navigable), détecté via le chemin de l'URL (`/movie/` ou `/series/`,
  fiable quelle que soit la source) ; absents pour les chaînes en
  direct, où il n'y a rien à avancer ou reculer.

---

- **Fix for *TV Channels*: likely cause finally found for live —
  flagged by a user observation.** Playback was attempted as soon as
  the stream's *format* was recognized ("loadedmetadata"), not once
  there was *actually enough data* to start ("canplay") — a gap
  particularly pronounced for a live stream, where ffmpeg transcodes
  in real time: the first usable fragment takes real time to produce,
  unlike an already fully-encoded VOD file. Dedicated IPTV players,
  notably, always show a buffering phase before live playback, never
  for VOD — exactly the missing clue. A "Buffering…" message now shows
  while waiting. Verified: playback is no longer attempted prematurely
  on "loadedmetadata" alone.

- **New: playback controls for movies and series.** Play/pause,
  fast-forward and rewind, volume — via the browser's native controls,
  more robust than a custom bar. Appear automatically for this content
  (finite, seekable duration), detected via the URL's path (`/movie/`
  or `/series/`, reliable regardless of the source); absent for live
  channels, where there's nothing to seek through.

## 1.45.0

- **Étape optionnelle à l'installation Windows : ffmpeg proposé
  automatiquement.** Décochée par défaut, ~55 Mo, uniquement demandée
  si le mode de compatibilité vidéo des chaînes IPTV n'a pas déjà
  ffmpeg d'installé — une mise à jour de PiBoard ne re-propose donc pas
  ce téléchargement à chaque fois.

  **Cadre légal vérifié avant implémentation** : PiBoard *lance*
  ffmpeg comme un processus séparé (jamais lié dans son propre code),
  ce qui permet de redistribuer légalement une version sous licence
  GPLv3 sans que cette licence ne s'applique au reste de l'application
  — le principe bien établi de l'« agrégation séparée ». Le binaire est
  hébergé sur une release dédiée du dépôt du projet (pas un lien
  dynamique vers « la dernière version » d'un tiers, pour éviter qu'un
  changement en amont ne casse silencieusement l'installateur), avec
  attribution claire, licence GPLv3 incluse, et pointeur vers le code
  source correspondant.

  Un échec de téléchargement (pas d'internet, source injoignable) ne
  bloque jamais l'installation de PiBoard lui-même — le mode de
  compatibilité vidéo reste simplement indisponible, avec le message
  d'erreur déjà clair introduit en v1.44.1.

  **Vérifié avec le vrai compilateur NSIS** (installé et utilisé pour
  l'occasion, plutôt que suppose fonctionnel sans le tester) : le
  script compile sans la moindre erreur ni le moindre avertissement.

---

- **Optional step in the Windows installer: ffmpeg offered
  automatically.** Unchecked by default, ~55 MB, only asked for if the
  IPTV channels' video compatibility mode doesn't already have ffmpeg
  installed — a PiBoard update therefore doesn't re-offer this download
  every time.

  **Legal framework checked before implementation**: PiBoard *launches*
  ffmpeg as a separate process (never linked into its own code), which
  allows legally redistributing a GPLv3-licensed build without that
  license applying to the rest of the application — the well-established
  "mere aggregation" principle. The binary is hosted on a dedicated
  release of the project's own repo (not a dynamic link to a third
  party's "latest version", to avoid an upstream change silently
  breaking the installer), with clear attribution, the GPLv3 license
  included, and a pointer to the corresponding source code.

  A download failure (no internet, source unreachable) never blocks
  PiBoard's own installation — the video compatibility mode simply
  stays unavailable, with the clear error message already introduced in
  v1.44.1.

  **Verified with the real NSIS compiler** (installed and used for the
  occasion, rather than assumed to work without testing it): the
  script compiles with zero errors and zero warnings.

## 1.44.2

- **Correctif *Chaînes TV* : requête `audio-fix` réussie (200 OK,
  ffmpeg désormais installé et fonctionnel) mais lecture toujours en
  échec.** Piste distincte des précédentes : les options
  d'assemblage MP4 fragmenté utilisées (`default_base_moof`) sont
  pensées pour une consommation via MediaSource/`appendBuffer` (le
  procédé de hls.js) — pas pour la lecture progressive directe via
  `<video src>` employée ici. Ajusté vers `faststart`, conforme à un
  exemple fonctionnel documenté pour exactement ce cas d'usage
  (lecture progressive d'un flux MP4 fragmenté en direct, sans fin).

  Vérifié : la structure du fichier produit reste valide et
  exploitable. N'ayant pas accès à un vrai navigateur Chrome pour
  confirmer que ceci résout définitivement la lecture, ce correctif
  cible la piste la plus probable identifiée plutôt qu'une certitude.

---

- **Fix for *TV Channels*: `audio-fix` request succeeding (200 OK,
  ffmpeg now installed and working) but playback still failing.** A
  distinct lead from previous ones: the fragmented MP4 muxing options
  used (`default_base_moof`) are meant for consumption via
  MediaSource/`appendBuffer` (hls.js's approach) — not for the direct
  progressive playback via `<video src>` used here. Adjusted to
  `faststart`, matching a documented working example for exactly this
  use case (progressive playback of a live, endless fragmented MP4
  stream).

  Verified: the produced file's structure remains valid and
  parseable. Without access to a real Chrome browser to confirm this
  definitively resolves playback, this fix targets the most likely
  lead identified rather than a certainty.

## 1.44.1

- **Cause enfin identifiée pour le cas signalé : `ffmpeg` n'était pas
  installé** sur la machine Windows concernée — confirmé par
  l'onglet Réseau (`503 Service Unavailable` sur `/api/iptv/audio-fix`,
  code renvoyé uniquement quand `ffmpeg` reste introuvable). Sans
  rapport avec les sept correctifs précédents autour de hls.js/codec,
  qui concernaient un problème réel mais distinct.

- **Correctif *Chaînes TV* : ce `503` s'affichait comme le même
  `NotSupportedError` générique**, masquant totalement sa vraie cause.
  `video.play()` était appelé immédiatement après avoir fixé la source,
  avant même que la requête réseau n'ait eu le temps d'aboutir ou
  d'échouer — son propre message d'échec générique arrivait presque
  toujours en premier et masquait le message spécifique de l'événement
  `error`. La lecture n'est désormais tentée qu'une fois la source
  confirmée chargée (`loadedmetadata`), plus en parallèle d'une requête
  encore en cours. Vérifié avec le cas exact rencontré (503) : le
  message précis (« vérifiez que ffmpeg est installé ») s'affiche
  maintenant correctement, plus jamais masqué.

---

- **Root cause finally identified for the reported case: `ffmpeg`
  wasn't installed** on the Windows machine in question — confirmed via
  the Network tab (`503 Service Unavailable` on `/api/iptv/audio-fix`,
  a code only ever returned when `ffmpeg` can't be found). Unrelated to
  the seven previous fixes around hls.js/codecs, which addressed a real
  but distinct problem.

- **Fix for *TV Channels*: that `503` displayed as the same generic
  `NotSupportedError`**, entirely masking its real cause. `video.play()`
  was called immediately after setting the source, before the network
  request even had time to succeed or fail — its own generic failure
  message almost always arrived first and masked the "error" event's
  specific message. Playback is now only attempted once the source is
  confirmed loaded (`loadedmetadata`), no longer alongside a still-
  pending request. Verified with the exact case encountered (503): the
  precise message ("check that ffmpeg is installed") now correctly
  shows, never masked again.

## 1.44.0

- **Chaînes TV : nouveau mode « Compatibilité totale »**, pour les
  chaînes qui échouent encore avec une erreur du navigateur (ex.
  `NotSupportedError : aucune source prise en charge`) malgré sept
  correctifs successifs et plusieurs vérifications de codec n'ayant
  rien trouvé d'anormal à signaler — le codec précisément en cause
  reste, dans certains cas, indétectable avec certitude côté
  navigateur.

  L'option « Corriger le son muet » devient un réglage à deux niveaux :
  - **Son muet uniquement** (comportement inchangé) : seule la piste
    audio est réencodée, la vidéo est recopiée telle quelle — reste
    très léger ;
  - **Compatibilité totale** (nouveau) : la vidéo est *aussi*
    réencodée, contournant entièrement le lecteur HLS du navigateur.
    Nettement plus lourd (un vrai réencodage vidéo, pas une simple
    recopie), mais fonctionne quel que soit le codec source exact,
    puisque ffmpeg décode ce qui se présente et réencode vers un
    format standard garanti.

  Vérifié de bout en bout avec un flux HEVC+AC3 (délibérément
  incompatible) : le mode complet produit bien un H.264+AAC standard en
  sortie ; le mode son seul confirmé inchangé (vidéo HEVC toujours
  recopiée intacte).

---

- **TV Channels: new "Full compatibility" mode**, for channels still
  failing with a browser error (e.g. `NotSupportedError: no supported
  sources`) despite seven successive fixes and several codec checks
  finding nothing wrong to flag — the exact codec at fault remains, in
  some cases, undetectable with certainty from the browser side.

  The "Fix silent sound" option becomes a two-level setting:
  - **Silent sound only** (unchanged behavior): only the audio track
    is re-encoded, video is copied as-is — stays very light;
  - **Full compatibility** (new): the video is *also* re-encoded,
    entirely bypassing the browser's HLS player. Noticeably heavier (a
    genuine video re-encode, not a plain copy), but works regardless
    of the exact source codec, since ffmpeg decodes whatever's
    presented and re-encodes to a guaranteed standard format.

  Verified end to end with an HEVC+AC3 stream (deliberately
  incompatible): full mode correctly produces standard H.264+AAC
  output; audio-only mode confirmed unchanged (HEVC video still copied
  untouched).

## 1.43.6

- **Correctif *Chaînes TV* : `NotSupportedError` toujours affiché sans
  détail, malgré la vérification de codec de la v1.43.5.** Cause
  trouvée : cette vérification se basait sur le codec *annoncé* dans le
  manifeste — facultatif dans la norme HLS, et de nombreux flux IPTV,
  conçus pour VLC (qui n'en a pas besoin), ne le fournissent tout
  simplement pas. D'où un premier contrôle qui ne trouvait rien à
  signaler, laissant le message générique du navigateur s'afficher tel
  quel.

  **Second contrôle ajouté**, basé sur `BUFFER_CODECS` — le codec
  *réellement détecté* par hls.js après analyse des données du premier
  fragment (toujours disponible, contrairement à celui du manifeste).
  Vérifié avec un manifeste sans codec déclaré (le cas typique
  concerné) : identifie précisément le codec en cause, y compris
  quand un seul des deux (vidéo ou audio) pose problème.

---

- **Fix for *TV Channels*: `NotSupportedError` still showing with no
  detail, despite the v1.43.5 codec check.** Cause found: that check
  relied on the codec *announced* in the manifest — optional per the
  HLS spec, and many IPTV streams, built for VLC (which doesn't need
  it), simply don't provide it. Hence a first check finding nothing to
  flag, leaving the browser's generic message to show as-is.

  **Second check added**, based on `BUFFER_CODECS` — the codec hls.js
  *actually detected* after analyzing the first fragment's data
  (always available, unlike the manifest's). Verified with a manifest
  declaring no codec (the typical case at hand): precisely identifies
  the codec at fault, including when only one of the two (video or
  audio) is the problem.

## 1.43.5

- **Correctif *Chaînes TV* : `NotSupportedError` toujours présent malgré
  le réordonnancement de la v1.43.4** — écarte une course entre appels
  comme cause. Ajout d'une **vérification proactive du codec**, avant
  même de tenter la lecture : le manifeste peut se récupérer et
  s'analyser avec succès (le relais CORS fonctionne, confirmé) tout en
  annonçant un codec vidéo ou audio que le moteur MediaSource du
  navigateur ne sait pas décoder — cas documenté dans le suivi de bugs
  de hls.js, notamment avec des configurations de canaux audio
  inhabituelles.

  Le message affiché identifie désormais précisément **lequel** des
  deux codecs (vidéo ou audio) est en cause, avec son nom exact — le
  message générique du navigateur ne le disait pas, rendant tout
  diagnostic supplémentaire impossible sans cette vérification.

  Si le codec vidéo est en cause, aucune solution logicielle simple
  n'existe côté navigateur (contrairement à l'audio, où l'option
  « Corriger le son muet » sait déjà transcoder). Le message précis
  permettra de le confirmer.

---

- **Fix for *TV Channels*: `NotSupportedError` still occurring despite
  the v1.43.4 reordering** — rules out a call-order race as the cause.
  Added a **proactive codec check**, before even attempting playback:
  the manifest can be fetched and parsed successfully (the CORS relay
  works, confirmed) while still announcing a video or audio codec the
  browser's MediaSource engine can't decode — a case documented in
  hls.js's own issue tracker, notably with unusual audio channel
  configurations.

  The displayed message now precisely identifies **which** of the two
  codecs (video or audio) is at fault, with its exact name — the
  browser's generic message didn't say, making any further diagnosis
  impossible without this check.

  If the video codec is at fault, no simple software fix exists on the
  browser side (unlike audio, where the "Fix silent sound" option
  already knows how to transcode). The precise message will confirm
  this.

## 1.43.4

- **Correctif `npm run dist`/`npm run publish` : échec `EPERM` sous
  Windows au nettoyage du dossier `dist\`**, signalé lors d'une
  reconstruction — le script de nettoyage n'avait aucune tentative de
  réessai, alors qu'un verrou de fichier transitoire (antivirus,
  instance encore ouverte) est une situation Windows courante et
  généralement résolue en une seconde. `maxRetries`/`retryDelay`
  ajoutés (solution standard de Node.js pour ce cas précis), avec un
  message clair plutôt qu'une trace technique si l'échec persiste
  malgré les tentatives.

- **Correctif *Chaînes TV* : `NotSupportedError` persistant malgré un
  relais CORS fonctionnel** (confirmé par le diagnostic de la
  v1.43.3 : le manifeste est bien récupéré avec succès, l'échec
  survient après). Retrouvé un rapport de bogue quasi identique dans
  le suivi de bugs de hls.js (*video-dev/hls.js#432*, *#4952*) :
  l'ordre `loadSource()` puis `attachMedia()` (tous deux appelés
  immédiatement, celui utilisé jusqu'ici) crée une course avec le
  moteur de lecture du navigateur, provoquant cette erreur de façon
  intermittente. Réordonné selon le motif documenté comme plus
  fiable : `attachMedia()` en premier, `loadSource()` déclenché
  ensuite par l'événement `MEDIA_ATTACHED` plutôt qu'appelé
  immédiatement. Vérifié : le nouvel ordre exact est bien respecté, et
  le relais CORS reste emprunté normalement.

  Si le problème persiste malgré ce réordonnancement, l'option
  « Corriger le son muet » (réglages de la tuile) offre un vrai
  contournement pour cette chaîne précise : elle fait entièrement
  l'impasse sur hls.js (lecture vidéo native après un léger
  retraitement audio côté serveur), donc insensible à ce genre de
  souci propre au lecteur HLS.

---

- **Fix for `npm run dist`/`npm run publish`: Windows `EPERM` failure
  cleaning the `dist\` folder**, reported during a rebuild — the clean
  script had no retry at all, even though a transient file lock
  (antivirus, a still-open instance) is a common Windows situation
  usually resolved within a second. `maxRetries`/`retryDelay` added
  (Node.js's standard solution for this exact case), with a clear
  message instead of a technical stack trace if the failure persists
  despite retries.

- **Fix for *TV Channels*: persistent `NotSupportedError` despite a
  working CORS relay** (confirmed by the v1.43.3 diagnostic: the
  manifest is fetched successfully, the failure happens afterward).
  Found a near-identical bug report in hls.js's own issue tracker
  (*video-dev/hls.js#432*, *#4952*): the `loadSource()` then
  `attachMedia()` order (both called immediately, the one used until
  now) creates a race with the browser's playback engine, causing this
  error intermittently. Reordered to match the pattern reported more
  reliable: `attachMedia()` first, `loadSource()` then triggered by the
  `MEDIA_ATTACHED` event rather than called immediately. Verified: the
  new exact order is respected, and the CORS relay is still used
  normally.

  If the problem persists despite this reordering, the "Fix silent
  sound" option (tile settings) offers a genuine workaround for this
  particular channel: it bypasses hls.js entirely (native video
  playback after light server-side audio reprocessing), so it's immune
  to this kind of HLS-player-specific issue.

## 1.43.3

- **Correctif *Chaînes TV* : le diagnostic à l'écran de la v1.43.2 ne
  couvrait qu'un seul des trois endroits possibles d'échec** — d'où
  l'absence de message malgré une reconstruction et réinstallation
  complètes confirmées. Complété :
  - **Erreur `hls.js` fatale après un manifeste chargé avec succès**
    (ex. un segment individuel qui échoue) : affiche désormais le type
    et le code précis (ex. « networkError / fragLoadError »), pas
    seulement dans la console ;
  - **Échec de lecture après un vrai clic** (relais CORS et hls.js
    fonctionnels, mais la lecture elle-même refuse de démarrer) :
    affiche désormais le nom et le message exacts de l'erreur du
    navigateur (ex. « NotSupportedError : ... »).

  Les trois cas de figure identifiés jusqu'ici (échec de chargement de
  hls.js, erreur hls.js fatale, échec de lecture) affichent désormais
  tous un détail exploitable directement à l'écran, sans dépendre des
  outils de développement.

---

- **Fix for *TV Channels*: the v1.43.2 on-screen diagnostic only
  covered one of three possible failure points** — hence no message
  showing despite a confirmed full rebuild and reinstall. Completed:
  - **Fatal `hls.js` error after a successfully loaded manifest** (e.g.
    an individual segment failing): now shows the precise type and code
    (e.g. "networkError / fragLoadError"), not just in the console;
  - **Playback failure after a genuine click** (CORS relay and hls.js
    both working, but playback itself refuses to start): now shows the
    browser error's exact name and message (e.g. "NotSupportedError:
    ...").

  All three failure scenarios identified so far (hls.js load failure,
  fatal hls.js error, playback failure) now show actionable detail
  directly on screen, without relying on developer tools.

## 1.43.2

- **Correctif *Chaînes TV* : échec persistant malgré les correctifs
  précédents, même après suppression/réinitialisation du widget** — ce
  qui écartait un problème d'état propre à une tuile et pointait vers
  le chargement de `hls.js` lui-même.

  **Cause la plus probable trouvée et corrigée** : la configuration
  d'empaquetage Windows tentait d'alléger `hls.js` à un seul fichier via
  un motif d'exclusion puis réinclusion (introduit en v1.42.0) — une
  configuration **jamais vérifiée sur un vrai paquet Windows**, faute
  d'accès à une machine pour construire et tester l'installeur
  réellement. Abandonnée : le dossier est désormais livré en entier,
  comme les autres bibliothèques vendorisées (gridstack, leaflet). Coût
  : ~22 Mo de plus, largement préférable à une fonctionnalité coeur
  cassée sans le savoir.

  **Diagnostic visible à l'écran ajouté**, sans dépendre des outils de
  développement (un obstacle réel jusqu'ici) : le message d'erreur
  affiche désormais la cause précise —fichier introuvable (avec le code
  HTTP exact), échec d'exécution du script, ou fichier chargé mais
  corrompu. Si le problème persiste malgré le retrait du motif
  d'exclusion, ce message donnera enfin de quoi trancher.

---

- **Fix for *TV Channels*: failure persisting despite previous fixes,
  even after deleting/resetting the widget** — which ruled out a
  problem with a specific tile's state and pointed to `hls.js`'s own
  loading.

  **Most likely cause found and fixed**: the Windows packaging
  configuration tried to trim `hls.js` down to a single file via an
  exclude-then-re-include pattern (introduced in v1.42.0) — a
  configuration **never verified against a real Windows package**, for
  lack of access to a machine to actually build and test the installer.
  Abandoned: the folder now ships in full, like the other vendored
  libraries (gridstack, leaflet). Cost: ~22 MB more, far preferable to
  a core feature silently broken.

  **On-screen diagnostic added**, without relying on developer tools (a
  real obstacle so far): the error message now shows the precise cause
  — file not found (with the exact HTTP code), script execution
  failure, or a file loaded but corrupted. If the problem persists
  despite removing the exclusion pattern, this message will finally
  give something to settle it.

## 1.43.1

- **Correctif *Chaînes TV* : deux vrais bugs trouvés dans la logique de
  repli, identifiés grâce à un second relevé de console** (`405` sur
  l'URL **directe** du fournisseur, `NotSupportedError`) — le relais
  HLS de la v1.43.0 était contourné dans certains cas.
  - **Repli dangereux corrigé** : quand hls.js échoue à se charger, le
    code retombait sur `<video src>` avec **l'URL brute du
    fournisseur** — contournant le relais CORS tout juste ajouté, *et*
    de toute façon voué à l'échec (Chromium ne sait pas décoder un
    manifeste HLS brut sans hls.js, contrairement à Safari). Un message
    d'erreur honnête s'affiche désormais à la place ;
  - **Échec de chargement mis en cache définitivement, corrigé** : si
    le tout premier chargement de hls.js échouait (même pour une raison
    transitoire), cet échec restait mis en cache pour le reste de la
    session — condamnant toute tentative future, y compris après un
    nouveau clic, au repli cassé ci-dessus. Une tentative peut
    désormais réessayer proprement.

  Cause profonde de l'échec initial de chargement de hls.js toujours
  en cours d'investigation — ces deux correctifs empêchent le
  symptôme (contournement du relais, blocage permanent) de se
  reproduire, sans expliquer encore pourquoi hls.js échoue à charger
  sur cette installation précise.

---

- **Fix for *TV Channels*: two real bugs found in the fallback logic,
  identified thanks to a second console reading** (`405` on the
  provider's **direct** URL, `NotSupportedError`) — the v1.43.0 HLS
  relay was being bypassed in some cases.
  - **Dangerous fallback fixed**: when hls.js failed to load, the code
    fell back to `<video src>` with **the provider's raw URL** —
    bypassing the CORS relay just added, *and* doomed to fail anyway
    (Chromium can't decode a raw HLS manifest without hls.js, unlike
    Safari). An honest error message now shows instead;
  - **Permanently cached load failure fixed**: if the very first hls.js
    load attempt failed (even for a transient reason), that failure
    stayed cached for the rest of the session — dooming every future
    attempt, including after a fresh click, to the broken fallback
    above. An attempt can now cleanly retry.

  The root cause of hls.js's initial load failure is still under
  investigation — these two fixes prevent the symptom (relay bypass,
  permanent lockout) from recurring, without yet explaining why hls.js
  fails to load on this particular install.

## 1.43.0

- **Correctif *Chaînes TV* : les chaînes en direct ne démarraient
  jamais — cause identifiée précisément grâce à la console de
  débogage** (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, puis `405` sur
  les segments). Ce n'était pas un problème propre à Windows : hls.js
  récupère le manifeste **et** chaque segment via des requêtes
  JavaScript (XHR), soumises au CORS — contrairement à la lecture
  native (`<video src>`, utilisée pour les films et séries), qui n'y
  est pas soumise. Les plateformes IPTV, conçues pour VLC et les box
  TV, n'envoient jamais l'autorisation que le navigateur exige pour ce
  type de requête : une chaîne en direct ne pouvait donc **jamais**
  démarrer, sur aucune plateforme, quel que soit le fournisseur.

  **Relais HLS** ajouté côté serveur : le manifeste est réécrit pour
  que chaque segment — et la clé de déchiffrement AES-128 le cas
  échéant — repasse par le PiBoard, avec l'en-tête d'autorisation que
  le navigateur exige. Aucun décodage ni réencodage : un simple relais
  d'octets, vérifié identique bit à bit à l'original. Gère aussi les
  manifestes maîtres multi-débit (plusieurs qualités) et les segments
  hébergés sur un domaine différent de celui du manifeste (CDN).

  Nécessaire, pas facultatif : sans ce relais, cette fonctionnalité,
  déjà annoncée dans le widget, ne fonctionnait tout simplement jamais.

---

- **Fix for *TV Channels*: live channels never started — cause
  precisely identified thanks to the debug console**
  (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, then `405` on segments).
  This wasn't a Windows-specific problem: hls.js fetches the manifest
  **and** every segment via JavaScript requests (XHR), subject to CORS
  — unlike native playback (`<video src>`, used for movies and series),
  which isn't subject to it. IPTV platforms, built for VLC and set-top
  boxes, never send the authorization the browser requires for this
  kind of request: a live channel could therefore **never** start, on
  any platform, whichever provider.

  **HLS relay** added server-side: the manifest is rewritten so every
  segment — and the AES-128 decryption key where applicable — routes
  back through the PiBoard, with the authorization header the browser
  requires. No decoding or re-encoding: a plain byte relay, verified
  bit-identical to the original. Also handles multi-bitrate master
  playlists (several qualities) and segments hosted on a different
  domain than the manifest (a CDN).

  Necessary, not optional: without this relay, this feature, already
  advertised in the widget, simply never worked at all.

## 1.42.2

- **Correctif *Chaînes TV* : le message « Touchez pour lancer »
  semblait ne rien faire au clic, sous Windows.** Recherché avant de
  conclure : Electron autorise par défaut la lecture automatique
  **même sans clic** (`autoplayPolicy: no-user-gesture-required`,
  contrairement à un onglet de navigateur classique) — un rejet de
  lecture persistant même après un vrai clic pointe donc probablement
  vers le flux lui-même, pas vers la politique de lecture automatique.
  Le code confondait pourtant les deux cas, réaffichant le même message
  générique dans les deux situations : le premier échec (résolu par un
  clic) et un second échec *après* le clic (le flux qui ne démarre pas)
  produisaient un affichage identique, donnant l'impression que rien ne
  s'était passé.

  Désormais distingués : un échec après un vrai clic affiche un message
  différent (« cette chaîne est indisponible ») plutôt que de reboucler
  sur « Touchez pour lancer ».

- **Accès à la console de débogage clarifié.** Le raccourci réellement
  câblé dans l'app Windows est **F12** (pas Ctrl+Shift+I) ; la barre de
  menu, masquée par défaut, reste accessible par la touche **Alt**.

---

- **Fix for *TV Channels*: the "Tap to start" message seemed to do
  nothing on click, on Windows.** Researched before concluding:
  Electron allows automatic playback **even without a click** by
  default (`autoplayPolicy: no-user-gesture-required`, unlike a regular
  browser tab) — a playback rejection persisting even after a genuine
  click therefore likely points to the stream itself, not the autoplay
  policy. The code conflated the two cases, though, re-showing the same
  generic message in both situations: the first failure (resolved by a
  click) and a second failure *after* the click (the stream failing to
  start) produced an identical display, giving the impression nothing
  had happened.

  Now distinguished: a failure after a genuine click shows a different
  message ("this channel is unavailable") rather than looping back to
  "Tap to start".

- **Debug console access clarified.** The shortcut actually wired in
  the Windows app is **F12** (not Ctrl+Shift+I); the menu bar, hidden by
  default, stays reachable with the **Alt** key.

## 1.42.1

- **Correction du son muet (v1.42.0) : désormais réellement
  multi-plateforme.** La première version lançait `ffmpeg` en supposant
  qu'il soit dans le PATH — vrai sur un Raspberry Pi, mais **rarement
  sous Windows**, où ffmpeg n'est pas fourni par le système. La
  fonctionnalité n'aurait donc pratiquement jamais marché ailleurs que
  sur le Pi.

  La recherche de ffmpeg passe maintenant par la couche d'abstraction
  plateforme déjà en place dans le projet (`server/platform/`), dont la
  règle est explicite : aucun branchement système en dehors de ce
  dossier. Emplacements couverts pour chaque système :
  - **Linux / Raspberry Pi** : le PATH, plus `/usr/bin`, `/usr/local/bin`
    et `/snap/bin` (utile quand le service démarre avec un
    environnement minimal) ;
  - **macOS** : le PATH, plus les deux préfixes Homebrew — celui des Mac
    Apple Silicon (`/opt/homebrew`) diffère de celui des Mac Intel
    (`/usr/local`) — et MacPorts ;
  - **Windows** : le PATH, plus `C:\ffmpeg\bin` (le cas le plus
    répandu, archive décompressée à la main), les dossiers Program
    Files, ainsi que les emplacements de winget et Chocolatey.

- **Commande d'installation adaptée au système**, affichée par
  l'interface au lieu d'une instruction générique fausse sur deux
  systèmes sur trois : `sudo apt install ffmpeg`, `brew install ffmpeg`
  ou `winget install Gyan.FFmpeg` selon le cas.

---

- **Silent-sound fix (v1.42.0): now genuinely cross-platform.** The
  first version launched `ffmpeg` assuming it was in PATH — true on a
  Raspberry Pi, but **rarely on Windows**, where ffmpeg doesn't ship
  with the system. The feature would therefore practically never have
  worked anywhere but the Pi.

  Looking for ffmpeg now goes through the platform abstraction layer
  already present in the project (`server/platform/`), whose rule is
  explicit: no system branching outside that folder. Locations covered
  per system:
  - **Linux / Raspberry Pi**: PATH, plus `/usr/bin`, `/usr/local/bin`
    and `/snap/bin` (useful when the service starts with a minimal
    environment);
  - **macOS**: PATH, plus both Homebrew prefixes — Apple Silicon Macs
    (`/opt/homebrew`) differ from Intel ones (`/usr/local`) — and
    MacPorts;
  - **Windows**: PATH, plus `C:\ffmpeg\bin` (the most widespread case,
    a manually unpacked archive), the Program Files folders, and
    winget's and Chocolatey's locations.

- **System-appropriate install command**, surfaced by the interface
  instead of a generic instruction that's wrong on two systems out of
  three: `sudo apt install ffmpeg`, `brew install ffmpeg` or
  `winget install Gyan.FFmpeg` as applicable.

## 1.42.0

- **Chaînes TV : le son muet a désormais une solution** — nouveau
  réglage « Corriger le son muet (AC3/DTS) », **désactivé par défaut**.

  Rappel du problème (v1.41.2) : la plupart des plateformes IPTV
  encodent l'audio en AC3/DTS, qu'aucun navigateur ne sait décoder. Et
  contrairement à ce qu'on pourrait croire, on ne peut pas « ajouter un
  codec » à un navigateur : son jeu de codecs est figé à sa
  compilation.

  La solution retenue : ffmpeg convertit, sur le PiBoard, **uniquement
  la piste audio** vers un format lisible, en **recopiant la vidéo
  telle quelle sans la réencoder**. C'est ce qui rend l'opération
  abordable — mesuré sur un flux 720p H.264+AC3 : le traitement de 10 s
  de flux prend 0,44 s, soit de l'ordre de 4 % d'un cœur en temps réel.
  Un réencodage vidéo, lui, aurait été hors de portée d'un Pi.

  Vérifié de bout en bout : un flux entrant en H.264+AC3 (muet dans un
  navigateur) ressort bien en H.264+AAC, et aucun processus ffmpeg
  orphelin ne survit à la déconnexion du client — point critique sur un
  Pi, un flux en direct n'ayant pas de fin.

  Deux contreparties, d'où l'option désactivée par défaut : le flux
  transite alors par le PiBoard au lieu d'aller directement au
  navigateur, et **ffmpeg doit être installé** (`sudo apt install
  ffmpeg` sur un Pi). Son absence est détectée et signalée clairement
  plutôt que de produire un échec obscur.

---

- **TV channels: silent sound now has a fix** — new "Fix silent sound
  (AC3/DTS)" setting, **off by default**.

  Recap of the problem (v1.41.2): most IPTV platforms encode audio in
  AC3/DTS, which no browser can decode. And contrary to what one might
  assume, you can't "add a codec" to a browser: its codec set is fixed
  at build time.

  The chosen solution: ffmpeg converts, on the PiBoard, **only the
  audio track** into a readable format, **copying the video as-is
  without re-encoding it**. That's what makes the operation affordable
  — measured on a 720p H.264+AC3 stream: processing 10 s of it takes
  0.44 s, on the order of 4% of one core in real time. A video
  re-encode would have been out of a Pi's reach.

  Verified end to end: a stream coming in as H.264+AC3 (silent in a
  browser) does come out as H.264+AAC, and no orphaned ffmpeg process
  survives the client disconnecting — critical on a Pi, a live stream
  having no end.

  Two trade-offs, hence the option being off by default: the stream
  then transits through the PiBoard instead of going straight to the
  browser, and **ffmpeg must be installed** (`sudo apt install ffmpeg`
  on a Pi). Its absence is detected and reported clearly rather than
  producing an obscure failure.

## 1.41.3

- **Avions en vue : trajets manifestement faux désormais signalés.**
  Signalé via un cas concret — un « Baden-Baden → Munich » affiché pour
  un avion survolant Toulouse, soit plus de 1400 km de détour. Cause :
  la base associe un indicatif de vol à *un* trajet, de façon statique,
  or un même indicatif est réutilisé d'un jour à l'autre (parfois pour
  des liaisons différentes) et la donnée peut être datée ou erronée.
  La position réelle de l'avion est maintenant confrontée au trajet
  annoncé ; au-delà de 500 km de détour (tolérance volontairement large,
  pour ne pas jeter le doute sur un déroutement ou une attente
  légitimes), le trajet s'affiche barré avec un avertissement ⚠.
  Vérifié sur des cas réels : 1449 km de détour pour le cas signalé,
  10 km pour un vol effectivement sur sa route, 182 km pour un écart
  légitime — le seuil discrimine nettement.
- **Beaucoup plus d'avions documentés.** Deux ajouts :
  - **Modèle de l'appareil et exploitant**, recherchés à partir du code
    hex — présent sur *tous* les avions, contrairement à l'indicatif de
    vol. La popup affiche donc quelque chose d'utile même pour les
    nombreux appareils sans trajet connu (aviation générale, privé,
    vols non réguliers), là où elle restait quasiment vide ;
  - **Seconde base de trajets** (hexdb.io) interrogée en repli quand la
    première ne connaît pas l'indicatif, les couvertures ne se
    recouvrant pas entièrement.

  Aucune nouvelle dépendance : les deux sources sont gratuites, sans
  clé, et déjà du même type que celle utilisée jusqu'ici.

---

- **Aircraft nearby: blatantly wrong routes now flagged.** Reported via
  a concrete case — a "Baden-Baden → Munich" shown for an aircraft
  flying over Toulouse, i.e. more than 1400 km of detour. Cause: the
  database maps a flight callsign to *one* route, statically, but the
  same callsign gets reused from day to day (sometimes for different
  legs) and the data can be stale or wrong. The aircraft's actual
  position is now checked against the announced route; beyond 500 km of
  detour (a deliberately generous tolerance, so as not to cast doubt on
  a legitimate reroute or holding pattern), the route is shown struck
  through with a ⚠ warning. Verified against real cases: 1449 km of
  detour for the reported one, 10 km for a flight genuinely on its
  route, 182 km for a legitimate deviation — the threshold discriminates
  clearly.
- **Far more documented aircraft.** Two additions:
  - **Aircraft model and operator**, looked up from the hex code —
    present on *every* aircraft, unlike the flight callsign. The popup
    therefore shows something useful even for the many aircraft with no
    known route (general aviation, private, non-scheduled flights),
    where it used to stay nearly empty;
  - **A second route database** (hexdb.io) queried as a fallback when
    the first doesn't know the callsign, their coverage not fully
    overlapping.

  No new dependency: both sources are free, keyless, and already of the
  same kind as the one used until now.

## 1.41.2

- **Correctif *Chaînes TV* : chaînes en direct qui ne démarraient
  jamais.** Le message « Touchez pour lancer la lecture », affiché
  quand le navigateur bloque le démarrage automatique, n'avait
  **aucun gestionnaire de clic** et un `pointer-events: none` en CSS —
  un texte purement décoratif, cliquer dessus ne faisait littéralement
  rien. Corrigé : le message est désormais réellement cliquable et
  relance la lecture, cette fois avec l'interaction que le navigateur
  exigeait.
- **Diagnostic *Chaînes TV* : absence de son sur certains flux,
  expliquée.** Recherché avant de conclure : de nombreuses plateformes
  IPTV encodent l'audio en AC3/DTS pour la compatibilité avec les box
  TV, des formats qu'**aucun navigateur ne sait décoder** (restriction
  de licence) — la vidéo se lit, le son reste silencieux, et aucun
  bouton n'y peut rien changer. Une pastille ⚠ à côté du bouton son
  l'indique désormais quand c'est le cas détecté, plutôt que de laisser
  deviner si la fonctionnalité est cassée. Aucune tentative de
  transcodage : hors de portée d'un correctif, et disproportionné pour
  un Raspberry Pi.

  Au passage : une instabilité intermittente préexistante dans la suite
  de tests (bascule heure/date du widget Sport, dépendante d'une
  fenêtre de temps réel trop juste) a été rendue plus robuste par
  sondage répété plutôt qu'une attente fixe — sans rapport direct avec
  ce correctif, mais aggravée par l'allongement de la suite avec les
  nouveaux tests ajoutés ici.

---

- **Fix for *TV Channels*: live channels that never started.** The
  "Tap to start playback" message, shown when the browser blocks
  automatic startup, had **no click handler at all** and a CSS
  `pointer-events: none` — purely decorative text, clicking it did
  literally nothing. Fixed: the message is now genuinely clickable and
  retries playback, this time with the interaction the browser was
  asking for.
- **Diagnostics for *TV Channels*: missing sound on some streams,
  explained.** Researched before concluding: many IPTV platforms encode
  audio in AC3/DTS for set-top-box compatibility, formats **no browser
  can decode** (a licensing restriction) — the video plays, the sound
  stays silent, and no button can change that. A ⚠ badge next to the
  sound button now flags it when this is detected, rather than leaving
  it to guess whether the feature is broken. No transcoding attempted:
  out of scope for a fix, and disproportionate for a Raspberry Pi.

  Along the way: a pre-existing intermittent flakiness in the test
  suite (the Sport widget's time/date toggle, dependent on too tight a
  real-time window) was made more robust via repeated polling rather
  than a fixed wait — unrelated to this fix directly, but worsened by
  the suite growing longer with the new tests added here.

## 1.41.1

- **Correctif de performance : démarrage lent sous Windows, signalé sur
  une machine standard.** Trois causes identifiées et mesurées
  directement, plutôt que supposées :
  - **`jsdom` et `imapflow`/`mailparser` se chargeaient systématiquement
    au démarrage du serveur**, même sans jamais ouvrir un article RSS ni
    configurer de tuile Courriel. Mesuré : `jsdom` seul coûte un temps
    comparable à Express lui-même, `imapflow` ajoute encore ~480 ms.
    Chargés désormais **à la demande**, au premier usage réel ;
  - **`hls.js` embarquait 22 Mo de fichiers jamais utilisés** (démos,
    cartes source de chaque variante, déclarations TypeScript) pour
    532 Ko réellement servis au navigateur. Réduit au strict
    nécessaire ;
  - **L'archive ASAR, désactivée jusqu'ici**, a été réactivée de façon
    ciblée : les 4 dossiers que le serveur sert tels quels
    (`express.static`, qui a besoin de vrais fichiers) restent
    décompactés, tout le reste (le code de l'app, `jsdom`, `imapflow`…)
    profite de la lecture d'une archive unique — nettement plus rapide
    que d'ouvrir individuellement des milliers de petits fichiers, un
    écart qui se creuse particulièrement sous Windows à cause de
    l'antivirus en temps réel.

  Aucun changement de comportement : uniquement des optimisations de
  chargement, vérifiées une par une (le serveur démarre et répond
  toujours correctement, l'extraction d'article et l'accès à la boîte
  mail fonctionnent normalement dès leur premier usage réel).

---

- **Performance fix: slow startup on Windows, reported on a standard
  machine.** Three causes identified and directly measured, rather than
  assumed:
  - **`jsdom` and `imapflow`/`mailparser` were systematically loaded at
    server startup**, even without ever opening an RSS article or
    configuring a Mailbox tile. Measured: `jsdom` alone costs about as
    much time as Express itself, `imapflow` adds another ~480 ms. Now
    loaded **on demand**, on first actual use;
  - **`hls.js` shipped 22 MB of never-used files** (demos, source maps
    for every variant, TypeScript declarations) for 532 KB actually
    served to the browser. Trimmed to the strict minimum;
  - **The ASAR archive, disabled until now**, was re-enabled in a
    targeted way: the 4 folders the server serves as raw files
    (`express.static`, which needs real file descriptors) stay
    unpacked, everything else (the app's own code, `jsdom`,
    `imapflow`…) benefits from reading a single archive — markedly
    faster than opening thousands of small files individually, a gap
    that widens especially on Windows because of real-time antivirus
    scanning.

  No behavior change: purely loading optimizations, verified one by one
  (the server still starts and responds correctly, article extraction
  and mailbox access work normally on their first actual use).

## 1.41.0

- **Flux RSS : jusqu'à 3 flux combinables dans la même tuile.** Fusionnés
  en une seule liste triée par ordre chronologique (le plus récent en
  premier, quel que soit le flux d'origine). Un flux en panne n'empêche
  pas les autres de s'afficher.
  - Chaque article porte une **étiquette de source** dès qu'un 2e flux
    est configuré — le libellé court renseigné dans les réglages s'il y
    en a un (recommandé : le titre d'un flux est souvent bien trop long
    pour une étiquette compacte), sinon le titre du flux lui-même ;
  - **Avec un seul flux configuré, aucun changement** : la tuile
    affiche son nom en en-tête, comme avant. L'en-tête laisse la place
    aux étiquettes par article uniquement dès qu'un 2e flux est ajouté,
    où il n'aurait plus de sens (quelle source afficher ?).

  Deux défauts trouvés et corrigés en testant : le gabarit HTML de
  l'étiquette introduisait des espaces parasites dans le titre des
  articles (cassait une comparaison exacte utilisée par les tests), et
  un test existant sélectionnait les articles sur toute la page plutôt
  qu'une tuile précise — invisible avec une seule tuile Flux RSS,
  devenu instable dès qu'il y en a deux.

---

- **RSS Feed: up to 3 feeds combinable in the same tile.** Merged into a
  single list sorted in chronological order (most recent first,
  whichever feed it came from). A feed that's down doesn't prevent the
  others from showing.
  - Each article carries a **source tag** as soon as a 2nd feed is
    configured — the short label set in the settings if there is one
    (recommended: a feed's own title is often far too long for a
    compact tag), otherwise the feed's title itself;
  - **With a single feed configured, nothing changes**: the tile shows
    its name as a header, as before. The header gives way to per-item
    tags only once a 2nd feed is added, where it would no longer make
    sense (which source to show?).

  Two defects found and fixed while testing: the tag's HTML template
  introduced stray whitespace into article titles (broke an exact
  comparison used by the tests), and an existing test selected articles
  across the whole page rather than a specific tile — invisible with a
  single RSS Feed tile, became flaky as soon as there were two.

## 1.40.0

- **Chaînes TV : support complet de Xtream Codes**, le système derrière
  la plupart des plateformes IPTV par abonnement (identifiant + mot de
  passe dans l'URL) — celui que gèrent nativement SmartIPTV, TiviMate
  et IPTV Smarters. Détecté **automatiquement** depuis l'adresse de
  playlist déjà saisie, sans nouveau réglage à configurer.
  - **Navigation à plusieurs niveaux** : Direct / Films / Séries, puis
    les catégories de chaque source (ex. « France HD|OTT »), puis la
    liste des flux, avec un bouton retour à chaque niveau ;
  - **Séries** : un niveau supplémentaire pour parcourir les épisodes,
    regroupés par saison ;
  - **Avertissement de format** ⚠ pour les films/séries dans un format
    qu'un navigateur ne sait pas lire nativement (Matroska/`.mkv`, très
    courant en VOD) — affiché avant la lecture plutôt qu'un échec
    silencieux ;
  - Le mode M3U simple (playlists statiques comme celles du projet
    IPTV-org) reste disponible en repli automatique, inchangé.

  Ce correctif répond à un signalement : une URL Xtream saisie ne
  faisait rien remonter dans la tuile, celle-ci ne sachant lire qu'un
  fichier M3U statique classique — un système entièrement différent.

---

- **TV channels: full Xtream Codes support**, the system behind most
  subscription IPTV platforms (username + password in the URL) — the
  one SmartIPTV, TiviMate and IPTV Smarters natively handle.
  **Automatically** detected from the playlist address already typed
  in, no new setting to configure.
  - **Multi-level navigation**: Live / Movies / Series, then each
    source's categories (e.g. "France HD|OTT"), then the stream list,
    with a back button at every level;
  - **Series**: an extra level to browse episodes, grouped by season;
  - **Format warning** ⚠ for movies/series in a format a browser can't
    read natively (Matroska/`.mkv`, very common for VOD) — shown before
    playback rather than a silent failure;
  - Plain M3U mode (static playlists like the IPTV-org project's)
    remains available as an automatic fallback, unchanged.

  This fix addresses a report: a typed-in Xtream URL brought up nothing
  in the tile, since it could only read a classic static M3U file — an
  entirely different system.

## 1.39.1

- **Correctif *Flux RSS* : le message de blocage anti-robot du site
  s'affichait comme si c'était un aperçu légitime de l'article.**
  Confirmé par capture d'écran : quand Le Monde bloque la requête, la
  page renvoyée contient à la fois la photo d'illustration légitime (et
  sa légende) ET le message « Votre trafic a été identifié comme
  automatisé (bot) », mélangés dans la même zone de contenu. Le seuil
  de longueur de texte ne faisait pas la différence, et le message de
  blocage — logo noir du Monde compris — s'affichait dans la popup
  comme un aperçu normal. Détecté et écarté désormais ; la popup
  affiche le message honnête « accès refusé » à la place.

  Ce correctif n'agit que sur l'affichage : il ne résout pas la cause
  profonde (le blocage lui-même), sur laquelle j'attends toujours le
  journal serveur pour savoir si les en-têtes complets ajoutés en
  v1.38.0 changent quoi que ce soit.

---

- **Fix for *RSS Feed*: the site's anti-bot block message displayed as
  if it were a legitimate article preview.** Confirmed via screenshot:
  when Le Monde blocks the request, the returned page contains both the
  legitimate illustration photo (and its caption) AND the "Your traffic
  has been identified as automated (bot)" message, mixed within the
  same content area. The text-length threshold didn't tell them apart,
  and the block message — Le Monde's black logo included — displayed in
  the popup as a normal preview. Now detected and discarded; the popup
  shows the honest "access denied" message instead.

  This fix only addresses the display: it doesn't resolve the
  underlying cause (the block itself), on which I'm still waiting for
  the server log to know whether the full headers added in v1.38.0
  change anything at all.

## 1.39.0

- **Nouvelle tuile : Chaînes TV.** Lit une playlist de chaînes au
  format `.m3u`/`.m3u8` (le format standard de VLC et Kodi) et diffuse
  une chaîne directement dans la tuile.
  - **Liste navigable** : logos des chaînes, recherche par nom
    (insensible aux accents) et filtre par catégorie — exploitable même
    sur une playlist de plusieurs milliers d'entrées ;
  - **Lecture HLS** via hls.js, avec repli sur la lecture native du
    navigateur là où elle est meilleure (Safari, iOS) ;
  - **Plafond de qualité réglable**, sur 720p par défaut : un Pi 4 tient
    confortablement le 720p, le 1080p se dispute le processeur avec le
    reste du tableau ;
  - **Seule la liste des chaînes transite par le PiBoard** (question de
    CORS) ; les flux vidéo sont lus directement par le navigateur — lui
    faire relayer de la vidéo le mettrait à genoux ;
  - Quitter la tuile **arrête réellement le flux**, y compris lors d'une
    destruction de tuile (planification, changement de disposition,
    restauration de sauvegarde) : rien ne continue en arrière-plan.

  **Nouvelle dépendance** : `hls.js` (Apache-2.0), chargée uniquement à
  la première lecture d'une chaîne plutôt qu'au démarrage du tableau.
  **Un `npm install` est nécessaire après cette mise à jour.**

  À noter, contre-intuitif : cette tuile tourne **mieux sur le
  Raspberry Pi que dans l'application Windows**, l'environnement
  Electron de cette dernière retombant souvent sur un décodage logiciel
  là où le Chromium du Pi utilise le décodage matériel.

---

- **New tile: TV channels.** Reads a channel playlist in `.m3u`/`.m3u8`
  format (VLC and Kodi's standard format) and plays a channel right in
  the tile.
  - **Navigable list**: channel logos, search by name
    (accent-insensitive) and category filter — usable even on a
    playlist of several thousand entries;
  - **HLS playback** via hls.js, falling back to the browser's native
    playback where that performs better (Safari, iOS);
  - **Adjustable quality cap**, 720p by default: a Pi 4 handles 720p
    comfortably, 1080p competes for CPU with the rest of the board;
  - **Only the channel list goes through the PiBoard** (a CORS matter);
    video streams are read directly by the browser — making it relay
    video would bring it to its knees;
  - Leaving the tile **genuinely stops the stream**, including on tile
    destruction (scheduling, layout change, backup restore): nothing
    keeps running in the background.

  **New dependency**: `hls.js` (Apache-2.0), loaded only on first
  channel playback rather than at board startup. **An `npm install` is
  required after this update.**

  Worth noting, counter-intuitively: this tile runs **better on the
  Raspberry Pi than in the Windows app**, the latter's Electron
  environment often falling back to software decoding where the Pi's
  Chromium uses hardware decoding.

## 1.38.0

- **Flux RSS : en-têtes de navigateur complets sur la tentative de
  repli.** Jusqu'ici, le repli n'envoyait qu'un user-agent Chrome isolé
  — or un user-agent de navigateur arrivant seul, sans les en-têtes qui
  l'accompagnent toujours dans un vrai navigateur (langue acceptée,
  `Sec-Fetch-*`, indices client), est justement un signal de détection
  classique. La requête envoie désormais le jeu complet et cohérent
  d'une navigation ordinaire. La première tentative reste minimale et
  honnêtement identifiée comme PiBoard.
- **Explication de la différence Windows / Pi-Mac** trouvée en
  cherchant : l'application Windows est bâtie sur Electron, dont la
  pile réseau diffère de celle de Node utilisée sur le Pi — les deux ne
  présentent donc pas la même signature au niveau de la connexion
  elle-même, indépendamment des en-têtes HTTP. Les en-têtes complets
  couvrent la part du problème qui relève d'eux ; si un site pousse sa
  détection jusqu'à la signature de la connexion TLS, cela ne suffira
  pas, et c'est une limite qu'il faudra accepter.

---

- **RSS Feed: full browser headers on the fallback attempt.** Until
  now, the fallback only sent a lone Chrome user-agent — but a browser
  user-agent arriving on its own, without the headers that always
  accompany it in a real browser (accepted language, `Sec-Fetch-*`,
  client hints), is itself a classic detection signal. The request now
  sends the full, consistent set of an ordinary navigation. The first
  attempt stays minimal and honestly identified as PiBoard.
- **Explanation found for the Windows vs Pi/Mac difference**: the
  Windows app is built on Electron, whose networking stack differs from
  the Node one used on the Pi — so the two don't present the same
  signature at the connection level itself, regardless of HTTP headers.
  Full headers cover the part of the problem that's theirs; if a site
  pushes its detection down to the TLS connection signature, this won't
  be enough, and that's a limit to accept.

## 1.37.8

- **Précision *Flux RSS* : le message « abonnement requis » affirmait
  une cause qui n'était pas toujours la bonne.** Confirmé sur le cas
  concerné (Le Monde) : le site renvoie littéralement « Votre trafic a
  été identifié comme automatisé (bot) » avec un code de statut de
  paywall — de la détection anti-robot, pas (uniquement) un vrai
  paywall d'abonnement. Message corrigé pour rester honnête sans
  affirmer une cause précise quand elle n'est pas connue avec
  certitude : « accès refusé (abonnement requis, ou protection
  anti-robot) ». **PiBoard ne tente de contourner ni l'un ni l'autre**
  — aucun changement de comportement, uniquement le message affiché.

---

- **Precision for *RSS Feed*: the "subscription required" message
  asserted a cause that wasn't always the right one.** Confirmed on the
  reported case (Le Monde): the site literally returns "Your traffic
  has been identified as automated (bot)" with a paywall-style status
  code — anti-bot detection, not (only) a genuine subscription paywall.
  Message corrected to stay honest without asserting a specific cause
  when it isn't known for certain: "access denied (subscription
  required, or automated-traffic protection)". **PiBoard attempts to
  bypass neither** — no behavior change, only the displayed message.

## 1.37.7

- **Correctif *Flux RSS* : l'aperçu gratuit avant paywall (visible sous
  Windows) était rejeté sans même être lu.** Le code jetait la réponse
  du serveur dès qu'elle n'était pas 2xx, sans jamais regarder son
  contenu — alors que beaucoup de paywalls (dont Le Monde) renvoient la
  page complète, aperçu gratuit inclus dans le HTML, accompagnée d'un
  code de statut inhabituel (401/402) plutôt qu'un corps vide. Le corps
  de la réponse est désormais toujours lu et l'extraction toujours
  tentée dessus, quel que soit le statut HTTP.
  - Quand un aperçu exploitable est effectivement présent, il s'affiche
    désormais, avec une bannière honnête « aperçu gratuit uniquement »
    pour ne pas laisser croire au texte intégral ;
  - Quand rien d'exploitable n'est reçu (vrai blocage, corps vide), le
    comportement reste inchangé : repli sur le résumé du flux, avec le
    message « abonnement requis » introduit en v1.37.6 ;
  - **PiBoard ne tente toujours aucun contournement du paywall
    lui-même** — aucune connexion, aucun cache alternatif, aucune
    défaite du JavaScript qui masque la suite payante. Seul ce que le
    site choisit déjà de rendre visible à tout visiteur est affiché.

---

- **Fix for *RSS Feed*: the free preview before a paywall (visible on
  Windows) was discarded without even being read.** The code threw
  away the server's response as soon as it wasn't 2xx, without ever
  looking at its content — while many paywalls (including Le Monde)
  return the full page, free preview included in the HTML, along with
  an unusual status code (401/402) rather than an empty body. The
  response body is now always read and extraction always attempted on
  it, whatever the HTTP status.
  - When a usable preview is actually present, it now shows up, with an
    honest "free preview only" banner so it doesn't look like the full
    text;
  - When nothing usable comes back (a genuine block, empty body),
    behavior stays unchanged: falls back to the feed's summary, with
    the "subscription required" message introduced in v1.37.6;
  - **PiBoard still attempts no bypass of the paywall itself** — no
    login, no alternate cache, no defeating the JavaScript that hides
    the paid content. Only what the site already chooses to make
    visible to any visitor is shown.

## 1.37.6

- **Diagnostic *Flux RSS* résolu grâce au journal ajouté en v1.37.4** :
  le cas signalé (Le Monde) renvoyait un code **402 Payment Required**
  — un vrai paywall, pas le blocage anti-bot corrigé en v1.37.5. Un
  abonnement est réellement nécessaire pour lire ces articles ;
  **PiBoard ne tente jamais de contourner un paywall**, ce
  comportement est donc correct.
- **Message honnête et spécifique ajouté** pour ce cas précis : « cet
  article nécessite un abonnement » s'affiche désormais (codes 401/402
  renvoyés par le site source) plutôt que la mention générique « mode
  lecture indisponible », qui laissait à tort croire à un problème
  technique.

---

- **Diagnostics for *RSS Feed* resolved thanks to the logging added in
  v1.37.4**: the reported case (Le Monde) returned a **402 Payment
  Required** status — a real paywall, not the anti-bot blocking fixed
  in v1.37.5. A subscription is genuinely required to read these
  articles; **PiBoard never attempts to bypass a paywall**, so this
  behavior is correct.
- **Honest, specific message added** for this exact case: "this
  article requires a subscription" now shows up (401/402 status codes
  returned by the source site) instead of the generic "reader mode
  unavailable" note, which wrongly suggested a technical problem.

## 1.37.5

- **Correctif *Flux RSS* (tentative ciblée) : deuxième tentative
  d'extraction avec un identifiant de navigateur standard**, si la
  première (honnête, identifiée comme PiBoard) est bloquée. Recherche
  effectuée avant d'écrire ce correctif : le blocage de lecteurs RSS
  parfaitement légitimes par les protections anti-bot (Cloudflare Bot
  Fight Mode notamment) est un problème large et documenté, y compris
  pour des lecteurs identifiés honnêtement — cohérent avec le
  signalement (échec systématique sur Raspberry Pi et navigateur Mac,
  fonctionnement sur une installation Windows séparée, ce qui pointe
  vers un blocage lié à la réputation de l'adresse IP autant qu'à
  l'identifiant lui-même). La première tentative reste honnête ; le
  repli ne s'active que si elle échoue, et n'imite qu'un seul en-tête
  (le user-agent), pas une empreinte de navigateur complète.

  Cette correction cible l'hypothèse la plus probable, faute de pouvoir
  consulter les journaux serveur réels de l'installation concernée
  (ajoutés en v1.37.4). Si le problème persiste malgré cette mise à
  jour, le journal du serveur (désormais disponible) permettra
  d'identifier la cause exacte.

---

- **Fix for *RSS Feed* (targeted attempt): second extraction attempt
  with a standard browser identifier**, if the first one (honest,
  identified as PiBoard) gets blocked. Researched before writing this
  fix: legitimate RSS readers being blocked by anti-bot protections
  (Cloudflare Bot Fight Mode among others) is a broad, documented
  problem, even for honestly identified readers — consistent with the
  report (consistent failure on a Raspberry Pi and Mac browser, working
  on a separate Windows install, which points to a block tied to the
  source IP's reputation as much as the identifier itself). The first
  attempt stays honest; the fallback only kicks in if it fails, and
  only mimics a single header (the user-agent), not a full browser
  fingerprint.

  This fix targets the most likely hypothesis, since the actual server
  logs for the affected install aren't available to me (added in
  v1.37.4). If the problem persists despite this update, the server log
  (now available) will help pin down the exact cause.

## 1.37.4

- **Diagnostic *Flux RSS* : ajout d'un journal serveur pour les échecs
  d'extraction du texte complet**, jusqu'ici totalement silencieux —
  impossible jusqu'à présent de savoir pourquoi le mode lecture
  échouait pour un article donné sans ça. Visible dans la console/
  `journalctl` du serveur.
- **Note ajoutée quand le repli sur le résumé du flux est lui-même très
  pauvre** (souvent une simple image, de nombreux flux ne fournissant
  qu'une vignette) : indique clairement que le mode lecture en texte
  intégral n'était pas disponible pour cet article, plutôt que de
  laisser deviner si la fonctionnalité est cassée.

  Signalé : le mode lecture échoue sur Pi et sur navigateur Mac (donc
  très probablement le même serveur, hébergé sur le Pi) mais fonctionne
  sous Windows (installation Electron séparée, son propre serveur). Ces
  deux ajouts ne corrigent pas encore la cause exacte — dont je ne
  dispose pas des éléments pour la diagnostiquer à distance — mais
  rendent le problème visible et moins déroutant en attendant.

---

- **Diagnostics for *RSS Feed*: added server-side logging for full-text
  extraction failures**, previously entirely silent — until now,
  impossible to tell why reader mode failed for a given article without
  this. Visible in the server's console/`journalctl`.
- **Note added when the fallback to the feed's summary is itself very
  thin** (often just a single image, many feeds only providing a
  thumbnail): clearly states that full-text reader mode wasn't
  available for this article, rather than leaving it to guess whether
  the feature is broken.

  Reported: reader mode fails on the Pi and on a Mac browser (so very
  likely the same server, hosted on the Pi) but works on Windows
  (separate Electron install, its own server). These two additions
  don't yet fix the exact cause — which I don't have the means to
  diagnose remotely — but make the problem visible and less confusing
  in the meantime.

## 1.37.3

- **Correctif *Horloge* : colonne vide réservée à droite sans aucun
  fuseau actif.** En déplaçant le numéro de semaine hors du bloc des
  extras en v1.37.2 (il rejoint désormais le bloc horloge), la
  condition qui déclenche la disposition côte à côte n'avait pas été
  mise à jour en conséquence : activer uniquement « Afficher le numéro
  de semaine » (sans fuseau supplémentaire ni prochain événement)
  réservait quand même une colonne à droite, vide puisque son seul
  contenu prévu avait déménagé — laissant apparaître un espace sans
  justification visible.
- **Trait de séparation retiré**, jugé disgracieux — l'espacement seul
  suffit à distinguer les deux zones.

---

- **Fix for *Clock*: empty column reserved on the right with no active
  zone.** When the week number moved out of the extras block in v1.37.2
  (it now joins the clock block instead), the condition triggering the
  side-by-side layout wasn't updated to match: turning on only "Show
  week number" (no extra zone, no next event) still reserved a column
  on the right, empty since its only intended content had moved away —
  leaving a space with no visible justification.
- **Separator line removed**, judged unattractive — spacing alone is
  enough to tell the two areas apart.

## 1.37.2

- **Horloge : retouche du design de la disposition côte à côte
  (v1.37.1), signalée par capture d'écran.**
  - **Chiffres de l'heure agrandis** : le plafond de la recherche de
    taille de police était trop conservateur (limité à 65 % de la
    hauteur disponible), laissant l'heure nettement plus petite que
    l'espace réellement libre autour d'elle ;
  - **Colonne des fuseaux secondaires resserrée** : elle prenait un
    pourcentage fixe de la largeur, bien plus que nécessaire pour une
    police volontairement petite. Elle se dimensionne désormais à son
    propre contenu, laissant le maximum de place à l'heure ;
  - **Numéro de semaine déplacé** dans le bloc horloge lui-même, juste
    sous la date — plus cohérent (c'est une information sur *votre*
    date, pas sur les fuseaux des autres villes) et plus économe en
    largeur, puisqu'il n'a plus besoin de sa propre colonne.

---

- **Clock: design touch-up for the side-by-side layout (v1.37.1),
  reported via screenshot.**
  - **Larger time digits**: the font-size search ceiling was too
    conservative (capped at 65% of the available height), leaving the
    time noticeably smaller than the space actually free around it;
  - **Narrower secondary time-zone column**: it took a fixed percentage
    of the width, far more than needed for a deliberately small font.
    It now sizes itself to its own content, leaving the time as much
    room as possible;
  - **Week number moved** into the clock block itself, right below the
    date — more coherent (it's information about *your* date, not
    other cities' zones) and more width-efficient, since it no longer
    needs its own column.

## 1.37.1

- **Correctif *Horloge* : heure numérique toujours centrée avec des
  extras, peu lisible.** Avec un fuseau supplémentaire, le numéro de
  semaine ou le prochain événement activés, l'heure en mode digital
  restait centrée en permanence au-dessus des extras empilés dessous,
  la comprimant verticalement — même problème déjà corrigé pour
  l'horloge analogique (v1.24.0), pas étendu au digital lors de l'ajout
  de ces fonctionnalités (v1.36.0). Même correctif appliqué : l'heure
  se cale désormais à gauche, les extras à droite, dès qu'il y a
  quelque chose à y afficher. Sans extra activé, l'affichage reste
  centré comme avant.

---

- **Fix for *Clock*: digital time always centered with extras, hard to
  read.** With an extra time zone, the week number, or the next event
  turned on, the digital-mode time stayed permanently centered above
  the extras stacked below it, squeezing it vertically — the same
  problem already fixed for the analog clock (v1.24.0), not extended to
  digital mode when those features were added (v1.36.0). Same fix
  applied: the time now sits on the left, the extras on the right, as
  soon as there's something to show there. With no extra turned on, the
  display stays centered as before.

## 1.37.0

- **Horloge : le choix du fuseau horaire se fait désormais dans une
  liste**, tous les fuseaux IANA (418 au total) regroupés par
  continent, plutôt qu'une saisie manuelle du nom exact (ex.
  « Europe/Paris ») introduite en v1.36.0.
- **Nouveau type de champ générique « fuseau horaire »**, réutilisable
  par un futur widget : liste construite à la volée dans le navigateur
  (`Intl.supportedValuesOf`, la même source que l'affichage réel du
  fuseau), plutôt qu'une liste figée embarquée dans chaque manifeste —
  évite d'alourdir inutilement l'application (une première version
  aurait ajouté 430 Ko rien que pour ce widget).
- **Support des groupes dans les listes déroulantes** (`optgroup`)
  ajouté au système de réglages général, à l'origine pour les
  continents des fuseaux horaires, mais réutilisable par tout futur
  champ de type liste.

---

- **Clock: time zone selection is now a drop-down list**, every IANA
  zone (418 total) grouped by continent, rather than manually typing
  the exact name (e.g. "Europe/Paris") introduced in v1.36.0.
- **New generic "time zone" field type**, reusable by a future widget:
  the list is built on the fly in the browser
  (`Intl.supportedValuesOf`, the same source powering the actual zone
  display), rather than a fixed list baked into every manifest —
  avoids needlessly bloating the app (an initial version would have
  added 430 KB for this widget alone).
- **Grouped drop-down list support** (`optgroup`) added to the general
  settings system, originally for the time zones' continents, but
  reusable by any future list-type field.

## 1.36.0

- **Horloge : quatre nouvelles fonctionnalités.**
  - **Fuseaux multiples** — un fuseau horaire (nom IANA) peut remplacer
    celui du système pour l'heure principale, et jusqu'à 3 fuseaux
    secondaires s'affichent en petit dans la même tuile (façon horloge
    mondiale compacte). Fonctionne aussi bien pour une seule tuile
    multi-fuseaux que pour plusieurs tuiles Horloge, chacune sur un
    fuseau différent ;
  - **Numéro de semaine** — affiché sous la date, selon la convention
    **ISO 8601** (norme internationale) ou une convention **simple**
    (semaine 1 = celle du 1er janvier), au choix ;
  - **Jusqu'à 5 alarmes indépendantes** — heure, jours (tous les jours /
    ouvrés / week-end), libellé et son propres à chacune, réutilisant le
    système d'alerte déjà éprouvé par le widget Compte à rebours (flash
    plein écran + son généré). Bouton « Arrêter » sur la tuile pendant
    la sonnerie, pas de « Repousser ». Sonnent toujours à l'heure réelle
    du système, jamais selon un fuseau affiché à titre de référence ;
  - **Ligne « prochain événement »** — alimentée par une adresse de
    calendrier (.ics) propre à la tuile Horloge, indépendante d'une
    éventuelle tuile Agenda (fonctionne donc seule). Limite assumée et
    documentée : seuls les événements non récurrents sont détectés pour
    l'instant.

---

- **Clock: four new features.**
  - **Multiple time zones** — a time zone (IANA name) can replace the
    system's for the main displayed time, and up to 3 secondary zones
    show up small in the same tile (compact world-clock style). Works
    both for a single multi-zone tile and for several Clock tiles, each
    on a different zone;
  - **Week number** — shown below the date, following either the
    **ISO 8601** convention (international standard) or a **simple**
    one (week 1 = the week of January 1st), whichever you prefer;
  - **Up to 5 independent alarms** — each with its own time, days
    (every day / weekdays / weekend), label and sound, reusing the
    alert system already proven by the Countdown widget (full-screen
    flash + generated sound). A "Stop" button appears on the tile while
    ringing, no "Snooze". Always ring at the system's real time, never
    according to a time zone shown for reference;
  - **"Next event" line** — fed by a calendar address (.ics) of the
    Clock tile's own, independent from any Calendar tile (so it keeps
    working on its own). A deliberate, documented limit: only
    non-recurring events are currently detected.

## 1.35.0

- **Nouvelle fonctionnalité : sauvegarde et restauration complètes.**
  Accessible via un bouton en bas des réglages généraux.
  - Sauvegarde **les tuiles affichées, leur emplacement, leurs
    réglages**, les configurations réutilisables enregistrées, et le
    contenu libre par widget (le bloc-notes, notamment) ;
  - Approche générique : tout fichier de configuration présent sur le
    PiBoard est inclus automatiquement, sans liste figée à maintenir à
    chaque nouvelle fonctionnalité ;
  - **Le mot de passe de la boîte mail n'en fait jamais partie** — il
    reste dans son coffre chiffré séparé, exclu de toute sauvegarde y
    compris contre une tentative d'y en glisser un via un fichier
    importé (vérifié explicitement) ;
  - **Instantanés horodatés à la milliseconde** : une nouvelle
    sauvegarde ne peut jamais en écraser une ancienne ;
  - **Export et import de fichier** : chaque sauvegarde se télécharge,
    et un fichier peut être importé (devient une nouvelle entrée de
    l'historique, puis restauré immédiatement) ;
  - **Restauration protégée par confirmation explicite**, action
    irréversible ; rechargement automatique de la page après coup pour
    repartir d'un état propre.

---

- **New feature: complete backup and restore.** Accessible via a button
  at the bottom of general settings.
  - Backs up **the displayed tiles, their position, their settings**,
    saved reusable configurations, and free per-widget content (the
    notepad, in particular);
  - Generic approach: every configuration file present on the PiBoard
    is included automatically, with no fixed list to maintain on every
    new feature;
  - **The mailbox password is never part of it** — it stays in its
    separate encrypted vault, excluded from every backup, including
    against an attempt to slip one in via an imported file (explicitly
    verified);
  - **Millisecond-precision timestamped snapshots**: a new backup can
    never overwrite an older one;
  - **File export and import**: any backup can be downloaded, and a
    file can be imported (becomes a new history entry, then is
    immediately restored);
  - **Restore protected by an explicit confirmation**, an irreversible
    action; the page automatically reloads afterward to start from a
    clean state.

## 1.34.0

- **Correctif *Programme TV* : « Stade 2 » sur France 3 affiché à tort
  en 1re partie de soirée.** Diffusé le dimanche vers 20h05-20h10 pour
  65 minutes, ce magazine sportif l'emportait sur le vrai programme de
  soirée via la règle « le plus long gagne », dès lors que sa durée
  dépassait celle du programme réellement diffusé en première partie —
  la fenêtre de recherche démarrait alors trop tôt (20h00) pour
  l'exclure. Bornée à 20h15 par défaut : encore assez tôt pour détecter
  correctement les chaînes qui démarrent leur programme principal avant
  l'heure cible (TMC, généralement dès 20h20-20h30, vérifié non
  régressé), mais assez tard pour exclure les longs magazines diffusés
  avant la vraie soirée. Réglable comme auparavant si besoin.

---

- **Fix for *TV Guide*: "Stade 2" on France 3 wrongly shown as prime
  time.** Airing on Sundays around 8:05-8:10pm for 65 minutes, this
  sports magazine used to beat the real prime-time show via the
  "longest wins" rule whenever its duration exceeded the show actually
  airing in prime time — the search window started too early (8:00pm)
  to exclude it. Bounded to 8:15pm by default: still early enough to
  correctly detect channels that start their main show ahead of the
  target hour (TMC, typically from 8:20-8:30pm, verified not
  regressed), but late enough to exclude long-running magazines airing
  before actual prime time. Still adjustable as before if needed.

## 1.33.1

- **Correctif *Aide* : la recherche dans le sommaire était trop
  stricte** — taper « meteo » sans accent ne trouvait pas « Météo ».
  La recherche ignore désormais les accents des deux côtés (saisie et
  titres des sections), donc « meteo » et « météo » donnent le même
  résultat.

---

- **Fix for *Help*: the sidebar search was too strict** — typing
  "meteo" without an accent wouldn't find "Météo". The search now
  ignores accents on both sides (input and section titles), so "meteo"
  and "météo" give the same result.

## 1.33.0

- **Aide : nouvelle section « À propos »** — numéro de version (mis à
  jour automatiquement à chaque nouvelle version, même source que les
  réglages généraux), copyright et licence MIT, lien vers le dépôt
  GitHub.
- **Aide : recherche dans le sommaire.** Un champ fixé en tête de la
  colonne filtre les entrées à la volée par titre — utile désormais que
  la liste des tuiles dépasse la vingtaine d'entrées. Les en-têtes de
  groupe devenus vides se masquent automatiquement, avec un message
  discret si aucun résultat ne correspond.
- **Aide : mécanisme de captures d'écran** posé (dossier
  `public/help-assets/`, champ `screenshot` optionnel par section) —
  prêt à l'emploi, mais aucune image n'a été ajoutée : Claude ne peut
  pas générer d'authentiques captures de l'application réelle depuis
  son environnement de développement. Voir le `README.md` du dossier
  pour l'ajouter soi-même.

---

- **Help: new "About" section** — version number (updated automatically
  on every new release, same source as general settings), copyright and
  MIT license, link to the GitHub repository.
- **Help: sidebar search.** A box pinned at the top of the column
  filters entries live by title — useful now that the tile list has
  passed twenty entries. Group headers that become empty hide
  automatically, with a discreet message when nothing matches.
- **Help: screenshot mechanism** put in place (`public/help-assets/`
  folder, optional `screenshot` field per section) — ready to use, but
  no image has been added: Claude can't generate authentic screenshots
  of the real running app from its development environment. See the
  folder's `README.md` to add one yourself.

## 1.32.0

- **Astronomie : nouvelle section « Prochaine éclipse ».** La prochaine
  éclipse solaire ou lunaire **réellement visible** depuis la ville
  configurée — pas simplement en cours quelque part sur Terre :
  - Éclipse solaire : circonstances locales calculées directement pour
    la position exacte (une éclipse solaire ne concerne que l'endroit
    précis où l'ombre de la Lune touche le sol) ;
  - Éclipse lunaire : vérifie que la Lune est bien au-dessus de
    l'horizon à votre position au moment du maximum, en cherchant
    l'événement suivant sinon — une éclipse lunaire est visible depuis
    la moitié nocturne de la Terre, pas depuis n'importe où ;
  - Type (partielle, annulaire, totale…), pourcentage d'obscuration,
    date et heure du maximum, et un **compte à rebours compact et
    discret** (en jours, ou en heures le jour même).

  Comme la phase de lune et les planètes, **calculée directement sur le
  PiBoard**, sans appel réseau.
- **Quatre sections désormais**, chacune avec sa propre case pour
  l'afficher ou non (Lune, ISS, Planètes, Éclipse).

---

- **Astronomy: new "Next eclipse" section.** The next solar or lunar
  eclipse **actually visible** from the configured city — not merely
  happening somewhere on Earth:
  - Solar eclipse: local circumstances computed directly for the exact
    position (a solar eclipse only concerns the exact spot where the
    Moon's shadow touches the ground);
  - Lunar eclipse: checks the Moon is actually above the horizon at
    your location at the moment of the peak, searching the next event
    otherwise — a lunar eclipse is visible from the night half of
    Earth, not from just anywhere;
  - Type (partial, annular, total…), obscuration percentage, date and
    time of the peak, and a **compact, discreet countdown** (in days,
    or in hours on the day itself).

  Like moon phase and planets, **computed directly on the PiBoard**,
  with no network call.
- **Four sections now**, each with its own checkbox to show it or not
  (Moon, ISS, Planets, Eclipse).

## 1.31.0

- **Nouvelle tuile : Astronomie.** Trois sections indépendamment
  activables :
  - **Phase de lune** — icône représentant fidèlement le croissant ou
    la gibbeuse actuel (orientation correcte selon l'hémisphère), nom
    de la phase, pourcentage d'éclairement, prochaines nouvelle et
    pleine lunes ;
  - **Passages ISS** — prochains survols de la Station spatiale
    internationale au-dessus de votre position (heure, direction,
    durée, hauteur maximale), avec mise en évidence des passages
    **réellement visibles à l'œil nu** (station éclairée + ciel assez
    sombre) — réglage par défaut ;
  - **Planètes visibles** — Mercure à Saturne actuellement au-dessus
    de l'horizon, triées de la plus haute à la plus basse, avec
    direction et magnitude (Uranus/Neptune en option, non visibles à
    l'œil nu).

  **Phase de lune et planètes calculées directement sur le PiBoard**
  (bibliothèque `astronomy-engine`, MIT), sans aucun appel réseau — 
  aussi fiable qu'une horloge. Seuls les passages ISS nécessitent une
  source externe (données orbitales à jour indispensables, impossibles
  à calculer à l'avance) : `iss-api.polluxlabs.io`, gratuit et sans
  clé — un projet individuel financé par des dons, à garder à l'esprit
  si cette section venait un jour à ne plus répondre.

  **Nouvelle dépendance serveur** : `astronomy-engine`. **Un
  `npm install` est nécessaire après cette mise à jour.**

---

- **New tile: Astronomy.** Three independently toggleable sections:
  - **Moon phase** — an icon faithfully depicting the current crescent
    or gibbous shape (correct orientation for your hemisphere), phase
    name, illuminated percentage, next new and full moons;
  - **ISS passes** — the International Space Station's upcoming
    flyovers above your location (time, direction, duration, maximum
    height), highlighting passes that are **actually visible to the
    naked eye** (station sunlit + sky dark enough) — the default
    setting;
  - **Visible planets** — Mercury through Saturn currently above the
    horizon, sorted from highest to lowest, with direction and
    magnitude (Uranus/Neptune optional, not naked-eye visible).

  **Moon phase and planets computed directly on the PiBoard**
  (`astronomy-engine` library, MIT), with no network call at all — as
  reliable as a clock. Only ISS passes need an external source
  (up-to-date orbital data is essential, impossible to compute ahead
  of time): `iss-api.polluxlabs.io`, free and keyless — a solo,
  donation-funded project, worth keeping in mind should this section
  ever stop responding one day.

  **New server dependency**: `astronomy-engine`. **An `npm install` is
  required after this update.**

## 1.30.1

- **Avions : compas agrandi (64→88px) et degrés rappelés** sur les 4
  axes majeurs (0°/90°/180°/270°), sous chaque point cardinal — plus
  lisible, et plus facile de situer un cap intermédiaire d'un coup
  d'œil.

---

- **Planes: compass enlarged (64→88px) and degrees recalled** on the 4
  major axes (0°/90°/180°/270°), below each cardinal point — more
  legible, and easier to place an intermediate heading at a glance.

## 1.30.0

- **Avions en vue : compas en surimpression.** Une rose des vents fixe
  (nord toujours en haut, comme la carte elle-même) permet de comparer
  directement l'orientation d'une icône d'avion à un point cardinal
  réel — pratique pour vérifier d'un coup d'œil qu'un cap affiché
  semble cohérent.
  - **Affichage optionnel**, activé par défaut, avec sa propre case à
    cocher pour le masquer entièrement ;
  - **Position réglable** parmi les 4 coins de la carte, en bas à
    droite par défaut ;
  - **Opacité réglable** de 10 à 100 %, pour rester discret sans gêner
    la lecture de la carte en dessous.

  Correctif au passage : un piège classique de JavaScript (`0 || 70`
  retombe à tort sur 70, `0` étant une valeur « fausse ») aurait empêché
  de choisir l'opacité minimale — repéré et corrigé avant livraison.

---

- **Planes Overhead: compass overlay.** A fixed compass rose (north
  always up, like the map itself) lets you compare an aircraft icon's
  orientation directly against a real cardinal direction — handy to
  check at a glance that a displayed heading looks right.
  - **Optional display**, on by default, with its own checkbox to hide
    it entirely;
  - **Adjustable position** among the map's 4 corners, bottom right by
    default;
  - **Adjustable opacity** from 10 to 100%, to stay discreet without
    hindering the map underneath.

  Fixed along the way: a classic JavaScript pitfall (`0 || 70` wrongly
  falls back to 70, `0` being a "falsy" value) would have prevented
  picking the minimum opacity — caught and fixed before shipping.

## 1.29.1

- **Courriel : les images « ne marchaient pas » — en réalité, tout
  fonctionnait, mais le réglage était introuvable.** Après
  vérification directe du comportement réel de `mailparser` (pas
  supposé), confirmé que les images intégrées (logo, signature) sont
  déjà converties automatiquement — le code ajouté en v1.29.0 pour ça
  était sans effet, retiré. Le vrai souci : la case « Afficher les
  images distantes », désactivée par défaut, n'était visible que dans
  les réglages de la tuile, sans aucun indice au moment de lire un
  message masqué.
- **Nouveau : bouton « Afficher les images de ce message »**,
  directement dans le message ouvert quand des images ont été
  masquées — même principe que Gmail, Outlook ou Apple Mail. Un tap
  suffit pour les voir ponctuellement, sans toucher au réglage
  général (qui reste désactivé par défaut pour les prochains
  messages).

---

- **Mailbox: images "didn't work" — they actually did, but the setting
  was undiscoverable.** After directly checking (not assuming)
  `mailparser`'s real behavior, confirmed embedded images (logo,
  signature) are already converted automatically — the code added in
  v1.29.0 for this had no effect, removed. The real issue: the "Show
  remote images" setting, off by default, was only visible in the
  tile's settings, with no hint at the moment of reading a message with
  hidden images.
- **New: "Show images in this message" button**, right in the opened
  message when images were hidden — same idea as Gmail, Outlook or
  Apple Mail. One tap is enough to see them for that message, without
  touching the general setting (which stays off by default for future
  messages).

## 1.29.0

- **Courriel : bouton « Recharger »** sur la tuile — relance un relevé
  immédiatement, sans attendre le prochain rafraîchissement
  automatique. Présent sur la liste comme sur les états vide/erreur,
  avec une icône qui tourne pendant le chargement.
- **Courriel : liens cliquables réglables**, pour des raisons de
  sécurité — nouvelle case « Liens cliquables » (activée par défaut,
  comportement inchangé). Une fois désactivée, les liens s'affichent en
  texte simple, non cliquable.
- **Correctif *Courriel* : les images n'apparaissaient jamais**, y
  compris une fois « Afficher les images distantes » activé. Cause :
  les images **intégrées** au message (logo, signature — le cas le plus
  courant) sont référencées en interne par un identifiant `cid:`, jamais
  chargeable tel quel par un navigateur ; sans conversion, elles
  restaient cassées quel que soit le réglage. Elles sont désormais
  résolues côté serveur en données intégrées, et s'affichent
  **toujours** — ne chargeant rien depuis l'extérieur, elles ne posent
  aucun risque de traçage. Seules les images vraiment **distantes**
  restent soumises au réglage « Afficher les images distantes »
  (désactivé par défaut, un pixel de 1×1 suffisant à confirmer
  l'ouverture du message à l'expéditeur).

---

- **Mailbox: "Reload" button** on the tile — triggers an immediate
  check, without waiting for the next automatic refresh. Present on the
  list as well as the empty/error states, with a spinning icon during
  loading.
- **Mailbox: configurable clickable links**, for security reasons — new
  "Clickable links" setting (on by default, unchanged behavior). Once
  turned off, links display as plain, non-clickable text.
- **Fix for *Mailbox*: images never showed up**, even with "Show remote
  images" turned on. Cause: images **embedded** in the message (a logo,
  a signature — the most common case) are referenced internally by a
  `cid:` identifier, never loadable as-is by a browser; without
  conversion, they stayed broken regardless of the setting. They are now
  resolved server-side into embedded data, and **always** show — loading
  nothing from the outside, they pose no tracking risk. Only genuinely
  **remote** images stay governed by the "Show remote images" setting
  (off by default, a single 1×1 pixel being enough to confirm the
  message was opened to the sender).

## 1.28.1

- **Correctif *Courriel* : le choix d'un fournisseur ne remplissait pas
  le serveur IMAP**, contrairement à ce que l'aide annonçait — le
  mécanisme n'avait tout simplement pas été implémenté. Nouveau
  mécanisme générique (une option de liste peut désormais pré-remplir
  d'autres champs, via une propriété `fills` du manifeste), utilisable
  par un futur widget.
- **Les liens et boutons d'un courriel ouvert sont désormais
  cliquables**, contrairement à la version précédente qui les
  neutralisait entièrement. Ils s'ouvrent dans le navigateur (protection
  `noopener`/`noreferrer`), et le **domaine réel de destination est
  affiché juste après le lien** — un courriel d'hameçonnage affiche
  souvent un texte trompeur tout en pointant ailleurs, voir la vraie
  destination avant de toucher permet de le repérer. Seuls les liens
  web et de messagerie fonctionnent ; un lien `javascript:` reste
  neutralisé, son texte restant lisible.
- **Correctif de suite de tests** : une vérification temporelle
  (alternance heure/date de la tuile Scores sportifs) était devenue
  instable — la suite ayant grossi au fil des sessions, le délai avant
  d'atteindre cette vérification pouvait désormais dépasser le cycle de
  bascule testé. Remplacée par une vérification aller-retour, robuste
  quelle que soit la phase de départ.

---

- **Fix for *Mailbox*: picking a provider didn't fill in the IMAP
  server**, despite what the help said — the mechanism simply hadn't
  been implemented. New generic mechanism (a select option can now
  pre-fill other fields, via a manifest `fills` property), reusable by a
  future widget.
- **Links and buttons in an opened email are now clickable**, unlike
  the previous version which fully neutralized them. They open in the
  browser (`noopener`/`noreferrer` protection), and the **real
  destination domain is shown right after the link** — a phishing email
  often shows misleading text while pointing elsewhere, seeing the true
  destination before tapping helps spot it. Only web and mail links
  work; a `javascript:` link stays neutralized, its text still readable.
- **Test suite fix**: a timing-based check (the Sports scores tile's
  time/date alternation) had become flaky — as the suite grew across
  sessions, the delay before reaching that check could now exceed the
  toggle cycle being tested. Replaced with a round-trip check, robust
  regardless of the starting phase.

## 1.28.0

- **Nouvelle tuile : Courriel.** Affiche les derniers messages d'une
  boîte aux lettres IMAP — objet, expéditeur, date, non-lus en gras — et
  ouvre le message dans une popup au clic, sur le même principe que la
  tuile Flux RSS. Nombre de messages, dossier surveillé et affichage des
  seuls non-lus sont réglables.
  - **Rien n'est stocké sur le PiBoard** : chaque affichage ouvre une
    connexion, lit, et referme ;
  - **Strictement en lecture seule** : consulter un message ici ne le
    marque jamais comme lu sur votre téléphone ou ordinateur ;
  - **Contenu désinfecté** avant affichage : scripts retirés, liens
    rendus non cliquables (pas d'hameçonnage touché par mégarde sur un
    écran tactile), images distantes remplacées par une mention — leur
    chargement confirmerait sinon à l'expéditeur que le message a été
    ouvert.
- **Nouveau mécanisme : champs « secret ».** Contrairement aux champs
  mot de passe existants, leur valeur n'est **jamais** conservée dans
  les réglages de la tuile : elle part dans un coffre chiffré côté
  serveur, dans un fichier distinct, et n'en redescend jamais. Un mot de
  passe de boîte mail ne peut donc pas se retrouver dans une sauvegarde
  de disposition ni dans une configuration partagée. Supprimer la tuile
  efface le secret associé.
- **Compatibilité** : free.fr, Orange, OVH, SFR, La Poste et tout
  serveur IMAP standard. Gmail, Yahoo et iCloud nécessitent un « mot de
  passe d'application ». **Les comptes Outlook.com/Hotmail personnels ne
  sont pas pris en charge** : Microsoft y a définitivement désactivé
  l'authentification par mot de passe et n'y propose aucun mot de passe
  d'application — seul OAuth2 fonctionnerait, il n'est pas encore
  implémenté.

  **Nouvelles dépendances serveur** : `imapflow` et `mailparser` (toutes
  deux sous licence MIT). **Un `npm install` est nécessaire après cette
  mise à jour.**

---

- **New tile: Mailbox.** Shows an IMAP mailbox's latest messages —
  subject, sender, date, unread in bold — and opens a message in a popup
  on tap, on the same principle as the RSS feed tile. Message count,
  watched folder and unread-only display are configurable.
  - **Nothing is stored on the PiBoard**: each display opens a
    connection, reads, and closes;
  - **Strictly read-only**: reading a message here never marks it as
    read on your phone or computer;
  - **Sanitized content** before display: scripts removed, links made
    non-clickable (no phishing tapped by mistake on a touchscreen),
    remote images replaced by a note — loading them would otherwise
    confirm to the sender that the message was opened.
- **New mechanism: "secret" fields.** Unlike the existing password
  fields, their value is **never** kept in the tile's settings: it goes
  to an encrypted server-side vault, in a separate file, and never comes
  back down. A mailbox password therefore can't end up in a layout
  backup or a shared configuration. Removing the tile erases its secret.
- **Compatibility**: free.fr, Orange, OVH, SFR, La Poste and any
  standard IMAP server. Gmail, Yahoo and iCloud require an "app
  password". **Personal Outlook.com/Hotmail accounts are not
  supported**: Microsoft has permanently disabled password
  authentication there and offers no app password — only OAuth2 would
  work, and it isn't implemented yet.

  **New server dependencies**: `imapflow` and `mailparser` (both
  MIT-licensed). **An `npm install` is required after this update.**

## 1.27.0

- **Correctif : catalogue de widgets trop dense.** Les descriptions
  affichées dans la liste d'ajout de tuile étaient parfois très longues
  (jusqu'à 770 caractères pour la tuile Météo), produisant des pavés de
  texte démesurés. Chaque widget affiche désormais un **intitulé court**,
  focalisé sur sa fonction première. La description complète reste
  accessible via une petite icône **ⓘ** dans le coin de chaque tuile du
  catalogue, au survol (souris) comme au tap (tactile).

---

- **Fix: widget catalog too dense.** Descriptions shown in the
  add-a-tile list were sometimes very long (up to 770 characters for the
  Weather tile), producing oversized text blocks. Every widget now shows
  a **short blurb**, focused on its primary function. The full
  description stays available via a small **ⓘ** icon in the corner of
  each catalog tile, on hover (mouse) as well as tap (touch).

## 1.26.1

- **Correctif *Avions en vue* : « recherche de trajet indisponible »
  affiché à tort pour la plupart des avions.** adsbdb.com répond par un
  404 — documenté comme volontaire — pour un indicatif qu'elle ne
  connaît simplement pas (vol privé, aviation générale, ou absent de sa
  base), ce qui concerne une bonne partie des avions. Ce 404 était
  jusqu'ici traité comme une vraie erreur ; il affiche désormais
  clairement « trajet inconnu », réservant le message d'indisponibilité
  aux échecs réels (réseau, serveur).
- **Sur l'orientation des avions** : vérification faite, le calcul de
  rotation est mathématiquement correct (icône dessinée nez en haut +
  rotation CSS horaire = convention de cap boussole standard), et
  `track` est bien le champ ADS-B approprié. La flèche pointe vers le
  **cap réel actuel** de l'avion, pas vers sa destination finale — ces
  deux caps peuvent différer nettement juste après un décollage ou
  pendant un guidage du contrôle aérien. Deux améliorations tout de
  même : un avion sans cap transmis à l'instant de la requête affiche
  désormais une icône neutre (un rond) plutôt que de pointer par défaut
  vers le nord ; le cap brut est rappelé dans la popup de trajet, pour
  vérification indépendante de l'icône.

---

- **Fix for *Planes Overhead*: "route lookup unavailable" wrongly shown
  for most aircraft.** adsbdb.com responds with a 404 — documented as
  intentional — for a callsign it simply doesn't know (private flight,
  general aviation, or missing from its database), which covers a good
  share of aircraft. This 404 used to be treated as a genuine error; it
  now clearly shows "route unknown", reserving the unavailable message
  for actual failures (network, server).
- **On aircraft orientation**: checked and confirmed, the rotation math
  is correct (icon drawn nose-up + clockwise CSS rotation = standard
  compass bearing convention), and `track` is the right ADS-B field.
  The arrow points to the aircraft's **current actual heading**, not its
  final destination — the two can differ noticeably just after takeoff
  or while being vectored by air traffic control. Two improvements
  regardless: an aircraft with no heading transmitted at request time
  now shows a neutral icon (a plain circle) rather than defaulting to
  north; the raw heading is recalled in the route popup, for
  verification independent from the icon.

## 1.26.0

- **Nouveau : planification par tuile.** Chaque tuile dispose désormais
  d'une section **Planification** dans ses réglages, permettant de ne
  l'activer que certains jours et à certaines heures — par exemple le
  trajet domicile-travail uniquement du lundi au vendredi entre 7 h et
  9 h, ou la météo du week-end le samedi et le dimanche.
  - Hors de sa plage, la tuile **garde exactement sa place** dans la
    grille (aucune autre tuile ne bouge) et affiche « En pause » avec un
    rappel de sa plage ;
  - Surtout, son widget est **réellement arrêté** : plus aucune
    minuterie ni appel réseau. C'est le principal intérêt pour les
    tuiles soumises à un quota — la tuile Trajet cesse par exemple de
    consommer le quota TomTom la nuit et le week-end ;
  - Les réglages d'une tuile en pause **restent accessibles**, pour
    pouvoir la réactiver ;
  - **Désactivée par défaut** : les tuiles existantes ne changent pas de
    comportement ;
  - Aucun jour coché = tous les jours ; plage horaire facultative ; les
    plages à cheval sur minuit (ex. 22:00 → 06:00) sont gérées, le jour
    coché désignant alors celui où la plage démarre.

---

- **New: per-tile scheduling.** Every tile now has a **Scheduling**
  section in its settings, letting you make it active only on certain
  days and at certain times — for instance the commute tile only Monday
  to Friday between 7am and 9am, or the weekend weather on Saturday and
  Sunday.
  - Outside its window, the tile **keeps exactly its spot** in the grid
    (no other tile moves) and shows "Paused" with a reminder of its
    window;
  - Above all, its widget is **actually stopped**: no more timers or
    network calls. That's the main benefit for tiles subject to a quota
    — the Commute tile, for example, stops eating the TomTom quota at
    night and on weekends;
  - A paused tile's settings **stay accessible**, so it can be
    re-enabled;
  - **Off by default**: existing tiles don't change behavior;
  - No day ticked = every day; the time window is optional; windows
    crossing midnight (e.g. 22:00 → 06:00) are handled, the ticked day
    then being the one the window starts on.

## 1.25.0

- **Agenda : renforcement défensif du parseur ICS.** Suite à un
  signalement (finalement dû à un réglage côté utilisateur, pas au
  widget), quelques lacunes réelles ont été corrigées au passage :
  - Support de la propriété **`DURATION`** comme alternative à
    `DTEND` (RFC5545 autorise les deux) ;
  - Retrait automatique d'un éventuel **BOM UTF-8** en tête de fichier
    (laissé par certains exports, dont des flux publiés par iCloud),
    qui pouvait perturber la lecture de la toute première propriété ;
  - **Diagnostic plus détaillé** dans la console quand un calendrier
    répond correctement mais qu'aucun événement n'en ressort — distingue
    désormais un flux réellement vide d'une réponse qui n'est pas de
    l'ICS du tout (utile pour un futur signalement).

---

- **Calendar: defensive hardening of the ICS parser.** Following a
  report (which turned out to be a user-side setting, not the widget),
  a few real gaps were fixed along the way:
  - Support for the **`DURATION`** property as an alternative to
    `DTEND` (RFC5545 allows either);
  - Automatic stripping of a possible **UTF-8 BOM** at the start of the
    file (left by some exports, including feeds published by iCloud),
    which could disrupt reading the very first property;
  - **More detailed diagnostics** in the console when a calendar
    responds correctly but no event comes out of it — now tells a
    genuinely empty feed apart from a response that isn't ICS at all
    (useful for a future report).

## 1.24.2

- **Correctif *Horloge*** : en mode analogique avec texte affiché, la
  date et le saint du jour débordaient de la tuile (texte coupé en haut
  et en bas). Cause : la taille de police n'était calculée qu'une seule
  fois, au tout premier affichage — à ce moment précis, la case texte
  est encore vide (son contenu n'est écrit que juste après), donc
  n'importe quelle taille « tenait » sans déborder. Une fois le vrai
  texte inséré, plus aucun recalcul n'avait lieu, laissant une taille
  bien trop grande pour le contenu réel. Le recalcul se fait désormais
  systématiquement après l'insertion du texte — y compris quand le
  saint du jour arrive un peu plus tard (chargement asynchrone) ou que
  la longueur du texte change.

---

- **Fix for *Clock***: in analog mode with text shown, the date and
  name day overflowed the tile (text clipped at the top and bottom).
  Cause: the font size was only computed once, at the very first
  render — at that exact moment, the text box is still empty (its
  content is only written right after), so any size "fit" without
  overflowing. Once the real text was inserted, no recalculation ever
  happened again, leaving a size far too large for the actual content.
  The recalculation now systematically happens after the text is
  inserted — including when the name day arrives a bit later
  (asynchronous loading) or when the text's length changes.

## 1.24.1

- **Correctif *Horloge*** : en mode analogique avec disposition cadran
  à gauche / texte à droite (v1.24.0), la taille du texte restait
  calculée sur un pourcentage fixe de la hauteur — trop conservatrice,
  elle laissait beaucoup d'espace inutilisé à droite du cadran sur une
  tuile large. Remplacée par une recherche dichotomique (le même
  principe que l'heure en mode digital) qui agrandit le texte jusqu'à
  la limite réelle de largeur ou de hauteur disponible, remplissant
  effectivement la colonne de texte.

---

- **Fix for *Clock***: in analog mode with the face-left/text-right
  layout (v1.24.0), the text size was still computed from a fixed
  percentage of the height — too conservative, it left a lot of unused
  space to the right of the face on a wide tile. Replaced with a binary
  search (the same approach as the time in digital mode) that grows the
  text up to the actual available width or height limit, genuinely
  filling the text column.

## 1.24.0

- **Correctif *Horloge* : mode analogique trop petit.** Avec la date
  affichée, le cadran et le texte étaient empilés verticalement — le
  cadran devait alors se partager la hauteur de la tuile avec le texte
  en dessous, ce qui l'écrasait sur la plupart des formes de tuile
  courantes. Le cadran se cale désormais **à gauche** et le texte
  (date, saint du jour) **à droite** dès que la date est affichée : le
  cadran garde toute la hauteur disponible, sans changement si la date
  est masquée (il occupe alors tout le cadre comme avant).

---

- **Fix for *Clock*: analog mode too small.** With the date shown, the
  face and the text used to be stacked vertically — the face then had
  to share the tile's height with the text below it, which squeezed it
  on most common tile shapes. The face now sits **on the left** and the
  text (date, name day) **on the right** as soon as the date is shown:
  the face keeps the full available height, with no change when the
  date is hidden (it then fills the whole frame as before).

## 1.23.0

- **Radar météo : couche vent optionnelle.** Une grille de flèches peut
  désormais se superposer à la carte pour montrer le vent en cours
  (désactivée par défaut) :
  - Chaque flèche pointe **vers où souffle le vent** — et non d'où il
    vient, contrairement à la convention météo brute, qui prête
    régulièrement à confusion sur une carte ;
  - Sa **couleur indique la force**, d'après les paliers de l'échelle de
    Beaufort : du vert (calme) au violet (tempête), avec sa **propre
    légende** distincte de celle de la pluie pour éviter toute confusion
    entre les deux couches ;
  - La grille **suit la zone affichée** : elle se recalcule à chaque
    zoom ou déplacement, de sorte que zoomer resserre naturellement les
    flèches sur ce que vous regardez ;
  - **Densité réglable** (faible / moyenne / élevée), la grille
    s'adaptant en plus à la forme de la tuile ;
  - **Vitesse en km/h** affichable sous chaque flèche, en option.

  Toutes les positions de la grille sont demandées en **une seule
  requête** à Open-Meteo (déjà utilisé par les tuiles Météo et Qualité
  de l'air), plutôt qu'une par point.

---

- **Weather Radar: optional wind layer.** A grid of arrows can now
  overlay the map to show the current wind (off by default):
  - Each arrow points **where the wind is blowing to** — not where it
    comes from, unlike the raw meteorological convention, which is a
    regular source of confusion on a map;
  - Its **color shows the strength**, following the Beaufort scale's
    thresholds: from green (calm) to purple (storm), with its **own
    legend**, distinct from the rain one to avoid confusing the two
    layers;
  - The grid **follows the displayed area**: it is recomputed on every
    zoom or pan, so zooming in naturally tightens the arrows onto what
    you're looking at;
  - **Adjustable density** (low / medium / high), with the grid also
    adapting to the tile's shape;
  - **Speed in km/h** can optionally be shown under each arrow.

  All grid positions are requested in **a single call** to Open-Meteo
  (already used by the Weather and Air Quality tiles), rather than one
  per point.

## 1.22.0

- **Nouvelle tuile : Sports mécaniques** — le programme complet des
  séances d'un week-end de **Formule 1** ou de **MotoGP** : essais
  libres, qualifications, course sprint et course, chacun avec son jour
  et son heure locale (convertie automatiquement depuis le fuseau du
  circuit).
  - Les séances **terminées** restent visibles mais estompées, la
    séance **en cours** est signalée par une pastille clignotante, et la
    **prochaine à venir** est mise en avant — le tout se rafraîchit tout
    seul chaque minute, sans nouvel appel réseau ;
  - Code couleur par type : essais (gris), qualifications (orange),
    sprint (violet), course (rouge) ;
  - Un mode **calendrier** liste plutôt les prochaines manches de la
    saison avec leurs dates ;
  - Pour le MotoGP, les catégories Moto2, Moto3 et MotoE peuvent être
    ajoutées au programme (réglage dédié) ;
  - Une manche en cours reste affichée jusqu'à sa course du dimanche,
    plutôt que de sauter à la suivante dès le samedi soir.

  Données F1 via **Jolpica-F1** (gratuit, sans clé — le successeur
  communautaire de l'API Ergast, retirée fin 2024) et MotoGP via le
  **flux public de motogp.com**. Ce dernier n'étant pas documenté
  officiellement, il peut changer sans préavis : la tuile se replie
  alors proprement sur un message d'indisponibilité, comme les autres.

---

- **New tile: Motorsport schedule** — the full session timetable for a
  **Formula 1** or **MotoGP** race weekend: free practice, qualifying,
  sprint and race, each with its day and local start time (converted
  automatically from the circuit's timezone).
  - **Finished** sessions stay visible but dimmed, the **ongoing**
    session gets a pulsing dot, and the **next one up** is highlighted —
    all of it refreshing on its own every minute, with no new network
    call;
  - Color code per type: practice (grey), qualifying (orange), sprint
    (purple), race (red);
  - A **calendar** mode lists the season's upcoming rounds with their
    dates instead;
  - For MotoGP, the Moto2, Moto3 and MotoE classes can be added to the
    timetable (dedicated setting);
  - An ongoing round stays displayed through its Sunday race, rather
    than jumping to the next one from Saturday evening.

  F1 data via **Jolpica-F1** (free, keyless — the community successor to
  the Ergast API, retired end of 2024) and MotoGP via **motogp.com's
  public feed**. The latter isn't officially documented, so it may
  change without notice: the tile then degrades cleanly to an
  "unavailable" message, like the others.

## 1.21.0

- **Trajet domicile-travail : suggestions d'adresse cliquables**,
  remplaçant la simple validation textuelle de la v1.20.0 — plus simple
  et plus fiable. En tapant dans un champ Adresse A/B ou une adresse de
  trajet supplémentaire, une liste de suggestions apparaît (recherche
  après une courte pause, même principe que la recherche de ville des
  paramètres généraux) ; cliquer une suggestion remplit directement le
  champ avec l'adresse complète telle que comprise. Plus besoin de
  taper une adresse parfaitement formée à l'avance.

---

- **Commute time: clickable address suggestions**, replacing the plain
  text validation from v1.20.0 — simpler and more reliable. Typing into
  an Address A/B field or an extra trip's address now shows a
  suggestion list (searches after a short pause, same idea as the
  general settings' city search); clicking a suggestion fills the field
  directly with the full address as understood. No need to type a
  perfectly-formed address ahead of time.

## 1.20.0

- **Trajet domicile-travail : validation d'adresse en direct.** Les
  champs Adresse A/B et les 5 adresses de trajets supplémentaires se
  vérifient désormais pendant la saisie (recherche automatique après une
  courte pause) : une confirmation verte affiche l'adresse complète
  telle que comprise (ex. « ✓ 12 Rue de Paris, 31000 Toulouse, France »),
  ou un message rouge si elle est introuvable. Fini le doute qui menait
  à un « Itinéraire indisponible » bien plus tard sans savoir si le
  problème venait de l'adresse elle-même. Ce nouveau type de champ
  (« address ») est générique et pourra être réutilisé par un futur
  widget.

---

- **Commute time: live address validation.** The Address A/B fields and
  the 5 extra-trip addresses now validate as you type (automatic search
  after a short pause): a green confirmation shows the full address as
  understood (e.g. "✓ 12 Rue de Paris, 31000 Toulouse, France"), or a red
  message if it can't be found. No more wondering about a much-later
  "Route unavailable" message without knowing whether the address itself
  was the problem. This new field type ("address") is generic and can be
  reused by a future widget.

## 1.19.2

- **Correctif : clé API TomTom masquée par défaut** dans les réglages
  des tuiles *Trajet domicile-travail* et *Trafic* — champ mot de passe
  avec bouton « Afficher »/« Masquer », au lieu d'un texte en clair
  visible par-dessus l'épaule de quiconque ouvre les réglages.

---

- **Fix: TomTom API key hidden by default** in the *Commute time* and
  *Traffic* tile settings — a password-style field with a
  Show/Hide button, instead of plain text visible to anyone glancing
  over your shoulder while the settings are open.

## 1.19.1

- **Correctif *application Windows*** : plantage au lancement avec
  « Cannot find module '@mozilla/readability' ». Cause : `npm install`
  n'avait pas été relancé avant `npm run publish` après la v1.19.0, donc
  les nouvelles dépendances (`@mozilla/readability`, `jsdom`) n'étaient
  tout simplement pas présentes dans `node_modules` au moment de
  l'empaquetage — `electron-builder.yml` était correct, c'est
  l'installation locale qui manquait. `npm install` s'exécute désormais
  **automatiquement** avant tout `npm run dist` ou `npm run publish` :
  ce type d'oubli ne peut plus se reproduire, quelle que soit la
  dépendance ajoutée à l'avenir. Ne concerne que l'outillage de build,
  pas le Raspberry Pi.

---

- **Fix for the *Windows app***: crashed on launch with "Cannot find
  module '@mozilla/readability'". Cause: `npm install` hadn't been
  re-run before `npm run publish` after v1.19.0, so the new dependencies
  (`@mozilla/readability`, `jsdom`) simply weren't present in
  `node_modules` at packaging time — `electron-builder.yml` was correct,
  the local install was missing. `npm install` now runs **automatically**
  before any `npm run dist` or `npm run publish`: this kind of oversight
  can no longer happen, whichever dependency gets added in the future.
  Only concerns the build tooling, not the Raspberry Pi.

## 1.19.0

- **Flux RSS : véritable mode lecture.** La popup ouverte au clic sur un
  article n'affiche plus seulement le résumé du flux (souvent très
  court, voire quasi vide selon les sites) : elle tente désormais de
  récupérer le **texte complet de l'article directement depuis la page
  liée**, via **Mozilla Readability** — la même bibliothèque que le
  mode lecture de Firefox — qui isole le texte de l'article et écarte
  publicités, menus, colonnes « à lire aussi » et pied de page.
  - **L'illustration fournie par le flux** (`<media:content>`, avec
    légende et crédit photo quand disponibles) est affichée en tête de
    popup, quelle que soit la source du texte ;
  - **Repli automatique et silencieux** sur le résumé du flux si la page
    n'est pas accessible (paywall, blocage) ou si le texte récupéré est
    jugé trop pauvre pour être utile ;
  - Le nettoyage (scripts, gestionnaires d'événements, liens neutralisés)
    s'applique désormais aussi bien au texte extrait qu'au contenu brut
    du flux ;
  - Usage strictement à la demande — un appel serveur par clic sur un
    article, jamais de récupération en masse ni de mise en cache
    persistante : l'équivalent fonctionnel du mode lecture d'un
    navigateur pour la consultation personnelle d'un lien déjà choisi.

  **Nouvelles dépendances serveur** : `@mozilla/readability` et `jsdom`
  (ce dernier passé de dépendance de test à dépendance de production).
  **Un `npm install` est nécessaire après cette mise à jour.**

---

- **RSS feed: genuine reader mode.** The popup opened when tapping an
  article no longer just shows the feed's summary (often very short, or
  nearly empty depending on the site): it now attempts to fetch the
  **full article text directly from the linked page**, via **Mozilla
  Readability** — the same library behind Firefox's reader mode — which
  isolates the article text and discards ads, menus, "related articles"
  sections and footers.
  - **The feed's own illustration** (`<media:content>`, with caption and
    photo credit when available) is shown at the top of the popup,
    whichever text source is used;
  - **Automatic, silent fallback** to the feed's summary if the page
    isn't reachable (paywall, blocking) or the fetched text is judged
    too thin to be useful;
  - Cleanup (scripts, event handlers, neutralized links) now applies to
    the extracted text as well as the feed's raw content;
  - Strictly on-demand usage — one server call per tap on an article,
    never bulk fetching or persistent caching: the functional equivalent
    of a browser's reader mode for personal reading of an already-chosen
    link.

  **New server dependencies**: `@mozilla/readability` and `jsdom` (the
  latter moved from a test dependency to a production one). **An
  `npm install` is required after this update.**

## 1.18.1

- **Correctif *Météo* : cause commune trouvée pour trois anomalies dans
  la vue détaillée** — les 3 derniers jours de la prévision 7 jours à
  0°, l'indice UV invisible, et la pluie imminente jamais détectée.
  Cause : quand un modèle météo national précis est choisi (au lieu de
  « Meilleure correspondance »), la requête unique restreignait *toutes*
  les données à ce modèle — or certains modèles uniques ont un horizon
  de prévision plus court que 7 jours (ex. Météo-France ~4 jours) ou ne
  fournissent pas l'indice UV / les données à 15 minutes. La vue
  détaillée (24h, 7 jours, UV, pluie imminente) passe désormais
  **toujours** par « Meilleure correspondance », indépendamment du
  modèle choisi pour la météo du jour même — corrige les trois
  anomalies définitivement, quel que soit le modèle sélectionné.
- **Prévisions 7 jours en colonnes** plutôt qu'en lignes, pour une vue
  d'ensemble de la semaine plus naturelle à lire.
- **Pavés des 24 prochaines heures agrandis**, avec une **icône météo**
  par heure (soleil, nuageux, pluie, neige, orage…), en plus de la
  température et de la probabilité de pluie.

---

- **Fix for *Weather*: common cause found for three detailed-view
  glitches** — the last 3 days of the 7-day forecast showing 0°, an
  invisible UV index, and imminent rain never being detected. Cause:
  when a precise national weather model is chosen (instead of "Best
  match"), the single request restricted *all* data to that model — but
  some single models have a forecast horizon shorter than 7 days (e.g.
  Météo-France ~4 days) or don't provide the UV index / 15-minute data.
  The detailed view (24h, 7-day, UV, imminent rain) now **always** goes
  through "Best match", independent from the model chosen for today's
  own weather — fixes all three glitches for good, whichever model is
  selected.
- **7-day forecast in columns** rather than rows, for a more natural
  week-at-a-glance layout.
- **Enlarged next-24-hours cards**, with a **weather icon** per hour
  (sun, cloudy, rain, snow, storm…), alongside the temperature and rain
  probability.

## 1.18.0

- **Trajet domicile-travail : passage à l'API Routing de TomTom**
  (même clé que la tuile Trafic), remplaçant le serveur de démonstration
  OSRM. Pour le trajet principal (A→B et/ou B→A) **et** chacun des 5
  trajets supplémentaires :
  - **Temps de trajet avec trafic réel**, plus précis qu'une estimation
    théorique ;
  - **Comparaison au temps habituel** pour ce jour et cette heure (ex.
    « 25 min (+10 min) »), avec **alerte colorée** — vert à l'heure,
    orange retard modéré, rouge fort retard (seuils réglables) ;
  - **Heure de départ conseillée**, calculée avec le trafic *prévu*,
    quand une heure d'arrivée souhaitée est renseignée pour ce trajet
    (nouveaux réglages, un par trajet — laissez vide pour simplement
    afficher le temps en direct, maintenant).

  Le géocodage des adresses reste gratuit (OpenStreetMap Nominatim) ;
  seul le calcul d'itinéraire passe désormais par TomTom. Un compteur de
  quota quotidien apparaît sur la tuile, comme pour la tuile Trafic —
  les deux partagent le même quota de compte (2500 requêtes/jour en
  offre gratuite). Le rafraîchissement minimum est relevé à 10 minutes
  (au lieu de 5), chaque cycle pouvant désormais déclencher plusieurs
  requêtes TomTom.

---

- **Commute time: switched to TomTom's Routing API** (same key as the
  Traffic tile), replacing the OSRM demo server. For the main route
  (A→B and/or B→A) **and** each of the 5 extra trips:
  - **Travel time with real traffic**, more accurate than a theoretical
    estimate;
  - **Comparison to the usual time** for that day and hour (e.g. "25 min
    (+10 min)"), with a **colored alert** — green on time, orange
    moderate delay, red heavy delay (adjustable thresholds);
  - **Suggested departure time**, computed with *predicted* traffic,
    when a desired arrival time is set for that trip (new settings, one
    per trip — leave empty to just show the live time, right now).

  Address geocoding stays free (OpenStreetMap Nominatim); only route
  computation now goes through TomTom. A daily quota counter appears on
  the tile, like on the Traffic tile — both share the same account
  quota (2500 requests/day on the free tier). The minimum refresh
  interval is raised to 10 minutes (from 5), since each cycle can now
  trigger several TomTom requests.

## 1.17.1

- **Correctif *Radar météo*** : zoomer ou déplacer la carte pendant la
  lecture de la boucle rendait l'animation erratique (changements
  d'image rapides et désordonnés). Cause : chaque image mise en cache
  restant montée en permanence (juste rendue invisible), son événement
  de chargement Leaflet se redéclenchait à chaque zoom/déplacement — et
  chacun de ces déclenchements relançait sa propre planification de la
  boucle de lecture, empilant des dizaines de minuteries concurrentes.
  Corrigé pour ne réagir qu'au tout premier chargement de chaque image,
  comme prévu à l'origine. La lecture se met par ailleurs
  automatiquement en pause pendant qu'on zoome ou déplace la carte.

---

- **Fix for *Weather Radar***: zooming or panning the map during loop
  playback made the animation erratic (fast, disordered frame changes).
  Cause: each cached frame staying permanently mounted (just made
  invisible), its Leaflet load event would refire on every zoom/pan —
  and each of those refires re-triggered its own playback-loop
  scheduling, stacking dozens of concurrent timers. Fixed to only react
  to each frame's very first load, as originally intended. Playback also
  now automatically pauses while zooming or panning the map.

## 1.17.0

- **Météo : vue détaillée au clic.** La tuile Météo garde son apparence
  compacte habituelle, mais devient cliquable — un tap ouvre une modal
  avec :
  - la **bande horaire des 24 prochaines heures** (température et
    probabilité de pluie, heure par heure, démarrant maintenant et non
    à minuit) ;
  - les **prévisions sur 7 jours** (icône, min/max, probabilité de
    pluie) ;
  - l'**indice UV** du jour, avec sa bande qualitative (Faible à
    Extrême, selon les recommandations de l'OMS) ;
  - les **rafales de vent** actuelles ;
  - l'**heure de lever et de coucher du soleil**.

  Chaque section se dégrade proprement si une donnée manque (pertinent
  pour la source « Personnalisé »).
- **Nouveau : ligne « pluie dans ~X min »** sur la tuile compacte,
  affichée automatiquement — et uniquement — quand de la pluie est
  détectée dans l'heure qui vient (via les données `minutely_15`
  d'Open-Meteo). Reprise en bannière dans la vue détaillée. Reste
  invisible le reste du temps, comme demandé.

---

- **Weather: detailed view on tap.** The Weather tile keeps its usual
  compact look, but is now tappable — a tap opens a modal with:
  - the **next 24 hours strip** (temperature and rain chance, hour by
    hour, starting now rather than at midnight);
  - the **7-day forecast** (icon, min/max, rain chance);
  - today's **UV index**, with its qualitative band (Low to Extreme,
    per WHO guidelines);
  - current **wind gusts**;
  - **sunrise and sunset** time.

  Each section degrades gracefully if a piece of data is missing
  (relevant for the "Custom" source).
- **New: "rain in ~X min" line** on the compact tile, shown
  automatically — and only — when rain is detected within the coming
  hour (via Open-Meteo's `minutely_15` data). Echoed as a banner in the
  detailed view. Stays invisible the rest of the time, as requested.

## 1.16.0

- **Qualité de l'air : réglages pollens indépendants par affichage.**
  Deux réglages distincts remplacent l'ancien réglage unique
  « Afficher les niveaux de pollens » : « Afficher le pollen dominant »
  (mode compact) et « Afficher le détail des pollens » (mode détaillé),
  chacun activable/désactivable indépendamment de l'autre.
  **⚠️ Si vous aviez désactivé les pollens** sur cette tuile, vérifiez
  vos réglages après mise à jour : votre choix s'applique désormais au
  mode compact uniquement (par défaut, le mode détaillé reste activé).

---

- **Air Quality: independent pollen settings per display.** Two
  separate settings replace the former single "Show pollen levels"
  setting: "Show dominant pollen" (compact display) and "Show pollen
  breakdown" (detailed display), each toggleable independently from the
  other.
  **⚠️ If you had turned pollen off** on this tile, check your settings
  after updating: your choice now only applies to the compact display
  (the detailed display defaults to staying on).

## 1.15.1

- **Correctif (réel, cette fois) : section « Nouveautés » en 404 sur
  l'application Windows.** La cause n'était pas un serveur non
  redémarré : `electron-builder.yml` excluait **tous** les fichiers
  `.md` de l'application empaquetée, y compris `CHANGELOG.md` — pourtant
  nécessaire au runtime depuis la v1.14.0 (servi par la route
  `GET /api/changelog`). Le fichier était donc simplement absent de
  l'installation, quel que soit le nombre de réinstallations. `CHANGELOG.md`
  est désormais explicitement réinclus dans l'empaquetage Windows ; les
  autres fichiers `.md` (README, docs) restent exclus comme prévu.
  **Ce correctif prend effet à la prochaine publication Windows**
  (`npm run publish`) — il ne concerne pas le Raspberry Pi, dont le
  système de mise à jour par ZIP a toujours inclus ce fichier.

---

- **Fix (the real one, this time): "What's new" section 404 on the
  Windows app.** The cause wasn't an unrestarted server:
  `electron-builder.yml` excluded **all** `.md` files from the packaged
  application, including `CHANGELOG.md` — which has been needed at
  runtime since v1.14.0 (served by the `GET /api/changelog` route). The
  file was therefore simply absent from the install, no matter how many
  times it was reinstalled. `CHANGELOG.md` is now explicitly re-included
  in the Windows packaging; other `.md` files (README, docs) remain
  excluded as intended. **This fix takes effect on the next Windows
  publish** (`npm run publish`) — it doesn't concern the Raspberry Pi,
  whose ZIP update system has always included this file.

## 1.15.0

- **Avions en vue : trajet au clic.** Toucher un avion ouvre désormais
  une popup indiquant sa ville de départ et d'arrivée, recherchées via
  adsbdb.com — une base communautaire gratuite et sans clé qui associe
  indicatifs de vol et trajets (cette information n'est pas transmise
  par l'ADS-B lui-même, elle vient obligatoirement d'une source tierce
  qui croise l'indicatif avec une base de vols). Ne fonctionne donc que
  pour les vols commerciaux/réguliers dotés d'un indicatif reconnu ;
  l'aviation générale, privée, ou une partie du militaire n'aura pas de
  résultat, et l'affichera clairement plutôt que de rester silencieux.
- **Correctif : diagnostic amélioré pour la section « Nouveautés » de
  l'aide.** Si le journal des versions ne charge pas, le message
  d'erreur inclut désormais le détail (ex. code HTTP) pour un diagnostic
  plus rapide. Note : si l'erreur affiche un code 404, cela signifie
  généralement que le serveur PiBoard doit être redémarré après avoir
  appliqué une mise à jour — les nouvelles routes serveur ne sont prises
  en compte qu'au redémarrage, pas au simple remplacement des fichiers.

---

- **Planes Overhead: route on tap.** Tapping an aircraft now opens a
  popup showing its departure and arrival city, looked up via
  adsbdb.com — a free, keyless community database matching flight
  callsigns to routes (this information isn't transmitted by ADS-B
  itself, it necessarily comes from a third-party source cross-
  referencing the callsign against a flight database). Only works for
  commercial/scheduled flights with a recognized callsign; general
  aviation, private, or some military flights will get no result, shown
  clearly rather than staying silent.
- **Fix: improved diagnostics for the Help "What's new" section.** If
  the changelog fails to load, the error message now includes the
  detail (e.g. HTTP status code) for faster diagnosis. Note: if the
  error shows a 404, it usually means the PiBoard server needs to be
  restarted after applying an update — new server routes only take
  effect on restart, not on simply replacing the files.

## 1.14.4

- **Radar météo : retrait du mode Prévision.** Ce n'était pas un bug de
  la tuile : RainViewer a **définitivement supprimé les images de
  prévision (« nowcast ») de son API gratuite le 1ᵉʳ janvier 2026**, ne
  conservant que les 2 dernières heures observées. Le mode Prévision
  ajouté en v1.14.2/v1.14.3 ne pouvait donc plus jamais fonctionner : le
  bouton restait en permanence désactivé (curseur « interdit », comme
  signalé). Il a été proprement retiré — la tuile revient à un radar
  historique simple, fidèle à ce que l'offre gratuite de RainViewer
  permet réellement aujourd'hui. Une note l'explique désormais dans
  l'aide intégrée.

---

- **Weather Radar: Forecast mode removed.** This wasn't a bug in the
  tile: RainViewer **permanently removed forecast ("nowcast") frames
  from its free API on January 1, 2026**, keeping only the last 2
  observed hours. The Forecast mode added in v1.14.2/v1.14.3 could
  therefore never work anymore: the button stayed permanently disabled
  (a "not-allowed" cursor, as reported). It has been cleanly removed —
  the tile is back to a simple history radar, matching what RainViewer's
  free tier actually offers today. A note now explains this in the
  built-in help.

## 1.14.3

- **Radar météo** : quand aucune image de prévision n'est disponible sur
  l'instant (RainViewer est un service assuré au mieux, sans garantie de
  disponibilité), l'onglet **Prévision** reste désormais visible mais
  grisé avec une info-bulle explicative — au lieu de disparaître
  silencieusement, ce qui pouvait donner l'impression que le réglage
  n'avait aucun effet.
- **Nouveau réglage *Avions en vue* : traînées de vol** (désactivé par
  défaut) — une fine ligne pointillée derrière chaque avion, montrant
  son trajet récent. Se construit progressivement à partir du
  chargement de la tuile ; l'historique d'un avion est oublié dès qu'il
  sort du rayon ou du nombre maximum affiché.
- **Scores sportifs** : pour un match à venir programmé un autre jour
  que le jour même, l'affichage alterne désormais automatiquement entre
  l'heure et la date (format jj/mm) toutes les quelques secondes — plus
  d'ambiguïté sur le jour d'une rencontre à venir. Un match du jour même
  continue d'afficher seulement l'heure.

---

- **Weather Radar**: when no forecast frame is available at the moment
  (RainViewer is a best-effort service, with no availability
  guarantee), the **Forecast** tab now stays visible but greyed out
  with an explanatory tooltip — instead of silently disappearing, which
  could make the setting look like it had no effect.
- **New *Planes Overhead* setting: flight trails** (off by default) — a
  thin dashed line behind each aircraft, showing its recent path.
  Builds up progressively from when the tile loads; an aircraft's
  history is forgotten as soon as it falls outside the radius or the
  displayed maximum.
- **Sports scores**: for an upcoming match scheduled on another day,
  the display now automatically alternates between the time and the
  date (DD/MM format) every few seconds — no more ambiguity about which
  day an upcoming match falls on. A match happening today still shows
  only the time.

## 1.14.2

- **Radar météo : mode Prévision.** Deux onglets apparaissent désormais
  directement sur la tuile dès que l'API fournit des images de
  prévision : **Historique** (les 2 dernières heures observées) ou
  **Prévision** (uniquement les images à court terme, extrapolées sur
  ~30 minutes). Chaque onglet boucle sur ses propres images plutôt que
  de mélanger passé et prévision dans une seule animation.
- **Correctif *Avions en vue*** : la source **adsb.fi** utilisait un
  point d'accès désormais officiellement déprécié qui renvoie un format
  de réponse différent (sans le tableau attendu) — la requête réussissait
  silencieusement, mais aucun avion n'en ressortait jamais. Corrigé en
  passant sur l'équivalent actuel. Assoupli par ailleurs le traitement
  de la latitude/longitude (accepte aussi bien un nombre qu'un texte
  numérique), et un format de réponse inattendu déclenche désormais un
  message d'erreur explicite plutôt qu'un silencieux « 0 avion ».

---

- **Weather Radar: Forecast mode.** Two tabs now appear right on the
  tile whenever the API provides forecast frames: **History** (the last
  2 observed hours) or **Forecast** (only the short-term frames,
  extrapolated up to ~30 minutes). Each tab loops over its own frames
  rather than mixing past and forecast into a single animation.
- **Fix for *Planes Overhead***: the **adsb.fi** source used an endpoint
  that is now officially deprecated and returns a different response
  shape (missing the expected array) — the request silently succeeded,
  but no aircraft ever came out of it. Fixed by switching to the current
  equivalent. Also loosened latitude/longitude parsing (accepts a number
  or a numeric string), and an unexpected response shape now triggers a
  clear error message instead of a silent "0 aircraft".

## 1.14.1

- **Catalogue de widgets sur 3-4 colonnes.** La fenêtre d'ajout de tuile
  s'élargit désormais pour donner une vue d'ensemble sur plusieurs
  colonnes plutôt qu'une liste étroite à faire défiler — le catalogue
  s'est étoffé (plus d'une vingtaine de widgets). Reste responsive :
  redescend naturellement sur un écran plus étroit.
- **Outillage de build Windows : nettoyage automatique avant publication.**
  `npm run publish` et `npm run dist` effacent maintenant entièrement
  `dist/` avant de reconstruire, pour éviter qu'un résidu d'un run
  précédent ne se mélange à un nouveau (cause d'un bug rencontré : deux
  brouillons de release GitHub pour la même version, chacun avec des
  fichiers différents et incomplets). N'affecte que l'outillage de
  build, pas l'application elle-même.

---

- **Widget catalog on 3-4 columns.** The add-tile window now widens to
  give an overview across several columns rather than a narrow
  scrolling list — the catalog has grown past twenty widgets. Stays
  responsive: naturally drops down on a narrower screen.
- **Windows build tooling: automatic cleanup before publishing.**
  `npm run publish` and `npm run dist` now fully wipe `dist/` before
  rebuilding, preventing leftovers from a previous run from mixing into
  a new one (the cause of a bug encountered: two GitHub release drafts
  for the same version, each with different, incomplete files). Only
  affects the build tooling, not the app itself.

## 1.14.0

- **Correctif *Radar météo*** : le bouton pause n'avait aucun effet sur
  un écran tactile — la carte Leaflet interceptait le geste avant qu'un
  `click` ne se déclenche (même cause déjà corrigée sur le widget
  Trafic). Les boutons écoutent désormais `pointerup`, comme Trafic.
- **Radar météo** : vitesse d'animation par défaut ralentie (500 ms →
  900 ms entre les images).
- **Nouveau réglage *Radar météo* : légende des couleurs** (activée par
  défaut, désactivable) — une petite barre de référence du léger (bleu)
  à l'extrême (rose), d'après l'échelle officielle « Universal Blue » de
  RainViewer.
- **Correctif *Avions en vue*** : « Données avions indisponibles »
  s'affichait systématiquement, quelle que soit la source choisie — les
  API adsb.lol et adsb.fi ne renvoient pas les en-têtes nécessaires à un
  appel direct depuis le navigateur. Les requêtes passent désormais par
  le proxy du serveur, comme déjà pour l'Agenda et le flux RSS.
- **Aide** : les widgets *Qualité de l'air*, *Agenda*, *Radar météo* et
  *Avions en vue*, absents jusqu'ici, ont chacun leur fiche complète ;
  les fiches *Horloge*, *Météo* et *Flux RSS* ont été mises à jour pour
  refléter leurs options ajoutées récemment (saint du jour, format de
  date, articles cliquables) ; la liste des remerciements inclut
  désormais RainViewer et adsb.lol/adsb.fi.
- **Nouveau dans l'Aide : section *Nouveautés*** — l'historique complet
  des versions (ce fichier), consultable directement depuis le tableau,
  filtré automatiquement dans la langue de l'interface.

---

- **Fix for *Weather Radar***: the pause button had no effect on a
  touchscreen — the Leaflet map intercepted the gesture before a
  `click` could fire (the same cause already fixed on the Traffic
  widget). The buttons now listen for `pointerup`, like Traffic.
- **Weather Radar**: default animation speed slowed down (500ms →
  900ms between frames).
- **New *Weather Radar* setting: color legend** (on by default,
  toggleable) — a small reference bar from light (blue) to extreme
  (pink), based on RainViewer's official "Universal Blue" scale.
- **Fix for *Planes Overhead***: "Aircraft data unavailable" showed up
  no matter which source was picked — the adsb.lol and adsb.fi APIs
  don't return the headers a direct browser call needs. Requests now go
  through the server's proxy, as the Calendar and RSS tiles already do.
- **Help**: the *Air Quality*, *Calendar*, *Weather Radar* and *Planes
  Overhead* widgets, missing until now, each get a full entry; the
  *Clock*, *Weather* and *RSS feed* entries were updated to reflect
  their recently added options (name day, date format, clickable
  articles); the credits list now includes RainViewer and
  adsb.lol/adsb.fi.
- **New in Help: a *What's new* section** — the full version history
  (this file), readable directly from the board, automatically filtered
  to the interface's language.

## 1.13.0

- **Flux RSS : articles cliquables avec popup de lecture.** Un article
  est désormais cliquable dès que le flux fournit un lien à son sujet
  (détecté automatiquement, RSS comme Atom) ; un tap ouvre une fenêtre
  popup affichant le titre, la source, la date, et le contenu de
  l'article tel que fourni par le flux (`content:encoded` en priorité
  s'il est présent, sinon la description). Les articles sans lien
  restent de simples lignes de texte, non interactives.
  - Le contenu est nettoyé avant affichage (scripts, styles, cadres et
    gestionnaires d'événements embarqués retirés) ;
  - Les liens à l'intérieur du contenu sont neutralisés (texte conservé,
    navigation désactivée) — même logique que l'attribution des tuiles
    cartographiques : éviter le piège d'un onglet ouvert qu'on ne peut
    plus fermer sur un kiosque tactile sans clavier ;
  - Fermeture par le bouton, la touche Échap, ou un clic sur le fond.

---

- **RSS feed: clickable articles with a reading popup.** An article is
  now clickable as soon as the feed provides a link for it (detected
  automatically, RSS as well as Atom); tapping it opens a popup showing
  the title, source, date, and the article's content as provided by the
  feed (`content:encoded` preferred when present, falling back to the
  description). Articles without a link stay plain, non-interactive
  text lines.
  - Content is cleaned up before display (embedded scripts, styles,
    frames and event handlers are stripped);
  - Links inside the content are neutralized (text kept, navigation
    disabled) — same reasoning as the map tiles' attribution: avoiding
    the trap of an unclosable tab on a keyboard-less touch kiosk;
  - Closes via the button, the Escape key, or a backdrop click.

## 1.12.1

- **Correctif : débordement du saint du jour sur les petites tuiles *Horloge*.**
  Sur les tuiles très basses, la 2e ligne du saint du jour pouvait faire
  déborder le contenu de la tuile. La disposition bascule désormais
  automatiquement sur un affichage côte à côte avec la date quand la
  tuile est trop basse pour une 2e ligne, ou quand la disposition
  heure/date est déjà « côte à côte » — le saint du jour ne peut plus
  jamais faire déborder la tuile.
- **Nouveau réglage *Horloge* : disposition du saint du jour**,
  « En dessous de la date » (comportement historique) ou
  « Côte à côte avec la date », au choix.
- **Nouveau réglage *Horloge* : format de la date** — complet (comme
  avant), long (sans le jour de la semaine), moyen (abrégé), ou court
  (numérique JJ/MM/AAAA) — pour libérer de la place sur les petites
  tuiles.
- **Correctif *Météo*** : quand la prévision du lendemain est affichée,
  le saint du jour du lendemain apparaît désormais aussi (si l'option
  est active), sous la colonne « Demain ».

---

- **Fix: name day overflow on small *Clock* tiles.** On very short
  tiles, the name day's 2nd line could overflow the tile's content. The
  layout now automatically falls back to a side-by-side display with
  the date when the tile is too short for a 2nd line, or when the time/
  date arrangement is already "side by side" — the name day can no
  longer overflow the tile.
- **New *Clock* setting: name day arrangement**, "Below the date"
  (historical behavior) or "Side by side with the date", your choice.
- **New *Clock* setting: date format** — full (as before), long (no
  weekday), medium (abbreviated), or short (numeric MM/DD/YYYY) — to
  free up room on small tiles.
- ***Weather* fix**: when tomorrow's forecast is shown, tomorrow's name
  day now also appears (if the setting is on), under the "Tomorrow"
  column.

## 1.12.0

- **Nouveau widget : *Avions en vue*** — avions en vol en temps réel
  autour d'une ville, sur une vraie carte, via un réseau ADS-B
  communautaire gratuit et sans clé — **adsb.lol** ou **adsb.fi**, au
  choix dans les réglages de la tuile (mêmes données, même format,
  utile en cas de trou de couverture sur l'un des deux). Ville, rayon de
  recherche, zoom et fond de carte indépendants — mêmes fonds de carte
  que les tuiles Trafic et Radar météo, pour une identité visuelle
  cohérente entre les tuiles cartographiques.
  - Icônes d'avion orientées selon leur cap réel, avec étiquette
    indicatif + altitude (format aviation : niveau de vol FLxxx au-dessus
    de 10 000 ft, pieds en dessous, « Sol » pour un appareil au sol) ;
  - Les avions en squawk d'urgence (7500/7600/7700) sont mis en évidence
    en rouge ;
  - Nombre d'avions plafonné et trié par proximité (les plus proches
    d'abord), pour rester lisible même en zone à fort trafic ;
  - Réglages : ville, réseau ADS-B, rayon de recherche, zoom initial,
    fond de carte, affichage des étiquettes, nombre max d'avions,
    fréquence de rafraîchissement.

---

- **New widget: *Planes Overhead*** — live aircraft around a city, on a
  real map, via a free, keyless community ADS-B network — **adsb.lol**
  or **adsb.fi**, your choice in the tile's settings (same data, same
  format, handy if one has a coverage gap near you). Independent city,
  search radius, zoom and base map — same base maps as the Traffic and
  Weather Radar tiles, for a consistent visual identity between the map
  tiles.
  - Plane icons oriented by actual heading, with a callsign + altitude
    label (aviation-style: flight level FLxxx above 10,000 ft, feet
    below that, "Ground" for an aircraft on the ground);
  - Aircraft squawking an emergency code (7500/7600/7700) are
    highlighted in red;
  - Aircraft count capped and sorted by proximity (closest first), to
    stay legible even in high-traffic areas;
  - Settings: city, ADS-B network, search radius, initial zoom, base
    map, label visibility, max aircraft shown, refresh interval.

## 1.11.0

- **Nouveau widget : *Radar météo*** — boucle radar de précipitations
  animée (2 dernières heures, plus une courte prévision optionnelle) sur
  une vraie carte, via l'API gratuite et sans clé Weather Maps de
  RainViewer. Ville, zoom et fond de carte indépendants de la tuile
  Météo — mêmes fonds de carte (Voyager/Sombre/Clair/Auto) que la tuile
  Trafic, pour une identité visuelle cohérente entre les tuiles
  cartographiques.
  - Contrôles lecture/pause et image par image directement sur la tuile,
    horodatage de l'image affichée (marquée d'une flèche pour les images
    de prévision) ;
  - Chaque image radar est préchargée et mise en cache pour une
    animation fluide (pas de rechargement à chaque boucle) ;
  - Réglages : ville, zoom initial, fond de carte, opacité du radar,
    inclusion des images de prévision à court terme, lecture automatique,
    délai entre images, fréquence de rafraîchissement (RainViewer publie
    une nouvelle image toutes les ~10 minutes) ;
  - Attribution « Weather data by RainViewer » affichée sur la carte,
    comme l'exigent leurs conditions d'usage gratuites.

---

- **New widget: *Weather Radar*** — animated precipitation radar loop
  (last 2 hours, plus an optional short-term forecast) over a real map,
  via RainViewer's free, keyless Weather Maps API. City, zoom and base
  map independent from the Weather tile — same base maps
  (Voyager/Dark/Light/Auto) as the Traffic tile, for a consistent visual
  identity between the map tiles.
  - Play/pause and step controls right on the tile, with a timestamp for
    the displayed frame (marked with an arrow for forecast frames);
  - Each radar frame is preloaded and cached for a smooth animation (no
    reloading on every loop);
  - Settings: city, initial zoom, base map, radar opacity, whether to
    include short-term forecast frames, autoplay, frame delay, refresh
    interval (RainViewer publishes a new frame roughly every 10 minutes);
  - "Weather data by RainViewer" attribution shown on the map, as
    required by their free terms of use.

## 1.10.0

- **Nouveau widget : *Agenda*** — un ou plusieurs calendriers iCal (.ics)
  fusionnés dans une seule tuile, chacun dans sa propre couleur assignée
  automatiquement. Compatible Google Agenda, iCloud/iPhone (lien
  `webcal://` de partage public, converti automatiquement), Nextcloud,
  Outlook, ou tout autre calendrier exposant un lien ICS public.
  - Deux vues, basculables directement sur la tuile (onglets) : **liste**
    des prochains événements groupés par jour (« Aujourd'hui »,
    « Demain », puis par date), ou **grille semaine** façon calendrier
    mural avec la colonne du jour mise en évidence ;
  - Gère les **événements récurrents** (RRULE : quotidien, hebdomadaire
    avec jours précis, mensuel — y compris « 2e lundi du mois » —, et
    annuel, avec intervalle/nombre d'occurrences/date de fin) ainsi que
    les **occurrences uniques déplacées ou annulées** (RECURRENCE-ID) ;
  - Légende des calendriers affichée en bas de tuile dès que plusieurs
    calendriers sont configurés ;
  - Réglages : liste des calendriers (un lien par ligne, avec libellé
    optionnel), vue par défaut, fenêtre de la vue liste (jours à venir),
    affichage des événements toute la journée, premier jour de la
    semaine, fréquence de rafraîchissement.

  Parseur ICS et moteur de récurrence écrits en JavaScript pur (aucune
  dépendance externe), passant par le proxy générique déjà utilisé par
  la tuile RSS pour éviter tout problème de CORS.

---

- **New widget: *Calendar*** — one or several iCal (.ics) calendars
  merged into a single tile, each automatically assigned its own color.
  Works with Google Calendar, iCloud/iPhone (public share `webcal://`
  link, converted automatically), Nextcloud, Outlook, or any other
  calendar exposing a public ICS link.
  - Two views, switchable right on the tile (tabs): an **upcoming list**
    grouped by day ("Today", "Tomorrow", then by date), or a **week
    grid** in a wall-calendar style with today's column highlighted;
  - Handles **recurring events** (RRULE: daily, weekly with specific
    days, monthly — including "2nd Monday of the month" — and yearly,
    with interval/occurrence count/end date) as well as **single moved
    or cancelled occurrences** (RECURRENCE-ID);
  - A calendar legend is shown at the bottom of the tile once more than
    one calendar is configured;
  - Settings: calendar list (one link per line, with an optional label),
    default view, the list view's window (days ahead), whether to show
    all-day events, first day of the week, refresh interval.

  ICS parser and recurrence engine written in plain JavaScript (no
  external dependency), going through the generic proxy already used by
  the RSS tile to avoid any CORS issue.

## 1.9.0

- **Nouveau widget : *Qualité de l'air*** — indice de qualité de l'air
  européen (EAQI) et niveaux de pollens (bouleau, graminées, ambroisie,
  aulne, armoise, olivier), via l'API gratuite et sans clé d'Open-Meteo,
  basée sur les prévisions CAMS Europe. Deux affichages au choix :
  - **Compact** : un badge coloré avec l'indice global, le polluant
    dominant (celui qui tire l'indice vers le haut) et, si activé, le
    pollen dominant actuellement en saison ;
  - **Détaillé** : le même badge, plus le détail chiffré de chaque
    polluant (PM2.5, PM10, NO₂, O₃, SO₂) et de chaque pollen en saison,
    sous forme de puces colorées.

  Les pollens ne sont disponibles que pour l'Europe et seulement pour les
  espèces actuellement en saison — l'échelle de niveau (nul/faible/
  modéré/élevé) est volontairement simplifiée pour un coup d'œil rapide,
  pas un usage médical. Réutilise le même géocodage gratuit que la tuile
  météo. Attribution CAMS/Open-Meteo affichée sur la tuile, comme requis
  par leurs conditions d'usage.

---

- **New widget: *Air Quality*** — European Air Quality Index (EAQI) and
  pollen levels (birch, grass, ragweed, alder, mugwort, olive), via
  Open-Meteo's free, keyless API, based on the CAMS Europe forecast. Two
  display modes:
  - **Compact**: a colored badge with the overall index, the dominant
    pollutant (the one driving the index up), and, if enabled, the
    dominant pollen currently in season;
  - **Detailed**: the same badge, plus the numeric breakdown of every
    pollutant (PM2.5, PM10, NO₂, O₃, SO₂) and every in-season pollen, as
    colored chips.

  Pollen data is only available for Europe and only for species
  currently in season — the level scale (none/low/moderate/high) is
  deliberately simplified for a quick glance, not medical use. Reuses the
  same free geocoding as the weather tile. CAMS/Open-Meteo attribution is
  shown on the tile, as required by their terms of use.

## 1.8.0

- **Nouveau : « Saint du jour » dans les tuiles *Horloge* et *Météo***. Un
  réglage optionnel (désactivé par défaut) ajoute la fête du jour
  traditionnelle française — par exemple « Sainte Christine » — à côté de
  la date. Dans la tuile *Horloge*, elle apparaît sous la date lorsque
  celle-ci est affichée (sauf en disposition « côte à côte », déjà tendue
  sur une seule ligne). Dans la tuile *Météo*, elle apparaît sous la
  fourchette de température, y compris en mode photo de fond.

  Le calendrier (366 entrées, un prénom par jour) est une nouvelle
  ressource statique (`public/data/saints-fr.json`), chargée une seule
  fois et partagée entre les deux tuiles pour éviter une double requête.
  Cette fête est une tradition propre à la France : le réglage n'a d'effet
  que lorsque la langue de l'interface est le français, quel que soit son
  état pour l'anglais.

---

- **New: "Name day" in the *Clock* and *Weather* tiles**. An optional
  setting (off by default) adds the traditional French "fête du jour" —
  e.g. "Sainte Christine" — next to the date. In the *Clock* tile, it
  appears below the date when the date is shown (except in the "side by
  side" layout, already tight on one line). In the *Weather* tile, it
  appears below the temperature range, including in photo-background
  mode.

  The calendar (366 entries, one name per day) is a new static resource
  (`public/data/saints-fr.json`), fetched once and shared between both
  tiles to avoid a duplicate request. This nameday tradition is specific
  to France: the setting only has an effect when the interface language
  is French, regardless of its state for English.

## 1.7.5

- **Nouvelle section d'aide « Application de bureau Windows »**,
  accessible depuis le menu général du tableau de bord (bouton Aide de
  la barre d'outils). Elle documente le menu masqué de l'application
  Windows — révélé par un simple appui sur la touche `Alt`, sans aucune
  indication visuelle de son existence — ainsi que ses fonctions
  (recharger, plein écran, zoom, outils de développement, rechercher une
  mise à jour, quitter), le fonctionnement des mises à jour automatiques,
  et l'emplacement des données (`%APPDATA%\PiBoard`). Cette section
  n'apparaît que dans le sommaire ; son contenu précise lui-même qu'elle
  ne concerne que l'installation Windows, pas le Raspberry Pi.

  Reprend, condensé pour un public utilisateur (sans les étapes de
  build/publication réservées au mainteneur), le contenu déjà présent
  dans `docs/WINDOWS.md`.

---

- **New "Windows desktop app" help section**, accessible from the
  dashboard's general menu (the toolbar's Help button). It documents the
  Windows application's hidden menu — revealed by simply pressing the
  `Alt` key, with no visual hint of its existence — along with its
  functions (reload, full screen, zoom, developer tools, check for
  updates, quit), how automatic updates work, and where data is stored
  (`%APPDATA%\PiBoard`). This section only appears in the table of
  contents; its content itself notes that it only concerns the Windows
  install, not the Raspberry Pi.

  Reuses, condensed for an end-user audience (without the
  build/publish steps reserved for the maintainer), the content already
  present in `docs/WINDOWS.md`.

## 1.7.4

- **Correctif : le guide « France (~400 chaînes) » n'affichait toujours
  que les chaînes TNT** — la route qui alimente la nouvelle fonction
  « Parcourir les chaînes disponibles » (voir ci-dessous) renvoyait
  toujours la même liste statique d'une trentaine de chaînes TNT, quelle
  que soit la source réellement configurée. Sélectionner le guide
  « France » chargeait bien la grille complète côté serveur, mais rien
  ne permettait de découvrir ni d'ajouter les ~370 chaînes
  supplémentaires à la liste de la tuile.

- **Nouveau : bouton « Parcourir les chaînes disponibles »** dans les
  réglages du widget *Programme TV*, sous le champ « Chaînes ». Il liste
  les chaînes réellement présentes dans la source actuellement
  sélectionnée (source, guide xmltvfr.fr ou URL — y compris les
  changements pas encore enregistrés), et un clic sur une chaîne l'ajoute
  à la liste de la tuile. Les chaînes déjà présentes sont signalées et
  non cliquables.

---

- **Fix: the "France (~400 channels)" guide still only showed DTT
  channels** — the route powering the new "Browse available channels"
  feature (see below) always returned the same static list of about
  thirty DTT channels, whatever source was actually configured.
  Selecting the "France" guide did load the full grid on the server
  side, but nothing let the user discover or add the ~370 extra
  channels to the tile's list.

- **New: "Browse available channels" button** in the *TV guide*
  widget's settings, below the "Channels" field. It lists the channels
  actually present in the currently selected source (source, xmltvfr.fr
  guide, or URL — including unsaved changes), and clicking a channel adds
  it to the tile's list. Channels already present are flagged and not
  clickable.

## 1.7.3

- **Correctif : « Programme indisponible » avec le guide xmltvfr.fr
  400 chaînes** — erreur `Entity expansion limit exceeded: 1002 > 1000`.
  En cause : la protection anti-DoS par défaut de la bibliothèque de
  parsing XML plafonne à 1000 le nombre total de substitutions
  d'entités (`&amp;`, `&#233;`...) dans tout le document — un guide
  volumineux (400 chaînes, plusieurs jours) en contient largement
  davantage rien que via les caractères accentués du français dans les
  titres et synopsis. Le seuil, pensé pour un document XML générique,
  était bien trop bas pour un XMLTV de cette taille.

  La protection n'est pas désactivée mais recalibrée : les réglages qui
  gardent une vraie valeur défensive contre une charge malveillante
  (nombre et imbrication d'entités personnalisées, qu'un XMLTV légitime
  ne déclare jamais) restent stricts ; ceux qui plafonnaient à tort le
  volume de texte ordinaire sont élevés à des valeurs larges mais
  toujours finies.

---

- **Fix: "Program unavailable" with the xmltvfr.fr 400-channel guide**
  — `Entity expansion limit exceeded: 1002 > 1000` error. Cause: the XML
  parsing library's default anti-DoS protection caps the total number of
  entity substitutions (`&amp;`, `&#233;`...) across the whole document
  at 1000 — a large guide (400 channels, several days) legitimately
  contains far more than that from French accented characters alone in
  titles and synopses. The threshold, sized for a generic XML document,
  was far too low for an XMLTV file of that size.

  The protection isn't disabled but recalibrated: the settings that keep
  genuine defensive value against a malicious payload (custom entity
  count and nesting, which a legitimate XMLTV never declares) stay
  strict; the ones that were wrongly capping ordinary text volume are
  raised to large but still finite values.

## 1.7.2

- **Les fenêtres de réglages s'affichent désormais en plusieurs colonnes
  par défaut, y compris hors mode tactile** — la répartition automatique
  sur 2 ou 3 colonnes (déjà en place pour raccourcir le défilement des
  fenêtres à nombreuses sections) était jusqu'ici réservée au mode
  tactile. Elle est désormais active par défaut pour tout le monde,
  souris comme doigt.

  Un nouveau réglage **« Fenêtres de réglages en plusieurs colonnes »**
  (Réglages généraux → activé par défaut) permet de revenir à une seule
  colonne si préféré. Il est indépendant du mode tactile : on peut
  garder les colonnes sans les cibles agrandies, ou l'inverse.

  Côté CSS, les règles structurelles de la mise en colonnes (largeur du
  modal selon le nombre de colonnes, grille des sections, bornage des
  champs) ont été détachées de `body.touch`, qui ne conditionne plus que
  le confort tactile proprement dit (cibles agrandies, espacement) —
  sans changement de comportement en mode tactile.

---

- **Settings windows now display in multiple columns by default, even
  outside touch mode** — the automatic 2- or 3-column layout (already in
  place to shorten scrolling on windows with many sections) used to be
  reserved for touch mode. It is now on by default for everyone, mouse
  or finger alike.

  A new **"Multi-column settings windows"** setting (General settings →
  on by default) allows reverting to a single column if preferred. It is
  independent from touch mode: columns can be kept without enlarged
  targets, or the other way around.

  On the CSS side, the structural rules for column layout (modal width
  by column count, the section grid, field width bounding) were detached
  from `body.touch`, which now only gates actual touch comfort (enlarged
  targets, spacing) — with no behaviour change in touch mode itself.

## 1.7.1

- **Correctif : programmes de 2e partie de soirée affichés à tort dans
  « Ce soir »** — le widget *Programme TV* pouvait retenir un programme
  démarrant vers 22h dans l'onglet 1re partie de soirée s'il était plus
  long que la vraie émission de 21h. En cause : la tolérance après
  l'heure cible était fixée à 90 min (soit 22h30 pour une cible à 21h),
  assez large pour laisser un programme de 2e partie entrer dans la
  comparaison « le plus long l'emporte » et la gagner.

  Deux nouveaux réglages plafonnent désormais la fenêtre de démarrage
  acceptée par des heures absolues plutôt qu'une tolérance relative :
  **« 1re partie : début au plus tard accepté »** (21h30 par défaut)
  exclut tout programme démarrant après cette heure, quelle que soit sa
  durée — c'est ce qui corrige le bug. **« 1re partie : début au plus
  tôt accepté »** (20h00 par défaut) reste volontairement permissif
  pour ne pas casser la détection des chaînes qui démarrent leur
  programme principal en avance (TMC, généralement dès 20h20-20h30),
  gérée depuis une version précédente — resserrer cette borne (par
  exemple à 20h45) est possible mais exclurait alors ce type de chaîne.

  Le seuil de durée minimale de la 1re partie passe de 45 à 30 minutes
  par défaut : la fenêtre plafonnée filtre désormais la 2e partie de
  soirée indépendamment de la durée, un seuil plus bas suffit donc à
  écarter les intercalaires courts sans risque de reprendre un
  programme de 2e partie.

---

- **Fix: second-part-evening programs wrongly shown in "Tonight"** —
  the *TV guide* widget could pick a program starting around 10pm in the
  prime-time tab if it happened to run longer than the real 9pm show. The
  cause: the after-target tolerance was fixed at 90 min (i.e. 10:30pm for
  a 9pm target), wide enough to let a second-part-evening program enter
  the "longest wins" comparison and win it.

  Two new settings now cap the accepted start window using absolute
  times rather than a relative tolerance: **"Prime time: latest accepted
  start"** (9:30pm by default) excludes any program starting after that
  time, whatever its length — this is what fixes the bug. **"Prime time:
  earliest accepted start"** (8:00pm by default) stays deliberately
  permissive so it doesn't break detection of channels that start their
  main show early (TMC, typically from 8:20-8:30pm), handled since an
  earlier version — tightening this bound (e.g. to 8:45pm) is possible
  but would then exclude that kind of channel.

  Prime time's minimum-duration threshold drops from 45 to 30 minutes by
  default: the capped window now filters out second-part-evening
  programs independently of duration, so a lower threshold is enough to
  discard short interstitials without risking picking up a second-part
  program.

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
