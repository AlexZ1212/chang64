/* Verification de la vignette de l'exercice du jour (2026-11-14).
   Lancement : node tests/check_vignette.js (apres node build_site.js)

   La vignette (vignette_build.js) s'integre dans un cadre sur d'autres sites :
   elle doit dessiner l'exercice du jour, ouvrir le bon exercice sur chang64,
   etre autorisee dans un cadre et rester hors de l'index. La page enseignants
   et clubs donne le code a copier dans chaque langue. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { LANGUES, PAR_CODE } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lire = f => fs.readFileSync(path.join(SITE, f), "utf8");

function servir(w) {
  w.fetch = u => {
    const p = path.join(SITE, String(u).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
    return fs.existsSync(p)
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))) })
      : Promise.resolve({ ok: false, status: 404 });
  };
}
async function vignette(query) {
  const html = lire("vignette/index.html");
  const js = lire("vignette/vignette.js");
  const dom = new JSDOM(html.replace('<script src="vignette.js"></script>', ""), {
    runScripts: "outside-only", url: "https://chang64.com/vignette/" + query, virtualConsole: new VirtualConsole() });
  servir(dom.window);
  dom.window.eval(js);
  await attendre(200);
  return dom.window;
}

(async () => {
  console.log("\n--- Fichiers ---");
  const html = lire("vignette/index.html");
  T("page et script generes", fs.existsSync(path.join(SITE, "vignette/vignette.js")));
  T("aucun script en ligne (CSP script-src 'self')", !/<script>(?!\s*<\/script>)/.test(html) && /<script src="vignette.js"><\/script>/.test(html));
  T("pas de mesure d'audience dans la vignette", !/cloudflareinsights|beacon/.test(html + lire("vignette/vignette.js")));
  T("noindex dans la page", /<meta name="robots" content="noindex">/.test(html));

  console.log("\n--- En-tetes ---");
  const h = lire("_headers");
  const bloc = (h.split(/\n(?=\/)/).find(b => b.startsWith("/vignette/*")) || "");
  T("bloc /vignette/* present", !!bloc);
  T("X-Frame-Options du bloc general retire", /^\s*! X-Frame-Options$/m.test(bloc));
  T("CSP du bloc general retiree puis remplacee", /^\s*! Content-Security-Policy$/m.test(bloc) && /frame-ancestors \*/.test(bloc));
  T("script-src limite au site", /script-src 'self';/.test(bloc));
  T("hors de l'index (X-Robots-Tag)", /X-Robots-Tag: noindex/.test(bloc));

  console.log("\n--- Rendu ---");
  const fr = await vignette("?lang=fr");
  const $ = id => fr.document.getElementById(id);
  T("64 cases dessinees", fr.document.querySelectorAll("#plateau rect").length === 64);
  T("des pieces sur l'echiquier", fr.document.querySelectorAll("#plateau use").length > 2);
  T("titre en francais", $("titre").textContent === "Exercice du jour", $("titre").textContent);
  T("bouton en francais", $("bouton").textContent === "Résoudre", $("bouton").textContent);
  T("consigne en francais", /^Les (Blancs|Noirs) jouent/.test($("consigne").textContent), $("consigne").textContent);
  T("lien vers l'exercice du jour en francais", $("lien").href === "https://chang64.com/fr/#daily", $("lien").href);
  T("ouvre un nouvel onglet", $("lien").target === "_blank" && /noopener/.test($("lien").rel));
  T("langue de la page", fr.document.documentElement.lang === "fr");

  const inconnu = await vignette("?lang=xx");
  T("langue inconnue : anglais", inconnu.document.getElementById("titre").textContent === "Puzzle of the day" && inconnu.document.getElementById("lien").href === "https://chang64.com/#daily");
  const ru = await vignette("?lang=ru");
  T("russe : pluriels lus", /^(Белые|Чёрные) начинают/.test(ru.document.getElementById("consigne").textContent), ru.document.getElementById("consigne").textContent);

  /* Meme exercice que le site : la regle de jour.json, a la date du jour. */
  const jour = JSON.parse(lire("data/jour.json"));
  const d = new Date(), n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const id = jour.ids[(((n - jour.debut) % jour.ids.length) + jour.ids.length) % jour.ids.length];
  const idx = JSON.parse(lire("data/ids/" + Math.floor(+id.slice(1) / 10000) + ".json"))[id];
  const p = JSON.parse(lire("data/level-" + idx[0] + "-" + idx[1] + ".json")).find(x => x.id === id);
  const noirs = p.fen.split(" ")[1] === "b";
  T("camp au trait conforme a l'exercice du jour (" + id + ")", fr.document.getElementById("consigne").textContent.startsWith(noirs ? "Les Noirs" : "Les Blancs"));

  console.log("\n--- Page enseignants et clubs ---");
  for (const l of LANGUES) {
    const dir = l.dirs.learn;
    const fichier = fs.readdirSync(path.join(SITE, dir)).map(f => path.join(dir, f))
      .find(f => lire(f).includes("/vignette/?lang=" + l.code + "\""));
    const page = fichier ? lire(fichier) : "";
    T(l.code + " : apercu et code a copier", !!fichier && (page.match(/vignette\/\?lang=/g) || []).length === 2);
    T(l.code + " : lien texte vers l'accueil de la langue", page.includes("&lt;a href=&quot;https://chang64.com" + PAR_CODE[l.code].accueil + "&quot;&gt;"));
  }

  console.log("\n--- Lien #daily dans l'application ---");
  const w = await ouvrir("fr", { fetch: true, attente: 2500, avant(x) { x.location.hash = "#daily"; } });
  T("#daily ouvre l'onglet Resoudre", w.eval("mode") === "puzzles", w.eval("mode"));
  T("#daily charge l'exercice du jour", w.eval("typeof puzzle!=='undefined'&&puzzle&&puzzle.daily===true"));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
