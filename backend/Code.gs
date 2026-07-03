function doGet() {
  ensureSheetStructure();
  return jsonOutput(successResponse("API activa", { time: new Date().toISOString() }));
}

function doPost(e) {
  try {
    ensureSheetStructure();

    var request = parseRequest(e);
    var result = routeAction(request.action, request.payload);
    return jsonOutput(successResponse("OK", result));
  } catch (error) {
    return jsonOutput(errorResponse(error.message || "Error interno", error.code || "SERVER_ERROR"));
  }
}
