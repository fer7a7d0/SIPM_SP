import "../router.js";
import { ROUTES } from "../config.js";
import { apiRequest } from "../services/apiClient.js";
import { getSession } from "../services/authService.js";
import { formatDateEs } from "../utils/dateTime.js";

const supervisorName = document.getElementById("supervisorName");
const currentDate = document.getElementById("currentDate");
const todayCount = document.getElementById("todayCount");
const desboarMessage = document.getElementById("desboarMessage");

init();

async function init() {
  const session = getSession();
  if (!session) {
    window.location.replace(ROUTES.login);
    return;
  }

  supervisorName.textContent = session.userName || session.userId || "-";
  currentDate.textContent = `Fecha: ${formatDateEs(Date.now())}`;

  try {
    const stats = await apiRequest("dashboard.stats", { token: session.token });
    todayCount.textContent = `Supervisiones hoy: ${stats.todaySupervisions}`;
  } catch (error) {
    todayCount.textContent = "Supervisiones hoy: -";
    setMessage(error.message || "No se pudo cargar la informacion.", "error");
  }
}

function setMessage(message, type) {
  desboarMessage.textContent = message;
  desboarMessage.className = "status-slot mt-3";
  if (type) {
    desboarMessage.classList.add(type);
  }
}
