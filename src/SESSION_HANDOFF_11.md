# SESSION HANDOFF 11

Passation du 1er novembre 2026. Couvre les sessions du 17 au 27 octobre :
minage termine, nouvelle banque publiee, site en six langues, mesure de la
difficulte, et une serie d'ameliorations. **Etat au depart : tout est publie,
rien n'attend sur main** (dernier commit `19f2e890`, deja pousse et en ligne,
controle en ligne 3 439 OK / 0 echec).

On parle a Alexandre en francais et on le tutoie. Il decide de chaque
publication et de chaque reglage de compte (Cloudflare, GitHub).

---

## 1. Le projet en bref

chang64.com : site d'echecs gratuit, sans compte, sans publicite, sans
traqueur. Jouer contre un moteur, exercices tactiques verifies (banque de
229 172), exercice du jour, Chang Sprint, coordonnees, finales, pages
d'ouvertures et de contenu. Dix langues : anglais (`/`), francais (`/fr/`),
espagnol, portugais, allemand, russe, et depuis le 01/11 italien, turc,
polonais, indonesien.

| ou | quoi |
|---|---|
| `C:\Users\Alexandre Callot\Desktop\Chang64` | depot git (lancer git d'ici, pas de `src`) |
| `src/` | sources, outils, tests, banque |
| `src/site/` | sortie du build (ignoree par git) |
| `chang64-site/` | copie miroir de `src/site`, versionnee, deployee |
| GitHub | `AlexZ1212/chang64`, branche `main` |
| Cloudflare Pages | projet `chang64-git` : racine `chang64-site`, sortie `.`, pas de commande de build |

Environnement : Windows 10, Node 24, 8 coeurs, 16 Go, pas de Python.

---

## 2. Construire, tester, publier

1. `cd src` puis `node build_site.js` (ecrit `src/site`, met a jour
   `content-dates.json`, `site-index.html`, `exercices-du-jour.json`).
2. `node run_tests.js` : **toujours en arriere-plan**, environ 35 min,
   2 292 verifications au 27/10. Format : `N verifications passees, N en echec`.
   Les tests unitaires : `node tests/check_xxx.js` (`N OK, N FAIL`) et les
   anciennes suites `uitestN.js` (` ok ` / ` FAIL `).
3. Publication, **uniquement avec l'accord d'Alexandre** et une suite verte :
   - `robocopy src\site chang64-site /MIR` (PowerShell ; code de sortie < 8 =
     succes, 1 et 3 sont normaux) ;
   - `diff -rq src/site chang64-site` doit etre vide ;
   - `git add chang64-site src/content-dates.json src/site-index.html src/exercices-du-jour.json`,
     commit "Publication : ..." ;
   - push avec le contournement DNS (section 7) ;
   - attendre que `https://chang64.com/sw.js` porte le nouveau `const CACHE="chang64-AAAAMMJJHHMM"` ;
   - `node src/controle_en_ligne.js` : doit finir en `0 FAIL`.
4. Traitements de plus de quelques minutes (minage, Stockfish) : **hors de
   Claude**, via un `.cmd` lance par `Start-Process explorer.exe`, sinon une
   mise a jour de l'application les tue.

Pieges connus :
- les heredocs bash mangent les antislashs : ecrire les scripts avec Write ;
- les tests jsdom peuvent echouer une fois sous forte charge CPU : relancer
  avant de chercher un defaut ;
- en francais, `t()` pose des espaces insecables apres les mots courts : les
  tests comparent apres `.replace(/\u00a0/g, " ")` ;
- le navigateur integre de l'app n'atteint pas les serveurs locaux ; il ouvre
  les `file://` en instantane statique. Le compte Cloudflare est connecte dans
  **Chrome** (extension Claude in Chrome), pas dans le navigateur integre.

---

## 3. La banque d'exercices

- `src/banque/tranche-NNN.json` (11 tranches, un exercice par ligne), lue et
  ecrite uniquement via `src/banque.js` (`charger`, `ecrire`, `sauvegarder`).
- Regles d'Alexandre : **aucune capture en un coup** (Winning capture a
  `sol.length === 1` retiree avant toute fusion) ; **filtre Stockfish strict**
  (`filtre_stockfish.js`, le coup doit devancer le deuxieme de 200 cp).
- Chaine de fusion : `preparer_fournees.js` (captures en un coup + quotas de
  mats) puis `merge_puzzles.js` (parallele, hors de Claude).
