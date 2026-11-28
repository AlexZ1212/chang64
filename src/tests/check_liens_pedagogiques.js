/* Verification automatique de chang64.
   Lancement : node tests/check_liens_pedagogiques.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Liens vers le contenu pedagogique (choix d'Alexandre par QCM le 28/11 :
   toutes les pistes, la lecon s'ouvre sur place dans un volet). Une section
   par lien, chacune avec au moins une garde qui echoue sans le lien.
   Le code vit dans site/lecons.js, a part du script principal (garde-fou de
   600 000 caracteres) : jsdom ne charge pas les scripts externes, on
   l'evalue donc a la main apres l'ouverture de la page.
   Les mesures a 360 px sont faites dans un vrai navigateur par
   mesure_liens_pedagogiques.js, pas ici. La piste 6 (pages du site entre
   elles) a son test : check_liens_pages.js. */
const fs = require("fs"), path = require("path");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const propre = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const pause = ms => new Promise(r => setTimeout(r, ms));
const LANGUES = ["fr", "en", "es", "pt", "de", "ru", "it", "tr", "pl", "id"];
const LECONS_JS = fs.readFileSync(path.join(SITE, "lecons.js"), "utf8");
async function page(lang) {
  const w = await ouvrir(lang, { attente: 2200, fetch: true });
  w.eval(LECONS_JS);
  await w.LECONS.charger();
  await pause(30);
  return w;
}
/* Une analyse posee a la main (meme outil que check_coach_revue.js). */
const poserAnalyse = (w, n, fautes) => w.eval("(function(){const F=" + JSON.stringify(fautes) + ",P=[];for(let i=0;i<" + n + ";i++){const f=F[i]||{};" +
  "P.push({cp:0,cpTrue:0,mate:null,loss:f.loss||0,tag:f.tag||null,best:f.best||gameUci[i],mover:i%2,rep:f.rep||null,pv:f.pv||null,pvr:f.pvr||null});}" +
  "finishAnalysis(P,coachPreparerSansMoteur(P));})()");

