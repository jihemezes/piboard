# Changelog

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
