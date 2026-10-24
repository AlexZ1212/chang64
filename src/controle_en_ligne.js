#!/usr/bin/env node
/* Controle du site EN LIGNE, apres chaque publication.

   Usage :
     node controle_en_ligne.js                 (https://chang64.com contre ../chang64-site)
     node controle_en_ligne.js --rapide        (un echantillon des donnees et des images)
     node controle_en_ligne.js --base=https://xxx.chang64.pages.dev

   Pourquoi. Les tests check_*.js lisent site/ sur le disque. Ils ne disent
   rien de ce que Cloudflare Pages sert reellement : un fichier oublie a la
   publication, un en-tete de _headers ignore, une redirection mal ecrite,
   un service worker reste sur l'ancienne version. Ce script compare le site
   servi au dossier publie (chang64-site), fichier par fichier.

   Verifie :
     1. chaque fichier publie est servi a l'identique (empreinte SHA-256) ;
     2. chaque URL du sitemap, et chaque alternative hreflang, repond 200
        sans redirection ;
     3. chaque regle de _redirects renvoie le bon code vers la bonne cible ;
     4. chaque en-tete de _headers est servi, avec la bonne valeur ;
     5. le service worker en ligne porte la version du build ;
     6. une page inexistante repond 404 avec la page 404 du site ;
     7. http:// et www. menent a https://chang64.com.

   Rien n'est ecrit ni modifie. Code de sortie 1 au premier echec. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const opt = n => { const a = process.argv.find(x => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : null; };
const BASE = (opt("base") || "https://chang64.com").replace(/\/$/, "");
const REF = path.resolve(opt("ref") || path.join(__dirname, "..", "chang64-site"));
const RAPIDE = process.argv.includes("--rapide");
const PARALLELE = 8;

let ok = 0, ko = 0;
const echecs = [];
const T = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  -> " + d : "")); } };
const section = s => console.log("\n--- " + s + " ---");
const bilan = (avant) => { const k = ko - avant.ko; console.log("  " + (ok - avant.ok) + " OK" + (k ? ", " + k + " FAIL" : "")); for (const e of echecs.slice(avant.ko)) console.log("  FAIL " + e); };
const etat = () => ({ ok, ko });

/* fetch avec plusieurs tentatives : une erreur reseau n'est pas un defaut du site. */
async function lire(url, init) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, Object.assign({ redirect: "manual", headers: { "User-Agent": "chang64-controle" } }, init || {})); }
    catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}
async function parLots(liste, f) {
  let i = 0;
  await Promise.all(Array.from({ length: PARALLELE }, async () => { while (i < liste.length) { const x = liste[i++]; await f(x); } }));
}
const sha = b => crypto.createHash("sha256").update(b).digest("hex");

/* Cloudflare Pages sert /a/b.html sous /a/b et /a/index.html sous /a/ :
   demander la forme canonique, sinon on ne mesure qu'une redirection 308. */
function urlDe(rel) {
  let u = "/" + rel.split(path.sep).join("/");
  if (u.endsWith("/index.html")) u = u.slice(0, -"index.html".length);
  else if (u.endsWith(".html")) u = u.slice(0, -".html".length);
  return u;
}

function fichiersPublies() {
  const out = [];
  const tour = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) tour(p); else out.push(path.relative(REF, p)); } };
  tour(REF);
  /* Fichiers de configuration de Pages, jamais servis tels quels. */
  return out.filter(r => !["_headers", "_redirects"].includes(r));
}

