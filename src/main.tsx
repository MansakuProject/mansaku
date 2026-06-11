import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import { LandingPage } from "./LandingPage";
import { LegalPage } from "./LegalPage";
import { AdminPage } from "./AdminPage";

declare global {
  interface Window {
    __MANSAKU_TEST_MODE__?: boolean;
    __MANSAKU_DISABLE_ANALYTICS__?: boolean;
  }
}

function isTestModeUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("test") === "1";
}

function isLocalHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

function initializeTestModeFlags() {
  const isTestMode = isTestModeUrl();

  if (isTestMode) {
    window.__MANSAKU_TEST_MODE__ = true;
    window.__MANSAKU_DISABLE_ANALYTICS__ = true;

    try {
      sessionStorage.setItem("mansaku_test_mode", "1");
    } catch {}
  }

  if (isLocalHost()) {
    window.__MANSAKU_DISABLE_ANALYTICS__ = true;
  }
}

function Root() {
  initializeTestModeFlags();

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/app") {
    return <App />;
  }

  if (pathname === "/admin") {
    return <AdminPage />;
  }

  if (pathname === "/legal") {
    return <LegalPage />;
  }

  return <LandingPage />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);