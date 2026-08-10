// Pièces dessinées en SVG, viewBox 45x45, base à y=37
const SHAPES = {
  p: `<circle cx="22.5" cy="13.5" r="5.6"/>
      <path d="M18.4 19.4c2.6 1.7 5.6 1.7 8.2 0 .6 3.6 1.9 6.8 3.6 9.6h-15.4c1.7-2.8 3-6 3.6-9.6z"/>
      <path d="M13.2 29h18.6c1.4 3.1 3.1 5.4 5.2 7.2H8c2.1-1.8 3.8-4.1 5.2-7.2z"/>`,
  r: `<path d="M11 36.4h23v-3.6H11z"/>
      <path d="M13.6 32.8V20.8h17.8v12z"/>
      <path d="M11.8 20.8l1.6-3.4h18.2l1.6 3.4z"/>
      <path d="M13.4 17.4V10.4h4v2.8h3.4v-2.8h3.4v2.8h3.4v-2.8h4v7z"/>`,
  b: `<circle cx="22.5" cy="7.6" r="2.4"/>
      <path d="M22.5 10c3.4 3.4 6.6 7.2 6.6 11.2 0 3.7-2.9 6.4-6.6 6.4s-6.6-2.7-6.6-6.4c0-4 3.2-7.8 6.6-11.2z"/>
      <path d="M19 13.8l7.4 7.4" fill="none"/>
      <path d="M15.6 27.6h13.8l1.6 2.8H14z"/>
      <path d="M12.8 30.4h19.4c1.4 3 3.1 5.2 5.2 6.9H7.6c2.1-1.7 3.8-3.9 5.2-6.9z"/>`,
  n: `<path d="M20.8 8.4c5.6.6 12 4.4 12 13.4 0 3.4-.9 6.2-2.4 8.4 1.6 1.9 2.6 4 2.8 6.2H13.6c.1-3.2 1.4-5.8 3.6-8.2 2.4-2.6 3.9-4.8 4.7-7.2l-4.6 3-2.4-2.6 2.4-2.2-2.9-.9c1.5-3.6 3.9-6.6 7-8.9l1.4 2.6z"/>
      <circle cx="27.4" cy="16.4" r="1.5" fill="none"/>`,
  q: `<circle cx="8.4" cy="14.6" r="2.6"/><circle cx="15.4" cy="10.6" r="2.6"/>
      <circle cx="22.5" cy="9" r="2.8"/><circle cx="29.6" cy="10.6" r="2.6"/>
      <circle cx="36.6" cy="14.6" r="2.6"/>
      <path d="M9 17.4l3.6 11.4h19.8L36 17.4l-5.6 4.8-3.4-9-4.5 9-4.5-9-3.4 9z"/>
      <path d="M12.4 28.8h20.2l1.2 2.6H11.2z"/>
      <path d="M10.6 31.4h23.8c1.2 2.6 2.7 4.5 4.6 5.8H6c1.9-1.3 3.4-3.2 4.6-5.8z"/>`,
  k: `<path d="M21.1 5h2.8v3.4h3.4v2.8h-3.4v3.6h-2.8v-3.6h-3.4V8.4h3.4z"/>
      <path d="M22.5 14.4c6.9 0 11.8 4.9 11.8 11.2 0 1.7-.3 3.3-1 4.7H11.7c-.7-1.4-1-3-1-4.7 0-6.3 4.9-11.2 11.8-11.2z"/>
      <path d="M10.6 30.6h23.8c1.2 2.6 2.8 4.6 4.7 5.9H5.9c1.9-1.3 3.5-3.3 4.7-5.9z"/>`
};

function piece(type, color) {
  const fill = color === "w" ? "#F4EDD8" : "#221D17";
  const stroke = color === "w" ? "#221D17" : "#EAE0C6";
  return `<svg viewBox="0 0 45 45" width="100%" height="100%" aria-hidden="true">
    <g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
      ${SHAPES[type]}
    </g></svg>`;
}

if (require.main === module) {
  const order = ["k", "q", "r", "b", "n", "p"];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="240" viewBox="0 0 720 240">
    <rect width="720" height="240" fill="#20302a"/>`;
  order.forEach((t, i) => {
    const x = i * 120;
    svg += `<rect x="${x}" y="0" width="120" height="120" fill="#EFE2C2"/>`;
    svg += `<rect x="${x}" y="120" width="120" height="120" fill="#527f62"/>`;
    const inner = (c, y) => `<g transform="translate(${x + 10},${y + 10}) scale(${100 / 45})">` +
      `<g fill="${c === "w" ? "#F4EDD8" : "#221D17"}" stroke="${c === "w" ? "#221D17" : "#EAE0C6"}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${SHAPES[t]}</g></g>`;
    svg += inner("w", 0) + inner("b", 120);
  });
  svg += `</svg>`;
  require("fs").writeFileSync("/home/claude/chess/pieces_test.svg", svg);
  console.log("svg écrit");
}
module.exports = { SHAPES, piece };
