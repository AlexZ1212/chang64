/* Verification automatique de chang64.
   Lancement : node tests/check_ux_suite.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Suite de l'audit UX du 2026-10-24, mesure dans Chrome a six tailles :
   - accueil : "Jouer maintenant" etait sous la ligne de flottaison (724 px
     pour 667 sur iPhone SE, 789 pour 768 sur un portable) ; les boutons
     passent avant la cadence ;
   - Jouer et Inviter : plateau borne par la hauteur, a partir de 600 px de
     large (sur iPad, la pendule du joueur passait sous le bas de l'ecran) ;
   - ecran tactile : zone de 44 px autour des petites cibles.
   jsdom ne calcule pas la mise en page : on garde l'ordre et les regles,
   les positions ont ete mesurees dans Chrome. */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n").replace(/\s+/g, " ");

console.log("\n--- Accueil ---");
const iPlay = html.indexOf('id="heroPlay"'), iCadence = html.indexOf('class="tc-block"');
T("\"Jouer maintenant\" avant la cadence", iPlay > 0 && iCadence > 0 && iPlay < iCadence);
T("les deux boutons restent dans le meme bloc", /<div class="cta">\s*<button class="btn primary" id="heroPlay">[\s\S]*?id="heroPuzzle"/.test(html));
T("espace sous les boutons", /\.hero \.cta\{[^}]*margin-bottom:22px/.test(css));

console.log("\n--- Jouer et Inviter ---");
T("bureau : plateau borne par la hauteur visible", /@media ?\(min-width:861px\) ?\{ ?#appLayout\[data-mode="play"\] \.board-frame,#appLayout\[data-mode="friend"\] \.board-frame\{max-width:calc\(100vh - 360px\);max-width:calc\(100svh - 360px\)/.test(css));
T("tablette : idem, 300 px au minimum", /@media ?\(min-width:600px\) and \(max-width:860px\) ?\{ ?#appLayout\[data-mode="play"\] \.board-frame,#appLayout\[data-mode="friend"\] \.board-frame\{max-width:max\(300px,calc\(100vh - 360px\)\)/.test(css));
T("telephone : pas de bornage pour Jouer", !/@media ?\(max-width:860px\) ?\{ ?#appLayout\[data-mode="play"\]/.test(css));

console.log("\n--- Ecran tactile ---");
const bloc = (css.match(/@media ?\(pointer:coarse\) ?\{(.*?\}) ?\}/) || [])[1] || "";
T("un bloc pointer:coarse existe", !!bloc);
for (const sel of [".tabs button::after", ".tc-cats button::after", ".chip::after", ".langswitch button::after", ".info-tip::after"])
  T(sel + " : zone de 44 px", bloc.includes(sel) && /height:44px/.test(bloc));
T("lien du calendrier agrandi", /#calFullLink\{display:inline-block;padding:15px 0\}/.test(bloc));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
