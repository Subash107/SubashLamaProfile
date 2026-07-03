#!/usr/bin/env python3
import json, sys, os

d = json.load(sys.stdin)
domain = os.environ['DOMAIN']
unexpected = [c.get('common_name', '') for c in d if domain not in c.get('common_name', '') and c.get('common_name', '')]
for u in unexpected[:5]:
    print(u)
