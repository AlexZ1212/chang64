/* Verification automatique de chang64.
   Lancement : node tests/check_chargement_exercices.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Audit du 2026-10-24 : en ouvrant Resoudre > Exercices, pendant les 3 a 5 s
   de chargement du premier morceau, l'echiquier gardait la position de la
   partie precedente et l'etiquette de motif restait perimee ("Mat du
   couloir", le texte du gabarit). Le message "Chargement des exercices..."
   partait en outre dans #status, le statut de l'onglet Jouer, invisible a
   cet endroit.
   On retarde ici les reponses de /data/ pour observer l'attente, puis on
   verifie qu'elle se resout sur un vrai exercice. Meme chose pour
   l'exercice du jour. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const DELAI = 1500;

function ouvrir() {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: "fr-FR", configurable: true });
      /* /data/ servi depuis le build local, avec un retard qui laisse le
         temps de regarder l'etat d'attente. */
      w.fetch = url => new Promise(res => setTimeout(() => {
        const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
        try { const data = JSON.parse(fs.readFileSync(p, "utf8")); res({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { res({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      }, DELAI));
    } });
  return dom.window;
}
const pieces = d => d.querySelectorAll("#board .piece").length;
const texte = (d, id) => (d.getElementById(id) || {}).textContent || "";

(async () => {
  for (const [carte, nom] of [["cardSolvePuzzles", "Exercices"], ["cardSolveDaily", "Exercice du jour"]]) {
    console.log("\n--- Resoudre > " + nom + " ---");
    const w = ouvrir(); await attendre(1200);
    const d = w.document;
    d.getElementById("tab-play").click(); await attendre(300);
    /* Le plateau partage montre une position (celle de la partie) avant
       l'ouverture de Resoudre : c'est elle qui restait affichee. */
    T("le plateau porte des pieces avant l'ouverture", pieces(d) > 0, pieces(d));
    const statutJouer = texte(d, "status");
    d.getElementById("tab-puzzles").click(); await attendre(200);
    d.getElementById(carte).click(); await attendre(300);

    console.log("  (pendant le chargement)");
    T("plateau vide, plus l'ancienne position", pieces(d) === 0, pieces(d) + " pieces");
    T("pas d'etiquette de motif perimee", !/Mat du couloir|Back-rank mate/.test(texte(d, "exTheme")), texte(d, "exTheme"));
    T("etiquette neutre", texte(d, "exTheme") === "…", JSON.stringify(texte(d, "exTheme")));
    T("consigne en attente", texte(d, "exQuest") === "Chargement…", texte(d, "exQuest"));
    T("statut du panneau : chargement des exercices", /Chargement des\s+exercices/.test(texte(d, "exStatus")), texte(d, "exStatus"));
    T("pas de code d'exercice perime", texte(d, "exCode") === "", texte(d, "exCode"));
    T("le statut de l'onglet Jouer n'est pas touche", texte(d, "status") === statutJouer, texte(d, "status"));

    await attendre(DELAI * 4);
    console.log("  (une fois charge)");
    T("un exercice est pose sur le plateau", pieces(d) > 1, pieces(d) + " pieces");
    T("une vraie etiquette de motif", texte(d, "exTheme").length > 2 && texte(d, "exTheme") !== "…", texte(d, "exTheme"));
    T("une vraie consigne", /jouer|Trait|joue/i.test(texte(d, "exQuest")) && texte(d, "exQuest") !== "Chargement…", texte(d, "exQuest"));
    w.close();
  }
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
