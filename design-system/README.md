# Handoff: chang64 visual identity

## Overview

A complete visual identity for **chang64.com** — a free chess site (engine play, 489 tactics
puzzles, endgame drills, friend links, 1300 static content pages, EN/FR, mobile-first, no
build step). This bundle replaces the site's existing twelve CSS variables, its chess piece
set, its board treatment and its logo.

*Chang* (ช้าง) is Thai for elephant — the ancestor of the modern bishop. *64* is the number
of squares. The elephant is the mark; it appears exactly once.

**Direction in one line:** keep the chess-club register, drop the club-room pastiche. Green
felt and brass fittings are set dressing; the thing that actually reads as a serious club is
discipline — notation kept properly, the engine put away during play, nothing decorative on
the board. The ground moves from felt to *ink*, the board becomes the highest-contrast object
on screen, and brass stays as the single warm accent.

---

## About the design files

The files in this bundle are **design references**, not production code to paste in.

- `chang64-identity-spec.dc.html` is the full specification document as an HTML page. Open it
  in a browser. It is the authoritative visual reference — every value below is shown there
  rendered.
- `tokens.css`, `board-states.css`, `pieces.js` and the three SVGs **are** paste-ready
  artefacts. They contain the real values and geometry, and are intended to be adapted into
  the site's existing single-file, no-build structure (inline them if that is how the site
  works today).

The task is to bring these values and shapes into chang64's existing environment using its
established patterns — not to ship this HTML.

## Fidelity

**High-fidelity.** All colours, type, geometry and state treatments are final and measured.
The piece paths and the mark are finished artwork. Reproduce the values exactly.

---

## Design tokens

Twelve tokens, replacing the twelve currently in use. See `tokens.css` for the paste-ready
block including the light theme.

| Token | Value | Role |
|---|---|---|
| `--ink` | `#101413` | Page ground. Near-black with a green cast. |
| `--slate` | `#191F1D` | Panels, cards, scoresheet. |
| `--raise` | `#232B28` | Buttons, inputs, chips at rest. |
| `--chalk` | `#ECEAE3` | Primary text. |
| `--sage` | `#97A49D` | Secondary text. |
| `--bone` | `#EDE4D2` | Light square. Also the light-theme ground. |
| `--board` | `#4B6B63` | Dark square. |
| `--brass` | `#E0A93B` | Accent, active state, highlights. |
| `--jade` | `#5FBF92` | Win, correct, best move. |
| `--brick` | `#D9584A` | Loss, error, blunder, check. |
| `--rule` | `rgba(236,234,227,.12)` | Every hairline and divider. |
| `--r` | `8px` | Base radius (down from 10). |

### Contrast, measured

| Pair | Ratio |
|---|---|
| chalk on ink | 14.7:1 |
| sage on ink (secondary body) | 7.2:1 |
| brass on ink (small text) | 8.8:1 |
| ink on brass (button label) | 8.8:1 |
| brick on ink | 4.8:1 |
| jade on ink | 8.2:1 |
| bone vs board (the two squares) | 4.71:1 |

The two square colours are ~48 points apart in L\* and sit on opposite sides of the warm/cool
axis. Under deuteranopia and protanopia they hold above 4.5:1, because the difference was
never carried by hue. That is why the dark square is teal rather than green.

### Light theme — complements dark, does not replace it

Dark for `/play`, `/puzzles`, `/train`. **Light for the 1300 static content pages**, which
arrive cold from search and are read in daylight. Same token names, same roles, different
values (`.doc` block in `tokens.css`). Board colours are identical in both themes, so a
diagram cut from a content page and a live board are the same object.

Note `--brass` darkens to `#7E5409` in the light theme (5.4:1 on bone) — the dark-theme brass
fails on a light ground.

---

## Typography

Three faces, all on Google Fonts. Two of them are already in use on the site.

- **Display — Source Serif 4** (replaces Fraunces). Flatter and calmer; holds at 14px, which
  matters because 1300 pages are long-form.
- **Interface — Archivo** (unchanged).
- **Data — JetBrains Mono** (unchanged). Clocks, notation, codes, drill HUD.

