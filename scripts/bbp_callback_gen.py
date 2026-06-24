#!/usr/bin/env python3
"""BBP ghost-link / callback hit viewer.

Usage:
  python scripts/bbp_callback_gen.py hits              # show all hits
  python scripts/bbp_callback_gen.py show <token>      # show hits for one token
"""
import sys
import os

LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "download-logs", "ghost-hits.txt")

HEADER = f"{'Timestamp':<26}| {'Token':<35}| {'IP':<16}| {'CC':<3}| {'Protocol':<12}| {'User-Agent':<60}| Referer"
SEP    = "-" * len(HEADER)


def parse_line(line):
    parts = line.split("|")
    if len(parts) < 7:
        return None
    return {
        "ts":      parts[0].strip(),
        "token":   parts[1].strip(),
        "ip":      parts[2].strip(),
        "country": parts[3].strip(),
        "proto":   parts[4].strip(),
        "ua":      parts[5].strip(),
        "referer": parts[6].strip(),
    }


def load_hits(token_filter=None):
    if not os.path.exists(LOG_FILE):
        return []
    hits = []
    with open(LOG_FILE, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            hit = parse_line(line)
            if hit is None:
                continue
            if token_filter and token_filter.lower() not in hit["token"].lower():
                continue
            hits.append(hit)
    return hits


def print_hits(hits):
    if not hits:
        print("No hits found.")
        return
    print(HEADER)
    print(SEP)
    for h in hits:
        print(
            f"{h['ts']:<26}| {h['token']:<35}| {h['ip']:<16}| {h['country']:<3}| "
            f"{h['proto']:<12}| {h['ua']:<60}| {h['referer']}"
        )
    print(SEP)
    print(f"Total: {len(hits)} hit(s)")


def main():
    args = sys.argv[1:]
    if not args or args[0] == "hits":
        hits = load_hits()
        print_hits(hits)
    elif args[0] == "show" and len(args) >= 2:
        token = args[1]
        hits = load_hits(token_filter=token)
        print(f"Hits for token: {token}")
        print_hits(hits)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
