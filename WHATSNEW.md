<!--
  PiBoard - WHATSNEW.md
  Les NOUVEAUTES telles qu'elles sont presentees DANS l'application
  (Aide -> Nouveautes), et non le journal technique.

  POURQUOI CE FICHIER EXISTE A COTE DE CHANGELOG.md. Le changelog
  s'adresse a qui developpe : il porte les correctifs, les details
  d'implementation et les notes de test, et une version qui ne corrige
  qu'un bug y a toute sa place. La personne qui utilise PiBoard, elle,
  veut savoir ce que l'application sait faire de plus -- pas qu'un
  en-tete HTTP a ete corrige. Filtrer le changelog automatiquement ne
  marche pas : la difference entre une correction et une fonctionnalite
  est une question de sens, pas de forme. D'ou ce fichier, ecrit pour
  etre lu.

  REGLE D'ECRITURE. Une entree par version qui APPORTE ou MODIFIE une
  fonctionnalite. Une version qui ne corrige que des bugs n'y figure
  pas du tout. On parle de ce que la fonction permet, jamais de la
  facon dont elle est faite.

  FORMAT. Comme CHANGELOG.md : un titre `## <version>`, le bloc
  francais, une ligne `---`, le bloc anglais. La date est facultative
  et s'ecrit `## <version> - AAAA-MM-JJ` ; `node tools/whatsnew-dates.js`
  la renseigne depuis les etiquettes git du depot.

  What's new as shown IN the app (Help -> What's new), as opposed to
  the technical log. One entry per version that ADDS or CHANGES a
  feature; fix-only versions do not appear at all. Same bilingual
  format as CHANGELOG.md; the date is optional and filled in by
  tools/whatsnew-dates.js from the repository's git tags.
-->

# Nouveautes / What's new


## 1.129.0

**Neuf services qui semblaient en panne ne l'etaient pas**

Neuf services du catalogue -- SFR, AWS, OVHcloud, Oracle Cloud, Alibaba
Cloud, Vultr, Hetzner, Fastly et GitLab -- s'affichaient comme
injoignables alors que leurs pages de statut repondaient parfaitement :
certaines avaient demenage, d'autres ont quitte Statuspage pour une page
maison. C'est repare, et la tuile distingue desormais trois situations
qu'elle confondait : personne ne repond, la page refuse la requete, ou
la page est lue mais dans un format inconnu -- trois causes, trois
verifications differentes.

Nouveaux services lisibles : PayPal, GitLab, Fastly, Vultr, les cinq
pages produits d'OVHcloud et Oracle Cloud. Nouvelle famille
**Stockage & partage de fichiers** : Dropbox, Box, Proton Drive,
WeTransfer, Infomaniak, Backblaze, MEGA et pCloud.

Certains services ne publient aucune page de statut -- pCloud, Alibaba
Cloud, Hetzner, SFR. Pour ceux-la, PiBoard verifie simplement que leur
API publique repond. Attention a ce que cela veut dire : « joignable
depuis chez vous » n'est pas « le fournisseur declare aller bien ». Ces
services portent donc un tilde, comme les flux RSS, et un echec n'est
jamais signale comme une panne majeure.

---

**Nine services that looked down were not**

Nine catalogue services -- SFR, AWS, OVHcloud, Oracle Cloud, Alibaba
Cloud, Vultr, Hetzner, Fastly and GitLab -- read as unreachable although
their status pages answered perfectly: some had moved, others left
Statuspage for an in-house page. Fixed, and the tile now tells apart
three situations it used to confuse: nobody answers, the page refuses
the request, or the page is read in an unknown format -- three causes,
three different checks.

Newly readable: PayPal, GitLab, Fastly, Vultr, OVHcloud's five product
pages and Oracle Cloud. New **File storage & sharing** family: Dropbox,
Box, Proton Drive, WeTransfer, Infomaniak, Backblaze, MEGA and pCloud.

Some services publish no status page at all -- pCloud, Alibaba Cloud,
Hetzner, SFR. For those, PiBoard simply checks that their public API
answers. Mind what that means: "reachable from your place" is not "the
provider declares itself healthy". Those services carry a tilde, as RSS
feeds do, and a failure is never reported as a major outage.

## 1.128.0

**Choisir les services a surveiller en cochant des cases**

