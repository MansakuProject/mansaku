import { APP_VERSION } from "../version";
import { useEffect, useMemo, useState } from "react";

export type ContactSource = "lp" | "app";

export type ContactSubmitPayload = {
  name: string;
  email: string;
  category: string;
  message: string;
  source: ContactSource;
};

type ContactSubmitState = "idle" | "sending" | "done" | "error";

function getContactLabels(language: string | undefined) {
  if ((language ?? "ja").startsWith("ja")) {
    return {
      title: "お問い合わせ",
      description: "不具合報告、要望、質問などを送れます。返信が必要な場合はメールアドレスを入力してください。",
      name: "お名前",
      namePlaceholder: "任意",
      email: "メールアドレス",
      emailPlaceholder: "返信先メールアドレス",
      category: "種別",
      categories: [
        { value: "bug", label: "不具合報告" },
        { value: "request", label: "要望" },
        { value: "question", label: "質問" },
        { value: "other", label: "その他" },
      ],
      message: "内容",
      messagePlaceholder: "お問い合わせ内容を入力してください",
      submit: "送信",
      later: "閉じる",
      sending: "送信中...",
      done: "送信しました。ありがとうございました。",
      error: "送信できませんでした。時間をおいて再度お試しください。",
      close: "閉じる",
    };
  }

  return {
    title: "Contact",
    description: "Send bug reports, requests, or questions. Enter your email address if you need a reply.",
    name: "Name",
    namePlaceholder: "Optional",
    email: "Email",
    emailPlaceholder: "Reply email address",
    category: "Category",
    categories: [
      { value: "bug", label: "Bug report" },
      { value: "request", label: "Request" },
      { value: "question", label: "Question" },
      { value: "other", label: "Other" },
    ],
    message: "Message",
    messagePlaceholder: "Enter your message",
    submit: "Send",
    later: "Close",
    sending: "Sending...",
    done: "Sent. Thank you.",
    error: "Could not send. Please try again later.",
    close: "Close",
  };
}

export async function submitMansakuContact(payload: ContactSubmitPayload) {
  const env = import.meta.env as Record<string, string | undefined>;
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    const key = "mansaku.contactLocalQueue";
    const saved = localStorage.getItem(key);
    const queue = saved
      ? (JSON.parse(saved) as Array<ContactSubmitPayload & { created_at: string }>)
      : [];

    queue.push({
      ...payload,
      created_at: new Date().toISOString(),
    });

    localStorage.setItem(key, JSON.stringify(queue));
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/contact_messages`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: payload.name || null,
      email: payload.email,
      category: payload.category,
      message: payload.message,
      resolved: false,
      app_version: APP_VERSION,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`contact_submit_failed:${response.status}:${errorText}`);
  }
}

export function ContactDialog({
  open,
  language = "ja",
  onClose,
  onSubmit,
}: {
  open: boolean;
  language?: string;
  onClose: () => void;
  onSubmit: (payload: Omit<ContactSubmitPayload, "source">) => Promise<void>;
}) {
  const labels = useMemo(() => getContactLabels(language), [language]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<ContactSubmitState>("idle");

  useEffect(() => {
    if (!open) return;

    setName("");
    setEmail("");
    setCategory("bug");
    setMessage("");
    setSubmitState("idle");
  }, [open]);

  if (!open) return null;

  const isLocked = submitState === "sending" || submitState === "done";
  const canSubmit =
    email.trim().length > 0 &&
    message.trim().length > 0 &&
    submitState !== "sending" &&
    submitState !== "done";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitState("sending");

    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        category,
        message: message.trim(),
      });

      setSubmitState("done");
      window.setTimeout(() => {
        onClose();
      }, 1000);
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
          width: "min(500px, 100%)",
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

        <label style={{ display: "block", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.name}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            disabled={isLocked}
            placeholder={labels.namePlaceholder}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.email}
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.slice(0, 160))}
            disabled={isLocked}
            required
            placeholder={labels.emailPlaceholder}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.category}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isLocked}
            style={inputStyle}
          >
            {labels.categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {labels.message}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
            disabled={isLocked}
            placeholder={labels.messagePlaceholder}
            style={{
              ...inputStyle,
              minHeight: 130,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
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
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
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
            disabled={!canSubmit}
            style={{
              minWidth: 96,
              height: 36,
              border: "none",
              borderRadius: 10,
              background: canSubmit ? "#2563eb" : "#9ca3af",
              color: "#ffffff",
              cursor: canSubmit ? "pointer" : "default",
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
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  boxSizing: "border-box",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};