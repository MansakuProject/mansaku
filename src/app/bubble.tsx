import type { Bubble, BubbleShape } from "./types";

import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  BUBBLE_STROKE_PX,
  ELECTRONIC_OUTER_STROKE_PX,
  ELECTRONIC_CENTER_WHITE_STROKE_PX,
  ELECTRONIC_TAIL_STROKE_PX,
  BOUNDARY_INSET,
  INSIDE_TAIL_BASE_OUTSET_PX,
  TAIL_OVERLAP_PX,
  OUTSIDE_BUBBLE_COVER_SHIFT_PX,
  OUTSIDE_BUBBLE_COVER_DEPTH_PX,
  OUTSIDE_BUBBLE_COVER_HALF_EXTRA_PX,
} from "./constants";

function normalizeTonePercent(value: number | undefined, fallback: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type BubbleFreeBackgroundFields = {
  freeBubbleBackgroundColor?: string;
  freeBubbleTone?: number;
  freeBubbleBorderEnabled?: boolean;
  freeBubbleBorderColor?: string;
};

function getBubbleFreeBackgroundFields(bubble: Bubble) {
  return bubble as Bubble & BubbleFreeBackgroundFields;
}

function getBubbleFreeBackgroundColor(bubble: Bubble) {
  return getBubbleFreeBackgroundFields(bubble).freeBubbleBackgroundColor;
}

function getBubbleFreeTone(bubble: Bubble) {
  return normalizeTonePercent(
    getBubbleFreeBackgroundFields(bubble).freeBubbleTone,
    0,
  );
}

function isBubbleFreeBackgroundMode(bubble: Bubble) {
  return getBubbleFreeBackgroundColor(bubble) != null;
}

function isBubbleFreeBorderEnabled(bubble: Bubble) {
  return !!getBubbleFreeBackgroundFields(bubble).freeBubbleBorderEnabled;
}

function getBubbleFreeBorderColor(bubble: Bubble) {
  return (
    getBubbleFreeBackgroundFields(bubble).freeBubbleBorderColor ?? "#111827"
  );
}

export function getBubbleOutlineStrokeColorForSvg(bubble: Bubble) {
  if (!isBubbleFreeBackgroundMode(bubble)) {
    return getBubbleToneBackgroundColor(bubble) === "black"
      ? getBubbleBackgroundFillForSvg(bubble)
      : "#111";
  }

  return isBubbleFreeBorderEnabled(bubble)
    ? getBubbleFreeBorderColor(bubble)
    : "none";
}

export function getBubbleOutlineStrokeWidthForSvg(
  bubble: Bubble,
  defaultStrokeWidth: number,
) {
  return getBubbleOutlineStrokeColorForSvg(bubble) === "none"
    ? 0
    : defaultStrokeWidth;
}

function getBubbleInsideTailOutlineStrokeWidthForSvg(bubble: Bubble) {
  if (bubble.shape === "electronic") {
    return getBubbleOutlineStrokeWidthForSvg(bubble, ELECTRONIC_TAIL_STROKE_PX);
  }

  const onePointPx = 96 / 72;
  const strokeWidth =
    getBubbleToneBackgroundColor(bubble) === "transparent"
      ? Math.max(BUBBLE_STROKE_PX, BUBBLE_STROKE_PX * 3 - onePointPx)
      : BUBBLE_STROKE_PX;

  return getBubbleOutlineStrokeWidthForSvg(bubble, strokeWidth);
}

export function getBubbleToneBackgroundColor(bubble: Bubble) {
  if (getBubbleFreeBackgroundColor(bubble) != null) {
    return getBubbleFreeTone(bubble) >= 100 ? "color" : "transparent";
  }

  const whiteTone = normalizeTonePercent(bubble.whiteTone, 100);
  const blackTone = normalizeTonePercent(bubble.blackTone, 0);

  if (whiteTone >= 100) return "white";
  if (blackTone >= 100) return "black";
  return "transparent";
}

export function shouldDrawBubbleToneDots(bubble: Bubble) {
  if (getBubbleFreeBackgroundColor(bubble) != null) {
    const colorTone = getBubbleFreeTone(bubble);
    return colorTone >= 1 && colorTone <= 99;
  }

  const whiteTone = normalizeTonePercent(bubble.whiteTone, 100);
  const blackTone = normalizeTonePercent(bubble.blackTone, 0);

  return (
    (whiteTone >= 1 && whiteTone <= 99) || (blackTone >= 1 && blackTone <= 99)
  );
}

export function getBubbleToneDotStyle(
  bubble: Bubble,
): React.CSSProperties | null {
  const freeBackgroundColor = getBubbleFreeBackgroundColor(bubble);
  const whiteTone = normalizeTonePercent(bubble.whiteTone, 100);
  const blackTone = normalizeTonePercent(bubble.blackTone, 0);

  const tonePercent =
    freeBackgroundColor != null
      ? getBubbleFreeTone(bubble)
      : blackTone >= 1 && blackTone <= 99
        ? blackTone
        : whiteTone;

  const isBlackTone =
    freeBackgroundColor == null && blackTone >= 1 && blackTone <= 99;

  if (tonePercent < 1 || tonePercent > 99) {
    return null;
  }

  const density = tonePercent / 100;

  const dotSize = 0.7 + density * 1;
  const gridSize = 15 - density * 12;

  const color =
    freeBackgroundColor != null
      ? freeBackgroundColor
      : isBlackTone
        ? "rgba(17,17,17,0.85)"
        : "rgba(255,255,255,0.9)";

  return {
    position: "absolute",
    inset: "-50%",
    pointerEvents: "none",
    backgroundImage: `radial-gradient(circle, ${color} 0 ${dotSize}px, transparent ${
      dotSize + 0.2
    }px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: "0 0",
    transform: "rotate(45deg)",
    transformOrigin: "center",
  };
}

function getBubbleBackgroundFill(bubble: Bubble) {
  switch (getBubbleToneBackgroundColor(bubble)) {
    case "color":
      return getBubbleFreeBackgroundColor(bubble) ?? "#ffffff";
    case "black":
      return "#111827";
    case "transparent":
      return "transparent";
    case "white":
    default:
      return "#ffffff";
  }
}

function getElectronicCenterStrokeColorForSvg(bubble: Bubble) {
  const outlineColor = getBubbleOutlineStrokeColorForSvg(bubble);

  if (outlineColor === "none") return "none";
  if (getBubbleToneBackgroundColor(bubble) === "black") return "#ffffff";

  return outlineColor;
}

export function getBubbleBackgroundFillForSvg(bubble: Bubble) {
  const backgroundColor = getBubbleToneBackgroundColor(bubble);

  if (backgroundColor === "transparent") {
    return "none";
  }

  return getBubbleBackgroundFill(bubble);
}

function getBubbleVisualScale(shape: BubbleShape) {
  switch (shape) {
    case "ellipse":
      return 1.03;
    case "heptagon":
      return 1.01;
    case "cornerSpiky":
      return 1.01;
    case "electronic":
      return 1;
    case "cloud":
      return 0.96;
    case "wave":
      return 1.08;
    case "flash":
    case "uniFlash":
      return 1;
    case "rect":
    default:
      return 1;
  }
}

function scaleFromCenter(value: number, scale: number) {
  return 50 + (value - 50) * scale;
}

const FLASH_BODY_RX = 48;
const FLASH_BODY_RY = 50;
const FLASH_SHORT_LINE_LEN = 11;
const FLASH_HIDDEN_LINE_LEN = 12;
const FLASH_LINE_LENGTH_PATTERN = [
  FLASH_SHORT_LINE_LEN,
  FLASH_HIDDEN_LINE_LEN,
] as const;
const FLASH_LINE_COUNT = 192;
const FLASH_LINE_STROKE_PX = BUBBLE_STROKE_PX * 0.55;

function getFlashLineLength(lineIndex: number) {
  return FLASH_LINE_LENGTH_PATTERN[
    lineIndex % FLASH_LINE_LENGTH_PATTERN.length
  ];
}

function flashBodyPath() {
  return `
    M ${50 - FLASH_BODY_RX} 50
    A ${FLASH_BODY_RX} ${FLASH_BODY_RY} 0 1 0 ${50 + FLASH_BODY_RX} 50
    A ${FLASH_BODY_RX} ${FLASH_BODY_RY} 0 1 0 ${50 - FLASH_BODY_RX} 50
    Z
  `;
}

export function bubbleSvgPath(shape: BubbleShape, inset: number) {
  if (shape === "ellipse") {
    const visualScale = getBubbleVisualScale(shape);
    const l = inset;
    const t = inset;
    const r = 100 - inset;
    const b = 100 - inset;

    const cx = 50;
    const cy = 50;

    const rx = ((r - l) / 2) * visualScale;
    const ry = ((b - t) / 2) * visualScale;

    // 小さい方を基準にする
    const base = Math.min(rx, ry);

    // 丸み
    const k = 0.65;

    const curve = base * k;

    return `
      M ${cx - rx} ${cy}

      C
        ${cx - rx} ${cy - curve}
        ${cx - curve} ${cy - ry}
        ${cx} ${cy - ry}

      C
        ${cx + curve} ${cy - ry}
        ${cx + rx} ${cy - curve}
        ${cx + rx} ${cy}

      C
        ${cx + rx} ${cy + curve}
        ${cx + curve} ${cy + ry}
        ${cx} ${cy + ry}

      C
        ${cx - curve} ${cy + ry}
        ${cx - rx} ${cy + curve}
        ${cx - rx} ${cy}

      Z
    `;
  }

  if (shape === "heptagon") {
    // 「角ばり」吹き出し：爆発形状ベースで四隅のとげを内側に反らせた形
    // 4辺は小さなギザギザ、四隅は外向きではなく内向きに凹む
    const cx = 50;
    const cy = 50;

    const visualScale = getBubbleVisualScale(shape);
    const l = scaleFromCenter(inset, visualScale);
    const t = scaleFromCenter(inset, visualScale);
    const r = scaleFromCenter(100 - inset, visualScale);
    const b = scaleFromCenter(100 - inset, visualScale);

    // 辺のなだらかな膨らみパラメータ
    const span = Math.max(7.0, 9.5 - inset * 0.07);
    const curve = Math.max(1.5, 2.8 - inset * 0.06);

    // 隅の内向き凹みパラメータ
    // cornerDip: 隅を中心方向へ引き込む量
    const cornerDip = Math.max(1.5, 3.0 - inset * 0.05);
    // cornerSpan: 隅の凹みが始まる辺端からの距離
    const cornerSpan = Math.max(7.5, 10.0 - inset * 0.08);

    // 隅の内向き凹み：隅の手前2点から中心方向の制御点を使って凹む
    // cp は「辺の端点2点の中間を中心方向へ引き込んだ点」
    const cornerConcave = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      pullFactor: number,
    ) => {
      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;
      const toCx = cx - midX;
      const toCy = cy - midY;
      const len = Math.hypot(toCx, toCy) || 1;
      const cpX = midX + (toCx / len) * pullFactor;
      const cpY = midY + (toCy / len) * pullFactor;
      return `Q ${cpX.toFixed(2)} ${cpY.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`;
    };

    const parts: string[] = [];

    // 上辺：左端 → ギザギザ → 右端
    parts.push(`M ${(l + cornerSpan).toFixed(2)} ${t.toFixed(2)}`);
    parts.push(
      `Q 50 ${(t + curve).toFixed(2)} ${(r - cornerSpan).toFixed(2)} ${t.toFixed(2)}`,
    );

    // 右上隅：内向き凹み
    parts.push(cornerConcave(r - cornerSpan, t, r, t + cornerSpan, cornerDip));

    // 右辺：ギザギザ
    parts.push(
      `Q ${(r - curve).toFixed(2)} 50 ${r.toFixed(2)} ${(b - cornerSpan).toFixed(2)}`,
    );

    // 右下隅：内向き凹み
    parts.push(cornerConcave(r, b - cornerSpan, r - cornerSpan, b, cornerDip));

    // 下辺：ギザギザ
    parts.push(
      `Q 50 ${(b - curve).toFixed(2)} ${(l + cornerSpan).toFixed(2)} ${b.toFixed(2)}`,
    );

    // 左下隅：内向き凹み
    parts.push(cornerConcave(l + cornerSpan, b, l, b - cornerSpan, cornerDip));

    // 左辺：ギザギザ
    parts.push(
      `Q ${(l + curve).toFixed(2)} 50 ${l.toFixed(2)} ${(t + cornerSpan).toFixed(2)}`,
    );

    // 左上隅：内向き凹み
    parts.push(cornerConcave(l, t + cornerSpan, l + cornerSpan, t, cornerDip));

    parts.push("Z");
    return parts.join("\n");
  }

  if (shape === "rect") {
    const l = inset;
    const t = inset;
    const r = 100 - inset;
    const b = 100 - inset;
    return `M ${l} ${t} L ${r} ${t} L ${r} ${b} L ${l} ${b} Z`;
  }

  if (shape === "electronic") {
    const visualScale = getBubbleVisualScale(shape);
    const l = scaleFromCenter(inset, visualScale);
    const t = scaleFromCenter(inset, visualScale);
    const r = scaleFromCenter(100 - inset, visualScale);
    const b = scaleFromCenter(100 - inset, visualScale);

    const cut = 18;

    return `
      M ${l + cut} ${t}
      L ${r - cut} ${t}
      L ${r} ${t + cut}
      L ${r} ${b - cut}
      L ${r - cut} ${b}
      L ${l + cut} ${b}
      L ${l} ${b - cut}
      L ${l} ${t + cut}
      Z
    `;
  }

  if (shape === "cloud") {
    const visualScale = getBubbleVisualScale(shape);
    const cx = 50;
    const cy = 50;

    // 外周を「円の集合の合成」で作る
    // つまり、本当に丸を重ねたみたいな輪郭になる
    const blobs = [
      // 中央
      { x: 50, y: 50, r: 48 - inset * 0.2 },

      // 上
      { x: 50, y: 28 + inset * 0.2, r: 32 - inset * 0.1 },

      // 右上
      { x: 66 - inset * 0.2, y: 34, r: 32 - inset * 0.1 },

      // 右
      { x: 72 - inset * 0.2, y: 50, r: 32 - inset * 0.1 },

      // 右下
      { x: 66 - inset * 0.2, y: 66, r: 32 - inset * 0.1 },

      // 下
      { x: 50, y: 72 - inset * 0.2, r: 32 - inset * 0.1 },

      // 左下
      { x: 34 + inset * 0.2, y: 66, r: 32 - inset * 0.1 },

      // 左
      { x: 28 + inset * 0.2, y: 50, r: 32 - inset * 0.1 },

      // 左上
      { x: 34 + inset * 0.2, y: 34, r: 32 - inset * 0.1 },
    ];

    const points = 240;
    const cmds: string[] = [];

    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const ux = Math.cos(t);
      const uy = Math.sin(t);

      let bestDist = 0;

      for (const c of blobs) {
        const ox = cx - c.x;
        const oy = cy - c.y;

        const b = 2 * (ux * ox + uy * oy);
        const cc = ox * ox + oy * oy - c.r * c.r;
        const disc = b * b - 4 * cc;

        if (disc < 0) continue;

        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / 2;
        const t2 = (-b + sqrtDisc) / 2;
        const hit = Math.max(t1, t2);

        if (hit > bestDist) bestDist = hit;
      }

      const x = scaleFromCenter(cx + ux * bestDist, visualScale);
      const y = scaleFromCenter(cy + uy * bestDist, visualScale);

      cmds.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    cmds.push("Z");
    return cmds.join(" ");
  }

  if (shape === "wave") {
    const visualScale = getBubbleVisualScale(shape);
    const cx = 50;
    const cy = 50;
    const rx = 50 - inset;
    const ry = 50 - inset;

    const lobes = 8;
    const amp = 2;
    const points = 220;

    const cmds: string[] = [];

    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wave = Math.sin(t * lobes) * amp;

      const x = scaleFromCenter(cx + Math.cos(t) * (rx + wave), visualScale);
      const y = scaleFromCenter(cy + Math.sin(t) * (ry + wave), visualScale);

      cmds.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    cmds.push("Z");
    return cmds.join(" ");
  }

  if (shape === "flash") {
    const visualScale = getBubbleVisualScale(shape);
    const cx = 50;
    const cy = 50;
    const rx = FLASH_BODY_RX;
    const ry = FLASH_BODY_RY;
    const cmds: string[] = [];

    for (let lineIndex = 0; lineIndex < FLASH_LINE_COUNT; lineIndex++) {
      const angle = (lineIndex / FLASH_LINE_COUNT) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const lineLen = getFlashLineLength(lineIndex);
      const nextAngle = ((lineIndex + 1) / FLASH_LINE_COUNT) * Math.PI * 2;
      const nextCos = Math.cos(nextAngle);
      const nextSin = Math.sin(nextAngle);

      const baseX = scaleFromCenter(cx + cos * rx, visualScale);
      const baseY = scaleFromCenter(cy + sin * ry, visualScale);
      const nextBaseX = scaleFromCenter(cx + nextCos * rx, visualScale);
      const nextBaseY = scaleFromCenter(cy + nextSin * ry, visualScale);

      if (lineIndex === 0) {
        cmds.push(`M ${baseX.toFixed(2)} ${baseY.toFixed(2)}`);
      }

      if (lineLen > 0) {
        const tipX = scaleFromCenter(cx + cos * (rx + lineLen), visualScale);
        const tipY = scaleFromCenter(cy + sin * (ry + lineLen), visualScale);

        cmds.push(`L ${tipX.toFixed(2)} ${tipY.toFixed(2)}`);
      }

      cmds.push(`L ${nextBaseX.toFixed(2)} ${nextBaseY.toFixed(2)}`);
    }

    cmds.push("Z");
    return cmds.join(" ");
  }

  const visualScale = getBubbleVisualScale(shape);
  const l = scaleFromCenter(inset, visualScale);
  const t = scaleFromCenter(inset, visualScale);
  const r = scaleFromCenter(100 - inset, visualScale);
  const b = scaleFromCenter(100 - inset, visualScale);

  const spike = Math.max(1.6, 3.0 - inset * 0.08);
  const span = Math.max(8.5, 11 - inset * 0.08);
  const diag = spike;
  const curve = Math.max(1.8, 3.2 - inset * 0.08);
  const toothPull = 0.22;

  const lerp = (a: number, b2: number, p: number) => a + (b2 - a) * p;

  const tooth = (
    ax: number,
    ay: number,
    tx: number,
    ty: number,
    bx: number,
    by: number,
  ) => {
    const c1x = lerp((ax + tx) / 2, 50, toothPull);
    const c1y = lerp((ay + ty) / 2, 50, toothPull);
    const c2x = lerp((tx + bx) / 2, 50, toothPull);
    const c2y = lerp((ty + by) / 2, 50, toothPull);

    return `Q ${c1x} ${c1y} ${tx} ${ty} Q ${c2x} ${c2y} ${bx} ${by}`;
  };

  const parts: string[] = [];

  parts.push(`M ${l + span} ${t}`);
  parts.push(`Q 50 ${t + curve} ${r - span} ${t}`);

  parts.push(tooth(r - span * 0.68, t, r + diag, t - diag, r, t + span * 0.68));

  parts.push(`Q ${r - curve} 50 ${r} ${b - span}`);

  parts.push(tooth(r, b - span * 0.68, r + diag, b + diag, r - span * 0.68, b));

  parts.push(`Q 50 ${b - curve} ${l + span} ${b}`);

  parts.push(tooth(l + span * 0.68, b, l - diag, b + diag, l, b - span * 0.68));

  parts.push(`Q ${l + curve} 50 ${l} ${t + span}`);

  parts.push(tooth(l, t + span * 0.68, l - diag, t - diag, l + span * 0.68, t));

  parts.push("Z");

  return parts.join("\n");
}

function electronicBubbleStrokePathByInsetXY(insetX: number, insetY: number) {
  const l = insetX;
  const t = insetY;
  const r = 100 - insetX;
  const b = 100 - insetY;

  const cut = 18;

  // 角をどれだけ切るか
  const gap = 0.5;

  const points = [
    { x: l + cut, y: t },
    { x: r - cut, y: t },
    { x: r, y: t + cut },
    { x: r, y: b - cut },
    { x: r - cut, y: b },
    { x: l + cut, y: b },
    { x: l, y: b - cut },
    { x: l, y: t + cut },
  ];

  const parts: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const len = Math.hypot(dx, dy) || 1;

    const ux = dx / len;
    const uy = dy / len;

    // 始点終点を少し内側へ寄せる
    const sx = from.x + ux * gap;
    const sy = from.y + uy * gap;

    const ex = to.x - ux * gap;
    const ey = to.y - uy * gap;

    parts.push(`
      M ${sx.toFixed(2)} ${sy.toFixed(2)}
      L ${ex.toFixed(2)} ${ey.toFixed(2)}
    `);
  }

  return parts.join("\n");
}

export function electronicBubbleStrokePath(inset: number) {
  return electronicBubbleStrokePathByInsetXY(inset, inset);
}

function electronicBubbleStrokePathByOffsetPx(
  bubble: Bubble,
  offsetPx: number,
) {
  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

  const insetX = (offsetPx / bubblePixelW) * 100;
  const insetY = (offsetPx / bubblePixelH) * 100;

  return electronicBubbleStrokePathByInsetXY(insetX, insetY);
}

export const BUBBLE_MIN_TAIL_LENGTH_PX = 24;

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getBubbleFontSizeForTailPx(bubble: Partial<Pick<Bubble, "fontSize">>) {
  const fontSize = Number(bubble.fontSize ?? 22);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 22;
}

export function getThoughtTailDotDiameterPx(
  bubble: Partial<Pick<Bubble, "fontSize">>,
  kind: "root" | "tip",
) {
  const fontSize = getBubbleFontSizeForTailPx(bubble);
  const diameterPx =
    kind === "root" ? 14 + (fontSize - 22) * 0.2 : 10 + (fontSize - 22) * 0.15;

  return clampNumber(diameterPx, 10, 42);
}

export function getThoughtTailNoOverlapMinimumLengthPx(
  bubble: Partial<Pick<Bubble, "fontSize">>,
) {
  const rootDiameterPx = getThoughtTailDotDiameterPx(bubble, "root");
  const tipDiameterPx = getThoughtTailDotDiameterPx(bubble, "tip");
  const minimumGapPx = clampNumber(rootDiameterPx * 0.16, 4, 10);

  return rootDiameterPx + tipDiameterPx / 2 + minimumGapPx;
}

export function getBubbleMinimumTailLengthPx(
  bubble: Pick<Bubble, "w" | "h"> &
    Partial<Pick<Bubble, "shape" | "tailStyle" | "fontSize">>,
) {
  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;
  const shortSidePx = Math.min(bubblePixelW, bubblePixelH);

  if (!Number.isFinite(shortSidePx) || shortSidePx <= 0) {
    return BUBBLE_MIN_TAIL_LENGTH_PX;
  }

  const visualScale = getBubbleVisualScale(bubble.shape ?? "ellipse");
  const visualScaleOffsetPx = Math.max(0, shortSidePx * (1 - visualScale));
  const normalMinimumTailLengthPx = clampNumber(
    shortSidePx * 0.12 + visualScaleOffsetPx,
    8,
    64,
  );

  if ((bubble.tailStyle ?? "triangle") !== "thought") {
    return normalMinimumTailLengthPx;
  }

  return Math.max(
    normalMinimumTailLengthPx,
    getThoughtTailNoOverlapMinimumLengthPx(bubble),
  );
}

function getBubbleInsideTailTipOffsetPx(bubble: Bubble) {
  return Math.min(12, getBubbleMinimumTailLengthPx(bubble) * 0.35);
}

function getBubbleRawTailLengthPx(bubble: Bubble) {
  const minimumTailLengthPx = getBubbleMinimumTailLengthPx(bubble);
  const tailLength = Number(bubble.tailLength ?? minimumTailLengthPx);
  if (!Number.isFinite(tailLength) || tailLength <= 0) return 0;
  return tailLength;
}

function getBubbleVisibleTailLengthPx(bubble: Bubble) {
  const tailLength = getBubbleRawTailLengthPx(bubble);
  if (tailLength <= 0) return 0;

  const minimumTailLengthPx = getBubbleMinimumTailLengthPx(bubble);

  // 外しっぽも内しっぽも、形状別の輪郭線から同じ見た目長さにする。
  return Math.max(minimumTailLengthPx, tailLength);
}

export type TailGeometry = {
  boundary: { x: number; y: number };
  bubblePixelW: number;
  bubblePixelH: number;
  unitX: number;
  unitY: number;
  perpX: number;
  perpY: number;
  baseHalfPx: number;
  baseLeftX: number;
  baseLeftY: number;
  baseRightX: number;
  baseRightY: number;
  tipX: number;
  tipY: number;
};

type Point100 = { x: number; y: number };

function getEllipseBoundaryPoint(
  angleDeg: number,
  bubblePixelW: number,
  bubblePixelH: number,
  shape: BubbleShape = "ellipse",
): Point100 {
  const theta = (angleDeg * Math.PI) / 180;
  const dirPxX = Math.cos(theta);
  const dirPxY = Math.sin(theta);
  const dx = dirPxX / bubblePixelW;
  const dy = dirPxY / bubblePixelH;
  const cx = 50;
  const cy = 50;
  const visualScale = getBubbleVisualScale(shape);
  const rx = (50 - BOUNDARY_INSET) * visualScale;
  const ry = (50 - BOUNDARY_INSET) * visualScale;
  const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

function addQuadraticPoints(
  points: Point100[],
  from: Point100,
  control: Point100,
  to: Point100,
  steps = 12,
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;

    points.push({
      x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
    });
  }
}

function addCubicPoints(
  points: Point100[],
  from: Point100,
  control1: Point100,
  control2: Point100,
  to: Point100,
  steps = 24,
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;

    points.push({
      x:
        mt * mt * mt * from.x +
        3 * mt * mt * t * control1.x +
        3 * mt * t * t * control2.x +
        t * t * t * to.x,
      y:
        mt * mt * mt * from.y +
        3 * mt * mt * t * control1.y +
        3 * mt * t * t * control2.y +
        t * t * t * to.y,
    });
  }
}

function getEllipseBoundaryPoints(inset: number): Point100[] {
  const visualScale = getBubbleVisualScale("ellipse");
  const l = inset;
  const t = inset;
  const r = 100 - inset;
  const b = 100 - inset;
  const cx = 50;
  const cy = 50;
  const rx = ((r - l) / 2) * visualScale;
  const ry = ((b - t) / 2) * visualScale;
  const base = Math.min(rx, ry);
  const k = 0.65;
  const curve = base * k;
  const points: Point100[] = [];

  let current: Point100 = { x: cx - rx, y: cy };
  points.push(current);

  const addC = (control1: Point100, control2: Point100, to: Point100) => {
    addCubicPoints(points, current, control1, control2, to);
    current = to;
  };

  addC(
    { x: cx - rx, y: cy - curve },
    { x: cx - curve, y: cy - ry },
    { x: cx, y: cy - ry },
  );
  addC(
    { x: cx + curve, y: cy - ry },
    { x: cx + rx, y: cy - curve },
    { x: cx + rx, y: cy },
  );
  addC(
    { x: cx + rx, y: cy + curve },
    { x: cx + curve, y: cy + ry },
    { x: cx, y: cy + ry },
  );
  addC(
    { x: cx - curve, y: cy + ry },
    { x: cx - rx, y: cy + curve },
    { x: cx - rx, y: cy },
  );

  return points;
}

function getHeptagonBoundaryPoints(inset: number): Point100[] {
  const cx = 50;
  const cy = 50;
  const visualScale = getBubbleVisualScale("heptagon");
  const l = scaleFromCenter(inset, visualScale);
  const t = scaleFromCenter(inset, visualScale);
  const r = scaleFromCenter(100 - inset, visualScale);
  const b = scaleFromCenter(100 - inset, visualScale);
  const curve = Math.max(1.5, 2.8 - inset * 0.06);
  const cornerDip = Math.max(1.5, 3.0 - inset * 0.05);
  const cornerSpan = Math.max(7.5, 10.0 - inset * 0.08);
  const points: Point100[] = [];
  let current = { x: l + cornerSpan, y: t };

  points.push(current);

  const cornerControl = (a: Point100, b2: Point100, pullFactor: number) => {
    const midX = (a.x + b2.x) / 2;
    const midY = (a.y + b2.y) / 2;
    const toCx = cx - midX;
    const toCy = cy - midY;
    const len = Math.hypot(toCx, toCy) || 1;

    return {
      x: midX + (toCx / len) * pullFactor,
      y: midY + (toCy / len) * pullFactor,
    };
  };

  const addQ = (control: Point100, to: Point100) => {
    addQuadraticPoints(points, current, control, to);
    current = to;
  };

  addQ({ x: 50, y: t + curve }, { x: r - cornerSpan, y: t });
  addQ(cornerControl(current, { x: r, y: t + cornerSpan }, cornerDip), {
    x: r,
    y: t + cornerSpan,
  });
  addQ({ x: r - curve, y: 50 }, { x: r, y: b - cornerSpan });
  addQ(cornerControl(current, { x: r - cornerSpan, y: b }, cornerDip), {
    x: r - cornerSpan,
    y: b,
  });
  addQ({ x: 50, y: b - curve }, { x: l + cornerSpan, y: b });
  addQ(cornerControl(current, { x: l, y: b - cornerSpan }, cornerDip), {
    x: l,
    y: b - cornerSpan,
  });
  addQ({ x: l + curve, y: 50 }, { x: l, y: t + cornerSpan });
  addQ(cornerControl(current, { x: l + cornerSpan, y: t }, cornerDip), {
    x: l + cornerSpan,
    y: t,
  });

  return points;
}

function getCornerSpikyBoundaryPoints(inset: number): Point100[] {
  const visualScale = getBubbleVisualScale("cornerSpiky");
  const l = scaleFromCenter(inset, visualScale);
  const t = scaleFromCenter(inset, visualScale);
  const r = scaleFromCenter(100 - inset, visualScale);
  const b = scaleFromCenter(100 - inset, visualScale);
  const spike = Math.max(1.6, 3.0 - inset * 0.08);
  const span = Math.max(8.5, 11 - inset * 0.08);
  const diag = spike;
  const curve = Math.max(1.8, 3.2 - inset * 0.08);
  const toothPull = 0.22;
  const lerp = (a: number, b2: number, p: number) => a + (b2 - a) * p;
  const points: Point100[] = [];
  let current = { x: l + span, y: t };

  points.push(current);

  const addQ = (control: Point100, to: Point100) => {
    addQuadraticPoints(points, current, control, to);
    current = to;
  };

  const addTooth = (a: Point100, tip: Point100, b2: Point100) => {
    const c1 = {
      x: lerp((a.x + tip.x) / 2, 50, toothPull),
      y: lerp((a.y + tip.y) / 2, 50, toothPull),
    };
    const c2 = {
      x: lerp((tip.x + b2.x) / 2, 50, toothPull),
      y: lerp((tip.y + b2.y) / 2, 50, toothPull),
    };

    addQ(c1, tip);
    addQ(c2, b2);
  };

  addQ({ x: 50, y: t + curve }, { x: r - span, y: t });
  addTooth(current, { x: r + diag, y: t - diag }, { x: r, y: t + span * 0.68 });
  addQ({ x: r - curve, y: 50 }, { x: r, y: b - span });
  addTooth(current, { x: r + diag, y: b + diag }, { x: r - span * 0.68, y: b });
  addQ({ x: 50, y: b - curve }, { x: l + span, y: b });
  addTooth(current, { x: l - diag, y: b + diag }, { x: l, y: b - span * 0.68 });
  addQ({ x: l + curve, y: 50 }, { x: l, y: t + span });
  addTooth(current, { x: l - diag, y: t - diag }, { x: l + span * 0.68, y: t });

  return points;
}

function getCloudBoundaryPoints(inset: number): Point100[] {
  const visualScale = getBubbleVisualScale("cloud");
  const cx = 50;
  const cy = 50;
  const blobs = [
    { x: 50, y: 50, r: 48 - inset * 0.2 },
    { x: 50, y: 28 + inset * 0.2, r: 32 - inset * 0.1 },
    { x: 66 - inset * 0.2, y: 34, r: 32 - inset * 0.1 },
    { x: 72 - inset * 0.2, y: 50, r: 32 - inset * 0.1 },
    { x: 66 - inset * 0.2, y: 66, r: 32 - inset * 0.1 },
    { x: 50, y: 72 - inset * 0.2, r: 32 - inset * 0.1 },
    { x: 34 + inset * 0.2, y: 66, r: 32 - inset * 0.1 },
    { x: 28 + inset * 0.2, y: 50, r: 32 - inset * 0.1 },
    { x: 34 + inset * 0.2, y: 34, r: 32 - inset * 0.1 },
  ];
  const points: Point100[] = [];

  for (let i = 0; i < 240; i++) {
    const t = (i / 240) * Math.PI * 2;
    const ux = Math.cos(t);
    const uy = Math.sin(t);
    let bestDist = 0;

    for (const c of blobs) {
      const ox = cx - c.x;
      const oy = cy - c.y;
      const bb = 2 * (ux * ox + uy * oy);
      const cc = ox * ox + oy * oy - c.r * c.r;
      const disc = bb * bb - 4 * cc;

      if (disc < 0) continue;

      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-bb - sqrtDisc) / 2;
      const t2 = (-bb + sqrtDisc) / 2;
      const hit = Math.max(t1, t2);

      if (hit > bestDist) bestDist = hit;
    }

    points.push({
      x: scaleFromCenter(cx + ux * bestDist, visualScale),
      y: scaleFromCenter(cy + uy * bestDist, visualScale),
    });
  }

  return points;
}

function getWaveBoundaryPoints(inset: number): Point100[] {
  const visualScale = getBubbleVisualScale("wave");
  const cx = 50;
  const cy = 50;
  const rx = 50 - inset;
  const ry = 50 - inset;
  const lobes = 8;
  const amp = 2;
  const points: Point100[] = [];

  for (let i = 0; i < 220; i++) {
    const t = (i / 220) * Math.PI * 2;
    const wave = Math.sin(t * lobes) * amp;

    points.push({
      x: scaleFromCenter(cx + Math.cos(t) * (rx + wave), visualScale),
      y: scaleFromCenter(cy + Math.sin(t) * (ry + wave), visualScale),
    });
  }

  return points;
}

function getPolygonBoundaryPoint(
  points: Point100[],
  angleDeg: number,
  bubblePixelW: number,
  bubblePixelH: number,
): Point100 | null {
  const theta = (angleDeg * Math.PI) / 180;
  const rayX = Math.cos(theta) / bubblePixelW;
  const rayY = Math.sin(theta) / bubblePixelH;
  const rayLen = Math.hypot(rayX, rayY);

  if (!Number.isFinite(rayLen) || rayLen <= 0 || points.length < 2) {
    return null;
  }

  const ux = rayX / rayLen;
  const uy = rayY / rayLen;
  const cx = 50;
  const cy = 50;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPoint: Point100 | null = null;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denom = ux * sy - uy * sx;

    if (Math.abs(denom) < 1e-9) continue;

    const ax = a.x - cx;
    const ay = a.y - cy;
    const distance = (ax * sy - ay * sx) / denom;
    const segmentRate = (ax * uy - ay * ux) / denom;

    if (distance < -1e-6) continue;
    if (segmentRate < -1e-6 || segmentRate > 1 + 1e-6) continue;
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    bestPoint = {
      x: cx + ux * distance,
      y: cy + uy * distance,
    };
  }

  return bestPoint;
}

function getShapeBoundaryPoints(
  shape: BubbleShape,
  inset: number,
): Point100[] | null {
  const visualScale = getBubbleVisualScale(shape);
  const l = scaleFromCenter(inset, visualScale);
  const t = scaleFromCenter(inset, visualScale);
  const r = scaleFromCenter(100 - inset, visualScale);
  const b = scaleFromCenter(100 - inset, visualScale);

  switch (shape) {
    case "ellipse":
      return getEllipseBoundaryPoints(inset);
    case "rect":
      return [
        { x: l, y: t },
        { x: r, y: t },
        { x: r, y: b },
        { x: l, y: b },
      ];
    case "electronic": {
      const cut = 18;

      return [
        { x: l + cut, y: t },
        { x: r - cut, y: t },
        { x: r, y: t + cut },
        { x: r, y: b - cut },
        { x: r - cut, y: b },
        { x: l + cut, y: b },
        { x: l, y: b - cut },
        { x: l, y: t + cut },
      ];
    }
    case "heptagon":
      return getHeptagonBoundaryPoints(inset);
    case "cornerSpiky":
      return getCornerSpikyBoundaryPoints(inset);
    case "cloud":
      return getCloudBoundaryPoints(inset);
    case "wave":
      return getWaveBoundaryPoints(inset);
    default:
      return null;
  }
}

export function getBoundaryPoint(
  shape: BubbleShape,
  angleDeg: number,
  bubblePixelW: number,
  bubblePixelH: number,
) {
  const points = getShapeBoundaryPoints(shape, BOUNDARY_INSET);
  const boundary = points
    ? getPolygonBoundaryPoint(points, angleDeg, bubblePixelW, bubblePixelH)
    : null;

  if (boundary) return boundary;

  return (
    getPolygonBoundaryPoint(
      getEllipseBoundaryPoints(BOUNDARY_INSET),
      angleDeg,
      bubblePixelW,
      bubblePixelH,
    ) ?? getEllipseBoundaryPoint(angleDeg, bubblePixelW, bubblePixelH)
  );
}
function getTriangleTailBaseWidthPx(bubble: Bubble) {
  const baseWidthPx = 50;
  const tailLengthPx = getBubbleVisibleTailLengthPx(bubble);

  const minRate = 0.35;

  const widthRate = minRate + (1 - minRate) * (1 / (1 + tailLengthPx * 0.008));

  return baseWidthPx * widthRate;
}

export function getTailGeometry(bubble: Bubble): TailGeometry {
  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

  const boundary = getBoundaryPoint(
    bubble.shape,
    bubble.tailAngle,
    bubblePixelW,
    bubblePixelH,
  );

  const theta = (bubble.tailAngle * Math.PI) / 180;
  const dir = bubble.tailMode === "outside" ? 1 : -1;

  const unitX = Math.cos(theta);
  const unitY = Math.sin(theta);
  const triangleTailWidthPx = getTriangleTailBaseWidthPx(bubble);
  const baseHalfPx =
    (bubble.tailStyle ?? "triangle") === "triangle"
      ? triangleTailWidthPx / 2
      : bubble.tailWidth / 2;
  const perpX = -unitY;
  const perpY = unitX;

  const baseCenterX = boundary.x;
  const baseCenterY = boundary.y;

  const visibleTailLengthPx = getBubbleVisibleTailLengthPx(bubble);

  const tipX =
    boundary.x + ((unitX * visibleTailLengthPx * dir) / bubblePixelW) * 100;
  const tipY =
    boundary.y + ((unitY * visibleTailLengthPx * dir) / bubblePixelH) * 100;

  const baseLeftX = baseCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseLeftY = baseCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const baseRightX = baseCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseRightY = baseCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  return {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    baseLeftX,
    baseLeftY,
    baseRightX,
    baseRightY,
    tipX,
    tipY,
  };
}

export function getTailHandlePosition(bubble: Bubble) {
  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

  const boundary = getBoundaryPoint(
    bubble.shape,
    bubble.tailAngle,
    bubblePixelW,
    bubblePixelH,
  );

  // 尻尾なしのときは、青丸を輪郭線上に出す
  if (!bubble.tailEnabled) {
    return {
      x: boundary.x,
      y: boundary.y,
    };
  }

  const theta = (bubble.tailAngle * Math.PI) / 180;
  const dir = bubble.tailMode === "outside" ? 1 : -1;

  const visibleTailLengthPx = getBubbleVisibleTailLengthPx(bubble);

  const localX =
    boundary.x +
    ((Math.cos(theta) * visibleTailLengthPx * dir) / bubblePixelW) * 100;
  const localY =
    boundary.y +
    ((Math.sin(theta) * visibleTailLengthPx * dir) / bubblePixelH) * 100;

  return { x: localX, y: localY };
}

export function getTailWidthHandlePosition(bubble: Bubble) {
  const { bubblePixelW, bubblePixelH, unitX, unitY, perpX, perpY, tipX, tipY } =
    getTailGeometry(bubble);

  const tailCurveDirection = getTriangleTailCurveDirection(bubble);
  const tailDirection = bubble.tailMode === "outside" ? 1 : -1;
  const guideOffsetPx = 18;
  const centerX =
    tipX + ((unitX * tailDirection * guideOffsetPx) / bubblePixelW) * 100;
  const centerY =
    tipY + ((unitY * tailDirection * guideOffsetPx) / bubblePixelH) * 100;
  const handleOffsetPx = tailCurveDirection * 28;

  return {
    x: centerX + ((perpX * handleOffsetPx) / bubblePixelW) * 100,
    y: centerY + ((perpY * handleOffsetPx) / bubblePixelH) * 100,
  };
}

function canBubbleUseTailCurve(shape: BubbleShape | undefined) {
  return (
    shape !== "heptagon" && shape !== "cornerSpiky" && shape !== "electronic"
  );
}

function getTriangleTailCurveDirection(bubble: Bubble) {
  if (!canBubbleUseTailCurve(bubble.shape)) return 0;

  const value = Number(bubble.tailWidth ?? 50);

  if (!Number.isFinite(value)) return 0;
  if (value <= 37) return -1;
  if (value >= 63) return 1;
  return 0;
}

function getTriangleTailCurveOffsetPx(bubble: Bubble) {
  return getTriangleTailCurveDirection(bubble) * 16;
}

function buildTriangleTailPath({
  startX,
  startY,
  tipX,
  tipY,
  endX,
  endY,
  bubblePixelW,
  bubblePixelH,
  perpX,
  perpY,
  curveOffsetPx,
  close,
}: {
  startX: number;
  startY: number;
  tipX: number;
  tipY: number;
  endX: number;
  endY: number;
  bubblePixelW: number;
  bubblePixelH: number;
  perpX: number;
  perpY: number;
  curveOffsetPx: number;
  close: boolean;
}) {
  if (curveOffsetPx === 0) {
    return `
      M ${startX} ${startY}
      L ${tipX} ${tipY}
      L ${endX} ${endY}
      ${close ? "Z" : ""}
    `;
  }

  const curveX = ((perpX * curveOffsetPx) / bubblePixelW) * 100;
  const curveY = ((perpY * curveOffsetPx) / bubblePixelH) * 100;

  const controlLeftX = (startX + tipX) / 2 + curveX;
  const controlLeftY = (startY + tipY) / 2 + curveY;
  const controlRightX = (tipX + endX) / 2 + curveX;
  const controlRightY = (tipY + endY) / 2 + curveY;

  return `
    M ${startX} ${startY}
    Q ${controlLeftX} ${controlLeftY} ${tipX} ${tipY}
    Q ${controlRightX} ${controlRightY} ${endX} ${endY}
    ${close ? "Z" : ""}
  `;
}

export function getOutsideTriangleTailPath(bubble: Bubble) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const overlapPx = TAIL_OVERLAP_PX;

  const rootCenterX = boundary.x + ((-unitX * overlapPx) / bubblePixelW) * 100;
  const rootCenterY = boundary.y + ((-unitY * overlapPx) / bubblePixelH) * 100;

  const rootLeftX = rootCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootLeftY = rootCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const rootRightX = rootCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootRightY = rootCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  return buildTriangleTailPath({
    startX: rootLeftX,
    startY: rootLeftY,
    tipX,
    tipY,
    endX: rootRightX,
    endY: rootRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });
}

export function getOutsideTriangleTailJointPunchPath(bubble: Bubble) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const { baseLeftX, baseLeftY, baseRightX, baseRightY } =
    getTailGeometry(bubble);

  return `
    M ${baseLeftX} ${baseLeftY}
    L ${baseRightX} ${baseRightY}
  `;
}

function getBubbleCoverInsetPercent(bubble: Bubble) {
  const insetPt = bubble.shape === "electronic" ? 0 : 0.5;
  const insetPx = insetPt * (96 / 72);

  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

  const insetX = (insetPx / bubblePixelW) * 100;
  const insetY = (insetPx / bubblePixelH) * 100;

  return Math.max(insetX, insetY);
}

export function getOutsideTailBackSideMaskPath({
  boundaryX,
  boundaryY,
  unitX,
  unitY,
  perpX,
  perpY,
  bubblePixelW,
  bubblePixelH,
  tailRootVisibleInsidePx,
}: {
  boundaryX: number;
  boundaryY: number;
  unitX: number;
  unitY: number;
  perpX: number;
  perpY: number;
  bubblePixelW: number;
  bubblePixelH: number;
  tailRootVisibleInsidePx: number;
}) {
  const far = 1000;

  const shiftedBoundaryX =
    boundaryX - ((unitX * tailRootVisibleInsidePx) / bubblePixelW) * 100;
  const shiftedBoundaryY =
    boundaryY - ((unitY * tailRootVisibleInsidePx) / bubblePixelH) * 100;

  const ax = shiftedBoundaryX + perpX * far;
  const ay = shiftedBoundaryY + perpY * far;
  const bx = shiftedBoundaryX - perpX * far;
  const by = shiftedBoundaryY - perpY * far;
  const cx = bx - unitX * far * 2;
  const cy = by - unitY * far * 2;
  const dx = ax - unitX * far * 2;
  const dy = ay - unitY * far * 2;

  return `
    M ${ax} ${ay}
    L ${bx} ${by}
    L ${cx} ${cy}
    L ${dx} ${dy}
    Z
  `;
}

export function getOutsideTriangleTailBackSideMaskPath(bubble: Bubble) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const centerToTipPx = Math.hypot(
    ((tipX - 50) / 100) * bubblePixelW,
    ((tipY - 50) / 100) * bubblePixelH,
  );
  const centerToBoundaryPx = Math.hypot(
    ((boundary.x - 50) / 100) * bubblePixelW,
    ((boundary.y - 50) / 100) * bubblePixelH,
  );
  const tailRootVisibleInsidePx = Math.max(
    0,
    Math.min(centerToTipPx, centerToBoundaryPx),
  );

  return getOutsideTailBackSideMaskPath({
    boundaryX: boundary.x,
    boundaryY: boundary.y,
    unitX,
    unitY,
    perpX,
    perpY,
    bubblePixelW,
    bubblePixelH,
    tailRootVisibleInsidePx,
  });
}

function OutsideTriangleTailVisibleMask({
  bubble,
  maskId,
  boundaryX,
  boundaryY,
  unitX,
  unitY,
  perpX,
  perpY,
  bubblePixelW,
  bubblePixelH,
  tailRootVisibleInsidePx,
}: {
  bubble: Bubble;
  maskId: string;
  boundaryX: number;
  boundaryY: number;
  unitX: number;
  unitY: number;
  perpX: number;
  perpY: number;
  bubblePixelW: number;
  bubblePixelH: number;
  tailRootVisibleInsidePx: number;
}) {
  return (
    <defs>
      <mask
        id={maskId}
        x="-1000"
        y="-1000"
        width="2000"
        height="2000"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
      >
        <rect x="-1000" y="-1000" width="2000" height="2000" fill="white" />
        <path
          d={getOutsideTailBackSideMaskPath({
            boundaryX,
            boundaryY,
            unitX,
            unitY,
            perpX,
            perpY,
            bubblePixelW,
            bubblePixelH,
            tailRootVisibleInsidePx,
          })}
          fill="black"
        />
      </mask>
    </defs>
  );
}

export function OutsideTriangleTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const overlapPx = TAIL_OVERLAP_PX;

  const rootCenterX = boundary.x + ((-unitX * overlapPx) / bubblePixelW) * 100;
  const rootCenterY = boundary.y + ((-unitY * overlapPx) / bubblePixelH) * 100;

  const rootLeftX = rootCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootLeftY = rootCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const rootRightX = rootCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootRightY = rootCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const tailPath = buildTriangleTailPath({
    startX: rootLeftX,
    startY: rootLeftY,
    tipX,
    tipY,
    endX: rootRightX,
    endY: rootRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });

  const centerToTipPx = Math.hypot(
    ((tipX - 50) / 100) * bubblePixelW,
    ((tipY - 50) / 100) * bubblePixelH,
  );
  const centerToBoundaryPx = Math.hypot(
    ((boundary.x - 50) / 100) * bubblePixelW,
    ((boundary.y - 50) / 100) * bubblePixelH,
  );
  const tailRootVisibleInsidePx = Math.max(
    0,
    Math.min(centerToTipPx, centerToBoundaryPx),
  );

  const maskId = `outside-triangle-tail-visible-mask-${bubble.id}`;
  const tailStrokeWidth = getBubbleOutlineStrokeWidthForSvg(
    bubble,
    bubble.shape !== "electronic" &&
      getBubbleToneBackgroundColor(bubble) === "transparent"
      ? BUBBLE_STROKE_PX * 2
      : BUBBLE_STROKE_PX,
  );

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <OutsideTriangleTailVisibleMask
        bubble={bubble}
        maskId={maskId}
        boundaryX={boundary.x}
        boundaryY={boundary.y}
        unitX={unitX}
        unitY={unitY}
        perpX={perpX}
        perpY={perpY}
        bubblePixelW={bubblePixelW}
        bubblePixelH={bubblePixelH}
        tailRootVisibleInsidePx={tailRootVisibleInsidePx}
      />

      <path
        d={tailPath}
        fill="none"
        stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
        strokeWidth={tailStrokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export function getInsideTriangleTailPath(bubble: Bubble) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "inside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  // 内側しっぽは外側しっぽの反転として扱う。
  // 外側しっぽが輪郭から内側へ TAIL_OVERLAP_PX だけ根元を入れるのに対し、
  // 内側しっぽは輪郭から外側へ同じ距離だけ根元を出し、輪郭パスでクリップする。
  const insideBaseOutsetPx = TAIL_OVERLAP_PX;

  const baseCenterX =
    boundary.x + ((unitX * insideBaseOutsetPx) / bubblePixelW) * 100;
  const baseCenterY =
    boundary.y + ((unitY * insideBaseOutsetPx) / bubblePixelH) * 100;

  const baseLeftX = baseCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseLeftY = baseCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const baseRightX = baseCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseRightY = baseCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  return buildTriangleTailPath({
    startX: baseLeftX,
    startY: baseLeftY,
    tipX,
    tipY,
    endX: baseRightX,
    endY: baseRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });
}

function getThoughtDotRadiusPercent({
  bubblePixelW,
  bubblePixelH,
  diameterPx,
}: {
  bubblePixelW: number;
  bubblePixelH: number;
  diameterPx: number;
}) {
  const basePixelSize = Math.max(1, Math.max(bubblePixelW, bubblePixelH));
  return (diameterPx / 2 / basePixelSize) * 100;
}

function getThoughtDotSupportRadiusPx({
  bubblePixelW,
  bubblePixelH,
  radiusPercent,
  unitX,
  unitY,
}: {
  bubblePixelW: number;
  bubblePixelH: number;
  radiusPercent: number;
  unitX: number;
  unitY: number;
}) {
  const rxPx = Math.max(0.1, (radiusPercent / 100) * bubblePixelW);
  const ryPx = Math.max(0.1, (radiusPercent / 100) * bubblePixelH);
  const denom = Math.hypot(unitX / rxPx, unitY / ryPx) || 1;

  return 1 / denom;
}

export function getThoughtDotPath(cx: number, cy: number, r: number) {
  return `
    M ${cx - r} ${cy}
    A ${r} ${r} 0 1 0 ${cx + r} ${cy}
    A ${r} ${r} 0 1 0 ${cx - r} ${cy}
    Z
  `;
}

function getThoughtTailCurvePoint({
  startX,
  startY,
  controlX,
  controlY,
  tipX,
  tipY,
  t,
}: {
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  tipX: number;
  tipY: number;
  t: number;
}) {
  const inv = 1 - t;

  return {
    x: inv * inv * startX + 2 * inv * t * controlX + t * t * tipX,
    y: inv * inv * startY + 2 * inv * t * controlY + t * t * tipY,
  };
}

export function getThoughtTailDots(bubble: Bubble) {
  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const rootDiameterPx = getThoughtTailDotDiameterPx(bubble, "root");
  const tipDiameterPx = getThoughtTailDotDiameterPx(bubble, "tip");

  const rootR = getThoughtDotRadiusPercent({
    bubblePixelW,
    bubblePixelH,
    diameterPx: rootDiameterPx,
  });
  const tipR = getThoughtDotRadiusPercent({
    bubblePixelW,
    bubblePixelH,
    diameterPx: tipDiameterPx,
  });
  const rootSupportPx = getThoughtDotSupportRadiusPx({
    bubblePixelW,
    bubblePixelH,
    radiusPercent: rootR,
    unitX,
    unitY,
  });
  const rootStrokeInsetPx =
    getBubbleToneBackgroundColor(bubble) === "transparent"
      ? BUBBLE_STROKE_PX + 1
      : BUBBLE_STROKE_PX / 2 + 1;

  const rootOffsetPx =
    bubble.tailMode === "inside"
      ? -(rootSupportPx + rootStrokeInsetPx * 0.15)
      : rootSupportPx;

  const rootCx = boundary.x + ((unitX * rootOffsetPx) / bubblePixelW) * 100;
  const rootCy = boundary.y + ((unitY * rootOffsetPx) / bubblePixelH) * 100;

  const startInsetPx = rootSupportPx + rootStrokeInsetPx + 4;
  const curveStartX =
    boundary.x + ((-unitX * startInsetPx) / bubblePixelW) * 100;
  const curveStartY =
    boundary.y + ((-unitY * startInsetPx) / bubblePixelH) * 100;

  const curveOffsetPx = getTriangleTailCurveOffsetPx(bubble);
  const curveOffsetX = ((perpX * curveOffsetPx) / bubblePixelW) * 100;
  const curveOffsetY = ((perpY * curveOffsetPx) / bubblePixelH) * 100;

  const rootCurveInfluencePx = curveOffsetPx * 0.35;
  const curvedRootCx =
    rootCx + ((perpX * rootCurveInfluencePx) / bubblePixelW) * 100;
  const curvedRootCy =
    rootCy + ((perpY * rootCurveInfluencePx) / bubblePixelH) * 100;

  const controlX = (curveStartX + tipX) / 2 + curveOffsetX;
  const controlY = (curveStartY + tipY) / 2 + curveOffsetY;

  const rootDistancePx = Math.hypot(
    ((rootCx - curveStartX) / 100) * bubblePixelW,
    ((rootCy - curveStartY) / 100) * bubblePixelH,
  );
  const totalDistancePx = Math.max(
    1,
    Math.hypot(
      ((tipX - curveStartX) / 100) * bubblePixelW,
      ((tipY - curveStartY) / 100) * bubblePixelH,
    ),
  );

  const rootT = Math.max(0, Math.min(0.45, rootDistancePx / totalDistancePx));
  const visibleDistancePx = Math.max(
    1,
    Math.hypot(
      ((tipX - rootCx) / 100) * bubblePixelW,
      ((tipY - rootCy) / 100) * bubblePixelH,
    ),
  );
  const dotCount = Math.max(
    2,
    Math.min(5, Math.ceil(visibleDistancePx / 54) + 1),
  );

  return Array.from({ length: dotCount }, (_, index) => {
    const p = dotCount <= 1 ? 1 : index / (dotCount - 1);
    const t = rootT + (1 - rootT) * p;
    if (index === 0) {
      return {
        cx: curvedRootCx,
        cy: curvedRootCy,
        r: rootR,
      };
    }

    const point = getThoughtTailCurvePoint({
      startX: curveStartX,
      startY: curveStartY,
      controlX,
      controlY,
      tipX,
      tipY,
      t,
    });

    return {
      cx: point.x,
      cy: point.y,
      r: rootR + (tipR - rootR) * p,
    };
  });
}

export function getInsideThoughtTailPath(bubble: Bubble) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "inside" ||
    (bubble.tailStyle ?? "triangle") !== "thought"
  ) {
    return null;
  }

  return getThoughtTailDots(bubble)
    .map((dot) => getThoughtDotPath(dot.cx, dot.cy, dot.r))
    .join("\n");
}

export function getInsideThoughtTailPatchPath(bubble: Bubble) {
  return getInsideThoughtTailPath(bubble) ?? "";
}

export function InsideTriangleTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "inside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const tailPath = getInsideTriangleTailPath(bubble);
  if (!tailPath) return null;

  const clipId = `inside-triangle-tail-clip-${bubble.id}`;

  // getBoundaryPoint() と同じ輪郭パスで切る。
  // ここが別 inset だと、内側しっぽだけ輪郭の見かけ位置がずれる。
  const inset = BOUNDARY_INSET;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={bubbleSvgPath(bubble.shape, inset)} />
        </clipPath>
      </defs>

      <path
        d={tailPath}
        fill="none"
        stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleInsideTailOutlineStrokeWidthForSvg(bubble)}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

export function OutsideElectronicTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.shape !== "electronic" ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const rootCenterX =
    boundary.x + ((-unitX * TAIL_OVERLAP_PX) / bubblePixelW) * 100;
  const rootCenterY =
    boundary.y + ((-unitY * TAIL_OVERLAP_PX) / bubblePixelH) * 100;

  const rootLeftX = rootCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootLeftY = rootCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const rootRightX = rootCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootRightY = rootCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const fillPath = buildTriangleTailPath({
    startX: rootLeftX,
    startY: rootLeftY,
    tipX,
    tipY,
    endX: rootRightX,
    endY: rootRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });

  const linePath = buildTriangleTailPath({
    startX: rootLeftX,
    startY: rootLeftY,
    tipX,
    tipY,
    endX: rootRightX,
    endY: rootRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: false,
  });

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <path
        d={linePath}
        fill="none"
        stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleOutlineStrokeWidthForSvg(
          bubble,
          ELECTRONIC_TAIL_STROKE_PX,
        )}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <path d={fillPath} fill={getBubbleBackgroundFill(bubble)} />

      <path
        d={linePath}
        fill="none"
        stroke={getElectronicCenterStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleOutlineStrokeWidthForSvg(
          bubble,
          ELECTRONIC_TAIL_STROKE_PX,
        )}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OutsideTailFillSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    unitY,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const overlapPx = TAIL_OVERLAP_PX;

  // 元の尻尾（輪郭線）の根元
  const rootCenterX = boundary.x + ((-unitX * overlapPx) / bubblePixelW) * 100;
  const rootCenterY = boundary.y + ((-unitY * overlapPx) / bubblePixelH) * 100;

  const rootLeftX = rootCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootLeftY = rootCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const rootRightX = rootCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const rootRightY = rootCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  // 1pt = 96/72 px
  const insetPx = 1 * (96 / 72);

  // 先端を 1pt 手前へ
  const coverTipX = tipX + ((-unitX * insetPx) / bubblePixelW) * 100;
  const coverTipY = tipY + ((-unitY * insetPx) / bubblePixelH) * 100;

  // 根元幅を左右それぞれ 1pt ずつ狭める
  const coverBaseHalfPx = Math.max(0, baseHalfPx - insetPx);

  const coverLeftX =
    rootCenterX + ((perpX * coverBaseHalfPx) / bubblePixelW) * 100;
  const coverLeftY =
    rootCenterY + ((perpY * coverBaseHalfPx) / bubblePixelH) * 100;

  const coverRightX =
    rootCenterX - ((perpX * coverBaseHalfPx) / bubblePixelW) * 100;
  const coverRightY =
    rootCenterY - ((perpY * coverBaseHalfPx) / bubblePixelH) * 100;

  const tailPath = buildTriangleTailPath({
    startX: coverLeftX,
    startY: coverLeftY,
    tipX: coverTipX,
    tipY: coverTipY,
    endX: coverRightX,
    endY: coverRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });

  const centerToTipPx = Math.hypot(
    ((tipX - 50) / 100) * bubblePixelW,
    ((tipY - 50) / 100) * bubblePixelH,
  );
  const centerToBoundaryPx = Math.hypot(
    ((boundary.x - 50) / 100) * bubblePixelW,
    ((boundary.y - 50) / 100) * bubblePixelH,
  );
  const tailRootVisibleInsidePx = Math.max(
    0,
    Math.min(centerToTipPx, centerToBoundaryPx),
  );

  const maskId = `outside-triangle-tail-fill-visible-mask-${bubble.id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <OutsideTriangleTailVisibleMask
        bubble={bubble}
        maskId={maskId}
        boundaryX={boundary.x}
        boundaryY={boundary.y}
        unitX={unitX}
        unitY={unitY}
        perpX={perpX}
        perpY={perpY}
        bubblePixelW={bubblePixelW}
        bubblePixelH={bubblePixelH}
        tailRootVisibleInsidePx={tailRootVisibleInsidePx}
      />

      <path
        d={tailPath}
        fill={getBubbleBackgroundFill(bubble)}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export function InsideElectronicTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.shape !== "electronic" ||
    bubble.tailMode !== "inside" ||
    (bubble.tailStyle ?? "triangle") !== "triangle"
  ) {
    return null;
  }

  const {
    boundary,
    bubblePixelW,
    bubblePixelH,
    unitX,
    perpX,
    perpY,
    baseHalfPx,
    tipX,
    tipY,
  } = getTailGeometry(bubble);

  const baseCenterX =
    boundary.x + ((unitX * INSIDE_TAIL_BASE_OUTSET_PX) / bubblePixelW) * 100;
  const baseCenterY =
    boundary.y +
    ((unitX * 0) / bubblePixelH) * 100 +
    ((Math.sin((bubble.tailAngle * Math.PI) / 180) *
      INSIDE_TAIL_BASE_OUTSET_PX) /
      bubblePixelH) *
      100;

  const baseLeftX = baseCenterX + ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseLeftY = baseCenterY + ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const baseRightX = baseCenterX - ((perpX * baseHalfPx) / bubblePixelW) * 100;
  const baseRightY = baseCenterY - ((perpY * baseHalfPx) / bubblePixelH) * 100;

  const fillPath = buildTriangleTailPath({
    startX: baseLeftX,
    startY: baseLeftY,
    tipX,
    tipY,
    endX: baseRightX,
    endY: baseRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: true,
  });

  const linePath = buildTriangleTailPath({
    startX: baseLeftX,
    startY: baseLeftY,
    tipX,
    tipY,
    endX: baseRightX,
    endY: baseRightY,
    bubblePixelW,
    bubblePixelH,
    perpX,
    perpY,
    curveOffsetPx: getTriangleTailCurveOffsetPx(bubble),
    close: false,
  });

  const clipId = `inside-electronic-tail-clip-${bubble.id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={bubbleSvgPath("electronic", 0)} />
        </clipPath>
      </defs>

      <path
        d={linePath}
        fill="none"
        stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleOutlineStrokeWidthForSvg(
          bubble,
          ELECTRONIC_TAIL_STROKE_PX,
        )}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />

      <path
        d={linePath}
        fill="none"
        stroke={getElectronicCenterStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleOutlineStrokeWidthForSvg(
          bubble,
          ELECTRONIC_TAIL_STROKE_PX,
        )}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

export function OutsideThoughtTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "outside" ||
    (bubble.tailStyle ?? "triangle") !== "thought"
  ) {
    return null;
  }

  const dots = getThoughtTailDots(bubble);
  const tailStrokeWidth = getBubbleInsideTailOutlineStrokeWidthForSvg(bubble);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {[...dots].reverse().map((dot, i) => (
        <path
          key={i}
          d={getThoughtDotPath(dot.cx, dot.cy, dot.r)}
          fill={getBubbleBackgroundFill(bubble)}
          stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
          strokeWidth={tailStrokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function InsideThoughtTailSvg({ bubble }: { bubble: Bubble }) {
  if (
    !bubble.tailEnabled ||
    bubble.tailMode !== "inside" ||
    (bubble.tailStyle ?? "triangle") !== "thought"
  ) {
    return null;
  }

  const dots = getThoughtTailDots(bubble);
  const tailStrokeWidth = getBubbleInsideTailOutlineStrokeWidthForSvg(bubble);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        {dots.map((dot, i) => (
          <mask key={i} id={`thought-inside-stroke-mask-${bubble.id}-${i}`}>
            <rect x="0" y="0" width="100" height="100" fill="white" />
            {dots.slice(i + 1).map((front, j) => (
              <path
                key={j}
                d={getThoughtDotPath(
                  front.cx,
                  front.cy,
                  front.r + tailStrokeWidth,
                )}
                fill="black"
              />
            ))}
          </mask>
        ))}
      </defs>

      {dots.map((dot, i) => (
        <path
          key={i}
          d={getThoughtDotPath(dot.cx, dot.cy, dot.r)}
          fill="none"
          stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
          strokeWidth={tailStrokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          mask={`url(#thought-inside-stroke-mask-${bubble.id}-${i})`}
        />
      ))}
    </svg>
  );
}

