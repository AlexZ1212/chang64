/* Symboles et metaux des 182 badges (2026-11-15).
   Tout est en APLAT (choix d'Alexandre : comme ses pieces), dans un repere
   -24..24, couleur = currentColor ; les details creuses dans le metal prennent
   la couleur de la face (--oeil), comme l'oeil du cavalier.
   Sources :
   - P(l)   les pieces dessinees par Alexandre (src/pieces_browser.js), telles quelles ;
   - MK(l)  ses pieces de Makruk (FORMES de src/makruk.js) ;
   - E()    l'elephant du logo (src/ds/signe.svg) ;
   - F(nom) Phosphor Icons, graisse "fill" (licence MIT, phosphoricons.com) ;
   - dessins faits main en aplat quand rien n'existe (hibou, fourchette, laurier...).
   Usage : node design/badges/symboles.js <dossier phosphor assets/fill>
   -> ecrit symboles.json : {id: {s: markup, m: metal}} */
const fs = require("fs"), path = require("path"), vm = require("vm");
const RACINE = path.join(__dirname, "..", "..");
const PH = process.argv[2];

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RACINE, "src/pieces_browser.js"), "utf8").replace(/^const PIECES=/m, "PIECES="), ctx);
const mk = fs.readFileSync(path.join(RACINE, "src/makruk.js"), "utf8").match(/const FORMES=(\{[\s\S]*?\n\});/)[1];
vm.runInContext("FORMES=" + mk, ctx);
const ELEPHANT = fs.readFileSync(path.join(RACINE, "src/ds/signe.svg"), "utf8").match(/ d="([^"]+)"/)[1];

const formes = l => l.map(f => {
  const a = Object.entries(f).filter(([k]) => !["t", "fixe", "sw"].includes(k)).map(([k, v]) => `${k}="${v}"`).join(" ");
  return f.fixe ? `<${f.t || "path"} ${a} style="fill:var(--oeil)"/>` : `<${f.t || "path"} ${a}/>`;
}).join("");
/* Repere 45 -> 48, centre. */
const P = (l, tr = "") => `<g fill="currentColor" transform="${tr} translate(-24 -24) scale(1.0667)">${formes(ctx.PIECES[l])}</g>`;
const MK = (l, tr = "") => `<g fill="currentColor" transform="${tr} translate(-24 -24) scale(1.0667)">${formes(ctx.FORMES[l])}</g>`;
const E = (tr = "") => `<g fill="currentColor" transform="${tr} translate(-24 -22) scale(.75)"><path fill-rule="evenodd" d="${ELEPHANT}"/></g>`;
const manque = new Set();
/* Les fleches en graisse "bold" : en "fill", leur tige est un simple trait
   fin, trop maigre une fois reduite (remarque d'Alexandre). */
