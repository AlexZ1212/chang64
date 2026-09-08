/* Verification automatique de chang64.
   Lancement : node tests/check_calendrier_etats.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-09-07, demande par Alexandre) :

   1. La case d'aujourd'hui ne repondait pas. Elle n'etait ni "done" ni
      "missed" -- "missed" excluant explicitement le jour courant -- donc
      elle n'avait ni data-date, ni role, ni gestionnaire. L'intention etait
      qu'on y accede par la carte "Puzzle du jour", mais rien dans le
      calendrier ne le disait : elle ressemblait aux autres et restait
      inerte, ce qui se lit comme un jour desactive.

   2. Cinq etats doivent se distinguer : passe non fait, passe fait,
      aujourd'hui a faire, aujourd'hui fait, a venir. Plus la serie en cours,
      qui n'est pas un sixieme etat mais une seconde dimension : un jour de
      serie est forcement un jour fait, la serie se superpose au lieu de
      remplacer.

   La serie est recalculee depuis prog.dailyLog et non lue dans prog.days :
   le compteur dit combien de jours, pas lesquels. Et elle se termine hier
   tant que l'exercice du jour n'est pas fait, sinon elle paraitrait rompue
   toute la journee jusqu'a ce qu'on le resolve. */
const SITE = require("path").join(__dirname, "..", "site");
const fs=require("fs"),jd=require("jsdom");
const html=fs.readFileSync(""+SITE+"/index.html","utf8");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://chang64.com/",
  virtualConsole:new jd.VirtualConsole(),
  beforeParse(w){ w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
    return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                           :Promise.resolve({ok:false,status:404});};}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);

/* Cle de date a N jours en arriere, dans le meme format que calDateKey. */
const jour=n=>{const x=new Date();x.setDate(x.getDate()-n);
  return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");};
const cases=()=>[...d.querySelectorAll("#calFull .cal-day:not(.empty)")];
const parDate=k=>cases().find(c=>c.getAttribute("data-date")===k);
const laDuJour=()=>cases().find(c=>c.classList.contains("today"));
const classes=c=>c?c.className.replace("cal-day","").trim().split(/\s+/).filter(Boolean).sort().join(" "):"(absente)";

setTimeout(async()=>{
  /* Journal fabrique : serie de trois jours finissant hier, un trou a J-4,
     un jour isole plus loin. Le trou est ce qui prouve que la serie s'arrete
     ou elle doit s'arreter, et pas simplement que tout jour fait est marque. */
  w.eval(`ensureProgFields();prog.dailyLog={${[1,2,3,6].map(n=>`"${jour(n)}":1`).join(",")}};`);
  w.eval("renderCalendarGrid('calFull',0,{nav:true});renderCalendarLegend();");
  await wait(150);

  console.log("\n--- Aujourd'hui, pas encore fait ---");
  const auj=laDuJour();
  T("la case du jour existe",!!auj);
  T("elle porte l'etat a faire",classes(auj).includes("todo"),classes(auj));
  T("elle n'est pas marquee comme faite",!auj.classList.contains("done"));
  T("elle est atteignable au clic",auj.getAttribute("role")==="button");
  T("elle est atteignable au clavier",auj.getAttribute("tabindex")==="0");
  T("elle s'annonce autrement que par sa seule date",
    /\d{4}-\d{2}-\d{2}/.test(auj.getAttribute("aria-label")||"")
    &&(auj.getAttribute("aria-label")||"").length>12,auj.getAttribute("aria-label"));

  console.log("\n--- Le clic mene bien a l'exercice du jour ---");
  auj.click(); await wait(400);
  T("on arrive dans la section des exercices",w.eval("mode")==="puzzles",w.eval("mode"));
  T("sur l'ecran du puzzle du jour",w.eval("typeof solveScreen!=='undefined'?solveScreen:'?'")==="daily",
    w.eval("typeof solveScreen!=='undefined'?solveScreen:'?'"));
  /* Et non par le chemin de rattrapage, qui sert a cocher un jour passe. */
  T("sans passer par le rattrapage d'un jour passe",
    !w.eval("puzzle&&puzzle.dailyCatchupKey"));

  w.eval("renderCalendarGrid('calFull',0,{nav:true})"); await wait(150);

  console.log("\n--- Les jours passes se distinguent entre eux ---");
  T("un jour fait porte 'done'",classes(parDate(jour(1))).includes("done"),classes(parDate(jour(1))));
  T("un jour non fait porte 'missed'",classes(parDate(jour(4))).includes("missed"),classes(parDate(jour(4))));
  T("un jour non fait n'est jamais marque comme fait",
    !parDate(jour(4)).classList.contains("done"));
  T("les deux restent cliquables",
    parDate(jour(1)).getAttribute("role")==="button"&&parDate(jour(4)).getAttribute("role")==="button");

  console.log("\n--- La serie en cours ---");
  T("les trois jours consecutifs sont dans la serie",
    [1,2,3].every(n=>parDate(jour(n)).classList.contains("streak")),
    [1,2,3].map(n=>classes(parDate(jour(n)))).join(" | "));
  T("le trou arrete la serie",!parDate(jour(4)).classList.contains("streak"));
  T("un jour fait au-dela du trou n'en fait pas partie",
    !parDate(jour(6)).classList.contains("streak"),classes(parDate(jour(6))));
  T("la serie se superpose a l'etat fait, elle ne le remplace pas",
    parDate(jour(1)).classList.contains("done"));
  T("elle continue de courir bien qu'aujourd'hui ne soit pas fait",
    parDate(jour(1)).classList.contains("streak"),
    "sinon la serie paraitrait rompue toute la journee");

  console.log("\n--- Une fois l'exercice du jour resolu ---");
  w.eval(`prog.dailyLog["${jour(0)}"]=1;renderCalendarGrid('calFull',0,{nav:true});`);
  await wait(150);
  const auj2=laDuJour();
  T("la case du jour passe a l'etat fait",auj2.classList.contains("done"),classes(auj2));
  T("elle n'est plus a faire",!auj2.classList.contains("todo"));
  T("elle reste reperee comme etant aujourd'hui",auj2.classList.contains("today"));
  T("la serie l'absorbe",auj2.classList.contains("streak"),classes(auj2));

  console.log("\n--- Les jours a venir restent hors d'atteinte ---");
  const futurs=cases().filter(c=>c.classList.contains("future"));
  T("les jours futurs sont marques",futurs.length>0,futurs.length+" jour(s)");
  T("aucun n'est cliquable",futurs.every(c=>!c.hasAttribute("role")&&!c.hasAttribute("data-date")));

  console.log("\n--- La legende explique ce qu'on voit ---");
  const leg=[...d.querySelectorAll("#calLegend span")];
  T("la legende est remplie",leg.length>=5,leg.length+" entree(s)");
  T("ses pastilles reutilisent les classes des vraies cases",
    leg.every(s=>s.querySelector(".cal-day")),
    "sinon elle peut decrire un affichage qui n'existe plus");
  for(const c of ["todo","done","missed","streak","future"])
    T("la legende couvre l'etat '"+c+"'",
      leg.some(s=>s.querySelector(".cal-day."+c)));

  console.log("\n--- Chaque etat a bien une regle de style ---");
  for(const sel of [".cal-day.todo{",".cal-day.missed{",".cal-day.done{",".cal-day.streak{",".cal-day.today{",".cal-day.future{"])
    T("regle presente pour "+sel.slice(0,-1),html.includes(sel));

  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},1400);
setTimeout(()=>{console.log("\n=== "+ok+" OK, "+(ko+1)+" FAIL === (delai depasse)");process.exit(1);},60000);
