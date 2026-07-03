#!/usr/bin/env python3
import json, os

path = 'public/data/incidents.json'
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {'updated': '', 'entries': []}

existing = data.get('entries', [])
last_id = 0
for e in existing:
    try:
        n = int(e.get('id', 'INC-0').split('-')[1])
        if n > last_id:
            last_id = n
    except Exception:
        pass

today = os.environ['TODAY']
new_entry = {
    'date':     today,
    'id':       f'INC-{last_id + 1:03d}',
    'title':    os.environ['TITLE'],
    'ttp':      os.environ.get('TTP', ''),
    'tool':     os.environ['TOOL'],
    'severity': os.environ['SEVERITY'],
    'action':   os.environ['ACTION'],
    'outcome':  os.environ['OUTCOME'],
}
existing.insert(0, new_entry)
data['entries'] = existing[:20]
data['updated'] = today
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Logged:', new_entry['id'], new_entry['title'])
