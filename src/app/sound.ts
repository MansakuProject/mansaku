import type { PercentPoint, SoundText, SoundTiltValue } from "./types";

export const SOUND_STYLE_PRESETS = {
  blackWhite: {
    color: "#000000",
    outlineColor: "#ffffff",
    outlineWidth: 2,
  },
  whiteBlack: {
    color: "#ffffff",
    outlineColor: "#000000",
    outlineWidth: 2,
  },
  black: {
    color: "#000000",
    outlineColor: "transparent",
    outlineWidth: 0,
  },
  white: {
    color: "#ffffff",
    outlineColor: "transparent",
    outlineWidth: 0,
  },
} as const;

export type SoundStyleKey = keyof typeof SOUND_STYLE_PRESETS;

export const SOUND_STYLE_ORDER: SoundStyleKey[] = [
  "blackWhite",
  "whiteBlack",
  "black",
  "white",
];

export const DEFAULT_SOUND_STYLE_KEY: SoundStyleKey = "blackWhite";

export function buildTextStrokeShadow(
  outlineColor: string,
  outlineWidth: number
) {
  if (outlineWidth <= 0 || outlineColor === "transparent") return "none";

  const w = outlineWidth;

  return [
    `${-w}px 0 0 ${outlineColor}`,
    `${w}px 0 0 ${outlineColor}`,
    `0 ${-w}px 0 ${outlineColor}`,
    `0 ${w}px 0 ${outlineColor}`,
    `${-w}px ${-w}px 0 ${outlineColor}`,
    `${w}px ${-w}px 0 ${outlineColor}`,
    `${-w}px ${w}px 0 ${outlineColor}`,
    `${w}px ${w}px 0 ${outlineColor}`,
  ].join(", ");
}

export function getNextSoundStyleKey(sound: SoundText): SoundStyleKey {
  const currentKey =
    SOUND_STYLE_ORDER.find((key) => {
      const preset = SOUND_STYLE_PRESETS[key];

      return (
        sound.color === preset.color &&
        sound.outlineColor === preset.outlineColor &&
        sound.outlineWidth === preset.outlineWidth
      );
    }) ?? DEFAULT_SOUND_STYLE_KEY;

  const currentIndex = SOUND_STYLE_ORDER.indexOf(currentKey);

  return SOUND_STYLE_ORDER[(currentIndex + 1) % SOUND_STYLE_ORDER.length];
}

export function normalizeSoundTiltValue(value: unknown): SoundTiltValue {
  const n = Number(value);
  if (n === -30 || n === -20 || n === -10 || n === 0 || n === 10 || n === 20 || n === 30) return n;

  const candidates: SoundTiltValue[] = [-30, -20, -10, 0, 10, 20, 30];
  return candidates.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  );
}

export function getSoundTextBoxMetrics(sound: SoundText) {
  const text = (sound.text || " ").replace(/[\r\n]+/g, " ");
  const chars = Array.from(text);
  const length = Math.max(chars.length, 1);
  const fontSize = Math.max(10, Number(sound.fontSize) || 42);
  const isHorizontal = (sound.writingMode ?? "vertical") === "horizontal";

  if (isHorizontal) {
    return {
      width: Math.max(fontSize * 1.8, fontSize * length * 0.82 + fontSize * 0.9),
      height: Math.max(fontSize * 1.65, fontSize + 18),
      text,
      chars,
    };
  }

  return {
    width: Math.max(fontSize * 1.65, fontSize + 18),
    height: Math.max(fontSize * 1.8, fontSize * length * 1.08 + fontSize * 0.9),
    text,
    chars,
  };
}

function getSoundTiltBaseLength(width: number, height: number) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  return Math.max(safeWidth, safeHeight);
}

function buildTopLine(width: number, height: number, tilt: SoundTiltValue) {
  const dy = Math.tan((tilt * Math.PI) / 180) * (getSoundTiltBaseLength(width, height) / 2);
  return {
    p1: { x: 0, y: -dy / 2 },
    p2: { x: width, y: dy / 2 },
  };
}

function buildBottomLine(width: number, height: number, tilt: SoundTiltValue) {
  const dy = Math.tan((tilt * Math.PI) / 180) * (getSoundTiltBaseLength(width, height) / 2);
  return {
    p1: { x: 0, y: height - dy / 2 },
    p2: { x: width, y: height + dy / 2 },
  };
}

