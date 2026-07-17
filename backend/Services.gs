function loginService(payload) {
  var userId = String(payload.userId || "").trim().toUpperCase();
  var user = findUserById(userId);

  if (!user) {
    throw buildError("Usuario no encontrado", "AUTH_INVALID_USER");
  }

  var sessionData = {
    userId: user.id,
    userName: user.nombre,
    role: user.rol,
    loginAt: new Date().toISOString()
  };

  var token = createSessionToken(sessionData);

  return {
    session: {
      token: token,
      userId: sessionData.userId,
      userName: sessionData.userName,
      role: sessionData.role,
      loginAt: sessionData.loginAt
    }
  };
}

function verifySessionService(payload) {
  var session = decodeAndVerifyToken(payload.token);

  return {
    session: {
      token: payload.token,
      userId: session.userId,
      userName: session.userName,
      role: session.role,
      loginAt: session.loginAt
    }
  };
}

function logoutService(payload) {
  decodeAndVerifyToken(payload.token);
  return { loggedOut: true };
}

function dashboardStatsService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var todayKey = toDateKey(new Date());
  var total = countTodaySupervisionsByUserId(session.userId, todayKey);

  return {
    todayDate: todayKey,
    todaySupervisions: total
  };
}

function dashboardKpiSummaryService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var todayKey = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var weekStartKey = Utilities.formatDate(shiftDateDays(now, -6), tz, "yyyy-MM-dd");
  var monthStartKey = Utilities.formatDate(shiftDateDays(now, -29), tz, "yyyy-MM-dd");

  var windowDays = Number((payload && payload.windowDays) || 30);
  if (!isFinite(windowDays) || windowDays < 7 || windowDays > 90) {
    windowDays = 30;
  }
  var windowStartKey = Utilities.formatDate(shiftDateDays(now, -(windowDays - 1)), tz, "yyyy-MM-dd");

  var usersMap = mapUsersById();
  var areasMap = mapAreasById();
  var supervisions = listSupervisionsWithFilters({});
  var isSupervisor = String(session.role || "").toLowerCase() === "supervisor";

  if (isSupervisor) {
    supervisions = supervisions.filter(function (item) {
      return String(item.supervisorId || "").toUpperCase() === String(session.userId || "").toUpperCase();
    });
  }

  supervisions = supervisions.filter(function (item) {
    return compareDateKeys(item.fecha, windowStartKey) >= 0 && compareDateKeys(item.fecha, todayKey) <= 0;
  });

  var answersBySupervision = buildAnswerAggregatesBySupervision(listAllAnswers());
  var enriched = supervisions.map(function (item) {
    var agg = answersBySupervision[item.id] || emptyAnswerAggregate();
    return {
      id: item.id,
      fecha: item.fecha,
      supervisorId: item.supervisorId,
      supervisorName: usersMap[item.supervisorId] ? usersMap[item.supervisorId].nombre : item.supervisorId,
      areaId: item.areaId,
      areaName: areasMap[item.areaId] ? areasMap[item.areaId].area : item.areaId,
      duracionMin: parseDurationToMinutes(item.duracion),
      cumple: agg.cumple,
      noCumple: agg.noCumple,
      noAplica: agg.noAplica,
      evaluables: agg.cumple + agg.noCumple,
      hallazgos: agg.noCumple,
      photos: agg.photos
    };
  });

  var monthSlice = filterByDateRange(enriched, monthStartKey, todayKey);

  return {
    generatedAt: now.toISOString(),
    timezone: tz,
    periods: {
      day: buildPeriodMetrics(filterByDateRange(enriched, todayKey, todayKey), todayKey, todayKey),
      week: buildPeriodMetrics(filterByDateRange(enriched, weekStartKey, todayKey), weekStartKey, todayKey),
      month: buildPeriodMetrics(monthSlice, monthStartKey, todayKey)
    },
    bySupervisor: buildSupervisorMetrics(enriched),
    findingsTrend: buildFindingsTrend(enriched, weekStartKey, todayKey),
    areaRanking: buildAreaRanking(monthSlice),
    timeMetrics: buildTimeMetrics(monthSlice)
  };
}

