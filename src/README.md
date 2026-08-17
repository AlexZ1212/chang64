# chang64 — sources

## Construire le site
    node build_site.js
Sort dans ./site/ (et site-index.html autonome, a cote des sources).

Prerequis :
- Node.js
- Python 3 avec cairosvg : `pip install cairosvg` (conversion des images de partage)
- Stockfish dans sf/package/ (voir "Non inclus" plus bas)

Tous les chemins sont relatifs au dossier des sources : le script peut etre
lance depuis n'importe ou.

## Fichiers
- `build_site.js` — générateur principal : assemble l'application, génère les 141 pages d'ouvertures x2 langues, le sitemap, robots.txt, manifest, service worker, icônes, _headers, _redirects. Copie Stockfish et les fichiers de licence.
- `og_render.py` — convertit les 147 images de partage de SVG en PNG 1200x630, puis supprime les SVG. Appelé automatiquement par build_site.js. Sans lui, les balises og:image pointent vers des PNG inexistants et les vignettes de partage restent vides.
- `licence/` — COPYING.CONTENT et README.md, copiés à la racine du site à chaque construction.
- `ds/` — pieces.json et mark-on-dark.svg, issus du design system (dossier design-system/ du dépôt).
- `content.js` — génère les 1066 pages de contenu : règles (8), lexique (20), finales (5), pièges (6), exercices (489), page profil. Bilingue.
- `template.html` — coquille HTML + CSS. Contient les marqueurs /*__I18N__*/ /*__ENGINE__*/ /*__PIECES__*/ /*__UI__*/ /*__UI2__*/ /*__UI3__*/ remplacés à la construction.
- `engine.js` — moteur d'échecs (module Node, utilisé par les tests et la génération).
- `engine_browser.js` — même moteur, version navigateur.
- `pieces_browser.js` / `pieces.js` — SVG des pièces.
- `ui.js` — partie contre le bot, exercices, entre amis, code de reprise, horloges.
- `ui2.js` — ouvertures, navigation dans la partie, analyse, PGN, Puzzle Rush, classement, série, YouTube, mentions légales, bannière de résultat.
- `ui3.js` — finales, coordonnées, glisser-déposer, Stockfish, installation PWA, bascule de langue, préférences (thèmes d'échiquier, annonces lecteur d'écran, navigation clavier).
- `i18n.js` — moteur de traduction + dictionnaire français (~280 entrées).
- `puzzles.json` — 489 exercices vérifiés. `themes.json` — traduction des thèmes. `openings.json` — 1758 lignes d'ouvertures (source : lichess-org/chess-openings).

## Tests
    node uitest6.js   # partie, exercices, amis
    node uitest7.js   # analyse, PGN, rush, vidéos, mentions légales
    node uitest8.js   # finales, coordonnées, glisser-déposer, Stockfish
    node i18ntest.js  # traduction complète
    node evaltest.js  # option barre d'avantage
    node banniertest.js # calque de fin de partie
    node sitetest2.js # audit des pages d'ouvertures
    node sitetest3.js # audit des 1066 pages de contenu
Nécessite `npm install jsdom`.

## Non inclus
Stockfish 18 (7 Mo, GPL v3) : `npm pack stockfish@18.0.8`, puis copier
package/bin/stockfish-18-lite-single.{js,wasm} et package/Copying.txt
dans sf/package/ avant de lancer build_site.js.

