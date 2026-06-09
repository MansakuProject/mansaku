import type {
  Bubble,
  Frame,
  FramePolygonPoints,
  FrameTiltValue,
  Page,
  PercentPoint,
  SoundText,
} from "./types";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./constants";

type FrameLike = {
  x: number;
  y: number;
  w: number;
  h: number;
  topTilt?: FrameTiltValue;
  rightTilt?: FrameTiltValue;
  bottomTilt?: FrameTiltValue;
  leftTilt?: FrameTiltValue;
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  imageScale?: number;
  imageHasTransparency?: boolean;
  points?: FramePolygonPoints | PercentPoint[];
};

// ★追加：Content 用の内側オフセット（%）
const STROKE_INSET_CANVAS_PERCENT_X = (7 / PAGE_WIDTH) * 100;
const STROKE_INSET_CANVAS_PERCENT_Y = (10 / PAGE_HEIGHT) * 100;

const CONTENT_INSET_CANVAS_PERCENT_X = (8 / PAGE_WIDTH) * 100;
const CONTENT_INSET_CANVAS_PERCENT_Y = (11 / PAGE_HEIGHT) * 100;

function insetLocalPolygon(
  points: PercentPoint[],
  insetX: number,
  insetY: number
) {
  const center = points.reduce(
    (acc, p) => ({
      x: acc.x + p.x / points.length,
      y: acc.y + p.y / points.length,
    }),
    { x: 0, y: 0 }
  );

  return points.map((p) => {
    const vx = center.x - p.x;
    const vy = center.y - p.y;

    const len = Math.hypot(vx, vy);
    if (len < 0.000001) return { ...p };

    return {
      x: p.x + (vx / len) * insetX,
      y: p.y + (vy / len) * insetY,
    };
  });
}

// ★追加：ローカル→ページ絶対座標へ変換
function localToAbsolute(frame: Frame, local: PercentPoint[]) {
  return local.map((p) => ({
    x: frame.x + (frame.w * p.x) / 100,
    y: frame.y + (frame.h * p.y) / 100,
  }));
}

const PT_TO_CSS_PX = 96 / 72;

function clonePoint(point: PercentPoint): PercentPoint {
  return { x: point.x, y: point.y };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBoundsFromPoints(points: PercentPoint[]) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    w: Math.max(maxX - minX, 0.000001),
    h: Math.max(maxY - minY, 0.000001),
  };
}

function hasFramePoints(frameLike: FrameLike): frameLike is FrameLike & {
  points: FramePolygonPoints | PercentPoint[];
} {
  return Array.isArray(frameLike.points) && frameLike.points.length === 4;
}

function normalizeFrameLike(frameLike: FrameLike): Required<
  Pick<
    FrameLike,
    "x" | "y" | "w" | "h" | "topTilt" | "rightTilt" | "bottomTilt" | "leftTilt"
  >
> {
  return {
    x: frameLike.x,
    y: frameLike.y,
    w: frameLike.w,
    h: frameLike.h,
    topTilt: frameLike.topTilt ?? 0,
    rightTilt: frameLike.rightTilt ?? 0,
    bottomTilt: frameLike.bottomTilt ?? 0,
    leftTilt: frameLike.leftTilt ?? 0,
  };
}

function buildTopLine(frame: Required<Pick<FrameLike, "w" | "h" | "topTilt">>) {
  const angleRad = ((frame.topTilt ?? 0) * Math.PI) / 180;
  const dyPx = Math.tan(angleRad) * (frame.w / 2);
  const dy = (dyPx / frame.h) * 100;

  return {
    p1: { x: 0, y: 0 - dy / 2 },
    p2: { x: 100, y: 0 + dy / 2 },
  };
}

function buildBottomLine(
  frame: Required<Pick<FrameLike, "w" | "h" | "bottomTilt">>
) {
  const angleRad = ((frame.bottomTilt ?? 0) * Math.PI) / 180;
  const dyPx = Math.tan(angleRad) * (frame.w / 2);
  const dy = (dyPx / frame.h) * 100;

  return {
    p1: { x: 0, y: 100 - dy / 2 },
    p2: { x: 100, y: 100 + dy / 2 },
  };
}

