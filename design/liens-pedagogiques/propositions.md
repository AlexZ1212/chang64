# Liens vers le contenu pédagogique : inventaire et propositions

## Choix d'Alexandre (QCM du 28/11)

- La leçon s'ouvre **sur place**, dans un volet qui se déplie (petit dessin, début de la leçon, « Lire la leçon en entier », « M'entraîner sur ce motif »).
- Pistes retenues : **toutes**. P1 après un exercice, P2 sous le coach, P3 partie nulle, P4 finale atteinte, P5 Erreurs à revoir, P6 pages du site entre elles, P7 badges, P8 fin de chapitre, P9 mots de la relecture et des statistiques, et la correction A (nom de l'ouverture sans lien pendant une partie en cours).

Phase 1 (réflexion, aucun code), 28/11. Relevé fait sur la branche `claude/correctifs-27-11-972f58` (7ad3be8b), la plus récente : elle contient le lot des 21 correctifs, pas encore publié.

## 1. Les liens qui existent déjà

| # | Où | Fichier, fonction | Vers quoi | Comment on revient |
|---|---|---|---|---|
| 1 | Sous l'échiquier de Jouer, le nom de l'ouverture (« C50 \| Partie italienne ») | `ui2.js`, `renderOpening` / `openingHref` | Page de la famille d'ouverture (`/fr/ouvertures/…`) | On quitte l'application. Bouton Retour du navigateur seulement ; la page n'a pas de lien « Retour à la partie ». **Le lien est actif pendant la partie**, classée ou non (voir constat A). |
| 2 | Entraînement aux finales (Résoudre › Finales) | `ui3.js`, `renderEndgame` (`#egArticle`) | Article de la finale (`/fr/finales/dame-contre-roi`…) | On quitte l'application ; la page propose « S'entraîner » (`#train=kq`) qui relance la finale, mais pas le retour à l'écran exact. |
| 3 | Onglet Apprendre, bas de page : 8 fiches de règles et « Toutes les fiches » | `apprendre.js`, `apRendre` (`#apFiches`), données `data/fiches-<langue>.json` (`content.js`) | Pages `/fr/apprendre/…` (roque, prise en passant, promotion…) | On quitte l'application, Retour du navigateur. |
| 4 | Fin d'un chapitre d'Apprendre, écran du boss : « S'entraîner sur ce motif » | `apprendre.js`, `btnLeconTheme` | Résoudre › motif du chapitre (dans l'application) | Reste dans l'application ; « ‹ Résoudre » en haut. |
| 5 | Fiche d'un badge d'ouverture ou de piège : « Découvrir cette ouverture » / « Voir le piège » | `badges.js`, `BX_LIENS`, `bxPoserLien` (`#bravoLien`) | Page de l'ouverture ou du piège | On quitte l'application, Retour du navigateur. 19 badges sur environ 280 ont un lien. |
| 6 | Onglet Explorer : 5 tuiles (Ouvertures, Lexique, Finales, Pièges, Exemples tactiques) | `ui2.js`, `EXPLORE` / `renderExplore` | Index de chaque rubrique | On quitte l'application. |

Dans l'autre sens, les pages du site renvoient déjà vers l'application :

| Page | Lien | Adresse |
|---|---|---|
| Leçons (`/fr/apprendre/…`) | « Entraîne-toi sur ce motif », « Explore cette position », « Jouer une partie » | `#theme=`, `#fen=` |
| Finales | « S'entraîner » | `#train=kq`… |
| Pièges, ouvertures | « Jouer cette ligne » | `#line=` |
| Lexique, exemples tactiques | « Essayer cet exercice » | `#puzzle=` |

Entre pages du site, peu de liens : le lexique renvoie vers les exemples tactiques, mais **ni le lexique ni les exemples ne renvoient vers la leçon** du même motif, et les leçons ne renvoient ni vers le lexique ni vers les exemples.

### Comment on revient aujourd'hui

- Dans l'application, chaque écran est une étape de l'historique (`navigation.js`) : Retour ramène à l'écran d'avant, à la même hauteur, sans changer d'exercice.
- Vers une page du site, on quitte l'application. Retour du navigateur ramène en général l'écran tel quel (le navigateur garde la page en mémoire), mais ce n'est pas garanti : si la page est rechargée, on retombe sur l'accueil, car l'application ne relit pas l'écran noté dans l'historique au démarrage. Pendant une partie en direct (connexion ouverte), le navigateur ne garde presque jamais la page en mémoire.
- **Dans l'application installée sur iPhone, il n'y a pas de bouton Retour** : une fois sur une page du site, on ne revient qu'en touchant le logo, qui ramène à l'accueil.