function shiftDateDays(dateObj, days) {
  var base = new Date(dateObj.getTime());
  base.setDate(base.getDate() + Number(days || 0));
  return base;
}

function compareDateKeys(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function parseDurationToMinutes(value) {
  var raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }

  var match = raw.match(/(\d+)/);
  if (!match) {
    return 0;
  }

  var minutes = Number(match[1]);
  if (!isFinite(minutes) || minutes < 0) {
    return 0;
  }

  return minutes;
}

function emptyAnswerAggregate() {
  return {
    cumple: 0,
    noCumple: 0,
    noAplica: 0,
    photos: 0
  };
}

function buildAnswerAggregatesBySupervision(answers) {
  var map = {};

  for (var i = 0; i < answers.length; i += 1) {
    var item = answers[i];
    var id = String(item.supervisionId || "").trim();
    if (!id) {
      continue;
    }

    if (!map[id]) {
      map[id] = emptyAnswerAggregate();
    }

    var response = String(item.response || "").trim().toLowerCase();
    if (response === "cumple") {
      map[id].cumple += 1;
    } else if (response === "no cumple") {
      map[id].noCumple += 1;
    } else if (response === "no aplica") {
      map[id].noAplica += 1;
    }

    if (String(item.photoUrl || "").trim()) {
      map[id].photos += 1;
    }
  }

  return map;
}

function filterByDateRange(list, startKey, endKey) {
  return list.filter(function (item) {
    return compareDateKeys(item.fecha, startKey) >= 0 && compareDateKeys(item.fecha, endKey) <= 0;
  });
}

function toPercent(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return round1((Number(numerator || 0) / Number(denominator)) * 100);
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function average(values) {
  if (!values || values.length === 0) {
    return null;
  }
  var total = 0;
  for (var i = 0; i < values.length; i += 1) {
    total += Number(values[i] || 0);
  }
  return round1(total / values.length);
}

function percentile(values, p) {
  if (!values || values.length === 0) {
    return null;
  }

  var sorted = values.slice().sort(function (a, b) {
    return a - b;
  });
  var rank = Math.ceil((Number(p || 0) / 100) * sorted.length) - 1;
  var idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return round1(sorted[idx]);
}

function buildPeriodMetrics(items, startKey, endKey) {
  var evaluables = 0;
  var cumple = 0;
  var hallazgos = 0;
  var withHallazgos = 0;
  var durations = [];

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    evaluables += Number(item.evaluables || 0);
    cumple += Number(item.cumple || 0);
    hallazgos += Number(item.hallazgos || 0);
    if (Number(item.hallazgos || 0) > 0) {
      withHallazgos += 1;
    }
    if (Number(item.duracionMin || 0) > 0) {
      durations.push(Number(item.duracionMin));
    }
  }

  return {
    start: startKey,
    end: endKey,
    supervisionesFinalizadas: items.length,
    hallazgosTotales: hallazgos,
    cumplimientoPct: toPercent(cumple, evaluables),
    supervisionesConHallazgosPct: toPercent(withHallazgos, items.length),
    duracionPromedioMin: average(durations)
  };
}

