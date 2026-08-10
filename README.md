# chang64

A free, bilingual (EN/FR) chess website. Live at **https://chang64.com**

Play the built-in engine at any time control, solve engine-verified tactics puzzles,
review your games move by move, and challenge a friend over a plain link. No account,
no tracking cookie, no advertising. Everything runs in the browser.

This repository has three parts.

## [`src/`](src/) : the sources

Everything the site is built from: the chess engine, the interface, the content
generator, the puzzle bank, the opening book, and the test suites.

```
cd src
node build_site.js     # produces src/site/
node run_tests.js      # runs every check
```

Read [`src/README.md`](src/README.md) first. It documents the build, the pitfalls that
have already cost time, and what remains to be done.

## [`chang64-site/`](chang64-site/) : the site as published

The output of `build_site.js`, kept in the repository so that what is online can always
be traced back to a commit. This is the folder deployed to Cloudflare Pages.

Do not edit it by hand: the generator wipes it on every run. Change the sources instead.

## [`design-system/`](design-system/) : the visual identity

Design tokens, chess piece artwork, the elephant mark, and the specification document.
Reference material for anyone adapting the look, not code to run as-is. See
[`design-system/README.md`](design-system/README.md).

---

## Licence

The **code** is released under the **GNU General Public License v3 or later**, see
[`chang64-site/LICENSE`](chang64-site/LICENSE). chang64 distributes Stockfish, itself
GPL v3, which is what makes the licence apply.

The **editorial content** (the written pages, the curated puzzle set, the visual
identity) is **not** covered by that licence and remains the property of the author.
The exact scope is set out in
[`chang64-site/COPYING.CONTENT`](chang64-site/COPYING.CONTENT).

If you fork this to build your own chess site, take the program and replace the
editorial material with your own.

## Third party

- **Stockfish**, GPL v3, by the Stockfish developers.
  https://github.com/official-stockfish/Stockfish
- **Opening names and ECO codes**, from the Lichess opening database, CC0.

---

## Notice en français

chang64 est un site d'échecs gratuit et bilingue : parties contre un moteur intégré,
exercices tactiques vérifiés, revue de partie, et parties entre amis par simple lien.
Sans compte, sans cookie de suivi, sans publicité.

Le dépôt contient les sources (`src/`), le site publié (`chang64-site/`) et l'identité
visuelle (`design-system/`).

Le **code** est sous licence GNU GPL v3 ou ultérieure, parce que le site distribue
Stockfish. Le **contenu éditorial** n'est pas couvert par cette licence et reste soumis
aux droits de son auteur.

---

*chang* (ช้าง) est le mot thaï pour éléphant, l'ancêtre du fou moderne. *64*, ce sont
les cases de l'échiquier.
