"""
Monthly AI keyword gap analysis.
Compares Subash's portfolio keywords against current SOC/GRC/IAM job market terms.
Sends findings to Telegram.
Requires: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
"""
import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

API_KEY   = os.environ.get("ANTHROPIC_API_KEY", "")
TOKEN     = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT      = os.environ.get("TELEGRAM_CHAT_ID", "")
TODAY     = datetime.now(timezone.utc).strftime("%Y-%m-%d")

PORTFOLIO_PROFILE = """
Name: Subash Lama — Cybersecurity Analyst, Kathmandu, Nepal
Experience: 12+ years enterprise IT, transitioning to full cybersecurity role
Target roles: SOC Analyst, GRC Analyst, IAM Analyst, Cybersecurity Analyst

CERTIFICATIONS (7):
CompTIA Security+, CompTIA CySA+, CompTIA PenTest+, eJPT,
Google Cybersecurity Certificate, ISC2 CC, Wazuh Certified Engineer

CURRENT SKILLS:
SOC Operations, Wazuh SIEM (self-built lab), Suricata IDS/IPS,
Sysmon endpoint telemetry, IAM, Active Directory, RBAC, MFA, SSO, PAM,
Docker, GitHub Actions CI/CD, Python, Bash, PowerShell,
MITRE ATT&CK (14-tactic coverage), NIST 800-53, NIST 800-61,
ISO 27001, CIS Controls, GRC, Vulnerability Management,
Incident Response, Threat Intelligence (CISA KEV)

CURRENTLY STUDYING: Kubernetes Security, Elastic Stack (ELK)
LOCATION: Kathmandu, Nepal — open to remote worldwide
"""

PROMPT = f"""You are a cybersecurity career advisor. Today is {TODAY}.

Analyse this candidate profile and identify keyword gaps compared to what SOC Analyst,
GRC Analyst, and IAM Analyst job postings commonly require in 2026.

Candidate profile:
{PORTFOLIO_PROFILE}

Return ONLY this exact format (no markdown, no headers, plain text):

MATCH SCORE: X/100

TOP MISSING KEYWORDS (5 max, most impactful first):
- keyword: one-line reason why it matters

QUICK WINS (3 actions to take this month):
1. action
2. action
3. action

STRENGTHS TO HIGHLIGHT MORE:
- strength: why it stands out

Keep the entire response under 400 words."""


def send_telegram(msg):
    if not (TOKEN and CHAT):
        print(msg)
        return
    payload = json.dumps({"chat_id": CHAT, "text": msg}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print("Telegram message sent.")
    except Exception as e:
        print(f"Telegram error: {e}")


if not API_KEY:
    send_telegram(
        f"KEYWORD GAP — {TODAY}\n\n"
        "ANTHROPIC_API_KEY secret not set in GitHub.\n"
        "Add it at:\n"
        "github.com/Subash107/SubashLamaProfile/settings/secrets/actions"
    )
    raise SystemExit(0)

payload = json.dumps({
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 600,
    "messages": [{"role": "user", "content": PROMPT}],
}).encode()

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=payload,
    headers={
        "x-api-key":         API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
    },
)

try:
    with urllib.request.urlopen(req, timeout=30) as r:
        result   = json.loads(r.read())
        analysis = result["content"][0]["text"].strip()
except urllib.error.HTTPError as e:
    send_telegram(f"KEYWORD GAP — {TODAY}\n\nAPI error: {e.code} {e.reason}")
    raise SystemExit(1)
except Exception as e:
    send_telegram(f"KEYWORD GAP — {TODAY}\n\nError: {str(e)[:200]}")
    raise SystemExit(1)

msg = f"MONTHLY KEYWORD GAP ANALYSIS\n{TODAY}\n\n{analysis}"

if len(msg) > 4000:
    msg = msg[:3990] + "..."

print(msg)
send_telegram(msg)
