#!/usr/bin/env python3
import json, os

path = os.environ['CTF_LOG']
try:
    with open(path) as f:
        entries = json.load(f)
    print(sum(e.get('score', 0) for e in entries))
except Exception:
    print(0)
