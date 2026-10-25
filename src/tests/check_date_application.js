/* Verification automatique de chang64.
   Lancement : node tests/check_date_application.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-10-18) : l'application affiche, comme les pages
   de contenu, sa date de publication et de derniere mise a jour, tiree du
   registre content-dates.json (cle "/"), dans la langue de la page. Depuis
   le 2026-10-25, chaque langue a sa page (/, /fr/, /es/...) : on les ouvre
   toutes, et on verifie aussi le texte pose par le build, celui qu'on lit
   sans JavaScript. */
const path=require("path");
const SITE=path.join(__dirname,"..","site");
const fs=require("fs");
const {ouvrir}=require("./outils/page_langue.js");
const {LANGUES}=require("../langues/registre.js");
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

/* Debut attendu, et mention de la mise a jour quand les dates different. */
const FORME={
  en:[new RegExp("^Published "+reg.publiee),/updated \d{4}-\d\d-\d\d/],
  fr:[/^Publiée le \d{1,2} [a-zéû]+ \d{4}/,/mise à jour le/],
  es:[/^Publicada el \d{1,2} de [a-z]+ de \d{4}/,/actualizada el/],
  pt:[/^Publicada em \d{1,2} de [a-zç]+ de \d{4}/,/atualizada em/],
  de:[/^Veröffentlicht am \d{1,2}\. [A-Za-zä]+ \d{4}/,/aktualisiert am/],
  ru:[/^Опубликовано \d{1,2} [а-я]+ \d{4}/,/обновлено/]
};
const nb=s=>String(s).replace(/ /g," ");

(async()=>{
  for(const l of LANGUES){
    console.log("\n--- "+l.accueil+" ---");
    const page=fs.readFileSync(path.join(SITE,l.code==="en"?"":l.code,"index.html"),"utf8");
    const statique=nb((page.match(/id="footDate"[^>]*>([^<]*)</)||[])[1]||"");
    T("sans JavaScript, date dans la langue",FORME[l.code][0].test(statique),statique);
    const w=await ouvrir(l.code,{fetch:true,attente:2500});
    const txt=nb(w.document.getElementById("footDate").textContent);
    T("date dans la langue",FORME[l.code][0].test(txt),txt);
    T("la mise a jour est mentionnee quand elle differe",reg.modifiee===reg.publiee||FORME[l.code][1].test(txt),txt);
    w.close();
  }
  console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko?1:0);
})();
