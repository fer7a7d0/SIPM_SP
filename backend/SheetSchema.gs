var SHEET_NAMES = {
  usuarios: "Usuarios",
  areas: "Areas",
  preguntas: "Preguntas",
  supervisiones: "Supervisiones",
  respuestas: "Respuestas"
};

var SHEET_HEADERS = {
  Usuarios: ["ID", "Nombre", "Rol"],
  Areas: ["ID", "Area", "Codigo QR"],
  Preguntas: ["ID", "Categoria", "Pregunta", "Orden", "Obliga comentario", "Obliga fotografia"],
  Supervisiones: ["ID", "Fecha", "Hora inicio", "Hora fin", "Duracion", "Supervisor", "Area", "GPS"],
  Respuestas: ["ID Supervision", "ID Pregunta", "Respuesta", "Comentario", "URL Fotografia"]
};

function ensureSheetStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var keys = Object.keys(SHEET_HEADERS);

  for (var i = 0; i < keys.length; i += 1) {
    var name = keys[i];
    var headers = SHEET_HEADERS[name];
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }

  seedUsersIfEmpty();
  seedAreasIfEmpty();
  seedQuestionsIfEmpty();
}

function seedUsersIfEmpty() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.usuarios);
  if (!sheet || sheet.getLastRow() > 1) {
    return;
  }

  sheet.getRange(2, 1, 1, 3).setValues([["SUP-001", "Supervisor Demo", "Supervisor"]]);
}

function seedAreasIfEmpty() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.areas);
  if (!sheet || sheet.getLastRow() > 1) {
    return;
  }

  sheet.getRange(2, 1, 1, 3).setValues([["AR-001", "Envasado Principal", "QR-ENV-001"]]);
}

function seedQuestionsIfEmpty() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.preguntas);
  if (!sheet || sheet.getLastRow() > 1) {
    return;
  }

  var rows = [
    ["P-001", "Seguridad", "Se utilizan EPP completos durante la operacion?", 1, "SI", "NO"],
    ["P-002", "Calidad", "El etiquetado del lote coincide con la orden de produccion?", 2, "SI", "SI"],
    ["P-003", "Operacion", "El area de trabajo se encuentra limpia y ordenada?", 3, "NO", "NO"]
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
