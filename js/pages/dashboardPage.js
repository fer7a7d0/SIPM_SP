import "../router.js";
import { ROUTES } from "../config.js";
import { apiRequest } from "../services/apiClient.js";
import { clearSession, getSession, logout, verifySession } from "../services/authService.js";
import { formatDateEs } from "../utils/dateTime.js";

const supervisorName = document.getElementById("supervisorName");
const currentDate = document.getElementById("currentDate");
const todayCount = document.getElementById("todayCount");
const dashboardMessage = document.getElementById("dashboardMessage");
const logoutButton = document.getElementById("logoutButton");
const scanQrBtn = document.getElementById("scanQrBtn");
const historyBtn = document.getElementById("historyBtn");

init();

async function init() {
  const session = getSession();
  if (!session) {
    window.location.replace(ROUTES.login);
    return;
  }

  const checkedSession = await verifySession();
  if (!checkedSession) {
    clearSession();
    window.location.replace(ROUTES.login);
    return;
  }

  supervisorName.textContent = checkedSession.userName;
  currentDate.textContent = `Fecha: ${formatDateEs(Date.now())}`;

  try {
    const stats = await apiRequest("dashboard.stats", { token: checkedSession.token });
    todayCount.textContent = `Supervisiones hoy: ${stats.todaySupervisions}`;
  } catch (error) {
    todayCount.textContent = "Supervisiones hoy: -";
    setMessage(error.message || "No se pudo cargar el dashboard.", "error");
  }

  logoutButton.addEventListener("click", onLogout);
  scanQrBtn.addEventListener("click", () => {
    window.location.href = ROUTES.scanQr;
  });
  historyBtn.addEventListener("click", () => {
    window.location.href = ROUTES.historial;
  });
}

async function onLogout() {
  await logout();
  window.location.replace(ROUTES.login);
}

function setMessage(message, type) {
  dashboardMessage.textContent = message;
  dashboardMessage.className = "status-slot mt-3";
  if (type) {
    dashboardMessage.classList.add(type);
  }
}
