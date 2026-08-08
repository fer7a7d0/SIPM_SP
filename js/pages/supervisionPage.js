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
let checklistGroups = [];
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
      token: session.token,
      areaId: activeSupervision.areaId
    };
    if (activeSupervision.id) {
      checklistPayload.supervisionId = activeSupervision.id;
    }

    const data = await getChecklist({
      ...checklistPayload
    });

    checklistGroups = data.checklists || [];
    checklistQuestions = data.questions || [];
    if (data.area && data.area.name) {
      areaNameEl.textContent = data.area.name;
    }
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
      checklistId: question.checklistId || "",
      checklistName: question.checklistName || "",
      sectionId: question.sectionId || "",
      sectionName: question.sectionName || "",
      requiresComment: Boolean(question.requiresComment),
      requiresPhoto: Boolean(question.requiresPhoto),
      obligatory: question.obligatory !== false
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

  const groups = checklistGroups.length > 0 ? checklistGroups : [
    {
      id: "LEGACY-GENERAL",
      name: "Preguntas generales",
      description: "",
      sections: [
        {
          id: "LEGACY-SECTION",
          name: "General",
          questions: checklistQuestions
        }
      ]
    }
  ];

  groups.forEach((group) => {
    const groupCard = document.createElement("section");
    groupCard.className = "checklist-group";

    const header = document.createElement("div");
    header.className = "checklist-group-head";

    const title = document.createElement("h3");
    title.className = "checklist-group-title";
    title.textContent = group.name || "Checklist";

    header.appendChild(title);

    if (group.description) {
      const description = document.createElement("p");
      description.className = "checklist-group-description";
      description.textContent = group.description;
      header.appendChild(description);
    }

    groupCard.appendChild(header);

    (group.sections || []).forEach((section) => {
      const sectionCard = document.createElement("div");
      sectionCard.className = "section-card";

      const sectionTitle = document.createElement("h4");
      sectionTitle.className = "section-title";
      sectionTitle.textContent = section.name || "Seccion";
      sectionCard.appendChild(sectionTitle);

      (section.questions || []).forEach((question) => {
        sectionCard.appendChild(createQuestionCard(question));
      });

      groupCard.appendChild(sectionCard);
    });

    checklistContainer.appendChild(groupCard);
  });
}

function createQuestionCard(question) {
  const questionIndex = checklistQuestions.findIndex((item) => item.id === question.id);
  const state = answerState[question.id];
  const wrapper = document.createElement("article");
  wrapper.className = "question-card";

  const title = document.createElement("p");
  title.className = "question-title";
  title.textContent = `${questionIndex + 1}. ${question.question}`;

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
  select.value = state.response;
  select.addEventListener("change", () => {
    state.response = select.value;
    persistDraft();
    recalculateCounters();
  });

  const comment = document.createElement("textarea");
  comment.className = "form-control mt-2";
  comment.rows = 2;
  comment.placeholder = question.requiresComment ? "Comentario obligatorio" : "Comentario opcional";
  comment.value = state.comment;
  comment.addEventListener("input", () => {
    state.comment = comment.value;
    persistDraft();
  });

  const photoInputId = `photoInput-${question.id}`;

  const photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.capture = "environment";
  photoInput.id = photoInputId;
  photoInput.className = "photo-input";

  const photoButton = document.createElement("label");
  photoButton.className = "btn btn-outline-dark w-100 photo-action mt-2";
  photoButton.setAttribute("for", photoInputId);
  photoButton.textContent = "Agregar foto";

  const preview = document.createElement("img");
  preview.className = "photo-preview";
  preview.alt = "Vista previa de evidencia";
  preview.hidden = !state.photoDataUrl;
  if (state.photoDataUrl) {
    preview.src = state.photoDataUrl;
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await toCompressedDataUrl(file);
      state.photoDataUrl = dataUrl;
      preview.src = dataUrl;
      preview.hidden = false;
      persistDraft();
      recalculateCounters();
    } catch (error) {
      setMessage("No se pudo cargar la fotografia.", "error");
    }
  });

  wrapper.appendChild(title);
  if (requiresWrap.childElementCount > 0) {
    wrapper.appendChild(requiresWrap);
  }
  wrapper.appendChild(select);
  wrapper.appendChild(comment);
  wrapper.appendChild(photoButton);
  wrapper.appendChild(photoInput);
  wrapper.appendChild(preview);

  return wrapper;
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

    if (!item.response && item.obligatory) {
      return { ok: false, message: `Falta responder la pregunta ${index}.` };
    }

    if (item.response && question && question.requiresComment && !String(item.comment || "").trim()) {
      return { ok: false, message: `La pregunta ${index} requiere comentario.` };
    }

    if (item.response && question && question.requiresPhoto && !item.photoDataUrl) {
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
    checklistGroups,
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
