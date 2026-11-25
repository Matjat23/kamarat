"""Score Katty's privacy check against the made-up test notices.

1. python tools/make_test_notices.py
2. Open Katty with ?eval at the end of the address (for example
   http://localhost:5173/?eval) and press "Run the test". On a computer with
   Gemini Nano it uses on-device AI plus the pattern check; elsewhere only the
   pattern check. Download results.json.
3. python tools/score.py results.json

What is scored is the text Katty would send (the payload), not the list of
details it found. A detail counts as protected when no part of it is left in
the payload: every comma-separated part, and for names every word of three
letters or more. Matching ignores letter case, spaces and commas.

The report also says how much of the other text was kept, so hiding the whole
letter would not score well.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

LABEL = re.compile(r"\[[A-Z]+_\d+\]")


def norm(text):
    return re.sub(r"[\s,]+", " ", text.lower()).strip()


def pieces(detail):
    parts = [norm(p) for p in detail["text"].split(",")]
    parts = [p for p in parts if len(p) >= 2]
    if detail["type"] == "NAME":
        parts += [w for w in norm(detail["text"]).replace(".", " ").split() if len(w) >= 3]
    return sorted(set(parts))


def appears(piece, text):
    return re.search(rf"(?<!\w){re.escape(piece)}(?!\w)", text) is not None


def leaked(detail, payload):
    text = norm(payload)
    return [p for p in pieces(detail) if appears(p, text)]


def personal_chars(text, details):
    """How many characters of the original text belong to the expected details."""
    covered = set()
    for detail in details:
        for piece in detail["text"].split(","):
            words = piece.split()
            if not words:
                continue
            pattern = r"[\s,]+".join(re.escape(w) for w in words)
            for m in re.finditer(pattern, text, re.IGNORECASE):
                covered.update(range(m.start(), m.end()))
    return len(covered)


def kept_ratio(text, payload, details):
    """Share of the non-personal text that is still in the payload. Personal
    text that was left in does not count as kept."""
    other = len(text) - personal_chars(text, details)
    plain = LABEL.sub("", payload)
    kept = len(plain) - personal_chars(plain, details)
    return min(1.0, kept / other) if other else 1.0


def duplicates(ids):
    return sorted(i for i, n in Counter(ids).items() if n > 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("results", help="results.json downloaded from the ?eval page")
    parser.add_argument("--notices", default="public/eval/notices.json")
    parser.add_argument("--report", default="eval-report.md")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    notice_list = json.loads(Path(args.notices).read_text(encoding="utf-8"))
    results = json.loads(Path(args.results).read_text(encoding="utf-8"))
    runs = results["runs"]

    for what, ids in (("notice", [n["id"] for n in notice_list]), ("result", [r["id"] for r in runs])):
        if duplicates(ids):
            sys.exit(f"Duplicate {what} ids: {', '.join(duplicates(ids))}")
    notices = {n["id"]: n for n in notice_list}
    unknown = [r["id"] for r in runs if r["id"] not in notices]
    if unknown:
        sys.exit(f"Results for notices that are not in {args.notices}: {', '.join(unknown)}")
    if any("payload" not in r for r in runs):
        sys.exit("This results.json has no payload. Run the test again with the current version of Katty.")

    per_type = defaultdict(lambda: [0, 0])
    leaks, extra, ratios = [], [], []
    modes = Counter(r["mode"] for r in runs)

    for run in runs:
        notice = notices[run["id"]]
        payload = run["payload"]
        for detail in notice["details"]:
            per_type[detail["type"]][1] += 1
            left = leaked(detail, payload)
            if left:
                leaks.append((run["id"], detail["type"], detail["text"], left))
            else:
                per_type[detail["type"]][0] += 1
        expected = [norm(d["text"]) for d in notice["details"]]
        for f in run["found"]:
            if not any(norm(f["text"]) in e or e in norm(f["text"]) for e in expected):
                extra.append((run["id"], f["text"]))
        ratios.append((kept_ratio(notice["text"], payload, notice["details"]), run["id"]))

    protected = sum(v[0] for v in per_type.values())
    total = sum(v[1] for v in per_type.values())
    average_kept = sum(r for r, _ in ratios) / len(ratios)
    lowest_kept, lowest_id = min(ratios)
    lines = [
        "# Katty privacy check: test results",
        "",
        f"Test notices: {len(runs)} (all made up). Mode: " + ", ".join(f"{k} ({v})" for k, v in modes.items()),
        f"Browser: {results.get('browser', 'unknown')}",
        "",
        f"**Personal details kept out of the shared text: {protected} of {total} ({protected / total:.0%})**",
        "",
        "| Kind | Protected | Total | Rate |",
        "|---|---|---|---|",
    ]
    for kind in sorted(per_type):
        h, t = per_type[kind]
        lines.append(f"| {kind} | {h} | {t} | {h / t:.0%} |")
    lines += [
        "",
        f"Other text kept: {average_kept:.0%} on average, lowest {lowest_kept:.0%} ({lowest_id}).",
        f"Hidden text that was not a personal detail: {len(extra)}",
        "",
    ]
    if leaks:
        lines += ["## Left in the shared text", ""]
        lines += [f"- {i}: {k} `{t}` (left: {', '.join(left)})" for i, k, t, left in leaks] + [""]
    if extra:
        lines += ["## Hidden but not personal (over-hiding)", ""] + [f"- {i}: `{t}`" for i, t in extra] + [""]

    report = "\n".join(lines)
    Path(args.report).write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
