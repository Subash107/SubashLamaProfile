"""
Adds tracked redirect links to Subash's resume PDF.
Searches for LinkedIn, GitHub, email text and overlays clickable tracked URLs.
Also adds canary pixel as an invisible link.
"""

import fitz  # pymupdf

PDF_IN  = "public/assets/docs/cv/latest-resume.pdf"
PDF_OUT = "public/assets/docs/cv/latest-resume-tracked.pdf"
BASE    = "https://lingering-surf-6d77.lamasubash107.workers.dev"

TRACKED_LINKS = [
    ("linkedin.com/in/subash-lama-b319a016b", f"{BASE}/go/linkedin"),
    ("github.com/Subash107",                  f"{BASE}/go/github"),
    ("lamasubash107@gmail.com",               f"{BASE}/go/email"),
    ("+977 9840005771",                       f"{BASE}/go/phone"),
    ("subashlamaprofile.pages.dev",           f"{BASE}/go/portfolio"),
]

doc = fitz.open(PDF_IN)
total_links = 0

for page_num, page in enumerate(doc):
    for search_text, url in TRACKED_LINKS:
        areas = page.search_for(search_text)
        for area in areas:
            page.insert_link({
                "kind": fitz.LINK_URI,
                "from": area,
                "uri":  url,
            })
            print(f"  Page {page_num + 1}: linked '{search_text}' -> {url}")
            total_links += 1

    # Add canary pixel as invisible link in top-right corner of page 1
    if page_num == 0:
        rect = fitz.Rect(page.rect.width - 2, 0, page.rect.width, 2)
        page.insert_link({
            "kind": fitz.LINK_URI,
            "from": rect,
            "uri":  f"{BASE}/canary",
        })
        print(f"  Page 1: canary pixel embedded (invisible, top-right corner)")

doc.save(PDF_OUT, garbage=4, deflate=True)
doc.close()
print(f"\nDone. {total_links} tracked links added.")
print(f"Saved: {PDF_OUT}")
