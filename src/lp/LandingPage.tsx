import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { ContactDialog, submitMansakuContact } from "../app/ContactDialog";
import {
  ReviewDialog,
  fetchMansakuReviewSummary,
  submitMansakuReview,
  type MansakuReviewSummary,
} from "../app/ReviewDialog";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "../app/i18n";
import { lpMessages, type LpMessageKey } from "./lpMessages";

type PublicMansakuReviewWithDeveloperReply = {
  id: number | string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  developer_comment?: string | null;
  developer_comment_visible?: boolean | null;
};

type LegalMode = "terms" | "privacy";

type LandingTranslator = (key: LpMessageKey) => string;

function getPathLandingLanguage(): AppLanguage | null {
  if (typeof window === "undefined") return null;

  const firstSegment = window.location.pathname
    .split("/")
    .filter(Boolean)[0];

  if (!firstSegment) return null;

  const normalized = normalizeAppLanguage(firstSegment);

  return normalized === firstSegment ? normalized : null;
}

function getInitialLandingLanguage(): AppLanguage {
  if (typeof window === "undefined") return "ja";

  const pathLanguage = getPathLandingLanguage();

  if (pathLanguage) {
    return pathLanguage;
  }

  const browserLanguages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const browserLanguage of browserLanguages) {
    const primaryLanguage = browserLanguage.split("-")[0];
    const normalized = normalizeAppLanguage(primaryLanguage);

    if (normalized === primaryLanguage) {
      return normalized;
    }
  }

  return "en";
}

function getHtmlLang(language: AppLanguage) {
  return language === "zh" ? "zh-CN" : language;
}

function setMetaContent(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) return;

  element.content = content;
}