function buildSupervisorMetrics(items) {
  var bySupervisor = {};

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (!bySupervisor[item.supervisorId]) {
      bySupervisor[item.supervisorId] = [];
    }
    bySupervisor[item.supervisorId].push(item);
  }

  var keys = Object.keys(bySupervisor);
  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var weekStartKey = Utilities.formatDate(shiftDateDays(now, -6), tz, "yyyy-MM-dd");
  var monthStartKey = Utilities.formatDate(shiftDateDays(now, -29), tz, "yyyy-MM-dd");

  var rows = keys.map(function (supervisorId) {
    var list = bySupervisor[supervisorId];
    return {
      supervisorId: supervisorId,
      supervisorName: list[0].supervisorName,
      day: buildPeriodMetrics(filterByDateRange(list, todayKey, todayKey), todayKey, todayKey),
      week: buildPeriodMetrics(filterByDateRange(list, weekStartKey, todayKey), weekStartKey, todayKey),
      month: buildPeriodMetrics(filterByDateRange(list, monthStartKey, todayKey), monthStartKey, todayKey)
    };
  });

  rows.sort(function (a, b) {
    return String(a.supervisorName || "").localeCompare(String(b.supervisorName || ""));
  });

  return rows;
}

function buildFindingsTrend(items, startKey, endKey) {
  var dates = [];
  var cursor = new Date(startKey + "T00:00:00");
  var endDate = new Date(endKey + "T00:00:00");
  var tz = Session.getScriptTimeZone();

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(Utilities.formatDate(cursor, tz, "yyyy-MM-dd"));
    cursor = shiftDateDays(cursor, 1);
  }

  var map = {};
  for (var i = 0; i < dates.length; i += 1) {
    map[dates[i]] = { hallazgos: 0, supervisiones: 0 };
  }

  for (var j = 0; j < items.length; j += 1) {
    var item = items[j];
    if (!map[item.fecha]) {
      continue;
    }
    map[item.fecha].hallazgos += Number(item.hallazgos || 0);
    map[item.fecha].supervisiones += 1;
  }

  return dates.map(function (dateKey) {
    return {
      date: dateKey,
      hallazgos: map[dateKey].hallazgos,
      supervisiones: map[dateKey].supervisiones
    };
  });
}

function buildAreaRanking(items) {
  var byArea = {};

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (!byArea[item.areaId]) {
      byArea[item.areaId] = {
        areaId: item.areaId,
        areaName: item.areaName,
        hallazgos: 0,
        cumple: 0,
        evaluables: 0,
        supervisiones: 0,
        durations: []
      };
    }

    byArea[item.areaId].hallazgos += Number(item.hallazgos || 0);
    byArea[item.areaId].cumple += Number(item.cumple || 0);
    byArea[item.areaId].evaluables += Number(item.evaluables || 0);
    byArea[item.areaId].supervisiones += 1;
    if (Number(item.duracionMin || 0) > 0) {
      byArea[item.areaId].durations.push(Number(item.duracionMin));
    }
  }

  var rows = Object.keys(byArea).map(function (key) {
    var row = byArea[key];
    return {
      areaId: row.areaId,
      areaName: row.areaName,
      hallazgos: row.hallazgos,
      cumplimientoPct: toPercent(row.cumple, row.evaluables),
      supervisiones: row.supervisiones,
      duracionPromedioMin: average(row.durations)
    };
  });

  rows.sort(function (a, b) {
    if (b.hallazgos !== a.hallazgos) {
      return b.hallazgos - a.hallazgos;
    }
    return String(a.areaName || "").localeCompare(String(b.areaName || ""));
  });

  return rows.slice(0, 10);
}

function buildTimeMetrics(items) {
  var durations = [];
  var bySupervisor = {};

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (Number(item.duracionMin || 0) <= 0) {
      continue;
    }

    var duration = Number(item.duracionMin);
    durations.push(duration);

    if (!bySupervisor[item.supervisorId]) {
      bySupervisor[item.supervisorId] = {
        supervisorId: item.supervisorId,
        supervisorName: item.supervisorName,
        durations: []
      };
    }

    bySupervisor[item.supervisorId].durations.push(duration);
  }

  var bySupervisorRows = Object.keys(bySupervisor).map(function (key) {
    var row = bySupervisor[key];
    return {
      supervisorId: row.supervisorId,
      supervisorName: row.supervisorName,
      duracionPromedioMin: average(row.durations),
      duracionP90Min: percentile(row.durations, 90)
    };
  });

  bySupervisorRows.sort(function (a, b) {
    return String(a.supervisorName || "").localeCompare(String(b.supervisorName || ""));
  });

  return {
    global: {
      duracionPromedioMin: average(durations),
      duracionP90Min: percentile(durations, 90)
    },
    bySupervisor: bySupervisorRows
  };
}

