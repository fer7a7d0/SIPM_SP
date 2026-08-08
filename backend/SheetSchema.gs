var SHEET_NAMES = {
  usuarios: "Usuarios",
  operadores: "Operadores",
  areas: "Areas",
  preguntas: "Preguntas",
  checklists: "Checklists",
  secciones: "Secciones",
  checklistPreguntas: "ChecklistPreguntas",
  areaChecklist: "AreaChecklist",
  supervisiones: "Supervisiones",
  respuestas: "Respuestas"
};

var SHEET_HEADERS = {
  Usuarios: ["ID", "Nombre", "Rol"],
  Operadores: ["ID", "Nombre", "Area", "Activo"],
  Areas: ["ID", "Area", "Codigo QR"],
  Preguntas: ["ID", "Categoria", "Pregunta", "Orden", "Obliga comentario", "Obliga fotografia"],
  Checklists: ["ID", "Nombre", "Descripcion", "Activo"],
  Secciones: ["ID", "ID Checklist", "Nombre", "Orden"],
  ChecklistPreguntas: ["ID Checklist", "ID Seccion", "ID Pregunta", "Orden", "Obligatoria"],
  AreaChecklist: ["ID Area", "ID Checklist", "Orden", "Activo"],
  Supervisiones: ["ID", "Fecha", "Hora inicio", "Hora fin", "Duracion", "Supervisor", "Operador ID", "Operador Nombre", "Area", "GPS"],
  Respuestas: [
    "ID Supervision",
    "Operador ID",
    "Operador Nombre",
    "ID Area",
    "Area",
    "ID Checklist",
    "Checklist",
    "ID Seccion",
    "Seccion",
    "ID Pregunta",
    "Categoria",
    "Pregunta",
    "Orden checklist",
    "Orden seccion",
    "Orden pregunta",
    "Obligatoria",
    "Respuesta",
    "Comentario",
    "URL Fotografia"
  ]
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
      continue;
    }

    syncSheetHeaders(sheet, headers);
  }

  seedUsersIfEmpty();
  seedAreasIfEmpty();
  seedQuestionsIfEmpty();
}

function syncSheetHeaders(sheet, headers) {
  var width = headers.length;
  var existingWidth = Math.max(sheet.getLastColumn(), width);
  var currentHeaders = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
  var nextHeaders = [];

  for (var i = 0; i < headers.length; i += 1) {
    nextHeaders.push(headers[i]);
  }

  if (existingWidth > headers.length) {
    for (var j = headers.length; j < existingWidth; j += 1) {
      nextHeaders.push(currentHeaders[j] || "");
    }
  }

  sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
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
