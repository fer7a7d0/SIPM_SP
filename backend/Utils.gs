function parseRequest(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw buildError("Request vacio", "BAD_REQUEST");
  }

  var parsed = JSON.parse(e.postData.contents);
  return {
    action: parsed.action,
    payload: parsed.payload || {}
  };
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function successResponse(message, data) {
  return {
    success: true,
    message: message,
    data: data || {}
  };
}

function errorResponse(message, code) {
  return {
    success: false,
    message: message,
    code: code || "ERROR"
  };
}

function buildError(message, code) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function toDateKey(dateObj) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(dateObj, tz, "yyyy-MM-dd");
}
