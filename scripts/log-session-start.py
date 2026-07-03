#!/usr/bin/env python3
"""SessionStart hook: records that a work session happened today and what
changed since the last one, then regenerates the cumulative PDF report.
Runs silently and never blocks Claude Code startup on failure.
"""
import datetime
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES_DIR = os.path.join(ROOT, "activity-log", "entries")
STATE_DIR = os.path.join(ROOT, "activity-log", ".state")
STATE_FILE = os.path.join(STATE_DIR, "last-commit.txt")


def git(*args):
    return subprocess.run(
        ["git", "-C", ROOT, *args],
        capture_output=True, text=True, check=False
    ).stdout.strip()


def main():
    os.makedirs(ENTRIES_DIR, exist_ok=True)
    os.makedirs(STATE_DIR, exist_ok=True)

    now = datetime.datetime.now()
    today = now.date().isoformat()
    entry_path = os.path.join(ENTRIES_DIR, f"{today}.md")

    if not os.path.exists(entry_path):
        with open(entry_path, "w", encoding="utf-8") as f:
            f.write(f"# {today}\n\n")

    head = git("rev-parse", "HEAD")
    last = None
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, encoding="utf-8") as f:
            last = f.read().strip() or None

    lines = [f"### Session {now.strftime('%H:%M')}"]

    if not head:
        lines.append("- (git info unavailable)")
    elif last is None:
        lines.append("- Started tracking from this session (baseline set).")
    elif last == head:
        lines.append("- No new commits since the last session.")
    else:
        log = git("log", f"{last}..{head}", "--oneline")
        stat = git("diff", "--shortstat", last, head)
        if log:
            lines.append("- Commits:")
            for line in log.splitlines():
                lines.append(f"  - {line}")
        if stat:
            lines.append(f"- Changes: {stat.strip()}")
        if not log and not stat:
            lines.append("- No new commits since the last session.")

    with open(entry_path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n\n")

    if head:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            f.write(head)

    subprocess.run(
        [sys.executable, os.path.join(ROOT, "scripts", "generate-activity-report.py")],
        check=False
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"log-session-start: skipped ({e})", file=sys.stderr)
