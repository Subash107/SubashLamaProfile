#!/usr/bin/env python3
import json, os

path = 'download-logs/interview-outcomes.json'
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {'entries': [], 'funnel': {}}

today = os.environ['TODAY']
entry = {
    'date':       today,
    'company':    os.environ['COMPANY'],
    'role':       os.environ['ROLE'],
    'stage':      os.environ['STAGE'],
    'outcome':    os.environ['OUTCOME'],
    'next_steps': os.environ.get('NEXT_STEPS', ''),
}
data['entries'].insert(0, entry)
data['entries'] = data['entries'][:50]

funnel = {}
for e in data['entries']:
    s = e.get('stage', 'Unknown')
    funnel[s] = funnel.get(s, 0) + 1
data['funnel'] = funnel
data['updated'] = today

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Logged outcome for', entry['company'], '—', entry['stage'])
