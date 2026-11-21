/* Verification automatique de chang64.
   Lancement : node tests/check_tes_parties.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, decision d'Alexandre) : UN SEUL « Tes
   parties » dans l'onglet Jouer.
   - la meme liste, le meme bloc de page, sous l'ecran contre l'ordinateur
     et sous l'ecran contre un ami : pas de seconde liste ;
   - elle montre les trois sortes de parties (ordinateur, entre amis par
     lien, en direct), de la plus recente a la plus ancienne, avec les
     filtres Toutes, Ordinateur, Entre amis, Direct ; « Correspondance » est
     prevue dans le code sans etre proposee ;
   - chaque ligne nomme l'adversaire et donne le resultat, la cadence et la
     date ; la sorte des parties gardees avant ce chantier est deduite ;
   - la limite reste : 5 parties sans compte puis l'invitation, 30 au plus ;
   - chaque partie se rouvre en revue coup par coup, avec l'analyse, quelle
     que soit sa sorte : une partie entre humains aussi. */
const { ouvrir } = require("./outils/page_langue.js");
const { presser } = require("./outils/touches.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
/* Attend qu'une condition soit vraie, sans depasser max millisecondes. */
const jusqua = async (cond, max) => { const fin = Date.now() + max; while (Date.now() < fin) { if (cond()) return true; await pause(100); } return cond(); };
const propre = s => String(s).replace(/[\u00a0\u202f]/g, " ");

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const lignes = () => [...d.querySelectorAll("#historyList .history-item")];
  const noms = () => lignes().map(b => propre(b.querySelector(".meta b").textContent)).join(" ; ");
  const filtres = () => [...d.querySelectorAll("#historyFiltres .chip")];
  const filtre = k => filtres().find(b => b.dataset.sorte === k);
  const solide = propre(d.querySelector('#segLevel [data-v="3"]').textContent.trim());

  /* Cinq parties gardees AVANT ce chantier : aucune ne porte sa sorte. */
  const J = Date.UTC(2026, 10, 20, 12, 0, 0);
  w.eval("cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};" +
    "history=[" +
    "{t:" + (J + 5000) + ",c:'w',r:'win',tc:'10+0',lvl:3,elo:1500,m:'e2e4 e7e5 g1f3 b8c6',fen:null}," +
    "{t:" + (J + 3000) + ",c:'b',r:'loss',tc:'5+3',adv:'Bob',m:'d2d4 d7d5 c2c4 e7e6 b1c3 g8f6',fen:null}," +
    "{t:" + (J + 1000) + ",c:'w',r:'draw',tc:'',lvl:1,elo:800,m:'e2e4 c7c5 g1f3 d7d6',fen:null}];" +
    "amiHistory=[" +
    "{t:" + (J + 4000) + ",c:'w',r:'win',m:'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7'}," +
    "{t:" + (J + 2000) + ",c:'b',r:'loss',m:'g1f3 d7d5'}];" +
    "setMode('play');renderHistory()");

  console.log("Sous l'ecran contre l'ordinateur");
  T("un seul bloc « Tes parties » dans la page", d.querySelectorAll("#historyPanel").length === 1 && d.querySelectorAll(".history").length === 1 && !$("amiHistoryPanel") && !$("amiHistoryList"));
  T("il est sous l'ecran contre l'ordinateur", $("historyPanel").parentNode === $("pane-play") && !cache("historyPanel") && propre($("historyTitleTxt").textContent) === "Tes parties");
  T("les cinq parties, des trois sortes, de la plus recente a la plus ancienne", lignes().length === 5 && lignes().map(b => b.dataset.sorte).join("") === "oldlo", lignes().map(b => b.dataset.sorte).join(""));
  T("la sorte des anciennes parties est deduite", w.eval("toutesParties().map(e=>e.k).join('')") === "oldlo");
  T("chaque ligne nomme l'adversaire", noms() === "Chang | " + solide + " ; Un ami ; Bob ; Un ami ; Chang | " + propre(d.querySelector('#segLevel [data-v="1"]').textContent.trim()), noms());
  const txt = i => propre(lignes()[i].textContent);
  T("le resultat : gagnee, perdue, nulle", lignes()[0].querySelector(".res.win") && lignes()[2].querySelector(".res.loss") && lignes()[4].querySelector(".res.draw") && propre(lignes()[0].querySelector(".res").textContent).length === 1);
  T("la cadence", / \| 10\+0 \| /.test(txt(0)) && / \| 5\+3 \| /.test(txt(2)) && / \| Sans pendule \| /.test(txt(4)), txt(0) + " // " + txt(4));
  T("la date", /\d\d\/11 \d\d:\d\d/.test(txt(0)) && /\d\d\/11 \d\d:\d\d/.test(txt(3)), txt(0));
  T("le nombre de parties gardees est dit", /^5 partie/.test(propre($("historyNote").textContent)), $("historyNote").textContent);

  console.log("Les filtres");
  T("Toutes, Ordinateur, Entre amis, Direct ; pas de Correspondance", filtres().map(b => propre(b.textContent)).join(" | ") === "Toutes | Ordinateur | Entre amis | Direct", filtres().map(b => b.textContent).join(" | "));
  T("« Correspondance » est prevue dans le code, sans etre proposee", w.eval("PARTIES_SORTES.some(s=>s.k==='c'&&s.cache)") && w.eval("partieSorte({k:'c',m:'e2e4'},'jeu')") === "c");
  T("« Toutes » est choisi au depart", filtre("").getAttribute("aria-pressed") === "true" && filtres().filter(b => b.getAttribute("aria-pressed") === "true").length === 1);
  filtre("d").click();
  T("Direct : la partie contre Bob seule", lignes().length === 1 && noms() === "Bob" && filtre("d").getAttribute("aria-pressed") === "true" && filtre("").getAttribute("aria-pressed") === "false", noms());
  filtre("l").click();
  T("Entre amis : les deux parties par lien", lignes().length === 2 && noms() === "Un ami ; Un ami");
  filtre("o").click();
  T("Ordinateur : les deux parties contre Chang", lignes().length === 2 && lignes().every(b => /^Chang/.test(propre(b.querySelector(".meta b").textContent))));
  w.eval("history=history.filter(g=>g.adv);renderHistory()");
  T("un filtre sans partie le dit", lignes().length === 0 && /Aucune partie de cette sorte/.test(propre($("historyList").textContent)), $("historyList").textContent);
  filtre("").click();
  T("Toutes : tout revient", lignes().length === 3);

  console.log("Sous l'ecran contre un ami");
  filtre("l").click();
  w.eval("setMode('friend')");
  T("le meme bloc est venu se poser sous cet ecran", $("historyPanel").parentNode === $("pane-friend") && d.querySelectorAll("#historyPanel").length === 1 && !cache("historyPanel") && w.getComputedStyle($("historyPanel")).display !== "none");
  T("il est le dernier bloc de l'ecran", $("pane-friend").lastElementChild === $("historyPanel"));
  T("meme liste, filtre garde", lignes().length === 2 && filtre("l").getAttribute("aria-pressed") === "true");
  filtre("").click();
  T("les parties contre l'ordinateur et en direct s'y voient aussi", lignes().length === 3 && /Bob/.test(noms()));
  w.eval("setMode('play')");
  T("retour contre l'ordinateur : le bloc revient a sa place, avant le PGN", $("historyPanel").parentNode === $("pane-play") && $("historyPanel").nextElementSibling === $("pgnPanel"));

  console.log("Une partie entre humains se rouvre en revue, avec l'analyse");
  w.eval("setMode('friend')");
  lignes().find(b => b.dataset.sorte === "l").click();
  T("par lien, depuis l'ecran contre un ami : la revue de Jouer", w.eval("mode") === "play" && w.eval("isReviewGame") === true && w.eval("game.history.length") === 7 && w.eval("reviewPly") === 0);
  T("l'adversaire est nomme au-dessus de l'echiquier", propre($("clockTopName").textContent) === "Un ami" && propre($("clockBottomName").textContent) === "Toi", $("clockTopName").textContent);
  T("le panneau Revue et « Analyser la partie » sont la", !cache("reviewPanel") && !$("btnAnalyse").disabled && !cache("navRow"));
  presser(w, "ArrowRight"); presser(w, "ArrowRight");
  T("elle se parcourt coup par coup", w.eval("reviewPly") === 2 && (d.querySelector('#navScroll [aria-current="true"]') || {}).dataset.ply === "2");
  /* Stockfish ne se telecharge pas sous jsdom : la relecture se rabat sur le
     moteur integre, par le meme bouton. */
  w.eval("sf.ready=false;sfEnable=()=>Promise.resolve(false)");
  $("btnAnalyse").click();
  await jusqua(() => w.eval("!!analysis"), 15000);
  T("l'analyse couvre toute la partie", w.eval("!!analysis&&analysis.plies.length") === 7 && !cache("analysisOut") && /%/.test($("accScore").textContent), String(w.eval("analysis&&analysis.plies.length")));
  presser(w, "ArrowRight");
  T("le commentaire du coup s'affiche en revue", w.eval("reviewPly") === 3 && !cache("plyInfo"));
  T("pendant la revue, « Tes parties » reste sous l'echiquier", $("historyPanel").parentNode === $("pane-play") && !cache("historyPanel"));
  lignes().find(b => b.dataset.sorte === "d").click();
  T("en direct, depuis l'ecran contre l'ordinateur", w.eval("isReviewGame") === true && w.eval("game.history.length") === 6 && propre($("clockTopName").textContent) === "Bob" && w.eval("flipped") === true && w.eval("analysis") === null);
  w.eval("sf.ready=false");
  $("btnAnalyse").click();
  await jusqua(() => w.eval("!!analysis"), 15000);
  T("son analyse aussi", w.eval("!!analysis&&analysis.plies.length") === 6, String(w.eval("analysis&&analysis.plies.length")));

  console.log("Les nouvelles parties portent leur sorte");
  w.eval("setMode('friend');amiColor=W;newAmiGame();" +
    "for(const u of ['e2e4','e7e5','g1f3'])playAmi(game.moves().find(m=>game.uci(m)===u));amiResigned=B;showAmi()");
  T("par lien : sorte et rythme gardes", w.eval("amiHistory[0].k") === "l" && w.eval("amiHistory[0].p") === w.eval("amiPace") && w.eval("amiHistory[0].r") === "win");
  T("sa ligne dit le rythme", / jours?\/coup \| /.test(propre(lignes()[0].textContent)) && lignes()[0].dataset.sorte === "l", lignes()[0] && lignes()[0].textContent);
  $("resultAnalyse").click();
  T("« Revoir » la rouvre en revue", w.eval("mode") === "play" && w.eval("isReviewGame") === true && w.eval("game.history.length") === 3);
  w.eval("colorMode='w';myColor=W;tcCat='none';setMode('play',{fresh:true})");
  await pause(200);
  if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
  for (const u of ["e2e4", "d2d4"]) { w.eval("playUser(game.moves().find(m=>game.uci(m)==='" + u + "'))"); await pause(500); }
  w.eval("setMode('friend')");
  T("une partie contre l'ordinateur attend : la liste s'efface sous l'ecran ami", cache("historyPanel"));
  w.eval("setMode('play')");
  $("btnResign").click(); $("btnResign").click();
  await pause(300);
  T("contre l'ordinateur : sorte gardee", w.eval("history[0].k") === "o" && w.eval("history[0].lvl") === w.eval("botLevel"), JSON.stringify(w.eval("history[0]&&history[0].k")));

  console.log("Les limites restent");
  w.eval("cp=null;localStorage.removeItem('chang64:compte');" +
    "history=Array.from({length:6},(x,i)=>({t:1e12-i*2000,c:'w',r:'win',tc:'10+0',lvl:2,m:'e2e4 e7e5 g1f3 b8c6'}));" +
    "amiHistory=Array.from({length:6},(x,i)=>({t:1e12-1000-i*2000,c:'w',r:'loss',m:'e2e4 e7e5'}));partiesFiltre='';renderHistory()");
  T("sans compte : cinq parties, puis l'invitation a creer un compte", w.eval("estMembre()") === false && lignes().length === 5 && !!d.querySelector("#historyList .membre-invite [data-vue-compte]"), String(lignes().length));
  filtre("l").click();
  T("sans compte, avec un filtre : cinq aussi", lignes().length === 5 && lignes().every(b => b.dataset.sorte === "l") && !!d.querySelector("#historyList .membre-invite"));
  filtre("").click();
  w.eval("cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};renderHistory()");
  T("avec un compte : les douze", lignes().length === 12 && !d.querySelector("#historyList .membre-invite"));
  w.eval("history=Array.from({length:30},(x,i)=>({t:1e12-i*2000,c:'w',r:'win',tc:'10+0',lvl:2,m:'e2e4 e7e5 g1f3 b8c6'}));" +
    "amiHistory=Array.from({length:30},(x,i)=>({t:1e12-1000-i*2000,c:'w',r:'loss',m:'e2e4 e7e5'}));renderHistory()");
  T("trente parties au plus dans la liste, les plus recentes", lignes().length === 30 && /^30 partie/.test(propre($("historyNote").textContent)) && lignes().filter(b => b.dataset.sorte === "l").length === 15);

  console.log("Effacer");
  $("btnHistoryClear").click();
  T("effacer demande une confirmation", w.eval("history.length") === 30 && propre($("btnHistoryClear").textContent) === "Confirmer");
  $("btnHistoryClear").click();
  await pause(50);
  T("puis vide la liste entiere, les trois sortes", w.eval("history.length") === 0 && w.eval("amiHistory.length") === 0 && lignes().length === 0 && cache("historyFiltres") && cache("historyActions") && !!d.querySelector("#historyList .history-empty"), $("historyList").textContent);
  T("et les deux rangements du navigateur", w.localStorage.getItem("chang64:games") === "[]" && w.localStorage.getItem("chang64:friendgames") === "[]", w.localStorage.getItem("chang64:games") + " " + w.localStorage.getItem("chang64:friendgames"));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
