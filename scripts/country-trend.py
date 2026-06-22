"""Compare country download counts month-over-month and print trend."""
import os
from collections import Counter

LOG        = os.environ.get("LOG_FILE", "download-logs/resume-downloads.txt")
THIS_MONTH = os.environ.get("THIS_MONTH", "")
LAST_MONTH = os.environ.get("LAST_MONTH", "")

this_countries = Counter()
last_countries = Counter()

try:
    with open(LOG) as f:
        for line in f:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            parts   = [p.strip() for p in line.split("|")]
            date    = parts[0][:7]
            loc     = parts[2].strip() if len(parts) > 2 else ""
            country = loc.split(",")[-1].strip() if loc else "Unknown"
            if not country:
                country = "Unknown"
            if THIS_MONTH and date == THIS_MONTH:
                this_countries[country] += 1
            if LAST_MONTH and date == LAST_MONTH:
                last_countries[country] += 1
except FileNotFoundError:
    print("this_total=0")
    print("last_total=0")
    raise SystemExit(0)

all_countries = set(list(this_countries.keys()) + list(last_countries.keys()))
rising  = []
falling = []
new     = []

for c in all_countries:
    t = this_countries.get(c, 0)
    l = last_countries.get(c, 0)
    if l == 0 and t > 0:
        new.append((c, t))
    elif t > l:
        rising.append((c, l, t))
    elif t < l:
        falling.append((c, l, t))

rising.sort(key=lambda x: -(x[2] - x[1]))
falling.sort(key=lambda x: x[2] - x[1])

print(f"this_total={sum(this_countries.values())}")
print(f"last_total={sum(last_countries.values())}")

for c, l, t in rising[:5]:
    print(f"rising={c}: {l} -> {t} (+{t-l})")
for c, l, t in falling[:3]:
    print(f"falling={c}: {l} -> {t} ({t-l})")
for c, t in new[:3]:
    print(f"new={c}: {t} downloads (NEW!)")
