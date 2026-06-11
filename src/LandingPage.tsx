import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { ContactDialog, submitMansakuContact } from "./app/ContactDialog";
import {
  ReviewDialog,
  fetchMansakuReviewSummary,
  submitMansakuReview,
  type MansakuReviewSummary,
} from "./app/ReviewDialog";

type PublicMansakuReviewWithDeveloperReply = {
  id: number | string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  developer_comment?: string | null;
  developer_comment_visible?: boolean | null;
};

function getSupabaseConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  return { url, anonKey };
}

function isTestModeUrl() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);

  return (
    params.get("test") === "1" ||
    window.location.href.includes("?test=1") ||
    window.location.href.includes("&test=1")
  );
}

function getAppLinkHref(isTestMode: boolean) {
  return isTestMode ? "/app?test=1" : "/app";
}

function isLocalHost() {
  if (typeof window === "undefined") return false;

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function getAdminLinkHref(isTestMode: boolean) {
  return isTestMode ? "/admin?test=1" : "/admin";
}

async function fetchApprovedMansakuReviewsWithDeveloperReply(
  limit: number
): Promise<PublicMansakuReviewWithDeveloperReply[]> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return [];

  const select = [
    "id",
    "rating",
    "comment",
    "display_name",
    "developer_comment",
    "developer_comment_visible",
  ].join(",");

  const response = await fetch(
    `${url}/rest/v1/reviews?select=${encodeURIComponent(select)}&approved=eq.true&allow_publish=eq.true&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`review_fetch_failed:${response.status}`);
  }

  return await response.json();
}

export function LandingPage() {
  const isTestMode = isTestModeUrl();
  const isDeveloperLinkVisible = isTestMode || isLocalHost();
  const appLinkHref = getAppLinkHref(isTestMode);
  const adminLinkHref = getAdminLinkHref(isTestMode);

  useEffect(() => {
    document.title = isTestMode ? "Mansaku（テスト）" : "Mansaku";
  }, [isTestMode]);

  function isSupportedDesktopBrowser() {
    const ua = navigator.userAgent;

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(ua) ||
      navigator.maxTouchPoints > 1;

    if (isMobile) {
      return false;
    }

    const isChrome =
      /Chrome\//.test(ua) &&
      !/Edg\//.test(ua);

    const isEdge =
      /Edg\//.test(ua);

    return isChrome || isEdge;
  }

  function handleOpenApp(e: MouseEvent<HTMLAnchorElement>) {
    if (isSupportedDesktopBrowser()) {
      return;
    }

    e.preventDefault();
    setIsUnsupportedDeviceOpen(true);
  }

  const [isUnsupportedDeviceOpen, setIsUnsupportedDeviceOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const openReviewForm = () => {
    setIsReviewOpen(true);
  };

  const closeReviewForm = () => {
    setIsReviewOpen(false);
  };

  const openContactForm = () => {
    setIsContactOpen(true);
  };

  const closeContactForm = () => {
    setIsContactOpen(false);
  };

  const [publishedReviews, setPublishedReviews] = useState<PublicMansakuReviewWithDeveloperReply[]>([]);
  const [reviewSummary, setReviewSummary] = useState<MansakuReviewSummary>({
    count: 0,
    averageRating: null,
  });

  useEffect(() => {
    let cancelled = false;

    const loadPublishedReviews = async () => {
      try {
        const [reviews, summary] = await Promise.all([
          fetchApprovedMansakuReviewsWithDeveloperReply(6),
          fetchMansakuReviewSummary(),
        ]);

        if (cancelled) return;

        setPublishedReviews(reviews);
        setReviewSummary(summary);
      } catch (error) {
        console.error(error);

        if (cancelled) return;

        setPublishedReviews([]);
        setReviewSummary({ count: 0, averageRating: null });
      }
    };

    void loadPublishedReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleReviewSubmit = async (payload: {
    rating: number;
    comment: string;
    display_name: string;
    allow_publish: boolean;
  }) => {
    await submitMansakuReview({
      ...payload,
      source: "lp",
    });
  };

  const handleContactSubmit = async (payload: {
    name: string;
    email: string;
    category: string;
    message: string;
  }) => {
    await submitMansakuContact({
      ...payload,
      source: "lp",
    });
  };

  const featureImages = [
    {
      title: "テンプレートから作れる",
      body: "ページレイアウトを選んで、すぐに漫画ページを作り始められます。",
      image: "/images/lp/template.webp",
      alt: "テンプレート選択画面",
    },
    {
      title: "コマを直感的に編集",
      body: "移動、サイズ変更、分割、画像配置などを画面上で操作できます。",
      image: "/images/lp/edit_frame.webp",
      alt: "コマ編集画面",
    },
    {
      title: "吹き出しと効果音に対応",
      body: "セリフや効果音を配置して、漫画らしい画面を整えられます。",
      image: "/images/lp/edit_bubble.webp",
      alt: "吹き出し編集画面",
    },
    {
      title: "PNG / PDF 出力",
      body: "作成した漫画ページをPNG画像やPDFとして書き出せます。",
      image: "/images/lp/export.webp",
      alt: "PNGとPDFの出力メニュー",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        color: "#111827",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "72px 24px 56px",
          display: "grid",
          gap: 40,
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              padding: "6px 12px",
              borderRadius: 999,
              background: "#e0e7ff",
              color: "#3730a3",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            シンプルに、まず漫画を形にする。
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <img
              src="/favicon.svg"
              alt="Mansaku logo"
              style={{
                width: 64,
                height: 64,
                display: "block",
                flexShrink: 0,
              }}
            />

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(42px, 7vw, 78px)",
                lineHeight: 1.02,
                letterSpacing: "-0.06em",
                fontWeight: 900,
              }}
            >
              Mansaku
            </h1>
          </div>

          <p
            style={{
              margin: 0,
              maxWidth: 720,
              fontSize: "clamp(18px, 2.5vw, 24px)",
              lineHeight: 1.7,
              color: "#374151",
              fontWeight: 600,
            }}
          >
            コマ割り、吹き出し、効果音、画像配置をまとめて扱える、
            漫画ページ制作ツール。
          </p>

          <p
            style={{
              margin: 0,
              maxWidth: 680,
              fontSize: 15,
              lineHeight: 1.9,
              color: "#4b5563",
            }}
          >
            Mansakuは、お気に入りの画像を並べて、
            漫画ページを作れるツールです。
            必要な機能に絞り、ドラッグ中心の直感操作で、
            漫画ページづくりをスムーズに進められます。
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={appLinkHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenApp}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "0 20px",
                borderRadius: 12,
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 800,
                boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
              }}
            >
              Mansakuを開く
            </a>

            <a
              href="#features"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "0 20px",
                borderRadius: 12,
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                fontWeight: 800,
                border: "1px solid #d1d5db",
              }}
            >
              特徴を見る
            </a>

            {isDeveloperLinkVisible && (
              <a
                href={adminLinkHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 46,
                  padding: "0 20px",
                  borderRadius: 12,
                  background: "#fef3c7",
                  color: "#92400e",
                  textDecoration: "none",
                  fontWeight: 900,
                  border: "1px solid #f59e0b",
                }}
              >
                管理画面
              </a>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {isTestMode && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 28,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: "#fef3c7",
                  border: "1px solid #f59e0b",
                  color: "#92400e",
                  fontSize: 12,
                  fontWeight: 900,
                  boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
                }}
              >
                テストモード（Analytics除外）
              </span>
            )}

            {[
              "Windows / macOS",
              "Chrome / Edge 推奨",
              "ローカル保存",
              "無料",
            ].map((label) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 28,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: "#ffffff",
                  border: "1px solid #d1d5db",
                  color: "#4b5563",
                  fontSize: 12,
                  fontWeight: 800,
                  boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 24px 60px rgba(15,23,42,0.14)",
          }}
        >
          <img
            src="/images/lp/hero.webp"
            alt="Mansaku"
            style={{
              width: "100%",
              display: "block",
              borderRadius: 18,
            }}
          />
        </div>
      </section>

      <section
        id="features"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "24px 24px 72px",
          display: "grid",
          gap: 28,
        }}
      >
        {featureImages.map((feature, index) => (
          <article
            key={feature.title}
            style={{
              display: "grid",
              gridTemplateColumns:
                index % 2 === 0 ? "1fr 1.25fr" : "1.25fr 1fr",
              gap: 24,
              alignItems: "center",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 14px 34px rgba(15,23,42,0.1)",
            }}
          >
            <div
              style={{
                order: index % 2 === 0 ? 0 : 1,
                display: "grid",
                gap: 10,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  lineHeight: 1.4,
                }}
              >
                {feature.title}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#4b5563",
                  fontSize: 15,
                  lineHeight: 1.9,
                }}
              >
                {feature.body}
              </p>
            </div>

            <img
              src={feature.image}
              alt={feature.alt}
              style={{
                width: "100%",
                display: "block",
                borderRadius: 18,
                border: "1px solid #e5e7eb",
                boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
              }}
            />
          </article>
        ))}

        {publishedReviews.length > 0 && (
          <section
            aria-label="利用者の声"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 14px 34px rgba(15,23,42,0.1)",
              display: "grid",
              gap: 18,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.4 }}>
                利用者の声
              </h2>

              {reviewSummary.count > 0 && reviewSummary.averageRating != null && (
                <p
                  style={{
                    margin: 0,
                    color: "#4b5563",
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontWeight: 700,
                  }}
                >
                  平均評価 ★{reviewSummary.averageRating.toFixed(1)}
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {publishedReviews.map((review) => (
                <article
                  key={review.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 16,
                    background: "#f9fafb",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    aria-label={`${review.rating} / 5`}
                    style={{
                      color: "#f59e0b",
                      fontSize: 18,
                      letterSpacing: 1,
                      lineHeight: 1,
                    }}
                  >
                    {"★".repeat(review.rating)}
                    <span style={{ color: "#d1d5db" }}>
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "#374151",
                      fontSize: 14,
                      lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {review.comment}
                  </p>

                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    — {review.display_name || "匿名ユーザー"}
                  </div>

                  {review.developer_comment_visible && review.developer_comment && (
                    <div
                      style={{
                        borderTop: "1px solid #e5e7eb",
                        paddingTop: 10,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          color: "#111827",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        開発者より
                      </div>

                      <p
                        style={{
                          margin: 0,
                          color: "#4b5563",
                          fontSize: 13,
                          lineHeight: 1.8,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {review.developer_comment}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <article
          style={{
            background: "#111827",
            color: "#ffffff",
            borderRadius: 24,
            padding: 28,
            display: "grid",
            gap: 14,
            boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24 }}>
            レビュー歓迎
          </h2>

          <p
            style={{
              margin: 0,
              color: "#d1d5db",
              fontSize: 15,
              lineHeight: 1.9,
            }}
          >
            Mansakuは開発中のツールです。
            使ってみたレビューとして、
            評価とコメントを送ってください。
            <br />
            <br />
            気に入っていただけた場合は、
            開発支援として寄付していただけると励みになります。
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={openReviewForm}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 12,
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            >
              レビューを送る
            </button>

            <button
              type="button"
              onClick={openContactForm}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 12,
                background: "transparent",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            >
              お問い合わせ
            </button>

            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 12,
                background: "transparent",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,0.45)",
              }}
            >
              開発を支援する
            </a>

          </div>
        </article>
      </section>

      <footer
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 48px",
          color: "#6b7280",
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        <div
          style={{
            borderTop: "1px solid #d1d5db",
            paddingTop: 24,
            display: "grid",
            gap: 10,
          }}
        >
          <div>Mansaku</div>

          <div>
            シンプルに漫画ページを作るためのツール。
            <br />
            無料で利用できます。
          </div>

          <div>
            ・Windows / macOS 対応
            <br />
            ・Google Chrome / Microsoft Edge 最新版 推奨
            <br />
            ・マウス / キーボード操作対応
          </div>

          <div>© 2026 Mansaku Project</div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={openReviewForm}
              style={{
                all: "unset",
                color: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              レビュー
            </button>

            <button
              type="button"
              onClick={openContactForm}
              style={{
                all: "unset",
                color: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              お問い合わせ
            </button>

            <a href="/legal#terms" style={{ color: "inherit" }}>
              利用規約
            </a>

            <a href="/legal#privacy" style={{ color: "inherit" }}>
              プライバシーポリシー
            </a>
          </div>
        </div>
      </footer>


      {isUnsupportedDeviceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsupported-device-title"
          onClick={() => setIsUnsupportedDeviceOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(17,24,39,0.55)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 420px)",
              background: "#ffffff",
              color: "#111827",
              borderRadius: 22,
              padding: 24,
              boxShadow: "0 24px 70px rgba(15,23,42,0.28)",
              display: "grid",
              gap: 14,
            }}
          >
            <h2
              id="unsupported-device-title"
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.45,
              }}
            >
              スマホ・タブレットでは開けません
            </h2>

            <p
              style={{
                margin: 0,
                color: "#4b5563",
                fontSize: 15,
                lineHeight: 1.9,
              }}
            >
              Mansakuは現在、パソコン向けの漫画ページ制作ツールです。
              Windows または macOS の Google Chrome / Microsoft Edge 最新版で開いてください。
            </p>

            <button
              type="button"
              onClick={() => setIsUnsupportedDeviceOpen(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 12,
                background: "#111827",
                color: "#ffffff",
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <ReviewDialog
        open={isReviewOpen}
        language="ja"
        showDismissForever={false}
        onClose={closeReviewForm}
        onSubmit={handleReviewSubmit}
      />

      <ContactDialog
        open={isContactOpen}
        language="ja"
        onClose={closeContactForm}
        onSubmit={handleContactSubmit}
      />
    </main>
  );
}