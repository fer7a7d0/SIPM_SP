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

let activeSession = null;
let gpsPosition = null;
let qrScanner = null;
let cameraActive = false;

init();

async function init() {
  const localSession = getSession();
  if (!localSession) {
    window.location.replace(ROUTES.login);
    return;
  }

  activeSession = localSession;

  validateQrBtn.addEventListener("click", onValidateAndStart);
  startCameraBtn.addEventListener("click", startCamera);
  stopCameraBtn.addEventListener("click", stopCamera);
  qrInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onValidateAndStart();
    }
  });

  await captureGps();
  window.addEventListener("beforeunload", () => {
    stopCamera();
  });
}

async function captureGps() {
  try {
    gpsStatus.textContent = "Obteniendo ubicacion...";
    gpsPosition = await getCurrentPosition();
    gpsStatus.textContent = `GPS activo: ${formatGps(gpsPosition)} (±${Math.round(gpsPosition.accuracy)}m)`;
  } catch (error) {
    gpsPosition = null;
    gpsStatus.textContent = "No disponible";
    setMessage(error.message, "error");
  }
}

async function onValidateAndStart() {
  const qrCode = String(qrInput.value || "").trim();
  if (!qrCode) {
    setMessage("Escanea o ingresa un codigo QR valido.", "error");
    return;
  }

  if (!gpsPosition) {
    setMessage("La ubicacion GPS es obligatoria para iniciar supervision.", "error");
    await captureGps();
    return;
  }

  try {
    validateQrBtn.disabled = true;
    setMessage("Validando area...", "");

    const area = await validateQrCode(activeSession.token, qrCode);

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
    setMessage(error.message || "No se pudo iniciar supervision.", "error");
  } finally {
    validateQrBtn.disabled = false;
  }
}

async function startCamera() {
  if (cameraActive) {
    return;
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
        setMessage("QR detectado. Puedes iniciar la supervision.", "success");
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

function setMessage(message, type) {
  scannerMessage.textContent = message;
  scannerMessage.className = "status-slot mt-3";
  if (type) {
    scannerMessage.classList.add(type);
  }
}
