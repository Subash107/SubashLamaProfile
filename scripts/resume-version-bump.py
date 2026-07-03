#!/usr/bin/env python3
import json, os

path = 'public/data/resume-version.json'
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {'version': '1.0.0', 'updated': '', 'build': 0}

parts = data.get('version', '1.0.0').split('.')
major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
bump = os.environ['BUMP']

if bump == 'major':
    major += 1
    minor = 0
    patch = 0
elif bump == 'minor':
    minor += 1
    patch = 0
else:
    patch += 1

data['version'] = f'{major}.{minor}.{patch}'
data['updated'] = os.environ['TODAY']
data['build'] = data.get('build', 0) + 1

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print(f'Bumped to v{data["version"]} (build {data["build"]})')
