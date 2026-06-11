import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
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

type LegalMode = "terms" | "privacy";

function getSupabaseConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  return { url, anonKey };
}

function isTestModeUrl() {
  if (typeof window === "undefined") return false;

  return (
    new URLSearchParams(window.location.search).get("test") === "1" ||
    isLocalHost()
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

function getAdminLinkHref() {
  return "/admin?test=1";
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
  const adminLinkHref = getAdminLinkHref();

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
  const [legalMode, setLegalMode] = useState<LegalMode | null>(null);

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
    <main style={pageStyle}>
      <section style={heroSectionStyle}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={catchLabelStyle}>シンプルに、まず漫画を形にする。</div>

            {isTestMode && (
              <span style={testModeLabelStyle}>
                テストモード（Analytics除外）
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <img
              src="/favicon.svg"
              alt="Mansaku logo"
              style={{ width: 64, height: 64, display: "block", flexShrink: 0 }}
            />

            <h1 style={titleStyle}>Mansaku</h1>
          </div>

          <p style={leadStyle}>
            コマ割り、吹き出し、効果音、画像配置をまとめて扱える、
            漫画ページ制作ツール。
          </p>

          <p style={descriptionStyle}>
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
              style={primaryLinkStyle}
            >
              Mansakuを開く
            </a>

            <a href="#features" style={secondaryLinkStyle}>
              特徴を見る
            </a>

            {isDeveloperLinkVisible && (
              <a
                href={adminLinkHref}
                target="_blank"
                rel="noopener noreferrer"
                style={adminLinkStyle}
              >
                管理画面
              </a>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {["Windows / macOS", "Chrome / Edge 推奨", "ローカル保存", "無料"].map((label) => (
              <span key={label} style={chipStyle}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={heroImageWrapStyle}>
          <img
            src="/images/lp/hero.webp"
            alt="Mansaku"
            style={{ width: "100%", display: "block", borderRadius: 18 }}
          />
        </div>
      </section>

      <section id="features" style={featuresSectionStyle}>
        {featureImages.map((feature, index) => (
          <article
            key={feature.title}
            style={{
              ...featureCardStyle,
              gridTemplateColumns: index % 2 === 0 ? "1fr 1.25fr" : "1.25fr 1fr",
            }}
          >
            <div style={{ order: index % 2 === 0 ? 0 : 1, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.4 }}>
                {feature.title}
              </h2>

              <p style={featureTextStyle}>{feature.body}</p>
            </div>

            <img
              src={feature.image}
              alt={feature.alt}
              style={featureImageStyle}
            />
          </article>
        ))}

        {publishedReviews.length > 0 && (
          <section aria-label="利用者の声" style={reviewSectionStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.4 }}>
                利用者の声
              </h2>

              {reviewSummary.count > 0 && reviewSummary.averageRating != null && (
                <p style={reviewSummaryStyle}>
                  平均評価 ★{reviewSummary.averageRating.toFixed(1)}
                </p>
              )}
            </div>

            <div style={reviewGridStyle}>
              {publishedReviews.map((review) => (
                <article key={review.id} style={reviewCardStyle}>
                  <div aria-label={`${review.rating} / 5`} style={starStyle}>
                    {"★".repeat(review.rating)}
                    <span style={{ color: "#d1d5db" }}>
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </div>

                  <p style={reviewCommentStyle}>{review.comment}</p>

                  <div style={reviewNameStyle}>
                    — {review.display_name || "匿名ユーザー"}
                  </div>

                  {review.developer_comment_visible && review.developer_comment && (
                    <div style={developerReplyStyle}>
                      <div style={developerReplyTitleStyle}>開発者より</div>

                      <p style={developerReplyTextStyle}>
                        {review.developer_comment}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <article style={ctaSectionStyle}>
          <h2 style={{ margin: 0, fontSize: 24 }}>レビュー歓迎</h2>

          <p style={ctaTextStyle}>
            Mansakuは開発中のツールです。
            使ってみたレビューとして、
            評価とコメントを送ってください。
            <br />
            <br />
            気に入っていただけた場合は、
            開発支援として寄付していただけると励みになります。
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={openReviewForm} style={ctaPrimaryButtonStyle}>
              レビューを送る
            </button>

            <button type="button" onClick={openContactForm} style={ctaGhostButtonStyle}>
              お問い合わせ
            </button>

            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              style={ctaGhostLinkStyle}
            >
              開発を支援する
            </a>
          </div>
        </article>
      </section>

      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
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

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button type="button" onClick={openReviewForm} style={footerLinkStyle}>
              レビュー
            </button>

            <button type="button" onClick={openContactForm} style={footerLinkStyle}>
              お問い合わせ
            </button>

            <button
              type="button"
              onClick={() => setLegalMode("terms")}
              style={footerLinkStyle}
            >
              利用規約
            </button>

            <button
              type="button"
              onClick={() => setLegalMode("privacy")}
              style={footerLinkStyle}
            >
              プライバシーポリシー
            </button>
          </div>
        </div>
      </footer>

      {isUnsupportedDeviceOpen && (
        <UnsupportedDeviceDialog onClose={() => setIsUnsupportedDeviceOpen(false)} />
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

      {legalMode && (
        <LegalDialog
          mode={legalMode}
          onClose={() => setLegalMode(null)}
        />
      )}
    </main>
  );
}

function UnsupportedDeviceDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsupported-device-title"
      onClick={onClose}
      style={dialogBackdropStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={unsupportedDialogStyle}>
        <h2 id="unsupported-device-title" style={dialogTitleStyle}>
          スマホ・タブレットでは開けません
        </h2>

        <p style={dialogParagraphStyle}>
          Mansakuは現在、パソコン向けの漫画ページ制作ツールです。
          Windows または macOS の Google Chrome / Microsoft Edge 最新版で開いてください。
        </p>

        <button type="button" onClick={onClose} style={dialogCloseButtonStyle}>
          閉じる
        </button>
      </div>
    </div>
  );
}

function LegalDialog({
  mode,
  onClose,
}: {
  mode: LegalMode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "terms" ? "利用規約" : "プライバシーポリシー"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={legalBackdropStyle}
    >
      <div style={legalDialogStyle}>
        <div style={legalHeaderStyle}>
          <div>
            <div style={legalTitleStyle}>
              {mode === "terms" ? "利用規約" : "プライバシーポリシー"}
            </div>

            <div style={legalDescriptionStyle}>
              Mansakuの利用条件と、データの取り扱いについてまとめています。
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={legalCloseIconStyle}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div style={legalBodyStyle}>
          {mode === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>

        <div style={legalFooterStyle}>
          <button type="button" onClick={onClose} style={legalCloseButtonStyle}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div style={legalContentStyle}>
      <p style={legalParagraphStyle}>
        Mansakuを利用した時点で、本利用規約に同意したものとみなします。
      </p>

      <h3 style={legalSubHeadingStyle}>禁止事項</h3>

      <p style={legalParagraphStyle}>
        違法行為、公序良俗に反する行為、
        第三者の権利を侵害する行為を禁止します。
      </p>

      <h3 style={legalSubHeadingStyle}>作品・素材の権利</h3>

      <p style={legalParagraphStyle}>
        Mansakuで作成した作品、
        読み込んだ画像、
        出力した画像やPDFの権利は、
        各ユーザーまたは正当な権利者に帰属します。
      </p>

      <h3 style={legalSubHeadingStyle}>免責事項</h3>

      <p style={legalParagraphStyle}>
        Mansakuの利用により発生した損害、
        データ消失、
        トラブル等について、
        Mansaku Projectは責任を負いません。
        必要なデータはユーザー自身で保存・管理してください。
      </p>

      <h3 style={legalSubHeadingStyle}>仕様変更</h3>

      <p style={legalParagraphStyle}>
        Mansakuの仕様、
        機能、
        利用規約は予告なく変更される場合があります。
      </p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div style={legalContentStyle}>
      <p style={legalParagraphStyle}>
        Mansakuはログイン、
        クラウド保存、
        広告配信を行っていません。
        レビュー投稿フォームやお問い合わせフォームを利用した場合のみ、
        ユーザーが入力した内容を外部サービスへ送信します。
      </p>

      <h3 style={legalSubHeadingStyle}>保存データ</h3>

      <p style={legalParagraphStyle}>
        プロジェクトデータは、
        ユーザーのブラウザ内、
        またはユーザーが選択した保存先に保存されます。
      </p>

      <h3 style={legalSubHeadingStyle}>レビュー投稿</h3>

      <p style={legalParagraphStyle}>
        レビュー投稿フォームでは、
        評価、
        コメント、
        表示名、
        サイト掲載可否を送信できます。
        送信されたレビューは、
        内容確認後、
        掲載を許可されたものに限り
        公式サイト上で紹介する場合があります。
      </p>

      <h3 style={legalSubHeadingStyle}>お問い合わせ</h3>

      <p style={legalParagraphStyle}>
        お問い合わせフォームでは、
        名前、
        メールアドレス、
        種別、
        お問い合わせ内容を送信できます。
        名前とメールアドレスは任意です。
        返信が必要な場合はメールアドレスを入力してください。
      </p>

      <h3 style={legalSubHeadingStyle}>外部送信</h3>

      <p style={legalParagraphStyle}>
        レビュー投稿フォームやお問い合わせフォームから送信された内容は、
        管理のため外部サービスに保存されます。
        作品データ、
        読み込んだ画像、
        出力したPNG・PDF・JSONは、
        レビュー投稿やお問い合わせによって送信されません。
      </p>

      <h3 style={legalSubHeadingStyle}>Cookie等</h3>

      <p style={legalParagraphStyle}>
        レビュー投稿フォームの表示制御や動作確認のため、
        ブラウザのローカルストレージを利用する場合があります。
        広告配信サービスを利用したトラッキングは行っていません。
      </p>

      <h3 style={legalSubHeadingStyle}>出力・保存ファイル</h3>

      <p style={legalParagraphStyle}>
        ユーザーが出力・保存したPNG、
        PDF、
        JSON等のファイルは、
        ユーザー自身が管理します。
      </p>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
  color: "#111827",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const heroSectionStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "72px 24px 56px",
  display: "grid",
  gap: 40,
};

const catchLabelStyle: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#e0e7ff",
  color: "#3730a3",
  fontSize: 13,
  fontWeight: 700,
};

const testModeLabelStyle: CSSProperties = {
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
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(42px, 7vw, 78px)",
  lineHeight: 1.02,
  letterSpacing: "-0.06em",
  fontWeight: 900,
};

const leadStyle: CSSProperties = {
  margin: 0,
  maxWidth: 720,
  fontSize: "clamp(18px, 2.5vw, 24px)",
  lineHeight: 1.7,
  color: "#374151",
  fontWeight: 600,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  maxWidth: 680,
  fontSize: 15,
  lineHeight: 1.9,
  color: "#4b5563",
};

const primaryLinkStyle: CSSProperties = {
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
};

const secondaryLinkStyle: CSSProperties = {
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
};

const adminLinkStyle: CSSProperties = {
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
};

const chipStyle: CSSProperties = {
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
};

const heroImageWrapStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 24px 60px rgba(15,23,42,0.14)",
};

const featuresSectionStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "24px 24px 72px",
  display: "grid",
  gap: 28,
};

const featureCardStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 14px 34px rgba(15,23,42,0.1)",
};

const featureTextStyle: CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: 15,
  lineHeight: 1.9,
};

const featureImageStyle: CSSProperties = {
  width: "100%",
  display: "block",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
};

const reviewSectionStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 14px 34px rgba(15,23,42,0.1)",
  display: "grid",
  gap: 18,
};

const reviewSummaryStyle: CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: 14,
  lineHeight: 1.7,
  fontWeight: 700,
};

const reviewGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const reviewCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  background: "#f9fafb",
  display: "grid",
  gap: 10,
};

const starStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: 18,
  letterSpacing: 1,
  lineHeight: 1,
};

const reviewCommentStyle: CSSProperties = {
  margin: 0,
  color: "#374151",
  fontSize: 14,
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const reviewNameStyle: CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 700,
};

const developerReplyStyle: CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: 10,
  display: "grid",
  gap: 4,
};

const developerReplyTitleStyle: CSSProperties = {
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
};

const developerReplyTextStyle: CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: 13,
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const ctaSectionStyle: CSSProperties = {
  background: "#111827",
  color: "#ffffff",
  borderRadius: 24,
  padding: 28,
  display: "grid",
  gap: 14,
  boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
};

const ctaTextStyle: CSSProperties = {
  margin: 0,
  color: "#d1d5db",
  fontSize: 15,
  lineHeight: 1.9,
};

const ctaPrimaryButtonStyle: CSSProperties = {
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
};

const ctaGhostButtonStyle: CSSProperties = {
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
};

const ctaGhostLinkStyle: CSSProperties = {
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
};

const footerStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "0 24px 48px",
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.8,
};

const footerInnerStyle: CSSProperties = {
  borderTop: "1px solid #d1d5db",
  paddingTop: 24,
  display: "grid",
  gap: 10,
};

const footerLinkStyle: CSSProperties = {
  all: "unset",
  color: "inherit",
  cursor: "pointer",
  textDecoration: "underline",
};

const dialogBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "rgba(17,24,39,0.55)",
};

const unsupportedDialogStyle: CSSProperties = {
  width: "min(100%, 420px)",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 22,
  padding: 24,
  boxShadow: "0 24px 70px rgba(15,23,42,0.28)",
  display: "grid",
  gap: 14,
};

const dialogTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  lineHeight: 1.45,
};

const dialogParagraphStyle: CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: 15,
  lineHeight: 1.9,
};

const dialogCloseButtonStyle: CSSProperties = {
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
};

const legalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 120000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(17, 24, 39, 0.42)",
  boxSizing: "border-box",
};

const legalDialogStyle: CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "min(760px, calc(100vh - 40px))",
  borderRadius: 18,
  background: "#ffffff",
  boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
  color: "#111827",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  overflow: "hidden",
};

const legalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "22px 22px 14px",
  borderBottom: "1px solid #e5e7eb",
};

const legalTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.35,
};

const legalDescriptionStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#4b5563",
};

const legalCloseIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: "none",
  borderRadius: 8,
  background: "transparent",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#374151",
  flexShrink: 0,
  fontSize: 22,
  lineHeight: 1,
};

const legalBodyStyle: CSSProperties = {
  overflowY: "auto",
  padding: 22,
};

const legalFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: "14px 22px 22px",
  borderTop: "1px solid #e5e7eb",
};

const legalCloseButtonStyle: CSSProperties = {
  minWidth: 96,
  height: 38,
  border: "none",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 800,
};

const legalContentStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

const legalSubHeadingStyle: CSSProperties = {
  margin: "24px 0 8px",
  fontSize: 18,
  lineHeight: 1.5,
};

const legalParagraphStyle: CSSProperties = {
  margin: 0,
  color: "#374151",
  fontSize: 15,
  lineHeight: 1.9,
};