function BrandName({ style }: { style?: CSSProperties }) {
  return (
    <span translate="no" className="notranslate" style={style}>
      Mansaku
    </span>
  );
}


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
  const language = getInitialLandingLanguage();
  const t = useMemo(() => {
    return (key: LpMessageKey) => lpMessages[language]?.[key] ?? lpMessages.en[key] ?? key;
  }, [language]);
  const isTestMode = isTestModeUrl();
  const isDeveloperLinkVisible = isTestMode || isLocalHost();
  const appLinkHref = getAppLinkHref(isTestMode);
  const adminLinkHref = getAdminLinkHref();

  useEffect(() => {
    const title = isTestMode ? t("lpMetaTitleTest") : t("lpMetaTitle");

    document.title = title;
    document.documentElement.lang = getHtmlLang(language);
    setMetaContent('meta[name="description"]', t("lpMetaDescription"));
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', t("lpMetaOgDescription"));
    setMetaContent('meta[property="og:image:alt"]', t("lpMetaOgImageAlt"));
  }, [isTestMode, language, t]);

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
      title: t("lpFeatureTemplateTitle"),
      body: t("lpFeatureTemplateBody"),
      image: "/images/lp/template.webp",
      alt: t("lpFeatureTemplateAlt"),
    },
    {
      title: t("lpFeatureFrameTitle"),
      body: t("lpFeatureFrameBody"),
      image: "/images/lp/edit_frame.webp",
      alt: t("lpFeatureFrameAlt"),
    },
    {
      title: t("lpFeatureBubbleTitle"),
      body: t("lpFeatureBubbleBody"),
      image: "/images/lp/edit_bubble.webp",
      alt: t("lpFeatureBubbleAlt"),
    },
    {
      title: t("lpFeatureExportTitle"),
      body: t("lpFeatureExportBody"),
      image: "/images/lp/export.webp",
      alt: t("lpFeatureExportAlt"),
    },
  ];

  return (
    <main translate="no" className="notranslate" style={pageStyle}>
      <section style={heroSectionStyle}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={catchLabelStyle}>{t("lpCatchLabel")}</div>

            {isTestMode && (
              <span style={testModeLabelStyle}>
                {t("lpTestModeLabel")}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <img
              src="/favicon.svg"
              alt="Mansaku logo"
              style={{ width: 64, height: 64, display: "block", flexShrink: 0 }}
            />

            <h1 style={titleStyle}><BrandName /></h1>
          </div>

          <p style={leadStyle}>
            {t("lpHeroLead")}
          </p>

          <p style={descriptionStyle}>
            {t("lpHeroDescription")}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={appLinkHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenApp}
              style={primaryLinkStyle}
            >
              {t("lpOpenApp")}
            </a>

            <a href="#features" style={secondaryLinkStyle}>
              {t("lpViewFeatures")}
            </a>

            {isDeveloperLinkVisible && (
              <a
                href={adminLinkHref}
                target="_blank"
                rel="noopener noreferrer"
                style={adminLinkStyle}
              >
                {t("lpAdmin")}
              </a>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[t("lpChipDesktop"), t("lpChipBrowser"), t("lpChipLocalSave"), t("lpChipFree")].map((label) => (
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
          <section aria-label={t("lpReviewsHeading")} style={reviewSectionStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.4 }}>
                {t("lpReviewsHeading")}
              </h2>

              {reviewSummary.count > 0 && reviewSummary.averageRating != null && (
                <p style={reviewSummaryStyle}>
                  {t("lpAverageRatingPrefix")} ★{reviewSummary.averageRating.toFixed(1)}
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
                    — {review.display_name || t("lpAnonymousUser")}
                  </div>

                  {review.developer_comment_visible && review.developer_comment && (
                    <div style={developerReplyStyle}>
                      <div style={developerReplyTitleStyle}>{t("lpDeveloperReplyTitle")}</div>

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
          <h2 style={{ margin: 0, fontSize: 24 }}>{t("lpReviewWelcomeTitle")}</h2>

          <p style={ctaTextStyle}>
            {t("lpReviewWelcomeBody")}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={openReviewForm} style={ctaPrimaryButtonStyle}>
              {t("lpSendReview")}
            </button>

            <button type="button" onClick={openContactForm} style={ctaGhostButtonStyle}>
              {t("lpContact")}
            </button>

            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              style={ctaGhostLinkStyle}
            >
              {t("lpSupportDevelopment")}
            </a>
          </div>
        </article>
      </section>

      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <div><BrandName /></div>

          <div>
            {t("lpFooterDescription")}
          </div>

          <div>
            {t("lpFooterRequirements")}
          </div>

          <div>© 2026 Mansaku Project</div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button type="button" onClick={openReviewForm} style={footerLinkStyle}>
              {t("lpReview")}
            </button>

            <button type="button" onClick={openContactForm} style={footerLinkStyle}>
              {t("lpContact")}
            </button>

            <button
              type="button"
              onClick={() => setLegalMode("terms")}
              style={footerLinkStyle}
            >
              {t("lpTerms")}
            </button>

            <button
              type="button"
              onClick={() => setLegalMode("privacy")}
              style={footerLinkStyle}
            >
              {t("lpPrivacy")}
            </button>
          </div>
        </div>
      </footer>

      {isUnsupportedDeviceOpen && (
        <UnsupportedDeviceDialog t={t} onClose={() => setIsUnsupportedDeviceOpen(false)} />
      )}

      <ReviewDialog
        open={isReviewOpen}
        language={language}
        showDismissForever={false}
        onClose={closeReviewForm}
        onSubmit={handleReviewSubmit}
      />

      <ContactDialog
        open={isContactOpen}
        language={language}
        onClose={closeContactForm}
        onSubmit={handleContactSubmit}
      />

      {legalMode && (
        <LegalDialog
          mode={legalMode}
          t={t}
          onClose={() => setLegalMode(null)}
        />
      )}
    </main>
  );
}

function UnsupportedDeviceDialog({ t, onClose }: { t: LandingTranslator; onClose: () => void }) {
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
          {t("lpUnsupportedTitle")}
        </h2>

        <p style={dialogParagraphStyle}>
          {t("lpUnsupportedBody")}
        </p>

        <button type="button" onClick={onClose} style={dialogCloseButtonStyle}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}

function LegalDialog({
  mode,
  t,
  onClose,
}: {
  mode: LegalMode;
  t: LandingTranslator;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "terms" ? t("lpTerms") : t("lpPrivacy")}
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
              {mode === "terms" ? t("lpTerms") : t("lpPrivacy")}
            </div>

            <div style={legalDescriptionStyle}>
              {t("lpLegalDescription")}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={legalCloseIconStyle}
            aria-label={t("close")}
          >
            ×
          </button>
        </div>

        <div style={legalBodyStyle}>
          {mode === "terms" ? <TermsContent t={t} /> : <PrivacyContent t={t} />}
        </div>

        <div style={legalFooterStyle}>
          <button type="button" onClick={onClose} style={legalCloseButtonStyle}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsContent({ t }: { t: LandingTranslator }) {
  return (
    <div style={legalContentStyle}>
      <p style={legalParagraphStyle}>{t("lpTermsIntro")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpTermsProhibitedTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpTermsProhibitedBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpTermsRightsTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpTermsRightsBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpTermsDisclaimerTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpTermsDisclaimerBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpTermsChangesTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpTermsChangesBody")}</p>
    </div>
  );
}

function PrivacyContent({ t }: { t: LandingTranslator }) {
  return (
    <div style={legalContentStyle}>
      <p style={legalParagraphStyle}>{t("lpPrivacyIntro")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacySavedDataTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacySavedDataBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacyReviewTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacyReviewBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacyContactTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacyContactBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacyExternalTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacyExternalBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacyCookieTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacyCookieBody")}</p>

      <h3 style={legalSubHeadingStyle}>{t("lpPrivacyOutputTitle")}</h3>
      <p style={legalParagraphStyle}>{t("lpPrivacyOutputBody")}</p>
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