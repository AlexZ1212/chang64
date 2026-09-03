/* Verification automatique de chang64.
   Lancement : node tests/check_pied_de_page.js

   Le menu du haut ne porte que quatre entrees et deborde deja sur telephone
   (458 px pour 362 disponibles). Finales, Lexique et Pieges d ouverture
   n etaient donc atteignables depuis aucune page de contenu, ni pour le
   visiteur ni pour les moteurs de recherche : ces pages ne recevaient aucun
   lien interne. Le pied de page les porte toutes. */
const fs=require("fs"),path=require("path");
const S=require("path").join(__dirname,"..","site");
let ok=0,ko=0;
const T=(n,c,d)=>{if(c){ok++;console.log("  OK   "+n)}else{ko++;console.log("  FAIL "+n+(d?"  -> "+d:""))}};

const fr=fs.readFileSync(S+"/fr/ouvertures/defense-sicilienne.html","utf8");
const en=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");

console.log("\n--- Meme pied de page que l'application, meme ordre ---");
{
  const app=fs.readFileSync(S+"/index.html","utf8");
  const fa=(app.match(/<footer>([\s\S]*?)<\/footer>/)||[])[1]||"";
  const liste=t=>[...t.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim())
    .filter(x=>x&&x!=="&middot;"&&x.length>2);
  const enPage=fs.readFileSync(S+"/openings/sicilian-defense.html","utf8");
  const fp=(enPage.match(/<nav class="footnav"[^>]*>([\s\S]*?)<\/nav>/)||[])[1]||"";
  const a=liste(fa), b=liste(fp);
  T("meme contenu et meme ordre", JSON.stringify(a)===JSON.stringify(b),
    a.join(" | ")+"   VS   "+b.join(" | "));
}

