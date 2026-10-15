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
      id: "quickstart",
      group: "presentation",
      title: { fr: "Démarrage rapide", en: "Quick start" },
      sub: {
        fr: "L'essentiel en une minute — le même guide qu'au premier lancement.",
        en: "The gist in one minute — the same guide as on first launch."
      },
      /* Le corps est injecte par showHelpSection() depuis
         quickstart-content.js : source unique, aucune copie a resynchroniser.
         The body is injected by showHelpSection() from
         quickstart-content.js: single source, no copy to keep in sync. */
      html: { fr: "", en: "" }
    },

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
          <p>Pour réorganiser le tableau, activez le <b>mode édition</b> (bouton en forme de cadenas dans la barre d'outils) : les tuiles peuvent alors être glissées pour changer de position, et leurs bords tirés pour changer de taille. Toujours en mode édition, un appui sur une tuile ouvre directement ses réglages — pas besoin de viser la petite icône. En dehors du mode édition, deux icônes discrètes apparaissent au survol ou au tap sur chaque tuile : les <b>curseurs de réglage</b> (réglages de cette tuile) et la croix (la retirer du tableau). Notez la différence avec l'engrenage de la barre d'outils, qui ouvre lui les réglages généraux : curseurs = cette tuile, engrenage = tout PiBoard.</p>
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

          <h4>Quand une tuile ne tient plus à l'écran</h4>
          <p>Quand vous ajoutez une tuile alors que la grille visible est déjà pleine, PiBoard réduit d'abord la nouvelle tuile jusqu'à sa taille minimale pour tenter de la faire tenir. Si même ainsi il n'y a plus de place, elle est posée <b>sous</b> la dernière ligne visible. Dans ce cas seulement, le tableau devient défilant et un fin ascenseur apparaît sur le bord droit ; le tableau défile automatiquement jusqu'à la tuile qui vient d'être ajoutée, pour que vous voyiez tout de suite où elle a atterri.</p>
          <p>Pour défiler : la <b>molette</b> de la souris, ou <b>deux doigts</b> sur un écran tactile. Deux doigts et non un seul, afin qu'un glissement à un doigt reste entièrement disponible aux widgets (déplacer la carte de trafic, faire défiler la liste des courriels…). La molette au-dessus d'une tuile qui défile elle-même, ou au-dessus de la carte de trafic, agit d'abord sur celle-ci : la carte continue donc de zoomer à la molette comme avant.</p>
          <p>Sur un écran où tout tient, <b>rien ne change</b> : aucun ascenseur n'apparaît et le tableau ne défile pas. Si vous ramenez ensuite la tuile dans la zone visible (en mode édition), ou si vous la supprimez, l'ascenseur disparaît de lui-même.</p>

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
          <p>To rearrange the board, turn on <b>edit mode</b> (the lock-shaped button in the toolbar): tiles can then be dragged to change position, and their edges pulled to resize them. Still in edit mode, tapping a tile opens its settings directly — no need to aim for the small icon. Outside edit mode, two discreet icons appear on hover or tap on each tile: the <b>sliders</b> (that tile's settings) and the cross (remove it from the board). Note the difference with the toolbar's gear, which opens the general settings instead: sliders = this tile, gear = all of PiBoard.</p>
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

          <h4>When a tile no longer fits on screen</h4>
          <p>When you add a tile while the visible grid is already full, PiBoard first shrinks the new tile down to its minimum size to try to fit it in. If there is still no room even then, it is placed <b>below</b> the last visible row. In that case only, the board becomes scrollable and a thin scrollbar appears along the right edge; the board scrolls automatically to the tile just added, so you see straight away where it landed.</p>
          <p>To scroll: the mouse <b>wheel</b>, or <b>two fingers</b> on a touchscreen. Two fingers rather than one, so that a one-finger drag stays entirely available to the widgets (panning the traffic map, scrolling the mail list…). The wheel over a tile that scrolls on its own, or over the traffic map, acts on that first: the map therefore still zooms with the wheel as before.</p>
          <p>On a screen where everything fits, <b>nothing changes</b>: no scrollbar appears and the board does not scroll. If you later move the tile back into the visible area (in edit mode), or delete it, the scrollbar goes away on its own.</p>

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
      screenshot: "help-assets/toolbar.png",
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
          <div class="help-opt"><span class="help-opt-name">Aide (?)</span><span class="help-opt-desc">Ouvre l'aide en page pleine. À gauche, l'entrée « Accueil » puis l'arbre des familles et des fiches ; au centre, l'accueil (une carte par famille), puis la fiche choisie découpée en rubriques cliquables, puis l'article ; à droite, « Dans cette fiche » pour passer d'une rubrique à l'autre. La recherche en haut filtre les fiches et leurs rubriques. Le grand bouton « Retour à PiBoard », toujours visible en haut à gauche, referme l'aide. L'encart « Une question, une idée ? » propose « Signaler un bug » et « Écrire au projet » : chacun ouvre directement un ticket sur GitHub, ou son QR code sur un écran sans clavier.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lancer le cadre photo</span><span class="help-opt-desc">Active immédiatement l'écran de veille en mode diaporama, quels que soient les plages horaires programmées ou même si l'économiseur d'écran automatique est désactivé dans les réglages — un geste explicite, indépendant du calendrier. Reprend les mêmes photos que celles configurées dans la section « Écran de veille » des réglages généraux. Un tap, un clic, ou n'importe quelle touche referme le cadre photo et revient au tableau.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quitter le tableau de bord</span><span class="help-opt-desc">Ouvre un petit menu à trois choix (deux hors Linux). <b>Réinitialiser le tableau de bord</b> : recharge PiBoard de zéro dans le navigateur (sans toucher à Chromium) — pratique en cas de blocage visuel ou après une mise à jour du serveur. <b>Revenir au bureau</b> : ferme Chromium et révèle le bureau de Raspberry Pi OS en dessous, sans relancer le tableau de bord — pratique pour une tâche ponctuelle sur l'écran tactile sans clavier ni SSH (redémarrez le Pi, ou rouvrez Chromium vous-même, pour retrouver le tableau ensuite). <b>Éteindre l'ordinateur</b> (Linux uniquement, Raspberry Pi comme PC) : éteint proprement la machine, après confirmation — utile là où PiBoard est justement tout ce qui est affiché, un écran mural n'ayant ni menu de bureau ni bouton d'arrêt à portée ; il faudra rallumer à la main. Si le système refuse, une fenêtre en donne la cause réelle et, quand elle existe, la commande exacte qui la corrige. Le cas le plus courant : une machine installée avant la 1.104.0 puis mise à jour (les mises à jour ne touchent jamais aux fichiers système) — lancez alors une fois <code>sudo bash install/enable-poweroff.sh</code> depuis le dossier de PiBoard, qui accorde cette seule permission. Ce menu est accessible dans les deux modes d'affichage : barre d'outils en mode classique, bandeau du bas en mode tableau de bord. Depuis un autre navigateur (consultation à distance), les options de sortie se contentent de fermer l'onglet, et l'extinction est refusée — éteindre la maison depuis le fond du jardin n'est pas un usage prévu.</span></div>
          <div class="help-opt"><span class="help-opt-name">Replier la barre</span><span class="help-opt-desc">Referme immédiatement la barre d'outils.</span></div>

          <h4>Fenêtre des réglages généraux</h4>
          <p><u>Section Général</u></p>
          <div class="help-opt"><span class="help-opt-name">Langue</span><span class="help-opt-desc">Français ou anglais. S'applique à toute l'interface, y compris le clavier virtuel (AZERTY en français, QWERTY en anglais) et cette aide.</span></div>
          <div class="help-opt"><span class="help-opt-name">Jour / nuit</span><span class="help-opt-desc">Automatique (jour/nuit selon le lever et coucher du soleil réels de votre ville), forcé sur Nuit, ou forcé sur Jour. Choisit la variante du thème de couleurs.</span></div>
          <div class="help-opt"><span class="help-opt-name">Thème de couleurs</span><span class="help-opt-desc">Le bouton « Choisir… » ouvre le sélecteur de thèmes (voir plus bas, <b>Thèmes de couleurs</b>). Le thème choisi ici s'applique à tout le board.</span></div>
          <div class="help-opt"><span class="help-opt-name">Thème de l'aide</span><span class="help-opt-desc">Par défaut, l'aide reprend le thème de PiBoard, jour et nuit compris. Le réglage « Thème dédié à l'aide » lui donne un thème à part, choisi dans la liste (le même catalogue que les thèmes de couleurs). La mise en page tactile suit toujours le « Mode tactile ».</span></div>
          <div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Utilisée uniquement pour calculer les horaires de lever/coucher du soleil du thème automatique. Tapez un nom de ville et choisissez une suggestion dans la liste pour la valider.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lignes de la grille</span><span class="help-opt-desc">Le nombre de lignes logiques que compte la grille en hauteur. Plus ce nombre est élevé, plus chaque tuile peut être finement redimensionnée verticalement — mais des tuiles très fines deviennent plus difficiles à cibler au doigt sur un écran tactile.</span></div>
          <p><u>Section Tiroirs de tuiles</u></p>
          <p>Un champ par tiroir (gauche, haut, droite) donnant sa couverture d'écran en pourcentage — s'applique immédiatement, sans attendre le bouton « Enregistrer » de cette fenêtre. C'est le pendant pratique de la poignée de redimensionnement à la souris sur le bord ouvert de chaque tiroir : celle-ci va jusqu'à 96 % (au-delà, elle sortirait de l'écran et ne serait plus saisissable) ; ces champs permettent d'aller jusqu'à 100 %, ou de corriger la taille si la poignée est difficile à attraper.</p>
          <p><u>Section Couleurs du thème PiBoard</u></p>
          <div class="help-opt"><span class="help-opt-name">Fond / Tuiles, Nuit / Jour</span><span class="help-opt-desc">Retouches rapides du thème PiBoard (le thème d'origine) : couleur de fond et couleur des tuiles, pour chacune des deux variantes. Un bouton rétablit les couleurs par défaut. Toutes les autres couleurs et le style se règlent dans l'éditeur de thèmes.</span></div>
          <p><u>Thèmes de couleurs</u></p>
          <p>Un thème change toutes les couleurs de PiBoard (fond, tuiles, textes, accent, états normal / avertissement / alerte, champs, fenêtres) ainsi que l'<b>arrondi des tuiles</b>, l'<b>épaisseur des bordures</b> et la <b>police</b>. Plus de cinquante thèmes sont livrés : sombres, clairs, très colorés, roses, neutres, monochromes, bichromes, et des thèmes élégants <b>assortis aux fonds de la bibliothèque</b>. Le thème <b>PiBoard</b> reste le thème d'origine, et vos couleurs personnalisées en sont les retouches.</p>
          <p><b>Où l'appliquer.</b> À tout le board (section Général), à une <b>page</b> seulement en mode tableau de bord (bouton ◐ de la ligne de la page), ou à un <b>volet</b> seulement en mode classique (section Tiroirs de tuiles). Une page ou un volet sans thème propre prend celui du board. La couleur personnalisée d'une tuile l'emporte toujours ; les tuiles transparentes adaptent leur texte au fond réellement derrière elles.</p>
          <p><b>Aperçu avant d'appliquer.</b> Le sélecteur s'ouvre sur le côté et laisse le tableau visible : toucher un thème l'affiche aussitôt sur la cible, sans rien enregistrer. « Aperçu en Nuit / Jour » montre l'autre variante. « Annuler » rend exactement l'état précédent ; « Appliquer » enregistre. Quand l'image de fond d'une page correspond à un thème, la famille « Assortis au fond » est proposée d'emblée, et la fenêtre du fond de page le suggère — rien n'est appliqué d'office.</p>
          <p><b>Éditeur.</b> « Nouveau », « Dupliquer » ou « Modifier » (thèmes perso et thème PiBoard) ouvrent l'éditeur : douze couleurs par variante (nuit et/ou jour), arrondi, bordure et police, le tout visible en direct. « Recalculer les nuances » dérive bordures, textes secondaires et champs à partir du fond, des tuiles, du texte et de l'accent. Un thème peut aussi <b>partir d'une image</b> (fond de la bibliothèque, fond de la page affichée ou fichier) : ses couleurs dominantes sont calculées sur place, sans service en ligne. Les thèmes se partagent par <b>export / import</b> de fichiers JSON.</p>
          <p><b>Garde-fou de lisibilité.</b> L'éditeur mesure le contraste de chaque texte (norme WCAG) et liste ce qui serait difficile à lire sur l'écran mural. Tant qu'un texte est illisible, l'enregistrement est bloqué ; « Corriger la lisibilité » ajuste automatiquement les couleurs de texte sans toucher aux fonds choisis.</p>
          <p><u>Section Cartes</u></p>
          <div class="help-opt"><span class="help-opt-name">Clé CARTO des fonds de carte</span><span class="help-opt-desc">Les tuiles <b>Carte de trafic</b>, <b>Radar météo</b> et <b>Avions en vue</b> partagent le même fond de carte, fourni par CARTO. Ce service était historiquement libre d'accès ; il exige désormais une clé. Sans elle, les cartes s'affichent toujours mais chaque tuile d'image est barrée d'un filigrane « API KEY REQUIRED », ce qui donne l'impression que la tuile est cassée alors qu'elle fonctionne.</span></div>
          <p>La clé est <b>gratuite</b> et s'obtient en deux minutes sur <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, sans compte CARTO ni carte bancaire, dans une limite d'usage courant très large (5 millions de tuiles par mois civil, tous services confondus). Elle se saisit <b>une seule fois ici</b> et non dans chaque tuile : les trois affichent le même fond, la ressaisir trois fois n'aurait aucun sens. Le changement s'applique immédiatement, sans recharger la page.</p>
          <p><b>Pourquoi PiBoard n'embarque pas de clé.</b> CARTO délivre des clés par client et interdit de les partager entre projets sans lien. Une clé placée dans le dépôt serait utilisée par toutes les installations à la fois : le quota commun serait épuisé rapidement et, une fois la clé révoquée, les cartes de tout le monde tomberaient d'un coup.</p>
          <p><b>Ce n'est pas un secret.</b> Une clé CARTO circule en clair dans l'adresse de chaque tuile d'image, visible dans l'onglet réseau du navigateur. Elle n'est donc pas rangée dans le coffre chiffré avec les mots de passe, qui donnerait une fausse impression de confidentialité. À ne pas confondre avec la clé <b>TomTom</b> de la tuile Trafic, qui est distincte, se saisit dans les réglages de cette tuile, et ne concerne que les couches de flux et d'incidents posées <i>par-dessus</i> le fond.</p>
          <p><u>Section Écran tactile</u></p>
          <div class="help-opt"><span class="help-opt-name">Clavier virtuel</span><span class="help-opt-desc">Affiche un clavier à l'écran dès qu'un champ de texte est touché — utile sans clavier physique. Suit la langue choisie ci-dessus (AZERTY en français, QWERTY en anglais). S'applique partout où du texte peut être saisi, y compris dans le bloc-notes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Défilement du contenu des tuiles au doigt</span><span class="help-opt-desc">Ne s'applique qu'en mode tactile. Les barres de défilement font quelques pixels de large : dessinées pour la pointe d'une souris, elles sont peu commodes pour un doigt. Et poser le doigt sur le contenu pour le faire glisser sélectionne du texte au lieu de faire défiler. Deux remèdes indépendants, au choix : élargir les barres, glisser le contenu pour le faire défiler, ou les deux (réglage par défaut). La sélection de texte est alors désactivée hors des champs de saisie, où elle reste évidemment nécessaire.</span></div>
          <div class="help-opt"><span class="help-opt-name">Mode tactile</span><span class="help-opt-desc">Agrandit l'ensemble des cibles interactives pour les doigts : boutons de la barre d'outils, languettes des tiroirs, icônes des tuiles, poignées de redimensionnement, champs et cases à cocher des fenêtres de réglages, et le bandeau du mode Tableau de bord, qui double de taille. Ces fenêtres de réglages se réorganisent aussi automatiquement sur plusieurs colonnes quand le contenu le permet, pour limiter le défilement.</span></div>

          <p><u>Section Économiseur d'écran</u></p>
          <p>Jusqu'à 5 plages horaires, chacune avec une heure de début, une heure de fin, et un mode : <b>Noir</b> (l'écran devient entièrement noir) ou <b>Diaporama</b> (l'écran se transforme en cadre photo dynamique, avec sa propre source de photos indépendante de toute tuile Diaporama éventuellement présente sur le tableau). Une plage peut traverser minuit (par exemple 22:00 → 06:00 pour la nuit). Un clic, un tap tactile, ou n'importe quelle touche réveille l'écran instantanément ; une fois réveillée manuellement, la même plage ne se rouvre pas toute seule — il faut attendre la suivante (le lendemain, pour une plage quotidienne).</p>
          <p>Les modes « Noir » et « Diaporama » n'éteignent <b>jamais</b> physiquement l'écran : ce sont des calques logiciels plein écran, qui économisent déjà un peu d'énergie (le tableau cesse d'être activement rendu et rafraîchi) mais laissent la dalle allumée. Un troisième mode, <b>« Éteindre l'écran »</b>, coupe réellement l'alimentation de la sortie vidéo — nettement plus économe, sur Raspberry Pi uniquement. Il reste un choix explicite et non le défaut, à cause du risque qu'un écran réellement éteint ne se rallume pas correctement : un problème documenté sur certains systèmes Linux. Trois précautions l'entourent. Le calque noir est posé malgré tout, si bien qu'une commande qui échoue fait retomber exactement sur l'ancien comportement au lieu de laisser le tableau allumé toute la nuit. Quatre méthodes sont essayées dans l'ordre (wlopm, wlr-randr, xset, vcgencmd), de la plus moderne à la plus ancienne, la pile graphique de Pi OS ayant changé deux fois. Et un bouton <b>Test</b> éteint l'écran cinq secondes puis le rallume seul, en indiquant quelle méthode a fonctionné — de quoi vérifier avant de compter dessus pour la nuit. Le réveil est le même que pour les autres modes : un toucher, une touche ou un mouvement de souris. Écran éteint, la dalle tactile et le clavier continuent d'émettre leurs événements, que le compositeur transmet toujours à la page.</p>
          <div class="help-opt"><span class="help-opt-name">Source des photos (diaporama)</span><span class="help-opt-desc">Téléversement dédié à la veille (géré directement dans cette fenêtre), dossier local, partage WebDAV, ou liste d'URLs — mêmes options que le widget Diaporama.</span></div>
          <div class="help-opt"><span class="help-opt-name">Changer toutes les</span><span class="help-opt-desc">Intervalle en secondes entre deux photos, pour les plages en mode Diaporama.</span></div>
          <p><u>Section Application de bureau</u> (application Mac, Windows ou Linux uniquement)</p>
          <div class="help-opt"><span class="help-opt-name">Lancer PiBoard au démarrage de la session</span><span class="help-opt-desc">Ouvre le tableau de bord à l'ouverture de votre session : élément d'ouverture sous Windows et macOS, fichier de démarrage automatique (<code>~/.config/autostart</code>) sous Linux.</span></div>
          <div class="help-opt"><span class="help-opt-name">Affichage immersif</span><span class="help-opt-desc">En mode tableau de bord, la fenêtre passe en plein écran : ni barre de titre, ni barre des tâches ou Dock. Amenez la souris tout en haut de l'écran, ou appuyez sur F9, pour faire apparaître une fine barre Réduire / Fenêtre / Quitter ; F11 quitte aussi le plein écran.</span></div>
          <p><u>Section Outils multimédias</u></p>
          <p>ffmpeg et VLC, utilisés uniquement par la tuile Chaînes TV (son AC3/DTS inaudible, chaînes récalcitrantes, enregistrement). La section dit s'ils sont présents et, selon le système, propose un bouton <b>Installer</b> (Linux, macOS) ou la commande à taper. Sur Mac, ffmpeg est téléchargé dans le dossier de PiBoard et VLC copié dans Applications, après vérification de son empreinte et de sa signature. En cas d'échec, un message rouge dit pourquoi, avec un bouton <b>Ouvrir le journal</b>. Détails : fiche <i>Chaînes TV</i>.</p>
          <p><u>Section Abonnements presse</u> (application de bureau uniquement)</p>
          <p>Pour lire en entier, dans la tuile Flux RSS, les articles payants des journaux auxquels vous êtes abonné. Choisissez le journal, <b>Ajouter</b>, puis <b>Se connecter</b> : connectez-vous sur le site lui-même, dans la fenêtre qui s'ouvre. PiBoard ne voit jamais votre mot de passe, il garde seulement la session. Un réglage par site, valable pour tous ses flux.</p>
          <div class="help-opt"><span class="help-opt-name">Se connecter / Se reconnecter</span><span class="help-opt-desc">Ouvre la page de connexion du site dans une fenêtre de PiBoard.</span></div>
          <div class="help-opt"><span class="help-opt-name">Se déconnecter</span><span class="help-opt-desc">Efface la session de ce site, et seulement de lui.</span></div>
          <div class="help-opt"><span class="help-opt-name">Retirer</span><span class="help-opt-desc">Enlève le site de la liste et efface sa session.</span></div>
          <div class="help-opt"><span class="help-opt-name">État affiché</span><span class="help-opt-desc">« Non connecté » ; « Session enregistrée » (un site dépose des cookies même sans connexion, ce n'est donc pas encore une preuve) ; « Accès abonné confirmé » dès qu'un article payant a été lu en entier ; « Session sans doute expirée » quand un article payant ne donne plus que l'aperçu.</span></div>
          <p>Détails et indicateurs ✓ / 🔒 de la liste : fiche <i>Flux RSS</i>.</p>
          <p><u>Section Mode d'affichage</u></p>
          <p>Classique (un tableau et ses tiroirs) ou Tableau de bord (des pages qui défilent), défilement automatique et liste des pages. Tout est détaillé dans la fiche <i>Mode tableau de bord (pages)</i>.</p>
          <p><u>Section Mises à jour</u></p>
          <p>Le niveau de mise à jour : versions stables seulement, ou aussi les pré-versions (plus récentes, moins éprouvées). Le même choix vaut pour le Raspberry Pi et pour l'application de bureau, qui vérifie elle-même au démarrage. Voir les fiches <i>Mises à jour sur Raspberry Pi / Linux</i> et celles des applications de bureau.</p>
          <p><u>Section Contribuer</u></p>
          <p>Signaler un bug ou proposer une idée en quelques clics : voir la fiche <i>Signaler un bug, proposer une idée</i>.</p>
          <p><u>Sauvegardes, page du tableau de bord, clone complet</u></p>
          <p>Sauvegarder et restaurer la configuration, reproduire une seule page sur une autre machine, ou cloner toute l'installation : voir la fiche <i>Sauvegarde et restauration</i>.</p>`,
        en: `
          <h4>The toolbar</h4>
          <p>It's hidden by default so it doesn't clutter the display. Tap the small tab centered at the bottom of the screen to reveal it; it closes automatically after 20 seconds of inactivity (except in edit mode, where it stays open). Seven buttons:</p>
          <div class="help-opt"><span class="help-opt-name">+ Add a tile</span><span class="help-opt-desc">Opens the catalog of available widgets. Tap one to add it to the board (or to whichever tile drawer is open at that moment); its settings open right away to configure it.</span></div>
          <div class="help-opt"><span class="help-opt-name">Edit mode (lock)</span><span class="help-opt-desc">Enables dragging and resizing tiles. In edit mode, simply tapping a tile opens its settings directly. Press this button again to lock the board back.</span></div>
          <div class="help-opt"><span class="help-opt-name">Settings (gear)</span><span class="help-opt-desc">Opens the dashboard's general settings window — detailed below.</span></div>
          <div class="help-opt"><span class="help-opt-name">Help (?)</span><span class="help-opt-desc">Opens the help as a full page. On the left, the "Home" entry then the tree of families and pages; in the centre, the home (one card per family), then the chosen page split into clickable sections, then the article; on the right, "On this page" to move between sections. The search at the top filters pages and their sections. The big "Back to PiBoard" button, always visible at the top left, closes the help. The "A question, an idea?" box offers "Report a bug" and "Write to the project": each opens a GitHub issue directly, or its QR code on a screen without a keyboard.</span></div>
          <div class="help-opt"><span class="help-opt-name">Start photo frame</span><span class="help-opt-desc">Immediately turns on the screen saver in slideshow mode, regardless of the programmed time slots or even if the automatic screen saver is disabled in settings — an explicit gesture, independent from the schedule. Reuses the same photos configured in the "Screen saver" section of the general settings. A tap, a click, or any key closes the photo frame and returns to the board.</span></div>
          <div class="help-opt"><span class="help-opt-name">Exit dashboard</span><span class="help-opt-desc">Opens a small three-choice menu (two outside Linux). <b>Reset the dashboard</b>: reloads PiBoard from scratch in the browser (without touching Chromium) — handy after a visual glitch or once a server-side update has been applied. <b>Return to the desktop</b>: closes Chromium and reveals the Raspberry Pi OS desktop underneath, without relaunching the dashboard — handy for a one-off task on the touchscreen without a keyboard or SSH (restart the Pi, or reopen Chromium yourself, to get the dashboard back afterward). <b>Shut down the computer</b> (Linux only, Raspberry Pi as well as PC): powers the machine off properly, after a confirmation — useful precisely where PiBoard is all there is on screen, a wall display having neither a desktop menu nor a power button within reach; you will have to switch it back on by hand. If the system refuses, a window gives the actual cause and, when there is one, the exact command that fixes it. The most common case: a machine installed before 1.104.0 then updated (updates never touch system files) — then run <code>sudo bash install/enable-poweroff.sh</code> once from the PiBoard folder, which grants that single permission. This menu is available in both display modes: the toolbar in classic mode, the bottom bar in dashboard mode. From another browser (remote viewing), the exit options simply close the tab, and shutting down is refused — switching the house off from the bottom of the garden is not an intended use.</span></div>
          <div class="help-opt"><span class="help-opt-name">Collapse the bar</span><span class="help-opt-desc">Immediately closes the toolbar.</span></div>

          <h4>General settings window</h4>
          <p><u>General section</u></p>
          <div class="help-opt"><span class="help-opt-name">Language</span><span class="help-opt-desc">French or English. Applies to the whole interface, including the on-screen keyboard (AZERTY in French, QWERTY in English) and this help.</span></div>
          <div class="help-opt"><span class="help-opt-name">Day / night</span><span class="help-opt-desc">Auto (day/night based on your city's actual sunrise and sunset), forced to Night, or forced to Day. Picks the colour theme's variant.</span></div>
          <div class="help-opt"><span class="help-opt-name">Colour theme</span><span class="help-opt-desc">The "Choose…" button opens the theme picker (see <b>Colour themes</b> below). The theme chosen here applies to the whole board.</span></div>
          <div class="help-opt"><span class="help-opt-name">Help theme</span><span class="help-opt-desc">By default the help follows PiBoard's theme, day and night included. "Dedicated help theme" gives it its own theme, picked from the same catalogue as the colour themes. The touch layout always follows "Touch mode".</span></div>
          <div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Only used to compute sunrise/sunset times for the auto theme. Type a city name and pick a suggestion from the list to validate it.</span></div>
          <div class="help-opt"><span class="help-opt-name">Grid rows</span><span class="help-opt-desc">The number of logical rows the grid has in height. The higher this number, the more finely each tile can be resized vertically — but very thin tiles become harder to target with a finger on a touchscreen.</span></div>
          <p><u>Tile drawers section</u></p>
          <p>One field per drawer (left, top, right) giving its screen coverage as a percentage — applies immediately, no need to wait for this window's "Save" button. This is the practical counterpart to the mouse resize handle on each drawer's open edge: that handle goes up to 96% (beyond that, it would land off-screen and no longer be reachable); these fields let you go up to 100%, or fix the size if the handle is hard to grab.</p>
          <p><u>PiBoard theme colours section</u></p>
          <div class="help-opt"><span class="help-opt-name">Background / Tiles, Night / Day</span><span class="help-opt-desc">Quick tweaks of the PiBoard theme (the original one): background colour and tile colour, for each of its two variants. A button restores the default colours. All other colours and the style are set in the theme editor.</span></div>
          <p><u>Colour themes</u></p>
          <p>A theme changes every PiBoard colour (background, tiles, texts, accent, OK / warning / alert states, fields, windows) as well as the <b>tile corners</b>, the <b>border width</b> and the <b>font</b>. Over fifty themes are shipped: dark, light, colourful, pink, neutral, monochrome, two-tone, and elegant themes <b>matching the library backgrounds</b>. The <b>PiBoard</b> theme remains the original one, and your custom colours are its tweaks.</p>
          <p><b>Where to apply it.</b> To the whole board (General section), to a single <b>page</b> in dashboard mode (◐ button on the page's row), or to a single <b>drawer</b> in classic mode (Tile drawers section). A page or drawer without its own theme uses the board's. A tile's custom colour always wins; transparent tiles adapt their text to the background actually behind them.</p>
          <p><b>Preview before applying.</b> The picker opens on the side and keeps the board visible: touching a theme shows it at once on the target, without saving anything. "Preview as Night / Day" shows the other variant. "Cancel" restores the exact previous state; "Apply" saves. When a page's background image matches a theme, the "Matching the background" family is offered straight away, and the page background window suggests it — nothing is applied automatically.</p>
          <p><b>Editor.</b> "New", "Duplicate" or "Edit" (own themes and the PiBoard theme) open the editor: twelve colours per variant (night and/or day), corners, border and font, all visible live. "Recompute shades" derives borders, secondary texts and fields from the background, tiles, text and accent. A theme can also <b>start from an image</b> (library background, current page background or a file): its dominant colours are computed on the spot, with no online service. Themes are shared by <b>exporting / importing</b> JSON files.</p>
          <p><b>Readability guard.</b> The editor measures the contrast of every text (WCAG standard) and lists what would be hard to read on the wall screen. While a text is unreadable, saving is blocked; "Fix readability" automatically adjusts the text colours without touching the chosen backgrounds.</p>
          <p><u>Maps section</u></p>
          <div class="help-opt"><span class="help-opt-name">CARTO base map key</span><span class="help-opt-desc">The <b>Traffic map</b>, <b>Weather radar</b> and <b>Planes overhead</b> tiles share the same base map, supplied by CARTO. That service was historically open to all; it now requires a key. Without one the maps still appear, but every image tile is stamped with an "API KEY REQUIRED" watermark, which makes the tile look broken when it is in fact working.</span></div>
          <p>The key is <b>free</b> and takes two minutes to obtain at <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, with no CARTO account and no credit card, within a very generous everyday limit (5 million tiles per calendar month across all services). You type it <b>once here</b> rather than in each tile: all three show the same base map, so re-typing it three times would make no sense. The change applies immediately, without reloading the page.</p>
          <p><b>Why PiBoard ships no key.</b> CARTO issues keys per customer and forbids sharing them across unrelated projects. A key placed in the repository would be used by every installation at once: the shared quota would run out quickly and, once the key was revoked, everyone's maps would fail at the same moment.</p>
          <p><b>This is not a secret.</b> A CARTO key travels in the clear inside every image tile's address, visible in the browser's network tab. It is therefore not filed in the encrypted vault alongside passwords, which would give a false impression of confidentiality. Not to be confused with the Traffic tile's <b>TomTom</b> key, which is separate, is entered in that tile's own settings, and concerns only the flow and incident layers drawn <i>on top of</i> the base map.</p>
          <p><u>Touchscreen section</u></p>
          <div class="help-opt"><span class="help-opt-name">On-screen keyboard</span><span class="help-opt-desc">Shows a keyboard on screen as soon as a text field is touched — useful without a physical keyboard. Follows the language chosen above (AZERTY in French, QWERTY in English). Applies everywhere text can be typed, including the notes widget.</span></div>
          <div class="help-opt"><span class="help-opt-name">Scrolling tile content on a touchscreen</span><span class="help-opt-desc">Only applies in touch mode. Scrollbars are a few pixels wide, drawn for a mouse pointer and awkward for a finger; and pressing the content to drag it selects text instead of scrolling. Two independent remedies, your choice: widen the bars, drag the content to scroll, or both (the default). Text selection is then switched off outside input fields, where it of course stays necessary.</span></div>
          <div class="help-opt"><span class="help-opt-name">Touch mode</span><span class="help-opt-desc">Enlarges every interactive target for fingers: toolbar buttons, drawer pull tabs, tile icons, resize handles, and the fields and checkboxes in settings windows. Those settings windows also automatically reorganize into several columns when content allows it, to limit scrolling.</span></div>

          <p><u>Screen saver section</u></p>
          <p>Up to 5 time slots, each with a start time, an end time, and a mode: <b>Black</b> (the screen turns fully black) or <b>Slideshow</b> (the screen becomes a dynamic photo frame, with its own photo source independent from any Slideshow tile that might exist on the board). A slot can cross midnight (e.g. 22:00 → 06:00 for the night). A click, a touch tap, or any key wakes the screen up instantly; once manually woken, the same slot won't reopen on its own — you have to wait for the next one (the next day, for a daily slot).</p>
          <p>The "Black" and "Slideshow" modes never physically turn the screen off: they are full-screen software overlays, which already save some energy (the board stops being actively rendered and refreshed) but leave the panel lit. A third mode, <b>"Turn the display off"</b>, really cuts the video output's power — far more economical, on Raspberry Pi only. It stays an explicit choice rather than the default, because of the risk of a truly powered-off screen failing to come back: a documented issue on some Linux systems. Three precautions surround it. The black overlay is laid down anyway, so a failing command falls back exactly on the old behaviour instead of leaving the board lit all night. Four methods are tried in order (wlopm, wlr-randr, xset, vcgencmd), newest to oldest, Pi OS having changed graphics stack twice. And a <b>Test</b> button turns the display off for five seconds then back on by itself, reporting which method worked — enough to check before relying on it overnight. Waking is the same as for the other modes: a touch, a key or a mouse move. With the display off, the touch panel and keyboard keep emitting their events, which the compositor still delivers to the page.</p>
          <div class="help-opt"><span class="help-opt-name">Photo source (slideshow)</span><span class="help-opt-desc">Upload dedicated to the screensaver (managed directly in this window), local folder, WebDAV share, or a list of URLs — same options as the Slideshow widget.</span></div>
          <div class="help-opt"><span class="help-opt-name">Change every</span><span class="help-opt-desc">Interval in seconds between two photos, for slots in Slideshow mode.</span></div>
          <p><u>Desktop application section</u> (Mac, Windows or Linux application only)</p>
          <div class="help-opt"><span class="help-opt-name">Launch PiBoard when the session starts</span><span class="help-opt-desc">Opens the dashboard when you log in: a login item on Windows and macOS, an autostart file (<code>~/.config/autostart</code>) on Linux.</span></div>
          <div class="help-opt"><span class="help-opt-name">Immersive display</span><span class="help-opt-desc">In dashboard mode, the window goes full screen: no title bar, no taskbar or Dock. Bring the mouse to the very top of the screen, or press F9, to reveal a thin Minimise / Windowed / Quit bar; F11 also leaves full screen.</span></div>
          <p><u>Media tools section</u></p>
          <p>ffmpeg and VLC, used only by the TV channels tile (inaudible AC3/DTS sound, stubborn channels, recording). The section says whether they are present and, depending on the system, offers an <b>Install</b> button (Linux, macOS) or the command to type. On a Mac, ffmpeg is downloaded into PiBoard's folder and VLC copied into Applications, after checking its fingerprint and signature. On failure, a red message says why, with an <b>Open log</b> button. Details: <i>TV channels</i> sheet.</p>
          <p><u>Press subscriptions section</u> (desktop application only)</p>
          <p>To read in full, in the RSS tile, the paid articles of the newspapers you subscribe to. Pick the newspaper, <b>Add</b>, then <b>Log in</b>: log in on the site itself, in the window that opens. PiBoard never sees your password, it only keeps the session. One setting per site, valid for all its feeds.</p>
          <div class="help-opt"><span class="help-opt-name">Log in / Log in again</span><span class="help-opt-desc">Opens the site's login page in a PiBoard window.</span></div>
          <div class="help-opt"><span class="help-opt-name">Log out</span><span class="help-opt-desc">Clears this site's session, and only this one.</span></div>
          <div class="help-opt"><span class="help-opt-name">Remove</span><span class="help-opt-desc">Removes the site from the list and clears its session.</span></div>
          <div class="help-opt"><span class="help-opt-name">Status shown</span><span class="help-opt-desc">“Not logged in”; “Session saved” (a site sets cookies even without a login, so this is not proof yet); “Subscriber access confirmed” once a paid article was read in full; “Session has probably expired” when a paid article only gives the preview again.</span></div>
          <p>Details and the list's ✓ / 🔒 indicators: <i>RSS feed</i> sheet.</p>
          <p><u>Display mode section</u></p>
          <p>Classic (one board and its drawers) or Dashboard (sliding pages), automatic cycling and the list of pages. All detailed in the <i>Dashboard mode (pages)</i> sheet.</p>
          <p><u>Updates section</u></p>
          <p>The update level: stable versions only, or pre-releases too (newer, less tested). The same choice applies to the Raspberry Pi and to the desktop application, which checks by itself on startup. See the <i>Updates on Raspberry Pi / Linux</i> sheet and the desktop application sheets.</p>
          <p><u>Contributing section</u></p>
          <p>Report a bug or suggest an idea in a few clicks: see the <i>Report a bug, suggest an idea</i> sheet.</p>
          <p><u>Backups, dashboard page, full clone</u></p>
          <p>Back up and restore the configuration, reproduce a single page on another machine, or clone the whole installation: see the <i>Backup &amp; restore</i> sheet.</p>`
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
<p>Lire l'heure et la date de loin, et regrouper autour d'elles ce qui rythme la journée : autres fuseaux, réveils, soleil et prochain rendez-vous.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Deux styles</b> : digital (l'heure occupe toute la place et se recalcule à chaque redimensionnement) ou analogique (le cadran garde toute la hauteur, le texte se range à droite) ; secondes en option.</li>
  <li><b>Date du jour</b> en quatre formats, du complet (jour de semaine inclus) au court (JJ/MM/AAAA), sous l'heure ou à côté.</li>
  <li><b>Saint du jour</b> (interface en français) et <b>numéro de semaine</b>, selon la convention ISO 8601 ou simple.</li>
  <li><b>Fuseaux horaires</b> : un fuseau au choix pour l'heure principale, et jusqu'à 3 fuseaux secondaires affichés en petit, façon horloge mondiale ; PiBoard corrige lui-même les fuseaux dont la base embarquée est en retard.</li>
  <li><b>Lever et coucher du soleil</b> de votre ville, avec la durée du jour en option.</li>
  <li><b>Jusqu'à 5 alarmes</b> indépendantes (heure, jours, libellé, son), avec flash plein écran ; un toucher n'importe où les arrête.</li>
  <li><b>Prochain événement</b> d'un calendrier .ics propre à la tuile, sans avoir besoin d'une tuile Agenda.</li>
  <li><b>Fond jour/nuit</b> qui suit le thème solaire du tableau, en couleurs personnalisées ou du thème.</li>
</ul>

<h4>Possibilités</h4>
          <p>En mode digital, l'heure occupe l'espace disponible et se recalcule automatiquement à chaque redimensionnement de la tuile. Sur une tuile large et basse, placez la date à côté de l'heure plutôt qu'en dessous pour mieux exploiter la largeur. En mode analogique, le cadran se cale automatiquement à gauche et la date à droite dès que celle-ci est affichée — le cadran garde ainsi toute la hauteur de la tuile plutôt que de se la partager avec le texte en dessous. En mode digital, la même bascule s'applique dès qu'un fuseau supplémentaire, le numéro de semaine ou le prochain événement sont activés : l'heure se cale à gauche plutôt que de rester centrée au-dessus d'extras empilés, ce qui la comprimerait et nuirait à sa lisibilité. Le format de la date va du complet (jour de semaine inclus) au court (JJ/MM/AAAA), utile pour libérer de la place sur une petite tuile. Le saint du jour, une tradition française, s'ajoute en option à côté de la date (uniquement quand la langue de l'interface est le français) — sa disposition (en dessous ou côte à côte) bascule automatiquement sur « côte à côte » si la tuile est trop basse pour une 2e ligne, afin de ne jamais faire déborder la tuile. Le fond jour/nuit optionnel donne un repère visuel supplémentaire (par exemple un dégradé sombre la nuit), en suivant automatiquement le même thème solaire que le reste du tableau.</p>
          <p><b>Fuseaux horaires</b> : une liste déroulante complète (tous les fuseaux IANA, regroupés par continent) permet de choisir un fuseau qui remplace celui du système pour l'heure principale affichée — pratique pour plusieurs tuiles Horloge, chacune sur un fuseau différent. Jusqu'à 3 fuseaux secondaires supplémentaires s'affichent en petit dans la même tuile, façon horloge mondiale compacte.</p>
          <p><b>Quand un pays change d'heure légale.</b> PiBoard n'embarque pas sa propre table de fuseaux : il lit celle de Chromium/Electron, qui est figée au moment où l'application a été construite — et qui, contrairement à ce qu'on croit, <b>ne dépend pas du tout de votre système</b>. Mettre à jour Windows ou le paquet <code>tzdata</code> du Raspberry Pi ne change donc rien à l'heure affichée. Quand un pays change d'heure légale, cette base met plusieurs mois à rattraper son retard, et l'horloge est fausse d'une heure entre-temps sans que rien ne le signale. PiBoard embarque donc une courte liste de corrections datées (<code>public/tzfix.js</code>) : le premier cas est le <b>Maroc</b>, repassé à GMT (UTC+0) le 20 septembre 2026, de façon permanente et sans plus d'exception pendant le Ramadan. La correction n'est appliquée que si la base embarquée est effectivement en retard, et <b>cesse d'elle-même</b> dès qu'une version à jour est installée — il n'y a rien à faire ni à défaire. Les fuseaux concernés sont marqués « (corrigé par PiBoard) » dans la liste déroulante, et le détail (ce que dit la base, ce que dit la loi, la référence du texte) figure dans <b>Aide → À propos</b>.</p>
          <p><b>Numéro de semaine</b> : affiché en petit sous la date, selon la convention <b>ISO 8601</b> (norme internationale, la plus courante en Europe) ou une convention <b>simple</b> (semaine 1 = celle qui contient le 1er janvier).</p>
          <p><b>Alarmes</b> : jusqu'à 5 alarmes indépendantes, chacune avec son heure, ses jours (tous les jours, jours ouvrés, ou week-end), son libellé et son son — réutilise le même système d'alerte (flash plein écran + son généré) que le widget Compte à rebours. Un bouton « Arrêter » apparaît directement sur la tuile pendant qu'une alarme sonne, mais <b>toucher ou cliquer n'importe où sur l'écran l'arrête aussi</b> — une pastille le rappelle pendant que l'alarme sonne. Pas de bouton « Repousser », choix assumé. <b>Les alarmes sonnent toujours à l'heure réelle du système</b>, jamais selon un fuseau horaire affiché à titre de référence.</p>
          <p><b>Prochain événement</b> : une ligne compacte alimentée par une adresse de calendrier (.ics) propre à la tuile Horloge, indépendante d'une éventuelle tuile Agenda — la tuile continue ainsi de fonctionner seule, même sans tuile Agenda sur le tableau. Limite à connaître : seuls les événements simples (non récurrents) sont détectés pour l'instant, une réunion hebdomadaire définie par une règle de récurrence n'apparaîtra pas.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Digitale (chiffres) ou analogique (aiguilles).</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les secondes</span><span class="help-opt-desc">Ajoute le décompte des secondes.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la date</span><span class="help-opt-desc">Ajoute la date du jour sous ou à côté de l'heure.</span></div>
<div class="help-opt"><span class="help-opt-name">Format de la date</span><span class="help-opt-desc">Complet, long (sans le jour de semaine), moyen (abrégé), ou court (JJ/MM/AAAA).</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le saint du jour</span><span class="help-opt-desc">Tradition française, visible seulement en français.</span></div>
<div class="help-opt"><span class="help-opt-name">Disposition du saint du jour</span><span class="help-opt-desc">En dessous de la date, ou côte à côte — bascule automatiquement sur « côte à côte » si la tuile est trop basse.</span></div>
<div class="help-opt"><span class="help-opt-name">Disposition heure et date</span><span class="help-opt-desc">Uniquement en mode digital avec la date affichée : sous l'heure, ou côte à côte (mieux adapté aux tuiles larges et basses).</span></div>
<div class="help-opt"><span class="help-opt-name">Fond jour/nuit</span><span class="help-opt-desc">Trois choix : <b>Couleurs personnalisées</b> (les deux sélecteurs ci-dessous, comportement par défaut), <b>Couleurs du thème</b> (les deux nuances sont dérivées de la couleur de tuile du thème appliqué) ou <b>Aucun fond</b>. Bascule automatiquement avec le thème du tableau. Tant qu'un fond est activé, il prend le pas sur la couleur personnalisée définie dans la section Apparence de la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de jour</span><span class="help-opt-desc">Les deux couleurs du fond jour/nuit, si celui-ci est activé.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de nuit</span><span class="help-opt-desc">Par défaut : « #0B1220 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Chiffres et aiguilles à la couleur d'accent</span><span class="help-opt-desc">Optionnel. Prend la couleur d'accent du thème — celle des titres de tuiles. Les graduations gardent leur propre contraste pour que le cadran ne vire pas au monochrome.</span></div>
<p class="help-opt-group">Fuseau horaire</p>
<div class="help-opt"><span class="help-opt-name">Fuseau horaire</span><span class="help-opt-desc">Nom IANA (ex. « America/New_York »). Vide = fuseau du système. « (corrigé par PiBoard) » signale un fuseau dont l'heure légale a changé après la base embarquée.</span></div>
<div class="help-opt"><span class="help-opt-name">Fuseau supplémentaire 1–3 : libellé</span><span class="help-opt-desc">Ex. « New York ». Laissez vide pour ne pas utiliser cet emplacement.</span></div>
<div class="help-opt"><span class="help-opt-name">Fuseau supplémentaire 1–3 : fuseau IANA</span><span class="help-opt-desc">Laissez sur « Non utilisé » pour ne pas utiliser cet emplacement.</span></div>
<p class="help-opt-group">Lever &amp; coucher du soleil</p>
<div class="help-opt"><span class="help-opt-name">Afficher le lever et le coucher du soleil</span><span class="help-opt-desc">Calculés localement d'après la ville du tableau (réglages généraux), sans aucun appel réseau. Si l'horloge affiche un autre fuseau, les heures sont affichées dans ce fuseau. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher aussi la durée du jour</span><span class="help-opt-desc">Ajoute le temps écoulé entre le lever et le coucher. Désactivé par défaut.</span></div>
<p class="help-opt-group">Numéro de semaine</p>
<div class="help-opt"><span class="help-opt-name">Afficher le numéro de semaine</span><span class="help-opt-desc">Affichage et convention (ISO 8601 ou simple).</span></div>
<div class="help-opt"><span class="help-opt-name">Convention</span><span class="help-opt-desc">ISO 8601 est la norme internationale, la plus courante en Europe. « Simple » est plus facile à appréhender mais moins standard. Choix : ISO 8601 (semaine 1 = celle du premier jeudi de l'année), Simple (semaine 1 = celle qui contient le 1er janvier). Par défaut : ISO 8601 (semaine 1 = celle du premier jeudi de l'année).</span></div>
<p class="help-opt-group">Prochain événement</p>
<div class="help-opt"><span class="help-opt-name">Afficher le prochain événement</span><span class="help-opt-desc">Activation, adresse .ics, nombre de jours de recherche à l'avance.</span></div>
<div class="help-opt"><span class="help-opt-name">Adresse du calendrier (.ics)</span><span class="help-opt-desc">Indépendant d'une éventuelle tuile Agenda déjà présente — la tuile Horloge continue ainsi de fonctionner seule, même sans tuile Agenda sur le tableau. Seuls les événements simples, non récurrents, sont détectés pour l'instant (une réunion hebdomadaire définie par une règle de récurrence n'apparaîtra pas).</span></div>
<div class="help-opt"><span class="help-opt-name">Recherche jusqu'à (jours)</span><span class="help-opt-desc">De 1 à 60, par défaut 14.</span></div>
<p class="help-opt-group">Alarmes</p>
<div class="help-opt"><span class="help-opt-name">Alarme 1–5 : activée</span><span class="help-opt-desc">Chacune : activée, heure, libellé, jours, son. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Alarme 1–5 : heure</span><span class="help-opt-desc">Par défaut : « 07:00 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Alarme 1–5 : libellé</span><span class="help-opt-desc">Facultatif, ex. « Travail ».</span></div>
<div class="help-opt"><span class="help-opt-name">Alarme 1–5 : jours</span><span class="help-opt-desc">Pour ne sonner qu'une fois, il suffit de désactiver l'alarme après qu'elle a sonné. Choix : Tous les jours, Jours ouvrés (lun–ven), Week-end (sam–dim). Par défaut : Tous les jours.</span></div>
<div class="help-opt"><span class="help-opt-name">Alarme 1–5 : son</span><span class="help-opt-desc">Choix : 🔔 Bip simple, 🔔 Double bip, 🚓 Sirène police, 🚒 Sirène pompiers, 🔥 Alarme incendie, 🚨 Klaxon plongée sous-marine, 🚆 Cloche de passage à niveau, 🔔 Sonnette d'entrée (ding-dong), 🎵 Jingle bref. Par défaut : 🔔 Bip simple.</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 1×1 to 6×5</span>

<h4>Goal</h4>
<p>Read the time and date from across the room, and gather around them what paces the day: other time zones, alarms, the sun and the next appointment.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Two styles</b>: digital (the time fills the tile and resizes with it) or analog (the face keeps the full height, text sits on the right); seconds optional.</li>
  <li><b>Today's date</b> in four formats, from full (weekday included) to short (DD/MM/YYYY), below or beside the time.</li>
  <li><b>French name day</b> (French interface) and <b>week number</b>, ISO 8601 or simple convention.</li>
  <li><b>Time zones</b>: any zone for the main time, plus up to 3 secondary zones shown small, world-clock style; PiBoard itself corrects zones whose embedded database is out of date.</li>
  <li><b>Sunrise and sunset</b> for your city, with the day length as an option.</li>
  <li><b>Up to 5 alarms</b>, each independent (time, days, label, sound), with a full-screen flash; a touch anywhere stops them.</li>
  <li><b>Next event</b> from an .ics calendar of the tile's own, no Calendar tile needed.</li>
  <li><b>Day/night background</b> following the board's sun-based theme, in custom or theme colours.</li>
</ul>

<h4>Possibilities</h4>
          <p>In digital mode, the time fills the available space and automatically recalculates on every tile resize. On a wide, short tile, place the date next to the time rather than below it to make better use of the width. In analog mode, the face automatically sits on the left and the date on the right as soon as the date is shown — the face keeps the tile's full height instead of sharing it with the text below. In digital mode, the same switch happens as soon as an extra time zone, the week number, or the next event is turned on: the time sits on the left rather than staying centered above stacked extras, which would squeeze it and hurt its legibility. The date format ranges from full (weekday included) to short (MM/DD/YYYY), handy for freeing up room on a small tile. The name day, a French tradition, can be added next to the date (only when the interface language is French) — its arrangement (below or side by side) automatically switches to "side by side" when the tile is too short for a 2nd line, so it never overflows the tile. The optional day/night background gives an extra visual cue (e.g. a dark gradient at night), automatically following the same solar theme as the rest of the board.</p>
          <p><b>Time zones</b>: a full drop-down list (every IANA time zone, grouped by continent) lets you pick a zone that replaces the system's for the main displayed time — handy for several Clock tiles, each on a different zone. Up to 3 extra secondary zones show up small in the same tile, for a compact world-clock feel.</p>
          <p><b>When a country changes its legal time.</b> PiBoard ships no time zone table of its own: it reads Chromium/Electron's, which is frozen when the application was built and — contrary to what one would expect — <b>does not depend on your system at all</b>. Updating Windows, or the Raspberry Pi's <code>tzdata</code> package, therefore changes nothing in the displayed time. When a country changes its legal time, that database takes months to catch up, and the clock is an hour off in the meantime with nothing to signal it. PiBoard therefore ships a short list of dated corrections (<code>public/tzfix.js</code>); the first case is <b>Morocco</b>, back on GMT (UTC+0) since 20 September 2026, permanently and with no further Ramadan exception. The correction is applied only while the embedded database is actually behind, and <b>stops by itself</b> once an up-to-date build is installed — there is nothing to do and nothing to undo. Affected zones are flagged “(corrected by PiBoard)” in the drop-down list, and the details (what the database says, what the law says, the reference) appear under <b>Help → About</b>.</p>
          <p><b>Week number</b>: shown small below the date, following either the <b>ISO 8601</b> convention (international standard, most common in Europe) or a <b>simple</b> one (week 1 = the week containing January 1st).</p>
          <p><b>Alarms</b>: up to 5 independent alarms, each with its own time, days (every day, weekdays, or weekend), label and sound — reuses the same alert system (full-screen flash + generated sound) as the Countdown widget. A "Stop" button appears right on the tile while an alarm rings, but <b>tapping or clicking anywhere on the screen also stops it</b> — a chip reminds you of this while it rings. No "Snooze" button, a deliberate choice. <b>Alarms always ring at the system's real time</b>, never according to a time zone shown for reference.</p>
          <p><b>Next event</b>: a compact line fed by a calendar address (.ics) of the Clock tile's own, independent from any Calendar tile — the tile therefore keeps working on its own, even without a Calendar tile on the board. A limit worth knowing: only simple (non-recurring) events are currently detected, a weekly meeting defined via a recurrence rule won't show up.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Choices: Digital, Analog. Default: Digital.</span></div>
<div class="help-opt"><span class="help-opt-name">Show seconds</span><span class="help-opt-desc">Adds the seconds count.</span></div>
<div class="help-opt"><span class="help-opt-name">Show date</span><span class="help-opt-desc">Adds today's date below or next to the time.</span></div>
<div class="help-opt"><span class="help-opt-name">Date format</span><span class="help-opt-desc">Full, long (no weekday), medium (abbreviated), or short (MM/DD/YYYY).</span></div>
<div class="help-opt"><span class="help-opt-name">Show name day (French tradition)</span><span class="help-opt-desc">French tradition, only shown in French.</span></div>
<div class="help-opt"><span class="help-opt-name">Name day arrangement</span><span class="help-opt-desc">Below the date, or side by side — automatically switches to "side by side" when the tile is too short.</span></div>
<div class="help-opt"><span class="help-opt-name">Time and date arrangement</span><span class="help-opt-desc">Digital mode with date shown only: below the time, or side by side (better suited to wide, short tiles).</span></div>
<div class="help-opt"><span class="help-opt-name">Day/night background</span><span class="help-opt-desc">Three choices: <b>Custom colors</b> (the two pickers below, the default), <b>Theme colors</b> (both shades derived from the applied theme's tile color) or <b>No background</b>. Automatically switches with the board's theme. While a background is enabled, it takes precedence over the custom color set in the tile's Appearance section.</span></div>
<div class="help-opt"><span class="help-opt-name">Day color</span><span class="help-opt-desc">The two colors of the day/night background, if enabled.</span></div>
<div class="help-opt"><span class="help-opt-name">Night color</span><span class="help-opt-desc">Default: "#0B1220".</span></div>
<div class="help-opt"><span class="help-opt-name">Digits and hands in the accent color</span><span class="help-opt-desc">Optional. Takes the theme's accent color — the tile titles' one. Tick marks keep their own contrast so the face does not go monochrome.</span></div>
<p class="help-opt-group">Time zone</p>
<div class="help-opt"><span class="help-opt-name">Time zone</span><span class="help-opt-desc">IANA name (e.g. "America/New_York"). Empty = system time zone. “(corrected by PiBoard)” flags a zone whose legal time changed after the embedded database.</span></div>
<div class="help-opt"><span class="help-opt-name">Extra zone 1–3: label</span><span class="help-opt-desc">E.g. "New York". Leave empty to leave this slot unused.</span></div>
<div class="help-opt"><span class="help-opt-name">Extra zone 1–3: IANA time zone</span><span class="help-opt-desc">Leave on “Not used” to leave this slot unused.</span></div>
<p class="help-opt-group">Sunrise &amp; sunset</p>
<div class="help-opt"><span class="help-opt-name">Show sunrise and sunset</span><span class="help-opt-desc">Computed locally from the board's city (general settings), with no network call. If the clock shows another time zone, the times are shown in that zone. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Also show the length of the day</span><span class="help-opt-desc">Adds the time between sunrise and sunset. Off by default.</span></div>
<p class="help-opt-group">Week number</p>
<div class="help-opt"><span class="help-opt-name">Show week number</span><span class="help-opt-desc">Display and convention (ISO 8601 or simple).</span></div>
<div class="help-opt"><span class="help-opt-name">Convention</span><span class="help-opt-desc">ISO 8601 is the international standard, most common in Europe. "Simple" is easier to reason about but less standard. Choices: ISO 8601 (week 1 = week of the year's first Thursday), Simple (week 1 = week containing January 1st). Default: ISO 8601 (week 1 = week of the year's first Thursday).</span></div>
<p class="help-opt-group">Next event</p>
<div class="help-opt"><span class="help-opt-name">Show next event</span><span class="help-opt-desc">Toggle, .ics address, how many days ahead to search.</span></div>
<div class="help-opt"><span class="help-opt-name">Calendar address (.ics)</span><span class="help-opt-desc">Independent from any Calendar tile you may already have — this keeps the Clock tile working on its own, even without one on the board. Only single, non-recurring events are currently detected (a weekly meeting defined via a recurrence rule won't show up).</span></div>
<div class="help-opt"><span class="help-opt-name">Search ahead (days)</span><span class="help-opt-desc">From 1 to 60, default 14.</span></div>
<p class="help-opt-group">Alarms</p>
<div class="help-opt"><span class="help-opt-name">Alarm 1–5: enabled</span><span class="help-opt-desc">Each: enabled, time, label, days, sound. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Alarm 1–5: time</span><span class="help-opt-desc">Default: "07:00".</span></div>
<div class="help-opt"><span class="help-opt-name">Alarm 1–5: label</span><span class="help-opt-desc">Optional, e.g. "Work".</span></div>
<div class="help-opt"><span class="help-opt-name">Alarm 1–5: days</span><span class="help-opt-desc">To ring only once, simply switch the alarm off again after it rings. Choices: Every day, Weekdays (Mon–Fri), Weekend (Sat–Sun). Default: Every day.</span></div>
<div class="help-opt"><span class="help-opt-name">Alarm 1–5: sound</span><span class="help-opt-desc">Choices: 🔔 Simple beep, 🔔 Double beep, 🚓 Police siren, 🚒 Firefighter siren, 🔥 Fire alarm klaxon, 🚨 Submarine dive klaxon, 🚆 Train crossing bell, 🔔 Doorbell (ding-dong), 🎵 Short jingle. Default: 🔔 Simple beep.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Digital (numbers) or analog (hands).</span></div>
`
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
<p>Savoir ce que le ciel offre ce soir, sans application d'astronomie.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Phase de lune</b> du jour, calculée sur la machine (aucun réseau nécessaire).</li>
  <li><b>Passages de la station spatiale (ISS)</b> au-dessus de votre ville, avec le choix de ne garder que les passages visibles à l'œil nu et le nombre de passages listés.</li>
  <li><b>Planètes visibles ce soir</b>, en option avec les planètes lointaines (Uranus, Neptune).</li>
  <li><b>Prochaine éclipse</b> solaire ou lunaire réellement visible depuis votre ville, avec un compte à rebours compact.</li>
  <li>Quatre sections qui s'affichent ou se masquent indépendamment.</li>
</ul>

<h4>Quatre sections indépendantes</h4>
          <p>Chaque section a sa propre case pour l'afficher ou non — activez celles qui vous intéressent, désactivez le reste.</p>
          <p><b>Lune</b> : une icône représentant fidèlement la forme actuelle du croissant ou de la gibbeuse (dans le bon sens selon l'hémisphère), le nom de la phase, le pourcentage d'éclairement, et les dates des prochaines nouvelle et pleine lunes.</p>
          <p><b>Passages ISS</b> : les prochains survols de la Station spatiale internationale au-dessus de votre position, avec l'heure, la direction (d'où elle apparaît vers où elle disparaît), la durée et la hauteur maximale atteinte dans le ciel. Un passage <b>visible à l'œil nu</b> (station éclairée par le soleil, ciel assez sombre chez vous) est mis en évidence — c'est le réglage par défaut pour ne montrer que ceux qui valent la peine de sortir regarder.</p>
          <p><b>Planètes visibles</b> : Mercure à Saturne actuellement au-dessus de l'horizon, triées de la plus haute (la plus facile à repérer) à la plus basse, avec leur direction et leur magnitude — plus ce nombre est négatif, plus la planète est brillante. Uranus et Neptune peuvent être ajoutées en option, mais aucune des deux n'est visible à l'œil nu (des jumelles au minimum sont nécessaires).</p>
          <p><b>Prochaine éclipse</b> : la prochaine éclipse solaire ou lunaire <b>réellement visible depuis la ville</b> renseignée ci-dessus — pas simplement en cours quelque part sur Terre. Une éclipse solaire ne concerne que l'endroit précis où l'ombre de la Lune touche le sol ; une éclipse lunaire, elle, est théoriquement visible depuis toute la moitié nocturne de la Terre, mais la tuile vérifie que la Lune est bien au-dessus de l'horizon à votre position avant de la retenir. Type (partielle, annulaire, totale…), pourcentage d'obscuration, date et heure du maximum, et un petit <b>compte à rebours</b> discret.</p>

<h4>D'où viennent les données</h4>
          <p>La phase de lune et la position des planètes sont <b>calculées directement sur le PiBoard</b>, sans aucun appel réseau — aussi fiable qu'une horloge, jamais tributaire d'un service externe. Les passages ISS, eux, exigent des données orbitales à jour (impossibles à calculer à l'avance) et viennent d'un service communautaire gratuit et sans clé, réédition de l'ancienne API open-notify.org dont les prédictions de passage ont fermé — un projet individuel financé par des dons, à garder à l'esprit si cette section venait un jour à ne plus répondre.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Position</p>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Utilisée pour les passages ISS et la direction/hauteur des planètes — les deux dépendent de la position exacte de l'observateur.</span></div>
<p class="help-opt-group">Lune</p>
<div class="help-opt"><span class="help-opt-name">Afficher la phase de lune</span><span class="help-opt-desc">Activé par défaut.</span></div>
<p class="help-opt-group">Station spatiale internationale</p>
<div class="help-opt"><span class="help-opt-name">Afficher les passages ISS</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Passages visibles uniquement</span><span class="help-opt-desc">Activé par défaut. Décochez pour voir tous les passages au-dessus de l'horizon, y compris ceux en plein jour ou dans l'ombre de la Terre.</span></div>
<div class="help-opt"><span class="help-opt-name">Passages affichés</span><span class="help-opt-desc">De 1 à 10.</span></div>
<p class="help-opt-group">Planètes</p>
<div class="help-opt"><span class="help-opt-name">Afficher les planètes visibles</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Inclure Uranus et Neptune</span><span class="help-opt-desc">Désactivé par défaut.</span></div>
<p class="help-opt-group">Éclipse</p>
<div class="help-opt"><span class="help-opt-name">Afficher la prochaine éclipse</span><span class="help-opt-desc">La prochaine éclipse solaire ou lunaire réellement visible depuis la ville ci-dessus (pas simplement en cours quelque part sur Terre), avec un compte à rebours compact. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Les trois sections évoluent lentement ; un intervalle long suffit largement.</span></div>
`,
        en: `
<span class="help-size">Size: 4×5 by default, from 2×2 to 8×12</span>

<h4>Goal</h4>
<p>Know what the sky has to offer tonight, without an astronomy app.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Moon phase</b> of the day, computed on the machine (no network needed).</li>
  <li><b>International Space Station passes</b> over your city, optionally keeping only those visible to the naked eye, with the number of passes listed.</li>
  <li><b>Planets visible tonight</b>, optionally including the outer planets (Uranus, Neptune).</li>
  <li><b>Next eclipse</b>, solar or lunar, actually visible from your city, with a compact countdown.</li>
  <li>Four sections shown or hidden independently.</li>
</ul>

<h4>Four independent sections</h4>
          <p>Each section has its own checkbox to show it or not — turn on the ones you care about, turn off the rest.</p>
          <p><b>Moon</b>: an icon faithfully depicting the current crescent or gibbous shape (the right way round for your hemisphere), the phase name, the illuminated percentage, and the dates of the next new and full moons.</p>
          <p><b>ISS passes</b>: the International Space Station's upcoming flyovers above your location, with the time, direction (where it appears from and where it disappears to), duration, and the maximum height reached in the sky. A pass that's <b>visible to the naked eye</b> (station sunlit, sky dark enough where you are) is highlighted — the default setting only shows those worth stepping outside for.</p>
          <p><b>Visible planets</b>: Mercury through Saturn currently above the horizon, sorted from highest (easiest to spot) to lowest, with their direction and magnitude — the more negative that number, the brighter the planet. Uranus and Neptune can optionally be added, but neither is visible to the naked eye (at least binoculars are needed).</p>
          <p><b>Next eclipse</b>: the next solar or lunar eclipse <b>actually visible from</b> the city set above — not merely happening somewhere on Earth. A solar eclipse only concerns the exact spot where the Moon's shadow touches the ground; a lunar eclipse is theoretically visible from the whole night half of Earth, but the tile checks the Moon is actually above the horizon at your location before picking it. Type (partial, annular, total…), obscuration percentage, date and time of the peak, and a small, discreet <b>countdown</b>.</p>

<h4>Where the data comes from</h4>
          <p>Moon phase and planet positions are <b>computed directly on the PiBoard</b>, with no network call at all — as reliable as a clock, never dependent on an outside service. ISS passes, though, need up-to-date orbital data (impossible to compute in advance) and come from a free, keyless community service, a rebuild of the old open-notify.org API whose pass predictions shut down — a solo, donation-funded project, worth keeping in mind should this section ever stop responding one day.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Location</p>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Used for ISS passes and the planets' direction/height — both depend on the observer's exact location.</span></div>
<p class="help-opt-group">Moon</p>
<div class="help-opt"><span class="help-opt-name">Show moon phase</span><span class="help-opt-desc">On by default.</span></div>
<p class="help-opt-group">International Space Station</p>
<div class="help-opt"><span class="help-opt-name">Show ISS passes</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Visible passes only</span><span class="help-opt-desc">On by default. Uncheck to see every pass above the horizon, including daytime ones or ones in Earth's shadow.</span></div>
<div class="help-opt"><span class="help-opt-name">Passes shown</span><span class="help-opt-desc">From 1 to 10.</span></div>
<p class="help-opt-group">Planets</p>
<div class="help-opt"><span class="help-opt-name">Show visible planets</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Include Uranus and Neptune</span><span class="help-opt-desc">Off by default.</span></div>
<p class="help-opt-group">Eclipse</p>
<div class="help-opt"><span class="help-opt-name">Show next eclipse</span><span class="help-opt-desc">The next solar or lunar eclipse actually visible from the city above (not merely happening somewhere on Earth), with a compact countdown. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">All three sections change slowly; a long interval is plenty.</span></div>
`
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
          <div class="help-warn"><b>PiBoard ne fournit aucune chaîne ni aucun contenu.</b> Cette tuile est un simple lecteur : elle ne fonctionne que si vous disposez <b>déjà</b> par vous-même d'un abonnement ou d'un accès à un service IPTV, ou d'une playlist de chaînes en libre accès. Sans playlist de votre part, la tuile reste vide — c'est normal, il n'y a rien à débloquer ni à configurer côté PiBoard. Aucune adresse de service n'est fournie, suggérée ni intégrée par défaut, et il vous revient de vous assurer que la source que vous utilisez est légale dans votre pays.</div>

<h4>Objectif</h4>
<p>Regarder une chaîne directement sur le tableau, à partir d'une playlist .m3u que vous fournissez (le format que lisent VLC et Kodi).</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Liste des chaînes</b> à parcourir, filtrer par catégorie ou chercher par nom ; un toucher lance la chaîne dans la tuile.</li>
  <li><b>Démarrage</b> sur la dernière chaîne regardée et/ou son coupé, au choix ; catégorie affichée par défaut.</li>
  <li><b>Films et séries</b> de la playlist lus directement par le navigateur.</li>
  <li><b>Enregistrement</b> de ce que vous regardez, sans seconde connexion chez le fournisseur : enregistrements programmés avec marges, reprise après coupure, durée maximale et garde-fou d'espace disque.</li>
  <li><b>Liste des enregistrements</b> et conversion en .mp4 (aussi depuis la tuile Enregistrements TV).</li>
  <li>Lecture fluide en 720p sur un Raspberry Pi 4 ; la planification de la tuile évite qu'elle tourne en permanence.</li>
</ul>

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
<p>Autres contreparties communes aux deux modes : le flux transite par le PiBoard au lieu d'aller directement du fournisseur au navigateur, et <b>ffmpeg doit être installé</b> — la commande dépend du système : <code>sudo apt install ffmpeg</code> sur un Raspberry Pi ou un PC Linux, <code>brew install ffmpeg</code> sur macOS, <code>winget install Gyan.FFmpeg</code> sous Windows. PiBoard le cherche automatiquement aux emplacements habituels de chaque système. Sous Windows, l'installeur de PiBoard propose de l'installer pour vous, en une étape facultative — pratique la plus simple, si vous ne l'avez pas déjà fait. S'il reste introuvable, la tuile le dit clairement, avec la commande d'installation adaptée à <i>votre</i> système, plutôt que d'échouer sans explication.</p>'activer que sur les flux effectivement muets.<p></p>
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

<h4>Enregistrer une chaîne</h4>
          <p>Pendant la lecture, le bouton <b>⏺</b> lance l'enregistrement de ce que vous regardez, en direct comme en VOD. Le bouton passe au rouge et clignote, avec la durée écoulée et la taille du fichier à côté ; un nouvel appui (<b>⏹</b>) arrête l'enregistrement.</p>
          <p><b>Une seule connexion.</b> Un abonnement IPTV n'autorise généralement qu'un seul flux simultané. L'enregistrement ne se connecte donc pas de son côté : il <b>dérive les octets déjà reçus</b> pour le lecteur. PiBoard lit le flux, l'envoie à l'écran, et en écrit une copie dans un fichier. Conséquence : l'enregistrement est lié au visionnage — changer de chaîne ou fermer le lecteur l'arrête, et seul ce qui suit l'appui est enregistré.</p>
          <p>Le fichier est un <b>.ts</b>, le format tel qu'il sort du fournisseur : rien n'est réencodé, il se lit dans VLC et la plupart des lecteurs Windows, et il reste lisible <b>même tronqué</b> — une coupure de courant en pleine écriture laisse un enregistrement utilisable, là où un .mp4 interrompu serait perdu.</p>
          <p><b>Reprise après coupure</b> : si le flux tombe, le lecteur se reconnecte et l'enregistrement continue dans le même fichier, à la suite. Le nom est construit à partir de la chaîne, du programme quand la source en donne un, et de la date et de l'heure.</p>
          <p>Dans la liste des chaînes, le bouton <b>⏺</b> ouvre les <b>enregistrements déjà réalisés</b> : leur taille, l'espace libre du dossier, <b>mp4</b> pour convertir un fichier (sans réencodage) et <b>✕</b> pour le supprimer. Une conversion qui échoue le dit et ne laisse aucun fichier derrière elle.</p>
          <p>Le bouton <b>🕒</b> programme un enregistrement de la chaîne affichée : <b>jour, heure de début et heure de fin</b>. Une fin antérieure au début désigne le lendemain, pour un film qui déborde après minuit. La même fenêtre liste les enregistrements déjà programmés et permet de les supprimer. Les <b>marges</b> réglées dans les options (quelques minutes avant, une dizaine après) sont ajoutées automatiquement : un programme commence rarement à l'heure exacte et finit souvent en retard.</p>
          <p>Comme l'enregistrement dérive le flux du lecteur, la tuile doit être <b>ouverte et active</b> à l'heure dite : elle se cale alors toute seule sur la chaîne et lance l'enregistrement, qui s'arrête à l'heure de fin.</p>
          <p>ffmpeg est nécessaire (section Outils multimédias des réglages généraux). Le dossier et les garde-fous se règlent dans les options de cette tuile, plus bas.</p>
          <h5>Installer ffmpeg selon votre système</h5>
          <p>ffmpeg n'est pas livré avec PiBoard : il pèse plusieurs centaines de mégaoctets et ne sert qu'à l'enregistrement, à la correction audio (son AC3/DTS inaudible) et aux flux récalcitrants. Il s'ajoute donc à la demande, et la façon de le faire dépend du système :</p>
          <div class="help-opt"><span class="help-opt-name">Windows</span><span class="help-opt-desc">L'installeur de PiBoard le propose au moment de l'installation, en étape facultative. Si vous aviez répondu non, relancez l'installeur : la question revient.</span></div>
          <div class="help-opt"><span class="help-opt-name">Linux, Raspberry Pi</span><span class="help-opt-desc">Un bouton «&nbsp;Installer&nbsp;» dans Réglages → Outils multimédias, qui passe par le gestionnaire de paquets du système. Votre mot de passe est demandé, comme pour toute installation de paquet.</span></div>
          <div class="help-opt"><span class="help-opt-name">macOS</span><span class="help-opt-desc">Le même bouton, mais qui télécharge un binaire autonome (environ 40 Mo) dans le dossier de PiBoard, puis le signe lui-même (signature ad hoc, obligatoire sur Mac Apple Silicon pour qu'un binaire téléchargé puisse s'exécuter) avant de vérifier qu'il démarre réellement. <b>Aucun mot de passe n'est demandé et rien d'autre n'est modifié sur le Mac</b> : ni Homebrew, ni réglage système. Supprimer PiBoard le supprime avec lui. Si vous avez déjà ffmpeg par Homebrew ou MacPorts, PiBoard le trouve tout seul et ne télécharge rien.</span></div>
          <p>Jusqu'à la 1.124.0, macOS était le seul système à ne rien proposer du tout — la tuile signalait l'absence de ffmpeg sans dire comment y remédier. Jusqu'à la 1.140.1, ce bouton ne pouvait pas fonctionner : le fichier qu'il télécharge n'avait jamais été publié sur le dépôt de PiBoard, et le message d'erreur, écrit à la place du texte d'aide dans le même style gris, passait inaperçu. Depuis la 1.140.2, le fichier est publié (binaire signé par son auteur, vérifié avant publication) et toute erreur s'affiche dans un encadré rouge, sous les boutons, avec la conduite à tenir.</p>
          <p><b>En cas d'échec persistant</b>, tapez <code>brew install ffmpeg</code> dans un terminal (si Homebrew est installé) : PiBoard trouve ce ffmpeg tout seul, sans rien télécharger, et la section affiche « présent » à la réouverture des réglages.</p>
          <h5>VLC sur macOS</h5>
          <p>VLC sert à relayer les chaînes en direct qui refusent ffmpeg. Depuis la 1.140.3, le bouton « Installer » de Réglages → Outils multimédias l'installe aussi sur Mac, comme vous le feriez à la main : il télécharge l'<b>image disque officielle de VideoLAN</b> (60 à 100 Mo selon le processeur), puis vérifie son <b>empreinte</b> (une version précise, figée dans PiBoard) et la <b>signature de VideoLAN</b> avant de copier VLC dans le dossier <b>Applications</b>. Si ce dossier n'est pas accessible en écriture (compte standard), VLC va dans votre dossier Applications <b>personnel</b> (<code>~/Applications</code>), sans mot de passe. Un fichier modifié à la source ou mal signé est refusé, jamais installé. VLC installé par vous-même (site de VideoLAN, Homebrew) est trouvé tout seul.</p>
          <h5>Le journal de PiBoard</h5>
          <p>Quand une installation échoue, un bouton <b>« Ouvrir le journal »</b> apparaît sous le message d'erreur (application de bureau uniquement). Le journal est aussi accessible par le menu <b>PiBoard → Ouvrir le journal</b> de l'application ; sur Mac, le fichier est <code>~/Library/Application Support/PiBoard/logs/piboard.log</code>. Il est vidé à chaque lancement : consultez-le avant de redémarrer PiBoard.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Playlist</p>
<div class="help-opt"><span class="help-opt-name">Adresse de la playlist (.m3u)</span><span class="help-opt-desc">L'URL du fichier .m3u.</span></div>
<div class="help-opt"><span class="help-opt-name">Catégorie affichée à l'ouverture (playlists M3U simples uniquement)</span><span class="help-opt-desc">Facultatif. Évite de faire défiler une longue liste à chaque fois.</span></div>
<p class="help-opt-group">Lecture</p>
<div class="help-opt"><span class="help-opt-name">Reprendre automatiquement la dernière chaîne</span><span class="help-opt-desc">Désactivé par défaut : une tuile qui se met à diffuser toute seule sur un écran mural est rarement souhaitable.</span></div>
<div class="help-opt"><span class="help-opt-name">Démarrer sans le son</span><span class="help-opt-desc">Activé par défaut. Les navigateurs refusent de toute façon de démarrer une vidéo sonore sans interaction préalable.</span></div>
<div class="help-opt"><span class="help-opt-name">Plafond de qualité</span><span class="help-opt-desc">720p recommandé sur un Pi.</span></div>
<div class="help-opt"><span class="help-opt-name">Mode de compatibilité</span><span class="help-opt-desc">Pour les chaînes en direct, ce pipeline de réencodage est désormais toujours actif (au moins le niveau audio seul) — les flux en direct sont récupérés en MPEG-TS brut (jamais en playlist HLS), qu'aucun navigateur ne sait lire directement. Ce réglage contrôle uniquement le niveau : « Corriger le son muet uniquement » réencode juste l'audio, en recopiant la vidéo telle quelle (coût mesuré faible : quelques pour cent d'un cœur) ; « Compatibilité totale » réencode aussi la vidéo, utile si une chaîne échoue encore malgré le niveau par défaut. Pour les films et séries, qui se lisent nativement, ce réglage reste entièrement facultatif (désactivé par défaut) — à activer seulement si un titre précis a un son muet ou une vidéo non prise en charge. Les chaînes en direct utilisent automatiquement VLC pour récupérer le flux quand il est installé : certains fournisseurs IPTV rejettent les requêtes directes de ffmpeg seul. Sans VLC installé, le direct se replie sur ffmpeg seul, qui fonctionne toujours pour les fournisseurs sans cette restriction. Nécessite ffmpeg — \`sudo apt install ffmpeg\` sur un Raspberry Pi ou un PC Linux, \`brew install ffmpeg\` sur macOS, \`winget install Gyan.FFmpeg\` sous Windows ; VLC est facultatif mais recommandé pour le direct — \`sudo apt install vlc-bin vlc-plugin-base\`, \`brew install --cask vlc\`, ou \`winget install VideoLAN.VLC\`. Choix : Désactivé (par défaut), Corriger le son muet uniquement (léger), Compatibilité totale (vidéo + audio, plus lourd). Par défaut : Désactivé (par défaut).</span></div>
<p class="help-opt-group">Enregistrement</p>
<div class="help-opt"><span class="help-opt-name">Dossier d'enregistrement</span><span class="help-opt-desc">Le bouton « Parcourir… » ouvre un explorateur des dossiers de la machine qui fait tourner PiBoard — pas de celle qui regarde le tableau — et permet d'y créer un dossier. Le chemin peut aussi se taper à la main : <code>D:\\Videos\\PiBoard</code> sous Windows, <code>/mnt/usb/tv</code> sur le Pi. Vide = le dossier <code>recordings</code> des données de PiBoard. Sur un Pi, un disque USB ou un partage réseau est très préférable à la carte SD.</span></div>
<div class="help-opt"><span class="help-opt-name">Durée maximale (minutes)</span><span class="help-opt-desc">L'enregistrement s'arrête tout seul au bout de ce temps. 0 supprime la limite.</span></div>
<div class="help-opt"><span class="help-opt-name">Arrêter en dessous de (Mo libres)</span><span class="help-opt-desc">Plutôt que de remplir le disque. 0 supprime le garde-fou.</span></div>
<div class="help-opt"><span class="help-opt-name">Lister les enregistrements dans la tuile</span><span class="help-opt-desc">Ajoute le bouton ⏺ dans la liste des chaînes.</span></div>
<div class="help-opt"><span class="help-opt-name">Commencer X minutes avant</span><span class="help-opt-desc">Marges ajoutées aux enregistrements programmés. 2 et 10 minutes par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Finir X minutes après</span><span class="help-opt-desc">Même marge à la fin, pour ne pas manquer le dénouement d'un film qui déborde. De 0 à 120, par défaut 10.</span></div>
`,
        en: `
<span class="help-size">Size: 5×4 by default, from 3×3 to 12×12</span>
          <div class="help-warn"><b>PiBoard provides no channels and no content whatsoever.</b> This tile is a plain player: it only works if you <b>already</b> have, on your own, a subscription or access to an IPTV service, or a freely available channel playlist. With no playlist of yours, the tile stays empty — that is normal, there is nothing to unlock or configure on PiBoard's side. No service address is provided, suggested or bundled by default, and it is up to you to make sure the source you use is legal in your country.</div>

<h4>Goal</h4>
<p>Watch a channel right on the board, from an .m3u playlist you provide (the format VLC and Kodi read).</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Channel list</b> to browse, filter by category or search by name; a touch plays the channel in the tile.</li>
  <li><b>Start-up</b> on the last channel watched and/or muted, as you choose; default category shown.</li>
  <li><b>Films and series</b> from the playlist played directly by the browser.</li>
  <li><b>Recording</b> of what you watch, with no second connection at the provider: scheduled recordings with margins, resume after a drop, maximum duration and disk-space safeguard.</li>
  <li><b>Recording list</b> and conversion to .mp4 (also from the TV recordings tile).</li>
  <li>Smooth 720p on a Raspberry Pi 4; scheduling the tile keeps it from running all the time.</li>
</ul>

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
<p>Other trade-offs common to both modes: the stream transits through the PiBoard instead of going straight from the provider to the browser, and <b>ffmpeg must be installed</b> — the command depends on the system: <code>sudo apt install ffmpeg</code> on a Raspberry Pi or Linux PC, <code>brew install ffmpeg</code> on macOS, <code>winget install Gyan.FFmpeg</code> on Windows. PiBoard looks for it automatically in each system's usual locations. On Windows, PiBoard's installer offers to install it for you, as an optional step — the simplest path, if you haven't already. If it still can't be found, the tile says so clearly, with the install command matching <i>your</i> system, rather than failing without explanation.</p>y enable it on streams that are actually silent.<p></p>
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

<h4>Recording a channel</h4>
          <p>While playing, the <b>⏺</b> button records what you are watching, live or VOD alike. The button turns red and blinks, with elapsed time and file size next to it; pressing it again (<b>⏹</b>) stops the recording.</p>
          <p><b>One single connection.</b> An IPTV subscription usually allows only one simultaneous stream. The recording therefore does not connect on its own side: it <b>taps the bytes already received</b> for the player. PiBoard reads the stream, sends it to the screen, and writes a copy to a file. Consequence: recording is tied to playback — changing channel or closing the player stops it, and only what follows the press is recorded.</p>
          <p>The file is a <b>.ts</b>, the format as it comes from the provider: nothing re-encoded, readable in VLC and most Windows players, and readable <b>even when truncated</b> — a power cut mid-write leaves a usable recording, where an interrupted .mp4 would be lost.</p>
          <p><b>Resuming after a drop</b>: if the feed falls over, the player reconnects and the recording continues in the same file. The name is built from the channel, the programme when the source gives one, and the date and time.</p>
          <p>In the channel list, the <b>⏺</b> button opens the <b>recordings already made</b>: their size, the folder's free space, <b>mp4</b> to convert a file (without re-encoding) and <b>✕</b> to delete it. A failed conversion says so and leaves no file behind.</p>
          <p>The <b>🕒</b> button schedules a recording of the channel on screen: <b>day, start time and end time</b>. An end earlier than the start means the next day, for a film running past midnight. The same window lists the recordings already scheduled and lets you remove them. The <b>margins</b> set in the options (a few minutes before, ten or so after) are added automatically: a programme rarely starts exactly on time and often overruns.</p>
          <p>Since recording taps the player's stream, the tile must be <b>open and active</b> at that time: it then tunes to the channel by itself and starts the recording, which stops at the end time.</p>
          <p>ffmpeg is required (Media tools section of the general settings). The folder and guards are set in this tile's options, below.</p>
          <h5>Installing ffmpeg on your system</h5>
          <p>ffmpeg does not ship with PiBoard: it weighs several hundred megabytes and only serves recording, the audio fix (inaudible AC3/DTS sound) and stubborn streams. It is added on demand, and how depends on the system:</p>
          <div class="help-opt"><span class="help-opt-name">Windows</span><span class="help-opt-desc">PiBoard's installer offers it at install time, as an optional step. If you answered no, run the installer again: the question comes back.</span></div>
          <div class="help-opt"><span class="help-opt-name">Linux, Raspberry Pi</span><span class="help-opt-desc">An “Install” button under Settings → Media tools, going through the system's package manager. Your password is asked, as for any package installation.</span></div>
          <div class="help-opt"><span class="help-opt-name">macOS</span><span class="help-opt-desc">The same button, but it downloads a standalone binary (about 40 MB) into PiBoard's own folder, then signs it itself (an ad hoc signature, required on Apple Silicon Macs for a downloaded binary to run at all) and checks that it actually starts. <b>No password is asked and nothing else on the Mac is changed</b>: no Homebrew, no system setting. Removing PiBoard removes it too. If you already have ffmpeg through Homebrew or MacPorts, PiBoard finds it by itself and downloads nothing.</span></div>
          <p>Until 1.124.0, macOS was the only system offering nothing at all — the tile reported ffmpeg's absence without saying how to fix it. Until 1.140.1, this button could not work: the file it downloads had never been published on PiBoard's repository, and the error message, written in place of the hint text in the same grey style, went unnoticed. Since 1.140.2 the file is published (a binary signed by its author, checked before publication) and any error shows in a red box under the buttons, with what to do about it.</p>
          <p><b>If it keeps failing</b>, type <code>brew install ffmpeg</code> in a terminal (if Homebrew is installed): PiBoard finds that ffmpeg by itself, downloads nothing, and the section shows “present” when the settings are reopened.</p>
          <h5>VLC on macOS</h5>
          <p>VLC relays the live channels that refuse ffmpeg. Since 1.140.3, the “Install” button under Settings → Media tools installs it on a Mac too, as you would by hand: it downloads <b>VideoLAN's official disk image</b> (60 to 100 MB depending on the processor), checks its <b>fingerprint</b> (an exact version, pinned in PiBoard) and <b>VideoLAN's signature</b>, then copies VLC into the <b>Applications</b> folder. If that folder is not writable (standard account), VLC goes to your <b>personal</b> Applications folder (<code>~/Applications</code>), with no password. A file changed at the source or wrongly signed is refused, never installed. A VLC you installed yourself (VideoLAN's site, Homebrew) is found automatically.</p>
          <h5>PiBoard's log</h5>
          <p>When an installation fails, an <b>“Open log”</b> button appears under the error message (desktop application only). The log is also reachable through the application's <b>PiBoard → Open log</b> menu; on a Mac, the file is <code>~/Library/Application Support/PiBoard/logs/piboard.log</code>. It is cleared at every launch: read it before restarting PiBoard.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Playlist</p>
<div class="help-opt"><span class="help-opt-name">Playlist address (.m3u)</span><span class="help-opt-desc">The .m3u file's URL.</span></div>
<div class="help-opt"><span class="help-opt-name">Category shown on opening (simple M3U playlists only)</span><span class="help-opt-desc">Optional. Avoids scrolling a long list every time.</span></div>
<p class="help-opt-group">Playback</p>
<div class="help-opt"><span class="help-opt-name">Resume the last channel automatically</span><span class="help-opt-desc">Off by default: a tile that starts playing on its own on a wall display is rarely what you want.</span></div>
<div class="help-opt"><span class="help-opt-name">Start muted</span><span class="help-opt-desc">On by default. Browsers refuse to start a video with sound without prior interaction anyway.</span></div>
<div class="help-opt"><span class="help-opt-name">Quality cap</span><span class="help-opt-desc">720p recommended on a Pi.</span></div>
<div class="help-opt"><span class="help-opt-name">Compatibility mode</span><span class="help-opt-desc">For live channels, this reencoding pipeline is now always active (at least the audio-only level) — live streams are fetched as raw MPEG-TS (never as an HLS playlist), which no browser can play directly. This setting only controls how much: "Fix silent sound only" re-encodes just the audio, copying the video untouched (measured cheap: a few percent of one core); "Full compatibility" also re-encodes the video, useful if a channel still fails despite the default level. For movies and series, which play natively, this setting stays fully optional (off by default) — only turn it on if a specific title has silent or unsupported video. Live channels automatically use VLC to fetch the stream when it's installed: some IPTV providers reject direct requests from ffmpeg alone. Without VLC installed, live falls back to ffmpeg alone, which still works for providers without this restriction. Requires ffmpeg — \`sudo apt install ffmpeg\` on a Raspberry Pi or Linux PC, \`brew install ffmpeg\` on macOS, \`winget install Gyan.FFmpeg\` on Windows; VLC is optional but recommended for live — \`sudo apt install vlc-bin vlc-plugin-base\`, \`brew install --cask vlc\`, or \`winget install VideoLAN.VLC\`. Choices: Off (default), Fix silent sound only (light), Full compatibility (video + audio, heavier). Default: Off (default).</span></div>
<p class="help-opt-group">Recording</p>
<div class="help-opt"><span class="help-opt-name">Recording folder</span><span class="help-opt-desc">The "Browse…" button opens a browser of the folders on the machine running PiBoard — not the one looking at the board — and lets you create a folder there. The path can also be typed: <code>D:\\Videos\\PiBoard</code> on Windows, <code>/mnt/usb/tv</code> on the Pi. Empty = the <code>recordings</code> folder inside PiBoard's data. On a Pi, a USB disk or a network share is far preferable to the SD card.</span></div>
<div class="help-opt"><span class="help-opt-name">Maximum duration (minutes)</span><span class="help-opt-desc">The recording stops by itself after this. 0 removes the limit.</span></div>
<div class="help-opt"><span class="help-opt-name">Stop below (MB free)</span><span class="help-opt-desc">Rather than filling the disk. 0 removes the guard.</span></div>
<div class="help-opt"><span class="help-opt-name">List the recordings in the tile</span><span class="help-opt-desc">Adds the ⏺ button in the channel list.</span></div>
<div class="help-opt"><span class="help-opt-name">Start X minutes early</span><span class="help-opt-desc">Margins added to scheduled recordings. 2 and 10 minutes by default.</span></div>
<div class="help-opt"><span class="help-opt-name">End X minutes late</span><span class="help-opt-desc">Same margin at the end, so an overrunning film is not cut off. From 0 to 120, default 10.</span></div>
`
      }
    },

    {
      id: "iptvrec",
      group: "tiles",
      title: { fr: "Enregistrements TV", en: "TV recordings" },
      sub: {
        fr: "Ce que la tuile Chaînes TV enregistre en ce moment, l'espace libre, et les enregistrements déjà faits.",
        en: "What the TV channels tile is recording right now, free space, and the recordings already made."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×3 par défaut, de 2×2 à 12×16</span>

<h4>Objectif</h4>
<p>Surveiller les enregistrements de la tuile Chaînes TV sans garder le lecteur sous les yeux.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Enregistrement en cours</b> : chaîne, durée écoulée et taille du fichier.</li>
  <li><b>Espace libre</b> restant dans le dossier d'enregistrement.</li>
  <li><b>Enregistrements terminés</b>, en nombre réglable, à convertir en .mp4 ou supprimer d'un toucher.</li>
  <li>Continue de fonctionner quand la tuile Chaînes TV est fermée ou sur une autre page.</li>
</ul>

<h4>Ce qu'elle montre</h4>
          <p>L'enregistrement en cours (chaîne, durée écoulée, taille du fichier), l'espace libre restant dans le dossier d'enregistrement, et la liste des enregistrements terminés. Chacun peut être <b>converti en .mp4</b> (sans réencodage) ou <b>supprimé</b> d'ici.</p>
          <p>Les enregistrements se <b>lancent</b> depuis la tuile Chaînes TV, avec son bouton ⏺ ou une programmation 🕒 : voir la fiche <i>Chaînes TV</i>. ffmpeg est nécessaire (Réglages → Outils multimédias).</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Lister les enregistrements déjà réalisés</span><span class="help-opt-desc">Décochez pour ne garder que l'enregistrement en cours et l'espace libre.</span></div>
<div class="help-opt"><span class="help-opt-name">Combien en lister</span><span class="help-opt-desc">De 1 à 100 (10 par défaut), les plus récents d'abord.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher l'espace libre</span><span class="help-opt-desc">L'espace restant dans le dossier d'enregistrement.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (secondes)</span><span class="help-opt-desc">De 3 à 300 secondes (10 par défaut).</span></div>
`,
        en: `
<span class="help-size">Size: 3×3 by default, from 2×2 to 12×16</span>

<h4>Goal</h4>
<p>Keep an eye on the TV channels tile's recordings without keeping the player in view.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Recording in progress</b>: channel, elapsed time and file size.</li>
  <li><b>Free space</b> left in the recording folder.</li>
  <li><b>Finished recordings</b>, in an adjustable number, to convert to .mp4 or delete with a touch.</li>
  <li>Keeps working while the TV channels tile is closed or on another page.</li>
</ul>

<h4>What it shows</h4>
          <p>The recording in progress (channel, elapsed time, file size), the free space left in the recording folder, and the list of finished recordings. Each can be <b>converted to .mp4</b> (no re-encoding) or <b>deleted</b> from here.</p>
          <p>Recordings are <b>started</b> from the TV channels tile, with its ⏺ button or a 🕒 schedule: see the <i>TV channels</i> sheet. ffmpeg is required (Settings → Media tools).</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">List the recordings already made</span><span class="help-opt-desc">Untick to keep only the recording in progress and the free space.</span></div>
<div class="help-opt"><span class="help-opt-name">How many to list</span><span class="help-opt-desc">1 to 100 (10 by default), most recent first.</span></div>
<div class="help-opt"><span class="help-opt-name">Show free space</span><span class="help-opt-desc">The space left in the recording folder.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (seconds)</span><span class="help-opt-desc">3 to 300 seconds (10 by default).</span></div>
`
      }
    },

    {
      id: "teleprog",
      group: "tiles",
      title: { fr: "Programme TV", en: "TV guide" },
      sub: {
        fr: "Le programme du soir des cha\u00eenes fran\u00e7aises, avec grille plein \u00e9cran, recherche et rappels avant le d\u00e9but d'une \u00e9mission.",
        en: "Tonight's schedule for French channels, with a full-screen grid, search and reminders before a show starts."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×8 par défaut, de 2×5 à 6×16</span>

<h4>Objectif</h4>
<p>Savoir ce qui passe ce soir d'un coup d'œil, sans allumer la télévision ni ouvrir un magazine. La tuile, haute et étroite, se prête bien à une colonne sur le côté du tableau.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Trois vues</b> à basculer sur la tuile : <b>En ce moment</b> (avec barre de progression), <b>Ce soir</b> (1<sup>re</sup> partie de soirée) et <b>2<sup>e</sup> partie</b>.</li>
  <li><b>Synopsis</b> d'un toucher, pastille « inédit », vignette, catégorie et numéro de chaîne TNT (chacun masquable).</li>
  <li><b>Grille plein écran</b> (chaînes en lignes, heures en colonnes), avec zoom, logos et recherche.</li>
  <li><b>Recherche</b> d'une émission par son titre.</li>
  <li><b>Rappels</b> avant le début d'une émission : flash, son, et webhook pour prévenir ailleurs (téléphone, enceinte…).</li>
  <li><b>Sources</b> : xmltvfr.fr clé en main (TNT, câble/satellite…), votre propre fichier XMLTV, ou une page à analyser (expérimental) ; chaînes choisies et ordonnées par vous.</li>
  <li><b>Détection de la soirée</b> réglable (heures, fenêtre de début, durée minimale) pour les chaînes au programme décalé.</li>
</ul>

<h4>Possibilités</h4>
          <p>Les données proviennent par défaut de <b>xmltvfr.fr</b>, un projet communautaire qui publie librement les grilles des chaînes françaises au format XMLTV. Plusieurs guides y sont proposés (TNT, chaînes du câble/satellite…) ; vous pouvez aussi fournir votre propre URL ou fichier XMLTV si vous disposez d'une autre source.</p>
          <p>Trois vues sont accessibles directement depuis la tuile :</p>
          <ul>
            <li><b>Ce soir</b> — la première partie de soirée, c'est-à-dire le programme principal de chaque chaîne.</li>
            <li><b>2<sup>e</sup> partie</b> — ce qui suit dans la soirée.</li>
            <li><b>En ce moment</b> — ce qui passe à l'instant, avec une barre de progression indiquant où en est chaque émission.</li>
          </ul>
          <p>Un bouton ouvre une <b>grille plein écran</b> classique (chaînes en lignes, heures en colonnes), avec zoom, recherche et logos des chaînes — pratique pour parcourir la soirée entière confortablement. La barre de recherche permet de retrouver une émission par son titre.</p>

<h4>Comment la première partie de soirée est déterminée</h4>
          <p>Les chaînes ne démarrent pas toutes leur programme principal à la même minute, et les grilles publiées contiennent quantité de courtes séquences (météo, bandes-annonces, jeux) qu'il ne faut surtout pas confondre avec le film du soir. PiBoard retient donc, pour chaque chaîne, la première émission qui commence dans une <b>fenêtre horaire acceptée</b> et qui dure assez longtemps pour être un vrai programme.</p>
          <p>C'est le rôle des réglages « début au plus tôt / au plus tard » et « durée minimale ». Si une chaîne affiche systématiquement la mauvaise émission, ce sont ces valeurs qu'il faut ajuster : élargir la fenêtre si son programme démarre plus tôt ou plus tard que la moyenne, ou augmenter la durée minimale si une séquence courte est retenue à tort.</p>

<h4>Rappels avant le début d'une émission</h4>
          <p>Touchez une émission pour demander à en être averti avant qu'elle commence. À l'heure dite, PiBoard peut faire clignoter tout l'écran, jouer un son (des haut-parleurs sur l'écran sont alors nécessaires), et appeler un webhook pour relayer l'alerte ailleurs — vers un téléphone, par exemple. L'alerte s'arrête d'un appui n'importe où sur l'écran.</p>
          <p>Le rappel se demande aussi bien depuis la liste de la tuile que depuis la <b>grille complète</b> : dans la grille, touchez un bloc pour le déplier, un bouton de cloche y apparaît sous le synopsis. Il n'est proposé que pour une diffusion à venir — une émission déjà commencée n'a plus rien à déclencher. C'est la seule façon d'armer un rappel pour une émission qui passe après ce soir, puisque la liste de la tuile ne va pas au-delà.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Source des données</p>
<div class="help-opt"><span class="help-opt-name">Source des données</span><span class="help-opt-desc">xmltvfr.fr (recommandé), une URL ou un fichier XMLTV personnel, ou une page à analyser (expérimental).</span></div>
<div class="help-opt"><span class="help-opt-name">Guide xmltvfr.fr</span><span class="help-opt-desc">Quel bouquet récupérer : TNT, câble/satellite, etc.</span></div>
<div class="help-opt"><span class="help-opt-name">URL ou chemin XMLTV personnalisé</span><span class="help-opt-desc">Utilisé uniquement avec la source « XMLTV personnalisé ». Une URL http(s) (un fichier .gz est décompressé automatiquement) ou un chemin de fichier local sur le Pi.</span></div>
<div class="help-opt"><span class="help-opt-name">URL de la page à scraper (expérimental)</span><span class="help-opt-desc">Utilisé uniquement avec la source « Scraping de site ». Fragile par nature : le HTML d'un site peut changer à tout moment. Préférez XMLTV pour une tuile permanente.</span></div>
<p class="help-opt-group">Chaînes</p>
<div class="help-opt"><span class="help-opt-name">Chaînes (une par ligne, dans l'ordre d'affichage)</span><span class="help-opt-desc">Une chaîne par ligne. Vous pouvez utiliser des noms lisibles (ex. « France 2 ») ou les identifiants XMLTV exacts (ex. « France2.fr »). Réordonnez les lignes pour réordonner la tuile. Supprimez les lignes non voulues. Passer au guide « France » ou à une source XMLTV personnalisée ne change PAS cette liste automatiquement — utilisez « Parcourir les chaînes disponibles » ci-dessous pour voir et ajouter ce que la source nouvellement sélectionnée propose réellement. Par défaut : « TF1
France 2
France 3
Canal+
France 5
M6
Arte
C8
W9
TMC
TFX
NRJ 12
France 4
BFM TV
CNews
CStar
Gulli
TF1 Séries Films
L'Équipe
6ter
RMC Story
RMC Découverte
Chérie 25
LCI
Franceinfo ».</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Vue au démarrage</span><span class="help-opt-desc">Ce soir, 2<sup>e</sup> partie de soirée, ou En ce moment.</span></div>
<div class="help-opt"><span class="help-opt-name">1re partie de soirée à</span><span class="help-opt-desc">Heure de référence de chaque partie de soirée.</span></div>
<div class="help-opt"><span class="help-opt-name">1re partie : début au plus tôt accepté</span><span class="help-opt-desc">Fenêtre dans laquelle une émission est acceptée comme programme principal — voir l'explication ci-dessus.</span></div>
<div class="help-opt"><span class="help-opt-name">1re partie : début au plus tard accepté</span><span class="help-opt-desc">Aucun programme démarrant après cette heure ne peut être retenu comme 1re partie de soirée, même s'il est très long. C'est ce qui empêche une émission de 2e partie de soirée démarrant tard (souvent à partir de 22h) d'être choisie par erreur simplement parce qu'elle est la plus longue trouvée près de l'heure cible. Par défaut : « 21:30 ».</span></div>
<div class="help-opt"><span class="help-opt-name">2e partie de soirée à</span><span class="help-opt-desc">Par défaut : « 22:45 ».</span></div>
<div class="help-opt"><span class="help-opt-name">1re partie : durée minimale (minutes)</span><span class="help-opt-desc">Ignore les cases courtes (météo, bandes-annonces, intercalaire entre deux pages de pub) même si elles sont plus proches de l'heure cible, au profit de la plus longue émission trouvée dans la fenêtre de démarrage acceptée (voir les deux réglages ci-dessus). Mettre à 0 pour désactiver et prendre simplement le programme le plus proche, quelle que soit sa durée. De 0 à 180, par défaut 30.</span></div>
<div class="help-opt"><span class="help-opt-name">2e partie : durée minimale (minutes)</span><span class="help-opt-desc">Écarte les séquences trop courtes (météo, bandes-annonces) pour ne retenir qu'un vrai programme.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les vignettes des émissions</span><span class="help-opt-desc">Désactivez pour économiser le réseau sur le Pi (les vignettes sont récupérées sur internet, une par émission quand disponible). Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la catégorie de l'émission</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le numéro de la chaîne TNT</span><span class="help-opt-desc">À décocher pour alléger l'affichage sur une tuile étroite.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la barre de recherche</span><span class="help-opt-desc">Masquent les commandes correspondantes si vous ne vous en servez pas.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la barre de progression « en cours »</span><span class="help-opt-desc">Une fine barre de progression sous toute émission réellement en cours de diffusion (début ≤ maintenant ≤ fin), quelle que soit la vue affichée. Activé par défaut.</span></div>
<p class="help-opt-group">Grille plein écran</p>
<div class="help-opt"><span class="help-opt-name">Afficher le bouton de grille plein écran</span><span class="help-opt-desc">Un bandeau en bas de la tuile ouvre une grande grille façon magazine TV : une ligne par chaîne, les programmes disposés sur une échelle de temps, avec zoom et recherche. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Heures affichées avant maintenant</span><span class="help-opt-desc">Étendue de la grille plein écran autour de l'heure courante.</span></div>
<div class="help-opt"><span class="help-opt-name">Heures affichées après maintenant</span><span class="help-opt-desc">Jusqu'où la grille s'étend. 6 h couvrent la soirée ; augmentez pour anticiper davantage — une fenêtre très large rend chaque bloc plus étroit, le zoom permet de compenser. De 1 à 48, par défaut 6.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement pour « Ce soir » / « 2e partie » (minutes)</span><span class="help-opt-desc">Fréquence à laquelle ces deux vues rechargent le guide. Le serveur met aussi la source en cache 30 min, donc des valeurs très basses ne solliciteront pas la source plus souvent que ça. La vue « En ce moment » a son propre calendrier intelligent — voir ci-dessous. De 5 à 240, par défaut 30.</span></div>
<div class="help-opt"><span class="help-opt-name">« En ce moment » : plafond de rafraîchissement (minutes)</span><span class="help-opt-desc">La vue « En ce moment » ne sonde pas à intervalle fixe : elle se reprogramme juste au moment où le programme en cours doit se terminer, pour changer d'émission (à peu près) à la bonne minute. Ce réglage n'est qu'un plafond de sécurité, utilisé quand la source ne fournit pas d'heure de fin. De 1 à 30, par défaut 5.</span></div>
<p class="help-opt-group">Rappels</p>
<div class="help-opt"><span class="help-opt-name">Me rappeler avant le début (minutes)</span><span class="help-opt-desc">Touchez l'icône 🔔 sur une émission à venir pour être prévenu ce nombre de minutes avant son début. Réutilise la même alerte à l'écran que la tuile Compte à rebours (flash/son ci-dessous), et survit à un rechargement de page. De 1 à 60, par défaut 5.</span></div>
<div class="help-opt"><span class="help-opt-name">Faire clignoter tout l'écran</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Jouer un son (nécessite des haut-parleurs sur l'écran)</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Son</span><span class="help-opt-desc">Tous les sons sont synthétisés à la volée (aucun fichier audio, fonctionne hors-ligne). Choix : 🔔 Bip simple, 🔔 Double bip, 🔔 Sonnette d'entrée (ding-dong), 🚆 Cloche de passage à niveau, 🎵 Jingle bref. Par défaut : 🔔 Sonnette d'entrée (ding-dong).</span></div>
<div class="help-opt"><span class="help-opt-name">Durée de l'alerte (secondes)</span><span class="help-opt-desc">Le flash et le son continuent pendant cette durée. C'est un simple rappel, pas un réveil — volontairement court par défaut. De 5 à 120, par défaut 20.</span></div>
<div class="help-opt"><span class="help-opt-name">URL webhook de notification (optionnel, {message} = le texte ci-dessous)</span><span class="help-opt-desc">Adresse appelée au moment de l'alerte, pour la relayer ailleurs (SMS, Alexa, notification sur le téléphone…). <code>{message}</code> y est remplacé par le texte du message. Laisser vide pour ne rien appeler.</span></div>
<div class="help-opt"><span class="help-opt-name">Méthode du webhook</span><span class="help-opt-desc">Choix : GET, POST (corps = message). Par défaut : GET.</span></div>
<div class="help-opt"><span class="help-opt-name">Message de la notification (optionnel, {title} et {channel} disponibles)</span><span class="help-opt-desc">Texte envoyé au webhook à la place du message par défaut. <code>{title}</code> et <code>{channel}</code> y sont remplacés par l'émission et la chaîne.</span></div>
`,
        en: `
<span class="help-size">Size: 3×8 by default, from 2×5 to 6×16</span>

<h4>Goal</h4>
<p>See what's on tonight at a glance, without turning on the TV or opening a magazine. The tall, narrow tile suits a column at the side of the board.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Three views</b> switched on the tile: <b>On now</b> (with a progress bar), <b>Tonight</b> (prime time) and <b>Late evening</b>.</li>
  <li><b>Synopsis</b> with a touch, "new" badge, thumbnail, category and channel number (each can be hidden).</li>
  <li><b>Full-screen grid</b> (channels as rows, hours as columns), with zoom, logos and search.</li>
  <li><b>Search</b> for a show by its title.</li>
  <li><b>Reminders</b> before a show starts: flash, sound, and a webhook to alert elsewhere (phone, speaker…).</li>
  <li><b>Sources</b>: ready-made xmltvfr.fr (terrestrial, cable/satellite…), your own XMLTV file, or a page to scrape (experimental); channels chosen and ordered by you.</li>
  <li><b>Evening detection</b> adjustable (times, start window, minimum duration) for channels with shifted schedules.</li>
</ul>

<h4>Possibilities</h4>
          <p>Data comes by default from <b>xmltvfr.fr</b>, a community project that freely publishes French channel listings in the XMLTV format. Several guides are offered there (terrestrial, cable/satellite…); you can also supply your own XMLTV URL or file if you have another source.</p>
          <p>Three views are available straight from the tile:</p>
          <ul>
            <li><b>Tonight</b> — the evening's main programme on each channel.</li>
            <li><b>Late evening</b> — what follows later that night.</li>
            <li><b>On now</b> — what's airing right this minute, with a progress bar showing how far along each show is.</li>
          </ul>
          <p>A button opens a classic <b>full-screen grid</b> (channels as rows, hours as columns), with zoom, search and channel logos — handy for browsing the whole evening comfortably. The search bar finds a show by title.</p>

<h4>How the evening's main programme is determined</h4>
          <p>Channels don't all start their main programme at the same minute, and published listings contain plenty of short slots (weather, trailers, quizzes) that must not be mistaken for tonight's film. For each channel, PiBoard therefore keeps the first show that starts within an <b>accepted time window</b> and runs long enough to be a real programme.</p>
          <p>That's what the “earliest / latest start” and “minimum duration” settings are for. If a channel consistently shows the wrong programme, those are the values to adjust: widen the window if its schedule starts earlier or later than average, or raise the minimum duration if a short slot is being picked by mistake.</p>

<h4>Reminders before a show starts</h4>
          <p>Tap a show to be alerted before it begins. At the set time, PiBoard can flash the whole screen, play a sound (speakers on the screen are then required), and call a webhook to relay the alert elsewhere — to a phone, for instance. The alert stops with a tap anywhere on the screen.</p>
          <p>A reminder can be set from the tile's list as well as from the <b>full grid</b>: in the grid, tap a block to expand it and a bell button appears under the synopsis. It is only offered for an upcoming broadcast — a programme already under way has nothing left to fire. This is the only way to arm a reminder for a show airing after tonight, since the tile's list does not reach that far.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Data source</p>
<div class="help-opt"><span class="help-opt-name">Data source</span><span class="help-opt-desc">xmltvfr.fr (recommended), your own XMLTV URL or file, or a page to scrape (experimental).</span></div>
<div class="help-opt"><span class="help-opt-name">xmltvfr.fr guide</span><span class="help-opt-desc">Which bouquet to fetch: terrestrial, cable/satellite, and so on.</span></div>
<div class="help-opt"><span class="help-opt-name">Custom XMLTV URL or path</span><span class="help-opt-desc">Only used with the "Custom XMLTV" source. An http(s) URL (a .gz file is decompressed automatically) or a local file path on the Pi.</span></div>
<div class="help-opt"><span class="help-opt-name">Scraping page URL (experimental)</span><span class="help-opt-desc">Only used with the "Website scraping" source. Fragile by nature: a site's HTML can change at any time. Prefer XMLTV for a permanent tile.</span></div>
<p class="help-opt-group">Channels</p>
<div class="help-opt"><span class="help-opt-name">Channels (one per line, in display order)</span><span class="help-opt-desc">One channel per line. You can use readable names (e.g. "France 2") or exact XMLTV ids (e.g. "France2.fr"). Reorder the lines to reorder the tile. Remove lines you don't want. Switching to the "France" guide or a custom XMLTV source does NOT change this list by itself — use "Browse available channels" below to see and add what the newly selected source actually offers. Default: "TF1
France 2
France 3
Canal+
France 5
M6
Arte
C8
W9
TMC
TFX
NRJ 12
France 4
BFM TV
CNews
CStar
Gulli
TF1 Séries Films
L'Équipe
6ter
RMC Story
RMC Découverte
Chérie 25
LCI
Franceinfo".</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">View on load</span><span class="help-opt-desc">Tonight, late evening, or on now.</span></div>
<div class="help-opt"><span class="help-opt-name">Prime-time starts at</span><span class="help-opt-desc">Default: "21:00".</span></div>
<div class="help-opt"><span class="help-opt-name">Prime time: earliest accepted start</span><span class="help-opt-desc">The window within which a show is accepted as the main programme — see the explanation above.</span></div>
<div class="help-opt"><span class="help-opt-name">Prime time: latest accepted start</span><span class="help-opt-desc">No program starting after this time can be selected as prime time, however long it runs. This is what keeps a late-starting second-part-evening program (often from 10pm) from being wrongly picked just because it happens to be the longest show found near the target hour. Default: "21:30".</span></div>
<div class="help-opt"><span class="help-opt-name">Late night starts at</span><span class="help-opt-desc">Reference time for each part of the evening. Default: "22:45".</span></div>
<div class="help-opt"><span class="help-opt-name">Prime time: minimum duration (minutes)</span><span class="help-opt-desc">Discards slots that are too short (weather, trailers) so only a real programme is kept.</span></div>
<div class="help-opt"><span class="help-opt-name">Late night: minimum duration (minutes)</span><span class="help-opt-desc">Same idea as above, for the late-night slot. Lower by default since late-night programs (debates, documentaries) tend to be shorter than prime time. From 0 to 180, default 20.</span></div>
<div class="help-opt"><span class="help-opt-name">Show program thumbnails</span><span class="help-opt-desc">Turn off to save network on the Pi (thumbnails are fetched from the internet, one per program when available). On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show program category</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show TNT channel number</span><span class="help-opt-desc">Uncheck to lighten the display on a narrow tile.</span></div>
<div class="help-opt"><span class="help-opt-name">Show search bar</span><span class="help-opt-desc">Hide the matching controls if you don't use them.</span></div>
<div class="help-opt"><span class="help-opt-name">Show "on air" progress bar</span><span class="help-opt-desc">A thin progress bar under any program that's actually airing right now (start ≤ now ≤ end), whichever view you're on. On by default.</span></div>
<p class="help-opt-group">Full-screen grid</p>
<div class="help-opt"><span class="help-opt-name">Show the full-screen grid button</span><span class="help-opt-desc">A bar at the bottom of the tile opens a large TV-magazine-style grid: one row per channel, programs laid out on a time scale, with zoom and search. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Hours shown before now</span><span class="help-opt-desc">How far the full-screen grid extends around the current time.</span></div>
<div class="help-opt"><span class="help-opt-name">Hours shown after now</span><span class="help-opt-desc">How far ahead the grid goes. 6 h covers the evening; raise it to plan further ahead — a very wide window makes each block narrower, use the zoom to compensate. From 1 to 48, default 6.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Refresh for "Tonight" / "Late night" (minutes)</span><span class="help-opt-desc">How often those two views re-fetch the guide. The server also caches the source for 30 min, so very low values won't hit the source more often than that. The "On now" view has its own smart schedule — see below. From 5 to 240, default 30.</span></div>
<div class="help-opt"><span class="help-opt-name">"On now": refresh ceiling (minutes)</span><span class="help-opt-desc">The "On now" view doesn't poll blindly: it reschedules itself right when the current program is expected to end, so it switches programs at (about) the right minute. This setting is only a safety-net ceiling, used when no end time is available from the source. From 1 to 30, default 5.</span></div>
<p class="help-opt-group">Reminders</p>
<div class="help-opt"><span class="help-opt-name">Remind me before start (minutes)</span><span class="help-opt-desc">Tap the 🔔 icon on an upcoming program to be reminded this many minutes before it starts. Reuses the same on-screen alert as the Countdown tile (flash/sound below), and survives a page reload. From 1 to 60, default 5.</span></div>
<div class="help-opt"><span class="help-opt-name">Flash the whole screen</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Play a sound (needs speakers on the screen)</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Sound</span><span class="help-opt-desc">All sounds are synthesized on the fly (no audio files, works offline). Choices: 🔔 Simple beep, 🔔 Double beep, 🔔 Doorbell (ding-dong), 🚆 Train crossing bell, 🎵 Short jingle. Default: 🔔 Doorbell (ding-dong).</span></div>
<div class="help-opt"><span class="help-opt-name">Alert duration (seconds)</span><span class="help-opt-desc">The flash and sound keep going for this long. This is a heads-up, not an alarm clock — kept short by default. From 5 to 120, default 20.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification webhook URL (optional, {message} = the text below)</span><span class="help-opt-desc">Address called when the alert fires, to relay it elsewhere (SMS, Alexa, phone notification…). <code>{message}</code> is replaced by the message text. Leave empty to call nothing.</span></div>
<div class="help-opt"><span class="help-opt-name">Webhook method</span><span class="help-opt-desc">Choices: GET, POST (body = message). Default: GET.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification message (optional, {title} and {channel} available)</span><span class="help-opt-desc">Text sent to the webhook instead of the default message. <code>{title}</code> and <code>{channel}</code> are replaced by the show and the channel.</span></div>
`
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
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Plusieurs calendriers</b> iCal (.ics) fusionnés, chacun dans sa couleur : Google Agenda, iCloud/iPhone, Nextcloud, Outlook ou tout lien ICS public.</li>
  <li><b>Deux vues</b> à basculer sur la tuile : liste des prochains événements, ou grille de la semaine (début le lundi ou le dimanche).</li>
  <li><b>Horizon</b> de recherche en jours, et événements « toute la journée » affichés ou masqués.</li>
  <li><b>Détail d'un événement</b> d'un toucher.</li>
  <li><b>Événements récurrents</b> et occurrences déplacées ou modifiées correctement pris en compte.</li>
</ul>

<h4>Possibilités</h4>
          <p>Chaque ligne du champ « Calendriers » est une source ICS distincte, fusionnée avec les autres et distinguée par une couleur attribuée automatiquement dans l'ordre des lignes ; une légende apparaît en bas de la tuile dès que plusieurs calendriers sont configurés. Deux vues restent accessibles en un geste directement sur la tuile (onglets), sans passer par les réglages : la liste des prochains événements groupés par jour, ou une grille de la semaine façon calendrier mural avec la colonne du jour mise en évidence. Les événements récurrents sont gérés (quotidien, hebdomadaire, mensuel — y compris « 2e lundi du mois » —, annuel), de même que les occurrences uniques déplacées ou annulées.</p>
          <p>Dans la grille semaine, les flèches ‹ › déplacent la fenêtre affichée d'une semaine entière à la fois, sans temps de chargement (les événements sont déjà tous en mémoire, seule la fenêtre affichée change). L'étiquette centrale rappelle la période affichée et se met en évidence dès qu'on s'éloigne de la semaine actuelle ; la toucher ramène directement à aujourd'hui. Quitter puis revenir sur l'onglet Semaine réinitialise toujours la navigation.</p>
          <p>Le réglage « Disposition de la grille semaine » propose, en plus de la semaine calendaire classique, deux fenêtres glissantes toujours ancrées sur aujourd'hui — utile pour ne jamais avoir de jours passés vides à l'écran : aujourd'hui en première colonne, ou centré au milieu du tableau.</p>

<h4>Ajouter un calendrier iPhone / iCloud</h4>
          <p>Dans l'app Calendrier : appuyez sur un calendrier → <b>Partager le calendrier</b> → <b>Calendrier public</b> → <b>Copier le lien</b>. Le lien commence par <code>webcal://</code> : PiBoard le convertit automatiquement, collez-le tel quel.</p>
          <p>Pour <b>Google Agenda</b> : réglages du calendrier → « Intégrer l'agenda » → « Adresse secrète au format iCal ». Pour <b>Nextcloud</b> ou <b>Outlook</b> : utilisez leur lien de partage public/ICS du calendrier.</p>

<h4>Voir le détail d'un événement</h4>
          <p>Dans la <b>grille semaine</b>, les colonnes sont étroites et le libellé d'un événement y est tronqué à deux lignes. <b>Touchez une pastille</b> pour ouvrir son détail complet : titre entier, jour et plage horaire, lieu et description. Les champs vides sont simplement omis. Refermez d'un appui sur la croix, à l'extérieur de la fenêtre, ou avec la touche Échap.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Calendriers (un lien ICS par ligne)</span><span class="help-opt-desc">Un calendrier par ligne. Ajoutez un libellé optionnel après un &lt;code&gt;|&lt;/code&gt;, ex. &lt;code&gt;https://exemple.com/famille.ics|Famille&lt;/code&gt; — sinon un nom générique est utilisé. Chaque calendrier reçoit automatiquement sa propre couleur, dans l'ordre des lignes. &lt;br&gt;&lt;br&gt;&lt;b&gt;iPhone / iCloud :&lt;/b&gt; dans l'app Calendrier, appuyez sur un calendrier → &lt;i&gt;Partager le calendrier&lt;/i&gt; → &lt;i&gt;Calendrier public&lt;/i&gt; → &lt;i&gt;Copier le lien&lt;/i&gt; (commence par &lt;code&gt;webcal://&lt;/code&gt;, converti automatiquement). &lt;br&gt;&lt;b&gt;Google Agenda :&lt;/b&gt; paramètres du calendrier → &lt;i&gt;Intégrer l'agenda&lt;/i&gt; → &lt;i&gt;Adresse secrète au format iCal&lt;/i&gt;. &lt;br&gt;&lt;b&gt;Nextcloud / Outlook :&lt;/b&gt; utilisez leur lien de partage public/ICS du calendrier.</span></div>
<div class="help-opt"><span class="help-opt-name">Vue par défaut</span><span class="help-opt-desc">Liste ou grille semaine — les deux restent accessibles en un geste sur la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Vue liste : jours à venir</span><span class="help-opt-desc">Fenêtre de la vue liste, en jours.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les événements toute la journée</span><span class="help-opt-desc">Anniversaires, jours fériés, etc.</span></div>
<div class="help-opt"><span class="help-opt-name">La semaine commence le lundi</span><span class="help-opt-desc">Sinon, dimanche. S'applique uniquement à la disposition « Semaine calendaire classique ».</span></div>
<div class="help-opt"><span class="help-opt-name">Disposition de la grille semaine</span><span class="help-opt-desc">Semaine calendaire classique, ou fenêtre glissante toujours ancrée sur aujourd'hui (en début ou au milieu du tableau).</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux relectures des calendriers.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 8×8</span>

<h4>Goal</h4>
<p>See the whole family's upcoming events at a glance, without opening a calendar app.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Several calendars</b> in iCal (.ics) format merged, each in its own colour: Google Calendar, iCloud/iPhone, Nextcloud, Outlook or any public ICS link.</li>
  <li><b>Two views</b> switched on the tile: list of upcoming events, or week grid (starting Monday or Sunday).</li>
  <li><b>Look-ahead</b> in days, and all-day events shown or hidden.</li>
  <li><b>Event details</b> with a touch.</li>
  <li><b>Recurring events</b> and moved or modified occurrences handled correctly.</li>
</ul>

<h4>Possibilities</h4>
          <p>Each line in the "Calendars" field is a separate ICS source, merged with the others and told apart by a color assigned automatically in line order; a legend appears at the bottom of the tile once more than one calendar is configured. Two views stay one tap away right on the tile (tabs), no need to open settings: an upcoming-events list grouped by day, or a week grid in a wall-calendar style with today's column highlighted. Recurring events are handled (daily, weekly, monthly — including "2nd Monday of the month" —, yearly), as well as single moved or cancelled occurrences.</p>
          <p>In the week grid, the ‹ › arrows move the displayed window a full week at a time, with no loading delay (every event is already in memory, only the displayed window changes). The center label recalls the displayed period and lights up as soon as you've navigated away from the current week; tapping it jumps straight back to today. Leaving and returning to the Week tab always resets the navigation.</p>
          <p>The "Week grid layout" setting offers, besides the standard calendar week, two sliding windows always anchored on today — handy to never have empty past days on screen: today in the first column, or centered in the middle of the grid.</p>

<h4>Adding an iPhone / iCloud calendar</h4>
          <p>In the Calendar app: tap a calendar → <b>Share Calendar</b> → <b>Public Calendar</b> → <b>Copy Link</b>. The link starts with <code>webcal://</code>: PiBoard converts it automatically, paste it as is.</p>
          <p>For <b>Google Calendar</b>: calendar settings → "Integrate calendar" → "Secret address in iCal format". For <b>Nextcloud</b> or <b>Outlook</b>: use their calendar's public/ICS sharing link.</p>

<h4>Seeing an event's details</h4>
          <p>In the <b>week grid</b>, columns are narrow and an event's label is clipped to two lines there. <b>Tap a chip</b> to open its full details: complete title, day and time range, location and description. Empty fields are simply omitted. Close it with the cross, by tapping outside the window, or with the Escape key.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Calendars (one ICS link per line)</span><span class="help-opt-desc">One calendar per line. Add an optional label after a &lt;code&gt;|&lt;/code&gt;, e.g. &lt;code&gt;https://example.com/family.ics|Family&lt;/code&gt; — otherwise a generic name is used. Each calendar gets its own color automatically, assigned in line order. &lt;br&gt;&lt;br&gt;&lt;b&gt;iPhone / iCloud:&lt;/b&gt; in the Calendar app, tap a calendar → &lt;i&gt;Share Calendar&lt;/i&gt; → &lt;i&gt;Public Calendar&lt;/i&gt; → &lt;i&gt;Copy Link&lt;/i&gt; (starts with &lt;code&gt;webcal://&lt;/code&gt;, handled automatically). &lt;br&gt;&lt;b&gt;Google Calendar:&lt;/b&gt; calendar Settings → &lt;i&gt;Integrate calendar&lt;/i&gt; → &lt;i&gt;Secret address in iCal format&lt;/i&gt;. &lt;br&gt;&lt;b&gt;Nextcloud / Outlook:&lt;/b&gt; use their calendar's public/ICS sharing link.</span></div>
<div class="help-opt"><span class="help-opt-name">Default view</span><span class="help-opt-desc">List or week grid — both stay one tap away on the tile.</span></div>
<div class="help-opt"><span class="help-opt-name">List view: days ahead</span><span class="help-opt-desc">The list view's window, in days.</span></div>
<div class="help-opt"><span class="help-opt-name">Show all-day events</span><span class="help-opt-desc">Birthdays, public holidays, etc.</span></div>
<div class="help-opt"><span class="help-opt-name">Week starts on Monday</span><span class="help-opt-desc">Otherwise, Sunday. Only applies to the "Standard calendar week" layout.</span></div>
<div class="help-opt"><span class="help-opt-name">Week grid layout</span><span class="help-opt-desc">Standard calendar week, or a sliding window always anchored on today (at the start or in the middle of the grid).</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two calendar reads.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Calendars</span><span class="help-opt-desc">One ICS link per line, with an optional label after a <code>|</code> (e.g. <code>https://example.com/family.ics|Family</code>).</span></div>
`
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
<p>Savoir combien de temps il faut, maintenant, pour rejoindre le travail ou tout autre trajet régulier — avec le trafic réel — et à quelle heure partir.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Trajet principal</b> en voiture entre deux adresses (A et B), dans les deux sens, avec le trafic du moment.</li>
  <li><b>Comparaison au temps habituel</b> pour ce jour et cette heure, et <b>alerte colorée</b> au-delà de seuils de retard modéré et fort que vous fixez.</li>
  <li><b>Heure de départ conseillée</b> quand une heure d'arrivée souhaitée est renseignée (au travail, au retour).</li>
  <li><b>Jusqu'à 5 trajets supplémentaires</b> vers des destinations nommées, chacun avec son heure d'arrivée souhaitée.</li>
  <li><b>Suggestions d'adresses</b> pendant la saisie, pour confirmer la bonne adresse avant d'enregistrer.</li>
  <li>Disposition au choix, et clé TomTom partagée avec la tuile Carte de trafic.</li>
</ul>

<h4>Possibilités</h4>
          <p>Renseignez une adresse A (typiquement le domicile) et une adresse B (le travail) : la tuile affiche le temps estimé A→B, B→A, ou les deux, calculé par TomTom en tenant compte du trafic réel du moment. À côté de la durée, un retard coloré compare ce temps au temps habituel pour ce jour et cette heure (vert à l'heure, orange retard modéré, rouge fort retard — seuils réglables) — par exemple « 25 min (+10 min) ». Si vous renseignez une heure d'arrivée souhaitée pour un trajet, TomTom calcule le trajet en tenant compte du trafic <i>prévu</i> à ce moment futur et une heure de départ conseillée apparaît sous la durée ; sans heure d'arrivée renseignée, la tuile affiche simplement le temps en direct, maintenant. Au-delà de ce trajet principal, jusqu'à 5 trajets supplémentaires peuvent être ajoutés — par exemple « Chez Maman », « Chez Papa », « École de Léo » — chacun calculé depuis l'adresse A vers sa propre destination, avec sa propre heure d'arrivée souhaitée optionnelle. Avec plusieurs trajets, la disposition empilée (un par ligne) reste lisible même sur une tuile étroite ; la disposition côte à côte convient mieux à un trajet unique sur une tuile large. Le géocodage des adresses reste gratuit (OpenStreetMap Nominatim) ; seul le calcul d'itinéraire passe par TomTom.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Trajet principal</p>
<div class="help-opt"><span class="help-opt-name">Adresse A (ex. domicile)</span><span class="help-opt-desc">Les deux extrémités du trajet principal. Propose des suggestions cliquables pendant la saisie (recherche après une courte pause, comme la recherche de ville des paramètres généraux) : cliquer une suggestion remplit le champ avec l'adresse complète telle que comprise — plus besoin de taper une adresse parfaitement formée, ni d'attendre un « itinéraire indisponible » pour savoir si l'adresse posait problème.</span></div>
<div class="help-opt"><span class="help-opt-name">Adresse B (ex. travail)</span><span class="help-opt-desc">Adresse d'arrivée du trajet principal (par exemple le travail). Choisissez une suggestion pendant la saisie pour confirmer la bonne adresse.</span></div>
<div class="help-opt"><span class="help-opt-name">Clé API TomTom</span><span class="help-opt-desc">La même clé gratuite que la tuile Trafic (developer.tomtom.com). Cette tuile a son propre compteur de quota quotidien, affiché en petit sur la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Sens</span><span class="help-opt-desc">A→B, B→A, ou les deux.</span></div>
<div class="help-opt"><span class="help-opt-name">Heure d'arrivée souhaitée, A → B</span><span class="help-opt-desc">Optionnel. Une fois renseignée, une heure de départ conseillée apparaît, calculée avec le trafic prévu pour cette heure.</span></div>
<div class="help-opt"><span class="help-opt-name">Heure d'arrivée souhaitée, B → A</span><span class="help-opt-desc">Optionnel. Une fois renseignée, affiche une heure de départ conseillée d'après le trafic prévu pour cette arrivée. Laissez vide pour afficher simplement le temps de trajet en direct, maintenant.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Disposition des trajets</span><span class="help-opt-desc">Côte à côte (tuiles larges) ou empilés (tuiles hautes/étroites, ou plusieurs trajets supplémentaires).</span></div>
<p class="help-opt-group">Trajets supplémentaires</p>
<div class="help-opt"><span class="help-opt-name">Trajet supplémentaire 1–5 — nom (ex. Maman)</span><span class="help-opt-desc">Chacun avec un nom, une adresse de destination (mêmes suggestions cliquables que ci-dessus), et sa propre heure d'arrivée souhaitée optionnelle. Un emplacement sans nom ou sans adresse est simplement ignoré ; l'échec du calcul d'un trajet n'empêche pas l'affichage des autres.</span></div>
<div class="help-opt"><span class="help-opt-name">Trajet supplémentaire 1–5 — adresse de destination</span><span class="help-opt-desc">Chaque trajet supplémentaire est calculé depuis l'adresse A (ex. domicile) vers sa destination. Laissez nom et adresse vides pour désactiver un emplacement. Jusqu'à 5 trajets supplémentaires.</span></div>
<div class="help-opt"><span class="help-opt-name">Trajet supplémentaire 1–5 — heure d'arrivée souhaitée</span><span class="help-opt-desc">Optionnel. Affiche une heure de départ conseillée pour ce trajet.</span></div>
<p class="help-opt-group">Seuils d'alerte</p>
<div class="help-opt"><span class="help-opt-name">Seuil de retard modéré (minutes)</span><span class="help-opt-desc">En minutes de retard par rapport au temps habituel, au-delà desquels la durée passe à l'orange puis au rouge.</span></div>
<div class="help-opt"><span class="help-opt-name">Seuil de retard fort (minutes)</span><span class="help-opt-desc">Retard par rapport au temps habituel, au-delà duquel la durée passe au rouge. De 2 à 180, par défaut 20.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux recalculs. Chaque rafraîchissement peut déclencher plusieurs requêtes TomTom (une par trajet actif).</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 1×1 to 6×4</span>

<h4>Goal</h4>
<p>Know how long it takes, right now, to get to work or along any regular route — with real traffic — and when to leave.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Main route</b> by car between two addresses (A and B), both ways, with current traffic.</li>
  <li><b>Comparison with the usual time</b> for this day and hour, and a <b>coloured alert</b> beyond moderate and heavy delay thresholds you set.</li>
  <li><b>Recommended departure time</b> when a desired arrival time is set (at work, back home).</li>
  <li><b>Up to 5 extra routes</b> to named destinations, each with its own desired arrival time.</li>
  <li><b>Address suggestions</b> while typing, to confirm the right address before saving.</li>
  <li>Choice of layout, and a TomTom key shared with the Traffic map tile.</li>
</ul>

<h4>Possibilities</h4>
          <p>Enter an address A (typically home) and an address B (work): the tile shows the estimated time A→B, B→A, or both, computed by TomTom accounting for the moment's real traffic. Next to the duration, a colored delay compares this time to the usual time for that day and hour (green on time, orange moderate delay, red heavy delay — adjustable thresholds) — for example "25 min (+10 min)". If you set a desired arrival time for a trip, TomTom computes it accounting for the traffic <i>predicted</i> at that future moment, and a suggested departure time appears below the duration; without a desired arrival time, the tile simply shows the live time, right now. Beyond this main trip, up to 5 extra trips can be added — for instance "Mom's place", "Dad's place", "Leo's school" — each computed from address A to its own destination, with its own optional desired arrival time. With several trips, the stacked layout (one per line) stays readable even on a narrow tile; the side-by-side layout suits a single trip on a wide tile better. Address geocoding stays free (OpenStreetMap Nominatim); only route computation goes through TomTom.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Main route</p>
<div class="help-opt"><span class="help-opt-name">Address A (e.g. home)</span><span class="help-opt-desc">The two ends of the main trip. Offers clickable suggestions as you type (searches after a short pause, like the general settings' city search): clicking a suggestion fills the field with the full address as understood — no need to type a perfectly-formed address, or wait for a "route unavailable" message to find out the address itself was the problem.</span></div>
<div class="help-opt"><span class="help-opt-name">Address B (e.g. work)</span><span class="help-opt-desc">Destination of the main route (for example work). Pick a suggestion while typing to confirm the right address.</span></div>
<div class="help-opt"><span class="help-opt-name">TomTom API key</span><span class="help-opt-desc">The same free key as the Traffic tile (developer.tomtom.com). This tile has its own daily quota counter, shown small on the tile.</span></div>
<div class="help-opt"><span class="help-opt-name">Direction</span><span class="help-opt-desc">A→B, B→A, or both.</span></div>
<div class="help-opt"><span class="help-opt-name">Desired arrival time, A → B</span><span class="help-opt-desc">Optional. Once set, a suggested departure time appears, computed with predicted traffic for that hour.</span></div>
<div class="help-opt"><span class="help-opt-name">Desired arrival time, B → A</span><span class="help-opt-desc">Optional. When set, shows a suggested departure time based on predicted traffic for that arrival. Leave empty to just show the live travel time for right now.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Trip arrangement</span><span class="help-opt-desc">Side by side (wide tiles) or stacked (tall/narrow tiles, or several extra trips).</span></div>
<p class="help-opt-group">Extra trips</p>
<div class="help-opt"><span class="help-opt-name">Extra trip 1–5 — name (e.g. Mom)</span><span class="help-opt-desc">Each with a name, a destination address (same clickable suggestions as above), and its own optional desired arrival time. A slot with no name or no address is simply skipped; a failed trip calculation doesn't prevent the others from showing.</span></div>
<div class="help-opt"><span class="help-opt-name">Extra trip 1–5 — destination address</span><span class="help-opt-desc">Each extra trip is computed from address A (e.g. home) to its destination. Leave name and address empty to disable a slot. Up to 5 extra trips.</span></div>
<div class="help-opt"><span class="help-opt-name">Extra trip 1–5 — desired arrival time</span><span class="help-opt-desc">Optional. Shows a suggested departure time for this trip.</span></div>
<p class="help-opt-group">Alert thresholds</p>
<div class="help-opt"><span class="help-opt-name">Moderate delay threshold (minutes)</span><span class="help-opt-desc">In minutes of delay versus the usual time, beyond which the duration turns orange then red.</span></div>
<div class="help-opt"><span class="help-opt-name">Heavy delay threshold (minutes)</span><span class="help-opt-desc">Delay versus the usual time, beyond which the duration turns red. From 2 to 180, default 20.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two recalculations. Each refresh can trigger several TomTom requests (one per active trip).</span></div>
`
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
<p>Compter les jours avant un événement, ou servir de minuteur géant visible depuis toute la pièce.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Deux modes</b> : décompte vers une date et une heure fixes (anniversaire, départ, rentrée), ou <b>minuteur</b> démarrable pour une durée donnée.</li>
  <li><b>Occasion</b> affichée sur la tuile, secondes en option.</li>
  <li><b>Alerte de fin</b> : flash plein écran et/ou son au choix, pendant une durée réglable (jusqu'à une minute), arrêtable d'un toucher.</li>
  <li><b>Webhook de notification</b> optionnel pour prévenir ailleurs (SMS, Alexa, notification sur le téléphone…), avec votre propre message.</li>
</ul>

<h4>Possibilités</h4>
          <p>Deux modes : « Compte à rebours vers une date » (par exemple le 25 décembre, ou le début des vacances) affiche en continu le temps restant ; « Minuteur » fonctionne comme un chronomètre classique démarrable/pausable/réinitialisable pour une durée choisie (utile pour une cuisson, un temps de pause, un jeu). À la fin, une alerte se déclenche — flash plein écran et/ou son au choix parmi plusieurs sons synthétisés (donc aucun fichier audio, fonctionne hors-ligne) — et dure jusqu'à une minute. Pour l'arrêter avant terme : le bouton « Arrêter » sur la tuile, ou <b>toucher/cliquer n'importe où sur l'écran</b> (une pastille le rappelle pendant que l'alerte est active). Le webhook de notification permet de relayer la fin du compte à rebours vers un service externe (par exemple déclencher une notification SMS, une annonce sur une enceinte Alexa, ou une alerte push sur votre téléphone) via une simple requête HTTP GET ou POST.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Occasion (optionnel)</span><span class="help-opt-desc">Un libellé optionnel affiché au-dessus du décompte (ex. « Vacances ! »).</span></div>
<div class="help-opt"><span class="help-opt-name">Type</span><span class="help-opt-desc">Compte à rebours vers une date, ou minuteur.</span></div>
<div class="help-opt"><span class="help-opt-name">Date et heure cible</span><span class="help-opt-desc">Pour le mode « date ».</span></div>
<div class="help-opt"><span class="help-opt-name">Durée du minuteur (minutes)</span><span class="help-opt-desc">En minutes, pour le mode « minuteur ».</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les secondes</span><span class="help-opt-desc">Ajoute les secondes au décompte.</span></div>
<div class="help-opt"><span class="help-opt-name">Faire clignoter tout l'écran à la fin</span><span class="help-opt-desc">Fait clignoter tout l'écran à la fin, pas seulement la tuile — difficile à manquer même de loin. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Jouer un son à la fin (nécessite des haut-parleurs sur l'écran)</span><span class="help-opt-desc">Nécessite des haut-parleurs sur l'appareil qui affiche le tableau. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Son</span><span class="help-opt-desc">Choix parmi plusieurs sons synthétisés à la volée (bip, sirène, cloche, sonnette, jingle…).</span></div>
<div class="help-opt"><span class="help-opt-name">Durée de l'alerte (secondes, ou arrêtez-la avant)</span><span class="help-opt-desc">Le flash/son continue pendant cette durée après la fin du décompte. Un bouton « Arrêter » permet de la couper avant terme.</span></div>
<div class="help-opt"><span class="help-opt-name">URL webhook de notification (optionnel, {message} = le texte ci-dessous)</span><span class="help-opt-desc">Adresse appelée au moment de l'alerte, pour la relayer ailleurs (SMS, Alexa, notification sur le téléphone…). <code>{message}</code> y est remplacé par le texte du message. Laisser vide pour ne rien appeler.</span></div>
<div class="help-opt"><span class="help-opt-name">Méthode du webhook</span><span class="help-opt-desc">Adresse appelée automatiquement à la fin du décompte. Le message peut inclure <code>{message}</code> pour insérer le texte configuré.</span></div>
<div class="help-opt"><span class="help-opt-name">Message de la notification (optionnel)</span><span class="help-opt-desc">Texte envoyé au webhook à la place du message par défaut.</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 1×1 to 6×4</span>

<h4>Goal</h4>
<p>Count the days to an event, or act as a giant timer visible from across the room.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Two modes</b>: countdown to a fixed date and time (birthday, departure, back to school), or a <b>timer</b> started for a given duration.</li>
  <li><b>Occasion</b> shown on the tile, seconds optional.</li>
  <li><b>End alert</b>: full-screen flash and/or a sound of your choice, for an adjustable duration (up to a minute), stopped with a touch.</li>
  <li>Optional <b>notification webhook</b> to alert elsewhere (SMS, Alexa, phone notification…), with your own message.</li>
</ul>

<h4>Possibilities</h4>
          <p>Two modes: "Countdown to a date" (e.g. December 25th, or the start of vacation) continuously shows the remaining time; "Timer" works like a classic stopwatch that can be started/paused/reset for a chosen duration (handy for cooking, a break, a game). At the end, an alert fires — full-screen flash and/or a sound chosen among several synthesized sounds (so no audio file, works offline) — lasting up to a minute. To stop it early: the tile's "Stop" button, or <b>tap/click anywhere on the screen</b> (a chip reminds you of this while the alert is active). The notification webhook lets you relay the countdown's end to an external service (e.g. trigger an SMS notification, an announcement on an Alexa speaker, or a push alert on your phone) via a simple HTTP GET or POST request.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Occasion (optional)</span><span class="help-opt-desc">An optional label shown above the countdown (e.g. "Vacation!").</span></div>
<div class="help-opt"><span class="help-opt-name">Type</span><span class="help-opt-desc">Countdown to a date, or timer.</span></div>
<div class="help-opt"><span class="help-opt-name">Target date and time</span><span class="help-opt-desc">For "date" mode.</span></div>
<div class="help-opt"><span class="help-opt-name">Timer duration (minutes)</span><span class="help-opt-desc">In minutes, for "timer" mode.</span></div>
<div class="help-opt"><span class="help-opt-name">Show seconds</span><span class="help-opt-desc">Adds seconds to the countdown.</span></div>
<div class="help-opt"><span class="help-opt-name">Flash the whole screen when it ends</span><span class="help-opt-desc">Flashes the whole screen at the end, not just the tile — hard to miss even from a distance.</span></div>
<div class="help-opt"><span class="help-opt-name">Play a sound when it ends (needs speakers on the screen)</span><span class="help-opt-desc">Requires speakers on the device showing the dashboard. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Sound</span><span class="help-opt-desc">Choice among several sounds synthesized on the fly (beep, siren, bell, doorbell, jingle…).</span></div>
<div class="help-opt"><span class="help-opt-name">Alert duration (seconds, or stop it early)</span><span class="help-opt-desc">The flash/sound continues for this long after the countdown ends. A "Stop" button lets you cut it short.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification webhook URL (optional, {message} = the text below)</span><span class="help-opt-desc">Address called when the alert fires, to relay it elsewhere (SMS, Alexa, phone notification…). <code>{message}</code> is replaced by the message text. Leave empty to call nothing.</span></div>
<div class="help-opt"><span class="help-opt-name">Webhook method</span><span class="help-opt-desc">Address automatically called when the countdown ends. The message can include <code>{message}</code> to insert the configured text.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification message (optional)</span><span class="help-opt-desc">Text sent to the webhook instead of the default message.</span></div>
`
      }
    },

    {
      id: "bambu",
      group: "tiles",
      title: { fr: "Imprimante 3D Bambu Lab", en: "Bambu Lab 3D printer" },
      sub: {
        fr: "Suivi en direct d'une imprimante Bambu Lab (X1C, P1S, A1, H2D…) : avancement, étape en cours, heure de fin prévue, températures, AMS, erreurs. Lecture seule, par le réseau local ou par le compte Bambu.",
        en: "Live monitoring of a Bambu Lab printer (X1C, P1S, A1, H2D…): progress, current stage, estimated finish time, temperatures, AMS, errors. Read-only, over the local network or through your Bambu account."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×3 par défaut, de 1×1 à 12×12</span>

<h4>Objectif</h4>
<p>Savoir où en est une impression sans monter à l'atelier ni ouvrir une application.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Avancement</b>, <b>étape en cours</b> (chauffe, nivellement, calibration, impression), <b>heure de fin prévue</b> et couche en cours.</li>
  <li><b>Températures</b> du plateau, de la buse et du caisson.</li>
  <li><b>AMS</b> : contenu des emplacements (couleur, matière) et humidité.</li>
  <li><b>Erreurs HMS</b> de l'imprimante, et détails affichés même à l'arrêt si vous le souhaitez.</li>
  <li><b>Bouton caméra</b> qui ouvre le flux vidéo dans une fenêtre.</li>
  <li><b>Alertes</b> à la fin d'une impression et en cas d'erreur, d'échec ou de pause imprévue : flash, son, durée réglable et webhook.</li>
  <li><b>Deux connexions</b> : directe sur le réseau local (rien ne sort de chez vous) ou par le compte Bambu ; lecture seule, aucune commande n'est envoyée.</li>
  <li>Affichage qui se simplifie quand la tuile rétrécit, jusqu'à ne garder que l'avancement.</li>
</ul>

<h4>Lecture seule, et c'est volontaire</h4>
          <p>La tuile n'envoie <b>aucune commande</b> à l'imprimante. Une seule chose lui est demandée à la connexion — « donne-moi ton état complet » — et plus rien ensuite : c'est l'imprimante qui pousse ses changements. Sur un écran tactile posé dans une pièce de passage, un bouton « arrêter l'impression » se frôle trop facilement.</p>

<h4>Deux façons de se connecter</h4>
          <p><b>Réseau local (recommandé).</b> L'imprimante héberge son propre serveur : PiBoard s'y connecte directement, rien ne sort de chez vous, et l'état arrive en temps réel. Il faut pour cela activer sur l'écran de l'imprimante le <b>mode LAN</b> puis le <b>mode développeur</b> (Réglages → Réseau), avec un redémarrage après la première activation — sans quoi les firmwares récents refusent tout accès local. Le <b>code d'accès LAN</b> (huit chiffres, au même endroit) sert de mot de passe ; il est conservé chiffré sur le PiBoard, dans un fichier distinct des réglages, et ne redescend jamais au navigateur.</p>
          <p><b>Compte Bambu.</b> Même information, mais par les serveurs de Bambu : utile si le PiBoard n'est pas sur le même réseau que l'imprimante. La connexion se fait depuis la tuile elle-même, en trois temps : adresse de courriel et mot de passe, puis le <b>code de vérification</b> que Bambu vous envoie par courriel — un bouton permet de le redemander s'il tarde —, et enfin le choix de l'imprimante parmi celles de votre compte. Rien à saisir à la main : ni adresse IP, ni numéro de série. Si votre compte utilise une application d'authentification, c'est son code à six chiffres qui est demandé. Le jeton obtenu est rangé avec les autres secrets. Le réglage « plateforme » ne distingue que deux cas, les seuls qui existent chez Bambu : l'infrastructure mondiale, qui sert l'Europe, et l'infrastructure chinoise.</p>

<h4>Les deux modes s'excluent</h4>
          <p>Point important, et c'est le piège classique : le <b>mode LAN uniquement</b> coupe l'imprimante des serveurs de Bambu. Tant qu'il est actif, la liaison <b>cloud</b> ne verra jamais rien — la connexion au compte réussit, l'imprimante reste muette. Si vous avez activé le mode LAN pour essayer la liaison locale, il faut donc choisir : soit le désactiver pour passer par le cloud, soit garder la liaison locale, qui est de toute façon la meilleure quand le PiBoard et l'imprimante sont sur le même réseau. La tuile le dit explicitement quand le cas se présente, en s'appuyant sur l'état « en ligne » que Bambu lui-même rapporte.</p>

<h4>Trouver son imprimante</h4>
          <p>Le bouton <b>Rechercher</b> des réglages interroge le réseau : les imprimantes Bambu s'y annoncent d'elles-mêmes. Choisissez la vôtre et l'adresse IP, le numéro de série et le modèle se remplissent seuls — plus besoin de recopier quoi que ce soit depuis un petit écran. Les trois champs restent modifiables à la main.</p>

<h4>Ce qui s'affiche</h4>
          <p>Un anneau d'avancement, l'étape en cours (préchauffage du plateau, nivellement automatique, calibration du débit, mesure micro-lidar, inspection de la première couche, changement de filament, nettoyage de buse…), l'<b>heure de fin prévue</b> autant que le temps restant, la couche en cours sur le total, et le nom de la pièce. Les températures du plateau, de la buse et du caisson apparaissent avec leur consigne <b>quand elle diffère de la mesure</b> : on voit ainsi la chauffe monter, sans lire deux fois le même chiffre le reste du temps.</p>
          <p>Bambu ne publie pas le nom commercial de la machine mais un code interne — « BL-P001 » désigne une X1 Carbon. La tuile le traduit, et c'est ce même code qui lui dit ce que la machine sait mesurer. Le <b>caisson</b> n'est affiché que sur les machines qui le mesurent (X1, H2D) : une P1 ou une A1 n'en publie pas, et la tuile préfère ne rien montrer qu'afficher un faux zéro. La <b>H2D</b> affiche ses deux buses.</p>
          <p>À l'arrêt, plutôt qu'une tuile vide : la dernière impression, son issue, et les températures qui redescendent.</p>

<h4>Elle rétrécit sans devenir illisible</h4>
          <p>L'affichage se dégrade par paliers, mesurés sur la taille réelle de la tuile à l'écran. En grand, tout est là, AMS compris. En réduisant, les bobines partent, puis les températures, puis l'heure de fin, puis l'étape. <b>L'avancement est le dernier à partir</b> : même sur une tuile d'une seule case, on voit où en est l'impression.</p>

<h4>Alertes</h4>
          <p>Fin d'impression et problème (filament épuisé, buse bouchée, panne signalée) peuvent faire clignoter l'écran, jouer un son et appeler un webhook — exactement les mêmes réglages que la tuile Compte à rebours. Les alertes se déclenchent sur <b>changement d'état</b> seulement : une impression terminée ne sonne qu'une fois.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Liaison</span><span class="help-opt-desc">Réseau local (recommandé) ou compte Bambu.</span></div>
<div class="help-opt"><span class="help-opt-name">Imprimante</span><span class="help-opt-desc">Recherche sur le réseau ; le choix remplit l'adresse, le numéro de série et le modèle.</span></div>
<div class="help-opt"><span class="help-opt-name">Adresse IP de l'imprimante</span><span class="help-opt-desc">Visible sur l'écran de l'imprimante, Réglages → Réseau. Facultative en liaison cloud — mais nécessaire si vous voulez le bouton caméra, dont le flux passe toujours par le réseau local.</span></div>
<div class="help-opt"><span class="help-opt-name">Numéro de série</span><span class="help-opt-desc">Numéro de série de l'imprimante : il identifie la machine, en liaison locale comme par le compte Bambu (voir « Trouver son imprimante »).</span></div>
<div class="help-opt"><span class="help-opt-name">Modèle (X1C, P1S, A1, H2D…)</span><span class="help-opt-desc">Détermine ce que la tuile peut afficher : seules les machines fermées mesurent le caisson, seule la H2D porte deux buses.</span></div>
<div class="help-opt"><span class="help-opt-name">Code d'accès LAN</span><span class="help-opt-desc">Les huit chiffres affichés par l'imprimante. Conservé chiffré.</span></div>
<div class="help-opt"><span class="help-opt-name">Plateforme Bambu</span><span class="help-opt-desc">Bambu n'a que deux infrastructures : une mondiale, qui sert l'Europe, et une chinoise. Laissez « Reste du monde » sauf si votre compte a été créé sur la plateforme chinoise. Uniquement pour la liaison cloud. Choix : Reste du monde (Europe comprise), Chine. Par défaut : Reste du monde (Europe comprise).</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Températures (plateau, buse, caisson)</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Étape en cours (chauffe, nivellement, calibration…)</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Heure de fin prévue et couche en cours</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Contenu et humidité des AMS</span><span class="help-opt-desc">Les bobines avec leur couleur réelle, le filament engagé, et le taux d'humidité de chaque unité. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">À l'arrêt, montrer la dernière impression et les températures</span><span class="help-opt-desc">Évite une tuile vide entre deux pièces.</span></div>
<div class="help-opt"><span class="help-opt-name">Bouton caméra (ouvre le flux en fenêtre)</span><span class="help-opt-desc">Ouvre le flux de la caméra intégrée par-dessus le tableau. Le flux passe toujours par le réseau local, même en liaison cloud : l'adresse IP et le code d'accès LAN doivent donc être renseignés, sinon le bouton n'apparaît pas. Il lui faut aussi de la place — il s'efface sur une tuile réduite.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (secondes)</span><span class="help-opt-desc">L'imprimante pousse son état d'elle-même ; ce réglage ne fixe que la fréquence de relecture. Inutile de descendre très bas.</span></div>
<p class="help-opt-group">Alertes</p>
<div class="help-opt"><span class="help-opt-name">Prévenir à la fin de l'impression</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Prévenir en cas d'erreur, d'échec ou de pause imprévue</span><span class="help-opt-desc">Filament épuisé, buse bouchée, panne signalée par l'imprimante : c'est le moment où l'on veut être dérangé. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Faire clignoter tout l'écran</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Jouer un son (nécessite des haut-parleurs sur l'écran)</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Son</span><span class="help-opt-desc">Tous les sons sont synthétisés à la volée (aucun fichier audio, fonctionne hors-ligne). Choix : 🔔 Bip simple, 🔔 Double bip, 🚓 Sirène police, 🚒 Sirène pompiers, 🔥 Alarme incendie, 🚨 Klaxon plongée sous-marine, 🚆 Cloche de passage à niveau, 🔔 Sonnette d'entrée (ding-dong), 🎵 Jingle bref. Par défaut : 🔔 Double bip.</span></div>
<div class="help-opt"><span class="help-opt-name">Durée de l'alerte (secondes)</span><span class="help-opt-desc">Fin d'impression, erreur : clignotement, son, webhook, durée. De 5 à 300, par défaut 30.</span></div>
<div class="help-opt"><span class="help-opt-name">URL webhook de notification (optionnel, {message} = le texte ci-dessous)</span><span class="help-opt-desc">Adresse appelée au moment de l'alerte, pour la relayer ailleurs (SMS, Alexa, notification sur le téléphone…). <code>{message}</code> y est remplacé par le texte du message. Laisser vide pour ne rien appeler.</span></div>
<div class="help-opt"><span class="help-opt-name">Méthode du webhook</span><span class="help-opt-desc">Choix : GET, POST (corps = message). Par défaut : GET.</span></div>
<div class="help-opt"><span class="help-opt-name">Message de la notification (optionnel)</span><span class="help-opt-desc">Texte envoyé au webhook à la place du message par défaut.</span></div>
`,
        en: `
<span class="help-size">Size: 3×3 by default, from 1×1 to 12×12</span>

<h4>Goal</h4>
<p>Know how a print is going without walking to the workshop or opening an app.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Progress</b>, <b>current stage</b> (heating, levelling, calibration, printing), <b>estimated finish time</b> and current layer.</li>
  <li><b>Temperatures</b> of the bed, nozzle and chamber.</li>
  <li><b>AMS</b>: slot contents (colour, material) and humidity.</li>
  <li>Printer <b>HMS errors</b>, with details shown even when idle if you wish.</li>
  <li><b>Camera button</b> opening the video stream in a window.</li>
  <li><b>Alerts</b> when a print finishes and on error, failure or unexpected pause: flash, sound, adjustable duration and webhook.</li>
  <li><b>Two connections</b>: directly on the local network (nothing leaves your home) or through the Bambu account; read-only, no command is ever sent.</li>
  <li>Display that simplifies as the tile shrinks, down to the progress alone.</li>
</ul>

<h4>Read-only, deliberately</h4>
          <p>The tile sends <b>no command</b> to the printer. It asks one single thing on connecting — "give me your full state" — and nothing afterwards: the printer pushes its own changes. On a touchscreen sitting in a busy room, a "stop the print" button is brushed far too easily.</p>

<h4>Two ways to connect</h4>
          <p><b>Local network (recommended).</b> The printer hosts its own server: PiBoard connects straight to it, nothing leaves your home, and the state arrives in real time. This requires turning on <b>LAN mode</b> then <b>Developer mode</b> on the printer's screen (Settings → Network), with a reboot after first enabling it — recent firmwares refuse all local access otherwise. The <b>LAN access code</b> (eight digits, same place) is the password; it is stored encrypted on the PiBoard, in a file separate from the settings, and never comes back down to the browser.</p>
          <p><b>Bambu account.</b> The same information, but through Bambu's servers: useful when the PiBoard is not on the same network as the printer. Signing in happens from the tile itself, in three steps: email address and password, then the <b>verification code</b> Bambu emails you — a button asks for a new one if it is slow to arrive — and finally the choice of printer among those on your account. Nothing to type by hand: no IP address, no serial number. If your account uses an authenticator app, its six-digit code is asked for instead. The resulting token is filed with the other secrets. The "platform" setting distinguishes only the two cases that actually exist at Bambu: the worldwide infrastructure, which serves Europe, and the Chinese one.</p>

<h4>The two modes exclude each other</h4>
          <p>An important point, and the classic trap: <b>LAN-only mode</b> cuts the printer off from Bambu's servers. While it is on, the <b>cloud</b> link will never see anything — signing in succeeds, the printer stays silent. So if you turned LAN mode on to try the local link, you must choose: either turn it off to go through the cloud, or keep the local link, which is the better one anyway when the PiBoard and the printer share a network. The tile says so explicitly when this happens, using the "online" state Bambu itself reports.</p>

<h4>Finding your printer</h4>
          <p>The <b>Search</b> button in the settings queries the network: Bambu printers announce themselves there. Pick yours and the IP address, serial number and model fill themselves in — nothing to copy from a small screen. The three fields stay editable by hand.</p>

<h4>What it shows</h4>
          <p>A progress ring, the current stage (heatbed preheating, auto bed levelling, extrusion calibration, micro lidar measurement, first-layer inspection, filament change, nozzle cleaning…), the <b>estimated finish time</b> as well as the remaining time, the current layer out of the total, and the part's name. Bed, nozzle and chamber temperatures appear with their target <b>when it differs from the reading</b>, so you watch the heat climb without reading the same number twice the rest of the time.</p>
          <p>Bambu publishes no commercial name but an internal code — "BL-P001" means an X1 Carbon. The tile translates it, and that same code tells it what the machine can measure. The <b>chamber</b> is only shown on machines that measure it (X1, H2D): a P1 or an A1 publishes none, and the tile would rather show nothing than a false zero. The <b>H2D</b> shows both its nozzles.</p>
          <p>When idle, rather than an empty tile: the last print, how it ended, and the temperatures coming back down.</p>

<h4>It shrinks without becoming unreadable</h4>
          <p>The display degrades in steps, measured on the tile's real size on screen. Large, everything is there, AMS included. As it shrinks the spools go, then the temperatures, then the finish time, then the stage. <b>Progress is the last thing to go</b>: even on a single-cell tile you can see where the print stands.</p>

<h4>Alerts</h4>
          <p>Print finished and problems (filament runout, clogged nozzle, a reported fault) can flash the screen, play a sound and call a webhook — exactly the same settings as the Countdown tile. Alerts fire on <b>state change</b> only: a finished print rings once.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Link</span><span class="help-opt-desc">Local network (recommended) or Bambu account.</span></div>
<div class="help-opt"><span class="help-opt-name">Printer</span><span class="help-opt-desc">Searches the network; the choice fills in address, serial number and model.</span></div>
<div class="help-opt"><span class="help-opt-name">Printer IP address</span><span class="help-opt-desc">Shown on the printer's screen under Settings → Network. Optional on the cloud link — but needed for the camera button, whose stream always goes over the local network.</span></div>
<div class="help-opt"><span class="help-opt-name">Serial number</span><span class="help-opt-desc">The printer's serial number: it identifies the machine, both on the local network and through the Bambu account (see "Finding your printer").</span></div>
<div class="help-opt"><span class="help-opt-name">Model (X1C, P1S, A1, H2D…)</span><span class="help-opt-desc">Decides what the tile can show: only enclosed machines measure the chamber, only the H2D has two nozzles.</span></div>
<div class="help-opt"><span class="help-opt-name">LAN access code</span><span class="help-opt-desc">The eight digits shown by the printer. Stored encrypted.</span></div>
<div class="help-opt"><span class="help-opt-name">Bambu platform</span><span class="help-opt-desc">Bambu has only two infrastructures: a worldwide one, which serves Europe, and a Chinese one. Leave "Rest of the world" unless your account was created on the Chinese platform. Cloud link only. Choices: Rest of the world (Europe included), China. Default: Rest of the world (Europe included).</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Temperatures (bed, nozzle, chamber)</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Current stage (heating, levelling, calibration…)</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Estimated finish time and current layer</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">AMS contents and humidity</span><span class="help-opt-desc">Spools with their real colour, the engaged filament, and each unit's humidity level. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">When idle, show the last print and temperatures</span><span class="help-opt-desc">Avoids an empty tile between two parts.</span></div>
<div class="help-opt"><span class="help-opt-name">Camera button (opens the stream in a window)</span><span class="help-opt-desc">Opens the built-in camera's stream over the board. The stream always goes over the local network, even on the cloud link, so the IP address and LAN access code must be filled in or the button will not appear. It also needs room — it disappears on a shrunken tile.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (seconds)</span><span class="help-opt-desc">The printer pushes its state on its own; this only sets how often it is re-read. No need to go very low.</span></div>
<p class="help-opt-group">Alerts</p>
<div class="help-opt"><span class="help-opt-name">Alert when the print finishes</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert on error, failure or unexpected pause</span><span class="help-opt-desc">Filament runout, clogged nozzle, a fault reported by the printer: this is when you want to be interrupted. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Flash the whole screen</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Play a sound (needs speakers on the screen)</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Sound</span><span class="help-opt-desc">All sounds are synthesized on the fly (no audio files, works offline). Choices: 🔔 Simple beep, 🔔 Double beep, 🚓 Police siren, 🚒 Firefighter siren, 🔥 Fire alarm klaxon, 🚨 Submarine dive klaxon, 🚆 Train crossing bell, 🔔 Doorbell (ding-dong), 🎵 Short jingle. Default: 🔔 Double beep.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert duration (seconds)</span><span class="help-opt-desc">Print finished, error: flash, sound, webhook, duration. From 5 to 300, default 30.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification webhook URL (optional, {message} = the text below)</span><span class="help-opt-desc">Address called when the alert fires, to relay it elsewhere (SMS, Alexa, phone notification…). <code>{message}</code> is replaced by the message text. Leave empty to call nothing.</span></div>
<div class="help-opt"><span class="help-opt-name">Webhook method</span><span class="help-opt-desc">Choices: GET, POST (body = message). Default: GET.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification message (optional)</span><span class="help-opt-desc">Text sent to the webhook instead of the default message.</span></div>
`
      }
    },

    {
      id: "homeassistant",
      group: "tiles",
      title: { fr: "Home Assistant", en: "Home Assistant" },
      sub: {
        fr: "Températures, portes, consommation : les entités de votre maison sur le tableau.",
        en: "Temperatures, doors, consumption: your home's entities on the board."
      },
      html: {
        fr: `
<div class="help-warn"><b>Lecture seule.</b> Cette tuile affiche, elle ne commande rien. Elle n'appelle aucun service Home Assistant et ne peut donc allumer, ouvrir ni déverrouiller quoi que ce soit. Le pilotage viendra dans une version ultérieure, avec les protections qu'il exige — un écran tactile mural est accessible à tout le monde, enfants et visiteurs compris.</div>

<h4>Objectif</h4>
<p>Afficher les entités de votre maison qui comptent, en lecture seule.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Entités au choix</b>, une par ligne : température de chaque pièce, portes et fenêtres, consommation électrique, humidité, niveaux de batterie…</li>
  <li><b>Couleur d'alerte</b> pour un état qui mérite l'attention (porte ouverte, fumée détectée) ; l'état normal reste discret.</li>
  <li><b>Mises à jour instantanées</b> par WebSocket, avec un rafraîchissement de secours.</li>
  <li>Entités indisponibles affichées ou masquées.</li>
  <li><b>Jeton</b> d'accès longue durée stocké chiffré ; la tuile n'appelle aucun service et ne change rien chez vous.</li>
</ul>

<h4>Mise en route</h4>
          <p>Trois étapes, dans cet ordre :</p>
          <ol>
            <li>Dans Home Assistant, ouvrez votre <b>profil</b> (votre nom, en bas de la barre latérale) et descendez jusqu'à « Jetons d'accès de longue durée ». Créez-en un, nommez-le par exemple « PiBoard », et copiez-le <b>en entier</b> — il ne sera plus jamais affiché.</li>
            <li>Dans les réglages de la tuile, saisissez l'<b>adresse</b> de Home Assistant (port compris, en général <code>:8123</code>) et collez le jeton. <b>Enregistrez.</b></li>
            <li><b>Rouvrez</b> les réglages : les listes d'entités sont maintenant remplies depuis votre propre installation, groupées par domaine. Ajoutez vos lignes.</li>
          </ol>
          <p>Cette réouverture est nécessaire : PiBoard ne peut interroger votre Home Assistant qu'une fois l'adresse et le jeton enregistrés. Si les listes restent vides, un message vous le signale — c'est presque toujours une adresse inexacte ou un jeton tronqué à la copie.</p>

<h4>Mises à jour instantanées</h4>
          <p>PiBoard maintient une connexion permanente à Home Assistant : une porte qui s'ouvre apparaît <b>dans la seconde</b>, sans attendre un rafraîchissement. Un point vert discret en haut de la tuile indique que cette connexion directe est active. S'il est absent, la tuile fonctionne quand même, mais en interrogation périodique.</p>
          <p>Une seule connexion est ouverte pour toute l'installation, quel que soit le nombre de tuiles et d'écrans.</p>

<h4>Sécurité du jeton</h4>
          <p>Un jeton de longue durée donne un accès complet à votre Home Assistant. Il est conservé <b>chiffré</b> dans le coffre de PiBoard, à l'écart de <code>layout.json</code> qui part dans les sauvegardes, et n'est <b>jamais</b> renvoyé au navigateur : les pages ne reçoivent que des états d'entités. Si vous avez un doute, révoquez-le depuis votre profil Home Assistant et créez-en un autre.</p>

<h4>Et MQTT ?</h4>
          <p>Si vous utilisez Home Assistant, MQTT fait doublon : HA agrège déjà vos appareils MQTT et les expose comme entités. Un accès MQTT direct n'aurait d'intérêt que sans Home Assistant.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Adresse de Home Assistant</span><span class="help-opt-desc">Port compris, en général 8123. Adresse locale, aucun passage par le cloud.</span></div>
<div class="help-opt"><span class="help-opt-name">Jeton d'accès de longue durée</span><span class="help-opt-desc">Créé dans Home Assistant (profil, bas de page). Conservé chiffré, jamais renvoyé au navigateur.</span></div>
<div class="help-opt"><span class="help-opt-name">Entités à afficher</span><span class="help-opt-desc">Nom, domaine, puis entité, choisis dans des listes remplies depuis votre Home Assistant — enregistrez d'abord l'adresse et le jeton, puis rouvrez les réglages.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les entités indisponibles</span><span class="help-opt-desc">Une entité éteinte, injoignable ou supprimée reste visible avec son état au lieu de disparaître.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement de secours (minutes)</span><span class="help-opt-desc">Utilisé seulement si la connexion directe est coupée (5 minutes par défaut).</span></div>
`,
        en: `
<div class="help-warn"><b>Read only.</b> This tile displays, it does not command. It calls no Home Assistant service and therefore cannot switch on, open or unlock anything. Control will come in a later version, with the protections it demands — a wall-mounted touchscreen is within everyone's reach, children and visitors included.</div>

<h4>Goal</h4>
<p>Show the home entities that matter, read-only.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Entities of your choice</b>, one per line: each room's temperature, doors and windows, power use, humidity, battery levels…</li>
  <li><b>Alert colour</b> for a state that deserves attention (door open, smoke detected); the normal state stays discreet.</li>
  <li><b>Instant updates</b> over WebSocket, with a fallback refresh.</li>
  <li>Unavailable entities shown or hidden.</li>
  <li>Long-lived access <b>token</b> stored encrypted; the tile calls no service and changes nothing at home.</li>
</ul>

<h4>Getting started</h4>
          <p>Three steps, in this order:</p>
          <ol>
            <li>In Home Assistant, open your <b>profile</b> (your name, at the bottom of the sidebar) and scroll to "Long-lived access tokens". Create one, name it something like "PiBoard", and copy it <b>in full</b> — it will never be shown again.</li>
            <li>In the tile's settings, enter Home Assistant's <b>address</b> (including the port, usually <code>:8123</code>) and paste the token. <b>Save.</b></li>
            <li><b>Reopen</b> the settings: the entity lists are now filled from your own installation, grouped by domain. Add your rows.</li>
          </ol>
          <p>That reopening is necessary: PiBoard can only query your Home Assistant once the address and token have been saved. If the lists stay empty, a message says so — it is almost always an inexact address or a token truncated when copied.</p>

<h4>Instant updates</h4>
          <p>PiBoard keeps a permanent connection to Home Assistant: a door opening appears <b>within the second</b>, with no refresh to wait for. A discreet green dot at the top of the tile shows that this live connection is up. If it is missing, the tile still works, but by periodic polling.</p>
          <p>A single connection is opened for the whole installation, however many tiles and screens you have.</p>

<h4>Token security</h4>
          <p>A long-lived token grants full access to your Home Assistant. It is kept <b>encrypted</b> in PiBoard's vault, away from <code>layout.json</code> which ends up in backups, and is <b>never</b> returned to the browser: pages only ever receive entity states. If in doubt, revoke it from your Home Assistant profile and create another.</p>

<h4>What about MQTT?</h4>
          <p>If you use Home Assistant, MQTT is redundant: HA already aggregates your MQTT devices and exposes them as entities. Direct MQTT access would only be of interest without Home Assistant.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Home Assistant address</span><span class="help-opt-desc">Port included, usually 8123. Local address, nothing goes through the cloud.</span></div>
<div class="help-opt"><span class="help-opt-name">Long-lived access token</span><span class="help-opt-desc">Created in Home Assistant (profile, bottom of the page). Stored encrypted, never sent back to the browser.</span></div>
<div class="help-opt"><span class="help-opt-name">Entities to display</span><span class="help-opt-desc">Name, domain, then entity, picked from lists filled from your Home Assistant — save the address and token first, then reopen the settings.</span></div>
<div class="help-opt"><span class="help-opt-name">Show unavailable entities</span><span class="help-opt-desc">An entity that is off, unreachable or deleted stays visible with its state instead of disappearing.</span></div>
<div class="help-opt"><span class="help-opt-name">Fallback refresh (minutes)</span><span class="help-opt-desc">Only used when the direct connection is down (5 minutes by default).</span></div>
`
      }
    },

    {
      id: "stocks",
      group: "tiles",
      title: { fr: "Bourse et indices", en: "Stocks & indices" },
      sub: {
        fr: "Indices, actions, devises et matières premières, avec courbe au clic.",
        en: "Indices, shares, currencies and commodities, with a chart on click."
      },
      html: {
        fr: `
<h4>Objectif</h4>
<p>Suivre quelques valeurs qui vous intéressent, une ligne chacune, avec la variation du jour.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Indices, actions, devises et matières premières</b>, choisis dans une liste par place ou saisis par leur symbole.</li>
  <li><b>Variation du jour</b> affichée ou non, et lignes regroupées par type si vous le souhaitez.</li>
  <li><b>Courbe</b> de 1 mois à 5 ans d'un toucher sur une ligne, dans la couleur de votre choix.</li>
  <li><b>Composition des indices</b> à portée de main pour ajouter une valeur.</li>
  <li>Cours différés (pas en temps réel), sources gratuites sans clé ni compte ; « marché fermé » signalé.</li>
</ul>

<h4>Configurer les lignes</h4>
          <p>Dans les réglages de la tuile, chaque ligne se compose de trois colonnes : un <b>nom</b> libre (celui affiché sur la tuile), la <b>place</b> ou la famille, puis l'<b>instrument</b>. Changer la place recharge la liste des instruments ; le nom se remplit tout seul si vous l'avez laissé vide, sans jamais écraser un nom que vous avez choisi.</p>
          <p>Les listes ne contiennent qu'une sélection : la source couvre plus de 21 000 titres, impossible à mettre dans un menu déroulant. Pour tout le reste, choisissez <b>« Autre… »</b> en fin de liste d'instruments : un champ de saisie apparaît et accepte n'importe quel symbole reconnu par la source.</p>

<h4>Indices et valeurs cohabitent</h4>
          <p>Les indices et les valeurs individuelles sont deux natures d'information qu'on ne lit pas de la même façon. La tuile rassemble donc les indices en tête, trace un <b>trait de séparation</b>, puis affiche les actions, devises et matières premières. L'ordre que vous avez choisi dans les réglages est respecté à l'intérieur de chaque groupe. Le trait n'apparaît que si les deux groupes existent, et le regroupement se désactive dans les réglages.</p>
          <p>Le bouton <b>« Restaurer la liste par défaut »</b> remet les grands indices <b>sans supprimer</b> les lignes que vous avez ajoutées : il n'ajoute que ce qui manque. C'est le moyen de retrouver les indices si vous les avez effacés — sans lui, les valeurs par défaut ne s'appliquent que tant que la tuile n'a jamais été configurée, et une liste vidée était définitivement perdue.</p>

<h4>Composition des indices</h4>
          <p>Trois familles listent les valeurs qui composent un indice : <b>CAC 40</b> (les 40), <b>DAX</b> et <b>Dow Jones</b>. Pratique pour ajouter quelques valeurs d'un indice sans les chercher une par une. Ce sont des actions : elles s'affichent donc sous le trait de séparation, pas avec les indices.</p>
          <div class="help-warn">Ces compositions sont un <b>instantané</b>. Les indices connaissent des entrées et des sorties une à quelques fois par an ; la liste n'est donc pas mise à jour automatiquement. Une valeur sortie de l'indice continuera de fonctionner comme action ordinaire.</div>

<h4>Écrire un symbole à la main</h4>
          <p>La convention est celle de la source : suffixe de place (<code>.US</code>, <code>.FR</code>, <code>.DE</code>, <code>.UK</code>, <code>.JP</code>…), indices préfixés de <code>^</code>, paires de change en six lettres (<code>EURUSD</code>). Exemples : <code>NESN.CH</code> pour Nestlé, <code>^SPX</code> pour le S&amp;P 500.</p>
          <p><b>Attention à la devise</b> : pour un symbole saisi à la main, PiBoard la devine à partir du suffixe. La devinette est juste dans la plupart des cas mais pas toujours ; si le symbole affiché à côté du cours vous semble faux, c'est cela.</p>

<h4>Marché fermé</h4>
          <p>Contrairement aux cryptomonnaies, la bourse ferme le soir et le week-end. Hors séance, la ligne s'atténue et porte la mention <b>« clôture »</b> : sans cela, une variation figée pendant tout un week-end ressemblerait à une tuile en panne. PiBoard espace aussi ses appels à la source hors séance, un cours fermé ne bougeant plus.</p>
          <p>Les horaires tiennent compte du <b>fuseau de chaque place</b> : le S&amp;P 500 est encore fermé quand il est 14 h à Paris, et le Nikkei est ouvert quand vous dormez. Les <b>principaux jours fériés</b> sont désormais pris en compte, y compris les dates mobiles (Vendredi saint, Lundi de Pâques) qui sont calculées et non figées dans une table. Restent hors périmètre : les demi-séances (24 décembre, signalée ouverte — c'est exact), les fériés reportés au lundi quand ils tombent un week-end, et le calendrier lunaire de Hong Kong. Le change n'est pas non plus disponible en continu : il ferme aussi le week-end, contrairement aux cryptos.</p>
          <p>Pour un symbole saisi à la main dont la place n'est pas identifiable, <b>aucune mention n'est affichée</b> : mieux vaut pas d'indicateur qu'un « fermé » faux.</p>

<h4>Les courbes</h4>
          <p>Un clic sur une ligne ouvre la courbe, qui s'ouvre sur la <b>journée en cours</b> (pas de 5 minutes), avec aussi 1 mois, 6 mois, 1 an et 5 ans. Hors séance, la courbe du jour montre la dernière séance connue.</p>
          <p>Les courbes viennent en priorité de Yahoo Finance, et non de Stooq comme les cours : Yahoo est la seule des deux à fournir l'intrajournalier, donc le graphique de la journée. Stooq reste en secours pour les périodes longues.</p>

<h4>Sources</h4>
          <p>Stooq en principal pour les cours, Yahoo Finance en secours — même principe que la tuile Cryptos avec Binance et CoinGecko. Aucune clé ni compte. Si les deux échouent, la ligne conserve sa dernière valeur connue en s'estompant légèrement, plutôt que de disparaître.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Lignes à afficher</span><span class="help-opt-desc">Nom, place, puis instrument ; « Autre… » pour un symbole saisi à la main (voir plus haut).</span></div>
<div class="help-opt"><span class="help-opt-name">Séparer les indices des valeurs individuelles</span><span class="help-opt-desc">Indices en tête, puis un trait avant actions, devises et matières premières.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la variation du jour</span><span class="help-opt-desc">La variation de la séance, à côté du cours.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">De 1 à 120 minutes (15 par défaut).</span></div>
<p class="help-opt-group">Graphique</p>
<div class="help-opt"><span class="help-opt-name">Fond du graphique</span><span class="help-opt-desc">Les couleurs des courbes.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de la courbe</span><span class="help-opt-desc">Par défaut : « #D6335C ».</span></div>
`,
        en: `
<h4>Goal</h4>
<p>Follow a few securities you care about, one line each, with the day's change.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Indices, shares, currencies and commodities</b>, picked from a list by exchange or typed as a symbol.</li>
  <li><b>Day's change</b> shown or not, and lines grouped by type if you wish.</li>
  <li><b>Chart</b> from 1 month to 5 years with a touch on a line, in the colour of your choice.</li>
  <li><b>Index constituents</b> at hand to add a security.</li>
  <li>Delayed quotes (not real time), free sources with no key or account; "market closed" flagged.</li>
</ul>

<h4>Configuring the lines</h4>
          <p>In the tile's settings, each line has three columns: a free <b>name</b> (the one shown on the tile), the <b>exchange</b> or family, then the <b>instrument</b>. Changing the exchange reloads the instrument list; the name fills itself in if you left it empty, without ever overwriting one you chose.</p>
          <p>The lists hold a selection only: the source covers more than 21,000 securities, which no dropdown could hold. For everything else, pick <b>"Other…"</b> at the end of the instrument list: a text field appears and accepts any symbol the source recognises.</p>

<h4>Indices and securities coexist</h4>
          <p>Indices and individual securities are two kinds of information one does not read the same way. The tile therefore gathers the indices at the top, draws a <b>separator line</b>, then shows shares, currencies and commodities. The order you chose in the settings is respected within each group. The line only appears if both groups exist, and grouping can be turned off in the settings.</p>
          <p>The <b>"Restore the defaults"</b> button puts the major indices back <b>without removing</b> the lines you added: it only adds what is missing. This is how to get the indices back if you deleted them — without it, the defaults apply only while the tile has never been configured, and an emptied list was lost for good.</p>

<h4>Index constituents</h4>
          <p>Three families list the securities making up an index: <b>CAC 40</b> (all 40), <b>DAX</b> and <b>Dow Jones</b>. Handy for adding a few of an index's members without hunting them one by one. These are shares, so they show below the separator, not with the indices.</p>
          <div class="help-warn">These constituent lists are a <b>snapshot</b>. Indices see entries and exits once to a few times a year, so the list is not updated automatically. A security that has left the index will keep working as an ordinary share.</div>

<h4>Typing a symbol by hand</h4>
          <p>The convention is the source's: exchange suffix (<code>.US</code>, <code>.FR</code>, <code>.DE</code>, <code>.UK</code>, <code>.JP</code>…), indices prefixed with <code>^</code>, FX pairs as six letters (<code>EURUSD</code>). Examples: <code>NESN.CH</code> for Nestlé, <code>^SPX</code> for the S&amp;P 500.</p>
          <p><b>Mind the currency</b>: for a hand-typed symbol, PiBoard guesses it from the suffix. The guess is right in most cases but not all; if the symbol shown next to the price looks wrong, that is why.</p>

<h4>Market closed</h4>
          <p>Unlike cryptocurrencies, stock markets close in the evening and at weekends. Outside trading hours the row dims and carries a <b>"closed"</b> tag: without it, a change frozen for a whole weekend would look like a broken tile. PiBoard also spaces out its calls to the source outside trading hours, a closed price no longer moving.</p>
          <p>The hours account for <b>each exchange's time zone</b>: the S&amp;P 500 is still closed when it is 2pm in Paris, and the Nikkei is open while you sleep. The <b>main public holidays</b> are now accounted for, including the moving dates (Good Friday, Easter Monday) which are computed rather than frozen into a table. Out of scope: half sessions (24 December, flagged open — which is correct), holidays shifted to the Monday when they fall at the weekend, and Hong Kong's lunar calendar. FX is not continuously available either: it too closes at the weekend, unlike crypto.</p>
          <p>For a hand-typed symbol whose exchange cannot be identified, <b>no tag is shown</b>: no indicator beats a wrong "closed".</p>

<h4>The charts</h4>
          <p>Clicking a row opens the chart, which starts on the <b>current day</b> (5-minute step), with 1 month, 6 months, 1 year and 5 years also available. Outside trading hours, the day chart shows the last known session.</p>
          <p>Charts come primarily from Yahoo Finance rather than Stooq as the quotes do: Yahoo is the only one of the two to provide intraday data, hence the day chart. Stooq stays as backup for the longer ranges.</p>

<h4>Sources</h4>
          <p>Stooq first for quotes, Yahoo Finance as backup — the same principle as the Crypto tile with Binance and CoinGecko. No key or account. If both fail, the line keeps its last known value and dims slightly, rather than disappearing.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Lines to display</span><span class="help-opt-desc">Name, exchange, then instrument; “Other…” for a hand-typed symbol (see above).</span></div>
<div class="help-opt"><span class="help-opt-name">Separate indices from individual securities</span><span class="help-opt-desc">Indices first, then a line before stocks, currencies and commodities.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the day's change</span><span class="help-opt-desc">The session's change, next to the price.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">1 to 120 minutes (15 by default).</span></div>
<p class="help-opt-group">Chart</p>
<div class="help-opt"><span class="help-opt-name">Chart background</span><span class="help-opt-desc">The curves' colours.</span></div>
<div class="help-opt"><span class="help-opt-name">Curve color</span><span class="help-opt-desc">Default: "#D6335C".</span></div>
`
      }
    },

    {
      id: "tempo",
      group: "tiles",
      title: { fr: "Couleur Tempo", en: "Tempo colour" },
      sub: {
        fr: "Bleu, blanc ou rouge : la couleur du jour de l'offre Tempo d'EDF.",
        en: "Blue, white or red: the colour of the day for EDF's Tempo tariff."
      },
      html: {
        fr: `
<div class="help-warn">Cette tuile n'a d'intérêt que si votre contrat d'électricité est l'<b>option Tempo d'EDF</b>. Avec n'importe quelle autre offre, la couleur affichée n'a aucune incidence sur votre facture.</div>

<h4>Objectif</h4>
<p>Savoir d'un coup d'œil, depuis l'autre bout de la pièce, si la journée Tempo est bleue, blanche ou rouge.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Couleur du jour</b> en bandeau pleine tuile, reconnaissable sans lire le texte (une journée Tempo va de 6 h à 6 h).</li>
  <li><b>Couleur du lendemain</b> dès que RTE la publie, vers 11 h.</li>
  <li><b>Jours restants</b> de chaque couleur sur la saison.</li>
  <li>API publique gratuite, sans compte ni clé — utile seulement si vous êtes à l'offre Tempo d'EDF.</li>
</ul>

<h4>Aujourd'hui et demain</h4>
          <p>La couleur du lendemain est publiée par RTE <b>une fois par jour, vers 11 h</b>. Avant cette publication, la tuile affiche « pas encore publiée » : c'est un état normal, pas une panne.</p>

<h4>Une journée Tempo va de 6 h à 6 h</h4>
          <p>C'est le piège de cette offre : une journée Tempo ne va pas de minuit à minuit, mais de <b>6 h du matin au lendemain 6 h</b>. Entre minuit et 6 h, la couleur réellement applicable est donc encore celle de la veille. Le réglage « utiliser la couleur réellement applicable », actif par défaut, en tient compte — indispensable sur un tableau allumé la nuit. Désactivez-le si vous préférez voir la couleur de la journée calendaire.</p>

<h4>Jours restants</h4>
          <p>Trois pastilles indiquent, quand l'API les fournit, le nombre de jours restants pour chaque couleur jusqu'à la fin de la saison (31 août). Une saison compte au maximum 22 jours rouges et 43 jours blancs ; tous les autres sont bleus.</p>

<h4>Source</h4>
          <p>L'API publique <code>api-couleur-tempo.fr</code>, gratuite et sans authentification, qui relaie les données officielles de RTE. PiBoard passe par son propre relais et ne l'interroge qu'une fois toutes les 30 minutes, quel que soit le nombre de tuiles ou d'écrans : cette API est hébergée bénévolement, il serait malvenu de la marteler.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Afficher la couleur de demain</span><span class="help-opt-desc">Dès que RTE l'a publiée, vers 11 h (voir plus haut).</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les jours restants par couleur (quand l'API les fournit)</span><span class="help-opt-desc">Quand l'API les fournit.</span></div>
<div class="help-opt"><span class="help-opt-name">Utiliser la couleur réellement applicable (une journée Tempo va de 6 h à 6 h)</span><span class="help-opt-desc">Une journée Tempo va de 6 h à 6 h : avant 6 h, c'est encore la couleur de la veille qui s'applique (voir plus haut).</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">De 5 à 240 minutes (30 par défaut).</span></div>
`,
        en: `
<div class="help-warn">This tile is only of interest if your electricity contract is <b>EDF's Tempo option</b>. On any other tariff, the colour shown has no bearing on your bill.</div>

<h4>Goal</h4>
<p>See at a glance, from across the room, whether the Tempo day is blue, white or red.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Today's colour</b> as a full-tile band, recognisable without reading (a Tempo day runs 6 am to 6 am).</li>
  <li><b>Tomorrow's colour</b> as soon as RTE publishes it, around 11 am.</li>
  <li><b>Days left</b> of each colour in the season.</li>
  <li>Free public API, no account or key — only useful on EDF's Tempo plan.</li>
</ul>

<h4>Today and tomorrow</h4>
          <p>Tomorrow's colour is published by RTE <b>once a day, around 11am</b>. Before that, the tile shows "not published yet": a normal state, not a failure.</p>

<h4>A Tempo day runs 6am to 6am</h4>
          <p>This is the tariff's trap: a Tempo day does not run midnight to midnight but from <b>6am to 6am the next morning</b>. Between midnight and 6am, the actually applicable colour is therefore still the previous day's. The "use the currently applicable colour" setting, on by default, accounts for this — essential on a board left on overnight. Turn it off if you would rather see the calendar day's colour.</p>

<h4>Remaining days</h4>
          <p>Three pills show, when the API provides them, how many days are left for each colour until the end of the season (31 August). A season has at most 22 red days and 43 white days; all the others are blue.</p>

<h4>Source</h4>
          <p>The public <code>api-couleur-tempo.fr</code> API, free and without authentication, relaying RTE's official data. PiBoard goes through its own relay and queries it only once every 30 minutes, however many tiles or screens you have: this API is hosted out of goodwill, and hammering it would be poor form.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Show tomorrow's colour</span><span class="help-opt-desc">As soon as RTE has published it, around 11am (see above).</span></div>
<div class="help-opt"><span class="help-opt-name">Show remaining days per colour (when the API provides them)</span><span class="help-opt-desc">When the API provides them.</span></div>
<div class="help-opt"><span class="help-opt-name">Use the currently applicable colour (a Tempo day runs 6am to 6am)</span><span class="help-opt-desc">A Tempo day runs from 6am to 6am: before 6am, the previous day's colour still applies (see above).</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">5 to 240 minutes (30 by default).</span></div>
`
      }
    },

    {
      id: "aiusage",
      group: "tiles",
      title: { fr: "Quotas IA", en: "AI usage" },
      sub: {
        fr: "Où en sont vos limites d'usage Claude, et quand elles se réinitialisent.",
        en: "Where your Claude usage limits stand, and when they reset."
      },
      html: {
        fr: `
<h4>Objectif</h4>
<p>Voir ce qu'il vous reste de quota sur votre compte IA, sans ouvrir la page d'usage du service.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Une barre par fenêtre</b> : 5 heures, 7 jours et fenêtre Opus hebdomadaire (chacune masquable), avec le temps restant avant réinitialisation.</li>
  <li><b>Seuils de couleur</b> réglables : orange puis rouge au-delà des pourcentages choisis.</li>
  <li>Pourcentages fournis par le service lui-même, rien n'est estimé.</li>
  <li><b>Connexion</b> unique depuis la tuile, qui ne voit jamais votre mot de passe ; Claude pris en charge pour l'instant.</li>
</ul>

<h4>Ce qui est affiché</h4>
          <p>Le service renvoie deux fenêtres, parfois trois : la <b>fenêtre de 5 heures</b> (la limite de session, glissante), la <b>fenêtre de 7 jours</b> (le plafond hebdomadaire) et, selon le compte, une fenêtre <b>Opus sur 7 jours</b>. Chacune peut être masquée dans les réglages de la tuile.</p>
          <div class="help-warn"><b>Il n'y a pas de fenêtre « quotidienne ».</b> Le service n'en expose pas : ce qui est parfois appelé « limite du jour » ailleurs correspond en réalité à la fenêtre glissante de 5 heures. La tuile n'invente donc pas de barre journalière.</div>
          <p>Les pourcentages viennent <b>directement du service</b>. Rien n'est estimé ni calibré par vous : une barre à 62 % signifie que le service lui-même déclare 62 %.</p>

<h4>Connexion</h4>
          <p>Une autorisation unique, depuis la tuile. Elle affiche une adresse à ouvrir dans un navigateur ; vous approuvez l'accès, vous atterrissez sur une page <code>localhost</code> qui affiche une erreur — <b>c'est normal et attendu</b>, aucun serveur n'écoute à cette adresse. Vous recopiez alors l'adresse complète depuis la barre du navigateur dans le champ prévu.</p>
          <p><b>PiBoard ne voit jamais votre mot de passe</b> : vous vous authentifiez chez le service, qui délivre à PiBoard un jeton limité à la lecture de votre profil. Ce jeton est conservé dans le coffre chiffré, séparé de <code>layout.json</code>, et n'est jamais renvoyé au navigateur — les pages n'obtiennent que des pourcentages et des heures.</p>

<h4>Autres services</h4>
          <p>La tuile est bâtie autour d'un système de fournisseurs : le widget lui-même ne connaît aucun service, il affiche des fenêtres. Ajouter ChatGPT, Gemini ou Copilot plus tard ne demandera donc pas de refaire la tuile.</p>

          <div class="help-warn"><b>Point d'entrée non officiel.</b> Le service d'usage utilisé n'est pas une API publique documentée : c'est celle qu'emploie le client officiel. Elle peut changer sans préavis. Le jour où cela arrivera, la tuile affichera « Quotas indisponibles » au lieu de se figer ou de faire tomber PiBoard — mais il faudra une mise à jour pour la remettre en service.</div>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Fournisseur</span><span class="help-opt-desc">Le service dont les quotas sont suivis (Claude, Anthropic).</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la fenêtre de 5 heures</span><span class="help-opt-desc">5 heures, 7 jours, et la fenêtre Opus hebdomadaire quand le fournisseur en renvoie une — chacune peut être masquée. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la fenêtre de 7 jours</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la fenêtre Opus hebdomadaire (quand le fournisseur en renvoie une)</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Orange au-dessus de (%)</span><span class="help-opt-desc">Seuils de couleur des jauges, en pourcentage (75 % et 90 % par défaut).</span></div>
<div class="help-opt"><span class="help-opt-name">Rouge au-dessus de (%)</span><span class="help-opt-desc">De 1 à 100, par défaut 90.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">De 1 à 60 minutes (5 par défaut).</span></div>
`,
        en: `
<h4>Goal</h4>
<p>See how much quota is left on your AI account, without opening the service's usage page.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>One bar per window</b>: 5 hours, 7 days and weekly Opus window (each can be hidden), with the time left before reset.</li>
  <li>Adjustable <b>colour thresholds</b>: orange then red above the percentages you choose.</li>
  <li>Percentages come from the service itself; nothing is estimated.</li>
  <li>One-time <b>sign-in</b> from the tile, which never sees your password; Claude supported for now.</li>
</ul>

<h4>What is shown</h4>
          <p>The service returns two windows, sometimes three: the <b>5-hour window</b> (the rolling session limit), the <b>7-day window</b> (the weekly cap) and, depending on the account, an <b>Opus over 7 days</b> window. Each can be hidden in the tile's settings.</p>
          <div class="help-warn"><b>There is no "daily" window.</b> The service does not expose one: what is sometimes called a "daily limit" elsewhere is in fact the rolling 5-hour window. So the tile does not invent a daily bar.</div>
          <p>The percentages come <b>straight from the service</b>. Nothing is estimated or calibrated by you: a bar at 62% means the service itself reports 62%.</p>

<h4>Connecting</h4>
          <p>A one-time authorization, from the tile. It shows an address to open in a browser; you approve access and land on a <code>localhost</code> page showing an error — <b>that is normal and expected</b>, nothing is listening at that address. You then copy the full address from the browser's bar into the field provided.</p>
          <p><b>PiBoard never sees your password</b>: you authenticate with the service, which issues PiBoard a token limited to reading your profile. That token is kept in the encrypted vault, separate from <code>layout.json</code>, and is never returned to the browser — pages only ever get percentages and times.</p>

<h4>Other services</h4>
          <p>The tile is built around a provider system: the widget itself knows no service, it displays windows. Adding ChatGPT, Gemini or Copilot later will therefore not require rebuilding the tile.</p>

          <div class="help-warn"><b>Unofficial endpoint.</b> The usage service used is not a documented public API: it is the one the official client uses. It may change without notice. When that happens the tile will show "Usage unavailable" rather than freezing or bringing PiBoard down — but an update will be needed to restore it.</div>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Provider</span><span class="help-opt-desc">The service whose quotas are tracked (Claude, Anthropic).</span></div>
<div class="help-opt"><span class="help-opt-name">Show the 5-hour window</span><span class="help-opt-desc">5 hours, 7 days, and the weekly Opus window when the provider reports one — each can be hidden. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the 7-day window</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the weekly Opus window (when the provider reports one)</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Amber above (%)</span><span class="help-opt-desc">Gauge colour thresholds, in percent (75% and 90% by default).</span></div>
<div class="help-opt"><span class="help-opt-name">Red above (%)</span><span class="help-opt-desc">From 1 to 100, default 90.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">1 to 60 minutes (5 by default).</span></div>
`
      }
    },

    {
      id: "crypto",
      group: "tiles",
      title: { fr: "Cours Cryptos", en: "Crypto prices" },
      sub: {
        fr: "Cours en direct et variation 24h de quelques cryptomonnaies, via CoinGecko (sans clé API). Touchez une crypto pour voir sa courbe (24h / 7j / 30j / 1an).",
        en: "Live prices and 24h change for a few coins, powered by CoinGecko (no API key). Tap a coin to see its price chart (24h / 7d / 30d / 1y)."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×2 par défaut, de 1×1 à 6×6</span>

<h4>Objectif</h4>
<p>Suivre le cours de quelques cryptomonnaies sans quitter le tableau.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Cours</b> et <b>variation sur 24 h</b> des cryptos de votre choix, dans la devise choisie.</li>
  <li><b>Courbe</b> d'un toucher : 24 h, 7 jours, 30 jours ou 1 an, avec une grille de la couleur voulue.</li>
  <li>Données Binance avec repli sur CoinGecko, sans clé ni compte.</li>
</ul>

<h4>Possibilités</h4>
          <p>La liste des cryptos suivies se personnalise librement (par exemple Bitcoin, Ethereum, une monnaie plus confidentielle) via leurs identifiants CoinGecko. Touchez une ligne pour faire apparaître sa courbe de prix sur plusieurs périodes (24 heures, 7 jours, 30 jours, 1 an), pratique pour évaluer une tendance sans avoir besoin d'ouvrir une application dédiée.</p>
          <p>La fenêtre de courbe affiche des traits de repère horizontaux en fond, avec une valeur de prix « ronde » en regard de chacun (par exemple des multiples de 5 000 plutôt que les valeurs exactes de la série) — pratique pour évaluer les fluctuations d'un coup d'œil. Le logo de la crypto apparaît à gauche de son nom quand elle fait partie des cryptos les plus courantes (voir la section « Deux sources » ci-dessus) ; absent pour les cryptos plus confidentielles, plutôt que d'afficher un logo générique trompeur.</p>
          <p>Le fond du graphique, la couleur de la courbe et celle des traits de repère se personnalisent chacun indépendamment dans les réglages de la tuile.</p>
          <p>Les cours passent par le serveur PiBoard (jamais directement par le navigateur), qui interroge deux sources : <b>Binance</b> en priorité (API publique, quota très largement suffisant, aucune configuration requise), et <b>CoinGecko</b> en repli pour les cryptomonnaies plus confidentielles que Binance ne référence pas, ou en cas de panne ponctuelle de Binance. C'est CoinGecko seul, avec son quota gratuit très bas (5 à 15 requêtes par minute, partagées par toute l'adresse IP du foyer), qui provoquait auparavant des échecs fréquents et imprévisibles ; Binance en source principale les rend en pratique exceptionnels pour les cryptos courantes. Le serveur met en cache les cours et les courbes (par cryptomonnaie individuelle), et conserve la dernière valeur connue si les deux sources échouent en même temps — un discret rappel « dernières valeurs connues » apparaît alors, plutôt qu'une tuile vide.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Cryptos (identifiants CoinGecko, séparés par des virgules)</span><span class="help-opt-desc">Liste d'identifiants CoinGecko séparés par des virgules (ex. <code>bitcoin,ethereum,solana</code>). L'identifiant CoinGecko correspond en général au nom complet en minuscules. Par défaut : « bitcoin,ethereum ».</span></div>
<div class="help-opt"><span class="help-opt-name">Devise</span><span class="help-opt-desc">Euro ou dollar US.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour des cours.</span></div>
<p class="help-opt-group">Graphique</p>
<div class="help-opt"><span class="help-opt-name">Fond du graphique</span><span class="help-opt-desc">Couleur d'arrière-plan de la fenêtre de courbe.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de la courbe</span><span class="help-opt-desc">Couleur de la ligne et de son remplissage.</span></div>
<div class="help-opt"><span class="help-opt-name">Traits de repère et valeurs</span><span class="help-opt-desc">Couleur des traits horizontaux en fond et de leurs valeurs indicatrices.</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 1×1 to 6×6</span>

<h4>Goal</h4>
<p>Follow a few cryptocurrencies without leaving the board.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Price</b> and <b>24-hour change</b> of the cryptos you choose, in the currency of your choice.</li>
  <li><b>Chart</b> with a touch: 24 hours, 7 days, 30 days or 1 year, with a grid in the colour you want.</li>
  <li>Binance data with CoinGecko as fallback, no key or account.</li>
</ul>

<h4>Possibilities</h4>
          <p>The list of tracked coins can be freely customized (for instance Bitcoin, Ethereum, a more niche coin) via their CoinGecko identifiers. Tap a row to bring up its price chart over several periods (24 hours, 7 days, 30 days, 1 year), handy for gauging a trend without needing to open a dedicated app.</p>
          <p>The chart window shows horizontal reference lines in the background, with a "round" price value next to each (e.g. multiples of 5,000 rather than the series' exact values) — handy for gauging fluctuations at a glance. The coin's logo shows up left of its name when it's among the most common coins (see the "Two sources" section above); absent for more niche coins, rather than showing a misleading generic logo.</p>
          <p>The chart's background, the curve's color and the reference lines' color can each be customized independently in the tile's settings.</p>
          <p>Prices go through the PiBoard server (never straight from the browser), which queries two sources: <b>Binance</b> first (public API, quota more than generous enough, no configuration needed), and <b>CoinGecko</b> as a fallback for more niche coins Binance doesn't list, or during a momentary Binance outage. It was CoinGecko alone, with its very low free quota (5 to 15 requests per minute, shared by the household's entire IP address), that used to cause frequent, unpredictable failures; having Binance as the main source makes those exceptional in practice for common coins. The server caches prices and charts (per individual coin), and keeps the last known value if both sources fail at once — a discreet "last known values" reminder then appears, rather than an empty tile.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Coins (CoinGecko ids, comma-separated)</span><span class="help-opt-desc">Comma-separated list of CoinGecko IDs (e.g. <code>bitcoin,ethereum,solana</code>). The CoinGecko ID is generally the full lowercase name. Default: "bitcoin,ethereum".</span></div>
<div class="help-opt"><span class="help-opt-name">Currency</span><span class="help-opt-desc">Euro or US dollar.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two price updates.</span></div>
<p class="help-opt-group">Chart</p>
<div class="help-opt"><span class="help-opt-name">Chart background</span><span class="help-opt-desc">Background color of the chart window.</span></div>
<div class="help-opt"><span class="help-opt-name">Curve color</span><span class="help-opt-desc">Color of the line and its fill.</span></div>
<div class="help-opt"><span class="help-opt-name">Gridlines and value labels</span><span class="help-opt-desc">Color of the background horizontal lines and their reference values.</span></div>
`
      }
    },

    {
      id: "notes",
      group: "tiles",
      title: { fr: "Bloc-notes", en: "Notes" },
      sub: {
        fr: "Plusieurs notes en onglets, barre d'outils de mise en forme, listes à cocher interactives, couleur par note et texte auto-ajusté. Enregistré sur le serveur, partagé entre les écrans.",
        en: "Several notes in tabs, a formatting toolbar, interactive checklists, per-note color and auto-fitting text. Saved on the server, shared by all screens."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×3 par défaut, de 2×2 à 8×8</span>

<h4>Objectif</h4>
<p>Un pense-bête toujours visible : liste de courses, mot pour la famille, rappel du jour.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Markdown léger</b> (titres, gras, listes) avec une <b>barre d'outils</b> de mise en forme.</li>
  <li><b>Listes à cocher</b> interactives, cochables même en lecture seule.</li>
  <li><b>Couleurs post-it</b> et <b>taille du texte</b> fixe ou ajustée automatiquement à la tuile.</li>
  <li><b>Plusieurs notes</b> dans une seule tuile.</li>
  <li>Enregistré sur le serveur et partagé entre les écrans ; horodatage et compteur de mots en option.</li>
</ul>

<h4>Possibilités</h4>
          <p>Le texte accepte un Markdown léger (titres, gras, italique, barré) et surtout des listes à cocher interactives — tapez <code>[ ] Lait</code> pour créer une case à cocher directement cliquable sur l'écran, très pratique pour une liste de courses partagée à la maison. Le contenu est enregistré côté serveur et donc partagé entre tous les écrans PiBoard de la maison si vous en avez plusieurs. Le style « post-it » (couleur au choix) donne un rendu chaleureux ; la taille du texte s'ajuste automatiquement à la taille de la tuile, ou peut être fixée manuellement — jusqu'à 8 pixels, ce qui permet d'afficher beaucoup de texte quand PiBoard tourne sur un écran de bureau plutôt que sur une dalle tactile regardée de loin.</p>

<h4>La barre d'outils</h4>
          <p>Touchez la note pour passer en édition : une petite barre d'outils apparaît alors en haut de la tuile. Elle ne s'affiche qu'en édition, car elle agit sur le texte source. Chaque bouton fonctionne en <b>bascule</b> : le réappuyer retire la mise en forme au lieu de l'empiler.</p>
          <div class="help-opt"><span class="help-opt-name">☐</span><span class="help-opt-desc">Transforme la ligne en case à cocher. Sélectionnez plusieurs lignes pour toutes les convertir d'un coup.</span></div>
          <div class="help-opt"><span class="help-opt-name">B / I / S</span><span class="help-opt-desc">Gras, italique, barré. Sans sélection, les marqueurs sont insérés et le curseur placé entre les deux, prêt à taper.</span></div>
          <div class="help-opt"><span class="help-opt-name">Titre / Normal</span><span class="help-opt-desc">Bascule la ligne entre le style titre et le texte courant.</span></div>
          <div class="help-opt"><span class="help-opt-name">Pastille de couleur</span><span class="help-opt-desc">Ouvre une palette de teintes très pâles pour colorer la note courante (voir ci-dessous).</span></div>
          <div class="help-opt"><span class="help-opt-name">+</span><span class="help-opt-desc">Crée une nouvelle note dans cette même tuile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Corbeille</span><span class="help-opt-desc">Supprime la note courante, après confirmation. Supprimer la dernière note la vide simplement, pour que le bloc-notes reste utilisable.</span></div>
          <p>Les styles de bloc s'excluent mutuellement : transformer un titre en case à cocher lui retire son préfixe de titre. Les lignes vides ne reçoivent jamais de marqueur.</p>

<h4>Plusieurs notes dans une seule tuile</h4>
          <p>Une même tuile peut contenir <b>plusieurs notes</b>, chacune sur son onglet — par exemple une liste de courses, un pense-bête et une liste d'anniversaires. La rangée d'onglets n'apparaît qu'à partir de deux notes ; avec une seule, il n'y a rien vers quoi basculer et cette rangée prendrait de la hauteur pour rien.</p>
          <p>Le <b>nom d'un onglet est déduit automatiquement</b> de la première ligne non vide de la note (marqueurs de mise en forme retirés) : il n'y a donc aucune étape de nommage à la création, on tape et l'onglet se nomme tout seul. Commencer la note par un titre est le moyen le plus simple de lui donner un nom clair.</p>
          <p>Le bouton de couleur affecte une <b>teinte très pâle</b> à la note courante, reportée sur son onglet : c'est ce qui permet de distinguer une note de sa voisine <i>sans avoir à l'ouvrir</i>. Cette couleur est indépendante du réglage « Couleur post-it » ci-dessous, qui teinte la tuile entière : les deux se superposent, d'où des teintes de note volontairement très légères pour que le texte reste confortable à lire sur un écran allumé en permanence.</p>
          <p>Changer d'onglet valide d'abord l'édition en cours : rien de ce qui vient d'être tapé n'est perdu.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Couleur post-it</span><span class="help-opt-desc">Couleur de la tuile elle-même, ou une teinte post-it (jaune, vert, bleu, rose, orange).</span></div>
<div class="help-opt"><span class="help-opt-name">Ajuster automatiquement la taille du texte</span><span class="help-opt-desc">La taille du texte s'adapte à la taille de la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Taille du texte si ajustement désactivé (px)</span><span class="help-opt-desc">Utilisée si l'ajustement automatique est désactivé. De 8 à 40 pixels : les petites valeurs servent surtout sur un écran de bureau, où l'on lit à 60 cm et où une taille pensée pour être vue à travers la pièce devient énorme.</span></div>
<div class="help-opt"><span class="help-opt-name">Lecture seule (les cases restent cochables)</span><span class="help-opt-desc">Empêche la modification du texte tout en gardant les cases à cocher interactives — pratique pour une liste préparée à l'avance que l'on ne veut faire que cocher.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher l'horodatage et le compteur de mots</span><span class="help-opt-desc">Petites informations discrètes en bas de la tuile.</span></div>
`,
        en: `
<span class="help-size">Size: 3×3 by default, from 2×2 to 8×8</span>

<h4>Goal</h4>
<p>An always-visible reminder: shopping list, note for the family, today's reminder.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Light Markdown</b> (headings, bold, lists) with a formatting <b>toolbar</b>.</li>
  <li>Interactive <b>checklists</b>, tickable even in read-only mode.</li>
  <li><b>Sticky-note colours</b> and a <b>text size</b> that is fixed or fitted to the tile automatically.</li>
  <li><b>Several notes</b> in a single tile.</li>
  <li>Saved on the server and shared between screens; timestamp and word count optional.</li>
</ul>

<h4>Possibilities</h4>
          <p>The text accepts light Markdown (headings, bold, italics, strikethrough) and, most usefully, interactive checklists — type <code>[ ] Milk</code> to create a checkbox directly clickable on screen, very handy for a shopping list shared at home. The content is saved server-side and therefore shared across every PiBoard screen in the house if you have several. The "sticky note" style (choice of color) gives a warm look; text size adapts automatically to the tile's size, or can be set manually — down to 8 pixels, which fits a lot of text in when PiBoard runs on a desktop screen rather than a touchscreen seen from across the room.</p>

<h4>The toolbar</h4>
          <p>Tap the note to start editing: a small toolbar then appears at the top of the tile. It only shows while editing, since it acts on the source text. Each button is a <b>toggle</b>: pressing it again removes the formatting instead of stacking it.</p>
          <div class="help-opt"><span class="help-opt-name">☐</span><span class="help-opt-desc">Turns the line into a checkbox. Select several lines to convert them all at once.</span></div>
          <div class="help-opt"><span class="help-opt-name">B / I / S</span><span class="help-opt-desc">Bold, italic, strikethrough. With no selection, the markers are inserted and the caret placed between them, ready to type.</span></div>
          <div class="help-opt"><span class="help-opt-name">Heading / Normal</span><span class="help-opt-desc">Toggles the line between heading style and body text.</span></div>
          <div class="help-opt"><span class="help-opt-name">Color dot</span><span class="help-opt-desc">Opens a palette of very pale tints to color the current note (see below).</span></div>
          <div class="help-opt"><span class="help-opt-name">+</span><span class="help-opt-desc">Creates a new note inside this same tile.</span></div>
          <div class="help-opt"><span class="help-opt-name">Bin</span><span class="help-opt-desc">Deletes the current note, after confirmation. Deleting the last note simply empties it, so the notepad stays usable.</span></div>
          <p>Block styles are mutually exclusive: turning a heading into a checkbox strips its heading prefix. Empty lines never receive a marker.</p>

<h4>Several notes in a single tile</h4>
          <p>One tile can hold <b>several notes</b>, each on its own tab — a shopping list, a reminder and a birthday list, for instance. The tab row only appears from two notes on; with a single one there is nothing to switch to and that row would eat height for nothing.</p>
          <p>A <b>tab's name is derived automatically</b> from the note's first non-empty line (formatting markers stripped): there is no naming step at creation, you type and the tab names itself. Starting the note with a heading is the simplest way to give it a clear name.</p>
          <p>The color button assigns a <b>very pale tint</b> to the current note, carried onto its tab: this is what lets you tell one note from its neighbour <i>without opening it</i>. This color is independent of the "Sticky-note color" setting below, which tints the whole tile: the two layer on top of each other, hence deliberately very light note tints so text stays comfortable to read on an always-on screen.</p>
          <p>Switching tabs commits the ongoing edit first: nothing just typed is lost.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Sticky-note color</span><span class="help-opt-desc">The tile's own color, or a sticky-note tint (yellow, green, blue, pink, orange).</span></div>
<div class="help-opt"><span class="help-opt-name">Auto-fit text size to the tile</span><span class="help-opt-desc">Text size adapts to the tile's size.</span></div>
<div class="help-opt"><span class="help-opt-name">Text size when auto-fit is off (px)</span><span class="help-opt-desc">Used if auto-fit is disabled. From 8 to 40 pixels: small values are mostly for a desktop screen, where you read from 60 cm and a size meant to be seen across the room becomes enormous.</span></div>
<div class="help-opt"><span class="help-opt-name">Read-only (checkboxes stay tappable)</span><span class="help-opt-desc">Prevents editing the text while keeping checkboxes interactive — handy for a list prepared in advance that should only be checked off.</span></div>
<div class="help-opt"><span class="help-opt-name">Show timestamp and word count</span><span class="help-opt-desc">Small discreet info at the bottom of the tile.</span></div>
`
      }
    },

    {
      id: "text",
      group: "tiles",
      title: { fr: "Texte", en: "Text" },
      sub: {
        fr: "Un titre ou une ligne de texte, placé où vous voulez.",
        en: "A title or a line of text, placed where you want it."
      },
      html: {
        fr: `
<p>Une tuile de <b>style</b> : elle n'affiche aucune donnée, elle sert à composer une page. Un titre en haut d'une page de tableau de bord, l'intitulé d'un groupe de tuiles, une légende. Associée au <b>fond transparent</b> (réglages de la tuile → Apparence), elle permet de titrer une page sans qu'aucun cadre n'apparaisse.</p>

<h4>Objectif</h4>
<p>Titrer une page, nommer une zone ou poser une légende, sans cadre visible si vous le souhaitez.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Texte libre</b> sur une ou plusieurs lignes.</li>
  <li><b>Taille automatique</b> (le texte remplit la tuile) ou <b>taille fixe</b> en pixels.</li>
  <li><b>Police</b>, graisse, italique, majuscules et espacement des lettres.</li>
  <li><b>Couleur</b> du thème ou personnalisée.</li>
  <li><b>Position</b> horizontale et verticale dans la tuile.</li>
  <li>Avec le fond transparent, le texte se pose directement sur le fond de page ; fonctionne en mode classique comme en tableau de bord.</li>
</ul>

<h4>Deux façons de fixer la taille</h4>
          <div class="help-opt"><span class="help-opt-name">S'adapter à la tuile</span><span class="help-opt-desc">Par défaut. La taille est recalculée à chaque redimensionnement pour que le texte remplisse la tuile sans jamais déborder. C'est le bon choix dans presque tous les cas : une tuile de titre est presque toujours redimensionnée après coup, et un titre coupé est le défaut le plus visible qui soit sur un écran mural.</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille fixe</span><span class="help-opt-desc">La taille en pixels que vous indiquez, quelle que soit la taille de la tuile. Prévisible — utile quand plusieurs titres doivent avoir exactement la même taille sur des tuiles de largeurs différentes — mais le texte déborde si vous rétrécissez la tuile.</span></div>

<h4>Polices</h4>
          <p>Cinq familles sont proposées. <b>Seules les polices présentes sur la machine sont utilisées</b> : sur un Raspberry Pi le choix est nettement plus étroit que sur un PC. Chaque option liste donc plusieurs polices et retombe sur la plus proche disponible — jamais sur rien. Le rendu peut donc différer entre votre PC et le Pi ; si l'aspect compte, vérifiez sur l'écran de destination.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p>Graisse, italique, majuscules, espacement des lettres, couleur (par défaut celle du thème, qui bascule avec le mode jour/nuit — et qui, si la tuile est en <b>fond transparent</b>, se calcule d'après le fond de la <b>page</b> pour continuer à trancher sur ce qui se trouve réellement derrière ; cochez « Couleur personnalisée » pour la figer), position horizontale et verticale dans la tuile, et une ombre portée utile quand la tuile est transparente au-dessus d'une photo claire.</p><p><b>S'accorder au thème.</b> Par défaut, le texte prend la couleur de texte courante du thème — du blanc cassé sur un thème sombre. Pour un titre de page, c'est souvent la couleur d'<b>accent</b> qu'on veut : celle des titres de tuiles, qui fait que le titre appartient visiblement au même tableau au lieu de trancher. L'option <b>« Utiliser la couleur d'accent du thème »</b> fait exactement cela, et suit ensuite tous les changements de thème et la bascule jour/nuit sans rien à reprendre. Elle reste une option, décochée par défaut : les tuiles déjà posées ne changent pas d'apparence. Une couleur personnalisée, si elle est cochée, l'emporte sur l'accent. Le rendu se prévisualise dans l'éditeur de thèmes, qui montre un échantillon des tuiles Texte et Horloge.</p><p>Les retours à la ligne saisis dans le champ sont conservés. Une tuile sans texte affiche une mention discrète plutôt que rien : sans elle, une tuile transparente et vide serait introuvable sur la page, même en mode édition.</p>
<div class="help-opt"><span class="help-opt-name">Texte</span><span class="help-opt-desc">Une ou plusieurs lignes. Les retours à la ligne sont conservés.</span></div>
<div class="help-opt"><span class="help-opt-name">Police</span><span class="help-opt-desc">Seules les polices présentes sur la machine sont utilisées. Sur un Raspberry Pi le choix est plus étroit que sur un PC : chaque option retombe sur la famille la plus proche disponible. Choix : Interface (sans empattement), Avec empattements, Chasse fixe, Condensée, Manuscrite. Par défaut : Interface (sans empattement).</span></div>
<div class="help-opt"><span class="help-opt-name">Taille</span><span class="help-opt-desc">« S'adapter » recalcule la taille à chaque redimensionnement de la tuile : le texte la remplit toujours sans déborder. « Fixe » conserve la taille ci-dessous, quelle que soit la taille de la tuile. Choix : S'adapter à la tuile, Taille fixe. Par défaut : S'adapter à la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Taille fixe (px)</span><span class="help-opt-desc">De 8 à 300, par défaut 32.</span></div>
<div class="help-opt"><span class="help-opt-name">Graisse</span><span class="help-opt-desc">Choix : Fine, Normale, Demi-grasse, Grasse. Par défaut : Demi-grasse.</span></div>
<div class="help-opt"><span class="help-opt-name">Italique</span><span class="help-opt-desc">Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Majuscules</span><span class="help-opt-desc">Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Espacement des lettres (px)</span><span class="help-opt-desc">De -5 à 30, par défaut 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Utiliser la couleur d'accent du thème</span><span class="help-opt-desc">Cochée, le texte prend la couleur d'accent du thème appliqué — celle des titres de tuiles — pour qu'un titre de page s'accorde au reste du tableau au lieu de trancher en couleur de texte ordinaire. Elle suit tous les changements de thème et la bascule jour/nuit. Une couleur personnalisée ci-dessous, si elle est cochée, l'emporte sur ce réglage. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de texte personnalisée</span><span class="help-opt-desc">Décochée, le texte suit le thème du tableau et bascule avec le mode jour/nuit. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur du texte</span><span class="help-opt-desc">Par défaut : « #F2F5FA ».</span></div>
<div class="help-opt"><span class="help-opt-name">Position horizontale</span><span class="help-opt-desc">Choix : Gauche, Centrée, Droite. Par défaut : Centrée.</span></div>
<div class="help-opt"><span class="help-opt-name">Position verticale</span><span class="help-opt-desc">Choix : Haut, Milieu, Bas. Par défaut : Milieu.</span></div>
<div class="help-opt"><span class="help-opt-name">Ombre portée</span><span class="help-opt-desc">Utile quand la tuile est transparente au-dessus d'une photo de fond claire. Désactivé par défaut.</span></div>
`,
        en: `
<p>A <b>style</b> tile: it displays no data, it is there to compose a page. A title at the top of a dashboard page, the heading of a group of tiles, a caption. Combined with the <b>transparent background</b> (tile settings → Appearance), it lets you title a page with no frame appearing at all.</p>

<h4>Goal</h4>
<p>Title a page, name an area or add a caption, with no visible frame if you wish.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Free text</b> on one or several lines.</li>
  <li><b>Automatic size</b> (the text fills the tile) or a <b>fixed size</b> in pixels.</li>
  <li><b>Font</b>, weight, italic, uppercase and letter spacing.</li>
  <li>Theme or custom <b>colour</b>.</li>
  <li>Horizontal and vertical <b>position</b> in the tile.</li>
  <li>With a transparent background the text sits right on the page background; works in classic and dashboard modes.</li>
</ul>

<h4>Two ways of setting the size</h4>
          <div class="help-opt"><span class="help-opt-name">Fit the tile</span><span class="help-opt-desc">The default. The size is recomputed on every resize so the text fills the tile without ever overflowing. This is the right choice in almost every case: a title tile is almost always resized afterwards, and clipped text is the most visible defect there is on a wall screen.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fixed size</span><span class="help-opt-desc">The pixel size you give, whatever the tile's size. Predictable — useful when several titles must be exactly the same size on tiles of different widths — but the text overflows if you shrink the tile.</span></div>

<h4>Fonts</h4>
          <p>Five families are offered. <b>Only fonts present on the machine are used</b>: on a Raspberry Pi the choice is markedly narrower than on a PC. Each option therefore lists several fonts and falls back on the closest available one — never on nothing. The rendering may thus differ between your PC and the Pi; if looks matter, check on the target screen.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p>Weight, italic, uppercase, letter spacing, colour (by default the theme's, which switches with day/night mode — and which, if the tile has a <b>transparent background</b>, is computed from the <b>page</b> background so it keeps contrasting with what is actually behind it; tick "Custom text colour" to pin it), horizontal and vertical position within the tile, and a text shadow useful when the tile is transparent over a light photo.</p><p><b>Matching the theme.</b> By default the text takes the theme's ordinary text colour — off-white on a dark theme. For a page title it is often the <b>accent</b> colour one wants: the tile titles' one, which makes the title visibly belong to the same board instead of standing apart. The <b>"Use the theme's accent colour"</b> option does exactly that, and then follows every theme change and the day/night switch with nothing to redo. It stays an option, unticked by default, so tiles already placed do not change. A custom colour, if ticked, wins over the accent. The result can be previewed in the theme editor, which shows a sample of the Text and Clock tiles.</p><p>Line breaks typed in the field are kept. A tile with no text shows a discreet note rather than nothing: without it, a transparent empty tile would be impossible to find on the page, edit mode included.</p>
<div class="help-opt"><span class="help-opt-name">Text</span><span class="help-opt-desc">One or more lines. Line breaks are kept.</span></div>
<div class="help-opt"><span class="help-opt-name">Font</span><span class="help-opt-desc">Only fonts present on the machine are used. On a Raspberry Pi the choice is narrower than on a PC: each option falls back to the closest family available. Choices: Interface (sans-serif), Serif, Monospaced, Condensed, Handwritten. Default: Interface (sans-serif).</span></div>
<div class="help-opt"><span class="help-opt-name">Size</span><span class="help-opt-desc">"Fit" recomputes the size whenever the tile is resized: the text always fills it without overflowing. "Fixed" keeps the size below, whatever the tile's size. Choices: Fit the tile, Fixed size. Default: Fit the tile.</span></div>
<div class="help-opt"><span class="help-opt-name">Fixed size (px)</span><span class="help-opt-desc">From 8 to 300, default 32.</span></div>
<div class="help-opt"><span class="help-opt-name">Weight</span><span class="help-opt-desc">Choices: Light, Regular, Semi-bold, Bold. Default: Semi-bold.</span></div>
<div class="help-opt"><span class="help-opt-name">Italic</span><span class="help-opt-desc">Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Uppercase</span><span class="help-opt-desc">Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Letter spacing (px)</span><span class="help-opt-desc">From -5 to 30, default 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Use the theme's accent color</span><span class="help-opt-desc">Ticked, the text takes the accent color of the applied theme — the one used by the tile titles — so a page title sits with the rest of the board instead of standing apart in plain text color. It follows every theme change and the day/night switch. A custom color below, if ticked, wins over this. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Custom text color</span><span class="help-opt-desc">Unticked, the text follows the board's theme and switches with day/night mode. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Text color</span><span class="help-opt-desc">Default: "#F2F5FA".</span></div>
<div class="help-opt"><span class="help-opt-name">Horizontal position</span><span class="help-opt-desc">Choices: Left, Centered, Right. Default: Centered.</span></div>
<div class="help-opt"><span class="help-opt-name">Vertical position</span><span class="help-opt-desc">Choices: Top, Middle, Bottom. Default: Middle.</span></div>
<div class="help-opt"><span class="help-opt-name">Text shadow</span><span class="help-opt-desc">Useful when the tile is transparent over a light background photo. Off by default.</span></div>
`
      }
    },
    {
      id: "image",
      group: "tiles",
      title: { fr: "Logo / Image", en: "Logo / Image" },
      sub: {
        fr: "Une image stockée sur la machine PiBoard elle-même.",
        en: "An image stored on the PiBoard machine itself."
      },
      html: {
        fr: `
<p>Une tuile de <b>style</b>, comme la tuile Texte : un logo dans un coin d'écran, un bandeau, une illustration de fond. Associée au <b>fond transparent</b>, l'image apparaît sans cadre.</p>

<h4>Objectif</h4>
<p>Afficher un logo, une photo ou une illustration sur le tableau, stockée sur la machine PiBoard elle-même.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Image téléversée</b> depuis les réglages, ou choisie dans la <b>bibliothèque</b> partagée (fonds livrés, logos, vos images) ; conservée dans <code>data/</code>, elle survit aux mises à jour.</li>
  <li><b>Cinq cadrages</b> : image entière, recadrer, remplir la tuile, étirer ou taille d'origine, avec <b>zoom</b> et <b>recadrage direct</b> sur l'image aux doigts ou à la souris.</li>
  <li><b>Miroir</b> horizontal ou vertical et <b>rotation</b> par quart de tour.</li>
  <li><b>Position</b>, marge intérieure, <b>arrondi</b> des coins et <b>opacité</b>.</li>
  <li><b>Lien</b> optionnel ouvert d'un toucher sur l'image.</li>
  <li>Aucune adresse externe : rien n'est récupéré sur Internet.</li>
</ul>

<h4>Stockage local, et c'est délibéré</h4>
          <p>L'image est <b>téléversée sur la machine PiBoard</b> et servie par elle. Aucune adresse externe à saisir : rien ne casse le jour où un site distant disparaît, rien ne part sur Internet depuis un tableau mural, et l'image reste affichée même sans connexion.</p>
          <p>Les fichiers sont rangés dans le dossier <code>data/</code>, celui qui n'est <b>jamais touché par les mises à jour</b> et qui est inclus dans les sauvegardes. Le mécanisme est celui déjà utilisé par le Diaporama, ce qui fait hériter cette tuile de ses contrôles : extensions autorisées, taille maximale, noms de fichiers assainis.</p>
          <p>Chaque tuile a son propre dossier : deux tuiles Logo n'ont pas la même bibliothèque d'images. Tant que la tuile est vide, le bouton <b>« Choisir une image »</b> s'affiche <b>dans la tuile elle-même</b> : il ouvre le gestionnaire, où l'on téléverse, choisit ou supprime. Une fois l'image posée, ce bouton laisse la place à l'image ; pour en changer, passez en <b>mode édition</b> et utilisez l'<b>appareil photo</b> de la barre d'outils, en bas de la tuile. La fenêtre de réglages, elle, ne permet pas de choisir un fichier : elle n'affiche que son nom.</p>

<h4>Réinitialiser</h4>
          <p>Le bouton <b>« Réinitialiser les réglages »</b>, en bas de la fenêtre de configuration de n'importe quelle tuile, remet celle-ci à ses réglages d'origine — pratique si l'on s'est perdu dans un recadrage. <b>L'image téléversée est conservée</b> : c'est un fichier, pas un réglage, et le perdre obligerait à le rechercher. Une confirmation est demandée, car rien ne permet de retrouver les réglages effacés.</p>

<h4>Cadrage</h4>
          <div class="help-opt"><span class="help-opt-name">Image entière</span><span class="help-opt-desc">Par défaut, et le seul choix qui ne rogne ni ne déforme jamais. Pour un logo, gardez celui-ci : des marges valent mieux qu'un logo tronqué.</span></div>
          <div class="help-opt"><span class="help-opt-name">Recadrer</span><span class="help-opt-desc">L'image couvre la tuile et vous choisissez la partie visible : le <b>zoom</b> l'agrandit ou la réduit (100 % la laisse à la taille que lui donne le cadrage ; au-delà les bords sortent du cadre et sont coupés, en deçà elle rétrécit dans la tuile) et les deux <b>positions du recadrage</b> décident de ce qui reste en vue. <b>Le zoom et les deux positions fonctionnent avec tous les cadrages</b>, pas seulement « Recadrer » — utile pour garder un visage ou un logo dans le cadre plutôt que le milieu de l'image. Le <b>fichier n'est pas modifié</b> : vous pouvez revenir en arrière à tout moment, et deux tuiles peuvent recadrer différemment la même image.</span></div>
          <p><b>Le plus simple est de recadrer directement sur l'image.</b> Dès que vous passez en <b>mode édition</b>, quatre poignées d'angle et une petite barre d'outils apparaissent sur la tuile, quel que soit le cadrage choisi.</p>

<h4>Ce que fait chaque geste, et à quelle condition</h4>
          <div class="help-opt"><span class="help-opt-name">Tirer une poignée d'angle</span><span class="help-opt-desc">Zoome. Vers l'extérieur pour agrandir, vers l'intérieur pour réduire. <b>Fonctionne toujours</b>, quel que soit le cadrage et quel que soit le zoom de départ.</span></div>
          <div class="help-opt"><span class="help-opt-name">Glisser sur l'image</span><span class="help-opt-desc">Déplace l'image dans son cadre. <b>N'a d'effet qu'au-dessus de 100 % de zoom</b> — et c'est normal : en dessous, l'image tient entièrement dans la tuile, il n'y a rien hors du cadre, donc rien à faire venir. Le curseur indique un déplacement possible dès le survol, mais si vous êtes à 100 % ou moins, rien ne bougera. Zoomez d'abord, déplacez ensuite.</span></div>
          <div class="help-opt"><span class="help-opt-name">Boutons − et +</span><span class="help-opt-desc">Zooment par pas de 10 %. Le pourcentage affiché entre les deux est le zoom courant.</span></div>
          <div class="help-opt"><span class="help-opt-name">Bouton de remise à zéro</span><span class="help-opt-desc">Ramène le zoom à 100 % et le recadrage au centre. Ne touche ni au cadrage, ni à l'image.</span></div>
          <div class="help-opt"><span class="help-opt-name">Appareil photo</span><span class="help-opt-desc">Ouvre le gestionnaire d'images pour téléverser, choisir ou supprimer un fichier.</span></div>
          <p>Le résultat s'affiche <b>pendant</b> le geste ; l'enregistrement n'a lieu qu'au relâchement. Les champs numériques des réglages restent utiles pour poser une valeur exacte ou reproduire à l'identique le recadrage d'une autre tuile.</p>

<h4>Miroir et rotation</h4>
          <p>Trois réglages, dans la fenêtre de configuration et aussi en accès direct dans la barre d'outils du recadrage (↔, ↕, ⟳) : <b>miroir horizontal</b>, <b>miroir vertical</b>, et <b>rotation</b> par pas de 90°. Utiles pour un logo fourni à l'envers, ou une photo prise dans le mauvais sens. Les deux boutons miroir de la barre d'outils restent enfoncés tant que le réglage est actif. Le miroir s'applique <b>après</b> la rotation : il retourne toujours l'image telle qu'elle est actuellement vue à l'écran, quel que soit l'ordre dans lequel les deux ont été réglés. <b>Le fichier n'est jamais modifié</b> : deux tuiles peuvent afficher la même image choisie dans la bibliothèque, l'une retournée et l'autre non.</p>
          <div class="help-opt"><span class="help-opt-name">Remplir la tuile</span><span class="help-opt-desc">L'image couvre toute la tuile, quitte à en rogner les bords. Pour une illustration de fond.</span></div>
          <div class="help-opt"><span class="help-opt-name">Étirer</span><span class="help-opt-desc">L'image est déformée pour remplir exactement la tuile. Rarement souhaitable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille d'origine</span><span class="help-opt-desc">Aucun redimensionnement.</span></div>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p>Position dans la tuile, marge intérieure, arrondi des coins, opacité, et un lien facultatif ouvert au clic sur l'image. Si le fichier choisi vient à disparaître (supprimé, ou dossier <code>data/</code> restauré sans ses médias), la tuile revient à l'invite de choix plutôt que d'afficher une icône de lien cassé.</p>
<div class="help-opt"><span class="help-opt-name">Fichier image</span><span class="help-opt-desc">En lecture seule ici : ce champ affiche le nom du fichier choisi. Pour choisir ou changer une image, passez en mode édition et utilisez l'appareil photo de la barre d'outils, en bas de la tuile. Sur une tuile vide, un bouton au milieu de la tuile fait la même chose.</span></div>
<div class="help-opt"><span class="help-opt-name">Cadrage</span><span class="help-opt-desc">Pour un logo, gardez « Image entière » : c'est le seul cadrage qui ne le rogne ni ne le déforme jamais. « Recadrer » remplit au contraire la tuile en coupant ce qui dépasse. Le zoom et les deux positions ci-dessous fonctionnent avec tous les cadrages. Choix : Image entière (peut laisser des marges), Recadrer (zoomer et déplacer), Remplir la tuile (peut rogner), Étirer (déforme), Taille d'origine. Par défaut : Image entière (peut laisser des marges).</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom (%)</span><span class="help-opt-desc">100 % laisse l'image à la taille que lui donne le cadrage ci-dessus. Au-delà, elle est agrandie et ses bords sortent de la tuile ; en deçà, elle rétrécit dans la tuile. Fonctionne avec tous les cadrages. De 20 à 500, par défaut 100.</span></div>
<div class="help-opt"><span class="help-opt-name">Position horizontale du recadrage (%)</span><span class="help-opt-desc">0 conserve le bord gauche, 100 le bord droit, 50 le centre. C'est aussi le point d'où part le zoom. Fonctionne avec tous les cadrages. De 0 à 100, par défaut 50.</span></div>
<div class="help-opt"><span class="help-opt-name">Position verticale du recadrage (%)</span><span class="help-opt-desc">0 conserve le haut, 100 le bas, 50 le centre. Utile pour garder un visage ou un logo dans le cadre plutôt que le milieu de l'image. Fonctionne avec tous les cadrages. De 0 à 100, par défaut 50.</span></div>
<div class="help-opt"><span class="help-opt-name">Miroir horizontal</span><span class="help-opt-desc">Retourne l'image gauche-droite, telle qu'elle apparaît actuellement à l'écran. Fonctionne avec tous les cadrages et se combine avec la rotation ci-dessous. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Miroir vertical</span><span class="help-opt-desc">Retourne l'image haut-bas, telle qu'elle apparaît actuellement à l'écran. Fonctionne avec tous les cadrages et se combine avec le miroir horizontal et la rotation. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotation</span><span class="help-opt-desc">Utile pour une photo prise dans le mauvais sens. Appliquée après les réglages de miroir ci-dessus, pour que le miroir corresponde toujours à ce que vous voyez actuellement à l'écran. Choix : Aucune, 90° à droite, 180°, 90° à gauche. Par défaut : Aucune.</span></div>
<div class="help-opt"><span class="help-opt-name">Position horizontale</span><span class="help-opt-desc">Choix : Gauche, Centrée, Droite. Par défaut : Centrée.</span></div>
<div class="help-opt"><span class="help-opt-name">Position verticale</span><span class="help-opt-desc">Choix : Haut, Milieu, Bas. Par défaut : Milieu.</span></div>
<div class="help-opt"><span class="help-opt-name">Marge intérieure (px)</span><span class="help-opt-desc">De 0 à 80, par défaut 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Arrondi des coins (px)</span><span class="help-opt-desc">De 0 à 50, par défaut 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Opacité (%)</span><span class="help-opt-desc">De 10 à 100, par défaut 100.</span></div>
<div class="help-opt"><span class="help-opt-name">Lien ouvert au clic</span><span class="help-opt-desc">Facultatif. Une adresse complète (https://…). Laissé vide, l'image n'est pas cliquable.</span></div>
`,
        en: `
<p>A <b>style</b> tile, like the Text tile: a logo in a screen corner, a banner, a background illustration. Combined with the <b>transparent background</b>, the image appears with no frame.</p>

<h4>Goal</h4>
<p>Show a logo, photo or illustration on the board, stored on the PiBoard machine itself.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Uploaded image</b> from the settings, or picked from the shared <b>library</b> (bundled backgrounds, logos, your images); kept in <code>data/</code>, it survives updates.</li>
  <li><b>Five framings</b>: whole image, crop, fill the tile, stretch or original size, with <b>zoom</b> and <b>direct cropping</b> on the image by finger or mouse.</li>
  <li>Horizontal or vertical <b>mirror</b> and quarter-turn <b>rotation</b>.</li>
  <li><b>Position</b>, inner margin, corner <b>rounding</b> and <b>opacity</b>.</li>
  <li>Optional <b>link</b> opened with a touch on the image.</li>
  <li>No external address: nothing is fetched from the Internet.</li>
</ul>

<h4>Local storage, deliberately</h4>
          <p>The image is <b>uploaded to the PiBoard machine</b> and served by it. No external address to type: nothing breaks the day a remote site disappears, nothing leaves for the Internet from a wall board, and the image stays displayed even with no connection.</p>
          <p>Files are stored in the <code>data/</code> folder, the one <b>never touched by updates</b> and included in backups. The mechanism is the one already used by the Slideshow, which makes this tile inherit its controls: allowed extensions, maximum size, sanitised file names.</p>
          <p>Each tile has its own folder: two Logo tiles do not share an image library. As long as the tile is empty, the <b>"Choose an image"</b> button is shown <b>inside the tile itself</b>: it opens the manager, where images are uploaded, picked or deleted. Once an image is set, that button gives way to the image; to change it, switch to <b>edit mode</b> and use the <b>camera</b> in the toolbar at the bottom of the tile. The settings window itself does not let you pick a file: it only shows its name.</p>

<h4>Resetting</h4>
          <p>The <b>"Reset settings"</b> button, at the bottom of any tile's settings window, puts it back to its original settings — handy after getting lost in a crop. <b>The uploaded image is kept</b>: it is a file, not a setting, and losing it would mean hunting for it again. A confirmation is asked, since nothing brings wiped settings back.</p>

<h4>Framing</h4>
          <div class="help-opt"><span class="help-opt-name">Whole image</span><span class="help-opt-desc">The default, and the only choice that never crops nor distorts. For a logo, keep this one: margins beat a truncated logo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Crop</span><span class="help-opt-desc">The image covers the tile and you choose the visible part: <b>zoom</b> enlarges or shrinks it (100% leaves it at the size the framing gives it; beyond that the edges leave the frame and are cut off, below it shrinks within the tile) and the two <b>crop positions</b> decide what stays in view. <b>Zoom and both positions work with every framing</b>, not just "Crop" — useful to keep a face or a logo in frame rather than the middle of the picture. The <b>file is not modified</b>: you can go back at any time, and two tiles may crop the same image differently.</span></div>
          <p><b>The easiest way is to crop directly on the image.</b> As soon as you enter <b>edit mode</b>, four corner handles and a small toolbar appear on the tile, whatever the chosen framing.</p>

<h4>What each gesture does, and under what condition</h4>
          <div class="help-opt"><span class="help-opt-name">Pulling a corner handle</span><span class="help-opt-desc">Zooms. Outwards to enlarge, inwards to shrink. <b>Always works</b>, whatever the framing and whatever the starting zoom.</span></div>
          <div class="help-opt"><span class="help-opt-name">Dragging on the image</span><span class="help-opt-desc">Moves the image within its frame. <b>Only has an effect above 100% zoom</b> — and that is normal: below that, the image fits entirely inside the tile, nothing sits outside the frame, so there is nothing to bring in. The cursor shows a possible move as soon as you hover, but at 100% or less nothing will budge. Zoom first, then move.</span></div>
          <div class="help-opt"><span class="help-opt-name">The − and + buttons</span><span class="help-opt-desc">Zoom in 10% steps. The percentage shown between them is the current zoom.</span></div>
          <div class="help-opt"><span class="help-opt-name">The reset button</span><span class="help-opt-desc">Brings the zoom back to 100% and the crop back to centre. Touches neither the framing nor the image.</span></div>
          <div class="help-opt"><span class="help-opt-name">The camera</span><span class="help-opt-desc">Opens the image manager to upload, pick or delete a file.</span></div>
          <p>The result appears <b>while</b> you drag; saving only happens on release. The numeric fields in the settings remain useful to set an exact value or to reproduce another tile's crop identically.</p>

<h4>Mirror and rotation</h4>
          <p>Three settings, in the configuration window and also as direct shortcuts in the crop toolbar (↔, ↕, ⟳): <b>flip horizontally</b>, <b>flip vertically</b>, and <b>rotate</b> in 90° steps. Useful for a logo supplied the wrong way round, or a photo taken in the wrong orientation. The toolbar's two mirror buttons stay pressed while their setting is active. The mirror is applied <b>after</b> rotation: it always flips the image as currently seen on screen, whatever order the two were set in. <b>The file is never modified</b>: two tiles can show the same image picked from the library, one flipped and the other not.</p>
          <div class="help-opt"><span class="help-opt-name">Fill the tile</span><span class="help-opt-desc">The image covers the whole tile, cropping its edges if need be. For a background illustration.</span></div>
          <div class="help-opt"><span class="help-opt-name">Stretch</span><span class="help-opt-desc">The image is distorted to fill the tile exactly. Rarely desirable.</span></div>
          <div class="help-opt"><span class="help-opt-name">Original size</span><span class="help-opt-desc">No resizing at all.</span></div>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p>Position within the tile, inner margin, corner rounding, opacity, and an optional link opened when the image is clicked. If the chosen file goes missing (deleted, or a <code>data/</code> folder restored without its media), the tile returns to the choice prompt rather than showing a broken-link icon.</p>
<div class="help-opt"><span class="help-opt-name">Image file</span><span class="help-opt-desc">Read-only here: it shows the chosen file's name. To pick or change an image, switch to edit mode and use the camera in the toolbar at the bottom of the tile. On an empty tile, a button in the middle of the tile does the same.</span></div>
<div class="help-opt"><span class="help-opt-name">Framing</span><span class="help-opt-desc">For a logo, keep the whole image: it is the only framing that never crops nor distorts it. Cropping fills the tile instead, cutting off whatever sticks out. The zoom and the two positions below work with every framing. Choices: Whole image (may leave margins), Crop (zoom and move), Fill the tile (may crop), Stretch (distorts), Original size. Default: Whole image (may leave margins).</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom (%)</span><span class="help-opt-desc">100% leaves the image at the size the framing above gives it. Above, it is enlarged and its edges leave the tile; below, it shrinks within the tile. Works with every framing. From 20 to 500, default 100.</span></div>
<div class="help-opt"><span class="help-opt-name">Horizontal position of the crop (%)</span><span class="help-opt-desc">0 keeps the left edge, 100 the right edge, 50 the centre. Also the point the zoom starts from. Works with every framing. From 0 to 100, default 50.</span></div>
<div class="help-opt"><span class="help-opt-name">Vertical position of the crop (%)</span><span class="help-opt-desc">0 keeps the top edge, 100 the bottom edge, 50 the centre. Useful to keep a face or a logo in frame rather than the middle of the picture. Works with every framing. From 0 to 100, default 50.</span></div>
<div class="help-opt"><span class="help-opt-name">Flip horizontally (mirror)</span><span class="help-opt-desc">Mirrors the image left-right, as currently shown on screen. Works with every framing and combines with rotation below. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Flip vertically (mirror)</span><span class="help-opt-desc">Mirrors the image top-bottom, as currently shown on screen. Works with every framing and combines with the horizontal mirror and rotation. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotation</span><span class="help-opt-desc">Useful for a photo taken in the wrong orientation. Applied after the mirror settings above, so the mirror always matches what you currently see on screen. Choices: None, 90° clockwise, 180°, 90° counter-clockwise. Default: None.</span></div>
<div class="help-opt"><span class="help-opt-name">Horizontal position</span><span class="help-opt-desc">Choices: Left, Centered, Right. Default: Centered.</span></div>
<div class="help-opt"><span class="help-opt-name">Vertical position</span><span class="help-opt-desc">Choices: Top, Middle, Bottom. Default: Middle.</span></div>
<div class="help-opt"><span class="help-opt-name">Inner margin (px)</span><span class="help-opt-desc">From 0 to 80, default 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Corner rounding (px)</span><span class="help-opt-desc">From 0 to 50, default 0.</span></div>
<div class="help-opt"><span class="help-opt-name">Opacity (%)</span><span class="help-opt-desc">From 10 to 100, default 100.</span></div>
<div class="help-opt"><span class="help-opt-name">Link opened on click</span><span class="help-opt-desc">Optional. A full address (https://…). Left empty, the image is not clickable.</span></div>
`
      }
    },
    {
      id: "quote",
      group: "tiles",
      title: { fr: "Citation du jour", en: "Quote of the day" },
      sub: {
        fr: "Citations, pensées et proverbes, pensées de Jean-Claude Van Damme et blagues hommage à Chuck Norris — collection embarquée, hors-ligne.",
        en: "Quotes, thoughts and proverbs, Jean-Claude Van Damme's musings and Chuck Norris tribute jokes — bundled offline collection."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×1 par défaut, de 1×1 à 12×16</span>

<h4>Objectif</h4>
<p>Une touche inspirante ou amusante sur le tableau, sans dépendre d'un service en ligne.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Plus de 400 citations</b>, pensées et proverbes, par <b>thèmes</b> à cocher (sagesse, vie et amour, travail, sciences, art, nature, humour).</li>
  <li><b>Sources amusantes</b> en option : pensées de Jean-Claude Van Damme et blagues hommage à Chuck Norris, avec leur fréquence.</li>
  <li><b>Vos propres citations</b> ajoutées à la collection.</li>
  <li><b>Favoris</b> : appui long pour garder une citation, et affichage des seuls favoris si vous le souhaitez.</li>
  <li><b>Rotation</b> automatique à l'intervalle choisi, ou suivante d'un toucher ; signature et pictogramme de la source en option.</li>
  <li>Collection embarquée : fonctionne hors ligne.</li>
</ul>

<h4>Possibilités</h4>
          <p>Plus de 400 citations, pensées et proverbes du monde entier, en français et en anglais, rangés par thèmes. Leurs attributions ont été vérifiées : les fausses citations célèbres qui circulent partout ont été écartées, et une citation dont l'auteur est incertain est signée « attribué à ».</p>
          <p>Deux sources humoristiques s'y ajoutent à volonté. <b>Les pensées de Jean-Claude Van Damme</b> : seules quelques-unes sont sourcées (interviews et émissions datées) et signées de son nom ; les autres, célèbres mais sans source, sont signées « attribué à Jean-Claude Van Damme ». En anglais, elles sont traduites. <b>Les blagues hommage à Chuck Norris</b>, disparu le 19 mars 2026 : les « Chuck Norris Facts », ce folklore d'Internet qu'il accueillait avec bonne humeur, signés « Chuck Norris Fact ». Par respect, aucune ne tourne autour de la mort.</p>
          <p>Si la collection ne peut pas être chargée (fichier manquant après une mise à jour incomplète, par exemple), la tuile l'indique avec la cause exacte, et un toucher réessaye.</p>
          <p><b>Jamais deux fois le même texte</b> tant que toute la sélection n'a pas défilé ; ce suivi est mémorisé par l'écran et survit aux redémarrages. <b>Toucher la tuile</b> passe au texte suivant. Un <b>appui long</b> (ou la touche F) ajoute le texte affiché aux favoris, ou l'en retire : une étoile le signale. Le texte et la signature s'ajustent automatiquement à la taille de la tuile. En mode édition, toucher la tuile ne change rien.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Contenu</p>
<div class="help-opt"><span class="help-opt-name">Citations et pensées</span><span class="help-opt-desc">Sagesse et proverbes, Vie et amour, Travail et volonté, Sciences, Art et création, Nature, Humour : décochez ceux que vous ne voulez pas voir.</span></div>
<div class="help-opt"><span class="help-opt-name">Pensées de Jean-Claude Van Damme</span><span class="help-opt-desc">Seules quelques-unes sont sourcées ; les autres, qui circulent sous son nom, sont signées « attribué à ». Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Blagues hommage à Chuck Norris</span><span class="help-opt-desc">Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Fréquence des blagues et pensées</span><span class="help-opt-desc">Quand les citations sont aussi cochées, part laissée à JCVD et Chuck Norris : de temps en temps (1 sur 10), régulièrement (1 sur 4), souvent (1 sur 2), ou autant que les citations. Sans ce dosage, 400 citations noieraient les perles.</span></div>
<div class="help-opt"><span class="help-opt-name">Mes citations</span><span class="help-opt-desc">Une par ligne, auteur facultatif après un tiret long : « Texte — Auteur ». Elles se mêlent au reste et s'affichent toujours, même si la source Citations ou un thème est décoché.</span></div>
<div class="help-opt"><span class="help-opt-name">Favoris seulement</span><span class="help-opt-desc">N'affiche que les textes gardés par un appui long, quelle que soit leur source.</span></div>
<p class="help-opt-group">Thèmes des citations</p>
<div class="help-opt"><span class="help-opt-name">Sagesse et proverbes</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Vie et amour</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Travail et volonté</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Sciences</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Art et création</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Nature</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Humour</span><span class="help-opt-desc">Activé par défaut.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Rotation</span><span class="help-opt-desc">Une nouvelle chaque jour (la même toute la journée), ou rotation minutée avec son intervalle.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotation toutes les (minutes)</span><span class="help-opt-desc">De 1 à 720, par défaut 30.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la signature</span><span class="help-opt-desc">Affichent ou masquent l'auteur et le petit pictogramme de la source (guillemets, étoile de JCVD, poing de Chuck Norris, crayon pour vos citations).</span></div>
<div class="help-opt"><span class="help-opt-name">Pictogramme de la source</span><span class="help-opt-desc">Trois cases combinables : Citations et pensées, Pensées de Jean-Claude Van Damme, Blagues hommage à Chuck Norris. Activé par défaut.</span></div>
<p class="help-opt-group">Autres possibilités</p>
<div class="help-opt"><span class="help-opt-name">Taille du texte</span><span class="help-opt-desc">De 50 % à 200 % : un multiplicateur appliqué par-dessus la taille calculée automatiquement.</span></div>
`,
        en: `
<span class="help-size">Size: 3×1 by default, from 1×1 to 12×16</span>

<h4>Goal</h4>
<p>An inspiring or amusing touch on the board, independent of any online service.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Over 400 quotes</b>, thoughts and proverbs, by <b>themes</b> to tick (wisdom, life and love, work, science, art, nature, humour).</li>
  <li>Optional <b>fun sources</b>: Jean-Claude Van Damme's musings and Chuck Norris tribute jokes, with their frequency.</li>
  <li><b>Your own quotes</b> added to the collection.</li>
  <li><b>Favourites</b>: long-press to keep a quote, and show favourites only if you wish.</li>
  <li>Automatic <b>rotation</b> at the chosen interval, or next with a touch; signature and source icon optional.</li>
  <li>Built-in collection: works offline.</li>
</ul>

<h4>Possibilities</h4>
          <p>Over 400 quotes, thoughts and proverbs from around the world, in French and English, sorted by theme. Their attributions were checked: the famous fake quotes that circulate everywhere were left out, and a quote whose author is uncertain is signed "attributed to".</p>
          <p>Two humorous sources can be added at will. <b>Jean-Claude Van Damme's musings</b>: only a few are sourced (dated interviews and shows) and signed with his name; the others, famous but unsourced, are signed "attributed to Jean-Claude Van Damme". In English they are translated. <b>Chuck Norris tribute jokes</b>, as he passed away on 19 March 2026: the "Chuck Norris Facts", the Internet folklore he always took with good humour, signed "Chuck Norris Fact". Out of respect, none of them revolves around death.</p>
          <p>If the collection cannot be loaded (a file missing after an incomplete update, for instance), the tile says so with the exact cause, and a tap retries.</p>
          <p><b>Never the same text twice</b> until the whole selection has been shown; this is remembered by the screen and survives restarts. <b>Tapping the tile</b> moves to the next text. A <b>long press</b> (or the F key) adds the displayed text to favourites, or removes it: a star marks it. Text and signature adjust automatically to the tile's size. In edit mode, tapping the tile does nothing.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Content</p>
<div class="help-opt"><span class="help-opt-name">Quotes and thoughts</span><span class="help-opt-desc">Wisdom and proverbs, Life and love, Work and willpower, Science, Art and creation, Nature, Humour: untick those you don't want to see. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Jean-Claude Van Damme's musings</span><span class="help-opt-desc">Only a few are sourced; the others, which circulate under his name, are signed "attributed to". Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Chuck Norris tribute jokes</span><span class="help-opt-desc">Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">How often jokes and musings appear</span><span class="help-opt-desc">When quotes are ticked too, the share given to JCVD and Chuck Norris: now and then (1 in 10), regularly (1 in 4), often (1 in 2), or as much as the quotes. Without this, 400 quotes would drown the gems.</span></div>
<div class="help-opt"><span class="help-opt-name">My quotes</span><span class="help-opt-desc">One per line, optional author after a dash: "Text — Author". They mix with the rest and always show, even if the Quotes source or a theme is unticked.</span></div>
<div class="help-opt"><span class="help-opt-name">Favourites only</span><span class="help-opt-desc">Only shows the texts kept with a long press, whatever their source.</span></div>
<p class="help-opt-group">Quote themes</p>
<div class="help-opt"><span class="help-opt-name">Wisdom and proverbs</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Life and love</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Work and willpower</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Science</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Art and creation</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Nature</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Humour</span><span class="help-opt-desc">On by default.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Rotation</span><span class="help-opt-desc">A new one every day (the same all day long), or timed rotation with its interval.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotate every (minutes)</span><span class="help-opt-desc">From 1 to 720, default 30.</span></div>
<div class="help-opt"><span class="help-opt-name">Show signature</span><span class="help-opt-desc">Show or hide the author and the small source icon (quotation marks, JCVD's star, Chuck Norris's fist, a pencil for your own quotes).</span></div>
<div class="help-opt"><span class="help-opt-name">Source icon</span><span class="help-opt-desc">Three combinable boxes: Quotes and thoughts, Jean-Claude Van Damme's musings, Chuck Norris tribute jokes. On by default.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Text size</span><span class="help-opt-desc">50% to 200%: a multiplier applied on top of the automatically computed size.</span></div>
`
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
<p>Suivre l'actualité d'un site (presse, blog, journal local…) directement sur le tableau.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Jusqu'à 3 flux</b> RSS ou Atom réunis, chacun avec une étiquette courte.</li>
  <li><b>Liste</b> des derniers titres ou <b>défilement</b> d'un titre à la fois, source affichée en option.</li>
  <li><b>Lecture de l'article complet</b> d'un toucher, en mode lecture (sans publicités ni menus), avec l'illustration du flux ; repli sur le résumé si l'extraction échoue.</li>
  <li><b>Articles réservés aux abonnés</b> lus en entier quand vous êtes abonné et connecté dans Réglages → Abonnements presse ; ✓ et 🔒 signalent ce qui est lisible.</li>
</ul>

<h4>Possibilités</h4>
          <p><b>Jusqu'à 3 flux peuvent être combinés dans la même tuile</b>, fusionnés en une seule liste triée par ordre chronologique — le plus récent en premier, quel que soit le flux d'origine. Un flux en panne n'empêche pas les autres de s'afficher. Avec un seul flux configuré, la tuile affiche son nom en en-tête, comme avant. Dès qu'un 2e flux est ajouté, chaque article porte à la place une petite étiquette indiquant sa source — le libellé court renseigné dans les réglages s'il y en a un (recommandé : le titre d'un flux est souvent bien trop long pour tenir sur une étiquette), sinon le titre du flux lui-même.</p>
          <p>Fonctionne avec n'importe quel flux RSS ou Atom classique — la plupart des sites d'actualité en proposent un, parfois affiché comme un lien orange discret en bas de page. Si le nombre d'articles configuré dépasse la place disponible sur la tuile, la liste devient défilante (au doigt ou à la souris) plutôt que de couper les derniers titres. Le mode rotation affiche un article à la fois en plein cadre, en alternance automatique — plus lisible de loin pour un flux qu'on veut simplement voir défiler passivement. Un article pourvu d'un lien dans le flux (repéré automatiquement) est cliquable : le toucher ouvre une popup — redimensionnable à la souris si besoin de plus de largeur — qui tente de récupérer le texte complet de l'article directement depuis la page liée — un « mode lecture », comme celui d'un navigateur, qui isole le texte de l'article et écarte publicités, menus et colonnes latérales. La plupart des flux ne fournissent en effet qu'un court résumé, pas l'article entier. Une deuxième tentative avec un identifiant de navigateur standard est faite automatiquement si la première (honnête, identifiée comme PiBoard) est bloquée — de nombreux sites bloquent purement et simplement tout ce qui ne ressemble pas à un navigateur, y compris des lecteurs RSS parfaitement légitimes. Face à un accès refusé (paywall d'abonnement OU protection anti-robot — les deux se confondent en pratique : certains sites, dont Le Monde, renvoient littéralement « Votre trafic a été identifié comme automatisé » avec un code de statut de paywall), le contenu réellement reçu est affiché tel quel — souvent un aperçu partiel (les premiers paragraphes) — avec une bannière qui le précise, pour ne pas laisser croire au texte intégral. Si rien d'exploitable n'est reçu, un message honnête l'indique, sans affirmer une cause précise puisqu'elle n'est pas toujours connue avec certitude. PiBoard ne tente jamais de contourner ni un paywall ni une protection anti-robot — ni connexion, ni cache alternatif, ni défaite du JavaScript ou de la vérification qui bloque l'accès. Sans indication précise du site, une mention plus générale s'affiche si le résumé du flux est lui-même très pauvre en texte (souvent une simple image), pour ne pas laisser croire à une fonctionnalité cassée. La photo éventuellement associée à l'article dans le flux (légende et crédit photo inclus, quand fournis) est affichée en tête de la popup, quelle que soit la source du texte. Les articles sans lien restent de simples lignes de texte.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Flux</p>
<div class="help-opt"><span class="help-opt-name">Flux 1 : adresse (.xml)</span><span class="help-opt-desc">Facultatifs. Laisser l'adresse vide pour ne pas utiliser un emplacement.</span></div>
<div class="help-opt"><span class="help-opt-name">Flux 1–3 : étiquette courte (facultatif)</span><span class="help-opt-desc">Facultatif, utilisé seulement dès qu'un 2e flux est ajouté.</span></div>
<div class="help-opt"><span class="help-opt-name">Nombre d'articles</span><span class="help-opt-desc">Combien de titres afficher au maximum.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la source</span><span class="help-opt-desc">Avec un seul flux : son nom en en-tête. Avec plusieurs flux combinés : une étiquette à côté de chaque article à la place.</span></div>
<div class="help-opt"><span class="help-opt-name">Faire défiler un titre à la fois</span><span class="help-opt-desc">Alterne un article à la fois plutôt que d'afficher toute la liste. Désactivé par défaut.</span></div>
<p class="help-opt-group">Flux supplémentaires</p>
<div class="help-opt"><span class="help-opt-name">Flux 2–3 : adresse (.xml, facultatif)</span><span class="help-opt-desc">Laissez vide pour ne pas utiliser cet emplacement.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux relectures du flux.</span></div>

<h4>Articles réservés aux abonnés</h4>
          <p>Sans abonnement, PiBoard affiche ce que le site laisse voir à tout le monde : souvent un <b>aperçu</b>, signalé comme tel. Un article déclaré payant par son éditeur et ouvert sans accès complet est ensuite marqué d'un <b>🔒</b> dans la liste.</p>
          <p><b>Si vous êtes abonné</b> (application de bureau Mac, Windows ou Linux uniquement) : Réglages → <b>Abonnements presse</b>, choisissez le journal (Le Monde, Le Figaro, Libération, Mediapart, La Dépêche, L'Équipe, ou « Autre site… »), puis <b>Se connecter</b>. Une fenêtre s'ouvre sur le site : connectez-vous normalement, captcha et double authentification compris, puis fermez-la. <b>PiBoard ne voit jamais votre mot de passe</b> : il garde seulement la session, comme un navigateur, dans un profil à part.</p>
          <p>Ensuite, les articles de ce site sont lus par ce même navigateur intégré, de façon invisible, et passent par le mode lecture habituel : <b>texte complet</b>, avec la mention « Article abonné, lu avec votre abonnement ». Les articles de ce site portent un <b>✓</b> dans la liste.</p>
          <p><b>Un réglage par site, pas par flux</b> : une connexion au Monde vaut pour tous ses flux (Une, International, Économie…) et toutes vos tuiles Flux RSS.</p>
          <p>Les sessions expirent au bout de quelques semaines ou mois. Si un article payant ne donne plus que l'aperçu, la popup le dit et les réglages affichent « session sans doute expirée » : cliquez sur <b>Se reconnecter</b>. <b>Se déconnecter</b> efface la session de ce site, et seulement de lui ; <b>Retirer</b> efface le site et sa session.</p>
          <p>Sur le Raspberry Pi en kiosque et dans un navigateur distant, il n'y a pas de navigateur intégré : la section n'apparaît pas et les articles restent en aperçu.</p>
`,
        en: `
<span class="help-size">Size: 4×3 by default, from 2×2 to 12×8</span>

<h4>Goal</h4>
<p>Follow a site's news (press, blog, local paper…) right on the board.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Up to 3 feeds</b>, RSS or Atom, combined, each with a short label.</li>
  <li><b>List</b> of the latest headlines or <b>one headline at a time</b>, source shown optionally.</li>
  <li><b>Full article</b> with a touch, in reading mode (no ads or menus), with the feed's illustration; falls back to the summary if extraction fails.</li>
  <li><b>Subscriber-only articles</b> read in full when you are subscribed and signed in under Settings → Press subscriptions; ✓ and 🔒 show what can be read.</li>
</ul>

<h4>Possibilities</h4>
          <p><b>Up to 3 feeds can be combined in the same tile</b>, merged into a single list sorted in chronological order — most recent first, whichever feed it came from. A feed that's down doesn't prevent the others from showing. With a single feed configured, the tile shows its name as a header, as before. As soon as a 2nd feed is added, each article carries a small tag stating its source instead — the short label set in the settings if there is one (recommended: a feed's own title is often far too long to fit on a tag), otherwise the feed's title itself.</p>
          <p>Works with any standard RSS or Atom feed — most news sites offer one, sometimes shown as a discreet orange link at the bottom of the page. If the configured number of articles exceeds the tile's available space, the list becomes scrollable (finger or mouse) instead of cutting off the latest headlines. Rotation mode shows one article at a time full-frame, alternating automatically — more readable from a distance for a feed you just want to watch passively scroll by. An article with a link in the feed (detected automatically) is clickable: tapping it opens a popup — resizable with the mouse if it needs more width — that attempts to fetch the article's full text directly from the linked page — a "reader mode", like a browser's, which isolates the article text and discards ads, menus and sidebars. Most feeds only provide a short summary, not the full article. A second attempt with a standard browser identifier is made automatically if the first one (honest, identified as PiBoard) gets blocked — many sites simply block anything that doesn't look like a browser, including perfectly legitimate RSS readers. Facing denied access (a subscription paywall OR anti-bot protection — the two blur together in practice: some sites, including Le Monde, literally return "Your traffic has been identified as automated" with a paywall-style status code), whatever content is actually received gets shown as-is — often a partial preview (the first paragraphs) — with a banner stating so, so it doesn't look like the full text. If nothing usable comes back at all, an honest message says so, without asserting a specific cause since it isn't always known for certain. PiBoard never attempts to bypass either a paywall or anti-bot protection — no login, no alternate cache, no defeating the JavaScript or check that blocks access. Without a specific signal from the site, a more general note shows up if the feed's own summary is itself very thin on text (often just an image), so it doesn't look like a broken feature. The photo the feed may associate with the article (caption and photo credit included, when provided) is shown at the top of the popup, whichever text source is used. Articles without a link stay plain text lines.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Feed</p>
<div class="help-opt"><span class="help-opt-name">Feed 1: address (.xml)</span><span class="help-opt-desc">Optional. Leave the address empty to not use a slot.</span></div>
<div class="help-opt"><span class="help-opt-name">Feed 1–3: short tag (optional)</span><span class="help-opt-desc">Optional, only used once a 2nd feed is added.</span></div>
<div class="help-opt"><span class="help-opt-name">Items shown</span><span class="help-opt-desc">How many headlines to show at most.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the source</span><span class="help-opt-desc">With a single feed: its name as a header. With several feeds combined: a tag next to each article instead.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotate one headline at a time</span><span class="help-opt-desc">Alternates one article at a time rather than showing the whole list. Off by default.</span></div>
<p class="help-opt-group">Additional feeds</p>
<div class="help-opt"><span class="help-opt-name">Feed 2–3: address (.xml, optional)</span><span class="help-opt-desc">Leave empty to not use this slot.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two feed reads.</span></div>

<h4>Subscriber-only articles</h4>
          <p>Without a subscription, PiBoard shows what the site lets everyone see: often a <b>preview</b>, flagged as such. An article its publisher declares as paid and opened without full access is then marked with a <b>🔒</b> in the list.</p>
          <p><b>If you subscribe</b> (Mac, Windows or Linux desktop application only): Settings → <b>Press subscriptions</b>, pick the newspaper (Le Monde, Le Figaro, Libération, Mediapart, La Dépêche, L'Équipe, or “Other site…”), then <b>Log in</b>. A window opens on the site: log in as usual, captcha and two-factor included, then close it. <b>PiBoard never sees your password</b>: it only keeps the session, like a browser, in a separate profile.</p>
          <p>From then on, that site's articles are read by the same built-in browser, invisibly, and go through the usual reader mode: <b>full text</b>, with the note “Subscriber article, read with your subscription”. That site's articles carry a <b>✓</b> in the list.</p>
          <p><b>One setting per site, not per feed</b>: logging in to Le Monde covers all its feeds (front page, international, economy…) and all your RSS tiles.</p>
          <p>Sessions expire after a few weeks or months. When a paid article only gives the preview again, the popup says so and the settings show “session has probably expired”: click <b>Log in again</b>. <b>Log out</b> clears that site's session, and only that one; <b>Remove</b> clears the site and its session.</p>
          <p>On the Raspberry Pi in kiosk mode and in a remote browser there is no built-in browser: the section does not appear and articles stay as previews.</p>
`
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
<p>Voir ce qui est arrivé dans une boîte aux lettres, sans sortir son téléphone, et lire un message sur le tableau.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Derniers messages</b> (objet, expéditeur, date), en nombre réglable, ou seulement les non lus.</li>
  <li><b>Lecture</b> d'un message d'un toucher, avec images et liens autorisés ou non.</li>
  <li><b>Lecture seule stricte</b> : consulter un message ici ne le marque jamais comme lu ailleurs, et rien n'est stocké sur le PiBoard.</li>
  <li>Compatible free.fr, Orange, OVH, Yahoo, iCloud, Gmail (mot de passe d'application) et tout serveur IMAP standard.</li>
</ul>

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
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Connexion</p>
<div class="help-opt"><span class="help-opt-name">Fournisseur</span><span class="help-opt-desc">Un raccourci qui remplit l'adresse du serveur. Laissez vide et saisissez l'adresse pour tout autre fournisseur.</span></div>
<div class="help-opt"><span class="help-opt-name">Serveur IMAP</span><span class="help-opt-desc">Le serveur de courrier <i>entrant</i> (pas le SMTP, qui ne sert qu'à envoyer). Port 993 pour une connexion chiffrée, le cas normal.</span></div>
<div class="help-opt"><span class="help-opt-name">Port</span><span class="help-opt-desc">993 pour une connexion chiffrée TLS (le cas normal). 143 uniquement si votre fournisseur l'exige. De 1 à 65535, par défaut 993.</span></div>
<div class="help-opt"><span class="help-opt-name">Identifiant</span><span class="help-opt-desc">Généralement votre adresse électronique complète.</span></div>
<div class="help-opt"><span class="help-opt-name">Mot de passe</span><span class="help-opt-desc">Généralement l'adresse électronique complète, et le mot de passe (ou mot de passe d'application) associé.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Dossier</span><span class="help-opt-desc">INBOX pour la boîte de réception, ou tout autre nom de dossier.</span></div>
<div class="help-opt"><span class="help-opt-name">Nombre de messages affichés</span><span class="help-opt-desc">De 1 à 25, par défaut 8.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher l'expéditeur</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Messages non lus uniquement</span><span class="help-opt-desc">La densité d'affichage de la liste.</span></div>
<p class="help-opt-group">Lecture des messages</p>
<div class="help-opt"><span class="help-opt-name">Liens cliquables</span><span class="help-opt-desc">Voir plus haut. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les images distantes</span><span class="help-opt-desc">Voir plus haut. Désactivé par défaut.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle entre deux relevés. Chacun ouvre une brève connexion au serveur.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 8×10</span>

<h4>Goal</h4>
<p>See what has arrived in a mailbox without reaching for your phone, and read a message on the board.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Latest messages</b> (subject, sender, date), in an adjustable number, or unread only.</li>
  <li><b>Read</b> a message with a touch, with images and links allowed or not.</li>
  <li><b>Strictly read-only</b>: reading a message here never marks it read elsewhere, and nothing is stored on the PiBoard.</li>
  <li>Works with free.fr, Orange, OVH, Yahoo, iCloud, Gmail (app password) and any standard IMAP server.</li>
</ul>

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
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Connection</p>
<div class="help-opt"><span class="help-opt-name">Provider</span><span class="help-opt-desc">A shortcut that fills in the server address. Leave empty and type the address for any other provider.</span></div>
<div class="help-opt"><span class="help-opt-name">IMAP server</span><span class="help-opt-desc">The <i>incoming</i> mail server (not the SMTP one, which only sends). Port 993 for an encrypted connection, the normal case.</span></div>
<div class="help-opt"><span class="help-opt-name">Port</span><span class="help-opt-desc">993 for a TLS-encrypted connection (the normal case). 143 only if your provider requires it. From 1 to 65535, default 993.</span></div>
<div class="help-opt"><span class="help-opt-name">Username</span><span class="help-opt-desc">Usually the full email address, and the matching password (or app password).</span></div>
<div class="help-opt"><span class="help-opt-name">Password</span><span class="help-opt-desc">Stored encrypted on the PiBoard, in a file separate from the tile settings — it therefore never ends up in a layout backup or a shared configuration. Prefer an app password when your provider offers one (Gmail, Yahoo, iCloud): it can be revoked on its own, without changing your main account password. Nature: &lt;b&gt;personal credential&lt;/b&gt; — it is yours. A clone only carries it if you explicitly tick that family.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Folder</span><span class="help-opt-desc">INBOX for the inbox, or any other folder name.</span></div>
<div class="help-opt"><span class="help-opt-name">Messages shown</span><span class="help-opt-desc">From 1 to 25, default 8.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the sender</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Unread messages only</span><span class="help-opt-desc">The list's display density.</span></div>
<p class="help-opt-group">Message reading</p>
<div class="help-opt"><span class="help-opt-name">Clickable links</span><span class="help-opt-desc">See above. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show remote images</span><span class="help-opt-desc">See above. Off by default.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval between two checks. Each opens a brief connection to the server.</span></div>
`
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
<p>Faire défiler des photos de famille ou de vacances, façon cadre photo numérique.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Sources</b> : photos téléversées, dossier local ou NAS, partage WebDAV (Nextcloud, Synology…), clé USB, ou liste d'adresses d'images ; nouvelles photos reprises automatiquement.</li>
  <li><b>Changement</b> à l'intervalle choisi, en ordre ou <b>aléatoire</b>, avec un lent effet de zoom.</li>
  <li><b>Photos portrait</b> : cadrées au mieux, ou présentées <b>deux par deux côte à côte</b> ; couleur de fond des marges au choix.</li>
  <li><b>Miroir</b> horizontal ou vertical et <b>rotation</b> de toutes les photos.</li>
</ul>

<h4>Possibilités</h4>
          <p>Cinq sources possibles : des photos téléversées directement, un dossier local sur le Raspberry Pi ou un NAS, une clé USB branchée sur le Pi (rien à configurer, les photos qu'elle contient s'affichent automatiquement), un partage WebDAV (Nextcloud, Synology…), ou une simple liste d'URLs d'images. Le format de chaque photo est détecté automatiquement (paysage ou portrait) et traité séparément : par défaut, une photo paysage remplit la tuile (recadrée), tandis qu'une photo portrait s'affiche en entier pour ne jamais rogner un visage — chaque comportement reste réglable indépendamment. Quand une photo est affichée en entier, l'espace vide autour peut être comblé par une couleur unie ou par la photo elle-même, agrandie et floutée en fond, pour un rendu plus habillé. Un zoom très léger anime les photos affichées en entier (sans jamais déborder du cadre), et un zoom plus marqué anime celles qui remplissent la tuile.</p>

<h4>Deux photos portrait côte à côte</h4>
          <p>Sur une tuile <b>plus large que haute</b>, une photo portrait affichée en entier laisse forcément une large bande vide de chaque côté. Quand deux photos portrait se suivent, PiBoard les affiche alors <b>côte à côte</b>, séparées par un fin espace : la tuile est bien mieux remplie et deux souvenirs sont visibles à la fois.</p>
          <p>Trois conditions doivent être réunies : la tuile est plus large que haute, les deux photos sont en portrait, et leurs dimensions sont déjà connues (une photo pas encore chargée n'est jamais accolée). Seules deux photos <b>consécutives</b> sont concernées, afin que l'ordre d'affichage — chronologique ou aléatoire — ne soit jamais modifié : deux portraits séparés par une photo paysage ne sont donc pas rapprochés. Si votre collection alterne souvent portrait et paysage, l'effet se déclenchera rarement, ce qui est normal.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Source</p>
<div class="help-opt"><span class="help-opt-name">Source des photos</span><span class="help-opt-desc">Photos téléversées, dossier local, WebDAV, ou liste d'URLs.</span></div>
<div class="help-opt"><span class="help-opt-name">Chemin du dossier local (utilisé seulement par « Dossier local »)</span><span class="help-opt-desc">Chemin d'un dossier sur la machine qui fait tourner PiBoard : disque, clé USB ou partage réseau monté.</span></div>
<div class="help-opt"><span class="help-opt-name">URL du dossier WebDAV (utilisé seulement par « Partage WebDAV »)</span><span class="help-opt-desc">Adresse du dossier partagé contenant les photos (Nextcloud, NAS Synology…).</span></div>
<div class="help-opt"><span class="help-opt-name">Identifiant WebDAV</span><span class="help-opt-desc">Identifiant du partage WebDAV ; le mot de passe se saisit dans le champ suivant.</span></div>
<div class="help-opt"><span class="help-opt-name">Mot de passe WebDAV</span><span class="help-opt-desc">Stocké et affiché en clair dans les paramètres de cette tuile, comme le reste de PiBoard (pas d'authentification, réseau local de confiance uniquement). Voir le README pour le détail et pour rclone comme alternative sans identifiants. Nature : &lt;b&gt;identifiant personnel&lt;/b&gt; — il vaut pour vous. Un clone ne l'emporte que si vous cochez explicitement cette famille.</span></div>
<div class="help-opt"><span class="help-opt-name">URLs des images, une par ligne (utilisé seulement par « URLs d'images »)</span><span class="help-opt-desc">Une adresse d'image par ligne, affichées dans cet ordre (ou mélangées si l'ordre aléatoire est coché).</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Revérifier le dossier/WebDAV/clé USB toutes les (minutes)</span><span class="help-opt-desc">De 2 à 180, par défaut 15.</span></div>
<div class="help-opt"><span class="help-opt-name">Changer toutes les (secondes)</span><span class="help-opt-desc">Durée d'affichage de chaque photo, en secondes. De 3 à 600, par défaut 12.</span></div>
<p class="help-opt-group">Cadrage</p>
<div class="help-opt"><span class="help-opt-name">Photos au format paysage</span><span class="help-opt-desc">Remplir la tuile (recadré) ou afficher la photo entière, réglable séparément pour chaque orientation.</span></div>
<div class="help-opt"><span class="help-opt-name">Photos au format portrait</span><span class="help-opt-desc">C'est le réglage qui compte le plus pour éviter des photos portrait mal recadrées : « Photo entière visible » garantit qu'aucune photo n'est jamais coupée. Choix : Remplir la tuile (recadré), Photo entière visible. Par défaut : Photo entière visible.</span></div>
<div class="help-opt"><span class="help-opt-name">Accoler deux photos portrait côte à côte</span><span class="help-opt-desc">Activé par défaut. Décochez pour revenir à une seule photo à la fois, quelle que soit son orientation.</span></div>
<div class="help-opt"><span class="help-opt-name">Style de bordure (quand une photo est affichée en entier)</span><span class="help-opt-desc">Couleur unie ou photo floutée automatique, pour l'espace vide autour d'une photo affichée en entier.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur de la bordure (utilisée seulement par « Couleur unie »)</span><span class="help-opt-desc">Utilisée seulement si le style de bordure est « Couleur unie ».</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Ordre aléatoire</span><span class="help-opt-desc">Mélange l'ordre des photos plutôt que de suivre l'ordre de la source.</span></div>
<div class="help-opt"><span class="help-opt-name">Effet de zoom lent</span><span class="help-opt-desc">Anime doucement chaque photo pendant son affichage.</span></div>
<div class="help-opt"><span class="help-opt-name">Retourner toutes les photos en miroir horizontal</span><span class="help-opt-desc">S'applique à toutes les photos de ce diaporama, telles qu'elles apparaissent actuellement à l'écran. Utile pour un appareil qui enregistre déjà ses photos en miroir. Les fichiers eux-mêmes ne sont jamais modifiés. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Retourner toutes les photos en miroir vertical</span><span class="help-opt-desc">S'applique à toutes les photos de ce diaporama, telles qu'elles apparaissent actuellement à l'écran. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Pivoter toutes les photos</span><span class="help-opt-desc">S'applique à toutes les photos de ce diaporama. Utile si toute une collection (par exemple issue d'une caméra montée) est arrivée dans le mauvais sens. Appliquée après les réglages de miroir ci-dessus, pour qu'ils correspondent toujours à ce qui est actuellement affiché à l'écran. Choix : Aucune, 90° à droite, 180°, 90° à gauche. Par défaut : Aucune.</span></div>
`,
        en: `
<span class="help-size">Size: 4×3 by default, from 2×2 to 12×12</span>

<h4>Goal</h4>
<p>Cycle through family or holiday photos, digital-photo-frame style.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Sources</b>: uploaded photos, local folder or NAS, WebDAV share (Nextcloud, Synology…), USB key, or a list of image addresses; new photos picked up automatically.</li>
  <li><b>Changes</b> at the chosen interval, in order or <b>shuffled</b>, with a slow zoom effect.</li>
  <li><b>Portrait photos</b>: framed as well as possible, or shown <b>two side by side</b>; background colour of the margins of your choice.</li>
  <li>Horizontal or vertical <b>mirror</b> and <b>rotation</b> of all photos.</li>
</ul>

<h4>Possibilities</h4>
          <p>Five possible sources: photos uploaded directly, a local folder on the Raspberry Pi or a NAS, a USB key plugged into the Pi (nothing to configure, the photos on it show automatically), a WebDAV share (Nextcloud, Synology…), or a plain list of image URLs. Each photo's orientation is detected automatically (landscape or portrait) and handled separately: by default, a landscape photo fills the tile (cropped), while a portrait photo shows in full so a face is never cut off — each behavior stays adjustable independently. When a photo shows in full, the empty space around it can be filled with a solid color or with the photo itself, enlarged and blurred as a background, for a more polished look. A very light zoom animates fully-shown photos (never spilling past the frame), and a stronger zoom animates ones that fill the tile.</p>

<h4>Two portrait photos side by side</h4>
          <p>On a tile that is <b>wider than tall</b>, a portrait photo shown in full inevitably leaves a wide empty band on each side. When two portrait photos follow each other, PiBoard then shows them <b>side by side</b>, separated by a thin gap: the tile is far better filled and two memories are visible at once.</p>
          <p>Three conditions must be met: the tile is wider than tall, both photos are portrait, and their dimensions are already known (a photo that hasn't loaded yet is never paired). Only two <b>consecutive</b> photos are eligible, so that the display order — chronological or random — is never altered: two portraits separated by a landscape photo are therefore not brought together. If your collection often alternates portrait and landscape, the effect will trigger rarely, which is expected.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Source</p>
<div class="help-opt"><span class="help-opt-name">Photo source</span><span class="help-opt-desc">Uploaded photos, local folder, WebDAV, or URL list.</span></div>
<div class="help-opt"><span class="help-opt-name">Local folder path (only used by "Local folder")</span><span class="help-opt-desc">Path to a folder on the machine running PiBoard: disk, USB key or mounted network share.</span></div>
<div class="help-opt"><span class="help-opt-name">WebDAV folder URL (only used by "WebDAV share")</span><span class="help-opt-desc">Address of the shared folder holding the photos (Nextcloud, Synology NAS…).</span></div>
<div class="help-opt"><span class="help-opt-name">WebDAV username</span><span class="help-opt-desc">WebDAV share username; the password goes in the next field.</span></div>
<div class="help-opt"><span class="help-opt-name">WebDAV password</span><span class="help-opt-desc">Stored and shown in plain text in this tile's settings, like the rest of PiBoard (no login, trusted LAN only). See the README for details and for rclone as a keyless alternative. Nature: &lt;b&gt;personal credential&lt;/b&gt; — it is yours. A clone only carries it if you explicitly tick that family.</span></div>
<div class="help-opt"><span class="help-opt-name">Image URLs, one per line (only used by "Image URLs")</span><span class="help-opt-desc">One image address per line, shown in this order (or shuffled if random order is ticked).</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Re-check the folder/WebDAV/USB key every (minutes)</span><span class="help-opt-desc">From 2 to 180, default 15.</span></div>
<div class="help-opt"><span class="help-opt-name">Change every (seconds)</span><span class="help-opt-desc">How long each photo is shown, in seconds. From 3 to 600, default 12.</span></div>
<p class="help-opt-group">Framing</p>
<div class="help-opt"><span class="help-opt-name">Landscape photos</span><span class="help-opt-desc">Fill the tile (cropped) or show the entire photo, adjustable separately for each orientation.</span></div>
<div class="help-opt"><span class="help-opt-name">Portrait photos</span><span class="help-opt-desc">This is the setting that matters most for portrait photos coming out badly cropped: 'Show entire photo' guarantees nothing is ever cut off. Choices: Fill tile (cropped), Show entire photo. Default: Show entire photo.</span></div>
<div class="help-opt"><span class="help-opt-name">Pair two portrait photos side by side</span><span class="help-opt-desc">On by default. Uncheck to go back to a single photo at a time, whatever its orientation.</span></div>
<div class="help-opt"><span class="help-opt-name">Border style (when a photo is shown in full)</span><span class="help-opt-desc">Solid color or automatic blurred photo, for the empty space around a fully-shown photo.</span></div>
<div class="help-opt"><span class="help-opt-name">Border color (only used by "Solid color")</span><span class="help-opt-desc">Used only if the border style is "Solid color".</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Shuffle order</span><span class="help-opt-desc">Randomizes photo order rather than following the source's order.</span></div>
<div class="help-opt"><span class="help-opt-name">Slow zoom effect</span><span class="help-opt-desc">Gently animates each photo while it's shown.</span></div>
<div class="help-opt"><span class="help-opt-name">Flip every photo horizontally (mirror)</span><span class="help-opt-desc">Applies to every photo in this slideshow, as currently shown on screen. Useful for a camera that saves its shots already mirrored. The files themselves are never changed. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Flip every photo vertically (mirror)</span><span class="help-opt-desc">Applies to every photo in this slideshow, as currently shown on screen. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Rotate every photo</span><span class="help-opt-desc">Applies to every photo in this slideshow. Useful if a whole collection (e.g. from a mounted camera) came in with the wrong orientation. Applied after the mirror settings above, so they always match what is currently shown on screen. Choices: None, 90° clockwise, 180°, 90° counter-clockwise. Default: None.</span></div>
`
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
<p>Suivre les scores d'une compétition sans allumer la télévision.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Matchs en direct, terminés et à venir</b> : football, rugby (TOP 14 et PRO D2, données LNR) ou toute compétition ESPN via son code.</li>
  <li>Équipe qui reçoit en haut, celle qui se déplace en bas ; les matchs qui viennent de finir passent devant les suivants, avec leur score.</li>
  <li><b>Filtre sur votre équipe</b> et nombre de matchs affichés réglable.</li>
</ul>

<h4>Possibilités</h4>
          <p><b>Deux sources selon la compétition.</b> Le rugby français (TOP 14 et PRO D2) est lu directement chez la <b>Ligue Nationale de Rugby</b>, source officielle : ESPN ne publie plus ces championnats correctement — son tableau ignore la date demandée et sa liste de clubs a une saison de retard (le RC Vannes n'y figure pas). Le reste (football, championnats américains, etc.) vient d'ESPN. Une tuile déjà configurée sur le Top 14 bascule toute seule sur la LNR, sans rien à régler.</p>
          <p>Une sélection de compétitions courantes (Coupe du monde, Ligue des champions, principaux championnats de football européens, TOP 14, PRO D2) est proposée directement dans la liste. Pour toute autre compétition suivie par ESPN — un championnat américain par exemple — un code personnalisé permet de cibler n'importe quelle ligue (voir la méthode de recherche du code dans les options du widget Classement, identique ici). Le filtre par équipe permet de ne garder que les matchs d'un club précis, pratique pour une tuile compacte dédiée à votre équipe favorite plutôt qu'à toute la compétition. Pour un match à venir programmé un autre jour, l'heure et la date (jj/mm) alternent automatiquement toutes les quelques secondes — pour un match du jour même, seule l'heure est affichée, la date étant déjà évidente.</p>
          <p>Dans chaque rencontre, le club qui <b>reçoit</b> est affiché en haut et celui qui se <b>déplace</b> en bas ; le vainqueur d'un match terminé est mis en évidence. La tuile affiche les rencontres des deux jours écoulés et de la semaine à venir, classées ainsi : les matchs en direct d'abord, puis ceux qui viennent de se terminer (le score d'un match joué la veille au soir reste donc visible), puis les prochains. Chaque rafraîchissement va réellement rechercher les données à la source, sans jamais réutiliser une réponse mise en cache.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Compétition</span><span class="help-opt-desc">Liste des compétitions courantes préconfigurées : football, TOP 14 et PRO D2 (lus chez la LNR), ainsi que les championnats F1 et MotoGP (pilotes et équipes).</span></div>
<div class="help-opt"><span class="help-opt-name">Code ESPN personnalisé (sport:ligue) — prend le pas sur la liste ci-dessus</span><span class="help-opt-desc">Prend le pas sur la liste ci-dessus pour cibler n'importe quelle compétition couverte par ESPN (format <code>sport:ligue</code>, ex. <code>football:nfl</code>).</span></div>
<div class="help-opt"><span class="help-opt-name">Filtrer par équipe (optionnel, ex. « Toulouse »)</span><span class="help-opt-desc">N'affiche que les matchs impliquant le nom saisi (ex. « Toulouse »).</span></div>
<div class="help-opt"><span class="help-opt-name">Nombre de matchs affichés</span><span class="help-opt-desc">Combien de rencontres afficher au maximum.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour des scores.</span></div>
`,
        en: `
<span class="help-size">Size: 4×3 by default, from 2×1 to 8×8</span>

<h4>Goal</h4>
<p>Follow a competition's scores without turning on the TV.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Live, finished and upcoming matches</b>: football, rugby (TOP 14 and PRO D2, LNR data) or any ESPN competition via its code.</li>
  <li>Home team on top, away team below; matches that just ended come before the next ones, with their score.</li>
  <li><b>Filter on your team</b> and adjustable number of matches shown.</li>
</ul>

<h4>Possibilities</h4>
          <p><b>Two sources, depending on the competition.</b> French rugby (TOP 14 and PRO D2) is read straight from the <b>Ligue Nationale de Rugby</b>, the official source: ESPN no longer publishes these leagues properly — its scoreboard ignores the requested date and its club list is a season behind (RC Vannes is missing from it). Everything else (football, American leagues, etc.) comes from ESPN. A tile already set to the Top 14 switches to the LNR on its own, with nothing to reconfigure.</p>
          <p>A selection of common competitions (World Cup, Champions League, major European football leagues, TOP 14, PRO D2) is offered directly in the list. For any other ESPN-covered competition — an American league for instance — a custom code lets you target any league (see the code lookup method in the League standings widget's options, identical here). The team filter lets you keep only a specific club's matches, handy for a compact tile dedicated to your favorite team rather than the whole competition. For an upcoming match scheduled on another day, the time and date (DD/MM) alternate automatically every few seconds — for a match happening today, only the time is shown, since the date is already obvious.</p>
          <p>In every fixture the <b>host</b> club is shown on top and the <b>visiting</b> one below; the winner of a finished match is highlighted. The tile covers the past two days and the coming week, ordered as follows: live matches first, then those that have just finished (so the score of a match played the previous evening stays visible), then upcoming ones. Every refresh really goes back to the source, never reusing a cached answer.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Competition</span><span class="help-opt-desc">List of preconfigured common competitions: football, TOP 14 and PRO D2 (read from the LNR), plus the F1 and MotoGP championships (drivers and teams).</span></div>
<div class="help-opt"><span class="help-opt-name">Custom ESPN code (sport:league) — overrides the list above</span><span class="help-opt-desc">Takes precedence over the list above to target any ESPN-covered competition (format <code>sport:league</code>, e.g. <code>football:nfl</code>).</span></div>
<div class="help-opt"><span class="help-opt-name">Filter by team (optional, e.g. "Toulouse")</span><span class="help-opt-desc">Only shows matches involving the entered name (e.g. "Toulouse").</span></div>
<div class="help-opt"><span class="help-opt-name">Matches shown</span><span class="help-opt-desc">How many matches to show at most.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two score updates.</span></div>
`
      }
    },

    /* ================= FORMULE 1 ================= */
    {
      id: "circuit",
      group: "tiles",
      title: { fr: "Plan du circuit", en: "Circuit map" },
      sub: {
        fr: "Le tracé d'un circuit, dessiné en vectoriel, avec sa fiche technique et la météo des séances.",
        en: "A circuit's outline, drawn in vector form, with its spec sheet and the sessions' weather."
      },
      html: {
        fr: `
<span class="help-size">Taille : 4×4 par défaut, de 2×2 à 12×16</span>

<h4>Objectif</h4>
<p>Afficher le tracé d'un circuit de Formule 1 ou de MotoGP : celui du Grand Prix du week-end dans le calendrier que vous suivez, ou celui que vous choisissez.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Tracé vectoriel</b> net à toute taille, dessiné à partir d'OpenStreetMap en <b>ruban d'asphalte</b> (bitume sombre, vibreurs rouge et blanc, filet central à la couleur d'accent du thème) : lisible sur fond clair comme sombre. Les numéros de virages sont des pastilles posées à côté de la piste.</li>
  <li><b>Sens de la course</b>, <b>voie des stands</b> en pointillés, et <b>noms et numéros des virages</b> quand ils sont connus.</li>
  <li><b>Circuit du week-end</b> automatiquement, au choix selon le <b>calendrier de Formule 1</b> ou celui du <b>MotoGP</b>, ou n'importe quel circuit épinglé depuis la base.</li>
  <li><b>Fiche technique</b> (en MotoGP : virages à gauche et à droite, plus longue ligne droite) et <b>météo de la prochaine séance</b>, séances MotoGP comprises.</li>
</ul>

<h4>Pourquoi une base de circuits, et pas une carte chargée à la demande</h4>
          <p>La première version interrogeait <b>Overpass</b> — le service public qui donne accès aux données d'OpenStreetMap — au moment de l'affichage. Mesuré sur trois appels consécutifs pour le même circuit : <b>886 ms, puis 17,4 s, puis une erreur de quota</b>. Le relais de PiBoard abandonne à 15 s : <b>deux affichages sur trois échouaient</b>, et la tuile annonçait « aucun tracé dans OpenStreetMap ». C'était faux : le tracé existait, c'est le service qui n'avait pas répondu. Confondre une panne d'accès avec une absence de donnée est exactement ce que PiBoard s'interdit.</p>
          <p>Un tracé de circuit ne change pas. Il est donc <b>relevé une fois</b> et publié dans une base, que la tuile lit. Résultat : l'affichage est <b>immédiat</b>, il fonctionne <b>hors connexion</b>, et il ne sollicite plus un service gratuit partagé par tous. La base est hébergée sur le dépôt et rafraîchie toutes les douze heures : un circuit <b>complété ou corrigé arrive sans nouvelle version de PiBoard</b>.</p>

<h4>Ce que la base contient, et ce qu'elle ne contient pas</h4>
          <p><b>47 circuits</b> : ceux de la Formule 1, du MotoGP et des grandes épreuves d'endurance. <b>36 ont un tracé dessiné</b> ; les autres entrent dans la base avec leur fiche technique et se déclarent <b>incomplets</b>, pour que la tuile explique au lieu de se taire.</p>
          <p><b>Un tracé n'est publié que s'il a été mesuré.</b> Sa longueur dessinée est confrontée à la longueur réelle du tour ; s'il s'en écarte, il n'est pas publié. Ce contrôle a rattrapé une erreur : j'avais compté les tronçons renvoyés par OpenStreetMap pour déclarer un circuit couvert — Monaco en avait onze, donc Monaco était bon. Faux : ces onze tronçons totalisent <b>cinquante mètres</b> sur un tour de 3 337. Le reste emprunte des rues ouvertes à la circulation, qu'OpenStreetMap ne distingue pas de la voirie ordinaire.</p>
          <p>C'est le cas de <b>Monaco, Bakou, Singapour, Las Vegas, Melbourne et Madrid</b> : des circuits urbains sans tracé exploitable. Daytona, Sebring, la Nordschleife et Le Mans n'ont pas passé le contrôle de longueur non plus. La tuile le dit en toutes lettres, affiche quand même leur fiche technique, et indique <b>ce qui peut y remédier</b> — un tracé relevé à la main et ajouté à la base, signalé sur le dépôt. Inutile en revanche de les cartographier dans OpenStreetMap : les rues y sont déjà, et la convention n'y veut pas qu'une voie publique soit étiquetée comme piste de course.</p>
          <p><b>Le MotoGP est couvert en entier</b> : les 22 circuits du calendrier 2026 sont dans la base, chacun avec les chiffres officiels du flux motogp.com (longueur du tracé MotoGP, virages à gauche et à droite, plus longue ligne droite), et <b>21 ont un tracé dessiné</b>. Le dernier, <b>Le Mans-Bugatti</b>, garde sa fiche mais pas son dessin : dans OpenStreetMap, son tracé est enchevêtré avec celui du circuit des 24 Heures, et en isoler le bon sans relevé à la main reviendrait à dessiner un circuit qui n'existe pas. Ces chiffres MotoGP sont rangés à part de ceux de la Formule 1, parce qu'un même circuit n'a pas toujours le même tracé dans les deux disciplines.</p>
          <p>Enfin, les <b>trois secteurs</b> n'existent nulle part en données ouvertes : les points de chronométrage S1/S2/S3 ne sont publiés par personne. Colorer trois tiers de tour égaux serait facile et serait <b>faux</b>.</p>

<h4>Choisir le circuit</h4>
          <div class="help-opt"><span class="help-opt-name">Circuit</span><span class="help-opt-desc">« Suivre le calendrier de Formule 1 » (par défaut) ou « Suivre le calendrier de MotoGP » : la tuile affiche <b>le circuit du week-end</b> et change seule de Grand Prix. Le calendrier MotoGP et les horaires des séances viennent de motogp.com, le flux de la tuile Sports mécaniques. Ou <b>un circuit épinglé</b>, choisi dans la liste : elle est remplie depuis la base, donc un circuit ajouté apparaît sans mise à jour de l'application. Un circuit épinglé n'interroge aucun calendrier.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fiche technique</span><span class="help-opt-desc">Longueur, lieu, année d'ouverture, championnats ; en MotoGP, aussi le nombre de virages à gauche et à droite et la plus longue ligne droite. La fiche n'affiche <b>que ce que la base porte</b> : un circuit sans longueur connue ne montre pas une ligne de tirets.</span></div>
          <div class="help-opt"><span class="help-opt-name">Noms des virages</span><span class="help-opt-desc">Très inégal d'un circuit à l'autre. À Austin, vingt et un virages sont nommés ou numérotés ; à Sepang on trouve « Genting Curve » à côté des virages 3, 10, 12, 13 et 15 ; ailleurs il n'y a rien. Rien n'est inventé. Sur une tuile étroite, les étiquettes disparaissent avant de devenir illisibles.</span></div>
          <div class="help-opt"><span class="help-opt-name">Sens de la course</span><span class="help-opt-desc">Une flèche posée sur le plus long tronçon à sens unique, là où le trait est le plus droit. La voie des stands ne donne jamais le sens : elle est à sens unique elle aussi, et indiquerait l'entrée des stands.</span></div>
          <div class="help-opt"><span class="help-opt-name">Météo des séances</span><span class="help-opt-desc">La prévision à l'heure de la prochaine séance du week-end — en Formule 1 comme en MotoGP —, comme dans les tuiles Formule 1 et Sports mécaniques. Source Open-Meteo, gratuite et sans clé.</span></div>

<h4>Pas de plan officiel, et c'est voulu</h4>
          <p>Les plans de circuits publiés par la Formule 1 sont des <b>visuels sous droits</b>. PiBoard est publié sous licence libre sur un dépôt public : il ne les embarque pas. Le tracé est <b>dessiné</b> à partir d'OpenStreetMap, dont la licence ODbL exige que la source soit citée — elle l'est dans la tuile, à toutes les largeurs.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Circuit</span><span class="help-opt-desc">Laissé sur « Suivre le calendrier de Formule 1 », la tuile affiche le circuit du Grand Prix en cours et change d'elle-même d'un week-end à l'autre. « Suivre le calendrier de MotoGP » fait de même avec la saison MotoGP (calendrier et horaires des séances venant de motogp.com, le flux de la tuile Motorsport). Choisissez un circuit pour l'épingler — utile hors saison, ou pour garder un favori toute l'année sur le tableau. Un circuit épinglé ne coûte aucun appel à une API de courses. La liste vient de la base des circuits : un circuit ajouté là-bas apparaît ici sans mettre PiBoard à jour.</span></div>
<div class="help-opt"><span class="help-opt-name">Fiche technique</span><span class="help-opt-desc">Longueur, nombre de virages, nombre de tours, distance de course et record du tour. Ce sont des faits qu'OpenStreetMap ne porte pas : ils viennent de la base des circuits. Un circuit dont le tracé est connu mais dont la fiche n'a pas été saisie n'affiche rien ici, plutôt qu'une rangée de tirets — une ligne vide fait croire à une donnée perdue, alors qu'elle n'a simplement jamais été renseignée. En suivant le MotoGP (ou sur un circuit qui n'accueille pas la Formule 1), la fiche reprend les chiffres officiels du MotoGP : longueur du tracé MotoGP, virages à gauche et à droite, plus longue ligne droite. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Noms et numéros de virages</span><span class="help-opt-desc">Affichés là où OpenStreetMap les connaît, ce qui varie énormément : Austin a 21 virages numérotés, Silverstone quatre nommés, et dix-sept circuits de la saison n'en ont aucun. Rien n'est inventé là où la donnée se tait. Les étiquettes disparaissent sur une tuile étroite, où elles se chevaucheraient et rendraient le tracé illisible. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Sens de la course</span><span class="help-opt-desc">Une flèche sur la plus longue ligne droite à sens unique, là où le trait est le plus droit et où une flèche se lit. Elle suit l'étiquette \`oneway\` d'OpenStreetMap et indique donc le sens réel ; la voie des stands n'est jamais utilisée pour la déterminer, ce qui indiquerait le sens d'entrée aux stands et non celui du tour. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Météo de la prochaine séance</span><span class="help-opt-desc">Une ligne compacte sous le tracé : la prochaine séance, son heure dans votre fuseau, et la prévision à cette heure-là — temps, température et probabilité de pluie. Une seule ligne, délibérément : les tuiles Formule 1 et Motorsport portent le tableau complet séance par séance, et le répéter ici mangerait la place du tracé. Affichée seulement quand la tuile suit le calendrier, un circuit épinglé n'ayant aucune séance à prévoir. Source : Open-Meteo, gratuit et sans clé. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchir (minutes)</span><span class="help-opt-desc">Six heures par défaut, et c'est voulu : un tracé ne change jamais. Ce qui bouge, c'est le circuit du week-end — une fois par semaine — et la météo, lentement. Relever toutes les demi-heures ne ferait que du bruit chez trois services gratuits, et le tracé vient d'une base, non du réseau. De 30 à 1440, par défaut 360.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 12×16</span>

<h4>Purpose</h4>
<p>Show a Formula 1 or MotoGP circuit layout: this weekend's Grand Prix in the calendar you follow, or the one you choose.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Vector layout</b>, sharp at any size, drawn from OpenStreetMap as an <b>asphalt ribbon</b> (dark tarmac, red and white kerbs, a centre line in the theme's accent colour): readable on light and dark backgrounds. Corner numbers are badges set beside the track.</li>
  <li><b>Race direction</b>, dotted <b>pit lane</b>, and <b>corner names and numbers</b> where known.</li>
  <li><b>This weekend's circuit</b> automatically, following either the <b>Formula 1</b> or the <b>MotoGP</b> calendar, or any circuit pinned from the database.</li>
  <li><b>Technical sheet</b> (for MotoGP: left and right corners, longest straight) and <b>weather for the next session</b>, MotoGP sessions included.</li>
</ul>

<h4>Why a circuit base rather than a map fetched on demand</h4>
          <p>The first version queried <b>Overpass</b> — the public service that serves OpenStreetMap data — at display time. Measured over three consecutive calls for the same circuit: <b>886 ms, then 17.4 s, then a quota error</b>. PiBoard's relay gives up at 15 s, so <b>two displays out of three failed</b>, and the tile announced "no outline in OpenStreetMap". That was false: the outline existed, the service had not answered. Mistaking an access failure for missing data is precisely what PiBoard refuses to do.</p>
          <p>A circuit outline does not change. It is therefore <b>surveyed once</b> and published in a base that the tile reads. The display is <b>instant</b>, works <b>offline</b>, and no longer leans on a free shared service. The base is hosted on the repository and refreshed every twelve hours: a <b>completed or corrected circuit arrives without a new PiBoard release</b>.</p>

<h4>What the base holds, and what it does not</h4>
          <p><b>47 circuits</b>: Formula 1, MotoGP and the major endurance events. <b>36 have a drawn outline</b>; the others enter the base with their spec sheet and declare themselves <b>incomplete</b>, so the tile explains instead of staying silent.</p>
          <p><b>An outline is published only if it has been measured.</b> Its drawn length is checked against the real lap length; if it differs, it is not published. That check caught a mistake: I had counted the ways OpenStreetMap returned to declare a circuit covered — Monaco had eleven, so Monaco was fine. Wrong: those eleven total <b>fifty metres</b> of a 3,337-metre lap. The rest runs on public roads, which OpenStreetMap does not tell apart from ordinary streets.</p>
          <p>That is the case for <b>Monaco, Baku, Singapore, Las Vegas, Melbourne and Madrid</b>: street circuits with no usable outline. Daytona, Sebring, the Nordschleife and Le Mans did not pass the length check either. The tile says so plainly, still shows their spec sheet, and states <b>what would fix it</b> — a hand-surveyed outline added to the base, reported on the repository. Mapping them in OpenStreetMap would not help: the streets are already there, and the convention does not tag a public road as a racing track.</p>
          <p><b>MotoGP is fully covered</b>: all 22 circuits of the 2026 calendar are in the base, each with the official figures from the motogp.com feed (MotoGP layout length, left and right corners, longest straight), and <b>21 have a drawn outline</b>. The last one, <b>Le Mans-Bugatti</b>, keeps its spec sheet but not its drawing: in OpenStreetMap its outline is tangled with the 24 Hours circuit's, and isolating the right one without a hand survey would amount to drawing a circuit that does not exist. These MotoGP figures are kept apart from Formula 1's, because the same circuit does not always have the same layout in both series.</p>
          <p>Finally, the <b>three sectors</b> exist nowhere in open data: the S1/S2/S3 timing points are published by nobody. Colouring three equal thirds of a lap would be easy and would be <b>wrong</b>.</p>

<h4>Choosing the circuit</h4>
          <div class="help-opt"><span class="help-opt-name">Circuit</span><span class="help-opt-desc">"Follow the Formula 1 calendar" (default) or "Follow the MotoGP calendar": the tile shows <b>the weekend's circuit</b> and switches Grand Prix by itself. The MotoGP calendar and session times come from motogp.com, the Motorsport tile's feed. Or <b>a pinned circuit</b> from the list, which is filled from the base, so a newly added circuit appears without updating the application. A pinned circuit queries no calendar.</span></div>
          <div class="help-opt"><span class="help-opt-name">Spec sheet</span><span class="help-opt-desc">Length, location, year opened, championships; for MotoGP, also the number of left and right corners and the longest straight. It shows <b>only what the base carries</b>: a circuit with no known length shows no row of dashes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Corner names</span><span class="help-opt-desc">Wildly uneven between circuits. Austin has twenty-one named or numbered corners; Sepang has "Genting Curve" alongside corners 3, 10, 12, 13 and 15; elsewhere there is nothing. Nothing is invented. On a narrow tile the labels go before they turn into mush.</span></div>
          <div class="help-opt"><span class="help-opt-name">Racing direction</span><span class="help-opt-desc">An arrow on the longest one-way segment, where the line is straightest. The pit lane never gives the direction: it is one-way too, and would point at the pit entry.</span></div>
          <div class="help-opt"><span class="help-opt-name">Session weather</span><span class="help-opt-desc">The forecast for the next session's hour — in Formula 1 as in MotoGP — as in the Formula 1 and Motorsport tiles. Source: Open-Meteo, free and keyless.</span></div>

<h4>No official map, deliberately</h4>
          <p>Formula 1's published circuit maps are <b>copyrighted visuals</b>. PiBoard is published under a free licence on a public repository and does not embed them. The outline is <b>drawn</b> from OpenStreetMap, whose ODbL licence requires the source to be credited — and it is, at every width.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Circuit</span><span class="help-opt-desc">Left on "Follow the Formula 1 calendar", the tile shows the circuit of the Grand Prix under way, and switches by itself from one weekend to the next. "Follow the MotoGP calendar" does the same with the MotoGP season (calendar and session times from motogp.com, the same feed as the Motorsport tile). Pick a circuit to pin it instead -- useful out of season, or to keep a favourite on the board all year. A pinned circuit costs no call to a racing API at all. The list is loaded from the circuit base, so a circuit added there appears here without updating PiBoard.</span></div>
<div class="help-opt"><span class="help-opt-name">Spec sheet</span><span class="help-opt-desc">Length, number of corners, race laps, race distance and lap record. These are facts OpenStreetMap does not carry: they come from the circuit base. A circuit whose outline is known but whose specs have not been entered shows nothing here rather than a row of dashes -- an empty row suggests lost data, when it was simply never filled in. Following MotoGP (or on a circuit that hosts no Formula 1), the sheet uses the official MotoGP figures: length of the MotoGP layout, left and right corners, longest straight. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Corner names and numbers</span><span class="help-opt-desc">Shown where OpenStreetMap has them, which varies enormously: Austin has 21 numbered corners, Silverstone four named ones, and seventeen circuits of the season have none at all. Nothing is invented where the data is silent. The labels disappear on a narrow tile, where they would overlap and make the outline unreadable. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Racing direction</span><span class="help-opt-desc">An arrow on the longest one-way straight, where the line is straightest and an arrow reads best. It follows OpenStreetMap's \`oneway\` tag, so it points the way the cars actually go; the pit lane is never used to decide it, since that would show the way into the pits rather than the way round the track. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Next session's weather</span><span class="help-opt-desc">One compact line under the outline: the next session, its time in your own zone, and the forecast for that hour -- condition, temperature and chance of rain. One line only, deliberately: the Formula 1 and Motorsport tiles carry the full session-by-session table, and repeating it here would eat the room the outline needs. Only shown when the tile follows the calendar, since a pinned circuit has no session to forecast. Source: Open-Meteo, free and keyless. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Six hours by default, and that is deliberate: an outline never changes. What moves is the weekend's circuit -- once a week -- and the weather, slowly. Reading every half hour would only make noise at three free services, and the outline itself comes from a base rather than from the network. From 30 to 1440, default 360.</span></div>
`
      }
    },

    {
      id: "f1",
      group: "tiles",
      title: { fr: "Formule 1", en: "Formula 1" },
      sub: {
        fr: "Le week-end de F1, carte par carte.",
        en: "The F1 weekend, card by card."
      },
      html: {
        fr: `
<span class="help-size">Taille : 4×4 par défaut, de 2×2 à 12×16</span>

<h4>Objectif</h4>
<p>Réunir sur une tuile ce qu'un amateur de Formule 1 regarde pendant un week-end de Grand Prix.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Six cartes</b> à afficher ou masquer une à une : prochaine course avec compte à rebours, programme du week-end dans votre fuseau, classement pilotes, classement constructeurs, résultats de la dernière course, météo du circuit.</li>
  <li><b>Nombre de lignes</b> réglable pour les classements et les résultats.</li>
  <li><b>Couleurs d'écurie</b> et couleur des cartes au choix ; cartes disposées comme vous voulez.</li>
  <li>Un abandon est signalé comme tel, pas comme une vingtième place ; la météo est celle de l'heure de la course.</li>
  <li>Données gratuites Jolpica (successeur d'Ergast), sans clé ni compte.</li>
</ul>

<h4>Les six cartes</h4>
          <div class="help-opt"><span class="help-opt-name">Prochaine course</span><span class="help-opt-desc">Le Grand Prix à venir, son circuit, son pays et un <b>compte à rebours à la seconde</b>. Pendant le week-end, il vise la prochaine <b>séance</b> et non la course : le samedi matin, savoir que les qualifications commencent dans vingt minutes vaut mieux qu'un compte à rebours de deux jours.</span></div>
          <div class="help-opt"><span class="help-opt-name">Programme du week-end</span><span class="help-opt-desc">Toutes les séances avec leur jour et leur heure <b>dans votre fuseau</b>. L'API donne l'heure en UTC : un Grand Prix à 7 h UTC se court à 9 h chez vous, et c'est cette heure-là qui vous concerne. La séance en cours est mise en avant, les séances passées estompées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Classement pilotes</span><span class="help-opt-desc">Position, drapeau, code à trois lettres, numéro, points et victoires.</span></div>
          <div class="help-opt"><span class="help-opt-name">Classement constructeurs</span><span class="help-opt-desc">Le championnat des écuries, dans la même forme.</span></div>
          <div class="help-opt"><span class="help-opt-name">Dernière course</span><span class="help-opt-desc">L'ordre d'arrivée, l'écart au vainqueur, les points, et le meilleur tour marqué d'un chronomètre.</span></div>
          <div class="help-opt"><span class="help-opt-name">Météo du circuit</span><span class="help-opt-desc">La prévision <b>à l'heure de chaque séance</b>, une ligne par séance : le temps, la température et la <b>probabilité de pluie</b>.</span></div>

<h4>Un abandon n'est pas une vingtième place</h4>
          <p>L'API rend bien un classement final pour toutes les voitures, y compris celles parties au mur au deuxième tour. Afficher « 18<sup>e</sup> » pour une voiture qui n'a pas terminé raconte une autre course que celle qui a eu lieu : la tuile affiche donc <b>la cause de l'abandon</b> (Accident, Moteur, Boîte de vitesses…) à la place de la position, et la ligne est estompée.</p>

<h4>La météo d'une course n'est pas la météo d'un lieu</h4>
          <p>« 24 degrés, aver­ses » pour Spa ne dit rien d'utile. Ce qu'on vient chercher, c'est s'il pleuvra <b>pendant les qualifications</b>, qui durent une heure et ont lieu samedi à 16 h. La carte donne donc <b>une ligne par séance</b>, avec la prévision à l'heure de cette séance — et non la météo du moment, qui ne concerne personne un mardi.</p>
          <p>La <b>probabilité de pluie est le seul chiffre mis en couleur</b>, à partir de 30 %. C'est délibéré : en Formule 1, la température décide de la gomme et le vent gêne en courbe rapide, mais c'est la pluie qui rebat les cartes. Tout colorer reviendrait à ne rien mettre en avant.</p>
          <p>La prévision porte à <b>sept jours</b>. Une séance plus lointaine <b>garde sa ligne, avec un tiret</b> : la masquer donnerait un programme amputé où l'on croirait avoir tout vu, alors que le tiret dit « on ne sait pas encore ». Source : <b>Open-Meteo</b>, gratuit et sans clé, le même service que la tuile Météo.</p>

<h4>Le plan du circuit a désormais sa propre tuile</h4>
          <p>Le tracé des circuits n'est plus une carte de cette tuile : c'est une tuile à part entière, <b>Plan du circuit</b>, qui a sa propre fiche d'aide. Elle offre plus de réglages, affiche une fiche technique, et surtout elle lit une <b>base de circuits</b> au lieu d'interroger OpenStreetMap à chaque affichage — ce qui échouait deux fois sur trois.</p>

<h4>Pas de logos, et c'est voulu</h4>
          <p>Les logos d'écuries, les photos de pilotes et les plans de circuits officiels sont des <b>marques déposées et des visuels sous droits</b>. PiBoard est publié sous licence libre sur un dépôt public : il ne les embarque pas. À la place, chaque ligne porte la <b>couleur de l'écurie</b> et le <b>code à trois lettres</b> du pilote (ANT, HAM, VER) — on reconnaît une ligne aussi vite, et sans rien devoir à personne. Le drapeau est un émoji : sur une machine sans police émoji complète, le code reste lisible et l'information n'est pas perdue.</p>

<h4>Disposer les cartes comme vous voulez</h4>
          <p><b>Ne cochez qu'une seule carte, et posez autant de tuiles Formule 1 que de cartes voulues.</b> Une tuile à carte unique n'affiche ni cadre ni titre interne : elle <i>devient</i> cette carte, et se déplace, se redimensionne et se renomme comme n'importe quelle tuile, avec la grille de PiBoard.</p>
          <p>C'est la bonne façon de procéder, parce que les cartes <b>ne sont pas déplaçables à l'intérieur d'une tuile</b> : rebâtir une grille dans la grille n'aurait aucun sens quand PiBoard en a déjà une. Et cela ne coûte rien : le relais partage son cache, donc cinq tuiles n'envoient pas cinq fois les mêmes requêtes.</p>
          <p><b>Quelle taille donner à chaque tuile ?</b> La taille par défaut (4×4) est volontairement modeste : c'est la plus petite qui serve vraiment les cartes courtes, et il vaut mieux agrandir les deux tuiles qui le méritent que réduire les cinq autres. En pratique : <b>Prochaine course</b> 3×3, <b>Programme du week-end</b> 3×4, <b>Classement constructeurs</b> 3×5, <b>Classement pilotes</b> 3×7, <b>Dernière course</b> 4×7. Le réglage universel <b>Taille du texte</b> resserre encore le contenu si vous tenez à une tuile plus petite.</p>
          <p>Le contenu s'adapte à la largeur réelle de la tuile : sur une tuile étroite, le numéro du pilote et la colonne des victoires disparaissent, parce que trois colonnes lisibles valent mieux que cinq tronquées. Et dans le programme, c'est le nom de la séance qui cède la place avant l'heure — l'heure est la seule chose qu'on vient y chercher.</p>
          <p>Si au contraire vous voulez tout au même endroit, cochez plusieurs cartes : elles se rangent alors sur autant de colonnes que la largeur en permet, chacune à la taille de son contenu. Une carte décochée n'est <b>pas demandée du tout</b> à l'API — elle est gratuite et partagée par tous, autant être poli.</p>

<h4>Source</h4>
          <p>L'API <b>Jolpica</b>, successeur communautaire d'Ergast (fermé fin 2024), sans clé ni compte. C'est la même source que les intégrations Formule 1 de Home Assistant, et celle que lit déjà la tuile <i>Sports mécaniques</i>. L'historique couvre le championnat depuis 1950 : le réglage <b>Saison</b> accepte n'importe quelle année.</p>
          <p>Les tracés de circuits viennent d'<b>OpenStreetMap</b>, interrogé par le service public <b>Overpass</b>, sous licence ODbL. Les prévisions viennent d'<b>Open-Meteo</b>, gratuit et sans clé.</p>
          <div class="help-opt"><span class="help-opt-name">Saison</span><span class="help-opt-desc">Vide pour la saison en cours, ou une année.</span></div>
          <div class="help-opt"><span class="help-opt-name">Cartes</span><span class="help-opt-desc">Six cases à cocher, une par carte. Le plan du circuit a sa propre tuile, « Plan du circuit ».</span></div>
          <div class="help-opt"><span class="help-opt-name">Style des cartes</span><span class="help-opt-desc">« Thème de la page » garde les cartes cohérentes avec le reste du tableau, et reste le défaut — une tuile qui jure avec ses voisines est une tuile ratée. « <b>Piste sombre</b> » leur donne le noir profond du paddock et un liseré rouge : un air de course qui ne doit rien à un logo, une livrée ou une police sous licence. « <b>Couleur choisie</b> » utilise la couleur du réglage suivant ; la couleur du texte est alors laissée au navigateur, seul à savoir si la couleur que vous avez saisie est claire ou foncée. Le réglage ne concerne <b>que cette tuile</b>.</span></div>
          <div class="help-opt"><span class="help-opt-name">Lignes affichées</span><span class="help-opt-desc">Par tableau : vingt-deux lignes sont illisibles sur une tuile moyenne, dix couvrent ce qui se joue.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rafraîchir</span><span class="help-opt-desc">30 min par défaut. Un classement ne bouge qu'après une course ; le compte à rebours, lui, s'égrène sans rien demander au réseau.</span></div>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Saison</span><span class="help-opt-desc">Vide = saison en cours. Une année (2024, 2025…) pour consulter une saison passée : l'API couvre tout le championnat depuis 1950.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Prochaine course »</span><span class="help-opt-desc">Le Grand Prix à venir, son circuit, son pays, et un compte à rebours à la seconde jusqu'au départ. Pendant le week-end, le compte à rebours vise la prochaine SÉANCE et non la course : savoir que les qualifications commencent dans vingt minutes est plus utile qu'un compte à rebours de deux jours. POUR DISPOSER LES CARTES LIBREMENT : ne cochez qu'UNE carte et posez autant de tuiles Formule 1 que de cartes voulues. Une tuile à carte unique n'affiche ni cadre ni titre interne — elle devient cette carte — et se déplace et se redimensionne comme n'importe quelle tuile, avec la grille de PiBoard. Les cartes ne sont pas déplaçables à l'intérieur d'une tuile, et il serait absurde de rebâtir une grille dans la grille. Le relais serveur partage son cache : cinq tuiles ne coûtent pas cinq fois plus de requêtes. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Programme du week-end »</span><span class="help-opt-desc">Toutes les séances — essais libres, sprint, qualifications, course — avec leur jour et leur heure DANS VOTRE FUSEAU. Un Grand Prix en Malaisie se court à 7 h UTC, soit 9 h chez vous : l'heure brute de l'API n'est pas celle qui vous concerne. La séance en cours est mise en avant, les séances passées estompées. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Classement pilotes »</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Classement constructeurs »</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Résultats de la dernière course »</span><span class="help-opt-desc">Le classement d'arrivée de la dernière course disputée, avec l'écart au vainqueur et les points marqués. Les abandons sont indiqués comme tels, et non comme une dernière place : terminer vingtième et ne pas terminer ne sont pas la même histoire. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Carte « Météo du circuit »</span><span class="help-opt-desc">La prévision À L'HEURE DE CHAQUE SÉANCE, et non la météo de l'instant : ce qu'on vient chercher, c'est s'il pleuvra pendant les qualifications, pas le temps qu'il fait sur le circuit un mardi. Une ligne par séance, avec le temps, la température et la probabilité de pluie — le seul chiffre mis en avant, parce qu'en Formule 1 c'est celui qui change une course. La prévision porte à sept jours : une séance plus lointaine garde sa ligne avec un tiret plutôt que d'être masquée. Source : Open-Meteo, gratuit et sans clé, comme la tuile Météo. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Pilotes affichés</span><span class="help-opt-desc">Vingt-deux lignes rendent le classement illisible sur une tuile moyenne. Dix couvre tout ce qui se joue vraiment. De 3 à 24, par défaut 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Écuries affichées</span><span class="help-opt-desc">De 3 à 12, par défaut 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Résultats affichés</span><span class="help-opt-desc">De 3 à 24, par défaut 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleurs d'écurie</span><span class="help-opt-desc">Une pastille de la couleur de l'écurie devant chaque pilote. Les logos et les photos officiels sont des marques déposées : PiBoard ne les embarque pas, et la couleur fait le même travail de reconnaissance immédiate. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Style des cartes</span><span class="help-opt-desc">« Thème de la page » garde les cartes cohérentes avec le reste du tableau. « Piste sombre » leur donne le noir profond du paddock et un liseré rouge — un air de course qui ne doit rien à un logo, une livrée ou une police sous licence. « Couleur choisie » utilise la couleur ci-dessous ; la couleur du texte est alors laissée au navigateur, seul à savoir si la couleur saisie est claire ou foncée. Le réglage ne concerne QUE cette tuile. Choix : Thème de la page, Piste sombre, Couleur choisie. Par défaut : Thème de la page.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur des cartes</span><span class="help-opt-desc">Utilisée seulement si le style ci-dessus est « Couleur choisie ». Par défaut : « #12151c ».</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchir toutes les (minutes)</span><span class="help-opt-desc">Un classement ne bouge qu'après une course. Le compte à rebours, lui, s'égrène à la seconde sans rien demander au réseau. De 5 à 360, par défaut 30.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 12×16</span>

<h4>Purpose</h4>
<p>Gather on one tile what a Formula 1 fan watches during a Grand Prix weekend.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Six cards</b> shown or hidden one by one: next race with countdown, weekend schedule in your time zone, driver standings, constructor standings, last race results, circuit weather.</li>
  <li>Adjustable <b>number of rows</b> for standings and results.</li>
  <li><b>Team colours</b> and card colour of your choice; cards arranged as you like.</li>
  <li>A retirement is shown as such, not as a twentieth place; the weather is for race time.</li>
  <li>Free Jolpica data (Ergast's successor), no key or account.</li>
</ul>

<h4>The six cards</h4>
          <div class="help-opt"><span class="help-opt-name">Next race</span><span class="help-opt-desc">The upcoming Grand Prix, its circuit, its country and a <b>countdown to the second</b>. During the weekend it targets the next <b>session</b> rather than the race: on Saturday morning, knowing qualifying starts in twenty minutes beats a two-day countdown.</span></div>
          <div class="help-opt"><span class="help-opt-name">Weekend timetable</span><span class="help-opt-desc">Every session with its day and time <b>in your own time zone</b>. The API gives UTC; that is not the hour that concerns you. The live session is highlighted, past ones dimmed.</span></div>
          <div class="help-opt"><span class="help-opt-name">Driver standings</span><span class="help-opt-desc">Position, flag, three-letter code, number, points and wins.</span></div>
          <div class="help-opt"><span class="help-opt-name">Constructor standings</span><span class="help-opt-desc">The teams' championship, in the same shape.</span></div>
          <div class="help-opt"><span class="help-opt-name">Last race</span><span class="help-opt-desc">The finishing order, the gap to the winner, the points, and the fastest lap marked with a stopwatch.</span></div>
          <div class="help-opt"><span class="help-opt-name">Circuit weather</span><span class="help-opt-desc">The forecast <b>for each session's hour</b>, one row per session: the condition, the temperature and the <b>chance of rain</b>.</span></div>

<h4>A retirement is not a twentieth place</h4>
          <p>The API returns a final classification for every car, including those that hit the wall on lap two. Showing "18th" for a car that did not finish tells a different story from the race that took place: the tile shows <b>the cause of the retirement</b> (Accident, Engine, Gearbox…) instead of the position, and dims the row.</p>

<h4>A race's weather is not a place's weather</h4>
          <p>"24 degrees, showers" for Spa says nothing useful. What one comes for is whether it will rain <b>during qualifying</b>, which lasts an hour and happens on Saturday at 4pm. So the card gives <b>one row per session</b>, with the forecast for that session's hour — not the weather right now, which concerns nobody on a Tuesday.</p>
          <p>The <b>chance of rain is the only figure in colour</b>, from 30% up. That is deliberate: in Formula 1 temperature decides the tyre compound and wind bites in fast corners, but rain is what rewrites the race. Colouring everything would highlight nothing.</p>
          <p>The forecast reaches <b>seven days</b>. A session further out <b>keeps its row, with a dash</b>: hiding it would give a truncated programme one would believe complete, whereas the dash says "not known yet". Source: <b>Open-Meteo</b>, free and keyless, the same service as the Weather tile.</p>

<h4>The circuit map now has a tile of its own</h4>
          <p>Circuit outlines are no longer a card of this tile: they are a tile in their own right, <b>Circuit map</b>, with its own help page. It offers more settings, shows a spec sheet, and above all it reads a <b>circuit base</b> instead of querying OpenStreetMap on every display — which failed two times out of three.</p>

<h4>No logos, deliberately</h4>
          <p>Team logos, driver photos and official circuit maps are <b>registered trademarks and copyrighted visuals</b>. PiBoard is published under a free licence on a public repository and does not embed them. Instead each row carries the <b>team colour</b> and the driver's <b>three-letter code</b> (ANT, HAM, VER) — just as quick to recognise, and owing nothing to anyone. The flag is an emoji: on a machine without a complete emoji font the code stays readable and nothing is lost.</p>

<h4>Arranging the cards as you wish</h4>
          <p><b>Tick a single card, and place as many Formula 1 tiles as you want cards.</b> A single-card tile shows neither frame nor inner title: it <i>becomes</i> that card, and moves, resizes and gets renamed like any tile, using PiBoard's own grid.</p>
          <p>That is the right way round, because cards <b>are not draggable inside a tile</b>: rebuilding a grid inside the grid would make no sense when PiBoard already has one. And it costs nothing: the relay shares its cache, so five tiles do not send the same requests five times.</p>
          <p><b>What size for each tile?</b> The 4×4 default is deliberately modest: it is the smallest that genuinely serves the short cards, and it is better to enlarge the two tiles that deserve it than to shrink the other five. In practice: <b>Next race</b> 3×3, <b>Weekend timetable</b> 3×4, <b>Constructor standings</b> 3×5, <b>Driver standings</b> 3×7, <b>Last race</b> 4×7. The universal <b>Text size</b> setting tightens the content further.</p>
          <p>The content follows the tile's real width: on a narrow tile the driver's number and the wins column disappear, because three readable columns beat five truncated ones. And in the timetable the session name yields before the time — the time is the one thing one comes for.</p>
          <p>If instead you want everything in one place, tick several cards: they flow into as many columns as the width allows, each at the size of its own content. An unticked card is <b>not requested at all</b>.</p>

<h4>Source</h4>
          <p>The <b>Jolpica</b> API, the community successor to Ergast (closed at the end of 2024), with no key and no account. It is the same source as Home Assistant's Formula 1 integrations, and the one the <i>Motorsport schedule</i> tile already reads. History covers the championship since 1950: the <b>Season</b> setting accepts any year.</p>
          <p>The circuit outlines come from <b>OpenStreetMap</b> through the public <b>Overpass</b> service, under the ODbL licence. The forecasts come from <b>Open-Meteo</b>, free and keyless.</p>
          <div class="help-opt"><span class="help-opt-name">Card style</span><span class="help-opt-desc">"Page theme" keeps the cards consistent with the rest of the board and stays the default. "<b>Dark track</b>" gives them the paddock's deep black and a red edge: a racing look that owes nothing to any logo, livery or licensed typeface. "<b>Chosen colour</b>" uses the colour from the next setting; the text colour is then left to the browser, which alone knows whether the colour you entered is light or dark. The setting affects <b>this tile only</b>.</span></div>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Season</span><span class="help-opt-desc">Empty = current season. A year (2024, 2025…) to look at a past season: the API covers the championship since 1950.</span></div>
<div class="help-opt"><span class="help-opt-name">"Next race" card</span><span class="help-opt-desc">The upcoming Grand Prix, its circuit, its country, and a countdown to the second. During the weekend the countdown targets the next SESSION rather than the race. TO ARRANGE THE CARDS FREELY: tick only ONE card and place as many Formula 1 tiles as you want cards. A single-card tile shows neither frame nor inner title — it becomes that card — and moves and resizes like any tile, using PiBoard's own grid. Cards are not draggable inside a tile, and rebuilding a grid inside the grid would be absurd. The relay shares its cache: five tiles do not cost five times the requests. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Weekend timetable" card</span><span class="help-opt-desc">Every session — practice, sprint, qualifying, race — with its day and time IN YOUR OWN TIME ZONE. The live session is highlighted, past ones dimmed. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Driver standings" card</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Constructor standings" card</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Last race results" card</span><span class="help-opt-desc">The finishing order of the last race run, with the gap to the winner and the points scored. Retirements are shown as such rather than as a last place: finishing twentieth and not finishing are not the same story. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Circuit weather" card</span><span class="help-opt-desc">The forecast AT EACH SESSION'S HOUR, not the weather right now: what one comes for is whether it will rain during qualifying, not what the sky looks like over the circuit on a Tuesday. One row per session, with the condition, the temperature and the chance of rain -- the only figure highlighted, because in Formula 1 it is the one that changes a race. The forecast reaches seven days, so a session further out keeps its row with a dash rather than being hidden. Source: Open-Meteo, free and without a key, the same as the Weather tile. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Drivers shown</span><span class="help-opt-desc">Twenty-two rows make the table unreadable on a medium tile. Ten covers everything actually at stake. From 3 to 24, default 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Teams shown</span><span class="help-opt-desc">From 3 to 12, default 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Results shown</span><span class="help-opt-desc">From 3 to 24, default 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Team colours</span><span class="help-opt-desc">A chip in the team's colour before each driver. Official logos and photos are registered trademarks, so PiBoard does not embed them; the colour does the same job of instant recognition. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Card style</span><span class="help-opt-desc">"Page theme" keeps the cards consistent with the rest of the board. "Dark track" gives them the paddock's deep black with a red edge -- a racing look that owes nothing to any logo, livery or licensed typeface. "Chosen colour" uses the colour below instead; the text colour is then left to the browser, which alone knows whether the colour entered is light or dark. The setting affects THIS tile only. Choices: Page theme, Dark track, Chosen colour. Default: Page theme.</span></div>
<div class="help-opt"><span class="help-opt-name">Card colour</span><span class="help-opt-desc">Used only when the style above is "Chosen colour". Default: "#12151c".</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh every (minutes)</span><span class="help-opt-desc">Standings only move after a race. The countdown ticks every second without asking the network for anything. From 5 to 360, default 30.</span></div>
`
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
<p>Savoir quand regarder, sans chercher les horaires du week-end de course sur le web.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Formule 1 ou MotoGP</b> (catégories MotoGP au choix).</li>
  <li><b>Programme du week-end</b> : essais, qualifications, sprint et course, au jour et à l'heure locale ; séance en cours mise en avant, séances passées estompées ou masquées.</li>
  <li><b>Mode calendrier</b> : les prochaines manches de la saison, en nombre réglable.</li>
  <li>Données F1 Jolpica et flux public de motogp.com, sans clé.</li>
</ul>

<h4>Possibilités</h4>
          <p>Le mode par défaut affiche la <b>prochaine manche</b> avec l'intégralité de son programme, regroupé par jour : essais libres, qualifications, course sprint et course, chacun à son heure locale (convertie automatiquement depuis le fuseau du circuit). Les séances déjà terminées restent visibles mais estompées, la séance en cours est signalée par une pastille clignotante, et la prochaine à venir est mise en avant — le tout se rafraîchit tout seul chaque minute, sans nouvel appel réseau. Un code couleur distingue les essais (gris), les qualifications (orange), le sprint (violet) et la course (rouge). Le mode <b>calendrier</b> liste plutôt les prochaines manches de la saison avec leurs dates, pratique pour anticiper. Une manche en cours reste affichée jusqu'à sa course du dimanche, plutôt que de sauter à la suivante dès le samedi soir.</p>
          <p>Pour le MotoGP, les catégories Moto2, Moto3 et MotoE peuvent être ajoutées au programme — attention, cela le rend nettement plus long, à réserver à une tuile haute.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Championnat</span><span class="help-opt-desc">Formule 1 ou MotoGP. Pour suivre les deux, ajoutez simplement deux tuiles.</span></div>
<div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Programme détaillé de la prochaine manche, ou calendrier des prochaines manches.</span></div>
<div class="help-opt"><span class="help-opt-name">MotoGP : catégories affichées</span><span class="help-opt-desc">MotoGP seul, ou toutes les catégories du week-end.</span></div>
<div class="help-opt"><span class="help-opt-name">Masquer les séances déjà terminées</span><span class="help-opt-desc">Utile sur une petite tuile pour ne garder que ce qui reste à venir.</span></div>
<div class="help-opt"><span class="help-opt-name">Mode calendrier : nombre de manches affichées</span><span class="help-opt-desc">En mode calendrier uniquement.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Un programme change rarement : un intervalle long suffit largement.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 8×10</span>

<h4>Goal</h4>
<p>Know when to watch, without searching the web for the race weekend timetable.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Formula 1 or MotoGP</b> (MotoGP classes of your choice).</li>
  <li><b>Weekend schedule</b>: practice, qualifying, sprint and race, by day and local time; the session in progress highlighted, past sessions dimmed or hidden.</li>
  <li><b>Calendar mode</b>: the season's upcoming rounds, in an adjustable number.</li>
  <li>F1 data from Jolpica and the public motogp.com feed, no key.</li>
</ul>

<h4>Possibilities</h4>
          <p>The default mode shows the <b>next round</b> with its full timetable, grouped by day: free practice, qualifying, sprint and race, each at its local time (converted automatically from the circuit's timezone). Finished sessions stay visible but dimmed, the ongoing session gets a pulsing dot, and the next one up is highlighted — all of it refreshing on its own every minute, with no new network call. A color code tells practice (grey), qualifying (orange), sprint (purple) and race (red) apart. The <b>calendar</b> mode lists the season's upcoming rounds with their dates instead, handy for planning ahead. An ongoing round stays displayed through its Sunday race, rather than jumping to the next one from Saturday evening.</p>
          <p>For MotoGP, the Moto2, Moto3 and MotoE classes can be added to the timetable — note this makes it considerably longer, best kept for a tall tile.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Championship</span><span class="help-opt-desc">Formula 1 or MotoGP. To follow both, simply add two tiles.</span></div>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Choices: Next round — full session timetable, Season calendar — upcoming rounds. Default: Next round — full session timetable.</span></div>
<div class="help-opt"><span class="help-opt-name">MotoGP: classes shown</span><span class="help-opt-desc">MotoGP alone, or every class of the weekend.</span></div>
<div class="help-opt"><span class="help-opt-name">Hide sessions already finished</span><span class="help-opt-desc">Useful on a small tile to keep only what's still ahead.</span></div>
<div class="help-opt"><span class="help-opt-name">Calendar mode: rounds shown</span><span class="help-opt-desc">Calendar mode only.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">A timetable rarely changes: a long interval is plenty.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Detailed timetable of the next round, or calendar of upcoming rounds.</span></div>
`
      }
    },

    {
      id: "standings",
      group: "tiles",
      title: { fr: "Classement", en: "League standings" },
      sub: {
        fr: "Classement actuel de football, rugby (Top 14), basketball, Formule 1 et MotoGP, ou toute autre compétition couverte par ESPN via son code.",
        en: "Current league table for football, rugby (Top 14), basketball, Formula 1 and MotoGP, or any other ESPN-covered competition via its code."
      },
      html: {
        fr: `
<span class="help-size">Taille : 4×4 par défaut, de 2×2 à 12×12</span>

<h4>Objectif</h4>
<p>Afficher le classement à jour d'un championnat, en mettant en valeur votre équipe.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Football, rugby (Top 14 et PRO D2, source LNR), basketball, Formule 1 et MotoGP</b> (pilotes et équipes), ou toute compétition ESPN via son code.</li>
  <li><b>Équipe mise en valeur</b> dans le tableau, <b>colonnes</b> et <b>nombre de lignes</b> au choix.</li>
  <li>Colonnes adaptées à chaque sport (points, différence, victoires…), expliquées dans « Lire le tableau ».</li>
  <li>Message clair quand la source ne répond plus, au lieu d'un tableau vide.</li>
</ul>

<h4>Possibilités</h4>
          <p>Comme pour les scores en direct, une liste de compétitions courantes est proposée, et un code ESPN personnalisé permet d'en cibler n'importe quelle autre. Pour trouver ce code : ouvrez la page de classement de la compétition sur espn.com (ex. <code>espn.com/nfl/scoreboard</code>), ouvrez les outils de développement du navigateur → onglet Réseau, rechargez la page, et repérez une requête vers <code>site.api.espn.com/apis/site/v2/sports/&lt;sport&gt;/&lt;ligue&gt;/scoreboard</code> — les deux segments après <code>/sports/</code> forment le code à saisir, séparés par deux-points (ex. NHL → <code>hockey:nhl</code>). La tuile s'agrandit largement (jusqu'à 12×12) pour que les noms de clubs complets restent lisibles même avec une grande police — élargissez-la si un nom est tronqué. Mettre en valeur une équipe (via son nom) la fait ressortir visuellement dans le tableau, pratique pour repérer d'un coup d'œil la position de votre équipe.</p>

<h4>Top 14 et PRO D2 : source LNR</h4>
          <p>Ces deux championnats ne viennent pas d'ESPN, qui a cessé de les publier après la saison 2022-23, mais du site officiel de la <b>Ligue Nationale de Rugby</b> (top14.lnr.fr et prod2.lnr.fr). La LNR ne propose pas d'API : le classement est écrit directement dans la page, et la tuile le lit comme le ferait un navigateur. Les colonnes sont repérées par l'en-tête du tableau et non par leur position, pour que l'ajout d'une colonne par la LNR ne décale pas silencieusement les chiffres. La saison et la journée sont rappelées sous le tableau. Les tuiles Top 14 déjà en place basculent automatiquement sur cette source, sans reconfiguration.</p>

<h4>Quand la source décroche</h4>
          <p>ESPN abandonne parfois une compétition sans le signaler : la réponse reste valide et complète, mais elle date d'une saison close depuis longtemps. C'est le cas du <b>Top 14</b> (identifiant ESPN <code>270559</code>), pour lequel ESPN ne publie plus rien depuis la saison 2022-23. Il n'y a rien à corriger côté PiBoard, la donnée récente n'existe pas chez la source — mais la tuile le dit désormais : dès que le classement affiché appartient à une saison terminée, la saison concernée est nommée sous le tableau. Une tuile qui prévient vaut mieux qu'une tuile qui laisse croire.</p>

<h4>Lire le tableau</h4>
          <p>Les colonnes affichées s'adaptent à ce que publie la source pour le sport concerné, dans l'ordre conventionnel d'un tableau de championnat : <b>J</b> matchs joués, <b>G</b> gagnés, <b>N</b> nuls, <b>P</b> perdus, <b>Diff</b> différence de points ou de buts, <b>%V</b> pourcentage de victoires (sports américains), et <b>Pts</b> les points, toujours en dernière colonne et mis en valeur. Si la tuile est étroite, les colonnes les moins essentielles sont retirées en premier — les points, eux, sont toujours conservés. En Formule 1 et en MotoGP, la colonne <b>V</b> compte les victoires. Par défaut, seules les colonnes utiles au classement sont affichées — <b>G</b>, <b>N</b>, <b>P</b> et <b>Pts</b> ; le réglage « Colonnes » permet de repasser en mode complet, qui montre tout ce que publie la source. Si le classement compte plus de lignes que la tuile n'en peut montrer, le tableau défile : molette, glissement du doigt, ou barre de défilement sur le bord droit. Le réglage « Équipes affichées par groupe » reste, lui, une limite volontaire sur le nombre de lignes demandées.</p>

<h4>Sports mécaniques</h4>
          <p>La liste des compétitions propose également les championnats de Formule 1 et de MotoGP, pilotes comme équipes. Ils n'utilisent pas ESPN mais les mêmes sources publiques que la tuile « Sports mécaniques » : Jolpica (reprise de l'API Ergast) pour la F1, le flux public de motogp.com pour le MotoGP. Pour la F1, le nombre de victoires est affiché à côté des points, et l'écurie de chaque pilote apparaît sous son nom. Le champ « code ESPN personnalisé » ne s'applique pas à ces championnats : s'il est rempli, il reprend la main et renvoie vers ESPN.</p>
          <p>Une réserve sur le classement des équipes MotoGP : le flux public ne publie que le classement des pilotes. Le total par équipe est donc <b>calculé</b> en additionnant les points de ses pilotes, ce que la tuile indique explicitement sous le tableau. Le résultat correspond au classement officiel tant qu'une écurie n'aligne que ses deux titulaires ; un pilote remplaçant ou une wild card peut créer un écart.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Compétition</span><span class="help-opt-desc">Liste des compétitions courantes préconfigurées.</span></div>
<div class="help-opt"><span class="help-opt-name">Code ESPN personnalisé (sport:ligue) — prend le pas sur la liste ci-dessus</span><span class="help-opt-desc">Prend le pas sur la liste ci-dessus, y compris sur les championnats F1 et MotoGP : laissez ce champ vide pour les utiliser. Voir la méthode de recherche ci-dessus.</span></div>
<div class="help-opt"><span class="help-opt-name">Colonnes</span><span class="help-opt-desc">Essentiel (G, N, P, Pts) ou complet (tout ce que publie la source).</span></div>
<div class="help-opt"><span class="help-opt-name">Équipes affichées par groupe</span><span class="help-opt-desc">Combien de lignes du classement afficher.</span></div>
<div class="help-opt"><span class="help-opt-name">Mettre en valeur une équipe (optionnel, ex. « Toulouse »)</span><span class="help-opt-desc">Fait ressortir visuellement la ligne de l'équipe nommée.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour du classement.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 2×2 to 12×12</span>

<h4>Goal</h4>
<p>Show a championship's current standings, highlighting your team.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Football, rugby (Top 14 and PRO D2, LNR source), basketball, Formula 1 and MotoGP</b> (drivers and teams), or any ESPN competition via its code.</li>
  <li><b>Highlighted team</b> in the table, <b>columns</b> and <b>number of rows</b> of your choice.</li>
  <li>Columns suited to each sport (points, difference, wins…), explained in "Reading the table".</li>
  <li>A clear message when the source stops answering, instead of an empty table.</li>
</ul>

<h4>Possibilities</h4>
          <p>As with live scores, a list of common competitions is offered, and a custom ESPN code lets you target any other. To find that code: open the competition's standings page on espn.com (e.g. <code>espn.com/nfl/scoreboard</code>), open the browser's developer tools → Network tab, reload the page, and look for a request to <code>site.api.espn.com/apis/site/v2/sports/&lt;sport&gt;/&lt;league&gt;/scoreboard</code> — the two segments after <code>/sports/</code> form the code to enter, separated by a colon (e.g. NHL → <code>hockey:nhl</code>). The tile scales up generously (up to 12×12) so full club names stay readable even with a large font — widen it if a name gets truncated. Highlighting a team (by name) makes it visually stand out in the table, handy for spotting your team's position at a glance.</p>

<h4>Top 14 and PRO D2: LNR source</h4>
          <p>These two competitions do not come from ESPN, which stopped publishing them after the 2022-23 season, but from the official Ligue Nationale de Rugby site. The LNR offers no API: the table is written straight into the page, and the tile reads it as a browser would. Columns are located by the table's header rather than by position, so that a column added by the LNR does not silently shift the figures. Season and matchday are recalled under the table. Existing Top 14 tiles switch to this source automatically.</p>

<h4>When the source drops out</h4>
          <p>ESPN sometimes abandons a competition without saying so: the answer stays valid and complete, but comes from a season closed long ago. This is the case of the <b>Top 14</b> (ESPN id <code>270559</code>), for which ESPN has published nothing since the 2022-23 season. There is nothing to fix in PiBoard, the recent data does not exist at the source — but the tile now says so: as soon as the displayed table belongs to a finished season, that season is named under the table.</p>

<h4>Reading the table</h4>
          <p>The columns shown adapt to what the source publishes for that sport, in the conventional order of a league table: <b>P</b> games played, <b>W</b> won, <b>D</b> drawn, <b>L</b> lost, <b>Diff</b> point or goal difference, <b>Pct</b> win percentage (US sports), and <b>Pts</b> the points, always in the last column and emphasised. If the tile is narrow, the least essential columns are dropped first — points are always kept. In Formula 1 and MotoGP, the <b>Wins</b> column counts race victories. By default only the columns a table needs are shown — <b>W</b>, <b>D</b>, <b>L</b> and <b>Pts</b>; the "Columns" setting switches back to the full mode, showing everything the source publishes. If the table has more rows than the tile can show, it scrolls: mouse wheel, finger swipe, or the scrollbar on the right edge. The "Teams shown per group" setting remains a deliberate cap on how many rows are requested.</p>

<h4>Motorsport</h4>
          <p>The competition list also offers the Formula 1 and MotoGP championships, drivers as well as teams. These don't use ESPN but the same public sources as the "Motorsport" tile: Jolpica (the continuation of the Ergast API) for F1, motogp.com's public feed for MotoGP. For F1 the number of wins is shown next to the points, and each driver's team appears under their name. The "custom ESPN code" field does not apply to these championships: if filled, it takes over and goes back to ESPN.</p>
          <p>One caveat on the MotoGP team standings: the public feed only publishes the rider standings. Each team's total is therefore <b>computed</b> by adding up its riders' points, which the tile states explicitly under the table. The result matches the official standings as long as a team fields only its two regular riders; a stand-in rider or a wild card can create a discrepancy.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Competition</span><span class="help-opt-desc">List of preconfigured common competitions.</span></div>
<div class="help-opt"><span class="help-opt-name">Custom ESPN code (sport:league) — overrides the list above</span><span class="help-opt-desc">Takes precedence over the list above, including over the F1 and MotoGP championships: leave this field empty to use them. See the lookup method above.</span></div>
<div class="help-opt"><span class="help-opt-name">Columns</span><span class="help-opt-desc">Essential (W, D, L, Pts) or full (everything the source publishes).</span></div>
<div class="help-opt"><span class="help-opt-name">Teams shown per group</span><span class="help-opt-desc">How many standings rows to show.</span></div>
<div class="help-opt"><span class="help-opt-name">Highlight a team (optional, e.g. "Toulouse")</span><span class="help-opt-desc">Visually highlights the named team's row.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two standings updates.</span></div>
`
      }
    },

    {
      id: "system",
      group: "tiles",
      title: { fr: "État système", en: "System status" },
      sub: {
        fr: "CPU, GPU, RAM, espace disque, température et disponibilité de la machine qui héberge PiBoard.",
        en: "CPU, GPU, RAM, disk usage, temperature and uptime of the machine hosting PiBoard."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×3 par défaut, de 2×1 à 6×6</span>

<h4>Objectif</h4>
<p>Garder un œil sur la santé de la machine qui héberge PiBoard, depuis le tableau lui-même.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>CPU, RAM, disque et température</b>, avec <b>courbes d'utilisation</b> sur la durée choisie.</li>
  <li><b>Charge du GPU</b> et sa courbe, quand le système la fournit.</li>
  <li><b>Nom de la machine</b>, <b>disponibilité</b> (temps depuis le démarrage), <b>adresses réseau</b> des cartes et <b>adresse IP publique</b>.</li>
  <li><b>Couleurs par niveau</b> (normal, élevé, critique), avec des courbes qui peuvent suivre le niveau actuel.</li>
  <li>Chaque élément s'affiche ou se masque ; rafraîchissement réglable à la seconde.</li>
</ul>

<h4>Possibilités</h4>
          <p>Utile en particulier sur un Raspberry Pi, où la température et l'usage CPU/RAM peuvent révéler un problème (par exemple un boîtier mal ventilé, ou un processus qui consomme trop) avant qu'il ne devienne gênant. L'espace disque restant permet d'anticiper un plein (photos du diaporama, notes…) avant qu'il ne bloque une sauvegarde.</p>

<h4>Charge du GPU</h4>
          <p>Une barre supplémentaire, affichée <b>uniquement si la machine expose réellement la charge de son GPU</b> : cartes NVIDIA (via <code>nvidia-smi</code>, fourni avec le pilote), cartes AMD sous Linux (fichier <code>gpu_busy_percent</code> du pilote amdgpu), et n'importe quelle carte sous Windows 10 ou plus récent (compteurs de performance « GPU Engine »). La température de la carte est ajoutée au libellé quand la source la fournit.</p>
          <p><b>Sur un Raspberry Pi, la ligne reste masquée</b> : le VideoCore n'expose nulle part son taux d'occupation — <code>vcgencmd</code> donne des températures et des fréquences, jamais un pourcentage de charge. Afficher « GPU 0 % » laisserait croire à un GPU au repos alors que rien n'est mesuré ; l'absence de ligne est la seule réponse honnête. C'est le même choix que pour macOS, où la charge n'est lisible que par <code>powermetrics</code>, qui exige les droits administrateur.</p>
          <p>La mesure est <b>mise en cache quelques secondes et partagée par tous les écrans</b> : contrairement au CPU (simple lecture d'un fichier système), lire la charge du GPU lance un processus. Sans ce cache, trois tuiles sur trois écrans en lanceraient des dizaines par minute pour un chiffre identique.</p>
          <p>La <b>courbe est optionnelle</b> (réglage « Courbe d'utilisation du GPU ») : décochée, la barre reste affichée mais n'est plus cliquable et l'onglet GPU disparaît de la fenêtre des courbes. L'historique GPU démarre à l'installation de cette version — les points enregistrés avant n'ont pas cette information et sont écartés, plutôt que de faire plonger la courbe à zéro sur tout le passé.</p>

<h4>Ce que « RAM » veut dire selon le système</h4>
          <p>La mémoire n'est pas mesurée de la même façon partout, et la question « combien est utilisé ? » n'a pas la même réponse selon le système. PiBoard affiche désormais, sur chacun, <b>le chiffre que le système lui-même considère comme utilisé</b> :</p>
          <div class="help-opt"><span class="help-opt-name">macOS</span><span class="help-opt-desc">La « Mémoire utilisée » du Moniteur d'activité : mémoire d'application, mémoire résidente et mémoire compressée. macOS remplit volontairement la RAM inoccupée de cache, immédiatement récupérable — le compteur de mémoire strictement libre y est donc toujours proche de zéro, sur une machine parfaitement saine.</span></div>
          <div class="help-opt"><span class="help-opt-name">Linux (Raspberry Pi)</span><span class="help-opt-desc">L'estimation du noyau lui-même (<code>MemAvailable</code>) : ce qu'une application peut obtenir sans déclencher d'échange. Le cache fichier n'est donc plus compté comme utilisé, alors que le noyau le rend à la première demande.</span></div>
          <div class="help-opt"><span class="help-opt-name">Windows</span><span class="help-opt-desc">La mémoire disponible telle que la donne le système, celle du Gestionnaire des tâches. Rien n'a changé ici : c'était déjà le bon chiffre.</span></div>
          <p><b>Conséquence pratique</b> : sur un Mac, la jauge affichait jusqu'ici 95 à 99 % en permanence, quelle que soit la charge réelle — un indicateur qui montre toujours la même chose n'informe de rien. Elle reflète maintenant la vraie occupation. Sur un Raspberry Pi, l'écart est plus discret mais va dans le même sens : une machine dont le cache est plein n'est plus annoncée comme saturée.</p>

<h4>Courbes d'utilisation</h4>
          <p><b>Un clic sur CPU, GPU, RAM ou Disque</b> ouvre une fenêtre à trois onglets, une courbe par ressource, qui se met à jour en direct au rythme de rafraîchissement de la tuile.</p>
          <p>L'axe des abscisses porte des <b>graduations horaires</b> alignées sur des instants ronds (heure pleine, quart d'heure, minuit selon la profondeur affichée) : un creux se date d'un coup d'œil. C'est le même axe sur tous les graphiques du tableau — cryptos, bourse, santé Internet.</p>
          <p>L'échelle verticale est <b>fixée de 0 à 100 %</b>, jamais ajustée au contenu : une échelle automatique ferait paraître dramatique une variation de deux points en zoomant dessus.</p>
          <p>L'historique est échantillonné <b>chaque minute par le serveur</b> : il survit donc aux rechargements de page et il est <b>partagé par tous vos écrans</b>. La profondeur est réglable jusqu'à 24 h dans les réglages de la tuile.</p><p>L'écriture sur disque est espacée de cinq minutes plutôt qu'à chaque relevé : sur un Raspberry Pi, écrire 1440 fois par jour sur la carte SD serait inutilement agressif. Après une coupure brutale, les dernières minutes peuvent manquer — sans conséquence ici.</p>

<h4>Adresses réseau</h4>
          <p>La tuile peut afficher l'adresse IP de chaque carte réseau de la machine. <b>Un clic sur une adresse</b> ouvre une fenêtre détaillant la configuration complète de toutes les cartes : adresse et masque, passerelle, DHCP (avec le serveur et l'expiration du bail le cas échéant), serveurs DNS, suffixe de domaine, adresse MAC et adresses IPv6 publiques. Le nom d'hôte est rappelé en haut.</p>
          <p><b>Seules les vraies cartes connectées apparaissent.</b> Les cartes virtuelles — Docker, VirtualBox, VMware, Hyper-V, VPN — sont écartées, principalement d'après le préfixe constructeur de leur adresse MAC, qui est le critère le plus fiable. Une carte physique sans adresse IPv4 (câble débranché) est également masquée, puisqu'elle n'est pas réellement connectée.</p>
          <p>Une information que le système n'a pas pu fournir s'affiche « non disponible » plutôt qu'avec une valeur approchée. En particulier, DHCP reste vide si PiBoard n'a pas pu conclure : afficher « non » laisserait croire à tort à une adresse fixe.</p>
          <p>Ces informations sont lues une seule fois à l'affichage de la tuile, et non à chaque rafraîchissement : la configuration réseau ne change pratiquement jamais, et exécuter une commande système toutes les cinq secondes n'aurait aucun intérêt.</p>

<h4>Adresse IP publique</h4>
          <p>En option, la tuile affiche aussi l'adresse sous laquelle votre réseau local apparaît sur Internet — celle que voient les sites web, différente des adresses locales des cartes. Elle est obtenue <b>par le serveur PiBoard</b> auprès d'un service externe (trois services indépendants sont essayés à tour de rôle), et gardée en cache dix minutes : un seul appel pour tous vos écrans, jamais toutes les cinq secondes. Si le service devient injoignable, la dernière adresse connue reste affichée, atténuée, plutôt qu'un vide. <b>Désactivée par défaut</b> : c'est une information que l'on ne souhaite pas forcément sur un écran mural.</p>

<h4>Couleurs et seuils</h4>
          <p>Chaque barre (CPU, RAM, disque) prend l'une de trois couleurs selon le niveau : <b>normal</b> (vert par défaut), <b>élevé</b> (ambre) et <b>critique</b> (rouge). <b>Le rouge est réservé au niveau critique</b> — les versions précédentes peignaient l'usage normal avec la couleur d'accent du thème, un rouge framboise qui faisait passer un Pi au repos pour une machine en surchauffe. Les deux seuils (65 % et 85 % par défaut) et les trois couleurs se règlent dans la section « Couleurs &amp; seuils ». Un seuil critique placé sous le seuil élevé est aligné dessus plutôt qu'ignoré en silence.</p>
          <p>Les courbes ont leur propre couleur (bleu par défaut), ou peuvent suivre le niveau du dernier relevé si vous cochez l'option correspondante. Le chiffre courant en tête de la fenêtre prend toujours la couleur de son niveau.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (secondes)</span><span class="help-opt-desc">Intervalle en secondes entre deux relevés.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le nom de machine</span><span class="help-opt-desc">Utile si plusieurs machines hébergent chacune une instance PiBoard.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les adresses IP des cartes réseau</span><span class="help-opt-desc">Uniquement les cartes réelles et connectées (WiFi et Ethernet). Cliquez sur une adresse pour ouvrir la configuration réseau complète. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher l'adresse IP publique</span><span class="help-opt-desc">Voir ci-dessus. Désactivée par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la charge du GPU</span><span class="help-opt-desc">La barre GPU. Sans effet si la machine n'expose pas cette information (Raspberry Pi).</span></div>
<div class="help-opt"><span class="help-opt-name">Courbe d'utilisation du GPU</span><span class="help-opt-desc">Ajoute l'onglet GPU aux courbes et rend la barre cliquable. Décochez pour garder la barre seule.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la disponibilité</span><span class="help-opt-desc">Depuis combien de temps la machine tourne sans interruption.</span></div>
<div class="help-opt"><span class="help-opt-name">Historique des courbes (minutes)</span><span class="help-opt-desc">Profondeur des courbes d'utilisation. Échantillonné chaque minute sur le serveur, donc conservé après un rechargement et partagé par tous les écrans. Jusqu'à 24 h. De 5 à 1440, par défaut 120.</span></div>
<p class="help-opt-group">Couleurs &amp; seuils</p>
<div class="help-opt"><span class="help-opt-name">Seuil « élevé » (%)</span><span class="help-opt-desc">À partir de ce niveau d'utilisation, la barre passe à la couleur « élevé ». S'applique au CPU, à la RAM et au disque. De 1 à 99, par défaut 65.</span></div>
<div class="help-opt"><span class="help-opt-name">Seuil « critique » (%)</span><span class="help-opt-desc">À partir de ce niveau, la barre passe à la couleur « critique » (rouge par défaut — le seul état où le rouge est utilisé). De 2 à 100, par défaut 85.</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur en usage normal</span><span class="help-opt-desc">Couleur des barres pour chaque niveau. Par défaut : « #3FA96B ».</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur en usage élevé</span><span class="help-opt-desc">Par défaut : « #E0A63C ».</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur en usage critique</span><span class="help-opt-desc">Par défaut : « #E0556F ».</span></div>
<div class="help-opt"><span class="help-opt-name">Couleur des courbes</span><span class="help-opt-desc">Trait et zone ombrée des graphiques. Ignorée si « suit le niveau d'utilisation » est coché.</span></div>
<div class="help-opt"><span class="help-opt-name">La couleur des courbes suit le niveau d'utilisation actuel</span><span class="help-opt-desc">Ignore la couleur des courbes ci-dessus : la courbe prend la couleur normal / élevé / critique du dernier relevé. Désactivé par défaut.</span></div>
`,
        en: `
<span class="help-size">Size: 3×3 by default, from 2×1 to 6×6</span>

<h4>Goal</h4>
<p>Keep an eye on the health of the machine hosting PiBoard, from the board itself.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>CPU, RAM, disk and temperature</b>, with <b>usage charts</b> over the chosen period.</li>
  <li><b>GPU load</b> and its chart, when the system provides it.</li>
  <li><b>Machine name</b>, <b>uptime</b>, network card <b>addresses</b> and <b>public IP address</b>.</li>
  <li><b>Colours by level</b> (normal, high, critical), with charts that can follow the current level.</li>
  <li>Each item can be shown or hidden; refresh adjustable to the second.</li>
</ul>

<h4>Possibilities</h4>
          <p>Especially useful on a Raspberry Pi, where temperature and CPU/RAM usage can reveal a problem (e.g. a poorly ventilated case, or a process consuming too much) before it becomes an issue. Remaining disk space lets you anticipate running out (slideshow photos, notes…) before it blocks a save.</p>

<h4>GPU load</h4>
          <p>An extra bar, shown <b>only if the machine actually exposes its GPU load</b>: NVIDIA cards (through <code>nvidia-smi</code>, shipped with the driver), AMD cards on Linux (the amdgpu driver's <code>gpu_busy_percent</code> file), and any card on Windows 10 or newer ("GPU Engine" performance counters). The card's temperature is appended to the label when the source provides it.</p>
          <p><b>On a Raspberry Pi the row stays hidden</b>: the VideoCore exposes its occupancy nowhere — <code>vcgencmd</code> gives temperatures and frequencies, never a load percentage. Showing "GPU 0%" would suggest an idle GPU when nothing is being measured; no row at all is the only honest answer. Same choice as on macOS, where the load is only readable through <code>powermetrics</code>, which requires administrator rights.</p>
          <p>The reading is <b>cached for a few seconds and shared by every screen</b>: unlike the CPU (a plain system file read), reading the GPU load spawns a process. Without that cache, three tiles on three screens would spawn dozens a minute for an identical figure.</p>
          <p>The <b>chart is optional</b> ("GPU usage chart" setting): unticked, the bar stays shown but is no longer clickable and the GPU tab disappears from the charts window. GPU history starts when this version is installed — points recorded earlier hold no such information and are dropped, rather than dragging the curve to zero across all the past.</p>

<h4>What "RAM" means on each system</h4>
          <p>Memory is not measured the same way everywhere, and "how much is used?" does not have the same answer on every system. PiBoard now shows, on each of them, <b>the figure the system itself considers used</b>:</p>
          <div class="help-opt"><span class="help-opt-name">macOS</span><span class="help-opt-desc">Activity Monitor's "Memory Used": app memory, wired memory and compressed memory. macOS deliberately fills unused RAM with immediately reclaimable cache — the strictly-free counter is therefore always near zero on a perfectly healthy machine.</span></div>
          <div class="help-opt"><span class="help-opt-name">Linux (Raspberry Pi)</span><span class="help-opt-desc">The kernel's own estimate (<code>MemAvailable</code>): what an application can obtain without swapping. File cache no longer counts as used, although the kernel hands it back on first demand.</span></div>
          <div class="help-opt"><span class="help-opt-name">Windows</span><span class="help-opt-desc">Available memory as the system gives it, Task Manager's figure. Nothing changed here: it was already the right one.</span></div>
          <p><b>In practice</b>: on a Mac the gauge used to read 95 to 99% permanently whatever the real load — a gauge that always shows the same thing informs of nothing. It now reflects actual occupancy. On a Raspberry Pi the gap is quieter but goes the same way: a machine whose cache is full is no longer announced as saturated.</p>

<h4>Usage charts</h4>
          <p><b>Clicking CPU, GPU, RAM or Disk</b> opens a three-tab window, one curve per resource, updating live at the tile's own refresh pace.</p>
          <p>The X axis carries <b>time ticks</b> aligned on round instants (whole hour, quarter, midnight depending on the depth shown): a dip can be dated at a glance. It is the same axis on every chart of the board — crypto, stocks, Internet health.</p>
          <p>The vertical scale is <b>fixed from 0 to 100%</b>, never fitted to the content: an auto scale would make a two-point wobble look dramatic by zooming into it.</p>
          <p>History is sampled <b>every minute by the server</b>: it therefore survives page reloads and is <b>shared across all your screens</b>. The depth is adjustable up to 24 h in the tile's settings.</p><p>Disk writes are spaced five minutes apart rather than one per reading: on a Raspberry Pi, writing to the SD card 1440 times a day would be needlessly aggressive. After an abrupt power cut the last few minutes may be missing — of no consequence here.</p>

<h4>Network addresses</h4>
          <p>The tile can show the IP address of each of the machine's network adapters. <b>Clicking an address</b> opens a window detailing the full configuration of every adapter: address and mask, gateway, DHCP (with the server and lease expiry where applicable), DNS servers, domain suffix, MAC address and public IPv6 addresses. The host name is shown at the top.</p>
          <p><b>Only real, connected adapters appear.</b> Virtual adapters — Docker, VirtualBox, VMware, Hyper-V, VPN — are filtered out, chiefly from the vendor prefix of their MAC address, which is the most reliable criterion. A physical adapter with no IPv4 address (cable unplugged) is hidden too, since it is not actually connected.</p>
          <p>Information the system could not supply shows as "not available" rather than as an approximation. In particular, DHCP stays blank when PiBoard could not conclude: showing "no" would wrongly suggest a static address.</p>
          <p>These details are read once when the tile appears, not on every refresh: network configuration hardly ever changes, and running a system command every five seconds would serve no purpose.</p>

<h4>Public IP address</h4>
          <p>Optionally, the tile also shows the address your local network presents on the Internet — the one websites see, distinct from the adapters' local addresses. It is obtained <b>by the PiBoard server</b> from an external service (three independent services are tried in turn), and cached for ten minutes: a single call for all your screens, never every five seconds. If the service becomes unreachable, the last known address stays shown, dimmed, rather than a blank. <b>Off by default</b>: it is a piece of information you may not want on a wall display.</p>

<h4>Colors and thresholds</h4>
          <p>Every bar (CPU, RAM, disk) takes one of three colors by level: <b>normal</b> (green by default), <b>high</b> (amber) and <b>critical</b> (red). <b>Red is reserved for the critical level</b> — previous versions painted normal usage with the theme's accent color, a raspberry red that made an idle Pi look like an overheating machine. Both thresholds (65% and 85% by default) and the three colors are set in the "Colors &amp; thresholds" section. A critical threshold placed below the high one is aligned to it rather than silently ignored.</p>
          <p>The charts have their own color (blue by default), or can follow the latest reading's level if you tick the matching option. The current figure at the top of the window always takes its level color.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Refresh (seconds)</span><span class="help-opt-desc">Interval in seconds between two readings.</span></div>
<div class="help-opt"><span class="help-opt-name">Show hostname</span><span class="help-opt-desc">Useful if several machines each host a PiBoard instance.</span></div>
<div class="help-opt"><span class="help-opt-name">Show network adapter IP addresses</span><span class="help-opt-desc">Only real, connected adapters (WiFi and Ethernet). Click an address to open the full network configuration. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the public IP address</span><span class="help-opt-desc">See above. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Show GPU load</span><span class="help-opt-desc">The GPU bar. No effect if the machine does not expose this information (Raspberry Pi).</span></div>
<div class="help-opt"><span class="help-opt-name">GPU usage chart</span><span class="help-opt-desc">Adds the GPU tab to the charts and makes the bar clickable. Untick to keep the bar alone.</span></div>
<div class="help-opt"><span class="help-opt-name">Show uptime</span><span class="help-opt-desc">How long the machine has been running without interruption.</span></div>
<div class="help-opt"><span class="help-opt-name">Chart history (minutes)</span><span class="help-opt-desc">How far back the usage charts go. Sampled every minute on the server, so it survives page reloads and is shared by every screen. Up to 24 h. From 5 to 1440, default 120.</span></div>
<p class="help-opt-group">Colors &amp; thresholds</p>
<div class="help-opt"><span class="help-opt-name">“High” threshold (%)</span><span class="help-opt-desc">From this usage level the bar switches to the “high” color. Applies to CPU, RAM and disk. From 1 to 99, default 65.</span></div>
<div class="help-opt"><span class="help-opt-name">“Critical” threshold (%)</span><span class="help-opt-desc">From this level the bar switches to the “critical” color (red by default — the only state where red is used). From 2 to 100, default 85.</span></div>
<div class="help-opt"><span class="help-opt-name">Normal usage color</span><span class="help-opt-desc">Bar color for each level. Default: "#3FA96B".</span></div>
<div class="help-opt"><span class="help-opt-name">High usage color</span><span class="help-opt-desc">Default: "#E0A63C".</span></div>
<div class="help-opt"><span class="help-opt-name">Critical usage color</span><span class="help-opt-desc">Default: "#E0556F".</span></div>
<div class="help-opt"><span class="help-opt-name">Chart color</span><span class="help-opt-desc">Line and shaded area of the charts. Ignored if "follows the current usage level" is ticked.</span></div>
<div class="help-opt"><span class="help-opt-name">Chart color follows the current usage level</span><span class="help-opt-desc">Ignores the chart color above: the curve takes the normal / high / critical color of the latest reading. Off by default.</span></div>
`
      }
    },

    {
      id: "speedtest",
      group: "tiles",
      title: { fr: "Santé Internet", en: "Internet health" },
      sub: {
        fr: "Latence, gigue et perte de paquets mesurées en continu, avec une courbe sur 24 h, des tests de débit périodiques et l'archivage en CSV.",
        en: "Latency, jitter and packet loss measured continuously, with a 24 h curve, periodic speed tests and CSV archiving."
      },
      html: {
        fr: `
<span class="help-size">Taille : 3×3 par défaut, de 2×2 à 8×6</span>

<h4>Objectif</h4>
<p>Savoir si la connexion Internet a été bonne, et pas seulement si elle l'est à l'instant où l'on regarde.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Latence, gigue et perte de paquets</b> mesurées en continu par le serveur, vers les cibles de votre choix.</li>
  <li><b>Courbe de latence</b> sur la tuile et sur la durée choisie (24 h par défaut).</li>
  <li><b>Tests de débit</b> périodiques, rares et plafonnés (volume, durée), montant en option, vers les adresses de test de votre choix.</li>
  <li><b>Test immédiat</b> d'un bouton, et <b>fenêtre de détail</b> d'un toucher.</li>
  <li><b>Archivage en CSV</b> (séparateur adapté à Excel français ou anglais), pour montrer du concret à son fournisseur.</li>
  <li>Les mesures continuent même sans tuile affichée.</li>
</ul>

<h4>Ce qui est mesuré, et pourquoi c'est le serveur qui mesure</h4>
          <p>Les relevés sont faits <b>par le serveur PiBoard, en continu</b>, qu'un écran soit allumé ou non, et ils sont <b>partagés par tous vos écrans</b>. C'est le point central de cette tuile : une mesure faite par le navigateur n'existerait que tant que la page est ouverte et repartirait de zéro à chaque rechargement, ce qui priverait la courbe de tout intérêt.</p>
          <p>Chaque relevé (toutes les minutes par défaut) donne trois chiffres :</p>
          <div class="help-opt"><span class="help-opt-name">Latence</span><span class="help-opt-desc">Le temps d'un aller-retour réseau, en millisecondes. La tuile retient la <b>médiane</b> des sondes, pas leur moyenne : un seul aller-retour ralenti par une retransmission ferait bondir une moyenne et afficherait un pic qui ne reflète pas l'état de la ligne.</span></div>
          <div class="help-opt"><span class="help-opt-name">Gigue</span><span class="help-opt-desc">La variation de la latence d'une sonde à la suivante. C'est elle, et non la latence moyenne, qui hache un appel visio.</span></div>
          <div class="help-opt"><span class="help-opt-name">Perte</span><span class="help-opt-desc">La part des sondes restées sans réponse.</span></div>
          <p>Une pastille de couleur résume les trois en quatre états lisibles de loin — <b>Bonne</b>, <b>Moyenne</b>, <b>Mauvaise</b>, <b>Hors ligne</b> — plutôt qu'un score sur 100 qu'il faudrait interpréter. Les seuils sont ceux de la visioconférence, l'usage le plus exigeant d'un foyer.</p>
          <p>Une ligne qui ne répond pas affiche « aucune réponse » <b>et pas « 0 ms »</b> : une latence absente n'est pas une latence nulle, et les confondre annoncerait une connexion excellente pendant une panne.</p>

<h4>Pas de ping système : pourquoi, et ce que ça change</h4>
          <p>La mesure n'utilise pas la commande <code>ping</code>. ICMP réclame des privilèges administrateur sous Linux, et l'appel de la commande diffère d'un système à l'autre — ce serait du code spécifique à une plateforme, ce que PiBoard s'interdit. PiBoard mesure donc le temps d'établissement d'une <b>connexion TCP</b> vers un résolveur DNS public, sur le port 443. C'est identique sur Raspberry Pi, Windows et macOS, et sans aucun privilège particulier.</p>
          <p>Conséquence à connaître : le chiffre obtenu est <b>quelques millisecondes au-dessus</b> d'un ping ICMP classique, puisqu'il inclut la poignée de main TCP. Cela n'a aucune importance pour lire une <i>tendance</i>, mais ne comparez pas directement ce chiffre à celui d'un <code>ping</code> en ligne de commande.</p>

<h4>Tests de débit : rares, et plafonnés</h4>
          <p>Mesurer un débit <b>consomme</b> du débit. Le faire chaque minute saturerait la ligne en permanence et fausserait au passage la mesure de latence. Les tests de débit sont donc espacés — <b>toutes les 3 heures par défaut</b> — et chacun est plafonné <b>deux fois</b> : en volume (jamais plus que ce qu'annoncent les réglages) et en durée (contre une ligne effondrée où 20 Mo mettraient des minutes à descendre). Aux réglages par défaut, cela représente environ 160 Mo par jour ; régler l'intervalle sur <b>0 désactive complètement</b> les tests de débit, la latence continuant d'être mesurée.</p>
          <p>Le débit montant est <b>désactivé par défaut</b> : saturer la voie montante ralentit tout le reste du foyer pendant la durée du test.</p>
          <p>La tuile affiche le <b>dernier débit connu</b>, même s'il date de plusieurs heures, avec son horodatage. Masquer la valeur entre deux mesures laisserait une case vide 99 % du temps, ce qui serait moins utile que de la dater.</p>

<h4>Aucune tuile, aucun trafic</h4>
          <p>Le serveur lit ses réglages dans la tuile elle-même. <b>Tant qu'aucune tuile « Santé Internet » n'est posée sur le tableau, absolument rien n'est mesuré</b> et aucune requête n'est émise. Si plusieurs tuiles de ce type coexistent, la première fait foi : l'historique étant unique et partagé, il n'y a qu'un seul rythme de mesure possible.</p>
          <p>Notez que le réglage « Rafraîchissement de la tuile » ne change <b>que</b> la fréquence à laquelle la tuile relit les relevés. Le rythme de mesure se règle, lui, dans la section « Mesure de la latence ».</p>

<h4>Lancer un test tout de suite</h4>
          <p>Sous l'âge du dernier relevé, le bouton <b>« Tester maintenant »</b> lance un test <b>complet</b> — latence, gigue, pertes et débit — sans attendre le prochain relevé automatique. C'est le geste qu'on veut quand la ligne semble lente : savoir <i>maintenant</i>, et non dans huit minutes.</p>
          <p>Le bouton se désactive et tourne pendant la mesure, qui prend quelques secondes : sans cela, trois clics lanceraient trois tests qui se partageraient la ligne et annonceraient chacun un tiers du débit réel. Un clic dessus n'ouvre pas la fenêtre d'historique, bien que le reste de la tuile le fasse.</p>
          <p>À <b>décocher dans les réglages</b> sur un tableau mural tactile, où un effleurement suffirait à déclencher des tests à répétition — chacun occupe la ligne et fausse la mesure suivante.</p>

<h4>La fenêtre de détail</h4>
          <p><b>Un clic n'importe où sur la tuile</b> ouvre une fenêtre avec la courbe complète : choix de la profondeur (1 h, 6 h, 24 h, 72 h) et de la grandeur affichée (latence, gigue, perte, débit), la valeur courante, les minimum / moyenne / maximum, le nombre de relevés et le taux de <b>disponibilité</b> — c'est ce dernier chiffre que l'on montre à un fournisseur d'accès.</p>
          <p>Les <b>coupures</b> sont signalées par une bande rouge verticale, et le tracé est <b>rompu</b> à cet endroit plutôt que relié : une ligne qui traverse une coupure laisserait croire à une dégradation progressive, alors qu'il n'y avait rien du tout.</p>
          <p>Pour la perte de paquets, l'échelle est fixée de 0 à 100 % ; pour la latence et le débit, qui n'ont pas de maximum naturel, elle s'ajuste au contenu mais <b>toujours depuis zéro</b>, afin que la hauteur du trait reste proportionnelle à la valeur.</p>
          <p>Le bouton <b>Tester maintenant</b> lance immédiatement un relevé complet, débit compris, sans attendre le prochain intervalle.</p>

<h4>Archivage en CSV</h4>
          <p>Le serveur conserve <b>72 heures</b> de relevés. Cette profondeur est volontairement limitée : le fichier vit dans le dossier de données, et donc dans <i>chaque</i> sauvegarde de configuration. La conservation longue durée se fait par l'export CSV, dans un fichier à vous.</p>
          <p>Deux boutons, qui ne répondent pas au même besoin :</p>
          <div class="help-opt"><span class="help-opt-name">Télécharger le CSV</span><span class="help-opt-desc">Téléchargement classique par le navigateur. Pratique depuis un PC qui consulte le tableau à distance.</span></div>
          <div class="help-opt"><span class="help-opt-name">Archiver sur le PiBoard</span><span class="help-opt-desc">Écrit le fichier sur la machine qui héberge PiBoard, dans <code>data/exports/</code>, sous un nom horodaté. Depuis l'écran mural en mode kiosque, un téléchargement atterrirait dans un dossier que personne n'ira jamais ouvrir ; une archive, elle, se retrouve à un chemin connu, récupérable en SSH ou par un partage réseau. Le chemin complet est affiché après l'écriture, et les dernières archives sont listées dans la fenêtre, retéléchargeables d'un clic.</span></div>
          <p>Le fichier propose deux dialectes, et c'est un choix offert plutôt qu'un défaut imposé : un tableur configuré en français attend le <b>point-virgule et la virgule décimale</b> (lui donner un fichier « international » afficherait toute la ligne dans une seule cellule), un outil d'analyse attend l'inverse. Un BOM UTF-8 est ajouté pour que les accents s'affichent correctement sous Windows.</p>
          <p>Colonnes : date ISO, horodatage en millisecondes, latence, gigue, perte, débits descendant et montant, et l'état calculé. Une mesure absente laisse une cellule <b>vide</b>, jamais un zéro : un zéro serait pris pour une mesure réelle.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement de la tuile (secondes)</span><span class="help-opt-desc">Fréquence de relecture des relevés. Ne change pas la fréquence de mesure.</span></div>
<div class="help-opt"><span class="help-opt-name">Profondeur de la courbe (heures)</span><span class="help-opt-desc">De 1 à 72 h, la profondeur conservée par le serveur.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le dernier test de débit sur la tuile</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la courbe de latence sur la tuile</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Bouton « Tester maintenant » sur la tuile</span><span class="help-opt-desc">Lance un test complet sans passer par le panneau d'historique — pratique quand la ligne semble lente et qu'on veut une mesure tout de suite plutôt que d'attendre le prochain relevé automatique. À décocher sur un tableau mural tactile, où un effleurement suffirait à déclencher des tests à répétition : chacun occupe la ligne pendant quelques secondes et fausse la mesure suivante. Activé par défaut.</span></div>
<p class="help-opt-group">Mesure de la latence</p>
<div class="help-opt"><span class="help-opt-name">Intervalle entre deux relevés (secondes)</span><span class="help-opt-desc">Le rythme réel de mesure de la latence, de 30 s à 15 min.</span></div>
<div class="help-opt"><span class="help-opt-name">Sondes par relevé</span><span class="help-opt-desc">De 3 à 10. Le relevé retient leur médiane ; les sondes sans réponse donnent le pourcentage de perte.</span></div>
<div class="help-opt"><span class="help-opt-name">Cibles (hôte:port, séparées par des virgules)</span><span class="help-opt-desc">Résolveurs DNS publics par défaut. 5 au maximum, utilisées à tour de rôle. Port 443 si omis. Par défaut : « 1.1.1.1:443, 8.8.8.8:443, 9.9.9.9:443 ».</span></div>
<p class="help-opt-group">Test de débit</p>
<div class="help-opt"><span class="help-opt-name">Intervalle entre deux tests de débit (minutes)</span><span class="help-opt-desc">0 désactive complètement les tests de débit — la latence continue d'être mesurée. Un test de débit CONSOMME de la bande passante : environ 160 Mo par jour aux réglages par défaut. De 0 à 1440, par défaut 180.</span></div>
<div class="help-opt"><span class="help-opt-name">Volume par test (Mo)</span><span class="help-opt-desc">0 minute désactive les tests. Le volume et la durée sont deux plafonds fermes appliqués simultanément.</span></div>
<div class="help-opt"><span class="help-opt-name">Durée maximale d'un test (secondes)</span><span class="help-opt-desc">Second plafond, contre une ligne effondrée où le volume ci-dessus mettrait des minutes à arriver. De 3 à 30, par défaut 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Mesurer aussi le débit montant</span><span class="help-opt-desc">Désactivé par défaut : saturer la voie montante ralentit tout le reste du foyer pendant la durée du test. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Adresse du test descendant</span><span class="help-opt-desc">Point de mesure gratuit et sans clé de Cloudflare. Remplacez-le par votre propre serveur si vous préférez. Par défaut : « https://speed.cloudflare.com/__down?bytes=200000000 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Adresse du test montant</span><span class="help-opt-desc">Par défaut : « https://speed.cloudflare.com/__up ».</span></div>
<p class="help-opt-group">Archivage CSV</p>
<div class="help-opt"><span class="help-opt-name">Profondeur exportée (heures)</span><span class="help-opt-desc">De 1 à 72, par défaut 24.</span></div>
<div class="help-opt"><span class="help-opt-name">Format du CSV</span><span class="help-opt-desc">Ce que reprennent les deux boutons d'export.</span></div>
`,
        en: `
<span class="help-size">Size: 3×3 by default, from 2×2 to 8×6</span>

<h4>Goal</h4>
<p>Know whether the Internet connection has been good, not just whether it is at the moment you look.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Latency, jitter and packet loss</b> measured continuously by the server, towards targets of your choice.</li>
  <li><b>Latency chart</b> on the tile and over the chosen period (24 h by default).</li>
  <li>Periodic <b>throughput tests</b>, rare and capped (volume, duration), upload optional, to the test addresses of your choice.</li>
  <li><b>Test now</b> with a button, and a <b>detail window</b> with a touch.</li>
  <li><b>CSV archive</b> (separator suited to French or English Excel), to show your provider something concrete.</li>
  <li>Measurements continue even with no tile on screen.</li>
</ul>

<h4>What is measured, and why the server measures it</h4>
          <p>Readings are taken <b>by the PiBoard server, continuously</b>, whether or not a screen is on, and they are <b>shared by all your screens</b>. This is the heart of the tile: a reading taken by the browser would only exist while the page is open and would restart from scratch on every reload, robbing the curve of any point.</p>
          <p>Each reading (every minute by default) yields three figures:</p>
          <div class="help-opt"><span class="help-opt-name">Latency</span><span class="help-opt-desc">The time of a network round trip, in milliseconds. The tile keeps the <b>median</b> of the probes, not their mean: a single round trip slowed by a retransmission would make an average jump and would show a spike that does not reflect the state of the line.</span></div>
          <div class="help-opt"><span class="help-opt-name">Jitter</span><span class="help-opt-desc">The variation of latency from one probe to the next. It is jitter, not average latency, that chops up a video call.</span></div>
          <div class="help-opt"><span class="help-opt-name">Loss</span><span class="help-opt-desc">The share of probes that got no answer.</span></div>
          <p>A coloured dot sums the three up in four states readable across a room — <b>Good</b>, <b>Fair</b>, <b>Poor</b>, <b>Offline</b> — rather than a score out of 100 that would need interpreting. The thresholds are those of video calling, the most demanding household use.</p>
          <p>A line that does not answer shows "no answer" <b>and not "0 ms"</b>: an absent latency is not a zero latency, and confusing the two would announce an excellent connection during an outage.</p>

<h4>No system ping: why, and what it changes</h4>
          <p>The measurement does not use the <code>ping</code> command. ICMP requires administrator privileges on Linux, and invoking the command differs from one system to the next — that would be platform-specific code, which PiBoard forbids itself. PiBoard therefore measures the time to establish a <b>TCP connection</b> to a public DNS resolver, on port 443. This is identical on Raspberry Pi, Windows and macOS, and needs no special privilege.</p>
          <p>Worth knowing: the resulting figure is <b>a few milliseconds above</b> a classic ICMP ping, since it includes the TCP handshake. This does not matter at all for reading a <i>trend</i>, but do not compare this figure directly with a command-line <code>ping</code>.</p>

<h4>Speed tests: rare, and capped</h4>
          <p>Measuring throughput <b>consumes</b> throughput. Doing it every minute would saturate the line permanently and skew the latency reading along the way. Speed tests are therefore spaced out — <b>every 3 hours by default</b> — and each is capped <b>twice</b>: in volume (never more than the settings announce) and in duration (against a collapsed line where 20 MB would take minutes to arrive). At the default settings this is about 160 MB a day; setting the interval to <b>0 switches speed tests off entirely</b>, while latency keeps being measured.</p>
          <p>Upload speed is <b>off by default</b>: saturating the uplink slows down everything else in the home for the duration of the test.</p>
          <p>The tile shows the <b>last known throughput</b>, even hours old, with its timestamp. Hiding the value between two readings would leave an empty box 99% of the time, which would be less useful than dating it.</p>

<h4>No tile, no traffic</h4>
          <p>The server reads its settings from the tile itself. <b>As long as no "Internet health" tile sits on the board, absolutely nothing is measured</b> and no request is issued. If several such tiles coexist, the first one wins: the history being single and shared, there can only be one measurement pace.</p>
          <p>Note that the "Tile refresh" setting only changes how often the tile re-reads the readings. The measurement pace is set in the "Latency measurement" section.</p>

<h4>Running a test right away</h4>
          <p>Under the last reading's age, the <b>"Test now"</b> button runs a <b>full</b> test — latency, jitter, loss and throughput — without waiting for the next automatic reading. That is the gesture one wants when the line feels slow: knowing <i>now</i>, not in eight minutes.</p>
          <p>The button disables itself and spins during the measurement, which takes a few seconds: without that, three clicks would launch three tests sharing the line, each reporting a third of the real throughput. Clicking it does not open the history window, although the rest of the tile does.</p>
          <p><b>Untick it in the settings</b> on a touch wall display, where a brush of the hand would trigger repeated tests — each occupies the line and skews the next reading.</p>

<h4>The detail window</h4>
          <p><b>Clicking anywhere on the tile</b> opens a window with the full curve: choice of depth (1 h, 6 h, 24 h, 72 h) and of the quantity shown (latency, jitter, loss, throughput), the current value, the minimum / average / maximum, the number of readings and the <b>availability</b> rate — that last figure is the one to show an ISP.</p>
          <p><b>Outages</b> are flagged by a vertical red band, and the stroke is <b>broken</b> there rather than bridged: a line crossing an outage would suggest a gradual degradation, when there was nothing at all.</p>
          <p>For packet loss the scale is fixed from 0 to 100%; for latency and throughput, which have no natural maximum, it fits the content but <b>always from zero</b>, so the stroke's height stays proportional to the value.</p>
          <p>The <b>Test now</b> button immediately runs a full reading, throughput included, without waiting for the next interval.</p>

<h4>CSV archiving</h4>
          <p>The server keeps <b>72 hours</b> of readings. That depth is deliberately limited: the file lives in the data folder, and therefore inside <i>every</i> configuration backup. Long-term keeping is done through the CSV export, in a file of your own.</p>
          <p>Two buttons, answering different needs:</p>
          <div class="help-opt"><span class="help-opt-name">Download the CSV</span><span class="help-opt-desc">A classic browser download. Handy from a PC viewing the board remotely.</span></div>
          <div class="help-opt"><span class="help-opt-name">Archive on the PiBoard</span><span class="help-opt-desc">Writes the file on the machine hosting PiBoard, under <code>data/exports/</code>, with a timestamped name. From the wall screen in kiosk mode a download would land in a folder nobody will ever open; an archive, by contrast, sits at a known path, retrievable over SSH or through a network share. The full path is shown after writing, and the latest archives are listed in the window, re-downloadable in one click.</span></div>
          <p>The file offers two dialects, and this is an offered choice rather than an imposed default: a spreadsheet set to French expects the <b>semicolon and the decimal comma</b> (handing it an "international" file would drop the whole row into a single cell), an analysis tool expects the opposite. A UTF-8 BOM is added so accents display correctly on Windows.</p>
          <p>Columns: ISO date, millisecond timestamp, latency, jitter, loss, download and upload throughput, and the computed status. A missing measurement leaves an <b>empty</b> cell, never a zero: a zero would be taken for a real reading.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Tile refresh (seconds)</span><span class="help-opt-desc">How often readings are re-read. Does not change how often they are taken.</span></div>
<div class="help-opt"><span class="help-opt-name">Curve depth (hours)</span><span class="help-opt-desc">From 1 to 72 h, the depth kept by the server.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the last speed test on the tile</span><span class="help-opt-desc">0 minutes switches tests off. Volume and duration are two hard caps applied simultaneously.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the latency curve on the tile</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">"Test now" button on the tile</span><span class="help-opt-desc">Runs a full test without going through the history panel — handy when the line feels slow and you want a reading now rather than waiting for the next automatic one. Untick it on a touch wall display, where a brush of the hand would trigger repeated tests: each one occupies the line for a few seconds and skews the next reading. On by default.</span></div>
<p class="help-opt-group">Latency measurement</p>
<div class="help-opt"><span class="help-opt-name">Interval between two readings (seconds)</span><span class="help-opt-desc">The actual latency measurement pace, from 30 s to 15 min.</span></div>
<div class="help-opt"><span class="help-opt-name">Probes per reading</span><span class="help-opt-desc">From 3 to 10. The reading keeps their median; probes with no answer give the loss percentage.</span></div>
<div class="help-opt"><span class="help-opt-name">Targets (host:port, comma-separated)</span><span class="help-opt-desc">Public DNS resolvers by default. Up to 5, used in turn. Port 443 if omitted. Default: "1.1.1.1:443, 8.8.8.8:443, 9.9.9.9:443".</span></div>
<p class="help-opt-group">Speed test</p>
<div class="help-opt"><span class="help-opt-name">Interval between two speed tests (minutes)</span><span class="help-opt-desc">0 switches speed tests off entirely — latency keeps being measured. A speed test CONSUMES bandwidth: at the default settings it is about 160 MB a day. From 0 to 1440, default 180.</span></div>
<div class="help-opt"><span class="help-opt-name">Volume per test (MB)</span><span class="help-opt-desc">Hard cap: a test will never download more than this. A larger volume gives a more accurate figure on a fast line. From 5 to 100, default 20.</span></div>
<div class="help-opt"><span class="help-opt-name">Time limit per test (seconds)</span><span class="help-opt-desc">Second cap, against a collapsed line where the volume above would take minutes to arrive. From 3 to 30, default 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Also measure upload speed</span><span class="help-opt-desc">Off by default: saturating the uplink slows down everything else in the home for the duration of the test. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Download test address</span><span class="help-opt-desc">Cloudflare's free, keyless speed endpoint. Replace it with your own server if you prefer. Default: "https://speed.cloudflare.com/__down?bytes=200000000".</span></div>
<div class="help-opt"><span class="help-opt-name">Upload test address</span><span class="help-opt-desc">Default: "https://speed.cloudflare.com/__up".</span></div>
<p class="help-opt-group">CSV archiving</p>
<div class="help-opt"><span class="help-opt-name">Depth exported (hours)</span><span class="help-opt-desc">From 1 to 72, default 24.</span></div>
<div class="help-opt"><span class="help-opt-name">CSV format</span><span class="help-opt-desc">What the two export buttons use.</span></div>
`
      }
    },

    {
      id: "youtube",
      group: "tiles",
      title: { fr: "YouTube", en: "YouTube" },
      sub: {
        fr: "Lit des vidéos YouTube dans le lecteur officiel en mode confidentialité avancée.",
        en: "Plays YouTube videos in the official privacy-enhanced player."
      },
      html: {
        fr: `
<p>Cette tuile intègre le <b>lecteur officiel de YouTube en « mode confidentialité avancée »</b> (<code>youtube-nocookie.com</code>). C'est le lecteur que Google fournit aux développeurs pour intégrer des vidéos dans une page — rien n'est contourné, rien n'est piraté, et aucun service tiers n'est impliqué. Il ne dépose pas de cookie de suivi et n'affiche donc pas de publicité personnalisée ; en pratique, aujourd'hui, le plus souvent aucune publicité du tout.</p>
          <p><b>À savoir, honnêtement :</b> ce n'est pas un bloqueur. La tuile n'intercepte rien, elle joue ce que YouTube sert à ce lecteur — et Google reste libre d'y diffuser des annonces demain, ou déjà sur certaines vidéos très monétisées. Si vous appréciez un créateur, les publicités sont une part de ses revenus : un abonnement à sa chaîne, un don ou un achat sont d'autres façons de le soutenir.</p>

<h4>Objectif</h4>
<p>Lire des vidéos YouTube sur le tableau, dans le lecteur officiel en mode confidentialité avancée.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Une vidéo, une playlist</b>, les <b>dernières vidéos d'une chaîne</b> (relues régulièrement), ou une <b>file</b> de vidéos que vous collez.</li>
  <li><b>Lecture</b> : enchaînement automatique, lecture en boucle, démarrage son coupé et qualité au choix.</li>
  <li><b>Changer de vidéo</b> depuis la tuile, sans ouvrir les réglages.</li>
  <li><b>Recherche</b> sur YouTube avec votre propre clé API Google gratuite.</li>
  <li>Sans cookies de suivi ni publicité personnalisée.</li>
</ul>

<h4>Ce qu'on peut lire</h4>
          <div class="help-opt"><span class="help-opt-name">Une vidéo</span><span class="help-opt-desc">Collez son adresse (<code>youtu.be/…</code>, <code>watch?v=…</code>, un Short) ou son identifiant seul.</span></div>
          <div class="help-opt"><span class="help-opt-name">Une playlist</span><span class="help-opt-desc">Collez une adresse contenant <code>list=…</code>. Les vidéos s'enchaînent dans l'ordre de la playlist.</span></div>
          <div class="help-opt"><span class="help-opt-name">Une chaîne</span><span class="help-opt-desc">Collez <code>youtube.com/@nom</code> ou <code>/channel/UC…</code>. La tuile affiche ses dernières vidéos, lues depuis le <b>flux public</b> de la chaîne — sans clé, sans compte, sans quota — et le relit à intervalle réglable pour voir apparaître les nouvelles parutions. C'est l'usage le plus intéressant sur un écran mural : votre chaîne météo, d'actualité ou de votre club, toujours à jour.</span></div>
          <div class="help-opt"><span class="help-opt-name">Une file</span><span class="help-opt-desc">En mode « file », une adresse de vidéo par ligne, lues dans l'ordre. Les lignes commençant par <code>#</code> sont ignorées.</span></div>

<h4>Lecture</h4>
          <p>La tuile s'ouvre sur une affiche avec un bouton Lecture : c'est ce clic qui autorise le navigateur à jouer le son. Ensuite, les commandes habituelles du lecteur YouTube (pause, volume, plein écran, sous-titres) restent disponibles, et les boutons ◀ ▶ passent d'une vidéo à l'autre. Une vidéo supprimée, privée ou dont l'auteur interdit l'intégration est simplement sautée.</p>

<h4>Changer de vidéo sans ouvrir les réglages</h4>
          <p>Le bouton <b>Lien…</b>, dans la barre sous le lecteur, ouvre une petite fenêtre où coller une adresse YouTube (vidéo, playlist ou chaîne) et basculer <i>Enchaîner</i>, <i>Boucle</i> et <i>Muet</i>. C'est fait pour l'usage devant l'écran, à la souris ou au doigt, sans passer en mode configuration.</p>
          <p>Quand plusieurs vidéos sont en file, la liste s'affiche sous le lecteur. Le petit bouton ▾ de la barre la <b>replie entièrement</b> : elle n'est utile que le temps de choisir, et la vidéo mérite le reste de la tuile. Le choix est mémorisé, y compris après un rechargement.</p>
          <p>Ce choix ne modifie pas les réglages de la tuile : ceux-ci restent la référence, et le bouton <b>Revenir à la source configurée</b> y ramène d'un clic. Il survit en revanche à un rechargement de la page — sinon le tableau reviendrait à sa source d'origine dès le prochain réveil du Pi. Les bascules, elles, ne valent que pour la session.</p>

<h4>Rechercher sur YouTube</h4>
          <p>La barre de recherche, sous le lecteur, ouvre une <b>fenêtre plein écran</b> de résultats — une grille de vignettes, comme la grille complète du Programme TV. On y choisit une vidéo à l'image plus qu'au titre, ce qu'une tuile ne permettrait pas. La fenêtre propose un tri (les plus pertinentes, les plus récentes, les plus vues) et des pages Précédente / Suivante. Toucher un résultat le lit dans la tuile ; toute la page de résultats devient alors la file, et les boutons ◀ ▶ passent d'un résultat à l'autre sans rouvrir la fenêtre. Rien n'est enregistré : la source configurée revient au prochain lien collé ou au prochain rechargement.</p>
          <p>La recherche passe par l'API de Google et nécessite <b>votre propre clé API</b>. Sans clé, la fenêtre l'explique au lieu de rester vide. La clé est stockée chiffrée sur le serveur de PiBoard et n'est jamais renvoyée au navigateur.</p>

<h4>Obtenir une clé YouTube Data API v3</h4>
          <p>La procédure est gratuite et prend quelques minutes. Elle passe par Google Cloud, ce qui impressionne un peu la première fois, mais il ne s'agit que de créer un projet vide, d'y activer une API et d'en tirer une clé — aucune facturation n'est demandée.</p>
          <ol class="help-steps">
            <li><b>Créer un projet.</b> Ouvrez <code>console.cloud.google.com</code> et connectez-vous avec votre compte Google. Cliquez sur le sélecteur de projet en haut de la page, puis sur <b>Nouveau projet</b> ; donnez-lui un nom (par exemple <i>YouTube-Data-API</i>), cliquez sur <b>Créer</b>, puis sélectionnez ce projet.</li>
            <li><b>Activer l'API.</b> Dans la bibliothèque d'API, ouvrez la page de <b>YouTube Data API v3</b>, vérifiez que le bon projet est sélectionné et cliquez sur <b>Activer</b>. Attendez la fin de l'activation : l'API doit être active dans le projet pour qu'une clé y fonctionne. C'est l'oubli le plus courant — une clé créée avant l'activation donne des erreurs et semble « invalide » alors qu'elle est bonne.</li>
            <li><b>Créer la clé.</b> Allez dans <b>API et services → Identifiants</b>, cliquez sur <b>+ Créer des identifiants</b> puis sur <b>Clé API</b>. Google affiche aussitôt la clé : copiez-la et collez-la dans le champ « Clé API Google » des réglages de cette tuile.</li>
            <li><b>Restreindre la clé</b> (fortement conseillé). Toujours dans les identifiants, ouvrez <b>Modifier la clé API</b>. Sous <b>Restrictions relatives aux API</b>, choisissez <i>Restreindre la clé</i> et ne cochez que <b>YouTube Data API v3</b> : même divulguée, la clé ne servirait à rien d'autre. Sous <b>Restrictions relatives aux applications</b>, le choix dépend de votre installation : pour PiBoard, les requêtes partent du serveur, donc la restriction pertinente est <b>Adresses IP</b> avec l'adresse IP <i>publique</i> de votre connexion — à condition qu'elle soit fixe. Si votre fournisseur la change régulièrement, laissez cette partie libre et contentez-vous de la restriction d'API, sinon la recherche cessera de fonctionner au prochain changement d'adresse.</li>
          </ol>
          <p><b>Ne publiez jamais cette clé</b> : ni dans un dépôt GitHub, ni dans une capture d'écran, ni dans du JavaScript envoyé au navigateur. Dans PiBoard elle ne quitte pas le serveur, mais elle reste lisible par quiconque a accès à votre compte Google Cloud — en cas de doute, supprimez-la depuis les identifiants et créez-en une autre, c'est instantané.</p>
          <p><b>Le quota.</b> L'API est gratuite dans la limite de 10 000 unités par jour, remises à zéro à minuit heure du Pacifique. Une page de résultats de recherche coûte 100 unités, soit environ <b>cent pages par jour</b> — largement assez pour un usage domestique, mais pas de quoi feuilleter sans fin. Quota épuisé, la recherche répond en erreur jusqu'au lendemain ; la lecture des vidéos, des playlists et des chaînes, elle, n'est pas concernée du tout : elle n'utilise pas l'API.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Quoi lire</span><span class="help-opt-desc">Choix : Une vidéo, une playlist ou une chaîne, Une file de vidéos que je colle. Par défaut : Une vidéo, une playlist ou une chaîne.</span></div>
<div class="help-opt"><span class="help-opt-name">Vidéo, playlist ou chaîne</span><span class="help-opt-desc">Collez n'importe quelle adresse YouTube : une vidéo (youtu.be/… ou watch?v=…), une playlist (…list=PL…) ou une chaîne (youtube.com/@nom ou /channel/UC…). Une chaîne affiche ses dernières vidéos, lues depuis son flux public — aucune clé nécessaire.</span></div>
<div class="help-opt"><span class="help-opt-name">File (une adresse par ligne)</span><span class="help-opt-desc">Utilisé uniquement en mode file. Une adresse ou un identifiant de vidéo par ligne, lus dans l'ordre. Les lignes commençant par # sont ignorées. 50 au maximum.</span></div>
<div class="help-opt"><span class="help-opt-name">Vidéos listées pour une chaîne ou une playlist</span><span class="help-opt-desc">Combien de vidéos d'une chaîne ou d'une playlist sont affichées sous le lecteur (15 au plus, la limite du flux public).</span></div>
<div class="help-opt"><span class="help-opt-name">Enchaîner la vidéo suivante à la fin</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Recommencer après la dernière</span><span class="help-opt-desc">Pour laisser tourner une playlist ou une chaîne en continu.</span></div>
<div class="help-opt"><span class="help-opt-name">Démarrer en muet</span><span class="help-opt-desc">Pour un écran mural où le son gênerait ; le lecteur permet de le rétablir à tout moment.</span></div>
<div class="help-opt"><span class="help-opt-name">Relire une chaîne ou une playlist toutes les (minutes)</span><span class="help-opt-desc">Récupère les vidéos nouvellement publiées. Rien n'est rechargé pendant qu'une vidéo est en lecture. De 5 à 1440, par défaut 30.</span></div>
<div class="help-opt"><span class="help-opt-name">Qualité vidéo par défaut</span><span class="help-opt-desc">Une <b>demande</b>, pas un ordre : YouTube garde le dernier mot et choisit selon le débit disponible et la taille réelle du lecteur — une petite tuile n'obtiendra pas du 1080p quoi qu'on demande, et « la plus élevée possible » ne fera pas de miracle sur une connexion lente. L'option est surtout utile dans l'autre sens : plafonner à 480p ou 360p pour ménager une connexion partagée ou un Raspberry Pi ancien. Pour gagner en qualité, agrandir la tuile est bien plus efficace que ce réglage.</span></div>
<div class="help-opt"><span class="help-opt-name">Clé API Google (facultative, pour la recherche)</span><span class="help-opt-desc">Ajoute une recherche dans la tuile. Gratuit, quelques minutes : créez un projet sur console.cloud.google.com, activez « YouTube Data API v3 » DANS ce projet, puis créez une clé API dans les identifiants. Pensez à restreindre la clé à cette seule API. Le quota gratuit permet une centaine de pages de résultats par jour. Stockée chiffrée, jamais renvoyée au navigateur. La marche à suivre détaillée est dans l'aide de la tuile. Nature : &lt;b&gt;clé de service&lt;/b&gt; — elle identifie PiBoard auprès d'un fournisseur, pas vous. Un clone peut l'emporter sans risque personnel.</span></div>
`,
        en: `
<p>This tile embeds <b>YouTube's official player in "privacy-enhanced mode"</b> (<code>youtube-nocookie.com</code>). It is the player Google provides to developers for embedding videos in a page — nothing is bypassed, nothing is hacked, and no third-party service is involved. It sets no tracking cookie and therefore shows no personalized advertising; in practice, today, most often no advertising at all.</p>
          <p><b>Worth knowing, honestly:</b> this is not a blocker. The tile intercepts nothing, it plays what YouTube serves to that player — and Google remains free to run ads there tomorrow, or already on some heavily monetized videos. If you value a creator, ads are part of their income: subscribing to their channel, a donation or a purchase are other ways to support them.</p>

<h4>Goal</h4>
<p>Play YouTube videos on the board, in the official player in privacy-enhanced mode.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>A video, a playlist</b>, a <b>channel's latest videos</b> (re-read regularly), or a <b>queue</b> of videos you paste.</li>
  <li><b>Playback</b>: autoplay next, loop, start muted and quality of your choice.</li>
  <li><b>Change video</b> from the tile, without opening the settings.</li>
  <li><b>Search</b> YouTube with your own free Google API key.</li>
  <li>No tracking cookies or personalised ads.</li>
</ul>

<h4>What can be played</h4>
          <div class="help-opt"><span class="help-opt-name">A video</span><span class="help-opt-desc">Paste its address (<code>youtu.be/…</code>, <code>watch?v=…</code>, a Short) or its bare id.</span></div>
          <div class="help-opt"><span class="help-opt-name">A playlist</span><span class="help-opt-desc">Paste an address containing <code>list=…</code>. Videos play in the playlist's order.</span></div>
          <div class="help-opt"><span class="help-opt-name">A channel</span><span class="help-opt-desc">Paste <code>youtube.com/@name</code> or <code>/channel/UC…</code>. The tile shows its latest videos, read from the channel's <b>public feed</b> — no key, no account, no quota — and re-reads it at an adjustable interval so new releases show up. This is the most interesting use on a wall display: your weather, news or club channel, always current.</span></div>
          <div class="help-opt"><span class="help-opt-name">A queue</span><span class="help-opt-desc">In "queue" mode, one video address per line, played in order. Lines starting with <code>#</code> are ignored.</span></div>

<h4>Playback</h4>
          <p>The tile opens on a poster with a Play button: that click is what lets the browser play sound. Afterwards the usual YouTube controls (pause, volume, full screen, captions) remain available, and the ◀ ▶ buttons move between videos. A removed or private video, or one whose author forbids embedding, is simply skipped.</p>

<h4>Changing video without opening the settings</h4>
          <p>The <b>Link…</b> button, in the bar under the player, opens a small panel where you can paste a YouTube address (video, playlist or channel) and flip <i>Play next</i>, <i>Loop</i> and <i>Muted</i>. It is made for use in front of the screen, by mouse or finger, without going into configuration mode.</p>
          <p>When several videos are queued, the list shows under the player. The bar's small ▾ button <b>folds it away entirely</b>: it is only useful long enough to pick, and the video deserves the rest of the tile. The choice is remembered, reloads included.</p>
          <p>That choice does not modify the tile's settings: they remain the reference, and the <b>Back to the configured source</b> button returns to them in one click. It does survive a page reload though — otherwise the board would revert to its original source at the Pi's next wake-up. The toggles, on the other hand, only last for the session.</p>

<h4>Searching YouTube</h4>
          <p>The search bar under the player opens a <b>full-screen window</b> of results — a grid of thumbnails, like the TV guide's full grid. You pick a video by its picture more than by its title, which a tile could not allow. The window offers a sort order (most relevant, most recent, most viewed) and Previous / Next pages. Tapping a result plays it in the tile; the whole results page then becomes the queue, and the ◀ ▶ buttons move between results without reopening the window. Nothing is saved: the configured source returns with the next pasted link or the next reload.</p>
          <p>Searching goes through Google's API and needs <b>your own API key</b>. Without a key the window explains that instead of staying empty. The key is stored encrypted on PiBoard's server and is never sent back to the browser.</p>

<h4>Getting a YouTube Data API v3 key</h4>
          <p>The procedure is free and takes a few minutes. It goes through Google Cloud, which looks daunting the first time, but it only amounts to creating an empty project, enabling one API in it and taking a key from it — no billing is asked for.</p>
          <ol class="help-steps">
            <li><b>Create a project.</b> Open <code>console.cloud.google.com</code> and sign in with your Google account. Click the project selector at the top of the page, then <b>New project</b>; give it a name (for instance <i>YouTube-Data-API</i>), click <b>Create</b>, then select that project.</li>
            <li><b>Enable the API.</b> In the API library, open the <b>YouTube Data API v3</b> page, check that the right project is selected and click <b>Enable</b>. Wait for it to finish: the API must be active in the project for a key to work there. This is the most common omission — a key created before enabling gives errors and looks "invalid" when it is in fact fine.</li>
            <li><b>Create the key.</b> Go to <b>APIs &amp; Services → Credentials</b>, click <b>+ Create credentials</b> then <b>API key</b>. Google shows the key at once: copy it and paste it into the "Google API key" field of this tile's settings.</li>
            <li><b>Restrict the key</b> (strongly advised). Still in the credentials, open <b>Edit API key</b>. Under <b>API restrictions</b>, choose <i>Restrict key</i> and tick only <b>YouTube Data API v3</b>: even if leaked, the key would be good for nothing else. Under <b>Application restrictions</b>, the choice depends on your setup: with PiBoard the requests leave from the server, so the relevant restriction is <b>IP addresses</b> with your connection's <i>public</i> IP address — provided it is fixed. If your provider changes it regularly, leave that part open and rely on the API restriction alone, otherwise searching will stop working at the next address change.</li>
          </ol>
          <p><b>Never publish this key</b>: not in a GitHub repository, not in a screenshot, not in JavaScript sent to the browser. Inside PiBoard it never leaves the server, but it stays readable by anyone with access to your Google Cloud account — when in doubt, delete it from the credentials and create another, it is instant.</p>
          <p><b>The quota.</b> The API is free within 10,000 units a day, reset at midnight Pacific time. One page of search results costs 100 units, so about <b>a hundred pages a day</b> — plenty for home use, but not endless browsing. Once the quota is used up, searching answers with an error until the next day; playing videos, playlists and channels is not affected at all, as it does not use the API.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">What to play</span><span class="help-opt-desc">Choices: A video, a playlist or a channel, A queue of videos I paste. Default: A video, a playlist or a channel.</span></div>
<div class="help-opt"><span class="help-opt-name">Video, playlist or channel</span><span class="help-opt-desc">Paste any YouTube address: a video (youtu.be/… or watch?v=…), a playlist (…list=PL…), or a channel (youtube.com/@name or /channel/UC…). A channel shows its latest videos, from its public feed — no key needed.</span></div>
<div class="help-opt"><span class="help-opt-name">Queue (one address per line)</span><span class="help-opt-desc">Only used in queue mode. One video address or id per line, played in order. Lines starting with # are ignored. Up to 50.</span></div>
<div class="help-opt"><span class="help-opt-name">Videos listed for a channel or playlist</span><span class="help-opt-desc">How many videos of a channel or playlist are shown under the player (15 at most, the public feed's limit).</span></div>
<div class="help-opt"><span class="help-opt-name">Play the next video when one ends</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Start over after the last one</span><span class="help-opt-desc">To let a playlist or a channel run continuously.</span></div>
<div class="help-opt"><span class="help-opt-name">Start muted</span><span class="help-opt-desc">For a wall display where sound would be a nuisance; the player can unmute at any time.</span></div>
<div class="help-opt"><span class="help-opt-name">Re-read a channel or playlist every (minutes)</span><span class="help-opt-desc">Picks up newly published videos. Nothing is reloaded while a video is playing. From 5 to 1440, default 30.</span></div>
<div class="help-opt"><span class="help-opt-name">Default video quality</span><span class="help-opt-desc">A <b>request</b>, not an order: YouTube has the final say and picks from available bandwidth and the player's real size — a small tile will not get 1080p whatever is asked, and "highest available" works no miracles on a slow connection. The option is most useful the other way round: capping at 480p or 360p to spare a shared connection or an older Raspberry Pi. To gain quality, enlarging the tile is far more effective than this setting.</span></div>
<div class="help-opt"><span class="help-opt-name">Google API key (optional, for search)</span><span class="help-opt-desc">Adds a search box to the tile. Free, a few minutes: create a project on console.cloud.google.com, enable "YouTube Data API v3" IN that project, then create an API key in the credentials. Remember to restrict the key to that one API. The free quota allows about a hundred result pages a day. Stored encrypted, never sent back to the browser. The detailed procedure is in the tile's help. Nature: &lt;b&gt;service key&lt;/b&gt; — it identifies PiBoard to a provider, not you. A clone can carry it with no personal risk.</span></div>
`
      }
    },

    {
      id: "library",
      group: "presentation",
      title: { fr: "Bibliothèque d'images", en: "Image library" },
      sub: {
        fr: "Fonds de page, logos et photos livrés avec PiBoard, que vous pouvez enrichir.",
        en: "Page backgrounds, logos and photos shipped with PiBoard, which you can extend."
      },
      html: {
        fr: `
          <p>PiBoard est livré avec une petite bibliothèque d'images, accessible partout où l'on choisit une image : le <b>fond d'une page</b>, la tuile <b>Logo</b>, et les photos du <b>diaporama</b>. Le bouton <b>« Bibliothèque… »</b> l'ouvre. Trois sections : fonds de page, logos et icônes, photos.</p>
          <h4>Deux origines, et pourquoi ça compte</h4>
          <p>La bibliothèque mélange deux choses à l'affichage, mais elles vivent à des endroits très différents :</p>
          <div class="help-opt"><span class="help-opt-name">Les images livrées</span><span class="help-opt-desc">Elles font partie de l'application et s'enrichissent à chaque mise à jour. Vous ne pouvez pas les supprimer — elles reviendraient à la mise à jour suivante, ce qui serait déroutant — mais vous pouvez les <b>masquer</b> : elles cessent simplement d'être proposées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Vos images</span><span class="help-opt-desc">« Ajouter mes images… » les range à côté de vos réglages et de vos photos. Elles <b>survivent aux mises à jour</b> et sont reprises par vos sauvegardes. Vous pouvez les supprimer pour de bon.</span></div>
          <p>Vous pouvez aussi déposer des fichiers directement dans <code>data/library/backgrounds/</code> (ou <code>logos/</code>, <code>photos/</code>) depuis un partage réseau : ils apparaissent sans rien lancer, avec leur nom de fichier pour libellé.</p>
          <h4>Plus d'images en ligne</h4>
          <p>Le lot livré reste volontairement léger : il voyage dans l'installeur Windows, le paquet Linux, le .dmg et l'archive du Pi. Le bouton <b>« Plus en ligne… »</b> montre le reste du catalogue, et chaque image se télécharge <b>à la demande</b>, une par une, dans votre bibliothèque personnelle. Rien n'est rapatrié automatiquement : une connexion modeste n'a pas à subir un téléchargement que vous n'avez pas demandé. Une fois récupérée, l'image ne dépend plus du réseau.</p>
          <h4>Ce qui se passe quand vous choisissez une image</h4>
          <p>Elle est <b>copiée</b> dans le dossier de la tuile ou de la page, pas simplement référencée. C'est volontaire : une page ne doit pas se retrouver nue parce que l'image a été retirée de la bibliothèque ou renommée par une mise à jour. Le prix est quelques méga-octets dupliqués, sans commune mesure avec un tableau mural qui se viderait tout seul.</p>`,
        en: `
          <p>PiBoard ships with a small image library, reachable everywhere an image is picked: a <b>page background</b>, the <b>Logo</b> tile, and the <b>slideshow</b>'s photos. The <b>"Library…"</b> button opens it. Three sections: page backgrounds, logos and icons, photos.</p>
          <h4>Two origins, and why it matters</h4>
          <p>The library mixes two things on screen, but they live in very different places:</p>
          <div class="help-opt"><span class="help-opt-name">Shipped images</span><span class="help-opt-desc">They are part of the application and grow with every update. You cannot delete them — they would come back with the next update, which would be confusing — but you can <b>hide</b> them: they simply stop being offered.</span></div>
          <div class="help-opt"><span class="help-opt-name">Your images</span><span class="help-opt-desc">"Add my images…" files them next to your settings and your photos. They <b>survive updates</b> and are picked up by your backups. You can delete them for good.</span></div>
          <p>You can also drop files straight into <code>data/library/backgrounds/</code> (or <code>logos/</code>, <code>photos/</code>) from a network share: they show up with nothing to run, with their file name as their label.</p>
          <h4>More images online</h4>
          <p>The shipped lot stays deliberately light: it travels inside the Windows installer, the Linux package, the .dmg and the Pi archive. The <b>"More online…"</b> button shows the rest of the catalogue, and each image downloads <b>on demand</b>, one at a time, into your personal library. Nothing is fetched automatically: a modest connection should not suffer a download you did not ask for. Once fetched, the image no longer depends on the network.</p>
          <h4>What happens when you pick an image</h4>
          <p>It is <b>copied</b> into the tile's or the page's folder, not merely referenced. That is deliberate: a page must not end up bare because the image was removed from the library or renamed by an update. The price is a few duplicated megabytes, nothing next to a wall board emptying itself.</p>`
      }
    },

    /* ================= STATUT DE SERVICE / SERVICE STATUS ================= */
    {
      id: "servicestatus",
      group: "tiles",
      title: { fr: "Statut de service", en: "Service status" },
      sub: {
        fr: "GitHub est-il en panne, ou est-ce moi ?",
        en: "Is GitHub down, or is it me?"
      },
      html: {
        fr: `
<span class="help-size">Taille : 4×4 par défaut, de 3×3 à 12×16</span>

<h4>Objectif</h4>
<p>Répondre à la question qu'on se pose quand quelque chose ne marche plus : est-ce chez moi, ou chez eux ?</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Catalogue</b> d'environ quatre-vingts services à cocher par famille (AWS, Google Cloud, Azure, OVHcloud, GitHub, Cloudflare, OpenAI, Anthropic, opérateurs français…), plus toute page de statut ajoutée à la main.</li>
  <li><b>État global</b> en quatre icônes, et en cas de problème : composants touchés, stade et ancienneté de l'incident, dernier message du service et lien.</li>
  <li><b>Quatre modes d'affichage</b>, services <b>rangés par famille</b>, et <b>vos zones</b> géographiques pour ne garder que ce qui vous concerne.</li>
  <li><b>Maintenances programmées</b> signalées.</li>
  <li><b>Alerte</b> à l'apparition d'un incident (flash, son, durée, webhook), avec une cloche pour choisir quels services peuvent vous réveiller.</li>
  <li><b>Vérification</b> à intervalle réglable, plus rapide pendant un incident ; catalogue tenu à jour depuis le dépôt public, sans attendre une version.</li>
</ul>

<h4>Choisir les services : un catalogue a cocher</h4>
          <p>Les services se choisissent dans une <b>liste déroulante à cases à cocher</b>, rangée par familles — cloud et hébergement, développement et DevOps, SaaS et collaboration, paiement et messagerie, observabilité, IA et modèles, stockage et partage de fichiers, France (opérateurs et services) — avec une <b>recherche</b> qui filtre sur le nom comme sur le domaine. Le catalogue livré compte près de quatre-vingts entrées, dont une famille <b>stockage et partage de fichiers</b> (Dropbox, Box, Proton Drive, WeTransfer, Infomaniak, Backblaze, MEGA, pCloud) : AWS, Google Cloud, Azure, OVHcloud, Scaleway, Cloudflare, GitHub, GitLab, npm, Docker Hub, Slack, Zoom, Google Workspace, Stripe, Twilio, Datadog, Sentry, OpenAI, Anthropic, Mistral, Free, Orange, Gandi, Qonto…</p>
          <p>Les familles sont <b>pliées</b> au départ, sauf celles qui contiennent déjà un service coché : c'est ce qui permet de retrouver ses propres choix sans faire défiler soixante lignes. Une recherche déplie tout, le temps de la recherche. <b>25 services au maximum</b> — un plafond de lisibilité, pas de réseau.</p>

<h4>Ajouter un service absent du catalogue</h4>
          <p>Le bouton <b>« + Ajouter un autre service »</b> accepte n'importe quelle page de statut publique : un fournisseur interne, une page trop récente pour être listée, celle d'un client. L'adresse est <b>sondée sur le champ</b> et le format trouvé vous est annoncé (<code>Reconnu : format statuspage</code>) — donc vous savez <b>avant d'enregistrer</b> si la page est lisible, au lieu de le découvrir trois heures plus tard devant une ligne grise. Le champ texte <b>« Services supplémentaires, à la main »</b>, dans la section <i>Avancé</i>, reste disponible et garde l'ancienne grammaire <code>Nom = adresse</code>, <code>#</code> compris pour désactiver une ligne.</p>

<h4>Quinze formats de pages de statut, et deux honnêtes</h4>
          <p><code>githubstatus.com</code> n'est pas une page maison : c'est une <b>Statuspage</b> d'Atlassian, employée par des centaines d'éditeurs, toutes exposant la même API publique au même endroit, sans clé ni compte. C'est le format le plus riche — le seul qui donne l'état de <b>chaque composant</b>. Mais AWS, Google Cloud et Azure, soit exactement les services qu'on veut surveiller en premier, ne l'emploient pas — et plusieurs fournisseurs ont depuis quitté Statuspage pour une page maison. PiBoard lit donc quinze formats :</p>
          <div class="help-opt"><span class="help-opt-name">Statuspage (Atlassian)</span><span class="help-opt-desc">État global, état par composant, incidents et maintenances. Le plus complet.</span></div>
          <div class="help-opt"><span class="help-opt-name">Instatus</span><span class="help-opt-desc">Concurrent direct, employé par une partie des jeunes éditeurs.</span></div>
          <div class="help-opt"><span class="help-opt-name">Google</span><span class="help-opt-desc">Google Cloud et Google Workspace. Les produits touchés tiennent le rôle des composants.</span></div>
          <div class="help-opt"><span class="help-opt-name">AWS Health</span><span class="help-opt-desc">Avec la <b>région</b> concernée : une panne sur <code>ap-southeast-2</code> ne vous concerne pas si vous travaillez sur <code>eu-west-1</code>.</span></div>
          <div class="help-opt"><span class="help-opt-name">Status.io</span><span class="help-opt-desc">Le troisième éditeur, derrière Atlassian et Instatus. C'est celui de <b>GitLab</b>.</span></div>
          <div class="help-opt"><span class="help-opt-name">Better Stack</span><span class="help-opt-desc">Le quatrième éditeur. C'est celui de <b>Hugging Face</b>.</span></div>
          <div class="help-opt"><span class="help-opt-name">Backblaze</span><span class="help-opt-desc">Format maison. Ses composants ne portent aucun état : seuls les incidents ouverts disent quelque chose.</span></div>
          <div class="help-opt"><span class="help-opt-name">Heroku</span><span class="help-opt-desc">Trois systèmes (Apps, Data, Tools), un feu tricolore chacun, plus les maintenances.</span></div>
          <div class="help-opt"><span class="help-opt-name">Slack</span><span class="help-opt-desc">Format maison, sur <code>slack-status.com</code> où <code>status.slack.com</code> redirige.</span></div>
          <div class="help-opt"><span class="help-opt-name">PagerDuty</span><span class="help-opt-desc">Leur propre produit de pages de statut. L'API ne rend que ce qui va mal : liste vide = tout opérationnel.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zendesk</span><span class="help-opt-desc">Format maison. L'état se lit sur les incidents du jour, d'où la date dans l'adresse.</span></div>
          <div class="help-opt"><span class="help-opt-name">PayPal</span><span class="help-opt-desc">API maison. Seule la <b>production</b> est surveillée : une sandbox en panne ne doit pas faire rougir la tuile pendant que les paiements réels passent. Les briques qui n'existent qu'en sandbox (Braintree Sandbox, Paydiant…) ne sont pas affichées du tout — elles n'ont pas de production, ce qui n'est pas la même chose qu'un état qu'on ne comprend pas.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fastly</span><span class="help-opt-desc">Format maison depuis leur départ de Statuspage.</span></div>
          <div class="help-opt"><span class="help-opt-name">Vultr</span><span class="help-opt-desc">Format maison, rangé par <b>région</b>.</span></div>
          <div class="help-opt"><span class="help-opt-name">RSS</span><span class="help-opt-desc">Azure et tous les « travaux.* ». État <b>déduit</b>, voir ci-dessous.</span></div>
          <div class="help-opt"><span class="help-opt-name">Endpoint</span><span class="help-opt-desc">Pour les services qui ne publient <b>rien</b> : pCloud, Alibaba Cloud, Hetzner, SFR. État <b>déduit</b>, voir ci-dessous.</span></div>
          <p>Un flux RSS ne dit jamais « je vais bien » : il publie des billets datés. L'état est donc <b>déduit</b> — aucun billet depuis 24 h vaut « sain », un billet récent vaut « dégradation mineure », jamais plus, car le flux ne contient pas l'information qui justifierait un rouge. Ces services portent un <b>tilde</b> <code>~</code> à côté de leur état : il dit que l'état est déduit et non déclaré par le fournisseur. Un silence n'est pas une bonne nouvelle, et les deux ne doivent pas se ressembler à l'écran.</p>
          <p><b>L'adaptateur « Endpoint » mesure autre chose, et il faut le savoir.</b> Certains services ne publient aucune page lisible par une machine : ni API, ni flux, rien. pCloud en est l'exemple — tout ce qu'on trouve à son sujet vient de sondes extérieures, pas de pCloud. Le choix est alors entre ne rien dire du tout et mesurer ce qu'on <i>peut</i> mesurer : la joignabilité de leur API publique <b>depuis votre Pi</b> — et c'est le <b>service</b> qui est interrogé, jamais sa page de statut : une page de statut qui répond ne dit rien du service qu'elle décrit. Ce n'est pas la parole du fournisseur. « Joignable depuis chez vous » n'est pas « le fournisseur déclare aller bien », et un échec peut venir de votre connexion, de votre DNS, d'un câble sous-marin : c'est pourquoi un échec ne dépasse jamais la <b>dégradation mineure</b>, et pourquoi ces services portent eux aussi le <b>tilde</b>.</p>
          <p>Les services du catalogue déclarent leur format, ce qui évite de sonder plusieurs adresses par service à chaque relevé. Pour une adresse saisie à la main, le format est deviné par sondage, dans l'ordre : Statuspage, Instatus, Better Stack, Google, Fastly, Vultr, PayPal, RSS. <b>« Endpoint » n'est jamais sondé</b> : il réussirait sur n'importe quelle adresse joignable, donc il gagnerait toujours, et tout service deviendrait « sain, déduit » au lieu d'être lu pour de bon.</p>

<h4>Un catalogue qui se corrige sans attendre une version de PiBoard</h4>
          <p>Les fournisseurs <b>déménagent</b> leur page de statut et <b>changent de format</b> plusieurs fois par an : en quelques semaines, Fastly, Vultr, PayPal, GitLab, Hugging Face, Backblaze, Heroku, Slack, PagerDuty et Zendesk ont tous quitté la Statuspage d'Atlassian pour une page maison. Neuf fois sur dix, ce qui change n'est pas le <i>programme</i> mais une <i>donnée</i> : une adresse, un format à déclarer, une entrée à retirer.</p>
          <p>Le catalogue vit donc <b>hors du code</b>. PiBoard lit celui du <b>dépôt public</b> (toutes les 12 h) en plus de celui livré avec la version installée, et garde le plus récent des deux. Une page qui déménage devient une ligne de JSON poussée sur le dépôt, corrigée pour tout le monde dans la demi-journée — sans nouvelle version, sans réinstallation, et sans que vous ayez à décocher puis recocher quoi que ce soit.</p>
          <p><b>Ce que PiBoard ne fait pas, et c'est délibéré.</b> La tuile ne dépend jamais du réseau : le catalogue livré avec la version est toujours là et sert de repli définitif, le dernier bon catalogue reçu est conservé sur le disque, et si le dépôt est injoignable rien ne change à l'écran. Le catalogue distant n'est jamais cru sur parole : il dicte des adresses que le serveur ira interroger, il est donc <b>entièrement vérifié avant d'être retenu</b> — adresses publiques en HTTPS uniquement, jamais une adresse interne, formats connus de <i>votre</i> version — et <b>rejeté en bloc</b> à la première anomalie, parce qu'un fichier à moitié bon serait pire qu'un fichier refusé : on ne saurait pas quelle moitié. Enfin il ne <b>recule</b> jamais : un catalogue distant qui n'est pas plus récent que celui en place est ignoré, sinon un dépôt revenu en arrière par accident effacerait des corrections déjà appliquées.</p>
          <p>Le réglage <b>« Tenir la liste des services à jour depuis le dépôt »</b> coupe tout cela : décoché, PiBoard s'en tient au catalogue de la version installée. C'est le bon choix pour un kiosque sans Internet ou sur un réseau fermé. Rien n'est jamais envoyé : seul le fichier du catalogue est lu.</p>

<h4>Le catalogue est la vérité, votre réglage dit seulement « celui-là »</h4>
          <p>Quand vous cochez un service, PiBoard n'enregistre que son <b>identifiant</b> : l'adresse et le format sont relus dans le catalogue à chaque démarrage. C'est ce qui fait qu'une <b>correction de catalogue arrive toute seule</b> sur un tableau déjà réglé — un fournisseur qui déménage sa page de statut, un format maison qui remplace une Statuspage, et la tuile suit sans que vous retouchiez quoi que ce soit. Les services ajoutés à la main, eux, gardent exactement ce que vous avez saisi : ils n'ont pas d'entrée au catalogue, et personne d'autre que vous ne décide de leur adresse.</p>

<h4>Quand un service ne s'affiche pas : trois messages, trois causes</h4>
          <p>Une page qui ne rend pas d'état peut le faire pour trois raisons sans rapport, et la tuile les distingue — les confondre envoie chercher une panne de réseau pour un problème d'adresse.</p>
          <div class="help-opt"><span class="help-opt-name">Page de statut injoignable</span><span class="help-opt-desc">Personne n'a répondu : DNS, coupure, délai dépassé. À vérifier : votre réseau.</span></div>
          <div class="help-opt"><span class="help-opt-name">La page a refusé la requête (HTTP 403, 404…)</span><span class="help-opt-desc">Le serveur répond, mais pas à cette adresse. À vérifier : l'adresse. Le code est affiché, parce que 403 et 404 n'appellent pas la même vérification.</span></div>
          <div class="help-opt"><span class="help-opt-name">Service retiré du catalogue</span><span class="help-opt-desc">Sa page de statut ne publie plus rien de lisible, et l'entrée a été retirée d'une version à l'autre. Décochez-le : la ligne disparaît.</span></div>
          <div class="help-opt"><span class="help-opt-name">Page lue, mais dans un format inconnu</span><span class="help-opt-desc">Tout va bien côté réseau : c'est PiBoard qui ne sait pas lire cette page. Signalez-la, un adaptateur peut être ajouté.</span></div>
          <p>PiBoard suit aussi les <b>déménagements</b> : plusieurs fournisseurs ont déplacé leur page de statut sur un autre domaine en laissant une redirection vers la racine du nouveau site — <code>status.fastly.com</code> vers <code>fastlystatus.com</code>, <code>status.infomaniak.com</code> vers <code>infomaniakstatus.com</code>. La redirection perdant le chemin demandé, PiBoard le repose lui-même sur la nouvelle adresse.</p>

<h4>Quatre icônes, et rien d'autre à lire</h4>
          <p>L'état d'un service se lit à son <b>icône</b>, pas à un texte. Sur un écran regardé de trois mètres, personne ne lit : une forme, elle, se reconnaît de loin. Les cinq états internes se rangent en quatre icônes. Le <b>nom vient toujours en premier</b>, aligné à gauche, l'icône juste à sa droite : on cherche un service par son nom, et l'état est la réponse.</p>
          <div class="help-opt"><span class="help-opt-name">✓ Tout opérationnel</span><span class="help-opt-desc">Le fournisseur ne signale rien.</span></div>
          <div class="help-opt"><span class="help-opt-name">⚠ Problèmes partiels</span><span class="help-opt-desc">Une dégradation, ou une partie du service hors service.</span></div>
          <div class="help-opt"><span class="help-opt-name">✕ Problème général</span><span class="help-opt-desc">Le fournisseur déclare son service globalement hors service. Cette icône <b>pulse doucement</b>, et c'est la seule : elle reste rare, donc elle garde son sens d'alarme. Si elle sortait dès qu'un composant tombe, on s'y habituerait en une semaine.</span></div>
          <div class="help-opt"><span class="help-opt-name">? Pas d'information</span><span class="help-opt-desc">Page injoignable, format inconnu, état incompris. Ce n'est <b>pas</b> « tout va bien ».</span></div>
          <p>Un service qui va bien n'affiche plus que <b>son nom et son icône</b>. Les lignes « aucun incident en cours » et « aucune maintenance programmée » ont disparu : répétées sous vingt-cinq services, trois lignes grises chacune pour n'apprendre <i>rien</i>, elles noyaient les deux services qui avaient quelque chose à dire. Le détail n'apparaît désormais que lorsqu'il existe.</p>

<h4>Quatre modes d'affichage</h4>
          <div class="help-opt"><span class="help-opt-name">Détaillé</span><span class="help-opt-desc">Une fiche par service. Parfait jusqu'à cinq ou six.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compact</span><span class="help-opt-desc">Une pastille par service sain, une fiche complète pour chaque service en difficulté.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compact +</span><span class="help-opt-desc"><b>Tout le monde en pastille</b>, les services en panne comme les autres — vingt-cinq services tiennent dans un coup d'œil. Le détail se demande d'un <b>clic</b> sur la pastille. C'est le mode d'un mur d'écran.</span></div>
          <div class="help-opt"><span class="help-opt-name">Problèmes seulement</span><span class="help-opt-desc">Une seule ligne tant qu'il n'y a rien à dire.</span></div>

<h4>Rangés par famille</h4>
          <p>Vingt-cinq services rangés dans l'ordre où on les a cochés forment une liste qu'il faut lire en entier pour y trouver quelque chose. Ils sont donc regroupés par <b>rubrique</b> — cloud et hébergement, DevOps, SaaS, paiement, observabilité, IA, stockage, France, mes services — dans l'ordre du catalogue, choisi pour que les choses proches se suivent. On va droit à la rubrique voulue, et une famille entière au vert se survole d'un coup d'œil. Décochable dans les réglages.</p>
          <p>À l'intérieur d'une rubrique, les services se rangent sur <b>autant de colonnes que la largeur en permet</b> — une sur une tuile étroite, deux ou trois sur une tuile large. Les colonnes ne sont pas figées : la tuile étant librement redimensionnable, deux colonnes imposées couperaient les noms en deux sur une tuile de trois cases. Un service qui a quelque chose à dire reprend toute la largeur : son détail ne se lit pas dans une demi-colonne.</p>

<h4>La fenêtre de détail</h4>
          <p>Un <b>clic</b> sur n'importe quel service — une pastille en Compact et Compact +, une fiche en mode Détaillé — ouvre une fenêtre qui montre <b>tout</b> ce que la tuile sait : la totalité des composants concernés et non les quatre premiers, la totalité des incidents et non le plus récent, les maintenances programmées, la provenance de l'information et l'heure du dernier relevé. La fenêtre ne répète pas la fiche : elle la remplace par la version complète, c'est son seul intérêt.</p>
          <p>Elle <b>défile</b> quand son contenu dépasse — une page comme celle de Cloudflare annonce facilement une douzaine de maintenances. On la ferme par la croix, par Échap, ou en cliquant à côté. Un clic sur le lien « ouvrir l'incident » ouvre bien l'incident, pas la fenêtre.</p>

<h4>Masquer ce qui ne vous concerne pas</h4>
          <p>Cloudflare annonce une dégradation au Chili, AWS une panne à Sydney, et votre tuile passe au rouge alors que vous travaillez à Toulouse. À force, on cesse de la regarder — la façon la plus sûre de rendre une tuile de supervision inutile. L'option <b>« Masquer les problèmes hors de mes zones »</b> ne garde que ce qui est situé dans les zones que vous listez (Europe, France, codes de région de votre fournisseur…).</p>
          <p>PiBoard connaît les <b>pays et territoires du monde avec leur continent</b> — c'est indispensable : demander « Europe » ne peut rien dire d'« Annaba, Algeria » sans savoir que l'Algérie est en Afrique. Les codes de région des fournisseurs (<code>eu-west-3</code>, <code>southeastasia</code>) et leurs ensembles (<b>EMEA</b>, <b>APAC</b>, <b>LATAM</b>) sont reconnus de la même façon : qui surveille l'Europe est concerné par ce qui est annoncé pour EMEA, mais pas pour APAC.</p>
          <p><b>La règle, et c'est elle qui compte : on ne masque QUE ce qu'on a su situer.</b> Un libellé où aucun lieu connu n'apparaît — « Elevated API error rates » — reste toujours affiché. Masquer ce qu'on n'a pas compris ferait disparaître en silence un incident mondial mal nommé, et une tuile qui cache ce qu'elle n'a pas compris est pire que pas de tuile du tout. Ce qui est annoncé comme <b>mondial</b> reste affiché aussi, et un libellé qui cite vos zones <i>et</i> d'autres continents vous concerne.</p>
          <p>Enfin, un service dont tous les ennuis ont été masqués <b>le dit</b> : le nombre de problèmes écartés reste visible sur sa ligne. Un service calme ne doit jamais se confondre avec un service dont on vous cache quelque chose. L'option est <b>décochée par défaut</b> — une tuile de supervision ne cache rien sans qu'on le lui ait demandé.</p>

<h4>La cloche : surveiller beaucoup, être réveillé par peu</h4>
          <p>Chaque service coché porte une <b>cloche</b> dans le sélecteur. Elle décide si <b>lui</b> peut déclencher l'alerte. Surveiller vingt services et ne vouloir être réveillé que par deux est le cas normal ; sans ce réglage par service, l'option d'alerte devenait inutilisable dès qu'on cochait beaucoup, et on la coupait entièrement — donc on n'était plus averti pour les deux qui comptaient vraiment.</p>
          <p>Un second réglage, <b>« Alerter à partir de la gravité »</b>, fixe le seuil : dégradation mineure, panne partielle, ou panne majeure seulement. Il est volontairement <b>distinct du rythme de vérification</b> : la tuile continue d'accélérer à la moindre dégradation — regarder de près ne coûte rien — tandis que la sirène reste réservée à ce qui mérite de vous interrompre.</p>

<h4>Ce qui s'affiche</h4>
          <p>En temps normal, une ligne par service avec son état global. <b>En cas de problème</b>, s'y ajoutent : les <b>composants concernés uniquement</b> (lister les dix qui vont bien noierait le seul qui compte), le <b>titre de l'incident</b>, son <b>stade</b> (analyse en cours, cause identifiée, correctif sous surveillance…), <b>depuis quand</b> il dure, le <b>dernier message publié</b> par le service — souvent la seule information vraiment utile — et un <b>lien</b> vers l'incident.</p>
          <p>Les emplacements du détail sont <b>toujours posés</b>, avec une mention neutre quand il n'y a rien à signaler. La tuile garde ainsi la même silhouette en permanence : elle ne change pas de taille à chaque incident et ne bouscule pas ses voisines. Seule la couleur change, ce qui se repère justement de loin.</p>

<h4>Deux rythmes de vérification</h4>
          <p>Une page de statut ne bouge pas pendant des semaines ; mais une fois l'incident déclaré, dix minutes entre deux relévés sont une éternité. D'où deux intervalles réglables : un <b>normal</b> (10 min par défaut) et un <b>d'incident</b> (1 min).</p>
          <p>L'accélération est <b>immédiate</b> et se déclenche dès que l'état global quitte « tout opérationnel », <b>dégradations mineures comprises</b> : attendre la panne majeure reviendrait à regarder de près une fois qu'il est trop tard. Le retour au rythme normal, lui, demande <b>deux relévés sains d'affilée</b> — presque tous les incidents sont en dents de scie, et un seul relévé vert ferait ralentir la tuile pendant l'accalmie qui précède la rechute. Le rythme en cours est indiqué en bas de la tuile.</p>

<h4>Maintenances programmées</h4>
          <p>Optionnelles et actives par défaut : savoir qu'une interruption est prévue demain matin évite de chercher une panne qui n'existe pas.</p>

<h4>Alerte à l'apparition d'un incident</h4>
          <p>Optionnelle, décochée par défaut. Reprend le mécanisme de la tuile Compte à rebours : flash d'écran, son au choix, et webhook (SMS, Alexa, push mobile…). Chaque incident n'est annoncé <b>qu'une fois</b> — sans quoi la tuile sonnerait toutes les minutes pendant des heures. Les incidents <b>déjà en cours</b> au démarrage du tableau sont enregistrés sans alerter : un incident vieux de trois heures n'a pas à faire flasher l'écran parce que PiBoard vient de redémarrer.</p>

<h4>Ce que la tuile ne confond pas</h4>
          <p>Une page de statut <b>injoignable</b> ne veut pas dire « le service va bien ». Si PiBoard n'arrive pas à la lire — coupure Internet, page déplacée — la tuile le dit explicitement au lieu d'afficher du vert. De même, un état qu'elle ne comprend pas n'est jamais pris pour un état sain.</p>
          <p>Seules les adresses <b>HTTPS publiques</b> sont acceptées : une adresse interne (<code>192.168.…</code>, <code>.local</code>, <code>localhost</code>) est refusée, le serveur PiBoard voyant des machines que votre navigateur ne voit pas.</p>
          <div class="help-opt"><span class="help-opt-name">Services à surveiller</span><span class="help-opt-desc">Catalogue à cocher, rangé par familles, avec recherche et ajout libre. 25 au maximum. La cloche de chaque service décide s'il peut alerter.</span></div>
          <div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Détaillé, compact, ou problèmes seulement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Services supplémentaires (Avancé)</span><span class="help-opt-desc">Une ligne par service, <code>Nom = adresse</code>, pour ce qui n'est pas au catalogue.</span></div>
          <div class="help-opt"><span class="help-opt-name">Alerter à partir de la gravité</span><span class="help-opt-desc">Seuil de la sirène, indépendant du rythme de vérification.</span></div>
          <div class="help-opt"><span class="help-opt-name">Intervalles</span><span class="help-opt-desc">En temps normal, et pendant un incident. En minutes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Maintenances programmées</span><span class="help-opt-desc">Affichage des interruptions annoncées.</span></div>
          <div class="help-opt"><span class="help-opt-name">Alerte</span><span class="help-opt-desc">Flash, son, durée et webhook à l'apparition d'un incident.</span></div>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Services à surveiller</span><span class="help-opt-desc">Cochez ce que vous voulez surveiller, par famille, ou tapez dans la recherche. La cloche en face d'un service coché décide si LUI peut déclencher l'alerte — surveiller vingt services en n'étant réveillé que par deux est le cas normal. 25 au maximum. « + Ajouter un autre service » accepte n'importe quelle page de statut publique : l'adresse est sondée sur le champ et le format employé vous est annoncé, donc vous savez avant d'enregistrer si elle est lisible. Par défaut : « [{"id":"github","name":"GitHub","url":"https://www.githubstatus.com","adapter":"statuspage","family":"devops","alert":true},{"id":"cloudflare","name":"Cloudflare","url":"https://www.cloudflarestatus.com","adapter":"statuspage","family":"cloud","alert":true},{"id":"npm","name":"npm","url":"https://status.npmjs.org","adapter":"statuspage","family":"devops","alert":true}] ».</span></div>
<div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Vingt-cinq fiches détaillées ne tiennent sur aucun écran. En compact, un service est une pastille (nom et point coloré) et seul ce qui va mal est écrit en entier ; « problèmes seulement » va plus loin et n'affiche qu'une ligne tant que tout est opérationnel — le bon choix pour un tableau mural, où une tuile qui ne dit rien est une tuile qui n'a rien à dire. Choix : Détaillé — une fiche par service, Compact — pastilles, fiches pour les problèmes seulement, Compact + — tout en pastilles, détail au clic, Problèmes seulement — muette tant que tout va bien. Par défaut : Détaillé — une fiche par service.</span></div>
<div class="help-opt"><span class="help-opt-name">Regrouper les services par famille</span><span class="help-opt-desc">Vingt-cinq services rangés dans l'ordre où on les a cochés forment une liste qu'il faut lire en entier pour y trouver quelque chose. Rangés par thème — cloud, DevOps, SaaS, IA, France… — on va droit à la rubrique voulue, et une famille entière au vert se survole d'un coup d'œil. L'ordre des rubriques est celui du catalogue, choisi pour que les choses proches se suivent. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Masquer les problèmes hors de mes zones</span><span class="help-opt-desc">Une dégradation de Cloudflare au Chili ou une panne AWS à Sydney n'ont aucun effet sur un service utilisé depuis la France, mais font passer la tuile au rouge — et à force, on cesse de la regarder. Cochée, cette option ne garde que les composants et les incidents situés dans les zones listées ci-dessous. Un libellé où aucun lieu connu n'apparaît reste TOUJOURS affiché : on ne masque que ce qu'on a su situer. Ce qui est annoncé comme mondial reste affiché aussi. Le nombre de problèmes masqués est indiqué sur la ligne du service, pour qu'un service calme ne soit jamais confondu avec un service dont on vous cache quelque chose. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Mes zones (séparées par des virgules)</span><span class="help-opt-desc">Comparées aux noms de composants, aux régions et aux titres d'incidents, sans tenir compte des accents ni de la casse. Ajoutez ce qui vous concerne : un pays, une ville, un code de région de votre fournisseur (eu-west-3, francecentral, gra, rbx…). Vide, le filtre ne masque rien. Par défaut : « Europe, France, EU, eu-west, eu-central, westeurope, francecentral ».</span></div>
<p class="help-opt-group">Avancé</p>
<div class="help-opt"><span class="help-opt-name">Services supplémentaires, à la main (un par ligne)</span><span class="help-opt-desc">Conservé de la version précédente, et toujours utile : le sélecteur ci-dessus couvre le catalogue, ce champ couvre tout le reste — un fournisseur interne, une page trop récente pour être listée, la page de statut d'un client. Format : Nom = adresse de la page de statut, ou l'adresse seule. Le format est deviné par sondage (Statuspage, Instatus, Google, Fastly, Vultr, PayPal, RSS) : il n'y a rien à déclarer. Les lignes commençant par # sont ignorées, pratique pour en désactiver une temporairement. Ces lignes comptent dans le même plafond de 25 que les services cochés. Seules les adresses HTTPS publiques sont acceptées.</span></div>
<div class="help-opt"><span class="help-opt-name">Tenir la liste des services à jour depuis le dépôt</span><span class="help-opt-desc">Les fournisseurs déménagent leur page de statut ou changent de format plusieurs fois par an. Avec cette case, PiBoard récupère les corrections du catalogue sur le dépôt public (toutes les 12 h) au lieu d'attendre la prochaine version : une page qui déménage est corrigée pour tout le monde en une ligne. Rien n'est envoyé, seul le fichier du catalogue est lu, et il est entièrement vérifié avant d'être retenu — adresses publiques en HTTPS uniquement, comme pour une adresse saisie à la main. Décochée, PiBoard s'en tient au catalogue livré avec la version installée : c'est le bon choix pour un kiosque sans Internet ou sur réseau fermé. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Vérifier toutes les (minutes), en temps normal</span><span class="help-opt-desc">Une page de statut ne bouge pas pendant des semaines : interroger plus souvent n'apporte rien. De 1 à 240, par défaut 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Vérifier toutes les (minutes), pendant un incident</span><span class="help-opt-desc">La tuile passe d'elle-même à ce rythme plus rapide dès que l'état global quitte « tout opérationnel » — dégradations mineures comprises, car attendre la panne majeure reviendrait à accélérer une fois qu'il est trop tard. Elle ne revient au rythme normal qu'après deux relevés sains d'affilée : presque tous les incidents sont en dents de scie, et un seul relevé vert ferait ralentir la tuile pendant l'accalmie qui précède la rechute. De 1 à 60, par défaut 1.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les maintenances programmées</span><span class="help-opt-desc">Savoir qu'une interruption est prévue demain matin évite de chercher une panne qui n'existe pas. Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Alerter à l'apparition d'un incident</span><span class="help-opt-desc">Chaque incident est annoncé UNE fois, et non à chaque relevé — sans quoi la tuile sonnerait toutes les minutes pendant des heures durant une panne. Les incidents déjà en cours au démarrage du tableau sont enregistrés sans alerter : un incident vieux de trois heures n'a pas à faire flasher l'écran parce que PiBoard vient de redémarrer. Désactivé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Alerter à partir de la gravité</span><span class="help-opt-desc">Distinct du rythme de vérification, volontairement : la tuile continue d'accélérer à la moindre dégradation — regarder de près ne coûte rien — tandis que la sirène reste réservée à ce qui mérite de vous interrompre. Un état déduit d'un flux RSS est au plus « mineur » : il ne sonne donc jamais sous les deux réglages plus stricts. Choix : Dégradation mineure et au-delà, Panne partielle et au-delà, Panne majeure seulement. Par défaut : Dégradation mineure et au-delà.</span></div>
<div class="help-opt"><span class="help-opt-name">Flash d'écran</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Jouer un son</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Son de l'alerte</span><span class="help-opt-desc">Choix : 🔔 Bip simple, 🔔 Double bip, 🚓 Sirène police, 🚒 Sirène pompiers, 🔥 Alarme incendie, 🚨 Klaxon plongée sous-marine, 🚆 Cloche de passage à niveau, 🔔 Sonnette d'entrée (ding-dong), 🎵 Jingle bref. Par défaut : 🔔 Double bip.</span></div>
<div class="help-opt"><span class="help-opt-name">Durée de l'alerte (secondes)</span><span class="help-opt-desc">De 1 à 120, par défaut 15.</span></div>
<div class="help-opt"><span class="help-opt-name">URL du webhook de notification (optionnel, {message} = service et incident)</span><span class="help-opt-desc">Adresse appelée au moment de l'alerte, pour la relayer ailleurs (SMS, Alexa, notification sur le téléphone…). <code>{message}</code> y est remplacé par le service et l'incident. Laisser vide pour ne rien appeler.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 3×3 to 12×16</span>

<h4>Purpose</h4>
<p>Answer the question you ask when something stops working: is it me, or them?</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Catalogue</b> of about eighty services to tick by family (AWS, Google Cloud, Azure, OVHcloud, GitHub, Cloudflare, OpenAI, Anthropic, French operators…), plus any status page added by hand.</li>
  <li><b>Overall status</b> in four icons, and when something goes wrong: affected components, incident stage and age, the service's latest message and a link.</li>
  <li><b>Four display modes</b>, services <b>grouped by family</b>, and <b>your geographic zones</b> to keep only what concerns you.</li>
  <li><b>Scheduled maintenance</b> flagged.</li>
  <li><b>Alert</b> when an incident appears (flash, sound, duration, webhook), with a bell to choose which services may wake you.</li>
  <li><b>Checks</b> at an adjustable interval, faster during an incident; catalogue kept up to date from the public repository, without waiting for a release.</li>
</ul>

<h4>Choosing the services: a catalogue to tick</h4>
          <p>Services are chosen from a <b>drop-down list of checkboxes</b>, arranged by family — cloud and hosting, development and DevOps, SaaS and collaboration, payment and messaging, observability, AI and models, file storage and sharing, France (carriers and services) — with a <b>search</b> filtering on name as well as domain. The shipped catalogue holds close to eighty entries, including a <b>file storage and sharing</b> family (Dropbox, Box, Proton Drive, WeTransfer, Infomaniak, Backblaze, MEGA, pCloud): AWS, Google Cloud, Azure, OVHcloud, Scaleway, Cloudflare, GitHub, GitLab, npm, Docker Hub, Slack, Zoom, Google Workspace, Stripe, Twilio, Datadog, Sentry, OpenAI, Anthropic, Mistral, Free, Orange, Gandi, Qonto…</p>
          <p>Families start <b>collapsed</b>, except those already holding a ticked service: that is what lets you find your own choices without scrolling sixty lines. A search expands everything for its duration. <b>25 services at most</b> — a legibility ceiling, not a network one.</p>

<h4>Adding a service the catalogue does not hold</h4>
          <p>The <b>"+ Add another service"</b> button takes any public status page: an internal provider, a page too new to be listed, a client's own. The address is <b>probed on the spot</b> and the format found is named back to you (<code>Recognised: statuspage format</code>) — so you know <b>before saving</b> whether the page can be read, instead of finding out three hours later in front of a grey line. The text field <b>"Extra services, by hand"</b>, in the <i>Advanced</i> section, remains available and keeps the old <code>Name = address</code> grammar, <code>#</code> included to disable a line.</p>

<h4>Fifteen status-page formats, two of them honest</h4>
          <p><code>githubstatus.com</code> is not a bespoke page but an Atlassian <b>Statuspage</b>, used by hundreds of vendors, all exposing the same public API in the same place, with no key or account. It is the richest format — the only one giving the state of <b>each component</b>. But AWS, Google Cloud and Azure, precisely the services one wants to watch first, do not use it — and several providers have since left Statuspage for an in-house page. So PiBoard reads fifteen formats:</p>
          <div class="help-opt"><span class="help-opt-name">Statuspage (Atlassian)</span><span class="help-opt-desc">Overall state, per-component state, incidents and maintenances. The most complete.</span></div>
          <div class="help-opt"><span class="help-opt-name">Instatus</span><span class="help-opt-desc">A direct competitor, used by a number of younger vendors.</span></div>
          <div class="help-opt"><span class="help-opt-name">Google</span><span class="help-opt-desc">Google Cloud and Google Workspace. The affected products stand in for components.</span></div>
          <div class="help-opt"><span class="help-opt-name">AWS Health</span><span class="help-opt-desc">With the <b>region</b> concerned: an <code>ap-southeast-2</code> outage does not concern you if you work on <code>eu-west-1</code>.</span></div>
          <div class="help-opt"><span class="help-opt-name">Status.io</span><span class="help-opt-desc">The third vendor, behind Atlassian and Instatus. It is <b>GitLab</b>'s.</span></div>
          <div class="help-opt"><span class="help-opt-name">Better Stack</span><span class="help-opt-desc">The fourth vendor. It is <b>Hugging Face</b>'s.</span></div>
          <div class="help-opt"><span class="help-opt-name">Backblaze</span><span class="help-opt-desc">In-house format. Its components carry no state: only open incidents say anything.</span></div>
          <div class="help-opt"><span class="help-opt-name">Heroku</span><span class="help-opt-desc">Three systems (Apps, Data, Tools), one traffic light each, plus maintenances.</span></div>
          <div class="help-opt"><span class="help-opt-name">Slack</span><span class="help-opt-desc">In-house format, on <code>slack-status.com</code> where <code>status.slack.com</code> redirects.</span></div>
          <div class="help-opt"><span class="help-opt-name">PagerDuty</span><span class="help-opt-desc">Their own status-page product. The API returns only what is wrong: empty list = all operational.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zendesk</span><span class="help-opt-desc">In-house format. The state is read from the day's incidents, hence the date in the address.</span></div>
          <div class="help-opt"><span class="help-opt-name">PayPal</span><span class="help-opt-desc">In-house API. Only <b>production</b> is watched: a broken sandbox must not turn the tile red while real payments go through. Pieces that exist only in sandbox (Braintree Sandbox, Paydiant…) are not shown at all — they have no production, which is not the same as a state we do not understand.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fastly</span><span class="help-opt-desc">In-house format since they left Statuspage.</span></div>
          <div class="help-opt"><span class="help-opt-name">Vultr</span><span class="help-opt-desc">In-house format, arranged by <b>region</b>.</span></div>
          <div class="help-opt"><span class="help-opt-name">RSS</span><span class="help-opt-desc">Azure and every "travaux.*". State <b>inferred</b>, see below.</span></div>
          <div class="help-opt"><span class="help-opt-name">Endpoint</span><span class="help-opt-desc">For services publishing <b>nothing</b>: pCloud, Alibaba Cloud, Hetzner, SFR. State <b>inferred</b>, see below.</span></div>
          <p>An RSS feed never says "I am fine": it publishes dated posts. The state is therefore <b>inferred</b> — no post in 24 h counts as healthy, a recent post counts as a minor degradation and never worse, because the feed does not carry the information that would justify a red. These services carry a <b>tilde</b> <code>~</code> beside their state, saying the state is inferred rather than declared by the provider. A silence is not good news, and the two must not look alike on screen.</p>
          <p><b>The "Endpoint" adapter measures something else, and you should know it.</b> Some services publish nothing a machine can read: no API, no feed, nothing. pCloud is the example — everything you find about it comes from outside probes, not from pCloud. The choice is then between saying nothing at all and measuring what <i>can</i> be measured: whether their public API is reachable <b>from your Pi</b> — and it is the <b>service</b> that is queried, never its status page: a status page that answers says nothing about the service it describes. That is not the provider's word. "Reachable from your place" is not "the provider declares itself healthy", and a failure may come from your connection, your DNS, a sub-sea cable: which is why a failure never exceeds a <b>minor degradation</b>, and why these services carry the <b>tilde</b> too.</p>
          <p>Catalogue services declare their format, which avoids probing several addresses per service at every reading. For a hand-typed address the format is worked out by probing, in order: Statuspage, Instatus, Better Stack, Google, Fastly, Vultr, PayPal, RSS. <b>"Endpoint" is never probed</b>: it would succeed on any reachable address, hence always win, and every service would become "healthy, inferred" instead of being properly read.</p>

<h4>A catalogue that fixes itself without waiting for a PiBoard release</h4>
          <p>Providers <b>move</b> their status page and <b>change format</b> several times a year: within weeks, Fastly, Vultr, PayPal, GitLab, Hugging Face, Backblaze, Heroku, Slack, PagerDuty and Zendesk all left Atlassian's Statuspage for an in-house page. Nine times out of ten what changes is not the <i>program</i> but a <i>piece of data</i>: an address, a format to declare, an entry to drop.</p>
          <p>The catalogue therefore lives <b>outside the code</b>. PiBoard reads the one in the <b>public repository</b> (every 12 h) alongside the one shipped with the installed version, and keeps the more recent of the two. A page that moves becomes one line of JSON pushed to the repository, fixed for everyone within half a day — no new release, no reinstall, and nothing for you to untick and tick again.</p>
          <p><b>What PiBoard deliberately does not do.</b> The tile never depends on the network: the shipped catalogue is always there as the final fallback, the last good catalogue received is kept on disk, and if the repository cannot be reached nothing changes on screen. The remote catalogue is never taken at its word: it dictates addresses the server will query, so it is <b>fully checked before being accepted</b> — public HTTPS addresses only, never an internal one, formats known to <i>your</i> version — and <b>rejected wholesale</b> at the first anomaly, because a half-good file would be worse than a refused one: nobody would know which half. And it never goes <b>backwards</b>: a remote catalogue no newer than the one in place is ignored, otherwise a repository rolled back by accident would erase fixes already applied.</p>
          <p>The setting <b>"Keep the service list up to date from the repository"</b> turns all of this off: unticked, PiBoard stays with the installed version's catalogue. That is the right choice for a kiosk with no internet or on a closed network. Nothing is ever sent: only the catalogue file is read.</p>

<h4>The catalogue is the truth; your setting only says "that one"</h4>
          <p>When you tick a service, PiBoard stores only its <b>id</b>: the address and the format are re-read from the catalogue at every start. That is what makes a <b>catalogue fix arrive on its own</b> on a board already configured — a provider moving its status page, an in-house format replacing a Statuspage, and the tile follows without you touching anything. Hand-added services keep exactly what you typed: they have no catalogue entry, and nobody but you decides their address.</p>

<h4>When a service does not show: three messages, three causes</h4>
          <p>A page may fail to yield a state for three unrelated reasons, and the tile tells them apart — confusing them sends you looking for a network fault to solve an address problem.</p>
          <div class="help-opt"><span class="help-opt-name">Status page unreachable</span><span class="help-opt-desc">Nobody answered: DNS, outage, timeout. Check your network.</span></div>
          <div class="help-opt"><span class="help-opt-name">The page refused the request (HTTP 403, 404…)</span><span class="help-opt-desc">The server answers, but not at this address. Check the address. The code is shown, because 403 and 404 do not call for the same check.</span></div>
          <div class="help-opt"><span class="help-opt-name">Service withdrawn from the catalogue</span><span class="help-opt-desc">Its status page no longer publishes anything readable and the entry was dropped between versions. Untick it and the line goes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Page read, but in an unknown format</span><span class="help-opt-desc">Nothing wrong with the network: PiBoard cannot read this page. Report it, an adapter can be added.</span></div>
          <p>PiBoard also follows <b>moves</b>: several providers relocated their status page to another domain, leaving a redirect to the new site's root — <code>status.fastly.com</code> to <code>fastlystatus.com</code>, <code>status.infomaniak.com</code> to <code>infomaniakstatus.com</code>. Since the redirect loses the requested path, PiBoard rebuilds it on the new address itself.</p>

<h4>Four icons, and nothing to read</h4>
          <p>A service's state is read from its <b>icon</b>, not from text. On a screen looked at from three metres nobody reads; a shape is recognised from afar. The five internal states map to four icons. The <b>name always comes first</b>, left-aligned, with the icon to its right: you look for a service by its name, and the state is the answer.</p>
          <div class="help-opt"><span class="help-opt-name">✓ All operational</span><span class="help-opt-desc">The provider reports nothing.</span></div>
          <div class="help-opt"><span class="help-opt-name">⚠ Partial problems</span><span class="help-opt-desc">A degradation, or part of the service down.</span></div>
          <div class="help-opt"><span class="help-opt-name">✕ General problem</span><span class="help-opt-desc">The provider declares its service globally down. This icon <b>pulses gently</b>, and it is the only one: it stays rare, so it keeps its alarm value.</span></div>
          <div class="help-opt"><span class="help-opt-name">? No information</span><span class="help-opt-desc">Unreachable page, unknown format, state not understood. This is <b>not</b> "all fine".</span></div>
          <p>A healthy service now shows only <b>its name and its icon</b>. The "no ongoing incident" and "no scheduled maintenance" lines are gone: repeated under twenty-five services, three grey lines each to teach <i>nothing</i>, they drowned the two services that had something to say.</p>

<h4>Four display modes</h4>
          <div class="help-opt"><span class="help-opt-name">Detailed</span><span class="help-opt-desc">One card per service. Perfect up to five or six.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compact</span><span class="help-opt-desc">A chip per healthy service, a full card for each service in trouble.</span></div>
          <div class="help-opt"><span class="help-opt-name">Compact +</span><span class="help-opt-desc"><b>Everyone as a chip</b>, failing services included — twenty-five services at a glance. Detail is asked for with a <b>click</b>. The wall-display mode.</span></div>
          <div class="help-opt"><span class="help-opt-name">Problems only</span><span class="help-opt-desc">A single line while there is nothing to say.</span></div>

<h4>Grouped by family</h4>
          <p>Twenty-five services in ticking order form a list one must read entirely to find anything. They are therefore grouped under <b>headings</b> — cloud and hosting, DevOps, SaaS, payment, observability, AI, storage, France, my services — in the catalogue's order, chosen so that related things follow one another. Can be switched off in the settings.</p>

<h4>The detail window</h4>
          <p>A <b>click</b> on any service — a chip in Compact and Compact +, a card in Detailed — opens a window showing <b>everything</b> the tile knows: every affected component rather than the first four, every incident rather than the latest one, scheduled maintenances, where the information came from and when it was last read. The window does not repeat the card: it replaces it with the complete version, which is its only point.</p>
          <p>It <b>scrolls</b> when its content overflows — a page like Cloudflare's easily announces a dozen maintenances. Close it with the cross, with Escape, or by clicking outside. A click on the "open incident" link opens the incident, not the window.</p>

<h4>Hiding what does not concern you</h4>
          <p>Cloudflare reports a degradation in Chile, AWS an outage in Sydney, and your tile turns red while you work in Toulouse. In time one stops looking at it — the surest way to make a monitoring tile useless. The option <b>"Hide problems outside my zones"</b> keeps only what is located in the zones you list.</p>
          <p>PiBoard knows the world's <b>countries and territories with their continent</b> — which is essential: asking for "Europe" can say nothing about "Annaba, Algeria" without knowing Algeria is in Africa. Provider region codes (<code>eu-west-3</code>, <code>southeastasia</code>) and groupings (<b>EMEA</b>, <b>APAC</b>, <b>LATAM</b>) are recognised the same way.</p>
          <p><b>The rule that matters: only what we managed to LOCATE is ever hidden.</b> A label in which no known place appears — "Elevated API error rates" — is always shown. Hiding what was not understood would silently drop a badly-named worldwide incident, and a tile that hides what it did not understand is worse than no tile at all. Anything announced as <b>worldwide</b> stays shown too.</p>
          <p>A service whose troubles were all hidden <b>says so</b>: the number of discarded problems stays visible on its line. A quiet service must never be confused with one that is hiding something from you. The option is <b>unticked by default</b> — a monitoring tile hides nothing unless asked.</p>

<h4>The bell: watch many, be woken by few</h4>
          <p>Each ticked service carries a <b>bell</b> in the picker, deciding whether <b>it</b> may raise the alert. Watching twenty services while wanting to be woken by two is the normal case; without this per-service setting the alert option became unusable as soon as many were ticked, so people switched it off entirely — and were then not told about the two that did matter.</p>
          <p>A second setting, <b>"Alert from severity"</b>, sets the threshold: minor degradation, partial outage, or major outage only. It is deliberately <b>separate from the check rhythm</b>: the tile still speeds up on the slightest degradation — watching closely costs nothing — while the siren stays reserved for what deserves to interrupt you.</p>

<h4>What is shown</h4>
          <p>Normally, one line per service with its overall state. <b>When something is wrong</b>, it adds: the <b>affected components only</b> (listing the ten that work would drown the one that matters), the <b>incident's title</b>, its <b>stage</b> (investigating, cause identified, fix being monitored…), <b>how long</b> it has lasted, the <b>latest message published</b> by the service — often the only truly useful piece of information — and a <b>link</b> to the incident.</p>
          <p>The detail slots are <b>always laid out</b>, with a neutral mention when there is nothing to report, so the tile keeps the same silhouette permanently: it does not resize at every incident, nor shove its neighbours about. Only the colour changes, which is what carries from across a room.</p>

<h4>Two check rhythms</h4>
          <p>A status page is quiet for weeks; but once an incident is declared, ten minutes between readings is an age. Hence two configurable intervals: a <b>normal</b> one (10 min by default) and an <b>incident</b> one (1 min).</p>
          <p>Speeding up is <b>immediate</b> and triggers as soon as the overall state leaves "all operational", <b>minor degradations included</b>: waiting for a major outage would mean looking closely once it is too late. Returning to the normal rhythm takes <b>two healthy readings in a row</b> — almost every incident is jagged, and a single green reading would slow the tile down during the lull before the relapse. The current rhythm is shown at the bottom of the tile.</p>

<h4>Scheduled maintenances</h4>
          <p>Optional, on by default: knowing an interruption is planned for tomorrow morning saves looking for a fault that does not exist.</p>

<h4>Alert when an incident appears</h4>
          <p>Optional, unticked by default. Reuses the Countdown tile's mechanism: screen flash, chosen sound, and a webhook (SMS, Alexa, phone push…). Each incident is announced <b>once only</b> — otherwise the tile would ring every minute for hours. Incidents <b>already under way</b> when the board starts are recorded without alerting: a three-hour-old incident must not flash the screen merely because PiBoard was restarted.</p>

<h4>What the tile does not confuse</h4>
          <p>An <b>unreachable</b> status page does not mean "the service is fine". If PiBoard cannot read it — internet outage, page moved — the tile says so explicitly instead of showing green. Likewise, a state it does not understand is never taken for a healthy one.</p>
          <p>Only <b>public HTTPS</b> addresses are accepted: an internal one (<code>192.168.…</code>, <code>.local</code>, <code>localhost</code>) is refused, the PiBoard server seeing machines your browser cannot.</p>
          <div class="help-opt"><span class="help-opt-name">Services to watch</span><span class="help-opt-desc">A catalogue to tick, arranged by family, with search and free addition. 25 at most. Each service's bell decides whether it may alert.</span></div>
          <div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Detailed, compact, or problems only.</span></div>
          <div class="help-opt"><span class="help-opt-name">Extra services (Advanced)</span><span class="help-opt-desc">One line per service, <code>Name = address</code>, for whatever is not in the catalogue.</span></div>
          <div class="help-opt"><span class="help-opt-name">Alert from severity</span><span class="help-opt-desc">The siren's threshold, independent of the check rhythm.</span></div>
          <div class="help-opt"><span class="help-opt-name">Intervals</span><span class="help-opt-desc">Normally, and during an incident. In minutes.</span></div>
          <div class="help-opt"><span class="help-opt-name">Scheduled maintenances</span><span class="help-opt-desc">Display of announced interruptions.</span></div>
          <div class="help-opt"><span class="help-opt-name">Alert</span><span class="help-opt-desc">Flash, sound, duration and webhook when an incident appears.</span></div>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Services to watch</span><span class="help-opt-desc">Tick what you want to watch, by family, or type in the search box. The bell beside a ticked service decides whether IT may raise the alert — watching twenty services while being woken by two is the normal case. Up to 25. "+ Add another service" takes any public status page: the address is probed on the spot and the format it uses is named back to you, so you know before saving whether it can be read. Default: "[{"id":"github","name":"GitHub","url":"https://www.githubstatus.com","adapter":"statuspage","family":"devops","alert":true},{"id":"cloudflare","name":"Cloudflare","url":"https://www.cloudflarestatus.com","adapter":"statuspage","family":"cloud","alert":true},{"id":"npm","name":"npm","url":"https://status.npmjs.org","adapter":"statuspage","family":"devops","alert":true}]".</span></div>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Twenty-five detailed cards fit on no screen. In compact mode a service is a chip (name and coloured dot) and only what is wrong is written out in full; "problems only" goes further and shows a single line while everything is operational — the right choice for a wall board, where a tile that says nothing is a tile with nothing to say. Choices: Detailed — one card per service, Compact — chips, cards only for problems, Compact + — all as chips, detail on click, Problems only — silent while all is well. Default: Detailed — one card per service.</span></div>
<div class="help-opt"><span class="help-opt-name">Group services by family</span><span class="help-opt-desc">Twenty-five services in ticking order form a list one must read entirely to find anything. Arranged by theme — cloud, DevOps, SaaS, AI, France… — you go straight to the right heading, and a whole family in green is taken in at a glance. The heading order is the catalogue's, chosen so that related things follow one another. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Hide problems outside my zones</span><span class="help-opt-desc">A Cloudflare degradation in Chile or an AWS outage in Sydney have no effect on a service used from France, yet turn the tile red — and in time one stops looking at it. Ticked, this keeps only the components and incidents located in the zones listed below. A label in which no known place appears is ALWAYS shown: only what we managed to locate is ever hidden. Anything announced as worldwide stays shown too. The number of hidden problems is displayed on the service's line, so a quiet service is never confused with one that is hiding something from you. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">My zones (comma separated)</span><span class="help-opt-desc">Compared with component names, regions and incident titles, ignoring case and accents. Add what concerns you: a country, a city, your provider's region code (eu-west-3, francecentral, gra, rbx…). Left empty, the filter hides nothing. Default: "Europe, France, EU, eu-west, eu-central, westeurope, francecentral".</span></div>
<p class="help-opt-group">Advanced</p>
<div class="help-opt"><span class="help-opt-name">Extra services, by hand (one per line)</span><span class="help-opt-desc">Kept from the previous version, and still useful: the picker above covers the catalogue, this field covers everything else — an internal provider, a page too new to be listed, a client's own status page. Format: Name = status page address, or just the address. The format is worked out by probing (Statuspage, Instatus, Google, Fastly, Vultr, PayPal, RSS), so there is nothing to declare. Lines starting with # are ignored, handy to disable one temporarily. These lines count towards the same ceiling of 25 as the ticked services. Only public HTTPS addresses are accepted.</span></div>
<div class="help-opt"><span class="help-opt-name">Keep the service list up to date from the repository</span><span class="help-opt-desc">Providers move their status page or change format several times a year. With this ticked, PiBoard fetches catalogue fixes from the public repository (every 12 h) instead of waiting for the next release: a page that moves is fixed for everyone in one line. Nothing is sent, only the catalogue file is read, and it is fully checked before being accepted — public HTTPS addresses only, as for a hand-typed address. Unticked, PiBoard stays with the catalogue shipped in the installed version: the right choice for a kiosk with no internet or on a closed network. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Check every (minutes), normally</span><span class="help-opt-desc">A status page is quiet for weeks on end; there is nothing to gain from asking more often than this. From 1 to 240, default 10.</span></div>
<div class="help-opt"><span class="help-opt-name">Check every (minutes), during an incident</span><span class="help-opt-desc">The tile switches to this faster rhythm by itself as soon as the overall state leaves "all operational" — minor degradations included, since waiting for a major outage means speeding up once it is too late to help. It returns to the normal rhythm only after two healthy readings in a row: almost every incident is jagged, and a single green reading would slow the tile down during the lull before the relapse. From 1 to 60, default 1.</span></div>
<div class="help-opt"><span class="help-opt-name">Show scheduled maintenances</span><span class="help-opt-desc">Knowing an interruption is planned for tomorrow morning saves looking for a fault that does not exist. On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert when an incident appears</span><span class="help-opt-desc">Each incident is announced ONCE, not at every reading — otherwise the tile would ring every minute for hours during an outage. Incidents already under way when the board starts are recorded without alerting: a three-hour-old incident must not flash the screen merely because PiBoard was restarted. Off by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert from severity</span><span class="help-opt-desc">Separate from the check rhythm, on purpose: the tile still speeds up on the slightest degradation — watching closely costs nothing — while the siren stays reserved for what deserves to interrupt you. A state inferred from an RSS feed is reported as minor at most, so it never rings under the two stricter settings. Choices: Minor degradation and above, Partial outage and above, Major outage only. Default: Minor degradation and above.</span></div>
<div class="help-opt"><span class="help-opt-name">Flash the screen</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Play a sound</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert sound</span><span class="help-opt-desc">Choices: 🔔 Simple beep, 🔔 Double beep, 🚓 Police siren, 🚒 Firefighter siren, 🔥 Fire alarm klaxon, 🚨 Submarine dive klaxon, 🚆 Train crossing bell, 🔔 Doorbell (ding-dong), 🎵 Short jingle. Default: 🔔 Double beep.</span></div>
<div class="help-opt"><span class="help-opt-name">Alert duration (seconds)</span><span class="help-opt-desc">From 1 to 120, default 15.</span></div>
<div class="help-opt"><span class="help-opt-name">Notification webhook URL (optional, {message} = service and incident)</span><span class="help-opt-desc">Address called when the alert fires, to relay it elsewhere (SMS, Alexa, phone notification…). <code>{message}</code> is replaced by the service and the incident. Leave empty to call nothing.</span></div>
`
      }
    },

    {
      id: "hostwatch",
      group: "tiles",
      title: { fr: "Veille réseau", en: "Network watch" },
      sub: {
        fr: "Vérifie en continu que les machines et services choisis répondent.",
        en: "Continuously checks that the chosen machines and services answer."
      },
      html: {
        fr: `
<p>Cette tuile répond à une question précise : <b>est-ce que ces machines et ces services, ceux que j'ai choisis, répondent en ce moment ?</b> C'est la tuile qu'on regarde quand une lampe connectée ne s'allume plus, pour savoir en trente secondes si le problème vient de la maison ou du fournisseur.</p>
          <p>Elle ne fait pas double emploi avec ses voisines : <b>Analyse réseau</b> découvre ce qui est présent sur le sous-réseau, ponctuellement, et ignore tout des services distants ; <b>Santé Internet</b> mesure la qualité de la connexion elle-même (latence, gigue, pertes), pas la disponibilité de telle ou telle machine.</p>

<h4>Objectif</h4>
<p>Savoir si les appareils et services dont vous dépendez répondent : NAS, Raspberry Pi, serveur Umbrel, box domotique, services en ligne.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Une cible par ligne</b> : adresse, nom d'hôte, port ou adresse web ; la méthode (ping, port TCP ou HTTP) est choisie selon ce que vous saisissez.</li>
  <li><b>Latence</b> de chaque cible et <b>historique</b> récent en option.</li>
  <li><b>Cibles en panne en tête</b> de liste si vous le souhaitez.</li>
  <li>Vérification à intervalle réglable.</li>
</ul>

<h4>Ce qu'on peut surveiller</h4>
          <p>Une ligne par cible, sous la forme <code>Nom = cible</code> (le nom est facultatif). La sonde est choisie automatiquement d'après la forme de ce que vous écrivez — il n'y a aucun type à déclarer :</p>
          <div class="help-opt"><span class="help-opt-name">https://alexa.amazon.com</span><span class="help-opt-desc">Une adresse web déclenche une requête HTTP. C'est la seule façon de tester un service distant : Amazon et Somfy ne répondent pas au ping, leur site oui. Tout code HTTP obtenu compte comme une réponse, même un 403 — le service est joignable et tourne.</span></div>
          <div class="help-opt"><span class="help-opt-name">nas.local:5001</span><span class="help-opt-desc">Un couple hôte:port déclenche une connexion TCP. La bonne sonde pour un service précis d'une machine locale : l'interface d'un NAS Synology, Home Assistant sur 8123, un serveur Umbrel. Elle vérifie que <i>le service écoute</i>, pas seulement que la machine est allumée — la distinction compte quand un conteneur est tombé mais que la machine tourne.</span></div>
          <div class="help-opt"><span class="help-opt-name">192.168.1.10 ou pi.local</span><span class="help-opt-desc">Une adresse ou un nom seul déclenche un ping. La réponse la plus simple à « cette machine est-elle allumée ? ».</span></div>
          <p>Les lignes commençant par <code>#</code> sont ignorées : pratique pour désactiver temporairement une surveillance sans perdre la ligne. 20 cibles au maximum, toutes vérifiées en parallèle — une cible injoignable ne retarde donc pas les autres.</p>

<h4>Lire la tuile</h4>
          <p>Une pastille verte ou rouge par ligne, le temps de réponse de la dernière vérification réussie, et une petite frise : une barre par vérification, la plus récente à droite. Elle montre d'un coup d'œil si une panne est toute récente ou si elle va et vient depuis un moment. Une ligne en panne affiche toujours <b>un motif écrit</b> (« connexion refusée », « nom inconnu », « pas de réponse à temps ») et <b>depuis combien de temps</b> — l'information qu'on cherche vraiment devant une tuile rouge n'est pas « c'est en panne » mais « depuis quand ».</p>
          <p>L'historique ne vit qu'en mémoire du serveur, sur une quarantaine de vérifications : il repart vide après un redémarrage, et rien n'est écrit sur disque.</p>

<h4>Ce que la tuile ne fait pas</h4>
          <p>Volontairement : <b>aucune alerte, aucune notification</b>. Un système d'alerte suppose un canal (courriel, message) et une gestion des faux positifs qui dépassent le cadre d'un tableau de bord mural. Cette tuile montre, elle ne prévient pas.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Ce qu'il faut surveiller (un par ligne)</span><span class="help-opt-desc">Format : Nom = cible, ou la cible seule. La sonde est choisie d'après la forme : https://exemple.fr teste un service en HTTP, nas.local:5001 teste qu'un port écoute, 192.168.1.10 ou pi.local fait un simple ping. Les lignes commençant par # sont ignorées, pratique pour en désactiver une temporairement. 20 lignes au maximum. Par défaut : « Box / routeur = 192.168.1.1
Amazon Alexa = https://alexa.amazon.com
Somfy = https://www.somfy.fr ».</span></div>
<div class="help-opt"><span class="help-opt-name">Vérifier toutes les (secondes)</span><span class="help-opt-desc">60 secondes conviennent à un écran mural. En dessous de 30, les services distants sont interrogés assez souvent pour le remarquer, sans rien à y gagner — sauf à traquer activement une panne intermittente.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le temps de réponse</span><span class="help-opt-desc">Celui de la dernière vérification réussie. Utile pour repérer une machine qui répond mais peine, avant qu'elle ne réponde plus du tout.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la tendance récente</span><span class="help-opt-desc">La frise de barres décrite plus haut. À désactiver sur une tuile étroite, où chaque pixel compte.</span></div>
<div class="help-opt"><span class="help-opt-name">Remonter les pannes en haut</span><span class="help-opt-desc">Désactivé par défaut : une liste dont l'ordre ne change jamais se lit plus vite, chaque ligne restant là où l'œil l'attend. À activer si votre liste est assez longue pour qu'une panne puisse sortir du cadre.</span></div>
`,
        en: `
<p>This tile answers one precise question: <b>are these machines and these services, the ones I picked, answering right now?</b> It is the tile you look at when a connected lamp stops turning on, to know within thirty seconds whether the problem is at home or at the provider's.</p>
          <p>It does not duplicate its neighbours: <b>Network scan</b> discovers what is present on the subnet, at one point in time, and knows nothing of remote services; <b>Internet health</b> measures the quality of the connection itself (latency, jitter, loss), not the availability of this or that machine.</p>

<h4>Goal</h4>
<p>Know whether the devices and services you depend on answer: NAS, Raspberry Pi, Umbrel server, home-automation hub, online services.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>One target per line</b>: address, host name, port or web address; the method (ping, TCP port or HTTP) is chosen from what you type.</li>
  <li><b>Latency</b> of each target and recent <b>history</b> as options.</li>
  <li><b>Down targets first</b> in the list if you wish.</li>
  <li>Checks at an adjustable interval.</li>
</ul>

<h4>What can be watched</h4>
          <p>One line per target, as <code>Name = target</code> (the name is optional). The probe is picked automatically from the shape of what you write — there is no type to declare:</p>
          <div class="help-opt"><span class="help-opt-name">https://alexa.amazon.com</span><span class="help-opt-desc">A web address triggers an HTTP request. This is the only way to test a remote service: Amazon and Somfy do not answer pings, their site does. Any HTTP code obtained counts as an answer, even a 403 — the service is reachable and running.</span></div>
          <div class="help-opt"><span class="help-opt-name">nas.local:5001</span><span class="help-opt-desc">A host:port pair triggers a TCP connection. The right probe for one precise service of a local machine: a Synology NAS's interface, Home Assistant on 8123, an Umbrel server. It checks that <i>the service is listening</i>, not merely that the machine is powered on — a distinction that matters when a container is down but the machine is up.</span></div>
          <div class="help-opt"><span class="help-opt-name">192.168.1.10 or pi.local</span><span class="help-opt-desc">An address or a bare name triggers a ping. The simplest answer to "is that machine on?".</span></div>
          <p>Lines starting with <code>#</code> are ignored: handy to disable a check temporarily without losing the line. Up to 20 targets, all checked in parallel — so one unreachable target does not delay the others.</p>

<h4>Reading the tile</h4>
          <p>A green or red dot per line, the response time of the last successful check, and a small strip: one bar per check, the most recent on the right. It shows at a glance whether a failure is brand new or has been coming and going for a while. A failing line always shows <b>a written reason</b> ("connection refused", "unknown name", "no answer in time") and <b>for how long</b> — what one actually looks for in front of a red tile is not "it is down" but "since when".</p>
          <p>The history lives in the server's memory only, over some forty checks: it starts empty after a restart, and nothing is written to disk.</p>

<h4>What the tile does not do</h4>
          <p>Deliberately: <b>no alerting, no notification</b>. An alerting system implies a channel (email, message) and false-positive handling that go beyond a wall dashboard. This tile shows, it does not warn.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">What to watch (one per line)</span><span class="help-opt-desc">Format: Name = target, or just the target. The probe is picked from the shape: https://example.com tests a service over HTTP, nas.local:5001 tests that a port is listening, 192.168.1.10 or pi.local simply pings. Lines starting with # are ignored, which is handy for disabling one temporarily. Up to 20 lines. Default: "Box / routeur = 192.168.1.1
Amazon Alexa = https://alexa.amazon.com
Somfy = https://www.somfy.fr".</span></div>
<div class="help-opt"><span class="help-opt-name">Check every (seconds)</span><span class="help-opt-desc">60 seconds suits a wall display. Below 30, remote services are queried often enough to be noticed, with nothing to gain — unless you are actively chasing an intermittent fault.</span></div>
<div class="help-opt"><span class="help-opt-name">Show response time</span><span class="help-opt-desc">That of the last successful check. Useful to spot a machine that answers but is struggling, before it stops answering at all.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the recent trend</span><span class="help-opt-desc">The strip of bars described above. Worth turning off on a narrow tile, where every pixel counts.</span></div>
<div class="help-opt"><span class="help-opt-name">Move failures to the top</span><span class="help-opt-desc">Off by default: a list whose order never changes is read faster, each line staying where the eye expects it. Turn it on if your list is long enough that a failure could scroll out of sight.</span></div>
`
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
<p>Voir ce qui est connecté au réseau local, sans ouvrir l'interface d'administration de la box.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Liste des appareils actifs</b> : nom d'hôte et adresse IP.</li>
  <li><b>Noms personnalisés</b> pour vos appareils, mémorisés par adresse MAC et conservés après une réinstallation.</li>
  <li><b>Export et import CSV</b> de vos noms, pour les retrouver sur une autre machine (séparateur au choix).</li>
  <li><b>Nouvelle analyse</b> automatique à l'intervalle choisi.</li>
</ul>

<h4>Possibilités</h4>
          <p>L'analyse combine trois moyens : une <b>sonde UDP</b> vers chaque adresse du sous-réseau, émise par PiBoard lui-même, qui oblige le système à résoudre l'adresse matérielle (MAC) de la destination et remplit ainsi la table ARP ; un <b>ping</b> de chaque adresse ; puis une <b>lecture de la table ARP</b> juste après, pour aussi repérer les appareils dont le pare-feu bloque le ping (une table ARP se remplit quel que soit ce réglage, car elle est nécessaire au routage). Un nom d'hôte est ensuite recherché par résolution DNS inverse pour chaque appareil trouvé ; à défaut, seule l'adresse IP est affichée. Le Pi lui-même apparaît toujours dans la liste, mis en évidence. Aucune donnée ne quitte le réseau local. Une analyse dure environ 10 à 20 secondes selon la taille du réseau — le bouton « Analyser maintenant » sur la tuile permet de la relancer à tout moment.</p>
          <p><b>Pourquoi une sonde UDP en plus du ping.</b> Un appareil peut très bien ignorer le ping tout en étant parfaitement présent : un PC Windows en profil « réseau public », une imprimante, une caméra. L'ARP, lui, travaille en couche 2 et ne se filtre pas — il répond toujours. La sonde force donc l'apparition de ces appareils. Le datagramme est envoyé sur le port 9 (« discard »), défini par la norme précisément pour être ignoré : aucun appareil n'agit dessus, et aucune réponse n'est attendue — seul le remplissage de la table ARP est recherché.</p>
          <p><b>Sur un Mac, c'est même indispensable.</b> macOS accorde l'autorisation « Réseau local » à un processus précis. Tant que PiBoard déléguait le balayage à la commande <code>ping</code> — un programme du système, lancé en processus séparé — les paquets étaient <b>jetés silencieusement</b>, sans la moindre erreur : l'analyse ne ramenait que le Mac lui-même et les rares adresses déjà connues. La sonde étant émise par PiBoard directement, l'autorisation accordée s'applique enfin. Si l'analyse reste vide sur un Mac, vérifiez que PiBoard figure bien dans <b>Réglages Système → Confidentialité et sécurité → Réseau local</b>, interrupteur activé.</p>
          <p><b>Si l'interrupteur est déjà activé mais que l'analyse reste vide.</b> Avant la 1.139.3, PiBoard n'était pas signé par un certificat stable : chaque mise à jour produisait une signature différente, et macOS pouvait garder affichée l'ancienne autorisation (cochée) sans qu'elle s'applique réellement au nouveau binaire — un échec silencieux, sans message. Depuis la 1.139.3 (signature Developer ID + notarisation, voir la fiche « Application de bureau macOS »), la signature reste stable d'une mise à jour à l'autre, ce qui évite ce décalage. Si le problème persiste malgré tout, retirez PiBoard de la liste « Réseau local » (ou réinitialisez-la via <code>tccutil reset LocalNetwork</code> dans le Terminal, lequel exige que Terminal ait lui-même l'accès complet au disque), puis relancez PiBoard pour obtenir une nouvelle demande d'autorisation.</p>

<h4>Nommer vos appareils</h4>
          <p>Beaucoup d'appareils ne renvoient aucun nom d'hôte (téléphones Android, objets connectés) ou en renvoient un peu parlant (« DESKTOP-4K7J1QA »). Le bouton ✎ à droite de chaque ligne permet de leur donner le nom de votre choix (« Imprimante bureau », « Téléphone de Marie »…) : touchez-le, saisissez le nom, validez avec ✓ ou la touche Entrée. Vider le champ puis valider supprime le nom personnalisé et redonne le nom détecté automatiquement.</p>
          <p>Le nom est associé à l'<b>adresse MAC</b> de l'appareil quand elle est connue, et non à son adresse IP : il reste donc correct même si le routeur attribue une IP différente au prochain redémarrage. Ces noms sont enregistrés côté serveur dans <code>data/netHosts.json</code>, en dehors des fichiers livrés par les mises à jour : ils sont <b>conservés lors d'une mise à jour comme d'une réinstallation complète</b>, et sont inclus dans les sauvegardes/restaurations de configuration.</p>

<h4>Emporter vos noms ailleurs (export / import CSV)</h4>
          <p>Nommer trente appareils représente un vrai travail de saisie. Les boutons <b>Exporter</b> et <b>Importer</b>, en haut de la tuile, rendent cette table transportable : d'un PiBoard à un autre du même réseau, ou vers un PiBoard reconstruit de zéro. L'export télécharge un fichier CSV ouvrable dans un tableur (une ligne par appareil : type, identifiant, nom, date de modification) ; vous pouvez y corriger les noms en masse puis le réimporter.</p>
          <p>L'import <b>complète</b> la table existante : les noms du fichier l'emportent pour les appareils concernés, et les appareils absents du fichier gardent le leur — rien n'est supprimé. Les lignes inutilisables (identifiant invalide, nom vide) sont ignorées une par une plutôt que de faire échouer tout le fichier, et le compte rendu affiché sous les boutons indique combien de noms ont été ajoutés, mis à jour et ignorés.</p>
          <p>Comme les noms sont associés à l'adresse MAC, un fichier importé sur un autre PiBoard du <b>même réseau</b> retrouve les bons appareils tout seul. Sur un autre réseau, seules les lignes MAC resteraient pertinentes : les lignes associées à une adresse IP y désigneraient d'autres appareils.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Sous-réseau à analyser (CIDR, optionnel)</span><span class="help-opt-desc">Laissez vide pour détecter automatiquement le réseau du Pi (recommandé). Exemple pour le forcer : 192.168.1.0/24. Limité à /22 (1024 adresses) au maximum.</span></div>
<div class="help-opt"><span class="help-opt-name">Réanalyser automatiquement toutes les (minutes)</span><span class="help-opt-desc">En minutes ; 0 (par défaut) désactive l'analyse automatique, seul le bouton de la tuile déclenche une analyse.</span></div>
<div class="help-opt"><span class="help-opt-name">Séparateur CSV de l'export</span><span class="help-opt-desc">Point-virgule pour un tableur configuré en français (par défaut), virgule pour le format international. À l'import le séparateur est détecté automatiquement, quel qu'il soit.</span></div>
<p class="help-opt-group">Autres possibilités</p>
<div class="help-opt"><span class="help-opt-name">Renommer un appareil</span><span class="help-opt-desc">Ne se règle pas ici mais directement sur la tuile : le bouton ✎ de chaque ligne. Les noms sont conservés lors des mises à jour et des réinstallations.</span></div>
`,
        en: `
<span class="help-size">Size: 4×4 by default, from 3×2 to 8×10</span>

<h4>Goal</h4>
<p>See what is connected to the local network, without opening the router's admin page.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>List of active devices</b>: host name and IP address.</li>
  <li><b>Custom names</b> for your devices, remembered by MAC address and kept after a reinstall.</li>
  <li><b>CSV export and import</b> of your names, to find them on another machine (separator of your choice).</li>
  <li>Automatic <b>rescan</b> at the chosen interval.</li>
</ul>

<h4>Possibilities</h4>
          <p>The scan combines three means: a <b>UDP probe</b> to every address in the subnet, sent by PiBoard itself, which forces the system to resolve the destination's hardware (MAC) address and thereby fills the ARP table; a <b>ping</b> of every address; then a <b>read of the ARP table</b> right after, to also catch devices whose firewall blocks ping (an ARP table fills in regardless of that setting, since it's needed for routing). A hostname is then looked up via reverse DNS for each device found; failing that, only the IP address is shown. The Pi itself always appears in the list, highlighted. No data ever leaves the local network. A scan takes roughly 10–20 seconds depending on the network's size — the "Scan now" button on the tile re-runs it at any time.</p>
          <p><b>Why a UDP probe on top of the ping.</b> A device may well ignore ping while being perfectly present: a Windows PC on a "public network" profile, a printer, a camera. ARP works at layer 2 and cannot be filtered — it always answers. The probe therefore brings those devices out. The datagram goes to port 9 ("discard"), defined by the standard precisely to be ignored: no device acts on it and no reply is expected — only the filling of the ARP table is sought.</p>
          <p><b>On a Mac it is indispensable.</b> macOS grants the "Local Network" permission to a specific process. As long as PiBoard delegated the sweep to the <code>ping</code> command — a system program, run as a separate process — the packets were <b>dropped silently</b>, with no error at all: the scan returned only the Mac itself and the few already-known addresses. The probe being sent by PiBoard directly, the granted permission finally applies. If the scan stays empty on a Mac, check that PiBoard appears under <b>System Settings → Privacy &amp; Security → Local Network</b>, toggle on.</p>
          <p><b>If the toggle is already on but the scan stays empty.</b> Before 1.139.3, PiBoard was not signed with a stable certificate: each update produced a different signature, and macOS could keep the old permission displayed (checked) without it actually applying to the new binary — a silent failure, with no message. Since 1.139.3 (Developer ID signature + notarization, see the "macOS desktop app" card), the signature stays stable from one update to the next, which avoids this drift. If the problem persists anyway, remove PiBoard from the "Local Network" list (or reset it with <code>tccutil reset LocalNetwork</code> in Terminal, which requires Terminal itself to have Full Disk Access), then relaunch PiBoard to get a fresh permission prompt.</p>

<h4>Naming your devices</h4>
          <p>Many devices report no hostname at all (Android phones, IoT gadgets) or an unhelpful one ("DESKTOP-4K7J1QA"). The ✎ button at the right of each row lets you give them a name of your own ("Office printer", "Marie's phone"…): tap it, type the name, confirm with ✓ or the Enter key. Clearing the field and confirming removes the custom name and restores the auto-detected one.</p>
          <p>The name is tied to the device's <b>MAC address</b> when known, not to its IP address: it therefore stays correct even if the router hands out a different IP on the next reboot. These names are stored server-side in <code>data/netHosts.json</code>, outside the files shipped by updates: they are <b>kept across updates as well as full reinstalls</b>, and are included in configuration backups/restores.</p>

<h4>Taking your names elsewhere (CSV export / import)</h4>
          <p>Naming thirty devices is real typing work. The <b>Export</b> and <b>Import</b> buttons at the top of the tile make that table portable: from one PiBoard to another on the same network, or to a PiBoard rebuilt from scratch. Export downloads a CSV file openable in a spreadsheet (one row per device: type, identifier, name, modification date); you can fix names in bulk there and import it back.</p>
          <p>Import <b>adds to</b> the existing table: the file's names win for the devices it covers, and devices absent from the file keep theirs — nothing is deleted. Unusable rows (invalid identifier, empty name) are skipped one by one rather than failing the whole file, and the report shown under the buttons says how many names were added, updated and ignored.</p>
          <p>Since names are tied to the MAC address, a file imported on another PiBoard of the <b>same network</b> finds the right devices by itself. On a different network only the MAC rows would stay relevant: rows tied to an IP address would point at other devices there.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">Subnet to scan (CIDR, optional)</span><span class="help-opt-desc">Leave empty to auto-detect the Pi's own network (recommended). Example to force it: 192.168.1.0/24. Limited to /22 (1024 addresses) at most.</span></div>
<div class="help-opt"><span class="help-opt-name">Auto-rescan every (minutes)</span><span class="help-opt-desc">In minutes; 0 (default) disables automatic scanning, only the tile's button triggers a scan.</span></div>
<div class="help-opt"><span class="help-opt-name">CSV separator for export</span><span class="help-opt-desc">Semicolon for a French-configured spreadsheet (default), comma for the international format. On import the separator is detected automatically, whichever it is.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Rename a device</span><span class="help-opt-desc">Not set here but directly on the tile: the ✎ button on each row. Names are kept across updates and reinstalls.</span></div>
`
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
<p>Voir l'état du trafic routier autour de chez vous, en temps réel, avec les données de l'application TomTom.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Carte</b> centrée sur votre ville, au zoom choisi.</li>
  <li><b>Flux de circulation</b> coloré (style et épaisseur réglables), <b>incidents</b> (style au choix) et <b>bouchons</b>, chacun masquable.</li>
  <li><b>Calendrier de rafraîchissement</b> pour rester dans le quota gratuit : rapide pendant vos plages de trajet du matin et du soir, plus lent le reste du temps, en pause pendant la plage silencieuse.</li>
  <li>Clé TomTom gratuite, partagée avec la tuile Trajet domicile-travail ; fond de carte CARTO.</li>
</ul>

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
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Emplacement &amp; carte</p>
<div class="help-opt"><span class="help-opt-name">Clé API TomTom</span><span class="help-opt-desc">Nécessaire pour toute donnée de trafic. Une offre gratuite est proposée par TomTom.</span></div>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte.</span></div>
<div class="help-opt"><span class="help-opt-name">Niveau de zoom</span><span class="help-opt-desc">Zoom initial de la carte (ajustable ensuite librement à l'écran, y compris au pincer-zoomer tactile).</span></div>
<div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager (routier coloré), sombre, clair, ou automatique selon le thème du tableau.</span></div>
<p class="help-opt-group">Affichage du trafic</p>
<div class="help-opt"><span class="help-opt-name">Afficher le flux de circulation (routes colorées)</span><span class="help-opt-desc">Les routes colorées selon la fluidité du trafic.</span></div>
<div class="help-opt"><span class="help-opt-name">Style de coloration du flux</span><span class="help-opt-desc">Plusieurs styles TomTom : relatif (écart à la vitesse normale, recommandé), absolu (vitesse réelle), retard seul (masque les axes fluides), sensibilité réduite (gros bouchons uniquement).</span></div>
<div class="help-opt"><span class="help-opt-name">Épaisseur des tronçons de flux</span><span class="help-opt-desc">Largeur du tracé des routes colorées.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les incidents (accidents, travaux)</span><span class="help-opt-desc">Accidents, travaux, fermetures.</span></div>
<div class="help-opt"><span class="help-opt-name">Style des icônes d'incidents</span><span class="help-opt-desc">De lignes seules (discret) à icônes détaillées avec chevrons, ou variante adaptée à un fond sombre.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les bouchons en tracés cliquables (avec retard estimé)</span><span class="help-opt-desc">Tracés cliquables avec retard estimé, colorés selon la gravité. Activé par défaut.</span></div>
<p class="help-opt-group">Rafraîchissement</p>
<div class="help-opt"><span class="help-opt-name">Plage active du matin — début</span><span class="help-opt-desc">Par défaut : « 07:00 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Plage active du matin — durée (minutes, 0 = désactivée)</span><span class="help-opt-desc">De 0 à 360, par défaut 60.</span></div>
<div class="help-opt"><span class="help-opt-name">Plage active du soir — début</span><span class="help-opt-desc">Par défaut : « 17:00 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Plage active du soir — durée (minutes, 0 = désactivée)</span><span class="help-opt-desc">De 0 à 360, par défaut 120.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes) pendant les plages actives</span><span class="help-opt-desc">De 1 à 30, par défaut 2.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes) hors plages actives</span><span class="help-opt-desc">De 2 à 120, par défaut 15.</span></div>
<div class="help-opt"><span class="help-opt-name">Plage silencieuse — début (aucun rafraîchissement)</span><span class="help-opt-desc">Par défaut : « 22:00 ».</span></div>
<div class="help-opt"><span class="help-opt-name">Plage silencieuse — fin</span><span class="help-opt-desc">Pendant la plage silencieuse, la carte garde son dernier état connu, avec un petit indicateur « donnée figée », sans consommer aucune requête. Mettez la même heure de début et de fin pour désactiver complètement la plage silencieuse. Par défaut : « 05:00 ».</span></div>
<p class="help-opt-group">Autres possibilités</p>
<div class="help-opt"><span class="help-opt-name">Clé CARTO (réglages généraux)</span><span class="help-opt-desc">Le fond de carte vient de CARTO, qui exige désormais une clé. Elle est <b>gratuite</b>, s'obtient en deux minutes sur <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, et se saisit <b>une seule fois</b> dans les réglages généraux (engrenage), section « Cartes » : elle sert aux trois tuiles cartographiques. Sans elle, la carte fonctionne toujours mais chaque tuile d'image est barrée d'un filigrane « API KEY REQUIRED ». PiBoard ne peut pas embarquer de clé : CARTO les délivre par client et interdit de les partager entre projets sans lien.</span></div>
<div class="help-opt"><span class="help-opt-name">Calendrier de rafraîchissement</span><span class="help-opt-desc">Plages matin/après-midi (heure de début, durée), rythme rapide pendant ces plages, rythme normal en dehors, et plage silencieuse (nuit) sans aucune requête.</span></div>
`,
        en: `
<span class="help-size">Size: 6×8 by default, from 4×3 to 12×16 (minimum raised to prevent the legend and refresh button from overlapping)</span>

<h4>Goal</h4>
<p>See the road traffic around you in real time, with the TomTom app's own data.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Map</b> centred on your city, at the chosen zoom.</li>
  <li>Coloured <b>traffic flow</b> (adjustable style and thickness), <b>incidents</b> (style of your choice) and <b>jams</b>, each can be hidden.</li>
  <li><b>Refresh schedule</b> to stay within the free quota: fast during your morning and evening commute windows, slower otherwise, paused during the quiet window.</li>
  <li>Free TomTom key, shared with the Commute tile; CARTO basemap.</li>
</ul>

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
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Location &amp; map</p>
<div class="help-opt"><span class="help-opt-name">TomTom API key</span><span class="help-opt-desc">Needed for any traffic data. A free tier is offered by TomTom.</span></div>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center.</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom level</span><span class="help-opt-desc">Initial map zoom (freely adjustable afterwards on screen, including touch pinch-zoom).</span></div>
<div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager (colored, roads), dark, light, or automatic following the board's theme.</span></div>
<p class="help-opt-group">Traffic display</p>
<div class="help-opt"><span class="help-opt-name">Show traffic flow (colored roads)</span><span class="help-opt-desc">Roads colored by how smoothly traffic is moving.</span></div>
<div class="help-opt"><span class="help-opt-name">Flow coloring style</span><span class="help-opt-desc">Several TomTom styles: relative (deviation from normal speed, recommended), absolute (actual speed), delay only (hides free-flowing roads), reduced sensitivity (major jams only).</span></div>
<div class="help-opt"><span class="help-opt-name">Flow segment thickness</span><span class="help-opt-desc">Width of the colored road traces.</span></div>
<div class="help-opt"><span class="help-opt-name">Show incidents (accidents, roadworks)</span><span class="help-opt-desc">Accidents, roadworks, closures.</span></div>
<div class="help-opt"><span class="help-opt-name">Incident icon style</span><span class="help-opt-desc">From lines only (subtle) to detailed icons with chevrons, or a variant suited to a dark base map.</span></div>
<div class="help-opt"><span class="help-opt-name">Show jams as clickable traces (with estimated delay)</span><span class="help-opt-desc">Clickable traces with estimated delay, colored by severity. On by default.</span></div>
<p class="help-opt-group">Refresh schedule</p>
<div class="help-opt"><span class="help-opt-name">Morning active window — start</span><span class="help-opt-desc">Default: "07:00".</span></div>
<div class="help-opt"><span class="help-opt-name">Morning active window — duration (minutes, 0 = disabled)</span><span class="help-opt-desc">From 0 to 360, default 60.</span></div>
<div class="help-opt"><span class="help-opt-name">Afternoon active window — start</span><span class="help-opt-desc">Default: "17:00".</span></div>
<div class="help-opt"><span class="help-opt-name">Afternoon active window — duration (minutes, 0 = disabled)</span><span class="help-opt-desc">From 0 to 360, default 120.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh every (minutes) during active windows</span><span class="help-opt-desc">From 1 to 30, default 2.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh every (minutes) outside active windows</span><span class="help-opt-desc">From 2 to 120, default 15.</span></div>
<div class="help-opt"><span class="help-opt-name">Quiet period — start (no refresh)</span><span class="help-opt-desc">Morning/afternoon windows (start time, duration), fast pace during those windows, normal pace outside, and a quiet window (night) with no requests at all. Default: "22:00".</span></div>
<div class="help-opt"><span class="help-opt-name">Quiet period — end</span><span class="help-opt-desc">During the quiet period the map keeps showing its last known state, with a small "stale data" indicator, and uses no API requests at all. Set start and end to the same time to disable the quiet period entirely. Default: "05:00".</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">CARTO key (general settings)</span><span class="help-opt-desc">The base map comes from CARTO, which now requires a key. It is <b>free</b>, takes two minutes to obtain at <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, and is typed <b>once</b> in the general settings (gear), under "Maps": it serves all three map tiles. Without it the map still works but every image tile is stamped with an "API KEY REQUIRED" watermark. PiBoard cannot ship a key: CARTO issues them per customer and forbids sharing them across unrelated projects.</span></div>
`
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
<p>Identifier l'avion qui passe au-dessus de chez vous, avec les données ouvertes de suivi de vol.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Carte des avions en vol</b> autour de votre ville, dans le rayon et au zoom choisis, les plus proches en priorité (nombre maximal réglable).</li>
  <li><b>Icônes orientées</b> avec indicatif et altitude, et <b>traînée</b> pointillée du trajet récent en option.</li>
  <li><b>Départ et arrivée</b> d'un avion d'un toucher, quand ils sont connus.</li>
  <li><b>Compas</b> en surimpression (position et opacité réglables) pour comparer le cap d'un avion à un point cardinal réel.</li>
  <li>Réseau ADS-B communautaire gratuit et sans clé : adsb.lol ou adsb.fi, au choix.</li>
</ul>

<h4>Possibilités</h4>
          <p>La carte se centre sur la ville choisie, indépendamment des tuiles Météo et Radar météo, avec le même choix de fond de carte que la tuile Trafic. Chaque avion est une icône orientée selon son cap réel, avec une étiquette indicatif + altitude (format aviation : niveau de vol FLxxx au-dessus de 10 000 ft, pieds en dessous, « Sol » pour un appareil au sol), et en option une fine traînée pointillée montrant son trajet récent (se construit progressivement à partir du chargement de la tuile). Toucher un avion ouvre une popup recherchant sa ville de départ et d'arrivée auprès d'adsbdb.com, une base communautaire gratuite qui associe indicatifs de vol et trajets — cette information n'est pas transmise par l'ADS-B lui-même, seuls les vols commerciaux/réguliers dotés d'un indicatif reconnu ont un résultat. Une seconde base (hexdb.io) est interrogée en repli — non seulement quand la première ne connaît pas l'indicatif, mais aussi quand elle est <b>injoignable</b>, ce qui augmente sensiblement le nombre de vols documentés. Cette seconde base ne renvoyant que des codes OACI bruts (« LEMG-LOWW »), ceux-ci sont ensuite traduits en <b>nom d'aéroport ou de ville</b> (LFBO → Toulouse-Blagnac), le code restant affiché à côté en petit — il est court, précis, et c'est lui qu'on lit sur un billet. Les noms résolus sont gardés en mémoire pour la session : au-dessus d'une ville, les mêmes aéroports reviennent en permanence. Le <b>nom de la compagnie</b> est de la même façon retrouvé à partir des trois premières lettres de l'indicatif (AUA454 → Austrian Airlines), grâce à une table embarquée dans PiBoard — elle fonctionne donc même sans connexion, mais reste forcément partielle : une compagnie absente laisse simplement la ligne vide. Une immatriculation (F-GKXA) n'est pas lue comme un indicatif de compagnie, faute de quoi un avion privé se verrait attribuer une compagnie au hasard. En parallèle, le <b>modèle de l'appareil et son exploitant</b> sont recherchés à partir du code hex — présent sur <i>tous</i> les avions, contrairement à l'indicatif de vol : la popup affiche donc quelque chose d'utile même pour les nombreux appareils sans trajet connu (aviation générale, privé, vols non réguliers).</p>
          <p><b>Trajets incohérents signalés.</b> La base associe un indicatif de vol à <i>un</i> trajet, de façon statique — or un même indicatif est réutilisé d'un jour à l'autre, parfois pour des liaisons différentes, et la donnée peut simplement être datée ou erronée. La position réelle de l'avion est donc confrontée au trajet annoncé : si l'écart est manifeste (plus de 500 km de détour, tolérance volontairement large pour ne pas jeter le doute sur un déroutement ou une attente légitimes), le trajet est affiché barré, accompagné d'un avertissement ⚠. Mieux vaut dire « cette donnée semble fausse » que la présenter comme un fait. La flèche de chaque avion pointe vers son <b>cap réel actuel</b> (la direction dans laquelle il vole à cet instant), pas vers sa destination finale — ces deux caps peuvent différer sensiblement juste après un décollage ou pendant un guidage par le contrôle aérien, ce qui est normal. Un avion dont le cap n'est pas transmis à cet instant s'affiche en icône neutre (un simple rond) plutôt que de pointer arbitrairement vers le nord. Le cap brut est rappelé en petit dans la popup de trajet, pour vérification. Un <b>compas en surimpression</b> optionnel — une rose des vents fixe, nord toujours en haut comme la carte elle-même — permet de comparer directement l'orientation d'une icône d'avion à un point cardinal réel, en un coup d'œil. Les avions en squawk d'urgence (7500/7600/7700) sont mis en évidence en rouge. Le nombre d'avions est plafonné et trié par proximité (les plus proches d'abord), pour rester lisible même en zone à fort trafic. Deux réseaux communautaires équivalents sont proposés (adsb.lol et adsb.fi, même format de données) : si l'un a un trou de couverture ou une panne près de chez vous, essayez l'autre.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Emplacement &amp; carte</p>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte.</span></div>
<div class="help-opt"><span class="help-opt-name">Réseau ADS-B</span><span class="help-opt-desc">adsb.lol ou adsb.fi.</span></div>
<div class="help-opt"><span class="help-opt-name">Rayon de recherche (milles nautiques)</span><span class="help-opt-desc">En milles nautiques, autour de la ville choisie.</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom initial</span><span class="help-opt-desc">Ajustable ensuite librement à l'écran.</span></div>
<div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager, sombre, clair, ou automatique selon le thème du tableau.</span></div>
<p class="help-opt-group">Compas</p>
<div class="help-opt"><span class="help-opt-name">Afficher un compas en surimpression</span><span class="help-opt-desc">Activé par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Position</span><span class="help-opt-desc">L'un des quatre coins de la carte. En bas à droite par défaut.</span></div>
<div class="help-opt"><span class="help-opt-name">Opacité (%)</span><span class="help-opt-desc">De 10 à 100 %, pour qu'il reste discret sans gêner la lecture de la carte en dessous.</span></div>
<p class="help-opt-group">Affichage</p>
<div class="help-opt"><span class="help-opt-name">Afficher indicatif et altitude</span><span class="help-opt-desc">Étiquette sous chaque avion.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher les traînées</span><span class="help-opt-desc">Fine ligne pointillée derrière chaque avion. Se construit à partir du chargement de la tuile, pas d'historique disponible avant.</span></div>
<div class="help-opt"><span class="help-opt-name">Nombre max d'avions (les plus proches d'abord)</span><span class="help-opt-desc">Les plus proches du centre sont affichés en priorité.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (secondes)</span><span class="help-opt-desc">Intervalle en secondes entre deux mises à jour des positions.</span></div>
<p class="help-opt-group">Autres possibilités</p>
<div class="help-opt"><span class="help-opt-name">Clé CARTO (réglages généraux)</span><span class="help-opt-desc">Le fond de carte vient de CARTO, qui exige désormais une clé. Elle est <b>gratuite</b>, s'obtient en deux minutes sur <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, et se saisit <b>une seule fois</b> dans les réglages généraux (engrenage), section « Cartes » : elle sert aux trois tuiles cartographiques. Sans elle, la carte fonctionne toujours mais chaque tuile d'image est barrée d'un filigrane « API KEY REQUIRED ». PiBoard ne peut pas embarquer de clé : CARTO les délivre par client et interdit de les partager entre projets sans lien.</span></div>
`,
        en: `
<span class="help-size">Size: 6×6 by default, from 3×3 to 12×16</span>

<h4>Goal</h4>
<p>Identify the plane flying over your home, with open flight-tracking data.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Map of planes in flight</b> around your city, within the chosen radius and zoom, nearest first (adjustable maximum).</li>
  <li><b>Oriented icons</b> with call sign and altitude, and an optional dotted <b>trail</b> of the recent path.</li>
  <li>A plane's <b>departure and arrival</b> with a touch, when known.</li>
  <li>Overlay <b>compass</b> (adjustable position and opacity) to compare a plane's heading with a real compass point.</li>
  <li>Free, key-less community ADS-B network: adsb.lol or adsb.fi, your choice.</li>
</ul>

<h4>Possibilities</h4>
          <p>The map centers on the chosen city, independent from the Weather and Weather Radar tiles, with the same choice of base map as the Traffic tile. Each aircraft is an icon oriented by its actual heading, with a callsign + altitude label (aviation-style: flight level FLxxx above 10,000 ft, feet below that, "Ground" for an aircraft on the ground), and optionally a thin dashed trail showing its recent path (builds up progressively from when the tile loads). Tapping an aircraft opens a popup that looks up its departure and arrival city via adsbdb.com, a free community database matching flight callsigns to routes — this information isn't transmitted by ADS-B itself, only commercial/scheduled flights with a recognized callsign will get a result. A second database (hexdb.io) is queried as a fallback — not only when the first does not know the callsign, but also when it is <b>unreachable</b>, which noticeably increases the number of documented flights. As that second database only returns raw ICAO codes ("LEMG-LOWW"), these are then resolved into an <b>airport or city name</b> (LFBO → Toulouse-Blagnac), the code staying displayed alongside in small type — it is short, precise, and it is what one reads on a ticket. Resolved names are kept in memory for the session: above a city, the same airports come back constantly. The <b>airline name</b> is likewise recovered from the callsign's first three letters (AUA454 → Austrian Airlines), thanks to a table bundled with PiBoard — it therefore works even with no connection, but is necessarily partial: a missing airline simply leaves the line empty. A registration (F-GKXA) is not read as an airline callsign, without which a private aircraft would be assigned a random airline. In parallel, the <b>aircraft model and its operator</b> are looked up from the hex code — present on <i>every</i> aircraft, unlike the flight callsign: the popup therefore shows something useful even for the many aircraft with no known route (general aviation, private, non-scheduled flights).</p>
          <p><b>Inconsistent routes flagged.</b> The database maps a flight callsign to <i>one</i> route, statically — but the same callsign gets reused from day to day, sometimes for different legs, and the data can simply be stale or wrong. The aircraft's actual position is therefore checked against the announced route: if the gap is blatant (over 500 km of detour, a deliberately generous tolerance so as not to cast doubt on a legitimate reroute or holding pattern), the route is shown struck through, with a ⚠ warning. Better to say "this data looks wrong" than to present it as fact. Each aircraft's arrow points to its <b>current actual heading</b> (the direction it's flying right now), not its final destination — the two can differ noticeably just after takeoff or while being vectored by air traffic control, which is normal. An aircraft whose heading isn't being transmitted at that moment shows as a neutral icon (a plain circle) rather than arbitrarily pointing north. The raw heading is recalled small in the route popup, for verification. An optional <b>compass overlay</b> — a fixed compass rose, north always up like the map itself — lets you compare an aircraft icon's orientation directly against a real cardinal direction, at a glance. Aircraft squawking an emergency code (7500/7600/7700) are highlighted in red. Aircraft count is capped and sorted by proximity (closest first), to stay legible even in high-traffic areas. Two equivalent community networks are offered (adsb.lol and adsb.fi, same data format): if one has a coverage gap or an outage near you, try the other.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Location &amp; map</p>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center.</span></div>
<div class="help-opt"><span class="help-opt-name">ADS-B network</span><span class="help-opt-desc">adsb.lol or adsb.fi.</span></div>
<div class="help-opt"><span class="help-opt-name">Search radius (nautical miles)</span><span class="help-opt-desc">In nautical miles, around the chosen city.</span></div>
<div class="help-opt"><span class="help-opt-name">Initial zoom</span><span class="help-opt-desc">Freely adjustable afterwards on screen.</span></div>
<div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager, dark, light, or automatic following the board's theme.</span></div>
<p class="help-opt-group">Compass</p>
<div class="help-opt"><span class="help-opt-name">Show a compass overlay</span><span class="help-opt-desc">On by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Position</span><span class="help-opt-desc">One of the map's four corners. Bottom right by default.</span></div>
<div class="help-opt"><span class="help-opt-name">Opacity (%)</span><span class="help-opt-desc">From 10 to 100%, to keep it discreet without hindering the map underneath.</span></div>
<p class="help-opt-group">Display</p>
<div class="help-opt"><span class="help-opt-name">Show callsign and altitude labels</span><span class="help-opt-desc">Label under each aircraft.</span></div>
<div class="help-opt"><span class="help-opt-name">Show flight trails</span><span class="help-opt-desc">Thin dashed line behind each aircraft. Builds up from when the tile loads, no history available before that.</span></div>
<div class="help-opt"><span class="help-opt-name">Max aircraft shown (closest first)</span><span class="help-opt-desc">Those closest to the center are shown first.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (seconds)</span><span class="help-opt-desc">Interval in seconds between two position updates.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">CARTO key (general settings)</span><span class="help-opt-desc">The base map comes from CARTO, which now requires a key. It is <b>free</b>, takes two minutes to obtain at <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, and is typed <b>once</b> in the general settings (gear), under "Maps": it serves all three map tiles. Without it the map still works but every image tile is stamped with an "API KEY REQUIRED" watermark. PiBoard cannot ship a key: CARTO issues them per customer and forbids sharing them across unrelated projects.</span></div>
`
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
<p>La météo actuelle et celle du lendemain d'un coup d'œil, illustrées par une vraie photo des conditions.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Conditions actuelles</b> pour la ville choisie, avec une <b>photo de fond</b> selon le temps (ou une icône).</li>
  <li><b>Modèle météo</b> au choix : Open-Meteo, Météo-France, ECMWF, DWD, MET Norway, NOAA, ou votre propre source.</li>
  <li><b>Prévision du lendemain</b>, disposée selon la forme de la tuile ; <b>vent</b>, <b>lever et coucher du soleil</b> et <b>saint du jour</b> en option.</li>
  <li><b>« Pluie dans ~15 min »</b> quand la pluie est imminente.</li>
  <li><b>Vue détaillée</b> d'un toucher : 24 prochaines heures (température, risque de pluie, icône), 7 jours, indice UV et rafales.</li>
</ul>

<h4>Possibilités</h4>
          <p>Toutes les sources (sauf « Personnalisé ») passent par l'API gratuite et sans clé d'Open-Meteo, qui agrège plusieurs modèles météorologiques nationaux. Par défaut, « Meilleure correspondance » choisit automatiquement le meilleur modèle pour votre lieu — un bon choix pour la plupart des usages. Si les prévisions vous semblent régulièrement décalées, un modèle national précis (Météo-France pour la France, DWD pour l'Allemagne, etc.) fait parfois mieux localement que le choix automatique. La disposition de la prévision du lendemain s'adapte automatiquement à la forme de la tuile : côte à côte sur une tuile large, empilée sur une tuile haute, ou masquée sur une tuile presque carrée pour laisser plus de place à la météo du jour. Le saint du jour, une tradition française, peut s'ajouter sous la météo du jour et, si la prévision du lendemain est affichée, sous celle-ci également. Une ligne « pluie dans ~X min » apparaît automatiquement sur la tuile quand de la pluie est détectée dans l'heure qui vient — sans avoir besoin de cliquer, et sans rester affichée en permanence. Toucher la tuile ouvre une vue détaillée : les 24 prochaines heures (température, probabilité de pluie, et une icône météo pour chaque heure), les 7 prochains jours affichés en une rangée de colonnes façon coup d'œil sur la semaine, l'indice UV du jour, les rafales de vent, et l'heure de lever/coucher du soleil. Cette vue détaillée passe toujours par le modèle « Meilleure correspondance », indépendamment du modèle choisi ci-dessus pour la météo du jour même : certains modèles nationaux uniques ont un horizon de prévision plus court que 7 jours ou ne fournissent pas l'indice UV, ce qui produirait sinon des jours incomplets dans la vue détaillée. L'option « Personnalisé » permet de brancher votre propre source (une instance Open-Meteo auto-hébergée, ou un petit proxy que vous écrivez pour reformater les données d'un autre fournisseur météo) pour la météo du jour même — la vue détaillée, elle, continue de fonctionner normalement.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Lieu pour lequel afficher la météo.</span></div>
<div class="help-opt"><span class="help-opt-name">Modèle météo / source</span><span class="help-opt-desc">Meilleure correspondance (automatique), ou un modèle national précis (Météo-France, ECMWF, DWD, MET Norway, NOAA), ou personnalisé.</span></div>
<div class="help-opt"><span class="help-opt-name">URL de prévision personnalisée (utilisé seulement par « Personnalisé »)</span><span class="help-opt-desc">Utilisée seulement par « Personnalisé ». Utilisez <code>{lat}</code> et <code>{lon}</code> comme espaces réservés ; la réponse doit respecter le format JSON exact d'Open-Meteo.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la prévision du lendemain</span><span class="help-opt-desc">La disposition s'adapte automatiquement à la forme de la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le vent</span><span class="help-opt-desc">Ajoute la vitesse du vent.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le lever et le coucher du soleil</span><span class="help-opt-desc">Ajoute une ligne avec les deux heures, sous les informations du jour et — si la colonne de demain est affichée — sous celles de demain. Un <b>soleil</b> pour le lever, un <b>croissant de lune</b> pour le coucher, avec une flèche montante et descendante. Elles proviennent de la requête étendue déjà effectuée pour la fenêtre de détail : activer l'option n'ajoute aucun appel réseau. Ces heures figurent de toute façon dans la fenêtre de détail.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le saint du jour</span><span class="help-opt-desc">Tradition française, visible seulement en français. Inclut le saint du lendemain si sa prévision est affichée.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour.</span></div>
<div class="help-opt"><span class="help-opt-name">Utiliser une photo de fond (repli sur la couleur si indisponible)</span><span class="help-opt-desc">Une vraie photo correspondant aux conditions actuelles (repli sur un fond de couleur si aucune photo n'est disponible).</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 1×1 to 8×4</span>

<h4>Goal</h4>
<p>Current weather and tomorrow's at a glance, illustrated with a real photo of the conditions.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Current conditions</b> for the chosen city, with a <b>background photo</b> matching the weather (or an icon).</li>
  <li><b>Weather model</b> of your choice: Open-Meteo, Météo-France, ECMWF, DWD, MET Norway, NOAA, or your own source.</li>
  <li><b>Tomorrow's forecast</b>, laid out to fit the tile's shape; <b>wind</b>, <b>sunrise and sunset</b> and <b>French name day</b> optional.</li>
  <li><b>"Rain in ~15 min"</b> when rain is imminent.</li>
  <li><b>Detailed view</b> with a touch: next 24 hours (temperature, rain chance, icon), 7 days, UV index and gusts.</li>
</ul>

<h4>Possibilities</h4>
          <p>Every source (except "Custom") goes through Open-Meteo's free, keyless API, which aggregates several national weather models. By default, "Best match" automatically picks the best model for your location — a good choice for most uses. If forecasts consistently seem off, a precise national model (Météo-France for France, DWD for Germany, etc.) sometimes does better locally than the automatic choice. Tomorrow's forecast layout automatically adapts to the tile's shape: side by side on a wide tile, stacked on a tall one, or hidden on a near-square tile to leave more room for today's weather. The name day, a French tradition, can be added below today's weather and, if tomorrow's forecast is shown, below that one too. A "rain in ~X min" line automatically appears on the tile when rain is detected within the coming hour — no need to tap, and it doesn't stay shown permanently. Tapping the tile opens a detailed view: the next 24 hours (temperature, rain chance, and a weather icon for each hour), the next 7 days shown as a row of columns for a week-at-a-glance, today's UV index, wind gusts, and sunrise/sunset time. This detailed view always goes through the "Best match" model, independent from the model chosen above for today's own weather: some single national models have a forecast horizon shorter than 7 days or don't provide the UV index, which would otherwise produce incomplete days in the detailed view. The "Custom" option lets you plug in your own source (a self-hosted Open-Meteo instance, or a small proxy you write to reformat data from another weather provider) for today's own weather — the detailed view keeps working normally either way.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Location to show weather for.</span></div>
<div class="help-opt"><span class="help-opt-name">Weather model / source</span><span class="help-opt-desc">Best match (automatic), or a precise national model (Météo-France, ECMWF, DWD, MET Norway, NOAA), or custom.</span></div>
<div class="help-opt"><span class="help-opt-name">Custom forecast URL (only used by "Custom")</span><span class="help-opt-desc">Used only by "Custom". Use <code>{lat}</code> and <code>{lon}</code> as placeholders; the response must match Open-Meteo's exact JSON format.</span></div>
<div class="help-opt"><span class="help-opt-name">Show tomorrow's forecast</span><span class="help-opt-desc">The layout automatically adapts to the tile's shape.</span></div>
<div class="help-opt"><span class="help-opt-name">Show wind</span><span class="help-opt-desc">Adds wind speed.</span></div>
<div class="help-opt"><span class="help-opt-name">Show sunrise and sunset</span><span class="help-opt-desc">Adds a line with the two times, under today's information and — if the tomorrow column is shown — under tomorrow's. A <b>sun</b> for the rise, a <b>crescent moon</b> for the set, with an upward and a downward arrow. They come from the extended request already made for the detail window: turning the option on adds no network call. These times appear in the detail window anyway.</span></div>
<div class="help-opt"><span class="help-opt-name">Show name day (French tradition)</span><span class="help-opt-desc">French tradition, only shown in French. Includes tomorrow's name day if its forecast is shown.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two updates.</span></div>
<div class="help-opt"><span class="help-opt-name">Use a photo background (falls back to color if unavailable)</span><span class="help-opt-desc">A real photo matching current conditions (falls back to a color background if no photo is available).</span></div>
`
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
<p>Un coup d'œil sur la pollution de l'air et les pollens, pour ajuster une sortie ou l'aération — sans se substituer à un avis médical.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Indice européen de qualité de l'air</b> pour la ville choisie.</li>
  <li><b>Pollens</b> : bouleau, graminées, ambroisie, aulne, armoise, olivier, chacun affiché ou masqué.</li>
  <li><b>Deux affichages</b> : compact (indice et polluant ou pollen dominant) ou détaillé (tous les polluants et pollens).</li>
  <li>Données Open-Meteo (prévisions CAMS pour l'Europe), gratuites et sans clé.</li>
</ul>

<h4>Possibilités</h4>
          <p>L'indice de qualité de l'air européen (EAQI) résume cinq polluants (PM2.5, PM10, NO₂, O₃, SO₂) en un seul niveau, du « Bon » à l'« Extrêmement mauvais ». Deux affichages : compact (l'indice global, le polluant qui tire l'indice vers le haut, et le pollen dominant en saison) ou détaillé (le détail chiffré de chaque polluant et de chaque pollen actuellement en saison). La visibilité des pollens se règle indépendamment pour chaque affichage — masquer le détail des pollens en mode détaillé n'empêche pas de garder le pollen dominant en mode compact, et inversement. Les pollens ne sont disponibles que pour l'Europe et seulement pour les espèces actuellement en saison ; l'échelle de niveau (nul/faible/modéré/élevé) est volontairement simplifiée pour un coup d'œil rapide.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Lieu pour lequel afficher la qualité de l'air.</span></div>
<div class="help-opt"><span class="help-opt-name">Affichage</span><span class="help-opt-desc">Compact (indice + polluant/pollen dominant) ou détaillé (détail complet).</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le pollen dominant (affichage compact)</span><span class="help-opt-desc">S'applique uniquement à l'affichage compact.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher le détail des pollens (affichage détaillé)</span><span class="help-opt-desc">S'applique uniquement à l'affichage détaillé, indépendamment du réglage compact ci-dessus. Bouleau, graminées, ambroisie, aulne, armoise, olivier — les espèces hors saison sont simplement omises.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">Intervalle en minutes entre deux mises à jour.</span></div>
`,
        en: `
<span class="help-size">Size: 3×2 by default, from 2×2 to 6×5</span>

<h4>Goal</h4>
<p>A glance at air pollution and pollen, to plan an outing or airing — not a substitute for medical advice.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>European air quality index</b> for the chosen city.</li>
  <li><b>Pollen</b>: birch, grass, ragweed, alder, mugwort, olive, each shown or hidden.</li>
  <li><b>Two displays</b>: compact (index and dominant pollutant or pollen) or detailed (all pollutants and pollen).</li>
  <li>Open-Meteo data (CAMS forecasts for Europe), free and key-less.</li>
</ul>

<h4>Possibilities</h4>
          <p>The European Air Quality Index (EAQI) summarizes five pollutants (PM2.5, PM10, NO₂, O₃, SO₂) into a single level, from "Good" to "Extremely poor". Two displays: compact (the overall index, the pollutant driving it up, and the dominant pollen in season) or detailed (the numeric breakdown of every pollutant and every currently in-season pollen). Pollen visibility is set independently for each display — hiding the pollen breakdown in the detailed display doesn't stop the dominant pollen from showing in the compact one, and vice versa. Pollen data is only available for Europe and only for species currently in season; the level scale (none/low/moderate/high) is deliberately simplified for a quick glance.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Location to show air quality for.</span></div>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Choices: Compact (index + dominant pollutant/pollen), Detailed (full breakdown). Default: Compact (index + dominant pollutant/pollen).</span></div>
<div class="help-opt"><span class="help-opt-name">Show dominant pollen (compact display)</span><span class="help-opt-desc">Applies only to the compact display.</span></div>
<div class="help-opt"><span class="help-opt-name">Show pollen breakdown (detailed display)</span><span class="help-opt-desc">Applies only to the detailed display, independently from the compact setting above. Birch, grass, ragweed, alder, mugwort, olive — out-of-season species are simply omitted.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">Interval in minutes between two updates.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">Display</span><span class="help-opt-desc">Compact (index + dominant pollutant/pollen) or detailed (full breakdown).</span></div>
`
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
<p>Voir la pluie arriver ou s'éloigner sur une vraie carte.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Boucle radar</b> des précipitations sur les 2 dernières heures, centrée sur la ville choisie, au zoom et à l'opacité réglables ; légende en option.</li>
  <li><b>Lecture</b> automatique ou non, vitesse réglable, pause et image par image.</li>
  <li><b>Couche vent</b> optionnelle : grille de flèches (direction et force) qui suit la zone affichée, avec densité, valeurs et légende au choix.</li>
  <li>Ville, zoom et fond de carte indépendants de la tuile Météo ; données RainViewer gratuites et sans clé.</li>
</ul>

<h4>Possibilités</h4>
          <p>La carte se centre sur la ville choisie, indépendamment de la tuile Météo, avec le même choix de fond de carte que les tuiles Trafic et Avions en vue. Les contrôles lecture/pause et image par image restent accessibles directement sur la tuile ; chaque image est préchargée et mise en cache pour une animation fluide, sans rechargement à chaque boucle. La légende (optionnelle) rappelle que les couleurs vont du bleu clair (précipitations légères) au rose (extrême), d'après l'échelle « Universal Blue » de RainViewer — la seule disponible sur l'offre gratuite.</p>
          <p>Une <b>couche vent</b> optionnelle superpose une grille de flèches montrant le vent actuel. Chaque flèche pointe <b>vers où souffle le vent</b> (et non d'où il vient, contrairement à la convention météo brute) et sa couleur indique sa force, d'après les paliers de l'échelle de Beaufort — du vert (calme) au violet (tempête), avec sa propre légende pour ne pas la confondre avec celle de la pluie. La grille se recalcule sur la zone affichée à chaque zoom ou déplacement : zoomer resserre naturellement les flèches sur ce que vous regardez. Toutes les positions sont demandées en une seule requête à Open-Meteo, et la densité est réglable — chaque flèche étant un point interrogé, une grille plus dense sollicite davantage le service gratuit.</p>
          <p style="margin-top:12px"><i>RainViewer a définitivement retiré les images de prévision (« nowcast ») de son offre gratuite au 1ᵉʳ janvier 2026 — seul l'historique des 2 dernières heures reste disponible sans clé. C'est pour cette raison qu'il n'y a pas de mode prévision ici.</i></p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Emplacement &amp; carte</p>
<div class="help-opt"><span class="help-opt-name">Ville</span><span class="help-opt-desc">Centre de la carte, indépendant de la tuile Météo.</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom initial</span><span class="help-opt-desc">Ajustable ensuite librement à l'écran.</span></div>
<div class="help-opt"><span class="help-opt-name">Fond de carte</span><span class="help-opt-desc">Voyager, sombre, clair, ou automatique selon le thème du tableau.</span></div>
<p class="help-opt-group">Radar</p>
<div class="help-opt"><span class="help-opt-name">Opacité du radar (%)</span><span class="help-opt-desc">Transparence de la couche de précipitations sur le fond de carte.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la légende des couleurs</span><span class="help-opt-desc">Petite barre de référence, du léger (bleu) à l'extrême (rose).</span></div>
<p class="help-opt-group">Vent</p>
<div class="help-opt"><span class="help-opt-name">Afficher les flèches de vent</span><span class="help-opt-desc">Active la couche vent (désactivée par défaut).</span></div>
<div class="help-opt"><span class="help-opt-name">Densité des flèches</span><span class="help-opt-desc">Faible, moyenne ou élevée. La grille s'adapte aussi à la forme de la tuile.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la vitesse (km/h) sous chaque flèche</span><span class="help-opt-desc">En km/h. Utile sur une tuile large, vite chargé sur une petite.</span></div>
<div class="help-opt"><span class="help-opt-name">Afficher la légende des couleurs du vent</span><span class="help-opt-desc">Barre de référence du calme (vert) à la tempête (violet).</span></div>
<p class="help-opt-group">Radar</p>
<div class="help-opt"><span class="help-opt-name">Lecture automatique de la boucle</span><span class="help-opt-desc">Démarre l'animation dès le chargement.</span></div>
<div class="help-opt"><span class="help-opt-name">Délai entre images (ms)</span><span class="help-opt-desc">Vitesse de l'animation, en millisecondes.</span></div>
<div class="help-opt"><span class="help-opt-name">Rafraîchissement (minutes)</span><span class="help-opt-desc">RainViewer publie une nouvelle image toutes les ~10 minutes.</span></div>
<p class="help-opt-group">Autres possibilités</p>
<div class="help-opt"><span class="help-opt-name">Clé CARTO (réglages généraux)</span><span class="help-opt-desc">Le fond de carte vient de CARTO, qui exige désormais une clé. Elle est <b>gratuite</b>, s'obtient en deux minutes sur <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, et se saisit <b>une seule fois</b> dans les réglages généraux (engrenage), section « Cartes » : elle sert aux trois tuiles cartographiques. Sans elle, la carte fonctionne toujours mais chaque tuile d'image est barrée d'un filigrane « API KEY REQUIRED ». PiBoard ne peut pas embarquer de clé : CARTO les délivre par client et interdit de les partager entre projets sans lien.</span></div>
`,
        en: `
<span class="help-size">Size: 6×6 by default, from 3×3 to 12×16</span>

<h4>Goal</h4>
<p>Watch rain approach or move away on a real map.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Radar loop</b> of precipitation over the last 2 hours, centred on the chosen city, with adjustable zoom and opacity; legend optional.</li>
  <li><b>Playback</b> automatic or not, adjustable speed, pause and frame by frame.</li>
  <li>Optional <b>wind layer</b>: a grid of arrows (direction and strength) following the area shown, with density, values and legend as you choose.</li>
  <li>City, zoom and basemap independent of the Weather tile; free, key-less RainViewer data.</li>
</ul>

<h4>Possibilities</h4>
          <p>The map centers on the chosen city, independent from the Weather tile, with the same choice of base map as the Traffic and Planes Overhead tiles. Play/pause and step controls stay right on the tile; each frame is preloaded and cached for a smooth animation, with no reloading on every loop. The optional legend is a reminder that colors range from light blue (light precipitation) to pink (extreme), based on RainViewer's "Universal Blue" scale — the only one available on the free tier.</p>
          <p>An optional <b>wind layer</b> overlays a grid of arrows showing the current wind. Each arrow points <b>where the wind is blowing to</b> (not where it comes from, unlike the raw meteorological convention) and its color shows the strength, following the Beaufort scale's thresholds — from green (calm) to purple (storm), with its own legend so it can't be confused with the rain one. The grid is recomputed over the displayed area on every zoom or pan: zooming in naturally tightens the arrows onto what you're looking at. Every position is requested in a single call to Open-Meteo, and the density is adjustable — since each arrow is one queried point, a denser grid asks more of the free service.</p>
          <p style="margin-top:12px"><i>RainViewer permanently removed forecast ("nowcast") frames from its free tier on January 1, 2026 — only the last 2 observed hours remain available without a key. That's why there's no forecast mode here.</i></p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Location &amp; map</p>
<div class="help-opt"><span class="help-opt-name">City</span><span class="help-opt-desc">Map center, independent from the Weather tile.</span></div>
<div class="help-opt"><span class="help-opt-name">Initial zoom</span><span class="help-opt-desc">Freely adjustable afterwards on screen.</span></div>
<div class="help-opt"><span class="help-opt-name">Base map</span><span class="help-opt-desc">Voyager, dark, light, or automatic following the board's theme.</span></div>
<p class="help-opt-group">Radar</p>
<div class="help-opt"><span class="help-opt-name">Radar opacity (%)</span><span class="help-opt-desc">Transparency of the precipitation layer over the base map.</span></div>
<div class="help-opt"><span class="help-opt-name">Show color legend</span><span class="help-opt-desc">Small reference bar, from light (blue) to extreme (pink).</span></div>
<p class="help-opt-group">Wind</p>
<div class="help-opt"><span class="help-opt-name">Show wind arrows</span><span class="help-opt-desc">Turns the wind layer on (off by default).</span></div>
<div class="help-opt"><span class="help-opt-name">Arrow density</span><span class="help-opt-desc">Low, medium or high. The grid also adapts to the tile's shape.</span></div>
<div class="help-opt"><span class="help-opt-name">Show wind speed (km/h) under each arrow</span><span class="help-opt-desc">In km/h. Handy on a wide tile, quickly cluttered on a small one.</span></div>
<div class="help-opt"><span class="help-opt-name">Show the wind color legend</span><span class="help-opt-desc">Reference bar from calm (green) to storm (purple).</span></div>
<p class="help-opt-group">Radar</p>
<div class="help-opt"><span class="help-opt-name">Autoplay the loop</span><span class="help-opt-desc">Starts the animation as soon as it loads.</span></div>
<div class="help-opt"><span class="help-opt-name">Frame delay (ms)</span><span class="help-opt-desc">Animation speed, in milliseconds.</span></div>
<div class="help-opt"><span class="help-opt-name">Refresh (minutes)</span><span class="help-opt-desc">RainViewer publishes a new frame roughly every 10 minutes.</span></div>
<p class="help-opt-group">Other possibilities</p>
<div class="help-opt"><span class="help-opt-name">CARTO key (general settings)</span><span class="help-opt-desc">The base map comes from CARTO, which now requires a key. It is <b>free</b>, takes two minutes to obtain at <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>, and is typed <b>once</b> in the general settings (gear), under "Maps": it serves all three map tiles. Without it the map still works but every image tile is stamped with an "API KEY REQUIRED" watermark. PiBoard cannot ship a key: CARTO issues them per customer and forbids sharing them across unrelated projects.</span></div>
`
      }
    },

    {
      id: "webview",
      group: "tiles",
      title: { fr: "Page web", en: "Web page" },
      sub: {
        fr: "Affiche jusqu'à 5 pages web, basculables par onglets. Fonctionne d'emblée avec la plupart des sites.",
        en: "Displays up to 5 web pages, switchable via tabs. Works out of the box with most sites."
      },
      html: {
        fr: `
<span class="help-size">Taille : 6×4 par défaut, de 2×2 à 12×16</span>

<h4>Objectif</h4>
<p>Intégrer une ou plusieurs pages web dans une tuile, pour tout service que PiBoard ne propose pas lui-même.</p>
<p><b>Ce que la tuile sait faire :</b></p>
<ul>
  <li><b>Jusqu'à 5 sites</b>, basculables par <b>onglets</b>, chacun avec son adresse et son libellé.</li>
  <li><b>Affichage natif</b> dans l'application de bureau ; sur Raspberry Pi, les sites qui refusent l'affichage en cadre sont le plus souvent débloqués automatiquement.</li>
  <li><b>Mode « Image »</b> : une capture de la page, rafraîchie régulièrement, qui fonctionne partout.</li>
  <li><b>Rechargement</b> automatique à l'intervalle choisi.</li>
</ul>

<h4>Plusieurs sites, par onglets</h4>
          <p>Jusqu'à 5 sites peuvent être configurés (« Site 1 » à « Site 5 »). Dès qu'un deuxième site est renseigné, une barre d'onglets apparaît en haut de la tuile pour basculer de l'un à l'autre — masquée tant qu'un seul site est configuré, pour ne rien encombrer inutilement. Un nom d'onglet personnalisé peut être donné à chacun ; à défaut, le nom de domaine du site est utilisé. Un petit bouton ⟳ sur chaque onglet permet de rafraîchir sa page à tout moment, y compris celui déjà affiché (un simple clic sur l'onglet actif, lui, ne fait rien). Seul l'onglet actif est réellement chargé : passer d'un onglet à l'autre remplace le contenu affiché plutôt que de garder les 5 sites actifs en même temps.</p>

<h4>Dans l'application de bureau Windows : affichage natif, sans aucun réglage</h4>
          <p>PiBoard tourne alors dans Electron, qui dispose d'une capacité qu'un navigateur ordinaire n'a pas : afficher un site tiers en <b>ignorant totalement son en-tête X-Frame-Options</b>, tout en le gardant pleinement interactif (défilement, clics, formulaires) et en lui laissant charger ses ressources normalement. C'est le comportement automatique dans ce cas — les modes d'affichage ci-dessous n'ont alors d'effet que si le mode « Image » est choisi explicitement.</p>

<h4>Sur Raspberry Pi (ou si le mode « Image » est choisi) : un site qui n'affiche rien ? C'est presque toujours réglé automatiquement</h4>
          <p>De nombreux sites — les sites municipaux et institutionnels français en particulier, souvent par conformité RGS/ANSSI — bloquent volontairement leur affichage en cadre (iframe) pour des raisons de sécurité anti-détournement. Sans solution de contournement, cela produit une tuile silencieusement vide, sans le moindre message d'erreur visible. Le mode d'affichage <b>« Via PiBoard »</b> (activé par défaut) contourne ce blocage : la page est récupérée par le serveur PiBoard puis relayée depuis sa propre adresse, ce qui rend ce blocage sans effet. Si malgré tout la page ne peut pas être récupérée (site injoignable, page introuvable…), un message clair l'indique directement dans la tuile plutôt qu'un vide silencieux.</p>
          <p>Limite assumée de ce mode : le contenu s'affiche correctement (texte, images, mise en forme), mais un site très fortement interactif (une application web complète, pas un simple site vitrine) peut perdre certaines fonctionnalités qui dépendent d'appels réseau internes au site. Le mode <b>« Direct »</b> reste disponible pour les sites qui autorisent explicitement leur affichage en iframe : plus rapide (pas de détour serveur) et garde le site pleinement interactif.</p>

<h4>Le mode « Image » : la solution qui marche partout</h4>
          <p>Si aucun des autres modes n'affiche correctement un site, le mode <b>« Image »</b> y arrivera : la page est rendue par un <i>vrai navigateur</i> lancé sur le PiBoard lui-même (le JavaScript s'exécute normalement), puis PiBoard affiche une photo du résultat. Comme il n'y a plus ni cadre ni relais de code, il ne reste plus rien qu'un site puisse bloquer — c'est aussi le seul mode qui a un effet visible dans l'application de bureau Windows, décrite plus haut.</p>
          <p>La contrepartie est réelle et vaut d'être connue avant de choisir ce mode : l'affichage est <b>fixe</b> — pas de défilement, pas de clic, pas de formulaire. Il convient à une page que l'on consulte du regard (page d'accueil, tableau de bord, page de statut), pas à un service avec lequel on interagit. Chaque rafraîchissement lance un navigateur et prend quelques secondes sur un Raspberry Pi : mieux vaut un intervalle de rechargement généreux (10 minutes ou plus). Ce mode utilise Chromium, déjà installé sur un Raspberry Pi en mode kiosque — c'est le navigateur qui affiche PiBoard lui-même, donc rien de plus à installer dans ce cas.</p>

<h4>Options</h4>
<p class="help-sub">Dans l'ordre de la fenêtre de réglages de la tuile, avec les libellés exacts.</p>
<p class="help-opt-group">Site 1 (obligatoire)</p>
<div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">L'adresse à afficher. « https:// » est ajouté automatiquement si omis. Seul le Site 1 est obligatoire.</span></div>
<div class="help-opt"><span class="help-opt-name">Nom de l'onglet (optionnel)</span><span class="help-opt-desc">Optionnel. Reprend le nom de domaine du site si laissé vide.</span></div>
<p class="help-opt-group">Site 2 (optionnel)</p>
<div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">« https:// » est ajouté automatiquement si vous ne le tapez pas. Laissez vide pour désactiver cet onglet.</span></div>
<div class="help-opt"><span class="help-opt-name">Nom de l'onglet (optionnel)</span><span class="help-opt-desc">Affiché sur l'onglet. Reprend le nom de domaine du site si laissé vide.</span></div>
<p class="help-opt-group">Site 3 (optionnel)</p>
<div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">« https:// » est ajouté automatiquement si vous ne le tapez pas. Laissez vide pour désactiver cet onglet.</span></div>
<div class="help-opt"><span class="help-opt-name">Nom de l'onglet (optionnel)</span><span class="help-opt-desc">Affiché sur l'onglet. Reprend le nom de domaine du site si laissé vide.</span></div>
<p class="help-opt-group">Site 4 (optionnel)</p>
<div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">« https:// » est ajouté automatiquement si vous ne le tapez pas. Laissez vide pour désactiver cet onglet.</span></div>
<div class="help-opt"><span class="help-opt-name">Nom de l'onglet (optionnel)</span><span class="help-opt-desc">Affiché sur l'onglet. Reprend le nom de domaine du site si laissé vide.</span></div>
<p class="help-opt-group">Site 5 (optionnel)</p>
<div class="help-opt"><span class="help-opt-name">URL de la page</span><span class="help-opt-desc">« https:// » est ajouté automatiquement si vous ne le tapez pas. Laissez vide pour désactiver cet onglet.</span></div>
<div class="help-opt"><span class="help-opt-name">Nom de l'onglet (optionnel)</span><span class="help-opt-desc">Affiché sur l'onglet. Reprend le nom de domaine du site si laissé vide.</span></div>
<div class="help-opt"><span class="help-opt-name">Mode d'affichage</span><span class="help-opt-desc">Via PiBoard (par défaut, contourne la plupart des blocages), Direct (plus rapide, nécessite l'autorisation du site) ou Image (marche partout, mais affichage fixe). Sans effet dans l'application de bureau Windows, sauf en mode Image.</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom (%)</span><span class="help-opt-desc">Pourcentage de zoom appliqué à la page affichée.</span></div>
<div class="help-opt"><span class="help-opt-name">Recharger toutes les (minutes, 0 = jamais)</span><span class="help-opt-desc">Intervalle en minutes entre deux rechargements automatiques de l'onglet actif (0 = jamais).</span></div>
`,
        en: `
<span class="help-size">Size: 6×4 by default, from 2×2 to 12×16</span>

<h4>Goal</h4>
<p>Embed one or more web pages in a tile, for any service PiBoard doesn't offer itself.</p>
<p><b>What the tile can do:</b></p>
<ul>
  <li><b>Up to 5 sites</b>, switched by <b>tabs</b>, each with its address and label.</li>
  <li><b>Native display</b> in the desktop app; on a Raspberry Pi, sites that refuse to be framed are usually unblocked automatically.</li>
  <li><b>"Image" mode</b>: a screenshot of the page, refreshed regularly, that works everywhere.</li>
  <li>Automatic <b>reload</b> at the chosen interval.</li>
</ul>

<h4>Several sites, via tabs</h4>
          <p>Up to 5 sites can be configured ("Site 1" through "Site 5"). As soon as a second site is filled in, a tab bar appears at the top of the tile to switch between them — hidden while only one site is configured, so nothing is cluttered needlessly. A custom tab name can be given to each; otherwise the site's domain name is used. A small ⟳ button on each tab refreshes its page at any time, including the one already shown (a plain click on the active tab does nothing). Only the active tab is actually loaded: switching tabs replaces the displayed content rather than keeping all 5 sites active at once.</p>

<h4>In the Windows desktop app: native display, no setting needed</h4>
          <p>PiBoard then runs inside Electron, which has a capability a plain browser doesn't: displaying a third-party site while <b>completely ignoring its X-Frame-Options header</b>, while keeping it fully interactive (scrolling, clicks, forms) and letting it load its resources normally. This is the automatic behavior in that case — the display modes below then only matter if "Image" mode is explicitly chosen.</p>

<h4>On Raspberry Pi (or if "Image" mode is chosen): a site showing nothing? That's almost always handled automatically</h4>
          <p>Many sites — French municipal and institutional sites in particular, often for RGS/ANSSI compliance — deliberately block being shown in a frame (iframe) for anti-clickjacking security reasons. With no workaround, this produces a silently empty tile, with no visible error message at all. The <b>"Via PiBoard"</b> display mode (on by default) works around this block: the page is fetched by the PiBoard server then relayed from its own address, which makes that block ineffective. If the page still can't be fetched at all (unreachable site, page not found…), a clear message says so right in the tile instead of a silent void.</p>
          <p>Accepted limitation of this mode: content displays correctly (text, images, layout), but a very heavily interactive site (a full web application, not a simple showcase site) may lose some features that depend on network calls internal to the site. <b>"Direct"</b> mode remains available for sites that explicitly allow being shown in an iframe: faster (no server round-trip) and keeps the site fully interactive.</p>

<h4>"Image" mode: the one that works everywhere</h4>
          <p>If no other mode displays a site correctly, <b>"Image"</b> mode will: the page is rendered by a <i>real browser</i> launched on the PiBoard itself (JavaScript runs normally), then PiBoard shows a photo of the result. Since there's no longer a frame or relayed code, there's nothing left for a site to block — it's also the only mode with any visible effect in the Windows desktop app, described above.</p>
          <p>The trade-off is real and worth knowing before choosing this mode: the display is <b>static</b> — no scrolling, no clicking, no forms. It suits a page you just look at (home page, dashboard, status page), not a service you interact with. Each refresh launches a browser and takes a few seconds on a Raspberry Pi: a generous reload interval (10 minutes or more) is best. This mode uses Chromium, already installed on a Raspberry Pi in kiosk mode — it's the very browser displaying PiBoard, so nothing extra to install in that case.</p>

<h4>Options</h4>
<p class="help-sub">In the order of the tile's settings window, with the exact labels.</p>
<p class="help-opt-group">Site 1 (required)</p>
<div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">The address to show. "https://" is added automatically if left out. Only Site 1 is required.</span></div>
<div class="help-opt"><span class="help-opt-name">Tab label (optional)</span><span class="help-opt-desc">Optional. Defaults to the site's domain name if left empty.</span></div>
<p class="help-opt-group">Site 2 (optional)</p>
<div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">"https://" is added automatically if left out. Leave empty to disable this tab.</span></div>
<div class="help-opt"><span class="help-opt-name">Tab label (optional)</span><span class="help-opt-desc">Shown on the tab. Defaults to the site's domain name if left empty.</span></div>
<p class="help-opt-group">Site 3 (optional)</p>
<div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">"https://" is added automatically if left out. Leave empty to disable this tab.</span></div>
<div class="help-opt"><span class="help-opt-name">Tab label (optional)</span><span class="help-opt-desc">Shown on the tab. Defaults to the site's domain name if left empty.</span></div>
<p class="help-opt-group">Site 4 (optional)</p>
<div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">"https://" is added automatically if left out. Leave empty to disable this tab.</span></div>
<div class="help-opt"><span class="help-opt-name">Tab label (optional)</span><span class="help-opt-desc">Shown on the tab. Defaults to the site's domain name if left empty.</span></div>
<p class="help-opt-group">Site 5 (optional)</p>
<div class="help-opt"><span class="help-opt-name">Page URL</span><span class="help-opt-desc">"https://" is added automatically if left out. Leave empty to disable this tab.</span></div>
<div class="help-opt"><span class="help-opt-name">Tab label (optional)</span><span class="help-opt-desc">Shown on the tab. Defaults to the site's domain name if left empty.</span></div>
<div class="help-opt"><span class="help-opt-name">Display mode</span><span class="help-opt-desc">Via PiBoard (default, works around most blocks), Direct (faster, requires the site's permission) or Image (works everywhere, but static). No effect in the Windows desktop app, except in Image mode.</span></div>
<div class="help-opt"><span class="help-opt-name">Zoom (%)</span><span class="help-opt-desc">Zoom percentage applied to the shown page.</span></div>
<div class="help-opt"><span class="help-opt-name">Reload every (minutes, 0 = never)</span><span class="help-opt-desc">Interval in minutes between two automatic reloads of the active tab (0 = never).</span></div>
`
      }
    },

    /* ================= APPLICATION DE BUREAU MACOS / MACOS DESKTOP APP =================
       Fiche ecrite apres un cas reel : PiBoard etait « impossible a
       faire fonctionner » sur un Mac Apple Silicon, sur plusieurs
       versions d'affilee, faute d'une ligne de Terminal enfouie dans
       docs/LINUX-MACOS.md -- un fichier qu'on ne lit qu'APRES avoir eu
       le probleme, et seulement si l'on sait qu'il existe. Le
       contournement vit donc desormais dans l'aide integree, la ou on
       le cherche.
       Written after a real case: PiBoard was "impossible to run" on an
       Apple Silicon Mac, across several versions, for want of one
       Terminal line buried in docs/LINUX-MACOS.md -- a file one only
       reads AFTER having the problem. */
    {
      id: "macos-app",
      group: "platform",
      title: { fr: "Application de bureau macOS", en: "macOS desktop app" },
      sub: {
        fr: "Signée et notariée depuis la 1.139.3 : plus de blocage Gatekeeper, mise à jour automatique.",
        en: "Signed and notarized since 1.139.3: no more Gatekeeper block, automatic updating."
      },
      html: {
        fr: `
          <h4>Depuis la 1.139.3 : signée et notariée par Apple</h4>
          <p>PiBoard dispose désormais d'un certificat <b>Developer ID Application</b> et est <b>notarisé</b> par Apple à chaque publication officielle. Concrètement : plus de blocage Gatekeeper au premier lancement, plus de commande <code>xattr</code> à retaper après chaque mise à jour, et la <b>mise à jour automatique</b> fonctionne exactement comme sous Windows et Linux — PiBoard télécharge la nouvelle version et l'installe à la fermeture.</p>
          <p>Cette carte reste utile si vous avez téléchargé une <b>version plus ancienne</b> (avant la 1.139.3), ou si vous avez <b>construit PiBoard vous-même</b> depuis le code source sans certificat développeur : dans ces deux cas, l'application n'est pas signée et les symptômes ci-dessous s'appliquent.</p>

          <h4>« PiBoard est endommagé et ne peut pas être ouvert »</h4>
          <p>C'est le message qu'affichait macOS sur une version non signée, et il est <b>trompeur</b> : l'application n'est ni corrompue, ni incomplète, ni mal téléchargée — elle n'est simplement pas notarisée. Sur les Mac Intel, ce refus prenait la forme du message clément « développeur non identifié », qu'un clic droit → <i>Ouvrir</i> suffisait à contourner. Sur les Mac <b>Apple Silicon</b> (M1 et suivants), il prenait la forme sèche d'« endommagé », <b>sans aucune option de contournement</b> dans l'interface.</p>
          <p>Pour une version non signée (construite soi-même, ou antérieure à la 1.139.3), la seule issue reste de retirer l'attribut de quarantaine, dans le Terminal :</p>
          <p><code>xattr -dr com.apple.quarantine /Applications/PiBoard.app</code></p>
          <p>Cette commande agit sur <b>cette copie précise</b> et rien d'autre : aucune protection de macOS n'est désactivée. Sur une version officielle signée (1.139.3 et suivantes, téléchargée depuis les releases GitHub), elle n'a jamais besoin d'être lancée.</p>

          <h4>Versions et architectures</h4>
          <p>macOS 12 (Monterey) et suivants. Deux fichiers sont publiés à chaque version : <code>mac-arm64</code> pour les Mac Apple Silicon (M1, M2, M3, M4…) et <code>mac-x64</code> pour les Mac Intel. Prendre le mauvais fichier fonctionne quand même, par émulation Rosetta, mais consomme plus de mémoire et de batterie — autant prendre le bon.</p>
          <h4>Le menu PiBoard</h4>
          <p>Sur Mac, la barre de menus en haut de l'écran porte deux menus : <b>PiBoard</b> et <b>Édition</b> (indispensable pour copier-coller une clé API avec Cmd+C / Cmd+V).</p>
          <div class="help-opt"><span class="help-opt-name">Recharger</span><span class="help-opt-desc">Recharge le tableau de bord. Raccourci : Cmd+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Plein écran</span><span class="help-opt-desc">F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100 %</span><span class="help-opt-desc">Agrandit ou réduit toute l'interface.</span></div>
          <div class="help-opt"><span class="help-opt-name">Ouvrir le journal</span><span class="help-opt-desc">Ouvre le fichier des messages techniques de PiBoard — utile quand un message d'erreur y renvoie. Il est vidé à chaque lancement.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rechercher une mise à jour</span><span class="help-opt-desc">Vérifie tout de suite s'il existe une nouvelle version.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quitter</span><span class="help-opt-desc">Cmd+Q.</span></div>
          <h4>Mises à jour automatiques</h4>
          <p>Depuis la 1.139.3, l'application vérifie quelques secondes après chaque démarrage, télécharge la nouvelle version en arrière-plan et propose de l'installer — comme sous Windows. Le niveau (stables seulement, ou aussi les pré-versions) se choisit dans Réglages → Mises à jour.</p>
          <h4>Emplacement des données</h4>
          <p>Réglages, tuiles, clés et photos : <code>~/Library/Application Support/PiBoard/data</code>. Journal : <code>~/Library/Application Support/PiBoard/logs/piboard.log</code>. ffmpeg, s'il a été installé par PiBoard, se trouve dans <code>data/ffmpeg</code> ; VLC, dans Applications (ou <code>~/Applications</code> pour un compte standard). Ce dossier est conservé lors d'une mise à jour.</p>`,
        en: `
          <h4>Since 1.139.3: signed and notarized by Apple</h4>
          <p>PiBoard now carries a <b>Developer ID Application</b> certificate and is <b>notarized</b> by Apple on every official release. In practice: no more Gatekeeper block on first launch, no more <code>xattr</code> command to retype after each update, and <b>automatic updating</b> works exactly as on Windows and Linux — PiBoard downloads the new version and installs it when the application closes.</p>
          <p>This card stays useful if you downloaded an <b>older version</b> (before 1.139.3), or <b>built PiBoard yourself</b> from source without a developer certificate: in both cases the application is unsigned and the symptoms below apply.</p>

          <h4>"PiBoard is damaged and can't be opened"</h4>
          <p>This is what macOS showed on an unsigned version, and it is <b>misleading</b>: the application is neither corrupted, nor incomplete, nor badly downloaded — it simply was not notarized. On Intel Macs that refusal took the mild form of "unidentified developer", which a right-click → <i>Open</i> was enough to get past. On <b>Apple Silicon</b> Macs (M1 and later) it took the blunt form of "damaged", <b>with no way around it</b> in the interface.</p>
          <p>For an unsigned version (self-built, or older than 1.139.3), the only way out remains removing the quarantine attribute, in Terminal:</p>
          <p><code>xattr -dr com.apple.quarantine /Applications/PiBoard.app</code></p>
          <p>That command acts on <b>that one copy</b> and nothing else: no macOS protection is turned off. On an official signed version (1.139.3 and later, downloaded from the GitHub releases), it is never needed.</p>

          <h4>Versions and architectures</h4>
          <p>macOS 12 (Monterey) and later. Two files are published with every release: <code>mac-arm64</code> for Apple Silicon Macs (M1, M2, M3, M4…) and <code>mac-x64</code> for Intel Macs. Picking the wrong one still works, through Rosetta emulation, but uses more memory and battery — better to pick the right one.</p>
          <h4>The PiBoard menu</h4>
          <p>On a Mac, the menu bar at the top of the screen holds two menus: <b>PiBoard</b> and <b>Edit</b> (essential to copy-paste an API key with Cmd+C / Cmd+V).</p>
          <div class="help-opt"><span class="help-opt-name">Reload</span><span class="help-opt-desc">Reloads the dashboard. Shortcut: Cmd+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Full screen</span><span class="help-opt-desc">F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100 %</span><span class="help-opt-desc">Enlarges or shrinks the whole interface.</span></div>
          <div class="help-opt"><span class="help-opt-name">Open log</span><span class="help-opt-desc">Opens PiBoard's technical message file — handy when an error message points to it. It is cleared at every launch.</span></div>
          <div class="help-opt"><span class="help-opt-name">Check for updates</span><span class="help-opt-desc">Checks right away for a new version.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quit</span><span class="help-opt-desc">Cmd+Q.</span></div>
          <h4>Automatic updates</h4>
          <p>Since 1.139.3, the application checks a few seconds after each start, downloads the new version in the background and offers to install it — as on Windows. The level (stable only, or pre-releases too) is chosen in Settings → Updates.</p>
          <h4>Data location</h4>
          <p>Settings, tiles, keys and photos: <code>~/Library/Application Support/PiBoard/data</code>. Log: <code>~/Library/Application Support/PiBoard/logs/piboard.log</code>. ffmpeg, when installed by PiBoard, lives in <code>data/ffmpeg</code>; VLC in Applications (or <code>~/Applications</code> for a standard account). This folder is kept across updates.</p>`
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
          <p>Cette section ne concerne que l'installation de PiBoard en tant qu'application de bureau Windows (via l'installeur <code>.exe</code>). Sur Raspberry Pi, l'affichage est un navigateur en kiosque et rien de ce qui suit ne s'applique — voir la fiche « Mises à jour sur Raspberry Pi / Linux » pour l'équivalent.</p>

          <h4>Le menu caché</h4>
          <p>La fenêtre est volontairement épurée : sa barre de menu est <b>masquée par défaut</b> et rien à l'écran n'indique qu'elle existe. Pour la faire apparaître, <b>appuyez sur la touche <code>Alt</code></b> (seule, sans la maintenir avec une autre touche). Un second appui, ou un clic ailleurs dans la fenêtre, la referme.</p>
          <div class="help-opt"><span class="help-opt-name">Recharger</span><span class="help-opt-desc">Recharge le tableau de bord, comme le bouton de rafraîchissement de l'écran de veille — utile en cas d'affichage figé. Raccourci : Ctrl+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Plein écran</span><span class="help-opt-desc">Bascule entre fenêtre normale et plein écran. Raccourci : F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100 %</span><span class="help-opt-desc">Agrandit ou réduit l'ensemble de l'interface (différent du réglage « Taille du texte » propre à chaque tuile).</span></div>
          <div class="help-opt"><span class="help-opt-name">Outils de développement</span><span class="help-opt-desc">Ouvre la console du navigateur intégré, pour diagnostiquer un problème. Raccourci : F12. Ne montre que ce qui se passe dans la fenêtre elle-même — pas les messages du serveur PiBoard (voir « Ouvrir le journal » ci-dessous pour ceux-là).</span></div>
          <div class="help-opt"><span class="help-opt-name">Ouvrir le journal</span><span class="help-opt-desc">Ouvre un fichier texte listant les messages techniques du serveur PiBoard (celui qui gère les tuiles) — invisibles autrement sous Windows, qui n'affiche pas de console par défaut pour une application installée. Utile pour diagnostiquer un problème sur une tuile (par exemple un échec de récupération de données) : le fichier indique la cause exacte. Remis à zéro à chaque démarrage de l'application.</span></div>
          <div class="help-opt"><span class="help-opt-name">Rechercher une mise à jour</span><span class="help-opt-desc">Voir la section suivante. Aucun raccourci clavier : c'est le seul moyen d'y accéder.</span></div>
          <div class="help-opt"><span class="help-opt-name">Quitter</span><span class="help-opt-desc">Ferme l'application. Raccourci : Alt+F4, qui fonctionne directement sans avoir à ouvrir le menu.</span></div>

          <h4>Mises à jour automatiques</h4>
          <p>L'application vérifie silencieusement l'existence d'une nouvelle version quelques secondes après chaque démarrage — sans rien afficher si elle est déjà à jour. Une mise à jour trouvée propose son téléchargement, puis son installation (l'application se ferme et se relance automatiquement) — rien n'est jamais installé sans confirmation.</p>
          <p>Pour vérifier manuellement à tout moment, ouvrez le menu (<code>Alt</code>) puis <b>Rechercher une mise à jour</b>.</p>

          <h4>Emplacement des données</h4>
          <p>Les réglages, la disposition des tuiles, les clés API et les photos téléversées sont stockés dans <code>%APPDATA%\\PiBoard</code>. Ce dossier est conservé lors d'une mise à jour ou d'une désinstallation — une réinstallation retrouve tout tel quel.</p>`,
        en: `
          <h4>Only relevant on a Windows PC</h4>
          <p>This section only concerns PiBoard installed as a Windows desktop application (via the <code>.exe</code> installer). On Raspberry Pi, the display is a kiosk browser and none of the following applies — see the "Updates on Raspberry Pi / Linux" topic for the equivalent.</p>

          <h4>The hidden menu</h4>
          <p>The window is deliberately clean: its menu bar is <b>hidden by default</b> and nothing on screen hints that it exists. To reveal it, <b>press the <code>Alt</code> key</b> (alone, not held with another key). Pressing it again, or clicking elsewhere in the window, closes it.</p>
          <div class="help-opt"><span class="help-opt-name">Reload</span><span class="help-opt-desc">Reloads the dashboard, like the screensaver's refresh button — useful if the display gets stuck. Shortcut: Ctrl+R.</span></div>
          <div class="help-opt"><span class="help-opt-name">Full screen</span><span class="help-opt-desc">Toggles between a normal window and full screen. Shortcut: F11.</span></div>
          <div class="help-opt"><span class="help-opt-name">Zoom +/-/100%</span><span class="help-opt-desc">Enlarges or shrinks the whole interface (different from each tile's own "Text size" setting).</span></div>
          <div class="help-opt"><span class="help-opt-name">Developer tools</span><span class="help-opt-desc">Opens the built-in browser's console, to diagnose an issue. Shortcut: F12. Only shows what happens inside the window itself — not the PiBoard server's own messages (see "Open log" below for those).</span></div>
          <div class="help-opt"><span class="help-opt-name">Open log</span><span class="help-opt-desc">Opens a text file listing the PiBoard server's technical messages (the one managing the tiles) — otherwise invisible on Windows, which shows no console by default for an installed application. Useful for diagnosing a tile issue (e.g. a failed data fetch): the file states the exact cause. Reset on every app launch.</span></div>
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
      id: "linux-app",
      group: "platform",
      title: { fr: "Application de bureau Linux", en: "Linux desktop app" },
      sub: {
        fr: "Paquet .deb ou AppImage, x64 et arm64 : installation, mises à jour, données.",
        en: ".deb package or AppImage, x64 and arm64: installation, updates, data."
      },
      html: {
        fr: `
          <h4>Pour qui</h4>
          <p>Un PC Linux avec un bureau (GNOME, KDE, XFCE…) qui affiche PiBoard dans une fenêtre, comme sous Windows ou macOS. Pour un Raspberry Pi en kiosque (serveur + Chromium plein écran), voir plutôt <i>Mises à jour sur Raspberry Pi / Linux</i>.</p>
          <h4>Quel fichier choisir</h4>
          <div class="help-opt"><span class="help-opt-name">.deb</span><span class="help-opt-desc">Pour Debian, Ubuntu, Raspberry Pi OS, Mint… S'installe comme tout paquet ; la mise à jour demande le mot de passe administrateur.</span></div>
          <div class="help-opt"><span class="help-opt-name">AppImage</span><span class="help-opt-desc">Un seul fichier exécutable, sans installation ni droits particuliers ; la mise à jour le remplace sur place.</span></div>
          <div class="help-opt"><span class="help-opt-name">x86_64 / amd64 ou arm64</span><span class="help-opt-desc">x86_64 (amd64) pour un PC classique, arm64 pour un Raspberry Pi 4/5 ou une machine ARM.</span></div>
          <h4>Le menu caché</h4>
          <p>Comme sous Windows : la barre de menus est masquée, la touche <b>Alt</b> la fait apparaître (Recharger, Plein écran, Zoom, Ouvrir le journal, Rechercher une mise à jour, Quitter).</p>
          <h4>Mises à jour automatiques</h4>
          <p>Vérification quelques secondes après chaque démarrage, téléchargement en arrière-plan, installation proposée. Le niveau (stables ou pré-versions) se règle dans Réglages → Mises à jour.</p>
          <h4>Démarrage et données</h4>
          <p>« Lancer PiBoard au démarrage de la session » (Réglages → Application de bureau) crée un fichier dans <code>~/.config/autostart</code>. Données : <code>~/.config/PiBoard/data</code> ; journal : <code>~/.config/PiBoard/logs/piboard.log</code>.</p>`,
        en: `
          <h4>Who it is for</h4>
          <p>A Linux PC with a desktop (GNOME, KDE, XFCE…) showing PiBoard in a window, as on Windows or macOS. For a Raspberry Pi in kiosk mode (server + full-screen Chromium), see <i>Updates on Raspberry Pi / Linux</i> instead.</p>
          <h4>Which file to pick</h4>
          <div class="help-opt"><span class="help-opt-name">.deb</span><span class="help-opt-desc">For Debian, Ubuntu, Raspberry Pi OS, Mint… Installs like any package; updating asks for the administrator password.</span></div>
          <div class="help-opt"><span class="help-opt-name">AppImage</span><span class="help-opt-desc">A single executable file, no installation or special rights; updating replaces it in place.</span></div>
          <div class="help-opt"><span class="help-opt-name">x86_64 / amd64 or arm64</span><span class="help-opt-desc">x86_64 (amd64) for a regular PC, arm64 for a Raspberry Pi 4/5 or an ARM machine.</span></div>
          <h4>The hidden menu</h4>
          <p>As on Windows: the menu bar is hidden and the <b>Alt</b> key reveals it (Reload, Full screen, Zoom, Open log, Check for updates, Quit).</p>
          <h4>Automatic updates</h4>
          <p>Checked a few seconds after each start, downloaded in the background, installation offered. The level (stable or pre-releases) is set in Settings → Updates.</p>
          <h4>Startup and data</h4>
          <p>“Launch PiBoard when the session starts” (Settings → Desktop application) creates a file in <code>~/.config/autostart</code>. Data: <code>~/.config/PiBoard/data</code>; log: <code>~/.config/PiBoard/logs/piboard.log</code>.</p>`
      }
    },

    {
      id: "dashboard",
      group: "presentation",
      title: { fr: "Mode tableau de bord (pages)", en: "Dashboard mode (pages)" },
      sub: {
        fr: "Une suite de pages qui se remplacent, sans tiroirs.",
        en: "A series of pages replacing each other, no drawers."
      },
      html: {
        fr: `
          <h4>Deux façons d'afficher PiBoard</h4>
          <p>Le réglage <b>« Façon d'afficher les pages »</b> (réglages généraux → Mode d'affichage) choisit entre :</p>
          <div class="help-opt"><span class="help-opt-name">Classique</span><span class="help-opt-desc">Le mode d'origine, inchangé : un plateau, trois tiroirs escamotables, la barre d'outils en bas de l'écran.</span></div>
          <div class="help-opt"><span class="help-opt-name">Tableau de bord</span><span class="help-opt-desc">Une suite de pages qui se remplacent en glissant. Plus de tiroirs ni de barre d'outils : un fin bandeau au bas de l'écran les remplace.</span></div>
          <p><b>Votre plateau actuel devient la page 1.</b> Il n'est ni déplacé ni recopié : basculer d'un mode à l'autre ne perd rien, et repasser en classique le retrouve exactement tel qu'il était, tiroirs compris. Les pages que vous avez créées ne sont pas détruites pour autant : elles réapparaissent si vous revenez au mode tableau de bord.</p>

          <p>Le <b>panneau de réglages généraux est identique dans les deux modes</b> : même ordre, mêmes sections, rien n'apparaît ni ne disparaît quand vous basculez. La section qui ne sert pas au mode courant — les tiroirs en mode tableau de bord, les pages en mode classique — est simplement grisée, avec un mot d'explication, mais elle <b>reste modifiable</b> : vous pouvez préparer vos pages avant de basculer, et vos largeurs de tiroirs vous attendent au retour.</p>

          <h4>Le bandeau du bas</h4>
          <p>À la souris, il sort dès que le pointeur atteint le bas de l'écran, et rentre quand il s'en éloigne. <b>En mode tactile, une languette reste visible en permanence</b> au milieu du bord inférieur : au doigt il n'y a pas de survol, et sans elle les réglages deviendraient inaccessibles.</p>
          <p><b>En mode tactile, tout le bandeau double de taille</b> — boutons, pastilles de page, languette et zone sensible du bas. Un écran tactile est souvent petit, et c'est précisément là que des commandes dessinées pour une souris deviennent impossibles à viser. Le bandeau se retire de lui-même : la hauteur qu'il occupe n'est payée que pendant qu'on s'en sert.</p>
          <p>Il contient le repérage des pages (cliquez un numéro pour y aller), les flèches page précédente / suivante, et l'accès à l'ajout de tuile, au mode édition, aux réglages généraux et à cette aide. Une zone y est <b>réservée pour l'avenir</b> : elle accueillera des informations défilantes venues de vos tuiles — les titres de vos flux RSS, à la manière des chaînes d'info en continu.</p>

          <h4>Naviguer entre les pages</h4>
          <p>Trois moyens, selon le matériel : les numéros et les flèches du bandeau, un <b>glissement du doigt</b> horizontal sur l'écran tactile, et les <b>flèches gauche/droite du clavier</b> (utile avec une télécommande de présentation ou un clavier sans fil posé près d'un écran mural). Depuis la dernière page, « suivant » revient à la première.</p>

          <h4>Créer et régler les pages</h4>
          <p>Le nombre de pages n'est pas limité. Chaque page se règle dans les réglages généraux :</p>
          <div class="help-opt"><span class="help-opt-name">Nom</span><span class="help-opt-desc">Affiché en infobulle sur son numéro dans le bandeau. Facultatif.</span></div>
          <div class="help-opt"><span class="help-opt-name">Sens</span><span class="help-opt-desc">Le sens du déplacement du regard : « vers la gauche » signifie que la page arrive par la droite, comme quand on tourne une page. Revenir en arrière inverse automatiquement le sens.</span></div>
          <div class="help-opt"><span class="help-opt-name">Effet</span><span class="help-opt-desc"><b>Pousser</b> : les deux pages glissent ensemble, comme une pellicule. <b>Recouvrir</b> : la nouvelle passe par-dessus, l'ancienne ne bouge pas. <b>Découvrir</b> : l'ancienne s'en va et dévoile la nouvelle. <b>Fondu</b> : sans déplacement. <b>Aucun</b> : remplacement immédiat.</span></div>
          <p>Le réglage appartient à la page <b>qui arrive</b> : chaque page décrit la façon dont elle entre. Une tuile ajoutée pendant qu'une page est affichée atterrit <b>sur cette page</b>, pas sur le plateau principal.</p>
          <p><b>Supprimer une page supprime aussi ses tuiles</b> — elles n'existent nulle part ailleurs. Une confirmation est demandée si la page n'est pas vide. La page 1 ne peut pas être supprimée : c'est le plateau principal.</p>

          <h4>Fond de page</h4>
          <p>Chaque page peut porter sa propre <b>image de fond</b>, en plus de la couleur unie du thème. Le bouton <b>▣</b> de la ligne de la page, dans les réglages généraux, ouvre la fenêtre de configuration. C'est ce qui distingue vraiment un tableau de bord d'une grille de tuiles.</p>
          <p>L'image est <b>téléversée sur la machine PiBoard</b> et rangée dans le dossier <code>data/</code> — jamais touché par les mises à jour, et inclus dans les sauvegardes. <b>Chaque page a son propre dossier</b> : supprimer une page n'efface pas le fond d'une autre.</p>
          <div class="help-opt"><span class="help-opt-name">Remplir la page</span><span class="help-opt-desc">L'image couvre tout l'écran, quitte à en rogner les bords. Le choix habituel pour une photo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Image entière</span><span class="help-opt-desc">L'image est visible en totalité, avec des marges si les proportions diffèrent.</span></div>
          <div class="help-opt"><span class="help-opt-name">Taille d'origine</span><span class="help-opt-desc">Aucun redimensionnement. Associé à une position, c'est ce qu'il faut pour un filigrane dans un coin.</span></div>
          <div class="help-opt"><span class="help-opt-name">Étirer</span><span class="help-opt-desc">L'image remplit exactement l'écran, quitte à être déformée.</span></div>
          <div class="help-opt"><span class="help-opt-name">Répéter en mosaïque</span><span class="help-opt-desc">L'image est répétée à sa taille d'origine. Pour une texture ou un motif.</span></div>
          <p>Le réglage <b>« Voile sur l'image »</b> mélange la couleur de fond du thème par-dessus la photo. À 0, la photo est intacte ; à 100, on revient à un fond uni. <b>Montez-le jusqu'à ce que les tuiles redeviennent confortablement lisibles</b> : une photo contrastée rend illisibles les tuiles en fond transparent, et sans ce réglage il faudrait choisir entre un beau fond et un tableau lisible. Le voile passe sous les tuiles, jamais dessus.</p>
          <p><b>Miroir et rotation</b> : deux boutons (miroir horizontal, miroir vertical) et une liste de rotation (90°, 180°, 270°), utiles pour une photo prise dans le mauvais sens ou un logo à retourner. Le miroir s'applique après la rotation, pour toujours correspondre à ce qui est affiché. <b>Le fichier n'est jamais modifié</b> : la même image de la bibliothèque peut être retournée sur une page et intacte sur une autre. Seule exception : sur une page qui déborde (défilement activé) <b>et</b> dont le fond est retourné ou pivoté, ce fond ne défile plus avec le contenu — un cas rare, et sans incidence sur les tuiles elles-mêmes.</p>
          <p>La page 1 étant aussi le plateau du <b>mode classique</b>, celui-ci profite du fond de page sans rien avoir à configurer de plus. Les tiroirs, eux, gardent la couleur du thème.</p>

          <h4>Défilement automatique</h4>
          <p>Un tableau mural n'a personne pour tourner ses pages : sans défilement, les pages 2 et suivantes ne seraient jamais vues. L'option <b>« Passer à la page suivante automatiquement »</b> (réglages généraux → Mode d'affichage) fait défiler les pages en boucle. Elle est <b>désactivée par défaut</b> : un tableau qui se met à tourner tout seul sans qu'on l'ait demandé serait déroutant.</p>
          <p>La durée générale s'applique à toutes les pages, mais <b>chaque page peut fixer la sienne</b> dans la colonne de droite de la liste des pages (laissez le champ vide pour suivre la durée générale — celle-ci apparaît alors en filigrane). C'est utile dès que les pages ne se ressemblent pas : un tableau de valeurs demande plus de temps de lecture qu'une page portant une grande horloge. Minimum 3 secondes.</p>
          <p>Le défilement <b>se suspend tout seul</b> quand il gênerait : en mode édition (vous déplacez des tuiles, la page ne doit pas se dérober) et tant qu'une fenêtre est ouverte (réglages, aide, détails d'une tuile). Il <b>repart de zéro</b> dès que vous changez de page vous-même : quelqu'un qui vient de choisir une page veut la regarder, pas la voir disparaître une seconde plus tard.</p>

          <h4>Ce qu'il faut savoir sur les performances</h4>
          <p><b>Toutes les pages tournent en même temps</b>, pas seulement celle que vous regardez : une tuile Météo en page 3 doit avoir ses données à jour quand la page arrive, pas commencer à les charger à ce moment-là. C'est ce qu'on attend d'un tableau de bord qui défile, mais cela veut dire qu'ajouter des pages consomme des ressources. Sur un Raspberry Pi, si l'affichage devient poussif, la <b>planification horaire</b> de chaque tuile (réglages de la tuile) permet d'endormir ce qui n'a pas besoin de tourner en permanence.</p>`,
        en: `
          <h4>Two ways of displaying PiBoard</h4>
          <p>The <b>"How pages are shown"</b> setting (general settings → Display mode) chooses between:</p>
          <div class="help-opt"><span class="help-opt-name">Classic</span><span class="help-opt-desc">The original mode, unchanged: one board, three retractable drawers, the toolbar at the bottom of the screen.</span></div>
          <div class="help-opt"><span class="help-opt-name">Dashboard</span><span class="help-opt-desc">A series of pages replacing each other by sliding. No more drawers nor toolbar: a thin bar at the bottom of the screen replaces them.</span></div>
          <p><b>Your current board becomes page 1.</b> It is neither moved nor copied: switching between modes loses nothing, and going back to classic finds it exactly as it was, drawers included. The pages you created are not destroyed either: they reappear if you return to dashboard mode.</p>

          <p>The <b>general settings panel is identical in both modes</b>: same order, same sections, nothing appears or disappears when you switch. The section that is idle in the current mode — drawers in dashboard mode, pages in classic mode — is simply dimmed, with a word of explanation, but it <b>stays editable</b>: you can set your pages up before switching, and your drawer widths are waiting for you on the way back.</p>

          <h4>The bottom bar</h4>
          <p>With a mouse it comes out as soon as the pointer reaches the bottom of the screen, and goes back in when it moves away. <b>In touch mode a tab stays permanently visible</b> in the middle of the bottom edge: with a finger there is no hover, and without it the settings would become unreachable.</p>
          <p><b>In touch mode the whole bar doubles in size</b> — buttons, page dots, tab and the bottom hot zone. A touchscreen is often small, and that is exactly where controls drawn for a mouse become impossible to aim at. The bar slides away on its own: the height it takes is only paid while it is in use.</p>
          <p>It holds the page markers (click a number to go there), the previous/next page arrows, and access to adding a tile, edit mode, the general settings and this help. A zone in it is <b>reserved for the future</b>: it will carry scrolling information coming from your tiles — your RSS feed headlines, in the manner of rolling news channels.</p>

          <h4>Moving between pages</h4>
          <p>Three ways, depending on the hardware: the bar's numbers and arrows, a horizontal <b>finger swipe</b> on a touchscreen, and the <b>left/right keyboard arrows</b> (useful with a presentation remote or a wireless keyboard next to a wall screen). From the last page, "next" returns to the first.</p>

          <h4>Creating and setting up pages</h4>
          <p>The number of pages is not limited. Each page is set up in the general settings:</p>
          <div class="help-opt"><span class="help-opt-name">Name</span><span class="help-opt-desc">Shown as a tooltip on its number in the bar. Optional.</span></div>
          <div class="help-opt"><span class="help-opt-name">Direction</span><span class="help-opt-desc">The direction the eye travels: "to the left" means the page arrives from the right, like turning a page. Going back automatically reverses the direction.</span></div>
          <div class="help-opt"><span class="help-opt-name">Effect</span><span class="help-opt-desc"><b>Push</b>: both pages slide together, like a film strip. <b>Cover</b>: the new one passes over, the old one does not move. <b>Uncover</b>: the old one leaves and reveals the new one. <b>Fade</b>: no movement. <b>None</b>: immediate replacement.</span></div>
          <p>The setting belongs to the <b>incoming</b> page: each page describes how it enters. A tile added while a page is displayed lands <b>on that page</b>, not on the main board.</p>
          <p><b>Deleting a page also deletes its tiles</b> — they exist nowhere else. A confirmation is asked if the page is not empty. Page 1 cannot be deleted: it is the main board.</p>

          <h4>Page background</h4>
          <p>Each page can carry its own <b>background image</b>, on top of the theme's plain colour. The <b>▣</b> button on the page's row, in the general settings, opens the configuration window. This is what really distinguishes a dashboard from a grid of tiles.</p>
          <p>The image is <b>uploaded to the PiBoard machine</b> and stored in the <code>data/</code> folder — never touched by updates, and included in backups. <b>Each page has its own folder</b>: deleting a page does not wipe another's background.</p>
          <div class="help-opt"><span class="help-opt-name">Fill the page</span><span class="help-opt-desc">The image covers the whole screen, cropping its edges if need be. The usual choice for a photo.</span></div>
          <div class="help-opt"><span class="help-opt-name">Whole image</span><span class="help-opt-desc">The image is fully visible, with margins if the proportions differ.</span></div>
          <div class="help-opt"><span class="help-opt-name">Original size</span><span class="help-opt-desc">No resizing. Combined with a position, this is what a corner watermark needs.</span></div>
          <div class="help-opt"><span class="help-opt-name">Stretch</span><span class="help-opt-desc">The image fills the screen exactly, distorted if need be.</span></div>
          <div class="help-opt"><span class="help-opt-name">Tile it</span><span class="help-opt-desc">The image is repeated at its original size. For a texture or a pattern.</span></div>
          <p>The <b>"Veil over the image"</b> setting blends the theme's background colour over the photo. At 0 the photo is untouched; at 100 you are back to a plain background. <b>Raise it until the tiles become comfortably readable again</b>: a contrasted photo makes transparent-background tiles unreadable, and without this setting one would have to choose between a nice background and a legible board. The veil goes under the tiles, never over them.</p>
          <p><b>Mirror and rotation</b>: two buttons (flip horizontally, flip vertically) and a rotation list (90°, 180°, 270°), useful for a photo taken in the wrong orientation or a logo that needs flipping. The mirror is applied after rotation, so it always matches what is displayed. <b>The file is never modified</b>: the same library image can be flipped on one page and left untouched on another. One exception: on a page that overflows (scrolling on) <b>and</b> whose background is flipped or rotated, that background no longer scrolls with the content — a rare case, and one with no effect on the tiles themselves.</p>
          <p>As page 1 is also the <b>classic mode</b>'s board, that mode benefits from page backgrounds with nothing more to configure. The drawers keep the theme's colour.</p>

          <h4>Automatic cycling</h4>
          <p>A wall board has nobody to turn its pages: without cycling, pages 2 and beyond would never be seen. The <b>"Move to the next page automatically"</b> option (general settings → Display mode) cycles the pages in a loop. It is <b>off by default</b>: a board starting to cycle on its own without being asked would be baffling.</p>
          <p>The general duration applies to every page, but <b>each page may set its own</b> in the right-hand column of the page list (leave the field empty to follow the general duration — it then shows as a placeholder). This matters as soon as pages differ: a table of figures needs more reading time than a page carrying a large clock. Minimum 3 seconds.</p>
          <p>Cycling <b>suspends itself</b> whenever it would get in the way: in edit mode (you are moving tiles, the page must not slip away) and while a window is open (settings, help, a tile's details). It <b>restarts from zero</b> as soon as you change page yourself: someone who just picked a page wants to look at it, not see it vanish a second later.</p>

          <h4>What to know about performance</h4>
          <p><b>All pages run at the same time</b>, not only the one you are looking at: a Weather tile on page 3 must have fresh data when the page arrives, not start loading then. That is what one expects from a cycling dashboard, but it does mean adding pages costs resources. On a Raspberry Pi, if the display becomes sluggish, each tile's <b>schedule</b> (tile settings) lets you put to sleep whatever does not need to run permanently.</p>`
      }
    },

    {
      id: "linux-update",
      group: "platform",
      title: { fr: "Mises à jour sur Raspberry Pi / Linux", en: "Updates on Raspberry Pi / Linux" },
      sub: {
        fr: "Vérification automatique, installation en un geste, retour arrière.",
        en: "Automatic check, one-tap install, rollback."
      },
      html: {
        fr: `
          <h4>Uniquement pertinent sur Raspberry Pi ou PC Linux</h4>
          <p>Cette section concerne PiBoard installé comme serveur sur Raspberry Pi OS, Debian, Ubuntu, ZorinOS ou toute distribution Linux. Sous Windows, l'application de bureau se met à jour par son propre mécanisme (voir la fiche « Application de bureau Windows ») et la section « Mises à jour » des réglages n'apparaît pas.</p>

          <h4>Vérification automatique</h4>
          <p>Le serveur consulte les versions publiées sur GitHub une vingtaine de secondes après son démarrage, puis toutes les six heures — silencieusement s'il est déjà à jour. Seules les versions <b>effectivement publiées</b> comptent : un brouillon ou une pré-version est ignoré, exactement comme sous Windows. Quand une nouvelle version existe, un <b>bandeau discret</b> apparaît en haut de l'écran : « Mettre à jour » lance l'installation, « Plus tard » le referme jusqu'au prochain démarrage de l'affichage. Pour vérifier à tout moment : réglages généraux (engrenage du tiroir du bas) → section <b>Mises à jour</b> → « Vérifier maintenant ».</p>
          <div class="help-opt"><span class="help-opt-name">Depuis un autre appareil</span><span class="help-opt-desc">La section fonctionne aussi depuis un téléphone ou un PC du réseau local ouvert sur l'adresse du PiBoard : pratique pour un kiosque mural sans clavier. L'écran du kiosque se recharge tout seul une fois la mise à jour terminée.</span></div>

          <h4>Choisir son niveau de mise à jour</h4>
          <p>Le réglage <b>« Mises à jour à installer »</b> (réglages généraux → Mises à jour) décide de ce qui vous est proposé. Il vaut aussi bien pour le serveur (Raspberry Pi, Linux) que pour l'application de bureau Windows, qui lit le même réglage — il reste donc visible partout. Le bouton <b>« Rechercher des mises à jour »</b> l'est aussi : sur le Pi il interroge GitHub depuis le serveur, dans l'application de bureau Windows il déclenche la recherche d'electron-updater, qui affiche ensuite sa propre fenêtre.</p>
          <div class="help-opt"><span class="help-opt-name">Versions stables uniquement</span><span class="help-opt-desc">Par défaut. Seule la version marquée <b>« Latest »</b> sur GitHub est proposée. C'est le choix à laisser sur un tableau mural qui doit simplement fonctionner.</span></div>
          <div class="help-opt"><span class="help-opt-name">Installer aussi les pré-versions</span><span class="help-opt-desc">Les versions marquées <b>« Pre-release »</b> sur GitHub sont également proposées : plus récentes, mais moins éprouvées. Une pré-version est annoncée comme telle dans le bandeau, dans les réglages et dans la fenêtre de confirmation — vous savez toujours ce que vous installez.</span></div>
          <p>Dans les deux cas, les <b>brouillons</b> sont ignorés : une release en brouillon n'a pas d'archive téléchargeable et n'est visible que de vous. Le choix se fait toujours sur le <b>numéro de version le plus élevé</b>, jamais sur la date de publication : republier un correctif ancien après une pré-version plus récente ne fait pas reculer le tableau.</p>
          <p>Changer ce réglage relance immédiatement une vérification : la version proposée vient donc bien du canal que vous venez de choisir. Repasser de « pré-versions » à « stables » alors qu'une pré-version est <b>déjà installée</b> ne la désinstalle pas — aucune mise à jour ne sera simplement proposée tant que la branche stable ne l'aura pas dépassée.</p>

          <h4>Ce qui se passe à l'installation</h4>
          <p>L'archive de la version est téléchargée depuis GitHub, extraite dans <code>data/updates/</code>, puis mise en place : chaque dossier de l'ancienne version est <b>déplacé</b> dans <code>data/updates/previous/</code> avant que le nouveau prenne sa place. Les fichiers supprimés d'une version à l'autre disparaissent donc réellement, contrairement à une archive décompressée par-dessus l'ancienne. Si les dépendances ont changé (fichier <code>package-lock.json</code> différent), <code>npm install</code> est lancé ; sinon cette étape est sautée — un simple correctif s'installe en quelques secondes. Le serveur redémarre ensuite, et le tableau de bord se recharge de lui-même dès que la nouvelle version répond.</p>
          <p><b>Jamais touché :</b> le dossier <code>data/</code> (réglages, disposition, clés, photos), <code>node_modules/</code> (hors action de npm lui-même), et <code>.git/</code> si vous aviez installé par <code>git clone</code>.</p>

          <h4>En cas d'échec</h4>
          <p>Si <code>npm install</code> échoue (pas de réseau vers npm, ou <code>npm</code> absent du système), la version précédente est <b>remise en place automatiquement</b> et le serveur continue de tourner sans redémarrer. La fenêtre indique la cause exacte ; « Réessayer » relance le cycle. Le dossier <code>previous/</code> reste disponible jusqu'à la mise à jour suivante pour une restauration manuelle.</p>

          <h4>Prérequis</h4>
          <p>Le dossier de PiBoard doit appartenir à l'utilisateur qui lance le serveur (c'est le cas après <code>install.sh</code>), et <code>tar</code> doit être présent (toujours vrai sur Debian et dérivés). Le redémarrage automatique s'appuie sur le service <code>systemd</code> installé par <code>install.sh</code> ; si PiBoard a été lancé à la main, il se relance lui-même. Pour désactiver la vérification périodique : variable d'environnement <code>PIBOARD_UPDATE_CHECK=0</code> dans le service (la vérification manuelle reste possible).</p>`,
        en: `
          <h4>Only relevant on a Raspberry Pi or a Linux PC</h4>
          <p>This section concerns PiBoard installed as a server on Raspberry Pi OS, Debian, Ubuntu, ZorinOS or any Linux distribution. On Windows, the desktop application updates through its own mechanism (see the "Windows desktop app" topic) and the "Updates" settings section does not appear.</p>

          <h4>Automatic check</h4>
          <p>The server looks up the versions published on GitHub about twenty seconds after starting, then every six hours — silently if already up to date. Only <b>actually published</b> versions count: a draft or a pre-release is ignored, exactly as on Windows. When a new version exists, a <b>discreet banner</b> appears at the top of the screen: "Update" starts the install, "Later" closes it until the display next starts. To check at any time: general settings (gear in the bottom drawer) → <b>Updates</b> section → "Check now".</p>
          <div class="help-opt"><span class="help-opt-name">From another device</span><span class="help-opt-desc">The section also works from a phone or PC on the local network opened on the PiBoard's address: handy for a keyboard-less wall kiosk. The kiosk screen reloads by itself once the update is done.</span></div>

          <h4>Choosing your update level</h4>
          <p>The <b>"Updates to install"</b> setting (general settings → Updates) decides what gets offered to you. It applies both to the server (Raspberry Pi, Linux) and to the Windows desktop application, which reads the same setting — so it stays visible everywhere. The <b>"Check for updates"</b> button is too: on the Pi it queries GitHub from the server, in the Windows desktop application it triggers electron-updater's own check, which then shows its own window.</p>
          <div class="help-opt"><span class="help-opt-name">Stable versions only</span><span class="help-opt-desc">The default. Only the version marked <b>"Latest"</b> on GitHub is offered. This is the choice to leave on a wall board that simply has to work.</span></div>
          <div class="help-opt"><span class="help-opt-name">Also install pre-releases</span><span class="help-opt-desc">Versions marked <b>"Pre-release"</b> on GitHub are offered too: newer, but less tested. A pre-release is announced as such in the banner, in the settings and in the confirmation window — you always know what you are installing.</span></div>
          <p>Either way, <b>drafts</b> are ignored: a draft release has no downloadable archive and is visible only to you. The pick is always made on the <b>highest version number</b>, never on the publication date: republishing an old fix after a more recent pre-release does not make the board go backwards.</p>
          <p>Changing this setting immediately re-runs a check, so the offered version really comes from the channel you just picked. Switching back from "pre-releases" to "stable" while a pre-release is <b>already installed</b> does not uninstall it — no update will simply be offered until the stable branch overtakes it.</p>

          <h4>What happens during the install</h4>
          <p>The version's archive is downloaded from GitHub, extracted into <code>data/updates/</code>, then put in place: every folder of the old version is <b>moved</b> into <code>data/updates/previous/</code> before the new one takes its place. Files removed between versions therefore really disappear, unlike an archive extracted on top of the old one. If dependencies changed (different <code>package-lock.json</code>), <code>npm install</code> runs; otherwise that step is skipped — a plain fix installs in a few seconds. The server then restarts, and the dashboard reloads on its own as soon as the new version answers.</p>
          <p><b>Never touched:</b> the <code>data/</code> folder (settings, layout, keys, photos), <code>node_modules/</code> (except by npm itself), and <code>.git/</code> if you had installed through <code>git clone</code>.</p>

          <h4>If it fails</h4>
          <p>If <code>npm install</code> fails (no network to npm, or <code>npm</code> missing from the system), the previous version is <b>put back automatically</b> and the server keeps running without restarting. The window states the exact cause; "Retry" runs the cycle again. The <code>previous/</code> folder stays available until the next update for a manual restore.</p>

          <h4>Requirements</h4>
          <p>The PiBoard folder must belong to the user running the server (the case after <code>install.sh</code>), and <code>tar</code> must be present (always true on Debian and derivatives). The automatic restart relies on the <code>systemd</code> service installed by <code>install.sh</code>; if PiBoard was started by hand, it relaunches itself. To disable the periodic check: environment variable <code>PIBOARD_UPDATE_CHECK=0</code> in the service (manual checks remain possible).</p>`
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
          <p>Toujours précédée d'une confirmation explicite : c'est une action irréversible, qui remplace entièrement la configuration actuelle. Après confirmation, la page se recharge pour repartir d'un état propre.</p>
          <h4>Une page seule : la reproduire ailleurs</h4>
          <p>Entre la configuration d'une tuile et le clone de toute l'installation, il manquait l'\u00e9chelon de la <b>page</b>. La section \u00ab Page du tableau de bord \u00bb sauvegarde <b>une page \u00e0 la fois</b> \u2014 ses tuiles et leurs r\u00e9glages, son fond, les images de ses tuiles, et son th\u00e8me propre s'il est personnalis\u00e9 \u2014 dans une archive qu'on emporte. Composer une page soign\u00e9e sur un poste et la retrouver sur un autre ne demande plus de tout refaire \u00e0 la main, ni d'\u00e9craser l'installation d'arriv\u00e9e avec un clone complet.</p>
          <p><b>Les identifiants des tuiles sont r\u00e9g\u00e9n\u00e9r\u00e9s \u00e0 l'import</b>, et ce n'est pas un d\u00e9tail technique. L'identifiant d'une tuile nomme aussi son dossier d'images et sa cl\u00e9 dans le coffre \u00e0 secrets : le conserver ferait \u00e9craser les images et les mots de passe d'une tuile <b>sans aucun rapport</b> portant le m\u00eame identifiant sur la machine d'arriv\u00e9e. Cons\u00e9quence pratique : la m\u00eame page peut \u00eatre import\u00e9e <b>plusieurs fois</b>, chaque copie vivant sa vie.</p>
          <h4>Trois destinations possibles</h4>
          <div class="help-opt"><span class="help-opt-name">Nouvelle page</span><span class="help-opt-desc">Ajout\u00e9e \u00e0 la suite des existantes. Ne touche \u00e0 rien de ce qui est d\u00e9j\u00e0 l\u00e0 \u2014 le choix le plus s\u00fbr.</span></div>
          <div class="help-opt"><span class="help-opt-name">Remplacer une page</span><span class="help-opt-desc">Le contenu de la page choisie est remplac\u00e9. Fonctionne aussi sur le plateau principal.</span></div>
          <div class="help-opt"><span class="help-opt-name">Fusionner</span><span class="help-opt-desc">Les tuiles import\u00e9es s'ajoutent <b>sous</b> celles d\u00e9j\u00e0 pr\u00e9sentes. Les empiler aux m\u00eames coordonn\u00e9es les aurait fait se recouvrir, puis repousser dans un ordre que personne n'aurait choisi.</span></div>
          <p><b>Avant toute \u00e9criture, la configuration est sauvegard\u00e9e</b> : elle appara\u00eet dans la liste ci-dessus, se restaure en un clic, et le rapport d'import propose de la t\u00e9l\u00e9charger. Un aper\u00e7u d\u00e9taill\u00e9 pr\u00e9c\u00e8de l'import \u2014 d'o\u00f9 vient la page, combien de tuiles, quel poids d'images, quels dossiers restent \u00e0 choisir \u2014 et une archive incompl\u00e8te est refus\u00e9e \u00e0 ce stade plut\u00f4t qu'appliqu\u00e9e \u00e0 moiti\u00e9. Se tromper de fichier et pr\u00e9senter un clone complet ne donne pas \u00ab fichier ab\u00eem\u00e9 \u00bb mais \u00ab ceci est un clone complet, pas une page \u00bb.</p>
          <p>Le <b>th\u00e8me</b> de la page voyage avec elle s'il est personnalis\u00e9, et il est ajout\u00e9 \u00e0 l'arriv\u00e9e seulement s'il manque : un th\u00e8me du m\u00eame identifiant d\u00e9j\u00e0 pr\u00e9sent est <b>conserv\u00e9</b>, puisqu'il a pu \u00eatre retouch\u00e9 ici. Les cl\u00e9s de service et les identifiants personnels suivent les m\u00eames deux cases \u00e0 cocher que le clone complet, et seuls ceux des tuiles <b>de cette page</b> sont emport\u00e9s.</p>

          <h4>Clone complet : reconstruire ailleurs</h4>
          <p>La sauvegarde ci-dessus reste <b>locale</b> : elle sert à revenir en arrière sur cette machine. Le <b>clone</b>, lui, est un fichier qu'on <b>emporte</b> — une archive ZIP qui contient en plus les images (fonds d'écran, photos du diaporama, bibliothèque personnelle) et, si vous le demandez, les secrets. Il reconstruit le même tableau de bord sur une autre machine, y compris d'un système à l'autre.</p>
          <h4>Les secrets, en deux familles</h4>
          <p>Une clé TomTom et votre mot de passe de messagerie n'ont pas la même nature, et chaque famille fait l'objet d'une case à cocher distincte :</p>
          <div class="help-opt"><span class="help-opt-name">Clés de service</span><span class="help-opt-desc">TomTom, CARTO, Google… Elles identifient PiBoard auprès d'un fournisseur, pas vous. Les emporter évite de refaire trois inscriptions.</span></div>
          <div class="help-opt"><span class="help-opt-name">Identifiants personnels</span><span class="help-opt-desc">Mot de passe du courriel, jeton Home Assistant, code d'accès de l'imprimante. Décochés par défaut. Si vous les emportez, une <b>phrase de passe</b> facultative chiffre cette partie de l'archive ; sans elle, ils y figurent en clair et le fichier est à traiter comme un trousseau de clés.</span></div>
          <p>Ce qui n'est pas coché ne part pas — y compris les clés qui, aujourd'hui, dorment en clair dans les réglages des tuiles : elles en sont retirées à l'export.</p>
          <h4>Les dossiers suivent</h4>
          <p>C'est le vrai sujet d'un passage de Windows à macOS ou Linux : <code>C:\\Users\\vous\\Videos\\PiBoard</code> n'existe pas ailleurs. À l'import, un dossier <b>standard</b> (Vidéos, Images, Documents, Téléchargements, Musique, Bureau) est <b>retraduit automatiquement</b> vers son équivalent, sous-dossiers compris, et les noms français de Windows sont reconnus. Un dossier qui n'a pas d'équivalent — un disque <code>D:</code>, un partage réseau — vous est <b>demandé</b> avec le sélecteur de dossiers habituel, plutôt que de pointer dans le vide.</p>
          <h4>Ce qui ne voyage jamais</h4>
          <p>L'identité de la <b>machine</b>, par opposition à celle du tableau de bord : l'historique système, les mesures de la ligne internet, les compteurs de quota déjà consommés, et les enregistrements TV programmés. Les importer ferait croire à la nouvelle machine qu'elle a déjà consommé le quota d'une autre.</p>
          <h4>Avant d'écraser</h4>
          <p>L'import se fait en deux temps. Un <b>aperçu</b> d'abord : d'où vient le clone, quelle version, combien de tuiles et de pages, quel poids d'images, et la liste des dossiers — ceux qui ont été retraduits et ceux qui attendent votre choix. Un clone <b>incomplet ou abîmé</b> est refusé à ce stade grâce à une empreinte, plutôt que d'être appliqué à moitié ; un clone venu d'une version plus récente que la vôtre est signalé.</p>
          <p>Ensuite seulement l'écriture, précédée d'une <b>sauvegarde automatique</b> de la configuration actuelle — elle apparaît dans la liste ci-dessus et permet de revenir en arrière en un clic. Un <b>rapport d'import</b> conclut : ce qui a été restauré, et surtout ce qu'il vous reste à faire, comme les secrets que le clone n'emportait pas et qui sont à ressaisir. Sans ce rapport, un clone « réussi » peut laisser trois tuiles muettes sans qu'on comprenne pourquoi.</p>`,
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
          <p>Always preceded by an explicit confirmation: it's an irreversible action that entirely replaces the current configuration. After confirming, the page reloads to start from a clean state.</p>
          <h4>A single page: reproducing it elsewhere</h4>
          <p>Between a tile's configuration and a clone of the whole installation, the <b>page</b> level was missing. The "Dashboard page" section saves <b>one page at a time</b> \u2014 its tiles and their settings, its background, its tiles' images, and its own theme when it is a custom one \u2014 into an archive you carry. Composing a careful page on one machine and finding it on another no longer means redoing everything by hand, nor overwriting the destination with a full clone.</p>
          <p><b>Tile identifiers are regenerated on import</b>, and that is not a technical detail: a tile's id also names its media folder and keys its entry in the secrets vault, so keeping it would overwrite the images and passwords of an <b>entirely unrelated</b> tile carrying the same id on the destination machine. In practice: the same page can be imported <b>several times</b>, each copy living its own life.</p>
          <h4>Three possible destinations</h4>
          <div class="help-opt"><span class="help-opt-name">New page</span><span class="help-opt-desc">Added after the existing ones. Touches nothing already there \u2014 the safest choice.</span></div>
          <div class="help-opt"><span class="help-opt-name">Replace a page</span><span class="help-opt-desc">The chosen page's contents are replaced. Works on the main board too.</span></div>
          <div class="help-opt"><span class="help-opt-name">Merge</span><span class="help-opt-desc">Imported tiles are added <b>below</b> the existing ones. Stacking them on the same coordinates would have them overlap, then be shoved about in an order nobody chose.</span></div>
          <p><b>Before anything is written, the configuration is backed up</b>: it appears in the list above, restores in one click, and the import report offers to download it. A detailed preview precedes the import \u2014 where the page comes from, how many tiles, how much image weight, which folders remain to be chosen \u2014 and an incomplete archive is refused at that stage rather than applied halfway. Picking the wrong file and offering a full clone does not give "damaged file" but "this is a full clone, not a page".</p>
          <p>The page's <b>theme</b> travels with it when it is a custom one, and is added on arrival only if missing: a theme with the same identifier already present is <b>kept</b>, since it may have been reworked here. Service keys and personal credentials follow the same two checkboxes as the full clone, and only those of <b>this page's</b> tiles are carried.</p>

          <h4>Full clone: rebuilding elsewhere</h4>
          <p>The backup above stays <b>local</b>: it is for stepping back on this machine. A <b>clone</b> is a file you <b>carry</b> — a ZIP archive that also holds the images (wallpapers, slideshow photos, personal library) and, if you ask for them, the secrets. It rebuilds the same dashboard on another machine, across operating systems.</p>
          <h4>Secrets, in two families</h4>
          <p>A TomTom key and your mail password are not the same kind of thing, and each family has its own checkbox:</p>
          <div class="help-opt"><span class="help-opt-name">Service keys</span><span class="help-opt-desc">TomTom, CARTO, Google… They identify PiBoard to a provider, not you. Carrying them saves redoing three sign-ups.</span></div>
          <div class="help-opt"><span class="help-opt-name">Personal credentials</span><span class="help-opt-desc">Mail password, Home Assistant token, printer access code. Unticked by default. If you carry them, an optional <b>passphrase</b> encrypts that part of the archive; without it they sit in the clear and the file must be treated like a keyring.</span></div>
          <p>What is not ticked does not travel — including the keys that today sit in the clear inside tile settings: they are stripped on export.</p>
          <h4>Folders follow</h4>
          <p>This is the real subject when moving from Windows to macOS or Linux: <code>C:\\Users\\you\\Videos\\PiBoard</code> exists nowhere else. On import a <b>standard</b> folder (Videos, Pictures, Documents, Downloads, Music, Desktop) is <b>translated automatically</b> to its equivalent, subfolders included, and Windows' French names are recognised. A folder with no equivalent — a <code>D:</code> drive, a network share — is <b>asked for</b> with the usual folder picker rather than left pointing nowhere.</p>
          <h4>What never travels</h4>
          <p>The <b>machine's</b> identity as opposed to the dashboard's: the system history, the internet line measurements, the already-consumed quota counters, and scheduled TV recordings. Importing those would make the new machine believe it had already used another one's quota.</p>
          <h4>Before overwriting</h4>
          <p>Importing happens in two steps. A <b>preview</b> first: where the clone comes from, which version, how many tiles and pages, how much image weight, and the list of folders — those translated and those awaiting your choice. An <b>incomplete or damaged</b> clone is refused at this stage thanks to a checksum, rather than half-applied; a clone from a newer version than yours is flagged.</p>
          <p>Only then the writing, preceded by an <b>automatic backup</b> of the current configuration — it shows up in the list above and lets you step back in one click. An <b>import report</b> closes the operation: what was restored and, above all, what is left for you to do, such as the secrets the clone did not carry. Without that report, a "successful" clone can leave three tiles silent with no explanation.</p>`
      }
    },

    /* ================= LE PROJET / THE PROJECT ================= */
    {
      id: "about",
      group: "credits",
      title: { fr: "À propos", en: "About" },
      sub: {
        fr: "Version, licence, copyright et dons.",
        en: "Version, license, copyright, and donations."
      },
      html: {
        fr: `
          <p>PiBoard <span id="helpAppVersion">…</span></p>
          <div id="helpTzFix"></div>
          <p>© 2026 Jean-Michel Ezes. Publié sous licence <b>MIT</b> — un texte complet de la licence accompagne le projet (fichier <code>LICENSE</code> à la racine).</p>
          <p>En clair : PiBoard est un logiciel libre et gratuit, que vous pouvez utiliser, modifier et redistribuer, à titre privé comme commercial, du moment que la mention de copyright est conservée. Il n'existe <b>ni version payante, ni clé de licence, ni fonction réservée, ni compte à créer</b>. Le logiciel est fourni sans aucune garantie.</p>
          <p>Projet personnel et open source : <a href="https://github.com/jihemezes/piboard" target="_blank">github.com/jihemezes/piboard</a>.</p>
          <h4>Offrir un café</h4>
          <p>PiBoard est gratuit et le restera. Un don est une simple marque de sympathie, sans contrepartie : il ne donne accès à aucune fonction supplémentaire, n'ouvre droit à aucun support et ne crée aucune obligation. Ne donnez rien si cela vous met la moindre difficulté — utiliser PiBoard, signaler un bug ou proposer une idée fait tout autant plaisir.</p>`,
        en: `
          <p>PiBoard <span id="helpAppVersion">…</span></p>
          <div id="helpTzFix"></div>
          <p>© 2026 Jean-Michel Ezes. Released under the <b>MIT</b> license — the full license text ships with the project (<code>LICENSE</code> file at the repository root).</p>
          <p>In plain terms: PiBoard is free software, free of charge, which you may use, modify and redistribute, privately or commercially, as long as the copyright notice is kept. There is <b>no paid version, no licence key, no feature held back and no account to create</b>. It comes with no warranty of any kind.</p>
          <p>Personal, open-source project: <a href="https://github.com/jihemezes/piboard" target="_blank">github.com/jihemezes/piboard</a>.</p>
          <h4>Buy me a coffee</h4>
          <p>PiBoard is free and will stay free. A donation is a simple token of appreciation, with no strings attached: it unlocks no extra feature, entitles you to no support and creates no obligation. Please do not give anything if it would put you in any difficulty — using PiBoard, reporting a bug or suggesting an idea is just as welcome.</p>`
      }
    },

    {
      id: "contribute",
      group: "credits",
      title: { fr: "Signaler un bug, proposer une idée", en: "Report a bug, suggest an idea" },
      sub: {
        fr: "Deux boutons dans les réglages généraux, et ce qu'ils envoient.",
        en: "Two buttons in the general settings, and what they send."
      },
      html: {
        fr: `
          <h4>Où sont les boutons</h4>
          <p>Dans les <b>réglages généraux</b>, section <b>Participer</b>, juste sous « Mises à jour ». Ce voisinage n'est pas un hasard : c'est là qu'est affiché le numéro de version, et c'est précisément l'information qu'un rapport de bug doit porter.</p>
          <h4>Ce qui part avec votre rapport</h4>
          <p>Le ticket s'ouvre <b>déjà rempli</b> : la version de PiBoard, la plateforme (le modèle exact de votre Raspberry Pi si c'en est un, sinon Windows, macOS ou Linux), le mode — application de bureau ou navigateur —, la définition de l'écran, la langue de l'interface, et un canevas de questions. Pour un bug : ce qui se passe, ce qui était attendu, comment le reproduire, quelle tuile est concernée. Pour une idée : le besoin, l'usage, ce que vous faites aujourd'hui à la place. Le tout <b>dans la langue de l'interface</b>.</p>
          <p><b>Rien n'est envoyé par PiBoard.</b> La page GitHub s'ouvre avec le texte prêt : vous le lisez, le corrigez, ajoutez une capture d'écran si vous en avez une, et c'est vous qui publiez. Un compte GitHub est nécessaire pour cela ; en créer un est gratuit.</p>
          <h4>Sur un écran de kiosque</h4>
          <p>Sur un Raspberry Pi en plein écran, il n'y a ni clavier ni barre d'adresse : ouvrir GitHub y est pénible. Un <b>clic droit</b> — ou un <b>appui long</b> au doigt — sur l'un des deux boutons affiche alors un <b>QR code</b> à viser avec votre téléphone. Le rapport pré-rempli s'ouvre là-bas, où vous avez un vrai clavier et votre appareil photo pour la capture d'écran.</p>
          <p>Le générateur de QR code est écrit dans PiBoard et fonctionne <b>sans connexion</b> : aucune image n'est téléchargée, rien n'est envoyé à un service extérieur pour fabriquer le code.</p>`,
        en: `
          <h4>Where the buttons are</h4>
          <p>In the <b>general settings</b>, under <b>Contributing</b>, right below "Updates". That neighbourhood is no accident: the version number is displayed there, and that is exactly what a bug report must carry.</p>
          <h4>What travels with your report</h4>
          <p>The ticket opens <b>already filled in</b>: the PiBoard version, the platform (the exact model of your Raspberry Pi if that is what you run, otherwise Windows, macOS or Linux), the mode — desktop application or browser —, the screen resolution, the interface language, and a short set of questions. For a bug: what happens, what you expected, how to reproduce it, which tile is concerned. For an idea: the need, the use, what you do instead today. All of it <b>in the interface's language</b>.</p>
          <p><b>Nothing is sent by PiBoard.</b> The GitHub page opens with the text ready: you read it, correct it, add a screenshot if you have one, and you are the one who posts. A GitHub account is needed for that; creating one is free.</p>
          <h4>On a kiosk screen</h4>
          <p>On a full-screen Raspberry Pi there is no keyboard and no address bar, which makes opening GitHub painful. A <b>right-click</b> — or a <b>long press</b> with a finger — on either button then shows a <b>QR code</b> to point your phone at. The pre-filled report opens there, where you have a real keyboard and a camera for the screenshot.</p>
          <p>The QR code generator is written inside PiBoard and works <b>offline</b>: no image is downloaded and nothing is sent to an outside service to build the code.</p>`
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
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Fonds de carte (Voyager, clair, sombre) des tuiles Carte de trafic, Radar météo et Avions en vue. Une clé gratuite est désormais requise, à saisir dans les réglages généraux, section « Cartes ».</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Données cartographiques sous-jacentes des fonds de carte CARTO, service de géocodage (Nominatim) utilisé par la tuile Trajet domicile-travail pour convertir une adresse en coordonnées, et tracés de la tuile « Plan du circuit », relevés une fois via le service public Overpass puis publiés dans une base. Données sous licence ODbL.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Calcul d'itinéraires et de temps de trajet pour la tuile Trajet domicile-travail.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Prévisions météo (agrégeant plusieurs modèles nationaux), qualité de l'air et pollens (basés sur les prévisions CAMS Europe), service de recherche de ville utilisé par plusieurs tuiles, et prévisions à l'heure de chaque séance de la carte « Météo du circuit » de la tuile Formule 1.</span></div>
          <div class="help-credit"><span class="help-opt-name">RainViewer</span> — <a href="https://www.rainviewer.com" target="_blank">rainviewer.com</a><br><span class="help-opt-desc">Boucle radar de précipitations animée de la tuile Radar météo.</span></div>
          <div class="help-credit"><span class="help-opt-name">adsb.lol / adsb.fi</span> — <a href="https://adsb.lol" target="_blank">adsb.lol</a> · <a href="https://adsb.fi" target="_blank">adsb.fi</a><br><span class="help-opt-desc">Réseaux ADS-B communautaires de la tuile Avions en vue (au choix dans ses réglages).</span></div>
          <div class="help-credit"><span class="help-opt-name">adsbdb</span> — <a href="https://www.adsbdb.com" target="_blank">adsbdb.com</a><br><span class="help-opt-desc">Recherche de trajet (ville de départ/arrivée) et d'informations sur l'appareil (modèle, exploitant) au clic sur un avion, dans la tuile Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">hexdb.io</span> — <a href="https://hexdb.io" target="_blank">hexdb.io</a><br><span class="help-opt-desc">Source de repli pour la recherche de trajet, et résolution des codes d'aéroport en noms de ville, dans la tuile Avions en vue.</span></div>
          <div class="help-credit"><span class="help-opt-name">Openverse</span> — <a href="https://openverse.org" target="_blank">openverse.org</a><br><span class="help-opt-desc">Photos de fond sous licence libre de la tuile Météo, avec crédit du photographe affiché sur la tuile quand disponible.</span></div>
          <div class="help-credit"><span class="help-opt-name">CoinGecko</span> — <a href="https://www.coingecko.com" target="_blank">coingecko.com</a><br><span class="help-opt-desc">Cours et courbes de prix de la tuile Cours Cryptos.</span></div>
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
          <div class="help-credit"><span class="help-opt-name">CARTO</span> — <a href="https://carto.com" target="_blank">carto.com</a><br><span class="help-opt-desc">Base maps (Voyager, light, dark) for the Traffic map, Weather Radar and Planes Overhead tiles. A free key is now required, entered in the general settings under "Maps".</span></div>
          <div class="help-credit"><span class="help-opt-name">OpenStreetMap</span> — <a href="https://www.openstreetmap.org" target="_blank">openstreetmap.org</a><br><span class="help-opt-desc">Underlying map data for the CARTO base maps, the geocoding service (Nominatim) used by the Commute time tile to turn an address into coordinates, and the outlines of the "Circuit map" tile, surveyed once through the public Overpass service and then published in a base. Data under the ODbL licence.</span></div>
          <div class="help-credit"><span class="help-opt-name">Project OSRM</span> — <a href="https://project-osrm.org" target="_blank">project-osrm.org</a><br><span class="help-opt-desc">Route and travel-time computation for the Commute time tile.</span></div>
          <div class="help-credit"><span class="help-opt-name">Open-Meteo</span> — <a href="https://open-meteo.com" target="_blank">open-meteo.com</a><br><span class="help-opt-desc">Weather forecasts (aggregating several national models), air quality and pollen (based on the CAMS Europe forecast), the city search service used by several tiles, and the per-session forecasts of the Formula 1 tile's "Circuit weather" card.</span></div>
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
        fr: "Ce que PiBoard sait faire de plus, version apres version. Les correctifs, eux, sont dans le CHANGELOG.md du projet.",
        en: "What PiBoard can do that it could not before, release after release. Fixes live in the project's CHANGELOG.md."
      },
      html: {
        fr: `<p class="help-sub">Chargement…</p>`,
        en: `<p class="help-sub">Loading…</p>`
      }
    },

  ];
})();
