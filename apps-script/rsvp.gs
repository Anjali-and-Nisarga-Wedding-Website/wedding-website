/**
 * RSVP webhook for the Anjali & Nisarga wedding site.
 *
 * Deploy:
 *   1. From the bound Sheet, Extensions → Apps Script.
 *   2. Paste this file's contents into Code.gs (replacing the stub).
 *   3. Fill in the three placeholders at the top: INVITE_CODE,
 *      TO_ADDRESSES (real emails), SHEET_NAME (stays as 'RSVPs').
 *   4. Save (Cmd+S).
 *   5. Run testWriteRow once → grant OAuth → verify a test row lands
 *      in the Sheet and emails arrive at both TO_ADDRESSES.
 *   6. Deploy → New deployment → Web app → Execute as: Me, Access:
 *      Anyone → Deploy → copy the /exec URL.
 *
 * Iterate later (preserves URL):
 *   Edit → Save → Deploy → Manage deployments → ✏️ → Version: New
 *   version → Deploy. Never click "New deployment" after the first
 *   one — that mints a new URL and breaks the form.
 *
 * The committed copy of this file at wedding-website/apps-script/rsvp.gs
 * keeps INVITE_CODE / TO_ADDRESSES as [TOKEN] placeholders so the real
 * invite code and recipient emails never land in public git history.
 * The deployed copy in the Apps Script editor must have real values
 * filled in. See _project-context/03-decisions-log.md.
 */

const INVITE_CODE  = '[INVITE_CODE]';                  // e.g. 'WEDDING2026'
const TO_ADDRESSES = ['[TO_EMAIL_1]', '[TO_EMAIL_2]']; // Nisarga + Anjali
const SHEET_NAME   = 'RSVPs';

function doPost(e) {
  try {
    const params = (e && e.parameter) || {};
    const t = v => (v == null ? '' : String(v).trim());

    const invite_code = t(params.invite_code);
    const name        = t(params.name);
    const email       = t(params.email);

    // Validate BEFORE touching the Sheet. Single generic error message
    // for any failure so we don't leak which field was bad.
    if (!invite_code || invite_code !== INVITE_CODE || !name || !email) {
      return _json({
        result: 'error',
        message: "Sorry, we couldn't verify your RSVP. Please double-check your details and try again.",
      });
    }

    const row = _buildRow_(params, name, email, invite_code);
    _appendRow_(row);
    _notify_(row);
    return _json({ result: 'success' });

  } catch (err) {
    console.error('doPost failed:', err);
    return _json({
      result: 'error',
      message: 'Something went wrong. Please try again or email us directly.',
    });
  }
}

function doGet() {
  return _json({ result: 'error', message: 'POST only.' });
}

// Row order matches 02-rsvp-schema.md exactly:
// Timestamp | name | email | attending | party_size | meal | dietary |
// message | invite_code
function _buildRow_(p, name, email, invite_code) {
  const t = v => (v == null ? '' : String(v).trim());
  return [
    new Date().toISOString(),  // UTC, ISO 8601 with ms + 'Z'
    name,
    email,
    t(p.attending),
    t(p.party_size),
    t(p.meal),
    t(p.dietary),
    t(p.message),
    invite_code,
  ];
}

// ScriptLock serializes concurrent doPost calls so two RSVPs in the
// same instant don't trample each other on appendRow.
function _appendRow_(row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);  // 10s; doPost has a 30s execution cap.
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet tab "' + SHEET_NAME + '" not found.');
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

// Mail failures must not roll back the row — by this point it's saved.
function _notify_(row) {
  const [timestamp, name, email, attending, party_size, meal, dietary, message] = row;
  const subject = 'New RSVP: ' + name + (attending ? ' (' + attending + ')' : '');
  const body = [
    'Name:          ' + name,
    'Email:         ' + email,
    'Attending:     ' + (attending  || '(not specified)'),
    'Party size:    ' + (party_size || '(not specified)'),
    'Meal:          ' + (meal       || '(not specified)'),
    'Dietary:       ' + (dietary    || '(none)'),
    'Note:          ' + (message    || '(none)'),
    'Timestamp UTC: ' + timestamp,
  ].join('\n');

  TO_ADDRESSES.forEach(function (addr) {
    if (!addr || addr.indexOf('[') === 0) return;  // skip unfilled tokens
    try {
      MailApp.sendEmail(addr, subject, body);
    } catch (mailErr) {
      console.error('MailApp.sendEmail failed for ' + addr + ':', mailErr);
    }
  });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Smoke test — run from the Apps Script editor before deploying so
// OAuth gets granted and we confirm Sheet + email side-effects work.
// Writes a row tagged DELETE ME. Delete the row from the Sheet after.
function testWriteRow() {
  const fakeEvent = { parameter: {
    name:        'TEST SUBMISSION — DELETE ME',
    email:       'test@example.com',
    attending:   'Yes',
    party_size:  '1',
    meal:        'Vegetarian',
    dietary:     'none',
    message:     'Smoke test from Apps Script editor',
    invite_code: INVITE_CODE,
  }};
  Logger.log(doPost(fakeEvent).getContent());
}
