function loginController(payload) {
  validateLoginPayload(payload);
  return loginService(payload);
}

function verifySessionController(payload) {
  validateTokenPayload(payload);
  return verifySessionService(payload);
}

function logoutController(payload) {
  validateTokenPayload(payload);
  return logoutService(payload);
}

function dashboardStatsController(payload) {
  validateTokenPayload(payload);
  return dashboardStatsService(payload);
}

function qrValidateController(payload) {
  validateQrPayload(payload);
  validateTokenPayload(payload);
  return qrValidateService(payload);
}

function supervisionStartController(payload) {
  validateSupervisionStartPayload(payload);
  return supervisionStartService(payload);
}

function supervisionChecklistController(payload) {
  validateSupervisionChecklistPayload(payload);
  return supervisionChecklistService(payload);
}

function supervisionSaveController(payload) {
  validateSupervisionSavePayload(payload);
  return supervisionSaveService(payload);
}

function historyCatalogController(payload) {
  validateHistoryCatalogPayload(payload);
  return historyCatalogService(payload);
}

function historySearchController(payload) {
  validateHistorySearchPayload(payload);
  return historySearchService(payload);
}

function historyDetailController(payload) {
  validateHistoryDetailPayload(payload);
  return historyDetailService(payload);
}
