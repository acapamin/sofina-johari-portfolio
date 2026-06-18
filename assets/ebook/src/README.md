# Ebook source

`book.html` is the full 24-page ebook (A4 pages as styled HTML).

## Fonts

The book uses **self-hosted static instances** of Fraunces and Instrument Sans
(in `../../fonts/`), shared with the Capy's Quest roadmap PDF and wired up with `@font-face` at the top of `book.html`.

Do **not** switch back to the Google Fonts `<link>` (the variable fonts). When
Chromium prints a variable font to PDF it embeds every glyph as a Type3
vector-drawing procedure, which made the old PDF ~1.8 MB and painfully slow to
open. The static instances embed as normal subsetted TrueType: ~0.6 MB, fast,
and with selectable text.

To rebuild the static instances (rarely needed): `../../fonts/build-fonts.sh`.

## Regenerate the PDF

```sh
cd ..            # assets/ebook
npm install
npx playwright install chromium
npm run generate-pdf
```

This runs `generate-pdf.js`, which renders `src/book.html` to
`financial-planning-sofina-johari.pdf` at A4 with backgrounds.

(Optional) re-add PDF metadata (title/author) with pypdf afterwards if desired.
