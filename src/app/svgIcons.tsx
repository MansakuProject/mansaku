import type { BubbleShape, BubbleType } from "./types";
import { bubbleSvgPath } from "./bubble";

const ICON_SIZE = 18;
const ICON_STROKE = 1.2;


export function FoldChevronSvgIcon({ open }: { open: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? "M7 9l5 5 5-5" : "M9 7l5 5-5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE + 0.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}



// ----------
// 画像移動量（x1 / x10）
// ----------
export function ImageMoveStepSvgIcon({ step }: { step: 1 | 10 }) {
  const text = step === 1 ? "x1" : "x10";

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize={step === 1 ? 15.5 : 12.5}
        fontWeight="900"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="currentColor"
      >
        {text}
      </text>
    </svg>
  );
}

// ----------
// 分割（上下／左右）
// ----------
export function SplitIcon({ direction }: { direction: "vertical" | "horizontal" }) {
  const isVertical = direction === "vertical";

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {isVertical ? (
        <line
          x1="2.5"
          y1="12"
          x2="21.5"
          y2="12"
          stroke="currentColor"
          strokeWidth={ICON_STROKE}
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      ) : (
        <line
          x1="12"
          y1="2.5"
          x2="12"
          y2="21.5"
          stroke="currentColor"
          strokeWidth={ICON_STROKE}
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}

function getBubbleIconShape(type: BubbleType): BubbleShape {
  switch (type) {
    case "ellipse":
    case "thought":
      return "ellipse";

    case "heptagon":
      return "heptagon";

    case "explosion":
      return "cornerSpiky";

    case "cloud":
      return "cloud";

    case "wave":
      return "wave";

    case "rect":
      return "rect";

    case "electronic":
      return "electronic";

    case "flash":
    case "uniFlash":
      return "flash";

    default:
      return "ellipse";
  }
}

// ----------
// 原稿＋ペン
// ----------
export function ManuscriptSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 外枠 */}
      <rect
        x="4"
        y="1.5"
        width="16"
        height="21"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {/* ペン */}
      <g
        transform="translate(15.8 9.2) rotate(38)"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 軸 */}
        <rect
          x="-1.4"
          y="-0.5"
          width="2.8"
          height="9.5"
          rx="0.5"
          fill="#d1d5db"
        />

        {/* 消しゴム */}
        <rect
          x="-1.4"
          y="-2.2"
          width="2.8"
          height="1.7"
          rx="0.5"
          fill="#d1d5db"
        />

        {/* ペン先 */}
        <path
          d="M-1.4 9L0 11.5L1.4 9Z"
          fill="#d1d5db"
        />

        {/* 芯 */}
        <path d="M0 10.2V11" />
      </g>
    </svg>
  );
}

// ----------
// ↓（ダウンロード）
// ----------
export function DownloadIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4V15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      <path
        d="M8 11L12 15L16 11"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 18V20H19V18"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// □□（レイアウト／テンプレ）
// ----------
export function LayoutSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 外枠 */}
      <rect
        x="4"
        y="1.5"
        width="16"
        height="21"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {/* 上コマ */}
      <path
        d="M6 4H18V9.5L6 13Z"
        fill="#d1d5db"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      {/* 下コマ（左） */}
      <path
        d="M6 15L11 13.5V20H6Z"
        fill="#d1d5db"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      {/* 下コマ（右） */}
      <path
        d="M13 13.5L18 12V20H13Z"
        fill="#d1d5db"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// コマ追加
// ----------
export function FrameAddSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 外枠 */}
      <rect
        x="4"
        y="1.5"
        width="16"
        height="21"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {/* 上コマ */}
      <path
        d="M6 4H18V9.5L6 13Z"
        fill="#d1d5db"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      {/* ＋丸 */}
      <circle
        cx="17.5"
        cy="17.5"
        r="6.2"
        fill="#111827"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE}
      />

      {/* ＋ */}
      <path
        d="M13.7 17.5H21.3M17.5 13.7V21.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE * 1.15}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 吹き出し追加
