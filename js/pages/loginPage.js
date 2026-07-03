import "../router.js";
import { ROUTES } from "../config.js";
import { login } from "../services/authService.js";
import { validateUserId } from "../utils/validators.js";

const form = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

form.addEventListener("submit", onSubmit);

async function onSubmit(event) {
  event.preventDefault();

  const validation = validateUserId(userIdInput.value);
  if (!validation.ok) {
    setMessage(validation.message, "error");
    return;
  }

  try {
    loginButton.disabled = true;
    setMessage("Validando usuario...", "");

    await login(validation.value);
    setMessage("Acceso correcto. Redirigiendo...", "success");

    window.location.replace(ROUTES.dashboard);
  } catch (error) {
    setMessage(error.message || "No se pudo iniciar sesion.", "error");
  } finally {
    loginButton.disabled = false;
  }
}

function setMessage(message, type) {
  loginMessage.textContent = message;
  loginMessage.className = "status-slot mt-3";
  if (type) {
    loginMessage.classList.add(type);
  }
}
