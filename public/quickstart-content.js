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

    <p class="qs-foot">Everything is covered in the full help (the <b>?</b> in the toolbar), with a page per tile.</p>
  `
};
