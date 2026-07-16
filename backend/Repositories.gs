function findUserById(userId) {
  var rows = getDataRows(SHEET_NAMES.usuarios);

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim().toUpperCase();
    if (id === userId) {
      return {
        id: id,
        nombre: String(row[1] || "").trim(),
        rol: String(row[2] || "").trim()
      };
    }
  }

  return null;
}

function countTodaySupervisionsByUserId(userId, dateKey) {
  var rows = getDataRows(SHEET_NAMES.supervisiones);
  var total = 0;

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var rawDate = normalizeSheetDateToKey(row[1]);
    var supervisor = String(row[5] || "").trim().toUpperCase();
    var horaFin = String(row[3] || "").trim();
    var duracion = String(row[4] || "").trim();

    if (supervisor === userId && rawDate === dateKey && horaFin && duracion) {
      total += 1;
    }
  }

  return total;
}

function findAreaByQrCode(qrCode) {
  var target = String(qrCode || "").trim();
  var rows = getDataRows(SHEET_NAMES.areas);

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var rowQr = String(row[2] || "").trim();

    if (rowQr === target) {
      return {
        id: String(row[0] || "").trim(),
        nombre: String(row[1] || "").trim(),
        qrCode: rowQr
      };
    }
  }

  return null;
}

function appendSupervisionRow(record) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.supervisiones);
  if (!sheet) {
    throw buildError("Hoja Supervisiones no disponible", "SHEET_NOT_FOUND");
  }

  sheet.appendRow([
    record.id,
    record.fecha,
    record.horaInicio,
    record.horaFin,
    record.duracion,
    record.supervisor,
    record.area,
    record.gps
  ]);
}

function findSupervisionById(supervisionId) {
  var target = String(supervisionId || "").trim();
  var rows = getDataRows(SHEET_NAMES.supervisiones);

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    if (id === target) {
      return {
        id: id,
        fecha: normalizeSheetDateToKey(row[1]),
        horaInicio: String(row[2] || "").trim(),
        horaFin: String(row[3] || "").trim(),
        duracion: String(row[4] || "").trim(),
        supervisor: String(row[5] || "").trim(),
        area: String(row[6] || "").trim(),
        gps: String(row[7] || "").trim()
      };
    }
  }

  return null;
}

function countAnswersBySupervisionId(supervisionId) {
  var target = String(supervisionId || "").trim();
  var rows = getDataRows(SHEET_NAMES.respuestas);
  var total = 0;

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (String(row[0] || "").trim() === target) {
      total += 1;
    }
  }

  return total;
}

function appendAnswerRow(record) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.respuestas);
  if (!sheet) {
    throw buildError("Hoja Respuestas no disponible", "SHEET_NOT_FOUND");
  }

  sheet.appendRow([
    record.supervisionId,
    record.questionId,
    record.response,
    record.comment,
    record.photoUrl
  ]);
}

function updateSupervisionCompletion(record) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.supervisiones);
  if (!sheet) {
    throw buildError("Hoja Supervisiones no disponible", "SHEET_NOT_FOUND");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var currentId = String(values[i][0] || "").trim();
    if (currentId === record.supervisionId) {
      var rowNumber = i + 2;
      sheet.getRange(rowNumber, 4, 1, 2).setValues([[record.horaFin, record.duracion]]);
      return;
    }
  }

  throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
}

function listQuestionsOrdered() {
  var rows = getDataRows(SHEET_NAMES.preguntas);
  var questions = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    var text = String(row[2] || "").trim();

    if (!id || !text) {
      continue;
    }

    questions.push({
      id: id,
      categoria: String(row[1] || "").trim(),
      pregunta: text,
      orden: Number(row[3] || 0),
      obligaComentario: parseSheetBoolean(row[4]),
      obligaFotografia: parseSheetBoolean(row[5])
    });
  }

  questions.sort(function (a, b) {
    if (a.orden === b.orden) {
      return a.id.localeCompare(b.id);
    }
    return a.orden - b.orden;
  });

  return questions;
}