// ----------
export function BubbleAddSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 吹き出し本体 */}
      <ellipse
        cx="10.5"
        cy="9.5"
        rx="6.8"
        ry="5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {/* しっぽ */}
      <path
        d="M8.2 14L5.5 19L11.2 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ＋丸 */}
      <circle
        cx="17.5"
        cy="17.5"
        r="6.2"
        fill="#111827"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE}
      />

      {/* ＋ */}
      <path
        d="M13.7 17.5H21.3M17.5 13.7V21.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE * 1.15}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 🔊（擬音追加）
// ----------
export function SoundAddSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 本体 */}
      <path
        d="M4 7H8L13 3V15L8 11H4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      {/* 音波① */}
      <path
        d="M16 6C17.5 7.5 17.5 10.5 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* 音波② */}
      <path
        d="M18.5 4.5C21 7 21 11 18.5 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* ＋丸 */}
      <circle
        cx="17.5"
        cy="17.5"
        r="6.2"
        fill="#111827"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE}
      />

      {/* ＋ */}
      <path
        d="M13.7 17.5H21.3M17.5 13.7V21.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE * 1.15}
        strokeLinecap="round"
      />
    </svg>
  );
}


// ----------
// 描き文字追加
// ----------
export function DrawnTextAddSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* A */}
      <text
        x="1.2"
        y="20"
        fontSize="10"
        fontWeight="900"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="currentColor"
      >
        A
      </text>

      {/* 大きなペン */}
      <g
        transform="translate(19.5 0.5) rotate(45) scale(1.45)"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 軸 */}
        <rect
          x="-1.4"
          y="-0.5"
          width="2.8"
          height="9.5"
          rx="0.5"
          fill="#d1d5db"
        />

        {/* 消しゴム */}
        <rect
          x="-1.4"
          y="-2.2"
          width="2.8"
          height="1.7"
          rx="0.5"
          fill="#d1d5db"
        />

        {/* ペン先 */}
        <path
          d="M-1.4 9L0 11.5L1.4 9Z"
          fill="#d1d5db"
        />

        {/* 芯 */}
        <path d="M0 10.2V11" />
      </g>

      {/* ＋丸 */}
      <circle
        cx="17.5"
        cy="17.5"
        r="6.2"
        fill="#111827"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE}
      />

      {/* ＋ */}
      <path
        d="M13.7 17.5H21.3M17.5 13.7V21.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE * 1.15}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// レイヤー順序（最前面／前面／背面／最背面）
// ----------
export function LayerOrderSvgIcon({
  type,
}: {
  type: "front" | "forward" | "backward" | "back";
}) {
  const isFront = type === "front";
  const isForward = type === "forward";
  const isBack = type === "back";

  const layers = isFront || isBack ? 3 : 2;

  const getFill = (index: number) => {
    if (isFront || isForward) {
      return index === 0 ? "#111827" : "#ffffff";
    }

    return index === layers - 1 ? "#111827" : "#ffffff";
  };

  const layerIndexes = Array.from({ length: layers }, (_, i) => i);

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {layerIndexes
        .slice()
        .reverse()
        .map((index) => (
          <path
            key={index}
            d="M10.7 2.7L18.7 7.3L10.7 12L2.7 7.3Z"
            transform={`translate(0 ${index * 4})`}
            fill={getFill(index)}
            stroke="#111827"
            strokeWidth={ICON_STROKE}
            strokeLinejoin="round"
          />
        ))}
    </svg>
  );
}

