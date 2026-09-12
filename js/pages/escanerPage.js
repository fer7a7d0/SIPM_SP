import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { validateQrCode } from "../services/qrService.js";
import { listAvailableAreas, startSupervision } from "../services/supervisionService.js";
import { formatGps, getCurrentPosition } from "../utils/geo.js";

const qrInput = document.getElementById("qrInput");
const qrCodeOptions = document.getElementById("qrCodeOptions");
const gpsStatus = document.getElementById("gpsStatus");
const scannerMessage = document.getElementById("scannerMessage");
const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const qrReader = document.getElementById("qrReader");
const gpsCard = gpsStatus.closest(".card");
const scannerHint = document.getElementById("scannerHint");
const scannerProgressBar = document.getElementById("scannerProgressBar");

let activeSession = null;
let gpsPosition = null;
let qrScanner = null;
let cameraActive = false;
let isSupervisorMode = false;
let isSubmitting = false;
let manualInputTimer = null;
let lastProcessedQr = "";
let successAnimationTimer = null;
const MANUAL_QR_DEBOUNCE_MS = 1500;
const MANUAL_QR_MIN_LENGTH = 8;

function updateValidateButtonState() {
  // El flujo manual sigue usando el proceso de validación sin necesitar un botón visible.
}

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
  setPreviewVisible(true);
  showScannerPlaceholder("Presiona iniciar cámara QR");
  setFlowState("waiting-gps", "Esperando ubicacion GPS...");

  startCameraBtn.addEventListener("click", startCamera);
  stopCameraBtn.addEventListener("click", stopCamera);
  qrInput.addEventListener("input", (event) => {
    if (isSupervisorMode || !gpsPosition) {
      return;
    }

    if (manualInputTimer) {
      window.clearTimeout(manualInputTimer);
    }

    const currentValue = String(qrInput.value || "").trim();
    const isPasteAction = event && event.inputType === "insertFromPaste";
    if (isPasteAction && currentValue.length >= MANUAL_QR_MIN_LENGTH) {
      processQrCode(currentValue);
      return;
    }

    if (currentValue.length < MANUAL_QR_MIN_LENGTH) {
      return;
    }

    manualInputTimer = window.setTimeout(() => {
      processQrCode(String(qrInput.value || ""));
    }, MANUAL_QR_DEBOUNCE_MS);
  });
  qrInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      processQrCode(String(qrInput.value || ""));
    }
  });

  await loadQrCodeOptions();
  await captureGps();
  window.addEventListener("beforeunload", () => {
    stopCamera();
  });
}

async function loadQrCodeOptions() {
  try {
    const areas = await listAvailableAreas(activeSession.token);
    qrCodeOptions.innerHTML = "";
    areas
      .filter((area) => area.qrCode)
      .forEach((area) => {
        const option = document.createElement("option");
        option.value = area.qrCode;
        option.label = area.name;
        qrCodeOptions.appendChild(option);
      });
  } catch (error) {
    // El datalist queda vacio si no se pueden cargar las areas.
  }
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
  const canInteract = Boolean(enabled) && !isSubmitting;
  const shouldDisableInput = isSupervisorMode || !canInteract || !gpsPosition;
  const showCameraButtons = Boolean(gpsPosition) && !isSubmitting;

  startCameraBtn.disabled = !canInteract || cameraActive;
  stopCameraBtn.disabled = !canInteract || !cameraActive;
  startCameraBtn.classList.toggle("d-none", !showCameraButtons);
  stopCameraBtn.classList.toggle("d-none", !showCameraButtons || !cameraActive);
  qrInput.disabled = shouldDisableInput;
}

async function captureGps() {
  try {
    gpsStatus.textContent = "Obteniendo ubicacion...";
    setFlowState("waiting-gps", "Obteniendo ubicacion GPS...");
    gpsPosition = await getCurrentPosition();
    gpsStatus.textContent = `GPS activo: ${formatGps(gpsPosition)} (±${Math.round(gpsPosition.accuracy)}m)`;
    setQrControlsEnabled(true);
    setFlowState("ready", "GPS listo. Puedes usar la cámara o ingresar el QR manualmente.");
  } catch (error) {
    gpsPosition = null;
    setQrControlsEnabled(false);
    gpsStatus.textContent = "No disponible";
    setFlowState("error", error.message || "No fue posible obtener GPS.");
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
    setQrControlsEnabled(Boolean(gpsPosition));
    lastProcessedQr = qrCode;
    setValidationState(true);
    setPreviewVisible(false);
    setFlowState("validating", "Validando área...");
    setMessage("Validando área...", "");

    const area = await validateQrCode(activeSession.token, qrCode);

    qrInput.value = qrCode;
    setValidationState(true, true);
    setPreviewVisible(false);
    setFlowState("launching", "Iniciando supervisión...");
    setMessage("Iniciando supervisión...", "success");

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    await launchSupervision({ areaId: area.area.id, qrCode });

    await stopCamera();
    window.location.replace(ROUTES.supervision);
  } catch (error) {
    lastProcessedQr = "";
    setValidationState(false);
    setFlowState("error", error.message || "No se pudo iniciar supervision.");
    setMessage(error.message || "No se pudo iniciar supervision.", "error");
  } finally {
    setPreviewVisible(false);
    isSubmitting = false;
    setQrControlsEnabled(Boolean(gpsPosition));
  }
}

