import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

type AdminTab = "dashboard" | "reviews" | "contacts";
type ReviewFilter = "all" | "open" | "approved" | "rejected" | "blocked";

type AdminSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
  };
};

type AdminReview = {
  id: number | string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  allow_publish: boolean | null;
  approved: boolean | null;
  rejected?: boolean | null;
  source: string | null;
  app_version?: string | null;
  export_type?: string | null;
  developer_comment?: string | null;
  developer_comment_visible?: boolean | null;
  created_at: string | null;
};

type AdminContactMessage = {
  id: number | string;
  name: string | null;
  email: string | null;
  category: string | null;
  message: string | null;
  app_version?: string | null;
  resolved: boolean | null;
  created_at: string | null;
  reply_memo?: string | null;
  replied_at?: string | null;
};

const ADMIN_SESSION_STORAGE_KEY = "mansaku_admin_session_v1";
const ADMIN_EMAIL = "mansakuproject@gmail.com";

function getSupabaseConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  return { url, anonKey };
}

function readStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as AdminSession;
    if (!session.access_token || !session.refresh_token) return null;

    return session;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AdminSession | null) {
  if (!session) {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getContactCategoryLabel(category: string | null) {
  switch (category) {
    case "bug":
      return "不具合報告";
    case "request":
      return "要望";
    case "question":
      return "質問";
    case "other":
      return "その他";
    default:
      return category || "-";
  }
}

function buildContactReplyCopyText(contact: AdminContactMessage) {
  const email = contact.email?.trim() || "-";
  const replyMemo = contact.reply_memo?.trim() || "";

  return `宛先:
${email}

件名:
Mansakuお問い合わせ返信

本文:
お問い合わせありがとうございます。

────────────────
種別
${getContactCategoryLabel(contact.category)}

内容
${contact.message || "（内容なし）"}
────────────────

返信:
${replyMemo}
`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function getReviewStatus(review: AdminReview) {
  return review.approved || review.rejected ? "対応済み" : "未対応";
}

async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<AdminSession> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
    }),
  });

  if (!response.ok) {
    throw new Error("ログインできませんでした。");
  }

  const body = await response.json();

  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600),
    user: {
      id: body.user?.id ?? "",
      email: body.user?.email,
    },
  };
}

async function refreshSession(session: AdminSession): Promise<AdminSession> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: session.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error("セッションを更新できませんでした。");
  }

  const body = await response.json();

  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600),
    user: {
      id: body.user?.id ?? session.user.id,
      email: body.user?.email ?? session.user.email,
    },
  };
}

async function getValidSession(session: AdminSession): Promise<AdminSession> {
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at - now > 60) return session;

  const refreshed = await refreshSession(session);
  writeStoredSession(refreshed);
  return refreshed;
}

async function fetchAdminReviews(session: AdminSession): Promise<AdminReview[]> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const select = [
    "id",
    "rating",
    "comment",
    "display_name",
    "allow_publish",
    "approved",
    "rejected",
    "source",
    "app_version",
    "export_type",
    "developer_comment",
    "developer_comment_visible",
    "created_at",
  ].join(",");

  const response = await fetch(
    `${url}/rest/v1/reviews?select=${encodeURIComponent(select)}&order=created_at.desc&limit=200`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`レビューを取得できませんでした。${response.status}`);
  }

  return await response.json();
}

