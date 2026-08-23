/* Verification automatique de chang64.
   Lancement : node tests/check_traductions.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Une chaine sans traduction ne provoque aucune erreur : elle s'affiche
   simplement en anglais au milieu du francais, et personne ne le voit tant
   qu'un utilisateur ne tombe pas dessus. C'est ainsi que le message sur
   Stockfish est reste en anglais, et que "Niveau 1 of 5" a survecu.

   Cette suite bascule reellement l'interface en francais, parcourt tous les
   ecrans, et signale ce qui n'a pas ete traduit.
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const SRC = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(SRC, "site", "index.html"), "utf8");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

/* ---------- controle statique de la table ---------- */
const i18n = fs.readFileSync(path.join(SRC, "i18n.js"), "utf8");
const cles = new Set([...i18n.matchAll(/"((?:[^"\\]|\\.)+)"\s*:\s*"/g)].map(m => m[1]));
const code = ["ui.js", "ui2.js", "ui3.js"].map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n");
const utilisees = [...code.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)].map(m => m[1]);

console.log("\n--- Table de traduction ---");
/* Deux precautions pour ne pas produire de faux positifs :
   - les guillemets typographiques sont ecrits \u201c dans le code et en clair
     dans la table : on normalise avant de comparer ;
   - les chaines concatenees avant l'appel a t() ne sont pas resolubles
     statiquement, on les ecarte. */
const norm = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const clesN = new Set([...cles].map(norm));
const manquantes = utilisees.filter(k => !clesN.has(norm(k)) && !k.endsWith(" "));
T(utilisees.length + " chaines passees a t(), toutes traduites", manquantes.length === 0,
  manquantes.slice(0, 5).join(" | "));

