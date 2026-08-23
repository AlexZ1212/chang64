#!/usr/bin/env python3
"""Convertit les images de partage SVG en PNG 1200x630.

Appele par build_site.js apres la generation des SVG. Les balises og:image
pointent vers des .png : sans cette etape, les vignettes de partage
(WhatsApp, Reddit, X, LinkedIn) restent vides.

Dependance : cairosvg  ->  pip install cairosvg
"""
import os
import sys
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
OG = os.path.join(HERE, "site", "og")

try:
    import cairosvg
except ImportError:
    sys.stderr.write(
        "og_render.py : cairosvg est absent.\n"
        "  pip install cairosvg\n"
        "Les SVG sont generes mais les PNG manquent : les vignettes de\n"
        "partage seront vides tant que la conversion n'a pas eu lieu.\n"
    )
    sys.exit(1)

svgs = sorted(glob.glob(os.path.join(OG, "*.svg")))
if not svgs:
    sys.stderr.write("og_render.py : aucun SVG trouve dans %s\n" % OG)
    sys.exit(1)

done = 0
for src in svgs:
    dst = src[:-4] + ".png"
    try:
        cairosvg.svg2png(
            url=src,
            write_to=dst,
            output_width=1200,
            output_height=630,
        )
        done += 1
    except Exception as exc:
        sys.stderr.write("og_render.py : echec sur %s : %s\n"
                         % (os.path.basename(src), exc))

# Les SVG ne servent qu'a produire les PNG : on les retire du site livre.
for src in svgs:
    try:
        os.remove(src)
    except OSError:
        pass

print("Images de partage  : %d PNG generes" % done)
