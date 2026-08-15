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
          <p>Les fenêtres qui s'ouvrent par-dessus le tableau (lecture d'un mail ou d'un article RSS, réglages d'une tuile, aide, catalogue…) sont elles aussi <b>redimensionnables à la souris</b>, en tirant leur coin bas-droit — pratique si un contenu mis en forme a besoin de plus de largeur pour rester lisible. Cette poignée n'apparaît qu'avec une souris, pas en mode tactile.</p>

          <h4>La section Apparence, commune à toutes les tuiles</h4>
          <p>En plus de ses réglages propres, chaque tuile a une section <b>Apparence</b> tout en bas de sa fenêtre de configuration, toujours composée des mêmes options :</p>
          <div class="help-opt"><span class="help-opt-name">Afficher le titre</span><span class="help-opt-desc">Montre ou masque le bandeau de titre en haut de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Titre personnalisé</span><span class="help-opt-desc">Remplace le nom par défaut du widget par le texte de votre choix (ex. « Trafic » plutôt que « Carte de trafic »).</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille du texte</span><span class="help-opt-desc">De 50 % à 200 %, sur la plupart des widgets (absent pour la tuile Trafic, dont le zoom casserait la carte). Utile pour agrandir la lisibilité d'une tuile agrandie, ou au contraire faire tenir plus de contenu en réduisant. La tuile Citation gère sa propre échelle un peu différemment — voir sa fiche dédiée plus bas.</span></div>
          <div class="help-opt"><span class="help-opt-name">Couleur personnalisée</span><span class="help-opt-desc">Remplace la couleur de fond par défaut du thème (jour/nuit) par une couleur fixe, propre à cette tuile.</span></div>

          <h4>La section Planification, commune à toutes les tuiles</h4>
          <p>Juste en dessous, une section <b>Planification</b> permet de n'activer une tuile que certains jours et à certaines heures — par exemple le trajet domicile-travail uniquement du lundi au vendredi entre 7 h et 9 h, ou la météo du week-end le samedi et le dimanche. Elle est <b>désactivée par défaut</b> : sans intervention, rien ne change.</p>
          <p>Hors de sa plage, la tuile <b>ne disparaît pas</b> — elle garde exactement sa place dans la grille (aucune autre tuile ne bouge) et affiche simplement « En pause » avec un rappel de sa plage. Surtout, son widget est <b>réellement arrêté</b> : il cesse ses minuteries et ses appels réseau. C'est le principal intérêt de la fonctionnalité pour les tuiles soumises à un quota — la tuile Trajet, par exemple, ne consomme plus le quota TomTom la nuit ni le week-end. Les réglages d'une tuile en pause restent accessibles normalement, pour pouvoir la réactiver.</p>
          <div class="help-opt"><span class="help-opt-name">Jours</span><span class="help-opt-desc">Sept cases à cocher. N'en cocher aucune signifie « tous les jours ».</span></div>
          <div class="help-opt"><span class="help-opt-name">De / À</span><span class="help-opt-desc">La plage horaire. Laissez les deux vides pour ne filtrer que sur les jours. Une plage qui se termine avant de commencer (ex. 22:00 → 06:00) court sur la nuit ; le jour coché est alors celui où elle démarre, donc « vendredi 22:00 → 06:00 » couvre bien la nuit du vendredi au samedi.</span></div>

          <h4>Taille des tuiles</h4>
          <p>Chaque widget définit une taille minimale et maximale cohérente avec ce qu'il affiche : par exemple, la carte de trafic ne peut pas descendre en dessous d'une certaine taille, car ses boutons (rafraîchissement, zoom) finiraient par se chevaucher. À l'inverse, le diaporama ou le classement sportif acceptent d'être agrandis largement, utile si vous augmentez la taille du texte dans les réglages d'apparence d'une tuile. Si une tuile déjà en place devient trop petite après une mise à jour de ses contraintes, PiBoard la rétablit automatiquement à sa taille minimale au chargement suivant.</p>

          <h4>Les différentes zones du tableau de bord</h4>
          <ul>
            <li><b>Le tableau principal</b> — la grille visible en permanence, celle que l'on voit à l'écran au quotidien.</li>
            <li><b>Les trois tiroirs de tuiles</b> — des panneaux escamotables, ouverts via une languette sur le bord gauche, en haut, ou sur le bord droit de l'écran. Ils permettent de préparer ou ranger des tuiles supplémentaires sans encombrer le tableau principal (par exemple des tuiles utilisées occasionnellement), et d'augmenter la surface d'affichage disponible. Chacun peut être redimensionné à la souris ou au doigt (poignée sur son bord ouvert) jusqu'à 96 % de l'écran, ou jusqu'à 100 % via les champs dédiés des réglages généraux (section « Tiroirs de tuiles »). Un seul tiroir est ouvert à la fois : en ouvrir un referme automatiquement celui qui l'était. Une tuile ajoutée pendant qu'un tiroir est ouvert y est placée directement ; sinon, elle rejoint le tableau principal.</li>
            <li><b>Le tiroir de configuration du bas</b> — la barre d'outils escamotable en bas de l'écran (languette centrale), qui donne accès à l'ajout de tuiles, au mode édition, aux réglages généraux, à cette aide, et au redémarrage de l'affichage. Voir la section « Barre d'outils & réglages » du sommaire pour le détail de chaque bouton et réglage.</li>
          </ul>`,
        en: `
          <h4>Goal</h4>
          <p>PiBoard is an always-on display dashboard: a screen (typically a tablet or a wall-mounted touchscreen) that continuously shows useful information at a glance — time, weather, traffic, agenda, news, family photos, and so on — without needing to be touched most of the time. It's designed to run as a kiosk (full screen, no browser chrome), while staying fully configurable directly from the screen, touch or not.</p>

          <h4>The tile principle</h4>
          <p>Each piece of information shown is a <b>tile</b>: an independent rectangle hosting a widget (clock, weather, traffic, RSS feed…). Tiles move and resize freely on an invisible grid, a bit like windows on a desktop. To add a tile, open the bottom toolbar and tap the "+" button: a widget catalog opens, which adds a new one ready to configure right away.</p>
          <p>To rearrange the board, turn on <b>edit mode</b> (the lock-shaped button in the toolbar): tiles can then be dragged to change position, and their edges pulled to resize them. Still in edit mode, tapping a tile opens its settings directly — no need to aim for the small gear icon. Outside edit mode, two discreet icons appear on hover or tap on each tile: the gear (tile settings) and the cross (remove it from the board).</p>
          <p>Windows that open on top of the board (reading an email or an RSS article, a tile's settings, help, the catalog…) are also <b>resizable with the mouse</b>, by dragging their bottom-right corner — handy when formatted content needs more width to stay readable. This handle only shows up with a mouse, not in touch mode.</p>

          <h4>The Appearance section, shared by every tile</h4>
          <p>On top of its own settings, every tile has an <b>Appearance</b> section at the very bottom of its config window, always made up of the same options:</p>
          <div class="help-opt"><span class="help-opt-name">Show title</span><span class="help-opt-desc">Shows or hides the title bar at the top of the tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom title</span><span class="help-opt-desc">Replaces the widget's default name with text of your choice (e.g. "Traffic" instead of "Traffic map").</span></div>
          <div class="help-opt"><span class="help-opt-name">Text size</span><span class="help-opt-desc">50% to 200%, on most widgets (absent on the Traffic tile, whose map zoom it would break). Useful to boost readability on an enlarged tile, or conversely to fit more content in by shrinking it. The Quote tile handles its own scale slightly differently — see its dedicated entry further below.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom color</span><span class="help-opt-desc">Replaces the theme's default background color (day/night) with a fixed color for this tile only.</span></div>

          <h4>The Scheduling section, shared by every tile</h4>
          <p>Just below, a <b>Scheduling</b> section lets you make a tile active only on certain days and at certain times — for instance the commute tile only Monday to Friday between 7am and 9am, or the weekend weather on Saturday and Sunday. It is <b>off by default</b>: with no action on your part, nothing changes.</p>
          <p>Outside its window, the tile <b>doesn't disappear</b> — it keeps exactly its spot in the grid (no other tile moves) and simply shows "Paused" along with a reminder of its window. Above all, its widget is <b>actually stopped</b>: it ends its timers and network calls. That's the feature's main benefit for tiles subject to a quota — the Commute tile, for example, no longer eats the TomTom quota at night or on weekends. A paused tile's settings stay accessible as usual, so it can be re-enabled.</p>
          <div class="help-opt"><span class="help-opt-name">Days</span><span class="help-opt-desc">Seven checkboxes. Ticking none means "every day".</span></div>
          <div class="help-opt"><span class="help-opt-name">From / To</span><span class="help-opt-desc">The time window. Leave both empty to filter on days only. A window that ends before it starts (e.g. 22:00 → 06:00) runs overnight; the ticked day is then the day it starts on, so "Friday 22:00 → 06:00" does cover Friday night into Saturday.</span></div>

          <h4>Tile size</h4>
          <p>Each widget defines a minimum and maximum size consistent with what it displays: for instance, the traffic map can't go below a certain size, since its buttons (refresh, zoom) would end up overlapping. Conversely, the slideshow or the league standings accept being enlarged a lot, useful if you increase the text size in a tile's appearance settings. If a tile already placed becomes too small after its constraints are updated, PiBoard automatically restores it to its minimum size on the next load.</p>

          <h4>The dashboard's different areas</h4>
          <ul>
            <li><b>The main board</b> — the grid always visible, the one you see on screen day to day.</li>
            <li><b>The three tile drawers</b> — collapsible panels, opened via a pull tab on the screen's left edge, top edge, or right edge. They let you prepare or store extra tiles without cluttering the main board (for instance tiles used occasionally), and add to the display surface available. Each one can be resized with the mouse or a finger (handle on its open edge) up to 96% of the screen, or up to 100% through the dedicated fields in general settings ("Tile drawers" section). Only one drawer is open at a time: opening one automatically closes whichever was open. A tile added while a drawer is open is placed there directly; otherwise, it joins the main board.</li>
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
          <div class="help-opt"><span class="help-opt-name">+ Ajouter une tuile</span><span class="help-opt-desc">Ouvre le catalogue des widgets disponibles. Touchez-en un pour l'ajouter au tableau (ou au tiroir de tuiles ouvert à ce moment-là) ; ses réglages s'ouvrent aussitôt pour le configurer.</span></div>
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
          <p><u>Section Tiroirs de tuiles</u></p>
          <p>Un champ par tiroir (gauche, haut, droite) donnant sa couverture d'écran en pourcentage — s'applique immédiatement, sans attendre le bouton « Enregistrer » de cette fenêtre. C'est le pendant pratique de la poignée de redimensionnement à la souris sur le bord ouvert de chaque tiroir : celle-ci va jusqu'à 96 % (au-delà, elle sortirait de l'écran et ne serait plus saisissable) ; ces champs permettent d'aller jusqu'à 100 %, ou de corriger la taille si la poignée est difficile à attraper.</p>
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
          <div class="help-opt"><span class="help-opt-name">+ Add a tile</span><span class="help-opt-desc">Opens the catalog of available widgets. Tap one to add it to the board (or to whichever tile drawer is open at that moment); its settings open right away to configure it.</span></div>
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
          <p><u>Tile drawers section</u></p>
          <p>One field per drawer (left, top, right) giving its screen coverage as a percentage — applies immediately, no need to wait for this window's "Save" button. This is the practical counterpart to the mouse resize handle on each drawer's open edge: that handle goes up to 96% (beyond that, it would land off-screen and no longer be reachable); these fields let you go up to 100%, or fix the size if the handle is hard to grab.</p>
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
        fr: "Horloge digitale ou analogique avec la date du jour, le saint du jour en option, et un fond jour/nuit optionnel qui suit le thème solaire du tableau.",
        en: "Digital or analog clock with today's date, an optional French name day, and an optional day/night background that follows the board's sun-based theme."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×5</span>
          <h4>Objectif</h4>
          <p>Afficher l'heure et la date de façon lisible de loin, avec deux styles au choix selon vos goûts ou l'ambiance de la pièce.</p>
          <h4>Possibilités</h4>
          <p>En mode digital, l'heure occupe l'espace disponible et se recalcule automatiquement à chaque redimensionnement de la tuile. Sur une tuile large et basse, placez la date à côté de l'heure plutôt qu'en dessous pour mieux exploiter la largeur. En mode analogique, le cadran se cale automatiquement à gauche et la date à droite dès que celle-ci est affichée — le cadran garde ainsi toute la hauteur de la tuile plutôt que de se la partager avec le texte en dessous. En mode digital, la même bascule s'applique dès qu'un fuseau supplémentaire, le numéro de semaine ou le prochain événement sont activés : l'heure se cale à gauche plutôt que de rester centrée au-dessus d'extras empilés, ce qui la comprimerait et nuirait à sa lisibilité. Le format de la date va du complet (jour de semaine inclus) au court (JJ/MM/AAAA), utile pour libérer de la place sur une petite tuile. Le saint du jour, une tradition française, s'ajoute en option à côté de la date (uniquement quand la langue de l'interface est le français) — sa disposition (en dessous ou côte à côte) bascule automatiquement sur « côte à côte » si la tuile est trop basse pour une 2e ligne, afin de ne jamais faire déborder la tuile. Le fond jour/nuit optionnel donne un repère visuel supplémentaire (par exemple un dégradé sombre la nuit), en suivant automatiquement le même thème solaire que le reste du tableau.</p>
          <p><b>Fuseaux horaires</b> : une liste déroulante complète (tous les fuseaux IANA, regroupés par continent) permet de choisir un fuseau qui remplace celui du système pour l'heure principale affichée — pratique pour plusieurs tuiles Horloge, chacune sur un fuseau différent. Jusqu'à 3 fuseaux secondaires supplémentaires s'affichent en petit dans la même tuile, façon horloge mondiale compacte.</p>
          <p><b>Numéro de semaine</b> : affiché en petit sous la date, selon la convention <b>ISO 8601</b> (norme internationale, la plus courante en Europe) ou une convention <b>simple</b> (semaine 1 = celle qui contient le 1er janvier).</p>
          <p><b>Alarmes</b> : jusqu'à 5 alarmes indépendantes, chacune avec son heure, ses jours (tous les jours, jours ouvrés, ou week-end), son libellé et son son — réutilise le même système d'alerte (flash plein écran + son généré) que le widget Compte à rebours. Un bouton « Arrêter » apparaît directement sur la tuile pendant qu'une alarme sonne, mais <b>toucher ou cliquer n'importe où sur l'écran l'arrête aussi</b> — une pastille le rappelle pendant que l'alarme sonne. Pas de bouton « Repousser », choix assumé. <b>Les alarmes sonnent toujours à l'heure réelle du système</b>, jamais selon un fuseau horaire affiché à titre de référence.</p>
          <p><b>Prochain événement</b> : une ligne compacte alimentée par une adresse de calendrier (.ics) propre à la tuile Horloge, indépendante d'une éventuelle tuile Agenda — la tuile continue ainsi de fonctionner seule, même sans tuile Agenda sur le tableau. Limite à connaître : seuls les événements simples (non récurrents) sont détectés pour l'instant, une réunion hebdomadaire définie par une règle de récurrence n'apparaîtra pas.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Digitale (chiffres) ou analogique (aiguilles).</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les secondes</span><span class="help-opt-desc">Ajoute le décompte des secondes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la date</span><span class="help-opt-desc">Ajoute la date du jour sous ou à côté de l'heure.</span></div>
          <div class="help-opt"><span class="help-opt-name">Format de la date</span><span class="help-opt-desc">Complet, long (sans le jour de semaine), moyen (abrégé), ou court (JJ/MM/AAAA).</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le saint du jour</span><span class="help-opt-desc">Tradition française, visible seulement en français.</span></div>
          <div class="help-opt"><span class="help-opt-name">Disposition du saint du jour</span><span class="help-opt-desc">En dessous de la date, ou côte à côte — bascule automatiquement sur « côte à côte » si la tuile est trop basse.</span></div>
          <div class="help-opt"><span class="help-opt-name">Disposition heure et date</span><span class="help-opt-desc">Uniquement en mode digital avec la date affichée : sous l'heure, ou côte à côte (mieux adapté aux tuiles larges et basses).</span></div>
          <div class="help-opt"><span class="help-opt-name">Fond jour/nuit</span><span class="help-opt-desc">Bascule automatiquement avec le thème du tableau. Tant qu'il est activé, il prend le pas sur la couleur personnalisée définie dans la section Apparence de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Couleur de jour / de nuit</span><span class="help-opt-desc">Les deux couleurs du fond jour/nuit, si celui-ci est activé.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fuseau horaire</span><span class="help-opt-desc">Nom IANA (ex. « America/New_York »). Vide = fuseau du système.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fuseaux supplémentaires 1 à 3</span><span class="help-opt-desc">Libellé + fuseau IANA chacun. Laisser vide pour ne pas utiliser un emplacement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Numéro de semaine</span><span class="help-opt-desc">Affichage et convention (ISO 8601 ou simple).</span></div>
          <div class="help-opt"><span class="help-opt-name">Alarmes 1 à 5</span><span class="help-opt-desc">Chacune : activée, heure, libellé, jours, son.</span></div>
          <div class="help-opt"><span class="help-opt-name">Prochain événement</span><span class="help-opt-desc">Activation, adresse .ics, nombre de jours de recherche à l'avance.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×5</span>
          <h4>Goal</h4>
          <p>Show the time and date legibly from a distance, with two styles to choose from depending on your taste or the room's mood.</p>
          <h4>Possibilities</h4>
          <p>In digital mode, the time fills the available space and automatically recalculates on every tile resize. On a wide, short tile, place the date next to the time rather than below it to make better use of the width. In analog mode, the face automatically sits on the left and the date on the right as soon as the date is shown — the face keeps the tile's full height instead of sharing it with the text below. In digital mode, the same switch happens as soon as an extra time zone, the week number, or the next event is turned on: the time sits on the left rather than staying centered above stacked extras, which would squeeze it and hurt its legibility. The date format ranges from full (weekday included) to short (MM/DD/YYYY), handy for freeing up room on a small tile. The name day, a French tradition, can be added next to the date (only when the interface language is French) — its arrangement (below or side by side) automatically switches to "side by side" when the tile is too short for a 2nd line, so it never overflows the tile. The optional day/night background gives an extra visual cue (e.g. a dark gradient at night), automatically following the same solar theme as the rest of the board.</p>
          <p><b>Time zones</b>: a full drop-down list (every IANA time zone, grouped by continent) lets you pick a zone that replaces the system's for the main displayed time — handy for several Clock tiles, each on a different zone. Up to 3 extra secondary zones show up small in the same tile, for a compact world-clock feel.</p>
          <p><b>Week number</b>: shown small below the date, following either the <b>ISO 8601</b> convention (international standard, most common in Europe) or a <b>simple</b> one (week 1 = the week containing January 1st).</p>
          <p><b>Alarms</b>: up to 5 independent alarms, each with its own time, days (every day, weekdays, or weekend), label and sound — reuses the same alert system (full-screen flash + generated sound) as the Countdown widget. A "Stop" button appears right on the tile while an alarm rings, but <b>tapping or clicking anywhere on the screen also stops it</b> — a chip reminds you of this while it rings. No "Snooze" button, a deliberate choice. <b>Alarms always ring at the system's real time</b>, never according to a time zone shown for reference.</p>
          <p><b>Next event</b>: a compact line fed by a calendar address (.ics) of the Clock tile's own, independent from any Calendar tile — the tile therefore keeps working on its own, even without a Calendar tile on the board. A limit worth knowing: only simple (non-recurring) events are currently detected, a weekly meeting defined via a recurrence rule won't show up.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Digital (numbers) or analog (hands).</span></div>
          <div class="help-opt"><span class="help-opt-name">Show seconds</span><span class="help-opt-desc">Adds the seconds count.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show date</span><span class="help-opt-desc">Adds today's date below or next to the time.</span></div>
          <div class="help-opt"><span class="help-opt-name">Date format</span><span class="help-opt-desc">Full, long (no weekday), medium (abbreviated), or short (MM/DD/YYYY).</span></div>
          <div class="help-opt"><span class="help-opt-name">Show name day</span><span class="help-opt-desc">French tradition, only shown in French.</span></div>
          <div class="help-opt"><span class="help-opt-name">Name day arrangement</span><span class="help-opt-desc">Below the date, or side by side — automatically switches to "side by side" when the tile is too short.</span></div>
          <div class="help-opt"><span class="help-opt-name">Time and date arrangement</span><span class="help-opt-desc">Digital mode with date shown only: below the time, or side by side (better suited to wide, short tiles).</span></div>
          <div class="help-opt"><span class="help-opt-name">Day/night background</span><span class="help-opt-desc">Automatically switches with the board's theme. While enabled, it takes precedence over the custom color set in the tile's Appearance section.</span></div>
          <div class="help-opt"><span class="help-opt-name">Day / night color</span><span class="help-opt-desc">The two colors of the day/night background, if enabled.</span></div>
          <div class="help-opt"><span class="help-opt-name">Time zone</span><span class="help-opt-desc">IANA name (e.g. "America/New_York"). Empty = system time zone.</span></div>
          <div class="help-opt"><span class="help-opt-name">Extra zones 1 to 3</span><span class="help-opt-desc">A label + an IANA zone each. Leave empty to not use a slot.</span></div>
          <div class="help-opt"><span class="help-opt-name">Week number</span><span class="help-opt-desc">Display and convention (ISO 8601 or simple).</span></div>
          <div class="help-opt"><span class="help-opt-name">Alarms 1 to 5</span><span class="help-opt-desc">Each: enabled, time, label, days, sound.</span></div>
          <div class="help-opt"><span class="help-opt-name">Next event</span><span class="help-opt-desc">Toggle, .ics address, how many days ahead to search.</span></div>`
      }
    },

    {
      id: "astronomy",
      group: "tiles",
      title: { fr: "Astronomie", en: "Astronomy" },
      sub: {
        fr: "Phase de lune, prochains passages visibles de l'ISS, et quelles planètes sont visibles ce soir.",
        en: "Moon phase, upcoming visible ISS passes, and which planets are up tonight."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×5 par défaut, de 2×2 à 8×12</span>
          <h4>Objectif</h4>
          <p>Trois informations classiques de l'astronomie amateur réunies dans une seule tuile — la lune est-elle bientôt pleine, la station spatiale passe-t-elle ce soir, et quelles planètes cherchent à repérer dans le ciel.</p>
          <h4>Quatre sections indépendantes</h4>
          <p>Chaque section a sa propre case pour l'afficher ou non — activez celles qui vous intéressent, désactivez le reste.</p>
          <p><b>Lune</b> : une icône représentant fidèlement la forme actuelle du croissant ou de la gibbeuse (dans le bon sens selon l'hémisphère), le nom de la phase, le pourcentage d'éclairement, et les dates des prochaines nouvelle et pleine lunes.</p>
          <p><b>Passages ISS</b> : les prochains survols de la Station spatiale internationale au-dessus de votre position, avec l'heure, la direction (d'où elle apparaît vers où elle disparaît), la durée et la hauteur maximale atteinte dans le ciel. Un passage <b>visible à l'œil nu</b> (station éclairée par le soleil, ciel assez sombre chez vous) est mis en évidence — c'est le réglage par défaut pour ne montrer que ceux qui valent la peine de sortir regarder.</p>
          <p><b>Planètes visibles</b> : Mercure à Saturne actuellement au-dessus de l'horizon, triées de la plus haute (la plus facile à repérer) à la plus basse, avec leur direction et leur magnitude — plus ce nombre est négatif, plus la planète est brillante. Uranus et Neptune peuvent être ajoutées en option, mais aucune des deux n'est visible à l'œil nu (des jumelles au minimum sont nécessaires).</p>
          <p><b>Prochaine éclipse</b> : la prochaine éclipse solaire ou lunaire <b>réellement visible depuis la ville</b> renseignée ci-dessus — pas simplement en cours quelque part sur Terre. Une éclipse solaire ne concerne que l'endroit précis où l'ombre de la Lune touche le sol ; une éclipse lunaire, elle, est théoriquement visible depuis toute la moitié nocturne de la Terre, mais la tuile vérifie que la Lune est bien au-dessus de l'horizon à votre position avant de la retenir. Type (partielle, annulaire, totale…), pourcentage d'obscuration, date et heure du maximum, et un petit <b>compte à rebours</b> discret.</p>
          <h4>D'où viennent les données</h4>
          <p>La phase de lune et la position des planètes sont <b>calculées directement sur le PiBoard</b>, sans aucun appel réseau — aussi fiable qu'une horloge, jamais tributaire d'un service externe. Les passages ISS, eux, exigent des données orbitales à jour (impossibles à calculer à l'avance) et viennent d'un service communautaire gratuit et sans clé, réédition de l'ancienne API open-notify.org dont les prédictions de passage ont fermé — un projet individuel financé par des dons, à garder à l'esprit si cette section venait un jour à ne plus répondre.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Utilisée pour les passages ISS et la direction/hauteur des planètes — les deux dépendent de la position exacte de l'observateur.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la phase de lune / les passages ISS / les planètes visibles / la prochaine éclipse</span><span class="help-opt-desc">Chaque section, activable indépendamment.</span></div>
          <div class="help-opt"><span class="help-opt-name">Passages visibles uniquement</span><span class="help-opt-desc">Activé par défaut. Décochez pour voir tous les passages au-dessus de l'horizon, y compris ceux en plein jour ou dans l'ombre de la Terre.</span></div>
          <div class="help-opt"><span class="help-opt-name">Passages affichés</span><span class="help-opt-desc">De 1 à 10.</span></div>
          <div class="help-opt"><span class="help-opt-name">Inclure Uranus et Neptune</span><span class="help-opt-desc">Désactivé par défaut.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Les trois sections évoluent lentement ; un intervalle long suffit largement.</span></div>`,
        en: `
          <span class="help-size">Size: 4×5 by default, from 2×2 to 8×12</span>
          <h4>Goal</h4>
          <p>Three classic amateur-astronomy facts brought together in a single tile — is the moon nearly full, does the space station pass overhead tonight, and which planets are worth looking for in the sky.</p>
          <h4>Four independent sections</h4>
          <p>Each section has its own checkbox to show it or not — turn on the ones you care about, turn off the rest.</p>
          <p><b>Moon</b>: an icon faithfully depicting the current crescent or gibbous shape (the right way round for your hemisphere), the phase name, the illuminated percentage, and the dates of the next new and full moons.</p>
          <p><b>ISS passes</b>: the International Space Station's upcoming flyovers above your location, with the time, direction (where it appears from and where it disappears to), duration, and the maximum height reached in the sky. A pass that's <b>visible to the naked eye</b> (station sunlit, sky dark enough where you are) is highlighted — the default setting only shows those worth stepping outside for.</p>
          <p><b>Visible planets</b>: Mercury through Saturn currently above the horizon, sorted from highest (easiest to spot) to lowest, with their direction and magnitude — the more negative that number, the brighter the planet. Uranus and Neptune can optionally be added, but neither is visible to the naked eye (at least binoculars are needed).</p>
          <p><b>Next eclipse</b>: the next solar or lunar eclipse <b>actually visible from</b> the city set above — not merely happening somewhere on Earth. A solar eclipse only concerns the exact spot where the Moon's shadow touches the ground; a lunar eclipse is theoretically visible from the whole night half of Earth, but the tile checks the Moon is actually above the horizon at your location before picking it. Type (partial, annular, total…), obscuration percentage, date and time of the peak, and a small, discreet <b>countdown</b>.</p>
          <h4>Where the data comes from</h4>
          <p>Moon phase and planet positions are <b>computed directly on the PiBoard</b>, with no network call at all — as reliable as a clock, never dependent on an outside service. ISS passes, though, need up-to-date orbital data (impossible to compute in advance) and come from a free, keyless community service, a rebuild of the old open-notify.org API whose pass predictions shut down — a solo, donation-funded project, worth keeping in mind should this section ever stop responding one day.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Used for ISS passes and the planets' direction/height — both depend on the observer's exact location.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show moon phase / ISS passes / visible planets / next eclipse</span><span class="help-opt-desc">Each section, independently toggleable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Visible passes only</span><span class="help-opt-desc">On by default. Uncheck to see every pass above the horizon, including daytime ones or ones in Earth's shadow.</span></div>
          <div class="help-opt"><span class="help-opt-name">Passes shown</span><span class="help-opt-desc">From 1 to 10.</span></div>
          <div class="help-opt"><span class="help-opt-name">Include Uranus and Neptune</span><span class="help-opt-desc">Off by default.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">All three sections change slowly; a long interval is plenty.</span></div>`
      }
    },

    {
      id: "iptv",
      group: "tiles",
      title: { fr: "Chaînes TV", en: "TV channels" },
      sub: {
        fr: "Lit une playlist .m3u et diffuse une chaîne dans la tuile.",
        en: "Reads an .m3u playlist and plays a channel in the tile."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 5×4 par défaut, de 3×3 à 12×12</span>
          <h4>Objectif</h4>
          <p>Regarder une chaîne directement sur le tableau, depuis une playlist de chaînes au format <code>.m3u</code> — le format standard que lisent VLC et Kodi.</p>
          <h4>Fonctionnement</h4>
          <p><b>Deux types de playlist sont reconnus automatiquement</b>, sans avoir à choisir un mode :</p>
          <p><b>Xtream Codes</b> — le cas des plateformes IPTV par abonnement (une adresse contenant un identifiant et un mot de passe, typiquement un lien « get.php »). La tuile propose alors une navigation à plusieurs niveaux, comme SmartIPTV ou TiviMate : <b>Direct / Films / Séries</b>, puis les catégories de chaque source (ex. « France HD|OTT »), puis la liste des flux. Une série ajoute un niveau supplémentaire : ses épisodes, regroupés par saison. Le bouton ‹ en haut à gauche remonte d'un niveau.</p>
          <p><b>M3U simple</b> — une playlist statique (ex. les listes en clair du projet IPTV-org). La tuile affiche alors une liste plate, avec un champ de recherche (insensible aux accents) et un filtre par catégorie.</p>
          <p>Dans les deux cas, touchez un flux pour le regarder ; le bouton ☰ ramène à l'endroit exact de la navigation où vous étiez.</p>
          <p><b>Films et séries</b> : certains formats de fichier utilisés par les plateformes IPTV (Matroska/<code>.mkv</code> notamment, très courant) ne se lisent pas nativement dans un navigateur. Un avertissement ⚠ apparaît alors avant la lecture plutôt que de laisser un échec silencieux sans explication.</p>
          <p><b>Pas de son</b> : de nombreuses plateformes IPTV encodent l'audio en AC3 ou DTS (compatibilité avec les box TV et téléviseurs) — des formats qu'<b>aucun navigateur ne sait décoder</b> (restriction de licence), même si la vidéo elle-même se lit sans problème. Le bouton son n'y change rien : il n'y a tout simplement aucun flux audio exploitable qui arrive jusqu'au navigateur. Une pastille ⚠ à côté du bouton son l'indique quand c'est le cas détecté.</p>
          <p><b>Solution : « Mode de compatibilité »</b> (réglage de la tuile, désactivé par défaut), avec deux niveaux :</p>
          <p>« Corriger le son muet uniquement » convertit <i>uniquement la piste audio</i> dans un format lisible, en <b>recopiant la vidéo telle quelle sans la réencoder</b> — c'est ce qui rend l'opération légère : mesuré sur un flux 720p, quelques pour cent d'un cœur seulement.</p>
          <p>« Compatibilité totale » réencode <i>aussi la vidéo</i>, en contournant entièrement le lecteur HLS du navigateur — une opération nettement plus lourde (un vrai réencodage vidéo), mais la seule solution qui reste quand une chaîne échoue encore avec une erreur du navigateur (ex. « aucune source prise en charge ») sans que le codec précisément en cause n'ait pu être identifié.</p>
          <p>Pour les <b>chaînes en direct</b> spécifiquement, ce pipeline est désormais <b>toujours actif</b> (au moins le niveau audio seul), plus seulement en option : les flux en direct sont récupérés en <b>MPEG-TS brut</b> (jamais en playlist HLS), qu'aucun navigateur ne sait lire directement — découvert en examinant le code source d'un lecteur IPTV de référence. Les deux niveaux utilisent automatiquement <b>VLC</b> pour récupérer le flux quand il est installé : certains fournisseurs IPTV rejettent les requêtes directes de ffmpeg seul (confirmé par une erreur 405, reproduite avec VLC natif également jusqu'à la correction de l'extension du flux). Sans VLC installé, les chaînes en direct se replient sur ffmpeg seul, qui reste suffisant pour les fournisseurs sans cette restriction. Pour les <b>films et séries</b>, qui se lisent nativement, ce réglage reste entièrement facultatif.</p>
<p>Autres contreparties communes aux deux modes : le flux transite par le PiBoard au lieu d'aller directement du fournisseur au navigateur, et <b>ffmpeg doit être installé</b> — la commande dépend du système : <code>sudo apt install ffmpeg</code> sur un Raspberry Pi ou un PC Linux, <code>brew install ffmpeg</code> sur macOS, <code>winget install Gyan.FFmpeg</code> sous Windows. PiBoard le cherche automatiquement aux emplacements habituels de chaque système. Sous Windows, l'installeur de PiBoard propose de l'installer pour vous, en une étape facultative — pratique la plus simple, si vous ne l'avez pas déjà fait. S'il reste introuvable, la tuile le dit clairement, avec la commande d'installation adaptée à <i>votre</i> système, plutôt que d'échouer sans explication.</p>'activer que sur les flux effectivement muets.</p>
          <p><b>Rien ne se lance</b> : si le navigateur bloque le démarrage automatique (politique de lecture automatique, fréquent sans interaction préalable), le message « Touchez pour lancer la lecture » qui s'affiche est cliquable — un simple clic ou toucher dessus relance la tentative, cette fois avec l'interaction que le navigateur exigeait.</p>
          <p><b>Films et séries : lecture/pause, avance et retour rapide</b> — les commandes natives du navigateur apparaissent automatiquement pour ce contenu (durée finie, navigable), absentes pour les chaînes en direct où il n'y a rien à avancer ou reculer.</p>
          <p><b>Chaînes en direct : pause et plein écran</b> et chaîne précédente/suivante — pas de barre de progression (rien à avancer/reculer sur du direct), mais mettre en pause reste utile pour figer l'image un instant, et le plein écran fonctionne normalement. Reprendre la lecture relance le direct à l'instant réel, sans rattrapage. Les boutons précédent/suivant naviguent dans la liste complète des chaînes (pas une liste filtrée par une recherche), avec rebouclage aux extrémités — comme une vraie télécommande. Un curseur de volume (pas seulement muet/non-muet) est aussi disponible.</p>
          <p><b>Seule la liste des chaînes transite par le PiBoard</b>, parce que la plupart des hébergeurs de playlist n'autorisent pas la requête directe depuis une page web.</p>
          <p>Les <b>chaînes en direct</b> transitent, elles aussi, par le PiBoard — pas seulement leur liste — qui relaie le manifeste et chaque segment sans les modifier (aucun décodage, aucun réencodage : un simple relais d'octets, avec un en-tête d'autorisation ajouté). C'est nécessaire, pas facultatif : les plateformes IPTV, conçues pour VLC et les box TV, n'envoient jamais l'autorisation que le navigateur exige pour ce type de requête, donc une chaîne en direct ne démarre tout simplement jamais sans ce relais, quelle que soit la plateforme. Les <b>films et séries</b>, eux, sont lus directement par le navigateur sans passer par le Pi — la lecture vidéo native n'est pas soumise à cette même restriction.</p>
          <h4>Performances : à lire avant de s'enthousiasmer</h4>
          <p>C'est la tuile la plus exigeante du tableau. Un Raspberry Pi 4 tient <b>confortablement le 720p</b> ; le 1080p est limite, d'autant qu'il se dispute le processeur avec tout ce qui tourne à côté (cartes, radar, avions…). D'où le réglage « plafond de qualité », laissé sur 720p par défaut.</p>
          <p>Deux conseils qui changent tout : utilisez la <b>planification par tuile</b> (réglages universels de la tuile) pour qu'elle ne tourne pas 24 h/24, et sachez que quitter la tuile arrête réellement le flux — rien ne continue en arrière-plan.</p>
          <p>À noter, contre-intuitif : cette tuile tourne <b>mieux sur le Raspberry Pi que dans l'application Windows</b>, l'environnement Electron de cette dernière retombant souvent sur un décodage logiciel là où le Chromium du Pi utilise le décodage matériel.</p>
          <h4>Où trouver une playlist</h4>
          <p>N'importe quelle playlist M3U standard à laquelle vous avez légitimement accès. Le projet <b>IPTV-org</b> (iptv-org.github.io) publie de vastes playlists de chaînes en clair, organisées par pays, langue et catégorie — un bon point de départ.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Adresse de la playlist</span><span class="help-opt-desc">L'URL du fichier .m3u.</span></div>
          <div class="help-opt"><span class="help-opt-name">Catégorie affichée à l'ouverture</span><span class="help-opt-desc">Facultatif. Évite de faire défiler une longue liste à chaque fois.</span></div>
          <div class="help-opt"><span class="help-opt-name">Reprendre automatiquement la dernière chaîne</span><span class="help-opt-desc">Désactivé par défaut : une tuile qui se met à diffuser toute seule sur un écran mural est rarement souhaitable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Démarrer sans le son</span><span class="help-opt-desc">Activé par défaut. Les navigateurs refusent de toute façon de démarrer une vidéo sonore sans interaction préalable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Plafond de qualité</span><span class="help-opt-desc">720p recommandé sur un Pi.</span></div>`,
        en: `
          <span class="help-size">Size: 5×4 by default, from 3×3 to 12×12</span>
          <h4>Goal</h4>
          <p>Watch a channel straight from the board, from a channel playlist in <code>.m3u</code> format — the standard format VLC and Kodi read.</p>
          <h4>How it works</h4>
          <p><b>Two playlist types are recognized automatically</b>, no need to pick a mode:</p>
          <p><b>Xtream Codes</b> — subscription IPTV platforms (an address containing a username and password, typically a "get.php" link). The tile then offers multi-level navigation, like SmartIPTV or TiviMate: <b>Live / Movies / Series</b>, then each source's categories (e.g. "France HD|OTT"), then the stream list. A series adds one more level: its episodes, grouped by season. The ‹ button top-left goes back one level.</p>
          <p><b>Plain M3U</b> — a static playlist (e.g. the IPTV-org project's free-to-air lists). The tile then shows a flat list, with a search box (accent-insensitive) and a category filter.</p>
          <p>Either way, tap a stream to watch it; the ☰ button returns to the exact spot in the navigation you were at.</p>
          <p><b>Movies and series</b>: some file formats used by IPTV platforms (Matroska/<code>.mkv</code> in particular, very common) don't play natively in a browser. A ⚠ warning shows up before playback rather than a silent, unexplained failure.</p>
          <p><b>No sound</b>: many IPTV platforms encode audio in AC3 or DTS (compatibility with set-top boxes and TVs) — formats <b>no browser can decode</b> (a licensing restriction), even though the video itself plays fine. The sound button changes nothing about that: there simply is no usable audio stream reaching the browser. A ⚠ badge next to the sound button flags it when this is detected.</p>
          <p><b>Solution: "Compatibility mode"</b> (a tile setting, off by default), with two levels:</p>
          <p>"Fix silent sound only" converts <i>only the audio track</i> into a readable format, <b>copying the video as-is without re-encoding it</b> — that's what keeps the operation light: measured on a 720p stream, just a few percent of one core.</p>
          <p>"Full compatibility" also re-encodes <i>the video itself</i>, entirely bypassing the browser's HLS player — a noticeably heavier operation (a genuine video re-encode), but the only solution left when a channel still fails with a browser error (e.g. "no supported sources") without the exact codec at fault having been identifiable.</p>
          <p>For <b>live channels</b> specifically, this pipeline is now <b>always active</b> (at least the audio-only level), not just optional anymore: live streams are fetched as <b>raw MPEG-TS</b> (never an HLS playlist), which no browser can read directly — found by examining a reference IPTV player's source code. Both levels automatically use <b>VLC</b> to fetch the stream when it's installed: some IPTV providers reject direct requests from ffmpeg alone (confirmed via a 405 error, reproduced with native VLC too until the stream extension fix). Without VLC installed, live channels fall back to ffmpeg alone, which stays sufficient for providers without this restriction. For <b>movies and series</b>, which play natively, this setting stays entirely optional.</p>
<p>Other trade-offs common to both modes: the stream transits through the PiBoard instead of going straight from the provider to the browser, and <b>ffmpeg must be installed</b> — the command depends on the system: <code>sudo apt install ffmpeg</code> on a Raspberry Pi or Linux PC, <code>brew install ffmpeg</code> on macOS, <code>winget install Gyan.FFmpeg</code> on Windows. PiBoard looks for it automatically in each system's usual locations. On Windows, PiBoard's installer offers to install it for you, as an optional step — the simplest path, if you haven't already. If it still can't be found, the tile says so clearly, with the install command matching <i>your</i> system, rather than failing without explanation.</p>y enable it on streams that are actually silent.</p>
          <p><b>Nothing starts</b>: if the browser blocks automatic startup (autoplay policy, common without prior interaction), the "Tap to start playback" message that shows up is clickable — a simple tap or click on it retries, this time with the interaction the browser was asking for.</p>
          <p><b>Movies and series: play/pause, fast-forward and rewind</b> — the browser's native controls appear automatically for this content (finite, seekable duration), absent for live channels where there's nothing to seek through.</p>
          <p><b>Live channels: pause and fullscreen</b> and previous/next channel — no progress bar (nothing to seek through on live), but pausing still helps freeze the image for a moment, and fullscreen works normally. Resuming restarts live at the real current time, with no catch-up. The previous/next buttons navigate the full channel list (not one filtered by a search), wrapping at the ends — like a real remote. A volume slider (not just mute/unmute) is also available.</p>
          <p><b>Only the channel list goes through the PiBoard</b>, because most playlist hosts don't allow a direct request from a web page.</p>
          <p><b>Live channels</b> also go through the PiBoard — not just their list — which relays the manifest and every segment unmodified (no decoding, no re-encoding: a plain byte relay, with an authorization header added). This is necessary, not optional: IPTV platforms, built for VLC and set-top boxes, never send the authorization the browser requires for this kind of request, so a live channel simply never starts without this relay, on any platform. <b>Movies and series</b>, on the other hand, are read directly by the browser without going through the Pi — native video playback isn't subject to that same restriction.</p>
          <h4>Performance: read this before getting excited</h4>
          <p>This is the most demanding tile on the board. A Raspberry Pi 4 handles <b>720p comfortably</b>; 1080p is borderline, all the more so as it competes for CPU with everything running alongside (maps, radar, planes…). Hence the "quality cap" setting, left at 720p by default.</p>
          <p>Two tips that make all the difference: use <b>per-tile scheduling</b> (the tile's universal settings) so it doesn't run around the clock, and note that leaving the tile genuinely stops the stream — nothing keeps running in the background.</p>
          <p>Worth noting, counter-intuitively: this tile runs <b>better on the Raspberry Pi than in the Windows app</b>, the latter's Electron environment often falling back to software decoding where the Pi's Chromium uses hardware decoding.</p>
          <h4>Where to find a playlist</h4>
          <p>Any standard M3U playlist you have legitimate access to. The <b>IPTV-org</b> project (iptv-org.github.io) publishes large free-to-air playlists organized by country, language and category — a good starting point.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Playlist address</span><span class="help-opt-desc">The .m3u file's URL.</span></div>
          <div class="help-opt"><span class="help-opt-name">Category shown on opening</span><span class="help-opt-desc">Optional. Avoids scrolling a long list every time.</span></div>
          <div class="help-opt"><span class="help-opt-name">Resume the last channel automatically</span><span class="help-opt-desc">Off by default: a tile that starts playing on its own on a wall display is rarely what you want.</span></div>
          <div class="help-opt"><span class="help-opt-name">Start muted</span><span class="help-opt-desc">On by default. Browsers refuse to start a video with sound without prior interaction anyway.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quality cap</span><span class="help-opt-desc">720p recommended on a Pi.</span></div>`
      }
    },

    {
      id: "calendar",
      group: "tiles",
      title: { fr: "Agenda", en: "Calendar" },
      sub: {
        fr: "Fusionne plusieurs calendriers iCal (.ics) en une seule tuile, chacun dans sa propre couleur — Google Agenda, iCloud/iPhone, Nextcloud, Outlook, ou tout calendrier avec un lien ICS public.",
        en: "Merges several iCal (.ics) calendars into a single tile, each in its own color — Google Calendar, iCloud/iPhone, Nextcloud, Outlook, or any calendar with a public ICS link."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×4 par défaut, de 2×2 à 8×8</span>
          <h4>Objectif</h4>
          <p>Voir d'un coup d'œil les prochains événements de toute la famille, sans ouvrir une application de calendrier.</p>
          <h4>Possibilités</h4>
          <p>Chaque ligne du champ « Calendriers » est une source ICS distincte, fusionnée avec les autres et distinguée par une couleur attribuée automatiquement dans l'ordre des lignes ; une légende apparaît en bas de la tuile dès que plusieurs calendriers sont configurés. Deux vues restent accessibles en un geste directement sur la tuile (onglets), sans passer par les réglages : la liste des prochains événements groupés par jour, ou une grille de la semaine façon calendrier mural avec la colonne du jour mise en évidence. Les événements récurrents sont gérés (quotidien, hebdomadaire, mensuel — y compris « 2e lundi du mois » —, annuel), de même que les occurrences uniques déplacées ou annulées.</p>
          <h4>Ajouter un calendrier iPhone / iCloud</h4>
          <p>Dans l'app Calendrier : appuyez sur un calendrier → <b>Partager le calendrier</b> → <b>Calendrier public</b> → <b>Copier le lien</b>. Le lien commence par <code>webcal://</code> : PiBoard le convertit automatiquement, collez-le tel quel.</p>
          <p>Pour <b>Google Agenda</b> : réglages du calendrier → « Intégrer l'agenda » → « Adresse secrète au format iCal ». Pour <b>Nextcloud</b> ou <b>Outlook</b> : utilisez leur lien de partage public/ICS du calendrier.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Calendriers</span><span class="help-opt-desc">Un lien ICS par ligne, avec un libellé optionnel après un <code>|</code> (ex. <code>https://exemple.com/famille.ics|Famille</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Vue par défaut</span><span class="help-opt-desc">Liste ou grille semaine — les deux restent accessibles en un geste sur la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Vue liste : jours à venir</span><span class="help-opt-desc">Fenêtre de la vue liste, en jours.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les événements toute la journée</span><span class="help-opt-desc">Anniversaires, jours fériés, etc.</span></div>
          <div class="help-opt"><span class="help-opt-name">La semaine commence le lundi</span><span class="help-opt-desc">Sinon, dimanche.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux relectures des calendriers.</span></div>`,
        en: `
          <span class="help-size">Size: 4×4 by default, from 2×2 to 8×8</span>
          <h4>Goal</h4>
          <p>See the whole family's upcoming events at a glance, without opening a calendar app.</p>
          <h4>Possibilities</h4>
          <p>Each line in the "Calendars" field is a separate ICS source, merged with the others and told apart by a color assigned automatically in line order; a legend appears at the bottom of the tile once more than one calendar is configured. Two views stay one tap away right on the tile (tabs), no need to open settings: an upcoming-events list grouped by day, or a week grid in a wall-calendar style with today's column highlighted. Recurring events are handled (daily, weekly, monthly — including "2nd Monday of the month" —, yearly), as well as single moved or cancelled occurrences.</p>
          <h4>Adding an iPhone / iCloud calendar</h4>
          <p>In the Calendar app: tap a calendar → <b>Share Calendar</b> → <b>Public Calendar</b> → <b>Copy Link</b>. The link starts with <code>webcal://</code>: PiBoard converts it automatically, paste it as is.</p>
          <p>For <b>Google Calendar</b>: calendar settings → "Integrate calendar" → "Secret address in iCal format". For <b>Nextcloud</b> or <b>Outlook</b>: use their calendar's public/ICS sharing link.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Calendars</span><span class="help-opt-desc">One ICS link per line, with an optional label after a <code>|</code> (e.g. <code>https://example.com/family.ics|Family</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Default view</span><span class="help-opt-desc">List or week grid — both stay one tap away on the tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">List view: days ahead</span><span class="help-opt-desc">The list view's window, in days.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show all-day events</span><span class="help-opt-desc">Birthdays, public holidays, etc.</span></div>
          <div class="help-opt"><span class="help-opt-name">Week starts on Monday</span><span class="help-opt-desc">Otherwise, Sunday.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two calendar reads.</span></div>`
      }
    },

    {
      id: "commute",
      group: "tiles",
      title: { fr: "Trajet domicile-travail", en: "Commute time" },
      sub: {
        fr: "Temps de trajet en voiture en direct entre deux adresses via l'API Routing de TomTom (même clé que la tuile Trafic), avec trafic réel, comparaison au temps habituel, alerte colorée, et heure de départ conseillée — plus jusqu'à 5 trajets supplémentaires, chacun avec le même traitement.",
        en: "Live driving times between two addresses via TomTom's Routing API (same key as the Traffic tile), with real traffic, a comparison to the usual time, a colored alert, and a suggested departure time — plus up to 5 extra trips, each with the same treatment."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×4</span>
          <h4>Objectif</h4>
          <p>Savoir d'un coup d'œil combien de temps il faut actuellement pour rejoindre le travail (ou tout autre trajet régulier) — avec le trafic réel du moment, pas une estimation théorique — et à quelle heure partir pour arriver à l'heure voulue.</p>
          <h4>Possibilités</h4>
          <p>Renseignez une adresse A (typiquement le domicile) et une adresse B (le travail) : la tuile affiche le temps estimé A→B, B→A, ou les deux, calculé par TomTom en tenant compte du trafic réel du moment. À côté de la durée, un retard coloré compare ce temps au temps habituel pour ce jour et cette heure (vert à l'heure, orange retard modéré, rouge fort retard — seuils réglables) — par exemple « 25 min (+10 min) ». Si vous renseignez une heure d'arrivée souhaitée pour un trajet, TomTom calcule le trajet en tenant compte du trafic <i>prévu</i> à ce moment futur et une heure de départ conseillée apparaît sous la durée ; sans heure d'arrivée renseignée, la tuile affiche simplement le temps en direct, maintenant. Au-delà de ce trajet principal, jusqu'à 5 trajets supplémentaires peuvent être ajoutés — par exemple « Chez Maman », « Chez Papa », « École de Léo » — chacun calculé depuis l'adresse A vers sa propre destination, avec sa propre heure d'arrivée souhaitée optionnelle. Avec plusieurs trajets, la disposition empilée (un par ligne) reste lisible même sur une tuile étroite ; la disposition côte à côte convient mieux à un trajet unique sur une tuile large. Le géocodage des adresses reste gratuit (OpenStreetMap Nominatim) ; seul le calcul d'itinéraire passe par TomTom.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Adresse A / Adresse B</span><span class="help-opt-desc">Les deux extrémités du trajet principal. Propose des suggestions cliquables pendant la saisie (recherche après une courte pause, comme la recherche de ville des paramètres généraux) : cliquer une suggestion remplit le champ avec l'adresse complète telle que comprise — plus besoin de taper une adresse parfaitement formée, ni d'attendre un « itinéraire indisponible » pour savoir si l'adresse posait problème.</span></div>
          <div class="help-opt"><span class="help-opt-name">Clé API TomTom</span><span class="help-opt-desc">La même clé gratuite que la tuile Trafic (developer.tomtom.com). Cette tuile a son propre compteur de quota quotidien, affiché en petit sur la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Sens affiché</span><span class="help-opt-desc">A→B, B→A, ou les deux.</span></div>
          <div class="help-opt"><span class="help-opt-name">Heure d'arrivée souhaitée (A→B / B→A)</span><span class="help-opt-desc">Optionnel. Une fois renseignée, une heure de départ conseillée apparaît, calculée avec le trafic prévu pour cette heure.</span></div>
          <div class="help-opt"><span class="help-opt-name">Disposition des trajets</span><span class="help-opt-desc">Côte à côte (tuiles larges) ou empilés (tuiles hautes/étroites, ou plusieurs trajets supplémentaires).</span></div>
          <div class="help-opt"><span class="help-opt-name">Seuils de retard modéré / fort</span><span class="help-opt-desc">En minutes de retard par rapport au temps habituel, au-delà desquels la durée passe à l'orange puis au rouge.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux recalculs. Chaque rafraîchissement peut déclencher plusieurs requêtes TomTom (une par trajet actif).</span></div>
          <div class="help-opt"><span class="help-opt-name">Trajets supplémentaires 1 à 5</span><span class="help-opt-desc">Chacun avec un nom, une adresse de destination (mêmes suggestions cliquables que ci-dessus), et sa propre heure d'arrivée souhaitée optionnelle. Un emplacement sans nom ou sans adresse est simplement ignoré ; l'échec du calcul d'un trajet n'empêche pas l'affichage des autres.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 6×4</span>
          <h4>Goal</h4>
          <p>Know at a glance how long it currently takes to get to work (or any other regular trip) — with the real traffic of the moment, not a theoretical estimate — and when to leave to arrive on time.</p>
          <h4>Possibilities</h4>
          <p>Enter an address A (typically home) and an address B (work): the tile shows the estimated time A→B, B→A, or both, computed by TomTom accounting for the moment's real traffic. Next to the duration, a colored delay compares this time to the usual time for that day and hour (green on time, orange moderate delay, red heavy delay — adjustable thresholds) — for example "25 min (+10 min)". If you set a desired arrival time for a trip, TomTom computes it accounting for the traffic <i>predicted</i> at that future moment, and a suggested departure time appears below the duration; without a desired arrival time, the tile simply shows the live time, right now. Beyond this main trip, up to 5 extra trips can be added — for instance "Mom's place", "Dad's place", "Leo's school" — each computed from address A to its own destination, with its own optional desired arrival time. With several trips, the stacked layout (one per line) stays readable even on a narrow tile; the side-by-side layout suits a single trip on a wide tile better. Address geocoding stays free (OpenStreetMap Nominatim); only route computation goes through TomTom.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Address A / Address B</span><span class="help-opt-desc">The two ends of the main trip. Offers clickable suggestions as you type (searches after a short pause, like the general settings' city search): clicking a suggestion fills the field with the full address as understood — no need to type a perfectly-formed address, or wait for a "route unavailable" message to find out the address itself was the problem.</span></div>
          <div class="help-opt"><span class="help-opt-name">TomTom API key</span><span class="help-opt-desc">The same free key as the Traffic tile (developer.tomtom.com). This tile has its own daily quota counter, shown small on the tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Direction shown</span><span class="help-opt-desc">A→B, B→A, or both.</span></div>
          <div class="help-opt"><span class="help-opt-name">Desired arrival time (A→B / B→A)</span><span class="help-opt-desc">Optional. Once set, a suggested departure time appears, computed with predicted traffic for that hour.</span></div>
          <div class="help-opt"><span class="help-opt-name">Trip arrangement</span><span class="help-opt-desc">Side by side (wide tiles) or stacked (tall/narrow tiles, or several extra trips).</span></div>
          <div class="help-opt"><span class="help-opt-name">Moderate / heavy delay thresholds</span><span class="help-opt-desc">In minutes of delay versus the usual time, beyond which the duration turns orange then red.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two recalculations. Each refresh can trigger several TomTom requests (one per active trip).</span></div>
          <div class="help-opt"><span class="help-opt-name">Extra trips 1 to 5</span><span class="help-opt-desc">Each with a name, a destination address (same clickable suggestions as above), and its own optional desired arrival time. A slot with no name or no address is simply skipped; a failed trip calculation doesn't prevent the others from showing.</span></div>`
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
          <p>Deux modes : « Compte à rebours vers une date » (par exemple le 25 décembre, ou le début des vacances) affiche en continu le temps restant ; « Minuteur » fonctionne comme un chronomètre classique démarrable/pausable/réinitialisable pour une durée choisie (utile pour une cuisson, un temps de pause, un jeu). À la fin, une alerte se déclenche — flash plein écran et/ou son au choix parmi plusieurs sons synthétisés (donc aucun fichier audio, fonctionne hors-ligne) — et dure jusqu'à une minute. Pour l'arrêter avant terme : le bouton « Arrêter » sur la tuile, ou <b>toucher/cliquer n'importe où sur l'écran</b> (une pastille le rappelle pendant que l'alerte est active). Le webhook de notification permet de relayer la fin du compte à rebours vers un service externe (par exemple déclencher une notification SMS, une annonce sur une enceinte Alexa, ou une alerte push sur votre téléphone) via une simple requête HTTP GET ou POST.</p>
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
          <p>Two modes: "Countdown to a date" (e.g. December 25th, or the start of vacation) continuously shows the remaining time; "Timer" works like a classic stopwatch that can be started/paused/reset for a chosen duration (handy for cooking, a break, a game). At the end, an alert fires — full-screen flash and/or a sound chosen among several synthesized sounds (so no audio file, works offline) — lasting up to a minute. To stop it early: the tile's "Stop" button, or <b>tap/click anywhere on the screen</b> (a chip reminds you of this while the alert is active). The notification webhook lets you relay the countdown's end to an external service (e.g. trigger an SMS notification, an announcement on an Alexa speaker, or a push alert on your phone) via a simple HTTP GET or POST request.</p>
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
        fr: "Combine jusqu'à 3 flux RSS ou Atom dans la même tuile, chaque article étiqueté de sa source. Les articles pourvus d'un lien s'ouvrent dans une popup de lecture.",
        en: "Combines up to 3 RSS or Atom feeds in the same tile, each article tagged with its source. Articles with a link open in a reading popup."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×3 par défaut, de 2×2 à 12×8</span>
          <h4>Objectif</h4>
          <p>Suivre l'actualité d'un site (presse généraliste, blog, journal local…) directement sur le tableau, sans jamais avoir à ouvrir un navigateur.</p>
          <h4>Possibilités</h4>
          <p><b>Jusqu'à 3 flux peuvent être combinés dans la même tuile</b>, fusionnés en une seule liste triée par ordre chronologique — le plus récent en premier, quel que soit le flux d'origine. Un flux en panne n'empêche pas les autres de s'afficher. Avec un seul flux configuré, la tuile affiche son nom en en-tête, comme avant. Dès qu'un 2e flux est ajouté, chaque article porte à la place une petite étiquette indiquant sa source — le libellé court renseigné dans les réglages s'il y en a un (recommandé : le titre d'un flux est souvent bien trop long pour tenir sur une étiquette), sinon le titre du flux lui-même.</p>
          <p>Fonctionne avec n'importe quel flux RSS ou Atom classique — la plupart des sites d'actualité en proposent un, parfois affiché comme un lien orange discret en bas de page. Si le nombre d'articles configuré dépasse la place disponible sur la tuile, la liste devient défilante (au doigt ou à la souris) plutôt que de couper les derniers titres. Le mode rotation affiche un article à la fois en plein cadre, en alternance automatique — plus lisible de loin pour un flux qu'on veut simplement voir défiler passivement. Un article pourvu d'un lien dans le flux (repéré automatiquement) est cliquable : le toucher ouvre une popup — redimensionnable à la souris si besoin de plus de largeur — qui tente de récupérer le texte complet de l'article directement depuis la page liée — un « mode lecture », comme celui d'un navigateur, qui isole le texte de l'article et écarte publicités, menus et colonnes latérales. La plupart des flux ne fournissent en effet qu'un court résumé, pas l'article entier. Une deuxième tentative avec un identifiant de navigateur standard est faite automatiquement si la première (honnête, identifiée comme PiBoard) est bloquée — de nombreux sites bloquent purement et simplement tout ce qui ne ressemble pas à un navigateur, y compris des lecteurs RSS parfaitement légitimes. Face à un accès refusé (paywall d'abonnement OU protection anti-robot — les deux se confondent en pratique : certains sites, dont Le Monde, renvoient littéralement « Votre trafic a été identifié comme automatisé » avec un code de statut de paywall), le contenu réellement reçu est affiché tel quel — souvent un aperçu partiel (les premiers paragraphes) — avec une bannière qui le précise, pour ne pas laisser croire au texte intégral. Si rien d'exploitable n'est reçu, un message honnête l'indique, sans affirmer une cause précise puisqu'elle n'est pas toujours connue avec certitude. PiBoard ne tente jamais de contourner ni un paywall ni une protection anti-robot — ni connexion, ni cache alternatif, ni défaite du JavaScript ou de la vérification qui bloque l'accès. Sans indication précise du site, une mention plus générale s'affiche si le résumé du flux est lui-même très pauvre en texte (souvent une simple image), pour ne pas laisser croire à une fonctionnalité cassée. La photo éventuellement associée à l'article dans le flux (légende et crédit photo inclus, quand fournis) est affichée en tête de la popup, quelle que soit la source du texte. Les articles sans lien restent de simples lignes de texte.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">URL du flux</span><span class="help-opt-desc">L'adresse du fichier RSS/Atom (souvent en <code>.xml</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Flux 1 : étiquette courte</span><span class="help-opt-desc">Facultatif, utilisé seulement dès qu'un 2e flux est ajouté.</span></div>
          <div class="help-opt"><span class="help-opt-name">Flux 2 et 3 : adresse + étiquette</span><span class="help-opt-desc">Facultatifs. Laisser l'adresse vide pour ne pas utiliser un emplacement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre max d'articles</span><span class="help-opt-desc">Combien de titres afficher au maximum.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rotation automatique</span><span class="help-opt-desc">Alterne un article à la fois plutôt que d'afficher toute la liste.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la source</span><span class="help-opt-desc">Avec un seul flux : son nom en en-tête. Avec plusieurs flux combinés : une étiquette à côté de chaque article à la place.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux relectures du flux.</span></div>`,
        en: `
          <span class="help-size">Size: 4×3 by default, from 2×2 to 12×8</span>
          <h4>Goal</h4>
          <p>Follow a site's news (general press, blog, local paper…) directly on the board, without ever needing to open a browser.</p>
          <h4>Possibilities</h4>
          <p><b>Up to 3 feeds can be combined in the same tile</b>, merged into a single list sorted in chronological order — most recent first, whichever feed it came from. A feed that's down doesn't prevent the others from showing. With a single feed configured, the tile shows its name as a header, as before. As soon as a 2nd feed is added, each article carries a small tag stating its source instead — the short label set in the settings if there is one (recommended: a feed's own title is often far too long to fit on a tag), otherwise the feed's title itself.</p>
          <p>Works with any standard RSS or Atom feed — most news sites offer one, sometimes shown as a discreet orange link at the bottom of the page. If the configured number of articles exceeds the tile's available space, the list becomes scrollable (finger or mouse) instead of cutting off the latest headlines. Rotation mode shows one article at a time full-frame, alternating automatically — more readable from a distance for a feed you just want to watch passively scroll by. An article with a link in the feed (detected automatically) is clickable: tapping it opens a popup — resizable with the mouse if it needs more width — that attempts to fetch the article's full text directly from the linked page — a "reader mode", like a browser's, which isolates the article text and discards ads, menus and sidebars. Most feeds only provide a short summary, not the full article. A second attempt with a standard browser identifier is made automatically if the first one (honest, identified as PiBoard) gets blocked — many sites simply block anything that doesn't look like a browser, including perfectly legitimate RSS readers. Facing denied access (a subscription paywall OR anti-bot protection — the two blur together in practice: some sites, including Le Monde, literally return "Your traffic has been identified as automated" with a paywall-style status code), whatever content is actually received gets shown as-is — often a partial preview (the first paragraphs) — with a banner stating so, so it doesn't look like the full text. If nothing usable comes back at all, an honest message says so, without asserting a specific cause since it isn't always known for certain. PiBoard never attempts to bypass either a paywall or anti-bot protection — no login, no alternate cache, no defeating the JavaScript or check that blocks access. Without a specific signal from the site, a more general note shows up if the feed's own summary is itself very thin on text (often just an image), so it doesn't look like a broken feature. The photo the feed may associate with the article (caption and photo credit included, when provided) is shown at the top of the popup, whichever text source is used. Articles without a link stay plain text lines.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Feed URL</span><span class="help-opt-desc">The RSS/Atom file's address (often ending in <code>.xml</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Feed 1: short tag</span><span class="help-opt-desc">Optional, only used once a 2nd feed is added.</span></div>
          <div class="help-opt"><span class="help-opt-name">Feed 2 and 3: address + tag</span><span class="help-opt-desc">Optional. Leave the address empty to not use a slot.</span></div>
          <div class="help-opt"><span class="help-opt-name">Max items</span><span class="help-opt-desc">How many headlines to show at most.</span></div>
          <div class="help-opt"><span class="help-opt-name">Auto-rotate</span><span class="help-opt-desc">Alternates one article at a time rather than showing the whole list.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show source</span><span class="help-opt-desc">With a single feed: its name as a header. With several feeds combined: a tag next to each article instead.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two feed reads.</span></div>`
      }
    },

    {
      id: "mailbox",
      group: "tiles",
      title: { fr: "Courriel", en: "Mailbox" },
      sub: {
        fr: "Les derniers messages d'une boîte IMAP — objet, expéditeur, date — et la lecture au clic, comme la tuile Flux RSS.",
        en: "The latest messages from an IMAP mailbox — subject, sender, date — and reading on tap, like the RSS feed tile."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×4 par défaut, de 2×2 à 8×10</span>
          <h4>Objectif</h4>
          <p>Voir d'un coup d'œil ce qui est arrivé dans une boîte aux lettres, sans sortir son téléphone — et pouvoir lire un message directement sur le tableau si l'objet donne envie.</p>
          <h4>Possibilités</h4>
          <p>La tuile n'affiche que l'essentiel : objet, expéditeur et date, les non-lus signalés par une pastille et un objet en gras. Toucher un message ouvre une popup de lecture, exactement comme pour un article de flux RSS — <b>redimensionnable à la souris</b> (coin bas-droit) si un message mis en forme a besoin de plus de largeur pour rester lisible. Vous choisissez combien de messages afficher, quel dossier surveiller (la boîte de réception par défaut), et pouvez n'afficher que les non-lus. Un bouton « Recharger » en haut de la tuile permet de relancer un relevé immédiatement, sans attendre le prochain rafraîchissement automatique.</p>
          <p><b>Rien n'est stocké sur le PiBoard.</b> Chaque affichage ouvre une connexion au serveur, lit ce qu'il faut, et referme — aucun message, aucune pièce jointe n'est écrit sur le disque. L'accès est aussi <b>strictement en lecture seule</b> : consulter un message ici ne le marque jamais comme lu sur votre téléphone ou votre ordinateur, et n'en déplace ni n'en supprime aucun.</p>
          <p>Le contenu des messages est <b>désinfecté avant affichage</b> : les scripts sont toujours retirés, sans réglage possible — rien à y gagner. Deux comportements restent en revanche réglables, chacun impliquant un vrai compromis sécurité/confort :</p>
          <p>Les <b>liens restent cliquables</b> et s'ouvrent dans le navigateur, mais assainis : seuls les liens web et de messagerie fonctionnent (un lien <code>javascript:</code> est neutralisé, son texte restant visible), et le <b>domaine réel de destination est affiché juste après le lien</b>. C'est utile : un courriel d'hameçonnage affiche volontiers « votre-banque.fr » tout en pointant ailleurs — voir la vraie destination avant de toucher permet de le repérer, sans empêcher les liens légitimes de fonctionner. Sur le Raspberry Pi en mode kiosque, un lien ouvre un nouvel onglet Chromium : sans barre d'onglets, le retour au tableau demande de fermer cet onglet (par exemple avec <code>Ctrl+W</code> au clavier, ou en redémarrant le kiosque). Sur l'application Windows, le lien s'ouvre directement dans votre navigateur habituel, sans quitter PiBoard.</p>
          <div class="help-opt"><span class="help-opt-name">Liens cliquables</span><span class="help-opt-desc">Activé par défaut. Les liens s'ouvrent dans le navigateur, avec le domaine réel de destination affiché à côté — utile pour repérer un lien d'hameçonnage au texte trompeur avant de toucher. Désactivez pour afficher les liens en texte simple, non cliquable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les images distantes</span><span class="help-opt-desc">Désactivé par défaut : une simple image distante de 1×1 suffit à confirmer à l'expéditeur que le message a été ouvert (c'est le principe d'un pixel espion). Les images déjà intégrées au message (un logo, une signature) s'affichent toujours, quel que soit ce réglage — elles ne chargent rien depuis l'extérieur. Quand des images sont masquées, un bouton « Afficher les images de ce message » apparaît directement dans le message ouvert — pas besoin de chercher ce réglage pour les voir ponctuellement ; il ne modifie que cette lecture, pas le réglage général.</span></div>

          <h4>Compatibilité</h4>
          <p>Fonctionne avec free.fr, Orange, OVH, SFR, La Poste, et tout serveur IMAP standard. Pour <b>Gmail, Yahoo et iCloud</b>, il faut créer un « mot de passe d'application » dans les réglages de sécurité du compte — leur mot de passe principal est refusé par ces fournisseurs.</p>
          <p><b>Les comptes Outlook.com et Hotmail personnels ne fonctionnent pas.</b> Microsoft y a définitivement désactivé l'authentification par mot de passe, et n'y propose pas de mot de passe d'application (contrairement aux comptes professionnels). Seul le protocole OAuth2 permettrait de s'y connecter — il n'est pas encore pris en charge.</p>
          <h4>À propos du mot de passe</h4>
          <p>Il est conservé <b>chiffré, dans un fichier distinct des réglages de la tuile</b> : il ne se retrouve donc jamais dans une sauvegarde de disposition, une configuration enregistrée réutilisable, ou un partage de configuration. Le champ reste vide à la réouverture des réglages (une mention indique qu'un mot de passe est enregistré) et le serveur ne le renvoie jamais au navigateur. Supprimer la tuile efface aussi le mot de passe.</p>
          <p>Soyons clairs sur les limites : la clé de chiffrement vit sur le même Pi que le coffre. Quelqu'un ayant un accès complet à la machine peut donc tout déchiffrer — la protection porte sur les fuites courantes (sauvegarde copiée ailleurs, fichier partagé par erreur), pas sur un accès physique ou administrateur. C'est aussi pourquoi un mot de passe d'application est préférable quand c'est possible : il se révoque tout seul, sans toucher au compte principal.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Fournisseur</span><span class="help-opt-desc">Un raccourci qui remplit l'adresse du serveur. Laissez vide et saisissez l'adresse pour tout autre fournisseur.</span></div>
          <div class="help-opt"><span class="help-opt-name">Serveur IMAP / Port</span><span class="help-opt-desc">Le serveur de courrier <i>entrant</i> (pas le SMTP, qui ne sert qu'à envoyer). Port 993 pour une connexion chiffrée, le cas normal.</span></div>
          <div class="help-opt"><span class="help-opt-name">Identifiant / Mot de passe</span><span class="help-opt-desc">Généralement l'adresse électronique complète, et le mot de passe (ou mot de passe d'application) associé.</span></div>
          <div class="help-opt"><span class="help-opt-name">Dossier</span><span class="help-opt-desc">INBOX pour la boîte de réception, ou tout autre nom de dossier.</span></div>
          <div class="help-opt"><span class="help-opt-name">Liens cliquables</span><span class="help-opt-desc">Voir plus haut. Activé par défaut.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les images distantes</span><span class="help-opt-desc">Voir plus haut. Désactivé par défaut.</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre de messages / Afficher l'expéditeur / Non lus uniquement</span><span class="help-opt-desc">La densité d'affichage de la liste.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle entre deux relevés. Chacun ouvre une brève connexion au serveur.</span></div>`,
        en: `
          <span class="help-size">Size: 4×4 by default, from 2×2 to 8×10</span>
          <h4>Goal</h4>
          <p>See at a glance what has landed in a mailbox, without pulling out your phone — and read a message straight from the board if the subject looks worth it.</p>
          <h4>Possibilities</h4>
          <p>The tile shows only the essentials: subject, sender and date, with unread messages marked by a dot and a bold subject. Tapping a message opens a reading popup, exactly like an RSS feed article — <b>resizable with the mouse</b> (bottom-right corner) if a formatted message needs more width to stay readable. You choose how many messages to show, which folder to watch (the inbox by default), and can show unread messages only. A "Reload" button at the top of the tile lets you trigger an immediate check, without waiting for the next automatic refresh.</p>
          <p><b>Nothing is stored on the PiBoard.</b> Each display opens a connection to the server, reads what's needed, and closes — no message or attachment is ever written to disk. Access is also <b>strictly read-only</b>: reading a message here never marks it as read on your phone or computer, and never moves or deletes anything.</p>
          <p>Message content is <b>sanitized before display</b>: scripts are always removed, with no setting to change that — nothing to gain by allowing them. Two behaviors do stay configurable, though, each involving a real security/convenience trade-off:</p>
          <p><b>Links stay clickable</b> and open in the browser, but sanitized: only web and mail links work (a <code>javascript:</code> link is neutralized, its text still visible), and the <b>real destination domain is shown right after the link</b>. This helps: a phishing email happily displays "your-bank.com" while pointing elsewhere — seeing the true destination before tapping lets you spot it, without stopping legitimate links from working. On the Raspberry Pi in kiosk mode, a link opens a new Chromium tab: with no tab bar, getting back to the board means closing that tab (e.g. with <code>Ctrl+W</code> on a keyboard, or by restarting the kiosk). On the Windows app, the link opens directly in your usual browser, without leaving PiBoard.</p>
          <div class="help-opt"><span class="help-opt-name">Clickable links</span><span class="help-opt-desc">On by default. Links open in the browser, with the real destination domain shown alongside — useful to catch a phishing link with misleading text before tapping. Turn off to display links as plain, non-clickable text.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show remote images</span><span class="help-opt-desc">Off by default: a single 1×1 remote image is enough to confirm to the sender that the message was opened (that's the whole point of a tracking pixel). Images already embedded in the message (a logo, a signature) always show, regardless of this setting — they load nothing from the outside. When images are hidden, a "Show images in this message" button appears right in the opened message — no need to hunt for this setting just to see them once; it only affects this reading, not the general setting.</span></div>

          <h4>Compatibility</h4>
          <p>Works with free.fr, Orange, OVH, SFR, La Poste, and any standard IMAP server. For <b>Gmail, Yahoo and iCloud</b>, you need to create an "app password" in the account's security settings — those providers reject the main account password.</p>
          <p><b>Personal Outlook.com and Hotmail accounts do not work.</b> Microsoft has permanently disabled password authentication there, and offers no app password for them (unlike work accounts). Only the OAuth2 protocol would allow connecting — it isn't supported yet.</p>
          <h4>About the password</h4>
          <p>It is kept <b>encrypted, in a file separate from the tile settings</b>: it therefore never ends up in a layout backup, a saved reusable configuration, or a shared config. The field stays empty when reopening the settings (a note says a password is stored) and the server never sends it back to the browser. Removing the tile also erases the password.</p>
          <p>To be clear about the limits: the encryption key lives on the same Pi as the vault. Anyone with full access to the machine can therefore decrypt everything — the protection covers common leaks (a backup copied elsewhere, a file shared by mistake), not physical or administrator access. That's also why an app password is preferable when possible: it can be revoked on its own, without touching the main account.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Provider</span><span class="help-opt-desc">A shortcut that fills in the server address. Leave empty and type the address for any other provider.</span></div>
          <div class="help-opt"><span class="help-opt-name">IMAP server / Port</span><span class="help-opt-desc">The <i>incoming</i> mail server (not the SMTP one, which only sends). Port 993 for an encrypted connection, the normal case.</span></div>
          <div class="help-opt"><span class="help-opt-name">Username / Password</span><span class="help-opt-desc">Usually the full email address, and the matching password (or app password).</span></div>
          <div class="help-opt"><span class="help-opt-name">Folder</span><span class="help-opt-desc">INBOX for the inbox, or any other folder name.</span></div>
          <div class="help-opt"><span class="help-opt-name">Clickable links</span><span class="help-opt-desc">See above. On by default.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show remote images</span><span class="help-opt-desc">See above. Off by default.</span></div>
          <div class="help-opt"><span class="help-opt-name">Messages shown / Show sender / Unread only</span><span class="help-opt-desc">The list's display density.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval between two checks. Each opens a brief connection to the server.</span></div>`
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
        fr: "Scores en direct et à venir de football, de rugby (Top 14), ou de toute autre compétition couverte par ESPN via son code. Pour un match à venir qui n'est pas aujourd'hui, l'heure et la date alternent automatiquement.",
        en: "Live and upcoming scores for football, rugby (Top 14), or any other ESPN-covered competition via its code. For an upcoming match that isn't today, the time and date alternate automatically."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×3 par défaut, de 2×1 à 8×8</span>
          <h4>Objectif</h4>
          <p>Suivre les scores d'une compétition sans allumer la télévision, en direct pendant les matchs et pour les rencontres à venir.</p>
          <h4>Possibilités</h4>
          <p>Une sélection de compétitions courantes (Coupe du monde, Ligue des champions, principaux championnats de football européens, Top 14) est proposée directement dans la liste. Pour toute autre compétition suivie par ESPN — un championnat américain par exemple — un code personnalisé permet de cibler n'importe quelle ligue (voir la méthode de recherche du code dans les options du widget Classement, identique ici). Le filtre par équipe permet de ne garder que les matchs d'un club précis, pratique pour une tuile compacte dédiée à votre équipe favorite plutôt qu'à toute la compétition. Pour un match à venir programmé un autre jour, l'heure et la date (jj/mm) alternent automatiquement toutes les quelques secondes — pour un match du jour même, seule l'heure est affichée, la date étant déjà évidente.</p>
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
          <p>A selection of common competitions (World Cup, Champions League, major European football leagues, Top 14) is offered directly in the list. For any other ESPN-covered competition — an American league for instance — a custom code lets you target any league (see the code lookup method in the League standings widget's options, identical here). The team filter lets you keep only a specific club's matches, handy for a compact tile dedicated to your favorite team rather than the whole competition. For an upcoming match scheduled on another day, the time and date (DD/MM) alternate automatically every few seconds — for a match happening today, only the time is shown, since the date is already obvious.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Competition</span><span class="help-opt-desc">List of preconfigured common competitions.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom ESPN code</span><span class="help-opt-desc">Takes precedence over the list above to target any ESPN-covered competition (format <code>sport:league</code>, e.g. <code>football:nfl</code>).</span></div>
          <div class="help-opt"><span class="help-opt-name">Filter by team</span><span class="help-opt-desc">Only shows matches involving the entered name (e.g. "Toulouse").</span></div>
          <div class="help-opt"><span class="help-opt-name">Max matches shown</span><span class="help-opt-desc">How many matches to show at most.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two score updates.</span></div>`
      }
    },

    {
      id: "motorsport",
      group: "tiles",
      title: { fr: "Sports mécaniques", en: "Motorsport schedule" },
      sub: {
        fr: "Programme complet des séances d'un week-end de Formule 1 ou de MotoGP : essais libres, qualifications, course sprint et course, avec le jour et l'heure locale de chacune.",
        en: "Full session timetable for a Formula 1 or MotoGP race weekend: free practice, qualifying, sprint and race, each with its day and local start time."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 4×4 par défaut, de 2×2 à 8×10</span>
          <h4>Objectif</h4>
          <p>Savoir quand regarder, sans avoir à chercher les horaires du week-end de course quelque part sur le web — et voir d'un coup d'œil ce qui vient de se passer, ce qui est en cours, et ce qui arrive.</p>
          <h4>Possibilités</h4>
          <p>Le mode par défaut affiche la <b>prochaine manche</b> avec l'intégralité de son programme, regroupé par jour : essais libres, qualifications, course sprint et course, chacun à son heure locale (convertie automatiquement depuis le fuseau du circuit). Les séances déjà terminées restent visibles mais estompées, la séance en cours est signalée par une pastille clignotante, et la prochaine à venir est mise en avant — le tout se rafraîchit tout seul chaque minute, sans nouvel appel réseau. Un code couleur distingue les essais (gris), les qualifications (orange), le sprint (violet) et la course (rouge). Le mode <b>calendrier</b> liste plutôt les prochaines manches de la saison avec leurs dates, pratique pour anticiper. Une manche en cours reste affichée jusqu'à sa course du dimanche, plutôt que de sauter à la suivante dès le samedi soir.</p>
          <p>Pour le MotoGP, les catégories Moto2, Moto3 et MotoE peuvent être ajoutées au programme — attention, cela le rend nettement plus long, à réserver à une tuile haute.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Championnat</span><span class="help-opt-desc">Formule 1 ou MotoGP. Pour suivre les deux, ajoutez simplement deux tuiles.</span></div>
          <div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Programme détaillé de la prochaine manche, ou calendrier des prochaines manches.</span></div>
          <div class="help-opt"><span class="help-opt-name">MotoGP : catégories affichées</span><span class="help-opt-desc">MotoGP seul, ou toutes les catégories du week-end.</span></div>
          <div class="help-opt"><span class="help-opt-name">Masquer les séances terminées</span><span class="help-opt-desc">Utile sur une petite tuile pour ne garder que ce qui reste à venir.</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre de manches affichées</span><span class="help-opt-desc">En mode calendrier uniquement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Un programme change rarement : un intervalle long suffit largement.</span></div>`,
        en: `
          <span class="help-size">Size: 4×4 by default, from 2×2 to 8×10</span>
          <h4>Goal</h4>
          <p>Know when to watch, without hunting down the race weekend's timings somewhere on the web — and see at a glance what just happened, what's on now, and what's coming.</p>
          <h4>Possibilities</h4>
          <p>The default mode shows the <b>next round</b> with its full timetable, grouped by day: free practice, qualifying, sprint and race, each at its local time (converted automatically from the circuit's timezone). Finished sessions stay visible but dimmed, the ongoing session gets a pulsing dot, and the next one up is highlighted — all of it refreshing on its own every minute, with no new network call. A color code tells practice (grey), qualifying (orange), sprint (purple) and race (red) apart. The <b>calendar</b> mode lists the season's upcoming rounds with their dates instead, handy for planning ahead. An ongoing round stays displayed through its Sunday race, rather than jumping to the next one from Saturday evening.</p>
          <p>For MotoGP, the Moto2, Moto3 and MotoE classes can be added to the timetable — note this makes it considerably longer, best kept for a tall tile.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Championship</span><span class="help-opt-desc">Formula 1 or MotoGP. To follow both, simply add two tiles.</span></div>
          <div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Detailed timetable of the next round, or calendar of upcoming rounds.</span></div>
          <div class="help-opt"><span class="help-opt-name">MotoGP: classes shown</span><span class="help-opt-desc">MotoGP alone, or every class of the weekend.</span></div>
          <div class="help-opt"><span class="help-opt-name">Hide finished sessions</span><span class="help-opt-desc">Useful on a small tile to keep only what's still ahead.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rounds shown</span><span class="help-opt-desc">Calendar mode only.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">A timetable rarely changes: a long interval is plenty.</span></div>`
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
      id: "planes",
      group: "tiles",
      title: { fr: "Avions en vue", en: "Planes Overhead" },
      sub: {
        fr: "Avions en vol en temps réel près d'une ville sur une vraie carte, via un réseau ADS-B communautaire gratuit et sans clé — adsb.lol ou adsb.fi, au choix.",
        en: "Live aircraft near a city on a real map, via a free, keyless community ADS-B network — adsb.lol or adsb.fi, your choice."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 6×6 par défaut, de 3×3 à 12×16</span>
          <h4>Objectif</h4>
          <p>Identifier l'avion qui passe au-dessus de chez vous, avec les mêmes données ouvertes de suivi de vol que des sites comme le globe d'adsb.lol.</p>
          <h4>Possibilités</h4>
          <p>La carte se centre sur la ville choisie, indépendamment des tuiles Météo et Radar météo, avec le même choix de fond de carte que la tuile Trafic. Chaque avion est une icône orientée selon son cap réel, avec une étiquette indicatif + altitude (format aviation : niveau de vol FLxxx au-dessus de 10 000 ft, pieds en dessous, « Sol » pour un appareil au sol), et en option une fine traînée pointillée montrant son trajet récent (se construit progressivement à partir du chargement de la tuile). Toucher un avion ouvre une popup recherchant sa ville de départ et d'arrivée auprès d'adsbdb.com, une base communautaire gratuite qui associe indicatifs de vol et trajets — cette information n'est pas transmise par l'ADS-B lui-même, seuls les vols commerciaux/réguliers dotés d'un indicatif reconnu ont un résultat. Une seconde base (hexdb.io) est interrogée en repli quand la première ne connaît pas l'indicatif, ce qui augmente sensiblement le nombre de vols documentés. En parallèle, le <b>modèle de l'appareil et son exploitant</b> sont recherchés à partir du code hex — présent sur <i>tous</i> les avions, contrairement à l'indicatif de vol : la popup affiche donc quelque chose d'utile même pour les nombreux appareils sans trajet connu (aviation générale, privé, vols non réguliers).</p>
          <p><b>Trajets incohérents signalés.</b> La base associe un indicatif de vol à <i>un</i> trajet, de façon statique — or un même indicatif est réutilisé d'un jour à l'autre, parfois pour des liaisons différentes, et la donnée peut simplement être datée ou erronée. La position réelle de l'avion est donc confrontée au trajet annoncé : si l'écart est manifeste (plus de 500 km de détour, tolérance volontairement large pour ne pas jeter le doute sur un déroutement ou une attente légitimes), le trajet est affiché barré, accompagné d'un avertissement ⚠. Mieux vaut dire « cette donnée semble fausse » que la présenter comme un fait. La flèche de chaque avion pointe vers son <b>cap réel actuel</b> (la direction dans laquelle il vole à cet instant), pas vers sa destination finale — ces deux caps peuvent différer sensiblement juste après un décollage ou pendant un guidage par le contrôle aérien, ce qui est normal. Un avion dont le cap n'est pas transmis à cet instant s'affiche en icône neutre (un simple rond) plutôt que de pointer arbitrairement vers le nord. Le cap brut est rappelé en petit dans la popup de trajet, pour vérification. Un <b>compas en surimpression</b> optionnel — une rose des vents fixe, nord toujours en haut comme la carte elle-même — permet de comparer directement l'orientation d'une icône d'avion à un point cardinal réel, en un coup d'œil. Les avions en squawk d'urgence (7500/7600/7700) sont mis en évidence en rouge. Le nombre d'avions est plafonné et trié par proximité (les plus proches d'abord), pour rester lisible même en zone à fort trafic. Deux réseaux communautaires équivalents sont proposés (adsb.lol et adsb.fi, même format de données) : si l'un a un trou de couverture ou une panne près de chez vous, essayez l'autre.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte.</span></div>
          <div class="help-opt"><span class="help-opt-name">Réseau ADS-B</span><span class="help-opt-desc">adsb.lol ou adsb.fi.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rayon de recherche</span><span class="help-opt-desc">En milles nautiques, autour de la ville choisie.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom initial</span><span class="help-opt-desc">Ajustable ensuite librement à l'écran.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager, sombre, clair, ou automatique selon le thème du tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher indicatif et altitude</span><span class="help-opt-desc">Étiquette sous chaque avion.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les traînées</span><span class="help-opt-desc">Fine ligne pointillée derrière chaque avion. Se construit à partir du chargement de la tuile, pas d'historique disponible avant.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher un compas en surimpression</span><span class="help-opt-desc">Activé par défaut.</span></div>
          <div class="help-opt"><span class="help-opt-name">Position du compas</span><span class="help-opt-desc">L'un des quatre coins de la carte. En bas à droite par défaut.</span></div>
          <div class="help-opt"><span class="help-opt-name">Opacité du compas</span><span class="help-opt-desc">De 10 à 100 %, pour qu'il reste discret sans gêner la lecture de la carte en dessous.</span></div>
          <div class="help-opt"><span class="help-opt-name">Nombre max d'avions</span><span class="help-opt-desc">Les plus proches du centre sont affichés en priorité.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en secondes entre deux mises à jour des positions.</span></div>`,
        en: `
          <span class="help-size">Size: 6×6 by default, from 3×3 to 12×16</span>
          <h4>Goal</h4>
          <p>Identify the plane flying over your house, with the same open flight-tracking data as sites like adsb.lol's globe.</p>
          <h4>Possibilities</h4>
          <p>The map centers on the chosen city, independent from the Weather and Weather Radar tiles, with the same choice of base map as the Traffic tile. Each aircraft is an icon oriented by its actual heading, with a callsign + altitude label (aviation-style: flight level FLxxx above 10,000 ft, feet below that, "Ground" for an aircraft on the ground), and optionally a thin dashed trail showing its recent path (builds up progressively from when the tile loads). Tapping an aircraft opens a popup that looks up its departure and arrival city via adsbdb.com, a free community database matching flight callsigns to routes — this information isn't transmitted by ADS-B itself, only commercial/scheduled flights with a recognized callsign will get a result. A second database (hexdb.io) is queried as a fallback when the first doesn't know the callsign, which noticeably increases the number of documented flights. In parallel, the <b>aircraft model and its operator</b> are looked up from the hex code — present on <i>every</i> aircraft, unlike the flight callsign: the popup therefore shows something useful even for the many aircraft with no known route (general aviation, private, non-scheduled flights).</p>
          <p><b>Inconsistent routes flagged.</b> The database maps a flight callsign to <i>one</i> route, statically — but the same callsign gets reused from day to day, sometimes for different legs, and the data can simply be stale or wrong. The aircraft's actual position is therefore checked against the announced route: if the gap is blatant (over 500 km of detour, a deliberately generous tolerance so as not to cast doubt on a legitimate reroute or holding pattern), the route is shown struck through, with a ⚠ warning. Better to say "this data looks wrong" than to present it as fact. Each aircraft's arrow points to its <b>current actual heading</b> (the direction it's flying right now), not its final destination — the two can differ noticeably just after takeoff or while being vectored by air traffic control, which is normal. An aircraft whose heading isn't being transmitted at that moment shows as a neutral icon (a plain circle) rather than arbitrarily pointing north. The raw heading is recalled small in the route popup, for verification. An optional <b>compass overlay</b> — a fixed compass rose, north always up like the map itself — lets you compare an aircraft icon's orientation directly against a real cardinal direction, at a glance. Aircraft squawking an emergency code (7500/7600/7700) are highlighted in red. Aircraft count is capped and sorted by proximity (closest first), to stay legible even in high-traffic areas. Two equivalent community networks are offered (adsb.lol and adsb.fi, same data format): if one has a coverage gap or an outage near you, try the other.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center.</span></div>
          <div class="help-opt"><span class="help-opt-name">ADS-B network</span><span class="help-opt-desc">adsb.lol or adsb.fi.</span></div>
          <div class="help-opt"><span class="help-opt-name">Search radius</span><span class="help-opt-desc">In nautical miles, around the chosen city.</span></div>
          <div class="help-opt"><span class="help-opt-name">Initial zoom</span><span class="help-opt-desc">Freely adjustable afterwards on screen.</span></div>
          <div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager, dark, light, or automatic following the board's theme.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show callsign and altitude labels</span><span class="help-opt-desc">Label under each aircraft.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show flight trails</span><span class="help-opt-desc">Thin dashed line behind each aircraft. Builds up from when the tile loads, no history available before that.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show a compass overlay</span><span class="help-opt-desc">On by default.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compass position</span><span class="help-opt-desc">One of the map's four corners. Bottom right by default.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compass opacity</span><span class="help-opt-desc">From 10 to 100%, to keep it discreet without hindering the map underneath.</span></div>
          <div class="help-opt"><span class="help-opt-name">Max aircraft shown</span><span class="help-opt-desc">Those closest to the center are shown first.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in seconds between two position updates.</span></div>`
      }
    },

    {
      id: "weather",
      group: "tiles",
      title: { fr: "Météo", en: "Weather" },
      sub: {
        fr: "Météo actuelle avec un choix de modèles météo nationaux, une vraie photo de fond selon les conditions, le saint du jour en option, et la prévision du lendemain disposée automatiquement selon la forme de la tuile.",
        en: "Current weather with a choice of national weather models, a real photo background matching conditions, an optional French name day, and tomorrow's forecast laid out automatically to fit the tile's shape."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 1×1 à 8×4</span>
          <h4>Objectif</h4>
          <p>La météo actuelle et celle du lendemain d'un simple coup d'œil, avec une vraie photo illustrant les conditions plutôt qu'une simple icône.</p>
          <h4>Possibilités</h4>
          <p>Toutes les sources (sauf « Personnalisé ») passent par l'API gratuite et sans clé d'Open-Meteo, qui agrège plusieurs modèles météorologiques nationaux. Par défaut, « Meilleure correspondance » choisit automatiquement le meilleur modèle pour votre lieu — un bon choix pour la plupart des usages. Si les prévisions vous semblent régulièrement décalées, un modèle national précis (Météo-France pour la France, DWD pour l'Allemagne, etc.) fait parfois mieux localement que le choix automatique. La disposition de la prévision du lendemain s'adapte automatiquement à la forme de la tuile : côte à côte sur une tuile large, empilée sur une tuile haute, ou masquée sur une tuile presque carrée pour laisser plus de place à la météo du jour. Le saint du jour, une tradition française, peut s'ajouter sous la météo du jour et, si la prévision du lendemain est affichée, sous celle-ci également. Une ligne « pluie dans ~X min » apparaît automatiquement sur la tuile quand de la pluie est détectée dans l'heure qui vient — sans avoir besoin de cliquer, et sans rester affichée en permanence. Toucher la tuile ouvre une vue détaillée : les 24 prochaines heures (température, probabilité de pluie, et une icône météo pour chaque heure), les 7 prochains jours affichés en une rangée de colonnes façon coup d'œil sur la semaine, l'indice UV du jour, les rafales de vent, et l'heure de lever/coucher du soleil. Cette vue détaillée passe toujours par le modèle « Meilleure correspondance », indépendamment du modèle choisi ci-dessus pour la météo du jour même : certains modèles nationaux uniques ont un horizon de prévision plus court que 7 jours ou ne fournissent pas l'indice UV, ce qui produirait sinon des jours incomplets dans la vue détaillée. L'option « Personnalisé » permet de brancher votre propre source (une instance Open-Meteo auto-hébergée, ou un petit proxy que vous écrivez pour reformater les données d'un autre fournisseur météo) pour la météo du jour même — la vue détaillée, elle, continue de fonctionner normalement.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Lieu pour lequel afficher la météo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Modèle météo / source</span><span class="help-opt-desc">Meilleure correspondance (automatique), ou un modèle national précis (Météo-France, ECMWF, DWD, MET Norway, NOAA), ou personnalisé.</span></div>
          <div class="help-opt"><span class="help-opt-name">URL de prévision personnalisée</span><span class="help-opt-desc">Utilisée seulement par « Personnalisé ». Utilisez <code>{lat}</code> et <code>{lon}</code> comme espaces réservés ; la réponse doit respecter le format JSON exact d'Open-Meteo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la prévision du lendemain</span><span class="help-opt-desc">La disposition s'adapte automatiquement à la forme de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le vent</span><span class="help-opt-desc">Ajoute la vitesse du vent.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le saint du jour</span><span class="help-opt-desc">Tradition française, visible seulement en français. Inclut le saint du lendemain si sa prévision est affichée.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour.</span></div>
          <div class="help-opt"><span class="help-opt-name">Utiliser une photo de fond</span><span class="help-opt-desc">Une vraie photo correspondant aux conditions actuelles (repli sur un fond de couleur si aucune photo n'est disponible).</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 1×1 to 8×4</span>
          <h4>Goal</h4>
          <p>Today's and tomorrow's weather at a glance, with a real photo illustrating conditions rather than a plain icon.</p>
          <h4>Possibilities</h4>
          <p>Every source (except "Custom") goes through Open-Meteo's free, keyless API, which aggregates several national weather models. By default, "Best match" automatically picks the best model for your location — a good choice for most uses. If forecasts consistently seem off, a precise national model (Météo-France for France, DWD for Germany, etc.) sometimes does better locally than the automatic choice. Tomorrow's forecast layout automatically adapts to the tile's shape: side by side on a wide tile, stacked on a tall one, or hidden on a near-square tile to leave more room for today's weather. The name day, a French tradition, can be added below today's weather and, if tomorrow's forecast is shown, below that one too. A "rain in ~X min" line automatically appears on the tile when rain is detected within the coming hour — no need to tap, and it doesn't stay shown permanently. Tapping the tile opens a detailed view: the next 24 hours (temperature, rain chance, and a weather icon for each hour), the next 7 days shown as a row of columns for a week-at-a-glance, today's UV index, wind gusts, and sunrise/sunset time. This detailed view always goes through the "Best match" model, independent from the model chosen above for today's own weather: some single national models have a forecast horizon shorter than 7 days or don't provide the UV index, which would otherwise produce incomplete days in the detailed view. The "Custom" option lets you plug in your own source (a self-hosted Open-Meteo instance, or a small proxy you write to reformat data from another weather provider) for today's own weather — the detailed view keeps working normally either way.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Location to show weather for.</span></div>
          <div class="help-opt"><span class="help-opt-name">Weather model / source</span><span class="help-opt-desc">Best match (automatic), or a precise national model (Météo-France, ECMWF, DWD, MET Norway, NOAA), or custom.</span></div>
          <div class="help-opt"><span class="help-opt-name">Custom forecast URL</span><span class="help-opt-desc">Used only by "Custom". Use <code>{lat}</code> and <code>{lon}</code> as placeholders; the response must match Open-Meteo's exact JSON format.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show tomorrow's forecast</span><span class="help-opt-desc">The layout automatically adapts to the tile's shape.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show wind</span><span class="help-opt-desc">Adds wind speed.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show name day</span><span class="help-opt-desc">French tradition, only shown in French. Includes tomorrow's name day if its forecast is shown.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two updates.</span></div>
          <div class="help-opt"><span class="help-opt-name">Use a photo background</span><span class="help-opt-desc">A real photo matching current conditions (falls back to a color background if no photo is available).</span></div>`
      }
    },

    {
      id: "airquality",
      group: "tiles",
      title: { fr: "Qualité de l'air", en: "Air Quality" },
      sub: {
        fr: "Indice de qualité de l'air européen et niveaux de pollens, via l'API gratuite et sans clé Open-Meteo, basée sur les prévisions CAMS Europe.",
        en: "European Air Quality Index and pollen levels, via Open-Meteo's free, keyless API, based on the CAMS Europe forecast."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 3×2 par défaut, de 2×2 à 6×5</span>
          <h4>Objectif</h4>
          <p>Un coup d'œil rapide sur la pollution de l'air et les pollens, utile pour ajuster une sortie ou l'aération du logement — sans se substituer à un avis médical.</p>
          <h4>Possibilités</h4>
          <p>L'indice de qualité de l'air européen (EAQI) résume cinq polluants (PM2.5, PM10, NO₂, O₃, SO₂) en un seul niveau, du « Bon » à l'« Extrêmement mauvais ». Deux affichages : compact (l'indice global, le polluant qui tire l'indice vers le haut, et le pollen dominant en saison) ou détaillé (le détail chiffré de chaque polluant et de chaque pollen actuellement en saison). La visibilité des pollens se règle indépendamment pour chaque affichage — masquer le détail des pollens en mode détaillé n'empêche pas de garder le pollen dominant en mode compact, et inversement. Les pollens ne sont disponibles que pour l'Europe et seulement pour les espèces actuellement en saison ; l'échelle de niveau (nul/faible/modéré/élevé) est volontairement simplifiée pour un coup d'œil rapide.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Lieu pour lequel afficher la qualité de l'air.</span></div>
          <div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Compact (indice + polluant/pollen dominant) ou détaillé (détail complet).</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le pollen dominant (compact)</span><span class="help-opt-desc">S'applique uniquement à l'affichage compact.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher le détail des pollens (détaillé)</span><span class="help-opt-desc">S'applique uniquement à l'affichage détaillé, indépendamment du réglage compact ci-dessus. Bouleau, graminées, ambroisie, aulne, armoise, olivier — les espèces hors saison sont simplement omises.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour.</span></div>`,
        en: `
          <span class="help-size">Size: 3×2 by default, from 2×2 to 6×5</span>
          <h4>Goal</h4>
          <p>A quick glance at air pollution and pollen, useful for planning an outing or ventilating the home — not a substitute for medical advice.</p>
          <h4>Possibilities</h4>
          <p>The European Air Quality Index (EAQI) summarizes five pollutants (PM2.5, PM10, NO₂, O₃, SO₂) into a single level, from "Good" to "Extremely poor". Two displays: compact (the overall index, the pollutant driving it up, and the dominant pollen in season) or detailed (the numeric breakdown of every pollutant and every currently in-season pollen). Pollen visibility is set independently for each display — hiding the pollen breakdown in the detailed display doesn't stop the dominant pollen from showing in the compact one, and vice versa. Pollen data is only available for Europe and only for species currently in season; the level scale (none/low/moderate/high) is deliberately simplified for a quick glance.</p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Location to show air quality for.</span></div>
          <div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Compact (index + dominant pollutant/pollen) or detailed (full breakdown).</span></div>
          <div class="help-opt"><span class="help-opt-name">Show dominant pollen (compact)</span><span class="help-opt-desc">Applies only to the compact display.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show pollen breakdown (detailed)</span><span class="help-opt-desc">Applies only to the detailed display, independently from the compact setting above. Birch, grass, ragweed, alder, mugwort, olive — out-of-season species are simply omitted.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">Interval in minutes between two updates.</span></div>`
      }
    },

    {
      id: "radar",
      group: "tiles",
      title: { fr: "Radar météo", en: "Weather Radar" },
      sub: {
        fr: "Boucle radar de précipitations animée (2 dernières heures) sur une vraie carte, via l'API gratuite et sans clé Weather Maps de RainViewer.",
        en: "Animated precipitation radar loop (last 2 hours) over a real map, via RainViewer's free, keyless Weather Maps API."
      },
      html: {
        fr: `
          <span class="help-size">Taille : 6×6 par défaut, de 3×3 à 12×16</span>
          <h4>Objectif</h4>
          <p>Voir la pluie arriver (ou s'éloigner) sur une vraie carte, avec un historique des 2 dernières heures.</p>
          <h4>Possibilités</h4>
          <p>La carte se centre sur la ville choisie, indépendamment de la tuile Météo, avec le même choix de fond de carte que les tuiles Trafic et Avions en vue. Les contrôles lecture/pause et image par image restent accessibles directement sur la tuile ; chaque image est préchargée et mise en cache pour une animation fluide, sans rechargement à chaque boucle. La légende (optionnelle) rappelle que les couleurs vont du bleu clair (précipitations légères) au rose (extrême), d'après l'échelle « Universal Blue » de RainViewer — la seule disponible sur l'offre gratuite.</p>
          <p>Une <b>couche vent</b> optionnelle superpose une grille de flèches montrant le vent actuel. Chaque flèche pointe <b>vers où souffle le vent</b> (et non d'où il vient, contrairement à la convention météo brute) et sa couleur indique sa force, d'après les paliers de l'échelle de Beaufort — du vert (calme) au violet (tempête), avec sa propre légende pour ne pas la confondre avec celle de la pluie. La grille se recalcule sur la zone affichée à chaque zoom ou déplacement : zoomer resserre naturellement les flèches sur ce que vous regardez. Toutes les positions sont demandées en une seule requête à Open-Meteo, et la densité est réglable — chaque flèche étant un point interrogé, une grille plus dense sollicite davantage le service gratuit.</p>
          <p style="margin-top:12px"><i>RainViewer a définitivement retiré les images de prévision (« nowcast ») de son offre gratuite au 1ᵉʳ janvier 2026 — seul l'historique des 2 dernières heures reste disponible sans clé. C'est pour cette raison qu'il n'y a pas de mode prévision ici.</i></p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte, indépendant de la tuile Météo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom initial</span><span class="help-opt-desc">Ajustable ensuite librement à l'écran.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager, sombre, clair, ou automatique selon le thème du tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Opacité du radar</span><span class="help-opt-desc">Transparence de la couche de précipitations sur le fond de carte.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la légende des couleurs</span><span class="help-opt-desc">Petite barre de référence, du léger (bleu) à l'extrême (rose).</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher les flèches de vent</span><span class="help-opt-desc">Active la couche vent (désactivée par défaut).</span></div>
          <div class="help-opt"><span class="help-opt-name">Densité des flèches</span><span class="help-opt-desc">Faible, moyenne ou élevée. La grille s'adapte aussi à la forme de la tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la vitesse sous chaque flèche</span><span class="help-opt-desc">En km/h. Utile sur une tuile large, vite chargé sur une petite.</span></div>
          <div class="help-opt"><span class="help-opt-name">Afficher la légende du vent</span><span class="help-opt-desc">Barre de référence du calme (vert) à la tempête (violet).</span></div>
          <div class="help-opt"><span class="help-opt-name">Lecture automatique de la boucle</span><span class="help-opt-desc">Démarre l'animation dès le chargement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Délai entre images</span><span class="help-opt-desc">Vitesse de l'animation, en millisecondes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchissement</span><span class="help-opt-desc">RainViewer publie une nouvelle image toutes les ~10 minutes.</span></div>`,
        en: `
          <span class="help-size">Size: 6×6 by default, from 3×3 to 12×16</span>
          <h4>Goal</h4>
          <p>Watch rain arrive (or move away) on a real map, with a 2-hour history.</p>
          <h4>Possibilities</h4>
          <p>The map centers on the chosen city, independent from the Weather tile, with the same choice of base map as the Traffic and Planes Overhead tiles. Play/pause and step controls stay right on the tile; each frame is preloaded and cached for a smooth animation, with no reloading on every loop. The optional legend is a reminder that colors range from light blue (light precipitation) to pink (extreme), based on RainViewer's "Universal Blue" scale — the only one available on the free tier.</p>
          <p>An optional <b>wind layer</b> overlays a grid of arrows showing the current wind. Each arrow points <b>where the wind is blowing to</b> (not where it comes from, unlike the raw meteorological convention) and its color shows the strength, following the Beaufort scale's thresholds — from green (calm) to purple (storm), with its own legend so it can't be confused with the rain one. The grid is recomputed over the displayed area on every zoom or pan: zooming in naturally tightens the arrows onto what you're looking at. Every position is requested in a single call to Open-Meteo, and the density is adjustable — since each arrow is one queried point, a denser grid asks more of the free service.</p>
          <p style="margin-top:12px"><i>RainViewer permanently removed forecast ("nowcast") frames from its free tier on January 1, 2026 — only the last 2 observed hours remain available without a key. That's why there's no forecast mode here.</i></p>
          <h4>Options</h4>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center, independent from the Weather tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Initial zoom</span><span class="help-opt-desc">Freely adjustable afterwards on screen.</span></div>
          <div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager, dark, light, or automatic following the board's theme.</span></div>
          <div class="help-opt"><span class="help-opt-name">Radar opacity</span><span class="help-opt-desc">Transparency of the precipitation layer over the base map.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show color legend</span><span class="help-opt-desc">Small reference bar, from light (blue) to extreme (pink).</span></div>
          <div class="help-opt"><span class="help-opt-name">Show wind arrows</span><span class="help-opt-desc">Turns the wind layer on (off by default).</span></div>
          <div class="help-opt"><span class="help-opt-name">Arrow density</span><span class="help-opt-desc">Low, medium or high. The grid also adapts to the tile's shape.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show speed under each arrow</span><span class="help-opt-desc">In km/h. Handy on a wide tile, quickly cluttered on a small one.</span></div>
          <div class="help-opt"><span class="help-opt-name">Show the wind legend</span><span class="help-opt-desc">Reference bar from calm (green) to storm (purple).</span></div>
          <div class="help-opt"><span class="help-opt-name">Autoplay the loop</span><span class="help-opt-desc">Starts the animation as soon as it loads.</span></div>
          <div class="help-opt"><span class="help-opt-name">Frame delay</span><span class="help-opt-desc">Animation speed, in milliseconds.</span></div>
          <div class="help-opt"><span class="help-opt-name">Refresh</span><span class="help-opt-desc">RainViewer publishes a new frame roughly every 10 minutes.</span></div>`
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

    /* ================= APPLICATION DE BUREAU WINDOWS / WINDOWS DESKTOP APP ================= */
    {
      id: "windows-app",
      group: "platform",
      title: { fr: "Application de bureau Windows", en: "Windows desktop app" },
      sub: {
        fr: "Le menu caché, et comment vérifier les mises à jour.",
        en: "The hidden menu, and how to check for updates."
      },
      html: {
        fr: `
          <h4>Uniquement pertinent sur PC Windows</h4>
          <p>Cette section ne concerne que l'installation de PiBoard en tant qu'application de bureau Windows (via l'installeur <code>.exe</code>). Sur Raspberry Pi, l'affichage est un navigateur en kiosque et rien de ce qui suit ne s'applique.</p>

          <h4>Le menu caché</h4>
          <p>La fenêtre est volontairement épurée : sa barre de menu est <b>masquée par défaut</b> et rien à l'écran n'indique qu'elle existe. Pour la faire apparaître, <b>appuyez sur la touche <code>Alt</code></b> (seule, sans la maintenir avec une autre touche). Un second appui, ou un clic ailleurs dans la fenêtre, la referme.</p>
          <div class="help-opt"><span class="help-opt-name">Recharger</span><span class="help-opt-desc">Recharge le tableau de bord, comme le bouton de rafraîchissement de l'écran de veille — utile en cas d'affichage figé. Raccourci : Ctrl+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Plein écran</span><span class="help-opt-desc">Bascule entre fenêtre normale et plein écran. Raccourci : F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100 %</span><span class="help-opt-desc">Agrandit ou réduit l'ensemble de l'interface (différent du réglage « Taille du texte » propre à chaque tuile).</span></div>
          <div class="help-opt"><span class="help-opt-name">Outils de développement</span><span class="help-opt-desc">Ouvre la console du navigateur intégré, pour diagnostiquer un problème. Raccourci : F12.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rechercher une mise à jour</span><span class="help-opt-desc">Voir la section suivante. Aucun raccourci clavier : c'est le seul moyen d'y accéder.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quitter</span><span class="help-opt-desc">Ferme l'application. Raccourci : Alt+F4, qui fonctionne directement sans avoir à ouvrir le menu.</span></div>

          <h4>Mises à jour automatiques</h4>
          <p>L'application vérifie silencieusement l'existence d'une nouvelle version quelques secondes après chaque démarrage — sans rien afficher si elle est déjà à jour. Une mise à jour trouvée propose son téléchargement, puis son installation (l'application se ferme et se relance automatiquement) — rien n'est jamais installé sans confirmation.</p>
          <p>Pour vérifier manuellement à tout moment, ouvrez le menu (<code>Alt</code>) puis <b>Rechercher une mise à jour</b>.</p>

          <h4>Emplacement des données</h4>
          <p>Les réglages, la disposition des tuiles, les clés API et les photos téléversées sont stockés dans <code>%APPDATA%\\PiBoard</code>. Ce dossier est conservé lors d'une mise à jour ou d'une désinstallation — une réinstallation retrouve tout tel quel.</p>`,
        en: `
          <h4>Only relevant on a Windows PC</h4>
          <p>This section only concerns PiBoard installed as a Windows desktop application (via the <code>.exe</code> installer). On Raspberry Pi, the display is a kiosk browser and none of the following applies.</p>

          <h4>The hidden menu</h4>
          <p>The window is deliberately clean: its menu bar is <b>hidden by default</b> and nothing on screen hints that it exists. To reveal it, <b>press the <code>Alt</code> key</b> (alone, not held with another key). Pressing it again, or clicking elsewhere in the window, closes it.</p>
          <div class="help-opt"><span class="help-opt-name">Reload</span><span class="help-opt-desc">Reloads the dashboard, like the screensaver's refresh button — useful if the display gets stuck. Shortcut: Ctrl+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Full screen</span><span class="help-opt-desc">Toggles between a normal window and full screen. Shortcut: F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100%</span><span class="help-opt-desc">Enlarges or shrinks the whole interface (different from each tile's own "Text size" setting).</span></div>
          <div class="help-opt"><span class="help-opt-name">Developer tools</span><span class="help-opt-desc">Opens the built-in browser's console, to diagnose an issue. Shortcut: F12.</span></div>
          <div class="help-opt"><span class="help-opt-name">Check for updates</span><span class="help-opt-desc">See the next section. No keyboard shortcut: this is the only way to reach it.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quit</span><span class="help-opt-desc">Closes the application. Shortcut: Alt+F4, which works directly without opening the menu.</span></div>

          <h4>Automatic updates</h4>
          <p>The application silently checks for a new version a few seconds after each launch — showing nothing if already up to date. A found update offers its download, then its installation (the app closes and relaunches automatically) — nothing is ever installed without confirmation.</p>
          <p>To check manually at any time, open the menu (<code>Alt</code>) then <b>Check for updates</b>.</p>

          <h4>Data location</h4>
          <p>Settings, tile layout, API keys and uploaded photos are stored in <code>%APPDATA%\\PiBoard</code>. This folder is kept across an update or an uninstall — a reinstall finds everything back as it was.</p>`
      }
    },

    {
      id: "backups",
      group: "platform",
      title: { fr: "Sauvegarde et restauration", en: "Backup & restore" },
      sub: {
        fr: "Instantanés horodatés de toute la configuration, export/import en fichier.",
        en: "Timestamped snapshots of the whole configuration, file export/import."
      },
      html: {
        fr: `
          <h4>Accès</h4>
          <p>Bouton « Sauvegarde et restauration… » en bas des réglages généraux.</p>
          <h4>Ce qui est sauvegardé</h4>
          <p>Les tuiles affichées, leur emplacement, leurs réglages, les configurations réutilisables enregistrées, et le contenu libre par widget (le texte du bloc-notes, notamment). Concrètement : tout fichier de configuration présent sur le PiBoard au moment de la sauvegarde, plutôt qu'une liste figée — une future fonctionnalité n'a donc pas besoin d'une mise à jour de PiBoard pour être incluse dans une sauvegarde à venir.</p>
          <p><b>Le mot de passe de la boîte mail n'en fait jamais partie.</b> Il vit dans un coffre chiffré séparé (voir l'aide de la tuile Courriel), délibérément exclu de toute sauvegarde — restaurer une configuration laisse donc la tuile Courriel sans mot de passe, à ressaisir une fois. C'est le prix, jugé raisonnable, pour qu'un fichier de sauvegarde ne devienne jamais un objet aussi sensible qu'un fichier de mots de passe.</p>
          <h4>Instantanés horodatés</h4>
          <p>Chaque sauvegarde reçoit un identifiant horodaté à la milliseconde : une nouvelle sauvegarde ne peut donc jamais en écraser une ancienne, contrairement à un système à emplacement unique. La liste conserve toutes les sauvegardes créées jusqu'à ce que vous les supprimiez vous-même.</p>
          <h4>Export et import de fichier</h4>
          <p>Chaque sauvegarde peut être téléchargée en fichier (utile pour la conserver hors du Raspberry Pi, ou pour la transférer vers un autre PiBoard). Un fichier peut aussi être importé : il devient une nouvelle entrée de l'historique, puis est immédiatement restauré. Un fichier qui ne provient pas de PiBoard, ou corrompu, est rejeté proprement plutôt que d'abîmer la configuration actuelle.</p>
          <h4>Restauration</h4>
          <p>Toujours précédée d'une confirmation explicite : c'est une action irréversible, qui remplace entièrement la configuration actuelle. Après confirmation, la page se recharge pour repartir d'un état propre.</p>`,
        en: `
          <h4>Access</h4>
          <p>The "Backup & restore…" button at the bottom of general settings.</p>
          <h4>What gets backed up</h4>
          <p>The displayed tiles, their position, their settings, saved reusable configurations, and free per-widget content (the notepad's text, in particular). Concretely: every configuration file present on the PiBoard at backup time, rather than a fixed list — so a future feature doesn't need a PiBoard update to be included in an upcoming backup.</p>
          <p><b>The mailbox password is never part of it.</b> It lives in a separate encrypted vault (see the Mailbox tile's help), deliberately excluded from every backup — restoring a configuration therefore leaves the Mailbox tile without its password, to be re-entered once. That's the price, judged reasonable, for a backup file never becoming as sensitive an object as a password file.</p>
          <h4>Timestamped snapshots</h4>
          <p>Every backup gets a millisecond-precision timestamped id: a new backup can therefore never overwrite an older one, unlike a single-slot system. The list keeps every backup created until you delete it yourself.</p>
          <h4>File export and import</h4>
          <p>Any backup can be downloaded as a file (handy to keep it off the Raspberry Pi, or to move it to another PiBoard). A file can also be imported: it becomes a new history entry, then is immediately restored. A file that doesn't come from PiBoard, or is corrupted, is cleanly rejected rather than damaging the current configuration.</p>
          <h4>Restoring</h4>
          <p>Always preceded by an explicit confirmation: it's an irreversible action that entirely replaces the current configuration. After confirming, the page reloads to start from a clean state.</p>`
      }
    },

    /* ================= REMERCIEMENTS / CREDITS ================= */
    {
      id: "about",
      group: "credits",
      title: { fr: "À propos", en: "About" },
      sub: {
        fr: "Version, licence et copyright.",
        en: "Version, license, and copyright."
      },
      html: {
        fr: `
          <p>PiBoard <span id="helpAppVersion">…</span></p>
          <p>© 2026 Jean-Michel Ezes. Publié sous licence <b>MIT</b> — un texte complet de la licence accompagne le projet (fichier <code>LICENSE</code> à la racine).</p>
          <p>Projet personnel et open source : <a href="https://github.com/jihemezes/piboard" target="_blank">github.com/jihemezes/piboard</a>.</p>`,
        en: `
          <p>PiBoard <span id="helpAppVersion">…</span></p>
          <p>© 2026 Jean-Michel Ezes. Released under the <b>MIT</b> license — the full license text ships with the project (<code>LICENSE</code> file at the repository root).</p>
          <p>Personal, open-source project: <a href="https://github.com/jihemezes/piboard" target="_blank">github.com/jihemezes/piboard</a>.</p>`
      }
    },

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
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Fonds de carte (Voyager, clair, sombre) des tuiles Carte de trafic, Radar météo et Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Données cartographiques sous-jacentes des fonds de carte CARTO, et service de géocodage (Nominatim) utilisé par la tuile Trajet domicile-travail pour convertir une adresse en coordonnées.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Calcul d'itinéraires et de temps de trajet pour la tuile Trajet domicile-travail.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Prévisions météo (agrégeant plusieurs modèles nationaux), qualité de l'air et pollens (basés sur les prévisions CAMS Europe), et service de recherche de ville utilisé par plusieurs tuiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">RainViewer</span> — <a href="https://www.rainviewer.com" target="_blank">rainviewer.com</a><br><span class="help-opt-desc">Boucle radar de précipitations animée de la tuile Radar météo.</span></div>
          <div class="help-credit"><span class="help-opt-name">adsb.lol / adsb.fi</span> — <a href="https://adsb.lol" target="_blank">adsb.lol</a> · <a href="https://adsb.fi" target="_blank">adsb.fi</a><br><span class="help-opt-desc">Réseaux ADS-B communautaires de la tuile Avions en vue (au choix dans ses réglages).</span></div>
          <div class="help-credit"><span class="help-opt-name">adsbdb</span> — <a href="https://www.adsbdb.com" target="_blank">adsbdb.com</a><br><span class="help-opt-desc">Recherche de trajet (ville de départ/arrivée) et d'informations sur l'appareil (modèle, exploitant) au clic sur un avion, dans la tuile Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">hexdb.io</span> — <a href="https://hexdb.io" target="_blank">hexdb.io</a><br><span class="help-opt-desc">Source de repli pour la recherche de trajet, dans la tuile Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">Openverse</span> — <a href="https://openverse.org" target="_blank">openverse.org</a><br><span class="help-opt-desc">Photos de fond sous licence libre de la tuile Météo, avec crédit du photographe affiché sur la tuile quand disponible.</span></div>
          <div class="help-credit"><span class="help-opt-name">CoinGecko</span> — <a href="https://www.coingecko.com" target="_blank">coingecko.com</a><br><span class="help-opt-desc">Cours et courbes de prix de la tuile Cours de cryptos.</span></div>
          <div class="help-credit"><span class="help-opt-name">ESPN</span> — <a href="https://www.espn.com" target="_blank">espn.com</a><br><span class="help-opt-desc">Scores en direct et classements des tuiles Scores sportifs et Classement.</span></div>
          <div class="help-credit"><span class="help-opt-name">Astronomy Engine</span> — <a href="https://github.com/cosinekitty/astronomy" target="_blank">github.com/cosinekitty/astronomy</a><br><span class="help-opt-desc">Calcul local de la phase de lune et de la position des planètes pour la tuile Astronomie — aucun appel réseau.</span></div>
          <div class="help-credit"><span class="help-opt-name">ISS Pass API (Pollux Labs)</span> — <a href="https://iss-api.polluxlabs.io" target="_blank">iss-api.polluxlabs.io</a><br><span class="help-opt-desc">Prédictions de passage de la Station spatiale internationale pour la tuile Astronomie.</span></div>
          <div class="help-credit"><span class="help-opt-name">Jolpica-F1</span> — <a href="https://api.jolpi.ca" target="_blank">jolpi.ca</a><br><span class="help-opt-desc">Calendrier et horaires des séances de Formule 1 de la tuile Sports mécaniques. Successeur communautaire de l'API Ergast, retirée fin 2024.</span></div>
          <div class="help-credit"><span class="help-opt-name">MotoGP</span> — <a href="https://www.motogp.com" target="_blank">motogp.com</a><br><span class="help-opt-desc">Calendrier et horaires des séances MotoGP de la tuile Sports mécaniques, via le flux public du site officiel.</span></div>
          <div class="help-credit"><span class="help-opt-name">Leaflet</span> — <a href="https://leafletjs.com" target="_blank">leafletjs.com</a><br><span class="help-opt-desc">Bibliothèque de cartographie interactive utilisée par les tuiles Carte de trafic, Radar météo et Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">Mozilla Readability</span> — <a href="https://github.com/mozilla/readability" target="_blank">github.com/mozilla/readability</a><br><span class="help-opt-desc">Extraction du texte lisible d'un article (mode lecture, la même bibliothèque que le mode lecture de Firefox) pour la tuile Flux RSS.</span></div>
          <div class="help-credit"><span class="help-opt-name">GridStack.js</span> — <a href="https://gridstackjs.com" target="_blank">gridstackjs.com</a><br><span class="help-opt-desc">Bibliothèque de grille qui permet de déplacer et redimensionner les tuiles du tableau.</span></div>

          <p style="margin-top:20px">Les flux RSS, dossiers de photos, pages web intégrées et webhooks de notification sont fournis par vous-même — PiBoard ne recommande ni n'héberge aucun contenu de ce type.</p>`,
        en: `
          <p>PiBoard relies on several third-party services and projects, most of them free and keyless. A big thank-you to their teams.</p>

          <div class="help-credit"><span class="help-opt-name">TomTom</span> — <a href="https://www.tomtom.com" target="_blank">tomtom.com</a><br><span class="help-opt-desc">Traffic data (flow and incidents) for the Traffic map tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Base maps (Voyager, light, dark) for the Traffic map, Weather Radar and Planes Overhead tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Underlying map data for the CARTO base maps, and the geocoding service (Nominatim) used by the Commute time tile to turn an address into coordinates.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Route and travel-time computation for the Commute time tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Weather forecasts (aggregating several national models), air quality and pollen (based on the CAMS Europe forecast), and the city search service used by several tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">RainViewer</span> — <a href="https://www.rainviewer.com" target="_blank">rainviewer.com</a><br><span class="help-opt-desc">Animated precipitation radar loop for the Weather Radar tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">adsb.lol / adsb.fi</span> — <a href="https://adsb.lol" target="_blank">adsb.lol</a> · <a href="https://adsb.fi" target="_blank">adsb.fi</a><br><span class="help-opt-desc">Community ADS-B networks for the Planes Overhead tile (your choice in its settings).</span></div>
          <div class="help-credit"><span class="help-opt-name">adsbdb</span> — <a href="https://www.adsbdb.com" target="_blank">adsbdb.com</a><br><span class="help-opt-desc">Route lookup (departure/arrival city) when tapping an aircraft, in the Planes Overhead tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">Openverse</span> — <a href="https://openverse.org" target="_blank">openverse.org</a><br><span class="help-opt-desc">Openly-licensed background photos for the Weather tile, with the photographer credited on the tile when available.</span></div>
          <div class="help-credit"><span class="help-opt-name">CoinGecko</span> — <a href="https://www.coingecko.com" target="_blank">coingecko.com</a><br><span class="help-opt-desc">Prices and price charts for the Crypto prices tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">ESPN</span> — <a href="https://www.espn.com" target="_blank">espn.com</a><br><span class="help-opt-desc">Live scores and standings for the Live sports scores and League standings tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">Astronomy Engine</span> — <a href="https://github.com/cosinekitty/astronomy" target="_blank">github.com/cosinekitty/astronomy</a><br><span class="help-opt-desc">Local computation of moon phase and planet positions for the Astronomy tile — no network call.</span></div>
          <div class="help-credit"><span class="help-opt-name">ISS Pass API (Pollux Labs)</span> — <a href="https://iss-api.polluxlabs.io" target="_blank">iss-api.polluxlabs.io</a><br><span class="help-opt-desc">International Space Station pass predictions for the Astronomy tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">Jolpica-F1</span> — <a href="https://api.jolpi.ca" target="_blank">jolpi.ca</a><br><span class="help-opt-desc">Formula 1 calendar and session times for the Motorsport schedule tile. Community successor to the Ergast API, retired at the end of 2024.</span></div>
          <div class="help-credit"><span class="help-opt-name">MotoGP</span> — <a href="https://www.motogp.com" target="_blank">motogp.com</a><br><span class="help-opt-desc">MotoGP calendar and session times for the Motorsport schedule tile, via the official site's public feed.</span></div>
          <div class="help-credit"><span class="help-opt-name">Leaflet</span> — <a href="https://leafletjs.com" target="_blank">leafletjs.com</a><br><span class="help-opt-desc">Interactive mapping library used by the Traffic map, Weather Radar and Planes Overhead tiles.</span></div>
          <div class="help-credit"><span class="help-opt-name">Mozilla Readability</span> — <a href="https://github.com/mozilla/readability" target="_blank">github.com/mozilla/readability</a><br><span class="help-opt-desc">Readable-text extraction (reader mode, the same library behind Firefox's reader mode) for the RSS feed tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">GridStack.js</span> — <a href="https://gridstackjs.com" target="_blank">gridstackjs.com</a><br><span class="help-opt-desc">Grid library that lets board tiles be dragged and resized.</span></div>

          <p style="margin-top:20px">RSS feeds, photo folders, embedded web pages and notification webhooks are provided by you — PiBoard neither recommends nor hosts any content of that kind.</p>`
      }
    },

    /* Contenu rempli dynamiquement par app.js (showHelpSection()) au
       moment de l'ouverture, via GET /api/changelog -- ce placeholder
       n'est affiche que le temps du chargement. Dynamically filled by
       app.js (showHelpSection()) when opened, via GET /api/changelog --
       this placeholder is only shown while loading. */
    {
      id: "changelog",
      group: "credits",
      title: { fr: "Nouveautés", en: "What's new" },
      sub: {
        fr: "L'historique des versions de PiBoard, directement depuis le tableau.",
        en: "PiBoard's version history, right from the board."
      },
      html: {
        fr: `<p class="help-sub">Chargement…</p>`,
        en: `<p class="help-sub">Loading…</p>`
      }
    },

  ];
})();