// ----------
// 👁（表示／非表示）
// ----------
export function PageVisibleSvgIcon({ visible }: { visible: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />
      {!visible && (
        <path
          d="M4.5 4.5 19.5 19.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// ----------
// 吹き出し形状
// ----------
export function BubbleTypeIcon({ type }: { type: BubbleType }) {
  const shape = getBubbleIconShape(type);
  const isUniFlash = type === "uniFlash";

  return (
    <span
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          display: "block",
          overflow: "visible",
        }}
      >
        <g transform="translate(50 50) scale(0.72 0.95) translate(-50 -50)">
          <path
            d={bubbleSvgPath(shape, shape === "flash" ? 14 : 10)}
            fill={isUniFlash ? "#111827" : "#ffffff"}
            stroke="#111827"
            strokeWidth={ICON_STROKE}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {type === "thought" && (
            <>
              <circle
                cx={24}
                cy={82}
                r={4}
                fill="#ffffff"
                stroke="#111827"
                strokeWidth={ICON_STROKE}
              />
              <circle
                cx={12}
                cy={92}
                r={2.5}
                fill="#ffffff"
                stroke="#111827"
                strokeWidth={ICON_STROKE}
              />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}

// ----------
// ≡（メニュー）
// ----------
export function MenuSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7H20M4 12H20M4 17H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 📁（フォルダ）
// ----------
export function FolderSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 後ろ側：見えている部分だけ */}
      <path
        d="M3 18.5V7.5C3 6.7 3.7 6 4.5 6H9L11 8H17.1C17.9 8 18.6 8.7 18.6 9.5V12"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 手前ポケット */}
      <path
        d="M5.3 12H20L18.3 19H3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// 💾（保存）
// ----------
export function SaveSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4H17L20 7V20H5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      <rect
        x="8"
        y="4"
        width="8"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      <rect
        x="8"
        y="14"
        width="8"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      <line
        x1="14"
        y1="5.5"
        x2="14"
        y2="8.5"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// ↗（共有／出力）
// ----------
export function ShareSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 外枠 */}
      <path
        d="M5 10V19C5 19.6 5.4 20 6 20H18C18.6 20 19 19.6 19 19V13"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 10V6C5 5.4 5.4 5 6 5H11"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 矢印 */}
      <path
        d="M10 16C10 9.5 13 6 18 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      <path
        d="M15 3L19 6L15 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PngFileSvgIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* 太陽 */}
      <circle
        cx="8"
        cy="8"
        r="1.8"
        fill="currentColor"
      />

      {/* 山 */}
      <path
        d="M3 19L9 12L13 16L18 9L22 19Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PdfFileSvgIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* 接続線 */}
      <path
        d="M11.9 10.9L9.4 15.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
        strokeLinecap="round"
      />

      <path
        d="M12.1 10.9L14.6 15.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
        strokeLinecap="round"
      />

      <path
        d="M10.4 16.3H13.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
        strokeLinecap="round"
      />

      {/* 丸 */}
      <circle
        cx="12"
        cy="8.3"
        r="2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
      />

      <circle
        cx="7"
        cy="18"
        r="2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
      />

      <circle
        cx="17"
        cy="18"
        r="2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.2}
      />
    </svg>
  );
}

// ----------
// 戻す（Undo）
// ----------
export function UndoSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 7L5 11L9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11H14.5C17.5 11 20 13.3 20 16.3C20 17.7 19.5 19 18.6 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// 進む（Redo）
// ----------
export function RedoSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 7L19 11L15 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11H9.5C6.5 11 4 13.3 4 16.3C4 17.7 4.5 19 5.4 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ＋
// ----------
export function PlusSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5V19M5 12H19"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// −
// ----------
export function MinusSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12H19"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// ×
// ----------
export function CloseSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6L18 18M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// ↔
// ----------
export function ArrowHorizontalSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 12H20M4 12L8 8M4 12L8 16M20 12L16 8M20 12L16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ↕
// ----------
export function ArrowVerticalSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4V20M12 4L8 8M12 4L16 8M12 20L8 16M12 20L16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ⤡ ⤢
// ----------
export function DiagonalResizeSvgIcon({
  direction,
}: {
  direction: "nwse" | "nesw";
}) {
  const rotate = direction === "nwse" ? 90 : 0;

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M5 5L19 19M5 5L5 11M5 5L11 5M19 19L13 19M19 19L19 13"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ∠
// ----------
export function AngleSvgIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: "rotate(-90deg)" }}
    >
      <path
        d="M6 18L6 6L18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ✓
