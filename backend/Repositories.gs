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

function findAreaById(areaId) {
  var target = String(areaId || "").trim();
  if (!target) {
    return null;
  }

  var rows = getDataRows(SHEET_NAMES.areas);
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    if (id === target) {
      return {
        id: id,
        nombre: String(row[1] || "").trim(),
        qrCode: String(row[2] || "").trim()
      };
    }
  }

  return null;
}

function listAreasOrdered() {
  var areas = [];
  var map = mapAreasById();
  var keys = Object.keys(map);

  for (var i = 0; i < keys.length; i += 1) {
    areas.push(map[keys[i]]);
  }

  areas.sort(function (a, b) {
    return String(a.area || "").localeCompare(String(b.area || ""));
  });

  return areas;
}

function listOperatorsByArea(areaId, includeInactive) {
  var area = findAreaById(areaId);
  if (!area) {
    return [];
  }

  var rows = getDataRows(SHEET_NAMES.operadores);
  var results = [];
  var targetAreaId = String(area.id || "").trim().toUpperCase();
  var targetAreaName = String(area.nombre || "").trim().toUpperCase();
  var allowInactive = Boolean(includeInactive);

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    var name = String(row[1] || "").trim();
    var areaRef = String(row[2] || "").trim();
    var isActive = row[3] === "" ? true : parseSheetBoolean(row[3]);

    if (!id || !name) {
      continue;
    }

    var areaRefKey = areaRef.toUpperCase();
    var belongsToArea = areaRefKey === targetAreaId || areaRefKey === targetAreaName;
    if (!belongsToArea) {
      continue;
    }

    if (!allowInactive && !isActive) {
      continue;
    }

    results.push({
      id: id,
      nombre: name,
      areaId: area.id,
      areaNombre: area.nombre,
      activo: isActive
    });
  }

  results.sort(function (a, b) {
    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });

  return results;
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
    record.gps,
    record.operatorId || "",
    record.operatorName || ""
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
        gps: String(row[7] || "").trim(),
        operatorId: String(row[8] || "").trim(),
        operatorName: String(row[9] || "").trim()
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
    record.areaId,
    record.areaName,
    record.checklistId,
    record.checklistName,
    record.sectionId,
    record.sectionName,
    record.questionId,
    record.category,
    record.questionText,
    record.checklistOrder,
    record.sectionOrder,
    record.questionOrder,
    record.obligatory,
    record.response,
    record.comment,
    record.photoUrl,
    record.operatorId || "",
    record.operatorName || ""
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

function listChecklistDefinitions() {
  var rows = getDataRows(SHEET_NAMES.checklists);
  var items = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    var name = String(row[1] || "").trim();
    if (!id || !name) {
      continue;
    }

    items.push({
      id: id,
      nombre: name,
      descripcion: String(row[2] || "").trim(),
      activo: row[3] === "" ? true : parseSheetBoolean(row[3])
    });
  }

  return items;
}

function listSectionDefinitions() {
  var rows = getDataRows(SHEET_NAMES.secciones);
  var items = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var id = String(row[0] || "").trim();
    var checklistId = String(row[1] || "").trim();
    var name = String(row[2] || "").trim();
    if (!id || !checklistId || !name) {
      continue;
    }

    items.push({
      id: id,
      checklistId: checklistId,
      nombre: name,
      orden: Number(row[3] || 0)
    });
  }

  items.sort(function (a, b) {
    if (a.orden === b.orden) {
      return a.id.localeCompare(b.id);
    }
    return a.orden - b.orden;
  });

  return items;
}

function listChecklistQuestionDefinitions() {
  var rows = getDataRows(SHEET_NAMES.checklistPreguntas);
  var items = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var checklistId = String(row[0] || "").trim();
    var sectionId = String(row[1] || "").trim();
    var questionId = String(row[2] || "").trim();
    if (!checklistId || !sectionId || !questionId) {
      continue;
    }

    items.push({
      checklistId: checklistId,
      sectionId: sectionId,
      questionId: questionId,
      orden: Number(row[3] || 0),
      obligatoria: row[4] === "" ? true : parseSheetBoolean(row[4])
    });
  }

  items.sort(function (a, b) {
    if (a.orden === b.orden) {
      return a.questionId.localeCompare(b.questionId);
    }
    return a.orden - b.orden;
  });

  return items;
}

