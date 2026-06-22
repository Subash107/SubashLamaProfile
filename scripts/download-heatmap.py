"""Analyse download time patterns and print heatmap stats."""
import os
import re
from collections import Counter

LOG      = os.environ.get("LOG_FILE", "download-logs/resume-downloads.txt")
WEEK_AGO = os.environ.get("WEEK_AGO", "")

hours_all  = []
hours_week = []

try:
    with open(LOG) as f:
        for line in f:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            parts = line.split("|")
            ts    = parts[0].strip()
            date  = ts[:10]
            m     = re.search(r"T?(\d{2}):", ts[10:]) or re.search(r" (\d{2}):", ts)
            if not m:
                continue
            hour = int(m.group(1))
            hours_all.append(hour)
            if WEEK_AGO and date >= WEEK_AGO:
                hours_week.append(hour)
except FileNotFoundError:
    print("NO_DATA")
    raise SystemExit(0)

if not hours_all:
    print("NO_DATA")
    raise SystemExit(0)


def label_utc(h):
    suffix = "AM" if h < 12 else "PM"
    h12    = h % 12 or 12
    return f"{h12:02d}:00 {suffix} UTC"


def label_npt(h):
    nh     = (h + 5) % 24
    suffix = "AM" if nh < 12 else "PM"
    h12    = nh % 12 or 12
    return f"{h12}:45 {suffix} NPT"


c_all  = Counter(hours_all)
c_week = Counter(hours_week)

top3_all  = c_all.most_common(3)
top3_week = c_week.most_common(3)

peak_utc   = top3_all[0][0] if top3_all else 0
top_week_str = "\n".join(
    f"  {label_utc(h)} ({label_npt(h)}) — {c} downloads"
    for h, c in top3_week
) if top3_week else "  No data this week"

print(f"total_all={len(hours_all)}")
print(f"total_week={len(hours_week)}")
print(f"peak_utc={label_utc(peak_utc)}")
print(f"peak_npt={label_npt(peak_utc)}")
print(f"top_week={top_week_str}")
