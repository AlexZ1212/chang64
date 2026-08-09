// chang64 piece set — 45x45 viewBox, baseline y=37, no CSS dependency.
// Every piece is an ordered array of path "d" strings drawn with ONE fill and ONE stroke.
// Render order matters (later paths overlap earlier ones).

export const COLLAR = "M14.6 30h15.8l1.2 2.6H13.4z";
export const FOOT   = "M12 32.6h21l1.4 2v2.4H10.6v-2.4z";

export const PIECES = {
  king:   [
    "M21.2 2.2h2.6v3.2h3.2v2.8h-3.2v3.6h-2.6V8.2H18V5.4h3.2z",
    "M22.5 11.8c-5.6 0-9.6 3.4-9.6 7.6 0 2.4 1.2 4.4 2.8 6h13.6c1.6-1.6 2.8-3.6 2.8-6 0-4.2-4-7.6-9.6-7.6z",
    "M15.7 25.4h13.6l.8 1.6c-.4 1.2-.1 2.1.3 3H14.6c.4-.9.7-1.8.3-3z",
    COLLAR,
    FOOT
  ],
  queen:  [
    "M22.5 6.6l3.2 9.2 4-6.4.8 7.2 5.3-3.7-3.3 11.9H12.5L9.2 12.9l5.3 3.7.8-7.2 4 6.4z",
    "M9.2 9.9a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM15.3 6.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM22.5 3.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM29.7 6.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM35.8 9.9a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4z",
    "M12.5 24.8h20l-1.4 2.2c-.6 1.4-.5 2.3-.7 3H14.6c-.2-.7-.1-1.6-.7-3z",
    COLLAR,
    FOOT
  ],
  rook:   [
    "M11.6 8.4h4.8v3h3.4v-3h5.4v3h3.4v-3h4.8v7l-2.6 2.2H14.2l-2.6-2.2z",
    "M14.2 17.6h16.6l-1.6 6.4c-.4 2.6.8 4.4 1.2 6H14.6c.4-1.6 1.6-3.4 1.2-6z",
    COLLAR,
    FOOT
  ],
  bishop: [
    "M22.5 3.4a2.2 2.2 0 0 1 1.3 4c2 1.2 3.7 2.8 4.9 4.6L20.4 19.4 21.9 21 30.2 13.6C31.4 16 30.4 22.4 27.3 24.8H17.7c-2.3-1.6-3.6-3.8-3.6-6.6 0-4 2.7-8.2 7.1-10.8A2.2 2.2 0 0 1 22.5 3.4z",
    "M17.7 24.8h9.6l1.4 1.8c-.6 1.6.4 2.6 1.7 3.4H14.6c1.3-.8 2.3-1.8 1.7-3.4z",
    COLLAR,
    FOOT
  ],
  knight: [
    "M29.4 30C30.6 22 30.4 15 27.2 10.2L28.2 4.6 23.6 7.4C18.4 8.2 13.2 11.6 10.8 16.6 9.6 18.6 10.2 20 12.2 20.4L16.2 21C15 23 13.2 24 12.2 25.8 11.4 27.4 11.8 29 15.2 30Z",
    "M26.8 10.6c2.6 3.4 3.6 7.8 3.2 13.8l-2.4-1.8c.3-4.8-.5-8.4-2.4-10.6z",
    "M19.2 9.75a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 1 0 0-2.1z",
    "M11.6 17.75a.65.65 0 1 0 0 1.3.65.65 0 1 0 0-1.3z",
    COLLAR,
    FOOT
  ],
  pawn:   [
    "M22.5 7a4.2 4.2 0 0 1 1.9 7.9l.3 1.3h-4.4l.3-1.3A4.2 4.2 0 0 1 22.5 7z",
    "M20.3 16.2h4.4l2 1.8H18.3z",
    "M19.5 18h6c-.5 5 1.4 8.6 4.9 12H14.6c3.5-3.4 5.4-7 4.9-12z",
    COLLAR,
    FOOT
  ],
};

export const PIECE_COLORS = {
  light: { fill: "#F7F4EC", stroke: "#15201C" },
  dark:  { fill: "#15201C", stroke: "#D8D2C4" },
};

// Returns an SVG string for one piece. Render it at 100% of the square
// (NOT 86% — the artwork is drawn to fill the 45 box).
export function pieceSVG(type, color, size) {
  const c = PIECE_COLORS[color];
  const paths = PIECES[type].map(d => `<path d="${d}"/>`).join("");
  return `<svg viewBox="0 0 45 45" width="${size}" height="${size}" aria-hidden="true">` +
    `<g fill="${c.fill}" stroke="${c.stroke}" stroke-width="1" ` +
    `stroke-linejoin="round" stroke-linecap="round">${paths}</g></svg>`;
}

// NOTE ON <use>/<symbol>: if you define these as <symbol> and instantiate with
// <use>, fill/stroke inherited from an ancestor <g> will NOT reach the symbol's
// contents in Chromium. Put fill/stroke on the <symbol> element itself and
// define two symbols per piece (light + dark), or inline the paths.
