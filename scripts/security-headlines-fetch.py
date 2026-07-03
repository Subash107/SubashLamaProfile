#!/usr/bin/env python3
import urllib.request, xml.etree.ElementTree as ET, json, datetime

FEEDS = [
    ('CISA Alerts',        'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', 'json-cisa'),
    ('BleepingComputer',   'https://www.bleepingcomputer.com/feed/', 'rss'),
    ('Krebs on Security',  'https://krebsonsecurity.com/feed/', 'rss'),
]

KEYWORDS = ['soc', 'siem', 'wazuh', 'suricata', 'cve', 'vulnerability', 'ransomware', 'phishing',
            'active directory', 'endpoint', 'iam', 'grc', 'threat', 'detection', 'incident']


def is_relevant(text):
    t = text.lower()
    return any(k in t for k in KEYWORDS)


def fetch_rss(url, source):
    items = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            root = ET.fromstring(r.read())
        for item in root.findall('.//item')[:10]:
            title = (item.findtext('title') or '').strip()
            link = (item.findtext('link') or '').strip()
            if is_relevant(title):
                cat = 'vuln' if any(x in title.lower() for x in ['cve', 'exploit', 'rce', 'zero-day']) \
                    else 'threat' if any(x in title.lower() for x in ['ransomware', 'phishing', 'attack', 'breach']) \
                    else 'grc' if any(x in title.lower() for x in ['nist', 'compliance', 'policy', 'framework']) \
                    else 'tool'
                items.append({'title': title[:120], 'source': source, 'category': cat, 'url': link, 'date': datetime.date.today().isoformat()})
    except Exception as e:
        print(f'Error fetching {source}: {e}')
    return items


all_items = []
for name, url, kind in FEEDS:
    if kind == 'rss':
        all_items.extend(fetch_rss(url, name))

seen = set()
unique = []
for item in all_items:
    key = item['title'][:60]
    if key not in seen:
        seen.add(key)
        unique.append(item)

unique = unique[:8]

path = 'public/data/headlines.json'
try:
    with open(path) as f:
        existing = json.load(f)
    old_items = existing.get('items', [])
except Exception:
    old_items = []

if unique:
    final = unique + [i for i in old_items if i not in unique]
    final = final[:10]
else:
    final = old_items

data = {'updated': datetime.date.today().isoformat(), 'items': final}
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print(f'Headlines updated: {len(final)} items')
