/* Maquettes des QCM du 24/11 (session ajustements-23-11) : injectees dans la
   vraie page servie par serveur_local.js, capturees a 360 px, puis reunies en
   planches. Usage : node maquettes.js http://localhost:<port> */
const path = require("path");
const SRC = path.join(__dirname, "..", "..", "src");
const { ouvrir } = require(path.join(SRC, "tests/outils/chrome_sans_fenetre.js"));
const sharp = require(path.join(SRC, "node_modules/sharp"));
const M = require(path.join(SRC, "badges-medailles.json"));
const B = process.argv[2], OUT = __dirname;
const nu = k => M[k][1].replace(/<g data-cale="1" transform="[^"]*">/, "<g>");
const glyphe = k => '<g transform="scale(' + (/data-accent|scale\(.6\)/.test(M[k][1]) ? 1.06 : .8) + ')">' + nu(k) + "</g>";
const CLES = { "Winning capture": "winning_capture", "Knight fork": "knight_fork", "Pawn fork": "pawn_fork", "Pin": "pin", "Skewer": "skewer",
  "Deflection": "deflection", "Double attack": "double_attack", "Quiet move": "quiet_move", "Back-rank mate": "back_rank_mate",
  "Mate in one": "mate_in_one", "Mate in two": "mate_in_two", "Mate in three": "mate_in_three" };