### Constats en passant

- **A. Le lien de l'ouverture pendant une partie.** Pendant une partie contre l'ordinateur, le nom de l'ouverture est un lien vers sa page, qui montre la suite des coups. C'est une aide pendant une partie classée, et le toucher fait quitter la partie (la pendule continue). À retirer pendant la partie, à garder une fois la partie finie et en relecture.
- **B. « La partie est nulle. » sans dire pourquoi.** Le moteur connaît la raison (pat, répétition, 50 coups, matériel insuffisant), l'écran ne la dit pas (`gameOver`, `ui.js`). Un débutant ne comprend pas pourquoi sa partie s'arrête.

## 2. Le contenu pédagogique qui existe

| Contenu | Où | Nombre | Toujours ouvert ? |
|---|---|---|---|
| Chemin d'Apprendre | Onglet Apprendre (`src/chemin/`) | 9 chapitres, 45 leçons, 8 boss, un test de placement | Non : un chapitre s'ouvre quand le précédent est fini (ou par le test) |
| Leçons du site (« fiches ») | `/fr/apprendre/` (`content.js`, `RULES`) | 20 : 9 de règles, 1 principes d'ouverture, 9 de motifs, 1 pour les clubs | Oui |
| Lexique | `/fr/lexique/` | 53 termes (fourchette, clouage, gaffe, pat, opposition, Elo…) | Oui |
| Exemples tactiques | `/fr/exercices/` | 13 motifs, 3 exemples expliqués chacun | Oui |
| Finales | `/fr/finales/` + entraîneur dans Résoudre | 5 articles, 5 finales jouables | Oui |
| Pièges d'ouverture | `/fr/pieges/` | 6 | Oui |
| Ouvertures | `/fr/ouvertures/` | 141 familles | Oui |
| Explication après un exercice | Écran de l'exercice (`explainSentence`) | une phrase par exercice | Oui |
| Coach de relecture | Relecture d'une partie (`coach.js`) | 11 cas expliqués | Après la partie |

Correspondance entre les motifs de Résoudre et les leçons (la table existe déjà dans `content.js`, `THEME_DE_LA_PAGE`) :

| Motif | Leçon du site | Chapitre d'Apprendre |
|---|---|---|
| Prise gagnante | Repérer une pièce qui traîne | 3 Ne rien donner |
| Fourchette de cavalier | La fourchette de cavalier | 5 Les doubles menaces |
| Fourchette de pion | La fourchette de pion | 5 |
| Attaque double | La double attaque | 5 |
| Clouage | Le clouage | 6 Clouer et enfiler |
| Enfilade | L'enfilade | 6 |
| Déviation | La déviation | 6 (Chasser le défenseur) |
| Coup silencieux | Le coup silencieux | 9 (Le coup tranquille) |
| Mat du couloir | Le mat du couloir | 4 Les mats à connaître |
| Mat en un | (aucune ; « Échec, mat et pat » de loin) | 4 |
| Mat en deux, en trois | (aucune) | 9 Le mat en deux |
| Coup gagnant | (aucune, motif trop général) | — |

Correspondance entre les cas du coach et les leçons :

| Le coach dit | Leçon du site | Chapitre |
|---|---|---|
| Pièce laissée en prise, prise manquée, mauvais échange | Repérer une pièce qui traîne | 3 Ne rien donner |
| Fourchette permise ou manquée | Fourchette de cavalier / de pion / double attaque, selon la pièce | 5 |
| Mat en un permis ou manqué | Échec, mat et pat | 4 |
| Mat en deux permis ou manqué | (aucune) | 9 |
| Promotion manquée | La promotion du pion | 2 |
| Pat | Échec, mat et pat ; lexique « Pat » | 2 (Le pat et les nulles) |
| Les mots « gaffe », « erreur », « imprécision » | Lexique : Gaffe, Erreur, Imprécision | — |

## 3. La question qui vaut pour tous les liens : où s'ouvre la leçon ?

Trois façons possibles.

- **Volet sur place (recommandé).** Une ligne « Pour comprendre : la fourchette ▸ ». Un toucher la déplie juste en dessous : le petit diagramme et le premier paragraphe de la leçon, puis « Lire la leçon en entier » et « M'entraîner sur ce motif ». On ne quitte pas l'écran, rien n'est perdu, rien à faire pour revenir. Le texte vient des leçons du site (déjà écrites en 10 langues), chargé seulement quand on déplie.
- **Lien vers la page de la leçon**, et sur cette page une ligne « ‹ Retour à chang64 » quand on arrive de l'application (elle fait l'équivalent du bouton Retour, donc marche aussi dans l'application installée sur iPhone). Plus simple, mais on change de page et le retour à l'écran exact n'est pas garanti si la page est rechargée (à corriger en même temps : l'application relit l'écran noté dans l'historique).
- **Lien vers le chapitre d'Apprendre.** Reste dans l'application, mais un chapitre fermé ne s'ouvre pas : il faudrait retomber sur la page du site dans ce cas. Pour les chapitres finis ou ouverts seulement.

