/* Registre des langues du site (2026-10-25), seule source de verite.

   Decision d'Alexandre du 25/10 : anglais et francais, puis espagnol,
   portugais du Bresil, allemand et russe, dans cet ordre. Toute boucle sur
   les langues passe par ce tableau : build_site.js (pages statiques, accueil
   de l'application par langue, hreflang, sitemap, redirections), content.js
   et les tests. Ajouter une langue = une entree ici et un dossier
   langues/<code>/ avec ses traductions.

   - code      : prefixe d'URL et cle des dictionnaires.
   - intl      : locale d'Intl pour les nombres et les dates.
   - html      : valeur de <html lang>.
   - hreflang  : valeur annoncee aux moteurs. "pt" et non "pt-BR" : la
                 traduction est bresilienne, mais elle sert aussi le Portugal,
                 qui sinon tomberait sur l'anglais.
   - og        : og:locale.
   - nom       : nom de la langue dans la langue elle-meme, pour le selecteur.
   - accueil   : adresse de l'application dans cette langue. "/" reste
                 l'anglais et sert de x-default.
   - dirs      : dossier de chaque rubrique statique. Le russe garde les
                 dossiers anglais sous /ru/ : des URL en cyrillique seraient
                 encodees en %D0%... partout ou on les partage.
   - slugsAnglais : les pages de detail gardent le slug anglais (russe, pour
                 la meme raison).
   - translit  : lettres a transcrire avant de fabriquer un slug (allemand :
                 Läufer -> laeufer, et non laufer).

   L'anglais et le francais restent rediges dans content.js et build_site.js,
   comme avant. Les autres langues sont traduites a partir de l'anglais, par
   dictionnaire (voir langues/traduire.js) : une phrase anglaise modifiee n'a
   plus de traduction et le test check_traductions.js le signale. */
const LANGUES = [
  { code: "en", intl: "en-US", html: "en", hreflang: "en", og: "en_GB", nom: "English", accueil: "/",
    dirs: { openings: "openings", learn: "learn", glossary: "glossary",
            endgames: "endgames", puzzles: "puzzles", traps: "traps" } },
  { code: "fr", intl: "fr-FR", html: "fr", hreflang: "fr", og: "fr_FR", nom: "Français", accueil: "/fr/",
    dirs: { openings: "fr/ouvertures", learn: "fr/apprendre", glossary: "fr/lexique",
            endgames: "fr/finales", puzzles: "fr/exercices", traps: "fr/pieges" } },
  { code: "es", intl: "es-ES", html: "es", hreflang: "es", og: "es_ES", nom: "Español", accueil: "/es/",
    dirs: { openings: "es/aperturas", learn: "es/aprender", glossary: "es/glosario",
            endgames: "es/finales", puzzles: "es/motivos", traps: "es/trampas" } },
  { code: "pt", intl: "pt-BR", html: "pt-BR", hreflang: "pt", og: "pt_BR", nom: "Português", accueil: "/pt/",
    dirs: { openings: "pt/aberturas", learn: "pt/aprender", glossary: "pt/glossario",
            endgames: "pt/finais", puzzles: "pt/motivos", traps: "pt/armadilhas" } },
  { code: "de", intl: "de-DE", html: "de", hreflang: "de", og: "de_DE", nom: "Deutsch", accueil: "/de/",
    translit: { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss" },
    dirs: { openings: "de/eroeffnungen", learn: "de/regeln", glossary: "de/glossar",
            endgames: "de/endspiele", puzzles: "de/motive", traps: "de/fallen" } },
  { code: "ru", intl: "ru-RU", html: "ru", hreflang: "ru", og: "ru_RU", nom: "Русский", accueil: "/ru/", slugsAnglais: true,
    dirs: { openings: "ru/openings", learn: "ru/learn", glossary: "ru/glossary",
            endgames: "ru/endgames", puzzles: "ru/puzzles", traps: "ru/traps" } }
];
const CODES = LANGUES.map(l => l.code);
const PAR_CODE = Object.fromEntries(LANGUES.map(l => [l.code, l]));
module.exports = { LANGUES, CODES, PAR_CODE };
