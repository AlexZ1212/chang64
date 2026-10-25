/* Verification automatique de chang64.
   Lancement : node tests/check_ux_suite.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Suite de l'audit UX du 2026-10-24, mesure dans Chrome a six tailles :
   - accueil : "Jouer maintenant" etait sous la ligne de flottaison (724 px
     pour 667 sur iPhone SE, 789 pour 768 sur un portable) ; les boutons
     passent avant la cadence ;
   - Jouer et Inviter : plateau borne par la hauteur, a partir de 600 px de
     large (sur iPad, la pendule du joueur passait sous le bas de l'ecran) ;
   - ecran tactile : zone de 44 px autour des petites cibles.
   jsdom ne calcule pas la mise en page : on garde l'ordre et les regles,
   les positions ont ete mesurees dans Chrome. */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n").replace(/\s+/g, " ");

console.log("\n--- Accueil ---");
const iPlay = html.indexOf('id="heroPlay"'), iCadence = html.indexOf('class="tc-block"');
T("\"Jouer maintenant\" avant la cadence", iPlay > 0 && iCadence > 0 && iPlay < iCadence);
T("les deux boutons restent dans le meme bloc", /<div class="cta">\s*<button class="btn primary" id="heroPlay">[\s\S]*?id="heroPuzzle"/.test(html));
T("espace sous les boutons", /\.hero \.cta\{[^}]*margin-bottom:22px/.test(css));

console.log("\n--- Jouer et Inviter ---");
T("bureau : plateau borne par la hauteur visible", /@media ?\(min-width:861px\) ?\{ ?#appLayout\[data-mode="play"\] \.board-frame,#appLayout\[data-mode="friend"\] \.board-frame\{max-width:calc\(100vh - 360px\);max-width:calc\(100svh - 360px\)/.test(css));
T("tablette : idem, 300 px au minimum", /@media ?\(min-width:600px\) and \(max-width:860px\) ?\{ ?#appLayout\[data-mode="play"\] \.board-frame,#appLayout\[data-mode="friend"\] \.board-frame\{max-width:max\(300px,calc\(100vh - 360px\)\)/.test(css));
T("telephone : pas de bornage pour Jouer", !/@media ?\(max-width:860px\) ?\{ ?#appLayout\[data-mode="play"\]/.test(css));

console.log("\n--- Ecran tactile ---");
const bloc = (css.match(/@media ?\(pointer:coarse\) ?\{(.*?\}) ?\}/) || [])[1] || "";
T("un bloc pointer:coarse existe", !!bloc);
for (const sel of [".tabs button::after", ".tc-cats button::after", ".chip::after", ".langswitch button::after", ".info-tip::after"])
  T(sel + " : zone de 44 px", bloc.includes(sel) && /height:44px/.test(bloc));
T("lien du calendrier agrandi", /#calFullLink\{display:inline-block;padding:15px 0\}/.test(bloc));

console.log("\n--- En-tete compact en partie, petit telephone (2026-10-25) ---");
/* Mesure dans le navigateur a 375 x 548 (iPhone SE dans Safari) : pendule du
   joueur a 546-602 avant, 490-538 apres, plateau inchange (325 px). */
const compact = (css.match(/@media ?\(max-width:599px\) and \(max-height:700px\) ?\{(.*?\}) ?\}/) || [])[1] || "";
T("bloc limite aux petits ecrans, en largeur ET en hauteur", !!compact);
T("logo et langue masques dans Jouer et Inviter", /body\[data-mode="play"\] header>\.brand/.test(compact) && /body\[data-mode="friend"\] header>\.langswitch/.test(compact) && /display:none/.test(compact));
T("la barre d'onglets reste (pas masquee)", !/header>\.tabs|header>nav/.test(compact));
T("ligne des coups apres la pendule du joueur", /#boardTools[^{]*\{order:1\}/.test(compact));
{
  const jd = require("jsdom");
  const dom = new jd.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/", virtualConsole: new jd.VirtualConsole(),
    beforeParse(w) { w.fetch = () => new Promise(() => {}); } });
  const d = dom.window.document;
  const mode = () => d.body.dataset.mode;
  d.getElementById("tab-play").click();
  T("body[data-mode] = play dans Jouer", mode() === "play", mode());
  d.getElementById("tab-explore").click();
  T("body[data-mode] suit aussi Explorer (setMode de ui2.js)", mode() === "explore", mode());
  dom.window.close();
}

console.log("\n--- Cache des SVG (2026-10-25) ---");
/* Avec max-age=604800 seul, Cloudflare gardait les .svg 7 jours malgre un
   nouveau deploiement (og/home.svg annoncait encore 108868). */
const headers = fs.readFileSync(path.join(__dirname, "..", "site", "_headers"), "utf8");
T("SVG : un jour au navigateur, 5 minutes au CDN", /\/\*\.svg\s+Cache-Control: public, max-age=86400, s-maxage=300/.test(headers));

console.log("\n--- Barre d'onglets equilibree (2026-10-25) ---");
/* Mesure dans le navigateur : 5 x 210 px a 1280 px de large ; a 375 et
   360 px, chaque libelle reste entier et rien ne defile. */
T("onglets de meme largeur (flex 1 1 0)", /\.tabs button\{flex:1 1 0\}/.test(css));

console.log("\n--- Regarder retire (2026-10-25) ---");
T("plus d'onglet ni de panneau Regarder", !/id="tab-watch"|id="pane-watch"/.test(html));
T("plus de cadre YouTube autorise", !/youtube/i.test(headers));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
