# chang64 — fichiers d'identité

Le signe (l'éléphant) et le damier 4 × 4 ardoise et nuit.

**Orientation (25/10/2026) : l'éléphant regarde à droite.** La livraison d'origine le tournait vers la gauche ; placé à gauche du logotype, il tournait le dos au nom « chang64 ». Tous les tracés de l'éléphant ont été retournés (x → 64 − x, sens des arcs inversé ; 108 pour Android), les fonds et le damier sont inchangés, et les PNG, le `.ico` et l'image de partage ont été régénérés depuis les sources SVG. Seule `planche-livrables.png`, capture de présentation, montre encore l'orientation d'origine.
Couleurs : laiton `#E0A93B`, encre `#101413`, nuit `#191F1D`, ardoise `#232B28`.

## À mettre à la racine du site

| Fichier | Usage |
|---|---|
| `favicon.ico` | Onglet, anciens navigateurs (16, 32 et 48 px dans un seul fichier) |
| `svg/favicon.svg` → `/favicon.svg` | Onglet, navigateurs récents : signe allégé sur carré `#101413` |
| `png/apple-touch-icon.png` → `/apple-touch-icon.png` | Écran d'accueil iOS (180 px, plein cadre, sans transparence) |
| `png/icon-192.png`, `png/icon-512.png` | Application web, icône standard (« any ») |
| `png/maskable-192.png`, `png/maskable-512.png` | Application web, icône découpée par le système (« maskable ») |
| `png/og-image.png` | Image de partage (1200 × 630) |
| `manifest.webmanifest` | Manifeste de l'application web |
| `head.html` | Balises à copier dans `<head>` (remplacer `[VOTRE-DOMAINE]`) |

## Signes à une couleur

- `svg/signe.svg` : le signe principal, pour 24 px et plus (en-tête, à côté du logotype).
- `svg/signe-allege.svg` : le signe allégé, sous 24 px (sans l'œil, oreille plus ouverte).

Les deux utilisent `fill="currentColor"` : la couleur vient du CSS (`color: #E0A93B`, ou `#ECEAE3` en crème, ou `#101413` sur fond clair).

## Android (application native)

Copier `android/res/` dans le module de l'application. L'icône adaptative est composée de :
- un fond : le damier, en 6 × 6 cases de 18 dp, pour que la zone visible montre toujours 4 × 4 cases ;
- un premier plan : l'éléphant, dans la zone sûre de 66 dp ;
- une version monochrome, pour les icônes thématiques d'Android 13 et plus.

`android/play-store-512.png` est l'icône de la fiche Play Store.

## Sources

`svg/og-image.source.html` est la source de l'image de partage : polices Source Serif 4 et JetBrains Mono, via Google Fonts.
