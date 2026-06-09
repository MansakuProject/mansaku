import type { Page, Frame, Bubble, SoundText, FramePolygonPoints, FrameTiltValue, SoundTiltValue } from "./types";
import { getFramePolygonPointsAbsolute } from "./frameGeometry";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function clonePages(source: Page[]): Page[] {
  return structuredClone(source);
}

export function getNextBubbleLayer(page: Page | null) {
  if (!page || page.bubbles.length === 0) return 1;
  return Math.max(...page.bubbles.map((b) => b.layer ?? 0)) + 1;
}

function normalizeBubbleBackgroundColor(value: any) {
  if (value === "black" || value === "#111827" || value === "#000000") {
    return "black";
  }

  if (value === "transparent") {
    return "transparent";
  }

  return "white";
}

function normalizeTonePercent(value: any, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 0, 100);
}

function normalizeBubbleTextColor(value: any): "black" | "white" {
  return value === "white" ? "white" : "black";
}

function migrateBubbleToneValues(bubble: any) {
  if (bubble.whiteTone != null || bubble.blackTone != null) {
    const whiteTone = normalizeTonePercent(bubble.whiteTone, 100);
    const blackTone = normalizeTonePercent(bubble.blackTone, 0);

    if (whiteTone >= 1) {
      return { whiteTone, blackTone: 0 };
    }

    if (blackTone >= 1) {
      return { whiteTone: 0, blackTone };
    }

    return { whiteTone: 0, blackTone: 0 };
  }

  const backgroundColor = normalizeBubbleBackgroundColor(bubble.backgroundColor);
  const opacityPercent = normalizeTonePercent(
    bubble.opacity == null ? 100 : bubble.opacity * 100,
    100
  );

  if (backgroundColor === "transparent") {
    return { whiteTone: 0, blackTone: 0 };
  }

  if (backgroundColor === "black") {
    return { whiteTone: 0, blackTone: opacityPercent };
  }

  return { whiteTone: opacityPercent, blackTone: 0 };
}

export function normalizeBubble(bubble: any, index: number): Bubble {
  const type = bubble.type ?? "ellipse";
  const toneValues = migrateBubbleToneValues(bubble);

  return {
    ...bubble,
    type,
    rubies: Array.isArray(bubble.rubies) ? bubble.rubies : [],
    writingMode: bubble.writingMode ?? "vertical",
    fontFamily: typeof bubble.fontFamily === "string" ? bubble.fontFamily : "",
    textColor: normalizeBubbleTextColor(bubble.textColor),
    whiteTone: toneValues.whiteTone,
    blackTone: toneValues.blackTone,
    backgroundColor: normalizeBubbleBackgroundColor(bubble.backgroundColor),
    layer: bubble.layer ?? index + 1,
    opacity: bubble.opacity ?? 1,
    tone: bubble.tone ?? "none",
  };
}

export function getNextSoundLayer(page: Page | null) {
  if (!page || page.sounds.length === 0) return 1;
  return Math.max(...page.sounds.map((s) => s.layer ?? 0)) + 1;
}


function normalizeTiltValue(value: any): FrameTiltValue {
  const n = Number(value);
  if (n === -10 || n === -5 || n === 0 || n === 5 || n === 10) return n;

  const candidates: FrameTiltValue[] = [-10, -5, 0, 5, 10];
  return candidates.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  );
}

function normalizeSoundTiltValue(value: any): SoundTiltValue {
  const n = Number(value);
  if (n === -30 || n === -20 || n === -10 || n === 0 || n === 10 || n === 20 || n === 30) return n;

  const candidates: SoundTiltValue[] = [-30, -20, -10, 0, 10, 20, 30];
  return candidates.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  );
}

function normalizeSoundCurveValue(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return clamp(n, -120, 120);
}

export function normalizeSound(sound: SoundText, index: number): SoundText {
  return {
    ...sound,
    fontFamily: typeof (sound as any).fontFamily === "string" ? (sound as any).fontFamily : "",
    rotate: sound.rotate ?? 0,
    writingMode: sound.writingMode ?? "vertical",
    color: sound.color ?? "#000000",
    outlineColor: sound.outlineColor ?? "transparent",
    outlineWidth: sound.outlineWidth ?? 0,
    topTilt: normalizeSoundTiltValue((sound as any).topTilt ?? 0),
    rightTilt: normalizeSoundTiltValue((sound as any).rightTilt ?? 0),
    bottomTilt: normalizeSoundTiltValue((sound as any).bottomTilt ?? 0),
    leftTilt: normalizeSoundTiltValue((sound as any).leftTilt ?? 0),
    curveX: normalizeSoundCurveValue((sound as any).curveX ?? 0),
    curveY: normalizeSoundCurveValue((sound as any).curveY ?? 0),
    layer: sound.layer ?? index + 1,
    clipToFrame: sound.clipToFrame ?? false,
  };
}

function normalizeFramePoints(points: any): FramePolygonPoints | undefined {
  if (!Array.isArray(points) || points.length !== 4) {
    return undefined;
  }

  const normalized = points.map((point) => {
    const x = Number(point?.x);
    const y = Number(point?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return { x, y };
  });

  if (normalized.some((point) => point == null)) {
    return undefined;
  }

  return normalized as FramePolygonPoints;
}

export function normalizeFrame(frame: any): Frame {
  const topTilt =
    frame.topTilt ??
    frame.topRightTilt ??
    (frame.topLeftTilt != null ? -frame.topLeftTilt : 0);

  const rightTilt =
    frame.rightTilt ??
    frame.rightBottomTilt ??
    (frame.rightTopTilt != null ? -frame.rightTopTilt : 0);

  const bottomTilt =
    frame.bottomTilt ??
    frame.bottomLeftTilt ??
    (frame.bottomRightTilt != null ? -frame.bottomRightTilt : 0);

  const leftTilt =
    frame.leftTilt ??
    frame.leftTopTilt ??
    (frame.leftBottomTilt != null ? -frame.leftBottomTilt : 0);

  const baseFrame: Frame = {
    ...frame,
    borderEnabled: frame.borderEnabled ?? true,
    image: frame.image ?? null,
    imageOffsetX: frame.imageOffsetX ?? 0,
    imageOffsetY: frame.imageOffsetY ?? 0,
    imageScale: frame.imageScale ?? 1,
    imageNaturalWidth: frame.imageNaturalWidth ?? 0,
    imageNaturalHeight: frame.imageNaturalHeight ?? 0,
    topTilt,
    rightTilt,
    bottomTilt,
    leftTilt,
  };

  const normalizedPoints = normalizeFramePoints(frame.points);

  if (normalizedPoints) {
    return {
      ...baseFrame,
      points: normalizedPoints,
    };
  }

  return {
    ...baseFrame,
    points: getFramePolygonPointsAbsolute(baseFrame) as FramePolygonPoints,
  };
}

export function normalizePage(page: Page): Page {
  return {
    ...page,
    visible: page.visible ?? true,
    frames: page.frames.map((frame) => normalizeFrame(frame)),
    bubbles: page.bubbles.map((bubble, index) =>
      normalizeBubble(bubble, index)
    ),
    sounds: page.sounds.map((sound, index) =>
      normalizeSound(sound, index)
    ),
  };
}