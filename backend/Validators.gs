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
}

function validateSupervisionSavePayload(payload) {
  validateTokenPayload(payload);

  var areaId = String((payload && payload.areaId) || "").trim();
  if (!areaId) {
    throw buildError("Area requerida para guardar", "BAD_REQUEST");
  }

  var gps = String((payload && payload.gps) || "").trim();
  if (!gps) {
    throw buildError("GPS requerido para guardar", "BAD_REQUEST");
  }

  var startAt = String((payload && payload.startAt) || "").trim();
  if (!startAt) {
    throw buildError("Hora de inicio requerida para guardar", "BAD_REQUEST");
  }

  if (!payload || !Array.isArray(payload.answers) || payload.answers.length === 0) {
    throw buildError("Respuestas requeridas para guardar", "BAD_REQUEST");
  }
}

function validateHistoryCatalogPayload(payload) {
  validateTokenPayload(payload);
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
