"""Check cert expiry dates and print ALERT/SUMMARY lines."""
import json
import os
from datetime import datetime, timezone

FILE  = os.environ.get("CERT_FILE", "download-logs/cert-expiry.json")
today = datetime.now(timezone.utc).date()

try:
    certs = json.load(open(FILE))
except (FileNotFoundError, json.JSONDecodeError):
    print("ERROR: cert-expiry.json not found or invalid")
    raise SystemExit(1)

for cert in certs:
    name    = cert.get("name", "Unknown")
    expires = cert.get("expires", "")
    url     = cert.get("renewal_url", "")
    try:
        exp_date = datetime.strptime(expires, "%Y-%m-%d").date()
        days     = (exp_date - today).days
        if days > 365 * 10:
            print(f"SUMMARY=  {name}: No expiry")
        else:
            print(f"SUMMARY=  {name}: {days} days remaining ({expires})")
        if days <= 7:
            print(f"ALERT=CRITICAL — {name} expires in {days} DAYS! Renew NOW: {url}")
        elif days <= 30:
            print(f"ALERT=URGENT — {name} expires in {days} days. Renew soon: {url}")
        elif days <= 90:
            print(f"ALERT=WARNING — {name} expires in {days} days ({expires}).")
    except ValueError:
        print(f"SUMMARY=  {name}: invalid date")
