#!/usr/bin/env python3
import imaplib, email, json, os, datetime, re

USER = 'lamasubash107@gmail.com'
PASSWORD = os.environ['GMAIL_APP_PASSWORD']
LOG_PATH = 'download-logs/job-applications.json'

try:
    mail = imaplib.IMAP4_SSL('imap.gmail.com')
    mail.login(USER, PASSWORD)
    mail.select('inbox')
except Exception as e:
    print('Gmail login failed:', e)
    exit(0)

since = (datetime.date.today() - datetime.timedelta(days=1)).strftime('%d-%b-%Y')
_, msgs = mail.search(None, f'(SINCE {since} SUBJECT "application" OR SUBJECT "applied" OR SUBJECT "thank you for applying")')

found = []
for num in (msgs[0].split() if msgs[0] else [])[:20]:
    _, data = mail.fetch(num, '(RFC822)')
    msg = email.message_from_bytes(data[0][1])
    subj = str(email.header.make_header(email.header.decode_header(msg.get('Subject', ''))))
    frm = msg.get('From', '')
    date = msg.get('Date', '')
    company = re.search(r'from ([A-Z][a-z]+(?: [A-Z][a-z]+)*)', subj)
    company = company.group(1) if company else re.search(r'@([a-zA-Z0-9-]+)\.', frm)
    company = company.group(1).title() if company and hasattr(company, 'group') else 'Unknown'
    found.append({'date': date[:16], 'company': company, 'subject': subj[:80], 'source': 'email'})

mail.logout()
if not found:
    print('No new application emails found.')
    exit(0)

try:
    with open(LOG_PATH) as f:
        apps = json.load(f)
except Exception:
    apps = []

existing = {a.get('subject', '') for a in apps}
new_apps = [a for a in found if a['subject'] not in existing]
if not new_apps:
    print('All emails already logged.')
    exit(0)

apps.extend(new_apps)
with open(LOG_PATH, 'w') as f:
    json.dump(apps, f, indent=2)
print(f'Auto-logged {len(new_apps)} new application(s) from email.')
