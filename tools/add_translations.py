"""Add translations for new interface texts to public/i18n/<code>.json.

ship_translation.py writes a whole language at once. This one adds a few new
texts to every shipped language, from a JSON file shaped like
{ "English text": { "sv": "...", "de": "...", ... }, ... }.

Every {placeholder} must be kept, every shipped language must be covered, and
the English text must exist in src/ui-strings.json.

    python tools/add_translations.py path/to/new-texts.json
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "public" / "i18n"


def placeholders(text):
    return sorted(re.findall(r"\{\w+\}", text))


def main():
    new = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    english = set(json.loads((ROOT / "src" / "ui-strings.json").read_text(encoding="utf-8")))
    codes = sorted(path.stem for path in I18N.glob("*.json"))

    problems = []
    for text, by_code in new.items():
        if text not in english:
            problems.append(f"not in ui-strings.json: {text!r}")
        for code in codes:
            translated = by_code.get(code)
            if not translated:
                problems.append(f"{code} missing: {text!r}")
            elif placeholders(translated) != placeholders(text):
                problems.append(f"{code} placeholder mismatch: {text!r} -> {translated!r}")
    if problems:
        sys.exit("\n".join(problems))

    for code in codes:
        path = I18N / f"{code}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for text, by_code in new.items():
            data[text] = by_code[code]
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Added {len(new)} texts to {len(codes)} languages")


if __name__ == "__main__":
    main()
