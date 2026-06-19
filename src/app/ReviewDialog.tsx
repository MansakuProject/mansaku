import { APP_VERSION } from "../appInfo";
import { useEffect, useMemo, useState } from "react";

export type ReviewExportType = "png" | "pdf" | null;
export type ReviewSource = "app" | "lp";

export type ReviewSubmitPayload = {
  rating: number;
  comment: string;
  display_name: string;
  allow_publish: boolean;
  source: ReviewSource;
  app_version?: string;
  export_type?: ReviewExportType;
};

export type PublicMansakuReview = {
  id: string;
  rating: number;
  comment: string;
  display_name: string;
  created_at: string;
  source: ReviewSource;
  app_version: string | null;
  export_type: ReviewExportType;
};

export type MansakuReviewSummary = {
  count: number;
  averageRating: number | null;
};

type ReviewSubmitState = "idle" | "sending" | "done" | "error";

export const REVIEW_LOCAL_STORAGE_KEYS = {
  lastShownAt: "mansaku.reviewLastShownAt",
  submittedAt: "mansaku.reviewSubmittedAt",
  submittedVersion: "mansaku.reviewSubmittedVersion",
  dismissedForever: "mansaku.reviewDismissedForever",
  localQueue: "mansaku.reviewLocalQueue",
} as const;

export function getReviewStorageItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setReviewStorageItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境では何もしない
  }
}

export function removeReviewStorageItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // 削除できない環境では何もしない
  }
}

export function clearReviewPromptMemory() {
  removeReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.lastShownAt);
  removeReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedAt);
  removeReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedVersion);
  removeReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.dismissedForever);
}

function getSupabaseReviewConfig() {
  const env = import.meta.env as Record<string, string | undefined>;

  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "",
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  };
}

export function isMansakuReviewBackendConfigured() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseReviewConfig();

  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

function buildSupabaseHeaders(supabaseAnonKey: string) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
}

export async function fetchApprovedMansakuReviews(
  limit = 6
): Promise<PublicMansakuReview[]> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseReviewConfig();

  if (!supabaseUrl || !supabaseAnonKey) return [];

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 24));
  const params = new URLSearchParams({
    select: "id,rating,comment,display_name,created_at,source,app_version,export_type",
    allow_publish: "eq.true",
    approved: "eq.true",
    order: "created_at.desc",
    limit: String(safeLimit),
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/reviews?${params}`, {
    method: "GET",
    headers: buildSupabaseHeaders(supabaseAnonKey),
  });

  if (!response.ok) {
    throw new Error(`review_fetch_failed:${response.status}`);
  }

  const rows = (await response.json()) as PublicMansakuReview[];

  return rows.filter(
    (row) =>
      Number.isFinite(row.rating) &&
      row.rating >= 1 &&
      row.rating <= 5 &&
      typeof row.comment === "string" &&
      row.comment.trim().length > 0
  );
}

export async function fetchMansakuReviewSummary(): Promise<MansakuReviewSummary> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseReviewConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { count: 0, averageRating: null };
  }

  const params = new URLSearchParams({
    select: "rating",
    allow_publish: "eq.true",
    approved: "eq.true",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/reviews?${params}`, {
    method: "GET",
    headers: buildSupabaseHeaders(supabaseAnonKey),
  });

  if (!response.ok) {
    throw new Error(`review_summary_fetch_failed:${response.status}`);
  }

  const rows = (await response.json()) as Pick<PublicMansakuReview, "rating">[];
  const ratings = rows
    .map((row) => row.rating)
    .filter((rating) => Number.isFinite(rating));

  if (ratings.length === 0) {
    return { count: 0, averageRating: null };
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);

  return {
    count: ratings.length,
    averageRating: total / ratings.length,
  };
}

