import "../router.js";
import { ROUTES } from "../config.js";
import { apiRequest } from "../services/apiClient.js";
import { getSession } from "../services/authService.js";
import { formatDateEs } from "../utils/dateTime.js";

const supervisorName = document.getElementById("supervisorName");
const currentDate = document.getElementById("currentDate");
const indicadoresMessage = document.getElementById("indicadoresMessage");
const kpiDayFinalizadas = document.getElementById("kpiDayFinalizadas");
const kpiWeekFinalizadas = document.getElementById("kpiWeekFinalizadas");
const kpiMonthFinalizadas = document.getElementById("kpiMonthFinalizadas");
const kpiDayHallazgos = document.getElementById("kpiDayHallazgos");
const kpiWeekHallazgos = document.getElementById("kpiWeekHallazgos");
const kpiMonthHallazgos = document.getElementById("kpiMonthHallazgos");
const supervisorTableBody = document.querySelector("#supervisorTable tbody");
const operatorTableBody = document.querySelector("#operatorTable tbody");
const trendTableBody = document.querySelector("#trendTable tbody");
const areaTableBody = document.querySelector("#areaTable tbody");
const operatorRankingTableBody = document.querySelector("#operatorRankingTable tbody");
const timeGlobal = document.getElementById("timeGlobal");
const timeBySupervisorTableBody = document.querySelector("#timeBySupervisorTable tbody");

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
    const summary = await apiRequest("dashboard.kpiSummary", {
      token: session.token,
      windowDays: 30
    });

    renderSummary(summary || {});
  } catch (error) {
    setMessage(error.message || "No se pudo cargar la informacion.", "error");
  }
}

function renderSummary(summary) {
  const periods = summary.periods || {};
  const day = periods.day || {};
  const week = periods.week || {};
  const month = periods.month || {};

  kpiDayFinalizadas.textContent = String(day.supervisionesFinalizadas ?? "-");
  kpiWeekFinalizadas.textContent = String(week.supervisionesFinalizadas ?? "-");
  kpiMonthFinalizadas.textContent = String(month.supervisionesFinalizadas ?? "-");
  kpiDayHallazgos.textContent = String(day.hallazgosTotales ?? "-");
  kpiWeekHallazgos.textContent = String(week.hallazgosTotales ?? "-");
  kpiMonthHallazgos.textContent = String(month.hallazgosTotales ?? "-");

  renderSupervisorTable(summary.bySupervisor || []);
  renderOperatorTable(summary.byOperator || []);
  renderTrendTable(summary.findingsTrend || []);
  renderAreaTable(summary.areaRanking || []);
  renderOperatorRankingTable(summary.operatorRanking || []);
  renderTimeMetrics(summary.timeMetrics || {});
}

function renderOperatorRankingTable(rows) {
  operatorRankingTableBody.innerHTML = "";

  if (!rows.length) {
    operatorRankingTableBody.innerHTML = '<tr><td colspan="3" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.operatorName || row.operatorId || "-"}</td>
      <td>${row.hallazgosTotales ?? "-"}</td>
      <td>${row.supervisionesFinalizadas ?? "-"}</td>
    `;
    operatorRankingTableBody.appendChild(tr);
  });
}

function renderOperatorTable(rows) {
  operatorTableBody.innerHTML = "";

  if (!rows.length) {
    operatorTableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const compliance = row.cumplimientoPct === null || row.cumplimientoPct === undefined
      ? "-"
      : `${row.cumplimientoPct}%`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.operatorName || row.operatorId || "-"}</td>
      <td>${row.supervisionesFinalizadas ?? "-"}</td>
      <td>${row.preguntasEvaluables ?? "-"}</td>
      <td>${row.hallazgosTotales ?? "-"}</td>
      <td>${compliance}</td>
    `;
    operatorTableBody.appendChild(tr);
  });
}

function renderSupervisorTable(rows) {
  supervisorTableBody.innerHTML = "";

  if (!rows.length) {
    supervisorTableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const compliance = row.monthCompliance || {};
    const complianceLabel = formatComplianceLabel(compliance);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.supervisorName || row.supervisorId || "-"}</td>
      <td>${row.day?.supervisionesFinalizadas ?? "-"}</td>
      <td>${row.week?.supervisionesFinalizadas ?? "-"}</td>
      <td>${row.month?.supervisionesFinalizadas ?? "-"}</td>
      <td>${complianceLabel}</td>
    `;
    supervisorTableBody.appendChild(tr);
  });
}

function formatComplianceLabel(compliance) {
  const done = Number(compliance.realizadas ?? 0);
  const target = Number(compliance.meta ?? 0);
  const pct = compliance.cumplimientoPct;

  if (!target) {
    return `${done}/0 (-)`;
  }

  const pctText = pct === null || pct === undefined || Number.isNaN(Number(pct)) ? "-" : `${pct}%`;
  return `${done}/${target} (${pctText})`;
}

function renderTrendTable(rows) {
  trendTableBody.innerHTML = "";

  if (!rows.length) {
    trendTableBody.innerHTML = '<tr><td colspan="2" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date || "-"}</td>
      <td>${row.hallazgos ?? "-"}</td>
    `;
    trendTableBody.appendChild(tr);
  });
}

function renderAreaTable(rows) {
  areaTableBody.innerHTML = "";

  if (!rows.length) {
    areaTableBody.innerHTML = '<tr><td colspan="3" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.areaName || row.areaId || "-"}</td>
      <td>${row.hallazgos ?? "-"}</td>
      <td>${row.supervisiones ?? "-"}</td>
    `;
    areaTableBody.appendChild(tr);
  });
}

function renderTimeMetrics(metrics) {
  const global = metrics.global || {};
  timeGlobal.textContent = `Promedio global: ${formatMetric(global.duracionPromedioMin)} min | P90: ${formatMetric(global.duracionP90Min)} min`;

  const rows = metrics.bySupervisor || [];
  timeBySupervisorTableBody.innerHTML = "";

  if (!rows.length) {
    timeBySupervisorTableBody.innerHTML = '<tr><td colspan="3" class="text-muted">Sin datos</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.supervisorName || row.supervisorId || "-"}</td>
      <td>${formatMetric(row.duracionPromedioMin)}</td>
      <td>${formatMetric(row.duracionP90Min)}</td>
    `;
    timeBySupervisorTableBody.appendChild(tr);
  });
}

function formatMetric(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function setMessage(message, type) {
  indicadoresMessage.textContent = message;
  indicadoresMessage.className = "status-slot mt-3";
  if (type) {
    indicadoresMessage.classList.add(type);
  }
}