- Les sauvegardes `src/puzzles.*.bak.json` (40 Mo) partent a la Corbeille, pas
  en suppression definitive.
- Explications (`explainSentence`, `phraseLigne` dans `ui.js`) des
  "Winning move" sans prise ni echec, champs produits par
  `src/menaces_coups_gagnants.js` (Stockfish, modes `--compter`, analyse,
  `--suites`, `--essai-suites`, `--appliquer`) :
  - `explain.menace` : ce que le coup menace (mat court, prise, promotion) ;
  - `explain.suite` : ligne de Stockfish (`san`, `gagne`/`perdu` ou `mat`),
    ou repli `matEn` (mat force en n) / `avantage` (au moins deux pions).
  1 036 des 1 037 ont une phrase ; le dernier (+1,7) reste muet, c'est voulu.

---

## 4. Ce qui a ete ajoute du 25 au 27 octobre (tout est en ligne)

- **Exercices hors ligne** : cache de donnees du service worker plafonne a
  5 Mo (`DATA_PLAFOND`), eviction du moins recemment utilise, version
  `DATA_VERSION` = empreinte du contenu de `data/` (une publication du seul
  code ne vide plus le cache). `puzzle-index.json` retire.
- **Mesure de la difficulte reelle** : chaque exercice termine ou rate envoie
  `{id, ok}` (reussi du premier coup ou non) a `/api/resultat`, une Pages
  Function (`src/functions/api/`, copiee par le build ; `_routes.json` limite
  les fonctions a `/api/*`). Base D1 `chang64-difficulte`, liee sous `DB`,
  table `resultats(id, essais, reussites)`. `/api/stats` rend les compteurs,
  garde 24 h au cache Cloudflare. Rapport : `node src/difficulte_reelle.js`.
  Exclus : Chang Sprint, erreurs rejouees. Decrit dans la page Confidentialite.
- **Six langues** (session de traduction) : registre `src/langues/registre.js`,
  dictionnaire de l'application `langues/<code>/app.js`, pages statiques
  `langues/<code>/pages.js`, grammaire partagee `src/grammaire.js` (genres,
  cas, pluriels via Intl.PluralRules). Les textes fixes du gabarit sont
  traduits automatiquement (`collectI18n`/`applyI18n` dans `i18n.js`) si leur
  phrase anglaise est dans le dictionnaire. Notation des coups en lettres
  anglaises (Nf3) partout. Polices avec cyrillique et latin etendu (turc,
  polonais), toutes declarees en graisses statiques : une face a plage
  ("400 600") empechait Archivo latin de se charger (corrige le 01/11).
  Deuxieme vague (it, tr, pl, id) : tutoiement (tu, sen, ty, kamu), cas
  polonais et suffixes turcs dans `grammaire.js` ("e4'teki at"). Sources des
  traductions (listes numerotees, scripts d'assemblage) dans les notes de la
  session local_26745fb3, dossier `trad-vague2`.
- **Noms de variantes traduits** : `langues/<code>/variantes.js` (fr, es, pt,
  de, ru, it, tr, pl, id ; 1 005 morceaux, un nom Lichess "A, B" se traduit morceau par
  morceau), lus par `nomVariante()` dans `build_site.js`. Un nouveau nom
  Lichess s'ajoute a la main dans chaque dictionnaire ;
  `tests/check_noms_variantes.js` signale tout manque.
- **Exercice du jour** : facile le lundi, de plus en plus dur jusqu'au
  dimanche (`tirage()` dans `build_site.js`, sept parts de la banque par niveau
  puis diff). Les jours passes restent figes dans `src/exercices-du-jour.json`
  (ne jamais les modifier). `jour.json` a une longueur multiple de 7.
- **Jour suivant** : apres un rattrapage reussi d'un jour passe, bouton
  `#btnDailyNext` dans la barre d'actions collante (libelle court "Jour
  suivant", libelle complet en aria-label).
- **Erreurs a revoir** : la file de repetition espacee (`prog.mistakeQueue`,
  paliers 1-3-7-16 jours) a une carte dans le menu Resoudre et une session
  enchainee (`lancerRevision`, `suiteRevision` dans `ui2.js`).
- **Cloudflare** (fait avec l'accord d'Alexandre) : redirection 301
  `www.chang64.com` -> `chang64.com` ; Browser Cache TTL sur "Respect Existing
  Headers" ; "Managed robots.txt" (bloc anti-IA en tete de `robots.txt`)
  garde, avec `X-Robots-Tag: noindex, nofollow` sur `/engine/*` et un controle
  en ligne qui exige notre `robots.txt` intact apres le bloc Cloudflare.

---

## 5. A faire, idees en attente

Mise a jour le 1er novembre, en cours de session.

**Publie le 01/11 au soir (64dd387e)** : site en italien (`/it/`), turc
(`/tr/`), polonais (`/pl/`) et indonesien (`/id/`), application et pages
statiques ; police Archivo de nouveau chargee (le texte courant s'affichait en
police systeme depuis le 25/10). run_tests 2 487 OK, 0 echec ;
controle_en_ligne 4 937 OK, 16 FAIL tous reseau (fetch failed sur une serie de pages de finales), les 16 reverifiees a la main : 200.

**Publie le 01/11 (903071db, cache chang64-202611011126)** : calendrier du
jour (contours a 1 px, serie verte sans les rattrapages), Makruk, partage
emojis, import Lichess, mesure d'audience. run_tests 2 285 OK puis les deux
tests en defaut corriges ; controle_en_ligne 3 442 OK, 0 FAIL.

Fait le 01/11 (en ligne) :
- **Easter egg Makruk** : porte = le mot ช้าง de l'encadre "L'elephant sur
  l'echiquier" de l'accueil (`#changPorte`). `src/makruk.js` (regles,
  comptage complet, moteur a trois niveaux dans un Worker, partie a deux,
  fiche des regles illustree), servi a part en `/makruk.js?v=empreinte`.
  Test `tests/check_makruk.js` (30 OK). Memoire `makruk-pieces.md`.
- **Mesure des visites** : Cloudflare Web Analytics, active dans le tableau
  de bord en mode "JS Snippet installation" ; jeton `CF_WA_JETON` dans
  `build_site.js`, balise sur toutes les pages, CSP ouverte a
  static.cloudflareinsights.com et cloudflareinsights.com. Page
  Confidentialite mise a jour dans les six langues. Memoire
  `mesure-audience.md`.
- **Partage du resultat de l'exercice du jour** : bouton "Partager mon
  resultat", une ligne d'emojis (un carre par coup : vert du premier coup,
  jaune apres une erreur ou un indice), date avec le jour de la semaine, lien.
