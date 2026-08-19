/* Verification automatique de chang64.
   Lancement : node tests/check_chiffres_annonces.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le site annonce des quantites au public : le nombre d'exercices sur la page
   d'accueil, dans la meta description, dans l'image de partage, dans les
   donnees structurees, dans les tuiles de navigation, et cela dans les deux
   langues. Ces chiffres etaient ecrits en dur et sont restes bloques sur 489
   alors que la banque en comptait deja 777. La banque est depuis passee a
   1000 exercices sur dix niveaux ; le meme risque existe a chaque
   enrichissement, d'ou cette suite plutot qu'une correction ponctuelle.

   Un chiffre faux sur la page d'accueil est visible par tous les visiteurs et
   par Google. Cette suite compare chaque nombre affiche aux donnees reelles.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const SRC = path.join(__dirname, "..");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const puzzles = JSON.parse(fs.readFileSync(path.join(SRC, "puzzles.json"), "utf8"));
const OP = JSON.parse(fs.readFileSync(path.join(SRC, "openings.json"), "utf8"));
const NP = puzzles.length;
const NF = OP.f.length;
const NL = OP.o.split("\n").filter(Boolean).length;

console.log("\n--- Donnees reelles ---");
console.log("  exercices : " + NP + "   familles : " + NF + "   lignes : " + NL);

const idx = fs.readFileSync(SITE + "/index.html", "utf8");

console.log("\n--- Aucun chiffre perime ne subsiste ---");
/* 489 etait le nombre d'exercices avant le premier enrichissement (a 777) ;
   777 etait a son tour le compte avant celui-ci (a 1000, sur dix niveaux).
   Ni l'un ni l'autre ne doit plus apparaitre nulle part comme quantite
   annoncee : le bug d'origine (texte fige pendant que la banque grossit) se
   reproduirait a l'identique avec le nombre precedent. */
const perimes = [];
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (f.endsWith(".html")) {
      const h = fs.readFileSync(q, "utf8");
      if (/(489|777) (puzzles|exercices|positions|verified|engine)/.test(h)) perimes.push(q.replace(SITE, ""));
    }
  }
})(SITE);
T("aucune page n'annonce encore 489 ou 777", perimes.length === 0, perimes.slice(0, 5).join(", "));

console.log("\n--- Aucun jeton de substitution oublie ---");
const jetons = [];
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (/\.(html|json|webmanifest)$/.test(f)) {
      if (/__NP__|__NF__|__NL__|__PUZZLES__|__OPENINGS__|__I18N__|__BRANDMARK__/.test(fs.readFileSync(q, "utf8")))
        jetons.push(q.replace(SITE, ""));
    }
  }
})(SITE);
T("aucun jeton non substitue", jetons.length === 0, jetons.slice(0, 5).join(", "));

console.log("\n--- Le nombre d'exercices est juste partout ---");
T("compteur de la page d'accueil", new RegExp('id="hCount">' + NP + '<').test(idx),
  (idx.match(/id="hCount">(\d+)</) || [])[1]);
T("meta description", new RegExp('name="description"[^>]*' + NP + ' ').test(idx),
  (idx.match(/name="description" content="([^"]{0,120})/) || [])[1]);
