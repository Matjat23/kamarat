"""Turn a hand-written translation into public/i18n/<code>.json.

The translation is a JSON list in the same order as src/ui-strings.json.
The script checks the length and that every {placeholder} is kept, prints a
few pairs to eyeball, and writes the English -> translation map.

    python tools/ship_translation.py fr path/to/fr-list.json
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def placeholders(text):
    return sorted(re.findall(r"\{\w+\}", text))


def main():
    code, source = sys.argv[1], Path(sys.argv[2])
    english = json.loads((ROOT / "src" / "ui-strings.json").read_text(encoding="utf-8"))
    translated = json.loads(source.read_text(encoding="utf-8"))
    if len(english) != len(translated):
        sys.exit(f"Length differs: {len(english)} English texts, {len(translated)} translations")
    bad = [(e, t) for e, t in zip(english, translated) if placeholders(e) != placeholders(t)]
    if bad:
        for e, t in bad:
            print(f"placeholder mismatch:\n  {e}\n  {t}")
        sys.exit(1)
    for i in range(0, len(english), 40):
        print(f"{i:3}: {english[i]!r} -> {translated[i]!r}")
    out = ROOT / "public" / "i18n" / f"{code}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dict(zip(english, translated)), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(english)} texts to {out}")


if __name__ == "__main__":
    main()