async function updateReviewApproved(params: {
  session: AdminSession;
  reviewId: number | string;
  approved: boolean;
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(
    `${url}/rest/v1/reviews?id=eq.${encodeURIComponent(String(params.reviewId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        approved: params.approved,
        rejected: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`掲載状態を更新できませんでした。${response.status}`);
  }
}

async function updateReviewRejected(params: {
  session: AdminSession;
  reviewId: number | string;
  rejected: boolean;
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(
    `${url}/rest/v1/reviews?id=eq.${encodeURIComponent(String(params.reviewId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        approved: false,
        rejected: params.rejected,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`不承認状態を更新できませんでした。${response.status}`);
  }
}

async function updateReviewDecision(params: {
  session: AdminSession;
  reviewId: number | string;
  decision: "open" | "approved" | "rejected";
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(
    `${url}/rest/v1/reviews?id=eq.${encodeURIComponent(String(params.reviewId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        approved: params.decision === "approved",
        rejected: params.decision === "rejected",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`レビュー対応状態を更新できませんでした。${response.status}`);
  }
}


async function updateReviewDeveloperReply(params: {
  session: AdminSession;
  reviewId: number | string;
  developerReply: string;
  developerReplyVisible: boolean;
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const trimmedReply = params.developerReply.trim();

  const response = await fetch(
    `${url}/rest/v1/reviews?id=eq.${encodeURIComponent(String(params.reviewId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        developer_comment: trimmedReply.length > 0 ? trimmedReply : null,
        developer_comment_visible: trimmedReply.length > 0 ? params.developerReplyVisible : false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`開発者コメントを更新できませんでした。${response.status}`);
  }

  return {
    developer_comment: trimmedReply.length > 0 ? trimmedReply : null,
    developer_comment_visible: trimmedReply.length > 0 ? params.developerReplyVisible : false,
  };
}

async function fetchAdminContactMessages(session: AdminSession): Promise<AdminContactMessage[]> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const select = [
    "id",
    "name",
    "email",
    "category",
    "message",
    "app_version",
    "resolved",
    "reply_memo",
    "replied_at",
    "created_at",
  ].join(",");

  const response = await fetch(
    `${url}/rest/v1/contact_messages?select=${encodeURIComponent(select)}&order=created_at.desc&limit=200`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`問い合わせを取得できませんでした。${response.status}`);
  }

  return await response.json();
}

async function updateContactResolved(params: {
  session: AdminSession;
  contactId: number | string;
  resolved: boolean;
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(
    `${url}/rest/v1/contact_messages?id=eq.${encodeURIComponent(String(params.contactId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        resolved: params.resolved,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`対応状態を更新できませんでした。${response.status}`);
  }
}

async function updateContactReplyMemo(params: {
  session: AdminSession;
  contactId: number | string;
  replyMemo: string;
}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const trimmedMemo = params.replyMemo.trim();
  const repliedAt = trimmedMemo.length > 0 ? new Date().toISOString() : null;

  const response = await fetch(
    `${url}/rest/v1/contact_messages?id=eq.${encodeURIComponent(String(params.contactId))}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${params.session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        reply_memo: trimmedMemo.length > 0 ? trimmedMemo : null,
        replied_at: repliedAt,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`返信メモを更新できませんでした。${response.status}`);
  }

  return {
    reply_memo: trimmedMemo.length > 0 ? trimmedMemo : null,
    replied_at: repliedAt,
  };
}

export function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());

  useEffect(() => {
    document.title = "Mansaku - 管理画面";
  }, []);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [contacts, setContacts] = useState<AdminContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [savingContactId, setSavingContactId] = useState<number | string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<"all" | "open" | "resolved">("all");
  const [contactSearch, setContactSearch] = useState("");

  const reviewCounts = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((review) => !!review.approved).length;
    const publishAllowed = reviews.filter((review) => !!review.allow_publish).length;
    const rejected = reviews.filter((review) => !!review.rejected).length;
    const open = reviews.filter(
      (review) => !review.approved && !review.rejected
    ).length;
    const blocked = reviews.filter((review) => !review.allow_publish).length;

    return { total, approved, publishAllowed, open, rejected, blocked };
  }, [reviews]);

  const contactCounts = useMemo(() => {
    const total = contacts.length;
    const resolved = contacts.filter((contact) => !!contact.resolved).length;
    const open = contacts.filter((contact) => !contact.resolved).length;

    return { total, resolved, open };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const keyword = contactSearch.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (contactFilter === "open" && contact.resolved) return false;
      if (contactFilter === "resolved" && !contact.resolved) return false;
      if (!keyword) return true;

      const searchText = [
        contact.name,
        contact.email,
        contact.category,
        contact.message,
        contact.app_version,
        formatDateTime(contact.created_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(keyword);
    });
  }, [contactFilter, contactSearch, contacts]);

  const filteredReviews = useMemo(() => {
    const keyword = reviewSearch.trim().toLowerCase();

    return reviews.filter((review) => {
      if (reviewFilter === "open" && (review.approved || review.rejected)) {
        return false;
      }

      if (reviewFilter === "approved" && !review.approved) {
        return false;
      }

      if (reviewFilter === "rejected" && !review.rejected) {
        return false;
      }

      if (reviewFilter === "blocked" && review.allow_publish) {
        return false;
      }

      if (!keyword) return true;

      const searchText = [
        review.display_name,
        review.comment,
        review.developer_comment,
        review.source,
        review.export_type,
        review.app_version,
        formatDateTime(review.created_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(keyword);
    });
  }, [reviewFilter, reviewSearch, reviews]);

  const loadAdminData = async (currentSession = session) => {
    if (!currentSession) return;

    setLoading(true);
    setError(null);

    try {
      const validSession = await getValidSession(currentSession);
      setSession(validSession);

      const [nextReviews, nextContacts] = await Promise.all([
        fetchAdminReviews(validSession),
        fetchAdminContactMessages(validSession),
      ]);

      setReviews(nextReviews);
      setContacts(nextContacts);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "管理データを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    void loadAdminData(session);
  }, []);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const nextSession = await loginWithPassword({
        email: email.trim(),
        password,
      });

      writeStoredSession(nextSession);
      setSession(nextSession);
      setPassword("");
      setMessage("ログインしました。");

      const [nextReviews, nextContacts] = await Promise.all([
        fetchAdminReviews(nextSession),
        fetchAdminContactMessages(nextSession),
      ]);
      setReviews(nextReviews);
      setContacts(nextContacts);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "ログインできませんでした。");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    writeStoredSession(null);
    setSession(null);
    setReviews([]);
    setContacts([]);
    setMessage("ログアウトしました。");
    setError(null);
  };

  const handleToggleApproved = async (review: AdminReview) => {
    if (!session) return;

    const nextApproved = !review.approved;

    if (nextApproved && !review.allow_publish) {
      const ok = window.confirm(
        "投稿者がLP掲載を許可していません。それでも掲載ONにしますか？"
      );
      if (!ok) return;
    }

    setSavingId(review.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      await updateReviewApproved({
        session: validSession,
        reviewId: review.id,
        approved: nextApproved,
      });

      setReviews((prev) =>
        prev.map((item) =>
          item.id === review.id ? { ...item, approved: nextApproved, rejected: false } : item
        )
      );

      setMessage(nextApproved ? "レビューを承認してLP掲載をONにしました。" : "レビューを未対応に戻しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "掲載状態を更新できませんでした。");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleRejected = async (review: AdminReview) => {
    if (!session) return;

    const nextRejected = !review.rejected;

    setSavingId(review.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      await updateReviewRejected({
        session: validSession,
        reviewId: review.id,
        rejected: nextRejected,
      });

      setReviews((prev) =>
        prev.map((item) =>
          item.id === review.id
            ? { ...item, approved: false, rejected: nextRejected }
            : item
        )
      );

      setMessage(nextRejected ? "レビューを不承認にしました。" : "レビューを未対応に戻しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "不承認状態を更新できませんでした。");
    } finally {
      setSavingId(null);
    }
  };

  const handleSetReviewDecision = async (
    review: AdminReview,
    decision: "open" | "approved" | "rejected"
  ) => {
    if (!session) return;

    if (decision === "approved" && !review.allow_publish) {
      setError("投稿者がLP掲載を許可していないため、承認できません。");
      return;
    }

    setSavingId(review.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      await updateReviewDecision({
        session: validSession,
        reviewId: review.id,
        decision,
      });

      setReviews((prev) =>
        prev.map((item) =>
          item.id === review.id
            ? {
                ...item,
                approved: decision === "approved",
                rejected: decision === "rejected",
              }
            : item
        )
      );

      setMessage(
        decision === "approved"
          ? "レビューを承認して対応済みにしました。"
          : decision === "rejected"
          ? "レビューを拒否して対応済みにしました。"
          : "レビューを未対応に戻しました。"
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "レビュー対応状態を更新できませんでした。");
    } finally {
      setSavingId(null);
    }
  };


  const handleSaveReviewDeveloperReply = async (params: {
    review: AdminReview;
    developerReply: string;
    developerReplyVisible: boolean;
  }) => {
    if (!session) return;

    setSavingId(params.review.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      const updated = await updateReviewDeveloperReply({
        session: validSession,
        reviewId: params.review.id,
        developerReply: params.developerReply,
        developerReplyVisible: params.developerReplyVisible,
      });

      setReviews((prev) =>
        prev.map((item) =>
          item.id === params.review.id
            ? {
                ...item,
                developer_comment: updated.developer_comment,
                developer_comment_visible: updated.developer_comment_visible,
              }
            : item
        )
      );

      setMessage("開発者コメントを保存しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "開発者コメントを保存できませんでした。");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleContactResolved = async (contact: AdminContactMessage) => {
    if (!session) return;

    const nextResolved = !contact.resolved;

    setSavingContactId(contact.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      await updateContactResolved({
        session: validSession,
        contactId: contact.id,
        resolved: nextResolved,
      });

      setContacts((prev) =>
        prev.map((item) =>
          item.id === contact.id ? { ...item, resolved: nextResolved } : item
        )
      );

      setMessage(nextResolved ? "問い合わせを対応済みにしました。" : "問い合わせを未対応に戻しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "対応状態を更新できませんでした。");
    } finally {
      setSavingContactId(null);
    }
  };

  const handleSaveContactReplyMemo = async (params: {
    contact: AdminContactMessage;
    replyMemo: string;
  }) => {
    if (!session) return;

    setSavingContactId(params.contact.id);
    setError(null);
    setMessage(null);

    try {
      const validSession = await getValidSession(session);
      setSession(validSession);

      const updated = await updateContactReplyMemo({
        session: validSession,
        contactId: params.contact.id,
        replyMemo: params.replyMemo,
      });

      setContacts((prev) =>
        prev.map((item) =>
          item.id === params.contact.id
            ? {
                ...item,
                reply_memo: updated.reply_memo,
                replied_at: updated.replied_at,
              }
            : item
        )
      );

      setMessage("返信メモを保存しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "返信メモを保存できませんでした。");
    } finally {
      setSavingContactId(null);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.3 }}>
              Mansaku - 管理画面
            </h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
              レビューと問い合わせを管理します。
            </p>
          </div>

          <a href="/" style={linkStyle}>
            LPへ戻る
          </a>
        </header>

        {message && <MessageBox kind="success">{message}</MessageBox>}
        {error && <MessageBox kind="error">{error}</MessageBox>}

        {!session ? (
          <LoginPanel
            email={email}
            password={password}
            loading={loading}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
          />
        ) : (
          <div style={adminLayoutStyle}>
            <aside style={sideNavStyle}>
              <div style={loginInfoStyle}>
                <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 800 }}>
                  Mansaku管理
                </div>
                <div style={{ color: "#111827", fontSize: 13, fontWeight: 900 }}>
                  {session.user.email || ADMIN_EMAIL}
                </div>
              </div>

              <nav style={{ display: "grid", gap: 6 }}>
                <NavButton
                  active={activeTab === "dashboard"}
                  label="ダッシュボード"
                  onClick={() => setActiveTab("dashboard")}
                />
                <NavButton
                  active={activeTab === "reviews"}
                  label="レビュー"
                  badge={reviewCounts.open}
                  onClick={() => setActiveTab("reviews")}
                />
                <NavButton
                  active={activeTab === "contacts"}
                  label="問い合わせ"
                  badge={contactCounts.open}
                  onClick={() => setActiveTab("contacts")}
                />
              </nav>

              <div style={{ display: "grid", gap: 8, marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => void loadAdminData()}
                  disabled={loading}
                  style={secondaryButtonStyle}
                >
                  更新
                </button>
                <button type="button" onClick={handleLogout} style={secondaryButtonStyle}>
                  ログアウト
                </button>
              </div>
            </aside>

            <section style={contentStyle}>
              {activeTab === "dashboard" && (
                <DashboardPanel
                  counts={reviewCounts}
                  contactCounts={contactCounts}
                  loading={loading}
                  onOpenReviews={() => setActiveTab("reviews")}
                  onOpenContacts={() => setActiveTab("contacts")}
                />
              )}

              {activeTab === "reviews" && (
                <ReviewPanel
                  reviews={filteredReviews}
                  totalCount={reviews.length}
                  filter={reviewFilter}
                  search={reviewSearch}
                  loading={loading}
                  savingId={savingId}
                  onFilterChange={setReviewFilter}
                  onSearchChange={setReviewSearch}
                  onSetDecision={handleSetReviewDecision}
                  onSaveDeveloperReply={handleSaveReviewDeveloperReply}
                />
              )}

              {activeTab === "contacts" && (
                <ContactPanel
                  contacts={filteredContacts}
                  totalCount={contacts.length}
                  filter={contactFilter}
                  search={contactSearch}
                  savingId={savingContactId}
                  onFilterChange={setContactFilter}
                  onSearchChange={setContactSearch}
                  onToggleResolved={handleToggleContactResolved}
                  onSaveReplyMemo={handleSaveContactReplyMemo}
                />
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function LoginPanel({
  email,
  password,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  email: string;
  password: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={loginPanelStyle}>
      <h2 style={{ margin: 0, fontSize: 20 }}>管理者ログイン</h2>

      <label style={formLabelStyle}>
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="username"
          required
          style={inputStyle}
        />
      </label>

      <label style={formLabelStyle}>
        パスワード
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="current-password"
          required
          style={inputStyle}
        />
      </label>

      <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
        {loading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}

function DashboardPanel({
  counts,
  contactCounts,
  loading,
  onOpenReviews,
  onOpenContacts,
}: {
  counts: {
    total: number;
    approved: number;
    publishAllowed: number;
    open: number;
    rejected: number;
    blocked: number;
  };
  contactCounts: {
    total: number;
    resolved: number;
    open: number;
  };
  loading: boolean;
  onOpenReviews: () => void;
  onOpenContacts: () => void;
}) {
  return (
    <div style={panelRootStyle}>
      <div>
        <h2 style={panelTitleStyle}>ダッシュボード</h2>
        <p style={panelDescriptionStyle}>
          Mansakuの管理状況を確認します。
        </p>
      </div>

      <div style={statusGridStyle}>
        <StatusCard label="総レビュー" value={counts.total} />
        <StatusCard label="未対応レビュー" value={counts.open} tone={counts.open > 0 ? "warning" : "normal"} />
        <StatusCard label="承認レビュー" value={counts.approved} />
        <StatusCard label="不承認レビュー" value={counts.rejected} />
        <StatusCard label="投稿者掲載不可" value={counts.blocked} />
        <StatusCard label="問い合わせ件数" value={contactCounts.total} />
        <StatusCard label="未対応問い合わせ" value={contactCounts.open} tone={contactCounts.open > 0 ? "warning" : "normal"} />
      </div>

      <div style={panelCardStyle}>
        <h3 style={{ margin: 0, fontSize: 17 }}>レビュー承認</h3>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.7, fontSize: 14 }}>
          投稿者がLP掲載を許可したレビューのうち、未対応のものを確認できます。
        </p>
        <button type="button" onClick={onOpenReviews} style={primaryInlineButtonStyle}>
          レビュー管理を開く
        </button>
      </div>

      <div style={panelCardStyle}>
        <h3 style={{ margin: 0, fontSize: 17 }}>問い合わせ管理</h3>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.7, fontSize: 14 }}>
          問い合わせ一覧と対応済み状態を確認できます。
        </p>
        <button type="button" onClick={onOpenContacts} style={primaryInlineButtonStyle}>
          問い合わせ管理を開く
        </button>
      </div>

      {loading && <div style={smallMutedStyle}>読み込み中...</div>}
    </div>
  );
}

function ReviewPanel({
  reviews,
  totalCount,
  filter,
  search,
  loading,
  savingId,
  onFilterChange,
  onSearchChange,
  onSetDecision,
  onSaveDeveloperReply,
}: {
  reviews: AdminReview[];
  totalCount: number;
  filter: ReviewFilter;
  search: string;
  loading: boolean;
  savingId: number | string | null;
  onFilterChange: (value: ReviewFilter) => void;
  onSearchChange: (value: string) => void;
  onSetDecision: (review: AdminReview, decision: "open" | "approved" | "rejected") => void;
  onSaveDeveloperReply: (params: {
    review: AdminReview;
    developerReply: string;
    developerReplyVisible: boolean;
  }) => void;
}) {
  return (
    <div style={panelRootStyle}>
      <div>
        <h2 style={panelTitleStyle}>レビュー管理</h2>
        <p style={panelDescriptionStyle}>
          行ごとにLP掲載状態を切り替えます。
        </p>
      </div>

      <div style={toolbarStyle}>
        <div style={filterGroupStyle}>
          <FilterButton active={filter === "all"} onClick={() => onFilterChange("all")}>
            全件
          </FilterButton>
          <FilterButton active={filter === "open"} onClick={() => onFilterChange("open")}>
            未対応
          </FilterButton>
          <FilterButton active={filter === "approved"} onClick={() => onFilterChange("approved")}>
            承認
          </FilterButton>
          <FilterButton active={filter === "rejected"} onClick={() => onFilterChange("rejected")}>
            拒否
          </FilterButton>
          <FilterButton active={filter === "blocked"} onClick={() => onFilterChange("blocked")}>
            投稿許可NG
          </FilterButton>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="名前・コメントで検索"
          style={searchInputStyle}
        />
      </div>

      <div style={summaryLineStyle}>
        表示中 {reviews.length} 件 / 全 {totalCount} 件
      </div>

      {loading && totalCount === 0 ? (
        <div style={emptyStyle}>読み込み中...</div>
      ) : reviews.length === 0 ? (
        <div style={emptyStyle}>条件に一致するレビューはありません。</div>
      ) : (
        <div style={reviewTableWrapStyle}>
          <table style={reviewTableStyle}>
            <thead>
              <tr>
                <StickyLeftTh>状態</StickyLeftTh>
                <Th style={ratingColumnStyle}>評価</Th>
                <Th style={dateColumnStyle}>投稿日</Th>
                <Th style={versionColumnStyle}>Ver</Th>
                <Th style={nameColumnStyle}>名前</Th>
                <Th style={commentColumnStyle}>コメント</Th>
                <Th style={developerReplyColumnStyle}>開発者コメント</Th>
                <Th style={reviewAllowColumnStyle}>投稿者許可</Th>
                <Th style={reviewActionColumnStyle}>対応</Th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <StickyLeftTd>
                    <StatusPill review={review} />
                  </StickyLeftTd>
                  <Td style={ratingColumnStyle}>
                    <StarRating rating={review.rating} />
                  </Td>
                  <Td style={dateColumnStyle}>{formatDateTime(review.created_at)}</Td>
                  <Td style={versionColumnStyle}>{review.app_version ? `v${review.app_version}` : "-"}</Td>
                  <Td style={nameColumnStyle}>
                    <div style={nameCellStyle}>
                      {review.display_name || "匿名"}
                    </div>
                  </Td>
                  <Td style={commentColumnStyle}>
                    <div style={commentCellStyle}>
                      {review.comment || "（コメントなし）"}
                    </div>
                  </Td>
                  <Td style={developerReplyColumnStyle}>
                    <DeveloperReplyEditor
                      review={review}
                      saving={savingId === review.id}
                      onSave={onSaveDeveloperReply}
                    />
                  </Td>
                  <Td style={reviewAllowColumnStyle}>
                    <BoolPill value={!!review.allow_publish} trueLabel="OK" falseLabel="NG" />
                  </Td>
                  <Td style={reviewActionColumnStyle}>
                    <div style={decisionButtonGroupStyle}>
                      <button
                        type="button"
                        onClick={() =>
                          onSetDecision(review, review.approved ? "open" : "approved")
                        }
                        disabled={savingId === review.id || !review.allow_publish}
                        title={!review.allow_publish ? "投稿者が掲載を許可していません" : undefined}
                        style={decisionButtonStyle(
                          !!review.approved,
                          savingId === review.id || !review.allow_publish,
                          "approved"
                        )}
                      >
                        承認
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetDecision(review, review.rejected ? "open" : "rejected")
                        }
                        disabled={savingId === review.id}
                        style={decisionButtonStyle(
                          !!review.rejected,
                          savingId === review.id,
                          "rejected"
                        )}
                      >
                        拒否
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function DeveloperReplyEditor({
  review,
  saving,
  onSave,
}: {
  review: AdminReview;
  saving: boolean;
  onSave: (params: {
    review: AdminReview;
    developerReply: string;
    developerReplyVisible: boolean;
  }) => void;
}) {
  const [developerReply, setDeveloperReply] = useState(review.developer_comment ?? "");
  const [developerReplyVisible, setDeveloperReplyVisible] = useState(
    !!review.developer_comment_visible
  );

  useEffect(() => {
    setDeveloperReply(review.developer_comment ?? "");
    setDeveloperReplyVisible(!!review.developer_comment_visible);
  }, [review.id, review.developer_comment, review.developer_comment_visible]);

  const trimmedReply = developerReply.trim();
  const changed =
    trimmedReply !== (review.developer_comment ?? "") ||
    developerReplyVisible !== !!review.developer_comment_visible;

  return (
    <div style={developerReplyEditorStyle}>
      <textarea
        value={developerReply}
        onChange={(e) => setDeveloperReply(e.target.value)}
        placeholder="修正しました、対応予定です、など"
        rows={3}
        style={developerReplyTextareaStyle}
      />

      <label style={developerReplyVisibleLabelStyle}>
        <input
          type="checkbox"
          checked={developerReplyVisible}
          disabled={trimmedReply.length === 0}
          onChange={(e) => setDeveloperReplyVisible(e.target.checked)}
        />
        LPに表示
      </label>

      <button
        type="button"
        disabled={saving || !changed}
        onClick={() =>
          onSave({
            review,
            developerReply,
            developerReplyVisible,
          })
        }
        style={developerReplySaveButtonStyle(saving || !changed)}
      >
        {saving ? "保存中" : "保存"}
      </button>
    </div>
  );
}

function ContactPanel({
  contacts,
  totalCount,
  filter,
  search,
  savingId,
  onFilterChange,
  onSearchChange,
  onToggleResolved,
  onSaveReplyMemo,
}: {
  contacts: AdminContactMessage[];
  totalCount: number;
  filter: "all" | "open" | "resolved";
  search: string;
  savingId: number | string | null;
  onFilterChange: (value: "all" | "open" | "resolved") => void;
  onSearchChange: (value: string) => void;
  onToggleResolved: (contact: AdminContactMessage) => void;
  onSaveReplyMemo: (params: {
    contact: AdminContactMessage;
    replyMemo: string;
  }) => void;
}) {
  return (
    <div style={panelRootStyle}>
      <div>
        <h2 style={panelTitleStyle}>問い合わせ管理</h2>
        <p style={panelDescriptionStyle}>
          問い合わせを表形式で確認し、対応済み状態を切り替えます。
        </p>
      </div>

      <div style={toolbarStyle}>
        <div style={filterGroupStyle}>
          <FilterButton active={filter === "all"} onClick={() => onFilterChange("all")}>
            全件
          </FilterButton>
          <FilterButton active={filter === "open"} onClick={() => onFilterChange("open")}>
            未対応
          </FilterButton>
          <FilterButton active={filter === "resolved"} onClick={() => onFilterChange("resolved")}>
            対応済み
          </FilterButton>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="名前・メール・内容で検索"
          style={searchInputStyle}
        />
      </div>

      <div style={summaryLineStyle}>
        表示中 {contacts.length} 件 / 全 {totalCount} 件
      </div>

      {contacts.length === 0 ? (
        <div style={emptyStyle}>条件に一致する問い合わせはありません。</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <StickyLeftTh>状態</StickyLeftTh>
                <Th style={dateColumnStyle}>投稿日</Th>
                <Th style={versionColumnStyle}>Ver</Th>
                <Th style={nameColumnStyle}>名前</Th>
                <Th style={emailColumnStyle}>メール</Th>
                <Th style={categoryColumnStyle}>カテゴリ</Th>
                <Th style={commentColumnStyle}>内容</Th>
                <Th style={contactReplyMemoColumnStyle}>返信メモ</Th>
                <Th style={actionColumnStyle}>対応</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <StickyLeftTd>
                    <span
                      style={{
                        ...pillBaseStyle,
                        background: contact.resolved ? "#ecfdf5" : "#fffbeb",
                        color: contact.resolved ? "#047857" : "#92400e",
                        border: contact.resolved ? "1px solid #a7f3d0" : "1px solid #fde68a",
                      }}
                    >
                      {contact.resolved ? "対応済み" : "未対応"}
                    </span>
                  </StickyLeftTd>
                  <Td style={dateColumnStyle}>
                    {formatDateTime(contact.created_at)}
                  </Td>

                  <Td style={versionColumnStyle}>
                    {contact.app_version ? `v${contact.app_version}` : "-"}
                  </Td>

                  <Td style={nameColumnStyle}>
                    <div style={nameCellStyle}>
                      {contact.name || "匿名"}
                    </div>
                  </Td>

                  <Td style={emailColumnStyle}>
                    <ContactEmailCell contact={contact} />
                  </Td>

                  <Td style={categoryColumnStyle}>
                    {getContactCategoryLabel(contact.category)}
                  </Td>

                  <Td style={commentColumnStyle}>
                    <div style={commentCellStyle}>
                      {contact.message || "（内容なし）"}
                    </div>
                  </Td>

                  <Td style={contactReplyMemoColumnStyle}>
                    <ContactReplyMemoEditor
                      contact={contact}
                      saving={savingId === contact.id}
                      onSave={onSaveReplyMemo}
                    />
                  </Td>

                  <Td style={actionColumnStyle}>
                    <button
                      type="button"
                      onClick={() => onToggleResolved(contact)}
                      disabled={savingId === contact.id}
                      style={approvalButtonStyle(!!contact.resolved, savingId === contact.id)}
                    >
                      {savingId === contact.id ? "更新中" : contact.resolved ? "対応済み" : "対応する"}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContactEmailCell({ contact }: { contact: AdminContactMessage }) {
  const email = contact.email?.trim();

  if (!email) {
    return <span>-</span>;
  }

  return (
    <div style={emailCellStyle}>
      <div style={emailTextStyle}>{email}</div>
      <div style={emailActionGroupStyle}>
        <button
          type="button"
          onClick={() => {
            void copyTextToClipboard(buildContactReplyCopyText(contact));
          }}
          style={emailActionButtonStyle}
        >
          返信内容をコピー
        </button>
      </div>
    </div>
  );
}

function ContactReplyMemoEditor({
  contact,
  saving,
  onSave,
}: {
  contact: AdminContactMessage;
  saving: boolean;
  onSave: (params: {
    contact: AdminContactMessage;
    replyMemo: string;
  }) => void;
}) {
  const [replyMemo, setReplyMemo] = useState(contact.reply_memo ?? "");

  useEffect(() => {
    setReplyMemo(contact.reply_memo ?? "");
  }, [contact.id, contact.reply_memo]);

  const trimmedMemo = replyMemo.trim();
  const changed = trimmedMemo !== (contact.reply_memo ?? "");

  return (
    <div style={replyMemoEditorStyle}>
      {contact.replied_at && (
        <div style={replyMemoDateStyle}>
          返信日時: {formatDateTime(contact.replied_at)}
        </div>
      )}

      <textarea
        value={replyMemo}
        onChange={(e) => setReplyMemo(e.target.value)}
        placeholder="Gmailで返信した内容をメモ"
        rows={3}
        style={replyMemoTextareaStyle}
      />

      <button
        type="button"
        disabled={saving || !changed}
        onClick={() =>
          onSave({
            contact,
            replyMemo,
          })
        }
        style={replyMemoSaveButtonStyle(saving || !changed)}
      >
        {saving ? "保存中" : "保存"}
      </button>
    </div>
  );
}

function NavButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={navButtonStyle(active)}>
      <span>{label}</span>
      {badge != null && badge > 0 && <span style={badgeStyle}>{badge}</span>}
    </button>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={filterButtonStyle(active)}>
      {children}
    </button>
  );
}

function StatusCard({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "warning";
}) {
  return (
    <div
      style={{
        border: tone === "warning" ? "1px solid #fbbf24" : "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "14px 16px",
        background: tone === "warning" ? "#fffbeb" : "#ffffff",
        minWidth: 140,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#111827", fontSize: 28, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function StatusPill({ review }: { review: AdminReview }) {
  const status = getReviewStatus(review);

  const styleByStatus: Record<string, CSSProperties> = {
    対応済み: {
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    },
    未対応: {
      background: "#fffbeb",
      color: "#92400e",
      border: "1px solid #fde68a",
    },
  };

  return <span style={{ ...pillBaseStyle, ...styleByStatus[status] }}>{status}</span>;
}

function BoolPill({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <span
      style={{
        ...pillBaseStyle,
        background: value ? "#ecfdf5" : "#f3f4f6",
        color: value ? "#047857" : "#6b7280",
        border: value ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
      }}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(5, Math.floor(rating)));

  return (
    <span aria-label={`${safeRating} / 5`} style={starStyle}>
      {"★".repeat(safeRating)}
      <span style={{ color: "#d1d5db" }}>
        {"★".repeat(5 - safeRating)}
      </span>
    </span>
  );
}

function MessageBox({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: kind === "success" ? "#ecfdf5" : "#fef2f2",
        color: kind === "success" ? "#065f46" : "#991b1b",
        border: kind === "success" ? "1px solid #a7f3d0" : "1px solid #fecaca",
        borderRadius: 12,
        padding: "8px 10px",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return <th style={{ ...thStyle, ...style }}>{children}</th>;
}

function StickyLeftTh({ children }: { children: React.ReactNode }) {
  return <th style={{ ...thStyle, ...stickyLeftHeaderStyle }}>{children}</th>;
}

function StickyReviewAllowTh({ children }: { children: React.ReactNode }) {
  return <th style={{ ...thStyle, ...stickyReviewAllowHeaderStyle }}>{children}</th>;
}

function StickyRightTh({ children }: { children: React.ReactNode }) {
  return <th style={{ ...thStyle, ...stickyRightHeaderStyle }}>{children}</th>;
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return <td style={{ ...tdStyle, ...style }}>{children}</td>;
}

function StickyLeftTd({ children }: { children: React.ReactNode }) {
  return <td style={{ ...tdStyle, ...stickyLeftCellStyle }}>{children}</td>;
}

function StickyReviewAllowTd({ children }: { children: React.ReactNode }) {
  return <td style={{ ...tdStyle, ...stickyReviewAllowCellStyle }}>{children}</td>;
}

function StickyRightTd({ children }: { children: React.ReactNode }) {
  return <td style={{ ...tdStyle, ...stickyRightCellStyle }}>{children}</td>;
}

const ADMIN_HEADER_HEIGHT = 88;
const ADMIN_PAGE_SIDE_PADDING = 24;
const ADMIN_SIDEBAR_WIDTH = 220;
const ADMIN_LAYOUT_GAP = 18;

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  color: "#111827",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const shellStyle: CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  padding: `${ADMIN_HEADER_HEIGHT + 20}px ${ADMIN_PAGE_SIDE_PADDING}px 64px`,
  display: "grid",
  gap: 20,
};

const headerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 100,
  width: `calc(100% - ${ADMIN_PAGE_SIDE_PADDING * 2}px)`,
  maxWidth: 1440,
  minHeight: ADMIN_HEADER_HEIGHT,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  padding: "16px 0",
  background: "rgba(243, 244, 246, 0.96)",
  borderBottom: "1px solid #e5e7eb",
  backdropFilter: "blur(10px)",
};

const linkStyle: CSSProperties = {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 14,
};

const adminLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${ADMIN_SIDEBAR_WIDTH}px minmax(0, 1fr)`,
  gap: ADMIN_LAYOUT_GAP,
  alignItems: "start",
};

const sideNavStyle: CSSProperties = {
  position: "fixed",
  top: ADMIN_HEADER_HEIGHT + 20,
  left: `max(${ADMIN_PAGE_SIDE_PADDING}px, calc((100vw - 1440px) / 2 + ${ADMIN_PAGE_SIDE_PADDING}px))`,
  zIndex: 50,
  width: ADMIN_SIDEBAR_WIDTH,
  boxSizing: "border-box",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 14,
  minHeight: 420,
  maxHeight: `calc(100vh - ${ADMIN_HEADER_HEIGHT + 38}px)`,
  overflowY: "auto",
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const loginInfoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 10px 12px",
  borderRadius: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  overflowWrap: "anywhere",
};

const contentStyle: CSSProperties = {
  gridColumn: 2,
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const loginPanelStyle: CSSProperties = {
  maxWidth: 420,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 20,
  display: "grid",
  gap: 14,
  boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
};

const formLabelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  height: 40,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 10px",
  font: "inherit",
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 42,
    border: "none",
    borderRadius: 12,
    background: disabled ? "#9ca3af" : "#111827",
    color: "#ffffff",
    font: "inherit",
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
  };
}

const primaryInlineButtonStyle: CSSProperties = {
  width: "fit-content",
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: "#111827",
  color: "#ffffff",
  font: "inherit",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

function navButtonStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 40,
    padding: "0 10px",
    borderRadius: 12,
    border: "none",
    background: active ? "#111827" : "transparent",
    color: active ? "#ffffff" : "#374151",
    font: "inherit",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    textAlign: "left",
  };
}

const badgeStyle: CSSProperties = {
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  borderRadius: 999,
  background: "#ef4444",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 900,
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  lineHeight: 1.35,
};

const panelDescriptionStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#6b7280",
  fontSize: 14,
};

const statusGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};

const panelCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#f9fafb",
};

const smallMutedStyle: CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 800,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const filterGroupStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

function filterButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: active ? "1px solid #111827" : "1px solid #d1d5db",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#374151",
    font: "inherit",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  };
}

const searchInputStyle: CSSProperties = {
  minWidth: 220,
  height: 36,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 10px",
  font: "inherit",
  fontSize: 13,
};

const summaryLineStyle: CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 800,
};

const tableWrapStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 1568,
  tableLayout: "fixed",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "#ffffff",
};

const REVIEW_ACTION_COLUMN_WIDTH = 156;
const REVIEW_ALLOW_COLUMN_WIDTH = 104;

const panelRootStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  width: "100%",
  boxSizing: "border-box",
};

const reviewTableWrapStyle: CSSProperties = {
  ...tableWrapStyle,
  width: "100%",
};

const reviewTableStyle: CSSProperties = {
  ...tableStyle,
  minWidth: 1388,
};

const reviewAllowColumnStyle: CSSProperties = {
  width: REVIEW_ALLOW_COLUMN_WIDTH,
  minWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  maxWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  textAlign: "center",
};

const developerReplyColumnStyle: CSSProperties = {
  width: 260,
  minWidth: 260,
  maxWidth: 260,
};

const reviewActionColumnStyle: CSSProperties = {
  width: REVIEW_ACTION_COLUMN_WIDTH,
  minWidth: REVIEW_ACTION_COLUMN_WIDTH,
  maxWidth: REVIEW_ACTION_COLUMN_WIDTH,
  textAlign: "center",
};

const thStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "#f9fafb",
  color: "#374151",
  fontSize: 12,
  fontWeight: 900,
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  boxSizing: "border-box",
  padding: "9px 10px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
  fontSize: 13,
  lineHeight: 1.5,
};

const stickyLeftHeaderStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  left: 0,
  zIndex: 5,
  width: 96,
  minWidth: 96,
  maxWidth: 96,
  borderRight: "2px solid #d1d5db",
  boxShadow: "4px 0 8px rgba(15,23,42,0.08)",
};

const stickyReviewAllowHeaderStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  right: REVIEW_ACTION_COLUMN_WIDTH,
  zIndex: 20,
  width: REVIEW_ALLOW_COLUMN_WIDTH,
  minWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  maxWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  textAlign: "center",
  background: "#f9fafb",
  borderLeft: "2px solid #d1d5db",
  borderRight: "1px solid #e5e7eb",
  boxShadow: "-4px 0 8px rgba(15,23,42,0.08)",
};

const stickyRightHeaderStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  right: 0,
  zIndex: 21,
  width: REVIEW_ACTION_COLUMN_WIDTH,
  minWidth: REVIEW_ACTION_COLUMN_WIDTH,
  maxWidth: REVIEW_ACTION_COLUMN_WIDTH,
  textAlign: "center",
  background: "#f9fafb",
  borderLeft: "1px solid #e5e7eb",
  boxShadow: "-4px 0 8px rgba(15,23,42,0.08)",
};

const stickyLeftCellStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  left: 0,
  zIndex: 2,
  width: 96,
  minWidth: 96,
  maxWidth: 96,
  background: "#ffffff",
  borderRight: "2px solid #d1d5db",
  boxShadow: "4px 0 8px rgba(15,23,42,0.06)",
};

const stickyReviewAllowCellStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  right: REVIEW_ACTION_COLUMN_WIDTH,
  zIndex: 20,
  width: REVIEW_ALLOW_COLUMN_WIDTH,
  minWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  maxWidth: REVIEW_ALLOW_COLUMN_WIDTH,
  background: "#ffffff",
  textAlign: "center",
  borderLeft: "2px solid #d1d5db",
  borderRight: "1px solid #e5e7eb",
  boxShadow: "-4px 0 8px rgba(15,23,42,0.06)",
};

const stickyRightCellStyle: CSSProperties = {
  boxSizing: "border-box",
  position: "sticky",
  right: 0,
  zIndex: 21,
  width: REVIEW_ACTION_COLUMN_WIDTH,
  minWidth: REVIEW_ACTION_COLUMN_WIDTH,
  maxWidth: REVIEW_ACTION_COLUMN_WIDTH,
  background: "#ffffff",
  textAlign: "center",
  borderLeft: "1px solid #e5e7eb",
  boxShadow: "-4px 0 8px rgba(15,23,42,0.06)",
};

const ratingColumnStyle: CSSProperties = {
  width: 86,
  minWidth: 86,
  maxWidth: 86,
};

const versionColumnStyle: CSSProperties = {
  width: 72,
  minWidth: 72,
  maxWidth: 72,
  whiteSpace: "nowrap",
};

const nameColumnStyle: CSSProperties = {
  width: 120,
  minWidth: 120,
  maxWidth: 120,
  overflowWrap: "anywhere",
};

const dateColumnStyle: CSSProperties = {
  width: 132,
  minWidth: 132,
  maxWidth: 132,
  whiteSpace: "nowrap",
};

const sourceColumnStyle: CSSProperties = {
  width: 120,
  minWidth: 120,
  maxWidth: 120,
  overflowWrap: "anywhere",
};

const allowColumnStyle: CSSProperties = {
  width: 96,
  minWidth: 96,
  maxWidth: 96,
};

const categoryColumnStyle: CSSProperties = {
  width: 110,
  minWidth: 110,
  maxWidth: 110,
  overflowWrap: "anywhere",
};

const emailColumnStyle: CSSProperties = {
  width: 190,
  minWidth: 190,
  maxWidth: 190,
  overflowWrap: "anywhere",
};

const contactReplyMemoColumnStyle: CSSProperties = {
  width: 260,
  minWidth: 260,
  maxWidth: 260,
};

const actionColumnStyle: CSSProperties = {
  width: 120,
  minWidth: 120,
  maxWidth: 120,
  textAlign: "center",
};

const commentColumnStyle: CSSProperties = {
  width: "auto",
  minWidth: 360,
};

const nameCellStyle: CSSProperties = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const emailCellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  whiteSpace: "normal",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const emailTextStyle: CSSProperties = {
  color: "#374151",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const emailActionGroupStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const emailActionButtonStyle: CSSProperties = {
  minHeight: 26,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  font: "inherit",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const commentCellStyle: CSSProperties = {
  maxWidth: 520,
  maxHeight: 92,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  color: "#374151",
};

const pillBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const starStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: 15,
  letterSpacing: 1,
  lineHeight: 1,
  fontWeight: 900,
  whiteSpace: "nowrap",
};


const developerReplyEditorStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const developerReplyTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 70,
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "8px 9px",
  font: "inherit",
  fontSize: 12,
  lineHeight: 1.5,
  color: "#111827",
  background: "#ffffff",
};

const developerReplyVisibleLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 800,
};

function developerReplySaveButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: "fit-content",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: "none",
    background: disabled ? "#e5e7eb" : "#111827",
    color: disabled ? "#9ca3af" : "#ffffff",
    font: "inherit",
    fontSize: 12,
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
  };
}

const decisionButtonGroupStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "nowrap",
};

function decisionButtonStyle(
  active: boolean,
  disabled: boolean,
  kind: "open" | "approved" | "rejected"
): CSSProperties {
  const activeBackground =
    kind === "approved" ? "#2563eb" : kind === "rejected" ? "#dc2626" : "#111827";
  const inactiveBackground =
    kind === "approved" ? "#dbeafe" : kind === "rejected" ? "#fee2e2" : "#e5e7eb";
  const inactiveColor =
    kind === "approved" ? "#1d4ed8" : kind === "rejected" ? "#991b1b" : "#374151";

  return {
    minHeight: 30,
    minWidth: 52,
    padding: "0 8px",
    borderRadius: 999,
    border: "none",
    background: active ? activeBackground : inactiveBackground,
    color: active ? "#ffffff" : inactiveColor,
    font: "inherit",
    fontSize: 12,
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.42 : 1,
    whiteSpace: "nowrap",
  };
}

function approvalButtonStyle(approved: boolean, saving: boolean): CSSProperties {
  return {
    minHeight: 32,
    minWidth: 52,
    padding: "0 10px",
    borderRadius: 999,
    border: "none",
    background: approved ? "#2563eb" : "#d1d5db",
    color: approved ? "#ffffff" : "#111827",
    font: "inherit",
    fontSize: 13,
    fontWeight: 900,
    cursor: saving ? "default" : "pointer",
    opacity: saving ? 0.6 : 1,
  };
}

function rejectButtonStyle(rejected: boolean, saving: boolean): CSSProperties {
  return {
    minHeight: 32,
    minWidth: 66,
    padding: "0 10px",
    borderRadius: 999,
    border: "none",
    background: rejected ? "#dc2626" : "#fee2e2",
    color: rejected ? "#ffffff" : "#991b1b",
    font: "inherit",
    fontSize: 13,
    fontWeight: 900,
    cursor: saving ? "default" : "pointer",
    opacity: saving ? 0.6 : 1,
  };
}

const replyMemoEditorStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const replyMemoDateStyle: CSSProperties = {
  color: "#6b7280",
  fontSize: 11,
  fontWeight: 800,
};

const replyMemoTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 70,
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "8px 9px",
  font: "inherit",
  fontSize: 12,
  lineHeight: 1.5,
  color: "#111827",
  background: "#ffffff",
};

function replyMemoSaveButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: "fit-content",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: "none",
    background: disabled ? "#e5e7eb" : "#111827",
    color: disabled ? "#9ca3af" : "#ffffff",
    font: "inherit",
    fontSize: 12,
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
  };
}

const emptyStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  color: "#6b7280",
  fontWeight: 800,
};
