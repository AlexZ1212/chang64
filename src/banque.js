/* Lecture et ecriture de la banque d'exercices, decoupee en tranches.

   Pourquoi (2026-10-24). La banque tenait dans un seul puzzles.json de
   52 Mo. La fusion des 18 fournees de fin de minage l'aurait porte vers
   190 Mo, or GitHub refuse tout fichier de plus de 100 Mo : le push de la
   publication aurait ete rejete. La banque vit donc dans banque/, un fichier
   par tranche de 25 000 identifiants (p0-p24999 dans tranche-000.json,
   p25000-p49999 dans tranche-001.json...), soit une dizaine de Mo chacun.

   Pourquoi par identifiant et pas par niveau : build_site.js recalcule le
   niveau a chaque construction, un exercice changerait donc de fichier sans
   avoir change. L'identifiant, lui, ne bouge jamais, et une fusion attribue
   des identifiants croissants : elle ajoute des tranches au lieu de reecrire
   toute la banque dans l'historique git.

   Un exercice par ligne, pour que git compare des lignes et non un bloc.

   Tous les scripts passent par ici. Un chemin de fichier .json explicite
   (fournee, ancienne banque, sauvegarde) reste lu et ecrit tel quel. */
const fs = require("fs");
const path = require("path");

const DOSSIER = path.join(__dirname, "banque");
const TRANCHE = 25000;
const nomTranche = k => "tranche-" + String(k).padStart(3, "0") + ".json";
const trancheDe = p => {
  const m = /^p(\d+)$/.exec(String(p.id || ""));
  if (!m) throw new Error("identifiant hors format : " + p.id);
  return Math.floor(+m[1] / TRANCHE);
};
const fichiersTranches = () => fs.existsSync(DOSSIER)
  ? fs.readdirSync(DOSSIER).filter(f => /^tranche-\d{3}\.json$/.test(f)).sort() : [];

/* Texte d'un lot : un exercice par ligne. Relu par JSON.parse sans aide. */
const enTexte = lot => "[\n" + lot.map(p => JSON.stringify(p)).join(",\n") + "\n]\n";

/* Sans argument : toute la banque, dans l'ordre des identifiants. Avec un
   chemin .json : ce fichier seul (fournee, sauvegarde, ancienne banque). */
function charger(chemin) {
  if (chemin && !(fs.existsSync(chemin) && fs.statSync(chemin).isDirectory()))
    return JSON.parse(fs.readFileSync(chemin, "utf8"));
  const dir = chemin || DOSSIER;
  const fichiers = chemin ? fs.readdirSync(dir).filter(f => /^tranche-\d{3}\.json$/.test(f)).sort() : fichiersTranches();
  if (!fichiers.length) throw new Error("banque introuvable : aucune tranche dans " + dir);
  const tout = [];
  for (const f of fichiers) for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) tout.push(p);
  return tout;
}

/* Reecrit la banque. Une tranche dont le contenu n'a pas change n'est pas
   touchee ; une tranche devenue vide est supprimee. Rend la liste des
   fichiers ecrits. Avec un chemin .json : ecrit ce fichier seul, compact. */
function ecrire(liste, chemin) {
  if (chemin) { fs.writeFileSync(chemin, JSON.stringify(liste)); return [chemin]; }
  fs.mkdirSync(DOSSIER, { recursive: true });
  const parTranche = new Map();
  for (const p of liste) { const k = trancheDe(p); if (!parTranche.has(k)) parTranche.set(k, []); parTranche.get(k).push(p); }
  const ecrits = [];
  for (const [k, lot] of parTranche) {
    lot.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
    const f = path.join(DOSSIER, nomTranche(k)), texte = enTexte(lot);
    if (fs.existsSync(f) && fs.readFileSync(f, "utf8") === texte) continue;
    fs.writeFileSync(f, texte);
    ecrits.push(f);
  }
  for (const f of fichiersTranches()) {
    const k = +f.slice(8, 11);
    if (!parTranche.has(k)) { fs.unlinkSync(path.join(DOSSIER, f)); ecrits.push(path.join(DOSSIER, f) + " (supprimee)"); }
  }
  return ecrits;
}

/* Copie horodatee de toute la banque en un seul fichier, a cote des
   sources (puzzles.<horodatage>.bak.json, ignore par git). A faire avant
   toute reecriture : une fusion ratee doit pouvoir se defaire. */
function sauvegarder() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const copie = path.join(__dirname, "puzzles." + stamp + ".bak.json");
  fs.writeFileSync(copie, JSON.stringify(charger()));
  return copie;
}

/* Le texte brut de toute la banque, pour une empreinte (build_site.js date
   l'application avec). */
function texte() {
  return fichiersTranches().map(f => fs.readFileSync(path.join(DOSSIER, f), "utf8")).join("");
}

module.exports = { DOSSIER, TRANCHE, charger, ecrire, sauvegarder, texte, trancheDe };