| Style | Face | Weight | Size | Line-height | Tracking |
|---|---|---|---|---|---|
| h1 | Source Serif 4 | 600 | 34px mobile → 44px ≥900 | 1.1 | −.015em |
| h2 | Source Serif 4 | 600 | 22px mobile → 26px | 1.22 | −.01em |
| body | Archivo | 400 | 16px | 1.55 | — |
| small | Archivo | 400 | 13px | 1.45 | — |
| label | Archivo | 600 | 13px uppercase | — | .08em |
| data | JetBrains Mono | 500 | 14px | — | .02em, tabular-nums |
| clock | JetBrains Mono | 600 | 28px | — | tabular-nums |
| drill HUD | JetBrains Mono | 700 | 52px mobile → 72px | 1 | .02em |

### The French rule

French runs 15–20% longer than English. Size every button, chip and segment by **padding,
never width**; give each `min-height: 44px` and allow the label to wrap to two lines at
`line-height: 1.15`. Segmented controls use `grid-template-columns: repeat(N, 1fr)` so EN and
FR occupy the same footprint. Test string: *"Abandonner la partie"* (20 chars) against
*"Resign"* (6).

### Spacing, radii, elevation

- Spacing: `4 8 12 16 24 32 48` — only these.
- Radii: `var(--r)` 8px for chips/buttons/inputs; `calc(var(--r)*1.5)` 12px for cards and
  panels; `2px` for board squares and scoresheet cells; `999px` for pills only.
- Elevation: two levels. `--e1` for raised surfaces; `--e2` **only** for the promotion picker
  and the result card. Everything else separates with `--rule` plus a background step.

---

## The pieces

`pieces.js` — six shapes, each an ordered array of path `d` strings in a **45×45 viewBox**,
origin top-left, baseline y=37.

Rendering contract:

```html
<g fill="#F7F4EC" stroke="#15201C" stroke-width="1"
   stroke-linejoin="round" stroke-linecap="round"> …paths… </g>
```

- **light**: fill `#F7F4EC`, stroke `#15201C`
- **dark**: fill `#15201C`, stroke `#D8D2C4`

### Two changes from the current implementation — both deliberate

1. **`stroke-width` is 1, not 1.5.** At 1.5 the outline is more than half the height of the
   collar ring and every seam between paths renders as a bar. At 1 it stays a hairline and the
   silhouette does the work.
2. **Render the 45 viewBox at 100% of the square, not 86%.** The artwork is drawn to fill the
   box; at 86% the pieces float.

### Construction

Every piece is a turned profile — concave waists, ball finials — carried entirely by the
outline, so there is no shading to lose and no fine detail to blur at 40px. All six stand on
the same two shared paths, `COLLAR` and `FOOT`, which are always the last two entries in the
array. The base takes about a fifth of the height, so the mass sits up where the identifying
happens.

Silhouettes are ranked so no two share a family: pawn (round), rook (square), bishop (ovoid),
knight (asymmetric), queen (spiked), king (broad + cross).

- **Bishop** — the mitre cut is a real cut: it interrupts the outer silhouette on the upper
  right, both edges are parallel, and the bottom of the slot is a straight flat end. Its angle
  matches the trunk in the mark. That is the only echo of the elephant in the piece set.
- **Knight** — the only asymmetric silhouette: an S on its left edge (nose out, throat scooped
  in, chest out again), plus three interior marks (mane, eye, nostril) that no other piece
  carries. That lean and that detail are what keep it apart from the bishop at 26px.

### `<use>` / `<symbol>` caveat

If you define the pieces as `<symbol>` and instantiate with `<use>`, **fill and stroke
inherited from an ancestor `<g>` will not reach the symbol's contents in Chromium** — the
paths render black. Either put `fill`/`stroke` on the `<symbol>` element itself (two symbols
per piece, light and dark), or inline the paths at each site. This is noted in `pieces.js`.

### Server-side rendering

The same paths render onto the 1300 static diagram pages. They have no CSS dependency — every
colour is an attribute on the wrapping `<g>`.

---

## The board

Light square `--bone` `#EDE4D2`, dark square `--board` `#4B6B63`. Outer board corners `2px`;
individual squares are square. Coordinates are **on permanently, not a setting**: JetBrains
Mono 500 at 9px in the square corner, coloured as the opposite square colour.

### Four channels, so nothing collides

Ten overlay states that can stack is a layering problem, not a colour problem. Each state gets
one physical layer of the square and may not draw anywhere else. Within a channel, one state
wins; across channels they simply coexist. See `board-states.css`.

