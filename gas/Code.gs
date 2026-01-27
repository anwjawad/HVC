// Code.gs - Backend for HomeVisits App

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HCV");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({error: "Sheet 'HCV' not found"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const data = rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      // Handle Date formatting
      if (row[i] instanceof Date) {
        obj[h] = Utilities.formatDate(row[i], Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        obj[h] = row[i];
      }
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HCV");
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (payload.action === 'register') {
      const p = payload.data;
      const newRow = headers.map(h => p[h] || "");
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'update') {
      // Find row by ID (Pt file Num.)
      const id = payload.id;
      const updates = payload.updates; // { 'Servival Status': 'Died', 'V6': '2025-01-26' }
      
      const data = sheet.getDataRange().getValues();
      const idIndex = headers.indexOf("Pt file Num.");
      
      if (idIndex === -1) throw new Error("ID Column not found");

      let rowIndex = -1;
      // Search for row (1-based index for sheet operations, so i+1)
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIndex]) === String(id)) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) throw new Error("Patient not found");

      // Apply Updates
      for (const [key, value] of Object.entries(updates)) {
        let colIndex = headers.indexOf(key);
        
        // Handle Dynamic Column Creation (e.g. V6, V7)
        if (colIndex === -1) {
          // If key looks like 'V' + number OR is a specific field we want to allow dynamic creation for
          // For now, let's allow ANY valid key to create a column to be safe for "Place of death" etc.
          if (key && key.length > 0) {
            sheet.insertColumnAfter(sheet.getLastColumn());
            const newColIndex = sheet.getLastColumn();
            sheet.getRange(1, newColIndex).setValue(key); // Set Header
            headers.push(key); // Update local headers array
            colIndex = newColIndex - 1; // 0-based
          }
        }
        
        // Update Cell
        sheet.getRange(rowIndex, colIndex + 1).setValue(value);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "updated" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid Action" })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