function listAreaChecklistDefinitions() {
  var rows = getDataRows(SHEET_NAMES.areaChecklist);
  var items = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var areaId = String(row[0] || "").trim();
    var checklistId = String(row[1] || "").trim();
    if (!areaId || !checklistId) {
      continue;
    }

    items.push({
      areaId: areaId,
      checklistId: checklistId,
      orden: Number(row[2] || 0),
      activo: row[3] === "" ? true : parseSheetBoolean(row[3])
    });
  }

  items.sort(function (a, b) {
    if (a.orden === b.orden) {
      return a.checklistId.localeCompare(b.checklistId);
    }
    return a.orden - b.orden;
  });

  return items;
}

function buildEffectiveChecklistForArea(areaId) {
  var area = findAreaById(areaId);
  if (!area) {
    return {
      area: null,
      mode: "legacy",
      questions: [],
      checklists: []
    };
  }

  var questionMap = mapQuestionsById();
  var checklistMap = mapChecklistsById();
  var sectionsByChecklist = mapSectionsByChecklistId();
  var linksByChecklistAndSection = mapChecklistQuestionsByChecklistAndSection();
  var areaLinks = listAreaChecklistDefinitions().filter(function (item) {
    return item.activo && item.areaId === area.id;
  });
  var includedQuestionIds = {};
  var flatQuestions = [];
  var checklists = [];
  var hasStructuredChecklist = false;
  var hasLegacyChecklist = false;
  var hasAreaConfiguration = areaLinks.length > 0;

  for (var i = 0; i < areaLinks.length; i += 1) {
    var areaLink = areaLinks[i];
    var checklist = checklistMap[areaLink.checklistId] || null;
    if (!checklist || !checklist.activo) {
      continue;
    }

    var sections = sectionsByChecklist[checklist.id] || [];
    var renderedSections = [];

    for (var j = 0; j < sections.length; j += 1) {
      var section = sections[j];
      var relationKey = checklist.id + "::" + section.id;
      var questionLinks = linksByChecklistAndSection[relationKey] || [];
      var sectionQuestions = [];

      for (var k = 0; k < questionLinks.length; k += 1) {
        var questionLink = questionLinks[k];
        var question = questionMap[questionLink.questionId] || null;
        if (!question || includedQuestionIds[question.id]) {
          continue;
        }

        includedQuestionIds[question.id] = true;
        var structuredQuestion = buildEffectiveQuestionRecord(area, checklist, section, question, {
          checklistOrder: areaLink.orden,
          sectionOrder: section.orden,
          questionOrder: questionLink.orden,
          obligatory: Boolean(questionLink.obligatoria),
          source: "structured"
        });

        sectionQuestions.push(structuredQuestion);
        flatQuestions.push(structuredQuestion);
      }

      if (sectionQuestions.length > 0) {
        renderedSections.push({
          id: section.id,
          name: section.nombre,
          order: section.orden,
          questions: sectionQuestions
        });
      }
    }

    if (renderedSections.length > 0) {
      hasStructuredChecklist = true;
      checklists.push({
        id: checklist.id,
        name: checklist.nombre,
        description: checklist.descripcion,
        order: areaLink.orden,
        sections: renderedSections
      });
    }
  }

  if (!hasAreaConfiguration) {
    var legacyQuestions = buildLegacyQuestions(area, includedQuestionIds, 0);
    if (legacyQuestions.length > 0) {
      hasLegacyChecklist = true;
      flatQuestions = flatQuestions.concat(legacyQuestions);
      checklists.push(buildLegacyChecklistGroup(legacyQuestions, 0));
    }
  }

  var mode = "legacy";
  if (hasStructuredChecklist && hasLegacyChecklist) {
    mode = "hybrid";
  } else if (hasStructuredChecklist) {
    mode = "structured";
  }

  return {
    area: {
      id: area.id,
      name: area.nombre,
      qrCode: area.qrCode
    },
    mode: mode,
    questions: flatQuestions,
    checklists: checklists
  };
}

function buildLegacyQuestions(area, includedQuestionIds, checklistOrder) {
  var legacyQuestions = [];
  var questions = listQuestionsOrdered();

  for (var i = 0; i < questions.length; i += 1) {
    var question = questions[i];
    if (includedQuestionIds[question.id]) {
      continue;
    }

    includedQuestionIds[question.id] = true;
    legacyQuestions.push(buildEffectiveQuestionRecord(area, null, null, question, {
      checklistOrder: checklistOrder,
      sectionOrder: 0,
      questionOrder: question.orden,
      obligatory: true,
      source: "legacy"
    }));
  }

  return legacyQuestions;
}

