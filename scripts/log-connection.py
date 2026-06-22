"""Append a LinkedIn connection to download-logs/connections.json."""
import json
import os
from datetime import datetime, timezone, timedelta

FILE = "download-logs/connections.json"

try:
    with open(FILE) as f:
        conns = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    conns = []

today    = datetime.now(timezone.utc).strftime("%Y-%m-%d")
week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

conns.append({
    "date":    today,
    "name":    os.environ.get("CONN_NAME",    "Unknown"),
    "company": os.environ.get("CONN_COMPANY", "Unknown"),
    "role":    os.environ.get("CONN_ROLE",    "Unknown"),
    "notes":   os.environ.get("CONN_NOTES",   ""),
})

with open(FILE, "w") as f:
    json.dump(conns, f, indent=2)

total      = len(conns)
week_count = sum(1 for c in conns if c.get("date", "") >= week_ago)

print(f"total={total}")
print(f"week={week_count}")
