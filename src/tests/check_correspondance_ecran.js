/* Verification automatique de chang64.
   Lancement : node tests/check_correspondance_ecran.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21) : la partie par correspondance cote
   navigateur (corr.js, direct_ecran.js), dans la page francaise ouverte par
   jsdom, avec un faux serveur et un faux WebSocket que le test pilote.
   Decisions d'Alexandre du 21/11 : le choix du haut de « Contre un ami »
   devient En direct | Correspondance | Par lien (maquette 1A) ; delais de 1,
   3 ou 7 jours par coup ; la liste « Tes parties en cours » est en haut de
   l'onglet Jouer, avec le nombre « a toi » sur l'onglet et dans le menu ; la
   partie se joue sur l'ecran du direct, sans second ecran. Une partie par
   correspondance ne retient ni l'onglet ni les fenetres une fois quittee. */
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ");
const HEURE = 3600e3, JOUR = 24 * HEURE;

function ouvrirLocal() {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const s = { fils: [], appels: [], corr: [], reponses: {} };
  return new Promise(res => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8067/fr/", virtualConsole: new VirtualConsole(),
      beforeParse(w) {
        w.fetch = (u, o) => {
          const m = String(u).match(/\/api\/partie\/([a-z-]+)/);
          if (!m) return new Promise(() => {});
          const rep = (statut, j) => Promise.resolve({ ok: statut === 200, status: statut, json: () => Promise.resolve(j) });
          if (m[1] === "invitations") return rep(200, { liste: [], corr: s.corr.map(x => Object.assign({ h: Date.now() }, x)) });
          const corps = o && o.body ? JSON.parse(o.body) : {};
          s.appels.push(Object.assign({ route: m[1] }, corps));
          const r = s.reponses[m[1]] || { s: 200, j: { ok: true } };
          return rep(r.s, r.j);
        };
        w.WebSocket = class { constructor(u) { this.url = u; this.envois = []; this.ferme = false; s.fils.push(this); } send(m) { this.envois.push(m); } close() { this.ferme = true; if (this.onclose) this.onclose(); } };
      }
    });
    setTimeout(() => res(Object.assign(s, { w: dom.window })), 1500);
  });
}
const etat = plus => Object.assign({ t: "etat", id: "abcdefghjkmn", n: 1, cad: [259200, 0], moi: "b", b: "Anna", nr: "Bob", coups: [], tb: 259200000, tn: 259200000, maj: Date.now(), h: Date.now(),
  phase: "debut", fin: null, nulle: null, rev: { b: false, n: false }, la: { b: true, n: false }, elo: null, inv: null }, plus || {});