function parseSheetBoolean(value) {
  var normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "si" || normalized === "1" || normalized === "x";
}

function listSupervisionsWithFilters(filters) {
  var rows = getDataRows(SHEET_NAMES.supervisiones);
  var results = [];

  var dateFilter = String((filters && filters.fecha) || "").trim();
  var supervisorFilter = String((filters && filters.supervisorId) || "").trim().toUpperCase();
  var areaFilter = String((filters && filters.areaId) || "").trim().toUpperCase();

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var item = {
      id: String(row[0] || "").trim(),
      fecha: normalizeSheetDateToKey(row[1]),
      horaInicio: String(row[2] || "").trim(),
      horaFin: String(row[3] || "").trim(),
      duracion: String(row[4] || "").trim(),
      supervisorId: String(row[5] || "").trim(),
      areaId: String(row[6] || "").trim(),
      gps: String(row[7] || "").trim()
    };

    if (!isSupervisionCompleted(item)) {
      continue;
    }

    if (dateFilter && item.fecha !== dateFilter) {
      continue;
    }

    if (supervisorFilter && String(item.supervisorId || "").toUpperCase() !== supervisorFilter) {
      continue;
    }

    if (areaFilter && String(item.areaId || "").toUpperCase() !== areaFilter) {
      continue;
    }

    results.push(item);
  }

  results.sort(function (a, b) {
    var aKey = (a.fecha || "") + " " + (a.horaInicio || "");
    var bKey = (b.fecha || "") + " " + (b.horaInicio || "");
    return bKey.localeCompare(aKey);
  });

  return results;
}

function isSupervisionCompleted(item) {
  var horaFin = String((item && item.horaFin) || "").trim();
  var duracion = String((item && item.duracion) || "").trim();
  return Boolean(horaFin && duracion);
}

function listAnswersBySupervisionId(supervisionId) {
  var target = String(supervisionId || "").trim();
  var rows = getDataRows(SHEET_NAMES.respuestas);
  var results = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (String(row[0] || "").trim() !== target) {
      continue;
    }

    results.push({
      supervisionId: String(row[0] || "").trim(),
      questionId: String(row[1] || "").trim(),
      response: String(row[2] || "").trim(),
      comment: String(row[3] || "").trim(),
      photoUrl: String(row[4] || "").trim()
    });
  }

  return results;
}

function mapUsersById() {
  var rows = getDataRows(SHEET_NAMES.usuarios);
  var map = {};
  for (var i = 0; i < rows.length; i += 1) {
    var id = String(rows[i][0] || "").trim();
    if (!id) {
      continue;
    }
    map[id] = {
      id: id,
      nombre: String(rows[i][1] || "").trim(),
      rol: String(rows[i][2] || "").trim()
    };
  }
  return map;
}

function mapAreasById() {
  var rows = getDataRows(SHEET_NAMES.areas);
  var map = {};
  for (var i = 0; i < rows.length; i += 1) {
    var id = String(rows[i][0] || "").trim();
    if (!id) {
      continue;
    }
    map[id] = {
      id: id,
      area: String(rows[i][1] || "").trim(),
      qrCode: String(rows[i][2] || "").trim()
    };
  }
  return map;
}

function mapQuestionsById() {
  var list = listQuestionsOrdered();
  var map = {};
  for (var i = 0; i < list.length; i += 1) {
    var item = list[i];
    map[item.id] = item;
  }
  return map;
}

function normalizeSheetDateToKey(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  var raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  var mx = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mx) {
    var day = Number(mx[1]);
    var month = Number(mx[2]);
    var year = Number(mx[3]);
    var parsedMx = new Date(year, month - 1, day);
    if (!isNaN(parsedMx.getTime())) {
      return Utilities.formatDate(parsedMx, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  }

  var generic = new Date(raw);
  if (!isNaN(generic.getTime())) {
    return Utilities.formatDate(generic, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return raw;
}

function getDataRows(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol === 0) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}
