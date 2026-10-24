/* Verification automatique de chang64.
   Lancement : node tests/check_identite.js
   Le site doit avoir ete construit au prealable : node build_site.js

   Nouvelle identite du 2026-10-24 (sources dans design/identite) : un
   elephant geometrique de profil remplace la tete de face, qui se lisait
   comme un champignon a petite taille. Les icones livrees (PNG, .ico, SVG)
   remplacent icon-192.svg et icon-512.svg, generees depuis l'ancien signe.
   Verifie : le signe de l'entete est le nouveau, oeil compris (evenodd), sur
   l'application comme sur les pages statiques ; plus aucune trace de
   l'ancien ; les icones declarees existent et ont la bonne taille ; le
   manifeste separe "any" et "maskable" ; le service worker met en cache des
   fichiers qui existent. */
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "..", "site");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d ? "  -> " + d : "")); } };
const lire = f => fs.readFileSync(path.join(SITE, f), "utf8");
const ANCIEN = "M23 15.4C14 11 3 16.4";
const signe = fs.readFileSync(path.join(__dirname, "..", "ds", "signe.svg"), "utf8");
const dSigne = (signe.match(/\sd="([^"]+)"/) || [])[1];

console.log("\n--- Le signe de l'entete ---");
for (const f of ["index.html", "openings/index.html", "fr/ouvertures/defense-sicilienne.html"]) {
  if (!fs.existsSync(path.join(SITE, f))) { T(f + " existe", false); continue; }
  const h = lire(f);
  const m = (h.match(/<svg class="brandmark"[\s\S]*?<\/svg>/) || [""])[0];
  T(f + " : nouveau signe", !!dSigne && m.includes(dSigne));
  T(f + " : l'oeil reste un trou (evenodd)", /fill-rule="evenodd"/.test(m));
  T(f + " : couleur prise du CSS", /fill="currentColor"/.test(m) && !/#E0A93B/i.test(m));
  T(f + " : plus de trace de l'ancien signe", !h.includes(ANCIEN));
}

console.log("\n--- Icones ---");
/* Largeur et hauteur lues dans l'en-tete PNG (IHDR), sans dependance. */
const taillePng = f => { const b = fs.readFileSync(path.join(SITE, f)); return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
for (const [f, t] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["maskable-192.png", 192], ["maskable-512.png", 512]]) {
  const s = fs.existsSync(path.join(SITE, f)) ? taillePng(f) : null;
  T(f + " : " + t + " x " + t, !!s && s[0] === t && s[1] === t, s && s.join("x"));
}
T("favicon.ico present", fs.existsSync(path.join(SITE, "favicon.ico")) && fs.readFileSync(path.join(SITE, "favicon.ico")).readUInt16BE(0) === 0);
T("favicon.svg present", fs.existsSync(path.join(SITE, "favicon.svg")) && /<svg[^>]*viewBox="0 0 64 64"/.test(lire("favicon.svg")));
T("plus d'icon-192.svg ni d'icon-512.svg", !fs.existsSync(path.join(SITE, "icon-192.svg")) && !fs.existsSync(path.join(SITE, "icon-512.svg")));

console.log("\n--- Manifeste ---");
const man = JSON.parse(lire("manifest.webmanifest"));
const any = man.icons.filter(i => i.purpose === "any"), mask = man.icons.filter(i => i.purpose === "maskable");
T("deux icones any et deux maskable, separees", any.length === 2 && mask.length === 2 && !man.icons.some(i => /any maskable/.test(i.purpose)));
T("chaque icone du manifeste existe", man.icons.every(i => fs.existsSync(path.join(SITE, i.src))), man.icons.map(i => i.src).join(" "));

console.log("\n--- Service worker ---");
const core = JSON.parse((lire("sw.js").match(/const CORE=(\[[^\]]*\])/) || [])[1] || "[]");
T("le cache de base liste les nouvelles icones", ["/favicon.svg", "/icon-192.png"].every(f => core.includes(f)), core.join(" "));
T("chaque fichier du cache de base existe", core.filter(u => !u.endsWith("/")).every(u => fs.existsSync(path.join(SITE, u))), core.join(" "));

console.log("\n--- Aucune page ne pointe vers les anciennes icones ---");
let pages = 0, fautives = [];
const tour = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
  if (e.isDirectory()) tour(p); else if (e.name.endsWith(".html")) { pages++; if (/icon-(192|512)\.svg/.test(fs.readFileSync(p, "utf8"))) fautives.push(path.relative(SITE, p)); } } };
tour(SITE);
T(pages + " pages sans icon-192.svg ni icon-512.svg", !fautives.length, fautives.slice(0, 3).join(" "));

console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
process.exit(ko ? 1 : 0);
