import { useEffect } from "react";
import type { CSSProperties } from "react";

export function LegalPage() {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace("#", "");

      if (!id) return;

      const el = document.getElementById(id);

      if (!el) return;

      window.setTimeout(() => {
        el.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    };

    scrollToHash();

    window.addEventListener("hashchange", scrollToHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

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
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "56px 24px 80px",
          display: "grid",
          gap: 32,
        }}
      >
        <a
          href="/"
          style={{
            color: "#374151",
            textDecoration: "none",
            fontWeight: 700,
            width: "fit-content",
          }}
        >
          ← Mansaku
        </a>

        <header
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 56px)",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            利用規約・プライバシーポリシー
          </h1>

          <p
            style={{
              margin: 0,
              color: "#4b5563",
              lineHeight: 1.8,
            }}
          >
            Mansakuの利用条件と、データの取り扱いについてまとめています。
          </p>
        </header>

        <nav
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <a href="#terms" style={navLinkStyle}>
            利用規約
          </a>

          <a href="#privacy" style={navLinkStyle}>
            プライバシーポリシー
          </a>
        </nav>

        <section id="terms" style={cardStyle}>
          <h2 style={headingStyle}>利用規約</h2>

          <p style={paragraphStyle}>
            Mansakuを利用した時点で、本利用規約に同意したものとみなします。
          </p>

          <h3 style={subHeadingStyle}>禁止事項</h3>

          <p style={paragraphStyle}>
            違法行為、公序良俗に反する行為、
            第三者の権利を侵害する行為を禁止します。
          </p>

          <h3 style={subHeadingStyle}>作品・素材の権利</h3>

          <p style={paragraphStyle}>
            Mansakuで作成した作品、
            読み込んだ画像、
            出力した画像やPDFの権利は、
            各ユーザーまたは正当な権利者に帰属します。
          </p>

          <h3 style={subHeadingStyle}>免責事項</h3>

          <p style={paragraphStyle}>
            Mansakuの利用により発生した損害、
            データ消失、
            トラブル等について、
            Mansaku Projectは責任を負いません。
            必要なデータはユーザー自身で保存・管理してください。
          </p>

          <h3 style={subHeadingStyle}>仕様変更</h3>

          <p style={paragraphStyle}>
            Mansakuの仕様、
            機能、
            利用規約は予告なく変更される場合があります。
          </p>
        </section>

        <section id="privacy" style={cardStyle}>
          <h2 style={headingStyle}>プライバシーポリシー</h2>

          <p style={paragraphStyle}>
            Mansakuはログイン、
            クラウド保存、
            広告配信を行っていません。
            レビュー投稿フォームを利用した場合のみ、
            ユーザーが入力した内容を外部サービスへ送信します。
          </p>

          <h3 style={subHeadingStyle}>保存データ</h3>

          <p style={paragraphStyle}>
            プロジェクトデータは、
            ユーザーのブラウザ内、
            またはユーザーが選択した保存先に保存されます。
          </p>

          <h3 style={subHeadingStyle}>レビュー投稿</h3>

          <p style={paragraphStyle}>
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

          <h3 style={subHeadingStyle}>外部送信</h3>

          <p style={paragraphStyle}>
            レビュー投稿フォームから送信された内容は、
            レビュー管理のため外部サービスに保存されます。
            作品データ、
            読み込んだ画像、
            出力したPNG・PDF・JSONは、
            レビュー投稿によって送信されません。
          </p>

          <h3 style={subHeadingStyle}>Cookie等</h3>

          <p style={paragraphStyle}>
            レビュー投稿フォームの表示制御や動作確認のため、
            ブラウザのローカルストレージを利用する場合があります。
            広告配信サービスを利用したトラッキングは行っていません。
          </p>

          <h3 style={subHeadingStyle}>出力・保存ファイル</h3>

          <p style={paragraphStyle}>
            ユーザーが出力・保存したPNG、
            PDF、
            JSON等のファイルは、
            ユーザー自身が管理します。
          </p>
        </section>

        <footer
          style={{
            color: "#6b7280",
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          © 2026 Mansaku Project
        </footer>
      </div>
    </main>
  );
}

const navLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 12,
  background: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 800,
  border: "1px solid #d1d5db",
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 14px 34px rgba(15,23,42,0.1)",
  scrollMarginTop: 24,
};

const headingStyle: CSSProperties = {
  margin: "0 0 18px",
  fontSize: 28,
  lineHeight: 1.3,
};

const subHeadingStyle: CSSProperties = {
  margin: "24px 0 8px",
  fontSize: 18,
  lineHeight: 1.5,
};

const paragraphStyle: CSSProperties = {
  margin: 0,
  color: "#374151",
  fontSize: 15,
  lineHeight: 1.9,
};