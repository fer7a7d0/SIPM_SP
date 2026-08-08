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
const trendChart = document.getElementById("trendChart");
const trendChartEmpty = document.getElementById("trendChartEmpty");
const trendChartSummary = document.getElementById("trendChartSummary");
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
  trendChart.innerHTML = "";

  if (!rows.length) {
    trendChart.hidden = true;
    trendChartEmpty.hidden = false;
    trendChartSummary.textContent = "Hallazgos diarios del periodo.";
    return;
  }

  trendChart.hidden = false;
  trendChartEmpty.hidden = true;

  const points = rows.map((row) => ({
    date: String(row.date || ""),
    hallazgos: Number(row.hallazgos || 0)
  }));

  const totalHallazgos = points.reduce((sum, item) => sum + item.hallazgos, 0);
  const maxValue = Math.max(...points.map((item) => item.hallazgos), 0, 1);
  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 48, left: 42 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const steps = points.length > 1 ? points.length - 1 : 1;
  const lineColor = "#c04b8d";
  const pointFill = "#ffffff";
  const axisColor = "#8a627f";
  const gridColor = "rgba(122, 47, 112, 0.18)";
  const textColor = "#6e5b6a";

  trendChartSummary.textContent = `Total del periodo: ${totalHallazgos} hallazgos.`;

  const yTicks = buildTrendTicks(maxValue);
  const svgParts = [];
  svgParts.push(`<svg viewBox="0 0 ${width} ${height}" class="trend-chart-svg" role="img" aria-label="Grafica de linea y puntos de hallazgos por dia">`);

  yTicks.forEach((tick) => {
    const y = padding.top + innerHeight - (tick / maxValue) * innerHeight;
    svgParts.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="trend-grid-line" />`);
    svgParts.push(`<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="trend-axis-label">${tick}</text>`);
  });

  svgParts.push(`<line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}" class="trend-axis-line" />`);

  const polylinePoints = points.map((item, index) => {
    const x = padding.left + (index / steps) * innerWidth;
    const y = padding.top + innerHeight - (item.hallazgos / maxValue) * innerHeight;
    return `${x},${y}`;
  }).join(" ");

  svgParts.push(`<polyline fill="none" points="${polylinePoints}" class="trend-line" />`);

  points.forEach((item, index) => {
    const x = padding.left + (index / steps) * innerWidth;
    const y = padding.top + innerHeight - (item.hallazgos / maxValue) * innerHeight;
    const label = formatTrendDate(item.date);

    svgParts.push(`<circle cx="${x}" cy="${y}" r="5" class="trend-point" />`);
    svgParts.push(`<text x="${x}" y="${padding.top + innerHeight + 22}" text-anchor="middle" class="trend-axis-label">${label}</text>`);
    svgParts.push(`<text x="${x}" y="${y - 10}" text-anchor="middle" class="trend-value-label">${item.hallazgos}</text>`);
  });

  svgParts.push("</svg>");
  trendChart.innerHTML = svgParts.join("");
}

function buildTrendTicks(maxValue) {
  if (maxValue <= 1) {
    return [0, 1];
  }

  var tickCount = 4;
  var step = Math.ceil(maxValue / tickCount);
  var ticks = [];

  for (var value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }

  return ticks;
}

function formatTrendDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return raw || "-";
  }
  return `${match[3]}/${match[2]}`;
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
