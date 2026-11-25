"""Translate Katty's screens with Google Cloud Translation, once, and ship
the result as public/i18n/<code>.json (the same files as the hand-checked
translations).

Only languages that have no file yet are translated, so the hand-checked
ones are never replaced. Placeholders like {country}, labels like [NAME_1]
and names like Katty and Gemini are kept as they are. A text whose
placeholders do not come back exactly stays in English.

The key is read from GOOGLE_TRANSLATE_API_KEY, in the environment or in
.env.local. It has no VITE_ prefix, so it never ends up in the app.

    python tools/translate_google.py --dry-run     # count characters, no key needed
    python tools/translate_google.py               # every language without a file
    python tools/translate_google.py fa so ti      # only these
"""

import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = 'https://translation.googleapis.com/language/translate/v2'
BATCH = 100  # the API takes up to 128 texts per request

# Katty's language codes that Google writes differently.
GOOGLE_CODE = {'nb': 'no', 'kmr': 'ku'}

# Kept exactly as they are: placeholders, labels and names.
KEEP = re.compile(r'\{\w+\}|\[[A-Z][A-Z ]*(?:_\d+)?(?::[^\]]*)?\]|Gemini Nano|Gemini|Katty|BankID|Firebase AI Logic|Google|Chrome|PDF|SFI|1177')
NO_TRANSLATE = re.compile(r'<span translate="no">(.*?)</span>', re.S)


def placeholders(text):
    return sorted(re.findall(r'\{\w+\}', text))


def languages():
    """(name, code) for every language in src/explain.js."""
    source = (ROOT / 'src' / 'explain.js').read_text(encoding='utf-8')
    block = source[source.index('export const LANGUAGES = ['):]
    block = block[: block.index('\n]')]
    return re.findall(r"name: '([^']*)'.*?code: '([^']*)'", block)


def api_key():
    key = os.environ.get('GOOGLE_TRANSLATE_API_KEY', '').strip()
    env_file = ROOT / '.env.local'
    if not key and env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith('GOOGLE_TRANSLATE_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"\'')
    if not key:
        sys.exit('No key. Add GOOGLE_TRANSLATE_API_KEY=... to .env.local (see the steps in the README).')
    return key


def call(url, key, body=None):
    request = urllib.request.Request(
        f'{url}?key={urllib.parse.quote(key)}',
        data=json.dumps(body).encode('utf-8') if body is not None else None,
        headers={'Content-Type': 'application/json; charset=utf-8'},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode('utf-8'))['data']
    except urllib.error.HTTPError as err:
        detail = err.read().decode('utf-8', 'replace')
        try:
            detail = json.loads(detail)['error']['message']
        except (ValueError, KeyError):
            pass
        sys.exit(f'Google said {err.code}: {detail}')


def wrap(text):
    """Escape the text as HTML and mark what must not be translated."""
    out, last = [], 0
    for match in KEEP.finditer(text):
        out.append(html.escape(text[last:match.start()], quote=False))
        out.append(f'<span translate="no">{html.escape(match.group(), quote=False)}</span>')
        last = match.end()
    out.append(html.escape(text[last:], quote=False))
    return ''.join(out)


def unwrap(text):
    return html.unescape(NO_TRANSLATE.sub(r'\1', text)).strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry_run = '--dry-run' in sys.argv
    strings = json.loads((ROOT / 'src' / 'ui-strings.json').read_text(encoding='utf-8'))
    wrapped = [wrap(s) for s in strings]
    out_dir = ROOT / 'public' / 'i18n'

    targets = [(name, code) for name, code in languages() if code != 'en']
    if args:
        targets = [(name, code) for name, code in targets if code in args]
    else:
        targets = [(name, code) for name, code in targets if not (out_dir / f'{code}.json').exists()]

    chars = sum(len(w) for w in wrapped)
    print(f'{len(strings)} texts, about {chars} characters per language, {len(targets)} languages:')
    print(' ', ', '.join(name for name, _ in targets))
    total = chars * len(targets)
    print(f'About {total} characters in all. The first 500,000 a month are free, then about $20 per million.')
    if dry_run or not targets:
        return

    key = api_key()
    supported = {lang['language'] for lang in call(f'{API}/languages', key)['languages']}

    for name, code in targets:
        google = GOOGLE_CODE.get(code, code)
        if google not in supported:
            print(f'{name} ({code}): Google Translate does not offer it, skipped')
            continue
        result = {}
        dropped = []
        for start in range(0, len(strings), BATCH):
            batch = wrapped[start:start + BATCH]
            data = call(API, key, {'q': batch, 'source': 'en', 'target': google, 'format': 'html'})
            for english, item in zip(strings[start:start + BATCH], data['translations']):
                translated = unwrap(item['translatedText'])
                if translated and placeholders(translated) == placeholders(english):
                    result[english] = translated
                else:
                    dropped.append(english)
        path = out_dir / f'{code}.json'
        path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{name} ({code}): {len(result)} of {len(strings)} texts written to {path.name}'
              + (f', {len(dropped)} stay in English' if dropped else ''))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
