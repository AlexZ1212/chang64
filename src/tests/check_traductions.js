/* Verification automatique de chang64.
   Lancement : node tests/check_traductions.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Une chaine sans traduction ne provoque aucune erreur : elle s'affiche
   simplement en anglais au milieu du francais, et personne ne le voit tant
   qu'un utilisateur ne tombe pas dessus. C'est ainsi que le message sur
   Stockfish est reste en anglais, et que "Niveau 1 of 5" a survecu.

   Depuis le 2026-10-25, le site a six langues (langues/registre.js), chacune
   avec sa page d'accueil et ses pages statiques. Cette suite verifie, pour
   chaque langue :
   - que son dictionnaire de l'application couvre toutes les cles du
     francais (la reference, complete depuis des mois) et toutes les phrases
     passees a t() dans le code, avec les memes variables ;
   - qu'aucune phrase des pages statiques n'est restee sans traduction
     (langues/manquants.json, ecrit par le build) ;
   - que l'interface reellement ouverte dans cette langue n'affiche plus de
     phrase anglaise du dictionnaire.
   Les controles propres au francais (tutoiement, typographie, vocabulaire
   des cadences, reference LCEN) sont gardes tels quels. */
const fs = require("fs");
const path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");

const SRC = path.join(__dirname, "..");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const AUTRES = LANGUES.filter(l => l.code !== "en").map(l => l.code);
const dico = l => require(path.join(SRC, "langues", l, "app.js"));
const FR = dico("fr");

/* ---------- controle statique des tables ---------- */
const code = ["ui.js", "ui2.js", "ui3.js"].map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n");
const utilisees = [...code.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)].map(m => m[1]);
/* Deux precautions pour ne pas produire de faux positifs :
   - les guillemets typographiques sont ecrits “ dans le code et en clair
     dans la table : on normalise avant de comparer ;
   - les chaines concatenees avant l'appel a t() ne sont pas resolubles
     statiquement, on les ecarte. */
const norm = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, "\"");
const vars = s => [...new Set([...String(s).matchAll(/\{([A-Za-z0-9_]+)(?::[a-z]+)?(?:\?[^|{}]*\|[^{}]*)?\}/g)].map(m => m[1]))].sort().join(",");
const formes = v => typeof v === "object" ? Object.entries(v) : [["", v]];

for (const l of AUTRES) {
  console.log("\n--- Table de l'application : " + l + " ---");
  let D;
  try { D = dico(l); } catch (e) { T("dictionnaire " + l + " present", false, e.message); continue; }
  const cles = new Set(Object.keys(D).map(norm));
  const manquantes = utilisees.filter(k => !cles.has(norm(k)) && !k.endsWith(" "));
  T(utilisees.length + " chaines passees a t(), toutes traduites", manquantes.length === 0, manquantes.slice(0, 5).join(" | "));
  const absentes = Object.keys(FR).filter(k => !(k in D));
  T("toutes les cles du francais presentes (" + Object.keys(FR).length + ")", absentes.length === 0, absentes.slice(0, 5).join(" | "));
  const enTrop = Object.keys(D).filter(k => !(k in FR));
  T("aucune cle inconnue du francais", enTrop.length === 0, enTrop.slice(0, 5).join(" | "));
  /* La forme "one" d'un pluriel peut taire n ("su unica variante"). */
  /* Les textes longs ("@legal"...) se comparent au francais, pas a leur cle. */
  const varsKo = Object.entries(D).filter(([k, v]) => formes(v).some(([cat, f]) => {
    const a = vars(k.startsWith("@") ? FR[k] : k).split(",").filter(x => cat !== "one" || x !== "n").join(",");
    const b = vars(f).split(",").filter(x => cat !== "one" || x !== "n").join(",");
    return a !== b;
  }));
  T("variables coherentes", varsKo.length === 0, varsKo.slice(0, 3).map(x => x[0]).join(" | "));
  const vides = Object.entries(D).filter(([, v]) => formes(v).some(([, f]) => !String(f).trim()));
  T("aucune traduction vide", vides.length === 0, vides.slice(0, 3).map(x => x[0]).join(" | "));
  if (l !== "fr") {
    const jeton = Object.entries(D).filter(([k, v]) => k.includes("__NP_EN__") && !String(v).includes("__NP_LOC__"));
    T("nombre d'exercices groupe dans la langue (__NP_LOC__)", jeton.length === 0, jeton.map(x => x[0].slice(0, 40)).join(" | "));
  }
  /* Registre familier partout, comme le francais : tu, tú, você, du, ты. */
  const VOUS = { fr: /\b(vous|votre|vos)\b/i, es: /\b(usted|ustedes)\b/i, pt: /\b(o senhor|a senhora)\b/i,
    de: /(?<![.!?:]\s|^|„|«)\bSie\b|\bIhnen\b/, ru: /(^|[^а-яё])(Вы|вы|Вас|вас|Вам|вам|Ваш|ваш)([^а-яё]|$)/ };
  if (VOUS[l]) {
    const vouv = Object.entries(D).filter(([, v]) => formes(v).some(([, f]) => VOUS[l].test(String(f).replace(/<[^>]+>/g, " "))));
    T("registre familier respecte", vouv.length === 0, vouv.slice(0, 3).map(x => String(x[1]).slice(0, 60)).join(" | "));
  }
}

