"""
Daily report generator for Subash Lama's portfolio tracking system.

Reads:
  - download-logs/resume-downloads.txt
  - download-logs/job-applications.json

Writes to reports/output/:
  - downloads-all.csv          every download event
  - downloads-daily.csv        aggregated by date
  - downloads-country.csv      by country
  - downloads-company.csv      by company / org
  - applications.csv           job application log
  - weekly-summary.csv         week-over-week stats
"""

import csv
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

# ── Config ────────────────────────────────────────────────────────────────────
LOG_FILE  = "download-logs/resume-downloads.txt"
APPS_FILE = "download-logs/job-applications.json"
OUT_DIR   = "reports/output"

HOT_LEADS = [
    "microsoft", "google", "amazon", "apple", "meta", "netflix", "cisco",
    "ibm", "oracle", "salesforce", "adobe", "intel", "nvidia", "palo alto",
    "crowdstrike", "sentinelone", "splunk", "fortinet", "check point",
    "deloitte", "kpmg", "pwc", "ernst", "accenture", "infosys", "wipro",
    "tcs", "hcl", "capgemini", "cognizant", "mantech", "booz allen",
    "leidos", "saic", "raytheon", "lockheed", "northrop", "bae",
]

os.makedirs(OUT_DIR, exist_ok=True)


