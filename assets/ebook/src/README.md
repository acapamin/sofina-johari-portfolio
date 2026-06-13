# Ebook source

`book.html` is the full 24-page ebook (A4 pages as styled HTML).
Title: **Financial Planning Made Simple** by Dr. Sofina Johari.

Fonts (Fraunces + Instrument Sans) are vendored locally in `fonts/`
(`fonts/google.css` + the `f*.woff2` files) so the PDF renders identically
offline — no Google Fonts request at print time.

To regenerate the PDF after editing `book.html`:

```sh
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=../financial-planning-sofina-johari.pdf \
  --virtual-time-budget=15000 \
  "file://$PWD/book.html"

# Linux (chrome/chromium)
chrome --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=../financial-planning-sofina-johari.pdf \
  --virtual-time-budget=15000 \
  "file://$PWD/book.html"
```

Then re-apply the PDF metadata (title/author) with pypdf:

```sh
python3 - <<'PY'
from pypdf import PdfReader, PdfWriter
r = PdfReader("../financial-planning-sofina-johari.pdf")
w = PdfWriter()
for p in r.pages: w.add_page(p)
w.add_metadata({"/Title": "Financial Planning Made Simple",
                "/Author": "Dr. Sofina Johari",
                "/Subject": "Simple money concepts for every Malaysian"})
with open("../financial-planning-sofina-johari.pdf", "wb") as f: w.write(f)
PY
```
