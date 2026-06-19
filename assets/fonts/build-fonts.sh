#!/usr/bin/env bash
# Rebuild the static font instances used by the ebook (ebook/src/book.html)
# and the Financial Foundation roadmap PDF (capy-roadmap/capy-roadmap.html).
#
# WHY: Fraunces and Instrument Sans are *variable* fonts on Google Fonts.
# When Chromium's Skia/PDF backend prints a page that uses a variable font,
# it cannot embed it as a normal TrueType face, so it falls back to a
# Type3 font where EVERY glyph is a little vector-drawing procedure. That
# made the exported PDF ~1.8 MB and very slow to open in PDF readers.
#
# The fix is to ship *static* instances (all variation axes pinned). Those
# embed as ordinary subsetted TrueType/CID fonts: small, fast, selectable.
#
# Requires: python3 with fonttools + brotli  (pip install fonttools brotli)
set -euo pipefail
cd "$(dirname "$0")"
SRC=_src
mkdir -p "$SRC"

# 1. Download the upstream variable fonts (Google Fonts, OFL).
base="https://raw.githubusercontent.com/google/fonts/main/ofl"
curl -sL -o "$SRC/Fraunces-roman.ttf"        "$base/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
curl -sL -o "$SRC/Fraunces-italic.ttf"       "$base/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
curl -sL -o "$SRC/InstrumentSans-roman.ttf"  "$base/instrumentsans/InstrumentSans%5Bwdth%2Cwght%5D.ttf"
curl -sL -o "$SRC/InstrumentSans-italic.ttf" "$base/instrumentsans/InstrumentSans-Italic%5Bwdth%2Cwght%5D.ttf"

# 2. Instance to the exact static weights book.html declares, then subset to Latin.
#    Fraunces optical size is pinned at opsz=34 (a good middle for the mix of
#    large display headings and smaller serif accents in the book).
python3 - <<'PY'
from fontTools import ttLib
from fontTools.varLib.instancer import instantiateVariableFont
import os
SRC="_src"
def make(src, axes, out):
    f = ttLib.TTFont(os.path.join(SRC, src))
    instantiateVariableFont(f, axes, inplace=True, updateFontNames=False)
    if "STAT" in f: del f["STAT"]
    f.save(out)
OPSZ = 34
for w in (300,400,450,500,600):
    make("Fraunces-roman.ttf",  {"opsz":OPSZ,"wght":w,"SOFT":0,"WONK":0}, f"Fraunces-{w}.ttf")
for w in (400,450,500):
    make("Fraunces-italic.ttf", {"opsz":OPSZ,"wght":w,"SOFT":0,"WONK":0}, f"Fraunces-Italic-{w}.ttf")
for w in (400,600,700):
    make("InstrumentSans-roman.ttf", {"wght":w,"wdth":100}, f"InstrumentSans-{w}.ttf")
make("InstrumentSans-italic.ttf", {"wght":400,"wdth":100}, "InstrumentSans-Italic-400.ttf")
print("instanced")
PY

UNI="U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2070-209F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+2600-27BF"
for f in Fraunces-*.ttf InstrumentSans-*.ttf; do
  pyftsubset "$f" --unicodes="$UNI" --layout-features='*' --no-hinting --desubroutinize --output-file="$f.sub"
  mv "$f.sub" "$f"
done

rm -rf "$SRC"

# 3. Noto Naskh Arabic (the Noto serif-style Arabic family — there is no
#    "Noto Serif Arabic"), subset to the single U+FDFA ligature ﷺ used in the
#    back-cover salawat. Naskh renders this as a clear calligraphic glyph;
#    Fraunces has no Arabic coverage and fell back to a cramped system font.
NOTO_TAG="noto-monthly-release-2025.12.01"
curl -sL -o "$SRC.naskh.ttf" \
  "https://raw.githubusercontent.com/notofonts/notofonts.github.io/$NOTO_TAG/fonts/NotoNaskhArabic/unhinted/ttf/NotoNaskhArabic-Regular.ttf"
pyftsubset "$SRC.naskh.ttf" --unicodes="U+FDFA" --layout-features='*' --no-hinting \
  --desubroutinize --output-file="NotoNaskhArabic-FDFA.ttf"
rm -f "$SRC.naskh.ttf"

echo "Done. Static instances rebuilt in $(pwd)"
