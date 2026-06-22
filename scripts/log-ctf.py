"""
Append a CTF submission to download-logs/ctf-log.json.
"""
import json
import os
from datetime import datetime, timezone

FILE = "download-logs/ctf-log.json"

try:
    with open(FILE) as f:
        entries = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    entries = []

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

entry = {
    "date":      os.environ.get("CTF_DATE",     today),
    "ctf":       os.environ.get("CTF_NAME",     "Unknown CTF"),
    "challenge": os.environ.get("CTF_CHALLENGE","Unknown"),
    "category":  os.environ.get("CTF_CATEGORY", "General"),
    "points":    int(os.environ.get("CTF_POINTS", "0")),
    "notes":     os.environ.get("CTF_NOTES",    ""),
}

entries.append(entry)

with open(FILE, "w") as f:
    json.dump(entries, f, indent=2)

# Stats
from collections import Counter
from datetime import timedelta

total_flags  = len(entries)
total_points = sum(e.get("points", 0) for e in entries)

week_start  = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
week_flags  = sum(1 for e in entries if e.get("date", "") >= week_start)
week_points = sum(e.get("points", 0) for e in entries if e.get("date", "") >= week_start)

categories  = Counter(e.get("category", "Unknown") for e in entries)
top_cats    = ", ".join(f"{c}:{n}" for c, n in categories.most_common(3))

ctfs        = Counter(e.get("ctf", "Unknown") for e in entries)
top_ctfs    = ", ".join(f"{c}:{n}" for c, n in ctfs.most_common(3))

print(f"total_flags={total_flags}")
print(f"total_points={total_points}")
print(f"week_flags={week_flags}")
print(f"week_points={week_points}")
print(f"top_cats={top_cats}")
print(f"top_ctfs={top_ctfs}")
