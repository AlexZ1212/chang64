# Paquet du 9 septembre 2026

À décompresser **par-dessus ton dossier `src`**, en écrasant. Sauvegarde ton
`src` avant, par sécurité.

## Fichiers modifiés

| Fichier | Ce qui change |
|---|---|
| `gen_puzzles_v2.js` | contrôle de survie du fourcheur ; `verifyFull()` compare enfin la pièce de promotion ; sérialisation UCI par `g.uci()` |
| `gen_puzzles.js` | sérialisation UCI par `g.uci()` |
| `mine_puzzles.js` | sérialisation UCI par `g.uci()` |
| `merge_puzzles.js` | l'explication recalculée prime sur celle reçue |
| `ui.js`, `ui2.js`, `template.html`, `i18n.js` | revue d'exercice pas à pas |

## Fichiers nouveaux

| Fichier | À quoi il sert |
|---|---|
| `fix_promotions.js` | répare les lettres de promotion inversées |
| `audit_banque.js` | audit déterministe complet, quelques minutes |
| `audit_moteur.js` | audit Stockfish des gains, quelques heures |
| `reclass_puzzles.js` | réaligne motif et explication sur le classificateur actuel |
| `tests/check_revue_pas_a_pas.js` | garde la revue pas à pas |

## Ordre conseillé

Voir le message qui accompagne ce paquet. En résumé :
`audit_banque` → `fix_promotions` → `audit_banque` → `audit_moteur --tous`,
et on ne touche à `reclass_puzzles` et à la fusion qu'après.

## Si l'audit Stockfish est interrompu

Relance exactement la même commande en ajoutant `--reprendre`. Il repart où
il en était, sans refaire ce qui est déjà dans le fichier de résultats.
