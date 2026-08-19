const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const PUZZLES = JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"), "utf8"));
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = (l, ok, x) => console.log((ok ? "  ok  " : " FAIL ") + l + (x ? " — " + x : ""));

function open_(url) {
  const errors = [];
  /* Le livre d'ouvertures est desormais charge a la demande via fetch.
     jsdom n'a pas de reseau : on sert le fichier depuis le disque, exactement
     comme le ferait Cloudflare, sinon la detection d'ouverture ne peut pas
     fonctionner et le test echoue sur un faux negatif. */
  const SITE = require("path").join(__dirname, "site");
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url,
    beforeParse(w) {
      w.fetch = u => {
        const p = SITE + String(u).replace(/^https?:\/\/[^/]+/, "");
        return fs.existsSync(p)
          ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))) })
          : Promise.resolve({ ok: false, status: 404 });
      };
    } });
  dom.window.addEventListener("error", e => errors.push(e.message));
  dom.window.URL.createObjectURL = () => "blob:test";
  dom.window.URL.revokeObjectURL = () => {};
  return { dom, w: dom.window, errors };
}
const H = w => {
  const $ = id => w.document.getElementById(id);
  const cells = () => $("board").children;
  const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const isFlipped = () => { const c = cells()[0].querySelector(".co.r"); return c ? c.textContent.trim() === "1" : false; };
  const cellFor = sq => { const f = "abcdefgh".indexOf(sq[0]), r = 8 - parseInt(sq[1], 10); return isFlipped() ? (7 - r) * 8 + (7 - f) : r * 8 + f; };
  const placement = () => {
    const flip = isFlipped(), grid = {};
    for (let i = 0; i < 64; i++) {
      const p = cells()[i].querySelector(".piece"); if (!p) continue;
      const r0 = Math.floor(i / 8), f0 = i % 8;
      const r = flip ? 7 - r0 : r0, f = flip ? 7 - f0 : f0;
      const d = p.dataset.p;
      grid[r * 8 + f] = d[0] === "w" ? d[1].toUpperCase() : d[1];
    }
    let out = "";
    for (let r = 0; r < 8; r++) { let e = 0;
      for (let f = 0; f < 8; f++) { const p = grid[r * 8 + f]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } out += p; }
      if (e) out += e; if (r < 7) out += "/"; }
    return out;
  };
  const play = async (a, b) => { click(cells()[cellFor(a)]); await wait(50); click(cells()[cellFor(b)]); await wait(900); };
  const cur = () => PUZZLES.find(p => p.fen.split(" ")[0] === placement());
  const key = k => w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));
  return { $, cells, click, isFlipped, cellFor, placement, play, cur, key, w };
};

