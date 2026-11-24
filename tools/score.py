"""Score Kamarat's privacy check against the made-up test notices.

1. python tools/make_test_notices.py
2. Open Kamarat with ?eval at the end of the address (for example
   http://localhost:5173/?eval) and press "Run the test". On a computer with
   Gemini Nano it uses on-device AI plus the pattern check; elsewhere only the
   pattern check. Download results.json.
3. python tools/score.py results.json

A detail counts as found when Kamarat's hidden text covers it, ignoring
spaces, commas and letter case, the same way the app matches text.
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


def norm(text):
    return re.sub(r"[\s,]+", " ", text.lower()).strip()


def covered(expected, found_texts):
    want = norm(expected)
    return any(want == norm(f) or want in norm(f) for f in found_texts)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("results", help="results.json downloaded from the ?eval page")
    parser.add_argument("--notices", default="public/eval/notices.json")
    parser.add_argument("--report", default="eval-report.md")
    args = parser.parse_args()

    notices = {n["id"]: n for n in json.loads(Path(args.notices).read_text(encoding="utf-8"))}
    results = json.loads(Path(args.results).read_text(encoding="utf-8"))

    per_type = defaultdict(lambda: [0, 0])
    missed, extra = [], []
    modes = defaultdict(int)

    for run in results["runs"]:
        notice = notices[run["id"]]
        found = [f["text"] for f in run["found"]]
        modes[run["mode"]] += 1
        for detail in notice["details"]:
            per_type[detail["type"]][1] += 1
            if covered(detail["text"], found):
                per_type[detail["type"]][0] += 1
            else:
                missed.append((run["id"], detail["type"], detail["text"]))
        expected = [d["text"] for d in notice["details"]]
        for f in found:
            if not any(norm(f) in norm(e) or norm(e) in norm(f) for e in expected):
                extra.append((run["id"], f))

    hit = sum(v[0] for v in per_type.values())
    total = sum(v[1] for v in per_type.values())
    lines = [
        "# Kamarat privacy check: test results",
        "",
        f"Test notices: {len(results['runs'])} (all made up). Mode: "
        + ", ".join(f"{k} ({v})" for k, v in modes.items()),
        f"Browser: {results.get('browser', 'unknown')}",
        "",
        f"**Personal details found: {hit} of {total} ({hit / total:.0%})**",
        "",
        "| Kind | Found | Total | Rate |",
        "|---|---|---|---|",
    ]
    for kind in sorted(per_type):
        h, t = per_type[kind]
        lines.append(f"| {kind} | {h} | {t} | {h / t:.0%} |")
    lines += ["", f"Hidden text that was not a personal detail: {len(extra)}", ""]
    if missed:
        lines += ["## Missed", ""] + [f"- {i}: {k} `{t}`" for i, k, t in missed] + [""]
    if extra:
        lines += ["## Hidden but not personal (over-hiding)", ""] + [f"- {i}: `{t}`" for i, t in extra] + [""]

    report = "\n".join(lines)
    Path(args.report).write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
