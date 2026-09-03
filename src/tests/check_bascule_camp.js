/* Verifie le bouton bascule Blancs/Noirs/Les deux, sur les pages d'index
   des Ouvertures et des Exercices. */
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
const fs = require("fs"), jd = require("jsdom");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n) } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")) } };

function chargePage(fichier) {
  const html = fs.readFileSync(path.join(SITE, fichier), "utf8");
  return new Promise(resolve => {
    const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole() });
    setTimeout(() => resolve(dom.window), 400);
  });
}

(async () => {
  console.log("\n--- Ouvertures : le bouton bascule filtre correctement ---");
  {
    const w = await chargePage("openings/index.html");
    const d = w.document;
    const toutes = d.querySelectorAll("#grille a.tile").length;
    T("141 familles chargees", toutes === 141, toutes);
    const bt = txt => [...d.querySelectorAll("#coteFiltre button")].find(b => b.textContent.trim() === txt);
    T("les trois boutons existent", !!bt("All") && !!bt("White") && !!bt("Black"));
    T("Toutes est actif par defaut", bt("All").getAttribute("aria-pressed") === "true");

    bt("White").click();
    const visiblesBlancs = [...d.querySelectorAll("#grille a.tile:not([hidden])")];
    T("White est actif apres le clic", bt("White").getAttribute("aria-pressed") === "true");
    T("Toutes n'est plus actif", bt("All").getAttribute("aria-pressed") === "false");
    T("uniquement du blanc ou du mixte visible",
      visiblesBlancs.every(t => t.dataset.side === "w" || t.dataset.side === "both"),
      visiblesBlancs.filter(t => t.dataset.side === "b").length + " noire(s) visible(s) a tort");
    T("Four Knights Game (symetrique) reste visible cote Blancs",
      visiblesBlancs.some(t => t.textContent.includes("Four Knights Game")));

    bt("Black").click();
    const visiblesNoirs = [...d.querySelectorAll("#grille a.tile:not([hidden])")];
    T("uniquement du noir ou du mixte visible",
      visiblesNoirs.every(t => t.dataset.side === "b" || t.dataset.side === "both"),
      visiblesNoirs.filter(t => t.dataset.side === "w").length + " blanche(s) visible(s) a tort");
    T("Four Knights Game reste aussi visible cote Noirs",
      visiblesNoirs.some(t => t.textContent.includes("Four Knights Game")));
    T("les deux camps additionnes plus le symetrique retombent sur le total",
      visiblesBlancs.length + visiblesNoirs.length - 1 === toutes,
      visiblesBlancs.length + " + " + visiblesNoirs.length + " - 1 != " + toutes);

    /* Combine avec la recherche texte : les deux filtres doivent s'appliquer ensemble. */
    const champ = d.getElementById("filtre");
    champ.value = "gambit";
    champ.dispatchEvent(new w.Event("input"));
    const combine = [...d.querySelectorAll("#grille a.tile:not([hidden])")];
    T("la recherche texte se combine avec le camp (Noirs + gambit)",
      combine.length > 0 && combine.every(t => (t.dataset.side === "b" || t.dataset.side === "both") && /gambit/i.test(t.getAttribute("data-cle"))),
      combine.length + " resultat(s)");

    bt("All").click();
    champ.value = ""; champ.dispatchEvent(new w.Event("input"));
    T("retour a Toutes : les 141 familles reapparaissent",
      d.querySelectorAll("#grille a.tile:not([hidden])").length === 141);
  }

  /* Le bloc "Exercices : le meme bouton, sur le trait reel de la position"
     a ete retire (session du 2026-09-02) : il testait /puzzles/index.html
     comme une liste filtrable de 1000 exercices individuels (#grille,
     #coteFiltre). Cette page a depuis ete remplacee par 13 pages de theme
     avec 3 exemples travailles chacune -- plus de liste filtrable par
     camp sur cette page, la fonctionnalite testee n'existe plus. Le bloc
     "Ouvertures" ci-dessus reste, lui, entierement valide et verifie
     toujours le meme bouton bascule sur /openings/index.html. */

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
