import { apiRequest } from "./apiClient.js";

export async function searchHistory(payload) {
  return apiRequest("history.search", payload);
}

export async function getHistoryDetail(payload) {
  return apiRequest("history.detail", payload);
}
