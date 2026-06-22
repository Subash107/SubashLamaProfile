"""Analyse rejection patterns from job-applications.json and print stats."""
import json
import os
from collections import Counter

FILE = os.environ.get("APP_FILE", "download-logs/job-applications.json")

try:
    apps = json.load(open(FILE))
except (FileNotFoundError, json.JSONDecodeError):
    apps = []

rejected = [a for a in apps if a.get("status") == "Rejected"]

if not rejected:
    print("NO_REJECTIONS")
    raise SystemExit(0)

total_applied  = len(apps)
total_rejected = len(rejected)
rejection_rate = round(total_rejected / total_applied * 100) if total_applied else 0

sources   = Counter(a.get("source", "Unknown")  for a in rejected)
companies = Counter(a.get("company", "Unknown") for a in rejected)

top_sources   = ", ".join(f"{s}:{c}" for s, c in sources.most_common(3))
top_companies = ", ".join(f"{c}:{n}" for c, n in companies.most_common(3))

recent      = rejected[-5:]
recent_list = "\n".join(f"  - {a.get('company','?')} ({a.get('role','?')})" for a in reversed(recent))

print(f"total_applied={total_applied}")
print(f"total_rejected={total_rejected}")
print(f"rejection_rate={rejection_rate}")
print(f"top_sources={top_sources}")
print(f"top_companies={top_companies}")
print(f"recent={recent_list}")
