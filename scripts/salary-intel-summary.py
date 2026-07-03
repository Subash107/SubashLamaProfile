#!/usr/bin/env python3
import json

with open('public/data/salary-intel.json') as f:
    data = json.load(f)
lines = []
for role in data.get('roles', []):
    medians = [m['median'] for m in role.get('markets', []) if 'median' in m]
    if medians:
        lines.append(f'{role["title"]}: USD {min(medians):,} — {max(medians):,} (median range)')
print('\n'.join(lines))
