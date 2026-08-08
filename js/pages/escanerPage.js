import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { validateQrCode } from "../services/qrService.js";
import { startSupervision } from "../services/supervisionService.js";
import { formatGps, getCurrentPosition } from "../utils/geo.js";

const qrInput = document.getElementById("qrInput");
const gpsStatus = document.getElementById("gpsStatus");
const scannerMessage = document.getElementById("scannerMessage");
const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const qrReader = document.getElementById("qrReader");
const gpsCard = gpsStatus.closest(".card");
const scannerHint = document.getElementById("scannerHint");
const scannerProgressBar = document.getElementById("scannerProgressBar");
const scannerProcessingOverlay = document.getElementById("scannerProcessingOverlay");
const scannerProcessingTitle = document.getElementById("scannerProcessingTitle");
const scannerProcessingSubtitle = document.getElementById("scannerProcessingSubtitle");
const scannerPreviewShell = document.getElementById("scannerPreviewShell");
const scannerProcessingPanel = document.getElementById("scannerProcessingPanel");
const scannerProcessingInlineTitle = document.getElementById("scannerProcessingInlineTitle");
const scannerProcessingInlineSubtitle = document.getElementById("scannerProcessingInlineSubtitle");

let activeSession = null;
let gpsPosition = null;
let qrScanner = null;
let cameraActive = false;
let isSupervisorMode = false;
let isSubmitting = false;
let manualInputTimer = null;
let lastProcessedQr = "";
let successAnimationTimer = null;

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
  setFlowState("waiting-gps", "Esperando ubicacion GPS...");

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
  } else {
    qrInput.disabled = false;
  }
}

async function captureGps() {
  try {
    gpsStatus.textContent = "Obteniendo ubicacion...";
    setFlowState("waiting-gps", "Obteniendo ubicacion GPS...");
    gpsPosition = await getCurrentPosition();
    gpsStatus.textContent = `GPS activo: ${formatGps(gpsPosition)} (±${Math.round(gpsPosition.accuracy)}m)`;
    setQrControlsEnabled(true);
    setFlowState("ready", "GPS listo. Puedes iniciar la camara o ingresar el QR manualmente.");
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
    lastProcessedQr = qrCode;
    setValidationState(true);
    setProcessingPanelVisible(true, "Validando área", "Se está confirmando la zona y el estado permanece visible.");
    setProcessingOverlayVisible(true, "Validando área", "Se está confirmando la zona y el estado permanece visible.");
    setFlowState("validating", "Validando área...");
    setMessage("Validando área...", "");

    const area = await validateQrCode(activeSession.token, qrCode);

    qrInput.value = qrCode;
    setValidationState(true, true);
    setProcessingPanelVisible(true, "Iniciando supervisión", "Se está preparando el siguiente paso.");
    setProcessingOverlayVisible(true, "Iniciando supervisión", "Se está preparando el siguiente paso.");
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
    setProcessingPanelVisible(false);
    setProcessingOverlayVisible(false);
    isSubmitting = false;
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
    qrScanner = new window.Html5Qrcode("qrReader");
    if (scannerPreviewShell) {
      scannerPreviewShell.classList.add("is-active");
    }
    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        qrInput.value = decodedText;
        if (scannerPreviewShell) {
          scannerPreviewShell.classList.remove("is-active");
        }
        setProcessingPanelVisible(true, "QR detectado", "Se cerró la vista previa y sigue visible el estado de procesamiento.");
        setProcessingOverlayVisible(true, "QR detectado", "Se está validando el código y el estado sigue visible.");
        void stopCamera().finally(() => {
          processQrCode(decodedText);
        });
      },
      () => {}
    );

    cameraActive = true;
    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;
    setFlowState("camera-active", "Camara activa. Escanea el QR o usa el codigo manualmente.");
  } catch (error) {
    setFlowState("error", "No se pudo iniciar la camara.");
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
  setFlowState("ready", "Camara detenida. Puedes volver a iniciar cuando quieras.");
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
    element.classList.toggle("scan-valid", enabled && (element === qrInput || element === qrReader));
    element.classList.toggle("scan-valid-soft", enabled && (element === gpsCard || element === startCameraBtn || element === stopCameraBtn));
    element.classList.toggle("scan-success", success && (element === qrInput || element === qrReader || element === gpsCard));
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

function setProcessingPanelVisible(visible, title = "Procesando escaneo", subtitle = "Se mantendrá visible el estado del flujo.") {
  if (!scannerProcessingPanel || !scannerProcessingInlineTitle || !scannerProcessingInlineSubtitle) {
    return;
  }

  scannerProcessingPanel.classList.toggle("is-visible", visible);
  scannerProcessingInlineTitle.textContent = title;
  scannerProcessingInlineSubtitle.textContent = subtitle;
}

function setProcessingOverlayVisible(visible, title = "Procesando escaneo", subtitle = "Se mantendrá visible el estado del flujo.") {
  if (!scannerProcessingOverlay || !scannerProcessingTitle || !scannerProcessingSubtitle) {
    return;
  }

  scannerProcessingOverlay.classList.toggle("is-visible", visible);
  scannerProcessingOverlay.style.display = visible ? "flex" : "none";
  scannerProcessingOverlay.style.visibility = visible ? "visible" : "hidden";
  scannerProcessingOverlay.style.opacity = visible ? "1" : "0";
  scannerProcessingTitle.textContent = title;
  scannerProcessingSubtitle.textContent = subtitle;
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
