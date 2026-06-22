"""Check upcoming cybersecurity conferences and print alerts."""
from datetime import datetime, timezone, timedelta

today = datetime.now(timezone.utc).date()

CONFERENCES = [
    {"name": "BSides Kathmandu",       "date": "2026-07-15", "url": "https://bsides.org",               "type": "LOCAL"},
    {"name": "DEF CON 34",             "date": "2026-08-06", "url": "https://defcon.org",                "type": "GLOBAL"},
    {"name": "Black Hat USA 2026",      "date": "2026-08-01", "url": "https://blackhat.com",             "type": "GLOBAL"},
    {"name": "SANS Cyber Defence",      "date": "2026-09-14", "url": "https://sans.org/cyber-defense",   "type": "TRAINING"},
    {"name": "SecureWorld",             "date": "2026-10-01", "url": "https://secureworld.io",           "type": "CAREER"},
    {"name": "ISC2 Security Congress",  "date": "2026-10-12", "url": "https://isc2.org/congress",        "type": "CERT"},
    {"name": "Hack In The Box",         "date": "2026-05-25", "url": "https://conference.hitb.org",      "type": "GLOBAL"},
    {"name": "AISA CyberCon 2026",      "date": "2026-11-10", "url": "https://cybercon.com.au",          "type": "REMOTE"},
    {"name": "NullCon",                 "date": "2026-03-01", "url": "https://nullcon.net",              "type": "GLOBAL"},
    {"name": "x33fcon",                 "date": "2026-06-10", "url": "https://x33fcon.com",              "type": "REMOTE"},
    {"name": "MITRE ATTACKcon 5",       "date": "2026-10-28", "url": "https://mitre.org/attackcon",      "type": "CAREER"},
    {"name": "BSides Las Vegas",        "date": "2026-08-04", "url": "https://bsideslv.org",             "type": "GLOBAL"},
]

alerts = []
for conf in CONFERENCES:
    try:
        conf_date = datetime.strptime(conf["date"], "%Y-%m-%d").date()
        days_away = (conf_date - today).days
        if 0 <= days_away <= 30:
            urgency = "TODAY!" if days_away == 0 else f"in {days_away} days"
            alerts.append(f"[{conf['type']}] {conf['name']} — {urgency} ({conf['date']})\n  {conf['url']}")
        elif 31 <= days_away <= 60:
            alerts.append(f"[{conf['type']}] {conf['name']} — in {days_away} days ({conf['date']})\n  {conf['url']}")
    except ValueError:
        continue

if alerts:
    print("HAS_ALERTS")
    for a in alerts:
        print(f"ALERT={a}")
else:
    print("NO_ALERTS")
