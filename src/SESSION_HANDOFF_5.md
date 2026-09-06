# Session 5 — Audit contradictoire et correctifs (2026-09-06)

> À lire avant tout travail sur chang64. Les handoffs 1 à 4 donnent
> l'historique antérieur. Celui-ci couvre l'audit de vérification demandé par
> `PROMPT_AUDIT_OPUS.md` et les correctifs qui en sont sortis.

---

## 0. ÉTAT À LA LIVRAISON

Tout est vert, mesuré, pas déduit.

- **49 fichiers dans `tests/`, 0 échec.** Y compris `check_banque_exercices.js`,
  qui ne terminait jamais avant cette session.
- **13 suites d'origine, 0 échec, 0 plantage.** Elles en cumulaient 4 plantages
  et 7 échecs en début de session.
- Build : 180 pages de contenu, 141 redirections FR, 147 images de partage,
  241 URLs au sitemap, `index.html` à 342 Ko, 58,1 Mo.
- Non-régression contre la baseline GitHub : `check_urls_indexees` 9 OK,
  `check_non_regression` 25 OK. Aucune URL indexée perdue.

### Nouveaux fichiers source à commiter impérativement

- **`content-dates.json`** — registre des dates de publication. **S'il est
  perdu, tout l'historique repart à la date du jour sur les 466 pages.** Le
  build affiche un avertissement encadré s'il est absent.
- Les 9 nouveaux tests dans `tests/` (liste au §4).

---

## 1. MÉTHODE

