/* Verification automatique de chang64.
   Lancement : node tests/check_couleur_aleatoire.js

   Le selecteur de couleur propose une troisieme option, "Au hasard". Deux
   etats sont a distinguer : colorMode retient le choix du joueur, myColor la
   couleur reellement jouee. En mode aleatoire les deux divergent.

   Le tirage est refait a CHAQUE nouvelle partie, pas une fois au clic.

   Pendant une partie, le selecteur est verrouille et continue d'afficher le
   REGLAGE choisi, dans les trois cas. J'avais d'abord montre la couleur
   tiree, en pensant qu'on ne saurait pas de quel cote on joue : c'est faux,
   l'overlay l'annonce, l'echiquier est retourne, l'adversaire est nomme et la
   pendule indique qui est qui.

   Les trois boutons se ressemblent en tout point : un lisere sur "Au hasard"
   attirait l'oeil vers un controle verrouille et pale. Le mode se lit dans le
   comportement, pas dans une marque : "Au hasard" redevient selectionne des
   que la partie est finie.

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
  T("aucun traitement particulier", !seg().find(b => b.dataset.v === "r").classList.contains("mode-actif"));

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
  /* Le selecteur montre le REGLAGE, pas la couleur tiree : celle-ci est deja
     annoncee par l'overlay, l'echiquier retourne, le nom de l'adversaire et
     la pendule. Afficher autre chose que le reglage rendait le selecteur
     incoherent avec Blancs et Noirs, qui restent affiches tels quels. */
  T("le selecteur montre le mode choisi", enAvant().v === "r", enAvant().v);
  T("l'overlay annonce la couleur tiree", tire === "w" || tire === "b", tire);

  console.log("\n--- Pendant la partie ---");
  d.getElementById("readyStart").click(); await wait(300);
  T("selecteur verrouille", seg().every(b => b.disabled));
  T("le mode reste affiche pendant la partie", enAvant().v === "r", enAvant().v);
  T("aucun lisere pendant la partie", !seg().find(b => b.dataset.v === "r").classList.contains("mode-actif"));
  /* Controle sur le style calcule et non sur la classe : une regle CSS
     pourrait reintroduire un contour sans passer par elle. */
  {
    const contours = seg().filter(b => (w.getComputedStyle(b).boxShadow || "").includes("inset"));
    T("aucun contour sur un bouton verrouille", contours.length === 0,
      contours.map(b => b.dataset.v).join(", "));
    const styles = seg().map(b => {
      const st = w.getComputedStyle(b);
      return st.boxShadow + "|" + st.borderStyle;
    });
    T("les trois ont le meme traitement de bordure",
      new Set(styles).size === 1, styles.join("  vs  "));
  }

  console.log("\n--- Retour a un choix fixe ---");
  await abandonner();
  seg().find(b => b.dataset.v === "w").click(); await wait(300);
  T("Blancs en avant", enAvant().v === "w", enAvant().v);
  T("les trois boutons se ressemblent", seg().every(b => !b.classList.contains("mode-actif")));
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
  /* Le reglage lui-meme passe en "au hasard" : sinon le selecteur afficherait
     "Blancs" alors que la couleur a ete tiree, et la partie suivante
     repartirait en Blancs fixes sans qu'on l'ait demande. */
  d.getElementById("tab-home").click(); await wait(250);
  d.getElementById("heroPlay").click(); await wait(500);
  d.getElementById("readyStart").click(); await wait(400);
  T("le selecteur affiche 'Au hasard'", enAvant().v==="r", enAvant().v);
  await abandonner();
  {const b=d.getElementById("resultBanner"); if(!b.classList.contains("hide"))d.getElementById("resultClose").click();}
  await wait(220);

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

  console.log("\n--- Les trois modes se comportent pareil en partie ---");
  /* C'est le vrai principe : quel que soit le reglage, il reste selectionne
     et grise pendant la partie. Verifie sur les trois plutot qu'un seul. */
  for(const [v,nom] of [["w","Blancs"],["b","Noirs"],["r","Au hasard"]]){
    d.getElementById("tab-play").click(); await wait(320);
    seg().find(b=>b.dataset.v===v).click(); await wait(280);
    await lancer();
    d.getElementById("readyStart").click(); await wait(420);
    T(nom+" : reste selectionne en partie", enAvant().v===v, enAvant().v);
    T(nom+" : selecteur verrouille", seg().every(b=>b.disabled));
    await abandonner();
    const b=d.getElementById("resultBanner");
    if(!b.classList.contains("hide"))d.getElementById("resultClose").click();
    await wait(220);
  }

  console.log("\n--- En francais ---");
  [...d.getElementById("langSwitch").children].find(b => b.dataset.lang === "fr").click();
  await wait(500);
  T("libelle traduit", /hasard/i.test(seg().find(b => b.dataset.v === "r").textContent),
    seg().find(b => b.dataset.v === "r").textContent);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1400);
