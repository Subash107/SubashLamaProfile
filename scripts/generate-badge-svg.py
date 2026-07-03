#!/usr/bin/env python3
import os

cert_count = int(os.environ['CERT_COUNT'])
streak = int(os.environ['STREAK'])
ctf_score = int(os.environ['CTF_SCORE'])
version = os.environ['VERSION']

segs = [
    (0,   90,  '#555',    'Profile',  'SOC Analyst'),
    (90,  60,  '#007ec6', 'Certs',    str(cert_count) + ' certs'),
    (150, 70,  '#00aa44', 'Streak',   'streak ' + str(streak) + 'd'),
    (220, 65,  '#e05d44', 'CTF',      'CTF ' + str(ctf_score) + 'pts'),
    (285, 55,  '#9f9f9f', 'CV',       'v' + version),
]

total_w = 285 + 55
rects = []
texts = []
for x, w, color, label, value in segs:
    cx = int((x + w / 2) * 10)
    tl = max(len(value) * 55, 100)
    rects.append('<rect x="{x}" width="{w}" height="20" fill="{c}"/>'.format(x=x, w=w, c=color))
    texts.append(
        '<text x="{cx}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{tl}">{v}</text>'
        '<text x="{cx}" y="140" transform="scale(.1)" fill="#fff" textLength="{tl}">{v}</text>'.format(cx=cx, tl=tl, v=value)
    )

svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="{w}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    {rects}
    <rect width="{w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    {texts}
  </g>
</svg>'''.format(w=total_w, rects=chr(10).join(rects), texts=chr(10).join(texts))

with open('public/assets/badge.svg', 'w') as f:
    f.write(svg)
print('Badge generated: certs={}, streak={}, ctf={}, v={}'.format(cert_count, streak, ctf_score, version))
