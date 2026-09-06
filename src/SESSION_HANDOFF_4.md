# SESSION_HANDOFF_4.md — chang64, session audit + correctifs du 2026-09-05

Fait suite à SESSION_HANDOFF_3.md (session bug-fixing du 05/09, 25 correctifs).
Cette session = **audit complet du site**, puis implémentation des correctifs
identifiés, puis remise à niveau intégrale de la suite de tests.

Le chantier Jouer/Inviter reste volontairement non commencé (voir
PROMPT_FUSION_JOUER_INVITER.md, mis à jour cette session).

---

## 0. Résumé exécutif

| Livrable | État |
|---|---|
| Audit complet du site (9 axes) | fait, en 3 réponses |
| Correctifs implémentés | 24, tous vérifiés au navigateur réel |
| Suite de tests | 40 fichiers, **0 échec**, dont 2 tests de non-régression enfin exécutables |
| Bugs trouvés en implémentant (pas vus à l'audit) | 4 |
| Erreurs d'audit que j'ai corrigées moi-même après mesure | 3 |
| Régressions que j'ai introduites puis rattrapées avant livraison | 3 |

Chiffres clés du build final : **180 pages de contenu, 241 URLs au sitemap**
(contre 465 avant, par retrait volontaire des 224 pages d'ouvertures sans note),
**index.html à 338 Ko**, 147 images de partage générées, poids total 57,6 Mo.

---

## 1. Méthodologie de cette session (à reproduire)

Identique à SESSION_HANDOFF_3, avec deux ajouts importants.

### Build
```
npm install terser jsdom puppeteer-core --no-save   # les 3 ensemble
node build_site.js
```
Vérification obligatoire avant tout build : compter `<!--` vs `-->` dans
`template.html` (commis 2 fois en session 3, 1 fois cette session).

### Nouveau cette session : cairosvg est installable
```
apt-get install -y libcairo2
pip install cairosvg --break-system-packages
```
`og_render.py` échouait silencieusement depuis des sessions ("le module
'cairosvg' est absent"), donc **0 image de partage n'était réellement
générée** — seulement les .svg sources. Deux tests (`check_pieces`,
`check_sante_du_site`) échouaient à cause de ça sans que la cause soit
identifiée. Après installation : **147 converties, 0 échec**. Les deux domaines
nécessaires sont dans la liste blanche réseau.

### Nouveau cette session : la baseline de non-régression existe
`CHANG64_BASELINE` attend une copie du site **déjà en ligne**. Elle n'était pas
disponible... jusqu'à ce qu'on pense au dépôt GitHub public référencé dans les
mentions légales :
```
curl -sL https://codeload.github.com/AlexZ1212/chang64/tar.gz/refs/heads/main -o repo.tgz
tar xzf repo.tgz          # -> chang64-main/chang64-site/  = le build déployé
export CHANG64_BASELINE=/chemin/vers/chang64-main/chang64-site
node tests/check_urls_indexees.js
node tests/check_non_regression.js
```
`api.github.com` est souvent en rate-limit 403 depuis l'environnement ;
`codeload.github.com` et `github.com` répondent 200. Utiliser codeload.

**Résultat capital : 465 URLs indexées vérifiées, aucune perdue.** Le passage
de 465 à 241 URLs au sitemap ne casse aucune adresse existante.

### Test JS pur (jsdom)
Sur `site/index.html`, jamais `template.html`. **Nouveau piège majeur trouvé :**
`fetchJSON` (ui.js) fait un vrai `fetch("/data/level-N.json")` résolu contre
l'URL de base fictive `https://chang64.com/`, donc un **appel réseau réel vers
la production**. Double problème : échoue sans accès sortant, et surtout
testerait les données **déjà en ligne** plutôt que le build local qu'on vient
de générer. Stub à utiliser systématiquement :
```js
function stubFetch(w){
  w.fetch=(url)=>{
    const p=path.join(SITE,String(url).replace(/^https?:\/\/[^/]+/,""));
    try{ const data=JSON.parse(fs.readFileSync(p,"utf8"));
         return Promise.resolve({ok:true,json:()=>Promise.resolve(data)}); }
    catch(e){ return Promise.resolve({ok:false,status:404}); }
  };
}
```

### Test visuel/layout (Puppeteer)
Chromium réel déjà présent :
`/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome`
Obligatoire dès que CSS/scroll/interaction/taille de cible est en jeu. Servir
`site/` via un petit serveur http local (le protocole `file://` fausse les
chemins absolus `/fonts/`, `/data/`).

### Nettoyage
Supprimer `node_modules` et les scripts `test_*.js`/`v_*.png` en fin de
correctif. Ne pas proposer de livrables après chaque fix.

---

## 2. AUDIT — ce qui a été mesuré (et non supposé)

Build complet, 2 passes Puppeteer (390x844 et 1440x900), mesures directes sur
les fichiers générés, recherche web pour le benchmark 2026.

### Constats principaux

**SEO**
- 141 pages Ouvertures quasi identiques : **similarité Jaccard mesurée 0,67 à
  0,88** sur un échantillon de 6. `saragossa-opening` vs
  `creepy-crawly-formation` = 0,87. Volume réel 151-241 mots, moitié de
  boilerplate répété mot pour mot.
- **Seules 29 familles sur 141** ont une note rédigée à la main
  (`FAMILY_NOTES` l.503 et `NOTES_FR` l.471 de build_site.js).
- **Cannibalisation confirmée sur 4 paires** avec H1 strictement identiques :
  `/glossary/pin.html` et `/puzzles/pin.html` (H1 "Pin" des deux côtés), idem
  skewer, back-rank-mate, deflection.
- Contenu mince : `glossary/fork.html` 114 mots, `endgames/rook-vs-king.html`
  145, `puzzles/index.html` 85, `learn/index.html` 173.
- JSON-LD minimal : `Article` sans author/datePublished/dateModified/
  publisher/image/mainEntityOfPage. **Aucun `BreadcrumbList` sur tout le site.**
- Points forts réels : hreflang réciproque avec x-default, canonical propre,
  141 redirections FR, `players/index.html` bien en noindex et hors sitemap.

**Performance**
- `index.html` : 335 Ko brut, **100 Ko gzip**, tout inline (241 Ko JS + 41 Ko
  CSS), zéro script externe. FCP local 237 ms.
- Entrer dans Puzzles déclenche `/data/level-1.json` : **1,9 Mo brut, 363 Ko
  gzip pour afficher un seul exercice.**
- Service worker cache-first sur tout sauf `/engine/`, **sans plafond** :
  17 Mo de shards pouvaient finir en cache (risque d'éviction totale sur iOS).
- Stockfish (7 Mo) bien exclu et chargé à la demande : bon choix.

**Confidentialité — le point le plus sérieux**
La page Confidentialité affirmait "aucun cookie, aucun traqueur". Or **chaque
page chargeait Google Fonts** (935 et 467 références dans le HTML généré,
confirmé par les requêtes réseau observées dans Chromium). Google recevait IP
et user-agent de chaque visiteur, sur toutes les pages. Contradiction frontale
avec la promesse affichée, et c'est le cas sanctionné par le tribunal de Munich
en 2022.

**Accessibilité**
- Les 64 cases avaient `role="button"` **sans nom accessible** (SVG des pièces
  en `aria-hidden`) : un lecteur d'écran en mode navigation annonçait 64 fois
  "bouton". `announceCell()` ne compensait qu'en mode focus, et seulement si
  les annonces étaient activées (pas le défaut).
- `role="tablist"` + 6 `role="tab"` mais **zéro `role="tabpanel"`**.
- Cibles sous le minimum WCAG 2.2 (24x24) : `.info-tip` à 22x22, liens de pied
  de page à 18 px de haut.
- `--brick` (#D9584A) sur `--slate` = **4,34:1**, sous le seuil de 4,5.
- Aucune image sans alt, aucun débordement horizontal à 390 px, zéro erreur JS.

**UX**
- Barre d'onglets débordant à 390 px : "Explore" coupé, deux sections derrière
  un scroll horizontal non signalé. **C'est ce constat qui motive la mise à
  jour du prompt de fusion Jouer/Inviter** (voir livrable E).
- Rangée de cadences de l'accueil : **débordement de 80 px**, la 6e pastille
  ("Sans pendule") hors écran sans aucun signalement.
- Statut obsolète en mode Inviter : "Choisis ta couleur, puis crée la partie"
  alors que le choix de couleur est passé en modale le 04/09.

**Benchmark (recherche web, sources 2026)**
- Lichess propose déjà Puzzle Storm (3 min), Puzzle Streak, tableau de bord :
  le Chang Sprint est un équivalent, pas un différenciant.
- Le **Blind Mode** de Lichess est très en avance (guide NVDA/JAWS/VoiceOver/
  Orca, développement actif en 2026 : "Get Hint" annonçant la coordonnée,
  correction de Puzzle Streak en Blind Mode). chang64 a une base saine mais
  incomplète.
- Le vrai différenciant défendable : zéro compte, zéro requête tierce, partie
  entre amis entièrement dans un lien sans serveur.
- **Risque éditorial 2026** : les requêtes informationnelles ont perdu 30-40 %
  de trafic organique, et ce sont précisément les pages de définitions
  ("Qu'est-ce que X ?") les plus touchées. Un Lexique de 43 entrées de 114 mots
  est exactement ce profil. Ce qui survit : les pages où l'utilisateur doit
  venir pour obtenir le résultat, c'est-à-dire les pages interactives.

---

## 3. CORRECTIFS IMPLÉMENTÉS (ordre chronologique)

### Accessibilité

1. **`aria-label` par case sur l'échiquier** — nouveau helper `sqLabel(sq,p)`
   dans ui.js, appelé dans la boucle de `render()`. Produit "e4" sur case vide,
   "cavalier blanc en f3" / "white knight on f3" sur case occupée, dans la
   langue courante. **Piège géré :** `pieceWord()` vit dans ui3.js et lit
   `PIECE_WORDS`, une `const` ; au tout premier `render()` de l'init, ui3.js
   n'est pas encore évalué et cette const est en zone morte temporelle. D'où le
   `try` avec repli sur le seul nom de case.
   *Vérifié : 64/64 nommées, EN et FR.*

2. **Accord en genre en français** — trouvé en vérifiant le point 1 :
   `announceCell()` disait "tour blanc en h1". "Tour" et "dame" sont féminins.
   Nouveau `sideWord(ch,isWhite)` dans ui3.js + `PIECES_FEM={r:true,q:true}`,
   utilisé aux deux endroits. Pour un lecteur d'écran c'est la seule
   information prononcée, donc ça compte.

3. **Cibles tactiles ≥ 24 px** — `.info-tip` 22→24 px, `.linkbtn` padding
   `2px`→`6px 2px`, `.footnav a` en `inline-block` + `padding:6px 2px`
   (build_site.js). *Vérifié : zéro élément interactif sous 24 px.*

4. **Contraste `--brick`** — `#D9584A` → **`#E4776A`** : 4,94:1 sur `--raise`,
   5,69:1 sur `--slate`, 6,32:1 sur `--ink`, et 6,32:1 pour du texte sombre
   posé dessus (usages inverses préservés). Visible sur la pendule en zone
   rouge et le chrono Coordonnées.

5. **Patron ARIA des onglets → navigation** — décision prise avec Alexandre.
   `role="tablist"` promet des `tabpanel` autonomes, or **le plateau est
   partagé** entre Jouer/Résoudre/Analyser/Inviter : il vit hors des panneaux,
   aucun tabpanel honnête n'était possible. Passage à `<nav>` +
   `aria-current="page"`. Les 10 endroits qui écrivaient `aria-selected`
   chacun à leur façon (ui.js, ui2.js, ui3.js) passent par un `markTab()`
   unique. CSS mis à jour (`[aria-current="page"]`). 4 assertions de tests
   mises à jour.
   **Conséquence assumée :** la navigation aux flèches que j'avais ajoutée le
   matin même a été **retirée** — elle avait du sens sous `tablist`, elle
   serait une surprise dans une `<nav>` où un lecteur d'écran réserve ces
   touches à la lecture du texte.

### Confidentialité

6. **Polices auto-hébergées** — les six woff2 latin fournis par Alexandre
   (`fonts/`), copiés au build vers `/fonts/`, déclarés en `@font-face`.
   `font-display:swap` côté app, `optional` côté pages de contenu (raisonnement
   anti-reflow du menu conservé).
   **Trois pièges rencontrés et corrigés :**
   - URL absolue `${SITE}/fonts/...` au premier jet → cassait tout aperçu hors
     production (branche Cloudflare Pages, local). Passé en chemin relatif à la
     racine `/fonts/...`.
   - Balise `<style>` séparée → **plusieurs tests lisent "le premier bloc
     `<style>`"** et cherchaient donc les règles CSS dans le mauvais bloc
     (11 échecs dans `check_pied_de_page`). Les `@font-face` sont désormais
     **dans le même `<style>`** que le reste du CSS, aux deux endroits.
   - Commentaire HTML fermé par `*/` au lieu de `-->` (le piège récurrent).
   *Vérifié au navigateur : 12 polices chargées (6 app + 6 contenu), **zéro
   requête externe** sur les deux surfaces.*

7. **CSP resserrée** — retrait de `static.cloudflareinsights.com` (script-src),
   `cloudflareinsights.com` (connect-src), puis `fonts.googleapis.com` et
   `fonts.gstatic.com`. La politique fait maintenant respecter la promesse
   d'elle-même. **Alexandre a confirmé que Cloudflare RUM est désactivé**, donc
   la page Confidentialité est exacte sur ce point et n'a pas eu à être
   réécrite.

### SEO

8. **`BreadcrumbList` sur toutes les pages** — déduit du canonical dans
   `shell()` plutôt que passé par chacun des 8 générateurs. 3 niveaux sur les
   pages de détail, 2 sur les index. *Vérifié : 466 pages sur 467 en ont un ;
   la seule sans est `index.html`, l'application, ce qui est correct.*

9. **`noindex,follow` sur les 112 ouvertures sans note** (224 pages, 2 langues).
   Les 29 familles avec note restent indexables. **Pilotage automatique** par
   `FAMILY_NOTES`/`NOTES_FR` : écrire une note remet la page à l'index ET au
   sitemap au build suivant, sans toucher au code. Sitemap filtré sur la même
   condition (déclarer au sitemap une page en noindex est un signal
   contradictoire remonté par la Search Console).

10. **H1 distincts contre la cannibalisation** — les pages Motifs gardent le mot
    nu ("Pin", "Clouage"), le Lexique annonce ce qu'il est ("Pin: definition",
    "Clouage : définition"). Appliqué aux 43 entrées, pas seulement aux 4 en
    conflit, pour l'homogénéité de la rubrique et couvrir les collisions
    futures. Le nom nu reste dans le JSON-LD `DefinedTerm` et la grille d'index.

11. **JSON-LD enrichi** — `author`, `publisher`, `dateModified`,
    `mainEntityOfPage`, `image`, `isPartOf` ajoutés dans `shell()` sans jamais
    écraser ce qu'un générateur a posé. **`datePublished` volontairement non
    inventé** : sans date de première publication fiable par page, mieux vaut
    ne rien déclarer que déclarer faux.
    *Piège géré :* `BUILD_DATE` et `PUBLISHER` déclarés **en haut** de
    build_site.js, car `shell()` les lit pendant la génération, bien avant la
    fin du script (zone morte temporelle sinon). `today` du sitemap pointe
    désormais sur `BUILD_DATE` : une seule source de date.

### Contenu

12. **CTA `#line=` sur les pages Pièges** (6 par langue). Sur les pièges qui
    finissent par un mat, le lien **s'arrête un demi-coup avant** et le libellé
    devient "À toi de porter le coup décisif" : déposer le lecteur sur une
    partie déjà terminée n'a aucun intérêt, lui laisser porter le coup est le
    seul moment où la page devient un exercice.

13. **Diagramme du Lexique retourné** (dette signalée le 04/09). Le camp au
    trait se lit dans le 2e champ de la FEN, même source que les pages Motifs,
    donc légende et orientation ne peuvent pas se contredire. La légende
    annonce désormais le trait. *Contrôle croisé automatique : 20 légendes
    cohérentes avec la FEN, 0 incohérence.*

14. **Les 34 entrées de Lexique sans exercice** ne renvoyaient que vers
    l'accueil nu, **sans même un retour vers l'index**. Elles expliquent
    maintenant pourquoi il n'y a pas d'exercice et offrent 3 sorties.

### UX

15. **"Sans pendule" retiré de la rangée d'accueil** — débordement ramené de
    80 px à 3 px. Exception : si c'est la catégorie actuellement choisie
    (réglée depuis Jouer, l'état étant partagé), elle s'affiche quand même,
    sinon l'accueil montrerait "0+0" sans bouton marqué.

16. **Statut Inviter corrigé** — "Choisis un rythme, puis crée la partie",
    avec la clé i18n mise à jour.

17. **Icône de partage écrasée par le flex** — **mon diagnostic d'audit était
    faux.** Le tracé SVG Messenger était parfaitement correct (vérifié isolé à
    120 px). Le vrai coupable : dans `.shareRow button`, le SVG est un élément
    flex comme le libellé, et sans `flex:none` il est comprimé quand le texte
    ne tient pas. **Mesures réelles : Messenger 4x15, WhatsApp 9x15,
    Telegram 15x15.** J'ai annulé ma réécriture du tracé (inutile) et ajouté
    `.shareRow button svg{flex:none}`. Les trois font maintenant 15x15.

### Technique

18. **Shards `/data/` exclus du service worker** (à la source dans
    build_site.js). Cache-first sans plafond sur 17 Mo exposait à une éviction
    du cache entier sur iOS, coquille de l'app comprise.

19. **Bug latent : route `#line=` tronquée en silence** — le motif filtrait sur
    `[A-Za-z0-9_+#=-]`, **sans `%`**, alors que la valeur est encodée à la
    source et passée à `decodeURIComponent`. Toute ligne contenant un échec
    (`Qb4+` → `Qb4%2B`) était tronquée à la première occurrence, avec repli sur
    "aucun coup valide". Invisible jusqu'ici car seules les pages Ouvertures
    utilisaient cette route et leurs lignes principales n'ont presque jamais
    d'échec. **Les pages Pièges, elles, en sont pleines.**
    **Régression que j'ai introduite en corrigeant :** ajouter `%` ouvrait la
    porte à `decodeURIComponent("%%%")` → `URIError` non capturée qui arrêtait
    l'initialisation. Cas couvert littéralement par
    `tests/check_liens_corrompus.js` (`#line=%%%`). Décodage mis sous garde.

20. **`lier()` sautait un mot sur deux** (i18n.js) — trouvé en toute fin de
    session. Le motif consomme l'espace **qui précède** le mot ; après avoir
    traité "par" dans "par le moteur", le balayage reprend sur "le" sans espace
    disponible devant lui. Corrigé par rejeu jusqu'à stabilisation, borné à
    5 tours (sans borne, une règle mal modifiée un jour pourrait boucler sans
    fin sur une chaîne du site). *Vérifié : aucun débordement introduit
    (`check_debordement_horizontal`, `check_largeur_page` verts).*

---

## 4. SUITE DE TESTS — remise à niveau intégrale

**40 fichiers, 0 échec.** Détail de ce qui a été réparé.

### Tests que mes changements ont rendus faux (corrigés)
- `check_pied_de_page` — double `<style>` (11 échecs). Cause et correctif au §6.
- `check_pages_ouvertures_bilingues` — supposait toutes les pages FR au
  sitemap. Vérifie maintenant la vraie règle : indexable ⇔ au sitemap, ET
  aucune page en noindex déclarée.
- `check_seo_entete` — les assertions décrivaient le mécanisme
  `preload`/`onload`/`noscript` de Google Fonts, disparu avec sa cause.
  Remplacées par : ≥6 `@font-face`, `font-display:swap`, aucune origine Google.
- `check_navigation_sections` — contrôlait `display=optional` dans l'URL Google
  Fonts ; porte désormais sur `font-display` dans les règles locales.

### Tests obsolètes depuis des sessions antérieures (dette résorbée)
- `check_navigation` — échouait sur `tab-train`, onglet supprimé le 03/09. Un
  FAIL permanent finit par masquer les vrais : entrée morte retirée.
- `check_actions_exercices` — `btnDaily` devenu `cardSolveDaily`, `btnReset`
  déplacé sur l'écran menu. **Une assertion passait à tort** : `pos()` renvoie
  `1e9` pour un introuvable, donc "Exercice du jour après" validait sur un
  élément absent. Un faux succès est pire qu'un échec.
- `check_typographie_boutons` — 3 assertions sur des libellés disparus.
  Remplacées par un contrôle générique de la règle elle-même (ne se périmera
  plus au prochain changement de libellé) + un contrôle positif garantissant
  que la règle s'exerce quelque part.
- `check_chiffres_annonces` — attendait "51619 verified positions" sur la tuile
  Explorer, changé volontairement le 04/09.
- `check_overlay_et_verrouillage` — plantage sur `tab-train`.
- `check_pieces` / `check_sante_du_site` — échouaient faute de `cairosvg`
  (voir §1).

### Les 3 fichiers fournis par Alexandre
- **`check_hasard_exercices.js`** → corrigé, 3 OK. Trois causes distinctes :
  clic manquant sur `cardSolvePuzzles`, appel réseau réel (stub ajouté), et
  surtout **une fausse hypothèse** : le test exigeait qu'aucun exercice ne se
  répète avant d'avoir vu tout le niveau, alors que le code plafonne
  volontairement `prog.seen` à **200** entrées. Sur un niveau de 7214
  exercices, c'était mathématiquement intenable. Réécrit sur la garantie
  réelle : pas de répétition dans une fenêtre glissante de 200.
- **`check_exercices_interface.js`** → remis à neuf, **112 OK**. Après audit
  assertion par assertion, il couvre des régressions réelles et **uniques**
  (variété de la file du Sprint, navigation de revue, une seule épreuve à la
  fois) introuvables ailleurs : je l'ai mis à jour au lieu de l'archiver.
  12 points d'entrée `tab-train` redirigés vers `cardSolveSprint`/
  `cardSolveCoord`. Global `PUZZLES` mort remplacé par `PUZZLE_CACHE["p23"]`
  (niveau 4, thème "Winning capture", `explain.piece` — vérifié présent).
  Deux échecs finaux dus à la même règle documentée : **depuis le 03/09,
  `tab-puzzles` affiche toujours le menu, jamais directement un exercice.**
- **`check_recherche_exercices.js`** → **archivé** dans `tests_archived/`,
  remplacé par `check_index_motifs.js` (12 OK). Ce n'était pas un point
  d'entrée démodé : la recherche en direct sur la grille complète a été
  **volontairement abandonnée** en août pour cause de mise à l'échelle
  (documenté dans content.js). Forcer ce test à passer aurait vérifié autre
  chose que ce pour quoi il avait été écrit. Le nouveau fichier couvre l'index
  actuel à 10 tuiles, qui n'avait **aucune** couverture.

### Les 17 exercices "désynchronisés" — fausse alerte, corrigée dans le test
`check_banque_exercices` signalait 17 exercices dont le code ne correspond pas
à la dérivation directe. **Vérification : les 17 sur 17 entreraient en
collision** si on régénérait naïvement. Ce sont les collisions de hash résolues
lors du nettoyage de la banque. Schéma reconstitué par rétro-ingénierie :
**`fen|solution|N`**, N incrémenté jusqu'à trouver un code libre — il explique
17 cas sur 17. L'ancienne assertion demandait donc littéralement de **recréer
les collisions qu'on venait de résoudre.** Le test accepte maintenant un code
dérivé directement ou par variante anti-collision, avec un garde-fou : si les
variantes salées dépassaient 0,1 % de la banque, ce serait le signe d'un
problème dans la dérivation elle-même.

---

## 5. MES PROPRES ERREURS (à connaître pour ne pas les refaire)

Trois diagnostics d'audit se sont révélés faux à la mesure. Documentés parce
qu'ils sont instructifs :

1. **Icône Messenger** — j'ai annoncé un tracé SVG malformé. Le tracé était
   correct ; c'était le flex qui l'écrasait. **Leçon : vérifier un élément
   isolé avant d'accuser son contenu.**
2. **"Daily vs No clock"** — j'ai annoncé une incohérence de vocabulaire. Ce
   sont deux catégories distinctes ; le vrai problème était une pastille hors
   écran. **Leçon : mesurer avant de qualifier.**
3. **Espace insécable des cartes du menu** — j'ai annoncé que les descriptions
   n'y avaient pas droit. **C'était un artefact de ma propre regex boguée :
   en JavaScript, `\s` inclut `\u00a0`**, donc mon détecteur signalait
   précisément les libellés corrects. Vérification au DOM : titres ET
   descriptions contiennent bien l'insécable. En creusant l'erreur, j'ai
   toutefois trouvé le vrai bug de `lier()` (§3.20).

---

## 6. PIÈGES DE CODE À NE PAS REFAIRE (nouveaux, en plus de ceux des handoffs 1-3)

- **`\s` en JavaScript inclut l'espace insécable `\u00a0`.** Toute regex
  cherchant "un mot suivi d'une espace ordinaire" doit utiliser `\u0020`
  explicitement, sinon elle signale les cas corrects.
- **Un seul bloc `<style>` par page.** Plusieurs tests lisent "le premier
  `<style>` trouvé". Ajouter une balise séparée décale silencieusement ce
  qu'ils inspectent. Toute nouvelle règle CSS va dans le bloc existant.
- **`fetchJSON` fait un vrai appel réseau sous jsdom.** Toujours stubber
  `w.fetch` vers `site/data/`, sinon on teste la production au lieu du build.
- **`pos()` renvoie `1e9` pour un élément introuvable** dans les tests de
  position : une comparaison `>` sur un élément supprimé **passe à tort**.
  Toujours vérifier l'existence avant de comparer des positions.
- **`decodeURIComponent` lève sur une séquence pourcent invalide.** Toute
  route acceptant `%` doit mettre le décodage sous garde.
- **Zone morte temporelle inter-fichiers** : une `const` de build_site.js lue
  par `shell()` doit être déclarée en haut du fichier ; une `const` de ui3.js
  lue depuis ui.js pendant l'init doit être protégée par un `try`.
- **Chemins d'assets relatifs à la racine, jamais absolus au domaine** : figer
  `https://chang64.com/...` casse les aperçus de branche et le local.
- Rappel toujours valable : commentaire HTML fermé par `*/` au lieu de `-->`
  (commis encore une fois cette session).

---

## 7. ÉTAT FINAL VÉRIFIÉ

- Build propre : 180 pages, 241 URLs sitemap, index.html 338 Ko, 147 images de
  partage réellement générées, 57,6 Mo.
- **40 fichiers de tests, 0 échec**, y compris les 2 tests de non-régression
  enfin exécutables via la baseline GitHub.
- **465 URLs indexées vérifiées, aucune perdue.**
- Zéro requête réseau externe sur l'application comme sur les pages de contenu.
- Cloudflare RUM confirmé désactivé par Alexandre.

## 8. RESTE À FAIRE

**Décision prise, pas encore implémentée**
- Découpage des shards de puzzles (363 Ko gzip pour un exercice) — session
  dédiée, c'est le plus gros chantier de perf restant.

**En attente d'arbitrage**
- Route `#fen=` pour débloquer les CTA des 19 pages Apprendre (0 CTA profond
  aujourd'hui). C'est une vraie fonctionnalité, pas un correctif : je ne l'ai
  pas inventée sans validation.
- Fil d'Ariane des pages Lexique : affiche "Pin · chess term explained" (repris
  du `<title>`). Correct mais long dans un résultat de recherche. Une ligne à
  changer dans `shell()` si tu préfères "Pin" tout court — touche 466 pages,
  donc choix éditorial.

**Chantier planifié**
- Fusion Jouer/Inviter : voir `PROMPT_FUSION_JOUER_INVITER.md`, mis à jour avec
  le constat de débordement de la barre d'onglets.

**Avant de pousser**
- Garder une copie du `chang64-site/` actuellement sur GitHub : c'est la
  baseline de non-régression, elle sera écrasée au prochain push.
