/* Verification automatique de chang64.
   Lancement : node tests/check_seo_entete.js

   Quatre manques releves par un audit externe, tous confirmes :

   1. Aucun canonical sur l'accueil. La page est atteignable avec ou sans
      barre oblique, avec ou sans www : sans declaration, Google choisit
      lui-meme la version a indexer et disperse les signaux.
   2. Aucun favicon declare, alors que icon-192.svg et icon-512.svg
      existaient deja. Ils n'etaient references que dans le manifeste, donc
      invisibles pour le navigateur et les moteurs.
   3. Meta description de 174 caracteres, tronquee dans les resultats, ce qui
      coupait les arguments places en fin de phrase.
   4. Aucun hreflang sur l'accueil, alors que les deux langues partagent la
      meme adresse (la bascule se fait cote client). Les pages de contenu,
      elles, en avaient deja.

   Point de vigilance : le canonical doit rester PROPRE A CHAQUE PAGE. Une
   valeur unique heritee du gabarit serait pire que pas de canonical du tout,
   puisqu'elle dirait a Google que toutes les pages sont la meme.
*/
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");

let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };

const home = fs.readFileSync(SITE + "/index.html", "utf8");
const get = (h, rx) => (h.match(rx) || [])[1] || null;

console.log("\n--- Accueil : les quatre manques sont combles ---");
T("canonical present", get(home, /rel="canonical" href="([^"]*)"/) === "https://chang64.com/",
  get(home, /rel="canonical" href="([^"]*)"/));
T("favicon declare", /rel="icon"[^>]*icon-192\.svg/.test(home));
T("icone pour iOS", /rel="apple-touch-icon"/.test(home));
const desc = get(home, /name="description" content="([^"]*)"/);
T("description sous 160 caracteres : " + (desc || "").length, desc && desc.length <= 160, String((desc || "").length));
T("description assez riche", desc && desc.length >= 100, String((desc || "").length));
const hl = [...home.matchAll(/hreflang="([^"]*)"/g)].map(m => m[1]);
T("hreflang en, fr et x-default", ["en", "fr", "x-default"].every(x => hl.includes(x)), hl.join(", "));

console.log("\n--- Les fichiers d'icone existent vraiment ---");
for (const f of ["/icon-192.svg", "/icon-512.svg"])
  T(f + " present", fs.existsSync(SITE + f));

console.log("\n--- Chaque page garde SON canonical ---");
/* Le piege serait qu'une valeur du gabarit se propage partout. */
const echantillon = [
  "/openings/sicilian-defense.html",
  "/fr/ouvertures/defense-sicilienne.html",
  "/fr/lexique/clouage.html",
  "/puzzles/index.html"
].filter(f => fs.existsSync(SITE + f));
let mauvais = [];
for (const f of echantillon) {
  const h = fs.readFileSync(SITE + f, "utf8");
  const c = get(h, /rel="canonical" href="([^"]*)"/);
  if (!c || c === "https://chang64.com/") mauvais.push(f + " -> " + c);
}
T(echantillon.length + " pages verifiees, canonical propre a chacune", mauvais.length === 0,
  mauvais.join(", "));

console.log("\n--- Le favicon est sur toutes les pages ---");
let sans = [], vus = 0;
for (const dir of ["/openings", "/fr/ouvertures", "/learn", "/fr/apprendre", "/glossary", "/fr/lexique"]) {
  if (!fs.existsSync(SITE + dir)) continue;
  for (const f of fs.readdirSync(SITE + dir).filter(x => x.endsWith(".html")).slice(0, 25)) {
    vus++;
    if (!fs.readFileSync(SITE + dir + "/" + f, "utf8").includes('rel="icon"')) sans.push(dir + "/" + f);
  }
}
T(vus + " pages de contenu, toutes avec favicon", sans.length === 0, sans.slice(0, 3).join(", "));

console.log("\n--- Ce qui etait deja bon ne l'est pas moins ---");
T("titre present", /<title>[^<]{10,}<\/title>/.test(home));
T("un seul h1", (home.match(/<h1[\s>]/g) || []).length === 1, String((home.match(/<h1[\s>]/g) || []).length));
T("Open Graph complet", /og:title/.test(home) && /og:description/.test(home) && /og:image/.test(home));
T("carte Twitter", /twitter:card/.test(home));
T("donnees structurees", /application\/ld\+json/.test(home));
T("langue declaree", /<html lang=/.test(home));
T("viewport", /name="viewport"/.test(home));

console.log("\n--- Les polices ne bloquent pas le rendu ---");
/* La feuille Google Fonts en rel="stylesheet" bloquait le premier affichage
   pendant environ 1,5 s sur mobile en 4G lente. display=swap ne suffit pas :
   il ne concerne que les fichiers de police, pas la feuille qui les declare.
   Elle est donc chargee en preload puis promue une fois arrivee. */
