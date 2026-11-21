/* Outils partages par les tests du clavier et de « Tes parties » (2026-11-21).
   Pas une suite : run_tests.js ne parcourt pas tests/outils/.

   presser(w, touche, cible, plus) : envoie un keydown comme le ferait le
     navigateur, sur la cible (le corps de la page par defaut), et rend
     l'evenement pour lire defaultPrevented.
   espionSons(w) : compte les sons de coup joues par la page (SON.coup).
   ouvrirDirect(reponseCreer) : la page francaise sur un poste de
     developpement, avec un faux serveur de parties en direct que le test
     pilote (meme montage que check_partie_ecran.js).
   etat(plus) : un etat de partie en direct tel que le serveur l'envoie. */
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "..", "site");

function presser(w, touche, cible, plus) {
  const e = new w.KeyboardEvent("keydown", Object.assign({ key: touche, bubbles: true, cancelable: true }, plus || {}));
  (cible || w.document.body).dispatchEvent(e);
  return e;
}
function espionSons(w) {
  w.eval("window.__sonsCoup=0;{const c=SON.coup;SON.coup=function(){window.__sonsCoup++;return c.apply(SON,arguments);};}");
  return () => w.eval("window.__sonsCoup");
}
function ouvrirDirect(reponseCreer) {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const html = fs.readFileSync(path.join(SITE, "fr", "index.html"), "utf8");
  const fils = [], appels = [];
  return new Promise(res => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8067/fr/", virtualConsole: new VirtualConsole(),
      beforeParse(w) {
        w.fetch = (u, o) => {
          if (String(u).includes("/api/partie/invitations")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ liste: [] }) });
          if (String(u).includes("/api/partie/creer")) { appels.push(JSON.parse(o.body)); const r = reponseCreer(); return Promise.resolve({ ok: r.s === 200, status: r.s, json: () => Promise.resolve(r.j) }); }
          return new Promise(() => {});
        };
        w.WebSocket = class { constructor(u) { this.url = u; this.envois = []; fils.push(this); } send(m) { this.envois.push(m); } close() { if (this.onclose) this.onclose(); } };
      }
    });
    setTimeout(() => res({ w: dom.window, fils, appels }), 1500);
  });
}
const etat = plus => Object.assign({ t: "etat", id: "abcdefghjkmn", n: 1, cad: [600, 0], moi: "b", b: "Anna", nr: "Bob", coups: [], tb: 600000, tn: 600000, maj: Date.now(), h: Date.now(), phase: "debut", fin: null, nulle: null, rev: { b: false, n: false }, la: { b: true, n: true } }, plus || {});

module.exports = { presser, espionSons, ouvrirDirect, etat, SITE };