La tuile Statut de service se reglait en tapant une adresse par ligne. Elle propose maintenant un catalogue de 67 services, range par familles -- cloud et hebergement, developpement et DevOps, SaaS et collaboration, paiement et messagerie, observabilite, IA et modeles, France -- avec une recherche. AWS, Google Cloud, Azure, OVHcloud, OpenAI, Anthropic, Stripe, Free, Orange et bien d'autres sont lus en direct, sans cle ni compte : quatre formats de pages de statut s'ajoutent a celui d'origine. Une page absente du catalogue s'ajoute toujours a la main, et son adresse est verifiee sur le champ : le format trouve vous est annonce avant d'enregistrer. Le plafond passe a 25 services, avec deux nouveaux affichages pour que cela reste lisible : compact, ou chaque service sain devient une pastille, et « problemes seulement », ou la tuile ne dit rien tant qu'il n'y a rien a dire. Enfin, chaque service porte une cloche : on peut surveiller vingt services et n'etre reveille que par deux, avec un seuil de gravite reglable pour la sirene.

---

**Choosing the services to watch by ticking boxes**

The Service status tile was configured by typing one address per line. It now offers a catalogue of 67 services arranged by family -- cloud and hosting, development and DevOps, SaaS and collaboration, payment and messaging, observability, AI and models, France -- with a search. AWS, Google Cloud, Azure, OVHcloud, OpenAI, Anthropic, Stripe, Free, Orange and many more are read live, with no key or account: four status-page formats join the original one. A page the catalogue does not hold can still be added by hand, and its address is checked on the spot: the format found is named back to you before you save. The ceiling rises to 25 services, with two new displays to keep that legible: compact, where each healthy service becomes a chip, and "problems only", where the tile says nothing while there is nothing to say. Finally, each service carries a bell: you can watch twenty services and be woken by two, with an adjustable severity threshold for the siren.


## 1.127.0

**Emporter une page du tableau de bord**

On pouvait deja sauvegarder une tuile, ou cloner toute l'installation. Il manquait l'entre-deux : une page. Elle s'exporte maintenant seule -- ses tuiles, leurs reglages, son fond, ses images et son theme -- dans un fichier qu'on emporte sur une autre machine. A l'import, au choix : une nouvelle page ajoutee, le remplacement d'une page existante, ou une fusion sous les tuiles deja en place. La configuration est sauvegardee avant toute ecriture, et un apercu dit ce que contient l'archive avant qu'on decide. La meme page peut etre importee plusieurs fois sans qu'une copie en detruise une autre.

---

**Carrying one dashboard page away**

You could already save a tile, or clone the whole installation. The in-between was missing: a page. It now exports on its own -- its tiles, their settings, its background, its images and its theme -- into a file you carry to another machine. On import, your choice: a new page appended, the replacement of an existing one, or a merge below the tiles already in place. The configuration is backed up before anything is written, and a preview says what the archive holds before you decide. The same page can be imported several times without one copy destroying another.

## 1.126.0

**Savoir si la panne vient de chez vous ou de chez eux**

Une nouvelle tuile surveille les pages de statut publiques des services dont vous dependez -- GitHub, Cloudflare, npm, Docker Hub et des centaines d'autres, sans cle ni compte. Tant que tout va bien, une ligne par service. Des qu'un incident est declare, elle montre les seuls composants touches, le stade de l'incident, depuis quand il dure, le dernier message publie et un lien vers lui -- et elle se met toute seule a verifier plus souvent, jusqu'au retour a la normale. Les maintenances programmees sont signalees, et une alerte optionnelle previent a l'apparition d'un incident.

---

**Knowing whether the outage is yours or theirs**

A new tile watches the public status pages of the services you depend on -- GitHub, Cloudflare, npm, Docker Hub and hundreds more, with no key or account. While all is well, one line per service. As soon as an incident is declared it shows the affected components only, the incident's stage, how long it has lasted, the latest message published and a link to it -- and it starts checking more often by itself until things return to normal. Scheduled maintenances are reported, and an optional alert warns when an incident appears.

## 1.125.0

**Les tuiles Texte et Horloge s'accordent au theme**

Un grand titre peut desormais prendre la couleur d'accent du theme -- celle des titres de tuiles -- au lieu du blanc de texte ordinaire, et le fond jour/nuit de l'horloge peut tirer ses deux nuances du theme applique plutot que de deux couleurs fixes : elle garde son repere jour/nuit sans trancher avec le reste du tableau. Les chiffres et aiguilles peuvent eux aussi passer a l'accent. Tout cela reste optionnel et decoche par defaut, et l'editeur de themes montre un echantillon des deux tuiles pour juger avant d'appliquer. Au passage, le numero de version s'affiche des l'ouverture de l'aide.

---

**The Text and Clock tiles match the theme**

A large title can now take the theme's accent colour -- the tile titles' one -- instead of plain text white, and the clock's day/night background can derive both its shades from the applied theme rather than two fixed colours: it keeps its day/night cue without standing apart from the rest of the board. Digits and hands can take the accent too. All of it stays optional and unticked by default, and the theme editor shows a sample of both tiles to judge before applying. Along the way, the version number appears as soon as the help opens.

## 1.124.0

**Installer ffmpeg sur un Mac, enfin possible depuis PiBoard**

