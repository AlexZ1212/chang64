/* Verification automatique de chang64.
   Lancement : node tests/check_sons_reprise.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Ce que ce test garde (2026-11-23, retour d'Alexandre) : sur iPhone, « les
   sons parfois se desactivent toujours ; si je verrouille mon telephone et que
   je reviens a la partie, le son revient ». Apres une interruption, Safari
   peut laisser le contexte audio se dire en marche alors qu'il est muet, ou
   bloque sans que la relance aboutisse. Le site ne se fie plus a l'etat seul :
   il fabrique un contexte NEUF au prochain vrai geste quand
   - son horloge n'avance plus alors qu'il se dit en marche ;
   - il ne tourne toujours pas une seconde apres une relance ;
   - sur iPhone et iPad, on revient sur la page, ou le contexte annonce une
     interruption.
   Et il ne le fait ni sans raison, ni en boucle (un appareil sans sortie
   audio a lui aussi une horloge arretee : cinq secours par page au plus).

   jsdom n'a pas de son : un faux AudioContext compte ce qui lui est demande. */
const { ouvrir } = require("./outils/page_langue.js");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const pause = ms => new Promise(r => setTimeout(r, ms));

/* Le faux son : chaque contexte cree est garde dans w.__ctx. Son horloge
   avance avec celle de la page (w.__heure) tant qu'il tourne et qu'on ne l'a
   pas fige. */
