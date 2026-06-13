# Social Media Icons

SVG icons for Instagram and Threads social media links.

## Usage Options

### Option 1: Inline SVG (Current Implementation)

Place SVG code directly in your HTML. This allows you to easily customize colors with CSS `currentColor`:

```html
<!-- Instagram Icon -->
<a href="https://www.instagram.com/sofina.johari/" target="_blank" rel="noopener" aria-label="Instagram">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.88 5.88 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.15A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/>
  </svg>
</a>

<!-- Threads Icon -->
<a href="https://www.threads.com/@sofina.johari" target="_blank" rel="noopener" aria-label="Threads">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.312-.883-2.371-.889h-.048c-.781 0-1.759.204-2.415 1.32L7.172 9.289c.796-1.363 2.096-2.144 3.72-2.217.07-.003.14-.003.21-.003 1.929 0 3.477.671 4.493 1.94.965 1.21 1.404 2.915 1.277 4.96l-.012.196c1.248.657 2.083 1.65 2.501 2.963.595 1.87.34 4.329-1.612 6.241-1.657 1.617-3.867 2.374-6.763 2.631z"/>
  </svg>
</a>
```

### Option 2: External SVG Files

Reference SVG files directly in your HTML:

```html
<!-- Instagram Icon -->
<a href="https://www.instagram.com/sofina.johari/" target="_blank" rel="noopener" aria-label="Instagram">
  <img src="assets/icons/instagram.svg" alt="" width="24" height="24" loading="lazy">
</a>

<!-- Threads Icon -->
<a href="https://www.threads.com/@sofina.johari" target="_blank" rel="noopener" aria-label="Threads">
  <img src="assets/icons/threads.svg" alt="" width="24" height="24" loading="lazy">
</a>
```

## CSS Styling

Style the icons with CSS:

```css
.cta__socials a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #c9a14a; /* or your brand color */
  transition: color 0.2s ease;
}

.cta__socials a:hover {
  color: #d4b558;
  transform: scale(1.1);
}

.cta__socials svg,
.cta__socials img {
  width: 24px;
  height: 24px;
}
```

## Icon Details

- **Instagram**: Official Instagram icon (camera with rounded corners)
- **Threads**: Meta Threads icon (stylized @ symbol)
- **Format**: SVG with viewBox="0 0 24 24"
- **Color**: Uses `currentColor` for easy theming via CSS
- **Accessibility**: Includes `aria-label` on links and `aria-hidden="true"` on SVGs
