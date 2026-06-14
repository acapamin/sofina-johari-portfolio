const { chromium } = require('playwright');
const path = require('path');

async function generatePDF() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const filePath = path.resolve('/Users/sofinajohari/Desktop/sofina-johari-portfolio/assets/ebook/src/book.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const pdfPath = '/Users/sofinajohari/Desktop/sofina-johari-portfolio/assets/ebook/financial-planning-sofina-johari.pdf';
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  console.log(`PDF generated: ${pdfPath}`);
  await browser.close();
}

generatePDF().catch(console.error);