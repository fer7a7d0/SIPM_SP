import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { getHistoryCatalog, getHistoryDetail, searchHistory } from "../services/historyService.js";

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

  session = localSession;

  searchBtn.addEventListener("click", onSearch);
  await loadCatalogs();
  setMessage("Selecciona filtros y presiona Buscar para consultar el historial.", "");
}

async function loadCatalogs() {
  try {
    const data = await getHistoryCatalog({ token: session.token });
    renderCatalogs(data.catalog || {}, data.permissions || {});
  } catch (error) {
    setMessage(error.message || "No se pudieron cargar los filtros de historial.", "error");
  }
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

    renderCatalogs(data.catalog || {}, data.permissions || {});
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

function renderCatalogs(catalog, permissions) {
  const supervisors = catalog.supervisors || [];
  const areas = catalog.areas || [];
  const onlyOwnHistory = Boolean(permissions && permissions.onlyOwnHistory);

  const currentSupervisor = filterSupervisor.value;
  const currentArea = filterArea.value;

  filterSupervisor.innerHTML = onlyOwnHistory ? "" : '<option value="">Todos</option>';
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

  if (onlyOwnHistory) {
    filterSupervisor.disabled = true;
    if (supervisors[0]) {
      filterSupervisor.value = supervisors[0].id;
    }
  } else {
    filterSupervisor.disabled = false;
    if (currentSupervisor) {
      filterSupervisor.value = currentSupervisor;
    }
  }
  if (currentArea) {
    filterArea.value = currentArea;
  }
}

function renderList(items) {
  historyList.innerHTML = "";

  items.forEach((item) => {
    const formattedDate = formatDateShort(item.fecha);
    const formattedStartTime = formatTimeShort(item.horaInicio);

    const card = document.createElement("article");
    card.className = "history-card";

    card.innerHTML = `
      <div class="history-card-head">
        <strong>${item.areaName}</strong>
        <small>${formattedDate} ${formattedStartTime}</small>
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
  const formattedDate = formatDateShort(supervision.fecha);
  const formattedStartTime = formatTimeShort(supervision.horaInicio);
  const formattedEndTime = formatTimeShort(supervision.horaFin);
  const formattedEndDateTime =
    formattedEndTime === "-"
      ? "-"
      : formattedDate === "-"
        ? formattedEndTime
        : `${formattedDate} ${formattedEndTime}`;

  detailPanel.hidden = false;

  detailBody.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.innerHTML = `
    <p><strong>Area:</strong> ${supervision.areaName || "-"}</p>
    <p><strong>Supervisor:</strong> ${supervision.supervisorName || "-"}</p>
    <p><strong>Inicio:</strong> ${formattedDate} ${formattedStartTime}</p>
    <p><strong>Fin:</strong> ${formattedEndDateTime}</p>
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

function formatDateShort(dateValue) {
  const raw = String(dateValue || "").trim();
  if (!raw) {
    return "-";
  }

  // Normaliza fechas tipo yyyy-MM-dd a formato fijo dd/MM/yyyy.
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    return raw;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatTimeShort(timeValue) {
  const raw = String(timeValue || "").trim();
  if (!raw) {
    return "-";
  }

  // Caso directo: HH:mm o HH:mm:ss.
  const direct = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (direct) {
    const hh = String(direct[1]).padStart(2, "0");
    const mm = direct[2];
    return `${hh}:${mm}`;
  }

  // Extrae la hora cuando viene incrustada en textos largos.
  const embedded = raw.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (embedded) {
    const hh = String(embedded[1]).padStart(2, "0");
    const mm = embedded[2];
    return `${hh}:${mm}`;
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return "-";
}