## Licence
Le code est publié sous GPL v3 (décision prise : distribuer Stockfish l'impose).
Le générateur écrit LICENSE, COPYING.CONTENT et README.md à la racine du site
à chaque construction : ne pas les poser à la main dans site/, le rmSync du
début les effacerait.

## Cache du service worker
La version du cache est calculée automatiquement à partir de la date de
construction (constante SW_VERSION). Chaque build invalide donc le cache des
visiteurs. Ne jamais figer cette valeur : un cache non versionné laisse les
visiteurs sur l'ancienne version indéfiniment.

## Notes
- chang64.com est codé en dur dans build_site.js (constante SITE).
- Mentions légales : champs éditeur dans ui2.js (PUBLISHER, HOST, REGISTRAR).
- Pas de .htaccess : le site est sur Cloudflare Pages, qui ne le lit pas.

## Stockage
`window.storage` n'existe pas dans un navigateur : c'est l'API de
l'environnement dans lequel le prototype a été construit. Un shim en tête de
`ui.js` la réimplémente sur localStorage, avec repli en mémoire. Sans lui,
progression, historique et parties entre amis ne sont jamais enregistrés, et
l'échec est silencieux (try/catch vides). Ne pas le retirer.

## Livre d'ouvertures
Servi à part dans `openings-book.json` et chargé à la demande (94 Ko retirés
de index.html). `detectOpening` renvoie null tant qu'il n'est pas arrivé ;
`renderOpening` et `renderHistory` sont rappelés au chargement.

## Accessibilité
- Tabindex roulant sur l'échiquier : une seule case atteignable au Tab, posé
  dans `buildBoard` (ui.js). Ne pas y appeler de variable déclarée en `let`
  dans ui3.js : zone morte temporelle, l'exception casse l'initialisation.
- Annonces lecteur d'écran désactivées par défaut, trois niveaux, zone
  `#srAnnounce` en aria-live polite. Ne jamais la passer en display:none.

## Noms français des ouvertures
Les 141 familles ont un nom français dans `FAMILY_FR` (build_site.js).
Règle : forme française établie quand elle existe, sinon traduction
littérale, et nom propre anglais conservé pour les ouvertures fantaisistes
sans équivalent (Fried Fox, Bongcloud, Lemming, Creepy Crawly).
La notation des coups reste internationale (Bf5, pas Ff5) dans les noms,
pour coller aux listes de coups affichées sur la même page.

ATTENTION : changer un nom français change l'URL de la page. Le générateur
émet automatiquement une 301 de `/fr/ouvertures/{slugEn}.html` vers le slug
français, ce qui couvre les anciennes URL indexées. Si tu renommes une page
déjà traduite, ajoute la redirection de l'ancien slug français à la main.

## Tests connus en échec
`uitest8.js` échoue sur l'entraîneur de coordonnées (`coordTime` absent après
clic sur `btnCoord`). Vérifié : le site déployé se comporte à l'identique, ce
n'est donc pas une régression. À diagnostiquer.

`uitest7.js` a été adapté : il fournit un `fetch` qui sert les fichiers depuis
`site/`, sans quoi le livre d'ouvertures chargé à la demande ne peut pas
arriver et la détection échoue sur un faux négatif.

## Référence légale LCEN
Les mentions légales citent l'**article 1-1, II** de la LCEN, pas l'article 6.
Depuis la loi SREN (21 mai 2024), l'obligation d'identification de l'éditeur
non professionnel a été déplacée. Beaucoup de générateurs de mentions légales
n'ont jamais été mis à jour ; ne pas refaire l'erreur si ce texte est retouché.
`tests/check_traductions.js` vérifie les deux langues en basculant réellement
l'interface, pas seulement en cherchant la chaîne dans le code source.

## Notation
Le site utilise partout la notation internationale (Nc3, Bb4, Qd2, Rae1, Kg1),
y compris dans les textes français. La leçon française sur la notation
l'enseigne explicitement et signale que les livres en français emploient
encore C, F, T, D, R. Ne pas réintroduire de coups en notation française
dans les descriptions.

## Échiquier animé des pages d'ouverture
`animBoard()` produit une position par demi-coup de la ligne principale.
Les 12 formes de pièces sont déclarées une fois dans `<defs>` et chaque
position n'est qu'une série de `<use>` : environ 1,5 Ko par position au lieu
de 19 Ko. Coût réel mesuré : +3,8 Ko par page en moyenne.

Deux pièges rencontrés, à ne pas réintroduire :
- `.hidden` est une propriété de HTMLElement, pas de SVGElement. Sur un `<g>`
  il faut `setAttribute("hidden","")`, sinon rien ne se passe.
- L'attribut `hidden` sur un élément SVG dépend de la feuille du navigateur :
  la règle `.anim g[data-ply][hidden]{display:none}` l'impose explicitement.

