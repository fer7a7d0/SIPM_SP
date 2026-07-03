export function validateUserId(userId) {
  const value = String(userId || "").trim();

  if (!value) {
    return { ok: false, message: "Ingresa tu usuario." };
  }

  if (value.length < 4) {
    return { ok: false, message: "El usuario debe tener al menos 4 caracteres." };
  }

  return { ok: true, value: value.toUpperCase() };
}