Windows proposait ffmpeg a l'installation, Linux avait un bouton, macOS n'avait rien du tout : la tuile Chaines TV signalait son absence sans dire comment y remedier. Un bouton l'installe desormais aussi sur Mac, par simple telechargement dans le dossier de PiBoard -- sans mot de passe, sans Homebrew et sans rien changer au systeme. Et partout, les messages disent maintenant ou aller pour regler le probleme.

---

**Installing ffmpeg on a Mac, at last, from PiBoard**

Windows offered ffmpeg at install time, Linux had a button, macOS had nothing at all: the TV channels tile reported its absence without saying how to fix it. A button now installs it on a Mac too, by a simple download into PiBoard's folder -- no password, no Homebrew, no system change. And everywhere, the messages now say where to go to fix it.

## 1.123.0

**L'analyse reseau voit enfin tout le reseau**

Sur un Mac, la tuile ne trouvait que la machine elle-meme : macOS jetait sans rien dire les paquets du balayage, parce qu'ils etaient emis par la commande ping et non par PiBoard. Le balayage sonde desormais le reseau depuis PiBoard lui-meme. Benefice pour tout le monde, Raspberry Pi compris : les appareils dont le pare-feu ignore le ping -- imprimantes, cameras, PC Windows en reseau public -- apparaissent maintenant eux aussi.

---

**The network scan finally sees the whole network**

On a Mac the tile found only the machine itself: macOS silently dropped the sweep's packets, because they came from the ping command rather than from PiBoard. The sweep now probes the network from PiBoard itself. Everyone gains, Raspberry Pi included: devices whose firewall ignores ping -- printers, cameras, Windows PCs on a public network -- now show up too.

## 1.122.0

**La jauge de memoire dit enfin la verite**

Sur un Mac, l'Etat systeme annoncait une memoire pleine a 99 % en permanence, meme sur une machine aux deux tiers libre : macOS garde volontairement tres peu de memoire « strictement libre », le reste servant de cache immediatement recuperable. PiBoard affiche desormais le meme chiffre que le Moniteur d'activite. Le Raspberry Pi beneficie de la meme correction, plus discrete : le cache fichier n'y est plus compte comme occupe.

---

**The memory gauge tells the truth at last**

On a Mac, System status announced 99% memory in use permanently, even on a machine two-thirds free: macOS deliberately keeps very little "strictly free" memory, the rest serving as immediately reclaimable cache. PiBoard now shows the same figure as Activity Monitor. The Raspberry Pi gets the same fix, more quietly: file cache no longer counts as occupied.

## 1.121.0

**PiBoard s'installe enfin sans mystere sur un Mac**

Au premier lancement, macOS annonce que PiBoard est « endommage ». Il ne l'est pas : il n'est pas notarise par Apple, ce qui suppose un compte payant. Sur les Mac Apple Silicon, ce refus ne laisse aucune porte de sortie visible, et l'on croit a un telechargement rate. Une nouvelle fiche d'aide « Application de bureau macOS » dit ce qui se passe et donne la commande a lancer une fois, le README aussi, et le message de mise a jour la rappelle -- parce que chaque nouvelle copie telechargee ramene le probleme. Au passage, la tuile Enregistrements TV rejoint sa famille, a cote des Chaines TV.

---

**PiBoard installs on a Mac without the mystery**

On first launch macOS announces that PiBoard is "damaged". It is not: it is not notarized by Apple, which requires a paid account. On Apple Silicon Macs that refusal leaves no visible way out, and one assumes a failed download. A new "macOS desktop app" help section explains what happens and gives the command to run once, the README too, and the update message repeats it -- because every newly downloaded copy brings the problem back. Along the way, the TV recordings tile joins its family, next to TV channels.

## 1.120.0

**L'heure juste meme quand un pays vient de changer d'heure**

Le Maroc est repasse a GMT le 20 septembre 2026. La base de fuseaux que PiBoard lit est celle de Chromium, figee a la construction de l'application : elle mettra des mois a le savoir, et aucune mise a jour de Windows ou du Raspberry Pi n'y changera quoi que ce soit. PiBoard corrige donc lui-meme les fuseaux concernes, les signale dans la liste de choix, et cesse de corriger tout seul le jour ou ce n'est plus necessaire. Le detail se lit dans Aide -> A propos.

---

**The right time even when a country has just changed its own**

Morocco moved back to GMT on 20 September 2026. The time zone database PiBoard reads is Chromium's, frozen when the application was built: it will take months to find out, and no Windows or Raspberry Pi update will change that. PiBoard therefore corrects the affected zones itself, flags them in the picker, and stops correcting on its own once it is no longer needed. The details are under Help -> About.

## 1.119.0

**Nouveautes : une page ecrite pour qui se sert de PiBoard**

