/* Verification automatique de chang64.
   Lancement : node tests/check_recherche_membre.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Recherche de membre (2026-11-22, demande d'Alexandre : « n'oublie pas le
   moteur de recherche pour chercher un membre », « applique-le ailleurs, ou
   la recherche par membre existe »). Trois endroits ou l'on cherche un
   membre : inviter a une partie (Contre un ami), envoyer un duel d'exercices
   a un membre, « Chercher un membre » dans Meilleurs joueurs. Partout, des
   deux premieres lettres, les pseudos trouves s'affichent sous le champ, a
   l'ecran (plus de liste native, invisible sur certains navigateurs). */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));

(async () => {
  const w = await ouvrir("fr", { attente: 2400, avant: MEMBRE });
  const d = w.document, $ = id => d.getElementById(id);
  const saisir = async (champ, texte) => { champ.value = texte; champ.dispatchEvent(new w.Event("input", { bubbles: true })); await attendre(500); };
  w.eval("window.__q=[];cpApi=async(m,r)=>{if(/^membres\\?q=/.test(r)){window.__q.push(decodeURIComponent(r.slice(10)));return {s:200,j:{membres:['Lea','Leandre','Leo64']}};}return {s:404,j:{}};}");

  console.log("--- Envoyer un duel d'exercices a un membre ---");
  w.eval("duelVueCree(['p1','p2','p3','p4','p5'],{n:'Moi',r:'22120',t:64})");
  await attendre(200);
  const champ = $("duelMembre");
  T("la fenetre du duel propose « Ou l'envoyer a un membre »", !!champ && !!$("duelTrouves") && $("duelTrouves").dataset.pour === "duelMembre");
  if (champ) {
    await saisir(champ, "Le");
    T("deux lettres : les membres trouves s'affichent en pastilles sous le champ", [...$("duelTrouves").querySelectorAll("button.chip")].map(b => b.textContent).join("|") === "Lea|Leandre|Leo64" && w.__q.join() === "Le", $("duelTrouves").innerHTML.slice(0, 100));
    T("plus de liste native cachee", !d.querySelector("datalist") && !champ.getAttribute("list"));
    $("duelTrouves").querySelectorAll("button")[2].click();
    T("un appui remplit le champ et referme la liste", champ.value === "Leo64" && $("duelTrouves").children.length === 0);
    T("le bouton d'envoi est toujours la", !!d.querySelector("#duelContenu [data-duel-membre]"));
  }
  w.eval("duelFermer()");

  console.log("--- Inviter a une partie ---");
  w.eval("setMode('friend');amiModeRegler('direct')"); await attendre(200);
  await saisir($("directPseudo"), "Le");
  T("meme recherche sous le champ « Adversaire »", [...$("directTrouves").querySelectorAll("button.chip")].map(b => b.textContent).join("|") === "Lea|Leandre|Leo64" && $("directTrouves").dataset.pour === "directPseudo");
  $("directTrouves").querySelectorAll("button")[0].click();
  T("un appui remplit le champ", $("directPseudo").value === "Lea" && $("directTrouves").children.length === 0);
  w.eval("cpApi=async()=>({s:200,j:{membres:['Lea']}})");
  await saisir($("directPseudo"), "Lea");
  T("le pseudo tape en entier, seul resultat : rien a proposer de plus", $("directTrouves").children.length === 0);

  console.log("--- Meilleurs joueurs ---");
  w.eval("cpApi=async(m,r)=>/^membres/.test(r)?{s:200,j:{membres:['Lea','Leandre']}}:{s:404,j:{}}");
  const page = fs.readFileSync(path.join(__dirname, "..", "site", "fr", "index.html"), "utf8");
  T("« Chercher un membre » affiche deja ses resultats a l'ecran (liste cpjTrouves)", /cpjCherche/.test(page) && /cpjTrouves/.test(page) && /cpj-joueur/.test(page));
  T("une seule facon de chercher : la meme fonction pour les trois champs", (page.match(/membres\?q=/g) || []).length === 1);
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
