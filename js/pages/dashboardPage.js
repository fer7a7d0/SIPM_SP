import "../router.js";
import { ROUTES } from "../config.js";
import { getSession, logout } from "../services/authService.js";

const dashboardMessage = document.getElementById("dashboardMessage");
const logoutButton = document.getElementById("logoutButton");
const scanQrBtn = document.getElementById("scanQrBtn");
const historyBtn = document.getElementById("historyBtn");
const desboarBtn = document.getElementById("desboarBtn");

init();

async function init() {
  const session = getSession();
  if (!session) {
    window.location.replace(ROUTES.login);
    return;
  }

  logoutButton.addEventListener("click", onLogout);
  scanQrBtn.addEventListener("click", () => {
    window.location.href = ROUTES.scanQr;
  });
  historyBtn.addEventListener("click", () => {
    window.location.href = ROUTES.historial;
  });
  desboarBtn.addEventListener("click", () => {
    window.location.href = ROUTES.desboar;
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