La section ne deroule plus le journal technique, correctifs compris, mais uniquement ce que l'application sait faire de plus, version apres version. Elle s'ouvre sur les nouveautes recentes, le reste de l'historique tenant derriere un bouton, et chaque version peut porter son mois.

---

**What's new: a page written for whoever uses PiBoard**

The section no longer unrolls the technical log, fixes included, but only what the application can do that it could not before, release after release. It opens on the recent features, with the rest of the history behind a button, and each release can carry its month.

## 1.118.0 - 2026-09-21

**Clone complet**

Une archive qu'on emporte pour remonter le meme tableau de bord sur une autre machine, d'un Windows vers un Mac ou un Linux. Pages, tuiles, themes, fonds d'ecran et photos partent ensemble ; les cles de service et les identifiants personnels sont deux options distinctes, chiffrables par phrase de passe. Les dossiers sont retraduits pour le nouveau systeme, et l'import montre un apercu avant d'ecrire quoi que ce soit.

---

**Full clone**

An archive you carry to rebuild the same dashboard on another machine, from Windows to a Mac or a Linux box. Pages, tiles, themes, wallpapers and photos travel together; service keys and personal credentials are two separate options, encryptable with a passphrase. Folders are translated for the new system, and the import shows a preview before writing anything.

## 1.117.0 - 2026-09-21

**Declarer un bug, demander une fonctionnalite**

Deux boutons dans les reglages ouvrent un ticket GitHub deja rempli -- version, plateforme, ecran, langue -- dans la langue de l'interface. En mode kiosque, un appui long affiche le lien en QR code a viser avec son telephone.

---

**Report a bug, request a feature**

Two buttons in the settings open a pre-filled GitHub ticket -- version, platform, screen, language -- in the interface's language. In kiosk mode a long press shows the link as a QR code to scan with your phone.

## 1.116.0 - 2026-09-21

**Bandeau tactile deux fois plus grand**

En mode tactile, le bandeau du mode Tableau de bord double de taille, languette et zone sensible comprises.

---

**Touch bar twice as large**

In touch mode the Dashboard bar doubles in size, tab and hot zone included.

## 1.115.0 - 2026-09-20

**Nouvelle tuile : Imprimante 3D Bambu Lab**

Temperatures, etape en cours, avancement et fin d'impression, par le cloud ou en direct sur le reseau local. Lecture seule. Camera en option derriere un bouton, contenu et humidite des AMS, alertes de fin ou d'erreur, recherche automatique des imprimantes du reseau, et un affichage qui se simplifie a mesure que la tuile retrecit.

---

**New tile: Bambu Lab 3D printer**

Temperatures, current stage, progress and end of print, through the cloud or straight over the local network. Read-only. Optional camera behind a button, AMS contents and humidity, end-of-print and error alerts, automatic discovery of the printers on the network, and a display that simplifies itself as the tile shrinks.

## 1.114.0 - 2026-09-20

**Scores : le Top 14 et la Pro D2 lus chez la LNR**

Source officielle pour le rugby francais ; une tuile deja reglee bascule toute seule.

---

**Scores: Top 14 and Pro D2 read from the LNR**

The official source for French rugby; a tile already set up switches over by itself.

## 1.113.0 - 2026-09-19

**Enregistrer la television**

Enregistrement d'une chaine pendant qu'on la regarde, ou programme a l'avance, avec reprise apres coupure et nommage automatique. Une nouvelle tuile « Enregistrements TV » les retrouve.

---

**Recording television**

Record a channel while watching it, or schedule it ahead, with resume after a cut and automatic naming. A new "TV recordings" tile finds them again.

## 1.112.0 - 2026-09-17

**Citation : la collection multipliee par neuf**

Deux nouvelles sources combinables -- pensees de Jean-Claude Van Damme, blagues Chuck Norris -- avec frequence reglable, aucune repetition, favoris par appui long et vos propres citations.

---

**Quote: the collection multiplied by nine**

Two new sources you can combine -- Jean-Claude Van Damme thoughts, Chuck Norris jokes -- with an adjustable frequency, no repeats, favourites on a long press and your own quotes.

## 1.111.0 - 2026-09-16

**Themes de couleurs**

Un theme PiBoard, des themes assortis aux fonds de la bibliotheque, un editeur, un apercu avant d'appliquer, et la possibilite de tirer un theme d'une image.

---

**Colour themes**

A PiBoard theme, themes matched to the library's wallpapers, an editor, a preview before applying, and the ability to draw a theme from an image.

## 1.110.0

**Bibliotheque d'images**

Des fonds d'ecran prets a l'emploi, livres legers et completes en ligne.

---

**Image library**

Ready-made wallpapers, shipped light and completed online.

## 1.109.0 - 2026-09-15

**Guide de demarrage bilingue**

Bascule de langue en tete du guide de demarrage rapide.

