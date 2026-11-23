# Le chemin d'apprentissage (onglet Apprendre)

Ce dossier contient tout le contenu du chemin. Ajouter un chapitre ne demande
aucun changement de code : on écrit un fichier, on l'inscrit dans `plan.json`,
on construit le site.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `plan.json` | L'ordre des chapitres (`chapitres`) et, tant que des chapitres restent à sortir, la phrase « À venir » (`aVenir`, 10 langues). Le chemin est complet depuis le 22/11 : `aVenir` a été retiré, la ligne ne s'affiche plus. |
| `debut.json` | Le chapitre 1, « Je débute ». Son contenu est dans l'application (`ui3.js`, `debutEtapes`) : ce fichier ne porte que son titre et sa description (`"integre": true`). |
| `regles.json`, `securite.json`, `mats.json`, `menaces.json`, `clouer.json`, `ouverture.json`, `finales.json`, `mat2.json` | Un chapitre chacun (chapitres 2 à 9). |
| `placement.json` | Les dix positions du test de placement. |

Tout texte est un objet aux dix langues : `{ "en": "…", "fr": "…", "es": "…",
"pt": "…", "de": "…", "ru": "…", "it": "…", "tr": "…", "pl": "…", "id": "…" }`.
Une langue absente retombe sur l'anglais, et la construction le signale.

## Un chapitre

```json
{
  "id": "regles",
  "theme": "Winning capture",
  "titre": { … }, "desc": { … },
  "etapes": [
    { "titre": { … }, "intro": { … }, "exos": [ … ] }
  ],
  "boss": { "fen": "…", "niveau": 1, "titre": { … }, "intro": { … }, "gagne": { … } }
}
```

- `id` : le nom du fichier, sans `.json`. Il sert aussi de clé à la
  progression gardée chez le joueur : **ne jamais le changer une fois publié**.
- `theme` (facultatif) : un motif de Résoudre (son nom anglais, par exemple
  `Knight fork`). L'écran du boss propose alors de s'y entraîner.
- `etapes` : 3 à 6 leçons, chacune de 2 à 4 exercices.
- `boss` : la partie de fin de chapitre contre l'ordinateur, depuis la position
  `fen`, sans pendule. `niveau` : 1 (700), 2 (1100), 3 (1600) ou 4 (1900).
  Le contrôle admet : une pièce ou deux pions de moins chez les Noirs, la
  position de départ à égalité (chapitre 7), une finale (`"finale": true`,
  chapitre 8 : roi et dame contre roi seul), et le niveau 2 pour le dernier boss.

Ne jamais retirer ni déplacer une leçon d'un chapitre déjà publié : la
progression des joueurs est notée par numéro de leçon. On peut en ajouter à la
fin, et retoucher textes et positions.

## Un exercice

```json
{
  "fen": "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1",
  "avant": "d7d5",
  "sol": ["e5d6"],
  "cible": "d6",
  "consigne": { … },
  "faux": { "e5e6": { … }, "*": { … } },
  "apres": { … },
  "suite": ["f6d5", "d1d5"],
  "mat": true,
  "controle": "meilleur"
}
```

| Champ | Sens |
|---|---|
| `fen` | La position. Les Blancs jouent toujours l'exercice. |
| `avant` | Un coup que les Noirs jouent d'abord, sous les yeux du joueur (prise en passant). La `fen` est alors au trait des Noirs. |
| `sol` | Les coups acceptés, en notation `e2e4` (`e7e8q` pour une promotion). Le premier sert à l'indice. |
| `cible` | Une case marquée sur l'échiquier ; ce doit être l'arrivée du premier coup de `sol`. |
| `consigne` | Ce qu'on demande. |
| `faux` | La raison propre à un mauvais coup ; `"*"` vaut pour tout autre mauvais coup. Sans rien : « Pas tout à fait », suivi de la consigne. |
| `apres` | L'explication affichée après la réussite. |
| `suite` | Les coups rejoués ensuite, un par camp, pour montrer la fin de l'idée. |
| `mat` | `true` : tout coup qui fait mat est accepté ; `sol` doit les lister tous. |
| `reponse` | Mat en deux (chapitre 9) : le coup noir joué après un bon premier coup. Le joueur doit ensuite faire mat lui-même (tout mat est accepté). La construction vérifie que `sol` contient exactement les premiers coups qui forcent le mat en deux, qu'il n'y a pas de mat en un, et que `reponse` est légale et laisse un mat. |
| `ensuite` | Mat en deux : la consigne affichée après la réponse noire (10 langues). |

