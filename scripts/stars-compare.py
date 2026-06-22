"""
Compare previous and current GitHub repo star/fork counts.
Reads PREV_JSON and CURR_JSON from environment variables.
Prints one line per change, or nothing if no changes.
"""
import json
import os

prev = json.loads(os.environ.get('PREV_JSON', '{}'))
curr = json.loads(os.environ.get('CURR_JSON', '{}'))

msgs = []
for repo, data in curr.items():
    p = prev.get(repo, {'stars': 0, 'forks': 0})
    if data['stars'] > p['stars']:
        msgs.append(f'+{data["stars"] - p["stars"]} star(s) on {repo} (total: {data["stars"]})')
    if data['forks'] > p['forks']:
        msgs.append(f'+{data["forks"] - p["forks"]} fork(s) on {repo} (total: {data["forks"]})')

print('\n'.join(msgs))
