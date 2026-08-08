import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { exportHistoryDetailed, getHistoryCatalog, getHistoryDetail, searchHistory } from "../services/historyService.js";

const filterDate = document.getElementById("filterDate");
const filterSupervisor = document.getElementById("filterSupervisor");
const filterArea = document.getElementById("filterArea");
const filterOperator = document.getElementById("filterOperator");
const searchBtn = document.getElementById("searchBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportDetailedCsvBtn = document.getElementById("exportDetailedCsvBtn");
const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");
const detailModal = document.getElementById("detailModal") || document.getElementById("detailPanel");
const detailBackdrop = document.getElementById("detailBackdrop");
const closeDetailBtn = document.getElementById("closeDetailBtn");
const detailBody = document.getElementById("detailBody");
const photoViewer = document.getElementById("photoViewer");
const photoViewerBackdrop = document.getElementById("photoViewerBackdrop");
const closePhotoViewerBtn = document.getElementById("closePhotoViewerBtn");
const photoViewerImage = document.getElementById("photoViewerImage");
const HISTORY_STATE_KEY = "sipm_history_view_state";

let session = null;
let currentDetailSupervisionId = "";
let currentPhotoOriginalUrl = "";
let currentPhotoFallbackUrl = "";
let lastSearchItems = [];

init();

async function init() {
  const localSession = getSession();
  if (!localSession) {
    window.location.replace(ROUTES.login);
    return;
  }

  session = localSession;

  searchBtn.addEventListener("click", onSearch);
  exportCsvBtn.addEventListener("click", onExportCsv);
  exportDetailedCsvBtn.addEventListener("click", onExportDetailedCsv);
  filterDate.addEventListener("change", () => saveCurrentState());
  filterSupervisor.addEventListener("change", () => saveCurrentState());
  filterArea.addEventListener("change", () => saveCurrentState());
  filterOperator.addEventListener("change", () => saveCurrentState());

  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", closeDetailModal);
  }
  if (detailBackdrop) {
    detailBackdrop.addEventListener("click", closeDetailModal);
  }
  if (closePhotoViewerBtn) {
    closePhotoViewerBtn.addEventListener("click", closePhotoViewer);
  }
  if (photoViewerBackdrop) {
    photoViewerBackdrop.addEventListener("click", closePhotoViewer);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (photoViewer && !photoViewer.hidden) {
        closePhotoViewer();
        return;
      }
      if (detailModal && !detailModal.hidden) {
        closeDetailModal();
      }
    }
  });

  window.addEventListener("pagehide", () => {
    saveCurrentState();
  });

  await loadCatalogs();
  await restoreViewState();
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
        areaId: filterArea.value,
        operatorId: filterOperator.value
      }
    });

    lastSearchItems = data.items || [];
    renderCatalogs(data.catalog || {}, data.permissions || {});
    renderList(lastSearchItems);
    saveCurrentState({ hasSearch: true });

    if (lastSearchItems.length === 0) {
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
  const operators = catalog.operators || [];
  const onlyOwnHistory = Boolean(permissions && permissions.onlyOwnHistory);

  const currentSupervisor = filterSupervisor.value;
  const currentArea = filterArea.value;
  const currentOperator = filterOperator.value;

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

  filterOperator.innerHTML = '<option value="">Todos</option>';
  operators.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    filterOperator.appendChild(option);
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
  if (currentOperator) {
    filterOperator.value = currentOperator;
  }
}

