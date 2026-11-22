/* Verification automatique de chang64.
   Lancement : node tests/check_finales_articles.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Finales de Resoudre (2026-11-22, demande d'Alexandre) : chaque finale porte
   un lien vers son article, dans la langue de la page, au meme aspect que le
   renvoi vers l'ouverture sous l'echiquier de Jouer. Les adresses viennent de
   la construction du site (PAGE_LANGUE.finales) : chacune doit exister. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { LANGUES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const SITE = path.join(__dirname, "..", "site");
const net = x => String(x).replace(/\s+/g, " ").trim();
const IDS = ["kq", "kr", "krr", "kbn", "kp"];

(async () => {
  console.log("--- Les adresses, dans les dix langues ---");
  for (const l of LANGUES) {
    const page = fs.readFileSync(path.join(SITE, l.accueil, "index.html"), "utf8");
    const m = /<script[^>]*id="langue"[^>]*>([\s\S]*?)<\/script>/.exec(page);
    let f = null; try { f = JSON.parse(m[1]).finales; } catch (e) {}
    const manque = !f ? ["bloc de langue illisible"] : IDS.filter(id => !f[id] || !f[id].startsWith("/" + l.dirs.endgames + "/") || !fs.existsSync(path.join(SITE, f[id] + ".html")));
    T(l.code + " : les cinq articles existent, dans la rubrique des finales de la langue", manque.length === 0, manque.join(", "));
    if (f) {
      const art = fs.readFileSync(path.join(SITE, f.kq + ".html"), "utf8");
      T(l.code + " : l'article de la dame ramene bien a l'entrainement de cette finale", /#train=kq"/.test(art));
    }
  }

  console.log("--- Dans l'application ---");
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  const attendus = { kq: "/fr/finales/dame-contre-roi", kr: "/fr/finales/tour-contre-roi", krr: "/fr/finales/deux-tours-contre-roi", kbn: "/fr/finales/mat-fou-et-cavalier", kp: "/fr/finales/roi-et-pion-contre-roi" };
  for (const id of IDS) {
    w.eval("setMode('train');startEndgame('" + id + "')"); await attendre(120);
    const a = d.querySelector("#egArticle a");
    T(id + " : un lien vers l'article, sous le descriptif", !!a && a.getAttribute("href") === attendus[id] && net(a.textContent) === "Lire l'article sur cette finale" && $("egArticle").previousElementSibling === $("egBrief"), a && a.getAttribute("href"));
  }
  T("le lien a l'aspect du renvoi vers l'ouverture (classe .opening)", $("egArticle").classList.contains("opening") && $("opening").classList.contains("opening"));
  T("un seul lien a la fois : celui de la finale choisie", d.querySelectorAll("#egArticle a").length === 1);
  w.close();

  const en = await ouvrir("en", { attente: 2200 });
  en.eval("setMode('train');startEndgame('kbn')"); await attendre(120);
  const a = en.document.querySelector("#egArticle a");
  T("en anglais : le lien mene a l'article anglais", !!a && a.getAttribute("href") === "/endgames/bishop-and-knight-mate" && net(a.textContent) === "Read the article on this endgame", a && a.getAttribute("href"));
  en.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