/* Regles de _headers : chemin (avec * ) -> { en-tete: valeur }. */
function reglesEntetes() {
  const regles = []; let cur = null;
  for (const l of fs.readFileSync(path.join(REF, "_headers"), "utf8").split(/\r?\n/)) {
    if (!l.trim() || l.trim().startsWith("#")) continue;
    if (!/^\s/.test(l)) { cur = { motif: l.trim(), entetes: {} }; regles.push(cur); }
    else if (cur) { const i = l.indexOf(":"); cur.entetes[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
  }
  return regles;
}
const correspond = (motif, u) => new RegExp("^" + motif.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(u);

(async () => {
  console.log("Site en ligne : " + BASE);
  console.log("Reference     : " + REF + (RAPIDE ? "  (mode rapide)" : ""));
  if (!fs.existsSync(path.join(REF, "index.html"))) { console.error("Dossier de reference introuvable : " + REF); process.exit(1); }

  /* 1. Fichiers */
  section("1. Fichiers publies, servis a l'identique");
  let a = etat();
  let fichiers = fichiersPublies();
  if (RAPIDE) {
    const lourd = r => /\.(png|json)$/.test(r) && !/^(manifest|openings-book)/.test(path.basename(r));
    const lourds = fichiers.filter(lourd);
    fichiers = fichiers.filter(r => !lourd(r)).concat(lourds.filter((_, i) => i % 20 === 0));
  }
  let octets = 0;
  await parLots(fichiers, async rel => {
    const u = urlDe(rel);
    try {
      const r = await lire(BASE + u);
      if (r.status !== 200) { T(u, false, "statut " + r.status + (r.headers.get("location") ? " vers " + r.headers.get("location") : "")); return; }
      const b = Buffer.from(await r.arrayBuffer());
      octets += b.length;
      T(u, sha(b) === sha(fs.readFileSync(path.join(REF, rel))), "contenu different (" + b.length + " octets servis, " + fs.statSync(path.join(REF, rel)).size + " publies)");
    } catch (e) { T(u, false, "erreur reseau : " + e.message); }
  });
  console.log("  " + fichiers.length + " fichiers, " + (octets / 1e6).toFixed(1) + " Mo telecharges");
  bilan(a);

  /* 2. Sitemap */
  section("2. URL du sitemap");
  a = etat();
  const sitemap = fs.readFileSync(path.join(REF, "sitemap.xml"), "utf8");
  const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>|href="([^"]+)"/g)].map(m => m[1] || m[2]))];
  await parLots(urls, async full => {
    const u = full.replace(/^https:\/\/chang64\.com/, BASE);
    try {
      const r = await lire(u, { method: "HEAD" });
      T(full, r.status === 200, "statut " + r.status + (r.headers.get("location") ? " vers " + r.headers.get("location") : ""));
    } catch (e) { T(full, false, "erreur reseau : " + e.message); }
  });
  console.log("  " + urls.length + " URL (pages et alternatives hreflang)");
  bilan(a);

  /* 3. Redirections */
  section("3. Redirections de _redirects");
  a = etat();
  const redirs = fs.readFileSync(path.join(REF, "_redirects"), "utf8").split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith("#")).map(l => l.split(/\s+/));
  await parLots(redirs, async ([de, vers, code]) => {
    try {
      const r = await lire(BASE + de, { method: "HEAD" });
      const loc = (r.headers.get("location") || "").replace(BASE, "");
      T(de, r.status === +(code || 302) && loc === vers, "statut " + r.status + " vers " + (loc || "rien") + ", attendu " + (code || 302) + " vers " + vers);
    } catch (e) { T(de, false, "erreur reseau : " + e.message); }
  });
  console.log("  " + redirs.length + " regles");
  bilan(a);

  /* 4. En-tetes : pour chaque regle, un fichier publie qui lui correspond. */
  section("4. En-tetes de _headers");
  a = etat();
  const toutes = fichiersPublies();
  for (const { motif, entetes } of reglesEntetes()) {
    const rel = toutes.find(r => correspond(motif, "/" + r.split(path.sep).join("/")));
    if (!rel) { T(motif, false, "aucun fichier publie ne correspond a cette regle"); continue; }
    const u = urlDe(rel);
    const r = await lire(BASE + u, { method: "HEAD" });
    for (const [h, v] of Object.entries(entetes)) {
      const servi = r.headers.get(h);
      /* Pages fusionne les regles : une valeur peut etre suivie d'une autre,
         separee par une virgule. On exige que la valeur declaree y figure. */
      T(motif + "  " + h + "  (" + u + ")", servi !== null && servi.split(/,\s*/).join(", ").includes(v), servi === null ? "absent" : "servi : " + servi);
    }
  }
  bilan(a);

  /* 5. Service worker */
  section("5. Version du service worker");
  a = etat();
  const vRef = (/const CACHE="([^"]+)"/.exec(fs.readFileSync(path.join(REF, "sw.js"), "utf8")) || [])[1];
  const sw = await (await lire(BASE + "/sw.js")).text();
  const vLigne = (/const CACHE="([^"]+)"/.exec(sw) || [])[1];
  T("sw.js en ligne porte la version du build (" + vRef + ")", vRef && vRef === vLigne, "en ligne : " + vLigne);
  bilan(a);

  /* 6. Page inexistante */
  section("6. Page inexistante");
  a = etat();
  const r404 = await lire(BASE + "/controle-page-qui-n-existe-pas-" + Date.now());
  const corps = await r404.text();
  T("statut 404", r404.status === 404, "statut " + r404.status);
  T("page 404 du site", corps === fs.readFileSync(path.join(REF, "404.html"), "utf8"), "contenu different");
  bilan(a);

  /* 7. Adresse canonique */
  section("7. http et www");
  a = etat();
  if (BASE === "https://chang64.com") {
    for (const u of ["http://chang64.com/", "https://www.chang64.com/", "http://www.chang64.com/"]) {
      try {
        const r = await lire(u, { method: "HEAD" });
        const loc = r.headers.get("location") || "";
        T(u, r.status >= 301 && r.status <= 308 && loc.replace(/\/?$/, "/") === "https://chang64.com/", "statut " + r.status + " vers " + (loc || "rien"));
      } catch (e) { T(u, false, "erreur reseau : " + e.message); }
    }
  } else console.log("  (seulement pour https://chang64.com)");
  bilan(a);

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error("echec :", e); process.exit(1); });