const GL = {}; for (const k in CLES) GL[k] = '<span class="picto petit" aria-hidden="true"><svg viewBox="-24 -24 48 48">' + glyphe("theme_" + CLES[k]) + "</svg></span>";
const etiquette = async (fichier, texte) => {
  const m = await sharp(fichier).metadata();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + m.width + '" height="90"><rect width="100%" height="100%" fill="#0f1514"/><text x="24" y="60" font-family="Arial" font-weight="700" font-size="40" fill="#e9b879">' + texte + "</text></svg>");
  return sharp({ create: { width: m.width, height: m.height + 90, channels: 4, background: "#0f1514" } }).composite([{ input: svg, top: 0, left: 0 }, { input: fichier, top: 90, left: 0 }]).png().toBuffer();
};
const planche = async (sortie, items) => {
  const bufs = []; for (const [f, t] of items) bufs.push(await etiquette(f, t));
  const metas = await Promise.all(bufs.map(b => sharp(b).metadata()));
  const W = metas.reduce((s, m) => s + m.width + 30, 30), H = Math.max(...metas.map(m => m.height)) + 60;
  let x = 30; const comp = bufs.map((b, i) => { const c = { input: b, top: 30, left: x }; x += metas[i].width + 30; return c; });
  await sharp({ create: { width: W, height: H, channels: 4, background: "#2a2f2e" } }).composite(comp).png().toFile(sortie);
};
(async () => {
  const c = await ouvrir({ largeur: 360, hauteur: 740, pause: 600 });
  const T = p => path.join(OUT, p);
  const neuf = async () => { await c.aller(B + "/fr/"); await c.js(`localStorage.clear();localStorage.setItem("chang64:lang","fr");1`); await c.aller(B + "/fr/"); await c.attendre(900); };
  await neuf();
  /* ---- Motifs ---- */
  const motifs = async () => { await c.js(`setMode("puzzles");document.getElementById("cardSolveMotifs").click();1`); await c.attendre(1400); await c.js(`scrollTo(0,0);1`); };
  await motifs(); await c.capture(T("motifs-c.png"));
  await c.js(`(function(G){document.querySelectorAll("#motifsGrid .motif-tuile").forEach(b=>{const k=b.dataset.motif;b.style.cssText="display:flex;align-items:center;gap:14px;text-align:left";const txt=document.createElement("span");while(b.firstChild)txt.appendChild(b.firstChild);b.insertAdjacentHTML("afterbegin",G[k]||"");b.appendChild(txt);});return 1})(${JSON.stringify(GL)})`);
  await c.attendre(500); await c.capture(T("motifs-a.png"));
  await motifs();
  await c.js(`(function(G){document.querySelectorAll("#motifsGrid .motif-grille").forEach(g=>g.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:10px");document.querySelectorAll("#motifsGrid .motif-tuile").forEach(b=>{const k=b.dataset.motif;b.style.cssText="display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;margin:0;padding:12px";b.insertAdjacentHTML("afterbegin",G[k]||"");});return 1})(${JSON.stringify(GL)})`);
  await c.attendre(500); await c.capture(T("motifs-b.png"));
  await planche(T("planche-motifs.png"), [[T("motifs-a.png"), "A : picto a gauche"], [T("motifs-b.png"), "B : grille, picto en haut"], [T("motifs-c.png"), "C : sans picto (aujourd'hui)"]]);
  /* ---- Navigation ---- */
  const RET = '<button type="button" style="display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:6px 0;margin:0 0 6px;color:var(--brass);font:inherit;font-size:14.5px;font-weight:600"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>%s</button>';
  const titreMotif = `document.getElementById("motifsTitle")`;
  await motifs();
  await c.js(`(function(){${titreMotif}.insertAdjacentHTML("beforebegin",${JSON.stringify(RET.replace("%s", "Résoudre"))});return 1})()`);
  await c.attendre(300); await c.capture(T("nav-a.png"));
  await neuf(); await motifs();
  await c.js(`(function(){${titreMotif}.insertAdjacentHTML("beforebegin",${JSON.stringify('<p style="margin:0 0 6px;font-size:13.5px;color:var(--sage)"><a style="color:var(--brass);font-weight:600;text-decoration:none">Résoudre</a> &nbsp;›&nbsp; Travailler un motif</p>')});return 1})()`);
  await c.attendre(300); await c.capture(T("nav-b.png"));
  const ordi = async () => { await neuf(); await c.js(`setMode("jouer");1`); await c.attendre(500); await c.js(`document.getElementById("jouerOrdi").click();scrollTo(0,0);1`); await c.attendre(900); };
  await ordi();
  const entete = RET.replace("%s", "Jouer") + '<h2 style="margin:0 0 14px;font-family:\'Source Serif 4\',Georgia,serif;font-size:26px">Contre l’ordinateur</h2>';
  await c.js(`(function(){const p=document.getElementById("settingsPanel");p.insertAdjacentHTML("afterbegin",${JSON.stringify(entete)});return 1})()`);
  await c.attendre(400); await c.capture(T("nav-ordi.png"));
  await planche(T("planche-navigation.png"), [[T("nav-a.png"), "A : bouton Retour en haut"], [T("nav-b.png"), "B : fil d'Ariane"], [T("nav-ordi.png"), "A, sur Contre l'ordinateur"]]);
  /* ---- Niveaux de l'ordinateur ---- */
  const niveaux = async (noms, f) => {
    await c.js(`(function(N){const s=document.getElementById("segLevel");const w=document.createElement("div");w.className="defile has-scroll-right";w.innerHTML='<div class="tc-cats" style="overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap">'+N.map((n,i)=>'<button aria-pressed="'+(i===1)+'" style="flex:1 0 auto;display:flex;flex-direction:column;align-items:center;line-height:1.25;padding:8px 14px"><span>'+n[0]+'</span><span class="seg-elo">'+n[1]+'</span></button>').join("")+'</div>';s.replaceWith(w);return 1})(${JSON.stringify(noms)})`);
    await c.attendre(400); await c.capture(T(f));
  };
  await ordi(); await c.capture(T("niveaux-avant.png"));
  await niveaux([["Tout doux", "400"], ["Débutant", "700"], ["Tranquille", "1100"], ["Sérieux", "1600"], ["Coriace", "1900"]], "niveaux-a.png");
  await ordi(); await niveaux([["Débutant", "400"], ["Amateur", "700"], ["Confirmé", "1100"], ["Sérieux", "1600"], ["Coriace", "1900"]], "niveaux-b.png");
  await ordi(); await niveaux([["Pion", "400"], ["Cavalier", "700"], ["Fou", "1100"], ["Tour", "1600"], ["Dame", "1900"]], "niveaux-c.png");
  await planche(T("planche-niveaux.png"), [[T("niveaux-a.png"), "A : un niveau sous Debutant"], [T("niveaux-b.png"), "B : ta proposition"], [T("niveaux-c.png"), "C : les pieces"], [T("niveaux-avant.png"), "Aujourd'hui"]]);
  /* ---- Sous-menus du menu ---- */
  await neuf();
  await c.js(`localStorage.setItem("chang64:compte",JSON.stringify({pseudo:"Alex",cle:"alex",version:1,dev:"abc123",n:0,sync:Date.now()}));1`); await c.aller(B + "/fr/"); await c.attendre(900);
  await c.js(`menuOuvrir();menuVue("compte");1`); await c.attendre(500);
  await c.js(`try{cpEtatSync="";cp.sync=Date.now();cpVue("connecte")}catch(e){};1`); await c.attendre(500);
  await c.capture(T("sous-menu-avant.png"));
  await c.js(`(function(){const ic={};document.querySelectorAll("#menuTiroir .tiroir-lien>svg.tiroir-ico").forEach(s=>{const t=s.parentNode.textContent.trim();ic[t]=s.outerHTML});const pick=re=>{for(const k in ic)if(re.test(k))return ic[k];return ""};const map=[[/profil/,/compte/],[/appareil/,/appareil/],[/pseudo/,/Meilleurs/],[/code/,/Confidentialit/],[/secours/,/Réinitialiser/],[/Télécharger/,/Inviter/],[/Supprimer/,/Réinitialiser/],[/déconnecter|Se déco/,/Langue/]];document.querySelectorAll("#menuCompteVue .tiroir-lien").forEach(b=>{if(b.querySelector("svg"))return;const t=b.textContent;for(const [a,s] of map)if(a.test(t)){b.insertAdjacentHTML("afterbegin",pick(s));break;}});return 1})()`);
  await c.attendre(300); await c.capture(T("sous-menu-apres.png"));
  await planche(T("planche-sous-menus.png"), [[T("sous-menu-apres.png"), "A : avec pictos"], [T("sous-menu-avant.png"), "B : sans picto (aujourd'hui)"]]);
  await c.fermer();
})().catch(e => { console.error(e); process.exit(1); });
