#!/usr/bin/env python3
import json, os

path = os.environ['VIEWS_FILE']
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = []
data.insert(0, {
    'timestamp': os.environ['NOW'],
    'hint':      os.environ.get('VIEWER_HINT', ''),
    'note':      os.environ.get('NOTE', ''),
})
data = data[:50]
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Logged LinkedIn view at', os.environ['NOW'])
