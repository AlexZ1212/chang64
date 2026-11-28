# Phase 2 : préparation (avant le SHA final du lot)

Préparé le 28/11 en attendant le SHA final de `claude/correctifs-27-11-972f58` (consigne de la session principale : choix (a), ouvrir la branche sur ce SHA, ne rien commiter sur une autre base). Les numéros de ligne sont relevés sur 7ad3be8b : **à revérifier sur le SHA final**.

## 1. Contrainte de poids : le script principal est plein

Le plus gros `<script>` de la page fait **597 835 caractères** (build du 28/11, 10 h 02) pour un garde-fou à 600 000 (`tests/check_poids_script.js`, même seuil dans `check_sante_du_site`). Il reste environ 2 000 caractères : pas assez pour le volet, les tables et les branchements des neuf pistes.

Décision technique (pas une question pour Alexandre, qui a déjà choisi d'alléger plutôt que de relever le seuil le 23/11) : tout le code des liens va dans **un fichier à part, `src/lecons.js`**, sur le modèle de `makruk.js` :

- construit et minifié par `build_site.js` vers `site/lecons.js`, adresse avec empreinte `?v=<sha1 10>` ;
- appelé par une balise `<script src="/lecons.js?v=__LECONS_V__" defer></script>` en fin de `template.html` (la CSP `script-src 'self'` l'autorise ; rien de plus dans le script principal) ;
- `_headers` : même bloc que `/makruk.js` (text/javascript, immutable) ;
- exécuté après le script principal : il enveloppe les fonctions globales (`finishPuzzle`, `coachAfficher`, `renderResult`, `renderMistakeQueue`, `bxFiche`/`bxPoserLien`, `leconFinRendre`, `renderOpening`), comme le font déjà coach.js et navigation.js ;
- s'il ne se charge pas (hors ligne à la première visite), aucun lien n'apparaît, rien ne casse.

Tests : jsdom (`tests/outils/page_langue.js`) ne charge pas les scripts externes. Les nouveaux tests évaluent `site/lecons.js` dans la fenêtre après l'ouverture (`w.eval(fs.readFileSync(...))`) ; les anciens tests ne le voient pas, donc pas de régression possible de leur côté. Un test vérifie que la balise est dans les 10 pages et que le fichier existe.

## 2. Données : `data/lecons-<langue>.json`

Écrites par `content.js` à côté de `data/fiches-<langue>.json` (même endroit, `content.js` vers la ligne 550), chargées au premier volet déplié seulement (cache d'abord par le service worker : un fichier corrigé n'arrive qu'avec le changement de nom du cache à la publication).

```json
{
  "l": {                      // leçons du site, clé = slug anglais
    "knight-fork": { "t": "La fourchette de cavalier", "p": "<premier paragraphe, HTML de la page>", "f": "<fen du diagramme>", "u": "/fr/apprendre/la-fourchette-de-cavalier", "m": "Knight fork" }
  },
  "g": {                      // mots du lexique utiles aux pistes, clé = slug anglais
    "blunder": { "t": "Gaffe", "p": "<définition>", "u": "/fr/lexique/gaffe" }
  }
}
```

Leçons : les 9 de motifs + check-checkmate-stalemate, how-games-are-drawn, pawn-promotion, opening-principles. Lexique : blunder, mistake, inaccuracy, elo-rating, stalemate, hanging-piece, fork, pin. `m` : le motif de Résoudre (table `THEME_DE_LA_PAGE`, `content.js:467`), si la page en a un et qu'il passe le seuil de 50 exercices (`themeEntrainable`).

Diagramme du volet : dessiné dans la page à partir de la fen avec `pieceSVG` (`pieces_browser.js:22`), 8 × 8 cases aux couleurs du damier choisi. Aucun SVG dans le JSON (le fichier resterait léger).

## 3. Le volet (commun à toutes les pistes)

`leconVolet(cle, parent, options)` dans lecons.js :

- une ligne-bouton `Pour comprendre : <titre> ▸` (`aria-expanded`), classe `hors-sprint` pour suivre la règle existante ;
- au toucher : charge le JSON si besoin, déplie dessous un bloc (pas de fenêtre) : diagramme 96 px à gauche, paragraphe à droite (dessous à 360 px si ça ne tient pas), puis `Lire la leçon en entier` (lien vers la page) et, si `m`, `M'entraîner sur ce motif` (`applyDeepLink({kind:"theme",name:m})`, déjà utilisé par `btnLeconTheme`) ;
- un second toucher replie ; le bloc se vide quand l'écran change (exercice suivant, nouvelle partie) ;
- texte français passé par `lier()`/`insecablesFr()` (ponctuation insécable).

## 4. Points d'insertion (7ad3be8b)

| Piste | Fichier, fonction, ligne | Ce qu'on accroche | Condition |
|---|---|---|---|
| P1 exercice | `ui.js:2707` `finishPuzzle` ; nœuds `#exExplain`, `#exPedagogy` (`template.html:3830`) | volet après `#exPedagogy`, pour `puzzle.theme` | seulement si `finishPuzzle` n'est pas sorti par `onPuzzleResult` (Sprint), pas en duel (`duel` non nul, `duel.js:16`), pas en défi chronométré (`defis.js`, à repérer sur la base finale) ; exercice du jour et erreurs rejouées compris. Le volet est vidé par `loadPuzzle`. |
| P2 coach | `coach.js:644` `coachAfficher` ; `#coachBloc` (`template.html:3564`) | rubrique « Pour comprendre » après `#coachListe`, une ligne par sorte de faute : lire `analysis.coach[i].e.cas` des gaffes et erreurs du joueur | trois lignes au plus, sans doublon ; table cas → leçon en 5. Partie finie par construction (`coachInterdit`). |
| P3 nulle | `ui.js:1615` `gameOver` (contre l'ordinateur) ; `ui.js:908`, `ui.js:3181` (autres écrans) ; `direct_ecran.js:362` (direct) ; sous-titre `#resultSub` (`template.html:3382`) | raison de la nulle à la place de « La partie est nulle. », puis volet « Les parties nulles » ou « Échec, mat et pat » | raisons : `game.isStalemate()`, `game.isInsufficient()`, `game.half>=100`, `game.isRepetition()` (`engine_browser.js:190`). En direct, la raison vient du serveur (`motif`) : volet seulement. |
| P4 finale | `ui2.js` `renderResult` (≈ ligne 600-645) et la relecture | ligne « Tu as eu … : entraîne-toi » → `applyDeepLink({kind:"train",id})` | une position de la partie a exactement le matériel d'une finale de `ENDGAMES` (kq, kr, krr, kbn, kp) avec le joueur du côté fort ; variante si la partie a fini nulle. |
| P5 erreurs | `ui2.js:2551` `renderMistakeQueue`, après la rangée `.erreurs-pastilles` | ligne « Ce qui revient le plus : <motif> » + volet | motif le plus fréquent parmi les échues qui a une leçon ; sinon rien. |
| P6 pages | `content.js` : lexique (`terme`, ≈ 1025-1060), exemples tactiques (≈ 766-900), leçons (`RULES`, 488-535) | « Pour comprendre : … » (lexique, exemples) ; « Voir aussi : … » (leçons) | construction seulement, aucun poids dans l'application. Libellés dans les tables `UI[lang]` de content.js. |
| P7 badges | `badges.js:402` `BX_LIENS`, `bxLien`, `bxPoserLien` (`#bravoLien`, `template.html:4759`) | étendre la table : `theme_*` → leçon (volet dans la fiche), `eg_*` → entraîneur, `ch_*` → chapitre, `rating_*` → lexique Elo, `lec_berger` → piège du berger | la fiche est déjà une fenêtre : le volet s'y déplie, mesurer la hauteur à 360 × 640. |
| P8 chapitre | `apprendre.js:211` `leconFinRendre`, près de `#leconTheme` (`template.html:4196`) | ligne « Pour aller plus loin » | ch. 2 → toutes les fiches (`cheminFiches.index`) ; ch. 7 → volet « Principes d'ouverture » + Pièges ; ch. 8 → entraîneur des finales. |
| P9 mots | relecture : libellés `VERDICT` (gaffe, erreur, imprécision) dans le bandeau et le coach ; Statistiques : tuile Elo | petit bouton « ? » rond à côté du mot, volet du lexique | après la partie seulement (relecture), jamais en jeu. |
| A ouverture | `ui2.js:74` `renderOpening` | lien seulement si aucune partie n'est en cours : `!(gameStarted && !resultInfo)` (même test que `navPartie`, `navigation.js:25`) | sinon le nom en texte. Test qui échoue sans le correctif. |

## 5. Table des cas du coach

| `cas` | Leçon (slug anglais) |
|---|---|
| en_prise, prise_manquee, prise_perdante | spotting-a-hanging-piece |
| fourchette_permise, fourchette_manquee | knight-fork si la pièce qui fourchette est un cavalier, pawn-fork si pion, sinon double-attack |
| mat1_manque, mat1_permis | check-checkmate-stalemate |
| mat2_manque, mat2_permis | (pas de page) chapitre 9 s'il est ouvert, sinon rien |
| promo_manquee | pawn-promotion |
| pat | how-games-are-drawn |

## 6. Ordre de travail prévu (une fois le SHA reçu)

1. Branche `claude/liens-pedagogiques` sur le SHA final, worktree à part.
2. Socle : `lecons.js`, construction, `_headers`, données JSON, volet, test du socle.
3. P1, puis P2, P5, P7, P9 (même volet), P3, P4, P8, A.
4. P6 (construction seule).
5. Mesures à 360 px, 10 langues, police élargie (`src/mesure_liens_pedagogiques.js`, sur le modèle de `mesure_correctifs_2711.js`).
6. Nouveauté en tête de `src/nouveautes.json` (10 langues), suite complète, compte rendu.
