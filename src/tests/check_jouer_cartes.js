/* Verification automatique de chang64.
   Lancement : node tests/check_jouer_cartes.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Onglet Jouer en trois cartes et ecran « Contre un ami » (2026-11-21,
   decisions d'Alexandre) :
   - trois cartes : contre l'ordinateur, contre un ami, contre un joueur en
     ligne ; la troisieme est reservee aux membres (verrouillee pour un
     visiteur, qu'elle mene a la creation de compte) ;
   - « Contre un ami » : un choix en haut (En direct, Par lien), un seul bloc a
     la fois ; un membre arrive sur En direct, un visiteur sur Par lien ;
   - bloc de lancement du direct : couleur (Blancs, Noirs, Au hasard), cadence
     (Rapide, Classique), adversaire, « Inviter », ou « envoyer un lien » ;
   - « Contre un joueur en ligne » : la cadence et « Trouver un adversaire »,
     sans couleur ni adversaire ;
   - partie par lien : « Au hasard » s'ajoute au choix de la couleur. */
const path = require("path"), fs = require("fs");
const { ouvrir, SITE } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
/* Le site pose des espaces insecables et des apostrophes typographiques en francais. */
const net = x => String(x).replace(/\s+/g, " ").replace(/\u2019/g, "'").trim();
const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
const MEMBRE = w => w.localStorage.setItem("chang64:compte", JSON.stringify({ pseudo: "Moi", cle: "moi", version: 1, dev: "abc123", n: 0, sync: 0 }));
/* Le serveur des parties est remplace : on note ce que l'ecran lui demande. */
const ESPION = "window.__appels=[];directCreer=async(cad,pseudo,coul)=>{window.__appels.push(['creer',cad,pseudo===undefined?null:pseudo,coul]);return {erreur:'reseau'};};" +
  "directChercher=async cad=>{window.__appels.push(['chercher',cad]);return {erreur:'reseau'};};";

