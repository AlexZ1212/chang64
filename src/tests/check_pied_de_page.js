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