Environnement reconstitué à l'identique : `npm install terser jsdom
puppeteer-core --no-save`, `pip install cairosvg --break-system-packages`,
`node build_site.js`.

Baseline de non-régression récupérée depuis
`codeload.github.com/AlexZ1212/chang64/tar.gz/refs/heads/main` →
`chang64-main/chang64-site/`, exportée en `CHANG64_BASELINE`. Confirmée comme
état pré-session : 468 fichiers y référencent Google Fonts contre 0 localement,
0 y portent un `BreadcrumbList` contre 466 localement.

Mesures faites dans un vrai Chromium (Puppeteer, `linux-131.0.6778.204`), pas
en jsdom, dès qu'il s'agissait de rendu, de focus, de réseau ou de service
worker. Les scripts d'audit sont jetables et ne sont pas livrés ; leur méthode
est décrite là où elle compte.

**Trois faux positifs écartés en cours de route**, notés ici parce qu'ils
coûtent du temps à qui les retrouverait :

1. « 64 cases sans nom accessible sur l'écran d'ouverture » — l'échiquier y est
   en 0×0 sous un sous-arbre masqué, donc invisible pour un lecteur d'écran.
2. « 13 éléments sans indicateur de focus dans l'application » — tous dans des
   panneaux masqués. Sur les éléments réellement visibles : 0 sur 32.
3. « la médiane de `margin` est à 0 partout » — artefact de mon propre script,
   un `p.margin||0` qui transformait les champs absents en zéros.

---

## 2. CE QUI A ÉTÉ CORRIGÉ

### 2.1 Accessibilité — le défaut le plus grave

**`announceCell()` annonçait la mauvaise case, sur les 64.**

`SQ_NAMES` (ui3.js) calculait la rangée en `1+(s>>4)` alors que le moteur
(`sqN`, engine_browser.js l.11) et `sqLabel()` (ui.js) utilisent `8-(s>>4)`.
Les deux formules sont l'image miroir l'une de l'autre et ne coïncident pour
aucune rangée. Mesure : **0 case sur 64** où le nom accessible et l'annonce
concordaient. La tour noire en a8 était annoncée « a1 ».

Second défaut dans la même fonction : elle appelait `pColor()` et `pType()`,
qui n'existent nulle part (les vraies sont `pC()` et `pT()`). Le `try` avalait
la `ReferenceError`, donc **aucune pièce n'a jamais été annoncée**, et l'accord
en genre ajouté en session 4 était du code mort à cet endroit.

Corrigé, puis simplifié : `announceCell()` a été **supprimée**. Le lecteur
d'écran lit déjà le nom accessible au focus, et la navigation aux flèches
n'existe que quand une case a le focus. La région live ne faisait que répéter.
Elle reste utilisée pour les coups, le statut et l'annulation de sélection.

Vérifié : 64/64 concordent, EN et FR, accord en genre conservé
(« tour noire en a8 », « dame blanche en d1 »).

**Cases anonymes quand `/data/` échoue.** `buildBoard()` pose désormais le nom
accessible dès la construction, pas seulement au `render()`. Sans ça, quand un
shard ne répondait pas, l'échiquier restait affiché (340 px, aucun ancêtre
masqué) avec 64 `role="button"` sans nom.

**`aria-pressed` retiré des `role="radio"`** du réglage d'annonces
(ui3.js) : deux états concurrents annoncés pour un seul contrôle.

**Lien d'évitement** ajouté sur les 466 pages de contenu, avec un
`<main id="contenu">` comme cible. L'application en avait un, elles non : au
clavier il fallait retraverser les 16 liens d'en-tête à chaque page.

### 2.2 Perte de données

**Le code de reprise écrêtait la progression au niveau 5.** `readCode()`
bornait à `Math.min(5, ...)` alors que `LEVELS` en compte 10. Aller-retour
mesuré : les niveaux 6, 8 et 10 revenaient tous à 5, avec un message
confirmant « niveau 5 ». Sur le mécanisme qui porte toute la promesse du site
sans compte. Borné sur `LEVELS.length`.

**Bascule du stockage en silence.** Quand `localStorage` est refusé
(navigation privée) ou plein, la couche bascule en mémoire — correctement —
mais sans rien dire, et le pied de page continuait d'annoncer « progression
enregistrée sur cet appareil ». Un avertissement s'affiche désormais.

### 2.3 Le bug signalé en séance : le bandeau de coups

Jouer un coup ramenait l'échiquier au premier coup joué. Reproduit et corrigé.

Mécanisme : le recentrage de la puce courante est un défilement **doux** ;
`navScrollSuppressed` le protège, garde levée au `scrollend` ou à défaut après
400 ms. Quand le bandeau déborde, l'animation dépasse ces 400 ms : la garde
retombe trop tôt, les derniers événements passent, et `handleNavScroll`
synchronise sur la première puce visible. Le retour sur le **premier coup joué**
plutôt que sur « Début de partie » s'explique par un `scrollLeft` pas tout à
fait nul, qui pousse la puce 0 hors du seuil de visibilité.

Correctif : garde `partieVivante()` dans `handleNavScroll` (ui2.js). La synchro
par défilement est interdite tant que la partie est vivante, en mode `play`
comme en mode `friend`. Elle reste active en analyse, là où elle était voulue.
Cliquer une puce passe par `gotoPly()` et reste disponible partout.

**Les délais de suppression n'ont pas été touchés** : les allonger n'aurait
rendu le bug qu'intermittent.

Preuve : partie en cours, bandeau débordant à 13 puces, position au ply 11,
`scrollLeft` remis à 0 et événement `scroll` émis. Baseline → ply 0, échiquier
déplacé. Build corrigé → ply 11, échiquier intact.

> Note de méthode : le défilement doux ne s'anime pas en headless, donc la
> course ne se déclenche pas toute seule. Il faut attaquer le chemin de code
> directement, comme ci-dessus.

### 2.4 Exercices

**Bouton « Exercice suivant » désactivé tant que rien n'a été tenté.**

Le critère n'est PAS `puzzleDone`, et c'est le point important. Un mauvais coup
n'est pas terminal : il incrémente `puzzleTries` et rend la main. Et **rien ne
clôt un exercice en échec**, même `solvePuzzle()` se contente d'afficher la
réponse en demandant de la jouer. Bloquer sur `puzzleDone` enfermait donc pour
de bon quelqu'un qui refuse de jouer le coup montré.

Le critère est `puzzleTries === 0`. Le premier essai libère, l'indice et la
solution aussi. Une ligne sous l'échiquier explique le blocage et nomme la
sortie (l'indice, dont le second clic donne la solution) : un bouton grisé sans
explication laisse la personne devant un mur, et l'infobulle n'existe pas au
doigt.

**Redécoupage des dix niveaux.** Avant, les bandes étaient taillées sur le seul
score `diff`. Résultat mesuré : « Mating attacks » contenait 8 % de mats,
« Forcing mates » 3 %, contre 26 % pour « First steps », et la profondeur de
calcul **diminuait** en montant (18 % d'exercices à plusieurs coups au niveau 6
contre 5 % au niveau 10).

La cause n'est pas un mauvais réglage : **`diff` n'est pas comparable d'une
famille d'exercices à l'autre.** Un mat obtient un score bas parce qu'il est
forçant, pas parce qu'il est facile à trouver.

Le découpage suit désormais ce que l'exercice demande au joueur, une famille
par niveau. `diff` garde son rôle là où il est valable, à l'intérieur d'une
famille.

| n° | contenu | effectif | nom EN | nom FR |
|---|---|---|---|---|
| 1 | prises, diff médiane 4 | 5 124 | First steps | Premiers pas |
| 2 | prises, 8 | 5 124 | Loose pieces | Pièces en prise |
| 3 | prises, 12 | 5 124 | Quieter captures | Prises plus discrètes |
| 4 | prises, 20 | 5 122 | Well-hidden captures | Prises bien cachées |
| 5 | mat en un | 3 943 | Mate in one | Mat en un |
| 6 | fourchettes | 4 692 | Forks | Fourchettes |
| 7 | clouages, enfilades, déviations | 3 790 | Pins and skewers | Clouages et enfilades |
| 8 | attaques doubles | 6 437 | Double attacks | Attaques doubles |
| 9 | coup gagnant | 4 751 | The winning move | Le coup gagnant |
| 10 | mats en deux et trois | 7 512 | Mate in two | Mat en deux |

Les niveaux n'ont volontairement pas la même taille : une famille ne se coupe
pas en morceaux égaux sans redevenir arbitraire. La profondeur de calcul passe
de 0 % aux niveaux 1 à 6 à **75 % au niveau 10**.

**Conséquence à connaître :** les niveaux changent de sens. Un joueur
enregistré au niveau 7 recevra des clouages et enfilades là où il avait des
« tactiques avancées ». Rien n'est perdu, son code de reprise reste valide.

**53 exercices hors bande** portaient le niveau 5 avec un `diff` de 52 à 128
(le niveau 10 commence à 50). Absorbés par le redécoupage.

### 2.5 Performance — découpage des shards

**372 Ko gzip → 20 Ko gzip pour afficher le premier exercice, 95 % en moins.**
Mesuré sur le réseau, octets compressés réellement servis, baseline contre
build corrigé.

Chaque niveau est coupé en morceaux de 500 exercices **dans l'ordre de
difficulté croissante**, celui-là même que `nextPuzzle()` consomme. Le premier
morceau suffit pour commencer, les suivants arrivent quand le joueur avance
(anticipation dès qu'il reste moins de 40 exercices frais, secours immédiat
s'il n'en reste aucun). 109 fichiers, 10 manifestes.

`level-N.json` n'est plus le tableau mais un manifeste
`{total, taille, morceaux}`. `puzzle-index.json` porte `[niveau, morceau]`.
`LEVEL_CACHE[lvl]` garde le même sens qu'avant : il grandit au fil des
morceaux au lieu d'arriver d'un bloc.

### 2.6 Hors ligne

Les shards `/data/` avaient été exclus du service worker en session 4 pour
protéger la coquille du quota iOS. La protection marchait, mais au prix de
**tout** l'accès hors ligne aux exercices : « Impossible de charger les
exercices » et un échiquier vide.

Ils sont revenus dans un **cache séparé plafonné à 3 entrées**. Le cache
distinct et le plafond traitent la vraie cause de l'incident iOS, qui était le
volume : trois morceaux pèsent quelques Mo là où la banque entière en pesait 17.

Vérifié avec un vrai service worker : réseau coupé, rechargement complet,
l'application démarre et un exercice se charge avec ses pièces.

> Piège rencontré : ma première version du plafond ne plafonnait rien. Cinq
> requêtes simultanées laissaient **6 entrées au lieu de 3**, chacune lisant
> `keys()` avant qu'aucune écriture n'ait atterri. Les écritures sont
> sérialisées dans une file (`fileDeco`). **Ne remplace pas cette chaîne par
> des appels parallèles.**

### 2.7 Sécurité

**`'unsafe-inline'` retiré de `script-src`.** C'était la vraie protection XSS,
que le reste de l'en-tête laissait croire acquise.

> Correction d'un chiffrage : l'audit avait d'abord conclu qu'il fallait
> **936 empreintes**, donc que la sortie était impraticable. Ce chiffre était
> faux, il comptait les blocs `<script type="application/ld+json">`, qui sont
> des blocs de **données**, non exécutés, auxquels `script-src` ne s'applique
> pas. En ne comptant que l'exécutable : **5 empreintes distinctes** sur 467
> pages.

`poserHachagesCSP()` calcule les empreintes **après génération**, sur le site
tel qu'il est servi. Les déduire des gabarits reviendrait à hacher ce qu'on
croit avoir écrit, et le moindre écart de minification couperait tout le
JavaScript.

Vérifié en servant la vraie CSP en en-tête HTTP dans Chromium : 7 pages, le
parcours Jouer, et l'onglet Analyser avec Stockfish (WebAssembly + worker).
**Zéro violation.**

`object-src 'none'` ajouté. `style-src` garde `'unsafe-inline'`
volontairement : un attribut `style="..."` ne peut pas être couvert par une
empreinte, et une feuille injectée ne s'exécute pas.

### 2.8 Contenu et cycle de vie

**Datation.** Les pages ne portaient aucune date lisible, et `dateModified`
valait la date de build : les 467 pages remontaient ensemble à chaque
déploiement. Un registre versionné (`content-dates.json`) retient l'empreinte
du corps de chaque page avec ses vraies dates. `datePublished` ajouté. Date
visible dans le pied des pages de contenu.

Mesuré : reconstruction sans rien changer → 0 modifiée. Une seule empreinte
altérée → 1 modifiée, et cette page seule remonte.

**`<noscript>`** sur l'application. Sans JavaScript elle rendait 2 258 px de
mise en page avec un seul lien utilisable et aucune explication. Le nombre de
liens utilisables passe de 1 à 5. Les pages de contenu fonctionnent sans JS et
n'en ont pas besoin.

### 2.9 Les suites de tests

Les 13 suites d'origine cumulaient **4 plantages et 7 échecs**. Le handoff 4
annonçait « 40 fichiers, 0 échec », ce qui était vrai pour `tests/` seulement,
alors que `run_tests.js` exécute aussi ces suites-là.

| suite | avant | après |
|---|---|---|
| `i18ntest` | 22 ok + plantage `tab-train` | **31 ok** |
| `uitest4` | plantage, URL vide | **parcours complet** |
| `uitest6` | 20 ok, 2 échecs, plantage | **38 ok** |
| `uitest7` | 23 ok, 2 échecs, plantage | **46 ok** |
| `uitest8` | 9 ok + plantage `tab-train` | **28 ok** |
| `sitetest` | 26 ok, 1 échec | **28 ok** |
| `sitetest3` | 28 ok, 4 échecs | **32 ok** |

**Toutes** cassées par la même chose : un point d'entrée d'interface renommé ou
déplacé (`tab-train` supprimé le 03/09, `btnAmiNew` devenu une modale le 04/09,
`btnDaily` remplacé par une carte, `btnCoord` et `btnGoRush` court-circuités).
Aucune par une régression fonctionnelle. D'où `tests/check_points_d_entree.js`.

Deux échecs venaient de la session 4 elle-même : `uitest6` attendait « No clock »
dans la rangée des cadences, retirée par le correctif 15.

`uitest7` affichait « puzzles still solvable — 2/3 », que j'avais d'abord pris
pour un aléa de tirage. C'en était pas un : depuis que `tab-puzzles` ouvre le
menu, il ne charge plus aucun exercice, donc le premier tour de boucle
travaillait sur ce que l'échiquier affichait encore.

**`check_banque_exercices.js` ne terminait jamais.** Sa vérification exhaustive
des 11 455 mats dépassait les 300 s du lanceur, donc les sections suivantes
n'étaient **jamais exécutées**. Échantillonnage déterministe ajouté (un sur 12,
`CHANG64_MATS=0` pour tout vérifier) : le fichier passe maintenant en 49 s.

Ce faisant, deux assertions cachées depuis toujours ont fait surface :

- « aucun thème sans traduction française » lisait `themes.json`, qui est une
  table de **renommage** (vide), pas de traduction. Elle déclarait les 13
  thèmes non traduits alors qu'ils le sont tous dans `i18n.js`. Corrigée pour
  lire le vrai chemin.
- « chaque motif couvre plusieurs niveaux » lisait le champ `level` de
  `puzzles.json`, qui n'est plus servi depuis le redécoupage. Retirée ; la
  composition des niveaux est gardée par `check_bandes_niveaux.js`, sur les
  fichiers publiés.

---

## 3. CE QUI A ÉTÉ VÉRIFIÉ ET DÉCLARÉ CORRECT

À ne pas réauditer sans raison.

- **Polices auto-hébergées** : zéro requête externe sur l'application comme sur
  les pages de contenu, 6 woff2, `swap` côté app et `optional` côté contenu,
  piles de secours complètes, aucune déclaration sans repli. Tenue jusqu'à
  400 ms de latence par requête, cache froid.
- **Cibles tactiles** : aucune sous 24 px. Débordement horizontal nul à 390 px.
- **`lier()`** : 547 entrées FR, aucune ne bouge après un tour supplémentaire,
  plus longue chaîne insécable 18 caractères (« par correspondance »).
- **Patron des onglets** : plus aucun `role="tablist"`, `role="tab"` ni
  `aria-selected`. `aria-current="page"` correct.
- **Surface d'attaque par URL** : les 4 routes sont saines. `#p=` impose
  `^[A-Za-z0-9\-_]+$` et rejoue les coups dans le moteur ; `#line=` compare aux
  coups légaux ; `#puzzle=` est limité à `[a-zA-Z0-9]` ; `#train=` est vérifié
  contre `ENDGAMES`. `readCode()` est robuste (regex stricte, CRC, coercition).
  Aucun texte libre d'un tiers n'entre dans le DOM.
