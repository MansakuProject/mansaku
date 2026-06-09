import type { Bubble, BubbleType } from "./types";
import type { MessageKey } from "./i18n";

export const bubbleTypes: BubbleType[] = [
  "ellipse",
  "heptagon",
  "explosion",
  "cloud",
  "wave",
  "rect",
  "thought",
  "flash",
  "electronic",
];

export function getBubbleTypeLabel(
  type: BubbleType,
  t: (key: MessageKey) => string
) {
  switch (type) {
    case "ellipse":
      return t("bubbleTypeEllipse");

    case "heptagon":
      return t("bubbleTypeHeptagon");

    case "explosion":
      return t("bubbleTypeExplosion");

    case "cloud":
      return t("bubbleTypeCloud");

    case "wave":
      return t("bubbleTypeWave");

    case "rect":
      return t("bubbleTypeRect");

    case "thought":
      return t("bubbleTypeThought");

    case "electronic":
      return t("bubbleTypeElectronic");

    case "flash":
      return t("bubbleTypeFlash");

    default:
      return type;
  }
}

export function applyBubbleTypePreset(
  bubble: Bubble,
  type: BubbleType
): Bubble {
  switch (type) {
    case "ellipse":
      return { ...bubble, type, shape: "ellipse", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "heptagon":
      return { ...bubble, type, shape: "heptagon", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "explosion":
      return { ...bubble, type, shape: "cornerSpiky", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "cloud":
      return { ...bubble, type, shape: "cloud", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "wave":
      return { ...bubble, type, shape: "wave", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "rect":
      return { ...bubble, type, shape: "rect", tailEnabled: false, tailStyle: "triangle", tailMode: "outside" };

    case "thought":
      return { ...bubble, type, shape: "ellipse", tailEnabled: true, tailStyle: "thought", tailMode: "outside" };

    case "electronic":
      return { ...bubble, type, shape: "electronic", tailEnabled: true, tailStyle: "triangle", tailMode: "outside" };

    case "flash":
      return { ...bubble, type, shape: "flash", tailEnabled: false, tailStyle: "none" };

    default:
      return bubble;
  }
}

export function getNextBubbleType(current: BubbleType): BubbleType {
  const index = bubbleTypes.indexOf(current);
  return bubbleTypes[(index + 1) % bubbleTypes.length];
}