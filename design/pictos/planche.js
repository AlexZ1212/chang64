/* Planche de propositions de pictogrammes (2026-11-22, corrections d'Alexandre).
   Usage : node design/pictos/planche.js <dossier assets de @phosphor-icons/core>
   Ecrit design/pictos/planche-pictos.png : lecteur de coups des articles,
   barre sous l'echiquier (clavier, reglages, inversion), puce de la carte
   « Contre l'ordinateur ». Phosphor Icons, licence MIT. */
const fs = require("fs"), path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "src", "node_modules", "sharp"));
const PH = process.argv[2];
if (!PH) throw new Error("node planche.js <dossier assets phosphor>");
const ph = (nom, graisse) => {
  const g = graisse || "fill";
  const s = fs.readFileSync(path.join(PH, g, nom + (g === "regular" ? "" : "-" + g) + ".svg"), "utf8");
  return s.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
};
/* Couleurs du theme par defaut du site. */
const C = { ink: "#0F1414", slate: "#171E1F", raise: "#212A2B", chalk: "#EAECEA", sage: "#96A5A5", brass: "#DDAE95", rule: "rgba(234,236,234,.16)", oeil: "#29292A" };
/* Un pictogramme Phosphor (boite de 256) pose dans un carre de cote c, dessin de taille t. */
const ico = (x, y, c, t, corps, couleur) =>
  `<g transform="translate(${x + (c - t) / 2} ${y + (c - t) / 2}) scale(${t / 256})" fill="${couleur || C.chalk}">${corps}</g>`;
const carre = (x, y, c, plein) => `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="9" fill="${plein ? C.raise : "none"}" stroke="${C.rule}" stroke-width="1.2"/>`;
const texte = (x, y, s, opt) => `<text x="${x}" y="${y}" font-family="Segoe UI,Arial,sans-serif" font-size="${(opt && opt.t) || 15}" font-weight="${(opt && opt.g) || 400}" fill="${(opt && opt.c) || C.sage}">${s}</text>`;

/* Pieces du site, pour la carte « Contre l'ordinateur ». */
const src = fs.readFileSync(path.join(__dirname, "..", "..", "src", "pieces_browser.js"), "utf8");
const PIECES = new Function(src.slice(src.indexOf("const PIECES="), src.indexOf("const PIECE_COLORS")) + ";return PIECES;")();
const piece = (t, x, y, s) => `<g fill="${C.brass}" transform="translate(${x} ${y}) scale(${s}) translate(-24 -24) scale(1.0667)">` +
  PIECES[t].map(f => (f.t === "circle" ? `<circle cx="${f.cx}" cy="${f.cy}" r="${f.r}"` : `<path d="${f.d}"`) + (f.fixe ? ` fill="${C.oeil}"` : "") + "/>").join("") + "</g>";
/* La puce actuelle du site (pictos_build.js). */
const O = `fill="none" stroke="${C.oeil}" stroke-linecap="round" stroke-linejoin="round" stroke-width="`;
const puceActuelle = `<g fill="${C.brass}"><rect x="-13" y="-13" width="26" height="26" rx="4.5"/>` +
  [-7.5, 0, 7.5].map(v => `<rect x="${v - 1.9}" y="-21" width="3.8" height="7" rx="1.9"/><rect x="${v - 1.9}" y="14" width="3.8" height="7" rx="1.9"/><rect x="-21" y="${v - 1.9}" width="7" height="3.8" rx="1.9"/><rect x="14" y="${v - 1.9}" width="7" height="3.8" rx="1.9"/>`).join("") + "</g>" +
  `<rect x="-6.5" y="-6.5" width="13" height="13" rx="2" ${O}2.6"/>`;
/* Carte : cavalier en bas a gauche, accent en haut a droite, comme sur le site. */
const carteOrdi = (x, y, accent) => {
  const c = 96;
  return `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="14" fill="#262423" stroke="${C.rule}"/>` +
    `<g transform="translate(${x + c / 2} ${y + c / 2}) scale(1.55)"><g transform="scale(1.06)">${piece("n", -5.5, 5.5, .82)}<g transform="translate(14.5 -14.5) scale(.56)">${accent}</g></g></g>`;
};
const accentPh = (nom, graisse, k) => `<g transform="scale(${(k || 1) * 48 / 256}) translate(-128 -128)" fill="${C.brass}">${ph(nom, graisse)}</g>`;

