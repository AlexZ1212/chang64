/* Verification automatique de chang64.
   Lancement : node tests/check_ponctuation_html.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Constat d'Alexandre du 2026-11-22 : des « ; » et des « : » seuls en debut
   de ligne. Mesure faite dans un vrai navigateur (mesure_ponctuation.js) :
   ils venaient de Mentions legales et de Confidentialite, dont le texte est
   ecrit en HTML dans le dictionnaire (« @legal », « @privacy ») et pose dans
   la page sans passer par t(), donc sans l'espace insecable que lier() met
   devant la ponctuation haute. Meme defaut possible pour « @keyboard » et
   pour les titres des fiches de regles (data/fiches-fr.json).

   Regle : en francais, « : », « ; », « ! », « ? » et « » » sont precedes d'une
   espace insecable, « « » en est suivi. Les autres langues collent ces
   signes au mot : aucune espace devant, et rien ne doit y changer. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const SITE = path.join(__dirname, "..", "site");
const NBSP = " ";

/* Le texte visible d'un element, noeud par noeud : ce qui cloche. */
function fautes(w, racine) {
  const out = [], tw = w.document.createTreeWalker(racine, w.NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.nodeValue;
    for (const m of t.matchAll(/ ([:;!?»])/g)) out.push("espace ordinaire devant « " + m[1] + " » : " + t.slice(Math.max(0, m.index - 20), m.index + 8));
    for (const m of t.matchAll(/« /g)) out.push("espace ordinaire apres « : " + t.slice(m.index, m.index + 20));
  }
  return out;
}
const compte = (w, racine, re) => (racine.textContent.match(re) || []).length;

(async () => {
  console.log("--- Francais ---");
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  T("lierHtml ne touche que le texte, jamais l'interieur d'une balise", w.eval("lierHtml('<a href=\"x ?y\" title=\"a : b\">Oui ; non</a> fin !')") === '<a href="x ?y" title="a : b">Oui' + NBSP + '; non</a> fin' + NBSP + "!", w.eval("lierHtml('<a href=\"x ?y\" title=\"a : b\">Oui ; non</a> fin !')"));
  T("lierHtml lie aussi les guillemets", w.eval("lierHtml('<p>dit « oui » : bien</p>')") === "<p>dit «" + NBSP + "oui" + NBSP + "»" + NBSP + ": bien</p>");
  $("footLegal").click(); await attendre(250);
  let f = fautes(w, $("legalBody"));
  T("Mentions legales : aucune ponctuation haute apres une espace ordinaire", f.length === 0, f.slice(0, 3).join(" | "));
  T("Mentions legales : les signes sont bien la, lies par une espace insecable", compte(w, $("legalBody"), new RegExp(NBSP + "[:;!?»]", "g")) >= 5, String(compte(w, $("legalBody"), new RegExp(NBSP + "[:;!?»]", "g"))));
  T("Mentions legales : les liens sont intacts", $("legalBody").querySelectorAll("a[href]").length >= 4 && [...$("legalBody").querySelectorAll("a[href]")].every(a => !/ /.test(a.getAttribute("href"))));
  $("footPrivacy").click(); await attendre(250);
  f = fautes(w, $("privacyBody"));
  T("Confidentialite : aucune ponctuation haute apres une espace ordinaire", f.length === 0, f.slice(0, 3).join(" | "));
  T("Confidentialite : le point-virgule qu'Alexandre a vu est lie au mot d'avant", /adresse IP ; il en garde/.test($("privacyBody").textContent), ($("privacyBody").textContent.match(/adresse IP.{0,20}/) || [""])[0]);
  w.eval("setMode('prefs')"); await attendre(200);
  f = fautes(w, $("kbdHelp"));
  T("Accessibilite, aide au clavier : meme regle", f.length === 0, f.slice(0, 3).join(" | "));
  w.close();

  const fiches = JSON.parse(fs.readFileSync(path.join(SITE, "data", "fiches-fr.json"), "utf8")).fiches;
  const mauvaises = fiches.filter(x => / [:;!?»]/.test(x.t));
  T("fiches de regles : les titres portent l'espace insecable", mauvaises.length === 0 && fiches.some(x => new RegExp(NBSP + ":").test(x.t)), mauvaises.map(x => x.t).slice(0, 2).join(" | "));
  T("fiches de regles : les adresses n'ont pas change", fiches.every(x => /^\/fr\/apprendre\/[a-z0-9-]+$/.test(x.u)), fiches.map(x => x.u).find(u => !/^\/fr\/apprendre\/[a-z0-9-]+$/.test(u)));

  console.log("--- Les autres langues ne changent pas ---");
  const en = await ouvrir("en", { attente: 2200 });
  T("anglais : lierHtml rend le texte tel quel", en.eval("lierHtml('<p>Yes ; no : ok</p>')") === "<p>Yes ; no : ok</p>");
  en.document.getElementById("footPrivacy").click(); await attendre(250);
  T("anglais : aucune espace insecable ajoutee dans Confidentialite", !new RegExp(NBSP + "[:;!?]").test(en.document.getElementById("privacyBody").textContent));
  en.close();
  for (const l of LANGUES) {
    if (l.code === "fr") continue;
    const fl = JSON.parse(fs.readFileSync(path.join(SITE, "data", "fiches-" + l.code + ".json"), "utf8")).fiches;
    T(l.code + " : pas d'espace devant la ponctuation dans les titres des fiches", fl.every(x => !/[  ][:;!?]/.test(x.t)), (fl.find(x => /[  ][:;!?]/.test(x.t)) || {}).t);
  }
  /* Pied des pages d'ouvertures en anglais : « chang64 : free chess » portait une espace a la francaise. */
  const ouverture = fs.readFileSync(path.join(SITE, "openings", "sicilian-defense.html"), "utf8");
  T("anglais, pied des pages d'ouvertures : « chang64: free chess », sans espace devant les deux-points", /chang64: free chess, no account required/.test(ouverture) && !/chang64 : free chess/.test(ouverture));
  for (const l of ["de", "es", "pl"]) {
    const lg = LANGUES.find(x => x.code === l), dir = path.join(SITE, lg.dirs.openings);
    const page = fs.readFileSync(path.join(dir, fs.readdirSync(dir).filter(x => x.endsWith(".html") && x !== "index.html")[0]), "utf8");
    T(l + " : le pied des pages d'ouvertures reste traduit", /chang64: /.test(page) && !/free chess, no account required/.test(page));
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