T("image de partage (og:description)", new RegExp('og:description"[^>]*' + NP + ' ').test(idx),
  (idx.match(/og:description" content="([^"]{0,120})/) || [])[1]);
T("donnees structurees", new RegExp('featureList[^\\]]*' + NP + ' ').test(idx));
T("texte de presentation anglais", new RegExp(NP + ' puzzles verified move by move').test(idx));
T("texte de presentation francais", new RegExp(NP + ' exercices v').test(idx));
T("tuile de navigation", new RegExp(NP + ' (verified positions|positions v)').test(idx));

console.log("\n--- Les pages d'index annoncent le bon compte ---");
for (const [p, lbl] of [["/puzzles/index.html", "exercices EN"], ["/fr/exercices/index.html", "exercices FR"]]) {
  const h = fs.readFileSync(SITE + p, "utf8");
  const nb = (h.match(/(\d{3,5})\s*(puzzles|exercices|verified|positions)/) || [])[1];
  T(lbl + " : " + p, String(nb) === String(NP), "annonce " + nb + ", reel " + NP);
}

console.log("\n--- Meta description sous 160 caracteres (le nombre grossit avec la banque) ---");
/* check_seo_entete.js ne verifie cette limite que sur la page d'accueil.
   Ces deux pages d'index affichent aussi le compte d'exercices dans leur
   description : passer de 777 a 1000, ou de "cinq" a "dix" niveaux, ajoute
   des caracteres et peut faire deborder un texte deja proche du seuil (c'est
   arrive : la version francaise est passee de 174 a 123 caracteres a cette
   occasion). On le verifie ici plutot que de decouvrir le depassement dans
   les resultats de recherche. */
for (const [p, lbl] of [["/index.html", "accueil"], ["/puzzles/index.html", "exercices EN"], ["/fr/exercices/index.html", "exercices FR"]]) {
  const h = fs.readFileSync(SITE + p, "utf8");
  const d = (h.match(/name="description" content="([^"]*)"/) || [])[1] || "";
  T(lbl + " : description sous 160 caracteres (" + d.length + ")", d.length > 0 && d.length <= 160, d);
}

console.log("\n--- Ouvertures : familles et lignes ---");
T("nombre de familles", new RegExp(NF + ' (families|familles)').test(idx),
  (idx.match(/(\d+) (?:families|familles)/) || [])[1]);
T("nombre de lignes nommees", new RegExp(NL + ' (named lines|variantes)').test(idx),
  (idx.match(/(\d+) (?:named lines|variantes)/) || [])[1]);

console.log("\n--- Les pages reellement produites correspondent ---");
const pagesEn = fs.readdirSync(SITE + "/openings").filter(f => f.endsWith(".html") && f !== "index.html").length;
T("une page par famille d'ouverture", pagesEn === NF, pagesEn + " pages pour " + NF + " familles");
const pzEn = fs.readdirSync(SITE + "/puzzles").filter(f => f.endsWith(".html") && f !== "index.html").length;
T("une page par exercice", pzEn === NP, pzEn + " pages pour " + NP + " exercices");

console.log("\n--- Rien n'est fige dans les sources ---");
for (const f of ["template.html", "i18n.js", "ui2.js", "build_site.js"]) {
  /* On retire les commentaires : un exemple cite dans une explication
     ("141 familles, 1758 variantes") n'est pas une quantite figee dans le
     produit, et le signaler ferait echouer le test pour rien. */
  const s = fs.readFileSync(path.join(SRC, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  T(f + " sans quantite ecrite en dur",
    !/\b(489|777|1758)\s*(puzzles|exercices|positions|verified|named lines|variantes)/.test(s) &&
    !/\b141 (families|familles)/.test(s));
}

console.log("\n--- Noms de fonctionnalites propres au site ---");
/* "Puzzle Rush" est le nom d'une fonctionnalite existant ailleurs. Le mode
   chronometre de chang64 s'appelle Chang Sprint. Cette verification empeche
   l'ancien nom de revenir par une traduction, un texte de page ou un test. */
const empruntes = [];
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (/\.(html|md|json)$/.test(f)) {
      const h = fs.readFileSync(q, "utf8");
      /* on ignore le commentaire de code qui documente le renommage */
      const visible = h.replace(/\/\*[\s\S]*?\*\//g, "");
      if (/Puzzle Rush|Puzzle Storm|Puzzle Streak/i.test(visible)) empruntes.push(q.replace(SITE, ""));
    }
  }
})(SITE);
T("aucun nom de fonctionnalite emprunte", empruntes.length === 0, empruntes.slice(0, 5).join(", "));
T("Chang Sprint present dans l'interface", /Chang Sprint/.test(idx));
T("le bouton porte le nouveau nom", /id="btnGoRush">Start Chang Sprint</.test(idx));
T("traduction francaise en place", /"Chang Sprint":"Chang Sprint"/.test(idx));
T("donnees structurees a jour", /"Chang Sprint"/.test(idx.match(/featureList[^\]]*\]/)?.[0] || ""));
T("cle de progression inchangee (rushBest)", /rushBest/.test(idx),
  "renommer cette cle effacerait le record des visiteurs");

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
