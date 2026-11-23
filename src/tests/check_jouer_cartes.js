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
  /* Refonte du 2026-11-22 : plus de bandeau En direct | Correspondance | Par lien. */
  T("« Contre un ami » : un visiteur arrive sur la partie par lien, sans bandeau au-dessus", w.eval("mode") === "friend" && p.dataset.ami === "lien" && !$("amiModes") && !$("amiModesPanel"));
  T("l'ecran s'appelle « Partie par lien », sans le mot « direct »", net($("amiStatusPanel").querySelector("h2").textContent) === "Partie par lien" && !/direct/i.test(net($("amiStatusPanel").textContent) + net($("amiNewGamePanel").textContent)));
  T("le bloc des membres est masque pour lui (regle de style), l'echiquier aussi", /#pane-friend\[data-ami="lien"\]:not\(\.en-direct\) #directPanel\{display:none\}/.test(html) && d.querySelector(".board-wrap").classList.contains("hide"));
  T("sous la partie par lien : ce qu'un compte apporte, et le bouton pour en creer un", !$("amiComptePanel").classList.contains("hide") && net($("amiComptePanel").querySelector(".eyebrow").textContent) === "Avec un compte gratuit" && !!$("amiComptePanel").querySelector("[data-vue-compte]") && /en direct à la pendule/.test(net($("amiComptePanel").textContent)));
  T("pas de retour « Inviter plutôt un membre » pour un visiteur", $("amiRetourMembre").classList.contains("hide"));
  T("le rythme tient en trois mots courts : 1 jour, 3 jours, 7 jours", [...$("dailyChips").children].map(b => net(b.textContent)).join("|") === "1 jour|3 jours|7 jours" && net($("dailyChips").parentNode.querySelector(".eyebrow").firstChild.textContent) === "Délai par coup", [...$("dailyChips").children].map(b => b.textContent).join("|"));
  T("une infobulle dit ce qu'est ce delai, et qu'ici rien ne le fait respecter", !!d.querySelector('#amiNewGamePanel .info-tip[aria-controls="tipAmiDelai"]') && /rien ne le fait respecter/.test(net($("tipAmiDelai").textContent)) && $("tipAmiDelai").classList.contains("hide"));
  /* Le beau bug : choisir un rythme ne cree pas de partie. */
  $("dailyChips").children[0].click();
  await attendre(200);
  T("choisir un rythme ne cree aucune partie : l'echiquier reste cache", w.eval("amiStarted") === false && d.querySelector(".board-wrap").classList.contains("hide") && w.eval("amiPace") === 1);
  /* Partie par lien : trois couleurs. */
  const coul = [...d.querySelectorAll("#amiColorBtns button")];
  T("partie par lien : Blancs, Noirs, Au hasard", coul.map(b => b.dataset.v).join() === "w,b,r" && coul.map(b => b.textContent.replace(/\s+/g, " ").trim()).join("|") === "Blancs|Noirs|Au hasard", coul.map(b => b.textContent).join("|"));
  $("btnAmiNew").click();
  await attendre(200);
  coul[2].click();
  await attendre(400);
  T("« Au hasard » lance la partie avec une couleur tiree", w.eval("amiStarted") === true && [w.eval("W"), w.eval("B")].includes(w.eval("amiColor")) && p.dataset.ami === "lien");
  T("l'echiquier de la partie par lien est montre", !d.querySelector(".board-wrap").classList.contains("hide"));
  T("la partie est marquee creee dans ce qui est garde", JSON.parse(w.localStorage.getItem("chang64:friend")).s === 1, w.localStorage.getItem("chang64:friend"));
  w.eval("setMode('jouer')"); await attendre(300);
  T("la partie par lien en cours est dans « Tes parties en cours », pour un visiteur aussi", !$("corrPanel").classList.contains("hide") && !!d.querySelector('#corrListe [data-s="lien"]') && /Partie par lien/.test(net($("corrListe").textContent)), net($("corrListe").textContent));
  d.querySelector('#corrListe [data-s="lien"]').click(); await attendre(300);
  T("un appui la rouvre", w.eval("mode") === "friend" && p.dataset.ami === "lien" && !d.querySelector(".board-wrap").classList.contains("hide"));
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
  T("« Contre un ami » : un membre arrive sur le bloc de lancement, titre « Contre un ami »", pf.dataset.ami === "direct" && !$("directNouveau").classList.contains("hide") && net($("directTitre").textContent) === "Contre un ami" && d.querySelector(".board-wrap").classList.contains("hide"));
  T("la cadence est le premier reglage, la couleur le deuxieme, l'adversaire le troisieme", [...$("directNouveau").querySelectorAll(":scope > .field")].map(f => (f.querySelector("#directCats") ? "cadence" : f.querySelector("#directCouleur") ? "couleur" : f.querySelector("#directPseudo") ? "adversaire" : "?")).join() === "cadence,couleur,adversaire");
  T("sous « Inviter » : « ou envoyer un lien », puis « Mon ami n'a pas de compte »", net($("btnDirectLien").textContent) === "ou envoyer un lien" && net($("btnAmiSansCompte").textContent) === "Mon ami n'a pas de compte" && !!($("btnDirectLien").compareDocumentPosition($("btnAmiSansCompte")) & 4));
  T("bloc de lancement : couleur, au hasard par defaut", [...$("directCouleur").children].map(b => b.dataset.v + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join() === "b,n,h*");
  /* Retours d'Alexandre sur les captures : infobulle de la cadence, recherche de membre visible. */
  {
    const bouton = d.querySelector('#directNouveau .info-tip[aria-controls="tipAmiCadence"]');
    T("une infobulle a cote du titre « Cadence » dit ce qu'est une cadence", !!bouton && net($("directCadenceTitre").textContent) === "Cadence" && $("tipAmiCadence").classList.contains("hide") && /à la pendule/.test(net($("tipAmiCadence").textContent)) && /Par correspondance/.test(net($("tipAmiCadence").textContent)));
    bouton.click();
    T("un appui l'ouvre", !$("tipAmiCadence").classList.contains("hide") && bouton.getAttribute("aria-expanded") === "true");
    bouton.click();
  }
  w.eval("cpApi=async(m,r)=>/^membres\\?q=/.test(r)?{s:200,j:{membres:['Lea','Leandre','Leo64']}}:{s:404,j:{}}");
  $("directPseudo").value = "Le";
  $("directPseudo").dispatchEvent(new w.Event("input", { bubbles: true }));
  await attendre(500);
  T("recherche de membre : des deux premieres lettres, les pseudos trouves en pastilles sous le champ", [...$("directTrouves").querySelectorAll("button.chip")].map(b => b.textContent).join("|") === "Lea|Leandre|Leo64" && $("directTrouves").previousElementSibling === $("directPseudo") && !d.querySelector("#directMembres"), $("directTrouves").innerHTML.slice(0, 120));
  $("directTrouves").querySelectorAll("button")[1].click();
  T("un appui sur une pastille remplit le champ et referme la liste", $("directPseudo").value === "Leandre" && $("directTrouves").children.length === 0);
  w.eval("cpApi=async()=>({s:200,j:{membres:[]}})");
  $("directPseudo").value = "Zz";
  $("directPseudo").dispatchEvent(new w.Event("input", { bubbles: true }));
  await attendre(500);
  T("aucun membre : c'est dit", /Aucun membre trouvé/.test(net($("directTrouves").textContent)), $("directTrouves").textContent);
  $("directPseudo").value = "L";
  $("directPseudo").dispatchEvent(new w.Event("input", { bubbles: true }));
  await attendre(500);
  T("une seule lettre : pas de recherche, la liste se vide", $("directTrouves").children.length === 0);
  $("directPseudo").value = "";
  T("toute rangee de familles de cadences a son enveloppe qui defile, sans barre (accueil et contre l'ordinateur compris)", [...d.querySelectorAll(".tc-cats")].length >= 3 && [...d.querySelectorAll(".tc-cats")].every(r => r.parentNode.classList.contains("defile")) && /\.defile>\.tc-cats\{[^}]*scrollbar-width:none/.test(html) && /\.defile>\.tc-cats::-webkit-scrollbar\{display:none\}/.test(html));
  T("les familles sont sur une seule rangee qui defile (pas un bloc sur deux lignes)", $("directCats").classList.contains("tc-cats") && $("directCats").parentNode.classList.contains("defile") && /\.defile>\.tc-cats button\{flex:1 0 auto\}/.test(html) && /\.tc-cats\{[^}]*overflow-x:auto/.test(html));
  T("cadences : Rapide (10+0, 10+5, 15+10) par defaut, comme contre l'ordinateur", [...$("directCats").children].map(b => b.textContent.trim()).join("|") === "Blitz|Rapide|Classique|Correspondance" && [...$("directCadences").children].map(b => b.textContent).join() === "10+0,10+5,15+10" && w.eval("TC_CATS.find(c=>c.id==='rapid').items.map(i=>i.join('+')).join()") === "10+0,10+5,15+10" && $("directCats").children[1].getAttribute("aria-pressed") === "true");
  $("directCats").children[0].click();
  T("Blitz : 3+2 puis 5+3, toujours avec increment ; 3+2 choisi et explique", [...$("directCadences").children].map(b => b.textContent).join() === "3+2,5+3" && w.eval("directCad") === 9 && net($("directCadenceNote").textContent) === "3 minutes chacun, plus 2 secondes ajoutées après chaque coup.", $("directCadenceNote").textContent);
  $("directCats").children[2].click();
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
  T("le titre et le sous-titre s'effacent pendant la partie", pf.classList.contains("en-direct"));
  w.eval("directQuitter(true);directPanneau()");
  /* La cadence choisie est retenue ; la couleur revient au hasard a chaque visite. */
  T("la derniere cadence est gardee sur l'appareil", w.localStorage.getItem("chang64:amiCadence") === "4", w.localStorage.getItem("chang64:amiCadence"));
  $("directCats").children[3].click();
  await attendre(100);
  T("Correspondance : trois delais, 3 jours choisi, plus de lien a envoyer", [...$("directCadences").children].map(b => net(b.textContent)).join("|") === "1 jour|3 jours|7 jours" && w.eval("directCad") === 7 && pf.dataset.corr === "1" && net($("directCadenceTitre").textContent) === "Délai par coup" && /#pane-friend\[data-corr="1"\] #directLienLigne\{display:none\}/.test(html));
  T("« Mon ami n'a pas de compte » reste propose par correspondance", !$("btnAmiSansCompte").closest("#directLienLigne"));
  $("btnAmiSansCompte").click();
  await attendre(200);
  T("il mene a la partie par lien, avec un retour vers l'invitation d'un membre", pf.dataset.ami === "lien" && !$("amiRetourMembre").classList.contains("hide") && net($("btnAmiRetourMembre").textContent) === "Inviter plutôt un membre" && $("amiComptePanel").classList.contains("hide"));
  $("btnAmiRetourMembre").click();
  await attendre(200);
  T("et le retour ramene au bloc de lancement", pf.dataset.ami === "direct" && !$("directNouveau").classList.contains("hide"));
  $("directCats").children[2].click(); $("directCadences").children[1].click();

  console.log("--- Contre un joueur en ligne ---");
  w.__appels.length = 0;
  w.eval("setMode('jouer')");
  $("jouerEnLigne").click();
  await attendre(300);
  T("la carte ouvre l'ecran de recherche", w.eval("mode") === "friend" && pf.dataset.ami === "hasard" && net($("directTitre").textContent) === "Contre un joueur en ligne", $("directTitre").textContent);
  T("le site masque couleur, adversaire et invitation ; il garde « Trouver un adversaire »", /\[data-ami="hasard"\] \.direct-ami[^{]*\{display:none\}/.test(html) && $("btnDirectHasard").closest(".direct-hasard") !== null && $("directCouleur").closest(".direct-ami") !== null && $("directPseudo").closest(".direct-ami") !== null && $("btnDirectCreer").closest(".direct-ami") !== null);
  $("directCats").children[1].click();
  $("btnDirectHasard").click();
  await attendre(200);
  T("« Trouver un adversaire » : recherche lancee a la cadence choisie, sans couleur", JSON.stringify(w.__appels) === JSON.stringify([["chercher", 0]]), JSON.stringify(w.__appels));
  w.eval("setMode('jouer')");
  $("jouerAmi").click();
  await attendre(200);
  T("revenir par « Contre un ami » remet l'ecran d'un ami", pf.dataset.ami === "direct" && net($("directTitre").textContent) === "Contre un ami");
  w.close();

  console.log("--- Le beau bug : une vieille partie par lien ne rouvre plus l'echiquier ---");
  /* Ce que gardait le navigateur d'Alexandre : un rythme touche un jour, ou une partie finie. */
  for (const [nom, garde] of [["un rythme choisi autrefois, sans partie", { m: [], c: 0, p: 3, r: null }], ["une partie par lien abandonnee", { m: [{ from64: 52, to64: 36, promo: 0 }], c: 0, p: 3, r: 0, s: 1 }]]) {
    w = await ouvrir("fr", { attente: 2400, avant(x) { MEMBRE(x); x.localStorage.setItem("chang64:friend", JSON.stringify(garde)); } });
    d = w.document; $ = id => d.getElementById(id);
    w.eval("setMode('jouer')"); await attendre(300);
    $("jouerAmi").click(); await attendre(400);
    T(nom + " : un membre arrive sur les reglages, pas sur l'echiquier", $("pane-friend").dataset.ami === "direct" && !$("directNouveau").classList.contains("hide") && d.querySelector(".board-wrap").classList.contains("hide") && net($("directTitre").textContent) === "Contre un ami", $("pane-friend").dataset.ami);
    T(nom + " : Rapide 10+0 la premiere fois", w.eval("directCat") === 1 && w.eval("directCad") === 0 && $("directCats").children[1].getAttribute("aria-pressed") === "true");
    w.close();
  }
  w = await ouvrir("fr", { attente: 2400, avant(x) { MEMBRE(x); x.localStorage.setItem("chang64:amiCadence", "9"); } });
  d = w.document; $ = id => d.getElementById(id);
  w.eval("setMode('jouer')"); $("jouerAmi").click(); await attendre(400);
  T("la cadence retenue revient a la visite suivante (Blitz 3+2)", w.eval("directCat") === 0 && w.eval("directCad") === 9 && $("directCats").children[0].getAttribute("aria-pressed") === "true" && [...$("directCouleur").children].find(b => b.getAttribute("aria-pressed") === "true").dataset.v === "h");
  w.close();

  console.log("--- Invitation recue ---");
  /* 2026-11-23 : « inv » est un nom local, raccourci a la construction depuis
     l'allegement du script. Le motif se lit dans la source ; la page garde
     les deux phrases. */
  T("la fenetre d'invitation dit la couleur de l'invite", /inv\.coul==="b"\|\|inv\.coul==="n"/.test(fs.readFileSync(path.join(__dirname, "..", "direct_ecran.js"), "utf8").replace(/\s+/g, "")) && /You play White\./.test(html) && /You play Black\./.test(html));

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
