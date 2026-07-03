function routeAction(action, payload) {
  if (!action) {
    throw buildError("Accion no especificada", "BAD_REQUEST");
  }

  switch (action) {
    case "auth.login":
      return loginController(payload);
    case "auth.session":
      return verifySessionController(payload);
    case "auth.logout":
      return logoutController(payload);
    case "dashboard.stats":
      return dashboardStatsController(payload);
    case "qr.validate":
      return qrValidateController(payload);
    case "supervision.start":
      return supervisionStartController(payload);
    case "supervision.getChecklist":
      return supervisionChecklistController(payload);
    case "supervision.save":
      return supervisionSaveController(payload);
    case "history.search":
      return historySearchController(payload);
    case "history.detail":
      return historyDetailController(payload);
    default:
      throw buildError("Accion no soportada: " + action, "UNSUPPORTED_ACTION");
  }
}