Dans tous les cas, le lien n'apparaît **qu'une fois l'exercice ou la partie finie** (jamais pendant une partie, jamais pendant un Sprint, un duel ou un défi chronométré) : on ne perd rien en le suivant.

## 4. Les propositions, de la plus utile à la moins utile pour un débutant

### P1. Après un exercice : « Pour comprendre : la fourchette »

- **Où.** Écran de l'exercice, sous la phrase d'explication (`#exExplain`, `finishPuzzle`, `ui.js`), une fois l'exercice réussi ou raté. Vaut aussi pour l'exercice du jour (même écran) et les erreurs rejouées. Pas dans le Sprint, le duel ni les défis.
- **Vers quoi.** La leçon du motif (table ci-dessus). Motifs sans leçon (Mat en un, deux, trois) : le chapitre d'Apprendre s'il est ouvert, sinon rien. Coup gagnant : rien.
- **Forme.** Ligne « Pour comprendre : la fourchette de cavalier », en volet sur place (ou lien, selon le choix de la section 3).
- **Retour.** Rien à faire avec le volet ; avec un lien, l'exercice est fini, on ne perd rien.
- **Contenu.** Existe (9 leçons). Créer « Le mat en un » et « Le mat en deux » serait un plus, pas nécessaire.
- **Effort.** Moyen la première fois (le volet sert ensuite à toutes les autres pistes), petit avec un simple lien.
- **Pourquoi en premier.** C'est l'écran que le débutant voit le plus souvent ; il vient de rater une fourchette, c'est le moment où il a envie de comprendre.

### P2. Le coach : « Pour comprendre » sous la liste des moments

- **Où.** Bloc « Le coach » de la relecture (`coachAfficher`, `coach.js`), sous la liste des gaffes et erreurs.
- **Vers quoi.** Une ligne par sorte de faute présente dans la partie, deux ou trois au plus : « Tu as laissé des pièces en prise : Ne rien donner », « Tu as permis une fourchette : La fourchette de cavalier ». Table des cas ci-dessus.
- **Forme.** Une courte rubrique « Pour comprendre » avec une ligne par leçon, en volet sur place. Pas un lien dans chaque ligne du coach : la ligne entière sert déjà à aller au coup.
- **Retour.** La partie est finie ; avec le volet on reste dans la relecture.
- **Contenu.** Existe, sauf le mat en deux (chapitre 9 seulement).
- **Effort.** Petit une fois P1 faite (le volet est le même).
- **Conflit.** Le lot du 27/11 a refait `coachAfficher` (point 11) : à faire après la fusion du lot.

### P3. Fin de partie nulle : dire pourquoi, avec la leçon

- **Où.** Écran de fin de partie contre l'ordinateur, entre membres, en direct (`gameOver`, `ui.js` ; `renderResult`, `ui2.js`).
- **Vers quoi.** « Nulle par répétition », « Nulle : 50 coups sans prise ni coup de pion », « Nulle : plus assez de pièces pour mater », « Pat » ; puis « Pour comprendre : les parties nulles » (leçon « Les parties nulles » ou « Échec, mat et pat »).
- **Forme.** La raison dans le sous-titre du résultat, et une ligne « Pour comprendre » dessous.
- **Retour.** La partie est finie.
- **Contenu.** Existe. Les quatre phrases de raison sont à écrire (10 langues).
- **Effort.** Petit.
- **Pourquoi si haut.** Un débutant qui pensait gagner avec une dame de plus et tombe sur un pat ne sait pas ce qui s'est passé. C'est le cas le plus frustrant, et le plus facile à expliquer.

### P4. Une finale atteinte en partie : « Apprends à la gagner »

- **Où.** Fin de partie et relecture, quand la partie est passée par une des 5 finales de l'entraîneur (roi et dame contre roi, tour, deux tours, fou et cavalier, roi et pion) avec le joueur du côté fort.
- **Vers quoi.** L'entraîneur de finales sur cette finale (`#train=kq`, dans l'application) ; l'article reste accessible depuis l'entraîneur (lien 2).
- **Forme.** Ligne « Tu as eu roi et dame contre roi : entraîne-toi à mater ». Plus appuyée si la partie a fini en nulle (pat, 50 coups) dans cette finale.
- **Retour.** La partie est finie ; l'entraîneur a son « ‹ Résoudre ».
- **Contenu.** Existe.
- **Effort.** Petit à moyen (repérer la finale dans la partie).

