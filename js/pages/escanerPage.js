import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { validateQrCode } from "../services/qrService.js";
import { startSupervision } from "../services/supervisionService.js";
import { formatGps, getCurrentPosition } from "../utils/geo.js";

const qrInput = document.getElementById("qrInput");
const validateQrBtn = document.getElementById("validateQrBtn");
const gpsStatus = document.getElementById("gpsStatus");
const scannerMessage = document.getElementById("scannerMessage");
const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const qrReader = document.getElementById("qrReader");
const gpsCard = gpsStatus.closest(".card");

let activeSession = null;
let gpsPosition = null;
let qrScanner = null;
let cameraActive = false;
let isSupervisorMode = false;
let isSubmitting = false;
let manualInputTimer = null;
let lastProcessedQr = "";

init();

async function init() {
  const localSession = getSession();
  if (!localSession) {
    window.location.replace(ROUTES.login);
    return;
  }

  activeSession = localSession;
  isSupervisorMode = String(activeSession.role || "").trim().toLowerCase() === "supervisor";

  setupQrMode();
  setQrControlsEnabled(false);
  validateQrBtn.hidden = true;

  validateQrBtn.addEventListener("click", () => {
    processQrCode(String(qrInput.value || ""));
  });
  startCameraBtn.addEventListener("click", startCamera);
  stopCameraBtn.addEventListener("click", stopCamera);
  qrInput.addEventListener("input", () => {
    if (isSupervisorMode || !gpsPosition) {
      return;
    }

    if (manualInputTimer) {
      window.clearTimeout(manualInputTimer);
    }

    manualInputTimer = window.setTimeout(() => {
      processQrCode(String(qrInput.value || ""));
    }, 700);
  });
  qrInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      processQrCode(String(qrInput.value || ""));
    }
  });

  await captureGps();
  window.addEventListener("beforeunload", () => {
    stopCamera();
  });
}

function setupQrMode() {
  qrInput.readOnly = isSupervisorMode;
  if (isSupervisorMode) {
    qrInput.placeholder = "Lectura por camara habilitada para supervisor";
  } else {
    qrInput.placeholder = "Escanea o pega el codigo";
  }
}

function setQrControlsEnabled(enabled) {
  startCameraBtn.disabled = !enabled;
  if (!enabled || isSupervisorMode) {
    qrInput.disabled = true;
    return;
  }
  qrInput.disabled = false;
}

async function captureGps() {
  try {
    gpsStatus.textContent = "Obteniendo ubicacion...";
    gpsPosition = await getCurrentPosition();
    gpsStatus.textContent = `GPS activo: ${formatGps(gpsPosition)} (±${Math.round(gpsPosition.accuracy)}m)`;
    setQrControlsEnabled(true);
  } catch (error) {
    gpsPosition = null;
    setQrControlsEnabled(false);
    gpsStatus.textContent = "No disponible";
    setMessage(error.message, "error");
  }
}

async function processQrCode(rawValue) {
  const qrCode = String(rawValue || "").trim();
  if (!qrCode) {
    if (!isSupervisorMode) {
      setMessage("Escanea o ingresa un codigo QR valido.", "error");
    }
    return;
  }

  if (isSubmitting) {
    return;
  }

  if (lastProcessedQr === qrCode) {
    return;
  }

  if (!gpsPosition) {
    setMessage("La ubicacion GPS es obligatoria para iniciar supervision.", "error");
    await captureGps();
    if (!gpsPosition) {
      return;
    }
  }

  await onValidateAndStart(qrCode);
}

async function onValidateAndStart(qrCode) {
  if (!qrCode) {
    return;
  }

  try {
    isSubmitting = true;
    lastProcessedQr = qrCode;
    validateQrBtn.disabled = true;
    setMessage("Validando area...", "");

    const area = await validateQrCode(activeSession.token, qrCode);

    qrInput.value = qrCode;
    setValidationState(true);

    setMessage("Iniciando supervision...", "");
    await startSupervision({
      token: activeSession.token,
      qrCode,
      areaId: area.area.id,
      gps: formatGps(gpsPosition)
    });

    await stopCamera();
    window.location.replace(ROUTES.supervision);
  } catch (error) {
    lastProcessedQr = "";
    setValidationState(false);
    setMessage(error.message || "No se pudo iniciar supervision.", "error");
  } finally {
    isSubmitting = false;
    validateQrBtn.disabled = false;
  }
}

async function startCamera() {
  if (cameraActive) {
    return;
  }

  if (!gpsPosition) {
    setMessage("La ubicacion GPS es obligatoria para leer el codigo QR.", "error");
    await captureGps();
    if (!gpsPosition) {
      return;
    }
  }

  if (!window.Html5Qrcode) {
    setMessage("Lector QR no disponible en este navegador.", "error");
    return;
  }

  try {
    qrScanner = new window.Html5Qrcode("qrReader");
    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        qrInput.value = decodedText;
        processQrCode(decodedText);
      },
      () => {}
    );

    cameraActive = true;
    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;
  } catch (error) {
    setMessage("No se pudo iniciar la camara.", "error");
  }
}

async function stopCamera() {
  if (!qrScanner || !cameraActive) {
    return;
  }

  try {
    await qrScanner.stop();
    await qrScanner.clear();
  } catch (error) {
    // Ignorado para no bloquear el flujo de captura.
  }

  qrScanner = null;
  cameraActive = false;
  startCameraBtn.disabled = false;
  stopCameraBtn.disabled = true;
}

function setValidationState(enabled) {
  const targets = [qrInput, qrReader, gpsCard, validateQrBtn, startCameraBtn, stopCameraBtn];

  targets.forEach((element) => {
    if (!element) {
      return;
    }
    element.classList.toggle("scan-valid", enabled && (element === qrInput || element === qrReader));
    element.classList.toggle("scan-valid-soft", enabled && (element === gpsCard));
    element.classList.toggle("scan-valid-button", enabled && (element === validateQrBtn || element === startCameraBtn || element === stopCameraBtn));
  });
}

function setMessage(message, type) {
  scannerMessage.textContent = message;
  scannerMessage.className = "status-slot mt-3";
  if (type) {
    scannerMessage.classList.add(type);
  }
}
