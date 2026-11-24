/* Verification automatique de chang64.
   Lancement : node tests/check_sans_gonflage.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Coordonnees et finales : on ne gonfle pas ses chiffres en les rejouant a
   l'infini (point de la feuille de route, regle le 2026-11-18 dans defis.js,
   garde ici depuis le 2026-11-24) :
   - Coordonnees : seul le RECORD compte (statistiques, badges coord_*, defi
     de la semaine « Coordonnees », qui garde le meilleur score, pas un cumul) ;
   - Finales : le badge d'une finale ne se gagne qu'une fois, la statistique
     compte les finales differentes gagnees, et le defi « Reussis N finales »
     ne compte une meme finale qu'une fois par jour ;
   - ni l'une ni l'autre ne font avancer l'objectif du jour (des exercices). */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = await ouvrir("fr");
  const ev = s => w.eval(s);
  ev("ensureProgFields();prog.coordBest=0;prog.endgames={};saveProg()");
  const objAvant = ev("objFaits()");

  console.log("--- Coordonnees : seul le record compte ---");
  /* Une partie de Coordonnees qui finit, comme le fait le chrono. */
  const coord = (score, fautes) => ev("coord={score:" + score + ",misses:" + (fautes || 0) + ",target:'e4',timer:0,ends:Date.now()};stopCoord()");
  coord(12);
  T("premiere partie : record 12", ev("prog.coordBest") === 12);
  coord(5); coord(7); coord(3);
  T("trois parties plus faibles : le record reste 12, rien ne s'additionne", ev("prog.coordBest") === 12);
  coord(15);
  T("une meilleure : record 15", ev("prog.coordBest") === 15);
  T("le defi de la semaine « Coordonnees » se compte au record, pas au cumul", ev("DEFI_RECORD.includes('coord')") === true);
  /* badges.js : coord_<n> se gagne quand le RECORD atteint n. */
  const srcBadges = require("fs").readFileSync(require("path").join(__dirname, "..", "badges.js"), "utf8");
  T("les badges de Coordonnees se lisent sur le record", srcBadges.includes("return (p.coordBest||0)>=+r[1];"));

  console.log("--- Finales : une fois par jour pour le defi, une fois pour le badge ---");
  T("une finale gagnee aujourd'hui compte pour le defi", ev("defiFinaleNeuve('kq')") === true);
  T("la meme, regagnee le meme jour, ne compte plus", ev("defiFinaleNeuve('kq')") === false && ev("defiFinaleNeuve('kq')") === false);
  T("une autre finale compte", ev("defiFinaleNeuve('kr')") === true);
  ev("bxMarquer('eg_kq')");
  T("le badge d'une finale ne se gagne qu'une fois", ev("bxMarquer('eg_kq')") === false);
  /* menu.js : « Finales reussies » compte les finales differentes deja
     gagnees (prog.endgames, une entree par finale), pas les parties. Les
     chiffres du menu s'animent depuis 0 : on lit la regle dans le code. */
  const srcMenu = require("fs").readFileSync(require("path").join(__dirname, "..", "menu.js"), "utf8");
  T("la statistique compte les finales differentes gagnees, pas les parties",
    srcMenu.includes('["kq","kr","krr","kbn","kp"].filter(e=>(prog.endgames||{})[e]!==undefined).length'));

  console.log("--- L'objectif du jour ne bouge pas ---");
  T("ni les Coordonnees ni les finales ne comptent dans l'objectif du jour (des exercices)", ev("objFaits()") === objAvant, ev("objFaits()") + " / " + objAvant);

  w.close();
  await pause(50);
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
