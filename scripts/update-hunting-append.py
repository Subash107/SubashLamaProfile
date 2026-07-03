#!/usr/bin/env python3
import json, os

path = 'public/data/hunting.json'
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {'updated': '', 'items': []}

new_item = {
    'type':   os.environ['TYPE'],
    'title':  os.environ['TITLE'],
    'detail': os.environ['DETAIL'],
}

data['items'] = [i for i in data.get('items', []) if i.get('type') != new_item['type'] or i.get('title') != new_item['title']]
data['items'].insert(0, new_item)
data['items'] = data['items'][:6]
data['updated'] = os.environ['TODAY']

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Updated hunting.json with:', new_item['title'])
