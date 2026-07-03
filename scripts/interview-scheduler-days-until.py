#!/usr/bin/env python3
import os
from datetime import date

interview = date.fromisoformat(os.environ['INTERVIEW_DATE'])
today = date.today()
print((interview - today).days)