function buildRightLine(width: number, height: number, tilt: SoundTiltValue) {
  const dx = Math.tan((tilt * Math.PI) / 180) * (getSoundTiltBaseLength(width, height) / 2);
  return {
    p1: { x: width - dx / 2, y: 0 },
    p2: { x: width + dx / 2, y: height },
  };
}

function buildLeftLine(width: number, height: number, tilt: SoundTiltValue) {
  const dx = Math.tan((tilt * Math.PI) / 180) * (getSoundTiltBaseLength(width, height) / 2);
  return {
    p1: { x: -dx / 2, y: 0 },
    p2: { x: dx / 2, y: height },
  };
}

function intersectLines(
  a1: PercentPoint,
  a2: PercentPoint,
  b1: PercentPoint,
  b2: PercentPoint
): PercentPoint | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const cross = dax * dby - day * dbx;
  if (Math.abs(cross) < 0.000001) return null;

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / cross;
  return { x: a1.x + dax * t, y: a1.y + day * t };
}

export function getSoundPolygonPoints(
  sound: SoundText,
  width: number,
  height: number
): [PercentPoint, PercentPoint, PercentPoint, PercentPoint] {
  const top = buildTopLine(width, height, sound.topTilt ?? 0);
  const right = buildRightLine(width, height, sound.rightTilt ?? 0);
  const bottom = buildBottomLine(width, height, sound.bottomTilt ?? 0);
  const left = buildLeftLine(width, height, sound.leftTilt ?? 0);

  const tl = intersectLines(top.p1, top.p2, left.p1, left.p2) ?? { x: 0, y: 0 };
  const tr = intersectLines(top.p1, top.p2, right.p1, right.p2) ?? { x: width, y: 0 };
  const br = intersectLines(bottom.p1, bottom.p2, right.p1, right.p2) ?? { x: width, y: height };
  const bl = intersectLines(bottom.p1, bottom.p2, left.p1, left.p2) ?? { x: 0, y: height };

  return [tl, tr, br, bl];
}

