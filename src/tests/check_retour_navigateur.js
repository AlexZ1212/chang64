/* Verification automatique de chang64.
   Lancement : node tests/check_retour_navigateur.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Bouton Retour du navigateur et repere de la partie en cours (2026-11-21,
   constat d'Alexandre) : pendant une partie, ouvrir les Preferences
   remplacait l'ecran de partie, rien ne la rappelait, et le bouton Retour
   quittait le site. Desormais :
   - chaque ecran est une etape de l'historique du navigateur : Retour ramene
     a l'ecran d'avant, partie comprise, sans que l'adresse change ;
   - tant qu'une partie n'est pas finie et qu'on est ailleurs, une pastille
     marque l'onglet Jouer, et une ligne « Retour a la partie » s'affiche en
     haut des Preferences et des pages legales ;
   - la pendule ne s'arrete pas (elle se rattrape au retour, comme avant). */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  const mode = () => w.eval("mode");
  const retour = async () => { w.history.back(); await attendre(250); };
  const lignes = () => [...d.querySelectorAll(".retour-jeu")];
  const adresse = w.location.href;

  console.log("--- Sans partie ---");
  T("au depart : l'accueil, pas de repere", mode() === "home" && !$("tab-jouer").classList.contains("partie-en-cours") && lignes().length === 2 && lignes().every(l => l.hidden));
  const n0 = w.history.length;
  w.eval("setMode('puzzles')");
  T("changer d'ecran ajoute une etape a l'historique", w.history.length === n0 + 1 && w.history.state && w.history.state.c64 === "puzzles", w.history.length + " / " + JSON.stringify(w.history.state));
  w.eval("setMode('puzzles')");
  T("rester sur le meme ecran n'en ajoute pas", w.history.length === n0 + 1);
  T("l'adresse ne change pas", w.location.href === adresse, w.location.href);
  await retour();
  T("Retour ramene a l'accueil, sans quitter le site", mode() === "home" && w.location.href === adresse);
  w.history.forward(); await attendre(250);
  T("Suivant y retourne", mode() === "puzzles");

  console.log("--- Pendant une partie contre l'ordinateur ---");
  w.eval("setMode('play')");
  await attendre(200);
  $("btnNew").click(); await attendre(450);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await attendre(350); }
  T("la partie est lancee", w.eval("gameStarted") === true && w.eval("navPartie()") === "play");
  T("sur l'ecran de la partie : pas de pastille", !$("tab-jouer").classList.contains("partie-en-cours"));
  const fen = w.eval("game.fen()");
  w.eval("clock.last-=40000");   /* 40 secondes passent */
  $("footPrefs").click(); await attendre(200);
  T("Preferences ouvertes par le pied de page", mode() === "prefs");
  T("pastille sur l'onglet Jouer, dite aussi aux lecteurs d'ecran", $("tab-jouer").classList.contains("partie-en-cours") && net($("tab-jouer").getAttribute("aria-description")) === "Partie en cours");
  const ligne = d.querySelector("#pane-prefs .retour-jeu");
  T("ligne « Retour a la partie » en haut des Preferences", !ligne.hidden && net(ligne.textContent) === "Retour à la partie" && ligne.parentElement.firstElementChild === ligne, net(ligne.textContent));
  ligne.querySelector("button").click(); await attendre(250);
  T("elle ramene a la partie, dans la meme position", mode() === "play" && w.eval("game.fen()") === fen && w.eval("gameStarted") === true);
  T("la pendule n'a pas ete mise en pause : le temps ecoule est compte", w.eval("clockDrain();myColor===W?clock.w:clock.b") <= 600000 - 39000 || w.eval("clock.enabled") === false, String(w.eval("clock.w")));
  T("de retour sur la partie : plus de repere", !$("tab-jouer").classList.contains("partie-en-cours") && lignes().every(l => l.hidden));
  $("footLegal").click(); await attendre(200);
  T("pages legales : la meme ligne", mode() === "legal" && !d.querySelector("#pane-legal .retour-jeu").hidden);
  await retour();
  T("le bouton Retour du navigateur ramene a la partie", mode() === "play" && w.eval("game.fen()") === fen);
  w.eval("menuOuvrir()");
  $("footPrefs").click(); await attendre(150);
  w.eval("menuOuvrir()");
  await retour();
  await attendre(350);   /* le tiroir se referme en 260 ms */
  T("Retour ferme aussi le menu reste ouvert", mode() === "play" && $("menuTiroir").hidden);

  console.log("--- Partie finie ---");
  $("btnResign").click(); await attendre(160); $("btnResign").click(); await attendre(450);
  w.eval("setMode('prefs')"); await attendre(100);
  T("une partie finie n'attend plus personne : ni pastille ni ligne", w.eval("navPartie()") === "" && !$("tab-jouer").classList.contains("partie-en-cours") && lignes().every(l => l.hidden));

  console.log("--- Partie en direct ---");
  w.eval("setMode('friend');directId='aaaaaaaaaaaa';directRecu({t:'etat',id:'aaaaaaaaaaaa',n:1,cad:[600,0],moi:'b',b:'Moi',nr:'Lea',coups:['e2e4','e7e5'],tb:480000,tn:500000,maj:Date.now(),h:Date.now(),phase:'jeu',fin:null,nulle:null,rev:{b:false,n:false},la:{b:true,n:true},inv:null,elo:null})");
  await attendre(150);
  w.eval("setMode('prefs')"); await attendre(100);
  T("une partie en direct en cours : pastille et ligne", w.eval("navPartie()") === "friend" && $("tab-jouer").classList.contains("partie-en-cours") && !d.querySelector("#pane-prefs .retour-jeu").hidden);
  d.querySelector("#pane-prefs .retour-jeu button").click(); await attendre(200);
  T("la ligne ramene a la partie en direct", mode() === "friend" && w.eval("directActif()") === true);
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