# ── Parse download log ─────────────────────────────────────────────────────────
def parse_log():
    rows = []
    if not os.path.exists(LOG_FILE):
        return rows
    with open(LOG_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            parts = [p.strip() for p in line.split("|")]
            while len(parts) < 8:
                parts.append("")
            ts       = parts[0]
            ip       = parts[1]
            location = parts[2]
            org      = parts[3]
            os_name  = parts[4]
            browser  = parts[5]
            device   = parts[6]
            referrer = parts[7]

            # Extract country (last item in "City, Region, Country")
            loc_parts = [x.strip() for x in location.split(",")]
            country   = loc_parts[-1] if loc_parts else "Unknown"
            city      = loc_parts[0]  if len(loc_parts) > 1 else ""

            date = ts[:10] if len(ts) >= 10 else ""

            is_hot = any(h in org.lower() for h in HOT_LEADS)

            rows.append({
                "timestamp": ts,
                "date":      date,
                "ip":        ip,
                "location":  location,
                "city":      city,
                "country":   country,
                "org":       org,
                "os":        os_name,
                "browser":   browser,
                "device":    device,
                "referrer":  referrer,
                "is_hot_lead": "YES" if is_hot else "no",
            })
    return rows


# ── Parse applications ────────────────────────────────────────────────────────
def parse_apps():
    if not os.path.exists(APPS_FILE):
        return []
    with open(APPS_FILE) as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


# ── Write downloads-all.csv ───────────────────────────────────────────────────
def write_downloads_all(rows):
    path = os.path.join(OUT_DIR, "downloads-all.csv")
    fields = ["timestamp", "date", "ip", "location", "city", "country",
              "org", "os", "browser", "device", "referrer", "is_hot_lead"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"  downloads-all.csv      — {len(rows)} rows")


# ── Write downloads-daily.csv ─────────────────────────────────────────────────
def write_downloads_daily(rows):
    by_date = defaultdict(lambda: {"count": 0, "hot_leads": 0, "countries": set(), "orgs": set()})
    for r in rows:
        d = r["date"]
        by_date[d]["count"]     += 1
        by_date[d]["hot_leads"] += (1 if r["is_hot_lead"] == "YES" else 0)
        if r["country"]:
            by_date[d]["countries"].add(r["country"])
        if r["org"]:
            by_date[d]["orgs"].add(r["org"])

    path = os.path.join(OUT_DIR, "downloads-daily.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "downloads", "hot_leads", "unique_countries", "unique_companies"])
        for date in sorted(by_date):
            d = by_date[date]
            w.writerow([date, d["count"], d["hot_leads"],
                        len(d["countries"]), len(d["orgs"])])
    print(f"  downloads-daily.csv    — {len(by_date)} days")


# ── Write downloads-country.csv ───────────────────────────────────────────────
def write_downloads_country(rows):
    by_country = defaultdict(lambda: {"total": 0, "first": None, "last": None})
    for r in rows:
        c = r["country"] or "Unknown"
        by_country[c]["total"] += 1
        if not by_country[c]["first"] or r["date"] < by_country[c]["first"]:
            by_country[c]["first"] = r["date"]
        if not by_country[c]["last"] or r["date"] > by_country[c]["last"]:
            by_country[c]["last"] = r["date"]

    total = sum(v["total"] for v in by_country.values())
    path  = os.path.join(OUT_DIR, "downloads-country.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["country", "downloads", "pct_of_total", "first_seen", "last_seen"])
        for country, d in sorted(by_country.items(), key=lambda x: -x[1]["total"]):
            pct = round(d["total"] / total * 100, 1) if total else 0
            w.writerow([country, d["total"], f"{pct}%", d["first"], d["last"]])
    print(f"  downloads-country.csv  — {len(by_country)} countries")


# ── Write downloads-company.csv ───────────────────────────────────────────────
def write_downloads_company(rows):
    by_org = defaultdict(lambda: {"total": 0, "is_hot": False, "last": None})
    for r in rows:
        org = r["org"] or "Unknown"
        by_org[org]["total"]  += 1
        by_org[org]["is_hot"]  = by_org[org]["is_hot"] or (r["is_hot_lead"] == "YES")
        if not by_org[org]["last"] or r["date"] > by_org[org]["last"]:
            by_org[org]["last"] = r["date"]

    path = os.path.join(OUT_DIR, "downloads-company.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["company", "downloads", "hot_lead", "last_seen"])
        for org, d in sorted(by_org.items(), key=lambda x: -x[1]["total"]):
            w.writerow([org, d["total"], "YES" if d["is_hot"] else "no", d["last"]])
    print(f"  downloads-company.csv  — {len(by_org)} companies")


# ── Write applications.csv ────────────────────────────────────────────────────
def write_applications(apps):
    path = os.path.join(OUT_DIR, "applications.csv")
    fields = ["date", "company", "role", "status", "source", "notes"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(sorted(apps, key=lambda a: a.get("date", ""), reverse=True))
    print(f"  applications.csv       — {len(apps)} applications")


# ── Write weekly-summary.csv ──────────────────────────────────────────────────
def write_weekly_summary(rows, apps):
    # Group downloads by ISO week
    by_week = defaultdict(lambda: {"downloads": 0, "hot_leads": 0, "countries": set()})
    for r in rows:
        if not r["date"]:
            continue
        try:
            dt   = datetime.strptime(r["date"], "%Y-%m-%d")
            week = dt.strftime("%Y-W%V")
            week_start = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
            by_week[week]["downloads"]  += 1
            by_week[week]["hot_leads"]  += (1 if r["is_hot_lead"] == "YES" else 0)
            by_week[week]["week_start"]  = week_start
            if r["country"]:
                by_week[week]["countries"].add(r["country"])
        except ValueError:
            continue

    # Group applications by week
    app_by_week = defaultdict(lambda: {"applied": 0, "interviews": 0, "offers": 0})
    for a in apps:
        d = a.get("date", "")
        if not d:
            continue
        try:
            dt   = datetime.strptime(d, "%Y-%m-%d")
            week = dt.strftime("%Y-W%V")
            status = a.get("status", "")
            if status == "Applied":
                app_by_week[week]["applied"]    += 1
            elif status == "Interview":
                app_by_week[week]["interviews"] += 1
            elif status == "Offer":
                app_by_week[week]["offers"]     += 1
        except ValueError:
            continue

    all_weeks = sorted(set(list(by_week.keys()) + list(app_by_week.keys())))
    path = os.path.join(OUT_DIR, "weekly-summary.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["week", "week_start", "downloads", "hot_leads",
                    "unique_countries", "applications", "interviews", "offers"])
        for week in all_weeks:
            dl = by_week.get(week, {})
            ap = app_by_week.get(week, {})
            w.writerow([
                week,
                dl.get("week_start", ""),
                dl.get("downloads", 0),
                dl.get("hot_leads", 0),
                len(dl.get("countries", set())),
                ap.get("applied", 0),
                ap.get("interviews", 0),
                ap.get("offers", 0),
            ])
    print(f"  weekly-summary.csv     — {len(all_weeks)} weeks")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Generating daily CSV reports...")

    rows = parse_log()
    apps = parse_apps()

    print(f"\nSource data:")
    print(f"  Downloads  : {len(rows)}")
    print(f"  Applications: {len(apps)}")
    print(f"\nOutput files:")

    write_downloads_all(rows)
    write_downloads_daily(rows)
    write_downloads_country(rows)
    write_downloads_company(rows)
    write_applications(apps)
    write_weekly_summary(rows, apps)

    # Print quick summary for Telegram
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_count = sum(1 for r in rows if r["date"] == today)
    hot_today   = sum(1 for r in rows if r["date"] == today and r["is_hot_lead"] == "YES")
    week_ago    = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    week_count  = sum(1 for r in rows if r["date"] >= week_ago)
    total       = len(rows)
    countries   = len({r["country"] for r in rows if r["country"]})

    print(f"\nSummary for {today}:")
    print(f"  today={today_count}")
    print(f"  hot_today={hot_today}")
    print(f"  week={week_count}")
    print(f"  total={total}")
    print(f"  countries={countries}")
    print(f"  apps_total={len(apps)}")


if __name__ == "__main__":
    main()
