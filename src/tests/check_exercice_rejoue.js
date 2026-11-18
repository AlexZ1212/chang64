/* Verification automatique de chang64.
   Lancement : node tests/check_exercice_rejoue.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Un meme exercice ne compte qu'une fois par jour (2026-11-17, bug signale
   par Alexandre : rejouer l'exercice du jour faisait avancer le defi de la
   semaine). Verifie qu'en regagnant le meme exercice le jour meme, rien ne
   bouge : exercices resolus, compteur par motif, journal des reussites,
   meilleur jour, suite de bonnes reponses (donc le niveau), objectif du
   jour, defis de la semaine ; qu'un autre exercice compte ; et que le meme
   exercice compte de nouveau le lendemain (revision espacee). */
const path = require("path"), fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(page) {
  const html = fs.readFileSync(path.join(SITE, page), "utf8");
  return new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = (u, o) => {
        if (o && o.method === "POST") return Promise.resolve({ ok: true, status: 204 });
        const f = path.join(SITE, new URL(u, "https://chang64.com/").pathname);
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))) });
      };
      w.navigator.sendBeacon = () => true;
    } }).window;
}

(async () => {
  const w = ouvrir("index.html");
  await attendre(1500);
  w.eval('setMode("puzzles",{screen:"puzzles"})');
  for (let i = 0; i < 40 && !w.eval("!!(puzzle&&puzzle.id&&puzzle.theme)"); i++) await attendre(250);
  T("un exercice est charge", w.eval("!!(puzzle&&puzzle.id)"));
  const etat = () => JSON.parse(w.eval(`JSON.stringify({solved:prog.solved,motif:(prog.themeSolved||{})[puzzle.theme]||0,journal:(prog.solveLog||[]).length,
    jour:prog.dayCount||0,suite:prog.correctRun,niveau:prog.level,objectif:objFaits(),defis:defiEtat().defis.p.join(","),faits:defiEtat().defisFaits,
    sansErreur:bxEtat().c.sansErreur||0,id:puzzle.id,gagnes:(prog.gagnes&&prog.gagnes.ids||[]).length})`));
  const gagner = async () => { w.eval("puzzleTries=0;finishPuzzle(true)"); await attendre(60); return etat(); };
  const memes = (a, b) => ["solved", "motif", "journal", "jour", "suite", "niveau", "objectif", "defis", "faits", "sansErreur"].filter(k => a[k] !== b[k]);

  const e0 = etat(), e1 = await gagner();
  T("premiere reussite : comptee (resolus, motif, journal, objectif du jour)", e1.solved === e0.solved + 1 && e1.motif === e0.motif + 1 && e1.journal === e0.journal + 1 && e1.objectif === e0.objectif + 1, JSON.stringify([e0, e1]));
  T("l'exercice est inscrit parmi ceux du jour", e1.gagnes === e0.gagnes + 1);
  /* Partage d'un exercice ordinaire (2026-11-18) : le bloc commun apparait
     apres la reussite, avec le lien de CET exercice, sans "Partager mon
     resultat" (propre a l'exercice du jour). */
  {
    const $ = id => w.document.getElementById(id);
    T("exercice ordinaire reussi : le bloc de partage apparait", !$("dailyChallengeBlock").classList.contains("hide") && $("btnShareDaily").classList.contains("hide") && !$("btnChallengeDaily").classList.contains("hide"));
    $("btnChallengeDaily").click();
    T("le lien partage est celui de cet exercice", $("dailyChallengeLink").value === "https://chang64.com/#puzzle=" + e1.id && !$("dailyChallengePanel").classList.contains("hide") && $("dailyChallengeShare").children.length >= 4, $("dailyChallengeLink").value);
    w.eval("loadPuzzle()"); await attendre(100);
    T("exercice recharge : le bloc se referme", $("dailyChallengeBlock").classList.contains("hide") && !$("btnShareDaily").classList.contains("hide"));
  }
  w.eval("loadPuzzle()"); await attendre(100);
  T("Recommencer recharge le meme exercice", etat().id === e1.id);
  let e2 = await gagner();
  T("meme exercice regagne : plus rien ne bouge", memes(e1, e2).length === 0, memes(e1, e2).join(",") + " " + JSON.stringify([e1, e2]));
  for (let i = 0; i < 8; i++) { w.eval("loadPuzzle()"); await attendre(30); e2 = await gagner(); }
  T("regagne huit fois de plus : toujours rien (ni niveau, ni objectif, ni defis)", memes(e1, e2).length === 0 && e2.gagnes === e1.gagnes, memes(e1, e2).join(","));

  /* Un autre exercice compte normalement. */
  w.eval("nextPuzzle()");
  for (let i = 0; i < 40 && w.eval("puzzle.id") === e1.id; i++) await attendre(250);
  const autre = etat();
  T("un autre exercice est charge", autre.id !== e1.id, autre.id);
  const e3 = await gagner();
  T("un autre exercice compte", e3.solved === e2.solved + 1 && e3.objectif === e2.objectif + 1, JSON.stringify([e2.solved, e3.solved]));

  /* Le lendemain, le meme exercice compte de nouveau. */
  w.eval('prog.gagnes.k="2000-01-01"');
  const e4 = await gagner();
  T("le lendemain, le meme exercice compte de nouveau", e4.solved === e3.solved + 1 && e4.gagnes === 1, JSON.stringify([e3.solved, e4.solved, e4.gagnes]));

  /* Un echec puis une reussite du meme exercice le meme jour : la reussite compte. */
  w.eval("nextPuzzle()");
  for (let i = 0; i < 40 && w.eval("puzzle.id") === e4.id; i++) await attendre(250);
  const e5 = etat();
  w.eval("finishPuzzle(false)"); await attendre(60);
  w.eval("loadPuzzle()"); await attendre(60);
  const e6 = await gagner();
  T("rate puis reussi le meme jour : la reussite compte une fois", e6.solved === e5.solved + 1, JSON.stringify([e5.solved, e6.solved]));

  /* Finales (2026-11-18) : pour le defi "Reussis N finales", une meme finale
     ne compte qu'une fois par jour ; une autre finale compte ; la meme
     recompte le lendemain. Le tirage de la semaine est remplace pour que le
     defi des finales soit en jeu. */
  w.eval('defiListe=()=>[{type:"jours",cible:99},{type:"sprint",cible:99},{type:"finale",cible:3}];var __s=defiEtat().defis;__s.p=[0,0,0];__s.ok=[false,false,false];__s.fin=[];');
  const finale = async id => { w.eval('startEndgame("' + id + '","chip")'); await attendre(80); w.eval('endEndgame("checkmate")'); await attendre(80); return w.eval("defiEtat().defis.p[2]"); };
  T("une finale gagnee compte", await finale("kq") === 1);
  T("la meme finale regagnee le meme jour ne compte pas", await finale("kq") === 1, w.eval("defiEtat().defis.p[2]"));
  T("une autre finale compte", await finale("kr") === 2);
  w.eval('startEndgame("krr","chip")'); await attendre(80); w.eval('endEndgame("out-of-moves")'); await attendre(80);
  T("une finale perdue ne compte pas et ne bloque pas la suivante", w.eval("defiEtat().defis.p[2]") === 2 && await finale("krr") === 3);
  w.eval('__s=defiEtat().defis;__s.p[2]=1;__s.ok[2]=false;__s.fin=__s.fin.map(x=>"2000-01-01"+x.slice(10));');
  T("le lendemain, la meme finale compte de nouveau", await finale("kq") === 2, w.eval("JSON.stringify(defiEtat().defis.fin)"));

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  w.close();
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n" + ok + " OK, " + (ko + 1) + " FAIL"); process.exit(1); });
