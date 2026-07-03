#!/usr/bin/env python3
import json, os

path = 'public/data/salary-intel.json'
with open(path) as f:
    data = json.load(f)

role_input = os.environ.get('ROLE', '').strip()
region_input = os.environ.get('REGION', '').strip()
min_v = os.environ.get('MIN_USD', '').strip()
max_v = os.environ.get('MAX_USD', '').strip()
med_v = os.environ.get('MEDIAN_USD', '').strip()

if role_input and region_input and min_v and max_v:
    for role in data.get('roles', []):
        if role.get('title') == role_input:
            for market in role.get('markets', []):
                if market.get('region') == region_input:
                    market['min'] = int(min_v)
                    market['max'] = int(max_v)
                    market['median'] = int(med_v) if med_v else (int(min_v) + int(max_v)) // 2
                    print(f'Updated: {role_input} — {region_input}')

data['updated'] = os.environ['TODAY']
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Salary data saved.')