- **Couche de stockage** : sonde d'écriture, repli mémoire, bascule au quota.
- **Pool Sprint** : 3 642 exercices, 10 thèmes équilibrés à 400 chacun.
- **Structure des pages** : un seul `h1`, aucun saut de niveau de titre, `lang`
  correct, `hreflang` en/fr/x-default, aucune image sans `alt`, focus visible
  sur 32/32 éléments visibles.
- **Cloudflare RUM** : confirmé désactivé par Alexandre. Attention, sur une
  offre gratuite avec domaine proxifié, l'injection du beacon est active **par
  défaut** depuis septembre 2025 et rend compte à `/cdn-cgi/rum` sur ton propre
  domaine, donc invisible comme requête tierce.

---

## 4. LES NOUVEAUX TESTS

Neuf fichiers, tous avec un commentaire d'en-tête expliquant le défaut qu'ils
gardent et pourquoi il n'avait pas été vu.

| fichier | assertions | garde |
|---|---|---|
| `check_annonces_cases.js` | 12 | nom accessible des 64 cases, région live muette |
| `check_code_progression.js` | 14 | aller-retour du code sur les 10 niveaux |
| `check_points_d_entree.js` | 38 | les identifiants d'entrée existent encore |
| `check_bandes_niveaux.js` | 23 | composition des niveaux, manifestes, ordre |
| `check_service_worker.js` | 13 | cache séparé, plafond, sérialisation |
| `check_avertissement_stockage.js` | 10 | bascule mémoire signalée |
| `check_datation.js` | 9 | registre complet et cohérent |
| `check_csp.js` | 22 | directives figées, empreintes à jour |
| `check_bouton_suivant.js` | 11 | blocage, libération, reblocage |

