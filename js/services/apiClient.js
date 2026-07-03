import { APP_CONFIG } from "../config.js";

export async function apiRequest(action, payload = {}) {
  if (!APP_CONFIG.apiBaseUrl || APP_CONFIG.apiBaseUrl.startsWith("REEMPLAZAR_")) {
    throw new Error("Configura la URL del Web App en js/config.js");
  }

  const response = await fetch(APP_CONFIG.apiBaseUrl, {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error("No se pudo conectar con el servidor.");
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Error de negocio.");
  }

  return data.data;
}