---

**Bilingual quick start**

A language switch at the top of the quick start guide.

## 1.108.0 - 2026-09-14

**YouTube : recherche plein ecran**

---

**YouTube: full-screen search**

## 1.107.0 - 2026-09-14

**Une tuile peut couvrir la page entiere**

---

**A tile can cover the whole page**

## 1.106.0 - 2026-09-14

**Nouvelle tuile : YouTube**

Quatre sources -- chaine, playlist, recherche, video -- sous une seule forme, avec demarrage manuel.

---

**New tile: YouTube**

Four sources -- channel, playlist, search, video -- in a single shape, started by hand.

## 1.105.0 - 2026-09-14

**Nouvelle tuile : Veille reseau**

Trois sondes pour surveiller ce qui tourne a la maison, sans rien declarer.

---

**New tile: Network watch**

Three probes to watch what runs at home, with nothing to declare.

## 1.104.0 - 2026-09-13

**Eteindre l'ordinateur depuis le menu de sortie**

---

**Shut the computer down from the exit menu**

## 1.103.0 - 2026-09-13

**Licence en clair, et bouton « Offrir un cafe »**

---

**The licence stated plainly, and a "Buy me a coffee" button**

## 1.102.0 - 2026-09-13

**Analyse reseau : export et import CSV des noms d'appareils**

---

**Network scan: CSV export and import of device names**

## 1.101.0

**ffmpeg et VLC s'installent depuis les reglages**

---

**ffmpeg and VLC install from the settings**

## 1.100.0 - 2026-09-10

**Application de bureau pour Linux et macOS**

Avec mise a jour automatique sous Linux et demarrage automatique de la session.

---

**Desktop application for Linux and macOS**

With automatic updates on Linux and automatic start with the session.

## 1.99.0 - 2026-09-10

**Extinction de l'ecran fiabilisee**

Quatre methodes essayees dans l'ordre selon la machine, et un bouton de test dans les reglages.

---

**Screen blanking made reliable**

Four methods tried in order depending on the machine, and a test button in the settings.

## 1.98.0

**Defilement du contenu des tuiles au doigt**

Quatre reglages, barres larges, glisser pour defiler.

---

**Scrolling tile contents with a finger**

Four settings, wide bars, drag to scroll.

## 1.97.0 - 2026-09-07

**Classement : retour du Top 14, avec la LNR pour source**

---

**Standings: Top 14 is back, with the LNR as its source**

## 1.95.0

**Fine barre de fenetre a la place de la barre de titre**

---

**A thin window bar instead of the title bar**

## 1.94.0 - 2026-09-05

**Avions : le nom de la ville, pas seulement le code**

---

**Planes: the city name, not just the code**

## 1.93.0 - 2026-09-05

**Une image de fond par page**

Avec un voile reglable pour garder les tuiles lisibles.

---

**One background image per page**

With an adjustable veil to keep the tiles legible.

## 1.92.0 - 2026-09-05

**Bouton « Reinitialiser les reglages » d'une tuile**

---

**A "Reset settings" button on a tile**

## 1.91.0 - 2026-09-03

**Recadrage directement sur l'image**

Quatre poignees d'angle, glissement, petite barre d'outils -- l'affichage suit le geste.

---

**Cropping straight on the image**

Four corner handles, dragging, a small toolbar -- the display follows the gesture.

## 1.90.0 - 2026-09-03

**Tuile Logo/Image : recadrage**

Le fichier d'origine n'est jamais modifie.

---

**Logo/Image tile: cropping**

The original file is never modified.

## 1.89.0 - 2026-09-03

**Defilement automatique des pages**

Duree reglable par page, suspension automatique, remise a zero apres toute navigation manuelle.

---

**Automatic page cycling**

A duration set per page, automatic pausing, and a reset after any manual navigation.

## 1.88.0 - 2026-09-03

**Meteo : lever et coucher du soleil aussi pour demain**

Et le bouton « Rechercher des mises a jour » toujours accessible.

---

**Weather: sunrise and sunset for tomorrow too**

And the "Check for updates" button always reachable.

## 1.87.0 - 2026-09-03

**Mode tableau de bord**

Le plateau existant devient la page 1, le nombre de pages est libre, toutes tournent en meme temps. Deux tuiles de style arrivent avec lui -- Texte et Logo/Image -- et le fond des tuiles peut devenir transparent.

---

**Dashboard mode**

The existing board becomes page 1, the number of pages is free, and all of them run at the same time. Two styling tiles arrive with it -- Text and Logo/Image -- and tile backgrounds can become transparent.

## 1.86.0 - 2026-09-02

**Le canal de mise a jour vaut aussi pour l'application Windows**

Et la meteo peut afficher lever et coucher du soleil.

---

**The update channel applies to the Windows application too**