function qrValidateService(payload) {
  decodeAndVerifyToken(payload.token);

  var area = findAreaByQrCode(payload.qrCode);
  if (!area) {
    throw buildError("Codigo QR no registrado", "QR_NOT_FOUND");
  }

  return {
    area: {
      id: area.id,
      name: area.nombre,
      qrCode: area.qrCode
    }
  };
}

function supervisionStartService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var area = findAreaByQrCode(payload.qrCode);
  if (!area) {
    throw buildError("Codigo QR no registrado", "QR_NOT_FOUND");
  }

  var now = new Date();

  return {
    supervision: {
      areaId: area.id,
      areaName: area.nombre,
      qrCode: area.qrCode,
      supervisorId: session.userId,
      gps: String(payload.gps || "").trim(),
      startAt: now.toISOString()
    }
  };
}

function supervisionChecklistService(payload) {
  decodeAndVerifyToken(payload.token);

  var rawQuestions = listQuestionsOrdered();
  var questions = rawQuestions.map(function (item) {
    return {
      id: item.id,
      category: item.categoria,
      question: item.pregunta,
      order: item.orden,
      requiresComment: item.obligaComentario,
      requiresPhoto: item.obligaFotografia
    };
  });

  return {
    questions: questions
  };
}

function supervisionSaveService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var areasMap = mapAreasById();
  var areaId = String(payload.areaId || "").trim();
  var area = areasMap[areaId] || null;
  if (!area) {
    throw buildError("Area no valida para guardar supervision", "AREA_NOT_FOUND");
  }

  var endDate = new Date();
  var startDate = new Date(String(payload.startAt || "").trim());
  if (isNaN(startDate.getTime())) {
    startDate = new Date(endDate.getTime());
  }

  var completion = buildCompletionDataFromDates(startDate, endDate);
  var supervisionId = "SUPV-" + Utilities.formatDate(endDate, Session.getScriptTimeZone(), "yyyyMMddHHmmss") + "-" + String(Math.floor(Math.random() * 900) + 100);

  appendSupervisionRow({
    id: supervisionId,
    fecha: completion.fecha,
    horaInicio: completion.horaInicio,
    horaFin: completion.horaFin,
    duracion: completion.duracion,
    supervisor: session.userId,
    area: areaId,
    gps: String(payload.gps || "").trim()
  });

  var rawQuestions = listQuestionsOrdered();
  var answersById = {};
  var answers = payload.answers || [];
  for (var j = 0; j < answers.length; j += 1) {
    var answer = answers[j] || {};
    var qId = String(answer.questionId || "").trim();
    if (qId) {
      answersById[qId] = answer;
    }
  }

  for (var k = 0; k < rawQuestions.length; k += 1) {
    var question = rawQuestions[k];
    var currentAnswer = answersById[question.id];
    if (!currentAnswer) {
      throw buildError("Faltan respuestas del checklist", "CHECKLIST_INCOMPLETE");
    }

    var response = String(currentAnswer.response || "").trim();
    var comment = String(currentAnswer.comment || "").trim();
    var photoDataUrl = String(currentAnswer.photoDataUrl || "").trim();

    if (response !== "Cumple" && response !== "No cumple" && response !== "No aplica") {
      throw buildError("Respuesta no valida para la pregunta " + question.id, "CHECKLIST_INVALID_RESPONSE");
    }

    if (question.obligaComentario && !comment) {
      throw buildError("La pregunta " + question.id + " requiere comentario", "CHECKLIST_REQUIRED_COMMENT");
    }

    if (question.obligaFotografia && !photoDataUrl) {
      throw buildError("La pregunta " + question.id + " requiere fotografia", "CHECKLIST_REQUIRED_PHOTO");
    }
  }

  var photosStored = 0;
  for (var m = 0; m < rawQuestions.length; m += 1) {
    var q = rawQuestions[m];
    var a = answersById[q.id];
    var photoUrl = "";
    var answerPhotoDataUrl = String(a.photoDataUrl || "").trim();

    if (answerPhotoDataUrl) {
      photoUrl = uploadPhotoToDrive(answerPhotoDataUrl, buildEvidenceFileName(supervisionId, q.id));
      photosStored += 1;
    }

    appendAnswerRow({
      supervisionId: supervisionId,
      questionId: q.id,
      response: String(a.response || "").trim(),
      comment: String(a.comment || "").trim(),
      photoUrl: photoUrl
    });
  }

  return {
    saved: true,
    supervisionId: supervisionId,
    answeredCount: rawQuestions.length,
    photosStored: photosStored,
    fecha: completion.fecha,
    horaInicio: completion.horaInicio,
    horaFin: completion.horaFin,
    duracion: completion.duracion
  };
}

