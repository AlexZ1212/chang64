# Reprise — chang64.com
Site d'échecs bilingue FR/EN par Alexandre (AlexZ1212), Cloudflare Pages.
Repo : github.com/AlexZ1212/chang64 — sources dans `src/`, site produit dans `chang64-site/`.

## État à la fin de cette session
Reconstruction complète depuis zéro effectuée. **Toutes les suites au vert** :
33 suites de vérification personnalisées + 13 suites d'origine (uitest1-8,
sitetest1-3, banniertest, i18ntest), zéro échec, zéro plantage. Perft 18/18.
Les trois fichiers joints sont à jour et prêts à uploader :
- `chang64-site.zip` — site complet à déployer
- `chang64-sources.zip` — sources (src/)
- `chang64.html` — aperçu autonome du fichier index

## Ce qui a été fait durant cette session (résumé chronologique)
1. Nouveau set de pièces d'échecs dessiné par l'auteur (fichiers SVG fournis),
   intégré au code plutôt que servi en fichiers séparés (0,9 Ko de données,
   plus léger que l'ancien jeu). Œil et naseau du cavalier : remplissage à la
   couleur du contour (#101413), sans contour propre — jamais recolorés.
2. Mode "Au hasard" pour le choix de couleur, tiré à chaque nouvelle partie.
   Le sélecteur affiche toujours le RÉGLAGE choisi (jamais la couleur tirée),
   dans les 3 états : hors partie, pendant, après.
3. Lancement depuis l'accueil ("Jouer maintenant", carte Jouer) : tire la
   couleur au hasard ET bascule colorMode sur "r" (l'accueil ne propose pas
   de choix de couleur, donc rien à respecter). Le choix explicite depuis
   l'onglet Jouer reste toujours prioritaire.
4. Barre d'évaluation : s'inverse selon qu'on joue Blancs ou Noirs.
5. Bouton d'aide des exercices fusionné : "Indice" → clic → "Voir la
   solution" → clic → réponse. Remplace les deux boutons distincts.
6. Réorganisation Exercices/Défis : les finales ont rejoint Exercices (avec
   le filtre par thème), Chang Sprint et Coordonnées sont dans Défis. Les
   deux ("Finales" et "Reprendre sur un autre appareil") sont repliables
   (`<details>` natif) pour réduire la hauteur de page sur mobile.
7. Chang Sprint : déplacé pour se jouer SANS quitter l'onglet Défis (le bloc
   #exPanel est physiquement déplacé dans #rushSlot pendant le sprint, puis
   restitué). Chronomètre remonté au-dessus de l'échiquier (comme les
   coordonnées), avec dixièmes de seconde dans les 10 dernières secondes
   (classe .urgent, texte en rouge). Interface réduite à l'essentiel pendant
   le sprint (classe body.rush-on masque .hors-sprint : pas de "Exercice
   suivant", pas d'Indice, pas de progression par niveau, pas de compteurs
   du mode normal). Une seule épreuve à la fois : lancer un sprint arrête les
   coordonnées en cours et vice-versa (sinon les deux tournaient en même
   temps en arrière-plan).
8. Overlay "Quand tu veux" généralisé (showReadyFor) : sert aux parties, à
   Chang Sprint et aux coordonnées. Bandeau de fin généralisé (showFin) :
   sert aux mêmes trois cas, avec "Rejouer"/"Fermer".
9. Animation des pièces au déplacement (glissement CSS), activée par défaut,
   réglage dans préférences (section "Couleurs de l'échiquier", PAS dans
   Accessibilité — c'est un réglage de confort visuel). Respecte
   prefers-reduced-motion. Reprend l'animation si un rendu survient pendant
   qu'elle tourne (ex: sélectionner une pièce n'interrompt plus l'animation
   en cours).
10. Pièces capturées à côté des pendules : recadrées sur leur vraie boîte
    englobante (calculée avec svg-path-bbox, PIECE_BB dans pieces_browser.js
    et ds/pieces.json), sans fond ni contour, alignées à gauche sur le nom
    du joueur. Pendule restructurée en 2 lignes (.clock-line pour nom+heure,
    .taken-slot en dessous) pour que le nom ne bouge jamais qu'il y ait des
    prises ou non.
11. Tous les boutons qui changent de vue (setMode) vérifiés pour appeler
    goTop() — deux oublis corrigés (heroPlay, tab-train).
