"""
Project health check — runs all checks and sends a Telegram report.
Called by project-health.yml GitHub Action.
"""
import os
import json
import urllib.request
import urllib.error
import ssl
import socket
import subprocess
from datetime import datetime, timezone, timedelta

TOKEN   = os.environ.get('TOKEN', '')
CHAT    = os.environ.get('CHAT', '')
GH_TOKEN = os.environ.get('GH_TOKEN', '')
BASE_URL = 'https://subashlamaprofile.pages.dev'
DATE     = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

alerts = []

def send_telegram(msg):
    if not (TOKEN and CHAT):
        print(msg)
        return
    payload = json.dumps({'chat_id': CHAT, 'text': msg}).encode()
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{TOKEN}/sendMessage',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print('Telegram message sent.')
    except Exception as e:
        print(f'Telegram error: {e}')


def check_http(url, label):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HealthBot/1.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        code = 0
    ok = code == 200
    if not ok:
        alerts.append(f'⚠ {label} returned HTTP {code}')
    return f'{"✅" if ok else "❌"} {label} — HTTP {code if code else "timeout"}'


def check_ssl(hostname):
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.create_connection((hostname, 443), timeout=10), server_hostname=hostname) as s:
            cert = s.getpeercert()
        expiry_str = cert.get('notAfter', '')
        expiry = datetime.strptime(expiry_str, '%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)
        days_left = (expiry - datetime.now(timezone.utc)).days
        if days_left < 14:
            alerts.append(f'⚠ SSL cert expiring in {days_left} days!')
            return f'⚠ SSL expires in {days_left} days — renew soon!'
        return f'✅ SSL valid — {days_left} days remaining'
    except Exception as e:
        return f'⚠ SSL check failed: {str(e)[:60]}'


def check_stats_json():
    try:
        with open('public/stats.json') as f:
            data = json.load(f)
        generated = data.get('generated', '')
        if not generated:
            return '⚠ stats.json has no generated date'
        gen_date = datetime.fromisoformat(generated)
        age_days = (datetime.utcnow() - gen_date).days
        if age_days > 2:
            alerts.append(f'⚠ stats.json is {age_days} days old — run Generate Live Stats')
            return f'⚠ stats.json is {age_days} days old'
        return f'✅ stats.json current (generated: {generated})'
    except Exception as e:
        return f'⚠ Could not read stats.json: {str(e)[:60]}'


def check_github_activity():
    if not GH_TOKEN:
        return '⚠ No GH_TOKEN — skipping'
    try:
        req = urllib.request.Request(
            'https://api.github.com/users/Subash107/events?per_page=50',
            headers={
                'Authorization': f'Bearer {GH_TOKEN}',
                'User-Agent': 'HealthBot/1.0',
                'Accept': 'application/vnd.github+json'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            events = json.loads(r.read())
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        commits = sum(
            1 for e in events
            if isinstance(e, dict)
            and e.get('type') == 'PushEvent'
            and datetime.fromisoformat(
                e.get('created_at', '2000-01-01T00:00:00Z').replace('Z', '+00:00')
            ) > cutoff
        )
        return f'📊 GitHub: {commits} commits this week'
    except Exception as e:
        return f'⚠ GitHub check failed: {str(e)[:60]}'


# Run all checks
print('Running health checks...')
site_status    = check_http(f'{BASE_URL}/', 'Portfolio')
tracker_status = check_http(f'{BASE_URL}/tracker.html', 'CyberSec Tracker')
bb_status      = check_http(f'{BASE_URL}/bugbounty.html', 'Bug Bounty Tracker')
ssl_status     = check_ssl('subashlamaprofile.pages.dev')
stats_status   = check_stats_json()
gh_status      = check_github_activity()

overall = '🔴 Issues detected' if alerts else '✅ All systems healthy'

msg = f"""🏥 Portfolio Health Report
📅 {DATE}

{overall}

📋 Services:
{site_status}
{tracker_status}
{bb_status}

🔒 Security:
{ssl_status}

📊 Data:
{stats_status}
{gh_status}

🔗 {BASE_URL}"""

if alerts:
    alerts_text = '\n'.join(alerts)
    msg += f'\n\n🚨 Action Required:\n{alerts_text}'

print(msg)
send_telegram(msg)

if alerts:
    print('\nIssues found. Exiting with error.')
    raise SystemExit(1)