export function getSoundPolygonPointString(
  sound: SoundText,
  width: number,
  height: number
) {
  return getSoundPolygonPoints(sound, width, height)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function getSoundSelectionPath(
  sound: SoundText,
  width: number,
  height: number
) {
  const [tl, tr, br, bl] = getSoundPolygonPoints(sound, width, height);
  const curveX = normalizeCurveValue(sound.curveX);
  const curveY = normalizeCurveValue(sound.curveY);
  const isHorizontal = (sound.writingMode ?? "vertical") === "horizontal";

  const samples = [0, 0.16, 0.33, 0.5, 0.67, 0.84, 1];

  const curvePoint = (a: PercentPoint, b: PercentPoint, t: number) => {
    return applyCurveToPoint(interpolatePoint(a, b, t), t, curveX, curveY);
  };

  const points = isHorizontal
    ? [
        ...samples.map((t) => curvePoint(tl, tr, t)),
        ...[...samples].reverse().map((t) => curvePoint(bl, br, t)),
      ]
    : [
        ...samples.map((t) => curvePoint(tr, br, t)),
        ...[...samples].reverse().map((t) => curvePoint(tl, bl, t)),
      ];

  return points
    .map((point, index) =>
      index === 0
        ? `M ${point.x} ${point.y}`
        : `L ${point.x} ${point.y}`
    )
    .join("\n") + "\nZ";
}

export type SoundGlyphLayout = {
  char: string;
  x: number;
  y: number;
  fontSize: number;
  rotate?: number;
};

function shouldRotateVerticalSoundGlyph(char: string) {
  return (
    "'()=~|[]<>”’（）＝～｜「」＜＞ーｰ-－―–—"
      .includes(char)
  );
}

function interpolatePoint(a: PercentPoint, b: PercentPoint, t: number): PercentPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function midpoint(a: PercentPoint, b: PercentPoint): PercentPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCurveValue(value: number | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return clampNumber(n, -120, 120);
}

function getCurveBend(t: number) {
  return Math.sin(Math.PI * t);
}

function getCurveDerivative(t: number) {
  return Math.PI * Math.cos(Math.PI * t);
}

function getAngleFromVector(dx: number, dy: number) {
  if (Math.hypot(dx, dy) < 0.000001) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function applyCurveToPoint(
  point: PercentPoint,
  t: number,
  curveX: number,
  curveY: number
): PercentPoint {
  const bend = getCurveBend(t);

  return {
    x: point.x + curveX * bend,
    y: point.y + curveY * bend,
  };
}

export function getSoundGlyphLayouts(
  sound: SoundText,
  width: number,
  height: number
): SoundGlyphLayout[] {
  const box = getSoundTextBoxMetrics(sound);
  const chars = box.chars.length > 0 ? box.chars : [" "];
  const [tl, tr, br, bl] = getSoundPolygonPoints(sound, width, height);
  const isHorizontal = (sound.writingMode ?? "vertical") === "horizontal";
  const baseFontSize = Math.max(10, Number(sound.fontSize) || 42);
  const curveX = normalizeCurveValue(sound.curveX);
  const curveY = normalizeCurveValue(sound.curveY);

  const getSafeScale = (value: number) => clampNumber(value, 0.45, 1.9);

  if (isHorizontal) {
    const leftCenter = midpoint(tl, bl);
    const rightCenter = midpoint(tr, br);
    const baseDx = rightCenter.x - leftCenter.x;
    const baseDy = rightCenter.y - leftCenter.y;
    const centerLineLength = Math.max(Math.hypot(baseDx, baseDy), 1);

    const provisional = chars.map((char, index) => {
      const t = (index + 0.5) / Math.max(chars.length, 1);
      const top = interpolatePoint(tl, tr, t);
      const bottom = interpolatePoint(bl, br, t);
      const availableHeight = Math.hypot(bottom.x - top.x, bottom.y - top.y);
      const scale = getSafeScale(availableHeight / Math.max(height, 1));
      const fontSize = baseFontSize * scale;

      return {
        char,
        fontSize,
        advance: Math.max(fontSize * 0.72, baseFontSize * 0.28),
      };
    });

    const totalAdvance = provisional.reduce((sum, item) => sum + item.advance, 0) || 1;
    const fitScale = Math.min(1, (centerLineLength * 0.92) / totalAdvance);
    let cursor = 0;

    return provisional.map((item) => {
      const advance = item.advance * fitScale;
      const t = clampNumber(
        (cursor + advance / 2) / Math.max(totalAdvance * fitScale, 1),
        0.04,
        0.96
      );
      const baseCenter = interpolatePoint(leftCenter, rightCenter, t);
      const center = applyCurveToPoint(baseCenter, t, curveX, curveY);
      const derivative = getCurveDerivative(t);
      const tangentX = baseDx + curveX * derivative;
      const tangentY = baseDy + curveY * derivative;
      const rotate = getAngleFromVector(tangentX, tangentY);
      cursor += advance;

      return {
        char: item.char,
        x: center.x,
        y: center.y + baseFontSize * 0.04,
        fontSize: item.fontSize * fitScale,
        rotate,
      };
    });
  }

  const topCenter = midpoint(tl, tr);
  const bottomCenter = midpoint(bl, br);
  const baseDx = bottomCenter.x - topCenter.x;
  const baseDy = bottomCenter.y - topCenter.y;
  const centerLineLength = Math.max(Math.hypot(baseDx, baseDy), 1);

  const provisional = chars.map((char, index) => {
    const t = (index + 0.5) / Math.max(chars.length, 1);
    const left = interpolatePoint(tl, bl, t);
    const right = interpolatePoint(tr, br, t);
    const availableWidth = Math.hypot(right.x - left.x, right.y - left.y);
    const scale = getSafeScale(availableWidth / Math.max(width, 1));
    const fontSize = baseFontSize * scale;

    return {
      char,
      fontSize,
      advance: Math.max(fontSize * 0.92, baseFontSize * 0.34),
    };
  });

  const totalAdvance = provisional.reduce((sum, item) => sum + item.advance, 0) || 1;
  const fitScale = Math.min(1, (centerLineLength * 0.92) / totalAdvance);
  let cursor = 0;

  return provisional.map((item) => {
    const advance = item.advance * fitScale;
    const t = clampNumber(
      (cursor + advance / 2) / Math.max(totalAdvance * fitScale, 1),
      0.04,
      0.96
    );
    const baseCenter = interpolatePoint(topCenter, bottomCenter, t);
    const center = applyCurveToPoint(baseCenter, t, curveX, curveY);
    const derivative = getCurveDerivative(t);
    const tangentX = baseDx + curveX * derivative;
    const tangentY = baseDy + curveY * derivative;
    const pathRotate = getAngleFromVector(tangentX, tangentY) - 90;
    const glyphRotate = shouldRotateVerticalSoundGlyph(item.char) ? 90 : 0;
    const rotate = pathRotate + glyphRotate;
    cursor += advance;

    return {
      char: item.char,
      x: center.x,
      y: center.y,
      fontSize: item.fontSize * fitScale,
      rotate,
    };
  });
}
