/* Verification automatique de chang64.
   Lancement : node tests/check_ecran_exercice.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Audit UX du 2026-10-24, mesure dans Chrome a six tailles d'ecran : sur
   l'ecran d'exercice, les boutons tombaient sous la ligne de flottaison
   (iPhone SE : 688-778 px pour 667 ; iPad : 1104-1198 pour 1024) et
   l'echiquier depassait le bas de l'ecran d'un portable 1366x768.
   Correctif : barre d'actions fixee en bas sur une colonne, echiquier borne
   par la hauteur visible (svh). jsdom ne calcule pas la mise en page : on
   garde ici la structure et les regles qui la portent. La mesure reelle se
   refait avec un navigateur (voir le handoff).
   Verifie : setMode pose data-mode ; les trois boutons sont dans la barre ;
   la barre porte les classes qui la masquent en Sprint et en revue ; les
   regles CSS existent et ne visent que l'ecran Resoudre. */
const path = require("path");
const fs = require("fs"), jd = require("jsdom");
const SITE = path.join(__dirname, "..", "site");
const html = fs.readFileSync(SITE + "/index.html", "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/",
    virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) {
      w.fetch = url => {
        const p = path.join(SITE, String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
        try { const data = JSON.parse(fs.readFileSync(p, "utf8")); return Promise.resolve({ ok: true, json: () => Promise.resolve(data) }); }
        catch (e) { return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(e) }); }
      };
    } });
  const w = dom.window, d = w.document;
  await attendre(1200);

  console.log("\n--- Structure ---");
  const barre = d.getElementById("exActions");
  T("la barre d'actions existe", !!barre);
  for (const id of ["btnNext", "btnHintEx", "btnRetry"]) T("#" + id + " est dans la barre", !!barre && barre.contains(d.getElementById(id)));
  T("la barre est dans le panneau d'exercice", !!barre && d.getElementById("exPanel").contains(barre));
  T("la barre disparait en Sprint et en revue (hors-sprint, review-hide)", !!barre && barre.classList.contains("hors-sprint") && barre.classList.contains("review-hide"));

  console.log("\n--- data-mode suit l'ecran ---");
  d.getElementById("tab-puzzles").click(); await attendre(300);
  d.getElementById("cardSolvePuzzles").click(); await attendre(2500);
  T("Resoudre : data-mode=puzzles", d.getElementById("appLayout").dataset.mode === "puzzles", d.getElementById("appLayout").dataset.mode);
  d.getElementById("tab-play").click(); await attendre(300);
  T("Jouer : data-mode=play", d.getElementById("appLayout").dataset.mode === "play", d.getElementById("appLayout").dataset.mode);

  console.log("\n--- Regles CSS ---");
  const css = [...d.querySelectorAll("style")].map(s => s.textContent).join("\n");
  const regle = re => re.test(css.replace(/\s+/g, " "));
  T("deux colonnes : plateau borne par la hauteur visible", regle(/@media ?\(min-width:861px\) ?\{ ?#appLayout\[data-mode="puzzles"\] \.board-frame\{[^}]*max-width:calc\(100svh - 200px\)/));
  T("une colonne : barre fixee en bas", regle(/#appLayout\[data-mode="puzzles"\] \.ex-actions\{position:fixed;[^}]*bottom:0/));
  T("une colonne : boutons d'au moins 44 px", regle(/#appLayout\[data-mode="puzzles"\] \.ex-actions \.btn\{[^}]*min-height:44px/));
  T("une colonne : marge de la zone protegee (encoche, barre iOS)", regle(/env\(safe-area-inset-bottom\)/));
  T("une colonne : place reservee sous le contenu", regle(/#appLayout\[data-mode="puzzles"\]\{padding-bottom:76px/));
  T("tablette : plateau borne par la hauteur", regle(/max-width:860px\) ?\{ ?#appLayout\[data-mode="puzzles"\] \.board-frame\{max-width:calc\(100(s)?vh - 440px\)/));
  T("svh toujours precede d'un repli en vh", !/[;{]max-width:(max\(260px,)?calc\(100svh/.test(css.replace(/max-width:(max\(260px,)?calc\(100vh[^;]*;max-width:(max\(260px,)?calc\(100svh/g, "")));
  T("la barre masquee en Sprint malgre sa specificite", regle(/\.rush-on \.ex-actions\.hors-sprint,\.reviewing-rush \.ex-actions\.review-hide\{display:none!important\}/));
  T("aucune regle de la barre hors de l'ecran Resoudre", !/(^|[},])\s*\.ex-actions\{/.test(css));

  w.close();
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.stack); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
