#!/usr/bin/env python3
"""Regenerate activity-log/research-report.pdf from all daily markdown entries."""
import glob
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES_DIR = os.path.join(ROOT, "activity-log", "entries")
OUTPUT_PDF = os.path.join(ROOT, "activity-log", "research-report.pdf")

try:
    from fpdf import FPDF
except ImportError:
    os.system(f'"{sys.executable}" -m pip install --quiet fpdf2')
    from fpdf import FPDF


def clean(text):
    return text.encode("latin-1", "replace").decode("latin-1")


class ReportPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, "Subash Lama - Portfolio Research & Activity Log", align="C")
        self.ln(8)
        self.set_x(self.l_margin)
        self.set_text_color(0, 0, 0)
        self.ln(2)


def build():
    entries = sorted(glob.glob(os.path.join(ENTRIES_DIR, "*.md")))
    pdf = ReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, "Portfolio Research & Activity Log", align="C")
    pdf.ln(15)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "Subash Lama - auto-generated journal", align="C")
    pdf.ln(8)
    pdf.set_x(pdf.l_margin)
    pdf.cell(0, 8, f"{len(entries)} recorded day(s)", align="C")
    pdf.ln(8)
    pdf.set_x(pdf.l_margin)
    pdf.set_text_color(0, 0, 0)

    for path in entries:
        date = os.path.basename(path).replace(".md", "")
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 15)
        pdf.cell(0, 10, date)
        pdf.ln(10)
        pdf.set_x(pdf.l_margin)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(4)

        with open(path, encoding="utf-8") as f:
            text = f.read()

        for raw_line in text.splitlines():
            line = raw_line.strip()
            pdf.set_x(pdf.l_margin)
            if not line or line.startswith("# "):
                pdf.ln(2)
                continue
            if line.startswith("### "):
                pdf.set_font("Helvetica", "B", 12)
                pdf.multi_cell(0, 7, clean(line[4:]))
                pdf.set_font("Helvetica", "", 11)
            elif line.startswith("## "):
                pdf.set_font("Helvetica", "B", 13)
                pdf.multi_cell(0, 7, clean(line[3:]))
                pdf.set_font("Helvetica", "", 11)
            elif line.startswith("- "):
                pdf.multi_cell(0, 6, clean("  - " + line[2:]))
            else:
                pdf.multi_cell(0, 6, clean(line))

    os.makedirs(os.path.dirname(OUTPUT_PDF), exist_ok=True)
    pdf.output(OUTPUT_PDF)
    print(f"Regenerated {OUTPUT_PDF} from {len(entries)} entr{'y' if len(entries) == 1 else 'ies'}")


if __name__ == "__main__":
    os.makedirs(ENTRIES_DIR, exist_ok=True)
    build()