12. SEO/sécurité : canonical + hreflang + favicon sur l'accueil (manquaient),
    meta description raccourcie (174→133 car.), redirection /fr passée de
    302 à 301, HSTS + CSP ajoutés (avec vérification que CSP autorise bien
    tout ce qui est réellement chargé : polices, YouTube, Worker Stockfish).
    Chargement des polices Google rendu non-bloquant (preload + promotion).
13. Accessibilité : landmarks <main>/<nav> + lien d'évitement "Skip to main
    content" ajoutés à l'application (absents auparavant).
14. Contraste : vert pâle #93A99A du thème sombre (1,98:1) remplacé par
    var(--sage) sur les pages claires (4,63:1+). Tailles de police <12px
    relevées à 12,5px pour les VRAIS textes à lire (notes, pied de page,
    descriptions), mais PAS pour les repères courts (coordonnées échiquier,
    numéros de coups) qui n'ont pas besoin d'être lus.
15. Menu des pages claires (fond clair) harmonisé avec l'application : même
    forme de pastille pour les onglets et le sélecteur de langue EN|FR
    (positionné à l'opposé du logo, juste après lui dans l'ordre DOM), menu
    en défilement horizontal (flex:1 1 100%, pas "auto"). Logo avec baseline
    identique à l'application (élan/laiton + nom/gris foncé).
16. Verdict d'analyse : "2,8 pawns lost" → "2,8 advantage lost" (le pion est
    une vraie unité aux échecs mais "pawns lost" prêtait à confusion avec du
    matériel perdu). Virgule décimale en français (fmtNum).
17. Nettoyage : identifiants HTML morts retirés, entrées i18n mortes
    retirées (Take back, Enable Stockfish, ancien texte du sprint),
    gestionnaire de clic orphelin retiré (btnUndo).

## Pièges connus, à ne JAMAIS reproduire
1. **Zone morte JS (let/const)** : ne jamais référencer une variable déclarée
   plus loin dans le MÊME fichier avant sa déclaration — provoque une erreur
   silencieuse qui interrompt toute la fonction appelante (`typeof x` la
   masque). Rencontré au moins 3 fois cette session (lastAnimated, rush
   depuis ui.js déclaré dans ui2.js chargé après, hintShown).
   → Toujours déclarer les variables d'état en tête de fichier.
2. **onSquare est redéfini dans ui3.js** (const baseOnSquare=onSquare;
   onSquare=function...). Toute logique de clic sur l'échiquier doit être
   vérifiée dans LES DEUX fichiers, pas seulement ui.js. C'est ce qui a
   cassé Chang Sprint après son déplacement dans Défis (mode==="train" était
   intercepté par ui3.js et envoyé vers handleTrainClick au lieu de
   handlePuzzleClick).
3. **[hidden] vs display:block** : un élément avec `hidden` reste visible si
   une classe CSS lui donne `display:block/flex/grid` explicite (la règle
   par défaut du navigateur [hidden]{display:none} est plus faible que
   n'importe quel sélecteur de classe). Toujours vérifier le style CALCULÉ
   (getComputedStyle) et pas seulement l'attribut/la classe posée.
4. **Spécificité CSS avec sélecteurs partagés** : `.clock .who i` visait la
   pastille de couleur MAIS s'appliquait aussi aux pièces capturées (autres
   `<i>` dans le même conteneur), qui héritaient fond/contour/taille sans
   le vouloir. Préférer les sélecteurs d'enfant direct (`.clock .who>i`) ou
   des classes dédiées plutôt que des sélecteurs de type génériques.
5. **jsdom ne calcule pas offsetLeft/getBoundingClientRect** (renvoie 0) :
   pour toute animation ou mesure de position en test, calculer en unités
   logiques (index de case, %) plutôt qu'en pixels réels.
6. **Le tirage au sort dans heroPlay/cardPlay** rend les anciens tests
   instables s'ils supposaient jouer les Blancs sans le vérifier — toujours
   fixer explicitement la couleur via l'onglet Jouer dans les tests qui
   dépendent de savoir qui ouvre.