function onExportCsv() {
  if (!lastSearchItems.length) {
    setMessage("No hay resultados para exportar. Ejecuta una busqueda primero.", "error");
    return;
  }

  const rows = [
    ["ID", "Fecha", "Hora inicio", "Hora fin", "Duracion", "Area", "Supervisor", "Operador", "GPS"],
    ...lastSearchItems.map((item) => [
      item.id || "",
      item.fecha || "",
      item.horaInicio || "",
      item.horaFin || "",
      item.duracion || "",
      item.areaName || item.areaId || "",
      item.supervisorName || item.supervisorId || "",
      item.operatorName || item.operatorId || "",
      item.gps || ""
    ])
  ];

  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const fileDate = String(filterDate.value || "").trim() || new Date().toISOString().slice(0, 10);
  const fileName = `historial_supervisiones_${fileDate}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setMessage("CSV exportado correctamente.", "success");
}

async function onExportDetailedCsv() {
  try {
    exportDetailedCsvBtn.disabled = true;
    setMessage("Generando CSV detallado...", "");

    const data = await exportHistoryDetailed({
      token: session.token,
      filters: {
        fecha: filterDate.value,
        supervisorId: filterSupervisor.value,
        areaId: filterArea.value,
        operatorId: filterOperator.value
      }
    });

    const rows = data.rows || [];
    if (!rows.length) {
      setMessage("No hay detalle para exportar con los filtros seleccionados.", "error");
      return;
    }

    const csvRows = [
      [
        "ID Supervision",
        "Fecha",
        "Hora inicio",
        "Hora fin",
        "Duracion",
        "Area",
        "Supervisor",
        "Operador",
        "GPS",
        "Checklist",
        "Seccion",
        "Categoria",
        "Pregunta",
        "Respuesta",
        "Comentario",
        "Foto URL"
      ],
      ...rows.map((item) => [
        item.supervisionId || "",
        item.fecha || "",
        item.horaInicio || "",
        item.horaFin || "",
        item.duracion || "",
        item.areaName || item.areaId || "",
        item.supervisorName || item.supervisorId || "",
        item.operatorName || item.operatorId || "",
        item.gps || "",
        item.checklistName || item.checklistId || "",
        item.sectionName || item.sectionId || "",
        item.category || "",
        item.question || item.questionId || "",
        item.response || "",
        item.comment || "",
        item.photoUrl || ""
      ])
    ];

    const csvContent = csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const fileDate = String(filterDate.value || "").trim() || new Date().toISOString().slice(0, 10);
    const fileName = `historial_supervisiones_detallado_${fileDate}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setMessage("CSV detallado exportado correctamente.", "success");
  } catch (error) {
    setMessage(error.message || "No se pudo exportar el CSV detallado.", "error");
  } finally {
    exportDetailedCsvBtn.disabled = false;
  }
}

