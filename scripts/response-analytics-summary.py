#!/usr/bin/env python3
import json, datetime, collections, os

with open(os.environ['APPS_FILE']) as f:
    apps = json.load(f)

outcomes = []
try:
    with open(os.environ['OUTCOMES_FILE']) as f:
        outcomes = json.load(f).get('entries', [])
except Exception:
    pass

today = datetime.date.today()
total = len(apps)
week_apps = [a for a in apps if a.get('date', '') >= (today - datetime.timedelta(days=7)).isoformat()]
month_apps = [a for a in apps if a.get('date', '') >= (today - datetime.timedelta(days=30)).isoformat()]

interviews = len([o for o in outcomes if 'Round' in o.get('stage', '') or 'Screen' in o.get('stage', '')])
offers = len([o for o in outcomes if o.get('stage') == 'Offer'])
rejected = len([o for o in outcomes if o.get('stage') == 'Rejected'])

rate = round(interviews / total * 100, 1) if total > 0 else 0

by_source = collections.Counter(a.get('source', 'Unknown') for a in apps)
top_source = by_source.most_common(3)
top_src_str = ', '.join(f'{s}: {c}' for s, c in top_source)

print(f'Total applications : {total}')
print(f'This week          : {len(week_apps)}')
print(f'This month         : {len(month_apps)}')
print(f'Interviews         : {interviews}')
print(f'Offers             : {offers}')
print(f'Rejected           : {rejected}')
print(f'Interview rate     : {rate}%')
print(f'Top sources        : {top_src_str}')