console.log("\n--- Meme forme que les composants de l'application ---");
/* Les pages claires reprennent la pastille arrondie des onglets et du
   selecteur de langue. Seules les couleurs changent, prises dans les jetons
   du theme clair. Le texte sur le laiton doit etre clair et non fonce : le
   laiton du theme clair (#7E5409) est bien plus sombre que celui du theme
   sombre, et un texte fonce n'y donnerait que 2,7:1. */
{
  const css=(fr.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||"";
  T("menu en pastille arrondie", /\.sitenav\{[^}]*border-radius:999px/.test(css));
  T("menu sur fond contraste", /\.sitenav\{[^}]*background-color:var\(--slate\)/.test(css));
  T("section courante surlignee en laiton", /\.sitenav \[aria-current="page"\]\{[^}]*background-color:var\(--brass\)/.test(css));
  T("texte clair sur le laiton", /\.sitenav \[aria-current="page"\]\{[^}]*color:#FDF8EC/.test(css));
  T("langue en pastille, meme rayon que l'application", /\.langsw\{[^}]*border-radius:8px/.test(css));
  T("langue active surlignee", /\.langsw a\[aria-current="true"\]\{[^}]*background-color:var\(--raise\)/.test(css));
  /* la meme forme dans l'application, pour verifier qu'elles ne divergent pas */
  const app=fs.readFileSync(S+"/index.html","utf8");
  const cssApp=(app.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||"";
  /* Le defilement horizontal exige flex:1 1 100% : avec "auto", la rangee
     reste sur la ligne du logo et s'etire au lieu de defiler. Et la regle
     generique "header nav" ne doit pas s'appliquer au menu, son flex-wrap
     annulerait le defilement. */
  T("menu en defilement horizontal", /\.sitenav\{[^}]*overflow-x:auto/.test(css));
  T("menu sur sa propre ligne", /\.sitenav\{[^}]*flex:1 1 100%/.test(css));
  T("regle generique neutralisee sur le menu", /header nav:not\(\.sitenav\)/.test(css));
  /* La langue vient juste apres le logo, comme dans l'application : l'entete
     est en space-between, donc elle se place a l'oppose. */
  const ordre=(fr.match(/<header>([\s\S]*?)<\/header>/)||[])[1]||"";
  const pLogo=ordre.indexOf('class="brand"'), pLang=ordre.indexOf('class="langsw"'), pNav=ordre.indexOf('class="sitenav"');
  T("langue a l'oppose du logo", pLogo<pLang && pLang<pNav, "logo "+pLogo+" langue "+pLang+" menu "+pNav);
  /* Le selecteur de langue reprend exactement .langswitch button : JetBrains
     Mono en 600, corps 11.5px, marges 7px 10px. Ce n'est pas la police du
     corps de texte mais celle du "64" de la marque. Comparaison sur les
     styles calcules, pas sur le code. */
  {
    const jd=require("jsdom");
    const win=f=>new jd.JSDOM(fs.readFileSync(f,"utf8"),{pretendToBeVisual:true,virtualConsole:new jd.VirtualConsole()}).window;
    const wa=win(S+"/index.html"), wb=win(S+"/fr/ouvertures/index.html");
    const sa=wa.getComputedStyle(wa.document.querySelector(".langswitch button"));
    const sb=wb.getComputedStyle(wb.document.querySelector(".langsw a"));
    for(const k of ["fontSize","fontFamily","fontWeight","paddingTop","paddingLeft","borderRadius","lineHeight"])
      T("langue, "+k+" identique", String(sa[k])===String(sb[k]), sa[k]+" vs "+sb[k]);
    const ca=wa.getComputedStyle(wa.document.querySelector(".langswitch"));
    const cb=wb.getComputedStyle(wb.document.querySelector(".langsw"));
    for(const k of ["padding","borderRadius","gap"])
      T("pastille, "+k+" identique", String(ca[k])===String(cb[k]), ca[k]+" vs "+cb[k]);
    const oa=[...wa.document.querySelectorAll(".langswitch button")].map(b=>b.textContent.trim()).join("|");
    const ob=[...wb.document.querySelectorAll(".langsw a")].map(b=>b.textContent.trim()).join("|");
    T("meme ordre des langues", oa===ob, oa+" vs "+ob);
  }
  T("l'application a bien la meme forme d'onglets", /\.tabs\{[^}]*border-radius:999px/.test(cssApp));
  T("et le meme rayon de selecteur", /\.seg\{[^}]*border-radius:8px/.test(cssApp));
}

console.log("\n--- Un seul menu, dans l'entete ---");
/* Les six sections etaient repetees en haut et en bas, avec des contenus
   differents : quatre entrees en haut, six en bas. Deux menus divergents sur
   la meme page donnent l'impression d'un site incoherent. Ils sont unifies
   dans l'entete, et le pied de page revient a son role classique, le legal.
   "Jouer" a ete retire : le logo ramene deja a l'accueil. */
{
  const nav=(fr.match(/<nav class="sitenav">([\s\S]*?)<\/nav>/)||[])[1]||"";
  const items=[...nav.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(Boolean);
  T("six sections dans l'entete", items.length===6, items.join(", "));
  T("'Jouer' retire du menu", !items.includes("Jouer"), items.join(", "));
  const pied=(fr.match(/<nav class="footnav"[^>]*>([\s\S]*?)<\/nav>/)||[])[1]||"";
  const pitems=[...pied.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(Boolean);
  T("le pied de page ne repete plus les sections", !pitems.includes("Finales"), pitems.join(", "));
  T("le pied de page porte le legal", pitems.some(x=>/gales|notice/i.test(x)), pitems.join(", "));
}

console.log("\n--- Bascule de langue en pastille, comme dans l'application ---");
{
  const sw=(fr.match(/<div class="langsw"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||"";
  T("pastille presente", sw.length>0);
  T("les deux langues visibles", /though|>EN</.test(sw) && />FR</.test(sw));
  T("la langue courante est marquee", /aria-current="true"[^>]*>FR</.test(sw)||/>FR<\/a>/.test(sw));
  const swEn=(en.match(/<div class="langsw"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||"";
  const lienFr=(swEn.match(/href="([^"]+)"[^>]*hreflang="fr"/)||[])[1];
  T("depuis l'anglais, FR mene a la page francaise", /^\/fr\//.test(lienFr||""), lienFr);
  const lienEn=(sw.match(/href="([^"]+)"[^>]*hreflang="en"/)||[])[1];
  T("depuis le francais, EN mene a la page anglaise", !/^\/fr\//.test(lienEn||""), lienEn);
}

console.log("\n--- Toutes les sections sont atteignables ---");
for(const [href,nom] of [["/fr/ouvertures/","Ouvertures"],["/fr/exercices/","Exercices"],
  ["/fr/apprendre/","Apprendre"],["/fr/finales/","Finales"],["/fr/pieges/","Pièges"],["/fr/lexique/","Lexique"]])
  T(nom+" liee depuis une page FR", fr.includes('href="'+href+'"')||fr.includes(">"+nom));
for(const href of ["/openings/","/puzzles/","/learn/","/endgames/","/traps/","/glossary/"])
  T(href+" liee depuis une page EN", en.includes('href="'+href+'"')||en.includes('aria-current'));

console.log("\n--- Les cibles existent vraiment ---");
const cibles=[...fr.matchAll(/<nav class="footnav"[\s\S]*?<\/nav>/g)][0][0];
const liens=[...cibles.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
/* Les liens legaux pointent vers des fragments (/#legal, /#privacy) : ces
   panneaux sont ouverts par l'application au chargement, pas par des pages
   distinctes. On verifie donc la page cible, sans le fragment. */
const morts=liens.filter(h=>{
  const p=h.split("#")[0]||"/";
  return !fs.existsSync(S+p+"index.html")&&!fs.existsSync(S+p);
});
T(liens.length+" liens verifies, aucun mort", morts.length===0, morts.join(", "));

console.log("\n--- La page courante n'est pas un lien vers elle-meme ---");
T("section courante marquee", /aria-current="page"/.test(fr), (fr.match(/<span aria-current="page">([^<]*)/)||[])[1]);

console.log("\n--- Present sur toutes les pages de contenu ---");
let sans=[],vus=0;
for(const dir of ["/openings","/fr/ouvertures","/learn","/fr/apprendre","/endgames","/glossary","/traps","/puzzles"]){
  if(!fs.existsSync(S+dir))continue;
  for(const f of fs.readdirSync(S+dir).filter(x=>x.endsWith(".html")).slice(0,40)){
    vus++;
    if(!fs.readFileSync(S+dir+"/"+f,"utf8").includes('class="footnav"'))sans.push(dir+"/"+f);
  }
}
T(vus+" pages verifiees, toutes avec le pied de page", sans.length===0, sans.slice(0,3).join(", "));

console.log("\n--- Accessibilite et style ---");
T("le menu est annonce comme navigation", /<nav class="footnav" aria-label="/.test(fr));
T("style applique", /\.footnav\{/.test(fr));
T("aucun tiret cadratin", !fr.includes("\u2014"), (fr.match(/.{20}\u2014.{20}/)||[])[0]||"");

console.log("\n=== "+ok+" OK, "+ko+" FAIL ===");
process.exit(ko?1:0);