async function launchSupervision({ areaId, qrCode = "" }) {
  await startSupervision({
    token: activeSession.token,
    qrCode,
    areaId,
    gps: formatGps(gpsPosition)
  });
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
    showScannerPlaceholder("Iniciando cámara...");
    qrScanner = new window.Html5Qrcode("qrReader");
    setPreviewVisible(true);
    setFlowState("camera-active", "Preparando camara... ");
    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        qrInput.value = decodedText;
        setPreviewVisible(false);
        setFlowState("validating", "QR detectado. Validando área...");
        setMessage("QR detectado. Validando área...", "");
        void stopCamera().finally(() => {
          processQrCode(decodedText);
        });
      },
      () => {}
    );

    cameraActive = true;
    setQrControlsEnabled(Boolean(gpsPosition));
    setFlowState("camera-active", "Cámara lista. Enfoca el QR o usa el ingreso manual.");
  } catch (error) {
    setFlowState("error", "No se pudo iniciar la camara.");
    setMessage("No se pudo iniciar la camara.", "error");
  }
}

async function stopCamera() {
  if (!qrScanner && !cameraActive) {
    setPreviewVisible(false);
    return;
  }

  try {
    if (qrScanner) {
      await qrScanner.stop();
      await qrScanner.clear();
    }
  } catch (error) {
    // Ignorado para no bloquear el flujo de captura.
  }

  qrScanner = null;
  cameraActive = false;
  setQrControlsEnabled(Boolean(gpsPosition));
  setPreviewVisible(false);
  setFlowState("ready", "Cámara detenida. Puedes volver a iniciar cuando quieras.");
}

function setPreviewVisible(visible) {
  if (!qrReader) {
    return;
  }

  qrReader.classList.toggle("is-hidden", !visible);
  qrReader.style.display = visible ? "block" : "none";
  if (!visible) {
    qrReader.innerHTML = "";
  }
}

function showScannerPlaceholder(message) {
  if (!qrReader) {
    return;
  }

  if (qrReader.innerHTML.trim()) {
    return;
  }

  qrReader.innerHTML = `<div class="scanner-placeholder">${message}</div>`;
}

function setValidationState(enabled, success = false) {
  if (successAnimationTimer) {
    window.clearTimeout(successAnimationTimer);
    successAnimationTimer = null;
  }

  const targets = [qrInput, qrReader, gpsCard, startCameraBtn, stopCameraBtn];

  targets.forEach((element) => {
    if (!element) {
      return;
    }
    element.classList.toggle("scan-valid", enabled && element === qrReader);
    element.classList.toggle("scan-valid-soft", enabled && (element === gpsCard || element === startCameraBtn || element === stopCameraBtn));
    element.classList.toggle("scan-success", success && (element === qrReader || element === gpsCard));
  });

  if (success) {
    successAnimationTimer = window.setTimeout(() => {
      targets.forEach((element) => {
        if (element) {
          element.classList.remove("scan-success");
        }
      });
      successAnimationTimer = null;
    }, 700);
  }
}

function setFlowState(state, message) {
  if (!scannerHint || !scannerProgressBar) {
    return;
  }

  scannerHint.textContent = message;
  scannerHint.className = "scanner-hint";

  const progressMap = {
    "waiting-gps": 20,
    "ready": 40,
    "camera-active": 60,
    "validating": 70,
    "launching": 90,
    "success": 100,
    "error": 0
  };

  const width = progressMap[state] ?? 0;
  scannerProgressBar.style.width = `${width}%`;
  scannerProgressBar.classList.toggle("is-active", state === "validating" || state === "launching");

  if (state === "error") {
    scannerHint.classList.add("is-error");
  } else if (state === "success") {
    scannerHint.classList.add("is-success");
  }
}

function setMessage(message, type) {
  scannerMessage.textContent = message;
  scannerMessage.className = "status-slot mt-3";
  if (type) {
    scannerMessage.classList.add(type);
  }
}
