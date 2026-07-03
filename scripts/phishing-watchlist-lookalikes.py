#!/usr/bin/env python3
import json, sys

d = json.load(sys.stdin)
real = 'subashlamaprofile.pages.dev'
others = list(set(c.get('common_name', '') for c in d if real not in c.get('common_name', '') and 'subash' in c.get('common_name', '').lower()))
for o in others[:5]:
    print(o)