---

## 5. PIÈGES DE CODE (en plus de ceux des handoffs 1 à 4)

1. **`diff` n'est pas comparable entre familles d'exercices.** Un mat obtient un
   score bas parce qu'il est forçant. Ne retrie jamais toute la banque dessus.
2. **Le champ `level` de `puzzles.json` n'est plus une source de vérité.**
   `build_site.js` le recalcule à chaque construction.
3. **Le découpage des shards doit rester dans l'ordre de difficulté.** Un
   découpage aléatoire obligerait à tout charger.
4. **Ne remets pas `'unsafe-inline'`** pour faire taire une erreur de console :
   c'est le signe qu'un script a changé sans que `poserHachagesCSP()` repasse.
   La bonne réponse est de reconstruire.
5. **N'écris rien d'inutile dans les littéraux de gabarit de `build_site.js`** :
   tout ce qui est entre les accents graves part dans les 466 pages. Un premier
   jet de commentaires avait alourdi le site de 400 Ko.
6. **Le plafond du cache de données a besoin de sa file d'attente.** Sans
   sérialisation il ne plafonne rien.
7. **`check_pied_de_page.js` extrait le texte du pied avec `>([^<>]+)<`.**
   Ajouter un élément en tête de `<footer>` change ce qui est capturé.
8. **Le défilement doux ne s'anime pas en headless.** Les bugs liés au
   `scrollend` ne se reproduisent pas tout seuls, il faut attaquer le chemin de
   code.
