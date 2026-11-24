"""Collect Kamarat's interface texts into src/ui-strings.json.

Every text shown by the app is written in English inside t('...') (or msg('...')
for texts kept in data, like the worry levels). This script finds them all, so
the app can have them translated in one go.

Run it after adding or changing a text:
    python tools/extract_strings.py
"""

import json
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
CALL = re.compile(r"""\b(?:t|msg)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")


def unescape(text):
    return re.sub(r"\\(.)", r"\1", text)


def main():
    found = []
    for path in sorted(SRC.rglob("*")):
        if path.suffix not in {".js", ".jsx"}:
            continue
        for match in CALL.finditer(path.read_text(encoding="utf-8")):
            text = unescape(match.group(1) if match.group(1) is not None else match.group(2))
            if text and text not in found:
                found.append(text)
    out = SRC / "ui-strings.json"
    out.write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(found)} texts written to {out}")


if __name__ == "__main__":
    main()
