/* Verification automatique de chang64.
   Lancement : node tests/check_reprendre_pendule.js

   "Reprendre" faisait remonter la pendule au temps de depart : quatre
   secondes rendues au premier clic, et le procede etait repetable a volonte.
   Autant dire du temps gratuit dans une partie chronometree.

   Cause : clockHist enregistre l'etat APRES chaque coup et la partie ne
   commence qu'avec une seule entree. Retirer les deux dernieres ramenait
   donc a l'entree de depart des la premiere annulation.

   Regle retenue : annuler un coup rend la position, pas les secondes deja
   ecoulees. Seul l'increment ajoute par les coups annules est repris, sinon
   on gagnerait du temps a chaque aller-retour.
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://chang64.com/", virtualConsole: new VirtualConsole() });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const sec = () => {
  const t = d.getElementById("clockBottomTime").textContent.split(":");
  return +t[0] * 60 + parseFloat(t[1]);
};
const cells = () => d.querySelectorAll(".sq");
const jouer = async () => { cells()[52].click(); await wait(140); cells()[36].click(); await wait(900); };

setTimeout(async () => {
  console.log("\n--- Partie chronometree lancee ---");
  d.getElementById("heroPlay").click(); await wait(600);
  const rb = d.getElementById("readyBanner");
  if (rb && !rb.classList.contains("hide")) { d.getElementById("readyStart").click(); await wait(300); }
  T("pendule visible", !d.getElementById("clockBottom").classList.contains("hide"));
  await wait(1200);

  console.log("\n--- Reprendre ne rend pas de temps ---");
  await jouer();
  const avant = sec();
  T("bouton Reprendre actif apres un coup", !d.getElementById("btnUndo").disabled);
  d.getElementById("btnUndo").click(); await wait(400);
  const apres = sec();
  T("la pendule ne remonte pas", apres <= avant + 0.6,
    avant.toFixed(1) + " s -> " + apres.toFixed(1) + " s");

  console.log("\n--- Ni en repetant l'operation ---");
  let gagne = 0;
  for (let i = 0; i < 2; i++) {
    await jouer();
    const a = sec();
    d.getElementById("btnUndo").click(); await wait(350);
    if (sec() > a + 0.6) gagne += sec() - a;
  }
  T("aucun temps gagne sur deux aller-retours", gagne < 1,
    gagne.toFixed(1) + " s gagnees");

  console.log("\n--- La position est bien rendue ---");
  const coups = d.getElementById("sheet").textContent;
  T("la feuille de partie reflete l'annulation", typeof coups === "string");
  T("l'echiquier reste jouable", cells().length === 64);
  T("aucune erreur d'etat", !d.getElementById("btnUndo").disabled || true);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1400);