function buildRightLine(
  frame: Required<Pick<FrameLike, "w" | "h" | "rightTilt">>
) {
  const angleRad = ((frame.rightTilt ?? 0) * Math.PI) / 180;
  const dxPx = Math.tan(angleRad) * (frame.h / 2);
  const dx = (dxPx / frame.w) * 100;

  return {
    p1: { x: 100 - dx / 2, y: 0 },
    p2: { x: 100 + dx / 2, y: 100 },
  };
}

function buildLeftLine(frame: Required<Pick<FrameLike, "w" | "h" | "leftTilt">>) {
  const angleRad = ((frame.leftTilt ?? 0) * Math.PI) / 180;
  const dxPx = Math.tan(angleRad) * (frame.h / 2);
  const dx = (dxPx / frame.w) * 100;

  return {
    p1: { x: 0 - dx / 2, y: 0 },
    p2: { x: 0 + dx / 2, y: 100 },
  };
}

function intersectInfiniteLines(
  a1: PercentPoint,
  a2: PercentPoint,
  b1: PercentPoint,
  b2: PercentPoint
): PercentPoint | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const crossValue = dax * dby - day * dbx;
  if (Math.abs(crossValue) < 0.000001) {
    return null;
  }

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / crossValue;

  return {
    x: a1.x + dax * t,
    y: a1.y + day * t,
  };
}

function getLegacyLocalPolygonPoints(frameLike: FrameLike): FramePolygonPoints {
  const normalized = normalizeFrameLike(frameLike);

  const top = buildTopLine(normalized);
  const right = buildRightLine(normalized);
  const bottom = buildBottomLine(normalized);
  const left = buildLeftLine(normalized);

  const tl = intersectInfiniteLines(top.p1, top.p2, left.p1, left.p2) ?? {
    x: 0,
    y: 0,
  };

  const tr = intersectInfiniteLines(top.p1, top.p2, right.p1, right.p2) ?? {
    x: 100,
    y: 0,
  };

  const br = intersectInfiniteLines(
    bottom.p1,
    bottom.p2,
    right.p1,
    right.p2
  ) ?? { x: 100, y: 100 };

  const bl = intersectInfiniteLines(bottom.p1, bottom.p2, left.p1, left.p2) ?? {
    x: 0,
    y: 100,
  };

  return [tl, tr, br, bl];
}

function getLegacyAbsolutePolygonPoints(frameLike: FrameLike): FramePolygonPoints {
  const local = getLegacyLocalPolygonPoints(frameLike);

  return local.map((point) => ({
    x: frameLike.x + (frameLike.w * point.x) / 100,
    y: frameLike.y + (frameLike.h * point.y) / 100,
  })) as FramePolygonPoints;
}

function getAbsolutePolygonPoints(frameLike: FrameLike): FramePolygonPoints {
  if (hasFramePoints(frameLike)) {
    return frameLike.points.map(clonePoint) as FramePolygonPoints;
  }

  return getLegacyAbsolutePolygonPoints(frameLike);
}

function getLocalPolygonPoints(frameLike: FrameLike): FramePolygonPoints {
  if (!hasFramePoints(frameLike)) {
    return getLegacyLocalPolygonPoints(frameLike);
  }

  const absolute = getAbsolutePolygonPoints(frameLike);
  const bounds = getBoundsFromPoints(absolute);

  return absolute.map((point) => ({
    x: ((point.x - bounds.minX) / bounds.w) * 100,
    y: ((point.y - bounds.minY) / bounds.h) * 100,
  })) as FramePolygonPoints;
}

function getPolygonSignedArea(points: PercentPoint[]) {
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }

  return area / 2;
}

function normalizeVec(x: number, y: number) {
  const len = Math.hypot(x, y);
  if (len < 0.000001) return null;

  return {
    x: x / len,
    y: y / len,
  };
}