export async function submitMansakuReview(payload: ReviewSubmitPayload) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseReviewConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    const saved = getReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.localQueue);
    const queue = saved ? (JSON.parse(saved) as ReviewSubmitPayload[]) : [];

    queue.push({
      ...payload,
      created_at: new Date().toISOString(),
    } as ReviewSubmitPayload & { created_at: string });

    setReviewStorageItem(
      REVIEW_LOCAL_STORAGE_KEYS.localQueue,
      JSON.stringify(queue),
    );
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/reviews`, {
    method: "POST",
    headers: {
      ...buildSupabaseHeaders(supabaseAnonKey),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      rating: payload.rating,
      comment: payload.comment,
      display_name: payload.display_name || "匿名ユーザー",
      allow_publish: payload.allow_publish,
      approved: false,
      source: payload.source,
      app_version: APP_VERSION,
      export_type: payload.export_type ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(`review_submit_failed:${response.status}`);
  }
}

function getReviewLabels(language: string | undefined) {
  if ((language ?? "ja").startsWith("ja")) {
    return {
      title: "Mansakuはいかがでしたか？",
      description:
        "よければ、評価と感想を送ってください。今後の改善に使います。",
      rating: "評価",
      comment: "コメント",
      commentPlaceholder: "使ってみた感想、よかった点、気になった点など",
      displayName: "表示名",
      displayNamePlaceholder: "匿名ユーザー",
      allowPublish: "サイトに掲載してもよい",
      publishNote: "掲載する場合も、承認後に公開します。",
      submit: "送信",
      later: "あとで",
      dismissForever: "今後表示しない",
      sending: "送信中...",
      done: "ありがとうございました。",
      error: "送信できませんでした。時間をおいて再度お試しください。",
      close: "閉じる",
    };
  }

  return {
    title: "How was Mansaku?",
    description: "Please send a rating and comment. It helps improve Mansaku.",
    rating: "Rating",
    comment: "Comment",
    commentPlaceholder: "What worked well? What felt confusing?",
    displayName: "Display name",
    displayNamePlaceholder: "Anonymous",
    allowPublish: "Allow this comment to be shown on the website",
    publishNote: "Comments are published only after approval.",
    submit: "Send",
    later: "Later",
    dismissForever: "Don't show again",
    sending: "Sending...",
    done: "Thank you.",
    error: "Could not send. Please try again later.",
    close: "Close",
  };
}

export function ReviewDialog({
  open,
  language = "ja",
  showDismissForever = false,
  onClose,
  onDismissForever,
  onSubmit,
}: {
  open: boolean;
  language?: string;
  showDismissForever?: boolean;
  onClose: () => void;
  onDismissForever?: () => void;
  onSubmit: (payload: Omit<ReviewSubmitPayload, "source">) => Promise<void>;
}) {
  const labels = useMemo(() => getReviewLabels(language), [language]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [allowPublish, setAllowPublish] = useState(true);
  const [submitState, setSubmitState] = useState<ReviewSubmitState>("idle");

  useEffect(() => {
    if (!open) return;

    setRating(5);
    setComment("");
    setDisplayName("");
    setAllowPublish(true);
    setSubmitState("idle");
  }, [open]);

  if (!open) return null;

  const isLocked = submitState === "sending" || submitState === "done";

  const handleSubmit = async () => {
    if (submitState === "sending") return;

    setSubmitState("sending");

    try {
      await onSubmit({
        rating,
        comment: comment.trim(),
        display_name: displayName.trim() || "匿名ユーザー",
        allow_publish: allowPublish,
      });

      setSubmitState("done");
      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      console.error(error);
      setSubmitState("error");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && submitState !== "sending") {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(17, 24, 39, 0.38)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
          padding: 22,
          boxSizing: "border-box",
          color: "#111827",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{labels.title}</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 1.6,
                color: "#4b5563",
              }}
            >
              {labels.description}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitState === "sending"}
            style={{
              width: 32,
              height: 32,
              border: "none",
              borderRadius: 8,
              background: "transparent",
              cursor: submitState === "sending" ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#374151",
              flexShrink: 0,
              fontSize: 22,
              lineHeight: 1,
            }}
            aria-label={labels.close}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.rating}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                disabled={submitState === "sending"}
                aria-label={`${value} / 5`}
                style={{
                  all: "unset",
                  width: 38,
                  height: 38,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  cursor: submitState === "sending" ? "default" : "pointer",
                  fontSize: 28,
                  lineHeight: 1,
                  color: value <= rating ? "#f59e0b" : "#d1d5db",
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.comment}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            disabled={isLocked}
            placeholder={labels.commentPlaceholder}
            style={{
              width: "100%",
              minHeight: 96,
              resize: "vertical",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              boxSizing: "border-box",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.6,
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.displayName}
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            disabled={isLocked}
            placeholder={labels.displayNamePlaceholder}
            style={{
              width: "100%",
              padding: "9px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              boxSizing: "border-box",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
            marginTop: 14,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#374151",
          }}
        >
          <input
            type="checkbox"
            checked={allowPublish}
            onChange={(e) => setAllowPublish(e.target.checked)}
            disabled={isLocked}
            style={{ marginTop: 3 }}
          />
          <span>
            {labels.allowPublish}
            <span style={{ display: "block", color: "#6b7280" }}>
              {labels.publishNote}
            </span>
          </span>
        </label>

        {submitState === "done" && (
          <div style={{ marginTop: 14, fontSize: 13, color: "#047857" }}>
            {labels.done}
          </div>
        )}

        {submitState === "error" && (
          <div style={{ marginTop: 14, fontSize: 13, color: "#b91c1c" }}>
            {labels.error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          {showDismissForever ? (
            <button
              type="button"
              onClick={onDismissForever}
              disabled={submitState === "sending"}
              style={{
                border: "none",
                background: "transparent",
                color: "#6b7280",
                fontSize: 13,
                cursor: submitState === "sending" ? "default" : "pointer",
                padding: "8px 0",
              }}
            >
              {labels.dismissForever}
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitState === "sending"}
              style={{
                minWidth: 88,
                height: 36,
                border: "1px solid #d1d5db",
                borderRadius: 10,
                background: "#ffffff",
                cursor: submitState === "sending" ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            >
              {labels.later}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitState === "sending" || submitState === "done"}
              style={{
                minWidth: 96,
                height: 36,
                border: "none",
                borderRadius: 10,
                background: submitState === "done" ? "#9ca3af" : "#2563eb",
                color: "#ffffff",
                cursor:
                  submitState === "sending" || submitState === "done"
                    ? "default"
                    : "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {submitState === "sending" ? labels.sending : labels.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
