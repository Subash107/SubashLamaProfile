"""Fetch remote cybersecurity job listings from RSS feeds and print matches."""
import urllib.request
import xml.etree.ElementTree as ET

FEEDS = [
    ("Remotive", "https://remotive.com/remote-jobs/feed/cybersecurity"),
    ("Remotive SOC", "https://remotive.com/remote-jobs/feed/security"),
]

KEYWORDS = [
    "soc", "security analyst", "iam", "grc", "incident response",
    "threat hunt", "siem", "wazuh", "suricata", "compliance",
    "cybersecurity", "information security", "cloud security",
]

results = []
for source, url in FEEDS:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JobBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            tree = ET.fromstring(r.read())
        for item in tree.findall(".//item")[:10]:
            title = item.findtext("title", "").lower()
            link  = item.findtext("link", "")
            if any(k in title for k in KEYWORDS):
                results.append(item.findtext("title", "") + "\n   " + link)
    except Exception:
        pass

print("\n".join(results[:5]) if results else "NO_JOBS")
