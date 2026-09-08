# Session 7 — 7 septembre 2026

Suite du handoff 6. Session longue, mixte : correctifs de bugs signalés en
usage, deux fonctionnalités, une refonte de la progression par motif, et la
préparation d'un lot de minage.

**État de la suite à la fin : 73 fichiers, 0 échec, 1 314 assertions.**
Contre 65 fichiers et 1 016 assertions à l'ouverture. Aucune suite ignorée :
`check_non_regression` et `check_urls_indexees` ont enfin tourné, la baseline
ayant été récupérée depuis le dépôt GitHub.

---

## 0. Ce qu'il faut savoir avant de toucher au code

Trois pièges découverts cette session, tous de la même famille : **une
défaillance qui ne lève aucune erreur et sert autre chose que ce qui est
annoncé**. Ils ont coûté cher à trouver et ils se reproduiront.

**Piège 14 — le repli silencieux de `levelPool()`.** Il retombait sur le lot
entier du niveau quand le filtre ne trouvait rien. Résultat : le site
affichait « Clouage » et servait une prise gagnante. Retiré en mode motif.
Toute fonction de sélection qui « retombe sur quelque chose » plutôt que de
rendre vide doit être regardée avec méfiance.

**Piège 15 — le fourre-tout prioritaire.** `classifyBase` teste la capture
AVANT la géométrie, volontairement (voir §7). Conséquence : 40 % de la banque
porte l'étiquette « Winning capture », et des clouages s'y cachent. Ce n'est
pas un bug, c'est un compromis, mais il faut le connaître avant de conclure
quoi que ce soit sur les volumes par motif.

**Piège 16 — l'index des cases descend depuis la rangée 8.** `b7` vaut 17,
`a8` vaut 0. Un pion **blanc** avance donc en **soustrayant** 16. J'ai écrit
le sens inverse dans un pré-filtre, il a rejeté 96 % des positions valides
sans lever la moindre erreur, et il en paraissait d'autant plus sélectif. La
mesure qui l'a attrapé : passer le filtre sur les exercices qui avaient
réellement produit le motif, et exiger zéro faux négatif. **Tout filtre écrit
pour accélérer doit être validé ainsi avant d'être annoncé.**

---

## 1. Correctifs de bugs signalés en usage

### 1.1 Modale de couleur en plein écran (Inviter)

`#amiColorModal` portait encore `.modal` seule, donc `position:fixed;inset:0`.
Déplacée dans `.board-frame`, elle partage maintenant la géométrie de
`#promoModal`.

Piège 12 rencontré comme prévu : `.board-wrap` est en `display:none` tant
qu'aucune partie ami n'existe, donc la modale seule aurait été invisible.
`apercuPlateauAmi()` dévoile le plateau à l'ouverture et le remasque si on
ferme sans choisir, `majLayoutSolo()` derrière.

Effet de bord non anticipé et traité : le voile plein écran rendait la barre
d'onglets inatteignable. Posée sur le plateau, elle laisse les onglets
cliquables, donc `setMode()` la referme explicitement.

Test : `check_modale_couleur.js`, 19 assertions, vérifie la visibilité
**effective** en remontant les ancêtres jusqu'à `body`.

### 1.2 Fausse panne Stockfish

Symptôme : « Stockfish ne répond plus » sur une partie lancée depuis Analyser.

Cause : `analyseWithStockfish` rejouait la partie depuis `new Game()`, sans
consulter `gameStartFen`. Le premier coup n'existait pas dans la position
standard, la boucle sortait, et la liste vide était lue comme « le moteur n'a
rien renvoyé ». `baseAnalyseGame()` avait le même défaut mais silencieux :
analyse de zéro coup, sans message.

La règle existait déjà dans `rebuildTo()` depuis un bug identique. Elle
n'avait été appliquée qu'à un des trois appels. **Les trois consultent
maintenant `gameStartFen`, et un test compte les occurrences.**

Test : `check_analyse_position_perso.js`, 8 assertions.

### 1.3 Bouton d'installation inversé

Il apparaissait DANS l'application installée sur Windows, et pas dans le
navigateur. Chromium bureau envoie encore `beforeinstallprompt` dans la
fenêtre d'une application installée, alors qu'il ne l'envoie plus dans un
navigateur où l'installation est faite.

