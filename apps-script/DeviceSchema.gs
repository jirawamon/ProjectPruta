/*
  DeviceSchema.gs

  Deploy as: Apps Script Web App
  - Execute as: Me (script owner)
  - Who has access: Anyone (or Anyone within domain)

  This script supports JSONP via doGet to avoid browser CORS limitations.
  It creates (or updates) a sheet tab and writes header columns to row 1.

  Query params:
    action=createSchema
    token=YOUR_SHARED_TOKEN
    spreadsheetId=...
    sheetName=...
    headers=["COL1","COL2",...]
    callback=someFunctionName
*/

function jsonp(callbackName, payload) {
  var text = (callbackName || 'callback') + '(' + JSON.stringify(payload) + ')';
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getRequiredToken_() {
  // Set this in Script Properties: TOKEN
  // Apps Script editor: Project Settings -> Script properties
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('TOKEN') || '';
}

function ensureSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  return ss.insertSheet(sheetName);
}

function writeHeaders_(sheet, headers) {
  if (!headers || !headers.length) {
    throw new Error('headers is required');
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function listSheetNames_(ss) {
  var sheets = ss.getSheets();
  var names = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    names.push(sh.getName());
  }
  return names;
}

function readHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol || lastCol < 1) return [];
  var values = sheet.getRange(1, 1, 1, lastCol).getValues();
  var row = (values && values.length) ? values[0] : [];
  var headers = [];
  for (var i = 0; i < row.length; i++) {
    var cell = row[i];
    var text = (cell === null || typeof cell === 'undefined') ? '' : String(cell);
    if (text.trim()) headers.push(text.trim());
  }
  return headers;
}

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var callback = p.callback;

  try {
    if (!p.action) {
      return jsonp(callback, { ok: false, error: 'action is required' });
    }

    var requiredToken = getRequiredToken_();
    if (requiredToken) {
      if (!p.token || p.token !== requiredToken) {
        return jsonp(callback, { ok: false, error: 'Unauthorized' });
      }
    }

    var spreadsheetId = p.spreadsheetId;

    if (!spreadsheetId) {
      return jsonp(callback, { ok: false, error: 'spreadsheetId is required' });
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);

    if (p.action === 'listSchemas') {
      var names = listSheetNames_(ss);
      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheets: names });
    }

    if (p.action === 'getHeaders') {
      var sheetNameForHeaders = p.sheetName;
      if (!sheetNameForHeaders) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }

      var sheetForHeaders = ss.getSheetByName(sheetNameForHeaders);
      if (!sheetForHeaders) {
        return jsonp(callback, { ok: false, error: 'sheet not found' });
      }

      var headers = readHeaders_(sheetForHeaders);
      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetNameForHeaders, headers: headers });
    }

    if (p.action === 'createSchema') {
      var sheetName = p.sheetName;
      var headersRaw = p.headers;

      if (!sheetName) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }
      if (!headersRaw) {
        return jsonp(callback, { ok: false, error: 'headers is required' });
      }

      var headersToWrite = JSON.parse(headersRaw);
      if (!headersToWrite || !headersToWrite.length) {
        return jsonp(callback, { ok: false, error: 'headers must be a non-empty array' });
      }

      var sheet = ensureSheet_(ss, sheetName);
      writeHeaders_(sheet, headersToWrite);

      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetName, headerCount: headersToWrite.length });
    }

    return jsonp(callback, { ok: false, error: 'Invalid action' });
  } catch (err) {
    var msg = (err && err.message) ? err.message : String(err);
    return jsonp(callback, { ok: false, error: msg });
  }
}
