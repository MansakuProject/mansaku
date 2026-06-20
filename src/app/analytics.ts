type GtagFunction = (
  command: "event",
  eventName: string,
  params?: Record<string, unknown>
) => void;

declare global {
  interface Window {
    gtag?: GtagFunction;
    __MANSAKU_DISABLE_ANALYTICS__?: boolean;
  }
}

function isAnalyticsTestMode(): boolean {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("test") === "1";
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

function isAnalyticsDisabled(): boolean {
  if (typeof window === "undefined") return true;

  return (
    window.__MANSAKU_DISABLE_ANALYTICS__ === true ||
    isLocalhost() ||
    isAnalyticsTestMode()
  );
}

function trackEvent(
  eventName: string,
  params: Record<string, unknown> = {}
): void {
  if (isAnalyticsDisabled()) return;

  window.gtag?.("event", eventName, {
    debug_mode: true,
    ...params,
  });
}

let appOpenTracked = false;

export function initializeAnalytics(): void {
  // index.html 側でGA公式タグを読み込むため、ここでは何もしない
}

export function trackAppOpen(): void {
  if (appOpenTracked) return;
  appOpenTracked = true;
  trackEvent("app_open");
}

export function trackPageAdd(): void {
  trackEvent("page_add");
}

export function trackFrameAdd(): void {
  trackEvent("frame_add");
}

export function trackBubbleAdd(): void {
  trackEvent("bubble_add");
}

export function trackSoundAdd(): void {
  trackEvent("sound_add");
}

export function trackImageInsert(): void {
  trackEvent("image_insert");
}

export function trackSaveProject(): void {
  trackEvent("save_project");
}

export function trackExportPng(): void {
  trackEvent("export_png");
}

export function trackExportPdf(): void {
  trackEvent("export_pdf");
}

export function trackReviewPromptShow(exportType: "png" | "pdf" | null): void {
  trackEvent("review_prompt_show", { export_type: exportType });
}

export function trackReviewPromptClose(exportType: "png" | "pdf" | null): void {
  trackEvent("review_prompt_close", { export_type: exportType });
}

export function trackReviewPromptDismissForever(exportType: "png" | "pdf" | null): void {
  trackEvent("review_prompt_dismiss_forever", { export_type: exportType });
}

export function trackReviewSubmit(rating: number, exportType: "png" | "pdf" | null): void {
  trackEvent("review_submit", { rating, export_type: exportType });
}

export function trackReviewSubmitSuccess(rating: number, exportType: "png" | "pdf" | null): void {
  trackEvent("review_submit_success", { rating, export_type: exportType });
}

export {};

export function trackMosaicAdd(): void {
  trackEvent("mosaic_add");
}
