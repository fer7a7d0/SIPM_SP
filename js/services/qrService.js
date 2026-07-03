import { apiRequest } from "./apiClient.js";

export async function validateQrCode(token, qrCode) {
  return apiRequest("qr.validate", { token, qrCode });
}
