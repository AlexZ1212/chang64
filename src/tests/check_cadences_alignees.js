/* Verification automatique de chang64.
   Lancement : node tests/check_cadences_alignees.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ajustements d'Alexandre du 22/11/2026 au soir :
   - les cadences s'affichent de la plus courte a la plus longue (« 10+0, 5+3,
     15+10 » se lisait mal) ;
   - les cadences entre membres suivent celles de l'ordinateur : le 5+3 est un
     Blitz des deux cotes (il etait range en Rapide entre membres), le Rapide
     offre 10+0, 10+5, 15+10 des deux cotes (le 10+5 est ajoute, numero 10) ;
     entre membres le Blitz garde toujours un increment (ni 3+0 ni 5+0,
     decision du 21/11), et il n'y a pas de Bullet ;
   - aucun numero de cadence ne change : les parties en cours et les
     invitations le portent ;
   - sur telephone, la rangee des familles de cadences et la barre d'onglets ne
     se laissent plus tirer de haut en bas. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const dit = x => JSON.stringify(x);
const net = s => String(s).replace(/[  ]/g, " ");
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));

(async () => {
  console.log("--- Le serveur et le site parlent des memes cadences ---");
  const worker = fs.readFileSync(path.join(__dirname, "..", "worker-parties", "index.js"), "utf8");
  const D = require("../direct.js");
  const cadServeur = new Function("return " + worker.match(/const CADENCES = (\[[\s\S]*?\]\]);/)[1].replace(/\/\*[\s\S]*?\*\//g, ""))();
  const familles = worker.match(/const FAMILLES = "([a-z]+)";/)[1];
  T("meme liste, dans le meme ordre, des deux cotes", dit(cadServeur) === dit(D.DIRECT_CADENCES), dit(cadServeur));
  T("les dix premieres cadences gardent leur numero", dit(cadServeur.slice(0, 10)) === dit([[600, 0], [300, 3], [900, 10], [1800, 0], [1800, 20], [3600, 0], [86400, 0], [259200, 0], [604800, 0], [180, 2]]));
  T("le 10+5 est ajoute a la suite, numero 10", dit(cadServeur[10]) === "[600,5]" && cadServeur.length === 11);
  T("une lettre de famille par cadence", familles.length === cadServeur.length, familles);
  T("tous les numeros tiennent sous 16 (la couleur de l'invite s'ajoute par 16)", cadServeur.length <= 16);
  const lettre = { Blitz: "b", Rapid: "r", Classical: "c" };
  T("la famille de l'ecran est celle de l'Elo, pour chaque cadence", D.DIRECT_FAMILLES.every(([nom, l]) => l.every(i => familles[i] === lettre[nom])) && D.DIRECT_CORR.every(i => familles[i] === "k"), familles);
  T("chaque cadence a la pendule est dans une famille, une seule fois", (() => { const l = D.DIRECT_FAMILLES.flatMap(f => f[1]).concat(D.DIRECT_CORR).sort((a, b) => a - b); return dit(l) === dit(cadServeur.map((c, i) => i)); })());
  T("le 5+3 est un Blitz, le 10+5 un Rapide", familles[1] === "b" && familles[10] === "r" && D.DIRECT_BLITZ.includes(1) && D.DIRECT_RAPIDES.includes(10));

  console.log("--- Les memes cadences que contre l'ordinateur, de la plus courte a la plus longue ---");
  const w = await ouvrir("fr", { attente: 1500, avant: MEMBRE });
  const ev = s => w.eval(s), $ = id => w.document.getElementById(id);
  const ordi = id => ev("TC_CATS.find(c=>c.id==='" + id + "').items.map(i=>i.join('+')).join()");
  const membres = l => l.map(i => D.DIRECT_CADENCES[i][0] / 60 + "+" + D.DIRECT_CADENCES[i][1]).join();
  const croissant = l => l.every((i, k) => !k || D.DIRECT_CADENCES[l[k - 1]][0] < D.DIRECT_CADENCES[i][0] || (D.DIRECT_CADENCES[l[k - 1]][0] === D.DIRECT_CADENCES[i][0] && D.DIRECT_CADENCES[l[k - 1]][1] < D.DIRECT_CADENCES[i][1]));
  T("Rapide : 10+0, 10+5, 15+10 des deux cotes", membres(D.DIRECT_RAPIDES) === "10+0,10+5,15+10" && ordi("rapid") === "10+0,10+5,15+10", membres(D.DIRECT_RAPIDES) + " / " + ordi("rapid"));
  T("Classique : 30+0, 30+20, 60+0 des deux cotes", membres(D.DIRECT_CLASSIQUES) === "30+0,30+20,60+0" && ordi("classical") === "30+0,30+20,60+0");
  T("Blitz entre membres : 3+2 et 5+3, deux cadences du Blitz de l'ordinateur", membres(D.DIRECT_BLITZ) === "3+2,5+3" && D.DIRECT_BLITZ.every(i => ordi("blitz").split(",").includes(membres([i]))), ordi("blitz"));
  T("Blitz entre membres : toujours un increment", D.DIRECT_BLITZ.every(i => D.DIRECT_CADENCES[i][1] > 0));
  T("entre membres, chaque famille va de la plus courte a la plus longue", D.DIRECT_FAMILLES.every(f => croissant(f[1])) && croissant(D.DIRECT_CORR));
  T("contre l'ordinateur aussi", ev("TC_CATS.every(c=>c.items.every((x,k)=>!k||c.items[k-1][0]<x[0]||(c.items[k-1][0]===x[0]&&(c.items[k-1][1]||0)<(x[1]||0))))") === true);
  T("les familles se suivent dans le meme ordre sur les deux ecrans", ev("TC_CATS.map(c=>c.label).filter(x=>['Blitz','Rapid','Classical'].includes(x)).join()") === D.DIRECT_FAMILLES.map(f => f[0]).join());

  console.log("--- L'ecran Contre un ami ---");
  ev("setMode('friend');amiCadenceDefaut();amiModeRegler('direct')"); await attendre(300);
  const puces = () => [...$("directCadences").children].map(b => net(b.textContent)).join();
  T("Rapide par defaut : 10+0, 10+5, 15+10, le 10+0 choisi", puces() === "10+0,10+5,15+10" && ev("directCad") === 0 && $("directCadences").children[0].getAttribute("aria-pressed") === "true", puces());
  $("directCadences").children[1].click(); await attendre(100);
  T("10+5 : la cadence numero 10, expliquee", ev("directCad") === 10 && net($("directCadenceNote").textContent) === "10 minutes chacun, plus 5 secondes ajoutées après chaque coup.", $("directCadenceNote").textContent);
  $("directCats").children[0].click(); await attendre(200);
  T("Blitz : 3+2 puis 5+3", puces() === "3+2,5+3" && ev("directCad") === 9, puces());
  $("directCadences").children[1].click(); await attendre(100);
  T("5+3 : toujours la cadence numero 1", ev("directCad") === 1);
  ev("amiCadenceDefaut()");
  T("a l'arrivee suivante : Rapide 10+0, rien n'est retenu (decision du 24/11)", ev("directCat") === 1 && ev("directCad") === 0 && w.localStorage.getItem("chang64:amiCadence") === null);
  T("une invitation en 5+3 se lit toujours « 5+3 »", ev("directTexteCadence(DIRECT_CADENCES[1])") === "5+3");
  ev("window.__f=[];bxMarquer=function(id){window.__f.push(id);return true;};bxmFin({phase:'fin',fin:{r:'1-0',m:'mat'},coups:['e2e4','e7e5'],moi:'b',b:'Moi',nr:'Lui',cad:[300,3],n:1,elo:null})");
  T("une partie en 5+3 vaut le badge du Blitz, meme sans variation d'Elo", ev("__f.includes('cad_blitz')") === true, ev("__f.join()"));
  ev("window.__f=[];bxmFin({phase:'fin',fin:{r:'1-0',m:'mat'},coups:['e2e4','e7e5'],moi:'b',b:'Moi',nr:'Lui',cad:[600,5],n:1,elo:null})");
  T("une partie en 10+5 ne le vaut pas", ev("__f.includes('cad_blitz')") === false, ev("__f.join()"));
  w.close();

  console.log("--- Sur telephone, rien ne se tire de haut en bas ---");
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
  T("rangee des familles de cadences : defile de cote, jamais en hauteur", /\.tc-cats\{[^}]*overflow-x:auto;overflow-y:hidden\}/.test(css));
  T("barre d'onglets : de meme", /\.tabs\{overflow-x:auto;overflow-y:hidden;/.test(css));

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