### P5. Erreurs à revoir : la leçon du motif qui revient le plus

- **Où.** Carte « Erreurs à revoir » de Résoudre (`renderMistakeQueue`, `ui2.js`).
- **Vers quoi.** La leçon du motif le plus fréquent dans la file, s'il en a une.
- **Forme.** Une ligne sous les pastilles : « Ce qui revient le plus : la fourchette de cavalier. Pour comprendre ▸ ». Les pastilles restent comme elles sont (une rangée qui défile, pas faite pour être touchée).
- **Retour.** Volet sur place, rien à faire.
- **Contenu.** Existe.
- **Effort.** Petit une fois P1 faite.
- **Conflit.** Le lot du 27/11 touche cette carte (point 19, dégradé des pastilles) : après la fusion.

### P6. Les pages du site entre elles

- **Où.** Pages générées par `content.js` : lexique, exemples tactiques, leçons.
- **Vers quoi.** Lexique « Fourchette » → leçon « La fourchette de cavalier » ; « Clouage » → « Le clouage » ; « Pat », « Triple répétition », « Règle des 50 coups » → « Les parties nulles » ; « Opposition » → finale « Roi et pion contre roi », etc. Exemples tactiques d'un motif → sa leçon. Leçon d'un motif → ses exemples et son mot du lexique.
- **Forme.** Ligne « Pour comprendre : … » (lexique, exemples) et « Voir aussi : … » (leçons), en bas du texte, avant les boutons.
- **Retour.** On reste sur le site ; Retour du navigateur.
- **Contenu.** Existe.
- **Effort.** Petit, uniquement à la construction du site. Bonus : aide le référencement (Google voit mieux de quoi parle chaque page).

### P7. Les badges : vers ce qu'ils récompensent

- **Où.** Fiche d'un badge (`bxFiche`, `badges.js`), là où les badges d'ouverture ont déjà leur lien.
- **Vers quoi.** Badges de motif (39) → leçon du motif ; finales (5) → entraîneur de la finale ; chapitres d'Apprendre (8) → le chapitre ; « Subir le coup du berger » → le piège (déjà fait pour l'un, pas pour « Subir un mat en moins de 10 coups ») ; paliers du Niveau exercices (11) → lexique « Le classement Elo ».
- **Forme.** Le même lien que les badges d'ouverture, sous le texte.
- **Retour.** Comme aujourd'hui pour les badges d'ouverture (on quitte l'application), ou volet sur place.
- **Contenu.** Existe.
- **Effort.** Petit (le mécanisme existe, c'est une table à compléter).

### P8. Fin de chapitre d'Apprendre : « Pour aller plus loin »

- **Où.** Écran de fin de chapitre (`leconFinRendre`, `apprendre.js`), à côté de « S'entraîner sur ce motif ».
- **Vers quoi.** Chapitre 2 → fiches de règles ; chapitre 7 → « Les principes d'ouverture » et les pièges ; chapitre 8 → entraîneur de finales (aujourd'hui rien, faute de motif).
- **Forme.** Une ligne de plus sous les boutons.
- **Retour.** Entraîneur : dans l'application ; pages : on quitte.
- **Contenu.** Existe.
- **Effort.** Petit.

### P9. Les mots de la relecture et des statistiques

- **Où.** Relecture (« Gaffe », « Erreur », « Imprécision », les signes ?? ? ?!) ; Statistiques (Elo, Niveau exercices).
- **Vers quoi.** Lexique (Gaffe, Erreur, Imprécision, Le classement Elo).
- **Forme.** Petit « ? » ou lien sur le mot, en volet.
- **Effort.** Petit, mais utile surtout la première fois.

### Correction liée (constat A) : le nom de l'ouverture pendant la partie

- Pendant une partie en cours : le nom sans lien.
- Partie finie, relecture : le lien, comme aujourd'hui.
- Effort petit.

## 5. Ce qui touche au lot du 27/11

Le coach (P2), la carte Erreurs à revoir (P5), l'écran de l'exercice (P1, point 14 du lot) et Apprendre (P8) sont modifiés par la branche `claude/correctifs-27-11-972f58`, pas encore fusionnée. La phase 2 partira de cette branche une fois fusionnée, ou attendra la fusion ; la session principale est prévenue avant le premier code.
