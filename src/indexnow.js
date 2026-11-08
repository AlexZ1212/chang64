/* chang64 - signale a Bing et aux autres moteurs IndexNow les pages modifiees
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * A lancer APRES une publication, une fois le site en ligne :
 *   node src/indexnow.js --essai   montre ce qui partirait, n'envoie rien
 *   node src/indexnow.js           envoie
 *
 * Compare le sitemap publie (chang64-site/sitemap.xml) a indexnow-envoye.json,
 * qui retient la date et l'empreinte deja signalees pour chaque adresse. Ce fichier n'est mis
 * a jour qu'apres une reponse positive : un envoi rate repartira au suivant.
 * Commiter indexnow-envoye.json avec la publication suivante.
 *
 * La cle est publique par construction : le moteur la relit sur le site
 * (/<cle>.txt, ecrit par build_site.js) pour verifier que l'envoi vient bien
 * du proprietaire du domaine. */
const fs = require("fs"), path = require("path");

const SITE = "https://chang64.com";
const API = "https://api.indexnow.org/indexnow";
const MAX_PAR_ENVOI = 10000;   /* limite du protocole */
const F_CLE = path.join(__dirname, "indexnow-cle.txt");
const F_ETAT = path.join(__dirname, "indexnow-envoye.json");
const F_SITEMAP = path.join(__dirname, "..", "chang64-site", "sitemap.xml");
const F_DATES = path.join(__dirname, "content-dates.json");

/* { adresse: date } lu dans le sitemap */
function lireSitemap(xml) {
  const out = {};
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) out[m[1]] = m[2];
  return out;
}
/* { adresse: "date:empreinte" }. La date seule ne suffit pas : une deuxieme
   publication le meme jour garde la meme date alors que la page a change.
   L'empreinte vient de content-dates.json, tenu a jour par le build. */
function signatures(sitemap, dates) {
  const out = {};
  for (const u of Object.keys(sitemap)) out[u] = sitemap[u] + ":" + ((dates[new URL(u).pathname] || {}).sceau || "");
  return out;
}
/* Adresses nouvelles ou dont la signature a change */
function aEnvoyer(sitemap, etat) {
  return Object.keys(sitemap).filter(u => etat[u] !== sitemap[u]);
}
function paquets(liste, taille) {
  const out = [];
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille));
  return out;
}
/* Rend true si le moteur a accepte. 200 et 202 valent accord. */
async function envoyer(cle, urls) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "chang64.com", key: cle, keyLocation: `${SITE}/${cle}.txt`, urlList: urls })
  });
  if (r.status !== 200 && r.status !== 202) {
    console.log("Refuse par IndexNow : HTTP " + r.status);
    return false;
  }
  return true;
}
async function cleEnLigne(cle) {
  try {
    const r = await fetch(`${SITE}/${cle}.txt`, { cache: "no-store" });
    return r.ok && (await r.text()).trim() === cle;
  } catch (e) { return false; }
}

async function main() {
  const essai = process.argv.includes("--essai");
  const cle = fs.readFileSync(F_CLE, "utf8").trim();
  const sitemap = signatures(lireSitemap(fs.readFileSync(F_SITEMAP, "utf8")), JSON.parse(fs.readFileSync(F_DATES, "utf8")));
  const etat = fs.existsSync(F_ETAT) ? JSON.parse(fs.readFileSync(F_ETAT, "utf8")) : {};
  const liste = aEnvoyer(sitemap, etat);
  console.log(`${Object.keys(sitemap).length} adresses au sitemap, ${liste.length} a signaler`);
  if (essai) {
    console.log(liste.slice(0, 10).join("\n"));
    if (liste.length > 10) console.log("...");
    console.log("Cle en ligne : " + (await cleEnLigne(cle) ? "oui" : "non (publier le site d'abord)"));
    return;
  }
  if (!liste.length) return;
  if (!(await cleEnLigne(cle))) {
    console.log("Le fichier de cle n'est pas en ligne : publier le site d'abord. Rien n'a ete envoye.");
    process.exitCode = 1;
    return;
  }
  for (const p of paquets(liste, MAX_PAR_ENVOI)) {
    if (!(await envoyer(cle, p))) { process.exitCode = 1; break; }
    for (const u of p) etat[u] = sitemap[u];
    fs.writeFileSync(F_ETAT, JSON.stringify(etat, null, 0).replace(/","/g, '",\n"') + "\n");
    console.log(p.length + " adresses signalees");
  }
}
if (require.main === module) main();
module.exports = { lireSitemap, signatures, aEnvoyer, paquets, envoyer };