// ----------
export function CheckSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 13L10 18L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ▲ ▼ ◀ ▶
// ----------
export function TriangleSvgIcon({
  direction,
}: {
  direction: "up" | "down" | "left" | "right";
}) {
  const rotate =
    direction === "up"
      ? 0
      : direction === "right"
      ? 90
      : direction === "down"
      ? 180
      : 270;

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M12 6L18 16H6Z" fill="currentColor" />
    </svg>
  );
}

// ----------
// ↑ ↓ ← →
// ----------
export function ArrowSvgIcon({
  direction,
}: {
  direction: "up" | "down" | "left" | "right";
}) {
  const rotate =
    direction === "up"
      ? 0
      : direction === "right"
      ? 90
      : direction === "down"
      ? 180
      : 270;

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M12 5V19M12 5L8 9M12 5L16 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FitSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 左上 */}
      <path
        d="M4 9V4H9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 右上 */}
      <path
        d="M15 4H20V9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 左下 */}
      <path
        d="M4 15V20H9"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 右下 */}
      <path
        d="M15 20H20V15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// 🔄（リセット）
// ----------
export function ResetSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 円弧 */}
      <path
        d="M19.2 13.4a7.2 7.2 0 1 1-2.1-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* 矢印 */}
      <path
        d="M19.2 3.8V9.6H13.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// 🗑（削除）
// ----------
export function TrashSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* フタ */}
      <path
        d="M4 7H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* 本体 */}
      <rect
        x="6"
        y="7"
        width="12"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      {/* 取っ手 */}
      <path
        d="M9 7V5H15V7"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* 中の線 */}
      <path
        d="M10 11V17M14 11V17"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 文字色（黒／白／白縁黒／黒縁白）
