export function formatDateEs(dateValue) {
  const date = new Date(dateValue || Date.now());
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function formatTimeEs(dateValue) {
  const date = new Date(dateValue || Date.now());
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
