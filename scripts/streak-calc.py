"""Read GitHub events from stdin, calculate commit streak, print count."""
import json
import sys
from datetime import datetime, timedelta, timezone

events = json.load(sys.stdin)
push_dates = sorted(
    set(e["created_at"][:10] for e in events
        if isinstance(e, dict) and e.get("type") == "PushEvent"),
    reverse=True,
)

streak = 0
check = datetime.now(timezone.utc).date()
for date_str in push_dates:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    if d == check:
        streak += 1
        check = check - timedelta(days=1)
    elif d == check + timedelta(days=1) and streak == 0:
        streak += 1
        check = d - timedelta(days=1)
    elif d < check:
        break

print(streak)