function fauxSon(w, iphone) {
  w.__ctx = []; w.__heure = 1000000;
  w.Date.now = () => w.__heure;
  if (iphone) Object.defineProperty(w.navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", configurable: true });
  const noeud = () => ({ connect() {}, start() {}, stop() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 },
    threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} });
  w.AudioContext = class {
    constructor() {
      this.state = "running"; this.sampleRate = 44100; this.destination = {}; this.sons = 0; this.relances = 0; this.ferme = false;
      this.ecoutes = []; this.fige = false; this.sourd = false; this.naissance = w.__heure; this.arret = 0;
      w.__ctx.push(this);
    }
    get currentTime() { return ((this.fige || this.state !== "running" ? this.arret || this.naissance : w.__heure) - this.naissance) / 1000; }
    figer() { this.arret = w.__heure; this.fige = true; }
    etat(s) { if (s !== "running") this.arret = w.__heure; this.state = s; this.ecoutes.forEach(f => f()); }
    addEventListener(t, f) { if (t === "statechange") this.ecoutes.push(f); }
    resume() { this.relances++; if (!this.sourd && this.state !== "closed") this.state = "running"; return Promise.resolve(); }
    close() { this.ferme = true; this.state = "closed"; return Promise.resolve(); }
    createDynamicsCompressor() { return noeud(); } createGain() { return noeud(); } createBiquadFilter() { return noeud(); }
    createOscillator() { return noeud(); }
    createBufferSource() { this.sons++; return noeud(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  };
}

(async () => {
  console.log("Ordinateur : le son ne se refait pas sans raison");
  let w = await ouvrir("fr", { avant: x => fauxSon(x) });
  let d = w.document;
  const geste = (x, type) => x.document.body.dispatchEvent(new x.Event(type || "click", { bubbles: true }));
  const avancer = (x, ms) => { x.__heure += ms; };
  const sonner = x => x.eval("SON.coup({flags:0},0)");
  const dernier = x => x.__ctx[x.__ctx.length - 1];

  T("aucun contexte audio avant le premier geste", w.__ctx.length === 0);
  geste(w);
  T("le premier appui en cree un", w.__ctx.length === 1 && dernier(w).state === "running");
  sonner(w);
  T("un coup sonne", dernier(w).sons === 1);
  for (let i = 0; i < 12; i++) { avancer(w, 2500); geste(w, "pointerdown"); geste(w, "touchend"); geste(w); }
  T("trente secondes de partie : toujours le meme contexte", w.__ctx.length === 1 && dernier(w).ferme === false);
  w.document.dispatchEvent(new w.Event("visibilitychange"));
  w.dispatchEvent(new w.Event("focus"));
  avancer(w, 5000); geste(w);
  T("retour sur la page, sur ordinateur : on garde le contexte qui marche", w.__ctx.length === 1);

  console.log("Le contexte se dit en marche mais son horloge est arretee");
  dernier(w).figer();
  avancer(w, 400); geste(w);
  T("moins d'une seconde : on attend d'en etre sur", w.__ctx.length === 1);
  avancer(w, 4000); geste(w, "pointerdown");
  T("un simple pointerdown ne refait rien (ce n'est pas un geste pour l'iPhone)", w.__ctx.length === 1);
  geste(w, "touchend");
  T("au vrai geste suivant, un contexte neuf", w.__ctx.length === 2 && w.__ctx[0].ferme === true && dernier(w).state === "running");
  geste(w);
  T("le clic du meme appui n'en refait pas un autre", w.__ctx.length === 2);
  sonner(w);
  T("et le coup sonne dans le neuf", dernier(w).sons === 1 && w.__ctx[0].sons === 1);

  console.log("Le contexte reste bloque malgre la relance");
  dernier(w).sourd = true; dernier(w).etat("interrupted");
  avancer(w, 4000); geste(w);
  T("premier appui : on tente la relance", w.__ctx.length === 2 && dernier(w).relances >= 1);
  sonner(w);
  T("pas de son tant qu'il ne tourne pas, et aucune erreur", dernier(w).sons === 1);
  avancer(w, 1500); geste(w);
  T("une seconde plus tard il ne tourne toujours pas : contexte neuf", w.__ctx.length === 3 && w.__ctx[1].ferme === true);
  sonner(w);
  T("le son est revenu", dernier(w).sons === 1);

  console.log("Pas de boucle sur un appareil dont l'horloge audio ne tourne jamais");
  for (let i = 0; i < 12; i++) { dernier(w).figer(); avancer(w, 4000); geste(w); avancer(w, 4000); geste(w); }
  T("cinq secours par page au plus", w.__ctx.length === 6, w.__ctx.length);
  T("les anciens sont fermes", w.__ctx.slice(0, -1).every(c => c.ferme));
  w.close();

  console.log("iPhone : un contexte neuf a chaque retour sur l'appli");
  w = await ouvrir("fr", { avant: x => fauxSon(x, true) });
  d = w.document;
  geste(w, "pointerdown"); geste(w, "touchend"); geste(w);
  T("premier appui : un seul contexte", w.__ctx.length === 1);
  for (let i = 0; i < 10; i++) { avancer(w, 3000); geste(w, "pointerdown"); geste(w, "touchend"); geste(w); }
  T("pendant la partie, toujours le meme", w.__ctx.length === 1);
  /* L'ecran se verrouille, puis on revient : le contexte se dit en marche. */
  d.dispatchEvent(new w.Event("visibilitychange"));
  avancer(w, 2000); geste(w, "pointerdown");
  T("retour sur la page, pointerdown : rien encore", w.__ctx.length === 1);
  geste(w, "touchend"); geste(w);
  T("au premier vrai geste, un contexte neuf, un seul", w.__ctx.length === 2 && w.__ctx[0].ferme === true);
  sonner(w);
  T("le coup sonne", dernier(w).sons === 1);
  avancer(w, 3000); geste(w, "touchend"); geste(w);
  T("l'appui suivant garde ce contexte", w.__ctx.length === 2);
  /* Une notification, le centre de controle : le contexte annonce une interruption, puis repart tout seul. */
  dernier(w).etat("interrupted"); dernier(w).etat("running");
  avancer(w, 4000); geste(w, "touchend");
  T("interruption annoncee, puis « en marche » : contexte neuf au geste suivant", w.__ctx.length === 3 && w.__ctx[1].ferme === true);
  w.dispatchEvent(new w.Event("pageshow"));
  avancer(w, 4000); geste(w, "touchend");
  T("retour par l'historique de l'appli (pageshow) : pareil", w.__ctx.length === 4);
  for (let i = 0; i < 8; i++) { d.dispatchEvent(new w.Event("visibilitychange")); avancer(w, 4000); geste(w, "touchend"); geste(w); }
  T("pas de plafond pour les retours : huit retours, huit contextes neufs", w.__ctx.length === 12 && w.__ctx.slice(0, -1).every(c => c.ferme), w.__ctx.length);
  d.dispatchEvent(new w.Event("visibilitychange"));
  avancer(w, 500); geste(w, "touchend");
  T("jamais deux contextes en moins de trois secondes", w.__ctx.length === 12);
  w.eval("sonOn=false"); sonner(w);
  T("sons coupes dans les Preferences : rien ne sonne", dernier(w).sons === 0);
  w.close();

  await pause(50);
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})();
