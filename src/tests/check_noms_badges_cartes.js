/* Verification automatique de chang64.
   Lancement : node tests/check_noms_badges_cartes.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Le nom d'un badge reste dans sa carte (2026-11-23). A 360 px, une carte de
   la collection fait 95 px : cinq noms d'un seul mot, en allemand et en
   russe, en sortaient (mesure_badges_apprendre.js, dans un vrai navigateur).
   - une regle de style empeche tout nom de sortir de sa carte ;
   - ces cinq noms portent des traits d'union conditionnels (U+00AD, invisibles
     tant que le mot n'est pas coupe), ecrits ­ dans les fichiers ;
   - un trait d'union conditionnel ne se glisse jamais ailleurs que dans un mot.
   jsdom ne met rien en page : la largeur elle-meme se mesure avec
   mesure_badges_apprendre.js, qui echoue des qu'un nom depasse. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
const { CODES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const SHY = "­";
const COUPES = { de: { theme_pin_100: "Schmetterlingssammlung", sprint_30: "Lichtgeschwindigkeit" },
  ru: { rating_2000: "Гипермодернист", ouv_5: "Любознательный", fete_0720: "Международный день шахмат" } };

(async () => {
  console.log("--- La regle de style ---");
  for (const l of CODES) {
    const html = fs.readFileSync(path.join(SITE, l === "en" ? "" : l, "index.html"), "utf8");
    const r = html.match(/\.bx-carte \.bx-nom\{([^}]*)\}/);
    T(l + " : le nom d'un badge ne peut pas sortir de sa carte", !!r && /overflow-wrap:anywhere/.test(r[1]) && /max-width:100%/.test(r[1]), r ? r[1] : "regle absente");
  }

  console.log("--- Les traits d'union conditionnels ---");
  const textes = {};
  for (const l of CODES) textes[l] = JSON.parse(fs.readFileSync(path.join(SITE, "data", "badges-" + l + ".json"), "utf8"));
  for (const l of Object.keys(COUPES)) for (const id of Object.keys(COUPES[l])) {
    const nom = textes[l][id][0];
    T(l + " " + id + " : le nom porte ses coupures, et se lit comme avant sans elles", nom.includes(SHY) && nom.split(SHY).join("") === COUPES[l][id], JSON.stringify(nom));
    T(l + " " + id + " : aucun morceau de plus de 9 lettres", nom.split(/[\s­]+/).every(m => m.length <= 9), nom.split(/[\s­]+/).join("|"));
  }
  for (const l of CODES) {
    const t = textes[l], faux = [];
    for (const id of Object.keys(t)) {
      if (id === "_ui") continue;
      const nom = t[id][0];
      /* Toujours entre deux lettres : jamais au bord d'un mot, jamais double. */
      if (nom.includes(SHY) && !nom.split(SHY).every((m, i, a) => /[\p{L}]$/u.test(m) || i === a.length - 1) ) faux.push(id);
      if (nom.includes(SHY) && !nom.split(SHY).every((m, i) => i === 0 || /^[\p{L}]/u.test(m))) faux.push(id);
      /* Jamais dans une condition ni une anecdote : la, les lignes sont larges. */
      if ((t[id][1] + t[id][2]).includes(SHY)) faux.push(id);
    }
    T(l + " : un trait d'union conditionnel est toujours entre deux lettres d'un nom, et seulement la", !faux.length, [...new Set(faux)].join());
  }
  for (const l of Object.keys(COUPES)) {
    const brut = fs.readFileSync(path.join(__dirname, "..", "badges-textes", l + ".json"), "utf8");
    T(l + " : dans le fichier, il est ecrit \\u00ad (visible a la relecture), jamais tel quel", !brut.includes(SHY) && brut.includes("\\u00ad"));
  }

  console.log("--- Dans la page ---");
  for (const l of Object.keys(COUPES)) {
    const w = await ouvrir(l, { fetch: true, attente: 1800, avant(x) { x.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 })); } });
    await w.eval("bxCharger()");
    w.eval("menuOuvrir();menuVue('badges')");
    await new Promise(r => setTimeout(r, 500));
    for (const id of Object.keys(COUPES[l])) {
      const c = w.document.querySelector('#menuBadgeGrid [data-bx="' + id + '"] .bx-nom');
      T(l + " " + id + " : la carte affiche le nom avec ses coupures possibles", !!c && c.textContent.includes(SHY) && c.textContent.split(SHY).join("") === COUPES[l][id], c && JSON.stringify(c.textContent));
    }
    w.eval("bxFiche(" + JSON.stringify(Object.keys(COUPES[l])[0]) + ")");
    const titre = w.document.getElementById("bravoTitre").textContent;
    T(l + " : la fiche du badge porte le meme nom", titre.split(SHY).join("") === Object.values(COUPES[l])[0], JSON.stringify(titre));
    w.close();
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
