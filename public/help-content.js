/* ============================================================
   PiBoard - help-content.js
   Contenu bilingue (FR/EN) de l'aide du tableau de bord.
   Chargé avant app.js (voir index.html), qui se charge du rendu
   (voir openHelp()/showHelpSection() dans app.js).

   Bilingual (FR/EN) content for the dashboard help. Loaded before
   app.js (see index.html), which handles the rendering (see
   openHelp()/showHelpSection() in app.js).

   Structure d'une section / section structure:
     { id, group, title: {fr,en}, sub: {fr,en}?, html: {fr,en} }
   group vaut "presentation", "drawer", "tiles" ou "credits".
   group is one of "presentation", "drawer", "tiles" or "credits".
   ============================================================ */
(function () {
  "use strict";

  window.PIBOARD_HELP = [

    /* ================= PRESENTATION ================= */
    {
      id: "intro",
      group: "presentation",
      title: { fr: "Présentation", en: "Overview" },
      sub: {
        fr: "Le principe du tableau de bord, des tuiles et de ses différentes zones.",
        en: "The dashboard's principle, tiles, and its different areas."
      },
      html: {
        fr: `
          <h4>Objectif</h4>
          <p>PiBoard est un tableau de bord d'affichage permanent : un écran (typiquement une tablette ou un écran tactile fixé au mur) qui montre en continu les informations utiles à un coup d'œil — heure, météo, trafic, agenda, actualités, photos de famille, etc. — sans qu'il soit nécessaire de le manipuler la plupart du temps. Il est pensé pour tourner en kiosque (plein écran, sans barre de navigateur), tout en restant entièrement configurable directement depuis l'écran, tactile ou non.</p>

          <h4>Le principe des tuiles</h4>
          <p>Chaque information affichée est une <b>tuile</b> : un rectangle indépendant qui héberge un widget (horloge, météo, trafic, flux RSS…). Les tuiles se déplacent et se redimensionnent librement sur une grille invisible, un peu comme des fenêtres sur un bureau. Pour ajouter une tuile, ouvrez la barre d'outils du bas et touchez le bouton « + » : un catalogue de widgets s'ouvre, ce qui en ajoute une nouvelle configurable de suite.</p>
          <p>Pour réorganiser le tableau, activez le <b>mode édition</b> (bouton en forme de cadenas dans la barre d'outils) : les tuiles peuvent alors être glissées pour changer de position, et leurs bords tirés pour changer de taille. Toujours en mode édition, un appui sur une tuile ouvre directement ses réglages — pas besoin de viser la petite icône d'engrenage. En dehors du mode édition, deux icônes discrètes apparaissent au survol ou au tap sur chaque tuile : l'engrenage (réglages de la tuile) et la croix (la retirer du tableau).</p>

          <h4>La section Apparence, commune à toutes les tuiles</h4>
          <p>En plus de ses réglages propres, chaque tuile a une section <b>Apparence</b> tout en bas de sa fenêtre de configuration, toujours composée des mêmes options :</p>
          <div class="help-opt"><span class="help-opt-name">Afficher le titre</span><span class="help-opt-desc">Montre ou masque le bandeau de titre en haut de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Titre personnalisé</span><span class="help-opt-desc">Remplace le nom par défaut du widget par le texte de votre choix (ex. « Trafic » plutôt que « Carte de trafic »).</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille du texte</span><span class="help-opt-desc">De 50 % à 200 %, sur la plupart des widgets (absent pour la tuile Trafic, dont le zoom casserait la carte). Utile pour agrandir la lisibilité d'une tuile agrandie, ou au contraire faire tenir plus de contenu en réduisant. La tuile Citation gère sa propre échelle un peu différemment — voir sa fiche dédiée plus bas.</span></div>
          <div class="help-opt"><span class="help-opt-name">Couleur personnalisée</span><span class="help-opt-desc">Remplace la couleur de fond par défaut du thème (jour/nuit) par une couleur fixe, propre à cette tuile.</span></div>

          <h4>Taille des tuiles</h4>
          <p>Chaque widget définit une taille minimale et maximale cohérente avec ce qu'il affiche : par exemple, la carte de trafic ne peut pas descendre en dessous d'une certaine taille, car ses boutons (rafraîchissement, zoom) finiraient par se chevaucher. À l'inverse, le diaporama ou le classement sportif acceptent d'être agrandis largement, utile si vous augmentez la taille du texte dans les réglages d'apparence d'une tuile. Si une tuile déjà en place devient trop petite après une mise à jour de ses contraintes, PiBoard la rétablit automatiquement à sa taille minimale au chargement suivant.</p>

          <h4>Les différentes zones du tableau de bord</h4>
          <ul>
            <li><b>Le tableau principal</b> — la grille visible en permanence, celle que l'on voit à l'écran au quotidien.</li>
            <li><b>Le tiroir latéral de tuiles</b> — un panneau escamotable, ouvert via la languette sur le bord gauche de l'écran. Il permet de préparer ou ranger des tuiles supplémentaires sans encombrer le tableau principal (par exemple des tuiles utilisées occasionnellement). Une tuile ajoutée pendant que ce tiroir est ouvert y est placée directement ; sinon, elle rejoint le tableau principal.</li>
            <li><b>Le tiroir de configuration du bas</b> — la barre d'outils escamotable en bas de l'écran (languette centrale), qui donne accès à l'ajout de tuiles, au mode édition, aux réglages généraux, à cette aide, et au redémarrage de l'affichage. Voir la section « Barre d'outils & réglages » du sommaire pour le détail de chaque bouton et réglage.</li>
          </ul>`,
        en: `
          <h4>Goal</h4>
          <p>PiBoard is an always-on display dashboard: a screen (typically a tablet or a wall-mounted touchscreen) that continuously shows useful information at a glance — time, weather, traffic, agenda, news, family photos, and so on — without needing to be touched most of the time. It's designed to run as a kiosk (full screen, no browser chrome), while staying fully configurable directly from the screen, touch or not.</p>

          <h4>The tile principle</h4>
          <p>Each piece of information shown is a <b>tile</b>: an independent rectangle hosting a widget (clock, weather, traffic, RSS feed…). Tiles move and resize freely on an invisible grid, a bit like windows on a desktop. To add a tile, open the bottom toolbar and tap the "+" button: a widget catalog opens, which adds a new one ready to configure right away.</p>
          <p>To rearrange the board, turn on <b>edit mode</b> (the lock-shaped button in the toolbar): tiles can then be dragged to change position, and their edges pulled to resize them. Still in edit mode, tapping a tile opens its settings directly — no need to aim for the small gear icon. Outside edit mode, two discreet icons appear on hover or tap on each tile: the gear (tile settings) and the cross (remove it from the board).</p>

          <h4>The Appearance section, shared by every tile</h4>
          <p>On top of its own settings, every tile has an <b>Appearance</b> section at the very bottom of its config window, always made up of the same options:</p>
          <div class="help-opt"><span class="help-opt-name">Show title</span><span class="help-opt-desc">Shows or hides the title bar at the top of the tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom title</span><span class="help-opt-desc">Replaces the widget's default name with text of your choice (e.g. "Traffic" instead of "Traffic map").</span></div>
          <div class="help-opt"><span class="help-opt-name">Text size</span><span class="help-opt-desc">50% to 200%, on most widgets (absent on the Traffic tile, whose map zoom it would break). Useful to boost readability on an enlarged tile, or conversely to fit more content in by shrinking it. The Quote tile handles its own scale slightly differently — see its dedicated entry further below.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom color</span><span class="help-opt-desc">Replaces the theme's default background color (day/night) with a fixed color for this tile only.</span></div>

          <h4>Tile size</h4>
          <p>Each widget defines a minimum and maximum size consistent with what it displays: for instance, the traffic map can't go below a certain size, since its buttons (refresh, zoom) would end up overlapping. Conversely, the slideshow or the league standings accept being enlarged a lot, useful if you increase the text size in a tile's appearance settings. If a tile already placed becomes too small after its constraints are updated, PiBoard automatically restores it to its minimum size on the next load.</p>

          <h4>The dashboard's different areas</h4>
          <ul>
            <li><b>The main board</b> — the grid always visible, the one you see on screen day to day.</li>
            <li><b>The side tile drawer</b> — a collapsible panel, opened via the pull tab on the screen's left edge. It lets you prepare or store extra tiles without cluttering the main board (for instance tiles used occasionally). A tile added while this drawer is open is placed there directly; otherwise, it joins the main board.</li>
            <li><b>The bottom config drawer</b> — the collapsible toolbar at the bottom of the screen (center pull tab), giving access to adding tiles, edit mode, general settings, this help, and restarting the display. See the "Toolbar & Settings" section of the table of contents for details on every button and setting.</li>
          </ul>`
      }
    },

    /* ================= TIROIR DE CONFIGURATION / DRAWER ================= */
    {
      id: "drawer",
      group: "drawer",
      title: { fr: "Barre d'outils & réglages", en: "Toolbar & settings" },
      sub: {
        fr: "Le tiroir escamotable du bas et ses réglages généraux.",
        en: "The bottom pull-out drawer and its general settings."
      },
      html: {
        fr: `
          <h4>La barre d'outils</h4>
          <p>Elle est masquée par défaut pour ne pas encombrer l'affichage. Touchez la petite languette centrée en bas de l'écran pour la faire apparaître ; elle se referme automatiquement après 20 secondes d'inactivité (sauf en mode édition, où elle reste ouverte). Sept boutons :</p>
          <div class="help-opt"><span class="help-opt-name">+ Ajouter une tuile</span><span class="help-opt-desc">Ouvre le catalogue des widgets disponibles. Touchez-en un pour l'ajouter au tableau (ou au tiroir latéral de tuiles, s'il est ouvert à ce moment-là) ; ses réglages s'ouvrent aussitôt pour le configurer.</span></div>
          <div class="help-opt"><span class="help-opt-name">Mode édition (cadenas)</span><span class="help-opt-desc">Active le déplacement et le redimensionnement des tuiles. En mode édition, un simple appui sur une tuile ouvre directement ses réglages. Repassez par ce bouton pour verrouiller à nouveau le tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Réglages (engrenage)</span><span class="help-opt-desc">Ouvre la fenêtre des réglages généraux du tableau de bord — détaillée ci-dessous.</span></div>
          <div class="help-opt"><span class="help-opt-name">Aide (?)</span><span class="help-opt-desc">La fenêtre que vous consultez actuellement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lancer le cadre photo</span><span class="help-opt-desc">Active immédiatement l'écran de veille en mode diaporama, quels que soient les plages horaires programmées ou même si l'économiseur d'écran automatique est désactivé dans les réglages — un geste explicite, indépendant du calendrier. Reprend les mêmes photos que celles configurées dans la section « Écran de veille » des réglages généraux. Un tap, un clic, ou n'importe quelle touche referme le cadre photo et revient au tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quitter le tableau de bord</span><span class="help-opt-desc">Ouvre un petit menu à deux choix. <b>Réinitialiser le tableau de bord</b> : recharge PiBoard de zéro dans le navigateur (sans toucher à Chromium) — pratique en cas de blocage visuel ou après une mise à jour du serveur. <b>Revenir au bureau</b> : ferme Chromium et révèle le bureau de Raspberry Pi OS en dessous, sans relancer le tableau de bord — pratique pour une tâche ponctuelle sur l'écran tactile sans clavier ni SSH (redémarrez le Pi, ou rouvrez Chromium vous-même, pour retrouver le tableau ensuite). Depuis un autre navigateur (consultation à distance), les deux options se contentent de fermer l'onglet.</span></div>
          <div class="help-opt"><span class="help-opt-name">Replier la barre</span><span class="help-opt-desc">Referme immédiatement la barre d'outils.</span></div>

          <h4>Fenêtre des réglages généraux</h4>
          <p><u>Section Général</u></p>
          <div class="help-opt"><span class="help-opt-name">Langue</span><span class="help-opt-desc">Français ou anglais. S'applique à toute l'interface, y compris le clavier virtuel (AZERTY en français, QWERTY en anglais) et cette aide.</span></div>
          <div class="help-opt"><span class="help-opt-name">Thème</span><span class="help-opt-desc">Automatique (jour/nuit selon le lever et coucher du soleil réels de votre ville), forcé sur Nuit, ou forcé sur Jour.</span></div>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Utilisée uniquement pour calculer les horaires de lever/coucher du soleil du thème automatique. Tapez un nom de ville et choisissez une suggestion dans la liste pour la valider.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lignes de la grille</span><span class="help-opt-desc">Le nombre de lignes logiques que compte la grille en hauteur. Plus ce nombre est élevé, plus chaque tuile peut être finement redimensionnée verticalement — mais des tuiles très fines deviennent plus difficiles à cibler au doigt sur un écran tactile.</span></div>
          <p><u>Section Couleurs</u></p>
          <div class="help-opt"><span class="help-opt-name">Fond / Tuiles, Nuit / Jour</span><span class="help-opt-desc">Personnalisez la couleur de fond du tableau et celle des tuiles, séparément pour chacun des deux thèmes. Un bouton permet de revenir aux couleurs par défaut.</span></div>
          <p><u>Section Écran tactile</u></p>
          <div class="help-opt"><span class="help-opt-name">Clavier virtuel</span><span class="help-opt-desc">Affiche un clavier à l'écran dès qu'un champ de texte est touché — utile sans clavier physique. Suit la langue choisie ci-dessus (AZERTY en français, QWERTY en anglais). S'applique partout où du texte peut être saisi, y compris dans le bloc-notes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Mode tactile</span><span class="help-opt-desc">Agrandit l'ensemble des cibles interactives pour les doigts : boutons de la barre d'outils, languettes des tiroirs, icônes des tuiles, poignées de redimensionnement, champs et cases à cocher des fenêtres de réglages. Ces fenêtres de réglages se réorganisent aussi automatiquement sur plusieurs colonnes quand le contenu le permet, pour limiter le défilement.</span></div>

          <p><u>Section Économiseur d'écran</u></p>
          <p>Jusqu'à 5 plages horaires, chacune avec une heure de début, une heure de fin, et un mode : <b>Noir</b> (l'écran devient entièrement noir) ou <b>Diaporama</b> (l'écran se transforme en cadre photo dynamique, avec sa propre source de photos indépendante de toute tuile Diaporama éventuellement présente sur le tableau). Une plage peut traverser minuit (par exemple 22:00 → 06:00 pour la nuit). Un clic, un tap tactile, ou n'importe quelle touche réveille l'écran instantanément ; une fois réveillée manuellement, la même plage ne se rouvre pas toute seule — il faut attendre la suivante (le lendemain, pour une plage quotidienne).</p>
          <p>Volontairement, ceci n'éteint <b>jamais</b> physiquement l'écran : c'est un calque logiciel plein écran, qui économise déjà de l'énergie (le tableau cesse d'être activement rendu et rafraîchi pendant ce temps) sans le risque qu'un écran réellement éteint ne se rallume pas correctement — un problème documenté et encore non résolu sur certains systèmes Linux avec le compositeur graphique utilisé par les kiosques PiBoard.</p>
          <div class="help-opt"><span class="help-opt-name">Source des photos (diaporama)</span><span class="help-opt-desc">Téléversement dédié à la veille (géré directement dans cette fenêtre), dossier local, partage WebDAV, ou liste d'URLs — mêmes options que le widget Diaporama.</span></div>
          <div class="help-opt"><span class="help-opt-name">Changer toutes les</span><span class="help-opt-desc">Intervalle en secondes entre deux photos, pour les plages en mode Diaporama.</span></div>`,
        en: `
          <h4>The toolbar</h4>
          <p>It's hidden by default so it doesn't clutter the display. Tap the small tab centered at the bottom of the screen to reveal it; it closes automatically after 20 seconds of inactivity (except in edit mode, where it stays open). Seven buttons:</p>
          <div class="help-opt"><span class="help-opt-name">+ Add a tile</span><span class="help-opt-desc">Opens the catalog of available widgets. Tap one to add it to the board (or to the side tile drawer, if it's open at that moment); its settings open right away to configure it.</span></div>
          <div class="help-opt"><span class="help-opt-name">Edit mode (lock)</span><span class="help-opt-desc">Enables dragging and resizing tiles. In edit mode, simply tapping a tile opens its settings directly. Press this button again to lock the board back.</span></div>
          <div class="help-opt"><span class="help-opt-name">Settings (gear)</span><span class="help-opt-desc">Opens the dashboard's general settings window — detailed below.</span></div>
          <div class="help-opt"><span class="help-opt-name">Help (?)</span><span class="help-opt-desc">The window you're currently reading.</span></div>
          <div class="help-opt"><span class="help-opt-name">Start photo frame</span><span class="help-opt-desc">Immediately turns on the screen saver in slideshow mode, regardless of the programmed time slots or even if the automatic screen saver is disabled in settings — an explicit gesture, independent from the schedule. Reuses the same photos configured in the "Screen saver" section of the general settings. A tap, a click, or any key closes the photo frame and returns to the board.</span></div>
          <div class="help-opt"><span class="help-opt-name">Exit dashboard</span><span class="help-opt-desc">Opens a small two-choice menu. <b>Reset the dashboard</b>: reloads PiBoard from scratch in the browser (without touching Chromium) — handy after a visual glitch or once a server-side update has been applied. <b>Return to the desktop</b>: closes Chromium and reveals the Raspberry Pi OS desktop underneath, without relaunching the dashboard — handy for a one-off task on the touchscreen without a keyboard or SSH (restart the Pi, or reopen Chromium yourself, to get the dashboard back afterward). From another browser (remote viewing), both options simply close the tab.</span></div>
          <div class="help-opt"><span class="help-opt-name">Collapse the bar</span><span class="help-opt-desc">Immediately closes the toolbar.</span></div>

          <h4>General settings window</h4>
          <p><u>General section</u></p>
          <div class="help-opt"><span class="help-opt-name">Language</span><span class="help-opt-desc">French or English. Applies to the whole interface, including the on-screen keyboard (AZERTY in French, QWERTY in English) and this help.</span></div>
          <div class="help-opt"><span class="help-opt-name">Theme</span><span class="help-opt-desc">Auto (day/night based on your city's actual sunrise and sunset), forced to Night, or forced to Day.</span></div>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Only used to compute sunrise/sunset times for the auto theme. Type a city name and pick a suggestion from the list to validate it.</span></div>
          <div class="help-opt"><span class="help-opt-name">Grid rows</span><span class="help-opt-desc">The number of logical rows the grid has in height. The higher this number, the more finely each tile can be resized vertically — but very thin tiles become harder to target with a finger on a touchscreen.</span></div>
          <p><u>Colors section</u></p>
          <div class="help-opt"><span class="help-opt-name">Background / Tiles, Night / Day</span><span class="help-opt-desc">Customize the board's background color and the tiles' color, separately for each of the two themes. A button lets you go back to the default colors.</span></div>
          <p><u>Touchscreen section</u></p>
          <div class="help-opt"><span class="help-opt-name">On-screen keyboard</span><span class="help-opt-desc">Shows a keyboard on screen as soon as a text field is touched — useful without a physical keyboard. Follows the language chosen above (AZERTY in French, QWERTY in English). Applies everywhere text can be typed, including the notes widget.</span></div>
          <div class="help-opt"><span class="help-opt-name">Touch mode</span><span class="help-opt-desc">Enlarges every interactive target for fingers: toolbar buttons, drawer pull tabs, tile icons, resize handles, and the fields and checkboxes in settings windows. Those settings windows also automatically reorganize into several columns when content allows it, to limit scrolling.</span></div>

          <p><u>Screen saver section</u></p>
          <p>Up to 5 time slots, each with a start time, an end time, and a mode: <b>Black</b> (the screen turns fully black) or <b>Slideshow</b> (the screen becomes a dynamic photo frame, with its own photo source independent from any Slideshow tile that might exist on the board). A slot can cross midnight (e.g. 22:00 → 06:00 for the night). A click, a touch tap, or any key wakes the screen up instantly; once manually woken, the same slot won't reopen on its own — you have to wait for the next one (the next day, for a daily slot).</p>
          <p>By design, this never physically turns the screen off: it's a full-screen software overlay, which already saves energy (the board stops being actively rendered and refreshed while it's shown) without the risk of a truly powered-off screen failing to turn back on — a documented, still-unresolved issue on some Linux systems with the graphics compositor used by PiBoard kiosks.</p>
          <div class="help-opt"><span class="help-opt-name">Photo source (slideshow)</span><span class="help-opt-desc">Upload dedicated to the screensaver (managed directly in this window), local folder, WebDAV share, or a list of URLs — same options as the Slideshow widget.</span></div>
          <div class="help-opt"><span class="help-opt-name">Change every</span><span class="help-opt-desc">Interval in seconds between two photos, for slots in Slideshow mode.</span></div>`
      }
    },

    /* ================= TUILES / TILES ================= */
    {
      id: "clock",
      group: "tiles",
      title: { fr: "Horloge", en: "Clock" },
      sub: {
        fr: "Horloge digitale ou analogique avec la date du jour, et un fond jour/nuit optionnel qui suit le thème solaire du tableau.",
        en: "Digital or analog clock with today's date, and an optional day/night background that follows the board's sun-based theme."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×5</span>
          <h4>Objectif</h4>
          <p>Afficher l'heure et la date de façon lisible de loin, avec deux styles au choix selon vos goûts ou l'ambiance de la pièce.</p>
          <h4>Possibilités</h4>
          <p>En mode digital, l'heure occupe l'espace disponible et se recalcule automatiquement à chaque redimensionnement de la tuile. Sur une tuile large et basse, placez la date à côté de l'heure plutôt qu'en dessous pour mieux exploiter la largeur. Le fond jour/nuit optionnel donne un repère visuel supplémentaire (par exemple un dégradé sombre la nuit), en suivant automatiquement le même thème solaire que le reste du tableau.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Digitale (chiffres) ou analogique (aiguilles).</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les secondes</span><span class="help-opt-desc">Ajoute le décompte des secondes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la date</span><span class="help-opt-desc">Ajoute la date du jour sous ou à côté de l'heure.</span></div>
          <div class="help-opt"><span class="help-opt-name">Disposition heure et date</span><span class="help-opt-desc">Uniquement en mode digital avec la date affichée : sous l'heure, ou côte à côte (mieux adapté aux tuiles larges et basses).</span></div>
          <div class="help-opt"><span class="help-opt-name">Fond jour/nuit</span><span class="help-opt-desc">Bascule automatiquement avec le thème du tableau. Tant qu'il est activé, il prend le pas sur la couleur personnalisée définie dans la section Apparence de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Couleur de jour / de nuit</span><span class="help-opt-desc">Les deux couleurs du fond jour/nuit, si celui-ci est activé.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×5</span>
          <h4>Goal</h4>
          <p>Show the time and date legibly from a distance, with two styles to choose from depending on your taste or the room's mood.</p>
          <h4>Possibilities</h4>
          <p>In digital mode, the time fills the available space and automatically recalculates on every tile resize. On a wide, short tile, place the date next to the time rather than below it to make better use of the width. The optional day/night background gives an extra visual cue (e.g. a dark gradient at night), automatically following the same solar theme as the rest of the board.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Digital (numbers) or analog (hands).</span></div>
          <div class="help-opt"><span class="help-opt-name">Show seconds</span><span class="help-opt-desc">Adds the seconds count.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show date</span><span class="help-opt-desc">Adds today's date below or next to the time.</span></div>
          <div class="help-opt"><span class="help-opt-name">Time and date arrangement</span><span class="help-opt-desc">Digital mode with date shown only: below the time, or side by side (better suited to wide, short tiles).</span></div>
          <div class="help-opt"><span class="help-opt-name">Day/night background</span><span class="help-opt-desc">Automatically switches with the board's theme. While enabled, it takes precedence over the custom color set in the tile's Appearance section.</span></div>
          <div class="help-opt"><span class="help-opt-name">Day / night color</span><span class="help-opt-desc">The two colors of the day/night background, if enabled.</span></div>`
      }
    },

    {
      id: "commute",
      group: "tiles",
      title: { fr: "Trajet domicile-travail", en: "Commute time" },
      sub: {
        fr: "Temps de trajet en voiture en direct entre deux adresses, plus jusqu'à 5 trajets supplémentaires vers des destinations nommées (géocodage OpenStreetMap + itinéraire OSRM, sans clé API).",
        en: "Live driving times between two addresses, plus up to 5 extra trips to named destinations (OpenStreetMap geocoding + OSRM routing, no API key)."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×4</span>
          <h4>Objectif</h4>
          <p>Savoir d'un coup d'œil combien de temps il faut actuellement pour rejoindre le travail (ou tout autre trajet régulier), avant même d'être dans la voiture.</p>
          <h4>Possibilités</h4>
          <p>Renseignez une adresse A (typiquement le domicile) et une adresse B (le travail) : la tuile affiche le temps estimé A→B, B→A, ou les deux. Au-delà de ce trajet principal, jusqu'à 5 trajets supplémentaires peuvent être ajoutés — par exemple « Chez Maman », « Chez Papa », « École de Léo » — chacun calculé depuis l'adresse A vers sa propre destination. Avec plusieurs trajets, la disposition empilée (un par ligne) reste lisible même sur une tuile étroite ; la disposition côte à côte convient mieux à un trajet unique sur une tuile large.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Adresse A / Adresse B</span><span class="help-opt-desc">Les deux extrémités du trajet principal.</span></div>
          <div class="help-opt"><span class="help-opt-name">Sens affiché</span><span class="help-opt-desc">A→B, B→A, ou les deux.</span></div>
          <div class="help-opt"><span class="help-opt-name">Disposition des trajets</span><span class="help-opt-desc">Côte à côte (tuiles larges) ou empilés (tuiles hautes/étroites, ou plusieurs trajets supplémentaires).</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux recalculs des temps de trajet.</span></div>
          <div class="help-opt"><span class="help-opt-name">Trajets supplémentaires 1 à 5</span><span class="help-opt-desc">Chacun avec un nom et une adresse de destination. Un emplacement sans nom ou sans adresse est simplement ignoré ; l'échec du calcul d'un trajet n'empêche pas l'affichage des autres.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×4</span>
          <h4>Goal</h4>
          <p>Know at a glance how long it currently takes to get to work (or any other regular trip), before even being in the car.</p>
          <h4>Possibilities</h4>
          <p>Enter an address A (typically home) and an address B (work): the tile shows the estimated time A→B, B→A, or both. Beyond this main trip, up to 5 extra trips can be added — for instance "Mom's place", "Dad's place", "Leo's school" — each computed from address A to its own destination. With several trips, the stacked layout (one per line) stays readable even on a narrow tile; the side-by-side layout suits a single trip on a wide tile better.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Address A / Address B</span><span class="help-opt-desc">The two ends of the main trip.</span></div>
          <div class="help-opt"><span class="help-opt-name">Direction shown</span><span class="help-opt-desc">A→B, B→A, or both.</span></div>
          <div class="help-opt"><span class="help-opt-name">Trip arrangement</span><span class="help-opt-desc">Side by side (wide tiles) or stacked (tall/narrow tiles, or several extra trips).</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two trip-time recalculations.</span></div>
          <div class="help-opt"><span class="help-opt-name">Extra trips 1 to 5</span><span class="help-opt-desc">Each with a name and a destination address. A slot with no name or no address is simply skipped; a failed trip calculation doesn't prevent the others from showing.</span></div>`
      }
    },

    {
      id: "countdown",
      group: "tiles",
      title: { fr: "Compte à rebours", en: "Countdown" },
      sub: {
        fr: "Décompte vers une date fixe, ou fonctionne comme un minuteur démarrable pour une durée donnée. Alerte à la fin avec un flash plein écran et/ou un son choisi, plus un webhook de notification optionnel.",
        en: "Counts down to a fixed date, or acts as a start/pause timer for a set duration. Alerts when it ends with a full-screen flash and/or a chosen sound, plus an optional notification webhook."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×4</span>
          <h4>Objectif</h4>
          <p>Compter les jours qui restent avant un événement (anniversaire, départ en vacances, rentrée), ou servir de minuteur de cuisine géant visible depuis toute la pièce.</p>
          <h4>Possibilités</h4>
          <p>Deux modes : « Compte à rebours vers une date » (par exemple le 25 décembre, ou le début des vacances) affiche en continu le temps restant ; « Minuteur » fonctionne comme un chronomètre classique démarrable/pausable/réinitialisable pour une durée choisie (utile pour une cuisson, un temps de pause, un jeu). À la fin, une alerte se déclenche — flash plein écran et/ou son au choix parmi plusieurs sons synthétisés (donc aucun fichier audio, fonctionne hors-ligne) — et dure jusqu'à une minute, ou peut être arrêtée immédiatement d'un geste. Le webhook de notification permet de relayer la fin du compte à rebours vers un service externe (par exemple déclencher une notification SMS, une annonce sur une enceinte Alexa, ou une alerte push sur votre téléphone) via une simple requête HTTP GET ou POST.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Occasion</span><span class="help-opt-desc">Un libellé optionnel affiché au-dessus du décompte (ex. « Vacances ! »).</span></div>
          <div class="help-opt"><span class="help-opt-name">Type</span><span class="help-opt-desc">Compte à rebours vers une date, ou minuteur.</span></div>
          <div class="help-opt"><span class="help-opt-name">Date et heure cible</span><span class="help-opt-desc">Pour le mode « date ».</span></div>
          <div class="help-opt"><span class="help-opt-name">Durée du minuteur</span><span class="help-opt-desc">En minutes, pour le mode « minuteur ».</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les secondes</span><span class="help-opt-desc">Ajoute les secondes au décompte.</span></div>
          <div class="help-opt"><span class="help-opt-name">Flash plein écran</span><span class="help-opt-desc">Fait clignoter tout l'écran à la fin, pas seulement la tuile — difficile à manquer même de loin.</span></div>
          <div class="help-opt"><span class="help-opt-name">Jouer un son</span><span class="help-opt-desc">Nécessite des haut-parleurs sur l'appareil qui affiche le tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Son</span><span class="help-opt-desc">Choix parmi plusieurs sons synthétisés à la volée (bip, sirène, cloche, sonnette, jingle…).</span></div>
          <div class="help-opt"><span class="help-opt-name">Durée de l'alerte</span><span class="help-opt-desc">Le flash/son continue pendant cette durée après la fin du décompte. Un bouton « Arrêter » permet de la couper avant terme.</span></div>
          <div class="help-opt"><span class="help-opt-name">URL webhook / méthode / message</span><span class="help-opt-desc">Adresse appelée automatiquement à la fin du décompte. Le message peut inclure <code>{message}</code> pour insérer le texte configuré.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×4</span>
          <h4>Goal</h4>
          <p>Count the days left before an event (birthday, vacation, back-to-school), or act as a giant kitchen timer visible from anywhere in the room.</p>
          <h4>Possibilities</h4>
          <p>Two modes: "Countdown to a date" (e.g. December 25th, or the start of vacation) continuously shows the remaining time; "Timer" works like a classic stopwatch that can be started/paused/reset for a chosen duration (handy for cooking, a break, a game). At the end, an alert fires — full-screen flash and/or a sound chosen among several synthesized sounds (so no audio file, works offline) — lasting up to a minute, or can be stopped immediately with a tap. The notification webhook lets you relay the countdown's end to an external service (e.g. trigger an SMS notification, an announcement on an Alexa speaker, or a push alert on your phone) via a simple HTTP GET or POST request.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Occasion</span><span class="help-opt-desc">An optional label shown above the countdown (e.g. "Vacation!").</span></div>
          <div class="help-opt"><span class="help-opt-name">Type</span><span class="help-opt-desc">Countdown to a date, or timer.</span></div>
          <div class="help-opt"><span class="help-opt-name">Target date and time</span><span class="help-opt-desc">For "date" mode.</span></div>
          <div class="help-opt"><span class="help-opt-name">Timer duration</span><span class="help-opt-desc">In minutes, for "timer" mode.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show seconds</span><span class="help-opt-desc">Adds seconds to the countdown.</span></div>
          <div class="help-opt"><span class="help-opt-name">Full-screen flash</span><span class="help-opt-desc">Flashes the whole screen at the end, not just the tile — hard to miss even from a distance.</span></div>
          <div class="help-opt"><span class="help-opt-name">Play a sound</span><span class="help-opt-desc">Requires speakers on the device showing the dashboard.</span></div>
          <div class="help-opt"><span class="help-opt-name">Sound</span><span class="help-opt-desc">Choice among several sounds synthesized on the fly (beep, siren, bell, doorbell, jingle…).</span></div>
          <div class="help-opt"><span class="help-opt-name">Alert duration</span><span class="help-opt-desc">The flash/sound continues for this long after the countdown ends. A "Stop" button lets you cut it short.</span></div>
          <div class="help-opt"><span class="help-opt-name">Webhook URL / method / message</span><span class="help-opt-desc">Address automatically called when the countdown ends. The message can include <code>{message}</code> to insert the configured text.</span></div>`
      }
    },

    {
      id: "crypto",
      group: "tiles",
      title: { fr: "Cours de cryptos", en: "Crypto prices" },
      sub: {
        fr: "Cours en direct et variation 24h de quelques cryptomonnaies, via CoinGecko (sans clé API). Touchez une crypto pour voir sa courbe (24h / 7j / 30j / 1an).",
        en: "Live prices and 24h change for a few coins, powered by CoinGecko (no API key). Tap a coin to see its price chart (24h / 7d / 30d / 1y)."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×6</span>
          <h4>Objectif</h4>
          <p>Suivre le cours de quelques cryptomonnaies sans quitter le tableau de bord.</p>
          <h4>Possibilités</h4>
          <p>La liste des cryptos suivies se personnalise librement (par exemple Bitcoin, Ethereum, une monnaie plus confidentielle) via leurs identifiants CoinGecko. Touchez une ligne pour faire apparaître sa courbe de prix sur plusieurs périodes (24 heures, 7 jours, 30 jours, 1 an), pratique pour évaluer une tendance sans avoir besoin d'ouvrir une application dédiée.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Cryptos</span><span class="help-opt-desc">Liste d'identifiants CoinGecko séparés par des virgules (ex. <code>bitcoin,ethereum,solana</code>). L'identifiant CoinGecko correspond en général au nom complet en minuscules.</span></div>
          <div class="help-opt"><span class="help-opt-name">Devise</span><span class="help-opt-desc">Euro ou dollar US.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour des cours.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×6</span>
          <h4>Goal</h4>
          <p>Track the price of a few cryptocurrencies without leaving the dashboard.</p>
          <h4>Possibilities</h4>
          <p>The list of tracked coins can be freely customized (for instance Bitcoin, Ethereum, a more niche coin) via their CoinGecko identifiers. Tap a row to bring up its price chart over several periods (24 hours, 7 days, 30 days, 1 year), handy for gauging a trend without needing to open a dedicated app.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Coins</span><span class="help-opt-desc">Comma-separated list of CoinGecko IDs (e.g. <code>bitcoin,ethereum,solana</code>). The CoinGecko ID is generally the full lowercase name.</span></div>
          <div class="help-opt"><span class="help-opt-name">Currency</span><span class="help-opt-desc">Euro or US dollar.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two price updates.</span></div>`
      }
    },

    {
      id: "notes",
      group: "tiles",
      title: { fr: "Bloc-notes", en: "Notes" },
      sub: {
        fr: "Bloc-notes avec Markdown léger, listes à cocher interactives, couleurs post-it et texte auto-ajusté. Enregistré sur le serveur, partagé entre les écrans.",
        en: "Notepad with light Markdown, interactive checklists, sticky-note colors and auto-fitting text. Saved on the server, shared by all screens."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×3 par défaut, de 2×2 à 8×8</span>
          <h4>Objectif</h4>
          <p>Un pense-bête toujours visible, du style liste de courses, mot pour la famille, ou rappel du jour.</p>
          <h4>Possibilités</h4>
          <p>Le texte accepte un Markdown léger (titres, gras, italique) et surtout des listes à cocher interactives — tapez <code>- [ ] Lait</code> pour créer une case à cocher directement cliquable sur l'écran, très pratique pour une liste de courses partagée à la maison. Le contenu est enregistré côté serveur et donc partagé entre tous les écrans PiBoard de la maison si vous en avez plusieurs. Le style « post-it » (couleur au choix) donne un rendu chaleureux ; la taille du texte s'ajuste automatiquement à la taille de la tuile, ou peut être fixée manuellement.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Couleur post-it</span><span class="help-opt-desc">Couleur de la tuile elle-même, ou une teinte post-it (jaune, vert, bleu, rose, orange).</span></div>
          <div class="help-opt"><span class="help-opt-name">Ajuster automatiquement</span><span class="help-opt-desc">La taille du texte s'adapte à la taille de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille du texte</span><span class="help-opt-desc">Utilisée si l'ajustement automatique est désactivé.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lecture seule</span><span class="help-opt-desc">Empêche la modification du texte tout en gardant les cases à cocher interactives — pratique pour une liste préparée à l'avance que l'on ne veut faire que cocher.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher l'horodatage et le compteur de mots</span><span class="help-opt-desc">Petites informations discrètes en bas de la tuile.</span></div>`,
        en: `
          <span class="help-size">Size: 3×3 by default, from 2×2 to 8×8</span>
          <h4>Goal</h4>
          <p>An always-visible reminder board, for a shopping list, a note to the family, or today's reminder.</p>
          <h4>Possibilities</h4>
          <p>The text accepts light Markdown (headings, bold, italics) and, most usefully, interactive checklists — type <code>- [ ] Milk</code> to create a checkbox directly clickable on screen, very handy for a shopping list shared at home. The content is saved server-side and therefore shared across every PiBoard screen in the house if you have several. The "sticky note" style (choice of color) gives a warm look; text size adapts automatically to the tile's size, or can be set manually.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Sticky-note color</span><span class="help-opt-desc">The tile's own color, or a sticky-note tint (yellow, green, blue, pink, orange).</span></div>
          <div class="help-opt"><span class="help-opt-name">Auto-fit text</span><span class="help-opt-desc">Text size adapts to the tile's size.</span></div>
          <div class="help-opt"><span class="help-opt-name">Text size</span><span class="help-opt-desc">Used if auto-fit is disabled.</span></div>
          <div class="help-opt"><span class="help-opt-name">Read-only</span><span class="help-opt-desc">Prevents editing the text while keeping checkboxes interactive — handy for a list prepared in advance that should only be checked off.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show timestamp and word count</span><span class="help-opt-desc">Small discreet info at the bottom of the tile.</span></div>`
      }
    },

    {
      id: "quote",
      group: "tiles",
      title: { fr: "Citation du jour", en: "Quote of the day" },
      sub: {
        fr: "Une citation issue d'une collection embarquée hors-ligne — aucune connexion requise.",
        en: "A rotating quote from a bundled offline collection — no internet required."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×1 par défaut, de 1×1 à 12×5</span>
          <h4>Objectif</h4>
          <p>Une touche inspirante ou amusante sur le tableau, sans dépendre d'un service en ligne.</p>
          <h4>Possibilités</h4>
          <p>La collection de citations est embarquée directement dans PiBoard : la tuile fonctionne donc même sans connexion internet, et change de citation à intervalle régulier. Le texte et le nom de l'auteur s'ajustent automatiquement à la taille de la tuile — sur une tuile réduite, la taille de police diminue plutôt que de couper le texte, et l'auteur reste toujours entièrement visible.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Intervalle de rotation</span><span class="help-opt-desc">Durée d'affichage de chaque citation avant de passer à la suivante.</span></div>
          <div class="help-opt"><span class="help-opt-name">Catégorie</span><span class="help-opt-desc">Filtre éventuel sur le thème des citations, si la collection en propose plusieurs.</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille du texte</span><span class="help-opt-desc">De 50 % à 200 % : un multiplicateur appliqué par-dessus la taille calculée automatiquement, pour réduire volontairement (marge de sécurité pour une citation longue) ou agrandir.</span></div>`,
        en: `
          <span class="help-size">Size: 3×1 by default, from 1×1 to 12×5</span>
          <h4>Goal</h4>
          <p>An inspiring or fun touch on the board, without depending on an online service.</p>
          <h4>Possibilities</h4>
          <p>The quote collection is bundled directly inside PiBoard: the tile therefore works even without an internet connection, and changes quotes at a regular interval. The text and author name automatically adjust to the tile's size — on a small tile, the font size shrinks rather than cutting off the text, and the author always stays fully visible.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Rotation interval</span><span class="help-opt-desc">How long each quote is shown before moving to the next.</span></div>
          <div class="help-opt"><span class="help-opt-name">Category</span><span class="help-opt-desc">Optional theme filter on the quotes, if the collection offers several.</span></div>
          <div class="help-opt"><span class="help-opt-name">Text size</span><span class="help-opt-desc">50% to 200%: a multiplier applied on top of the automatically computed size, to voluntarily shrink (safety margin for a long quote) or enlarge.</span></div>`
      }
    },

    {
      id: "rss",
      group: "tiles",
      title: { fr: "Flux RSS", en: "RSS feed" },
      sub: {
        fr: "Derniers titres d'un flux RSS ou Atom, avec rotation automatique.",
        en: "Latest headlines from an RSS or Atom feed, with automatic rotation."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×3 par défaut, de 2×2 à 12×8</span>
          <h4>Objectif</h4>
          <p>Suivre l'actualité d'un site (presse généraliste, blog, journal local…) directement sur le tableau, sans jamais avoir à ouvrir un navigateur.</p>
          <h4>Possibilités</h4>
          <p>Fonctionne avec n'importe quel flux RSS ou Atom classique — la plupart des sites d'actualité en proposent un, parfois affiché comme un lien orange discret en bas de page. Si le nombre d'articles configuré dépasse la place disponible sur la tuile, la liste devient défilante (au doigt ou à la souris) plutôt que de couper les derniers titres. Le mode rotation affiche un article à la fois en plein cadre, en alternance automatique — plus lisible de loin pour un flux qu'on veut simplement voir défiler passivement.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">URL du flux</span><span class="help-opt-desc">L'adresse du fichier RSS/Atom (souvent en <code>.xml</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre max d'articles</span><span class="help-opt-desc">Combien de titres afficher au maximum.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rotation automatique</span><span class="help-opt-desc">Alterne un article à la fois plutôt que d'afficher toute la liste.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la source</span><span class="help-opt-desc">Ajoute le nom du site ou la date de publication sous chaque titre.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux relectures du flux.</span></div>`,
        en: `
          <span class="help-size">Size: 4×3 by default, from 2×2 to 12×8</span>
          <h4>Goal</h4>
          <p>Follow a site's news (general press, blog, local paper…) directly on the board, without ever needing to open a browser.</p>
          <h4>Possibilities</h4>
          <p>Works with any standard RSS or Atom feed — most news sites offer one, sometimes shown as a discreet orange link at the bottom of the page. If the configured number of articles exceeds the tile's available space, the list becomes scrollable (finger or mouse) instead of cutting off the latest headlines. Rotation mode shows one article at a time full-frame, alternating automatically — more readable from a distance for a feed you just want to watch passively scroll by.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Feed URL</span><span class="help-opt-desc">The RSS/Atom file's address (often ending in <code>.xml</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Max items</span><span class="help-opt-desc">How many headlines to show at most.</span></div>
          <div class="help-opt"><span class="help-opt-name">Auto-rotate</span><span class="help-opt-desc">Alternates one article at a time rather than showing the whole list.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show source</span><span class="help-opt-desc">Adds the site name or publication date below each headline.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two feed reads.</span></div>`
      }
    },

    {
      id: "slideshow",
      group: "tiles",
      title: { fr: "Diaporama", en: "Slideshow" },
      sub: {
        fr: "Fait défiler des photos issues d'une collection téléversée, d'un dossier local/NAS, d'un partage WebDAV, ou d'une liste d'URLs d'images.",
        en: "Rotates through photos from an uploaded collection, a local/NAS folder, a WebDAV share, or a list of image URLs."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×3 par défaut, de 2×2 à 12×12</span>
          <h4>Objectif</h4>
          <p>Faire défiler des photos de famille, de vacances, ou tout autre album, avec un effet de zoom lent façon cadre photo numérique.</p>
          <h4>Possibilités</h4>
          <p>Quatre sources possibles : des photos téléversées directement, un dossier local sur le Raspberry Pi ou un NAS, un partage WebDAV (Nextcloud, Synology…), ou une simple liste d'URLs d'images. Le format de chaque photo est détecté automatiquement (paysage ou portrait) et traité séparément : par défaut, une photo paysage remplit la tuile (recadrée), tandis qu'une photo portrait s'affiche en entier pour ne jamais rogner un visage — chaque comportement reste réglable indépendamment. Quand une photo est affichée en entier, l'espace vide autour peut être comblé par une couleur unie ou par la photo elle-même, agrandie et floutée en fond, pour un rendu plus habillé. Un zoom très léger anime les photos affichées en entier (sans jamais déborder du cadre), et un zoom plus marqué anime celles qui remplissent la tuile.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Source</span><span class="help-opt-desc">Photos téléversées, dossier local, WebDAV, ou liste d'URLs.</span></div>
          <div class="help-opt"><span class="help-opt-name">Intervalle</span><span class="help-opt-desc">Durée d'affichage de chaque photo, en secondes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Photos au format paysage / portrait</span><span class="help-opt-desc">Remplir la tuile (recadré) ou afficher la photo entière, réglable séparément pour chaque orientation.</span></div>
          <div class="help-opt"><span class="help-opt-name">Style de bordure</span><span class="help-opt-desc">Couleur unie ou photo floutée automatique, pour l'espace vide autour d'une photo affichée en entier.</span></div>
          <div class="help-opt"><span class="help-opt-name">Couleur de la bordure</span><span class="help-opt-desc">Utilisée seulement si le style de bordure est « Couleur unie ».</span></div>
          <div class="help-opt"><span class="help-opt-name">Ordre aléatoire</span><span class="help-opt-desc">Mélange l'ordre des photos plutôt que de suivre l'ordre de la source.</span></div>
          <div class="help-opt"><span class="help-opt-name">Effet de zoom lent</span><span class="help-opt-desc">Anime doucement chaque photo pendant son affichage.</span></div>`,
        en: `
          <span class="help-size">Size: 4×3 by default, from 2×2 to 12×12</span>
          <h4>Goal</h4>
          <p>Rotate through family photos, vacation shots, or any other album, with a slow zoom effect like a digital photo frame.</p>
          <h4>Possibilities</h4>
          <p>Four possible sources: photos uploaded directly, a local folder on the Raspberry Pi or a NAS, a WebDAV share (Nextcloud, Synology…), or a plain list of image URLs. Each photo's orientation is detected automatically (landscape or portrait) and handled separately: by default, a landscape photo fills the tile (cropped), while a portrait photo shows in full so a face is never cut off — each behavior stays adjustable independently. When a photo shows in full, the empty space around it can be filled with a solid color or with the photo itself, enlarged and blurred as a background, for a more polished look. A very light zoom animates fully-shown photos (never spilling past the frame), and a stronger zoom animates ones that fill the tile.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Source</span><span class="help-opt-desc">Uploaded photos, local folder, WebDAV, or URL list.</span></div>
          <div class="help-opt"><span class="help-opt-name">Interval</span><span class="help-opt-desc">How long each photo is shown, in seconds.</span></div>
          <div class="help-opt"><span class="help-opt-name">Landscape / portrait photos</span><span class="help-opt-desc">Fill the tile (cropped) or show the entire photo, adjustable separately for each orientation.</span></div>
          <div class="help-opt"><span class="help-opt-name">Border style</span><span class="help-opt-desc">Solid color or automatic blurred photo, for the empty space around a fully-shown photo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Border color</span><span class="help-opt-desc">Used only if the border style is "Solid color".</span></div>
          <div class="help-opt"><span class="help-opt-name">Shuffle order</span><span class="help-opt-desc">Randomizes photo order rather than following the source's order.</span></div>
          <div class="help-opt"><span class="help-opt-name">Slow zoom effect</span><span class="help-opt-desc">Gently animates each photo while it's shown.</span></div>`
      }
    },

    {
      id: "sportscore",
      group: "tiles",
      title: { fr: "Scores sportifs en direct", en: "Live sports scores" },
      sub: {
        fr: "Scores en direct et à venir de football, de rugby (Top 14), ou de toute autre compétition couverte par ESPN via son code.",
        en: "Live and upcoming scores for football, rugby (Top 14), or any other ESPN-covered competition via its code."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×3 par défaut, de 2×1 à 8×8</span>
          <h4>Objectif</h4>
          <p>Suivre les scores d'une compétition sans allumer la télévision, en direct pendant les matchs et pour les rencontres à venir.</p>
          <h4>Possibilités</h4>
          <p>Une sélection de compétitions courantes (Coupe du monde, Ligue des champions, principaux championnats de football européens, Top 14) est proposée directement dans la liste. Pour toute autre compétition suivie par ESPN — un championnat américain par exemple — un code personnalisé permet de cibler n'importe quelle ligue (voir la méthode de recherche du code dans les options du widget Classement, identique ici). Le filtre par équipe permet de ne garder que les matchs d'un club précis, pratique pour une tuile compacte dédiée à votre équipe favorite plutôt qu'à toute la compétition.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Compétition</span><span class="help-opt-desc">Liste des compétitions courantes préconfigurées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Code ESPN personnalisé</span><span class="help-opt-desc">Prend le pas sur la liste ci-dessus pour cibler n'importe quelle compétition couverte par ESPN (format <code>sport:ligue</code>, ex. <code>football:nfl</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Filtrer par équipe</span><span class="help-opt-desc">N'affiche que les matchs impliquant le nom saisi (ex. « Toulouse »).</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre de matchs affichés</span><span class="help-opt-desc">Combien de rencontres afficher au maximum.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour des scores.</span></div>`,
        en: `
          <span class="help-size">Size: 4×3 by default, from 2×1 to 8×8</span>
          <h4>Goal</h4>
          <p>Follow a competition's scores without turning on the TV, live during matches and for upcoming fixtures.</p>
          <h4>Possibilities</h4>
          <p>A selection of common competitions (World Cup, Champions League, major European football leagues, Top 14) is offered directly in the list. For any other ESPN-covered competition — an American league for instance — a custom code lets you target any league (see the code lookup method in the League standings widget's options, identical here). The team filter lets you keep only a specific club's matches, handy for a compact tile dedicated to your favorite team rather than the whole competition.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Competition</span><span class="help-opt-desc">List of preconfigured common competitions.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom ESPN code</span><span class="help-opt-desc">Takes precedence over the list above to target any ESPN-covered competition (format <code>sport:league</code>, e.g. <code>football:nfl</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Filter by team</span><span class="help-opt-desc">Only shows matches involving the entered name (e.g. "Toulouse").</span></div>
          <div class="help-opt"><span class="help-opt-name">Max matches shown</span><span class="help-opt-desc">How many matches to show at most.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two score updates.</span></div>`
      }
    },

    {
      id: "standings",
      group: "tiles",
      title: { fr: "Classement", en: "League standings" },
      sub: {
        fr: "Classement actuel de football, rugby (Top 14), basketball, ou toute autre compétition couverte par ESPN via son code.",
        en: "Current league table for football, rugby (Top 14), basketball, or any other ESPN-covered competition via its code."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×4 par défaut, de 2×2 à 12×12</span>
          <h4>Objectif</h4>
          <p>Afficher le classement à jour d'un championnat, avec la possibilité de mettre en valeur une équipe en particulier.</p>
          <h4>Possibilités</h4>
          <p>Comme pour les scores en direct, une liste de compétitions courantes est proposée, et un code ESPN personnalisé permet d'en cibler n'importe quelle autre. Pour trouver ce code : ouvrez la page de classement de la compétition sur espn.com (ex. <code>espn.com/nfl/scoreboard</code>), ouvrez les outils de développement du navigateur → onglet Réseau, rechargez la page, et repérez une requête vers <code>site.api.espn.com/apis/site/v2/sports/&lt;sport&gt;/&lt;ligue&gt;/scoreboard</code> — les deux segments après <code>/sports/</code> forment le code à saisir, séparés par deux-points (ex. NHL → <code>hockey:nhl</code>). La tuile s'agrandit largement (jusqu'à 12×12) pour que les noms de clubs complets restent lisibles même avec une grande police — élargissez-la si un nom est tronqué. Mettre en valeur une équipe (via son nom) la fait ressortir visuellement dans le tableau, pratique pour repérer d'un coup d'œil la position de votre équipe.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Compétition</span><span class="help-opt-desc">Liste des compétitions courantes préconfigurées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Code ESPN personnalisé</span><span class="help-opt-desc">Prend le pas sur la liste ci-dessus. Voir la méthode de recherche ci-dessus.</span></div>
          <div class="help-opt"><span class="help-opt-name">Équipes affichées par groupe</span><span class="help-opt-desc">Combien de lignes du classement afficher.</span></div>
          <div class="help-opt"><span class="help-opt-name">Mettre en valeur une équipe</span><span class="help-opt-desc">Fait ressortir visuellement la ligne de l'équipe nommée.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour du classement.</span></div>`,
        en: `
          <span class="help-size">Size: 4×4 by default, from 2×2 to 12×12</span>
          <h4>Goal</h4>
          <p>Show a league's current standings, with the option to highlight a specific team.</p>
          <h4>Possibilities</h4>
          <p>As with live scores, a list of common competitions is offered, and a custom ESPN code lets you target any other. To find that code: open the competition's standings page on espn.com (e.g. <code>espn.com/nfl/scoreboard</code>), open the browser's developer tools → Network tab, reload the page, and look for a request to <code>site.api.espn.com/apis/site/v2/sports/&lt;sport&gt;/&lt;league&gt;/scoreboard</code> — the two segments after <code>/sports/</code> form the code to enter, separated by a colon (e.g. NHL → <code>hockey:nhl</code>). The tile scales up generously (up to 12×12) so full club names stay readable even with a large font — widen it if a name gets truncated. Highlighting a team (by name) makes it visually stand out in the table, handy for spotting your team's position at a glance.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Competition</span><span class="help-opt-desc">List of preconfigured common competitions.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom ESPN code</span><span class="help-opt-desc">Takes precedence over the list above. See the lookup method above.</span></div>
          <div class="help-opt"><span class="help-opt-name">Teams shown per group</span><span class="help-opt-desc">How many standings rows to show.</span></div>
          <div class="help-opt"><span class="help-opt-name">Highlight a team</span><span class="help-opt-desc">Visually highlights the named team's row.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two standings updates.</span></div>`
      }
    },

    {
      id: "system",
      group: "tiles",
      title: { fr: "État système", en: "System status" },
      sub: {
        fr: "CPU, RAM, espace disque, température et disponibilité de la machine qui héberge PiBoard.",
        en: "CPU, RAM, disk usage, temperature and uptime of the machine hosting PiBoard."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×3 par défaut, de 2×1 à 6×6</span>
          <h4>Objectif</h4>
          <p>Garder un œil sur la santé du Raspberry Pi (ou de toute autre machine) qui héberge PiBoard, directement depuis le tableau lui-même.</p>
          <h4>Possibilités</h4>
          <p>Utile en particulier sur un Raspberry Pi, où la température et l'usage CPU/RAM peuvent révéler un problème (par exemple un boîtier mal ventilé, ou un processus qui consomme trop) avant qu'il ne devienne gênant. L'espace disque restant permet d'anticiper un plein (photos du diaporama, notes…) avant qu'il ne bloque une sauvegarde.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en secondes entre deux relevés.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le nom de machine</span><span class="help-opt-desc">Utile si plusieurs machines hébergent chacune une instance PiBoard.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la disponibilité</span><span class="help-opt-desc">Depuis combien de temps la machine tourne sans interruption.</span></div>`,
        en: `
          <span class="help-size">Size: 3×3 by default, from 2×1 to 6×6</span>
          <h4>Goal</h4>
          <p>Keep an eye on the health of the Raspberry Pi (or any other machine) hosting PiBoard, directly from the board itself.</p>
          <h4>Possibilities</h4>
          <p>Especially useful on a Raspberry Pi, where temperature and CPU/RAM usage can reveal a problem (e.g. a poorly ventilated case, or a process consuming too much) before it becomes an issue. Remaining disk space lets you anticipate running out (slideshow photos, notes…) before it blocks a save.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in seconds between two readings.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show hostname</span><span class="help-opt-desc">Useful if several machines each host a PiBoard instance.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show uptime</span><span class="help-opt-desc">How long the machine has been running without interruption.</span></div>`
      }
    },

    {
      id: "networkscan",
      group: "tiles",
      title: { fr: "Analyse réseau", en: "Network scan" },
      sub: {
        fr: "Balaie le réseau local et liste les hôtes actifs, au format « Nom d'hôte — Adresse IP ».",
        en: "Scans the local network and lists active hosts, as \"Hostname — IP address\"."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×4 par défaut, de 3×2 à 8×10</span>
          <h4>Objectif</h4>
          <p>Voir d'un coup d'œil ce qui est actuellement connecté au réseau local : ordinateurs, téléphones, objets connectés, imprimantes… sans avoir à ouvrir l'interface d'administration du routeur.</p>
          <h4>Possibilités</h4>
          <p>L'analyse combine un ping de chaque adresse du sous-réseau et une lecture de la table ARP du Pi juste après, pour aussi repérer les appareils dont le pare-feu bloque le ping (une table ARP se remplit quel que soit ce réglage, car elle est nécessaire au routage). Un nom d'hôte est ensuite recherché par résolution DNS inverse pour chaque appareil trouvé ; à défaut, seule l'adresse IP est affichée. Le Pi lui-même apparaît toujours dans la liste, mis en évidence. Aucune donnée ne quitte le réseau local. Une analyse dure environ 10 à 20 secondes selon la taille du réseau — le bouton « Analyser maintenant » sur la tuile permet de la relancer à tout moment.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Sous-réseau à analyser (CIDR)</span><span class="help-opt-desc">Laissez vide pour détecter automatiquement le réseau du Pi (recommandé). Exemple pour le forcer : 192.168.1.0/24. Limité à /22 (1024 adresses) au maximum.</span></div>
          <div class="help-opt"><span class="help-opt-name">Réanalyser automatiquement</span><span class="help-opt-desc">En minutes ; 0 (par défaut) désactive l'analyse automatique, seul le bouton de la tuile déclenche une analyse.</span></div>`,
        en: `
          <span class="help-size">Size: 4×4 by default, from 3×2 to 8×10</span>
          <h4>Goal</h4>
          <p>See at a glance what's currently connected to the local network: computers, phones, smart devices, printers… without opening the router's admin interface.</p>
          <h4>Possibilities</h4>
          <p>The scan combines a ping of every address in the subnet with a read of the Pi's ARP table right after, to also catch devices whose firewall blocks ping (an ARP table fills in regardless of that setting, since it's needed for routing). A hostname is then looked up via reverse DNS for each device found; failing that, only the IP address is shown. The Pi itself always appears in the list, highlighted. No data ever leaves the local network. A scan takes roughly 10–20 seconds depending on the network's size — the "Scan now" button on the tile re-runs it at any time.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Subnet to scan (CIDR)</span><span class="help-opt-desc">Leave empty to auto-detect the Pi's own network (recommended). Example to force it: 192.168.1.0/24. Limited to /22 (1024 addresses) at most.</span></div>
          <div class="help-opt"><span class="help-opt-name">Auto-rescan</span><span class="help-opt-desc">In minutes; 0 (default) disables automatic scanning, only the tile's button triggers a scan.</span></div>`
      }
    },

    {
      id: "traffic",
      group: "tiles",
      title: { fr: "Carte de trafic", en: "Traffic map" },
      sub: {
        fr: "Carte de trafic routier en direct (flux + incidents) via TomTom, avec un calendrier de rafraîchissement intelligent pour rester dans le quota gratuit de l'API : rapide pendant vos plages de trajet, plus lent le reste du temps, et en pause la nuit.",
        en: "Live road traffic map (flow + incidents) via TomTom, with a smart refresh schedule to stay within the free API quota: fast during your commute windows, slower otherwise, and paused overnight."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 6×8 par défaut, de 4×3 à 12×16 (minimum relevé pour éviter que la légende et le bouton de rafraîchissement ne se chevauchent)</span>
          <h4>Objectif</h4>
          <p>Visualiser l'état du trafic routier autour de chez vous en temps réel, avec les mêmes données (flux de circulation coloré, incidents, bouchons) que l'application TomTom elle-même.</p>
          <h4>Possibilités</h4>
          <p>La carte se centre sur la ville ou l'adresse choisie, avec un fond de carte au choix (Voyager coloré avec noms de rues, sombre, clair, ou automatique selon le thème jour/nuit du tableau). Les bouchons s'affichent en tracés cliquables colorés selon leur gravité, avec le retard estimé au tap. Nécessite une clé API TomTom (offre gratuite disponible, largement suffisante pour un usage personnel).</p>

          <h4>Obtenir une clé API TomTom</h4>
          <ol style="margin:0 0 14px;padding-left:20px;color:var(--text)">
            <li style="margin-bottom:6px">Rendez-vous sur <a href="https://developer.tomtom.com" target="_blank">developer.tomtom.com</a> et créez un compte gratuit (bouton « Sign up » / s'inscrire).</li>
            <li style="margin-bottom:6px">Une fois connecté, ouvrez votre tableau de bord développeur : une première clé y est déjà créée automatiquement (souvent nommée « My first API key »). Vous pouvez l'utiliser telle quelle, ou en créer une dédiée à PiBoard via la section « Keys » → « Add new key ».</li>
            <li style="margin-bottom:6px">Copiez la clé affichée (une longue chaîne de caractères).</li>
            <li style="margin-bottom:6px">Collez-la dans le champ « Clé API TomTom » des réglages de la tuile Trafic, puis enregistrez.</li>
          </ol>
          <p>Le compte gratuit inclut <b>50 000 requêtes de tuiles</b> (le fond de carte et les couches de trafic) et <b>2 500 requêtes hors tuiles</b> par jour — largement suffisant pour un usage personnel, d'autant que le calendrier de rafraîchissement intelligent de la tuile (détaillé plus bas) est justement pensé pour rester confortablement dans cette limite. Aucune carte bancaire n'est nécessaire pour ce niveau gratuit. Gardez votre clé confidentielle : ne la partagez pas publiquement (par exemple dans un dépôt de code visible de tous).</p>
          <p>Le point le plus important pour rester dans le quota gratuit : le calendrier de rafraîchissement intelligent. Vous définissez vos plages de trajet habituelles (matin et après-midi), pendant lesquelles la carte se rafraîchit rapidement ; en dehors, le rythme ralentit automatiquement, et une plage silencieuse (nuit) suspend complètement les requêtes puisque le trafic n'y a pas d'intérêt. Le bouton « Rafraîchir maintenant », en haut à gauche des boutons de zoom, permet de forcer un rythme rapide temporaire à tout moment (par exemple avant un départ imprévu).</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Clé API TomTom</span><span class="help-opt-desc">Nécessaire pour toute donnée de trafic. Une offre gratuite est proposée par TomTom.</span></div>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte.</span></div>
          <div class="help-opt"><span class="help-opt-name">Niveau de zoom</span><span class="help-opt-desc">Zoom initial de la carte (ajustable ensuite librement à l'écran, y compris au pincer-zoomer tactile).</span></div>
          <div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager (routier coloré), sombre, clair, ou automatique selon le thème du tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le flux de circulation</span><span class="help-opt-desc">Les routes colorées selon la fluidité du trafic.</span></div>
          <div class="help-opt"><span class="help-opt-name">Style de coloration du flux</span><span class="help-opt-desc">Plusieurs styles TomTom : relatif (écart à la vitesse normale, recommandé), absolu (vitesse réelle), retard seul (masque les axes fluides), sensibilité réduite (gros bouchons uniquement).</span></div>
          <div class="help-opt"><span class="help-opt-name">Épaisseur des tronçons de flux</span><span class="help-opt-desc">Largeur du tracé des routes colorées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les incidents</span><span class="help-opt-desc">Accidents, travaux, fermetures.</span></div>
          <div class="help-opt"><span class="help-opt-name">Style des icônes d'incidents</span><span class="help-opt-desc">De lignes seules (discret) à icônes détaillées avec chevrons, ou variante adaptée à un fond sombre.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les bouchons</span><span class="help-opt-desc">Tracés cliquables avec retard estimé, colorés selon la gravité.</span></div>
          <div class="help-opt"><span class="help-opt-name">Calendrier de rafraîchissement</span><span class="help-opt-desc">Plages matin/après-midi (heure de début, durée), rythme rapide pendant ces plages, rythme normal en dehors, et plage silencieuse (nuit) sans aucune requête.</span></div>`,
        en: `
          <span class="help-size">Size: 6×8 by default, from 4×3 to 12×16 (minimum raised to prevent the legend and refresh button from overlapping)</span>
          <h4>Goal</h4>
          <p>Visualize real-time road traffic around you, with the same data (colored traffic flow, incidents, jams) as the TomTom app itself.</p>
          <h4>Possibilities</h4>
          <p>The map centers on the chosen city or address, with a choice of base map (colored Voyager with street names, dark, light, or automatic following the board's day/night theme). Jams show as clickable traces colored by severity, with the estimated delay on tap. Requires a TomTom API key (a free tier is available, plenty for personal use).</p>

          <h4>Getting a TomTom API key</h4>
          <ol style="margin:0 0 14px;padding-left:20px;color:var(--text)">
            <li style="margin-bottom:6px">Go to <a href="https://developer.tomtom.com" target="_blank">developer.tomtom.com</a> and create a free account (the "Sign up" button).</li>
            <li style="margin-bottom:6px">Once logged in, open your developer dashboard: a first key is already created automatically there (often named "My first API key"). You can use it as is, or create one dedicated to PiBoard via the "Keys" section → "Add new key".</li>
            <li style="margin-bottom:6px">Copy the key shown (a long string of characters).</li>
            <li style="margin-bottom:6px">Paste it into the "TomTom API key" field in the Traffic tile's settings, then save.</li>
          </ol>
          <p>The free account includes <b>50,000 tile requests</b> (the base map and traffic layers) and <b>2,500 non-tile requests</b> per day — plenty for personal use, especially since the tile's smart refresh schedule (detailed below) is precisely designed to stay comfortably within this limit. No credit card is needed for this free tier. Keep your key confidential: don't share it publicly (for instance in a code repository visible to everyone).</p>
          <p>The most important point for staying within the free quota: the smart refresh schedule. You set your usual commute windows (morning and afternoon), during which the map refreshes quickly; outside those, the pace automatically slows down, and a quiet window (night) fully suspends requests since traffic isn't relevant then. The "Refresh now" button, top-left of the zoom buttons, lets you force a temporary fast pace at any time (for instance before an unplanned trip).</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">TomTom API key</span><span class="help-opt-desc">Needed for any traffic data. A free tier is offered by TomTom.</span></div>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom level</span><span class="help-opt-desc">Initial map zoom (freely adjustable afterwards on screen, including touch pinch-zoom).</span></div>
          <div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager (colored, roads), dark, light, or automatic following the board's theme.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show traffic flow</span><span class="help-opt-desc">Roads colored by how smoothly traffic is moving.</span></div>
          <div class="help-opt"><span class="help-opt-name">Flow coloring style</span><span class="help-opt-desc">Several TomTom styles: relative (deviation from normal speed, recommended), absolute (actual speed), delay only (hides free-flowing roads), reduced sensitivity (major jams only).</span></div>
          <div class="help-opt"><span class="help-opt-name">Flow segment thickness</span><span class="help-opt-desc">Width of the colored road traces.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show incidents</span><span class="help-opt-desc">Accidents, roadworks, closures.</span></div>
          <div class="help-opt"><span class="help-opt-name">Incident icon style</span><span class="help-opt-desc">From lines only (subtle) to detailed icons with chevrons, or a variant suited to a dark base map.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show jams</span><span class="help-opt-desc">Clickable traces with estimated delay, colored by severity.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh schedule</span><span class="help-opt-desc">Morning/afternoon windows (start time, duration), fast pace during those windows, normal pace outside, and a quiet window (night) with no requests at all.</span></div>`
      }
    },

    {
      id: "weather",
      group: "tiles",
      title: { fr: "Météo", en: "Weather" },
      sub: {
        fr: "Météo actuelle avec un choix de modèles météo nationaux, une vraie photo de fond selon les conditions, et la prévision du lendemain disposée automatiquement selon la forme de la tuile.",
        en: "Current weather with a choice of national weather models, a real photo background matching conditions, and tomorrow's forecast laid out automatically to fit the tile's shape."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 8×4</span>
          <h4>Objectif</h4>
          <p>La météo actuelle et celle du lendemain d'un simple coup d'œil, avec une vraie photo illustrant les conditions plutôt qu'une simple icône.</p>
          <h4>Possibilités</h4>
          <p>Toutes les sources (sauf « Personnalisé ») passent par l'API gratuite et sans clé d'Open-Meteo, qui agrège plusieurs modèles météorologiques nationaux. Par défaut, « Meilleure correspondance » choisit automatiquement le meilleur modèle pour votre lieu — un bon choix pour la plupart des usages. Si les prévisions vous semblent régulièrement décalées, un modèle national précis (Météo-France pour la France, DWD pour l'Allemagne, etc.) fait parfois mieux localement que le choix automatique. La disposition de la prévision du lendemain s'adapte automatiquement à la forme de la tuile : côte à côte sur une tuile large, empilée sur une tuile haute, ou masquée sur une tuile presque carrée pour laisser plus de place à la météo du jour. L'option « Personnalisé » permet de brancher votre propre source (une instance Open-Meteo auto-hébergée, ou un petit proxy que vous écrivez pour reformater les données d'un autre fournisseur météo).</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Lieu pour lequel afficher la météo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Modèle météo / source</span><span class="help-opt-desc">Meilleure correspondance (automatique), ou un modèle national précis (Météo-France, ECMWF, DWD, MET Norway, NOAA), ou personnalisé.</span></div>
          <div class="help-opt"><span class="help-opt-name">URL de prévision personnalisée</span><span class="help-opt-desc">Utilisée seulement par « Personnalisé ». Utilisez <code>{lat}</code> et <code>{lon}</code> comme espaces réservés ; la réponse doit respecter le format JSON exact d'Open-Meteo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la prévision du lendemain</span><span class="help-opt-desc">La disposition s'adapte automatiquement à la forme de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le vent</span><span class="help-opt-desc">Ajoute la vitesse du vent.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour.</span></div>
          <div class="help-opt"><span class="help-opt-name">Utiliser une photo de fond</span><span class="help-opt-desc">Une vraie photo correspondant aux conditions actuelles (repli sur un fond de couleur si aucune photo n'est disponible).</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 8×4</span>
          <h4>Goal</h4>
          <p>Today's and tomorrow's weather at a glance, with a real photo illustrating conditions rather than a plain icon.</p>
          <h4>Possibilities</h4>
          <p>Every source (except "Custom") goes through Open-Meteo's free, keyless API, which aggregates several national weather models. By default, "Best match" automatically picks the best model for your location — a good choice for most uses. If forecasts consistently seem off, a precise national model (Météo-France for France, DWD for Germany, etc.) sometimes does better locally than the automatic choice. Tomorrow's forecast layout automatically adapts to the tile's shape: side by side on a wide tile, stacked on a tall one, or hidden on a near-square tile to leave more room for today's weather. The "Custom" option lets you plug in your own source (a self-hosted Open-Meteo instance, or a small proxy you write to reformat data from another weather provider).</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Location to show weather for.</span></div>
          <div class="help-opt"><span class="help-opt-name">Weather model / source</span><span class="help-opt-desc">Best match (automatic), or a precise national model (Météo-France, ECMWF, DWD, MET Norway, NOAA), or custom.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom forecast URL</span><span class="help-opt-desc">Used only by "Custom". Use <code>{lat}</code> and <code>{lon}</code> as placeholders; the response must match Open-Meteo's exact JSON format.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show tomorrow's forecast</span><span class="help-opt-desc">The layout automatically adapts to the tile's shape.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show wind</span><span class="help-opt-desc">Adds wind speed.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two updates.</span></div>
          <div class="help-opt"><span class="help-opt-name">Use a photo background</span><span class="help-opt-desc">A real photo matching current conditions (falls back to a color background if no photo is available).</span></div>`
      }
    },

    {
      id: "webview",
      group: "tiles",
      title: { fr: "Page web", en: "Web page" },
      sub: {
        fr: "Affiche n'importe quelle page web (carte de trafic, app domotique, page de statut…). Le site doit autoriser l'affichage en iframe.",
        en: "Embeds any web page (traffic map, home app, status page…). The site must allow iframe embedding."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 6×4 par défaut, de 2×2 à 12×16</span>
          <h4>Objectif</h4>
          <p>Intégrer une page web externe directement dans une tuile — utile pour tout service que PiBoard ne propose pas nativement (une application domotique, un tableau de statut, une carte tierce).</p>
          <h4>Possibilités</h4>
          <p>Toute page web peut en théorie être affichée, à condition que le site distant l'autorise (certains sites bloquent volontairement l'affichage en cadre, pour des raisons de sécurité — dans ce cas la tuile reste vide, sans solution de contournement possible côté PiBoard). Le zoom permet de faire tenir une page pensée pour un grand écran dans l'espace réduit d'une tuile, et le rechargement automatique garde le contenu à jour sans intervention.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">L'adresse à afficher dans la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom</span><span class="help-opt-desc">Pourcentage de zoom appliqué à la page affichée.</span></div>
          <div class="help-opt"><span class="help-opt-name">Recharger toutes les</span><span class="help-opt-desc">Intervalle en minutes entre deux rechargements automatiques (0 = jamais).</span></div>`,
        en: `
          <span class="help-size">Size: 6×4 by default, from 2×2 to 12×16</span>
          <h4>Goal</h4>
          <p>Embed an external web page directly into a tile — useful for any service PiBoard doesn't natively offer (a home automation app, a status dashboard, a third-party map).</p>
          <h4>Possibilities</h4>
          <p>Any web page can in theory be shown, provided the remote site allows it (some sites deliberately block being framed, for security reasons — in that case the tile stays empty, with no workaround possible on PiBoard's side). Zoom lets a page designed for a large screen fit into a tile's smaller space, and automatic reloading keeps the content up to date without intervention.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">The address to show in the tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom</span><span class="help-opt-desc">Zoom percentage applied to the shown page.</span></div>
          <div class="help-opt"><span class="help-opt-name">Reload every</span><span class="help-opt-desc">Interval in minutes between two automatic reloads (0 = never).</span></div>`
      }
    },

    /* ================= REMERCIEMENTS / CREDITS ================= */
    {
      id: "credits",
      group: "credits",
      title: { fr: "Remerciements", en: "Credits" },
      sub: {
        fr: "Les services et projets externes qui rendent PiBoard possible.",
        en: "The external services and projects that make PiBoard possible."
      },
      html: {
        fr: `
          <p>PiBoard s'appuie sur plusieurs services et projets tiers, la plupart gratuits et sans clé API. Un grand merci à leurs équipes.</p>

          <div class="help-credit"><span class="help-opt-name">TomTom</span> — <a href="https://www.tomtom.com" target="_blank">tomtom.com</a><br><span class="help-opt-desc">Données de trafic (flux et incidents) de la tuile Carte de trafic.</span></div>
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Fonds de carte (Voyager, clair, sombre) de la tuile Carte de trafic.</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Données cartographiques sous-jacentes des fonds de carte CARTO, et service de géocodage (Nominatim) utilisé par la tuile Trajet domicile-travail pour convertir une adresse en coordonnées.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Calcul d'itinéraires et de temps de trajet pour la tuile Trajet domicile-travail.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Prévisions météo (agrégeant plusieurs modèles nationaux : Météo-France, ECMWF, DWD, MET Norway, NOAA) de la tuile Météo, et service de recherche de ville utilisé par plusieurs tuiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">Openverse</span> — <a href="https://openverse.org" target="_blank">openverse.org</a><br><span class="help-opt-desc">Photos de fond sous licence libre de la tuile Météo, avec crédit du photographe affiché sur la tuile quand disponible.</span></div>
          <div class="help-credit"><span class="help-opt-name">CoinGecko</span> — <a href="https://www.coingecko.com" target="_blank">coingecko.com</a><br><span class="help-opt-desc">Cours et courbes de prix de la tuile Cours de cryptos.</span></div>
          <div class="help-credit"><span class="help-opt-name">ESPN</span> — <a href="https://www.espn.com" target="_blank">espn.com</a><br><span class="help-opt-desc">Scores en direct et classements des tuiles Scores sportifs et Classement.</span></div>
          <div class="help-credit"><span class="help-opt-name">Leaflet</span> — <a href="https://leafletjs.com" target="_blank">leafletjs.com</a><br><span class="help-opt-desc">Bibliothèque de cartographie interactive utilisée par la tuile Carte de trafic.</span></div>
          <div class="help-credit"><span class="help-opt-name">GridStack.js</span> — <a href="https://gridstackjs.com" target="_blank">gridstackjs.com</a><br><span class="help-opt-desc">Bibliothèque de grille qui permet de déplacer et redimensionner les tuiles du tableau.</span></div>

          <p style="margin-top:20px">Les flux RSS, dossiers de photos, pages web intégrées et webhooks de notification sont fournis par vous-même — PiBoard ne recommande ni n'héberge aucun contenu de ce type.</p>`,
        en: `
          <p>PiBoard relies on several third-party services and projects, most of them free and keyless. A big thank-you to their teams.</p>

          <div class="help-credit"><span class="help-opt-name">TomTom</span> — <a href="https://www.tomtom.com" target="_blank">tomtom.com</a><br><span class="help-opt-desc">Traffic data (flow and incidents) for the Traffic map tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Base maps (Voyager, light, dark) for the Traffic map tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Underlying map data for the CARTO base maps, and the geocoding service (Nominatim) used by the Commute time tile to turn an address into coordinates.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Route and travel-time computation for the Commute time tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Weather forecasts (aggregating several national models: Météo-France, ECMWF, DWD, MET Norway, NOAA) for the Weather tile, and the city search service used by several tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">Openverse</span> — <a href="https://openverse.org" target="_blank">openverse.org</a><br><span class="help-opt-desc">Openly-licensed background photos for the Weather tile, with the photographer credited on the tile when available.</span></div>
          <div class="help-credit"><span class="help-opt-name">CoinGecko</span> — <a href="https://www.coingecko.com" target="_blank">coingecko.com</a><br><span class="help-opt-desc">Prices and price charts for the Crypto prices tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">ESPN</span> — <a href="https://www.espn.com" target="_blank">espn.com</a><br><span class="help-opt-desc">Live scores and standings for the Live sports scores and League standings tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">Leaflet</span> — <a href="https://leafletjs.com" target="_blank">leafletjs.com</a><br><span class="help-opt-desc">Interactive mapping library used by the Traffic map tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">GridStack.js</span> — <a href="https://gridstackjs.com" target="_blank">gridstackjs.com</a><br><span class="help-opt-desc">Grid library that lets board tiles be dragged and resized.</span></div>

          <p style="margin-top:20px">RSS feeds, photo folders, embedded web pages and notification webhooks are provided by you — PiBoard neither recommends nor hosts any content of that kind.</p>`
      }
    },

  ];
})();
