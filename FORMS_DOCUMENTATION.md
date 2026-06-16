# Forms Documentation

## Overview
The website uses two custom Google Forms with beautiful modal UI:
1. **Ebook Gate Form** - Lead magnet for free financial planning ebook
2. **Contact/Website Application Form** - Comprehensive consultation booking form

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
index.html              - HTML markup for both modals
styles.css             - CSS for .ebook-modal, .contact-modal classes
ebook-gate.js          - Ebook form logic and submission
contact-form.js        - Contact form logic and submission
```

---

## Future Enhancements

- Add email confirmation after submission
- Webhook integration to send data to CRM
- Progress indicators for multi-step contact form
- Conditional field visibility based on responses
- Form pre-population from URL parameters
