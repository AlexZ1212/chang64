/* Verification automatique de chang64.
   Lancement : node tests/check_feuille_pieces.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Pieces de la feuille de partie (2026-11-21, releve par Alexandre) : la
   feuille dessinait toujours la piece BLANCHE, meme pour un coup des Noirs,
   et rien pour un coup de pion, alors que le bandeau de coups dessine la
   piece de chaque coup, pion compris, les Noirs en retrait. Les deux, et la
   liste d'Analyser, passent desormais par le meme rendu (coupHtml, ui2.js) :
   un coup de pion et un coup noir y sont identiques. Dans les phrases
   (statut, explications), la notation garde sa regle : pas de pion dessine.
   La copie PGN garde les lettres anglaises. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = x => String(x).replace(/\s+/g, " ").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  /* Une partie relue : 1. e4 c5 2. Cf3 d6 3. d4 cxd4 4. Cxd4 Cf6 5. O-O. */
  w.eval("setMode('play')");
  await attendre(200);
  $("pgnIn").value = "1. e4 c5 2. Nf3 d6 3. Bc4 Nf6 4. O-O Qc7";
  $("btnPgnLoad").click();
  await attendre(300);
  /* Le dessin d'un coup : classe du picto, dessin, nom dit, texte qui suit. */
  const lire = el => {
    const p = el.querySelector(".navpiece");
    const copie = el.cloneNode(true);
    copie.querySelectorAll(".navnum,.navpiece").forEach(x => x.remove());
    return { classe: p ? p.className : "", dessin: p ? p.querySelector("svg").outerHTML : "", nom: p ? p.getAttribute("aria-label") || "" : "", cache: p ? p.getAttribute("aria-hidden") || "" : "", texte: net(copie.textContent) };
  };
  const feuille = n => lire($("sheet").querySelector('[data-ply="' + n + '"]'));
  const bandeau = n => lire($("navScroll").querySelector('[data-ply="' + n + '"]'));
  const memes = n => JSON.stringify(feuille(n)) === JSON.stringify(bandeau(n));

  console.log("--- Feuille et bandeau, meme dessin ---");
  T("huit coups dans la feuille et dans le bandeau", $("sheet").querySelectorAll("[data-ply]").length === 8 && $("navScroll").querySelectorAll("[data-ply]").length === 9);
  T("1. e4 : un pion, dessine dans la feuille comme dans le bandeau", feuille(1).classe === "navpiece side-w" && feuille(1).dessin.length > 50 && feuille(1).texte === "e4" && memes(1), JSON.stringify(feuille(1)).slice(0, 120));
  T("1... c5 : le pion des Noirs, en retrait (side-b), identique des deux cotes", feuille(2).classe === "navpiece side-b" && feuille(2).texte === "c5" && memes(2), feuille(2).classe);
  T("2. Cf3 : le cavalier devant sa case, sans la lettre anglaise", feuille(3).classe === "navpiece side-w" && feuille(3).texte === "f3" && memes(3), feuille(3).texte);
  T("3... Cf6 : le cavalier des Noirs en retrait, identique des deux cotes", feuille(6).classe === "navpiece side-b" && feuille(6).texte === "f6" && memes(6));
  T("le pion et le cavalier n'ont pas le meme dessin", feuille(1).dessin !== feuille(3).dessin && feuille(3).dessin === feuille(6).dessin);
  T("4. O-O : le roi devant le roque", feuille(7).texte === "O-O" && feuille(7).dessin !== feuille(1).dessin && memes(7), feuille(7).texte);
  T("tous les coups de la partie sont identiques des deux cotes", [1, 2, 3, 4, 5, 6, 7, 8].every(memes));
  T("plus de figurine blanche glissee dans la feuille par l'observateur", !$("sheet").querySelector(".fig") && !$("navScroll").querySelector(".fig"));

  console.log("--- Lecteurs d'ecran ---");
  T("une piece est dite par son nom", feuille(3).nom === "Cavalier" && feuille(8).nom === "Dame" && feuille(7).nom === "Roi", [feuille(3).nom, feuille(8).nom, feuille(7).nom].join());
  T("le pion reste un decor : on lit « e4 »", feuille(1).nom === "" && feuille(1).cache === "true");

  console.log("--- Entre deux humains ---");
  w.eval("renderSheetInto('amiSheet',['e4','e5','Nf3','Nc6','Bb5'],null);renderNavLecture(['e4','e5','Nf3','Nc6','Bb5'])");
  const cases = [...$("amiSheet").querySelectorAll(".sheet-row span:not(.n)")].filter(x => x.textContent.trim());
  const puces = [...$("navScroll").querySelectorAll("[data-ply]")].slice(1);
  T("la feuille de la partie par lien ou en direct suit le meme rendu", cases.length === 5 && cases.every((c, i) => JSON.stringify(lire(c)) === JSON.stringify(lire(puces[i]))), cases.map(c => lire(c).classe + ":" + lire(c).texte).join(" "));
  T("le coup des Noirs y est en retrait, le dernier coup reste marque", lire(cases[1]).classe === "navpiece side-b" && cases[4].classList.contains("cur"));

  console.log("--- Ce qui ne change pas ---");
  const phrase = d.createElement("p");
  d.querySelector("main").appendChild(phrase);
  phrase.textContent = "Après e4, joue Nf3 puis Qxd8+.";
  await attendre(120);
  T("dans une phrase : pas de pion dessine, les pieces en figurines", !phrase.querySelector(".navpiece") && phrase.querySelectorAll(".fig").length === 2 && /e4/.test(phrase.textContent), phrase.innerHTML.slice(0, 80));
  T("le PGN garde les lettres anglaises", /Nf3/.test(w.eval("typeof pgnDePartie==='function'?pgnDePartie():(typeof buildPgn==='function'?buildPgn():sanList.join(' '))")));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
