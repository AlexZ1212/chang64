# SESSION HANDOFF 10

Session du 17 octobre 2026, reprise apres une pause d'un mois. Point de
depart : le handoff 9 et les travaux du 14 septembre, perdus avec l'espace de
travail cloud puis reconstruits. Point d'arrivee : mineur corrige et outillage
de minage en place dans `src`, **minage pas encore lance**. La suite se fait en
session locale, avec un vrai terminal sur la machine d'Alexandre.

---

## 1. Le probleme a resoudre

Mesure sur la banque (70 427 exercices, inchangee depuis le 13/09) :

| | |
|---|---|
| exercices en un seul demi-coup | 86,9 % |
| gains en un seul demi-coup | 99,0 % |
| prises triviales parmi ces gains | 53,9 % (28 143) |

Deux causes, toutes les deux dans `extractPuzzleAt` (mine_puzzles.js) :

1. aucun filtre sur la trivialite du premier coup ;
2. `solMoves = [best.mv]` pour tout gain : le mineur trouvait des sequences a
   plusieurs decisions et jetait la suite.

Mesure sur 400 gains mines : 34,8 % des positions supportent en fait 2 a 4
decisions forcees. Les prolonger coute **2,6 %** de temps de minage en plus
(243 ms par candidat, 0,122 candidat par partie, 1 152 ms par partie), pas le
double comme l'affirmait le commentaire d'origine.

Objectif d'Alexandre : se rapprocher des puzzles Chess.com, a son echelle.
Plusieurs coups a jouer, une vraie reflexion, plus de prises gratuites.

---

## 2. Ce qui est en place dans `src`

| fichier | role |
|---|---|
| `mine_puzzles.js` | corrige, voir 2.1 |
| `mine_puzzles.avant-2026-10-17.js` | la version du 13/09, intacte |
| `position_minage.js` | retrouve dans le PGN jusqu'ou le minage est alle |
| `boucle_minage.js` | 6 voies paralleles, reprise apres coupure |
| `lancer_minage.cmd` | ouvre les 6 voies en priorite basse |
| `trouver_pgn.cmd` | cherche les .pgn > 200 Mo, ecrit `trouver_pgn.txt` |
| `tests/check_minage_non_trivial.js` | 18 verifications |
| `tests/check_saut_minage.js` | 11 verifications |
| `tests/check_voies_minage.js` | 19 verifications |

Toutes vertes, ainsi que `tests/check_motifs_silencieux.js` (31/31), la suite
existante qui teste le mineur.

### 2.1 Les changements de `mine_puzzles.js`

- `trivialite(g, mv)` : rejette une prise dont la piece prise n'est pas
  defendue APRES le coup, ou vaut plus que celle qui prend. Geometrique, zero
  moteur, applique avant les recherches couteuses. Un sacrifice et une prise
  d'egale valeur sur case defendue passent. `opts.garderPrisesSimples` rend
  l'ancien comportement.
- Prolongement de TOUS les gains (plus seulement les silencieux), jusqu'a 3
  allers-retours (4 decisions), chaque coup a nous repassant `isClearlyBest`.
- `sourceDe()` garde `site` (identifiant Lichess), `eco`, `opening`, `date`,
  `timeControl`, `elo`. Indispensable pour dedoublonner par partie ou par
  ouverture sans re-miner.
- `--sauter=N` : decale la lecture de N parties BRUTES. Sans lui, chaque passe
  relit le meme demi-million de parties en tete de fichier (plafond de
  `extractGameChunk`) et ne produit que des doublons.

### 2.2 `boucle_minage.js`

- Voies en tourniquet : la voie i traite les fenetres i, i+6, i+12...
  `check_voies_minage` garde l'absence de trou et de recouvrement.
- Fenetre reglable. Memoire mesuree : 5,1 Ko par partie chargee. Machine a
  16 Go : 6 voies x 100 000 parties = environ 3 Go.
- Une fenetre n'est terminee que si son marqueur `.fini` existe. Piege evite :
  `mine_puzzles.js` reecrit sa sortie toutes les 50 parties, donc une fenetre
  interrompue laisse un fichier valide mais incomplet.
- Sortie dans `src/fournees-minage/` (ajoute au `.gitignore`), un journal par
  voie : `boucle-voieN.log`.

---

## 3. Prochaines etapes, dans l'ordre

1. **Trouver le PGN.** Il n'est pas dans `Chang64`. `trouver_pgn.cmd` tournait
   au moment de la passation ; lire `src/trouver_pgn.txt`.
2. **Mesurer le depart.** `node position_minage.js "<pgn>"`. Lire le tableau :
   une zone dense de correspondances puis une traine vide. Le depart conseille
   n'est jamais inferieur a 500 000 (le lecteur a forcement avale jusque-la).
3. **Fournee d'essai avant tout.** Une seule voie, une fenetre de 20 000
   parties, puis mesurer : taux de multi-coups, taux de rejet, absence de prise
   triviale, sequences rejouables. Ne lancer les 6 voies qu'apres.
4. **Lancer.** `lancer_minage.cmd "<pgn>" <depart>` (28 fenetres de 100 000 par
   voie). Surveiller la memoire la premiere heure.
5. **Pendant que ca tourne : etendre `filtre_stockfish.js`.** Il ne valide que
   `p.sol[0]`. Les coups suivants ne sont valides que par le moteur maison a
   faible profondeur, celui-la meme dont l'audit du 09/09 a montre qu'il
   laissait passer 1 % d'exercices faux. **A faire avant toute fusion.**
   Valider chaque coup a nous (meilleur coup, marge 200 cp) et chaque replique
   adverse (meilleure defense, sinon la ligne n'est pas forcee).
6. **Purge des prises triviales de la banque existante** : 28 143 exercices,
   aucun motif ne se vide (Winning capture tombe de 28 499 a 5 084), banque a
   42 284. Passer par `purge_puzzles.js`, `--dry` d'abord.

---

## 4. Projection

Rendement mesure sur les positions deja minees, mineur corrige : environ 63
exercices retenus pour 1 000 parties apres filtre Elo, dont environ 60 % a
plusieurs decisions. Debit de reference : 3 100 parties/h par voie. Sur 3
semaines a 6 voies, de l'ordre de 450 000 exercices. **Ce sont des
estimations a confirmer par la fournee d'essai de l'etape 3.**

Cout au retour : le filtre Stockfish a 4,1 s par gain sur un coeur (mesure),
plus cher une fois etendu a toute la sequence.

---

## 5. Questions encore ouvertes

- Heuristique Deflection : 14 reconnues sur 24 599 exercices mines. Aucun
  volume de minage ne la corrigera. Une position qu'une heuristique elargie
  reconnaitrait est aujourd'hui gardee sous "Quiet move" et reclassee a la
  fusion : miner maintenant ne fige rien.
- `explainSentence()` n'a pas de phrase pour Quiet move ni Winning move.
- Difficulte empirique : seul le taux de reussite reel des joueurs la dira.
  Prevoir le champ dans le schema.
- Le prompt de refonte d'Alexandre (12 phases) : bonne direction, mais
  "Skill Level 18" affaiblirait Stockfish (ce n'est pas la profondeur), la
  phase 9 doit veiller a ne vider aucun motif, et il n'impose pas
  `run_tests.js`.

---

## 6. Environnement

Inchange : Windows, `C:\Users\Alexandre Callot\Desktop\Chang64`, git depuis
`Chang64` et non `src`, aucun Python, 8 coeurs, 16 Go. Ne jamais lancer
`merge_puzzles.js` sur les sorties de `releve_alternatives.js`.
