/* Verifie le choix des adresses a signaler a IndexNow et la forme de l'envoi,
 * sans aucun appel reseau. */
const fs = require("fs"), path = require("path");
const { lireSitemap, aEnvoyer, paquets, envoyer } = require("../indexnow.js");

let ok = 0, ko = 0;
function verif(nom, c) { if (c) { ok++; console.log("  OK   " + nom); } else { ko++; console.log("  FAIL " + nom); } }

(async () => {
  const xml = `<urlset><url><loc>https://chang64.com/</loc><lastmod>2026-11-08</lastmod><priority>1.0</priority></url>
<url>
  <loc>https://chang64.com/fr/</loc>
  <lastmod>2026-11-01</lastmod>
</url><url><loc>https://chang64.com/puzzles/</loc><lastmod>2026-10-01</lastmod></url></urlset>`;
  const s = lireSitemap(xml);
  verif("sitemap : trois adresses lues", Object.keys(s).length === 3);
  verif("sitemap : date lue malgre les retours a la ligne", s["https://chang64.com/fr/"] === "2026-11-01");

  verif("premier envoi : tout part", aEnvoyer(s, {}).length === 3);
  verif("rien de neuf : rien ne part", aEnvoyer(s, { ...s }).length === 0);
  const modif = aEnvoyer(s, { ...s, "https://chang64.com/": "2026-11-07" });
  verif("date changee : seule cette page part", modif.length === 1 && modif[0] === "https://chang64.com/");
  const etatSansFr = { ...s }; delete etatSansFr["https://chang64.com/fr/"];
  verif("page nouvelle : elle part", aEnvoyer(s, etatSansFr)[0] === "https://chang64.com/fr/");

  const p = paquets(Array.from({ length: 25 }, (_, i) => i), 10);
  verif("paquets : 10 + 10 + 5", p.length === 3 && p[2].length === 5);

  const vrai = global.fetch, log = console.log;
  let appel = null;
  global.fetch = async (url, o) => { appel = { url, o }; return { status: 202 }; };
  const accepte = await envoyer("abc", ["https://chang64.com/"]);
  const corps = JSON.parse(appel.o.body);
  verif("envoi : 202 vaut accord", accepte === true);
  verif("envoi : POST sur l'API IndexNow", appel.o.method === "POST" && appel.url === "https://api.indexnow.org/indexnow");
  verif("envoi : hote, cle et emplacement de la cle",
    corps.host === "chang64.com" && corps.key === "abc" && corps.keyLocation === "https://chang64.com/abc.txt");
  verif("envoi : liste des adresses", corps.urlList.length === 1);
  console.log = () => {};
  global.fetch = async () => ({ status: 403 });
  const refuse = await envoyer("abc", ["https://chang64.com/"]);
  console.log = log;
  verif("envoi : 403 vaut refus", refuse === false);
  global.fetch = vrai;

  const cle = fs.readFileSync(path.join(__dirname, "..", "indexnow-cle.txt"), "utf8").trim();
  verif("cle : 32 caracteres hexadecimaux", /^[0-9a-f]{32}$/.test(cle));
  const fichier = path.join(__dirname, "..", "site", cle + ".txt");
  verif("build : fichier de cle ecrit a la racine", fs.existsSync(fichier) && fs.readFileSync(fichier, "utf8").trim() === cle);

  console.log(`\n=== ${ok} OK, ${ko} FAIL ===`);
  process.exitCode = ko ? 1 : 0;
})();
