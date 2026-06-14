const { chromium } = require('playwright');
const path = require('path');

// Resolve paths relative to this script so generation works on any machine.
const SRC = path.resolve(__dirname, 'src', 'book.html');
const OUT = path.resolve(__dirname, 'financial-planning-sofina-johari.pdf');

async function generatePDF() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('file://' + SRC, { waitUntil: 'networkidle' });
  // Ensure the self-hosted fonts are fully parsed before printing so the
  // glyphs embed as proper subsetted TrueType (not Type3 fallbacks).
  await page.evaluate(() => document.fonts.ready);

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  console.log('PDF generated: ' + OUT);
  await browser.close();
}

generatePDF().catch((err) => { console.error(err); process.exit(1); });
