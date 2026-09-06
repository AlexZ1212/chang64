# Prompt — Audit de vérification chang64.com (v2, post-correctifs)

> À donner à Opus avec le `src` et le `chang64-site` fournis.
> Cette version remplace le prompt d'audit initial : le premier audit a été
> réalisé et **ses recommandations ont été implémentées**. Le mandat n'est donc
> plus « trouver ce qui ne va pas » mais « vérifier ce qui a été fait, et
> trouver ce que l'audit précédent a manqué ».

---

## Contexte

chang64.com est un site d'échecs gratuit, sans compte, sans tracking, sans
publicité, maintenu par une seule personne (Alexandre). Positionnement : un
outil de pratique rapide et minimaliste (résolution d'exercices, Chang Sprint,
Coordonnées, jouer contre un moteur intégré, parties par correspondance entre
amis) adossé à des pages de contenu à fond clair pour le référencement
(Ouvertures, Motifs tactiques, Apprendre les règles, Finales, Pièges
d'ouverture, Lexique).

**Lis `SESSION_HANDOFF_4.md` en premier.** Il documente exhaustivement l'audit
précédent, les 24 correctifs implémentés, les pièges de code, et — important —
les trois diagnostics que l'auditeur précédent a lui-même dû corriger après
mesure. Les handoffs 1 à 3 donnent l'historique antérieur.

---

## Mandat

Trois volets, par ordre de priorité.

### Volet 1 — Vérification contradictoire des correctifs (prioritaire)

Pour chacun des points ci-dessous, **vérifie par la mesure** que le correctif
fait ce qu'il prétend, et cherche activement l'effet de bord non anticipé.
Ne te fie pas au handoff : il a été écrit par celui qui a fait les correctifs.

1. **Polices auto-hébergées** — confirme zéro requête externe sur l'app ET sur
   les pages de contenu. Vérifie que `font-display:swap` (app) et `optional`
   (contenu) ne produisent pas de FOUT/FOIT visible, et que le raisonnement
   anti-reflow du menu tient toujours. Mesure l'impact réel sur le chemin
   critique.
2. **`noindex,follow` sur 224 pages d'ouvertures** — c'est le changement le
   plus risqué de la session. Vérifie qu'aucune URL indexée n'est perdue, que
   le maillage interne reste cohérent (les pages restent liées depuis
   `/openings/`), et **juge si le seuil est le bon** : 29 familles avec note
   suffisent-elles, ou faut-il en rédiger davantage avant de désindexer ?
3. **H1 distincts Lexique/Motifs** — la cannibalisation est-elle réellement
   résolue, ou juste déplacée ? Le suffixe « : définition » sur 43 entrées
   est-il le bon arbitrage face au risque AI Overviews 2026 ?
4. **`aria-label` sur les 64 cases** — teste avec un vrai lecteur d'écran si tu
   le peux. Y a-t-il double annonce quand `announceCell()` est actif ? Le
   passage `role="tablist"` → `<nav>` + `aria-current` est-il le bon choix, ou
   fallait-il plutôt restructurer les panneaux pour rendre le patron tabs
   honnête ?
5. **Correctif `lier()`** (rejeu jusqu'à stabilisation) — vérifie qu'aucun
   libellé ne devient une chaîne insécable trop longue sur petit écran.
   Mesure sur les libellés français les plus longs.
6. **Service worker : exclusion de `/data/`** — quel est le coût réel hors
   ligne ? Un utilisateur en avion perd-il l'accès aux exercices ?

### Volet 2 — Ce que l'audit précédent n'a pas couvert

L'audit v1 a passé peu ou pas de temps sur ces angles. Traite-les à fond.

- **Sécurité applicative** : le code de reprise de progression, les liens de
  partie entre amis (la position est encodée dans l'URL), le stockage local.
  Un lien forgé peut-il faire quelque chose d'inattendu ? La CSP est-elle
  complète (`object-src`, `form-action`, Trusted Types) ?
- **Qualité du moteur et de la banque d'exercices** : la difficulté annoncée
  correspond-elle au ressenti ? Les 10 niveaux sont-ils bien calibrés ?
  Le pool Sprint (3642) est-il assez varié ?
- **Résilience** : que se passe-t-il en connexion très dégradée, avec
  localStorage plein, en navigation privée, avec JS partiellement bloqué ?
- **Internationalisation au-delà du FR/EN** : le coût réel d'ajouter une 3e
  langue, et si ça vaut le coup pour ce positionnement.
- **Cycle de vie du contenu** : rien ne date les pages. Comment un visiteur (ou
  un moteur) sait-il que le contenu est maintenu ?
- **Analytique sans tracking** : Alexandre pilote à l'aveugle (RUM désactivé,
  pas de Search Console exploitée). Quelles options respectent la promesse
  « aucun traqueur » tout en donnant un signal exploitable ?

### Volet 3 — Axes classiques, en réévaluation

Reprends les 9 axes de l'audit v1 (SEO technique et éditorial ; UX/UI ;
accessibilité ; design ; performance et technique ; contenu et positionnement ;
confidentialité ; mobile et responsive ; benchmark concurrentiel), mais
**uniquement pour signaler ce qui a changé ou ce qui a été manqué**. Ne
reproduis pas les constats déjà traités.

---

## Méthodologie exigée

- **Mesure, ne suppose pas.** Build le site (`node build_site.js`), sers-le
  localement, ouvre-le dans un vrai Chromium. `SESSION_HANDOFF_4.md` §1 donne
  la méthodologie exacte, les stubs nécessaires et les pièges connus.
- **Lance la suite de tests** (40 fichiers, `run_tests.js`). Elle est censée
  être à 0 échec : tout échec est soit une régression, soit un test à mettre
  à jour — dis lequel et pourquoi.
- **Utilise la baseline de non-régression.** Elle existe :
  `codeload.github.com/AlexZ1212/chang64/tar.gz/refs/heads/main` →
  `chang64-main/chang64-site/`. Exporte `CHANG64_BASELINE` et lance
  `check_urls_indexees` et `check_non_regression`.
- **Recherche web** pour tout ce qui touche à l'état de l'art 2026 (Core Web
  Vitals, WCAG 2.2, impact des AI Overviews, fonctionnalités concurrentes).
  Ne te fie pas à ta connaissance générale, qui peut être datée.
- **Sois honnête sur tes limites.** Ce que tu ne peux pas vérifier sans
  Lighthouse, Search Console, analytics réels ou lecteur d'écran physique, dis
  que tu ne peux pas le vérifier plutôt que de l'estimer.
- **Traque le faux positif autant que le vrai défaut.** L'audit v1 a produit
  trois diagnostics faux, tous par mesure insuffisante (voir handoff §5). Si un
  constat te semble évident, vérifie-le une fois de plus avant de l'écrire.

## Contraintes de sortie

Rapport structuré par volet, chaque point appuyé par une mesure ou une
référence précise (fichier, ligne, chiffre, URL de source). Puis synthèse
priorisée effort/impact, en distinguant :
- ce qui est **confirmé correct** (et peut être oublié) ;
- ce qui est **incomplet ou risqué** dans les correctifs livrés ;
- ce qui reste **non traité**.

Ne repropose pas : la fusion Jouer/Inviter (chantier planifié séparément, voir
`PROMPT_FUSION_JOUER_INVITER.md`), le contenu « parties légendaires »
(explicitement écarté), ni le découpage des shards (déjà décidé, en attente de
session dédiée) — sauf si tu découvres un élément qui changerait la donne.

Conventions du projet à respecter dans toute proposition de code :
commentaires en français expliquant le **pourquoi**, tutoiement, **pas de tiret
cadratin**, pas de livrable après chaque changement.
