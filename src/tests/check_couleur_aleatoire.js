/* Verification automatique de chang64.
   Lancement : node tests/check_couleur_aleatoire.js

   Le selecteur de couleur propose une troisieme option, "Au hasard". Deux
   etats sont a distinguer : colorMode retient le choix du joueur, myColor la
   couleur reellement jouee. En mode aleatoire les deux divergent.

   Le tirage est refait a CHAQUE nouvelle partie, pas une fois au clic.

   Pendant une partie, le selecteur est verrouille. En mode aleatoire il met
   donc en avant la couleur tiree plutot que le bouton "Au hasard", sinon le
   joueur ne saurait pas de quel cote il joue sans regarder l'echiquier. Un
   lisere signale que le mode aleatoire reste actif.

   Piege rencontre : syncColorSeg utilisait la variable "over", qui n'existe
   pas dans ui.js (c'est gameFinished() qui donne l'information). L'erreur
   interrompait newGame avant l'affichage de l'overlay de preparation, qui ne
   s'affichait donc plus du tout.
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
const seg = () => [...d.getElementById("segColor").children];
const enAvant = () => (seg().find(b => b.getAttribute("aria-pressed") === "true") || {}).dataset;

async function lancer() {
  d.getElementById("btnNew").click(); await wait(450);
  const rb = d.getElementById("readyBanner");
  if (rb.classList.contains("hide")) { d.getElementById("btnNew").click(); await wait(450); }
}
async function abandonner() {
  d.getElementById("btnResign").click(); await wait(140);
  d.getElementById("btnResign").click(); await wait(380);
}

setTimeout(async () => {
  d.getElementById("tab-play").click(); await wait(400);

  console.log("\n--- Les trois options sont proposees ---");
  T("trois boutons", seg().length === 3, seg().map(b => b.dataset.v).join(", "));
  T("Blancs, Noirs, Au hasard", seg().map(b => b.dataset.v).join("") === "wbr");

  console.log("\n--- Le mode aleatoire est signale ---");
  seg().find(b => b.dataset.v === "r").click(); await wait(300);
  T("hors partie, Au hasard est en avant", enAvant().v === "r", enAvant().v);
  T("lisere sur le bouton", seg().find(b => b.dataset.v === "r").classList.contains("mode-actif"));

  console.log("\n--- La couleur est tiree a chaque partie ---");
  const tirages = [];
  for (let i = 0; i < 8; i++) {
    await lancer();
    const sub = d.getElementById("readySub").textContent;
    tirages.push(/Black|Noirs/.test(sub) ? "N" : "B");
    d.getElementById("readyStart").click(); await wait(200);
    await abandonner();
  }
  T("la couleur varie d'une partie a l'autre", new Set(tirages).size > 1, tirages.join(""));
  const nb = tirages.filter(x => x === "N").length;
  T("les deux couleurs sortent", nb > 0 && nb < 8, nb + " noirs sur 8");

  console.log("\n--- L'overlay annonce la couleur reellement tiree ---");
  await lancer();
  const sub = d.getElementById("readySub").textContent;
  const tire = /Black|Noirs/.test(sub) ? "b" : "w";
  T("overlay renseigne", sub.length > 10, sub);
  T("le selecteur montre la couleur tiree", enAvant().v === tire, "overlay " + tire + ", selecteur " + enAvant().v);

  console.log("\n--- Pendant la partie ---");
  d.getElementById("readyStart").click(); await wait(300);
  T("selecteur verrouille", seg().every(b => b.disabled));
  T("la couleur tiree reste en avant", enAvant().v === tire, enAvant().v);
  T("le mode aleatoire reste signale", seg().find(b => b.dataset.v === "r").classList.contains("mode-actif"));

  console.log("\n--- Retour a un choix fixe ---");
  await abandonner();
  seg().find(b => b.dataset.v === "w").click(); await wait(300);
  T("Blancs en avant", enAvant().v === "w", enAvant().v);
  T("lisere retire", !seg().find(b => b.dataset.v === "r").classList.contains("mode-actif"));
  await lancer();
  T("l'overlay annonce bien les Blancs", /White|Blancs/.test(d.getElementById("readySub").textContent),
    d.getElementById("readySub").textContent);

  console.log("\n--- La barre d'evaluation suit l'orientation ---");
  /* La portion claire represente les Blancs et se colle en bas par defaut.
     Quand on joue les Noirs l'echiquier se retourne : sans suivre, la barre
     annoncerait l'avantage des Blancs du cote de nos propres pieces. */
  const barre=()=>d.querySelector(".evaltrack").classList.contains("flipped");
  await abandonner();
  seg().find(b=>b.dataset.v==="w").click(); await wait(300);
  await lancer(); d.getElementById("readyStart").click(); await wait(400);
  T("en jouant les Blancs, barre normale", !barre());
  await abandonner();
  seg().find(b=>b.dataset.v==="b").click(); await wait(350);
  await lancer(); d.getElementById("readyStart").click(); await wait(500);
  T("en jouant les Noirs, barre inversee", barre());
  await abandonner();
  T("apres la partie, l'orientation est conservee", barre());

  console.log("\n--- Depuis l'accueil, la couleur est tiree au sort ---");
  /* L'accueil ne propose pas de choix de couleur : imposer les Blancs serait
     arbitraire. Le reglage de l'onglet Jouer n'est pas ecrase pour autant,
     il n'y a simplement rien a respecter depuis l'accueil. */
  const tir=[];
  for(let i=0;i<8;i++){
    d.getElementById("tab-home").click(); await wait(220);
    d.getElementById("heroPlay").click(); await wait(450);
    tir.push(/Black|Noirs/.test(d.getElementById("readySub").textContent)?"N":"B");
    d.getElementById("readyStart").click(); await wait(180);
    await abandonner();
    const b=d.getElementById("resultBanner");
    if(!b.classList.contains("hide"))d.getElementById("resultClose").click();
    await wait(180);
  }
  T("la couleur varie sur 8 lancements", new Set(tir).size>1, tir.join(""));

  console.log("\n--- Mais le choix explicite reste respecte ---");
  d.getElementById("tab-play").click(); await wait(350);
  seg().find(b=>b.dataset.v==="b").click(); await wait(300);
  await lancer();
  T("Noirs choisi, Noirs joues",
    /Black|Noirs/.test(d.getElementById("readySub").textContent),
    d.getElementById("readySub").textContent);
  d.getElementById("readyStart").click(); await wait(200);
  await abandonner();
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await wait(200);

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b => b.dataset.lang === "fr").click();
  await wait(500);
  T("libelle traduit", /hasard/i.test(seg().find(b => b.dataset.v === "r").textContent),
    seg().find(b => b.dataset.v === "r").textContent);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1400);
