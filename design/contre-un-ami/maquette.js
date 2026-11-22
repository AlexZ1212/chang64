/* Maquettes a 360 px de l'ecran « Contre un ami » refondu (2026-11-22), a faire
   valider par Alexandre avant de coder. Le script ouvre le site local dans un
   Chrome sans fenetre et y deplace les blocs existants : ce sont de vraies
   pieces du site, dans la disposition proposee.

   Usage : node design/contre-un-ami/maquette.js [http://localhost:8071] */
const path = require("path");
const { ouvrir } = require(path.join(__dirname, "..", "..", "src", "tests", "outils", "chrome_sans_fenetre.js"));
const BASE = (process.argv[2] || "http://localhost:8071").replace(/\/$/, "");
const SORTIE = __dirname;
const MEMBRE = `localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Moi",cle:"moi",version:1,dev:"abc123",n:0,sync:0}))`;

/* La disposition proposee, pour un membre. corr : la cadence « Correspondance » est choisie. */
const MEMBRE_ECRAN = corr => `(function(){
  const $=id=>document.getElementById(id), cacher=id=>{const e=$(id);if(e)e.classList.add("hide");};
  setMode("friend");amiModeRegler("direct");
  cacher("amiModesPanel");cacher("amiStatusPanel");cacher("amiNewGamePanel");cacher("amiLinkPanel");cacher("amiInvitePanel");
  $("directTitre").textContent="Contre un ami";
  $("directSous").textContent="Invite un membre par son pseudo. La partie commence dès qu'il te rejoint.";
  const champs=[...$("directNouveau").querySelectorAll(":scope > .field")];
  const couleur=champs.find(f=>f.querySelector("#directCouleur")), cadence=champs.find(f=>f.querySelector("#directCats"));
  $("directNouveau").insertBefore(cadence,couleur);
  /* quatre familles : la cadence choisit aussi entre direct et correspondance */
  const cats=$("directCats");cats.textContent="";
  ["Blitz","Rapide","Classique","Correspondance"].forEach((n,i)=>{const b=document.createElement("button");b.type="button";b.textContent=n;b.setAttribute("aria-pressed",String(${corr ? "i===3" : "i===1"}));cats.appendChild(b);});
  cats.classList.remove("hide");cats.style.display="grid";cats.style.gridTemplateColumns="1fr 1fr";
  const chips=$("directCadences");chips.textContent="";
  (${corr} ? ["1 jour","3 jours","7 jours"] : ["10+0","5+3","15+10"]).forEach((n,i)=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=n;b.setAttribute("aria-pressed",String(i===${corr ? 1 : 0}));chips.appendChild(b);});
  $("directCadenceTitre").textContent="Cadence";
  $("directCadenceNote").textContent=${corr} ? "Chaque joueur a 3 jours pour chaque coup. La partie t'attend ici, même si tu fermes le site." : "10 minutes chacun pour toute la partie.";
  /* des amis a choisir */
  setTimeout(()=>{$("directAmisBloc").classList.remove("hide");$("directAmisBloc").querySelector(".eyebrow").textContent="Adversaire";$("directAmis").textContent="";
  ["Lea","Tom","Nadia"].forEach((n,i)=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=n;b.setAttribute("aria-pressed","false");$("directAmis").appendChild(b);});
  const lab=document.querySelector('label[for="directPseudo"]');if(lab)lab.classList.add("hide");$("directPseudo").placeholder="ou le pseudo d'un autre membre";},250);
  /* sous « Inviter » : le lien d'invitation, puis l'ami sans compte */
  const lien=$("btnDirectLien").parentNode;
  $("btnDirectLien").textContent="ou envoyer un lien d'invitation";
  ${corr} && lien.classList.add("hide");
  const p=document.createElement("p");p.className="direct-lien direct-ami";p.innerHTML='<button type="button" class="linkbtn">Mon ami n\\'a pas de compte</button>';
  lien.parentNode.insertBefore(p,lien.nextSibling);
  window.scrollTo(0,0);
})()`;

const SANS_COMPTE = `(function(){
  const $=id=>document.getElementById(id), cacher=id=>{const e=$(id);if(e)e.classList.add("hide");};
  setMode("friend");amiModeRegler("lien");
  cacher("amiModesPanel");cacher("directPanel");cacher("amiInvitePanel");
  /* l'invitation a creer un compte, sous la partie par lien */
  const carte=document.createElement("div");carte.className="panel";
  carte.innerHTML='<div class="eyebrow">Avec un compte gratuit</div><p class="sub" style="margin-bottom:12px">Joue en direct à la pendule, ou par correspondance sur plusieurs jours, contre un autre membre.</p><div class="btnrow"><button type="button" class="btn">Créer un compte</button></div>';
  const ref=$("amiNewGamePanel");ref.parentNode.insertBefore(carte,ref.nextSibling);
  window.scrollTo(0,0);
})()`;

/* Le carre de notification, en bas a droite : deux parties attendent. */
const CARRE = `(function(){
  const b=document.createElement("button");b.type="button";b.id="maquetteCarre";
  b.setAttribute("aria-label","2 parties t'attendent");
  b.style.cssText="position:fixed;right:14px;bottom:14px;z-index:90;width:56px;height:56px;border-radius:14px;border:1px solid var(--rule);background-color:var(--raise);color:var(--chalk);display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer";
  b.innerHTML='<svg viewBox="0 0 256 256" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"/></svg><span style="position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background-color:var(--brass);color:var(--on-brass);font:700 12.5px/22px \\'JetBrains Mono\\',monospace;text-align:center">2</span>';
  document.body.appendChild(b);
})()`;

(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 780 });
  const url = BASE + "/fr/";
  const pret = async membre => {
    await c.aller(url);
    await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");${membre ? MEMBRE + ";" : ""}1`);
    await c.aller(url); await c.attendre(800);
    await c.js(`(function(){const s=document.createElement("style");s.textContent="#bravo,#bilan{display:none!important}";document.head.appendChild(s);})();1`);
  };
  await pret(true);
  await c.js(MEMBRE_ECRAN(false) + ";1"); await c.attendre(500);
  await c.capture(path.join(SORTIE, "1-membre-rapide.png"), true);
  await pret(true);
  await c.js(MEMBRE_ECRAN(true) + ";1"); await c.attendre(500);
  await c.capture(path.join(SORTIE, "2-membre-correspondance.png"), true);
  await pret(false);
  await c.js(SANS_COMPTE + ";1"); await c.attendre(500);
  await c.capture(path.join(SORTIE, "3-sans-compte.png"), true);
  await pret(true);
  await c.js(`document.getElementById("tab-puzzles").click();1`); await c.attendre(500);
  await c.js(CARRE + ";1"); await c.attendre(200);
  await c.capture(path.join(SORTIE, "4-carre-notification.png"));
  await c.fermer();
  console.log("maquettes ecrites dans " + SORTIE);
})().catch(e => { console.error(e); process.exit(1); });