console.log("\n--- Style francais ---");
const pairesFr = Object.entries(FR).filter(([k, v]) => typeof v === "string" && !k.startsWith("@"));
const cadratin = pairesFr.filter(([, f]) => /—/.test(f));
T("aucun tiret cadratin", cadratin.length === 0, cadratin.slice(0, 3).map(x => x[1]).join(" | "));
const ponct = pairesFr.filter(([, f]) => /[a-zà-ÿ0-9][!?;:»]/i.test(f.replace(/\{[^}]*\}/g, "")));
T("espace avant la ponctuation double", ponct.length === 0, ponct.slice(0, 3).map(x => x[1]).join(" | "));

console.log("\n--- Pages statiques ---");
let manq = null;
try { manq = JSON.parse(fs.readFileSync(path.join(SRC, "langues", "manquants.json"), "utf8")); } catch (e) {}
T("langues/manquants.json ecrit par le build", !!manq);
for (const l of AUTRES.filter(x => x !== "fr")) {
  const liste = (manq && manq[l]) || [];
  T("pages " + l + " : aucune phrase restee en anglais", manq && liste.length === 0, liste.length + " : " + liste.slice(0, 3).join(" | "));
}

/* ---------- controle reel, interface ouverte dans chaque langue ---------- */
const PANES = ["brand", "tab-play", "tab-puzzles", "tab-train", "tab-friend", "tab-explore"];
const PIEDS = ["footLegal", "footPrivacy", "footPrefs", "footAccess"];
function collecter(d, vus) {
  const walk = d.createTreeWalker(d.body, 4);
  let n;
  while (n = walk.nextNode()) {
    const t = (n.nodeValue || "").trim();
    const p = n.parentElement;
    if (t.length < 4 || !p || ["SCRIPT", "STYLE"].includes(p.tagName) || p.closest(".hide") || p.closest("#langSwitch") || p.closest("#kbdHelp")) continue;
    vus.add(t);
  }
}
async function parcourir(w) {
  const d = w.document, vus = new Set();
  for (const id of PANES.concat(PIEDS)) {
    const b = d.getElementById(id);
    if (!b) continue;
    b.click();
    await attendre(400);
    collecter(d, vus);
  }
  return vus;
}