T("feuille de polices non bloquante", /rel="preload" as="style"[^>]*fonts\.googleapis/.test(home));
T("promue en feuille une fois chargee", /onload="this\.onload=null;this\.rel='stylesheet'"/.test(home));
T("repli sans JavaScript", /<noscript><link rel="stylesheet"[^>]*fonts\.googleapis/.test(home));
T("display=swap conserve", /display=swap/.test(home));
/* Sans police de repli declaree, le texte serait invisible pendant l'attente. */
for (const [nom, rx] of [
  ["serif", /'Source Serif 4',Georgia,serif/],
  ["sans-serif", /'Archivo',ui-sans-serif,system-ui,sans-serif/],
  ["chasse fixe", /'JetBrains Mono',monospace/]
]) T("police de repli " + nom, rx.test(home));
T("preconnexion aux deux origines",
  /preconnect[^>]*fonts\.googleapis/.test(home) && /preconnect[^>]*fonts\.gstatic/.test(home));

console.log("\n--- Redirections et indexation ---");
/* Search Console signale trois motifs de non-indexation. Deux sont benins et
   attendus : "Autre page avec balise canonique correcte" (une URL redirigee
   ou un doublon pointant vers la bonne page) et "Page avec redirection". Le
   troisieme, "Page en double sans URL canonique", serait un vrai defaut : il
   signifierait que deux pages se disputent la meme adresse sans que le site
   ait tranche. */
{
  const red = fs.readFileSync(SITE + "/_redirects", "utf8");
  const lignes = red.trim().split("\n").filter(Boolean);
  /* Un 302 dit a Google que la redirection est temporaire : il ne transmet
     pas l'autorite de la page et revient verifier indefiniment. Sur des
     redirections definitives, c'est un 301 qu'il faut. */
  const temporaires = lignes.filter(l => / 302\b/.test(l));
  T("aucune redirection temporaire", temporaires.length === 0,
    temporaires.slice(0, 3).join(" | "));
  T(lignes.length + " redirections declarees", lignes.length > 0);

  /* Une URL redirigee ne doit jamais figurer au sitemap : ce serait demander
     a Google d'indexer une page qui n'existe pas. */
  const sm = fs.readFileSync(SITE + "/sitemap.xml", "utf8");
  const dansSitemap = lignes
    .map(l => l.split(/\s+/)[0])
    .filter(src => sm.includes(">https://chang64.com" + src + "<"));
  T("aucune URL redirigee au sitemap", dansSitemap.length === 0,
    dansSitemap.slice(0, 3).join(", "));
}

console.log("\n--- Pas de pages en double ---");
{
  /* Deux pages partageant le meme canonical, ou une page sans canonical du
     tout, produisent le motif "page en double sans URL canonique". */
  const walk = (p, out) => {
    for (const f of fs.readdirSync(p)) {
      const q = path.join(p, f);
      if (fs.statSync(q).isDirectory()) walk(q, out);
      else if (f.endsWith(".html")) out.push(q);
    }
    return out;
  };
  const pages = walk(SITE, []);
  const parCanon = {};
  let sansCanon = [];
  for (const q of pages) {
    const m = fs.readFileSync(q, "utf8").match(/rel="canonical" href="([^"]*)"/);
    if (!m) { sansCanon.push(q.replace(SITE, "")); continue; }
    (parCanon[m[1]] = parCanon[m[1]] || []).push(q.replace(SITE, ""));
  }
  const partages = Object.entries(parCanon).filter(([, v]) => v.length > 1);
  T(pages.length + " pages, toutes avec un canonical", sansCanon.length === 0,
    sansCanon.slice(0, 3).join(", "));
  T("aucun canonical partage par deux pages", partages.length === 0,
    partages.slice(0, 2).map(([k, v]) => k + " x" + v.length).join(" | "));
}

console.log("\n--- En-tetes de securite ---");
/* Le site ne collecte rien, donc l'enjeu est faible, mais ces deux en-tetes
   ne coutent que deux lignes. Attention : une politique trop stricte casse le
   site sans prevenir. Elle doit autoriser tout ce qui est reellement charge,
   d'ou les controles ci-dessous. */
{
  const h = fs.readFileSync(SITE + "/_headers", "utf8");
  T("HSTS present", /Strict-Transport-Security:\s*max-age=\d+/.test(h));
  T("politique de securite presente", /Content-Security-Policy:/.test(h));
  const csp = (h.match(/Content-Security-Policy:([^\n]*)/) || [])[1] || "";
  /* Chaque ressource externe reellement utilisee doit etre autorisee. */
  for (const [besoin, motif, pourquoi] of [
    ["polices Google", "fonts.googleapis.com", "feuille de style des polices"],
    ["fichiers de police", "fonts.gstatic.com", "les polices elles-memes"],
    ["videos YouTube", "youtube-nocookie.com", "l'onglet Videos affiche la derniere video de chaque chaine en iframe"],
    ["travailleurs web", "worker-src", "Stockfish tourne dans un Worker"],
    ["styles en ligne", "'unsafe-inline'", "le site pose des styles par script"],
    ["compilation WebAssembly", "'wasm-unsafe-eval'",
      "Stockfish est un module .wasm ; sans ce mot-cle dans script-src, Chrome " +
      "refuse WebAssembly.instantiateStreaming() et Stockfish reste bloque " +
      "silencieusement sur \"n'a pas pu demarrer\", meme si le fichier se telecharge"]
  ]) T(besoin + " autorises (" + pourquoi + ")", csp.includes(motif), csp.slice(0, 60));
  T("le site ne peut pas etre encadre ailleurs", /frame-ancestors 'self'/.test(csp));
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