let s = "", y = 34;
const W = 760;
s += texte(24, y, "1. Lecteur de coups des articles (précédent, lecture, pause, suivant)", { t: 18, g: 600, c: C.chalk });
y += 22;
const lecteurs = [
  ["A", "Aujourd'hui : trait fin, sans cadre", null],
  ["B", "Pleins, carets arrondis", ["caret-left", "play", "pause", "caret-right", "fill"]],
  ["C", "Pleins, précédent et suivant en « piste »", ["skip-back", "play", "pause", "skip-forward", "fill"]],
  ["D", "Carets épais, lecture pleine", ["caret-left", "play", "pause", "caret-right", "bold"]]
];
for (const [lettre, nom, l] of lecteurs) {
  s += texte(24, y + 30, lettre, { t: 20, g: 700, c: C.brass }) + texte(52, y + 29, nom);
  const x0 = 400, c = 44;
  if (!l) {
    const tr = `fill="none" stroke="${C.sage}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
    const d = ["M14.5 6l-6 6 6 6", "M8.5 5.8l9.6 6.2-9.6 6.2z", "M8.5 6v12M15.5 6v12", "M9.5 6l6 6-6 6"];
    d.forEach((p, i) => { s += `<g transform="translate(${x0 + i * 52 + 12} ${y + 12}) scale(${20 / 24})"><path d="${p}" ${tr}/></g>`; });
  } else {
    l.slice(0, 4).forEach((n, i) => {
      const g = (n === "play" || n === "pause") ? "fill" : l[4];
      s += carre(x0 + i * 52, y, c, true) + ico(x0 + i * 52, y, c, 22, ph(n, g), C.chalk);
    });
  }
  y += 58;
}
y += 16;
s += `<line x1="24" x2="${W - 24}" y1="${y}" y2="${y}" stroke="${C.rule}"/>`; y += 34;
s += texte(24, y, "2. Sous l'échiquier : clavier, réglages, inversion (carrés à bord arrondi)", { t: 18, g: 600, c: C.chalk });
y += 22;
const barres = [
  ["A", "Clavier plein, roue et flèches actuelles", "fill"],
  ["B", "Clavier au trait, comme la roue et les flèches", "regular"]
];
const roue = "M10.24 4.92L10.72 2.49L13.28 2.49L13.76 4.92L15.77 5.75L17.82 4.37L19.63 6.18L18.25 8.23L19.08 10.24L21.51 10.72L21.51 13.28L19.08 13.76L18.25 15.77L19.63 17.82L17.82 19.63L15.77 18.25L13.76 19.08L13.28 21.51L10.72 21.51L10.24 19.08L8.23 18.25L6.18 19.63L4.37 17.82L5.75 15.77L4.92 13.76L2.49 13.28L2.49 10.72L4.92 10.24L5.75 8.23L4.37 6.18L6.18 4.37L8.23 5.75z";
for (const [lettre, nom, g] of barres) {
  s += texte(24, y + 26, lettre, { t: 20, g: 700, c: C.brass }) + texte(52, y + 25, nom);
  const x0 = 400, c = 36, tr = `fill="none" stroke="${C.sage}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
  /* la barre des coups, raccourcie, puis les trois carres */
  s += `<rect x="${x0}" y="${y}" width="190" height="${c}" rx="9" fill="${C.ink}" stroke="${C.rule}"/>` + texte(x0 + 12, y + 23, "1. e4  e5  2. ♘f3  ♞c6", { t: 13 });
  s += carre(x0 + 198, y, c, true) + ico(x0 + 198, y, c, 20, ph("keyboard", g), C.sage);
  s += carre(x0 + 240, y, c, true) + `<g transform="translate(${x0 + 240 + 9} ${y + 9}) scale(.75)"><path d="${roue}" ${tr}/><circle cx="12" cy="12" r="3" ${tr}/></g>`;
  s += carre(x0 + 282, y, c, true) + `<g transform="translate(${x0 + 282 + 9} ${y + 9}) scale(.75)"><path d="M6 9.5l6-5.5 6 5.5" ${tr}/><path d="M6 14.5l6 5.5 6-5.5" ${tr}/></g>`;
  y += 52;
}
y += 16;
s += `<line x1="24" x2="${W - 24}" y1="${y}" y2="${y}" stroke="${C.rule}"/>`; y += 34;
s += texte(24, y, "3. Carte « Contre l'ordinateur » : la puce", { t: 18, g: 600, c: C.chalk });
y += 20;
const puces = [
  ["A", "Aujourd'hui", puceActuelle],
  ["B", "Processeur", accentPh("cpu", "fill", 1)],
  ["C", "Circuit", accentPh("circuitry", "fill", 1)],
  ["D", "Robot", accentPh("robot", "fill", 1.05)],
  ["E", "Écran", accentPh("desktop", "fill", 1)],
  ["F", "Portable", accentPh("laptop", "fill", 1.05)]
];
puces.forEach(([lettre, nom, acc], i) => {
  const x = 24 + i * 122;
  s += carteOrdi(x, y, acc) + texte(x, y + 120, lettre, { t: 20, g: 700, c: C.brass }) + texte(x + 24, y + 119, nom);
});
y += 150;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="${C.slate}"/>${s}</svg>`;
const sortie = path.join(__dirname, "planche-pictos.png");
sharp(Buffer.from(svg), { density: 192 }).png().toFile(sortie).then(() => console.log("ecrit " + sortie));
