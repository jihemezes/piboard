/* PiBoard widget: servicestatus / statut des services en ligne.

   Lit les pages de statut publiques (GitHub, Cloudflare, npm...) par le
   relais du serveur -- voir server/serviceStatus.js pour l'API employee,
   le garde-fou sur les adresses et le cache partage.

   LA CADENCE DOUBLE, qui est le coeur de cette tuile. Interroger une page
   de statut toutes les minutes en permanence n'a aucun sens : il ne s'y
   passe rien pendant des semaines. Mais une fois l'incident declare,
   dix minutes d'attente entre deux relevés sont une eternite -- c'est
   justement le moment ou l'on regarde la tuile toutes les trente
   secondes. D'ou deux rythmes : lent tant que tout va bien, rapide des
   que ce n'est plus le cas.

   DEUX DECISIONS QUI COMPTENT :

   1. On accelere des que l'indicateur global n'est plus « none », donc
      y compris sur une degradation MINEURE. Attendre la panne majeure
      pour regarder de pres reviendrait a n'accelerer qu'une fois qu'il
      est trop tard pour que ce soit utile.

   2. On ne ralentit qu'apres DEUX relevés sains d'affilee. Un incident
      en dents de scie -- et ils le sont presque tous, les composants
      repassant au vert puis au rouge pendant la remediation -- ferait
      sinon osciller la tuile entre les deux rythmes, et la ferait
      ralentir precisement pendant l'accalmie qui precede la rechute.

   Reads public status pages through the server relay. THE DUAL CADENCE
   is this tile's whole point: polling every minute forever is pointless,
   nothing happens for weeks; but once an incident is declared, ten
   minutes between readings is an age -- exactly when one checks the tile
   every thirty seconds. Two decisions matter: we speed up as soon as the
   indicator leaves "none", minor degradations included (waiting for a
   major outage means speeding up once it is too late to help); and we
   slow down only after TWO consecutive healthy readings, because almost
   every incident is jagged, and otherwise the tile would slow down
   during precisely the lull before the relapse. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Plafond porte de 10 a 25 avec le selecteur a cases a cocher
     (1.128.0). Il ne protege pas le reseau -- le relais serveur impose
     deja un plancher entre deux appels reels et partage le resultat --
     mais la LISIBILITE : au-dela, meme en mode compact, la tuile cesse
     d'etre lisible d'un coup d'oeil, ce qui est tout ce qu'on lui
     demande. Raised from 10 to 25 with the checkbox picker: it protects
     legibility, not the network. */
  const MAX_SERVICES = 25;

  const SEVERITY_RANK = { none: 0, unknown: 1, minor: 2, major: 3, critical: 4 };

  /* Teintes par severite. On reutilise les variables du theme plutot que
     des couleurs fixes : la tuile suit ainsi le theme applique, y compris
     les themes personnalises, et reste lisible sur fond clair comme
     sombre.
     Severity tints reuse the theme's variables rather than fixed
     colours, so the tile follows the applied theme, custom ones
     included, and stays readable on light and dark alike. */
  const TONE = {
    none: "var(--ok)",
    minor: "var(--warn)",
    major: "var(--danger)",
    critical: "var(--danger)",
    unknown: "var(--muted)"
  };
  const COMPONENT_TONE = {
    operational: "var(--ok)",
    under_maintenance: "var(--muted)",
    degraded_performance: "var(--warn)",
    partial_outage: "var(--danger)",
    major_outage: "var(--danger)",
    unknown: "var(--muted)"
  };

  /* ---------- Les quatre icones d'etat ----------
     POURQUOI QUATRE, alors que la tuile connait cinq indicateurs. Un
     point colore accompagne d'un texte variable obligeait a LIRE pour
     savoir ou on en etait : sur un kiosque regarde de trois metres,
     c'est precisement ce qu'on ne fait pas. Une forme se reconnait de
     loin, et quatre formes sont ce qu'un coup d'oeil distingue sans
     effort. Les cinq indicateurs se rangent donc en quatre :

       tout operationnel  <- none
       problemes partiels <- minor et major (degradation, panne d'une
                             partie du service)
       probleme general   <- critical (le fournisseur declare son
                             service globalement hors service)
       pas d'information  <- unknown, et toutes les erreurs de lecture

     Le rouge « general » reste ainsi RARE, donc il garde son sens
     d'alarme. S'il sortait des qu'un composant tombe, on s'y habituerait
     en une semaine et il ne voudrait plus rien dire.

     WHY FOUR when the tile knows five indicators: a coloured dot with
     variable text had to be READ to know where one stood -- on a kiosk
     looked at from three metres, precisely what nobody does. A shape is
     recognised from afar, and four shapes are what a glance tells apart.
     The "general" red therefore stays RARE and keeps its alarm value: if
     it came out whenever one component fell, one would get used to it in
     a week and it would mean nothing. */
  const STATE_OF = {
    none: "ok",
    minor: "partial",
    major: "partial",
    critical: "general",
    unknown: "unknown"
  };

  function stateOf(svc) {
    if (!svc) return "unknown";
    if (svc.error) return "unknown";
    return STATE_OF[svc.indicator] || "unknown";
  }

  /* Dessins en SVG plutot qu'en emojis : un emoji change d'aspect d'un
     systeme a l'autre, ignore le theme, et sur un Pi sans police emoji
     complete il devient un carre vide. Ces quatre-la sont traces avec
     `currentColor`, donc ils suivent le theme applique, themes
     personnalises compris.
     SVG rather than emoji: an emoji changes shape from one system to the
     next, ignores the theme, and becomes an empty box on a Pi without a
     complete emoji font. These follow the applied theme through
     `currentColor`. */
  const ICON = {
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.3l3 3 6-6.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    partial: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l9 15.6H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.6v4.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.25" fill="currentColor"/></svg>',
    general: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 3.2h7.2L20.8 8.4v7.2l-5.2 5.2H8.4L3.2 15.6V8.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    unknown: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.6"/><path d="M9.6 9.4a2.5 2.5 0 114.1 2.3c-.9.7-1.6 1.2-1.6 2.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>'
  };

  const STATE_TONE = {
    ok: "var(--ok)",
    partial: "var(--warn)",
    general: "var(--danger)",
    unknown: "var(--muted)"
  };

  function iconHtml(state, i18n) {
    const label = i18n.t("svcstatus.icon." + state);
    return `<span class="pwss-ico pwss-ico-${state}" style="--pwss-tone:${STATE_TONE[state]}" `
      + `role="img" aria-label="${esc(label)}" title="${esc(label)}">${ICON[state] || ICON.unknown}</span>`;
  }

  /* ---------- Le filtre geographique ----------
     LE PROBLEME REEL : Cloudflare annonce une degradation au Chili,
     AWS une panne a Sydney, et la tuile passe au rouge pour quelqu'un
     qui travaille a Toulouse. A force, on cesse de la regarder -- c'est
     la facon la plus sure de rendre une tuile de supervision inutile.

     LA REGLE, et c'est celle qui compte : on ne masque QUE ce qu'on a
     su situer. Un libelle ou aucun lieu connu n'apparait est TOUJOURS
     affiche. Le contraire -- masquer par defaut ce qu'on n'a pas
     compris -- ferait disparaitre en silence des incidents mondiaux
     mal nommes, et une tuile qui cache ce qu'elle n'a pas compris est
     pire que pas de tuile du tout.

     THE REAL PROBLEM: Cloudflare reports a degradation in Chile, AWS an
     outage in Sydney, and the tile turns red for someone working in
     Toulouse. In time one stops looking at it -- the surest way to make
     a monitoring tile useless. THE RULE: only what we managed to LOCATE
     is ever hidden. A label in which no known place appears is ALWAYS
     shown; hiding what we did not understand would silently drop
     badly-named worldwide incidents. */

  /* LA TABLE DES LIEUX, ET POURQUOI ELLE A ETE REECRITE. La premiere
     version se contentait d'une liste de noms connus et repondait
     « ce libelle parle-t-il d'un endroit ? ». Elle a laisse passer
     « Hagatna, Guam - (GUM) » en surveillant l'Europe, tout simplement
     parce que Guam n'y figurait pas -- et un lieu absent de la liste
     etait traite comme un libelle sans lieu, donc affiche. La regle
     (« on ne masque que ce qu'on a su situer ») etait bonne ; c'est la
     connaissance geographique qui etait trop maigre.

     Deux changements : la table couvre maintenant les pays ET les
     territoires (Guam, Reunion, Nouvelle-Caledonie, Porto Rico...), et
     surtout chacun porte son CONTINENT. Sans cela, demander « Europe »
     ne pouvait rien dire d'« Annaba, Algeria » : il fallait savoir que
     l'Algerie est en Afrique. Les noms sont donnes en anglais et en
     francais, les pages de statut melangeant les deux.

     THE PLACE TABLE, AND WHY IT WAS REWRITTEN. The first version only
     answered "does this label name a place?" from a list of known
     names, and let "Hagatna, Guam - (GUM)" through while watching
     Europe, simply because Guam was not in it -- an absent place was
     treated as no place at all, hence shown. The rule was right; the
     geography was too thin. Now the table covers countries AND
     territories, and each carries its CONTINENT: without that, asking
     for "Europe" could say nothing about "Annaba, Algeria". Names are
     given in English and French, status pages mixing both. */
  const CONTINENT = {
    europe: ("albania albanie andorra andorre austria autriche belarus bielorussie belgium belgique bosnia bosnie bulgaria bulgarie "
      + "croatia croatie cyprus chypre czechia czech republic republique tcheque tchequie denmark danemark estonia estonie "
      + "faroe feroe finland finlande france germany allemagne gibraltar greece grece guernsey hungary hongrie iceland islande "
      + "ireland irlande isle of man italy italie jersey kosovo latvia lettonie liechtenstein lithuania lituanie luxembourg "
      + "malta malte moldova moldavie monaco montenegro netherlands pays-bas holland macedonia macedoine norway norvege "
      + "poland pologne portugal romania roumanie russia russie san marino serbia serbie slovakia slovaquie slovenia slovenie "
      + "spain espagne sweden suede switzerland suisse ukraine united kingdom royaume-uni england angleterre scotland ecosse "
      + "wales pays de galles northern ireland vatican azores acores madeira madere canary canaries "
      + "paris marseille lyon roubaix gravelines strasbourg bordeaux toulouse lille london londres manchester dublin "
      + "frankfurt francfort berlin munich hamburg dusseldorf amsterdam rotterdam brussels bruxelles antwerp madrid barcelona "
      + "lisbon lisbonne porto milan milano rome roma zurich geneva geneve vienna vienne warsaw varsovie krakow prague "
      + "budapest bucharest bucarest sofia athens athenes stockholm oslo helsinki copenhagen copenhague riga vilnius tallinn "
      + "kyiv kiev moscow moscou saint petersburg istanbul edinburgh").split(" "),
    asia: ("afghanistan armenia armenie azerbaijan azerbaidjan bahrain bahrein bangladesh bhutan bhoutan brunei cambodia cambodge "
      + "china chine georgia georgie hong kong india inde indonesia indonesie iran iraq irak israel japan japon jordan jordanie "
      + "kazakhstan kuwait koweit kyrgyzstan laos lebanon liban macau macao malaysia malaisie maldives mongolia mongolie "
      + "myanmar burma nepal north korea oman pakistan palestine philippines qatar saudi arabia arabie saoudite singapore "
      + "singapour south korea korea coree sri lanka syria syrie taiwan taiwan tajikistan thailand thailande timor turkey "
      + "turquie turkmenistan emirates emirats uae uzbekistan vietnam yemen "
      + "tokyo osaka seoul beijing pekin shanghai shenzhen guangzhou chengdu taipei bangkok jakarta manila hanoi "
      + "ho chi minh kuala lumpur mumbai bombay delhi bangalore bengaluru chennai hyderabad kolkata pune karachi lahore "
      + "dhaka colombo kathmandu dubai abu dhabi doha riyadh jeddah kuwait city muscat amman beirut baghdad basra tehran "
      + "tel aviv jerusalem ankara almaty tashkent baku tbilisi yerevan").split(" "),
    africa: ("algeria algerie angola benin botswana burkina burundi cameroon cameroun cape verde cap-vert central african chad tchad "
      + "comoros comores congo djibouti egypt egypte equatorial guinea eritrea erythree eswatini swaziland ethiopia ethiopie "
      + "gabon gambia gambie ghana guinea guinee ivory coast cote d'ivoire kenya lesotho liberia libya libye madagascar malawi "
      + "mali mauritania mauritanie mauritius maurice morocco maroc mozambique namibia namibie niger nigeria reunion rwanda "
      + "senegal seychelles sierra leone somalia somalie south africa afrique du sud south sudan sudan soudan tanzania tanzanie "
      + "togo tunisia tunisie uganda ouganda zambia zambie zimbabwe "
      + "algiers alger annaba oran casablanca rabat marrakech tunis tripoli cairo le caire alexandria lagos abuja accra "
      + "abidjan dakar nairobi mombasa addis ababa kampala dar es salaam luanda maputo johannesburg cape town le cap durban "
      + "pretoria kinshasa saint denis port louis").split(" "),
    "north america": ("canada united states etats-unis usa mexico mexique greenland groenland bermuda bermudes costa rica cuba "
      + "dominican republic republique dominicaine el salvador guatemala haiti honduras jamaica jamaique nicaragua panama "
      + "puerto rico porto rico bahamas barbados barbade trinidad trinite martinique guadeloupe curacao aruba cayman caimans "
      + "belize saint martin "
      + "montreal toronto vancouver calgary ottawa quebec winnipeg new york new jersey newark ashburn virginia washington "
      + "boston philadelphia atlanta miami orlando tampa charlotte nashville chicago detroit minneapolis columbus ohio "
      + "dallas houston austin san antonio denver phoenix salt lake city las vegas los angeles san francisco san jose "
      + "silicon valley seattle portland oregon sacramento kansas city st. louis saint louis mexico city guadalajara "
      + "monterrey queretaro san juan").split(" "),
    "south america": ("argentina argentine bolivia bolivie brazil bresil chile chili colombia colombie ecuador equateur "
      + "french guiana guyane guyana paraguay peru perou suriname uruguay venezuela "
      + "sao paulo são paulo rio de janeiro brasilia fortaleza porto alegre curitiba buenos aires cordoba santiago "
      + "valparaiso arica bogota medellin cali lima quito guayaquil caracas montevideo asuncion la paz cayenne").split(" "),
    oceania: ("australia australie fiji fidji french polynesia polynesie guam kiribati marshall micronesia micronesie nauru "
      + "new caledonia nouvelle-caledonie new zealand nouvelle-zelande palau papua papouasie samoa solomon salomon tonga "
      + "tuvalu vanuatu hawaii hawai "
      + "sydney melbourne brisbane perth adelaide canberra hobart auckland wellington christchurch noumea papeete "
      + "honolulu hagatna suva port moresby").split(" ")
  };

  /* Les ensembles employes par les fournisseurs : EMEA, APAC, LATAM...
     Ce ne sont pas des continents mais ils en designent plusieurs, et
     une personne qui ecrit « Europe » doit retrouver ce qui est annonce
     pour « EMEA ».
     Provider groupings: not continents, but they designate several, and
     someone who writes "Europe" must find what is announced for
     "EMEA". */
  const GROUPINGS = {
    emea: ["europe", "africa", "asia"],
    apac: ["asia", "oceania"],
    "asia pacific": ["asia", "oceania"],
    "asia-pacific": ["asia", "oceania"],
    latam: ["south america"],
    "latin america": ["south america"],
    americas: ["north america", "south america"],
    amerique: ["north america", "south america"],
    "middle east": ["asia"],
    "moyen-orient": ["asia"],
    oceanie: ["oceania"],
    asie: ["asia"],
    afrique: ["africa"],
    "amerique du nord": ["north america"],
    "amerique du sud": ["south america"]
  };

  /* Les codes de region des grands clouds portent leur continent dans
     leur prefixe : `eu-west-3`, `ap-southeast-2`, `sa-east-1`. Un code
     se reconnait a sa forme, pas a une liste -- et il dit a lui seul ou
     se trouve la panne.
     Cloud region codes carry their continent in their prefix, and a code
     is recognised by shape, not by a list. */
  const REGION_PREFIX = {
    af: "africa", ap: "asia", ca: "north america", cn: "asia", eu: "europe",
    il: "asia", me: "asia", sa: "south america", us: "north america"
  };
  const REGION_CODE = /\b(af|ap|ca|cn|eu|il|me|sa|us)-(north|south|east|west|central|northeast|northwest|southeast|southwest)(-?\d)?\b/gi;
  /* Les noms a la mode Azure : `westeurope`, `francecentral`,
     `southeastasia`. Azure-style names. */
  const AZURE_CODE = /\b(?:west|east|north|south|central|southeast|northeast)?(europe|us|usgov|asia|india|japan|france|germany|uk|canada|brazil|australia|korea|africa|norway|sweden|switzerland|poland|italy|spain|qatar|uae|mexico|chile|israel|newzealand)(?:west|east|north|south|central|\d)*\b/gi;
  const AZURE_CONTINENT = {
    europe: "europe", france: "europe", germany: "europe", uk: "europe", norway: "europe", sweden: "europe",
    switzerland: "europe", poland: "europe", italy: "europe", spain: "europe",
    us: "north america", usgov: "north america", canada: "north america", mexico: "north america",
    asia: "asia", india: "asia", japan: "asia", korea: "asia", qatar: "asia", uae: "asia", israel: "asia",
    brazil: "south america", chile: "south america",
    australia: "oceania", newzealand: "oceania", africa: "africa"
  };

  /* « Mondial », « toutes regions » : ce n'est pas un lieu a filtrer,
     c'est le contraire -- cela concerne tout le monde, donc vous.
     "Global", "all regions": not a place to filter but the opposite. */
  const GLOBAL_WORDS = /\b(global|globale|globally|worldwide|mondial|mondiale|all regions|toutes regions|all locations|multi-region|multiregion|everywhere)\b/i;

  function normalize(text) {
    return String(text == null ? "" : text)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function parseZones(value) {
    return String(value == null ? "" : value)
      .split(/[,;\n]/)
      .map((z) => normalize(z).trim())
      .filter(Boolean);
  }

  /* Ou se trouve ce libelle ? Rend la liste des continents reconnus, ou
     un tableau vide si on n'a rien su situer -- et c'est cette
     difference qui decide ensuite d'afficher ou de masquer.
     Where is this label? Returns the recognised continents, or an empty
     array when nothing could be located. */
  function locate(label) {
    const text = " " + normalize(label).replace(/[^a-z0-9'\- ]+/g, " ").replace(/\s+/g, " ") + " ";
    const found = {};

    for (const key of Object.keys(GROUPINGS)) {
      if (text.indexOf(" " + key + " ") !== -1) for (const c of GROUPINGS[key]) found[c] = true;
    }
    for (const continent of Object.keys(CONTINENT)) {
      if (text.indexOf(" " + continent + " ") !== -1) found[continent] = true;
      for (const place of CONTINENT[continent]) {
        if (place && text.indexOf(" " + place + " ") !== -1) { found[continent] = true; break; }
      }
    }
    let m;
    REGION_CODE.lastIndex = 0;
    while ((m = REGION_CODE.exec(text))) {
      const c = REGION_PREFIX[String(m[1]).toLowerCase()];
      if (c) found[c] = true;
    }
    AZURE_CODE.lastIndex = 0;
    while ((m = AZURE_CODE.exec(text))) {
      const c = AZURE_CONTINENT[String(m[1]).toLowerCase()];
      if (c) found[c] = true;
    }
    return Object.keys(found);
  }

  /* Rend `true` si le libelle doit etre AFFICHE.
     LA REGLE N'A PAS CHANGE, et c'est la seule qui compte : on ne masque
     QUE ce qu'on a su situer. Ce qui concerne le monde entier, ce qui
     tombe dans vos zones, et ce dont on n'a pas su dire ou ca se passe
     restent affiches. Seul un lieu identifie ET hors de vos zones
     disparait.
     THE RULE IS UNCHANGED: only what we managed to locate is ever
     hidden. */
  function concernsMe(label, zones) {
    const text = normalize(label);
    if (!text || !zones.length) return true;
    if (GLOBAL_WORDS.test(text)) return true;

    /* Vos zones, mot pour mot, d'abord : vous avez pu ecrire « gra »,
       « rbx » ou le nom d'un client, que PiBoard n'a aucune raison de
       connaitre. Your zones verbatim first: you may have written a code
       or a client's name PiBoard has no reason to know. */
    for (const z of zones) {
      if (z && text.indexOf(z) !== -1) return true;
    }

    const here = locate(label);
    if (!here.length) return true;

    /* Vos zones designent-elles l'un des continents trouves ? Une zone
       peut etre un continent (« europe »), un ensemble (« emea ») ou un
       pays (« france ») : on la situe de la meme facon que le libelle.
       Do your zones name one of the continents found? A zone is located
       exactly like the label is. */
    for (const z of zones) {
      const zoneHere = locate(z);
      for (const c of zoneHere) if (here.indexOf(c) !== -1) return true;
    }
    return false;
  }

  /* Applique le filtre a un service et rend une COPIE : la reponse du
     serveur n'est jamais modifiee, pour que decocher l'option reaffiche
     tout sans avoir a redemander le reseau.
     Applies the filter and returns a COPY: the server's answer is never
     modified, so unticking the option restores everything without
     another network call. */
  function filterByZones(svc, zones) {
    if (!svc || svc.error || !zones.length) return svc;
    const affected = (svc.affected || []).filter((c) => concernsMe(c.name + " " + (c.group || ""), zones));
    const incidents = (svc.incidents || []).filter((i) => concernsMe(i.name + " " + (i.components || []).join(" "), zones));
    const hidden = ((svc.affected || []).length - affected.length) + ((svc.incidents || []).length - incidents.length);
    if (!hidden) return svc;

    /* Tout ce qui restait a ete masque : le service redevient
       « operationnel pour vous », et la tuile le DIT (compteur en bas de
       la fiche) plutot que de laisser croire qu'il n'y avait rien.
       Everything left was hidden: the service becomes "operational for
       you", and the tile SAYS so rather than implying there was
       nothing. */
    const quiet = !affected.length && !incidents.length;
    return Object.assign({}, svc, {
      affected,
      incidents,
      hiddenCount: hidden,
      indicator: quiet ? "none" : svc.indicator,
      ok: quiet ? true : svc.ok
    });
  }

  /* « Nom = adresse », une par ligne, et « # » pour desactiver : la
     meme grammaire que la tuile Veille reseau. Un reglage qui se
     ressemble d'une tuile a l'autre s'apprend une fois.
     "Name = address", one per line, "#" to disable: the same grammar as
     the Network watch tile. A setting that looks the same from one tile
     to the next is learned once. */
  function parseTargets(text) {
    const out = [];
    for (const raw of String(text || "").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      const label = eq === -1 ? "" : line.slice(0, eq).trim();
      const url = (eq === -1 ? line : line.slice(eq + 1)).trim();
      if (!url) continue;
      /* Un service saisi a la main n'a pas d'adaptateur declare : le
         serveur sondera les formats. Et `alert: true` par defaut, car
         quelqu'un qui prend la peine de taper une adresse a la main
         veut tres probablement etre averti pour celle-la.
         A hand-typed service declares no adapter -- the server probes --
         and alerts by default: someone who bothers to type an address
         almost certainly wants to hear about that one. */
      out.push({ label, url, adapter: "auto", api: null, alert: true, manual: true, family: "custom" });
      if (out.length >= MAX_SERVICES) break;
    }
    return out;
  }

  /* Les services COCHES dans le selecteur, lus depuis le JSON ecrit par
     le champ "multipick". Une valeur abimee (fichier de reglages edite a
     la main, migration ratee) ne doit jamais faire tomber la tuile : on
     rend une liste vide, et le champ libre ci-dessous reste disponible.
     The TICKED services, read from the JSON the "multipick" field
     writes. A damaged value must never bring the tile down: an empty
     list is returned and the free-text field below stays available. */
  function parsePicked(value) {
    let list = [];
    try { list = typeof value === "string" ? JSON.parse(value || "[]") : (Array.isArray(value) ? value : []); }
    catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    return list.filter((p) => p && (p.url || p.id)).map((p) => {
      /* LE DEFAUT QUI FAISAIT CROIRE QUE RIEN N'AVAIT CHANGE. La liste
         cochee recopiait l'adresse ET l'adaptateur du catalogue au
         moment du clic. Un service coche avec l'ancien catalogue gardait
         donc ses anciennes valeurs pour toujours : corriger le catalogue
         (SFR passe en « endpoint », OVHcloud eclate par produit, Fastly
         et Vultr dotes de leur format) ne changeait RIEN sur un tableau
         deja regle -- il fallait decocher puis recocher chaque service,
         ce que personne ne peut deviner.

         On ne garde donc du reglage que l'IDENTIFIANT, et l'adresse
         comme l'adaptateur sont relus dans le catalogue a chaque
         demarrage. Une correction de catalogue profite ainsi aux
         tableaux existants, ce qui est le seul comportement defendable :
         le catalogue est la verite, le reglage ne dit que « celui-la ».
         Les valeurs enregistrees restent le repli, pour les services
         ajoutes a la main (qui n'ont pas d'entree au catalogue) et pour
         le cas ou le catalogue ne se chargerait pas.

         THE DEFECT THAT MADE IT LOOK AS IF NOTHING HAD CHANGED: the
         ticked list copied the catalogue's address AND adapter at
         ticking time, so a service ticked under the old catalogue kept
         its old values forever and catalogue fixes reached no existing
         board. Only the ID is kept from the setting now; address and
         adapter are re-read from the catalogue at every start. The
         stored values remain the fallback, for hand-added services and
         for a catalogue that fails to load. */
      const src = (!p.custom && p.id && CATALOG.byId[p.id]) ? CATALOG.byId[p.id] : null;
      /* SERVICE RETIRE DU CATALOGUE. Depuis que l'adresse est relue dans
         le catalogue, une entree qu'on en retire laisse un fantome :
         elle reste cochee, retombe sur l'adresse enregistree -- celle-la
         meme qui ne marchait plus, raison pour laquelle on l'a retiree --
         et affiche eternellement une erreur que decocher est le seul
         moyen de faire taire, sans que rien ne le dise. C'est arrive a
         « OVH travaux » des sa suppression. On le DIT donc, et on
         n'interroge plus le reseau pour rien.
         A SERVICE DROPPED FROM THE CATALOGUE leaves a ghost: still
         ticked, falling back to the stored address -- the very one that
         stopped working, which is why it was dropped -- and showing an
         error for ever that only unticking can silence, with nothing
         saying so. It happened to "OVH travaux" the day it was removed.
         So we say it, and stop querying the network for nothing. */
      if (!src && !p.custom && p.id && CATALOG.loaded) {
        return { label: p.name || p.id, url: String(p.url || ""), adapter: "auto", api: null,
                 alert: p.alert !== false, manual: false, retired: true, family: p.family || "custom" };
      }
      return {
      label: p.name || (src && src.name) || "",
      /* La famille vient du catalogue, comme l'adresse et le format :
         c'est elle qui regroupe les services a l'ecran. Un service
         ajoute a la main n'en a pas, il rejoint « Mes services ».
         The family comes from the catalogue, like the address and the
         format: it is what groups services on screen. */
      family: (src && src.family) || p.family || "custom",
      url: String((src && src.url) || p.url),
      adapter: (src && src.adapter) || p.adapter || "auto",
      api: (src && src.api) || p.api || null,
      /* `alert` absent veut dire « coche avant que la cloche existe » :
         on alerte, comme la version precedente le faisait pour tous.
         A missing `alert` means "ticked before the bell existed": we
         alert, as the previous version did for every service. */
      alert: p.alert !== false,
      manual: false
      };
    });
  }

  /* Le catalogue, charge une fois et partage par toutes les tuiles de la
     page. Tant qu'il n'est pas la, `byId` est vide et parsePicked()
     retombe sur les valeurs enregistrees : la tuile affiche donc
     quelque chose des le premier relevé, au lieu d'attendre un fichier
     pour ne rien montrer.
     The catalogue, loaded once and shared by every tile on the page.
     Until it arrives, byId is empty and parsePicked falls back to the
     stored values, so the tile shows something on the first reading
     instead of waiting on a file to show nothing. */
  const CATALOG = { byId: {}, families: [], loaded: false };
  let catalogPromise = null;

  function loadCatalog(remoteAllowed) {
    if (catalogPromise) return catalogPromise;
    const fill = (json) => {
      const cat = (json && json.catalog && typeof json.catalog === "object") ? json.catalog : json;
      const list = cat && Array.isArray(cat.services) ? cat.services : [];
      for (const svc of list) if (svc && svc.id) CATALOG.byId[svc.id] = svc;
      if (cat && Array.isArray(cat.families)) CATALOG.families = cat.families;
      return list.length;
    };
    /* La route sert le catalogue le plus recent dont le serveur dispose
       (celui du depot, le cache, ou celui livre avec la version -- voir
       server/serviceCatalog.js). Si elle manque, on retombe sur le
       fichier livre : une tuile ne doit jamais dependre d'une route
       pour afficher quelque chose.
       The route serves the most recent catalogue the server has; if it
       is absent we fall back to the shipped file -- a tile must never
       depend on a route to show anything. */
    const url = "api/service-catalog" + (remoteAllowed ? "" : "?remote=0");
    catalogPromise = fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((json) => { if (!fill(json)) throw new Error("catalogue vide"); })
      .catch(() => fetch("data/service-catalog.json").then((r) => r.json()).then(fill).catch(() => 0))
      .then(() => { CATALOG.loaded = true; });
    return catalogPromise;
  }

  /* Les deux sources sont fusionnees ICI, en un seul endroit, et les
     doublons sont ecartes par adresse : cocher GitHub dans le selecteur
     alors qu'il figure aussi dans le champ avance ne doit pas faire
     apparaitre la ligne deux fois ni doubler les requetes.
     The two sources are merged HERE, in one place, duplicates dropped by
     address: GitHub ticked in the picker and also present in the
     advanced field must not appear twice nor double the requests. */
  function mergeTargets(settings) {
    const all = parsePicked(settings && settings.picked).concat(parseTargets(settings && settings.services));
    const seen = new Set();
    const out = [];
    for (const t of all) {
      const key = String(t.url).replace(/\/+$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= MAX_SERVICES) break;
    }
    return out;
  }

  /* Duree ecoulee en clair : « 1 h 35 », « 12 min ». Les secondes ne
     servent a rien ici -- un incident se compte en minutes -- et un
     horodatage brut obligerait a faire la soustraction de tete devant
     l'ecran.
     Elapsed time in plain words. Seconds are useless here, and a raw
     timestamp would force the reader to do the subtraction in their
     head. */
  function since(iso, i18n, now) {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return null;
    const min = Math.max(0, Math.round(((now || Date.now()) - t) / 60000));
    if (min < 1) return i18n.t("svcstatus.justNow");
    if (min < 60) return min + " " + i18n.t("svcstatus.min");
    const h = Math.floor(min / 60);
    const rest = min % 60;
    if (h < 24) return h + " h" + (rest ? " " + String(rest).padStart(2, "0") : "");
    return Math.floor(h / 24) + " " + i18n.t("svcstatus.days");
  }

  class ServiceStatusWidget {
    constructor(ctx) {
      this.ctx = ctx;
      this.timer = null;
      this.services = [];
      this.fetchedAt = null;
      this.fast = false;
      this.healthyStreak = 0;
      /* Incidents deja signales, pour ne notifier qu'une fois par
         incident. Sans cela, la tuile sonnerait a CHAQUE relevé pendant
         toute la duree de la panne -- soit, en cadence rapide, toutes les
         minutes pendant des heures : la meilleure facon de faire couper
         les notifications pour de bon.
         Incidents already announced, so each is notified once. Without
         this the tile would ring at EVERY reading for the whole outage --
         every minute for hours at the fast cadence, the surest way to get
         notifications switched off for good. */
      this.announced = new Set();
      this.firstLoadDone = false;
    }

    init() {
      this.render();
      this.refresh();
    }

    /* Le nouvel objet de reglages doit etre REPRIS : l'application en
       construit un neuf a chaque enregistrement, et `this.ctx.settings`
       continuerait sinon de designer l'ancien. La tuile semblait alors
       ignorer tout changement jusqu'au rechargement complet du
       tableau -- defaut present depuis la premiere version, invisible
       tant que les seuls reglages etaient des intervalles qu'on ne
       touche qu'une fois, et mis au jour par le test fonctionnel des
       modes d'affichage.
       The new settings object must be TAKEN UP: the application builds
       a fresh one on each save, and `this.ctx.settings` would otherwise
       still point at the old one, so the tile appeared to ignore every
       change until a full board reload -- a defect present since the
       first version, invisible while the only settings were intervals
       one sets once, and brought out by the functional test of the
       display modes. */
    onSettingsChanged(settings) {
      if (settings) this.ctx.settings = settings;
      this.announced.clear();
      this.healthyStreak = 0;
      this.refresh();
    }

    normalMinutes() {
      return Math.max(1, Number(this.ctx.settings.refreshMinutes) || 10);
    }

    incidentMinutes() {
      return Math.max(1, Number(this.ctx.settings.incidentRefreshMinutes) || 1);
    }

    arm() {
      clearTimeout(this.timer);
      const minutes = this.fast ? this.incidentMinutes() : this.normalMinutes();
      this.timer = setTimeout(() => this.refresh(), minutes * 60000);
    }

    async refresh() {
      /* On attend le catalogue AVANT de construire les cibles : sans
         cela le premier relevé partirait avec les adresses enregistrees,
         donc avec les anciennes, et l'ecran montrerait l'erreur que l'on
         vient justement de corriger -- le temps d'un relevé, ce qui
         suffit a faire croire que la correction n'a pas pris.
         The catalogue is awaited BEFORE building the targets: otherwise
         the first reading would go out with the stored (old) addresses
         and the screen would show the very error just fixed. */
      await loadCatalog(this.ctx.settings.catalogAuto !== false);
      const targets = mergeTargets(this.ctx.settings);
      if (!targets.length) {
        this.services = [];
        this.render();
        this.arm();
        return;
      }
      try {
        /* On transmet l'adaptateur quand on le connait (il vient du
           catalogue) : sans cela le serveur sonderait quatre formats
           pour chaque service a chaque relevé, soit trois requetes
           inutiles par service -- et vingt-cinq services en cadence
           incident, cela devient impoli.
           The adapter is passed when known (it comes from the
           catalogue): otherwise the server would probe four formats per
           service per reading, three needless requests each -- and at
           twenty-five services on the incident rhythm that becomes
           rude. */
        const live = targets.filter((t) => !t.retired);
        if (!live.length) {
          this.services = targets.map((t) => ({ label: t.label, error: "retired", retired: true, family: t.family }));
          this.render(); this.arm(); this.firstLoadDone = true;
          return;
        }
        const qs = live.map((t) => "s=" + encodeURIComponent(
          (t.adapter || "auto") + "~" + t.url + (t.api ? "~" + t.api : "")
        )).join("&");
        const r = await fetch("api/service-status?" + qs);
        if (!r.ok) throw new Error("http " + r.status);
        const data = await r.json();
        const list = Array.isArray(data.services) ? data.services : [];
        /* Les reponses suivent `live`, pas `targets` : les entrees
           retirees n'ont pas ete demandees et doivent etre reinserees a
           leur place, sans quoi chaque reponse glisserait d'un cran et
           porterait le nom du service suivant -- et la cloche avec.
           The answers follow `live`, not `targets`: retired entries
           were not asked for and must be put back in place, otherwise
           every answer would shift by one and carry the next service's
           name -- and its bell with it. */
        const answered = list.map((svc, i) => Object.assign({}, svc, {
          label: live[i] ? (live[i].label || svc.name || live[i].url) : (svc.name || ""),
          /* La cloche suit le service, pas la reponse : c'est un reglage
             local, et le serveur n'en sait rien.
             The bell travels with the service, not the answer: it is a
             local setting the server knows nothing about. */
          alert: live[i] ? live[i].alert !== false : true,
          family: live[i] ? live[i].family : "custom"
        }));
        let next = 0;
        this.services = targets.map((t) => (t.retired
          ? { label: t.label, error: "retired", retired: true, alert: false, family: t.family }
          : answered[next++]));
        this.fetchedAt = Date.now();
        this.updateCadence();
        this.notifyNewIncidents();
        this.firstLoadDone = true;
      } catch (e) {
        console.warn("[piboard/servicestatus]", e);
        /* Le relais injoignable, c'est PiBoard qui ne repond pas, pas le
           service surveille. On garde donc le dernier etat connu et on le
           signale comme perime, plutot que d'afficher du vert ou du rouge
           qu'on ne tient de personne.
           An unreachable relay means PiBoard is not answering, not the
           watched service: the last known state is kept and flagged as
           stale rather than showing a green or a red we got from nobody. */
        this.relayError = true;
      }
      this.render();
      this.arm();
    }

    worstIndicator() {
      const RANK = { none: 0, unknown: 1, minor: 2, major: 3, critical: 4 };
      let worst = "none";
      for (const s of this.services) {
        const ind = s.error ? "unknown" : (s.indicator || "unknown");
        if ((RANK[ind] || 0) > (RANK[worst] || 0)) worst = ind;
      }
      return worst;
    }

    /* Bascule de cadence. L'acceleration est IMMEDIATE, le retour au
       calme demande deux relevés sains : voir l'en-tete du fichier.
       Cadence switch: speeding up is IMMEDIATE, calming down takes two
       healthy readings. */
    updateCadence() {
      const healthy = this.worstIndicator() === "none";
      if (!healthy) {
        this.healthyStreak = 0;
        this.fast = true;
        return;
      }
      this.healthyStreak += 1;
      if (this.healthyStreak >= 2) this.fast = false;
    }

    notifyNewIncidents() {
      const s = this.ctx.settings;
      if (!s.notifyOnIncident) return;
      const minRank = SEVERITY_RANK[s.alertMinSeverity] || SEVERITY_RANK.minor;
      const fresh = [];
      for (const svc of this.services) {
        for (const inc of (svc.incidents || [])) {
          const key = (svc.base || svc.label) + "#" + (inc.id || inc.name);
          if (this.announced.has(key)) continue;
          /* Enregistre AVANT les deux filtres, et c'est deliberé : un
             incident ecarte parce que le service est silencieux ou
             l'incident trop benin ne doit pas sonner plus tard, au
             relevé suivant, si son impact est reevalué ou si la cloche
             est rallumée. Il a eu lieu pendant qu'on ne voulait pas en
             etre averti ; seul ce qui APPARAIT alerte.
             Recorded BEFORE the two filters, deliberately: an incident
             skipped because the service is silent or the incident too
             mild must not ring later, at the next reading, if its impact
             is re-rated or the bell is switched back on. Only what
             APPEARS alerts. */
          this.announced.add(key);
          if (svc.alert === false) continue;
          const rank = SEVERITY_RANK[inc.impact] != null
            ? SEVERITY_RANK[inc.impact]
            : (SEVERITY_RANK[svc.indicator] || 0);
          if (rank < minRank) continue;
          fresh.push({ svc, inc });
        }
      }
      /* Au TOUT PREMIER chargement, on enregistre les incidents en cours
         sans alerter : un incident vieux de trois heures, deja connu,
         n'a pas a declencher un flash plein ecran parce que le tableau
         vient de redemarrer. On n'alerte que sur ce qui apparait sous
         nos yeux.
         On the VERY FIRST load, ongoing incidents are recorded without
         alerting: a three-hour-old incident must not trigger a
         full-screen flash merely because the board just restarted. */
      if (!this.firstLoadDone || !fresh.length) return;

      const first = fresh[0];
      const label = first.svc.label || first.svc.name || "";
      this.ctx.api.startAlert({
        flash: s.notifyFlash !== false,
        soundName: s.notifySound !== false ? (s.notifySoundChoice || "beep-simple") : null,
        durationMs: Math.max(1, Number(s.notifyDurationSeconds) || 15) * 1000
      });
      if (s.notifyUrl) {
        const message = label + " — " + first.inc.name;
        const url = s.notifyUrl.indexOf("{message}") !== -1
          ? s.notifyUrl.replace("{message}", encodeURIComponent(message))
          : s.notifyUrl;
        fetch(url, { mode: "no-cors" }).catch(() => { /* best effort */ });
      }
    }

    render() {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const el = this.ctx.el;
      const targets = mergeTargets(s);

      if (!targets.length) {
        el.innerHTML = `<div class="pw-svcstatus"><div class="pwss-empty">${esc(i18n.t("svcstatus.noService"))}</div></div>`;
        return;
      }
      if (!this.services.length) {
        el.innerHTML = `<div class="pw-svcstatus"><div class="pwss-empty">${esc(i18n.t("svcstatus.loading"))}</div></div>`;
        return;
      }

      const now = Date.now();
      const body = this.renderBody(i18n, s, now);
      const checked = this.fetchedAt
        ? i18n.t("svcstatus.checked") + " " + since(new Date(this.fetchedAt).toISOString(), i18n, now)
        : "";
      const cadence = this.fast
        ? `<span class="pwss-fast">${esc(i18n.t("svcstatus.cadence.fast"))} · ${this.incidentMinutes()} ${esc(i18n.t("svcstatus.min"))}</span>`
        : `<span>${esc(i18n.t("svcstatus.cadence.normal"))} · ${this.normalMinutes()} ${esc(i18n.t("svcstatus.min"))}</span>`;

      el.innerHTML = `
        <div class="pw-svcstatus">
          <div class="pwss-list">${body}</div>
          <div class="pwss-foot"><span>${esc(checked)}</span>${cadence}</div>
        </div>`;

      /* Un SEUL ecouteur, pose sur la liste, plutot qu'un par pastille :
         la liste est reconstruite a chaque relevé, et des ecouteurs
         poses sur les pastilles disparaitraient avec elles -- la
         deuxieme minute, plus rien ne repondrait au clic. Defaut
         classique, evite ici par delegation.
         ONE listener on the list rather than one per chip: the list is
         rebuilt at every reading, and per-chip listeners would vanish
         with it -- after the first minute nothing would answer a click. */
      const list = el.querySelector(".pwss-list");
      if (list) {
        list.addEventListener("click", (ev) => {
          const chip = ev.target.closest ? ev.target.closest(".pwss-chip[data-svc]") : null;
          if (!chip) return;
          this.openDetail(Number(chip.dataset.svc));
        });
      }
    }

    /* TROIS MODES, UNE SEULE REGLE : ce qui va mal est toujours ecrit en
       entier, ce qui va bien se tasse. C'est ce qui permet de passer de
       trois a vingt-cinq services sans changer de tuile -- et ce qui
       evite le piege inverse, un mode compact si compact qu'il faudrait
       cliquer pour apprendre ce qui ne va pas.
         - detaille : comme avant, une fiche par service ;
         - compact  : une pastille par service sain, une fiche pour
                      chaque service en difficulte ;
         - problemes: les fiches des services en difficulte, et une
                      seule ligne quand il n'y en a aucun.
       THREE MODES, ONE RULE: what is wrong is always written out in
       full, what is fine is condensed. This is what lets three services
       become twenty-five without changing tiles -- and what avoids the
       opposite trap, a compact mode so compact that one would have to
       click to learn what is broken. */
    /* REGROUPER PAR FAMILLE. Vingt-cinq services ranges au hasard de
       l'ordre ou on les a coches forment une liste qu'il faut LIRE en
       entier pour y trouver quelque chose. Ranges par theme -- cloud,
       DevOps, IA, France... -- on va droit a la rubrique voulue, et une
       famille entiere au vert se survole d'un coup d'oeil.
       L'ordre des familles est celui du catalogue, pas l'ordre
       alphabetique : il a ete choisi pour que les choses proches se
       suivent, et un tri alphabetique le casserait pour rien.
       GROUPING BY FAMILY: twenty-five services in ticking order form a
       list one must READ entirely. The family order is the catalogue's,
       not alphabetical: it was chosen so that related things follow one
       another. */
    groupServices(list) {
      if (this.ctx.settings.groupByFamily === false) return [{ id: null, label: null, items: list }];
      const order = CATALOG.families.length
        ? CATALOG.families.map((f) => f.id)
        : [];
      const byFam = new Map();
      for (const svc of list) {
        const fam = svc.family || "custom";
        if (!byFam.has(fam)) byFam.set(fam, []);
        byFam.get(fam).push(svc);
      }
      /* Les familles inconnues du catalogue (un reglage ancien, un
         catalogue qui ne s'est pas charge) ne disparaissent pas : elles
         passent a la fin plutot que d'emporter leurs services avec
         elles. Families unknown to the catalogue do not vanish: they go
         last rather than taking their services with them. */
      const ids = order.filter((id) => byFam.has(id))
        .concat([...byFam.keys()].filter((id) => order.indexOf(id) === -1));
      return ids.map((id) => {
        const fam = CATALOG.families.find((f) => f.id === id);
        const label = fam
          ? ((fam.icon ? fam.icon + " " : "") + this.ctx.i18n.fromManifest(fam.label))
          : null;
        return { id, label, items: byFam.get(id) };
      });
    }

    famHead(group) {
      if (!group.label || !group.id) return "";
      return `<div class="pwss-fam">${esc(group.label)}</div>`;
    }

    renderBody(i18n, s, now) {
      const mode = s.display || "detailed";
      const list = this.visibleServices();

      /* COMPACT + : tout le monde en pastille, les services en panne
         comme les autres. C'est le mode d'un mur d'ecran -- vingt-cinq
         services tiennent dans un coup d'oeil -- et le detail se demande
         d'un clic plutot que de s'imposer en permanence. Les autres
         modes gardent la regle inverse (ce qui va mal est ecrit en
         entier), parce qu'ils s'adressent a quelqu'un qui est devant
         l'ecran et non a trois metres.
         COMPACT +: everyone as a chip, failing services included. The
         wall-display mode -- twenty-five services at a glance -- where
         detail is asked for with a click instead of imposing itself. */
      if (mode === "compactplus") {
        return this.groupServices(list).map((g) => this.famHead(g)
          + `<div class="pwss-grid pwss-grid-plus">`
          + g.items.map((svc) => this.renderChip(svc, i18n, list.indexOf(svc))).join("")
          + `</div>`).join("");
      }

      if (mode === "detailed") {
        return this.groupServices(list).map((g) => this.famHead(g)
          + g.items.map((svc) => this.renderService(svc, i18n, s, now)).join("")).join("");
      }

      const bad = list.filter((svc) => svc.error || (svc.indicator && svc.indicator !== "none"));
      const good = list.filter((svc) => bad.indexOf(svc) === -1);
      const cards = bad.map((svc) => this.renderService(svc, i18n, s, now)).join("");

      if (mode === "problems") {
        if (bad.length) return cards;
        return `<div class="pwss-allgood">${esc(i18n.t("svcstatus.allGood").replace("{n}", list.length))}</div>`;
      }

      /* En mode « compact », seuls les services sains sont groupes : les
         fiches des services en difficulte restent ensemble, en bas, ou
         on les cherche. Grouping applies to the healthy chips only; the
         cards of failing services stay together at the bottom. */
      const chips = this.groupServices(good)
        .filter((g) => g.items.length)
        .map((g) => this.famHead(g)
          + `<div class="pwss-grid">` + g.items.map((svc) => this.renderChip(svc, i18n, list.indexOf(svc))).join("") + `</div>`)
        .join("");
      return chips + cards;
    }

    /* Les services tels qu'ils doivent etre AFFICHES : filtre
       geographique applique s'il est actif. La liste d'origine
       (`this.services`) n'est jamais touchee -- decocher l'option
       reaffiche tout sans redemander le reseau.
       The services as they must be SHOWN; the original list is never
       touched, so unticking the option restores everything without
       another network call. */
    visibleServices() {
      const s = this.ctx.settings;
      if (!s.geoFilter) return this.services;
      const zones = parseZones(s.geoZones);
      if (!zones.length) return this.services;
      return this.services.map((svc) => filterByZones(svc, zones));
    }

    /* La pastille : une icone, un nom, et rien d'autre. En Compact +
       c'est un BOUTON -- le detail s'ouvre au clic. Ailleurs c'est un
       simple reperage et le bouton ne gene pas : on garde la meme balise
       partout plutot que deux rendus a maintenir.
       The chip: an icon, a name, nothing else. In Compact + it is a
       BUTTON; elsewhere the same markup serves as a marker. */
    renderChip(svc, i18n, index) {
      const state = stateOf(svc);
      const approx = svc.approximate
        ? `<span class="pwss-approx" title="${esc(i18n.t("svcstatus.approximate"))}">~</span>` : "";
      const hidden = svc.hiddenCount
        ? `<span class="pwss-hidden-mark" title="${esc(i18n.t("svcstatus.hiddenTip"))}">·${svc.hiddenCount}</span>` : "";
      /* LE NOM D'ABORD, L'ICONE ENSUITE. On lit de gauche a droite : on
         cherche un service par son NOM, et l'etat est la reponse. Mettre
         l'icone en tete obligeait a parcourir une colonne d'icones pour
         retrouver la ligne qu'on voulait.
         THE NAME FIRST, THE ICON AFTER: one reads left to right, looks
         for a service by its NAME, and the state is the answer. */
      return `<button type="button" class="pwss-chip" data-svc="${index}" `
        + `style="--pwss-tone:${STATE_TONE[state]}" title="${esc(svc.label || "")}">`
        + `<span class="pwss-chip-name">${esc(svc.label || "")}</span>${approx}${hidden}`
        + iconHtml(state, i18n) + `</button>`;
    }

    renderService(svc, i18n, s, now) {
      const label = esc(svc.label || svc.name || "");

      if (svc.error) {
        /* Trois causes, trois messages. « Injoignable » affiche pour une
           page qui repond parfaitement mais dans un format inconnu
           envoie chercher une panne de reseau pour un probleme
           d'adaptateur -- c'est ce qui s'est passe avec PayPal.
           Three causes, three messages: "unreachable" shown for a page
           that answers perfectly in an unknown format sends one looking
           for a network fault to solve an adapter problem -- which is
           exactly what happened with PayPal. */
        const why = svc.error === "retired" ? "svcstatus.err.retired"
          : svc.error === "bad-url" ? "svcstatus.err.badUrl"
          : (svc.error === "bad-format" || svc.error === "bad-response") ? "svcstatus.err.badFormat"
            : svc.error === "http" ? "svcstatus.err.http"
              : "svcstatus.err.unreachable";
        const detailText = svc.error === "http" && svc.httpStatus
          ? i18n.t(why).replace("{code}", String(svc.httpStatus))
          : i18n.t(why);
        return `
          <div class="pwss-svc" style="--pwss-tone:${STATE_TONE.unknown}">
            <div class="pwss-head">
              <span class="pwss-name">${label}</span>
              ${iconHtml("unknown", i18n)}
            </div>
            <div class="pwss-detail"><span>${esc(detailText)}</span></div>
          </div>`;
      }

      const detail = [];

      /* Les composants touches UNIQUEMENT : lister ce qui va bien noierait
         le probleme au milieu de dix lignes vertes.
         ONLY the affected components: listing what works would drown the
         problem among ten green lines. */
      for (const c of (svc.affected || []).slice(0, 4)) {
        detail.push(`<span class="pwss-comp" style="--pwss-tone:${COMPONENT_TONE[c.status] || COMPONENT_TONE.unknown}">`
          + esc(c.name) + ` <span class="pwss-comp-state">— ${esc(i18n.t("svcstatus.comp." + c.status))}</span></span>`);
      }
      const more = (svc.affected || []).length - 4;
      if (more > 0) detail.push(`<span>${esc(i18n.t("svcstatus.more").replace("{n}", more))}</span>`);

      const inc = (svc.incidents || [])[0];
      if (inc) {
        const ago = since(inc.startedAt, i18n, now);
        const stage = inc.status ? i18n.t("svcstatus.stage." + String(inc.status).toLowerCase()) : "";
        detail.push(`<span class="pwss-incident">${esc(inc.name)}`
          + (stage || ago ? ` <span class="pwss-stage">· ${esc(stage)}${ago ? " · " + esc(i18n.t("svcstatus.for")) + " " + esc(ago) : ""}</span>` : "")
          + `</span>`);
        if (inc.lastMessage) detail.push(`<span class="pwss-msg">${esc(inc.lastMessage)}</span>`);
        if (inc.url) {
          detail.push(`<a class="pwss-link" href="${esc(inc.url)}" target="_blank" rel="noopener">`
            + esc(i18n.t("svcstatus.openIncident")) + `</a>`);
        }
      }

      if (s.showMaintenances !== false) {
        const m = (svc.maintenances || [])[0];
        if (m) {
          detail.push(`<span class="pwss-maint">${esc(i18n.t("svcstatus.maintenance"))} ${esc(m.name)}${m.scheduledFor ? " · " + esc(this.whenLabel(m.scheduledFor, i18n)) : ""}</span>`);
        }
      }

      if (svc.hiddenCount) {
        detail.push(`<span class="pwss-hidden">${esc(i18n.t("svcstatus.hidden").replace("{n}", svc.hiddenCount))}</span>`);
      }

      /* Le tilde marque un etat DEDUIT d'un flux RSS et non declare par
         le fournisseur. Deux etats qui se ressemblent a l'ecran doivent
         produire deux messages distincts : « operationnel » et « aucun
         billet recent sur le flux » ne sont pas la meme information, et
         confondre les deux ferait prendre un silence pour une bonne
         nouvelle.
         The tilde marks a state INFERRED from an RSS feed rather than
         declared by the provider: "operational" and "no recent post on
         the feed" are not the same information, and conflating them
         would turn a silence into good news. */
      const approx = svc.approximate
        ? `<span class="pwss-approx" title="${esc(i18n.t("svcstatus.approximate"))}">~</span>`
        : "";

      /* PLUS DE LIGNE PARASITE QUAND TOUT VA BIEN. « Aucun incident en
         cours », « aucune maintenance programmee » : trois lignes grises
         repetees vingt-cinq fois pour ne RIEN apprendre, et qui
         noyaient les deux services qui avaient quelque chose a dire.
         Un service sain, c'est son nom et son icone -- le reste du
         detail n'apparait que s'il existe. La tuile change donc de
         hauteur selon ce qui se passe, et c'est voulu : une tuile qui
         garde la meme silhouette quoi qu'il arrive est une tuile qu'on
         arrete de regarder.
         NO MORE FILLER LINES WHEN ALL IS WELL: "no ongoing incident",
         "no scheduled maintenance" -- grey lines repeated twenty-five
         times to teach NOTHING, drowning the two services that had
         something to say. A healthy service is its name and its icon. */
      const detailHtml = detail.length ? `<div class="pwss-detail">${detail.join("")}</div>` : "";

      return `
        <div class="pwss-svc" style="--pwss-tone:${STATE_TONE[stateOf(svc)]}">
          <div class="pwss-head">
            <span class="pwss-name">${label}</span>${approx}
            ${iconHtml(stateOf(svc), i18n)}
          </div>
          ${detailHtml}
        </div>`;
    }

    /* ---------- La fenetre de detail ----------
       Elle reprend `.modal` / `.modal-card`, la meme fenetre que le
       lecteur RSS et la boite mail : une seule facon de fermer a
       apprendre (la croix, l'exterieur, Echap), et l'apparence suit le
       theme sans une ligne de CSS de plus.
       It reuses .modal / .modal-card, the same window as the RSS reader
       and the mailbox: one way of closing to learn, and the appearance
       follows the theme with no extra CSS. */
    openDetail(index) {
      const i18n = this.ctx.i18n;
      const s = this.ctx.settings;
      const svc = this.visibleServices()[index];
      if (!svc) return;
      this.closeDetail();

      const now = Date.now();
      const body = this.renderService(svc, i18n, s, now);
      /* Ce que la fiche ne montre pas et que la fenetre, elle, peut se
         permettre : TOUS les composants touches et TOUS les incidents,
         puisqu'on a la place et qu'on vient de demander a voir.
         What the card does not show but the window can afford: ALL
         affected components and ALL incidents -- there is room, and one
         has just asked to see. */
      const extra = [];
      if ((svc.affected || []).length > 4) {
        extra.push(`<div class="pwss-modal-sec"><h4>${esc(i18n.t("svcstatus.modal.components"))}</h4>`
          + (svc.affected || []).map((c) => `<div class="pwss-comp" style="--pwss-tone:${COMPONENT_TONE[c.status] || COMPONENT_TONE.unknown}">`
              + esc(c.name) + ` <span class="pwss-comp-state">— ${esc(i18n.t("svcstatus.comp." + c.status))}</span></div>`).join("")
          + `</div>`);
      }
      if ((svc.incidents || []).length > 1) {
        extra.push(`<div class="pwss-modal-sec"><h4>${esc(i18n.t("svcstatus.modal.incidents"))}</h4>`
          + (svc.incidents || []).slice(1).map((inc) => `<div class="pwss-incident">${esc(inc.name)}`
              + (inc.startedAt ? ` <span class="pwss-stage">· ${esc(i18n.t("svcstatus.for"))} ${esc(since(inc.startedAt, i18n, now))}</span>` : "")
              + (inc.lastMessage ? `<span class="pwss-msg">${esc(inc.lastMessage)}</span>` : "")
              + `</div>`).join("")
          + `</div>`);
      }
      if ((svc.maintenances || []).length) {
        extra.push(`<div class="pwss-modal-sec"><h4>${esc(i18n.t("svcstatus.modal.maintenances"))}</h4>`
          + (svc.maintenances || []).map((m) => `<div class="pwss-maint">${esc(m.name)}`
              + (m.scheduledFor ? ` · ${esc(this.whenLabel(m.scheduledFor, i18n))}` : "") + `</div>`).join("")
          + `</div>`);
      }
      /* D'ou vient l'information, et quand : sur une tuile qui affiche
         un etat parfois DEDUIT, savoir quelle page a ete lue et a quelle
         heure vaut mieux qu'un vert sans provenance.
         Where the information comes from and when: on a tile that
         sometimes shows an INFERRED state, knowing which page was read
         beats an unsourced green. */
      const src = [];
      if (svc.base || svc.url) {
        const href = svc.url || svc.base;
        src.push(`<a class="pwss-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(i18n.t("svcstatus.modal.page"))}</a>`);
      }
      if (this.fetchedAt) src.push(`<span>${esc(i18n.t("svcstatus.checked"))} ${esc(since(new Date(this.fetchedAt).toISOString(), i18n, now))}</span>`);
      if (svc.approximate) src.push(`<span class="pwss-approx-note">~ ${esc(i18n.t("svcstatus.approximate"))}</span>`);

      const wrap = document.createElement("div");
      wrap.className = "modal pwss-modal";
      wrap.innerHTML = `
        <div class="modal-card">
          <div class="modal-head">
            <h2>${esc(svc.label || svc.name || "")}</h2>
            <button type="button" class="modal-close" aria-label="${esc(i18n.t("svcstatus.modal.close"))}">✕</button>
          </div>
          <div class="modal-body pwss-modal-body">
            ${body}
            ${extra.join("")}
            ${src.length ? `<div class="pwss-modal-src">${src.join("")}</div>` : ""}
          </div>
        </div>`;
      document.body.appendChild(wrap);

      const close = () => this.closeDetail();
      wrap.addEventListener("click", (ev) => { if (ev.target === wrap) close(); });
      const btn = wrap.querySelector(".modal-close");
      if (btn) btn.addEventListener("click", close);
      this.escHandler = (ev) => { if (ev.key === "Escape") close(); };
      document.addEventListener("keydown", this.escHandler);
      this.modal = wrap;
    }

    closeDetail() {
      if (this.escHandler) {
        document.removeEventListener("keydown", this.escHandler);
        this.escHandler = null;
      }
      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
    }

    whenLabel(iso, i18n) {
      const t = Date.parse(iso || "");
      if (!Number.isFinite(t)) return "";
      const d = new Date(t);
      return d.toLocaleString(i18n.t("clock.date.format"), {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    }

    destroy() {
      clearTimeout(this.timer);
      /* La fenetre vit dans <body>, pas dans la tuile : sans ce
         nettoyage, supprimer la tuile laisserait sa fenetre ouverte au
         milieu de l'ecran, sans rien pour la fermer.
         The window lives in <body>, not in the tile: without this,
         removing the tile would leave its window stranded on screen. */
      this.closeDetail();
    }
  }

  window.PiBoard.registerWidget("servicestatus", ServiceStatusWidget);

  /* Expose pour les tests : les fonctions pures de mise en forme, qui
     n'ont besoin ni du DOM ni du reseau.
     Exposed for tests: the pure formatting helpers. */
  window.PiBoardServiceStatusHelpers = {
    parseTargets, parsePicked, mergeTargets, since, MAX_SERVICES, SEVERITY_RANK,
    stateOf, concernsMe, parseZones, filterByZones
  };
})();