- **Import des parties Lichess** : onglet Jouer, panneau PGN ; par pseudo (dix
  dernieres parties standard) ou par lien de partie. CSP connect-src ouverte
  a lichess.org.

Reste a faire, par ordre de priorite suggere :

1. **Recalibrer la difficulte** quand `/api/stats` aura quelques semaines
   d'essais (`difficulte_reelle.js` liste les exercices mal classes ; puis
   l'exercice du jour pourra piocher par difficulte reelle).
2. Langues suivantes : l'arabe (mise en page de droite a gauche, plus cher),
   selon la Search Console et les pays de Web Analytics. Italien, turc,
   polonais et indonesien sont faits et en ligne depuis le 01/11.
3. Cote Alexandre : relecture des traductions par des natifs, surtout le turc
   et le polonais (deuxieme vague). Makruk sur telephone : verifie par
   Alexandre le 01/11, il fonctionne. Test en mode avion sur iPhone : fait le
   01/11, les exercices marchent hors ligne.
4. Petite option : la piece du Bia ngai dans la fiche des regles du Makruk.
5. Taille du depot (214 Mo) : rien a faire avant 1 Go. Deployer depuis
   Cloudflare plutot que versionner `chang64-site` poserait probleme : le
   build ecrit des registres a commiter (dates, exercices du jour figes).

---

## 6. Memoire et autres sessions

- Memoire persistante : `C:\Users\Alexandre Callot\.claude\projects\C--Users-Alexandre-Callot-Desktop-Chang64\memory\`
  (index `MEMORY.md`). La lire au debut : regles d'Alexandre, contournement
  DNS, pieces de makruk, etat des publications.
- Les anciennes sessions liees (traduction, audit, captures triviales...) ont
  fini leur travail ; leurs branches sont fusionnees.

---

## 7. Pousser sur GitHub

Le DNS de la box ne renvoie pour github.com qu'une adresse NAT64 injoignable.
Pour chaque push :

    IP=$(nslookup -type=A github.com 1.1.1.1 2>/dev/null | awk '/^Address/ && !/1\.1\.1\.1/ {print $2}' | head -1)
    IP=${IP:-140.82.121.4}
    git -c http.curloptResolve="github.com:443:$IP" push origin main

Si le push semble echouer, verifier avec `git status -sb` : il est parfois
passe quand meme.
