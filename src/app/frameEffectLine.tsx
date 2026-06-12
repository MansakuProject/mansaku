import type { ReactElement } from "react";
import type { MessageKey } from "./i18n";
import type { Frame } from "./types";

export type FrameEffectLineKind = "focus" | "speed";
export type FrameEffectLineColorMode = "black" | "white" | "color";

export type FrameEffectLineFields = {
  enabled: boolean;
  kind: FrameEffectLineKind;
  colorMode: FrameEffectLineColorMode;
  customColor: string;
  strokeWidth: number;
  density: number;
  innerBlank: number;
  centerX: number;
  centerY: number;
  angle: number;
};

export const FRAME_EFFECT_LINE_KINDS: FrameEffectLineKind[] = ["focus", "speed"];

export const FRAME_EFFECT_LINE_COLOR_MODES: FrameEffectLineColorMode[] = [
  "black",
  "white",
  "color",
];

const EFFECT_LINE_FIXED_WIDTH = 0.6;

export const FRAME_EFFECT_LINE_DEFAULTS: FrameEffectLineFields = {
  enabled: false,
  kind: "focus",
  colorMode: "black",
  customColor: "#ef4444",
  strokeWidth: EFFECT_LINE_FIXED_WIDTH,
  density: 0.5,
  innerBlank: 22,
  centerX: 50,
  centerY: 50,
  angle: 0,
};