(async () => {
  const A = open_("https://chang64.com/");
  await wait(600);
  const a = H(A.w);

  console.log("PGN IMPORT + OPENINGS");
  a.click(a.$("tab-play")); await wait(500);
  a.$("pgnIn").value = '[Event "x"]\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 *';
  /* Le livre d'ouvertures est charge a la demande : attendre une duree fixe
     echouait sous charge sans qu'aucun defaut n'existe. On attend que le
     libelle soit renseigne, jusqu'a un plafond raisonnable. */
  a.click(a.$("btnPgnLoad")); await wait(300);
  {
    const jusqua = Date.now() + 5000;
    while (!(a.$("opening").textContent || "").trim() && Date.now() < jusqua) await wait(120);
  }
  T("pgn loaded", /Loaded 12 half-moves/.test(a.$("pgnMsg").textContent), a.$("pgnMsg").textContent);
  T("opening detected", /Sicilian/.test(a.$("opening").textContent), a.$("opening").textContent);
  T("scoresheet filled", a.$("sheet").querySelectorAll(".sheet-row").length === 6);

  console.log("\nMOVE NAVIGATION");
  a.click(a.$("navStart")); await wait(250);
  T("jump to start", a.placement() === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", a.placement().slice(0, 20));
  T("nav note updated", /Reviewing move 0/.test(a.$("navNote").textContent), a.$("navNote").textContent);
  a.click(a.$("navNext")); await wait(200);
  a.click(a.$("navNext")); await wait(200);
  const ref = new Engine.Game();
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "e2e4"));
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "c7c5"));
  T("stepped forward twice", a.placement() === ref.fen().split(" ")[0]);
  a.key("ArrowRight"); await wait(200);
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "g1f3"));
  T("arrow key steps forward", a.placement() === ref.fen().split(" ")[0]);
  a.key("End"); await wait(250);
  T("End returns to live", /Live position/.test(a.$("navNote").textContent), a.$("navNote").textContent);
  a.click(a.$("sheet").querySelectorAll("[data-ply]")[1]); await wait(250);
  T("clicking a move jumps there", /Reviewing move 2/.test(a.$("navNote").textContent), a.$("navNote").textContent);
  a.key("End"); await wait(200);

  console.log("\nANALYSIS");
  a.click(a.$("btnAnalyse"));
  await wait(9000);
  T("analysis finished", !a.$("analysisOut").className.includes("hide"));
  T("accuracy shown", /%$/.test(a.$("accScore").textContent), a.$("accScore").textContent);
  T("graph drawn", a.$("evalGraph").innerHTML.includes("<svg"));
  T("summary written", a.$("analysisNote").textContent.length > 40, a.$("analysisNote").textContent.slice(0, 90) + "…");
  T("progress bar hidden again", a.$("anaProgress").className.includes("hide"));
  T("button restored", a.$("btnAnalyse").textContent === "Analyse this game" && !a.$("btnAnalyse").disabled);

  console.log("\nPGN EXPORT");
  a.click(a.$("btnPgnCopy")); await wait(200);
  T("copy reported", /copied/.test(a.$("pgnMsg").textContent));
  a.click(a.$("btnPgnDownload")); await wait(300);
  T("download reported", /Download|copied/.test(a.$("pgnMsg").textContent), a.$("pgnMsg").textContent);
  a.$("pgnIn").value = "1. e4 e5 2. Qq9 ";
  a.click(a.$("btnPgnLoad")); await wait(300);
  T("bad pgn rejected gracefully", /not legal|Could not/.test(a.$("pgnMsg").textContent), a.$("pgnMsg").textContent);

  console.log("\nPLAYING KEEPS REVIEW IN STEP");
  a.click(a.$("btnNew")); await wait(600);
  /* Partie chronometree : l'overlay de preparation attend le feu vert, sans
     quoi les clics sur l'echiquier ne jouent aucun coup. */
  {
    const rb = a.$("readyBanner");
    if (rb && !rb.className.includes("hide")) { a.click(a.$("readyStart")); await wait(300); }
  }
  T("analysis cleared on new game", a.$("analysisOut").className.includes("hide"));
  await a.play("e2", "e4");
  /* Le libelle depend du livre d'ouvertures, charge a la demande. */
  {
    const jusqua = Date.now() + 5000;
    while (!(a.$("opening").textContent || "").trim() && Date.now() < jusqua) await wait(120);
  }
  T("opening shown while playing", a.$("opening").textContent.length > 0, a.$("opening").textContent);
  a.click(a.$("navPrev")); await wait(250);
  const beforeCount = a.$("sheet").querySelectorAll("[data-ply]").length;
  await a.play("d2", "d4");
  T("clicking board leaves review instead of moving", a.$("sheet").querySelectorAll("[data-ply]").length === beforeCount);

  console.log("\nPUZZLE RATING + STREAK");
  a.click(a.$("tab-puzzles")); await wait(700);
  const rating0 = +a.$("stRating").textContent;
  T("rating displayed", rating0 > 0, String(rating0));
  let solved = 0;
  for (let i = 0; i < 3; i++) {
    const pz = a.cur();
    if (!pz) { a.click(a.$("btnNext")); await wait(400); continue; }
    await a.play(pz.sol[0].slice(0, 2), pz.sol[0].slice(2, 4));
    if (a.$("promoModal").className.includes("on")) { a.click(a.$("promoBtns").children[0]); await wait(400); }
    if (pz.type === "mate" && pz.n === 2 && a.$("exStatus").textContent.includes("mate in")) {
      const g2 = new Engine.Game(a.placement() + " " + pz.fen.split(" ")[1] + " - - 0 1");
      const mm = Engine.allMatingMoves(g2, 1);
      if (mm.length) { const u = g2.uci(mm[0]); await a.play(u.slice(0, 2), u.slice(2, 4)); }
    }
    if (a.$("exStatus").className.includes("win")) solved++;
    a.click(a.$("btnNext")); await wait(400);
  }
  T("puzzles still solvable", solved === 3, solved + "/3");
  T("rating moved", +a.$("stRating").textContent !== rating0, rating0 + " -> " + a.$("stRating").textContent);
  T("day streak started", a.$("stDays").textContent === "1", a.$("stDays").textContent);

  console.log("\nPUZZLE RUSH");
  /* Le Sprint ne demarre plus que depuis Defis : btnGoRush, puis l'overlay
     de preparation attend le feu vert avant de vraiment lancer le chrono. */
  a.click(a.$("tab-train")); await wait(400);
  a.click(a.$("btnGoRush")); await wait(400);
  {
    const rb = a.$("readyBanner");
    if (rb && !rb.className.includes("hide")) { a.click(a.$("readyStart")); await wait(400); }
  }
  T("rush bar visible", !a.$("rushBar").className.includes("hide"));
  T("timer running", /^[0-2]:\d\d$/.test(a.$("rushTime").textContent), a.$("rushTime").textContent);
  T("three strikes shown", a.$("rushStrikes").textContent === "✗✗✗", a.$("rushStrikes").textContent);
  const pz = a.cur();
  if (pz) {
    await a.play(pz.sol[0].slice(0, 2), pz.sol[0].slice(2, 4));
    await wait(900);
    T("rush score increments", a.$("rushScore").textContent === "1", a.$("rushScore").textContent);
  }
  /* Abandon en deux temps, comme "Abandonner la partie" : premier clic
     arme, second confirme. */
  a.click(a.$("btnGoRush")); await wait(300);
  a.click(a.$("btnGoRush")); await wait(600);
  T("rush stops cleanly", a.$("rushBar").className.includes("hide") && a.$("btnGoRush").textContent === "Start Chang Sprint");
  T("rush best saved", +a.$("stRush").textContent >= 1, a.$("stRush").textContent);
  {const b = a.$("resultBanner"); if (b && !b.className.includes("hide")) { a.click(a.$("resultClose")); await wait(300); }}

  console.log("\nWATCH");
  a.click(a.$("tab-watch")); await wait(400);
  T("watch pane shown", !a.$("pane-watch").className.includes("hide"));
  T("board hidden", a.$("appLayout").className.includes("hide"));
  T("nine channels", a.$("channels").children.length === 9, Array.from(a.$("channels").children).map(c => c.querySelector("h3").textContent).join(", "));
  T("each card has an auto-updating embed", [...a.$("channels").children].every(c => {
    const f = c.querySelector("iframe");
    return f && /youtube-nocookie\.com\/embed\/videoseries\?list=UU/.test(f.src);
  }));
  T("one button per channel card", a.$("channels").children[0].querySelectorAll("button").length === 1);
  a.click(a.$("channels").children[0].querySelectorAll("button")[0]);
  await wait(200);

  console.log("\nLEGAL");
  a.click(a.$("footLegal")); await wait(300);
  T("legal pane shown", !a.$("pane-legal").className.includes("hide"));
  T("host details present", /Cloudflare, Inc\./.test(a.$("legalBody").textContent));
  T("publisher filled in, no placeholders", /AlexZ1212/.test(a.$("legalBody").textContent) && !/\[/.test(a.$("legalBody").textContent));
  T("privacy mentions no cookies", /sets no cookies/.test(a.$("privacyBody").textContent));
  T("privacy mentions youtube", /YouTube/.test(a.$("privacyBody").textContent));

  console.log("\nBACK TO NORMAL");
  a.click(a.$("footHome")); await wait(400);
  T("home restored", !a.$("pane-home").className.includes("hide"));
  T("legal hidden", a.$("pane-legal").className.includes("hide"));
  T("home shows rating", +a.$("hRating").textContent > 0, a.$("hRating").textContent);
  T("home shows streak", a.$("hStreak").textContent === "1", a.$("hStreak").textContent);
  a.click(a.$("tab-play")); await wait(500);
  T("play still works after everything", !a.$("pane-play").className.includes("hide") && a.$("board").children.length === 64);

  console.log("\nJS errors:", A.errors.join(" | ") || "none");
  process.exit(0);
})();