function escapeCsvCell(value) {
  const raw = String(value === null || value === undefined ? "" : value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
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
      <p class="mb-1">Operador: ${item.operatorName || item.operatorId || "-"}</p>
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
    currentDetailSupervisionId = String(supervisionId || "").trim();

    const data = await getHistoryDetail({
      token: session.token,
      supervisionId
    });

    renderDetail(data);
    saveCurrentState();
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

  openDetailModal();

  detailBody.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.innerHTML = `
    <p><strong>Area:</strong> ${supervision.areaName || "-"}</p>
    <p><strong>Supervisor:</strong> ${supervision.supervisorName || "-"}</p>
    <p><strong>Operador:</strong> ${supervision.operatorName || supervision.operatorId || "-"}</p>
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
      ? `<button type="button" class="photo-action-btn" data-photo-url="${item.photoUrl}">Ver fotografia</button>`
      : "Sin fotografia";

    block.innerHTML = `
      <p class="meta mb-1">${item.category || "General"}</p>
      <p class="mb-1"><strong>${item.question}</strong></p>
      <p class="mb-1">Respuesta: ${item.response || "-"}</p>
      <p class="mb-1">Comentario: ${item.comment || "-"}</p>
      <p class="mb-0">${photoLink}</p>
    `;

    list.appendChild(block);

    const photoButton = block.querySelector("[data-photo-url]");
    if (photoButton) {
      photoButton.addEventListener("click", () => {
        saveCurrentState();
        openPhotoViewer(photoButton.getAttribute("data-photo-url"));
      });
    }
  });

  detailBody.appendChild(list);
}

function openDetailModal() {
  if (!detailModal) {
    return;
  }
  detailModal.hidden = false;
  syncBodyModalState();
}

function closeDetailModal() {
  if (!detailModal) {
    return;
  }
  closePhotoViewer();
  detailModal.hidden = true;
  currentDetailSupervisionId = "";
  saveCurrentState();
  syncBodyModalState();
}

function openPhotoViewer(photoUrl) {
  const url = String(photoUrl || "").trim();
  if (!photoViewer || !photoViewerImage || !url) {
    return;
  }

  const renderUrl = buildPhotoRenderUrl(url);
  const fallbackUrl = buildPhotoFallbackUrl(url, renderUrl);

  currentPhotoOriginalUrl = url;
  currentPhotoFallbackUrl = fallbackUrl;
  photoViewerImage.src = renderUrl;

  photoViewerImage.onerror = () => {
    if (currentPhotoFallbackUrl && photoViewerImage.src !== currentPhotoFallbackUrl) {
      photoViewerImage.src = currentPhotoFallbackUrl;
      return;
    }

    if (currentPhotoOriginalUrl && photoViewerImage.src !== currentPhotoOriginalUrl) {
      photoViewerImage.src = currentPhotoOriginalUrl;
      return;
    }

    setMessage("No se pudo visualizar la fotografia en el visor. Intenta abrirla desde Google Drive.", "error");
  };

  photoViewer.hidden = false;
  syncBodyModalState();
}

function closePhotoViewer() {
  if (!photoViewer || !photoViewerImage) {
    return;
  }

  photoViewer.hidden = true;
  photoViewerImage.onerror = null;
  photoViewerImage.removeAttribute("src");
  currentPhotoOriginalUrl = "";
  currentPhotoFallbackUrl = "";
  syncBodyModalState();
}

function buildPhotoRenderUrl(photoUrl) {
  const url = String(photoUrl || "").trim();
  if (!url) {
    return "";
  }

  const driveId = extractGoogleDriveFileId(url);
  if (!driveId) {
    return url;
  }

  // URL de thumbnail suele funcionar mejor para render directo en IMG.
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;
}

function buildPhotoFallbackUrl(photoUrl, renderUrl) {
  const url = String(photoUrl || "").trim();
  if (!url) {
    return "";
  }

  const driveId = extractGoogleDriveFileId(url);
  if (!driveId) {
    return "";
  }

  const direct = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`;
  if (direct !== String(renderUrl || "")) {
    return direct;
  }
  return "";
}

function extractGoogleDriveFileId(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }

  const pathMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  return "";
}

function syncBodyModalState() {
  const detailOpen = Boolean(detailModal && !detailModal.hidden);
  const photoOpen = Boolean(photoViewer && !photoViewer.hidden);

  if (detailOpen || photoOpen) {
    document.body.classList.add("modal-open");
    return;
  }
  document.body.classList.remove("modal-open");
}

function getSavedState() {
  try {
    const raw = sessionStorage.getItem(HISTORY_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function saveCurrentState(patch = {}) {
  try {
    const previous = getSavedState() || {};
    const next = {
      ...previous,
      ...patch,
      filters: {
        fecha: filterDate.value || "",
        supervisorId: filterSupervisor.value || "",
        areaId: filterArea.value || "",
        operatorId: filterOperator.value || ""
      },
      scrollY: window.scrollY || 0,
      detailSupervisionId: currentDetailSupervisionId || "",
      updatedAt: Date.now()
    };
    sessionStorage.setItem(HISTORY_STATE_KEY, JSON.stringify(next));
  } catch (error) {
    // Ignora errores de storage para no bloquear flujo principal.
  }
}

async function restoreViewState() {
  const state = getSavedState();
  const filters = (state && state.filters) || {};
  filterDate.value = String(filters.fecha || "");
  if (filters.supervisorId) {
    filterSupervisor.value = String(filters.supervisorId || "");
  }
  if (filters.areaId) {
    filterArea.value = String(filters.areaId || "");
  }
  if (filters.operatorId) {
    filterOperator.value = String(filters.operatorId || "");
  }

  await onSearch();

  if (state && state.detailSupervisionId) {
    await loadDetail(String(state.detailSupervisionId));
  }

  if (state && typeof state.scrollY === "number") {
    window.setTimeout(() => {
      window.scrollTo(0, state.scrollY);
    }, 0);
  }
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