(async () => {
  for (const l of AUTRES) {
    let D;
    try { D = dico(l); } catch (e) { continue; }
    const w = await ouvrir(l);
    const d = w.document;
    const vus = await parcourir(w);
    console.log("\n--- Interface ouverte en " + l + " ---");
    const attendu = LANGUES.find(x => x.code === l).html;
    T("la langue du document est " + attendu, d.documentElement.lang === attendu, d.documentElement.lang);
    T(vus.size + " textes visibles collectes", vus.size > 150, String(vus.size));
    /* Un texte visible qui est encore une phrase anglaise du dictionnaire
       (traduite autrement) n'a pas ete traduit. Les gabarits ({n}
       exercices) sont compares par motif, pour attraper aussi les
       decomptes. Les cles de moins de 4 lettres sont ecartees (W/L/D). */
    const ech = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const motifs = Object.entries(D).filter(([k, v]) => typeof v === "string" && k !== v && k.length > 3 && !k.startsWith("@"))
      .map(([k]) => k.includes("{") ? new RegExp("^" + ech(k).replace(/\\\{[a-z]+\\\}/gi, "[^ ]{1,20}") + "$") : k);
    /* Un texte qui est aussi une traduction de cette langue n'est pas un
       reste ("Start" est l'allemand de "Home"). L'aide du clavier, ecartee
       plus haut, cite les touches par leur nom (Home, End). */
    const valeurs = new Set(Object.values(D).filter(v => typeof v === "string"));
    const restes = [...vus].filter(t => !valeurs.has(t) && motifs.some(m => typeof m === "string" ? m === t : m.test(t)));
    T("aucune phrase anglaise du dictionnaire a l'ecran", restes.length === 0, restes.slice(0, 4).join(" | "));
    if (l === "fr") {
      /* Le francais garde en plus son controle d'origine : un texte est
         suspect s'il contient des mots anglais courants sans aucune marque
         du francais. */
      const EN = /\b(the|and|your|you|with|from|this|that|move|moves|game|games|puzzle|puzzles|best|score|level|start|stop|next|back|play|white|black|check|mate|board|piece|pieces|time|left|new|open|close|show|hide|help|about|settings|search|loading|error|save|share|copy|link|friend|day|days|streak|rating|theme|themes|hint|solution|win|lose|draw|engine|stronger|downloads|preferences|accessibility|privacy|legal|notice|home|install|app)\b/i;
      const FRm = /[àâçéèêëîïôùûüœ]|\b(le|la|les|un|une|de|des|du|et|tu|ton|ta|tes|coup|coups|partie|parties|exercice|exercices|niveau|blanc|noir|pion|dame|tour|fou|roi|cavalier|jouer|jouent|est|sont|pour|avec|sur|dans|sans|ami)\b/i;
      const suspects = [...vus].filter(t => EN.test(t) && !FRm.test(t));
      T("aucun texte reste en anglais (heuristique)", suspects.length === 0, suspects.slice(0, 4).join(" | "));

      console.log("\n--- Points corriges qui ne doivent pas revenir ---");
      const lvlOf = d.getElementById("lvlOf");
      T("Niveau X sur Y, et non 'of'", lvlOf && lvlOf.textContent === "sur", lvlOf && lvlOf.textContent);
      T("le message sur Stockfish est traduit",
        /automatiquement/.test(d.getElementById("sfStatus").textContent),
        d.getElementById("sfStatus").textContent.slice(0, 60));

      console.log("\n--- Vocabulaire des cadences ---");
      /* "Classique" et "Correspondance" sont les termes consacres en
         francais. "Longue" detonnait a cote de Bullet, Blitz et Rapide, et
         "Par jour" contredisait le texte d'accueil qui parle de jeu par
         correspondance. */
      const cats = id => { const e = d.getElementById(id); return e ? [...e.children].map(c => c.textContent.trim()) : []; };
      const c1 = cats("tcCats");
      T("cadences en francais consacre", c1.includes("Classique") && c1.includes("Correspondance"), c1.join(" | "));
      T("ancien vocabulaire absent", !c1.includes("Longue") && !c1.includes("Par jour"), c1.join(" | "));
      T("le second selecteur est aligne", cats("tcCats2").includes("Classique"), cats("tcCats2").join(" | "));
      const accueil = [...vus].find(t => /correspondance/i.test(t));
      T("le texte d'accueil emploie le meme mot", !!accueil, accueil ? accueil.slice(0, 70) : "introuvable");

      console.log("\n--- Pied de page entierement traduit ---");
      /* Ces libelles sont poses par la table de traduction, pas par
         renderPrefs : les traduire seulement a l'ouverture du panneau
         laissait le pied de page en anglais. */
      const pied = [...d.querySelectorAll("footer .linkbtn")].map(b => b.textContent.trim());
      T("aucun libelle anglais dans le pied de page",
        !pied.some(t => /^(Preferences|Accessibility|Privacy|Legal notice|Home)$/.test(t)), pied.join(" | "));
      T("Accessibilite traduit", pied.includes("Accessibilité"), pied.join(" | "));
      T("Preferences traduit", pied.includes("Préférences"), pied.join(" | "));

      console.log("\n--- Reference LCEN a jour ---");
      /* Depuis la loi SREN (21 mai 2024), l'obligation d'identification de
         l'editeur n'est plus a l'article 6 mais a l'article 1-1, II de la
         LCEN. Beaucoup de generateurs de mentions legales n'ont jamais ete
         mis a jour : ne pas refaire la meme erreur ici. */
      const legalFr = [...vus].find(t => /confiance dans l.économie numérique/i.test(t));
      T("reference francaise a l'article 1-1, II", legalFr && /article 1-1, II/.test(legalFr), legalFr);
      T("ancien article 6 absent partout (francais)", ![...vus].some(t => /article 6, III/.test(t)));
    } else {
      /* Les mentions legales traduites gardent la reference exacte. */
      const legal = d.getElementById("legalBody").textContent;
      T("mentions legales traduites, article 1-1, II cite", /1-1, II/.test(legal) && !/Publisher/.test(legal), legal.slice(0, 80));
      const priv = d.getElementById("privacyBody").textContent;
      T("confidentialite traduite, mesure de la difficulte comprise", priv.length > 800 && !/Measuring puzzle difficulty/.test(priv), priv.slice(0, 60));
    }
  }

  console.log("\n--- Mentions legales en anglais ---");
  const we = await ouvrir("en");
  we.document.getElementById("footLegal").click();
  await attendre(400);
  const legalEn = we.document.getElementById("legalBody").textContent;
  T("reference anglaise a l'article 1-1, II", /article 1-1, II/.test(legalEn), legalEn.slice(0, 140));
  T("ancien article 6 absent en anglais", !/article 6, III/.test(legalEn));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
