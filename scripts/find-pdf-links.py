import pdfplumber

PDF = "content/resume/Subash_Lama_CV.pdf"
KEYWORDS = ["linkedin", "github", "gmail", "hackerone", "intigriti", "bugcrowd", "subash107", "9840005771"]

with pdfplumber.open(PDF) as pdf:
    for pi, page in enumerate(pdf.pages):
        words = page.extract_words()
        for w in words:
            if any(k in w["text"].lower() for k in KEYWORDS):
                print("P%d x0=%.1f top=%.1f x1=%.1f bot=%.1f %s" % (
                    pi+1, w["x0"], w["top"], w["x1"], w["bottom"], w["text"]
                ))
