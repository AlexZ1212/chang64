/* Mesures a 360 px, dans un vrai navigateur, des liens vers les lecons
   (28/11, choix d'Alexandre : toutes les pistes, la lecon s'ouvre sur place).

   Usage :  node serveur_local.js 0          (dans une autre fenetre : il dit son port)
            node mesure_liens_pedagogiques.js http://localhost:<port> [ecrans] [dossier des captures]
            ecrans : liste separee par des virgules (ex. exercice,coach), tous par defaut.

   Chaque ecran est mesure dans les 10 langues, a 360 x 740, deux fois : avec
   la police telle quelle, puis elargie (letter-spacing .05em), parce que
   Safari sur iPhone dessine plus large que Chrome. Le volet est DEPLIE pour
   la mesure (le cas le plus large). Aucun debordement, aucun mot coupe,
   aucune ligne qui commence par « : ; ! ? ». Les outils de mesure sont ceux
   de mesure_correctifs_2711.js (relus dans ce fichier, pas recopies).
   Captures (francais, police elargie) : design/liens-pedagogiques/captures. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./tests/outils/chrome_sans_fenetre.js");
const { LANGUES } = require("./langues/registre.js");
const BASE = (process.argv[2] || "http://localhost:8071").replace(/\/$/, "");
const QUELS = process.argv[3] && process.argv[3] !== "tous" ? process.argv[3].split(",") : null;
const SORTIE = process.argv[4] || path.join(__dirname, "..", "design", "liens-pedagogiques", "captures");
const SRC = fs.readFileSync(path.join(__dirname, "mesure_correctifs_2711.js"), "utf8");
/* Le texte source des deux gabarits, interprete comme le fait leur fichier
   (les barres obliques doublees deviennent simples). */
const gabarit = brut => Function("return `" + brut + "`")();
const OUTILS = gabarit(SRC.slice(SRC.indexOf("const OUTILS = `") + 16, SRC.indexOf("`;\nconst ELARGIR")));
const ELARGIR = gabarit(SRC.slice(SRC.indexOf("const ELARGIR = `") + 17, SRC.indexOf("`;", SRC.indexOf("const ELARGIR = `"))));
if (!/window\.__m=/.test(OUTILS) || !/letter-spacing/.test(ELARGIR)) throw new Error("outils de mesure introuvables dans mesure_correctifs_2711.js");

/* Deplie tous les volets d'un hote. */
const deplier = sel => `(function(){for(const b of document.querySelectorAll(${JSON.stringify(sel + " .lecon-ligne[aria-controls]")}))if(b.getAttribute("aria-expanded")!=="true")b.click();return 1})()`;
const pret = `(async()=>{for(let i=0;i<40&&typeof LECONS==="undefined";i++)await new Promise(r=>setTimeout(r,100));if(typeof LECONS!=="undefined")await LECONS.charger();return 1})()`;
const ANALYSE = `(function(){const F={8:{tag:'blunder',loss:310,best:'g5h4',rep:'h6g5'},10:{tag:'mistake',loss:150,best:'g1f3',rep:'f8e7'}},P=[];
  for(let i=0;i<12;i++){const f=F[i]||{};P.push({cp:0,cpTrue:0,mate:null,loss:f.loss||0,tag:f.tag||null,best:f.best||gameUci[i],mover:i%2,rep:f.rep||null,pv:null,pvr:null});}
  finishAnalysis(P,coachPreparerSansMoteur(P));return 1})()`;
/* Une vraie partie contre l'ordinateur, lancee par « Commencer la partie »,
   puis la position finale posee : la fin se constate par gameOver, comme en jeu. */
const finir = fen => `(async()=>{setMode('play');newGame();await new Promise(r=>setTimeout(r,300));const r=document.getElementById('readyBanner');if(r&&!r.classList.contains('hide'))document.getElementById('readyStart').click();await new Promise(r=>setTimeout(r,300));
  myColor=W;flipped=false;game=new Game(${JSON.stringify(fen)});legalCache=game.moves();render();if(gameOver())afterGameRender(true);resultDismissed=true;renderResult(true);document.getElementById('statusPanel').scrollIntoView({block:'start'});return 1})()`;
