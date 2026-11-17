/* Verification automatique de chang64.
   Lancement : node tests/check_finales_animees.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Demonstrations animees des cinq finales (2026-11-17, demande d'Alexandre) :
   chaque page de finale rejoue une partie modele avec le lecteur des pages
   d'ouvertures. Les lignes sont ecrites dans content.js (ENDS[].demo) ; une
   faute de frappe les rendrait injouables. Verifie, avec le vrai moteur :
     - chaque ligne est legale depuis sa position de depart ;
     - les quatre mats finissent bien par un mat, sans depasser 50 coups ;
       roi et pion finit par la promotion, depuis une position gagnante ;
     - chaque page, en anglais et en francais, porte le lecteur avec autant
       de positions que de demi-coups plus une, ses commandes et sa legende ;
     - la derniere etiquette porte le signe du mat (ou de la promotion). */
const fs = require("fs"), path = require("path");
const { Game } = require(path.join(__dirname, "..", "engine.js"));
const SITE = path.join(__dirname, "..", "site");
const src = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };

const finales = [...src.matchAll(/\{ id: "(\w+)", demo: "([^"]+)"(?:, demoFen: "([^"]+)")?, slug: \{ en: "([^"]+)", fr: "([^"]+)" \}, fen: "([^"]+)"/g)]
  .map(m => ({ id: m[1], demo: m[2].split(" "), depart: m[3] || m[6], en: m[4], fr: m[5] }));
T("les cinq finales ont une demonstration", finales.map(f => f.id).join() === "kq,kr,krr,kbn,kp", finales.map(f => f.id).join());

for (const f of finales) {
  const g = new Game(f.depart);
  let legal = true, dernier = "";
  for (const san of f.demo) {
    const m = g.moves().find(x => g.san(x).replace(/[+#]/g, "") === san);
    if (!m) { legal = false; dernier = san; break; }
    dernier = g.san(m);
    g.makeMove(m);
  }
  T(f.id + " : " + f.demo.length + " demi-coups, tous legaux", legal, "coup refuse : " + dernier);
  if (f.id === "kp") T("kp : la demonstration finit par la promotion en dame", /=Q/.test(dernier), dernier);
  else {
    T(f.id + " : la demonstration finit par le mat", legal && g.moves().length === 0 && g.inCheck(), dernier);
    T(f.id + " : sous la regle des cinquante coups", f.demo.length <= 100, String(f.demo.length));
  }
  for (const [lang, fichier] of [["en", "endgames/" + f.en + ".html"], ["fr", "fr/finales/" + f.fr + ".html"]]) {
    const html = fs.readFileSync(path.join(SITE, fichier), "utf8");
    const m = html.match(/class="anim" data-plies='(\[[^\]]*\])'/);
    const etiquettes = m ? JSON.parse(m[1].replace(/&#39;/g, "'")) : [];
    const groupes = (html.match(/<g data-ply="\d+"/g) || []).length;
    T(f.id + " (" + lang + ") : le lecteur porte " + (f.demo.length + 1) + " positions", etiquettes.length === f.demo.length + 1 && groupes === f.demo.length + 1, etiquettes.length + " / " + groupes);
    T(f.id + " (" + lang + ") : commandes, legende, et derniere etiquette signee", /class="animctl"/.test(html) && /data-act="play"/.test(html) &&
      (lang === "fr" ? /rejouent une partie modèle/.test(html) : /replay a model game/.test(html)) && (f.id === "kp" ? /=Q/.test(etiquettes[etiquettes.length - 1]) : /#$/.test(etiquettes[etiquettes.length - 1])), etiquettes[etiquettes.length - 1]);
  }
}
const kp = finales.find(f => f.id === "kp");
T("roi et pion : les Noirs commencent, la premiere etiquette le dit", kp && /^1…/.test(JSON.parse(fs.readFileSync(path.join(SITE, "endgames", kp.en + ".html"), "utf8").match(/data-plies='(\[[^\]]*\])'/)[1].replace(/&#39;/g, "'"))[1]));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
