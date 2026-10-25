/* Traduction des pages statiques dans les langues autres que l'anglais et le
   francais (2026-10-25).

   L'anglais et le francais restent rediges cote a cote dans content.js et
   build_site.js. Pour les autres langues, chaque texte anglais sert de cle a
   un dictionnaire : langues/<code>/pages.js (et les fichiers qu'il reunit).
   C'est le principe de t() dans l'application, applique aux pages.

   Pourquoi la phrase anglaise comme cle, et pas un identifiant : quand
   l'anglais change, la traduction n'est plus trouvee, la page retombe sur
   l'anglais et le build le signale. Une traduction perimee ne peut donc pas
   survivre en silence a la phrase qu'elle traduisait.

   Chaque cle demandee mais absente est relevee ; build_site.js en ecrit la
   liste dans langues/<code>/manquants.json, et check_traductions.js exige
   qu'elle soit vide pour toute langue du registre.

   Gabarits : memes regles que t() (voir GRAMMAIRE.gabarit dans
   grammaire.js) : {x}, formes plurielles sur n, {x:acc}, {x?m|f}. */
const path = require("path");
const GRAMMAIRE = require("../grammaire.js");
const { PAR_CODE } = require("./registre.js");

const INTL = Object.fromEntries(Object.values(PAR_CODE).map(l => [l.code, l.intl]));
const cache = {};
function dico(lang) {
  if (!(lang in cache)) {
    let d = {};
    try { d = require(path.join(__dirname, lang, "pages.js")); } catch (e) {
      if (e.code !== "MODULE_NOT_FOUND") throw e;
    }
    cache[lang] = d;
  }
  return cache[lang];
}
const manquants = {};
function noterManquant(lang, cle) { (manquants[lang] = manquants[lang] || new Set()).add(cle); }

/* tr(lang, "English text", vars) : le texte dans la langue demandee. */
function tr(lang, en, vars) {
  if (lang === "en") return GRAMMAIRE.gabarit(en, vars);
  const textes = dico(lang).textes || {};
  let val = textes[en];
  if (val == null) { noterManquant(lang, en); val = en; }
  return GRAMMAIRE.gabarit(GRAMMAIRE.pluriel(val, vars, INTL[lang]), vars);
}
/* Entree d'une table nommee (noms d'ouvertures, notes, slugs...) : rend
   undefined si absente, et la releve. */
function table(lang, nom, cle, facultatif) {
  const t = dico(lang)[nom] || {};
  if (t[cle] == null) { if (!facultatif) noterManquant(lang, nom + ":" + cle); return undefined; }
  return t[cle];
}
/* Valeur {en, fr} du contenu existant, ou traduction de son anglais. */
function choix(lang, obj) {
  if (obj == null) return obj;
  if (obj[lang] != null) return obj[lang];
  return tr(lang, obj.en);
}
/* "lang === fr ? A : B" generalise : B est l'anglais, A le francais. */
function T(lang, en, fr, vars) {
  if (lang === "fr" && fr != null) return GRAMMAIRE.gabarit(fr, vars);
  return tr(lang, en, vars);
}
/* Lettres propres a la langue transcrites avant slug() (voir registre). */
function translit(lang, s) {
  const tb = (PAR_CODE[lang] || {}).translit;
  if (!tb) return s;
  return String(s).split("").map(c => tb[c] || c).join("");
}
function rapport() {
  const out = {};
  for (const l in manquants) out[l] = [...manquants[l]];
  return out;
}
module.exports = { tr, table, choix, T, rapport, translit, dico, INTL, GRAMMAIRE, PAR_CODE };
