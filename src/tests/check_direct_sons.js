/* Verification automatique de chang64.
   Lancement : node tests/check_direct_sons.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Sons de la partie en direct (2026-11-21, demande d'Alexandre). Avant, seul
   le debut de partie sonnait, et une nulle proposee ne se voyait que par un
   texte discret. Chaque evenement a desormais son son, avec le moteur SON et
   donc le reglage Sons : nulle proposee par l'adversaire (son d'appel, message
   mis en avant avec Accepter et Refuser), nulle declinee, revanche demandee,
   invitation recue, adversaire parti puis revenu, alerte des 10 secondes, fin
   de partie (mat, temps, nulle, abandon). Rien ne sonne deux fois pour le
   meme evenement.

   Les sons eux-memes ne s'entendent pas dans un test : on remplace chaque
   son par une note dans un journal, et on lit le journal. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").replace(/’/g, "'").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2400, avant(win) { win.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 })); } });
  const d = w.document, $ = id => d.getElementById(id);
  T("le moteur de sons a ses quatre sons du direct", ["appel", "refus", "depart", "retour"].every(k => w.eval("typeof SON." + k) === "function"));
  T("ils se taisent sans erreur quand le son n'est pas pret", (w.eval("SON.appel();SON.refus();SON.depart();SON.retour();1")) === 1);
  /* Le journal des sons. */
  w.eval("window.__sons=[];for(const k of ['appel','refus','depart','retour','tic','debut','coup','drapeau'])SON[k]=()=>{window.__sons.push(k);};SON.fin=r=>{window.__sons.push('fin:'+r);};");
  const sons = () => { const l = w.__sons.filter(x => x !== "coup").join(","); w.__sons.length = 0; return l; };
  /* Un etat envoye par le serveur ; moi = les Blancs, l'adversaire = les Noirs. */
  let base = { t: "etat", id: "aaaaaaaaaaaa", n: 1, cad: [600, 0], moi: "b", b: "Moi", nr: "Lea", coups: [], tb: 600000, tn: 600000, maj: 0, h: 0, phase: "attente", fin: null, nulle: null,
    rev: { b: false, n: false }, la: { b: true, n: false }, inv: null, elo: null };
  const recevoir = async plus => { base = Object.assign({}, base, plus, { maj: Date.now(), h: Date.now() }); w.__e = JSON.parse(JSON.stringify(base)); w.eval("directRecu(window.__e)"); await attendre(60); };
  w.eval("setMode('friend');directId='aaaaaaaaaaaa'");
  await recevoir({});
  T("en attente de l'adversaire : silence", sons() === "", sons());

  console.log("--- Pendant la partie ---");
  await recevoir({ phase: "debut", la: { b: true, n: true } });
  T("l'adversaire s'assoit : le son de debut, et seulement lui", sons() === "debut", sons());
  await recevoir({ phase: "jeu", coups: ["e2e4", "e7e5"] });
  sons();
  await recevoir({ nulle: "n" });
  T("nulle proposee par l'adversaire : son d'appel", sons() === "appel");
  T("le message passe en avant", $("directStatus").classList.contains("appel") && /propose la nulle/.test(net($("directStatus").textContent)), $("directStatus").className + " " + $("directStatus").textContent);
  T("avec ses deux boutons, Accepter et Refuser", !$("btnDirectAccepter").classList.contains("hide") && !$("btnDirectRefuser").classList.contains("hide"));
  T("les deux reponses ont leur rangee, Abandonner passe dessous", $("directPanel").classList.contains("nulle-recue"));
  await recevoir({ la: { b: true, n: true } });
  T("le meme etat recu deux fois ne resonne pas", sons() === "");
  await recevoir({ nulle: null });
  T("j'ai refuse : pas de son, et le message n'est plus en avant", sons() === "" && !$("directStatus").classList.contains("appel"));
  await recevoir({ nulle: "b" });
  T("je propose la nulle : silence", sons() === "" && /Nulle proposée/.test(net($("directStatus").textContent)));
  await recevoir({ nulle: null });
  T("l'adversaire la decline : son de refus", sons() === "refus");
  T("et l'ecran le dit", /a refusé la nulle/.test(net($("directStatus").textContent)), $("directStatus").textContent);
  await recevoir({ nulle: "b" });
  await recevoir({ nulle: null, coups: ["e2e4", "e7e5", "g1f3"] });
  sons();
  await recevoir({ nulle: "b" });
  sons();
  await recevoir({ nulle: null, coups: ["e2e4", "e7e5", "g1f3", "b8c6"] });
  T("un coup de l'adversaire au lieu d'une reponse : la nulle est declinee aussi", sons() === "refus");
  await recevoir({ la: { b: true, n: false } });
  T("l'adversaire s'en va : son de depart", sons() === "depart" && /absenté/.test(net($("directStatus").textContent)));
  await recevoir({ la: { b: true, n: true } });
  T("il revient : son de retour", sons() === "retour");

  console.log("--- Pendule ---");
  await recevoir({ tb: 9000, tn: 300000 });
  w.eval("directPendules()");
  T("moins de 10 secondes, a mon tour : l'alerte sonne", sons() === "tic", w.__sons.join());
  w.eval("directPendules();directPendules()");
  T("une seule fois par partie", sons() === "");
  await recevoir({ tb: 300000, tn: 9000, coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] });
  w.eval("directPendules()");
  T("la pendule de l'adversaire ne declenche pas mon alerte", sons() === "");

  console.log("--- Fin de partie ---");
  await recevoir({ phase: "fin", fin: { r: "1-0", m: "abandon" } });
  T("abandon de l'adversaire : le son de victoire", sons() === "fin:win", w.__sons.join());
  await recevoir({ rev: { b: false, n: true } });
  T("il demande une revanche : son d'appel", sons() === "appel" && /veut une revanche/.test(net($("directStatus").textContent)));
  await recevoir({ rev: { b: false, n: true }, la: { b: true, n: true } });
  T("sans resonner a l'etat suivant", sons() === "");
  await recevoir({ n: 2, moi: "n", b: "Lea", nr: "Moi", phase: "debut", fin: null, coups: [], rev: { b: false, n: false }, tb: 600000, tn: 600000 });
  T("la revanche commence : son de debut", sons() === "debut");
  await recevoir({ phase: "jeu", coups: ["f2f3", "e7e5", "g2g4", "d8h4"] });
  sons();
  await recevoir({ phase: "fin", fin: { r: "0-1", m: "mat" } });
  T("mat que je donne : victoire", sons() === "fin:win", w.__sons.join());
  await recevoir({ n: 3, moi: "b", b: "Moi", nr: "Lea", phase: "jeu", fin: null, coups: ["e2e4", "e7e5"], tb: 600000, tn: 600000 });
  sons();
  await recevoir({ phase: "fin", fin: { r: "0-1", m: "temps" }, tb: 0 });
  T("je perds au temps : son de defaite", sons() === "fin:lose", w.__sons.join());
  await recevoir({ n: 4, moi: "n", b: "Lea", nr: "Moi", phase: "jeu", fin: null, coups: ["e2e4", "e7e5"], tb: 600000, tn: 600000, nulle: "n" });
  sons();
  await recevoir({ phase: "fin", fin: { r: "1/2", m: "accord" }, nulle: null });
  T("nulle acceptee : le son de la nulle, pas celui du refus", sons() === "fin:draw", w.__sons.join());

  console.log("--- Invitation recue ---");
  w.eval("directQuitter(true);directGuet=0;directInvitations=async()=>[{id:'bbbbbbbbbbbb',p:'Tom',cad:1,coul:'n',cree:Date.now()}]");
  sons();
  await w.eval("directGuetter()");
  await attendre(100);
  T("une invitation arrive : son d'appel", sons() === "appel", w.__sons.join());
  T("la fenetre dit la cadence et ma couleur", /5\+3/.test($("duel").textContent) && /Tu joues les Noirs/.test(net($("duel").textContent)), net($("duel").textContent).slice(0, 160));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