(async () => {
  console.log("--- Socle : fichier a part, donnees ---");
  for (const l of LANGUES) {
    const h = fs.readFileSync(path.join(SITE, l === "en" ? "" : l, "index.html"), "utf8");
    T(l + " : la page appelle /lecons.js avec son empreinte, en defer", /<script src="\/lecons\.js\?v=[0-9a-f]{10}" defer><\/script>/.test(h));
    const d = JSON.parse(fs.readFileSync(path.join(SITE, "data", "lecons-" + l + ".json"), "utf8"));
    T(l + " : les 9 lecons de motifs ont titre, paragraphe, position et adresse",
      ["spotting-a-hanging-piece", "knight-fork", "pawn-fork", "double-attack", "the-pin", "the-skewer", "back-rank-mate", "deflection"]
        .every(k => d.l[k] && d.l[k].t && d.l[k].p && d.l[k].f && d.l[k].u) && d.l["the-quiet-move"] && d.l["the-quiet-move"].u);
    T(l + " : les lecons des nulles, du pat, de la promotion, de l'ouverture", ["how-games-are-drawn", "check-checkmate-stalemate", "pawn-promotion", "opening-principles"].every(k => d.l[k] && d.l[k].t));
    T(l + " : les mots du lexique (Gaffe, Erreur, Imprecision, Elo)", ["blunder", "mistake", "inaccuracy", "elo-rating"].every(k => d.g[k] && d.g[k].p && d.g[k].u));
    T(l + " : chaque adresse mene a une page du site", [...Object.values(d.l), ...Object.values(d.g)].every(e => fs.existsSync(path.join(SITE, e.u + ".html"))));
  }
  {
    const fr = JSON.parse(fs.readFileSync(path.join(SITE, "data", "lecons-fr.json"), "utf8"));
    T("fr : espace insecable avant « : » dans le texte des lecons", !/ :/.test(fr.l["knight-fork"].p) && / :/.test(fr.l["knight-fork"].p));
    T("le motif a s'entrainer est donne (Knight fork)", fr.l["knight-fork"].m === "Knight fork");
  }
  T("_headers : /lecons.js est servi en JavaScript, cache long", /\/lecons\.js\n  Content-Type: text\/javascript; charset=utf-8\n  Cache-Control: public, max-age=31536000, immutable/.test(fs.readFileSync(path.join(SITE, "_headers"), "utf8")));

  const w = await page("fr");
  const d = w.document, $ = id => d.getElementById(id), ev = x => w.eval(x);

  console.log("--- Volet ---");
  {
    const h = d.createElement("div");
    d.body.appendChild(h);
    ev("poserHtml")(h, w.LECONS.voletHtml("knight-fork"));
    const b = h.querySelector(".lecon-ligne"), c = h.querySelector(".lecon-corps");
    T("une ligne « Pour comprendre : La fourchette de cavalier »", propre(b.textContent) === "Pour comprendre : La fourchette de cavalier", propre(b.textContent));
    T("francais : espace insecable avant « : »", / :/.test(b.textContent));
    T("repliee au depart, corps vide", b.getAttribute("aria-expanded") === "false" && c.hidden && !c.firstChild);
    b.click();
    T("un toucher deplie : petit echiquier, paragraphe, lien vers la lecon", b.getAttribute("aria-expanded") === "true" && !c.hidden &&
      c.querySelectorAll(".lecon-plateau i").length === 64 && /fourchette/.test(c.querySelector("p").textContent) &&
      c.querySelector(".lecon-actions a").getAttribute("href") === "/fr/apprendre/la-fourchette-de-cavalier");
    T("le lien dit « Lire la leçon en entier »", propre(c.querySelector(".lecon-actions a").textContent) === "Lire la leçon en entier");
    T("« S'entrainer » mene au motif", !!c.querySelector(".lecon-motif[data-motif='Knight fork']"));
    T("les pieces de la position sont dessinees (cavalier, tour, deux rois)", c.querySelectorAll(".lecon-plateau svg").length === 4, c.querySelectorAll(".lecon-plateau svg").length);
    b.click();
    T("un second toucher replie", b.getAttribute("aria-expanded") === "false" && c.hidden);
    h.remove();
  }

  console.log("--- P1. Apres un exercice ---");
  {
    ev("setMode('puzzles',{screen:'puzzles'})");
    for (let i = 0; i < 40 && !ev("!!(puzzle&&puzzle.id&&puzzle.theme)"); i++) await pause(250);
    /* Le motif de l'exercice tire au hasard est remplace : seul compte ce que
       lit la ligne. */
    ev("puzzle.theme='Knight fork';puzzleDone=false");
    T("un exercice de fourchette de cavalier est a l'ecran", ev("puzzle&&puzzle.theme") === "Knight fork", ev("puzzle&&puzzle.theme"));
    T("pendant l'exercice : aucune ligne", !$("exLecon") || $("exLecon").hidden);
    ev("finishPuzzle(true,'ok')");
    await pause(30);
    const l = $("exLecon") && $("exLecon").querySelector(".lecon-ligne");
    T("exercice reussi : « Pour comprendre : La fourchette de cavalier » sous l'explication", l && propre(l.textContent) === "Pour comprendre : La fourchette de cavalier" && $("exPedagogy").nextElementSibling === $("exLecon"), l && l.textContent);
    T("la ligne suit la regle « hors-sprint »", $("exLecon").classList.contains("hors-sprint"));
    ev("loadPuzzle()");
    T("exercice suivant : la ligne disparait", $("exLecon").hidden);
    ev("puzzle.theme='Winning move';puzzleDone=false;finishPuzzle(false,'x')");
    await pause(30);
    T("motif « Coup gagnant » (sans lecon) : rien", $("exLecon").hidden);
    ev("puzzle.theme='Pin';puzzleDone=false;rush={score:0,history:[]};finishPuzzle(false,'x');rush=null");
    await pause(30);
    T("pendant un Sprint : rien", $("exLecon").hidden);
    ev("puzzle.theme='Pin';puzzleDone=false;finishPuzzle(false,'x')");
    await pause(30);
    T("exercice rate : la ligne aussi (Le clouage)", !$("exLecon").hidden && /Le clouage/.test(propre($("exLecon").textContent)), $("exLecon").textContent);
    ev("puzzle.theme='Mate in two';puzzleDone=false;finishPuzzle(false,'x')");
    await pause(30);
    T("mat en deux, chapitre 9 ferme : rien", $("exLecon").hidden);
  }

  console.log("--- P2. Sous le coach ---");
  {
    ev("prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
    T("avant l'analyse : pas de rubrique", !$("coachLecons") || $("coachLecons").hidden);
    poserAnalyse(w, 12, { 8: { tag: "blunder", loss: 310, best: "g5h4", rep: "h6g5" }, 10: { tag: "mistake", loss: 150, best: "g1f3", rep: "f8e7" } });
    await pause(150);
    const h = $("coachLecons");
    T("apres l'analyse : « Pour comprendre » sous la liste du coach", h && !h.hidden && $("coachListe").nextElementSibling === h && propre(h.querySelector(".lecons-titre").textContent) === "Pour comprendre", h && h.innerHTML.slice(0, 200));
    const lignes = h ? [...h.querySelectorAll(".lecon-ligne")].map(b => propre(b.textContent)) : [];
    T("une ligne pour la piece laissee en prise : Reperer une piece qui traine", lignes.length === 1 && /pièce qui traîne/i.test(lignes[0]), lignes.join(" | "));
    T("casLecon : fourchette de cavalier, de pion, d'une autre piece", ev("(function(){rebuildTo=function(){return {game:new Game('4k3/8/8/8/8/8/8/R3K1N1 w - - 0 1')}};gameUci=['a1a2'];" +
      "const a=LECONS.casLecon(0,{cas:'fourchette_manquee',de:'avant',coup:'g1f3'}),b=LECONS.casLecon(0,{cas:'fourchette_manquee',de:'avant',coup:'a1a7'});return a+','+b})()") === "knight-fork,double-attack");
  }

  console.log("--- P3. Partie nulle : la raison ---");
  {
    const raison = fen => ev("LECONS.raisonNulle(new Game(" + JSON.stringify(fen) + "))");
    T("roi contre roi : plus assez de pieces", propre(raison("8/8/4k3/8/8/4K3/8/8 w - - 0 1")) === "Nulle : il ne reste plus assez de pièces pour mater.");
    T("50 coups sans prise ni coup de pion", propre(raison("8/8/4k3/8/8/4K3/4R3/8 w - - 100 80")) === "Nulle : cinquante coups sans prise ni coup de pion.");
    T("pat : la phrase existante reste (rien a ajouter)", raison("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1") === "");
    ev("setMode('play');newGame&&0;game=new Game('8/8/4k3/8/8/4K3/8/8 w - - 0 1');legalCache=game.moves();resultInfo=null;gameStarted=true");
    const r = ev("gameOver()");
    T("contre l'ordinateur : gameOver dit la raison dans le statut", r && propre($("status").textContent) === "Nulle : il ne reste plus assez de pièces pour mater." && propre(ev("resultInfo.sub")) === propre($("status").textContent), $("status").textContent);
    ev("renderResult(true)");
    await pause(30);
    const h = $("finLecon");
    T("sous le statut : « Pour comprendre : Toutes les façons de faire nulle »", h && !h.hidden && /faire nulle/i.test(propre(h.textContent)) && $("status").nextElementSibling === h, h && h.textContent);
    ev("resultInfo=null;renderResult(false)");
    T("nouvelle partie : la ligne disparait", h.hidden);
  }

  console.log("--- P4. Finale atteinte ---");
  {
    T("roi et dame contre roi, cote fort : kq", ev("LECONS.finaleAtteinte(new Game('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1'),W)") === "kq");
    T("du cote faible : rien", ev("LECONS.finaleAtteinte(new Game('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1'),B)") === "");
    T("fou et cavalier : kbn ; un pion de trop chez l'autre : rien", ev("LECONS.finaleAtteinte(new Game('7k/8/6K1/8/8/8/8/4BN2 w - - 0 1'),W)") === "kbn" && ev("LECONS.finaleAtteinte(new Game('7k/7p/6K1/8/8/8/8/5Q2 w - - 0 1'),W)") === "");
    ev("setMode('play');myColor=W;game=new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');legalCache=game.moves();resultInfo=null;gameStarted=true;gameOver();renderResult(true)");
    await pause(30);
    const h = $("finLecon"), aller = h && h.querySelector(".lecon-aller[data-finale='kq']");
    T("pat dans dame contre roi : « Cette finale se gagne a coup sur : entraine-toi a mater »", aller && propre(aller.textContent) === "Cette finale se gagne à coup sûr : entraîne-toi à mater.", h && h.textContent);
    T("et la lecon du pat", h && /Échec, mat et pat/i.test(propre(h.textContent)), h && h.textContent);
    aller.click();
    await pause(50);
    T("un toucher ouvre l'entraineur sur dame contre roi", ev("mode") === "puzzles" && ev("eg&&eg.scen.id") === "kq", ev("mode") + " " + ev("eg&&eg.scen.id"));
    ev("setMode('play');myColor=W;game=new Game('7k/5Q2/5K2/8/8/8/8/8 w - - 0 1');resultInfo={kind:'win',title:'',sub:''};renderResult(true)");
    await pause(30);
    T("partie gagnee dans cette finale : « Tu as eu la finale Dame contre Roi »", /Tu as eu la finale Dame contre Roi/.test(propre($("finLecon").textContent)), $("finLecon").textContent);
  }

  console.log("--- A. Le nom de l'ouverture pendant une partie ---");
  {
    ev("setMode('play');resultInfo=null;gameStarted=true;isReviewGame=false;sanList=['e4','e5','Nf3','Nc6','Bc4'];OPENING_DATA=null");
    /* Livre d'ouvertures : on l'attend (charge a la demande). */
    for (let i = 0; i < 30 && !ev("OPENING_DATA"); i++) { ev("loadOpeningBook()"); await pause(100); }
    ev("renderOpening()");
    T("partie en cours : le nom est la, sans lien", propre($("opening").textContent).length > 3 && !$("opening").querySelector("a"), $("opening").innerHTML);
    ev("resultInfo={kind:'win',title:'',sub:''};renderOpening()");
    T("partie finie : le lien revient", !!$("opening").querySelector("a"), $("opening").innerHTML);
    ev("resultInfo=null;gameStarted=false");
  }

  console.log("--- P5. Erreurs a revoir ---");
  {
    ev("ensureProgFields();const n=Date.now()-1000;prog.mistakeQueue=[{id:'a',theme:'Knight fork',due:n,box:1},{id:'b',theme:'Knight fork',due:n,box:1},{id:'c',theme:'Pin',due:n,box:1},{id:'d',theme:'Mate in one',due:n,box:1},{id:'e',theme:'Mate in one',due:n,box:1},{id:'f',theme:'Mate in one',due:n,box:1}];renderMistakeQueue()");
    await pause(30);
    const r = $("mistakeGrid").querySelector(".lecons-revient");
    T("« Ce qui revient le plus : Fourchette de cavalier. » (le motif le plus frequent qui a une lecon)", r && /Ce qui revient le plus : Fourchette de cavalier\./.test(propre(r.textContent)), r && r.textContent);
    T("avec son volet", r && r.querySelector(".lecon-ligne[aria-controls]") && /La fourchette de cavalier/.test(propre(r.querySelector(".lecon-ligne").textContent)));
    T("les pastilles ne changent pas (trois motifs)", $("mistakeGrid").querySelectorAll(".erreurs-pastille").length === 3);
    ev("prog.mistakeQueue=[{id:'g',theme:'Winning move',due:Date.now()-1000,box:1}];renderMistakeQueue()");
    await pause(30);
    T("seulement des motifs sans lecon : rien", !$("mistakeGrid").querySelector(".lecons-revient"));
  }

  console.log("--- P7. La fiche d'un badge ---");
  {
    T("badge de motif : la lecon (fourchette de cavalier)", /data-lecon="knight-fork"/.test(ev("LECONS.badgeHtml('theme_knight_fork_10')")));
    T("badge de finale : « S'entrainer sur cette finale »", /data-finale="kr"/.test(ev("LECONS.badgeHtml('eg_kr')")) && /S(’|'|&#39;)entraîner sur cette finale/.test(propre(ev("LECONS.badgeHtml('eg_kr')"))));
    T("palier du Niveau exercices : le mot Elo du lexique", /data-lecon="g:elo-rating"/.test(ev("LECONS.badgeHtml('rating_1000')")));
    T("chapitre ferme : rien ; badge sans lecon : rien", ev("LECONS.badgeHtml('ch_mat2')") === "" && ev("LECONS.badgeHtml('days_7')") === "");
    T("« Subir le coup du berger en moins de 10 coups » mene au piege", JSON.stringify(ev("BX_LIENS.lec_berger")) === '["p","scholars-mate"]');
    ev("bxFiche('theme_pin')");
    await pause(30);
    T("dans la fiche : le volet sous le lien", $("bravoLecon") && !$("bravoLecon").hidden && /Le clouage/.test(propre($("bravoLecon").textContent)), $("bravoLecon") && $("bravoLecon").textContent);
    ev("bravoFermer()");
  }

  console.log("--- P9. Gaffe, Erreur, Imprecision ; Elo ---");
  {
    ev("prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu')");
    poserAnalyse(w, 12, { 8: { tag: "blunder", loss: 310, best: "g5h4", rep: "h6g5" } });
    await pause(100);
    ev("gotoPly(9)");
    await pause(50);
    const q = $("plyInfo").querySelector(".lecon-mot");
    T("relecture : un « ? » a cote de « Gaffe »", q && q.previousElementSibling && /Gaffe/.test(q.previousElementSibling.textContent), $("plyInfo").innerHTML.slice(0, 300));
    T("son nom : « Que veut dire « Gaffe » ? »", q && propre(q.getAttribute("aria-label")) === "Que veut dire « Gaffe » ?", q && q.getAttribute("aria-label"));
    q && q.click();
    const c = q && $(q.getAttribute("aria-controls"));
    T("un toucher montre la definition du lexique", c && !c.hidden && /perd du matériel/.test(c.textContent) && /\/fr\/lexique\/gaffe/.test(c.innerHTML), c && c.textContent.slice(0, 80));
    T("Statistiques : la definition de l'Elo dans « Comment marche cet Elo ? »", /data-lecon="g:elo-rating"/.test(ev("eloBloc('')")));
  }

  console.log("--- P8. Fin de chapitre d'Apprendre ---");
  {
    await ev("cheminPret(true)");
    /* Le chapitre, sur l'ecran de son boss (derniere etape), comme en vrai. */
    const tester = id => ev("cheminActiver(" + JSON.stringify(id) + ");setMode('debut');lecon.e=leconEtapes().length-1;lecon.x=0;debutCharger()");
    ev("cheminActiver('finales');setMode('debut');lecon.e=0;lecon.x=0;debutCharger()");
    await pause(30);
    T("pendant une lecon du chapitre : rien", !$("leconPlus") || $("leconPlus").hidden);
    tester("finales");
    await pause(30);
    T("chapitre 8 : « Pour aller plus loin » et les Finales", $("leconPlus") && !$("leconPlus").hidden && /Pour aller plus loin/.test($("leconPlus").textContent) && !!$("leconPlus").querySelector("[data-finales]"), $("leconPlus") && $("leconPlus").innerHTML.slice(0, 200));
    tester("ouverture");
    await pause(30);
    T("chapitre 7 : les principes d'ouverture et les pieges", /principes/i.test($("leconPlus").textContent) && /Pièges d’ouverture|Pièges d'ouverture/.test($("leconPlus").textContent), $("leconPlus").textContent);
    tester("regles");
    await pause(30);
    T("chapitre 2 : toutes les fiches", !!$("leconPlus").querySelector("a[href='/fr/apprendre/']"));
    tester("menaces");
    await pause(30);
    T("chapitre 5 : rien de plus", $("leconPlus").hidden);
  }

  w.close();

  console.log("--- Les dix langues : les libelles sont traduits ---");
  for (const l of LANGUES) {
    const wl = await page(l);
    const v = wl.LECONS.voletHtml("knight-fork");
    T(l + " : la ligne du volet est traduite", l === "en" ? /To understand: /.test(v) : !/To understand/.test(v), v.slice(0, 160));
    const cles = ["Read the whole lesson", "Draw: not enough pieces left to checkmate.", "What comes back most: {pattern}.", "To go further", "Practise this endgame", "Open the chapter", "To understand"];
    T(l + " : les autres libelles aussi", l === "en" || cles.every(k => wl.eval("t(" + JSON.stringify(k) + ")") !== k), cles.filter(k => wl.eval("t(" + JSON.stringify(k) + ")") === k).join(" | "));
    wl.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
