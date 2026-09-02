#!/usr/bin/env python3
"""
og_render.py - convertit les images de partage (Open Graph) de SVG en PNG.

Appele par build_site.js juste apres la generation du site, via :
    python3 og_render.py

build_site.js ecrit un .svg par page dans site/og/<nom>.svg (fonction
queueOg()) mais le HTML genere pointe toujours vers <nom>.png dans les
balises <meta property="og:image">, jamais vers le .svg (les plateformes
sociales - Facebook, LinkedIn, Twitter/X - n'acceptent pas le SVG comme
image de partage). Ce script comble ce trou : il lit chaque .svg present
dans site/og/, le convertit en .png de meme nom a cote, et laisse le .svg
en place (inoffensif, non reference par le HTML).

Dependance : cairosvg (et sa lib systeme libcairo2).
    pip install cairosvg --break-system-packages
Si Debian/Ubuntu sans libcairo2 : sudo apt install libcairo2

Ce script ne fait rien de destructif : si un .png existe deja et est plus
recent que son .svg source, il est saute (reconstruction plus rapide en
developpement). Utiliser --force pour tout reconverfir.
"""
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OG_DIR = os.path.join(SCRIPT_DIR, "site", "og")


def main():
    force = "--force" in sys.argv

    if not os.path.isdir(OG_DIR):
        print(f"og_render.py : dossier introuvable ({OG_DIR}), rien a faire.")
        return 0

    try:
        import cairosvg
    except ImportError:
        print("og_render.py : le module 'cairosvg' est absent.")
        print("  Installer avec : pip install cairosvg --break-system-packages")
        print("  (necessite aussi la lib systeme libcairo2 : apt install libcairo2)")
        return 1

    svg_files = sorted(f for f in os.listdir(OG_DIR) if f.endswith(".svg"))
    if not svg_files:
        print("og_render.py : aucun .svg trouve dans site/og/.")
        return 0

    converted = 0
    skipped = 0
    failed = 0

    for fname in svg_files:
        svg_path = os.path.join(OG_DIR, fname)
        png_path = os.path.join(OG_DIR, fname[:-4] + ".png")

        if not force and os.path.isfile(png_path) and \
                os.path.getmtime(png_path) >= os.path.getmtime(svg_path):
            skipped += 1
            continue

        try:
            cairosvg.svg2png(url=svg_path, write_to=png_path,
                              output_width=1200, output_height=630)
            converted += 1
        except Exception as e:
            print(f"  echec sur {fname} : {e}")
            failed += 1

    print(f"og_render.py : {converted} converties, {skipped} deja a jour, "
          f"{failed} echecs (sur {len(svg_files)} .svg).")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