Sans JavaScript, seule la position finale est visible et les commandes sont
masquées : le comportement d'origine est préservé. `prefers-reduced-motion`
désactive la lecture automatique.

## Vocabulaire français
Termes consacrés, ne pas revenir en arrière :
- Classical → **Classique** (et non "Longue")
- Daily → **Correspondance** (et non "Par jour"), cohérent avec le texte
  d'accueil qui parle de jeu par correspondance
- Le mode chronométré s'appelle **Chang Sprint** (voir plus bas)

Le tutoiement est de rigueur dans les 363 chaînes. Pas de tiret cadratin.
Espace avant la ponctuation double. Apostrophes droites, uniformément.

`tests/check_traductions.js` bascule l'interface en français, parcourt tous
les écrans et signale tout texte non traduit. Une clé manquante ne provoque
aucune erreur : elle s'affiche simplement en anglais, et c'est ainsi que le
message sur Stockfish est resté non traduit et que "Niveau 1 of 5" a survécu.
Le mot "of" n'était pas collecté car le collecteur exige trois lettres
alphabétiques minimum : il est posé à la main dans ui.js.

## Chiffres annoncés au public
Le nombre d'exercices, de familles d'ouvertures et de lignes nommées est
injecté à la construction via les jetons `__NP__`, `__NF__`, `__NL__`.
Ne jamais réécrire une quantité en dur : elle était figée à onze endroits
(accueil, meta description, image de partage, données structurées, tuiles de
navigation, dans les deux langues) et est restée bloquée sur 489 alors que la
banque en comptait 777.

`__NF__` et `__NL__` ne peuvent être substitués qu'au moment de l'écriture de
`index.html`, car ils dépendent du livre d'ouvertures chargé plus tard.

`tests/check_chiffres_annonces.js` compare chaque nombre affiché aux données
réelles et refuse tout jeton non substitué.

## Exercices
777 exercices. Les 288 derniers ont été produits par `gen_puzzles.js` puis
vérifiés indépendamment à profondeur supérieure : 12 des 300 générés ont été
écartés (4 %), pour solution non unique ou coup qui n'était pas le meilleur.

Le générateur retient une position seulement si un seul coup atteint le
meilleur score et si l'écart avec le deuxième dépasse 200 centièmes de pion.
Le motif est identifié à partir de la position, pas deviné : fourchette,
clouage, enfilade, mat du couloir, mat étouffé.

Production par lots : `node gen_puzzles.js <total> <fichier> <secondes>`
accumule dans le même fichier sans jamais produire de doublon.

## Moteur : optimisations et impasse

**Hachage de Zobrist** (`ZOB`, `computeKey`). L'ancienne clé de position
reconstruisait une chaîne FEN complète à chaque coup, deux fois même (une pour
l'historique, une pour le compteur de répétitions), et s'en servait comme clé
dans une table de hachage. C'était le principal coût de la recherche.
Ne jamais revenir à une clé textuelle.

**Table de transposition** (`TT_SIZE` et suivants). Elle mémorise les positions
déjà évaluées. Attention au type de borne (`TT_EXACT`, `TT_LOWER`, `TT_UPPER`) :
alpha-bêta ne produit pas toujours un score exact, et réutiliser une borne comme
un score fausserait la recherche.

Effet cumulé, mesuré sur les mêmes positions :

| Profondeur | Origine | Maintenant |
|---|---|---|
| 3 | 852 ms | 186 ms |
| 4 | 3 743 ms | 600 ms |
| 5 | ~31 000 ms | 2 403 ms |

À chaque étape, vérifié que le moteur choisit exactement les mêmes coups
qu'avant (20 à 25 positions) et que le perft passe.

**Niveaux du bot.** Coriace est passé en profondeur 5 avec 2 s de budget.
Avant optimisation il était réglé sur profondeur 4 avec 1,5 s, alors qu'il lui
en fallait 3,7 : il était coupé en cours de route et jouait comme le niveau 3,
ce qui explique qu'il ne le battait pas. Mesure après correction : profondeur 5
bat profondeur 4 par 5,5 à 2,5.

**Calibrage Elo** (`elo_calibrate.js`, tournoi par lots). Ancrage conventionnel
sur un joueur aléatoire à 400. Estimation régularisée : sans cela, un joueur
qui ne perd jamais fait diverger le calcul vers l'infini (une première version
annonçait 4325 Elo pour une recherche à profondeur 3).