// ----------
export function TextColorSvgIcon({
  type,
}: {
  type:
    | "black"
    | "white"
    | "blackWithWhiteOutline"
    | "whiteWithBlackOutline";
}) {
  const isBlackWithWhiteOutline = type === "blackWithWhiteOutline";
  const isWhiteWithBlackOutline = type === "whiteWithBlackOutline";

  const backgroundFill =
    type === "black"
      ? "#ffffff"
      : type === "white"
      ? "#111827"
      : isBlackWithWhiteOutline
      ? "#111827"
      : "#ffffff";

  const textFill =
    type === "white" || isWhiteWithBlackOutline ? "#ffffff" : "#111827";

  const textStroke = isBlackWithWhiteOutline
    ? "#ffffff"
    : isWhiteWithBlackOutline
    ? "#111827"
    : "none";

  const textStrokeWidth =
    isBlackWithWhiteOutline || isWhiteWithBlackOutline ? 2.4 : 0;

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill={backgroundFill}
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />

      <text
        x="12"
        y="15.7"
        textAnchor="middle"
        fontSize="10"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fill={textFill}
        stroke={textStroke}
        strokeWidth={textStrokeWidth}
        paintOrder="stroke fill"
      >
        A
      </text>
    </svg>
  );
}
// ----------
// 文字背景（吹き出し：黒／白／透明＋しっぽ）
// ----------
export function TextBackgroundSvgIcon({
  type,
}: {
  type: "black" | "white" | "transparent" | "color";
}) {
  const isColor = type === "color";
  const fill =
    type === "black"
      ? "#111827"
      : type === "white"
      ? "#ffffff"
      : isColor
      ? "url(#textBackgroundRainbowGradient)"
      : "none";

  const strokeWidth = ICON_STROKE;

  return (
    <span
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          display: "block",
          overflow: "visible",
        }}
      >
        {isColor && (
          <defs>
            <linearGradient
              id="textBackgroundRainbowGradient"
              x1="18"
              y1="18"
              x2="86"
              y2="82"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="18%" stopColor="#f97316" />
              <stop offset="34%" stopColor="#facc15" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="66%" stopColor="#06b6d4" />
              <stop offset="82%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        )}

        {/* 本体 */}
        <g transform="translate(50 50) scale(0.75 0.95) translate(-50 -50)">
          <path
            d={bubbleSvgPath("ellipse", 10)}
            fill={fill}
            stroke="#111827"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* しっぽ */}
        <path
          d="M78 70 L86 80 L76 78 Z"
          fill={fill}
          stroke="#111827"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// ----------
// 🔍＋虫眼鏡
// ----------
export function MagnifierSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      <path
        d="M15 15L20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      {/* ＋ */}
      <path
        d="M10.5 7.9V13.1"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />

      <path
        d="M7.9 10.5H13.1"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// ⚙（設定）
// ----------
export function SettingsSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 外側ギア */}
      <path
        d="
          M12 3.8
          L13.4 3.8
          L14 5.7
          C14.5 5.9 15 6.1 15.4 6.4
          L17.2 5.7
          L18.2 6.7
          L17.5 8.5
          C17.8 8.9 18 9.4 18.2 9.9
          L20.1 10.5
          L20.1 11.9
          L18.2 12.5
          C18 13 17.8 13.5 17.5 13.9
          L18.2 15.7
          L17.2 16.7
          L15.4 16
          C15 16.3 14.5 16.5 14 16.7
          L13.4 18.6
          L12 18.6
          L11.4 16.7
          C10.9 16.5 10.4 16.3 10 16
          L8.2 16.7
          L7.2 15.7
          L7.9 13.9
          C7.6 13.5 7.4 13 7.2 12.5
          L5.3 11.9
          L5.3 10.5
          L7.2 9.9
          C7.4 9.4 7.6 8.9 7.9 8.5
          L7.2 6.7
          L8.2 5.7
          L10 6.4
          C10.4 6.1 10.9 5.9 11.4 5.7
          Z
        "
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
      />

      {/* 中央 */}
      <circle
        cx="12.7"
        cy="11.2"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />
    </svg>
  );
}

// ----------
// 言語
// ----------
export function LanguageSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 横顔シルエット */}
      <path
        d="
          M2.4 21.2
          L8.7 21.2
          L8.3 19.6

          C8 18.7 7.9 17.8 8.1 17
          C8.3 16.3 8.8 15.8 9.5 15.4

          L10 15.1
          C10.4 14.9 10.5 14.6 10.4 14.3
          L10.2 13.8
          L10.8 13.6
          C11.1 13.5 11.2 13.2 10.9 13
          L10.4 12.8
          L11 12.4
          C11.3 12.2 11.3 11.9 11 11.7

          L10.4 11.3
          C10.3 11 10.3 10.7 10.3 10.4

          C10.3 8.1 8.5 6.6 6.2 6.6
          C3.6 6.6 2.1 8.5 2.1 11

          C2.1 13.1 3.1 14.8 4.7 15.7
          C4.8 16.8 4.4 18.2 3.7 19.4
          Z
        "
        fill="currentColor"
      />

      {/* 吹き出し */}
      <path
        d="
          M17.8 3.2
          C20.5 3.2 22.2 5.7 22.2 9.3
          C22.2 12.9 20.5 15.4 17.8 15.4
          C16.9 15.4 16.1 15.2 15.4 14.8

          L12.6 15.6
          L14.2 13.4

          C13.5 12.3 13.2 10.9 13.2 9.3
          C13.2 5.7 15 3.2 17.8 3.2
          Z
        "
        fill="#ffffff"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// 横書き
// ----------
export function HorizontalWritingSvgIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* A */}
      <path
        d="M5 19L8.5 7L12 19"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.8 14H10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.4}
        strokeLinecap="round"
      />

      {/* → */}
      <path
        d="M14 12H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.5}
        strokeLinecap="round"
      />

      <path
        d="M17 9L20 12L17 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