(async () => {
  const p = await ouvrirLocal(), w = p.w, d = w.document;
  const $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide"), vu = el => w.getComputedStyle(el).display !== "none";
  const dernier = route => p.appels.filter(a => a.route === route).pop();

  console.log("Sans compte");
  w.eval("setMode('jouer')");
  await pause(100);
  T("la liste des parties en cours reste masquee", cache("corrPanel") && (!$("corrPastille") || $("corrPastille").hidden) && $("menuCorrLigne").hidden);

  console.log("Lancer une partie par correspondance");
  w.eval("cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};setMode('friend');amiModeRegler(amiModeDefaut())");
  T("le choix du haut : En direct, Correspondance, Par lien", [...$("amiModes").children].map(b => net(b.textContent)).join("|") === "En direct|Correspondance|Par lien");
  T("le direct garde ses cadences a la pendule", [...$("directCadences").children].map(b => net(b.textContent)).join() === "10+0,5+3,15+10" && !cache("directCats"));
  d.querySelector('#amiModes [data-v="corr"]').click();
  const pf = $("pane-friend");
  T("Correspondance reprend le bloc du direct", pf.dataset.ami === "direct" && pf.dataset.corr === "1" && !cache("directPanel") && d.querySelector('#amiModes [data-v="corr"]').getAttribute("aria-pressed") === "true");
  T("son titre et sa phrase", net($("directTitre").textContent) === "Partie par correspondance" && /Chacun joue quand il veut, sans pendule à surveiller/.test(net($("directSous").textContent)), $("directSous").textContent);
  T("trois delais par coup, 3 jours choisi", net($("directCadenceTitre").textContent) === "Délai par coup" && cache("directCats")
    && [...$("directCadences").children].map(b => net(b.textContent)).join() === "1 jour,3 jours,7 jours"
    && [...$("directCadences").children].map(b => b.getAttribute("aria-pressed")).join() === "false,true,false");
  T("le delai est explique, avec la regle du temps depasse", net($("directCadenceNote").textContent) === "Chacun a 3 jours pour jouer chaque coup. Passé ce délai, la partie est perdue.", $("directCadenceNote").textContent);
  $("directCadences").children[0].click();
  T("au singulier pour 1 jour", net($("directCadenceNote").textContent) === "Chacun a 1 jour pour jouer chaque coup. Passé ce délai, la partie est perdue.", $("directCadenceNote").textContent);
  T("pas de lien a envoyer par correspondance", !vu(d.querySelector(".direct-lien")) && vu($("btnDirectCreer")));
  $("directCadences").children[2].click();
  $("btnDirectCreer").click();
  await pause(30);
  T("sans pseudo, rien ne part", !dernier("creer") && /pseudo/i.test($("directStatus").textContent));
  p.corr = [{ id: "abcdefghjkmn", s: "envoyee", adv: "Bob", cad: 8, coul: "b", ech: Date.now() + 7 * JOUR }];
  p.reponses.creer = { s: 200, j: { id: "abcdefghjkmn", adv: "Bob" } };
  $("directPseudo").value = " bob ";
  w.eval("directCoul='b'");
  $("btnDirectCreer").click();
  await pause(60);
  T("Inviter envoie le delai (cadence 8), le pseudo et la couleur", dernier("creer") && dernier("creer").cad === 8 && dernier("creer").adv === "bob" && dernier("creer").coul === "b", dernier("creer"));
  T("aucun fil ne s'ouvre : rien a attendre a l'ecran", p.fils.length === 0 && w.eval("directId") === "");
  T("l'invitation est confirmee, avec sa duree", net($("directStatus").textContent) === "Invitation envoyée à Bob. Elle reste valable 7 jours, et la partie apparaîtra dans Jouer.", $("directStatus").textContent);
  T("la liste est relue aussitot", w.eval("corrParties.length") === 1);
  p.reponses.creer = { s: 429, j: { erreur: "plein" } };
  $("directPseudo").value = "Cleo";
  $("btnDirectCreer").click();
  await pause(60);
  T("dix parties deja en cours : c'est dit clairement", /Tu as déjà 10 parties par correspondance en cours/.test(net($("directStatus").textContent)), $("directStatus").textContent);
  d.querySelector('#amiModes [data-v="direct"]').click();
  T("retour a « En direct » : cadences a la pendule, lien propose", pf.dataset.corr === "" && [...$("directCadences").children].map(b => net(b.textContent)).join() === "10+0,5+3,15+10" && vu(d.querySelector(".direct-lien")) && net($("directCadenceTitre").textContent) === "Cadence" && w.eval("directCad") < 6);

  console.log("Contre un joueur en ligne");
  w.eval("amiModeRegler('hasard')");
  T("le meme choix, sans « Par lien »", vu($("amiModesPanel")) && vu(d.querySelector('#amiModes [data-v="corr"]')) && !vu(d.querySelector('#amiModes [data-v="lien"]')) && d.querySelector('#amiModes [data-v="direct"]').getAttribute("aria-pressed") === "true");
  d.querySelector('#amiModes [data-v="corr"]').click();
  T("par correspondance : delais en jours, adversaire au hasard", pf.dataset.ami === "hasard" && pf.dataset.corr === "1" && /partie par correspondance contre un adversaire tiré au hasard/.test(net($("directSous").textContent))
    && [...$("directCadences").children].map(b => net(b.textContent)).join() === "1 jour,3 jours,7 jours" && vu($("btnDirectHasard").parentNode) && !vu($("btnDirectCreer").parentNode));
  p.reponses.chercher = { s: 200, j: { id: "cccccccccccc", attente: true } };
  $("btnDirectHasard").click();
  await pause(60);
  T("chercher envoie le delai", dernier("chercher") && dernier("chercher").cad === 7, dernier("chercher"));
  T("personne pour l'instant : la recherche reste ouverte, sans fil", p.fils.length === 0 && /Ta recherche est ouverte pendant 7 jours/.test(net($("directStatus").textContent)), $("directStatus").textContent);
  p.reponses.chercher = { s: 200, j: { id: "dddddddddddd", attente: false } };
  $("btnDirectHasard").click();
  await pause(60);
  T("un adversaire attendait : la partie s'ouvre", p.fils.length === 1 && /id=dddddddddddd$/.test(p.fils[0].url) && w.eval("directId") === "dddddddddddd");
  w.eval("directQuitter(true)");

  console.log("La liste « Tes parties en cours »");
  p.corr = [
    { id: "aaaaaaaaaaaa", s: "jeu", adv: "Tom", cad: 7, coul: "n", atoi: false, ech: Date.now() + 6 * JOUR + 2 * HEURE },
    { id: "bbbbbbbbbbbb", s: "envoyee", adv: "Bob", cad: 8, coul: "b", ech: Date.now() + 7 * JOUR },
    { id: "cccccccccccc", s: "invite", adv: "Nadia", cad: 8, coul: "n", ech: Date.now() + 6 * JOUR },
    { id: "dddddddddddd", s: "jeu", adv: "Léa", cad: 7, coul: "b", atoi: true, ech: Date.now() + 2 * JOUR + 4 * HEURE + 60e3 },
    { id: "eeeeeeeeeeee", s: "jeu", adv: "Marco", cad: 6, coul: "b", atoi: true, ech: Date.now() + 5 * HEURE + 60e3 },
    { id: "ffffffffffff", s: "fin", adv: "Zoé", cad: 6, coul: "b", r: "win", ech: Date.now() + 14 * JOUR },
    { id: "gggggggggggg", s: "cherche", adv: null, cad: 6, coul: "b", ech: Date.now() + 3 * JOUR + HEURE },
    { id: "pas-un-id", s: "jeu", adv: "X", cad: 7, coul: "b", atoi: true, ech: Date.now() + JOUR }
  ];
  w.eval("setMode('jouer')");
  await pause(80);
  const lignes = () => [...$("corrListe").children];
  const texte = el => net(el.textContent);
  T("elle est en haut de l'onglet Jouer, avant les trois cartes", !cache("corrPanel") && $("corrPanel").parentNode === $("pane-jouer") && $("pane-jouer").firstElementChild === $("corrPanel") && net($("corrPanel").querySelector(".eyebrow").textContent) === "Tes parties en cours");
  T("une ligne par partie ; un identifiant douteux est ecarte", lignes().length === 7, lignes().length);
  T("a moi de jouer d'abord, la plus pressee en tete", lignes().slice(0, 2).map(l => l.dataset.id).join() === "eeeeeeeeeeee,dddddddddddd" && lignes()[2].dataset.s === "invite" && lignes()[3].dataset.s === "fin");
  T("« À toi », l'adversaire, le temps restant et le delai", texte(lignes()[1]) === "À toiContre LéaIl te reste 2j 4h | 3 jours/coup›", texte(lignes()[1]));
  T("moins d'un jour : le temps est en rouge", !!lignes()[0].querySelector(".corr-urgent") && /Il te reste 5h/.test(texte(lignes()[0])) && !lignes()[1].querySelector(".corr-urgent"), texte(lignes()[0]));
  T("au tour de l'autre : dit sans « À toi »", texte(d.querySelector('[data-id="aaaaaaaaaaaa"]')) === "Contre TomAu tour de Tom | encore 6j 1h›" || texte(d.querySelector('[data-id="aaaaaaaaaaaa"]')) === "Contre TomAu tour de Tom | encore 6j 2h›", texte(d.querySelector('[data-id="aaaaaaaaaaaa"]')));
  T("invitation recue : delai, ma couleur, Accepter et Refuser", /^Nadia t'invite7 jours\/coup \| Tu joues les Noirs\.AccepterRefuser$/.test(texte(d.querySelector('[data-id="cccccccccccc"]'))), texte(d.querySelector('[data-id="cccccccccccc"]')));
  T("invitation envoyee : en attente, Annuler", texte(d.querySelector('[data-id="bbbbbbbbbbbb"]')) === "En attente de BobInvitation envoyée | 7 jours/coupAnnuler", texte(d.querySelector('[data-id="bbbbbbbbbbbb"]')));
  T("recherche d'adversaire : dite, Annuler", /^Recherche d'un adversaire1 jour\/coup \| encore 3j( 1h)?Annuler$/.test(texte(d.querySelector('[data-id="gggggggggggg"]'))), texte(d.querySelector('[data-id="gggggggggggg"]')));
  T("partie finie pas encore vue : resultat annonce", texte(d.querySelector('[data-id="ffffffffffff"]')) === "GContre ZoéPartie terminée : tu as gagné.›", texte(d.querySelector('[data-id="ffffffffffff"]')));
  T("le nombre « a toi » sur l'onglet Jouer : 2 tours + 1 invitation + 1 fin", !$("corrPastille").hidden && $("corrPastille").parentNode === $("tab-jouer") && $("corrPastille").firstChild.textContent === "4" && /4 parties t'attendent/.test(net($("corrPastille").textContent)), $("corrPastille").textContent);
  T("le meme nombre dans le menu, ligne « Parties en cours »", !$("menuCorrLigne").hidden && $("menuCorrDetail").textContent === "4" && /Parties en cours/.test(net($("menuCorrLigne").textContent)));
  T("les lignes sont des boutons, les actions aussi (clavier)", lignes()[0].tagName === "BUTTON" && d.querySelector('[data-id="cccccccccccc"]').tagName === "DIV" && d.querySelectorAll('[data-id="cccccccccccc"] button').length === 2);
  T("durees : jours et heures, heures et minutes, minutes", w.eval("[corrDuree(3*86400000),corrDuree(86400000+3*3600000+5),corrDuree(5*3600000+12*60000),corrDuree(2*3600000),corrDuree(90000),corrDuree(20000),corrDuree(-5)].join('|')").replace(/[  ]/g, " ") === "3j|1j 3h|5h 12min|2h|2min|1min|0min", w.eval("[corrDuree(3*86400000),corrDuree(86400000+3*3600000+5),corrDuree(5*3600000+12*60000),corrDuree(2*3600000),corrDuree(90000),corrDuree(20000),corrDuree(-5)].join('|')"));

  console.log("Refuser, annuler, accepter");
  d.querySelector('[data-id="cccccccccccc"] [data-corr="refuser"]').click();
  await pause(60);
  T("Refuser previent le serveur", dernier("refuser") && dernier("refuser").id === "cccccccccccc");
  d.querySelector('[data-id="bbbbbbbbbbbb"] [data-corr="retirer"]').click();
  await pause(60);
  T("Annuler retire l'invitation envoyee", dernier("retirer") && dernier("retirer").id === "bbbbbbbbbbbb");
  p.reponses.accepter = { s: 429, j: { erreur: "plein" } };
  d.querySelector('[data-id="cccccccccccc"] [data-corr="accepter"]').click();
  await pause(60);
  T("accepter avec dix parties en cours : refus explique dans la liste", !cache("corrMessage") && /Tu as déjà 10 parties par correspondance en cours/.test(net($("corrMessage").textContent)) && p.fils.length === 1);
  p.reponses.accepter = { s: 200, j: { ok: true, id: "cccccccccccc" } };
  d.querySelector('[data-id="cccccccccccc"] [data-corr="accepter"]').click();
  await pause(60);
  T("Accepter assoit l'invite puis ouvre la partie", dernier("accepter").id === "cccccccccccc" && p.fils.length === 2 && /id=cccccccccccc$/.test(p.fils[1].url) && w.eval("mode") === "friend");
  w.eval("directQuitter(true);setMode('jouer')");
  await pause(60);

  console.log("La partie, sur l'ecran du direct");
  d.querySelector('[data-id="dddddddddddd"]').click();
  await pause(30);
  const fil = p.fils[p.fils.length - 1], recevoir = e => fil.onmessage({ data: JSON.stringify(e) });
  T("toucher une ligne ouvre la partie", w.eval("mode") === "friend" && /id=dddddddddddd$/.test(fil.url) && w.location.hash === "#partie=dddddddddddd");
  fil.onopen();
  recevoir(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5"], maj: Date.now() - (19 * HEURE + 30 * 60e3), h: Date.now() }));
  T("echiquier, feuille de partie, pseudo de l'adversaire", !d.querySelector(".board-wrap").classList.contains("hide") && net($("clockTopName").textContent) === "Bob" && /e4/.test(net($("amiSheet").textContent)));
  T("le temps du coup en cours, en jours et en heures", net($("clockBottomTime").textContent) === "2j 4h" && net($("clockTopTime").textContent) === "3j" && $("clockBottom").classList.contains("active") && $("clockBottom").classList.contains("corr"), $("clockBottomTime").textContent + " / " + $("clockTopTime").textContent);
  T("a moi de jouer, sans phrase sur l'absence de l'adversaire", net($("directStatus").textContent) === "À toi de jouer.", $("directStatus").textContent);
  T("Abandonner, Proposer la nulle, et Retour a mes parties", !cache("btnDirectAbandon") && !cache("btnDirectNulle") && !cache("btnDirectQuitter") && net($("btnDirectQuitter").textContent) === "Retour à mes parties" && cache("btnDirectAnnuler") && cache("directLienBloc"));
  T("aucune fenetre pendant qu'on joue", w.eval("bravoOccupe()") === true);
  T("aucune aide : ni jauge ni outils d'analyse", $("evalwrap").classList.contains("hide") && $("plyInfo").classList.contains("hide"));
  w.eval("directJouer(game.moves().find(m=>game.uci(m)==='g1f3'))");
  T("mon coup part au serveur", fil.envois.includes('{"t":"coup","c":"g1f3"}'));
  recevoir(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5", "g1f3"], maj: Date.now(), h: Date.now() }));
  T("apres mon coup : au tour de l'autre, je peux fermer le site", net($("directStatus").textContent) === "Au tour de Bob. Tu peux fermer le site : la partie t'attend.", $("directStatus").textContent);
  T("son delai repart entier", net($("clockTopTime").textContent) === "3j" || net($("clockTopTime").textContent) === "2j 23h", $("clockTopTime").textContent);
  recevoir(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5", "g1f3", "b8c6"], maj: Date.now() - (2 * JOUR + 5 * HEURE - 30e3), h: Date.now() }));
  T("le dernier jour : pendule en alerte, sans son de compte a rebours", net($("clockBottomTime").textContent) === "19h" && $("clockBottom").classList.contains("low") && !$("clockBottom").classList.contains("tres-bas"), $("clockBottomTime").textContent);
  recevoir(etat({ id: "dddddddddddd", phase: "debut", coups: [], maj: Date.now() - (5 * HEURE - 30e3), h: Date.now() }));
  T("des le premier coup le delai court (pas de minute de grace)", net($("clockBottomTime").textContent) === "2j 19h" && $("clockBottom").classList.contains("active") && net($("directStatus").textContent) === "À toi de jouer.", $("clockBottomTime").textContent + " / " + $("directStatus").textContent);

  console.log("Quitter l'ecran");
  recevoir(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5", "g1f3", "b8c6"], maj: Date.now(), h: Date.now() }));
  $("tab-jouer").click();
  await pause(60);
  T("l'onglet Jouer ramene a la liste, il n'est pas retenu par la partie", w.eval("mode") === "jouer" && !cache("corrPanel"));
  T("le fil est referme : la partie attend sur le serveur", fil.ferme && w.eval("directId") === "" && w.location.hash === "" && w.eval("bravoOccupe()") === false);
  d.querySelector('[data-id="dddddddddddd"]').click();
  await pause(30);
  let f2 = p.fils[p.fils.length - 1];
  f2.onopen();
  f2.onmessage({ data: JSON.stringify(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5"], maj: Date.now(), h: Date.now() })) });
  w.eval("setMode('puzzle')");
  await pause(30);
  T("changer d'onglet la referme aussi", f2.ferme && w.eval("directId") === "" && w.eval("typeof directOccupe==='function'&&directOccupe()") === false);
  w.eval("setMode('jouer')");
  await pause(60);
  d.querySelector('[data-id="dddddddddddd"]').click();
  await pause(30);
  f2 = p.fils[p.fils.length - 1];
  f2.onopen();
  f2.onmessage({ data: JSON.stringify(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5"], maj: Date.now(), h: Date.now() })) });
  $("btnDirectQuitter").click();
  await pause(60);
  T("« Retour à mes parties » ramene a la liste", w.eval("mode") === "jouer" && f2.ferme && w.eval("directId") === "");

  console.log("Invitation en attente, vue par celui qui invite");
  d.querySelector('[data-id="aaaaaaaaaaaa"]').click();
  await pause(30);
  let f3 = p.fils[p.fils.length - 1];
  f3.onopen();
  f3.onmessage({ data: JSON.stringify(etat({ id: "aaaaaaaaaaaa", phase: "attente", nr: null, inv: "Bob" })) });
  T("attente : dit qui doit repondre et combien de temps", net($("directStatus").textContent) === "En attente de la réponse de Bob. L'invitation est valable 7 jours.", $("directStatus").textContent);
  T("ni lien a envoyer ni echiquier ; Annuler l'invitation et Retour", cache("directLienBloc") && d.querySelector(".board-wrap").classList.contains("hide") && !cache("btnDirectAnnuler") && net($("btnDirectAnnuler").textContent) === "Annuler l'invitation" && !cache("btnDirectQuitter"));
  $("btnDirectAnnuler").click();
  await pause(60);
  T("Annuler l'invitation la retire et ramene a la liste", dernier("retirer").id === "aaaaaaaaaaaa" && w.eval("mode") === "jouer" && w.eval("directId") === "");

  console.log("Fin de partie");
  d.querySelector('[data-id="dddddddddddd"]').click();
  await pause(30);
  const f4 = p.fils[p.fils.length - 1], recevoir4 = e => f4.onmessage({ data: JSON.stringify(e) });
  f4.onopen();
  recevoir4(etat({ id: "dddddddddddd", phase: "jeu", coups: ["e2e4", "e7e5", "g1f3", "b8c6"], maj: Date.now(), h: Date.now() }));
  const avant = w.eval("history.length");
  recevoir4(etat({ id: "dddddddddddd", phase: "fin", coups: ["e2e4", "e7e5", "g1f3", "b8c6"], tn: 0, fin: { r: "1-0", m: "temps" }, elo: { b: { d: 20, r: 820 }, n: { d: -20, r: 780 } } }));
  T("temps depasse par l'adversaire : carte de fin, dite clairement", !$("resultBanner").classList.contains("hide") && net($("resultTitle").textContent) === "Tu gagnes" && net($("resultSub").textContent) === "Bob n'a plus de temps.", $("resultSub").textContent);
  T("la partie rejoint « Tes parties », sorte Correspondance", w.eval("history.length") === avant + 1 && w.eval("history[0].k") === "c" && net(w.eval("history[0].tc")) === "3 jours/coup" && w.eval("history[0].adv") === "Bob", w.eval("JSON.stringify(history[0])"));
  T("elle peut etre revue", !$("resultAnalyse").classList.contains("hide"));
  T("Revanche est proposee", !cache("btnDirectRevanche") && !$("btnDirectRevanche").disabled && net($("resultNew").textContent) === "Revanche");
  p.reponses.creer = { s: 200, j: { id: "hhhhhhhhhhhh", adv: "Bob" } };
  const creations = p.appels.filter(a => a.route === "creer").length;
  $("resultNew").click();
  await pause(80);
  T("Revanche = une nouvelle invitation, meme delai, couleurs inversees", p.appels.filter(a => a.route === "creer").length === creations + 1 && dernier("creer").cad === 7 && dernier("creer").adv === "Bob" && dernier("creer").coul === "n", dernier("creer"));
  T("rien n'est demande dans la partie finie", !f4.envois.some(m => /revanche/.test(m)));
  T("c'est dit, et le bouton ne se redemande pas", net($("directStatus").textContent) === "Invitation envoyée à Bob." && $("btnDirectRevanche").disabled, $("directStatus").textContent);
  recevoir4(etat({ id: "dddddddddddd", phase: "fin", moi: "b", coups: [], fin: { r: "", m: "annulee" } }));
  T("premier coup non joue a temps : annulee, dit sans « minute »", net($("directStatus").textContent) === "Partie annulée : le premier coup n'a pas été joué à temps." || net($("resultSub").textContent) === "Partie annulée : le premier coup n'a pas été joué à temps.", $("directStatus").textContent + " / " + $("resultSub").textContent);
  w.eval("directQuitter(true);setMode('friend')");
  T("le filtre Correspondance de « Tes parties » existe", [...d.querySelectorAll("#historyFiltres button")].some(b => net(b.textContent) === "Correspondance"));

  console.log("Le direct n'a pas change");
  w.eval("amiModeRegler('direct')");
  p.reponses.creer = { s: 200, j: { id: "jjjjjjjjjjjj" } };
  $("btnDirectLien").click();
  await pause(60);
  const f5 = p.fils[p.fils.length - 1];
  f5.onopen();
  f5.onmessage({ data: JSON.stringify(etat({ id: "jjjjjjjjjjjj", cad: [600, 0], tb: 600000, tn: 600000, phase: "attente", nr: null })) });
  T("partie en direct : cadence a la pendule, lien a envoyer, Quitter", dernier("creer").cad < 6 && !cache("directLienBloc") && net($("btnDirectQuitter").textContent) === "Quitter" && cache("btnDirectAnnuler"));
  f5.onmessage({ data: JSON.stringify(etat({ id: "jjjjjjjjjjjj", cad: [600, 0], tb: 600000, tn: 600000, phase: "debut" })) });
  T("ses pendules restent en minutes, et elle retient l'onglet Jouer", net($("clockTopTime").textContent) === "10:00" && !$("clockTop").classList.contains("corr") && cache("btnDirectQuitter") && w.eval("jouerPartieAmi()") === true);
  w.eval("setMode('puzzle')");
  T("changer d'onglet ne ferme pas une partie en direct", !f5.ferme && w.eval("directId") === "jjjjjjjjjjjj");
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
