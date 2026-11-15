/* Planche des 182 medailles, par famille : node design/badges/planche.js -> planche.html */
const fs = require("fs"), path = require("path");
const RACINE = path.join(__dirname, "..", "..");
const C = require(path.join(RACINE, "src/badges-catalogue.js"));
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "symboles.json"), "utf8"));
const NOMS = { resolus: "Exercices résolus", serie: "Série de jours d'affilée", jours: "Jours joués au total", classement: "Classement",
  themes: "Thèmes tactiques", finales: "Finales", ordinateur: "Parties contre l'ordinateur", ami: "Jouer avec un ami", sprint: "Sprint",
  coordonnees: "Coordonnées", debut: "Je débute", makruk: "Makruk", semaine: "Jours de la semaine", du_jour: "Exercice du jour",
  jours_speciaux: "Jours spéciaux", exploits: "Exploits et curiosités", ouvertures: "Ouvertures", lecons: "Leçons apprises", defis: "Défis de la semaine" };
const METAUX = {
  bronze: { face: ["#F0B98C", "#C07A47", "#7A4321"], tranche: ["#D99566", "#6A381A"], grave: "#4A2410" },
  argent: { face: ["#FFFFFF", "#C9CFCC", "#7E8784"], tranche: ["#E4E8E6", "#5E6765"], grave: "#2F3634" },
  or: { face: ["#FFF0C2", "#E9B44C", "#9C6512"], tranche: ["#F6CF77", "#7A4C0C"], grave: "#4E3104" },
  jade: { face: ["#C9F2DC", "#5FBF92", "#1F6B4A"], tranche: ["#F6CF77", "#7A4C0C"], grave: "#0C3524" }
};
let n = 0;
function medaille(sym, metal, id = "") {
  const m = METAUX[metal], i = "m" + (++n);
  return `<svg class="medaille" data-id="${id}" viewBox="-60 -60 120 120" aria-hidden="true"><defs>
<radialGradient id="${i}f" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="${m.face[0]}"/><stop offset=".45" stop-color="${m.face[1]}"/><stop offset="1" stop-color="${m.face[2]}"/></radialGradient>
<linearGradient id="${i}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.tranche[0]}"/><stop offset="1" stop-color="${m.tranche[1]}"/></linearGradient></defs>
<circle r="56" cy="3" fill="rgba(0,0,0,.45)"/><circle r="55" fill="url(#${i}t)"/><circle r="47" fill="url(#${i}f)"/>
<circle r="43" fill="none" stroke="${m.grave}" stroke-opacity=".35" stroke-width="1"/><circle r="47" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>
<g opacity=".45" transform="translate(0 .9) scale(1.45)" style="color:#fff;--oeil:transparent">${sym}</g>
<g transform="scale(1.45)" style="color:${m.grave};--oeil:${m.face[1]}">${sym}</g></svg>`;
}
let corps = "";
for (const f of Object.keys(NOMS)) {
  const l = C.filter(b => b[1] === f);
  corps += `<h2>${NOMS[f]} <span>${l.length}</span></h2><div class="grille">` +
    l.map(b => `<div class="carte">${medaille(S[b[0]].s, S[b[0]].m, b[0])}<b>${b[3]}</b><small>${b[2]}</small></div>`).join("") + "</div>";
}
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planche des badges</title><style>
@font-face{font-family:"JetBrains Mono";font-weight:700;src:url("../../src/site/fonts/jetbrains-mono-v24-latin-700.woff2") format("woff2")}
:root{--ink:#101413;--chalk:#ECEAE3;--sage:#97A49D;--brass:#E0A93B}
body{margin:0;background:var(--ink);color:var(--chalk);font:14px/1.4 system-ui,"Segoe UI",sans-serif;padding:20px 16px 60px}
main{max-width:1100px;margin:0 auto}h1{font-family:Georgia,serif;font-size:26px;margin:0 0 4px}
h2{font-family:Georgia,serif;font-size:19px;margin:30px 0 10px}h2 span{color:var(--sage);font-size:14px}
.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:16px 12px}
.carte{text-align:center}.medaille{display:block;width:88px;height:88px;margin:0 auto}
.carte b{display:block;font-size:13px;margin-top:4px}.carte small{display:block;color:var(--sage);font-size:11px}
</style></head><body><main><h1>Les ${C.length} badges</h1><p style="color:var(--sage)">Bronze, argent, or, et jade bordé d'or pour les jours spéciaux. Pièces d'Alexandre, pictos Phosphor en aplat, quelques dessins faits main.</p>${corps}</main></body></html>`;
fs.writeFileSync(path.join(__dirname, "planche.html"), html);
console.log("planche.html :", C.length, "medailles,", Math.round(html.length / 1024), "Ko");