// ----------
// 縦書き
// ----------
export function VerticalWritingSvgIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: "rotate(90deg)" }}
    >
      {/* A */}
      <path
        d="M5 19L8.5 7L12 19"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.8 14H10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.4}
        strokeLinecap="round"
      />

      {/* → */}
      <path
        d="M14 12H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.5}
        strokeLinecap="round"
      />

      <path
        d="M17 9L20 12L17 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------
// ヘルプ
// ----------
export function HelpSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      <path
        d="
          M9.7 9.2
          C9.9 7.8 10.9 7 12.2 7
          C13.8 7 14.8 7.9 14.8 9.2
          C14.8 10.2 14.3 10.9 13.3 11.5
          C12.4 12 12 12.6 12 13.7
        "
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12 16.7H12.01"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 国旗
// ----------
export function FlagSvgIcon({
  country,
}: {
  country: "us" | "jp" | "kr" | "cn" | "fr" | "ru" | "es" | "de";
}) {
  const w = 18;
  const h = 12;

  return (
    <svg width={w} height={h} viewBox="0 0 18 12" aria-hidden="true">
      <rect x="0" y="0" width="18" height="12" rx="1.5" fill="#ffffff" />

      {country === "us" && (
        <>
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} x="0" y={i * 2} width="18" height="1" fill="#b91c1c" />
          ))}
          <rect x="0" y="0" width="7.5" height="6.5" fill="#1d4ed8" />
          <circle cx="2" cy="2" r="0.35" fill="#ffffff" />
          <circle cx="4" cy="2" r="0.35" fill="#ffffff" />
          <circle cx="6" cy="2" r="0.35" fill="#ffffff" />
          <circle cx="3" cy="4" r="0.35" fill="#ffffff" />
          <circle cx="5" cy="4" r="0.35" fill="#ffffff" />
        </>
      )}

      {country === "jp" && <circle cx="9" cy="6" r="3" fill="#dc2626" />}

      {country === "kr" && (
        <>
          <circle cx="9" cy="6" r="3" fill="#dc2626" />
          <path d="M6 6A3 3 0 0 0 12 6A1.5 1.5 0 0 0 9 6A1.5 1.5 0 0 1 6 6Z" fill="#2563eb" />
          <path d="M3 2.2L5.2 3.5M12.8 8.5L15 9.8M12.8 3.5L15 2.2M3 9.8L5.2 8.5" stroke="#111827" strokeWidth="0.8" />
        </>
      )}

      {country === "cn" && (
        <>
          <rect width="18" height="12" fill="#dc2626" />
          <polygon points="3,2 3.5,3.4 5,3.4 3.8,4.2 4.3,5.6 3,4.8 1.7,5.6 2.2,4.2 1,3.4 2.5,3.4" fill="#facc15" />
          <circle cx="7" cy="2.5" r="0.55" fill="#facc15" />
          <circle cx="8.5" cy="4" r="0.55" fill="#facc15" />
          <circle cx="8.3" cy="6" r="0.55" fill="#facc15" />
          <circle cx="6.8" cy="7.5" r="0.55" fill="#facc15" />
        </>
      )}

      {country === "fr" && (
        <>
          <rect x="0" y="0" width="6" height="12" fill="#2563eb" />
          <rect x="6" y="0" width="6" height="12" fill="#ffffff" />
          <rect x="12" y="0" width="6" height="12" fill="#dc2626" />
        </>
      )}

      {country === "ru" && (
        <>
          <rect x="0" y="0" width="18" height="4" fill="#ffffff" />
          <rect x="0" y="4" width="18" height="4" fill="#2563eb" />
          <rect x="0" y="8" width="18" height="4" fill="#dc2626" />
        </>
      )}

      {country === "es" && (
        <>
          <rect width="18" height="12" fill="#facc15" />
          <rect y="0" width="18" height="3" fill="#dc2626" />
          <rect y="9" width="18" height="3" fill="#dc2626" />
        </>
      )}

      {country === "de" && (
        <>
          <rect y="0" width="18" height="4" fill="#111827" />
          <rect y="4" width="18" height="4" fill="#dc2626" />
          <rect y="8" width="18" height="4" fill="#facc15" />
        </>
      )}

      <rect x="0.35" y="0.35" width="17.3" height="11.3" rx="1.2" fill="none" stroke="#000000" strokeOpacity="0.15" strokeWidth="0.7" />
    </svg>
  );
}

