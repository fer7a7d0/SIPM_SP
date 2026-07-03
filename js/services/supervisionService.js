import { STORAGE_KEYS } from "../config.js";
import { getJson, removeItem, setJson } from "../utils/storage.js";
import { apiRequest } from "./apiClient.js";

export async function startSupervision(payload) {
  const data = await apiRequest("supervision.start", payload);
  setJson(STORAGE_KEYS.activeSupervision, data.supervision);
  return data.supervision;
}

export async function getChecklist(payload) {
  const data = await apiRequest("supervision.getChecklist", payload);
  return data;
}

export async function saveSupervision(payload) {
  const data = await apiRequest("supervision.save", payload);
  return data;
}

export function getActiveSupervision() {
  return getJson(STORAGE_KEYS.activeSupervision);
}

export function updateActiveSupervision(patch) {
  const current = getActiveSupervision() || {};
  const merged = {
    ...current,
    ...patch
  };
  setJson(STORAGE_KEYS.activeSupervision, merged);
  return merged;
}

export function clearActiveSupervision() {
  removeItem(STORAGE_KEYS.activeSupervision);
}