And the weather can show sunrise and sunset.

## 1.85.0 - 2026-09-02

**Choix du niveau des mises a jour**

Versions stables seules, ou pre-versions comprises -- annoncees comme telles.

---

**Choosing the update level**

Stable releases only, or pre-releases too -- announced as such.

## 1.84.0 - 2026-09-02

**Un axe du temps sur tous les graphiques**

---

**A time axis on every chart**

## 1.83.0 - 2026-09-02

**Etat systeme : charge du GPU**

---

**System state: GPU load**

## 1.82.0 - 2026-09-02

**Etat systeme : seuils et couleurs personnalisables**

Le rouge cesse d'etre la couleur d'un fonctionnement normal. L'adresse IP publique s'affiche.

---

**System state: custom thresholds and colours**

Red stops being the colour of normal operation. The public IP address is shown.

## 1.81.0 - 2026-09-02

**Mise a jour automatique sur Raspberry Pi et Linux**

---

**Automatic updates on Raspberry Pi and Linux**

## 1.80.0

**Classements Formule 1 et MotoGP**

Pilotes et equipes, et la colonne des points remise dans l'ordre conventionnel pour la Ligue 1 et le Top 14.

---

**Formula 1 and MotoGP standings**

Riders and teams, and the points column put back in the conventional order for Ligue 1 and the Top 14.

## 1.79.0 - 2026-08-28

**Analyse reseau : un appareil reste reconnu meme s'il change d'IP**

Les noms donnes survivent aussi a une reinstallation.

---

**Network scan: a device stays recognised even when its IP changes**

The names you give also survive a reinstall.

## 1.78.0 - 2026-08-27

**Nouvelle tuile : Sante Internet**

Latence et coupures mesurees par le serveur, debit teste rarement et doublement plafonne, coupures visibles comme des ruptures du trace. Rien n'est mesure tant qu'aucune tuile n'est posee.

---

**New tile: Internet health**

Latency and outages measured by the server, throughput tested rarely and doubly capped, outages visible as breaks in the line. Nothing is measured until a tile is placed.

## 1.75.0 - 2026-08-26

**Etat systeme : seules les vraies cartes reseau connectees**

---

**System state: only the real, connected network cards**

## 1.74.0 - 2026-08-26

**Nouvelle tuile : Home Assistant**

En lecture seule, sans aucun moyen de declencher quoi que ce soit ; le jeton est range dans le coffre chiffre.

---

**New tile: Home Assistant**

Read-only, with no way to trigger anything at all; the token is kept in the encrypted vault.

## 1.73.0 - 2026-08-25

**Bourse : bouton « Restaurer la liste par defaut »**

Indices et valeurs individuelles cohabitent, separes.

---

**Stocks: a "Restore the default list" button**

Indices and individual stocks live side by side, separated.

## 1.72.0 - 2026-08-25

**Nouvelle tuile : Bourse et indices**

Deux sources, cours differes, devise d'origine sans conversion, et une entree libre pour ce qui manque.

---

**New tile: Stocks and indices**

Two sources, delayed quotes, the native currency with no conversion, and a free entry for whatever is missing.

## 1.71.0 - 2026-08-25

**Nouvelle tuile : Couleur Tempo**

Avec les jours restants de chaque couleur.

---

**New tile: Tempo colour**

With the days left in each colour.

## 1.70.0 - 2026-08-25

**Nouvelle tuile : Quotas IA**

Autorisation depuis la tuile ; PiBoard ne voit jamais le mot de passe.

---

**New tile: AI quotas**

Authorisation from the tile itself; PiBoard never sees the password.

## 1.69.0 - 2026-08-25

**Guide de demarrage rapide au premier lancement**

Et les reglages generaux passent sur trois colonnes.

---

**A quick start guide on first launch**

And the general settings move to three columns.

## 1.68.0 - 2026-08-25

**Ascenseur dans le plateau**

Molette, deux doigts en tactile, et defilement automatique vers une tuile posee hors champ.

---

**A scrollbar on the board**

Wheel, two fingers on touch, and automatic scrolling to a tile placed out of sight.

## 1.67.0 - 2026-08-20

**L'aide d'une tuile s'ouvre depuis sa fenetre de configuration**

---

**A tile's help opens from its settings window**

## 1.66.0 - 2026-08-20

**Bloc-notes : plusieurs notes en onglets, avec une couleur par note**

---

**Notes: several notes as tabs, each with its own colour**

## 1.65.0

**Bloc-notes : barre de mise en forme**

---

**Notes: a formatting toolbar**

## 1.63.0 - 2026-08-16

**Agenda : navigation dans la vue semaine**

Et un choix de disposition pour la grille.

---

**Calendar: navigating the week view**

And a choice of layout for the grid.

## 1.62.0 - 2026-08-16