type FrameEffectLineStorageFields = {
  effectLineEnabled?: boolean;
  effectLineKind?: FrameEffectLineKind;
  effectLineColorMode?: FrameEffectLineColorMode;
  effectLineCustomColor?: string;
  effectLineStrokeWidth?: number;
  effectLineDensity?: number;
  effectLineInnerBlank?: number;
  effectLineCenterX?: number;
  effectLineCenterY?: number;
  effectLineAngle?: number;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeKind(value: unknown): FrameEffectLineKind {
  return value === "speed" ? "speed" : "focus";
}

function normalizeColorMode(value: unknown): FrameEffectLineColorMode {
  if (value === "white" || value === "color") return value;
  return "black";
}

function pseudoRandom(index: number) {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pointOnRay(cx: number, cy: number, angle: number, distance: number) {
  return {
    x: cx + Math.cos(angle) * distance,
    y: cy + Math.sin(angle) * distance,
  };
}

function buildTaperedRayPath({
  cx,
  cy,
  angle,
  inner,
  outer,
  innerWidth,
  outerWidth,
  wobble,
}: {
  cx: number;
  cy: number;
  angle: number;
  inner: number;
  outer: number;
  innerWidth: number;
  outerWidth: number;
  wobble: number;
}) {
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const mid = pointOnRay(cx, cy, angle, inner + (outer - inner) * 0.56);
  const start = pointOnRay(cx, cy, angle, inner);
  const end = pointOnRay(cx, cy, angle, outer);
  const midShift = Math.sin(wobble) * 1.2;

  const startLeft = {
    x: start.x + normalX * innerWidth * 0.5,
    y: start.y + normalY * innerWidth * 0.5,
  };
  const startRight = {
    x: start.x - normalX * innerWidth * 0.5,
    y: start.y - normalY * innerWidth * 0.5,
  };
  const endLeft = {
    x: end.x + normalX * outerWidth * 0.5,
    y: end.y + normalY * outerWidth * 0.5,
  };
  const endRight = {
    x: end.x - normalX * outerWidth * 0.5,
    y: end.y - normalY * outerWidth * 0.5,
  };
  const controlLeft = {
    x: mid.x + normalX * (outerWidth * 0.25 + midShift),
    y: mid.y + normalY * (outerWidth * 0.25 + midShift),
  };
  const controlRight = {
    x: mid.x - normalX * (outerWidth * 0.25 - midShift),
    y: mid.y - normalY * (outerWidth * 0.25 - midShift),
  };

  return [
    `M ${startLeft.x.toFixed(3)} ${startLeft.y.toFixed(3)}`,
    `Q ${controlLeft.x.toFixed(3)} ${controlLeft.y.toFixed(3)} ${endLeft.x.toFixed(3)} ${endLeft.y.toFixed(3)}`,
    `L ${endRight.x.toFixed(3)} ${endRight.y.toFixed(3)}`,
    `Q ${controlRight.x.toFixed(3)} ${controlRight.y.toFixed(3)} ${startRight.x.toFixed(3)} ${startRight.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

type SpeedStrokeCap = "normal" | "point";

function buildSpeedStrokePath({
  x1,
  x2,
  y,
  thickness,
  slant,
  taperStart,
  taperEnd,
  wobble,
  startCap = "normal",
  endCap = "normal",
}: {
  x1: number;
  x2: number;
  y: number;
  thickness: number;
  slant: number;
  taperStart: number;
  taperEnd: number;
  wobble: number;
  startCap?: SpeedStrokeCap;
  endCap?: SpeedStrokeCap;
}) {
  const midX = (x1 + x2) / 2;
  const midY = y + Math.sin(wobble) * 0.55;
  const leftTipY = y + thickness * 0.03;
  const rightTipY = y + slant - thickness * 0.05;

  const leftTop =
    startCap === "point"
      ? { x: x1, y: leftTipY }
      : { x: x1 + taperStart, y: y - thickness * 0.22 };
  const leftBottom =
    startCap === "point"
      ? { x: x1, y: leftTipY }
      : { x: x1, y: y + thickness * 0.28 };
  const rightTop =
    endCap === "point"
      ? { x: x2, y: rightTipY }
      : { x: x2, y: y - thickness * 0.55 + slant };
  const rightBottom =
    endCap === "point"
      ? { x: x2, y: rightTipY }
      : { x: x2 - taperEnd, y: y + thickness * 0.45 + slant };

  return [
    `M ${leftTop.x.toFixed(3)} ${leftTop.y.toFixed(3)}`,
    `Q ${midX.toFixed(3)} ${(midY - thickness * 0.35).toFixed(3)} ${rightTop.x.toFixed(3)} ${rightTop.y.toFixed(3)}`,
    `L ${rightBottom.x.toFixed(3)} ${rightBottom.y.toFixed(3)}`,
    `Q ${midX.toFixed(3)} ${(midY + thickness * 0.35).toFixed(3)} ${leftBottom.x.toFixed(3)} ${leftBottom.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export function getFrameEffectLineKindLabel(
  kind: FrameEffectLineKind,
  t?: (key: MessageKey) => string
) {
  const key: MessageKey = kind === "speed" ? "effectLineSpeed" : "effectLineFocus";
  return t ? t(key) : kind === "speed" ? "Speed Line" : "Focus Line";
}

export function getFrameEffectLineFields(frame: Frame): FrameEffectLineFields {
  const fields = frame as Frame & FrameEffectLineStorageFields;

  return {
    enabled: !!fields.effectLineEnabled,
    kind: normalizeKind(fields.effectLineKind),
    colorMode: normalizeColorMode(fields.effectLineColorMode),
    customColor:
      typeof fields.effectLineCustomColor === "string" &&
      fields.effectLineCustomColor.trim().length > 0
        ? fields.effectLineCustomColor
        : FRAME_EFFECT_LINE_DEFAULTS.customColor,
    strokeWidth: EFFECT_LINE_FIXED_WIDTH,
    density: clampNumber(
      fields.effectLineDensity,
      0,
      1,
      FRAME_EFFECT_LINE_DEFAULTS.density
    ),
    innerBlank: clampNumber(
      fields.effectLineInnerBlank,
      0,
      100,
      FRAME_EFFECT_LINE_DEFAULTS.innerBlank
    ),
    centerX: clampNumber(
      fields.effectLineCenterX,
      0,
      100,
      FRAME_EFFECT_LINE_DEFAULTS.centerX
    ),
    centerY: clampNumber(
      fields.effectLineCenterY,
      0,
      100,
      FRAME_EFFECT_LINE_DEFAULTS.centerY
    ),
    angle: clampNumber(
      fields.effectLineAngle,
      -90,
      90,
      FRAME_EFFECT_LINE_DEFAULTS.angle
    ),
  };
}

function getFrameEffectLineColor(fields: FrameEffectLineFields) {
  switch (fields.colorMode) {
    case "white":
      return "#ffffff";
    case "color":
      return fields.customColor || FRAME_EFFECT_LINE_DEFAULTS.customColor;
    case "black":
    default:
      return "#111827";
  }
}

function buildFocusLines(fields: FrameEffectLineFields) {
  if (fields.density <= 0) return [];

  const cx = fields.centerX;
  const cy = fields.centerY;
  const densityFactor = fields.density;
  const lineCount = Math.max(1, Math.round(220 * densityFactor));
  if (fields.innerBlank <= 0) {
    return [];
  }
  const innerBase = (100 - fields.innerBlank) * 0.6;
  const outerRadius = 128;
  const shapes: ReactElement[] = [];

  for (let i = 0; i < lineCount; i++) {
    const randomA = pseudoRandom(i);
    const randomB = pseudoRandom(i + 1000);
    const randomC = pseudoRandom(i + 2000);
    const randomD = pseudoRandom(i + 3000);
    const angle = (Math.PI * 2 * i) / lineCount + (randomA - 0.5) * 0.016;
    const skip = densityFactor < 0.45 && i % 8 === 3;
    if (skip) continue;

    const jag = Math.sin(i * 2.17) * 4.8 + Math.cos(i * 1.31) * 3.2;
    const inner = Math.max(0, innerBase + jag + (randomB - 0.5) * 7);
    const outer = outerRadius + (randomC - 0.5) * 12;
    const length = Math.max(outer - inner, 4);
    const isHeavy = randomA > 0.7 || i % 11 === 0;
    const widthScale = fields.strokeWidth * (isHeavy ? 2.9 : 1.35);
    const outerWidth = Math.max(0.8, widthScale * (0.8 + randomD * 1.6));
    const innerWidth = Math.max(0.16, fields.strokeWidth * (isHeavy ? 0.42 : 0.18));

    if (length < 7) continue;

    shapes.push(
      <path
        key={`focus-main-${i}`}
        d={buildTaperedRayPath({
          cx,
          cy,
          angle,
          inner,
          outer,
          innerWidth,
          outerWidth,
          wobble: i * 1.37,
        })}
      />
    );

    if (isHeavy && length > 32) {
      const scratchInner = inner + length * (0.18 + randomB * 0.2);
      const scratchOuter = Math.min(outer - 1, inner + length * (0.64 + randomC * 0.22));
      shapes.push(
        <path
          key={`focus-scratch-${i}`}
          opacity={0.58}
          d={buildTaperedRayPath({
            cx,
            cy,
            angle: angle + 0.006 + randomD * 0.014,
            inner: scratchInner,
            outer: scratchOuter,
            innerWidth: Math.max(0.12, fields.strokeWidth * 0.12),
            outerWidth: Math.max(0.32, fields.strokeWidth * (0.35 + randomA)),
            wobble: i * 2.11,
          })}
        />
      );
    }
  }

  return shapes;
}

function buildSpeedLines(fields: FrameEffectLineFields) {
  const densityFactor = fields.density;
  const cloggingFactor = clampNumber(fields.innerBlank, 0, 100, 0) / 100;

  if (densityFactor <= 0 || cloggingFactor <= 0) return [];

  const speedDensityScale = 4;
  const spacing = Math.max(0.8, (18 - densityFactor * 16) / speedDensityScale);
  const extent = 210;
  const count = Math.ceil((extent * 2) / spacing);
  const cx = fields.centerX;
  const cy = fields.centerY;
  const effectiveClogging = cloggingFactor;
  const maxBlankWidth = 94;
  const blankWidth = effectiveClogging >= 1 ? 0 : (1 - effectiveClogging) * maxBlankWidth;
  const halfBlank = blankWidth / 2;
  const edgeJitterScale = 0.08 + effectiveClogging * 0.92;
  const shapes: ReactElement[] = [];

  for (let i = -count; i <= count; i++) {
    const randomA = pseudoRandom(i + 4000);
    const randomB = pseudoRandom(i + 5000);
    const randomC = pseudoRandom(i + 6000);
    const randomD = pseudoRandom(i + 7000);

    if (randomA > densityFactor) continue;

    const y = cy + i * spacing + (randomA - 0.5) * Math.min(1.8, spacing * 0.35);
    const isHeavy = i % 5 === 0 || randomB > 0.74;
    const thicknessBase =
      fields.strokeWidth *
      (isHeavy
        ? 3.6 + randomC * 2.8
        : 1.1 + randomC * 1.7);

    const thickness =
      cloggingFactor >= 1
        ? thicknessBase * 0.4
        : thicknessBase;
    const lineInset = (randomA - 0.5) * 16;
    const x1 = cx - extent + lineInset;
    const x2 = cx + extent - (randomB - 0.5) * 18;
    const slant = Math.sin(i * 0.91) * 0.7;
    const taperStart = 2 + randomC * 16;
    const taperEnd = 1 + randomD * 12;

    const pushSegment = (
      key: string,
      startX: number,
      endX: number,
      caps: { start?: SpeedStrokeCap; end?: SpeedStrokeCap } = {}
    ) => {
      if (endX - startX < 6) return;
      shapes.push(
        <path
          key={key}
          d={buildSpeedStrokePath({
            x1: startX,
            x2: endX,
            y,
            thickness,
            slant,
            taperStart,
            taperEnd,
            wobble: i * 1.21,
            startCap: caps.start,
            endCap: caps.end,
          })}
        />
      );

      if (isHeavy && endX - startX > 45) {
        const scratchStart = startX + (endX - startX) * (0.15 + randomA * 0.14);
        const scratchEnd = startX + (endX - startX) * (0.56 + randomD * 0.24);
        shapes.push(
          <path
            key={`${key}-scratch`}
            opacity={0.5}
            d={buildSpeedStrokePath({
              x1: scratchStart,
              x2: scratchEnd,
              y: y + thickness * 0.65 + randomB * 1.2,
              thickness: Math.max(0.35, fields.strokeWidth * (0.35 + randomC * 0.4)),
              slant: slant * 0.5,
              taperStart: taperStart * 0.6,
              taperEnd: taperEnd * 0.6,
              wobble: i * 2.09,
              startCap: caps.start,
              endCap: caps.end,
            })}
          />
        );
      }
    };

    if (blankWidth > 0) {
      const leftJitter =
        (Math.sin(i * 1.91) * 4.2 + Math.cos(i * 0.67) * 2.1) * edgeJitterScale;
      const rightJitter =
        (Math.cos(i * 1.73) * 4.2 - Math.sin(i * 0.83) * 2.1) * edgeJitterScale;
      const leftEnd = cx - halfBlank + leftJitter;
      const rightStart = cx + halfBlank + rightJitter;
      const safeLeftEnd = Math.min(leftEnd, rightStart);
      const safeRightStart = Math.max(leftEnd, rightStart);

      pushSegment(`speed-${i}-left`, x1, Math.max(x1, safeLeftEnd), { end: "point" });
      pushSegment(`speed-${i}-right`, Math.min(x2, safeRightStart), x2, { start: "point" });
      continue;
    }

    pushSegment(`speed-${i}`, x1, x2);
  }

  return (
    <g transform={`rotate(${fields.angle} ${cx} ${cy})`}>
      {shapes}
    </g>
  );
}

export function FrameEffectLineLayer({ frame }: { frame: Frame }) {
  const fields = getFrameEffectLineFields(frame);
  if (!fields.enabled) return null;

  const strokeColor = getFrameEffectLineColor(fields);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <g fill={strokeColor} opacity={0.96}>
        {fields.kind === "speed"
          ? buildSpeedLines(fields)
          : buildFocusLines(fields)}
      </g>
    </svg>
  );
}
