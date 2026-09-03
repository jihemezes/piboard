/* Contenu du guide de demarrage rapide (FR/EN).
   Fichier separe de help-content.js volontairement : ce guide n'est pas
   une section d'aide de plus, c'est un texte court et autonome, affiche
   dans sa propre fenetre au lancement. Le garder a part evite qu'il ne
   se retrouve noye dans le sommaire de l'aide, et permet de le reprendre
   tel quel dans la section "Demarrage rapide" de l'aide globale (voir
   openQuickStart / help-content.js, section quickstart).

   Quick start guide content (FR/EN).
   Deliberately kept separate from help-content.js: this guide is not one
   more help section, it is a short standalone text shown in its own
   window at launch. Keeping it apart avoids drowning it in the help's
   table of contents, and lets it be reused as-is in the global help's
   "Quick start" section (see openQuickStart / help-content.js, section
   quickstart). */
window.PIBOARD_QUICKSTART = {
  fr: `
    <p class="qs-lead">PiBoard affiche en permanence les informations qui vous sont utiles — heure, météo, trafic, agenda, photos de famille — sous forme de <b>tuiles</b> que vous disposez librement sur l'écran. Voici l'essentiel en une minute.</p>

    <h4>La barre d'outils</h4>
    <p>Tout part de la barre en bas de l'écran. Si elle n'est pas visible, touchez la petite languette centrale au bord inférieur.</p>
    <img class="qs-shot" src="help-assets/toolbar.png" alt="Barre d'outils de PiBoard" loading="lazy">
    <div class="qs-icons">
      <div><b>+</b> Ajouter une tuile</div>
      <div><b>Cadenas</b> Mode édition (déplacer / redimensionner)</div>
      <div><b>Engrenage</b> Réglages généraux</div>
      <div><b>?</b> Cette aide, en version complète</div>
      <div><b>Image</b> Diaporama plein écran</div>
      <div><b>Marche/arrêt</b> Redémarrer l'affichage</div>
      <div><b>Chevron</b> Replier la barre</div>
    </div>

    <h4>Ajouter une tuile</h4>
    <p>Touchez le <b>+</b> : un catalogue s'ouvre, classé par familles. Choisissez un widget, et la tuile apparaît immédiatement sur le tableau, prête à être configurée. Si un tiroir latéral est ouvert à ce moment-là, la tuile y est placée plutôt que sur le tableau principal.</p>

    <h4>Deux façons d'afficher : classique ou tableau de bord</h4>
    <p>PiBoard sait s'afficher de deux manières, au choix dans les <b>réglages généraux → Mode d'affichage</b> :</p>
    <div class="qs-two">
      <div><b>Classique</b> — le mode d'origine, décrit ci-dessus : un plateau, des tiroirs latéraux escamotables, la barre d'outils en bas.</div>
      <div><b>Tableau de bord</b> — une suite de pages qui se remplacent en glissant. Plus de tiroirs ni de barre d'outils : un <b>fin bandeau</b> apparaît quand vous amenez la souris au bas de l'écran (une languette permanente en mode tactile). On change de page par les numéros du bandeau, par un glissement du doigt, ou avec les flèches du clavier.</div>
    </div>
    <p>Votre tableau actuel devient la <b>page 1</b> : rien n'est perdu, et revenir au mode classique le retrouve intact. Le nombre de pages n'est pas limité, et chaque page choisit son sens d'arrivée et son effet (pousser, recouvrir, fondu…).</p>

    <h4>Habiller une page</h4>
    <p>Deux tuiles servent uniquement à la mise en page, dans la famille <b>Mise en page</b> du catalogue : <b>Texte</b> (un titre, dont la taille s'adapte toute seule à la tuile) et <b>Logo / Image</b> (une image téléversée sur la machine PiBoard). Associez-leur le <b>fond transparent</b> — réglages de la tuile → Apparence — et elles se fondent dans la page, sans aucun cadre visible.</p>

    <h4>Deux niveaux de réglages</h4>
    <p>Ne les confondez pas, c'est la source de confusion la plus fréquente :</p>
    <div class="qs-two">
      <div><b>Les réglages généraux</b> (engrenage de la barre d'outils) concernent tout PiBoard : langue, thème jour/nuit, ville, hauteur de la grille, économiseur d'écran, tiroirs…</div>
      <div><b>Les réglages d'une tuile</b> (icône en forme de <b>curseurs de réglage</b>, sur la tuile elle-même) ne concernent que celle-ci : sa source de données, son apparence, sa planification. Les deux icônes sont volontairement différentes : engrenage = tout PiBoard, curseurs = cette tuile.</div>
    </div>

    <h4>Déplacer et redimensionner</h4>
    <p>Activez le <b>mode édition</b> (le cadenas). Les tuiles se glissent alors pour changer de place, et leurs bords se tirent pour changer de taille. Chaque widget a une <b>taille minimale</b> propre, en dessous de laquelle il refusera de descendre : ce n'est pas un bug, c'est la taille en dessous de laquelle son contenu deviendrait illisible ou ses boutons se chevaucheraient. La carte de trafic, par exemple, est nettement plus exigeante que l'horloge.</p>
    <p><b>Pour sortir du mode édition, touchez à nouveau le cadenas</b> dans la barre d'outils. Tant qu'il reste actif, un simple appui sur une tuile ouvre ses réglages au lieu de l'utiliser normalement.</p>

    <h4>De l'aide pendant la configuration</h4>
    <p>Vous n'avez pas à mémoriser ce que fait chaque option : dans la fenêtre de réglages d'une tuile, un bouton <b>?</b> ouvre directement la fiche d'aide de ce widget, sans perdre ce que vous étiez en train de saisir.</p>

    <h4>Le diaporama</h4>
    <p>L'icône en forme d'image lance un <b>diaporama plein écran</b> à partir de vos photos (un dossier local, une clé USB ou un partage réseau, à indiquer dans les réglages généraux). Touchez l'écran pour en sortir. C'est aussi disponible sous forme de tuile, si vous préférez le garder dans un coin du tableau.</p>

    <h4>Les clés API : deux tuiles seulement</h4>
    <p>La quasi-totalité des tuiles fonctionne <b>sans aucune inscription</b>. Deux exceptions, à connaître dès maintenant pour ne pas croire à une panne :</p>
    <p><b>Les fonds de carte</b> (tuiles Carte de trafic, Radar météo et Avions en vue) demandent une clé <b>CARTO</b>, gratuite et obtenue en deux minutes sur <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>. Elle se saisit <b>une seule fois</b>, dans les réglages généraux (l'engrenage), section « Cartes », et sert aux trois tuiles. Sans elle, les cartes s'affichent quand même mais chaque tuile d'image est barrée d'un filigrane « API KEY REQUIRED ».</p>
    <p><b>Le trafic routier lui-même</b> (flux et incidents, par-dessus le fond de carte) demande en plus une clé <b>TomTom</b>, gratuite également, à saisir dans les réglages de la tuile Trafic.</p>
    <p>PiBoard n'embarque aucune de ces clés : elles sont délivrées par client et ne doivent pas être partagées entre installations sans lien.</p>

    <p class="qs-foot">Tout est détaillé dans l'aide complète (le <b>?</b> de la barre d'outils), avec une fiche par tuile.</p>
  `,
  en: `
    <p class="qs-lead">PiBoard permanently displays the information you care about — time, weather, traffic, agenda, family photos — as <b>tiles</b> you arrange freely on the screen. Here's the gist in one minute.</p>

    <h4>The toolbar</h4>
    <p>Everything starts from the bar at the bottom of the screen. If it isn't visible, tap the small center pull tab at the bottom edge.</p>
    <img class="qs-shot" src="help-assets/toolbar.png" alt="PiBoard toolbar" loading="lazy">
    <div class="qs-icons">
      <div><b>+</b> Add a tile</div>
      <div><b>Padlock</b> Edit mode (move / resize)</div>
      <div><b>Gear</b> General settings</div>
      <div><b>?</b> This help, in full</div>
      <div><b>Picture</b> Full-screen slideshow</div>
      <div><b>Power</b> Restart the display</div>
      <div><b>Chevron</b> Collapse the bar</div>
    </div>

    <h4>Adding a tile</h4>
    <p>Tap the <b>+</b>: a catalog opens, grouped into families. Pick a widget and the tile appears on the board straight away, ready to configure. If a side drawer happens to be open at that moment, the tile goes there rather than onto the main board.</p>

    <h4>Two ways of displaying: classic or dashboard</h4>
    <p>PiBoard can display itself in two ways, chosen in the <b>general settings → Display mode</b>:</p>
    <div class="qs-two">
      <div><b>Classic</b> — the original mode, described above: one board, retractable side drawers, the toolbar at the bottom.</div>
      <div><b>Dashboard</b> — a series of pages replacing each other by sliding. No more drawers nor toolbar: a <b>thin bar</b> appears when you move the mouse to the bottom of the screen (a permanent tab in touch mode). You change page with the bar's numbers, a finger swipe, or the keyboard arrows.</div>
    </div>
    <p>Your current board becomes <b>page 1</b>: nothing is lost, and returning to classic mode finds it intact. The number of pages is not limited, and each page picks the direction it arrives from and its effect (push, cover, fade…).</p>

    <h4>Dressing a page</h4>
    <p>Two tiles exist purely for layout, in the catalog's <b>Page design</b> family: <b>Text</b> (a title whose size fits the tile by itself) and <b>Logo / Image</b> (an image uploaded to the PiBoard machine). Give them the <b>transparent background</b> — tile settings → Appearance — and they blend into the page, with no visible frame at all.</p>

    <h4>Two levels of settings</h4>
    <p>Don't mix them up — this is the most common source of confusion:</p>
    <div class="qs-two">
      <div><b>General settings</b> (gear in the toolbar) apply to all of PiBoard: language, day/night theme, city, grid height, screen saver, drawers…</div>
      <div><b>A tile's settings</b> (the <b>sliders</b> icon, on the tile itself) apply to that tile only: its data source, its appearance, its schedule. The two icons are deliberately different: gear = all of PiBoard, sliders = this tile.</div>
    </div>

    <h4>Moving and resizing</h4>
    <p>Turn on <b>edit mode</b> (the padlock). Tiles can then be dragged to move them, and their edges pulled to resize them. Each widget has its own <b>minimum size</b>, below which it will refuse to go: that's not a bug, it's the size below which its content would become unreadable or its buttons would overlap. The traffic map, for instance, is considerably more demanding than the clock.</p>
    <p><b>To leave edit mode, tap the padlock again</b> in the toolbar. While it stays on, a plain tap on a tile opens its settings instead of using it normally.</p>

    <h4>Help while configuring</h4>
    <p>You don't have to memorise what each option does: in a tile's settings window, a <b>?</b> button opens that widget's help page directly, without losing what you were typing.</p>

    <h4>The slideshow</h4>
    <p>The picture icon starts a <b>full-screen slideshow</b> from your photos (a local folder, a USB stick or a network share, set in general settings). Touch the screen to leave it. It's also available as a tile, if you'd rather keep it in a corner of the board.</p>

    <h4>API keys: two tiles only</h4>
    <p>Nearly every tile works <b>with no sign-up at all</b>. Two exceptions, worth knowing now so you don't mistake them for a fault:</p>
    <p><b>The base maps</b> (Traffic map, Weather radar and Planes overhead tiles) need a <b>CARTO</b> key, free and obtained in two minutes at <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener">carto.com/basemaps/apikey</a>. You type it <b>once</b>, in the general settings (the gear), under "Maps", and it serves all three tiles. Without it the maps still appear, but every image tile is stamped with an "API KEY REQUIRED" watermark.</p>
    <p><b>The road traffic itself</b> (flow and incidents, on top of the base map) additionally needs a <b>TomTom</b> key, also free, entered in the Traffic tile's own settings.</p>
    <p>PiBoard ships neither key: they are issued per customer and must not be shared between unrelated installations.</p>

    <p class="qs-foot">Everything is covered in the full help (the <b>?</b> in the toolbar), with a page per tile.</p>
  `
};