**Catalogue de tuiles regroupe par familles**

---

**The tile catalogue grouped into families**

## 1.61.0 - 2026-08-16

**Cryptos : fenetre de courbe amelioree**

Reperes sur l'axe, logo de la crypto, couleurs personnalisables.

---

**Crypto: an improved chart window**

Axis guides, the coin's logo, customisable colours.

## 1.60.0 - 2026-08-16

**Cryptos : Binance en source principale**

Cours plus frais pour les monnaies courantes, CoinGecko en repli pour les plus confidentielles.

---

**Crypto: Binance as the main source**

Fresher prices for the common coins, CoinGecko as a fallback for the more obscure ones.

## 1.58.0 - 2026-08-15

**Page web : jusqu'a 5 sites en onglets**

---

**Web page: up to 5 sites as tabs**

## 1.57.0 - 2026-08-15

**Page web : affichage natif dans l'application de bureau**

Les sites qui refusaient d'apparaitre s'affichent enfin.

---

**Web page: native display in the desktop application**

Sites that refused to appear finally show up.

## 1.54.0 - 2026-08-15

**Deux nouveaux tiroirs de tuiles, en haut et a droite**

---

**Two new tile drawers, at the top and on the right**

## 1.53.0 - 2026-08-15

**Programme TV : grille plein ecran facon magazine**

Une ligne par chaine, blocs proportionnels a la duree, ligne du temps, zoom et recherche.

---

**TV guide: a full-screen magazine-style grid**

One row per channel, blocks sized by duration, a timeline, zoom and search.

## 1.52.0 - 2026-08-11

**Programme TV : recherche, favoris, progression, rappels**

---

**TV guide: search, favourites, progress, reminders**

## 1.51.0 - 2026-08-10

**Chaines TV : precedent/suivant et curseur de volume**

---

**Live TV: previous/next and a volume slider**

## 1.50.0 - 2026-08-09

**Chaines TV : pause et plein ecran**

---

**Live TV: pause and full screen**

## 1.48.0 - 2026-08-09

**Chaines TV : VLC transcode lui-meme**

Les flux que le navigateur refusait deviennent lisibles.

---

**Live TV: VLC transcodes by itself**

Streams the browser refused become playable.

## 1.46.0 - 2026-08-08

**Commandes de lecture pour les films et series**

---

**Playback controls for films and series**

## 1.45.0 - 2026-08-08

**ffmpeg propose a l'installation Windows**

---

**ffmpeg offered during the Windows install**

## 1.44.0 - 2026-08-08

**Chaines TV : mode « Compatibilite totale »**

---

**Live TV: a "Full compatibility" mode**

## 1.42.0

**Chaines TV : une solution au son muet**

---

**Live TV: a solution for muted sound**

## 1.41.0 - 2026-08-06

**Flux RSS : jusqu'a 3 flux dans la meme tuile**

---

**RSS feeds: up to 3 feeds in the same tile**

## 1.40.0

**Chaines TV : support complet de Xtream Codes**

Navigation a plusieurs niveaux, et les series.

---

**Live TV: full Xtream Codes support**

Multi-level navigation, and series.

## 1.39.0 - 2026-08-05

**Nouvelle tuile : Chaines TV**

Liste navigable, lecture HLS, plafond de qualite reglable ; seule la liste des chaines passe par PiBoard.

---

**New tile: Live TV**

A navigable list, HLS playback, an adjustable quality cap; only the channel list goes through PiBoard.

## 1.37.0 - 2026-08-02

**Nouveau champ « fuseau horaire », et des groupes dans les listes**

---

**A new "time zone" field, and groups in the drop-down lists**

## 1.36.0 - 2026-08-02

**Horloge : fuseaux multiples, numero de semaine, 5 alarmes, prochain evenement**

---

**Clock: multiple time zones, week number, 5 alarms, next event**

## 1.35.0 - 2026-08-02

**Sauvegarde et restauration completes**

Instantanes horodates, export et import de fichier, restauration protegee par confirmation.

---

**Full backup and restore**

Time-stamped snapshots, file export and import, a restore guarded by an explicit confirmation.

## 1.33.0 - 2026-08-02

**Aide : section « A propos », recherche dans le sommaire, captures d'ecran**

---

**Help: an "About" section, search in the contents, screenshots**

## 1.32.0 - 2026-08-01

**Astronomie : prochaine eclipse**

---

**Astronomy: the next eclipse**

## 1.31.0 - 2026-08-01

**Nouvelle tuile : Astronomie**

Phase de lune, passages ISS, planetes visibles.

---

**New tile: Astronomy**

Moon phase, ISS passes, visible planets.

## 1.30.0 - 2026-08-01

**Avions : compas en surimpression**

Position et opacite reglables.

---

**Planes: a compass overlay**

Adjustable position and opacity.

