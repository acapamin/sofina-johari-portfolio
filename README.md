# Sofina Johari — Licensed Financial Planner Portfolio

A beautiful, high-performance portfolio website for Dr. Sofina Johari, a licensed financial planner in Malaysia. Built with semantic HTML, vanilla JavaScript, and optimized CSS for speed and accessibility.

**Live:** https://sofina-johari-portfolio.netlify.app/

---

## 🎯 Overview

This is a modern single-page portfolio website featuring:
- Hero section with animated canvas background
- Comprehensive sections: Story, Services, Credentials, Testimonials, Videos
- Interactive financial planning tools (Capy the capybara mascot)
- Free ebook gate with email capture
- Beautiful custom Google Forms for lead generation
- AI chatbot (Amy) for instant engagement
- Mobile-responsive design
- Accessibility-first approach

---

## 📑 Project Structure

```
sofina-johari-portfolio/
├── index.html                 # Main HTML document
├── styles.css                 # All styling (variables, modals, responsive)
├── main.js                    # Core interactions (nav, scroll, animations)
├── Mascot.js                  # Capy mascot rendering (Three.js)
├── FinancialEngine.js         # Financial calculation logic
├── financial-levels.js        # Interactive levels/stages
├── carousel.js                # Services, testimonials, videos carousels
├── chat.js                    # Amy AI chatbot interface
├── ebook-gate.js              # Ebook form & PDF download
├── contact-form.js            # Contact/consultation form
├── netlify/
│   └── functions/
│       ├── chat.mjs           # Amy AI chat proxy (OpenRouter)
│       └── send-roadmap.mjs   # "Send to Sofina" roadmap email (Resend)
├── assets/
│   └── ebook/                 # Ebook resources and generation
├── FORMS_DOCUMENTATION.md     # Complete forms reference
└── README.md                  # This file
```

---

## 🎨 Design System

### Color Palette
- **Ink (Primary):** `#0b1f1a` — Deep, sophisticated dark green
- **Cream (Background):** `#f6f1e7` — Warm, inviting off-white
- **Gold (Accent):** `#c9a14a` — Warm, premium accent color
- **Text Muted:** `#5b6b65` — Secondary text color

### Typography
- **Display Font:** Fraunces (serif) — headings, titles
- **Body Font:** Instrument Sans (sans-serif) — body text
- **Pixel Font:** Press Start 2P — retro elements (Capy)

### Spacing
- Uses `clamp()` for fluid, responsive spacing
- Consistent gap sizes: 0.5rem, 0.75rem, 1rem, 1.3rem, 2.8rem

---

## 📝 Forms Overview

The website features three lead-capture forms:

### 1. **Ebook Gate Form** 
- **Purpose:** Lead magnet for free financial planning ebook
- **Fields:** Name, Email, WhatsApp Number, Subscribe to Broadcast
- **Submission:** Triggers PDF download + thank you message
- **Google Form ID:** `1FAIpQLSdndj7iJ9gYYzYi4qv_tFy7LtqCPICpTmDAcXtC3BbSuAza4w`
- **Files:** `ebook-gate.js`, ebook modal in `index.html`

### 2. **Contact Form (Website Application)**
- **Purpose:** Comprehensive consultation booking + diagnostic questionnaire
- **Fields:** 11 fields covering financial profile, goals, family status, income, investments, takaful, coverage, urgency, readiness, and additional notes
- **Google Form ID:** `1FAIpQLSfFRnvYgJo-sTMFf8FpwbL0D-wvC45C76EXq3Z62_iNov00sg`
- **Files:** `contact-form.js`, contact modal in `index.html`

