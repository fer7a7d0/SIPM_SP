import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { clearActiveSupervision, getActiveSupervision, saveSupervision } from "../services/supervisionService.js";
import { formatDateEs, formatTimeEs } from "../utils/dateTime.js";

const summaryList = document.getElementById("summaryList");
const saveBtn = document.getElementById("saveSummaryBtn");
const summaryMessage = document.getElementById("summaryMessage");

let session = null;
let active = null;

init();

function init() {
  session = getSession();
  active = getActiveSupervision();

  if (!session || !active || !active.areaId || !active.gps || !active.startAt || !active.answers) {
    window.location.replace(ROUTES.dashboard);
    return;
  }

  renderSummary();
  saveBtn.addEventListener("click", onSave);
}

function renderSummary() {
  const now = new Date();
  const start = new Date(active.startAt);
  const durationMin = Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
  const answers = Object.values(active.answers || {});
  const photoCount = answers.filter((item) => Boolean(item.photoDataUrl)).length;

  const rows = [
    { label: "Area", value: active.areaName || "-" },
    { label: "Supervisor", value: session.userName || session.userId || "-" },
    { label: "Fecha", value: formatDateEs(now) },
    { label: "Hora inicio", value: formatTimeEs(active.startAt) },
    { label: "Hora termino", value: formatTimeEs(now) },
    { label: "Duracion", value: `${durationMin} min` },
    { label: "Respuestas", value: String(answers.length) },
    { label: "Fotografias", value: String(photoCount) }
  ];

  summaryList.innerHTML = "";
  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = "summary-item";
    div.innerHTML = `<span>${row.label}</span><strong>${row.value}</strong>`;
    summaryList.appendChild(div);
  });
}

async function onSave() {
  try {
    saveBtn.disabled = true;
    setMessage("Guardando supervision...", "");

    const payloadAnswers = Object.values(active.answers || {}).map((item) => ({
      questionId: item.questionId,
      response: item.response,
      comment: item.comment || "",
      photoDataUrl: item.photoDataUrl || ""
    }));

    await saveSupervision({
      token: session.token,
      areaId: active.areaId,
      gps: active.gps,
      startAt: active.startAt,
      answers: payloadAnswers
    });

    clearActiveSupervision();
    setMessage("Supervision guardada correctamente.", "success");
    window.location.replace(ROUTES.dashboard);
  } catch (error) {
    setMessage(error.message || "No se pudo guardar la supervision.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

function setMessage(message, type) {
  summaryMessage.textContent = message;
  summaryMessage.className = "status-slot mt-3";
  if (type) {
    summaryMessage.classList.add(type);
  }
}