`estDejaInstallee()` teste le mode d'affichage réel (`standalone`,
`window-controls-overlay`, `minimal-ui`, `fullscreen`, `navigator.standalone`)
au lieu de se fier à la présence de l'événement. Écoute de `appinstalled`
ajoutée.

### 1.4 Pied de page décentré sur les pages claires

`.footnote` et `.pagedate` héritaient du `p{max-width:66ch}` posé pour la
lisibilité. Boîte d'environ 473 px calée à gauche d'un conteneur de 880 px :
texte centré dans sa boîte, donc décalé d'environ 200 px. Visible seulement
sur écran large. Boîte centrée (`margin-inline:auto`), mesure de lecture
conservée. Le pied de l'application n'a pas ce défaut, il n'y a pas de règle
`p` globale dans `template.html`.

### 1.5 Boutons d'annonces qui semblaient morts

Ils ne l'étaient pas. Le clic passait, la préférence changeait. C'est le
**retour visuel** qui manquait : `#segAnnounce` était passé à `aria-checked`
seul le 6 septembre, pour une bonne raison ARIA, mais le style peignait
l'état retenu avec `[aria-pressed="true"]`.

Le style accepte désormais les deux attributs, sur `.seg`, `.chip` et la
variante désactivée. Les deux autres groupes radio, qui portaient encore le
doublon, en sont débarrassés.

**Test le plus important de la session** :
`check_etat_selection_visible.js`, 24 assertions. Il compare le style
**calculé** du bouton retenu à celui d'un bouton non retenu du même groupe.
Aucune suite ne testait cette jonction : les attributs ARIA d'un côté, le CSS
de l'autre, jamais le lien. C'est le trou par lequel le défaut est passé.

---

## 2. Calendrier des exercices du jour

### 2.1 La case du jour était inerte

