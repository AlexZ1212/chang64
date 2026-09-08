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
/* Jusqu'au 2026-09-05, la feuille Google Fonts en rel="stylesheet" bloquait
   le premier affichage pendant environ 1,5 s sur mobile en 4G lente, d'ou le
   patron preload+onload+noscript teste ici auparavant. Passees en
   @font-face auto-heberge dans une balise <style> inline, ces polices ne
   dependent plus d'aucune feuille externe a charger avant de s'appliquer :
   le probleme qu'elles resolvaient a disparu avec sa cause. Seul reste a
   verifier ce qui compte encore : font-display:swap sur les six regles (le
   texte s'affiche avec la police de repli sans attendre), et l'absence de
   toute origine Google. */
T("polices declarees en @font-face auto-heberge", (home.match(/@font-face\{/g) || []).length >= 6);
T("display=swap conserve", /@font-face\{[^}]*font-display:swap/.test(home));
T("plus aucune dependance a une feuille externe", !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(home));
/* Sans police de repli declaree, le texte serait invisible pendant l'attente. */
for (const [nom, rx] of [
  ["serif", /'Source Serif 4',Georgia,serif/],
  ["sans-serif", /'Archivo',ui-sans-serif,system-ui,sans-serif/],
  ["chasse fixe", /'JetBrains Mono',monospace/]
]) T("police de repli " + nom, rx.test(home));

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
    ["videos YouTube", "youtube-nocookie.com", "l'onglet Videos affiche la derniere video de chaque chaine en iframe"],
    ["travailleurs web", "worker-src", "Stockfish tourne dans un Worker"],
    ["styles en ligne", "'unsafe-inline'", "le site pose des styles par script"],
    ["compilation WebAssembly", "'wasm-unsafe-eval'",
      "Stockfish est un module .wasm ; sans ce mot-cle dans script-src, Chrome " +
      "refuse WebAssembly.instantiateStreaming() et Stockfish reste bloque " +
      "silencieusement sur \"n'a pas pu demarrer\", meme si le fichier se telecharge"]
  ]) T(besoin + " autorises (" + pourquoi + ")", csp.includes(motif), csp.slice(0, 60));
  /* Polices auto-hebergees depuis le 2026-09-05 : la CSP ne doit plus
     autoriser Google Fonts du tout, la promesse "aucun traqueur" de la
     page Confidentialite en dependait (voir audit). font-src 'self'
     suffit, les six fichiers vivant desormais sous /fonts/ sur le meme
     domaine. */
  T("Google Fonts absent de la CSP (polices auto-hebergees)",
    !csp.includes("fonts.googleapis.com") && !csp.includes("fonts.gstatic.com"), csp.slice(0, 60));
  T("les polices se chargent en local", /font-src[^;]*'self'/.test(csp));
  T("le site ne peut pas etre encadre ailleurs", /frame-ancestors 'self'/.test(csp));
}

/* ---------- fil d'Ariane (2026-09-07) ----------
   La feuille reprenait le <title> entier, donc "Moulin · definition et
   exemple" ou "Partie viennoise : coups, variantes et codes ECO" : verbeux
   la ou le fil s'affiche, sous le lien dans un resultat de recherche.

   Deux garanties a tenir, et la seconde compte autant que la premiere.
   Les suffixes MECANIQUES des trois sections a gabarit doivent partir. Les
   titres REDIGES d'Apprendre, Pieges et Finales doivent rester entiers :
   dans "Le mat de Legal : le sacrifice de dame", ce qui suit les deux-points
   porte du sens, et une regle qui couperait a tous les deux-points ferait
   perdre de l'information au lieu d'en retirer.

   Troisieme garantie : la feuille ne doit jamais reprendre le nom de sa
   section, qui occupe deja le deuxieme niveau. "chang64 > Lexique >
   Lexique · Moulin" serait un doublon. */
{
  const filDe = p => {
    const s = fs.readFileSync(p, "utf8");
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const j = JSON.parse(m[1]);
      if (j["@type"] === "BreadcrumbList") return j.itemListElement.map(i => i.name);
    }
    return null;
  };
  const unePageDe = d => {
    const l = fs.readdirSync(SITE + "/" + d).filter(f => f.endsWith(".html") && f !== "index.html").sort();
    return SITE + "/" + d + "/" + l[0];
  };
  console.log("\n--- Fil d'Ariane ---");
  const GABARITS = [
    ["fr/lexique", "définition et exemple"], ["glossary", "chess term explained"],
    ["fr/ouvertures", "codes ECO"], ["openings", "ECO codes"],
    ["fr/exercices", "exemples expliqués"], ["puzzles", "worked examples"]
  ];
  for (const [d, suffixe] of GABARITS) {
    const f = filDe(unePageDe(d));
    T(d + " : fil a trois niveaux", !!f && f.length === 3, f ? f.join(" > ") : "aucun fil");
    if (!f) continue;
    T(d + " : le suffixe de gabarit est retire", !f[2].includes(suffixe), f[2]);
    T(d + " : la feuille ne redit pas la section", !f[2].startsWith(f[1]), f[2]);
    T(d + " : la feuille n'est pas vide", f[2].trim().length > 1, f[2]);
  }
  const REDIGES = ["fr/apprendre", "learn", "fr/pieges", "fr/finales"];
  for (const d of REDIGES) {
    const p = unePageDe(d), f = filDe(p);
    const titre = fs.readFileSync(p, "utf8").match(/<title>(.*?)<\/title>/)[1].replace(/\s*\|\s*chang64\s*$/, "");
    T(d + " : titre redige laisse intact", !!f && f[2] === titre, f ? f[2] : "aucun fil");
  }
}

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
