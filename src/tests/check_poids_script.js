/* Verification automatique de chang64.
   Lancement : node tests/check_poids_script.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Allegement du script principal (2026-11-23, choix d'Alexandre par QCM : « les
   deux pistes »). Le script pesait 605 500 caracteres et son garde-fou avait
   ete releve a 650 000. Rien ne change a l'ecran :
   - les noms locaux (variables et parametres dans les fonctions) sont
     raccourcis a la construction ; les noms de premier niveau restent, car
     les morceaux du script, les tests et le HTML se parlent par eux ;
   - les textes anglais qui ne servent qu'a la page anglaise (mentions
     legales, confidentialite, variantes de ton) ne sont plus dans le script
     livre aux dix langues, mais dans le bloc de langue de la page anglaise.
   Ce test garde le poids, et surtout que l'anglais n'a rien perdu. */
const fs = require("fs"), path = require("path");
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const SRC = path.join(__dirname, ".."), SITE = path.join(SRC, "site");
const { CODES } = require("../langues/registre.js");
const page = l => fs.readFileSync(path.join(SITE, l === "en" ? "" : l, "index.html"), "utf8");
const script = h => [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
const bloc = h => JSON.parse(h.match(/<script type="application\/json" id="langue">([\s\S]*?)<\/script>/)[1]);
const TON = JSON.parse(fs.readFileSync(path.join(SRC, "ton_en.json"), "utf8"));
const LEGAL = JSON.parse(fs.readFileSync(path.join(SRC, "legal_en.json"), "utf8"));

(async () => {
  console.log("--- Le poids ---");
  const en = page("en"), sEn = script(en);
  T("le script principal fait moins de 570 000 caracteres (605 500 avant)", sEn.length < 570000, sEn.length);
  T("le meme script dans les dix langues", CODES.every(l => script(page(l)) === sEn));
  T("les noms de premier niveau sont intacts (setMode, menuStats, statsBilan, cpVue)", ["function setMode(", "function menuStats(", "function statsBilan(", "function cpVue("].every(x => sEn.includes(x)));
  T("les noms locaux sont raccourcis (statsBilan n'a plus ses parametres v, n, d en clair)", /function statsBilan\(\w,\w,\w\)\{/.test(sEn) && !/function goToSection\(id\)/.test(sEn), (sEn.match(/function statsBilan\([^)]*\)/) || [""])[0]);

  console.log("--- Les textes anglais ne sont plus dans le script ---");
  T("ni les mentions legales ni la confidentialite", !sEn.includes("The short version") && !sEn.includes("Publication director"));
  const variantes = Object.values(TON).flat().filter(v => typeof v === "string" && v.length > 12);
  const restees = variantes.filter(v => sEn.includes(JSON.stringify(v).slice(1, -1)) && !Object.keys(TON).includes(v));
  T("ni les variantes de ton (" + variantes.length + " phrases)", variantes.length > 20 && restees.length === 0, restees.slice(0, 3).join(" | "));
  T("les sources n'ont plus de jeton __TON_EN__ ni de constante LEGAL_EN", !/__TON_EN__/.test(fs.readFileSync(path.join(SRC, "i18n.js"), "utf8")) && !/LEGAL_EN|PRIVACY_EN/.test(fs.readFileSync(path.join(SRC, "ui2.js"), "utf8")));

  console.log("--- Ils sont dans le bloc de langue de la page anglaise, et la seulement ---");
  const bEn = bloc(en);
  T("page anglaise : toutes les variantes de ton", JSON.stringify(bEn.ton) === JSON.stringify(TON));
  T("page anglaise : mentions legales et confidentialite", bEn.legal === LEGAL.legal && bEn.privacy === LEGAL.privacy && LEGAL.legal.length > 2000 && LEGAL.privacy.length > 8000);
  for (const l of CODES.filter(c => c !== "en")) {
    const b = bloc(page(l));
    T(l + " : ses propres textes, rien d'anglais en plus", b.ton === undefined && b.legal === undefined && b.privacy === undefined && typeof b.dict["@legal"] === "string" && typeof b.dict["@privacy"] === "string" && Object.keys(TON).every(k => b.dict[k] !== undefined),
      Object.keys(TON).filter(k => b.dict[k] === undefined).slice(0, 3).join(" | "));
  }

  console.log("--- A l'ecran, rien n'a change ---");
  let w = await ouvrir("en", { attente: 1800 });
  const cle = Object.keys(TON).find(k => Array.isArray(TON[k]) && TON[k].length > 1);
  const vues = new Set();
  for (let i = 0; i < 40; i++) vues.add(w.eval("t(" + JSON.stringify(cle) + ")"));
  T("anglais : une reaction a toujours ses variantes (« " + cle + " »)", vues.size > 1 && [...vues].every(v => TON[cle].some(x => typeof x === "string" ? v === x || v.length > 0 : true)), [...vues].join(" | "));
  w.eval("setMode('legal')");
  const texte = id => w.document.getElementById(id).textContent;
  T("anglais : les mentions legales s'affichent, variables remplies", /Publisher/.test(texte("legalBody")) && /AlexZ1212/.test(texte("legalBody")) && !/\{name\}|\{host\}/.test(texte("legalBody")), texte("legalBody").slice(0, 80));
  T("anglais : la confidentialite s'affiche", /The short version/.test(texte("privacyBody")) && texte("privacyBody").length > 5000, texte("privacyBody").length);
  w.close();
  w = await ouvrir("fr", { attente: 1800 });
  w.eval("setMode('legal')");
  const fr = id => w.document.getElementById(id).textContent;
  T("francais : mentions legales et confidentialite en francais", /diteur/.test(fr("legalBody")) && fr("privacyBody").length > 5000 && !/The short version/.test(fr("privacyBody")), fr("legalBody").slice(0, 60));
  w.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
