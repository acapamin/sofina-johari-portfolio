# Ebook source

`book.html` is the full 24-page ebook (A4 pages as styled HTML).

To regenerate the PDF after editing:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=../financial-planning-sofina-johari.pdf \
  --virtual-time-budget=10000 \
  "file://$PWD/book.html"
```

Then re-add PDF metadata (title/author) with pypdf if desired.
