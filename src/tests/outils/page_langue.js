/* Ouvre dans jsdom la page d'accueil de l'application dans une langue
   (2026-10-25). Outil partage par les suites, pas une suite lui-meme : il vit
   dans tests/outils/, que run_tests.js ne parcourt pas.

   Depuis le passage a six langues, chaque langue a sa page (/, /fr/, /es/...)
   et changer de langue recharge la page : une suite qui veut verifier
   l'interface en francais ouvre directement /fr/ au lieu de cliquer sur un
   bouton FR dans la page anglaise.

   ouvrir(lang, options) rend une promesse de la fenetre jsdom, apres
   options.attente millisecondes (1500 par defaut). Options :
   - fetch : true pour servir site/... aux fetch() de la page (sinon fetch
     reste en attente, comme hors ligne) ;
   - avant(window) : appele avant l'analyse du HTML ;
   - console : VirtualConsole a utiliser. */
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "..", "site");
function ouvrir(lang, o) {
  o = o || {};
  const { JSDOM, VirtualConsole } = require("jsdom");
  const rep = lang === "en" ? "" : lang + "/";
  const html = fs.readFileSync(path.join(SITE, rep, "index.html"), "utf8");
  return new Promise(res => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/" + rep,
      virtualConsole: o.console || new VirtualConsole(),
      beforeParse(w) {
        if (o.fetch) w.fetch = u => {
          const p = path.join(SITE, String(u).replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
          return fs.existsSync(p)
            ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))) })
            : Promise.resolve({ ok: false, status: 404 });
        };
        else w.fetch = () => new Promise(() => {});
        if (o.avant) o.avant(w);
      }
    });
    setTimeout(() => res(dom.window), o.attente == null ? 1500 : o.attente);
  });
}
module.exports = { ouvrir, SITE };