export function BubbleCoverSvg({ bubble }: { bubble: Bubble }) {
  const inset = getBubbleCoverInsetPercent(bubble);

  const d =
    bubble.shape === "flash"
      ? flashBodyPath()
      : bubbleSvgPath(bubble.shape, inset);

  const insideTrianglePath = getInsideTriangleTailPath(bubble);
  const useInsideTrianglePunch =
    !!insideTrianglePath &&
    bubble.tailEnabled &&
    bubble.tailMode === "inside" &&
    (bubble.tailStyle ?? "triangle") === "triangle";

  const isTransparent = getBubbleToneBackgroundColor(bubble) === "transparent";
  const maskId = `bubble-cover-mask-${bubble.id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {useInsideTrianglePunch && (
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="black" />
            <path d={d} fill="white" />
            <path d={insideTrianglePath} fill="black" />
          </mask>
        </defs>
      )}

      {!isTransparent && (
        <path
          d={d}
          fill={getBubbleBackgroundFill(bubble)}
          mask={useInsideTrianglePunch ? `url(#${maskId})` : undefined}
        />
      )}
    </svg>
  );
}

export function ElectronicInnerLayer({ bubble }: { bubble: Bubble }) {
  if (bubble.shape !== "electronic") return null;

  const insideTrianglePath = getInsideTriangleTailPath(bubble);
  const useInsideTrianglePunch =
    !!insideTrianglePath &&
    bubble.tailEnabled &&
    bubble.tailMode === "inside" &&
    (bubble.tailStyle ?? "triangle") === "triangle";

  const ptToPx = 96 / 72;

  // 既存の内側線（外枠から2pt）
  const innerLineOffsetPt = 2;
  const innerLineOffsetPx = innerLineOffsetPt * ptToPx;

  const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
  const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

  const maskInset = Math.max(
    (innerLineOffsetPx / bubblePixelW) * 100,
    (innerLineOffsetPx / bubblePixelH) * 100,
  );

  const innerLinePath = electronicBubbleStrokePathByOffsetPx(
    bubble,
    innerLineOffsetPx,
  );

  const maskId = `electronic-inner-mask-${bubble.id}`;

  return (
    <>
      {useInsideTrianglePunch && (
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="black" />
            <path d={bubbleSvgPath("electronic", -maskInset)} fill="white" />
            <path d={insideTrianglePath} fill="black" />
          </mask>
        </defs>
      )}

      {/* 既存の内側線（外枠から2pt） */}
      <path
        d={innerLinePath}
        fill="none"
        stroke={getBubbleOutlineStrokeColorForSvg(bubble)}
        strokeWidth={getBubbleOutlineStrokeWidthForSvg(
          bubble,
          ELECTRONIC_CENTER_WHITE_STROKE_PX,
        )}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="butt"
        mask={useInsideTrianglePunch ? `url(#${maskId})` : undefined}
      />
    </>
  );
}

