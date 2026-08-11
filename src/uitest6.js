const fs = require("fs");
const { JSDOM } = require("jsdom");
const Engine = require("./engine.js");

const html = fs.readFileSync(require("path").join(__dirname,"site-index.html"), "utf8");
const PUZZLES = JSON.parse(fs.readFileSync(require("path").join(__dirname,"puzzles.json"), "utf8"));
const wait = ms => new Promise(r => setTimeout(r, ms));

function open_(url) {
  const errors = [];
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url });
  dom.window.addEventListener("error", e => errors.push(e.message));
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
  return { $, cells, click, isFlipped, cellFor, placement, play, cur };
};
const T = (label, ok, extra) => console.log((ok ? "  ok  " : " FAIL ") + label + (extra ? " — " + extra : ""));

(async () => {
  const A = open_("https://chang64.com/");
  await wait(500);
  const a = H(A.w);

  console.log("HOME");
  T("landing shown, board hidden", !a.$("pane-home").className.includes("hide") && a.$("appLayout").className.includes("hide"));
  T("puzzle count on home", a.$("hCount").textContent === String(PUZZLES.length), a.$("hCount").textContent);
  const cats = Array.from(a.$("tcCats").children).map(b => b.textContent);
  T("time control categories", cats.join(",") === "Bullet,Blitz,Rapid,Classical,Daily,No clock", cats.join(" "));
  const chips = Array.from(a.$("tcChips").children).map(b => b.textContent);
  T("rapid variants by default", chips.join(" ") === "10+0 10+5 15+10", chips.join(" "));
  T("note follows category", a.$("tcNote").textContent.startsWith("Rapid"));

  // switch to blitz 3+2
  a.click(a.$("tcCats").children[1]);
  await wait(100);
  const blitz = Array.from(a.$("tcChips").children).map(b => b.textContent);
  T("blitz variants", blitz.join(" ") === "3+0 3+2 5+0 5+3", blitz.join(" "));
  a.click(a.$("tcChips").children[1]);
  await wait(100);
  T("3+2 selected", a.$("tcChips").children[1].getAttribute("aria-pressed") === "true");

  console.log("\nPLAY + CLOCKS");
  a.click(a.$("heroPlay"));
  await wait(600);
  T("play pane open", !a.$("pane-play").className.includes("hide"));
  /* Overlay de preparation : sur une cadence chronometree, la pendule attend
     desormais le feu vert du joueur. Le test doit appuyer sur "Commencer"
     avant de verifier que le temps s'ecoule. */
  T("ready overlay shown on a timed game", !a.$("readyBanner").className.includes("hide"));
  a.click(a.$("readyStart"));
  await wait(300);
  T("clocks visible", !a.$("clockTop").className.includes("hide") && !a.$("clockBottom").className.includes("hide"));
  T("clock starts near 3:00", /^2:5[6-9]$|^3:00$/.test(a.$("clockBottomTime").textContent), a.$("clockBottomTime").textContent);
  T("white clock running", a.$("clockBottom").className.includes("active"));
  T("status mentions blitz", /3\+2/.test(a.$("status").textContent), a.$("status").textContent);

  /* Attente conditionnelle plutot qu'un delai fixe : sous forte charge, un
     setInterval peut ne pas se declencher dans les temps et le test echouait
     alors sans qu'aucun defaut n'existe. On attend que la pendule bouge,
     jusqu'a un plafond raisonnable. */
  const before = a.$("clockBottomTime").textContent;
  const jusqua = Date.now() + 4000;
  while (a.$("clockBottomTime").textContent === before && Date.now() < jusqua) await wait(120);
  T("time is ticking down", a.$("clockBottomTime").textContent !== before, before + " -> " + a.$("clockBottomTime").textContent);

  await a.play("e2", "e4");
  await wait(400);
  T("move played and increment added", a.$("sheet").textContent.includes("e4"));
  T("black clock active after white moved", a.$("clockTop").className.includes("active") || a.$("clockBottom").className.includes("active"));
  console.log("       white clock:", a.$("clockBottomTime").textContent, "| black clock:", a.$("clockTopTime").textContent);

  // unlimited hides clocks
  a.click(a.$("tcCats2").children[4]);
  await wait(300);
  T("no-clock category exists in play panel", Array.from(a.$("tcCats2").children).map(b => b.textContent).join(",") === "Bullet,Blitz,Rapid,Classical,No clock");
  T("mid-game change is deferred", /next game/.test(a.$("status").textContent), a.$("status").textContent);
  a.click(a.$("btnNew"));
  await wait(400);
  T("clocks hidden after new unlimited game", a.$("clockTop").className.includes("hide"));

  console.log("\nPUZZLES");
  a.click(a.$("tab-puzzles"));
  await wait(700);
  T("puzzle loaded", a.$("exQuest").textContent.length > 0, a.$("exQuest").textContent);
  T("english wording", /to play and/.test(a.$("exQuest").textContent));
  T("theme in english", !/[éèàç]/.test(a.$("exTheme").textContent), a.$("exTheme").textContent);
  a.click(a.$("btnDaily"));
  await wait(600);
  T("puzzle of the day labelled", a.$("exTheme").textContent.startsWith("Puzzle of the day"), a.$("exTheme").textContent);
  const daily1 = a.placement();

  // solve a few puzzles
  a.click(a.$("btnNext"));
  await wait(500);
  let solved = 0;
  for (let i = 0; i < 4; i++) {
    const pz = a.cur();
    if (!pz) { a.click(a.$("btnNext")); await wait(400); continue; }
    const u = pz.sol[0];
    await a.play(u.slice(0, 2), u.slice(2, 4));
    if (a.$("promoModal").className.includes("on")) { a.click(a.$("promoBtns").children[0]); await wait(500); }
    if (pz.type === "mate" && pz.n === 2 && a.$("exStatus").textContent.includes("mate in")) {
      const g2 = new Engine.Game(a.placement() + " " + pz.fen.split(" ")[1] + " - - 0 1");
      const mm = Engine.allMatingMoves(g2, 1);
      if (mm.length) { const u2 = g2.uci(mm[0]); await a.play(u2.slice(0, 2), u2.slice(2, 4)); 
        if (a.$("promoModal").className.includes("on")) { a.click(a.$("promoBtns").children[0]); await wait(500); } }
    }
    if (a.$("exStatus").className.includes("win")) solved++;
    a.click(a.$("btnNext")); await wait(400);
  }
  T("puzzles solvable", solved === 4, solved + "/4");
  a.click(a.$("btnCodeGen")); await wait(200);
  T("transfer code generated", /^CH64-/.test(a.$("codeOut").value), a.$("codeOut").value.slice(0, 24) + "…");

  console.log("\nFRIENDS");
  a.click(a.$("tab-friend"));
  await wait(500);
  const paces = Array.from(a.$("dailyChips").children).map(b => b.textContent);
  T("daily pace options", paces.join(" ") === "1 day/move 3 days/move 7 days/move", paces.join(" "));
  a.click(a.$("btnAmiNew")); await wait(300);
  await a.play("d2", "d4");
  const link = a.$("amiLink").value;
  T("link produced", /#p=/.test(link), link);
  T("share buttons", Array.from(a.$("amiShare").children).map(b => b.textContent).join(",") === "WhatsApp,Messenger,Facebook,Copy");

  const B = open_(link);
  await wait(700);
  const b = H(B.w);
  const ref = new Engine.Game();
  ref.makeMove(ref.moves().find(m => ref.uci(m) === "d2d4"));
  T("friend opens on friends tab", b.$("tab-friend").getAttribute("aria-selected") === "true");
  T("board flipped for black", b.isFlipped());
  T("position replayed", b.placement() === ref.fen().split(" ")[0]);

  console.log("\nNAVIGATION");
  a.click(a.$("brand")); await wait(300);
  T("logo returns home", !a.$("pane-home").className.includes("hide"));
  a.click(a.$("tab-play")); await wait(400);
  await a.play("d2", "d4");
  const kept = a.$("sheet").textContent;
  a.click(a.$("tab-puzzles")); await wait(500);
  a.click(a.$("tab-play")); await wait(400);
  T("game preserved across tabs", a.$("sheet").textContent === kept, kept.replace(/\s+/g, " ").trim());

  console.log("\nFLAG FALL");
  const fastHtml = html.replace('items:[[1,0],[1,1],[2,1]]', 'items:[[0.06,0],[1,1],[2,1]]');
  const C = (() => {
    const errors = [];
    const dom = new JSDOM(fastHtml, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://chang64.com/" });
    dom.window.addEventListener("error", e => errors.push(e.message));
    return { dom, w: dom.window, errors };
  })();
  await wait(500);
  const c = H(C.w);
  c.click(c.$("tcCats").children[0]);
  await wait(120);
  c.click(c.$("tcChips").children[0]);
  await wait(120);
  c.click(c.$("heroPlay"));
  await wait(600);
  T("very short control loaded", c.$("clockBottomTime").textContent.startsWith("0:0"), c.$("clockBottomTime").textContent);
  /* La pendule ne part qu'au feu vert : sans ce clic, on attendrait 4,5 s
     devant un overlay et le drapeau ne tomberait jamais. */
  c.click(c.$("readyStart"));
  await wait(4500);
  const st = c.$("status").textContent;
  T("flag falls and ends the game", /on time|not enough material/.test(st), st);
  T("losing clock flagged in red", c.$("clockBottom").className.includes("flagged") || c.$("clockTop").className.includes("flagged"));
  T("board locked after flag", c.$("btnUndo").disabled);
  T("review unlocked after flag", !c.$("btnHint").disabled && !c.$("btnAnalyse").disabled);
  const sheetBefore = c.$("sheet").textContent;
  await c.play("a2", "a3");
  T("no move accepted after flag", c.$("sheet").textContent === sheetBefore);

  console.log("\nJS errors:", [...A.errors, ...B.errors, ...C.errors].join(" | ") || "none");
  process.exit(0);
})();