(async () => {
  console.log("--- Visiteur sans compte ---");
  let w = await ouvrir("fr", { attente: 2400 });
  let d = w.document, $ = id => d.getElementById(id);
  w.eval("setMode('jouer')");
  await attendre(300);
  const cartes = [...d.querySelectorAll("#pane-jouer .jouer-carte")];
  T("trois cartes dans l'onglet Jouer", cartes.length === 3 && cartes.map(c => c.id).join() === "jouerOrdi,jouerAmi,jouerEnLigne");
  T("chacune dit qui est en face", cartes.map(c => net(c.querySelector("b").textContent)).join("|") === "Contre l'ordinateur|Contre un ami|Contre un joueur en ligne", cartes.map(c => c.querySelector("b").textContent).join("|"));
  T("chaque carte a son pictogramme", cartes.every(c => !!c.querySelector(".picto svg")));
  T("la troisieme est verrouillee pour un visiteur", $("jouerEnLigne").classList.contains("verrou") && /Gratuit avec un compte/.test(net($("jouerEnLigneGo").textContent)), $("jouerEnLigneGo").textContent);
  $("jouerEnLigne").click();
  await attendre(300);
  T("elle mene a la creation de compte, pas a une partie", w.eval("mode") === "jouer" && !$("menuTiroir").hidden && !$("menuCompteVue").hidden);
  w.eval("menuFermer()");
  $("jouerAmi").click();
  await attendre(300);
  const p = $("pane-friend");
  T("« Contre un ami » : un visiteur arrive sur Par lien", w.eval("mode") === "friend" && p.dataset.ami === "lien" && d.querySelector('#amiModes [data-v="lien"]').getAttribute("aria-pressed") === "true");
  T("le choix en haut propose En direct, Correspondance et Par lien", [...$("amiModes").children].map(b => net(b.textContent)).join("|") === "En direct|Correspondance|Par lien");
  d.querySelector('#amiModes [data-v="direct"]').click();
  await attendre(200);
  T("En direct, pour un visiteur : l'invitation a creer un compte, pas le bloc de lancement", p.dataset.ami === "direct" && !$("directInvite").classList.contains("hide") && !!$("directInvite").querySelector("[data-vue-compte]") && $("directNouveau").classList.contains("hide"));
  d.querySelector('#amiModes [data-v="lien"]').click();
  await attendre(200);
  /* Partie par lien : trois couleurs. */
  const coul = [...d.querySelectorAll("#amiColorBtns button")];
  T("partie par lien : Blancs, Noirs, Au hasard", coul.map(b => b.dataset.v).join() === "w,b,r" && coul.map(b => b.textContent.replace(/\s+/g, " ").trim()).join("|") === "Blancs|Noirs|Au hasard", coul.map(b => b.textContent).join("|"));
  $("btnAmiNew").click();
  await attendre(200);
  coul[2].click();
  await attendre(400);
  T("« Au hasard » lance la partie avec une couleur tiree", w.eval("amiStarted") === true && [w.eval("W"), w.eval("B")].includes(w.eval("amiColor")) && p.dataset.ami === "lien");
  T("l'echiquier de la partie par lien est montre", !d.querySelector(".board-wrap").classList.contains("hide"));
  d.querySelector('#amiModes [data-v="direct"]').click();
  await attendre(200);
  T("sous En direct, l'echiquier de la partie par lien s'efface", d.querySelector(".board-wrap").classList.contains("hide"));
  d.querySelector('#amiModes [data-v="lien"]').click();
  await attendre(200);
  T("et revient sous Par lien", !d.querySelector(".board-wrap").classList.contains("hide"));
  w.close();

  console.log("--- Membre ---");
  w = await ouvrir("fr", { attente: 2400, avant: MEMBRE });
  d = w.document; $ = id => d.getElementById(id);
  w.eval(ESPION);
  w.eval("setMode('jouer')");
  await attendre(300);
  T("la troisieme carte est ouverte a un membre", !$("jouerEnLigne").classList.contains("verrou") && /Trouver un adversaire/.test(net($("jouerEnLigneGo").textContent)));
  $("jouerAmi").click();
  await attendre(300);
  const pf = $("pane-friend");
  T("« Contre un ami » : un membre arrive sur En direct", pf.dataset.ami === "direct" && !$("directNouveau").classList.contains("hide"));
  T("bloc de lancement : couleur, au hasard par defaut", [...$("directCouleur").children].map(b => b.dataset.v + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join() === "b,n,h*");
  T("cadences : Rapide (10+0, 5+3, 15+10) par defaut", [...$("directCats").children].map(b => b.textContent.trim()).join("|") === "Rapide|Classique" && [...$("directCadences").children].map(b => b.textContent).join() === "10+0,5+3,15+10");
  $("directCats").children[1].click();
  T("Classique : 30+0, 30+20, 60+0", [...$("directCadences").children].map(b => b.textContent).join() === "30+0,30+20,60+0" && w.eval("directCad") === 3);
  $("directCadences").children[1].click();
  d.querySelector('#directCouleur [data-v="b"]').click();
  $("btnDirectCreer").click();
  await attendre(200);
  T("« Inviter » sans pseudo : rien n'est cree, on le dit", w.__appels.length === 0 && /pseudo/.test($("directStatus").textContent) && !$("directStatus").classList.contains("hide"), $("directStatus").textContent);
  $("directPseudo").value = "Lea";
  $("btnDirectCreer").click();
  await attendre(200);
  T("« Inviter » : la partie est demandee avec la cadence, l'adversaire et la couleur", JSON.stringify(w.__appels) === JSON.stringify([["creer", 4, "Lea", "b"]]), JSON.stringify(w.__appels));
  w.__appels.length = 0;
  $("btnDirectLien").click();
  await attendre(200);
  T("« ou envoyer un lien » : creee sans inviter personne", JSON.stringify(w.__appels) === JSON.stringify([["creer", 4, null, "b"]]), JSON.stringify(w.__appels));
  /* En attente de l'adversaire : le resume de la partie. */
  w.eval("directId='aaaaaaaaaaaa';directRecu({t:'etat',id:'aaaaaaaaaaaa',n:1,cad:[1800,20],moi:'b',b:'Moi',nr:null,coups:[],tb:1800000,tn:1800000,maj:Date.now(),h:Date.now(),phase:'attente',fin:null,nulle:null,rev:{b:false,n:false},la:{b:true,n:false},inv:'Lea',elo:null})");
  await attendre(200);
  T("en attente : le resume « 30+20 | Tu joues les Blancs. »", $("directResume").textContent.replace(/\s+/g, " ") === "30+20 | Tu joues les Blancs.", $("directResume").textContent);
  T("le choix du haut disparait pendant la partie", pf.classList.contains("en-direct"));
  w.eval("directQuitter(true);directPanneau()");

  console.log("--- Contre un joueur en ligne ---");
  w.__appels.length = 0;
  w.eval("setMode('jouer')");
  $("jouerEnLigne").click();
  await attendre(300);
  T("la carte ouvre l'ecran de recherche", w.eval("mode") === "friend" && pf.dataset.ami === "hasard" && net($("directTitre").textContent) === "Contre un joueur en ligne", $("directTitre").textContent);
  T("le site masque couleur, adversaire et invitation ; il garde « Trouver un adversaire »", /\[data-ami="hasard"\] \.direct-ami[^{]*\{display:none\}/.test(html) && $("btnDirectHasard").closest(".direct-hasard") !== null && $("directCouleur").closest(".direct-ami") !== null && $("directPseudo").closest(".direct-ami") !== null && $("btnDirectCreer").closest(".direct-ami") !== null);
  $("directCats").children[0].click();
  $("btnDirectHasard").click();
  await attendre(200);
  T("« Trouver un adversaire » : recherche lancee a la cadence choisie, sans couleur", JSON.stringify(w.__appels) === JSON.stringify([["chercher", 0]]), JSON.stringify(w.__appels));
  w.eval("setMode('jouer')");
  $("jouerAmi").click();
  await attendre(200);
  T("revenir par « Contre un ami » remet l'ecran d'un ami", pf.dataset.ami === "direct" && net($("directTitre").textContent) === "Partie en direct");
  w.close();

  console.log("--- Invitation recue ---");
  T("la fenetre d'invitation dit la couleur de l'invite", /inv\.coul==="b"\|\|inv\.coul==="n"/.test(html.replace(/\s+/g, "")) || /inv\.coul/.test(html));

  console.log("--- A 360 px, dans les 10 langues ---");
  const dico = l => l === "en" ? {} : require(path.join(__dirname, "..", "langues", l, "app.js"));
  const tr = (k, l) => { const v = dico(l)[k]; return typeof v === "string" ? v : k; };
  const largeur = s => [...s].reduce((n, c) => n + (/[Ѐ-ӿ]/.test(c) ? 7.4 : /[A-ZÀ-ÞĞİŞ]/.test(c) ? 8 : /[ilI.,'’ ]/.test(c) ? 3.4 : 6.6), 0);
  for (const l of ["en", "fr", "es", "pt", "de", "ru", "it", "tr", "pl", "id"]) {
    /* Deux boutons par rangee : 150 px de texte chacun. Un bouton pleine largeur : 280 px a 13 px de corps. */
    const deux = ["Live", "By link", "Rapid", "Classical"].map(k => tr(k, l)).filter(s => largeur(s) > 150);
    const plein = ["Invite", "Find an opponent", "or send a link"].map(k => tr(k, l)).filter(s => largeur(s) * 13 / 12.5 > 280);
    T(l + " : choix du haut, familles de cadences et boutons tiennent sur une ligne", deux.length + plein.length === 0, deux.concat(plein).join(", "));
  }

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
