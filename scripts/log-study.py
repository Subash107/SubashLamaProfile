"""
Append a study session to download-logs/study-log.json.
Reads fields from environment variables set by the workflow.
"""
import json
import os
from datetime import datetime, timezone

FILE = "download-logs/study-log.json"

try:
    with open(FILE) as f:
        sessions = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    sessions = []

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
week_ago = datetime.now(timezone.utc).strftime("%Y-%m-%d")

entry = {
    "date":    os.environ.get("STUDY_DATE",    today),
    "topic":   os.environ.get("STUDY_TOPIC",   "General"),
    "minutes": int(os.environ.get("STUDY_MINS", "0")),
    "notes":   os.environ.get("STUDY_NOTES",   ""),
}

sessions.append(entry)

with open(FILE, "w") as f:
    json.dump(sessions, f, indent=2)

# Stats
total_sessions = len(sessions)
total_minutes  = sum(s.get("minutes", 0) for s in sessions)
today_minutes  = sum(s.get("minutes", 0) for s in sessions if s.get("date") == today)

from datetime import timedelta
week_start = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
week_minutes = sum(s.get("minutes", 0) for s in sessions if s.get("date", "") >= week_start)

# Topic breakdown (all time)
from collections import Counter
topics = Counter(s.get("topic", "Unknown") for s in sessions)
top_topics = ", ".join(f"{t}:{m}hrs" for t, m in
    [(t, round(sum(s.get("minutes",0) for s in sessions if s.get("topic")==t)/60,1))
     for t, _ in topics.most_common(3)])

print(f"total_sessions={total_sessions}")
print(f"total_hours={round(total_minutes/60, 1)}")
print(f"today_minutes={today_minutes}")
print(f"week_hours={round(week_minutes/60, 1)}")
print(f"top_topics={top_topics}")
