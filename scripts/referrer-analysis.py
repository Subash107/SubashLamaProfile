"""Analyse referrer sources from download log and print breakdown."""
import os
from collections import Counter

LOG      = os.environ.get("LOG_FILE", "download-logs/resume-downloads.txt")
WEEK_AGO = os.environ.get("WEEK_AGO", "")

refs  = []
total = 0

try:
    with open(LOG) as f:
        for line in f:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            parts = line.split("|")
            date  = parts[0].strip()[:10]
            ref   = parts[7].strip() if len(parts) > 7 else ""
            if WEEK_AGO and date < WEEK_AGO:
                continue
            total += 1
            if not ref or ref in ("", "none", "None", "-"):
                ref = "direct"
            elif "linkedin" in ref.lower():
                ref = "LinkedIn"
            elif "github" in ref.lower():
                ref = "GitHub"
            elif "google" in ref.lower():
                ref = "Google"
            elif "twitter" in ref.lower() or "x.com" in ref.lower():
                ref = "Twitter/X"
            elif "indeed" in ref.lower():
                ref = "Indeed"
            elif "glassdoor" in ref.lower():
                ref = "Glassdoor"
            else:
                ref = "Other"
            refs.append(ref)
except FileNotFoundError:
    print("total=0")
    raise SystemExit(0)

if not refs:
    print("total=0")
    raise SystemExit(0)

counts = Counter(refs)
print(f"total={total}")
for src, cnt in counts.most_common():
    pct = round(cnt / total * 100)
    print(f"{src}: {cnt} ({pct}%)")