// ----------
// RGB色設定
// ----------
export function FreeTextColorSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient
          id="freeTextColorRainbowGradient"
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="18%" stopColor="#f97316" />
          <stop offset="34%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="66%" stopColor="#06b6d4" />
          <stop offset="82%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill="url(#freeTextColorRainbowGradient)"
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />

      <text
        x="12"
        y="15.7"
        textAnchor="middle"
        fontSize="10"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fill="#ffffff"
        stroke="#111827"
        strokeWidth="2.4"
        paintOrder="stroke fill"
      >
        A
      </text>
    </svg>
  );
}

export function RgbChannelSvgIcon({ channel }: { channel: "R" | "G" | "B" }) {
  const fill =
    channel === "R" ? "#ef4444" : channel === "G" ? "#22c55e" : "#3b82f6";

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        fill={fill}
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="900"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
        stroke="#111827"
        strokeWidth="0.35"
        paintOrder="stroke"
      >
        {channel}
      </text>
    </svg>
  );
}

export function ColorPreviewSvgIcon({ color }: { color: string }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        fill={color}
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />
      <path
        d="M5.5 5.5H18.5V8.2H5.5Z"
        fill="#ffffff"
        opacity="0.22"
      />
    </svg>
  );
}


// ----------
// なし
// ----------
export function NoneSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE}
      />

      <path
        d="M6.5 17.5L17.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE * 1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ----------
// 集中線
// ----------
export function FocusLineSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 線数を抑えた漫画集中線 */}
      <g fill="currentColor">
        <path d="M0 0H1.1L8.2 7.6Z" />
        <path d="M5.2 0H5.9L9.6 6.8Z" />
        <path d="M11.8 0H12.3L12.1 6.2Z" />
        <path d="M18.1 0H18.9L14.4 6.9Z" />
        <path d="M22.9 0H24L15.8 7.6Z" />

        <path d="M0 2.5V3.5L7.5 8.7Z" />
        <path d="M0 9.4V10L6.4 10.9Z" />
        <path d="M0 15.6V16.2L6.5 13.4Z" />
        <path d="M0 22.8V24H1.2L8.1 16.3Z" />

        <path d="M24 2.5V3.5L16.5 8.7Z" />
        <path d="M24 9.4V10L17.6 10.9Z" />
        <path d="M24 15.6V16.2L17.5 13.4Z" />
        <path d="M22.8 24H24V22.8L15.9 16.3Z" />

        <path d="M5.3 24H6.1L9.7 17.2Z" />
        <path d="M11.7 24H12.2L12 17.8Z" />
        <path d="M18 24H18.8L14.3 17.1Z" />
      </g>

      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="round"
      >
        <path d="M2.8 0L8.8 7.2" strokeWidth={ICON_STROKE * 0.38} />
        <path d="M8.4 0L10.5 6.5" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M15.5 0L13.5 6.5" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M21.2 0L15.2 7.2" strokeWidth={ICON_STROKE * 0.38} />

        <path d="M0 5.8L6.9 9.7" strokeWidth={ICON_STROKE * 0.34} />
        <path d="M0 12.4L6.1 12.1" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M0 19.2L7.1 14.8" strokeWidth={ICON_STROKE * 0.36} />

        <path d="M24 5.8L17.1 9.7" strokeWidth={ICON_STROKE * 0.34} />
        <path d="M24 12.4L17.9 12.1" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M24 19.2L16.9 14.8" strokeWidth={ICON_STROKE * 0.36} />

        <path d="M2.9 24L8.8 16.8" strokeWidth={ICON_STROKE * 0.38} />
        <path d="M8.4 24L10.6 17.6" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M15.5 24L13.4 17.6" strokeWidth={ICON_STROKE * 0.32} />
        <path d="M21.1 24L15.2 16.8" strokeWidth={ICON_STROKE * 0.38} />
      </g>
    </svg>
  );
}