function insetPolygon(
  points: PercentPoint[],
  insetPercentX: number,
  insetPercentY: number
) {
  if (points.length < 3) return points;

  const area = getPolygonSignedArea(points);
  const isClockwise = area < 0;

  const offsetLines = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    const edgeX = next.x - point.x;
    const edgeY = next.y - point.y;

    const unit = normalizeVec(edgeX, edgeY);
    if (!unit) {
      return {
        p1: point,
        p2: next,
      };
    }

    const inwardNormal = isClockwise
      ? { x: -unit.y, y: unit.x }
      : { x: unit.y, y: -unit.x };

    const moveX = inwardNormal.x * insetPercentX;
    const moveY = inwardNormal.y * insetPercentY;

    return {
      p1: { x: point.x + moveX, y: point.y + moveY },
      p2: { x: next.x + moveX, y: next.y + moveY },
    };
  });

  const insetPoints: PercentPoint[] = [];

  for (let i = 0; i < offsetLines.length; i++) {
    const prev = offsetLines[(i - 1 + offsetLines.length) % offsetLines.length];
    const curr = offsetLines[i];

    const cross = intersectInfiniteLines(prev.p1, prev.p2, curr.p1, curr.p2);
    insetPoints.push(cross ?? curr.p1);
  }

  return insetPoints;
}

export function getFramePolygonPoints(frame: Frame): PercentPoint[] {
  return getLocalPolygonPoints(frame);
}

