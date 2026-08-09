# chang64

A free, bilingual (EN/FR) chess website: play against a bot, solve tactics puzzles,
review your games, and browse a library of openings, endgames, traps and rules.

Live at **https://chang64.com**

The name comes from *chang* (ช้าง), the Thai word for elephant, and the 64 squares of
the board. The elephant was the piece that, over centuries, became the modern bishop.

---

## What is in here

- A chess engine written from scratch, validated against standard perft tests
- Four bot difficulty levels with bullet, blitz, rapid, classical and daily time controls
- 489 engine-verified tactics puzzles, with adaptive difficulty, theme filter and Puzzle Rush
- Game review with an evaluation graph and a verdict on every move
- PGN import and export, opening detection, game history stored in the browser
- Endgame trainer and coordinate drill
- Friend games over a shared link, with no server involved
- 1,353 static content pages in English and French
- Progressive Web App: installable, works offline
- Optional Stockfish 18 integration for stronger analysis

No account, no tracking cookie, no advertising. Everything runs in your browser.

---

## Licence

### Code: GNU General Public License v3.0 or later

    chang64 - a free chess website
    Copyright (C) 2026 AlexZ1212

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.

The full text is in [LICENSE](LICENSE).

chang64 is licensed under the GPL because it distributes Stockfish, which is itself
GPL v3 software. See the attribution below.

### Editorial content: all rights reserved

The GPL above covers the **program**. It does not cover the editorial and creative
material distributed alongside it, which remains the property of its author. The exact
scope is set out in [COPYING.CONTENT](COPYING.CONTENT), and covers in short:

- the written content of the 1,353 pages, in both languages
- the puzzle set and its curation
- the opening notes and commentary
- the visual identity: logo, elephant mark, chess piece artwork, colour system

These may not be reproduced, republished or redistributed without permission. If you
fork this repository to build your own chess site, remove that material and use your own.

Opening names and ECO classification derive from the Lichess opening database, which is
published under CC0.

---

## Stockfish attribution

chang64 bundles a WebAssembly build of **Stockfish 18** in `engine/`.

Stockfish is a free and open source UCI chess engine, copyright the Stockfish
developers, released under the GNU General Public License v3. Its own licence text is
kept alongside the binary in `engine/LICENSE-GPLv3.txt`.

- Project: https://stockfishchess.org
- Source: https://github.com/official-stockfish/Stockfish

Stockfish is optional in chang64. It is not loaded until the user enables it, and it is
deliberately excluded from the offline cache because of its size. The built-in engine is
used everywhere else.

---

## Building

The site is generated as static files by `build_site.js` and deployed to Cloudflare
Pages. There is no backend, no database and no build-time secret.

```
node build_site.js
```

The generated site lands in the output directory, ready to upload as-is.

---

## Notice en français

chang64 est un site d'échecs gratuit et bilingue : parties contre un bot, exercices
tactiques, revue de partie, et une bibliothèque d'ouvertures, de finales, de pièges et
de règles.

Le **code** est publié sous licence GNU GPL v3 ou ultérieure, parce que le site
distribue Stockfish, lui-même sous GPL v3. Il peut donc être étudié, modifié et
redistribué, à condition de conserver la même licence.

Le **contenu éditorial** (les textes des 1 353 pages, la base d'exercices, l'identité
visuelle) n'est pas couvert par la GPL et reste soumis aux droits de son auteur. Le
détail figure dans [COPYING.CONTENT](COPYING.CONTENT).

---

Repository: https://github.com/AlexZ1212/chang64