// ----------
// スピード線
// ----------
export function SpeedLineSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {/* 線数を抑えた漫画スピード線 */}
      <g fill="currentColor">
        <path d="M0 2.0H7.2L14.5 2.25L7.2 2.5H0Z" />
        <path d="M0 4.3H11.5L20.4 4.55L11.5 4.82H0Z" />
        <path d="M0 6.9H6.7L13.6 7.12L6.7 7.38H0Z" />
        <path d="M0 9.4H13.2L22.6 9.68L13.2 9.98H0Z" />
        <path d="M0 12.2H8.6L16.8 12.45L8.6 12.75H0Z" />
        <path d="M0 15.1H12.2L21.2 15.38L12.2 15.7H0Z" />
        <path d="M0 18.0H7.6L15.2 18.25L7.6 18.55H0Z" />
        <path d="M0 20.9H10.4L18.4 21.15L10.4 21.45H0Z" />
      </g>

      <g fill="none" stroke="currentColor" strokeLinecap="butt">
        <path d="M0 3.2H12.8" strokeWidth={ICON_STROKE * 0.22} />
        <path d="M0 5.6H17.3" strokeWidth={ICON_STROKE * 0.24} />
        <path d="M0 8.1H11.2" strokeWidth={ICON_STROKE * 0.2} />
        <path d="M0 10.9H19.5" strokeWidth={ICON_STROKE * 0.24} />
        <path d="M0 13.7H14.6" strokeWidth={ICON_STROKE * 0.2} />
        <path d="M0 16.7H18.2" strokeWidth={ICON_STROKE * 0.22} />
        <path d="M0 19.5H12.6" strokeWidth={ICON_STROKE * 0.2} />
        <path d="M0 22.3H15.8" strokeWidth={ICON_STROKE * 0.22} />
      </g>
    </svg>
  );
}

// ----------
// 白
// ----------
export function WhiteFillSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />
    </svg>
  );
}

// ----------
// 黒
// ----------
export function BlackFillSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        fill="#111827"
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />
    </svg>
  );
}

// ----------
// 虹グラデーション
// ----------
export function RainbowFillSvgIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient
          id="rainbowFillGradient"
          x1="3.5"
          y1="3.5"
          x2="20.5"
          y2="20.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="16%" stopColor="#f97316" />
          <stop offset="32%" stopColor="#facc15" />
          <stop offset="48%" stopColor="#22c55e" />
          <stop offset="64%" stopColor="#06b6d4" />
          <stop offset="80%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        fill="url(#rainbowFillGradient)"
        stroke="#111827"
        strokeWidth={ICON_STROKE}
      />
    </svg>
  );
}

// ----------
// モザイク追加
// ----------
export function MosaicAddSvgIcon() {
  const cellSize = 4;
  const startX = 2;
  const startY = 2;

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
      {[0, 1, 2, 3].flatMap((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={startX + col * cellSize}
            y={startY + row * cellSize}
            width={cellSize}
            height={cellSize}
            fill={(row + col) % 2 === 0 ? "#111827" : "#ffffff"}
          />
        ))
      )}

      <circle
        cx="17.5"
        cy="17.5"
        r="6.2"
        fill="#111827"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE}
      />

      <path
        d="M13.7 17.5H21.3M17.5 13.7V21.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={ICON_STROKE * 1.15}
        strokeLinecap="round"
      />
    </svg>
  );
}