console.log("\n--- Coherence des variables ---");
const pairs = [...i18n.matchAll(/"((?:[^"\\]|\\.){4,})"\s*:\s*"((?:[^"\\]|\\.)+)"/g)].map(m => [m[1], m[2]]);
const varsKo = pairs.filter(([e, f]) =>
  (e.match(/\{[a-z]+\}/g) || []).sort().join(",") !== (f.match(/\{[a-z]+\}/g) || []).sort().join(","));
T(pairs.length + " paires, variables coherentes", varsKo.length === 0,
  varsKo.slice(0, 3).map(x => x[0]).join(" | "));

console.log("\n--- Style francais ---");
const vouv = pairs.filter(([, f]) => /\b(vous|votre|vos)\b/i.test(f));
T("le tutoiement est respecte partout", vouv.length === 0, vouv.slice(0, 3).map(x => x[1]).join(" | "));
const cadratin = pairs.filter(([, f]) => /—/.test(f));
T("aucun tiret cadratin", cadratin.length === 0, cadratin.slice(0, 3).map(x => x[1]).join(" | "));
const ponct = pairs.filter(([, f]) => /[a-zà-ÿ0-9][!?;:»]/i.test(f));
T("espace avant la ponctuation double", ponct.length === 0, ponct.slice(0, 3).map(x => x[1]).join(" | "));

/* ---------- controle reel, interface basculee en francais ---------- */
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://chang64.com/", virtualConsole: new VirtualConsole() });
const w = dom.window, d = w.document;

const PANES = ["tab-home", "tab-play", "tab-puzzles", "tab-train", "tab-friend", "tab-watch"];
const PIEDS = ["footLegal", "footPrivacy", "footPrefs", "footAccess"];
const attendre = ms => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  const fr = [...d.getElementById("langSwitch").children].find(b => b.dataset.lang === "fr");
  fr.click();
  await attendre(500);

  const vus = new Set();
  const collecter = () => {
    const walk = d.createTreeWalker(d.body, 4);
    let n;
    while (n = walk.nextNode()) {
      const t = (n.nodeValue || "").trim();
      const p = n.parentElement;
      if (t.length < 4 || !p || ["SCRIPT", "STYLE"].includes(p.tagName) || p.closest(".hide")) continue;
      vus.add(t);
    }
  };
  for (const id of PANES.concat(PIEDS)) {
    const b = d.getElementById(id);
    if (!b) continue;
    b.click();
    await attendre(400);
    collecter();
  }

  console.log("\n--- Interface reellement basculee en francais ---");
  T("la langue du document est fr", d.documentElement.lang === "fr", d.documentElement.lang);
  T(vus.size + " textes visibles collectes", vus.size > 150, String(vus.size));

  /* Un texte est suspect s'il contient des mots anglais courants sans aucune
     marque du francais : accent, article ou mot de liaison. */
  /* "Preferences" et "Accessibility" manquaient a cette liste, et les deux
     libelles sont restes en anglais dans le pied de page sans que rien ne le
     signale. Toute chaine visible doit pouvoir etre attrapee ici. */
  const EN = /\b(the|and|your|you|with|from|this|that|move|moves|game|games|puzzle|puzzles|best|score|level|start|stop|next|back|play|white|black|check|mate|board|piece|pieces|time|left|new|open|close|show|hide|help|about|settings|search|loading|error|save|share|copy|link|friend|day|days|streak|rating|theme|themes|hint|solution|win|lose|draw|engine|stronger|downloads|preferences|accessibility|privacy|legal|notice|home|install|app)\b/i;
  const FR = /[àâçéèêëîïôùûüœ]|\b(le|la|les|un|une|de|des|du|et|tu|ton|ta|tes|coup|coups|partie|parties|exercice|exercices|niveau|blanc|noir|pion|dame|tour|fou|roi|cavalier|jouer|jouent|est|sont|pour|avec|sur|dans|sans|ami)\b/i;
  const suspects = [...vus].filter(t => EN.test(t) && !FR.test(t));
  T("aucun texte reste en anglais", suspects.length === 0, suspects.slice(0, 4).join(" | "));

  console.log("\n--- Points corriges qui ne doivent pas revenir ---");
  const lvlOf = d.getElementById("lvlOf");
  T("Niveau X sur Y, et non 'of'", lvlOf && lvlOf.textContent === "sur", lvlOf && lvlOf.textContent);
  T("le message sur Stockfish est traduit",
    /automatiquement/.test(d.getElementById("sfStatus").textContent),
    d.getElementById("sfStatus").textContent.slice(0, 60));

  console.log("\n--- Vocabulaire des cadences ---");
  /* "Classique" et "Correspondance" sont les termes consacres en francais.
     "Longue" detonnait a cote de Bullet, Blitz et Rapide, et "Par jour"
     contredisait le texte d'accueil qui parle de jeu par correspondance. */
  const cats = id => {
    const e = d.getElementById(id);
    return e ? [...e.children].map(c => c.textContent.trim()) : [];
  };
  const c1 = cats("tcCats");
  T("cadences en francais consacre", c1.includes("Classique") && c1.includes("Correspondance"), c1.join(" | "));
  T("ancien vocabulaire absent", !c1.includes("Longue") && !c1.includes("Par jour"), c1.join(" | "));
  T("le second selecteur est aligne", cats("tcCats2").includes("Classique"), cats("tcCats2").join(" | "));
  const accueil = [...vus].find(t => /correspondance/i.test(t));
  T("le texte d'accueil emploie le meme mot", !!accueil, accueil ? accueil.slice(0, 70) : "introuvable");

  console.log("\n--- Pied de page entierement traduit ---");
  /* Ces libelles sont poses par la table de traduction, pas par renderPrefs :
     les traduire seulement a l'ouverture du panneau laissait le pied de page
     en anglais. */
  const pied = [...d.querySelectorAll("footer .linkbtn")].map(b => b.textContent.trim());
  T("aucun libelle anglais dans le pied de page",
    !pied.some(t => /^(Preferences|Accessibility|Privacy|Legal notice|Home)$/.test(t)), pied.join(" | "));
  T("Accessibilite traduit", pied.includes("Accessibilité"), pied.join(" | "));
  T("Preferences traduit", pied.includes("Préférences"), pied.join(" | "));

  console.log("\n--- Reference LCEN a jour ---");
  /* Depuis la loi SREN (21 mai 2024), l'obligation d'identification de
     l'editeur n'est plus a l'article 6 mais a l'article 1-1, II de la LCEN.
     Beaucoup de generateurs de mentions legales n'ont jamais ete mis a jour :
     ne pas refaire la meme erreur ici. Controle bilingue : la collecte
     precedente n'a visite que le francais, donc on repasse explicitement
     en anglais pour verifier ce texte-la aussi. */
  const legalFr = [...vus].find(t => /confiance dans l.économie numérique/i.test(t));
  T("reference francaise a l'article 1-1, II", legalFr && /article 1-1, II/.test(legalFr), legalFr);

  const en = [...d.getElementById("langSwitch").children].find(b => b.dataset.lang === "en");
  en.click();
  await attendre(400);
  d.getElementById("footLegal").click();
  await attendre(400);
  const legalEn = d.getElementById("legalBody").textContent;
  T("reference anglaise a l'article 1-1, II", /article 1-1, II/.test(legalEn), legalEn.slice(0, 140));
  T("ancien article 6 absent en anglais", !/article 6, III/.test(legalEn));
  T("ancien article 6 absent partout (francais)", ![...vus].some(t => /article 6, III/.test(t)));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1500);