function buildCompletionDataFromDates(startDate, endDate) {
  var safeStart = startDate;
  var safeEnd = endDate;

  if (Object.prototype.toString.call(safeStart) !== "[object Date]" || isNaN(safeStart.getTime())) {
    safeStart = new Date();
  }
  if (Object.prototype.toString.call(safeEnd) !== "[object Date]" || isNaN(safeEnd.getTime())) {
    safeEnd = new Date();
  }

  var tz = Session.getScriptTimeZone();
  var minutes = 0;

  minutes = Math.max(0, Math.round((safeEnd.getTime() - safeStart.getTime()) / 60000));

  return {
    fecha: Utilities.formatDate(safeStart, tz, "yyyy-MM-dd"),
    horaInicio: Utilities.formatDate(safeStart, tz, "HH:mm:ss"),
    horaFin: Utilities.formatDate(safeEnd, tz, "HH:mm:ss"),
    duracion: String(minutes) + " min"
  };
}

function buildEvidenceFileName(supervisionId, questionId) {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  return supervisionId + "-" + questionId + "-" + stamp + ".jpg";
}

function historyCatalogService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  return buildHistoryCatalog(session);
}

function historySearchService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var filters = payload.filters || {};
  var isSupervisor = String(session.role || "").toLowerCase() === "supervisor";

  if (isSupervisor) {
    filters.supervisorId = session.userId;
  }

  var usersMap = mapUsersById();
  var areasMap = mapAreasById();
  var items = listSupervisionsWithFilters(filters).map(function (item) {
    var user = usersMap[item.supervisorId] || null;
    var area = areasMap[item.areaId] || null;
    return {
      id: item.id,
      fecha: item.fecha,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
      duracion: item.duracion,
      supervisorId: item.supervisorId,
      supervisorName: user ? user.nombre : item.supervisorId,
      areaId: item.areaId,
      areaName: area ? area.area : item.areaId,
      gps: item.gps
    };
  });

  var catalogData = buildHistoryCatalog(session, usersMap, areasMap);

  return {
    filtersApplied: {
      fecha: String(filters.fecha || ""),
      supervisorId: String(filters.supervisorId || ""),
      areaId: String(filters.areaId || "")
    },
    catalog: catalogData.catalog,
    permissions: catalogData.permissions,
    items: items
  };
}

