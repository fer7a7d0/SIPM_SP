import { STORAGE_KEYS } from "../config.js";
import { getJson, removeItem, setJson } from "../utils/storage.js";
import { apiRequest } from "./apiClient.js";

export async function login(userId) {
  const data = await apiRequest("auth.login", { userId });
  setJson(STORAGE_KEYS.session, data.session);
  return data.session;
}

export async function verifySession() {
  const session = getSession();
  if (!session || !session.token) {
    return null;
  }

  try {
    const data = await apiRequest("auth.session", { token: session.token });
    return data.session;
  } catch (error) {
    clearSession();
    return null;
  }
}

export function getSession() {
  return getJson(STORAGE_KEYS.session);
}

export function clearSession() {
  removeItem(STORAGE_KEYS.session);
}

export async function logout() {
  const session = getSession();
  if (session && session.token) {
    try {
      await apiRequest("auth.logout", { token: session.token });
    } catch (error) {
      // No bloquea el cierre local de sesion.
    }
  }
  clearSession();
}
