import "../router.js";
import { ROUTES } from "../config.js";
import { getSession } from "../services/authService.js";
import { getActiveSupervision, getChecklist, updateActiveSupervision } from "../services/supervisionService.js";
import { formatTimeEs } from "../utils/dateTime.js";

const areaNameEl = document.getElementById("areaName");
const startTimeEl = document.getElementById("startTime");
const gpsTextEl = document.getElementById("gpsText");
const continueChecklistBtn = document.getElementById("continueChecklistBtn");
const supervisionMessage = document.getElementById("supervisionMessage");
const checklistContainer = document.getElementById("checklistContainer");
const answeredCountEl = document.getElementById("answeredCount");
const totalCountEl = document.getElementById("totalCount");
const photoCountEl = document.getElementById("photoCount");

const RESPONSE_OPTIONS = ["Cumple", "No cumple", "No aplica"];
const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_JPEG_QUALITY = 0.72;

let activeSupervision = null;
let checklistQuestions = [];
const answerState = {};

init();

async function init() {
  activeSupervision = getActiveSupervision();
  const session = getSession();

  if (!activeSupervision || !activeSupervision.areaId || !session || !session.token) {
    window.location.replace(ROUTES.dashboard);
    return;
  }

  areaNameEl.textContent = activeSupervision.areaName;
  startTimeEl.textContent = `Hora inicio: ${formatTimeEs(activeSupervision.startAt)}`;
  gpsTextEl.textContent = `GPS: ${activeSupervision.gps}`;

  continueChecklistBtn.addEventListener("click", onContinue);

  try {
    setMessage("Cargando checklist...", "");
    const checklistPayload = {
      token: session.token
    };
    if (activeSupervision.id) {
      checklistPayload.supervisionId = activeSupervision.id;
    }

    const data = await getChecklist({
      ...checklistPayload
    });

    checklistQuestions = data.questions || [];
    seedAnswerState(checklistQuestions, activeSupervision.answers || {});
    renderChecklist();
    recalculateCounters();
    setMessage("", "");
  } catch (error) {
    setMessage(error.message || "No se pudo cargar el checklist.", "error");
  }
}

function seedAnswerState(questions, existing) {
  questions.forEach((question) => {
    const prev = existing[question.id] || {};
    answerState[question.id] = {
      questionId: question.id,
      response: prev.response || "",
      comment: prev.comment || "",
      photoDataUrl: prev.photoDataUrl || "",
      requiresComment: Boolean(question.requiresComment),
      requiresPhoto: Boolean(question.requiresPhoto)
    };
  });
}

