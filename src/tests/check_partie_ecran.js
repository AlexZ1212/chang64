/* Verification automatique de chang64.
   Lancement : node tests/check_partie_ecran.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-19) : l'ecran de la partie en direct
   (direct_ecran.js), dans la page francaise ouverte par jsdom, avec un faux
   WebSocket que le test pilote. Tant que le serveur des parties n'est pas
   ouvert au public, le panneau reste masque sur chang64.com. Sur un poste de
   developpement : invitation a creer un compte sans compte ; creation,
   attente avec le lien, partie avec pendules et pseudo de l'adversaire, coup
   envoye au serveur, nulle proposee, fin annoncee et rangee dans « Tes
   parties », revanche, aucune fenetre pendant la partie, messages clairs. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

function ouvrirLocal(reponseCreer) {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const fils = [], appels = [], refus = [], invitations = { liste: [] };
  return new Promise(res => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8067/fr/", virtualConsole: new VirtualConsole(),
      beforeParse(w) {
        w.fetch = (u, o) => {
          if (String(u).includes("/api/partie/invitations")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ liste: invitations.liste }) });
          if (String(u).includes("/api/partie/refuser")) { refus.push(JSON.parse(o.body).id); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }); }
          if (String(u).includes("/api/partie/creer")) { appels.push(JSON.parse(o.body)); const r = reponseCreer(); return Promise.resolve({ ok: r.s === 200, status: r.s, json: () => Promise.resolve(r.j) }); }
          return new Promise(() => {});
        };
        w.WebSocket = class { constructor(u) { this.url = u; this.envois = []; fils.push(this); } send(m) { this.envois.push(m); } close() { if (this.onclose) this.onclose(); } };
      }
    });
    setTimeout(() => res({ w: dom.window, fils, appels, refus, invitations }), 1500);
  });
}
const etat = plus => Object.assign({ t: "etat", id: "abcdefghjkmn", n: 1, cad: [600, 0], moi: "b", b: "Anna", nr: "Bob", coups: [], tb: 600000, tn: 600000, maj: Date.now(), h: Date.now(), phase: "debut", fin: null, nulle: null, rev: { b: false, n: false }, la: { b: true, n: true } }, plus || {});

(async () => {
  /* Ouvert a tous depuis le 21/11/2026 (decision d'Alexandre). */
  console.log("Sur chang64.com : ouvert a tous");
  let w = await ouvrir("fr");
  w.eval("setMode('friend')");
  T("le panneau de la partie en direct est visible pour tous", !w.document.getElementById("directPanel").classList.contains("hide"));
  T("un visiteur sans compte y voit l'invitation a en creer un", !w.document.getElementById("directInvite").classList.contains("hide") && /compte/.test(w.document.getElementById("directInvite").textContent));
  T("la partie par lien entre amis est intacte", !w.document.getElementById("amiStatusPanel").classList.contains("hide") && w.getComputedStyle(w.document.getElementById("amiNewGamePanel")).display !== "none");
  w.close();

  console.log("Poste de developpement, sans compte");
  let reponse = { s: 200, j: { id: "abcdefghjkmn" } };
  let p = await ouvrirLocal(() => reponse);
  w = p.w;
  const $ = id => w.document.getElementById(id), cache = id => $(id).classList.contains("hide");
  w.eval("setMode('friend');directPanneau()");
  T("le panneau s'affiche, en francais", !cache("directPanel") && $("directPanel").querySelector("h2").textContent.replace(/[  ]/g, " ") === "Partie en direct");
  T("sans compte : une invitation a en creer un, pas de formulaire", !cache("directInvite") && cache("directNouveau") && /Crée un compte gratuit/.test($("directInvite").textContent.replace(/[  ]/g, " ")) && !!$("directInvite").querySelector("[data-vue-compte]"));

  console.log("Membre : creer et attendre");
  w.eval("cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};directPanneau()");
  T("membre : le formulaire, trois cadences", cache("directInvite") && !cache("directNouveau") && [...$("directCadences").children].map(b => b.textContent.replace(/[  ]/g, " ")).join() === "10+0,5+3,15+10");
  T("la cadence choisie est expliquee", $("directCadenceNote").textContent.replace(/[  ]/g, " ") === "10 minutes chacun pour toute la partie.", $("directCadenceNote").textContent);
  $("directCadences").children[2].click();
  T("et l'explication suit le choix", $("directCadenceNote").textContent.replace(/[  ]/g, " ") === "15 minutes chacun, plus 10 secondes ajoutées après chaque coup.", $("directCadenceNote").textContent);
  $("directPseudo").value = " Bob ";
  $("btnDirectCreer").click();
  await pause(50);
  T("creer envoie la cadence et le pseudo", p.appels.length === 1 && p.appels[0].cad === 2 && p.appels[0].adv === "Bob", JSON.stringify(p.appels));
  T("le fil s'ouvre sur la partie creee", p.fils.length === 1 && /\/api\/partie\/ws\?id=abcdefghjkmn$/.test(p.fils[0].url) && /^ws:/.test(p.fils[0].url));
  T("l'adresse de la page porte la partie", w.location.hash === "#partie=abcdefghjkmn");
  const fil = p.fils[0], recevoir = e => fil.onmessage({ data: JSON.stringify(e) });
  fil.onopen();
  recevoir(etat({ phase: "attente", nr: null, la: { b: true, n: false } }));
  T("attente apres une invitation : l'invite est nomme", /^Bob est invité/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  T("attente : le lien a envoyer, pas d'echiquier, bouton Quitter", !cache("directLienBloc") && /#partie=abcdefghjkmn$/.test($("directAdresse").value) && w.document.querySelector(".board-wrap").classList.contains("hide") && !cache("btnDirectQuitter") && cache("btnDirectAbandon"));
  T("les panneaux de la partie par lien s'effacent", w.getComputedStyle($("amiNewGamePanel")).display === "none" && w.getComputedStyle($("amiStatusPanel")).display === "none");

  T("l'historique entre amis s'efface aussi", w.getComputedStyle($("amiHistoryPanel")).display === "none");
  recevoir(etat({ phase: "fin", nr: null, inv: "Bob", fin: { r: "", m: "refusee" }, la: { b: true, n: false } }));
  T("invitation declinee : une phrase sobre, ni fenetre ni revanche, Quitter", $("directStatus").textContent.replace(/[  ]/g, " ") === "Bob ne peut pas jouer maintenant." && $("resultBanner").classList.contains("hide") && cache("btnDirectRevanche") && !cache("btnDirectQuitter"), $("directStatus").textContent);

  console.log("La partie");
  recevoir(etat());
  T("l'adversaire arrive : echiquier, pendules, son pseudo", !w.document.querySelector(".board-wrap").classList.contains("hide") && !cache("clockTop") && $("clockTopName").textContent.replace(/[  ]/g, " ") === "Bob" && $("clockTopTime").textContent.replace(/[  ]/g, " ") === "10:00" && $("clockBottomName").textContent.replace(/[  ]/g, " ") === "Toi");
  T("Abandonner visible, pas de nulle avant que chacun ait joue", !cache("btnDirectAbandon") && cache("btnDirectNulle") && cache("btnDirectQuitter"));
  T("aucune fenetre de felicitations ni defi pendant la partie", w.eval("bravoOccupe()") === true && w.eval("duelOccupe()") === true);
  /* 2026-11-21 : #boardTools porte le bandeau de coups, en lecture seule ; le
     bouton de retournement reste masque, et aucune puce ne ramene en arriere. */
  T("aucune aide : ni jauge ni outils d'analyse", $("btnFlip").hidden && !w.document.querySelector("#navScroll [data-ply]"));
  w.eval("directJouer(game.moves().find(m=>game.uci(m)==='e2e4'))");
  T("mon coup part au serveur et se voit tout de suite", fil.envois.includes('{"t":"coup","c":"e2e4"}') && /e4/.test($("amiSheet").textContent.replace(/[  ]/g, " ")));
  w.eval("directJouer(game.moves()[0])");
  T("rien d'autre ne part tant que le serveur n'a pas repondu", fil.envois.filter(m => m.includes("coup")).length === 1);
  recevoir(etat({ phase: "jeu", coups: ["e2e4", "e7e5"], maj: Date.now() - 5000, h: Date.now() }));
  await pause(300);
  T("ma pendule tourne, celle de l'adversaire attend", /^9:5[45]$/.test($("clockBottomTime").textContent) && $("clockTopTime").textContent.replace(/[  ]/g, " ") === "10:00" && $("clockBottom").classList.contains("active"), $("clockBottomTime").textContent.replace(/[  ]/g, " "));
  T("bandeau de coups sous l'echiquier, dernier coup en avant", !$("navRow").classList.contains("hide") && /e4.*e5/.test($("navScroll").textContent) && /e5/.test(($("navScroll").querySelector(".cur") || {}).textContent || ""), $("navScroll").textContent);
  T("à moi de jouer, nulle proposable", $("directStatus").textContent.replace(/[  ]/g, " ") === "À toi de jouer." && !cache("btnDirectNulle"));
  recevoir(etat({ phase: "jeu", coups: ["e2e4", "e7e5"], nulle: "n" }));
  T("l'adversaire propose la nulle : accepter ou refuser", /propose la nulle/.test($("directStatus").textContent.replace(/[  ]/g, " ")) && !cache("btnDirectAccepter") && !cache("btnDirectRefuser") && cache("btnDirectNulle"));
  $("btnDirectRefuser").click();
  T("refuser part au serveur", fil.envois.includes('{"t":"nulle-non"}'));
  /* 2026-11-19 : chaque message du serveur refaisait la partie, donc un nouvel
     objet « dernier coup », et la piece rejouait son deplacement. */
  T("un message sans nouveau coup ne rejoue pas l'animation", w.eval("lastAnimated === lastMove && !!lastMove"));
  recevoir(etat({ phase: "jeu", coups: ["e2e4", "e7e5"], la: { b: true, n: false } }));
  T("adversaire absent : c'est dit, la partie continue", /s'est absenté/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  fil.onmessage({ data: JSON.stringify({ t: "erreur", e: "limite" }) });
  T("limite du jour : message clair", /fermées jusqu'à demain/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  $("btnDirectAbandon").click();
  T("abandonner demande une confirmation", $("btnDirectAbandon").textContent.replace(/[  ]/g, " ") === "Confirmer l'abandon" && !fil.envois.includes('{"t":"abandon"}'));
  $("btnDirectAbandon").click();
  T("puis part au serveur", fil.envois.includes('{"t":"abandon"}'));

  recevoir(etat({ phase: "fin", coups: ["e2e4", "e7e5"], fin: { r: "1-0", m: "abandon" } }));
  T("abandon de l'adversaire : « Bob a abandonné. »", $("resultSub").textContent.replace(/[  ]/g, " ") === "Bob a abandonné.", $("resultSub").textContent);
  recevoir(etat({ n: 5, phase: "fin", coups: ["e2e4", "e7e5"], fin: { r: "0-1", m: "temps" } }));
  T("mon temps est tombe : « Tu n'as plus de temps. »", $("resultSub").textContent.replace(/[  ]/g, " ") === "Tu n'as plus de temps." && $("resultTitle").textContent.replace(/[  ]/g, " ") === "Tu perds");
  recevoir(etat({ n: 1 }));

  console.log("La fin");
  const avant = w.eval("history.length");
  recevoir(etat({ phase: "fin", coups: ["e2e4", "e7e5", "d1h5", "e8e7", "h5e5"], fin: { r: "1-0", m: "mat" } }));
  T("fin : « Tu gagnes », le motif, bouton Revanche", $("resultTitle").textContent.replace(/[  ]/g, " ") === "Tu gagnes" && $("resultSub").textContent.replace(/[  ]/g, " ") === "Échec et mat." && $("resultNew").textContent.replace(/[  ]/g, " ") === "Revanche" && !$("resultBanner").classList.contains("hide"));
  T("la partie rejoint « Tes parties » avec l'adversaire et la cadence", w.eval("history.length") === avant + 1 && w.eval("history[0].adv") === "Bob" && w.eval("history[0].r") === "win" && w.eval("history[0].tc") === "10+0" && w.eval("history[0].c") === "w");
  recevoir(etat({ phase: "fin", coups: ["e2e4", "e7e5", "d1h5", "e8e7", "h5e5"], fin: { r: "1-0", m: "mat" }, rev: { b: false, n: true } }));
  T("la ligne de « Tes parties » nomme l'adversaire", /| Bob | 10+0 |/.test(w.document.getElementById("historyList").textContent));
  T("elle n'y entre qu'une fois", w.eval("history.length") === avant + 1);
  T("l'adversaire veut une revanche : c'est dit", /veut une revanche/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  T("les fenetres peuvent revenir apres la fin", w.eval("directOccupe()") === false);
  $("resultNew").click();
  T("Revanche part au serveur", fil.envois.includes('{"t":"revanche"}'));
  recevoir(etat({ phase: "fin", coups: ["e2e4", "e7e5", "d1h5", "e8e7", "h5e5"], fin: { r: "1-0", m: "mat" }, rev: { b: true, n: false }, la: { b: true, n: false } }));
  T("revanche demandee, l'adversaire est parti : c'est dit tout de suite", /Bob\sa\squitt.\sla\spartie\.\sPas\sde\srevanche/.test($("directStatus").textContent), $("directStatus").textContent);
  recevoir(etat({ n: 2, moi: "n", b: "Bob", nr: "Anna" }));
  T("revanche : nouvelle partie, je joue les noirs, echiquier retourne", w.eval("flipped") === true && $("clockTopName").textContent.replace(/[  ]/g, " ") === "Bob" && $("resultBanner").classList.contains("hide") && /Aucun coup/.test($("amiSheet").textContent.replace(/[  ]/g, " ")));
  recevoir(etat({ n: 2, moi: "n", b: "Bob", nr: "Anna", phase: "fin", fin: { r: "", m: "annulee" } }));
  T("partie annulee : dite, et pas gardee", $("resultTitle").textContent.replace(/[  ]/g, " ") === "Partie annulée" && w.eval("history.length") === avant + 1);
  $("btnDirectQuitter").click();
  T("quitter : retour a l'onglet habituel, adresse nettoyee", w.eval("directId") === "" && w.location.hash === "" && cache("clockTop") && !cache("directNouveau") && w.getComputedStyle($("amiNewGamePanel")).display !== "none");

  let rouverte = "";
  try { w.eval("setMode('play');openHistoryGame(0)"); rouverte = w.eval("game.history.length+'/'+isReviewGame"); } catch (e) { rouverte = String(e); }
  T("la partie gardee se rouvre pour etre revue", rouverte === "5/true", rouverte);
  w.eval("setMode('friend')");

  console.log("Invitation recue");
  const dort = () => w.document.getElementById("duel").hidden, txtDuel = () => w.document.getElementById("duelContenu").textContent.replace(/[  ]/g, " ");
  p.invitations.liste = [{ id: "zzzzzzzzzzzz", p: "Cleo", cad: 1, cree: Date.now() }];
  w.eval("directGuet=0;directId='occupee1234x'"); await w.eval("directGuetter()");
  T("pendant une partie en direct, aucune fenetre", dort());
  w.eval("directId='';directGuet=0"); await w.eval("directGuetter()");
  T("invitation recue : fenetre « Cleo t'invite à jouer », cadence dite", !dort() && /Cleo t'invite à jouer/.test(txtDuel()) && txtDuel().includes("Cadence : 5+3.") && /Rejoindre la partie/.test(txtDuel()) && /Refuser/.test(txtDuel()), txtDuel());
  T("fenetre qui informe : une medaille et un filet, pas d'arc", !!w.document.querySelector("#duelContenu .popin-medaille") && !!w.document.querySelector("#duelContenu .popin-filet"));
  w.document.getElementById("directInvRefuser").click();
  T("refuser : la fenetre se ferme et le serveur est prevenu", dort() && p.refus.join() === "zzzzzzzzzzzz");
  w.eval("directGuet=0"); await w.eval("directGuetter()");
  T("la meme invitation n'est pas remontree", dort());
  p.invitations.liste = [{ id: "yyyyyyyyyyyy", p: "Dan", cad: 0, cree: Date.now() }];
  w.eval("directGuet=0;setMode('play')"); await w.eval("directGuetter()");
  const avantFils = p.fils.length;
  w.document.getElementById("directInvRejoindre").click();
  T("rejoindre : onglet Inviter, fil ouvert sur la partie", dort() && w.eval("mode") === "friend" && w.eval("directId") === "yyyyyyyyyyyy" && p.fils.length === avantFils + 1 && /id=yyyyyyyyyyyy$/.test(p.fils[p.fils.length - 1].url) && p.refus.length === 1);
  w.eval("directQuitter()");
  p.invitations.liste = [];

  console.log("Refus");
  reponse = { s: 404, j: { erreur: "adversaire" } };
  $("btnDirectCreer").click(); await pause(50);
  T("pseudo inconnu : message, le formulaire reste", $("directStatus").textContent.replace(/[  ]/g, " ") === "Aucun membre ne porte ce pseudo." && !cache("directNouveau"));
  reponse = { s: 429, j: { erreur: "trop" } };
  $("btnDirectCreer").click(); await pause(50);
  T("trop de parties creees : message", /Réessaie dans une heure/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  reponse = { s: 429, j: { erreur: "invitations" } };
  $("btnDirectCreer").click(); await pause(50);
  T("trop d'invitations en attente : message", /Trop d'invitations en attente/.test($("directStatus").textContent.replace(/[  ]/g, " ")));
  reponse = { s: 503, j: { erreur: "limite" } };
  $("btnDirectCreer").click(); await pause(50);
  T("limite du jour a la creation : message, le reste du site marche", /fermées jusqu'à demain/.test($("directStatus").textContent.replace(/[  ]/g, " ")) && (w.eval("setMode('play')"), !w.document.getElementById("pane-play").classList.contains("hide")));
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
