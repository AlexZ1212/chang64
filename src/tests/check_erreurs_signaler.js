/* Verification automatique de chang64.
   Lancement : node tests/check_erreurs_signaler.js
   Le site doit avoir ete construit au prealable : node build_site.js

   2026-11-24, choix d'Alexandre par QCM :
   1. « Erreurs a revoir » (bloc sous les exercices) : le nombre et « Revoir »,
      les motifs en pastilles « x n » (un nom ne se colle plus a son chiffre),
      une barre de maitrise en cinq cases, « N presque sues », et ce qui
      reviendra plus tard ;
   2. « Signaler cet exercice » : seulement une fois l'exercice fini, jamais
      pendant qu'on cherche ; quatre raisons ; n'envoie que le numero et la
      raison ; un merci ; retenu sur l'appareil ;
   3. la fonction serveur (functions/api/signaler.js) : un compteur par
      exercice, raison et jour, aucune donnee personnelle, envois invalides
      refuses, autre site refuse, au plus 2 000 lignes nouvelles par jour. */
const path = require("path");
const { pathToFileURL } = require("url");
const { ouvrir } = require("./outils/page_langue.js");
const { fausseD1 } = require("../serveur_local.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/\s+/g, " ").trim();

(async () => {
  console.log("--- La fonction serveur ---");
  const { onRequestPost } = await import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "signaler.js")).href);
  const env = { DB: fausseD1() };
  const envoi = (corps, origine) => onRequestPost({ env, request: new Request("https://chang64.com/api/signaler", {
    method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, origine ? { Origin: origine } : {}),
    body: typeof corps === "string" ? corps : JSON.stringify(corps) }) });
  const lignes = () => env.DB.brut.prepare("SELECT exo, raison, jour, n FROM signalements ORDER BY exo, raison").all();
  const jour = new Date().toISOString().slice(0, 10);
  T("un signalement valide : 204", (await envoi({ exo: "p5696", raison: "meilleur" }, "https://chang64.com")).status === 204);
  T("une ligne : l'exercice, la raison, le jour, n = 1", JSON.stringify(lignes()) === JSON.stringify([{ exo: "p5696", raison: "meilleur", jour, n: 1 }]), JSON.stringify(lignes()));
  await envoi({ exo: "p5696", raison: "meilleur" });
  T("le meme le meme jour : le compteur monte, pas de ligne de plus", lignes().length === 1 && lignes()[0].n === 2);
  await envoi({ exo: "p5696", raison: "solution" });
  T("une autre raison : une autre ligne", lignes().length === 2);
  T("aucune colonne d'identite dans la table", JSON.stringify(env.DB.brut.prepare("SELECT name FROM pragma_table_info('signalements') ORDER BY cid").all().map(x => x.name)) === '["exo","raison","jour","n"]');
  T("numero invalide : 400", (await envoi({ exo: "pj123", raison: "autre" })).status === 400);
  T("raison inconnue : 400", (await envoi({ exo: "p1", raison: "insulte" })).status === 400);
  T("pas du JSON : 400", (await envoi("{pas du json")).status === 400);
  T("envoi trop long : 413", (await envoi({ exo: "p1", raison: "autre", x: "y".repeat(300) })).status === 413);
  T("depuis un autre site : 403", (await envoi({ exo: "p1", raison: "autre" }, "https://exemple.org")).status === 403);
  const ins = env.DB.brut.prepare("INSERT INTO signalements (exo, raison, jour, n) VALUES (?, 'autre', ?, 1)");
  for (let i = 0; i < 2000; i++) ins.run("p9" + i, jour);
  T("plafond du jour atteint : un nouveau couple est refuse (429)", (await envoi({ exo: "p777", raison: "autre" })).status === 429);
  T("mais un couple deja la continue de compter", (await envoi({ exo: "p5696", raison: "meilleur" })).status === 204 && lignes().find(x => x.exo === "p5696" && x.raison === "meilleur").n === 3);
  T("sans base : 503", (await onRequestPost({ env: {}, request: new Request("https://chang64.com/api/signaler", { method: "POST", body: JSON.stringify({ exo: "p1", raison: "autre" }) }) })).status === 503);

  console.log("--- Le bloc « Erreurs a revoir » ---");
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), ev = s => w.eval(s), cache = id => $(id).classList.contains("hide");
  ev("setMode('puzzles',{screen:'puzzles'})"); await pause(1500);
  ev("ensureProgFields();prog.mistakeQueue=[];renderMistakeQueue()");
  T("file vide : le bloc est cache", cache("mistakeSection"));
  ev(`(function(){const now=Date.now(),J=864e5;prog.mistakeQueue=[
    {id:'p1',theme:'Knight fork',ts:now,box:1,due:now-1},{id:'p2',theme:'Knight fork',ts:now,box:4,due:now-1},
    {id:'p3',theme:'Pin',ts:now,box:1,due:now-1},{id:'p4',theme:'Mate in two',ts:now,box:3,due:now-1},
    {id:'p5',theme:'Skewer',ts:now,box:5,due:now+J}];renderMistakeQueue();})()`);
  const box = $("mistakeGrid");
  T("visible, avec le nombre a revoir maintenant (4)", !cache("mistakeSection") && net(box.querySelector(".erreurs-n").textContent) === "4");
  T("« Revoir » les enchaine", net($("btnMistakes").textContent) === "Revoir" && $("btnMistakes").onclick === w.lancerRevision);
  const pastilles = [...box.querySelectorAll(".erreurs-pastille")].map(x => net(x.textContent));
  T("les motifs en pastilles, le plus frequent d'abord, « x n » detache du nom", pastilles[0] === "Fourchette de cavalier × 2" && pastilles.length === 3 && pastilles.includes("Mat en deux coups × 1"), pastilles.join(" | "));
  T("la rangee des pastilles defile (enveloppe .defile)", !!box.querySelector(".defile > .erreurs-pastilles"));
  /* reussites deja faites : 0 + 3 + 0 + 2 + 4 = 9 sur 25 -> 2 cases */
  T("barre de maitrise : 5 cases, 2 pleines", box.querySelectorAll(".erreurs-barre i").length === 5 && box.querySelectorAll(".erreurs-barre i.pleine").length === 2);
  T("« 2 presque sues »", net(box.querySelector(".erreurs-presque").textContent) === "2 presque sues", box.querySelector(".erreurs-presque") && box.querySelector(".erreurs-presque").textContent);
  T("ce qui reviendra plus tard : « 1 autre reviendra demain. »", net(box.querySelector(".erreurs-plus-tard").textContent) === "1 autre reviendra demain.", box.querySelector(".erreurs-plus-tard") && box.querySelector(".erreurs-plus-tard").textContent);
  ev("(function(){const now=Date.now();prog.mistakeQueue.push({id:'p6',theme:'Pin',ts:now,box:1,due:now+5*864e5});renderMistakeQueue();})()");
  T("deux en attente : pluriel", /^2 autres reviendront demain\.$/.test(net(box.querySelector(".erreurs-plus-tard").textContent)), box.querySelector(".erreurs-plus-tard").textContent);
  ev("(function(){const now=Date.now();prog.mistakeQueue=prog.mistakeQueue.filter(m=>m.id!=='p5');prog.mistakeQueue.find(m=>m.id==='p6').due=now+5*864e5;renderMistakeQueue();})()");
  T("la prochaine dans plusieurs jours : sa date", /^1 autre reviendra plus tard, le \d{1,2} [a-zéû]+\.$/.test(net(box.querySelector(".erreurs-plus-tard").textContent)), box.querySelector(".erreurs-plus-tard").textContent);

  console.log("--- « Signaler cet exercice » ---");
  let envois = [], repond = true;
  w.fetch = (url, o) => { if (String(url).includes("/api/signaler")) { envois.push(JSON.parse(o.body)); return repond ? Promise.resolve({ ok: true, status: 204 }) : Promise.reject(new Error("hors ligne")); } return Promise.reject(new Error("non")); };
  ev("puzzle={id:'p5696',theme:'Mate in one',fen:puzzle&&puzzle.fen};puzzleDone=false;majBoutonSuivant()");
  T("pendant qu'on cherche : pas de lien", cache("exSignaler"));
  ev("puzzleDone=true;majBoutonSuivant()");
  T("exercice fini : le lien apparait", !cache("exSignaler") && !cache("btnSignaler") && net($("btnSignaler").textContent) === "Signaler cet exercice");
  $("btnSignaler").click();
  T("il ouvre quatre raisons, « Envoyer » grise", !cache("signalerChoix") && d.querySelectorAll('input[name="signalerRaison"]').length === 4 && $("signalerEnvoyer").disabled === true && $("btnSignaler").getAttribute("aria-expanded") === "true");
  T("les raisons en francais", net($("signalerChoix").textContent).includes("La solution est fausse Il y a un meilleur coup L'explication est fausse Autre chose"), net($("signalerChoix").textContent));
  $("signalerAnnuler").click();
  T("« Annuler » referme", cache("signalerChoix") && envois.length === 0);
  $("btnSignaler").click();
  repond = false;
  d.querySelector('input[value="explication"]').click();
  T("une raison choisie : « Envoyer » actif", $("signalerEnvoyer").disabled === false);
  $("signalerEnvoyer").click(); await pause(100);
  T("hors ligne : on le dit, et on peut reessayer", net($("signalerMerci").textContent) === "Le signalement n'a pas pu partir. Réessaie plus tard." && $("signalerEnvoyer").disabled === false && !cache("signalerChoix"));
  repond = true;
  $("signalerEnvoyer").click(); await pause(100);
  T("envoye : seulement le numero et la raison", JSON.stringify(envois[envois.length - 1]) === '{"exo":"p5696","raison":"explication"}', JSON.stringify(envois));
  T("puis « Merci, c'est note. », le lien disparait", net($("signalerMerci").textContent) === "Merci, c'est noté." && cache("btnSignaler") && cache("signalerChoix"));
  ev("puzzle={id:'p12',theme:'Pin'};puzzleDone=false;majBoutonSuivant();puzzleDone=true;majBoutonSuivant()");
  T("exercice suivant : le lien revient, sans merci", !cache("btnSignaler") && cache("signalerMerci"));
  ev("puzzle={id:'p5696',theme:'Pin'};puzzleDone=false;majBoutonSuivant();puzzleDone=true;majBoutonSuivant()");
  T("un exercice deja signale depuis cet appareil : le merci seul", cache("btnSignaler") && !cache("signalerMerci"));
  ev("puzzle={id:'pj1',theme:'Pin'};puzzleDone=false;majBoutonSuivant();puzzleDone=true;majBoutonSuivant()");
  T("un exercice tire de ta partie (pj) : pas de lien", cache("exSignaler"));
  w.close();

  console.log("--- Les autres langues ---");
  for (const [l, mot] of [["de", "Diese Aufgabe melden"], ["ru", "Сообщить об ошибке в задаче"], ["en", "Report this puzzle"]]) {
    const x = await ouvrir(l);
    T(l + " : le lien est traduit", net(x.document.getElementById("btnSignaler").textContent) === mot, x.document.getElementById("btnSignaler").textContent);
    x.close();
  }

  await pause(50);
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
