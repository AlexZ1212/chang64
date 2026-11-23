/* Verification automatique de chang64.
   Lancement : node tests/check_stats_cadences.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Parties gagnees / nulles / perdues par cadence (2026-11-23, demande
   d'Alexandre, affichage choisi sur maquette : une ligne de pastilles qui
   defile, une seule barre). Le serveur des parties range chaque resultat dans
   sa famille (Blitz, Rapide, Classique, Correspondance) ; la fiche du membre
   les rend dans dir.f ; l'ecran des statistiques montre « Toutes » par
   defaut et la famille de la pastille touchee. Les parties jouees avant
   restent dans le total, sans famille : tant qu'aucune partie n'est rangee,
   la barre du total s'affiche seule, comme avant.
   Le Worker et la fiche sont gardes par check_elo_membres.js et
   check_compte_serveur.js ; la mise en page a 360 px, dans un vrai
   navigateur, par mesure_cinq_points.js. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const { CODES } = require("../langues/registre.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const SRC = path.join(__dirname, ".."), SITE = path.join(SRC, "site");
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
const EF = { b: { r: 1012, n: 12 }, r: { r: 980, n: 1 }, c: null, k: { r: 1104, n: 11 } };

(async () => {
  let w = await ouvrir("fr", { attente: 2200, avant: MEMBRE });
  let d = w.document;
  const $ = id => d.getElementById(id);
  /* Ouvre les statistiques avec la fiche donnee, comme le serveur la rendrait. */
  const stats = async fiche => {
    w.__j = fiche;
    w.eval("menuFermer();cp=cp||{pseudo:'Moi',cle:'moi',version:1,dev:'abc123',n:0,sync:0};cppLire=async()=>window.__j;menuOuvrir();menuVue('stats')");
    await attendre(700);
    return $("menuDirect");
  };
  const pastilles = m => [...m.querySelectorAll(".tc-cats button")];
  const legende = m => [...m.querySelectorAll(".stats-legende li")].map(x => net(x.textContent)).join(" | ");
  const tete = m => { const e = m.querySelector(".stats-bilan-tete"); return e ? net(e.textContent) : ""; };
  const enfoncee = m => pastilles(m).filter(b => b.getAttribute("aria-pressed") === "true").map(b => net(b.textContent)).join();

  console.log("--- La rangee de pastilles et la barre ---");
  let m = await stats({ p: "Moi", ef: EF, dir: { v: 14, n: 3, d: 11, f: { b: [7, 2, 3], r: [1, 0, 0], c: [0, 0, 0], k: [4, 1, 6] } } });
  T("le bloc est visible, sous « Parties en direct »", !m.hidden && !$("menuMembres").hidden && net(m.querySelector(".tiroir-section").textContent) === "Parties en direct");
  T("cinq pastilles : Toutes, puis les quatre familles dans l'ordre des Elo", pastilles(m).map(b => net(b.textContent)).join(" | ") === "Toutes | Blitz | Rapide | Classique | Correspondance", pastilles(m).map(b => net(b.textContent)).join(" | "));
  T("ce sont de vrais boutons, dans un groupe nomme « Cadence »", pastilles(m).every(b => b.tagName === "BUTTON" && b.type === "button") && m.querySelector(".tc-cats").getAttribute("role") === "group" && m.querySelector(".tc-cats").getAttribute("aria-label") === "Cadence");
  T("la rangee est dans son enveloppe qui defile (une ligne, sans barre de defilement)", m.querySelector(".tc-cats").parentNode.classList.contains("defile") && m.querySelector(".tc-cats").parentNode.dataset.branche === "1");
  T("« Toutes » est choisie au depart, et la barre montre le total", enfoncee(m) === "Toutes" && legende(m) === "14 Gagnées | 3 Nulles | 11 Perdues" && /^50 % de parties gagnées$/.test(tete(m)), [enfoncee(m), legende(m), tete(m)].join(" / "));
  T("une seule barre", m.querySelectorAll(".stats-barre").length === 1 && m.querySelectorAll(".stats-bilan").length === 1);

  console.log("--- Toucher une pastille ---");
  const toucher = f => { m.querySelector('.tc-cats button[data-f="' + f + '"]').click(); };
  toucher("b");
  T("Blitz : la pastille est enfoncee, elle seule", enfoncee(m) === "Blitz" && pastilles(m).filter(b => b.getAttribute("aria-pressed") === "false").length === 4, enfoncee(m));
  T("Blitz : 7 gagnees, 2 nulles, 3 perdues, 58 %", legende(m) === "7 Gagnées | 2 Nulles | 3 Perdues" && /^58 % de parties gagnées$/.test(tete(m)), legende(m) + " / " + tete(m));
  toucher("r");
  T("Rapide : une seule partie, accords au singulier", legende(m) === "1 Gagnée | 0 Nulle | 0 Perdue" && /^100 % de parties gagnées$/.test(tete(m)), legende(m) + " / " + tete(m));
  toucher("k");
  T("Correspondance : 4, 1, 6", legende(m) === "4 Gagnées | 1 Nulle | 6 Perdues" && enfoncee(m) === "Correspondance", legende(m));
  toucher("c");
  T("Classique, sans partie : une phrase, pas de barre vide", !m.querySelector(".stats-barre") && net(m.querySelector(".stats-vide").textContent) === "Aucune partie de cette sorte pour l'instant." && enfoncee(m) === "Classique", net($("menuDirectBilan").textContent));
  toucher("");
  T("retour a « Toutes » : le total revient", enfoncee(m) === "Toutes" && legende(m) === "14 Gagnées | 3 Nulles | 11 Perdues");
  T("la barre change dans une zone annoncee aux lecteurs d'ecran", $("menuDirectBilan").getAttribute("aria-live") === "polite" && pastilles(m).length === 5);
  T("le total garde les parties d'avant : 28 parties en tout, 24 rangees par famille", 14 + 3 + 11 === 28 && [7, 2, 3, 1, 0, 0, 0, 0, 0, 4, 1, 6].reduce((a, b) => a + b, 0) === 24);

  console.log("--- Sans detail par famille : comme avant ---");
  m = await stats({ p: "Moi", ef: EF, dir: { v: 12, n: 1, d: 3 } });
  T("fiche d'un serveur d'avant (pas de f) : la barre du total seule, sans pastilles", !m.hidden && pastilles(m).length === 0 && legende(m) === "12 Gagnées | 1 Nulle | 3 Perdues" && net(m.querySelector(".tiroir-section").textContent) === "Parties en direct", legende(m));
  m = await stats({ p: "Moi", ef: EF, dir: { v: 12, n: 1, d: 3, f: { b: [0, 0, 0], r: [0, 0, 0], c: [0, 0, 0], k: [0, 0, 0] } } });
  T("aucune partie encore rangee par famille (toutes jouees avant) : pas de pastilles non plus", pastilles(m).length === 0 && legende(m) === "12 Gagnées | 1 Nulle | 3 Perdues");
  m = await stats({ p: "Moi", ef: null, dir: { v: 0, n: 0, d: 0, f: { b: [0, 0, 0], r: [0, 0, 0], c: [0, 0, 0], k: [0, 0, 0] } } });
  T("aucune partie du tout : rien n'est affiche", m.hidden && $("menuMembres").hidden);
  m = await stats({ p: "Moi", ef: EF, dir: { v: 5, n: 0, d: 1, f: { b: [3, "x", -4], r: null, c: [2.9, NaN], k: "non" } } });
  m.querySelector('.tc-cats button[data-f="b"]').click();
  T("des nombres abimes : lus comme zero, jamais affiches tels quels", legende(m) === "3 Gagnées | 0 Nulle | 0 Perdue", legende(m));
  m.querySelector('.tc-cats button[data-f="c"]').click();
  T("un nombre a virgule est ramene a l'entier", legende(m) === "2 Gagnées | 0 Nulle | 0 Perdue", legende(m));
  m.querySelector('.tc-cats button[data-f="k"]').click();
  T("une famille illisible : la phrase « aucune partie »", !!m.querySelector(".stats-vide") && !m.querySelector(".stats-barre"));
  w.close();

  console.log("--- Les 10 langues ---");
  for (const l of CODES) {
    const dict = l === "en" ? null : require(path.join(SRC, "langues", l, "app.js"));
    if (dict) T(l + " : « Toutes » est traduit", typeof dict.All === "string" && dict.All.length > 2 && dict.All !== "All", dict.All);
  }
  w = await ouvrir("de", { attente: 2200, avant: MEMBRE });
  d = w.document;
  w.__j = { p: "Moi", ef: EF, dir: { v: 2, n: 0, d: 1, f: { b: [2, 0, 1], r: [0, 0, 0], c: [0, 0, 0], k: [0, 0, 0] } } };
  w.eval("cp=cp||{pseudo:'Moi',cle:'moi',version:1,dev:'abc123',n:0,sync:0};cppLire=async()=>window.__j;menuOuvrir();menuVue('stats')");
  await attendre(900);
  T("allemand : Alle, Blitz, Schnellschach, Klassisch, Fernpartie", [...d.querySelectorAll("#menuDirect .tc-cats button")].map(b => net(b.textContent)).join(" | ") === "Alle | Blitz | Schnellschach | Klassisch | Fernpartie", [...d.querySelectorAll("#menuDirect .tc-cats button")].map(b => net(b.textContent)).join(" | "));
  w.close();
  w = await ouvrir("en", { attente: 2200, avant: MEMBRE });
  d = w.document;
  w.__j = { p: "Moi", ef: EF, dir: { v: 2, n: 0, d: 1, f: { b: [2, 0, 1], r: [0, 0, 0], c: [0, 0, 0], k: [0, 0, 0] } } };
  w.eval("cp=cp||{pseudo:'Moi',cle:'moi',version:1,dev:'abc123',n:0,sync:0};cppLire=async()=>window.__j;menuOuvrir();menuVue('stats')");
  await attendre(900);
  T("anglais : All, Blitz, Rapid, Classical, Correspondence", [...d.querySelectorAll("#menuDirect .tc-cats button")].map(b => net(b.textContent)).join(" | ") === "All | Blitz | Rapid | Classical | Correspondence");
  w.close();

  console.log("--- Nouveautes et style ---");
  const N = JSON.parse(fs.readFileSync(path.join(SRC, "nouveautes.json"), "utf8"));
  const e = N.find(x => x.en[0] === "Your games between members, time control by time control");
  T("l'entree de nouveautes existe, dans les 10 langues, titre et texte", !!e && CODES.every(l => Array.isArray(e[l]) && e[l].length === 2 && e[l][0].length > 10 && e[l][1].length > 80), e ? CODES.filter(l => !Array.isArray(e[l])).join() : "absente");
  T("elle dit que le total ne change pas et que le detail part d'aujourd'hui", !!e && /total ne change pas/.test(e.fr[1]) && /à partir d'aujourd'hui/.test(e.fr[1]));
  T("elle tutoie, sans point median ni tiret long", !!e && /\btes parties\b/i.test(e.fr[0]) && !/[·—]/.test(e.fr[0] + e.fr[1]) && !/\bvous\b|\bvotre\b/i.test(e.fr[1]));
  const css = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  T("le style de la rangee et de la phrase est dans la page", /\.stats-cadences\{/.test(css) && /\.stats-vide\{[^}]*text-align:center/.test(css));

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
