"""
Append a job application entry to download-logs/job-applications.json.
Reads fields from environment variables set by the workflow.
"""
import json
import os
from datetime import datetime, timezone

FILE = "download-logs/job-applications.json"

try:
    with open(FILE) as f:
        apps = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    apps = []

entry = {
    "date":    os.environ.get("APP_DATE",    datetime.now(timezone.utc).strftime("%Y-%m-%d")),
    "company": os.environ.get("APP_COMPANY", "Unknown"),
    "role":    os.environ.get("APP_ROLE",    "Unknown"),
    "status":  os.environ.get("APP_STATUS",  "Applied"),
    "source":  os.environ.get("APP_SOURCE",  "LinkedIn"),
    "notes":   os.environ.get("APP_NOTES",   ""),
}

apps.append(entry)

with open(FILE, "w") as f:
    json.dump(apps, f, indent=2)

# Print summary stats for the Telegram message
total    = len(apps)
applied  = sum(1 for a in apps if a.get("status") == "Applied")
interview= sum(1 for a in apps if a.get("status") == "Interview")
offers   = sum(1 for a in apps if a.get("status") == "Offer")
rejected = sum(1 for a in apps if a.get("status") == "Rejected")

print(f"total={total}")
print(f"applied={applied}")
print(f"interview={interview}")
print(f"offers={offers}")
print(f"rejected={rejected}")
