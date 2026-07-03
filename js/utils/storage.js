export function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function removeItem(key) {
  localStorage.removeItem(key);
}
