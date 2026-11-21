/* Verification automatique de chang64.
   Lancement : node tests/check_coup_feuille_page.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, signale par Alexandre) : sur telephone,
   en fin de partie, toucher un coup de la feuille de partie faisait remonter
   la page jusqu'au bandeau de coups au lieu de montrer l'echiquier. Le
   bandeau recentrait sa puce avec scrollIntoView, qui fait aussi defiler la
   page.
   - le bandeau ne defile plus qu'a l'horizontale, par son propre conteneur :
     scrollIntoView n'est plus appele sur une puce ;
   - apres un coup choisi dans la feuille, c'est l'echiquier qui est ramene
     sous les yeux ;
   - une puce deja centree ne declenche aucun defilement ;
   - pareil pour le bandeau d'une partie entre amis. */
const { ouvrir } = require("./outils/page_langue.js");
const { presser } = require("./outils/touches.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  /* Qui a ete amene a l'ecran par scrollIntoView, et ce que le bandeau a
     recu sur son propre defilement. */
  const vus = [], bandeau = [];
  w.Element.prototype.scrollIntoView = function () { vus.push(this); };
  $("navScroll").scrollTo = o => { bandeau.push(o); };
  const surPuce = () => vus.filter(e => e.closest && e.closest("#navScroll")).length;
  const surEchiquier = () => vus.filter(e => e.classList && e.classList.contains("board-side")).length;
  const raz = () => { vus.length = 0; bandeau.length = 0; };

  console.log("Fin de partie contre l'ordinateur");
  w.eval("colorMode='w';myColor=W;tcCat='none';setMode('play',{fresh:true})");
  await pause(200);
  if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
  for (const u of ["e2e4", "g1f3", "f1c4"]) { w.eval("playUser(game.moves().find(m=>game.uci(m)==='" + u + "'))"); await pause(500); }
  $("btnResign").click(); $("btnResign").click();
  await pause(300);
  $("resultClose").click();
  T("six coups dans la feuille de partie", $("sheet").querySelectorAll("[data-ply]").length === 6);

  /* Le bandeau a quelque chose a rattraper : la puce choisie n'est pas au centre. */
  w.eval("navChipCible=()=>120");
  raz();
  $("sheet").querySelector('[data-ply="2"]').click();
  T("toucher un coup de la feuille montre ce coup", w.eval("reviewPly") === 2 && ($("navScroll").querySelector('[aria-current="true"]') || {}).dataset.ply === "2");
  T("la page n'est pas amenee au bandeau : aucun scrollIntoView sur une puce", surPuce() === 0, String(surPuce()));
  T("le bandeau defile par lui-meme, a l'horizontale seulement", bandeau.length === 1 && bandeau[0].left === 120 && !("top" in bandeau[0]), JSON.stringify(bandeau));
  T("c'est l'echiquier qui est ramene sous les yeux", surEchiquier() === 1, String(surEchiquier()));

  console.log("Les autres chemins");
  raz();
  $("navScroll").querySelector('[data-ply="4"]').click();
  T("toucher une puce du bandeau : pas de scrollIntoView sur une puce", w.eval("reviewPly") === 4 && surPuce() === 0 && bandeau.length === 1);
  raz();
  presser(w, "ArrowLeft");
  T("fleche du clavier : pareil", w.eval("reviewPly") === 3 && surPuce() === 0 && bandeau.length === 1 && surEchiquier() === 0);
  w.eval("navChipCible=()=>0");
  /* Le defilement precedent est fini (le navigateur le dit par scrollend,
     ou un delai de 400 ms la ou il ne le dit pas). */
  $("navScroll").dispatchEvent(new w.Event("scrollend"));
  await pause(600);
  raz();
  presser(w, "ArrowLeft");
  T("puce deja centree : aucun defilement, et la synchro du bandeau n'est pas retenue", w.eval("reviewPly") === 2 && bandeau.length === 0 && w.eval("navScrollSuppressed") === false);

  console.log("Reglage Animations coupe");
  w.eval("navChipCible=()=>80;animOn=false");
  raz();
  presser(w, "ArrowRight");
  T("sans animation, le bandeau se place d'un coup", bandeau.length === 1 && bandeau[0].behavior === "auto" && bandeau[0].left === 80, JSON.stringify(bandeau));
  w.eval("animOn=true");
  raz();
  presser(w, "ArrowRight");
  T("avec animation, il glisse", bandeau.length === 1 && bandeau[0].behavior === "smooth");

  console.log("Partie entre amis par lien");
  w.eval("setMode('friend');amiColor=W;newAmiGame();for(const u of ['e2e4','e7e5','g1f3'])playAmi(game.moves().find(m=>game.uci(m)===u))");
  w.eval("navChipCible=()=>60");
  raz();
  presser(w, "ArrowLeft");
  T("son bandeau aussi ne defile que par lui-meme", w.eval("reviewPly") === 2 && surPuce() === 0 && bandeau.length === 1 && bandeau[0].left === 60);
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