## 1.29.0 - 2026-08-01

**Courriel : bouton « Recharger » et liens cliquables reglables**

---

**Mail: a "Reload" button and clickable links you can switch off**

## 1.28.0 - 2026-07-31

**Nouvelle tuile : Courriel**

Strictement en lecture seule, contenu desinfecte, rien n'est stocke sur le PiBoard. Les mots de passe entrent dans un coffre chiffre.

---

**New tile: Mail**

Strictly read-only, sanitised content, nothing stored on the PiBoard. Passwords go into an encrypted vault.

## 1.26.0 - 2026-07-30

**Planification par tuile**

Une tuile peut ne s'afficher qu'a certaines heures ou certains jours.

---

**Per-tile scheduling**

A tile can show only at certain hours or on certain days.

## 1.25.0 - 2026-07-30

**Agenda : diagnostic detaille des calendriers recalcitrants**

---

**Calendar: detailed diagnosis for stubborn calendars**

## 1.23.0 - 2026-07-26

**Radar meteo : couche vent**

Densite reglable, vitesse en km/h.

---

**Weather radar: a wind layer**

Adjustable density, speed in km/h.

## 1.22.0 - 2026-07-26

**Nouvelle tuile : Sports mecaniques**

---

**New tile: Motorsport**

## 1.21.0 - 2026-07-26

**Trajet : suggestions d'adresse cliquables**

---

**Commute: clickable address suggestions**

## 1.20.0 - 2026-07-26

**Trajet : validation d'adresse en direct**

---

**Commute: live address validation**

## 1.19.0 - 2026-07-26

**Flux RSS : veritable mode lecture**

Avec l'illustration fournie par le flux.

---

**RSS feeds: a proper reading mode**

With the illustration the feed provides.

## 1.18.0

**Trajet : trafic reel, comparaison au temps habituel, heure de depart conseillee**

---

**Commute: real traffic, comparison with the usual time, suggested departure**

## 1.17.0 - 2026-07-26

**Meteo : vue detaillee au clic, et « pluie dans ~X min »**

---

**Weather: a detailed view on click, and "rain in ~X min"**

## 1.16.0

**Qualite de l'air : reglages pollens independants par affichage**

---

**Air quality: pollen settings independent per display**

## 1.15.0 - 2026-07-25

**Avions : trajet au clic**

---

**Planes: the route on click**

## 1.14.0 - 2026-07-25

**Radar meteo : legende des couleurs**

Et la section « Nouveautes » apparait dans l'aide.

---

**Weather radar: a colour legend**

And the "What's new" section appears in the help.

## 1.13.0 - 2026-07-25

**Flux RSS : articles cliquables avec popup de lecture**

---

**RSS feeds: clickable articles with a reading popup**

## 1.12.0

**Nouvelle tuile : Avions en vue**

---

**New tile: Planes overhead**

## 1.11.0

**Nouvelle tuile : Radar meteo**

---

**New tile: Weather radar**

## 1.10.0

**Nouvelle tuile : Agenda**

---

**New tile: Calendar**

## 1.9.0

**Nouvelle tuile : Qualite de l'air**

En version compacte ou detaillee.

---

**New tile: Air quality**

In a compact or a detailed form.

## 1.8.0 - 2026-07-25

**« Saint du jour » dans les tuiles Horloge et Meteo**

---

**"Saint of the day" in the Clock and Weather tiles**

## 1.7.0 - 2026-07-23

**Application de bureau Windows**

Avec mise a jour automatique et lancement au demarrage de la session.

---

**Windows desktop application**

With automatic updates and launch at session start.

## 1.5.0

**Nouvelle tuile : Programme TV**

TNT francaise et Canal+.

---

**New tile: TV guide**

French digital terrestrial channels and Canal+.

## 1.4.0

**Bibliotheque de configurations de tuiles reutilisables**

---

**A library of reusable tile configurations**

## 1.3.0

**Menu de sortie a deux options**

Reinitialiser le tableau de bord, ou revenir au bureau.

---

**An exit menu with two options**

Reset the dashboard, or return to the desktop.

## 1.2.0

**Nouvelle tuile : Analyse reseau**

---

**New tile: Network scan**

## 1.1.0

**Ecran de veille avec retour automatique, et diaporama depuis une cle USB**

---

**A screen saver with automatic return, and a slideshow from a USB stick**

## 1.0.0

**Premiere version**

Horloge, Meteo, Carte de trafic, Trajet domicile-travail, Flux RSS, Diaporama, Classement, Citation du jour. Avec le mode tactile, le clavier virtuel, l'economiseur d'ecran et l'aide integree.

---

**First release**

Clock, Weather, Traffic map, Commute, RSS feeds, Slideshow, Standings, Quote of the day. With touch mode, the on-screen keyboard, the screen saver and the built-in help.
