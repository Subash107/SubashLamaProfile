#!/usr/bin/env python3
import json, datetime, os

path = os.environ['STUDY_LOG']
try:
    with open(path) as f:
        entries = json.load(f)
    dates = sorted(set(e['date'][:10] for e in entries if 'date' in e), reverse=True)
    streak = 0
    today = datetime.date.today()
    for i, d in enumerate(dates):
        expected = (today - datetime.timedelta(days=i)).isoformat()
        if d == expected:
            streak += 1
        else:
            break
    print(streak)
except Exception:
    print(0)
