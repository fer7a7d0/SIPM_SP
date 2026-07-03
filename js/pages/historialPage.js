import "../router.js";
import { ROUTES } from "../config.js";
import { getSession, verifySession } from "../services/authService.js";
import { getHistoryDetail, searchHistory } from "../services/historyService.js";

const filterDate = document.getElementById("filterDate");
const filterSupervisor = document.getElementById("filterSupervisor");
const filterArea = document.getElementById("filterArea");
const searchBtn = document.getElementById("searchBtn");
const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");
const detailPanel = document.getElementById("detailPanel");
const detailBody = document.getElementById("detailBody");

let session = null;

init();

async function init() {
  const localSession = getSession();
  if (!localSession) {
    window.location.replace(ROUTES.login);
    return;
  }

  session = await verifySession();
  if (!session) {
    window.location.replace(ROUTES.login);
    return;
  }

  searchBtn.addEventListener("click", onSearch);
  await onSearch();
}

async function onSearch() {
  try {
    setMessage("Consultando historial...", "");

    const data = await searchHistory({
      token: session.token,
      filters: {
        fecha: filterDate.value,
        supervisorId: filterSupervisor.value,
        areaId: filterArea.value
      }
    });

    renderCatalogs(data.catalog || {});
    renderList(data.items || []);

    if ((data.items || []).length === 0) {
      setMessage("No hay resultados con los filtros seleccionados.", "");
    } else {
      setMessage("", "");
    }
  } catch (error) {
    setMessage(error.message || "No se pudo consultar historial.", "error");
  }
}

function renderCatalogs(catalog) {
  const supervisors = catalog.supervisors || [];
  const areas = catalog.areas || [];

  const currentSupervisor = filterSupervisor.value;
  const currentArea = filterArea.value;

  filterSupervisor.innerHTML = '<option value="">Todos</option>';
  supervisors.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    filterSupervisor.appendChild(option);
  });

  filterArea.innerHTML = '<option value="">Todas</option>';
  areas.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    filterArea.appendChild(option);
  });

  if (currentSupervisor) {
    filterSupervisor.value = currentSupervisor;
  }
  if (currentArea) {
    filterArea.value = currentArea;
  }
}

function renderList(items) {
  historyList.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-card";

    card.innerHTML = `
      <div class="history-card-head">
        <strong>${item.areaName}</strong>
        <small>${item.fecha} ${item.horaInicio}</small>
      </div>
      <p class="mb-1">Supervisor: ${item.supervisorName}</p>
      <p class="mb-2">Duracion: ${item.duracion || "En curso"}</p>
      <button class="btn btn-sm btn-outline-dark" data-id="${item.id}">Ver detalle</button>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", () => loadDetail(item.id));

    historyList.appendChild(card);
  });
}

async function loadDetail(supervisionId) {
  try {
    const data = await getHistoryDetail({
      token: session.token,
      supervisionId
    });

    renderDetail(data);
  } catch (error) {
    setMessage(error.message || "No se pudo cargar el detalle.", "error");
  }
}

function renderDetail(data) {
  const supervision = data.supervision || {};
  const answers = data.answers || [];

  detailPanel.hidden = false;

  detailBody.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.innerHTML = `
    <p><strong>Area:</strong> ${supervision.areaName || "-"}</p>
    <p><strong>Supervisor:</strong> ${supervision.supervisorName || "-"}</p>
    <p><strong>Inicio:</strong> ${supervision.fecha || "-"} ${supervision.horaInicio || "-"}</p>
    <p><strong>Fin:</strong> ${supervision.horaFin || "-"}</p>
    <p><strong>Duracion:</strong> ${supervision.duracion || "-"}</p>
    <p><strong>GPS:</strong> ${supervision.gps || "-"}</p>
  `;
  detailBody.appendChild(summary);

  const list = document.createElement("div");
  list.className = "detail-answer-list";

  answers.forEach((item) => {
    const block = document.createElement("article");
    block.className = "detail-answer-item";

    const photoLink = item.photoUrl
      ? `<a href="${item.photoUrl}" target="_blank" rel="noopener noreferrer">Ver fotografia</a>`
      : "Sin fotografia";

    block.innerHTML = `
      <p class="meta mb-1">${item.category || "General"}</p>
      <p class="mb-1"><strong>${item.question}</strong></p>
      <p class="mb-1">Respuesta: ${item.response || "-"}</p>
      <p class="mb-1">Comentario: ${item.comment || "-"}</p>
      <p class="mb-0">${photoLink}</p>
    `;

    list.appendChild(block);
  });

  detailBody.appendChild(list);
}

function setMessage(message, type) {
  historyMessage.textContent = message;
  historyMessage.className = "status-slot mt-3";
  if (type) {
    historyMessage.classList.add(type);
  }
}
