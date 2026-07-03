#!/usr/bin/env python3
try:
    import qrcode, qrcode.image.svg
    URL = 'https://subashlamaprofile.pages.dev/?utm_source=qr&utm_medium=businesscard'
    img = qrcode.make(URL, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    with open('public/assets/qr-code.svg', 'wb') as f:
        img.save(f)
    print('QR code generated successfully')
except ImportError:
    URL = 'https://subashlamaprofile.pages.dev/?utm_source=qr&utm_medium=businesscard'
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="white"/>
  <rect x="10" y="10" width="60" height="60" fill="none" stroke="black" stroke-width="8"/>
  <rect x="22" y="22" width="36" height="36" fill="black"/>
  <rect x="130" y="10" width="60" height="60" fill="none" stroke="black" stroke-width="8"/>
  <rect x="142" y="22" width="36" height="36" fill="black"/>
  <rect x="10" y="130" width="60" height="60" fill="none" stroke="black" stroke-width="8"/>
  <rect x="22" y="142" width="36" height="36" fill="black"/>
  <text x="100" y="110" text-anchor="middle" font-size="8" fill="#333">subashlamaprofile.pages.dev</text>
</svg>'''
    with open('public/assets/qr-code.svg', 'w') as f:
        f.write(svg)
    print('Fallback QR placeholder written')
