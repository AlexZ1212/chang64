/* ==========================================================
   0. INTERNATIONALISATION
   ========================================================== */

/* Langue de la page (2026-10-25). Chaque langue a desormais sa propre page
   d'accueil (/, /fr/, /es/...), construite par build_site.js : la langue
   n'est plus devinee ici d'apres le navigateur, elle est celle de la page.
   Le build pose dans un bloc <script type="application/json" id="langue">
   le code de la langue, sa locale Intl, son dictionnaire et les adresses de
   ses pages d'ouvertures. Un bloc de donnees n'est pas execute : le script de
   l'application reste identique d'une langue a l'autre, et la CSP n'a qu'une
   empreinte pour lui (voir poserHachagesCSP dans build_site.js).
   Sans ce bloc (page anglaise, ou fichier ouvert hors du site), on reste en
   anglais, avec les phrases du code telles quelles. */
const PAGE_LANGUE=(()=>{
  try{const e=document.getElementById("langue");return e?JSON.parse(e.textContent):{};}
  catch(e){return {};}
})();
let LANG=PAGE_LANGUE.lang||"en";
const DICT=PAGE_LANGUE.dict||{};
const LANG_INTL=PAGE_LANGUE.intl||"en-US";
const LANG_HTML=PAGE_LANGUE.html||LANG;
/* Un mot court ne doit pas rester seul en fin de ligne : "Exercice du /
   jour" ou "Suggerer un / coup" se lisent mal dans un bouton etroit. On lie
   donc l'article au mot suivant par une espace insecable, une fois pour
   toutes plutot que dans chaque libelle. Regle typographique francaise
   courante, sans effet quand le texte tient sur une ligne. */
const MOTS_LIES=/(^|\s)(du|de|des|le|la|les|un|une|au|aux|en|et|ma|mon|ta|ton|sur|par|a|à|d'|l')(\s)(?=\S)/gi;
function lier(x){
  /* Corrige le 2026-09-05 : la regle sautait un mot sur deux dans une suite
     de mots courts. Le motif consomme l'espace QUI PRECEDE le mot ; apres
     avoir traite "par" dans "par le moteur", le balayage reprend sur "le"
     sans espace disponible devant lui, donc "le" restait suivi d'une espace
     ordinaire et pouvait finir seul en fin de ligne -- precisement ce que la
     regle existe pour eviter. Pareil pour "a volonte" ou "de la partie".
     On rejoue donc le remplacement jusqu'a stabilisation. La borne a 5 tours
     n'est pas de la prudence decorative : sans elle, une regle mal modifiee
     un jour pourrait boucler sans fin sur une chaine du site. En pratique
     deux tours suffisent, les suites de plus de trois mots courts d'affilee
     n'existant pas dans nos libelles. */
  let out=String(x),avant;
  for(let i=0;i<5;i++){
    avant=out;
    out=out.replace(MOTS_LIES, function(_, av, mot, ap){
      return av + mot + (mot.endsWith("'") ? "" : " ");
    });
    if(out===avant)break;
  }
  /* Ponctuation haute (2026-11-21, regle d'Alexandre) : « : », « ; », « ! »,
     « ? », « » » ne commencent jamais une ligne, ils restent avec le mot qui
     les precede ; pareil pour le mot qui suit « «. Espace insecable. */
  return out.replace(/ ([:;!?»])/g," $1").replace(/« /g,"« ");
}
/* La meme regle de ponctuation pour un texte du dictionnaire ecrit en HTML
   (« @legal », « @privacy », « @keyboard ») : il est pose tel quel dans la
   page, sans passer par t(), et gardait donc ses espaces ordinaires. Constat
   d'Alexandre le 2026-11-22 : des « ; » et des « : » seuls en debut de ligne
   dans Mentions legales et Confidentialite. Seul le texte est touche, jamais
   l'interieur d'une balise. */
function lierHtml(html){
  if(LANG!=="fr")return html;
  return String(html).split(/(<[^>]*>)/).map((bout,i)=>i%2?bout:bout.replace(/ ([:;!?»])/g,"\u00a0$1").replace(/« /g,"«\u00a0")).join("");
}
/* Gabarits a variables : pluriels, cas et accords, voir GRAMMAIRE.gabarit
   (grammaire.js), qui sert aussi aux pages statiques. */
function rendreGabarit(modele,v){return GRAMMAIRE.gabarit(modele,v);}
function formePlurielle(val,v){return GRAMMAIRE.pluriel(val,v,LANG_INTL);}
/* Ton de l'application (2026-11-15, valide par Alexandre) : une reaction
   (reussite, erreur, attente, fin de partie...) peut avoir plusieurs
   variantes, une LISTE dans le dictionnaire de la langue, tiree au hasard
   sans jamais redonner deux fois de suite la meme. L'anglais a sa table a
   part, TON_EN, la cle restant la phrase d'origine passee a t() : aucun
   appel du code ne change. Une variante peut etre un objet de pluriel
   (russe, polonais). Humour seulement dans l'app, jamais aux depens du
   joueur ; regles, explications et pages claires restent sobres. */