function buildHistoryCatalog(session, usersMapArg, areasMapArg) {
  var isSupervisor = String((session && session.role) || "").toLowerCase() === "supervisor";
  var usersMap = usersMapArg || mapUsersById();
  var areasMap = areasMapArg || mapAreasById();

  var supervisorOptions = Object.keys(usersMap).map(function (key) {
    return { id: key, name: usersMap[key].nombre };
  });

  if (isSupervisor) {
    supervisorOptions = supervisorOptions.filter(function (item) {
      return String(item.id || "").toUpperCase() === String((session && session.userId) || "").toUpperCase();
    });
  }

  var areaOptions = Object.keys(areasMap).map(function (key) {
    return { id: key, name: areasMap[key].area };
  });

  return {
    catalog: {
      supervisors: supervisorOptions,
      areas: areaOptions
    },
    permissions: {
      onlyOwnHistory: isSupervisor
    }
  };
}

function historyDetailService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var supervision = findSupervisionById(payload.supervisionId);
  if (!supervision) {
    throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
  }

  if (!String(supervision.horaFin || "").trim() || !String(supervision.duracion || "").trim()) {
    throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
  }

  if (String(session.role || "").toLowerCase() === "supervisor") {
    if (String(supervision.supervisor || "").toUpperCase() !== String(session.userId || "").toUpperCase()) {
      throw buildError("No tienes permiso para ver esta supervision", "AUTH_FORBIDDEN");
    }
  }

  var usersMap = mapUsersById();
  var areasMap = mapAreasById();
  var questionsMap = mapQuestionsById();
  var answers = listAnswersBySupervisionId(supervision.id).map(function (item) {
    var question = questionsMap[item.questionId] || null;
    return {
      questionId: item.questionId,
      category: question ? question.categoria : "",
      question: question ? question.pregunta : item.questionId,
      response: item.response,
      comment: item.comment,
      photoUrl: item.photoUrl
    };
  });

  return {
    supervision: {
      id: supervision.id,
      fecha: supervision.fecha,
      horaInicio: supervision.horaInicio,
      horaFin: supervision.horaFin,
      duracion: supervision.duracion,
      supervisorId: supervision.supervisor,
      supervisorName: usersMap[supervision.supervisor] ? usersMap[supervision.supervisor].nombre : supervision.supervisor,
      areaId: supervision.area,
      areaName: areasMap[supervision.area] ? areasMap[supervision.area].area : supervision.area,
      gps: supervision.gps
    },
    answers: answers
  };
}

function createSessionToken(sessionData) {
  var now = Date.now();
  var payload = {
    userId: sessionData.userId,
    userName: sessionData.userName,
    role: sessionData.role,
    loginAt: sessionData.loginAt,
    iat: now,
    exp: now + 12 * 60 * 60 * 1000
  };

  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sigStr = signPayload(payloadStr);
  return payloadStr + "." + sigStr;
}

function decodeAndVerifyToken(token) {
  var raw = String(token || "").trim();
  var parts = raw.split(".");
  if (parts.length !== 2) {
    throw buildError("Sesion invalida", "AUTH_INVALID_SESSION");
  }

  var payloadStr = parts[0];
  var signature = parts[1];
  var expectedSignature = signPayload(payloadStr);

  if (signature !== expectedSignature) {
    throw buildError("Sesion invalida", "AUTH_INVALID_SESSION");
  }

  var decodedPayload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString());

  if (!decodedPayload.exp || Date.now() > decodedPayload.exp) {
    throw buildError("Sesion expirada", "AUTH_EXPIRED_SESSION");
  }

  var user = findUserById(decodedPayload.userId);
  if (!user) {
    throw buildError("Usuario de sesion no valido", "AUTH_INVALID_USER");
  }

  return decodedPayload;
}

function signPayload(payloadStr) {
  var secret = getOrCreateAppSecret();
  var bytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  return Utilities.base64EncodeWebSafe(bytes);
}

function getOrCreateAppSecret() {
  var props = PropertiesService.getScriptProperties();
  var key = "APP_SIGNING_SECRET";
  var current = props.getProperty(key);

  if (current) {
    return current;
  }

  var generated = Utilities.getUuid() + "-" + Utilities.getUuid();
  props.setProperty(key, generated);
  return generated;
}