| Channel | Layer | States allowed |
|---|---|---|
| 1 — wash | flat tint over the whole square | last move (brass 42%), selected (brass 62%), puzzle correct (jade 50%), puzzle wrong (brick 50%). Never more than one; latest wins. |
| 2 — inset edge | border drawn inside the square | selected (3px solid brass), hint and engine suggestion (2px brass, 1.6s pulse), keyboard focus (2px dashed chalk, inset 3px) |
| 3 — centre mark | shape at the centre, under the piece | legal move (dot, 26%, ink 30%), legal capture (ring, 11% inset, ink 32%) |
| 4 — glow | radial bleed from the centre | **check only** — permanently reserved, so a king in check is never ambiguous |

A selected piece, on the last-move square, in check draws a brass wash + a red radial glow + a
3px brass inset edge. Three channels, no conflict.

Two rules worth keeping:

- Legal-move marks are **neutral ink, not brass** — legality is not a state the player chose.
- Keyboard focus is **chalk, not brass** — it has to survive sitting on a brass square.

### Full z-order inside one square

```
1  square fill        --bone | --board
2  wash               brass .42 last · brass .62 selected · jade .50 · brick .50
3  glow (check)       radial-gradient(circle, brick .95, brick .55 45%, transparent 78%)
4  centre mark        dot 26% ink .30  ·  ring inset 11% ink .32
5  piece              the SVG
6  inset edge         3px solid brass · 2px brass pulse · 2px dashed chalk inset 3px
7  coordinate         mono 500, 9px, corner, colour = the opposite square colour
```

### Never colour alone

| State | Colour | Non-colour signal |
|---|---|---|
| check | brick glow | the word "Check" in the status line + announced to screen readers |
| correct | jade wash | a check glyph in the status line |
| wrong | brick wash | a 420ms ±4px board shake + a cross glyph |
| best move | jade | the label "best" |
| blunder | brick | "??" in the scoresheet |

### Motion

**One rule: pieces move in 130ms ease-out; everything else in the interface is 0ms or 160ms
opacity.** No slides, no scales, no springs. A chess site whose UI moves more than its pieces
has its priorities wrong — and it makes the reduced-motion fallback nearly free.

Reduced-motion stills: pulsing outlines become a static 2px brass at 70% opacity; the wrong-
answer shake is dropped and the wash held 600ms longer.

---

## Components

### Locked during play — a rule, not a bug

Review, hint and analysis are disabled while a game is live. Render them with a **dashed**
border (`1px dashed rgba(236,234,227,.22)`) on `--raise`, label in `--sage`, plus a sentence
beside them: *"Available when the game ends. No engine help during play — house rule."*

A solid disabled button reads as broken; a dashed one reads as *not yet*. **No padlock icon** —
padlocks say paywall. The sentence is part of the component, never a tooltip; on mobile it
wraps underneath.

### Armed destructive button (Resign)

- Rest: transparent, `1px solid rgba(217,88,74,.5)`, label `--brick`, weight 600.
- Armed (5s): filled `--brick`, label `--ink` weight 700, text changes to "Confirm resign",
  a mono seconds digit at 70% opacity, and a 2px hairline draining along the bottom edge.
- Reverts on its own.

The fill is the confirmation affordance and is the only filled brick surface in the product.
The countdown is a bar **and** a digit, so the timeout is not conveyed by motion alone.

### Segmented controls vs chips — two different treatments

- **Segmented** ("which of these": colour, engine strength, language, orientation): a 4px
  padded track on `--ink` with `--rule` border; selected segment is a filled brass slab with
  ink text at weight 600; unselected is `--sage` at weight 500. `repeat(N, 1fr)` columns.
- **Chips** ("these are on": time controls, endgames, daily pace): `--raise` with a `--rule`
  border; selected is a brass outline plus a 14% brass tint with brass text.

Both `min-height: 40px` inside a 44px hit target.

### Scoresheet

Ruled cells, a 34px number gutter, `--rule` hairlines, mono 13.5px, tabular figures. The move
being viewed gets a brass tint (16%) **and** a 2px brass left rail — position as well as
colour. Annotations carry their own colour and glyph: `?!` inaccuracy (brass), `?` mistake
(brick), `??` blunder (brick).

