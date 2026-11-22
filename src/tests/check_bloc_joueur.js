/* Verification automatique de chang64.
   Lancement : node tests/check_bloc_joueur.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ajustement d'Alexandre du 22/11/2026, choisi sur maquette (proposition B,
   design/ajustements-2211/bloc-joueur-propositions.png) : le bloc du joueur
   (nom, pieces prises, pendule) gagne 10 % de hauteur (49 -> 54 px, 41 -> 45
   sur un telephone de moins de 700 px de haut) et tout y est centre sur la
   hauteur : la pendule, le nom tant qu'aucune piece n'est prise, puis le
   groupe forme par le nom et la rangee des prises. La hauteur est fixe : rien
   ne bouge autour du bloc quand la premiere prise arrive.

   jsdom ne met rien en page : ce test controle les regles de style et ce que
   rend la rangee des prises ; les hauteurs et le centrage reels se mesurent
   dans un vrai navigateur par mesure_ajustements.js (10 langues). */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
  const regle = sel => { const i = css.indexOf(sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i) + 1); };

  console.log("--- Le style du bloc ---");
  const bloc = regle(".clock");
  T("le bloc fait 54 px de haut au moins (49 + 10 %)", /min-height:54px/.test(bloc), bloc);
  T("son contenu est centre sur la hauteur", /display:flex/.test(bloc) && /flex-direction:column/.test(bloc) && /justify-content:center/.test(bloc), bloc);
  T("plus de marge haute ni basse qui decentrerait le contenu", /padding:0 12px/.test(bloc) && !/padding:7px/.test(bloc), bloc);
  T("la pendule reste centree sur toute la hauteur", /\.clock time\{position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center\}/.test(css));
  T("une rangee de prises vide ne prend pas de place : le nom est seul au milieu", /\.taken:empty\{display:none\}/.test(css));
  T("la rangee garde ses 20 px, a 3 px du nom", /\.taken\{[^}]*height:20px;margin-top:3px/.test(css), regle(".taken"));
  const compact = (css.match(/@media ?\(max-width:599px\) and \(max-height:700px\) ?\{(.*?\}) ?\}/) || [])[1] || "";
  T("petit telephone : 45 px (41 + 10 %), sans marge qui decentre", /body\[data-mode="play"\] \.clock,body\[data-mode="friend"\] \.clock\{min-height:45px\}/.test(compact) && !/\.clock\{[^}]*padding-top/.test(compact), compact.slice(-200));
  T("54 px suffisent au nom et a la rangee (13 + 3 + 20), 45 px aussi", 13 + 3 + 20 <= 54 - 2 && 13 + 3 + 20 <= 45 - 2);

  console.log("--- La rangee des prises ---");
  const w = await ouvrir("fr", { attente: 1500 });
  const ev = s => w.eval(s), d = w.document;
  T("aucune prise : la rangee est rendue, vide", ev("rangeePrises([],'w',0)") === '<span class="taken"></span>', ev("rangeePrises([],'w',0)"));
  T("une prise : la rangee porte la piece", /^<span class="taken"><i class="tk"/.test(ev("rangeePrises(['p'],'w',0)")));
  T("un solde seul suffit a la remplir", /<b class="adv">\+1<\/b><\/span>$/.test(ev("rangeePrises([],'w',1)")));
  ev("setMode('play');pendingNoClock=false;newGame()"); await attendre(400);
  const haut = d.getElementById("clockTop"), bas = d.getElementById("clockBottom");
  T("debut de partie : les deux blocs ont leur rangee, vide", [haut, bas].every(b => { const k = b.querySelector(".taken-slot .taken"); return !!k && k.childNodes.length === 0; }));
  T("le nom precede la rangee des prises dans le bloc", [haut, bas].every(b => b.firstElementChild.classList.contains("clock-line") && b.lastElementChild.classList.contains("taken-slot")));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
