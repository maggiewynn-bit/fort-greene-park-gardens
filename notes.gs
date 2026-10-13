/**
 * Fort Greene Park Gardens: save notes from the website into the sheet's "Notes" tab.
 *
 * Set up (once, by someone who can edit the sheet):
 *  1. Open the Google Sheet > Extensions > Apps Script. Replace the starter code with this file. Save.
 *  2. Project Settings (gear) > Script properties > Add property:
 *       NOTES_PASSCODE = a word or phrase you will give to the people allowed to add notes.
 *  3. Deploy > New deployment > type "Web app".
 *       Execute as: Me.   Who has access: Anyone.   Deploy, and approve the permissions it asks for.
 *  4. Copy the Web app URL into notesWebAppUrl in config.js.
 * After changing this code later, use Deploy > Manage deployments > Edit > New version, so the URL stays the same.
 */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  var pass = PropertiesService.getScriptProperties().getProperty('NOTES_PASSCODE');
  if (!pass || body.passcode !== pass) return reply({ ok: false, error: 'passcode' });

  var text = clip(body.text, 1500), garden = clip(body.garden, 120), author = clip(body.author, 80);
  if (!text || !garden) return reply({ ok: false, error: 'missing' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Notes');
  if (!sheet) { sheet = ss.insertSheet('Notes'); sheet.appendRow(['Date', 'Garden', 'Note', 'Author']); }
  sheet.appendRow([new Date(), garden, text, author]);
  return reply({ ok: true });
}

// Text only: a leading = + - @ would otherwise be read as a formula.
function clip(v, n) {
  v = String(v == null ? '' : v).trim().slice(0, n);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
