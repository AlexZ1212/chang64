const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));

function open_(url) {
  const errors = [];
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url });
  dom.window.addEventListener("error", e => errors.push(e.message));
  return { dom, w: dom.window, errors };
}
const helpers = w => {
  const $ = id => w.document.getElementById(id);
  const cells = () => $("board").children;
  const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const isFlipped = () => {
    const co = cells()[0].querySelector(".co.r");
    return co ? co.textContent.trim() === "1" : false;
  };
  const cellFor = sq => {
    const f = "abcdefgh".indexOf(sq[0]), r = 8 - parseInt(sq[1], 10);
    return isFlipped() ? (7 - r) * 8 + (7 - f) : r * 8 + f;
  };
  const placement = () => {
    const flip = isFlipped(), grid = {};
    for (let i = 0; i < 64; i++) {
      const p = cells()[i].querySelector(".piece");
      if (!p) continue;
      const r0 = Math.floor(i / 8), f0 = i % 8;
      const r = flip ? 7 - r0 : r0, f = flip ? 7 - f0 : f0;
      const d = p.dataset.p;
      grid[r * 8 + f] = d[0] === "w" ? d[1].toUpperCase() : d[1];
    }
    let out = "";
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = grid[r * 8 + f];
        if (!p) { e++; continue; }
        if (e) { out += e; e = 0; }
        out += p;
      }
      if (e) out += e;
      if (r < 7) out += "/";
    }
    return out;
  };
  const play = async (from, to) => { click(cells()[cellFor(from)]); await wait(50); click(cells()[cellFor(to)]); await wait(250); };
  return { $, cells, click, isFlipped, cellFor, placement, play };
};

(async () => {
  // ---------- joueur A : cree la partie et joue 1.e4 ----------
  const A = open_("https://chang64.com/");
  await wait(400);
  const a = helpers(A.w);
  a.click(a.$("tab-friend"));
  await wait(300);
  console.log("Onglet Entre amis ouvert :", a.$("pane-friend").className.includes("hide") ? "ECHEC" : "OK");
  a.click(a.$("btnAmiNew"));
  await wait(200);
  console.log("Statut initial :", a.$("amiStatus").textContent);
  console.log("Boutons de partage du site :", a.$("siteShare").children.length);
  console.log("Libellés :", Array.from(a.$("siteShare").children).map(b => b.textContent).join(", "));

  await a.play("e2", "e4");
  const lien = a.$("amiLink").value;
  console.log("\nAprès 1.e4 —", a.$("amiStatus").textContent);
  console.log("Lien produit :", lien);
  console.log("Feuille A :", a.$("amiSheet").textContent.replace(/\s+/g, " ").trim());
  console.log("Boutons de partage de la partie :", Array.from(a.$("amiShare").children).map(b => b.textContent).join(", "));
  console.log("Note :", a.$("amiNote").textContent.slice(0, 60));
  console.log("Erreurs A :", A.errors.length ? A.errors.join(" | ") : "aucune");

  // ---------- joueur B : ouvre le lien ----------
  const B = open_(lien);
  await wait(600);
  const b = helpers(B.w);
  console.log("\n--- Joueur B ouvre le lien ---");
  console.log("Onglet actif Entre amis :", b.$("tab-friend").getAttribute("aria-selected"));
  console.log("Plateau retourné pour les Noirs :", b.isFlipped() ? "OK" : "ECHEC");
  const ref = new Engine.Game();
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "e2e4"));
  console.log("Position identique :", b.placement() === ref.fen().split(" ")[0] ? "OK" : "ECART");
  console.log("Statut B :", b.$("amiStatus").textContent);
  console.log("Feuille B :", b.$("amiSheet").textContent.replace(/\s+/g, " ").trim());

  // B repond 1...e5
  await b.play("e7", "e5");
  const lien2 = b.$("amiLink").value;
  console.log("Après 1...e5 :", b.$("amiStatus").textContent);
  console.log("Nouveau lien :", lien2);
  console.log("Annuler mon coup disponible :", b.$("btnAmiUndo").disabled ? "non" : "oui");
  b.click(b.$("btnAmiUndo"));
  await wait(200);
  console.log("Après annulation, lien revenu à :", b.$("amiLink").value === lien ? "OK" : "ECART");
  await b.play("e7", "e5");

  // ---------- joueur A rouvre le lien de B ----------
  const C = open_(b.$("amiLink").value);
  await wait(600);
  const c = helpers(C.w);
  console.log("\n--- Joueur A ouvre la réponse ---");
  console.log("Plateau côté Blancs :", c.isFlipped() ? "ECHEC" : "OK");
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "e7e5"));
  console.log("Position identique :", c.placement() === ref.fen().split(" ")[0] ? "OK" : "ECART");
  console.log("Statut :", c.$("amiStatus").textContent);
  console.log("Feuille :", c.$("amiSheet").textContent.replace(/\s+/g, " ").trim());

  // ---------- lien corrompu ----------
  const D = open_("https://chang64.com/#p=!!!!zzz");
  await wait(500);
  const d = helpers(D.w);
  console.log("\nLien corrompu — mode actif :", d.$("tab-play").getAttribute("aria-selected") === "true" ? "retour à la partie normale (OK)" : "?");
  console.log("Erreurs cumulées :", [...A.errors, ...B.errors, ...C.errors, ...D.errors].join(" | ") || "aucune");
  process.exit(0);
})();