## Sujets mis de côté, à reprendre quand demandé
- **Claude Cowork** pour automatiser l'upload/référencement
- **Nouvelle fonctionnalité pour Chang Sprint** : le point qui restait ouvert
  à la fin de cette session — retirer les intitulés inutiles ("MAT EN UN
  COUP", l'énoncé complet type "Les Noirs jouent et matent en 1 coup.", le
  message de progression "Trois de suite. Tu passes au niveau 2") puisque
  c'est un défi et pas un entraînement progressif ; bouton "Chang Sprint" →
  "Abandonner le Chang Sprint" avec les mêmes codes visuels que "Abandonner
  la partie" ; retirer la notion de niveau (c'est juste un défi de 3 min) ;
  ⚠️ COMMENCÉ mais pas terminé — startRush() a déjà été modifié pour varier
  les thèmes plutôt que suivre un ordre par niveau (voir commentaire dans
  ui2.js function startRush), mais les 3 autres points restent à faire.
- **Chess960** : problème d'encodage du roque roi-prend-tour, perft comme
  garde-fou
- **Sauvegarde de la partie en cours** pour survivre à un rechargement
  accidentel (actuellement, recharger perd la partie ; seule la progression/
  historique des parties terminées est sauvegardée)
- **Style du menu sur fond clair** : Alexandre a dit "pas un problème pour
  l'instant" mais veut y revenir — les pages de contenu et l'application ont
  des codes visuels légèrement différents (pages = éditorial, app = outil)

## À vérifier après le prochain déploiement (déjà dans le README des sources)
**PageSpeed Insights, en priorité** : le chargement des polices a été rendu
non-bloquant. Avant modification, PageSpeed donnait Performances 98/85
(bureau/mobile), CLS 0,001/0,009. Comparer DEUX métriques après déploiement :
1. Performances doit monter sur mobile (1480ms de blocage de rendu estimés
   récupérables par Lighthouse)
2. CLS ne doit pas se dégrader nettement (le texte s'affiche d'abord en
   police système avant de basculer). Si CLS > 0,1, revenir en arrière —
   chercher `rel="stylesheet"` sur fonts.googleapis dans l'historique Git.

## Méthodologie d'upload (inchangée)
```
cd "C:\Users\Alexandre Callot\Desktop\Chang64"
rmdir /s /q chang64-site
rmdir /s /q src
```
Copier les deux dossiers depuis les archives, puis :
```
git config user.name        (vérifier AlexZ1212)
git add -A
git status --short | find /c "D "     (doit donner un nombre proche de 94)
git commit -m "..."
git push origin main
```

## Check-list de vérification post-déploiement (points clés de CETTE session)
1. Nouvelles pièces partout, cavalier net (œil/naseau) sur blancs et noirs
2. Pièces noires lisibles sur case sombre (contraste le plus serré)
3. Animation des pièces au déplacement, dans tous les modes ; réglage dans
   préférences AVEC les couleurs de l'échiquier (pas dans Accessibilité)
4. Sélecteur de couleur Blancs/Noirs/Au hasard : le réglage choisi reste
   affiché et grisé pendant la partie, dans les 3 cas identiquement
5. Depuis l'accueil : la couleur varie à chaque lancement, "Au hasard" est
   affiché comme sélectionné
6. Pendule active : fond qui s'ÉCLAIRCIT (pas noircit)
7. Pièces capturées à côté des pendules : sans fond ni contour, alignées sur
   le nom, qui ne bouge pas selon qu'il y a des prises ou non
8. Barre d'éval s'inverse en jouant les Noirs
9. Onglet Exercices : Finales repliées (titre cliquable), pas de niveau/
   thème qui ne s'applique pas
10. Onglet Défis : Chang Sprint (chrono au-dessus de l'échiquier, dixièmes
    dans les 10 dernières secondes, chiffre rouge), Coordonnées
11. Lancer un sprint puis basculer sur Coordonnées (ou l'inverse) : la
    première épreuve doit s'arrêter proprement, pas tourner en fond
12. Fin d'un sprint/coordonnées : bandeau avec score, Rejouer/Fermer
13. Tous les boutons qui changent de section remontent en haut de page
14. Pages claires : menu en pastille, EN|FR à l'opposé du logo, recherche
    fonctionnelle sur /fr/ouvertures/ et /fr/exercices/
15. PageSpeed : voir section dédiée ci-dessus
16. Lien d'évitement au clavier (Tab dès l'arrivée sur le site)
17. Favicon visible dans l'onglet du navigateur
