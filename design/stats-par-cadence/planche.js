#!/usr/bin/env node
/* Assemble les trois captures de maquette.js en une planche A / B / C. */
const path = require("path");
const sharp = require("../../src/node_modules/sharp");
(async () => {
  const noms = ["A", "B", "C"], titres = ["A : une barre par cadence", "B : des pastilles, une barre", "C : dans chaque tuile"];
  const L = 720, H = 1520, M = 40, T = 110;
  const fond = sharp({ create: { width: 3 * L + 4 * M, height: H + T + M, channels: 3, background: "#0F1414" } });
  const calques = [];
  for (let i = 0; i < 3; i++) {
    const x = M + i * (L + M);
    calques.push({ input: path.join(__dirname, "variante-" + noms[i] + ".png"), left: x, top: T });
    calques.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${T}"><text x="0" y="72" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#EAECEA">${titres[i]}</text></svg>`), left: x, top: 0 });
  }
  await fond.composite(calques).png().toFile(path.join(__dirname, "planche.png"));
  console.log("planche.png");
})().catch(e => { console.error(e); process.exit(1); });