Champs lus seulement par les contrôles, pour que **tout ce que dit une leçon
soit vrai** :

| Champ | Ce que le contrôle vérifie |
|---|---|
| `controle` | Par Stockfish. `"meilleur"` : les solutions sont les meilleurs coups et tout autre coup est nettement moins bon (à mettre dès que la consigne dit « prends », « le meilleur », « sauve »). `"premier"` : la solution est le premier choix du moteur. `"bon"` : la solution n'est pas une faute (pour un geste qu'on apprend, comme roquer). |
| `pat` | Ces coups font pat, et eux seuls. |
| `sansPat` | `true` : « joue un coup qui ne fait pas pat, n'importe lequel ». `sol` liste exactement les coups qui ne font pas pat, `pat` ceux qui le font, chacun avec sa raison dans `faux` ; aucun coup accepté ne doit donner une pièce. La construction s'arrête sinon. |
| `interdit` | Ces coups sont illégaux (un roque interdit). |
| `suiteMat` | La `suite` finit par un mat. |
| `nonDefendues`, `defendues` | Les cases citées portent une pièce que les Noirs ne peuvent pas, ou peuvent, reprendre. |
| `compte` | `{ "case": "d5", "attaquants": 2, "defenseurs": 1 }`. |

## Le test de placement

`placement.json` : dix positions, de la plus simple à la plus dure, chacune
avec `fen`, `sol`, éventuellement `avant` et `mat`, `chapitre` (l'`id` du
chapitre qu'elle représente) et `explication` (10 langues) : la phrase affichée
après la réponse, qui dit l'idée du bon coup. Ce qu'elle affirme doit être
couvert par un champ de contrôle (`mat`, `controle`, `nonDefendues`, `compte`,
`suite`…). Varier les pièces d'une position à l'autre. Une position sans `chapitre` est au-delà des
chapitres sortis. Le joueur entre dans le premier chapitre dont il a manqué une
position. Quand un chapitre sort, donner son `id` à deux positions.

## Ajouter un chapitre

1. Écrire `chemin/<id>.json` sur le modèle de `regles.json`.
2. Ajouter `"<id>"` à la liste `chapitres` de `plan.json`, et retirer son sujet
   de la phrase `aVenir`.
3. Rattacher deux positions du test (`placement.json`) à ce chapitre.
4. `node build_site.js` : la construction s'arrête si une position est fausse
   pour le moteur de règles (coup illégal, mat annoncé à tort, suite injouable).
5. `node tests/check_chemin_positions.js` : le contrôle par Stockfish et les
   textes dans les dix langues.
6. `node mesure_apprendre.js` (serveur local lancé) : à 360 px, dans les dix
   langues, aucun bouton sur deux lignes, chaque leçon sur un seul écran.
7. Une entrée en tête de `nouveautes.json`.
8. Le badge du chapitre : une ligne `ch_<id>` dans `badges-catalogue.js` (famille `apprendre`), sa
   médaille (`design/badges/symboles.js`, puis `src/badges-medailles.json`), ses textes dans les
   neuf fichiers de `badges-textes/`. Les badges « Tombeur de boss » et « Sommet » disent
   « huit boss » et « neuf chapitres » : à corriger dans les dix langues.
   `node tests/check_badges_apprendre.js` échoue tant que ce n'est pas fait.

Les tests lisent le nombre de chapitres et de positions dans `plan.json` et
`placement.json` : ajouter un chapitre ne demande plus de les retoucher.
Le barème du test de placement suit la part de positions trouvées : plus le
test est long, moins quelques bonnes réponses rapportent.
