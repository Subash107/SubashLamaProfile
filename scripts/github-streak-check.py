#!/usr/bin/env python3
import json, sys, os

events = json.load(sys.stdin)
today = os.environ['TODAY']
active_types = ('PushEvent', 'CreateEvent', 'IssuesEvent', 'PullRequestEvent', 'CommitCommentEvent', 'ReleaseEvent')
has = any(
    e.get('type') in active_types and e.get('created_at', '')[:10] == today
    for e in events
)
print('yes' if has else 'no')
