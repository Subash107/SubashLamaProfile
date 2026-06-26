"""
Generate public/stats.json for the live portfolio dashboard.
Run via GitHub Actions — reads env vars GH_TOKEN.
"""
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

gh_token   = os.environ.get('GH_TOKEN', '')
today      = datetime.utcnow().strftime('%Y-%m-%d')
week_ago   = (datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')
ts         = int(datetime.utcnow().timestamp())


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'  fetch error {url}: {e}')
        return {}


# ── GitHub commits this week ──────────────────────────────────────────
commits_week = 0
try:
    events = fetch_json(
        'https://api.github.com/users/Subash107/events?per_page=100',
        {
            'Authorization': f'Bearer {gh_token}',
            'User-Agent': 'StatsBot/1.0',
            'Accept': 'application/vnd.github+json'
        }
    )
    if isinstance(events, list):
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        commits_week = sum(
            1 for e in events
            if isinstance(e, dict)
            and e.get('type') == 'PushEvent'
            and datetime.fromisoformat(
                e.get('created_at', '2000-01-01T00:00:00Z').replace('Z', '+00:00')
            ) > cutoff
        )
    print(f'  GitHub commits this week: {commits_week}')
except Exception as e:
    print(f'  GitHub error: {e}')

# ── Resume downloads ──────────────────────────────────────────────────
downloads_week  = 0
downloads_total = 0
try:
    with open('download-logs/resume-downloads.txt') as f:
        lines = [l.strip() for l in f if l.strip() and l[0].isdigit()]
    downloads_total = len(lines)
    downloads_week  = sum(1 for l in lines if l[:10] >= week_ago)
    print(f'  Resume downloads — week: {downloads_week}, total: {downloads_total}')
except Exception as e:
    print(f'  Resume log error: {e}')

# ── Job applications this week ────────────────────────────────────────
apps_week = 0
try:
    with open('download-logs/job-applications.json') as f:
        apps = json.load(f)
    apps_week = sum(1 for a in apps if a.get('date', '') >= week_ago)
    print(f'  Job applications this week: {apps_week}')
except Exception as e:
    print(f'  Job applications error (ok if file missing): {e}')

# ── Write stats.json ──────────────────────────────────────────────────
stats = {
    'generated':    today,
    'generated_ts': ts,
    'github': {
        'commits_week': commits_week,
        'profile':      'https://github.com/Subash107'
    },
    'resume': {
        'downloads_week':  downloads_week,
        'downloads_total': downloads_total
    },
    'jobs': {
        'applications_week': apps_week
    },
    'certs':       7,
    'last_active': today
}

with open('public/stats.json', 'w') as f:
    json.dump(stats, f, indent=2)

print('\nstats.json written:')
print(json.dumps(stats, indent=2))
