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
  var supervisionId = "SUPV-" + Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss") + "-" + String(Math.floor(Math.random() * 900) + 100);
  var dateKey = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var timeKey = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");

  appendSupervisionRow({
    id: supervisionId,
    fecha: dateKey,
    horaInicio: timeKey,
    horaFin: "",
    duracion: "",
    supervisor: session.userId,
    area: area.id,
    gps: String(payload.gps || "").trim()
  });

  return {
    supervision: {
      id: supervisionId,
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
  var session = decodeAndVerifyToken(payload.token);
  var supervision = findSupervisionById(payload.supervisionId);

  if (!supervision) {
    throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
  }

  if (String(supervision.supervisor || "").toUpperCase() !== String(session.userId || "").toUpperCase()) {
    throw buildError("No tienes permiso para esta supervision", "AUTH_FORBIDDEN");
  }

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
    supervision: {
      id: supervision.id,
      areaId: supervision.area,
      gps: supervision.gps,
      fecha: supervision.fecha,
      horaInicio: supervision.horaInicio
    },
    questions: questions
  };
}

function supervisionSaveService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var supervision = findSupervisionById(payload.supervisionId);

  if (!supervision) {
    throw buildError("Supervision no encontrada", "SUPERVISION_NOT_FOUND");
  }

  if (String(supervision.supervisor || "").toUpperCase() !== String(session.userId || "").toUpperCase()) {
    throw buildError("No tienes permiso para esta supervision", "AUTH_FORBIDDEN");
  }

  if (String(supervision.horaFin || "").trim()) {
    throw buildError("La supervision ya fue cerrada", "SUPERVISION_ALREADY_CLOSED");
  }

  if (countAnswersBySupervisionId(supervision.id) > 0) {
    throw buildError("La supervision ya tiene respuestas guardadas", "SUPERVISION_ALREADY_SAVED");
  }

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
      photoUrl = uploadPhotoToDrive(answerPhotoDataUrl, buildEvidenceFileName(supervision.id, q.id));
      photosStored += 1;
    }

    appendAnswerRow({
      supervisionId: supervision.id,
      questionId: q.id,
      response: String(a.response || "").trim(),
      comment: String(a.comment || "").trim(),
      photoUrl: photoUrl
    });
  }

  var completion = buildCompletionData(supervision.fecha, supervision.horaInicio);
  updateSupervisionCompletion({
    supervisionId: supervision.id,
    horaFin: completion.horaFin,
    duracion: completion.duracion
  });

  return {
    saved: true,
    supervisionId: supervision.id,
    answeredCount: rawQuestions.length,
    photosStored: photosStored,
    horaFin: completion.horaFin,
    duracion: completion.duracion
  };
}

function buildCompletionData(fecha, horaInicio) {
  var endDate = new Date();
  var startDate = new Date(String(fecha || "") + "T" + String(horaInicio || "00:00:00"));
  var minutes = 0;

  if (!isNaN(startDate.getTime())) {
    minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  }

  return {
    horaFin: Utilities.formatDate(endDate, Session.getScriptTimeZone(), "HH:mm:ss"),
    duracion: String(minutes) + " min"
  };
}

function buildEvidenceFileName(supervisionId, questionId) {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  return supervisionId + "-" + questionId + "-" + stamp + ".jpg";
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

  var supervisorOptions = Object.keys(usersMap).map(function (key) {
    return { id: key, name: usersMap[key].nombre };
  });

  if (isSupervisor) {
    supervisorOptions = supervisorOptions.filter(function (item) {
      return String(item.id || "").toUpperCase() === String(session.userId || "").toUpperCase();
    });
  }

  var areaOptions = Object.keys(areasMap).map(function (key) {
    return { id: key, name: areasMap[key].area };
  });

  return {
    filtersApplied: {
      fecha: String(filters.fecha || ""),
      supervisorId: String(filters.supervisorId || ""),
      areaId: String(filters.areaId || "")
    },
    catalog: {
      supervisors: supervisorOptions,
      areas: areaOptions
    },
    permissions: {
      onlyOwnHistory: isSupervisor
    },
    items: items
  };
}

function historyDetailService(payload) {
  var session = decodeAndVerifyToken(payload.token);
  var supervision = findSupervisionById(payload.supervisionId);
  if (!supervision) {
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