**Évaluation enrichie : tentée, mesurée, abandonnée.** Mobilité, pions passés
et isolés, paire de fous, abri du roi. Résultat sur 20 parties : 9,5/20, soit
-17 Elo, intervalle de confiance de -185 à +142. Aucun gain démontrable.
Cause probable : coefficients posés à l'estime. Une évaluation ne vaut que par
l'équilibre entre ses termes, et cet équilibre se règle par des milliers de
parties automatiques, pas au jugé. Ne pas refaire cette tentative sans moyen
de calibrer les coefficients.

Piège méthodologique rencontré : après 8 parties, la version enrichie menait
5-3, ce qui aurait donné +89 Elo. C'était du bruit. Ne jamais conclure sur un
échantillon aussi petit.

## Perft
`node perft.js [profondeur]` valide le générateur de coups sur six positions
de référence publiées (dont Kiwipete). À lancer avant et après toute
modification touchant aux coups, au roque ou à la prise en passant.

## Diagrammes
`boardSvg` déclare les formes en `<defs>` et pose les pièces par `<use>`.
Avant, chaque pièce répétait ses chemins complets : 19 Ko par diagramme, soit
40 Mo pour les seules pages d'exercices. Ne pas revenir en arrière.

## Lancer les vérifications
    node build_site.js
    node run_tests.js

Facultatif, pour la suite de non-régression :

    CHANG64_BASELINE=/chemin/vers/le/site/publie node run_tests.js

Elle compare alors le site généré à celui déjà en ligne et signale toute page
qui disparaîtrait sans redirection. Sans cette variable, elle est ignorée.

`run_tests.js` regroupe 25 suites : les 12 vérifications dans `tests/` et les
13 suites d'origine. Cinq d'entre elles écrivent en clair plutôt qu'en
"ok"/"FAIL" : pour celles-là le lanceur exige la ligne finale sur les erreurs
JS, sans quoi il les signale comme MUETTE. Sans ce garde-fou une suite qui ne
teste plus rien passerait pour un succès, ce qui s'est produit pendant des
mois.

Voir aussi `perft.js`, à lancer après toute modification du moteur.

## Tests : comment les lancer
Les huit suites d'interface exigent DEUX gestes avant de cliquer sur
l'échiquier : ouvrir l'onglet (`tab-play`, `tab-puzzles`, `tab-friend`) puis
démarrer la partie (`btnNew`). `onSquare` ignore tout clic tant que le mode
n'est pas le bon, et l'échiquier reste vide tant que la partie n'a pas
démarré. Cinq suites sur huit ne testaient plus rien depuis longtemps faute de
ces deux gestes, et échouaient de façon silencieuse.

Identifiants qui ont changé et qu'il ne faut plus chercher :
`tab-ex` est devenu `tab-puzzles` ; `coordTime`, `coordTarget`, `coordScore`
et `coordMiss` sont devenus `chudTime`, `chudSquare`, `chudScore`, `chudMiss`
dans `coordHud`.

`isFlipped()` lit les repères de colonnes : inutilisable pendant
l'entraînement aux coordonnées, qui les masque volontairement.

## Tests : ne pas figer les compteurs
Plusieurs tests codaient en dur le nombre de pages et d'URL du sitemap, ce qui
les condamnait à échouer à chaque ajout de contenu. Ils vérifient désormais la
propriété qui compte : que le sitemap couvre toutes les pages publiées.

## À vérifier après le prochain déploiement

### PageSpeed Insights, à relancer en priorité
Le chargement des polices a été rendu non bloquant (preload puis promotion en
feuille de style). Avant cette modification, PageSpeed donnait :

| | Bureau | Mobile |
|---|---|---|
| Performances | 98 | 85 |
| First Contentful Paint | 0,9 s | 3,3 s |
| Cumulative Layout Shift | 0,001 | 0,009 |

