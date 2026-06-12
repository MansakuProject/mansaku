import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import { AdminPage } from "./AdminPage";
import { LandingPage } from "./lp/LandingPage";

declare global {
  interface Window {
    __MANSAKU_TEST_MODE__?: boolean;
    __MANSAKU_DISABLE_ANALYTICS__?: boolean;
  }
}

function isTestModeUrl() {
  return new URLSearchParams(window.location.search).get("test") === "1";
}

function isLocalhost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1" ||
    window.location.hostname === "[::1]"
  );
}

function initializeRuntimeFlags() {
  const isTestMode = isTestModeUrl();

  if (isTestMode) {
    try {
      sessionStorage.setItem("mansaku_test_mode", "1");
    } catch {
      // noop
    }
  }

  let isStoredTestMode = false;

  try {
    isStoredTestMode = sessionStorage.getItem("mansaku_test_mode") === "1";
  } catch {
    // noop
  }

  window.__MANSAKU_TEST_MODE__ = isTestMode || isStoredTestMode;
  window.__MANSAKU_DISABLE_ANALYTICS__ =
    isLocalhost() || window.__MANSAKU_TEST_MODE__;
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function Root() {
  initializeRuntimeFlags();

  const pathname = normalizePathname(window.location.pathname);

  if (pathname === "/app") {
    return <App />;
  }

  if (pathname === "/admin") {
    return <AdminPage />;
  }

  return <LandingPage />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);