export function FlashBubbleSvg({ bubble }: { bubble: Bubble }) {
  if (bubble.shape !== "flash") return null;

  const visualScale = getBubbleVisualScale(bubble.shape);
  const cx = 50;
  const cy = 50;
  const rx = FLASH_BODY_RX;
  const ry = FLASH_BODY_RY;
  const fillColor = getBubbleBackgroundFill(bubble);
  const lineColor = getBubbleOutlineStrokeColorForSvg(bubble);
  const strokeWidth = getBubbleOutlineStrokeWidthForSvg(
    bubble,
    FLASH_LINE_STROKE_PX,
  );
  const bodyPath = flashBodyPath();
  const lines: React.ReactNode[] = [];

  for (let lineIndex = 0; lineIndex < FLASH_LINE_COUNT; lineIndex++) {
    const t = (lineIndex / FLASH_LINE_COUNT) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const lineLen = getFlashLineLength(lineIndex);

    if (lineLen <= 0) {
      continue;
    }

    const x1 = scaleFromCenter(cx + cos * rx, visualScale);
    const y1 = scaleFromCenter(cy + sin * ry, visualScale);
    const x2 = scaleFromCenter(cx + cos * (rx + lineLen), visualScale);
    const y2 = scaleFromCenter(cy + sin * (ry + lineLen), visualScale);

    lines.push(
      <line
        key={lineIndex}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />,
    );
  }

  return (
    <>
      {lines}
      <path d={bodyPath} fill={fillColor} />
    </>
  );
}