### 3. **Capy's Quest Roadmap — "Send to Sofina"**
- **Purpose:** Sends the user's Capy's Quest financial roadmap to Sofina with contact details
- **Fields:** Name, Email, WhatsApp Number, Subscribe to Broadcast, optional note, and the full multi-world financial report
- **Submission:** JSON POST to `/api/send-roadmap`, a Netlify Function that emails Sofina via [Resend](https://resend.com)
- **Validation:** Name, email, and WhatsApp are required — validated client-side and server-side
- **Files:** `financial-levels.js` (modal wiring + `sendToSofina()`), plan modal in `index.html`, `netlify/functions/send-roadmap.mjs` (Resend email)
- **Config:** requires only the `RESEND_API_KEY` env var; the sender (`roadmap@eazylaundry.biz`, a verified domain) is hardcoded in `send-roadmap.mjs` — see `.env.example`

**See [FORMS_DOCUMENTATION.md](FORMS_DOCUMENTATION.md) for complete field mappings, entry IDs, and validation rules.**

---

## 🚀 Features

### Interactive Elements
- **Animated Hero Canvas** — Particle effects background
- **Capy Financial Journey** — Interactive 8-bit financial simulator with sliders
- **Carousels** — Services, testimonials, and videos with keyboard support
- **Amy Chatbot** — AI assistant for instant financial questions
- **Urgency Scale Slider** — 1-10 scale input in contact form

### Lead Generation
- **Ebook Gate** — Free PDF download with email capture
- **Contact Form** — Comprehensive diagnostic form
- **WhatsApp Integration** — Quick chat button throughout site

### Accessibility
- Semantic HTML5 structure
- ARIA labels and roles throughout
- Keyboard navigation support
- Focus visible states on all interactive elements
- Color contrast meets WCAG AA standards
- Reduced motion support

### Performance
- Lazy loading on iframes and images
- Optimized font loading
- Minimal JavaScript dependencies
- CSS variables for efficient theming
- No external form embeds (custom modals)

---

## 🛠️ Technology Stack

- **HTML5** — Semantic markup
- **CSS3** — Variables, Grid, Flexbox, animations
- **Vanilla JavaScript** — No framework dependencies
- **Three.js** — 3D rendering (Mascot)
- **GSAP** — Animation library
- **Google Forms** — Backend for form submissions
- **Netlify** — Hosting & CDN

---

## 📋 Form Technical Details

### Submission Method
The Ebook Gate and Contact forms use Google Forms API with `fetch()` and `mode: 'no-cors'`:
```javascript
fetch(formEndpoint, {
  method: "POST",
  mode: "no-cors",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: urlEncodedData
})
```

This approach:
- Avoids CORS restrictions
- Returns opaque response (data still reaches Google Forms)
- Reliable for both simple and complex forms
- No backend server required

The Capy's Quest Roadmap posts a JSON payload (contact details + full text report) to the **`/api/send-roadmap` Netlify Function**, which emails it to Sofina via **Resend**. The sender (`roadmap@eazylaundry.biz`, a verified domain) is hardcoded in `send-roadmap.mjs`, so only `RESEND_API_KEY` is required in the Netlify environment (`RESEND_TO` is an optional recipient override) — see `.env.example`.

### Validation
- Client-side validation before submission
- Required field checks
- Multi-select constraints (e.g., max 2 family options)
- Error messages displayed inline
- Submit button disabled during POST

### Success Flow
1. Form data validated
2. POST to Google Forms endpoint
3. UI feedback: button state change
4. Ebook: PDF download triggered
5. Contact: Thank you message shown
6. Auto-close modal after delay

---

## 🔧 Development

### Running Locally
```bash
# Clone the repository
git clone <repo-url>
cd sofina-johari-portfolio

# Open in browser
open index.html
# or start a local server
python -m http.server 8000
```

### Making Changes

#### Adding a Form Field
1. Get the entry ID from Google Forms (prefilled link method)
2. Add HTML input in the modal
3. Add validation logic in JavaScript
4. Update FORMS_DOCUMENTATION.md
5. Test form submission

#### Styling
- All styles in `styles.css`
- Use CSS variables for colors: `var(--gold)`, `var(--text)`, etc.
- Update `:root` section for theme changes
- Mobile breakpoints: `@media (max-width: 768px)`, `@media (max-width: 480px)`

#### JavaScript
- Self-contained modules (IIFE pattern)
- No external dependencies required
- Use vanilla DOM API
- Add semantic class names

---

## 📱 Responsive Design

The site is fully responsive with careful breakpoint handling:
- **Desktop:** Full layout with all features
- **Tablet (768px):** Adjusted spacing and font sizes
- **Mobile (480px):** Single column, stacked modals, touch-friendly

Test with:
```bash
# Chrome DevTools
Ctrl+Shift+M (or Cmd+Shift+M)
```

---

## ♿ Accessibility Checklist

- ✅ Semantic HTML (`<header>`, `<main>`, `<section>`, etc.)
- ✅ ARIA labels on interactive elements
- ✅ Color contrast ratio ≥ 4.5:1
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Focus visible states
- ✅ Alternative text for decorative elements
- ✅ Form labels associated with inputs
- ✅ Reduced motion support
- ✅ Proper heading hierarchy

Run accessibility audit:
```bash
# Chrome DevTools → Lighthouse → Accessibility
```

---

## 📊 Analytics & Tracking

Forms submit directly to Google Forms. Set up tracking:

1. **Google Forms → Responses:** View submissions
2. **Google Sheets:** Auto-populated spreadsheet
3. **Sofina's Email:** Notification on new submissions
4. **Webhook (Optional):** Connect to CRM via Zapier

---

## 🐛 Troubleshooting

### Form not submitting
- Check browser console for errors
- Verify Google Form IDs in JS files
- Test form endpoint with curl:
  ```bash
  curl -X POST https://docs.google.com/forms/d/e/FORMID/formResponse \
    -d "entry.XXX=value"
  ```
- Ensure network request shows 200/undefined (opaque response is OK)

### Modal not opening
- Check element IDs match between HTML and JS
- Verify button has `id="contactTrigger"` or `id="ebookDownloadBtn"`
- Inspect console for JavaScript errors

### Styles not applying
- Clear browser cache (Ctrl+Shift+Delete)
- Check CSS selectors match HTML classes
- Verify `styles.css` is linked in `<head>`

---

## 📚 Additional Resources

- [FORMS_DOCUMENTATION.md](FORMS_DOCUMENTATION.md) — Complete forms reference with entry IDs
- [Google Forms API](https://developers.google.com/forms) — Official documentation
- [GSAP Animation Library](https://greensock.com/gsap/) — Scroll triggers, animations
- [Three.js Documentation](https://threejs.org/docs/) — 3D rendering
- [Web Accessibility](https://www.w3.org/WAI/ARIA/apg/) — ARIA best practices

---

## 📄 License

This portfolio website and all original content are the property of Dr. Sofina Johari. Unauthorized reproduction or modification is prohibited.

---

## 👤 About Sofina Johari

**Licensed Capital Market Representative** (Securities Commission Malaysia)  
**Islamic Financial Advisor (IFAR)** (Bank Negara Malaysia)  
**Shariah Registered Financial Planner** (Malaysian Financial Planning Council)  
**PhD in Physics** — Battery Materials (Universiti Malaya, 2022)

Sofina is a licensed independent financial planner serving all Malaysians with comprehensive financial planning, investments, insurance & takaful advisory, and Shariah-compliant solutions.

**Contact:** sofinajohari.uwealth@gmail.com  
**WhatsApp:** +60 38 6856 299  
**Instagram:** @sofina.johari

---

**Last Updated:** June 2026  
**Version:** 2.0 (Complete Forms Implementation)
