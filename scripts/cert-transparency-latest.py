#!/usr/bin/env python3
import json, sys

d = json.load(sys.stdin)
if not d:
    sys.exit()
latest = sorted(d, key=lambda x: x.get('not_before', ''), reverse=True)[:3]
for c in latest:
    print(c.get('not_before', '?')[:10], '|', c.get('common_name', '?'), '|', c.get('issuer_name', '?')[:40])
