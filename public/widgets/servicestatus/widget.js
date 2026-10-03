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
      out.push({ label, url, adapter: "auto", api: null, alert: true, manual: true });
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
                 alert: p.alert !== false, manual: false, retired: true };
      }
      return {
      label: p.name || (src && src.name) || "",
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
  const CATALOG = { byId: {}, loaded: false };
  let catalogPromise = null;

  function loadCatalog(remoteAllowed) {
    if (catalogPromise) return catalogPromise;
    const fill = (json) => {
      const cat = (json && json.catalog && typeof json.catalog === "object") ? json.catalog : json;
      const list = cat && Array.isArray(cat.services) ? cat.services : [];
      for (const svc of list) if (svc && svc.id) CATALOG.byId[svc.id] = svc;
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
          this.services = targets.map((t) => ({ label: t.label, error: "retired", retired: true }));
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
          alert: live[i] ? live[i].alert !== false : true
        }));
        let next = 0;
        this.services = targets.map((t) => (t.retired
          ? { label: t.label, error: "retired", retired: true, alert: false }
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
    renderBody(i18n, s, now) {
      const mode = s.display || "detailed";
      if (mode === "detailed") return this.services.map((svc) => this.renderService(svc, i18n, s, now)).join("");

      const bad = this.services.filter((svc) => svc.error || (svc.indicator && svc.indicator !== "none"));
      const good = this.services.filter((svc) => bad.indexOf(svc) === -1);

      const cards = bad.map((svc) => this.renderService(svc, i18n, s, now)).join("");

      if (mode === "problems") {
        if (bad.length) return cards;
        return `<div class="pwss-allgood">${esc(i18n.t("svcstatus.allGood").replace("{n}", this.services.length))}</div>`;
      }

      const chips = good.map((svc) => {
        const tone = svc.error ? TONE.unknown : (TONE[svc.indicator] || TONE.unknown);
        return `<span class="pwss-chip" style="--pwss-tone:${tone}" title="${esc(svc.label || "")}">`
          + `<span class="pwss-dot"></span><span class="pwss-chip-name">${esc(svc.label || "")}</span>`
          + (svc.approximate ? `<span class="pwss-approx" title="${esc(i18n.t("svcstatus.approximate"))}">~</span>` : "")
          + `</span>`;
      }).join("");

      return (chips ? `<div class="pwss-grid">${chips}</div>` : "") + cards;
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
          <div class="pwss-svc" style="--pwss-tone:${TONE.unknown}">
            <div class="pwss-head"><span class="pwss-name">${label}</span>
              <span class="pwss-state"><span class="pwss-dot"></span>${esc(i18n.t("svcstatus.state.unknown"))}</span></div>
            <div class="pwss-detail"><span>${esc(detailText)}</span></div>
          </div>`;
      }

      const tone = TONE[svc.indicator] || TONE.unknown;
      const stateLabel = i18n.t("svcstatus.state." + (svc.indicator || "unknown"));
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
      } else {
        detail.push(`<span class="pwss-none">${esc(i18n.t("svcstatus.noIncident"))}</span>`);
      }

      if (s.showMaintenances !== false) {
        const m = (svc.maintenances || [])[0];
        detail.push(m
          ? `<span class="pwss-maint">${esc(i18n.t("svcstatus.maintenance"))} ${esc(m.name)}${m.scheduledFor ? " · " + esc(this.whenLabel(m.scheduledFor, i18n)) : ""}</span>`
          : `<span class="pwss-none">${esc(i18n.t("svcstatus.noMaintenance"))}</span>`);
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

      return `
        <div class="pwss-svc" style="--pwss-tone:${tone}">
          <div class="pwss-head"><span class="pwss-name">${label}</span>
            <span class="pwss-state"><span class="pwss-dot"></span>${esc(stateLabel)}${approx}</span></div>
          <div class="pwss-detail">${detail.join("")}</div>
        </div>`;
    }

    whenLabel(iso, i18n) {
      const t = Date.parse(iso || "");
      if (!Number.isFinite(t)) return "";
      const d = new Date(t);
      return d.toLocaleString(i18n.t("clock.date.format"), {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    }

    destroy() { clearTimeout(this.timer); }
  }

  window.PiBoard.registerWidget("servicestatus", ServiceStatusWidget);

  /* Expose pour les tests : les fonctions pures de mise en forme, qui
     n'ont besoin ni du DOM ni du reseau.
     Exposed for tests: the pure formatting helpers. */
  window.PiBoardServiceStatusHelpers = {
    parseTargets, parsePicked, mergeTargets, since, MAX_SERVICES, SEVERITY_RANK
  };
})();