const controleStd = sel => async c => [...await c.js(`__m.deborde(${JSON.stringify(sel)})`), ...await c.js(`__m.debuts(${JSON.stringify(sel)})`), ...await c.js(`__m.cesures(${JSON.stringify(sel)})`)];

const ECRANS = {
  exercice: {
    async prepare(c) {
      await c.js(`setMode('puzzles',{screen:'puzzles'});1`);
      await c.js(`(async()=>{for(let i=0;i<40&&!(puzzle&&puzzle.id);i++)await new Promise(r=>setTimeout(r,150));puzzle.theme='Knight fork';finishPuzzle(true,t('Correct!'));return 1})()`);
      await c.attendre(300);
      await c.js(deplier("#exLecon"));
      await c.attendre(200);
    },
    controle: controleStd("#exLecon"),
    capture: "#exLecon"
  },
  coach: {
    async prepare(c) {
      await c.js(`prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu');1`);
      await c.js(ANALYSE);
      await c.attendre(300);
      await c.js(deplier("#coachLecons"));
      await c.attendre(200);
    },
    controle: controleStd("#coachLecons"),
    capture: "#coachLecons"
  },
  mot: {
    async prepare(c) {
      await c.js(`prefAnnounce='moves';ouvrirPartieGardee({m:'e2e4 e7e5 f1c4 b8c6 d2d3 g8f6 c1g5 h7h6 b1c3 h6g5 d1d2 f8e7',c:'w',t:Date.UTC(2026,10,21,12),k:'o'},'jeu');1`);
      await c.js(ANALYSE);
      await c.attendre(200);
      await c.js(`gotoPly(9);1`);
      await c.attendre(300);
      await c.js(`(function(){const b=document.querySelector('#plyInfo .lecon-mot');if(b)b.click();return 1})()`);
      await c.attendre(200);
    },
    async controle(c) {
      const pb = await controleStd("#plyInfo")(c);
      if (!await c.js(`!!document.querySelector('#plyInfo .lecon-mot')`)) pb.push("pas de « ? » a cote de Gaffe");
      return pb;
    },
    capture: "#plyInfo"
  },
  nulle: {
    /* Pat dans dame contre roi : la ligne de l'entraineur et la lecon du pat. */
    async prepare(c) {
      await c.js(finir('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
      await c.attendre(300);
      await c.js(deplier("#finLecon"));
      await c.attendre(200);
    },
    controle: controleStd("#finLecon"),
    capture: "#finLecon"
  },
  repetition: {
    async prepare(c) {
      await c.js(finir('8/8/4k3/8/8/4K3/4R3/8 w - - 100 80'));
      await c.attendre(300);
      await c.js(deplier("#finLecon"));
      await c.attendre(200);
    },
    async controle(c) {
      return [...await controleStd("#finLecon")(c), ...await c.js(`__m.deborde("#status")`), ...await c.js(`__m.debuts("#status")`)];
    },
    capture: "#statusPanel"
  },
  erreurs: {
    async prepare(c) {
      await c.js(`(function(){ensureProgFields();const n=Date.now()-1000;prog.mistakeQueue=[{id:'a',theme:'Knight fork',due:n,box:1},{id:'b',theme:'Knight fork',due:n,box:1},{id:'c',theme:'Pin',due:n,box:1}];setMode('puzzles',{screen:'menu'});renderMistakeQueue();return 1})()`);
      await c.attendre(400);
      await c.js(deplier("#mistakeGrid"));
      await c.attendre(200);
    },
    controle: controleStd("#mistakeGrid .lecons-revient"),
    capture: "#mistakeSection"
  },
  badge: {
    async prepare(c) {
      await c.js(`bxFiche('theme_skewer_100');1`);
      await c.attendre(800);
      await c.js(deplier("#bravoLecon"));
      await c.attendre(200);
    },
    async controle(c) {
      const pb = await controleStd("#bravoLecon")(c);
      /* La fiche ne doit pas pousser « Continuer » hors de l'ecran sans qu'on puisse defiler. */
      const vu = await c.js(`(function(){const b=document.getElementById('bravoOk');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0})()`);
      if (!vu) pb.push("« Continuer » n'est pas atteignable dans la fiche");
      return pb;
    },
    capture: "#bravoLecon"
  },
  badgefinale: {
    async prepare(c) { await c.js(`bxFiche('eg_kbn');1`); await c.attendre(800); },
    controle: controleStd("#bravoLecon"),
    capture: "#bravoLecon"
  },
  chapitre: {
    async prepare(c) {
      await c.js(`(async()=>{await cheminPret(true);leconCh='ouverture';try{leconFinRendre({boss:null},0)}catch(e){};setMode('debut');document.getElementById('leconPlus')&&document.getElementById('leconPlus').scrollIntoView();return 1})()`);
      await c.attendre(400);
      await c.js(deplier("#leconPlus"));
      await c.attendre(200);
    },
    controle: controleStd("#leconPlus"),
    capture: "#leconPlus"
  },
  elo: {
    async prepare(c) {
      await c.js(`menuOuvrir();menuVue('stats');1`);
      await c.attendre(600);
      await c.js(`(function(){for(const d of document.querySelectorAll('.menu-explication'))d.open=true;return 1})()`);
      await c.js(deplier(".menu-explication"));
      await c.attendre(200);
    },
    /* Seulement le volet : le texte d'avant de « Comment marche cet Elo ? » a
       un mot compose coupe en allemand (« FIDE-Wertung », police elargie),
       note dans le compte rendu, hors de ce chantier. */
    controle: controleStd(".menu-explication .lecon-volet"),
    capture: ".menu-explication .lecon-volet"
  },
  pages: {
    /* Pages du site : la ligne « Voir aussi » d'une lecon, « Pour comprendre »
       du lexique et des exemples. */
    page: true,
    async controle(c) { return [...await c.js(`__m.deborde("main")`), ...await c.js(`__m.debuts(".voir-aussi")`), ...await c.js(`__m.cesures(".voir-aussi")`)]; },
    capture: ".voir-aussi"
  }
};
const PAGES = ["learn/knight-fork", "glossary/threefold-repetition", "puzzles/pin"];

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 300 });
  const pb = [];
  for (const nom of QUELS || Object.keys(ECRANS)) {
    const E = ECRANS[nom];
    if (!E) { pb.push("ecran inconnu : " + nom); continue; }
    for (const lg of LANGUES) {
      const l = lg.code;
      const urls = E.page ? PAGES.map(p => {
        const h = fs.readFileSync(path.join(__dirname, "site", p + ".html"), "utf8");
        const m = h.match(new RegExp('hreflang="' + l + '" href="https://chang64\\.com([^"]+)"'));
        return BASE + (m ? m[1] : "/" + p);
      }) : [BASE + lg.accueil];
      for (const url of urls) {
        for (const elargi of [false, true]) {
          await c.aller(url);
          if (!E.page) {
            await c.js(`localStorage.clear();localStorage.setItem("chang64:lang",${JSON.stringify(l)});1`);
            await c.aller(url);
            await c.attendre(700);
            await c.js(pret);
          }
          await c.js(OUTILS);
          if (elargi) await c.js(ELARGIR);
          if (E.prepare) await E.prepare(c, l);
          await c.js(OUTILS);
          for (const p of await E.controle(c, l)) pb.push(nom + " " + l + (elargi ? " (elargie) " : " ") + (E.page ? url.replace(BASE, "") + " " : "") + ": " + p);
          if (elargi && l === "fr") {
            await c.js(`(function(){const e=document.querySelector(${JSON.stringify(E.capture)});if(e)e.scrollIntoView({block:'center'});return 1})()`);
            await c.attendre(300);
            await c.capture(path.join(SORTIE, nom + (E.page ? "-" + url.split("/").pop() : "") + "-" + l + ".png"));
          }
        }
      }
    }
    console.log("ecran " + nom + " mesure");
  }
  await c.fermer();
  console.log(pb.length ? pb.join("\n") : "Aucun probleme.");
  console.log("\n" + pb.length + " probleme(s).");
  process.exit(pb.length ? 1 : 0);
})();
