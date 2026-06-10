import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import { LandingPage } from "./LandingPage";
import { LegalPage } from "./LegalPage";
import { AdminPage } from "./AdminPage";

function Root() {
  if (window.location.pathname === "/app") {
    return <App />;
  }

  if (window.location.pathname === "/admin") {
    return <AdminPage />;
  }

  if (window.location.pathname === "/legal") {
    return <LegalPage />;
  }

  return <LandingPage />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