function renderChecklist() {
  checklistContainer.innerHTML = "";
  totalCountEl.textContent = String(checklistQuestions.length);

  if (checklistQuestions.length === 0) {
    checklistContainer.innerHTML = '<p class="text-muted mb-0">No hay preguntas configuradas.</p>';
    return;
  }

  checklistQuestions.forEach((question, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "question-card";

    const category = document.createElement("span");
    category.className = "question-category";
    category.textContent = question.category || "General";

    const title = document.createElement("p");
    title.className = "question-title";
    title.textContent = `${index + 1}. ${question.question}`;

    const requiresWrap = document.createElement("div");
    if (question.requiresComment) {
      const chip = document.createElement("span");
      chip.className = "required-chip";
      chip.textContent = "Obliga comentario";
      requiresWrap.appendChild(chip);
    }
    if (question.requiresPhoto) {
      const chip = document.createElement("span");
      chip.className = "required-chip";
      chip.textContent = "Obliga foto";
      requiresWrap.appendChild(chip);
    }

    const select = document.createElement("select");
    select.className = "form-select mt-2";
    select.innerHTML = '<option value="">Selecciona respuesta</option>';
    RESPONSE_OPTIONS.forEach((optionValue) => {
      const opt = document.createElement("option");
      opt.value = optionValue;
      opt.textContent = optionValue;
      select.appendChild(opt);
    });
    select.value = answerState[question.id].response;
    select.addEventListener("change", () => {
      answerState[question.id].response = select.value;
      persistDraft();
      recalculateCounters();
    });

    const comment = document.createElement("textarea");
    comment.className = "form-control mt-2";
    comment.rows = 2;
    comment.placeholder = question.requiresComment ? "Comentario obligatorio" : "Comentario opcional";
    comment.value = answerState[question.id].comment;
    comment.addEventListener("input", () => {
      answerState[question.id].comment = comment.value;
      persistDraft();
    });

    const photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*";
    photoInput.capture = "environment";
    photoInput.className = "form-control mt-2";
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) {
        return;
      }

      try {
        const dataUrl = await toCompressedDataUrl(file);
        answerState[question.id].photoDataUrl = dataUrl;
        preview.src = dataUrl;
        preview.hidden = false;
        persistDraft();
        recalculateCounters();
      } catch (error) {
        setMessage("No se pudo cargar la fotografia.", "error");
      }
    });

    const preview = document.createElement("img");
    preview.className = "photo-preview";
    preview.alt = "Vista previa de evidencia";
    preview.hidden = !answerState[question.id].photoDataUrl;
    if (answerState[question.id].photoDataUrl) {
      preview.src = answerState[question.id].photoDataUrl;
    }

    wrapper.appendChild(category);
    wrapper.appendChild(title);
    wrapper.appendChild(requiresWrap);
    wrapper.appendChild(select);
    wrapper.appendChild(comment);
    wrapper.appendChild(photoInput);
    wrapper.appendChild(preview);
    checklistContainer.appendChild(wrapper);
  });
}

function recalculateCounters() {
  const keys = Object.keys(answerState);
  const answered = keys.filter((key) => Boolean(answerState[key].response)).length;
  const photoCount = keys.filter((key) => Boolean(answerState[key].photoDataUrl)).length;
  answeredCountEl.textContent = String(answered);
  photoCountEl.textContent = `Fotos: ${photoCount}`;
}

function validateChecklist() {
  const questionsById = {};
  checklistQuestions.forEach((question) => {
    questionsById[question.id] = question;
  });

  const keys = Object.keys(answerState);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const item = answerState[key];
    const question = questionsById[key];
    const index = i + 1;

    if (!item.response) {
      return { ok: false, message: `Falta responder la pregunta ${index}.` };
    }

    if (question && question.requiresComment && !String(item.comment || "").trim()) {
      return { ok: false, message: `La pregunta ${index} requiere comentario.` };
    }

    if (question && question.requiresPhoto && !item.photoDataUrl) {
      return { ok: false, message: `La pregunta ${index} requiere fotografia.` };
    }
  }

  return { ok: true };
}

function onContinue() {
  const validation = validateChecklist();
  if (!validation.ok) {
    setMessage(validation.message, "error");
    return;
  }

  persistDraft();
  setMessage("Checklist validado. Continuamos al resumen.", "success");
  window.setTimeout(() => {
    window.location.href = ROUTES.resumen;
  }, 1200);
}

function persistDraft() {
  updateActiveSupervision({
    answers: answerState,
    totalQuestions: checklistQuestions.length,
    answeredQuestions: Object.values(answerState).filter((item) => Boolean(item.response)).length,
    photoCount: Object.values(answerState).filter((item) => Boolean(item.photoDataUrl)).length
  });
}

function toCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSide = Math.max(image.width || 1, image.height || 1);
        const ratio = Math.min(1, IMAGE_MAX_DIMENSION / maxSide);

        const targetWidth = Math.max(1, Math.round((image.width || 1) * ratio));
        const targetHeight = Math.max(1, Math.round((image.height || 1) * ratio));

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }

        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY));
      };

      image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      image.src = String(reader.result || "");
    };

    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function setMessage(message, type) {
  supervisionMessage.textContent = message;
  supervisionMessage.className = "status-slot mt-3";
  if (type) {
    supervisionMessage.classList.add(type);
  }
}