const FLECHE = /^(arrow|arrows)-|^shuffle$/;
function F(nom, tr = "") {
  const f = FLECHE.test(nom) ? path.join(PH, "..", "bold", nom + "-bold.svg") : path.join(PH, nom + "-fill.svg");
  if (!fs.existsSync(f)) { manque.add(nom); return ""; }
  const corps = fs.readFileSync(f, "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<g fill="currentColor" transform="${tr} translate(-24 -24) scale(.1875)">${corps}</g>`;
}
/* Composition : un sujet principal et un petit accent en haut a droite. */
/* Sujet principal decale en bas a gauche, accent en haut a droite : ils ne
   doivent jamais se toucher (regle d'Alexandre, verifiee par verif-contacts). */
const G = "translate(-5.5 5.5) scale(.82)";
const A = nom => `<g data-accent="1">${F(nom, "translate(14.5 -14.5) scale(.5)")}</g>`;
const AP = l => P(l, "translate(14 -12) scale(.46)");
/* Chiffres dans la typo du "64" du logo : JetBrains Mono 700, approche -0,03 em. */
/* Chiffres dans la typo du "64" du logo (JetBrains Mono, approche -0,03 em),
   VECTORISES depuis le fichier de la police (fontkit, 3e argument = dossier
   node_modules qui le contient) : un <text> dependait du chargement de la
   police, et l'iPhone affichait parfois une police de repli (15/11). */
const FONTKIT = process.argv[3] ? require(path.join(process.argv[3], "fontkit")) : null;
const POLICE = FONTKIT ? FONTKIT.openSync(path.join(RACINE, "src/fonts/jetbrains-mono-v24-latin-700.woff2")) : null;
const T = (txt, taille = 22, y = 8, x = 0) => {
  if (!POLICE) throw new Error("fontkit manquant : node symboles.js <phosphor> <dossier node_modules avec fontkit>");
  const k = taille / POLICE.unitsPerEm, approche = -0.03 * POLICE.unitsPerEm;
  const run = POLICE.layout(txt);
  const largeur = run.positions.reduce((s, p) => s + p.xAdvance + approche, 0) - approche;
  let cx = -largeur / 2, d = "";
  run.glyphs.forEach((g, i) => {
    d += g.path.scale(k, -k).translate(x + cx * k, y).toSVG();
    cx += run.positions[i].xAdvance + approche;
  });
  return `<path fill="currentColor" d="${d}"/>`;
};
const evide = "fill:none;stroke:var(--oeil);stroke-linecap:round;stroke-linejoin:round";

const PERSO = {
  hibou: `<path fill="currentColor" d="M-15 -19c3 3 5 5 7 6 5-2 11-2 16 0 2-1 4-3 7-6 2 7 3 13 3 20 0 12-7 21-18 22-11-1-18-10-18-22 0-7 1-13 3-20z"/>
    <path style="fill:var(--oeil)" opacity=".35" d="M0 -5c-3-3-8-5-14-4 1 5 4 9 8 10 3 1 5-2 6-6zM0 -5c3-3 8-5 14-4-1 5-4 9-8 10-3 1-5-2-6-6z"/>
    <circle cx="-7" cy="-2" r="5.6" style="fill:var(--oeil)"/><circle cx="7" cy="-2" r="5.6" style="fill:var(--oeil)"/>
    <circle cx="-6.2" cy="-1.4" r="2.7" fill="currentColor"/><circle cx="7.8" cy="-1.4" r="2.7" fill="currentColor"/>
    <path style="fill:var(--oeil)" d="M-2.4 4h4.8L0 8.6z"/>
    <path style="${evide};stroke-width:1.6" opacity=".55" d="M-6 12l2 1.6 2-1.6M2 12l2 1.6 2-1.6M-2 16.5l2 1.6 2-1.6"/>`,
  fourchette: `<g transform="rotate(38)" fill="currentColor">
    <rect x="-8" y="-24" width="3.6" height="12" rx="1.8"/><rect x="-1.8" y="-24" width="3.6" height="12" rx="1.8"/><rect x="4.4" y="-24" width="3.6" height="12" rx="1.8"/>
    <path d="M-8 -14h16v1c0 5-3 8-5.5 9v24a2.5 2.5 0 0 1-5 0v-24c-2.5-1-5.5-4-5.5-9z"/></g>`,
  /* Laurier : deux branches de feuilles pleines, calculees le long d'un arc. */
  /* Laurier : deux branches le long d'un arc de cercle, feuilles pleines
     posees sur la tangente, alternant dedans/dehors pour l'epaisseur. */
  laurier: (() => {
    const R = 17, f = v => v.toFixed(1);
    let s = "";
    for (const c of [-1, 1]) {
      const a0 = 25, a1 = 150, pt = a => [c * R * Math.sin(a * Math.PI / 180), R * Math.cos(a * Math.PI / 180) + 1];
      const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
      s += `<path style="fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round" d="M${f(x0)} ${f(y0)}A${R} ${R} 0 0 ${c > 0 ? 0 : 1} ${f(x1)} ${f(y1)}"/>`;
      for (let k = 0; k < 7; k++) {
        const a = a0 + 8 + k * (a1 - a0 - 8) / 6, [x, y] = pt(a);
        const tx = c * Math.cos(a * Math.PI / 180), ty = -Math.sin(a * Math.PI / 180);   // tangente vers le haut
        const nx = c * Math.sin(a * Math.PI / 180), ny = Math.cos(a * Math.PI / 180);    // normale vers l'exterieur
        for (const cote of [1, -1]) {
          const cx = x + nx * 3.4 * cote + tx * 1.5, cy = y + ny * 3.4 * cote + ty * 1.5;
          const ang = Math.atan2(ty + ny * .55 * cote, tx + nx * .55 * cote) * 180 / Math.PI + 90;
          s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="2.1" ry="4.6" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="currentColor"/>`;
        }
      }
    }
    return s;
  })(),
  /* Mouton (15/11, coup du berger) : toison en nuage de boucles, tete en
     ovale detachee par un liseré couleur de face, oreille, oeil, pattes.
     Un seul <g> : verif-contacts le traite comme un dessin d'un seul tenant.
     tondu : corps lisse, sans toison. */
  mouton: tondu => `<g fill="currentColor">${tondu
      ? '<ellipse cx="2" cy="-1" rx="15" ry="10"/>'
      : '<circle cx="-8" cy="-3" r="7.5"/><circle cx="-1" cy="-8" r="7.5"/><circle cx="7" cy="-7" r="7.5"/><circle cx="12" cy="0" r="7"/><circle cx="5" cy="4" r="7.5"/><circle cx="-4" cy="4" r="7.5"/><circle cx="16" cy="-6" r="3.2"/>'}
    <rect x="-9" y="6" width="3.8" height="11" rx="1.9"/><rect x="-3.6" y="6" width="3.8" height="11" rx="1.9"/><rect x="5.6" y="6" width="3.8" height="11" rx="1.9"/><rect x="11" y="6" width="3.8" height="11" rx="1.9"/>
    ${tondu ? "" : '<path style="fill:none;stroke:var(--oeil);stroke-width:1.3;stroke-linecap:round" opacity=".7" d="M-6 -4a2.4 2.4 0 1 1 3 2.6M3 -9a2.4 2.4 0 1 1 3 2.6M8 0a2.4 2.4 0 1 1 3 2.6M-1 3a2.4 2.4 0 1 1 3 2.6"/>'}
    <ellipse cx="-17" cy="0" rx="7.2" ry="8.6" transform="rotate(-18 -17 0)" style="fill:var(--oeil)"/>
    <ellipse cx="-18" cy="1" rx="5.4" ry="7" transform="rotate(-18 -18 1)"/>
    <ellipse cx="-21.5" cy="-6" rx="3.6" ry="1.8" transform="rotate(-35 -21.5 -6)"/>
    <circle cx="-17" cy="-0.5" r="1.4" style="fill:var(--oeil)"/></g>`,
  /* Cornet de frites (15/11, journee de la frite belge du 1er aout). */
  frites: `<g fill="currentColor">
    <rect x="-13" y="-19" width="4.4" height="20" rx="1.4" transform="rotate(-16 -10.8 -1)"/>
    <rect x="-7.6" y="-23" width="4.4" height="24" rx="1.4" transform="rotate(-7 -5.4 -1)"/>
    <rect x="-2.2" y="-24.5" width="4.4" height="25" rx="1.4"/>
    <rect x="3.2" y="-22" width="4.4" height="23" rx="1.4" transform="rotate(8 5.4 -1)"/>
    <rect x="8.4" y="-18" width="4.4" height="19" rx="1.4" transform="rotate(17 10.6 -1)"/>
    <path d="M-17 -4h34l-2 1.5h-30z" style="fill:var(--oeil)"/>
    <path d="M-15.5 -3h31l-9.5 26h-12z"/>
    <path style="fill:none;stroke:var(--oeil);stroke-width:1.4;stroke-linecap:round" opacity=".55" d="M-9 2l4.5 17M9 2l-4.5 17"/></g>`,
  /* Brochette : une pique en biais, des pions enfiles. */
  pique: n => `<g transform="rotate(-35)"><rect x="-24" y="-1.6" width="48" height="3.2" rx="1.6" fill="currentColor"/>${
    [0, 1, 2].slice(0, n).map(i => P("p", `translate(${(i - (n - 1) / 2) * (n === 3 ? 14 : 17)} 0) rotate(35) scale(${n === 3 ? .62 : .74}) translate(0 -4)`)).join("")}</g>`,
  pointilles: `<g fill="currentColor"><circle cx="0" cy="0" r="1.7"/><circle cx="5" cy="-3" r="1.7"/><circle cx="10" cy="-6" r="1.7"/><circle cx="12" cy="-12" r="1.7"/></g>`,
  trois: nom => F(nom, "translate(-14.5 6) scale(.36)") + F(nom, "translate(0 -9) scale(.42)") + F(nom, "translate(14.5 6) scale(.36)"),
  quatre: nom => F(nom, "translate(-10 -10) scale(.36)") + F(nom, "translate(10 -10) scale(.36)") + F(nom, "translate(-10 10) scale(.36)") + F(nom, "translate(10 10) scale(.36)")
};

/* [symbole, metal] par badge. Metaux : bronze (premiers paliers), argent
   (intermediaires), or (grands exploits), jade borde d'or (jours speciaux). */
const S = {
  /* Exercices resolus */
  solved_1: [P("p", "translate(-8 2) scale(.82)") + F("arrow-fat-line-up", "translate(13 -3) scale(.46)"), "bronze"],
  solved_10: [F("timer"), "bronze"],
  solved_25: [P("k", G) + A("question"), "bronze"],
  solved_50: [F("hourglass-high"), "bronze"],
  solved_64: [F("checkerboard"), "argent"],
  solved_100: [F("crown-simple"), "argent"],
  solved_250: [P("r", G) + A("shield"), "argent"],
  solved_500: [P("p", G) + A("sneaker-move"), "argent"],
  solved_1000: [P("n", "translate(-6 2) scale(.84)") + `<g transform="translate(10 -6)">${PERSO.pointilles}</g>`, "or"],
  solved_2000: [F("flower"), "or"],
  solved_3000: [F("note-pencil"), "or"],
  solved_5000: [P("q", G) + A("wind"), "or"],
  solved_10000: [F("infinity"), "or"],
  /* Serie */
  days_1: [F("sun-horizon"), "bronze"],
  days_3: [F("alarm"), "bronze"],
  days_7: [P("k", "translate(-4 1) rotate(28 12 14.5) scale(.88)"), "bronze"],
  days_14: [P("k", "translate(-10 5) scale(.58)") + P("r", "translate(11 7) scale(.5)") + F("arrows-left-right", "translate(0 -16) scale(.36)"), "argent"],
  days_30: [P("k", "translate(-11 1) scale(.58)") + P("k", "translate(11 1) scale(.58)"), "argent"],
  days_60: [P("p", "translate(-10 6) scale(.56)") + P("p", "translate(10 6) scale(.56)") + F("arrow-bend-up-right", "translate(0 -14) scale(.4)"), "argent"],
  days_100: [F("hourglass-medium"), "argent"],
  days_200: [P("q"), "or"],
  days_365: [F("sun"), "or"],
  days_500: [F("trophy"), "or"],
  days_1000: [PERSO.laurier, "or"],
  /* Jours joues au total */
  total_5: [F("door-open"), "bronze"],
  total_10: [F("coffee"), "bronze"],
  total_25: [F("palette"), "bronze"],
  total_50: [F("envelope-simple"), "argent"],
  total_100: [F("medal"), "argent"],
  total_200: [P("n", G) + A("arrows-out"), "argent"],
  total_365: [F("calendar-check"), "or"],
  total_730: [F("medal-military"), "or"],
  /* Classement */
  rating_900: [P("p"), "bronze"],
  rating_1000: [P("p", "translate(-11 -10) scale(.38)") + P("n", "translate(11 -10) scale(.38)") + E("translate(-11 11) scale(.34)") + P("r", "translate(11 10) scale(.38)"), "bronze"],
  rating_1100: [P("q", G) + A("arrow-up-right"), "bronze"],
  rating_1200: [E(), "argent"],
  rating_1350: [P("n"), "argent"],
  rating_1500: [P("r"), "argent"],
  rating_1650: [P("q"), "argent"],
  rating_1800: [F("feather"), "or"],
  rating_2000: [F("eye"), "or"],
  rating_2100: [F("plant"), "or"],
  rating_2300: [PERSO.laurier + F("crown-simple", "translate(0 -1) scale(.3)"), "or"],
  /* Themes : 10 bronze, 25 argent, 100 or */
  theme_winning_capture_10: [F("fork-knife"), "bronze"],
  theme_winning_capture: [F("bowl-food"), "argent"],
  theme_winning_capture_100: [F("tote"), "or"],
  theme_double_attack_10: [F("arrows-split"), "bronze"],
  theme_double_attack: [F("target"), "argent"],
  theme_double_attack_100: [F("eye-slash"), "or"],
  theme_skewer_10: [PERSO.pique(2), "bronze"],
  theme_skewer: [PERSO.pique(3), "argent"],
  theme_skewer_100: [F("fire"), "or"],
  theme_mate_in_two_10: [F("dice-two"), "bronze"],
  theme_mate_in_two: [F("music-notes"), "argent"],
  theme_mate_in_two_100: [F("pen-nib"), "or"],
  theme_winning_move_10: [F("lightbulb"), "bronze"],
  theme_winning_move: [F("paint-brush"), "argent"],
  theme_winning_move_100: [F("sparkle"), "or"],
  theme_knight_fork_10: [PERSO.fourchette, "bronze"],
  theme_knight_fork: [P("n", G) + A("crown-simple"), "argent"],
  theme_knight_fork_100: [`<g transform="translate(3 3) scale(.86)">${PERSO.fourchette}</g>` + F("sparkle", "translate(-14 -13) scale(.32)"), "or"],
  theme_mate_in_one_10: [F("star"), "bronze"],
  theme_mate_in_one: [F("door"), "argent"],
  theme_mate_in_one_100: [F("binoculars"), "or"],
  /* Le roi derriere ses trois pions : le motif lui-meme. */
  theme_back_rank_mate_10: [P("k", "translate(0 -9) scale(.5)") + P("p", "translate(-13 11) scale(.4)") + P("p", "translate(0 11) scale(.4)") + P("p", "translate(13 11) scale(.4)"), "bronze"],
  theme_back_rank_mate: [F("lock"), "argent"],
  theme_back_rank_mate_100: [F("wind"), "or"],
  theme_pin_10: [F("push-pin"), "bronze"],
  theme_pin: [P("k", G) + A("push-pin"), "argent"],
  theme_pin_100: [F("butterfly"), "or"],
  theme_pawn_fork_10: [P("p", G) + A("barbell"), "bronze"],
  theme_pawn_fork: [P("p", "translate(0 6) scale(.66)") + F("arrow-up-left", "translate(-14 -13) scale(.36)") + F("arrow-up-right", "translate(14 -13) scale(.36)"), "argent"],
  theme_pawn_fork_100: [P("p", G) + A("crown-simple"), "or"],
  theme_deflection_10: [F("arrow-bend-up-right"), "bronze"],
  theme_deflection: [F("scales"), "argent"],
  theme_deflection_100: [F("magic-wand"), "or"],
  theme_quiet_move_10: [F("speaker-slash"), "bronze"],
  theme_quiet_move: [F("yin-yang"), "argent"],
  theme_quiet_move_100: [F("flower-lotus"), "or"],
  theme_mate_in_three_10: [F("steps"), "bronze"],
  theme_mate_in_three: [F("scroll"), "argent"],
  theme_mate_in_three_100: [F("compass-tool"), "or"],
  /* Finales */
  eg_kq: [P("q", "translate(-9 2) scale(.66)") + P("k", "translate(12 8) scale(.44)"), "argent"],
  eg_kr: [P("r", "translate(-9 2) scale(.66)") + P("k", "translate(12 8) scale(.44)"), "argent"],
  eg_krr: [P("r", "translate(-10 2) scale(.6)") + P("r", "translate(10 2) scale(.6)"), "argent"],
  eg_kbn: [P("b", "translate(-10 2) scale(.6)") + P("n", "translate(10 2) scale(.6)"), "or"],
  eg_kp: [P("p", G) + A("crown-simple"), "argent"],
  eg_toutes: [F("crown"), "or"],
  eg_pat: [P("k", G) + A("moon-stars"), "bronze"],
  /* Ordinateur */
  jeu_victoire: [F("flag"), "bronze"],
  jeu_niv1: [F("robot"), "bronze"],
  jeu_niv2: [F("robot", "translate(-6 6) scale(.7)") + A("armchair"), "argent"],
  jeu_niv3: [F("robot", "translate(-6 6) scale(.7)") + A("barbell"), "argent"],
  jeu_niv4: [F("robot", "translate(-6 6) scale(.7)") + A("shield"), "or"],
  jeu_nulle: [F("handshake"), "bronze"],
  jeu_noirs: [P("k", G) + A("moon"), "argent"],
  jeu_bullet: [F("rocket"), "argent"],
  jeu_blitz: [F("lightning"), "argent"],
  jeu_rapide: [F("metronome"), "argent"],
  jeu_classique: [F("books"), "or"],
  jeu_temps: [F("flag-pennant"), "argent"],
  jeu_express: [F("train"), "or"],
  jeu_10: [F("globe-hemisphere-west"), "or"],
  /* Ami */
  ami_invite: [F("envelope-open"), "bronze"],
  ami_partie: [F("hands-clapping"), "argent"],
  ami_revanche: [F("arrows-clockwise"), "argent"],
  /* Ouvertures (15/11) */
  ouv_italienne: [P("b", G) + A("pizza"), "bronze"],
  ouv_espagnole: [P("b", G) + A("church"), "bronze"],
  ouv_sicilienne: [P("p", G) + A("mountains"), "bronze"],
  ouv_francaise: [P("p", G) + A("envelope"), "bronze"],
  ouv_carokann: [P("p", G) + A("users"), "bronze"],
  ouv_gambit_dame: [P("q", G) + A("hand-coins"), "bronze"],
  ouv_scandinave: [P("q", G) + A("sailboat"), "bronze"],
  ouv_anglaise: [P("p", G) + A("tea-bag"), "bronze"],
  ouv_gambit_roi: [P("k", G) + A("sparkle"), "bronze"],
  ouv_londres: [P("b", G) + A("bus"), "bronze"],
  ouv_fegatello: [P("n", G) + A("fire"), "argent"],
  ouv_traxler: [P("b", G) + A("sword"), "argent"],
  ouv_berger: [PERSO.mouton(false), "argent"],
  ouv_legal: [P("q", G) + A("gift"), "argent"],
  ouv_shilling: [P("n", G) + A("coin"), "argent"],
  ouv_englund: [P("q", G) + A("snowflake"), "argent"],
  ouv_damiano: [P("p", G) + A("book-open"), "argent"],
  ouv_5: [F("notebook"), "bronze"],
  ouv_15: [F("archive"), "argent"],
  ouv_30: [F("bank"), "or"],
  /* Sprint */
  sprint_10: [F("clock-countdown"), "bronze"],
  sprint_15: [F("sneaker"), "bronze"],
  sprint_20: [F("fan"), "argent"],
  sprint_25: [F("airplane-tilt"), "or"],
  sprint_30: [F("shooting-star"), "or"],
  /* Coordonnees */
  coord_10: [F("compass"), "bronze"],
  coord_20: [F("map-trifold"), "argent"],
  coord_30: [F("grid-four"), "argent"],
  coord_40: [F("crosshair"), "or"],
  coord_parfait: [F("eye-closed"), "or"],
  /* Je debute */
  debut_1: [F("footprints"), "bronze"],
  debut_2: [F("hand-grabbing"), "bronze"],
  debut_3: [P("k", G) + A("x"), "bronze"],
  debut_4: [F("wall"), "bronze"],
  debut_5: [PERSO.fourchette, "bronze"],
  debut_6: [F("push-pin-simple"), "bronze"],
  debut_7: [F("checkerboard"), "bronze"],
  debut_fini: [F("graduation-cap"), "or"],
  /* Makruk : ses pieces thaies */
  mk_partie: [F("hand-waving"), "bronze"],
  mk_facile: [MK("k"), "argent"],
  mk_moyen: [MK("m"), "argent"],
  mk_difficile: [MK("r", G) + A("boat"), "or"],
  mk_promotion: [MK("p", G) + A("arrow-fat-line-up"), "argent"],
  mk_comptage: [F("hand-palm"), "argent"],
  /* Semaine */
  sem_lundi: [F("moon"), "bronze"],
  sem_mardi: [F("shield"), "bronze"],
  sem_mercredi: [F("paper-plane-tilt"), "bronze"],
  sem_jeudi: [P("k"), "bronze"],
  sem_vendredi: [P("q"), "bronze"],
  sem_samedi: [F("planet"), "bronze"],
  sem_dimanche: [F("sun"), "bronze"],
  sem_toute: [F("rainbow"), "or"],
  /* Exercice du jour */
  jour_1: [F("clock"), "bronze"],
  jour_7: [F("lamp"), "argent"],
  jour_semaine: [F("steps"), "or"],
  jour_30: [F("newspaper"), "argent"],
  jour_100: [F("bank"), "or"],
  /* Jours speciaux : jade */
  fete_0101: [F("confetti"), "jade"],
  fete_0214: [F("heart"), "jade"],
  fete_0229: [F("calendar-plus"), "jade"],
  fete_jour64: [T("64", 24, 8.5), "jade"],
  fete_0309: [F("shuffle"), "jade"],
  fete_0401: [F("fish"), "jade"],
  fete_0413: [F("drop"), "jade"],
  fete_0511: [P("k", G) + A("desktop-tower"), "jade"],
  fete_0622: [F("mask-happy"), "jade"],
  fete_0720: [F("globe"), "jade"],
  fete_0723: [P("q", G) + A("star-four"), "jade"],
  fete_0901: [F("mountains"), "jade"],
  fete_0907: [P("p", G) + A("music-note"), "jade"],
  fete_1031: [F("gear-six"), "jade"],
  fete_1109: [F("magic-wand"), "jade"],
  fete_1119: [F("piano-keys"), "jade"],
  fete_1130: [F("snowflake"), "jade"],
  fete_1225: [F("tree-evergreen"), "jade"],
  fete_1231: [F("sparkle"), "jade"],
  /* Jours speciaux ajoutes le 15/11 (journees mondiales, clins d'oeil hors echecs) */
  fete_0106: [P("k", "translate(-11 1) scale(.58)") + P("k", "translate(11 1) scale(.58)"), "jade"],
  fete_0221: [F("chats-circle"), "jade"],
  fete_0308: [P("q", G) + A("flower-tulip"), "jade"],
  fete_0314: [F("pi"), "jade"],
  fete_0320: [F("smiley"), "jade"],
  fete_0321: [F("quotes"), "jade"],
  fete_0423: [F("book-open"), "jade"],
  fete_0429: [P("n", G) + A("music-notes-simple"), "jade"],
  fete_0621: [F("guitar"), "jade"],
  fete_0717: [P("p", G) + A("smiley-wink"), "jade"],
  fete_0801: [PERSO.frites, "jade"],
  fete_0812: [E(), "jade"],
  fete_1005: [F("chalkboard-teacher"), "jade"],
  fete_1016: [F("bowl-steam"), "jade"],
  fete_1113: [F("hand-heart"), "jade"],
  fete_1120: [F("balloon"), "jade"],
  /* Saisons (15/11) : chacune ouvre un theme */
  saison_fetes: [P("k", G) + A("tree-evergreen"), "jade"],
  saison_valentin: [P("k", "translate(-9 2) scale(.6)") + P("q", "translate(9 2) scale(.6)"), "jade"],
  saison_songkran: [E("translate(-5 5) scale(.82)") + A("drop"), "jade"],
  saison_solstice: [F("sun-horizon"), "jade"],
  saison_mondial: [P("p", G) + A("globe-hemisphere-east"), "jade"],
  saison_turc: [P("n", G) + A("ghost"), "jade"],
  /* Objectif du jour et gel de serie (15/11) */
  obj_atteint: [F("check-circle"), "bronze"],
  obj_gel: [F("thermometer-cold"), "argent"],
  /* Lecons apprises (badges de defaite, 15/11) */
  lec_premiere: [P("k", G) + A("heart"), "bronze"],
  lec_analyse: [P("k", G) + A("magnifying-glass"), "argent"],
  lec_remontada: [F("trend-up"), "or"],
  lec_rancunier: [F("arrow-counter-clockwise"), "bronze"],
  lec_abandon: [F("flag-banner-fold"), "bronze"],
  lec_berger: [F("warning"), "bronze"],
  lec_temps: [F("hourglass-simple-low"), "bronze"],
  lec_courage: [F("shield-star"), "argent"],
  lec_acharne: [F("person-simple-hike"), "argent"],
  lec_reprise: [F("leaf"), "bronze"],
  lec_sot: [P("k", G) + A("smiley-x-eyes"), "bronze"],
  lec_tondu: [`<g transform="${G}">${PERSO.mouton(true)}</g>` + A("scissors"), "bronze"],
  /* Exploits */
  ex_hibou: [PERSO.hibou, "argent"],
  ex_coq: [F("bird"), "argent"],
  ex_huit_dames: [P("q", G) + T("8", 17, -7, 14.5), "or"],
  ex_sans_filet: [F("person-simple-tai-chi"), "or"],
  ex_tetu: [F("hand-fist"), "argent"],
  ex_marathon: [F("person-simple-run"), "or"],
  ex_weekend: [F("couch"), "argent"],
  ex_retour: [F("arrow-u-up-left"), "bronze"],
  ex_app: [F("device-mobile"), "bronze"],
  ex_editeur: [F("ruler"), "bronze"],
  ex_analyse: [F("magnifying-glass"), "bronze"],
  ex_langue: [F("translate"), "bronze"],
  ex_retourne: [F("arrows-down-up"), "bronze"],
  ex_code: [F("key"), "bronze"],
  ex_partage: [F("megaphone"), "bronze"],
  /* Defis */
  defi_1: [F("flag-checkered"), "bronze"],
  defi_parfait: [PERSO.trois("star"), "argent"],
  defi_mois: [PERSO.quatre("star"), "or"],
  defi_10: [F("medal"), "argent"],
  defi_52: [PERSO.laurier, "or"]
};
const C = require(path.join(RACINE, "src/badges-catalogue.js"));
const absents = C.map(b => b[0]).filter(id => !S[id]);
const orphelins = Object.keys(S).filter(id => !C.some(b => b[0] === id));
const sortie = {};
for (const [id, [s, m]] of Object.entries(S)) sortie[id] = { s, m };
fs.writeFileSync(path.join(__dirname, "symboles.json"), JSON.stringify(sortie));
console.log("symboles :", Object.keys(S).length, "| sans symbole :", absents.join(",") || "aucun",
  "| hors catalogue :", orphelins.join(",") || "aucun", "| phosphor manquants :", [...manque].join(",") || "aucun");
