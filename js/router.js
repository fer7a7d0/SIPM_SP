import { ROUTES } from "./config.js";
import { getSession } from "./services/authService.js";

const protectedPages = new Set(["dashboard.html", "escaner.html", "supervision.html", "resumen.html", "historial.html"]);

(function guardRoute() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  const session = getSession();

  if (protectedPages.has(current) && !session) {
    window.location.replace(ROUTES.login);
    return;
  }

  if (current === "login.html" && session) {
    window.location.replace(ROUTES.dashboard);
  }
})();