9. **`content-dates.json` doit être commité.** Sinon l'historique de
   publication repart à zéro.

---

## 6. RESTE À FAIRE

### Non traité, avec recommandation de NE PAS le faire en l'état

**Trusted Types.** Analyse faite : 54 `innerHTML`, dont 18 affectations de
chaîne vide (autorisées telles quelles), donc **36 puits réels**. Aucun autre
puits dans tout le projet : zéro `outerHTML`, zéro `insertAdjacentHTML`, zéro
`document.write`, zéro `eval`.

Aucun des 36 ne reçoit de PGN, de FEN, de donnée du stockage local ou de
l'URL. Le seul qui concatène une donnée est l'intégration YouTube, alimentée
par `CHANNELS`, une constante du code source.

Les deux façons d'activer `require-trusted-types-for` sont mauvaises ici :
réécrire les 36 puits en construction DOM est un refactoring de plusieurs
heures pour fermer des chemins d'injection qui n'existent pas ; une politique
passe-plat (`createHTML: s => s`) laisse tout passer et mettrait une directive
de sécurité dans l'en-tête sans apporter la moindre protection, ce qui est pire
que rien parce que le prochain audit la lira comme un acquis.

Si le sujet revient, l'ordre utile est : d'abord router les 36 puits par une
fonction unique (point d'audit unique, empêche l'apparition de nouveaux puits),
puis seulement activer la directive avec une politique qui assainit. La
première moitié a de la valeur seule ; la seconde sans la première n'en a
aucune.

### En attente d'arbitrage (hérité du handoff 4, toujours ouvert)

- Route `#fen=` pour débloquer les CTA des 19 pages Apprendre.
- Fil d'Ariane des pages Lexique : « Pin · chess term explained » repris du
  `<title>`. Correct mais long dans un résultat de recherche. Une ligne dans
  `shell()`, touche 466 pages, donc choix éditorial.

### Optionnel

- Message une fois au chargement pour les progressions existantes, expliquant
  que les niveaux ont changé de sens (§2.4).
- Search Console : gratuite, sans code sur le site, et la seule source qui
  dira si le pari des 224 pages désindexées était bon.

---

## 7. AVANT DE POUSSER

1. `content-dates.json` et les 9 nouveaux tests partent avec les sources.
2. La copie GitHub de `chang64-site/` est la baseline de non-régression
   actuelle : **elle sera écrasée**. En garder une copie si tu veux pouvoir
   comparer à l'état pré-session.
3. Vérifier une fois en production que la CSP passe : c'est l'acquis le plus
   fragile de la session. Si le JavaScript ne démarre pas, c'est une empreinte
   qui ne correspond pas, et la réponse est de reconstruire, pas de remettre
   `'unsafe-inline'`.
