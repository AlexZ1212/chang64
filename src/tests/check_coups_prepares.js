/* Verification automatique de chang64.
   Lancement : node tests/check_coups_prepares.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-21, decisions d'Alexandre par QCM) : les coups
   prepares a l'avance, la piece saisie avant le coup adverse et les fleches
   au clic droit (premove.js), dans la page francaise ouverte par jsdom.
   - coups prepares contre l'ordinateur et dans les parties entre membres,
     pas dans la partie par lien ni les exercices ;
   - plusieurs a la suite : une file, jouee un coup a chaque tour ; l'echiquier
     montre les pieces a leur case d'arrivee, cases teintees ;
   - un coup devenu impossible fait tomber toute la file, sans rien jouer ;
   - toucher ailleurs ou clic droit : tout s'annule ; promotion = dame ;
   - une piece prise en main pendant le tour adverse reste en main ;
   - fleches et cercles au clic droit, partout sauf dans l'editeur, effaces
     par un clic gauche ; rien n'est envoye au serveur avant son tour. */
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ");

function ouvrirLocal() {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const s = { fils: [] };
  return new Promise(res => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8067/fr/", virtualConsole: new VirtualConsole(),
      beforeParse(w) {
        w.fetch = (u, o) => {
          if (String(u).includes("/api/partie/invitations")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ liste: [], corr: [] }) });
          if (String(u).includes("/api/partie/creer")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "abcdefghjkmn" }) });
          return new Promise(() => {});
        };
        w.WebSocket = class { constructor(u) { this.url = u; this.envois = []; s.fils.push(this); } send(m) { this.envois.push(m); } close() { if (this.onclose) this.onclose(); } };
      }
    });
    setTimeout(() => res(Object.assign(s, { w: dom.window })), 1500);
  });
}

