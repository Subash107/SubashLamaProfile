"""
inject-tracked-links.py
Adds tracked hyperlink annotations over URL text in resume PDF.
Run: python scripts/inject-tracked-links.py
"""

import shutil
from pathlib import Path
import pdfplumber
import pypdf
from pypdf.generic import (
    DictionaryObject, ArrayObject, NameObject,
    NumberObject, create_string_object
)

TRACKER = "https://lingering-surf-6d77.lamasubash107.workers.dev"

LINK_RULES = [
    ("linkedin",    TRACKER + "/go/linkedin"),
    ("gmail",       TRACKER + "/go/email"),
    ("9840005771",  TRACKER + "/go/phone"),
    ("github",      TRACKER + "/go/github"),
    ("hackerone",   TRACKER + "/go/portfolio"),
    ("intigriti",   TRACKER + "/go/portfolio"),
    ("bugcrowd",    TRACKER + "/go/portfolio"),
    ("subash107",   TRACKER + "/go/portfolio"),
]

def match_url(text):
    tl = text.lower()
    for keyword, url in LINK_RULES:
        if keyword in tl:
            return url
    return None

def pdf_y(page_height, top, bottom):
    """Convert pdfplumber top/bottom coords to PDF bottom-left coords."""
    return page_height - bottom, page_height - top

def build_link_annot(x0, y0, x1, y1, uri):
    annot = DictionaryObject()
    annot[NameObject("/Type")]    = NameObject("/Annot")
    annot[NameObject("/Subtype")] = NameObject("/Link")
    annot[NameObject("/Rect")]    = ArrayObject([
        NumberObject(x0), NumberObject(y0),
        NumberObject(x1), NumberObject(y1),
    ])
    annot[NameObject("/Border")]  = ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)])
    action = DictionaryObject()
    action[NameObject("/Type")] = NameObject("/Action")
    action[NameObject("/S")]    = NameObject("/URI")
    action[NameObject("/URI")]  = create_string_object(uri)
    annot[NameObject("/A")]     = action
    return annot

PDF_IN  = Path("content/resume/Subash_Lama_CV.pdf")
PDF_OUT = Path("content/resume/Subash_Lama_CV.pdf")
BACKUP  = Path("content/resume/Subash_Lama_CV.backup.pdf")

print("Processing:", PDF_IN)
shutil.copy2(PDF_IN, BACKUP)
print("Backup saved:", BACKUP)

reader  = pypdf.PdfReader(str(PDF_IN))
writer  = pypdf.PdfWriter()
writer.append(reader)

added = 0
with pdfplumber.open(str(PDF_IN)) as pdf:
    for pi, plpage in enumerate(pdf.pages):
        ph = float(plpage.height)
        words = plpage.extract_words()
        new_annots = []

        for w in words:
            uri = match_url(w["text"])
            if not uri:
                continue
            y0, y1 = pdf_y(ph, w["top"], w["bottom"])
            annot = build_link_annot(w["x0"] - 2, y0 - 2, w["x1"] + 2, y1 + 2, uri)
            new_annots.append(annot)
            print("  P%d %-50s -> %s" % (pi + 1, w["text"], uri))
            added += 1

        if new_annots:
            page = writer.pages[pi]
            if "/Annots" in page:
                page["/Annots"].extend(new_annots)
            else:
                page[NameObject("/Annots")] = ArrayObject(new_annots)

with open(PDF_OUT, "wb") as f:
    writer.write(f)

print("\nDone -- %d tracked link(s) added. Saved to: %s" % (added, PDF_OUT))
