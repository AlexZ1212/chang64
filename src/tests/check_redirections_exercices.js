/* Verification des redirections des anciennes pages d'exercices (2026-11-14).
   Lancement : node tests/check_redirections_exercices.js (apres node build_site.js)

   La Search Console a refuse la correction des 404 le 10/11 : les adresses a
   "g" (/puzzles/g691-pin) n'etaient pas reconnues, et deux themes francais
   n'ont plus de page. On execute les deux fonctions avec un faux env.ASSETS
   qui repond comme le dossier publie (site/). */
const fs = require("fs");
const path = require("path");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const SITE = path.join(__dirname, "..", "site");

function charger(rel) {
  const src = fs.readFileSync(path.join(__dirname, "..", "functions", rel), "utf8").replace(/export\s+async\s+function\s+onRequest/, "async function onRequest");
  return new Function(src + "\nreturn onRequest;")();
}
/* Comme Cloudflare Pages : /x sert x.html, x/index.html, sinon 404. */
const ASSETS = { async fetch(req) {
  const p = decodeURIComponent(new URL(req.url).pathname);
  const existe = [p, p + ".html", path.posix.join(p, "index.html")].some(c => { const f = path.join(SITE, c); return fs.existsSync(f) && fs.statSync(f).isFile(); });
  return { status: existe ? 200 : 404 };
} };
async function suivre(fn, chemin) {
  const page = chemin.split("/").pop();
  const r = await fn({ request: new Request("https://chang64.com" + chemin), params: { page }, next: () => ({ status: "next" }), env: { ASSETS } });
  if (r.status === "next") return "next";
  return r.status + " " + new URL(r.headers.get("Location")).pathname;
}

(async () => {
  const en = charger("puzzles/[page].js"), fr = charger("fr/exercices/[page].js");
  const cas = [
    [en, "/puzzles/758-mate-in-one", "301 /puzzles/mate-in-one"],
    [en, "/puzzles/70-winning-capture.html", "301 /puzzles/winning-capture"],
    [en, "/puzzles/g691-pin", "301 /puzzles/pin"],
    [en, "/puzzles/g540-pin.html", "301 /puzzles/pin"],
    [en, "/puzzles/12-smothered-mate", "301 /puzzles/"],
    [en, "/puzzles/pin", "next"],
    [en, "/puzzles/n-importe-quoi", "next"],
    [fr, "/fr/exercices/484-clouage.html", "301 /fr/exercices/clouage"],
    [fr, "/fr/exercices/667-prise-gagnante", "301 /fr/exercices/prise-gagnante"],
    [fr, "/fr/exercices/g675-prise-gagnante", "301 /fr/exercices/prise-gagnante"],
    [fr, "/fr/exercices/31-mat-etouffe", "301 /fr/exercices/"],
    [fr, "/fr/exercices/42-attaque-a-distance.html", "301 /fr/exercices/"],
    [fr, "/fr/exercices/clouage", "next"],
  ];
  for (const [fn, chemin, attendu] of cas) {
    const r = await suivre(fn, chemin);
    T(chemin + " -> " + attendu, r === attendu, r);
  }
  /* Les fichiers publies doivent etre les memes que les sources. */
  for (const rel of ["puzzles/[page].js", "fr/exercices/[page].js"])
    T("site/functions/" + rel + " a jour", fs.readFileSync(path.join(SITE, "functions", rel), "utf8") === fs.readFileSync(path.join(__dirname, "..", "functions", rel), "utf8"));
  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + e.message); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
