/* Verification automatique de chang64.
   Lancement : node tests/check_bandeau_recul.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-23, signale par Alexandre) : pendant une
   partie contre l'ordinateur sur son iPhone, l'echiquier est revenu en arriere
   tout seul, au lieu de rester sur le dernier coup. CELA NE DOIT JAMAIS
   ARRIVER, dans aucune sorte de partie.

   La cause : le bandeau de coups sait deplacer l'echiquier quand on le fait
   defiler (voulu pour relire une partie finie). Le garde-fou qui l'interdit
   pendant une partie regardait aussi l'etat des parties par lien : une
   vieille partie par lien abandonnee, gardee en memoire sur l'appareil, le
   faisait tomber. Sur un navigateur sans l'evenement scrollend, le
   recentrage du bandeau apres chaque coup ramenait alors l'echiquier quelques
   coups en arriere.

   Deux protections, gardees ici l'une et l'autre :
   1. pendant une partie en cours, aucun defilement du bandeau ne deplace
      l'echiquier, quoi qu'il y ait en memoire ;
   2. hors partie, seul un defilement fait par la personne (doigt, molette,
      souris) le deplace, jamais un defilement lance par le site.

   jsdom ne met rien en page : les positions des puces sont simulees. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = await ouvrir("fr");
  const d = w.document, $ = id => d.getElementById(id), cache = id => $(id).classList.contains("hide");
  const vu = () => w.eval("reviewPly");
  const coup = uci => w.eval("playUser(game.moves().find(m=>game.uci(m)==='" + uci + "'))");

  /* Mise en page simulee : chaque puce fait 60 px de large, le bandeau 300 ;
     son defilement est une simple valeur, que les scrollTo du site ecrivent. */
  const bandeau = $("navScroll");
  let gauche = 0;
  Object.defineProperty(bandeau, "scrollLeft", { get: () => gauche, set: v => { gauche = v; }, configurable: true });
  Object.defineProperty(bandeau, "scrollWidth", { get: () => bandeau.querySelectorAll("[data-ply]").length * 60, configurable: true });
  Object.defineProperty(bandeau, "clientWidth", { get: () => 300, configurable: true });
  /* Un recentrage du site : il arrive, puis le navigateur dit qu'il a fini
     (scrollend), ou bien le delai de repli de 400 ms passe. */
  bandeau.scrollTo = o => { gauche = o.left; setTimeout(() => bandeau.dispatchEvent(new w.Event("scrollend")), 30); };
  const rect = (l, r) => ({ left: l, right: r, top: 0, bottom: 30, width: r - l, height: 30 });
  const origine = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this === bandeau) return rect(0, 300);
    if (this.parentElement === bandeau && this.dataset.ply !== undefined) { const i = +this.dataset.ply; return rect(i * 60 - gauche, i * 60 + 60 - gauche); }
    return origine.call(this);
  };
  /* Le bandeau defile : la valeur change, puis l'evenement part. */
  const defiler = async (x, geste) => {
    await pause(450);   /* un recentrage precedent est termine */
    if (geste) bandeau.dispatchEvent(new w.Event(geste));
    gauche = x;
    bandeau.dispatchEvent(new w.Event("scroll"));
    await pause(260);   /* la synchro attend 150 ms de silence */
  };

  console.log("Partie contre l'ordinateur en cours");
  w.eval("prefAnnounce='moves';colorMode='w';myColor=W;tcCat='rapid';tcIdx=0;setMode('play',{fresh:true})");
  await pause(200);
  if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
  coup("e2e4"); await pause(500);
  coup("g1f3"); await pause(500);
  coup("f1c4"); await pause(500);
  const n = w.eval("game.history.length");
  T("six coups joues, la partie continue", n === 6 && w.eval("partieEnCours()") === true && vu() === null, n);
  T("le bandeau ecoute les gestes de la personne", bandeau.navGesteEcoute === true);

  await defiler(0);
  T("le bandeau defile de lui-meme : l'echiquier reste sur le dernier coup", vu() === null);
  await defiler(60, "touchstart");
  T("meme tire au doigt, il ne deplace pas une partie en cours", vu() === null && w.eval("game.history.length") === 6);
  await defiler(120, "wheel");
  T("ni a la molette", vu() === null);

  console.log("Une vieille partie par lien abandonnee est restee en memoire");
  w.eval("amiResigned=W");
  T("le garde-fou tient quand meme : la partie contre l'ordinateur est vivante", w.eval("partieVivante()") === true && w.eval("partieEnCours()") === true);
  await defiler(0);
  T("defilement du site : l'echiquier ne recule pas", vu() === null);
  await defiler(60, "touchstart");
  T("defilement au doigt : il ne recule pas non plus", vu() === null);
  /* Le cas vu sur l'iPhone : un coup joue, le bandeau se recentre longuement,
     et des evenements de defilement arrivent encore apres. */
  coup("d2d3"); await pause(120);
  for (let i = 0; i < 6; i++) { gauche = 20 * i; bandeau.dispatchEvent(new w.Event("scroll")); await pause(90); }
  await pause(700);
  T("un coup joue puis un long recentrage : toujours le dernier coup", vu() === null && w.eval("game.history.length") === 8 && cache("retourPartie"), vu());
  T("regarder un coup passe reste possible en touchant une puce", (bandeau.querySelector('[data-ply="2"]').click(), vu()) === 2 && !cache("retourPartie"));
  await defiler(0);
  T("et le defilement qui suit ne change pas le coup regarde", vu() === 2);
  w.eval("exitReview()");
  w.eval("amiResigned=null");

  console.log("Partie finie : le bandeau se parcourt, a la main seulement");
  $("btnResign").click(); $("btnResign").click();
  await pause(200);
  T("abandon : la partie est finie", w.eval("partieEnCours()") === false && w.eval("partieVivante()") === false && vu() === null);
  await defiler(60);
  T("un defilement lance par le site ne deplace toujours rien", vu() === null);
  await defiler(120, "touchstart");
  T("tire au doigt, il montre la premiere position visible", vu() === 2, vu());
  await defiler(240);
  T("l'elan du glissement continue de compter", vu() === 4, vu());
  bandeau.querySelector('[data-ply="6"]').click();
  T("une puce touchee montre ce coup", vu() === 6);
  await defiler(0);
  T("le recentrage qui suit n'est pas un geste : l'echiquier reste sur ce coup", vu() === 6, vu());
  await defiler(60, "mousedown");
  T("a la souris, le bandeau reprend la main", vu() === 1, vu());

  console.log("Une synchro en attente ne rattrape pas une nouvelle partie");
  bandeau.dispatchEvent(new w.Event("touchstart"));
  gauche = 180; bandeau.dispatchEvent(new w.Event("scroll"));
  w.eval("colorMode='w';myColor=W;setMode('play',{fresh:true})");
  await pause(200);
  if (!cache("readyBanner")) { $("readyStart").click(); await pause(200); }
  coup("e2e4"); await pause(500);
  T("nouvelle partie : l'echiquier est sur le dernier coup", w.eval("partieEnCours()") === true && vu() === null && w.eval("game.history.length") === 2, vu());
  await defiler(0, "touchstart");
  T("et il y reste", vu() === null);

  console.log("Partie par lien entre amis");
  w.eval("setMode('friend');amiStarted=true;amiResigned=null;amiMoves=[];rebuildAmi();showAmi()");
  await pause(200);
  for (const u of ["e2e4", "e7e5", "g1f3", "b8c6"]) w.eval("playAmi(game.moves().find(m=>game.uci(m)==='" + u + "'))");
  await pause(200);
  T("quatre coups joues, partie en cours", w.eval("partieEnCours()") === true && w.eval("amiGame.history.length") === 4 && vu() === null);
  await defiler(0);
  await defiler(60, "touchstart");
  T("le bandeau ne deplace pas l'echiquier, defile par le site ou au doigt", vu() === null);
  w.eval("amiResigned=B;showAmi()");
  await pause(100);
  await defiler(120, "touchstart");
  T("partie par lien finie : seuls les puces et le clavier la parcourent", vu() === null);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
