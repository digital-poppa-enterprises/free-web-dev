# Digital Poppa Enterprises - First 50 Web App Campaign (Static Site)

Plain HTML / CSS / JS, ready to host for free on **GitHub Pages**.

---

## File layout

```
index.html
scripts/main.js
styles/normalize.css
styles/small.css
styles/larger.css
images/
apps-script/Code.gs
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
| Form submits to FastAPI | Google Apps Script stores submissions in a private Drive JSON file |

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

## Configure application submissions and weekly email

GitHub Pages only serves static files; it cannot safely write form data to a
JSON file. The Apps Script endpoint stores submissions in a private file in the
owner's Google Drive and emails a weekly summary. The JSON file is not part of
this repository or the public website.

1. Create a project at [Google Apps Script](https://script.google.com/).
2. Copy `apps-script/Code.gs` into the project's `Code.gs` file.
3. In **Project Settings → Script Properties**, add:
   - Property: `RECIPIENT_EMAIL`
   - Value: the address that should receive the weekly summary
4. In **Project Settings**, set the time zone for the weekly schedule.
5. In the editor, run `initializeSubmissionStorage` and approve the requested
   Google Drive access. This creates the private JSON file.
6. Run `installWeeklyDigestTrigger` and approve the requested permissions.
   The weekly digest is scheduled for Monday at about 9:00 AM in the project's
   time zone. Apps Script may run it later within that hour.
7. Choose **Deploy → New deployment → Web app**. Set **Execute as** to your
   account and **Who has access** to **Anyone**, then deploy and authorize it.
   Use the deployed URL ending in `/exec`; do not use the test URL ending in
   `/dev`.
8. Copy the `/exec` URL into `applicationEndpoint` near the top of
   `scripts/main.js`:

   ```js
   const applicationEndpoint = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```

9. Publish the updated site on GitHub Pages and submit a test application.
   Confirm it appears in the private Drive JSON file before sharing the form.

When updating `Code.gs`, save it in Apps Script, then use **Deploy → Manage
deployments → Edit → New version → Deploy**. This updates the existing `/exec`
deployment URL without changing the URL in `main.js`.

Each stored record includes the submission time, name, email, optional phone,
project description, and whether it has been included in a digest. A successful
weekly email marks those submissions as sent; the JSON file retains the records.
Remove old records from the JSON file when they are no longer needed. If you
delete the file itself, also clear the `SUBMISSIONS_FILE_ID` script property
before initializing storage again.

The endpoint is public so anonymous GitHub Pages visitors can submit. The
server validates fields and uses a honeypot, but those are basic spam measures,
not a CAPTCHA. The endpoint URL is public and must not be treated as a secret.