Relancer https://pagespeed.web.dev sur chang64.com, en mobile ET en bureau, et
comparer **deux** chiffres :

1. **Performances** doit monter sur mobile. Lighthouse estimait 1 480 ms
   récupérables sur le blocage du rendu.
2. **Cumulative Layout Shift** ne doit pas se dégrader nettement. Le texte
   s'affiche désormais d'abord en police système puis bascule, ce qui peut
   décaler la mise en page.

Si le CLS se dégrade franchement (au-delà de 0,1), revenir en arrière : le gain
de vitesse ne vaudrait pas la perte de stabilité. La version précédente du bloc
est dans l'historique Git, cherchez `rel="stylesheet"` sur fonts.googleapis.

Deux remarques de ces audits sont déjà traitées et n'ont pas à être reprises :
le repère principal manquant (landmarks `<main>` et `<nav>` posés) et la
meta description trop longue (ramenée de 174 à 133 caractères).
Deux points que je n'ai pas pu trancher sans moteur de rendu (les tests
simulent le DOM mais ne calculent pas les dimensions) :

1. **Débordement horizontal sur mobile.** Une capture de la version en ligne
   montrait l'échiquier et la pendule coupés à droite, colonne h hors écran.
   Aucune largeur du code ne l'explique. Des plafonds explicites ont été posés
   (`max-width:100%` et `box-sizing:border-box` sur `.board-frame`, `.board`
   et `.clock`), mais c'est un traitement du symptôme, pas de la cause.
   À retester ; si ça persiste, demander une capture en paysage ou sur une
   autre largeur pour cerner le seuil.

2. **"Exercice suivant" atteignable sans défiler.** Les trois actions
   fréquentes ont été remontées sous l'énoncé et les marges compactées sous
   520 px, soit environ 220 px gagnés. Mon estimation dit qu'il pourrait
   manquer une trentaine de pixels sur un écran de 390 x 844, mais l'écart est
   dans la marge d'erreur du calcul. Si le défilement persiste, la piste
   suivante est de plafonner légèrement la hauteur de l'échiquier sur
   téléphone (à ne faire que si nécessaire : cela réduit la surface de jeu).

## Recherche sur les pages d'index
Les index des ouvertures (141 entrées) et des exercices (777) portent un champ
de filtrage. Il cherche sur le nom dans les deux langues, les coups, le code
ECO, le thème, le niveau et le numéro, sans tenir compte des accents.

Deux règles à ne pas casser :
1. Le champ est masqué par défaut et révélé par le script. Sans JavaScript la
   page reste ce qu'elle était : personne ne voit un champ inerte.
2. Le script n'est émis que sur les pages qui portent `id="grille"`. Émis
   partout, il ajoutait 3 Mo de code inutile sur 1 929 pages pour 4 qui s'en
   servent.

Sur les exercices, groupés par thème, le filtrage masque aussi les sections
devenues vides et le sommaire, sinon la page se remplit de titres suivis de
rien.

## Chapô et description : deux textes distincts
La balise meta description sert le référencement, le chapô sert le lecteur.
Les confondre a produit des doublons sur 334 pages : lexique (définition
affichée deux fois), pièges (chapô = 280 premiers caractères du corps),
ouvertures (chapô = note reprise dans le corps). `tests/check_textes_dupliques.js`
contrôle les 1 901 pages.

## Reste à faire
- Enregistrements Zimbra (MX, SRV, SPF, DKIM) chez OVH.
- Identité réelle à communiquer à l'hébergeur au titre de la LCEN.
- Calibrage Elo du bot : `elo_calibrate.js` est écrit et corrigé (parties
  bornées à 140 demi-coups, arbitrage au matériel) mais n'a jamais tourné
  jusqu'au bout. Les écarts entre niveaux seront mesurés, l'ancrage absolu
  restera une convention faute de référence externe.
- Chess960 : non commencé. Difficulté identifiée, le roi peut atteindre g1
  par un coup normal ET par le roque, alors que l'application identifie les
  coups par départ et arrivée partout. Il faudra encoder le roque comme
  "le roi prend sa tour" et adapter toutes les recherches de coups.
