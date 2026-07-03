function validateLoginPayload(payload) {
  if (!payload || !payload.userId) {
    throw buildError("Usuario requerido", "BAD_REQUEST");
  }
}

function validateTokenPayload(payload) {
  if (!payload || !payload.token) {
    throw buildError("Token de sesion requerido", "BAD_REQUEST");
  }
}

function validateQrPayload(payload) {
  var qrCode = String((payload && payload.qrCode) || "").trim();
  if (!qrCode) {
    throw buildError("Codigo QR requerido", "BAD_REQUEST");
  }
}

function validateSupervisionStartPayload(payload) {
  validateTokenPayload(payload);
  validateQrPayload(payload);

  var gps = String((payload && payload.gps) || "").trim();
  if (!gps) {
    throw buildError("GPS requerido para iniciar supervision", "BAD_REQUEST");
  }
}

function validateSupervisionChecklistPayload(payload) {
  validateTokenPayload(payload);

  var supervisionId = String((payload && payload.supervisionId) || "").trim();
  if (!supervisionId) {
    throw buildError("ID de supervision requerido", "BAD_REQUEST");
  }
}

function validateSupervisionSavePayload(payload) {
  validateSupervisionChecklistPayload(payload);

  if (!payload || !Array.isArray(payload.answers) || payload.answers.length === 0) {
    throw buildError("Respuestas requeridas para guardar", "BAD_REQUEST");
  }
}

function validateHistorySearchPayload(payload) {
  validateTokenPayload(payload);
}

function validateHistoryDetailPayload(payload) {
  validateTokenPayload(payload);

  var supervisionId = String((payload && payload.supervisionId) || "").trim();
  if (!supervisionId) {
    throw buildError("ID de supervision requerido", "BAD_REQUEST");
  }
}
