"""Regenerate native TTFs from the approved WOFF2 files.

Run with: uv run --with 'fonttools[woff]' scripts/convert-fonts.py
This does not download or substitute any font.
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1] / 'packages/design/assets/fonts'
for source in root.glob('*.woff2'):
    if source.stem == 'NotoNaskhArabicUI':
        for weight in (400, 600):
            font = TTFont(source, recalcTimestamp=False)
            font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
            font.flavor = None
            font.save(source.with_name(f'NotoNaskhArabicUI-{weight}.ttf'))
    else:
        font = TTFont(source, recalcTimestamp=False)
        font.flavor = None
        font.save(source.with_suffix('.ttf'))