Ni `done` ni `missed` (qui exclut explicitement aujourd'hui), donc ni
`data-date`, ni `role`, ni gestionnaire. L'intention d'origine était qu'on y
accède par la carte « Puzzle du jour », mais rien ne le disait. Elle mène
maintenant au même écran via `setMode("puzzles",{screen:"daily"})`. **Pas**
`attemptDailyArchive()`, qui pose `dailyCatchupKey` et sert à cocher un jour
passé.

### 2.2 Cinq états distincts

Distingués par la forme autant que par la couleur (WCAG 1.4.1) : passé non
fait en pointillé sage, passé fait en laiton plein, aujourd'hui à faire sur
fond relevé avec anneau blanc, aujourd'hui fait en laiton avec anneau, futur
effacé.

La série est une **seconde dimension** et non un sixième état : un jour de
série est forcément un jour fait. Halo jade de 2 px, porté à 2 px précisément
parce que la gouttière de la grille fait 3 px, donc les halos voisins se
rejoignent et la série se lit comme une chaîne.

`serieEnCours()` recalcule depuis `prog.dailyLog` et non `prog.days` : le
compteur dit combien, pas lesquels. Elle se termine **hier** tant que
l'exercice du jour n'est pas fait, sinon elle paraîtrait rompue toute la
journée.

Ajouts non demandés mais nécessaires : une légende (dont les pastilles
portent les mêmes classes que les vraies cases, pour ne pas pouvoir se
désynchroniser) et des libellés ARIA explicites.

Test : `check_calendrier_etats.js`, 37 assertions.

---

## 3. Échiquier animé de l'accueil

Partie de l'Opéra (Morphy, Paris 1858), 33 demi-coups jusqu'au mat, validée
contre `engine.js`. Stockée en UCI, **164 octets**. `engine.js` la rejoue à la
volée : rien de précalculé, aucune image. Les cases et pièces réutilisent
`.board`, `.sq`, `.piece`, donc le visuel suit le thème choisi sans une ligne
de CSS en plus. Coût total : 4 Ko sur `index.html`.

Trois garde-fous. `IntersectionObserver` couvre d'un coup les trois cas où
l'animation ne sert à rien (onglet quitté, page défilée, bloc hors écran).
`visibilitychange` pour l'onglet en arrière-plan. `prefers-reduced-motion`
affiche la position finale, immobile — on ne prive pas du visuel, seulement
du mouvement.

**Masqué sous 700 px**, comme la signature de l'en-tête sous 620 px : empilé
sur téléphone en portrait, il repoussait « Jouer maintenant » sous la ligne de
flottaison. `display:none` et non `visibility` : rien à occuper, et un
élément sans boîte ne déclenche jamais l'observateur. Le JS ne construit rien
non plus sous ce seuil, et une rotation en paysage le construit à ce
moment-là.

**Le seuil vit à deux endroits** (media query et `REQUETE_ACCUEIL`). Deux
assertions dans `check_structure_et_stockage` vérifient leur accord — jsdom
n'implémente pas `matchMedia`, le comportement lui-même n'est pas testable là.
`check_mode_affichage.js` le fournit et teste le reste.

Le second plateau a fait tomber quatre assertions dans trois suites, qui
cherchaient `.sq` sans restriction et en trouvaient 128. Tous ces sélecteurs
sont restreints à `#board`.

---

## 4. Pages Apprendre : deux boutons

Les 18 pages n'avaient qu'un bouton « Jouer une partie » pointant sur `/`.

**« Entraîne-toi sur ce motif »** sur les 9 pages dont la banque connaît le
motif → route `#theme=`. **« Explore cette position »** sur les 13 pages dont
la position dit quelque chose → route `#fen=`, ouvre l'exploration libre.

Exclusions délibérées : les 4 pages illustrées par le plateau de départ (un
lien vers la position de départ est un lien vers l'accueil) et celles dont la
position n'a **aucun coup légal** — la page sur l'échec et mat montrait un
mat, où l'exploration est un cul-de-sac. Ce dernier point a été trouvé par le
test, pas par moi.

`ouvrirExploration()` est extrait du gestionnaire de « Analyser cette
position » : la route emprunte le même chemin, sans quoi les deux pièges
documentés dedans (dont `editGame` qui doit être une **copie** et non une
référence) auraient été reproduits à l'identique.

Tests : `check_lien_motif.js` (47) et `check_lien_position.js` (18).

---

## 5. Section « Par motif » — la plus grosse pièce

### 5.1 Ce qui était cassé

Le filtre par motif (menu déroulant dans l'écran des exercices) ne mentait pas
seulement par omission, il **mentait**. Depuis le redécoupage par famille, un
motif tient entièrement dans UN niveau : Pin en 7, Fourchette de cavalier en
6, Mat du couloir en 10. Filtrer sur « Clouage » au niveau 1 revenait à
filtrer un lot qui n'en contient aucun, et `levelPool()` retombait
silencieusement sur le lot entier.

Mesuré : depuis le niveau 1, choisir « Déviation » affichait « Déviation » et
servait une prise gagnante. Pire, le résultat dépendait de ce qui traînait en
cache — même geste, deux résultats selon l'historique de la session.

### 5.2 Ce qui remplace

Sixième carte du menu Résoudre. Un écran de 12 tuiles en deux groupes,
9 motifs tactiques et 3 mats. Un seul exclu, « Winning move » : fourre-tout de
fin de cascade, le nom ne dit rien, et « trouve le coup gagnant » est la
consigne de tous les exercices du site.

**L'échelle est suspendue pendant l'aparté** (`motifEnCours`) : ni montée
après trois réussites, ni descente après quatre erreurs. Le reste continue de
compter. C'est la même famille que le Sprint, les Coordonnées et les Finales :
seule la carte Exercices est branchée sur l'échelle.

Nuance à ne pas perdre : la section **n'évite pas** le gel, elle le rend
explicite. La suspension est attachée à un mode avec entrée et sortie
visibles, au lieu d'un réglage qu'on peut laisser posé sans s'en souvenir.

Le bandeau du motif **prend la place** de l'échelle et de la ligne de niveau.
Les afficher gelées aurait été le même mensonge, déplacé d'un cran.
L'aparté ne survit à aucun changement d'écran.

**Aucun décompte n'est écrit dans le gabarit.** Les nombres viennent de
`theme-counts.json`, et le test vérifie tuile par tuile qu'ils correspondent à
la banque. Une fournée décevante fera baisser l'affichage toute seule : une
fausse promesse est impossible par construction.

Test : `check_entrainement_motif.js`, 26 assertions.

### 5.3 Effets sur les tests existants

`check_exercices_interface` et `check_ordre_exercices` visaient le menu
déroulant : point d'entrée légitimement changé, tests mis à jour.

**Ma première version d'`check_exercices_interface` entrait dans un motif**,
ce qui chargeait les morceaux du niveau 7 et changeait le vivier où puisent
les exercices testés plus bas. Le sprint échouait une fois sur deux. Effet de
bord retiré, stabilité vérifiée sur deux passages. Un test instable est pire
qu'un test qui échoue.

---

## 6. Infrastructure

### 6.1 CSS des pages de contenu jamais minifié

`build_site.js` a `minifyCss()`, appliqué depuis longtemps au `<style>` de
l'application mais **jamais** à celui des pages de contenu : 6,5 Ko de
commentaires par page, 38 % de la feuille, environ 2,9 Mo sur 466 pages.

Trouvé parce que `check_pages_exercices` est passé au rouge. En remontant : le
site publié était à **24 octets** du seuil. Le test allait tomber au prochain
changement, quel qu'il soit.

Moyenne des pages d'exercices : 70,6 → 64,1 Ko. Poids du site : 49,4 → 46,4 Mo
(hors images de partage). Vérifié qu'aucune règle n'est perdue : comparaison
stricte, 97 règles identiques.

### 6.2 Trusted Types, premier volet

Les **56** écritures de HTML (et non 36, le chiffre du handoff avait vieilli)
passent par `poserHtml()`. Fait avec un codemod acorn et non une regex : la
partie droite peut courir sur plusieurs lignes.

Volontairement strict, **pas de `if(el)`** : un élément absent doit lever comme
avant, sinon on transforme une erreur bruyante en panne silencieuse.

**Vérification qui a failli manquer** : `poserHtml` fait deux lignes, terser
aurait pu la dissoudre, et le goulot aurait existé dans la source mais pas
dans le fichier livré — pire que rien. Vérifié sur le build : 57 appels, une
seule écriture directe, celle de la fonction.

La directive `require-trusted-types-for` reste **désactivée** et doit le
rester tant qu'il n'y a rien de mieux à y mettre qu'un passe-plat.

Ajout : `echappe()`, à côté de `poserHtml()`. Il n'existait aucune fonction
d'échappement dans le projet.

### 6.3 Rappels perdus

`loadThemeCounts`, `loadPuzzleIndex` et `loadRushPool` abandonnaient
silencieusement le rappel du deuxième appelant quand une requête était déjà en
vol (`if (PENDING) return`). Invisible tant qu'un seul appelant demandait
chaque fichier. File d'attente ajoutée sur les trois.

### 6.4 Fil d'Ariane

La feuille reprenait le `<title>` entier. Les suffixes mécaniques des trois
sections à gabarit sont retirés (394 pages) ; les titres rédigés d'Apprendre,
Pièges et Finales restent intacts.

Le préfixe de section n'est **jamais** ajouté : le fil porte déjà la section
au deuxième niveau, « Lexique › Lexique · Moulin » serait un doublon.

`check_seo_entete` passe de 37 à 65 assertions. Aucune suite ne testait le fil
d'Ariane, généré depuis le 5 septembre.

### 6.5 Étiquette du log

« Pages de contenu » comptait les URLs versées au sitemap (180), pas les pages
écrites (466). L'écart avait déjà fait croire d'une session à l'autre que le
build avait perdu la moitié de ses pages. Renommé « URLs de contenu ».

### 6.6 Environnement

`cairosvg` est installable (`libcairo2` était déjà là) : les 147 images de
partage sont maintenant converties en PNG. **Le build est livrable.** Chromium
reste non installable.

---

## 7. Minage : le plan et ses chiffres

### 7.1 Le débit réel

**150 000 parties en 48 h**, soit ~3 100 parties/heure. Un million demande
donc treize jours de calcul continu, pas une nuit. J'avais annoncé une nuit en
raisonnant en multiples du corpus sans demander le temps.

### 7.2 Reclassification : mesuré, et moins que prévu

Sur les 25 198 exercices des deux fourre-tout, 6 270 portent une géométrie de
clouage ou d'enfilade. Mais cette géométrie est ignorée **volontairement**
(§Piège 15) : quand la case d'arrivée contenait une pièce, le gain réel est la
capture.

Avec le critère « la géométrie ne compte que si elle rapporte plus que la
pièce prise », et le **roi exclu** (un clouage contre le roi ne rapporte rien
tout de suite — c'est précisément le cas du bug de septembre) :

| Motif | Actuel | Gagné | Après |
|---|---|---|---|
| Clouage | 1 010 | +840 | 1 850 |
| Enfilade | 2 338 | +287 | 2 625 |
| Déviation | 442 | 0 | 442 |
| Fourchette de pion | 519 | 0 | 519 |

**Avant de basculer ces 840, il faut régénérer leur `explain` et ne garder que
ceux dont l'énoncé se tient.** Un motif mal étiqueté produit une phrase
fausse. Le chiffre final sera inférieur à 840.

### 7.3 Pré-filtre géométrique

Ajouté à `mine_puzzles.js` (`--motifs=`), avec `peutDonnerMotif()` exportée.
Condition **nécessaire** et volontairement large : un faux positif ne coûte
qu'une évaluation, un faux négatif perd un exercice pour toujours.

Validé à zéro faux négatif sur 396 fourchettes de pion, 400 fourchettes de
cavalier, 400 attaques doubles, 300 clouages et 300 enfilades — en ne
comparant qu'aux exercices que le classificateur **actuel** confirme.

Rétention mesurée, donc gain de vitesse :

| Motif | Rétention | Gain |
|---|---|---|
| Fourchette de pion | 17 % | ~6× |
| Fourchette de cavalier | 43 % | ~2,3× |
| Attaque double | 95 % | ~1,1× |
| Clouage / Enfilade | 96–99 % | aucun |

**Le gain est de ~6×, pas de 50×** comme annoncé d'abord. Le chiffre initial
venait du filtre cassé (§Piège 16). Nuance dans l'autre sens : la rétention est
mesurée sur les positions de la banque, sélectionnées pour être tactiques ; de
vraies positions en contiendront moins, donc le gain réel sera probablement
meilleur. La première heure le dira.

Ne pas lancer `--motifs=` pour le clouage ou la déviation : à 96–100 % de
rétention on paie un test pour rien.

### 7.4 Ce que le minage ne réglera pas

Coup silencieux (47) et Mat en trois (60) ont besoin de ~10 M parties au
rythme observé. Leur rareté vient de `classifyQuiet`, dont l'heuristique est
volontairement étroite (une seule pièce déviée, pas de surcharge). **Élargir
l'heuristique et remesurer coûte une heure et évitera peut-être deux semaines
de machine.** À faire avant de payer.

---

## 8. Procédure de minage, étape par étape

À lancer sur la machine d'Alexandre. Le bac à sable n'a pas accès à
`database.lichess.org`.

### Étape 0 — préparation

```
cd chang64/src
node run_tests.js          # doit être vert avant de commencer
cp puzzles.json puzzles.avant-minage.json
```

### Étape 1 — passe ciblée « fourchette de pion » (~2 jours pour 1 M)

```
node mine_puzzles.js /chemin/lichess.pgn /tmp/fournee-fourchettes.json 1000000 1800 30 --motifs=Pawn fork,Knight fork
```

Arguments : PGN, sortie, nombre de parties, Elo minimum, facteur de
sur-lecture. `--motifs=` doit être en **dernier**.

**Contrôle après une heure.** Le script écrit sa sortie toutes les 50 parties,
donc on peut la lire sans l'interrompre :

```
node -e "const p=require('/tmp/fournee-fourchettes.json');const c={};for(const x of p)c[x.theme]=(c[x.theme]||0)+1;console.log(p.length,c)"
```

Si le compte de fourchettes ne progresse pas, **arrêter**. Le pré-filtre est
validé mais la rétention sur ton corpus n'est pas mesurée : c'est le seul
chiffre du plan qui repose sur une extrapolation.

### Étape 2 — passe ordinaire (~55 h pour 170 000)

Sans `--motifs=` : à 96–99 % de rétention le filtre ne servirait à rien.

```
node mine_puzzles.js /chemin/lichess.pgn /tmp/fournee-generale.json 170000 1800 30
```

Elle monte le clouage au-dessus de 3 000 et enrichit tout le reste.

### Étape 3 — fusion à blanc

**Toujours `--dry` d'abord.** Rien n'est écrit, mais l'avant/après par motif
est affiché.

```
node merge_puzzles.js /tmp/fournee-fourchettes.json /tmp/fournee-generale.json --dry
```

Lire les rejets. Beaucoup de « déjà dans la banque » est normal si les
extraits se recouvrent. Beaucoup de « vérification échouée » ne l'est pas :
cela signalerait un problème de minage, il faut s'arrêter et regarder.

### Étape 4 — fusion réelle

```
node merge_puzzles.js /tmp/fournee-fourchettes.json /tmp/fournee-generale.json
```

Le script sauvegarde `puzzles.json` horodaté avant d'écrire. Il **ne
régénère jamais les codes existants** : ils sont affichés aux gens (« #TAUXL »,
pour signaler un problème) et quelqu'un a pu en noter un. Il abandonne sans
rien écrire s'il détecte une collision d'identifiant ou de code.

### Étape 5 — reconstruction et vérification

```
node build_site.js
node run_tests.js
```

`build_site.js` redécoupe les morceaux, régénère `theme-counts.json` et
`theme-levels.json` tout seul. La section « Par motif » affichera
automatiquement les nouveaux volumes, sans une ligne à changer.

### En cas de problème

```
cp puzzles.<horodatage>.bak.json puzzles.json
node build_site.js
```

---

## 9. Reste à faire

### À vérifier en navigateur réel (impossible ici)

- Les 5 correctifs de mise en page de la session 6 (2.3 à 2.8), toujours
  ouverts.
- Les états du calendrier : choix des teintes, épaisseur du halo jade.
- Le visuel d'accueil : rythme à 1,1 s, taille à 340 px, glissement à 0,34 s,
  et surtout le paysage sur téléphone (le calcul y est serré) et la
  disparition en portrait.
- La modale de couleur posée sur l'échiquier, dont l'apparition du plateau
  derrière le voile.
- Le pied de page recentré, sur écran large uniquement.
- La section « Par motif » : lisibilité de la grille, du bandeau.

### Décidé, pas commencé

- **Search Console.** Plus rien ne bloque, le site est en ligne. Seule source
  qui dira si le pari des 224 pages en `noindex` était bon.
- **Trusted Types, second volet.** Ne pas activer la directive tant qu'il n'y
  a rien de mieux qu'un passe-plat dans `poserHtml()`.
- **Élargir `classifyQuiet`** avant de payer du minage pour le coup silencieux
  et le mat en trois (§7.4).
- **Contrôler les 840 clouages** de la reclassification et régénérer leur
  `explain` (§7.2).

### Chantiers à part entière

- **Table KPK.** `kpGagnable()` est conservateur, pas exact. Analyse
  rétrograde sur ~393 000 états. Calcul pur, sans risque pour le site.
  Bénéfice modeste : plus de variété dans une seule des cinq finales.
- **Budgets des finales** (45 FC, 26 T, 16 D) : jugement, pas mesure. Attend
  de l'usage réel.

### Abandonné

- **Message sur le changement de sens des niveaux.** Population fermée qui ne
  peut que diminuer (uniquement les progressions enregistrées avant le
  redécoupage). Attendre plus de trafic ne le rendrait pas plus utile.
- **Fusion des onglets Jouer/Inviter.** Le prompt v2 a été passé au code en
  début de session : ses deux raisons ne survivent pas à la mesure. La revue
  de coups existe déjà côté ami via l'historique (`openAmiHistoryGame`), il
  manque un bouton en fin de partie. Et la fusion ne supprime pas le
  débordement de la barre d'onglets : 6 entrées = 431 px, 5 = 371 px, pour
  362 px disponibles à 390 px de viewport. Un padding de 11 à 10 px suffirait.
  `TODO_OPUS_JOUER_INVITER.md` est introuvable, dans le src comme dans le
  dépôt.

---

## 10. Ne pas « corriger » par réflexe

- Le repli de `levelPool()` sur le lot entier **hors** mode motif : c'est le
  comportement voulu pour l'échelle.
- La priorité de la capture sur la géométrie dans `classifyBase` : compromis
  assumé, un énoncé qui parle du cavalier derrière le roi en oubliant la dame
  qu'on vient de prendre est pire.
- `poserHtml()` sans `if(el)` : la sévérité est le but.
- Les décomptes de la section « Par motif » lus dans les données et jamais
  écrits : c'est le garde-fou contre la fausse promesse.
- L'absence de bouton sur certaines pages Apprendre : voulue, pas oubliée.
- Le seuil de 700 px présent à deux endroits : un test garde leur accord,
  ne pas « factoriser » en supprimant l'un des deux.
