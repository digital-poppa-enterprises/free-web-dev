# Digital Poppa Enterprises — First 50 Web App Campaign (Static Site)

Plain HTML / CSS / JS, ready to host for free on **GitHub Pages**.

---

## File layout

```
index.html          ← the full page (was templates/index.html)
styles.css          ← unchanged from static/styles.css
main.js             ← updated: same behaviour, fully commented
assets/
  favicon.png
  logo-primary.png
  clipart/
    clipart-booking-system.svg
    clipart-dashboard.svg
    clipart-hosting.svg
    clipart-idea-to-app.svg
    clipart-online-application.svg
    clipart-web-development.svg
    clipart-workflow.svg
```

---

## What was removed / changed

| Original | Static version |
|---|---|
| `app.py` (FastAPI server) | Deleted |
| `requirements.txt` | Deleted |
| `/static/assets/…` paths | Changed to `assets/…` (relative) |
| `styles.css?v=20261104-4` cache-bust param | Removed — not needed on static hosting |
| `main.js?v=20261104-2` cache-bust param | Removed |
| Form submits to FastAPI | Local success state; Formspree drop-in in main.js |

The original `app.py` had no Jinja2 template variables — it passed an empty
context `{}` — so the HTML template required zero changes beyond path updates.

---

## Deploy on GitHub Pages

```bash
git init
git add .
git commit -m "Initial static site"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then: **Settings → Pages → Source: main / (root)** → Save.

Live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## Adding real form submissions (optional)

The form shows a local success message on submit. To receive actual
applications by email, use **Formspree** (free tier = 50 submissions/month):

1. Sign up at https://formspree.io and create a new form.
2. Copy your endpoint, e.g. `https://formspree.io/f/xnqkyzab`.
3. In `main.js`, find `handleFormSuccess()` and replace its body:

```js
async function handleFormSuccess(form) {
  const data = new FormData(form);
  try {
    const res = await fetch("https://formspree.io/f/YOUR_FORM_ID", {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      form.classList.add("is-success");
      markApplied();
    } else {
      // Optionally show an inline error message here
    }
  } catch {
    // Network error — show a fallback message if needed
  }
}
```
