"""
Generate public/stats.json for the live portfolio dashboard.
Run via GitHub Actions — reads env vars GH_TOKEN and HTB_USERNAME.
"""
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

gh_token   = os.environ.get('GH_TOKEN', '')
htb_user   = os.environ.get('HTB_USERNAME', '')
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

# ── HackTheBox rank ───────────────────────────────────────────────────
htb_rank      = None
htb_points    = None
htb_rank_text = None
htb_profile   = 'https://app.hackthebox.com'
if htb_user:
    try:
        data  = fetch_json(
            f'https://www.hackthebox.com/api/v4/search/fetch?query={htb_user}&tags=users&page=1',
            {'User-Agent': 'StatsBot/1.0'}
        )
        users = data.get('users', [])
        if users:
            u             = users[0]
            htb_rank      = u.get('rank')
            htb_points    = u.get('points')
            htb_rank_text = u.get('rank_text')
            htb_profile   = f"https://app.hackthebox.com/users/{u.get('id', '')}"
            print(f'  HTB rank: #{htb_rank} ({htb_rank_text}), points: {htb_points}')
        else:
            print('  HTB: user not found in search results')
    except Exception as e:
        print(f'  HTB error: {e}')
else:
    print('  HTB_USERNAME not set — skipping')

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
    'htb': {
        'rank':      htb_rank,
        'points':    htb_points,
        'rank_text': htb_rank_text,
        'profile':   htb_profile
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
