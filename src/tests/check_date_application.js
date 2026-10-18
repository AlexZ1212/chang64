/* Verification automatique de chang64.
   Lancement : node tests/check_date_application.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-10-18) : l'application affiche, comme les pages
   de contenu, sa date de publication et de derniere mise a jour, tiree du
   registre content-dates.json (cle "/"), dans la langue choisie. */
const path=require("path");
const SITE=path.join(__dirname,"..","site");
const fs=require("fs"),jd=require("jsdom");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const reg=JSON.parse(fs.readFileSync(path.join(__dirname,"..","content-dates.json"),"utf8"))["/"];
const html=fs.readFileSync(SITE+"/index.html","utf8");

console.log("\n--- Le registre et la page servie ---");
T("le registre connait l'application",!!reg&&/^\d{4}-\d\d-\d\d$/.test(reg.publiee)&&/^\d{4}-\d\d-\d\d$/.test(reg.modifiee));
T("aucun jeton oublie",!/__APP_(PUBLIEE|MODIFIEE|DATES_EN)__/.test(html));
T("les dates servies sont celles du registre",
  html.includes('data-publiee="'+reg.publiee+'"')&&html.includes('data-modifiee="'+reg.modifiee+'"'));
T("la date de publication n'est pas posterieure a la mise a jour",reg.publiee<=reg.modifiee);

const dom=new jd.JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,
  url:"https://chang64.com/",virtualConsole:new jd.VirtualConsole(),
  beforeParse(w){w.fetch=u=>{const p=SITE+String(u).replace(/^https?:\/\/[^/]+/,"");
    return fs.existsSync(p)?Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,"utf8")))})
                           :Promise.resolve({ok:false,status:404});};}});
setTimeout(()=>{
  const w=dom.window,d=w.document;
  console.log("\n--- Dans les deux langues ---");
  w.eval("LANG='en';applyI18n()");
  const en=d.getElementById("footDate").textContent;
  T("en anglais",en.startsWith("Published "+reg.publiee),en);
  w.eval("LANG='fr';applyI18n()");
  const fr=d.getElementById("footDate").textContent;
  T("en francais, date en toutes lettres",/^Publiée le \d{1,2} [a-zéû]+ \d{4}/.test(fr),fr);
  T("la mise a jour est mentionnee quand elle differe",
    reg.modifiee===reg.publiee||/mise à jour le/.test(fr),fr);
  w.eval("LANG='en';applyI18n()");
  T("retour a l'anglais",d.getElementById("footDate").textContent===en);
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
},4000);