### Coordinate drill strip

Sticky, 76px tall, `--ink` background with a `--rule` bottom hairline so it separates from the
board as it scrolls under. The square to find is mono 700 at 52px mobile / 72px in `--brass` —
the largest type in the product, deliberately, because at arm's length on a phone it must be
readable without focusing. Seconds, correct (jade) and missed (brick) sit beside it at mono
600 22px with 11px uppercase labels.

### Result overlay

The board dims to `rgba(16,20,19,.74)` — **dimmed, not blurred**, so the final position stays
legible behind the card; people want to see the mate. A `--slate` card, `--rule` border,
`--e2` shadow, and a 3px left rail in jade / brick / sage depending on the result. Outcome in
Source Serif 600 26px, one line of detail in `--sage` 13px, then *New game* (brass), *Review*
(raise), *Dismiss* (text only). Review is the second action, not the first, but it is the one
that unlocks the panel.

---

## The logo

`mark-on-dark.svg`, `mark-on-light.svg`, `wordmark.svg`.

**One line for the About page:** *Chang is Thai for elephant — the piece that became the
bishop, still called elephant across half the world. The mark is that animal, front on, on the
sixty-four squares.*

### Mark

A front-facing elephant head on a rounded square (`rx="14"` in a 64 box). Front-on so the
silhouette is symmetrical and survives the 16px favicon: two ear masses, a head, a trunk that
curls right, two tusks. At 16px the tusks and the curl merge into a single dark stem — which
is the ancient *alfil* shape. It degrades into a chess piece.

- On dark: tile `--slate` `#191F1D`, glyph `--brass` `#E0A93B`.
- On light: tile `#15201C`, glyph `--bone` `#EDE4D2`.
- Sizes verified at 96 / 48 / 32 / 16. Export the app icon from the same SVG at 512.

### Wordmark

"chang" in Source Serif 4 600 at 44px, tracking −.9; "64" in JetBrains Mono 700 at 34px,
tracking −.3, in `--brass`. **Mono is 0.77× the serif size and aligns on the shared baseline,
not the cap height**, so the digits sit level with the x-height of "chang" and read as an
appended quantity rather than a syllable.

- Light ground: chang `#15201C`, 64 `#7E5409`.
- Mono-colour: "64" drops to 55% opacity of "chang".
- Clear space: 0.5× cap height on all four sides.
- Minimum width 96px; below that, mark only.

Shipped as live type (SVG `<text>`) because the site already loads both faces — the wordmark
then costs zero bytes and stays translatable. Outlined paths available on request for print
and OG images.

---

## Recommendations that were not asked for

1. **The pre-game screen should look like the top of a blank scoresheet** — date, colour, time
   control, opponent, ruled, with the empty move grid below and the frozen position beside it.
   It stops reading as a broken game the moment it reads as a form waiting to be filled.
2. **Ship an OG image generator, not an OG image.** The pieces already render server-side onto
   1300 pages; render the same board into a 1200×630 card per page — position, title, mark.
   1300 distinct search previews for roughly the cost of one template.
3. **Coordinates on permanently**, not a setting (see Board).
4. **Cut the home stats strip from five to three** — keep level, puzzle rating, solved. Three
   of the current five are streaks; day streak is the single most esports-app element on the
   site.
5. **The evaluation bar is bone and ink, never brass.** It is the board's colours turned on
   their side. Brass means "you did this"; the evaluation is not something you did. Keep the
   accent scarce or it stops meaning anything.
6. **One motion rule** (see Motion).

---

## Files in this bundle

| File | What it is |
|---|---|
| `chang64-identity-spec.dc.html` | The full spec document, rendered. Open in a browser — authoritative visual reference. |
| `tokens.css` | Paste-ready token block, dark + light themes, plus type/spacing/radius/elevation notes. |
| `board-states.css` | The four-channel board overlay system, keyframes and reduced-motion fallbacks. |
| `pieces.js` | The six pieces as path arrays, the two shared paths, colours, and a `pieceSVG()` helper. |
| `mark-on-dark.svg` | App icon / favicon source, brass on slate. |
| `mark-on-light.svg` | Mark for light grounds. |
| `wordmark.svg` | Wordmark as live type with the exact spec baked in. |

No raster assets. Everything is paths and hex values.