(async () => {
  const p = await ouvrirLocal(), w = p.w, d = w.document;
  const $ = id => d.getElementById(id);
  const plateau = $("board");
  /* jsdom ne met pas en page : on donne a l'echiquier 400 px de cote. */
  plateau.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 });
  const i64 = nom => { const f = "abcdefgh".indexOf(nom[0]), r = 8 - (+nom[1]); return w.eval("flipped") ? (7 - r) * 8 + (7 - f) : r * 8 + f; };
  const cell = nom => plateau.children[i64(nom)];
  const clic = nom => cell(nom).click();
  const piece = nom => { const x = cell(nom).querySelector(".piece"); return x ? x.dataset.p : ""; };
  const file = () => w.eval("premoves.map(m=>preNom(m.from)+preNom(m.to)).join()");
  const teintes = () => [...plateau.children].map((c, i) => c.classList.contains("pre") ? i : -1).filter(i => i >= 0).length;
  const pt = nom => { const i = i64(nom); return { clientX: (i % 8 + 0.5) * 50, clientY: (Math.floor(i / 8) + 0.5) * 50 }; };
  const souris = (cible, type, nom, bouton) => { const e = new w.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, button: bouton || 0 }, pt(nom))); cible.dispatchEvent(e); return e; };
  const droit = (a, z) => { souris(plateau, "pointerdown", a, 2); souris(w, "pointerup", z, 2); };
  const calque = () => $("fleches") ? $("fleches").innerHTML : "";

  console.log("La marche des pieces (sans regarder ce qui gene)");
  T("cavalier, fou, tour, dame, roi, roque, pion", w.eval(`(() => {
    const g = new Game(), v = g.board, s = n => (8 - (+n[1])) * 16 + "abcdefgh".indexOf(n[0]), ok = (a, z) => preAtteint(v, s(a), s(z));
    return ok("g1","f3") && !ok("g1","g3") && ok("f1","a6") && !ok("f1","f3") && ok("a1","a8") && !ok("a1","b2") && ok("d1","h5") && ok("d1","d8") && !ok("d1","e3")
      && ok("e1","e2") && ok("e1","g1") && ok("e1","c1") && !ok("e1","e3") && ok("e2","e3") && ok("e2","e4") && ok("e2","d3") && !ok("e2","e5") && !ok("e2","e1") && ok("e7","e5") && ok("e7","f6") && !ok("e7","e8");
  })()`));
  T("une promotion preparee donne une dame", w.eval(`(() => { const v = Array.from(new Game("8/P7/8/8/8/8/8/k6K w - - 0 1").board); preAppliquer(v, { from: 16, to: 0 }); return v[0] === mk(Q, W) && !v[16]; })()`));
  T("un roque prepare deplace aussi la tour", w.eval(`(() => { const v = Array.from(new Game("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1").board); preAppliquer(v, { from: 116, to: 118 }); return pT(v[118]) === K && pT(v[117]) === R && !v[119] && !v[116]; })()`));

  console.log("Contre l'ordinateur");
  /* L'ordinateur joue le coup que le test lui dicte, quand le test le decide. */
  w.eval("prefAnnounce='moves';colorMode='w';myColor=W;tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})");
  await pause(200);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await pause(200); }
  w.eval("delaiOrdi=()=>600000;window.__rep='';botLivre=()=>game.moves().find(m=>game.uci(m)===window.__rep)");
  const ordi = async uci => { w.eval("window.__rep='" + uci + "';botMove()"); await pause(40); };
  const san = () => w.eval("sanList.join(' ')");
  T("a mon tour, rien n'est « prepare » : le clic joue", w.eval("preContexte()") === false);
  clic("e2"); clic("e4");
  T("mon coup est joue, l'ordinateur reflechit", san() === "e4" && w.eval("busy") === true && w.eval("preContexte()") === true);
  clic("g1");
  T("pendant son tour, je peux deja prendre une piece", w.eval("selected") === 118 && cell("g1").classList.contains("sel"));
  clic("f3");
  T("un second appui prepare le coup, sans le jouer", file() === "g1f3" && san() === "e4" && w.eval("game.history.length") === 1);
  T("l'echiquier montre la piece a sa case d'arrivee, cases teintees", piece("f3") === "wn" && piece("g1") === "" && cell("g1").classList.contains("pre") && cell("f3").classList.contains("pre") && teintes() === 2);
  T("la case dit sa piece aux lecteurs d'ecran", /cavalier/i.test(cell("f3").getAttribute("aria-label")) && !/cavalier/i.test(cell("g1").getAttribute("aria-label")), cell("f3").getAttribute("aria-label"));
  T("le coup prepare est annonce", net($("srAnnounce").textContent).trim() === "Coup préparé : g1 vers f3", $("srAnnounce").textContent);
  clic("f1"); clic("c4");
  T("plusieurs coups a la suite : une file", file() === "g1f3,f1c4" && piece("c4") === "wb" && piece("f1") === "" && teintes() === 4);
  clic("e1"); clic("g1");
  T("le troisieme part de la position preparee (roque, la tour suit)", file() === "g1f3,f1c4,e1g1" && piece("g1") === "wk" && piece("f1") === "wr" && piece("h1") === "");
  await ordi("e7e5");
  T("l'ordinateur joue : le premier coup de la file part", san() === "e4 e5 Nf3" && file() === "f1c4,e1g1" && w.eval("busy") === true, san() + " | " + file());
  T("les suivants restent montres", piece("c4") === "wb" && piece("g1") === "wk" && piece("f3") === "wn");
  await ordi("b8c6");
  await ordi("g8f6");
  T("un coup a chaque tour, dans l'ordre", san() === "e4 e5 Nf3 Nc6 Bc4 Nf6 O-O" && file() === "" && teintes() === 0, san());
  clic("a1"); clic("a5");
  T("un coup impossible aujourd'hui est accepte : la position aura change", file() === "a1a5");
  clic("d2"); clic("d3");
  await ordi("f8c5");
  T("devenu impossible a mon tour : toute la file tombe, rien n'est joue", san().split(" ").length === 8 && file() === "" && w.eval("busy") === false && w.eval("game.turn") === 0 && piece("a1") === "wr" && piece("d2") === "wp", san() + " | " + file());
  clic("d2"); clic("d3");
  T("et je joue normalement", /d3$/.test(san()) && w.eval("busy") === true, san());
  clic("b1"); clic("c3");
  clic("h4");
  T("toucher ailleurs annule tout", file() === "" && teintes() === 0 && piece("b1") === "wn" && w.eval("selected") === -1 && net($("srAnnounce").textContent).trim() === "Coups préparés annulés.", $("srAnnounce").textContent);
  clic("b1"); clic("c3");
  souris(plateau, "pointerdown", "e5", 2); souris(w, "pointerup", "e6", 2);
  T("le clic droit annule aussi, sans tracer de fleche", file() === "" && calque() === "");
  clic("c1");
  T("une piece prise en main pendant son tour…", w.eval("selected") === 114 && file() === "");
  await ordi("d7d6");
  T("…reste en main quand son coup arrive", w.eval("selected") === 114 && cell("c1").classList.contains("sel") && w.eval("busy") === false);
  clic("g5");
  T("et le coup se finit normalement", /Bg5$/.test(san()), san());
  /* Glisser pendant le tour adverse. */
  souris(plateau, "pointerdown", "b1"); souris(plateau, "pointermove", "c3"); souris(plateau, "pointerup", "c3");
  await pause(80);
  T("glisser une piece pendant son tour prepare le coup", file() === "b1c3" && piece("c3") === "wn" && !d.querySelector(".dragghost"), file());
  await ordi("h7h6");
  T("il part a mon tour", /Nc3$/.test(san()), san());
  souris(plateau, "pointerdown", "a2"); souris(plateau, "pointermove", "a3");
  await ordi("a7a6");
  souris(plateau, "pointerup", "a3");
  await pause(80);
  T("un glissement commence avant son coup et fini apres : coup ordinaire", /a3$/.test(san()) && file() === "", san() + " | " + file());
  w.eval("premoves=[{from:100,to:84}];preCleVue=preCle();setMode('puzzles')");
  T("changer d'ecran vide la file", file() === "" && w.eval("preContexte()") === false);

  console.log("Entre membres");
  w.eval("cp={pseudo:'Anna',cle:'anna',version:1,dev:'x',n:0,sync:0};setMode('friend');amiModeRegler('direct')");
  $("btnDirectLien").click();
  await pause(60);
  const fil = p.fils[p.fils.length - 1];
  const etat = plus => Object.assign({ t: "etat", id: "abcdefghjkmn", n: 1, cad: [180, 2], moi: "b", b: "Anna", nr: "Bob", coups: [], tb: 180000, tn: 180000, maj: Date.now(), h: Date.now(),
    phase: "jeu", fin: null, nulle: null, rev: { b: false, n: false }, la: { b: true, n: true }, elo: null, inv: null }, plus || {});
  const recevoir = e => fil.onmessage({ data: JSON.stringify(e) });
  const coupsEnvoyes = () => fil.envois.filter(m => /"coup"/.test(m)).map(m => JSON.parse(m).c).join();
  fil.onopen();
  recevoir(etat({ coups: ["e2e4"] }));
  T("pendant le tour de l'adversaire, c'est le moment des coups prepares", w.eval("preContexte()") === true);
  clic("g1"); clic("f3"); clic("f1"); clic("c4");
  T("deux coups prepares, rien n'est parti au serveur", file() === "g1f3,f1c4" && coupsEnvoyes() === "" && piece("f3") === "wn" && piece("c4") === "wb");
  recevoir(etat({ coups: ["e2e4", "e7e5"] }));
  T("son coup arrive : le premier part au serveur", coupsEnvoyes() === "g1f3" && file() === "f1c4", coupsEnvoyes());
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3"] }));
  T("la confirmation de mon coup ne fait rien partir de plus", coupsEnvoyes() === "g1f3" && file() === "f1c4" && piece("c4") === "wb");
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6"] }));
  T("au tour suivant, le second", coupsEnvoyes() === "g1f3,f1c4" && file() === "", coupsEnvoyes());
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] }));
  clic("d1"); clic("d5");
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"] }));
  T("un coup devenu impossible ne part pas : la file tombe", coupsEnvoyes() === "g1f3,f1c4" && file() === "" && piece("d1") === "wq");
  clic("d2"); clic("d3");
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3"] }));
  clic("c1");
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5"] }));
  T("une piece prise en main reste en main a l'arrivee de son coup", w.eval("selected") === 114 && cell("c1").classList.contains("sel"));
  clic("g5");
  T("et se joue d'un appui", /c1g5$/.test(coupsEnvoyes()), coupsEnvoyes());
  recevoir(etat({ coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5", "c1g5"] }));
  clic("b1"); clic("c3");
  recevoir(etat({ phase: "fin", coups: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5", "c1g5"], fin: { r: "1-0", m: "abandon" } }));
  T("la partie finit : la file est oubliee, la position est la vraie", file() === "" && w.eval("preContexte()") === false && piece("b1") === "wn" && teintes() === 0);
  w.eval("directQuitter(true)");

  console.log("La ou l'on n'attend personne");
  w.eval("setMode('friend');amiModeRegler('lien')");
  T("partie par lien : pas de coup prepare", w.eval("preContexte()") === false && w.eval("preMaCouleur()") === -1);
  w.eval("setMode('puzzles')");
  T("exercices : pas de coup prepare", w.eval("preContexte()") === false);

  console.log("Fleches et cercles au clic droit");
  w.eval("colorMode='w';myColor=W;setMode('play',{fresh:true})");
  await pause(200);
  if (!$("readyBanner").classList.contains("hide")) { $("readyStart").click(); await pause(200); }
  const menu = souris(plateau, "contextmenu", "e4", 2);
  T("le clic droit n'ouvre pas le menu du navigateur sur l'echiquier", menu.defaultPrevented);
  droit("e2", "e4");
  T("clic droit maintenu d'une case a une autre : une fleche", (calque().match(/<line/g) || []).length === 1 && (calque().match(/<polygon/g) || []).length === 1 && $("fleches").getAttribute("aria-hidden") === "true", calque());
  const x1 = +calque().match(/x1="([\d.]+)"/)[1];
  T("elle part du milieu de la case e2", Math.abs(x1 - 4.5) < 0.01 && /y1="6\.2/.test(calque()), calque());
  droit("g1", "f3");
  droit("d4", "d4");
  T("plusieurs fleches, et un cercle d'un clic droit sur place", (calque().match(/<line/g) || []).length === 2 && (calque().match(/<circle/g) || []).length === 1);
  droit("e2", "e4");
  T("refaire la meme fleche l'efface", (calque().match(/<line/g) || []).length === 1);
  {
    const css = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8"), regle = css.match(/\.fleches\{[^}]*\}/)[0];
    const zPiece = +css.match(/\.piece\{[^}]*z-index:(\d+)/)[1], z = +(regle.match(/z-index:(\d+)/) || [0, 0])[1], op = +(regle.match(/opacity:([\d.]+)/) || [0, 1])[1];
    T("le calque ne prend aucun clic", /pointer-events:none/.test(regle));
    T("les fleches passent au-dessus des pieces, avec de la transparence", z > zPiece && op >= 0.5 && op <= 0.8, z + " / " + zPiece + " / " + op);
  }
  w.eval("flipped=true;render()");
  T("echiquier retourne : les dessins suivent", Math.abs(+calque().match(/x1="([\d.]+)"/)[1] - 1.5) < 0.31, calque());
  w.eval("flipped=false;render()");
  clic("h4");
  T("un clic gauche sur l'echiquier efface tout", calque() === "" && w.eval("fleches.length+cercles.length") === 0);
  T("les fleches valent pendant une partie, et ne jouent rien", w.eval("game.history.length") === 0 && w.eval("gameStarted") === true);
  droit("a1", "a8");
  w.eval("setMode('puzzles')");
  T("changer d'ecran les efface", calque() === "");
  /* Dans jsdom aucun exercice n'est charge : on montre l'echiquier a la main. */
  d.querySelector(".board-wrap").classList.remove("hide");
  droit("b1", "c3");
  T("elles valent aussi dans les exercices", (calque().match(/<line/g) || []).length === 1);
  clic("h4");
  w.eval("setMode('edit')");
  droit("b1", "c3");
  T("pas dans l'editeur de position", calque() === "" && !souris(plateau, "contextmenu", "e4", 2).defaultPrevented);
  w.close();

  console.log("\n" + ok + " OK, " + ko + " FAIL");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL exception : " + (e && e.stack || e)); process.exit(1); });
