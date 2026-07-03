export function getCurrentPosition(options = {}) {
  if (!navigator.geolocation) {
    throw new Error("El dispositivo no soporta geolocalizacion.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => {
        reject(new Error("No fue posible obtener la ubicacion GPS."));
      },
      {
        enableHighAccuracy: true,
        timeout: options.timeoutMs || 12000,
        maximumAge: 0
      }
    );
  });
}

export function formatGps(position) {
  if (!position) {
    return "";
  }

  const lat = Number(position.latitude).toFixed(6);
  const lon = Number(position.longitude).toFixed(6);
  return `${lat},${lon}`;
}