/* Depuis le 2026-11-23 la table n'est plus dans le script (7 000 caracteres
   livres aux dix langues pour la seule page anglaise) : build_site.js la pose
   dans le bloc de langue de la page anglaise (PAGE_LANGUE.ton, tire de
   ton_en.json) ; une langue a qui une reaction manquerait recoit, de la meme
   facon, les seules variantes anglaises qui lui manquent. */
const TON_EN=PAGE_LANGUE.ton||{};
const TON_DERNIER={};
function tVariante(s,val){
  if(!Array.isArray(val)||!val.length)return val;
  let i=Math.floor(Math.random()*val.length);
  if(val.length>1&&i===TON_DERNIER[s])i=(i+1)%val.length;
  TON_DERNIER[s]=i;
  return val[i];
}
function t(s,v){
  let val=DICT[s];
  if(val===undefined&&TON_EN[s])val=TON_EN[s];
  val=tVariante(s,val);
  const out=rendreGabarit(formePlurielle(val,v)||s,v);
  return LANG==="fr" ? lier(out) : out;
}
/* textes statiques du document : relevés une fois, retraduits à la demande */
let i18nText=[],i18nAttr=[];
function collectI18n(){
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  let n;
  while((n=walk.nextNode())){
    if(n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))continue;
    const v=n.nodeValue,trimmed=v.trim();
    if(!trimmed||!/[A-Za-z]{3}/.test(trimmed))continue;
    i18nText.push({node:n,en:trimmed,raw:v,current:v});
  }
  for(const el of document.querySelectorAll("[placeholder],[aria-label]")){
    for(const a of ["placeholder","aria-label"]){
      const v=el.getAttribute(a);
      if(v&&/[A-Za-z]{3}/.test(v))i18nAttr.push({el:el,attr:a,en:v});
    }
  }
}
function applyI18n(){
  document.documentElement.lang=LANG_HTML;
  for(const r of i18nText){
    if(r.node.nodeValue!==r.current)continue;   // remplacé dynamiquement, on n'y touche pas
    const next=r.raw.replace(r.en,t(r.en));
    r.node.nodeValue=next;r.current=next;
  }
  for(const r of i18nAttr)r.el.setAttribute(r.attr,t(r.en));
  /* Le titre de l'onglet restait en anglais en francais (audit du
     2026-10-24) : il vit dans <head>, hors de la marche de collectI18n. */
  if(titreEn===null)titreEn=document.title;
  document.title=t(titreEn);
  for(const el of document.querySelectorAll("[data-nombre]"))el.textContent=fmtEntier(el.dataset.nombre);
  rendreDateSite();
}
let titreEn=null;
/* Separateur des milliers selon la langue (2026-10-24) : "108868 exercices"
   s'affichait sans espace en francais. Intl donne l'espace fine insecable du
   francais et la virgule de l'anglais ; build_site.js passe par la meme
   fonction d'Intl pour le texte de presentation, donc les deux concordent.
   Les compteurs a formater portent leur valeur brute dans data-nombre. */
function fmtEntier(n){
  return Number(n).toLocaleString(LANG_INTL);
}
/* Date de publication et de mise a jour de l'application (2026-10-18), meme
   formule que le pied des pages de contenu (shell() dans build_site.js) et
   meme registre, content-dates.json, sous la cle "/". Les deux dates sont
   posees par le build dans data-publiee/data-modifiee. L'anglais garde la
   date ISO ; les autres langues l'ecrivent en toutes lettres par Intl, en
   UTC pour que le jour ne glisse pas selon le fuseau du visiteur. */
function dateLongue(iso){
  try{return new Intl.DateTimeFormat(LANG_INTL,{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})
    .format(new Date(iso+"T12:00:00Z"));}catch(e){return iso;}
}
function rendreDateSite(){
  const el=document.getElementById("footDate");if(!el)return;
  const p=el.dataset.publiee,m=el.dataset.modifiee;
  const iso=/^\d{4}-\d\d-\d\d$/;
  if(!iso.test(p||"")||!iso.test(m||""))return;
  const d=LANG==="en"?(x=>x):dateLongue;
  el.textContent=m!==p
    ?t("Published {p}, updated {m}",{p:d(p),m:d(m)})
    :t("Published {p}",{p:d(p)});
}
/* La langue retenue est celle de la page visitee, notee a chaque chargement
   sous "chang64:lang", la cle que lisent aussi les pages statiques. La page
   anglaise "/" s'en sert pour renvoyer vers /fr/, /es/... (script en tete de
   page, pose par le build) ; loadLang ne change plus LANG. */
async function saveLang(){try{await window.storage.set("chang64:lang",LANG);}catch(e){}}
async function loadLang(){saveLang();}
collectI18n();
applyI18n();
