function uploadPhotoToDrive(base64Data, fileName) {
  var raw = String(base64Data || "").trim();
  if (!raw) {
    return "";
  }

  var parsed = parseDataUrl(raw);
  var folder = getOrCreateEvidenceFolder();
  var blob = Utilities.newBlob(parsed.bytes, parsed.mimeType, fileName || ("evidencia-" + Utilities.getUuid() + ".jpg"));
  var file = folder.createFile(blob);
  return file.getUrl();
}

function parseDataUrl(value) {
  var parts = String(value || "").split(",");
  if (parts.length !== 2) {
    throw buildError("Formato de fotografia invalido", "INVALID_PHOTO_FORMAT");
  }

  var header = parts[0];
  var body = parts[1];
  var mimeMatch = header.match(/^data:(.*?);base64$/);
  if (!mimeMatch || !mimeMatch[1]) {
    throw buildError("Tipo de fotografia no valido", "INVALID_PHOTO_FORMAT");
  }

  return {
    mimeType: mimeMatch[1],
    bytes: Utilities.base64Decode(body)
  };
}

function getOrCreateEvidenceFolder() {
  var props = PropertiesService.getScriptProperties();
  var key = "SUPERVISION_EVIDENCE_FOLDER_ID";
  var folderId = props.getProperty(key);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      // Si falla acceso al folder previo, se crea uno nuevo.
    }
  }

  var folder = DriveApp.createFolder("SIPM_Evidencias_Supervision");
  props.setProperty(key, folder.getId());
  return folder;
}
