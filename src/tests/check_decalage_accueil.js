/* Verification automatique de chang64.
   Lancement : node tests/check_decalage_accueil.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Audit Lighthouse du 2026-10-24 (mobile simule) : CLS de 0,164 sur
   l'accueil, presque tout sur section.hero > div.hero-rest. Mesure au
   navigateur a 375px : sans script, #tcCats, #tcChips et #tcNote etaient
   vides et .hero-rest faisait 118px ; remplis par renderTC(), 248px. Les
   boutons "Jouer maintenant" et toutes les cartes en dessous descendaient
   de 130px au premier passage du script, que Lighthouse voit APRES le
   premier rendu sur un processeur ralenti.
   Correctif : le gabarit porte deja l'etat par defaut (Rapid, 10+0), tel
   que renderTC() le produit pour un premier visiteur. Ce test garde les deux
   en accord : si l'un change sans l'autre, le decalage revient.
   jsdom ne fait pas de mise en page, on compare donc le contenu, qui decide
   de la hauteur ; la mesure elle-meme a ete faite au navigateur. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

/* Ce qui compte pour la hauteur : quels boutons, dans quel ordre, avec quel
   texte, lequel est selectionne (gras), plus le texte de la note. */
const empreinte = d => ({
  cats: [...d.getElementById("tcCats").children].map(b => b.tagName + ":" + b.textContent + ":" + b.getAttribute("aria-pressed")).join("|"),
  chips: [...d.getElementById("tcChips").children].map(b => b.tagName + "." + b.className + ":" + b.textContent + ":" + b.getAttribute("aria-pressed")).join("|"),
  note: d.getElementById("tcNote").textContent
});

console.log("\n--- Le gabarit porte deja la cadence par defaut ---");
const statique = empreinte(new jd.JSDOM(html).window.document);
T("categories ecrites dans le HTML", statique.cats.split("|").length >= 4, statique.cats);
T("puces ecrites dans le HTML", statique.chips.split("|").length >= 2, statique.chips);
T("note ecrite dans le HTML", statique.note.length > 10, statique.note);

console.log("\n--- Le script les reecrit a l'identique pour un premier visiteur ---");
const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
  virtualConsole: new jd.VirtualConsole() });
const w = dom.window;
w.fetch = () => Promise.resolve({ ok: false, status: 404 });
setTimeout(() => {
  const vivant = empreinte(w.document);
  T("langue du test : anglais", w.document.documentElement.lang === "en", w.document.documentElement.lang);
  T("categories identiques", vivant.cats === statique.cats, vivant.cats + "  au lieu de  " + statique.cats);
  T("puces identiques", vivant.chips === statique.chips, vivant.chips + "  au lieu de  " + statique.chips);
  T("note identique", vivant.note === statique.note, vivant.note);
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
}, 1500);
