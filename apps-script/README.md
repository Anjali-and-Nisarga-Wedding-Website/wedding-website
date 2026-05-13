# Apps Script — RSVP backend

This directory holds the Google Apps Script source for the RSVP form's
backend. The deployed Web App is bound to a Google Sheet titled
**Anjali & Nisarga RSVPs** with a tab named **RSVPs**.

## Why a committed `.gs` file

Apps Script has no native git integration. Keeping a copy here means:

- The doPost logic is reviewable in PR diffs.
- The deployed script can be restored from this file in a few clicks if
  the Apps Script project ever gets lost.

## Placeholders

The committed `rsvp.gs` ships with three tokens unfilled:

| Constant       | Committed value          | Deployed value (in the Apps Script editor) |
|----------------|--------------------------|--------------------------------------------|
| `INVITE_CODE`  | `'[INVITE_CODE]'`        | the real code (currently `WEDDING2026`)    |
| `TO_ADDRESSES` | `['[TO_EMAIL_1]', ...]`  | actual Gmail addresses for the couple      |
| `SHEET_NAME`   | `'RSVPs'`                | same — no change                           |

Why: we don't want the invite code or recipient emails in public git
history. Tradeoff: editing the script means manually re-filling these
placeholders in the Apps Script editor each time. The list is short.

## First deploy (one time)

1. From the bound Sheet: **Extensions → Apps Script**.
2. Replace the default stub in `Code.gs` with the contents of
   `rsvp.gs`. Fill in the three placeholders.
3. Save (Cmd+S). Name the project `Anjali & Nisarga RSVP`.
4. Pick `testWriteRow` from the function dropdown → **Run**. First run
   triggers OAuth:
   - "Authorization required" → Review permissions → pick the same
     Google account that owns the Sheet → "Google hasn't verified
     this app" → **Advanced** → **Go to Anjali & Nisarga RSVP
     (unsafe)** → **Allow**.
   - A test row tagged `TEST SUBMISSION — DELETE ME` should appear in
     the Sheet, and both `TO_ADDRESSES` should receive a test email.
5. Delete the test row from the Sheet.
6. **Deploy → New deployment → ⚙ → Web app**.
   - Description: `RSVP doPost v1`.
   - Execute as: **Me**.
   - Who has access: **Anyone** (not "Anyone with Google account").
   - **Deploy** → copy the `/exec` URL.
7. Wire the URL into `wedding-website/js/scripts.js` (replace the
   `[APPS_SCRIPT_EXEC_URL]` placeholder).
8. Run `npx gulp minify-js` so `scripts.min.js` picks up the new URL.

## Iterating later (preserves the URL)

**Critical**: never click "New deployment" again after step 6. That
mints a new `/exec` URL and breaks the form.

1. Edit the script in the Apps Script editor → Save.
2. **Deploy → Manage deployments → ✏️** (pencil icon on the existing
   deployment) → Version: **New version** → Description: a short
   note → **Deploy**.
3. The same `/exec` URL keeps working with the new code.

## When changing `INVITE_CODE`

The client-side MD5 check in `js/scripts.js` (theatre, but useful UX)
also needs updating:

```bash
node -e "console.log(require('crypto').createHash('md5').update('NEW_CODE').digest('hex'))"
```

Replace the hex in `js/scripts.js` and run `npx gulp minify-js`.

## Quotas to be aware of

- **MailApp.sendEmail**: 100/day on free Gmail, 1500/day on Workspace.
  At wedding scale (hundreds of RSVPs over weeks) this is plenty.
- **Apps Script execution time**: 30 s per invocation. doPost finishes
  in <1 s; lock wait is capped at 10 s.
- **200-version cap** on the Apps Script project — won't hit it for a
  wedding site, but delete old versions if you're iterating heavily.
