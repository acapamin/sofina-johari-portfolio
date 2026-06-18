# Forms Documentation

## Overview
The website uses three forms with custom modal UI:
1. **Ebook Gate Form** - Lead magnet for free financial planning ebook (Google Forms)
2. **Contact/Website Application Form** - Comprehensive consultation booking form (Google Forms)
3. **Capy's Quest Roadmap** - "Send to Sofina" from the Capy financial journey (Netlify Function + Resend email)

---

## Ebook Gate Form

**Form ID:** `1FAIpQLSdndj7iJ9gYYzYi4qv_tFy7LtqCPICpTmDAcXtC3BbSuAza4w`

**Location:** Modal triggered by "Download your free Ebook" button in the ebook section (#ebook)

### Fields:
| Field | Entry ID | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Name | entry.1541466959 | Text | ✓ | Full name |
| Email | entry.1327142487 | Email | ✓ | Email address |
| Whatsapp Number | entry.1243312249 | Tel | ✓ | Phone number for WhatsApp contact |
| Subscribe to Broadcast | entry.1235783281 | Radio | ✗ | "Yes, subscribe to broadcast on whatsapp" |

### Implementation:
- File: `ebook-gate.js`
- HTML Modal ID: `#ebookModal`
- Submission: POST to Google Forms endpoint with `mode: 'no-cors'`
- Success: Triggers PDF download, shows thank you message, closes modal after 2.5s

---

## Contact Form (Website Application)

**Form ID:** `1FAIpQLSfFRnvYgJo-sTMFf8FpwbL0D-wvC45C76EXq3Z62_iNov00sg`

**Location:** Modal triggered by "Book a Consultation" button in CTA section (#contact)

**Title:** "Website Application"
**Subtitle:** "Whether you're navigating T20 tax leaks, investment gaps, or the complexities of inheritance and frozen assets, the first step is a clear diagnostic. These 10 questions allows me to kickstart the audit of your current status so that our time together is spent on high-level strategy, not just fact-finding."

### Fields:

| # | Field | Entry ID | Type | Required | Options/Notes |
|----|-------|----------|------|----------|---------------|
| 1 | Name | entry.1122970565 | Text | ✓ | Full name |
| 2 | Whatsapp Number | entry.1197699276 | Tel | ✓ | Phone number for WhatsApp contact |
| 3 | Primary Financial Goal/Concern | entry.1349107782 | Checkboxes | ✓ | Select all that apply |
| | | | | | - Legacy Planning (Wasiat / Hibah / Frozen Assets) |
| | | | | | - Investment Optimisation (Growth / Diversification) |
| | | | | | - Cash Flow Management & Tax Efficiency |
| | | | | | - Child Education & Protection Planning |
| | | | | | - Other: (text field) |
| 4 | Current Family Status | entry.1937778218 | Checkboxes | ✓ | Select at most 2 options |
| | | | | | - Single |
| | | | | | - Married (Single Income) |
| | | | | | - Married (Dual Income) |
| | | | | | - Divorced |
| | | | | | - Widowed |
| | | | | | - Parent (with minor children) |
| 5 | Monthly Household Income | entry.219916951 | Radio | ✓ | Select one |
| | | | | | - Below RM10,000 |
| | | | | | - RM10,000 – RM15,000 |
| | | | | | - RM15,000 – RM25,000 |
| | | | | | - RM25,000 – RM50,000 |
| | | | | | - Above RM50,000 |
| 6 | Active Investments | entry.177956529 | Radio | ✓ | ASB, Unit Trust, Stocks, Crypto, etc. |
| | | | | | - Yes, just ASB and/or TH |
| | | | | | - Yes, beyond ASB and/or TH |
| | | | | | - No |
| 7 | Active Takaful Policies | entry.1621889027 | Radio | ✓ | Medical, Life, Critical Illness, Hibah Takaful |
| | | | | | - Yes |
| | | | | | - No |
| | | | | | - Maybe |
| 8 | Coverage Confidence | entry.91646277 | Radio | ✓ | Family protection if no longer around |
| | | | | | - Yes |
| | | | | | - No |
| | | | | | - Maybe |
| 9 | Urgency Scale | entry.4456387 | Linear Scale | ✓ | 1-10 (1 = Don't see need, 10 = Extremely urgent) |
| 10 | Ready for Session | entry.2090656090 | Radio | ✓ | 1-hour virtual alignment session |
| | | | | | - Yes |
| | | | | | - No |
| | | | | | - See how first |
| 11 | Additional Notes | entry.249267175 | Text | ✗ | Open-ended: "What's bothering your mind" |

### Implementation:
- File: `contact-form.js`
- HTML Modal ID: `#contactModal`
- Submission: POST to Google Forms endpoint with `mode: 'no-cors'`
- Success: Shows thank you message, closes modal after 3s

---

---

## Capy's Quest Roadmap — "Send to Sofina"

**Backend:** Netlify Function + **Resend** (`netlify/functions/send-roadmap.mjs`). _This replaced the previous Netlify Forms + dashboard-notification mechanism, which captured submissions but did not reliably email Sofina._

**Location:** Plan modal triggered by "Turn this into a real plan" button in the Your Toolkit section (#tools)

**Trigger:** The "Send to Sofina" button inside the roadmap modal

### Fields (JSON body POSTed to `/api/send-roadmap`):
| Field | JSON key | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Name | `name` | string | ✓ | Full name |
| Email | `email` | string | ✓ | Email address (validated server-side too) |
| WhatsApp Number | `whatsapp` | string | ✓ | Phone number |
| Subscribe to Broadcast | `subscribe` | string | ✗ | "Yes, subscribe to broadcast on whatsapp" or "No" |
| Readiness | `readiness` | string | auto | Overall % score across all four worlds |
| Remark | `remark` | string | ✗ | Optional note for Sofina |
| Report | `report` | string | auto | Full plain-text roadmap including contact details and all world commentary |

### Implementation:
- Client: `financial-levels.js` — `sendToSofina()` builds the JSON body and POSTs it to `/api/send-roadmap`; `renderReportText()` builds the `report` text.
- Server: `netlify/functions/send-roadmap.mjs` — validates input, formats an HTML + plain-text email, and sends it via the Resend API. `reply_to` is set to the visitor's email so Sofina can reply directly.
- Route: `netlify.toml` maps `/api/send-roadmap` → `/.netlify/functions/send-roadmap` (declared before the SPA catch-all).
- HTML Modal ID: `#planModal`
- Validation: Name, email, and WhatsApp are validated client-side before submit (empty required fields block the POST and are highlighted) **and** re-validated server-side.
- The `report` text embeds a `CONTACT DETAILS` block at the top, and the email also lists the fields in a table, so Sofina sees everything in one place.
- Server errors (e.g. Resend rejecting the request) are surfaced inline in the modal so the visitor knows to retry.
- A honeypot (`bot-field`) is accepted and silently dropped without sending.

### Email delivery setup
Email delivery is handled entirely by the function — **no Netlify Forms / dashboard notification is involved.** One-time setup:

1. **Resend API key** — create one at https://resend.com/api-keys, using the account that owns the verified `eazylaundry.biz` domain.
2. **Netlify env var** — in **app.netlify.com → `sofina-johari-portfolio` → Site configuration → Environment variables**, add:
   - `RESEND_API_KEY` (required) = your Resend key — mark as **secret**.
   - `RESEND_TO` (optional) = recipient; defaults to `sofinajohari.uwealth@gmail.com`.
3. **Redeploy** so the function picks up the env vars.

> ✅ **Sender is hardcoded to a verified domain.** The sender `Capy's Quest <roadmap@eazylaundry.biz>` is set once in `netlify/functions/send-roadmap.mjs` (constant `FROM`) and is **not** configurable via env — there is no `RESEND_FROM` variable. Because `eazylaundry.biz` is verified in Resend, the function delivers to Sofina's gmail (or any address) directly with no per-recipient restriction. The `RESEND_API_KEY` must belong to the same Resend account that owns `eazylaundry.biz`. To change the sender (e.g. switch to another verified domain), edit the `FROM` constant in that one file. The `roadmap@` mailbox does not need to exist; `reply_to` is set to the visitor's email so Sofina's replies reach them.

### Download PDF
- File: `financial-levels.js` — `downloadRoadmapPDF()`, lazy-loads **html2canvas** + **jsPDF** from cdnjs on first click.
- The PDF body is a **pixel-faithful capture of the on-screen `#planReport`** (same fonts, gold badges, colour bars, two-column input grid and commentary), so the downloaded file matches exactly what the user sees in the app.
- The capture is sliced across A4 pages at world-card boundaries (`.plan-report__head` / `.plan-world`) so a card is never cut mid-page. A branded header band and page-number footer are added to every page.

### Report text structure:
```
CAPY'S MONEY QUEST — ROADMAP
Overall readiness: XX%
================================================

CONTACT DETAILS
Name: ...
Email: ...
WhatsApp: ...
WhatsApp Broadcast: ...
================================================

World 1-1 · The Coin Pipes   [+RMXXX]
...inputs and commentary...

World 1-2 · The Brick Shield   [SHIELD XX%]
...inputs and commentary (both phases)...

World 1-3 · The Flagpole Climb   [GOAL XX%]
...

World 1-4 · THE WILLOW GATE   [READY XX%]
...

================================================
User remark: ...
```

---

## Technical Notes

### Google Forms API
- Uses `fetch()` with `mode: 'no-cors'` to avoid CORS restrictions
- Data submitted as `application/x-www-form-urlencoded`
- No response body readable (opaque response), but data still reaches Google Forms
- Works reliably for both simple and complex form structures

### Form Validation
- Client-side validation before submission
- Required fields checked before POST
- Error messages displayed inline
- Submit button disabled during submission

### User Experience
- Modal animations: fade-in backdrop + slide-up panel (0.32s)
- Success states: form hidden, thank you message shown, auto-close
- Keyboard support: Esc key closes modals
- Mobile responsive: full-width on small screens
- Accessibility: ARIA labels, semantic HTML, focus management

---

## File Structure

```
index.html                        - HTML markup for all three modals
styles.css                        - CSS for .ebook-modal, .contact-modal, .plan-modal/.plan-send classes
ebook-gate.js                     - Ebook form logic and submission
contact-form.js                   - Contact form logic and submission
financial-levels.js               - Capy's Quest roadmap modal logic, sendToSofina() + PDF
netlify/functions/send-roadmap.mjs - Sends the "Send to Sofina" roadmap email via Resend
```

---

## Future Enhancements

- Add email confirmation after submission
- Webhook integration to send data to CRM
- Progress indicators for multi-step contact form
- Conditional field visibility based on responses
- Form pre-population from URL parameters
