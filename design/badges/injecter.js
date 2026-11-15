/* Injecte symboles.json dans medailles-demo.html (bloc const SYM=...;). */
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "medailles-demo.html");
let h = fs.readFileSync(F, "utf8");
const SYM = fs.readFileSync(path.join(__dirname, "symboles.json"), "utf8");
/* La ligne const SYM= tient sur une seule ligne une fois generee : on ne
   remplace que cette ligne (une version precedente mangeait le bloc suivant). */
h = h.replace(/\/\* Symboles[^\n]*\nconst SYM=[^\n]*\n/,"/* Symboles : genere par symboles.js puis injecter.js. */\nconst SYM=" + SYM + ";\n");
/* Gravure : le symbole porte ses propres traits et aplats (currentColor) ;
   l'eclat clair est la meme forme decalee d'un demi-pixel. --oeil = l'oeil du
   cavalier, de la couleur de la face. */
h = h.replace(/  \$\{eteint\?"":`<g fill="none" stroke="#fff"[^\n]*\n  <g fill="none" stroke="\$\{m\.grave\}"[^\n]*\n/,
  '  ${eteint?"":`<g opacity=".45" transform="translate(0 .9) scale(1.45)" style="color:#fff;--oeil:transparent">${sym}</g>`}\n' +
  '  <g transform="scale(1.45)" style="color:${m.grave};--oeil:${m.face[1]}">${sym}</g>\n');
fs.writeFileSync(F, h);
console.log("SYM injecte :", h.includes("const SYM={\"premierCoup\""), "| gravure :", h.includes("--oeil:transparent"));
