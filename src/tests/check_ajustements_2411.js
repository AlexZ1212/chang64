/* Verification automatique de chang64.
   Lancement : node tests/check_ajustements_2411.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Les ajustements demandes par Alexandre le 24/11/2026 (liste du 23/11),
   chacun avec sa garde. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/\s+/g, " ").trim();
const SRC = path.join(__dirname, "..");
const lire = f => fs.readFileSync(path.join(SRC, f), "utf8");

(async () => {
  const fr = require("../langues/fr/app.js");
  const w = await ouvrir("fr", { attente: 2200, fetch: true });
  const d = w.document, $ = id => d.getElementById(id), ev = x => w.eval(x);

  console.log("--- Contre l'ordinateur : titre et couleur au hasard ---");
  T("le reglage de partie a son titre, comme Contre un ami", net($("ordiTitre").textContent) === "Contre l'ordinateur" && net($("ordiSous").textContent).length > 20, $("ordiTitre").textContent);
  T("la couleur est « Au hasard » par defaut", ev("colorMode") === "r" && $("segColor").querySelector('[data-v="r"]').getAttribute("aria-pressed") === "true" && $("segColor").querySelector('[data-v="w"]').getAttribute("aria-pressed") === "false");

  console.log("--- Separateurs « | » au lieu de « · » ---");
  for (const [f, re] of [["ui2.js", /' · <span class="motif-fait">/], ["ui2.js", /' · <span class="badge-date">/], ["ui2.js", /" · "\+res\+" · "/], ["makruk.js", /genre\+" · "/]])
    T(f + " : plus de point median " + re.source.slice(0, 22), !re.test(lire(f)));
  ev("ensureProgFields();prog.themeSolved={'Knight fork':3};THEME_COUNTS={'Knight fork':900,'Pin':900};renderMotifsMenu()");
  const tuile = d.querySelector('#motifsGrid [data-motif="Knight fork"] .motif-compte');
  T("une tuile de motif : « 900 exercices | 3 résolus »", tuile && /exercices \| 3 r/.test(net(tuile.textContent)), tuile && tuile.textContent);

  console.log("--- Pourcentages ---");
  T("en francais, espace fine insecable avant « % »", ev("pourcentTexte(.62)") === "62 %", JSON.stringify(ev("pourcentTexte(.62)")));
  T("jamais l'espace insecable pleine", !/ %/.test(ev("pourcentTexte(.5)")));
  T("les statistiques s'en servent", /pourcentTexte\(v\/tot\)/.test(lire("menu.js")) && /pourcentTexte\(acc\/100\)/.test(lire("ui2.js")));
  console.log("--- Coches de reussite : la forme d'Apprendre partout ---");
  const page = fs.readFileSync(path.join(SRC, "site", "fr", "index.html"), "utf8");
  T("une coche commune : disque jade et meme masque que les etapes d'Apprendre", /\.ap-chap\.fait \.ap-num::after,\.coche-ok::after/.test(page) && /\.coche-ok\{background-color:var\(--jade\)\}/.test(page));
  ev("prog.dailyLog=prog.dailyLog||{};prog.days=12;");
  ev("try{const k=todayKey?todayKey():null;}catch(e){}");
  T("« Fait aujourd'hui » : la coche dessinee, plus de « ✓ » dans le texte", /symbolesHtml\(echapper\(t\(doneToday\?"Done today ✓/.test(lire("ui2.js")) && ev("symbolesHtml('Fait aujourd’hui ✓ | série')").includes('class="coche-ok"') && !ev("symbolesHtml('a ✓ b')").includes("✓"));
  T("defis de la semaine et bilan de seance : la meme coche", /s\.ok\[i\]\?cocheHtml\(\)/.test(lire("defis.js")) && /" "\+cocheHtml\(\)/.test(lire("bilan.js")));
  T("pastilles du sprint : rondes, coche ou croix dessinee", /\.rushHistory button\{\s*position:relative;flex:none;width:30px;height:30px;padding:0;border-radius:50%/.test(page) && /\.rushHistory button\.loss::after\{background-color:var\(--brick\)/.test(page.replace(/\.croix-ko::after,/, "")));
  T("copie reussie : le petit disque jade", /\.btn\.coche::after\{[^}]*border-radius:50%;background-color:var\(--jade\)/.test(page));

  console.log("--- Objectif du jour : petite annonce ---");
  /* finishPuzzle a besoin d'un vrai exercice : on lit la source, et les textes. */
  T("l'objectif atteint fait paraitre l'annonce « Objectif atteint ! », jade, avec sa coche", /bxMarquer\("obj_atteint"\);[\s\S]{0,400}objAnnoncer\("objectif",t\("Goal reached!"\)/.test(lire("objectif.js")) && lire("objectif.js").includes("OBJ_ICONES.objectif=") && page.includes(".obj-parfait,.obj-objectif{"));
  T("sa phrase en francais", fr["{n} puzzles solved today. Come back tomorrow to keep going."] === "{n} exercices résolus aujourd'hui. Reviens demain pour continuer.");

  console.log("--- Badges : un nom ne se coupe plus au milieu d'un mot ---");
  T("la taille d'un nom trop long baisse (bxNomsAjuster), sans changer les autres", /function bxNomsAjuster\(el\)/.test(lire("badges.js")) && /poserHtml\(el,h\);\n  bxNomsAjuster\(el\);/.test(lire("badges.js")));
  const de = require("../badges-textes/de.json");
  T("les noms allemands les plus longs ont leur trait d'union conditionnel", ["Seekadetten­matt", "Mitglieds­ausweis", "Heraus­forderung"].every(m => JSON.stringify(de).includes(JSON.stringify(m).slice(1, -1))));

  console.log("--- Inviter sur chang64 : le QR code du site ---");
  T("le QR code est dessine sous les boutons de partage, avec sa phrase", !!$("siteQr").querySelector("svg") && $("siteQr").getAttribute("role") === "img" && /QR code pour ouvrir chang64/.test($("siteQr").getAttribute("aria-label")) && /Montre ce code à un ami/.test(net($("siteQrNote").textContent)));
  T("meme forme que celui de « Ajouter un appareil » (.cp-qr)", $("siteQr").classList.contains("cp-qr"));
  w.close();
  const we = await ouvrir("en", { attente: 1500 });
  T("en anglais, pas d'espace : « 62% »", we.eval("pourcentTexte(.62)") === "62%", we.eval("pourcentTexte(.62)"));
  we.close();

  console.log("--- Correspondance : le texte dit la vraie regle du serveur ---");
  const worker = lire("worker-parties/index.js");
  T("le Worker annule avant le premier coup de chacun, et fait perdre ensuite", /if \(p\.phase === "debut"\) this\.finir\("", "annulee", now\)/.test(worker) && /p\.coups\.length >= 2\) p\.phase = "jeu"/.test(worker));
  T("le texte francais dit « perdue, ou annulée si l'un des deux n'a pas encore joué son premier coup »", /perdue, ou annulée si l'un des deux n'a pas encore joué son premier coup\./.test(fr["Each player has {n} days for every move. After that, the game is lost, or cancelled if one of you has not played a first move yet."] || ""));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); process.exit(1); });