function buildLegacyChecklistGroup(questions, checklistOrder) {
  return {
    id: "LEGACY-GENERAL",
    name: "Preguntas generales",
    description: "Banco global en compatibilidad",
    order: checklistOrder,
    sections: [
      {
        id: "LEGACY-SECTION",
        name: "General",
        order: 0,
        questions: questions
      }
    ]
  };
}

function buildEffectiveQuestionRecord(area, checklist, section, question, options) {
  return {
    areaId: area ? area.id : "",
    areaName: area ? area.nombre : "",
    checklistId: checklist ? checklist.id : "LEGACY-GENERAL",
    checklistName: checklist ? checklist.nombre : "Preguntas generales",
    checklistDescription: checklist ? checklist.descripcion : "Banco global en compatibilidad",
    sectionId: section ? section.id : "LEGACY-SECTION",
    sectionName: section ? section.nombre : "General",
    id: question.id,
    category: question.categoria,
    question: question.pregunta,
    order: Number(options && options.questionOrder) || 0,
    checklistOrder: Number(options && options.checklistOrder) || 0,
    sectionOrder: Number(options && options.sectionOrder) || 0,
    requiresComment: Boolean(question.obligaComentario),
    requiresPhoto: Boolean(question.obligaFotografia),
    obligatory: options && options.obligatory === false ? false : true,
    source: String((options && options.source) || "legacy")
  };
}

function mapChecklistsById() {
  var list = listChecklistDefinitions();
  var map = {};
  for (var i = 0; i < list.length; i += 1) {
    map[list[i].id] = list[i];
  }
  return map;
}

function mapSectionsByChecklistId() {
  var list = listSectionDefinitions();
  var map = {};

  for (var i = 0; i < list.length; i += 1) {
    var item = list[i];
    if (!map[item.checklistId]) {
      map[item.checklistId] = [];
    }
    map[item.checklistId].push(item);
  }

  return map;
}

function mapChecklistQuestionsByChecklistAndSection() {
  var list = listChecklistQuestionDefinitions();
  var map = {};

  for (var i = 0; i < list.length; i += 1) {
    var item = list[i];
    var key = item.checklistId + "::" + item.sectionId;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(item);
  }

  return map;
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
      gps: String(row[7] || "").trim(),
      operatorId: String(row[8] || "").trim(),
      operatorName: String(row[9] || "").trim()
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

    results.push(normalizeAnswerRow(row));
  }

  return results;
}

function listAllAnswers() {
  var rows = getDataRows(SHEET_NAMES.respuestas);
  var results = [];

  for (var i = 0; i < rows.length; i += 1) {
    results.push(normalizeAnswerRow(rows[i]));
  }

  return results;
}

function normalizeAnswerRow(row) {
  var supervisionId = String(row[0] || "").trim();
  var hasExpandedShape = String(row[7] || "").trim() || String(row[14] || "").trim() || String(row[15] || "").trim();

  if (!hasExpandedShape) {
    return {
      supervisionId: supervisionId,
      areaId: "",
      areaName: "",
      checklistId: "LEGACY-GENERAL",
      checklistName: "Preguntas generales",
      sectionId: "LEGACY-SECTION",
      sectionName: "General",
      questionId: String(row[1] || "").trim(),
      category: "",
      questionText: "",
      checklistOrder: 0,
      sectionOrder: 0,
      questionOrder: 0,
      obligatory: true,
      response: String(row[2] || "").trim(),
      comment: String(row[3] || "").trim(),
      photoUrl: String(row[4] || "").trim(),
      operatorId: "",
      operatorName: ""
    };
  }

  return {
    supervisionId: supervisionId,
    areaId: String(row[1] || "").trim(),
    areaName: String(row[2] || "").trim(),
    checklistId: String(row[3] || "").trim(),
    checklistName: String(row[4] || "").trim(),
    sectionId: String(row[5] || "").trim(),
    sectionName: String(row[6] || "").trim(),
    questionId: String(row[7] || "").trim(),
    category: String(row[8] || "").trim(),
    questionText: String(row[9] || "").trim(),
    checklistOrder: Number(row[10] || 0),
    sectionOrder: Number(row[11] || 0),
    questionOrder: Number(row[12] || 0),
    obligatory: row[13] === "" ? true : parseSheetBoolean(row[13]),
    response: String(row[14] || "").trim(),
    comment: String(row[15] || "").trim(),
    photoUrl: String(row[16] || "").trim(),
    operatorId: String(row[17] || "").trim(),
    operatorName: String(row[18] || "").trim()
  };
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