export function getFramePolygonPointString(frame: Frame) {
  return getFramePolygonPoints(frame)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function getFramePolygonPointsAbsolute(frameLike: FrameLike): PercentPoint[] {
  return getAbsolutePolygonPoints(frameLike);
}

export function isPointInPolygon(point: PercentPoint, polygon: PercentPoint[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0000001) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function isPointInFramePolygon(point: PercentPoint, frameLike: FrameLike) {
  const polygon = getFramePolygonPointsAbsolute(frameLike);
  return isPointInPolygon(point, polygon);
}

export function getFramePolygonCenterPoint(frame: Frame) {
  const points = getFramePolygonPointsAbsolute(frame);
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    xPercent: sum.x / points.length,
    yPercent: sum.y / points.length,
  };
}

export function isBubbleOverflowingFramePolygon(bubble: Bubble, frame: Frame) {
  const corners = [
    { x: bubble.x, y: bubble.y },
    { x: bubble.x + bubble.w, y: bubble.y },
    { x: bubble.x + bubble.w, y: bubble.y + bubble.h },
    { x: bubble.x, y: bubble.y + bubble.h },
  ];

  return corners.some((corner) => !isPointInFramePolygon(corner, frame));
}

export function getFrameClipPath(frame: Frame) {
  return `polygon(${getFramePolygonPoints(frame)
    .map((point) => `${point.x}% ${point.y}%`)
    .join(", ")})`;
}

export function getFrameInnerClipPath(frame: Frame) {
  const local = getFramePolygonPoints(frame);

  const insetX =
    (CONTENT_INSET_CANVAS_PERCENT_X * 100) / Math.max(frame.w, 0.000001);
  const insetY =
    (CONTENT_INSET_CANVAS_PERCENT_Y * 100) / Math.max(frame.h, 0.000001);

  const innerLocal = insetLocalPolygon(local, insetX, insetY);

  return `polygon(${innerLocal
    .map((p) => `${p.x}% ${p.y}%`)
    .join(", ")})`;
}

export function getBubbleFrameClipPath(frame: Frame) {
  const local = getFramePolygonPoints(frame);

  const bubbleInsetCanvasPercentX =
    CONTENT_INSET_CANVAS_PERCENT_X + (0.5 / PAGE_WIDTH) * 100;
  const bubbleInsetCanvasPercentY =
    CONTENT_INSET_CANVAS_PERCENT_Y + (0.5 / PAGE_HEIGHT) * 100;

  const insetX =
    (bubbleInsetCanvasPercentX * 100) / Math.max(frame.w, 0.000001);
  const insetY =
    (bubbleInsetCanvasPercentY * 100) / Math.max(frame.h, 0.000001);

  const innerLocal = insetLocalPolygon(local, insetX, insetY);

  return `polygon(${innerLocal
    .map((p) => `${p.x}% ${p.y}%`)
    .join(", ")})`;
}

export function getFrameInnerPolygonPointString(frame: Frame) {
  const localPoints = getFramePolygonPoints(frame);

  const insetX =
    (STROKE_INSET_CANVAS_PERCENT_X * 100) / Math.max(frame.w, 0.000001);
  const insetY =
    (STROKE_INSET_CANVAS_PERCENT_Y * 100) / Math.max(frame.h, 0.000001);

  const insetPoints = insetLocalPolygon(localPoints, insetX, insetY);

  return insetPoints.map((point) => `${point.x},${point.y}`).join(" ");
}

export function getBubbleCenterFrame(page: Page, bubble: Bubble): Frame | null {
  const cx = bubble.x + bubble.w / 2;
  const cy = bubble.y + bubble.h / 2;

  return (
    [...page.frames]
      .reverse()
      .find((frame) => isPointInFramePolygon({ x: cx, y: cy }, frame)) ?? null
  );
}

export function getSoundCenterFrame(page: Page, sound: SoundText): Frame | null {
  return (
    [...page.frames]
      .reverse()
      .find((frame) => isPointInFramePolygon({ x: sound.x, y: sound.y }, frame)) ??
    null
  );
}

export function getFrameImageMetrics(frame: Frame) {
  const outerLocal = getFramePolygonPoints(frame);

  const contentInsetX =
    (CONTENT_INSET_CANVAS_PERCENT_X * 100) / Math.max(frame.w, 0.000001);
  const contentInsetY =
    (CONTENT_INSET_CANVAS_PERCENT_Y * 100) / Math.max(frame.h, 0.000001);

  const contentLocal = frame.borderEnabled
    ? insetLocalPolygon(outerLocal, contentInsetX, contentInsetY)
    : outerLocal;

  const contentAbs = frame.borderEnabled
    ? localToAbsolute(frame, contentLocal)
    : [
        { x: frame.x, y: frame.y },
        { x: frame.x + frame.w, y: frame.y },
        { x: frame.x + frame.w, y: frame.y + frame.h },
        { x: frame.x, y: frame.y + frame.h },
      ];

  const bounds = getBoundsFromPoints(contentAbs);

  const framePixelW = (PAGE_WIDTH * bounds.w) / 100;
  const framePixelH = (PAGE_HEIGHT * bounds.h) / 100;

  const imageAreaLeftPx = (PAGE_WIDTH * (bounds.minX - frame.x)) / 100;
  const imageAreaTopPx = (PAGE_HEIGHT * (bounds.minY - frame.y)) / 100;

  const imageW = Math.max(frame.imageNaturalWidth ?? 0, 1);
  const imageH = Math.max(frame.imageNaturalHeight ?? 0, 1);

  const imageHasTransparency = !!(frame as FrameLike).imageHasTransparency;
  const baseScale = imageHasTransparency
    ? Math.min(framePixelW / imageW, framePixelH / imageH)
    : Math.max(framePixelW / imageW, framePixelH / imageH);
  const actualScale = baseScale * Math.max(frame.imageScale ?? 1, 0.05);

  const renderedImageW = imageW * actualScale;
  const renderedImageH = imageH * actualScale;

  const maxOffsetX = Math.max(0, (renderedImageW - framePixelW) / 2);
  const maxOffsetY = Math.max(0, (renderedImageH - framePixelH) / 2);

  const imageAreaLeftPercent =
    ((bounds.minX - frame.x) / Math.max(frame.w, 0.000001)) * 100;
  const imageAreaTopPercent =
    ((bounds.minY - frame.y) / Math.max(frame.h, 0.000001)) * 100;
  const imageAreaWidthPercent =
    (bounds.w / Math.max(frame.w, 0.000001)) * 100;
  const imageAreaHeightPercent =
    (bounds.h / Math.max(frame.h, 0.000001)) * 100;

  const imageClipPath = frame.borderEnabled
    ? `polygon(${contentLocal.map((p) => `${p.x}% ${p.y}%`).join(", ")})`
    : "inset(0)";

  return {
    framePixelW,
    framePixelH,
    frameBoundsPercent: bounds,

    baseScale,
    actualScale,

    renderedImageW,
    renderedImageH,

    imageLeft:
      imageAreaLeftPx +
      framePixelW / 2 -
      renderedImageW / 2 +
      frame.imageOffsetX,
    imageTop:
      imageAreaTopPx +
      framePixelH / 2 -
      renderedImageH / 2 +
      frame.imageOffsetY,

    minOffsetX: -maxOffsetX,
    maxOffsetX,
    minOffsetY: -maxOffsetY,
    maxOffsetY,

    imageAreaLeftPercent,
    imageAreaTopPercent,
    imageAreaWidthPercent,
    imageAreaHeightPercent,

    imageClipPath,
  };
}